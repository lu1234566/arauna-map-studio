import { describe, expect, it } from "vitest";
import { buildCityBundle, serializeCityBundle } from "./araunaCityBundle";
import { editorStore } from "./editorStore";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";

function fixture() {
  const map: MapData = {
    width: 3,
    height: 3,
    metatiles: Uint16Array.from({ length: 9 }, () => 1),
    physical: Uint16Array.from({ length: 9 }, () => 0x3000),
  };
  const mapJson: EditableMapJson = {
    id: "MAP_ATOMIC_TEST",
    name: "AtomicTest",
    layout: "LAYOUT_ATOMIC_TEST",
    music: "MUS_SLATEPORT",
    region_map_section: "MAPSEC_SLATEPORT_CITY",
    weather: "WEATHER_SUNNY",
    map_type: "MAP_TYPE_CITY",
    requires_flash: false,
    allow_cycling: true,
    allow_escaping: false,
    allow_running: true,
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [],
    warp_events: [],
    object_events: [
      {
        local_id: "LOCALID_Z",
        graphics_id: "OBJ_EVENT_GFX_MAN_1",
        x: 1,
        y: 1,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_UP",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Atomic_EventScript_Z",
        flag: "0",
      },
      {
        local_id: "LOCALID_A",
        graphics_id: "OBJ_EVENT_GFX_WOMAN_1",
        x: 2,
        y: 1,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_LEFT",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Atomic_EventScript_A",
        flag: "0",
      },
    ],
    coord_events: [],
    bg_events: [],
    custom_field: "preserve-me",
  };
  return { map, mapJson };
}

describe("editorStore Arauna City atomic import", () => {
  it("does not mutate state/history on failure and groups a valid import into one undo", () => {
    const initial = editorStore.getState();
    const initialUndoDepth = initial.undoDepth;
    const invalid = editorStore.importCityBundle("{ definitely-not-json", "broken.arauna-city.json");
    expect(invalid.ok).toBe(false);
    expect(editorStore.getState()).toBe(initial);
    expect(editorStore.getState().undoDepth).toBe(initialUndoDepth);

    const { map, mapJson } = fixture();
    const bundle = buildCityBundle({ map, mapJson, mapName: "Atomic city", createdAt: "2026-08-21T00:00:00.000Z" });
    const imported = editorStore.importCityBundle(serializeCityBundle(bundle), "atomic.arauna-city.json");
    expect(imported.ok).toBe(true);
    const after = editorStore.getState();
    expect(after.map.width).toBe(3);
    expect(after.map.height).toBe(3);
    expect(after.undoDepth).toBe(initialUndoDepth + 1);
    expect(after.mapName).toBe("Atomic city");
    expect(after.mapJsonDocument?.custom_field).toBe("preserve-me");
    expect((after.mapJsonDocument?.object_events as Array<Record<string, unknown>>).map((event) => event.local_id)).toEqual([
      "LOCALID_Z",
      "LOCALID_A",
    ]);

    editorStore.undo();
    const restored = editorStore.getState();
    expect(restored.map.width).toBe(initial.map.width);
    expect(restored.map.height).toBe(initial.map.height);
    expect(restored.mapName).toBe(initial.mapName);
    expect(restored.sourceFile).toBe(initial.sourceFile);
    expect(restored.mapJsonSource).toBe(initial.mapJsonSource);
    expect(restored.mapJsonDocument).toEqual(initial.mapJsonDocument);
    expect(restored.undoDepth).toBe(initialUndoDepth);
  });

  it("accepts real Emerald Dive/Emerge connections in quick validation without coercing them", () => {
    const initial = editorStore.getState();
    const { map, mapJson } = fixture();
    mapJson.connections = [
      { map: "MAP_UNDERWATER_TEST", offset: 0, direction: "dive" },
      { map: "MAP_SURFACE_TEST", offset: 0, direction: "emerge" },
    ];

    const bundle = buildCityBundle({
      map,
      mapJson,
      mapName: "Special connections",
      createdAt: "2026-08-21T00:00:00.000Z",
    });
    const imported = editorStore.importCityBundle(
      serializeCityBundle(bundle),
      "special-connections.arauna-city.json",
    );
    expect(imported.ok).toBe(true);

    const validation = editorStore.runValidation();
    expect(validation.issues.some((issue) => issue.message.includes("direção inválida"))).toBe(false);
    const directions = (editorStore.getState().mapJsonDocument?.connections as Array<Record<string, unknown>>)
      .map((connection) => connection.direction);
    expect(directions).toEqual(["dive", "emerge"]);

    editorStore.undo();
    expect(editorStore.getState().mapName).toBe(initial.mapName);
    expect(editorStore.getState().mapJsonDocument).toEqual(initial.mapJsonDocument);
  });
});
