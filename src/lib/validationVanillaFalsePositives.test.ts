import { afterEach, describe, expect, it } from "vitest";
import type { FingerprintAtlas } from "./araunaCityBundle";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
  ImplementabilityWorkspaceContext,
} from "./gameImplementability";
import {
  normalizeWorkspacePath,
  type AraunaWorkspace,
  type WorkspaceMap,
} from "./repoWorkspace";
import { auditScriptSpatialContracts } from "./scriptSpatialAudit";
import { parseScriptSpatialContracts } from "./scriptSpatialContracts";
import { withScriptDoorNpcReconciliation } from "./scriptDoorNpcReconciliation";
import {
  clearScriptSpatialContext,
  refreshScriptSpatialContext,
} from "./scriptSpatialContext";
import { withWarpEndpointSafetyAudit } from "./warpEndpointSafety";
import {
  clearWorkspaceSymbolAuditContext,
  refreshWorkspaceSymbolAuditContext,
  withWorkspaceSymbolReferenceAudit,
} from "./workspaceSymbolAudit";

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

const ATLAS: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  records: [{ id: 1, behavior: 0, layerType: 0 }],
};

const DOOR_ATLAS: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Slateport",
  records: [{ id: 1, behavior: 0x69, layerType: 0 }],
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

function blockedNpcReport(): GameImplementabilityReport {
  const report = baseReport();
  report.pass = false;
  report.implementable = false;
  report.fullyVerified = false;
  report.confidence = "partial";
  report.issues.push({
    code: "NPC_BLOCKED",
    severity: "error",
    category: "npcs",
    message: "Scott nasce sobre collision > 0.",
    eventSource: "object",
    eventIndex: 0,
    x: 10,
    y: 12,
  });
  report.categories.npcs.errors = 1;
  report.counts.errors = 1;
  return report;
}

function openMap(width: number, height: number): MapData {
  return {
    width,
    height,
    metatiles: Uint16Array.from({ length: width * height }, () => 1),
    physical: Uint16Array.from({ length: width * height }, () => 0x3000),
  };
}

