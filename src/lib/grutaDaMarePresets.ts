import type { SavedRealAtlas } from "./realAtlasStore";

export const GRUTA_DA_MARE_PRIMARY = "gTileset_General";
export const GRUTA_DA_MARE_SECONDARY = "gTileset_Cave";

export const GRUTA_DA_MARE_LOW_ENTRANCE_PRESET_ID = "piloto-gruta-da-mare-entrada-baixa" as const;
export const GRUTA_DA_MARE_HIGH_ENTRANCE_PRESET_ID = "piloto-gruta-da-mare-entrada-alta" as const;
export const GRUTA_DA_MARE_LOW_INNER_PRESET_ID = "piloto-gruta-da-mare-interior-baixa" as const;
export const GRUTA_DA_MARE_HIGH_INNER_PRESET_ID = "piloto-gruta-da-mare-interior-alta" as const;
export const GRUTA_DA_MARE_LOWER_PRESET_ID = "piloto-gruta-da-mare-inferior" as const;
export const GRUTA_DA_MARE_STAIRS_PRESET_ID = "piloto-gruta-da-mare-escadarias" as const;
export const GRUTA_DA_MARE_ICE_PRESET_ID = "piloto-gruta-da-mare-gelo" as const;

const SAFETY = `- preservar todas as paredes, rochas e obstáculos colidíveis do mapa real.
- preservar integralmente água, costa interna, poças, canais, gelo, piso escorregadio, escadas, desníveis e qualquer behavior funcional não-NORMAL.
- preservar metatiles que os scripts de maré ou de Shoal Salt/Shell alteram em runtime; o preset não pode antecipar, apagar ou fixar um estado dinâmico.
- preservar NPCs, itens, Shoal Salt, Shoal Shell, boulders de Strength, warps e suas células de aproximação reservadas pelo map.json.
- preservar elevação e physical originais de toda célula funcional; água/gelo nunca podem virar piso base.
- não inventar metatile IDs, água, gelo, escadas, paredes, itens, boulders, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

function prompt(
  mapName: string,
  width: number,
  height: number,
  title: string,
  preserves: readonly string[],
  extra: readonly string[] = [],
) {
  return `RECONSTRUA ${title.toUpperCase()} EM CAMADAS SOBRE O ${mapName.toUpperCase()} REAL ${width}x${height}.
Mapa ${width}x${height}; nome="${title}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${width - 2}, y=1..${height - 2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${preserves.map((value) => `- ${value}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}${extra.length ? `\n${extra.map((value) => `- ${value}`).join("\n")}` : ""}`;
}

export const GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT = prompt(
  "ShoalCave_LowTideEntranceRoom",
  35,
  35,
  "Gruta da Maré — Entrada · maré baixa",
  [
    "saída Route125: x=18..22, y=28..34 -> preservar",
    "acesso interior central: x=17..21, y=3..7 -> preservar",
    "acesso interior noroeste: x=4..8, y=0..4 -> preservar",
    "acesso interior nordeste: x=25..29, y=0..4 -> preservar",
    "artesão da Shell Bell: x=15..21, y=12..18 -> preservar",
    "Big Pearl: x=28..32, y=1..5 -> preservar",
  ],
  [
    "este é o map id que executa UpdateShoalTideFlag; preservar a lógica que alterna o layout entre maré baixa e maré alta.",
  ],
);

export const GRUTA_DA_MARE_HIGH_ENTRANCE_PROMPT = prompt(
  "ShoalCave_HighTideEntranceRoom",
  35,
  35,
  "Gruta da Maré — Entrada · maré alta",
  [
    "faixa de água e travessias da entrada: x=1..33, y=1..33 -> preservar",
  ],
  [
    "este layout é a contraparte visual da entrada em maré alta; não criar eventos próprios, pois o map.json deste estado não contém object/warp/coord/bg events.",
    "preservar a navegabilidade aquática e a correspondência geométrica com o estado de maré baixa.",
  ],
);

