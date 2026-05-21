import { CliKind, CliResult } from "../types.js";

export interface InvokeOpts {
  prompt: string;
  cwd: string;
  modelFlag: string;
  allowedTools?: string[];
  timeoutMs?: number;
  onLine?: (line: string) => void;
}

export interface CliAdapter {
  name: CliKind;
  binName: string;
  buildArgs(opts: InvokeOpts): string[];
  parseOutput(stdout: string): {
    finalText?: string;
    costUsd?: number;
    tokensIn?: number;
    tokensOut?: number;
  };
  /**
   * Translate forge's canonical tool names into the CLI's allowedTools syntax.
   * Forge canonical tools: read, write, edit, glob, grep, bash.
   */
  translateTools?(canonical: string[]): string[];
  /**
   * Default model flag if the registry entry doesn't specify one
   * (useful when a phase routes to an adapter generically).
   */
  defaultModelFlag?: string;
}

export type InvokeFn = (opts: InvokeOpts) => Promise<CliResult>;
