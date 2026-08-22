import { afterEach, describe, expect, it } from "vitest";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
} from "./gameImplementability";
import { withActiveScriptSpatialAudit } from "./gameImplementabilityWithScripts";
import type { AraunaWorkspace, WorkspaceMap } from "./repoWorkspace";
import {
  clearScriptSpatialContext,
  refreshScriptSpatialContext,
} from "./scriptSpatialContext";

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

function openMap(): MapData {
  return {
    width: 5,
    height: 5,
    metatiles: Uint16Array.from({ length: 25 }, () => 1),
    physical: Uint16Array.from({ length: 25 }, () => 0x3000),
  };
}

function document(): EditableMapJson {
  return {
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
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
        flag: "0",
      },
    ],
  };
}

function fakeFile(source: string): File {
  return { text: async () => source } as unknown as File;
}

function workspace(source: string): AraunaWorkspace {
  const descriptor: WorkspaceMap = {
    path: "data/maps/A/map.json",
    directory: "A",
    id: "MAP_A",
    name: "A",
    layoutId: "LAYOUT_A",
  };
  const script = fakeFile(source);
  return {
    files: new Map([["data/maps/A/scripts.inc", script]]),
    filesLower: new Map([["data/maps/a/scripts.inc", script]]),
    layouts: new Map(),
    maps: [descriptor],
    tilesets: [],
  };
}

function has(report: GameImplementabilityReport, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

afterEach(() => clearScriptSpatialContext());

describe("withActiveScriptSpatialAudit", () => {
  it("keeps Game-ready when every declared runtime anchor is valid", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.implementable).toBe(true);
    expect(report.fullyVerified).toBe(true);
    expect(has(report, "SCRIPT_SPATIAL_SOURCE_OK")).toBe(true);
    expect(has(report, "SCRIPT_OBJECT_ANCHOR_OK")).toBe(true);
  });

  it("downgrades a runtime anchor that would place an NPC on collision", async () => {
    const mapJson = document();
    const map = openMap();
    map.physical[2 * map.width + 2] = 0x3400;
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), map, mapJson);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(report.counts.warnings).toBe(1);
    expect(has(report, "SCRIPT_OBJECT_ANCHOR_BLOCKED")).toBe(true);
  });

  it("blocks scripts that reference an object LOCALID removed from effective events", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_REMOVED, 2, 2\n\tend\n"),
      mapJson,
    );

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), mapJson);
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_OBJECT_LOCALID_MISSING")).toBe(true);
  });

  it("refuses a stale scripts context after map.json identity object changes", async () => {
    const mapJson = document();
    await refreshScriptSpatialContext(
      workspace("A_Transition::\n\tsetobjectxyperm LOCALID_A, 2, 2\n\tend\n"),
      mapJson,
    );
    const edited = { ...mapJson };

    const report = withActiveScriptSpatialAudit(baseReport(), openMap(), edited);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "SCRIPT_SPATIAL_CONTEXT_STALE")).toBe(true);
  });
});
