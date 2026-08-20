import { cloneMap, getCollision, idx, METATILE_MASK, type MapData } from "./emeraldMap";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const NORMAL_GROUND_BEHAVIOR = 0x00;
const PATH_CORRIDOR_RADIUS = 2;
const STRUCTURE_INFLUENCE_RADIUS = 2;
const GREEN_EXPANSION_RADIUS = 3;
const MIN_GREEN_COMPONENT = 8;
const MAX_GREEN_ADDED_RATIO = 0.18;
const PORT_COAST_RADIUS = 3;
const PORT_IMMEDIATE_COAST_RADIUS = 1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export interface AiMapDistrictRefinementPlan {
  map: MapData;
  touched: number[];
  active: boolean;
  greenAddedCount: number;
  portPromenadeCount: number;
  pathCorridorCount: number;
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

function contextOrigin(pattern: MapPattern, kind: "green") {
  const match = pattern.id.match(new RegExp(`-${kind}-(-?\\d+)-(-?\\d+)$`, "i"));
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function markRegion(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number) {
  for (let py = Math.max(0, y); py < Math.min(map.height, y + height); py++) {
    for (let px = Math.max(0, x); px < Math.min(map.width, x + width); px++) {
      mask[idx(px, py, map.width)] = 1;
    }
  }
}

function markExpanded(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number, radius: number) {
  markRegion(mask, map, x - radius, y - radius, width + radius * 2, height + radius * 2);
}

function behaviorMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
}

function isPortPattern(pattern: MapPattern) {
  const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
  return /(porto|cais|estaleiro|terminal|harbor|ferry|mercado|oceanograf|navio)/.test(key);
}

function urbanPathFamily(smartPaths: SmartPathPreset[]) {
  const family = new Set<number>();
  for (const preset of smartPaths) {
    const key = normalize(`${preset.id} ${preset.name}`);
    if (!/(urban|via|rua|calcad|acesso)/.test(key)) continue;
    for (const raw of preset.variants ?? []) family.add(Number(raw) & METATILE_MASK);
  }
  return family;
}

function buildMasks(
  map: MapData,
  atlas: SavedRealAtlas,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  smartPaths: SmartPathPreset[],
  portMetatile: number | null,
) {
  const size = map.width * map.height;
  const preserve = new Uint8Array(size);
  const urbanInfluence = new Uint8Array(size);
  const pathCorridor = new Uint8Array(size);
  const portInfluence = new Uint8Array(size);
  const nearCoast = new Uint8Array(size);
  const immediateCoast = new Uint8Array(size);
  const behaviors = behaviorMap(atlas);
  const pathFamily = urbanPathFamily(smartPaths);

  for (const cell of reservedCells) {
    if (!inBounds(map, cell.x, cell.y)) continue;
    preserve[idx(cell.x, cell.y, map.width)] = 1;
    const radius = cell.kind === "warp" ? STRUCTURE_INFLUENCE_RADIUS : 1;
    markExpanded(urbanInfluence, map, cell.x, cell.y, 1, 1, radius);
  }

  for (const pattern of patterns) {
    const origin = originalOrigin(pattern);
    if (!origin) continue;
    markRegion(preserve, map, origin.x, origin.y, pattern.width, pattern.height);
    markExpanded(
      urbanInfluence,
      map,
      origin.x,
      origin.y,
      pattern.width,
      pattern.height,
      STRUCTURE_INFLUENCE_RADIUS,
    );
    if (isPortPattern(pattern)) {
      markExpanded(portInfluence, map, origin.x, origin.y, pattern.width, pattern.height, 4);
    }
  }

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(x, y, map.width);
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if (pathFamily.has(id)) {
        markExpanded(pathCorridor, map, x, y, 1, 1, PATH_CORRIDOR_RADIUS);
      }
      if (portMetatile != null && id === portMetatile) {
        markExpanded(portInfluence, map, x, y, 1, 1, 2);
      }
      if (!WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) continue;
      markExpanded(nearCoast, map, x, y, 1, 1, PORT_COAST_RADIUS);
      markExpanded(immediateCoast, map, x, y, 1, 1, PORT_IMMEDIATE_COAST_RADIUS);
      markExpanded(preserve, map, x, y, 1, 1, PORT_IMMEDIATE_COAST_RADIUS);
    }
  }

  return { preserve, urbanInfluence, pathCorridor, portInfluence, nearCoast, immediateCoast, behaviors, pathFamily };
}

function buildGreenSeedMask(
  map: MapData,
  patterns: MapPattern[],
  greenMetatile: number,
) {
  const seed = new Uint8Array(map.width * map.height);
  for (let i = 0; i < map.metatiles.length; i++) {
    if (((map.metatiles[i] ?? 0) & METATILE_MASK) === greenMetatile) seed[i] = 1;
  }
  for (const pattern of patterns) {
    const origin = contextOrigin(pattern, "green");
    if (!origin) continue;
    markRegion(seed, map, origin.x, origin.y, pattern.width, pattern.height);
  }
  return seed;
}

