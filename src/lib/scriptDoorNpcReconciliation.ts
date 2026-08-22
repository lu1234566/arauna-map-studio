import type { FingerprintAtlas } from "./araunaCityBundle";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
  ImplementabilityIssue,
} from "./gameImplementability";
import { cellPassability } from "./mapPassability";
import { findScriptDoorSpawnProof } from "./scriptSpatialAudit";
import { getScriptSpatialContext } from "./scriptSpatialContext";

const MB_ANIMATED_DOOR = 0x69;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function rebuildReport(
  base: GameImplementabilityReport,
  issues: ImplementabilityIssue[],
): GameImplementabilityReport {
  const categories = Object.fromEntries(
    Object.keys(base.categories).map((key) => [key, { errors: 0, warnings: 0, info: 0 }]),
  ) as Record<ImplementabilityCategory, { errors: number; warnings: number; info: number }>;
  const counts = { errors: 0, warnings: 0, info: 0 };

  for (const issue of issues) {
    if (issue.severity === "error") {
      counts.errors++;
      categories[issue.category].errors++;
    } else if (issue.severity === "warning") {
      counts.warnings++;
      categories[issue.category].warnings++;
    } else {
      counts.info++;
      categories[issue.category].info++;
    }
  }

  const pass = counts.errors === 0;
  const fullyVerified = pass && counts.warnings === 0;
  return {
    ...base,
    pass,
    fullyVerified,
    implementable: fullyVerified,
    confidence: fullyVerified ? "full" : "partial",
    issues,
    categories,
    counts,
  };
}

/**
 * O auditor-base só vê o map.bin e corretamente estranha um NPC que nasce em
 * collision > 0. Depois que scripts.inc e o atlas estão disponíveis podemos
 * provar o caso vanilla em que o objeto fica guardado sobre uma porta animada e
 * só é adicionado após `opendoor` nas mesmas coordenadas.
 *
 * A remoção do NPC_BLOCKED exige simultaneamente:
 * - o mesmo object_event / LOCALID;
 * - behavior MB_ANIMATED_DOOR no atlas real;
 * - `opendoor x,y` antes de `addobject LOCALID` no mesmo bloco de script.
 */
export function withScriptDoorNpcReconciliation(
  base: GameImplementabilityReport,
  mapJson: EditableMapJson | null,
  map: MapData,
  atlas: FingerprintAtlas | null | undefined,
): GameImplementabilityReport {
  if (!mapJson || !Array.isArray(mapJson.object_events) || !atlas) return base;
  const context = getScriptSpatialContext();
  const mapId = text(mapJson.id);
  if (
    !context ||
    !context.contracts ||
    context.error ||
    !mapId ||
    context.sourceMapId !== mapId ||
    context.sourceDocument !== mapJson
  ) {
    return base;
  }

  const replacements = new Map<number, ImplementabilityIssue>();
  for (const issue of base.issues) {
    if (issue.code !== "NPC_BLOCKED" || issue.eventIndex === undefined) continue;
    const raw = mapJson.object_events[issue.eventIndex];
    if (!isRecord(raw)) continue;
    const x = typeof raw.x === "number" && Number.isInteger(raw.x) ? raw.x : null;
    const y = typeof raw.y === "number" && Number.isInteger(raw.y) ? raw.y : null;
    if (x === null || y === null || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;

    const tile = cellPassability(map, x, y, atlas);
    if (tile.behavior !== MB_ANIMATED_DOOR) continue;

    const explicitLocalId = text(raw.local_id);
    const localId = explicitLocalId ?? String(issue.eventIndex + 1);
    const proof = findScriptDoorSpawnProof(context.contracts, localId, x, y);
    if (!proof) continue;

    replacements.set(issue.eventIndex, {
      code: "NPC_SCRIPTED_DOOR_SPAWN_OK",
      severity: "info",
      category: "npcs",
      message:
        `NPC ${issue.eventIndex} (${localId}) ocupa (${x},${y}) sobre porta animada fechada no mapa-base, ` +
        `mas ${proof.scriptLabel} executa opendoor antes de addobject; spawn runtime certificado como intencional.`,
      eventSource: "object",
      eventIndex: issue.eventIndex,
      x,
      y,
    });
  }

  if (!replacements.size) return base;
  const issues: ImplementabilityIssue[] = [];
  for (const issue of base.issues) {
    if (issue.code === "NPC_BLOCKED" && issue.eventIndex !== undefined) {
      const replacement = replacements.get(issue.eventIndex);
      if (replacement) {
        issues.push(replacement);
        continue;
      }
    }
    issues.push(issue);
  }
  return rebuildReport(base, issues);
}
