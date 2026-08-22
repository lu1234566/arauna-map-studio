export type ScriptAnchorCommand = "setobjectxy" | "setobjectxyperm";
export type ScriptWarpCommand =
  | "warp"
  | "warpsilent"
  | "warpdoor"
  | "warphole"
  | "warpteleport"
  | "setwarp"
  | "setdynamicwarp"
  | "setdivewarp"
  | "setholewarp";

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

export interface ScriptWarpUse {
  command: ScriptWarpCommand;
  destMap: string;
  /** Argumentos após o mapa, preservados sem adivinhar símbolos/variáveis. */
  args: string[];
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
  scriptWarps: ScriptWarpUse[];
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
  if (!normalized || normalized.includes("_in_place")) return null;

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

  const vector =
    direction === "up"
      ? { dx: 0, dy: -1 }
      : direction === "down"
        ? { dx: 0, dy: 1 }
        : direction === "left"
          ? { dx: -1, dy: 0 }
          : { dx: 1, dy: 0 };
  return { token, dx: vector.dx, dy: vector.dy, distance };
}

function neutralMovementToken(token: string): boolean {
  const normalized = token.toLowerCase();
  return (
    normalized.includes("_in_place") || /^(face|delay|emote|lock|unlock|hide|show)/.test(normalized)
  );
}

function splitArguments(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Extrai fatos espaciais declarativos de scripts.inc e fontes comuns de
 * movimento. Não tenta interpretar todo o bytecode/event language; isso mantém
 * o parser auditável e fail-closed quando o fluxo depende de estado runtime.
 *
 * Cobertura intencional:
 * - `setobjectxy` / `setobjectxyperm`: posições futuras de NPCs;
 * - `applymovement`: uso de sequências de movimento;
 * - labels de movimento terminados em `step_end`;
 * - warps e setters de warp declarados diretamente em script.
 */
export function parseScriptSpatialContracts(source: string): ScriptSpatialContracts {
  const lines = source.replace(/\r/g, "").split("\n");
  const anchors: ScriptObjectAnchor[] = [];
  const movementUses: ScriptMovementUse[] = [];
  const scriptWarps: ScriptWarpUse[] = [];
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

    const anchor = line.match(
      /^(setobjectxyperm|setobjectxy)\s+([^,]+),\s*([^,]+),\s*([^,\s]+)\s*$/i,
    );
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

    const warpUse = line.match(
      /^(warp|warpsilent|warpdoor|warphole|warpteleport|setwarp|setdynamicwarp|setdivewarp|setholewarp)\s+([^,\s]+)(?:\s*,\s*(.*))?$/i,
    );
    if (warpUse) {
      scriptWarps.push({
        command: (warpUse[1]?.toLowerCase() ?? "warp") as ScriptWarpCommand,
        destMap: (warpUse[2] ?? "").trim(),
        args: splitArguments(warpUse[3]),
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
      if (/^(walk|run|jump|slide|step|face|delay|lock|unlock|hide|show|emote)/i.test(token)) {
        sawMovementLikeToken = true;
        // Facing, delays, emotes, visibility e animações in-place não mudam a
        // célula lógica. Qualquer outro token espacial desconhecido rebaixa a
        // sequência para não determinística em vez de inventar deslocamento.
        if (!neutralMovementToken(token)) deterministic = false;
      }
    }

    if (sawMovementLikeToken) {
      movements[label] = { label, line: block.line, steps, deterministic };
    }
  }

  return { anchors, movementUses, scriptWarps, movements };
}

export function referencedScriptWarpMapIds(contracts: ScriptSpatialContracts): string[] {
  const ids = new Set<string>();
  for (const warp of contracts.scriptWarps) {
    if (
      warp.destMap.startsWith("MAP_") &&
      warp.destMap !== "MAP_DYNAMIC" &&
      warp.destMap !== "MAP_UNDEFINED"
    ) {
      ids.add(warp.destMap);
    }
  }
  return [...ids].sort();
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
