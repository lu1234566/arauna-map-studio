import { fnv1a, type AraunaCityBundle } from "./araunaCityBundle";
import {
  scriptSpatialSnapshotFromBundle,
  validateBundleDependencies,
} from "./cityBundleDependencies";
import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  parseScriptSpatialContracts,
  type ScriptSpatialContracts,
} from "./scriptSpatialContracts";

const COMMON_MOVEMENT_PATH = "data/scripts/movement.inc";

export interface ScriptSpatialContext {
  sourceMapId: string | null;
  sourceDocument: EditableMapJson;
  scriptMapName: string;
  sourcePath: string;
  source: string;
  sourceChecksum: string;
  contracts: ScriptSpatialContracts | null;
  error: string | null;
  origin: "workspace" | "bundle";
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
    source: "",
    sourceChecksum: "",
    contracts: null,
    error,
    origin: "workspace",
  };
}

function combinedScriptSource(
  mapPath: string,
  mapSource: string,
  commonSource: string,
): { sourcePath: string; source: string } {
  const normalizedMap = mapSource.replace(/\r/g, "");
  const normalizedCommon = commonSource.replace(/\r/g, "");
  return {
    sourcePath: `${mapPath} + ${COMMON_MOVEMENT_PATH}`,
    // O mapa vem primeiro para preservar seus line numbers originais. A fonte
    // comum é anexada apenas para resolver Common_Movement_* de forma auditável.
    source:
      `${normalizedMap}\n\n` +
      `@ ARAUNA_AUDIT_SUPPORT_SOURCE ${COMMON_MOVEMENT_PATH}\n` +
      normalizedCommon,
  };
}

/**
 * Resolve o scripts.inc efetivamente usado pelo MapHeader e a biblioteca comum
 * de movimentos que ele pode referenciar.
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

  const mapSourcePath = `data/maps/${scriptMap.directory}/scripts.inc`;
  const mapFile = fileForPath(workspace, mapSourcePath);
  if (!mapFile) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      mapSourcePath,
      `arquivo ${mapSourcePath} não encontrado`,
    );
  }

  const commonMovementFile = fileForPath(workspace, COMMON_MOVEMENT_PATH);
  if (!commonMovementFile) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      `${mapSourcePath} + ${COMMON_MOVEMENT_PATH}`,
      `arquivo obrigatório ${COMMON_MOVEMENT_PATH} não encontrado; Common_Movement_* não pode ser certificado`,
    );
  }

  try {
    const [mapSource, commonSource] = await Promise.all([
      mapFile.text(),
      commonMovementFile.text(),
    ]);
    const combined = combinedScriptSource(mapSourcePath, mapSource, commonSource);
    const contracts = parseScriptSpatialContracts(combined.source);
    return {
      sourceMapId,
      sourceDocument: document,
      scriptMapName: scriptMap.name,
      sourcePath: combined.sourcePath,
      source: combined.source,
      sourceChecksum: fnv1a(combined.source),
      contracts,
      error: null,
      origin: "workspace",
    };
  } catch (error) {
    return failedContext(
      document,
      sourceMapId,
      scriptMap.name,
      `${mapSourcePath} + ${COMMON_MOVEMENT_PATH}`,
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

/**
 * Restaura a prova espacial embutida em uma Cidade JSON importada. A camada só
 * é ativada se os checksums e a derivação contracts <- fontes de script passarem.
 */
export function installScriptSpatialContextFromBundle(
  bundle: AraunaCityBundle,
  document: EditableMapJson | null | undefined,
): ScriptSpatialContext | null {
  if (!document || text(bundle.mapJson.id) !== text(document.id)) {
    activeContext = null;
    return null;
  }
  const snapshot = scriptSpatialSnapshotFromBundle(bundle);
  const dependencyErrors = validateBundleDependencies(bundle).filter((found) =>
    found.code.startsWith("BUNDLE_SCRIPT_SPATIAL_"),
  );
  if (!snapshot || dependencyErrors.length) {
    activeContext = null;
    return null;
  }

  activeContext = {
    sourceMapId: text(document.id),
    sourceDocument: document,
    scriptMapName: snapshot.mapName,
    sourcePath: snapshot.sourcePath,
    source: snapshot.source,
    sourceChecksum: snapshot.sourceChecksum,
    contracts: snapshot.contracts,
    error: null,
    origin: "bundle",
  };
  return activeContext;
}

export function getScriptSpatialContext(): ScriptSpatialContext | null {
  return activeContext;
}

export function clearScriptSpatialContext() {
  activeContext = null;
}
