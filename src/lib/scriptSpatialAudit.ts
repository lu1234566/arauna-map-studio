import { idx, type MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import { getPhysicalLayerValue } from "./physicalMap";
import type {
  ScriptMovementDefinition,
  ScriptObjectAnchor,
  ScriptSpatialContracts,
} from "./scriptSpatialContracts";

export type ScriptSpatialSeverity = "error" | "warning" | "info";

export interface ScriptSpatialIssue {
  code: string;
  severity: ScriptSpatialSeverity;
  message: string;
  x?: number;
  y?: number;
  localId?: string;
  line?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function collisionAt(map: MapData, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return getPhysicalLayerValue(map.physical[idx(x, y, map.width)] ?? 0, "collision");
}

function objectStarts(document: EditableMapJson) {
  const starts = new Map<string, Array<{ x: number; y: number }>>();
  if (!Array.isArray(document.object_events)) return starts;
  for (const raw of document.object_events) {
    if (!isRecord(raw)) continue;
    const localId = typeof raw.local_id === "string" ? raw.local_id.trim() : "";
    const x = integer(raw.x);
    const y = integer(raw.y);
    if (!localId || x === null || y === null) continue;
    const values = starts.get(localId) ?? [];
    values.push({ x, y });
    starts.set(localId, values);
  }
  return starts;
}

function simulate(
  map: MapData,
  start: { x: number; y: number },
  movement: ScriptMovementDefinition,
): { ok: boolean; reason: string; x: number; y: number } {
  let x = start.x;
  let y = start.y;
  for (const step of movement.steps) {
    for (let n = 0; n < step.distance; n++) {
      x += step.dx;
      y += step.dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        return { ok: false, reason: `sai do layout em (${x},${y})`, x, y };
      }
      const collision = collisionAt(map, x, y) ?? 1;
      if (collision > 0) {
        return { ok: false, reason: `encontra collision=${collision} em (${x},${y})`, x, y };
      }
    }
  }
  return { ok: true, reason: `termina em (${x},${y})`, x, y };
}

function sameAnchor(a: { x: number; y: number }, b: ScriptObjectAnchor) {
  return a.x === b.x && a.y === b.y;
}

/**
 * Audita fatos espaciais extraídos do scripts.inc sem fingir interpretar o
 * fluxo completo do bytecode. Erros são reservados a fatos inequívocos
 * (âncora fora do mapa / LOCALID inexistente); movimento com estado runtime
 * incerto vira warning quando nenhuma posição conhecida é segura.
 */
export function auditScriptSpatialContracts(
  contracts: ScriptSpatialContracts,
  map: MapData,
  effectiveEvents: EditableMapJson,
): ScriptSpatialIssue[] {
  const issues: ScriptSpatialIssue[] = [];
  const starts = objectStarts(effectiveEvents);
  const anchorsByObject = new Map<string, ScriptObjectAnchor[]>();

  for (const anchor of contracts.anchors) {
    const values = anchorsByObject.get(anchor.localId) ?? [];
    values.push(anchor);
    anchorsByObject.set(anchor.localId, values);

    if (anchor.localId.startsWith("LOCALID_") && !starts.has(anchor.localId)) {
      issues.push({
        code: "SCRIPT_OBJECT_LOCALID_MISSING",
        severity: "error",
        message: `${anchor.command} referencia ${anchor.localId}, mas nenhum object_event efetivo declara esse local_id.`,
        x: anchor.x,
        y: anchor.y,
        localId: anchor.localId,
        line: anchor.line,
      });
    }

    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= map.width || anchor.y >= map.height) {
      issues.push({
        code: "SCRIPT_OBJECT_ANCHOR_OUT_OF_BOUNDS",
        severity: "error",
        message: `${anchor.command} move ${anchor.localId} para (${anchor.x},${anchor.y}), fora do layout ${map.width}×${map.height}.`,
        x: anchor.x,
        y: anchor.y,
        localId: anchor.localId,
        line: anchor.line,
      });
      continue;
    }

    const collision = collisionAt(map, anchor.x, anchor.y) ?? 0;
    if (collision > 0) {
      issues.push({
        code: "SCRIPT_OBJECT_ANCHOR_BLOCKED",
        severity: "warning",
        message: `${anchor.command} posiciona ${anchor.localId} em (${anchor.x},${anchor.y}) com collision=${collision}; revise a cutscene/estado futuro antes de exportar.`,
        x: anchor.x,
        y: anchor.y,
        localId: anchor.localId,
        line: anchor.line,
      });
    } else {
      issues.push({
        code: "SCRIPT_OBJECT_ANCHOR_OK",
        severity: "info",
        message: `${anchor.localId} possui posição runtime (${anchor.x},${anchor.y}) livre, derivada de ${anchor.command}.`,
        x: anchor.x,
        y: anchor.y,
        localId: anchor.localId,
        line: anchor.line,
      });
    }
  }

  for (const use of contracts.movementUses) {
    const movement = contracts.movements[use.movementLabel];
    if (!movement) {
      // Common_Movement_* e labels de outros includes são externos ao arquivo.
      if (!use.movementLabel.startsWith("Common_")) {
        issues.push({
          code: "SCRIPT_MOVEMENT_DEFINITION_EXTERNAL",
          severity: "info",
          message: `${use.movementLabel} usado por ${use.localId} não é definido neste scripts.inc; mantido como dependência externa de movimento.`,
          localId: use.localId,
          line: use.line,
        });
      }
      continue;
    }

    if (!movement.deterministic) {
      issues.push({
        code: "SCRIPT_MOVEMENT_GEOMETRY_PARTIAL",
        severity: "info",
        message: `${use.movementLabel} contém comandos que o simulador espacial conservador não resolve por completo.`,
        localId: use.localId,
        line: use.line,
      });
      continue;
    }

    const candidates = [
      ...(starts.get(use.localId) ?? []),
      ...(anchorsByObject.get(use.localId) ?? []).map((anchor) => ({ x: anchor.x, y: anchor.y })),
    ].filter((candidate, index, all) => all.findIndex((other) => sameAnchor(candidate, {
      command: "setobjectxy",
      localId: use.localId,
      x: other.x,
      y: other.y,
      scriptLabel: null,
      line: 0,
    })) === index);

    if (!candidates.length || !movement.steps.length) continue;
    const simulations = candidates.map((candidate) => ({
      candidate,
      result: simulate(map, candidate, movement),
    }));
    const valid = simulations.filter((entry) => entry.result.ok);
    if (!valid.length) {
      issues.push({
        code: "SCRIPT_MOVEMENT_NO_KNOWN_SAFE_PATH",
        severity: "warning",
        message: `${use.movementLabel} para ${use.localId} não encontrou caminho livre a partir de nenhuma posição conhecida (${simulations.map((entry) => `${entry.candidate.x},${entry.candidate.y}: ${entry.result.reason}`).join("; ")}). O fluxo runtime pode ter movimentos prévios não modelados, então isso exige revisão e não é tratado como erro de engine.`,
        localId: use.localId,
        line: use.line,
      });
    } else {
      issues.push({
        code: "SCRIPT_MOVEMENT_HAS_SAFE_PATH",
        severity: "info",
        message: `${use.movementLabel} para ${use.localId} tem ${valid.length}/${simulations.length} posição(ões) conhecida(s) com trajetória livre.`,
        localId: use.localId,
        line: use.line,
      });
    }
  }

  return issues;
}
