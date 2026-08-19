import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorStore } from "./editorStore";
import type { AraunaWorkspace } from "./repoWorkspace";
import type { WorkspaceSession } from "./workspaceSession";
import { prepareWorkspaceTransition } from "./workspaceSwitchGuard";

function readOnlySession(): WorkspaceSession {
  const workspace: AraunaWorkspace = {
    files: new Map(),
    filesLower: new Map(),
    layouts: new Map(),
    maps: [],
    tilesets: [],
  };
  return {
    workspace,
    label: "data",
    openedAt: new Date(0).toISOString(),
    lastMapPath: "data/maps/Test/map.json",
    writeAccess: null,
  };
}

beforeEach(() => {
  editorStore.newMap();
  editorStore.setViewMode("visual");
  editorStore.setMetatile(1);
});

describe("workspace switch guard", () => {
  it("does not prompt when there are no changes", async () => {
    const confirm = vi.fn(() => false);
    const result = await prepareWorkspaceTransition(readOnlySession(), confirm);
    expect(result.proceed).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("cancels a read-only transition when the user refuses to discard", async () => {
    editorStore.paint(0, 0);
    const confirm = vi.fn(() => false);
    const result = await prepareWorkspaceTransition(readOnlySession(), confirm);
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe("cancelled");
    expect(editorStore.getState().dirty).toBe(true);
  });

  it("allows a read-only transition only after explicit discard confirmation", async () => {
    editorStore.paint(0, 0);
    const confirm = vi.fn(() => true);
    const result = await prepareWorkspaceTransition(readOnlySession(), confirm);
    expect(result.proceed).toBe(true);
    expect(result.saved).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
