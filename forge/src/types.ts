import type { ForgeRunEventHandler } from "./runtime/events.js";

export type Complexity = "S" | "M" | "L" | "XL";

export type Phase =
  | "classify"
  | "ba"
  | "tech_arch"
  | "ux_design"
  | "arch_synthesis"
  | "stories"
  | "dev"
  | "qa"
  | "infra"
  | "review";

export type ContextBudget = "low" | "standard" | "deep";
export type RunMode = "new" | "work";

export type Strength =
  | "classification"
  | "planning"
  | "coding"
  | "reasoning"
  | "review"
  | "long-context";

export type CliKind = "claude" | "codex";

export interface ModelMeta {
  id: string;
  cli: CliKind;
  cliModelFlag: string;
  strengths: Strength[];
  latencyClass: "fast" | "medium" | "slow";
  notes?: string;
}

export interface Classification {
  projectType: string;
  complexity: Complexity;
  estFiles: number;
  requiresUi: boolean;
  stackHint: string;
  ambiguityScore: number;
  summary: string;
}

export interface PlanNode {
  id: string;
  phase: Phase;
  role: string;
  modelId: string;
  goal: string;
  inputs: string[];
  allowedTools: string[];
  approvalGate?: ApprovalGate;
  expectedArtifacts?: string[];
}

export interface RoleGuide {
  phase: Phase;
  name: string;
  content: string;
}

export interface ApprovalGate {
  id: string;
  label: string;
  approverRole: string;
  maxRevisionCycles: number;
}

export interface ProjectContext {
  cwd: string;
  projectRoot: string;
  gitRoot?: string;
  branch?: string;
  hasBmad: boolean;
  hasSerena: boolean;
  hasForge: boolean;
  bmadPlanningDir?: string;
  serenaProjectFile?: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "none";
}

export interface McpServerConfig {
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  source: string;
  risk: "low" | "medium" | "high";
}

export interface McpHealth {
  name: string;
  ok: boolean;
  source: string;
  message: string;
}

export interface Plan {
  runId: string;
  createdAt: string;
  mode: RunMode;
  prompt: string;
  targetDir?: string;
  classification: Classification;
  nodes: PlanNode[];
  contextBudget: ContextBudget;
  modelOverride?: string;
  projectContext?: ProjectContext;
}

export interface AuditEvent {
  ts: string;
  runId: string;
  nodeId?: string;
  agent?: string;
  modelId?: string;
  cli?: CliKind;
  kind:
    | "cli_call"
    | "phase_start"
    | "phase_end"
    | "cli_output"
    | "approval_requested"
    | "approval_granted"
    | "changes_requested"
    | "approval_aborted"
    | "error"
    | "info";
  durationMs?: number;
  exitCode?: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  ok?: boolean;
  message?: string;
  approvalGateId?: string;
  approverRole?: string;
  revision?: number;
}

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  finalText: string;
}

export interface RunContext {
  runId: string;
  runDir: string;
  targetDir: string;
  mode: RunMode;
  estCostUsd: number;
  projectContext: ProjectContext;
  contextBudget: ContextBudget;
  modelOverride?: string;
  bmadOutput: boolean;
  phaseNotes?: Partial<Record<Phase, string>>;
  roleGuides?: Partial<Record<Phase, RoleGuide[]>>;
  onEvent?: ForgeRunEventHandler;
}
