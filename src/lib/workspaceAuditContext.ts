import { parseEditableMapJson, type EditableMapJson } from "./eventMapJson";
import type { ImplementabilityWorkspaceContext } from "./gameImplementability";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";

let activeContext: ImplementabilityWorkspaceContext | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integerLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value : null;
}

/**
 * Retorna somente dependências diretas necessárias para verificar o mapa
 * atual: destinos de warps estáticos e mapas vizinhos das connections.
 */
export function referencedWorkspaceMapIds(document: EditableMapJson): string[] {
  const ids = new Set<string>();

  if (Array.isArray(document.warp_events)) {
    for (const raw of document.warp_events) {
      if (!isRecord(raw)) continue;
      const destMap = nonEmptyText(raw.dest_map);
      const destWarp = integerLike(raw.dest_warp_id);
      if (destMap && destWarp !== null && destWarp >= 0) ids.add(destMap);
    }
  }

  if (Array.isArray(document.connections)) {
    for (const raw of document.connections) {
      if (!isRecord(raw)) continue;
      const destMap = nonEmptyText(raw.map);
      if (destMap) ids.add(destMap);
    }
  }

  return [...ids].sort();
}

function workspaceMapById(workspace: AraunaWorkspace): Map<string, WorkspaceMap> {
  const byId = new Map<string, WorkspaceMap>();
  for (const map of workspace.maps) {
    if (!byId.has(map.id)) byId.set(map.id, map);
  }
  return byId;
}

function fileForMap(workspace: AraunaWorkspace, map: WorkspaceMap): File | undefined {
  return workspace.files.get(map.path) ?? workspace.filesLower.get(map.path.toLowerCase());
}

/**
 * Carrega map.json somente das dependências diretas. Nenhum mapa é aberto no
 * editor, nenhum evento é renumerado e nenhum map.bin vizinho é necessário.
 */
export async function buildWorkspaceAuditContext(
  workspace: AraunaWorkspace,
  currentDocument: EditableMapJson,
): Promise<ImplementabilityWorkspaceContext> {
  const sourceMapId = nonEmptyText(currentDocument.id);
  const maps: ImplementabilityWorkspaceContext["maps"] = {};
  const loadErrors: Record<string, string> = {};
  const byId = workspaceMapById(workspace);

  if (sourceMapId) maps[sourceMapId] = { mapJson: currentDocument };

  for (const id of referencedWorkspaceMapIds(currentDocument)) {
    const descriptor = byId.get(id);
    if (!descriptor) {
      loadErrors[id] = "mapa não encontrado no Workspace";
      continue;
    }
    if (descriptor.error) {
      loadErrors[id] = descriptor.error;
      continue;
    }
    const file = fileForMap(workspace, descriptor);
    if (!file) {
      loadErrors[id] = `arquivo ${descriptor.path} não encontrado`;
      continue;
    }
    try {
      maps[id] = { mapJson: parseEditableMapJson(await file.text()) };
    } catch (error) {
      loadErrors[id] = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    maps,
    sourceMapId,
    ...(Object.keys(loadErrors).length ? { loadErrors } : {}),
  };
}

export function setWorkspaceAuditContext(context: ImplementabilityWorkspaceContext | null) {
  activeContext = context;
}

export function clearWorkspaceAuditContext() {
  activeContext = null;
}

export function getWorkspaceAuditContext(): ImplementabilityWorkspaceContext | null {
  return activeContext;
}

/** Recalcula e instala o contexto usado pelo próximo deep audit. */
export async function refreshWorkspaceAuditContext(
  workspace: AraunaWorkspace | null | undefined,
  currentDocument: EditableMapJson | null | undefined,
): Promise<ImplementabilityWorkspaceContext | null> {
  if (!workspace || !currentDocument) {
    clearWorkspaceAuditContext();
    return null;
  }
  const context = await buildWorkspaceAuditContext(workspace, currentDocument);
  setWorkspaceAuditContext(context);
  return context;
}
