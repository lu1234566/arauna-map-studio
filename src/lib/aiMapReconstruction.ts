import {
  cloneMap,
  COLLISION_MASK,
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
const URBAN_STRUCTURE_MARGIN = 1;
const URBAN_WARP_MARGIN = 2;
const MAX_ORPHAN_COLLISION_CLUSTER = 8;
const MIN_GREEN_COMPONENT = 6;

export interface AiMapReconstructionPlan {
  map: MapData;
  touched: number[];
  baseMetatile: number | null;
  urbanMetatile: number | null;
  greenMetatile: number | null;
  candidateCount: number;
  preservedCount: number;
  changedCount: number;
  baseChangedCount: number;
  urbanChangedCount: number;
  greenChangedCount: number;
  greenSeedCount: number;
  orphanClearedCount: number;
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

function greenGroundFromPatterns(
  patterns: MapPattern[],
  behaviors: Map<number, number | null>,
  baseMetatile: number | null,
  urbanMetatile: number | null,
) {
  const counts = new Map<number, number>();
  for (const pattern of patterns) {
    if (pattern.kind !== "raw") continue;
    const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
    const greenPattern = pattern.id.toLowerCase().includes("-green-")
      || /(trecho verde|vegetac|jardim|area verde)/.test(key);
    if (!greenPattern) continue;
    for (const raw of pattern.values ?? []) {
      const value = Number(raw) & 0xffff;
      if (getCollision(value) !== 0) continue;
      const id = value & METATILE_MASK;
      if (!id || id === urbanMetatile || behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const distinct = ranked.filter(([id]) => id !== baseMetatile && id !== urbanMetatile);
  const chosen = distinct.find(([, count]) => count >= 3)
    ?? ranked.find(([id]) => id !== urbanMetatile)
    ?? null;
  const familySource = distinct.length ? distinct : ranked.filter(([id]) => id !== urbanMetatile);
  const family = new Set(
    familySource
      .filter(([, count]) => count >= 2)
      .slice(0, 4)
      .map(([id]) => id),
  );
  if (chosen && !family.size) family.add(chosen[0]);
  return {
    id: chosen?.[0] ?? null,
    family,
    sampleCount: chosen?.[1] ?? 0,
  };
}

function emptyPlan(map: MapData, warnings: string[], baseMetatile: number | null = null): AiMapReconstructionPlan {
  return {
    map,
    touched: [],
    baseMetatile,
    urbanMetatile: null,
    greenMetatile: null,
    candidateCount: 0,
    preservedCount: 0,
    changedCount: 0,
    baseChangedCount: 0,
    urbanChangedCount: 0,
    greenChangedCount: 0,
    greenSeedCount: 0,
    orphanClearedCount: 0,
    confidence: 0,
    warnings,
  };
}

function isInBounds(map: MapData, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function neighbors8(mask: Uint8Array, map: MapData, x: number, y: number) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!isInBounds(map, nx, ny)) continue;
      if (mask[idx(nx, ny, map.width)]) count++;
    }
  }
  return count;
}

function coherentGreenMask(
  sourceMap: MapData,
  behaviors: Map<number, number | null>,
  preserve: Uint8Array,
  urban: Uint8Array,
  greenFamily: Set<number>,
) {
  const size = sourceMap.width * sourceMap.height;
  let mask = new Uint8Array(size);
  let seedCount = 0;

  const eligible = (cellIndex: number) => {
    if (cellIndex < 0 || cellIndex >= size || preserve[cellIndex] || urban[cellIndex]) return false;
    if (getCollision(sourceMap.physical[cellIndex] ?? 0) !== 0) return false;
    const id = (sourceMap.metatiles[cellIndex] ?? 0) & METATILE_MASK;
    return behaviors.get(id) === NORMAL_GROUND_BEHAVIOR;
  };

  for (let i = 0; i < size; i++) {
    if (!eligible(i)) continue;
    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    if (!greenFamily.has(id)) continue;
    mask[i] = 1;
    seedCount++;
  }
  if (seedCount < 4) return { mask: new Uint8Array(size), seedCount };

  // Junta fragmentos próximos sem espalhar a vegetação indiscriminadamente.
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(mask);
    const threshold = pass === 0 ? 2 : 3;
    for (let y = 0; y < sourceMap.height; y++) {
      for (let x = 0; x < sourceMap.width; x++) {
        const i = idx(x, y, sourceMap.width);
        if (mask[i] || !eligible(i)) continue;
        if (neighbors8(mask, sourceMap, x, y) >= threshold) next[i] = 1;
      }
    }
    mask = next;
  }

  // Remove manchas minúsculas para não voltar ao efeito confete.
  const seen = new Uint8Array(size);
  for (let start = 0; start < size; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const component: number[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen[current] || !mask[current]) continue;
      seen[current] = 1;
      component.push(current);
      const x = current % sourceMap.width;
      const y = Math.floor(current / sourceMap.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isInBounds(sourceMap, nx, ny)) continue;
        const ni = idx(nx, ny, sourceMap.width);
        if (mask[ni] && !seen[ni]) queue.push(ni);
      }
    }
    if (component.length < MIN_GREEN_COMPONENT) {
      for (const cellIndex of component) mask[cellIndex] = 0;
    }
  }

  return { mask, seedCount };
}

