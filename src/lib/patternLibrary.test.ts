import { describe, expect, it } from "vitest";
import { createEmptyMap } from "./emeraldMap";
import { captureRegion } from "./mapClipboard";
import {
  clipboardFromPattern,
  parseMapPatternJson,
  patternFromClipboard,
  serializeMapPatterns,
  validateMapPattern,
} from "./patternLibrary";

describe("map pattern library format", () => {
  it("round-trips a RAW clipboard without losing uint16 values", () => {
    const map = createEmptyMap(2, 2, 0);
    map.metatiles.set([1, 2, 3, 4]);
    map.physical.set([0x3000, 0x7400, 0xb800, 0xfc00]);
    const clipboard = captureRegion(map, { x: 0, y: 0, w: 2, h: 2 }, "raw");
    const pattern = patternFromClipboard(clipboard, "Praça teste", "Praças", {
      primary: "gTileset_General",
      secondary: "gTileset_Petalburg",
    });
    expect(validateMapPattern(pattern).valid).toBe(true);

    const source = serializeMapPatterns([pattern]);
    const parsed = parseMapPatternJson(source)[0]!;
    const restored = clipboardFromPattern(parsed);
    expect(restored.kind).toBe("raw");
    expect(restored.width).toBe(2);
    expect(restored.height).toBe(2);
    expect(Array.from(restored.values)).toEqual(Array.from(clipboard.values));
    expect(parsed.scope).toEqual({
      primary: "gTileset_General",
      secondary: "gTileset_Petalburg",
    });
  });

  it("rejects malformed dimensions and cell counts", () => {
    const pattern = patternFromClipboard(
      { kind: "visual", width: 1, height: 1, values: Uint16Array.of(5), source: { x: 0, y: 0 } },
      "Teste",
    );
    pattern.width = 2;
    const report = validateMapPattern(pattern);
    expect(report.valid).toBe(false);
    expect(report.errors.some((message) => message.includes("esperado"))).toBe(true);
  });

  it("validates ranges according to the stored layer", () => {
    const visual = patternFromClipboard(
      { kind: "visual", width: 1, height: 1, values: Uint16Array.of(5), source: { x: 0, y: 0 } },
      "Visual",
    );
    visual.values[0] = 1024;
    expect(validateMapPattern(visual).valid).toBe(false);

    const collision = patternFromClipboard(
      { kind: "collision", width: 1, height: 1, values: Uint16Array.of(2), source: { x: 0, y: 0 } },
      "Colisão",
    );
    collision.values[0] = 4;
    expect(validateMapPattern(collision).valid).toBe(false);

    const elevation = patternFromClipboard(
      { kind: "elevation", width: 1, height: 1, values: Uint16Array.of(9), source: { x: 0, y: 0 } },
      "Elevação",
    );
    elevation.values[0] = 16;
    expect(validateMapPattern(elevation).valid).toBe(false);
  });

  it("imports one object or a library array", () => {
    const a = patternFromClipboard(
      { kind: "visual", width: 1, height: 1, values: Uint16Array.of(7), source: { x: 0, y: 0 } },
      "A",
    );
    const b = patternFromClipboard(
      { kind: "visual", width: 2, height: 1, values: Uint16Array.of(8, 9), source: { x: 0, y: 0 } },
      "B",
    );
    expect(parseMapPatternJson(serializeMapPatterns([a]))).toHaveLength(1);
    expect(parseMapPatternJson(serializeMapPatterns([a, b]))).toHaveLength(2);
  });
});
