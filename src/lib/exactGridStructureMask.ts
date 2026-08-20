import {
  cloneMap,
  getCollision,
  idx,
  METATILE_MASK,
  PHYSICAL_MASK,
  type MapData,
} from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapBlueprint } from "./mapBlueprint";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);

export interface StructureMaskStats {
  placementCount: number;
  opaqueCount: number;
  transparentCount: number;
  restoredGroundCount: number;
  restoredRoadCount: number;
  restoredPreserveCount: number;
  normalizedPhysicalCount: number;
}

export interface StructureMaskResult {
  map: MapData;
  stats: StructureMaskStats;
  warnings: string[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function contextKind(pattern: MapPattern): "green" | "urban" | "port" | null {
  const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
  if (pattern.id.toLowerCase().includes("-green-") || /(trecho verde|vegetac|jardim)/.test(key)) return "green";
  if (pattern.id.toLowerCase().includes("-coast-") || /(trecho costeiro|porto|cais|doca)/.test(key)) return "port";
  if (pattern.id.toLowerCase().includes("-urban-") || /(trecho urbano|urbanismo|rua)/.test(key)) return "urban";
  return null;
}

function patternByReference(reference: string, patterns: MapPattern[]) {
  const direct = patterns.find((pattern) => pattern.id === reference);
  if (direct) return direct;
  const key = normalize(reference);
  const matches = patterns.filter((pattern) => normalize(pattern.name) === key);
  return matches.length === 1 ? matches[0]! : null;
}

function smartPathFamily(smartPaths: SmartPathPreset[]) {
  const family = new Set<number>();
  for (const preset of smartPaths) {
    for (const value of preset.variants ?? []) family.add(Number(value) & METATILE_MASK);
  }
  return family;
}

function groundFamily(
  reconstruction: AiMapReconstructionPlan,
  portMetatile: number | null,
  smartPaths: SmartPathPreset[],
) {
  const ids = smartPathFamily(smartPaths);
  for (const id of [
    reconstruction.baseMetatile,
    reconstruction.urbanMetatile,
    reconstruction.greenMetatile,
    portMetatile,
  ]) {
    if (id != null) ids.add(id & METATILE_MASK);
  }
  return ids;
}

function rawPhysical(pattern: MapPattern, value: number) {
  return pattern.kind === "raw" ? value & PHYSICAL_MASK : 0;
}

function connectedComponents(mask: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(mask.length);
  const components: number[][] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const component: number[] = [];
    seen[start] = 1;
    while (queue.length) {
      const current = queue.pop()!;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = idx(nx, ny, width);
          if (!mask[next] || seen[next]) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function distanceToPorts(cell: number, pattern: MapPattern) {
  const ports = pattern.ports ?? [];
  if (!ports.length) return Number.POSITIVE_INFINITY;
  const x = cell % pattern.width;
  const y = Math.floor(cell / pattern.width);
  return Math.min(...ports.map((port) => Math.max(Math.abs(x - port.x), Math.abs(y - port.y))));
}

/**
 * Deriva uma máscara estrutural sem alterar o Pattern salvo. Células de terreno,
 * rua e calçada capturadas junto da fachada viram transparentes no Exact Grid.
 * O núcleo é ancorado por metatiles não-solo, colisão/layering e pelas portas.
 */
export function deriveStructureMask(
  pattern: MapPattern,
  atlas: SavedRealAtlas,
  reconstruction: AiMapReconstructionPlan,
  portMetatile: number | null,
  smartPaths: SmartPathPreset[],
) {
  const total = pattern.width * pattern.height;
  const hard = new Uint8Array(total);
  const result = new Uint8Array(total);
  const records = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
  const floors = groundFamily(reconstruction, portMetatile, smartPaths);
  const marketLike = /(mercado|market|feira|fixed-origin)/.test(
    normalize(`${pattern.id} ${pattern.name} ${(pattern.tags ?? []).join(" ")}`),
  );

  for (let i = 0; i < total; i++) {
    const value = Number(pattern.values[i] ?? 0);
    const id = value & METATILE_MASK;
    const record = records.get(id);
    const collision = getCollision(rawPhysical(pattern, value));
    const behavior = record?.behavior ?? 0;
    const layerType = record?.layerType ?? 0;
    const likelyFloor = floors.has(id) && collision === 0 && behavior === 0 && layerType === 0;
    if (!likelyFloor && (collision > 0 || behavior !== 0 || layerType > 0 || !floors.has(id))) hard[i] = 1;
  }

  const components = connectedComponents(hard, pattern.width, pattern.height);
  const largest = Math.max(0, ...components.map((component) => component.length));
  const selected = components.filter((component) => {
    if (marketLike) return true;
    const nearPort = component.some((cell) => distanceToPorts(cell, pattern) <= 4);
    const meaningful = component.length >= Math.max(2, Math.ceil(largest * 0.2));
    return nearPort || meaningful;
  });

  for (const component of selected) {
    for (const cell of component) {
      const x = cell % pattern.width;
      const y = Math.floor(cell / pattern.width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= pattern.width || ny >= pattern.height) continue;
          result[idx(nx, ny, pattern.width)] = 1;
        }
      }
    }
  }

  for (const port of pattern.ports ?? []) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = port.x + dx;
        const y = port.y + dy;
        if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) continue;
        result[idx(x, y, pattern.width)] = 1;
      }
    }
  }

  if (!result.some(Boolean)) result.fill(1);
  return result;
}

