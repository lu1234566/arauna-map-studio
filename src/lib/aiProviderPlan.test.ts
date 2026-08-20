import { describe, expect, it } from "vitest";
import { AI_MAP_PLAN_FORMAT } from "./aiMapPlan";
import { parseAiProviderPlan } from "./aiProviderPlan";

describe("AI provider plan normalization", () => {
  it("turns a singleton connection object into a one-item array", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Cidade teste",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: { direction: "north", map: "MAP_ROUTE101", offset: 0 },
      notes: [],
    }));

    expect(plan.connections).toEqual([{ direction: "north", map: "MAP_ROUTE101", offset: 0 }]);
  });

  it("normalizes empty objects and missing collections to empty arrays", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Cidade vazia",
      width: 20,
      height: 20,
      structures: {},
      routes: {},
      warps: {},
      connections: {},
      notes: "Sem caminhos disponíveis.",
    }));

    expect(plan.structures).toEqual([]);
    expect(plan.routes).toEqual([]);
    expect(plan.warps).toEqual([]);
    expect(plan.connections).toEqual([]);
    expect(plan.notes).toEqual(["Sem caminhos disponíveis."]);
  });

  it("rejects primitive collection values instead of crashing later", () => {
    expect(() => parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Inválido",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: "north",
      notes: [],
    }))).toThrow(/connections/);
  });
});
