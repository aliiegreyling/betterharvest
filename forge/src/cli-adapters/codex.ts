import { CliAdapter } from "./types.js";

export const codexAdapter: CliAdapter = {
  name: "codex",
  binName: "codex",
  defaultModelFlag: "",

  // Codex CLI runs in --full-auto mode with its own sandbox; it doesn't accept
  // a per-call tool allowlist the way Claude Code does. We ignore the
  // canonical tool list and let codex use its built-in fs + shell.
  translateTools() {
    return [];
  },

  buildArgs(opts) {
    const args = [
      "exec",
      "--cd",
      opts.cwd,
      "--skip-git-repo-check",
    ];
    if (opts.modelFlag) args.push("--model", opts.modelFlag);
    if (!opts.chatOnly) args.push("--sandbox", "workspace-write");
    args.push(opts.prompt);
    return args;
  },

  parseOutput(stdout) {
    // Codex CLI streams plain text. No structured usage data on stdout today,
    // so we return the tail as finalText and leave cost/tokens unset.
    const tail = stdout.slice(-4000);
    return { finalText: tail };
  },
};
