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

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await runCli({
      modelId,
      prompt: composed,
      cwd: ctx.targetDir,
      allowedTools: node.allowedTools,
      timeoutMs: opts.timeoutMs ?? 15 * 60_000,
      onLine: (line) => {
        if (line.startsWith("{") && line.length > 500) return;
        const visibleLine = line.slice(0, 240);
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
      return {
        ok: false,
        output: `Exhausted escalation ladder at ${modelId}`,
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
