import { describe, expect, it } from "vitest";
import { ARAUNA_ADDITIONAL_PRESETS } from "./araunaPresetCatalog";

const expectedMaps = [
  ["Porto das Redes", 20, 20, "MAP_DEWFORD_TOWN"],
  ["Encruzilhada Central", 40, 20, "MAP_MAUVILLE_CITY"],
  ["Pampa da Espera", 30, 30, "MAP_PETALBURG_CITY"],
  ["Mata do Meio", 40, 20, "MAP_FORTREE_CITY"],
  ["Missões do Céu", 80, 40, "MAP_MOSSDEEP_CITY"],
  ["Vila da Passagem", 20, 20, "MAP_OLDALE_TOWN"],
  ["Campo das Cinzas", 20, 20, "MAP_FALLARBOR_TOWN"],
  ["Vale do Silêncio", 20, 20, "MAP_VERDANTURF_TOWN"],
  ["Casa da Fogueira", 20, 40, "MAP_PACIFIDLOG_TOWN"],
  ["Baía das Luzes", 80, 40, "MAP_LILYCOVE_CITY"],
  ["Galerias Serra", 36, 24, "MAP_RUSTURF_TUNNEL"],
  ["Gruta das Vozes · 1F", 42, 15, "MAP_GRANITE_CAVE_1F"],
  ["Gruta das Vozes · B1F", 32, 26, "MAP_GRANITE_CAVE_B1F"],
  ["Gruta das Vozes · B2F", 32, 26, "MAP_GRANITE_CAVE_B2F"],
  ["Gruta das Vozes · Seu Bento", 15, 14, "MAP_GRANITE_CAVE_STEVENS_ROOM"],
] as const;

describe("catálogo de presets adicionais de Arauna", () => {
  it("mantém quinze presets com ids únicos", () => {
    expect(ARAUNA_ADDITIONAL_PRESETS).toHaveLength(15);
    expect(new Set(ARAUNA_ADDITIONAL_PRESETS.map((entry) => entry.id)).size).toBe(15);
  });

  it("liga cada botão somente ao slot real esperado", () => {
    for (const [label, width, height, mapId] of expectedMaps) {
      const entry = ARAUNA_ADDITIONAL_PRESETS.find((candidate) => candidate.label === label);
      expect(entry, label).toBeTruthy();
      expect(entry!.guardFromAtlas(width, height, mapId, null).enabled, label).toBe(true);
      expect(entry!.guardFromAtlas(width, height, "MAP_LITTLEROOT_TOWN", null).enabled, label).toBe(false);
    }
  });
});
