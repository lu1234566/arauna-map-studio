import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Águas de M'Boi sobre Sootopolis. O lago/cratera e
 * sua costa permanecem sob a proteção automática de água; a área do clímax
 * recebe ainda uma zona preserve explícita aplicada após as vias.
 */
export const AGUAS_MBOI_PRESET_ID = "piloto-aguas-mboi" as const;

export const AGUAS_MBOI_MAP_ID = "MAP_SOOTOPOLIS_CITY" as const;
export const AGUAS_MBOI_WIDTH = 60;
export const AGUAS_MBOI_HEIGHT = 60;
export const AGUAS_MBOI_PRIMARY = "gTileset_General";
export const AGUAS_MBOI_SECONDARY = "gTileset_Sootopolis";

export const AGUAS_MBOI_PROMPT = `RECONSTRUA AGUAS DE M'BOI EM CAMADAS SOBRE O SOOTOPOLISCITY REAL 60x60.
Mapa 60x60; nome="Águas de M'Boi — piloto da cratera"

CAMADA 1 — ZONAS BASE DA CRATERA
- quadrante noroeste: x=1..26, y=1..28 -> piso base
- quadrante nordeste: x=34..58, y=1..28 -> piso base
- quadrante sudoeste: x=1..26, y=31..58 -> piso base
- quadrante sudeste: x=34..58, y=31..58 -> piso base
- coroa norte: x=24..36, y=1..14 -> piso base

CAMADA 2 — CAMINHOS, VIAS E PONTES
- espinha oeste: x=8..11, y=4..55 -> piso urbano
- espinha leste: x=44..47, y=4..55 -> piso urbano
- anel norte: x=9..47, y=14..18 -> piso urbano
- anel central: x=9..53, y=27..33 -> piso urbano
- anel sul: x=8..52, y=35..40 -> piso urbano
- eixo ginásio e mercado: x=17..43, y=29..34 -> piso urbano
- ponte oeste central: x=10..29, y=28..31 -> piso urbano
- ponte leste central: x=33..52, y=28..31 -> piso urbano
- acesso à origem: x=28..34, y=14..20 -> piso urbano
- ramal sul de Kiri: x=8..20, y=41..45 -> piso urbano

CAMADA 3 — ZONAS VERDES AGRUPADAS
- jardim noroeste: x=1..7, y=2..14 -> piso verde
- jardim nordeste: x=48..58, y=2..14 -> piso verde
- mata sudoeste: x=1..7, y=40..58 -> piso verde
- mata sudeste: x=52..58, y=38..58 -> piso verde

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- palco do clímax: x=25..37, y=30..47 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, colisões funcionais, água, costa, escadas, pontes e desníveis existentes.
- preservar integralmente o lago/cratera central e a área do clímax; nenhuma camada pode transformar água em chão.
- não mover nem recriar prédios; não inventar metatile IDs, água, falésias, escadas, pontes ou conexões.
- reserved cells, protected cells e a máscara costeira sempre vencem qualquer camada de piso.
- manter a física original das células protegidas e todos os acessos funcionais.
- este mapa não possui conexão de borda; não criar saída artificial.`;

export interface AguasMboiContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface AguasMboiGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function aguasMboiGuard(context: AguasMboiContext): AguasMboiGuardResult {
  if (context.width !== AGUAS_MBOI_WIDTH || context.height !== AGUAS_MBOI_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${AGUAS_MBOI_WIDTH}×${AGUAS_MBOI_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== AGUAS_MBOI_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Águas de M'Boi usa o slot real ${AGUAS_MBOI_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== AGUAS_MBOI_PRIMARY.toLowerCase() || secondary !== AGUAS_MBOI_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Águas de M'Boi exige ${AGUAS_MBOI_PRIMARY} + ${AGUAS_MBOI_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto M'Boi” disponível: anéis terrestres ao redor da água real, com lago/cratera, clímax, estruturas, warps e NPCs preservados e nenhuma conexão inventada.",
  };
}

export function aguasMboiGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return aguasMboiGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
