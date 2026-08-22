import {
  canonicalJson,
  fnv1a,
  type AraunaCityBundle,
  type CitySemantics,
} from "./araunaCityBundle";
import { cloneMapJson, stringifyMapJson, type EditableMapJson } from "./eventMapJson";
import { parsePokeemeraldMapJson, type ParsedProtectedCell } from "./pokeemeraldMapJson";
import { parseScriptSpatialContracts, type ScriptSpatialContracts } from "./scriptSpatialContracts";

export const SHARED_EVENTS_SNAPSHOT_FORMAT = "pokeemerald-shared-events-v1" as const;
export const SCRIPT_SPATIAL_SNAPSHOT_FORMAT = "pokeemerald-script-spatial-v1" as const;

export interface SharedEventsSnapshot {
  format: typeof SHARED_EVENTS_SNAPSHOT_FORMAT;
  name: string;
  mapJson: EditableMapJson;
  mapJsonChecksum: string;
  protectedCells: ParsedProtectedCell[];
}

export interface ScriptSpatialSnapshot {
  format: typeof SCRIPT_SPATIAL_SNAPSHOT_FORMAT;
  mapName: string;
  sourcePath: string;
  source: string;
  sourceChecksum: string;
  contracts: ScriptSpatialContracts;
  contractsChecksum: string;
}

export interface CityBundleExternalDependencies {
  sharedEvents?: SharedEventsSnapshot;
  scriptSpatial?: ScriptSpatialSnapshot;
}

export interface CityDependencySemantics extends CitySemantics {
  externalDependencies?: CityBundleExternalDependencies;
}

