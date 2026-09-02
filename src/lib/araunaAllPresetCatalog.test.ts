import { describe, expect, it } from "vitest";
import { ARAUNA_ALL_PRESETS } from "./araunaAllPresetCatalog";
import { CAVERNAS_MBOI_CATALOG_ENTRIES } from "./cavernasMboiCatalog";

const mboiMaps = [
  ["Cavernas M'Boi · Entrada", 20, 20, "MAP_SEAFLOOR_CAVERN_ENTRANCE"],
  ["Cavernas M'Boi · Sala 1", 20, 21, "MAP_SEAFLOOR_CAVERN_ROOM1"],
  ["Cavernas M'Boi · Sala 2", 18, 12, "MAP_SEAFLOOR_CAVERN_ROOM2"],
  ["Cavernas M'Boi · Sala 3", 16, 17, "MAP_SEAFLOOR_CAVERN_ROOM3"],
  ["Cavernas M'Boi · Sala 4", 18, 19, "MAP_SEAFLOOR_CAVERN_ROOM4"],
  ["Cavernas M'Boi · Sala 5", 20, 20, "MAP_SEAFLOOR_CAVERN_ROOM5"],
  ["Cavernas M'Boi · Sala 6 · Correntes", 24, 23, "MAP_SEAFLOOR_CAVERN_ROOM6"],
  ["Cavernas M'Boi · Sala 7 · Correntes", 23, 25, "MAP_SEAFLOOR_CAVERN_ROOM7"],
  ["Cavernas M'Boi · Sala 8", 11, 14, "MAP_SEAFLOOR_CAVERN_ROOM8"],
  ["Cavernas M'Boi · Núcleo", 27, 46, "MAP_SEAFLOOR_CAVERN_ROOM9"],
] as const;

describe("catálogo agregado de presets de Arauna", () => {
  it("soma os 28 presets históricos e as dez salas de M'Boi sem ids duplicados", () => {
    expect(CAVERNAS_MBOI_CATALOG_ENTRIES).toHaveLength(10);
    expect(ARAUNA_ALL_PRESETS).toHaveLength(38);
    expect(new Set(ARAUNA_ALL_PRESETS.map((entry) => entry.id)).size).toBe(38);
  });

  it("expõe cada sala de M'Boi somente no map id real", () => {
    for (const [label, width, height, mapId] of mboiMaps) {
      const entry = ARAUNA_ALL_PRESETS.find((candidate) => candidate.label === label);
      expect(entry, label).toBeTruthy();
      expect(entry!.guardFromAtlas(width, height, mapId, null).enabled, label).toBe(true);
      expect(entry!.guardFromAtlas(width, height, "MAP_SEAFLOOR_CAVERN_ROOM99", null).enabled, label).toBe(false);
    }
  });
});
