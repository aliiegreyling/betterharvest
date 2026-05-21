import fs from "node:fs";
import path from "node:path";
import { formatProjectContext, detectProjectContext } from "./context.js";
import { writeContextArtifact, writeDesignArtifact } from "../bmad/artifacts.js";
import { checkMcpHealth, discoverMcpServers } from "../mcp/registry.js";

export function buildStatusText(cwd = process.cwd(), opts: { portable?: boolean } = {}): string {
  const ctx = detectProjectContext(cwd);
  const servers = discoverMcpServers(ctx);
  const health = servers.map((s) => checkMcpHealth(ctx, s));

  return [
    "# Forge Project Status",
    "",
    "## Project",
    "",
    "```text",
    formatProjectContext(ctx, opts),
    "```",
    "",
    "## MCP Servers",
    "",
    health.length === 0
      ? "No MCP servers discovered. Add `forge.mcp.json`, `.forge/mcp.json`, `.mcp.json`, or configure Serena."
      : health.map((h) => `- ${h.ok ? "OK" : "WARN"} ${h.name}: ${h.message} (${h.source})`).join("\n"),
    "",
  ].join("\n");
}

export function refreshContext(cwd = process.cwd()): string {
  const ctx = detectProjectContext(cwd);
  const content = buildStatusText(cwd, { portable: true });
  const artifact = writeContextArtifact(ctx, content);
  return artifact ?? path.join(ctx.projectRoot, "_bmad-output", "planning-artifacts", "forge-context", "project-context.md");
}

export function createDesignArtifact(domain: string, prompt: string, cwd = process.cwd()): string {
  const ctx = detectProjectContext(cwd);
  const content = [
    "## Intent",
    "",
    "This is a scaffold-domain planning artifact generated before implementation.",
    "",
    "## Current Project Context",
    "",
    "```text",
    formatProjectContext(ctx, { portable: true }),
    "```",
    "",
    "## Required Follow-Up",
    "",
    "- Validate assumptions with BMAD PRD and architecture flows.",
    "- Define acceptance criteria before code generation.",
    "- Identify MCP tools required for implementation or deployment.",
    "- Record approval requirements for shell, filesystem, cloud, and deployment actions.",
  ].join("\n");
  const artifact = writeDesignArtifact(ctx, domain, prompt, content);
  if (!artifact) {
    throw new Error("BMAD planning directory not found. Run from a BMAD-enabled project.");
  }
  return artifact;
}

export function createBrownfieldWorkPlan(request: string, cwd = process.cwd()): string {
  return createDesignArtifact("brownfield-work", request, cwd);
}

export function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
