import { CliAdapter } from "./types.js";

const TOOL_MAP: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  glob: "Glob",
  grep: "Grep",
  bash: "Bash",
};

export const claudeAdapter: CliAdapter = {
  name: "claude",
  binName: "claude",
  defaultModelFlag: "sonnet",

  translateTools(canonical) {
    return canonical.map((c) => TOOL_MAP[c.toLowerCase()] ?? c);
  },

  buildArgs(opts) {
    const args: string[] = [
      "-p",
      opts.prompt,
      "--model",
      opts.modelFlag,
      "--output-format",
      "json",
      "--permission-mode",
      "acceptEdits",
    ];
    if (opts.allowedTools && opts.allowedTools.length > 0) {
      args.push("--allowedTools", opts.allowedTools.join(","));
    }
    return args;
  },

  parseOutput(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      // --output-format json emits a JSON array of stream events; the final
      // event has type:"result" and carries the model's text, cost, and usage.
      const events: any[] = Array.isArray(parsed) ? parsed : [parsed];
      const result = [...events].reverse().find((e) => e?.type === "result") ?? events[events.length - 1];
      if (!result) return {};
      return {
        finalText: result.result ?? result.text,
        costUsd: result.total_cost_usd ?? result.cost_usd,
        tokensIn: result.usage?.input_tokens,
        tokensOut: result.usage?.output_tokens,
      };
    } catch {
      return {};
    }
  },
};
