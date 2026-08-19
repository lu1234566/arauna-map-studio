import { exportMapBin, parseMapBin, type MapData } from "./emeraldMap";
import { parseEditableMapJson, stringifyMapJson, type EditableMapJson } from "./eventMapJson";
import { parseEmeraldBorder, shiftMapJsonForResize, updateLayoutDimensionsSource, type ResizeResult } from "./layoutStructure";
import { normalizeWorkspacePath, type AraunaWorkspace, type WorkspaceLayout, type WorkspaceMap } from "./repoWorkspace";
import type { FileHandleLike, WritableWorkspaceAccess } from "./fileSystemWorkspace";

export interface StructuralSource {
  mapEntry: WorkspaceMap;
  layout: WorkspaceLayout;
  map: MapData;
  mapJson: EditableMapJson;
  mapJsonSource: string;
  layoutsSource: string;
  border: MapData | null;
}

export interface StructuralDraft {
  map: MapData;
  mapJson: EditableMapJson;
  mapJsonSource: string;
  layoutsSource: string;
  border: MapData | null;
  resize: ResizeResult;
  outOfBounds: Array<{ source: string; index: number; x: number; y: number }>;
  shiftedEvents: number;
  adjustedConnections: number;
}

export interface StructuralWrite {
  path: string;
  data: string | ArrayBuffer;
}

export class StructuralWorkspaceError extends Error {}

function getWorkspaceFile(workspace: AraunaWorkspace, path: string): File | undefined {
  const normalized = normalizeWorkspacePath(path);
  return workspace.files.get(normalized) ?? workspace.filesLower.get(normalized.toLowerCase());
}

function requireWorkspaceFile(workspace: AraunaWorkspace, path: string): File {
  const file = getWorkspaceFile(workspace, path);
  if (!file) throw new StructuralWorkspaceError(`Arquivo obrigatório não encontrado: ${normalizeWorkspacePath(path)}`);
  return file;
}

function findHandle(access: WritableWorkspaceAccess, path: string): FileHandleLike | undefined {
  const normalized = normalizeWorkspacePath(path);
  return access.fileHandles.get(normalized) ?? access.fileHandlesLower.get(normalized.toLowerCase());
}

async function ensureWritePermission(access: WritableWorkspaceAccess) {
  const root = access.root;
  if (root.queryPermission) {
    const current = await root.queryPermission({ mode: "readwrite" });
    if (current === "granted") return;
    if (current === "denied") throw new StructuralWorkspaceError("Permissão de escrita negada para a pasta.");
  }
  if (root.requestPermission) {
    const next = await root.requestPermission({ mode: "readwrite" });
    if (next !== "granted") throw new StructuralWorkspaceError("Permissão de escrita não concedida para a pasta.");
  }
}

async function writeHandle(handle: FileHandleLike, data: string | ArrayBuffer) {
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    try { await writable.abort?.(); } catch { /* best effort */ }
    throw error;
  }
}

export async function loadStructuralSource(workspace: AraunaWorkspace, mapEntry: WorkspaceMap): Promise<StructuralSource> {
  const layout = mapEntry.layout ?? workspace.layouts.get(mapEntry.layoutId);
  if (!layout) throw new StructuralWorkspaceError(`Layout não encontrado: ${mapEntry.layoutId}.`);

  const mapFile = requireWorkspaceFile(workspace, layout.blockdata_filepath);
  const mapJsonFile = requireWorkspaceFile(workspace, mapEntry.path);
  const layoutsFile = requireWorkspaceFile(workspace, "data/layouts/layouts.json");
  const expected = layout.width * layout.height * 2;
  if (mapFile.size !== expected) {
    throw new StructuralWorkspaceError(`${layout.blockdata_filepath} possui ${mapFile.size} bytes; esperado ${expected}.`);
  }

  let border: MapData | null = null;
  if (layout.border_filepath) {
    border = parseEmeraldBorder(await requireWorkspaceFile(workspace, layout.border_filepath).arrayBuffer());
  }

  const mapJsonSource = await mapJsonFile.text();
  return {
    mapEntry,
    layout,
    map: parseMapBin(await mapFile.arrayBuffer(), layout.width, layout.height),
    mapJson: parseEditableMapJson(mapJsonSource),
    mapJsonSource,
    layoutsSource: await layoutsFile.text(),
    border,
  };
}

