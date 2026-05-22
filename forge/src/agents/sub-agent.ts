import chalk from "chalk";
import { appendAudit } from "../run/state.js";
import { Plan, PlanNode, RunContext } from "../types.js";
import { runCli } from "./cli-runner.js";
import { escalate } from "./router.js";
import { createRunEvent } from "../runtime/events.js";

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

function isTransientFailure(res: { exitCode: number; stderr: string; finalText: string }): boolean {
  if (res.exitCode === 0) return false;
  const blob = `${res.stderr}\n${res.finalText}`.toLowerCase();
  return (
    /rate.?limit|429|too many requests|overloaded|529|service unavailable|503|502|bad gateway|gateway timeout|504|econn(reset|refused|aborted)|etimedout|socket hang up|network|temporarily/.test(blob)
    || res.exitCode === 124
  );
}

function backoffDelay(attempt: number): number {
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
  const composed = composePrompt(node, systemPromptExtra, userPrompt, ctx.phaseNotes?.[node.phase]);
  let modelId = node.modelId;
  const promptChars = composed.length;

  for (let attempt = 0; attempt < 2; attempt++) {
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
      return {
        ok: false,
        output: `Exit ${res.exitCode}. stderr: ${res.stderr.slice(-800)}`,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
    }
    const next = escalate(modelId);
    if (!next) {
      const detail = [
        `Exit ${res.exitCode}. Exhausted escalation ladder at ${modelId}.`,
        res.stderr ? `stderr: ${res.stderr.slice(-800)}` : undefined,
        res.finalText ? `output: ${res.finalText.slice(-800)}` : undefined,
      ].filter((line): line is string => line !== undefined).join("\n");
      return {
        ok: false,
        output: detail,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
    }
    console.log(chalk.yellow(`  ↑ escalating ${modelId} → ${next}`));
    appendAudit(ctx.runId, {
      kind: "info",
      nodeId: node.id,
      message: `escalation ${modelId} -> ${next}`,
    });
    modelId = next;
  }

  return { ok: false, output: "Escalation failed", modelUsed: modelId, costUsd: 0, durationMs: 0 };

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

      if (last.ok || !isTransientFailure({ exitCode: last.exitCode, stderr: last.stderr ?? "", finalText: last.finalText ?? "" })) {
        return last;
      }
    }
    return last!;
  }
}

function composePrompt(node: PlanNode, systemExtra: string, userPrompt: string, phaseNote?: string): string {
  return [
    `# Role: ${node.role}`,
    `# Phase: ${node.phase}`,
    `# Goal: ${node.goal}`,
    ``,
    systemExtra,
    phaseNote ? `\n# User guidance for this phase\n${phaseNote}` : undefined,
    ``,
    `# Task`,
    userPrompt,
    ``,
    `Work autonomously inside the current directory. Make reasonable decisions without asking questions. When complete, summarize what you did in 3-5 lines.`,
  ].filter((line): line is string => line !== undefined).join("\n");
}
