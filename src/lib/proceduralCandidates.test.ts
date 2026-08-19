import { describe, expect, it } from "vitest";
import {
  candidateQuality,
  candidateSeed,
  generateProceduralCandidates,
  scoreProceduralCandidate,
} from "./proceduralCandidates";
import { createProceduralBlueprintSpec, type ProceduralBlueprintResult } from "./proceduralBlueprint";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import { createSmartPathPreset } from "./smartPath";

function pattern(id: string, width = 3, height = 3): MapPattern {
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

function road() {
  const preset = createSmartPathPreset("road", 100, 0);
  preset.id = "road";
  preset.variants = Array.from({ length: 16 }, (_, mask) => 100 + mask);
  return preset;
}

function fakeResult(overrides: Partial<ProceduralBlueprintResult> = {}): ProceduralBlueprintResult {
  return {
    ok: true,
    blueprint: null,
    compiled: null,
    placements: [],
    roads: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe("Procedural seed candidates", () => {
  it("keeps the current seed first and creates stable suffixes", () => {
    expect(candidateSeed("vila", 0)).toBe("vila");
    expect(candidateSeed("vila", 1)).toBe("vila-02");
    expect(candidateSeed("vila", 7)).toBe("vila-08");
  });

  it("labels score quality thresholds", () => {
    expect(candidateQuality(95)).toBe("Excelente");
    expect(candidateQuality(80)).toBe("Bom");
    expect(candidateQuality(40)).toBe("Parcial");
    expect(candidateQuality(0)).toBe("Inválido");
  });

  it("scores full completion at 100 without warnings", () => {
    const spec = createProceduralBlueprintSpec(30, 24);
    spec.landmarkPatternIds = ["lab", "house"];
    spec.fillerPatternIds = ["tree"];
    spec.fillerCount = 2;
    spec.roadPresetId = "road";
    spec.exits = { north: true, east: false, south: true, west: false };
    const result = fakeResult({
      placements: [
        { role: "landmark", patternId: "lab", x: 1, y: 1, width: 2, height: 2, anchor: { x: 2, y: 3 } },
        { role: "landmark", patternId: "house", x: 8, y: 1, width: 2, height: 2, anchor: { x: 9, y: 3 } },
        { role: "filler", patternId: "tree", x: 1, y: 8, width: 2, height: 2, anchor: { x: 2, y: 10 } },
        { role: "filler", patternId: "tree", x: 8, y: 8, width: 2, height: 2, anchor: { x: 9, y: 10 } },
      ],
      roads: [
        { kind: "landmark", label: "lab", points: [{ x: 2, y: 3 }, { x: 5, y: 3 }] },
        { kind: "landmark", label: "house", points: [{ x: 9, y: 3 }, { x: 5, y: 3 }] },
        { kind: "exit", label: "north", points: [{ x: 5, y: 3 }, { x: 5, y: 0 }] },
        { kind: "exit", label: "south", points: [{ x: 5, y: 3 }, { x: 5, y: 23 }] },
      ],
    });
    expect(scoreProceduralCandidate(spec, result).total).toBe(100);
  });

  it("penalizes missing requested pieces and warnings", () => {
    const spec = createProceduralBlueprintSpec(30, 24);
    spec.landmarkPatternIds = ["lab", "house"];
    spec.fillerPatternIds = ["tree"];
    spec.fillerCount = 4;
    spec.roadPresetId = "road";
    spec.exits = { north: true, east: true, south: false, west: false };
    const result = fakeResult({
      placements: [
        { role: "landmark", patternId: "lab", x: 1, y: 1, width: 2, height: 2, anchor: { x: 2, y: 3 } },
        { role: "filler", patternId: "tree", x: 4, y: 4, width: 2, height: 2, anchor: { x: 5, y: 6 } },
      ],
      roads: [{ kind: "exit", label: "north", points: [{ x: 5, y: 5 }, { x: 5, y: 0 }] }],
      warnings: ["one", "two"],
    });
    const score = scoreProceduralCandidate(spec, result);
    expect(score.landmarks).toBe(15);
    expect(score.fillers).toBe(5);
    expect(score.exits).toBe(10);
    expect(score.landmarkConnections).toBe(0);
    expect(score.cleanRun).toBe(6);
    expect(score.total).toBe(36);
  });

  it("generates a ranked deterministic gallery", () => {
    const plaza = pattern("plaza", 5, 4);
    const house = pattern("house", 3, 3);
    const grove = pattern("grove", 4, 4);
    const path = road();
    const spec = createProceduralBlueprintSpec(28, 22);
    spec.seed = "gallery";
    spec.centerPatternId = plaza.id;
    spec.landmarkPatternIds = [house.id];
    spec.fillerPatternIds = [grove.id, house.id];
    spec.fillerCount = 5;
    spec.roadPresetId = path.id;
    spec.exits = { north: true, east: false, south: true, west: false };

    const a = generateProceduralCandidates(spec, [plaza, house, grove], [path], undefined, 6);
    const b = generateProceduralCandidates(spec, [plaza, house, grove], [path], undefined, 6);
    expect(a).toHaveLength(6);
    expect(a.map((candidate) => candidate.seed)).toEqual(b.map((candidate) => candidate.seed));
    expect(a.map((candidate) => candidate.score.total)).toEqual(b.map((candidate) => candidate.score.total));
    for (let i = 1; i < a.length; i++) {
      expect(a[i - 1]!.score.total).toBeGreaterThanOrEqual(a[i]!.score.total);
    }
  });

  it("caps gallery size at 24", () => {
    const result = generateProceduralCandidates(createProceduralBlueprintSpec(10, 10), [], [], undefined, 999);
    expect(result).toHaveLength(24);
  });
});
