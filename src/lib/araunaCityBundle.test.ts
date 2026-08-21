import { describe, expect, it } from "vitest";
import { type MapData } from "./emeraldMap";
import {
  buildCityBundle,
  bundlesEquivalent,
  canonicalJson,
  CityBundleError,
  compileCityBundle,
  parseCityBundle,
  serializeCityBundle,
  verifyBundleIntegrity,
  type AraunaCityBundle,
} from "./araunaCityBundle";
import type { EditableMapJson } from "./eventMapJson";

function map(width = 4, height = 3): MapData {
  const size = width * height;
  return {
    width,
    height,
    metatiles: Uint16Array.from({ length: size }, (_, i) => i % 4),
    physical: Uint16Array.from({ length: size }, () => 0x3000),
  };
}

function mapJson(): EditableMapJson {
  return {
    id: "MAP_TEST_CITY",
    name: "TestCity",
    layout: "LAYOUT_TEST_CITY",
    music: "MUS_SLATEPORT",
    region_map_section: "MAPSEC_SLATEPORT_CITY",
    weather: "WEATHER_SUNNY",
    map_type: "MAP_TYPE_CITY",
    allow_cycling: true,
    allow_escaping: false,
    allow_running: true,
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    custom_arauna_field: { nested: [1, "keep", { value: true }] },
    connections: [],
    warp_events: [
      { x: 1, y: 1, elevation: 3, dest_map: "MAP_TEST_HOUSE", dest_warp_id: "0", custom: "first" },
      { x: 2, y: 1, elevation: 3, dest_map: "MAP_TEST_MART", dest_warp_id: "1", custom: "second" },
    ],
    object_events: [
      {
        local_id: "LOCALID_TEST_B",
        graphics_id: "OBJ_EVENT_GFX_MAN_1",
        x: 1,
        y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_UP",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Test_EventScript_B",
        flag: "0",
      },
      {
        local_id: "LOCALID_TEST_A",
        graphics_id: "OBJ_EVENT_GFX_WOMAN_1",
        x: 2,
        y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "Test_EventScript_A",
        flag: "FLAG_TEST",
      },
    ],
    coord_events: [],
    bg_events: [],
  };
}

function cloneBundle(bundle: AraunaCityBundle): AraunaCityBundle {
  return JSON.parse(JSON.stringify(bundle)) as AraunaCityBundle;
}

describe("arauna-city-v1", () => {
  it("round-trips grid, complete mapJson, unknown fields and event order", () => {
    const original = buildCityBundle({ map: map(), mapJson: mapJson(), mapName: "Porto teste", createdAt: "2026-08-21T00:00:00.000Z" });
    const reparsed = parseCityBundle(serializeCityBundle(original));
    const compiled = compileCityBundle(reparsed);

    expect(bundlesEquivalent(original, reparsed)).toBe(true);
    expect(Array.from(compiled.map.metatiles)).toEqual(Array.from(map().metatiles));
    expect(Array.from(compiled.map.physical)).toEqual(Array.from(map().physical));
    expect(compiled.mapJson.custom_arauna_field).toEqual({ nested: [1, "keep", { value: true }] });
    expect((compiled.mapJson.object_events as Array<Record<string, unknown>>).map((event) => event.local_id)).toEqual([
      "LOCALID_TEST_B",
      "LOCALID_TEST_A",
    ]);
    expect((compiled.mapJson.warp_events as Array<Record<string, unknown>>).map((event) => event.custom)).toEqual([
      "first",
      "second",
    ]);
    expect(serializeCityBundle(original).endsWith("\n")).toBe(true);
  });

  it("canonical JSON uses locale-independent key ordering", () => {
    expect(canonicalJson({ "á": 3, z: 1, a: 2 })).toBe('{"a":2,"z":1,"á":3}');
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: 0 })).toBe('{"a":0,"b":{"c":2,"d":1}}');
  });

  it("rejects checksum, cell-count and physical derivation corruption", () => {
    const source = buildCityBundle({ map: map(), mapJson: mapJson() });

    const checksum = cloneBundle(source);
    checksum.cells.metatiles[0] = 3;
    expect(() => compileCityBundle(checksum)).toThrow(/BUNDLE_CELLS_CHECKSUM/);

    const count = cloneBundle(source);
    count.cells.metatiles.pop();
    expect(() => compileCityBundle(count)).toThrow(/BUNDLE_CELL_COUNT/);

    const derived = cloneBundle(source);
    derived.cells.collision[0] = 2;
    expect(verifyBundleIntegrity(derived).some((issue) => issue.code === "BUNDLE_PHYSICAL_DERIVATION")).toBe(true);
  });

  it("rejects dimension, identity, mirrored-property and protected-cell corruption", () => {
    const source = buildCityBundle({ map: map(), mapJson: mapJson() });
    const dimensions = cloneBundle(source);
    dimensions.identity.width = 99;
    expect(() => compileCityBundle(dimensions)).toThrow(/BUNDLE_CELL_COUNT/);

    const identity = cloneBundle(source);
    identity.identity.id = "MAP_OTHER";
    expect(() => compileCityBundle(identity)).toThrow(/BUNDLE_IDENTITY_MISMATCH/);

    const properties = cloneBundle(source);
    properties.properties.weather = "WEATHER_RAIN";
    expect(() => compileCityBundle(properties)).toThrow(/BUNDLE_PROPERTIES_MISMATCH/);

    const protectedCells = cloneBundle(source);
    protectedCells.protectedCells[0]!.reason = "tampered";
    expect(() => compileCityBundle(protectedCells)).toThrow(/BUNDLE_PROTECTED_CELLS_MISMATCH/);
  });

  it("rejects connection contract geometry/count tampering", () => {
    const json = mapJson();
    json.connections = [{ map: "MAP_B", offset: 0, direction: "right" }];
    const source = buildCityBundle({ map: map(), mapJson: json });
    expect(source.connectionContracts[0]?.borderCells).toBe(3);

    const border = cloneBundle(source);
    border.connectionContracts[0]!.borderCells = 999;
    expect(() => compileCityBundle(border)).toThrow(/BUNDLE_CONNECTION_CONTRACT_MISMATCH/);

    const counts = cloneBundle(source);
    counts.connectionContracts[0]!.openCells = 3;
    counts.connectionContracts[0]!.conditionalCells = 3;
    expect(() => compileCityBundle(counts)).toThrow(/BUNDLE_CONNECTION_CONTRACT_MISMATCH/);
  });

  it("parse rejects unsupported version and invalid arrays before compile", () => {
    const source = buildCityBundle({ map: map(), mapJson: mapJson() });
    const version = cloneBundle(source) as unknown as Record<string, unknown>;
    version.version = 2;
    expect(() => parseCityBundle(version)).toThrow(CityBundleError);

    const badMetatile = cloneBundle(source);
    badMetatile.cells.metatiles[0] = 0x400;
    expect(() => parseCityBundle(badMetatile)).toThrow(/cells\.metatiles\[0\]/);

    const badPhysical = cloneBundle(source);
    badPhysical.cells.physical[0] = 1;
    expect(() => parseCityBundle(badPhysical)).toThrow(/cells\.physical\[0\]/);
  });
});
