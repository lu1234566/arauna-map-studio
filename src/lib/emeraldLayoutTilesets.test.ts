import { describe, expect, it } from "vitest";
import { secondaryTilesetForEmeraldLayout } from "./emeraldLayoutTilesets";
import { normalizeEmeraldSecondary } from "./pretEmeraldBootstrap";

describe("Emerald layout tileset detection", () => {
  it("maps Slateport to the real Slateport secondary tileset", () => {
    expect(secondaryTilesetForEmeraldLayout("LAYOUT_SLATEPORT_CITY")).toBe("gTileset_Slateport");
  });

  it("normalizes CamelCase symbols to pret/pokeemerald directory names", () => {
    expect(normalizeEmeraldSecondary("gTileset_Slateport")).toEqual({
      directory: "slateport",
      symbol: "gTileset_Slateport",
    });
    expect(normalizeEmeraldSecondary("gTileset_EverGrande")).toEqual({
      directory: "ever_grande",
      symbol: "gTileset_EverGrande",
    });
  });
});
