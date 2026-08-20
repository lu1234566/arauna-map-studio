import { METATILE_MASK } from "./emeraldMap";
import { cloneClipboard, type ClipboardKind, type RegionClipboard } from "./mapClipboard";

export const MAP_PATTERN_FORMAT = "arauna-map-pattern-v1" as const;

export interface PatternScope {
  primary: string;
  secondary: string;
}

export type CardinalDirection = "north" | "east" | "south" | "west";
export type PatternPortKind = "door" | "entrance" | "exit" | "connection";

export interface PatternPort {
  id: string;
  name: string;
  kind: PatternPortKind;
  x: number;
  y: number;
  direction?: CardinalDirection;
}

export interface MapPattern {
  format: typeof MAP_PATTERN_FORMAT;
  id: string;
  name: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
  kind: ClipboardKind;
  values: number[];
  ports?: PatternPort[];
  scope?: PatternScope;
  createdAt: string;
  updatedAt: string;
}

export interface PatternValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const PORT_KINDS = new Set<PatternPortKind>(["door", "entrance", "exit", "connection"]);
const DIRECTIONS = new Set<CardinalDirection>(["north", "east", "south", "west"]);

function validValue(kind: ClipboardKind, value: number) {
  if (!Number.isInteger(value) || value < 0) return false;
  if (kind === "visual") return value <= METATILE_MASK;
  if (kind === "collision") return value <= 3;
  if (kind === "elevation") return value <= 15;
  return value <= 0xffff;
}

function parsePorts(value: unknown): PatternPort[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const raw = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    const direction = raw.direction == null ? undefined : String(raw.direction) as CardinalDirection;
    return {
      id: String(raw.id ?? `port-${index + 1}`),
      name: String(raw.name ?? `Acesso ${index + 1}`),
      kind: String(raw.kind ?? "entrance") as PatternPortKind,
      x: Number(raw.x),
      y: Number(raw.y),
      ...(direction ? { direction } : {}),
    };
  });
}

export function validateMapPattern(pattern: MapPattern): PatternValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (pattern.format !== MAP_PATTERN_FORMAT) errors.push("Formato de pattern incompatível.");
  if (!pattern.id.trim()) errors.push("Pattern sem id.");
  if (!pattern.name.trim()) errors.push("Pattern sem nome.");
  if (!Number.isInteger(pattern.width) || pattern.width <= 0 || pattern.width > 512) {
    errors.push(`Largura inválida: ${pattern.width}.`);
  }
  if (!Number.isInteger(pattern.height) || pattern.height <= 0 || pattern.height > 512) {
    errors.push(`Altura inválida: ${pattern.height}.`);
  }
  if (!["visual", "collision", "elevation", "raw"].includes(pattern.kind)) {
    errors.push(`Tipo inválido: ${String(pattern.kind)}.`);
  }
  const expected = pattern.width * pattern.height;
  if (!Array.isArray(pattern.values) || pattern.values.length !== expected) {
    errors.push(`Pattern possui ${pattern.values?.length ?? 0} valores; esperado ${expected}.`);
  } else {
    const invalid = pattern.values.filter((value) => !validValue(pattern.kind, value)).length;
    if (invalid) errors.push(`${invalid} valor(es) fora da faixa permitida para ${pattern.kind}.`);
  }

  const portIds = new Set<string>();
  for (const [index, port] of (pattern.ports ?? []).entries()) {
    const label = `Acesso ${index + 1}`;
    if (!port.id.trim()) errors.push(`${label}: id vazio.`);
    else if (portIds.has(port.id)) errors.push(`${label}: id duplicado “${port.id}”.`);
    else portIds.add(port.id);
    if (!port.name.trim()) errors.push(`${label}: nome vazio.`);
    if (!PORT_KINDS.has(port.kind)) errors.push(`${label}: tipo inválido “${String(port.kind)}”.`);
    if (!Number.isInteger(port.x) || !Number.isInteger(port.y)) {
      errors.push(`${label}: coordenadas relativas precisam ser inteiras.`);
    } else if (port.x < 0 || port.y < 0 || port.x >= pattern.width || port.y >= pattern.height) {
      errors.push(`${label}: (${port.x},${port.y}) está fora do pattern ${pattern.width}×${pattern.height}.`);
    }
    if (port.direction && !DIRECTIONS.has(port.direction)) {
      errors.push(`${label}: direção inválida “${String(port.direction)}”.`);
    }
  }

  if (pattern.scope && (!pattern.scope.primary.trim() || !pattern.scope.secondary.trim())) {
    errors.push("Escopo de tileset incompleto.");
  }
  if (!pattern.category.trim()) warnings.push("Pattern sem categoria.");
  if (expected > 4096) warnings.push(`Pattern grande (${pattern.width}×${pattern.height}); carimbo repetido pode ser custoso.`);
  return { valid: errors.length === 0, errors, warnings };
}

export function patternFromClipboard(
  clipboard: RegionClipboard,
  name: string,
  category = "Geral",
  scope?: PatternScope,
): MapPattern {
  const now = new Date().toISOString();
  return {
    format: MAP_PATTERN_FORMAT,
    id: `pattern-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Novo padrão",
    category: category.trim() || "Geral",
    tags: [],
    width: clipboard.width,
    height: clipboard.height,
    kind: clipboard.kind,
    values: Array.from(clipboard.values),
    ports: [],
    ...(scope ? { scope: { ...scope } } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function clipboardFromPattern(pattern: MapPattern): RegionClipboard {
  const validation = validateMapPattern(pattern);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return cloneClipboard({
    kind: pattern.kind,
    width: pattern.width,
    height: pattern.height,
    values: Uint16Array.from(pattern.values),
    source: { x: 0, y: 0 },
  });
}

export function parseMapPatternJson(source: string): MapPattern[] {
  const parsed = JSON.parse(source) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Pattern ${index + 1}: objeto inválido.`);
    }
    const raw = value as Record<string, unknown>;
    const scopeRaw = raw.scope;
    const scope = scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)
      ? {
          primary: String((scopeRaw as Record<string, unknown>).primary ?? ""),
          secondary: String((scopeRaw as Record<string, unknown>).secondary ?? ""),
        }
      : undefined;
    const pattern: MapPattern = {
      format: MAP_PATTERN_FORMAT,
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      category: String(raw.category ?? "Geral"),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      width: Number(raw.width),
      height: Number(raw.height),
      kind: String(raw.kind ?? "visual") as ClipboardKind,
      values: Array.isArray(raw.values) ? raw.values.map(Number) : [],
      ports: parsePorts(raw.ports),
      ...(scope ? { scope } : {}),
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    };
    const validation = validateMapPattern(pattern);
    if (!validation.valid) throw new Error(`Pattern ${index + 1}: ${validation.errors.join(" ")}`);
    return pattern;
  });
}

export function serializeMapPatterns(patterns: MapPattern[]): string {
  patterns.forEach((pattern) => {
    const validation = validateMapPattern(pattern);
    if (!validation.valid) throw new Error(`${pattern.name}: ${validation.errors.join(" ")}`);
  });
  return `${JSON.stringify(patterns.length === 1 ? patterns[0] : patterns, null, 2)}\n`;
}
