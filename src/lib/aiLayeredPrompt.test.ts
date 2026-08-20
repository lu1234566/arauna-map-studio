import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import {
  finishLayeredPromptMap,
  LAYER_OCCUPANCY,
  parseLayeredPrompt,
  planLayeredPromptBase,
} from "./aiLayeredPrompt";
import { MAP_BLUEPRINT_FORMAT, type MapBlueprint } from "./mapBlueprint";
import { MAP_PATTERN_FORMAT, type MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import { SMART_PATH_FORMAT, type SmartPathPreset } from "./smartPath";

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
  records: [
    { id: 1, source: "primary", localId: 1, behavior: 0x00, layerType: 0, slot: 0 },
    { id: 2, source: "primary", localId: 2, behavior: 0x00, layerType: 0, slot: 1 },
    { id: 3, source: "primary", localId: 3, behavior: 0x00, layerType: 0, slot: 2 },
    { id: 4, source: "primary", localId: 4, behavior: 0x00, layerType: 0, slot: 3 },
    { id: 5, source: "primary", localId: 5, behavior: 0x10, layerType: 0, slot: 4 },
    { id: 6, source: "primary", localId: 6, behavior: 0x00, layerType: 0, slot: 5 },
    { id: 7, source: "primary", localId: 7, behavior: 0x00, layerType: 1, slot: 6 },
    { id: 8, source: "primary", localId: 8, behavior: 0x00, layerType: 0, slot: 7 },
  ],
} as SavedRealAtlas;

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

const greenDetail: MapPattern = {
  format: MAP_PATTERN_FORMAT,
  id: "auto-slateport-green-0-0",
  name: "Trecho verde real 1",
  category: "Vegetação · trecho",
  tags: ["verde", "extraído do mapa"],
  width: 2,
  height: 2,
  kind: "raw",
  values: [8, 8, 8, 8],
  ports: [],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const path: SmartPathPreset = {
  format: SMART_PATH_FORMAT,
  id: "urban-path",
  name: "Via urbana pelos acessos reais",
  variants: Array.from({ length: 16 }, () => 6),
  eraseMetatile: 1,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

function blueprint(patterns: MapBlueprint["patterns"] = []): MapBlueprint {
  return {
    format: MAP_BLUEPRINT_FORMAT,
    name: "Layered test",
    width: 12,
    height: 10,
    patterns,
    routes: [],
  };
}

const prompt = `GERAR EM CAMADAS
CAMADA 1 — ZONAS BASE
- bairro oeste: x=0..5, y=0..9 -> concreto urbano
- jardim leste: x=6..11, y=0..9 -> grama
CAMADA 3 — RUAS
- avenida principal em x=5..6, y=0..9
CAMADA 5 — DETALHES
- vegetação apenas nas zonas verdes
- não misture materiais fora de sua zona`;

describe("layered prompt compiler", () => {
  it("parses ground ranges and road corridors from a layered prompt", () => {
    const parsed = parseLayeredPrompt(prompt);
    expect(parsed.active).toBe(true);
    expect(parsed.zones.filter((zone) => zone.kind === "ground")).toHaveLength(2);
    expect(parsed.zones.filter((zone) => zone.kind === "road")).toHaveLength(1);
    expect(parsed.zones[0]?.material.role).toBe("urban");
    expect(parsed.zones[1]?.material.role).toBe("green");
  });

  it("builds a deterministic occupancy map and keeps structures/events out of ground writes", () => {
    const map = createEmptyMap(12, 10, 1);
    map.metatiles[idx(11, 5, map.width)] = 5;
    const result = planLayeredPromptBase(
      map,
      prompt,
      atlas,
      [house, greenDetail],
      [{ x: 1, y: 1, kind: "warp", label: "W0" }],
      reconstruction,
      4,
      blueprint([{ pattern: "house", x: 2, y: 2 }]),
    );

    expect(result.active).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.map.metatiles[idx(2, 8, map.width)]).toBe(2);
    expect(result.map.metatiles[idx(9, 8, map.width)]).toBe(3);
    expect(result.map.metatiles[idx(5, 8, map.width)]).toBe(2);
    expect(result.occupancy[idx(2, 2, map.width)]).toBe(LAYER_OCCUPANCY.structure);
    expect(result.map.metatiles[idx(1, 1, map.width)]).toBe(1);
    expect(result.map.metatiles[idx(11, 5, map.width)]).toBe(5);
  });

  it("rejects conflicting non-preserve ground zones before touching the map", () => {
    const map = createEmptyMap(12, 10, 1);
    const conflicting = `CAMADA 1 — ZONAS BASE
zona A: x=0..7, y=0..9 -> concreto urbano
zona B: x=6..11, y=0..9 -> grama`;
    const result = planLayeredPromptBase(map, conflicting, atlas, [], [], reconstruction, 4, blueprint());
    expect(result.active).toBe(true);
    expect(result.errors.some((error) => error.includes("sobrepõe outro material"))).toBe(true);
    expect(result.touched).toHaveLength(0);
  });

  it("allows preserve coast guards to overlap a concrete/port zone without material conflict", () => {
    const map = createEmptyMap(12, 10, 1);
    const layered = `CAMADA 1 — ZONAS BASE
faixa costeira: x=8..11, y=0..9 -> água/costa
porto: x=6..10, y=2..8 -> piso portuário`;
    const result = planLayeredPromptBase(map, layered, atlas, [], [], reconstruction, 4, blueprint());
    expect(result.errors).toEqual([]);
    expect(result.map.metatiles[idx(7, 5, map.width)]).toBe(4);
  });

  it("finish layer restores exact zone material while preserving Smart Paths and allowed details", () => {
    const map = createEmptyMap(12, 10, 1);
    const bp = blueprint([{ pattern: "auto-slateport-green-0-0", x: 8, y: 4 }]);
    const base = planLayeredPromptBase(map, prompt, atlas, [greenDetail], [], reconstruction, 4, bp);
    expect(base.errors).toEqual([]);

    const composed = createEmptyMap(12, 10, 1);
    composed.metatiles[idx(2, 8, composed.width)] = 8;
    composed.metatiles[idx(5, 8, composed.width)] = 6;
    composed.metatiles[idx(8, 4, composed.width)] = 8;
    composed.metatiles[idx(9, 4, composed.width)] = 8;
    composed.metatiles[idx(8, 5, composed.width)] = 8;
    composed.metatiles[idx(9, 5, composed.width)] = 8;

    const finish = finishLayeredPromptMap(composed, base, atlas, [path]);
    expect(finish.map.metatiles[idx(2, 8, composed.width)]).toBe(2);
    expect(finish.map.metatiles[idx(5, 8, composed.width)]).toBe(6);
    expect(finish.map.metatiles[idx(8, 4, composed.width)]).toBe(8);
    expect(finish.pathPreservedCount).toBeGreaterThan(0);
    expect(finish.detailPreservedCount).toBeGreaterThan(0);
  });

  it("blocks full-coverage prompts when editable cells remain unset", () => {
    const map = createEmptyMap(12, 10, 1);
    const incomplete = `CAMADA 1 — ZONAS BASE
zona A: x=0..3, y=0..9 -> concreto urbano
REGRAS
- preencher 100% do mapa`;
    const result = planLayeredPromptBase(map, incomplete, atlas, [], [], reconstruction, 4, blueprint());
    expect(result.errors.some((error) => error.includes("UNSET"))).toBe(true);
  });
});
