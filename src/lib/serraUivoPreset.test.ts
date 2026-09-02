import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  SERRA_UIVO_HEIGHT,
  SERRA_UIVO_PROMPT,
  SERRA_UIVO_WIDTH,
  serraUivoGuard,
} from "./serraUivoPreset";

describe("piloto Serra do Uivo", () => {
  it("libera apenas no Rustboro real 40x60 com General + Rustboro", () => {
    expect(serraUivoGuard({
      width: 40,
      height: 60,
      mapId: "MAP_RUSTBORO_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Rustboro",
    }).enabled).toBe(true);

    expect(serraUivoGuard({ width: 20, height: 20, mapId: "MAP_RUSTBORO_CITY" }).enabled).toBe(false);
    expect(serraUivoGuard({ width: 40, height: 60, mapId: "MAP_SLATEPORT_CITY" }).enabled).toBe(false);
    expect(serraUivoGuard({
      width: 40,
      height: 60,
      mapId: "MAP_RUSTBORO_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Slateport",
    }).enabled).toBe(false);
  });

  it("ativa reconstruction + camadas preservando o restante do mapa", () => {
    expect(isAiRemodelPrompt(SERRA_UIVO_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(SERRA_UIVO_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(20);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(9);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(11);
    expect(layered.zones.filter((zone) => zone.kind === "road").every((zone) => zone.material.role === "urban")).toBe(true);
    expect(layered.zones.filter((zone) => zone.kind === "ground").every((zone) => zone.material.role === "green")).toBe(true);

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(SERRA_UIVO_WIDTH);
      expect(zone.y2).toBeLessThan(SERRA_UIVO_HEIGHT);
    }
  });

  it("compila layers + três conexões sem inventar structures", () => {
    const parsed = parseDetailedMapCommand(SERRA_UIVO_PROMPT, [], [], 40, 60);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE115", offset: 0 }),
      expect.objectContaining({ direction: "south", map: "MAP_ROUTE104", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE116", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(3);
  });
});
