import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  PORTO_DAS_REDES_HEIGHT,
  PORTO_DAS_REDES_PROMPT,
  PORTO_DAS_REDES_WIDTH,
  portoDasRedesGuard,
} from "./portoDasRedesPreset";

describe("piloto Porto das Redes", () => {
  it("libera apenas no Dewford real 20x20 com General + Dewford", () => {
    expect(portoDasRedesGuard({
      width: 20,
      height: 20,
      mapId: "MAP_DEWFORD_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Dewford",
    }).enabled).toBe(true);

    expect(portoDasRedesGuard({ width: 40, height: 20, mapId: "MAP_DEWFORD_TOWN" }).enabled).toBe(false);
    expect(portoDasRedesGuard({ width: 20, height: 20, mapId: "MAP_LAVARIDGE_TOWN" }).enabled).toBe(false);
    expect(portoDasRedesGuard({
      width: 20,
      height: 20,
      mapId: "MAP_DEWFORD_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Lavaridge",
    }).enabled).toBe(false);
  });

  it("separa vila, cais, verdes e preservações dentro do layout real", () => {
    expect(isAiRemodelPrompt(PORTO_DAS_REDES_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(PORTO_DAS_REDES_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(18);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(12);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "port")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(3);

    const boarding = layered.zones.find((zone) => zone.label.includes("embarque Briney"));
    expect(boarding).toMatchObject({ x1: 11, x2: 13, y1: 7, y2: 10, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(PORTO_DAS_REDES_WIDTH);
      expect(zone.y2).toBeLessThan(PORTO_DAS_REDES_HEIGHT);
    }
  });

  it("compila as duas conexões reais sem structures artificiais", () => {
    const parsed = parseDetailedMapCommand(PORTO_DAS_REDES_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE106", offset: -60 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE107", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
