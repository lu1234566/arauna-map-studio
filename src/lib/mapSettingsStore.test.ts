import { beforeEach, describe, expect, it } from "vitest";
import { editorStore } from "./editorStore";

const MAP_JSON = JSON.stringify({
  id: "MAP_TEST",
  name: "Test",
  layout: "LAYOUT_TEST",
  music: "MUS_ROUTE101",
  region_map_section: "MAPSEC_ROUTE_101",
  requires_flash: false,
  weather: "WEATHER_SUNNY",
  map_type: "MAP_TYPE_ROUTE",
  allow_cycling: true,
  allow_escaping: false,
  allow_running: true,
  show_map_name: true,
  battle_scene: "MAP_BATTLE_SCENE_NORMAL",
  connections: [{ map: "MAP_ROUTE102", offset: 0, direction: "up" }],
  object_events: [],
  warp_events: [],
  coord_events: [],
  bg_events: [],
});

beforeEach(() => {
  editorStore.newMap();
  editorStore.importBufferSized(new ArrayBuffer(800), "data/layouts/Test/map.bin", 20, 20);
  editorStore.importMapJson(MAP_JSON, "data/maps/Test/map.json");
});

describe("map settings editor store", () => {
  it("updates settings through shared undo/redo and marks JSON dirty", () => {
    expect(editorStore.updateMapSetting("weather", "WEATHER_RAIN")).toBe(true);
    expect(editorStore.getState().mapJsonDocument?.weather).toBe("WEATHER_RAIN");
    expect(editorStore.getState().mapJsonDirty).toBe(true);

    editorStore.undo();
    expect(editorStore.getState().mapJsonDocument?.weather).toBe("WEATHER_SUNNY");
    expect(editorStore.getState().mapJsonDirty).toBe(false);

    editorStore.redo();
    expect(editorStore.getState().mapJsonDocument?.weather).toBe("WEATHER_RAIN");
    expect(editorStore.getState().mapJsonDirty).toBe(true);
  });

  it("creates, edits and removes connections", () => {
    const created = editorStore.createConnection("left");
    expect(created).toBe(1);
    expect(editorStore.getState().mapMetadata?.connections).toHaveLength(2);

    expect(editorStore.updateConnection(1, "map", "MAP_ROUTE103")).toBe(true);
    expect(editorStore.updateConnection(1, "offset", "-4")).toBe(true);
    expect(editorStore.getState().mapMetadata?.connections[1]).toEqual({
      map: "MAP_ROUTE103",
      direction: "left",
      offset: -4,
    });

    expect(editorStore.removeConnection(0)).toBe(true);
    expect(editorStore.getState().mapMetadata?.connections).toHaveLength(1);
    expect(editorStore.getState().mapMetadata?.connections[0]?.map).toBe("MAP_ROUTE103");
  });

  it("rejects invalid connection directions", () => {
    expect(editorStore.updateConnection(0, "direction", "diagonal")).toBe(false);
    expect(editorStore.getState().mapMetadata?.connections[0]?.direction).toBe("up");
  });

  it("clears stale JSON metadata when a new BIN is opened first", () => {
    expect(editorStore.getState().mapMetadata?.id).toBe("MAP_TEST");
    expect(editorStore.getState().mapJsonDocument).not.toBeNull();

    const next = editorStore.importBufferSized(
      new ArrayBuffer(32 * 24 * 2),
      "data/layouts/Other/map.bin",
      32,
      24,
    );
    expect(next.ok).toBe(true);
    expect(editorStore.getState().mapMetadata).toBeNull();
    expect(editorStore.getState().mapJsonDocument).toBeNull();
    expect(editorStore.getState().events).toEqual([]);
    expect(editorStore.getState().protectedCells).toEqual([]);
    expect(editorStore.getState().mapJsonSource).toBeNull();
  });
});
