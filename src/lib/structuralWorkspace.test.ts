import { describe, expect, it } from "vitest";
import type {
  DirectoryHandleLike,
  FileHandleLike,
  WritableFileStreamLike,
  WritableWorkspaceAccess,
} from "./fileSystemWorkspace";
import type { AraunaWorkspace } from "./repoWorkspace";
import { StructuralWorkspaceError, writeStructuralFiles } from "./structuralWorkspace";

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
            pending = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
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

describe("structural workspace writes", () => {
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
      { path: "data/layouts/Test/map.bin", data: new TextEncoder().encode("new-a").buffer as ArrayBuffer },
      { path: "data/layouts/layouts.json", data: "new-b" },
    ]);
    expect(saved).toEqual(["data/layouts/Test/map.bin", "data/layouts/layouts.json"]);
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
    await expect(writeStructuralFiles(emptyWorkspace(), access, [
      { path: "data/layouts/Test/map.bin", data: "new-a" },
      { path: "data/maps/Test/map.json", data: "new-b" },
    ])).rejects.toBeInstanceOf(StructuralWorkspaceError);
    expect(a.text()).toBe("old-a");
    expect(b.text()).toBe("old-b");
  });
});
