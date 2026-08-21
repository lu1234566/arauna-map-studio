import {
  METATILE_MASK,
  PHYSICAL_MASK,
  exportMapBin,
  idx,
  type MapData,
} from "./emeraldMap";
import { cloneMapJson, stringifyMapJson, type EditableMapJson } from "./eventMapJson";
import { getPhysicalLayerValue } from "./physicalMap";
import { buildPassabilityGrid, type PassabilityAtlas } from "./mapPassability";
import { parsePokeemeraldMapJson, type ParsedProtectedCell } from "./pokeemeraldMapJson";

/**
 * Bundle completo de uma cidade/mapa. O mapJson é armazenado integralmente,
 * sem projetá-lo para um schema menor, para manter round-trip seguro.
 */
export const ARAUNA_CITY_FORMAT = "arauna-city-v1";
export const ARAUNA_CITY_VERSION = 1 as const;

export class CityBundleError extends Error {}

export interface CityIdentity {
  id: string;
  name: string;
  layout: string;
  width: number;
  height: number;
}

export interface CityTilesets {
  primary: string | null;
  secondary: string | null;
  atlasFingerprint: string | null;
  atlasRecordCount: number | null;
  metatileIdsUsed: number[];
}

export interface CityCells {
  metatiles: number[];
  physical: number[];
  collision: number[];
  elevation: number[];
  owner?: (string | null)[];
  semanticOwner?: (string | null)[];
}

export interface CityConnectionContract {
  index: number;
  map: string | null;
  direction: string | null;
  offset: number | null;
  borderCells: number;
  openCells: number;
  conditionalCells: number;
}

export interface CityIntegrity {
  cellCount: number;
  binByteLength: number;
  binChecksum: string;
  cellsChecksum: string;
  mapJsonChecksum: string;
}

export interface CitySemantics {
  districts?: unknown[];
  buildings?: unknown[];
  roads?: unknown[];
  doors?: unknown[];
  exits?: unknown[];
  [key: string]: unknown;
}

export interface AraunaCityBundle {
  format: typeof ARAUNA_CITY_FORMAT;
  version: typeof ARAUNA_CITY_VERSION;
  createdAt: string;
  studioMapName: string | null;
  identity: CityIdentity;
  tilesets: CityTilesets;
  cells: CityCells;
  /** Documento data/maps/.../map.json COMPLETO. */
  mapJson: EditableMapJson;
  /** Espelho legível das propriedades não estruturais; mapJson segue canônico. */
  properties: Record<string, unknown>;
  protectedCells: ParsedProtectedCell[];
  connectionContracts: CityConnectionContract[];
  semantics?: CitySemantics;
  integrity: CityIntegrity;
}

const STRUCTURAL_KEYS = new Set([
  "id",
  "name",
  "layout",
  "warp_events",
  "object_events",
  "coord_events",
  "bg_events",
  "connections",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CityBundleError(`map.json inválido: campo obrigatório "${field}" ausente.`);
  }
  return value;
}

function requireInteger(value: unknown, field: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new CityBundleError(`Bundle inválido: "${field}" precisa ser inteiro entre ${min} e ${max}.`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new CityBundleError(`Bundle inválido: "${field}" precisa ser string ou null.`);
  return value;
}

function requireIntegerArray(value: unknown, field: string, min: number, max: number): number[] {
  if (!Array.isArray(value)) throw new CityBundleError(`Bundle inválido: "${field}" precisa ser uma lista.`);
  return value.map((item, index) => requireInteger(item, `${field}[${index}]`, min, max));
}

/* ------------------------------------------------------------------ */
/* Checksums                                                           */
/* ------------------------------------------------------------------ */

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function checksumBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface FingerprintAtlas extends PassabilityAtlas {
  primary?: string | null;
  secondary?: string | null;
}

export function atlasFingerprint(atlas: FingerprintAtlas | null | undefined): string | null {
  if (!atlas) return null;
  const records = [...atlas.records]
    .sort((a, b) => a.id - b.id)
    .map((record) => [record.id, record.behavior ?? null, record.layerType ?? null]);
  return fnv1a(canonicalJson({
    primary: atlas.primary ?? null,
    secondary: atlas.secondary ?? null,
    records,
  }));
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export interface BuildCityBundleInput {
  map: MapData;
  mapJson: EditableMapJson | null;
  mapName?: string | null;
  atlas?: FingerprintAtlas | null;
  semantics?: CitySemantics;
  createdAt?: string;
}

function extractProperties(mapJson: EditableMapJson): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapJson)) {
    if (!STRUCTURAL_KEYS.has(key)) properties[key] = value;
  }
  return properties;
}