function safeOrphanCollisionClusters(
  sourceMap: MapData,
  behaviors: Map<number, number | null>,
  preserve: Uint8Array,
  cleanupProtected: Uint8Array,
) {
  const seen = new Uint8Array(sourceMap.width * sourceMap.height);
  const clusters: number[][] = [];

  const isCandidate = (cellIndex: number) => {
    if (cellIndex < 0 || cellIndex >= sourceMap.metatiles.length) return false;
    if (preserve[cellIndex] || cleanupProtected[cellIndex]) return false;
    if (getCollision(sourceMap.physical[cellIndex] ?? 0) === 0) return false;
    const id = (sourceMap.metatiles[cellIndex] ?? 0) & METATILE_MASK;
    return behaviors.get(id) === NORMAL_GROUND_BEHAVIOR;
  };

  for (let start = 0; start < sourceMap.metatiles.length; start++) {
    if (seen[start] || !isCandidate(start)) continue;
    const queue = [start];
    const component: number[] = [];
    let safe = true;

    while (queue.length) {
      const current = queue.shift()!;
      if (seen[current] || !isCandidate(current)) continue;
      seen[current] = 1;
      component.push(current);
      if (component.length > MAX_ORPHAN_COLLISION_CLUSTER) safe = false;

      const x = current % sourceMap.width;
      const y = Math.floor(current / sourceMap.width);
      if (x === 0 || y === 0 || x === sourceMap.width - 1 || y === sourceMap.height - 1) safe = false;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isInBounds(sourceMap, nx, ny)) {
          safe = false;
          continue;
        }
        const ni = idx(nx, ny, sourceMap.width);
        if (preserve[ni] || cleanupProtected[ni]) safe = false;
        const neighborId = (sourceMap.metatiles[ni] ?? 0) & METATILE_MASK;
        if (WATER_BEHAVIORS.has(behaviors.get(neighborId) ?? -1)) safe = false;
        if (!seen[ni] && isCandidate(ni)) queue.push(ni);
      }
    }

    if (safe && component.length > 0 && component.length <= MAX_ORPHAN_COLLISION_CLUSTER) {
      clusters.push(component);
    }
  }

  return clusters;
}

function desiredGround(
  cellIndex: number,
  baseMetatile: number,
  urbanMetatile: number | null,
  greenMetatile: number | null,
  urban: Uint8Array,
  green: Uint8Array,
) {
  if (urbanMetatile != null && urban[cellIndex]) return urbanMetatile;
  if (greenMetatile != null && green[cellIndex]) return greenMetatile;
  return baseMetatile;
}

