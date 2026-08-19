import { exportMapBin, parseMapBin, type MapData } from "./emeraldMap";
import {
  cloneMapJson,
  parseEditableMapJson,
  stringifyMapJson,
  type EditableMapJson,
} from "./eventMapJson";
import {
  parseEmeraldBorder,
  shiftMapJsonForResize,
  updateLayoutDimensionsSource,
  type ResizeResult,
} from "./layoutStructure";
import {
  normalizeWorkspacePath,
  type AraunaWorkspace,
  type WorkspaceLayout,
  type WorkspaceMap,
} from "./repoWorkspace";
import type { FileHandleLike, WritableWorkspaceAccess } from "./fileSystemWorkspace";

export interface StructuralNeighbor {
  mapEntry: WorkspaceMap;
  source: string;
  document: EditableMapJson;
}

export interface StructuralSource {
  mapEntry: WorkspaceMap;
  layout: WorkspaceLayout;
  map: MapData;
  mapJson: EditableMapJson;
  mapJsonSource: string;
  layoutsSource: string;
  border: MapData | null;
  neighbors: StructuralNeighbor[];
}

export interface StructuralNeighborDraft {
  path: string;
  originalSource: string;
  source: string;
  document: EditableMapJson;
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
  reciprocalConnectionsAdjusted: number;
  reciprocalConnectionIssues: string[];
  neighbors: StructuralNeighborDraft[];
}

export interface StructuralWrite {
  path: string;
  data: string | ArrayBuffer;
}

export class StructuralWorkspaceError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getWorkspaceFile(workspace: AraunaWorkspace, path: string): File | undefined {
  const normalized = normalizeWorkspacePath(path);
  return workspace.files.get(normalized) ?? workspace.filesLower.get(normalized.toLowerCase());
}

function requireWorkspaceFile(workspace: AraunaWorkspace, path: string): File {
  const file = getWorkspaceFile(workspace, path);
  if (!file) {
    throw new StructuralWorkspaceError(
      `Arquivo obrigatório não encontrado: ${normalizeWorkspacePath(path)}`,
    );
  }
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
    if (current === "denied") {
      throw new StructuralWorkspaceError("Permissão de escrita negada para a pasta.");
    }
  }
  if (root.requestPermission) {
    const next = await root.requestPermission({ mode: "readwrite" });
    if (next !== "granted") {
      throw new StructuralWorkspaceError("Permissão de escrita não concedida para a pasta.");
    }
  }
}

async function writeHandle(handle: FileHandleLike, data: string | ArrayBuffer) {
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort?.();
    } catch {
      /* best effort */
    }
    throw error;
  }
}

