import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import {
  GRUTA_DA_ORIGEM_ENTRANCE_PRESET_ID,
  GRUTA_DA_ORIGEM_ENTRANCE_PROMPT,
  GRUTA_DA_ORIGEM_1F_PRESET_ID,
  GRUTA_DA_ORIGEM_1F_PROMPT,
  GRUTA_DA_ORIGEM_B1F_PRESET_ID,
  GRUTA_DA_ORIGEM_B1F_PROMPT,
  grutaDaOrigemEntranceGuardFromAtlas,
  grutaDaOrigem1FGuardFromAtlas,
  grutaDaOrigemB1FGuardFromAtlas,
} from "./grutaDaOrigemPresets";

export const GRUTA_DA_ORIGEM_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = [
  { id: GRUTA_DA_ORIGEM_ENTRANCE_PRESET_ID, label: "Gruta da Origem · Entrada", prompt: GRUTA_DA_ORIGEM_ENTRANCE_PROMPT, guardFromAtlas: grutaDaOrigemEntranceGuardFromAtlas },
  { id: GRUTA_DA_ORIGEM_1F_PRESET_ID, label: "Gruta da Origem · 1F", prompt: GRUTA_DA_ORIGEM_1F_PROMPT, guardFromAtlas: grutaDaOrigem1FGuardFromAtlas },
  { id: GRUTA_DA_ORIGEM_B1F_PRESET_ID, label: "Gruta da Origem · B1F", prompt: GRUTA_DA_ORIGEM_B1F_PROMPT, guardFromAtlas: grutaDaOrigemB1FGuardFromAtlas },
] as const;
