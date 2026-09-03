import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { ROTAS_INTERIORES_PRESETS, ROTAS_INTERIORES_SPECS } from "./rotasInterioresPresets";

const expected = [
  ["MAP_ROUTE112", 40, 60, "gTileset_Lavaridge"],
  ["MAP_ROUTE113", 100, 20, "gTileset_Fallarbor"],
  ["MAP_ROUTE114", 40, 80, "gTileset_Fallarbor"],
  ["MAP_ROUTE115", 40, 80, "gTileset_Fallarbor"],
  ["MAP_ROUTE116", 100, 20, "gTileset_Rustboro"],
  ["MAP_ROUTE117", 60, 20, "gTileset_Mauville"],
] as const;

const connections = new Map<string, unknown[]>([
  ["MAP_ROUTE112", [
    { direction: "north", map: "MAP_ROUTE113", offset: -60 },
    { direction: "west", map: "MAP_LAVARIDGE_TOWN", offset: 40 },
    { direction: "east", map: "MAP_ROUTE111", offset: -20 },
  ]],
  ["MAP_ROUTE113", [
    { direction: "south", map: "MAP_ROUTE112", offset: 60 },
    { direction: "west", map: "MAP_FALLARBOR_TOWN", offset: 0 },
    { direction: "east", map: "MAP_ROUTE111", offset: 0 },
  ]],
  ["MAP_ROUTE114", [
    { direction: "west", map: "MAP_ROUTE115", offset: 40 },
    { direction: "east", map: "MAP_FALLARBOR_TOWN", offset: 0 },
  ]],
  ["MAP_ROUTE115", [
    { direction: "south", map: "MAP_RUSTBORO_CITY", offset: 0 },
    { direction: "east", map: "MAP_ROUTE114", offset: -40 },
  ]],
  ["MAP_ROUTE116", [
    { direction: "south", map: "MAP_VERDANTURF_TOWN", offset: 80 },
    { direction: "west", map: "MAP_RUSTBORO_CITY", offset: 0 },
  ]],
  ["MAP_ROUTE117", [
    { direction: "west", map: "MAP_VERDANTURF_TOWN", offset: 0 },
    { direction: "east", map: "MAP_MAUVILLE_CITY", offset: 0 },
  ]],
]);

describe("presets das rotas 112-117", () => {
  it("usa os seis layouts e tilesets reais", () => {
    expect(ROTAS_INTERIORES_PRESETS).toHaveLength(6);
    const specs = Object.values(ROTAS_INTERIORES_SPECS);
    expect(specs.map((spec) => [spec.mapId, spec.width, spec.height, spec.secondary])).toEqual(expected);
    for (const entry of ROTAS_INTERIORES_PRESETS) {
      const spec = specs.find((candidate) => candidate.id === entry.id)!;
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: spec.mapId, atlasPrimary: "gTileset_General", atlasSecondary: spec.secondary }).enabled, spec.mapId).toBe(true);
      expect(entry.guard({ width: spec.width, height: spec.height, mapId: "MAP_FAKE" }).enabled, spec.mapId).toBe(false);
    }
  });

  it("compila em camadas e replica exatamente as connections reais", () => {
    for (const entry of ROTAS_INTERIORES_PRESETS) {
      const spec = Object.values(ROTAS_INTERIORES_SPECS).find((candidate) => candidate.id === entry.id)!;
      expect(isAiRemodelPrompt(entry.prompt), entry.label).toBe(true);
      const layered = parseLayeredPrompt(entry.prompt);
      expect(layered.active, entry.label).toBe(true);
      expect(layered.errors, entry.label).toEqual([]);
      const parsed = parseLocalMapCommand(entry.prompt, [], [], spec.width, spec.height);
      expect(parsed.errors, entry.label).toEqual([]);
      expect(parsed.plan?.connections, entry.label).toEqual(connections.get(spec.mapId));
    }
  });

  it("congela toda a geometria dinâmica de clima anormal", () => {
    const r114 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-114-vale-rochoso")!.prompt;
    expect(r114).toMatch(/\(7,3\)\/\(7,4\)/);
    expect(r114).toMatch(/\(6,45\)\/\(6,46\)/);

    const r115 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-115-costa-serra")!.prompt;
    expect(r115).toMatch(/\(21,5\)\/\(21,6\)/);
    expect(r115).toMatch(/\(36,9\)\/\(36,10\)/);

    const r116 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-116-caminho-tunel")!.prompt;
    expect(r116).toMatch(/\(59,12\)\/\(59,13\)/);
    expect(r116).toMatch(/\(38,10\)/);
  });

  it("preserva os palcos especiais de 112, 113 e 117", () => {
    const r112 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-112-encosta-serra")!.prompt;
    expect(r112).toMatch(/teleférico/i);
    expect(r112).toMatch(/\(28\.\.29,27\)/);
    expect(r112).toMatch(/Jagged Pass/);
    expect(r112).toMatch(/Fiery Path/);

    const r113 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-113-campo-cinzas")!.prompt;
    expect(r113).toMatch(/COORD_EVENT_WEATHER_VOLCANIC_ASH/);
    expect(r113).toMatch(/Glass Workshop/);

    const r117 = ROTAS_INTERIORES_PRESETS.find((entry) => entry.id === "piloto-rota-117-campos-encruzilhada")!.prompt;
    expect(r117).toMatch(/MAP_ROUTE117_POKEMON_DAY_CARE/);
    expect(r117).toMatch(/LOCALID_DAYCARE_MAN/);
  });
});
