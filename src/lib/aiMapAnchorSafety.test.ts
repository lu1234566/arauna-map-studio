import { describe, expect, it } from "vitest";
import { AI_MAP_PLAN_FORMAT, compileAiMapPlan, type AiMapPlan } from "./aiMapPlan";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";

const pattern: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "museum-real",
  name: "Museu Oceanográfico — completo",
  category: "Marco · Porto",
  tags: ["museu", "warp-anchor:28,27", "warp-destination:MAP_MUSEUM"],
  width: 7,
  height: 5,
  kind: "raw",
  values: Array.from({ length: 35 }, () => 0x3001),
  ports: [{ id: "entrada", name: "entrada", kind: "door", x: 3, y: 4, direction: "south" }],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

describe("AI map warp-anchor safety", () => {
  it("corrects an AI placement so the real entrance remains on the existing warp", () => {
    const plan: AiMapPlan = {
      format: AI_MAP_PLAN_FORMAT,
      name: "Porto do Sal",
      width: 40,
      height: 60,
      structures: [{ id: "museum", pattern: pattern.id, x: 2, y: 2 }],
      routes: [],
      warps: [],
      connections: [],
      notes: [],
    };

    const result = compileAiMapPlan(plan, [pattern], []);
    expect(result.valid).toBe(true);
    expect(result.blueprint?.patterns[0]).toEqual({ pattern: pattern.id, x: 25, y: 23 });
    expect(result.warnings.join(" ")).toContain("corrigida");
  });
});
