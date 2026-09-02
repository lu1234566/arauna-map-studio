import type { SavedRealAtlas } from "./realAtlasStore";

export const CAVERNAS_MBOI_PRIMARY = "gTileset_General";
export const CAVERNAS_MBOI_CAVE_SECONDARY = "gTileset_Cave";
export const CAVERNAS_MBOI_CURRENT_SECONDARY = "gTileset_Pacifidlog";

export const CAVERNAS_MBOI_ENTRANCE_PRESET_ID = "piloto-cavernas-mboi-entrada" as const;
export const CAVERNAS_MBOI_ROOM1_PRESET_ID = "piloto-cavernas-mboi-room1" as const;
export const CAVERNAS_MBOI_ROOM2_PRESET_ID = "piloto-cavernas-mboi-room2" as const;
export const CAVERNAS_MBOI_ROOM3_PRESET_ID = "piloto-cavernas-mboi-room3" as const;
export const CAVERNAS_MBOI_ROOM4_PRESET_ID = "piloto-cavernas-mboi-room4" as const;
export const CAVERNAS_MBOI_ROOM5_PRESET_ID = "piloto-cavernas-mboi-room5" as const;
export const CAVERNAS_MBOI_ROOM6_PRESET_ID = "piloto-cavernas-mboi-room6" as const;
export const CAVERNAS_MBOI_ROOM7_PRESET_ID = "piloto-cavernas-mboi-room7" as const;
export const CAVERNAS_MBOI_ROOM8_PRESET_ID = "piloto-cavernas-mboi-room8" as const;
export const CAVERNAS_MBOI_ROOM9_PRESET_ID = "piloto-cavernas-mboi-room9" as const;

const SAFETY = `- preservar todas as paredes, rochas e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo correnteza, água, escadas, buracos, warps comportamentais e qualquer mecânica equivalente.
- preservar integralmente boulders de Strength, rochas de Rock Smash, NPCs, treinadores, itens, triggers, warps e suas células de aproximação já reservadas pelo map.json.
- preservar elevações e física original das células funcionais; nenhuma camada pode transformar água/correnteza em piso comum.
- não inventar metatile IDs, paredes, água, correnteza, boulders, rochas, escadas, buracos, warps ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

function prompt(
  mapName: string,
  width: number,
  height: number,
  title: string,
  preserves: readonly string[],
  extra: string[] = [],
) {
  const x2 = width - 2;
  const y2 = height - 2;
  return `RECONSTRUA ${title.toUpperCase()} EM CAMADAS SOBRE O ${mapName.toUpperCase()} REAL ${width}x${height}.
Mapa ${width}x${height}; nome="${title}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${x2}, y=1..${y2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${preserves.map((value) => `- ${value}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}${extra.length ? `\n${extra.map((value) => `- ${value}`).join("\n")}` : ""}`;
}

export const CAVERNAS_MBOI_ENTRANCE_PROMPT = prompt(
  "SeafloorCavern_Entrance",
  20,
  20,
  "Cavernas M'Boi — Entrada",
  [
    "acesso Room1 e guarda: x=8..12, y=0..5 -> preservar",
    "retorno submerso Route128: x=8..12, y=16..19 -> preservar",
  ],
);

export const CAVERNAS_MBOI_ROOM1_PROMPT = prompt(
  "SeafloorCavern_Room1",
  20,
  21,
  "Cavernas M'Boi — Sala 1",
  [
    "puzzle Strength e Rock Smash: x=3..14, y=8..13 -> preservar",
    "agentes do Horizonte: x=6..17, y=4..12 -> preservar",
    "retorno Entrada: x=3..7, y=16..20 -> preservar",
    "acesso Room2: x=4..8, y=0..4 -> preservar",
    "acesso Room5: x=15..19, y=11..15 -> preservar",
  ],
);

export const CAVERNAS_MBOI_ROOM2_PROMPT = prompt(
  "SeafloorCavern_Room2",
  18,
  12,
  "Cavernas M'Boi — Sala 2",
  [
    "puzzle principal de boulders e Rock Smash: x=2..15, y=1..9 -> preservar",
    "retorno Room1: x=8..12, y=5..9 -> preservar",
    "acesso Room4: x=2..6, y=8..11 -> preservar",
    "acessos Room6 e Room7: x=4..13, y=0..3 -> preservar",
  ],
  ["esta sala é um puzzle de Strength; a composição não pode criar, remover nem reposicionar espaço útil ao redor dos boulders."],
);

