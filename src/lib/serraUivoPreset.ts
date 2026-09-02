import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Segundo preset determinístico de Arauna. Mantém o slot real de Rustboro e
 * redesenha apenas a malha de solo/caminhos por Exact Grid, deixando estruturas,
 * eventos, física funcional e conexões sob as proteções normais do Studio.
 */
export const SERRA_UIVO_PRESET_ID = "piloto-serra-do-uivo" as const;

export const SERRA_UIVO_MAP_ID = "MAP_RUSTBORO_CITY" as const;
export const SERRA_UIVO_WIDTH = 40;
export const SERRA_UIVO_HEIGHT = 60;
export const SERRA_UIVO_PRIMARY = "gTileset_General";
export const SERRA_UIVO_SECONDARY = "gTileset_Rustboro";

export const SERRA_UIVO_PROMPT = `RECONSTRUA SERRA DO UIVO EM CAMADAS SOBRE O RUSTBOROCITY REAL 40x60.
Mapa 40x60; nome="Serra do Uivo — piloto serrano"

CAMADA 1 — BASE VERDE SERRANA
- faixa noroeste: x=1..18, y=1..13 -> piso verde
- faixa nordeste: x=24..38, y=1..17 -> piso verde
- encosta oeste alta: x=1..9, y=14..35 -> piso verde
- encosta leste alta: x=34..38, y=18..26 -> piso verde
- miolo oeste: x=1..8, y=31..50 -> piso verde
- miolo leste: x=31..38, y=31..50 -> piso verde
- faixa sudoeste: x=1..18, y=48..58 -> piso verde
- faixa sudeste: x=24..38, y=48..58 -> piso verde

CAMADA 2 — EIXO E RAMAIS URBANOS
- eixo serrano norte-sul: x=20..22, y=0..59 -> piso urbano
- acesso Horizonte: x=11..22, y=14..16 -> piso urbano
- ramal ginásio e moradias norte: x=22..34, y=18..20 -> piso urbano
- avenida central: x=9..39, y=28..30 -> piso urbano
- ramal escola: x=20..28, y=33..35 -> piso urbano
- rua oeste de serviços: x=9..22, y=37..39 -> piso urbano
- rua comercial sul: x=5..28, y=44..47 -> piso urbano
- acesso moradias leste: x=22..31, y=27..29 -> piso urbano
- saída leste Route 116: x=22..39, y=27..30 -> piso urbano

CAMADA 3 — RESPIROS VERDES AGRUPADOS
- jardim cívico oeste: x=14..18, y=31..35 -> piso verde
- jardim cívico leste: x=29..33, y=36..41 -> piso verde
- praça serrana sul: x=18..24, y=49..53 -> piso verde

CAMADA 4 — PRESERVAÇÃO
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, colisões funcionais, água, desníveis e moldura existentes.
- não mover nem recriar prédios; não inventar metatile IDs, água, falésias, escadas ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter os acessos funcionais das portas existentes e a física original dessas células.

saida norte -> MAP_ROUTE115 offset 0
saida sul -> MAP_ROUTE104 offset 0
saida leste -> MAP_ROUTE116 offset 0`;

export interface SerraUivoContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface SerraUivoGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function serraUivoGuard(context: SerraUivoContext): SerraUivoGuardResult {
  if (context.width !== SERRA_UIVO_WIDTH || context.height !== SERRA_UIVO_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${SERRA_UIVO_WIDTH}×${SERRA_UIVO_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== SERRA_UIVO_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Serra do Uivo usa o slot real ${SERRA_UIVO_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== SERRA_UIVO_PRIMARY.toLowerCase() || secondary !== SERRA_UIVO_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Serra do Uivo exige ${SERRA_UIVO_PRIMARY} + ${SERRA_UIVO_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Serra do Uivo” disponível: base serrana verde + eixo urbano conectado, preservando estruturas, warps, triggers, NPCs e conexões reais.",
  };
}

export function serraUivoGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return serraUivoGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
