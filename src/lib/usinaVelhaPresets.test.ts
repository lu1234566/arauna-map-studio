import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  USINA_VELHA_ENTRANCE_PROMPT,
  USINA_VELHA_INSIDE_PROMPT,
  usinaVelhaEntranceGuard,
  usinaVelhaInsideGuard,
} from "./usinaVelhaPresets";

const rooms = [
  { label: "entrada", width: 9, height: 9, mapId: "MAP_NEW_MAUVILLE_ENTRANCE", secondary: "gTileset_Facility", prompt: USINA_VELHA_ENTRANCE_PROMPT, guard: usinaVelhaEntranceGuard },
  { label: "interior", width: 41, height: 41, mapId: "MAP_NEW_MAUVILLE_INSIDE", secondary: "gTileset_BikeShop", prompt: USINA_VELHA_INSIDE_PROMPT, guard: usinaVelhaInsideGuard },
] as const;

describe("pilotos Usina Velha", () => {
  it("amarra entrada e interior aos map ids, dimensões e tilesets reais", () => {
    for (const room of rooms) {
      expect(room.guard({
        width: room.width,
        height: room.height,
        mapId: room.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: room.secondary,
      }).enabled, room.label).toBe(true);
      expect(room.guard({ width: room.width, height: room.height, mapId: "MAP_NEW_MAUVILLE_FAKE" }).enabled, room.label).toBe(false);
    }
    expect(usinaVelhaEntranceGuard({ width: 9, height: 9, mapId: "MAP_NEW_MAUVILLE_ENTRANCE", atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_BikeShop" }).enabled).toBe(false);
    expect(usinaVelhaInsideGuard({ width: 41, height: 41, mapId: "MAP_NEW_MAUVILLE_INSIDE", atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Facility" }).enabled).toBe(false);
  });

  it("mantém os dois mapas em layered-only com proteção de paredes", () => {
    for (const room of rooms) {
      expect(isAiRemodelPrompt(room.prompt), room.label).toBe(true);
      expect(room.prompt).toMatch(/preservar todas as paredes/i);
      const layered = parseLayeredPrompt(room.prompt);
      expect(layered.active, room.label).toBe(true);
      expect(layered.errors, room.label).toEqual([]);
      expect(layered.preserveUnassigned, room.label).toBe(true);
      const parsed = parseLocalMapCommand(room.prompt, [], [], room.width, room.height);
      expect(parsed.errors, room.label).toEqual([]);
      expect(parsed.plan?.connections, room.label).toEqual([]);
      expect(parsed.plan?.warps, room.label).toEqual([]);
    }
  });

  it("preserva explicitamente a máquina de estados elétrica", () => {
    expect(USINA_VELHA_ENTRANCE_PROMPT).toMatch(/VAR_NEW_MAUVILLE_STATE/);
    expect(USINA_VELHA_ENTRANCE_PROMPT).toMatch(/Basement Key/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/BlueButton/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/GreenButton/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/RedButton/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/x=23,y=34\.\.37/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/gerador dinâmico em x=32\.\.35,y=2\.\.3/);
    expect(USINA_VELHA_INSIDE_PROMPT).toMatch(/Voltorb em \(25,18\), \(6,11\), \(13,10\)/);
  });
});
