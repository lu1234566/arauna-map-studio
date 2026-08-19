import { describe, expect, it } from "vitest";
import {
  MAP_BLUEPRINT_FORMAT,
  createBlueprintSpec,
  generateMapBlueprint,
  routeBlueprintRoad,
  type BlueprintPatternPlacement,
} from "./mapBlueprint";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";

function makePattern(id: string, width = 3, height = 3): MapPattern {
  const now = "2026-01-01T00:00:00.000Z";
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
    createdAt: now,
    updatedAt: now,
  };
}

function makeRoad() {
  const road = createSmartPathPreset("Estrada", 100, 0);
  road.id = "road";
  road.variants = Array.from({ length: 16 }, (_, mask) => 100 + mask);
  return road;
}

function overlaps(a: BlueprintPatternPlacement, b: BlueprintPatternPlacement, spacing: number) {
  return !(
    a.x + a.width + spacing <= b.x ||
    b.x + b.width + spacing <= a.x ||
    a.y + a.height + spacing <= b.y ||
    b.y + b.height + spacing <= a.y
  );
}

describe("Blueprint generator", () => {
  const plaza = makePattern("plaza", 5, 4);
  const lab = makePattern("lab", 4, 3);
  const house = makePattern("house", 3, 3);
  const grove = makePattern("grove", 4, 4);
  const patterns = [plaza, lab, house, grove];
  const road = makeRoad();

  it("creates reproducible placements and roads from the same seed", () => {
    const spec = createBlueprintSpec(30, 24);
    spec.seed = "same-seed";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id, house.id];
    spec.fillerPatternIds = [grove.id, house.id];
    spec.fillerCount = 5;
    spec.roadPresetId = road.id;
    spec.exits = { north: true, east: true, south: true, west: false };

    const a = generateMapBlueprint(spec, patterns, [road]);
    const b = generateMapBlueprint(spec, patterns, [road]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.placements).toEqual(b.placements);
    expect(a.roads).toEqual(b.roads);
    expect(a.template?.elements).toEqual(b.template?.elements);
  });

  it("centers the hub pattern and keeps generated structures separated", () => {
    const spec = createBlueprintSpec(32, 26);
    spec.seed = "spacing";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id, house.id];
    spec.fillerPatternIds = [grove.id, house.id];
    spec.fillerCount = 7;
    spec.spacing = 1;
    spec.roadPresetId = road.id;
    const result = generateMapBlueprint(spec, patterns, [road]);
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

  it("connects requested exits to map edges with orthogonal waypoints", () => {
    const spec = createBlueprintSpec(28, 22);
    spec.seed = "exits";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id];
    spec.roadPresetId = road.id;
    spec.exits = { north: true, east: true, south: false, west: true };
    const result = generateMapBlueprint(spec, patterns, [road]);
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

  it("routes around building rectangles when a free route exists", () => {
    const placements: BlueprintPatternPlacement[] = [{
      role: "landmark",
      patternId: "wall",
      x: 4,
      y: 1,
      width: 2,
      height: 7,
      anchor: { x: 5, y: 8 },
    }];
    const result = routeBlueprintRoad(12, 10, { x: 1, y: 4 }, { x: 10, y: 4 }, placements);
    expect(result.usedFallback).toBe(false);
    // The compressed route must leave y=4 before it can cross x=4..5.
    expect(result.points.length).toBeGreaterThan(2);
  });

  it("omits fillers with a warning when safe space is exhausted", () => {
    const huge = makePattern("huge", 8, 8);
    const spec = createBlueprintSpec(12, 12);
    spec.seed = "crowded";
    spec.centerPatternId = huge.id;
    spec.fillerPatternIds = [huge.id];
    spec.fillerCount = 6;
    spec.margin = 1;
    spec.spacing = 1;
    spec.exits = { north: false, east: false, south: false, west: false };
    const result = generateMapBlueprint(spec, [huge], []);
    expect(result.ok).toBe(true);
    expect(result.placements).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("Espaço esgotado"))).toBe(true);
  });

  it("fails closed when a scoped dependency belongs to another tileset", () => {
    const scoped = makePattern("scoped");
    scoped.scope = { primary: "gTileset_General", secondary: "gTileset_Petalburg" };
    const spec = createBlueprintSpec(20, 20);
    spec.centerPatternId = scoped.id;
    const result = generateMapBlueprint(
      spec,
      [scoped],
      [],
      { primary: "gTileset_General", secondary: "gTileset_Fallarbor" },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("outro tileset"))).toBe(true);
  });

  it("produces a valid declarative template using only verified dependency IDs", () => {
    const spec = createBlueprintSpec(30, 24);
    spec.format = MAP_BLUEPRINT_FORMAT;
    spec.seed = "template-contract";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [lab.id];
    spec.fillerPatternIds = [house.id];
    spec.fillerCount = 2;
    spec.roadPresetId = road.id;
    const result = generateMapBlueprint(spec, patterns, [road]);
    expect(result.ok).toBe(true);
    expect(result.template).not.toBeNull();
    const patternIds = result.template!.elements
      .filter((element) => element.type === "pattern")
      .map((element) => element.patternId);
    expect(patternIds.every((id) => patterns.some((pattern) => pattern.id === id))).toBe(true);
    const smartIds = result.template!.elements
      .filter((element) => element.type === "smartPath")
      .map((element) => element.presetId);
    expect(smartIds.every((id) => id === road.id)).toBe(true);
  });
});
