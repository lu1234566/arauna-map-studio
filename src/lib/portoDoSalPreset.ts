import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Porto do Sal sobre o slot real de Slateport.
 * A composição usa somente papéis semânticos resolvidos pelo atlas/patterns
 * atuais. Água, costa, estruturas e eventos continuam sob as máscaras do Studio.
 */
export const PORTO_DO_SAL_PRESET_ID = "piloto-porto-do-sal" as const;

export const PORTO_DO_SAL_MAP_ID = "MAP_SLATEPORT_CITY" as const;
export const PORTO_DO_SAL_WIDTH = 40;
export const PORTO_DO_SAL_HEIGHT = 60;
export const PORTO_DO_SAL_PRIMARY = "gTileset_General";
export const PORTO_DO_SAL_SECONDARY = "gTileset_Slateport";

export const PORTO_DO_SAL_PROMPT = `RECONSTRUA PORTO DO SAL EM CAMADAS SOBRE O SLATEPORTCITY REAL 40x60.
Mapa 40x60; nome="Porto do Sal — piloto costeiro"

CAMADA 1 — ZONAS BASE COSTEIRAS
- bairro verde noroeste: x=1..17, y=1..20 -> piso verde
- centro norte: x=18..38, y=1..24 -> piso base
- centro oeste: x=1..18, y=18..36 -> piso base
- centro leste: x=22..38, y=17..36 -> piso base
- mercado sul: x=1..18, y=36..58 -> piso portuário
- frente portuária: x=22..38, y=34..58 -> piso portuário

CAMADA 2 — CAMINHOS, VIAS E CAIS
- eixo norte-centro: x=19..22, y=0..31 -> piso urbano
- boulevard central: x=8..38, y=25..29 -> piso urbano
- acesso museu: x=22..32, y=10..16 -> piso urbano
- corredor cívico leste: x=20..31, y=13..34 -> piso urbano
- ligação oeste central: x=7..20, y=31..34 -> piso urbano
- eixo sul Route 109: x=19..22, y=29..59 -> piso urbano
- corredor do mercado: x=4..18, y=37..52 -> piso portuário
- promenade da orla: x=21..38, y=38..42 -> piso portuário
- acesso ao porto: x=27..39, y=42..49 -> piso portuário
- saída leste Route 134: x=22..39, y=27..30 -> piso portuário

CAMADA 3 — ZONAS VERDES AGRUPADAS
- parque noroeste: x=2..14, y=2..12 -> piso verde
- sombra oeste: x=2..10, y=17..30 -> piso verde
- jardim central: x=12..17, y=30..35 -> piso verde
- respiro sul do mercado: x=13..18, y=53..58 -> piso verde

CAMADA 4 — PRESERVAÇÃO
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, colisões funcionais, água, costa e moldura existentes.
- não mover nem recriar prédios; não inventar metatile IDs, água, píeres, falésias ou conexões.
- reserved cells, protected cells e a máscara costeira sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.
- o piso portuário só pode ser usado quando o Studio o derivar de Patterns reais compatíveis de porto/cais/estaleiro/trecho costeiro.

saida norte -> MAP_ROUTE110 offset 0
saida sul -> MAP_ROUTE109 offset 0
saida leste -> MAP_ROUTE134 offset 0`;

export interface PortoDoSalContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface PortoDoSalGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function portoDoSalGuard(context: PortoDoSalContext): PortoDoSalGuardResult {
  if (context.width !== PORTO_DO_SAL_WIDTH || context.height !== PORTO_DO_SAL_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${PORTO_DO_SAL_WIDTH}×${PORTO_DO_SAL_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== PORTO_DO_SAL_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Porto do Sal usa o slot real ${PORTO_DO_SAL_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== PORTO_DO_SAL_PRIMARY.toLowerCase() || secondary !== PORTO_DO_SAL_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Porto do Sal exige ${PORTO_DO_SAL_PRIMARY} + ${PORTO_DO_SAL_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Porto do Sal” disponível: malha urbana + mercado/orla portuária, preservando água, costa, estruturas, warps, triggers, NPCs e conexões reais.",
  };
}

export function portoDoSalGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return portoDoSalGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
