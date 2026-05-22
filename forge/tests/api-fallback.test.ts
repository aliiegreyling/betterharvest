import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFallbackAvailable, runApiFallback } from "../src/api/fallback.js";

const originalOpenAi = process.env.OPENAI_API_KEY;
const originalAnthropic = process.env.ANTHROPIC_API_KEY;
const originalOpenAiModel = process.env.OPENAI_MODEL;
const originalHaikuModel = process.env.ANTHROPIC_HAIKU_MODEL;

afterEach(() => {
  setEnv("OPENAI_API_KEY", originalOpenAi);
  setEnv("ANTHROPIC_API_KEY", originalAnthropic);
  setEnv("OPENAI_MODEL", originalOpenAiModel);
  setEnv("ANTHROPIC_HAIKU_MODEL", originalHaikuModel);
  vi.unstubAllGlobals();
});

describe("apiFallbackAvailable", () => {
  it("uses OPENAI_API_KEY for Codex/OpenAI fallback", () => {
    setEnv("OPENAI_API_KEY", "test-openai");
    expect(apiFallbackAvailable("codex")).toBe(true);
    setEnv("OPENAI_API_KEY", undefined);
    expect(apiFallbackAvailable("codex")).toBe(false);
  });

  it("uses ANTHROPIC_API_KEY for Claude fallback models", () => {
    setEnv("ANTHROPIC_API_KEY", "test-anthropic");
    expect(apiFallbackAvailable("haiku")).toBe(true);
    expect(apiFallbackAvailable("sonnet")).toBe(true);
    expect(apiFallbackAvailable("opus")).toBe(true);
    setEnv("ANTHROPIC_API_KEY", undefined);
    expect(apiFallbackAvailable("sonnet")).toBe(false);
  });

  it("sends OpenAI fallback requests with the configured model", async () => {
    setEnv("OPENAI_API_KEY", "test-openai");
    setEnv("OPENAI_MODEL", "gpt-test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output_text: "ok",
      usage: { input_tokens: 1, output_tokens: 2 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await runApiFallback({ modelId: "codex", prompt: "hello" });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      body: JSON.stringify({ model: "gpt-test", input: "hello" }),
    }));
  });

  it("sends Anthropic fallback requests with the configured model", async () => {
    setEnv("ANTHROPIC_API_KEY", "test-anthropic");
    setEnv("ANTHROPIC_HAIKU_MODEL", "claude-test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 2 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await runApiFallback({ modelId: "haiku", prompt: "hello" });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      body: JSON.stringify({
        model: "claude-test",
        max_tokens: 4096,
        messages: [{ role: "user", content: "hello" }],
      }),
    }));
  });
});

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
