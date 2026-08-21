import {
  canonicalJson,
  fnv1a,
  type AraunaCityBundle,
  type CitySemantics,
} from "./araunaCityBundle";
import { cloneMapJson, stringifyMapJson, type EditableMapJson } from "./eventMapJson";
import {
  parsePokeemeraldMapJson,
  type ParsedProtectedCell,
} from "./pokeemeraldMapJson";

export const SHARED_EVENTS_SNAPSHOT_FORMAT = "pokeemerald-shared-events-v1" as const;

export interface SharedEventsSnapshot {
  format: typeof SHARED_EVENTS_SNAPSHOT_FORMAT;
  name: string;
  mapJson: EditableMapJson;
  mapJsonChecksum: string;
  protectedCells: ParsedProtectedCell[];
}

export interface CityBundleExternalDependencies {
  sharedEvents?: SharedEventsSnapshot;
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
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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
  const external = isRecord(base.externalDependencies)
    ? (cloneMapJson(base.externalDependencies) as CityBundleExternalDependencies)
    : {};
  return {
    ...base,
    externalDependencies: {
      ...external,
      sharedEvents: buildSharedEventsSnapshot(name, mapJson),
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

/**
 * Retorna o snapshot somente quando o formato básico é válido. A integridade
 * completa (checksum/name/protectedCells) deve ser checada por
 * validateBundleDependencies antes de conceder Game-ready.
 */
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

export function validateBundleDependencies(bundle: AraunaCityBundle): DependencyIntegrityIssue[] {
  const issues: DependencyIntegrityIssue[] = [];
  const expectedSharedName = nonEmptyText(bundle.mapJson.shared_events_map);
  const raw = rawSharedEventsSnapshot(bundle);

  if (!expectedSharedName) {
    if (raw != null) {
      issues.push({
        code: "BUNDLE_SHARED_EVENTS_UNEXPECTED",
        message: "Bundle contém snapshot de shared events, mas mapJson não declara shared_events_map.",
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
        message: "protectedCells do shared-events snapshot não corresponde aos eventos efetivos do mapJson compartilhado.",
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

export function effectiveProtectedCellsFromBundle(
  bundle: AraunaCityBundle,
): ParsedProtectedCell[] | null {
  const snapshot = sharedEventsSnapshotFromBundle(bundle);
  if (!snapshot || validateBundleDependencies(bundle).length) return null;
  return snapshot.protectedCells.map((cell) => ({ ...cell }));
}
