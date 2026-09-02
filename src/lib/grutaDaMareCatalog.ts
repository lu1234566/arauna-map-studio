import {
  GRUTA_DA_MARE_HIGH_ENTRANCE_PRESET_ID,
  GRUTA_DA_MARE_HIGH_ENTRANCE_PROMPT,
  GRUTA_DA_MARE_HIGH_INNER_PRESET_ID,
  GRUTA_DA_MARE_HIGH_INNER_PROMPT,
  GRUTA_DA_MARE_ICE_PRESET_ID,
  GRUTA_DA_MARE_ICE_PROMPT,
  GRUTA_DA_MARE_LOW_ENTRANCE_PRESET_ID,
  GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT,
  GRUTA_DA_MARE_LOW_INNER_PRESET_ID,
  GRUTA_DA_MARE_LOW_INNER_PROMPT,
  GRUTA_DA_MARE_LOWER_PRESET_ID,
  GRUTA_DA_MARE_LOWER_PROMPT,
  GRUTA_DA_MARE_STAIRS_PRESET_ID,
  GRUTA_DA_MARE_STAIRS_PROMPT,
  grutaDaMareHighEntranceGuardFromAtlas,
  grutaDaMareHighInnerGuardFromAtlas,
  grutaDaMareIceGuardFromAtlas,
  grutaDaMareLowEntranceGuardFromAtlas,
  grutaDaMareLowInnerGuardFromAtlas,
  grutaDaMareLowerGuardFromAtlas,
  grutaDaMareStairsGuardFromAtlas,
} from "./grutaDaMarePresets";
import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";

export const GRUTA_DA_MARE_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = [
  { id: GRUTA_DA_MARE_LOW_ENTRANCE_PRESET_ID, label: "Gruta da Maré · Entrada · baixa", prompt: GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT, guardFromAtlas: grutaDaMareLowEntranceGuardFromAtlas },
  { id: GRUTA_DA_MARE_HIGH_ENTRANCE_PRESET_ID, label: "Gruta da Maré · Entrada · alta", prompt: GRUTA_DA_MARE_HIGH_ENTRANCE_PROMPT, guardFromAtlas: grutaDaMareHighEntranceGuardFromAtlas },
  { id: GRUTA_DA_MARE_LOW_INNER_PRESET_ID, label: "Gruta da Maré · Interior · baixa", prompt: GRUTA_DA_MARE_LOW_INNER_PROMPT, guardFromAtlas: grutaDaMareLowInnerGuardFromAtlas },
  { id: GRUTA_DA_MARE_HIGH_INNER_PRESET_ID, label: "Gruta da Maré · Interior · alta", prompt: GRUTA_DA_MARE_HIGH_INNER_PROMPT, guardFromAtlas: grutaDaMareHighInnerGuardFromAtlas },
  { id: GRUTA_DA_MARE_LOWER_PRESET_ID, label: "Gruta da Maré · Sala Inferior", prompt: GRUTA_DA_MARE_LOWER_PROMPT, guardFromAtlas: grutaDaMareLowerGuardFromAtlas },
  { id: GRUTA_DA_MARE_STAIRS_PRESET_ID, label: "Gruta da Maré · Escadarias", prompt: GRUTA_DA_MARE_STAIRS_PROMPT, guardFromAtlas: grutaDaMareStairsGuardFromAtlas },
  { id: GRUTA_DA_MARE_ICE_PRESET_ID, label: "Gruta da Maré · Câmara de Gelo", prompt: GRUTA_DA_MARE_ICE_PROMPT, guardFromAtlas: grutaDaMareIceGuardFromAtlas },
] as const;
