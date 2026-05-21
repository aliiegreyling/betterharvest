import fs from "node:fs";
import path from "node:path";
import { SpawnOptions } from "node:child_process";

export interface ResolvedBin {
  path: string;
  isShellScript: boolean;
}

export function spawnArgs(resolved: ResolvedBin, args: string[]): {
  command: string;
  args: string[];
  options: SpawnOptions;
} {
  if (resolved.isShellScript && process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", quote(resolved.path), ...args.map(quote)],
      options: { windowsVerbatimArguments: true },
    };
  }
  return { command: resolved.path, args, options: {} };
}

function quote(s: string): string {
  if (s === "") return '""';
  if (!/[\s"]/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

export async function resolveBin(bin: string): Promise<ResolvedBin | null> {
  const isWin = process.platform === "win32";
  const exts = isWin ? [".exe", ".cmd", ".bat", ""] : [""];
  const pathEnv = process.env.PATH || process.env.Path || "";
  const sep = isWin ? ";" : ":";
  const dirs = pathEnv.split(sep).filter(Boolean);

  for (const d of dirs) {
    for (const ext of exts) {
      const candidate = path.join(d, bin + ext);
      try {
        if (fs.statSync(candidate).isFile()) {
          const lower = candidate.toLowerCase();
          return {
            path: candidate,
            isShellScript: lower.endsWith(".cmd") || lower.endsWith(".bat"),
          };
        }
      } catch {
        // not present, continue
      }
    }
  }
  return null;
}
