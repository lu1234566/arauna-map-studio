import { getCollision, idx, METATILE_MASK, rawValue, type MapData } from "./emeraldMap";
import { MAP_PATTERN_FORMAT, type MapPattern, type PatternScope } from "./patternLibrary";
import { SMART_PATH_FORMAT, type SmartPathPreset } from "./smartPath";
import type { SavedRealAtlas } from "./realAtlasStore";

export interface VocabularyMapEvent {
  source: string;
  sourceIndex: number;
  x: number;
  y: number;
  detail: string;
}

interface SemanticSpec {
  name: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
}

// Valores oficiais de include/constants/metatile_behaviors.h:
// MB_POND_WATER (0x10) ... MB_SHALLOW_WATER (0x17).
const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
// Pisos comuns nos mapas externos de Emerald. O filtro de colisão continua
// sendo a primeira barreira; behavior só ajuda a evitar portas/efeitos.
const WALKABLE_BEHAVIORS = new Set([
  0x00, // normal
  0x02, 0x03, // tall/long grass
  0x06, 0x07, // deep sand / short grass
  0x08, 0x09, 0x0a, // cave / long-grass edge / no running
  0x20, 0x21, 0x22, // ice / sand / seaweed
  0x24, 0x25, // ashgrass / footprints
]);

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "mapa";
}

function destinationFromDetail(detail: string) {
  const match = detail.match(/→\s*([^·]+)/u);
  return match?.[1]?.trim() || "DESTINO_DESCONHECIDO";
}

function semanticForDestination(destination: string): SemanticSpec {
  const key = destination.toUpperCase();
  if (key.includes("POKEMON_CENTER")) {
    return { name: "Centro Pokémon", category: "Serviço · Emerald", tags: ["centro pokemon", "pokemon center", "cura", "serviço"], width: 9, height: 7 };
  }
  if (key.includes("POKEMART") || key.includes("MART")) {
    return { name: "Poké Mart", category: "Comércio · Emerald", tags: ["poke mart", "pokemart", "loja", "comércio"], width: 9, height: 7 };
  }
  if (key.includes("OCEANIC_MUSEUM") || key.includes("MUSEUM")) {
    return { name: "Museu Oceanográfico", category: "Marco · Porto", tags: ["museu", "museu oceanografico", "pesquisa", "mar", "porto do sal"], width: 11, height: 8 };
  }
  if (key.includes("SHIPYARD")) {
    return { name: "Estaleiro", category: "Porto · Emerald", tags: ["estaleiro", "porto", "navio", "cais", "engenharia"], width: 11, height: 8 };
  }
  if (key.includes("BATTLE_TENT")) {
    return { name: "Tenda de Batalha", category: "Marco · Emerald", tags: ["tenda de batalha", "battle tent", "batalha"], width: 11, height: 8 };
  }
  if (key.includes("POKEMON_FAN_CLUB") || key.includes("FAN_CLUB")) {
    return { name: "Clube de Fãs de Pokémon", category: "Civil · Emerald", tags: ["clube", "fãs", "pokemon fan club", "civil"], width: 9, height: 7 };
  }
  if (key.includes("NAME_RATER")) {
    return { name: "Casa do Avaliador de Nomes", category: "Residência · Emerald", tags: ["casa", "avaliador de nomes", "name rater", "residência"], width: 7, height: 6 };
  }
  if (key.includes("HARBOR") || key.includes("FERRY")) {
    return { name: "Terminal do Cais", category: "Porto · Emerald", tags: ["porto", "cais", "terminal", "barco", "ferry"], width: 11, height: 8 };
  }
  if (key.includes("HOUSE")) {
    return { name: "Residência", category: "Residência · Emerald", tags: ["casa", "residência", "bairro", "moradia"], width: 7, height: 6 };
  }
  return { name: "Edifício com entrada", category: "Construção · Emerald", tags: ["edifício", "entrada", "construção"], width: 9, height: 7 };
}

function behaviorMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
}

function inBounds(map: MapData, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function cropRaw(map: MapData, left: number, top: number, width: number, height: number) {
  const x0 = Math.max(0, Math.min(map.width - 1, left));
  const y0 = Math.max(0, Math.min(map.height - 1, top));
  const x1 = Math.max(x0 + 1, Math.min(map.width, left + width));
  const y1 = Math.max(y0 + 1, Math.min(map.height, top + height));
  const values: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) values.push(rawValue(map, idx(x, y, map.width)));
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, values };
}

