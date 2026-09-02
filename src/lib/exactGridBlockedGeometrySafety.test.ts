import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import { protectExactGridBlockedGeometry } from "./exactGridBlockedGeometrySafety";

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

describe("Exact Grid blocked geometry safety", () => {
  it("restaura paredes colidíveis quando o prompt pede preservar paredes/rocha", () => {
    const source = createEmptyMap(4, 3, 1);
    const wall = idx(2, 1, 4);
    source.metatiles[wall] = 9;
    source.physical[wall] = 0x3400;

    const layered = layeredPlan();
    layered.map.metatiles[wall] = 2;
    layered.map.physical[wall] = 0x3000;

    const stats = protectExactGridBlockedGeometry({
      sourceMap: source,
      layered,
      prompt: "preservar paredes e rochas da caverna",
    });

    expect(stats.enabled).toBe(true);
    expect(stats.protectedCount).toBe(1);
    expect(layered.map.metatiles[wall]).toBe(9);
    expect(layered.map.physical[wall]).toBe(0x3400);
    expect(layered.occupancy[wall]).toBe(LAYER_OCCUPANCY.reserved);
  });

  it("não altera o comportamento de remodelagens comuns sem opt-in", () => {
    const source = createEmptyMap(4, 3, 1);
    const wall = idx(2, 1, 4);
    source.metatiles[wall] = 9;
    source.physical[wall] = 0x3400;

    const layered = layeredPlan();
    layered.map.metatiles[wall] = 2;
    layered.map.physical[wall] = 0x3000;

    const stats = protectExactGridBlockedGeometry({
      sourceMap: source,
      layered,
      prompt: "reconstrua a praça em piso urbano",
    });

    expect(stats.enabled).toBe(false);
    expect(stats.protectedCount).toBe(0);
    expect(layered.map.metatiles[wall]).toBe(2);
    expect(layered.occupancy[wall]).toBe(LAYER_OCCUPANCY.base);
  });
});
