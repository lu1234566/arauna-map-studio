import { describe, expect, it } from "vitest";
import { buildCityBundle, type AraunaCityBundle } from "./araunaCityBundle";
import {
  buildSharedEventsSnapshot,
  sharedEventsSnapshotFromBundle,
  validateBundleDependencies,
  withSharedEventsSnapshot,
} from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";

function map(): MapData {
  return {
    width: 4,
    height: 4,
    metatiles: Uint16Array.from({ length: 16 }, () => 1),
    physical: Uint16Array.from({ length: 16 }, () => 0x3000),
  };
}

function consumer(): EditableMapJson {
  return {
    id: "MAP_CONTEST_HALL_CUTE",
    name: "ContestHallCute",
    layout: "LAYOUT_CONTEST_HALL_CUTE",
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
    shared_events_map: "ContestHall",
    shared_scripts_map: "ContestHall",
  };
}

function sharedSource(): EditableMapJson {
  return {
    id: "MAP_CONTEST_HALL",
    name: "ContestHall",
    layout: "LAYOUT_CONTEST_HALL",
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
    object_events: [
      {
        local_id: "LOCALID_CONTEST_MC",
        graphics_id: "OBJ_EVENT_GFX_WOMAN_3",
        x: 2,
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

function withSnapshot(): AraunaCityBundle {
  const semantics = withSharedEventsSnapshot(undefined, "ContestHall", sharedSource());
  return buildCityBundle({ map: map(), mapJson: consumer(), semantics });
}

describe("city bundle external dependencies", () => {
  it("stores a full, checksummed read-only shared event snapshot", () => {
    const bundle = withSnapshot();
    const snapshot = sharedEventsSnapshotFromBundle(bundle);
    expect(snapshot?.name).toBe("ContestHall");
    expect(snapshot?.mapJson.name).toBe("ContestHall");
    expect(snapshot?.protectedCells).toEqual([
      { x: 2, y: 2, reason: "LOCALID_CONTEST_MC: NPC/object spawn" },
    ]);
    expect(validateBundleDependencies(bundle)).toEqual([]);
  });

  it("detects missing, mislabeled and tampered shared event dependencies", () => {
    const missing = buildCityBundle({ map: map(), mapJson: consumer() });
    expect(validateBundleDependencies(missing).map((issue) => issue.code)).toContain(
      "BUNDLE_SHARED_EVENTS_MISSING",
    );

    const wrongName = withSnapshot();
    const wrongSnapshot = sharedEventsSnapshotFromBundle(wrongName)!;
    wrongSnapshot.name = "OtherHall";
    expect(validateBundleDependencies(wrongName).map((issue) => issue.code)).toContain(
      "BUNDLE_SHARED_EVENTS_NAME_MISMATCH",
    );

    const tampered = withSnapshot();
    const snapshot = sharedEventsSnapshotFromBundle(tampered)!;
    (snapshot.mapJson.object_events as Array<Record<string, unknown>>)[0]!.x = 3;
    expect(validateBundleDependencies(tampered).map((issue) => issue.code)).toContain(
      "BUNDLE_SHARED_EVENTS_CHECKSUM",
    );
  });

  it("does not allow an unrelated snapshot on a map without shared_events_map", () => {
    const ordinary = consumer();
    delete ordinary.shared_events_map;
    const semantics = withSharedEventsSnapshot(undefined, "ContestHall", sharedSource());
    const bundle = buildCityBundle({ map: map(), mapJson: ordinary, semantics });
    expect(validateBundleDependencies(bundle).map((issue) => issue.code)).toContain(
      "BUNDLE_SHARED_EVENTS_UNEXPECTED",
    );
  });

  it("buildSharedEventsSnapshot derives integrity from the source, never caller summaries", () => {
    const snapshot = buildSharedEventsSnapshot("ContestHall", sharedSource());
    expect(snapshot.mapJsonChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(snapshot.protectedCells).toHaveLength(1);
  });
});
