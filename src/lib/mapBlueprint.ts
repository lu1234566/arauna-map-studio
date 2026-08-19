import {
  createMapTemplate,
  templateDependencies,
  validateMapTemplate,
  type MapTemplate,
  type TemplatePoint,
} from "./mapTemplate";
import { validateMapPattern, type MapPattern, type PatternScope } from "./patternLibrary";
import { validateSmartPathPreset, type SmartPathPreset } from "./smartPath";

export const MAP_BLUEPRINT_FORMAT = "arauna-map-blueprint-v1" as const;

export interface BlueprintExits {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

export interface MapBlueprintSpec {
  format: typeof MAP_BLUEPRINT_FORMAT;
  name: string;
  category: string;
  seed: string;
  width: number;
  height: number;
  centerPatternId?: string;
  landmarkPatternIds: string[];
  fillerPatternIds: string[];
  fillerCount: number;
  roadPresetId?: string;
  exits: BlueprintExits;
  margin: number;
  spacing: number;
}

export type BlueprintPlacementRole = "center" | "landmark" | "filler";

export interface BlueprintPatternPlacement {
  role: BlueprintPlacementRole;
  patternId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: TemplatePoint;
}

export interface BlueprintRoad {
  kind: "landmark" | "exit";
  label: string;
  points: TemplatePoint[];
}

export interface BlueprintResult {
  ok: boolean;
  template: MapTemplate | null;
  placements: BlueprintPatternPlacement[];
  roads: BlueprintRoad[];
  warnings: string[];
  errors: string[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
}

const CARDINALS: TemplatePoint[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function hashSeed(source: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: string): Rng {
  let state = hashSeed(seed || "arauna");
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      if (hi <= lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
  };
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min)));
}

function scopeMatches(scope: PatternScope | undefined, current: PatternScope | undefined) {
  if (!scope) return true;
  return Boolean(current && scope.primary === current.primary && scope.secondary === current.secondary);
}

function rectFor(placement: BlueprintPatternPlacement): Rect {
  return { x: placement.x, y: placement.y, w: placement.width, h: placement.height };
}

function intersectsWithSpacing(a: Rect, b: Rect, spacing: number) {
  return !(
    a.x + a.w + spacing <= b.x ||
    b.x + b.w + spacing <= a.x ||
    a.y + a.h + spacing <= b.y ||
    b.y + b.h + spacing <= a.y
  );
}

function fitsBounds(rect: Rect, width: number, height: number, margin: number) {
  return rect.x >= margin && rect.y >= margin && rect.x + rect.w <= width - margin && rect.y + rect.h <= height - margin;
}

function anchorFor(rect: Rect, width: number, height: number): TemplatePoint {
  const x = clampInt(rect.x + Math.floor(rect.w / 2), 0, width - 1);
  const below = rect.y + rect.h;
  if (below < height) return { x, y: below };
  return { x, y: clampInt(rect.y - 1, 0, height - 1) };
}

function placementFor(
  role: BlueprintPlacementRole,
  pattern: MapPattern,
  x: number,
  y: number,
  width: number,
  height: number,
): BlueprintPatternPlacement {
  const rect = { x, y, w: pattern.width, h: pattern.height };
  return {
    role,
    patternId: pattern.id,
    x,
    y,
    width: pattern.width,
    height: pattern.height,
    anchor: anchorFor(rect, width, height),
  };
}

function canPlace(rect: Rect, occupied: Rect[], width: number, height: number, margin: number, spacing: number) {
  return fitsBounds(rect, width, height, margin) && !occupied.some((other) => intersectsWithSpacing(rect, other, spacing));
}

function shuffled<T>(values: T[], rng: Rng): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function ringCandidate(
  pattern: MapPattern,
  index: number,
  count: number,
  width: number,
  height: number,
  rng: Rng,
): Rect {
  const angle = (Math.PI * 2 * index) / Math.max(1, count) + (rng.next() - 0.5) * 0.7;
  const rx = Math.max(pattern.width + 2, width * (0.28 + rng.next() * 0.08));
  const ry = Math.max(pattern.height + 2, height * (0.28 + rng.next() * 0.08));
  const cx = width / 2 + Math.cos(angle) * rx;
  const cy = height / 2 + Math.sin(angle) * ry;
  return {
    x: Math.round(cx - pattern.width / 2),
    y: Math.round(cy - pattern.height / 2),
    w: pattern.width,
    h: pattern.height,
  };
}

