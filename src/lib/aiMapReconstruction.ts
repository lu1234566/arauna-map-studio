import {
  cloneMap,
  getCollision,
  idx,
  METATILE_MASK,
  type MapData,
} from "./emeraldMap";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const NORMAL_GROUND_BEHAVIOR = 0x00;
const MIN_GROUND_SAMPLES = 12;
const MAX_REBUILD_RATIO = 0.6;
const URBAN_MARGIN = 3;

export interface AiMapReconstructionPlan {
  map: MapData;
  touched: number[];
  baseMetatile: number | null;
  urbanMetatile: number | null;
  candidateCount: number;
  preservedCount: number;
  changedCount: number;
  baseChangedCount: number;
  urbanChangedCount: number;
  confidence: number;
  warnings: string[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Remodelagem ampla precisa ser opt-in pelo conteúdo do comando. Pedidos pontuais
 * ("adicione uma placa") continuam aplicando somente o Template, sem limpar o mapa.
 */
export function isAiRemodelPrompt(prompt: string) {
  const key = normalize(prompt);
  return /(remodel|reorgan|reconstru|redesen|replanej|revitaliz|refa|recrie|limp(e|ar|a)|reurban)/.test(key);
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

function markExpandedRegion(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number, margin: number) {
  markRegion(mask, map, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

function behaviorMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
}

function dominantGround(
  map: MapData,
  behaviors: Map<number, number | null>,
  preserve: Uint8Array,
) {
  const counts = new Map<number, number>();
  let candidateCount = 0;
  for (let i = 0; i < map.metatiles.length; i++) {
    if (preserve[i]) continue;
    if (getCollision(map.physical[i] ?? 0) !== 0) continue;
    const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
    if (id === 0 || behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
    candidateCount++;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    id: ranked[0]?.[0] ?? null,
    count: ranked[0]?.[1] ?? 0,
    candidateCount,
  };
}

function urbanGroundFromSmartPaths(
  smartPaths: SmartPathPreset[],
  behaviors: Map<number, number | null>,
  baseMetatile: number | null,
) {
  const counts = new Map<number, number>();
  for (const preset of smartPaths) {
    const key = normalize(`${preset.id} ${preset.name}`);
    if (!/(urban|via|rua|calcad|acesso)/.test(key)) continue;
    for (const raw of preset.variants ?? []) {
      const id = Number(raw) & METATILE_MASK;
      if (!id || id === baseMetatile || behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function emptyPlan(map: MapData, warnings: string[], baseMetatile: number | null = null): AiMapReconstructionPlan {
  return {
    map,
    touched: [],
    baseMetatile,
    urbanMetatile: null,
    candidateCount: 0,
    preservedCount: 0,
    changedCount: 0,
    baseChangedCount: 0,
    urbanChangedCount: 0,
    confidence: 0,
    warnings,
  };
}

/**
 * Cria uma base visual limpa para uma remodelagem REAL sem tocar na lógica do mapa.
 *
 * A reconstrução é propositalmente conservadora:
 * - altera SOMENTE metatile visual de células caminháveis com behavior NORMAL;
 * - nunca altera colisão/elevação;
 * - preserva água e a borda imediata da costa;
 * - preserva warps/triggers;
 * - preserva a região original de todo Pattern com warp-anchor/fixed-origin;
 * - usa piso urbano real perto de estruturas/eventos quando um Smart Path urbano
 *   confiável existe, evitando transformar toda a cidade em um único piso verde;
 * - deixa behaviors especiais (areia, grama alta, gelo etc.) intactos.
 *
 * Depois dessa etapa o Template/Smart Paths é aplicado sobre a base reconstruída.
 */
export function planAiMapReconstruction(
  sourceMap: MapData,
  atlas: SavedRealAtlas | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  smartPaths: SmartPathPreset[] = [],
): AiMapReconstructionPlan {
  const map = cloneMap(sourceMap);
  const warnings: string[] = [];
  if (!atlas) return emptyPlan(map, ["Reconstrução ignorada: atlas real não está carregado."]);

  const behaviors = behaviorMap(atlas);
  const preserve = new Uint8Array(sourceMap.width * sourceMap.height);
  const urban = new Uint8Array(sourceMap.width * sourceMap.height);

  // Warps/triggers precisam manter sua célula visual. Áreas de movimento de NPC
  // podem receber novo piso, pois a reconstrução não altera colisão/elevação.
  for (const cell of reservedCells) {
    if (cell.kind !== "npc" && cell.x >= 0 && cell.y >= 0 && cell.x < sourceMap.width && cell.y < sourceMap.height) {
      preserve[idx(cell.x, cell.y, sourceMap.width)] = 1;
    }
    if (cell.kind === "warp" && cell.x >= 0 && cell.y >= 0 && cell.x < sourceMap.width && cell.y < sourceMap.height) {
      markExpandedRegion(urban, sourceMap, cell.x, cell.y, 1, 1, URBAN_MARGIN);
    }
  }

  // Todos os prédios/conjuntos ligados a eventos reais ficam preservados mesmo se
  // o modelo não os citar explicitamente no plano atual. A vizinhança ao redor
  // deles é uma zona urbana candidata, sem tocar no prédio em si.
  for (const pattern of patterns) {
    const origin = originalOrigin(pattern);
    if (!origin) continue;
    markRegion(preserve, sourceMap, origin.x, origin.y, pattern.width, pattern.height);
    markExpandedRegion(urban, sourceMap, origin.x, origin.y, pattern.width, pattern.height, URBAN_MARGIN);
  }

  // Água e a célula vizinha imediata formam a costa. Mantemos ambas para não
  // transformar a reconstrução urbana em um recorte quadrado sobre o litoral.
  for (let y = 0; y < sourceMap.height; y++) {
    for (let x = 0; x < sourceMap.width; x++) {
      const i = idx(x, y, sourceMap.width);
      const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
      if (!WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= sourceMap.width || py >= sourceMap.height) continue;
          preserve[idx(px, py, sourceMap.width)] = 1;
          urban[idx(px, py, sourceMap.width)] = 0;
        }
      }
    }
  }

  const ground = dominantGround(sourceMap, behaviors, preserve);
  const preservedCount = preserve.reduce((sum, value) => sum + (value ? 1 : 0), 0);
  if (ground.id == null || ground.candidateCount < MIN_GROUND_SAMPLES || ground.count < 4) {
    warnings.push("Reconstrução ignorada: não há amostra suficiente de piso NORMAL para escolher uma base segura.");
    return {
      ...emptyPlan(map, warnings, ground.id),
      candidateCount: ground.candidateCount,
      preservedCount,
      confidence: ground.candidateCount ? ground.count / ground.candidateCount : 0,
    };
  }

  const urbanMetatile = urbanGroundFromSmartPaths(smartPaths, behaviors, ground.id);
  const touched: number[] = [];
  let baseChangedCount = 0;
  let urbanChangedCount = 0;

  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    if (preserve[i]) continue;
    if (getCollision(sourceMap.physical[i] ?? 0) !== 0) continue;
    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    if (behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
    const desired = urbanMetatile != null && urban[i] ? urbanMetatile : ground.id;
    if (id === desired) continue;
    map.metatiles[i] = desired;
    touched.push(i);
    if (desired === urbanMetatile && urbanMetatile !== ground.id) urbanChangedCount++;
    else baseChangedCount++;
  }

  if (touched.length > sourceMap.metatiles.length * MAX_REBUILD_RATIO) {
    warnings.push(
      `Reconstrução cancelada por segurança: ${touched.length} células excederiam ${Math.round(MAX_REBUILD_RATIO * 100)}% do mapa.`,
    );
    return {
      map: cloneMap(sourceMap),
      touched: [],
      baseMetatile: ground.id,
      urbanMetatile,
      candidateCount: ground.candidateCount,
      preservedCount,
      changedCount: 0,
      baseChangedCount: 0,
      urbanChangedCount: 0,
      confidence: ground.count / ground.candidateCount,
      warnings,
    };
  }

  if (touched.length) {
    const urbanText = urbanMetatile != null
      ? `; ${urbanChangedCount} célula(s) próximas a estruturas/acessos usarão piso urbano 0x${urbanMetatile.toString(16).toUpperCase().padStart(3, "0")}`
      : "; nenhum piso urbano confiável foi derivado, então somente a base comum será usada";
    warnings.push(
      `Base contextual: ${baseChangedCount} célula(s) usarão piso comum 0x${ground.id.toString(16).toUpperCase().padStart(3, "0")}${urbanText}. Colisão/elevação permanecem intactas.`,
    );
  }

  return {
    map,
    touched,
    baseMetatile: ground.id,
    urbanMetatile,
    candidateCount: ground.candidateCount,
    preservedCount,
    changedCount: touched.length,
    baseChangedCount,
    urbanChangedCount,
    confidence: ground.count / ground.candidateCount,
    warnings,
  };
}
