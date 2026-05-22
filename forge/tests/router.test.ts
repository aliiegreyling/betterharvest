import { describe, it, expect } from "vitest";
import { pickModel, escalate, annotateRouting } from "../src/agents/router.js";
import type { Classification, PlanNode } from "../src/types.js";

const baseClass: Classification = {
  projectType: "generic",
  complexity: "M",
  estFiles: 10,
  requiresUi: false,
  stackHint: "typescript",
  ambiguityScore: 0.3,
  summary: "",
};

describe("pickModel", () => {
  it("defaults dev to sonnet on medium complexity", () => {
    expect(pickModel("dev", baseClass)).toBe("sonnet");
  });

  it("escalates dev to opus on XL complexity", () => {
    expect(pickModel("dev", { ...baseClass, complexity: "XL" })).toBe("opus");
  });

  it("escalates ba to opus on high ambiguity", () => {
    expect(pickModel("ba", { ...baseClass, ambiguityScore: 0.8 })).toBe("opus");
  });

  it("downgrades ba to haiku on small complexity", () => {
    expect(pickModel("ba", { ...baseClass, complexity: "S" })).toBe("haiku");
  });

  it("escalates infra to opus on L complexity", () => {
    expect(pickModel("infra", { ...baseClass, complexity: "L" })).toBe("opus");
  });

  it("classify always uses haiku", () => {
    expect(pickModel("classify", { ...baseClass, complexity: "XL" })).toBe("haiku");
  });
});

describe("escalate", () => {
  it("walks the standard ladder", () => {
    expect(escalate("haiku")).toBe("sonnet");
    expect(escalate("sonnet")).toBe("opus");
  });

  it("returns null at the top of the ladder", () => {
    expect(escalate("opus")).toBeNull();
  });

  it("escalates codex into the standard ladder at sonnet", () => {
    expect(escalate("codex")).toBe("sonnet");
  });

  it("returns null for unknown models", () => {
    expect(escalate("totally-fake-model")).toBeNull();
  });
});

describe("annotateRouting", () => {
  const nodes: PlanNode[] = [
    { id: "n1", phase: "ba",  role: "ba",  goal: "x", modelId: "haiku", inputs: [], allowedTools: [] },
    { id: "n2", phase: "dev", role: "dev", goal: "x", modelId: "haiku", inputs: [], allowedTools: [] },
    { id: "n3", phase: "qa",  role: "qa",  goal: "x", modelId: "haiku", inputs: [], allowedTools: [] },
  ];

  it("uses pickModel when no override given", () => {
    const out = annotateRouting(nodes, baseClass);
    expect(out.map((n) => n.modelId)).toEqual(["sonnet", "sonnet", "sonnet"]);
  });

  it("applies override but never to qa", () => {
    const out = annotateRouting(nodes, baseClass, "opus");
    expect(out[0].modelId).toBe("opus");
    expect(out[1].modelId).toBe("opus");
    expect(out[2].modelId).toBe("sonnet"); // qa stays auto-routed
  });
});
