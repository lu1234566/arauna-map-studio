import type { AraunaCityBundle } from "./araunaCityBundle";
import { sharedEventsSnapshotFromBundle } from "./cityBundleDependencies";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityIssue,
  ImplementabilityWorkspaceContext,
} from "./gameImplementability";
import { cellPassability } from "./mapPassability";
import { sharedEventsContextKey } from "./workspaceAuditContext";

const SYMBOLIC_WARP_IDS: Record<string, number> = {
  WARP_ID_NONE: -1,
  WARP_ID_SECRET_BASE: 0x7e,
  WARP_ID_DYNAMIC: 0x7f,
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function integerLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  return SYMBOLIC_WARP_IDS[value] ?? null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function effectiveEvents(
  document: EditableMapJson,
  workspace: ImplementabilityWorkspaceContext | null,
  bundle?: AraunaCityBundle | null,
): EditableMapJson | null {
  const sharedName = text(document.shared_events_map);
  if (!sharedName) return document;
  const fromWorkspace = workspace?.maps[sharedEventsContextKey(sharedName)]?.mapJson ?? null;
  if (fromWorkspace) return fromWorkspace;
  const snapshot = sharedEventsSnapshotFromBundle(bundle);
  return snapshot?.name === sharedName ? snapshot.mapJson : null;
}

function appendIssues(
  base: GameImplementabilityReport,
  additions: ImplementabilityIssue[],
): GameImplementabilityReport {
  if (!additions.length) return base;
  const categories = Object.fromEntries(
    Object.entries(base.categories).map(([key, value]) => [key, { ...value }]),
  ) as GameImplementabilityReport["categories"];
  const counts = { ...base.counts };

  for (const found of additions) {
    if (found.severity === "error") {
      counts.errors++;
      categories[found.category].errors++;
    } else if (found.severity === "warning") {
      counts.warnings++;
      categories[found.category].warnings++;
    } else {
      counts.info++;
      categories[found.category].info++;
    }
  }
  const pass = base.pass && additions.every((found) => found.severity !== "error");
  const fullyVerified = base.fullyVerified && additions.every((found) => found.severity === "info");
  return {
    ...base,
    pass,
    fullyVerified,
    implementable: fullyVerified,
    confidence: fullyVerified ? "full" : "partial",
    issues: [...base.issues, ...additions],
    categories,
    counts,
  };
}

/**
 * Complementa a validação de referência de warp com a célula de spawn real no
 * mapa destino. Um destination warp existente não é suficiente se a edição do
 * mapa vizinho o colocou dentro de collision ou em behavior desconhecido.
 */
export function withWarpEndpointSafetyAudit(
  base: GameImplementabilityReport,
  mapJson: EditableMapJson | null,
  workspace: ImplementabilityWorkspaceContext | null,
  bundle?: AraunaCityBundle | null,
): GameImplementabilityReport {
  if (!mapJson) return base;
  const sourceEvents = effectiveEvents(mapJson, workspace, bundle);
  if (!sourceEvents || !Array.isArray(sourceEvents.warp_events)) return base;
  const additions: ImplementabilityIssue[] = [];

  sourceEvents.warp_events.forEach((raw, eventIndex) => {
    const sourceWarp = record(raw);
    if (!sourceWarp) return;
    const destMap = text(sourceWarp.dest_map);
    const destWarpId = integerLike(sourceWarp.dest_warp_id);
    if (!destMap || destMap === "MAP_DYNAMIC" || destWarpId === null || destWarpId < 0) return;

    const destination = workspace?.maps[destMap];
    if (!destination) return; // O auditor-base já emite WARP_DEST_UNVERIFIED.
    const destinationEvents = effectiveEvents(destination.mapJson, workspace);
    const targetWarps = Array.isArray(destinationEvents?.warp_events)
      ? destinationEvents.warp_events
      : null;
    const target = targetWarps && destWarpId < targetWarps.length
      ? record(targetWarps[destWarpId])
      : null;
    if (!target) return; // WARP_DEST_NOT_FOUND já é erro no auditor-base.

    const x = integer(target.x);
    const y = integer(target.y);
    if (x === null || y === null) {
      additions.push({
        code: "WARP_DEST_SPAWN_COORDS_INVALID",
        severity: "error",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId}, mas o warp_event destino não possui x/y inteiros válidos.`,
        eventSource: "warp",
        eventIndex,
      });
      return;
    }

    if (!destination.map || !destination.atlas) {
      additions.push({
        code: "WARP_DEST_SPAWN_UNVERIFIED",
        severity: "warning",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId} (${x},${y}), mas map.bin/behavior do destino não está disponível para certificar o spawn.`,
        eventSource: "warp",
        eventIndex,
      });
      return;
    }

    if (x < 0 || y < 0 || x >= destination.map.width || y >= destination.map.height) {
      additions.push({
        code: "WARP_DEST_SPAWN_OUT_OF_BOUNDS",
        severity: "error",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId} em (${x},${y}), fora do map.bin ${destination.map.width}×${destination.map.height}.`,
        eventSource: "warp",
        eventIndex,
      });
      return;
    }

    const passability = cellPassability(destination.map, x, y, destination.atlas);
    if (passability.state === "blocked") {
      additions.push({
        code: "WARP_DEST_SPAWN_BLOCKED",
        severity: "error",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId} em (${x},${y}) bloqueado: ${passability.reason}.`,
        eventSource: "warp",
        eventIndex,
        x,
        y,
      });
    } else if (passability.state === "unknown") {
      additions.push({
        code: "WARP_DEST_SPAWN_UNKNOWN",
        severity: "warning",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId} em (${x},${y}) com behavior não certificável: ${passability.reason}.`,
        eventSource: "warp",
        eventIndex,
        x,
        y,
      });
    } else {
      additions.push({
        code: "WARP_DEST_SPAWN_OK",
        severity: "info",
        category: "warps",
        message: `Warp ${eventIndex} chega a ${destMap}:${destWarpId} em (${x},${y}) com passagem ${passability.state} certificada.`,
        eventSource: "warp",
        eventIndex,
        x,
        y,
      });
    }
  });

  return appendIssues(base, additions);
}
