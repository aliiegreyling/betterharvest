import type { AuditEvent, Phase, PlanNode } from "../types.js";

export type ForgeRunEventType =
  | "run_created"
  | "plan_written"
  | "phase_start"
  | "cli_output"
  | "cli_call"
  | "phase_end"
  | "approval_requested"
  | "approval_granted"
  | "changes_requested"
  | "approval_aborted"
  | "checkpoint_saved"
  | "run_done"
  | "run_error";

export interface ForgeRunEvent {
  ts: string;
  runId: string;
  type: ForgeRunEventType;
  nodeId?: string;
  phase?: Phase;
  phaseName?: string;
  modelId?: string;
  targetDir?: string;
  runDir?: string;
  checkpoint?: string;
  line?: string;
  ok?: boolean;
  message?: string;
  audit?: AuditEvent;
  node?: PlanNode;
  data?: unknown;
}

export type ForgeRunEventHandler = (event: ForgeRunEvent) => void;

export function createRunEvent(
  runId: string,
  type: ForgeRunEventType,
  fields: Omit<ForgeRunEvent, "ts" | "runId" | "type"> = {}
): ForgeRunEvent {
  return {
    ts: new Date().toISOString(),
    runId,
    type,
    ...fields,
  };
}
