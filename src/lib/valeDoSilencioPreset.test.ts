import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  VALE_DO_SILENCIO_HEIGHT,
  VALE_DO_SILENCIO_PROMPT,
  VALE_DO_SILENCIO_WIDTH,
  valeDoSilencioGuard,
} from "./valeDoSilencioPreset";

describe("piloto Vale do Silêncio", () => {
  it("libera apenas no Verdanturf real 20x20 com General + Mauville", () => {
    expect(valeDoSilencioGuard({
      width: 20,
      height: 20,
      mapId: "MAP_VERDANTURF_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Mauville",
    }).enabled).toBe(true);

    expect(valeDoSilencioGuard({ width: 30, height: 20, mapId: "MAP_VERDANTURF_TOWN" }).enabled).toBe(false);
    expect(valeDoSilencioGuard({ width: 20, height: 20, mapId: "MAP_FALLARBOR_TOWN" }).enabled).toBe(false);
  });

  it("mantém o túnel como zona funcional própria e organiza o refúgio ao redor", () => {
    expect(isAiRemodelPrompt(VALE_DO_SILENCIO_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(VALE_DO_SILENCIO_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(15);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(3);

    const tunnel = layered.zones.find((zone) => zone.label.includes("Rusturf Tunnel"));
    expect(tunnel).toMatchObject({ x1: 6, x2: 10, y1: 0, y2: 3, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(VALE_DO_SILENCIO_WIDTH);
      expect(zone.y2).toBeLessThan(VALE_DO_SILENCIO_HEIGHT);
    }
  });

  it("compila exatamente as duas conexões externas reais", () => {
    const parsed = parseDetailedMapCommand(VALE_DO_SILENCIO_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE116", offset: -80 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE117", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
