import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { isAiRemodelPrompt, planAiMapReconstruction } from "./aiMapReconstruction";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";

const atlas = {
  format: "arauna-real-atlas-v2",
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  columns: 16,
  tileSize: 16,
  width: 16,
  height: 16,
  createdAt: "2026-08-20T00:00:00.000Z",
  rgbaBase64: "",
  records: [
    { id: 1, source: "primary", localId: 1, behavior: 0x00, layerType: 0, slot: 0 },
    { id: 2, source: "primary", localId: 2, behavior: 0x00, layerType: 0, slot: 1 },
    { id: 3, source: "primary", localId: 3, behavior: 0x00, layerType: 0, slot: 2 },
    { id: 5, source: "primary", localId: 5, behavior: 0x10, layerType: 0, slot: 3 },
  ],
} as SavedRealAtlas;

const anchoredPattern: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "anchored-building",
  name: "Prédio ancorado",
  category: "Teste",
  tags: ["warp-anchor:5,5"],
  width: 2,
  height: 2,
  kind: "raw",
  values: [0x3002, 0x3002, 0x3002, 0x3002],
  ports: [{ id: "entrada", name: "entrada", kind: "door", x: 1, y: 1, direction: "south" }],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

describe("AI real-map reconstruction", () => {
  it("only normalizes safe normal ground and preserves events, structures, collision and coast", () => {
    const map = createEmptyMap(8, 8, 1);

    // Fragmented normal ground that should be cleaned.
    map.metatiles[idx(2, 2, map.width)] = 2;
    map.metatiles[idx(3, 2, map.width)] = 3;

    // Warp cell must remain untouched.
    map.metatiles[idx(1, 1, map.width)] = 2;

    // Blocked cell keeps its visual even though behavior is normal.
    map.metatiles[idx(0, 3, map.width)] = 2;
    map.physical[idx(0, 3, map.width)] = 0x0400;

    // Anchored building occupies origin (4,4) through (5,5).
    map.metatiles[idx(4, 4, map.width)] = 2;
    map.metatiles[idx(5, 4, map.width)] = 2;
    map.metatiles[idx(4, 5, map.width)] = 2;
    map.metatiles[idx(5, 5, map.width)] = 2;

    // Water + immediate shore must be preserved.
    for (let x = 0; x < map.width; x++) map.metatiles[idx(x, 7, map.width)] = 5;
    map.metatiles[idx(2, 6, map.width)] = 2;

    const result = planAiMapReconstruction(
      map,
      atlas,
      [anchoredPattern],
      [{ x: 1, y: 1, kind: "warp", label: "W0" }],
    );

    expect(result.baseMetatile).toBe(1);
    expect(result.changedCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(2, 2, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(3, 2, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(1, 1, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(0, 3, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(4, 4, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(5, 5, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(2, 6, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(2, 7, map.width)]).toBe(5);
    expect(result.map.physical[idx(0, 3, map.width)]).toBe(0x0400);
  });

  it("only enables reconstruction for broad remodel instructions", () => {
    expect(isAiRemodelPrompt("Remodele Slateport como Porto do Sal e reorganize as ruas.")).toBe(true);
    expect(isAiRemodelPrompt("Reconstrua as áreas livres da cidade.")).toBe(true);
    expect(isAiRemodelPrompt("Adicione uma placa perto do Centro Pokémon.")).toBe(false);
  });
});
