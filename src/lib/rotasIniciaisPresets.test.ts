import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { ROTAS_INICIAIS_PRESETS, ROTAS_INICIAIS_SPECS } from "./rotasIniciaisPresets";

const expected = [
  ["MAP_ROUTE101", 20, 20],
  ["MAP_ROUTE102", 50, 20],
  ["MAP_ROUTE103", 80, 22],
] as const;

const expectedConnections = new Map([
  ["MAP_ROUTE101", [
    { direction: "north", map: "MAP_OLDALE_TOWN", offset: 0 },
    { direction: "south", map: "MAP_LITTLEROOT_TOWN", offset: 0 },
  ]],
  ["MAP_ROUTE102", [
    { direction: "west", map: "MAP_PETALBURG_CITY", offset: -10 },
    { direction: "east", map: "MAP_OLDALE_TOWN", offset: 0 },
  ]],
  ["MAP_ROUTE103", [
    { direction: "south", map: "MAP_OLDALE_TOWN", offset: 0 },
    { direction: "east", map: "MAP_ROUTE110", offset: -60 },
  ]],
]);

describe("presets das rotas iniciais 101-103", () => {
  it("usa os três layouts reais General + Petalburg", () => {
    expect(ROTAS_INICIAIS_PRESETS).toHaveLength(3);
    const specs = Object.values(ROTAS_INICIAIS_SPECS);
    expect(specs.map((spec) => [spec.mapId, spec.width, spec.height])).toEqual(expected);
    for (const entry of ROTAS_INICIAIS_PRESETS) {
      const spec = specs.find((candidate) => candidate.id === entry.id)!;
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Petalburg" }).enabled, spec.mapId).toBe(true);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: "MAP_FAKE" }).enabled, spec.mapId).toBe(false);
    }
  });

  it("compila em camadas e replica exatamente as connections reais", () => {
    for (const entry of ROTAS_INICIAIS_PRESETS) {
      const spec = Object.values(ROTAS_INICIAIS_SPECS).find((candidate) => candidate.id === entry.id)!;
      expect(isAiRemodelPrompt(entry.prompt), entry.label).toBe(true);
      expect(entry.prompt).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(entry.prompt);
      expect(layered.active, entry.label).toBe(true);
      expect(layered.errors, entry.label).toEqual([]);
      const parsed = parseLocalMapCommand(entry.prompt, [], [], spec.width, spec.height);
      expect(parsed.errors, entry.label).toEqual([]);
      expect(parsed.plan?.connections, entry.label).toEqual(expectedConnections.get(spec.mapId));
    }
  });

  it("congela as duas cenas iniciais que dependem de coordenadas", () => {
    const r101 = ROTAS_INICIAIS_PRESETS.find((entry) => entry.id === "piloto-rota-101-terra-de-arauna")!.prompt;
    expect(r101).toMatch(/Birch em \(0,15\)/);
    expect(r101).toMatch(/Zigzagoon em \(0,16\)/);
    expect(r101).toMatch(/setobjectxy do jogador em \(6,13\)/);

    const r103 = ROTAS_INICIAIS_PRESETS.find((entry) => entry.id === "piloto-rota-103-terra-de-arauna")!.prompt;
    expect(r103).toMatch(/LOCALID_ROUTE103_RIVAL em \(10,3\)/);
    expect(r103).toMatch(/setmetatile escreve .*\(45,5\).*\(45,6\)/i);
    expect(r103).toMatch(/MAP_ROUTE110 offset -60/);
  });
});
