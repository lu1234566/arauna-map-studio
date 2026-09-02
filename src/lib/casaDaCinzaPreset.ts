import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Casa da Cinza sobre Lavaridge. O núcleo termal fica
 * explicitamente preservado; o restante usa apenas base/urban/green derivados
 * do mapa e do atlas reais.
 */
export const CASA_DA_CINZA_PRESET_ID = "piloto-casa-da-cinza" as const;

export const CASA_DA_CINZA_MAP_ID = "MAP_LAVARIDGE_TOWN" as const;
export const CASA_DA_CINZA_WIDTH = 20;
export const CASA_DA_CINZA_HEIGHT = 20;
export const CASA_DA_CINZA_PRIMARY = "gTileset_General";
export const CASA_DA_CINZA_SECONDARY = "gTileset_Lavaridge";

export const CASA_DA_CINZA_PROMPT = `RECONSTRUA CASA DA CINZA EM CAMADAS SOBRE O LAVARIDGETOWN REAL 20x20.
Mapa 20x20; nome="Casa da Cinza — piloto termal"

CAMADA 1 — ZONAS DE TERRENO E PRESERVAÇÃO
- núcleo termal: x=2..7, y=1..6 -> preservar
- bairro oeste de cinza: x=1..8, y=7..18 -> piso base
- bairro norte: x=8..18, y=1..8 -> piso base
- bairro leste: x=11..18, y=8..18 -> piso base
- miolo sul: x=8..12, y=11..18 -> piso base

CAMADA 2 — CAMINHOS E VIAS DA VILA
- rua principal leste-oeste: x=1..19, y=14..16 -> piso urbano
- eixo central: x=9..11, y=5..16 -> piso urbano
- rua do centro e mercado: x=9..18, y=5..7 -> piso urbano
- ramal do ginásio: x=5..10, y=14..16 -> piso urbano
- ramal da casa de ervas: x=11..17, y=14..16 -> piso urbano
- acesso à placa central: x=11..14, y=8..10 -> piso urbano

CAMADA 3 — ZONAS VERDES AGRUPADAS
- memorial oeste: x=1..3, y=11..18 -> piso verde
- sombra leste: x=17..18, y=7..12 -> piso verde

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, colisões funcionais e bordas existentes.
- preservar integralmente a área termal e seu trigger; não redesenhar água quente, escadas ou comportamentos especiais.
- não mover nem recriar prédios; não inventar metatile IDs, cinza, lava, água, falésias ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter a física original das células protegidas e os acessos funcionais das portas.

saida leste -> MAP_ROUTE112 offset -40`;

export interface CasaDaCinzaContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface CasaDaCinzaGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function casaDaCinzaGuard(context: CasaDaCinzaContext): CasaDaCinzaGuardResult {
  if (context.width !== CASA_DA_CINZA_WIDTH || context.height !== CASA_DA_CINZA_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${CASA_DA_CINZA_WIDTH}×${CASA_DA_CINZA_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== CASA_DA_CINZA_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Casa da Cinza usa o slot real ${CASA_DA_CINZA_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== CASA_DA_CINZA_PRIMARY.toLowerCase() || secondary !== CASA_DA_CINZA_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Casa da Cinza exige ${CASA_DA_CINZA_PRIMARY} + ${CASA_DA_CINZA_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Casa da Cinza” disponível: malha termal compacta com núcleo preservado, sem mover estruturas, warps, triggers, NPCs ou a conexão real.",
  };
}

export function casaDaCinzaGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return casaDaCinzaGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
