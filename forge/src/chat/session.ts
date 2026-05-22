import chalk from "chalk";
import { createInterface, Interface } from "node:readline";
import path from "node:path";
import { ApprovalDecision, ApprovalPrompt, PhaseDecision, PhasePrompt, runForge } from "../runner.js";
import { ContextBudget } from "../types.js";
import { formatModelIdList, getModel, MODELS } from "../models/registry.js";
import { readAudit, readPlan, listRuns } from "../run/state.js";
import { checkCli } from "../util/check-cli.js";
import { listAdapters } from "../cli-adapters/index.js";
import { detectProjectContext, formatProjectContext } from "../project/context.js";
import { checkMcpHealth, discoverMcpServers } from "../mcp/registry.js";
import { buildStatusText, createDesignArtifact, refreshContext } from "../project/commands.js";
import { runCli } from "../agents/cli-runner.js";
import { debugLog, printUserError, verboseEnabled } from "../util/diagnostics.js";

interface ChatDefaults {
  targetDir: string;
  contextBudget: ContextBudget;
  bmad: boolean;
  skipDoctor: boolean;
  debug: boolean;
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
  confirmPhases: boolean;
  approvalGates: boolean;
  model?: string;
  coder?: string;
}

interface ChatRuntime {
  canPrompt: boolean;
  ask(query: string): Promise<string>;
}

const HELP = [
  "Forge chat commands:",
  "",
  "  /help                         Show commands",
  "  /exit                         Leave chat",
  "  /show                         Show current chat defaults and captured request",
  "  /set <key> <value>             Set target-dir, model, coder, context-budget, bmad, skip-doctor, or debug",
  "  /request <text>                Capture a project request without calling a model",
  "  /clear                        Clear captured request",
  "  /ask <message>                 Chat with the selected model",
  "",
  "  /plan [prompt]                 Build a dry-run routing plan",
  "  /new [prompt]                  Start a guided project creation journey",
  "  /resume <run-id>               Resume a run",
  "  /doctor                       Check required CLIs",
  "  /status                       Show project, BMAD, Serena, MCP, and Forge context",
  "  /context [show|refresh]        Show or refresh BMAD context artifact",
  "  /mcp [list|health]             Inspect MCP configuration",
  "  /inspect <topic>               Inspect project context for a topic",
  "  /design <domain> <prompt>      Write a BMAD design artifact",
  "  /work [request]                Iterate on the existing target project",
  "  /models                       List model registry",
  "  /runs                         List recent runs",
  "  /log <run-id>                 Print run audit log",
  "  /cost <run-id>                Print run cost summary",
  "",
  "Plain text chats with the selected model and also becomes the current request.",
  "Use /request when you only want to capture a project idea without spending tokens.",
  `Models: ${formatModelIdList()} (use /models for details, /set model auto to use the default).`,
  "/new starts with setup prompts in an interactive terminal. Choose step mode to add guidance before each agent phase.",
  "Flow flags: --target-dir <dir>, --model <id>, --coder <id>, --context-budget <low|standard|deep>, --bmad, --skip-doctor, --auto, --step, --plan-only, --no-approval-gates.",
].join("\n");

function printChatWelcome(session: ChatSession): void {
  console.log(chalk.bold("Forge chat"));
  console.log(chalk.dim("Commands: /help, /request, /plan, /new, /models, /status, /exit"));
  console.log(chalk.dim(`Models: ${formatModelIdList()} · selected: ${session.defaults.model ?? "sonnet"} · coder: ${session.defaults.coder ?? "auto"}`));
  console.log(chalk.dim("Plain text chats with the selected model."));
}

export async function startChat(opts: { debug?: boolean } = {}): Promise<void> {
  const session: ChatSession = {
    messages: [],
    defaults: {
      targetDir: "./forge-out",
      contextBudget: "standard",
      bmad: false,
      skipDoctor: false,
      debug: verboseEnabled(opts.debug),
    },
  };

  printChatWelcome(session);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
    historySize: 100,
    removeHistoryDuplicates: true,
    escapeCodeTimeout: 50,
  });
  rl.setPrompt("forge> ");
  rl.on("SIGINT", () => {
    console.log(chalk.dim("\nUse /exit to leave Forge chat."));
    if (process.stdin.isTTY) rl.prompt();
  });
  const runtime: ChatRuntime = {
    canPrompt: Boolean(process.stdin.isTTY),
    ask: async (query) => (await askQuestion(rl, query)) ?? "",
  };

  while (true) {
    const raw = await askQuestion(rl, process.stdin.isTTY ? "forge> " : "");
    if (raw === undefined) break;
    const line = normalizeLineEditing(raw).trim();
    let keepGoing = true;
    try {
      debugLog("chat", "handling line", { line: redactLine(line) }, session.defaults.debug);
      keepGoing = await handleChatLine(line, session, runtime);
    } catch (e) {
      printUserError(e, { command: line.startsWith("/") ? line.split(/\s+/)[0] : "chat", verbose: session.defaults.debug });
    }
    if (!keepGoing) break;
  }

  rl.close();
}

