import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { polishAiMapFragments } from "./aiMapFragmentPolish";
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
    { id: 4, source: "primary", localId: 4, behavior: 0x00, layerType: 0, slot: 3 },
    { id: 5, source: "primary", localId: 5, behavior: 0x10, layerType: 0, slot: 4 },
    { id: 6, source: "primary", localId: 6, behavior: 0x00, layerType: 1, slot: 5 },
    { id: 7, source: "primary", localId: 7, behavior: 0x00, layerType: 1, slot: 6 },
  ],
} as SavedRealAtlas;

const layeredContext: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "auto-slateport-urban-4-4",
  name: "Trecho urbano real 1",
  category: "Cidade · trecho",
  tags: ["rua", "cidade", "extraído do mapa"],
  width: 3,
  height: 3,
  kind: "raw",
  values: [7, 7, 7, 7, 6, 7, 7, 7, 7],
  ports: [],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

describe("AI post-template fragment polish", () => {
  it("removes a tiny unsupported layered fragment while preserving elevation", () => {
    const map = createEmptyMap(12, 12, 1);
    const orphan = idx(8, 4, map.width);
    map.metatiles[orphan] = 6;
    map.physical[orphan] = 0x3400;

    const result = polishAiMapFragments(map, atlas, [layeredContext], [], [1, 2, 3, 4]);

    expect(result.clearedCount).toBe(1);
    expect(result.map.metatiles[orphan]).toBe(1);
    expect(result.map.physical[orphan]).toBe(0x3000);
  });

  it("preserves a legitimate layered neighborhood learned from the real context pattern", () => {
    const map = createEmptyMap(12, 12, 1);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        map.metatiles[idx(x + 3, y + 3, map.width)] = layeredContext.values[y * 3 + x] ?? 1;
      }
    }

    const result = polishAiMapFragments(map, atlas, [layeredContext], [], [1, 2, 3, 4]);

    expect(result.clearedCount).toBe(0);
    expect(result.layeredPreservedCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(4, 4, map.width)]).toBe(6);
  });

  it("never removes a fragment next to a reserved event", () => {
    const map = createEmptyMap(12, 12, 1);
    const protectedFragment = idx(7, 7, map.width);
    map.metatiles[protectedFragment] = 6;
    map.physical[protectedFragment] = 0x3400;

    const result = polishAiMapFragments(
      map,
      atlas,
      [layeredContext],
      [{ x: 7, y: 7, kind: "warp", label: "W0" }],
      [1, 2, 3, 4],
    );

    expect(result.clearedCount).toBe(0);
    expect(result.map.metatiles[protectedFragment]).toBe(6);
    expect(result.map.physical[protectedFragment]).toBe(0x3400);
  });
});
