import { describe, it, expect, beforeEach } from "vitest";
import { detectProjectContext, invalidateProjectContextCache } from "../src/project/context.js";

describe("detectProjectContext cache", () => {
  beforeEach(() => {
    invalidateProjectContextCache();
  });

  it("returns equivalent results for the same cwd", () => {
    const a = detectProjectContext(process.cwd());
    const b = detectProjectContext(process.cwd());
    expect(b).toEqual(a);
  });

  it("returns the identical cached instance within TTL", () => {
    const a = detectProjectContext(process.cwd());
    const b = detectProjectContext(process.cwd());
    // Same in-memory object reference indicates the cache hit, not just equal values.
    expect(b).toBe(a);
  });

  it("invalidate forces a fresh detection", () => {
    const a = detectProjectContext(process.cwd());
    invalidateProjectContextCache();
    const b = detectProjectContext(process.cwd());
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
});
