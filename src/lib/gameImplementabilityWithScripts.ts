import { importedSharedEventsSnapshot } from "./bundleDependencyContext";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
  ImplementabilityIssue,
} from "./gameImplementability";
import { auditScriptSpatialContracts } from "./scriptSpatialAudit";
import {
  getScriptSpatialContext,
  type ScriptSpatialContext,
  type ScriptWarpDestinationContext,
} from "./scriptSpatialContext";
import type { ScriptWarpUse } from "./scriptSpatialContracts";
import {
  getWorkspaceAuditContext,
  sharedEventsContextKey,
} from "./workspaceAuditContext";

const SYMBOLIC_WARP_IDS: Record<string, number> = {
  WARP_ID_NONE: -1,
  WARP_ID_SECRET_BASE: 0x7e,
  WARP_ID_DYNAMIC: 0x7f,
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function integerLike(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  if (/^0x[0-9a-f]+$/i.test(normalized)) return Number.parseInt(normalized.slice(2), 16);
  return SYMBOLIC_WARP_IDS[normalized] ?? null;
}

function categoryFor(code: string): ImplementabilityCategory {
  if (code.startsWith("SCRIPT_WARP_")) return "warps";
  return code.startsWith("SCRIPT_MOVEMENT_") ? "accessibility" : "npcs";
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
  const fullyVerified =
    base.fullyVerified &&
    additions.every((found) => found.severity === "info");

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

function diagnostic(
  code: string,
  severity: "error" | "warning" | "info",
  category: ImplementabilityCategory,
  message: string,
): ImplementabilityIssue {
  return { code, severity, category, message };
}

function warpIssue(
  warp: ScriptWarpUse,
  code: string,
  severity: "error" | "warning" | "info",
  message: string,
): ImplementabilityIssue {
  return {
    code,
    severity,
    category: "warps",
    message: `${warp.command} ${warp.destMap}: ${message}`,
  };
}

function destinationWarpCount(destination: ScriptWarpDestinationContext): number | null {
  const events = destination.effectiveEvents;
  if (!events) return null;
  return Array.isArray(events.warp_events) ? events.warp_events.length : 0;
}

function auditWarpId(
  warp: ScriptWarpUse,
  destination: ScriptWarpDestinationContext,
  rawWarpId: string,
): ImplementabilityIssue {
  const warpId = integerLike(rawWarpId);
  if (warpId === null) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_ID_SYMBOLIC_UNVERIFIED",
      "warning",
      `warp id ${rawWarpId} não pôde ser resolvido estaticamente.`,
    );
  }
  if (warpId === -1) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_CENTER_DESTINATION_OK",
      "info",
      "WARP_ID_NONE delega a posição ao comportamento padrão/coords do comando.",
    );
  }
  if (warpId === 0x7e || warpId === 0x7f) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_SPECIAL_ID_UNVERIFIED",
      "warning",
      `warp id especial 0x${warpId.toString(16)} depende de estado runtime.`,
    );
  }
  if (warpId < 0) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_ID_INVALID",
      "error",
      `warp id ${warpId} é inválido.`,
    );
  }

  const count = destinationWarpCount(destination);
  if (count === null) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_DEST_EVENTS_UNVERIFIED",
      "warning",
      `eventos efetivos do destino não estão disponíveis para conferir warp id ${warpId}.`,
    );
  }
  if (warpId >= count) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_DEST_ID_OUT_OF_RANGE",
      "error",
      `warp id ${warpId} não existe no destino (${count} warp_event(s), índices 0..${Math.max(0, count - 1)}).`,
    );
  }
  return warpIssue(
    warp,
    "SCRIPT_WARP_DEST_ID_OK",
    "info",
    `warp id ${warpId} existe entre os ${count} warp_event(s) efetivos do destino.`,
  );
}

