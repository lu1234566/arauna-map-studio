import type { FingerprintAtlas } from "./araunaCityBundle";
import { parseMapBin } from "./emeraldMap";
import { PRIMARY_METATILE_LIMIT, parseMetatileAttributes } from "./emeraldTileset";
import { parseEditableMapJson, type EditableMapJson } from "./eventMapJson";
import type { ImplementabilityWorkspaceContext } from "./gameImplementability";
import {
  resolveTilesetDirectory,
  type AraunaWorkspace,
  type WorkspaceLayout,
  type WorkspaceMap,
} from "./repoWorkspace";

let activeContext: ImplementabilityWorkspaceContext | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value : null;
}

/**
 * Retorna somente dependências diretas necessárias para verificar o mapa
 * atual: destinos de warps estáticos e mapas vizinhos das connections.
 * MAP_DYNAMIC é resolvido pelo save/engine e nunca representa um arquivo.
 */
export function referencedWorkspaceMapIds(document: EditableMapJson): string[] {
  const ids = new Set<string>();

  if (Array.isArray(document.warp_events)) {
    for (const raw of document.warp_events) {
      if (!isRecord(raw)) continue;
      const destMap = nonEmptyText(raw.dest_map);
      if (destMap && destMap !== "MAP_DYNAMIC") ids.add(destMap);
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

function fileForPath(workspace: AraunaWorkspace, path: string): File | undefined {
  return workspace.files.get(path) ?? workspace.filesLower.get(path.toLowerCase());
}

function fileForMap(workspace: AraunaWorkspace, map: WorkspaceMap): File | undefined {
  return fileForPath(workspace, map.path);
}

async function loadLightweightAuditAtlas(
  workspace: AraunaWorkspace,
  layout: WorkspaceLayout,
  cache: Map<string, Promise<FingerprintAtlas>>,
): Promise<FingerprintAtlas> {
  const key = `${layout.primary_tileset}|${layout.secondary_tileset}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = (async () => {
    const primaryDir = resolveTilesetDirectory(workspace.tilesets, "primary", layout.primary_tileset);
    const secondaryDir = resolveTilesetDirectory(workspace.tilesets, "secondary", layout.secondary_tileset);
    if (!primaryDir || !secondaryDir) {
      throw new Error(
        `tileset(s) de auditoria não encontrados: ${layout.primary_tileset} + ${layout.secondary_tileset}`,
      );
    }
    const primaryFile = fileForPath(workspace, `${primaryDir.path}/metatile_attributes.bin`);
    const secondaryFile = fileForPath(workspace, `${secondaryDir.path}/metatile_attributes.bin`);
    if (!primaryFile || !secondaryFile) {
      throw new Error("metatile_attributes.bin ausente em um dos tilesets do mapa vizinho");
    }

    const [primary, secondary] = await Promise.all([
      primaryFile.arrayBuffer().then(parseMetatileAttributes),
      secondaryFile.arrayBuffer().then(parseMetatileAttributes),
    ]);
    return {
      primary: layout.primary_tileset,
      secondary: layout.secondary_tileset,
      records: [
        ...primary.map((attr, id) => ({ id, behavior: attr.behavior, layerType: attr.layerType })),
        ...secondary.map((attr, localId) => ({
          id: PRIMARY_METATILE_LIMIT + localId,
          behavior: attr.behavior,
          layerType: attr.layerType,
        })),
      ],
    };
  })();
  cache.set(key, pending);
  return pending;
}

/**
 * Carrega somente as dependências diretas. Nenhum mapa é aberto no editor e
 * nenhum evento é renumerado. Além do map.json, carregamos o map.bin e apenas
 * os atributos dos tilesets (sem PNG/paletas) para auditar tiles de margem de
 * conexão como o warp vanilla (40,7) de SlateportCity.
 */
export async function buildWorkspaceAuditContext(
  workspace: AraunaWorkspace,
  currentDocument: EditableMapJson,
): Promise<ImplementabilityWorkspaceContext> {
  const sourceMapId = nonEmptyText(currentDocument.id);
  const maps: ImplementabilityWorkspaceContext["maps"] = {};
  const loadErrors: Record<string, string> = {};
  const byId = workspaceMapById(workspace);
  const atlasCache = new Map<string, Promise<FingerprintAtlas>>();

  // O documento em memória é sempre autoritativo para o mapa atual. Um warp
  // self-target nunca pode substituí-lo por uma versão possivelmente stale do disco.
  if (sourceMapId) maps[sourceMapId] = { mapJson: currentDocument };

  for (const id of referencedWorkspaceMapIds(currentDocument)) {
    if (id === sourceMapId) continue;

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
      const mapJson = parseEditableMapJson(await file.text());
      const layout = descriptor.layout ?? workspace.layouts.get(descriptor.layoutId);
      if (!layout) {
        maps[id] = { mapJson };
        loadErrors[id] = `layout ${descriptor.layoutId || "(vazio)"} não encontrado`;
        continue;
      }

      const entry: NonNullable<ImplementabilityWorkspaceContext["maps"][string]> = {
        mapJson,
        width: layout.width,
        height: layout.height,
      };
      const warnings: string[] = [];

      const mapBin = fileForPath(workspace, layout.blockdata_filepath);
      if (!mapBin) {
        warnings.push(`arquivo ${layout.blockdata_filepath} não encontrado`);
      } else if (mapBin.size !== layout.width * layout.height * 2) {
        warnings.push(
          `${layout.blockdata_filepath} tem ${mapBin.size} bytes; esperado ${layout.width * layout.height * 2}`,
        );
      } else {
        entry.map = parseMapBin(await mapBin.arrayBuffer(), layout.width, layout.height);
      }

      try {
        entry.atlas = await loadLightweightAuditAtlas(workspace, layout, atlasCache);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : String(error));
      }

      maps[id] = entry;
      if (warnings.length) loadErrors[id] = warnings.join("; ");
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
