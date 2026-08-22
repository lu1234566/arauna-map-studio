import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
  ImplementabilityIssue,
} from "./gameImplementability";
import { auditScriptSpatialContracts } from "./scriptSpatialAudit";
import { getScriptSpatialContext } from "./scriptSpatialContext";
import {
  getWorkspaceAuditContext,
  sharedEventsContextKey,
} from "./workspaceAuditContext";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function categoryFor(code: string): ImplementabilityCategory {
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
    counts[found.severity]++;
    categories[found.category][found.severity]++;
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

/**
 * Acrescenta ao relatório profundo os contratos espaciais declarados em
 * scripts.inc. Essa camada é propositalmente separada do auditor puro para que
 * testes unitários/self-contained continuem determinísticos sem depender de um
 * File System Workspace do browser.
 *
 * No produto, entretanto, Game-ready só permanece verde quando o scripts.inc
 * efetivo da MESMA instância de map.json em memória foi carregado e auditado.
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
        "scripts.inc não foi carregado para este mapa; posições runtime e trajetórias de cutscene ainda não podem ser certificadas.",
      ),
    ]);
  }

  if (context.sourceMapId !== mapId || context.sourceDocument !== mapJson) {
    return appendIssues(base, [
      diagnostic(
        "SCRIPT_SPATIAL_CONTEXT_STALE",
        "warning",
        "accessibility",
        "O contexto de scripts.inc pertence a outra versão/mapa. Rode Validar novamente antes de considerar o mapa Game-ready.",
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
    const shared = workspace?.maps[sharedEventsContextKey(sharedEventsName)]?.mapJson ?? null;
    if (!shared) {
      return appendIssues(base, [
        diagnostic(
          "SCRIPT_SPATIAL_EFFECTIVE_EVENTS_UNVERIFIED",
          "warning",
          "npcs",
          `scripts.inc foi carregado, mas shared_events_map=${sharedEventsName} não está disponível; LOCALID e posições runtime não podem ser cruzados com os object_events efetivos.`,
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
  ];

  return appendIssues(base, additions);
}
