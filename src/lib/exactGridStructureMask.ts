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

function isPatternBoundary(index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

/**
 * Deriva uma máscara estrutural sem alterar o Pattern salvo. Em vez de depender
 * de uma lista curta de IDs de piso, o compilador detecta contexto pela topologia
 * do próprio recorte RAW: células caminháveis/normal/layer-0 ligadas à borda são
 * terreno, rua ou calçada capturados junto da fachada e portanto transparentes.
 *
 * IDs de piso conhecidos e IDs caminháveis observados na borda também ficam
 * transparentes quando aparecem em ilhas internas (útil para corredores do
 * Mercado). O restante permanece opaco. Patterns não-RAW continuam 100% opacos,
 * pois não carregam física suficiente para uma inferência segura.
 */
export function deriveStructureMask(
  pattern: MapPattern,
  atlas: SavedRealAtlas,
  reconstruction: AiMapReconstructionPlan,
  portMetatile: number | null,
  smartPaths: SmartPathPreset[],
) {
  const total = pattern.width * pattern.height;
  const result = new Uint8Array(total);
  if (pattern.kind !== "raw") {
    result.fill(1);
    return result;
  }

  const records = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
  const floors = groundFamily(reconstruction, portMetatile, smartPaths);
  const open = new Uint8Array(total);
  const transparent = new Uint8Array(total);
  const boundaryOpenIds = new Set<number>();
  const queue: number[] = [];

  for (let i = 0; i < total; i++) {
    const value = Number(pattern.values[i] ?? 0);
    const id = value & METATILE_MASK;
    const record = records.get(id);
    if (!record) continue;
    const collision = getCollision(rawPhysical(pattern, value));
    const behavior = record.behavior ?? 0;
    const layerType = record.layerType ?? 0;
    if (collision === 0 && behavior === 0 && layerType === 0) open[i] = 1;
  }

  const seed = (cell: number) => {
    if (!open[cell] || transparent[cell]) return;
    transparent[cell] = 1;
    queue.push(cell);
    boundaryOpenIds.add(Number(pattern.values[cell] ?? 0) & METATILE_MASK);
  };

  for (let i = 0; i < total; i++) {
    if (isPatternBoundary(i, pattern.width, pattern.height)) seed(i);
  }

  while (queue.length) {
    const cell = queue.pop()!;
    const x = cell % pattern.width;
    const y = Math.floor(cell / pattern.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= pattern.width || ny >= pattern.height) continue;
      const next = idx(nx, ny, pattern.width);
      if (!open[next] || transparent[next]) continue;
      transparent[next] = 1;
      queue.push(next);
    }
  }

  for (let i = 0; i < total; i++) {
    if (!open[i]) continue;
    const id = Number(pattern.values[i] ?? 0) & METATILE_MASK;
    if (floors.has(id) || boundaryOpenIds.has(id)) transparent[i] = 1;
  }

  let opaqueCount = 0;
  for (let i = 0; i < total; i++) {
    if (transparent[i]) continue;
    result[i] = 1;
    opaqueCount++;
  }

  // Fail-closed: um Pattern sem núcleo detectável não deve desaparecer inteiro.
  if (!opaqueCount) result.fill(1);
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
