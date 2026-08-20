import { getCollision, idx, METATILE_MASK, type MapData, cloneMap } from "./emeraldMap";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const NORMAL_GROUND_BEHAVIOR = 0x00;
const PORT_MARGIN = 2;
const GREEN_CONTEXT_LIMIT = 4;

export interface AiMapIdentityPlan {
  map: MapData;
  touched: number[];
  active: boolean;
  portMetatile: number | null;
  portChangedCount: number;
  greenExpandedCount: number;
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

function contextOrigin(pattern: MapPattern, kind: "green" | "coast") {
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

function markExpanded(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number, margin: number) {
  markRegion(mask, map, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

function behaviorMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
}

function isPortPattern(pattern: MapPattern) {
  const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
  return /(porto|cais|estaleiro|terminal|harbor|ferry|mercado|oceanograf|navio)/.test(key);
}

function portGroundFromPatterns(
  patterns: MapPattern[],
  behaviors: Map<number, number | null>,
  excluded: Set<number>,
) {
  const counts = new Map<number, number>();
  for (const pattern of patterns) {
    if (pattern.kind !== "raw") continue;
    const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
    const useful = isPortPattern(pattern) || pattern.id.includes("-coast-") || /trecho costeiro/.test(key);
    if (!useful) continue;
    for (const raw of pattern.values ?? []) {
      const value = Number(raw) & 0xffff;
      if (getCollision(value) !== 0) continue;
      const id = value & METATILE_MASK;
      if (!id || excluded.has(id) || behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildProtectionAndAccessMasks(
  map: MapData,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  behaviors: Map<number, number | null>,
) {
  const preserve = new Uint8Array(map.width * map.height);
  const access = new Uint8Array(map.width * map.height);

  for (const cell of reservedCells) {
    if (!inBounds(map, cell.x, cell.y)) continue;
    preserve[idx(cell.x, cell.y, map.width)] = 1;
    if (cell.kind === "warp") markExpanded(access, map, cell.x, cell.y, 1, 1, 1);
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
      if (!WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) continue;
      markExpanded(preserve, map, x, y, 1, 1, 1);
    }
  }

  return { preserve, access };
}

function buildPortMask(map: MapData, patterns: MapPattern[]) {
  const mask = new Uint8Array(map.width * map.height);
  for (const pattern of patterns) {
    if (!isPortPattern(pattern)) continue;
    const origin = originalOrigin(pattern);
    if (origin) markExpanded(mask, map, origin.x, origin.y, pattern.width, pattern.height, PORT_MARGIN);
  }
  for (const pattern of patterns) {
    const origin = contextOrigin(pattern, "coast");
    if (!origin) continue;
    markExpanded(mask, map, origin.x, origin.y, pattern.width, pattern.height, 1);
  }
  return mask;
}

function buildGreenExpansionMask(map: MapData, patterns: MapPattern[]) {
  const seed = new Uint8Array(map.width * map.height);
  let used = 0;
  for (const pattern of patterns) {
    if (used >= GREEN_CONTEXT_LIMIT) break;
    const origin = contextOrigin(pattern, "green");
    if (!origin) continue;
    markRegion(seed, map, origin.x, origin.y, pattern.width, pattern.height);
    used++;
  }

  const expanded = new Uint8Array(seed);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(x, y, map.width);
      if (!seed[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(map, nx, ny)) expanded[idx(nx, ny, map.width)] = 1;
      }
    }
  }
  return expanded;
}

/**
 * Segunda camada determinística da remodelagem: dá identidade portuária e recupera
 * blocos verdes coerentes usando apenas material já extraído do mapa real.
 * Smart Paths ainda são aplicados depois e, portanto, continuam definindo as vias.
 */
export function planAiMapIdentityBase(
  sourceMap: MapData,
  atlas: SavedRealAtlas | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  reconstruction: AiMapReconstructionPlan | null,
): AiMapIdentityPlan {
  const map = cloneMap(sourceMap);
  const warnings: string[] = [];
  if (!atlas || !reconstruction) {
    return { map, touched: [], active: false, portMetatile: null, portChangedCount: 0, greenExpandedCount: 0, warnings };
  }

  const portVocabulary = patterns.some(isPortPattern);
  if (!portVocabulary) {
    return { map, touched: [], active: false, portMetatile: null, portChangedCount: 0, greenExpandedCount: 0, warnings };
  }

  const behaviors = behaviorMap(atlas);
  const { preserve, access } = buildProtectionAndAccessMasks(sourceMap, patterns, reservedCells, behaviors);
  const port = buildPortMask(sourceMap, patterns);
  const greenExpansion = buildGreenExpansionMask(sourceMap, patterns);
  const excluded = new Set<number>();
  for (const value of [reconstruction.baseMetatile, reconstruction.urbanMetatile, reconstruction.greenMetatile]) {
    if (value != null) excluded.add(value);
  }
  const portMetatile = portGroundFromPatterns(patterns, behaviors, excluded);
  const touched: number[] = [];
  let portChangedCount = 0;
  let greenExpandedCount = 0;

  for (let i = 0; i < map.metatiles.length; i++) {
    if (preserve[i] || access[i]) continue;
    if (getCollision(map.physical[i] ?? 0) !== 0) continue;
    const current = (map.metatiles[i] ?? 0) & METATILE_MASK;
    if (behaviors.get(current) !== NORMAL_GROUND_BEHAVIOR) continue;

    let desired = current;
    if (portMetatile != null && port[i]) desired = portMetatile;
    else if (reconstruction.greenMetatile != null && greenExpansion[i]) desired = reconstruction.greenMetatile;
    if (desired === current) continue;

    map.metatiles[i] = desired;
    touched.push(i);
    if (desired === portMetatile && portMetatile != null) portChangedCount++;
    else if (desired === reconstruction.greenMetatile && reconstruction.greenMetatile != null) greenExpandedCount++;
  }

  if (portChangedCount || greenExpandedCount) {
    const portText = portMetatile != null
      ? `${portChangedCount} célula(s) receberam acento portuário 0x${portMetatile.toString(16).toUpperCase().padStart(3, "0")}`
      : "nenhum piso portuário distinto pôde ser derivado";
    warnings.push(`Identidade portuária: ${portText}; ${greenExpandedCount} célula(s) ampliaram blocos verdes reais. Vias e acessos permanecem reservados aos Smart Paths.`);
  }

  return {
    map,
    touched,
    active: true,
    portMetatile,
    portChangedCount,
    greenExpandedCount,
    warnings,
  };
}
