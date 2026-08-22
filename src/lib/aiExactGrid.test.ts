import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { AI_MAP_PLAN_FORMAT, compileAiMapPlan, type AiMapPlan } from "./aiMapPlan";
import { compileAiExactGrid, serializeAiExactGrid } from "./aiExactGrid";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import { createSmartPathPreset } from "./smartPath";

const atlas = {
  format: "arauna-real-atlas-v2",
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  columns: 16,
  tileSize: 16,
  width: 16,
  height: 16,
  createdAt: "2026-08-20T00:00:00.000Z",
  rgbaBase64: "",
  records: [1, 2, 3, 4, 6, 7, 8, 9].map((id, slot) => ({
    id,
    source: "primary" as const,
    localId: id,
    behavior: id === 9 ? 0x10 : 0x00,
    layerType: id === 7 ? 1 : 0,
    slot,
  })),
} as SavedRealAtlas;

const house: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "house",
  name: "Casa",
  category: "Prédio",
  tags: [],
  width: 2,
  height: 2,
  kind: "raw",
  values: [7, 7, 7, 7],
  ports: [],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const contextHouse: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "context-house",
  name: "Casa com contexto",
  category: "Prédio",
  tags: ["warp-anchor:4,8"],
  width: 5,
  height: 5,
  kind: "raw",
  values: [
    0x1009, 0x3008, 0x3008, 0x3008, 0x3008, 0x1009, 0x3008, 0x0407, 0x3008, 0x3008, 0x1009, 0x3008,
    0x0407, 0x3008, 0x3008, 0x1009, 0x3008, 0x3008, 0x3008, 0x3008, 0x1009, 0x3008, 0x3008, 0x3008,
    0x3008,
  ],
  ports: [{ id: "entrada", name: "Entrada", kind: "entrance", x: 2, y: 4 }],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const road = createSmartPathPreset("Via urbana", 6, 1);
road.id = "urban-road";
road.variants = Array.from({ length: 16 }, () => 6);

const reconstruction = {
  map: createEmptyMap(12, 10, 1),
  touched: [],
  baseMetatile: 1,
  urbanMetatile: 2,
  greenMetatile: 3,
  candidateCount: 120,
  preservedCount: 0,
  changedCount: 0,
  baseChangedCount: 0,
  urbanChangedCount: 0,
  greenChangedCount: 0,
  greenSeedCount: 0,
  orphanClearedCount: 0,
  confidence: 1,
  warnings: [],
};

function compiledPlan(pattern: MapPattern = house) {
  const plan: AiMapPlan = {
    format: AI_MAP_PLAN_FORMAT,
    name: "Exact Grid test",
    width: 12,
    height: 10,
    structures: [{ id: pattern.id, label: pattern.name, pattern: pattern.id, x: 2, y: 2 }],
    routes: [
      {
        smartPath: "urban-road",
        points: [
          { x: 5, y: 0 },
          { x: 5, y: 9 },
        ],
      },
    ],
    warps: [],
    connections: [],
  };
  return compileAiMapPlan(plan, [pattern], [road]);
}

const prompt = `RECONSTRUA EM CAMADAS
CAMADA 1 — SOLO BASE
x=0..11, y=0..9 -> metatile 0x001
CAMADA 2 — PISO URBANO
x=3..8, y=0..9 -> metatile 0x002
CAMADA 3 — RUAS
x=5..5, y=0..9 -> metatile 0x002
REGRAS
preencher 100% do mapa`;

