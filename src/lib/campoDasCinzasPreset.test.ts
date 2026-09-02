import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  CAMPO_DAS_CINZAS_HEIGHT,
  CAMPO_DAS_CINZAS_PROMPT,
  CAMPO_DAS_CINZAS_WIDTH,
  campoDasCinzasGuard,
} from "./campoDasCinzasPreset";

describe("piloto Campo das Cinzas", () => {
  it("libera apenas no Fallarbor real 20x20 com General + Fallarbor", () => {
    expect(campoDasCinzasGuard({
      width: 20,
      height: 20,
      mapId: "MAP_FALLARBOR_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Fallarbor",
    }).enabled).toBe(true);

    expect(campoDasCinzasGuard({ width: 30, height: 20, mapId: "MAP_FALLARBOR_TOWN" }).enabled).toBe(false);
    expect(campoDasCinzasGuard({ width: 20, height: 20, mapId: "MAP_OLDALE_TOWN" }).enabled).toBe(false);
  });

  it("organiza a travessia leste-oeste sem perder o canto do item oculto", () => {
    expect(isAiRemodelPrompt(CAMPO_DAS_CINZAS_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(CAMPO_DAS_CINZAS_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(14);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(3);

    const secret = layered.zones.find((zone) => zone.label.includes("item oculto"));
    expect(secret).toMatchObject({ x1: 0, x2: 3, y1: 13, y2: 18, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(CAMPO_DAS_CINZAS_WIDTH);
      expect(zone.y2).toBeLessThan(CAMPO_DAS_CINZAS_HEIGHT);
    }
  });

  it("compila exatamente as duas conexões reais", () => {
    const parsed = parseDetailedMapCommand(CAMPO_DAS_CINZAS_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE114", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE113", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
