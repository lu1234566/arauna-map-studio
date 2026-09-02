import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  MEMORIAL_DOS_NOMES_1F_PROMPT,
  MEMORIAL_DOS_NOMES_2F_PROMPT,
  MEMORIAL_DOS_NOMES_3F_PROMPT,
  MEMORIAL_DOS_NOMES_4F_PROMPT,
  MEMORIAL_DOS_NOMES_5F_PROMPT,
  MEMORIAL_DOS_NOMES_6F_PROMPT,
  MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT,
  MEMORIAL_DOS_NOMES_SUMMIT_PROMPT,
  memorialDosNomes1FGuard,
  memorialDosNomes2FGuard,
  memorialDosNomes3FGuard,
  memorialDosNomes4FGuard,
  memorialDosNomes5FGuard,
  memorialDosNomes6FGuard,
  memorialDosNomesExteriorGuard,
  memorialDosNomesSummitGuard,
} from "./memorialDosNomesPresets";

const floors = [
  { label: "1F", width: 22, height: 19, mapId: "MAP_MT_PYRE_1F", prompt: MEMORIAL_DOS_NOMES_1F_PROMPT, guard: memorialDosNomes1FGuard },
  { label: "2F", width: 13, height: 13, mapId: "MAP_MT_PYRE_2F", prompt: MEMORIAL_DOS_NOMES_2F_PROMPT, guard: memorialDosNomes2FGuard },
  { label: "3F", width: 13, height: 13, mapId: "MAP_MT_PYRE_3F", prompt: MEMORIAL_DOS_NOMES_3F_PROMPT, guard: memorialDosNomes3FGuard },
  { label: "4F", width: 13, height: 13, mapId: "MAP_MT_PYRE_4F", prompt: MEMORIAL_DOS_NOMES_4F_PROMPT, guard: memorialDosNomes4FGuard },
  { label: "5F", width: 13, height: 13, mapId: "MAP_MT_PYRE_5F", prompt: MEMORIAL_DOS_NOMES_5F_PROMPT, guard: memorialDosNomes5FGuard },
  { label: "6F", width: 13, height: 13, mapId: "MAP_MT_PYRE_6F", prompt: MEMORIAL_DOS_NOMES_6F_PROMPT, guard: memorialDosNomes6FGuard },
  { label: "Exterior", width: 38, height: 51, mapId: "MAP_MT_PYRE_EXTERIOR", prompt: MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT, guard: memorialDosNomesExteriorGuard },
  { label: "Summit", width: 50, height: 37, mapId: "MAP_MT_PYRE_SUMMIT", prompt: MEMORIAL_DOS_NOMES_SUMMIT_PROMPT, guard: memorialDosNomesSummitGuard },
] as const;

describe("pilotos Memorial dos Nomes", () => {
  it("amarra cada andar ao map id, dimensão e tileset reais", () => {
    for (const floor of floors) {
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: floor.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_Facility",
      }).enabled, floor.label).toBe(true);
      expect(floor.guard({
        width: floor.width,
        height: floor.height,
        mapId: "MAP_MT_PYRE_SUMMIT_WRONG",
      }).enabled, floor.label).toBe(false);
    }

    expect(memorialDosNomes2FGuard({ width: 13, height: 13, mapId: "MAP_MT_PYRE_3F" }).enabled).toBe(false);
    expect(memorialDosNomes3FGuard({ width: 13, height: 13, mapId: "MAP_MT_PYRE_2F" }).enabled).toBe(false);
  });

  it("todos são layered-only e ativam as proteções fortes do Exact Grid", () => {
    for (const floor of floors) {
      expect(isAiRemodelPrompt(floor.prompt), floor.label).toBe(true);
      expect(floor.prompt, floor.label).toMatch(/preservar todas as paredes/i);
      expect(floor.prompt, floor.label).toMatch(/preservar todos os comportamentos funcionais/i);

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

  it("congela as mecânicas e cenas narrativas específicas", () => {
    expect(MEMORIAL_DOS_NOMES_2F_PROMPT).toContain("STEP_CB_CRACKED_FLOOR");
    expect(MEMORIAL_DOS_NOMES_3F_PROMPT).toContain("Pokémon de Arauna");
    expect(MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT).toContain("cinco triggers climáticos");
    expect(MEMORIAL_DOS_NOMES_SUMMIT_PROMPT).toContain("seis triggers");
    expect(MEMORIAL_DOS_NOMES_SUMMIT_PROMPT).toContain("Dona Zila");
  });
});
