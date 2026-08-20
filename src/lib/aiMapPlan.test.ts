import { describe, expect, it } from "vitest";
import {
  AI_MAP_PLAN_FORMAT,
  compileAiMapPlan,
  orthogonalizeRoutePoints,
  parseDetailedMapCommand,
  type AiMapPlan,
} from "./aiMapPlan";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";

function house(): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id: "house-player",
    name: "Casa Rural",
    category: "Construção",
    tags: ["casa", "player"],
    width: 5,
    height: 4,
    kind: "visual",
    values: Array.from({ length: 20 }, (_, index) => index + 1),
    ports: [{ id: "front", name: "entrada", kind: "door", x: 2, y: 3, direction: "south" }],
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

function road() {
  const preset = createSmartPathPreset("Estrada de Terra", 100, 0);
  preset.id = "dirt-road";
  preset.variants = Array.from({ length: 16 }, (_, index) => 100 + index);
  return preset;
}

describe("AI map plan", () => {
  it("resolves a named structure port into an exact route and warp coordinate", () => {
    const plan: AiMapPlan = {
      format: AI_MAP_PLAN_FORMAT,
      name: "Vila teste",
      width: 20,
      height: 20,
      structures: [{ id: "player-house", label: "Casa do jogador", pattern: "Casa Rural", x: 3, y: 10 }],
      routes: [{
        smartPath: "Estrada de Terra",
        points: [{ x: 0, y: 13 }, { structure: "Casa do jogador", port: "entrada" }],
      }],
      warps: [{
        source: { structure: "Casa do jogador", port: "front" },
        destMap: "MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F",
        destWarpId: "0",
      }],
      connections: [],
    };
    const result = compileAiMapPlan(plan, [house()], [road()]);
    expect(result.valid).toBe(true);
    expect(result.blueprint?.routes[0]?.points).toEqual([{ x: 0, y: 13 }, { x: 5, y: 13 }]);
    expect(result.warps[0]).toMatchObject({ x: 5, y: 13, destWarpId: "0" });
  });

  it("repairs diagonal AI waypoints after resolving a semantic door", () => {
    const plan: AiMapPlan = {
      format: AI_MAP_PLAN_FORMAT,
      name: "Porto teste",
      width: 40,
      height: 60,
      structures: [{ id: "mart", label: "Poké Mart", pattern: "Casa Rural", x: 11, y: 23 }],
      routes: [{
        smartPath: "Estrada de Terra",
        points: [
          { x: 11, y: 27 },
          { structure: "mart", port: "entrada" },
          { x: 13, y: 27 },
        ],
      }],
      warps: [],
      connections: [],
    };
    const result = compileAiMapPlan(plan, [house()], [road()]);
    expect(result.valid).toBe(true);
    expect(result.blueprint?.routes[0]?.points).toEqual([
      { x: 11, y: 27 },
      { x: 13, y: 27 },
      { x: 13, y: 26 },
      { x: 13, y: 27 },
    ]);
    expect(result.warnings.some((message) => message.includes("cotovelo"))).toBe(true);
  });

  it("orthogonalizes diagonal coordinates and removes repeated waypoints", () => {
    expect(orthogonalizeRoutePoints([
      { x: 17, y: 39 },
      { x: 21, y: 44 },
      { x: 21, y: 44 },
      { x: 21, y: 45 },
    ])).toEqual({
      points: [
        { x: 17, y: 39 },
        { x: 21, y: 39 },
        { x: 21, y: 44 },
        { x: 21, y: 45 },
      ],
      inserted: 1,
      removedDuplicates: 1,
    });
  });

  it("parses the precise local command syntax without an AI service", () => {
    const parsed = parseDetailedMapCommand(
      `Mapa 20x20; nome="Vila IA"\nestrutura "Casa do jogador" usar "Casa Rural" em (3,10)\nrota "Estrada de Terra": (0,13) -> (5,13)\nwarp (5,13) -> MAP_PLAYER_HOUSE:0\nsaida oeste -> MAP_ROUTE101 offset 0`,
      [house()],
      [road()],
      20,
      20,
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures[0]).toMatchObject({ x: 3, y: 10, pattern: "house-player" });
    expect(parsed.plan?.warps[0]?.destMap).toBe("MAP_PLAYER_HOUSE");
    expect(parsed.plan?.connections[0]).toEqual({ direction: "west", map: "MAP_ROUTE101", offset: 0 });
  });

  it("fails closed when the AI invents a structure pattern", () => {
    const plan: AiMapPlan = {
      format: AI_MAP_PLAN_FORMAT,
      name: "Invalido",
      width: 20,
      height: 20,
      structures: [{ id: "castle", pattern: "Castelo que não existe", x: 3, y: 3 }],
      routes: [],
      warps: [],
      connections: [],
    };
    const result = compileAiMapPlan(plan, [house()], [road()]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.includes("não existe") || message.includes("ambíguo"))).toBe(true);
  });
});
