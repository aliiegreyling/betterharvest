import { Classification, Plan, PlanNode, RunContext } from "../types.js";
import { annotateRouting } from "./router.js";

export interface PlanOverrides {
  coder?: string; // override the impl phase to a specific model id
}

const DOC_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const CODE_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
const RUN_TOOLS = ["Read", "Glob", "Grep", "Bash"];

export function buildPlan(
  prompt: string,
  classification: Classification,
  ctx: RunContext,
  overrides: PlanOverrides = {}
): Plan {
  const nodes: PlanNode[] = [
    {
      id: "n_brief",
      phase: "brief",
      role: "Product Manager",
      modelId: "",
      goal: "Write a concise brief: problem, user, scope, non-goals, success criteria.",
      inputs: [],
      allowedTools: DOC_TOOLS,
    },
    {
      id: "n_arch",
      phase: "arch",
      role: "Architect",
      modelId: "",
      goal: "Define stack, components, file layout, key interfaces. Output architecture doc.",
      inputs: ["n_brief"],
      allowedTools: DOC_TOOLS,
    },
    {
      id: "n_stories",
      phase: "stories",
      role: "Story Decomposer",
      modelId: "",
      goal: "Decompose architecture into an ordered story list of small, verifiable changes.",
      inputs: ["n_arch"],
      allowedTools: DOC_TOOLS,
    },
    {
      id: "n_impl",
      phase: "impl",
      role: "Developer",
      modelId: "",
      goal: "Implement all stories. The project must be runnable end-to-end with a smoke test.",
      inputs: ["n_stories"],
      allowedTools: CODE_TOOLS,
    },
    {
      id: "n_verify",
      phase: "verify",
      role: "Verifier",
      modelId: "",
      goal: "Independently run the project / smoke test. Report exit status without modifying code.",
      inputs: ["n_impl"],
      allowedTools: RUN_TOOLS,
    },
    {
      id: "n_review",
      phase: "review",
      role: "Reviewer",
      modelId: "",
      goal: "Ensure README.md exists with run instructions. Flag obvious gaps.",
      inputs: ["n_verify"],
      allowedTools: DOC_TOOLS,
    },
  ];

  const routed = annotateRouting(nodes, classification, ctx.modelOverride);
  if (overrides.coder) {
    for (const n of routed) if (n.phase === "impl") n.modelId = overrides.coder;
  }

  return {
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    prompt,
    classification,
    nodes: routed,
    contextBudget: ctx.contextBudget,
    modelOverride: ctx.modelOverride,
    projectContext: ctx.projectContext,
  };
}
