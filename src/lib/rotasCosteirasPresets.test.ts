import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { ROTAS_COSTEIRAS_PRESETS, ROTAS_COSTEIRAS_SPECS } from "./rotasCosteirasPresets";

const expected = [
  ["MAP_ROUTE104", 40, 80, "gTileset_Rustboro"],
  ["MAP_ROUTE105", 40, 80, "gTileset_Dewford"],
  ["MAP_ROUTE106", 80, 20, "gTileset_Dewford"],
  ["MAP_ROUTE107", 60, 20, "gTileset_Dewford"],
  ["MAP_ROUTE108", 60, 20, "gTileset_Slateport"],
  ["MAP_ROUTE109", 40, 63, "gTileset_Slateport"],
  ["MAP_ROUTE110", 40, 100, "gTileset_Mauville"],
] as const;

const connections = new Map<string, unknown[]>([
  ["MAP_ROUTE104", [
    { direction: "north", map: "MAP_RUSTBORO_CITY", offset: 0 },
    { direction: "south", map: "MAP_ROUTE105", offset: 0 },
    { direction: "east", map: "MAP_PETALBURG_CITY", offset: 50 },
  ]],
  ["MAP_ROUTE105", [
    { direction: "north", map: "MAP_ROUTE104", offset: 0 },
    { direction: "south", map: "MAP_ROUTE106", offset: 0 },
  ]],
  ["MAP_ROUTE106", [
    { direction: "north", map: "MAP_ROUTE105", offset: 0 },
    { direction: "south", map: "MAP_DEWFORD_TOWN", offset: 60 },
  ]],
  ["MAP_ROUTE107", [
    { direction: "west", map: "MAP_DEWFORD_TOWN", offset: 0 },
    { direction: "east", map: "MAP_ROUTE108", offset: 0 },
  ]],
  ["MAP_ROUTE108", [
    { direction: "west", map: "MAP_ROUTE107", offset: 0 },
    { direction: "east", map: "MAP_ROUTE109", offset: -40 },
  ]],
  ["MAP_ROUTE109", [
    { direction: "north", map: "MAP_SLATEPORT_CITY", offset: 0 },
    { direction: "west", map: "MAP_ROUTE108", offset: 40 },
  ]],
  ["MAP_ROUTE110", [
    { direction: "north", map: "MAP_MAUVILLE_CITY", offset: 0 },
    { direction: "south", map: "MAP_SLATEPORT_CITY", offset: 0 },
    { direction: "west", map: "MAP_ROUTE103", offset: 60 },
  ]],
]);

describe("presets das rotas costeiras 104-110", () => {
  it("usa os sete layouts e tilesets reais", () => {
    expect(ROTAS_COSTEIRAS_PRESETS).toHaveLength(7);
    const specs = Object.values(ROTAS_COSTEIRAS_SPECS);
    expect(specs.map((spec) => [spec.mapId, spec.width, spec.height, spec.secondary])).toEqual(expected);
    for (const entry of ROTAS_COSTEIRAS_PRESETS) {
      const spec = specs.find((candidate) => candidate.id === entry.id)!;
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: spec.secondary }).enabled, spec.mapId).toBe(true);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: "MAP_FAKE" }).enabled, spec.mapId).toBe(false);
    }
  });

  it("compila em camadas e mantém as connections cardeais reais", () => {
    for (const entry of ROTAS_COSTEIRAS_PRESETS) {
      const spec = Object.values(ROTAS_COSTEIRAS_SPECS).find((candidate) => candidate.id === entry.id)!;
      expect(isAiRemodelPrompt(entry.prompt), entry.label).toBe(true);
      expect(entry.prompt).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(entry.prompt);
      expect(layered.active, entry.label).toBe(true);
      expect(layered.errors, entry.label).toEqual([]);
      const parsed = parseLocalMapCommand(entry.prompt, [], [], spec.width, spec.height);
      expect(parsed.errors, entry.label).toEqual([]);
      expect(parsed.plan?.connections, entry.label).toEqual(connections.get(spec.mapId));
    }
  });

  it("não tenta converter a conexão Dive da Rota 105", () => {
    const prompt = ROTAS_COSTEIRAS_PRESETS.find((entry) => entry.id === "piloto-rota-105-costa-rochosa")!.prompt;
    expect(prompt).toMatch(/direction=dive/);
    expect(prompt).toMatch(/MAP_UNDERWATER_ROUTE105/);
    const parsed = parseLocalMapCommand(prompt, [], [], 40, 80);
    expect(parsed.plan?.connections).toEqual(connections.get("MAP_ROUTE105"));
  });

  it("congela os três palcos narrativos/coordenados do lote", () => {
    const r104 = ROTAS_COSTEIRAS_PRESETS.find((entry) => entry.id === "piloto-rota-104-mata-costa")!.prompt;
    expect(r104).toMatch(/\(17,52\)/);
    expect(r104).toMatch(/\(17,51\)/);
    expect(r104).toMatch(/VAR_BOARD_BRINEY_BOAT_STATE/);

    const r109 = ROTAS_COSTEIRAS_PRESETS.find((entry) => entry.id === "piloto-rota-109-praia-porto")!.prompt;
    expect(r109).toMatch(/LOCALID_ROUTE109_BRINEY\/BOAT/);

    const r110 = ROTAS_COSTEIRAS_PRESETS.find((entry) => entry.id === "piloto-rota-110-corredor-encruzilhada")!.prompt;
    expect(r110).toMatch(/\(34,54\)/);
    expect(r110).toMatch(/x=33,34,35 y=56/);
    expect(r110).toMatch(/Cycling Road/);
  });
});
