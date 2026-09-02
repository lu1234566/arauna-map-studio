import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Piloto determinístico “Vila Amanhecer”. Usa apenas o pipeline local
 * (reconstruction + layered Exact Grid). Nenhuma chamada online, nenhum
 * metatile inventado: as camadas pedem papéis de piso reais derivados do mapa.
 */
export const VILA_AMANHECER_PRESET_ID = "piloto-vila-amanhecer" as const;

export const VILA_AMANHECER_MAP_ID = "MAP_LITTLEROOT_TOWN" as const;
export const VILA_AMANHECER_WIDTH = 20;
export const VILA_AMANHECER_HEIGHT = 20;
export const VILA_AMANHECER_PRIMARY = "gTileset_General";
export const VILA_AMANHECER_SECONDARY = "gTileset_Petalburg";

export const VILA_AMANHECER_PROMPT = `RECONSTRUA VILA AMANHECER EM CAMADAS SOBRE O LITTLEROOTTOWN REAL 20x20.
Mapa 20x20; nome="Vila Amanhecer — piloto rural"

CAMADA 1 — ZONAS BASE VERDE
- setor noroeste: x=2..9, y=2..8 -> piso base
- setor nordeste: x=12..17, y=2..8 -> piso base
- setor oeste central: x=1..6, y=9..18 -> piso base
- setor leste central: x=15..18, y=9..18 -> piso base
- setor sul livre: x=10..18, y=14..18 -> piso base

CAMADA 2 — CAMINHOS E PRAÇA
- eixo norte: x=10..11, y=0..8 -> piso urbano
- rua das casas: x=5..14, y=9..10 -> piso urbano
- praça central: x=7..13, y=10..12 -> piso urbano
- acesso sul: x=10..11, y=12..17 -> piso urbano
- acesso laboratório: x=7..11, y=17..17 -> piso urbano
- ramal placa da vila: x=12..15, y=12..13 -> piso urbano

CAMADA 3 — PRESERVAÇÃO
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, colisões funcionais e moldura florestal existentes.
- não inventar prédios, rotas, água, falésias ou metatiles.
- detalhes só podem usar Patterns reais compatíveis e nunca podem cobrir reserved cells.

saida norte -> MAP_ROUTE101 offset 0`;

export interface VilaAmanhecerContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface VilaAmanhecerGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * O preset só pode ser preparado no contexto real de Littleroot / Vila Amanhecer.
 * Quando existe map.json, o id precisa ser MAP_LITTLEROOT_TOWN; quando existe
 * atlas, ele precisa ser General + Petalburg.
 */
export function vilaAmanhecerGuard(context: VilaAmanhecerContext): VilaAmanhecerGuardResult {
  if (context.width !== VILA_AMANHECER_WIDTH || context.height !== VILA_AMANHECER_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige um mapa ${VILA_AMANHECER_WIDTH}×${VILA_AMANHECER_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== VILA_AMANHECER_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; o piloto só se aplica a ${VILA_AMANHECER_MAP_ID}.`,
    };
  }
  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== VILA_AMANHECER_PRIMARY.toLowerCase() || secondary !== VILA_AMANHECER_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; o piloto exige ${VILA_AMANHECER_PRIMARY} + ${VILA_AMANHECER_SECONDARY}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: "Preset “Piloto Vila Amanhecer” disponível: base verde + caminhos reais, sem mover warps, triggers, NPCs ou conexões.",
  };
}

export function vilaAmanhecerGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return vilaAmanhecerGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
