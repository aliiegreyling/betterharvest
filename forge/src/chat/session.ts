import chalk from "chalk";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { runForge } from "../runner.js";
import { ContextBudget } from "../types.js";
import { getModel, MODELS } from "../models/registry.js";
import { readAudit, readPlan, listRuns } from "../run/state.js";
import { checkCli } from "../util/check-cli.js";
import { listAdapters } from "../cli-adapters/index.js";
import { detectProjectContext, formatProjectContext } from "../project/context.js";
import { checkMcpHealth, discoverMcpServers } from "../mcp/registry.js";
import { buildStatusText, createBrownfieldWorkPlan, createDesignArtifact, refreshContext } from "../project/commands.js";
import { runCli } from "../agents/cli-runner.js";

interface ChatDefaults {
  targetDir: string;
  contextBudget: ContextBudget;
  bmad: boolean;
  skipDoctor: boolean;
  model?: string;
  coder?: string;
}

interface ChatSession {
  lastPrompt?: string;
  messages: ChatMessage[];
  defaults: ChatDefaults;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FlowArgs {
  prompt?: string;
  targetDir: string;
  contextBudget: ContextBudget;
  bmad: boolean;
  skipDoctor: boolean;
  dryRun: boolean;
  model?: string;
  coder?: string;
}

const HELP = [
  "Forge chat commands:",
  "",
  "  /help                         Show commands",
  "  /exit                         Leave chat",
  "  /show                         Show current chat defaults and captured request",
  "  /set <key> <value>             Set target-dir, model, coder, context-budget, bmad, or skip-doctor",
  "  /request <text>                Capture a project request without calling a model",
  "  /clear                        Clear captured request",
  "  /ask <message>                 Chat with the selected model",
  "",
  "  /plan [prompt]                 Build a dry-run routing plan",
  "  /new [prompt]                  Execute a project build or maintenance flow",
  "  /resume <run-id>               Resume a run",
  "  /status                       Show project, BMAD, Serena, MCP, and Forge context",
  "  /context [show|refresh]        Show or refresh BMAD context artifact",
  "  /mcp [list|health]             Inspect MCP configuration",
  "  /inspect <topic>               Inspect project context for a topic",
  "  /design <domain> <prompt>      Write a BMAD design artifact",
  "  /work [request]                Write a brownfield work-plan artifact",
  "  /models                       List model registry",
  "  /runs                         List recent runs",
  "  /log <run-id>                 Print run audit log",
  "  /cost <run-id>                Print run cost summary",
  "",
  "Plain text chats with the selected model and also becomes the current request.",
  "Use /request when you only want to capture a project idea without spending tokens.",
  "Flow flags: --target-dir <dir>, --model <id>, --coder <id>, --context-budget <low|standard|deep>, --bmad, --skip-doctor.",
].join("\n");

export async function startChat(): Promise<void> {
  const session: ChatSession = {
    messages: [],
    defaults: {
      targetDir: "./forge-out",
      contextBudget: "standard",
      bmad: false,
      skipDoctor: false,
    },
  };

  console.log(chalk.bold("Forge chat"));
  console.log(chalk.dim("Type /help for commands. Plain text chats with the selected model."));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: process.stdin.isTTY ? "forge> " : undefined,
  });

  if (process.stdin.isTTY) rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    try {
      const keepGoing = await handleChatLine(line, session);
      if (!keepGoing) break;
    } catch (e) {
      console.error(chalk.red("Chat command failed:"), (e as Error).message);
    }
    if (process.stdin.isTTY) rl.prompt();
  }

  rl.close();
}

