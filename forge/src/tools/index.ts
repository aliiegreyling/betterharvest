import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ToolName, ToolSchema } from "../types.js";

const SHELL_ALLOWLIST = new Set([
  "npm", "pnpm", "node", "npx",
  "python", "python3", "pip", "pip3", "pytest",
  "git", "ls", "dir", "cat", "type", "echo", "mkdir", "touch",
  "go", "cargo", "rustc",
]);

export interface ToolEnv {
  targetDir: string;
}

function resolveSafe(env: ToolEnv, p: string): string {
  const abs = path.resolve(env.targetDir, p);
  const root = path.resolve(env.targetDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path escapes target dir: ${p}`);
  }
  return abs;
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "read_file",
    description: "Read a file from the target project directory. Returns its full contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Path relative to project root" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write (create or overwrite) a file in the target project directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to project root" },
        content: { type: "string", description: "Full file contents" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace an exact string in a file. old_string must occur exactly once.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_files",
    description: "Recursively list files in the project (or a subdirectory).",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Optional subpath; defaults to root" } },
    },
  },
  {
    name: "shell",
    description:
      "Run a shell command. Only allowlisted binaries are permitted (npm, node, python, pip, pytest, git, ls, mkdir, etc.). cwd is the project root.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Full command line" },
        timeout_seconds: { type: "number", description: "Max runtime, default 60" },
      },
      required: ["command"],
    },
  },
];

export function executeTool(
  env: ToolEnv,
  name: string,
  input: Record<string, unknown>
): { ok: boolean; result: string } {
  try {
    switch (name as ToolName) {
      case "read_file": {
        const p = resolveSafe(env, String(input.path));
        if (!fs.existsSync(p)) return { ok: false, result: `Not found: ${input.path}` };
        return { ok: true, result: fs.readFileSync(p, "utf8") };
      }
      case "write_file": {
        const p = resolveSafe(env, String(input.path));
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, String(input.content));
        return { ok: true, result: `Wrote ${input.path} (${String(input.content).length} bytes)` };
      }
      case "edit_file": {
        const p = resolveSafe(env, String(input.path));
        if (!fs.existsSync(p)) return { ok: false, result: `Not found: ${input.path}` };
        const cur = fs.readFileSync(p, "utf8");
        const old = String(input.old_string);
        const occ = cur.split(old).length - 1;
        if (occ === 0) return { ok: false, result: "old_string not found" };
        if (occ > 1) return { ok: false, result: `old_string occurs ${occ} times; must be unique` };
        fs.writeFileSync(p, cur.replace(old, String(input.new_string)));
        return { ok: true, result: `Edited ${input.path}` };
      }
      case "list_files": {
        const sub = input.path ? resolveSafe(env, String(input.path)) : env.targetDir;
        if (!fs.existsSync(sub)) return { ok: true, result: "(empty)" };
        const out: string[] = [];
        const walk = (d: string) => {
          for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
            const full = path.join(d, entry.name);
            const rel = path.relative(env.targetDir, full);
            if (entry.isDirectory()) walk(full);
            else out.push(rel.replace(/\\/g, "/"));
          }
        };
        walk(sub);
        return { ok: true, result: out.join("\n") || "(empty)" };
      }
      case "shell": {
        const cmd = String(input.command);
        const timeout = (Number(input.timeout_seconds) || 60) * 1000;
        const firstWord = cmd.trim().split(/\s+/)[0]?.replace(/\.(exe|cmd|bat)$/i, "");
        if (!firstWord || !SHELL_ALLOWLIST.has(firstWord)) {
          return { ok: false, result: `Command not allowlisted: ${firstWord}` };
        }
        const isWin = process.platform === "win32";
        const shell = isWin ? "powershell.exe" : "bash";
        const shellArgs = isWin ? ["-NoProfile", "-Command", cmd] : ["-c", cmd];
        const res = spawnSync(shell, shellArgs, {
          cwd: env.targetDir,
          encoding: "utf8",
          timeout,
          maxBuffer: 1024 * 1024 * 4,
        });
        const out = `exit=${res.status ?? "?"}\nstdout:\n${res.stdout ?? ""}\nstderr:\n${res.stderr ?? ""}`;
        return { ok: (res.status ?? 1) === 0, result: out.slice(0, 8000) };
      }
      default:
        return { ok: false, result: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: `Tool error: ${(e as Error).message}` };
  }
}
