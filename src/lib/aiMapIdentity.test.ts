import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { planAiMapIdentityBase } from "./aiMapIdentity";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
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
  ],
} as SavedRealAtlas;

function rawPattern(
  id: string,
  name: string,
  tags: string[],
  width: number,
  height: number,
  values: number[],
): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id,
    name,
    category: "Teste",
    tags,
    width,
    height,
    kind: "raw",
    values,
    ports: [],
    scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

const market = rawPattern(
  "auto-slateport-mercado-aberto",
  "Mercado aberto real",
  ["mercado", "porto", "cais", "fixed-origin:8,7", "extraído do mapa"],
  3,
  3,
  [4, 4, 4, 4, 6, 4, 4, 4, 4],
);

const coast = rawPattern(
  "auto-slateport-coast-8-8",
  "Trecho costeiro real 1",
  ["costa", "litoral", "porto", "extraído do mapa"],
  3,
  3,
  [4, 4, 5, 4, 4, 5, 4, 4, 5],
);

const green = rawPattern(
  "auto-slateport-green-1-1",
  "Trecho verde real 1",
  ["verde", "vegetação", "jardim", "extraído do mapa"],
  3,
  3,
  Array.from({ length: 9 }, () => 3),
);

const reconstruction: AiMapReconstructionPlan = {
  map: createEmptyMap(14, 12, 1),
  touched: [],
  baseMetatile: 1,
  urbanMetatile: 2,
  greenMetatile: 3,
  candidateCount: 100,
  preservedCount: 0,
  changedCount: 0,
  baseChangedCount: 0,
  urbanChangedCount: 0,
  greenChangedCount: 0,
  greenSeedCount: 9,
  orphanClearedCount: 0,
  confidence: 1,
  warnings: [],
};

describe("AI port-city identity base", () => {
  it("adds port accents and expands real green context without touching warp access or water", () => {
    const map = createEmptyMap(14, 12, 1);
    map.metatiles[idx(5, 5, map.width)] = 2;
    map.metatiles[idx(12, 10, map.width)] = 5;

    const result = planAiMapIdentityBase(
      map,
      atlas,
      [market, coast, green],
      [{ x: 5, y: 5, kind: "warp", label: "W0" }],
      { ...reconstruction, map },
    );

    expect(result.active).toBe(true);
    expect(result.portMetatile).toBe(4);
    expect(result.portChangedCount).toBeGreaterThan(0);
    expect(result.greenExpandedCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(5, 5, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(12, 10, map.width)]).toBe(5);
    expect(result.map.metatiles[idx(7, 10, map.width)]).toBe(4);
    expect(result.map.metatiles[idx(1, 4, map.width)]).toBe(3);
  });

  it("stays inactive when the map has no port vocabulary", () => {
    const map = createEmptyMap(8, 8, 1);
    const result = planAiMapIdentityBase(map, atlas, [green], [], { ...reconstruction, map });
    expect(result.active).toBe(false);
    expect(result.touched).toHaveLength(0);
  });
});
