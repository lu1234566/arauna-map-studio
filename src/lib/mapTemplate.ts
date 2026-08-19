import {
  COLLISION_MASK,
  COLLISION_SHIFT,
  ELEVATION_MASK,
  ELEVATION_SHIFT,
  METATILE_MASK,
  PHYSICAL_MASK,
  cloneMap,
  idx,
  type MapData,
} from "./emeraldMap";
import { validateMapPattern, type MapPattern, type PatternScope } from "./patternLibrary";
import {
  applySmartPathPlan,
  planSmartPath,
  validateSmartPathPreset,
  type SmartPathMode,
  type SmartPathPreset,
} from "./smartPath";

export const MAP_TEMPLATE_FORMAT = "arauna-map-template-v1" as const;

export interface TemplatePoint {
  x: number;
  y: number;
}

export interface TemplatePatternPlacement {
  type: "pattern";
  patternId: string;
  x: number;
  y: number;
}

export interface TemplateSmartPathPlacement {
  type: "smartPath";
  presetId: string;
  points: TemplatePoint[];
  mode?: SmartPathMode;
}

export type TemplateElement = TemplatePatternPlacement | TemplateSmartPathPlacement;

export interface MapTemplate {
  format: typeof MAP_TEMPLATE_FORMAT;
  id: string;
  name: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
  scope?: PatternScope;
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TemplateDependencies {
  valid: boolean;
  errors: string[];
  warnings: string[];
  patternIds: string[];
  smartPathIds: string[];
}

export interface TemplatePlan {
  valid: boolean;
  map: MapData;
  touched: number[];
  protectedCount: number;
  outOfBoundsCount: number;
  errors: string[];
  warnings: string[];
}

function validInteger(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function scopeMatches(scope: PatternScope | undefined, current: PatternScope | undefined) {
  if (!scope) return true;
  if (!current) return false;
  return scope.primary === current.primary && scope.secondary === current.secondary;
}

export function createMapTemplate(
  name = "Novo template",
  width = 20,
  height = 20,
  scope?: PatternScope,
): MapTemplate {
  const now = new Date().toISOString();
  return {
    format: MAP_TEMPLATE_FORMAT,
    id: `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Novo template",
    category: "Geral",
    tags: [],
    width: Math.max(1, Math.min(512, Math.floor(width))),
    height: Math.max(1, Math.min(512, Math.floor(height))),
    ...(scope ? { scope: { ...scope } } : {}),
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function validateMapTemplate(template: MapTemplate): TemplateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (template.format !== MAP_TEMPLATE_FORMAT) errors.push("Formato de template incompatível.");
  if (!template.id.trim()) errors.push("Template sem id.");
  if (!template.name.trim()) errors.push("Template sem nome.");
  if (!validInteger(template.width, 1, 512)) errors.push(`Largura inválida: ${template.width}.`);
  if (!validInteger(template.height, 1, 512)) errors.push(`Altura inválida: ${template.height}.`);
  if (!Array.isArray(template.elements)) errors.push("Lista de elementos inválida.");
  if (template.scope && (!template.scope.primary.trim() || !template.scope.secondary.trim())) {
    errors.push("Escopo de tileset incompleto.");
  }

  template.elements?.forEach((element, index) => {
    if (element.type === "pattern") {
      if (!element.patternId.trim()) errors.push(`Elemento ${index + 1}: patternId vazio.`);
      if (!Number.isInteger(element.x) || !Number.isInteger(element.y)) {
        errors.push(`Elemento ${index + 1}: posição de pattern inválida.`);
      }
      return;
    }
    if (element.type === "smartPath") {
      if (!element.presetId.trim()) errors.push(`Elemento ${index + 1}: presetId vazio.`);
      if (!Array.isArray(element.points) || element.points.length < 1) {
        errors.push(`Elemento ${index + 1}: Smart Path precisa de pelo menos um ponto.`);
        return;
      }
      element.points.forEach((point, pointIndex) => {
        if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
          errors.push(`Elemento ${index + 1}, ponto ${pointIndex + 1}: coordenada inválida.`);
        }
      });
      for (let p = 1; p < element.points.length; p++) {
        const a = element.points[p - 1]!;
        const b = element.points[p]!;
        if (a.x !== b.x && a.y !== b.y) {
          errors.push(`Elemento ${index + 1}: segmento ${p}→${p + 1} não é ortogonal.`);
        }
      }
      return;
    }
    errors.push(`Elemento ${index + 1}: tipo desconhecido.`);
  });

  if (!template.elements?.length) warnings.push("Template ainda não possui elementos.");
  if (!template.category.trim()) warnings.push("Template sem categoria.");
  return { valid: errors.length === 0, errors, warnings };
}

export function templateDependencies(
  template: MapTemplate,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  currentScope?: PatternScope,
): TemplateDependencies {
  const base = validateMapTemplate(template);
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  const patternIds = Array.from(new Set(template.elements.filter((e): e is TemplatePatternPlacement => e.type === "pattern").map((e) => e.patternId)));
  const smartPathIds = Array.from(new Set(template.elements.filter((e): e is TemplateSmartPathPlacement => e.type === "smartPath").map((e) => e.presetId)));
  const patternMap = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const pathMap = new Map(smartPaths.map((preset) => [preset.id, preset]));

  if (template.scope && !scopeMatches(template.scope, currentScope)) {
    errors.push(currentScope
      ? `Template pertence a ${template.scope.primary} + ${template.scope.secondary}; atlas atual é ${currentScope.primary} + ${currentScope.secondary}.`
      : `Template é vinculado a ${template.scope.primary} + ${template.scope.secondary}, mas nenhum atlas real está carregado.`);
  }

  for (const id of patternIds) {
    const pattern = patternMap.get(id);
    if (!pattern) {
      errors.push(`Padrão ausente: ${id}.`);
      continue;
    }
    const validation = validateMapPattern(pattern);
    if (!validation.valid) errors.push(`Padrão “${pattern.name}” inválido: ${validation.errors.join(" ")}`);
    if (pattern.scope && !scopeMatches(pattern.scope, currentScope)) {
      errors.push(`Padrão “${pattern.name}” não corresponde ao atlas atual.`);
    }
  }

  for (const id of smartPathIds) {
    const preset = pathMap.get(id);
    if (!preset) {
      errors.push(`Smart Path ausente: ${id}.`);
      continue;
    }
    const validation = validateSmartPathPreset(preset);
    if (!validation.valid) errors.push(`Smart Path “${preset.name}” inválido: ${validation.errors.join(" ")}`);
    if (preset.scope && !scopeMatches(preset.scope, currentScope)) {
      errors.push(`Smart Path “${preset.name}” não corresponde ao atlas atual.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, patternIds, smartPathIds };
}

export function expandOrthogonalPolyline(points: TemplatePoint[]): TemplatePoint[] {
  if (!points.length) return [];
  const result: TemplatePoint[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (from.x !== to.x && from.y !== to.y) {
      throw new Error(`Segmento ${i}→${i + 1} não é ortogonal.`);
    }
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x;
    let y = from.y;
    while (x !== to.x || y !== to.y) {
      x += dx;
      y += dy;
      result.push({ x, y });
    }
  }
  return result;
}

function applyPatternToWorkingMap(
  map: MapData,
  pattern: MapPattern,
  originX: number,
  originY: number,
  canEdit: (x: number, y: number) => boolean,
  touched: Set<number>,
) {
  let protectedCount = 0;
  let outOfBoundsCount = 0;
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const tx = originX + x;
      const ty = originY + y;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
        outOfBoundsCount++;
        continue;
      }
      if (!canEdit(tx, ty)) {
        protectedCount++;
        continue;
      }
      const sourceIndex = idx(x, y, pattern.width);
      const targetIndex = idx(tx, ty, map.width);
      const value = pattern.values[sourceIndex] ?? 0;
      if (pattern.kind === "visual") {
        map.metatiles[targetIndex] = value & METATILE_MASK;
      } else if (pattern.kind === "collision") {
        map.physical[targetIndex] = ((map.physical[targetIndex] ?? 0) & ~COLLISION_MASK) | ((value << COLLISION_SHIFT) & COLLISION_MASK);
      } else if (pattern.kind === "elevation") {
        map.physical[targetIndex] = ((map.physical[targetIndex] ?? 0) & ~ELEVATION_MASK) | ((value << ELEVATION_SHIFT) & ELEVATION_MASK);
      } else {
        map.metatiles[targetIndex] = value & METATILE_MASK;
        map.physical[targetIndex] = value & PHYSICAL_MASK;
      }
      touched.add(targetIndex);
    }
  }
  return { protectedCount, outOfBoundsCount };
}

