import chalk from "chalk";
import { callModel } from "../models/client.js";
import { appendAudit } from "../run/state.js";
import { executeTool, TOOL_SCHEMAS, ToolEnv } from "../tools/index.js";
import { Plan, PlanNode, RunContext, ToolName, ToolSchema } from "../types.js";
import { escalate } from "./router.js";

export interface SubAgentResult {
  ok: boolean;
  output: string;
  modelUsed: string;
  costUsd: number;
  steps: number;
}

const MAX_STEPS = 30;

export async function runSubAgent(
  ctx: RunContext,
  plan: Plan,
  node: PlanNode,
  systemPromptExtra: string,
  userPrompt: string,
  opts: { allowEscalation?: boolean } = {}
): Promise<SubAgentResult> {
  const allowedTools: ToolName[] = node.tools;
  const tools: ToolSchema[] = TOOL_SCHEMAS.filter((t) =>
    allowedTools.includes(t.name as ToolName)
  );
  const env: ToolEnv = { targetDir: ctx.targetDir };

  const system = [
    `You are the ${node.role} sub-agent in an autonomous build system.`,
    `Phase: ${node.phase}. Goal: ${node.goal}`,
    `Project root is the current working directory. All file paths must be relative to it.`,
    `Use the available tools to read context, write code, and (if shell is available) run commands.`,
    `When you are completely done with this phase, output the literal token <PHASE_DONE> on its own line and stop.`,
    `Do not ask the user questions; make reasonable decisions and proceed.`,
    systemPromptExtra,
  ].join("\n\n");

  let modelId = node.modelId;
  let attempt = 0;

  while (attempt < 2) {
    const result = await runLoop({ ctx, plan, node, system, userPrompt, tools, env, modelId });
    if (result.ok) return { ...result, modelUsed: modelId };

    if (!opts.allowEscalation) return { ...result, modelUsed: modelId };
    const next = escalate(modelId);
    if (!next) return { ...result, modelUsed: modelId };
    console.log(chalk.yellow(`  ↑ escalating ${modelId} → ${next} (attempt ${attempt + 2})`));
    appendAudit(ctx.runId, {
      kind: "info",
      nodeId: node.id,
      message: `escalation ${modelId} -> ${next}`,
    });
    modelId = next;
    attempt++;
  }
  return { ok: false, output: "Exhausted escalation ladder", modelUsed: modelId, costUsd: 0, steps: 0 };
}

interface LoopArgs {
  ctx: RunContext;
  plan: Plan;
  node: PlanNode;
  system: string;
  userPrompt: string;
  tools: ToolSchema[];
  env: ToolEnv;
  modelId: string;
}

async function runLoop(args: LoopArgs): Promise<SubAgentResult> {
  const { ctx, node, system, userPrompt, tools, env, modelId } = args;
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: userPrompt },
  ];
  let totalCost = 0;
  let steps = 0;
  let lastText = "";

  while (steps < MAX_STEPS) {
    steps++;
    const res = await callModel(modelId, {
      system,
      messages,
      tools,
      temperature: 0.2,
      maxTokens: 4096,
    });
    totalCost += res.costUsd;
    ctx.spentUsd += res.costUsd;

    appendAudit(ctx.runId, {
      kind: "model_call",
      nodeId: node.id,
      agent: node.role,
      modelId,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });

    if (res.text) lastText = res.text;

    if (res.toolUses.length === 0) {
      const done = res.text.includes("<PHASE_DONE>") || res.stopReason === "end_turn";
      return { ok: done, output: lastText, modelUsed: modelId, costUsd: totalCost, steps };
    }

    // Append assistant turn (text + tool_use blocks) — we serialize as a single string for the simplified message loop.
    // Then build a follow-up user message with tool_result blocks. To stay compatible with the SDK's content-block model,
    // we re-issue as a fresh user message describing the results; this is acceptable since temperature is low and the
    // model has enough context from system + history. (A full tool_use/tool_result round-trip is a future enhancement.)
    const assistantSummary =
      (res.text ? res.text + "\n" : "") +
      res.toolUses
        .map((tu) => `[tool_use ${tu.name}] ${JSON.stringify(tu.input).slice(0, 4000)}`)
        .join("\n");
    messages.push({ role: "assistant", content: assistantSummary });

    const results: string[] = [];
    for (const tu of res.toolUses) {
      const r = executeTool(env, tu.name, tu.input);
      appendAudit(ctx.runId, {
        kind: "tool_call",
        nodeId: node.id,
        agent: node.role,
        tool: tu.name,
        ok: r.ok,
      });
      results.push(`[tool_result ${tu.name} ok=${r.ok}]\n${r.result.slice(0, 6000)}`);
    }
    messages.push({ role: "user", content: results.join("\n\n") });

    if (ctx.spentUsd > ctx.budgetUsd) {
      return {
        ok: false,
        output: `Budget exhausted ($${ctx.spentUsd.toFixed(3)} > $${ctx.budgetUsd})`,
        modelUsed: modelId,
        costUsd: totalCost,
        steps,
      };
    }
  }
  return { ok: false, output: "Max steps reached", modelUsed: modelId, costUsd: totalCost, steps };
}
