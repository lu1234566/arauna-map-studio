import { afterEach, describe, expect, it } from "vitest";
import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  buildScriptSpatialContext,
  clearScriptSpatialContext,
  getScriptSpatialContext,
  refreshScriptSpatialContext,
} from "./scriptSpatialContext";

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function workspace(
  maps: WorkspaceMap[],
  files: Record<string, string>,
): AraunaWorkspace {
  const exact = new Map<string, File>();
  const lower = new Map<string, File>();
  for (const [path, source] of Object.entries(files)) {
    const file = fakeFile(source);
    exact.set(path, file);
    lower.set(path.toLowerCase(), file);
  }
  return {
    files: exact,
    filesLower: lower,
    layouts: new Map(),
    maps,
    tilesets: [],
  };
}

function mapDescriptor(id: string, name: string): WorkspaceMap {
  return {
    path: `data/maps/${name}/map.json`,
    directory: name,
    id,
    name,
    layoutId: `LAYOUT_${name.toUpperCase()}`,
  };
}

afterEach(() => clearScriptSpatialContext());

describe("scriptSpatialContext", () => {
  it("loads the current map scripts.inc when no shared_scripts_map exists", async () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
    };
    const ws = workspace(
      [mapDescriptor("MAP_A", "A")],
      {
        "data/maps/A/scripts.inc": "A_Script::\n\tsetobjectxyperm LOCALID_A, 2, 3\n\tend\n",
      },
    );

    const context = await buildScriptSpatialContext(ws, document);
    expect(context.error).toBeNull();
    expect(context.sourcePath).toBe("data/maps/A/scripts.inc");
    expect(context.contracts?.anchors).toHaveLength(1);
    expect(context.contracts?.anchors[0]).toMatchObject({ localId: "LOCALID_A", x: 2, y: 3 });
  });

  it("follows shared_scripts_map exactly like the generated MapHeader", async () => {
    const document: EditableMapJson = {
      id: "MAP_CONTEST_HALL_CUTE",
      name: "ContestHallCute",
      layout: "LAYOUT_CONTEST_HALL_CUTE",
      shared_scripts_map: "ContestHall",
    };
    const ws = workspace(
      [
        mapDescriptor("MAP_CONTEST_HALL_CUTE", "ContestHallCute"),
        mapDescriptor("MAP_CONTEST_HALL", "ContestHall"),
      ],
      {
        "data/maps/ContestHallCute/scripts.inc": "Wrong::\n\tsetobjectxyperm LOCALID_WRONG, 1, 1\n\tend\n",
        "data/maps/ContestHall/scripts.inc": "Shared::\n\tsetobjectxyperm LOCALID_SHARED, 4, 5\n\tend\n",
      },
    );

    const context = await refreshScriptSpatialContext(ws, document);
    expect(context?.scriptMapName).toBe("ContestHall");
    expect(context?.sourcePath).toBe("data/maps/ContestHall/scripts.inc");
    expect(context?.contracts?.anchors.map((anchor) => anchor.localId)).toEqual(["LOCALID_SHARED"]);
    expect(getScriptSpatialContext()).toBe(context);
  });

  it("keeps a failed lookup explicit instead of silently treating scripts as empty", async () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
      shared_scripts_map: "MissingShared",
    };
    const ws = workspace([mapDescriptor("MAP_A", "A")], {});
    const context = await buildScriptSpatialContext(ws, document);
    expect(context.contracts).toBeNull();
    expect(context.error).toMatch(/MissingShared/);
  });
});
