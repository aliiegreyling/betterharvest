import http, { ServerResponse } from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { MODELS } from "../models/registry.js";
import { runForge, RunOptions } from "../runner.js";
import { appendAudit, deleteRun, listCheckpoints, listRuns, loadCheckpoint, newRunId, readAudit, readPlan } from "../run/state.js";
import { ContextBudget, Plan, RoleGuide } from "../types.js";
import { ForgeRunEvent } from "../runtime/events.js";
import { runCli } from "../agents/cli-runner.js";
import { forgeOutputRoot } from "../project/output-paths.js";
import { crossProviderFallback, isCapacityOrContextFailure } from "../agents/router.js";

interface GuiServerOptions {
  host?: string;
  port?: number;
}

interface StartRunBody {
  prompt?: string;
  targetDir?: string;
  contextBudget?: ContextBudget;
  model?: string;
  coder?: string;
  allowCodexPlanning?: boolean;
  bmad?: boolean;
  dryRun?: boolean;
  roleGuides?: RoleGuide[];
}

interface ChatBody {
  message?: string;
  model?: string;
}

interface ActiveRun {
  runId: string;
  status: "running" | "planned" | "done" | "error";
  mode: "plan" | "run";
  error?: string;
}

interface PreviewSession {
  runId: string;
  targetDir: string;
  status: "missing" | "installing" | "starting" | "running" | "error" | "stopped";
  command?: string;
  url?: string;
  logs: string[];
  error?: string;
  process?: ChildProcess;
}

interface FeatureChatSession {
  runId: string;
  status: "idle" | "running" | "error" | "done";
  messages: Array<{ role: "user" | "assistant" | "system"; content: string; ts: string; model?: string }>;
  activeModel?: string;
  error?: string;
}

const clients = new Map<string, Set<ServerResponse>>();
const activeRuns = new Map<string, ActiveRun>();
const previews = new Map<string, PreviewSession>();
const featureChats = new Map<string, FeatureChatSession>();

export async function startGuiServer(opts: GuiServerOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4545;

  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const url = `http://${host}:${port}`;
  return {
    url,
    close: () => new Promise((resolve, reject) => {
      for (const preview of previews.values()) preview.process?.kill("SIGTERM");
      server.close((err) => err ? reject(err) : resolve());
    }),
  };
}

