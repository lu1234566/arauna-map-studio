import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  GRUTA_DA_ORIGEM_ENTRANCE_PROMPT,
  GRUTA_DA_ORIGEM_1F_PROMPT,
  GRUTA_DA_ORIGEM_B1F_PROMPT,
  grutaDaOrigemEntranceGuard,
  grutaDaOrigem1FGuard,
  grutaDaOrigemB1FGuard,
} from "./grutaDaOrigemPresets";

const activeMaps = [
  { label: "Entrada", width: 19, height: 26, mapId: "MAP_CAVE_OF_ORIGIN_ENTRANCE", prompt: GRUTA_DA_ORIGEM_ENTRANCE_PROMPT, guard: grutaDaOrigemEntranceGuard },
  { label: "1F", width: 23, height: 23, mapId: "MAP_CAVE_OF_ORIGIN_1F", prompt: GRUTA_DA_ORIGEM_1F_PROMPT, guard: grutaDaOrigem1FGuard },
  { label: "B1F", width: 19, height: 19, mapId: "MAP_CAVE_OF_ORIGIN_B1F", prompt: GRUTA_DA_ORIGEM_B1F_PROMPT, guard: grutaDaOrigemB1FGuard },
] as const;

describe("pilotos Gruta da Origem", () => {
  it("amarra somente os três mapas ativos aos ids e ao atlas reais", () => {
    for (const map of activeMaps) {
      expect(map.guard({
        width: map.width,
        height: map.height,
        mapId: map.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_Cave",
      }).enabled, map.label).toBe(true);
      expect(map.guard({ width: map.width, height: map.height, mapId: "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP1" }).enabled, map.label).toBe(false);
    }
  });

  it("usa pipeline layered-only e proteções fortes", () => {
    for (const map of activeMaps) {
      expect(isAiRemodelPrompt(map.prompt), map.label).toBe(true);
      expect(map.prompt, map.label).toMatch(/preservar todas as paredes/i);
      expect(map.prompt, map.label).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(map.prompt);
      expect(layered.active, map.label).toBe(true);
      expect(layered.errors, map.label).toEqual([]);
      expect(layered.preserveUnassigned, map.label).toBe(true);
      expect(layered.zones.some((zone) => zone.material.role === "preserve"), map.label).toBe(true);
      for (const zone of layered.zones) {
        expect(zone.x1, `${map.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.y1, `${map.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.x2, `${map.label}:${zone.label}`).toBeLessThan(map.width);
        expect(zone.y2, `${map.label}:${zone.label}`).toBeLessThan(map.height);
      }
      const parsed = parseLocalMapCommand(map.prompt, [], [], map.width, map.height);
      expect(parsed.errors, map.label).toEqual([]);
      expect(parsed.plan?.connections, map.label).toEqual([]);
      expect(parsed.plan?.warps, map.label).toEqual([]);
      expect(parsed.plan?.tags, map.label).toContain("layered-only");
    }
  });

  it("mantém Amália e exclui resíduos Ruby/Sapphire do fluxo ativo", () => {
    expect(GRUTA_DA_ORIGEM_B1F_PROMPT).toContain("Amália");
    expect(GRUTA_DA_ORIGEM_B1F_PROMPT).toContain("UnusedRubySapphireMap1");
  });
});
