import { describe, expect, it } from "vitest";
import {
  createProceduralBlueprintSpec,
  generateProceduralBlueprint,
  routeProceduralRoad,
  type ProceduralPatternPlacement,
} from "./proceduralBlueprint";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";

function makePattern(id: string, width = 3, height = 3): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id,
    name: id,
    category: "Test",
    tags: [],
    width,
    height,
    kind: "visual",
    values: Array.from({ length: width * height }, (_, index) => 10 + index),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeRoad() {
  const road = createSmartPathPreset("Estrada", 100, 0);
  road.id = "road";
  road.variants = Array.from({ length: 16 }, (_, mask) => 100 + mask);
  return road;
}

function overlaps(a: ProceduralPatternPlacement, b: ProceduralPatternPlacement, spacing: number) {
  return !(
    a.x + a.width + spacing <= b.x ||
    b.x + b.width + spacing <= a.x ||
    a.y + a.height + spacing <= b.y ||
    b.y + b.height + spacing <= a.y
  );
}

describe("Procedural Blueprint planner", () => {
  const plaza = makePattern("plaza", 5, 4);
  const lab = makePattern("lab", 4, 3);
  const house = makePattern("house", 3, 3);
  const grove = makePattern("grove", 4, 4);
  const patterns = [plaza, lab, house, grove];
  const road = makeRoad();

  it("is reproducible for the same seed", () => {
    const spec = createProceduralBlueprintSpec(30, 24);
    spec.seed = "same-seed";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id, house.id];
    spec.fillerPatternIds = [grove.id, house.id];
    spec.fillerCount = 5;
    spec.roadPresetId = road.id;
    spec.exits = { north: true, east: true, south: true, west: false };
    const a = generateProceduralBlueprint(spec, patterns, [road]);
    const b = generateProceduralBlueprint(spec, patterns, [road]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.placements).toEqual(b.placements);
    expect(a.roads).toEqual(b.roads);
    expect(a.blueprint?.patterns).toEqual(b.blueprint?.patterns);
    expect(a.blueprint?.routes).toEqual(b.blueprint?.routes);
  });

  it("centers the hub and does not overlap saved pattern rectangles", () => {
    const spec = createProceduralBlueprintSpec(32, 26);
    spec.seed = "spacing";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id, house.id];
    spec.fillerPatternIds = [grove.id, house.id];
    spec.fillerCount = 7;
    spec.spacing = 1;
    spec.roadPresetId = road.id;
    const result = generateProceduralBlueprint(spec, patterns, [road]);
    expect(result.ok).toBe(true);
    const center = result.placements.find((placement) => placement.role === "center");
    expect(center?.x).toBe(Math.floor((32 - plaza.width) / 2));
    expect(center?.y).toBe(Math.floor((26 - plaza.height) / 2));
    for (let i = 0; i < result.placements.length; i++) {
      for (let j = i + 1; j < result.placements.length; j++) {
        expect(overlaps(result.placements[i]!, result.placements[j]!, spec.spacing)).toBe(false);
      }
    }
  });

  it("connects requested exits with orthogonal Smart Path waypoints", () => {
    const spec = createProceduralBlueprintSpec(28, 22);
    spec.seed = "exits";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id];
    spec.roadPresetId = road.id;
    spec.exits = { north: true, east: true, south: false, west: true };
    const result = generateProceduralBlueprint(spec, patterns, [road]);
    expect(result.ok).toBe(true);
    const exits = result.roads.filter((route) => route.kind === "exit");
    expect(exits.map((route) => route.label).sort()).toEqual(["east", "north", "west"]);
    const endpoints = exits.map((route) => route.points[route.points.length - 1]!);
    expect(endpoints.some((point) => point.y === 0)).toBe(true);
    expect(endpoints.some((point) => point.x === 27)).toBe(true);
    expect(endpoints.some((point) => point.x === 0)).toBe(true);
    for (const route of exits) {
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1]!;
        const b = route.points[i]!;
        expect(a.x === b.x || a.y === b.y).toBe(true);
      }
    }
  });

  it("routes around structures when a free grid route exists", () => {
    const placements: ProceduralPatternPlacement[] = [{
      role: "landmark",
      patternId: "wall",
      x: 4,
      y: 1,
      width: 2,
      height: 7,
      anchor: { x: 5, y: 8 },
    }];
    const route = routeProceduralRoad(12, 10, { x: 1, y: 4 }, { x: 10, y: 4 }, placements);
    expect(route.usedFallback).toBe(false);
    expect(route.points.length).toBeGreaterThan(2);
  });

  it("warns and stops adding fillers when safe space is exhausted", () => {
    const huge = makePattern("huge", 8, 8);
    const spec = createProceduralBlueprintSpec(12, 12);
    spec.seed = "crowded";
    spec.centerPatternId = huge.id;
    spec.fillerPatternIds = [huge.id];
    spec.fillerCount = 6;
    spec.margin = 1;
    spec.spacing = 1;
    spec.exits = { north: false, east: false, south: false, west: false };
    const result = generateProceduralBlueprint(spec, [huge], []);
    expect(result.ok).toBe(true);
    expect(result.placements).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("Espaço esgotado"))).toBe(true);
  });

  it("fails closed on a dependency scoped to another tileset", () => {
    const scoped = makePattern("scoped");
    scoped.scope = { primary: "gTileset_General", secondary: "gTileset_Petalburg" };
    const spec = createProceduralBlueprintSpec(20, 20);
    spec.centerPatternId = scoped.id;
    const result = generateProceduralBlueprint(
      spec,
      [scoped],
      [],
      { primary: "gTileset_General", secondary: "gTileset_Fallarbor" },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("outro tileset"))).toBe(true);
  });

  it("outputs the existing AI blueprint contract and compiles it to a template", () => {
    const spec = createProceduralBlueprintSpec(30, 24);
    spec.seed = "compiler-bridge";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id];
    spec.fillerPatternIds = [house.id];
    spec.fillerCount = 2;
    spec.roadPresetId = road.id;
    const result = generateProceduralBlueprint(spec, patterns, [road]);
    expect(result.ok).toBe(true);
    expect(result.blueprint?.format).toBe("arauna-map-blueprint-v1");
    expect(result.compiled?.valid).toBe(true);
    expect(result.compiled?.template).not.toBeNull();
    expect(result.blueprint?.patterns.every((placement) => patterns.some((pattern) => pattern.id === placement.pattern))).toBe(true);
    expect(result.blueprint?.routes.every((route) => route.smartPath === road.id)).toBe(true);
  });
});