export function buildStructuralDraft(source: StructuralSource, resize: ResizeResult, border: MapData | null): StructuralDraft {
  const shifted = shiftMapJsonForResize(source.mapJson, resize.dx, resize.dy, resize.map.width, resize.map.height);
  return {
    map: resize.map,
    mapJson: shifted.document,
    mapJsonSource: stringifyMapJson(shifted.document),
    layoutsSource: updateLayoutDimensionsSource(source.layoutsSource, source.layout.id, resize.map.width, resize.map.height),
    border,
    resize,
    outOfBounds: shifted.outOfBounds,
    shiftedEvents: shifted.shiftedEvents,
    adjustedConnections: shifted.adjustedConnections,
  };
}

export function structuralWrites(source: StructuralSource, draft: StructuralDraft): StructuralWrite[] {
  const writes: StructuralWrite[] = [];
  const mapBytes = exportMapBin(draft.map);
  const sourceMapBytes = exportMapBin(source.map);
  if (mapBytes.byteLength !== sourceMapBytes.byteLength || mapBytes.some((value, index) => value !== sourceMapBytes[index])) {
    writes.push({ path: source.layout.blockdata_filepath, data: mapBytes.slice().buffer as ArrayBuffer });
  }
  if (draft.mapJsonSource !== source.mapJsonSource) writes.push({ path: source.mapEntry.path, data: draft.mapJsonSource });
  if (draft.layoutsSource !== source.layoutsSource) writes.push({ path: "data/layouts/layouts.json", data: draft.layoutsSource });
  if (source.layout.border_filepath && source.border && draft.border) {
    const before = exportMapBin(source.border);
    const after = exportMapBin(draft.border);
    if (after.some((value, index) => value !== before[index])) {
      writes.push({ path: source.layout.border_filepath, data: after.slice().buffer as ArrayBuffer });
    }
  }
  return writes;
}

export async function writeStructuralFiles(workspace: AraunaWorkspace, access: WritableWorkspaceAccess, writes: StructuralWrite[]) {
  if (!writes.length) return [];
  await ensureWritePermission(access);

  const prepared = await Promise.all(writes.map(async (write) => {
    const path = normalizeWorkspacePath(write.path);
    const handle = findHandle(access, path);
    if (!handle) throw new StructuralWorkspaceError(`Sem acesso de escrita para ${path}.`);
    const original = await (await handle.getFile()).arrayBuffer();
    return { ...write, path, handle, original };
  }));

  const completed: typeof prepared = [];
  try {
    for (const item of prepared) {
      await writeHandle(item.handle, item.data);
      completed.push(item);
    }
  } catch (error) {
    for (const item of [...completed].reverse()) {
      try { await writeHandle(item.handle, item.original); } catch { /* best effort rollback */ }
    }
    throw new StructuralWorkspaceError(
      `Falha na gravação estrutural; rollback foi tentado: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const item of prepared) {
    const fresh = await item.handle.getFile();
    workspace.files.set(item.path, fresh);
    workspace.filesLower.set(item.path.toLowerCase(), fresh);
  }
  return prepared.map((item) => item.path);
}

export function applyDraftLayoutToWorkspace(source: StructuralSource, workspace: AraunaWorkspace, draft: StructuralDraft) {
  source.layout.width = draft.map.width;
  source.layout.height = draft.map.height;
  workspace.layouts.set(source.layout.id, source.layout);
  for (const map of workspace.maps) if (map.layoutId === source.layout.id) map.layout = source.layout;
}
