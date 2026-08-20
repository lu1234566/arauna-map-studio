import { MAP_PATTERN_FORMAT, type MapPattern, type PatternScope } from "./patternLibrary";

const GENERAL_PETALBURG: PatternScope = {
  primary: "gTileset_General",
  secondary: "gTileset_Petalburg",
};

const CREATED_AT = "2026-08-19T00:00:00.000Z";

function starterPattern(
  id: string,
  name: string,
  tags: string[],
  width: number,
  height: number,
  values: number[],
  entranceX: number,
  entranceY: number,
): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id,
    name,
    category: "Construção · Emerald",
    tags: [...tags, "emerald", "littleroot", "starter-pack"],
    width,
    height,
    kind: "raw",
    values,
    ports: [
      { id: "entrada", name: "entrada", kind: "door", x: entranceX, y: entranceY, direction: "south" },
      { id: "saida", name: "saída", kind: "exit", x: entranceX, y: entranceY, direction: "south" },
    ],
    scope: { ...GENERAL_PETALBURG },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

/**
 * Estruturas externas extraídas do layout canônico LittlerootTown do pokeemerald.
 * Os valores RAW preservam metatile + collision/elevation exatamente como no mapa original.
 */
export function emeraldLittlerootStarterPatterns(): MapPattern[] {
  return [
    starterPattern(
      "emerald-littleroot-house-west",
      "Casa Emerald — entrada direita",
      ["casa", "casa rural", "residência", "casa do jogador", "player house"],
      5,
      5,
      [
        0x3208, 0x3209, 0x3209, 0x3209, 0x320a,
        0x0610, 0x0611, 0x0611, 0x0611, 0x0612,
        0x0618, 0x0619, 0x0619, 0x0619, 0x061a,
        0x0622, 0x0632, 0x0630, 0x0640, 0x0621,
        0x062a, 0x063a, 0x0638, 0x0648, 0x0629,
      ],
      3,
      4,
    ),
    starterPattern(
      "emerald-littleroot-house-east",
      "Casa Emerald — entrada esquerda",
      ["casa", "casa rural", "residência", "casa do rival", "rival house"],
      5,
      5,
      [
        0x3208, 0x3209, 0x3209, 0x3209, 0x320a,
        0x0610, 0x0611, 0x0611, 0x0611, 0x0612,
        0x0618, 0x0619, 0x0619, 0x0619, 0x061a,
        0x0620, 0x0640, 0x0631, 0x0632, 0x0623,
        0x0628, 0x0648, 0x0639, 0x063a, 0x062b,
      ],
      1,
      4,
    ),
    starterPattern(
      "emerald-littleroot-birch-lab",
      "Laboratório Emerald",
      ["laboratório", "laboratorio", "lab", "professora", "professor", "pesquisa"],
      7,
      5,
      [
        0x320c, 0x3242, 0x3243, 0x320d, 0x320d, 0x320d, 0x320e,
        0x0614, 0x064a, 0x064b, 0x0615, 0x0615, 0x0615, 0x0616,
        0x0614, 0x0615, 0x0615, 0x0615, 0x0615, 0x0615, 0x0616,
        0x061e, 0x060f, 0x060f, 0x062c, 0x0641, 0x062d, 0x061f,
        0x0626, 0x0617, 0x0617, 0x0634, 0x0649, 0x0635, 0x0627,
      ],
      4,
      4,
    ),
  ];
}

export function starterPatternsForScope(scope: PatternScope | undefined): MapPattern[] {
  if (!scope) return [];
  if (scope.primary !== GENERAL_PETALBURG.primary || scope.secondary !== GENERAL_PETALBURG.secondary) return [];
  return emeraldLittlerootStarterPatterns();
}