export const CAVERNAS_MBOI_ROOM3_PROMPT = prompt(
  "SeafloorCavern_Room3",
  16,
  17,
  "Cavernas M'Boi — Sala 3",
  [
    "admin do Arquivo e agente: x=3..11, y=3..7 -> preservar",
    "puzzle de boulders: x=9..15, y=5..13 -> preservar",
    "acesso Room8: x=6..10, y=0..3 -> preservar",
    "retorno Room7: x=7..11, y=11..15 -> preservar",
    "retorno Room6: x=2..6, y=13..16 -> preservar",
  ],
);

export const CAVERNAS_MBOI_ROOM4_PROMPT = prompt(
  "SeafloorCavern_Room4",
  18,
  19,
  "Cavernas M'Boi — Sala 4",
  [
    "dupla de agentes do Horizonte: x=3..7, y=6..14 -> preservar",
    "acessos norte Room2 e Room5: x=2..15, y=0..3 -> preservar",
    "acesso central Room5: x=7..11, y=8..12 -> preservar",
    "retorno Entrada: x=8..12, y=13..18 -> preservar",
  ],
);

export const CAVERNAS_MBOI_ROOM5_PROMPT = prompt(
  "SeafloorCavern_Room5",
  20,
  20,
  "Cavernas M'Boi — Sala 5",
  [
    "puzzle Strength e Rock Smash: x=1..15, y=5..15 -> preservar",
    "retorno Room1: x=2..6, y=0..3 -> preservar",
    "retorno Room4 leste: x=13..17, y=10..14 -> preservar",
    "retorno Room4 sul: x=5..9, y=15..19 -> preservar",
  ],
);

export const CAVERNAS_MBOI_ROOM6_PROMPT = prompt(
  "SeafloorCavern_Room6",
  24,
  23,
  "Cavernas M'Boi — Sala 6 · Correntes",
  [
    "retorno Room2 sul: x=9..13, y=19..22 -> preservar",
    "acesso Room3 norte: x=2..6, y=0..3 -> preservar",
    "warp aquático para Entrada: x=12..16, y=6..10 -> preservar",
  ],
  ["usar o tileset General + Pacifidlog real desta sala; correntezas e água são geometria funcional e permanecem intocáveis."],
);

export const CAVERNAS_MBOI_ROOM7_PROMPT = prompt(
  "SeafloorCavern_Room7",
  23,
  25,
  "Cavernas M'Boi — Sala 7 · Correntes",
  [
    "retorno Room2 sul: x=1..5, y=21..24 -> preservar",
    "acesso Room3 norte: x=3..7, y=0..3 -> preservar",
  ],
  ["usar o tileset General + Pacifidlog real desta sala; toda correnteza, água e direção de deslocamento do puzzle devem sobreviver byte a byte."],
);

export const CAVERNAS_MBOI_ROOM8_PROMPT = prompt(
  "SeafloorCavern_Room8",
  11,
  14,
  "Cavernas M'Boi — Sala 8",
  [
    "puzzle final de boulders: x=1..9, y=2..9 -> preservar",
    "acesso Room9: x=3..7, y=0..4 -> preservar",
    "retorno Room3: x=3..7, y=10..13 -> preservar",
  ],
  ["a malha de boulders é progressão obrigatória; nenhuma célula do puzzle pode ser aberta, fechada ou simplificada."],
);

export const CAVERNAS_MBOI_ROOM9_PROMPT = prompt(
  "SeafloorCavern_Room9",
  27,
  46,
  "Cavernas M'Boi — Núcleo",
  [
    "retorno Room8: x=3..7, y=2..6 -> preservar",
    "TM Earthquake: x=12..16, y=3..7 -> preservar",
    "palco do clímax Otacílio, Luzia, agentes e criatura: x=6..21, y=35..45 -> preservar",
    "trigger do despertar e corredor de movimentos: x=7..19, y=39..45 -> preservar",
  ],
  [
    "preservar integralmente o trigger VAR_SEAFLOOR_CAVERN_STATE em (17,42), os movimentos roteirizados e os pontos (17,38), (9,42), (8,41) e (8,42).",
    "não usar o layout órfão LAYOUT_SEAFLOOR_CAVERN_ROOM9_LAVA como substituto do MAP_SEAFLOOR_CAVERN_ROOM9 real.",
  ],
);