function greenExpansionMask(
  map: MapData,
  seed: Uint8Array,
  eligible: (cellIndex: number) => boolean,
) {
  const size = map.width * map.height;
  const reached = new Uint8Array(size);
  const distance = new Int16Array(size);
  distance.fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < size; i++) {
    if (!seed[i]) continue;
    distance[i] = 0;
    queue.push(i);
  }

  while (queue.length) {
    const current = queue.shift()!;
    const currentDistance = distance[current] ?? 0;
    if (currentDistance >= GREEN_EXPANSION_RADIUS) continue;
    const x = current % map.width;
    const y = Math.floor(current / map.width);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const ni = idx(nx, ny, map.width);
      if (distance[ni] >= 0) continue;
      if (!eligible(ni)) continue;
      distance[ni] = currentDistance + 1;
      reached[ni] = 1;
      queue.push(ni);
    }
  }

  return { reached, distance };
}

function connectedGreenComponents(map: MapData, mask: Uint8Array) {
  const seen = new Uint8Array(mask.length);
  const components: number[][] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const component: number[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen[current] || !mask[current]) continue;
      seen[current] = 1;
      component.push(current);
      const x = current % map.width;
      const y = Math.floor(current / map.width);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(map, nx, ny)) continue;
        const ni = idx(nx, ny, map.width);
        if (mask[ni] && !seen[ni]) queue.push(ni);
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Refino pós-Smart Path. As ruas reais já estão desenhadas, então podemos
 * recuperar bairros verdes somente longe de vias/prédios e reforçar uma pequena
 * promenade portuária entre a costa e os edifícios do porto.
 */
export function refineAiMapDistricts(
  sourceMap: MapData,
  atlas: SavedRealAtlas | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  smartPaths: SmartPathPreset[],
  reconstruction: AiMapReconstructionPlan | null,
  portMetatile: number | null,
): AiMapDistrictRefinementPlan {
  const map = cloneMap(sourceMap);
  const warnings: string[] = [];
  if (!atlas || !reconstruction || reconstruction.greenMetatile == null || reconstruction.baseMetatile == null) {
    return { map, touched: [], active: false, greenAddedCount: 0, portPromenadeCount: 0, pathCorridorCount: 0, warnings };
  }

  const masks = buildMasks(map, atlas, patterns, reservedCells, smartPaths, portMetatile);
  const greenMetatile = reconstruction.greenMetatile & METATILE_MASK;
  const baseMetatile = reconstruction.baseMetatile & METATILE_MASK;
  const urbanMetatile = reconstruction.urbanMetatile == null ? null : reconstruction.urbanMetatile & METATILE_MASK;
  const seed = buildGreenSeedMask(map, patterns, greenMetatile);

  const eligibleGreen = (cellIndex: number) => {
    if (cellIndex < 0 || cellIndex >= map.metatiles.length) return false;
    if (masks.preserve[cellIndex] || masks.urbanInfluence[cellIndex] || masks.pathCorridor[cellIndex]) return false;
    if (masks.portInfluence[cellIndex]) return false;
    if (getCollision(map.physical[cellIndex] ?? 0) !== 0) return false;
    const id = (map.metatiles[cellIndex] ?? 0) & METATILE_MASK;
    if (id !== baseMetatile) return false;
    return masks.behaviors.get(id) === NORMAL_GROUND_BEHAVIOR;
  };

  const greenPlan = greenExpansionMask(map, seed, eligibleGreen);
  const components = connectedGreenComponents(map, greenPlan.reached)
    .filter((component) => component.length >= MIN_GREEN_COMPONENT)
    .sort((a, b) => b.length - a.length);
  const maxGreenAdded = Math.max(0, Math.floor(map.metatiles.length * MAX_GREEN_ADDED_RATIO));
  const touched: number[] = [];
  let greenAddedCount = 0;

  for (const component of components) {
    if (greenAddedCount + component.length > maxGreenAdded) continue;
    for (const cellIndex of component) {
      if (!eligibleGreen(cellIndex)) continue;
      map.metatiles[cellIndex] = greenMetatile;
      touched.push(cellIndex);
      greenAddedCount++;
    }
  }

  let portPromenadeCount = 0;
  if (portMetatile != null) {
    const port = portMetatile & METATILE_MASK;
    for (let i = 0; i < map.metatiles.length; i++) {
      if (!masks.portInfluence[i] || !masks.nearCoast[i] || masks.immediateCoast[i]) continue;
      if (masks.preserve[i] || masks.pathCorridor[i]) continue;
      if (getCollision(map.physical[i] ?? 0) !== 0) continue;
      const current = (map.metatiles[i] ?? 0) & METATILE_MASK;
      const replaceable = current === baseMetatile || current === greenMetatile || (urbanMetatile != null && current === urbanMetatile);
      if (!replaceable || current === port) continue;
      if (masks.behaviors.get(current) !== NORMAL_GROUND_BEHAVIOR) continue;
      map.metatiles[i] = port;
      touched.push(i);
      portPromenadeCount++;
    }
  }

  const pathCorridorCount = masks.pathCorridor.reduce((sum, value) => sum + (value ? 1 : 0), 0);
  if (greenAddedCount || portPromenadeCount) {
    warnings.push(
      `Zonificação pós-vias: ${greenAddedCount} célula(s) ampliaram bairros verdes longe das ruas; ${portPromenadeCount} célula(s) reforçaram a promenade portuária; ${pathCorridorCount} célula(s) ficaram reservadas à circulação.`,
    );
  }

  return {
    map,
    touched,
    active: true,
    greenAddedCount,
    portPromenadeCount,
    pathCorridorCount,
    warnings,
  };
}
