import { describe, expect, it } from "vitest";
import type { MapData } from "./emeraldMap";
import {
  buildPassabilityGrid,
  cellPassability,
  classifyBehavior,
  connectedComponents,
  isKnownWarpBehavior,
  isKnownWaterBehavior,
  LENIENT_PASSABLE,
  STRICT_PASSABLE,
  VERIFIED_PASSABLE,
} from "./mapPassability";

function oneCell(metatile: number, physical: number): MapData {
  return {
    width: 1,
    height: 1,
    metatiles: Uint16Array.of(metatile),
    physical: Uint16Array.of(physical),
  };
}

describe("conservative map passability", () => {
  it("treats collision > 0 as a hard block even with a walkable behavior", () => {
    const result = cellPassability(oneCell(1, 0x3400), 0, 0, {
      records: [{ id: 1, behavior: 0x00 }],
    });
    expect(result.state).toBe("blocked");
    expect(result.collision).toBe(1);
  });

  it("never promotes collision=0 to passable when the atlas is absent", () => {
    const result = cellPassability(oneCell(1, 0x3000), 0, 0, null);
    expect(result.state).toBe("unknown");
    expect(result.reason).toMatch(/atlas/i);
  });

  it("distinguishes confirmed walkable, recognized conditional and unknown behaviors", () => {
    expect(classifyBehavior(0x00)).toBe("passable"); // MB_NORMAL
    expect(classifyBehavior(0x10)).toBe("conditional"); // MB_POND_WATER
    expect(classifyBehavior(0x50)).toBe("conditional"); // current
    expect(classifyBehavior(0x69)).toBe("conditional"); // animated door
    expect(classifyBehavior(0x29)).toBe("conditional"); // Lavaridge B1F warp
    expect(classifyBehavior(0x6c)).toBe("conditional"); // water door
    expect(classifyBehavior(0x6d)).toBe("conditional"); // water south arrow warp
    expect(classifyBehavior(0x6e)).toBe("conditional"); // deep south warp
    expect(classifyBehavior(0xe1)).toBe("unknown");
  });

  it("identifies known engine warp and water behaviors explicitly", () => {
    expect(isKnownWarpBehavior(0x69)).toBe(true);
    expect(isKnownWarpBehavior(0x6e)).toBe(true);
    expect(isKnownWaterBehavior(0x15)).toBe(true);
    expect(isKnownWaterBehavior(0x6c)).toBe(true);
    expect(isKnownWarpBehavior(0xe1)).toBe(false);
  });

  it("keeps missing atlas records unknown instead of false-pass", () => {
    const result = cellPassability(oneCell(7, 0x3000), 0, 0, {
      records: [{ id: 1, behavior: 0x00 }],
    });
    expect(result.state).toBe("unknown");
  });

  it("uses strict, verified and lenient connectivity separately", () => {
    const map: MapData = {
      width: 4,
      height: 1,
      metatiles: Uint16Array.of(1, 2, 3, 1),
      physical: Uint16Array.of(0x3000, 0x3000, 0x3000, 0x3000),
    };
    const grid = buildPassabilityGrid(map, {
      records: [
        { id: 1, behavior: 0x00 },
        { id: 2, behavior: 0x10 },
        { id: 3, behavior: 0xe1 },
      ],
    });
    expect(grid.states).toEqual(["passable", "conditional", "unknown", "passable"]);
    const strict = connectedComponents(grid, STRICT_PASSABLE);
    const verified = connectedComponents(grid, VERIFIED_PASSABLE);
    const lenient = connectedComponents(grid, LENIENT_PASSABLE);
    expect(strict[0]).not.toBe(strict[3]);
    expect(verified[0]).not.toBe(verified[3]);
    expect(verified[0]).toBe(verified[1]);
    expect(lenient[0]).toBe(lenient[3]);
  });
});
