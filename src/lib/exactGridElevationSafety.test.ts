import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import { protectExactGridElevationLanes } from "./exactGridElevationSafety";
import type { SavedRealAtlas } from "./realAtlasStore";

const atlas = {
  format: "arauna-real-atlas-v2",
  primary: "gTileset_General",
  secondary: "gTileset_Fortree",
  columns: 16,
  tileSize: 16,
  width: 16,
  height: 16,
  createdAt: "2026-09-02T00:00:00.000Z",
  rgbaBase64: "",
  records: [
    { id: 1, source: "primary", localId: 1, behavior: 0x00, layerType: 0, slot: 0 },
    { id: 2, source: "primary", localId: 2, behavior: 0x00, layerType: 0, slot: 1 },
    { id: 3, source: "primary", localId: 3, behavior: 0x10, layerType: 0, slot: 2 },
  ],
} as SavedRealAtlas;

function layeredPlan(width: number, height: number): LayeredBasePlan {
  const map = createEmptyMap(width, height, 2);
  const occupancy = new Uint8Array(width * height);
  occupancy.fill(LAYER_OCCUPANCY.base);
  return {
    active: true,
    map,
    touched: [],
    occupancy,
    materialByCell: new Int32Array(width * height),
    parsed: {
      active: true,
      zones: [],
      requireFullCoverage: false,
      strictFinish: true,
      strictIsolation: false,
      preserveUnassigned: true,
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

describe("Exact Grid elevation safety", () => {
  it("derives the dominant walkable elevation and preserves another walkable level", () => {
    const source = createEmptyMap(5, 3, 1);
    source.physical.fill(3 << 12);
    const bridge = idx(2, 1, source.width);
    source.metatiles[bridge] = 1;
    source.physical[bridge] = 4 << 12;

    const layered = layeredPlan(5, 3);
    layered.map.metatiles[bridge] = 2;
    layered.map.physical[bridge] = 3 << 12;

    const result = protectExactGridElevationLanes({ sourceMap: source, layered, atlas });

    expect(result).toEqual({ baselineElevation: 3, protectedCount: 1 });
    expect(layered.occupancy[bridge]).toBe(LAYER_OCCUPANCY.reserved);
    expect(layered.map.metatiles[bridge]).toBe(1);
    expect(layered.map.physical[bridge]).toBe(4 << 12);
    expect(layered.warnings.some((warning) => warning.includes("Segurança de elevação"))).toBe(true);
  });

  it("does not reinterpret water as an elevated land lane", () => {
    const source = createEmptyMap(4, 2, 1);
    source.physical.fill(3 << 12);
    const water = idx(3, 1, source.width);
    source.metatiles[water] = 3;
    source.physical[water] = 4 << 12;

    const layered = layeredPlan(4, 2);
    const result = protectExactGridElevationLanes({ sourceMap: source, layered, atlas });

    expect(result.baselineElevation).toBe(3);
    expect(result.protectedCount).toBe(0);
    expect(layered.occupancy[water]).toBe(LAYER_OCCUPANCY.base);
  });

  it("is a no-op on a flat map", () => {
    const source = createEmptyMap(3, 3, 1);
    source.physical.fill(3 << 12);
    const layered = layeredPlan(3, 3);

    const result = protectExactGridElevationLanes({ sourceMap: source, layered, atlas });
    expect(result).toEqual({ baselineElevation: 3, protectedCount: 0 });
  });
});