/**
 * A porta/warp costuma ficar na base do prédio. Tentamos encontrar o bloco
 * colidível conectado logo acima dela e usamos seu bounding box (+ margem).
 * Se o prédio não puder ser inferido com segurança, voltamos ao crop semântico.
 */
function detectBuildingRegion(
  map: MapData,
  doorX: number,
  doorY: number,
  fallbackWidth: number,
  fallbackHeight: number,
) {
  const minX = Math.max(0, doorX - 8);
  const maxX = Math.min(map.width - 1, doorX + 8);
  const minY = Math.max(0, doorY - 11);
  const maxY = Math.min(map.height - 1, doorY);
  const blocked = (x: number, y: number) => (
    x >= minX && x <= maxX && y >= minY && y <= maxY &&
    getCollision(map.physical[idx(x, y, map.width)] ?? 0) !== 0
  );

  const queue: Array<{ x: number; y: number }> = [];
  for (const point of [
    { x: doorX, y: doorY - 1 },
    { x: doorX - 1, y: doorY - 1 },
    { x: doorX + 1, y: doorY - 1 },
    { x: doorX - 1, y: doorY },
    { x: doorX + 1, y: doorY },
  ]) {
    if (inBounds(map, point.x, point.y) && blocked(point.x, point.y)) queue.push(point);
  }

  const seen = new Set<string>();
  const cells: Array<{ x: number; y: number }> = [];
  while (queue.length && cells.length < 180) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;
    if (seen.has(key) || !blocked(current.x, current.y)) continue;
    seen.add(key);
    cells.push(current);
    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      if (!seen.has(`${next.x},${next.y}`) && blocked(next.x, next.y)) queue.push(next);
    }
  }

  if (cells.length >= 5) {
    const left = Math.max(0, Math.min(...cells.map((cell) => cell.x)) - 1);
    const right = Math.min(map.width - 1, Math.max(...cells.map((cell) => cell.x)) + 1);
    const top = Math.max(0, Math.min(...cells.map((cell) => cell.y)) - 1);
    const bottom = Math.min(map.height - 1, Math.max(doorY, Math.max(...cells.map((cell) => cell.y)) + 1));
    const width = right - left + 1;
    const height = bottom - top + 1;
    if (width >= 4 && width <= 15 && height >= 4 && height <= 12) {
      return cropRaw(map, left, top, width, height);
    }
  }

  return cropRaw(
    map,
    doorX - Math.floor(fallbackWidth / 2),
    doorY - (fallbackHeight - 1),
    fallbackWidth,
    fallbackHeight,
  );
}

function patternSignature(values: number[]) {
  return values.join(",");
}

function rawPattern(
  id: string,
  name: string,
  category: string,
  tags: string[],
  region: ReturnType<typeof cropRaw>,
  scope: PatternScope,
  createdAt: string,
  port?: { x: number; y: number },
): MapPattern {
  return {
    format: MAP_PATTERN_FORMAT,
    id,
    name,
    category,
    tags,
    width: region.width,
    height: region.height,
    kind: "raw",
    values: region.values,
    ports: port && port.x >= 0 && port.y >= 0 && port.x < region.width && port.y < region.height
      ? [{ id: "entrada", name: "entrada", kind: "door", x: port.x, y: port.y, direction: "south" }]
      : [],
    scope: { ...scope },
    createdAt,
    updatedAt: createdAt,
  };
}

function patchStats(
  map: MapData,
  atlasBehaviors: Map<number, number | null>,
  left: number,
  top: number,
  size: number,
) {
  let water = 0;
  let blockedCount = 0;
  let normal = 0;
  const ids = new Set<number>();
  for (let y = top; y < top + size; y++) {
    for (let x = left; x < left + size; x++) {
      const i = idx(x, y, map.width);
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      const behavior = atlasBehaviors.get(id);
      ids.add(id);
      if (behavior != null && WATER_BEHAVIORS.has(behavior)) water++;
      if (behavior != null && WALKABLE_BEHAVIORS.has(behavior)) normal++;
      if (getCollision(map.physical[i] ?? 0) !== 0) blockedCount++;
    }
  }
  const total = size * size;
  return {
    unique: ids.size,
    water: water / total,
    blocked: blockedCount / total,
    normal: normal / total,
  };
}

