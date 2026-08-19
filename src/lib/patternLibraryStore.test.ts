import { describe, expect, it } from "vitest";
import { editorStore } from "./editorStore";
import { getCollision, getElevation, idx } from "./emeraldMap";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { patternLibraryStore } from "./patternLibraryStore";

function makePattern(name: string, kind: MapPattern["kind"], width: number, height: number, values: number[]): MapPattern {
  const now = new Date().toISOString();
  return {
    format: MAP_PATTERN_FORMAT,
    id: `test-${name}-${Math.random()}`,
    name,
    category: "Testes",
    tags: [],
    width,
    height,
    kind,
    values,
    createdAt: now,
    updatedAt: now,
  };
}

function importAndSelect(pattern: MapPattern) {
  expect(patternLibraryStore.importJson(JSON.stringify(pattern)).ok).toBe(true);
  const imported = patternLibraryStore.getState().patterns.at(-1)!;
  patternLibraryStore.selectPattern(imported.id);
  expect(patternLibraryStore.setEnabled(true)).toBe(true);
  return imported;
}

describe("pattern library stamping", () => {
  it("stamps a visual pattern while preserving collision/elevation", () => {
    editorStore.newMap();
    editorStore.setViewMode("collision");
    editorStore.setCollision(2);
    editorStore.paint(6, 6);
    editorStore.setViewMode("elevation");
    editorStore.setElevation(8);
    editorStore.paint(6, 6);

    importAndSelect(makePattern("visual", "visual", 2, 1, [55, 56]));
    editorStore.beginStroke();
    expect(patternLibraryStore.applyAt(6, 6, true)).toBeGreaterThan(0);

    const map = editorStore.getState().map;
    expect(map.metatiles[idx(6, 6, map.width)]).toBe(55);
    expect(map.metatiles[idx(7, 6, map.width)]).toBe(56);
    expect(getCollision(map.physical[idx(6, 6, map.width)] ?? 0)).toBe(2);
    expect(getElevation(map.physical[idx(6, 6, map.width)] ?? 0)).toBe(8);
    patternLibraryStore.setEnabled(false);
  });

  it("stamps RAW patterns including physical bits", () => {
    editorStore.newMap();
    const raw = (3 << 10) | (9 << 12) | 77;
    importAndSelect(makePattern("raw", "raw", 1, 1, [raw]));
    editorStore.beginStroke();
    patternLibraryStore.applyAt(8, 8, true);

    const map = editorStore.getState().map;
    const target = idx(8, 8, map.width);
    expect(map.metatiles[target]).toBe(77);
    expect(getCollision(map.physical[target] ?? 0)).toBe(3);
    expect(getElevation(map.physical[target] ?? 0)).toBe(9);
    patternLibraryStore.setEnabled(false);
  });

  it("skips progression-protected cells", () => {
    editorStore.newMap();
    const mapJson = JSON.stringify({
      id: "MAP_TEST",
      name: "Test",
      layout: "LAYOUT_TEST",
      connections: [],
      object_events: [],
      warp_events: [{ x: 5, y: 5, elevation: 0, dest_map: "MAP_TEST", dest_warp_id: "0" }],
      coord_events: [],
      bg_events: [],
    });
    expect(editorStore.importMapJson(mapJson, "data/maps/Test/map.json").ok).toBe(true);
    importAndSelect(makePattern("protected", "visual", 1, 1, [99]));
    const before = editorStore.getState().map.metatiles[idx(5, 5, 20)];
    editorStore.beginStroke();
    expect(patternLibraryStore.applyAt(5, 5, true)).toBe(0);
    expect(editorStore.getState().map.metatiles[idx(5, 5, 20)]).toBe(before);
    patternLibraryStore.setEnabled(false);
  });
});