async function handleChatLine(line: string, session: ChatSession): Promise<boolean> {
  if (!line) return true;

  if (!line.startsWith("/")) {
    session.lastPrompt = line;
    await runChatTurn(session, line);
    return true;
  }

  const [commandToken, ...args] = tokenize(line);
  const command = commandToken.slice(1).toLowerCase();

  switch (command) {
    case "?":
    case "help":
      console.log(HELP);
      return true;
    case "exit":
    case "quit":
      return false;
    case "show":
      showSession(session);
      return true;
    case "clear":
      session.lastPrompt = undefined;
      session.messages = [];
      console.log(chalk.green("Captured request cleared."));
      return true;
    case "set":
      setDefault(session, args);
      return true;
    case "request":
      captureRequest(session, args);
      return true;
    case "ask":
      await runAskCommand(session, args);
      return true;
    case "plan":
      await runPlanCommand(session, args);
      return true;
    case "new":
      await runNewCommand(session, args);
      return true;
    case "resume":
      await runResumeCommand(session, args);
      return true;
    case "status":
      console.log(buildStatusText());
      return true;
    case "context":
      runContextCommand(args);
      return true;
    case "mcp":
      runMcpCommand(args);
      return true;
    case "inspect":
      runInspectCommand(args);
      return true;
    case "design":
      runDesignCommand(args);
      return true;
    case "work":
      runWorkCommand(session, args);
      return true;
    case "models":
      showModels();
      return true;
    case "runs":
      showRuns();
      return true;
    case "log":
      showLog(args);
      return true;
    case "cost":
      showCost(args);
      return true;
    default:
      console.log(chalk.yellow(`Unknown command: /${command}. Type /help for available commands.`));
      return true;
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\(["'])/g, "$1"));
  }
  return tokens;
}

async function runAskCommand(session: ChatSession, args: string[]): Promise<void> {
  const message = args.join(" ").trim();
  if (!message) throw new Error("Usage: /ask <message>");
  session.lastPrompt = message;
  await runChatTurn(session, message);
}

async function runChatTurn(session: ChatSession, message: string): Promise<void> {
  const modelId = session.defaults.model ?? "sonnet";
  validateModel(modelId);
  const projectContext = formatProjectContext(detectProjectContext(), { portable: true });
  const history = session.messages.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  const prompt = [
    "You are Forge, a BMAD-aware agentic CLI harness assistant.",
    "Answer conversationally and concisely. If the user is ready to create, modify, design, or deploy a project, recommend the exact slash command to continue.",
    "Do not execute project changes from chat prose; slash commands drive operations.",
    "",
    "Current project context:",
    "```text",
    projectContext,
    "```",
    history ? ["", "Recent chat:", history].join("\n") : undefined,
    "",
    "USER MESSAGE:",
    message,
  ].filter((line): line is string => line !== undefined).join("\n");

  console.log(chalk.dim(`model: ${modelId}`));
  const res = await runCli({
    modelId,
    prompt,
    cwd: process.cwd(),
    allowedTools: [],
    chatOnly: true,
    timeoutMs: 120_000,
  });

  if (!res.ok) {
    throw new Error(`Model chat failed (exit ${res.exitCode}): ${(res.stderr || res.finalText).slice(-500)}`);
  }

  const answer = res.finalText.trim();
  session.messages.push({ role: "user", content: message });
  session.messages.push({ role: "assistant", content: answer });
  console.log(answer);
}

function captureRequest(session: ChatSession, args: string[]): void {
  const request = args.join(" ").trim();
  if (!request) throw new Error("Usage: /request <project request>");
  session.lastPrompt = request;
  console.log(chalk.green("Captured request. Use /plan to inspect routing or /new to execute."));
}

async function runPlanCommand(session: ChatSession, args: string[]): Promise<void> {
  const flow = parseFlowArgs(session, args, true);
  const prompt = resolvePrompt(session, flow.prompt);
  session.lastPrompt = prompt;
  if (!flow.skipDoctor) await doctor();
  validateModel(flow.model);
  validateModel(flow.coder);
  await runForge({
    prompt,
    targetDir: path.resolve(flow.targetDir),
    coder: flow.coder,
    dryRun: true,
    modelOverride: flow.model,
    contextBudget: flow.contextBudget,
    bmadOutput: flow.bmad,
  });
}

async function runNewCommand(session: ChatSession, args: string[]): Promise<void> {
  const flow = parseFlowArgs(session, args, false);
  const prompt = resolvePrompt(session, flow.prompt);
  session.lastPrompt = prompt;
  if (!flow.skipDoctor) await doctor();
  validateModel(flow.model);
  validateModel(flow.coder);
  await runForge({
    prompt,
    targetDir: path.resolve(flow.targetDir),
    coder: flow.coder,
    dryRun: flow.dryRun,
    modelOverride: flow.model,
    contextBudget: flow.contextBudget,
    bmadOutput: flow.bmad,
  });
}

async function runResumeCommand(session: ChatSession, args: string[]): Promise<void> {
  const runId = args.find((arg) => !arg.startsWith("--"));
  if (!runId) throw new Error("Usage: /resume <run-id> [--target-dir <dir>] [--skip-doctor]");
  const flow = parseFlowArgs(session, args.filter((arg) => arg !== runId), false);
  if (!flow.skipDoctor) await doctor();
  await runForge({ prompt: "", targetDir: path.resolve(flow.targetDir), resumeRunId: runId });
}

function parseFlowArgs(session: ChatSession, args: string[], forceDryRun: boolean): FlowArgs {
  const result: FlowArgs = {
    targetDir: session.defaults.targetDir,
    contextBudget: session.defaults.contextBudget,
    bmad: session.defaults.bmad,
    skipDoctor: session.defaults.skipDoctor,
    dryRun: forceDryRun,
    model: session.defaults.model,
    coder: session.defaults.coder,
  };
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--target-dir") result.targetDir = requireValue(args, ++i, arg);
    else if (arg === "--model") result.model = requireValue(args, ++i, arg);
    else if (arg === "--coder") result.coder = requireValue(args, ++i, arg);
    else if (arg === "--context-budget") result.contextBudget = parseContextBudget(requireValue(args, ++i, arg));
    else if (arg === "--bmad") result.bmad = true;
    else if (arg === "--no-bmad") result.bmad = false;
    else if (arg === "--skip-doctor") result.skipDoctor = true;
    else if (arg === "--doctor") result.skipDoctor = false;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    else promptParts.push(arg);
  }

  result.prompt = promptParts.join(" ").trim() || undefined;
  return result;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function resolvePrompt(session: ChatSession, prompt?: string): string {
  const resolved = prompt ?? session.lastPrompt;
  if (!resolved) throw new Error("No request captured. Type a request first or pass one after the command.");
  return resolved;
}

function setDefault(session: ChatSession, args: string[]): void {
  const [key, ...rest] = args;
  const value = rest.join(" ");
  if (!key || !value) {
    throw new Error("Usage: /set <target-dir|model|coder|context-budget|bmad|skip-doctor> <value>");
  }

  switch (key) {
    case "target-dir":
      session.defaults.targetDir = value;
      break;
    case "model":
      validateModel(value);
      session.defaults.model = value === "none" ? undefined : value;
      break;
    case "coder":
      validateModel(value);
      session.defaults.coder = value === "none" ? undefined : value;
      break;
    case "context-budget":
      session.defaults.contextBudget = parseContextBudget(value);
      break;
    case "bmad":
      session.defaults.bmad = parseBoolean(value, key);
      break;
    case "skip-doctor":
      session.defaults.skipDoctor = parseBoolean(value, key);
      break;
    default:
      throw new Error(`Unknown setting: ${key}`);
  }

  console.log(chalk.green(`Set ${key} = ${value}`));
}

function parseBoolean(value: string, key: string): boolean {
  if (["true", "on", "yes", "1"].includes(value.toLowerCase())) return true;
  if (["false", "off", "no", "0"].includes(value.toLowerCase())) return false;
  throw new Error(`${key} must be true/false, on/off, yes/no, or 1/0`);
}

function runContextCommand(args: string[]): void {
  const action = args[0] ?? "show";
  if (action === "refresh") {
    const file = refreshContext();
    console.log(chalk.green(`Context artifact written: ${file}`));
    return;
  }
  if (action !== "show") throw new Error("Usage: /context [show|refresh]");
  console.log(buildStatusText());
}

function runMcpCommand(args: string[]): void {
  const action = args[0] ?? "list";
  const ctx = detectProjectContext();
  const servers = discoverMcpServers(ctx);
  if (servers.length === 0) {
    console.log(chalk.yellow("No MCP servers discovered."));
    return;
  }

  if (action === "list") {
    for (const s of servers) {
      const endpoint = s.type === "http" ? s.url : [s.command, ...(s.args ?? [])].filter(Boolean).join(" ");
      console.log(`${s.name.padEnd(16)} ${s.type.padEnd(5)} ${s.enabled ? "enabled " : "disabled"} risk=${s.risk.padEnd(6)} ${endpoint ?? ""}`);
      console.log(chalk.dim(`  source: ${s.source}`));
    }
    return;
  }

  if (action === "health") {
    for (const s of servers) {
      const h = checkMcpHealth(ctx, s);
      console.log(`${h.ok ? chalk.green("OK") : chalk.yellow("WARN")} ${h.name}: ${h.message}`);
    }
    return;
  }

  throw new Error("Usage: /mcp [list|health]");
}

function runInspectCommand(args: string[]): void {
  const topic = args.join(" ").trim();
  if (!topic) throw new Error("Usage: /inspect <topic>");
  const ctx = detectProjectContext();
  console.log(chalk.bold(`Inspect: ${topic}`));
  console.log(formatProjectContext(ctx));
  if (ctx.hasSerena) {
    console.log(chalk.dim("Serena project detected. Semantic MCP lookup will be used once MCP tool execution is wired into Forge."));
  } else {
    console.log(chalk.yellow("Serena project not detected."));
  }
}

function runDesignCommand(args: string[]): void {
  const [domain, ...promptParts] = args;
  const prompt = promptParts.join(" ").trim();
  if (!domain || !prompt) throw new Error("Usage: /design <domain> <prompt>");
  const file = createDesignArtifact(domain, prompt);
  console.log(chalk.green(`Design artifact written: ${file}`));
}

function runWorkCommand(session: ChatSession, args: string[]): void {
  const request = args.join(" ").trim() || session.lastPrompt;
  if (!request) throw new Error("No work request captured. Type a request first or pass one after /work.");
  session.lastPrompt = request;
  const file = createBrownfieldWorkPlan(request);
  console.log(chalk.green(`Brownfield work plan written: ${file}`));
}

function showSession(session: ChatSession): void {
  console.log(chalk.bold("Chat session"));
  console.log(`  request: ${session.lastPrompt ?? "(none)"}`);
  console.log(`  target-dir: ${session.defaults.targetDir}`);
  console.log(`  model: ${session.defaults.model ?? "(auto)"}`);
  console.log(`  coder: ${session.defaults.coder ?? "(auto)"}`);
  console.log(`  context-budget: ${session.defaults.contextBudget}`);
  console.log(`  bmad: ${session.defaults.bmad}`);
  console.log(`  skip-doctor: ${session.defaults.skipDoctor}`);
}

function showModels(): void {
  console.log(chalk.bold("Model registry:"));
  for (const m of MODELS) {
    console.log(`  ${m.id.padEnd(7)} cli=${m.cli.padEnd(7)} flag=${m.cliModelFlag.padEnd(16)} strengths=${m.strengths.join(",")}`);
    if (m.notes) console.log(chalk.dim(`           ${m.notes}`));
  }
}

function showRuns(): void {
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
}

function showLog(args: string[]): void {
  const runId = args[0];
  if (!runId) throw new Error("Usage: /log <run-id>");
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
}

function showCost(args: string[]): void {
  const runId = args[0];
  if (!runId) throw new Error("Usage: /cost <run-id>");
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
  console.log(chalk.dim("  (Codex CLI typically does not report cost - those calls show $0.)"));
}

async function doctor(verbose = false): Promise<void> {
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
    throw new Error("claude CLI is required. Install Claude Code: https://claude.com/claude-code");
  }
}

function validateModel(model?: string): void {
  if (!model || model === "none") return;
  getModel(model);
}

function parseContextBudget(value: string): ContextBudget {
  if (value === "low" || value === "standard" || value === "deep") return value;
  throw new Error(`Invalid context budget '${value}'. Expected low, standard, or deep.`);
}
