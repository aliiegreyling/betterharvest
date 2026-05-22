import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { classify } from "./agents/classifier.js";
import { buildPlan } from "./agents/orchestrator.js";
import {
  runArchSynthesis,
  runBa,
  runDev,
  runInfra,
  runQa,
  runReview,
  runStories,
  runTechArch,
  runUxDesign,
} from "./agents/sdlc.js";
import { ContextBudget, Phase, Plan, PlanNode, RoleGuide, RunContext, RunMode } from "./types.js";
import { appendAudit, ensureRunDir, loadCheckpoint, newRunId, readPlan, saveCheckpoint, writePlan } from "./run/state.js";
import { detectProjectContext } from "./project/context.js";
import { writeBmadPlanArtifact } from "./bmad/artifacts.js";
import { createRunEvent, ForgeRunEventHandler } from "./runtime/events.js";
import { checkCli } from "./util/check-cli.js";
import { resolveForgeTargetDir } from "./project/output-paths.js";

export interface RunOptions {
  prompt: string;
  targetDir: string;
  mode?: RunMode;
  dryRun?: boolean;
  resumeRunId?: string;
  coder?: string;
  modelOverride?: string;
  contextBudget?: ContextBudget;
  bmadOutput?: boolean;
  beforePhase?: (phase: PhasePrompt) => Promise<PhaseDecision>;
  approvalGates?: boolean;
  requestApproval?: (approval: ApprovalPrompt) => Promise<ApprovalDecision>;
  runId?: string;
  roleGuides?: RoleGuide[];
  onEvent?: ForgeRunEventHandler;
}

export interface PhasePrompt {
  runId: string;
  idx: number;
  name: string;
  phase: Phase;
  node: PlanNode;
  targetDir: string;
}

export interface PhaseDecision {
  action: "run" | "skip" | "abort";
  note?: string;
}

export interface ApprovalPrompt {
  runId: string;
  phase: Phase;
  node: PlanNode;
  gateId: string;
  gateLabel: string;
  approverRole: string;
  revision: number;
  maxRevisionCycles: number;
  expectedArtifacts: string[];
}

export interface ApprovalDecision {
  action: "approve" | "changes" | "abort";
  note?: string;
}

type PhaseRunner = (ctx: RunContext, plan: Plan) => Promise<Awaited<ReturnType<typeof runBa>>>;

