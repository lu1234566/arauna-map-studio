import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  PORTO_DO_SAL_HEIGHT,
  PORTO_DO_SAL_PROMPT,
  PORTO_DO_SAL_WIDTH,
  portoDoSalGuard,
} from "./portoDoSalPreset";

describe("piloto Porto do Sal", () => {
  it("libera apenas no Slateport real 40x60 com General + Slateport", () => {
    expect(portoDoSalGuard({
      width: 40,
      height: 60,
      mapId: "MAP_SLATEPORT_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Slateport",
    }).enabled).toBe(true);

    expect(portoDoSalGuard({ width: 20, height: 20, mapId: "MAP_SLATEPORT_CITY" }).enabled).toBe(false);
    expect(portoDoSalGuard({ width: 40, height: 60, mapId: "MAP_RUSTBORO_CITY" }).enabled).toBe(false);
    expect(portoDoSalGuard({
      width: 40,
      height: 60,
      mapId: "MAP_SLATEPORT_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Rustboro",
    }).enabled).toBe(false);
  });

  it("separa base, vias e materiais portuários dentro do layout real", () => {
    expect(isAiRemodelPrompt(PORTO_DO_SAL_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(PORTO_DO_SAL_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(20);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(10);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(10);
    expect(layered.zones.filter((zone) => zone.material.role === "port")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(3);

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(PORTO_DO_SAL_WIDTH);
      expect(zone.y2).toBeLessThan(PORTO_DO_SAL_HEIGHT);
    }
  });

  it("compila layers + três conexões sem structures artificiais", () => {
    const parsed = parseDetailedMapCommand(PORTO_DO_SAL_PROMPT, [], [], 40, 60);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE110", offset: 0 }),
      expect.objectContaining({ direction: "south", map: "MAP_ROUTE109", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE134", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(3);
  });
});
