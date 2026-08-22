import { afterEach, describe, expect, it } from "vitest";
import type { GameImplementabilityReport, ImplementabilityCategory } from "./gameImplementability";
import type { EditableMapJson } from "./eventMapJson";
import type { AraunaWorkspace } from "./repoWorkspace";
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

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function workspace(header: string, script: string): AraunaWorkspace {
  const headerFile = fakeFile(header);
  const scriptFile = fakeFile(script);
  return {
    files: new Map([
      ["include/constants/arauna_symbol_test.h", headerFile],
      ["data/maps/A/scripts.inc", scriptFile],
    ]),
    filesLower: new Map([
      ["include/constants/arauna_symbol_test.h", headerFile],
      ["data/maps/a/scripts.inc", scriptFile],
    ]),
    layouts: new Map(),
    maps: [],
    tilesets: [],
  };
}

function document(flag = "FLAG_A"): EditableMapJson {
  return {
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
    music: "MUS_A",
    region_map_section: "MAPSEC_A",
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_INDOOR",
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
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
        script: "A_EventScript",
        flag,
      },
    ],
  };
}

const HEADER = `
#define MUS_A 1
#define MAPSEC_A 1
#define WEATHER_NONE 0
#define MAP_TYPE_INDOOR 1
#define MAP_BATTLE_SCENE_NORMAL 0
#define OBJ_EVENT_GFX_MAN_1 1
#define MOVEMENT_TYPE_FACE_DOWN 1
#define TRAINER_TYPE_NONE 0
#define FLAG_A 1
`;

const SCRIPT = `
A_EventScript::
  end
`;

function has(report: GameImplementabilityReport, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

afterEach(() => clearWorkspaceSymbolAuditContext());

describe("workspaceSymbolAudit", () => {
  it("certifies every symbolic map/event reference against Workspace sources", async () => {
    const mapJson = document();
    await refreshWorkspaceSymbolAuditContext(workspace(HEADER, SCRIPT), mapJson);

    const report = withWorkspaceSymbolReferenceAudit(baseReport(), mapJson);
    expect(report.implementable).toBe(true);
    expect(report.fullyVerified).toBe(true);
    expect(has(report, "SOURCE_SYMBOLS_OK")).toBe(true);
    expect(has(report, "SOURCE_SYMBOL_NOT_FOUND")).toBe(false);
  });

  it("blocks a symbol that has no source definition", async () => {
    const mapJson = document("FLAG_MISSING");
    await refreshWorkspaceSymbolAuditContext(workspace(HEADER, SCRIPT), mapJson);

    const report = withWorkspaceSymbolReferenceAudit(baseReport(), mapJson);
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "SOURCE_SYMBOL_NOT_FOUND")).toBe(true);
  });

  it("refuses to reuse symbol proof after the mapJson identity object changes", async () => {
    const mapJson = document();
    await refreshWorkspaceSymbolAuditContext(workspace(HEADER, SCRIPT), mapJson);

    const report = withWorkspaceSymbolReferenceAudit(baseReport(), { ...mapJson });
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "SOURCE_SYMBOLS_UNVERIFIED")).toBe(true);
  });
});