async function route(req: http.IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/") {
    sendHtml(res, DASHBOARD_HTML);
    return;
  }

  if (method === "GET" && pathname === "/app.js") {
    sendText(res, 200, CLIENT_JS, "application/javascript; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/styles.css") {
    sendText(res, 200, CLIENT_CSS, "text/css; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/api/models") {
    sendJson(res, 200, { models: MODELS });
    return;
  }

  if (method === "GET" && pathname === "/api/config") {
    sendJson(res, 200, { outputRoot: forgeOutputRoot() });
    return;
  }

  if (method === "GET" && pathname === "/api/runs") {
    sendJson(res, 200, { runs: listRuns().slice(0, 50).map(readRunListItem) });
    return;
  }

  const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (method === "GET" && runMatch) {
    sendJson(res, 200, readRunSnapshot(decodeURIComponent(runMatch[1])));
    return;
  }
  if (method === "DELETE" && runMatch) {
    const runId = decodeURIComponent(runMatch[1]);
    stopPreview(runId);
    activeRuns.delete(runId);
    closeRunStreams(runId);
    sendJson(res, 200, deleteRun(runId, { deleteProject: true }));
    return;
  }

  const previewMatch = pathname.match(/^\/api\/runs\/([^/]+)\/preview$/);
  if (previewMatch) {
    const runId = decodeURIComponent(previewMatch[1]);
    if (method === "GET") {
      sendJson(res, 200, readPreviewState(runId));
      return;
    }
    if (method === "POST") {
      sendJson(res, 202, await startPreview(runId));
      return;
    }
  }

  const chatMatch = pathname.match(/^\/api\/runs\/([^/]+)\/chat$/);
  if (chatMatch) {
    const runId = decodeURIComponent(chatMatch[1]);
    if (method === "GET") {
      sendJson(res, 200, readFeatureChat(runId));
      return;
    }
    if (method === "POST") {
      const body = await readJsonBody<ChatBody>(req);
      sendJson(res, 202, await startFeatureChat(runId, body));
      return;
    }
  }

  const streamMatch = pathname.match(/^\/api\/runs\/([^/]+)\/stream$/);
  if (method === "GET" && streamMatch) {
    openRunStream(decodeURIComponent(streamMatch[1]), res);
    return;
  }

  if (method === "POST" && (pathname === "/api/runs" || pathname === "/api/plan")) {
    const body = await readJsonBody<StartRunBody>(req);
    const runId = newRunId();
    const dryRun = pathname === "/api/plan" || Boolean(body.dryRun);
    const prompt = body.prompt?.trim();
    if (!prompt) {
      sendJson(res, 400, { error: "prompt is required" });
      return;
    }

    const options: RunOptions = {
      runId,
      prompt,
      targetDir: body.targetDir?.trim() || "./forge-out",
      dryRun,
      coder: normalizeOptional(body.coder),
      modelOverride: normalizePlanningModel(body.model, Boolean(body.allowCodexPlanning)),
      contextBudget: body.contextBudget ?? "standard",
      bmadOutput: Boolean(body.bmad),
      roleGuides: sanitizeRoleGuides(body.roleGuides),
      onEvent: (event) => broadcast(runId, event),
    };

    activeRuns.set(runId, { runId, status: "running", mode: dryRun ? "plan" : "run" });
    void runForge(options)
      .then(() => activeRuns.set(runId, { runId, status: dryRun ? "planned" : "done", mode: dryRun ? "plan" : "run" }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        activeRuns.set(runId, { runId, status: "error", mode: dryRun ? "plan" : "run", error: message });
        broadcast(runId, { ts: new Date().toISOString(), runId, type: "run_error", message });
      });

    sendJson(res, 202, { runId, status: "running", dryRun });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function readRunListItem(runId: string): object {
  try {
    const plan = readPlan(runId);
    const active = activeRuns.get(runId);
    return {
      runId,
      prompt: plan.prompt,
      createdAt: plan.createdAt,
      targetDir: plan.targetDir,
      classification: plan.classification,
      activeStatus: active?.status,
    };
  } catch {
    return { runId, prompt: "(plan unavailable)" };
  }
}

function readRunSnapshot(runId: string): object {
  let plan: Plan | null = null;
  try {
    plan = readPlan(runId);
  } catch {
    // Run may have just started and not written the plan yet.
  }

  const audit = readAudit(runId);
  const checkpointNames = listCheckpoints(runId);
  const checkpoints = checkpointNames.map((name) => ({
    name,
    data: loadCheckpoint(runId, name.replace(/\.json$/, "")),
  }));
  const active = activeRuns.get(runId);
  const targetDir = inferTargetDir(plan);

  return {
    runId,
    active,
    plan,
    audit,
    checkpoints,
    progress: calculateProgress(plan, audit, active),
    preview: readPreviewState(runId),
    chat: readFeatureChat(runId),
    files: targetDir ? listProjectFiles(targetDir) : [],
  };
}

function calculateProgress(plan: Plan | null, audit: ReturnType<typeof readAudit>, active?: ActiveRun): object {
  const nodes = plan?.nodes.filter((node) => node.phase !== "classify") ?? [];
  const completed = new Set(audit.filter((event) => event.kind === "phase_end" && event.ok !== false).map((event) => event.nodeId));
  const failed = new Set(audit.filter((event) => event.kind === "phase_end" && event.ok === false).map((event) => event.nodeId));
  const started = audit.filter((event) => event.kind === "phase_start");
  const currentNodeId = [...started].reverse().find((event) => !completed.has(event.nodeId) && !failed.has(event.nodeId))?.nodeId;
  const current = nodes.find((node) => node.id === currentNodeId);
  const total = nodes.length || 6;
  const done = completed.size;
  const planOnly = active?.mode === "plan" || (Boolean(plan) && done === 0 && started.length === 0);
  return {
    total,
    done,
    percent: Math.round((done / total) * 100),
    currentPhase: current?.phase,
    currentNodeId,
    mode: active?.mode ?? (planOnly ? "plan" : "run"),
    status: active?.status ?? (failed.size ? "error" : done === total ? "done" : current ? "running" : plan ? "planned" : "waiting"),
  };
}

function inferTargetDir(plan: Plan | null): string | null {
  if (!plan?.targetDir) return null;
  return path.resolve(plan.targetDir);
}

function listProjectFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const ignored = new Set([".git", "node_modules", "dist", "build", ".next", ".turbo"]);
  const out: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 4 || out.length >= 200) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= 200 || ignored.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      out.push(entry.isDirectory() ? `${rel}/` : rel);
      if (entry.isDirectory()) walk(abs, depth + 1);
    }
  };

  walk(root, 0);
  return out.sort();
}

function readPreviewState(runId: string): object {
  const preview = previews.get(runId);
  if (!preview) return { status: "missing", logs: [] };
  return {
    runId: preview.runId,
    targetDir: preview.targetDir,
    status: preview.status,
    command: preview.command,
    url: preview.url,
    logs: preview.logs.slice(-80),
    error: preview.error,
  };
}

