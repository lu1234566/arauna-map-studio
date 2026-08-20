import { idx, rawValue, type MapData } from "./emeraldMap";
import { MAP_PATTERN_FORMAT, type MapPattern, type PatternScope } from "./patternLibrary";
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
