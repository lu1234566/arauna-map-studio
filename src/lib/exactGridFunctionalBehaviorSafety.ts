import { METATILE_MASK, type MapData } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";
import type { SavedRealAtlas } from "./realAtlasStore";

const NORMAL_GROUND_BEHAVIOR = 0x00;

export interface ExactGridFunctionalBehaviorSafetyStats {
  enabled: boolean;
  protectedCount: number;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Segurança opt-in para puzzles e mapas onde o comportamento do metatile é parte
 * da progressão (pisos rachados, escadas funcionais, buracos, warps comportamentais,
 * gelo, correnteza etc.).
 *
 * Quando o prompt pede explicitamente preservar "comportamentos funcionais",
 * qualquer célula do mapa real cujo behavior conhecido seja diferente de NORMAL
 * é restaurada integralmente e marcada como preserve antes do finish layer.
 * Isso evita que um retângulo de piso-base apague a mecânica mesmo quando a célula
 * original era caminhável e tinha collision=0.
 */
export function protectExactGridFunctionalBehaviors({
  sourceMap,
  layered,
  atlas,
  prompt,
}: {
  sourceMap: MapData;
  layered: LayeredBasePlan;
  atlas: SavedRealAtlas;
  prompt: string;
}): ExactGridFunctionalBehaviorSafetyStats {
  const key = normalize(prompt);
  const enabled = /preserv\w*[^\n]{0,80}\bcomportament\w*\s+funcion\w*/.test(key);
  if (!enabled || !layered.active) return { enabled, protectedCount: 0 };

  const behaviorById = new Map(
    atlas.records.map((record) => [record.id & METATILE_MASK, record.behavior]),
  );

  let protectedCount = 0;
  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    const sourceId = (sourceMap.metatiles[i] ?? 0) & METATILE_MASK;
    const behavior = behaviorById.get(sourceId);
    if (behavior == null || behavior === NORMAL_GROUND_BEHAVIOR) continue;

    const owner = layered.occupancy[i];
    if (owner === LAYER_OCCUPANCY.reserved || owner === LAYER_OCCUPANCY.structure) continue;

    layered.map.metatiles[i] = sourceMap.metatiles[i] ?? 0;
    layered.map.physical[i] = sourceMap.physical[i] ?? 0;
    layered.occupancy[i] = LAYER_OCCUPANCY.reserved;
    protectedCount++;
  }

  if (protectedCount) {
    layered.warnings.push(
      `Segurança de comportamento funcional: ${protectedCount} célula(s) com behavior não-NORMAL foram restauradas do mapa real e marcadas como preserve.`,
    );
  }

  return { enabled, protectedCount };
}