describe("Exact Grid compiler", () => {
  it("resolves every map cell before apply and preserves structural ownership", () => {
    const map = createEmptyMap(12, 10, 1);
    const compiled = compiledPlan();
    expect(compiled.valid).toBe(true);

    const exact = compileAiExactGrid({
      sourceMap: map,
      prompt,
      compiled,
      atlas,
      patterns: [house],
      smartPaths: [road],
      reservedCells: [],
      reconstruction,
      portMetatile: 4,
    });

    expect(exact.active).toBe(true);
    expect(exact.valid).toBe(true);
    expect(exact.resolvedCount).toBe(120);
    expect(exact.totalCount).toBe(120);
    expect(exact.cells).toHaveLength(120);
    expect(exact.ownerCounts.structure).toBe(4);
    expect(exact.ownerCounts.road).toBeGreaterThan(0);
    expect(exact.checksum).toMatch(/^[0-9A-F]{8}$/);
    expect(exact.map.metatiles[idx(2, 2, map.width)]).toBe(7);
    expect(exact.map.metatiles[idx(4, 8, map.width)]).toBe(2);
    expect(exact.map.metatiles[idx(5, 8, map.width)]).toBe(6);
  });

  it("makes unknown walkable and water context at a raw facade border transparent", () => {
    const map = createEmptyMap(12, 10, 1);
    map.physical.fill(0x3000);
    map.physical[idx(0, 0, map.width)] = 0x1000;
    const compiled = compiledPlan(contextHouse);
    expect(compiled.valid).toBe(true);
    expect(compiled.blueprint?.patterns[0]).toMatchObject({
      pattern: "context-house",
      x: 2,
      y: 4,
    });

    const exact = compileAiExactGrid({
      sourceMap: map,
      prompt,
      compiled,
      atlas,
      patterns: [contextHouse],
      smartPaths: [road],
      reservedCells: [],
      reconstruction,
      portMetatile: 4,
    });

    expect(exact.valid).toBe(true);
    expect(exact.structureMask).not.toBeNull();
    expect(exact.structureMask!.transparentCount).toBeGreaterThanOrEqual(20);
    expect(exact.structureMask!.opaqueCount).toBeLessThanOrEqual(5);
    expect(exact.ownerCounts.structure).toBe(2);
    expect(exact.map.metatiles[idx(2, 2, map.width)]).toBe(1);
    expect(exact.cells[idx(2, 2, map.width)]!.owner).toBe("ground");
    expect(exact.map.metatiles[idx(2, 4, map.width)]).toBe(1);
    expect(exact.cells[idx(2, 4, map.width)]!.owner).toBe("ground");
    expect(exact.map.metatiles[idx(4, 3, map.width)]).toBe(2);
    expect(exact.cells[idx(4, 3, map.width)]!.owner).toBe("ground");
    expect(exact.map.metatiles[idx(4, 5, map.width)]).toBe(7);
    expect(exact.cells[idx(4, 5, map.width)]!.owner).toBe("structure");
  });

  it("normalizes rebuilt ground physics to the canonical physical value of that metatile", () => {
    const map = createEmptyMap(12, 10, 1);
    map.physical.fill(0x3000);
    map.physical[idx(0, 0, map.width)] = 0x1000;
    const exact = compileAiExactGrid({
      sourceMap: map,
      prompt,
      compiled: compiledPlan(contextHouse),
      atlas,
      patterns: [contextHouse],
      smartPaths: [road],
      reservedCells: [],
      reconstruction,
      portMetatile: 4,
    });

    expect(exact.valid).toBe(true);
    expect(exact.map.physical[idx(0, 0, map.width)]).toBe(0x3000);
    expect(exact.cells[idx(0, 0, map.width)]!.elevation).toBe(3);
    expect(exact.structureMask!.normalizedPhysicalCount).toBeGreaterThan(0);
  });

  it("serializes an explicit cell-by-cell manifest", () => {
    const map = createEmptyMap(12, 10, 1);
    const exact = compileAiExactGrid({
      sourceMap: map,
      prompt,
      compiled: compiledPlan(),
      atlas,
      patterns: [house],
      smartPaths: [road],
      reservedCells: [],
      reconstruction,
      portMetatile: 4,
    });
    const json = serializeAiExactGrid(exact);
    expect(json).toContain('"format": "arauna-exact-grid-v1"');
    expect(json).toContain('"metatile": "0x');
    expect(json).toContain('"owner": "structure"');
    expect(json).toContain('"structureMask"');
  });

  it("fails closed when strict layers leave editable cells UNSET", () => {
    const map = createEmptyMap(12, 10, 1);
    const incomplete = `RECONSTRUA EM CAMADAS
CAMADA 1 — SOLO BASE
x=0..2, y=0..2 -> metatile 0x001`;
    const exact = compileAiExactGrid({
      sourceMap: map,
      prompt: incomplete,
      compiled: compiledPlan(),
      atlas,
      patterns: [house],
      smartPaths: [road],
      reservedCells: [],
      reconstruction,
      portMetatile: 4,
    });
    expect(exact.active).toBe(true);
    expect(exact.valid).toBe(false);
    expect(exact.errors.some((message) => message.includes("UNSET"))).toBe(true);
  });
});
