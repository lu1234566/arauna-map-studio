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
  GALERIAS_SERRA_PRESET_ID,
  GALERIAS_SERRA_PROMPT,
  galeriasSerraGuardFromAtlas,
} from "./galeriasSerraPreset";
import {
  GRUTA_DAS_VOZES_1F_PRESET_ID,
  GRUTA_DAS_VOZES_1F_PROMPT,
  GRUTA_DAS_VOZES_B1F_PRESET_ID,
  GRUTA_DAS_VOZES_B1F_PROMPT,
  GRUTA_DAS_VOZES_B2F_PRESET_ID,
  GRUTA_DAS_VOZES_B2F_PROMPT,
  GRUTA_DAS_VOZES_BENTO_PRESET_ID,
  GRUTA_DAS_VOZES_BENTO_PROMPT,
  grutaDasVozes1FGuardFromAtlas,
  grutaDasVozesB1FGuardFromAtlas,
  grutaDasVozesB2FGuardFromAtlas,
  grutaDasVozesBentoGuardFromAtlas,
} from "./grutaDasVozesPresets";
import {
  MATA_DO_MEIO_PRESET_ID,
  MATA_DO_MEIO_PROMPT,
  mataDoMeioGuardFromAtlas,
} from "./mataDoMeioPreset";
import {
  MEMORIAL_DOS_NOMES_1F_PRESET_ID,
  MEMORIAL_DOS_NOMES_1F_PROMPT,
  MEMORIAL_DOS_NOMES_2F_PRESET_ID,
  MEMORIAL_DOS_NOMES_2F_PROMPT,
  MEMORIAL_DOS_NOMES_3F_PRESET_ID,
  MEMORIAL_DOS_NOMES_3F_PROMPT,
  MEMORIAL_DOS_NOMES_4F_PRESET_ID,
  MEMORIAL_DOS_NOMES_4F_PROMPT,
  MEMORIAL_DOS_NOMES_5F_PRESET_ID,
  MEMORIAL_DOS_NOMES_5F_PROMPT,
  MEMORIAL_DOS_NOMES_6F_PRESET_ID,
  MEMORIAL_DOS_NOMES_6F_PROMPT,
  MEMORIAL_DOS_NOMES_EXTERIOR_PRESET_ID,
  MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT,
  MEMORIAL_DOS_NOMES_SUMMIT_PRESET_ID,
  MEMORIAL_DOS_NOMES_SUMMIT_PROMPT,
  memorialDosNomes1FGuardFromAtlas,
  memorialDosNomes2FGuardFromAtlas,
  memorialDosNomes3FGuardFromAtlas,
  memorialDosNomes4FGuardFromAtlas,
  memorialDosNomes5FGuardFromAtlas,
  memorialDosNomes6FGuardFromAtlas,
  memorialDosNomesExteriorGuardFromAtlas,
  memorialDosNomesSummitGuardFromAtlas,
} from "./memorialDosNomesPresets";
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
  RUINAS_DA_QUEDA_1F_1R_PRESET_ID,
  RUINAS_DA_QUEDA_1F_1R_PROMPT,
  RUINAS_DA_QUEDA_1F_2R_PRESET_ID,
  RUINAS_DA_QUEDA_1F_2R_PROMPT,
  RUINAS_DA_QUEDA_B1F_1R_PRESET_ID,
  RUINAS_DA_QUEDA_B1F_1R_PROMPT,
  RUINAS_DA_QUEDA_B1F_2R_PRESET_ID,
  RUINAS_DA_QUEDA_B1F_2R_PROMPT,
  RUINAS_DA_QUEDA_BENTO_PRESET_ID,
  RUINAS_DA_QUEDA_BENTO_PROMPT,
  ruinasDaQueda1F1RGuardFromAtlas,
  ruinasDaQueda1F2RGuardFromAtlas,
  ruinasDaQuedaB1F1RGuardFromAtlas,
  ruinasDaQuedaB1F2RGuardFromAtlas,
  ruinasDaQuedaBentoGuardFromAtlas,
} from "./ruinasDaQuedaPresets";
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
  {
    id: GALERIAS_SERRA_PRESET_ID,
    label: "Galerias Serra",
    prompt: GALERIAS_SERRA_PROMPT,
    guardFromAtlas: galeriasSerraGuardFromAtlas,
  },
  {
    id: GRUTA_DAS_VOZES_1F_PRESET_ID,
    label: "Gruta das Vozes · 1F",
    prompt: GRUTA_DAS_VOZES_1F_PROMPT,
    guardFromAtlas: grutaDasVozes1FGuardFromAtlas,
  },
  {
    id: GRUTA_DAS_VOZES_B1F_PRESET_ID,
    label: "Gruta das Vozes · B1F",
    prompt: GRUTA_DAS_VOZES_B1F_PROMPT,
    guardFromAtlas: grutaDasVozesB1FGuardFromAtlas,
  },
  {
    id: GRUTA_DAS_VOZES_B2F_PRESET_ID,
    label: "Gruta das Vozes · B2F",
    prompt: GRUTA_DAS_VOZES_B2F_PROMPT,
    guardFromAtlas: grutaDasVozesB2FGuardFromAtlas,
  },
  {
    id: GRUTA_DAS_VOZES_BENTO_PRESET_ID,
    label: "Gruta das Vozes · Seu Bento",
    prompt: GRUTA_DAS_VOZES_BENTO_PROMPT,
    guardFromAtlas: grutaDasVozesBentoGuardFromAtlas,
  },
  {
    id: RUINAS_DA_QUEDA_1F_1R_PRESET_ID,
    label: "Ruínas da Queda · 1F · 1R",
    prompt: RUINAS_DA_QUEDA_1F_1R_PROMPT,
    guardFromAtlas: ruinasDaQueda1F1RGuardFromAtlas,
  },
  {
    id: RUINAS_DA_QUEDA_1F_2R_PRESET_ID,
    label: "Ruínas da Queda · 1F · 2R",
    prompt: RUINAS_DA_QUEDA_1F_2R_PROMPT,
    guardFromAtlas: ruinasDaQueda1F2RGuardFromAtlas,
  },
  {
    id: RUINAS_DA_QUEDA_B1F_1R_PRESET_ID,
    label: "Ruínas da Queda · B1F · 1R",
    prompt: RUINAS_DA_QUEDA_B1F_1R_PROMPT,
    guardFromAtlas: ruinasDaQuedaB1F1RGuardFromAtlas,
  },
  {
    id: RUINAS_DA_QUEDA_B1F_2R_PRESET_ID,
    label: "Ruínas da Queda · B1F · 2R",
    prompt: RUINAS_DA_QUEDA_B1F_2R_PROMPT,
    guardFromAtlas: ruinasDaQuedaB1F2RGuardFromAtlas,
  },
  {
    id: RUINAS_DA_QUEDA_BENTO_PRESET_ID,
    label: "Ruínas da Queda · Seu Bento",
    prompt: RUINAS_DA_QUEDA_BENTO_PROMPT,
    guardFromAtlas: ruinasDaQuedaBentoGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_1F_PRESET_ID,
    label: "Memorial dos Nomes · 1F",
    prompt: MEMORIAL_DOS_NOMES_1F_PROMPT,
    guardFromAtlas: memorialDosNomes1FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_2F_PRESET_ID,
    label: "Memorial dos Nomes · 2F",
    prompt: MEMORIAL_DOS_NOMES_2F_PROMPT,
    guardFromAtlas: memorialDosNomes2FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_3F_PRESET_ID,
    label: "Memorial dos Nomes · 3F",
    prompt: MEMORIAL_DOS_NOMES_3F_PROMPT,
    guardFromAtlas: memorialDosNomes3FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_4F_PRESET_ID,
    label: "Memorial dos Nomes · 4F",
    prompt: MEMORIAL_DOS_NOMES_4F_PROMPT,
    guardFromAtlas: memorialDosNomes4FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_5F_PRESET_ID,
    label: "Memorial dos Nomes · 5F",
    prompt: MEMORIAL_DOS_NOMES_5F_PROMPT,
    guardFromAtlas: memorialDosNomes5FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_6F_PRESET_ID,
    label: "Memorial dos Nomes · 6F",
    prompt: MEMORIAL_DOS_NOMES_6F_PROMPT,
    guardFromAtlas: memorialDosNomes6FGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_EXTERIOR_PRESET_ID,
    label: "Memorial dos Nomes · Exterior",
    prompt: MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT,
    guardFromAtlas: memorialDosNomesExteriorGuardFromAtlas,
  },
  {
    id: MEMORIAL_DOS_NOMES_SUMMIT_PRESET_ID,
    label: "Memorial dos Nomes · Summit",
    prompt: MEMORIAL_DOS_NOMES_SUMMIT_PROMPT,
    guardFromAtlas: memorialDosNomesSummitGuardFromAtlas,
  },
] as const;