function canonicalPhysicalByMetatile(sourceMap: MapData) {
  const counts = new Map<number, Map<number, number>>();
  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    const physical = (sourceMap.physical[i] ?? 0) & PHYSICAL_MASK;
    if (getCollision(physical) !== 0) continue;
    const byPhysical = counts.get(id) ?? new Map<number, number>();
    byPhysical.set(physical, (byPhysical.get(physical) ?? 0) + 1);
    counts.set(id, byPhysical);
  }
  const result = new Map<number, number>();
  for (const [id, byPhysical] of counts) {
    let bestPhysical = 0;
    let bestCount = -1;
    for (const [physical, count] of byPhysical) {
      if (count > bestCount || (count === bestCount && physical < bestPhysical)) {
        bestPhysical = physical;
        bestCount = count;
      }
    }
    result.set(id, bestPhysical);
  }
  return result;
}

function finalZoneKindAt(layered: LayeredBasePlan, x: number, y: number) {
  let kind: "ground" | "road" = "ground";
  for (const zone of layered.parsed.zones) {
    if (x < zone.x1 || x > zone.x2 || y < zone.y1 || y > zone.y2) continue;
    kind = zone.kind;
  }
  return kind;
}

function protectedByWaterOrCoast(sourceMap: MapData, atlas: SavedRealAtlas) {
  const result = new Uint8Array(sourceMap.width * sourceMap.height);
  const behavior = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record.behavior]));
  for (let y = 0; y < sourceMap.height; y++) {
    for (let x = 0; x < sourceMap.width; x++) {
      const i = idx(x, y, sourceMap.width);
      const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
      if (!WATER_BEHAVIORS.has(behavior.get(id) ?? -1)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= sourceMap.width || py >= sourceMap.height) continue;
          result[idx(px, py, sourceMap.width)] = 1;
        }
      }
    }
  }
  return result;
}

