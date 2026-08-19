import { describe, expect, it } from "vitest";
import { createEmptyMap } from "./emeraldMap";
import {
  createMapTemplate,
  expandOrthogonalPolyline,
  parseMapTemplateJson,
  planMapTemplate,
  serializeMapTemplates,
  templateDependencies,
  validateMapTemplate,
} from "./mapTemplate";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";

function pattern(id = "house", kind: MapPattern["kind"] = "visual"): MapPattern {
  const now = new Date().toISOString();
  return {
    format: MAP_PATTERN_FORMAT,
    id,
    name: id,
    category: "Test",
    tags: [],
    width: 2,
    height: 2,
    kind,
    values: kind === "raw"
      ? [0xb807, 0xb808, 0xb809, 0xb80a]
      : [7, 8, 9, 10],
    createdAt: now,
    updatedAt: now,
  };
}

function pathPreset() {
  const preset = createSmartPathPreset("road", 100, 0);
  preset.id = "road";
  preset.variants = Array.from({ length: 16 }, (_, mask) => 100 + mask);
  return preset;
}

describe("Map Template engine", () => {
  it("validates orthogonal Smart Path segments", () => {
    const template = createMapTemplate("Village", 12, 12);
    template.elements.push({
      type: "smartPath",
      presetId: "road",
      points: [{ x: 1, y: 1 }, { x: 4, y: 3 }],
    });
    const report = validateMapTemplate(template);
    expect(report.valid).toBe(false);
    expect(report.errors.some((message) => message.includes("ortogonal"))).toBe(true);
  });

  it("expands an orthogonal polyline without duplicating joints", () => {
    expect(expandOrthogonalPolyline([
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 3, y: 3 },
    ])).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it("reports missing pattern and Smart Path dependencies", () => {
    const template = createMapTemplate("Village", 10, 10);
    template.elements = [
      { type: "pattern", patternId: "missing-pattern", x: 0, y: 0 },
      { type: "smartPath", presetId: "missing-path", points: [{ x: 1, y: 1 }] },
    ];
    const report = templateDependencies(template, [], []);
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toContain("missing-pattern");
    expect(report.errors.join(" ")).toContain("missing-path");
  });

  it("places visual patterns while preserving physical bits", () => {
    const map = createEmptyMap(8, 8, 1);
    map.physical.fill(0xa400);
    const house = pattern();
    const template = createMapTemplate("Village", 6, 6);
    template.elements.push({ type: "pattern", patternId: house.id, x: 1, y: 2 });
    const plan = planMapTemplate(map, template, 2, 1, [house], []);
    expect(plan.valid).toBe(true);
    expect(plan.map.metatiles[3 * 8 + 3]).toBe(7);
    expect(plan.map.metatiles[4 * 8 + 4]).toBe(10);
    expect(plan.map.physical[3 * 8 + 3]).toBe(0xa400);
  });

  it("applies RAW patterns as metatile plus physical bits", () => {
    const map = createEmptyMap(6, 6, 1);
    const raw = pattern("raw-house", "raw");
    const template = createMapTemplate("Raw", 4, 4);
    template.elements.push({ type: "pattern", patternId: raw.id, x: 0, y: 0 });
    const plan = planMapTemplate(map, template, 1, 1, [raw], []);
    const target = 1 * 6 + 1;
    expect(plan.map.metatiles[target]).toBe(7);
    expect(plan.map.physical[target]).toBe(0xb800);
  });

  it("composes a pattern and a Smart Path in one plan", () => {
    const map = createEmptyMap(10, 10, 1);
    const house = pattern();
    const road = pathPreset();
    const template = createMapTemplate("Village", 8, 8);
    template.elements = [
      { type: "pattern", patternId: house.id, x: 1, y: 1 },
      {
        type: "smartPath",
        presetId: road.id,
        points: [{ x: 0, y: 5 }, { x: 5, y: 5 }],
        mode: "add",
      },
    ];
    const plan = planMapTemplate(map, template, 1, 1, [house], [road]);
    expect(plan.valid).toBe(true);
    expect(plan.map.metatiles[2 * 10 + 2]).toBe(7);
    expect(plan.map.metatiles[6 * 10 + 1]).toBe(102); // east-only endpoint
    expect(plan.map.metatiles[6 * 10 + 6]).toBe(108); // west-only endpoint
    expect(plan.touched.length).toBeGreaterThan(6);
  });

  it("preserves protected cells and reports out-of-bounds template cells", () => {
    const map = createEmptyMap(4, 4, 1);
    const house = pattern();
    const template = createMapTemplate("Edge", 4, 4);
    template.elements.push({ type: "pattern", patternId: house.id, x: 0, y: 0 });
    const plan = planMapTemplate(
      map,
      template,
      3,
      3,
      [house],
      [],
      undefined,
      (x, y) => !(x === 3 && y === 3),
    );
    expect(plan.map.metatiles[3 * 4 + 3]).toBe(1);
    expect(plan.protectedCount).toBe(1);
    expect(plan.outOfBoundsCount).toBe(3);
  });

  it("round-trips templates through JSON", () => {
    const template = createMapTemplate("Arauna Village", 30, 24);
    template.category = "Vilas";
    template.tags = ["rural", "arauna"];
    template.elements = [{ type: "pattern", patternId: "house", x: 4, y: 7 }];
    const parsed = parseMapTemplateJson(serializeMapTemplates([template]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Arauna Village");
    expect(parsed[0]?.elements).toEqual(template.elements);
  });
});
