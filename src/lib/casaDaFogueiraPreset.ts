import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Casa da Fogueira sobre o slot real de Pacifidlog.
 * Água/costa e travessias elevadas são protegidas pelo Exact Grid; o preset
 * reorganiza somente as superfícies terrestres/plataformas comprovadas pelo atlas.
 */
export const CASA_DA_FOGUEIRA_PRESET_ID = "piloto-casa-da-fogueira" as const;

export const CASA_DA_FOGUEIRA_MAP_ID = "MAP_PACIFIDLOG_TOWN" as const;
export const CASA_DA_FOGUEIRA_WIDTH = 20;
export const CASA_DA_FOGUEIRA_HEIGHT = 40;
export const CASA_DA_FOGUEIRA_PRIMARY = "gTileset_General";
export const CASA_DA_FOGUEIRA_SECONDARY = "gTileset_Pacifidlog";

export const CASA_DA_FOGUEIRA_PROMPT = `RECONSTRUA CASA DA FOGUEIRA EM CAMADAS SOBRE O PACIFIDLOGTOWN REAL 20x40.
Mapa 20x40; nome="Casa da Fogueira — piloto de comunidade sobre as águas"

CAMADA 1 — PLATAFORMAS BASE
- núcleo norte: x=1..18, y=9..17 -> piso base
- núcleo central: x=1..18, y=14..24 -> piso base
- núcleo sul: x=1..18, y=20..29 -> piso base
- espaço de encontro central: x=6..13, y=14..20 -> piso base
- faixa das moradias sul: x=2..17, y=21..26 -> piso base

CAMADA 2 — CAMINHOS SOBRE AS PLATAFORMAS
- travessia principal oeste-leste: x=0..19, y=15..17 -> piso base
- ligação norte-sul: x=8..11, y=11..25 -> piso base
- circulação sul: x=2..17, y=21..24 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- conexão oeste Route 132: x=0..1, y=0..39 -> preservar
- conexão leste Route 131: x=18..19, y=0..39 -> preservar
- faixa aquática norte: x=0..19, y=0..10 -> água/costa
- faixa aquática sul: x=0..19, y=28..39 -> água/costa

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, água, costa, passarelas elevadas, colisões funcionais e moldura existentes.
- não inventar metatile IDs, edifícios, pontes, fogueiras, triggers ou conexões.
- o nome Casa da Fogueira descreve a função comunitária; não criar uma fogueira visual sem Pattern real compatível.
- reserved cells, protected cells, água/costa e faixas de elevação não dominante sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida oeste -> MAP_ROUTE132 offset 0
saida leste -> MAP_ROUTE131 offset 0`;

export interface CasaDaFogueiraContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface CasaDaFogueiraGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function casaDaFogueiraGuard(context: CasaDaFogueiraContext): CasaDaFogueiraGuardResult {
  if (context.width !== CASA_DA_FOGUEIRA_WIDTH || context.height !== CASA_DA_FOGUEIRA_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${CASA_DA_FOGUEIRA_WIDTH}×${CASA_DA_FOGUEIRA_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== CASA_DA_FOGUEIRA_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Casa da Fogueira usa o slot real ${CASA_DA_FOGUEIRA_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== CASA_DA_FOGUEIRA_PRIMARY.toLowerCase() || secondary !== CASA_DA_FOGUEIRA_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Casa da Fogueira exige ${CASA_DA_FOGUEIRA_PRIMARY} + ${CASA_DA_FOGUEIRA_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Casa da Fogueira” disponível: comunidade sobre as águas com costa, passarelas, estruturas e conexões reais preservadas.",
  };
}

export function casaDaFogueiraGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return casaDaFogueiraGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
