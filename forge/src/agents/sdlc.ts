import { runSubAgent, SubAgentResult } from "./sub-agent.js";
import { Plan, PlanNode, RunContext } from "../types.js";

function nodeOf(plan: Plan, phase: PlanNode["phase"]): PlanNode {
  const n = plan.nodes.find((n) => n.phase === phase);
  if (!n) throw new Error(`No node for phase ${phase}`);
  return n;
}

export async function runBrief(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "brief");
  return runSubAgent(
    ctx, plan, node,
    "Create a file at docs/BRIEF.md. Keep it under 200 lines. Sections: Problem, Target user, Scope, Non-goals, Success criteria.",
    `User prompt: """${plan.prompt}"""\n\nClassification metadata: ${JSON.stringify(plan.classification)}\n\nWrite docs/BRIEF.md now.`
  );
}

export async function runArch(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "arch");
  return runSubAgent(
    ctx, plan, node,
    "Read docs/BRIEF.md, then write docs/ARCHITECTURE.md. Be specific about: chosen stack and versions, exact file/folder layout, key modules and their responsibilities, data model (if any), entry point command, how to install and run.",
    "Build the architecture doc for the project described in docs/BRIEF.md."
  );
}

export async function runStories(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "stories");
  return runSubAgent(
    ctx, plan, node,
    "Read docs/BRIEF.md and docs/ARCHITECTURE.md, then write docs/STORIES.md as a numbered list. Each story states: files to create/modify, what to put in them, and how to verify.",
    "Decompose the architecture into stories and write docs/STORIES.md."
  );
}

export async function runImpl(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "impl");
  return runSubAgent(
    ctx, plan, node,
    "Implement every story in docs/STORIES.md. Create all source files. Install dependencies via shell (npm / pip) only if necessary; prefer the stdlib. The project MUST run end-to-end via a single command. Include a smoke test or main entry point that exits 0 on success. Run it to confirm before finishing.",
    "Implement the project per docs/STORIES.md and verify it runs.",
    { allowEscalation: true, timeoutMs: 30 * 60_000 }
  );
}

export async function runVerify(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "verify");
  return runSubAgent(
    ctx, plan, node,
    "Independently verify the project runs. Use Glob/Grep to discover the entry point, then run it via Bash. Do NOT modify source code. Report exit status and any errors in your final summary.",
    "Verify the implementation runs end-to-end. Do not modify code."
  );
}

export async function runReview(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "review");
  return runSubAgent(
    ctx, plan, node,
    "Ensure README.md exists at the project root with: one-line description, install steps, run command, brief usage example. Create or update it. Do NOT change source code.",
    "Finalize the project README."
  );
}
