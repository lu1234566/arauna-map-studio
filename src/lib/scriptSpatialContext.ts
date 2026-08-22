import { fnv1a, type AraunaCityBundle } from "./araunaCityBundle";
import {
  scriptSpatialSnapshotFromBundle,
  validateBundleDependencies,
} from "./cityBundleDependencies";
import {
  parseEditableMapJson,
  type EditableMapJson,
} from "./eventMapJson";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  parseScriptSpatialContracts,
  referencedScriptWarpMapIds,
  type ScriptSpatialContracts,
} from "./scriptSpatialContracts";

const COMMON_MOVEMENT_PATH = "data/scripts/movement.inc";

export interface ScriptWarpDestinationContext {
  mapJson?: EditableMapJson;
  effectiveEvents?: EditableMapJson;
  width?: number;
  height?: number;
  error?: string;
}

export interface ScriptSpatialContext {
  sourceMapId: string | null;
  sourceDocument: EditableMapJson;
  scriptMapName: string;
  sourcePath: string;
  source: string;
  sourceChecksum: string;
  contracts: ScriptSpatialContracts | null;
  warpDestinations: Record<string, ScriptWarpDestinationContext | undefined>;
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

async function documentForMap(
  workspace: AraunaWorkspace,
  descriptor: WorkspaceMap,
): Promise<EditableMapJson> {
  const file = fileForPath(workspace, descriptor.path);
  if (!file) throw new Error(`arquivo ${descriptor.path} não encontrado`);
  return parseEditableMapJson(await file.text());
}

async function effectiveEventsForDocument(
  workspace: AraunaWorkspace,
  document: EditableMapJson,
): Promise<EditableMapJson> {
  const sharedName = text(document.shared_events_map);
  if (!sharedName) return document;
  const descriptor = mapByName(workspace, sharedName);
  if (!descriptor) throw new Error(`shared_events_map ${sharedName} não encontrado no Workspace`);
  return documentForMap(workspace, descriptor);
}

async function loadWarpDestinations(
  workspace: AraunaWorkspace,
  currentDocument: EditableMapJson,
  contracts: ScriptSpatialContracts,
): Promise<Record<string, ScriptWarpDestinationContext | undefined>> {
  const destinations: Record<string, ScriptWarpDestinationContext | undefined> = {};
  const currentId = text(currentDocument.id);

  await Promise.all(referencedScriptWarpMapIds(contracts).map(async (mapId) => {
    const descriptor = mapById(workspace, mapId);
    if (!descriptor) {
      destinations[mapId] = { error: `mapa ${mapId} referenciado por script não encontrado no Workspace` };
      return;
    }
    if (descriptor.error) {
      destinations[mapId] = { error: descriptor.error };
      return;
    }

    try {
      const mapJson = mapId === currentId
        ? currentDocument
        : await documentForMap(workspace, descriptor);
      const layout = descriptor.layout ?? workspace.layouts.get(descriptor.layoutId);
      const effectiveEvents = await effectiveEventsForDocument(workspace, mapJson);
      destinations[mapId] = {
        mapJson,
        effectiveEvents,
        ...(layout ? { width: layout.width, height: layout.height } : {}),
        ...(!layout ? { error: `layout ${descriptor.layoutId || "(vazio)"} não encontrado` } : {}),
      };
    } catch (error) {
      destinations[mapId] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));

  return destinations;
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
    warpDestinations: {},
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
 * Resolve o scripts.inc efetivamente usado pelo MapHeader, a biblioteca comum
 * de movimentos e os mapas destino citados por comandos de warp de script.
 *
 * Quando shared_scripts_map existe, tools/mapjson aponta MapScripts para o mapa
 * compartilhado; portanto auditar o scripts.inc local daria falsa segurança.
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
    const warpDestinations = await loadWarpDestinations(workspace, document, contracts);
    return {
      sourceMapId,
      sourceDocument: document,
      scriptMapName: scriptMap.name,
      sourcePath: combined.sourcePath,
      source: combined.source,
      sourceChecksum: fnv1a(combined.source),
      contracts,
      warpDestinations,
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
 * Destinos externos de warp não são inventados: sem Workspace eles permanecem
 * não certificados e rebaixam o relatório quando necessários.
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
    warpDestinations: {},
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
