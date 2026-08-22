import { METATILE_MASK, PHYSICAL_MASK, exportMapBin, idx, type MapData } from "./emeraldMap";
import { cloneMapJson, stringifyMapJson, type EditableMapJson } from "./eventMapJson";
import { buildPassabilityGrid, type PassabilityAtlas } from "./mapPassability";
import { getPhysicalLayerValue } from "./physicalMap";
import { parsePokeemeraldMapJson, type ParsedProtectedCell } from "./pokeemeraldMapJson";

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
  /** Documento data/maps/.../map.json COMPLETO, inclusive campos desconhecidos. */
  mapJson: EditableMapJson;
  /** Espelho legível das propriedades top-level não estruturais. */
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
    throw new CityBundleError(`Bundle inválido: campo obrigatório "${field}" ausente.`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CityBundleError(`Bundle inválido: "${field}" precisa ser string ou null.`);
  }
  return value;
}

function requireInteger(
  value: unknown,
  field: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new CityBundleError(
      `Bundle inválido: "${field}" precisa ser inteiro entre ${min} e ${max}.`,
    );
  }
  return value;
}

function requireIntegerArray(value: unknown, field: string, min: number, max: number): number[] {
  if (!Array.isArray(value))
    throw new CityBundleError(`Bundle inválido: "${field}" precisa ser uma lista.`);
  return value.map((item, index) => requireInteger(item, `${field}[${index}]`, min, max));
}

function requirePhysicalArray(value: unknown, field: string): number[] {
  const values = requireIntegerArray(value, field, 0, 0xffff);
  values.forEach((bits, index) => {
    if ((bits & ~PHYSICAL_MASK) !== 0) {
      throw new CityBundleError(
        `Bundle inválido: "${field}[${index}]" contém bits baixos fora da máscara física 0x${PHYSICAL_MASK.toString(16).toUpperCase()}.`,
      );
    }
  });
  return values;
}

function requireNullableStringArray(value: unknown, field: string): (string | null)[] {
  if (!Array.isArray(value))
    throw new CityBundleError(`Bundle inválido: "${field}" precisa ser lista.`);
  return value.map((item, index) => {
    if (item !== null && typeof item !== "string") {
      throw new CityBundleError(
        `Bundle inválido: "${field}[${index}]" precisa ser string ou null.`,
      );
    }
    return item as string | null;
  });
}

function requireProtectedCells(value: unknown): ParsedProtectedCell[] {
  if (!Array.isArray(value))
    throw new CityBundleError("Bundle inválido: protectedCells precisa ser lista.");
  return value.map((item, index) => {
    if (!isRecord(item))
      throw new CityBundleError(`Bundle inválido: protectedCells[${index}] precisa ser objeto.`);
    return {
      x: requireInteger(item.x, `protectedCells[${index}].x`),
      y: requireInteger(item.y, `protectedCells[${index}].y`),
      reason: requireText(item.reason, `protectedCells[${index}].reason`),
    };
  });
}

function requireConnectionContracts(value: unknown): CityConnectionContract[] {
  if (!Array.isArray(value))
    throw new CityBundleError("Bundle inválido: connectionContracts precisa ser lista.");
  return value.map((item, index) => {
    if (!isRecord(item))
      throw new CityBundleError(
        `Bundle inválido: connectionContracts[${index}] precisa ser objeto.`,
      );
    return {
      index: requireInteger(item.index, `connectionContracts[${index}].index`, 0),
      map: requireNullableString(item.map, `connectionContracts[${index}].map`),
      direction: requireNullableString(item.direction, `connectionContracts[${index}].direction`),
      offset:
        item.offset === null
          ? null
          : requireInteger(item.offset, `connectionContracts[${index}].offset`),
      borderCells: requireInteger(item.borderCells, `connectionContracts[${index}].borderCells`, 0),
      openCells: requireInteger(item.openCells, `connectionContracts[${index}].openCells`, 0),
      conditionalCells: requireInteger(
        item.conditionalCells,
        `connectionContracts[${index}].conditionalCells`,
        0,
      ),
    };
  });
}

