import { runSubAgent, SubAgentResult } from "./sub-agent.js";
import { Plan, PlanNode, RunContext } from "../types.js";

function nodeOf(plan: Plan, phase: PlanNode["phase"]): PlanNode {
  const n = plan.nodes.find((n) => n.phase === phase);
  if (!n) throw new Error(`No node for phase ${phase}`);
  return n;
}

export async function runBa(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "ba");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "This is an iteration on an existing project in the current directory, not a greenfield build.",
      "Inspect the existing project docs and source tree enough to understand the requested change.",
      "Write or update docs/CHANGE_REQUEST.md with: Requested Change, Current Behavior, Desired Behavior, Impacted Users, Functional Requirements, Non-functional Requirements, Acceptance Criteria, Risks, Open Questions, Sign-off Checklist.",
      "Do not overwrite existing PRD/BRD content unless the change explicitly requires updating durable requirements; if needed, append a short change note.",
      "Do not implement code in this phase.",
    ].join("\n") : [
      "Gather requirements from the user prompt and classification metadata.",
      "Write docs/PRD.md unless the request is primarily business-process or compliance oriented; in that case write docs/BRD.md.",
      "Keep it sign-off ready with sections: Purpose, Stakeholders, Goals, Non-goals, Functional Requirements, Non-functional Requirements, Acceptance Criteria, Risks, Open Questions, Sign-off Checklist.",
      "Do not implement code in this phase.",
    ].join("\n"),
    `User prompt: """${plan.prompt}"""\n\nClassification metadata: ${JSON.stringify(plan.classification)}\n\n${work ? "Write the change-request requirements artifact now." : "Write the BA requirements artifact now."}`
  );
}

export async function runTechArch(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "tech_arch");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "This is an iteration on an existing project in the current directory.",
      "Read docs/CHANGE_REQUEST.md and inspect existing architecture/docs/source enough to identify the change impact.",
      "Create or update docs/TDD.md with a Current Change Impact section covering affected modules, data model changes, API/interface changes, migration concerns, compatibility, and local run strategy.",
      "Preserve existing architecture decisions unless the change explicitly supersedes them.",
      "Do not implement code in this phase.",
    ].join("\n") : [
      "Read docs/PRD.md or docs/BRD.md.",
      "Create or update docs/TDD.md with the technical design: stack and versions, system boundaries, module responsibilities, data model, integration points, security assumptions, deployment assumptions, and local run strategy.",
      "Include clear placeholders for Mermaid diagrams that the architecture synthesis phase can finalize.",
      "Do not implement code in this phase.",
    ].join("\n"),
    work ? "Design the technical change for the existing project." : "Build the technical design for the signed-off requirements."
  );
}

export async function runUxDesign(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "ux_design");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "This is an iteration on an existing project in the current directory.",
      "Read docs/CHANGE_REQUEST.md and inspect the existing UI/API/CLI interaction patterns.",
      "Update docs/DESIGN_SYSTEM.md with a Current Change UX section covering affected screens or commands, interaction changes, accessibility, responsive behavior, copy, and design-system impact.",
      "If the change has no material UI/UX impact, state that explicitly and define the expected API/CLI interaction behavior.",
      "Do not implement code in this phase.",
    ].join("\n") : [
      "Read docs/PRD.md or docs/BRD.md.",
      "Write docs/DESIGN_SYSTEM.md for the requested system.",
      "Cover target users, information architecture, interaction patterns, layout principles, component inventory, accessibility requirements, responsive behavior, and visual language.",
      "If the system has no material UI, state that explicitly and define CLI/API interaction conventions instead.",
      "Do not implement code in this phase.",
    ].join("\n"),
    work ? "Define the UI/UX impact for this change request." : "Define the UI/UX and design-system guidance for the requested system."
  );
}

export async function runArchSynthesis(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "arch_synthesis");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "This is an iteration on an existing project in the current directory.",
      "Read docs/CHANGE_REQUEST.md, docs/TDD.md, docs/DESIGN_SYSTEM.md, and inspect affected source areas.",
      "Finalize the change design in docs/TDD.md with Mermaid diagrams only where the change affects data, flow, or class/component relationships.",
      "Clearly list implementation constraints so the developer changes only the requested scope.",
      "Do not implement code in this phase.",
    ].join("\n") : [
      "Read docs/PRD.md or docs/BRD.md, docs/TDD.md, and docs/DESIGN_SYSTEM.md.",
      "Finalize docs/TDD.md so it is architect sign-off ready.",
      "Include Mermaid diagrams in markdown for ERD/data model, key user/system flows, and class/component diagrams where relevant.",
      "Resolve conflicts between technical and UX design. Keep decisions concrete enough for implementation.",
      "Do not implement code in this phase.",
    ].join("\n"),
    work ? "Synthesize the approved change design for implementation." : "Synthesize the technical and UX design into the final TDD and diagrams."
  );
}

