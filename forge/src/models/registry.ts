import { ModelMeta } from "../types.js";

export const MODELS: ModelMeta[] = [
  {
    id: "haiku",
    provider: "anthropic",
    apiId: "claude-haiku-4-5-20251001",
    contextWindow: 200_000,
    costPer1MIn: 1.0,
    costPer1MOut: 5.0,
    strengths: ["classification", "coding"],
    latencyClass: "fast",
  },
  {
    id: "sonnet",
    provider: "anthropic",
    apiId: "claude-sonnet-4-6",
    contextWindow: 200_000,
    costPer1MIn: 3.0,
    costPer1MOut: 15.0,
    strengths: ["coding", "planning", "review"],
    latencyClass: "medium",
  },
  {
    id: "opus",
    provider: "anthropic",
    apiId: "claude-opus-4-7",
    contextWindow: 200_000,
    costPer1MIn: 15.0,
    costPer1MOut: 75.0,
    strengths: ["reasoning", "planning", "coding", "long-context"],
    latencyClass: "slow",
  },
];

export function getModel(id: string): ModelMeta {
  const m = MODELS.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown model id: ${id}`);
  return m;
}
