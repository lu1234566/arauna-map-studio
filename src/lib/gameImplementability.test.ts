import { describe, expect, it } from "vitest";
import { buildCityBundle, type FingerprintAtlas } from "./araunaCityBundle";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import { auditGameImplementability } from "./gameImplementability";

const atlas: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  records: [{ id: 1, behavior: 0x00, layerType: 0 }],
};

function openMap(width = 5, height = 5): MapData {
  return {
    width,
    height,
    metatiles: Uint16Array.from({ length: width * height }, () => 1),
    physical: Uint16Array.from({ length: width * height }, () => 0x3000),
  };
}

function baseJson(id = "MAP_A"): EditableMapJson {
  return {
    id,
    name: id === "MAP_A" ? "A" : "B",
    layout: id === "MAP_A" ? "LAYOUT_A" : "LAYOUT_B",
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
    object_events: [],
    coord_events: [],
    bg_events: [],
  };
}

function has(report: ReturnType<typeof auditGameImplementability>, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

describe("game implementability audit", () => {
  it("can reach fully verified game-ready for a self-contained valid map", () => {
    const map = openMap();
    const mapJson = baseJson();
    const bundle = buildCityBundle({ map, mapJson, atlas, createdAt: "2026-08-21T00:00:00.000Z" });
    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      bundle,
      declaredTilesets: bundle.tilesets,
    });
    expect(report.counts.errors).toBe(0);
    expect(report.counts.warnings).toBe(0);
    expect(report.fullyVerified).toBe(true);
    expect(report.implementable).toBe(true);
    expect(has(report, "WEATHER_KNOWN")).toBe(true);
    expect(has(report, "ROUNDTRIP_OK")).toBe(true);
  });

  it("catches blocked and out-of-bounds warps plus invalid loaded destination", () => {
    const map = openMap();
    map.physical[1 * map.width + 1] = 0x3400;
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 1, y: 1, elevation: 3, dest_map: "MAP_B", dest_warp_id: "0" },
      { x: 99, y: 1, elevation: 3, dest_map: "MAP_B", dest_warp_id: "0" },
    ];
    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: { maps: { MAP_B: { map: openMap(), mapJson: baseJson("MAP_B") } } },
    });
    expect(has(report, "WARP_BLOCKED")).toBe(true);
    expect(has(report, "WARP_OUT_OF_BOUNDS")).toBe(true);
    expect(has(report, "WARP_DEST_NOT_FOUND")).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("verifies a loaded reciprocal destination warp and connection", () => {
    const map = openMap();
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_B", dest_warp_id: "0" },
    ];
    mapJson.connections = [{ map: "MAP_B", offset: 0, direction: "right" }];

    const neighbor = baseJson("MAP_B");
    neighbor.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_A", dest_warp_id: "0" },
    ];
    neighbor.connections = [{ map: "MAP_A", offset: 0, direction: "left" }];

    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: { sourceMapId: "MAP_A", maps: { MAP_B: { mapJson: neighbor } } },
    });
    expect(has(report, "WARP_RECIPROCAL_OK")).toBe(true);
    expect(has(report, "CONNECTION_RECIPROCAL_OK")).toBe(true);
    expect(has(report, "WARP_DEST_UNVERIFIED")).toBe(false);
    expect(has(report, "CONNECTION_NEIGHBOR_UNVERIFIED")).toBe(false);
  });

  it("catches NPC spawn collision and movement range leaving map", () => {
    const map = openMap();
    map.physical[0] = 0x3400;
    const mapJson = baseJson();
    mapJson.object_events = [
      {
        local_id: "LOCALID_BLOCKED",
        graphics_id: "OBJ_EVENT_GFX_MAN_1",
        x: 0,
        y: 0,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_WANDER_AROUND",
        movement_range_x: 1,
        movement_range_y: 1,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Test_EventScript",
        flag: "0",
      },
    ];
    const report = auditGameImplementability({ map, mapJson, atlas });
    expect(has(report, "NPC_BLOCKED")).toBe(true);
    expect(has(report, "NPC_MOVEMENT_RANGE_BOUNDS")).toBe(true);
  });

  it("detects duplicate connections, closed border and missing reciprocity", () => {
    const map = openMap();
    for (let y = 0; y < map.height; y++) map.physical[y * map.width + (map.width - 1)] = 0x3400;
    const mapJson = baseJson();
    mapJson.connections = [
      { map: "MAP_B", offset: 0, direction: "right" },
      { map: "MAP_B", offset: 0, direction: "right" },
    ];
    const neighbor = baseJson("MAP_B");
    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: { maps: { MAP_B: { map: openMap(), mapJson: neighbor } } },
    });
    expect(has(report, "CONNECTION_DUPLICATE")).toBe(true);
    expect(has(report, "CONNECTION_BORDER_CLOSED")).toBe(true);
    expect(has(report, "CONNECTION_RECIPROCAL_MISSING")).toBe(true);
  });

  it("detects a physically isolated warp even when its own tile is open", () => {
    const map = openMap();
    map.physical.fill(0x3400);
    // Main island with 3 cells.
    for (const [x, y] of [[2, 2], [2, 3], [3, 2]] as const) {
      map.physical[y * map.width + x] = 0x3000;
    }
    // Isolated warp island, one cell.
    map.physical[0] = 0x3000;
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 0, y: 0, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "-1" },
    ];
    const report = auditGameImplementability({ map, mapJson, atlas });
    expect(has(report, "ACCESS_WARP_ISOLATED")).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("never hides uncertainty when no strict-passable component exists", () => {
    const unknownAtlas: FingerprintAtlas = {
      primary: "gTileset_General",
      secondary: "gTileset_Slateport",
      records: [{ id: 1, behavior: 0xe1, layerType: 0 }],
    };
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "-1" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas: unknownAtlas });
    expect(has(report, "ACCESS_NO_STRICT_COMPONENT")).toBe(true);
    expect(report.fullyVerified).toBe(false);
  });

  it("marks missing atlas, missing metatiles and atlas identity mismatch safely", () => {
    const map = openMap();
    const mapJson = baseJson();
    const noAtlas = auditGameImplementability({ map, mapJson });
    expect(has(noAtlas, "ATLAS_NOT_LOADED")).toBe(true);
    expect(noAtlas.fullyVerified).toBe(false);

    map.metatiles[3] = 9;
    const missing = auditGameImplementability({ map, mapJson, atlas });
    expect(has(missing, "ATLAS_MISSING_METATILES")).toBe(true);

    const mismatch = auditGameImplementability({
      map: openMap(),
      mapJson,
      atlas,
      declaredTilesets: {
        primary: "gTileset_Other",
        secondary: "gTileset_Slateport",
      },
    });
    expect(has(mismatch, "ATLAS_PRIMARY_MISMATCH")).toBe(true);
  });

  it("rejects a valid bundle that no longer matches the audited editor state", () => {
    const originalMap = openMap();
    const mapJson = baseJson();
    const bundle = buildCityBundle({ map: originalMap, mapJson, atlas });
    const editedMap = openMap();
    editedMap.physical[7] = 0x3400;
    const report = auditGameImplementability({
      map: editedMap,
      mapJson,
      atlas,
      bundle,
      declaredTilesets: bundle.tilesets,
    });
    expect(has(report, "ROUNDTRIP_INPUT_MISMATCH")).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("preserves known weather and warns instead of replacing custom weather", () => {
    const known = baseJson();
    expect(has(auditGameImplementability({ map: openMap(), mapJson: known, atlas }), "WEATHER_KNOWN")).toBe(true);

    const custom = baseJson();
    custom.weather = "WEATHER_ARAUNA_SALT_MIST";
    const customReport = auditGameImplementability({ map: openMap(), mapJson: custom, atlas });
    expect(has(customReport, "WEATHER_CUSTOM_UNVERIFIED")).toBe(true);
    expect(customReport.fullyVerified).toBe(false);
    expect(custom.weather).toBe("WEATHER_ARAUNA_SALT_MIST");
  });
});
