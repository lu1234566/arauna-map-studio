import { describe, expect, it } from "vitest";
import { editorStore } from "./editorStore";
import {
  saveEditorToWritableWorkspace,
  type DirectoryHandleLike,
  type FileHandleLike,
  type WritableFileStreamLike,
  type WritableWorkspaceAccess,
} from "./fileSystemWorkspace";
import type { AraunaWorkspace } from "./repoWorkspace";

function directory(name: string): DirectoryHandleLike {
  return {
    kind: "directory",
    name,
    async *entries() {},
    async getDirectoryHandle() {
      throw new Error("not used");
    },
    async queryPermission() {
      return "granted";
    },
  };
}

function writableHandle(name: string, onWrite: (value: unknown) => void): FileHandleLike {
  return {
    kind: "file",
    name,
    async getFile() {
      return { name } as File;
    },
    async createWritable() {
      const stream: WritableFileStreamLike = {
        async write(value) {
          onWrite(value);
        },
        async close() {},
      };
      return stream;
    },
  };
}

describe("direct writable workspace save", () => {
  it("writes dirty BIN and JSON to their original workspace paths", async () => {
    editorStore.newMap();
    editorStore.setViewMode("visual");
    const binPath = "data/layouts/Test/map.bin";
    const jsonPath = "data/maps/Test/map.json";
    const imported = editorStore.importBufferSized(new ArrayBuffer(800), binPath, 20, 20);
    expect(imported.ok).toBe(true);
    const json = JSON.stringify({
      id: "MAP_TEST",
      name: "Test",
      layout: "LAYOUT_TEST",
      connections: [],
      object_events: [],
      warp_events: [],
      coord_events: [],
      bg_events: [],
    });
    expect(editorStore.importMapJson(json, jsonPath).ok).toBe(true);

    editorStore.setMetatile(1);
    editorStore.paint(0, 0);
    editorStore.createEvent("bg", 2, 3);
    expect(editorStore.getState().dirty).toBe(true);
    expect(editorStore.getState().mapJsonDirty).toBe(true);

    let binWritten: unknown;
    let jsonWritten: unknown;
    const binHandle = writableHandle("map.bin", (value) => { binWritten = value; });
    const jsonHandle = writableHandle("map.json", (value) => { jsonWritten = value; });
    const root = directory("repo");
    const dataRoot = directory("data");
    const access: WritableWorkspaceAccess = {
      root,
      dataRoot,
      label: "repo",
      fileHandles: new Map([
        [binPath, binHandle],
        [jsonPath, jsonHandle],
      ]),
      fileHandlesLower: new Map([
        [binPath.toLowerCase(), binHandle],
        [jsonPath.toLowerCase(), jsonHandle],
      ]),
    };
    const workspace: AraunaWorkspace = {
      files: new Map(),
      filesLower: new Map(),
      layouts: new Map(),
      maps: [],
      tilesets: [],
    };

    const result = await saveEditorToWritableWorkspace(workspace, access);
    expect(result.saved).toEqual([binPath, jsonPath]);
    expect(binWritten).toBeInstanceOf(ArrayBuffer);
    expect((binWritten as ArrayBuffer).byteLength).toBe(800);
    expect(typeof jsonWritten).toBe("string");
    expect(JSON.parse(jsonWritten as string).bg_events).toHaveLength(1);
    expect(editorStore.getState().dirty).toBe(false);
    expect(editorStore.getState().mapJsonDirty).toBe(false);
    expect(workspace.files.has(binPath)).toBe(true);
    expect(workspace.files.has(jsonPath)).toBe(true);
  });
});
