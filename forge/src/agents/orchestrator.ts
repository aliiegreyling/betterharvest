import { Classification, Plan, PlanNode, RunContext } from "../types.js";
import { annotateRouting } from "./router.js";

export function buildPlan(
  prompt: string,
  classification: Classification,
  ctx: RunContext
): Plan {
  const phaseBudgets = allocateBudget(ctx.budgetUsd, classification);

  const nodes: PlanNode[] = [
    {
      id: "n_brief",
      phase: "brief",
      role: "Product Manager",
      modelId: "",
      goal: "Write a concise brief: problem, user, scope, non-goals, success criteria.",
      inputs: [],
      budgetUsd: phaseBudgets.brief,
      tools: ["write_file"],
    },
    {
      id: "n_arch",
      phase: "arch",
      role: "Architect",
      modelId: "",
      goal: "Define stack, components, file layout, key interfaces. Output an architecture doc.",
      inputs: ["n_brief"],
      budgetUsd: phaseBudgets.arch,
      tools: ["write_file", "read_file"],
    },
    {
      id: "n_stories",
      phase: "stories",
      role: "Story Decomposer",
      modelId: "",
      goal: "Decompose architecture into an ordered story list. Each story is a small, verifiable code change.",
      inputs: ["n_arch"],
      budgetUsd: phaseBudgets.stories,
      tools: ["write_file", "read_file"],
    },
    {
      id: "n_impl",
      phase: "impl",
      role: "Developer",
      modelId: "",
      goal: "Implement all stories. Create source files, config, and a runnable smoke test. The project must run end-to-end.",
      inputs: ["n_stories"],
      budgetUsd: phaseBudgets.impl,
      tools: ["read_file", "write_file", "edit_file", "list_files", "shell"],
    },
    {
      id: "n_verify",
      phase: "verify",
      role: "Verifier",
      modelId: "",
      goal: "Run the smoke test or main entry point. Report whether the project executes successfully.",
      inputs: ["n_impl"],
      budgetUsd: phaseBudgets.verify,
      tools: ["read_file", "list_files", "shell"],
    },
    {
      id: "n_review",
      phase: "review",
      role: "Reviewer",
      modelId: "",
      goal: "Final pass: ensure a README exists with run instructions; flag obvious gaps.",
      inputs: ["n_verify"],
      budgetUsd: phaseBudgets.review,
      tools: ["read_file", "write_file", "edit_file", "list_files"],
    },
  ];

  return {
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    prompt,
    classification,
    nodes: annotateRouting(nodes, classification),
    totalBudgetUsd: ctx.budgetUsd,
  };
}

function allocateBudget(total: number, c: Classification): Record<string, number> {
  const weights: Record<string, number> = {
    brief: 0.05,
    arch: 0.15,
    stories: 0.08,
    impl: 0.55,
    verify: 0.10,
    review: 0.07,
  };
  if (c.complexity === "XL") {
    weights.arch = 0.20;
    weights.impl = 0.50;
  }
  const out: Record<string, number> = {};
  for (const [k, w] of Object.entries(weights)) out[k] = +(total * w).toFixed(4);
  return out;
}
