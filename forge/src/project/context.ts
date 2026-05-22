import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ProjectContext } from "../types.js";

const CONTEXT_CACHE_TTL_MS = 10_000;
const contextCache = new Map<string, { ctx: ProjectContext; expires: number }>();

export function invalidateProjectContextCache(): void {
  contextCache.clear();
}

export function detectProjectContext(cwd = process.cwd()): ProjectContext {
  const resolvedCwd = path.resolve(cwd);
  const now = Date.now();
  const cached = contextCache.get(resolvedCwd);
  if (cached && cached.expires > now) return cached.ctx;

  const ctx = detectProjectContextUncached(resolvedCwd);
  contextCache.set(resolvedCwd, { ctx, expires: now + CONTEXT_CACHE_TTL_MS });
  return ctx;
}

function detectProjectContextUncached(resolvedCwd: string): ProjectContext {
  const gitRoot = git(["rev-parse", "--show-toplevel"], resolvedCwd);
  const projectRoot = gitRoot ?? findUp(resolvedCwd, "_bmad") ?? resolvedCwd;
  const branch = gitRoot ? git(["branch", "--show-current"], projectRoot) : undefined;
  const hasBmad = fs.existsSync(path.join(projectRoot, "_bmad"));
  const serenaProjectFile = path.join(projectRoot, ".serena", "project.yml");
  const hasSerena = fs.existsSync(serenaProjectFile);
  const hasForge = fs.existsSync(path.join(projectRoot, "forge", "package.json")) ||
    fs.existsSync(path.join(projectRoot, "package.json"));
  const bmadPlanningDir = hasBmad
    ? path.join(projectRoot, "_bmad-output", "planning-artifacts")
    : undefined;

  return {
    cwd: resolvedCwd,
    projectRoot,
    gitRoot,
    branch,
    hasBmad,
    hasSerena,
    hasForge,
    bmadPlanningDir,
    serenaProjectFile: hasSerena ? serenaProjectFile : undefined,
    packageManager: detectPackageManager(projectRoot),
  };
}

export function formatProjectContext(ctx: ProjectContext, opts: { portable?: boolean } = {}): string {
  const projectRoot = opts.portable ? "." : ctx.projectRoot;
  const gitRoot = opts.portable && ctx.gitRoot === ctx.projectRoot ? "." : ctx.gitRoot;
  return [
    `projectRoot: ${projectRoot}`,
    `gitRoot: ${gitRoot ?? "(none)"}`,
    `branch: ${ctx.branch ?? "(none)"}`,
    `BMAD: ${ctx.hasBmad ? "yes" : "no"}`,
    `Serena: ${ctx.hasSerena ? "yes" : "no"}`,
    `Forge: ${ctx.hasForge ? "yes" : "no"}`,
    `packageManager: ${ctx.packageManager ?? "none"}`,
  ].join("\n");
}

function detectPackageManager(projectRoot: string): ProjectContext["packageManager"] {
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectRoot, "package-lock.json"))) return "npm";
  if (fs.existsSync(path.join(projectRoot, "package.json"))) return "npm";
  if (fs.existsSync(path.join(projectRoot, "forge", "package-lock.json"))) return "npm";
  if (fs.existsSync(path.join(projectRoot, "forge", "package.json"))) return "npm";
  return "none";
}

function git(args: string[], cwd: string): string | undefined {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return undefined;
  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

function findUp(start: string, marker: string): string | undefined {
  let current = start;
  while (true) {
    if (fs.existsSync(path.join(current, marker))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
