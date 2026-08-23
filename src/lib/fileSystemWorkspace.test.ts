import { describe, expect, it } from "vitest";
import { editorStore } from "./editorStore";
import {
  pickWritableAraunaWorkspace,
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
      return new File([""], name);
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

function readonlyHandle(name: string, source: string): FileHandleLike {
  return {
    kind: "file",
    name,
    async getFile() {
      return new File([source], name, { type: "text/plain" });
    },
    async createWritable() {
      throw new Error("read-only fixture");
    },
  };
}

function treeDirectory(
  name: string,
  children: Record<string, FileHandleLike | DirectoryHandleLike>,
): DirectoryHandleLike {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const entry of Object.entries(children)) yield entry;
    },
    async getDirectoryHandle(childName: string) {
      const child = children[childName];
      if (!child || child.kind !== "directory") throw new Error(`missing ${childName}`);
      return child;
    },
    async queryPermission() {
      return "granted";
    },
  };
}

describe("writable workspace source coverage", () => {
  it("loads include and generated region-map sources for audit without granting write handles", async () => {
    const dataRoot = treeDirectory("data", {
      maps: treeDirectory("maps", {
        Test: treeDirectory("Test", {
          "map.json": readonlyHandle("map.json", '{"id":"MAP_TEST"}'),
        }),
      }),
    });
    const includeRoot = treeDirectory("include", {
      constants: treeDirectory("constants", {
        "flags.h": readonlyHandle("flags.h", "#define FLAG_TEST 1\n"),
      }),
    });
    const regionMapRoot = treeDirectory("region_map", {
      "region_map_sections.json": readonlyHandle(
        "region_map_sections.json",
        '{"map_sections":[{"id":"MAPSEC_TEST","name":"TEST"}]}',
      ),
    });
    const srcRoot = treeDirectory("src", {
      data: treeDirectory("data", { region_map: regionMapRoot }),
    });
    const root = treeDirectory("pokemon-juramento-de-arauna", {
      data: dataRoot,
      include: includeRoot,
      src: srcRoot,
    });

    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { showDirectoryPicker: async () => root },
    });

    try {
      const selection = await pickWritableAraunaWorkspace();
      const paths = selection.files.map(
        (file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath,
      );
      expect(paths).toContain("data/maps/Test/map.json");
      expect(paths).toContain("include/constants/flags.h");
      expect(paths).toContain("src/data/region_map/region_map_sections.json");
      expect(selection.access.fileHandles.has("data/maps/Test/map.json")).toBe(true);
      expect(selection.access.fileHandles.has("include/constants/flags.h")).toBe(false);
      expect(selection.access.fileHandles.has("src/data/region_map/region_map_sections.json")).toBe(
        false,
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});

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
    const binHandle = writableHandle("map.bin", (value) => {
      binWritten = value;
    });
    const jsonHandle = writableHandle("map.json", (value) => {
      jsonWritten = value;
    });
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
