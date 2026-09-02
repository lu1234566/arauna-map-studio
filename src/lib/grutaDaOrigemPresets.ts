import type { SavedRealAtlas } from "./realAtlasStore";

export const GRUTA_DA_ORIGEM_PRIMARY = "gTileset_General";
export const GRUTA_DA_ORIGEM_SECONDARY = "gTileset_Cave";

export const GRUTA_DA_ORIGEM_ENTRANCE_PRESET_ID = "piloto-gruta-da-origem-entrada" as const;
export const GRUTA_DA_ORIGEM_1F_PRESET_ID = "piloto-gruta-da-origem-1f" as const;
export const GRUTA_DA_ORIGEM_B1F_PRESET_ID = "piloto-gruta-da-origem-b1f" as const;

const SAFETY = `- preservar todas as paredes, rochas e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo escadas, buracos, warps comportamentais, água e qualquer mecânica equivalente.
- preservar elevações, física, eventos e warps reais; nenhuma célula funcional pode ser normalizada.
- não inventar metatile IDs, paredes, água, escadas, buracos, objetos, warps ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e atlas real.`;

export const GRUTA_DA_ORIGEM_ENTRANCE_PROMPT = `RECONSTRUA GRUTA DA ORIGEM ENTRADA EM CAMADAS SOBRE O CAVEOFORIGIN_ENTRANCE REAL 19x26.
Mapa 19x26; nome="Gruta da Origem — Entrada"

CAMADA 1 — PISO NORMAL LIVRE
- interior: x=1..17, y=1..24 -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
- acesso ao 1F: x=7..11, y=3..7 -> preservar
- retorno Águas de M'Boi: x=7..11, y=18..22 -> preservar

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}`;

export const GRUTA_DA_ORIGEM_1F_PROMPT = `RECONSTRUA GRUTA DA ORIGEM 1F EM CAMADAS SOBRE O CAVEOFORIGIN_1F REAL 23x23.
Mapa 23x23; nome="Gruta da Origem — 1F"

CAMADA 1 — PISO NORMAL LIVRE
- interior: x=1..21, y=1..21 -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
- retorno Entrada: x=9..13, y=15..19 -> preservar
- descida B1F: x=12..16, y=3..7 -> preservar

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}`;

export const GRUTA_DA_ORIGEM_B1F_PROMPT = `RECONSTRUA GRUTA DA ORIGEM B1F EM CAMADAS SOBRE O CAVEOFORIGIN_B1F REAL 19x19.
Mapa 19x19; nome="Gruta da Origem — B1F"

CAMADA 1 — PISO NORMAL LIVRE
- interior: x=1..17, y=1..17 -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
- retorno 1F: x=7..11, y=1..5 -> preservar
- encontro de Amália: x=6..12, y=10..16 -> preservar

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar integralmente o slot narrativo de Amália em (9,13), seu corredor de aproximação e a névoa funcional do mapa.
- não incorporar CaveOfOrigin_UnusedRubySapphireMap1, Map2 ou Map3 ao fluxo ativo.`;

interface GrutaDaOrigemContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface Spec {
  mapId: string;
  width: number;
  height: number;
  label: string;
}

const SPECS = {
  entrance: { mapId: "MAP_CAVE_OF_ORIGIN_ENTRANCE", width: 19, height: 26, label: "Gruta da Origem · Entrada" },
  oneF: { mapId: "MAP_CAVE_OF_ORIGIN_1F", width: 23, height: 23, label: "Gruta da Origem · 1F" },
  b1f: { mapId: "MAP_CAVE_OF_ORIGIN_B1F", width: 19, height: 19, label: "Gruta da Origem · B1F" },
} as const satisfies Record<string, Spec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: GrutaDaOrigemContext, spec: Spec) {
  if (context.width !== spec.width || context.height !== spec.height) {
    return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}; o mapa aberto é ${context.width}×${context.height}.` };
  }
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) {
    return { enabled: false, reason: `Preset bloqueado: o map.json aberto é ${mapId}; ${spec.label} usa ${spec.mapId}.` };
  }
  const primary = normalized(context.atlasPrimary);
  const secondary = normalized(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== GRUTA_DA_ORIGEM_PRIMARY.toLowerCase() || secondary !== GRUTA_DA_ORIGEM_SECONDARY.toLowerCase()) {
      return { enabled: false, reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Gruta da Origem exige ${GRUTA_DA_ORIGEM_PRIMARY} + ${GRUTA_DA_ORIGEM_SECONDARY}.` };
    }
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível com geometria, behaviors, elevações, warps e narrativa preservados.` };
}

function fromAtlas(spec: Spec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({ width, height, mapId, atlasPrimary: atlas?.primary ?? null, atlasSecondary: atlas?.secondary ?? null }, spec);
}

export const grutaDaOrigemEntranceGuard = (context: GrutaDaOrigemContext) => guard(context, SPECS.entrance);
export const grutaDaOrigem1FGuard = (context: GrutaDaOrigemContext) => guard(context, SPECS.oneF);
export const grutaDaOrigemB1FGuard = (context: GrutaDaOrigemContext) => guard(context, SPECS.b1f);

export const grutaDaOrigemEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.entrance, width, height, mapId, atlas);
export const grutaDaOrigem1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneF, width, height, mapId, atlas);
export const grutaDaOrigemB1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.b1f, width, height, mapId, atlas);
