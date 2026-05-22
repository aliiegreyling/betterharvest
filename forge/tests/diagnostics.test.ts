import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { debugScopesAllowed } from "../src/util/diagnostics.js";

const ORIGINAL = process.env.FORGE_DEBUG;
const ORIGINAL_DEBUG = process.env.DEBUG;

beforeEach(() => {
  delete process.env.FORGE_DEBUG;
  delete process.env.DEBUG;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.FORGE_DEBUG; else process.env.FORGE_DEBUG = ORIGINAL;
  if (ORIGINAL_DEBUG === undefined) delete process.env.DEBUG; else process.env.DEBUG = ORIGINAL_DEBUG;
});

describe("debugScopesAllowed", () => {
  it("returns false with no env set", () => {
    expect(debugScopesAllowed("cli-runner")).toBe(false);
  });

  it("respects explicit override", () => {
    expect(debugScopesAllowed("cli-runner", true)).toBe(true);
  });

  it("legacy values enable everything", () => {
    for (const v of ["1", "true", "forge", "forge:*", "*"]) {
      process.env.FORGE_DEBUG = v;
      expect(debugScopesAllowed("anything")).toBe(true);
      expect(debugScopesAllowed("cli-runner")).toBe(true);
    }
  });

  it("comma-separated scopes filter exact matches", () => {
    process.env.FORGE_DEBUG = "cli-runner,router";
    expect(debugScopesAllowed("cli-runner")).toBe(true);
    expect(debugScopesAllowed("router")).toBe(true);
    expect(debugScopesAllowed("gui")).toBe(false);
  });

  it("ignores whitespace in scope list", () => {
    process.env.FORGE_DEBUG = " cli-runner , router ";
    expect(debugScopesAllowed("cli-runner")).toBe(true);
    expect(debugScopesAllowed("router")).toBe(true);
  });

  it("falls back to DEBUG env when FORGE_DEBUG unset", () => {
    process.env.DEBUG = "router";
    expect(debugScopesAllowed("router")).toBe(true);
    expect(debugScopesAllowed("gui")).toBe(false);
  });
});
