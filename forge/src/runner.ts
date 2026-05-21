import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { classify } from "./agents/classifier.js";
import { buildPlan } from "./agents/orchestrator.js";
import { runArch, runBrief, runImpl, runReview, runStories, runVerify } from "./agents/sdlc.js";
import { Plan, RunContext } from "./types.js";
import { appendAudit, ensureRunDir, newRunId, saveCheckpoint, writePlan, readPlan } from "./run/state.js";

export interface RunOptions {
  prompt: string;
  targetDir: string;
  budgetUsd: number;
  dryRun?: boolean;
  resumeRunId?: string;
}

export async function runForge(opts: RunOptions): Promise<{ runId: string; plan: Plan }> {
  const runId = opts.resumeRunId ?? newRunId();
  const runDirPath = ensureRunDir(runId);
  const targetDir = path.resolve(opts.targetDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const ctx: RunContext = {
    runId,
    runDir: runDirPath,
    targetDir,
    budgetUsd: opts.budgetUsd,
    spentUsd: 0,
  };

  console.log(chalk.bold(`\nforge run ${runId}`));
  console.log(chalk.dim(`  target: ${targetDir}`));
  console.log(chalk.dim(`  budget: $${opts.budgetUsd.toFixed(2)}`));

  let plan: Plan;
  if (opts.resumeRunId) {
    plan = readPlan(runId);
    console.log(chalk.dim(`  resumed from existing plan`));
  } else {
    console.log(chalk.cyan(`\n[1/7] Classifying prompt (model: haiku)`));
    const classification = await classify(opts.prompt, ctx);
    console.log(
      chalk.dim(
        `  → type=${classification.projectType}, complexity=${classification.complexity}, files≈${classification.estFiles}, ambig=${classification.ambiguityScore}`
      )
    );
    plan = buildPlan(opts.prompt, classification, ctx);
    writePlan(runId, plan);
    saveCheckpoint(runId, "00-plan", plan);
  }

  if (opts.dryRun) {
    console.log(chalk.yellow("\nDry run — plan only:"));
    for (const n of plan.nodes) {
      console.log(`  ${n.phase.padEnd(8)} ${n.modelId.padEnd(7)} $${n.budgetUsd.toFixed(2)}  ${n.goal}`);
    }
    return { runId, plan };
  }

  const phases: Array<{ name: string; idx: number; fn: typeof runBrief; checkpoint: string }> = [
    { name: "Brief", idx: 2, fn: runBrief, checkpoint: "01-brief" },
    { name: "Architecture", idx: 3, fn: runArch, checkpoint: "02-arch" },
    { name: "Stories", idx: 4, fn: runStories, checkpoint: "03-stories" },
    { name: "Implementation", idx: 5, fn: runImpl, checkpoint: "04-impl" },
    { name: "Verify", idx: 6, fn: runVerify, checkpoint: "05-verify" },
    { name: "Review", idx: 7, fn: runReview, checkpoint: "06-review" },
  ];

  for (const ph of phases) {
    const node = plan.nodes.find((n) =>
      ph.name === "Brief" ? n.phase === "brief" :
      ph.name === "Architecture" ? n.phase === "arch" :
      ph.name === "Stories" ? n.phase === "stories" :
      ph.name === "Implementation" ? n.phase === "impl" :
      ph.name === "Verify" ? n.phase === "verify" : n.phase === "review"
    )!;
    console.log(
      chalk.cyan(`\n[${ph.idx}/7] ${ph.name} (model: ${node.modelId}, budget: $${node.budgetUsd.toFixed(2)})`)
    );
    appendAudit(runId, { kind: "phase_start", nodeId: node.id, modelId: node.modelId });
    const r = await ph.fn(ctx, plan);
    appendAudit(runId, {
      kind: "phase_end",
      nodeId: node.id,
      ok: r.ok,
      costUsd: r.costUsd,
      message: r.output.slice(0, 500),
    });
    saveCheckpoint(runId, ph.checkpoint, { ok: r.ok, modelUsed: r.modelUsed, steps: r.steps, output: r.output });
    console.log(
      r.ok
        ? chalk.green(`  ✓ ${ph.name} ok (${r.steps} steps, $${r.costUsd.toFixed(3)})`)
        : chalk.red(`  ✗ ${ph.name} failed (${r.steps} steps, $${r.costUsd.toFixed(3)})`)
    );
    console.log(chalk.dim(`  spent so far: $${ctx.spentUsd.toFixed(3)} / $${ctx.budgetUsd.toFixed(2)}`));
    if (!r.ok && ph.name !== "Verify") {
      console.log(chalk.red(`\nAborting run: ${ph.name} did not complete successfully.`));
      break;
    }
  }

  console.log(chalk.bold(`\nDone. Run id: ${runId}`));
  console.log(chalk.dim(`  audit: ${path.join(runDirPath, "audit.jsonl")}`));
  console.log(chalk.dim(`  project: ${targetDir}`));
  return { runId, plan };
}
