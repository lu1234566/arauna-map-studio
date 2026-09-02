import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Galerias Serra sobre o Rusturf Tunnel real.
 * O mapa não possui connections; as três saídas são warps e continuam sob
 * autoridade do map.json. Paredes/rochas recebem a segurança opt-in do Exact Grid.
 */
export const GALERIAS_SERRA_PRESET_ID = "piloto-galerias-serra" as const;

export const GALERIAS_SERRA_MAP_ID = "MAP_RUSTURF_TUNNEL" as const;
export const GALERIAS_SERRA_WIDTH = 36;
export const GALERIAS_SERRA_HEIGHT = 24;
export const GALERIAS_SERRA_PRIMARY = "gTileset_General";
export const GALERIAS_SERRA_SECONDARY = "gTileset_RusturfTunnel";

export const GALERIAS_SERRA_PROMPT = `RECONSTRUA GALERIAS SERRA EM CAMADAS SOBRE O RUSTURFTUNNEL REAL 36x24.
Mapa 36x24; nome="Galerias Serra — piloto subterrâneo"

CAMADA 1 — PISOS CAMINHÁVEIS DA GALERIA
- ala oeste: x=1..12, y=1..20 -> piso base
- eixo central: x=8..27, y=3..10 -> piso base
- ala leste: x=20..34, y=1..18 -> piso base
- acesso sul: x=14..31, y=13..22 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- corredor do resgate: x=4..17, y=3..6 -> piso base
- corredor do bloqueio: x=21..27, y=3..7 -> piso base
- acesso oeste Route 116: x=2..7, y=8..12 -> piso base
- acesso ao Vale do Silêncio: x=27..32, y=14..18 -> piso base
- acesso sul Route 116: x=16..20, y=18..22 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO NARRATIVA
- cena Peeko e capanga: x=8..16, y=3..6 -> preservar
- bloqueio Wanda e Rock Smash: x=22..26, y=3..6 -> preservar
- boca oeste Route 116: x=2..6, y=8..12 -> preservar
- boca Vale do Silêncio: x=27..31, y=14..18 -> preservar
- boca sul Route 116: x=16..20, y=18..22 -> preservar
- item do canto noroeste: x=1..5, y=0..3 -> preservar
- item do canto nordeste: x=28..32, y=0..4 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar todos os warps, triggers, NPCs, itens, Rock Smash, cenas narrativas, colisões funcionais, elevações e moldura existentes.
- não inventar metatile IDs, escadas, buracos, paredes, passagens, saídas ou conexões.
- reserved cells, protected cells e geometria originalmente bloqueada sempre vencem qualquer camada de piso.
- este mapa não possui connections de borda; não criar saída artificial.
- a remodelagem atua somente no chão já caminhável comprovado pelo map.bin e pelo atlas real.`;

export interface GaleriasSerraContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface GaleriasSerraGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function galeriasSerraGuard(context: GaleriasSerraContext): GaleriasSerraGuardResult {
  if (context.width !== GALERIAS_SERRA_WIDTH || context.height !== GALERIAS_SERRA_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${GALERIAS_SERRA_WIDTH}×${GALERIAS_SERRA_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== GALERIAS_SERRA_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Galerias Serra usa o slot real ${GALERIAS_SERRA_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== GALERIAS_SERRA_PRIMARY.toLowerCase() || secondary !== GALERIAS_SERRA_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Galerias Serra exige ${GALERIAS_SERRA_PRIMARY} + ${GALERIAS_SERRA_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Galerias Serra” disponível: chão caminhável reorganizado sem escavar paredes, com Peeko, Wanda, Rock Smash, três warps e eventos preservados.",
  };
}

export function galeriasSerraGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return galeriasSerraGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
