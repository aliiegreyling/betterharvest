import chalk from "chalk";

export interface ErrorReport {
  title: string;
  message: string;
  nextSteps: string[];
  debug: string;
}

export interface ErrorPrintOptions {
  command?: string;
  verbose?: boolean;
}

export function verboseEnabled(explicit = false): boolean {
  if (explicit) return true;
  const value = process.env.FORGE_DEBUG ?? process.env.DEBUG;
  return value === "1" || value === "true" || value === "forge" || value === "forge:*";
}

export function debugLog(scope: string, message: string, data?: unknown, verbose = false): void {
  if (!verboseEnabled(verbose)) return;
  const suffix = data === undefined ? "" : ` ${safeJson(data)}`;
  console.error(chalk.dim(`[debug:${scope}] ${message}${suffix}`));
}

export function printUserError(error: unknown, opts: ErrorPrintOptions = {}): void {
  const report = toErrorReport(error);
  const command = opts.command ? ` ${opts.command}` : "";

  console.error(chalk.red(`Forge${command} failed: ${report.title}`));
  console.error(report.message);

  if (report.nextSteps.length > 0) {
    console.error(chalk.bold("Next steps:"));
    for (const step of report.nextSteps) console.error(`  - ${step}`);
  }

  if (verboseEnabled(opts.verbose)) {
    console.error(chalk.dim("Debug details:"));
    console.error(chalk.dim(report.debug));
  } else {
    console.error(chalk.dim("Run with FORGE_DEBUG=1 or use /set debug true for verbose diagnostics."));
  }
}

export function toErrorReport(error: unknown): ErrorReport {
  const err = normalizeError(error);
  const raw = [err.message, err.stack].filter(Boolean).join("\n");

  if (/not logged in|please run \/login|auth/i.test(raw)) {
    return {
      title: "Model CLI is not authenticated",
      message: err.message,
      nextSteps: [
        "Run the provider CLI login flow, for example `claude` then `/login`, or authenticate Codex CLI.",
        "After login, retry the same Forge command.",
        "Use `/request ...` if you only want to capture a project idea without invoking a model.",
      ],
      debug: raw,
    };
  }

  if (/not found on PATH|not found/i.test(raw) && /CLI|claude|codex/i.test(raw)) {
    return {
      title: "Required model CLI is unavailable",
      message: err.message,
      nextSteps: [
        "Install and authenticate Claude Code, then confirm `claude --version` works.",
        "Install Codex CLI if you route work to `codex`.",
        "Run `forge doctor` or `/doctor` once configured.",
      ],
      debug: raw,
    };
  }

  if (/Unknown model id/i.test(raw)) {
    return {
      title: "Unknown model id",
      message: err.message,
      nextSteps: [
        "Run `/models` or `forge models` to list supported model ids.",
        "Use `/set model none` to return to automatic routing.",
      ],
      debug: raw,
    };
  }

  if (/No request captured/i.test(raw)) {
    return {
      title: "No project request captured",
      message: err.message,
      nextSteps: [
        "Type a request first, or pass the prompt inline after the command.",
        "Use `/request <project idea>` to capture a request without calling a model.",
      ],
      debug: raw,
    };
  }

  if (/requires a value|Usage:|Invalid context budget|Unknown flag|Unknown setting/i.test(raw)) {
    return {
      title: "Invalid command input",
      message: err.message,
      nextSteps: [
        "Run `/help` in chat or `forge --help` for command usage.",
        "Wrap multi-word prompts in quotes when passing them as command arguments.",
      ],
      debug: raw,
    };
  }

  if (/timed out|timeout/i.test(raw)) {
    return {
      title: "Operation timed out",
      message: err.message,
      nextSteps: [
        "Retry the command once to rule out a transient provider issue.",
        "Use a smaller request or lower context budget if the prompt is large.",
        "Enable verbose diagnostics with FORGE_DEBUG=1 if it repeats.",
      ],
      debug: raw,
    };
  }

  return {
    title: "Unexpected error",
    message: err.message,
    nextSteps: [
      "Retry with FORGE_DEBUG=1 for a stack trace and command context.",
      "Check `forge doctor` if the command uses a model provider.",
    ],
    debug: raw,
  };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error(safeJson(error));
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
