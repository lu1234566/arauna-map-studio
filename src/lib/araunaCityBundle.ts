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
 * arauna-city-v1
 *
 * Bundle único que serve como fonte de verdade implementável no pokeemerald:
 * grid completo (metatile + bits físicos), documento map.json íntegro com
 * campos desconhecidos preservados, contratos de conexão, células protegidas,
 * anotações semânticas opcionais e checksums de integridade.
 */
export const ARAUNA_CITY_FORMAT = "arauna-city-v1";

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
  version: 1;
  createdAt: string;
  studioMapName: string | null;
  identity: CityIdentity;
  tilesets: CityTilesets;
  cells: CityCells;
  /** Documento map.json COMPLETO — nada é normalizado ou descartado. */
  mapJson: EditableMapJson;
  properties: Record<string, unknown>;
  protectedCells: ParsedProtectedCell[];
  connectionContracts: CityConnectionContract[];
  semantics?: CitySemantics;
  integrity: CityIntegrity;
}

const PROPERTY_KEYS = [
  "music",
  "region_map_section",
  "weather",
  "map_type",
  "battle_scene",
  "requires_flash",
  "allow_cycling",
  "allow_escaping",
  "allow_running",
  "show_map_name",
  "floor_number",
  "shared_events_map",
  "shared_scripts_map",
] as const;

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

/* ------------------------------------------------------------------ */
/* checksums                                                           */
/* ------------------------------------------------------------------ */

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Serialização estável (chaves ordenadas) para checksum determinístico. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function checksumBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function atlasFingerprint(
  atlas: { primary?: string | null; secondary?: string | null; records: { id: number; behavior?: number | null; layerType?: number | null }[] } | null | undefined,
): string | null {
  if (!atlas) return null;
  const payload = canonicalJson({
    primary: atlas.primary ?? null,
    secondary: atlas.secondary ?? null,
    records: atlas.records.map((record) => [record.id, record.behavior ?? null, record.layerType ?? null]),
  });
  return fnv1a(payload);
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CityBundleError(`map.json inválido: campo obrigatório "${field}" ausente.`);
  }
  return value;
}

export interface BuildCityBundleInput {
  map: MapData;
  mapJson: EditableMapJson | null;
  mapName?: string | null;
  atlas?:
    | (PassabilityAtlas & { primary?: string | null; secondary?: string | null })
    | null;
  semantics?: CitySemantics | undefined;
  createdAt?: string;
}

