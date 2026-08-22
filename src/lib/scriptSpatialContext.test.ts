import { afterEach, describe, expect, it } from "vitest";
import { buildCityBundle } from "./araunaCityBundle";
import { withScriptSpatialSnapshot } from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  buildScriptSpatialContext,
  clearScriptSpatialContext,
  getScriptSpatialContext,
  installScriptSpatialContextFromBundle,
  refreshScriptSpatialContext,
} from "./scriptSpatialContext";

const COMMON_MOVEMENTS = `
Common_Movement_WalkUp:
  walk_up
  step_end
Common_Movement_FaceRight:
  face_right
  step_end
`;

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function workspace(maps: WorkspaceMap[], files: Record<string, string>): AraunaWorkspace {
  const exact = new Map<string, File>();
  const lower = new Map<string, File>();
  const allFiles = {
    "data/scripts/movement.inc": COMMON_MOVEMENTS,
    ...files,
  };
  for (const [path, source] of Object.entries(allFiles)) {
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

function smallMap(): MapData {
  return {
    width: 4,
    height: 4,
    metatiles: Uint16Array.from({ length: 16 }, () => 1),
    physical: Uint16Array.from({ length: 16 }, () => 0x3000),
  };
}

afterEach(() => clearScriptSpatialContext());

describe("scriptSpatialContext", () => {
  it("loads the current map scripts.inc together with common movement definitions", async () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
    };
    const ws = workspace([mapDescriptor("MAP_A", "A")], {
      "data/maps/A/scripts.inc":
        "A_Script::\n\tsetobjectxyperm LOCALID_A, 2, 3\n\tapplymovement LOCALID_A, Common_Movement_WalkUp\n\tend\n",
    });

    const context = await buildScriptSpatialContext(ws, document);
    expect(context.error).toBeNull();
    expect(context.sourcePath).toBe("data/maps/A/scripts.inc + data/scripts/movement.inc");
    expect(context.origin).toBe("workspace");
    expect(context.contracts?.anchors).toHaveLength(1);
    expect(context.contracts?.anchors[0]).toMatchObject({ localId: "LOCALID_A", x: 2, y: 3 });
    expect(context.contracts?.movements.Common_Movement_WalkUp?.steps).toHaveLength(1);
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
        "data/maps/ContestHallCute/scripts.inc":
          "Wrong::\n\tsetobjectxyperm LOCALID_WRONG, 1, 1\n\tend\n",
        "data/maps/ContestHall/scripts.inc":
          "Shared::\n\tsetobjectxyperm LOCALID_SHARED, 4, 5\n\tend\n",
      },
    );

    const context = await refreshScriptSpatialContext(ws, document);
    expect(context?.scriptMapName).toBe("ContestHall");
    expect(context?.sourcePath).toBe(
      "data/maps/ContestHall/scripts.inc + data/scripts/movement.inc",
    );
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

  it("fails closed when the common movement source is missing", async () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
    };
    const ws = workspace([mapDescriptor("MAP_A", "A")], {
      "data/maps/A/scripts.inc": "A::\n\tend\n",
    });
    ws.files.delete("data/scripts/movement.inc");
    ws.filesLower.delete("data/scripts/movement.inc");

    const context = await buildScriptSpatialContext(ws, document);
    expect(context.contracts).toBeNull();
    expect(context.error).toMatch(/movement\.inc/);
  });

  it("restores an internally validated combined scripts snapshot after a bundle import", () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
    };
    const source =
      "A_Script::\n\tsetobjectxyperm LOCALID_A, 2, 3\n\tend\n\n" +
      "@ ARAUNA_AUDIT_SUPPORT_SOURCE data/scripts/movement.inc\n" +
      COMMON_MOVEMENTS;
    const semantics = withScriptSpatialSnapshot(
      undefined,
      "A",
      "data/maps/A/scripts.inc + data/scripts/movement.inc",
      source,
    );
    const bundle = buildCityBundle({ map: smallMap(), mapJson: document, semantics });
    const installedDocument = { ...bundle.mapJson };

    const context = installScriptSpatialContextFromBundle(bundle, installedDocument);
    expect(context?.origin).toBe("bundle");
    expect(context?.source).toBe(source);
    expect(context?.contracts?.anchors[0]).toMatchObject({ localId: "LOCALID_A", x: 2, y: 3 });
    expect(context?.contracts?.movements.Common_Movement_WalkUp?.steps).toHaveLength(1);
    expect(context?.sourceDocument).toBe(installedDocument);
  });
});