export interface DependencyIntegrityIssue {
  code: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function externalDependencies(
  semantics: CitySemantics | undefined,
): CityBundleExternalDependencies {
  if (!semantics) return {};
  const raw = (semantics as CityDependencySemantics).externalDependencies;
  return isRecord(raw) ? (cloneMapJson(raw) as CityBundleExternalDependencies) : {};
}

export function buildSharedEventsSnapshot(
  name: string,
  mapJson: EditableMapJson,
): SharedEventsSnapshot {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("shared_events_map vazio não pode virar snapshot.");
  const cloned = cloneMapJson(mapJson);
  const metadata = parsePokeemeraldMapJson(stringifyMapJson(cloned));
  return {
    format: SHARED_EVENTS_SNAPSHOT_FORMAT,
    name: normalizedName,
    mapJson: cloned,
    mapJsonChecksum: fnv1a(canonicalJson(cloned)),
    protectedCells: metadata.protectedCells.map((cell) => ({ ...cell })),
  };
}

export function withSharedEventsSnapshot(
  semantics: CitySemantics | undefined,
  name: string,
  mapJson: EditableMapJson,
): CityDependencySemantics {
  const base = semantics ? (cloneMapJson(semantics) as CityDependencySemantics) : {};
  return {
    ...base,
    externalDependencies: {
      ...externalDependencies(base),
      sharedEvents: buildSharedEventsSnapshot(name, mapJson),
    },
  };
}

export function buildScriptSpatialSnapshot(
  mapName: string,
  sourcePath: string,
  source: string,
): ScriptSpatialSnapshot {
  const normalizedName = mapName.trim();
  const normalizedPath = sourcePath.trim();
  if (!normalizedName) throw new Error("Nome do mapa de scripts vazio não pode virar snapshot.");
  if (!normalizedPath) throw new Error("Caminho de scripts.inc vazio não pode virar snapshot.");
  const normalizedSource = source.replace(/\r/g, "");
  const contracts = parseScriptSpatialContracts(normalizedSource);
  return {
    format: SCRIPT_SPATIAL_SNAPSHOT_FORMAT,
    mapName: normalizedName,
    sourcePath: normalizedPath,
    source: normalizedSource,
    sourceChecksum: fnv1a(normalizedSource),
    contracts,
    contractsChecksum: fnv1a(canonicalJson(contracts)),
  };
}

export function withScriptSpatialSnapshot(
  semantics: CitySemantics | undefined,
  mapName: string,
  sourcePath: string,
  source: string,
): CityDependencySemantics {
  const base = semantics ? (cloneMapJson(semantics) as CityDependencySemantics) : {};
  return {
    ...base,
    externalDependencies: {
      ...externalDependencies(base),
      scriptSpatial: buildScriptSpatialSnapshot(mapName, sourcePath, source),
    },
  };
}

export function rawSharedEventsSnapshot(bundle: AraunaCityBundle | null | undefined): unknown {
  const semantics = bundle?.semantics;
  if (!isRecord(semantics)) return null;
  const external = semantics.externalDependencies;
  if (!isRecord(external)) return null;
  return external.sharedEvents ?? null;
}

export function rawScriptSpatialSnapshot(bundle: AraunaCityBundle | null | undefined): unknown {
  const semantics = bundle?.semantics;
  if (!isRecord(semantics)) return null;
  const external = semantics.externalDependencies;
  if (!isRecord(external)) return null;
  return external.scriptSpatial ?? null;
}

/** Retorna o snapshot somente quando o formato estrutural mínimo é válido. */
export function sharedEventsSnapshotFromBundle(
  bundle: AraunaCityBundle | null | undefined,
): SharedEventsSnapshot | null {
  const raw = rawSharedEventsSnapshot(bundle);
  if (!isRecord(raw)) return null;
  if (raw.format !== SHARED_EVENTS_SNAPSHOT_FORMAT) return null;
  if (!nonEmptyText(raw.name)) return null;
  if (!isRecord(raw.mapJson)) return null;
  if (!nonEmptyText(raw.mapJsonChecksum)) return null;
  if (!Array.isArray(raw.protectedCells)) return null;
  return raw as unknown as SharedEventsSnapshot;
}

/** Retorna o snapshot espacial apenas quando seus campos-base existem. */
export function scriptSpatialSnapshotFromBundle(
  bundle: AraunaCityBundle | null | undefined,
): ScriptSpatialSnapshot | null {
  const raw = rawScriptSpatialSnapshot(bundle);
  if (!isRecord(raw)) return null;
  if (raw.format !== SCRIPT_SPATIAL_SNAPSHOT_FORMAT) return null;
  if (!nonEmptyText(raw.mapName) || !nonEmptyText(raw.sourcePath)) return null;
  if (typeof raw.source !== "string") return null;
  if (!nonEmptyText(raw.sourceChecksum) || !nonEmptyText(raw.contractsChecksum)) return null;
  if (!isRecord(raw.contracts)) return null;
  return raw as unknown as ScriptSpatialSnapshot;
}

function validateSharedEventsDependency(bundle: AraunaCityBundle): DependencyIntegrityIssue[] {
  const issues: DependencyIntegrityIssue[] = [];
  const expectedSharedName = nonEmptyText(bundle.mapJson.shared_events_map);
  const raw = rawSharedEventsSnapshot(bundle);

  if (!expectedSharedName) {
    if (raw != null) {
      issues.push({
        code: "BUNDLE_SHARED_EVENTS_UNEXPECTED",
        message:
          "Bundle contém snapshot de shared events, mas mapJson não declara shared_events_map.",
      });
    }
    return issues;
  }

  const snapshot = sharedEventsSnapshotFromBundle(bundle);
  if (!snapshot) {
    issues.push({
      code: "BUNDLE_SHARED_EVENTS_MISSING",
      message: `mapJson declara shared_events_map=${expectedSharedName}, mas o bundle não contém um snapshot íntegro dessa fonte.`,
    });
    return issues;
  }

  if (snapshot.name !== expectedSharedName) {
    issues.push({
      code: "BUNDLE_SHARED_EVENTS_NAME_MISMATCH",
      message: `Snapshot aponta para ${snapshot.name}, mas mapJson declara ${expectedSharedName}.`,
    });
  }

  const sourceName = nonEmptyText(snapshot.mapJson.name);
  if (sourceName && sourceName !== snapshot.name) {
    issues.push({
      code: "BUNDLE_SHARED_EVENTS_SOURCE_MISMATCH",
      message: `Snapshot foi rotulado ${snapshot.name}, mas seu mapJson.name é ${sourceName}.`,
    });
  }

  const checksum = fnv1a(canonicalJson(snapshot.mapJson));
  if (checksum !== snapshot.mapJsonChecksum) {
    issues.push({
      code: "BUNDLE_SHARED_EVENTS_CHECKSUM",
      message: `Checksum do shared-events snapshot diverge: ${snapshot.mapJsonChecksum} != ${checksum}.`,
    });
  }

  try {
    const derived = parsePokeemeraldMapJson(stringifyMapJson(snapshot.mapJson)).protectedCells;
    if (canonicalJson(derived) !== canonicalJson(snapshot.protectedCells)) {
      issues.push({
        code: "BUNDLE_SHARED_EVENTS_PROTECTION_MISMATCH",
        message:
          "protectedCells do shared-events snapshot não corresponde aos eventos efetivos do mapJson compartilhado.",
      });
    }
  } catch (error) {
    issues.push({
      code: "BUNDLE_SHARED_EVENTS_MAPJSON_INVALID",
      message: `mapJson do shared-events snapshot não pôde ser interpretado: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return issues;
}

function validateScriptSpatialDependency(bundle: AraunaCityBundle): DependencyIntegrityIssue[] {
  const issues: DependencyIntegrityIssue[] = [];
  const raw = rawScriptSpatialSnapshot(bundle);
  if (raw == null) return issues;

  const snapshot = scriptSpatialSnapshotFromBundle(bundle);
  if (!snapshot) {
    issues.push({
      code: "BUNDLE_SCRIPT_SPATIAL_INVALID",
      message:
        "Bundle contém scriptSpatial, mas o snapshot não possui formato/campos obrigatórios válidos.",
    });
    return issues;
  }

  const expectedMapName =
    nonEmptyText(bundle.mapJson.shared_scripts_map) ?? nonEmptyText(bundle.mapJson.name);
  if (expectedMapName && snapshot.mapName !== expectedMapName) {
    issues.push({
      code: "BUNDLE_SCRIPT_SPATIAL_SOURCE_MISMATCH",
      message: `Snapshot espacial aponta para ${snapshot.mapName}, mas o MapHeader usa scripts de ${expectedMapName}.`,
    });
  }

  const normalizedSource = snapshot.source.replace(/\r/g, "");
  const sourceChecksum = fnv1a(normalizedSource);
  if (sourceChecksum !== snapshot.sourceChecksum) {
    issues.push({
      code: "BUNDLE_SCRIPT_SPATIAL_SOURCE_CHECKSUM",
      message: `Checksum de scripts.inc diverge: ${snapshot.sourceChecksum} != ${sourceChecksum}.`,
    });
  }

  const contractsChecksum = fnv1a(canonicalJson(snapshot.contracts));
  if (contractsChecksum !== snapshot.contractsChecksum) {
    issues.push({
      code: "BUNDLE_SCRIPT_SPATIAL_CONTRACTS_CHECKSUM",
      message: `Checksum dos contratos espaciais diverge: ${snapshot.contractsChecksum} != ${contractsChecksum}.`,
    });
  }

  try {
    const derived = parseScriptSpatialContracts(normalizedSource);
    if (canonicalJson(derived) !== canonicalJson(snapshot.contracts)) {
      issues.push({
        code: "BUNDLE_SCRIPT_SPATIAL_DERIVATION_MISMATCH",
        message: "Contratos espaciais armazenados não correspondem ao scripts.inc embutido.",
      });
    }
  } catch (error) {
    issues.push({
      code: "BUNDLE_SCRIPT_SPATIAL_SOURCE_INVALID",
      message: `scripts.inc embutido não pôde ser interpretado: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return issues;
}

export function validateBundleDependencies(bundle: AraunaCityBundle): DependencyIntegrityIssue[] {
  return [...validateSharedEventsDependency(bundle), ...validateScriptSpatialDependency(bundle)];
}

export function effectiveProtectedCellsFromBundle(
  bundle: AraunaCityBundle,
): ParsedProtectedCell[] | null {
  const snapshot = sharedEventsSnapshotFromBundle(bundle);
  if (!snapshot || validateSharedEventsDependency(bundle).length) return null;
  return snapshot.protectedCells.map((cell) => ({ ...cell }));
}
