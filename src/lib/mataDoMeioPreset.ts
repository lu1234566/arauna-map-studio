import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Mata do Meio sobre o slot real de Fortree.
 * A cidade mantém a lógica vertical herdada: passarelas e outras células de
 * elevação não-dominante são protegidas pelo Exact Grid elevation safety antes
 * da normalização física.
 */
export const MATA_DO_MEIO_PRESET_ID = "piloto-mata-do-meio" as const;

export const MATA_DO_MEIO_MAP_ID = "MAP_FORTREE_CITY" as const;
export const MATA_DO_MEIO_WIDTH = 40;
export const MATA_DO_MEIO_HEIGHT = 20;
export const MATA_DO_MEIO_PRIMARY = "gTileset_General";
export const MATA_DO_MEIO_SECONDARY = "gTileset_Fortree";

export const MATA_DO_MEIO_PROMPT = `RECONSTRUA MATA DO MEIO EM CAMADAS SOBRE O FORTREECITY REAL 40x20.
Mapa 40x20; nome="Mata do Meio — piloto da mata suspensa"

CAMADA 1 — ZONAS BASE DA MATA
- mata noroeste: x=1..12, y=1..8 -> piso verde
- mata norte-central: x=13..27, y=1..8 -> piso verde
- mata nordeste: x=28..38, y=1..8 -> piso verde
- mata sudoeste: x=1..12, y=9..18 -> piso verde
- clareira central baixa: x=13..28, y=9..18 -> piso base
- mata sudeste: x=29..38, y=9..18 -> piso verde

CAMADA 2 — ZONAS VERDES AGRUPADAS
- jardim do centro: x=3..9, y=7..12 -> piso verde
- bosque central: x=15..20, y=7..12 -> piso verde
- bosque leste: x=30..36, y=7..12 -> piso verde

CAMADA 3 — CAMINHOS E TRILHAS
- trilha oeste-leste: x=0..39, y=8..10 -> piso urbano
- acesso centro e casas oeste: x=4..8, y=4..15 -> piso urbano
- acesso casas centrais: x=10..18, y=3..6 -> piso urbano
- acesso ao ginásio: x=20..25, y=8..14 -> piso urbano
- acesso moradias leste: x=29..38, y=8..15 -> piso urbano
- ligação do comércio sul: x=3..13, y=12..15 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- encontro Kecleon: x=24..26, y=7..9 -> preservar
- conexão oeste Route 119: x=0..1, y=0..19 -> preservar
- conexão leste Route 120: x=38..39, y=0..19 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, casas suspensas, fachadas, portas, warps, NPCs, placas, colisões funcionais, passarelas, escadas, pontes e moldura existentes.
- toda célula caminhável cuja elevação física difere do nível-base dominante deve permanecer exatamente como no map.bin real; o Exact Grid elevation safety tem prioridade sobre as zonas de piso e trilha.
- preservar o encontro Kecleon e seus acessos.
- não inventar metatile IDs, novas passarelas, árvores, pontes ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida oeste -> MAP_ROUTE119 offset 0
saida leste -> MAP_ROUTE120 offset 0`;

export interface MataDoMeioContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface MataDoMeioGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function mataDoMeioGuard(context: MataDoMeioContext): MataDoMeioGuardResult {
  if (context.width !== MATA_DO_MEIO_WIDTH || context.height !== MATA_DO_MEIO_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${MATA_DO_MEIO_WIDTH}×${MATA_DO_MEIO_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== MATA_DO_MEIO_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Mata do Meio usa o slot real ${MATA_DO_MEIO_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== MATA_DO_MEIO_PRIMARY.toLowerCase() || secondary !== MATA_DO_MEIO_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Mata do Meio exige ${MATA_DO_MEIO_PRIMARY} + ${MATA_DO_MEIO_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Mata do Meio” disponível: mata suspensa com trilhas, passarelas/elevacões reais preservadas e conexões Route119/Route120 intactas.",
  };
}

export function mataDoMeioGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return mataDoMeioGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