/**
 * Cria uma base visual limpa para uma remodelagem REAL sem tocar na lógica do mapa.
 *
 * A reconstrução é propositalmente conservadora:
 * - altera metatile visual de células caminháveis com behavior NORMAL;
 * - preserva água e a borda imediata da costa;
 * - preserva warps/triggers e regiões ancoradas/fixas;
 * - usa piso urbano real só no entorno curto de estruturas e acessos;
 * - recupera áreas verdes contínuas a partir dos próprios Patterns verdes do mapa;
 * - remove pequenos clusters colidíveis órfãos somente quando estão isolados de
 *   borda, costa, eventos e regiões protegidas, limpando também a colisão para
 *   não criar paredes invisíveis;
 * - mantém a elevação e todos os demais bits físicos intactos.
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
  const cleanupProtected = new Uint8Array(sourceMap.width * sourceMap.height);
  const urban = new Uint8Array(sourceMap.width * sourceMap.height);

  // Warps/triggers precisam manter sua célula visual. Para limpeza de obstáculos,
  // qualquer célula reservada (incluindo área de NPC) vira zona de proteção.
  for (const cell of reservedCells) {
    if (!isInBounds(sourceMap, cell.x, cell.y)) continue;
    const i = idx(cell.x, cell.y, sourceMap.width);
    cleanupProtected[i] = 1;
    if (cell.kind !== "npc") preserve[i] = 1;
    if (cell.kind === "warp") {
      markExpandedRegion(urban, sourceMap, cell.x, cell.y, 1, 1, URBAN_WARP_MARGIN);
    }
  }

  // Todos os prédios/conjuntos ligados a eventos reais ficam preservados mesmo se
  // o modelo não os citar explicitamente no plano atual. Somente uma faixa curta
  // ao redor deles recebe vocação urbana; a malha principal continua vindo dos
  // Smart Paths, evitando pavimentar a cidade inteira.
  for (const pattern of patterns) {
    const origin = originalOrigin(pattern);
    if (!origin) continue;
    markRegion(preserve, sourceMap, origin.x, origin.y, pattern.width, pattern.height);
    markRegion(cleanupProtected, sourceMap, origin.x, origin.y, pattern.width, pattern.height);
    markExpandedRegion(urban, sourceMap, origin.x, origin.y, pattern.width, pattern.height, URBAN_STRUCTURE_MARGIN);
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
          if (!isInBounds(sourceMap, px, py)) continue;
          const pi = idx(px, py, sourceMap.width);
          preserve[pi] = 1;
          cleanupProtected[pi] = 1;
          urban[pi] = 0;
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
  const greenGround = greenGroundFromPatterns(patterns, behaviors, ground.id, urbanMetatile);
  const greenPlan = coherentGreenMask(sourceMap, behaviors, preserve, urban, greenGround.family);
  const green = greenPlan.mask;
  const greenMetatile = greenGround.id;
  const touched: number[] = [];
  let baseChangedCount = 0;
  let urbanChangedCount = 0;
  let greenChangedCount = 0;
  let orphanClearedCount = 0;

  const countDesired = (desired: number) => {
    if (urbanMetatile != null && desired === urbanMetatile && urbanMetatile !== ground.id) urbanChangedCount++;
    else if (greenMetatile != null && desired === greenMetatile && greenMetatile !== ground.id) greenChangedCount++;
    else baseChangedCount++;
  };

  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    if (preserve[i]) continue;
    if (getCollision(sourceMap.physical[i] ?? 0) !== 0) continue;
    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    if (behaviors.get(id) !== NORMAL_GROUND_BEHAVIOR) continue;
    const desired = desiredGround(i, ground.id, urbanMetatile, greenMetatile, urban, green);
    if (id === desired) continue;
    map.metatiles[i] = desired;
    touched.push(i);
    countDesired(desired);
  }

  // Depois de estabelecer o piso contextual, limpamos apenas pequenos obstáculos
  // órfãos. A elevação permanece; somente os bits de colisão são removidos.
  for (const component of safeOrphanCollisionClusters(sourceMap, behaviors, preserve, cleanupProtected)) {
    for (const cellIndex of component) {
      const desired = desiredGround(cellIndex, ground.id, urbanMetatile, greenMetatile, urban, green);
      map.metatiles[cellIndex] = desired;
      map.physical[cellIndex] = ((sourceMap.physical[cellIndex] ?? 0) & ~COLLISION_MASK) & 0xffff;
      touched.push(cellIndex);
      orphanClearedCount++;
      countDesired(desired);
    }
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
      greenMetatile,
      candidateCount: ground.candidateCount,
      preservedCount,
      changedCount: 0,
      baseChangedCount: 0,
      urbanChangedCount: 0,
      greenChangedCount: 0,
      greenSeedCount: greenPlan.seedCount,
      orphanClearedCount: 0,
      confidence: ground.count / ground.candidateCount,
      warnings,
    };
  }

  if (touched.length) {
    const urbanText = urbanMetatile != null
      ? `; ${urbanChangedCount} célula(s) próximas a estruturas/acessos usarão piso urbano 0x${urbanMetatile.toString(16).toUpperCase().padStart(3, "0")}`
      : "; nenhum piso urbano confiável foi derivado";
    const greenText = greenMetatile != null && greenPlan.seedCount
      ? `; ${greenChangedCount} célula(s) formarão áreas verdes coerentes com piso 0x${greenMetatile.toString(16).toUpperCase().padStart(3, "0")} a partir de ${greenPlan.seedCount} semente(s) reais`
      : "; nenhum piso verde confiável foi derivado dos Patterns reais";
    const cleanupText = orphanClearedCount
      ? `; ${orphanClearedCount} célula(s) de pequenos obstáculos órfãos serão limpas com colisão removida`
      : "; nenhum obstáculo colidível órfão seguro foi encontrado";
    warnings.push(
      `Base contextual: ${baseChangedCount} célula(s) usarão piso comum 0x${ground.id.toString(16).toUpperCase().padStart(3, "0")}${urbanText}${greenText}${cleanupText}. Elevação permanece intacta.`,
    );
  }

  return {
    map,
    touched,
    baseMetatile: ground.id,
    urbanMetatile,
    greenMetatile,
    candidateCount: ground.candidateCount,
    preservedCount,
    changedCount: touched.length,
    baseChangedCount,
    urbanChangedCount,
    greenChangedCount,
    greenSeedCount: greenPlan.seedCount,
    orphanClearedCount,
    confidence: ground.count / ground.candidateCount,
    warnings,
  };
}