export const GRUTA_DA_MARE_LOW_INNER_PROMPT = prompt(
  "ShoalCave_LowTideInnerRoom",
  46,
  38,
  "Gruta da Maré — Interior · maré baixa",
  [
    "retorno entrada central: x=32..36, y=27..31 -> preservar",
    "acessos escadarias leste: x=36..45, y=2..17 -> preservar",
    "acessos sala inferior oeste/centro: x=13..21, y=12..21 -> preservar",
    "acesso sala inferior sudeste: x=28..32, y=23..27 -> preservar",
    "retornos superiores à entrada: x=12..16, y=31..37 -> preservar",
    "retorno superior leste à entrada: x=38..42, y=31..37 -> preservar",
    "Rare Candy em elevação 5: x=24..28, y=12..16 -> preservar",
    "Shoal Salt 1: x=29..33, y=6..10 -> preservar",
    "Shoal Salt 2: x=12..16, y=24..28 -> preservar",
    "Shoal Shell 1: x=39..43, y=18..22 -> preservar",
    "Shoal Shell 2: x=39..43, y=8..12 -> preservar",
    "Shoal Shell 3: x=4..8, y=7..11 -> preservar",
    "Shoal Shell 4: x=14..18, y=11..15 -> preservar",
  ],
  [
    "preservar os metatiles atualizados por ShoalCave_LowTideInnerRoom_OnLoad/OnTransition e a disponibilidade dinâmica de Salt/Shell.",
    "preservar as elevações 3, 4 e 5 dos oito warps reais; nenhuma normalização pode achatar esses corredores.",
  ],
);

export const GRUTA_DA_MARE_HIGH_INNER_PROMPT = prompt(
  "ShoalCave_HighTideInnerRoom",
  46,
  38,
  "Gruta da Maré — Interior · maré alta",
  [
    "massa de água, ilhas e corredores de surf: x=1..44, y=1..36 -> preservar",
  ],
  [
    "este layout é a contraparte visual do interior em maré alta; não criar eventos próprios, pois o map.json deste estado não contém object/warp/coord/bg events.",
    "preservar integralmente a topologia aquática que deve alinhar com os acessos do estado de maré baixa.",
  ],
);

export const GRUTA_DA_MARE_LOWER_PROMPT = prompt(
  "ShoalCave_LowTideLowerRoom",
  31,
  14,
  "Gruta da Maré — Sala Inferior",
  [
    "retorno interior noroeste: x=5..9, y=0..4 -> preservar",
    "retorno interior oeste: x=0..4, y=4..8 -> preservar",
    "retorno interior sul: x=17..21, y=9..13 -> preservar",
    "acesso Câmara de Gelo: x=26..30, y=9..13 -> preservar",
    "boulder de Strength: x=23..27, y=1..5 -> preservar",
    "Black Belt: x=8..14, y=1..7 -> preservar",
    "Shoal Salt: x=16..20, y=0..4 -> preservar",
  ],
  [
    "preservar o espaço útil ao redor do boulder de Strength; o preset não pode abrir, fechar ou simplificar seu puzzle.",
  ],
);

export const GRUTA_DA_MARE_STAIRS_PROMPT = prompt(
  "ShoalCave_LowTideStairsRoom",
  21,
  15,
  "Gruta da Maré — Escadarias",
  [
    "retorno interior sudoeste: x=1..5, y=10..14 -> preservar",
    "retorno interior norte: x=5..9, y=2..6 -> preservar",
    "Ice Heal: x=11..15, y=10..14 -> preservar",
    "Shoal Salt: x=9..13, y=9..13 -> preservar",
  ],
  [
    "preservar escadas e todos os metatiles atualizados pelo script SetShoalItemMetatiles desta sala.",
  ],
);

