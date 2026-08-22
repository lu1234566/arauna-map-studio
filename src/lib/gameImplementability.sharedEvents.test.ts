import { describe, expect, it } from "vitest";
import { buildCityBundle, type FingerprintAtlas } from "./araunaCityBundle";
import { withSharedEventsSnapshot } from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import { auditGameImplementability } from "./gameImplementability";
import { sharedEventsContextKey } from "./workspaceAuditContext";

const atlas: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  records: [{ id: 1, behavior: 0x00, layerType: 0 }],
};

function map(): MapData {
  return {
    width: 5,
    height: 5,
    metatiles: Uint16Array.from({ length: 25 }, () => 1),
    physical: Uint16Array.from({ length: 25 }, () => 0x3000),
  };
}

function baseHeader(id: string, name: string, layout: string): EditableMapJson {
  return {
    id,
    name,
    layout,
    music: "MUS_CONTEST",
    region_map_section: "MAPSEC_DYNAMIC",
    requires_flash: false,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_INDOOR",
    allow_cycling: false,
    allow_escaping: false,
    allow_running: false,
    show_map_name: false,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: null,
  };
}

function consumer(): EditableMapJson {
  return {
    ...baseHeader("MAP_CONTEST_HALL_CUTE", "ContestHallCute", "LAYOUT_CONTEST_HALL_CUTE"),
    shared_events_map: "ContestHall",
    shared_scripts_map: "ContestHall",
  };
}

function source(x = 2): EditableMapJson {
  return {
    ...baseHeader("MAP_CONTEST_HALL", "ContestHall", "LAYOUT_CONTEST_HALL"),
    object_events: [
      {
        local_id: "LOCALID_CONTEST_MC",
        graphics_id: "OBJ_EVENT_GFX_WOMAN_3",
        x,
        y: 2,
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

function codes(report: ReturnType<typeof auditGameImplementability>) {
  return report.issues.map((issue) => issue.code);
}

describe("shared_events_map implementability", () => {
  it("audits shared NPCs against the consumer layout, not the empty local arrays", () => {
    const currentMap = map();
    currentMap.physical[2 * currentMap.width + 2] = 0x3400;
    const mapJson = consumer();
    const shared = source();
    const report = auditGameImplementability({
      map: currentMap,
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_CONTEST_HALL_CUTE",
        maps: {
          MAP_CONTEST_HALL_CUTE: { map: currentMap, mapJson, width: 5, height: 5, atlas },
          [sharedEventsContextKey("ContestHall")]: { mapJson: shared },
        },
      },
    });
    expect(codes(report)).toContain("SHARED_EVENTS_LOADED");
    expect(codes(report)).toContain("NPC_BLOCKED");
    expect(report.pass).toBe(false);
  });

  it("uses an integrity-checked bundle snapshot when the Workspace source is unavailable", () => {
    const currentMap = map();
    const mapJson = consumer();
    const semantics = withSharedEventsSnapshot(undefined, "ContestHall", source());
    const bundle = buildCityBundle({ map: currentMap, mapJson, atlas, semantics });
    const report = auditGameImplementability({
      map: currentMap,
      mapJson,
      atlas,
      bundle,
      declaredTilesets: bundle.tilesets,
    });
    expect(codes(report)).toContain("SHARED_EVENTS_LOADED");
    expect(codes(report)).not.toContain("SHARED_EVENTS_UNVERIFIED");
    expect(codes(report)).not.toContain("BUNDLE_SHARED_EVENTS_MISSING");
    // Continua parcial sem layouts.json real/neighbor context.
    expect(report.implementable).toBe(false);
  });

  it("rejects a shared map bundle that omitted its external dependency snapshot", () => {
    const currentMap = map();
    const mapJson = consumer();
    const bundle = buildCityBundle({ map: currentMap, mapJson, atlas });
    const report = auditGameImplementability({
      map: currentMap,
      mapJson,
      atlas,
      bundle,
      declaredTilesets: bundle.tilesets,
    });
    expect(codes(report)).toContain("BUNDLE_SHARED_EVENTS_MISSING");
    expect(report.pass).toBe(false);
  });

  it("detects a stale snapshot when the Workspace source changed after bundle export", () => {
    const currentMap = map();
    const mapJson = consumer();
    const semantics = withSharedEventsSnapshot(undefined, "ContestHall", source(2));
    const bundle = buildCityBundle({ map: currentMap, mapJson, atlas, semantics });
    const changedSource = source(3);
    const report = auditGameImplementability({
      map: currentMap,
      mapJson,
      atlas,
      bundle,
      declaredTilesets: bundle.tilesets,
      workspaceContext: {
        sourceMapId: "MAP_CONTEST_HALL_CUTE",
        maps: {
          MAP_CONTEST_HALL_CUTE: { map: currentMap, mapJson, width: 5, height: 5, atlas },
          [sharedEventsContextKey("ContestHall")]: { mapJson: changedSource },
        },
      },
    });
    expect(codes(report)).toContain("SHARED_EVENTS_SNAPSHOT_STALE");
    expect(report.pass).toBe(false);
  });

  it("warns that local event arrays are ignored when shared_events_map is present", () => {
    const currentMap = map();
    const mapJson = consumer();
    mapJson.object_events = [
      {
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
    ];
    const report = auditGameImplementability({
      map: currentMap,
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_CONTEST_HALL_CUTE",
        maps: {
          MAP_CONTEST_HALL_CUTE: { map: currentMap, mapJson, width: 5, height: 5, atlas },
          [sharedEventsContextKey("ContestHall")]: { mapJson: source() },
        },
      },
    });
    expect(codes(report)).toContain("SHARED_EVENTS_LOCAL_EVENTS_IGNORED");
    expect(report.implementable).toBe(false);
  });
});
