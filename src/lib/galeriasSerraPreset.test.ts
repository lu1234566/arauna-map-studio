import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  GALERIAS_SERRA_HEIGHT,
  GALERIAS_SERRA_PROMPT,
  GALERIAS_SERRA_WIDTH,
  galeriasSerraGuard,
} from "./galeriasSerraPreset";

describe("piloto Galerias Serra", () => {
  it("libera apenas no Rusturf Tunnel real 36x24 com General + RusturfTunnel", () => {
    expect(galeriasSerraGuard({
      width: 36,
      height: 24,
      mapId: "MAP_RUSTURF_TUNNEL",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_RusturfTunnel",
    }).enabled).toBe(true);

    expect(galeriasSerraGuard({ width: 36, height: 20, mapId: "MAP_RUSTURF_TUNNEL" }).enabled).toBe(false);
    expect(galeriasSerraGuard({ width: 36, height: 24, mapId: "MAP_GRANITE_CAVE_1F" }).enabled).toBe(false);
  });

  it("reorganiza somente pisos e congela cenas, bocas e itens", () => {
    expect(isAiRemodelPrompt(GALERIAS_SERRA_PROMPT)).toBe(true);
    expect(GALERIAS_SERRA_PROMPT).toMatch(/preservar todas as paredes e rochas/i);

    const layered = parseLayeredPrompt(GALERIAS_SERRA_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(16);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(9);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(7);

    const peeko = layered.zones.find((zone) => zone.label.includes("Peeko"));
    const wanda = layered.zones.find((zone) => zone.label.includes("Wanda"));
    expect(peeko).toMatchObject({ x1: 8, x2: 16, y1: 3, y2: 6 });
    expect(wanda).toMatchObject({ x1: 22, x2: 26, y1: 3, y2: 6 });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(GALERIAS_SERRA_WIDTH);
      expect(zone.y2).toBeLessThan(GALERIAS_SERRA_HEIGHT);
    }
  });

  it("compila como layered-only sem inventar connections", () => {
    const parsed = parseLocalMapCommand(GALERIAS_SERRA_PROMPT, [], [], 36, 24);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan).toBeTruthy();
    expect(parsed.plan?.connections).toEqual([]);
    expect(parsed.plan?.warps).toEqual([]);
    expect(parsed.plan?.tags).toContain("layered-only");
  });
});
