import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  GRUTA_DAS_VOZES_1F_PROMPT,
  GRUTA_DAS_VOZES_B1F_PROMPT,
  GRUTA_DAS_VOZES_B2F_PROMPT,
  GRUTA_DAS_VOZES_BENTO_PROMPT,
  grutaDasVozes1FGuard,
  grutaDasVozesB1FGuard,
  grutaDasVozesB2FGuard,
  grutaDasVozesBentoGuard,
} from "./grutaDasVozesPresets";

const floors = [
  { label: "1F", width: 42, height: 15, mapId: "MAP_GRANITE_CAVE_1F", prompt: GRUTA_DAS_VOZES_1F_PROMPT, guard: grutaDasVozes1FGuard },
  { label: "B1F", width: 32, height: 26, mapId: "MAP_GRANITE_CAVE_B1F", prompt: GRUTA_DAS_VOZES_B1F_PROMPT, guard: grutaDasVozesB1FGuard },
  { label: "B2F", width: 32, height: 26, mapId: "MAP_GRANITE_CAVE_B2F", prompt: GRUTA_DAS_VOZES_B2F_PROMPT, guard: grutaDasVozesB2FGuard },
  { label: "Bento", width: 15, height: 14, mapId: "MAP_GRANITE_CAVE_STEVENS_ROOM", prompt: GRUTA_DAS_VOZES_BENTO_PROMPT, guard: grutaDasVozesBentoGuard },
] as const;

describe("pilotos Gruta das Vozes", () => {
  it("amarra cada andar ao map id, dimensão e tileset reais", () => {
    for (const floor of floors) {
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: floor.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_Cave",
      }).enabled, floor.label).toBe(true);
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: "MAP_RUSTURF_TUNNEL",
      }).enabled, floor.label).toBe(false);
    }

    expect(grutaDasVozesB1FGuard({ width: 32, height: 26, mapId: "MAP_GRANITE_CAVE_B2F" }).enabled).toBe(false);
    expect(grutaDasVozesB2FGuard({ width: 32, height: 26, mapId: "MAP_GRANITE_CAVE_B1F" }).enabled).toBe(false);
  });

  it("todos são remodelagens layered-only com proteção explícita de paredes", () => {
    for (const floor of floors) {
      expect(isAiRemodelPrompt(floor.prompt), floor.label).toBe(true);
      expect(floor.prompt, floor.label).toMatch(/preservar todas as paredes e rochas/i);
      const layered = parseLayeredPrompt(floor.prompt);
      expect(layered.active, floor.label).toBe(true);
      expect(layered.errors, floor.label).toEqual([]);
      expect(layered.preserveUnassigned, floor.label).toBe(true);
      expect(layered.strictIsolation, floor.label).toBe(false);
      expect(layered.zones.some((zone) => zone.material.role === "preserve"), floor.label).toBe(true);

      const parsed = parseLocalMapCommand(floor.prompt, [], [], floor.width, floor.height);
      expect(parsed.errors, floor.label).toEqual([]);
      expect(parsed.plan?.connections, floor.label).toEqual([]);
      expect(parsed.plan?.warps, floor.label).toEqual([]);
      expect(parsed.plan?.tags, floor.label).toContain("layered-only");
    }
  });

  it("protege os pontos narrativos e de progressão específicos", () => {
    expect(GRUTA_DAS_VOZES_1F_PROMPT).toContain("Pokémon de Arauna");
    expect(GRUTA_DAS_VOZES_B1F_PROMPT).toContain("sete warps");
    expect(GRUTA_DAS_VOZES_B2F_PROMPT).toContain("Rock Smash");
    expect(GRUTA_DAS_VOZES_BENTO_PROMPT).toContain("Seu Bento");
  });
});
