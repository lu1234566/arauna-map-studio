import type {
  AraunaCityBundle,
  CitySemantics,
} from "./araunaCityBundle";
import {
  sharedEventsSnapshotFromBundle,
  validateBundleDependencies,
  type SharedEventsSnapshot,
} from "./cityBundleDependencies";
import { cloneMapJson, type EditableMapJson } from "./eventMapJson";

export interface BundleDependencyContext {
  sourceDocument: EditableMapJson;
  sharedEvents: SharedEventsSnapshot | null;
  /** Semântica de autoria preservada sem os snapshots técnicos recalculáveis. */
  semanticBase?: CitySemantics;
}

let activeContext: BundleDependencyContext | null = null;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function semanticBaseFromBundle(bundle: AraunaCityBundle): CitySemantics | undefined {
  if (!bundle.semantics) return undefined;
  const cloned = cloneMapJson(bundle.semantics) as CitySemantics & {
    externalDependencies?: unknown;
  };
  // shared events/scripts são provas técnicas vinculadas ao estado atual e são
  // sempre reconstruídas por CompleteGameAudit. O resto da semântica (zonas,
  // estruturas, notas de autoria etc.) deve sobreviver ao round-trip.
  delete cloned.externalDependencies;
  return Object.keys(cloned).length ? cloned : undefined;
}

/** Guarda dependências e semântica apenas após validação integral do bundle. */
export function installBundleDependencyContextFromImport(
  bundle: AraunaCityBundle,
  document: EditableMapJson | null | undefined,
): BundleDependencyContext | null {
  if (!document || text(bundle.mapJson.id) !== text(document.id)) {
    activeContext = null;
    return null;
  }

  const dependencyIssues = validateBundleDependencies(bundle);
  if (dependencyIssues.length) {
    activeContext = null;
    return null;
  }
  const shared = sharedEventsSnapshotFromBundle(bundle);
  const semanticBase = semanticBaseFromBundle(bundle);

  activeContext = {
    sourceDocument: document,
    sharedEvents: shared,
    ...(semanticBase ? { semanticBase } : {}),
  };
  return activeContext;
}

export function importedSharedEventsSnapshot(
  document: EditableMapJson | null | undefined,
  expectedName: string,
): SharedEventsSnapshot | null {
  if (!document || activeContext?.sourceDocument !== document) return null;
  const snapshot = activeContext.sharedEvents;
  if (!snapshot || snapshot.name !== expectedName) return null;
  return snapshot;
}

export function importedBundleSemanticBase(
  document: EditableMapJson | null | undefined,
): CitySemantics | undefined {
  if (!document || activeContext?.sourceDocument !== document || !activeContext.semanticBase) {
    return undefined;
  }
  return cloneMapJson(activeContext.semanticBase);
}

export function clearBundleDependencyContext() {
  activeContext = null;
}
