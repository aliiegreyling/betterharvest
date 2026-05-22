import { describe, it, expect } from "vitest";
import { isRateLimitFailure, isTransientFailure, backoffDelay } from "../src/agents/sub-agent.js";

describe("isTransientFailure", () => {
  it("returns false on exit 0", () => {
    expect(isTransientFailure({ exitCode: 0, stderr: "anything", finalText: "anything" })).toBe(false);
  });

  it("detects rate limits", () => {
    expect(isTransientFailure({ exitCode: 1, stderr: "HTTP 429 rate limit exceeded", finalText: "" })).toBe(true);
    expect(isTransientFailure({ exitCode: 1, stderr: "too many requests", finalText: "" })).toBe(true);
  });

  it("detects local session limits as rate limits", () => {
    expect(isRateLimitFailure({ exitCode: 1, stderr: "", finalText: "You've hit your session limit · resets 5:40pm" })).toBe(true);
    expect(isRateLimitFailure({ exitCode: 1, stderr: "insufficient_quota", finalText: "" })).toBe(true);
  });

  it("detects upstream 5xx", () => {
    for (const code of ["502 bad gateway", "503 service unavailable", "504 gateway timeout", "529 overloaded"]) {
      expect(isTransientFailure({ exitCode: 1, stderr: code, finalText: "" })).toBe(true);
    }
  });

  it("detects network resets", () => {
    expect(isTransientFailure({ exitCode: 1, stderr: "ECONNRESET", finalText: "" })).toBe(true);
    expect(isTransientFailure({ exitCode: 1, stderr: "socket hang up", finalText: "" })).toBe(true);
    expect(isTransientFailure({ exitCode: 1, stderr: "ETIMEDOUT", finalText: "" })).toBe(true);
  });

  it("treats GNU timeout(1) exit 124 as transient", () => {
    expect(isTransientFailure({ exitCode: 124, stderr: "", finalText: "" })).toBe(true);
  });

  it("does not retry on hard failures", () => {
    expect(isTransientFailure({ exitCode: 1, stderr: "auth: invalid api key", finalText: "" })).toBe(false);
    expect(isTransientFailure({ exitCode: 1, stderr: "syntax error", finalText: "" })).toBe(false);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially with attempt and stays bounded", () => {
    for (let i = 0; i < 10; i++) {
      const d = backoffDelay(i);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(30_000);
    }
  });

  it("attempt 1 is at least the base delay", () => {
    // attempt 0 → 1500 * 2^0 = 1500 plus jitter
    const d = backoffDelay(0);
    expect(d).toBeGreaterThanOrEqual(1_500);
  });
});
