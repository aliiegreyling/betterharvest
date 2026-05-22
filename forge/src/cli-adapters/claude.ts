import { CliAdapter } from "./types.js";
import { debugLog } from "../util/diagnostics.js";

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
    ];
    if (!opts.chatOnly && opts.allowedTools && opts.allowedTools.length > 0) {
      args.push("--permission-mode", "acceptEdits");
    }
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
      if (!result) {
        debugLog("claude-adapter", "no result event found in output", { eventCount: events.length });
        return { finalText: trimmed.slice(-4000) };
      }
      return {
        finalText: result.result ?? result.text,
        costUsd: result.total_cost_usd ?? result.cost_usd,
        tokensIn: result.usage?.input_tokens,
        tokensOut: result.usage?.output_tokens,
      };
    } catch (err) {
      // Output wasn't JSON — could be a CLI error, a non-JSON message, or a streaming
      // protocol change. Surface the raw output as finalText so the caller can act on
      // it instead of silently producing an empty result.
      debugLog("claude-adapter", "failed to parse JSON output", {
        error: err instanceof Error ? err.message : String(err),
        head: trimmed.slice(0, 200),
        tail: trimmed.slice(-200),
      });
      return { finalText: trimmed.slice(-4000) };
    }
  },
};