function auditWarpCoordinates(
  warp: ScriptWarpUse,
  destination: ScriptWarpDestinationContext,
  rawX: string,
  rawY: string,
): ImplementabilityIssue {
  const x = integerLike(rawX);
  const y = integerLike(rawY);
  if (x === null || y === null) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_COORDS_SYMBOLIC_UNVERIFIED",
      "warning",
      `coordenadas (${rawX},${rawY}) dependem de símbolo/estado não resolvido estaticamente.`,
    );
  }
  if (x === -1 && y === -1) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_CENTER_DESTINATION_OK",
      "info",
      "coordenadas dummy (-1,-1) usam a posição padrão do engine.",
    );
  }
  if (destination.width === undefined || destination.height === undefined) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_DEST_DIMENSIONS_UNVERIFIED",
      "warning",
      `layout do destino não possui dimensões certificadas para conferir (${x},${y}).`,
    );
  }
  if (x < 0 || y < 0 || x >= destination.width || y >= destination.height) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_DEST_COORDS_OUT_OF_BOUNDS",
      "error",
      `coordenadas (${x},${y}) ficam fora do layout ${destination.width}×${destination.height}.`,
    );
  }
  return warpIssue(
    warp,
    "SCRIPT_WARP_DEST_COORDS_OK",
    "info",
    `coordenadas (${x},${y}) ficam dentro do layout ${destination.width}×${destination.height}.`,
  );
}

function auditConcreteWarpTarget(
  warp: ScriptWarpUse,
  destination: ScriptWarpDestinationContext,
): ImplementabilityIssue {
  if (warp.command === "setholewarp") {
    return warpIssue(
      warp,
      "SCRIPT_WARP_HOLE_MAP_OK",
      "info",
      "mapa de queda existe; warphole determina a posição final em runtime.",
    );
  }

  if (warp.command === "warphole") {
    return warpIssue(
      warp,
      "SCRIPT_WARP_HOLE_COORDS_RUNTIME",
      "warning",
      "warphole preserva a posição corrente do jogador; o ponto final depende do estado runtime e exige revisão.",
    );
  }

  const args = warp.args;
  if (args.length === 0) {
    return warpIssue(
      warp,
      "SCRIPT_WARP_DEFAULT_DESTINATION_OK",
      "info",
      "destino existe e o comando usa a posição padrão do engine.",
    );
  }
  if (args.length === 1) return auditWarpId(warp, destination, args[0] ?? "");
  if (args.length === 2) {
    return auditWarpCoordinates(warp, destination, args[0] ?? "", args[1] ?? "");
  }

  const warpId = integerLike(args[0]);
  if (warpId !== null && warpId !== -1) return auditWarpId(warp, destination, args[0] ?? "");
  return auditWarpCoordinates(warp, destination, args[1] ?? "", args[2] ?? "");
}

function auditScriptWarps(
  context: ScriptSpatialContext,
): ImplementabilityIssue[] {
  const contracts = context.contracts;
  if (!contracts?.scriptWarps.length) return [];
  const issues: ImplementabilityIssue[] = [];

  for (const warp of contracts.scriptWarps) {
    if (warp.destMap === "MAP_DYNAMIC" || warp.destMap === "MAP_UNDEFINED") {
      issues.push(warpIssue(
        warp,
        "SCRIPT_WARP_DYNAMIC_TARGET",
        "warning",
        "destino é resolvido por estado runtime/setter anterior; o fluxo completo não é interpretado pelo auditor conservador.",
      ));
      continue;
    }
    if (!warp.destMap.startsWith("MAP_")) {
      issues.push(warpIssue(
        warp,
        "SCRIPT_WARP_MAP_SYMBOL_UNVERIFIED",
        "warning",
        "destino não é um MAP_* literal e não pode ser certificado sem executar o script.",
      ));
      continue;
    }

    const destination = context.warpDestinations[warp.destMap];
    if (!destination) {
      issues.push(warpIssue(
        warp,
        "SCRIPT_WARP_DEST_UNVERIFIED",
        "warning",
        context.origin === "bundle"
          ? "Cidade JSON standalone não embute este mapa externo; abra o Workspace para certificar o destino."
          : "destino não foi carregado durante a auditoria do Workspace.",
      ));
      continue;
    }
    if (destination.error) {
      issues.push(warpIssue(
        warp,
        "SCRIPT_WARP_DEST_LOAD_FAILED",
        "error",
        destination.error,
      ));
      continue;
    }

    issues.push(auditConcreteWarpTarget(warp, destination));
  }

  return issues;
}

