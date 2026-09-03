import { describe, expect, it } from "vitest";
import { ARAUNA_ALL_PRESETS } from "./araunaAllPresetCatalog";
import { ARAUNA_ADDITIONAL_PRESETS } from "./araunaPresetCatalog";
import { ARQUIVO_CENTRAL_CATALOG_ENTRIES } from "./arquivoCentralCatalog";
import { CAVERNAS_MBOI_CATALOG_ENTRIES } from "./cavernasMboiCatalog";
import { ESCONDERIJO_SERRA_CATALOG_ENTRIES } from "./esconderijoSerraCatalog";
import { GRUTA_DA_MARE_CATALOG_ENTRIES } from "./grutaDaMareCatalog";
import { GRUTA_DA_ORIGEM_CATALOG_ENTRIES } from "./grutaDaOrigemCatalog";
import { NAVIO_PERDIDO_CATALOG_ENTRIES } from "./navioPerdidoCatalog";
import { PASSAGENS_NATURAIS_CATALOG_ENTRIES } from "./passagensNaturaisCatalog";
import { TORRE_JURAMENTO_CATALOG_ENTRIES } from "./torreJuramentoCatalog";
import { USINA_VELHA_CATALOG_ENTRIES } from "./usinaVelhaCatalog";

const families = [
  ["históricos", ARAUNA_ADDITIONAL_PRESETS, 28],
  ["Cavernas M'Boi", CAVERNAS_MBOI_CATALOG_ENTRIES, 10],
  ["Gruta da Origem", GRUTA_DA_ORIGEM_CATALOG_ENTRIES, 3],
  ["Gruta da Maré", GRUTA_DA_MARE_CATALOG_ENTRIES, 7],
  ["Usina Velha", USINA_VELHA_CATALOG_ENTRIES, 2],
  ["Torre Juramento", TORRE_JURAMENTO_CATALOG_ENTRIES, 8],
  ["Navio Perdido", NAVIO_PERDIDO_CATALOG_ENTRIES, 13],
  ["Passagens naturais", PASSAGENS_NATURAIS_CATALOG_ENTRIES, 3],
  ["Esconderijo da Serra", ESCONDERIJO_SERRA_CATALOG_ENTRIES, 8],
  ["Arquivo Central", ARQUIVO_CENTRAL_CATALOG_ENTRIES, 3],
] as const;

describe("catálogo agregado de presets de Arauna", () => {
  it("agrega todas as famílias com a cardinalidade esperada", () => {
    for (const [label, entries, expected] of families) expect(entries, label).toHaveLength(expected);
    expect(ARAUNA_ALL_PRESETS).toHaveLength(85);
  });

  it("não contém ids duplicados e expõe integralmente cada família", () => {
    expect(new Set(ARAUNA_ALL_PRESETS.map((entry) => entry.id)).size).toBe(ARAUNA_ALL_PRESETS.length);
    const ids = new Set(ARAUNA_ALL_PRESETS.map((entry) => entry.id));
    for (const [label, entries] of families) {
      for (const entry of entries) expect(ids.has(entry.id), `${label}: ${entry.id}`).toBe(true);
    }
  });
});
