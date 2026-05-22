import chalk from "chalk";
import { appendAudit } from "../run/state.js";
import type { Phase, Plan, PlanNode, RoleGuide, RunContext } from "../types.js";
import { runCli } from "./cli-runner.js";
import { crossProviderFallback, escalate, isCapacityOrContextFailure, rateLimitFallbacks } from "./router.js";
import { createRunEvent } from "../runtime/events.js";
import { checkCli } from "../util/check-cli.js";
import { apiFallbackAvailable, runApiFallback } from "../api/fallback.js";

export interface SubAgentResult {
  ok: boolean;
  output: string;
  modelUsed: string;
  costUsd: number;
  durationMs: number;
}

const MAX_TRANSIENT_RETRIES = 2;
const BASE_BACKOFF_MS = 1_500;
const HEARTBEAT_INTERVAL_MS = 20_000;

export function isTransientFailure(res: { exitCode: number; stderr: string; finalText: string }): boolean {
  if (res.exitCode === 0) return false;
  const blob = `${res.stderr}\n${res.finalText}`.toLowerCase();
  return (
    /rate.?limit|429|too many requests|overloaded|529|service unavailable|503|502|bad gateway|gateway timeout|504|econn(reset|refused|aborted)|etimedout|socket hang up|network|temporarily/.test(blob)
    || res.exitCode === 124
  );
}

export function isRateLimitFailure(res: { exitCode: number; stderr: string; finalText: string }): boolean {
  if (res.exitCode === 0) return false;
  const blob = `${res.stderr}\n${res.finalText}`.toLowerCase();
  return /rate.?limit|429|too many requests|session limit|usage limit|quota|insufficient_quota|temporarily capped|resets?\s+\d/.test(blob);
}

export function backoffDelay(attempt: number): number {
  const exp = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(exp + jitter, 30_000);
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}

