import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  VILA_AMANHECER_HEIGHT,
  VILA_AMANHECER_PROMPT,
  VILA_AMANHECER_WIDTH,
  vilaAmanhecerGuard,
} from "./vilaAmanhecerPreset";

describe("piloto Vila Amanhecer", () => {
  it("libera apenas no contexto real de Littleroot 20x20 com General + Petalburg", () => {
    expect(vilaAmanhecerGuard({
      width: 20,
      height: 20,
      mapId: "MAP_LITTLEROOT_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Petalburg",
    }).enabled).toBe(true);

    expect(vilaAmanhecerGuard({ width: 40, height: 60, mapId: "MAP_LITTLEROOT_TOWN" }).enabled).toBe(false);
    expect(vilaAmanhecerGuard({ width: 20, height: 20, mapId: "MAP_SLATEPORT_CITY" }).enabled).toBe(false);
    expect(vilaAmanhecerGuard({
      width: 20,
      height: 20,
      mapId: "MAP_LITTLEROOT_TOWN",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Slateport",
    }).enabled).toBe(false);
  });

  it("é reconhecido como remodelagem e ativa o pipeline em camadas dentro do mapa", () => {
    expect(isAiRemodelPrompt(VILA_AMANHECER_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(VILA_AMANHECER_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.zones.length).toBeGreaterThan(6);
    for (const zone of layered.zones) {
      expect(zone.x2).toBeLessThan(VILA_AMANHECER_WIDTH);
      expect(zone.y2).toBeLessThan(VILA_AMANHECER_HEIGHT);
    }
  });

  it("preserva tudo fora das zonas em vez de exigir cobertura total", () => {
    const layered = parseLayeredPrompt(VILA_AMANHECER_PROMPT);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.requireFullCoverage).toBe(false);
  });

  it("compila no interpretador local mantendo a conexão norte declarada", () => {
    const parsed = parseDetailedMapCommand(VILA_AMANHECER_PROMPT, [], [], 20, 20);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual([
      expect.objectContaining({ direction: "up", map: "MAP_ROUTE101", offset: 0 }),
    ]);
    expect(parsed.plan?.structures ?? []).toHaveLength(0);
  });
});
