import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Pampa da Espera sobre o slot real de Petalburg.
 * O desenho abre áreas verdes/pampeanas ao redor do núcleo existente e preserva
 * explicitamente o corredor do tutorial de Val, além das conexões oeste/leste.
 */
export const PAMPA_DA_ESPERA_PRESET_ID = "piloto-pampa-da-espera" as const;

export const PAMPA_DA_ESPERA_MAP_ID = "MAP_PETALBURG_CITY" as const;
export const PAMPA_DA_ESPERA_WIDTH = 30;
export const PAMPA_DA_ESPERA_HEIGHT = 30;
export const PAMPA_DA_ESPERA_PRIMARY = "gTileset_General";
export const PAMPA_DA_ESPERA_SECONDARY = "gTileset_Petalburg";

export const PAMPA_DA_ESPERA_PROMPT = `RECONSTRUA PAMPA DA ESPERA EM CAMADAS SOBRE O PETALBURGCITY REAL 30x30.
Mapa 30x30; nome="Pampa da Espera — piloto dos campos abertos"

CAMADA 1 — ZONAS BASE E CAMPOS
- campo noroeste: x=1..13, y=1..8 -> piso verde
- campo nordeste: x=17..28, y=1..8 -> piso verde
- campo oeste: x=1..10, y=14..27 -> piso verde
- campo leste: x=21..28, y=14..27 -> piso verde
- núcleo norte: x=11..20, y=1..8 -> piso base
- núcleo sul: x=10..21, y=15..28 -> piso base

CAMADA 2 — ZONAS VERDES AGRUPADAS
- pradaria norte: x=1..12, y=1..7 -> piso verde
- pradaria sudoeste: x=1..9, y=16..28 -> piso verde
- pradaria sudeste: x=21..28, y=17..28 -> piso verde
- jardim de espera: x=12..18, y=18..24 -> piso verde

CAMADA 3 — CAMINHOS E VIAS
- travessia oeste-leste: x=0..29, y=11..13 -> piso urbano
- acesso ao ginásio: x=14..17, y=7..13 -> piso urbano
- eixo centro-serviços: x=19..22, y=13..18 -> piso urbano
- acesso ao mercado: x=22..27, y=11..14 -> piso urbano
- acesso à moradia sul: x=18..21, y=18..25 -> piso urbano
- acesso à moradia oeste: x=7..11, y=14..20 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- corredor do tutorial de Val: x=3..16, y=9..14 -> preservar
- conexão oeste Route 104: x=0..1, y=0..29 -> preservar
- conexão leste Route 102: x=28..29, y=0..29 -> preservar
- item norte: x=18..20, y=1..3 -> preservar
- item oculto sul: x=10..12, y=28..29 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, itens, colisões funcionais e moldura existentes.
- preservar integralmente o corredor do tutorial de Val e os gatilhos herdados; não deslocar personagens, portas ou células de cena.
- não inventar metatile IDs, cercas, construções ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida oeste -> MAP_ROUTE104 offset -50
saida leste -> MAP_ROUTE102 offset 10`;

export interface PampaDaEsperaContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface PampaDaEsperaGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function pampaDaEsperaGuard(context: PampaDaEsperaContext): PampaDaEsperaGuardResult {
  if (context.width !== PAMPA_DA_ESPERA_WIDTH || context.height !== PAMPA_DA_ESPERA_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${PAMPA_DA_ESPERA_WIDTH}×${PAMPA_DA_ESPERA_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== PAMPA_DA_ESPERA_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Pampa da Espera usa o slot real ${PAMPA_DA_ESPERA_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== PAMPA_DA_ESPERA_PRIMARY.toLowerCase() || secondary !== PAMPA_DA_ESPERA_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Pampa da Espera exige ${PAMPA_DA_ESPERA_PRIMARY} + ${PAMPA_DA_ESPERA_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Pampa da Espera” disponível: campos abertos + travessia central, preservando tutorial de Val, eventos e conexões reais.",
  };
}

export function pampaDaEsperaGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return pampaDaEsperaGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
