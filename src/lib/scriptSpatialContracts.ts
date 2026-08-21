export type ScriptAnchorCommand = "setobjectxy" | "setobjectxyperm";

export interface ScriptObjectAnchor {
  command: ScriptAnchorCommand;
  localId: string;
  x: number;
  y: number;
  scriptLabel: string | null;
  line: number;
}

export interface ScriptMovementUse {
  localId: string;
  movementLabel: string;
  scriptLabel: string | null;
  line: number;
}

export interface MovementStep {
  token: string;
  dx: number;
  dy: number;
  distance: number;
}

export interface ScriptMovementDefinition {
  label: string;
  line: number;
  steps: MovementStep[];
  /** false quando encontramos tokens de movimento que não sabemos simular. */
  deterministic: boolean;
}

export interface ScriptSpatialContracts {
  anchors: ScriptObjectAnchor[];
  movementUses: ScriptMovementUse[];
  movements: Record<string, ScriptMovementDefinition>;
}

function stripComment(line: string): string {
  const at = line.indexOf("@");
  return (at >= 0 ? line.slice(0, at) : line).trim();
}

function labelFromLine(line: string): string | null {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:::|:)$/);
  return match?.[1] ?? null;
}

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return Number.parseInt(trimmed.slice(2), 16);
  return null;
}

function movementStep(token: string): MovementStep | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized || normalized.includes("in_place")) return null;

  const direction = normalized.match(/(?:^|_)(up|down|left|right)$/)?.[1];
  if (!direction) return null;

  // Macros `jump_2_*` percorrem duas células; walk/run/slide/jump comuns
  // deslocam uma célula lógica. A animação/velocidade não altera a geometria.
  const distance = normalized.startsWith("jump_2_") ? 2 : 1;
  const supported =
    normalized.startsWith("walk_") ||
    normalized.startsWith("run_") ||
    normalized.startsWith("jump_") ||
    normalized.startsWith("slide_");
  if (!supported) return null;

  const vector = direction === "up"
    ? { dx: 0, dy: -1 }
    : direction === "down"
      ? { dx: 0, dy: 1 }
      : direction === "left"
        ? { dx: -1, dy: 0 }
        : { dx: 1, dy: 0 };
  return { token, dx: vector.dx, dy: vector.dy, distance };
}

/**
 * Extrai apenas fatos espaciais declarativos de scripts.inc. Não tenta
 * interpretar todo o bytecode/event language; isso mantém o parser auditável.
 *
 * Cobertura intencional:
 * - `setobjectxy` / `setobjectxyperm`: posições futuras de NPCs;
 * - `applymovement`: uso de sequências de movimento;
 * - labels de movimento locais terminados em `step_end`.
 */
export function parseScriptSpatialContracts(source: string): ScriptSpatialContracts {
  const lines = source.replace(/\r/g, "").split("\n");
  const anchors: ScriptObjectAnchor[] = [];
  const movementUses: ScriptMovementUse[] = [];
  const blocks = new Map<string, { line: number; tokens: string[] }>();
  let currentLabel: string | null = null;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripComment(rawLine);
    if (!line) return;

    const label = labelFromLine(line);
    if (label) {
      currentLabel = label;
      if (!blocks.has(label)) blocks.set(label, { line: lineNumber, tokens: [] });
      return;
    }

    const anchor = line.match(/^(setobjectxyperm|setobjectxy)\s+([^,]+),\s*([^,]+),\s*([^,\s]+)\s*$/i);
    if (anchor) {
      const x = parseInteger(anchor[3] ?? "");
      const y = parseInteger(anchor[4] ?? "");
      if (x !== null && y !== null) {
        anchors.push({
          command: (anchor[1]?.toLowerCase() ?? "setobjectxy") as ScriptAnchorCommand,
          localId: (anchor[2] ?? "").trim(),
          x,
          y,
          scriptLabel: currentLabel,
          line: lineNumber,
        });
      }
    }

    const movementUse = line.match(/^applymovement\s+([^,]+),\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
    if (movementUse) {
      movementUses.push({
        localId: (movementUse[1] ?? "").trim(),
        movementLabel: movementUse[2] ?? "",
        scriptLabel: currentLabel,
        line: lineNumber,
      });
    }

    if (currentLabel) blocks.get(currentLabel)?.tokens.push(line);
  });

  const movements: Record<string, ScriptMovementDefinition> = {};
  for (const [label, block] of blocks) {
    const stepEnd = block.tokens.findIndex((token) => /^step_end\b/i.test(token));
    if (stepEnd < 0) continue;
    const tokens = block.tokens.slice(0, stepEnd);
    const steps: MovementStep[] = [];
    let sawMovementLikeToken = false;
    let deterministic = true;

    for (const tokenLine of tokens) {
      const token = tokenLine.split(/\s+/)[0] ?? "";
      if (!token) continue;
      const parsed = movementStep(token);
      if (parsed) {
        sawMovementLikeToken = true;
        steps.push(parsed);
        continue;
      }
      if (
        /^(walk|run|jump|slide|step|face|delay|lock|unlock|hide|show|emote|walk_in_place)/i.test(token)
      ) {
        sawMovementLikeToken = true;
        // Face/delay/in-place são geometricamente neutros; outros tokens `step*`
        // desconhecidos tornam a simulação não determinística.
        if (!/^(face|delay|walk_in_place)/i.test(token)) deterministic = false;
      }
    }

    if (sawMovementLikeToken) {
      movements[label] = { label, line: block.line, steps, deterministic };
    }
  }

  return { anchors, movementUses, movements };
}

export function uniqueScriptAnchorCells(contracts: ScriptSpatialContracts) {
  const seen = new Map<string, { x: number; y: number; reasons: string[] }>();
  for (const anchor of contracts.anchors) {
    const key = `${anchor.x},${anchor.y}`;
    const reason = `${anchor.command} ${anchor.localId}${anchor.scriptLabel ? ` em ${anchor.scriptLabel}` : ""}`;
    const current = seen.get(key);
    if (current) current.reasons.push(reason);
    else seen.set(key, { x: anchor.x, y: anchor.y, reasons: [reason] });
  }
  return [...seen.values()];
}
