import { idx, type MapData } from "./emeraldMap";
import { getPhysicalLayerValue } from "./physicalMap";

/**
 * Semântica de passagem auditável.
 *
 * O Emerald não resolve passabilidade só com collision=0: o metatile behavior
 * decide água, ledges, encontros e comportamentos especiais. Este módulo é
 * deliberadamente conservador — quando não há certeza, devolve "unknown" ou
 * "conditional" em vez de afirmar que a célula é caminhável.
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

/** Behaviors do pokeemerald cuja caminhabilidade em solo é conhecida. */
const WALKABLE_BEHAVIORS = new Set([
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
  0x0e, // MB_SECRET_BASE_(hole/exits) — piso
  0x10, // MB_SHALLOW_WATER (atravessável a pé)
]);

/** Faixa de behaviors de água/corrente: depende de Surf, nunca é caminhável a pé. */
function isWaterBehavior(behavior: number): boolean {
  return behavior >= 0x11 && behavior <= 0x2f;
}

export function classifyBehavior(behavior: number | null | undefined): Passability {
  if (behavior == null || !Number.isInteger(behavior)) return "unknown";
  if (WALKABLE_BEHAVIORS.has(behavior)) return "passable";
  if (isWaterBehavior(behavior)) return "conditional";
  return "unknown";
}

function behaviorFor(
  metatile: number,
  atlas: PassabilityAtlas | null | undefined,
): { behavior: number | null; known: boolean } {
  if (!atlas) return { behavior: null, known: false };
  const record = atlas.records.find((candidate) => candidate.id === metatile);
  if (!record) return { behavior: null, known: false };
  return { behavior: record.behavior ?? null, known: true };
}

export function cellPassability(
  map: MapData,
  x: number,
  y: number,
  atlas?: PassabilityAtlas | null,
): PassabilityResult {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return { state: "blocked", reason: "fora do mapa", collision: 0, elevation: 0, behavior: null };
  }
  const i = idx(x, y, map.width);
  const physical = map.physical[i] ?? 0;
  const collision = getPhysicalLayerValue(physical, "collision");
  const elevation = getPhysicalLayerValue(physical, "elevation");
  const metatile = map.metatiles[i] ?? 0;
  const { behavior, known } = behaviorFor(metatile, atlas);

  if (collision > 0) {
    return { state: "blocked", reason: `collision=${collision}`, collision, elevation, behavior };
  }

  if (!known) {
    return {
      state: atlas ? "unknown" : "passable",
      reason: atlas
        ? `metatile ${metatile} ausente no atlas ativo — behavior desconhecido`
        : "collision=0 e nenhum atlas carregado para checar behavior",
      collision,
      elevation,
      behavior,
    };
  }

  const classified = classifyBehavior(behavior);
  if (classified === "passable") {
    return { state: "passable", reason: `collision=0, behavior 0x${(behavior ?? 0).toString(16)}`, collision, elevation, behavior };
  }
  if (classified === "conditional") {
    return {
      state: "conditional",
      reason: `behavior 0x${(behavior ?? 0).toString(16)} depende de Surf/corrente`,
      collision,
      elevation,
      behavior,
    };
  }
  return {
    state: "unknown",
    reason: `behavior 0x${(behavior ?? 0).toString(16)} sem regra segura de passagem`,
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
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      states[idx(x, y, map.width)] = cellPassability(map, x, y, atlas).state;
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
        if (neighbour < 0) continue;
        if (labels[neighbour] !== -1) continue;
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

export const STRICT_PASSABLE: ReadonlySet<Passability> = new Set<Passability>(["passable"]);
export const LENIENT_PASSABLE: ReadonlySet<Passability> = new Set<Passability>([
  "passable",
  "conditional",
  "unknown",
]);
