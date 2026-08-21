import { idx, type MapData } from "./emeraldMap";
import { getPhysicalLayerValue } from "./physicalMap";

/**
 * Passabilidade conservadora para auditoria do mapa.
 *
 * Regra de segurança: collision > 0 é bloqueio físico inequívoco para um
 * spawn/NPC comum. collision=0, sozinho, NÃO prova que o jogador pode andar:
 * behavior pode representar água, ledge, movimento forçado, warp, etc.
 */
export type Passability = "passable" | "blocked" | "conditional" | "unknown";

export interface PassabilityResult {
  state: Passability;
  reason: string;
  collision: number;
  elevation: number;
  behavior: number | null;
}

export interface PassabilityAtlasRecord {
  id: number;
  behavior?: number | null;
  layerType?: number | null;
}

export interface PassabilityAtlas {
  records: PassabilityAtlasRecord[];
}

/*
 * Valores confirmados pela ordem de include/constants/metatile_behaviors.h do
 * pokeemerald. Mantemos somente casos seguros para não gerar falso PASS.
 */
const SAFE_WALKABLE_BEHAVIORS = new Set<number>([
  0x00, // MB_NORMAL
  0x02, // MB_TALL_GRASS
  0x03, // MB_LONG_GRASS
  0x06, // MB_DEEP_SAND
  0x07, // MB_SHORT_GRASS
  0x08, // MB_CAVE
  0x09, // MB_LONG_GRASS_SOUTH_EDGE
  0x0a, // MB_NO_RUNNING
  0x0b, // MB_INDOOR_ENCOUNTER
  0x0c, // MB_MOUNTAIN_TOP
  0x16, // MB_PUDDLE
  0x17, // MB_SHALLOW_WATER
  0x20, // MB_ICE (movimento especial, mas ocupável)
  0x21, // MB_SAND
  0x24, // MB_ASHGRASS
  0x25, // MB_FOOTPRINTS
  0x26, // MB_THIN_ICE
  0x27, // MB_CRACKED_ICE
  0x28, // MB_HOT_SPRINGS
]);

const SURFABLE_OR_WATER_BEHAVIORS = new Set<number>([
  0x10, // MB_POND_WATER
  0x11, // MB_INTERIOR_DEEP_WATER
  0x12, // MB_DEEP_WATER
  0x13, // MB_WATERFALL
  0x14, // MB_SOOTOPOLIS_DEEP_WATER
  0x15, // MB_OCEAN_WATER
  0x19, // MB_NO_SURFACING
  0x22, // MB_SEAWEED
  0x2a, // MB_SEAWEED_NO_SURFACING
  0x50, // MB_EASTWARD_CURRENT
  0x51, // MB_WESTWARD_CURRENT
  0x52, // MB_NORTHWARD_CURRENT
  0x53, // MB_SOUTHWARD_CURRENT
]);

const OCCUPIABLE_SPECIAL_BEHAVIORS = new Set<number>([
  0x0d, // MB_BATTLE_PYRAMID_WARP
  0x0e, // MB_MOSSDEEP_GYM_WARP
  0x0f, // MB_MT_PYRE_HOLE
  0x1b, // MB_STAIRS_OUTSIDE_ABANDONED_SHIP
  0x1c, // MB_SHOAL_CAVE_ENTRANCE
  0x60, // MB_NON_ANIMATED_DOOR
  0x61, // MB_LADDER
  0x62, // MB_EAST_ARROW_WARP
  0x63, // MB_WEST_ARROW_WARP
  0x64, // MB_NORTH_ARROW_WARP
  0x65, // MB_SOUTH_ARROW_WARP
  0x66, // MB_CRACKED_FLOOR_HOLE
  0x67, // MB_AQUA_HIDEOUT_WARP
  0x68, // MB_LAVARIDGE_GYM_1F_WARP
  0x69, // MB_ANIMATED_DOOR
  0x6a, // MB_UP_ESCALATOR
  0x6b, // MB_DOWN_ESCALATOR
]);

export function classifyBehavior(behavior: number | null | undefined): Passability {
  if (behavior == null || !Number.isInteger(behavior)) return "unknown";
  if (SURFABLE_OR_WATER_BEHAVIORS.has(behavior)) return "conditional";
  if (OCCUPIABLE_SPECIAL_BEHAVIORS.has(behavior)) return "conditional";
  if (SAFE_WALKABLE_BEHAVIORS.has(behavior)) return "passable";
  return "unknown";
}

