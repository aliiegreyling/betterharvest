import { callModel } from "../models/client.js";
import { appendAudit } from "../run/state.js";
import { Classification, RunContext } from "../types.js";

const SYSTEM = `You classify software project prompts into structured metadata for an agentic build system.
Output ONLY valid JSON matching this schema, no prose:
{
  "projectType": string,
  "complexity": "S" | "M" | "L" | "XL",
  "estFiles": number,
  "requiresUi": boolean,
  "stackHint": string,
  "ambiguityScore": number,
  "summary": string
}
Complexity guide:
- S: single file, <50 lines, no deps
- M: 2-10 files, light deps (CRUD CLI, small script)
- L: 10-30 files, framework, persistence
- XL: 30+ files, multi-service, complex domain
ambiguityScore: 0.0 (crystal clear) to 1.0 (heavily underspecified).`;

export async function classify(prompt: string, ctx: RunContext): Promise<Classification> {
  const res = await callModel("haiku", {
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    maxTokens: 800,
  });

  appendAudit(ctx.runId, {
    kind: "model_call",
    agent: "classifier",
    modelId: "haiku",
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    costUsd: res.costUsd,
  });

  const json = extractJson(res.text);
  return json as Classification;
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}
