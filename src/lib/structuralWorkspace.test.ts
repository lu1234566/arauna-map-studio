import { describe, expect, it } from "vitest";
import type {
  DirectoryHandleLike,
  FileHandleLike,
  WritableFileStreamLike,
  WritableWorkspaceAccess,
} from "./fileSystemWorkspace";
import { createEmptyMap } from "./emeraldMap";
import { parseEditableMapJson } from "./eventMapJson";
import { resizeMapData } from "./layoutStructure";
import type { AraunaWorkspace, WorkspaceLayout, WorkspaceMap } from "./repoWorkspace";
import {
  StructuralWorkspaceError,
  buildStructuralDraft,
  writeStructuralFiles,
  type StructuralSource,
} from "./structuralWorkspace";

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

function memoryHandle(name: string, initial: string, failFirstWrite = false) {
  let bytes = new TextEncoder().encode(initial).slice().buffer as ArrayBuffer;
  let shouldFail = failFirstWrite;
  const handle: FileHandleLike = {
    kind: "file",
    name,
    async getFile() {
      return {
        name,
        async arrayBuffer() {
          return bytes.slice(0);
        },
      } as File;
    },
    async createWritable() {
      let pending = bytes;
      const stream: WritableFileStreamLike = {
        async write(value) {
          if (shouldFail) {
            shouldFail = false;
            throw new Error("simulated write failure");
          }
          if (typeof value === "string") {
            pending = new TextEncoder().encode(value).slice().buffer as ArrayBuffer;
          } else if (value instanceof ArrayBuffer) {
            pending = value.slice(0);
          } else if (value instanceof Blob) {
            pending = await value.arrayBuffer();
          } else {
            pending = value.buffer.slice(
              value.byteOffset,
              value.byteOffset + value.byteLength,
            ) as ArrayBuffer;
          }
        },
        async close() {
          bytes = pending;
        },
      };
      return stream;
    },
  };
  return {
    handle,
    text: () => new TextDecoder().decode(bytes),
  };
}

function emptyWorkspace(): AraunaWorkspace {
  return {
    files: new Map(),
    filesLower: new Map(),
    layouts: new Map(),
    maps: [],
    tilesets: [],
  };
}

function reciprocalSource(neighborOffset = -4): StructuralSource {
  const layout: WorkspaceLayout = {
    id: "LAYOUT_A",
    name: "A_Layout",
    width: 10,
    height: 10,
    primary_tileset: "gTileset_General",
    secondary_tileset: "gTileset_Petalburg",
    border_filepath: "",
    blockdata_filepath: "data/layouts/A/map.bin",
  };
  const mapEntry: WorkspaceMap = {
    path: "data/maps/A/map.json",
    directory: "A",
    id: "MAP_A",
    name: "A",
    layoutId: layout.id,
    layout,
  };
  const mapJsonSource = JSON.stringify({
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
    connections: [{ map: "MAP_B", offset: 4, direction: "right" }],
    object_events: [],
    warp_events: [],
    coord_events: [],
    bg_events: [],
  });
  const neighborSource = JSON.stringify({
    id: "MAP_B",
    name: "B",
    layout: "LAYOUT_B",
    connections: [{ map: "MAP_A", offset: neighborOffset, direction: "left" }],
    object_events: [],
    warp_events: [],
    coord_events: [],
    bg_events: [],
  });
  return {
    mapEntry,
    layout,
    map: createEmptyMap(10, 10, 1),
    mapJson: parseEditableMapJson(mapJsonSource),
    mapJsonSource,
    layoutsSource: JSON.stringify({
      layouts: [
        {
          id: "LAYOUT_A",
          name: "A_Layout",
          width: 10,
          height: 10,
          primary_tileset: "gTileset_General",
          secondary_tileset: "gTileset_Petalburg",
          border_filepath: "",
          blockdata_filepath: "data/layouts/A/map.bin",
        },
      ],
    }),
    border: null,
    neighbors: [
      {
        mapEntry: {
          path: "data/maps/B/map.json",
          directory: "B",
          id: "MAP_B",
          name: "B",
          layoutId: "LAYOUT_B",
        },
        source: neighborSource,
        document: parseEditableMapJson(neighborSource),
      },
    ],
  };
}

