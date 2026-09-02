import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Encruzilhada Central sobre o slot real de Mauville.
 * A composição enfatiza os quatro eixos de circulação sem deslocar estruturas,
 * eventos ou as quatro conexões cardeais herdadas.
 */
export const ENCRUZILHADA_CENTRAL_PRESET_ID = "piloto-encruzilhada-central" as const;

export const ENCRUZILHADA_CENTRAL_MAP_ID = "MAP_MAUVILLE_CITY" as const;
export const ENCRUZILHADA_CENTRAL_WIDTH = 40;
export const ENCRUZILHADA_CENTRAL_HEIGHT = 20;
export const ENCRUZILHADA_CENTRAL_PRIMARY = "gTileset_General";
export const ENCRUZILHADA_CENTRAL_SECONDARY = "gTileset_Mauville";

export const ENCRUZILHADA_CENTRAL_PROMPT = `RECONSTRUA ENCRUZILHADA CENTRAL EM CAMADAS SOBRE O MAUVILLECITY REAL 40x20.
Mapa 40x20; nome="Encruzilhada Central — piloto dos quatro caminhos"

CAMADA 1 — ZONAS BASE DA CIDADE
- quadrante noroeste: x=1..18, y=1..8 -> piso base
- quadrante nordeste: x=21..38, y=1..8 -> piso base
- quadrante sudoeste: x=1..18, y=11..18 -> piso base
- quadrante sudeste: x=21..38, y=11..18 -> piso base
- praça de cruzamento: x=15..25, y=6..14 -> piso urbano

CAMADA 2 — ZONAS VERDES AGRUPADAS
- respiro oeste: x=2..6, y=2..6 -> piso verde
- jardim norte-central: x=16..20, y=2..5 -> piso verde
- respiro sudeste: x=33..37, y=14..18 -> piso verde

CAMADA 3 — CAMINHOS E VIAS URBANAS
- eixo norte-sul: x=19..21, y=0..19 -> piso urbano
- eixo leste-oeste: x=0..39, y=9..11 -> piso urbano
- ramal do ginásio: x=7..10, y=4..11 -> piso urbano
- ramal centro norte: x=20..24, y=4..10 -> piso urbano
- ramal bicicletaria: x=31..36, y=4..10 -> piso urbano
- ramal mercado sudeste: x=22..33, y=12..15 -> piso urbano
- ramal salão oeste: x=7..12, y=11..15 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- cena de Val e acompanhante: x=7..10, y=5..7 -> preservar
- encontro de Olivia: x=28..30, y=8..10 -> preservar
- conexão norte Route 111: x=0..39, y=0..1 -> preservar
- conexão sul Route 110: x=0..39, y=18..19 -> preservar
- conexão oeste Route 117: x=0..1, y=0..19 -> preservar
- conexão leste Route 118: x=38..39, y=0..19 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, colisões funcionais e moldura existentes.
- preservar as cenas de Val e Olivia, sem deslocar personagens nem células de acesso.
- não inventar metatile IDs, edifícios, conexões ou estruturas de energia.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida norte -> MAP_ROUTE111 offset 0
saida sul -> MAP_ROUTE110 offset 0
saida oeste -> MAP_ROUTE117 offset 0
saida leste -> MAP_ROUTE118 offset 0`;

export interface EncruzilhadaCentralContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface EncruzilhadaCentralGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function encruzilhadaCentralGuard(context: EncruzilhadaCentralContext): EncruzilhadaCentralGuardResult {
  if (context.width !== ENCRUZILHADA_CENTRAL_WIDTH || context.height !== ENCRUZILHADA_CENTRAL_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${ENCRUZILHADA_CENTRAL_WIDTH}×${ENCRUZILHADA_CENTRAL_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== ENCRUZILHADA_CENTRAL_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Encruzilhada Central usa o slot real ${ENCRUZILHADA_CENTRAL_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== ENCRUZILHADA_CENTRAL_PRIMARY.toLowerCase() || secondary !== ENCRUZILHADA_CENTRAL_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Encruzilhada Central exige ${ENCRUZILHADA_CENTRAL_PRIMARY} + ${ENCRUZILHADA_CENTRAL_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Encruzilhada Central” disponível: quatro eixos conectados, áreas de respiro e cenas/progressão preservadas.",
  };
}

export function encruzilhadaCentralGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return encruzilhadaCentralGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