function connectionRecords(document: EditableMapJson): Array<Record<string, unknown>> {
  const value = document["connections"];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function oppositeDirection(direction: string): string | null {
  if (direction === "up") return "down";
  if (direction === "down") return "up";
  if (direction === "left") return "right";
  if (direction === "right") return "left";
  return null;
}

async function loadConnectionNeighbors(
  workspace: AraunaWorkspace,
  current: WorkspaceMap,
  document: EditableMapJson,
): Promise<StructuralNeighbor[]> {
  const ids = new Set<string>();
  for (const connection of connectionRecords(document)) {
    const id = connection["map"];
    if (typeof id === "string" && id !== current.id) ids.add(id);
  }

  const neighbors: StructuralNeighbor[] = [];
  for (const id of ids) {
    const mapEntry = workspace.maps.find((candidate) => candidate.id === id);
    if (!mapEntry) continue;
    const file = getWorkspaceFile(workspace, mapEntry.path);
    if (!file) continue;
    const source = await file.text();
    neighbors.push({
      mapEntry,
      source,
      document: parseEditableMapJson(source),
    });
  }
  return neighbors;
}

export async function loadStructuralSource(
  workspace: AraunaWorkspace,
  mapEntry: WorkspaceMap,
): Promise<StructuralSource> {
  const layout = mapEntry.layout ?? workspace.layouts.get(mapEntry.layoutId);
  if (!layout) {
    throw new StructuralWorkspaceError(`Layout não encontrado: ${mapEntry.layoutId}.`);
  }

  const mapFile = requireWorkspaceFile(workspace, layout.blockdata_filepath);
  const mapJsonFile = requireWorkspaceFile(workspace, mapEntry.path);
  const layoutsFile = requireWorkspaceFile(workspace, "data/layouts/layouts.json");
  const expected = layout.width * layout.height * 2;
  if (mapFile.size !== expected) {
    throw new StructuralWorkspaceError(
      `${layout.blockdata_filepath} possui ${mapFile.size} bytes; esperado ${expected}.`,
    );
  }

  let border: MapData | null = null;
  if (layout.border_filepath) {
    border = parseEmeraldBorder(
      await requireWorkspaceFile(workspace, layout.border_filepath).arrayBuffer(),
    );
  }

  const mapJsonSource = await mapJsonFile.text();
  const mapJson = parseEditableMapJson(mapJsonSource);
  return {
    mapEntry,
    layout,
    map: parseMapBin(await mapFile.arrayBuffer(), layout.width, layout.height),
    mapJson,
    mapJsonSource,
    layoutsSource: await layoutsFile.text(),
    border,
    neighbors: await loadConnectionNeighbors(workspace, mapEntry, mapJson),
  };
}

function updateReciprocalConnections(
  source: StructuralSource,
  resizedDocument: EditableMapJson,
): {
  neighbors: StructuralNeighborDraft[];
  adjusted: number;
  issues: string[];
} {
  const originals = connectionRecords(source.mapJson);
  const resized = connectionRecords(resizedDocument);
  const drafts = new Map<string, StructuralNeighborDraft>();
  const issues: string[] = [];
  let adjusted = 0;

  originals.forEach((original, index) => {
    const next = resized[index];
    if (!next) return;
    const targetId = original["map"];
    const direction = String(original["direction"] ?? "");
    const oldOffset = Number(original["offset"]);
    const nextOffset = Number(next["offset"]);
    const opposite = oppositeDirection(direction);
    if (
      typeof targetId !== "string" ||
      !opposite ||
      !Number.isInteger(oldOffset) ||
      !Number.isInteger(nextOffset) ||
      oldOffset === nextOffset
    ) {
      return;
    }

    const delta = nextOffset - oldOffset;
    const neighbor = source.neighbors.find(
      (candidate) => candidate.mapEntry.id === targetId,
    );
    if (!neighbor) {
      issues.push(
        `${direction} → ${targetId}: mapa vizinho não pôde ser carregado para ajustar a conexão recíproca.`,
      );
      return;
    }

    let draft = drafts.get(neighbor.mapEntry.path);
    if (!draft) {
      draft = {
        path: neighbor.mapEntry.path,
        originalSource: neighbor.source,
        source: neighbor.source,
        document: cloneMapJson(neighbor.document),
      };
      drafts.set(neighbor.mapEntry.path, draft);
    }

    const candidates = connectionRecords(draft.document)
      .map((connection, candidateIndex) => ({ connection, candidateIndex }))
      .filter(
        ({ connection }) =>
          connection["map"] === source.mapEntry.id &&
          connection["direction"] === opposite,
      );
    const exact = candidates.filter(
      ({ connection }) => Number(connection["offset"]) === -oldOffset,
    );
    if (exact.length !== 1) {
      issues.push(
        `${direction} → ${targetId}: esperado 1 recíproco ${opposite} com offset ${-oldOffset}, encontrado(s) ${exact.length}.`,
      );
      return;
    }

    const reciprocal = exact[0]!.connection;
    reciprocal["offset"] = Number(reciprocal["offset"]) - delta;
    adjusted++;
  });

  const neighbors = [...drafts.values()].map((draft) => ({
    ...draft,
    source: stringifyMapJson(draft.document),
  }));
  return { neighbors, adjusted, issues };
}

export function buildStructuralDraft(
  source: StructuralSource,
  resize: ResizeResult,
  border: MapData | null,
): StructuralDraft {
  const shifted = shiftMapJsonForResize(
    source.mapJson,
    resize.dx,
    resize.dy,
    resize.map.width,
    resize.map.height,
  );
  const reciprocal = updateReciprocalConnections(source, shifted.document);
  const jsonChanged = shifted.shiftedEvents > 0 || shifted.adjustedConnections > 0;
  const dimensionsChanged =
    resize.map.width !== source.layout.width || resize.map.height !== source.layout.height;

  return {
    map: resize.map,
    mapJson: shifted.document,
    mapJsonSource: jsonChanged ? stringifyMapJson(shifted.document) : source.mapJsonSource,
    layoutsSource: dimensionsChanged
      ? updateLayoutDimensionsSource(
          source.layoutsSource,
          source.layout.id,
          resize.map.width,
          resize.map.height,
        )
      : source.layoutsSource,
    border,
    resize,
    outOfBounds: shifted.outOfBounds,
    shiftedEvents: shifted.shiftedEvents,
    adjustedConnections: shifted.adjustedConnections,
    reciprocalConnectionsAdjusted: reciprocal.adjusted,
    reciprocalConnectionIssues: reciprocal.issues,
    neighbors: reciprocal.neighbors,
  };
}

export function structuralWrites(
  source: StructuralSource,
  draft: StructuralDraft,
): StructuralWrite[] {
  const writes: StructuralWrite[] = [];
  const mapBytes = exportMapBin(draft.map);
  const sourceMapBytes = exportMapBin(source.map);
  if (
    mapBytes.byteLength !== sourceMapBytes.byteLength ||
    mapBytes.some((value, index) => value !== sourceMapBytes[index])
  ) {
    writes.push({
      path: source.layout.blockdata_filepath,
      data: mapBytes.slice().buffer as ArrayBuffer,
    });
  }
  if (draft.mapJsonSource !== source.mapJsonSource) {
    writes.push({ path: source.mapEntry.path, data: draft.mapJsonSource });
  }
  if (draft.layoutsSource !== source.layoutsSource) {
    writes.push({
      path: "data/layouts/layouts.json",
      data: draft.layoutsSource,
    });
  }
  if (source.layout.border_filepath && source.border && draft.border) {
    const before = exportMapBin(source.border);
    const after = exportMapBin(draft.border);
    if (after.some((value, index) => value !== before[index])) {
      writes.push({
        path: source.layout.border_filepath,
        data: after.slice().buffer as ArrayBuffer,
      });
    }
  }
  for (const neighbor of draft.neighbors) {
    if (neighbor.source !== neighbor.originalSource) {
      writes.push({ path: neighbor.path, data: neighbor.source });
    }
  }
  return writes;
}

export async function writeStructuralFiles(
  workspace: AraunaWorkspace,
  access: WritableWorkspaceAccess,
  writes: StructuralWrite[],
) {
  if (!writes.length) return [];
  await ensureWritePermission(access);

  const prepared = await Promise.all(
    writes.map(async (write) => {
      const path = normalizeWorkspacePath(write.path);
      const handle = findHandle(access, path);
      if (!handle) {
        throw new StructuralWorkspaceError(`Sem acesso de escrita para ${path}.`);
      }
      const original = await (await handle.getFile()).arrayBuffer();
      return { ...write, path, handle, original };
    }),
  );

  const completed: typeof prepared = [];
  try {
    for (const item of prepared) {
      await writeHandle(item.handle, item.data);
      completed.push(item);
    }
  } catch (error) {
    for (const item of [...completed].reverse()) {
      try {
        await writeHandle(item.handle, item.original);
      } catch {
        /* best effort rollback */
      }
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

export function applyDraftLayoutToWorkspace(
  source: StructuralSource,
  workspace: AraunaWorkspace,
  draft: StructuralDraft,
) {
  source.layout.width = draft.map.width;
  source.layout.height = draft.map.height;
  workspace.layouts.set(source.layout.id, source.layout);
  for (const map of workspace.maps) {
    if (map.layoutId === source.layout.id) map.layout = source.layout;
  }
}
