import {
  cloneMap,
  COLLISION_MASK,
  getCollision,
  getElevation,
  idx,
  METATILE_MASK,
  type MapData,
} from "./emeraldMap";
import {
  LAYER_OCCUPANCY,
  type LayeredBasePlan,
} from "./aiLayeredPrompt";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { SavedRealAtlas } from "./realAtlasStore";

const MATERIAL_PRESERVE_SENTINEL = -2;
const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const MAX_COMPONENT_CELLS = 6;
const MAX_COMPONENT_SPAN = 3;
const MAX_DETAIL_COMPONENTS = 18;

export interface ExactGridPreserveStats {
  selectiveGroundCount: number;
}

export interface ExactGridDetailStats {
  componentCount: number;
  cellCount: number;
  layeredCount: number;
}

export function normalizeExactGridSelectivePreserve(
  layered: LayeredBasePlan,
  reconstruction: AiMapReconstructionPlan,
): ExactGridPreserveStats {
  const base = reconstruction.baseMetatile == null
    ? null
    : reconstruction.baseMetatile & METATILE_MASK;
  if (!layered.active || base == null) return { selectiveGroundCount: 0 };

  let selectiveGroundCount = 0;
  for (let i = 0; i < layered.materialByCell.length; i++) {
    if (layered.occupancy[i] !== LAYER_OCCUPANCY.unset) continue;
    if (layered.materialByCell[i] !== MATERIAL_PRESERVE_SENTINEL) continue;

    // Em prompts como “preservar água/costa”, a área geométrica é apenas um
    // limite de busca. Células terrestres comuns não devem congelar o Slateport
    // antigo; elas retornam ao piso-base. Água/costa/eventos já chegam aqui com
    // occupancy=reserved e, portanto, continuam intocados.
    layered.materialByCell[i] = base;
    layered.map.metatiles[i] = base;
    layered.map.physical[i] = ((layered.map.physical[i] ?? 0) & ~COLLISION_MASK) & 0xffff;
    layered.occupancy[i] = LAYER_OCCUPANCY.base;
    selectiveGroundCount++;
  }

  if (selectiveGroundCount) {
    layered.warnings.push(
      `Preservação seletiva: ${selectiveGroundCount} célula(s) terrestres dentro de ranges “preservar água/costa” voltaram ao piso-base; somente costa/eventos reais permaneceram preservados.`,
    );
  }
  return { selectiveGroundCount };
}

function neighbors(index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x + 1 < width) result.push(index + 1);
  if (y > 0) result.push(index - width);
  if (y + 1 < height) result.push(index + width);
  return result;
}

function nearBlocked(
  occupancy: Uint8Array,
  index: number,
  width: number,
  height: number,
  radius = 1,
) {
  const x = index % width;
  const y = Math.floor(index / width);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const value = occupancy[idx(px, py, width)];
      if (
        value === LAYER_OCCUPANCY.structure
        || value === LAYER_OCCUPANCY.road
        || value === LAYER_OCCUPANCY.reserved
      ) return true;
    }
  }
  return false;
}

function nearSelected(
  selected: Uint8Array,
  index: number,
  width: number,
  height: number,
  radius = 2,
) {
  const x = index % width;
  const y = Math.floor(index / width);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      if (selected[idx(px, py, width)]) return true;
    }
  }
  return false;
}

/**
 * Primeira camada DETAIL determinística do Exact Grid. Ela reaproveita somente
 * pequenos componentes decorativos reais do mapa-fonte. Massas grandes (prédios,
 * muros extensos etc.) ficam de fora; vias/estruturas/eventos recebem margem de
 * segurança e o número total de detalhes é deliberadamente baixo.
 */
export function applyExactGridDeterministicDetails({
  map,
  sourceMap,
  layered,
  atlas,
}: {
  map: MapData;
  sourceMap: MapData;
  layered: LayeredBasePlan;
  atlas: SavedRealAtlas;
}): { map: MapData; stats: ExactGridDetailStats; warnings: string[] } {
  const result = cloneMap(map);
  const warnings: string[] = [];
  const total = map.width * map.height;
  const recordById = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
  const candidate = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    if (layered.occupancy[i] !== LAYER_OCCUPANCY.base) continue;
    if (nearBlocked(layered.occupancy, i, map.width, map.height, 1)) continue;

    const sourceId = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    const sourcePhysical = (sourceMap.physical[i] ?? 0) & 0xffff;
    const record = recordById.get(sourceId);
    if (!record) continue;
    if (WATER_BEHAVIORS.has(record.behavior ?? -1)) continue;
    if (getElevation(sourcePhysical) === 1) continue;

    const layeredTile = (record.layerType ?? 0) > 0;
    const blockedTile = getCollision(sourcePhysical) !== 0;
    if (!layeredTile && !blockedTile) continue;
    candidate[i] = 1;
  }

  const visited = new Uint8Array(total);
  const selected = new Uint8Array(total);
  const components: number[][] = [];
  for (let start = 0; start < total; start++) {
    if (!candidate[start] || visited[start]) continue;
    const queue = [start];
    const component: number[] = [];
    visited[start] = 1;
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of neighbors(current, map.width, map.height)) {
        if (!candidate[next] || visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    components.push(component);
  }

  const cellBudget = Math.max(12, Math.floor(total * 0.02));
  let componentCount = 0;
  let cellCount = 0;
  let layeredCount = 0;

  for (const component of components) {
    if (componentCount >= MAX_DETAIL_COMPONENTS || cellCount >= cellBudget) break;
    if (!component.length || component.length > MAX_COMPONENT_CELLS) continue;

    const xs = component.map((cell) => cell % map.width);
    const ys = component.map((cell) => Math.floor(cell / map.width));
    const spanX = Math.max(...xs) - Math.min(...xs) + 1;
    const spanY = Math.max(...ys) - Math.min(...ys) + 1;
    if (spanX > MAX_COMPONENT_SPAN || spanY > MAX_COMPONENT_SPAN) continue;

    const hasLayered = component.some((cell) => {
      const id = (sourceMap.metatiles[cell] ?? 0) & METATILE_MASK;
      return (recordById.get(id)?.layerType ?? 0) > 0;
    });
    if (!hasLayered && component.length > 2) continue;
    if (component.some((cell) => nearSelected(selected, cell, map.width, map.height, 2))) continue;
    if (cellCount + component.length > cellBudget) continue;

    for (const cell of component) {
      result.metatiles[cell] = sourceMap.metatiles[cell] ?? result.metatiles[cell] ?? 0;
      result.physical[cell] = sourceMap.physical[cell] ?? result.physical[cell] ?? 0;
      layered.occupancy[cell] = LAYER_OCCUPANCY.detail;
      selected[cell] = 1;
      const id = (result.metatiles[cell] ?? 0) & METATILE_MASK;
      if ((recordById.get(id)?.layerType ?? 0) > 0) layeredCount++;
    }
    componentCount++;
    cellCount += component.length;
  }

  if (cellCount) {
    warnings.push(
      `DETAIL determinístico: ${cellCount} célula(s) em ${componentCount} pequeno(s) componente(s) reais foram reaproveitadas; ${layeredCount} usam layering GBA legítimo.`,
    );
  } else {
    warnings.push("DETAIL determinístico: nenhum componente decorativo pequeno e seguro foi encontrado; o Exact Grid permaneceu sem decoração automática.");
  }

  return {
    map: result,
    stats: { componentCount, cellCount, layeredCount },
    warnings,
  };
}