export function borderCells(
  width: number,
  height: number,
  direction: string | null,
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  if (direction === "up") for (let x = 0; x < width; x++) cells.push({ x, y: 0 });
  else if (direction === "down") for (let x = 0; x < width; x++) cells.push({ x, y: height - 1 });
  else if (direction === "left") for (let y = 0; y < height; y++) cells.push({ x: 0, y });
  else if (direction === "right") for (let y = 0; y < height; y++) cells.push({ x: width - 1, y });
  return cells;
}

export function buildCityBundle(input: BuildCityBundleInput): AraunaCityBundle {
  const { map } = input;
  if (!input.mapJson) {
    throw new CityBundleError(
      "Exportar Cidade JSON exige map.json carregado; um grid isolado não é considerado implementável.",
    );
  }
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width <= 0 || map.height <= 0) {
    throw new CityBundleError(`Dimensões inválidas: ${map.width}×${map.height}.`);
  }
  const size = map.width * map.height;
  if (map.metatiles.length !== size || map.physical.length !== size) {
    throw new CityBundleError(
      `Grid inconsistente: ${map.metatiles.length} metatiles / ${map.physical.length} físicos para ${size} células.`,
    );
  }

  const mapJson = cloneMapJson(input.mapJson);
  const id = requireText(mapJson.id, "id");
  const name = requireText(mapJson.name, "name");
  const layout = requireText(mapJson.layout, "layout");

  const metatiles: number[] = new Array(size);
  const physical: number[] = new Array(size);
  const collision: number[] = new Array(size);
  const elevation: number[] = new Array(size);
  const used = new Set<number>();
  for (let i = 0; i < size; i++) {
    const rawId = map.metatiles[i] ?? 0;
    const rawPhysical = map.physical[i] ?? 0;
    if (rawId < 0 || rawId > METATILE_MASK) throw new CityBundleError(`Metatile fora da faixa na célula ${i}: ${rawId}.`);
    if ((rawPhysical & ~PHYSICAL_MASK) !== 0) throw new CityBundleError(`Bits físicos inválidos na célula ${i}: ${rawPhysical}.`);
    metatiles[i] = rawId;
    physical[i] = rawPhysical;
    collision[i] = getPhysicalLayerValue(rawPhysical, "collision");
    elevation[i] = getPhysicalLayerValue(rawPhysical, "elevation");
    used.add(rawId);
  }

  const metadata = parsePokeemeraldMapJson(stringifyMapJson(mapJson));
  const grid = buildPassabilityGrid(map, input.atlas ?? null);
  const connections = Array.isArray(mapJson.connections) ? mapJson.connections : [];
  const connectionContracts: CityConnectionContract[] = connections.map((raw, index) => {
    const record = isRecord(raw) ? raw : {};
    const direction = typeof record.direction === "string" ? record.direction : null;
    const border = borderCells(map.width, map.height, direction);
    let openCells = 0;
    let conditionalCells = 0;
    for (const point of border) {
      const state = grid.at(point.x, point.y);
      if (state === "passable") openCells++;
      else if (state === "conditional" || state === "unknown") conditionalCells++;
    }
    return {
      index,
      map: typeof record.map === "string" ? record.map : null,
      direction,
      offset: Number.isInteger(record.offset) ? (record.offset as number) : null,
      borderCells: border.length,
      openCells,
      conditionalCells,
    };
  });

  const binBytes = exportMapBin(map);
  const sortedUsed = [...used].sort((a, b) => a - b);
  const bundle: AraunaCityBundle = {
    format: ARAUNA_CITY_FORMAT,
    version: ARAUNA_CITY_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    studioMapName: input.mapName ?? null,
    identity: { id, name, layout, width: map.width, height: map.height },
    tilesets: {
      primary: input.atlas?.primary ?? null,
      secondary: input.atlas?.secondary ?? null,
      atlasFingerprint: atlasFingerprint(input.atlas),
      atlasRecordCount: input.atlas?.records.length ?? null,
      metatileIdsUsed: sortedUsed,
    },
    cells: { metatiles, physical, collision, elevation },
    mapJson,
    properties: extractProperties(mapJson),
    protectedCells: metadata.protectedCells.map((cell) => ({ ...cell })),
    connectionContracts,
    ...(input.semantics ? { semantics: input.semantics } : {}),
    integrity: {
      cellCount: size,
      binByteLength: binBytes.byteLength,
      binChecksum: checksumBytes(binBytes),
      cellsChecksum: fnv1a(canonicalJson({ metatiles, physical })),
      mapJsonChecksum: fnv1a(canonicalJson(mapJson)),
    },
  };
  return bundle;
}