export async function runSubAgent(
  ctx: RunContext,
  _plan: Plan,
  node: PlanNode,
  systemPromptExtra: string,
  userPrompt: string,
  opts: { allowEscalation?: boolean; timeoutMs?: number } = {}
): Promise<SubAgentResult> {
  const composed = composePrompt(node, systemPromptExtra, userPrompt, ctx.phaseNotes?.[node.phase], ctx.roleGuides?.[node.phase]);
  let modelId = node.modelId;
  const promptChars = composed.length;
  const attempted = new Set<string>();
  let lastFailure: SubAgentResult | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    attempted.add(modelId);
    const res = await runWithTransientRetry();

    const auditEvent = {
      kind: "cli_call",
      nodeId: node.id,
      agent: node.role,
      modelId,
      cli: modelId === "codex" ? "codex" : "claude",
      durationMs: res.durationMs,
      exitCode: res.exitCode,
      costUsd: res.costUsd,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      ok: res.ok,
    } as const;
    appendAudit(ctx.runId, auditEvent);
    ctx.onEvent?.(createRunEvent(ctx.runId, "cli_call", {
      nodeId: node.id,
      phase: node.phase,
      modelId,
      ok: res.ok,
      audit: {
        ts: new Date().toISOString(),
        runId: ctx.runId,
        ...auditEvent,
      },
    }));

    if (res.costUsd) ctx.estCostUsd += res.costUsd;

    if (res.ok) {
      return {
        ok: true,
        output: res.finalText,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
    }

    if (!opts.allowEscalation) {
      const fallback = await pickFallbackModel(modelId, node.phase, res, attempted, false);
      if (fallback) {
        announceFallback(ctx, node, modelId, fallback, fallbackReason(res));
        modelId = fallback;
        continue;
      }
      lastFailure = {
        ok: false,
        output: `Exit ${res.exitCode}. stderr: ${res.stderr.slice(-800)}`,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
      break;
    }
    const next = await pickFallbackModel(modelId, node.phase, res, attempted, true);
    if (!next) {
      const detail = [
        `Exit ${res.exitCode}. Exhausted fallback ladder at ${modelId}.`,
        res.stderr ? `stderr: ${res.stderr.slice(-800)}` : undefined,
        res.finalText ? `output: ${res.finalText.slice(-800)}` : undefined,
      ].filter((line): line is string => line !== undefined).join("\n");
      lastFailure = {
        ok: false,
        output: detail,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
      break;
    }
    announceFallback(ctx, node, modelId, next, fallbackReason(res));
    modelId = next;
  }

  const apiRes = await tryAnyApiFallback(modelId, attempted);
  if (apiRes) return apiRes;

  return lastFailure ?? { ok: false, output: "Escalation and API fallback failed", modelUsed: modelId, costUsd: 0, durationMs: 0 };

  async function runWithTransientRetry() {
    let last: Awaited<ReturnType<typeof runCli>> | undefined;
    for (let retry = 0; retry <= MAX_TRANSIENT_RETRIES; retry++) {
      if (retry > 0) {
        const delay = backoffDelay(retry - 1);
        console.log(chalk.yellow(`  ↻ transient failure on ${modelId}, retry ${retry}/${MAX_TRANSIENT_RETRIES} in ${Math.round(delay)}ms`));
        appendAudit(ctx.runId, {
          kind: "info",
          nodeId: node.id,
          message: `transient retry ${retry}/${MAX_TRANSIENT_RETRIES} on ${modelId} after ${delay}ms`,
        });
        await new Promise((r) => setTimeout(r, delay));
      }
      const retryLabel = retry > 0 ? `; retry ${retry}` : "";
      ctx.onEvent?.(createRunEvent(ctx.runId, "cli_output", {
        nodeId: node.id,
        phase: node.phase,
        modelId,
        line: `starting ${node.phase} with ${modelId} (${node.allowedTools.join(", ") || "no tools"}; prompt ${promptChars} chars${retryLabel})`,
      }));

      const phaseStarted = Date.now();
      let lastLineAt = phaseStarted;
      const heartbeat = setInterval(() => {
        const now = Date.now();
        if (now - lastLineAt < HEARTBEAT_INTERVAL_MS) return;
        const elapsed = formatElapsed(now - phaseStarted);
        const msg = `…still running ${node.phase} on ${modelId} (${elapsed} elapsed)`;
        process.stdout.write(chalk.dim(`    ${msg}\n`));
        ctx.onEvent?.(createRunEvent(ctx.runId, "cli_output", {
          nodeId: node.id,
          phase: node.phase,
          modelId,
          line: msg,
        }));
      }, HEARTBEAT_INTERVAL_MS).unref();

      try {
        last = await runCli({
          modelId,
          prompt: composed,
          cwd: ctx.targetDir,
          allowedTools: node.allowedTools,
          timeoutMs: opts.timeoutMs ?? 15 * 60_000,
          onLine: (line) => {
            lastLineAt = Date.now();
            if (line.startsWith("{") && line.length > 500) return;
            const visibleLine = line.slice(0, 240);
            appendAudit(ctx.runId, {
              kind: "cli_output",
              nodeId: node.id,
              agent: node.role,
              modelId,
              cli: modelId === "codex" ? "codex" : "claude",
              message: visibleLine,
            });
            ctx.onEvent?.(createRunEvent(ctx.runId, "cli_output", {
              nodeId: node.id,
              phase: node.phase,
              modelId,
              line: visibleLine,
            }));
            process.stdout.write(chalk.dim(`    ${visibleLine}\n`));
          },
        });
      } finally {
        clearInterval(heartbeat);
      }

      if (
        last.ok
        || isCapacityOrContextFailure(last)
        || !isTransientFailure({ exitCode: last.exitCode, stderr: last.stderr ?? "", finalText: last.finalText ?? "" })
      ) {
        return last;
      }
    }
    return last!;
  }

  async function tryAnyApiFallback(currentModel: string, attempted: Set<string>): Promise<SubAgentResult | null> {
    if ((node.allowedTools ?? []).length > 0) {
      appendAudit(ctx.runId, {
        kind: "info",
        nodeId: node.id,
        modelId: currentModel,
        message: "api fallback skipped because this phase requires local tools",
      });
      return null;
    }

    const candidates = [
      currentModel,
      ...rateLimitFallbacks(currentModel),
      ...["codex", "sonnet", "opus", "haiku"],
    ].filter((candidate, index, all) => all.indexOf(candidate) === index);
    const apiModel = candidates.find((candidate) => apiFallbackAvailable(candidate));
    if (!apiModel) return null;

    console.log(chalk.yellow(`  ↗ api-key fallback ${apiModel}`));
    appendAudit(ctx.runId, {
      kind: "info",
      nodeId: node.id,
      modelId: apiModel,
      message: `api-key fallback ${apiModel}; attempted cli models: ${Array.from(attempted).join(", ")}`,
    });
    const res = await runApiFallback({
      modelId: apiModel,
      prompt: composed,
      timeoutMs: opts.timeoutMs ?? 15 * 60_000,
    });
    appendAudit(ctx.runId, {
      kind: "cli_call",
      nodeId: node.id,
      agent: node.role,
      modelId: apiModel,
      durationMs: res.durationMs,
      exitCode: res.exitCode,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      ok: res.ok,
      message: "api-key fallback",
    });
    if (!res.ok) return null;
    return {
      ok: true,
      output: res.finalText,
      modelUsed: apiModel,
      costUsd: 0,
      durationMs: res.durationMs,
    };
  }
}

async function modelAvailable(modelId: string): Promise<boolean> {
  if (modelId === "codex") return (await checkCli("codex")).ok;
  if (modelId === "haiku" || modelId === "sonnet" || modelId === "opus") return (await checkCli("claude")).ok;
  return false;
}

async function pickFallbackModel(
  currentModel: string,
  phase: Phase,
  res: Awaited<ReturnType<typeof runCli>>,
  attempted: Set<string>,
  allowEscalation: boolean
): Promise<string | null> {
  if (isCapacityOrContextFailure(res)) {
    const providerFallbacks = unique([
      crossProviderFallback(currentModel, phase),
      ...rateLimitFallbacks(currentModel),
    ]);
    for (const candidate of providerFallbacks) {
      if (candidate && !attempted.has(candidate) && await modelAvailable(candidate)) return candidate;
    }
  }

  if (!allowEscalation) return null;
  const next = escalate(currentModel);
  if (next && !attempted.has(next) && await modelAvailable(next)) return next;

  if (isCapacityOrContextFailure(res)) {
    for (const candidate of rateLimitFallbacks(currentModel)) {
      if (!attempted.has(candidate) && await modelAvailable(candidate)) return candidate;
    }
  }

  return null;
}

function fallbackReason(res: Awaited<ReturnType<typeof runCli>>): string {
  return isCapacityOrContextFailure(res) ? "capacity/context limit" : "phase escalation";
}

function announceFallback(ctx: RunContext, node: PlanNode, from: string, to: string, reason: string): void {
  const symbol = reason === "capacity/context limit" ? "↔" : "↑";
  console.log(chalk.yellow(`  ${symbol} switching ${from} → ${to} (${reason})`));
  appendAudit(ctx.runId, {
    kind: "info",
    nodeId: node.id,
    modelId: from,
    message: `model fallback ${from} -> ${to} (${reason})`,
  });
  ctx.onEvent?.(createRunEvent(ctx.runId, "cli_output", {
    nodeId: node.id,
    phase: node.phase,
    modelId: to,
    line: `model fallback ${from} -> ${to} (${reason})`,
  }));
}

function unique<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((value, index, all): value is T => value != null && all.indexOf(value) === index);
}

function composePrompt(node: PlanNode, systemExtra: string, userPrompt: string, phaseNote?: string, roleGuides?: RoleGuide[]): string {
  return [
    `# Role: ${node.role}`,
    `# Phase: ${node.phase}`,
    `# Goal: ${node.goal}`,
    ``,
    systemExtra,
    formatRoleGuides(node.phase, roleGuides),
    phaseNote ? `\n# User guidance for this phase\n${phaseNote}` : undefined,
    ``,
    `# Task`,
    userPrompt,
    ``,
    `Work autonomously inside the current directory. Make reasonable decisions without asking questions. When complete, summarize what you did in 3-5 lines.`,
  ].filter((line): line is string => line !== undefined).join("\n");
}

function formatRoleGuides(phase: Phase, guides?: RoleGuide[]): string | undefined {
  if (!guides?.length) return undefined;
  const blocks = guides.map((guide) => [
    `## ${guide.name}`,
    "```markdown",
    guide.content,
    "```",
  ].join("\n"));
  return [
    "",
    "# Uploaded Role Guidance",
    `The user attached the following markdown role guide(s) for the ${phase} phase.`,
    "Use them as supplemental role behavior and output-format guidance. If they conflict with Forge's current task, target directory, or instruction to work autonomously, Forge's current task wins.",
    blocks.join("\n\n"),
  ].join("\n");
}
