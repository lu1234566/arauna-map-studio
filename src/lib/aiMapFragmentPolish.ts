import { cloneMap, COLLISION_MASK, getCollision, idx, METATILE_MASK, type MapData } from "./emeraldMap";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const MAX_CONTEXT_FRAGMENT_CLUSTER = 6;
const MAX_LAYERED_FRAGMENT_CLUSTER = 3;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

type NeighborProfile = Array<Set<number>>;

export interface AiMapFragmentPolishResult {
  map: MapData;
  touched: number[];
  clearedCount: number;
  layeredPreservedCount: number;
  warnings: string[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inBounds(map: MapData, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function coordinateTag(pattern: MapPattern, prefix: string) {
  for (const tag of pattern.tags ?? []) {
    const match = tag.match(new RegExp(`^${prefix}:\\s*(-?\\d+)\\s*,\\s*(-?\\d+)$`, "i"));
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
  }
  return null;
}

function originalOrigin(pattern: MapPattern) {
  const fixed = coordinateTag(pattern, "fixed-origin");
  if (fixed) return fixed;
  const anchor = coordinateTag(pattern, "warp-anchor");
  if (!anchor) return null;
  const port = (pattern.ports ?? []).find((candidate) => (
    candidate.id === "entrada" || normalize(candidate.name) === "entrada"
  ));
  if (!port) return null;
  return { x: anchor.x - port.x, y: anchor.y - port.y };
}

function markRegion(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number) {
  for (let py = Math.max(0, y); py < Math.min(map.height, y + height); py++) {
    for (let px = Math.max(0, x); px < Math.min(map.width, x + width); px++) {
      mask[idx(px, py, map.width)] = 1;
    }
  }
}

function markExpanded(mask: Uint8Array, map: MapData, x: number, y: number, margin: number) {
  markRegion(mask, map, x - margin, y - margin, 1 + margin * 2, 1 + margin * 2);
}

function isContextPattern(pattern: MapPattern) {
  if (pattern.kind !== "raw") return false;
  const tags = (pattern.tags ?? []).map(normalize);
  const extracted = tags.includes("extraido do mapa");
  if (!extracted) return false;
  const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${tags.join(" ")}`);
  return /(-urban-|trecho urbano|-green-|trecho verde|vegetac|jardim)/.test(key)
    && !/(-coast-|trecho costeiro|costa|litoral)/.test(key);
}

function buildContextProfiles(patterns: MapPattern[]) {
  const profiles = new Map<number, NeighborProfile>();
  const family = new Set<number>();
  const ensure = (id: number) => {
    let profile = profiles.get(id);
    if (!profile) {
      profile = [new Set<number>(), new Set<number>(), new Set<number>(), new Set<number>()];
      profiles.set(id, profile);
    }
    return profile;
  };

  for (const pattern of patterns.filter(isContextPattern)) {
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const at = y * pattern.width + x;
        const id = (Number(pattern.values[at] ?? 0) & 0xffff) & METATILE_MASK;
        if (!id) continue;
        family.add(id);
        const profile = ensure(id);
        for (let d = 0; d < DIRS.length; d++) {
          const [dx, dy] = DIRS[d]!;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= pattern.width || ny >= pattern.height) continue;
          const neighbor = (Number(pattern.values[ny * pattern.width + nx] ?? 0) & 0xffff) & METATILE_MASK;
          if (neighbor) profile[d]!.add(neighbor);
        }
      }
    }
  }
  return { profiles, family };
}

function buildProtectionMask(
  map: MapData,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  behaviors: Map<number, number | null>,
) {
  const preserve = new Uint8Array(map.width * map.height);
  for (const cell of reservedCells) {
    if (!inBounds(map, cell.x, cell.y)) continue;
    markExpanded(preserve, map, cell.x, cell.y, 1);
  }
  for (const pattern of patterns) {
    const origin = originalOrigin(pattern);
    if (!origin) continue;
    markRegion(preserve, map, origin.x, origin.y, pattern.width, pattern.height);
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(x, y, map.width);
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if (WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) markExpanded(preserve, map, x, y, 1);
    }
  }
  return preserve;
}

function localSurfaceReplacement(map: MapData, x: number, y: number, surfaces: Set<number>, fallback: number) {
  const counts = new Map<number, number>();
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(map, nx, ny)) continue;
    const id = (map.metatiles[idx(nx, ny, map.width)] ?? 0) & METATILE_MASK;
    if (!surfaces.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

/**
 * Polimento pós-composição. Usa as relações de vizinhança observadas nos patches
 * reais para detectar apenas pequenos fragmentos contextuais que perderam todo o
 * suporte gráfico. Layer Type não é achatado: metatiles layered só são removidos
 * quando têm perfil forte (>=3 direções), suporte zero e formam cluster minúsculo.
 */
export function polishAiMapFragments(
  sourceMap: MapData,
  atlas: SavedRealAtlas | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  surfaceMetatiles: Array<number | null | undefined>,
): AiMapFragmentPolishResult {
  const map = cloneMap(sourceMap);
  const warnings: string[] = [];
  if (!atlas) return { map, touched: [], clearedCount: 0, layeredPreservedCount: 0, warnings };

  const behaviors = new Map((atlas.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
  const layers = new Map((atlas.records ?? []).map((record) => [record.id & METATILE_MASK, record.layerType]));
  const { profiles, family } = buildContextProfiles(patterns);
  if (!family.size) return { map, touched: [], clearedCount: 0, layeredPreservedCount: 0, warnings };

  const surfaces = new Set(surfaceMetatiles.filter((value): value is number => value != null).map((value) => value & METATILE_MASK));
  const fallback = [...surfaces][0] ?? 0;
  const preserve = buildProtectionMask(map, patterns, reservedCells, behaviors);
  const orphan = new Uint8Array(map.width * map.height);
  let layeredPreservedCount = 0;

  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const i = idx(x, y, map.width);
      if (preserve[i]) continue;
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if (!id || surfaces.has(id) || !family.has(id) || WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) continue;
      const profile = profiles.get(id);
      if (!profile) continue;

      let informative = 0;
      let support = 0;
      for (let d = 0; d < DIRS.length; d++) {
        const expected = profile[d]!;
        if (!expected.size) continue;
        informative++;
        const [dx, dy] = DIRS[d]!;
        const neighbor = (map.metatiles[idx(x + dx, y + dy, map.width)] ?? 0) & METATILE_MASK;
        if (expected.has(neighbor)) support++;
      }
      if (informative < 2) continue;

      const layered = (layers.get(id) ?? 0) > 0;
      const looksOrphan = layered ? informative >= 3 && support === 0 : support === 0;
      if (looksOrphan) orphan[i] = 1;
      else if (layered) layeredPreservedCount++;
    }
  }

  const seen = new Uint8Array(map.width * map.height);
  const touched: number[] = [];
  let clearedCount = 0;

  for (let start = 0; start < orphan.length; start++) {
    if (!orphan[start] || seen[start]) continue;
    const queue = [start];
    const component: number[] = [];
    let safe = true;
    let layered = false;

    while (queue.length) {
      const current = queue.shift()!;
      if (seen[current] || !orphan[current]) continue;
      seen[current] = 1;
      component.push(current);
      const x = current % map.width;
      const y = Math.floor(current / map.width);
      const id = (map.metatiles[current] ?? 0) & METATILE_MASK;
      layered ||= (layers.get(id) ?? 0) > 0;

      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(map, nx, ny)) {
          safe = false;
          continue;
        }
        const ni = idx(nx, ny, map.width);
        if (preserve[ni]) safe = false;
        const neighborId = (map.metatiles[ni] ?? 0) & METATILE_MASK;
        if (WATER_BEHAVIORS.has(behaviors.get(neighborId) ?? -1)) safe = false;
        if (family.has(neighborId) && !orphan[ni] && !surfaces.has(neighborId)) safe = false;
        if (orphan[ni] && !seen[ni]) queue.push(ni);
      }
    }

    const limit = layered ? MAX_LAYERED_FRAGMENT_CLUSTER : MAX_CONTEXT_FRAGMENT_CLUSTER;
    if (!safe || !component.length || component.length > limit) continue;

    for (const cellIndex of component) {
      const x = cellIndex % map.width;
      const y = Math.floor(cellIndex / map.width);
      const replacement = localSurfaceReplacement(map, x, y, surfaces, fallback);
      if (!replacement) continue;
      map.metatiles[cellIndex] = replacement;
      map.physical[cellIndex] = ((map.physical[cellIndex] ?? 0) & ~COLLISION_MASK) & 0xffff;
      touched.push(cellIndex);
      clearedCount++;
    }
  }

  if (clearedCount || layeredPreservedCount) {
    warnings.push(`Polimento de vizinhança: ${clearedCount} fragmento(s) órfão(s) removido(s); ${layeredPreservedCount} metatile(s) layered com suporte contextual foram preservados.`);
  }

  return { map, touched, clearedCount, layeredPreservedCount, warnings };
}
