import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { refineAiMapDistricts } from "./aiMapDistrictRefinement";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import { SMART_PATH_FORMAT, type SmartPathPreset } from "./smartPath";

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
    { id: 6, source: "primary", localId: 6, behavior: 0x00, layerType: 0, slot: 5 },
  ],
} as SavedRealAtlas;

const urbanPath: SmartPathPreset = {
  format: SMART_PATH_FORMAT,
  id: "auto-slateport-smart-path-acessos-urbanos",
  name: "Via urbana pelos acessos reais",
  variants: Array.from({ length: 16 }, () => 6),
  eraseMetatile: 1,
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const green: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "auto-slateport-green-1-1",
  name: "Trecho verde real 1",
  category: "Vegetação · trecho",
  tags: ["verde", "vegetação", "jardim", "extraído do mapa"],
  width: 3,
  height: 3,
  kind: "raw",
  values: Array.from({ length: 9 }, () => 3),
  ports: [],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const market: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "auto-slateport-mercado-aberto",
  name: "Mercado aberto real",
  category: "Porto · Emerald",
  tags: ["mercado", "porto", "fixed-origin:14,8", "extraído do mapa"],
  width: 3,
  height: 3,
  kind: "raw",
  values: Array.from({ length: 9 }, () => 4),
  ports: [],
  scope: { primary: "gTileset_General", secondary: "gTileset_Slateport" },
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

function reconstruction(map = createEmptyMap(20, 14, 1)): AiMapReconstructionPlan {
  return {
    map,
    touched: [],
    baseMetatile: 1,
    urbanMetatile: 2,
    greenMetatile: 3,
    candidateCount: 200,
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
}

describe("AI post-path district refinement", () => {
  it("expands green districts away from urban paths and keeps the path corridor intact", () => {
    const map = createEmptyMap(20, 14, 1);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) map.metatiles[idx(x, y, map.width)] = 3;
    }
    for (let x = 2; x <= 17; x++) map.metatiles[idx(x, 7, map.width)] = 6;

    const result = refineAiMapDistricts(
      map,
      atlas,
      [green],
      [],
      [urbanPath],
      reconstruction(map),
      4,
    );

    expect(result.active).toBe(true);
    expect(result.greenAddedCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(2, 7, map.width)]).toBe(6);
    expect(result.map.metatiles[idx(3, 4, map.width)]).toBe(3);
    expect(result.map.metatiles[idx(10, 9, map.width)]).toBe(1);
  });

  it("reinforces a port promenade near water without changing immediate coast or reserved access", () => {
    const map = createEmptyMap(20, 14, 1);
    for (let y = 0; y < map.height; y++) map.metatiles[idx(19, y, map.width)] = 5;

    const result = refineAiMapDistricts(
      map,
      atlas,
      [market, green],
      [{ x: 16, y: 9, kind: "warp", label: "W0" }],
      [urbanPath],
      reconstruction(map),
      4,
    );

    expect(result.portPromenadeCount).toBeGreaterThan(0);
    expect(result.map.metatiles[idx(17, 10, map.width)]).toBe(4);
    expect(result.map.metatiles[idx(18, 10, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(16, 9, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(19, 10, map.width)]).toBe(5);
  });
});
