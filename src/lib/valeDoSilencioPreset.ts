import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Vale do Silêncio sobre o slot real de Verdanturf.
 * O acesso ao Rusturf Tunnel é tratado como corredor narrativo/funcional próprio,
 * enquanto as duas conexões externas e todas as estruturas reais permanecem.
 */
export const VALE_DO_SILENCIO_PRESET_ID = "piloto-vale-do-silencio" as const;

export const VALE_DO_SILENCIO_MAP_ID = "MAP_VERDANTURF_TOWN" as const;
export const VALE_DO_SILENCIO_WIDTH = 20;
export const VALE_DO_SILENCIO_HEIGHT = 20;
export const VALE_DO_SILENCIO_PRIMARY = "gTileset_General";
export const VALE_DO_SILENCIO_SECONDARY = "gTileset_Mauville";

export const VALE_DO_SILENCIO_PROMPT = `RECONSTRUA VALE DO SILENCIO EM CAMADAS SOBRE O VERDANTURFTOWN REAL 20x20.
Mapa 20x20; nome="Vale do Silêncio — piloto de refúgio"

CAMADA 1 — ZONAS BASE DA VILA
- setor noroeste: x=1..8, y=2..9 -> piso base
- setor nordeste: x=9..18, y=2..9 -> piso base
- setor sudoeste: x=1..8, y=10..18 -> piso base
- setor sudeste: x=9..18, y=10..18 -> piso base
- miolo comunitário: x=6..13, y=7..13 -> piso base

CAMADA 2 — ZONAS VERDES E RESPIROS
- jardim oeste: x=1..5, y=10..14 -> piso verde
- faixa calma sul: x=5..10, y=16..18 -> piso verde
- respiro leste: x=15..18, y=7..12 -> piso verde

CAMADA 3 — CAMINHOS E ACESSOS
- caminho do túnel ao centro: x=7..9, y=1..11 -> piso urbano
- eixo central norte-sul: x=8..10, y=7..18 -> piso urbano
- saída leste Route 117: x=8..19, y=9..11 -> piso urbano
- rua das casas sul: x=1..18, y=13..15 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- boca do Rusturf Tunnel: x=6..10, y=0..3 -> preservar
- conexão norte Route 116: x=0..19, y=0..1 -> preservar
- conexão leste Route 117: x=18..19, y=0..19 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, colisões funcionais e moldura existentes.
- preservar integralmente a boca do Rusturf Tunnel e o seu acesso imediato.
- não inventar metatile IDs, edifícios, triggers ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida norte -> MAP_ROUTE116 offset -80
saida leste -> MAP_ROUTE117 offset 0`;

export interface ValeDoSilencioContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface ValeDoSilencioGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function valeDoSilencioGuard(context: ValeDoSilencioContext): ValeDoSilencioGuardResult {
  if (context.width !== VALE_DO_SILENCIO_WIDTH || context.height !== VALE_DO_SILENCIO_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${VALE_DO_SILENCIO_WIDTH}×${VALE_DO_SILENCIO_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== VALE_DO_SILENCIO_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Vale do Silêncio usa o slot real ${VALE_DO_SILENCIO_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== VALE_DO_SILENCIO_PRIMARY.toLowerCase() || secondary !== VALE_DO_SILENCIO_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Vale do Silêncio exige ${VALE_DO_SILENCIO_PRIMARY} + ${VALE_DO_SILENCIO_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Vale do Silêncio” disponível: refúgio comunitário com boca do Rusturf Tunnel e conexões reais preservadas.",
  };
}

export function valeDoSilencioGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return valeDoSilencioGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