function mineContextPatches(
  map: MapData,
  mapKey: string,
  scope: PatternScope,
  atlas: SavedRealAtlas | null,
  seen: Set<string>,
  createdAt: string,
) {
  const size = 5;
  if (map.width < size || map.height < size) return [] as MapPattern[];
  const behaviors = behaviorMap(atlas);
  const buckets: Record<"coast" | "urban" | "green", Array<{ x: number; y: number; score: number }>> = {
    coast: [], urban: [], green: [],
  };

  for (let y = 0; y <= map.height - size; y += 2) {
    for (let x = 0; x <= map.width - size; x += 2) {
      const stats = patchStats(map, behaviors, x, y, size);
      if (stats.unique < 2 || stats.unique > 18) continue;
      if (stats.water >= 0.24 && stats.water <= 0.88) {
        buckets.coast.push({ x, y, score: stats.water + stats.unique / 100 });
      } else if (stats.blocked >= 0.28 && stats.water < 0.12) {
        buckets.green.push({ x, y, score: stats.blocked + stats.unique / 120 });
      } else if (stats.normal >= 0.42 && stats.blocked < 0.36 && stats.water < 0.12) {
        buckets.urban.push({ x, y, score: stats.normal + stats.unique / 120 });
      }
    }
  }

  const out: MapPattern[] = [];
  const specs = [
    ["coast", "Trecho costeiro real", "Porto · trecho", ["costa", "cais", "água", "porto", "litoral"]],
    ["urban", "Trecho urbano real", "Cidade · trecho", ["rua", "praça", "calçada", "cidade", "urbanismo"]],
    ["green", "Trecho verde real", "Vegetação · trecho", ["árvore", "vegetação", "jardim", "bairro", "verde"]],
  ] as const;

  for (const [kind, label, category, tags] of specs) {
    const candidates = buckets[kind].sort((a, b) => b.score - a.score);
    let taken = 0;
    for (const candidate of candidates) {
      if (taken >= 8) break;
      const region = cropRaw(map, candidate.x, candidate.y, size, size);
      const signature = patternSignature(region.values);
      if (seen.has(signature)) continue;
      seen.add(signature);
      taken++;
      out.push(rawPattern(
        `auto-${mapKey}-${kind}-${candidate.x}-${candidate.y}`,
        `${label} ${taken}`,
        category,
        [...tags, "extraído do mapa", mapKey],
        region,
        scope,
        createdAt,
      ));
    }
  }
  return out;
}

/**
 * Extrai vocabulário reutilizável diretamente do mapa REAL que está aberto.
 * Warps viram fachadas/edifícios com port semântico; trechos urbanos, verdes e
 * costeiros são minerados como patches RAW preservando metatile+colisão+elevação.
 *
 * Patterns derivados de warp recebem `warp-anchor:X,Y`. O planejador usa essa
 * tag para manter a porta exatamente sobre o warp existente por padrão, o que
 * evita gerar uma cidade bonita porém não jogável.
 */
export function deriveMapPatterns(
  map: MapData,
  events: VocabularyMapEvent[],
  mapName: string,
  scope: PatternScope,
  atlas: SavedRealAtlas | null,
): MapPattern[] {
  const createdAt = new Date().toISOString();
  const mapKey = slug(mapName);
  const seen = new Set<string>();
  const patterns: MapPattern[] = [];

  for (const event of events.filter((item) => item.source === "warp")) {
    const destination = destinationFromDetail(event.detail);
    const semantic = semanticForDestination(destination);
    const complete = detectBuildingRegion(map, event.x, event.y, semantic.width, semantic.height);
    const regions = [
      { region: complete, suffix: "completo" },
      {
        region: cropRaw(
          map,
          event.x - Math.floor(Math.min(7, semantic.width) / 2),
          event.y - (Math.min(6, semantic.height) - 1),
          Math.min(7, semantic.width),
          Math.min(6, semantic.height),
        ),
        suffix: "compacto",
      },
    ];

    for (const { region, suffix } of regions) {
      const signature = patternSignature(region.values);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const relativePort = { x: event.x - region.x, y: event.y - region.y };
      patterns.push(rawPattern(
        `auto-${mapKey}-warp-${event.sourceIndex}-${suffix}`,
        `${semantic.name} — ${suffix}`,
        semantic.category,
        [
          ...semantic.tags,
          destination.toLowerCase(),
          `warp-destination:${destination}`,
          `warp-anchor:${event.x},${event.y}`,
          "preservar warp existente",
          "extraído do mapa",
          mapKey,
        ],
        region,
        scope,
        createdAt,
        relativePort,
      ));
    }
  }

  patterns.push(...mineContextPatches(map, mapKey, scope, atlas, seen, createdAt));
  return patterns.slice(0, 80);
}

