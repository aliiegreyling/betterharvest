import fs from "node:fs";
import path from "node:path";
import { Plan, ProjectContext } from "../types.js";

export function writeBmadPlanArtifact(ctx: ProjectContext, plan: Plan): string | undefined {
  if (!ctx.bmadPlanningDir) return undefined;

  const dir = path.join(ctx.bmadPlanningDir, "forge-runs", plan.runId);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(dir, "plan.md"), renderPlan(plan));
  return dir;
}

export function writeContextArtifact(ctx: ProjectContext, content: string): string | undefined {
  if (!ctx.bmadPlanningDir) return undefined;
  const dir = path.join(ctx.bmadPlanningDir, "forge-context");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "project-context.md");
  fs.writeFileSync(file, content);
  return file;
}

export function writeDesignArtifact(
  ctx: ProjectContext,
  domain: string,
  prompt: string,
  content: string
): string | undefined {
  if (!ctx.bmadPlanningDir) return undefined;
  const safeDomain = domain.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const dir = path.join(ctx.bmadPlanningDir, "forge-design");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeDomain}-design.md`);
  fs.writeFileSync(
    file,
    [
      `# Forge ${domain} Design`,
      "",
      `Prompt: ${prompt}`,
      "",
      content,
      "",
    ].join("\n")
  );
  return file;
}

function renderPlan(plan: Plan): string {
  return [
    `# Forge Plan: ${plan.runId}`,
    "",
    `Mode: ${plan.mode ?? "new"}`,
    `Prompt: ${plan.prompt}`,
    `Context budget: ${plan.contextBudget}`,
    plan.modelOverride ? `Model override: ${plan.modelOverride}` : undefined,
    "",
    "## Classification",
    "",
    "```json",
    JSON.stringify(plan.classification, null, 2),
    "```",
    "",
    "## Nodes",
    "",
    "| Phase | Role | Model | Approval Gate | Goal |",
    "| --- | --- | --- | --- | --- |",
    ...plan.nodes.map((n) =>
      `| ${n.phase} | ${n.role} | ${n.modelId} | ${n.approvalGate?.label ?? ""} | ${n.goal.replace(/\|/g, "\\|")} |`
    ),
    "",
  ].filter((line): line is string => line !== undefined).join("\n");
}
