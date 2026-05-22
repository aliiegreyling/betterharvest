import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AuditEvent, Plan } from "../types.js";
import { isForgeOutputRoot, isInsideForgeOutput } from "../project/output-paths.js";

export interface DeleteRunResult {
  runDeleted: boolean;
  projectDeleted: boolean;
  runId: string;
  targetDir?: string;
  skippedProjectDeleteReason?: string;
}

export function forgeHome(): string {
  return process.env.FORGE_HOME ?? path.join(os.homedir(), ".forge");
}

export function newRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export function runDir(runId: string): string {
  return path.join(forgeHome(), "runs", runId);
}

export function ensureRunDir(runId: string): string {
  const dir = runDir(runId);
  fs.mkdirSync(path.join(dir, "checkpoints"), { recursive: true });
  return dir;
}

export function writePlan(runId: string, plan: Plan): void {
  const dir = ensureRunDir(runId);
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
}

export function readPlan(runId: string): Plan {
  const p = path.join(runDir(runId), "plan.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as Plan;
}

export function appendAudit(runId: string, event: Omit<AuditEvent, "ts" | "runId">): void {
  const dir = ensureRunDir(runId);
  const e: AuditEvent = { ts: new Date().toISOString(), runId, ...event };
  fs.appendFileSync(path.join(dir, "audit.jsonl"), JSON.stringify(e) + "\n");
}

export function readAudit(runId: string): AuditEvent[] {
  const p = path.join(runDir(runId), "audit.jsonl");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as AuditEvent);
}

export function saveCheckpoint(runId: string, name: string, data: unknown): void {
  const dir = ensureRunDir(runId);
  fs.writeFileSync(
    path.join(dir, "checkpoints", `${name}.json`),
    JSON.stringify(data, null, 2)
  );
}

export function loadCheckpoint<T>(runId: string, name: string): T | null {
  const p = path.join(runDir(runId), "checkpoints", `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export function listCheckpoints(runId: string): string[] {
  const dir = path.join(runDir(runId), "checkpoints");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

export function listRuns(): string[] {
  const dir = path.join(forgeHome(), "runs");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().reverse();
}

export function deleteRun(runId: string, opts: { deleteProject?: boolean } = {}): DeleteRunResult {
  if (runId.includes("/") || runId.includes("\\") || runId === "." || runId === "..") {
    throw new Error(`Invalid run id: ${runId}`);
  }
  const dir = runDir(runId);
  if (!fs.existsSync(dir)) return { runDeleted: false, projectDeleted: false, runId };

  let targetDir: string | undefined;
  let projectDeleted = false;
  let skippedProjectDeleteReason: string | undefined;

  if (opts.deleteProject) {
    try {
      targetDir = readPlan(runId).targetDir;
      if (!targetDir) {
        skippedProjectDeleteReason = "run plan has no targetDir";
      } else if (!fs.existsSync(targetDir)) {
        skippedProjectDeleteReason = "target project directory does not exist";
      } else if (!isInsideForgeOutput(targetDir)) {
        skippedProjectDeleteReason = "target project is outside Forge output root";
      } else if (isForgeOutputRoot(targetDir)) {
        skippedProjectDeleteReason = "target project is the shared Forge output root";
      } else {
        fs.rmSync(targetDir, { recursive: true, force: true });
        projectDeleted = true;
      }
    } catch (error) {
      skippedProjectDeleteReason = error instanceof Error ? error.message : String(error);
    }
  }

  fs.rmSync(dir, { recursive: true, force: true });
  return { runDeleted: true, projectDeleted, runId, targetDir, skippedProjectDeleteReason };
}
