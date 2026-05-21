import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { classify } from "./agents/classifier.js";
import { buildPlan } from "./agents/orchestrator.js";
import { runArch, runBrief, runImpl, runReview, runStories, runVerify } from "./agents/sdlc.js";
import { ContextBudget, Plan, RunContext } from "./types.js";
import { appendAudit, ensureRunDir, newRunId, readPlan, saveCheckpoint, writePlan } from "./run/state.js";
import { detectProjectContext } from "./project/context.js";
import { writeBmadPlanArtifact } from "./bmad/artifacts.js";

export interface RunOptions {
  prompt: string;
  targetDir: string;
  dryRun?: boolean;
  resumeRunId?: string;
  coder?: string;
  modelOverride?: string;
  contextBudget?: ContextBudget;
  bmadOutput?: boolean;
}

export async function runForge(opts: RunOptions): Promise<{ runId: string; plan: Plan }> {
  const runId = opts.resumeRunId ?? newRunId();
  const runDirPath = ensureRunDir(runId);
  const targetDir = path.resolve(opts.targetDir);
  const projectContext = detectProjectContext(process.cwd());
  fs.mkdirSync(targetDir, { recursive: true });

  const ctx: RunContext = {
    runId,
    runDir: runDirPath,
    targetDir,
    estCostUsd: 0,
    projectContext,
    contextBudget: opts.contextBudget ?? "standard",
    modelOverride: opts.modelOverride ?? process.env.FORGE_MODEL,
    bmadOutput: opts.bmadOutput ?? false,
  };

  console.log(chalk.bold(`\nforge run ${runId}`));
  console.log(chalk.dim(`  target: ${targetDir}`));
  console.log(chalk.dim(`  run dir: ${runDirPath}`));
  console.log(chalk.dim(`  context budget: ${ctx.contextBudget}`));
  if (ctx.modelOverride) console.log(chalk.dim(`  model override: ${ctx.modelOverride}`));
  if (opts.coder) console.log(chalk.dim(`  impl model override: ${opts.coder}`));

  let plan: Plan;
  if (opts.resumeRunId) {
    plan = readPlan(runId);
    console.log(chalk.dim(`  resumed from existing plan`));
  } else {
    console.log(chalk.cyan(`\n[1/7] Classifying prompt (claude --model haiku)`));
    const classification = await classify(opts.prompt, ctx);
    console.log(
      chalk.dim(
        `  -> type=${classification.projectType}, complexity=${classification.complexity}, files≈${classification.estFiles}, ambig=${classification.ambiguityScore}`
      )
    );
    plan = buildPlan(opts.prompt, classification, ctx, { coder: opts.coder });
    writePlan(runId, plan);
    if (ctx.bmadOutput) {
      const artifactDir = writeBmadPlanArtifact(projectContext, plan);
      if (artifactDir) console.log(chalk.dim(`  BMAD plan: ${artifactDir}`));
    }
    saveCheckpoint(runId, "00-plan", plan);
  }

  if (opts.dryRun) {
    console.log(chalk.yellow("\nDry run - plan only:"));
    for (const n of plan.nodes) {
      console.log(`  ${n.phase.padEnd(8)} ${n.modelId.padEnd(7)}  ${n.goal}`);
    }
    return { runId, plan };
  }

  const phases: Array<{ name: string; idx: number; phase: Plan["nodes"][number]["phase"]; fn: typeof runBrief; checkpoint: string }> = [
    { name: "Brief",          idx: 2, phase: "brief",   fn: runBrief,   checkpoint: "01-brief" },
    { name: "Architecture",   idx: 3, phase: "arch",    fn: runArch,    checkpoint: "02-arch" },
    { name: "Stories",        idx: 4, phase: "stories", fn: runStories, checkpoint: "03-stories" },
    { name: "Implementation", idx: 5, phase: "impl",    fn: runImpl,    checkpoint: "04-impl" },
    { name: "Verify",         idx: 6, phase: "verify",  fn: runVerify,  checkpoint: "05-verify" },
    { name: "Review",         idx: 7, phase: "review",  fn: runReview,  checkpoint: "06-review" },
  ];

  for (const ph of phases) {
    const node = plan.nodes.find((n) => n.phase === ph.phase)!;
    console.log(chalk.cyan(`\n[${ph.idx}/7] ${ph.name} (model ${node.modelId})`));
    appendAudit(runId, { kind: "phase_start", nodeId: node.id, modelId: node.modelId });
    const r = await ph.fn(ctx, plan);
    appendAudit(runId, {
      kind: "phase_end",
      nodeId: node.id,
      ok: r.ok,
      costUsd: r.costUsd,
      message: r.output.slice(0, 500),
    });
    saveCheckpoint(runId, ph.checkpoint, { ok: r.ok, modelUsed: r.modelUsed, durationMs: r.durationMs, output: r.output });
    console.log(
      r.ok
        ? chalk.green(`  ✓ ${ph.name} ok in ${(r.durationMs / 1000).toFixed(1)}s${r.costUsd ? ` ($${r.costUsd.toFixed(4)})` : ""}`)
        : chalk.red(`  ✗ ${ph.name} failed in ${(r.durationMs / 1000).toFixed(1)}s - ${r.output.slice(0, 200)}`)
    );
    if (!r.ok && ph.name !== "Verify") {
      console.log(chalk.red(`\nAborting run: ${ph.name} did not complete.`));
      break;
    }
  }

  console.log(chalk.bold(`\nDone. Run id: ${runId}`));
  console.log(chalk.dim(`  audit: ${path.join(runDirPath, "audit.jsonl")}`));
  console.log(chalk.dim(`  project: ${targetDir}`));
  console.log(chalk.dim(`  est. cost: $${ctx.estCostUsd.toFixed(4)} (from CLI JSON output when available)`));
  return { runId, plan };
}
