import {
  getCollision,
  getElevation,
  METATILE_MASK,
  type MapData,
} from "./emeraldMap";
import { gameReadyStructureConflicts } from "./aiMapGameReady";
import {
  finishLayeredPromptMap,
  LAYER_OCCUPANCY,
  planLayeredPromptBase,
  type LayeredBasePlan,
  type LayeredFinishPlan,
} from "./aiLayeredPrompt";
import type { AiMapCompileResult } from "./aiMapPlan";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import { planMapTemplate } from "./mapTemplate";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

export const AI_EXACT_GRID_FORMAT = "arauna-exact-grid-v1" as const;

export type ExactGridOwner =
  | "ground"
  | "road"
  | "structure"
  | "detail"
  | "preserve";

export interface ExactGridCell {
  x: number;
  y: number;
  metatile: number;
  physical: number;
  collision: number;
  elevation: number;
  owner: ExactGridOwner;
  changed: boolean;
}

export interface AiExactGridPlan {
  format: typeof AI_EXACT_GRID_FORMAT;
  active: boolean;
  valid: boolean;
  width: number;
  height: number;
  totalCount: number;
  resolvedCount: number;
  changedCount: number;
  layeredMetatileCount: number;
  checksum: string;
  ownerCounts: Record<ExactGridOwner, number>;
  map: MapData;
  cells: ExactGridCell[];
  touched: number[];
  layered: LayeredBasePlan | null;
  finish: LayeredFinishPlan | null;
  errors: string[];
  warnings: string[];
}

export interface CompileAiExactGridArgs {
  sourceMap: MapData;
  prompt: string;
  compiled: AiMapCompileResult;
  atlas: SavedRealAtlas | null;
  patterns: MapPattern[];
  smartPaths: SmartPathPreset[];
  reservedCells: AiReservedCell[];
  reconstruction: AiMapReconstructionPlan | null;
  portMetatile: number | null;
  canPaint?: (x: number, y: number) => boolean;
}

const EMPTY_OWNER_COUNTS: Record<ExactGridOwner, number> = {
  ground: 0,
  road: 0,
  structure: 0,
  detail: 0,
  preserve: 0,
};

function cloneOwnerCounts() {
  return { ...EMPTY_OWNER_COUNTS };
}

function emptyPlan(sourceMap: MapData, errors: string[] = []): AiExactGridPlan {
  return {
    format: AI_EXACT_GRID_FORMAT,
    active: false,
    valid: false,
    width: sourceMap.width,
    height: sourceMap.height,
    totalCount: sourceMap.width * sourceMap.height,
    resolvedCount: 0,
    changedCount: 0,
    layeredMetatileCount: 0,
    checksum: "--------",
    ownerCounts: cloneOwnerCounts(),
    map: sourceMap,
    cells: [],
    touched: [],
    layered: null,
    finish: null,
    errors,
    warnings: [],
  };
}

function ownerFor(layered: LayeredBasePlan, cellIndex: number): ExactGridOwner {
  const occupancy = layered.occupancy[cellIndex];
  if (occupancy === LAYER_OCCUPANCY.structure) return "structure";
  if (occupancy === LAYER_OCCUPANCY.road) return "road";
  if (occupancy === LAYER_OCCUPANCY.detail) return "detail";
  if (occupancy === LAYER_OCCUPANCY.reserved) return "preserve";
  if (occupancy === LAYER_OCCUPANCY.base) return "ground";
  return "preserve";
}