export function buildCityBundle(input: BuildCityBundleInput): AraunaCityBundle {
  const { map } = input;
  if (!input.mapJson) {
    throw new CityBundleError(
      "Exportar Cidade JSON exige um map.json carregado: o bundle é a fonte de verdade do mapa completo.",
    );
  }
  const mapJson = cloneMapJson(input.mapJson);
  const size = map.width * map.height;
  if (map.metatiles.length !== size || map.physical.length !== size) {
    throw new CityBundleError(
      `Grid inconsistente: ${map.metatiles.length} metatiles / ${map.physical.length} bits físicos para ${map.width}×${map.height}.`,
    );
  }

  const metatiles: number[] = new Array(size);
  const physical: number[] = new Array(size);
  const collision: number[] = new Array(size);
  const elevation: number[] = new Array(size);
  const used = new Set<number>();
  for (let i = 0; i < size; i++) {
    const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const bits = (map.physical[i] ?? 0) & PHYSICAL_MASK;
    metatiles[i] = id;
    physical[i] = bits;
    collision[i] = getPhysicalLayerValue(bits, "collision");
    elevation[i] = getPhysicalLayerValue(bits, "elevation");
    used.add(id);
  }

  const metadata = parsePokeemeraldMapJson(stringifyMapJson(mapJson));

  const properties: Record<string, unknown> = {};
  for (const key of PROPERTY_KEYS) {
    if (key in mapJson) properties[key] = mapJson[key];
  }
  for (const [key, value] of Object.entries(mapJson)) {
    if (STRUCTURAL_KEYS.has(key)) continue;
    if (key in properties) continue;
    properties[key] = value;
  }

  const grid = buildPassabilityGrid(map, input.atlas ?? null);
  const connectionContracts: CityConnectionContract[] = (
    Array.isArray(mapJson.connections) ? mapJson.connections : []
  ).map((raw, index) => {
    const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const direction = typeof record.direction === "string" ? record.direction : null;
    const border = borderCells(map.width, map.height, direction);
    let open = 0;
    let conditional = 0;
    for (const cell of border) {
      const state = grid.at(cell.x, cell.y);
      if (state === "passable") open++;
      else if (state === "conditional" || state === "unknown") conditional++;
    }
    return {
      index,
      map: typeof record.map === "string" ? record.map : null,
      direction,
      offset: Number.isInteger(record.offset) ? (record.offset as number) : null,
      borderCells: border.length,
      openCells: open,
      conditionalCells: conditional,
    };
  });

  const binBytes = exportMapBin(map);
  const cellsPayload = canonicalJson({ metatiles, physical });

  const bundle: AraunaCityBundle = {
    format: ARAUNA_CITY_FORMAT,
    version: 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    studioMapName: input.mapName ?? null,
    identity: {
      id: requireText(mapJson.id, "id"),
      name: requireText(mapJson.name, "name"),
      layout: requireText(mapJson.layout, "layout"),
      width: map.width,
      height: map.height,
    },
    tilesets: {
      primary: input.atlas?.primary ?? null,
      secondary: input.atlas?.secondary ?? null,
      atlasFingerprint: atlasFingerprint(input.atlas ?? null),
      atlasRecordCount: input.atlas ? input.atlas.records.length : null,
      metatileIdsUsed: Array.from(used).sort((a, b) => a - b),
    },
    cells: { metatiles, physical, collision, elevation },
    mapJson,
    properties,
    protectedCells: metadata.protectedCells,
    connectionContracts,
    ...(input.semantics ? { semantics: input.semantics } : {}),
    integrity: {
      cellCount: size,
      binByteLength: binBytes.byteLength,
      binChecksum: checksumBytes(binBytes),
      cellsChecksum: fnv1a(cellsPayload),
      mapJsonChecksum: fnv1a(canonicalJson(mapJson)),
    },
  };

  return bundle;
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

export function serializeCityBundle(bundle: AraunaCityBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/* ------------------------------------------------------------------ */
/* parse + compile                                                     */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integerArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) throw new CityBundleError(`Bundle inválido: "${field}" precisa ser uma lista.`);
  return value.map((item, index) => {
    if (typeof item !== "number" || !Number.isInteger(item)) {
      throw new CityBundleError(`Bundle inválido: "${field}[${index}]" não é um inteiro.`);
    }
    return item;
  });
}

/** Parse estrutural: nunca corrige, nunca renumera. Erro = import bloqueado. */
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
  if (!isRecord(parsed)) throw new CityBundleError("Cidade JSON inválido: a raiz precisa ser um objeto.");
  if (parsed.format !== ARAUNA_CITY_FORMAT) {
    throw new CityBundleError(
      `Formato não suportado: "${String(parsed.format)}". Esperado "${ARAUNA_CITY_FORMAT}".`,
    );
  }
  const identity = parsed.identity;
  if (!isRecord(identity)) throw new CityBundleError("Bundle inválido: bloco identity ausente.");
  const width = identity.width;
  const height = identity.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || (width as number) <= 0 || (height as number) <= 0) {
    throw new CityBundleError(`Bundle inválido: dimensão ${String(width)}×${String(height)}.`);
  }
  const cells = parsed.cells;
  if (!isRecord(cells)) throw new CityBundleError("Bundle inválido: bloco cells ausente.");
  const mapJson = parsed.mapJson;
  if (!isRecord(mapJson)) throw new CityBundleError("Bundle inválido: mapJson ausente ou não é objeto.");
  const integrity = parsed.integrity;
  if (!isRecord(integrity)) throw new CityBundleError("Bundle inválido: bloco integrity ausente.");

  integerArray(cells.metatiles, "cells.metatiles");
  integerArray(cells.physical, "cells.physical");

  return parsed as unknown as AraunaCityBundle;
}

export interface BundleIntegrityIssue {
  code: string;
  message: string;
}

