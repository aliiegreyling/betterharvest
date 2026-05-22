import fs from "node:fs";
import path from "node:path";
import type { RunMode } from "../types.js";

const OUTPUT_DIR_NAME = "forge-out";

interface ResolveTargetOptions {
  cwd?: string;
  runId?: string;
  mode?: RunMode | "resume";
}

export function forgeRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  while (true) {
    if (isForgePackage(dir)) return dir;
    const nestedForge = path.join(dir, "forge");
    if (isForgePackage(nestedForge)) return nestedForge;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function forgeOutputRoot(start = process.cwd()): string {
  return path.join(forgeRoot(start), OUTPUT_DIR_NAME);
}

export function resolveForgeTargetDir(input?: string, opts: ResolveTargetOptions = {}): string {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const outputRoot = forgeOutputRoot(cwd);
  const raw = input?.trim();
  const target = raw ? resolveWithinOutputRoot(raw, cwd, outputRoot) : outputRoot;

  if (shouldScopeToRun(target, outputRoot, opts)) {
    return path.join(outputRoot, opts.runId);
  }

  return target;
}

export function isInsideForgeOutput(target: string, start = process.cwd()): boolean {
  return isWithinOrEqual(forgeOutputRoot(start), path.resolve(target));
}

export function isForgeOutputRoot(target: string, start = process.cwd()): boolean {
  return samePath(forgeOutputRoot(start), path.resolve(target));
}

function resolveWithinOutputRoot(raw: string, cwd: string, outputRoot: string): string {
  const absoluteCandidate = path.resolve(cwd, raw);
  if (isWithinOrEqual(outputRoot, absoluteCandidate)) return absoluteCandidate;
  if (path.isAbsolute(raw)) {
    const base = path.basename(raw);
    return base === OUTPUT_DIR_NAME ? outputRoot : path.resolve(outputRoot, base);
  }

  const parts = raw.split(/[\\/]+/).filter((part) => part && part !== ".");
  const outputIndex = parts.lastIndexOf(OUTPUT_DIR_NAME);
  const scopedParts = outputIndex >= 0 ? parts.slice(outputIndex + 1) : parts;
  const safeParts = scopedParts.filter((part) => part !== "..");
  const mapped = safeParts.length > 0 ? path.resolve(outputRoot, ...safeParts) : outputRoot;

  if (!isWithinOrEqual(outputRoot, mapped)) {
    throw new Error(`Target directory must stay inside ${outputRoot}`);
  }

  return mapped;
}

function shouldScopeToRun(target: string, outputRoot: string, opts: ResolveTargetOptions): opts is ResolveTargetOptions & { runId: string } {
  return Boolean(opts.runId && opts.mode !== "work" && opts.mode !== "resume" && samePath(target, outputRoot));
}

function isForgePackage(dir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as { name?: string };
    return pkg.name === "forge" && fs.existsSync(path.join(dir, "src", "cli.ts"));
  } catch {
    return false;
  }
}

function isWithinOrEqual(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}