export const GRUTA_DA_MARE_ICE_PROMPT = prompt(
  "ShoalCave_LowTideIceRoom",
  20,
  30,
  "Gruta da Maré — Câmara de Gelo",
  [
    "retorno sala inferior: x=15..19, y=8..12 -> preservar",
    "TM Hail: x=10..14, y=6..10 -> preservar",
    "NeverMeltIce em elevação 4: x=10..14, y=19..23 -> preservar",
    "todo piso de gelo e corredores escorregadios: x=1..18, y=1..28 -> preservar",
  ],
  [
    "a Câmara de Gelo é um puzzle físico: preservar byte a byte todo behavior de gelo/piso escorregadio e suas elevações.",
    "a única remodelagem permitida é em células NORMAL livres que não participem da rota do puzzle.",
  ],
);

interface GrutaDaMareContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface GrutaDaMareSpec {
  mapId: string;
  width: number;
  height: number;
  label: string;
}

const SPECS = {
  lowEntrance: { mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM", width: 35, height: 35, label: "Gruta da Maré · Entrada · maré baixa" },
  highEntrance: { mapId: "MAP_SHOAL_CAVE_HIGH_TIDE_ENTRANCE_ROOM", width: 35, height: 35, label: "Gruta da Maré · Entrada · maré alta" },
  lowInner: { mapId: "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM", width: 46, height: 38, label: "Gruta da Maré · Interior · maré baixa" },
  highInner: { mapId: "MAP_SHOAL_CAVE_HIGH_TIDE_INNER_ROOM", width: 46, height: 38, label: "Gruta da Maré · Interior · maré alta" },
  lower: { mapId: "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM", width: 31, height: 14, label: "Gruta da Maré · Sala Inferior" },
  stairs: { mapId: "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM", width: 21, height: 15, label: "Gruta da Maré · Escadarias" },
  ice: { mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM", width: 20, height: 30, label: "Gruta da Maré · Câmara de Gelo" },
} as const satisfies Record<string, GrutaDaMareSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: GrutaDaMareContext, spec: GrutaDaMareSpec) {
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
    if (primary !== GRUTA_DA_MARE_PRIMARY.toLowerCase() || secondary !== GRUTA_DA_MARE_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; ${spec.label} exige ${GRUTA_DA_MARE_PRIMARY} + ${GRUTA_DA_MARE_SECONDARY}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: `${spec.label}: preset local disponível; maré, água, gelo, itens dinâmicos, eventos e geometria funcional permanecem preservados.`,
  };
}

function fromAtlas(spec: GrutaDaMareSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({
    width,
    height,
    mapId,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  }, spec);
}

export const grutaDaMareLowEntranceGuard = (context: GrutaDaMareContext) => guard(context, SPECS.lowEntrance);
export const grutaDaMareHighEntranceGuard = (context: GrutaDaMareContext) => guard(context, SPECS.highEntrance);
export const grutaDaMareLowInnerGuard = (context: GrutaDaMareContext) => guard(context, SPECS.lowInner);
export const grutaDaMareHighInnerGuard = (context: GrutaDaMareContext) => guard(context, SPECS.highInner);
export const grutaDaMareLowerGuard = (context: GrutaDaMareContext) => guard(context, SPECS.lower);
export const grutaDaMareStairsGuard = (context: GrutaDaMareContext) => guard(context, SPECS.stairs);
export const grutaDaMareIceGuard = (context: GrutaDaMareContext) => guard(context, SPECS.ice);

export const grutaDaMareLowEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.lowEntrance, width, height, mapId, atlas);
export const grutaDaMareHighEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.highEntrance, width, height, mapId, atlas);
export const grutaDaMareLowInnerGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.lowInner, width, height, mapId, atlas);
export const grutaDaMareHighInnerGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.highInner, width, height, mapId, atlas);
export const grutaDaMareLowerGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.lower, width, height, mapId, atlas);
export const grutaDaMareStairsGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.stairs, width, height, mapId, atlas);
export const grutaDaMareIceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.ice, width, height, mapId, atlas);