async function startPreview(runId: string): Promise<object> {
  const existing = previews.get(runId);
  if (existing?.status === "running" || existing?.status === "starting" || existing?.status === "installing") return readPreviewState(runId);

  let plan: Plan;
  try {
    plan = readPlan(runId);
  } catch {
    return { status: "error", error: "Run plan is not available yet." };
  }

  const targetDir = inferTargetDir(plan);
  if (!targetDir || !fs.existsSync(targetDir)) {
    return { status: "error", error: "Target directory does not exist yet." };
  }

  const packageFile = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageFile)) {
    return { status: "missing", error: "No package.json found in the generated app yet.", logs: [] };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { scripts?: Record<string, string> };
  const script = pickPreviewScript(packageJson.scripts ?? {});
  if (!script) {
    return { status: "missing", error: "No dev, start, or preview script found in package.json.", logs: [] };
  }

  const port = await getFreePort();
  const pkg = detectPackageManager(targetDir);
  const args = pkg === "yarn"
    ? ["run", script, "--port", String(port)]
    : ["run", script, "--", "--port", String(port)];
  const command = `${pkg} ${args.join(" ")}`;
  const preview: PreviewSession = {
    runId,
    targetDir,
    status: "starting",
    command,
    url: `http://127.0.0.1:${port}`,
    logs: [],
  };
  previews.set(runId, preview);

  void startPreviewProcess(preview, pkg, args, port);
  return readPreviewState(runId);
}

