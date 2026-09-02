import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  ENCRUZILHADA_CENTRAL_HEIGHT,
  ENCRUZILHADA_CENTRAL_PROMPT,
  ENCRUZILHADA_CENTRAL_WIDTH,
  encruzilhadaCentralGuard,
} from "./encruzilhadaCentralPreset";

describe("piloto Encruzilhada Central", () => {
  it("libera apenas no Mauville real 40x20 com General + Mauville", () => {
    expect(encruzilhadaCentralGuard({
      width: 40,
      height: 20,
      mapId: "MAP_MAUVILLE_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Mauville",
    }).enabled).toBe(true);

    expect(encruzilhadaCentralGuard({ width: 20, height: 20, mapId: "MAP_MAUVILLE_CITY" }).enabled).toBe(false);
    expect(encruzilhadaCentralGuard({ width: 40, height: 20, mapId: "MAP_RUSTBORO_CITY" }).enabled).toBe(false);
    expect(encruzilhadaCentralGuard({
      width: 40,
      height: 20,
      mapId: "MAP_MAUVILLE_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Rustboro",
    }).enabled).toBe(false);
  });

  it("modela quatro eixos e preserva cenas/bordas", () => {
    expect(isAiRemodelPrompt(ENCRUZILHADA_CENTRAL_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(ENCRUZILHADA_CENTRAL_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(21);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(14);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(7);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(8);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(6);

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(ENCRUZILHADA_CENTRAL_WIDTH);
      expect(zone.y2).toBeLessThan(ENCRUZILHADA_CENTRAL_HEIGHT);
    }
  });

  it("compila exatamente as quatro conexões reais sem structures artificiais", () => {
    const parsed = parseDetailedMapCommand(ENCRUZILHADA_CENTRAL_PROMPT, [], [], 40, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "north", map: "MAP_ROUTE111", offset: 0 }),
      expect.objectContaining({ direction: "south", map: "MAP_ROUTE110", offset: 0 }),
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE117", offset: 0 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE118", offset: 0 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(4);
  });
});
