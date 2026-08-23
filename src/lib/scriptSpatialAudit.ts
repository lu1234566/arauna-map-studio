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

export interface ScriptDoorSpawnProof {
  localId: string;
  x: number;
  y: number;
  scriptLabel: string | null;
  openDoorLine: number;
  addObjectLine: number;
}

type Point = { x: number; y: number };

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

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function collisionAt(map: MapData, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return getPhysicalLayerValue(map.physical[idx(x, y, map.width)] ?? 0, "collision");
}

function addStart(starts: Map<string, Point[]>, key: string, point: Point) {
  const values = starts.get(key) ?? [];
  if (!values.some((value) => value.x === point.x && value.y === point.y)) values.push(point);
  starts.set(key, values);
}

function uniquePoints(points: Point[]): Point[] {
  return points.filter(
    (candidate, index, all) => all.findIndex((other) => samePoint(candidate, other)) === index,
  );
}

/**
 * tools/mapjson gera object_event com local id `index + 1`, mesmo quando o
 * map.json não possui um campo local_id textual. Por isso registramos sempre a
 * chave numérica e, quando existir, também o alias LOCALID_* explícito.
 */
function objectStarts(document: EditableMapJson) {
  const starts = new Map<string, Point[]>();
  if (!Array.isArray(document.object_events)) return starts;
  document.object_events.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const x = integer(raw.x);
    const y = integer(raw.y);
    if (x === null || y === null) return;
    const point = { x, y };
    addStart(starts, String(index + 1), point);
    const localId = text(raw.local_id);
    if (localId) addStart(starts, localId, point);
  });
  return starts;
}

/**
 * Posições do player que são demonstráveis sem interpretar o runtime inteiro:
 * - coord_event: o script dispara quando o player está exatamente em x/y;
 * - object_event: ao iniciar o script do NPC, o player está em uma célula
 *   cardinal adjacente e transitável ao objeto.
 *
 * Isso é genérico e evita hardcode de cenas como Scott/Stern.
 */
