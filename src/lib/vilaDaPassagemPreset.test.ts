import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  VILA_DA_PASSAGEM_HEIGHT,
  VILA_DA_PASSAGEM_PROMPT,
  VILA_DA_PASSAGEM_WIDTH,
  vilaDaPassagemGuard,
} from "./vilaDaPassagemPreset";

describe("piloto Vila da Passagem", () => {
  it("libera apenas no Oldale real 20x20 com General + Petalburg", () => {
    expect(vilaDaPassagemGuard({
      width: 20,
      height: 20,
      mapId: "MAP_OLDALE_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Petalburg",
    }).enabled).toBe(true);

    expect(vilaDaPassagemGuard({ width: 30, height: 20, mapId: "MAP_OLDALE_TOWN" }).enabled).toBe(false);
    expect(vilaDaPassagemGuard({ width: 20, height: 20, mapId: "MAP_LITTLEROOT_TOWN" }).enabled).toBe(false);
  });

  it("modela o cruzamento e mantém os dois corredores narrativos congelados", () => {
    expect(isAiRemodelPrompt(VILA_DA_PASSAGEM_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(VILA_DA_PASSAGEM_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(18);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(13);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(5);

    const rival = layered.zones.find((zone) => zone.label.includes("rival sul"));
    expect(rival).toMatchObject({ x1: 7, x2: 12, y1: 18, y2: 19, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(VILA_DA_PASSAGEM_WIDTH);
      expect(zone.y2).toBeLessThan(VILA_DA_PASSAGEM_HEIGHT);
    }
  });

  it("compila exatamente as três conexões reais", () => {
    const parsed = parseDetailedMapCommand(VILA_DA_PASSAGEM_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE103", offset: 0 }),
      expect.objectContaining({ direction: "south", map: "MAP_ROUTE101", offset: 0 }),
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE102", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(3);
  });
});
