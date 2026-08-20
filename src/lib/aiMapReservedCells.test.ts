import { describe, expect, it } from "vitest";
import { deriveAiReservedCells } from "./aiMapReservedCells";

describe("AI reserved cells", () => {
  it("keeps real events and expands NPC movement ranges", () => {
    const result = deriveAiReservedCells(
      [
        { x: 5, y: 5, kind: "warp", label: "W0" },
        { x: 8, y: 8, kind: "trigger", label: "T0" },
        { x: 10, y: 10, kind: "npc", label: "N0" },
      ],
      {
        object_events: [{
          x: 10,
          y: 10,
          movement_range_x: 1,
          movement_range_y: 2,
          local_id: "LOCALID_TEST",
        }],
      },
      20,
      20,
    );

    expect(result).toContainEqual({ x: 5, y: 5, kind: "warp", label: "W0" });
    expect(result).toContainEqual({ x: 8, y: 8, kind: "trigger", label: "T0" });
    expect(result).toContainEqual({ x: 9, y: 8, kind: "npc", label: "LOCALID_TEST" });
    expect(result).toContainEqual({ x: 11, y: 12, kind: "npc", label: "LOCALID_TEST" });
  });

  it("gives warp/trigger priority over an NPC movement cell", () => {
    const result = deriveAiReservedCells(
      [{ x: 4, y: 4, kind: "warp", label: "W0" }],
      { object_events: [{ x: 4, y: 4, movement_range_x: 1, movement_range_y: 1, local_id: "NPC" }] },
      10,
      10,
    );
    expect(result.find((cell) => cell.x === 4 && cell.y === 4)?.kind).toBe("warp");
  });
});
