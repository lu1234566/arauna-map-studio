import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  CAVERNAS_MBOI_ENTRANCE_PROMPT,
  CAVERNAS_MBOI_ROOM1_PROMPT,
  CAVERNAS_MBOI_ROOM2_PROMPT,
  CAVERNAS_MBOI_ROOM3_PROMPT,
  CAVERNAS_MBOI_ROOM4_PROMPT,
  CAVERNAS_MBOI_ROOM5_PROMPT,
  CAVERNAS_MBOI_ROOM6_PROMPT,
  CAVERNAS_MBOI_ROOM7_PROMPT,
  CAVERNAS_MBOI_ROOM8_PROMPT,
  CAVERNAS_MBOI_ROOM9_PROMPT,
  cavernasMboiEntranceGuard,
  cavernasMboiRoom1Guard,
  cavernasMboiRoom2Guard,
  cavernasMboiRoom3Guard,
  cavernasMboiRoom4Guard,
  cavernasMboiRoom5Guard,
  cavernasMboiRoom6Guard,
  cavernasMboiRoom7Guard,
  cavernasMboiRoom8Guard,
  cavernasMboiRoom9Guard,
} from "./cavernasMboiPresets";

const rooms = [
  { label: "Entrada", width: 20, height: 20, mapId: "MAP_SEAFLOOR_CAVERN_ENTRANCE", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ENTRANCE_PROMPT, guard: cavernasMboiEntranceGuard },
  { label: "Room1", width: 20, height: 21, mapId: "MAP_SEAFLOOR_CAVERN_ROOM1", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM1_PROMPT, guard: cavernasMboiRoom1Guard },
  { label: "Room2", width: 18, height: 12, mapId: "MAP_SEAFLOOR_CAVERN_ROOM2", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM2_PROMPT, guard: cavernasMboiRoom2Guard },
  { label: "Room3", width: 16, height: 17, mapId: "MAP_SEAFLOOR_CAVERN_ROOM3", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM3_PROMPT, guard: cavernasMboiRoom3Guard },
  { label: "Room4", width: 18, height: 19, mapId: "MAP_SEAFLOOR_CAVERN_ROOM4", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM4_PROMPT, guard: cavernasMboiRoom4Guard },
  { label: "Room5", width: 20, height: 20, mapId: "MAP_SEAFLOOR_CAVERN_ROOM5", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM5_PROMPT, guard: cavernasMboiRoom5Guard },
  { label: "Room6", width: 24, height: 23, mapId: "MAP_SEAFLOOR_CAVERN_ROOM6", secondary: "gTileset_Pacifidlog", prompt: CAVERNAS_MBOI_ROOM6_PROMPT, guard: cavernasMboiRoom6Guard },
  { label: "Room7", width: 23, height: 25, mapId: "MAP_SEAFLOOR_CAVERN_ROOM7", secondary: "gTileset_Pacifidlog", prompt: CAVERNAS_MBOI_ROOM7_PROMPT, guard: cavernasMboiRoom7Guard },
  { label: "Room8", width: 11, height: 14, mapId: "MAP_SEAFLOOR_CAVERN_ROOM8", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM8_PROMPT, guard: cavernasMboiRoom8Guard },
  { label: "Room9", width: 27, height: 46, mapId: "MAP_SEAFLOOR_CAVERN_ROOM9", secondary: "gTileset_Cave", prompt: CAVERNAS_MBOI_ROOM9_PROMPT, guard: cavernasMboiRoom9Guard },
] as const;

describe("pilotos Cavernas M'Boi", () => {
  it("amarra cada sala ao map id, dimensão e tileset reais", () => {
    for (const room of rooms) {
      expect(room.guard({
        width: room.width,
        height: room.height,
        mapId: room.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: room.secondary,
      }).enabled, room.label).toBe(true);
      expect(room.guard({
        width: room.width,
        height: room.height,
        mapId: "MAP_SEAFLOOR_CAVERN_ROOM99",
      }).enabled, room.label).toBe(false);
    }
    expect(cavernasMboiRoom6Guard({ width: 24, height: 23, mapId: "MAP_SEAFLOOR_CAVERN_ROOM6", atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Cave" }).enabled).toBe(false);
    expect(cavernasMboiRoom7Guard({ width: 23, height: 25, mapId: "MAP_SEAFLOOR_CAVERN_ROOM7", atlasPrimary: "gTileset_General", atlasSecondary: "gTileset_Cave" }).enabled).toBe(false);
  });

  it("todos são layered-only e ativam as proteções fortes", () => {
    for (const room of rooms) {
      expect(isAiRemodelPrompt(room.prompt), room.label).toBe(true);
      expect(room.prompt, room.label).toMatch(/preservar todas as paredes/i);
      expect(room.prompt, room.label).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(room.prompt);
      expect(layered.active, room.label).toBe(true);
      expect(layered.errors, room.label).toEqual([]);
      expect(layered.preserveUnassigned, room.label).toBe(true);
      expect(layered.strictIsolation, room.label).toBe(false);
      expect(layered.zones.some((zone) => zone.material.role === "preserve"), room.label).toBe(true);
      for (const zone of layered.zones) {
        expect(zone.x1, `${room.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.y1, `${room.label}:${zone.label}`).toBeGreaterThanOrEqual(0);
        expect(zone.x2, `${room.label}:${zone.label}`).toBeLessThan(room.width);
        expect(zone.y2, `${room.label}:${zone.label}`).toBeLessThan(room.height);
      }
      const parsed = parseLocalMapCommand(room.prompt, [], [], room.width, room.height);
      expect(parsed.errors, room.label).toEqual([]);
      expect(parsed.plan?.connections, room.label).toEqual([]);
      expect(parsed.plan?.warps, room.label).toEqual([]);
      expect(parsed.plan?.tags, room.label).toContain("layered-only");
    }
  });

  it("congela os puzzles e o núcleo narrativo", () => {
    expect(CAVERNAS_MBOI_ROOM2_PROMPT).toContain("puzzle de Strength");
    expect(CAVERNAS_MBOI_ROOM6_PROMPT).toContain("General + Pacifidlog");
    expect(CAVERNAS_MBOI_ROOM7_PROMPT).toContain("correnteza");
    expect(CAVERNAS_MBOI_ROOM8_PROMPT).toContain("progressão obrigatória");
    expect(CAVERNAS_MBOI_ROOM9_PROMPT).toContain("VAR_SEAFLOOR_CAVERN_STATE");
    expect(CAVERNAS_MBOI_ROOM9_PROMPT).toContain("Otacílio");
    expect(CAVERNAS_MBOI_ROOM9_PROMPT).toContain("ROOM9_LAVA");
  });
});
