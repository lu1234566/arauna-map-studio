import type { AraunaCityBundle } from "./araunaCityBundle";
import {
  sharedEventsSnapshotFromBundle,
  validateBundleDependencies,
  type SharedEventsSnapshot,
} from "./cityBundleDependencies";
import type { EditableMapJson } from "./eventMapJson";

interface BundleDependencyContext {
  sourceDocument: EditableMapJson;
  sharedEvents: SharedEventsSnapshot | null;
}

let activeContext: BundleDependencyContext | null = null;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Guarda somente dependências cujo checksum/derivação já foram validados. */
export function installBundleDependencyContextFromImport(
  bundle: AraunaCityBundle,
  document: EditableMapJson | null | undefined,
): BundleDependencyContext | null {
  if (!document || text(bundle.mapJson.id) !== text(document.id)) {
    activeContext = null;
    return null;
  }

  const dependencyIssues = validateBundleDependencies(bundle);
  const sharedIssues = dependencyIssues.filter((found) =>
    found.code.startsWith("BUNDLE_SHARED_EVENTS_"),
  );
  const shared = sharedEventsSnapshotFromBundle(bundle);
  if (sharedIssues.length) {
    activeContext = null;
    return null;
  }

  activeContext = {
    sourceDocument: document,
    sharedEvents: shared,
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

export function clearBundleDependencyContext() {
  activeContext = null;
}