export function planMapTemplate(
  sourceMap: MapData,
  template: MapTemplate,
  originX: number,
  originY: number,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  currentScope?: PatternScope,
  canEdit: (x: number, y: number) => boolean = () => true,
): TemplatePlan {
  const dependencies = templateDependencies(template, patterns, smartPaths, currentScope);
  const working = cloneMap(sourceMap);
  if (!dependencies.valid) {
    return {
      valid: false,
      map: working,
      touched: [],
      protectedCount: 0,
      outOfBoundsCount: 0,
      errors: dependencies.errors,
      warnings: dependencies.warnings,
    };
  }

  const patternMap = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const pathMap = new Map(smartPaths.map((preset) => [preset.id, preset]));
  const touched = new Set<number>();
  let protectedCount = 0;
  let outOfBoundsCount = 0;
  const warnings = [...dependencies.warnings];

  for (const element of template.elements) {
    if (element.type === "pattern") {
      const pattern = patternMap.get(element.patternId)!;
      const result = applyPatternToWorkingMap(
        working,
        pattern,
        originX + element.x,
        originY + element.y,
        canEdit,
        touched,
      );
      protectedCount += result.protectedCount;
      outOfBoundsCount += result.outOfBoundsCount;
      continue;
    }

    const preset = pathMap.get(element.presetId)!;
    const points = expandOrthogonalPolyline(element.points);
    for (const point of points) {
      const x = originX + point.x;
      const y = originY + point.y;
      if (x < 0 || y < 0 || x >= working.width || y >= working.height) {
        outOfBoundsCount++;
        continue;
      }
      const plan = planSmartPath(
        working,
        preset,
        x,
        y,
        element.mode ?? "add",
        canEdit,
      );
      protectedCount += plan.skippedProtected.length;
      for (const update of plan.updates) touched.add(update.index);
      const next = applySmartPathPlan(working, plan);
      working.metatiles = next.metatiles;
      working.physical = next.physical;
    }
  }

  if (outOfBoundsCount) warnings.push(`${outOfBoundsCount} célula(s) do template ficaram fora do mapa.`);
  if (protectedCount) warnings.push(`${protectedCount} célula(s) protegida(s) foram preservadas.`);
  return {
    valid: true,
    map: working,
    touched: Array.from(touched),
    protectedCount,
    outOfBoundsCount,
    errors: [],
    warnings,
  };
}

