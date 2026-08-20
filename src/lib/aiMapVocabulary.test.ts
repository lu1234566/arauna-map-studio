import { describe, expect, it } from "vitest";
import { createEmptyMap, idx } from "./emeraldMap";
import { deriveMapPatterns, deriveMapSmartPaths } from "./aiMapVocabulary";

const scope = { primary: "gTileset_General", secondary: "gTileset_Slateport" };

describe("AI map vocabulary", () => {
  it("extracts a semantic raw building pattern with an entrance port from a real warp", () => {
    const map = createEmptyMap(20, 20, 1);
    for (let y = 4; y <= 10; y++) {
      for (let x = 5; x <= 15; x++) map.metatiles[idx(x, y, map.width)] = 0x220 + ((x + y) % 5);
    }

    const patterns = deriveMapPatterns(map, [{
      source: "warp",
      sourceIndex: 3,
      x: 10,
      y: 10,
      detail: "→ MAP_SLATEPORT_CITY_OCEANIC_MUSEUM_1F · warp 0 · elev 3",
    }], "SlateportCity", scope, null);

    const museum = patterns.find((pattern) => pattern.name === "Museu Oceanográfico — completo");
    expect(museum).toBeTruthy();
    expect(museum?.kind).toBe("raw");
    expect(museum?.scope).toEqual(scope);
    expect(museum?.ports?.[0]?.id).toBe("entrada");
    expect(museum?.values).toHaveLength((museum?.width ?? 0) * (museum?.height ?? 0));
  });

  it("creates conservative Smart Paths from frequent walkable metatiles", () => {
    const map = createEmptyMap(12, 12, 1);
    for (let x = 1; x < 11; x++) {
      map.metatiles[idx(x, 6, map.width)] = 2;
    }
    for (let y = 2; y < 10; y++) {
      map.metatiles[idx(6, y, map.width)] = 3;
    }

    const paths = deriveMapSmartPaths(map, "SlateportCity", scope, null);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]?.variants).toHaveLength(16);
    expect(new Set(paths[0]?.variants).size).toBe(1);
    expect(paths[0]?.eraseMetatile).not.toBe(paths[0]?.variants[0]);
    expect(paths[0]?.scope).toEqual(scope);
  });
});
