import { spawn } from "node:child_process";
import { getAdapter } from "../cli-adapters/index.js";
import { getModel } from "../models/registry.js";
import { CliResult } from "../types.js";
import { resolveBin, spawnArgs } from "../util/resolve-bin.js";
import { debugLog } from "../util/diagnostics.js";

export interface RunCliOpts {
  modelId: string;
  prompt: string;
  cwd: string;
  allowedTools?: string[];
  chatOnly?: boolean;
  verbose?: boolean;
  timeoutMs?: number;
  onLine?: (line: string) => void;
}

export async function runCli(opts: RunCliOpts): Promise<CliResult> {
  const model = getModel(opts.modelId);
  const adapter = getAdapter(model.cli);

  const translatedTools = adapter.translateTools
    ? adapter.translateTools(opts.allowedTools ?? [])
    : opts.allowedTools;

  const args = adapter.buildArgs({
    prompt: opts.prompt,
    cwd: opts.cwd,
    modelFlag: model.cliModelFlag || adapter.defaultModelFlag || "",
    allowedTools: translatedTools,
    chatOnly: opts.chatOnly,
    timeoutMs: opts.timeoutMs,
    onLine: opts.onLine,
  });

  const started = Date.now();
  const resolved = await resolveBin(adapter.binName);
  if (!resolved) {
    debugLog("cli-runner", "adapter binary not found", { adapter: adapter.binName, modelId: opts.modelId }, opts.verbose);
    return {
      ok: false,
      stdout: "",
      stderr: `${adapter.binName} not found on PATH`,
      exitCode: -1,
      durationMs: 0,
      finalText: `${adapter.binName} CLI is not installed or not on PATH`,
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const s = spawnArgs(resolved, args);
    debugLog("cli-runner", "spawning adapter", {
      adapter: adapter.binName,
      modelId: opts.modelId,
      cwd: opts.cwd,
      chatOnly: opts.chatOnly ?? false,
      allowedTools: opts.allowedTools ?? [],
      args: redactArgs(args),
    }, opts.verbose);
    const child = spawn(s.command, s.args, {
      ...s.options,
      cwd: opts.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = opts.timeoutMs
      ? setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, opts.timeoutMs)
      : null;

    child.stdout?.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stdout += chunk;
      if (opts.onLine) for (const line of chunk.split("\n")) if (line.trim()) opts.onLine(line);
    });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - started;
      const exitCode = code ?? -1;
      const parsed = adapter.parseOutput(stdout);
      debugLog("cli-runner", "adapter closed", {
        adapter: adapter.binName,
        modelId: opts.modelId,
        exitCode,
        durationMs,
        timedOut,
        stderrTail: stderr.slice(-500),
      }, opts.verbose);
      resolve({
        ok: exitCode === 0 && !timedOut,
        stdout,
        stderr,
        exitCode,
        durationMs,
        costUsd: parsed.costUsd,
        tokensIn: parsed.tokensIn,
        tokensOut: parsed.tokensOut,
        finalText: parsed.finalText ?? stdout.slice(-4000),
      });
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      debugLog("cli-runner", "adapter spawn error", {
        adapter: adapter.binName,
        modelId: opts.modelId,
        error: err.message,
      }, opts.verbose);
      resolve({
        ok: false,
        stdout,
        stderr: stderr + "\nspawn error: " + err.message,
        exitCode: -1,
        durationMs: Date.now() - started,
        finalText: stderr + "\nspawn error: " + err.message,
      });
    });
  });
}

function redactArgs(args: string[]): string[] {
  return args.map((arg) => {
    if (/token|secret|password|key/i.test(arg)) return "<redacted>";
    if (arg.length > 240) return `${arg.slice(0, 240)}...<truncated>`;
    return arg;
  });
}
