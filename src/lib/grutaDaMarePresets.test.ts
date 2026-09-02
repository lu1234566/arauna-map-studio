import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  GRUTA_DA_MARE_HIGH_ENTRANCE_PROMPT,
  GRUTA_DA_MARE_HIGH_INNER_PROMPT,
  GRUTA_DA_MARE_ICE_PROMPT,
  GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT,
  GRUTA_DA_MARE_LOW_INNER_PROMPT,
  GRUTA_DA_MARE_LOWER_PROMPT,
  GRUTA_DA_MARE_STAIRS_PROMPT,
  grutaDaMareHighEntranceGuard,
  grutaDaMareHighInnerGuard,
  grutaDaMareIceGuard,
  grutaDaMareLowEntranceGuard,
  grutaDaMareLowInnerGuard,
  grutaDaMareLowerGuard,
  grutaDaMareStairsGuard,
} from "./grutaDaMarePresets";

const rooms = [
  { label: "entrada baixa", width: 35, height: 35, mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM", prompt: GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT, guard: grutaDaMareLowEntranceGuard },
  { label: "entrada alta", width: 35, height: 35, mapId: "MAP_SHOAL_CAVE_HIGH_TIDE_ENTRANCE_ROOM", prompt: GRUTA_DA_MARE_HIGH_ENTRANCE_PROMPT, guard: grutaDaMareHighEntranceGuard },
  { label: "interior baixo", width: 46, height: 38, mapId: "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM", prompt: GRUTA_DA_MARE_LOW_INNER_PROMPT, guard: grutaDaMareLowInnerGuard },
  { label: "interior alto", width: 46, height: 38, mapId: "MAP_SHOAL_CAVE_HIGH_TIDE_INNER_ROOM", prompt: GRUTA_DA_MARE_HIGH_INNER_PROMPT, guard: grutaDaMareHighInnerGuard },
  { label: "inferior", width: 31, height: 14, mapId: "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM", prompt: GRUTA_DA_MARE_LOWER_PROMPT, guard: grutaDaMareLowerGuard },
  { label: "escadarias", width: 21, height: 15, mapId: "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM", prompt: GRUTA_DA_MARE_STAIRS_PROMPT, guard: grutaDaMareStairsGuard },
  { label: "gelo", width: 20, height: 30, mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM", prompt: GRUTA_DA_MARE_ICE_PROMPT, guard: grutaDaMareIceGuard },
] as const;

describe("pilotos Gruta da Maré", () => {
  it("amarra cada estado ao map id, dimensão e General + Cave reais", () => {
    for (const room of rooms) {
      expect(room.guard({
        width: room.width,
        height: room.height,
        mapId: room.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_Cave",
      }).enabled, room.label).toBe(true);
      expect(room.guard({ width: room.width, height: room.height, mapId: "MAP_SHOAL_CAVE_FAKE" }).enabled, room.label).toBe(false);
      expect(room.guard({
        width: room.width,
        height: room.height,
        mapId: room.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: "gTileset_Pacifidlog",
      }).enabled, room.label).toBe(false);
    }
  });

  it("mantém todos os estados no pipeline layered-only e opt-in de paredes", () => {
    for (const room of rooms) {
      expect(isAiRemodelPrompt(room.prompt), room.label).toBe(true);
      expect(room.prompt).toMatch(/preservar todas as paredes/i);
      const layered = parseLayeredPrompt(room.prompt);
      expect(layered.active, room.label).toBe(true);
      expect(layered.errors, room.label).toEqual([]);
      expect(layered.preserveUnassigned, room.label).toBe(true);

      const parsed = parseLocalMapCommand(room.prompt, [], [], room.width, room.height);
      expect(parsed.errors, room.label).toEqual([]);
      expect(parsed.plan, room.label).toBeTruthy();
      expect(parsed.plan?.connections, room.label).toEqual([]);
      expect(parsed.plan?.warps, room.label).toEqual([]);
    }
  });

  it("declara explicitamente as mecânicas que não podem ser achatadas", () => {
    expect(GRUTA_DA_MARE_LOW_ENTRANCE_PROMPT).toMatch(/UpdateShoalTideFlag/);
    expect(GRUTA_DA_MARE_LOW_INNER_PROMPT).toMatch(/Shoal Salt/i);
    expect(GRUTA_DA_MARE_LOW_INNER_PROMPT).toMatch(/Shoal Shell/i);
    expect(GRUTA_DA_MARE_LOWER_PROMPT).toMatch(/Strength/);
    expect(GRUTA_DA_MARE_ICE_PROMPT).toMatch(/piso de gelo/i);
    expect(GRUTA_DA_MARE_ICE_PROMPT).toMatch(/escorregadio/i);
  });
});
