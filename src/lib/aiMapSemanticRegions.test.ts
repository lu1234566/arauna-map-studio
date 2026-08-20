import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { deriveSemanticEventPatterns, deriveSemanticEventSmartPaths } from "./aiMapSemanticRegions";

const scope = { primary: "gTileset_General", secondary: "gTileset_Slateport" };

describe("semantic real-map AI vocabulary", () => {
  it("extracts a fixed open-market RAW region from market employee events", () => {
    const map = createEmptyMap(30, 30, 1);
    const patterns = deriveSemanticEventPatterns(map, [
      { source: "object", sourceIndex: 0, x: 5, y: 20, detail: "OBJ_EVENT_GFX_MART_EMPLOYEE · script DecorClerk" },
      { source: "object", sourceIndex: 1, x: 10, y: 24, detail: "OBJ_EVENT_GFX_MART_EMPLOYEE · script DollClerk" },
    ], "SlateportCity", scope);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.name).toBe("Mercado aberto real");
    expect(patterns[0]?.tags.some((tag) => tag.startsWith("fixed-origin:"))).toBe(true);
    expect(patterns[0]?.kind).toBe("raw");
  });

  it("uses the walkable tiles below real doors as an urban access path seed", () => {
    const map = createEmptyMap(20, 20, 1);
    // Base ground is id 1; approaches below two warps use id 7.
    map.metatiles[idx(5, 6, map.width)] = 7;
    map.metatiles[idx(5, 7, map.width)] = 7;
    map.metatiles[idx(12, 6, map.width)] = 7;
    map.metatiles[idx(12, 7, map.width)] = 7;
    const paths = deriveSemanticEventSmartPaths(map, [
      { source: "warp", sourceIndex: 0, x: 5, y: 5, detail: "→ MAP_A" },
      { source: "warp", sourceIndex: 1, x: 12, y: 5, detail: "→ MAP_B" },
    ], "SlateportCity", scope);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.name).toBe("Via urbana pelos acessos reais");
    expect(new Set(paths[0]?.variants)).toEqual(new Set([7]));
    expect(paths[0]?.eraseMetatile).toBe(1);
  });
});
