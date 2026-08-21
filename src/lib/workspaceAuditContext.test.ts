import { afterEach, describe, expect, it } from "vitest";
import type { EditableMapJson } from "./eventMapJson";
import {
  clearWorkspaceAuditContext,
  getWorkspaceAuditContext,
  referencedWorkspaceMapIds,
  referencedWorkspaceSharedEventNames,
  setWorkspaceAuditContext,
  sharedEventsContextKey,
} from "./workspaceAuditContext";

afterEach(() => clearWorkspaceAuditContext());

describe("workspaceAuditContext", () => {
  it("collects only real map dependencies and never treats MAP_DYNAMIC as a file", () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
      warp_events: [
        { x: 1, y: 1, dest_map: "MAP_B", dest_warp_id: "0" },
        { x: 2, y: 1, dest_map: "MAP_DYNAMIC", dest_warp_id: "WARP_ID_DYNAMIC" },
        { x: 3, y: 1, dest_map: "MAP_C", dest_warp_id: 2 },
        { x: 4, y: 1, dest_map: "MAP_E", dest_warp_id: "WARP_ID_NONE" },
      ],
      connections: [
        { map: "MAP_D", offset: 0, direction: "up" },
        { map: "MAP_B", offset: 1, direction: "left" },
      ],
    };
    expect(referencedWorkspaceMapIds(document)).toEqual(["MAP_B", "MAP_C", "MAP_D", "MAP_E"]);
  });

  it("keeps self references visible to the dependency planner", () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
      warp_events: [{ x: 1, y: 1, dest_map: "MAP_A", dest_warp_id: "0" }],
      connections: [],
    };
    expect(referencedWorkspaceMapIds(document)).toEqual(["MAP_A"]);
  });

  it("tracks shared_events_map by map name without pretending it is a MAP_* id", () => {
    const document: EditableMapJson = {
      id: "MAP_CONTEST_HALL_CUTE",
      name: "ContestHallCute",
      layout: "LAYOUT_CONTEST_HALL_CUTE",
      shared_events_map: "ContestHall",
      connections: null,
    };
    expect(referencedWorkspaceSharedEventNames(document)).toEqual(["ContestHall"]);
    expect(referencedWorkspaceMapIds(document)).toEqual([]);
    expect(sharedEventsContextKey("ContestHall")).toBe("@shared-events:ContestHall");
  });

  it("keeps active context explicit and clearable", () => {
    const context = { sourceMapId: "MAP_A", maps: { MAP_A: { mapJson: { id: "MAP_A" } } } };
    setWorkspaceAuditContext(context);
    expect(getWorkspaceAuditContext()).toBe(context);
    clearWorkspaceAuditContext();
    expect(getWorkspaceAuditContext()).toBeNull();
  });
});