function blockedScottMap(): MapData {
  const map = openMap(40, 60);
  map.physical[12 * map.width + 10] = 0x3400;
  return map;
}

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function has(report: GameImplementabilityReport, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

function sourceMap(): EditableMapJson {
  return {
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
    warp_events: [{ x: 1, y: 1, elevation: 0, dest_map: "MAP_B", dest_warp_id: "2" }],
  };
}

function harborDestination(withConnection: boolean): EditableMapJson {
  return {
    id: "MAP_B",
    name: "B",
    layout: "LAYOUT_HARBOR",
    connections: withConnection ? [{ direction: "down", offset: 0, map: "MAP_ROUTE" }] : null,
    warp_events: [
      { x: 11, y: 14, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" },
      { x: 12, y: 14, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" },
      { x: 19, y: 15, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" },
    ],
  };
}

function endpointWorkspace(
  source: EditableMapJson,
  destination: EditableMapJson,
): ImplementabilityWorkspaceContext {
  const harbor = openMap(24, 15);
  return {
    sourceMapId: "MAP_A",
    maps: {
      MAP_A: { mapJson: source },
      MAP_B: {
        mapJson: destination,
        map: harbor,
        width: 24,
        height: 15,
        atlas: ATLAS,
      },
    },
  };
}

function scottDocument(): EditableMapJson {
  return {
    id: "MAP_SLATEPORT_CITY",
    name: "SlateportCity",
    layout: "LAYOUT_SLATEPORT_CITY",
    object_events: [
      {
        local_id: "LOCALID_SLATEPORT_SCOTT",
        graphics_id: "OBJ_EVENT_GFX_SCOTT",
        x: 10,
        y: 12,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "0x0",
        flag: "FLAG_HIDE_SLATEPORT_CITY_SCOTT",
      },
    ],
  };
}

const SCOTT_SCRIPT = `
SlateportCity_EventScript_ResetScott::
  setobjectxyperm LOCALID_SLATEPORT_SCOTT, 10, 12
  end

SlateportCity_EventScript_ScottBattleTentScene::
  opendoor 10, 12
  waitdooranim
  addobject LOCALID_SLATEPORT_SCOTT
  end
`;

function scriptWorkspace(source: string): AraunaWorkspace {
  const descriptor: WorkspaceMap = {
    path: "data/maps/SlateportCity/map.json",
    directory: "SlateportCity",
    id: "MAP_SLATEPORT_CITY",
    name: "SlateportCity",
    layoutId: "LAYOUT_SLATEPORT_CITY",
  };
  const script = fakeFile(source);
  const movement = fakeFile("");
  return {
    files: new Map([
      ["data/maps/SlateportCity/scripts.inc", script],
      ["data/scripts/movement.inc", movement],
    ]),
    filesLower: new Map([
      ["data/maps/slateportcity/scripts.inc", script],
      ["data/scripts/movement.inc", movement],
    ]),
    layouts: new Map(),
    maps: [descriptor],
    tilesets: [],
  };
}

afterEach(() => {
  clearWorkspaceSymbolAuditContext();
  clearScriptSpatialContext();
});

describe("vanilla audit false-positive regressions", () => {
  it("normalizes source roots selected through a repository folder", () => {
    expect(
      normalizeWorkspacePath("pokemon-juramento-de-arauna/include/constants/flags.h"),
    ).toBe("include/constants/flags.h");
    expect(normalizeWorkspacePath("pokemon-juramento-de-arauna/src/fieldmap.c")).toBe(
      "src/fieldmap.c",
    );
    expect(normalizeWorkspacePath("repo\\asm\\macros.inc")).toBe("asm/macros.inc");
    expect(normalizeWorkspacePath("repo/tools/mapjson/mapjson.cpp")).toBe(
      "tools/mapjson/mapjson.cpp",
    );
  });

  it("finds constants in a prefixed include path from an already-open Workspace", async () => {
    const mapJson: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
      music: "MUS_SLATEPORT",
      region_map_section: "MAPSEC_SLATEPORT_CITY",
      weather: "WEATHER_SUNNY",
      map_type: "MAP_TYPE_CITY",
      battle_scene: "MAP_BATTLE_SCENE_NORMAL",
      object_events: [
        {
          graphics_id: "OBJ_EVENT_GFX_SCOTT",
          x: 1,
          y: 1,
          elevation: 3,
          movement_type: "MOVEMENT_TYPE_FACE_DOWN",
          movement_range_x: 0,
          movement_range_y: 0,
          trainer_type: "TRAINER_TYPE_NONE",
          trainer_sight_or_berry_tree_id: "0",
          script: "A_EventScript",
          flag: "FLAG_HIDE_SLATEPORT_CITY_SCOTT",
        },
      ],
    };
    const header = fakeFile(`
#define MUS_SLATEPORT 1
#define MAPSEC_SLATEPORT_CITY 1
#define WEATHER_SUNNY 1
#define MAP_TYPE_CITY 1
#define MAP_BATTLE_SCENE_NORMAL 1
#define OBJ_EVENT_GFX_SCOTT 1
#define MOVEMENT_TYPE_FACE_DOWN 1
#define TRAINER_TYPE_NONE 0
#define FLAG_HIDE_SLATEPORT_CITY_SCOTT 1
`);
    const script = fakeFile("A_EventScript::\n  end\n");
    const workspace: AraunaWorkspace = {
      files: new Map([
        ["pokemon-juramento-de-arauna/include/constants/test.h", header],
        ["pokemon-juramento-de-arauna/data/maps/A/scripts.inc", script],
      ]),
      filesLower: new Map([
        ["pokemon-juramento-de-arauna/include/constants/test.h", header],
        ["pokemon-juramento-de-arauna/data/maps/a/scripts.inc", script],
      ]),
      layouts: new Map(),
      maps: [],
      tilesets: [],
    };

    await refreshWorkspaceSymbolAuditContext(workspace, mapJson);
    const report = withWorkspaceSymbolReferenceAudit(baseReport(), mapJson);
    expect(report.pass).toBe(true);
    expect(has(report, "SOURCE_SYMBOLS_OK")).toBe(true);
    expect(has(report, "SOURCE_SYMBOL_NOT_FOUND")).toBe(false);
  });

  it("downgrades the vanilla Harbor first-margin destination without a declared connection", () => {
    const source = sourceMap();
    const destination = harborDestination(false);
    const report = withWarpEndpointSafetyAudit(
      baseReport(),
      source,
      endpointWorkspace(source, destination),
    );

    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "WARP_DEST_SPAWN_EDGE_UNVERIFIED")).toBe(true);
    expect(has(report, "WARP_DEST_SPAWN_OUT_OF_BOUNDS")).toBe(false);
  });

  it("certifies a first-margin destination when the destination declares that edge connection", () => {
    const source = sourceMap();
    const destination = harborDestination(true);
    const report = withWarpEndpointSafetyAudit(
      baseReport(),
      source,
      endpointWorkspace(source, destination),
    );

    expect(report.implementable).toBe(true);
    expect(has(report, "WARP_DEST_SPAWN_EDGE_OK")).toBe(true);
  });

  it("parses and certifies Scott's opendoor -> addobject door spawn", () => {
    const contracts = parseScriptSpatialContracts(SCOTT_SCRIPT);
    expect(contracts.doorOpenings).toMatchObject([
      { x: 10, y: 12, scriptLabel: "SlateportCity_EventScript_ScottBattleTentScene" },
    ]);
    expect(contracts.objectAdds).toMatchObject([
      {
        localId: "LOCALID_SLATEPORT_SCOTT",
        scriptLabel: "SlateportCity_EventScript_ScottBattleTentScene",
      },
    ]);

    const issues = auditScriptSpatialContracts(contracts, blockedScottMap(), scottDocument());
    expect(issues.some((issue) => issue.code === "SCRIPT_OBJECT_ANCHOR_DOOR_OK")).toBe(true);
    expect(issues.some((issue) => issue.code === "SCRIPT_OBJECT_ANCHOR_BLOCKED")).toBe(false);
  });

  it("replaces NPC_BLOCKED only when the tile is an animated door and scripts prove the spawn", async () => {
    const mapJson = scottDocument();
    await refreshScriptSpatialContext(scriptWorkspace(SCOTT_SCRIPT), mapJson);

    const report = withScriptDoorNpcReconciliation(
      blockedNpcReport(),
      mapJson,
      blockedScottMap(),
      DOOR_ATLAS,
    );
    expect(report.pass).toBe(true);
    expect(report.counts.errors).toBe(0);
    expect(has(report, "NPC_BLOCKED")).toBe(false);
    expect(has(report, "NPC_SCRIPTED_DOOR_SPAWN_OK")).toBe(true);
  });

  it("keeps NPC_BLOCKED when opendoor/addobject exists on a non-door metatile", async () => {
    const mapJson = scottDocument();
    await refreshScriptSpatialContext(scriptWorkspace(SCOTT_SCRIPT), mapJson);

    const report = withScriptDoorNpcReconciliation(
      blockedNpcReport(),
      mapJson,
      blockedScottMap(),
      ATLAS,
    );
    expect(report.pass).toBe(false);
    expect(report.counts.errors).toBe(1);
    expect(has(report, "NPC_BLOCKED")).toBe(true);
    expect(has(report, "NPC_SCRIPTED_DOOR_SPAWN_OK")).toBe(false);
  });
});
