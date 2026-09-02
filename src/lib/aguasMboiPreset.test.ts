import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  AGUAS_MBOI_HEIGHT,
  AGUAS_MBOI_PROMPT,
  AGUAS_MBOI_WIDTH,
  aguasMboiGuard,
} from "./aguasMboiPreset";

describe("piloto Águas de M'Boi", () => {
  it("libera apenas no Sootopolis real 60x60 com General + Sootopolis", () => {
    expect(aguasMboiGuard({
      width: 60,
      height: 60,
      mapId: "MAP_SOOTOPOLIS_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Sootopolis",
    }).enabled).toBe(true);

    expect(aguasMboiGuard({ width: 40, height: 60, mapId: "MAP_SOOTOPOLIS_CITY" }).enabled).toBe(false);
    expect(aguasMboiGuard({ width: 60, height: 60, mapId: "MAP_SLATEPORT_CITY" }).enabled).toBe(false);
    expect(aguasMboiGuard({
      width: 60,
      height: 60,
      mapId: "MAP_SOOTOPOLIS_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Slateport",
    }).enabled).toBe(false);
  });

  it("organiza os anéis terrestres e preserva explicitamente o palco do clímax", () => {
    expect(isAiRemodelPrompt(AGUAS_MBOI_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(AGUAS_MBOI_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(20);
    expect(layered.zones.filter((zone) => zone.kind === "ground")).toHaveLength(10);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(10);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(10);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(1);

    const climax = layered.zones.find((zone) => zone.label.includes("palco do clímax"));
    expect(climax).toMatchObject({ x1: 25, x2: 37, y1: 30, y2: 47, kind: "ground" });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(AGUAS_MBOI_WIDTH);
      expect(zone.y2).toBeLessThan(AGUAS_MBOI_HEIGHT);
    }
  });

  it("aceita o plano somente de camadas sem inventar conexões, warps ou structures", () => {
    const classic = parseDetailedMapCommand(AGUAS_MBOI_PROMPT, [], [], 60, 60);
    expect(classic.plan).toBeNull();

    const parsed = parseLocalMapCommand(AGUAS_MBOI_PROMPT, [], [], 60, 60);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan).not.toBeNull();
    expect(parsed.plan?.structures).toEqual([]);
    expect(parsed.plan?.routes).toEqual([]);
    expect(parsed.plan?.warps).toEqual([]);
    expect(parsed.plan?.connections).toEqual([]);
    expect(parsed.plan?.tags).toContain("layered-only");
  });

  it("não usa o fallback layered-only para linguagem livre sem zonas válidas", () => {
    const parsed = parseLocalMapCommand("faça uma cidade bonita sem coordenadas", [], [], 60, 60);
    expect(parsed.plan).toBeNull();
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
