import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import { protectExactGridFunctionalBehaviors } from "./exactGridFunctionalBehaviorSafety";
import type { SavedRealAtlas } from "./realAtlasStore";

function layeredPlan(width = 4, height = 3): LayeredBasePlan {
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

function atlas(): SavedRealAtlas {
  return {
    format: "arauna-real-atlas-v2",
    primary: "gTileset_General",
    secondary: "gTileset_Facility",
    columns: 16,
    tileSize: 16,
    width: 16,
    height: 16,
    createdAt: "test",
    rgbaBase64: "",
    records: [
      { id: 1, behavior: 0x00, layerType: 0, slot: 0 },
      { id: 7, behavior: 0x25, layerType: 0, slot: 1 },
    ],
  } as unknown as SavedRealAtlas;
}

describe("Exact Grid functional behavior safety", () => {
  it("restaura tiles caminháveis de behavior especial quando há opt-in", () => {
    const source = createEmptyMap(4, 3, 1);
    const cracked = idx(2, 1, 4);
    source.metatiles[cracked] = 7;
    source.physical[cracked] = 0x3000;

    const layered = layeredPlan();
    layered.map.metatiles[cracked] = 1;
    layered.map.physical[cracked] = 0x3000;

    const stats = protectExactGridFunctionalBehaviors({
      sourceMap: source,
      layered,
      atlas: atlas(),
      prompt: "preservar todos os comportamentos funcionais do mapa real",
    });

    expect(stats.enabled).toBe(true);
    expect(stats.protectedCount).toBe(1);
    expect(layered.map.metatiles[cracked]).toBe(7);
    expect(layered.map.physical[cracked]).toBe(0x3000);
    expect(layered.occupancy[cracked]).toBe(LAYER_OCCUPANCY.reserved);
  });

  it("não congela piso NORMAL nem remodelagem sem opt-in", () => {
    const source = createEmptyMap(4, 3, 1);
    const normal = idx(1, 1, 4);
    const special = idx(2, 1, 4);
    source.metatiles[normal] = 1;
    source.metatiles[special] = 7;

    const layered = layeredPlan();
    layered.map.metatiles[normal] = 2;
    layered.map.metatiles[special] = 2;

    const noOptIn = protectExactGridFunctionalBehaviors({
      sourceMap: source,
      layered,
      atlas: atlas(),
      prompt: "reconstrua o piso do salão",
    });
    expect(noOptIn.enabled).toBe(false);
    expect(noOptIn.protectedCount).toBe(0);

    const withOptIn = protectExactGridFunctionalBehaviors({
      sourceMap: source,
      layered,
      atlas: atlas(),
      prompt: "preservar comportamentos funcionais existentes",
    });
    expect(withOptIn.protectedCount).toBe(1);
    expect(layered.map.metatiles[normal]).toBe(2);
    expect(layered.map.metatiles[special]).toBe(7);
  });
});
