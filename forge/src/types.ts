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

export interface ModelMeta {
  id: string;
  provider: "anthropic";
  apiId: string;
  contextWindow: number;
  costPer1MIn: number;
  costPer1MOut: number;
  strengths: Strength[];
  latencyClass: "fast" | "medium" | "slow";
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
  budgetUsd: number;
  tools: ToolName[];
}

export interface Plan {
  runId: string;
  createdAt: string;
  prompt: string;
  classification: Classification;
  nodes: PlanNode[];
  totalBudgetUsd: number;
}

export type ToolName = "read_file" | "write_file" | "edit_file" | "list_files" | "shell";

export interface AuditEvent {
  ts: string;
  runId: string;
  nodeId?: string;
  agent?: string;
  modelId?: string;
  kind: "model_call" | "tool_call" | "phase_start" | "phase_end" | "error" | "info";
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  tool?: string;
  ok?: boolean;
  message?: string;
  data?: unknown;
}

export interface CompletionRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  tools?: ToolSchema[];
}

export interface ToolSchema {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CompletionResponse {
  text: string;
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
  stopReason: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface RunContext {
  runId: string;
  runDir: string;
  targetDir: string;
  budgetUsd: number;
  spentUsd: number;
}
