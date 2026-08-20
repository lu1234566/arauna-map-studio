import { getCollision, idx, METATILE_MASK, rawValue, type MapData } from "./emeraldMap";
import { MAP_PATTERN_FORMAT, type MapPattern, type PatternScope } from "./patternLibrary";
import { SMART_PATH_FORMAT, type SmartPathPreset } from "./smartPath";
import type { VocabularyMapEvent } from "./aiMapVocabulary";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mapa";
}

function crop(map: MapData, left: number, top: number, right: number, bottom: number) {
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(map.width - 1, right);
  const y1 = Math.min(map.height - 1, bottom);
  const values: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) values.push(rawValue(map, idx(x, y, map.width)));
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, values };
}

/**
 * Alguns marcos urbanos não têm warp próprio. Em Slateport/Porto do Sal, por
 * exemplo, o mercado aberto é identificado pelos vendedores MART_EMPLOYEE.
 * Extraímos o conjunto RAW ao redor do cluster e marcamos sua origem como fixa,
 * porque mover as bancas sem mover os NPCs quebraria a cena de jogo.
 */
export function deriveSemanticEventPatterns(
  map: MapData,
  events: VocabularyMapEvent[],
  mapName: string,
  scope: PatternScope,
): MapPattern[] {
  const marketActors = events.filter((event) => (
    event.source === "object" && /OBJ_EVENT_GFX_MART_EMPLOYEE|DecorClerk|DollClerk|TMClerk/i.test(event.detail)
  ));
  if (marketActors.length < 2) return [];

  const minX = Math.min(...marketActors.map((event) => event.x));
  const maxX = Math.max(...marketActors.map((event) => event.x));
  const minY = Math.min(...marketActors.map((event) => event.y));
  const maxY = Math.max(...marketActors.map((event) => event.y));
  const region = crop(map, minX - 3, minY - 3, maxX + 3, maxY + 3);
  if (region.width > 22 || region.height > 24) return [];
  const now = new Date().toISOString();
  const key = slug(mapName);
  return [{
    format: MAP_PATTERN_FORMAT,
    id: `auto-${key}-mercado-aberto`,
    name: "Mercado aberto real",
    category: "Comércio · conjunto",
    tags: [
      "mercado",
      "mercado do sal",
      "feira",
      "bancas",
      "comércio",
      "vendedores",
      `fixed-origin:${region.x},${region.y}`,
      "preservar npcs do mercado",
      "extraído do mapa",
      key,
    ],
    width: region.width,
    height: region.height,
    kind: "raw",
    values: region.values,
    ports: [],
    scope: { ...scope },
    createdAt: now,
    updatedAt: now,
  }];
}

function mostCommon(counts: Map<number, number>, excluded?: number) {
  return [...counts.entries()]
    .filter(([id]) => id !== excluded)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * A célula imediatamente abaixo de uma porta externa é uma pista muito melhor
 * de "rua/calçada" que simplesmente escolher o segundo piso mais frequente do
 * mapa. Usamos os acessos dos warps reais para obter um Smart Path urbano
 * conservador e compatível com o visual do mapa aberto.
 */
export function deriveSemanticEventSmartPaths(
  map: MapData,
  events: VocabularyMapEvent[],
  mapName: string,
  scope: PatternScope,
): SmartPathPreset[] {
  const groundCounts = new Map<number, number>();
  for (let i = 0; i < map.metatiles.length; i++) {
    if (getCollision(map.physical[i] ?? 0) !== 0) continue;
    const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
    if (id !== 0) groundCounts.set(id, (groundCounts.get(id) ?? 0) + 1);
  }
  const erase = mostCommon(groundCounts);
  if (erase == null) return [];

  const approachCounts = new Map<number, number>();
  for (const event of events.filter((item) => item.source === "warp")) {
    for (const dy of [1, 2]) {
      const x = event.x;
      const y = event.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const i = idx(x, y, map.width);
      if (getCollision(map.physical[i] ?? 0) !== 0) continue;
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if (id === 0 || id === erase) continue;
      approachCounts.set(id, (approachCounts.get(id) ?? 0) + 1);
    }
  }
  const seed = mostCommon(approachCounts, erase);
  if (seed == null || seed === erase) return [];

  const now = new Date().toISOString();
  const key = slug(mapName);
  return [{
    format: SMART_PATH_FORMAT,
    id: `auto-${key}-smart-path-acessos-urbanos`,
    name: "Via urbana pelos acessos reais",
    variants: Array.from({ length: 16 }, () => seed),
    eraseMetatile: erase,
    scope: { ...scope },
    createdAt: now,
    updatedAt: now,
  }];
}
