import { Classification, Phase, PlanNode } from "../types.js";

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

export function annotateRouting(nodes: PlanNode[], c: Classification, override?: string): PlanNode[] {
  return nodes.map((n) => ({
    ...n,
    modelId: override && n.phase !== "qa" ? override : pickModel(n.phase, c),
  }));
}
