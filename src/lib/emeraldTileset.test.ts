import { describe, expect, it } from "vitest";
import {
  PRIMARY_PALETTE_COUNT,
  combineOverworldPalettes,
  decodeTileEntry,
  parseJascPalette,
  parseMetatileAttributes,
  parseMetatilesBin,
  type RgbColor,
} from "./emeraldTileset";

function buffer16(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 2);
  const view = new DataView(buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return buffer;
}

function palette(seed: number): RgbColor[] {
  return Array.from({ length: 16 }, (_, index) => ({
    r: (seed + index) & 0xff,
    g: (seed + index * 2) & 0xff,
    b: (seed + index * 3) & 0xff,
  }));
}

describe("Emerald tileset decoders", () => {
  it("decodifica tile id, flips e paleta de uma entrada GBA", () => {
    const entry = decodeTileEntry(0xa000 | 0x0800 | 0x0400 | 0x0155);
    expect(entry.tileId).toBe(0x155);
    expect(entry.hFlip).toBe(true);
    expect(entry.vFlip).toBe(true);
    expect(entry.palette).toBe(0xa);
  });

  it("lê metatiles.bin como grupos de oito uint16 little-endian", () => {
    const values = [0x0001, 0x0203, 0x0405, 0x0607, 0x0809, 0x0a0b, 0x0c0d, 0x0e0f];
    const parsed = parseMetatilesBin(buffer16(values));
    expect(parsed.count).toBe(1);
    expect(Array.from(parsed.entries)).toEqual(values);
  });

  it("lê behavior e layer type de metatile_attributes.bin", () => {
    const parsed = parseMetatileAttributes(buffer16([0x2007, 0x100a]));
    expect(parsed).toEqual([
      { raw: 0x2007, behavior: 0x07, layerType: 2 },
      { raw: 0x100a, behavior: 0x0a, layerType: 1 },
    ]);
  });

  it("lê paleta JASC-PAL de 16 cores", () => {
    const source = [
      "JASC-PAL",
      "0100",
      "16",
      ...Array.from({ length: 16 }, (_, i) => `${i} ${i + 1} ${i + 2}`),
    ].join("\n");
    const colors = parseJascPalette(source);
    expect(colors).toHaveLength(16);
    expect(colors[0]).toEqual({ r: 0, g: 1, b: 2 });
    expect(colors[15]).toEqual({ r: 15, g: 16, b: 17 });
  });

  it("combina primary 0..5 com secondary 6..12 como o engine Emerald", () => {
    const primary = new Map<number, RgbColor[]>();
    const secondary = new Map<number, RgbColor[]>();
    for (let i = 0; i < PRIMARY_PALETTE_COUNT; i++) primary.set(i, palette(i * 10));
    for (let i = PRIMARY_PALETTE_COUNT; i < 13; i++) secondary.set(i, palette(i * 10));

    const combined = combineOverworldPalettes(primary, secondary);
    expect(combined).toHaveLength(13);
    expect(combined[0]).toEqual(primary.get(0));
    expect(combined[5]).toEqual(primary.get(5));
    expect(combined[6]).toEqual(secondary.get(6));
    expect(combined[12]).toEqual(secondary.get(12));
  });
});
