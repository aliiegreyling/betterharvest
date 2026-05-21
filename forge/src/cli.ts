#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { runForge } from "./runner.js";
import { getModel, MODELS } from "./models/registry.js";
import { readAudit, readPlan, listRuns } from "./run/state.js";
import { checkCli } from "./util/check-cli.js";
import { listAdapters } from "./cli-adapters/index.js";
import { detectProjectContext, formatProjectContext } from "./project/context.js";
import { checkMcpHealth, discoverMcpServers } from "./mcp/registry.js";
import { buildStatusText, createBrownfieldWorkPlan, createDesignArtifact, refreshContext } from "./project/commands.js";

const program = new Command();
program.name("forge").description("Agentic CLI that builds projects via Claude Code & Codex CLIs").version("0.3.0");

program
  .command("new")
  .description("Build a new project from a prompt")
  .argument("<prompt>", "natural-language description of the project to build")
  .option("--target-dir <dir>", "where to write the generated project", "./forge-out")
  .option("--coder <model>", "override the impl phase model (e.g. codex, opus)")
  .option("--model <id>", "override model for non-verification phases")
  .option("--context-budget <mode>", "context budget: low, standard, deep", "standard")
  .option("--bmad", "write plan metadata to BMAD planning artifacts", false)
  .option("--dry-run", "print plan without executing", false)
  .option("--skip-doctor", "skip CLI availability check", false)
  .action(async (
    prompt: string,
    opts: { targetDir: string; coder?: string; model?: string; contextBudget: string; bmad: boolean; dryRun: boolean; skipDoctor: boolean }
  ) => {
    if (!opts.skipDoctor) await doctor();
    try {
      validateModel(opts.model);
      validateModel(opts.coder);
      await runForge({
        prompt,
        targetDir: path.resolve(opts.targetDir),
        coder: opts.coder,
        dryRun: opts.dryRun,
        modelOverride: opts.model,
        contextBudget: parseContextBudget(opts.contextBudget),
        bmadOutput: opts.bmad,
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
  .option("--coder <model>", "override the impl phase model (e.g. codex, opus)")
  .option("--model <id>", "override model for non-verification phases")
  .option("--context-budget <mode>", "context budget: low, standard, deep", "standard")
  .option("--bmad", "write plan metadata to BMAD planning artifacts", false)
  .option("--skip-doctor", "skip CLI availability check", false)
  .action(async (
    prompt: string,
    opts: { targetDir: string; coder?: string; model?: string; contextBudget: string; bmad: boolean; skipDoctor: boolean }
  ) => {
    if (!opts.skipDoctor) await doctor();
    validateModel(opts.model);
    validateModel(opts.coder);
    await runForge({
      prompt,
      targetDir: path.resolve(opts.targetDir),
      coder: opts.coder,
      dryRun: true,
      modelOverride: opts.model,
      contextBudget: parseContextBudget(opts.contextBudget),
      bmadOutput: opts.bmad,
    });
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
  .command("status")
  .description("Show project, BMAD, Serena, MCP, and Forge context")
  .action(() => {
    console.log(buildStatusText());
  });

program
  .command("context")
  .description("Manage Forge context artifacts")
  .argument("[action]", "show|refresh", "show")
  .action((action: string) => {
    if (action === "refresh") {
      const file = refreshContext();
      console.log(chalk.green(`Context artifact written: ${file}`));
      return;
    }
    console.log(buildStatusText());
  });

const mcp = program.command("mcp").description("Inspect MCP server configuration");

mcp
  .command("list")
  .description("List discovered MCP servers")
  .action(() => {
    const ctx = detectProjectContext();
    const servers = discoverMcpServers(ctx);
    if (servers.length === 0) {
      console.log(chalk.yellow("No MCP servers discovered."));
      return;
    }
    for (const s of servers) {
      const endpoint = s.type === "http" ? s.url : [s.command, ...(s.args ?? [])].filter(Boolean).join(" ");
      console.log(`${s.name.padEnd(16)} ${s.type.padEnd(5)} ${s.enabled ? "enabled " : "disabled"} risk=${s.risk.padEnd(6)} ${endpoint ?? ""}`);
      console.log(chalk.dim(`  source: ${s.source}`));
    }
  });

mcp
  .command("health")
  .description("Check discovered MCP server configuration health")
  .action(() => {
    const ctx = detectProjectContext();
    const servers = discoverMcpServers(ctx);
    if (servers.length === 0) {
      console.log(chalk.yellow("No MCP servers discovered."));
      return;
    }
    for (const s of servers) {
      const h = checkMcpHealth(ctx, s);
      console.log(`${h.ok ? chalk.green("OK") : chalk.yellow("WARN")} ${h.name}: ${h.message}`);
    }
  });

program
  .command("inspect")
  .description("Inspect a topic using available project context; Serena semantic lookup is planned next")
  .argument("<topic>")
  .action((topic: string) => {
    const ctx = detectProjectContext();
    console.log(chalk.bold(`Inspect: ${topic}`));
    console.log(formatProjectContext(ctx));
    if (ctx.hasSerena) {
      console.log(chalk.dim("Serena project detected. Semantic MCP lookup will be used once MCP tool execution is wired into Forge."));
    } else {
      console.log(chalk.yellow("Serena project not detected."));
    }
  });

program
  .command("design")
  .description("Create a BMAD scaffold-domain design artifact")
  .argument("<domain>", "data|ux|backend|infra|frontend|deployment")
  .argument("<prompt>", "design prompt")
  .action((domain: string, prompt: string) => {
    const file = createDesignArtifact(domain, prompt);
    console.log(chalk.green(`Design artifact written: ${file}`));
  });

program
  .command("work")
  .description("Create a brownfield work plan artifact for an existing project")
  .argument("<request>")
  .action((request: string) => {
    const file = createBrownfieldWorkPlan(request);
    console.log(chalk.green(`Brownfield work plan written: ${file}`));
  });

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
    console.log(chalk.dim(`  (Codex CLI typically does not report cost - those calls show $0.)`));
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
        console.log(`  ${r} - ${p.prompt.slice(0, 60)}`);
      } catch {
        console.log(`  ${r}`);
      }
    }
  });

async function doctor(verbose = false) {
  const adapters = listAdapters();
  const results = await Promise.all(adapters.map(async (a) => ({ a, r: await checkCli(a.binName) })));
  const claudeRes = results.find((x) => x.a.name === "claude")?.r;

  if (verbose) {
    for (const { a, r } of results) {
      const tag = a.name === "claude" ? "required" : "optional";
      console.log(
        `  ${a.binName.padEnd(8)} CLI (${tag}): ${r.ok ? chalk.green("✓ " + r.version) : (a.name === "claude" ? chalk.red("✗ not found") : chalk.yellow("✗ not found"))}`
      );
    }
  } else if (!claudeRes?.ok) {
    console.log(`  claude CLI: ${chalk.red("✗ not found")}`);
  }

  if (!claudeRes?.ok) {
    console.error(chalk.red("\nclaude CLI is required. Install Claude Code: https://claude.com/claude-code"));
    process.exit(1);
  }
}

program.parseAsync(process.argv);

function validateModel(model?: string): void {
  if (!model) return;
  getModel(model);
}

function parseContextBudget(value: string): "low" | "standard" | "deep" {
  if (value === "low" || value === "standard" || value === "deep") return value;
  throw new Error(`Invalid context budget '${value}'. Expected low, standard, or deep.`);
}
