import { spawn } from "node:child_process";
import { getAdapter } from "../cli-adapters/index.js";
import { getModel } from "../models/registry.js";
import { CliResult } from "../types.js";
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
  const adapter = getAdapter(model.cli);

  const translatedTools = adapter.translateTools
    ? adapter.translateTools(opts.allowedTools ?? [])
    : opts.allowedTools;

  const args = adapter.buildArgs({
    prompt: opts.prompt,
    cwd: opts.cwd,
    modelFlag: model.cliModelFlag || adapter.defaultModelFlag || "",
    allowedTools: translatedTools,
    timeoutMs: opts.timeoutMs,
    onLine: opts.onLine,
  });

  const started = Date.now();
  const resolved = await resolveBin(adapter.binName);
  if (!resolved) {
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
    const child = spawn(s.command, s.args, {
      ...s.options,
      cwd: opts.cwd,
      env: process.env,
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
