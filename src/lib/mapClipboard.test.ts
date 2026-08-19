import { describe, expect, it } from "vitest";
import { createEmptyMap } from "./emeraldMap";
import {
  captureRegion,
  flipClipboardHorizontal,
  flipClipboardVertical,
  rotateClipboardClockwise,
} from "./mapClipboard";

describe("map clipboard", () => {
  it("captures visual, collision, elevation and raw values independently", () => {
    const map = createEmptyMap(3, 2, 0);
    map.metatiles.set([1, 2, 3, 4, 5, 6]);
    map.physical[1] = (2 << 10) | (7 << 12);
    map.physical[2] = (1 << 10) | (4 << 12);

    const selection = { x: 1, y: 0, w: 2, h: 1 };
    expect(Array.from(captureRegion(map, selection, "visual").values)).toEqual([2, 3]);
    expect(Array.from(captureRegion(map, selection, "collision").values)).toEqual([2, 1]);
    expect(Array.from(captureRegion(map, selection, "elevation").values)).toEqual([7, 4]);
    expect(Array.from(captureRegion(map, selection, "raw").values)).toEqual([
      (2 << 10) | (7 << 12) | 2,
      (1 << 10) | (4 << 12) | 3,
    ]);
  });

  it("clamps a selection to map bounds", () => {
    const map = createEmptyMap(3, 3, 9);
    const clip = captureRegion(map, { x: 2, y: 2, w: 4, h: 4 }, "visual");
    expect(clip.width).toBe(1);
    expect(clip.height).toBe(1);
    expect(Array.from(clip.values)).toEqual([9]);
  });

  it("rotates a rectangular pattern clockwise", () => {
    const map = createEmptyMap(3, 2, 0);
    map.metatiles.set([1, 2, 3, 4, 5, 6]);
    const clip = captureRegion(map, { x: 0, y: 0, w: 3, h: 2 }, "visual");
    const rotated = rotateClipboardClockwise(clip);
    expect(rotated.width).toBe(2);
    expect(rotated.height).toBe(3);
    expect(Array.from(rotated.values)).toEqual([
      4, 1,
      5, 2,
      6, 3,
    ]);
  });

  it("mirrors a pattern horizontally and vertically", () => {
    const map = createEmptyMap(2, 2, 0);
    map.metatiles.set([1, 2, 3, 4]);
    const clip = captureRegion(map, { x: 0, y: 0, w: 2, h: 2 }, "visual");
    expect(Array.from(flipClipboardHorizontal(clip).values)).toEqual([2, 1, 4, 3]);
    expect(Array.from(flipClipboardVertical(clip).values)).toEqual([3, 4, 1, 2]);
  });
});