async function handleChatLine(line: string, session: ChatSession, runtime: ChatRuntime): Promise<boolean> {
  if (!line) return true;

  if (!line.startsWith("/")) {
    session.lastPrompt = line;
    await runChatTurn(session, line);
    return true;
  }

  const [commandToken, ...args] = tokenize(line);
  if (!commandToken || commandToken === "/") {
    console.log(chalk.yellow("Empty command. Type /help for available commands."));
    return true;
  }
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
      await runNewCommand(session, args, runtime);
      return true;
    case "resume":
      await runResumeCommand(session, args);
      return true;
    case "doctor":
      await doctor(true);
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
      await runWorkCommand(session, args, runtime);
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

function normalizeLineEditing(input: string): string {
  const chars: string[] = [];
  for (const ch of Array.from(input)) {
    if (ch === "\b" || ch === "\x7f") {
      chars.pop();
      continue;
    }
    if (ch === "\x15") {
      chars.length = 0;
      continue;
    }
    chars.push(ch);
  }
  return chars.join("");
}

async function askQuestion(rl: Interface, query: string): Promise<string | undefined> {
  const answer = await new Promise<string | undefined>((resolve) => {
    let settled = false;
    const cleanup = () => {
      rl.off("close", onClose);
    };
    const onClose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(undefined);
    };
    rl.once("close", onClose);
    rl.question(query, (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(normalizeLineEditing(value));
    });
  });
  return answer;
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
  debugLog("chat", "starting model turn", { modelId, messageLength: message.length }, session.defaults.debug);
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
    verbose: session.defaults.debug,
  });

  if (!res.ok) {
    throw new Error(`Model chat failed (exit ${res.exitCode}): ${(res.stderr || res.finalText).slice(-500)}`);
  }

  const answer = res.finalText.trim();
  session.messages.push({ role: "user", content: message });
  session.messages.push({ role: "assistant", content: answer });
  debugLog("chat", "model turn completed", { modelId, durationMs: res.durationMs, tokensIn: res.tokensIn, tokensOut: res.tokensOut }, session.defaults.debug);
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
  debugLog("chat", "running /plan", summarizeFlow(flow, prompt), session.defaults.debug);
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

async function runNewCommand(session: ChatSession, args: string[], runtime: ChatRuntime): Promise<void> {
  let flow = parseFlowArgs(session, args, false);
  let prompt = resolvePrompt(session, flow.prompt);
  ({ flow, prompt } = await prepareNewJourney(session, flow, prompt, args, runtime));
  session.lastPrompt = prompt;
  debugLog("chat", "running /new", summarizeFlow(flow, prompt), session.defaults.debug);
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
    beforePhase: flow.confirmPhases ? (phase) => askPhaseDecision(runtime, phase) : undefined,
    approvalGates: flow.approvalGates,
    requestApproval: flow.approvalGates ? (approval) => askApprovalDecision(runtime, approval) : undefined,
  });
}