function findPlacement(
  pattern: MapPattern,
  occupied: Rect[],
  width: number,
  height: number,
  margin: number,
  spacing: number,
  rng: Rng,
  preferred?: Rect,
): Rect | null {
  if (preferred) {
    const jitter = Math.max(2, spacing + 2);
    const candidates: Rect[] = [{ ...preferred }];
    for (let i = 0; i < 80; i++) {
      candidates.push({
        x: preferred.x + rng.int(-jitter * 2, jitter * 2),
        y: preferred.y + rng.int(-jitter * 2, jitter * 2),
        w: pattern.width,
        h: pattern.height,
      });
    }
    for (const candidate of candidates) {
      if (canPlace(candidate, occupied, width, height, margin, spacing)) return candidate;
    }
  }

  const maxX = width - margin - pattern.width;
  const maxY = height - margin - pattern.height;
  if (maxX < margin || maxY < margin) return null;
  for (let i = 0; i < 500; i++) {
    const rect: Rect = {
      x: rng.int(margin, maxX),
      y: rng.int(margin, maxY),
      w: pattern.width,
      h: pattern.height,
    };
    if (canPlace(rect, occupied, width, height, margin, spacing)) return rect;
  }
  return null;
}

function blockedCells(width: number, height: number, placements: BlueprintPatternPlacement[]): Uint8Array {
  const blocked = new Uint8Array(width * height);
  for (const placement of placements) {
    for (let y = placement.y; y < placement.y + placement.height; y++) {
      for (let x = placement.x; x < placement.x + placement.width; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) blocked[y * width + x] = 1;
      }
    }
  }
  return blocked;
}

function compressPath(path: TemplatePoint[]): TemplatePoint[] {
  if (path.length <= 2) return path.map((point) => ({ ...point }));
  const result: TemplatePoint[] = [{ ...path[0]! }];
  let lastDx = path[1]!.x - path[0]!.x;
  let lastDy = path[1]!.y - path[0]!.y;
  for (let i = 2; i < path.length; i++) {
    const previous = path[i - 1]!;
    const current = path[i]!;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (dx !== lastDx || dy !== lastDy) result.push({ ...previous });
    lastDx = dx;
    lastDy = dy;
  }
  result.push({ ...path[path.length - 1]! });
  return result;
}

function fallbackManhattan(start: TemplatePoint, end: TemplatePoint, rng: Rng): TemplatePoint[] {
  if (start.x === end.x || start.y === end.y) return [{ ...start }, { ...end }];
  const horizontalFirst = rng.next() < 0.5;
  const bend = horizontalFirst
    ? { x: end.x, y: start.y }
    : { x: start.x, y: end.y };
  return [{ ...start }, bend, { ...end }];
}

/**
 * Breadth-first routing over metatile cells. Buildings are obstacles; roads may
 * cross other roads. The output is compressed into orthogonal waypoints that a
 * Smart Path placement can consume directly.
 */
export function routeBlueprintRoad(
  width: number,
  height: number,
  start: TemplatePoint,
  end: TemplatePoint,
  placements: BlueprintPatternPlacement[],
  rng = createRng(`${start.x},${start.y}-${end.x},${end.y}`),
): { points: TemplatePoint[]; usedFallback: boolean } {
  if (start.x < 0 || start.y < 0 || start.x >= width || start.y >= height) {
    return { points: fallbackManhattan(start, end, rng), usedFallback: true };
  }
  if (end.x < 0 || end.y < 0 || end.x >= width || end.y >= height) {
    return { points: fallbackManhattan(start, end, rng), usedFallback: true };
  }
  const blocked = blockedCells(width, height, placements);
  blocked[start.y * width + start.x] = 0;
  blocked[end.y * width + end.x] = 0;
  const size = width * height;
  const previous = new Int32Array(size);
  previous.fill(-1);
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  const startIndex = start.y * width + start.x;
  const endIndex = end.y * width + end.x;
  queue[tail++] = startIndex;
  seen[startIndex] = 1;
  const directionOrder = shuffled(CARDINALS, rng);

  while (head < tail && !seen[endIndex]) {
    const currentIndex = queue[head++]!;
    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    for (const direction of directionOrder) {
      const nx = x + direction.x;
      const ny = y + direction.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nextIndex = ny * width + nx;
      if (seen[nextIndex] || blocked[nextIndex]) continue;
      seen[nextIndex] = 1;
      previous[nextIndex] = currentIndex;
      queue[tail++] = nextIndex;
      if (nextIndex === endIndex) break;
    }
  }

  if (!seen[endIndex]) return { points: fallbackManhattan(start, end, rng), usedFallback: true };
  const path: TemplatePoint[] = [];
  let cursor = endIndex;
  while (cursor !== -1) {
    path.push({ x: cursor % width, y: Math.floor(cursor / width) });
    if (cursor === startIndex) break;
    cursor = previous[cursor] ?? -1;
  }
  path.reverse();
  return { points: compressPath(path), usedFallback: false };
}

