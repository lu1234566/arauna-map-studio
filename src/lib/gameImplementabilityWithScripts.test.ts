import { afterEach, describe, expect, it } from "vitest";
import { buildCityBundle, type FingerprintAtlas } from "./araunaCityBundle";
import {
  clearBundleDependencyContext,
  installBundleDependencyContextFromImport,
} from "./bundleDependencyContext";
import { withScriptSpatialSnapshot, withSharedEventsSnapshot } from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type { GameImplementabilityReport, ImplementabilityCategory } from "./gameImplementability";
import { withActiveScriptSpatialAudit } from "./gameImplementabilityWithScripts";
import type { AraunaWorkspace, WorkspaceLayout, WorkspaceMap } from "./repoWorkspace";
import {
  clearScriptSpatialContext,
  installScriptSpatialContextFromBundle,
  refreshScriptSpatialContext,
} from "./scriptSpatialContext";
import { clearWorkspaceAuditContext, setWorkspaceAuditContext } from "./workspaceAuditContext";

const CATEGORIES: ImplementabilityCategory[] = [
  "grid",
  "tilesets",
  "mapJson",
  "warps",
  "npcs",
  "triggers",
  "connections",
  "accessibility",
  "weather",
  "roundtrip",
];

const COMMON_MOVEMENTS = `
Common_Movement_WalkUp:
  walk_up
  step_end
Common_Movement_FaceRight:
  face_right
  step_end
`;

const TEST_ATLAS: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Petalburg",
  records: [{ id: 1, behavior: 0, layerType: 0 }],
};

function baseReport(): GameImplementabilityReport {
  return {
    pass: true,
    implementable: true,
    confidence: "full",
    fullyVerified: true,
    issues: [],
    categories: Object.fromEntries(
      CATEGORIES.map((category) => [category, { errors: 0, warnings: 0, info: 0 }]),
    ) as GameImplementabilityReport["categories"],
    counts: { errors: 0, warnings: 0, info: 0 },
  };
}

function openMap(): MapData {
  return {
    width: 5,
    height: 5,
    metatiles: Uint16Array.from({ length: 25 }, () => 1),
    physical: Uint16Array.from({ length: 25 }, () => 0x3000),
  };
}

function document(): EditableMapJson {
  return {
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
    object_events: [
      {
        local_id: "LOCALID_A",
        graphics_id: "OBJ_EVENT_GFX_MAN_1",
        x: 1,
        y: 1,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "A_EventScript",
        flag: "0",
      },
    ],
  };
}

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function layout(id: string, name: string, width = 5, height = 5): WorkspaceLayout {
  return {
    id,
    name,
    width,
    height,
    primary_tileset: "gTileset_General",
    secondary_tileset: "gTileset_Petalburg",
    border_filepath: "",
    blockdata_filepath: `data/layouts/${name}/map.bin`,
  };
}

function workspace(source: string): AraunaWorkspace {
  const descriptor: WorkspaceMap = {
    path: "data/maps/A/map.json",
    directory: "A",
    id: "MAP_A",
    name: "A",
    layoutId: "LAYOUT_A",
  };
  const script = fakeFile(source);
  const common = fakeFile(COMMON_MOVEMENTS);
  return {
    files: new Map([
      ["data/maps/A/scripts.inc", script],
      ["data/scripts/movement.inc", common],
    ]),
    filesLower: new Map([
      ["data/maps/a/scripts.inc", script],
      ["data/scripts/movement.inc", common],
    ]),
    layouts: new Map(),
    maps: [descriptor],
    tilesets: [],
  };
}

function workspaceWithDestination(
  source: string,
  destination: EditableMapJson,
  destinationWidth = 5,
  destinationHeight = 5,
): AraunaWorkspace {
  const base = workspace(source);
  const targetLayout = layout("LAYOUT_B", "B", destinationWidth, destinationHeight);
  const target: WorkspaceMap = {
    path: "data/maps/B/map.json",
    directory: "B",
    id: "MAP_B",
    name: "B",
    layoutId: "LAYOUT_B",
    layout: targetLayout,
  };
  const targetFile = fakeFile(JSON.stringify(destination));
  base.maps.push(target);
  base.layouts.set(targetLayout.id, targetLayout);
  base.files.set(target.path, targetFile);
  base.filesLower.set(target.path.toLowerCase(), targetFile);
  return base;
}

