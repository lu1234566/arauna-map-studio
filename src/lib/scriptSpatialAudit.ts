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

/** IDs reservados pelo engine e que não precisam de object_event no map.json. */
const ENGINE_LOCAL_IDS = new Set([
  "LOCALID_NONE",
  "LOCALID_CAMERA",
  "LOCALID_BERRY_BLENDER_PLAYER_END",
  "LOCALID_PLAYER",
  // Equivalentes numéricos definidos em include/constants/event_objects.h.
  "0",
  "127",
  "236",
  "237",
  "238",
  "239",
  "240",
  "255",
]);

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

function addStart(
  starts: Map<string, Array<{ x: number; y: number }>>,
  key: string,
  point: { x: number; y: number },
) {
  const values = starts.get(key) ?? [];
  if (!values.some((value) => value.x === point.x && value.y === point.y)) values.push(point);
  starts.set(key, values);
}

/**
 * tools/mapjson gera object_event com local id `index + 1`, mesmo quando o
 * map.json não possui um campo local_id textual. Por isso registramos sempre a
 * chave numérica e, quando existir, também o alias LOCALID_* explícito.
 */
function objectStarts(document: EditableMapJson) {
  const starts = new Map<string, Array<{ x: number; y: number }>>();
  if (!Array.isArray(document.object_events)) return starts;
  document.object_events.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const x = integer(raw.x);
    const y = integer(raw.y);
    if (x === null || y === null) return;
    const point = { x, y };
    addStart(starts, String(index + 1), point);
    const localId = typeof raw.local_id === "string" ? raw.local_id.trim() : "";
    if (localId) addStart(starts, localId, point);
  });
  return starts;
}

function numericObjectId(localId: string): number | null {
  const normalized = localId.trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function needsObjectTemplate(localId: string): boolean {
  const normalized = localId.trim();
  if (ENGINE_LOCAL_IDS.has(normalized)) return false;
  if (normalized.startsWith("LOCALID_")) return true;
  const numeric = numericObjectId(normalized);
  return numeric !== null && numeric > 0 && numeric < 127;
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

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x === b.x && a.y === b.y;
}

/**
 * Audita fatos espaciais extraídos de scripts sem fingir interpretar o fluxo
 * completo do bytecode. Erros são reservados a fatos inequívocos; qualquer
 * geometria não resolvida vira warning para impedir falso Game-ready.
 */
export function auditScriptSpatialContracts(
  contracts: ScriptSpatialContracts,
  map: MapData,
  effectiveEvents: EditableMapJson,
): ScriptSpatialIssue[] {
  const issues: ScriptSpatialIssue[] = [];
  const starts = objectStarts(effectiveEvents);
  const anchorsByObject = new Map<string, ScriptObjectAnchor[]>();
  const missingLocalIds = new Set<string>();

  const reportMissingLocalId = (
    code: string,
    localId: string,
    line: number,
    message: string,
    point?: { x: number; y: number },
  ) => {
    if (missingLocalIds.has(localId)) return;
    missingLocalIds.add(localId);
    issues.push({
      code,
      severity: "error",
      message,
      ...(point ?? {}),
      localId,
      line,
    });
  };

  for (const anchor of contracts.anchors) {
    const values = anchorsByObject.get(anchor.localId) ?? [];
    values.push(anchor);
    anchorsByObject.set(anchor.localId, values);

    if (needsObjectTemplate(anchor.localId) && !starts.has(anchor.localId)) {
      reportMissingLocalId(
        "SCRIPT_OBJECT_LOCALID_MISSING",
        anchor.localId,
        anchor.line,
        `${anchor.command} referencia ${anchor.localId}, mas nenhum object_event efetivo possui esse local id (nominal ou índice + 1).`,
        { x: anchor.x, y: anchor.y },
      );
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
    const anchored = anchorsByObject.has(use.localId);
    if (needsObjectTemplate(use.localId) && !starts.has(use.localId) && !anchored) {
      reportMissingLocalId(
        "SCRIPT_MOVEMENT_LOCALID_MISSING",
        use.localId,
        use.line,
        `applymovement referencia ${use.localId}, mas nenhum object_event efetivo nem âncora setobjectxy/setobjectxyperm resolve esse local id.`,
      );
    }

    const movement = contracts.movements[use.movementLabel];
    if (!movement) {
      issues.push({
        code: "SCRIPT_MOVEMENT_DEFINITION_EXTERNAL",
        severity: "warning",
        message: `${use.movementLabel} usado por ${use.localId} não foi encontrado nas fontes espaciais carregadas; a trajetória não pode ser certificada.`,
        localId: use.localId,
        line: use.line,
      });
      continue;
    }

    if (!movement.deterministic) {
      issues.push({
        code: "SCRIPT_MOVEMENT_GEOMETRY_PARTIAL",
        severity: "warning",
        message: `${use.movementLabel} contém comandos espaciais que o simulador conservador não resolve por completo.`,
        localId: use.localId,
        line: use.line,
      });
      continue;
    }

    const candidates = [
      ...(starts.get(use.localId) ?? []),
      ...(anchorsByObject.get(use.localId) ?? []).map((anchor) => ({ x: anchor.x, y: anchor.y })),
    ].filter(
      (candidate, index, all) => all.findIndex((other) => samePoint(candidate, other)) === index,
    );

    if (!movement.steps.length) {
      // Facing/delay/emote/in-place: geometricamente neutro, logo não depende de
      // conhecermos a posição runtime do player/camera.
      issues.push({
        code: "SCRIPT_MOVEMENT_GEOMETRY_NEUTRAL",
        severity: "info",
        message: `${use.movementLabel} para ${use.localId} não desloca a célula lógica.`,
        localId: use.localId,
        line: use.line,
      });
      continue;
    }

    if (!candidates.length) {
      issues.push({
        code: "SCRIPT_MOVEMENT_START_UNVERIFIED",
        severity: "warning",
        message: `${use.movementLabel} move ${use.localId}, mas nenhuma posição inicial verificável está disponível no map.json/âncoras.`,
        localId: use.localId,
        line: use.line,
      });
      continue;
    }

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
