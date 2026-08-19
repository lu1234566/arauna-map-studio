import { compileMapBlueprint, type MapBlueprint } from "./mapBlueprint";
import type { MapPattern, PatternScope } from "./patternLibrary";
import {
  generateProceduralBlueprint,
  type ProceduralBlueprintResult,
  type ProceduralBlueprintSpec,
  type ProceduralPatternPlacement,
  type ProceduralRoad,
} from "./proceduralBlueprint";
import type { SmartPathPreset } from "./smartPath";
import type { TemplatePoint } from "./mapTemplate";

function pointInside(point: TemplatePoint, placement: ProceduralPatternPlacement) {
  return point.x >= placement.x &&
    point.y >= placement.y &&
    point.x < placement.x + placement.width &&
    point.y < placement.y + placement.height;
}

function expandSegment(a: TemplatePoint, b: TemplatePoint): TemplatePoint[] {
  if (a.x !== b.x && a.y !== b.y) return [];
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  const result: TemplatePoint[] = [{ ...a }];
  let x = a.x;
  let y = a.y;
  while (x !== b.x || y !== b.y) {
    x += dx;
    y += dy;
    result.push({ x, y });
  }
  return result;
}

export function proceduralRoadCrossesPatterns(
  road: ProceduralRoad,
  placements: ProceduralPatternPlacement[],
): boolean {
  const cells: TemplatePoint[] = [];
  for (let i = 1; i < road.points.length; i++) {
    const segment = expandSegment(road.points[i - 1]!, road.points[i]!);
    if (!segment.length) return true;
    cells.push(...(i === 1 ? segment : segment.slice(1)));
  }
  if (road.points.length === 1) cells.push({ ...road.points[0]! });
  return cells.some((point) => placements.some((placement) => pointInside(point, placement)));
}

/**
 * Public safe entry point for procedural generation. The low-level planner can
 * fall back to a Manhattan line when grid routing has no solution; this guard
 * refuses to compile any fallback that would paint a Smart Path through a
 * saved structure.
 */
export function generateSafeProceduralBlueprint(
  spec: ProceduralBlueprintSpec,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  currentScope?: PatternScope,
): ProceduralBlueprintResult {
  const result = generateProceduralBlueprint(spec, patterns, smartPaths, currentScope);
  if (!result.ok || !result.blueprint || !result.compiled?.template) return result;

  const keep = result.roads.map((road) => !proceduralRoadCrossesPatterns(road, result.placements));
  const removed = keep.filter((value) => !value).length;
  if (!removed) return result;

  const safeRoads = result.roads.filter((_, index) => keep[index]);
  const safeBlueprint: MapBlueprint = {
    ...result.blueprint,
    patterns: result.blueprint.patterns.map((placement) => ({ ...placement })),
    routes: result.blueprint.routes
      .filter((_, index) => keep[index])
      .map((route) => ({
        ...route,
        points: route.points.map((point) => ({ ...point })),
      })),
  };
  const compiled = compileMapBlueprint(safeBlueprint, patterns, smartPaths);
  if (compiled.template && currentScope && !compiled.template.scope) {
    compiled.template.scope = { ...currentScope };
  }
  if (!compiled.valid || !compiled.template) {
    return {
      ...result,
      ok: false,
      blueprint: null,
      compiled: null,
      roads: safeRoads,
      errors: [...result.errors, ...compiled.errors],
      warnings: [...result.warnings, `${removed} rota(s) insegura(s) foram removidas antes da compilação.`],
    };
  }
  return {
    ...result,
    blueprint: safeBlueprint,
    compiled,
    roads: safeRoads,
    warnings: Array.from(new Set([
      ...result.warnings,
      `${removed} rota(s) foram omitidas porque atravessariam uma estrutura salva.`,
    ])),
  };
}
