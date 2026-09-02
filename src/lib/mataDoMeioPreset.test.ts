import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  MATA_DO_MEIO_HEIGHT,
  MATA_DO_MEIO_PROMPT,
  MATA_DO_MEIO_WIDTH,
  mataDoMeioGuard,
} from "./mataDoMeioPreset";

describe("piloto Mata do Meio", () => {
  it("libera apenas no Fortree real 40x20 com General + Fortree", () => {
    expect(mataDoMeioGuard({
      width: 40,
      height: 20,
      mapId: "MAP_FORTREE_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Fortree",
    }).enabled).toBe(true);

    expect(mataDoMeioGuard({ width: 20, height: 20, mapId: "MAP_FORTREE_CITY" }).enabled).toBe(false);
    expect(mataDoMeioGuard({ width: 40, height: 20, mapId: "MAP_MAUVILLE_CITY" }).enabled).toBe(false);
    expect(mataDoMeioGuard({
      width: 40,
      height: 20,
      mapId: "MAP_FORTREE_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Mauville",
    }).enabled).toBe(false);
  });

  it("modela a mata em camadas e declara preservação das passarelas", () => {
    expect(isAiRemodelPrompt(MATA_DO_MEIO_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(MATA_DO_MEIO_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(18);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(12);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(8);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(1);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(3);
    expect(MATA_DO_MEIO_PROMPT).toMatch(/Exact Grid elevation safety/i);
    expect(MATA_DO_MEIO_PROMPT).toMatch(/passarelas/i);

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(MATA_DO_MEIO_WIDTH);
      expect(zone.y2).toBeLessThan(MATA_DO_MEIO_HEIGHT);
    }
  });

  it("compila as duas conexões reais sem structures artificiais", () => {
    const parsed = parseDetailedMapCommand(MATA_DO_MEIO_PROMPT, [], [], 40, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE119", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE120", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
