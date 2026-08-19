import { describe, expect, it } from "vitest";
import { createEmptyMap } from "./emeraldMap";
import {
  floodFillPhysical,
  getPhysicalLayerValue,
  setPhysicalLayerValue,
} from "./physicalMap";

describe("physical map editing", () => {
  it("altera colisão preservando elevação", () => {
    const original = 0xB400;
    const next = setPhysicalLayerValue(original, "collision", 3);
    expect(getPhysicalLayerValue(next, "collision")).toBe(3);
    expect(getPhysicalLayerValue(next, "elevation")).toBe(11);
  });

  it("altera elevação preservando colisão", () => {
    const original = 0x2C00;
    const next = setPhysicalLayerValue(original, "elevation", 14);
    expect(getPhysicalLayerValue(next, "collision")).toBe(3);
    expect(getPhysicalLayerValue(next, "elevation")).toBe(14);
  });

  it("limita colisão a 0..3 e elevação a 0..15", () => {
    expect(getPhysicalLayerValue(setPhysicalLayerValue(0, "collision", 99), "collision")).toBe(3);
    expect(getPhysicalLayerValue(setPhysicalLayerValue(0, "collision", -9), "collision")).toBe(0);
    expect(getPhysicalLayerValue(setPhysicalLayerValue(0, "elevation", 99), "elevation")).toBe(15);
    expect(getPhysicalLayerValue(setPhysicalLayerValue(0, "elevation", -9), "elevation")).toBe(0);
  });

  it("faz flood fill só no campo escolhido", () => {
    const map = createEmptyMap(3, 2, 7);
    map.physical.set([0x3000, 0x3000, 0x3400, 0x3000, 0x3000, 0x3400]);
    const beforeMetatiles = Array.from(map.metatiles);

    const changed = floodFillPhysical(map, 0, 0, "collision", 2);

    expect(changed.sort((a, b) => a - b)).toEqual([0, 1, 3, 4]);
    expect(Array.from(map.metatiles)).toEqual(beforeMetatiles);
    expect(getPhysicalLayerValue(map.physical[0] ?? 0, "collision")).toBe(2);
    expect(getPhysicalLayerValue(map.physical[0] ?? 0, "elevation")).toBe(3);
    expect(getPhysicalLayerValue(map.physical[2] ?? 0, "collision")).toBe(1);
  });

  it("respeita células bloqueadas no flood fill", () => {
    const map = createEmptyMap(3, 1, 0);
    const changed = floodFillPhysical(map, 0, 0, "elevation", 5, (x) => x === 1);
    expect(changed).toEqual([0]);
    expect(getPhysicalLayerValue(map.physical[0] ?? 0, "elevation")).toBe(5);
    expect(getPhysicalLayerValue(map.physical[2] ?? 0, "elevation")).toBe(0);
  });
});
