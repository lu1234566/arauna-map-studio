import { describe, expect, it } from "vitest";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import { auditScriptSpatialContracts } from "./scriptSpatialAudit";
import { parseScriptSpatialContracts } from "./scriptSpatialContracts";

function map(): MapData {
  return {
    width: 40,
    height: 60,
    metatiles: Uint16Array.from({ length: 40 * 60 }, () => 1),
    physical: Uint16Array.from({ length: 40 * 60 }, () => 0x3000),
  };
}

function events(): EditableMapJson {
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
        elevation: 0,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 1,
        movement_range_y: 2,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "0x0",
        flag: "FLAG_HIDE_SLATEPORT_CITY_SCOTT",
      },
    ],
  };
}

const SOURCE = `
SlateportCity_EventScript_SetReadyForScottScene::
  setobjectxyperm LOCALID_SLATEPORT_SCOTT, 23, 27
  return

SlateportCity_EventScript_ScottScene::
  applymovement LOCALID_SLATEPORT_SCOTT, SlateportCity_Movement_ScottApproachPlayer
  waitmovement 0
  return

SlateportCity_Movement_ScottApproachPlayer:
  walk_right
  walk_right
  walk_right
  walk_right
  walk_right
  walk_right
  walk_right
  step_end
`;

function codes(source: string, mapData = map(), eventDocument = events()) {
  return auditScriptSpatialContracts(
    parseScriptSpatialContracts(source),
    mapData,
    eventDocument,
  );
}

describe("scriptSpatialAudit", () => {
  it("certifies Slateport runtime anchors and finds a safe cutscene path", () => {
    const issues = codes(SOURCE);
    expect(issues.some((issue) => issue.code === "SCRIPT_OBJECT_ANCHOR_OK")).toBe(true);
    expect(issues.some((issue) => issue.code === "SCRIPT_MOVEMENT_HAS_SAFE_PATH")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("blocks a runtime anchor outside the map", () => {
    const issues = codes(`
A::
  setobjectxyperm LOCALID_SLATEPORT_SCOTT, 40, 61
`);
    expect(issues).toContainEqual(expect.objectContaining({
      code: "SCRIPT_OBJECT_ANCHOR_OUT_OF_BOUNDS",
      severity: "error",
    }));
  });

  it("flags a runtime anchor painted over by hard collision", () => {
    const blocked = map();
    blocked.physical[27 * blocked.width + 23] = 0x3400;
    const issues = codes(SOURCE, blocked);
    expect(issues).toContainEqual(expect.objectContaining({
      code: "SCRIPT_OBJECT_ANCHOR_BLOCKED",
      severity: "warning",
      x: 23,
      y: 27,
    }));
  });

  it("detects LOCALID names that no longer exist after event refactors", () => {
    const issues = codes(`
A::
  setobjectxyperm LOCALID_REMOVED_STORY_NPC, 5, 5
`);
    expect(issues).toContainEqual(expect.objectContaining({
      code: "SCRIPT_OBJECT_LOCALID_MISSING",
      severity: "error",
    }));
  });

  it("also catches a removed story NPC referenced only by applymovement", () => {
    const issues = codes(`
A::
  applymovement LOCALID_REMOVED_STORY_NPC, A_Movement
  end
A_Movement:
  walk_right
  step_end
`);
    expect(issues).toContainEqual(expect.objectContaining({
      code: "SCRIPT_MOVEMENT_LOCALID_MISSING",
      severity: "error",
      localId: "LOCALID_REMOVED_STORY_NPC",
    }));
  });

  it("never requires an object_event template for engine-reserved LOCALID_PLAYER/CAMERA", () => {
    const issues = codes(`
A::
  applymovement LOCALID_PLAYER, A_PlayerMovement
  applymovement LOCALID_CAMERA, A_CameraMovement
  end
A_PlayerMovement:
  walk_right
  step_end
A_CameraMovement:
  walk_left
  step_end
`);
    expect(issues.some((issue) => issue.code === "SCRIPT_MOVEMENT_LOCALID_MISSING")).toBe(false);
    expect(issues.some((issue) => issue.code === "SCRIPT_OBJECT_LOCALID_MISSING")).toBe(false);
  });

  it("keeps uncertain movement geometry as review warning rather than inventing an engine failure", () => {
    const blocked = map();
    for (let x = 10; x <= 30; x++) blocked.physical[12 * blocked.width + x] = 0x3400;
    for (let x = 23; x <= 30; x++) blocked.physical[27 * blocked.width + x] = 0x3400;
    const issues = codes(SOURCE, blocked);
    expect(issues.some((issue) => issue.code === "SCRIPT_MOVEMENT_NO_KNOWN_SAFE_PATH")).toBe(true);
    expect(issues.find((issue) => issue.code === "SCRIPT_MOVEMENT_NO_KNOWN_SAFE_PATH")?.severity).toBe("warning");
  });
});
