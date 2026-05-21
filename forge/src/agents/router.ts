import { Classification, Phase, PlanNode } from "../types.js";

export function pickModel(phase: Phase, c: Classification): string {
  const defaults: Record<Phase, string> = {
    classify: "haiku",
    brief: "sonnet",
    arch: "opus",
    stories: "sonnet",
    impl: "sonnet",
    verify: "sonnet",
    review: "sonnet",
  };

  let model = defaults[phase];

  if (c.complexity === "XL" && phase === "impl") model = "opus";
  if (c.ambiguityScore > 0.7 && (phase === "brief" || phase === "arch")) model = "opus";
  if (c.complexity === "S" && (phase === "brief" || phase === "stories")) model = "haiku";

  return model;
}

export function escalate(currentModel: string): string | null {
  const ladder = ["haiku", "sonnet", "opus"];
  const i = ladder.indexOf(currentModel);
  if (i === -1 || i === ladder.length - 1) return null;
  return ladder[i + 1];
}

export function annotateRouting(nodes: PlanNode[], c: Classification): PlanNode[] {
  return nodes.map((n) => ({ ...n, modelId: pickModel(n.phase, c) }));
}