function installDestinationAuditContext(
  sourceMapJson: EditableMapJson,
  destination: EditableMapJson,
  targetMap = openMap(),
) {
  setWorkspaceAuditContext({
    sourceMapId: "MAP_A",
    maps: {
      MAP_A: { mapJson: sourceMapJson },
      MAP_B: {
        mapJson: destination,
        width: targetMap.width,
        height: targetMap.height,
        map: targetMap,
        atlas: TEST_ATLAS,
      },
    },
  });
}

function has(report: GameImplementabilityReport, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

afterEach(() => {
  clearScriptSpatialContext();
  clearBundleDependencyContext();
  clearWorkspaceAuditContext();
});

describe("withActiveScriptSpatialAudit", () => {
  it("keeps Game-ready when every declared runtime anchor is valid", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.implementable).toBe(true);
    expect(report.fullyVerified).toBe(true);
    expect(has(report, "SCRIPT_SPATIAL_SOURCE_OK")).toBe(true);
    expect(has(report, "SCRIPT_OBJECT_ANCHOR_OK")).toBe(true);
  });

  it("resolves Common_Movement definitions from data/scripts/movement.inc", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A::\n\tapplymovement LOCALID_A, Common_Movement_WalkUp\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.implementable).toBe(true);
    expect(has(report, "SCRIPT_MOVEMENT_DEFINITION_EXTERNAL")).toBe(false);
    expect(has(report, "SCRIPT_MOVEMENT_HAS_SAFE_PATH")).toBe(true);
  });

  it("downgrades a runtime anchor that would place an NPC on collision", async () => {
    const mapJson = document();
    const map = openMap();
    map.physical[2 * map.width + 2] = 0x3400;
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), map, mapJson);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(report.counts.warnings).toBe(1);
    expect(has(report, "SCRIPT_OBJECT_ANCHOR_BLOCKED")).toBe(true);
  });

  it("blocks scripts that reference an object LOCALID removed from effective events", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_REMOVED, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_OBJECT_LOCALID_MISSING")).toBe(true);
  });

  it("certifies a script warp id and its real destination spawn cell", async () => {
    const mapJson = document();
    const destination: EditableMapJson = {
      id: "MAP_B",
      name: "B",
      layout: "LAYOUT_B",
      warp_events: [{ x: 1, y: 1, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" }],
    };
    await refreshScriptSpatialContext(
      workspaceWithDestination("A::\n\twarp MAP_B, 0\n\tend\n", destination),
      mapJson,
    );
    installDestinationAuditContext(mapJson, destination);

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.implementable).toBe(true);
    expect(has(report, "SCRIPT_WARP_DEST_ID_AND_SPAWN_OK")).toBe(true);
  });

  it("blocks a script warp whose destination event exists but spawn cell is blocked", async () => {
    const mapJson = document();
    const destination: EditableMapJson = {
      id: "MAP_B",
      name: "B",
      layout: "LAYOUT_B",
      warp_events: [{ x: 1, y: 1, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" }],
    };
    await refreshScriptSpatialContext(
      workspaceWithDestination("A::\n\twarp MAP_B, 0\n\tend\n", destination),
      mapJson,
    );
    const blockedTarget = openMap();
    blockedTarget.physical[1 * blockedTarget.width + 1] = 0x3400;
    installDestinationAuditContext(mapJson, destination, blockedTarget);

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_WARP_DEST_SPAWN_BLOCKED")).toBe(true);
  });

  it("blocks a script warp id that does not exist in the destination", async () => {
    const mapJson = document();
    const destination: EditableMapJson = {
      id: "MAP_B",
      name: "B",
      layout: "LAYOUT_B",
      warp_events: [],
    };
    await refreshScriptSpatialContext(
      workspaceWithDestination("A::\n\twarp MAP_B, 3\n\tend\n", destination),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_WARP_DEST_ID_OUT_OF_RANGE")).toBe(true);
  });

  it("blocks direct script warp coordinates outside the destination layout", async () => {
    const mapJson = document();
    const destination: EditableMapJson = {
      id: "MAP_B",
      name: "B",
      layout: "LAYOUT_B",
      warp_events: [],
    };
    await refreshScriptSpatialContext(
      workspaceWithDestination("A::\n\twarp MAP_B, 8, 2\n\tend\n", destination, 5, 5),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.pass).toBe(false);
    expect(has(report, "SCRIPT_WARP_DEST_COORDS_OUT_OF_BOUNDS")).toBe(true);
  });

  it("refuses a stale scripts context after map.json identity object changes", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );
    const edited = { ...mapJson };

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), edited);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_SPATIAL_CONTEXT_STALE")).toBe(true);
  });

  it("uses bundled shared events when a self-contained city is audited without Workspace", () => {
    const consumer: EditableMapJson = {
      id: "MAP_CHILD",
      name: "Child",
      layout: "LAYOUT_CHILD",
      shared_events_map: "Shared",
      shared_scripts_map: "Shared",
    };
    const shared: EditableMapJson = {
      id: "MAP_SHARED",
      name: "Shared",
      layout: "LAYOUT_SHARED",
      object_events: [
        {
          local_id: "LOCALID_A",
          graphics_id: "OBJ_EVENT_GFX_MAN_1",
          x: 1,
          y: 1,
          elevation: 3,
          movement_type: "MOVEMENT_TYPE_FACE_DOWN",
          movement_range_x: 0,
          movement_range_y: 0,
          trainer_type: "TRAINER_TYPE_NONE",
          trainer_sight_or_berry_tree_id: "0",
          script: "0x0",
          flag: "0",
        },
      ],
      warp_events: [],
      coord_events: [],
      bg_events: [],
    };
    const scriptSource = "Shared::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n";
    const sharedSemantics = withSharedEventsSnapshot(undefined, "Shared", shared);
    const semantics = withScriptSpatialSnapshot(
      sharedSemantics,
      "Shared",
      "data/maps/Shared/scripts.inc + data/scripts/movement.inc",
      `${scriptSource}\n@ ARAUNA_AUDIT_SUPPORT_SOURCE data/scripts/movement.inc\n${COMMON_MOVEMENTS}`,
    );
    const bundle = buildCityBundle({ map: openMap(), mapJson: consumer, semantics });
    const installedDocument = { ...bundle.mapJson };
    installBundleDependencyContextFromImport(bundle, installedDocument);
    installScriptSpatialContextFromBundle(bundle, installedDocument);

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), installedDocument);
    expect(report.implementable).toBe(true);
    expect(has(report, "SCRIPT_SPATIAL_EFFECTIVE_EVENTS_UNVERIFIED")).toBe(false);
    expect(has(report, "SCRIPT_OBJECT_ANCHOR_OK")).toBe(true);
  });

  it("downgrades a standalone bundle that references an external script-warp destination", () => {
    const mapJson = document();
    const semantics = withScriptSpatialSnapshot(
      undefined,
      "A",
      "data/maps/A/scripts.inc + data/scripts/movement.inc",
      `A::\n\twarp MAP_B, 0\n\tend\n\n@ ARAUNA_AUDIT_SUPPORT_SOURCE data/scripts/movement.inc\n${COMMON_MOVEMENTS}`,
    );
    const bundle = buildCityBundle({ map: openMap(), mapJson, semantics });
    const installedDocument = { ...bundle.mapJson };
    installScriptSpatialContextFromBundle(bundle, installedDocument);

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), installedDocument);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_WARP_DEST_UNVERIFIED")).toBe(true);
  });
});
