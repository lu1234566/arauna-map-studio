import { describe, expect, it } from "vitest";
import {
  expectedMapBinBytes,
  normalizeTilesetKey,
  normalizeWorkspacePath,
  parseLayoutsSource,
  resolveTilesetDirectory,
  type WorkspaceTilesetDirectory,
} from "./repoWorkspace";

describe("Arauna repository workspace helpers", () => {
  it("normaliza caminhos escolhidos pela raiz do repo ou pela pasta data", () => {
    expect(normalizeWorkspacePath("pokemon-juramento-de-arauna/data/maps/LittlerootTown/map.json"))
      .toBe("data/maps/LittlerootTown/map.json");
    expect(normalizeWorkspacePath("data/layouts/LittlerootTown/map.bin"))
      .toBe("data/layouts/LittlerootTown/map.bin");
    expect(normalizeWorkspacePath("repo\\data\\tilesets\\primary\\general\\tiles.png"))
      .toBe("data/tilesets/primary/general/tiles.png");
  });

  it("normaliza símbolos de tileset independentemente de case e separadores", () => {
    expect(normalizeTilesetKey("gTileset_General")).toBe("general");
    expect(normalizeTilesetKey("gTileset_Battle_Frontier")).toBe("battlefrontier");
    expect(normalizeTilesetKey("battle-frontier")).toBe("battlefrontier");
  });

  it("faz parse do layouts.json com dimensões variáveis", () => {
    const layouts = parseLayoutsSource(JSON.stringify({
      layouts: [
        {
          id: "LAYOUT_LITTLEROOT_TOWN",
          name: "LittlerootTown_Layout",
          width: 20,
          height: 20,
          primary_tileset: "gTileset_General",
          secondary_tileset: "gTileset_Petalburg",
          border_filepath: "data/layouts/LittlerootTown/border.bin",
          blockdata_filepath: "data/layouts/LittlerootTown/map.bin",
        },
        {
          id: "LAYOUT_ROUTE110",
          name: "Route110_Layout",
          width: 40,
          height: 100,
          primary_tileset: "gTileset_General",
          secondary_tileset: "gTileset_Mauville",
          border_filepath: "data/layouts/Route110/border.bin",
          blockdata_filepath: "data/layouts/Route110/map.bin",
        },
      ],
    }));

    expect(layouts).toHaveLength(2);
    expect(layouts[0]?.width).toBe(20);
    expect(layouts[1]?.height).toBe(100);
    expect(layouts[1]?.blockdata_filepath).toBe("data/layouts/Route110/map.bin");
  });

  it("calcula tamanho exato de map.bin para qualquer dimensão", () => {
    expect(expectedMapBinBytes(20, 20)).toBe(800);
    expect(expectedMapBinBytes(40, 100)).toBe(8000);
    expect(() => expectedMapBinBytes(0, 20)).toThrow();
  });

  it("resolve diretório a partir do símbolo gTileset_*", () => {
    const tilesets: WorkspaceTilesetDirectory[] = [
      { side: "primary", name: "general", path: "data/tilesets/primary/general", key: "general" },
      { side: "secondary", name: "battle_frontier", path: "data/tilesets/secondary/battle_frontier", key: "battlefrontier" },
    ];
    expect(resolveTilesetDirectory(tilesets, "primary", "gTileset_General")?.name).toBe("general");
    expect(resolveTilesetDirectory(tilesets, "secondary", "gTileset_BattleFrontier")?.name).toBe("battle_frontier");
  });
});
