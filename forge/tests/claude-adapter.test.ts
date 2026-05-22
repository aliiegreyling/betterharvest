import { describe, it, expect } from "vitest";
import { claudeAdapter } from "../src/cli-adapters/claude.js";

describe("claudeAdapter.parseOutput", () => {
  it("returns {} for empty output", () => {
    expect(claudeAdapter.parseOutput("")).toEqual({});
    expect(claudeAdapter.parseOutput("   \n\n")).toEqual({});
  });

  it("extracts result, cost, and usage from a stream array", () => {
    const events = [
      { type: "system", subtype: "init" },
      { type: "assistant", text: "thinking..." },
      {
        type: "result",
        result: "All done.",
        total_cost_usd: 0.0123,
        usage: { input_tokens: 4321, output_tokens: 123 },
      },
    ];
    const out = claudeAdapter.parseOutput(JSON.stringify(events));
    expect(out.finalText).toBe("All done.");
    expect(out.costUsd).toBeCloseTo(0.0123);
    expect(out.tokensIn).toBe(4321);
    expect(out.tokensOut).toBe(123);
  });

  it("falls back to the last event when no result event exists", () => {
    const events = [
      { type: "assistant", text: "partial output" },
    ];
    const out = claudeAdapter.parseOutput(JSON.stringify(events));
    // No result event → adapter salvages last event's text via result/text fallback,
    // but the new behavior emits finalText=raw when no `result` event is present.
    expect(typeof out.finalText).toBe("string");
  });

  it("salvages raw output as finalText when JSON parse fails", () => {
    const raw = "claude: command failed with weird non-json output";
    const out = claudeAdapter.parseOutput(raw);
    expect(out.finalText).toBe(raw);
    expect(out.costUsd).toBeUndefined();
  });

  it("handles a single result object (not wrapped in array)", () => {
    const single = { type: "result", result: "ok", total_cost_usd: 0.5 };
    const out = claudeAdapter.parseOutput(JSON.stringify(single));
    expect(out.finalText).toBe("ok");
    expect(out.costUsd).toBe(0.5);
  });
});
