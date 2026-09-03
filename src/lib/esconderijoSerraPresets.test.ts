import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { ESCONDERIJO_SERRA_PRESETS, ESCONDERIJO_SERRA_SPECS } from "./esconderijoSerraPresets";

const expected = [
  ["MAP_MAGMA_HIDEOUT_1F", 37, 38],
  ["MAP_MAGMA_HIDEOUT_2F_1R", 33, 39],
  ["MAP_MAGMA_HIDEOUT_2F_2R", 49, 28],
  ["MAP_MAGMA_HIDEOUT_2F_3R", 60, 19],
  ["MAP_MAGMA_HIDEOUT_3F_1R", 28, 24],
  ["MAP_MAGMA_HIDEOUT_3F_2R", 24, 17],
  ["MAP_MAGMA_HIDEOUT_3F_3R", 33, 24],
  ["MAP_MAGMA_HIDEOUT_4F", 59, 28],
] as const;

describe("presets do Esconderijo da Serra", () => {
  it("cobre os oito mapas reais com guards de dimensão/map id/tileset", () => {
    expect(ESCONDERIJO_SERRA_PRESETS).toHaveLength(8);
    const specs = Object.values(ESCONDERIJO_SERRA_SPECS);
    expect(specs.map((spec) => [spec.mapId, spec.width, spec.height])).toEqual(expected);
    for (const entry of ESCONDERIJO_SERRA_PRESETS) {
      const spec = specs.find((candidate) => candidate.id === entry.id)!;
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Lavaridge" }).enabled, spec.mapId).toBe(true);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: "MAP_FAKE" }).enabled, spec.mapId).toBe(false);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Cave" }).enabled, spec.mapId).toBe(false);
    }
  });

  it("permanece layered-only e ativa proteção funcional em todos os mapas", () => {
    for (const entry of ESCONDERIJO_SERRA_PRESETS) {
      const spec = Object.values(ESCONDERIJO_SERRA_SPECS).find((candidate) => candidate.id === entry.id)!;
      expect(isAiRemodelPrompt(entry.prompt), entry.label).toBe(true);
      expect(entry.prompt).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(entry.prompt);
      expect(layered.active, entry.label).toBe(true);
      expect(layered.errors, entry.label).toEqual([]);
      const parsed = parseLocalMapCommand(entry.prompt, [], [], spec.width, spec.height);
      expect(parsed.errors, entry.label).toEqual([]);
      expect(parsed.plan?.connections, entry.label).toEqual([]);
    }
  });

  it("declara explicitamente os pontos de progressão que não podem mover", () => {
    const floor1 = ESCONDERIJO_SERRA_PRESETS.find((entry) => entry.id === "piloto-esconderijo-serra-1f")!.prompt;
    expect(floor1).toMatch(/três boulders de Strength/i);
    expect(floor1).toMatch(/VAR_JAGGED_PASS_ASH_WEATHER/);

    const floor4 = ESCONDERIJO_SERRA_PRESETS.find((entry) => entry.id === "piloto-esconderijo-serra-4f")!.prompt;
    expect(floor4).toMatch(/\(16,17\)/);
    expect(floor4).toMatch(/\(16,21\)/);
    expect(floor4).toMatch(/GroudonApproach/);
    expect(floor4).toMatch(/dofieldeffectsparkle 18,42/);
  });
});