async function startPreviewProcess(preview: PreviewSession, pkg: "npm" | "pnpm" | "yarn", args: string[], port: number): Promise<void> {
  if (!fs.existsSync(path.join(preview.targetDir, "node_modules"))) {
    preview.status = "installing";
    const installOk = await runPreviewCommand(preview, pkg, packageInstallArgs(pkg));
    if (!installOk) return;
  }

  preview.status = "starting";
  const child = spawn(pkg, args, {
    cwd: preview.targetDir,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  preview.process = child;

  const onChunk = (chunk: Buffer) => appendPreviewLog(preview, chunk.toString());
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);
  child.on("error", (error) => {
    preview.status = "error";
    preview.error = error.message;
  });
  child.on("close", (code) => {
    preview.status = code === 0 ? "stopped" : "error";
    if (code !== 0) preview.error = `Preview process exited with code ${code}`;
  });

  setTimeout(() => {
    if (preview.status === "starting") preview.status = "running";
  }, 4000);
}

function packageInstallArgs(pkg: "npm" | "pnpm" | "yarn"): string[] {
  if (pkg === "yarn") return ["install"];
  if (pkg === "pnpm") return ["install"];
  return ["install"];
}

function runPreviewCommand(preview: PreviewSession, command: string, args: string[]): Promise<boolean> {
  preview.logs.push(`$ ${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    cwd: preview.targetDir,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve) => {
    const onChunk = (chunk: Buffer) => appendPreviewLog(preview, chunk.toString());
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("error", (error) => {
      preview.status = "error";
      preview.error = error.message;
      resolve(false);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        preview.status = "error";
        preview.error = `${command} ${args.join(" ")} exited with code ${code}`;
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function appendPreviewLog(preview: PreviewSession, text: string): void {
  preview.logs.push(...text.split("\n").filter(Boolean).slice(-20));
  preview.logs = preview.logs.slice(-160);
  const foundUrl = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/)?.[0];
  if (foundUrl) preview.url = foundUrl.replace("localhost", "127.0.0.1");
  if (preview.status === "starting" && (foundUrl || /ready|compiled|started|local:/i.test(text))) preview.status = "running";
  broadcast(preview.runId, {
    ts: new Date().toISOString(),
    runId: preview.runId,
    type: "cli_output",
    message: "preview",
    line: text.trim().slice(0, 240),
  });
}

function readFeatureChat(runId: string): object {
  return featureChats.get(runId) ?? { runId, status: "idle", messages: [] };
}

async function startFeatureChat(runId: string, body: ChatBody): Promise<object> {
  const message = body.message?.trim();
  if (!message) return { runId, status: "error", error: "message is required", messages: [] };

  let plan: Plan;
  try {
    plan = readPlan(runId);
  } catch {
    return { runId, status: "error", error: "Run plan is not available.", messages: [] };
  }

  const targetDir = inferTargetDir(plan);
  if (!targetDir || !fs.existsSync(targetDir)) {
    return { runId, status: "error", error: "Target directory does not exist.", messages: [] };
  }

  const modelId = normalizeOptional(body.model) ?? "codex";
  const chat = featureChats.get(runId) ?? { runId, status: "idle", messages: [] };
  if (chat.status === "running") return chat;
  chat.status = "running";
  chat.activeModel = modelId;
  chat.error = undefined;
  chat.messages.push({ role: "user", content: message, ts: new Date().toISOString(), model: modelId });
  featureChats.set(runId, chat);

  appendAudit(runId, { kind: "info", agent: "Feature Chat", modelId, message: `Feature request: ${message}` });
  broadcast(runId, {
    ts: new Date().toISOString(),
    runId,
    type: "cli_output",
    modelId,
    message: "feature_chat",
    line: `feature request queued for ${modelId}: ${message}`,
  });

  void runFeatureChat(runId, targetDir, plan, chat, modelId, message);
  return chat;
}

async function runFeatureChat(
  runId: string,
  targetDir: string,
  plan: Plan,
  chat: FeatureChatSession,
  modelId: string,
  message: string
): Promise<void> {
  const prompt = [
    "# Role: Feature Continuation Developer",
    "# Goal: Modify the existing generated app in-place.",
    "",
    "You are continuing a Forge-generated app. Work inside the current directory only.",
    "Preserve the existing app, implement the user's requested change, and run the smallest useful verification.",
    "If this is a web app, prefer preserving the current dev-server workflow and hot reload.",
    "When complete, summarize files changed, how to verify, and any follow-up risks.",
    "",
    "# Original App Request",
    plan.prompt,
    "",
    "# New Feature Request",
    message,
  ].join("\n");

  const started = Date.now();
  let activeModelId = modelId;
  let res = await runFeatureCli(runId, targetDir, prompt, activeModelId);
  if (!res.ok && isCapacityOrContextFailure(res)) {
    const fallback = crossProviderFallback(activeModelId, "dev");
    if (fallback) {
      appendAudit(runId, {
        kind: "info",
        agent: "Feature Chat",
        modelId: activeModelId,
        message: `model fallback ${activeModelId} -> ${fallback} (capacity/context limit)`,
      });
      broadcast(runId, {
        ts: new Date().toISOString(),
        runId,
        type: "cli_output",
        modelId: fallback,
        message: "feature_chat",
        line: `model fallback ${activeModelId} -> ${fallback} (capacity/context limit)`,
      });
      activeModelId = fallback;
      chat.activeModel = fallback;
      res = await runFeatureCli(runId, targetDir, prompt, activeModelId);
    }
  }

  appendAudit(runId, {
    kind: "cli_call",
    agent: "Feature Chat",
    modelId: activeModelId,
    cli: activeModelId === "codex" ? "codex" : "claude",
    durationMs: res.durationMs || Date.now() - started,
    exitCode: res.exitCode,
    ok: res.ok,
    costUsd: res.costUsd,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    message: res.ok ? "Feature chat completed" : `Feature chat failed: ${res.stderr.slice(-500)}`,
  });

  chat.status = res.ok ? "done" : "error";
  chat.error = res.ok ? undefined : res.stderr.slice(-800) || res.finalText.slice(-800);
  chat.messages.push({
    role: "assistant",
    content: res.finalText.trim() || (res.ok ? "Done." : chat.error ?? "Failed."),
    ts: new Date().toISOString(),
    model: activeModelId,
  });
  broadcast(runId, {
    ts: new Date().toISOString(),
    runId,
    type: res.ok ? "changes_requested" : "run_error",
    modelId: activeModelId,
    message: "feature_chat",
    line: chat.messages[chat.messages.length - 1].content.slice(0, 240),
  });
}

function runFeatureCli(runId: string, targetDir: string, prompt: string, modelId: string) {
  return runCli({
    modelId,
    prompt,
    cwd: targetDir,
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    timeoutMs: 30 * 60_000,
    onLine: (line) => {
      const visibleLine = line.slice(0, 240);
      appendAudit(runId, { kind: "cli_output", agent: "Feature Chat", modelId, message: visibleLine });
      broadcast(runId, {
        ts: new Date().toISOString(),
        runId,
        type: "cli_output",
        modelId,
        message: "feature_chat",
        line: visibleLine,
      });
    },
  });
}

function pickPreviewScript(scripts: Record<string, string>): string | null {
  for (const candidate of ["dev", "start", "preview"]) {
    if (scripts[candidate]) return candidate;
  }
  return null;
}

function detectPackageManager(targetDir: string): "npm" | "pnpm" | "yarn" {
  if (fs.existsSync(path.join(targetDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(targetDir, "yarn.lock"))) return "yarn";
  return "npm";
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("Could not allocate preview port"));
      });
    });
  });
}

function openRunStream(runId: string, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ runId })}\n\n`);

  const set = clients.get(runId) ?? new Set<ServerResponse>();
  set.add(res);
  clients.set(runId, set);

  res.on("close", () => {
    set.delete(res);
    if (set.size === 0) clients.delete(runId);
  });
}

function closeRunStreams(runId: string): void {
  const set = clients.get(runId);
  if (!set) return;
  for (const res of set) res.end();
  clients.delete(runId);
}

function broadcast(runId: string, event: ForgeRunEvent): void {
  const set = clients.get(runId);
  if (!set) return;
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) res.write(payload);
}

function stopPreview(runId: string): void {
  const preview = previews.get(runId);
  preview?.process?.kill("SIGTERM");
  previews.delete(runId);
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "auto" || normalized === "default" || normalized === "none") return undefined;
  return normalized;
}

function normalizePlanningModel(value?: string, allowCodexPlanning = false): string | undefined {
  const normalized = normalizeOptional(value);
  if (normalized === "codex" && !allowCodexPlanning) return undefined;
  return normalized;
}