function mostCommonId(counts: Map<number, number>, excluded = new Set<number>()) {
  return [...counts.entries()]
    .filter(([id]) => !excluded.has(id))
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}

function waterSmartPath(
  map: MapData,
  mapKey: string,
  scope: PatternScope,
  behaviors: Map<number, number | null>,
  groundCounts: Map<number, number>,
  createdAt: string,
): SmartPathPreset | null {
  const isWater = (x: number, y: number) => {
    if (!inBounds(map, x, y)) return false;
    const id = (map.metatiles[idx(x, y, map.width)] ?? 0) & METATILE_MASK;
    const behavior = behaviors.get(id);
    return behavior != null && WATER_BEHAVIORS.has(behavior);
  };

  const perMask = Array.from({ length: 16 }, () => new Map<number, number>());
  const overall = new Map<number, number>();
  let observedMasks = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isWater(x, y)) continue;
      const id = (map.metatiles[idx(x, y, map.width)] ?? 0) & METATILE_MASK;
      let mask = 0;
      if (isWater(x, y - 1)) mask |= 1;
      if (isWater(x + 1, y)) mask |= 2;
      if (isWater(x, y + 1)) mask |= 4;
      if (isWater(x - 1, y)) mask |= 8;
      const bucket = perMask[mask]!;
      bucket.set(id, (bucket.get(id) ?? 0) + 1);
      overall.set(id, (overall.get(id) ?? 0) + 1);
    }
  }

  for (const bucket of perMask) if (bucket.size) observedMasks++;
  const fallback = mostCommonId(overall);
  if (fallback == null || observedMasks < 3) return null;
  const variants = perMask.map((bucket) => mostCommonId(bucket) ?? fallback);
  const family = new Set(variants);
  const erase = mostCommonId(groundCounts, family);
  if (erase == null) return null;
  if (new Set(variants).size < 2) return null;

  return {
    format: SMART_PATH_FORMAT,
    id: `auto-${mapKey}-smart-path-costa-agua`,
    name: "Costa/água real do mapa",
    variants,
    eraseMetatile: erase,
    scope: { ...scope },
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Cria Smart Paths a partir dos próprios metatiles do mapa aberto.
 * - pisos caminháveis frequentes viram caminhos conservadores (sem inventar IDs);
 * - quando o atlas identifica água suficiente, as variantes NESW são inferidas
 *   da topologia que já existe no mapa, produzindo um autotile costeiro real.
 */
export function deriveMapSmartPaths(
  map: MapData,
  mapName: string,
  scope: PatternScope,
  atlas: SavedRealAtlas | null,
): SmartPathPreset[] {
  const behaviors = behaviorMap(atlas);
  const groundCounts = new Map<number, number>();
  for (let i = 0; i < map.metatiles.length; i++) {
    if (getCollision(map.physical[i] ?? 0) !== 0) continue;
    const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
    if (id === 0) continue;
    const behavior = behaviors.get(id);
    if (behavior != null && (WATER_BEHAVIORS.has(behavior) || !WALKABLE_BEHAVIORS.has(behavior))) continue;
    groundCounts.set(id, (groundCounts.get(id) ?? 0) + 1);
  }

  const ranked = [...groundCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length < 2) return [];
  const eraseMetatile = ranked[0]![0];
  const seeds = ranked.slice(1).filter(([, count]) => count >= 4).slice(0, 3);
  const createdAt = new Date().toISOString();
  const mapKey = slug(mapName);
  const presets: SmartPathPreset[] = [];

  const coast = waterSmartPath(map, mapKey, scope, behaviors, groundCounts, createdAt);
  if (coast) presets.push(coast);

  const labels = ["Rua urbana real", "Caminho secundário real", "Praça/calçada real"];
  for (const [index, [seed]] of seeds.entries()) {
    if (seed === eraseMetatile) continue;
    presets.push({
      format: SMART_PATH_FORMAT,
      id: `auto-${mapKey}-smart-path-${index + 1}`,
      name: labels[index] ?? `Caminho real ${index + 1}`,
      variants: Array.from({ length: 16 }, () => seed),
      eraseMetatile,
      scope: { ...scope },
      createdAt,
      updatedAt: createdAt,
    });
  }
  return presets.slice(0, 4);
}
