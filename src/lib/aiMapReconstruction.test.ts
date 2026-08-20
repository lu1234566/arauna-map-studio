import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { isAiRemodelPrompt, planAiMapReconstruction } from "./aiMapReconstruction";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import { createSmartPathPreset } from "./smartPath";

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

function urbanPath() {
  const preset = createSmartPathPreset("Via urbana pelos acessos reais", 2, 1);
  preset.id = "auto-slateport-smart-path-acessos-urbanos";
  preset.variants = Array.from({ length: 16 }, () => 2);
  return preset;
}

describe("AI real-map reconstruction", () => {
  it("only normalizes safe normal ground and preserves events, structures, collision and coast", () => {
    const map = createEmptyMap(8, 8, 1);

    // Fragmented normal ground that should be cleaned.
    map.metatiles[idx(2, 2, map.width)] = 2;
    map.metatiles[idx(3, 2, map.width)] = 3;

    // Warp cell must remain untouched.
    map.metatiles[idx(1, 1, map.width)] = 2;

    // Blocked border cell keeps its visual and collision.
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

  it("uses a real urban Smart Path only in a short contextual zone around anchored structures", () => {
    const map = createEmptyMap(14, 14, 1);
    map.metatiles[idx(0, 0, map.width)] = 3;
    map.metatiles[idx(7, 7, map.width)] = 3;
    map.metatiles[idx(8, 8, map.width)] = 3;

    const result = planAiMapReconstruction(
      map,
      atlas,
      [anchoredPattern],
      [{ x: 5, y: 5, kind: "warp", label: "W0" }],
      [urbanPath()],
    );

    expect(result.baseMetatile).toBe(1);
    expect(result.urbanMetatile).toBe(2);
    expect(result.urbanChangedCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(0, 0, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(7, 7, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(8, 8, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(5, 5, map.width)]).toBe(1);
  });

  it("cleans only small orphan collision clusters and preserves elevation and protected obstacles", () => {
    const map = createEmptyMap(12, 12, 1);

    // Small isolated obstacle: should become floor and lose collision, preserving elevation 3.
    for (const [x, y] of [[5, 5], [6, 5]] as const) {
      const i = idx(x, y, map.width);
      map.metatiles[i] = 2;
      map.physical[i] = 0x3400;
    }

    // Small obstacle touching a protected warp: must remain.
    map.metatiles[idx(3, 2, map.width)] = 2;
    map.physical[idx(3, 2, map.width)] = 0x3400;

    // Large 3x3 cluster exceeds cleanup limit and must remain.
    for (let y = 8; y <= 10; y++) {
      for (let x = 8; x <= 10; x++) {
        const i = idx(x, y, map.width);
        map.metatiles[i] = 2;
        map.physical[i] = 0x3400;
      }
    }

    const result = planAiMapReconstruction(
      map,
      atlas,
      [],
      [{ x: 2, y: 2, kind: "warp", label: "W0" }],
    );

    expect(result.orphanClearedCount).toBe(2);
    expect(result.map.metatiles[idx(5, 5, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(6, 5, map.width)]).toBe(1);
    expect(result.map.physical[idx(5, 5, map.width)]).toBe(0x3000);
    expect(result.map.physical[idx(6, 5, map.width)]).toBe(0x3000);
    expect(result.map.metatiles[idx(3, 2, map.width)]).toBe(2);
    expect(result.map.physical[idx(3, 2, map.width)]).toBe(0x3400);
    expect(result.map.metatiles[idx(9, 9, map.width)]).toBe(2);
    expect(result.map.physical[idx(9, 9, map.width)]).toBe(0x3400);
  });

  it("only enables reconstruction for broad remodel instructions", () => {
    expect(isAiRemodelPrompt("Remodele Slateport como Porto do Sal e reorganize as ruas.")).toBe(true);
    expect(isAiRemodelPrompt("Reconstrua as áreas livres da cidade.")).toBe(true);
    expect(isAiRemodelPrompt("Adicione uma placa perto do Centro Pokémon.")).toBe(false);
  });
});
