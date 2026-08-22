import { parseEditableMapJson, type EditableMapJson } from "./eventMapJson";
import type { GameImplementabilityReport, ImplementabilityIssue } from "./gameImplementability";
import {
  normalizeWorkspacePath,
  type AraunaWorkspace,
  type WorkspaceMap,
} from "./repoWorkspace";

export interface SourceSymbolReference {
  symbol: string;
  field: string;
  location: string;
}

export interface WorkspaceSymbolAuditContext {
  sourceDocument: EditableMapJson;
  references: SourceSymbolReference[];
  definitions: Record<string, string | undefined>;
  loadErrors: string[];
}

let activeContext: WorkspaceSymbolAuditContext | null = null;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function literal(value: string): boolean {
  return /^-?\d+$/.test(value) || /^0x[0-9a-f]+$/i.test(value);
}

function addReference(
  refs: Map<string, SourceSymbolReference>,
  value: unknown,
  field: string,
  location: string,
) {
  const symbol = text(value);
  if (!symbol || literal(symbol)) return;
  // MAP_* destinations are checked by warp/connection dependency auditors.
  // LOCALID_* is checked against effective object_events, not source headers.
  if (symbol.startsWith("MAP_") || symbol.startsWith("LOCALID_")) return;
  const key = `${field}|${symbol}`;
  if (!refs.has(key)) refs.set(key, { symbol, field, location });
}

function workspaceMapByName(workspace: AraunaWorkspace, name: string): WorkspaceMap | undefined {
  return workspace.maps.find((map) => map.name === name || map.directory === name);
}

function fileForPath(workspace: AraunaWorkspace, path: string): File | undefined {
  return workspace.files.get(path) ?? workspace.filesLower.get(path.toLowerCase());
}

async function effectiveEventsDocument(
  workspace: AraunaWorkspace,
  document: EditableMapJson,
): Promise<EditableMapJson> {
  const sharedName = text(document.shared_events_map);
  if (!sharedName) return document;
  const descriptor = workspaceMapByName(workspace, sharedName);
  if (!descriptor) throw new Error(`shared_events_map ${sharedName} não encontrado no Workspace`);
  const file = fileForPath(workspace, descriptor.path);
  if (!file) throw new Error(`arquivo ${descriptor.path} não encontrado`);
  return parseEditableMapJson(await file.text());
}

export async function collectMapSourceSymbolReferences(
  workspace: AraunaWorkspace,
  document: EditableMapJson,
): Promise<SourceSymbolReference[]> {
  const refs = new Map<string, SourceSymbolReference>();

  for (const field of [
    "music",
    "region_map_section",
    "weather",
    "map_type",
    "battle_scene",
  ] as const) {
    addReference(refs, document[field], field, `map.${field}`);
  }

  const events = await effectiveEventsDocument(workspace, document);
  const objects = Array.isArray(events.object_events) ? events.object_events : [];
  objects.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    for (const field of [
      "graphics_id",
      "movement_type",
      "trainer_type",
      "trainer_sight_or_berry_tree_id",
      "script",
      "flag",
    ] as const) {
      addReference(refs, raw[field], field, `object_events[${index}].${field}`);
    }
  });

  const coords = Array.isArray(events.coord_events) ? events.coord_events : [];
  coords.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    for (const field of ["var", "script", "weather"] as const) {
      addReference(refs, raw[field], field, `coord_events[${index}].${field}`);
    }
  });

  const bgs = Array.isArray(events.bg_events) ? events.bg_events : [];
  bgs.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    for (const field of [
      "player_facing_dir",
      "script",
      "item",
      "flag",
      "secret_base_id",
    ] as const) {
      addReference(refs, raw[field], field, `bg_events[${index}].${field}`);
    }
  });

  return [...refs.values()].sort(
    (a, b) => a.symbol.localeCompare(b.symbol) || a.field.localeCompare(b.field),
  );
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function definesSymbol(source: string, symbol: string, path: string): boolean {
  const escaped = regexEscape(symbol);
  if (path.endsWith(".h")) {
    return (
      new RegExp(`^\\s*#define\\s+${escaped}(?:\\s|$)`, "m").test(source) ||
      new RegExp(`^\\s*${escaped}\\s*(?:=|,)`, "m").test(source)
    );
  }
  return new RegExp(`^\\s*${escaped}(?:::|:)\\s*(?:@.*)?$`, "m").test(source);
}

