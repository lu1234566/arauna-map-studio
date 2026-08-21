import { describe, expect, it } from "vitest";
import {
  parseScriptSpatialContracts,
  uniqueScriptAnchorCells,
} from "./scriptSpatialContracts";

const SLATEPORT_EXCERPT = `
SlateportCity_EventScript_MovePeopleForSternInterview::
\tsetobjectxyperm LOCALID_SLATEPORT_CAPT_STERN, 28, 13
\tsetobjectxyperm LOCALID_SLATEPORT_OLD_WOMAN, 25, 13
\tsetobjectxyperm LOCALID_SLATEPORT_RICH_BOY, 25, 14
\tsetobjectxyperm LOCALID_SLATEPORT_COOK, 27, 16
\tsetobjectxyperm LOCALID_SLATEPORT_GIRL, 28, 16
\tsetobjectxyperm LOCALID_SLATEPORT_FAT_MAN, 29, 16
\tsetobjectxyperm LOCALID_SLATEPORT_MAN_1, 31, 14
\treturn

SlateportCity_EventScript_SetReadyForScottScene::
\tsetobjectxyperm LOCALID_SLATEPORT_SCOTT, 23, 27
\treturn

SlateportCity_EventScript_MoveScottLeft::
\tsetobjectxyperm LOCALID_SLATEPORT_SCOTT, 22, 27
\treturn

SlateportCity_EventScript_ScottScene::
\tapplymovement LOCALID_SLATEPORT_SCOTT, SlateportCity_Movement_ScottApproachPlayer
\twaitmovement 0
\treturn

SlateportCity_Movement_ScottApproachPlayer:
\twalk_right
\twalk_right
\twalk_right
\twalk_right
\twalk_right
\twalk_right
\twalk_right
\tstep_end

SlateportCity_Movement_PlayerFaceScott:
\tdelay_16
\twalk_in_place_faster_left
\tstep_end
`;

describe("scriptSpatialContracts", () => {
  it("extracts all dynamic Slateport anchors without interpreting story logic", () => {
    const contracts = parseScriptSpatialContracts(SLATEPORT_EXCERPT);
    expect(contracts.anchors).toHaveLength(9);
    expect(contracts.anchors[0]).toMatchObject({
      command: "setobjectxyperm",
      localId: "LOCALID_SLATEPORT_CAPT_STERN",
      x: 28,
      y: 13,
      scriptLabel: "SlateportCity_EventScript_MovePeopleForSternInterview",
    });
    expect(contracts.anchors.filter((anchor) => anchor.localId === "LOCALID_SLATEPORT_SCOTT").map((anchor) => [anchor.x, anchor.y])).toEqual([
      [23, 27],
      [22, 27],
    ]);
  });

  it("extracts applymovement references and deterministic local movement geometry", () => {
    const contracts = parseScriptSpatialContracts(SLATEPORT_EXCERPT);
    expect(contracts.movementUses).toEqual([
      expect.objectContaining({
        localId: "LOCALID_SLATEPORT_SCOTT",
        movementLabel: "SlateportCity_Movement_ScottApproachPlayer",
      }),
    ]);
    const movement = contracts.movements.SlateportCity_Movement_ScottApproachPlayer;
    expect(movement?.deterministic).toBe(true);
    expect(movement?.steps).toHaveLength(7);
    expect(movement?.steps.every((step) => step.dx === 1 && step.dy === 0)).toBe(true);
  });

  it("does not misclassify in-place animation as spatial movement", () => {
    const contracts = parseScriptSpatialContracts(SLATEPORT_EXCERPT);
    const movement = contracts.movements.SlateportCity_Movement_PlayerFaceScott;
    expect(movement?.deterministic).toBe(true);
    expect(movement?.steps).toEqual([]);
  });

  it("deduplicates cells while retaining every reason", () => {
    const contracts = parseScriptSpatialContracts(`
A::
  setobjectxyperm LOCALID_A, 5, 6
  setobjectxy LOCALID_B, 5, 6
  end
`);
    expect(uniqueScriptAnchorCells(contracts)).toEqual([
      {
        x: 5,
        y: 6,
        reasons: [
          "setobjectxyperm LOCALID_A em A",
          "setobjectxy LOCALID_B em A",
        ],
      },
    ]);
  });

  it("parses hexadecimal numeric coordinates but leaves symbolic coordinates unresolved", () => {
    const contracts = parseScriptSpatialContracts(`
A::
  setobjectxy LOCALID_A, 0x10, 0x0F
  setobjectxy LOCALID_B, VAR_0x8004, 3
`);
    expect(contracts.anchors).toEqual([
      expect.objectContaining({ localId: "LOCALID_A", x: 16, y: 15 }),
    ]);
  });
});
