import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  PAMPA_DA_ESPERA_HEIGHT,
  PAMPA_DA_ESPERA_PROMPT,
  PAMPA_DA_ESPERA_WIDTH,
  pampaDaEsperaGuard,
} from "./pampaDaEsperaPreset";

describe("piloto Pampa da Espera", () => {
  it("libera apenas no Petalburg real 30x30 com General + Petalburg", () => {
    expect(pampaDaEsperaGuard({
      width: 30,
      height: 30,
      mapId: "MAP_PETALBURG_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Petalburg",
    }).enabled).toBe(true);

    expect(pampaDaEsperaGuard({ width: 20, height: 30, mapId: "MAP_PETALBURG_CITY" }).enabled).toBe(false);
    expect(pampaDaEsperaGuard({ width: 30, height: 30, mapId: "MAP_MAUVILLE_CITY" }).enabled).toBe(false);
    expect(pampaDaEsperaGuard({
      width: 30,
      height: 30,
      mapId: "MAP_PETALBURG_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Mauville",
    }).enabled).toBe(false);
  });

  it("abre campos e preserva o corredor do tutorial", () => {
    expect(isAiRemodelPrompt(PAMPA_DA_ESPERA_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(PAMPA_DA_ESPERA_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(21);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(15);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(8);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(2);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(6);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(5);

    const tutorial = layered.zones.find((zone) => zone.label.includes("tutorial de Val"));
    expect(tutorial).toMatchObject({ x1: 3, x2: 16, y1: 9, y2: 14, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(PAMPA_DA_ESPERA_WIDTH);
      expect(zone.y2).toBeLessThan(PAMPA_DA_ESPERA_HEIGHT);
    }
  });

  it("compila as duas conexões reais com offsets herdados", () => {
    const parsed = parseDetailedMapCommand(PAMPA_DA_ESPERA_PROMPT, [], [], 30, 30);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE104", offset: -50 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE102", offset: 10 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
