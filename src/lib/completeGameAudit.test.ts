import { afterEach, describe, expect, it } from "vitest";
import { buildCityBundle, type FingerprintAtlas } from "./araunaCityBundle";
import {
  clearBundleDependencyContext,
  installBundleDependencyContextFromImport,
} from "./bundleDependencyContext";
import {
  scriptSpatialSnapshotFromBundle,
  sharedEventsSnapshotFromBundle,
  withScriptSpatialSnapshot,
  withSharedEventsSnapshot,
} from "./cityBundleDependencies";
import { auditCompleteGameState } from "./completeGameAudit";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import {
  clearScriptSpatialContext,
  installScriptSpatialContextFromBundle,
} from "./scriptSpatialContext";
import {
  clearWorkspaceAuditContext,
  setWorkspaceAuditContext,
} from "./workspaceAuditContext";

const atlas: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  records: [{ id: 1, behavior: 0, layerType: 0 }],
};

function map(): MapData {
  return {
    width: 4,
    height: 4,
    metatiles: Uint16Array.from({ length: 16 }, () => 1),
    physical: Uint16Array.from({ length: 16 }, () => 0x3000),
  };
}

function child(): EditableMapJson {
  return {
    id: "MAP_CHILD",
    name: "Child",
    layout: "LAYOUT_CHILD",
    music: "MUS_SLATEPORT",
    region_map_section: "MAPSEC_SLATEPORT_CITY",
    requires_flash: false,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_INDOOR",
    allow_cycling: false,
    allow_escaping: false,
    allow_running: true,
    show_map_name: false,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: null,
    shared_events_map: "Shared",
    shared_scripts_map: "Shared",
  };
}

function shared(): EditableMapJson {
  return {
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
}

function importedBundle(document: EditableMapJson) {
  const sharedSemantics = withSharedEventsSnapshot(undefined, "Shared", shared());
  const semantics = withScriptSpatialSnapshot(
    sharedSemantics,
    "Shared",
    "data/maps/Shared/scripts.inc",
    "Shared::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n",
  );
  return buildCityBundle({ map: map(), mapJson: document, atlas, semantics });
}

function has(result: ReturnType<typeof auditCompleteGameState>, code: string) {
  return result.report.issues.some((issue) => issue.code === code);
}

afterEach(() => {
  clearBundleDependencyContext();
  clearScriptSpatialContext();
  clearWorkspaceAuditContext();
});

describe("auditCompleteGameState", () => {
  it("rebuilds a self-contained shared-events + scripts bundle from imported dependency contexts", () => {
    const original = child();
    const imported = importedBundle(original);
    const installedDocument = { ...imported.mapJson };
    installBundleDependencyContextFromImport(imported, installedDocument);
    installScriptSpatialContextFromBundle(imported, installedDocument);

    const result = auditCompleteGameState({
      map: map(),
      mapJson: installedDocument,
      mapName: "Child",
      atlas,
    });

    expect(result.bundle).not.toBeNull();
    expect(sharedEventsSnapshotFromBundle(result.bundle!)).not.toBeNull();
    expect(scriptSpatialSnapshotFromBundle(result.bundle!)).not.toBeNull();
    expect(has(result, "BUNDLE_SHARED_EVENTS_MISSING")).toBe(false);
    expect(has(result, "SCRIPT_SPATIAL_EFFECTIVE_EVENTS_UNVERIFIED")).toBe(false);
    expect(has(result, "SCRIPT_OBJECT_ANCHOR_OK")).toBe(true);
  });

  it("ignores a Workspace audit context created for another mapJson object with the same MAP id", () => {
    const current = child();
    const stale = { ...current };
    setWorkspaceAuditContext({
      sourceMapId: "MAP_CHILD",
      maps: {
        MAP_CHILD: {
          mapJson: stale,
          width: 4,
          height: 4,
          atlas,
        },
      },
    });

    const result = auditCompleteGameState({ map: map(), mapJson: current, atlas });
    expect(result.workspaceContext).toBeNull();
    expect(has(result, "ATLAS_LAYOUT_UNVERIFIED")).toBe(true);
  });
});
