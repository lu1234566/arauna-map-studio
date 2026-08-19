import { describe, expect, it } from "vitest";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";
import { MAP_BLUEPRINT_FORMAT, compileMapBlueprint, parseMapBlueprintJson } from "./mapBlueprint";

function pattern(): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id: "house-rural",
    name: "Casa Rural",
    category: "Construção",
    tags: [],
    width: 3,
    height: 2,
    kind: "visual",
    values: [1, 1, 1, 2, 2, 2],
    scope: { primary: "gTileset_General", secondary: "gTileset_Petalburg" },
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

describe("Map Blueprint compiler", () => {
  it("resolves human names into stable pattern and Smart Path ids", () => {
    const path = createSmartPathPreset("Estrada de Terra", 100, 0, {
      primary: "gTileset_General",
      secondary: "gTileset_Petalburg",
    });
    path.id = "dirt-road";
    path.variants = Array.from({ length: 16 }, (_, index) => 100 + index);

    const blueprint = parseMapBlueprintJson(JSON.stringify({
      format: MAP_BLUEPRINT_FORMAT,
      name: "Vila Teste",
      width: 20,
      height: 15,
      patterns: [{ pattern: "Casa Rural", x: 3, y: 4 }],
      routes: [{ smartPath: "Estrada de Terra", points: [{ x: 1, y: 10 }, { x: 15, y: 10 }] }],
    }));

    const result = compileMapBlueprint(blueprint, [pattern()], [path]);
    expect(result.valid).toBe(true);
    expect(result.template?.elements).toEqual([
      { type: "pattern", patternId: "house-rural", x: 3, y: 4 },
      { type: "smartPath", presetId: "dirt-road", points: [{ x: 1, y: 10 }, { x: 15, y: 10 }], mode: "add" },
    ]);
    expect(result.template?.scope).toEqual({ primary: "gTileset_General", secondary: "gTileset_Petalburg" });
  });

  it("fails closed when an AI invents a resource name", () => {
    const blueprint = parseMapBlueprintJson(JSON.stringify({
      format: MAP_BLUEPRINT_FORMAT,
      name: "Inválido",
      width: 20,
      height: 15,
      patterns: [{ pattern: "Castelo Inventado", x: 2, y: 2 }],
      routes: [],
    }));
    const result = compileMapBlueprint(blueprint, [pattern()], []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.includes("não existe"))).toBe(true);
  });

  it("rejects diagonal path segments before they reach Emerald data", () => {
    const path = createSmartPathPreset("Estrada", 100, 0);
    path.variants = Array.from({ length: 16 }, (_, index) => 100 + index);
    const blueprint = parseMapBlueprintJson(JSON.stringify({
      format: MAP_BLUEPRINT_FORMAT,
      name: "Diagonal",
      width: 20,
      height: 15,
      patterns: [],
      routes: [{ smartPath: "Estrada", points: [{ x: 1, y: 1 }, { x: 4, y: 5 }] }],
    }));
    const result = compileMapBlueprint(blueprint, [], [path]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.includes("ortogonal"))).toBe(true);
  });
});
