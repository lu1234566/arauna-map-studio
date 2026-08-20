import { describe, expect, it } from "vitest";
import { mapBinDimensionCandidates, parseMapBinDimensionInput } from "./mapBinImport";

describe("map.bin manual import dimensions", () => {
  it("ranks 40x60 first for a 2400-cell map with 40-cell vertical structure", () => {
    const width = 40;
    const height = 60;
    const buffer = new ArrayBuffer(width * height * 2);
    const view = new DataView(buffer);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        view.setUint16((y * width + x) * 2, x & 0x03ff, true);
      }
    }

    expect(mapBinDimensionCandidates(buffer)[0]).toEqual({ width: 40, height: 60 });
  });

  it("accepts common width-height separators only when the cell count matches", () => {
    expect(parseMapBinDimensionInput("40x60", 2400)).toEqual({ width: 40, height: 60 });
    expect(parseMapBinDimensionInput("40×60", 2400)).toEqual({ width: 40, height: 60 });
    expect(parseMapBinDimensionInput("40,60", 2400)).toEqual({ width: 40, height: 60 });
    expect(parseMapBinDimensionInput("60x40", 2400)).toEqual({ width: 60, height: 40 });
    expect(parseMapBinDimensionInput("20x20", 2400)).toBeNull();
  });

  it("rejects odd-byte and empty files as dimensionless", () => {
    expect(mapBinDimensionCandidates(new ArrayBuffer(0))).toEqual([]);
    expect(mapBinDimensionCandidates(new ArrayBuffer(3))).toEqual([]);
  });
});
