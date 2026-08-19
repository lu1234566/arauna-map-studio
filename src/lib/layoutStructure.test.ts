import { describe, expect, it } from "vitest";
import { createEmptyMap, exportMapBin } from "./emeraldMap";
import { parseEditableMapJson } from "./eventMapJson";
import {
  borderCellRaw,
  describeRawCell,
  parseEmeraldBorder,
  resizeMapData,
  setBorderRaw,
  shiftMapJsonForResize,
  updateLayoutDimensionsSource,
} from "./layoutStructure";

describe("layoutStructure", () => {
  it("resizes from top-left without moving existing cells", () => {
    const source = createEmptyMap(2, 2, 1);
    source.metatiles[3] = 9;
    const result = resizeMapData(source, 4, 3, "top-left", 0x3402);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.map.metatiles[1 + 1 * 4]).toBe(9);
    expect(result.map.metatiles[3 + 2 * 4]).toBe(2);
    expect(result.addedCells).toBe(8);
  });

  it("anchors old content to bottom-right and reports crop", () => {
    const source = createEmptyMap(4, 4, 1);
    source.metatiles[3 + 3 * 4] = 77;
    const result = resizeMapData(source, 3, 3, "bottom-right", 0);
    expect(result.dx).toBe(-1);
    expect(result.dy).toBe(-1);
    expect(result.map.metatiles[2 + 2 * 3]).toBe(77);
    expect(result.croppedCells).toBe(7);
  });

  it("shifts events and connection offsets consistently", () => {
    const document = parseEditableMapJson(JSON.stringify({
      id: "MAP_TEST",
      connections: [
        { map: "MAP_UP", offset: 2, direction: "up" },
        { map: "MAP_LEFT", offset: -1, direction: "left" },
      ],
      object_events: [{ x: 4, y: 5 }],
      warp_events: [{ x: 1, y: 1 }],
      coord_events: [],
      bg_events: [],
    }));
    const shifted = shiftMapJsonForResize(document, 3, 4, 20, 20);
    expect((shifted.document.object_events as Array<Record<string, unknown>>)[0]).toMatchObject({ x: 7, y: 9 });
    expect((shifted.document.connections as Array<Record<string, unknown>>)[0].offset).toBe(5);
    expect((shifted.document.connections as Array<Record<string, unknown>>)[1].offset).toBe(3);
    expect(shifted.outOfBounds).toHaveLength(0);
    expect(shifted.adjustedConnections).toBe(2);
  });

  it("reports progression events that would be cropped", () => {
    const document = parseEditableMapJson(JSON.stringify({
      id: "MAP_TEST",
      connections: [],
      object_events: [],
      warp_events: [{ x: 0, y: 0 }],
      coord_events: [],
      bg_events: [],
    }));
    const shifted = shiftMapJsonForResize(document, -1, 0, 10, 10);
    expect(shifted.outOfBounds).toEqual([{ source: "warp_events", index: 0, x: -1, y: 0 }]);
  });

  it("updates only the selected layout dimensions semantically", () => {
    const source = JSON.stringify({
      layouts_table_label: "gMapLayouts",
      extra: { keep: true },
      layouts: [
        { id: "LAYOUT_A", width: 20, height: 20, custom: "keep" },
        { id: "LAYOUT_B", width: 30, height: 40 },
      ],
    });
    const updated = JSON.parse(updateLayoutDimensionsSource(source, "LAYOUT_A", 25, 18));
    expect(updated.layouts[0]).toMatchObject({ width: 25, height: 18, custom: "keep" });
    expect(updated.layouts[1]).toMatchObject({ width: 30, height: 40 });
    expect(updated.extra.keep).toBe(true);
  });

  it("parses and edits the Emerald 2x2 border without losing physical bits", () => {
    const original = createEmptyMap(2, 2, 0);
    original.metatiles[0] = 0x155;
    original.physical[0] = 0xb400;
    const parsed = parseEmeraldBorder(exportMapBin(original).buffer);
    expect(borderCellRaw(parsed, 0)).toBe(0xb555);
    const edited = setBorderRaw(parsed, 1, 0x7c22);
    expect(describeRawCell(borderCellRaw(edited, 1))).toEqual({
      raw: 0x7c22,
      metatile: 0x22,
      collision: 3,
      elevation: 7,
    });
  });
});
