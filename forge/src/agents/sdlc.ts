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
    `Write a brief product document to docs/BRIEF.md. Keep it under 200 lines.`,
    `User prompt: """${plan.prompt}"""\n\nClassification: ${JSON.stringify(plan.classification)}\n\nWrite docs/BRIEF.md, then emit <PHASE_DONE>.`
  );
}

export async function runArch(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "arch");
  return runSubAgent(
    ctx, plan, node,
    `Read docs/BRIEF.md then write docs/ARCHITECTURE.md. Include: chosen stack, file/folder layout, key modules, data model (if any), entry point, how to run.`,
    `Build the architecture for the project described in docs/BRIEF.md. Be specific about file names and directory structure so the developer can implement directly. Emit <PHASE_DONE> when finished.`
  );
}

export async function runStories(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "stories");
  return runSubAgent(
    ctx, plan, node,
    `Write docs/STORIES.md as a numbered list of small implementation steps. Each story states: files to create/modify, what to put in them, and how to verify.`,
    `Read docs/BRIEF.md and docs/ARCHITECTURE.md, then write docs/STORIES.md. Emit <PHASE_DONE> when done.`
  );
}

export async function runImpl(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "impl");
  return runSubAgent(
    ctx, plan, node,
    `Implement every story in docs/STORIES.md. Create all source files. The project MUST be runnable end-to-end with a single command. Include a minimal smoke test or main entry point that exits 0 on success. Use only the dependencies you actually install via shell (npm/pip). Prefer the stdlib where reasonable.`,
    `Implement the project per docs/STORIES.md. Verify by running the entry point or smoke test via the shell tool. Emit <PHASE_DONE> only after the project runs successfully.`,
    { allowEscalation: true }
  );
}

export async function runVerify(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "verify");
  return runSubAgent(
    ctx, plan, node,
    `Independently verify the project runs. Use list_files to discover the entry point, then run it via the shell tool. Report exit status and any errors.`,
    `Verify the implementation. Do not modify code. Output a one-paragraph verdict, then <PHASE_DONE>.`
  );
}

export async function runReview(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "review");
  return runSubAgent(
    ctx, plan, node,
    `Ensure README.md exists at the project root with: one-line description, install steps, run command, and brief usage. Create or update it. Do not change source code.`,
    `Finalize the project. Write/update README.md. Emit <PHASE_DONE> when done.`
  );
}