export function serializeCityBundle(bundle: AraunaCityBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/* ------------------------------------------------------------------ */
/* Parse                                                               */
/* ------------------------------------------------------------------ */

export function parseCityBundle(source: string | unknown): AraunaCityBundle {
  let parsed: unknown = source;
  if (typeof source === "string") {
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new CityBundleError(`Cidade JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!isRecord(parsed)) throw new CityBundleError("Cidade JSON inválido: a raiz precisa ser objeto.");
  if (parsed.format !== ARAUNA_CITY_FORMAT) {
    throw new CityBundleError(`Formato não suportado: ${String(parsed.format)}; esperado ${ARAUNA_CITY_FORMAT}.`);
  }
  if (parsed.version !== ARAUNA_CITY_VERSION) {
    throw new CityBundleError(`Versão não suportada: ${String(parsed.version)}; esperado ${ARAUNA_CITY_VERSION}.`);
  }

  const identity = parsed.identity;
  if (!isRecord(identity)) throw new CityBundleError("Bundle inválido: identity ausente.");
  requireText(identity.id, "identity.id");
  requireText(identity.name, "identity.name");
  requireText(identity.layout, "identity.layout");
  requireInteger(identity.width, "identity.width", 1, 4096);
  requireInteger(identity.height, "identity.height", 1, 4096);

  const tilesets = parsed.tilesets;
  if (!isRecord(tilesets)) throw new CityBundleError("Bundle inválido: tilesets ausente.");
  requireNullableString(tilesets.primary, "tilesets.primary");
  requireNullableString(tilesets.secondary, "tilesets.secondary");
  requireNullableString(tilesets.atlasFingerprint, "tilesets.atlasFingerprint");
  if (tilesets.atlasRecordCount !== null) requireInteger(tilesets.atlasRecordCount, "tilesets.atlasRecordCount", 0, 4096);
  requireIntegerArray(tilesets.metatileIdsUsed, "tilesets.metatileIdsUsed", 0, METATILE_MASK);

  const cells = parsed.cells;
  if (!isRecord(cells)) throw new CityBundleError("Bundle inválido: cells ausente.");
  requireIntegerArray(cells.metatiles, "cells.metatiles", 0, METATILE_MASK);
  requireIntegerArray(cells.physical, "cells.physical", 0, PHYSICAL_MASK);
  requireIntegerArray(cells.collision, "cells.collision", 0, 3);
  requireIntegerArray(cells.elevation, "cells.elevation", 0, 15);
  if (cells.owner !== undefined && !Array.isArray(cells.owner)) throw new CityBundleError("Bundle inválido: cells.owner precisa ser lista.");
  if (cells.semanticOwner !== undefined && !Array.isArray(cells.semanticOwner)) throw new CityBundleError("Bundle inválido: cells.semanticOwner precisa ser lista.");

  if (!isRecord(parsed.mapJson)) throw new CityBundleError("Bundle inválido: mapJson ausente.");
  if (!isRecord(parsed.properties)) throw new CityBundleError("Bundle inválido: properties ausente.");
  if (!Array.isArray(parsed.protectedCells)) throw new CityBundleError("Bundle inválido: protectedCells precisa ser lista.");
  if (!Array.isArray(parsed.connectionContracts)) throw new CityBundleError("Bundle inválido: connectionContracts precisa ser lista.");

  const integrity = parsed.integrity;
  if (!isRecord(integrity)) throw new CityBundleError("Bundle inválido: integrity ausente.");
  requireInteger(integrity.cellCount, "integrity.cellCount", 1, 16_777_216);
  requireInteger(integrity.binByteLength, "integrity.binByteLength", 2, 33_554_432);
  requireText(integrity.binChecksum, "integrity.binChecksum");
  requireText(integrity.cellsChecksum, "integrity.cellsChecksum");
  requireText(integrity.mapJsonChecksum, "integrity.mapJsonChecksum");

  return parsed as unknown as AraunaCityBundle;
}

export interface BundleIntegrityIssue {
  code: string;
  message: string;
}

function derivedArrays(bundle: AraunaCityBundle) {
  return bundle.cells.physical.map((bits) => ({
    collision: getPhysicalLayerValue(bits, "collision"),
    elevation: getPhysicalLayerValue(bits, "elevation"),
  }));
}

export function verifyBundleIntegrity(bundle: AraunaCityBundle): BundleIntegrityIssue[] {
  const issues: BundleIntegrityIssue[] = [];
  const { width, height } = bundle.identity;
  const expected = width * height;
  const { metatiles, physical, collision, elevation } = bundle.cells;

  const lengths: Array<[string, number]> = [
    ["cells.metatiles", metatiles.length],
    ["cells.physical", physical.length],
    ["cells.collision", collision.length],
    ["cells.elevation", elevation.length],
  ];
  for (const [field, length] of lengths) {
    if (length !== expected) issues.push({ code: "BUNDLE_CELL_COUNT", message: `${field} tem ${length}; esperado ${expected}.` });
  }
  if (bundle.integrity.cellCount !== expected) {
    issues.push({ code: "BUNDLE_INTEGRITY_CELL_COUNT", message: `integrity.cellCount=${bundle.integrity.cellCount}; esperado ${expected}.` });
  }
  if (bundle.integrity.binByteLength !== expected * 2) {
    issues.push({ code: "BUNDLE_BIN_SIZE", message: `integrity.binByteLength=${bundle.integrity.binByteLength}; esperado ${expected * 2}.` });
  }
  if (issues.length) return issues;

  const mapJsonId = bundle.mapJson.id;
  const mapJsonName = bundle.mapJson.name;
  const mapJsonLayout = bundle.mapJson.layout;
  if (mapJsonId !== bundle.identity.id || mapJsonName !== bundle.identity.name || mapJsonLayout !== bundle.identity.layout) {
    issues.push({
      code: "BUNDLE_IDENTITY_MISMATCH",
      message: "identity não corresponde a id/name/layout do mapJson; o bundle pode apontar para outro mapa.",
    });
  }

  const derived = derivedArrays(bundle);
  for (let i = 0; i < expected; i++) {
    const id = metatiles[i] ?? -1;
    const bits = physical[i] ?? -1;
    if (!Number.isInteger(id) || id < 0 || id > METATILE_MASK) {
      issues.push({ code: "BUNDLE_METATILE_RANGE", message: `Metatile ${id} na célula ${i} fora de 0x000–0x3FF.` });
      break;
    }
    if (!Number.isInteger(bits) || bits < 0 || bits > PHYSICAL_MASK || (bits & ~PHYSICAL_MASK) !== 0) {
      issues.push({ code: "BUNDLE_PHYSICAL_RANGE", message: `Bits físicos ${bits} na célula ${i} inválidos.` });
      break;
    }
    if (collision[i] !== derived[i]?.collision || elevation[i] !== derived[i]?.elevation) {
      issues.push({
        code: "BUNDLE_PHYSICAL_DERIVATION",
        message: `collision/elevation derivados não batem com physical na célula ${i}.`,
      });
      break;
    }
  }

  const cellsChecksum = fnv1a(canonicalJson({ metatiles, physical }));
  if (bundle.integrity.cellsChecksum !== cellsChecksum) {
    issues.push({ code: "BUNDLE_CELLS_CHECKSUM", message: `Checksum de cells diverge: ${bundle.integrity.cellsChecksum} != ${cellsChecksum}.` });
  }
  const mapJsonChecksum = fnv1a(canonicalJson(bundle.mapJson));
  if (bundle.integrity.mapJsonChecksum !== mapJsonChecksum) {
    issues.push({ code: "BUNDLE_MAPJSON_CHECKSUM", message: `Checksum de mapJson diverge: ${bundle.integrity.mapJsonChecksum} != ${mapJsonChecksum}.` });
  }

  const map: MapData = {
    width,
    height,
    metatiles: Uint16Array.from(metatiles),
    physical: Uint16Array.from(physical),
  };
  const bytes = exportMapBin(map);
  const binChecksum = checksumBytes(bytes);
  if (bytes.byteLength !== bundle.integrity.binByteLength) {
    issues.push({ code: "BUNDLE_BIN_SIZE", message: `map.bin reconstruído tem ${bytes.byteLength}; bundle declara ${bundle.integrity.binByteLength}.` });
  }
  if (binChecksum !== bundle.integrity.binChecksum) {
    issues.push({ code: "BUNDLE_BIN_CHECKSUM", message: `Checksum de map.bin diverge: ${bundle.integrity.binChecksum} != ${binChecksum}.` });
  }

  const used = [...new Set(metatiles)].sort((a, b) => a - b);
  if (canonicalJson(used) !== canonicalJson(bundle.tilesets.metatileIdsUsed)) {
    issues.push({ code: "BUNDLE_TILESET_USED_IDS", message: "tilesets.metatileIdsUsed não corresponde aos metatiles realmente usados." });
  }

  return issues;
}

export interface CompiledCityBundle {
  map: MapData;
  mapJson: EditableMapJson;
  identity: CityIdentity;
  binBytes: Uint8Array;
}

export function compileCityBundle(bundle: AraunaCityBundle): CompiledCityBundle {
  const issues = verifyBundleIntegrity(bundle);
  if (issues.length) {
    throw new CityBundleError(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
  }
  const map: MapData = {
    width: bundle.identity.width,
    height: bundle.identity.height,
    metatiles: Uint16Array.from(bundle.cells.metatiles),
    physical: Uint16Array.from(bundle.cells.physical),
  };
  return {
    map,
    mapJson: cloneMapJson(bundle.mapJson),
    identity: { ...bundle.identity },
    binBytes: exportMapBin(map),
  };
}

export function bundlesEquivalent(a: AraunaCityBundle, b: AraunaCityBundle): boolean {
  const stripVolatile = (bundle: AraunaCityBundle) => {
    const { createdAt: _createdAt, ...stable } = bundle;
    return stable;
  };
  return canonicalJson(stripVolatile(a)) === canonicalJson(stripVolatile(b));
}

export function bundleCellIndex(bundle: AraunaCityBundle, x: number, y: number): number {
  return idx(x, y, bundle.identity.width);
}
