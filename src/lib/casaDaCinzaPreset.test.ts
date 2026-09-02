import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  CASA_DA_CINZA_HEIGHT,
  CASA_DA_CINZA_PROMPT,
  CASA_DA_CINZA_WIDTH,
  casaDaCinzaGuard,
} from "./casaDaCinzaPreset";

describe("piloto Casa da Cinza", () => {
  it("libera apenas no Lavaridge real 20x20 com General + Lavaridge", () => {
    expect(casaDaCinzaGuard({
      width: 20,
      height: 20,
      mapId: "MAP_LAVARIDGE_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Lavaridge",
    }).enabled).toBe(true);

    expect(casaDaCinzaGuard({ width: 40, height: 60, mapId: "MAP_LAVARIDGE_TOWN" }).enabled).toBe(false);
    expect(casaDaCinzaGuard({ width: 20, height: 20, mapId: "MAP_LITTLEROOT_TOWN" }).enabled).toBe(false);
    expect(casaDaCinzaGuard({
      width: 20,
      height: 20,
      mapId: "MAP_LAVARIDGE_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Petalburg",
    }).enabled).toBe(false);
  });

  it("preserva explicitamente o núcleo termal e organiza vias/base sem sair do mapa", () => {
    expect(isAiRemodelPrompt(CASA_DA_CINZA_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(CASA_DA_CINZA_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(13);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(7);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(1);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(2);

    const thermal = layered.zones.find((zone) => zone.label.includes("núcleo termal"));
    expect(thermal).toMatchObject({ x1: 2, x2: 7, y1: 1, y2: 6, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(CASA_DA_CINZA_WIDTH);
      expect(zone.y2).toBeLessThan(CASA_DA_CINZA_HEIGHT);
    }
  });

  it("compila layers + conexão leste real sem structures artificiais", () => {
    const parsed = parseDetailedMapCommand(CASA_DA_CINZA_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual([
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE112", offset: -40 }),
    ]);
  });
});