describe("structural workspace writes", () => {
  it("keeps reciprocal connection offsets symmetric when anchored content moves", () => {
    const source = reciprocalSource();
    const resize = resizeMapData(source.map, 10, 14, "bottom", 0);
    const draft = buildStructuralDraft(source, resize, null);
    const localConnections = draft.mapJson["connections"] as Array<Record<string, unknown>>;
    const neighborConnections = draft.neighbors[0]?.document["connections"] as Array<
      Record<string, unknown>
    >;

    expect(resize.dy).toBe(4);
    expect(localConnections[0]?.["offset"]).toBe(8);
    expect(neighborConnections[0]?.["offset"]).toBe(-8);
    expect(draft.adjustedConnections).toBe(1);
    expect(draft.reciprocalConnectionsAdjusted).toBe(1);
    expect(draft.reciprocalConnectionIssues).toEqual([]);
  });

  it("blocks an ambiguous or mismatched reciprocal connection instead of guessing", () => {
    const source = reciprocalSource(-3);
    const resize = resizeMapData(source.map, 10, 14, "bottom", 0);
    const draft = buildStructuralDraft(source, resize, null);
    expect(draft.reciprocalConnectionsAdjusted).toBe(0);
    expect(draft.reciprocalConnectionIssues).toHaveLength(1);
    expect(draft.reciprocalConnectionIssues[0]).toContain("offset -4");
  });

  it("writes all prevalidated structural files and refreshes cache", async () => {
    const a = memoryHandle("map.bin", "old-a");
    const b = memoryHandle("layouts.json", "old-b");
    const root = directory("repo");
    const access: WritableWorkspaceAccess = {
      root,
      dataRoot: directory("data"),
      label: "repo",
      fileHandles: new Map([
        ["data/layouts/Test/map.bin", a.handle],
        ["data/layouts/layouts.json", b.handle],
      ]),
      fileHandlesLower: new Map([
        ["data/layouts/test/map.bin", a.handle],
        ["data/layouts/layouts.json", b.handle],
      ]),
    };
    const workspace = emptyWorkspace();
    const saved = await writeStructuralFiles(workspace, access, [
      {
        path: "data/layouts/Test/map.bin",
        data: new TextEncoder().encode("new-a").buffer as ArrayBuffer,
      },
      { path: "data/layouts/layouts.json", data: "new-b" },
    ]);
    expect(saved).toEqual([
      "data/layouts/Test/map.bin",
      "data/layouts/layouts.json",
    ]);
    expect(a.text()).toBe("new-a");
    expect(b.text()).toBe("new-b");
    expect(workspace.files.has("data/layouts/Test/map.bin")).toBe(true);
  });

  it("rolls back files already written if a later write fails", async () => {
    const a = memoryHandle("map.bin", "old-a");
    const b = memoryHandle("map.json", "old-b", true);
    const access: WritableWorkspaceAccess = {
      root: directory("repo"),
      dataRoot: directory("data"),
      label: "repo",
      fileHandles: new Map([
        ["data/layouts/Test/map.bin", a.handle],
        ["data/maps/Test/map.json", b.handle],
      ]),
      fileHandlesLower: new Map([
        ["data/layouts/test/map.bin", a.handle],
        ["data/maps/test/map.json", b.handle],
      ]),
    };
    await expect(
      writeStructuralFiles(emptyWorkspace(), access, [
        { path: "data/layouts/Test/map.bin", data: "new-a" },
        { path: "data/maps/Test/map.json", data: "new-b" },
      ]),
    ).rejects.toBeInstanceOf(StructuralWorkspaceError);
    expect(a.text()).toBe("old-a");
    expect(b.text()).toBe("old-b");
  });
});
