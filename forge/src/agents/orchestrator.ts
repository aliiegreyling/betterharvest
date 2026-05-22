import { Classification, Plan, PlanNode, RunContext } from "../types.js";
import { annotateRouting } from "./router.js";

export interface PlanOverrides {
  coder?: string; // override the dev phase to a specific model id
}

const DOC_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const CODE_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
const INFRA_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];

export function buildPlan(
  prompt: string,
  classification: Classification,
  ctx: RunContext,
  overrides: PlanOverrides = {}
): Plan {
  const nodes: PlanNode[] = [
    {
      id: "n_ba",
      phase: "ba",
      role: "Business Analyst",
      modelId: "",
      goal: "Gather requirements and write a sign-off-ready PRD or BRD.",
      inputs: [],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["docs/PRD.md or docs/BRD.md"],
      approvalGate: {
        id: "ba-signoff",
        label: "BA requirements sign-off",
        approverRole: "Business Analyst",
        maxRevisionCycles: 3,
      },
    },
    {
      id: "n_tech_arch",
      phase: "tech_arch",
      role: "Technical Design Architect",
      modelId: "",
      goal: "Define the technical design, system boundaries, data model, and integration approach.",
      inputs: ["n_ba"],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["docs/TDD.md"],
    },
    {
      id: "n_ux_design",
      phase: "ux_design",
      role: "UI/UX Designer",
      modelId: "",
      goal: "Define the UI/UX approach and design system for the requested system.",
      inputs: ["n_ba"],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["docs/DESIGN_SYSTEM.md"],
    },
    {
      id: "n_arch_synthesis",
      phase: "arch_synthesis",
      role: "Architecture Lead",
      modelId: "",
      goal: "Synthesize technical and UX design into a final TDD with Mermaid diagrams.",
      inputs: ["n_tech_arch", "n_ux_design"],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["docs/TDD.md", "docs/DESIGN_SYSTEM.md"],
      approvalGate: {
        id: "architecture-signoff",
        label: "Architecture and UX sign-off",
        approverRole: "Architect",
        maxRevisionCycles: 3,
      },
    },
    {
      id: "n_stories",
      phase: "stories",
      role: "Story Decomposer",
      modelId: "",
      goal: "Decompose signed-off requirements and design into ordered, verifiable stories.",
      inputs: ["n_arch_synthesis"],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["docs/STORIES.md"],
    },
    {
      id: "n_dev",
      phase: "dev",
      role: "Developer",
      modelId: "",
      goal: "Implement all signed-off stories with a runnable local project.",
      inputs: ["n_stories"],
      allowedTools: CODE_TOOLS,
    },
    {
      id: "n_qa",
      phase: "qa",
      role: "QA Automation Engineer",
      modelId: "",
      goal: "Create test cases and implement happy-path and negative-flow automated tests.",
      inputs: ["n_dev"],
      allowedTools: CODE_TOOLS,
      expectedArtifacts: ["docs/TEST_CASES.md"],
      approvalGate: {
        id: "qa-signoff",
        label: "QA test sign-off",
        approverRole: "QA or Automation Tester",
        maxRevisionCycles: 3,
      },
    },
    {
      id: "n_infra",
      phase: "infra",
      role: "Infrastructure Engineer",
      modelId: "",
      goal: "Define and create local-first runtime infrastructure using Aspire or Docker Compose when appropriate.",
      inputs: ["n_qa"],
      allowedTools: INFRA_TOOLS,
      expectedArtifacts: ["docs/INFRA.md"],
      approvalGate: {
        id: "infra-signoff",
        label: "Local infrastructure sign-off",
        approverRole: "Infrastructure Owner",
        maxRevisionCycles: 3,
      },
    },
    {
      id: "n_review",
      phase: "review",
      role: "Release Reviewer",
      modelId: "",
      goal: "Finalize README and summarize implementation, tests, local runtime, and remaining gaps.",
      inputs: ["n_infra"],
      allowedTools: DOC_TOOLS,
      expectedArtifacts: ["README.md"],
    },
  ];

  const routed = annotateRouting(nodes, classification, ctx.modelOverride);
  if (overrides.coder) {
    for (const n of routed) if (n.phase === "dev") n.modelId = overrides.coder;
  }

  return {
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    mode: ctx.mode,
    prompt,
    targetDir: ctx.targetDir,
    classification,
    nodes: routed,
    contextBudget: ctx.contextBudget,
    modelOverride: ctx.modelOverride,
    projectContext: ctx.projectContext,
  };
}
