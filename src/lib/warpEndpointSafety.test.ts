import { describe, expect, it } from "vitest";
import type { FingerprintAtlas } from "./araunaCityBundle";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
  ImplementabilityWorkspaceContext,
} from "./gameImplementability";
import { withWarpEndpointSafetyAudit } from "./warpEndpointSafety";

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

const atlas: FingerprintAtlas = {
  primary: "gTileset_General",
  secondary: "gTileset_Petalburg",
  records: [{ id: 1, behavior: 0, layerType: 0 }],
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

function map(blockSpawn = false): MapData {
  const physical = Uint16Array.from({ length: 25 }, () => 0x3000);
  if (blockSpawn) physical[1 * 5 + 1] = 0x3400;
  return {
    width: 5,
    height: 5,
    metatiles: Uint16Array.from({ length: 25 }, () => 1),
    physical,
  };
}

function source(): EditableMapJson {
  return {
    id: "MAP_A",
    name: "A",
    layout: "LAYOUT_A",
    warp_events: [
      { x: 2, y: 2, elevation: 0, dest_map: "MAP_B", dest_warp_id: "0" },
    ],
  };
}

function destination(): EditableMapJson {
  return {
    id: "MAP_B",
    name: "B",
    layout: "LAYOUT_B",
    warp_events: [
      { x: 1, y: 1, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" },
    ],
  };
}

function workspace(sourceMap: EditableMapJson, blocked = false): ImplementabilityWorkspaceContext {
  const target = destination();
  return {
    sourceMapId: "MAP_A",
    maps: {
      MAP_A: { mapJson: sourceMap },
      MAP_B: {
        mapJson: target,
        width: 5,
        height: 5,
        map: map(blocked),
        atlas,
      },
    },
  };
}

function has(report: GameImplementabilityReport, code: string) {
  return report.issues.some((issue) => issue.code === code);
}

describe("warpEndpointSafety", () => {
  it("keeps a verified destination spawn Game-ready", () => {
    const mapJson = source();
    const report = withWarpEndpointSafetyAudit(
      baseReport(),
      mapJson,
      workspace(mapJson),
    );
    expect(report.implementable).toBe(true);
    expect(has(report, "WARP_DEST_SPAWN_OK")).toBe(true);
  });

  it("blocks a warp whose destination event lands on hard collision", () => {
    const mapJson = source();
    const report = withWarpEndpointSafetyAudit(
      baseReport(),
      mapJson,
      workspace(mapJson, true),
    );
    expect(report.pass).toBe(false);
    expect(report.implementable).toBe(false);
    expect(has(report, "WARP_DEST_SPAWN_BLOCKED")).toBe(true);
  });

  it("downgrades when destination map.bin/behavior is unavailable", () => {
    const mapJson = source();
    const context = workspace(mapJson);
    context.maps.MAP_B = { mapJson: destination(), width: 5, height: 5 };
    const report = withWarpEndpointSafetyAudit(baseReport(), mapJson, context);
    expect(report.pass).toBe(true);
    expect(report.implementable).toBe(false);
    expect(has(report, "WARP_DEST_SPAWN_UNVERIFIED")).toBe(true);
  });
});
