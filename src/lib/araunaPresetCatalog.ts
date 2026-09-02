import {
  BAIA_DAS_LUZES_PRESET_ID,
  BAIA_DAS_LUZES_PROMPT,
  baiaDasLuzesGuardFromAtlas,
} from "./baiaDasLuzesPreset";
import {
  CAMPO_DAS_CINZAS_PRESET_ID,
  CAMPO_DAS_CINZAS_PROMPT,
  campoDasCinzasGuardFromAtlas,
} from "./campoDasCinzasPreset";
import {
  CASA_DA_FOGUEIRA_PRESET_ID,
  CASA_DA_FOGUEIRA_PROMPT,
  casaDaFogueiraGuardFromAtlas,
} from "./casaDaFogueiraPreset";
import {
  ENCRUZILHADA_CENTRAL_PRESET_ID,
  ENCRUZILHADA_CENTRAL_PROMPT,
  encruzilhadaCentralGuardFromAtlas,
} from "./encruzilhadaCentralPreset";
import {
  MATA_DO_MEIO_PRESET_ID,
  MATA_DO_MEIO_PROMPT,
  mataDoMeioGuardFromAtlas,
} from "./mataDoMeioPreset";
import {
  MISSOES_DO_CEU_PRESET_ID,
  MISSOES_DO_CEU_PROMPT,
  missoesDoCeuGuardFromAtlas,
} from "./missoesDoCeuPreset";
import {
  PAMPA_DA_ESPERA_PRESET_ID,
  PAMPA_DA_ESPERA_PROMPT,
  pampaDaEsperaGuardFromAtlas,
} from "./pampaDaEsperaPreset";
import {
  PORTO_DAS_REDES_PRESET_ID,
  PORTO_DAS_REDES_PROMPT,
  portoDasRedesGuardFromAtlas,
} from "./portoDasRedesPreset";
import type { SavedRealAtlas } from "./realAtlasStore";
import {
  VALE_DO_SILENCIO_PRESET_ID,
  VALE_DO_SILENCIO_PROMPT,
  valeDoSilencioGuardFromAtlas,
} from "./valeDoSilencioPreset";
import {
  VILA_DA_PASSAGEM_PRESET_ID,
  VILA_DA_PASSAGEM_PROMPT,
  vilaDaPassagemGuardFromAtlas,
} from "./vilaDaPassagemPreset";

export interface AraunaPresetGuardResult {
  enabled: boolean;
  reason: string;
}

export interface AraunaPresetCatalogEntry {
  id: string;
  label: string;
  prompt: string;
  guardFromAtlas: (
    width: number,
    height: number,
    mapId: string | null | undefined,
    atlas: SavedRealAtlas | null,
  ) => AraunaPresetGuardResult;
}

/**
 * Presets adicionados depois dos cinco pilotos originais já expostos no
 * AiCityBuilderDock. Mantê-los num catálogo evita inflar o componente legado e
 * permite que a UI compacta execute todos pelo mesmo pipeline Exact Grid.
 */
export const ARAUNA_ADDITIONAL_PRESETS: readonly AraunaPresetCatalogEntry[] = [
  {
    id: PORTO_DAS_REDES_PRESET_ID,
    label: "Porto das Redes",
    prompt: PORTO_DAS_REDES_PROMPT,
    guardFromAtlas: portoDasRedesGuardFromAtlas,
  },
  {
    id: ENCRUZILHADA_CENTRAL_PRESET_ID,
    label: "Encruzilhada Central",
    prompt: ENCRUZILHADA_CENTRAL_PROMPT,
    guardFromAtlas: encruzilhadaCentralGuardFromAtlas,
  },
  {
    id: PAMPA_DA_ESPERA_PRESET_ID,
    label: "Pampa da Espera",
    prompt: PAMPA_DA_ESPERA_PROMPT,
    guardFromAtlas: pampaDaEsperaGuardFromAtlas,
  },
  {
    id: MATA_DO_MEIO_PRESET_ID,
    label: "Mata do Meio",
    prompt: MATA_DO_MEIO_PROMPT,
    guardFromAtlas: mataDoMeioGuardFromAtlas,
  },
  {
    id: MISSOES_DO_CEU_PRESET_ID,
    label: "Missões do Céu",
    prompt: MISSOES_DO_CEU_PROMPT,
    guardFromAtlas: missoesDoCeuGuardFromAtlas,
  },
  {
    id: VILA_DA_PASSAGEM_PRESET_ID,
    label: "Vila da Passagem",
    prompt: VILA_DA_PASSAGEM_PROMPT,
    guardFromAtlas: vilaDaPassagemGuardFromAtlas,
  },
  {
    id: CAMPO_DAS_CINZAS_PRESET_ID,
    label: "Campo das Cinzas",
    prompt: CAMPO_DAS_CINZAS_PROMPT,
    guardFromAtlas: campoDasCinzasGuardFromAtlas,
  },
  {
    id: VALE_DO_SILENCIO_PRESET_ID,
    label: "Vale do Silêncio",
    prompt: VALE_DO_SILENCIO_PROMPT,
    guardFromAtlas: valeDoSilencioGuardFromAtlas,
  },
  {
    id: CASA_DA_FOGUEIRA_PRESET_ID,
    label: "Casa da Fogueira",
    prompt: CASA_DA_FOGUEIRA_PROMPT,
    guardFromAtlas: casaDaFogueiraGuardFromAtlas,
  },
  {
    id: BAIA_DAS_LUZES_PRESET_ID,
    label: "Baía das Luzes",
    prompt: BAIA_DAS_LUZES_PROMPT,
    guardFromAtlas: baiaDasLuzesGuardFromAtlas,
  },
] as const;
