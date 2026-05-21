#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { runForge } from "./runner.js";
import { MODELS } from "./models/registry.js";
import { readAudit, readPlan, listRuns } from "./run/state.js";
import { checkCli } from "./util/check-cli.js";

const program = new Command();
program.name("forge").description("Agentic CLI that builds projects via Claude Code & Codex CLIs").version("0.2.0");

program
  .command("new")
  .description("Build a new project from a prompt")
  .argument("<prompt>", "natural-language description of the project to build")
  .option("--target-dir <dir>", "where to write the generated project", "./forge-out")
  .option("--dry-run", "print plan without executing", false)
  .option("--skip-doctor", "skip CLI availability check", false)
  .action(async (prompt: string, opts: { targetDir: string; dryRun: boolean; skipDoctor: boolean }) => {
    if (!opts.skipDoctor) await doctor();
    try {
      await runForge({
        prompt,
        targetDir: path.resolve(opts.targetDir),
        dryRun: opts.dryRun,
      });
    } catch (e) {
      console.error(chalk.red("Run failed:"), (e as Error).message);
      process.exit(1);
    }
  });

program
  .command("plan")
  .description("Print routing plan for a prompt without executing")
  .argument("<prompt>")
  .option("--target-dir <dir>", "intended project dir", "./forge-out")
  .action(async (prompt: string, opts: { targetDir: string }) => {
    await doctor();
    await runForge({ prompt, targetDir: path.resolve(opts.targetDir), dryRun: true });
  });

program
  .command("resume")
  .description("Resume a run from its last checkpoint")
  .argument("<run-id>")
  .option("--target-dir <dir>", "project dir", "./forge-out")
  .action(async (runId: string, opts: { targetDir: string }) => {
    await doctor();
    await runForge({ prompt: "", targetDir: path.resolve(opts.targetDir), resumeRunId: runId });
  });

program
  .command("doctor")
  .description("Check that required CLIs (claude, codex) are available")
  .action(async () => { await doctor(true); });

program
  .command("models")
  .description("List the model registry")
  .action(() => {
    console.log(chalk.bold("Model registry:"));
    for (const m of MODELS) {
      console.log(`  ${m.id.padEnd(7)} cli=${m.cli.padEnd(7)} flag=${m.cliModelFlag.padEnd(16)} strengths=${m.strengths.join(",")}`);
      if (m.notes) console.log(chalk.dim(`           ${m.notes}`));
    }
  });

program
  .command("log")
  .description("Print the audit log for a run")
  .argument("<run-id>")
  .action((runId: string) => {
    const events = readAudit(runId);
    if (events.length === 0) {
      console.log(chalk.yellow("No audit events. Available runs:"));
      for (const r of listRuns().slice(0, 10)) console.log("  " + r);
      return;
    }
    for (const e of events) {
      const cost = e.costUsd ? ` $${e.costUsd.toFixed(4)}` : "";
      const toks = e.tokensIn ? ` in=${e.tokensIn} out=${e.tokensOut}` : "";
      const dur = e.durationMs ? ` ${(e.durationMs / 1000).toFixed(1)}s` : "";
      console.log(`${e.ts} [${e.kind}] ${e.nodeId ?? ""} ${e.modelId ?? ""}${dur}${toks}${cost} ${e.message ?? ""}`);
    }
  });

program
  .command("cost")
  .description("Print cost breakdown for a run")
  .argument("<run-id>")
  .action((runId: string) => {
    const events = readAudit(runId);
    const byModel = new Map<string, { cost: number; calls: number; in: number; out: number }>();
    let total = 0;
    for (const e of events) {
      if (e.kind !== "cli_call" || !e.modelId) continue;
      const cur = byModel.get(e.modelId) ?? { cost: 0, calls: 0, in: 0, out: 0 };
      cur.cost += e.costUsd ?? 0;
      cur.calls += 1;
      cur.in += e.tokensIn ?? 0;
      cur.out += e.tokensOut ?? 0;
      byModel.set(e.modelId, cur);
      total += e.costUsd ?? 0;
    }
    console.log(chalk.bold(`Cost for run ${runId} (from CLI-reported usage):`));
    for (const [m, v] of byModel) {
      console.log(`  ${m.padEnd(7)} calls=${v.calls}  in=${v.in}  out=${v.out}  $${v.cost.toFixed(4)}`);
    }
    console.log(chalk.bold(`  TOTAL: $${total.toFixed(4)}`));
    console.log(chalk.dim(`  (Codex CLI typically does not report cost — those calls show $0.)`));
  });

program
  .command("runs")
  .description("List recent runs")
  .action(() => {
    const runs = listRuns().slice(0, 20);
    if (runs.length === 0) console.log("(no runs yet)");
    for (const r of runs) {
      try {
        const p = readPlan(r);
        console.log(`  ${r}  — ${p.prompt.slice(0, 60)}`);
      } catch {
        console.log(`  ${r}`);
      }
    }
  });

async function doctor(verbose = false) {
  const claude = await checkCli("claude", ["--version"]);
  const codex = await checkCli("codex", ["--version"]);
  if (verbose || !claude.ok) {
    console.log(`  claude CLI: ${claude.ok ? chalk.green("✓ " + claude.version) : chalk.red("✗ not found")}`);
  }
  if (verbose) {
    console.log(`  codex  CLI: ${codex.ok ? chalk.green("✓ " + codex.version) : chalk.yellow("✗ not found (optional)")}`);
  }
  if (!claude.ok) {
    console.error(chalk.red("\nclaude CLI is required. Install Claude Code: https://claude.com/claude-code"));
    process.exit(1);
  }
}

program.parseAsync(process.argv);