export function verifyBundleIntegrity(bundle: AraunaCityBundle): BundleIntegrityIssue[] {
  const issues: BundleIntegrityIssue[] = [];
  const { width, height } = bundle.identity;
  const expected = width * height;
  const metatiles = bundle.cells.metatiles;
  const physical = bundle.cells.physical;

  if (metatiles.length !== expected) {
    issues.push({
      code: "BUNDLE_CELL_COUNT",
      message: `cells.metatiles tem ${metatiles.length} células; identity declara ${width}×${height} = ${expected}.`,
    });
  }
  if (physical.length !== expected) {
    issues.push({
      code: "BUNDLE_PHYSICAL_COUNT",
      message: `cells.physical tem ${physical.length} células; esperado ${expected}.`,
    });
  }
  if (bundle.integrity.cellCount !== expected) {
    issues.push({
      code: "BUNDLE_INTEGRITY_CELL_COUNT",
      message: `integrity.cellCount=${bundle.integrity.cellCount} não bate com ${expected}.`,
    });
  }
  if (issues.length) return issues;

  for (let i = 0; i < expected; i++) {
    const id = metatiles[i] ?? 0;
    if (id < 0 || id > METATILE_MASK) {
      issues.push({ code: "BUNDLE_METATILE_RANGE", message: `Metatile ${id} na célula ${i} fora de 0x000–0x3FF.` });
      break;
    }
    const bits = physical[i] ?? 0;
    if (bits < 0 || bits > 0xffff || (bits & ~PHYSICAL_MASK) !== 0) {
      issues.push({ code: "BUNDLE_PHYSICAL_RANGE", message: `Bits físicos ${bits} na célula ${i} fora de 0xFC00.` });
      break;
    }
  }

  const cellsChecksum = fnv1a(canonicalJson({ metatiles, physical }));
  if (bundle.integrity.cellsChecksum !== cellsChecksum) {
    issues.push({
      code: "BUNDLE_CELLS_CHECKSUM",
      message: `Checksum das células não confere (bundle ${bundle.integrity.cellsChecksum}, calculado ${cellsChecksum}). Arquivo alterado ou corrompido.`,
    });
  }
  const mapJsonChecksum = fnv1a(canonicalJson(bundle.mapJson));
  if (bundle.integrity.mapJsonChecksum !== mapJsonChecksum) {
    issues.push({
      code: "BUNDLE_MAPJSON_CHECKSUM",
      message: `Checksum do map.json não confere (bundle ${bundle.integrity.mapJsonChecksum}, calculado ${mapJsonChecksum}).`,
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

/** Bundle -> MapData + map.json. Lança se a integridade falhar (import atômico). */
export function compileCityBundle(bundle: AraunaCityBundle): CompiledCityBundle {
  const issues = verifyBundleIntegrity(bundle);
  if (issues.length) {
    throw new CityBundleError(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
  }
  const { width, height } = bundle.identity;
  const size = width * height;
  const metatiles = new Uint16Array(size);
  const physical = new Uint16Array(size);
  for (let i = 0; i < size; i++) {
    metatiles[i] = (bundle.cells.metatiles[i] ?? 0) & METATILE_MASK;
    physical[i] = (bundle.cells.physical[i] ?? 0) & PHYSICAL_MASK;
  }
  const map: MapData = { width, height, metatiles, physical };
  const binBytes = exportMapBin(map);
  const binChecksum = checksumBytes(binBytes);
  if (bundle.integrity.binChecksum && bundle.integrity.binChecksum !== binChecksum) {
    throw new CityBundleError(
      `BUNDLE_BIN_CHECKSUM: map.bin reconstruído (${binChecksum}) difere do checksum do bundle (${bundle.integrity.binChecksum}).`,
    );
  }
  if (
    Number.isInteger(bundle.integrity.binByteLength) &&
    bundle.integrity.binByteLength !== binBytes.byteLength
  ) {
    throw new CityBundleError(
      `BUNDLE_BIN_SIZE: map.bin reconstruído tem ${binBytes.byteLength} bytes; bundle declara ${bundle.integrity.binByteLength}.`,
    );
  }

  return {
    map,
    mapJson: cloneMapJson(bundle.mapJson),
    identity: bundle.identity,
    binBytes,
  };
}

/** Equivalência semântica usada nos testes de round-trip. */
export function bundlesEquivalent(a: AraunaCityBundle, b: AraunaCityBundle): boolean {
  return (
    canonicalJson({ ...a, createdAt: null }) === canonicalJson({ ...b, createdAt: null })
  );
}

export function bundleCellIndex(bundle: AraunaCityBundle, x: number, y: number): number {
  return idx(x, y, bundle.identity.width);
}