export async function runForge(opts: RunOptions): Promise<{ runId: string; plan: Plan }> {
  const runId = opts.resumeRunId ?? opts.runId ?? newRunId();
  const runDirPath = ensureRunDir(runId);
  const mode = opts.mode ?? "new";
  const resumePlan = opts.resumeRunId ? readPlan(runId) : null;
  const targetDir = resolveForgeTargetDir(resumePlan?.targetDir ?? opts.targetDir, {
    runId,
    mode: opts.resumeRunId ? "resume" : mode,
  });
  const projectContext = detectProjectContext(process.cwd());
  if (mode === "work" && !fs.existsSync(targetDir) && !opts.dryRun) {
    throw new Error(`Cannot run work mode because target project does not exist: ${targetDir}`);
  }
  if (!(mode === "work" && opts.dryRun)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ctx: RunContext = {
    runId,
    runDir: runDirPath,
    targetDir,
    mode,
    estCostUsd: 0,
    projectContext,
    contextBudget: opts.contextBudget ?? "standard",
    modelOverride: opts.modelOverride ?? process.env.FORGE_MODEL,
    bmadOutput: opts.bmadOutput ?? false,
    phaseNotes: {},
    roleGuides: normalizeRoleGuides(opts.roleGuides ?? []),
    onEvent: opts.onEvent,
  };
  const emit = opts.onEvent ?? (() => undefined);

  persistRoleGuides(ctx);
  emit(createRunEvent(runId, "run_created", { targetDir, runDir: runDirPath }));
  console.log(chalk.bold(`\nforge run ${runId}`));
  console.log(chalk.dim(`  mode: ${ctx.mode}`));
  console.log(chalk.dim(`  target: ${targetDir}`));
  console.log(chalk.dim(`  run dir: ${runDirPath}`));
  console.log(chalk.dim(`  context budget: ${ctx.contextBudget}`));
  if (ctx.modelOverride) console.log(chalk.dim(`  model override: ${ctx.modelOverride}`));
  if (opts.coder) console.log(chalk.dim(`  dev model override: ${opts.coder}`));

  let plan: Plan;
  if (opts.resumeRunId) {
    plan = resumePlan!;
    ctx.mode = plan.mode ?? ctx.mode;
    console.log(chalk.dim(`  resumed from existing plan`));
  } else {
    console.log(chalk.cyan(`\n[1/10] Classifying prompt (claude --model haiku)`));
    const classification = await classify(opts.prompt, ctx);
    console.log(
      chalk.dim(
        `  -> type=${classification.projectType}, complexity=${classification.complexity}, files≈${classification.estFiles}, ambig=${classification.ambiguityScore}`
      )
    );
    const coder = opts.coder ?? (await codexAvailable() ? "codex" : undefined);
    plan = buildPlan(opts.prompt, classification, ctx, { coder });
    writePlan(runId, plan);
    emit(createRunEvent(runId, "plan_written", { data: plan }));
    if (ctx.bmadOutput) {
      const artifactDir = writeBmadPlanArtifact(projectContext, plan);
      if (artifactDir) console.log(chalk.dim(`  BMAD plan: ${artifactDir}`));
    }
    saveCheckpoint(runId, "00-plan", plan);
    emit(createRunEvent(runId, "checkpoint_saved", { checkpoint: "00-plan", data: plan }));
  }

  if (opts.dryRun) {
    console.log(chalk.yellow("\nDry run - plan only:"));
    for (const n of plan.nodes) {
      const gate = n.approvalGate ? `  gate=${n.approvalGate.label}` : "";
      console.log(`  ${n.phase.padEnd(15)} ${n.modelId.padEnd(7)}  ${n.goal}${gate}`);
    }
    emit(createRunEvent(runId, "run_done", { targetDir, runDir: runDirPath, data: { dryRun: true } }));
    return { runId, plan };
  }

  const phases: Array<{ name: string; idx: number; phase: Plan["nodes"][number]["phase"]; fn: PhaseRunner; checkpoint: string }> = [
    { name: "BA Requirements",       idx: 2, phase: "ba",             fn: runBa,            checkpoint: "01-ba" },
    { name: "Technical Design",      idx: 3, phase: "tech_arch",      fn: runTechArch,      checkpoint: "02-tech-arch" },
    { name: "UI/UX Design",          idx: 4, phase: "ux_design",      fn: runUxDesign,      checkpoint: "03-ux-design" },
    { name: "Architecture Synthesis", idx: 5, phase: "arch_synthesis", fn: runArchSynthesis, checkpoint: "04-arch-synthesis" },
    { name: "Stories",               idx: 6, phase: "stories",        fn: runStories,       checkpoint: "05-stories" },
    { name: "Development",           idx: 7, phase: "dev",            fn: runDev,           checkpoint: "06-dev" },
    { name: "QA & Testing",          idx: 8, phase: "qa",             fn: runQa,            checkpoint: "07-qa" },
    { name: "Local Infrastructure",  idx: 9, phase: "infra",          fn: runInfra,         checkpoint: "08-infra" },
    { name: "Review",                idx: 10, phase: "review",        fn: runReview,        checkpoint: "09-review" },
  ];
  const startAt = opts.resumeRunId ? firstIncompletePhaseIndex(runId, phases) : 0;
  if (opts.resumeRunId && startAt > 0) {
    console.log(chalk.dim(`  resume: skipping ${startAt} completed phase(s)`));
  }

  for (const [phaseIndex, ph] of phases.entries()) {
    if (phaseIndex < startAt) continue;
    const node = plan.nodes.find((n) => n.phase === ph.phase)!;
    let revision = 0;
    const decision = await opts.beforePhase?.({
      runId,
      idx: ph.idx,
      name: ph.name,
      phase: ph.phase,
      node,
      targetDir,
    });

    if (decision?.action === "abort") {
      appendAudit(runId, { kind: "info", nodeId: node.id, modelId: node.modelId, message: `aborted before ${ph.phase}` });
      console.log(chalk.yellow(`\nAborted before ${ph.name}. Run id: ${runId}`));
      break;
    }

    if (decision?.action === "skip") {
      appendAudit(runId, { kind: "phase_end", nodeId: node.id, modelId: node.modelId, ok: true, message: `skipped ${ph.phase}` });
      saveCheckpoint(runId, ph.checkpoint, { ok: true, skipped: true });
      console.log(chalk.yellow(`\n[${ph.idx}/10] ${ph.name} skipped by user`));
      continue;
    }

    if (decision?.note) {
      appendPhaseNote(ctx, ph.phase, decision.note);
      appendAudit(runId, { kind: "info", nodeId: node.id, modelId: node.modelId, message: `user guidance provided for ${ph.phase}` });
    }

    while (true) {
      const r = await runOnePhase({ ctx, plan, phase: ph, node, revision, emit });
      if (!r.ok) {
        console.log(chalk.red(`\nAborting run: ${ph.name} did not complete.`));
        emit(createRunEvent(runId, "run_done", { targetDir, runDir: runDirPath, data: { failedAt: ph.phase } }));
        return { runId, plan };
      }

      const approvalResult = await handleApprovalGate({
        ctx,
        node,
        phaseName: ph.name,
        revision,
        requestApproval: opts.requestApproval,
        approvalGates: opts.approvalGates ?? true,
      });

      if (approvalResult === "approved" || approvalResult === "not-required") break;
      if (approvalResult === "aborted" || approvalResult === "blocked") {
        console.log(chalk.yellow(`\nStopped at ${ph.name}. Run id: ${runId}`));
        emit(createRunEvent(runId, "run_done", { targetDir, runDir: runDirPath, data: { stoppedAt: ph.phase } }));
        return { runId, plan };
      }
      revision += 1;
    }
  }

  console.log(chalk.bold(`\nDone. Run id: ${runId}`));
  console.log(chalk.dim(`  audit: ${path.join(runDirPath, "audit.jsonl")}`));
  console.log(chalk.dim(`  project: ${targetDir}`));
  console.log(chalk.dim(`  est. cost: $${ctx.estCostUsd.toFixed(4)} (from CLI JSON output when available)`));
  emit(createRunEvent(runId, "run_done", { targetDir, runDir: runDirPath, data: { estCostUsd: ctx.estCostUsd } }));
  return { runId, plan };
}

function normalizeRoleGuides(guides: RoleGuide[]): Partial<Record<Phase, RoleGuide[]>> {
  const allowed = new Set<Phase>(["ba", "qa"]);
  const grouped: Partial<Record<Phase, RoleGuide[]>> = {};
  for (const guide of guides) {
    if (!allowed.has(guide.phase)) continue;
    const content = guide.content.trim();
    if (!content) continue;
    const phaseGuides = grouped[guide.phase] ?? [];
    phaseGuides.push({
      phase: guide.phase,
      name: sanitizeGuideName(guide.name),
      content: content.slice(0, 200_000),
    });
    grouped[guide.phase] = phaseGuides.slice(0, 8);
  }
  return grouped;
}

function persistRoleGuides(ctx: RunContext): void {
  const phases = Object.entries(ctx.roleGuides ?? {}) as Array<[Phase, RoleGuide[]]>;
  if (phases.length === 0) return;
  for (const [phase, guides] of phases) {
    if (guides.length === 0) continue;
    const dir = path.join(ctx.runDir, "role-guides", phase);
    fs.mkdirSync(dir, { recursive: true });
    for (const [index, guide] of guides.entries()) {
      const file = `${String(index + 1).padStart(2, "0")}-${sanitizeGuideName(guide.name)}`;
      fs.writeFileSync(path.join(dir, file), guide.content);
    }
    appendAudit(ctx.runId, {
      kind: "info",
      agent: "Forge",
      message: `attached ${guides.length} uploaded role guide(s) to ${phase}`,
    });
  }
}

function sanitizeGuideName(name: string): string {
  const cleaned = path.basename(name || "role-guide.md").replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
}

function firstIncompletePhaseIndex(
  runId: string,
  phases: Array<{ checkpoint: string }>
): number {
  for (let i = 0; i < phases.length; i += 1) {
    const checkpoint = loadCheckpoint<{ ok?: boolean; skipped?: boolean }>(runId, phases[i].checkpoint);
    if (!checkpoint?.ok && !checkpoint?.skipped) return i;
  }
  return phases.length;
}

async function runOnePhase(args: {
  ctx: RunContext;
  plan: Plan;
  phase: { name: string; idx: number; phase: Plan["nodes"][number]["phase"]; fn: PhaseRunner; checkpoint: string };
  node: PlanNode;
  revision: number;
  emit: ForgeRunEventHandler;
}): Promise<{ ok: boolean }> {
  const { ctx, plan, phase, node, revision, emit } = args;
  const revisionLabel = revision > 0 ? ` revision ${revision}` : "";
  console.log(chalk.cyan(`\n[${phase.idx}/10] ${phase.name}${revisionLabel} (model ${node.modelId})`));
  appendAudit(ctx.runId, {
    kind: "phase_start",
    nodeId: node.id,
    modelId: node.modelId,
    revision,
    message: `${phase.name}${revisionLabel} started with ${node.modelId}`,
  });
  emit(createRunEvent(ctx.runId, "phase_start", {
    nodeId: node.id,
    phase: phase.phase,
    phaseName: phase.name,
    modelId: node.modelId,
    node,
  }));
  const r = await phase.fn(ctx, plan);
  const phaseSummary = `${phase.name} ${r.ok ? "completed" : "failed"} in ${(r.durationMs / 1000).toFixed(1)}s using ${r.modelUsed}`;
  const auditEvent = {
    kind: "phase_end",
    nodeId: node.id,
    ok: r.ok,
    costUsd: r.costUsd,
    durationMs: r.durationMs,
    modelId: r.modelUsed,
    message: `${phaseSummary}\n${r.output.slice(0, 500)}`,
    revision,
  } as const;
  appendAudit(ctx.runId, auditEvent);
  emit(createRunEvent(ctx.runId, "phase_end", {
    nodeId: node.id,
    phase: phase.phase,
    phaseName: phase.name,
    modelId: r.modelUsed,
    ok: r.ok,
    message: r.output.slice(0, 500),
  }));
  saveCheckpoint(ctx.runId, phase.checkpoint, { ok: r.ok, modelUsed: r.modelUsed, durationMs: r.durationMs, output: r.output, revision });
  emit(createRunEvent(ctx.runId, "checkpoint_saved", { checkpoint: phase.checkpoint }));
  console.log(
    r.ok
      ? chalk.green(`  ✓ ${phase.name} ok in ${(r.durationMs / 1000).toFixed(1)}s${r.costUsd ? ` ($${r.costUsd.toFixed(4)})` : ""}`)
      : chalk.red(`  ✗ ${phase.name} failed in ${(r.durationMs / 1000).toFixed(1)}s - ${r.output.slice(0, 200)}`)
  );
  return { ok: r.ok };
}

async function handleApprovalGate(args: {
  ctx: RunContext;
  node: PlanNode;
  phaseName: string;
  revision: number;
  requestApproval?: (approval: ApprovalPrompt) => Promise<ApprovalDecision>;
  approvalGates: boolean;
}): Promise<"not-required" | "approved" | "changes" | "aborted" | "blocked"> {
  const { ctx, node, phaseName, revision, approvalGates } = args;
  const gate = node.approvalGate;
  if (!gate || !approvalGates) return "not-required";

  appendAudit(ctx.runId, {
    kind: "approval_requested",
    nodeId: node.id,
    modelId: node.modelId,
    approvalGateId: gate.id,
    approverRole: gate.approverRole,
    revision,
    message: gate.label,
  });
  ctx.onEvent?.(createRunEvent(ctx.runId, "approval_requested", {
    nodeId: node.id,
    phase: node.phase,
    modelId: node.modelId,
    message: gate.label,
  }));

  const prompt: ApprovalPrompt = {
    runId: ctx.runId,
    phase: node.phase,
    node,
    gateId: gate.id,
    gateLabel: gate.label,
    approverRole: gate.approverRole,
    revision,
    maxRevisionCycles: gate.maxRevisionCycles,
    expectedArtifacts: node.expectedArtifacts ?? [],
  };
  const decision = args.requestApproval
    ? await args.requestApproval(prompt)
    : await requestTerminalApproval(prompt);

  if (decision.action === "approve") {
    appendAudit(ctx.runId, {
      kind: "approval_granted",
      nodeId: node.id,
      modelId: node.modelId,
      approvalGateId: gate.id,
      approverRole: gate.approverRole,
      revision,
      message: `${phaseName} approved${decision.note ? `: ${decision.note}` : ""}`,
    });
    ctx.onEvent?.(createRunEvent(ctx.runId, "approval_granted", {
      nodeId: node.id,
      phase: node.phase,
      modelId: node.modelId,
      message: gate.label,
    }));
    return "approved";
  }

  if (decision.action === "abort") {
    appendAudit(ctx.runId, {
      kind: "approval_aborted",
      nodeId: node.id,
      modelId: node.modelId,
      approvalGateId: gate.id,
      approverRole: gate.approverRole,
      revision,
      message: decision.note ?? `${phaseName} approval aborted`,
    });
    ctx.onEvent?.(createRunEvent(ctx.runId, "approval_aborted", {
      nodeId: node.id,
      phase: node.phase,
      modelId: node.modelId,
      message: gate.label,
    }));
    return "aborted";
  }

  if (revision >= gate.maxRevisionCycles) {
    appendAudit(ctx.runId, {
      kind: "approval_aborted",
      nodeId: node.id,
      modelId: node.modelId,
      approvalGateId: gate.id,
      approverRole: gate.approverRole,
      revision,
      message: `Maximum revision cycles reached for ${gate.label}`,
    });
    return "blocked";
  }

  appendPhaseNote(ctx, node.phase, decision.note ?? "Address reviewer changes before requesting sign-off again.");
  appendAudit(ctx.runId, {
    kind: "changes_requested",
    nodeId: node.id,
    modelId: node.modelId,
    approvalGateId: gate.id,
    approverRole: gate.approverRole,
    revision,
    message: decision.note ?? "Changes requested",
  });
  ctx.onEvent?.(createRunEvent(ctx.runId, "changes_requested", {
    nodeId: node.id,
    phase: node.phase,
    modelId: node.modelId,
    message: decision.note ?? "Changes requested",
  }));
  return "changes";
}

async function requestTerminalApproval(prompt: ApprovalPrompt): Promise<ApprovalDecision> {
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow(`\nApproval required: ${prompt.gateLabel}`));
    console.log(chalk.dim(`  Approver: ${prompt.approverRole}`));
    console.log(chalk.dim(`  Run id: ${prompt.runId}`));
    console.log(chalk.dim("  Resume in an interactive terminal after review, or run with --no-approval-gates for local experiments."));
    return { action: "abort", note: "Approval required in an interactive terminal." };
  }

  const rl = createInterface({ input, output });
  try {
    console.log(chalk.bold(`\nApproval required: ${prompt.gateLabel}`));
    console.log(chalk.dim(`Approver role: ${prompt.approverRole}`));
    if (prompt.expectedArtifacts.length > 0) {
      console.log(chalk.dim(`Review artifacts: ${prompt.expectedArtifacts.join(", ")}`));
    }
    console.log(chalk.dim("Choose: approve, changes, abort."));
    while (true) {
      const action = (await rl.question(`${prompt.approverRole}> `)).trim().toLowerCase();
      if (["approve", "a"].includes(action)) return { action: "approve" };
      if (["abort", "cancel", "q"].includes(action)) return { action: "abort" };
      if (["changes", "change", "c", "request-changes"].includes(action)) {
        const note = (await rl.question("Change request: ")).trim();
        return { action: "changes", note };
      }
      console.log(chalk.yellow("Expected approve, changes, or abort."));
    }
  } finally {
    rl.close();
  }
}

function appendPhaseNote(ctx: RunContext, phase: Phase, note: string): void {
  const existing = ctx.phaseNotes?.[phase];
  ctx.phaseNotes = {
    ...(ctx.phaseNotes ?? {}),
    [phase]: existing ? `${existing}\n\n${note}` : note,
  };
}

async function codexAvailable(): Promise<boolean> {
  try {
    return (await checkCli("codex")).ok;
  } catch {
    return false;
  }
}
