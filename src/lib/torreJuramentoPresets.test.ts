import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  TORRE_JURAMENTO_1F_PROMPT,
  TORRE_JURAMENTO_2F_PROMPT,
  TORRE_JURAMENTO_3F_PROMPT,
  TORRE_JURAMENTO_4F_PROMPT,
  TORRE_JURAMENTO_5F_PROMPT,
  TORRE_JURAMENTO_ENTRANCE_PROMPT,
  TORRE_JURAMENTO_OUTSIDE_PROMPT,
  TORRE_JURAMENTO_TOP_PROMPT,
  torreJuramento1FGuard,
  torreJuramento2FGuard,
  torreJuramento3FGuard,
  torreJuramento4FGuard,
  torreJuramento5FGuard,
  torreJuramentoEntranceGuard,
  torreJuramentoOutsideGuard,
  torreJuramentoTopGuard,
} from "./torreJuramentoPresets";

const maps = [
  { label: "Entrada", width: 18, height: 18, mapId: "MAP_SKY_PILLAR_ENTRANCE", secondary: "gTileset_Cave", prompt: TORRE_JURAMENTO_ENTRANCE_PROMPT, guard: torreJuramentoEntranceGuard },
  { label: "Exterior", width: 28, height: 23, mapId: "MAP_SKY_PILLAR_OUTSIDE", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_OUTSIDE_PROMPT, guard: torreJuramentoOutsideGuard },
  { label: "1F", width: 14, height: 14, mapId: "MAP_SKY_PILLAR_1F", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_1F_PROMPT, guard: torreJuramento1FGuard },
  { label: "2F", width: 14, height: 14, mapId: "MAP_SKY_PILLAR_2F", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_2F_PROMPT, guard: torreJuramento2FGuard },
  { label: "3F", width: 14, height: 14, mapId: "MAP_SKY_PILLAR_3F", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_3F_PROMPT, guard: torreJuramento3FGuard },
  { label: "4F", width: 14, height: 14, mapId: "MAP_SKY_PILLAR_4F", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_4F_PROMPT, guard: torreJuramento4FGuard },
  { label: "5F", width: 14, height: 14, mapId: "MAP_SKY_PILLAR_5F", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_5F_PROMPT, guard: torreJuramento5FGuard },
  { label: "Topo", width: 27, height: 24, mapId: "MAP_SKY_PILLAR_TOP", secondary: "gTileset_Pacifidlog", prompt: TORRE_JURAMENTO_TOP_PROMPT, guard: torreJuramentoTopGuard },
] as const;

describe("pilotos Torre Juramento", () => {
  it("amarra cada mapa ao id, dimensão e tileset reais", () => {
    for (const item of maps) {
      expect(item.guard({
        width: item.width,
        height: item.height,
        mapId: item.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: item.secondary,
      }).enabled, item.label).toBe(true);
      expect(item.guard({ width: item.width, height: item.height, mapId: "MAP_SKY_PILLAR_FAKE" }).enabled, item.label).toBe(false);
      expect(item.guard({
        width: item.width,
        height: item.height,
        mapId: item.mapId,
        atlasPrimary: "gTileset_General",
        atlasSecondary: item.secondary === "gTileset_Cave" ? "gTileset_Pacifidlog" : "gTileset_Cave",
      }).enabled, item.label).toBe(false);
    }
  });

  it("mantém todos os mapas no pipeline layered-only e opt-in de behaviors funcionais", () => {
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

  it("declara as mecânicas runtime e cenas críticas", () => {
    expect(TORRE_JURAMENTO_1F_PROMPT).toMatch(/LAYOUT_SKY_PILLAR_1F_CLEAN/);
    expect(TORRE_JURAMENTO_2F_PROMPT).toMatch(/CaveHole_CheckFallDownHole/);
    expect(TORRE_JURAMENTO_2F_PROMPT).toMatch(/LAYOUT_SKY_PILLAR_2F_CLEAN/);
    expect(TORRE_JURAMENTO_4F_PROMPT).toMatch(/SkyPillar_4F_SetHoleWarp/);
    expect(TORRE_JURAMENTO_TOP_PROMPT).toMatch(/\(14,9\)/);
    expect(TORRE_JURAMENTO_TOP_PROMPT).toMatch(/LAYOUT_SKY_PILLAR_TOP_CLEAN/);
  });
});