function extractProperties(mapJson: EditableMapJson): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapJson)) {
    if (!STRUCTURAL_KEYS.has(key)) properties[key] = value;
  }
  return properties;
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
    // Ordenação binária por code units: independente de locale/idioma do browser.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
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
  return fnv1a(
    canonicalJson({
      primary: atlas.primary ?? null,
      secondary: atlas.secondary ?? null,
      records,
    }),
  );
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
  if (
    !Number.isInteger(map.width) ||
    !Number.isInteger(map.height) ||
    map.width <= 0 ||
    map.height <= 0
  ) {
    throw new CityBundleError(`Dimensões inválidas: ${map.width}×${map.height}.`);
  }
  const size = map.width * map.height;
  if (map.metatiles.length !== size || map.physical.length !== size) {
    throw new CityBundleError(
      `Grid inconsistente: ${map.metatiles.length} metatiles / ${map.physical.length} físicos para ${size} células.`,
    );
  }

  const mapJson = cloneMapJson(input.mapJson);
  const id = requireText(mapJson.id, "mapJson.id");
  const name = requireText(mapJson.name, "mapJson.name");
  const layout = requireText(mapJson.layout, "mapJson.layout");

  const metatiles: number[] = new Array(size);
  const physical: number[] = new Array(size);
  const collision: number[] = new Array(size);
  const elevation: number[] = new Array(size);
  const used = new Set<number>();
  for (let i = 0; i < size; i++) {
    const rawId = map.metatiles[i] ?? 0;
    const rawPhysical = map.physical[i] ?? 0;
    if (!Number.isInteger(rawId) || rawId < 0 || rawId > METATILE_MASK) {
      throw new CityBundleError(`Metatile fora da faixa na célula ${i}: ${rawId}.`);
    }
    if (
      !Number.isInteger(rawPhysical) ||
      rawPhysical < 0 ||
      rawPhysical > 0xffff ||
      (rawPhysical & ~PHYSICAL_MASK) !== 0
    ) {
      throw new CityBundleError(`Bits físicos inválidos na célula ${i}: ${rawPhysical}.`);
    }
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
    const connection = isRecord(raw) ? raw : {};
    const direction = typeof connection.direction === "string" ? connection.direction : null;
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
      map: typeof connection.map === "string" ? connection.map : null,
      direction,
      offset: Number.isInteger(connection.offset) ? (connection.offset as number) : null,
      borderCells: border.length,
      openCells,
      conditionalCells,
    };
  });

  const binBytes = exportMapBin(map);
  const sortedUsed = [...used].sort((a, b) => a - b);
  return {
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
    ...(input.semantics ? { semantics: cloneMapJson(input.semantics) } : {}),
    integrity: {
      cellCount: size,
      binByteLength: binBytes.byteLength,
      binChecksum: checksumBytes(binBytes),
      cellsChecksum: fnv1a(canonicalJson({ metatiles, physical })),
      mapJsonChecksum: fnv1a(canonicalJson(mapJson)),
    },
  };
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
      throw new CityBundleError(
        `Cidade JSON inválido: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!isRecord(parsed))
    throw new CityBundleError("Cidade JSON inválido: a raiz precisa ser objeto.");
  if (parsed.format !== ARAUNA_CITY_FORMAT) {
    throw new CityBundleError(
      `Formato não suportado: ${String(parsed.format)}; esperado ${ARAUNA_CITY_FORMAT}.`,
    );
  }
  if (parsed.version !== ARAUNA_CITY_VERSION) {
    throw new CityBundleError(
      `Versão não suportada: ${String(parsed.version)}; esperado ${ARAUNA_CITY_VERSION}.`,
    );
  }

  requireText(parsed.createdAt, "createdAt");
  requireNullableString(parsed.studioMapName, "studioMapName");

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
  if (tilesets.atlasRecordCount !== null) {
    requireInteger(tilesets.atlasRecordCount, "tilesets.atlasRecordCount", 0, 4096);
  }
  requireIntegerArray(tilesets.metatileIdsUsed, "tilesets.metatileIdsUsed", 0, METATILE_MASK);

  const cells = parsed.cells;
  if (!isRecord(cells)) throw new CityBundleError("Bundle inválido: cells ausente.");
  requireIntegerArray(cells.metatiles, "cells.metatiles", 0, METATILE_MASK);
  requirePhysicalArray(cells.physical, "cells.physical");
  requireIntegerArray(cells.collision, "cells.collision", 0, 3);
  requireIntegerArray(cells.elevation, "cells.elevation", 0, 15);
  if (cells.owner !== undefined) requireNullableStringArray(cells.owner, "cells.owner");
  if (cells.semanticOwner !== undefined)
    requireNullableStringArray(cells.semanticOwner, "cells.semanticOwner");

  if (!isRecord(parsed.mapJson)) throw new CityBundleError("Bundle inválido: mapJson ausente.");
  requireText(parsed.mapJson.id, "mapJson.id");
  requireText(parsed.mapJson.name, "mapJson.name");
  requireText(parsed.mapJson.layout, "mapJson.layout");
  if (!isRecord(parsed.properties))
    throw new CityBundleError("Bundle inválido: properties ausente.");
  requireProtectedCells(parsed.protectedCells);
  requireConnectionContracts(parsed.connectionContracts);
  if (parsed.semantics !== undefined && !isRecord(parsed.semantics)) {
    throw new CityBundleError("Bundle inválido: semantics precisa ser objeto quando presente.");
  }

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

function connectionContractMetadataMatches(bundle: AraunaCityBundle): boolean {
  const connections = Array.isArray(bundle.mapJson.connections) ? bundle.mapJson.connections : [];
  if (connections.length !== bundle.connectionContracts.length) return false;
  return connections.every((raw, index) => {
    const connection = isRecord(raw) ? raw : {};
    const contract = bundle.connectionContracts[index];
    if (!contract || contract.index !== index) return false;
    const direction = typeof connection.direction === "string" ? connection.direction : null;
    const expectedBorderCells = borderCells(
      bundle.identity.width,
      bundle.identity.height,
      direction,
    ).length;
    return (
      contract.map === (typeof connection.map === "string" ? connection.map : null) &&
      contract.direction === direction &&
      contract.offset ===
        (Number.isInteger(connection.offset) ? (connection.offset as number) : null) &&
      contract.borderCells === expectedBorderCells &&
      contract.openCells + contract.conditionalCells <= contract.borderCells
    );
  });
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
  if (bundle.cells.owner && bundle.cells.owner.length !== expected)
    lengths.push(["cells.owner", bundle.cells.owner.length]);
  if (bundle.cells.semanticOwner && bundle.cells.semanticOwner.length !== expected)
    lengths.push(["cells.semanticOwner", bundle.cells.semanticOwner.length]);
  for (const [field, length] of lengths) {
    if (length !== expected) {
      issues.push({
        code: "BUNDLE_CELL_COUNT",
        message: `${field} tem ${length}; esperado ${expected}.`,
      });
    }
  }
  if (bundle.integrity.cellCount !== expected) {
    issues.push({
      code: "BUNDLE_INTEGRITY_CELL_COUNT",
      message: `integrity.cellCount=${bundle.integrity.cellCount}; esperado ${expected}.`,
    });
  }
  if (bundle.integrity.binByteLength !== expected * 2) {
    issues.push({
      code: "BUNDLE_BIN_SIZE",
      message: `integrity.binByteLength=${bundle.integrity.binByteLength}; esperado ${expected * 2}.`,
    });
  }
  if (issues.length) return issues;

  if (
    bundle.mapJson.id !== bundle.identity.id ||
    bundle.mapJson.name !== bundle.identity.name ||
    bundle.mapJson.layout !== bundle.identity.layout
  ) {
    issues.push({
      code: "BUNDLE_IDENTITY_MISMATCH",
      message:
        "identity não corresponde a id/name/layout do mapJson; o bundle pode apontar para outro mapa.",
    });
  }

  if (canonicalJson(bundle.properties) !== canonicalJson(extractProperties(bundle.mapJson))) {
    issues.push({
      code: "BUNDLE_PROPERTIES_MISMATCH",
      message: "properties não corresponde às propriedades top-level preservadas no mapJson.",
    });
  }

  const derivedProtected = parsePokeemeraldMapJson(stringifyMapJson(bundle.mapJson)).protectedCells;
  if (canonicalJson(bundle.protectedCells) !== canonicalJson(derivedProtected)) {
    issues.push({
      code: "BUNDLE_PROTECTED_CELLS_MISMATCH",
      message:
        "protectedCells não corresponde aos warps/NPCs/triggers/BG events derivados do mapJson.",
    });
  }

  if (!connectionContractMetadataMatches(bundle)) {
    issues.push({
      code: "BUNDLE_CONNECTION_CONTRACT_MISMATCH",
      message: "connectionContracts não corresponde ao array connections/geometria do mapJson.",
    });
  }

  const derived = derivedArrays(bundle);
  for (let i = 0; i < expected; i++) {
    const id = metatiles[i] ?? -1;
    const bits = physical[i] ?? -1;
    if (!Number.isInteger(id) || id < 0 || id > METATILE_MASK) {
      issues.push({
        code: "BUNDLE_METATILE_RANGE",
        message: `Metatile ${id} na célula ${i} fora de 0x000–0x3FF.`,
      });
      break;
    }
    if (!Number.isInteger(bits) || bits < 0 || bits > 0xffff || (bits & ~PHYSICAL_MASK) !== 0) {
      issues.push({
        code: "BUNDLE_PHYSICAL_RANGE",
        message: `Bits físicos ${bits} na célula ${i} inválidos.`,
      });
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
    issues.push({
      code: "BUNDLE_CELLS_CHECKSUM",
      message: `Checksum de cells diverge: ${bundle.integrity.cellsChecksum} != ${cellsChecksum}.`,
    });
  }
  const mapJsonChecksum = fnv1a(canonicalJson(bundle.mapJson));
  if (bundle.integrity.mapJsonChecksum !== mapJsonChecksum) {
    issues.push({
      code: "BUNDLE_MAPJSON_CHECKSUM",
      message: `Checksum de mapJson diverge: ${bundle.integrity.mapJsonChecksum} != ${mapJsonChecksum}.`,
    });
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
    issues.push({
      code: "BUNDLE_BIN_SIZE",
      message: `map.bin reconstruído tem ${bytes.byteLength}; bundle declara ${bundle.integrity.binByteLength}.`,
    });
  }
  if (binChecksum !== bundle.integrity.binChecksum) {
    issues.push({
      code: "BUNDLE_BIN_CHECKSUM",
      message: `Checksum de map.bin diverge: ${bundle.integrity.binChecksum} != ${binChecksum}.`,
    });
  }

  const used = [...new Set(metatiles)].sort((a, b) => a - b);
  if (canonicalJson(used) !== canonicalJson(bundle.tilesets.metatileIdsUsed)) {
    issues.push({
      code: "BUNDLE_TILESET_USED_IDS",
      message: "tilesets.metatileIdsUsed não corresponde aos metatiles realmente usados.",
    });
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
    throw new CityBundleError(issues.map((found) => `${found.code}: ${found.message}`).join("\n"));
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
