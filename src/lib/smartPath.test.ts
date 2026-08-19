import { describe, expect, it } from "vitest";
import { createEmptyMap } from "./emeraldMap";
import {
  applySmartPathPlan,
  createSmartPathPreset,
  planSmartPath,
  smartPathNeighborMask,
  validateSmartPathPreset,
  type SmartPathPreset,
} from "./smartPath";

function preset(): SmartPathPreset {
  const value = createSmartPathPreset("Test", 100, 0);
  value.id = "test";
  value.variants = Array.from({ length: 16 }, (_, mask) => 100 + mask);
  return value;
}

function add(map: ReturnType<typeof createEmptyMap>, path: SmartPathPreset, x: number, y: number) {
  return applySmartPathPlan(map, planSmartPath(map, path, x, y, "add"));
}

function erase(map: ReturnType<typeof createEmptyMap>, path: SmartPathPreset, x: number, y: number) {
  return applySmartPathPlan(map, planSmartPath(map, path, x, y, "erase"));
}

describe("Smart Path engine", () => {
  it("validates the explicit 16-mask contract", () => {
    const path = preset();
    expect(validateSmartPathPreset(path).valid).toBe(true);
    path.variants = path.variants.slice(0, 15);
    expect(validateSmartPathPreset(path).valid).toBe(false);
  });

  it("rejects an erase metatile that belongs to the path family", () => {
    const path = preset();
    path.eraseMetatile = path.variants[0]!;
    const report = validateSmartPathPreset(path);
    expect(report.valid).toBe(false);
    expect(report.errors.some((message) => message.includes("apagar"))).toBe(true);
  });

  it("connects a two-cell horizontal path with E and W masks", () => {
    const path = preset();
    let map = createEmptyMap(5, 5, 0);
    map = add(map, path, 1, 2);
    expect(map.metatiles[2 * 5 + 1]).toBe(100); // isolated
    map = add(map, path, 2, 2);
    expect(map.metatiles[2 * 5 + 1]).toBe(102); // E
    expect(map.metatiles[2 * 5 + 2]).toBe(108); // W
  });

  it("forms a corner and recalculates only local neighbors", () => {
    const path = preset();
    let map = createEmptyMap(5, 5, 0);
    map = add(map, path, 1, 2);
    map = add(map, path, 2, 2);
    map = add(map, path, 2, 1);
    expect(map.metatiles[2 * 5 + 1]).toBe(102); // E only
    expect(map.metatiles[2 * 5 + 2]).toBe(109); // N + W
    expect(map.metatiles[1 * 5 + 2]).toBe(104); // S
  });

  it("erases a cell and turns the remaining neighbor back into isolated", () => {
    const path = preset();
    let map = createEmptyMap(5, 5, 0);
    map = add(map, path, 1, 2);
    map = add(map, path, 2, 2);
    map = erase(map, path, 2, 2);
    expect(map.metatiles[2 * 5 + 2]).toBe(0);
    expect(map.metatiles[2 * 5 + 1]).toBe(100);
  });

  it("does not touch collision/elevation bits", () => {
    const path = preset();
    const map = createEmptyMap(4, 4, 0);
    map.physical[1 * 4 + 1] = 0xb800;
    const next = add(map, path, 1, 1);
    expect(next.physical[1 * 4 + 1]).toBe(0xb800);
  });

  it("blocks the whole brush operation when the target is protected", () => {
    const path = preset();
    const map = createEmptyMap(4, 4, 0);
    const plan = planSmartPath(map, path, 1, 1, "add", (x, y) => !(x === 1 && y === 1));
    expect(plan.updates).toHaveLength(0);
    expect(plan.skippedProtected).toEqual([{ x: 1, y: 1 }]);
  });

  it("skips protected neighboring retiles while still painting an editable target", () => {
    const path = preset();
    let map = createEmptyMap(4, 4, 0);
    map = add(map, path, 1, 1);
    const plan = planSmartPath(map, path, 2, 1, "add", (x, y) => !(x === 1 && y === 1));
    expect(plan.updates.some((update) => update.x === 2 && update.y === 1)).toBe(true);
    expect(plan.updates.some((update) => update.x === 1 && update.y === 1)).toBe(false);
    expect(plan.skippedProtected).toContainEqual({ x: 1, y: 1 });
  });

  it("computes four-neighbor NESW masks at map edges safely", () => {
    const path = preset();
    const family = new Set(path.variants);
    const map = createEmptyMap(2, 2, 0);
    map.metatiles[0] = path.variants[0]!;
    map.metatiles[1] = path.variants[0]!;
    map.metatiles[2] = path.variants[0]!;
    expect(smartPathNeighborMask(map, 0, 0, family)).toBe(2 | 4);
  });
});
