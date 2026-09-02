import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  CASA_DA_FOGUEIRA_HEIGHT,
  CASA_DA_FOGUEIRA_PROMPT,
  CASA_DA_FOGUEIRA_WIDTH,
  casaDaFogueiraGuard,
} from "./casaDaFogueiraPreset";

describe("piloto Casa da Fogueira", () => {
  it("libera apenas no Pacifidlog real 20x40 com General + Pacifidlog", () => {
    expect(casaDaFogueiraGuard({
      width: 20,
      height: 40,
      mapId: "MAP_PACIFIDLOG_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Pacifidlog",
    }).enabled).toBe(true);

    expect(casaDaFogueiraGuard({ width: 20, height: 30, mapId: "MAP_PACIFIDLOG_TOWN" }).enabled).toBe(false);
    expect(casaDaFogueiraGuard({ width: 20, height: 40, mapId: "MAP_VERDANTURF_TOWN" }).enabled).toBe(false);
  });

  it("remodela só plataformas e declara água/costa como preservação seletiva", () => {
    expect(isAiRemodelPrompt(CASA_DA_FOGUEIRA_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(CASA_DA_FOGUEIRA_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(12);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(8);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(4);

    const northWater = layered.zones.find((zone) => zone.label.includes("aquática norte"));
    const southWater = layered.zones.find((zone) => zone.label.includes("aquática sul"));
    expect(northWater).toMatchObject({ x1: 0, x2: 19, y1: 0, y2: 10 });
    expect(southWater).toMatchObject({ x1: 0, x2: 19, y1: 28, y2: 39 });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(CASA_DA_FOGUEIRA_WIDTH);
      expect(zone.y2).toBeLessThan(CASA_DA_FOGUEIRA_HEIGHT);
    }
  });

  it("compila exatamente as duas conexões marítimas reais", () => {
    const parsed = parseDetailedMapCommand(CASA_DA_FOGUEIRA_PROMPT, [], [], 20, 40);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE132", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE131", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