/**
 * Acrescenta ao relatório profundo os contratos espaciais declarados em
 * scripts.inc + movement.inc. Game-ready só permanece verde quando o contexto
 * pertence à MESMA instância de map.json e toda geometria relevante é resolvida
 * ou explicitamente classificada como neutra.
 */
export function withActiveScriptSpatialAudit(
  base: GameImplementabilityReport,
  map: MapData,
  mapJson: EditableMapJson | null,
): GameImplementabilityReport {
  if (!mapJson) return base;

  const mapId = text(mapJson.id);
  const context = getScriptSpatialContext();
  if (!context || !mapId) {
    return appendIssues(base, [
      diagnostic(
        "SCRIPT_SPATIAL_UNVERIFIED",
        "warning",
        "accessibility",
        "scripts.inc não foi carregado para este mapa; posições runtime, trajetórias de cutscene e warps de script ainda não podem ser certificados.",
      ),
    ]);
  }

  if (context.sourceMapId !== mapId || context.sourceDocument !== mapJson) {
    return appendIssues(base, [
      diagnostic(
        "SCRIPT_SPATIAL_CONTEXT_STALE",
        "warning",
        "accessibility",
        "O contexto de scripts pertence a outra versão/mapa. Rode Validar novamente antes de considerar o mapa Game-ready.",
      ),
    ]);
  }

  if (!context.contracts || context.error) {
    return appendIssues(base, [
      diagnostic(
        "SCRIPT_SPATIAL_LOAD_FAILED",
        "warning",
        "accessibility",
        `Não foi possível certificar ${context.sourcePath || "scripts.inc"}: ${context.error ?? "contratos espaciais indisponíveis"}.`,
      ),
    ]);
  }

  let effectiveEvents = mapJson;
  const sharedEventsName = text(mapJson.shared_events_map);
  if (sharedEventsName) {
    const workspace = getWorkspaceAuditContext();
    const workspaceShared = workspace?.maps[sharedEventsContextKey(sharedEventsName)]?.mapJson ?? null;
    const bundledShared = importedSharedEventsSnapshot(mapJson, sharedEventsName)?.mapJson ?? null;
    const shared = workspaceShared ?? bundledShared;
    if (!shared) {
      return appendIssues(base, [
        diagnostic(
          "SCRIPT_SPATIAL_EFFECTIVE_EVENTS_UNVERIFIED",
          "warning",
          "npcs",
          `scripts foram carregados, mas shared_events_map=${sharedEventsName} não está disponível no Workspace nem no bundle importado; LOCALID e posições runtime não podem ser cruzados com os object_events efetivos.`,
        ),
      ]);
    }
    effectiveEvents = shared;
  }

  const spatial = auditScriptSpatialContracts(context.contracts, map, effectiveEvents);
  const additions: ImplementabilityIssue[] = [
    diagnostic(
      "SCRIPT_SPATIAL_SOURCE_OK",
      "info",
      "accessibility",
      `Contratos espaciais carregados de ${context.sourcePath}${context.scriptMapName !== mapJson.name ? ` (${context.scriptMapName})` : ""}.`,
    ),
    ...spatial.map((found) => ({
      code: found.code,
      severity: found.severity,
      category: categoryFor(found.code),
      message: `${found.message}${found.line ? ` [${context.sourcePath}:${found.line}]` : ""}`,
      ...(found.x !== undefined ? { x: found.x } : {}),
      ...(found.y !== undefined ? { y: found.y } : {}),
    } satisfies ImplementabilityIssue)),
    ...auditScriptWarps(context),
  ];

  return appendIssues(base, additions);
}