export function parseMapTemplateJson(source: string): MapTemplate[] {
  const parsed = JSON.parse(source) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Template ${index + 1}: objeto inválido.`);
    }
    const raw = value as Record<string, unknown>;
    const scopeRaw = raw.scope;
    const scope = scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)
      ? {
          primary: String((scopeRaw as Record<string, unknown>).primary ?? ""),
          secondary: String((scopeRaw as Record<string, unknown>).secondary ?? ""),
        }
      : undefined;
    const elementsRaw = Array.isArray(raw.elements) ? raw.elements : [];
    const elements: TemplateElement[] = elementsRaw.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Elemento de template inválido.");
      const item = entry as Record<string, unknown>;
      if (item.type === "pattern") {
        return {
          type: "pattern",
          patternId: String(item.patternId ?? ""),
          x: Number(item.x),
          y: Number(item.y),
        };
      }
      if (item.type === "smartPath") {
        const points = Array.isArray(item.points)
          ? item.points.map((point) => {
              const p = point as Record<string, unknown>;
              return { x: Number(p?.x), y: Number(p?.y) };
            })
          : [];
        return {
          type: "smartPath",
          presetId: String(item.presetId ?? ""),
          points,
          mode: item.mode === "erase" ? "erase" : "add",
        };
      }
      throw new Error(`Tipo de elemento desconhecido: ${String(item.type)}.`);
    });
    const template: MapTemplate = {
      format: MAP_TEMPLATE_FORMAT,
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      category: String(raw.category ?? "Geral"),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      width: Number(raw.width),
      height: Number(raw.height),
      ...(scope ? { scope } : {}),
      elements,
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    };
    const validation = validateMapTemplate(template);
    if (!validation.valid) throw new Error(`Template ${index + 1}: ${validation.errors.join(" ")}`);
    return template;
  });
}

export function serializeMapTemplates(templates: MapTemplate[]): string {
  templates.forEach((template) => {
    const validation = validateMapTemplate(template);
    if (!validation.valid) throw new Error(`${template.name}: ${validation.errors.join(" ")}`);
  });
  return `${JSON.stringify(templates.length === 1 ? templates[0] : templates, null, 2)}\n`;
}