function normalizeSpec(spec: MapBlueprintSpec): MapBlueprintSpec {
  return {
    format: MAP_BLUEPRINT_FORMAT,
    name: spec.name.trim() || "Mapa Gerado",
    category: spec.category.trim() || "Gerados",
    seed: spec.seed || "arauna",
    width: clampInt(spec.width, 5, 512),
    height: clampInt(spec.height, 5, 512),
    ...(spec.centerPatternId?.trim() ? { centerPatternId: spec.centerPatternId.trim() } : {}),
    landmarkPatternIds: [...spec.landmarkPatternIds],
    fillerPatternIds: [...spec.fillerPatternIds],
    fillerCount: clampInt(spec.fillerCount, 0, 512),
    ...(spec.roadPresetId?.trim() ? { roadPresetId: spec.roadPresetId.trim() } : {}),
    exits: { ...spec.exits },
    margin: clampInt(spec.margin, 0, 32),
    spacing: clampInt(spec.spacing, 0, 16),
  };
}

export function createBlueprintSpec(width = 30, height = 24): MapBlueprintSpec {
  return {
    format: MAP_BLUEPRINT_FORMAT,
    name: "Vila Gerada",
    category: "Vilas",
    seed: "arauna-001",
    width,
    height,
    landmarkPatternIds: [],
    fillerPatternIds: [],
    fillerCount: 4,
    exits: { north: true, east: false, south: true, west: false },
    margin: 1,
    spacing: 1,
  };
}

