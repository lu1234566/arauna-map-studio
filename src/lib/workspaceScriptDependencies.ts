import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace } from "./repoWorkspace";
import {
  buildWorkspaceAuditContext,
  clearWorkspaceAuditContext,
  setWorkspaceAuditContext,
  type ImplementabilityWorkspaceContext,
} from "./workspaceAuditContext";

/**
 * Reusa o carregador profundo existente sem transformar dependências de script
 * em conexões reais do mapa. O documento sintético serve apenas para fazer o
 * planner carregar os MAP_* extras; antes de instalar o contexto restauramos a
 * MESMA instância de map.json do editor, preservando o guard anti-stale.
 */
export async function refreshWorkspaceAuditContextWithScriptMaps(
  workspace: AraunaWorkspace | null | undefined,
  document: EditableMapJson | null | undefined,
  mapIds: Iterable<string>,
): Promise<ImplementabilityWorkspaceContext | null> {
  if (!workspace || !document) {
    clearWorkspaceAuditContext();
    return null;
  }

  const unique = [...new Set([...mapIds].filter((id) => id.startsWith("MAP_")))].sort();
  const existingConnections = Array.isArray(document.connections)
    ? document.connections
    : [];
  const synthetic: EditableMapJson = {
    ...document,
    connections: [
      ...existingConnections,
      ...unique.map((map) => ({ map, offset: 0, direction: "up" })),
    ],
  };

  const context = await buildWorkspaceAuditContext(workspace, synthetic);
  const sourceMapId = typeof document.id === "string" ? document.id.trim() : "";
  if (sourceMapId && context.maps[sourceMapId]) {
    context.maps[sourceMapId] = {
      ...context.maps[sourceMapId]!,
      mapJson: document,
    };
  }
  setWorkspaceAuditContext(context);
  return context;
}
