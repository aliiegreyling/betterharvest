import Anthropic from "@anthropic-ai/sdk";
import { CompletionRequest, CompletionResponse, ModelMeta } from "../types.js";
import { getModel } from "./registry.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callModel(
  modelId: string,
  req: CompletionRequest
): Promise<CompletionResponse> {
  const model = getModel(modelId);
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const res = await client.messages.create({
    model: model.apiId,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.2,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    tools: req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    })),
  });

  let text = "";
  const toolUses: CompletionResponse["toolUses"] = [];
  for (const block of res.content) {
    if (block.type === "text") text += block.text;
    if (block.type === "tool_use") {
      toolUses.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  const costUsd = computeCost(model, tokensIn, tokensOut);

  return {
    text,
    toolUses,
    stopReason: res.stop_reason ?? "end_turn",
    tokensIn,
    tokensOut,
    costUsd,
  };
}

export function computeCost(model: ModelMeta, tokensIn: number, tokensOut: number): number {
  return (tokensIn * model.costPer1MIn + tokensOut * model.costPer1MOut) / 1_000_000;
}
