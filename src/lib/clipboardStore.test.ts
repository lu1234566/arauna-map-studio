import { beforeEach, describe, expect, it } from "vitest";
import { clipboardStore } from "./clipboardStore";
import { editorStore } from "./editorStore";
import { getCollision, getElevation, idx } from "./emeraldMap";

function paintVisual(x: number, y: number, id: number) {
  editorStore.setViewMode("visual");
  editorStore.setMetatile(id);
  editorStore.paint(x, y);
}

function paintPhysical(x: number, y: number, collision: number, elevation: number) {
  editorStore.setViewMode("collision");
  editorStore.setCollision(collision);
  editorStore.paint(x, y);
  editorStore.setViewMode("elevation");
  editorStore.setElevation(elevation);
  editorStore.paint(x, y);
}

describe("clipboardStore", () => {
  beforeEach(() => {
    clipboardStore.clear();
    editorStore.newMap();
    if (!editorStore.getState().protectProgression) editorStore.toggleProtect();
    editorStore.setSelection(null);
    editorStore.selectCell(null);
  });

  it("pastes a visual pattern while preserving destination collision and elevation", () => {
    paintVisual(1, 1, 5);
    paintVisual(2, 1, 6);
    paintPhysical(5, 5, 2, 7);
    paintPhysical(6, 5, 1, 4);

    editorStore.setViewMode("visual");
    editorStore.setSelection({ x: 1, y: 1, w: 2, h: 1 });
    expect(clipboardStore.copySelection()).toBe(true);
    editorStore.setSelection(null);
    editorStore.selectCell(idx(5, 5, editorStore.getState().map.width));
    expect(clipboardStore.pasteAtSelected()).toBeGreaterThan(0);

    const map = editorStore.getState().map;
    expect(map.metatiles[idx(5, 5, map.width)]).toBe(5);
    expect(map.metatiles[idx(6, 5, map.width)]).toBe(6);
    expect(getCollision(map.physical[idx(5, 5, map.width)] ?? 0)).toBe(2);
    expect(getElevation(map.physical[idx(5, 5, map.width)] ?? 0)).toBe(7);
    expect(getCollision(map.physical[idx(6, 5, map.width)] ?? 0)).toBe(1);
    expect(getElevation(map.physical[idx(6, 5, map.width)] ?? 0)).toBe(4);
  });

  it("RAW copy/paste transfers metatile, collision and elevation together", () => {
    paintVisual(1, 1, 77);
    paintPhysical(1, 1, 3, 9);
    paintVisual(8, 8, 2);
    paintPhysical(8, 8, 0, 1);

    editorStore.setSelection({ x: 1, y: 1, w: 1, h: 1 });
    expect(clipboardStore.copyRawSelection()).toBe(true);
    editorStore.setSelection(null);
    editorStore.selectCell(idx(8, 8, editorStore.getState().map.width));
    clipboardStore.pasteAtSelected();

    const map = editorStore.getState().map;
    const target = idx(8, 8, map.width);
    expect(map.metatiles[target]).toBe(77);
    expect(getCollision(map.physical[target] ?? 0)).toBe(3);
    expect(getElevation(map.physical[target] ?? 0)).toBe(9);
  });

  it("respects progression-protected cells during paste", () => {
    paintVisual(1, 1, 44);
    editorStore.setViewMode("visual");
    editorStore.setSelection({ x: 1, y: 1, w: 1, h: 1 });
    clipboardStore.copySelection();

    const mapJson = JSON.stringify({
      id: "MAP_TEST",
      name: "Test",
      layout: "LAYOUT_TEST",
      connections: [],
      object_events: [],
      warp_events: [
        { x: 5, y: 5, elevation: 0, dest_map: "MAP_TEST", dest_warp_id: "0" },
      ],
      coord_events: [],
      bg_events: [],
    });
    expect(editorStore.importMapJson(mapJson, "data/maps/Test/map.json").ok).toBe(true);
    editorStore.setSelection(null);
    editorStore.selectCell(idx(5, 5, editorStore.getState().map.width));
    const before = editorStore.getState().map.metatiles[idx(5, 5, editorStore.getState().map.width)];
    expect(clipboardStore.pasteAtSelected()).toBe(0);
    const after = editorStore.getState().map.metatiles[idx(5, 5, editorStore.getState().map.width)];
    expect(after).toBe(before);
  });

  it("cuts only the active layer and keeps physical bits intact", () => {
    paintVisual(3, 3, 88);
    paintPhysical(3, 3, 2, 6);
    editorStore.setViewMode("visual");
    editorStore.setSelection({ x: 3, y: 3, w: 1, h: 1 });
    expect(clipboardStore.cutSelection()).toBe(true);

    const map = editorStore.getState().map;
    const cell = idx(3, 3, map.width);
    expect(map.metatiles[cell]).toBe(0);
    expect(getCollision(map.physical[cell] ?? 0)).toBe(2);
    expect(getElevation(map.physical[cell] ?? 0)).toBe(6);
    expect(clipboardStore.getState().clipboard?.values[0]).toBe(88);
  });

  it("records a pasted pattern as one undo operation", () => {
    paintVisual(1, 1, 10);
    paintVisual(2, 1, 11);
    editorStore.setViewMode("visual");
    editorStore.setSelection({ x: 1, y: 1, w: 2, h: 1 });
    clipboardStore.copySelection();
    editorStore.setSelection(null);
    editorStore.selectCell(idx(10, 10, editorStore.getState().map.width));

    const beforeA = editorStore.getState().map.metatiles[idx(10, 10, 20)];
    const beforeB = editorStore.getState().map.metatiles[idx(11, 10, 20)];
    clipboardStore.pasteAtSelected();
    expect(editorStore.getState().map.metatiles[idx(10, 10, 20)]).toBe(10);
    expect(editorStore.getState().map.metatiles[idx(11, 10, 20)]).toBe(11);

    editorStore.undo();
    expect(editorStore.getState().map.metatiles[idx(10, 10, 20)]).toBe(beforeA);
    expect(editorStore.getState().map.metatiles[idx(11, 10, 20)]).toBe(beforeB);
  });
});
