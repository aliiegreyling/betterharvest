import { spawn } from "node:child_process";
import { getModel } from "../models/registry.js";
import { CliResult, ModelMeta } from "../types.js";
import { resolveBin, spawnArgs } from "../util/resolve-bin.js";

export interface RunCliOpts {
  modelId: string;
  prompt: string;
  cwd: string;
  allowedTools?: string[];
  timeoutMs?: number;
  onLine?: (line: string) => void;
}

export async function runCli(opts: RunCliOpts): Promise<CliResult> {
  const model = getModel(opts.modelId);
  if (model.cli === "claude") return runClaude(model, opts);
  if (model.cli === "codex") return runCodex(model, opts);
  throw new Error(`Unsupported CLI: ${model.cli}`);
}

function runClaude(model: ModelMeta, opts: RunCliOpts): Promise<CliResult> {
  const args: string[] = [
    "-p",
    opts.prompt,
    "--model",
    model.cliModelFlag,
    "--output-format",
    "json",
    "--permission-mode",
    "acceptEdits",
  ];
  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push("--allowedTools", opts.allowedTools.join(","));
  }
  return spawnCli("claude", args, opts);
}

function runCodex(model: ModelMeta, opts: RunCliOpts): Promise<CliResult> {
  const args: string[] = [
    "exec",
    "--model",
    model.cliModelFlag,
    "--cd",
    opts.cwd,
    "--full-auto",
    opts.prompt,
  ];
  return spawnCli("codex", args, opts);
}

async function spawnCli(bin: string, args: string[], opts: RunCliOpts): Promise<CliResult> {
  const started = Date.now();
  const resolved = await resolveBin(bin);
  if (!resolved) {
    return {
      ok: false,
      stdout: "",
      stderr: `${bin} not found on PATH`,
      exitCode: -1,
      durationMs: 0,
      finalText: `${bin} CLI is not installed or not on PATH`,
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const s = spawnArgs(resolved, args);
    const child = spawn(s.command, s.args, {
      ...s.options,
      cwd: opts.cwd,
      env: process.env,
      windowsHide: true,
    });

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, opts.timeoutMs)
      : null;

    child.stdout?.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stdout += chunk;
      if (opts.onLine) for (const line of chunk.split("\n")) if (line.trim()) opts.onLine(line);
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - started;
      const exitCode = code ?? -1;
      const parsed = parseClaudeJson(stdout);
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

function parseClaudeJson(stdout: string): {
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  finalText?: string;
} {
  try {
    const trimmed = stdout.trim();
    if (!trimmed.startsWith("{")) return {};
    const obj = JSON.parse(trimmed);
    return {
      costUsd: obj.total_cost_usd ?? obj.cost_usd,
      tokensIn: obj.usage?.input_tokens,
      tokensOut: obj.usage?.output_tokens,
      finalText: obj.result ?? obj.text,
    };
  } catch {
    return {};
  }
}
