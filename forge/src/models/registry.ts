import { ModelMeta } from "../types.js";

export const MODELS: ModelMeta[] = [
  {
    id: "haiku",
    cli: "claude",
    cliModelFlag: "haiku",
    strengths: ["classification", "coding"],
    latencyClass: "fast",
    notes: "Fast tier — classification, trivial edits, summarization.",
  },
  {
    id: "sonnet",
    cli: "claude",
    cliModelFlag: "sonnet",
    strengths: ["coding", "planning", "review"],
    latencyClass: "medium",
    notes: "Default coding tier.",
  },
  {
    id: "opus",
    cli: "claude",
    cliModelFlag: "opus",
    strengths: ["reasoning", "planning", "coding", "long-context"],
    latencyClass: "slow",
    notes: "Top tier — architecture, ambiguous specs, hard debugging.",
  },
  {
    id: "codex",
    cli: "codex",
    cliModelFlag: "gpt-5-codex",
    strengths: ["coding"],
    latencyClass: "medium",
    notes: "OpenAI Codex CLI — alternative coding voice for specialist nodes.",
  },
];

export function getModel(id: string): ModelMeta {
  const m = MODELS.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown model id: ${id}. Available models: ${formatModelIdList()}`);
  return m;
}

export function listModelIds(): string[] {
  return MODELS.map((m) => m.id);
}

export function formatModelIdList(separator = ", "): string {
  return listModelIds().join(separator);
}
