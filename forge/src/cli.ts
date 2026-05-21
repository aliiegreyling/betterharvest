#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { runForge } from "./runner.js";
import { MODELS } from "./models/registry.js";
import { readAudit, readPlan, listRuns } from "./run/state.js";

const program = new Command();
program.name("forge").description("Agentic CLI that builds projects from a prompt").version("0.1.0");

program
  .command("new")
  .description("Build a new project from a prompt")
  .argument("<prompt>", "natural-language description of the project to build")
  .option("--target-dir <dir>", "where to write the generated project", "./forge-out")
  .option("--budget <usd>", "max total cost in USD", "3.00")
  .option("--dry-run", "print plan without executing", false)
  .action(async (prompt: string, opts: { targetDir: string; budget: string; dryRun: boolean }) => {
    try {
      await runForge({
        prompt,
        targetDir: path.resolve(opts.targetDir),
        budgetUsd: parseFloat(opts.budget),
        dryRun: opts.dryRun,
      });
    } catch (e) {
      console.error(chalk.red("Run failed:"), (e as Error).message);
      process.exit(1);
    }
  });

program
  .command("plan")
  .description("Print the routing plan for a prompt without executing")
  .argument("<prompt>")
  .option("--target-dir <dir>", "where the project would be written", "./forge-out")
  .option("--budget <usd>", "max total cost in USD", "3.00")
  .action(async (prompt: string, opts: { targetDir: string; budget: string }) => {
    await runForge({
      prompt,
      targetDir: path.resolve(opts.targetDir),
      budgetUsd: parseFloat(opts.budget),
      dryRun: true,
    });
  });

program
  .command("resume")
  .description("Resume a run from its last checkpoint")
  .argument("<run-id>")
  .option("--target-dir <dir>", "project dir", "./forge-out")
  .option("--budget <usd>", "max total cost in USD", "3.00")
  .action(async (runId: string, opts: { targetDir: string; budget: string }) => {
    await runForge({
      prompt: "",
      targetDir: path.resolve(opts.targetDir),
      budgetUsd: parseFloat(opts.budget),
      resumeRunId: runId,
    });
  });

program
  .command("models")
  .description("List the model registry")
  .action(() => {
    console.log(chalk.bold("Model registry:"));
    for (const m of MODELS) {
      console.log(
        `  ${m.id.padEnd(7)} ${m.apiId.padEnd(30)} in=$${m.costPer1MIn}/Mtok  out=$${m.costPer1MOut}/Mtok  strengths=${m.strengths.join(",")}`
      );
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
      console.log(`${e.ts} [${e.kind}] ${e.nodeId ?? ""} ${e.modelId ?? e.tool ?? ""}${toks}${cost} ${e.message ?? ""}`);
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
      if (e.kind !== "model_call" || !e.modelId) continue;
      const cur = byModel.get(e.modelId) ?? { cost: 0, calls: 0, in: 0, out: 0 };
      cur.cost += e.costUsd ?? 0;
      cur.calls += 1;
      cur.in += e.tokensIn ?? 0;
      cur.out += e.tokensOut ?? 0;
      byModel.set(e.modelId, cur);
      total += e.costUsd ?? 0;
    }
    console.log(chalk.bold(`Cost for run ${runId}:`));
    for (const [m, v] of byModel) {
      console.log(`  ${m.padEnd(7)} calls=${v.calls}  in=${v.in}  out=${v.out}  $${v.cost.toFixed(4)}`);
    }
    console.log(chalk.bold(`  TOTAL: $${total.toFixed(4)}`));
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

program.parseAsync(process.argv);
