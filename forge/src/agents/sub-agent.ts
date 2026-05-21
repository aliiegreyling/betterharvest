import chalk from "chalk";
import { appendAudit } from "../run/state.js";
import { Plan, PlanNode, RunContext } from "../types.js";
import { runCli } from "./cli-runner.js";
import { escalate } from "./router.js";

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
  const composed = composePrompt(node, systemPromptExtra, userPrompt);
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
        process.stdout.write(chalk.dim(`    ${line.slice(0, 240)}\n`));
      },
    });

    appendAudit(ctx.runId, {
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
    });

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

function composePrompt(node: PlanNode, systemExtra: string, userPrompt: string): string {
  return [
    `# Role: ${node.role}`,
    `# Phase: ${node.phase}`,
    `# Goal: ${node.goal}`,
    ``,
    systemExtra,
    ``,
    `# Task`,
    userPrompt,
    ``,
    `Work autonomously inside the current directory. Make reasonable decisions without asking questions. When complete, summarize what you did in 3-5 lines.`,
  ].join("\n");
}