async function prepareNewJourney(
  session: ChatSession,
  flow: FlowArgs,
  prompt: string,
  args: string[],
  runtime: ChatRuntime
): Promise<{ flow: FlowArgs; prompt: string }> {
  const explicitMode = args.includes("--auto") || args.includes("--yes") || args.includes("--step") || args.includes("--plan-only") || args.includes("--dry-run");
  if (!runtime.canPrompt || explicitMode) return { flow, prompt };

  console.log(chalk.bold("\nNew project journey"));
  console.log(chalk.dim("Answer the setup prompts first. Agent execution starts after confirmation."));

  const editedPrompt = await askWithDefault(runtime, "Project request", prompt);
  const targetDir = await askWithDefault(runtime, "Target directory", flow.targetDir);
  const contextBudget = await askWithDefault(runtime, "Context budget (low|standard|deep)", flow.contextBudget);
  console.log(chalk.dim(`Available models: ${formatModelIdList()} (use auto for router defaults).`));
  const model = await askWithDefault(runtime, `Planning model (auto|${formatModelIdList("|")})`, flow.model ?? "auto");
  const coder = await askWithDefault(runtime, `Development model (auto|${formatModelIdList("|")})`, flow.coder ?? "auto");
  const mode = (await askWithDefault(runtime, "Run mode (step|auto|plan|cancel)", "step")).toLowerCase();

  if (mode === "cancel" || mode === "c") throw new Error("Project creation cancelled before execution.");
  if (mode !== "step" && mode !== "auto" && mode !== "plan") {
    throw new Error("Invalid run mode. Expected step, auto, plan, or cancel.");
  }

  const nextFlow: FlowArgs = {
    ...flow,
    targetDir,
    contextBudget: parseContextBudget(contextBudget),
    model: parseOptionalModel(model),
    coder: parseOptionalModel(coder),
    dryRun: mode === "plan",
    confirmPhases: mode === "step",
    approvalGates: flow.approvalGates,
  };

  if (session.defaults.bmad) {
    const bmad = await askWithDefault(runtime, "Write BMAD artifacts? (yes|no)", nextFlow.bmad ? "yes" : "no");
    nextFlow.bmad = parseBoolean(bmad, "bmad");
  }

  console.log(chalk.dim(
    nextFlow.dryRun
      ? "Plan mode selected. Forge will classify and print the routing plan only."
      : nextFlow.confirmPhases
        ? "Step mode selected. Forge will pause before each phase for optional guidance."
        : "Auto mode selected. Forge will run all phases without additional prompts."
  ));

  return { flow: nextFlow, prompt: editedPrompt };
}

async function askPhaseDecision(runtime: ChatRuntime, phase: PhasePrompt): Promise<PhaseDecision> {
  console.log(chalk.bold(`\n${phase.name} setup`));
  console.log(chalk.dim(`Phase ${phase.idx}/10 · role=${phase.node.role} · model=${phase.node.modelId}`));
  console.log(chalk.dim("Press Enter to run, type guidance for this phase, or use /skip or /abort."));
  const answer = await runtime.ask(`${phase.name}> `);
  const normalized = answer.trim();

  if (!normalized) return { action: "run" };
  if (normalized === "/skip") return { action: "skip" };
  if (normalized === "/abort" || normalized === "/cancel") return { action: "abort" };
  return { action: "run", note: normalized };
}

async function askApprovalDecision(runtime: ChatRuntime, approval: ApprovalPrompt): Promise<ApprovalDecision> {
  console.log(chalk.bold(`\n${approval.gateLabel}`));
  console.log(chalk.dim(`Approver: ${approval.approverRole} · revision ${approval.revision}/${approval.maxRevisionCycles}`));
  if (approval.expectedArtifacts.length > 0) {
    console.log(chalk.dim(`Review artifacts: ${approval.expectedArtifacts.join(", ")}`));
  }
  console.log(chalk.dim("Type approve, changes, or abort. Any other non-empty text is treated as a change request."));

  while (true) {
    const answer = (await runtime.ask(`${approval.approverRole}> `)).trim();
    const normalized = answer.toLowerCase();
    if (["approve", "a"].includes(normalized)) return { action: "approve" };
    if (["abort", "cancel", "q"].includes(normalized)) return { action: "abort" };
    if (["changes", "change", "c", "request-changes"].includes(normalized)) {
      const note = (await runtime.ask("Change request: ")).trim();
      return { action: "changes", note };
    }
    if (answer) return { action: "changes", note: answer };
    console.log(chalk.yellow("Expected approve, changes, or abort."));
  }
}

async function askWithDefault(runtime: ChatRuntime, label: string, defaultValue: string): Promise<string> {
  const answer = await runtime.ask(`${label} [${defaultValue}]: `);
  return answer.trim() || defaultValue;
}

