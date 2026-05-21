export type Complexity = "S" | "M" | "L" | "XL";

export type Phase =
  | "classify"
  | "brief"
  | "arch"
  | "stories"
  | "impl"
  | "verify"
  | "review";

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
}

export interface Plan {
  runId: string;
  createdAt: string;
  prompt: string;
  classification: Classification;
  nodes: PlanNode[];
}

export interface AuditEvent {
  ts: string;
  runId: string;
  nodeId?: string;
  agent?: string;
  modelId?: string;
  cli?: CliKind;
  kind: "cli_call" | "phase_start" | "phase_end" | "error" | "info";
  durationMs?: number;
  exitCode?: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  ok?: boolean;
  message?: string;
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
  estCostUsd: number;
}
