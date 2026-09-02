import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  NAVIO_PERDIDO_CAPTAIN_PROMPT,
  NAVIO_PERDIDO_CORRIDORS_1F_PROMPT,
  NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT,
  NAVIO_PERDIDO_DECK_PROMPT,
  NAVIO_PERDIDO_HIDDEN_CORRIDORS_PROMPT,
  NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT,
  NAVIO_PERDIDO_ROOM_B1F_PROMPT,
  NAVIO_PERDIDO_ROOMS2_1F_PROMPT,
  NAVIO_PERDIDO_ROOMS2_B1F_PROMPT,
  NAVIO_PERDIDO_ROOMS_1F_PROMPT,
  NAVIO_PERDIDO_ROOMS_B1F_PROMPT,
  NAVIO_PERDIDO_UNDERWATER1_PROMPT,
  NAVIO_PERDIDO_UNDERWATER2_PROMPT,
  navioPerdidoCaptainGuard,
  navioPerdidoCorridors1FGuard,
  navioPerdidoCorridorsB1FGuard,
  navioPerdidoDeckGuard,
  navioPerdidoHiddenCorridorsGuard,
  navioPerdidoHiddenRoomsGuard,
  navioPerdidoRoomB1FGuard,
  navioPerdidoRooms21FGuard,
  navioPerdidoRooms2B1FGuard,
  navioPerdidoRooms1FGuard,
  navioPerdidoRoomsB1FGuard,
  navioPerdidoUnderwater1Guard,
  navioPerdidoUnderwater2Guard,
} from "./navioPerdidoPresets";

const maps = [
  { label: "Convés", width: 23, height: 21, mapId: "MAP_ABANDONED_SHIP_DECK", secondary: "gTileset_Facility", prompt: NAVIO_PERDIDO_DECK_PROMPT, guard: navioPerdidoDeckGuard },
  { label: "Corredores 1F", width: 18, height: 12, mapId: "MAP_ABANDONED_SHIP_CORRIDORS_1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_CORRIDORS_1F_PROMPT, guard: navioPerdidoCorridors1FGuard },
  { label: "Salas 1F", width: 18, height: 17, mapId: "MAP_ABANDONED_SHIP_ROOMS_1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_ROOMS_1F_PROMPT, guard: navioPerdidoRooms1FGuard },
  { label: "Corredores B1F", width: 13, height: 10, mapId: "MAP_ABANDONED_SHIP_CORRIDORS_B1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT, guard: navioPerdidoCorridorsB1FGuard },
  { label: "Salas B1F", width: 27, height: 8, mapId: "MAP_ABANDONED_SHIP_ROOMS_B1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_ROOMS_B1F_PROMPT, guard: navioPerdidoRoomsB1FGuard },
  { label: "Salas2 B1F", width: 18, height: 8, mapId: "MAP_ABANDONED_SHIP_ROOMS2_B1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_ROOMS2_B1F_PROMPT, guard: navioPerdidoRooms2B1FGuard },
  { label: "Submerso 1", width: 8, height: 8, mapId: "MAP_ABANDONED_SHIP_UNDERWATER1", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_UNDERWATER1_PROMPT, guard: navioPerdidoUnderwater1Guard },
  { label: "Sala B1F", width: 9, height: 8, mapId: "MAP_ABANDONED_SHIP_ROOM_B1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_ROOM_B1F_PROMPT, guard: navioPerdidoRoomB1FGuard },
  { label: "Salas2 1F", width: 9, height: 17, mapId: "MAP_ABANDONED_SHIP_ROOMS2_1F", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_ROOMS2_1F_PROMPT, guard: navioPerdidoRooms21FGuard },
  { label: "Capitão", width: 9, height: 7, mapId: "MAP_ABANDONED_SHIP_CAPTAINS_OFFICE", secondary: "gTileset_Facility", prompt: NAVIO_PERDIDO_CAPTAIN_PROMPT, guard: navioPerdidoCaptainGuard },
  { label: "Submerso 2", width: 21, height: 7, mapId: "MAP_ABANDONED_SHIP_UNDERWATER2", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_UNDERWATER2_PROMPT, guard: navioPerdidoUnderwater2Guard },
  { label: "Oculto corredores", width: 13, height: 11, mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_HIDDEN_CORRIDORS_PROMPT, guard: navioPerdidoHiddenCorridorsGuard },
  { label: "Oculto salas", width: 44, height: 15, mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_ROOMS", secondary: "gTileset_InsideShip", prompt: NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT, guard: navioPerdidoHiddenRoomsGuard },
] as const;

describe("pilotos Navio Perdido", () => {
  it("amarra os treze mapas aos ids, dimensões e tilesets reais", () => {
    expect(maps).toHaveLength(13);
    for (const item of maps) {
      expect(item.guard({
        width: item.width,
        height: item.height,
        mapId: item.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: item.secondary,
      }).enabled, item.label).toBe(true);
      expect(item.guard({ width: item.width, height: item.height, mapId: "MAP_ABANDONED_SHIP_FAKE" }).enabled, item.label).toBe(false);
    }
  });

  it("mantém todos os mapas no pipeline layered-only com behaviors funcionais protegidos", () => {
    for (const item of maps) {
      expect(isAiRemodelPrompt(item.prompt), item.label).toBe(true);
      expect(item.prompt).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(item.prompt);
      expect(layered.active, item.label).toBe(true);
      expect(layered.errors, item.label).toEqual([]);
      expect(layered.preserveUnassigned, item.label).toBe(true);

      const parsed = parseLocalMapCommand(item.prompt, [], [], item.width, item.height);
      expect(parsed.errors, item.label).toEqual([]);
      expect(parsed.plan, item.label).toBeTruthy();
      expect(parsed.plan?.connections, item.label).toEqual([]);
      expect(parsed.plan?.warps, item.label).toEqual([]);
    }
  });

  it("declara explicitamente as mecânicas de chaves, Dive e sparkle", () => {
    expect(NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT).toMatch(/\(11,4\)/);
    expect(NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT).toMatch(/FLAG_USED_STORAGE_KEY/);
    expect(NAVIO_PERDIDO_UNDERWATER1_PROMPT).toMatch(/HIDDEN_FLOOR_CORRIDORS/);
    expect(NAVIO_PERDIDO_UNDERWATER2_PROMPT).toMatch(/ROOMS_B1F/);
    expect(NAVIO_PERDIDO_HIDDEN_CORRIDORS_PROMPT).toMatch(/FLAG_USED_ROOM_6_KEY/);
    expect(NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT).toMatch(/x=21/);
    expect(NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT).toMatch(/\(42,10\)/);
  });
});
