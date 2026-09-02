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
] as const;

describe("catálogo de presets adicionais de Arauna", () => {
  it("mantém dez presets com ids únicos", () => {
    expect(ARAUNA_ADDITIONAL_PRESETS).toHaveLength(10);
    expect(new Set(ARAUNA_ADDITIONAL_PRESETS.map((entry) => entry.id)).size).toBe(10);
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
