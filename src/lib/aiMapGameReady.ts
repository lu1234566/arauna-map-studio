import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapBlueprint } from "./mapBlueprint";
import type { MapPattern } from "./patternLibrary";

function warpAnchor(pattern: MapPattern) {
  for (const tag of pattern.tags ?? []) {
    const match = tag.match(/^warp-anchor:\s*(-?\d+)\s*,\s*(-?\d+)$/i);
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
  }
  return null;
}

/**
 * Última barreira antes de aplicar um plano de IA sobre um mapa real.
 * O planner já recebe as células reservadas, mas esta verificação é local e
 * determinística: nenhuma resposta ruim do modelo consegue carimbar um prédio
 * sobre warp/trigger/NPC conhecido.
 */
export function gameReadyStructureConflicts(
  blueprint: MapBlueprint | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
): string[] {
  if (!blueprint) return [];
  const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const conflicts: string[] = [];

  for (const placement of blueprint.patterns) {
    const pattern = patternById.get(placement.pattern);
    if (!pattern) continue;
    const anchor = warpAnchor(pattern);
    const left = placement.x;
    const top = placement.y;
    const right = left + pattern.width - 1;
    const bottom = top + pattern.height - 1;

    for (const cell of reservedCells) {
      if (cell.x < left || cell.x > right || cell.y < top || cell.y > bottom) continue;
      if (cell.kind === "warp" && anchor && cell.x === anchor.x && cell.y === anchor.y) continue;
      conflicts.push(
        `${pattern.name} em (${placement.x},${placement.y}) cobre ${cell.kind} “${cell.label}” em (${cell.x},${cell.y}).`,
      );
      if (conflicts.length >= 12) return conflicts;
    }
  }
  return conflicts;
}
