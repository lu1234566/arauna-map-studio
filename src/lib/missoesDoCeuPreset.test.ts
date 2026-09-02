import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  MISSOES_DO_CEU_HEIGHT,
  MISSOES_DO_CEU_PROMPT,
  MISSOES_DO_CEU_WIDTH,
  missoesDoCeuGuard,
} from "./missoesDoCeuPreset";

describe("piloto Missões do Céu", () => {
  it("libera apenas no Mossdeep real 80x40 com General + Mossdeep", () => {
    expect(missoesDoCeuGuard({
      width: 80,
      height: 40,
      mapId: "MAP_MOSSDEEP_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Mossdeep",
    }).enabled).toBe(true);

    expect(missoesDoCeuGuard({ width: 40, height: 40, mapId: "MAP_MOSSDEEP_CITY" }).enabled).toBe(false);
    expect(missoesDoCeuGuard({ width: 80, height: 40, mapId: "MAP_FORTREE_CITY" }).enabled).toBe(false);
    expect(missoesDoCeuGuard({
      width: 80,
      height: 40,
      mapId: "MAP_MOSSDEEP_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Fortree",
    }).enabled).toBe(false);
  });

  it("separa setores, verdes, vias e blocos preservados no layout 80x40", () => {
    expect(isAiRemodelPrompt(MISSOES_DO_CEU_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(MISSOES_DO_CEU_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(27);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(18);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(9);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(8);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(9);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(6);

    const spaceCenter = layered.zones.find((zone) => zone.label.includes("Centro Espacial"));
    expect(spaceCenter).toMatchObject({ x1: 39, x2: 68, y1: 13, y2: 29, kind: "ground" });
    expect(MISSOES_DO_CEU_PROMPT).toMatch(/elevation safety/i);

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(MISSOES_DO_CEU_WIDTH);
      expect(zone.y2).toBeLessThan(MISSOES_DO_CEU_HEIGHT);
    }
  });

  it("compila exatamente as três conexões reais", () => {
    const parsed = parseDetailedMapCommand(MISSOES_DO_CEU_PROMPT, [], [], 80, 40);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE125", offset: 0 }),
      expect.objectContaining({ direction: "south", map: "MAP_ROUTE127", offset: 0 }),
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE124", offset: -40 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(3);
  });
});
