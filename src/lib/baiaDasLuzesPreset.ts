import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Baía das Luzes sobre o slot real de Lilycove.
 * A cidade moderna é reorganizada em setores legíveis, enquanto o corredor de
 * Ciro, a operação herdada do Aqua/Arquivo Vivo, costa e elevações ficam protegidos.
 */
export const BAIA_DAS_LUZES_PRESET_ID = "piloto-baia-das-luzes" as const;

export const BAIA_DAS_LUZES_MAP_ID = "MAP_LILYCOVE_CITY" as const;
export const BAIA_DAS_LUZES_WIDTH = 80;
export const BAIA_DAS_LUZES_HEIGHT = 40;
export const BAIA_DAS_LUZES_PRIMARY = "gTileset_General";
export const BAIA_DAS_LUZES_SECONDARY = "gTileset_Lilycove";

export const BAIA_DAS_LUZES_PROMPT = `RECONSTRUA BAIA DAS LUZES EM CAMADAS SOBRE O LILYCOVECITY REAL 80x40.
Mapa 80x40; nome="Baía das Luzes — piloto urbano costeiro"

CAMADA 1 — ZONAS BASE DA CIDADE
- setor cívico oeste: x=1..25, y=2..18 -> piso base
- centro moderno: x=20..50, y=2..20 -> piso base
- setor operacional leste: x=46..70, y=2..20 -> piso base
- bairros baixos oeste: x=1..35, y=19..37 -> piso base
- bairros baixos leste: x=32..65, y=19..37 -> piso base

CAMADA 2 — ZONAS VERDES AGRUPADAS
- parque oeste: x=4..12, y=22..31 -> piso verde
- jardins centrais: x=45..54, y=26..34 -> piso verde
- respiro alto norte: x=48..58, y=2..8 -> piso verde

CAMADA 3 — VIAS E EIXOS URBANOS
- avenida principal oeste-leste: x=0..79, y=17..19 -> piso urbano
- eixo da loja de departamentos: x=25..29, y=5..19 -> piso urbano
- eixo cívico inferior: x=20..40, y=22..25 -> piso urbano
- acesso ao setor operacional: x=42..72, y=12..16 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO NARRATIVA E COSTEIRA
- cena de Ciro junto à loja: x=23..31, y=4..10 -> preservar
- corredor operacional herdado do Aqua: x=36..48, y=7..20 -> preservar
- acesso ao Arquivo Vivo e antigo hideout: x=64..79, y=0..18 -> preservar
- conexão oeste Route 121: x=0..1, y=0..39 -> preservar
- conexão leste Route 124: x=78..79, y=0..39 -> preservar
- costa leste: x=60..79, y=18..39 -> água/costa
- costa sul: x=0..79, y=35..39 -> água/costa

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, água, costa, elevações funcionais e moldura existentes.
- preservar integralmente a cena de Ciro e os corredores de progressão ligados ao setor operacional/Arquivo Vivo.
- não inventar metatile IDs, edifícios, pontes, triggers ou conexões.
- reserved cells, protected cells, água/costa e faixas de elevação não dominante sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida oeste -> MAP_ROUTE121 offset 10
saida leste -> MAP_ROUTE124 offset -10`;

export interface BaiaDasLuzesContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface BaiaDasLuzesGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function baiaDasLuzesGuard(context: BaiaDasLuzesContext): BaiaDasLuzesGuardResult {
  if (context.width !== BAIA_DAS_LUZES_WIDTH || context.height !== BAIA_DAS_LUZES_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${BAIA_DAS_LUZES_WIDTH}×${BAIA_DAS_LUZES_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== BAIA_DAS_LUZES_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Baía das Luzes usa o slot real ${BAIA_DAS_LUZES_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== BAIA_DAS_LUZES_PRIMARY.toLowerCase() || secondary !== BAIA_DAS_LUZES_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Baía das Luzes exige ${BAIA_DAS_LUZES_PRIMARY} + ${BAIA_DAS_LUZES_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Baía das Luzes” disponível: cidade costeira moderna com Ciro, Arquivo Vivo, costa, elevações e conexões reais preservados.",
  };
}

export function baiaDasLuzesGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return baiaDasLuzesGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
