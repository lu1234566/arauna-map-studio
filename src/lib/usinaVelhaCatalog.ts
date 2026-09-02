import {
  USINA_VELHA_ENTRANCE_PRESET_ID,
  USINA_VELHA_ENTRANCE_PROMPT,
  USINA_VELHA_INSIDE_PRESET_ID,
  USINA_VELHA_INSIDE_PROMPT,
  usinaVelhaEntranceGuardFromAtlas,
  usinaVelhaInsideGuardFromAtlas,
} from "./usinaVelhaPresets";
import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";

export const USINA_VELHA_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = [
  { id: USINA_VELHA_ENTRANCE_PRESET_ID, label: "Usina Velha · Entrada", prompt: USINA_VELHA_ENTRANCE_PROMPT, guardFromAtlas: usinaVelhaEntranceGuardFromAtlas },
  { id: USINA_VELHA_INSIDE_PRESET_ID, label: "Usina Velha · Interior", prompt: USINA_VELHA_INSIDE_PROMPT, guardFromAtlas: usinaVelhaInsideGuardFromAtlas },
] as const;