export function generateMapBlueprint(
  input: MapBlueprintSpec,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  currentScope?: PatternScope,
): BlueprintResult {
  const spec = normalizeSpec(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (spec.format !== MAP_BLUEPRINT_FORMAT) errors.push("Formato de blueprint incompatível.");
  if (spec.margin * 2 >= spec.width || spec.margin * 2 >= spec.height) errors.push("Margem ocupa todo o mapa.");

  const patternMap = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const pathMap = new Map(smartPaths.map((preset) => [preset.id, preset]));
  const referencedPatternIds = Array.from(new Set([
    ...(spec.centerPatternId ? [spec.centerPatternId] : []),
    ...spec.landmarkPatternIds,
    ...spec.fillerPatternIds,
  ]));
  for (const id of referencedPatternIds) {
    const pattern = patternMap.get(id);
    if (!pattern) {
      errors.push(`Padrão ausente: ${id}.`);
      continue;
    }
    const validation = validateMapPattern(pattern);
    if (!validation.valid) errors.push(`Padrão “${pattern.name}” inválido: ${validation.errors.join(" ")}`);
    if (pattern.scope && !scopeMatches(pattern.scope, currentScope)) {
      errors.push(`Padrão “${pattern.name}” pertence a outro tileset.`);
    }
  }

  const roadPreset = spec.roadPresetId ? pathMap.get(spec.roadPresetId) : undefined;
  if (spec.roadPresetId && !roadPreset) errors.push(`Smart Path ausente: ${spec.roadPresetId}.`);
  if (roadPreset) {
    const validation = validateSmartPathPreset(roadPreset);
    if (!validation.valid) errors.push(`Smart Path “${roadPreset.name}” inválido: ${validation.errors.join(" ")}`);
    if (roadPreset.scope && !scopeMatches(roadPreset.scope, currentScope)) {
      errors.push(`Smart Path “${roadPreset.name}” pertence a outro tileset.`);
    }
  }
  if (errors.length) return { ok: false, template: null, placements: [], roads: [], warnings, errors };

  const rng = createRng(`${spec.seed}|${spec.width}x${spec.height}`);
  const placements: BlueprintPatternPlacement[] = [];
  const occupied: Rect[] = [];

  if (spec.centerPatternId) {
    const pattern = patternMap.get(spec.centerPatternId)!;
    const rect: Rect = {
      x: Math.floor((spec.width - pattern.width) / 2),
      y: Math.floor((spec.height - pattern.height) / 2),
      w: pattern.width,
      h: pattern.height,
    };
    if (!canPlace(rect, occupied, spec.width, spec.height, spec.margin, spec.spacing)) {
      errors.push(`Padrão central “${pattern.name}” não cabe em ${spec.width}×${spec.height} com margem ${spec.margin}.`);
    } else {
      const placement = placementFor("center", pattern, rect.x, rect.y, spec.width, spec.height);
      placements.push(placement);
      occupied.push(rectFor(placement));
    }
  }
  if (errors.length) return { ok: false, template: null, placements, roads: [], warnings, errors };

  const landmarkIds = shuffled(spec.landmarkPatternIds, rng);
  landmarkIds.forEach((patternId, index) => {
    const pattern = patternMap.get(patternId)!;
    const preferred = ringCandidate(pattern, index, landmarkIds.length, spec.width, spec.height, rng);
    const rect = findPlacement(pattern, occupied, spec.width, spec.height, spec.margin, spec.spacing, rng, preferred);
    if (!rect) {
      warnings.push(`Sem espaço seguro para o marco “${pattern.name}”; ele foi omitido.`);
      return;
    }
    const placement = placementFor("landmark", pattern, rect.x, rect.y, spec.width, spec.height);
    placements.push(placement);
    occupied.push(rectFor(placement));
  });

  for (let i = 0; i < spec.fillerCount; i++) {
    if (!spec.fillerPatternIds.length) break;
    const patternId = spec.fillerPatternIds[rng.int(0, spec.fillerPatternIds.length - 1)]!;
    const pattern = patternMap.get(patternId)!;
    const rect = findPlacement(pattern, occupied, spec.width, spec.height, spec.margin, spec.spacing, rng);
    if (!rect) {
      warnings.push(`Espaço esgotado após ${i} preenchimento(s); restante omitido.`);
      break;
    }
    const placement = placementFor("filler", pattern, rect.x, rect.y, spec.width, spec.height);
    placements.push(placement);
    occupied.push(rectFor(placement));
  }

  const hubPlacement = placements.find((placement) => placement.role === "center");
  const hub: TemplatePoint = hubPlacement?.anchor ?? {
    x: Math.floor(spec.width / 2),
    y: Math.floor(spec.height / 2),
  };
  const roads: BlueprintRoad[] = [];

  if (roadPreset) {
    for (const placement of placements.filter((item) => item.role === "landmark")) {
      const pattern = patternMap.get(placement.patternId)!;
      const route = routeBlueprintRoad(spec.width, spec.height, placement.anchor, hub, placements, rng);
      if (route.usedFallback) warnings.push(`Rota de “${pattern.name}” usou caminho direto porque não havia rota livre completa.`);
      roads.push({ kind: "landmark", label: pattern.name, points: route.points });
    }

    const exitTargets: Array<[keyof BlueprintExits, TemplatePoint]> = [
      ["north", { x: Math.floor(spec.width / 2), y: 0 }],
      ["east", { x: spec.width - 1, y: Math.floor(spec.height / 2) }],
      ["south", { x: Math.floor(spec.width / 2), y: spec.height - 1 }],
      ["west", { x: 0, y: Math.floor(spec.height / 2) }],
    ];
    for (const [direction, target] of exitTargets) {
      if (!spec.exits[direction]) continue;
      const route = routeBlueprintRoad(spec.width, spec.height, hub, target, placements, rng);
      if (route.usedFallback) warnings.push(`Saída ${direction} usou caminho direto porque não havia rota livre completa.`);
      roads.push({ kind: "exit", label: direction, points: route.points });
    }
  } else if (placements.some((placement) => placement.role === "landmark") || Object.values(spec.exits).some(Boolean)) {
    warnings.push("Nenhum Smart Path de estrada foi selecionado; estruturas foram posicionadas sem conexões automáticas.");
  }

  const template = createMapTemplate(spec.name, spec.width, spec.height, currentScope);
  template.category = spec.category;
  template.tags = ["generated", "blueprint", `seed:${spec.seed}`];
  template.elements = [
    ...placements.map((placement) => ({
      type: "pattern" as const,
      patternId: placement.patternId,
      x: placement.x,
      y: placement.y,
    })),
    ...(roadPreset ? roads.map((road) => ({
      type: "smartPath" as const,
      presetId: roadPreset.id,
      points: road.points.map((point) => ({ ...point })),
      mode: "add" as const,
    })) : []),
  ];
  template.updatedAt = new Date().toISOString();

  const validation = validateMapTemplate(template);
  if (!validation.valid) errors.push(...validation.errors);
  const dependencies = templateDependencies(template, patterns, smartPaths, currentScope);
  if (!dependencies.valid) errors.push(...dependencies.errors);
  warnings.push(...validation.warnings, ...dependencies.warnings);

  return {
    ok: errors.length === 0,
    template: errors.length ? null : template,
    placements,
    roads,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
  };
}
