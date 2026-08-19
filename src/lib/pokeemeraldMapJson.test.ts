import { describe, expect, it } from "vitest";
import { LITTLEROOT_MAP_JSON, littlerootMapBinBuffer } from "@/data/littlerootSnapshot";
import {
  MapJsonParseError,
  metadataOutOfBounds,
  parsePokeemeraldMapJson,
} from "./pokeemeraldMapJson";

const SAMPLE = JSON.stringify({
  id: "MAP_LITTLEROOT_TOWN",
  name: "LittlerootTown",
  layout: "LAYOUT_LITTLEROOT_TOWN",
  music: "MUS_LITTLEROOT",
  region_map_section: "MAPSEC_LITTLEROOT_TOWN",
  map_type: "MAP_TYPE_TOWN",
  connections: [{ map: "MAP_ROUTE101", direction: "up", offset: 0 }],
  warp_events: [
    { x: 5, y: 8, elevation: 0, dest_map: "MAP_HOUSE", dest_warp_id: "1" },
  ],
  object_events: [
    {
      local_id: "LOCALID_MOM",
      graphics_id: "OBJ_EVENT_GFX_MOM",
      x: 5,
      y: 8,
      movement_type: "MOVEMENT_TYPE_FACE_UP",
      script: "MomScript",
      flag: "FLAG_HIDE_MOM",
    },
  ],
  coord_events: [
    { type: "trigger", x: 10, y: 1, var: "VAR_STATE", var_value: "0", script: "IntroScript" },
    { type: "trigger", x: 10, y: 1, var: "VAR_STATE", var_value: "1", script: "IntroScript2" },
  ],
  bg_events: [
    { type: "sign", x: 6, y: 17, script: "TownSign", player_facing_dir: "BG_EVENT_PLAYER_FACING_ANY" },
  ],
});

describe("parsePokeemeraldMapJson", () => {
  it("converte eventos e conexões do pokeemerald", () => {
    const metadata = parsePokeemeraldMapJson(SAMPLE);

    expect(metadata.id).toBe("MAP_LITTLEROOT_TOWN");
    expect(metadata.layout).toBe("LAYOUT_LITTLEROOT_TOWN");
    expect(metadata.connections).toEqual([{ map: "MAP_ROUTE101", direction: "up", offset: 0 }]);
    expect(metadata.counts).toEqual({ warps: 1, objects: 1, coordEvents: 2, bgEvents: 1 });
    expect(metadata.events).toHaveLength(5);
    expect(metadata.events.find((event) => event.source === "bg")?.kind).toBe("trigger");
  });

  it("protege warps, coord events e BG events, deduplicando coordenadas", () => {
    const metadata = parsePokeemeraldMapJson(SAMPLE);

    expect(metadata.protectedCells).toHaveLength(3);
    expect(metadata.protectedCells.find((cell) => cell.x === 10 && cell.y === 1)?.reason).toContain("T0");
    expect(metadata.protectedCells.find((cell) => cell.x === 10 && cell.y === 1)?.reason).toContain("T1");
  });

  it("detecta eventos fora do layout carregado", () => {
    const metadata = parsePokeemeraldMapJson(SAMPLE);
    expect(metadataOutOfBounds(metadata, 20, 20)).toHaveLength(0);
    expect(metadataOutOfBounds(metadata, 10, 10).length).toBeGreaterThan(0);
  });

  it("rejeita JSON sem os campos fundamentais", () => {
    expect(() => parsePokeemeraldMapJson("{}")).toThrow(MapJsonParseError);
  });

  it("mantém o snapshot real de Littleroot em 20x20 / 800 bytes", () => {
    const bytes = littlerootMapBinBuffer();
    const metadata = parsePokeemeraldMapJson(LITTLEROOT_MAP_JSON);

    expect(bytes.byteLength).toBe(800);
    expect(metadata.id).toBe("MAP_LITTLEROOT_TOWN");
    expect(metadata.counts).toEqual({ warps: 3, objects: 8, coordEvents: 9, bgEvents: 4 });
    expect(metadataOutOfBounds(metadata, 20, 20)).toHaveLength(0);
  });
});
