import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Missões do Céu sobre o slot real de Mossdeep.
 * O desenho reorganiza somente pisos/corredores seguros, preservando em bloco
 * o Centro Espacial e seus eventos, além de costa, elevações e conexões reais.
 */
export const MISSOES_DO_CEU_PRESET_ID = "piloto-missoes-do-ceu" as const;

export const MISSOES_DO_CEU_MAP_ID = "MAP_MOSSDEEP_CITY" as const;
export const MISSOES_DO_CEU_WIDTH = 80;
export const MISSOES_DO_CEU_HEIGHT = 40;
export const MISSOES_DO_CEU_PRIMARY = "gTileset_General";
export const MISSOES_DO_CEU_SECONDARY = "gTileset_Mossdeep";

export const MISSOES_DO_CEU_PROMPT = `RECONSTRUA MISSOES DO CEU EM CAMADAS SOBRE O MOSSDEEPCITY REAL 80x40.
Mapa 80x40; nome="Missões do Céu — piloto de observação e sinais"

CAMADA 1 — ZONAS BASE DA CIDADE
- setor noroeste: x=1..24, y=1..12 -> piso base
- setor norte-central: x=25..50, y=1..12 -> piso base
- setor nordeste: x=51..78, y=1..12 -> piso base
- setor oeste médio: x=1..24, y=13..28 -> piso base
- setor central médio: x=25..39, y=13..28 -> piso base
- setor sudoeste: x=1..30, y=29..38 -> piso base
- setor sul-central: x=31..55, y=29..38 -> piso base
- setor sudeste: x=56..78, y=29..38 -> piso base

CAMADA 2 — ZONAS VERDES AGRUPADAS
- jardim de observação oeste: x=20..27, y=5..12 -> piso verde
- jardim cívico central: x=28..36, y=17..24 -> piso verde
- praça de encontro sul: x=17..25, y=26..33 -> piso verde
- respiro costeiro sudeste: x=68..77, y=29..37 -> piso verde

CAMADA 3 — CAMINHOS E VIAS URBANAS
- eixo principal norte-sul: x=31..34, y=0..39 -> piso urbano
- avenida de sinais oeste-leste: x=15..68, y=23..26 -> piso urbano
- acesso ao ginásio: x=34..40, y=7..15 -> piso urbano
- acesso ao centro de atendimento: x=25..31, y=13..19 -> piso urbano
- acesso ao mercado: x=35..40, y=16..23 -> piso urbano
- corredor das moradias oeste: x=16..31, y=8..12 -> piso urbano
- aproximação do Centro Espacial: x=38..64, y=20..25 -> piso urbano
- corredor residencial leste: x=62..78, y=23..29 -> piso urbano
- eixo sul: x=27..34, y=25..39 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- Centro Espacial e cena Horizonte: x=39..68, y=13..29 -> preservar
- corredor de triggers de chegada: x=23..35, y=23..29 -> preservar
- item leste: x=61..63, y=34..36 -> preservar
- conexão norte Route 125: x=0..79, y=0..1 -> preservar
- conexão sul Route 127: x=0..79, y=38..39 -> preservar
- conexão oeste Route 124: x=0..1, y=0..39 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, itens, colisões funcionais, água, costa, escadas, desníveis e moldura existentes.
- preservar integralmente o Centro Espacial e o corredor da cena do Horizonte; nenhuma célula desse bloco pode ser normalizada para piso-base.
- toda célula caminhável em elevação diferente do baseline real deve permanecer protegida pelo Exact Grid elevation safety.
- não inventar metatile IDs, plataformas, antenas, água ou conexões.
- reserved cells, protected cells e a máscara costeira sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida norte -> MAP_ROUTE125 offset 0
saida sul -> MAP_ROUTE127 offset 0
saida oeste -> MAP_ROUTE124 offset -40`;

export interface MissoesDoCeuContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface MissoesDoCeuGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function missoesDoCeuGuard(context: MissoesDoCeuContext): MissoesDoCeuGuardResult {
  if (context.width !== MISSOES_DO_CEU_WIDTH || context.height !== MISSOES_DO_CEU_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${MISSOES_DO_CEU_WIDTH}×${MISSOES_DO_CEU_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== MISSOES_DO_CEU_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Missões do Céu usa o slot real ${MISSOES_DO_CEU_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== MISSOES_DO_CEU_PRIMARY.toLowerCase() || secondary !== MISSOES_DO_CEU_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Missões do Céu exige ${MISSOES_DO_CEU_PRIMARY} + ${MISSOES_DO_CEU_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Missões do Céu” disponível: eixos de observação/comunicação com Centro Espacial, costa, elevações e três conexões reais preservados.",
  };
}

export function missoesDoCeuGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return missoesDoCeuGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