function candidateSourcePaths(workspace: AraunaWorkspace): string[] {
  return [...workspace.files.keys()].filter((path) => {
    // Também canonicalizamos aqui para Workspaces já abertos antes da correção
    // de normalizeWorkspacePath (ex.: repo/include/constants/flags.h).
    const lower = normalizeWorkspacePath(path).toLowerCase();
    if (lower.startsWith("include/") && lower.endsWith(".h")) return true;
    if (lower.startsWith("data/") && (lower.endsWith(".inc") || lower.endsWith(".s"))) return true;
    return false;
  });
}

export async function buildWorkspaceSymbolAuditContext(
  workspace: AraunaWorkspace,
  document: EditableMapJson,
): Promise<WorkspaceSymbolAuditContext> {
  const references = await collectMapSourceSymbolReferences(workspace, document);
  const definitions: Record<string, string | undefined> = {};
  const loadErrors: string[] = [];
  const unresolved = new Set(references.map((ref) => ref.symbol));

  for (const path of candidateSourcePaths(workspace)) {
    if (!unresolved.size) break;
    const file = fileForPath(workspace, path);
    if (!file) continue;
    let source: string;
    try {
      source = await file.text();
    } catch (error) {
      loadErrors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const symbol of [...unresolved]) {
      if (!definesSymbol(source, symbol, path)) continue;
      definitions[symbol] = normalizeWorkspacePath(path);
      unresolved.delete(symbol);
    }
  }

  return { sourceDocument: document, references, definitions, loadErrors };
}

export async function refreshWorkspaceSymbolAuditContext(
  workspace: AraunaWorkspace | null | undefined,
  document: EditableMapJson | null | undefined,
): Promise<WorkspaceSymbolAuditContext | null> {
  if (!workspace || !document) {
    activeContext = null;
    return null;
  }
  activeContext = await buildWorkspaceSymbolAuditContext(workspace, document);
  return activeContext;
}

export function getWorkspaceSymbolAuditContext(): WorkspaceSymbolAuditContext | null {
  return activeContext;
}

export function clearWorkspaceSymbolAuditContext() {
  activeContext = null;
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
 * Prova que símbolos usados pelo map.json existem nas fontes do Workspace.
 * Sem Workspace a auditoria não inventa existência e rebaixa Game-ready.
 */
export function withWorkspaceSymbolReferenceAudit(
  base: GameImplementabilityReport,
  document: EditableMapJson | null,
): GameImplementabilityReport {
  if (!document) return base;
  const context = activeContext;
  if (!context || context.sourceDocument !== document) {
    return appendIssues(base, [
      {
        code: "SOURCE_SYMBOLS_UNVERIFIED",
        severity: "warning",
        category: "mapJson",
        message:
          "Referências de script/flags/vars/gráficos/constants não foram conferidas contra as fontes do Workspace.",
      },
    ]);
  }

  const additions: ImplementabilityIssue[] = [];
  for (const ref of context.references) {
    const path = context.definitions[ref.symbol];
    if (!path) {
      additions.push({
        code: "SOURCE_SYMBOL_NOT_FOUND",
        severity: "error",
        category: "mapJson",
        message: `${ref.location} referencia ${ref.symbol}, mas nenhuma definição foi encontrada em include/**/*.h ou data/**/*.{inc,s}.`,
      });
    }
  }
  if (context.loadErrors.length) {
    additions.push({
      code: "SOURCE_SYMBOL_INDEX_PARTIAL",
      severity: "warning",
      category: "mapJson",
      message: `${context.loadErrors.length} arquivo(s) de símbolos não puderam ser lidos; a prova de referências ficou parcial.`,
    });
  }
  if (!additions.some((found) => found.severity !== "info")) {
    additions.push({
      code: "SOURCE_SYMBOLS_OK",
      severity: "info",
      category: "mapJson",
      message: `${context.references.length} referência(s) simbólica(s) do mapa foram encontradas nas fontes do Workspace.`,
    });
  }
  return appendIssues(base, additions);
}
