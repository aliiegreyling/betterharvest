import { CliResult } from "../types.js";

const ANTHROPIC_MODEL_ENV: Record<string, string> = {
  haiku: "ANTHROPIC_HAIKU_MODEL",
  sonnet: "ANTHROPIC_SONNET_MODEL",
  opus: "ANTHROPIC_OPUS_MODEL",
};

const ANTHROPIC_MODEL_DEFAULTS: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

export function apiFallbackAvailable(modelId: string): boolean {
  if (modelId === "codex") return Boolean(process.env.OPENAI_API_KEY);
  if (modelId in ANTHROPIC_MODEL_DEFAULTS) return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}

export async function runApiFallback(opts: {
  modelId: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<CliResult> {
  if (opts.modelId === "codex") return runOpenAiResponses(opts.prompt, opts.timeoutMs);
  if (opts.modelId in ANTHROPIC_MODEL_DEFAULTS) return runAnthropicMessages(opts.modelId, opts.prompt, opts.timeoutMs);
  return failed(`No API fallback registered for model ${opts.modelId}`);
}

async function runOpenAiResponses(prompt: string, timeoutMs?: number): Promise<CliResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return failed("OPENAI_API_KEY is not set");

  const started = Date.now();
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.2",
        input: prompt,
      }),
    });
    const text = await res.text();
    if (!res.ok) return failed(`OpenAI API failed HTTP ${res.status}: ${text}`, Date.now() - started, res.status);
    const parsed = JSON.parse(text);
    return {
      ok: true,
      stdout: text,
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - started,
      tokensIn: parsed.usage?.input_tokens,
      tokensOut: parsed.usage?.output_tokens,
      finalText: extractOpenAiText(parsed) || text.slice(-4000),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failed(`OpenAI API fallback error: ${message}`, Date.now() - started);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runAnthropicMessages(modelId: string, prompt: string, timeoutMs?: number): Promise<CliResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return failed("ANTHROPIC_API_KEY is not set");

  const started = Date.now();
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: anthropicModelName(modelId),
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const text = await res.text();
    if (!res.ok) return failed(`Anthropic API failed HTTP ${res.status}: ${text}`, Date.now() - started, res.status);
    const parsed = JSON.parse(text);
    return {
      ok: true,
      stdout: text,
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - started,
      tokensIn: parsed.usage?.input_tokens,
      tokensOut: parsed.usage?.output_tokens,
      finalText: extractAnthropicText(parsed) || text.slice(-4000),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failed(`Anthropic API fallback error: ${message}`, Date.now() - started);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function anthropicModelName(modelId: string): string {
  return process.env[ANTHROPIC_MODEL_ENV[modelId]] ?? ANTHROPIC_MODEL_DEFAULTS[modelId];
}

function extractOpenAiText(parsed: any): string {
  if (typeof parsed.output_text === "string") return parsed.output_text;
  const parts: string[] = [];
  for (const item of parsed.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function extractAnthropicText(parsed: any): string {
  return (parsed.content ?? [])
    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\n");
}

function failed(message: string, durationMs = 0, exitCode = -1): CliResult {
  return {
    ok: false,
    stdout: "",
    stderr: message,
    exitCode,
    durationMs,
    finalText: message,
  };
}
