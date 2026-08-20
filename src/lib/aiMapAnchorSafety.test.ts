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

const market: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "market-real",
  name: "Mercado aberto real",
  category: "Comércio · conjunto",
  tags: ["mercado", "fixed-origin:2,35"],
  width: 10,
  height: 12,
  kind: "raw",
  values: Array.from({ length: 120 }, () => 0x3001),
  ports: [],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

function planFor(structure: AiMapPlan["structures"][number]): AiMapPlan {
  return {
    format: AI_MAP_PLAN_FORMAT,
    name: "Porto do Sal",
    width: 40,
    height: 60,
    structures: [structure],
    routes: [],
    warps: [],
    connections: [],
    notes: [],
  };
}

describe("AI map real-event anchor safety", () => {
  it("corrects an AI placement so the real entrance remains on the existing warp", () => {
    const result = compileAiMapPlan(
      planFor({ id: "museum", pattern: pattern.id, x: 2, y: 2 }),
      [pattern],
      [],
    );
    expect(result.valid).toBe(true);
    expect(result.blueprint?.patterns[0]).toEqual({ pattern: pattern.id, x: 25, y: 23 });
    expect(result.warnings.join(" ")).toContain("corrigida");
  });

  it("forces event-cluster patterns back to their fixed real-map origin", () => {
    const result = compileAiMapPlan(
      planFor({ id: "market", pattern: market.id, x: 20, y: 4 }),
      [market],
      [],
    );
    expect(result.valid).toBe(true);
    expect(result.blueprint?.patterns[0]).toEqual({ pattern: market.id, x: 2, y: 35 });
    expect(result.warnings.join(" ")).toContain("região semântica");
  });
});