export async function runStories(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "stories");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work
      ? "Read docs/CHANGE_REQUEST.md, docs/TDD.md, docs/DESIGN_SYSTEM.md, and inspect the existing project. Update docs/STORIES.md with a Current Change Backlog section. Each story must state exact files or areas to modify, expected behavior, compatibility constraints, and how to verify it. Do not include unrelated refactors."
      : "Read the signed-off requirements, docs/TDD.md, and docs/DESIGN_SYSTEM.md. Write docs/STORIES.md as an ordered implementation backlog. Each story must state files or areas to create/modify, expected behavior, and how to verify it.",
    work ? "Decompose the signed-off change design into implementation stories." : "Decompose the signed-off design into implementation stories."
  );
}

export async function runDev(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "dev");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work
      ? "Implement only the Current Change Backlog in docs/STORIES.md. Work in the existing project; do not recreate the app, do not overwrite unrelated files, and preserve existing behavior unless the change request says otherwise. Install dependencies only if necessary and consistent with the project. Run focused verification for the changed behavior before finishing."
      : "Implement every story in docs/STORIES.md. Create all source files. Install dependencies via shell only if necessary. The project MUST run end-to-end via a single local command. Include a smoke test or main entry point that exits 0 on success. Run it to confirm before finishing.",
    work ? "Implement the requested change in the existing project and verify it runs." : "Implement the project per docs/STORIES.md and verify it runs.",
    { allowEscalation: true, timeoutMs: 30 * 60_000 }
  );
}

export async function runQa(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "qa");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "Read docs/CHANGE_REQUEST.md, docs/TDD.md, docs/STORIES.md, and inspect the changed implementation.",
      "Update docs/TEST_CASES.md with a Current Change Test Cases section, including happy path, negative flow, and regression coverage for existing behavior.",
      "Implement or update focused automated tests for the change. Use the existing test framework when present.",
      "Run the relevant tests or smoke commands and report exact commands and outcomes.",
    ].join("\n") : [
      "Read docs/PRD.md or docs/BRD.md, docs/TDD.md, docs/STORIES.md, and inspect the implemented project.",
      "Write docs/TEST_CASES.md with test scenarios, including happy path and negative flow cases.",
      "Implement basic automated tests for the happy path and at least one negative flow. Use the project's existing test framework when present; otherwise add the smallest practical test setup.",
      "Run the tests or smoke commands and report exact commands and outcomes.",
    ].join("\n"),
    work ? "Update QA test cases, implement focused automated coverage, and run it." : "Create QA test cases, implement the basic automated flows, and run them.",
    { allowEscalation: true, timeoutMs: 30 * 60_000 }
  );
}

export async function runInfra(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "infra");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "Read docs/CHANGE_REQUEST.md, docs/TDD.md, the changed implementation, and existing local runtime files.",
      "Update docs/INFRA.md only where this change affects local runtime dependencies, ports, environment variables, health checks, Aspire, or Docker Compose.",
      "Modify local-first runtime support only if required by the change. Do not provision cloud infrastructure.",
      "If infra is unaffected, state that clearly in docs/INFRA.md and keep existing local run commands intact.",
      "Run only relevant local validation commands and report outcomes.",
    ].join("\n") : [
      "Read the requirements, TDD, stories, implemented project, and test cases.",
      "Write docs/INFRA.md covering local runtime dependencies, service topology, ports, environment variables, health checks, and future cloud considerations.",
      "Create local-first runtime support when useful: prefer .NET Aspire for .NET distributed apps, otherwise Docker Compose for multi-service systems. Do not provision cloud infrastructure.",
      "If local infra is unnecessary, state why in docs/INFRA.md and provide the direct local run commands.",
      "Run only local validation commands and report outcomes.",
    ].join("\n"),
    work ? "Validate and update local infrastructure only as needed for this change." : "Define and validate the local-first infrastructure for this system.",
    { allowEscalation: true, timeoutMs: 30 * 60_000 }
  );
}

export async function runReview(ctx: RunContext, plan: Plan): Promise<SubAgentResult> {
  const node = nodeOf(plan, "review");
  const work = isWork(ctx);
  return runSubAgent(
    ctx, plan, node,
    work ? [
      "Update README.md only if the requested change affects setup, usage, tests, or local runtime instructions.",
      "Do not change product source code.",
      "Summarize the change request, modified behavior, test status, local infrastructure status, and remaining risks.",
    ].join("\n") : [
      "Ensure README.md exists at the project root with one-line description, requirements, install steps, run command, test command, local infra command if any, and brief usage example.",
      "Do not change product source code.",
      "Summarize signed-off artifacts, implementation status, test status, local infrastructure status, and remaining risks.",
    ].join("\n"),
    work ? "Finalize the iteration summary and changed documentation." : "Finalize project documentation and release-readiness summary."
  );
}

function isWork(ctx: RunContext): boolean {
  return ctx.mode === "work";
}