function fnv1a(cells: ExactGridCell[]) {
  let hash = 0x811c9dc5;
  for (const cell of cells) {
    hash ^= cell.metatile & 0xffff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= cell.physical & 0xffff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= cell.owner.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Compila o pipeline A+B inteiro para uma matriz final imutável antes de qualquer
 * escrita no editor. A IA escolhe composição; este compilador decide cada uma das
 * width*height células e valida o resultado usando o atlas GBA real.
 */
export function compileAiExactGrid({
  sourceMap,
  prompt,
  compiled,
  atlas,
  patterns,
  smartPaths,
  reservedCells,
  reconstruction,
  portMetatile,
  canPaint = () => true,
}: CompileAiExactGridArgs): AiExactGridPlan {
  if (!compiled.valid || !compiled.template || !compiled.blueprint) {
    return emptyPlan(sourceMap, ["Exact Grid exige um plano estruturado compilável."]);
  }
  if (!atlas || !reconstruction) {
    return emptyPlan(sourceMap, ["Exact Grid exige atlas real e vocabulário de reconstrução carregados."]);
  }

  const layered = planLayeredPromptBase(
    sourceMap,
    prompt,
    atlas,
    patterns,
    reservedCells,
    reconstruction,
    portMetatile,
    compiled.blueprint,
  );
  if (!layered.active) {
    const inactive = emptyPlan(sourceMap);
    inactive.layered = layered;
    return inactive;
  }

  const errors = [...layered.errors];
  const warnings = [...layered.warnings];
  if (layered.parsed.strictIsolation && layered.unsetCount > 0) {
    errors.push(
      `Exact Grid estrito exige dono explícito para toda célula terrestre editável; ${layered.unsetCount} célula(s) ficaram UNSET.`,
    );
  }
  const conflicts = gameReadyStructureConflicts(compiled.blueprint, patterns, reservedCells);
  if (conflicts.length) errors.push(...conflicts.map((value) => `Segurança de mapa real: ${value}`));
  if (errors.length) {
    return {
      ...emptyPlan(sourceMap, errors),
      active: true,
      layered,
      warnings,
    };
  }

  const scope = { primary: atlas.primary, secondary: atlas.secondary };
  const templatePlan = planMapTemplate(
    layered.map,
    compiled.template,
    0,
    0,
    patterns,
    smartPaths,
    scope,
    canPaint,
  );
  if (!templatePlan.valid) {
    return {
      ...emptyPlan(sourceMap, templatePlan.errors.map((value) => `Template Exact Grid: ${value}`)),
      active: true,
      layered,
      warnings: [...warnings, ...templatePlan.warnings],
    };
  }

  const finish = finishLayeredPromptMap(templatePlan.map, layered, atlas, smartPaths);
  const map = finish.map;
  warnings.push(...templatePlan.warnings, ...finish.warnings);

  const recordById = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
  const cells: ExactGridCell[] = [];
  const touched: number[] = [];
  const ownerCounts = cloneOwnerCounts();
  let layeredMetatileCount = 0;

  for (let i = 0; i < map.metatiles.length; i++) {
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    const metatile = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const physical = (map.physical[i] ?? 0) & 0xffff;
    const record = recordById.get(metatile);
    if (!record) {
      if (errors.length < 12) errors.push(`Exact Grid (${x},${y}): metatile 0x${metatile.toString(16).toUpperCase().padStart(3, "0")} não existe no atlas ativo.`);
      continue;
    }
    if ((record.layerType ?? 0) > 0) layeredMetatileCount++;
    const owner = ownerFor(layered, i);
    ownerCounts[owner]++;
    const changed = (
      (sourceMap.metatiles[i] ?? 0) !== (map.metatiles[i] ?? 0)
      || (sourceMap.physical[i] ?? 0) !== (map.physical[i] ?? 0)
    );
    if (changed) touched.push(i);
    cells.push({
      x,
      y,
      metatile,
      physical,
      collision: getCollision(physical),
      elevation: getElevation(physical),
      owner,
      changed,
    });
  }

  const totalCount = sourceMap.width * sourceMap.height;
  const resolvedCount = cells.length;
  if (resolvedCount !== totalCount) {
    errors.push(`Exact Grid incompleto: ${resolvedCount}/${totalCount} células foram resolvidas.`);
  }

  const checksum = fnv1a(cells);
  if (!errors.length) {
    warnings.push(
      `Exact Grid ${sourceMap.width}×${sourceMap.height}: ${resolvedCount}/${totalCount} células resolvidas, ${touched.length} diferente(s) do mapa aberto; checksum ${checksum}.`,
    );
  }

  return {
    format: AI_EXACT_GRID_FORMAT,
    active: true,
    valid: errors.length === 0 && resolvedCount === totalCount,
    width: sourceMap.width,
    height: sourceMap.height,
    totalCount,
    resolvedCount,
    changedCount: touched.length,
    layeredMetatileCount,
    checksum,
    ownerCounts,
    map,
    cells,
    touched,
    layered,
    finish,
    errors,
    warnings,
  };
}

export function serializeAiExactGrid(grid: AiExactGridPlan) {
  const payload = {
    format: grid.format,
    width: grid.width,
    height: grid.height,
    checksum: grid.checksum,
    resolved: grid.resolvedCount,
    total: grid.totalCount,
    ownerCounts: grid.ownerCounts,
    cells: grid.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      metatile: `0x${cell.metatile.toString(16).toUpperCase().padStart(3, "0")}`,
      physical: `0x${cell.physical.toString(16).toUpperCase().padStart(4, "0")}`,
      collision: cell.collision,
      elevation: cell.elevation,
      owner: cell.owner,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
