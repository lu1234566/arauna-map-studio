import { describe, expect, it } from "vitest";
import { ARAUNA_ALL_PRESETS } from "./araunaAllPresetCatalog";
import { CAVERNAS_MBOI_CATALOG_ENTRIES } from "./cavernasMboiCatalog";
import { GRUTA_DA_MARE_CATALOG_ENTRIES } from "./grutaDaMareCatalog";

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

const mareMaps = [
  ["Gruta da Maré · Entrada · baixa", 35, 35, "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM"],
  ["Gruta da Maré · Entrada · alta", 35, 35, "MAP_SHOAL_CAVE_HIGH_TIDE_ENTRANCE_ROOM"],
  ["Gruta da Maré · Interior · baixa", 46, 38, "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM"],
  ["Gruta da Maré · Interior · alta", 46, 38, "MAP_SHOAL_CAVE_HIGH_TIDE_INNER_ROOM"],
  ["Gruta da Maré · Sala Inferior", 31, 14, "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM"],
  ["Gruta da Maré · Escadarias", 21, 15, "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM"],
  ["Gruta da Maré · Câmara de Gelo", 20, 30, "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM"],
] as const;

describe("catálogo agregado de presets de Arauna", () => {
  it("soma 28 presets históricos, dez salas de M'Boi e sete estados da Gruta da Maré sem ids duplicados", () => {
    expect(CAVERNAS_MBOI_CATALOG_ENTRIES).toHaveLength(10);
    expect(GRUTA_DA_MARE_CATALOG_ENTRIES).toHaveLength(7);
    expect(ARAUNA_ALL_PRESETS).toHaveLength(45);
    expect(new Set(ARAUNA_ALL_PRESETS.map((entry) => entry.id)).size).toBe(45);
  });

  it("expõe cada sala de M'Boi somente no map id real", () => {
    for (const [label, width, height, mapId] of mboiMaps) {
      const entry = ARAUNA_ALL_PRESETS.find((candidate) => candidate.label === label);
      expect(entry, label).toBeTruthy();
      expect(entry!.guardFromAtlas(width, height, mapId, null).enabled, label).toBe(true);
      expect(entry!.guardFromAtlas(width, height, "MAP_SEAFLOOR_CAVERN_ROOM99", null).enabled, label).toBe(false);
    }
  });

  it("expõe cada estado da Gruta da Maré somente no map id real", () => {
    for (const [label, width, height, mapId] of mareMaps) {
      const entry = ARAUNA_ALL_PRESETS.find((candidate) => candidate.label === label);
      expect(entry, label).toBeTruthy();
      expect(entry!.guardFromAtlas(width, height, mapId, null).enabled, label).toBe(true);
      expect(entry!.guardFromAtlas(width, height, "MAP_SHOAL_CAVE_FAKE", null).enabled, label).toBe(false);
    }
  });
});
