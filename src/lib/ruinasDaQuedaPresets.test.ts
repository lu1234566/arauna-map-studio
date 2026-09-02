import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  RUINAS_DA_QUEDA_1F_1R_PROMPT,
  RUINAS_DA_QUEDA_1F_2R_PROMPT,
  RUINAS_DA_QUEDA_B1F_1R_PROMPT,
  RUINAS_DA_QUEDA_B1F_2R_PROMPT,
  RUINAS_DA_QUEDA_BENTO_PROMPT,
  ruinasDaQueda1F1RGuard,
  ruinasDaQueda1F2RGuard,
  ruinasDaQuedaB1F1RGuard,
  ruinasDaQuedaB1F2RGuard,
  ruinasDaQuedaBentoGuard,
} from "./ruinasDaQuedaPresets";

const floors = [
  { label: "1F1R", width: 30, height: 42, mapId: "MAP_METEOR_FALLS_1F_1R", prompt: RUINAS_DA_QUEDA_1F_1R_PROMPT, guard: ruinasDaQueda1F1RGuard },
  { label: "1F2R", width: 30, height: 32, mapId: "MAP_METEOR_FALLS_1F_2R", prompt: RUINAS_DA_QUEDA_1F_2R_PROMPT, guard: ruinasDaQueda1F2RGuard },
  { label: "B1F1R", width: 29, height: 38, mapId: "MAP_METEOR_FALLS_B1F_1R", prompt: RUINAS_DA_QUEDA_B1F_1R_PROMPT, guard: ruinasDaQuedaB1F1RGuard },
  { label: "B1F2R", width: 11, height: 18, mapId: "MAP_METEOR_FALLS_B1F_2R", prompt: RUINAS_DA_QUEDA_B1F_2R_PROMPT, guard: ruinasDaQuedaB1F2RGuard },
  { label: "Bento", width: 30, height: 32, mapId: "MAP_METEOR_FALLS_STEVENS_CAVE", prompt: RUINAS_DA_QUEDA_BENTO_PROMPT, guard: ruinasDaQuedaBentoGuard },
] as const;

describe("pilotos Ruínas da Queda", () => {
  it("amarra cada sala ao map id, dimensão e tileset reais", () => {
    for (const floor of floors) {
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: floor.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_MeteorFalls",
      }).enabled, floor.label).toBe(true);
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: "MAP_GRANITE_CAVE_1F",
      }).enabled, floor.label).toBe(false);
    }

    expect(ruinasDaQueda1F2RGuard({ width: 30, height: 32, mapId: "MAP_METEOR_FALLS_STEVENS_CAVE" }).enabled).toBe(false);
    expect(ruinasDaQuedaBentoGuard({ width: 30, height: 32, mapId: "MAP_METEOR_FALLS_1F_2R" }).enabled).toBe(false);
  });

  it("todos são layered-only e preservam paredes, água e elevações", () => {
    for (const floor of floors) {
      expect(isAiRemodelPrompt(floor.prompt), floor.label).toBe(true);
      expect(floor.prompt, floor.label).toMatch(/preservar todas as paredes e rochas/i);
      expect(floor.prompt, floor.label).toMatch(/preservar (toda )?água|preservar água/i);

      const layered = parseLayeredPrompt(floor.prompt);
      expect(layered.active, floor.label).toBe(true);
      expect(layered.errors, floor.label).toEqual([]);
      expect(layered.preserveUnassigned, floor.label).toBe(true);
      expect(layered.strictIsolation, floor.label).toBe(false);
      expect(layered.zones.some((zone) => zone.material.role === "preserve"), floor.label).toBe(true);

      for (const zone of layered.zones) {
        expect(zone.x1, `${floor.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.y1, `${floor.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.x2, `${floor.label}:${zone.label}`).toBeLessThan(floor.width);
        expect(zone.y2, `${floor.label}:${zone.label}`).toBeLessThan(floor.height);
      }

      const parsed = parseLocalMapCommand(floor.prompt, [], [], floor.width, floor.height);
      expect(parsed.errors, floor.label).toEqual([]);
      expect(parsed.plan?.connections, floor.label).toEqual([]);
      expect(parsed.plan?.warps, floor.label).toEqual([]);
      expect(parsed.plan?.tags, floor.label).toContain("layered-only");
    }
  });

  it("congela as áreas de progressão específicas", () => {
    expect(RUINAS_DA_QUEDA_1F_1R_PROMPT).toContain("cena Lembrantes e Horizonte");
    expect(RUINAS_DA_QUEDA_1F_1R_PROMPT).toContain("trigger do meteorito");
    expect(RUINAS_DA_QUEDA_B1F_1R_PROMPT).toContain("elevação 4 e 5");
    expect(RUINAS_DA_QUEDA_B1F_2R_PROMPT).toContain("TM Dragon Claw");
    expect(RUINAS_DA_QUEDA_BENTO_PROMPT).toContain("Seu Bento");
  });
});
