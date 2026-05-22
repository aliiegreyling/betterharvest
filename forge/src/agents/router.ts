import type { Classification, CliResult, Phase, PlanNode } from "../types.js";
import { getModel } from "../models/registry.js";

export function pickModel(phase: Phase, c: Classification): string {
  const defaults: Record<Phase, string> = {
    classify: "haiku",
    ba: "sonnet",
    tech_arch: "opus",
    ux_design: "sonnet",
    arch_synthesis: "opus",
    stories: "sonnet",
    dev: "sonnet",
    qa: "sonnet",
    infra: "sonnet",
    review: "sonnet",
  };

  let model = defaults[phase];

  if (c.complexity === "XL" && phase === "dev") model = "opus";
  if (c.ambiguityScore > 0.7 && (phase === "ba" || phase === "ux_design")) model = "opus";
  if (c.complexity === "S" && (phase === "ba" || phase === "stories")) model = "haiku";
  if ((c.complexity === "L" || c.complexity === "XL") && phase === "infra") model = "opus";

  return model;
}

export function escalate(currentModel: string): string | null {
  if (currentModel === "codex") return "sonnet";
  const ladder = ["haiku", "sonnet", "opus"];
  const i = ladder.indexOf(currentModel);
  if (i === -1 || i === ladder.length - 1) return null;
  return ladder[i + 1];
}

export function crossProviderFallback(currentModel: string, phase?: Phase): string | null {
  const current = getModel(currentModel);
  if (current.cli === "codex") return phase === "tech_arch" || phase === "arch_synthesis" ? "opus" : "sonnet";
  return "codex";
}

export function isCapacityOrContextFailure(res: CliResult): boolean {
  const text = `${res.stderr}\n${res.stdout}\n${res.finalText}`.toLowerCase();
  return [
    "rate limit",
    "usage limit",
    "quota",
    "insufficient_quota",
    "credit balance",
    "billing",
    "too many requests",
    "429",
    "token limit",
    "tokens limit",
    "context length",
    "context window",
    "maximum context",
    "max context",
    "prompt is too long",
    "conversation is too long",
    "session limit",
    "session has expired",
    "temporarily capped",
    "resets",
    "ran out of tokens",
    "exceeded your current quota",
    "exceeded the model",
  ].some((pattern) => text.includes(pattern));
}

export function rateLimitFallbacks(currentModel: string): string[] {
  switch (currentModel) {
    case "haiku":
      return ["codex", "sonnet", "opus"];
    case "sonnet":
      return ["codex", "opus", "haiku"];
    case "opus":
      return ["codex", "sonnet", "haiku"];
    case "codex":
      return ["sonnet", "opus", "haiku"];
    default:
      return ["sonnet", "codex", "opus", "haiku"];
  }
}

export function annotateRouting(nodes: PlanNode[], c: Classification, override?: string): PlanNode[] {
  return nodes.map((n) => ({
    ...n,
    modelId: override && n.phase !== "qa" ? override : pickModel(n.phase, c),
  }));
}
