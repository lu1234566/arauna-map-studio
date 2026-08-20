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

const blueprint: MapBlueprint = {
  format: MAP_BLUEPRINT_FORMAT,
  name: "Teste",
  category: "Teste",
  tags: [],
  width: 20,
  height: 20,
  patterns: [{ pattern: "building", x: 3, y: 1 }],
  routes: [],
};

describe("game-ready AI preflight", () => {
  it("allows the pattern own warp anchor", () => {
    expect(gameReadyStructureConflicts(
      blueprint,
      [pattern],
      [{ x: 5, y: 5, kind: "warp", label: "W0" }],
    )).toEqual([]);
  });

  it("blocks unrelated live events inside a planned building", () => {
    const conflicts = gameReadyStructureConflicts(
      blueprint,
      [pattern],
      [{ x: 4, y: 3, kind: "npc", label: "NPC" }],
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("NPC");
  });
});
