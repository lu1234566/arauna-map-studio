import { describe, expect, it } from "vitest";
import { gameReadyStructureConflicts } from "./aiMapGameReady";
import { MAP_BLUEPRINT_FORMAT, type MapBlueprint } from "./mapBlueprint";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";

const pattern: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "building",
  name: "Prédio real",
  category: "Teste",
  tags: ["warp-anchor:5,5"],
  width: 5,
  height: 5,
  kind: "raw",
  values: Array.from({ length: 25 }, () => 0x3001),
  ports: [{ id: "entrada", name: "entrada", kind: "door", x: 2, y: 4, direction: "south" }],
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

function blueprintAt(x: number, y: number): MapBlueprint {
  return {
    format: MAP_BLUEPRINT_FORMAT,
    name: "Teste",
    category: "Teste",
    tags: [],
    width: 20,
    height: 20,
    patterns: [{ pattern: "building", x, y }],
    routes: [],
  };
}

describe("game-ready AI preflight", () => {
  it("allows a real RAW pattern at its exact original source region", () => {
    expect(gameReadyStructureConflicts(
      blueprintAt(3, 1),
      [pattern],
      [
        { x: 5, y: 5, kind: "warp", label: "W0" },
        { x: 4, y: 3, kind: "npc", label: "NPC original" },
      ],
    )).toEqual([]);
  });

  it("blocks live events when the same pattern is moved elsewhere", () => {
    const conflicts = gameReadyStructureConflicts(
      blueprintAt(10, 10),
      [pattern],
      [{ x: 11, y: 11, kind: "npc", label: "NPC" }],
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("NPC");
  });
});
