import { CliKind } from "../types.js";
import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { CliAdapter } from "./types.js";

export const ADAPTERS: Record<CliKind, CliAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

export function getAdapter(cli: CliKind): CliAdapter {
  const a = ADAPTERS[cli];
  if (!a) throw new Error(`No adapter registered for CLI: ${cli}`);
  return a;
}

export function listAdapters(): CliAdapter[] {
  return Object.values(ADAPTERS);
}

export type { CliAdapter } from "./types.js";
