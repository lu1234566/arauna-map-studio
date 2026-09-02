import {
  MATA_DA_ESPERA_PRESET_ID, MATA_DA_ESPERA_PROMPT,
  PASSO_CORTADO_PRESET_ID, PASSO_CORTADO_PROMPT,
  TRILHA_DE_BRASA_PRESET_ID, TRILHA_DE_BRASA_PROMPT,
  mataDaEsperaGuardFromAtlas, passoCortadoGuardFromAtlas, trilhaDeBrasaGuardFromAtlas,
} from "./passagensNaturaisPresets";
import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";

export const PASSAGENS_NATURAIS_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = [
  { id: MATA_DA_ESPERA_PRESET_ID, label: "Mata da Espera", prompt: MATA_DA_ESPERA_PROMPT, guardFromAtlas: mataDaEsperaGuardFromAtlas },
  { id: TRILHA_DE_BRASA_PRESET_ID, label: "Trilha de Brasa", prompt: TRILHA_DE_BRASA_PROMPT, guardFromAtlas: trilhaDeBrasaGuardFromAtlas },
  { id: PASSO_CORTADO_PRESET_ID, label: "Passo Cortado", prompt: PASSO_CORTADO_PROMPT, guardFromAtlas: passoCortadoGuardFromAtlas },
] as const;