export function applyExactGridStructureMasks(args: {
  map: MapData;
  sourceMap: MapData;
  layered: LayeredBasePlan;
  blueprint: MapBlueprint;
  patterns: MapPattern[];
  atlas: SavedRealAtlas;
  reconstruction: AiMapReconstructionPlan;
  portMetatile: number | null;
  smartPaths: SmartPathPreset[];
  reservedCells: AiReservedCell[];
}): StructureMaskResult {
  const {
    sourceMap,
    layered,
    blueprint,
    patterns,
    atlas,
    reconstruction,
    portMetatile,
    smartPaths,
    reservedCells,
  } = args;
  const map = cloneMap(args.map);
  const opaque = new Uint8Array(map.width * map.height);
  const footprint = new Uint8Array(map.width * map.height);
  const pathIds = smartPathFamily(smartPaths);
  const canonical = canonicalPhysicalByMetatile(sourceMap);
  const coast = protectedByWaterOrCoast(sourceMap, atlas);
  const reserved = new Uint8Array(map.width * map.height);
  for (const cell of reservedCells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) continue;
    reserved[idx(cell.x, cell.y, map.width)] = 1;
  }

  let placementCount = 0;
  for (const placement of blueprint.patterns ?? []) {
    const pattern = patternByReference(placement.pattern, patterns);
    if (!pattern || contextKind(pattern)) continue;
    placementCount++;
    const mask = deriveStructureMask(pattern, atlas, reconstruction, portMetatile, smartPaths);
    for (let py = 0; py < pattern.height; py++) {
      for (let px = 0; px < pattern.width; px++) {
        const x = placement.x + px;
        const y = placement.y + py;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const target = idx(x, y, map.width);
        footprint[target] = 1;
        if (mask[idx(px, py, pattern.width)]) opaque[target] = 1;
      }
    }
  }

  let opaqueCount = 0;
  let transparentCount = 0;
  let restoredGroundCount = 0;
  let restoredRoadCount = 0;
  let restoredPreserveCount = 0;
  let normalizedPhysicalCount = 0;

  for (let i = 0; i < map.metatiles.length; i++) {
    if (opaque[i]) {
      layered.occupancy[i] = LAYER_OCCUPANCY.structure;
      opaqueCount++;
      continue;
    }
    if (!footprint[i] || layered.occupancy[i] !== LAYER_OCCUPANCY.structure) continue;
    transparentCount++;
    const x = i % map.width;
    const y = Math.floor(i / map.width);

    if (reserved[i] || coast[i]) {
      map.metatiles[i] = sourceMap.metatiles[i] ?? 0;
      map.physical[i] = sourceMap.physical[i] ?? 0;
      layered.occupancy[i] = LAYER_OCCUPANCY.reserved;
      restoredPreserveCount++;
      continue;
    }

    const current = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const beforeTemplate = (layered.map.metatiles[i] ?? 0) & METATILE_MASK;
    if (pathIds.has(current) && current !== beforeTemplate) {
      layered.occupancy[i] = LAYER_OCCUPANCY.road;
      const targetPhysical = canonical.get(current) ?? 0;
      if ((map.physical[i] ?? 0) !== targetPhysical) {
        map.physical[i] = targetPhysical;
        normalizedPhysicalCount++;
      }
      restoredRoadCount++;
      continue;
    }

    const desired = layered.materialByCell[i] ?? -1;
    if (desired < 0) {
      map.metatiles[i] = sourceMap.metatiles[i] ?? 0;
      map.physical[i] = sourceMap.physical[i] ?? 0;
      layered.occupancy[i] = LAYER_OCCUPANCY.reserved;
      restoredPreserveCount++;
      continue;
    }

    const zoneKind = finalZoneKindAt(layered, x, y);
    map.metatiles[i] = desired & METATILE_MASK;
    map.physical[i] = canonical.get(desired & METATILE_MASK) ?? 0;
    layered.occupancy[i] = zoneKind === "road" ? LAYER_OCCUPANCY.road : LAYER_OCCUPANCY.base;
    if (zoneKind === "road") restoredRoadCount++;
    else restoredGroundCount++;
  }

  for (let i = 0; i < map.metatiles.length; i++) {
    const owner = layered.occupancy[i];
    if (owner !== LAYER_OCCUPANCY.base && owner !== LAYER_OCCUPANCY.road) continue;
    const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const targetPhysical = canonical.get(id) ?? 0;
    if ((map.physical[i] ?? 0) === targetPhysical) continue;
    map.physical[i] = targetPhysical;
    normalizedPhysicalCount++;
  }

  const stats = {
    placementCount,
    opaqueCount,
    transparentCount,
    restoredGroundCount,
    restoredRoadCount,
    restoredPreserveCount,
    normalizedPhysicalCount,
  };
  const warnings = [
    `Máscara estrutural Exact Grid: ${placementCount} estrutura(s), ${opaqueCount} célula(s) opacas e ${transparentCount} célula(s) de contexto transparentes; ${restoredGroundCount} voltaram ao solo, ${restoredRoadCount} às vias e ${restoredPreserveCount} foram preservadas.`,
    `Física determinística: ${normalizedPhysicalCount} célula(s) ground/road receberam a física canônica do metatile observado no mapa real.`,
  ];
  return { map, stats, warnings };
}
