import { describe, expect, it } from "vitest";
import type { AraunaWorkspace, WorkspaceLayout, WorkspaceMap } from "./repoWorkspace";
import { activeWorkspaceLayout, parseRuntimeLayoutIds, runtimeLayoutsForMap } from "./runtimeWorkspaceLayouts";

function file(path: string, source: string): File {
  const value = new File([source], path.split("/").pop() ?? "file");
  Object.defineProperty(value, "webkitRelativePath", { value: path });
  return value;
}

function layout(id: string, path: string): WorkspaceLayout {
  return {
    id,
    name: `${id}_Layout`,
    width: 14,
    height: 14,
    primary_tileset: "gTileset_General",
    secondary_tileset: "gTileset_Pacifidlog",
    border_filepath: "",
    blockdata_filepath: path,
  };
}

function workspace(): { workspace: AraunaWorkspace; map: WorkspaceMap } {
  const base = layout("LAYOUT_SKY_PILLAR_1F", "data/layouts/SkyPillar_1F/map.bin");
  const clean = layout("LAYOUT_SKY_PILLAR_1F_CLEAN", "data/layouts/SkyPillar_1F_Clean/map.bin");
  const scriptPath = "data/maps/SkyPillar_1F/scripts.inc";
  const script = file(scriptPath, `
SkyPillar_1F_OnTransition:
  call_if_lt VAR_SKY_PILLAR_STATE, 2, SkyPillar_1F_EventScript_CleanFloor
  end
SkyPillar_1F_EventScript_CleanFloor:
  setmaplayoutindex LAYOUT_SKY_PILLAR_1F_CLEAN
  return
`);
  const files = new Map<string, File>([[scriptPath, script]]);
  const map: WorkspaceMap = {
    path: "data/maps/SkyPillar_1F/map.json",
    directory: "SkyPillar_1F",
    id: "MAP_SKY_PILLAR_1F",
    name: "SkyPillar_1F",
    layoutId: base.id,
    layout: base,
  };
  return {
    map,
    workspace: {
      files,
      filesLower: new Map([[scriptPath.toLowerCase(), script]]),
      layouts: new Map([[base.id, base], [clean.id, clean]]),
      maps: [map],
      tilesets: [],
    },
  };
}

describe("runtimeWorkspaceLayouts", () => {
  it("extrai setmaplayoutindex sem duplicar ids", () => {
    expect(parseRuntimeLayoutIds(`setmaplayoutindex LAYOUT_A\nsetmaplayoutindex LAYOUT_A\nsetmaplayoutindex LAYOUT_B`)).toEqual([
      "LAYOUT_A",
      "LAYOUT_B",
    ]);
  });

  it("descobre base + layout CLEAN do scripts.inc", async () => {
    const state = workspace();
    const layouts = await runtimeLayoutsForMap(state.workspace, state.map);
    expect(layouts.map((entry) => entry.layout.id)).toEqual([
      "LAYOUT_SKY_PILLAR_1F",
      "LAYOUT_SKY_PILLAR_1F_CLEAN",
    ]);
    expect(layouts[0]?.isBase).toBe(true);
    expect(layouts[1]?.source).toBe("setmaplayoutindex");
  });

  it("resolve o layout físico aberto pelo sourceFile, não pelo map.json", () => {
    const state = workspace();
    expect(activeWorkspaceLayout(state.workspace, "data/layouts/SkyPillar_1F_Clean/map.bin")?.id).toBe(
      "LAYOUT_SKY_PILLAR_1F_CLEAN",
    );
  });
});
