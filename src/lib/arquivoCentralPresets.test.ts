import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { ARQUIVO_CENTRAL_PRESETS, ARQUIVO_CENTRAL_SPECS } from "./arquivoCentralPresets";

const expected = [
  ["MAP_AQUA_HIDEOUT_1F", 28, 30],
  ["MAP_AQUA_HIDEOUT_B1F", 51, 24],
  ["MAP_AQUA_HIDEOUT_B2F", 34, 24],
] as const;

describe("presets do Arquivo Central", () => {
  it("cobre apenas os três mapas jogáveis do Aqua Hideout", () => {
    expect(ARQUIVO_CENTRAL_PRESETS).toHaveLength(3);
    const specs = Object.values(ARQUIVO_CENTRAL_SPECS);
    expect(specs.map((spec) => [spec.mapId, spec.width, spec.height])).toEqual(expected);
    expect(specs.some((spec) => /UNUSED_RUBY/.test(spec.mapId))).toBe(false);
  });

  it("valida map id, dimensão e General + Facility", () => {
    const specs = Object.values(ARQUIVO_CENTRAL_SPECS);
    for (const entry of ARQUIVO_CENTRAL_PRESETS) {
      const spec = specs.find((candidate) => candidate.id === entry.id)!;
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Facility" }).enabled, spec.mapId).toBe(true);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: "MAP_FAKE" }).enabled, spec.mapId).toBe(false);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Lavaridge" }).enabled, spec.mapId).toBe(false);
    }
  });

  it("permanece layered-only e preserva behaviors funcionais", () => {
    for (const entry of ARQUIVO_CENTRAL_PRESETS) {
      const spec = Object.values(ARQUIVO_CENTRAL_SPECS).find((candidate) => candidate.id === entry.id)!;
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

  it("declara as mecânicas críticas do labirinto e da doca", () => {
    const b1 = ARQUIVO_CENTRAL_PRESETS.find((entry) => entry.id === "piloto-arquivo-central-b1f")!.prompt;
    expect(b1).toMatch(/25 warp_events/);
    expect(b1).toMatch(/Master Ball em \(15,9\)/);
    expect(b1).toMatch(/Electrode 1 em \(16,9\)/);

    const b2 = ARQUIVO_CENTRAL_PRESETS.find((entry) => entry.id === "piloto-arquivo-central-b2f")!.prompt;
    expect(b2).toMatch(/SumbarineDepartLeft/);
    expect(b2).toMatch(/quatro tiles à esquerda/);
    expect(b2).toMatch(/\(28,16\)\/\(28,17\)/);
  });
});
