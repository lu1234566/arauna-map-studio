import { editorStore } from "./editorStore";
import { normalizeWorkspacePath, type AraunaWorkspace } from "./repoWorkspace";

export type WorkspacePermissionState = "granted" | "denied" | "prompt";

export interface WritableFileStreamLike {
  write(data: Blob | ArrayBuffer | ArrayBufferView | string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface FileHandleLike {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileStreamLike>;
}

export interface DirectoryHandleLike {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, FileHandleLike | DirectoryHandleLike]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  queryPermission?(options?: { mode?: "read" | "readwrite" }): Promise<WorkspacePermissionState>;
  requestPermission?(options?: { mode?: "read" | "readwrite" }): Promise<WorkspacePermissionState>;
}

export interface WritableWorkspaceAccess {
  root: DirectoryHandleLike;
  dataRoot: DirectoryHandleLike;
  fileHandles: Map<string, FileHandleLike>;
  fileHandlesLower: Map<string, FileHandleLike>;
  label: string;
}

export interface WritableWorkspaceSelection {
  files: File[];
  access: WritableWorkspaceAccess;
}

export interface WorkspaceSaveResult {
  saved: string[];
  skipped: string[];
}

export class WritableWorkspaceError extends Error {}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<DirectoryHandleLike>;
};

export function writableDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

async function ensureReadWritePermission(handle: DirectoryHandleLike) {
  if (handle.queryPermission) {
    const current = await handle.queryPermission({ mode: "readwrite" });
    if (current === "granted") return;
    if (current === "denied") {
      throw new WritableWorkspaceError("O navegador negou permissão de escrita para esta pasta.");
    }
  }
  if (handle.requestPermission) {
    const next = await handle.requestPermission({ mode: "readwrite" });
    if (next !== "granted") {
      throw new WritableWorkspaceError("Permissão de escrita não concedida para a pasta selecionada.");
    }
  }
}

async function resolveDataRoot(root: DirectoryHandleLike): Promise<DirectoryHandleLike> {
  if (root.name.toLowerCase() === "data") return root;
  try {
    return await root.getDirectoryHandle("data");
  } catch {
    throw new WritableWorkspaceError(
      "A pasta selecionada não é data/ e não contém uma subpasta data/. Selecione a raiz do repositório ou diretamente data/.",
    );
  }
}

function fileWithRelativePath(file: File, relativePath: string): File {
  const wrapped = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
  Object.defineProperty(wrapped, "webkitRelativePath", {
    value: relativePath,
    enumerable: true,
    configurable: true,
  });
  return wrapped;
}

async function scanDirectory(
  directory: DirectoryHandleLike,
  relativeDir: string,
  files: File[],
  handles: Map<string, FileHandleLike>,
  handlesLower: Map<string, FileHandleLike>,
) {
  for await (const [name, handle] of directory.entries()) {
    const relativePath = relativeDir ? `${relativeDir}/${name}` : name;
    if (handle.kind === "directory") {
      await scanDirectory(handle, relativePath, files, handles, handlesLower);
      continue;
    }
    const normalized = normalizeWorkspacePath(`data/${relativePath}`);
    const file = await handle.getFile();
    files.push(fileWithRelativePath(file, normalized));
    handles.set(normalized, handle);
    handlesLower.set(normalized.toLowerCase(), handle);
  }
}

export async function pickWritableAraunaWorkspace(): Promise<WritableWorkspaceSelection> {
  if (!writableDirectoryPickerSupported()) {
    throw new WritableWorkspaceError(
      "Este navegador não oferece acesso gravável a pastas. Use Chrome/Chromebook atualizado ou abra em modo somente leitura.",
    );
  }

  const picker = (window as PickerWindow).showDirectoryPicker!;
  const root = await picker({ id: "arauna-map-studio", mode: "readwrite" });
  await ensureReadWritePermission(root);
  const dataRoot = await resolveDataRoot(root);
  const files: File[] = [];
  const fileHandles = new Map<string, FileHandleLike>();
  const fileHandlesLower = new Map<string, FileHandleLike>();
  await scanDirectory(dataRoot, "", files, fileHandles, fileHandlesLower);

  return {
    files,
    access: {
      root,
      dataRoot,
      fileHandles,
      fileHandlesLower,
      label: root.name,
    },
  };
}

function findWritableHandle(access: WritableWorkspaceAccess, path: string): FileHandleLike | undefined {
  const normalized = normalizeWorkspacePath(path);
  return access.fileHandles.get(normalized) ?? access.fileHandlesLower.get(normalized.toLowerCase());
}

async function writeHandle(handle: FileHandleLike, data: Blob | ArrayBuffer | ArrayBufferView | string) {
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

async function refreshWorkspaceFile(
  workspace: AraunaWorkspace,
  access: WritableWorkspaceAccess,
  path: string,
) {
  const normalized = normalizeWorkspacePath(path);
  const handle = findWritableHandle(access, normalized);
  if (!handle) return;
  const fresh = await handle.getFile();
  workspace.files.set(normalized, fresh);
  workspace.filesLower.set(normalized.toLowerCase(), fresh);
}

export async function saveEditorToWritableWorkspace(
  workspace: AraunaWorkspace,
  access: WritableWorkspaceAccess,
): Promise<WorkspaceSaveResult> {
  await ensureReadWritePermission(access.root);
  const state = editorStore.getState();
  const pending: Array<{ kind: "bin" | "json"; path: string; data: Blob | ArrayBuffer | string }> = [];
  const skipped: string[] = [];

  if (state.dirty) {
    if (!state.sourceFile) {
      throw new WritableWorkspaceError("O map.bin atual não possui caminho de origem no Workspace.");
    }
    const path = normalizeWorkspacePath(state.sourceFile);
    const handle = findWritableHandle(access, path);
    if (!handle) throw new WritableWorkspaceError(`Não encontrei permissão de escrita para ${path}.`);
    const bytes = editorStore.exportBytes();
    pending.push({ kind: "bin", path, data: bytes.slice().buffer as ArrayBuffer });
  } else {
    skipped.push("map.bin sem alterações");
  }

  if (state.mapJsonDirty) {
    if (!state.mapJsonSource) {
      throw new WritableWorkspaceError("O map.json atual não possui caminho de origem no Workspace.");
    }
    const source = editorStore.exportMapJsonSource();
    if (!source) throw new WritableWorkspaceError("Não há documento map.json editável carregado.");
    const path = normalizeWorkspacePath(state.mapJsonSource);
    const handle = findWritableHandle(access, path);
    if (!handle) throw new WritableWorkspaceError(`Não encontrei permissão de escrita para ${path}.`);
    pending.push({ kind: "json", path, data: source });
  } else {
    skipped.push("map.json sem alterações");
  }

  const saved: string[] = [];
  for (const item of pending) {
    const handle = findWritableHandle(access, item.path);
    if (!handle) throw new WritableWorkspaceError(`Handle de escrita perdido para ${item.path}.`);
    await writeHandle(handle, item.data);
    await refreshWorkspaceFile(workspace, access, item.path);
    if (item.kind === "bin") editorStore.markBinExported();
    else editorStore.markMapJsonExported();
    saved.push(item.path);
  }

  return { saved, skipped };
}