interface CavernasMboiContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface CavernasMboiSpec {
  mapId: string;
  width: number;
  height: number;
  secondary: string;
  label: string;
}

const SPECS = {
  entrance: { mapId: "MAP_SEAFLOOR_CAVERN_ENTRANCE", width: 20, height: 20, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Entrada" },
  room1: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM1", width: 20, height: 21, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 1" },
  room2: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM2", width: 18, height: 12, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 2" },
  room3: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM3", width: 16, height: 17, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 3" },
  room4: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM4", width: 18, height: 19, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 4" },
  room5: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM5", width: 20, height: 20, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 5" },
  room6: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM6", width: 24, height: 23, secondary: CAVERNAS_MBOI_CURRENT_SECONDARY, label: "Cavernas M'Boi · Sala 6" },
  room7: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM7", width: 23, height: 25, secondary: CAVERNAS_MBOI_CURRENT_SECONDARY, label: "Cavernas M'Boi · Sala 7" },
  room8: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM8", width: 11, height: 14, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Sala 8" },
  room9: { mapId: "MAP_SEAFLOOR_CAVERN_ROOM9", width: 27, height: 46, secondary: CAVERNAS_MBOI_CAVE_SECONDARY, label: "Cavernas M'Boi · Núcleo" },
} as const satisfies Record<string, CavernasMboiSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: CavernasMboiContext, spec: CavernasMboiSpec) {
  if (context.width !== spec.width || context.height !== spec.height) {
    return {
      enabled: false,
      reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; ${spec.label} usa ${spec.mapId}.`,
    };
  }
  const primary = normalized(context.atlasPrimary);
  const secondary = normalized(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== CAVERNAS_MBOI_PRIMARY.toLowerCase() || secondary !== spec.secondary.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; ${spec.label} exige ${CAVERNAS_MBOI_PRIMARY} + ${spec.secondary}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: `${spec.label}: preset local disponível; puzzles, água/correntes, behaviors, eventos e warps reais permanecem preservados.`,
  };
}

function fromAtlas(spec: CavernasMboiSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({
    width,
    height,
    mapId,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  }, spec);
}

export const cavernasMboiEntranceGuard = (context: CavernasMboiContext) => guard(context, SPECS.entrance);
export const cavernasMboiRoom1Guard = (context: CavernasMboiContext) => guard(context, SPECS.room1);
export const cavernasMboiRoom2Guard = (context: CavernasMboiContext) => guard(context, SPECS.room2);
export const cavernasMboiRoom3Guard = (context: CavernasMboiContext) => guard(context, SPECS.room3);
export const cavernasMboiRoom4Guard = (context: CavernasMboiContext) => guard(context, SPECS.room4);
export const cavernasMboiRoom5Guard = (context: CavernasMboiContext) => guard(context, SPECS.room5);
export const cavernasMboiRoom6Guard = (context: CavernasMboiContext) => guard(context, SPECS.room6);
export const cavernasMboiRoom7Guard = (context: CavernasMboiContext) => guard(context, SPECS.room7);
export const cavernasMboiRoom8Guard = (context: CavernasMboiContext) => guard(context, SPECS.room8);
export const cavernasMboiRoom9Guard = (context: CavernasMboiContext) => guard(context, SPECS.room9);

export const cavernasMboiEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.entrance, width, height, mapId, atlas);
export const cavernasMboiRoom1GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room1, width, height, mapId, atlas);
export const cavernasMboiRoom2GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room2, width, height, mapId, atlas);
export const cavernasMboiRoom3GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room3, width, height, mapId, atlas);
export const cavernasMboiRoom4GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room4, width, height, mapId, atlas);
export const cavernasMboiRoom5GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room5, width, height, mapId, atlas);
export const cavernasMboiRoom6GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room6, width, height, mapId, atlas);
export const cavernasMboiRoom7GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room7, width, height, mapId, atlas);
export const cavernasMboiRoom8GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room8, width, height, mapId, atlas);
export const cavernasMboiRoom9GuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.room9, width, height, mapId, atlas);
