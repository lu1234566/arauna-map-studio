import type { SavedRealAtlas } from "./realAtlasStore";

export const TORRE_JURAMENTO_PRIMARY = "gTileset_General";
export const TORRE_JURAMENTO_ENTRANCE_SECONDARY = "gTileset_Cave";
export const TORRE_JURAMENTO_TOWER_SECONDARY = "gTileset_Pacifidlog";

export const TORRE_JURAMENTO_ENTRANCE_PRESET_ID = "piloto-torre-juramento-entrada" as const;
export const TORRE_JURAMENTO_OUTSIDE_PRESET_ID = "piloto-torre-juramento-exterior" as const;
export const TORRE_JURAMENTO_1F_PRESET_ID = "piloto-torre-juramento-1f" as const;
export const TORRE_JURAMENTO_2F_PRESET_ID = "piloto-torre-juramento-2f" as const;
export const TORRE_JURAMENTO_3F_PRESET_ID = "piloto-torre-juramento-3f" as const;
export const TORRE_JURAMENTO_4F_PRESET_ID = "piloto-torre-juramento-4f" as const;
export const TORRE_JURAMENTO_5F_PRESET_ID = "piloto-torre-juramento-5f" as const;
export const TORRE_JURAMENTO_TOP_PRESET_ID = "piloto-torre-juramento-topo" as const;

const SAFETY = `- preservar todas as paredes, bordas, obstáculos colidíveis e moldura do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo piso rachado, buracos de queda, escadas, warps comportamentais e qualquer célula com behavior não-NORMAL.
- preservar integralmente warps, triggers, NPCs, criaturas, movimentos roteirizados, elevações, collision e physical originais de toda célula funcional.
- quando o jogo possuir um layout runtime *_CLEAN, atuar somente sobre o map.bin físico atualmente aberto; nunca copiar células da versão base para CLEAN nem de CLEAN para base.
- preservar as diferenças de progressão controladas por VAR_SKY_PILLAR_STATE e por setmaplayoutindex.
- não inventar metatile IDs, rachaduras, buracos, escadas, objetos, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

function towerPrompt(
  source: string,
  width: number,
  height: number,
  title: string,
  preserves: readonly string[],
  extra: readonly string[] = [],
) {
  return `RECONSTRUA ${title.toUpperCase()} EM CAMADAS SOBRE O ${source.toUpperCase()} REAL ${width}x${height}.
Mapa ${width}x${height}; nome="${title}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${width - 2}, y=1..${height - 2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${preserves.map((value) => `- ${value}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}${extra.length ? `\n${extra.map((value) => `- ${value}`).join("\n")}` : ""}`;
}

export const TORRE_JURAMENTO_ENTRANCE_PROMPT = towerPrompt(
  "SkyPillar_Entrance",
  18,
  18,
  "Torre Juramento — Entrada",
  [
    "saída Route131: x=4..8, y=14..17 -> preservar",
    "acesso ao exterior da torre: x=12..16, y=2..6 -> preservar",
  ],
  ["este mapa usa General + Cave e não possui variante CLEAN."],
);

export const TORRE_JURAMENTO_OUTSIDE_PROMPT = towerPrompt(
  "SkyPillar_Outside",
  28,
  23,
  "Torre Juramento — Exterior",
  [
    "retorno para a entrada: x=15..19, y=11..15 -> preservar",
    "porta da torre para 1F: x=12..16, y=3..7 -> preservar",
    "palco da cena externa e NPC de história: x=10..17, y=4..10 -> preservar",
  ],
  ["preservar o fluxo de história do NPC em (13,7) e qualquer movimento/flag associado à abertura da Torre."],
);

export const TORRE_JURAMENTO_1F_PROMPT = towerPrompt(
  "SkyPillar_1F",
  14,
  14,
  "Torre Juramento — 1F",
  [
    "dupla de retornos ao exterior: x=4..9, y=11..13 -> preservar",
    "subida para 2F: x=8..12, y=0..3 -> preservar",
  ],
  [
    "o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_1F_CLEAN; o mesmo preset é válido em ambos porque cada map.bin é remodelado separadamente.",
  ],
);

export const TORRE_JURAMENTO_2F_PROMPT = towerPrompt(
  "SkyPillar_2F",
  14,
  14,
  "Torre Juramento — 2F",
  [
    "retorno para 1F: x=8..12, y=0..3 -> preservar",
    "subida para 3F: x=1..5, y=0..3 -> preservar",
  ],
  [
    "preservar integralmente CaveHole_CheckFallDownHole, SkyPillar_2F_SetHoleWarp e todos os pisos rachados/buracos que alimentam a queda.",
    "o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_2F_CLEAN; nenhuma célula funcional da versão base pode contaminar a versão CLEAN.",
  ],
);

export const TORRE_JURAMENTO_3F_PROMPT = towerPrompt(
  "SkyPillar_3F",
  14,
  14,
  "Torre Juramento — 3F",
  [
    "retorno para 2F: x=1..5, y=0..3 -> preservar",
    "acesso 4F leste: x=9..13, y=0..3 -> preservar",
    "acesso 4F central: x=5..9, y=0..3 -> preservar",
  ],
  ["o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_3F_CLEAN; preservar a topologia de acesso dos três warps em ambas as variantes."],
);

