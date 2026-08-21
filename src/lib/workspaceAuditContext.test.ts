import { afterEach, describe, expect, it } from "vitest";
import type { EditableMapJson } from "./eventMapJson";
import {
  clearWorkspaceAuditContext,
  getWorkspaceAuditContext,
  referencedWorkspaceMapIds,
  setWorkspaceAuditContext,
} from "./workspaceAuditContext";

afterEach(() => clearWorkspaceAuditContext());

describe("workspaceAuditContext", () => {
  it("collects only static warp destinations and direct connection neighbors", () => {
    const document: EditableMapJson = {
      id: "MAP_A",
      name: "A",
      layout: "LAYOUT_A",
      warp_events: [
        { x: 1, y: 1, dest_map: "MAP_B", dest_warp_id: "0" },
        { x: 2, y: 1, dest_map: "MAP_DYNAMIC", dest_warp_id: "-1" },
        { x: 3, y: 1, dest_map: "MAP_C", dest_warp_id: 2 },
      ],
      connections: [
        { map: "MAP_D", offset: 0, direction: "up" },
        { map: "MAP_B", offset: 1, direction: "left" },
      ],
    };
    expect(referencedWorkspaceMapIds(document)).toEqual(["MAP_B", "MAP_C", "MAP_D"]);
  });

  it("keeps active context explicit and clearable", () => {
    const context = { sourceMapId: "MAP_A", maps: { MAP_A: { mapJson: { id: "MAP_A" } } } };
    setWorkspaceAuditContext(context);
    expect(getWorkspaceAuditContext()).toBe(context);
    clearWorkspaceAuditContext();
    expect(getWorkspaceAuditContext()).toBeNull();
  });
});
