import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Campo das Cinzas sobre o slot real de Fallarbor.
 * O eixo Route 114 <-> Route 113 vira a leitura principal da vila; estruturas,
 * eventos e o contexto do item oculto permanecem preservados.
 */
export const CAMPO_DAS_CINZAS_PRESET_ID = "piloto-campo-das-cinzas" as const;

export const CAMPO_DAS_CINZAS_MAP_ID = "MAP_FALLARBOR_TOWN" as const;
export const CAMPO_DAS_CINZAS_WIDTH = 20;
export const CAMPO_DAS_CINZAS_HEIGHT = 20;
export const CAMPO_DAS_CINZAS_PRIMARY = "gTileset_General";
export const CAMPO_DAS_CINZAS_SECONDARY = "gTileset_Fallarbor";

export const CAMPO_DAS_CINZAS_PROMPT = `RECONSTRUA CAMPO DAS CINZAS EM CAMADAS SOBRE O FALLARBORTOWN REAL 20x20.
Mapa 20x20; nome="Campo das Cinzas — piloto de travessia vulcânica"

CAMADA 1 — ZONAS BASE DA VILA
- setor noroeste: x=1..8, y=1..8 -> piso base
- setor nordeste: x=9..18, y=1..8 -> piso base
- setor sudoeste: x=1..8, y=9..18 -> piso base
- setor sudeste: x=9..18, y=9..18 -> piso base
- miolo de cinzas: x=7..12, y=7..12 -> piso base

CAMADA 2 — RESPIROS VERDES
- borda verde norte: x=2..5, y=2..5 -> piso verde
- jardim leste: x=16..18, y=10..14 -> piso verde
- quintal sul: x=8..12, y=16..18 -> piso verde

CAMADA 3 — CAMINHOS E TRAVESSIAS
- eixo Route 114 a Route 113: x=0..19, y=9..11 -> piso urbano
- rua dos serviços norte: x=6..16, y=6..8 -> piso urbano
- acesso residencial sul: x=4..16, y=14..16 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- conexão oeste Route 114: x=0..1, y=0..19 -> preservar
- conexão leste Route 113: x=18..19, y=0..19 -> preservar
- canto do item oculto: x=0..3, y=13..18 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, item oculto, colisões funcionais e moldura existentes.
- não inventar metatile IDs, edifícios, triggers ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida oeste -> MAP_ROUTE114 offset 0
saida leste -> MAP_ROUTE113 offset 0`;

export interface CampoDasCinzasContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface CampoDasCinzasGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function campoDasCinzasGuard(context: CampoDasCinzasContext): CampoDasCinzasGuardResult {
  if (context.width !== CAMPO_DAS_CINZAS_WIDTH || context.height !== CAMPO_DAS_CINZAS_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${CAMPO_DAS_CINZAS_WIDTH}×${CAMPO_DAS_CINZAS_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== CAMPO_DAS_CINZAS_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Campo das Cinzas usa o slot real ${CAMPO_DAS_CINZAS_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== CAMPO_DAS_CINZAS_PRIMARY.toLowerCase() || secondary !== CAMPO_DAS_CINZAS_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Campo das Cinzas exige ${CAMPO_DAS_CINZAS_PRIMARY} + ${CAMPO_DAS_CINZAS_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Campo das Cinzas” disponível: eixo Route 114↔113, estruturas e contexto do item oculto preservados.",
  };
}

export function campoDasCinzasGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return campoDasCinzasGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