export const TORRE_JURAMENTO_4F_PROMPT = towerPrompt(
  "SkyPillar_4F",
  14,
  14,
  "Torre Juramento — 4F",
  [
    "retorno 3F leste: x=9..13, y=0..3 -> preservar",
    "retorno 3F central: x=5..9, y=0..3 -> preservar",
    "subida para 5F: x=1..5, y=0..3 -> preservar",
  ],
  [
    "preservar integralmente CaveHole_CheckFallDownHole, SkyPillar_4F_SetHoleWarp e todos os pisos rachados/buracos que alimentam a queda.",
    "o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_4F_CLEAN; nenhuma célula funcional da versão base pode contaminar a versão CLEAN.",
  ],
);

export const TORRE_JURAMENTO_5F_PROMPT = towerPrompt(
  "SkyPillar_5F",
  14,
  14,
  "Torre Juramento — 5F",
  [
    "retorno para 4F: x=1..5, y=0..3 -> preservar",
    "subida para o topo: x=8..12, y=0..3 -> preservar",
  ],
  ["o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_5F_CLEAN; preservar os dois corredores verticais e a transição para o topo."],
);

export const TORRE_JURAMENTO_TOP_PROMPT = towerPrompt(
  "SkyPillar_Top",
  27,
  24,
  "Torre Juramento — Topo",
  [
    "palco da criatura e despertar: x=10..18, y=3..11 -> preservar",
    "trigger VAR_SKY_PILLAR_RAYQUAZA_CRY_DONE em (14,9): x=12..16, y=7..11 -> preservar",
    "retorno para 5F: x=14..18, y=12..16 -> preservar",
  ],
  [
    "preservar as duas representações da criatura em (14,7) e (14,6), o trigger de despertar em (14,9) e todos os movimentos/flags da cena.",
    "o scripts.inc pode trocar para LAYOUT_SKY_PILLAR_TOP_CLEAN; a variante CLEAN continua usando o mesmo palco e eventos lógicos, mas seu map.bin deve permanecer independente.",
  ],
);

interface TorreJuramentoContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface TorreJuramentoSpec {
  mapId: string;
  width: number;
  height: number;
  secondary: string;
  label: string;
}

const SPECS = {
  entrance: { mapId: "MAP_SKY_PILLAR_ENTRANCE", width: 18, height: 18, secondary: TORRE_JURAMENTO_ENTRANCE_SECONDARY, label: "Torre Juramento · Entrada" },
  outside: { mapId: "MAP_SKY_PILLAR_OUTSIDE", width: 28, height: 23, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · Exterior" },
  oneF: { mapId: "MAP_SKY_PILLAR_1F", width: 14, height: 14, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · 1F" },
  twoF: { mapId: "MAP_SKY_PILLAR_2F", width: 14, height: 14, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · 2F" },
  threeF: { mapId: "MAP_SKY_PILLAR_3F", width: 14, height: 14, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · 3F" },
  fourF: { mapId: "MAP_SKY_PILLAR_4F", width: 14, height: 14, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · 4F" },
  fiveF: { mapId: "MAP_SKY_PILLAR_5F", width: 14, height: 14, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · 5F" },
  top: { mapId: "MAP_SKY_PILLAR_TOP", width: 27, height: 24, secondary: TORRE_JURAMENTO_TOWER_SECONDARY, label: "Torre Juramento · Topo" },
} as const satisfies Record<string, TorreJuramentoSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: TorreJuramentoContext, spec: TorreJuramentoSpec) {
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
    if (primary !== TORRE_JURAMENTO_PRIMARY.toLowerCase() || secondary !== spec.secondary.toLowerCase()) {
      return { enabled: false, reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; ${spec.label} exige ${TORRE_JURAMENTO_PRIMARY} + ${spec.secondary}.` };
    }
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível; behaviors funcionais, warps, cenas e variantes runtime permanecem preservados.` };
}

function fromAtlas(spec: TorreJuramentoSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({ width, height, mapId, atlasPrimary: atlas?.primary ?? null, atlasSecondary: atlas?.secondary ?? null }, spec);
}

export const torreJuramentoEntranceGuard = (context: TorreJuramentoContext) => guard(context, SPECS.entrance);
export const torreJuramentoOutsideGuard = (context: TorreJuramentoContext) => guard(context, SPECS.outside);
export const torreJuramento1FGuard = (context: TorreJuramentoContext) => guard(context, SPECS.oneF);
export const torreJuramento2FGuard = (context: TorreJuramentoContext) => guard(context, SPECS.twoF);
export const torreJuramento3FGuard = (context: TorreJuramentoContext) => guard(context, SPECS.threeF);
export const torreJuramento4FGuard = (context: TorreJuramentoContext) => guard(context, SPECS.fourF);
export const torreJuramento5FGuard = (context: TorreJuramentoContext) => guard(context, SPECS.fiveF);
export const torreJuramentoTopGuard = (context: TorreJuramentoContext) => guard(context, SPECS.top);

export const torreJuramentoEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.entrance, width, height, mapId, atlas);
export const torreJuramentoOutsideGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.outside, width, height, mapId, atlas);
export const torreJuramento1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneF, width, height, mapId, atlas);
export const torreJuramento2FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.twoF, width, height, mapId, atlas);
export const torreJuramento3FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.threeF, width, height, mapId, atlas);
export const torreJuramento4FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.fourF, width, height, mapId, atlas);
export const torreJuramento5FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.fiveF, width, height, mapId, atlas);
export const torreJuramentoTopGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.top, width, height, mapId, atlas);
