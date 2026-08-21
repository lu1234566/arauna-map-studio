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

function openMap(width = 5, height = 5, metatile = 1): MapData {
  return {
    width,
    height,
    metatiles: Uint16Array.from({ length: width * height }, () => metatile),
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

function severity(report: ReturnType<typeof auditGameImplementability>, code: string) {
  return report.issues.find((issue) => issue.code === code)?.severity;
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

  it("accepts vanilla null collections and MAP_DYNAMIC with symbolic warp id", () => {
    const mapJson = baseJson();
    mapJson.connections = null;
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas });
    expect(has(report, "MAPJSON_CONNECTIONS_TYPE")).toBe(false);
    expect(has(report, "WARP_DEST_ID_INVALID")).toBe(false);
    expect(has(report, "WARP_DEST_UNVERIFIED")).toBe(false);
    expect(has(report, "WARP_DYNAMIC_DEST_OK")).toBe(true);
    expect(report.pass).toBe(true);
  });

  it("accepts a Slateport-style first connection-margin warp and verifies the neighbor tile", () => {
    const map = openMap(40, 60);
    const mapJson = baseJson();
    mapJson.id = "MAP_SLATEPORT_CITY";
    mapJson.name = "SlateportCity";
    mapJson.layout = "LAYOUT_SLATEPORT_CITY";
    mapJson.connections = [{ map: "MAP_ROUTE134", offset: 0, direction: "right" }];
    mapJson.warp_events = [
      { x: 40, y: 7, elevation: 0, dest_map: "MAP_SLATEPORT_CITY_HARBOR", dest_warp_id: "0" },
    ];

    const routeJson = baseJson("MAP_ROUTE134");
    routeJson.connections = [{ map: "MAP_SLATEPORT_CITY", offset: 0, direction: "left" }];
    const routeMap = openMap(80, 40, 2);
    const routeAtlas: FingerprintAtlas = {
      primary: "gTileset_General",
      secondary: "gTileset_Pacifidlog",
      records: [{ id: 2, behavior: 0x15, layerType: 0 }], // MB_OCEAN_WATER
    };

    const harborJson = baseJson("MAP_SLATEPORT_CITY_HARBOR");
    harborJson.warp_events = [
      { x: 1, y: 1, elevation: 0, dest_map: "MAP_SLATEPORT_CITY", dest_warp_id: "0" },
    ];

    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_SLATEPORT_CITY",
        maps: {
          MAP_ROUTE134: {
            map: routeMap,
            mapJson: routeJson,
            width: 80,
            height: 40,
            atlas: routeAtlas,
          },
          MAP_SLATEPORT_CITY_HARBOR: { mapJson: harborJson },
        },
      },
    });

    expect(has(report, "WARP_OUT_OF_BOUNDS")).toBe(false);
    expect(has(report, "WARP_EDGE_TARGET_OK")).toBe(true);
    expect(has(report, "WARP_EDGE_TARGET_BLOCKED")).toBe(false);
    expect(has(report, "WARP_EDGE_TARGET_UNKNOWN")).toBe(false);
    expect(has(report, "WARP_RECIPROCAL_OK")).toBe(true);
  });

  it("catches blocked and truly out-of-bounds warps plus invalid loaded destination", () => {
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

  it("keeps an asymmetric reverse connection as a review warning instead of a hard engine error", () => {
    const mapJson = baseJson();
    mapJson.connections = [{ map: "MAP_B", offset: 1, direction: "up" }];
    const neighbor = baseJson("MAP_B");
    neighbor.connections = [{ map: "MAP_A", offset: 0, direction: "down" }];

    const report = auditGameImplementability({
      map: openMap(),
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_A",
        maps: { MAP_B: { mapJson: neighbor, width: 5, height: 5 } },
      },
    });
    expect(has(report, "CONNECTION_RECIPROCAL_OFFSET_MISMATCH")).toBe(true);
    expect(severity(report, "CONNECTION_RECIPROCAL_OFFSET_MISMATCH")).toBe("warning");
    expect(report.pass).toBe(true);
  });

  it("evaluates a connection in its real offset interval without forcing it into the largest component", () => {
    const map = openMap();
    map.physical.fill(0x3400);
    for (let x = 0; x < map.width; x++) map.physical[x] = 0x3000;
    map.physical[4 * map.width + 4] = 0x3000;

    const mapJson = baseJson();
    mapJson.connections = [{ map: "MAP_B", offset: 3, direction: "right" }];
    const neighbor = baseJson("MAP_B");
    neighbor.connections = [{ map: "MAP_A", offset: -3, direction: "left" }];

    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_A",
        maps: { MAP_B: { mapJson: neighbor, width: 2, height: 2 } },
      },
    });
    expect(has(report, "ACCESS_CONNECTION_NOT_NAVIGABLE")).toBe(false);
    expect(report.pass).toBe(true);
  });

  it("treats recognized ocean traversal as verified conditional, not unknown", () => {
    const waterAtlas: FingerprintAtlas = {
      primary: "gTileset_General",
      secondary: "gTileset_Slateport",
      records: [{ id: 1, behavior: 0x15, layerType: 0 }],
    };
    const mapJson = baseJson();
    mapJson.connections = [{ map: "MAP_B", offset: 0, direction: "right" }];
    const neighbor = baseJson("MAP_B");
    neighbor.connections = [{ map: "MAP_A", offset: 0, direction: "left" }];
    const report = auditGameImplementability({
      map: openMap(),
      mapJson,
      atlas: waterAtlas,
      workspaceContext: {
        sourceMapId: "MAP_A",
        maps: { MAP_B: { mapJson: neighbor, width: 5, height: 5 } },
      },
    });
    expect(has(report, "CONNECTION_BORDER_CONDITIONAL_OK")).toBe(true);
    expect(has(report, "CONNECTION_BORDER_UNKNOWN")).toBe(false);
    expect(has(report, "ACCESS_CONNECTION_REQUIRES_UNKNOWN")).toBe(false);
  });

  it("does not turn a recognized warp-door behavior into an unresolved warning", () => {
    const doorAtlas: FingerprintAtlas = {
      primary: "gTileset_General",
      secondary: "gTileset_Slateport",
      records: [{ id: 1, behavior: 0x69, layerType: 0 }], // MB_ANIMATED_DOOR
    };
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas: doorAtlas });
    expect(has(report, "ACCESS_REQUIRES_UNKNOWN_BEHAVIOR")).toBe(false);
    expect(has(report, "ACCESS_WARP_ENGINE_BEHAVIOR_OK")).toBe(true);
  });

  it("keeps NPC range clipping and internal obstacles informational while still rejecting a blocked spawn", () => {
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
    expect(has(report, "NPC_MOVEMENT_RANGE_CLIPPED_BY_ENGINE")).toBe(true);
    expect(severity(report, "NPC_MOVEMENT_RANGE_CLIPPED_BY_ENGINE")).toBe("info");
    expect(has(report, "NPC_MOVEMENT_RANGE_OBSTACLES_HANDLED")).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("rejects movement ranges that cannot fit the 4-bit pokeemerald fields", () => {
    const mapJson = baseJson();
    mapJson.object_events = [
      {
        graphics_id: "OBJ_EVENT_GFX_MAN_1",
        x: 2,
        y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_WANDER_AROUND",
        movement_range_x: 16,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Test_EventScript",
        flag: "0",
      },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas });
    expect(has(report, "NPC_MOVEMENT_RANGE_INVALID")).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("accepts multiple coord events on the same tile when their var conditions differ", () => {
    const mapJson = baseJson();
    mapJson.coord_events = [
      { type: "trigger", x: 2, y: 2, elevation: 3, var: "VAR_TEST", var_value: "0", script: "Test_EventScript_A" },
      { type: "trigger", x: 2, y: 2, elevation: 3, var: "VAR_TEST", var_value: "1", script: "Test_EventScript_B" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas });
    expect(has(report, "COORD_SHARED_CELL_CONDITIONAL_OK")).toBe(true);
    expect(has(report, "COORD_DUPLICATE_CONDITION")).toBe(false);
    expect(report.pass).toBe(true);
  });

  it("distinguishes warps sharing X/Y on different elevations", () => {
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 1, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas });
    expect(has(report, "WARP_SHARED_COORD_DIFFERENT_ELEVATION")).toBe(true);
    expect(has(report, "WARP_DUPLICATE_CELL")).toBe(false);
    expect(report.pass).toBe(true);
  });

  it("does not reject segmented teleport layouts for having more than one navigable component", () => {
    const map = openMap();
    map.physical.fill(0x3400);
    map.physical[0] = 0x3000;
    map.physical[4 * map.width + 4] = 0x3000;

    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 0, y: 0, elevation: 3, dest_map: "MAP_A", dest_warp_id: "1" },
      { x: 4, y: 4, elevation: 3, dest_map: "MAP_A", dest_warp_id: "0" },
    ];
    const report = auditGameImplementability({
      map,
      mapJson,
      atlas,
      workspaceContext: {
        sourceMapId: "MAP_A",
        maps: { MAP_A: { map, mapJson, width: 5, height: 5, atlas } },
      },
    });
    expect(has(report, "ACCESS_MULTIPLE_COMPONENTS_OK")).toBe(true);
    expect(has(report, "ACCESS_WARP_NOT_NAVIGABLE")).toBe(false);
    expect(report.pass).toBe(true);
  });

  it("does not reject an isolated decorative component just because a warp lives in another component", () => {
    const map = openMap();
    map.physical.fill(0x3400);
    for (const [x, y] of [[2, 2], [2, 3], [3, 2]] as const) {
      map.physical[y * map.width + x] = 0x3000;
    }
    map.physical[0] = 0x3000;
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 0, y: 0, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
    ];
    const report = auditGameImplementability({ map, mapJson, atlas });
    expect(has(report, "ACCESS_WARP_NOT_NAVIGABLE")).toBe(false);
    expect(report.pass).toBe(true);
  });

  it("never hides uncertainty when a critical component depends on unknown behavior", () => {
    const unknownAtlas: FingerprintAtlas = {
      primary: "gTileset_General",
      secondary: "gTileset_Slateport",
      records: [{ id: 1, behavior: 0xe1, layerType: 0 }],
    };
    const mapJson = baseJson();
    mapJson.warp_events = [
      { x: 2, y: 2, elevation: 3, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
    ];
    const report = auditGameImplementability({ map: openMap(), mapJson, atlas: unknownAtlas });
    expect(has(report, "ACCESS_REQUIRES_UNKNOWN_BEHAVIOR")).toBe(true);
    expect(report.fullyVerified).toBe(false);
  });

  it("detects duplicate connections, closed border and reports one-way reciprocity without making it a second hard error", () => {
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
      workspaceContext: { maps: { MAP_B: { map: openMap(), mapJson: neighbor, width: 5, height: 5 } } },
    });
    expect(has(report, "CONNECTION_DUPLICATE")).toBe(true);
    expect(has(report, "CONNECTION_BORDER_CLOSED")).toBe(true);
    expect(has(report, "CONNECTION_RECIPROCAL_MISSING")).toBe(true);
    expect(severity(report, "CONNECTION_RECIPROCAL_MISSING")).toBe("info");
    expect(report.pass).toBe(false);
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
