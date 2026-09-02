import {
  getCollision,
  getElevation,
  METATILE_MASK,
  type MapData,
} from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import type { SavedRealAtlas } from "./realAtlasStore";

const NORMAL_GROUND_BEHAVIOR = 0x00;
const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);

export interface ExactGridElevationSafetyStats {
  baselineElevation: number | null;
  protectedCount: number;
}

/**
 * Protege passarelas, pontes e outros corredores caminháveis que usam uma
 * elevação física diferente do piso-base dominante do mapa real.
 *
 * O Exact Grid pode trocar o metatile visual de uma zona e, mais tarde,
 * normalizar os bits físicos para o valor canônico daquele piso. Isso é correto
 * em cidades planas, mas quebraria mapas como Fortree, onde corredores inteiros
 * dependem de elevação 4 enquanto o chão comum usa elevação 3.
 *
 * A referência é derivada do próprio map.bin: contamos apenas células NORMAL,
 * layer-0 e sem colisão, e tomamos a elevação mais frequente como baseline. Toda
 * célula caminhável não aquática com outra elevação é restaurada do sourceMap e
 * passa a ser owner=preserve antes das etapas de finish/physical normalization.
 */
export function protectExactGridElevationLanes({
  sourceMap,
  layered,
  atlas,
}: {
  sourceMap: MapData;
  layered: LayeredBasePlan;
  atlas: SavedRealAtlas;
}): ExactGridElevationSafetyStats {
  if (!layered.active) return { baselineElevation: null, protectedCount: 0 };

  const records = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
  const counts = new Map<number, number>();

  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    const record = records.get(id);
    if (!record) continue;
    if ((record.behavior ?? -1) !== NORMAL_GROUND_BEHAVIOR) continue;
    if ((record.layerType ?? 0) !== 0) continue;
    const physical = sourceMap.physical[i] ?? 0;
    if (getCollision(physical) !== 0) continue;
    const elevation = getElevation(physical);
    counts.set(elevation, (counts.get(elevation) ?? 0) + 1);
  }

  let baselineElevation: number | null = null;
  let baselineCount = -1;
  for (const [elevation, count] of counts) {
    if (count > baselineCount || (count === baselineCount && (baselineElevation == null || elevation < baselineElevation))) {
      baselineElevation = elevation;
      baselineCount = count;
    }
  }
  if (baselineElevation == null) return { baselineElevation: null, protectedCount: 0 };

  let protectedCount = 0;
  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    const owner = layered.occupancy[i];
    if (
      owner === LAYER_OCCUPANCY.structure
      || owner === LAYER_OCCUPANCY.reserved
      || owner === LAYER_OCCUPANCY.detail
    ) continue;

    const physical = sourceMap.physical[i] ?? 0;
    if (getCollision(physical) !== 0) continue;
    const elevation = getElevation(physical);
    if (elevation === baselineElevation) continue;

    const id = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    const record = records.get(id);
    if (!record) continue;
    if (WATER_BEHAVIORS.has(record.behavior ?? -1)) continue;

    layered.map.metatiles[i] = sourceMap.metatiles[i] ?? 0;
    layered.map.physical[i] = sourceMap.physical[i] ?? 0;
    layered.occupancy[i] = LAYER_OCCUPANCY.reserved;
    protectedCount++;
  }

  if (protectedCount) {
    layered.warnings.push(
      `Segurança de elevação: baseline ${baselineElevation}; ${protectedCount} célula(s) caminhável(is) em outro nível foram restauradas do mapa real e marcadas como preserve.`,
    );
  }

  return { baselineElevation, protectedCount };
}
