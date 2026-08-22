import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  parseScriptSpatialContracts,
  type ScriptSpatialContracts,
} from "./scriptSpatialContracts";

export interface ScriptSpatialContext {
  sourceMapId: string | null;
  sourceDocument: EditableMapJson;
  scriptMapName: string;
  sourcePath: string;
  contracts: ScriptSpatialContracts | null;
  error: string | null;
}

let activeContext: ScriptSpatialContext | null = null;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function fileForPath(workspace: AraunaWorkspace, path: string): File | undefined {
  return workspace.files.get(path) ?? workspace.filesLower.get(path.toLowerCase());
}

function mapById(workspace: AraunaWorkspace, id: string): WorkspaceMap | undefined {
  return workspace.maps.find((map) => map.id === id);
}

function mapByName(workspace: AraunaWorkspace, name: string): WorkspaceMap | undefined {
  return workspace.maps.find((map) => map.name === name || map.directory === name);
}

function failedContext(
  document: EditableMapJson,
  sourceMapId: string | null,
  scriptMapName: string,
  sourcePath: string,
  error: string,
): ScriptSpatialContext {
  return {
    sourceMapId,
    sourceDocument: document,
    scriptMapName,
    sourcePath,
    contracts: null,
    error,
  };
}

/**
 * Resolve o scripts.inc efetivamente usado pelo MapHeader.
 *
 * Quando shared_scripts_map existe, tools/mapjson aponta MapScripts para o mapa
 * compartilhado; portanto auditar o scripts.inc local daria falsa segurança.
 * O documento em memória continua sendo usado apenas como identidade da sessão.
 */
export async function buildScriptSpatialContext(
  workspace: AraunaWorkspace,
  document: EditableMapJson,
): Promise<ScriptSpatialContext> {
  const sourceMapId = text(document.id);
  if (!sourceMapId) {
    return failedContext(document, null, "(desconhecido)", "", "map.json atual não possui id válido");
  }

  const current = mapById(workspace, sourceMapId);
  if (!current) {
    return failedContext(
      document,
      sourceMapId,
      String(document.name ?? sourceMapId),
      "",
      `mapa ${sourceMapId} não foi encontrado no Workspace`,
    );
  }

  const sharedScripts = text(document.shared_scripts_map);
  const scriptMap = sharedScripts ? mapByName(workspace, sharedScripts) : current;
  if (!scriptMap) {
    return failedContext(
      document,
      sourceMapId,
      sharedScripts ?? current.name,
      "",
      `shared_scripts_map ${sharedScripts} não foi encontrado no Workspace`,
    );
  }

  if (scriptMap.error) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      "",
      `mapa de scripts ${scriptMap.name} possui erro de indexação: ${scriptMap.error}`,
    );
  }

  const sourcePath = `data/maps/${scriptMap.directory}/scripts.inc`;
  const file = fileForPath(workspace, sourcePath);
  if (!file) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      sourcePath,
      `arquivo ${sourcePath} não encontrado`,
    );
  }

  try {
    const contracts = parseScriptSpatialContracts(await file.text());
    return {
      sourceMapId,
      sourceDocument: document,
      scriptMapName: scriptMap.name,
      sourcePath,
      contracts,
      error: null,
    };
  } catch (error) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      sourcePath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function refreshScriptSpatialContext(
  workspace: AraunaWorkspace | null | undefined,
  document: EditableMapJson | null | undefined,
): Promise<ScriptSpatialContext | null> {
  if (!workspace || !document) {
    activeContext = null;
    return null;
  }
  const context = await buildScriptSpatialContext(workspace, document);
  activeContext = context;
  return context;
}

export function getScriptSpatialContext(): ScriptSpatialContext | null {
  return activeContext;
}

export function clearScriptSpatialContext() {
  activeContext = null;
}
