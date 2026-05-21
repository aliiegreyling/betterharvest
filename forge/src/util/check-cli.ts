import { spawn } from "node:child_process";
import { resolveBin, spawnArgs } from "./resolve-bin.js";

export interface CliCheckResult {
  ok: boolean;
  version: string;
  resolvedPath?: string;
}

export async function checkCli(bin: string, args: string[] = ["--version"]): Promise<CliCheckResult> {
  const resolved = await resolveBin(bin);
  if (!resolved) return { ok: false, version: "" };

  const s = spawnArgs(resolved, args);
  return new Promise((resolve) => {
    let out = "";
    const child = spawn(s.command, s.args, { ...s.options, windowsHide: true });
    child.stdout?.on("data", (d) => { out += d.toString(); });
    child.stderr?.on("data", (d) => { out += d.toString(); });
    child.on("error", () => resolve({ ok: false, version: "", resolvedPath: resolved.path }));
    child.on("close", (code) => {
      resolve({ ok: (code ?? 1) === 0, version: out.trim().split("\n")[0] || "", resolvedPath: resolved.path });
    });
  });
}