async function runResumeCommand(session: ChatSession, args: string[]): Promise<void> {
  const runId = args.find((arg) => !arg.startsWith("--"));
  if (!runId) throw new Error("Usage: /resume <run-id> [--target-dir <dir>] [--skip-doctor]");
  const flow = parseFlowArgs(session, args.filter((arg) => arg !== runId), false);
  debugLog("chat", "running /resume", { runId, targetDir: flow.targetDir, skipDoctor: flow.skipDoctor }, session.defaults.debug);
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
    confirmPhases: false,
    approvalGates: true,
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
    else if (arg === "--plan-only") result.dryRun = true;
    else if (arg === "--no-approval-gates") result.approvalGates = false;
    else if (arg === "--approval-gates") result.approvalGates = true;
    else if (arg === "--step") result.confirmPhases = true;
    else if (arg === "--auto" || arg === "--yes") result.confirmPhases = false;
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
    throw new Error("Usage: /set <target-dir|model|coder|context-budget|bmad|skip-doctor|debug> <value>");
  }

  switch (key) {
    case "target-dir":
      session.defaults.targetDir = value;
      break;
    case "model":
      session.defaults.model = parseOptionalModel(value);
      break;
    case "coder":
      session.defaults.coder = parseOptionalModel(value);
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
    case "debug":
      session.defaults.debug = parseBoolean(value, key);
      break;
    default:
      throw new Error(`Unknown setting: ${key}`);
  }

  console.log(chalk.green(`Set ${key} = ${displaySettingValue(key, value, session)}`));
}

function parseOptionalModel(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (["auto", "default", "none"].includes(normalized)) return undefined;
  validateModel(normalized);
  return normalized;
}

function displaySettingValue(key: string, inputValue: string, session: ChatSession): string {
  if (key === "model") return session.defaults.model ?? "auto";
  if (key === "coder") return session.defaults.coder ?? "auto";
  return inputValue;
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

async function runWorkCommand(session: ChatSession, args: string[], runtime: ChatRuntime): Promise<void> {
  const flow = parseFlowArgs(session, args, false);
  const request = resolvePrompt(session, flow.prompt);
  session.lastPrompt = request;
  debugLog("chat", "running /work", summarizeFlow(flow, request), session.defaults.debug);
  if (!flow.skipDoctor) await doctor();
  validateModel(flow.model);
  validateModel(flow.coder);
  await runForge({
    prompt: request,
    targetDir: path.resolve(flow.targetDir),
    mode: "work",
    coder: flow.coder,
    dryRun: flow.dryRun,
    modelOverride: flow.model,
    contextBudget: flow.contextBudget,
    bmadOutput: flow.bmad,
    beforePhase: flow.confirmPhases ? (phase) => askPhaseDecision(runtime, phase) : undefined,
    approvalGates: flow.approvalGates,
    requestApproval: flow.approvalGates ? (approval) => askApprovalDecision(runtime, approval) : undefined,
  });
}

function showSession(session: ChatSession): void {
  console.log(chalk.bold("Chat session"));
  console.log(`  request: ${session.lastPrompt ?? "(none)"}`);
  console.log(`  target-dir: ${session.defaults.targetDir}`);
  console.log(`  model: ${session.defaults.model ?? "(auto)"}`);
  console.log(`  coder: ${session.defaults.coder ?? "(auto)"}`);
  console.log(`  available models: ${formatModelIdList()}`);
  console.log(`  context-budget: ${session.defaults.contextBudget}`);
  console.log(`  bmad: ${session.defaults.bmad}`);
  console.log(`  skip-doctor: ${session.defaults.skipDoctor}`);
  console.log(`  debug: ${session.defaults.debug}`);
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
  debugLog("doctor", "checking CLI adapters", undefined, verbose);
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

function summarizeFlow(flow: FlowArgs, prompt: string): object {
  return {
    targetDir: flow.targetDir,
    contextBudget: flow.contextBudget,
    bmad: flow.bmad,
    skipDoctor: flow.skipDoctor,
    dryRun: flow.dryRun,
    confirmPhases: flow.confirmPhases,
    approvalGates: flow.approvalGates,
    model: flow.model ?? "(auto)",
    coder: flow.coder ?? "(auto)",
    promptLength: prompt.length,
  };
}

function redactLine(line: string): string {
  return line.replace(/(password|token|secret|key)=\S+/gi, "$1=<redacted>");
}

function validateModel(model?: string): void {
  if (!model || model === "none") return;
  getModel(model);
}

function parseContextBudget(value: string): ContextBudget {
  if (value === "low" || value === "standard" || value === "deep") return value;
  throw new Error(`Invalid context budget '${value}'. Expected low, standard, or deep.`);
}