function sanitizeRoleGuides(guides?: RoleGuide[]): RoleGuide[] {
  if (!Array.isArray(guides)) return [];
  const allowed = new Set(["ba", "qa"]);
  return guides
    .filter((guide) => allowed.has(guide.phase) && typeof guide.name === "string" && typeof guide.content === "string")
    .map((guide) => ({
      phase: guide.phase,
      name: path.basename(guide.name).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "role-guide.md",
      content: guide.content.slice(0, 200_000),
    }))
    .slice(0, 16);
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendHtml(res: ServerResponse, html: string): void {
  sendText(res, 200, html, "text/html; charset=utf-8");
}

function sendText(res: ServerResponse, status: number, text: string, contentType: string): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Forge</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="shell">
    <aside class="rail">
      <div>
        <h1>Forge</h1>
        <p class="muted">Local build observability</p>
      </div>
      <form id="run-form" class="panel">
        <label>Request<textarea id="prompt" rows="6" placeholder="Build a web app for..."></textarea></label>
        <label>Target directory<input id="targetDir" placeholder="auto: one folder per run"></label>
        <div class="hint" id="output-root-hint">Generated projects are stored under Forge's ignored output folder.</div>
        <div class="grid2">
          <label>Planning<select id="model"><option value="auto">auto</option></select></label>
          <label>Impl<select id="coder"><option value="auto">auto</option></select></label>
        </div>
        <label class="checkline"><input id="allowCodexPlanning" type="checkbox"> Allow Codex planning</label>
        <div class="hint">Default: terminal-safe router for planning, Codex for implementation. Enable Codex planning only when you want to test all-Codex phases.</div>
        <label>Context<select id="contextBudget"><option>standard</option><option>low</option><option>deep</option></select></label>
        <div class="role-guides">
          <div class="section-title">Role Guides</div>
          <label>BA markdown<input id="baGuides" type="file" accept=".md,text/markdown,text/plain" multiple></label>
          <label>QA markdown<input id="qaGuides" type="file" accept=".md,text/markdown,text/plain" multiple></label>
          <div class="hint">Attached files are saved with the run and injected only into their matching BA or QA phase.</div>
        </div>
        <div class="actions">
          <button type="button" id="plan-btn">Plan</button>
          <button type="submit">Run</button>
        </div>
      </form>
      <section class="panel">
        <div class="section-title">Runs</div>
        <div id="runs" class="run-list"></div>
      </section>
    </aside>

    <section class="main">
      <header class="topbar">
        <div>
          <div class="eyebrow" id="run-id">No run selected</div>
          <h2 id="run-title">Start or select a run</h2>
        </div>
        <div class="run-meter">
          <div class="meter-row">
            <span id="progress-label">0/6 phases</span>
            <span class="status" id="run-status">idle</span>
          </div>
          <div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div>
        </div>
      </header>

      <section class="phase-strip" id="phases"></section>

      <section class="content-grid">
        <article class="panel large">
          <div class="section-title">Live Output</div>
          <pre id="output" class="output"></pre>
        </article>
        <article class="panel">
          <div class="section-title">Checkpoints</div>
          <div id="checkpoints" class="stack"></div>
        </article>
        <article class="panel">
          <div class="section-title">Generated Files</div>
          <div id="files" class="file-list"></div>
        </article>
      </section>

      <section class="panel preview-panel">
        <div class="preview-head">
          <div>
            <div class="section-title">App Preview</div>
            <div class="item-meta" id="preview-status">No preview running</div>
          </div>
          <div class="preview-actions">
            <button type="button" id="preview-btn">Start preview</button>
            <a id="preview-link" class="preview-link" target="_blank" rel="noreferrer"></a>
          </div>
        </div>
        <iframe id="preview-frame" title="Generated app preview"></iframe>
        <pre id="preview-log" class="preview-log"></pre>
      </section>

      <section class="panel chat-panel">
        <div class="preview-head">
          <div>
            <div class="section-title">Continue Build</div>
            <div class="item-meta" id="chat-status">Select a completed app run, then request the next feature.</div>
          </div>
          <label class="chat-model">Model<select id="chatModel"><option value="codex">codex</option></select></label>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <form id="chat-form" class="chat-form">
          <textarea id="chat-input" rows="3" placeholder="Add a pricing page, improve the navbar, wire up local persistence..."></textarea>
          <button type="submit">Send</button>
        </form>
      </section>
    </section>
  </main>
  <script src="/app.js"></script>
</body>
</html>`;

const CLIENT_CSS = `
:root {
  color-scheme: dark;
  --bg: #101112;
  --panel: #181a1c;
  --panel-2: #202326;
  --line: #303438;
  --text: #f2f2ed;
  --muted: #a3a6a8;
  --accent: #7cc7a4;
  --warn: #e7c66a;
  --bad: #ee8d8d;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select, textarea { font: inherit; }
.shell { min-height: 100vh; display: grid; grid-template-columns: minmax(280px, 340px) 1fr; }
.rail { border-right: 1px solid var(--line); padding: 18px; display: flex; flex-direction: column; gap: 16px; min-height: 100vh; }
h1, h2, p { margin: 0; }
h1 { font-size: 28px; line-height: 1; }
h2 { font-size: 20px; font-weight: 650; margin-top: 4px; }
.muted, .eyebrow { color: var(--muted); }
.eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
.large { min-height: 420px; }
label { display: grid; gap: 6px; color: var(--muted); font-size: 12px; }
.checkline { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.checkline input { width: auto; }
.hint { color: var(--muted); font-size: 12px; margin-top: 8px; }
input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; background: #111315; color: var(--text); padding: 9px 10px; outline: none; }
textarea { resize: vertical; min-height: 128px; }
input[type="file"] { color: var(--muted); font-size: 12px; padding: 8px; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.role-guides { display: grid; gap: 8px; padding-top: 4px; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
button { border: 1px solid var(--line); border-radius: 6px; background: var(--panel-2); color: var(--text); padding: 9px 10px; cursor: pointer; }
button:hover { border-color: var(--accent); }
button[type="submit"] { background: #234438; border-color: #366653; }
.main { padding: 18px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
.status { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; color: var(--muted); white-space: nowrap; }
.run-meter { min-width: 260px; display: grid; gap: 8px; }
.meter-row { display: flex; align-items: center; justify-content: flex-end; gap: 10px; color: var(--muted); font-size: 12px; }
.progress-track { height: 8px; background: #0f1112; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.progress-fill { width: 0%; height: 100%; background: var(--accent); transition: width .24s ease; }
.phase-strip { display: grid; grid-template-columns: repeat(6, minmax(96px, 1fr)); gap: 10px; }
.phase { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--panel); min-height: 74px; }
.phase.active { border-color: var(--accent); }
.phase.active .phase-name::after { content: ""; display: inline-block; width: 8px; height: 8px; margin-left: 8px; border: 2px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
.phase.done { border-color: #446b5a; }
.phase.bad { border-color: var(--bad); }
.phase-name { font-weight: 650; }
.phase-meta { color: var(--muted); font-size: 12px; margin-top: 6px; }
.content-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); grid-auto-rows: minmax(180px, auto); gap: 16px; }
.content-grid .large { grid-row: span 2; }
.section-title { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }
.output { margin: 0; min-height: 360px; max-height: 58vh; overflow: auto; white-space: pre-wrap; color: #d8ded8; }
.stack, .file-list, .run-list { display: grid; gap: 8px; }
.item { border: 1px solid var(--line); border-radius: 6px; padding: 9px; background: #131517; cursor: pointer; }
.item:hover { border-color: var(--accent); }
.run-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: stretch; }
.run-select { text-align: left; }
.delete-run { color: var(--bad); min-width: 40px; padding: 8px; }
.item-title { font-weight: 650; overflow-wrap: anywhere; }
.item-meta { color: var(--muted); font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
.file-list { max-height: 320px; overflow: auto; }
.preview-panel { min-height: 420px; }
.preview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.preview-actions { display: flex; align-items: center; gap: 10px; }
.preview-link { color: var(--accent); text-decoration: none; font-size: 12px; }
#preview-frame { width: 100%; height: 520px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
.preview-log { margin: 10px 0 0; max-height: 120px; overflow: auto; color: var(--muted); white-space: pre-wrap; }
.chat-panel { min-height: 280px; }
.chat-model { width: 180px; }
.chat-messages { display: grid; gap: 8px; max-height: 260px; overflow: auto; margin-bottom: 12px; }
.chat-message { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: #121416; white-space: pre-wrap; }
.chat-message.user { border-color: #365c4b; }
.chat-message.assistant { border-color: #3a4858; }
.chat-form { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: stretch; }
.chat-form textarea { min-height: 78px; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 920px) {
  .shell { grid-template-columns: 1fr; }
  .rail { min-height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .phase-strip, .content-grid { grid-template-columns: 1fr; }
  .topbar, .preview-head { align-items: stretch; flex-direction: column; }
  .chat-form { grid-template-columns: 1fr; }
  .run-meter { min-width: 0; }
}
`;

const CLIENT_JS = `
const state = { selectedRunId: null, events: [], snapshot: null, stream: null };
const phases = ["ba", "tech_arch", "ux_design", "arch_synthesis", "stories", "dev", "qa", "infra", "review"];

const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function loadModels() {
  const { models } = await api("/api/models");
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.id;
    $("model").appendChild(option);
  }
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.id;
    $("coder").appendChild(option);
  }
  for (const model of models) {
    if (model.id === "codex") continue;
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.id;
    $("chatModel").appendChild(option);
  }
}

async function loadConfig() {
  const { outputRoot } = await api("/api/config");
  $("output-root-hint").textContent = "Default: " + outputRoot + "/<run-id>";
}

async function loadRuns() {
  const { runs } = await api("/api/runs");
  const box = $("runs");
  box.innerHTML = "";
  for (const run of runs) {
    const row = document.createElement("div");
    row.className = "run-item";
    const item = document.createElement("button");
    item.className = "item run-select";
    item.type = "button";
    item.innerHTML = '<div class="item-title">' + escapeHtml(run.prompt || run.runId) + '</div><div class="item-meta">' + escapeHtml(run.runId) + '</div>';
    item.onclick = () => selectRun(run.runId);
    const del = document.createElement("button");
    del.className = "delete-run";
    del.type = "button";
    del.title = "Delete run";
    del.textContent = "Del";
    del.onclick = async () => deleteRun(run.runId);
    row.appendChild(item);
    row.appendChild(del);
    box.appendChild(row);
  }
}

async function deleteRun(runId) {
  if (!confirm("Delete run " + runId + " and its generated project folder?")) return;
  const result = await api("/api/runs/" + encodeURIComponent(runId), { method: "DELETE" });
  if (result.skippedProjectDeleteReason) {
    alert("Run deleted. Project folder was not deleted: " + result.skippedProjectDeleteReason);
  }
  if (state.selectedRunId === runId) {
    state.selectedRunId = null;
    state.snapshot = null;
    state.events = [];
    if (state.stream) state.stream.close();
    state.stream = null;
    clearDashboard();
  }
  await loadRuns();
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  state.events = [];
  if (state.stream) state.stream.close();
  state.stream = new EventSource("/api/runs/" + encodeURIComponent(runId) + "/stream");
  for (const type of ["run_created", "plan_written", "phase_start", "cli_output", "cli_call", "phase_end", "approval_requested", "approval_granted", "changes_requested", "approval_aborted", "checkpoint_saved", "run_done", "run_error"]) {
    state.stream.addEventListener(type, (event) => {
      state.events.push(JSON.parse(event.data));
      render();
    });
  }
  await refreshSelected();
}

async function refreshSelected() {
  if (!state.selectedRunId) return;
  state.snapshot = await api("/api/runs/" + encodeURIComponent(state.selectedRunId));
  render();
}

function render() {
  const snap = state.snapshot;
  $("run-id").textContent = state.selectedRunId || "No run selected";
  $("run-title").textContent = snap?.plan?.prompt || "Start or select a run";
  $("run-status").textContent = snap?.progress?.status || snap?.active?.status || inferStatus(snap);
  renderProgress(snap);
  renderPhases(snap);
  renderOutput(snap);
  renderCheckpoints(snap);
  renderFiles(snap);
  renderPreview(snap);
  renderChat(snap);
}

function clearDashboard() {
  $("run-id").textContent = "No run selected";
  $("run-title").textContent = "Start or select a run";
  $("run-status").textContent = "idle";
  $("progress-label").textContent = "0/6 phases";
  $("progress-fill").style.width = "0%";
  $("phases").innerHTML = "";
  $("output").textContent = "";
  $("checkpoints").innerHTML = '<div class="item-meta">No checkpoints yet</div>';
  $("files").innerHTML = '<div class="item-meta">No generated files found yet</div>';
  $("preview-status").textContent = "No preview running";
  $("preview-log").textContent = "";
  $("preview-link").removeAttribute("href");
  $("preview-link").textContent = "";
  $("preview-frame").removeAttribute("src");
  $("preview-btn").disabled = true;
  $("chat-status").textContent = "Select a completed app run, then request the next feature.";
  $("chat-messages").innerHTML = "";
  $("chat-input").value = "";
}

function renderProgress(snap) {
  const progress = snap?.progress || { done: 0, total: 6, percent: 0 };
  const label = progress.currentPhase ? progress.currentPhase + " · " : progress.mode === "plan" ? "plan ready · " : "";
  $("progress-label").textContent = label + progress.done + "/" + progress.total + " phases";
  $("progress-fill").style.width = Math.max(0, Math.min(100, progress.percent || 0)) + "%";
}

function renderPhases(snap) {
  const started = new Set((snap?.audit || []).filter((e) => e.kind === "phase_start").map((e) => e.nodeId));
  const ended = new Map((snap?.audit || []).filter((e) => e.kind === "phase_end").map((e) => [e.nodeId, e]));
  const livePhase = [...state.events].reverse().find((e) => e.type === "phase_start")?.nodeId;
  $("phases").innerHTML = phases.map((phase) => {
    const node = snap?.plan?.nodes?.find((n) => n.phase === phase);
    const end = node ? ended.get(node.id) : null;
    const cls = end ? (end.ok ? "done" : "bad") : (node && (livePhase === node.id || started.has(node.id)) ? "active" : "");
    return '<div class="phase ' + cls + '"><div class="phase-name">' + phase + '</div><div class="phase-meta">' + escapeHtml(node?.modelId || "pending") + '</div></div>';
  }).join("");
}

function renderOutput(snap) {
  const auditLines = (snap?.audit || []).map((e) => {
    const label = [e.kind, e.nodeId, e.modelId].filter(Boolean).join(" ");
    const dur = e.durationMs ? " · " + (e.durationMs / 1000).toFixed(1) + "s" : "";
    const cost = e.costUsd ? " · $" + e.costUsd.toFixed(4) : "";
    return "[" + e.ts + "] " + label + dur + cost + (e.message ? "\\n" + e.message : "");
  });
  const liveLines = state.events.filter((e) => e.type === "cli_output").map((e) => e.line);
  $("output").textContent = [...auditLines, ...liveLines].join("\\n");
}

function renderCheckpoints(snap) {
  $("checkpoints").innerHTML = (snap?.checkpoints || []).map((c) => {
    const summary = c.data?.ok === false ? "failed" : c.data?.ok === true ? "ok" : "saved";
    return '<div class="item"><div class="item-title">' + escapeHtml(c.name) + '</div><div class="item-meta">' + summary + '</div></div>';
  }).join("") || '<div class="item-meta">No checkpoints yet</div>';
}

function renderFiles(snap) {
  $("files").innerHTML = (snap?.files || []).slice(0, 160).map((f) => '<div class="item-meta">' + escapeHtml(f) + '</div>').join("") || '<div class="item-meta">No generated files found yet</div>';
}

function renderPreview(snap) {
  const preview = snap?.preview || { status: "missing", logs: [] };
  $("preview-status").textContent = preview.url ? preview.status + " · " + preview.url : (preview.error || preview.status || "No preview running");
  $("preview-log").textContent = (preview.logs || []).slice(-30).join("\\n");
  const link = $("preview-link");
  if (preview.url) {
    link.href = preview.url;
    link.textContent = "open";
    if ($("preview-frame").src !== preview.url) $("preview-frame").src = preview.url;
  } else {
    link.removeAttribute("href");
    link.textContent = "";
    $("preview-frame").removeAttribute("src");
  }
  $("preview-btn").disabled = !state.selectedRunId || preview.status === "installing" || preview.status === "starting" || preview.status === "running";
}

function renderChat(snap) {
  const chat = snap?.chat || { status: "idle", messages: [] };
  $("chat-status").textContent = chat.activeModel ? chat.status + " · " + chat.activeModel : chat.status || "idle";
  $("chat-messages").innerHTML = (chat.messages || []).map((message) => {
    return '<div class="chat-message ' + escapeHtml(message.role) + '"><div class="item-meta">' + escapeHtml(message.role + (message.model ? " · " + message.model : "")) + '</div>' + escapeHtml(message.content) + '</div>';
  }).join("");
  $("chat-form").querySelector("button").disabled = !state.selectedRunId || chat.status === "running";
}

function inferStatus(snap) {
  if (!snap?.plan) return "waiting";
  const last = [...(snap.audit || [])].reverse().find((e) => e.kind === "phase_end");
  if (last?.ok === false) return "needs attention";
  return last ? "running or complete" : "planned";
}

async function bodyFromForm(dryRun) {
  return {
    prompt: $("prompt").value,
    targetDir: $("targetDir").value,
    model: $("model").value,
    coder: $("coder").value,
    allowCodexPlanning: $("allowCodexPlanning").checked,
    contextBudget: $("contextBudget").value,
    roleGuides: await readRoleGuides(),
    dryRun,
  };
}

async function readRoleGuides() {
  const guides = [];
  for (const file of $("baGuides").files || []) guides.push(await readRoleGuideFile("ba", file));
  for (const file of $("qaGuides").files || []) guides.push(await readRoleGuideFile("qa", file));
  return guides;
}

async function readRoleGuideFile(phase, file) {
  if (file.size > 200000) throw new Error(file.name + " is too large. Keep role guide markdown under 200 KB.");
  return { phase, name: file.name, content: await file.text() };
}

$("run-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = await bodyFromForm(false);
  const { runId } = await api("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await loadRuns();
  await selectRun(runId);
});

$("plan-btn").addEventListener("click", async () => {
  const body = await bodyFromForm(true);
  const { runId } = await api("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await loadRuns();
  await selectRun(runId);
});

$("preview-btn").addEventListener("click", async () => {
  if (!state.selectedRunId) return;
  await api("/api/runs/" + encodeURIComponent(state.selectedRunId) + "/preview", { method: "POST" });
  await refreshSelected();
});

$("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedRunId) return;
  const message = $("chat-input").value.trim();
  if (!message) return;
  await api("/api/runs/" + encodeURIComponent(state.selectedRunId) + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model: $("chatModel").value }),
  });
  $("chat-input").value = "";
  await refreshSelected();
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

loadConfig().then(loadModels).then(loadRuns).then(() => {
  setInterval(loadRuns, 2500);
  setInterval(refreshSelected, 1500);
}).catch((error) => {
  $("output").textContent = error.stack || error.message;
});
`;