function playerStartsByScript(document: EditableMapJson, map: MapData) {
  const starts = new Map<string, Point[]>();

  if (Array.isArray(document.coord_events)) {
    for (const raw of document.coord_events) {
      if (!isRecord(raw)) continue;
      const script = text(raw.script);
      const x = integer(raw.x);
      const y = integer(raw.y);
      if (!script || x === null || y === null) continue;
      if (collisionAt(map, x, y) === 0) addStart(starts, script, { x, y });
    }
  }

  if (Array.isArray(document.object_events)) {
    for (const raw of document.object_events) {
      if (!isRecord(raw)) continue;
      const script = text(raw.script);
      const x = integer(raw.x);
      const y = integer(raw.y);
      if (!script || x === null || y === null) continue;
      for (const point of [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ]) {
        if (collisionAt(map, point.x, point.y) === 0) addStart(starts, script, point);
      }
    }
  }

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
  start: Point,
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

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function runtimeKey(scriptLabel: string | null, localId: string): string | null {
  return scriptLabel ? `${scriptLabel}\u0000${localId}` : null;
}

/**
 * Prova conservadora para o padrão vanilla `opendoor x,y` -> `addobject ID`.
 * A porta e o add precisam estar no mesmo bloco de script e a abertura precisa
 * ocorrer antes do objeto aparecer. A âncora setobjectxy pode ter sido definida
 * em outro bloco, como acontece com Scott em Slateport.
 */
export function findScriptDoorSpawnProof(
  contracts: ScriptSpatialContracts,
  localId: string,
  x: number,
  y: number,
): ScriptDoorSpawnProof | null {
  for (const add of contracts.objectAdds) {
    if (add.localId !== localId || !add.scriptLabel) continue;
    const door = contracts.doorOpenings.find(
      (candidate) =>
        candidate.scriptLabel === add.scriptLabel &&
        candidate.line < add.line &&
        candidate.x === x &&
        candidate.y === y,
    );
    if (!door) continue;
    return {
      localId,
      x,
      y,
      scriptLabel: add.scriptLabel,
      openDoorLine: door.line,
      addObjectLine: add.line,
    };
  }
  return null;
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
  const playerScriptStarts = playerStartsByScript(effectiveEvents, map);
  const anchorsByObject = new Map<string, ScriptObjectAnchor[]>();
  const runtimeStarts = new Map<string, Point[]>();
  const missingLocalIds = new Set<string>();

  const reportMissingLocalId = (
    code: string,
    localId: string,
    line: number,
    message: string,
    point?: Point,
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
      const doorProof = findScriptDoorSpawnProof(
        contracts,
        anchor.localId,
        anchor.x,
        anchor.y,
      );
      if (doorProof) {
        issues.push({
          code: "SCRIPT_OBJECT_ANCHOR_DOOR_OK",
          severity: "info",
          message:
            `${anchor.command} mantém ${anchor.localId} em (${anchor.x},${anchor.y}) sobre collision=${collision}, ` +
            `mas ${doorProof.scriptLabel} executa opendoor nessas coordenadas antes de addobject; spawn runtime compatível com porta animada.`,
          x: anchor.x,
          y: anchor.y,
          localId: anchor.localId,
          line: anchor.line,
        });
      } else {
        issues.push({
          code: "SCRIPT_OBJECT_ANCHOR_BLOCKED",
          severity: "warning",
          message: `${anchor.command} posiciona ${anchor.localId} em (${anchor.x},${anchor.y}) com collision=${collision}; revise a cutscene/estado futuro antes de exportar.`,
          x: anchor.x,
          y: anchor.y,
          localId: anchor.localId,
          line: anchor.line,
        });
      }
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

    const key = runtimeKey(use.scriptLabel, use.localId);
    const hasRuntime = key ? runtimeStarts.has(key) : false;
    const candidates = uniquePoints(
      hasRuntime && key
        ? (runtimeStarts.get(key) ?? [])
        : [
            ...(use.localId === "LOCALID_PLAYER" && use.scriptLabel
              ? (playerScriptStarts.get(use.scriptLabel) ?? [])
              : []),
            ...(starts.get(use.localId) ?? []),
            ...(anchorsByObject.get(use.localId) ?? []).map((anchor) => ({
              x: anchor.x,
              y: anchor.y,
            })),
          ],
    );

    if (!movement.steps.length) {
      // Facing/delay/emote/in-place: geometricamente neutro, logo não depende de
      // conhecermos a posição runtime do player/camera. Quando conhecemos, a
      // posição é propagada para o próximo applymovement do mesmo script.
      if (key && !hasRuntime && candidates.length) runtimeStarts.set(key, candidates);
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
      if (key) runtimeStarts.set(key, []);
      issues.push({
        code: "SCRIPT_MOVEMENT_START_UNVERIFIED",
        severity: "warning",
        message: `${use.movementLabel} move ${use.localId}, mas nenhuma posição inicial verificável está disponível no map.json/âncoras/trigger de origem.`,
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
      if (key) runtimeStarts.set(key, []);
      issues.push({
        code: "SCRIPT_MOVEMENT_NO_KNOWN_SAFE_PATH",
        severity: "warning",
        message: `${use.movementLabel} para ${use.localId} não encontrou caminho livre a partir de nenhuma posição conhecida (${simulations.map((entry) => `${entry.candidate.x},${entry.candidate.y}: ${entry.result.reason}`).join("; ")}). O fluxo runtime pode ter movimentos prévios não modelados, então isso exige revisão e não é tratado como erro de engine.`,
        localId: use.localId,
        line: use.line,
      });
    } else {
      if (key) {
        runtimeStarts.set(
          key,
          uniquePoints(valid.map((entry) => ({ x: entry.result.x, y: entry.result.y }))),
        );
      }
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
