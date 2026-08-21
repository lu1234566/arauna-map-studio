import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { SavedRealAtlas } from "./realAtlasStore";
import {
  applyExactGridDeterministicDetails,
  normalizeExactGridSelectivePreserve,
} from "./exactGridPreserveDetail";

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
    { id: 1, source: "primary" as const, localId: 1, behavior: 0, layerType: 0, slot: 0 },
    { id: 2, source: "primary" as const, localId: 2, behavior: 0, layerType: 0, slot: 1 },
    { id: 7, source: "primary" as const, localId: 7, behavior: 0, layerType: 1, slot: 2 },
    { id: 8, source: "primary" as const, localId: 8, behavior: 0, layerType: 0, slot: 3 },
    { id: 9, source: "primary" as const, localId: 9, behavior: 0x10, layerType: 0, slot: 4 },
  ],
} as SavedRealAtlas;

function layeredPlan(width = 8, height = 8): LayeredBasePlan {
  const map = createEmptyMap(width, height, 1);
  const occupancy = new Uint8Array(width * height);
  occupancy.fill(LAYER_OCCUPANCY.base);
  const materialByCell = new Int32Array(width * height);
  materialByCell.fill(1);
  return {
    active: true,
    map,
    touched: [],
    occupancy,
    materialByCell,
    parsed: {
      active: true,
      zones: [],
      requireFullCoverage: true,
      strictFinish: true,
      strictIsolation: true,
      errors: [],
      warnings: [],
    },
    errors: [],
    warnings: [],
    assignedCount: width * height,
    eligibleCount: width * height,
    unsetCount: 0,
    detailPreservedCount: 0,
    detailRejectedCount: 0,
  };
}

const reconstruction = {
  map: createEmptyMap(8, 8, 1),
  touched: [],
  baseMetatile: 1,
  urbanMetatile: 2,
  greenMetatile: 1,
  candidateCount: 64,
  preservedCount: 0,
  changedCount: 0,
  baseChangedCount: 0,
  urbanChangedCount: 0,
  greenChangedCount: 0,
  greenSeedCount: 0,
  orphanClearedCount: 0,
  confidence: 1,
  warnings: [],
} as AiMapReconstructionPlan;

describe("Exact Grid preserve/detail pass", () => {
  it("turns non-protected preserve-range land back into deterministic base ground", () => {
    const layered = layeredPlan(4, 3);
    layered.occupancy.fill(LAYER_OCCUPANCY.unset);
    layered.materialByCell.fill(-2);
    layered.map.metatiles.fill(8);
    layered.map.physical.fill(0x3400);
    layered.occupancy[idx(3, 1, 4)] = LAYER_OCCUPANCY.reserved;

    const stats = normalizeExactGridSelectivePreserve(layered, reconstruction);

    expect(stats.selectiveGroundCount).toBe(11);
    expect(layered.occupancy[idx(0, 0, 4)]).toBe(LAYER_OCCUPANCY.base);
    expect(layered.map.metatiles[idx(0, 0, 4)]).toBe(1);
    expect(layered.map.physical[idx(0, 0, 4)] & 0x0c00).toBe(0);
    expect(layered.occupancy[idx(3, 1, 4)]).toBe(LAYER_OCCUPANCY.reserved);
    expect(layered.map.metatiles[idx(3, 1, 4)]).toBe(8);
  });

  it("restores sparse authentic small details but not large old obstacle masses", () => {
    const sourceMap = createEmptyMap(8, 8, 1);
    sourceMap.physical.fill(0x3000);
    const map = createEmptyMap(8, 8, 1);
    map.physical.fill(0x3000);
    const layered = layeredPlan();

    sourceMap.metatiles[idx(2, 2, 8)] = 7;
    sourceMap.physical[idx(2, 2, 8)] = 0x0400;

    for (let y = 4; y <= 6; y++) {
      for (let x = 4; x <= 6; x++) {
        sourceMap.metatiles[idx(x, y, 8)] = 8;
        sourceMap.physical[idx(x, y, 8)] = 0x0400;
      }
    }

    const result = applyExactGridDeterministicDetails({ map, sourceMap, layered, atlas });

    expect(result.stats.componentCount).toBe(1);
    expect(result.stats.cellCount).toBe(1);
    expect(result.stats.layeredCount).toBe(1);
    expect(result.map.metatiles[idx(2, 2, 8)]).toBe(7);
    expect(layered.occupancy[idx(2, 2, 8)]).toBe(LAYER_OCCUPANCY.detail);
    expect(result.map.metatiles[idx(5, 5, 8)]).toBe(1);
    expect(layered.occupancy[idx(5, 5, 8)]).toBe(LAYER_OCCUPANCY.base);
  });

  it("keeps details away from roads and structures", () => {
    const sourceMap = createEmptyMap(8, 8, 1);
    sourceMap.physical.fill(0x3000);
    sourceMap.metatiles[idx(3, 3, 8)] = 7;
    sourceMap.physical[idx(3, 3, 8)] = 0x0400;
    const map = createEmptyMap(8, 8, 1);
    const layered = layeredPlan();
    layered.occupancy[idx(4, 3, 8)] = LAYER_OCCUPANCY.road;

    const result = applyExactGridDeterministicDetails({ map, sourceMap, layered, atlas });

    expect(result.stats.cellCount).toBe(0);
    expect(result.map.metatiles[idx(3, 3, 8)]).toBe(1);
    expect(layered.occupancy[idx(3, 3, 8)]).toBe(LAYER_OCCUPANCY.base);
  });
});
