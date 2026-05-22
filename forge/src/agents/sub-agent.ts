import chalk from "chalk";
import { appendAudit } from "../run/state.js";
import type { Phase, Plan, PlanNode, RoleGuide, RunContext } from "../types.js";
import { runCli } from "./cli-runner.js";
import { crossProviderFallback, escalate, isCapacityOrContextFailure } from "./router.js";
import { createRunEvent } from "../runtime/events.js";

export interface SubAgentResult {
  ok: boolean;
  output: string;
  modelUsed: string;
  costUsd: number;
  durationMs: number;
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

  for (let attempt = 0; attempt < 4; attempt++) {
    attempted.add(modelId);
    ctx.onEvent?.(createRunEvent(ctx.runId, "cli_output", {
      nodeId: node.id,
      phase: node.phase,
      modelId,
      line: `starting ${node.phase} with ${modelId} (${node.allowedTools.join(", ") || "no tools"}; prompt ${promptChars} chars)`,
    }));
    const res = await runCli({
      modelId,
      prompt: composed,
      cwd: ctx.targetDir,
      allowedTools: node.allowedTools,
      timeoutMs: opts.timeoutMs ?? 15 * 60_000,
      onLine: (line) => {
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
      const fallback = pickFallbackModel(modelId, node.phase, res, attempted, false);
      if (fallback) {
        announceFallback(ctx, node, modelId, fallback, fallbackReason(res));
        modelId = fallback;
        continue;
      }
      return {
        ok: false,
        output: `Exit ${res.exitCode}. stderr: ${res.stderr.slice(-800)}`,
        modelUsed: modelId,
        costUsd: res.costUsd ?? 0,
        durationMs: res.durationMs,
      };
    }
    const next = pickFallbackModel(modelId, node.phase, res, attempted, true);
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
    announceFallback(ctx, node, modelId, next, fallbackReason(res));
    modelId = next;
  }

  return { ok: false, output: "Escalation failed", modelUsed: modelId, costUsd: 0, durationMs: 0 };
}

function pickFallbackModel(
  currentModel: string,
  phase: Phase,
  res: Awaited<ReturnType<typeof runCli>>,
  attempted: Set<string>,
  allowEscalation: boolean
): string | null {
  if (isCapacityOrContextFailure(res)) {
    const providerFallback = crossProviderFallback(currentModel, phase);
    if (providerFallback && !attempted.has(providerFallback)) return providerFallback;
  }

  if (!allowEscalation) return null;
  const next = escalate(currentModel);
  if (next && !attempted.has(next)) return next;

  if (isCapacityOrContextFailure(res)) {
    const providerFallback = crossProviderFallback(currentModel, phase);
    if (providerFallback && !attempted.has(providerFallback)) return providerFallback;
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
