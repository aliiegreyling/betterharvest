import { appendAudit } from "../run/state.js";
import type { Classification, RunContext } from "../types.js";
import { runCli } from "./cli-runner.js";
import { crossProviderFallback, isCapacityOrContextFailure } from "./router.js";

const INSTRUCTION = `You are a project classifier. Read the user's project prompt and output ONLY a JSON object on stdout matching this exact schema, with no prose, no markdown:
{
  "projectType": string,
  "complexity": "S" | "M" | "L" | "XL",
  "estFiles": number,
  "requiresUi": boolean,
  "stackHint": string,
  "ambiguityScore": number,
  "summary": string
}
Complexity guide: S = <50 lines single file. M = 2-10 files small app. L = 10-30 files framework + persistence. XL = 30+ files multi-service.
ambiguityScore is 0.0 (crystal clear) to 1.0 (heavily underspecified).
Output the JSON only.`;

export async function classify(prompt: string, ctx: RunContext): Promise<Classification> {
  const fullPrompt = `${INSTRUCTION}\n\nUSER PROMPT:\n"""${prompt}"""`;
  let modelId = "haiku";
  let res = await runClassifierCli(modelId, fullPrompt, ctx);
  if (!res.ok && isCapacityOrContextFailure(res)) {
    const fallback = crossProviderFallback(modelId, "classify");
    if (fallback) {
      appendAudit(ctx.runId, {
        kind: "info",
        agent: "classifier",
        modelId,
        message: `model fallback ${modelId} -> ${fallback} (capacity/context limit)`,
      });
      modelId = fallback;
      res = await runClassifierCli(modelId, fullPrompt, ctx);
    }
  }

  appendAudit(ctx.runId, {
    kind: "cli_call",
    agent: "classifier",
    modelId,
    cli: modelId === "codex" ? "codex" : "claude",
    durationMs: res.durationMs,
    exitCode: res.exitCode,
    costUsd: res.costUsd,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    ok: res.ok,
  });

  if (!res.ok) {
    throw new Error(
      `Classifier CLI failed (exit ${res.exitCode}): ${res.stderr.slice(-500)}`
    );
  }
  if (res.costUsd) ctx.estCostUsd += res.costUsd;

  return extractJson(res.finalText) as Classification;
}

function runClassifierCli(modelId: string, prompt: string, ctx: RunContext) {
  return runCli({
    modelId,
    prompt,
    cwd: ctx.runDir,
    allowedTools: [],
    timeoutMs: 90_000,
  });
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON found in classifier output: ${text.slice(0, 300)}`);
  return JSON.parse(candidate.slice(start, end + 1));
}