function recordMap(atlas: PassabilityAtlas | null | undefined) {
  return atlas ? new Map(atlas.records.map((record) => [record.id, record])) : null;
}

export function cellPassability(
  map: MapData,
  x: number,
  y: number,
  atlas?: PassabilityAtlas | null,
  records = recordMap(atlas),
): PassabilityResult {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return {
      state: "blocked",
      reason: "fora do mapa",
      collision: 0,
      elevation: 0,
      behavior: null,
    };
  }

  const i = idx(x, y, map.width);
  const physical = map.physical[i] ?? 0;
  const collision = getPhysicalLayerValue(physical, "collision");
  const elevation = getPhysicalLayerValue(physical, "elevation");
  const metatile = map.metatiles[i] ?? 0;
  const record = records?.get(metatile);
  const behavior = record?.behavior ?? null;

  if (collision > 0) {
    return {
      state: "blocked",
      reason: `collision=${collision}`,
      collision,
      elevation,
      behavior,
    };
  }

  if (!atlas) {
    return {
      state: "unknown",
      reason: "collision=0, mas nenhum atlas real está carregado para confirmar o behavior",
      collision,
      elevation,
      behavior: null,
    };
  }

  if (!record) {
    return {
      state: "unknown",
      reason: `metatile 0x${metatile.toString(16).padStart(3, "0")} ausente no atlas ativo`,
      collision,
      elevation,
      behavior: null,
    };
  }

  const state = classifyBehavior(behavior);
  return {
    state,
    reason:
      state === "passable"
        ? `collision=0; behavior 0x${(behavior ?? 0).toString(16)} confirmado como ocupável`
        : state === "conditional"
          ? `behavior 0x${(behavior ?? 0).toString(16)} exige regra especial (água/warp/movimento)`
          : `behavior 0x${(behavior ?? 0).toString(16)} sem regra segura no auditor`,
    collision,
    elevation,
    behavior,
  };
}

export interface PassabilityGrid {
  width: number;
  height: number;
  states: Passability[];
  at(x: number, y: number): Passability;
}

export function buildPassabilityGrid(
  map: MapData,
  atlas?: PassabilityAtlas | null,
): PassabilityGrid {
  const states: Passability[] = new Array(map.width * map.height);
  const records = recordMap(atlas);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      states[idx(x, y, map.width)] = cellPassability(map, x, y, atlas, records).state;
    }
  }
  return {
    width: map.width,
    height: map.height,
    states,
    at(x: number, y: number) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "blocked";
      return states[idx(x, y, map.width)] ?? "unknown";
    },
  };
}

/** Componentes conexos 4-direções sobre os estados aceitos. */
export function connectedComponents(
  grid: PassabilityGrid,
  accepted: ReadonlySet<Passability>,
): Int32Array {
  const size = grid.width * grid.height;
  const labels = new Int32Array(size).fill(-1);
  let next = 0;
  for (let start = 0; start < size; start++) {
    if (labels[start] !== -1) continue;
    if (!accepted.has(grid.states[start] ?? "unknown")) continue;
    const stack = [start];
    labels[start] = next;
    while (stack.length) {
      const current = stack.pop()!;
      const x = current % grid.width;
      const y = (current / grid.width) | 0;
      const neighbours = [
        x > 0 ? current - 1 : -1,
        x < grid.width - 1 ? current + 1 : -1,
        y > 0 ? current - grid.width : -1,
        y < grid.height - 1 ? current + grid.width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || labels[neighbour] !== -1) continue;
        if (!accepted.has(grid.states[neighbour] ?? "unknown")) continue;
        labels[neighbour] = next;
        stack.push(neighbour);
      }
    }
    next++;
  }
  return labels;
}

export function largestComponentLabel(labels: Int32Array): number {
  const counts = new Map<number, number>();
  for (const label of labels) {
    if (label < 0) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best = -1;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

export function componentAt(labels: Int32Array, width: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= width) return -1;
  return labels[idx(x, y, width)] ?? -1;
}

export const STRICT_PASSABLE: ReadonlySet<Passability> = new Set<Passability>(["passable"]);
export const LENIENT_PASSABLE: ReadonlySet<Passability> = new Set<Passability>([
  "passable",
  "conditional",
  "unknown",
]);
