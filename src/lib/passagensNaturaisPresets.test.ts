import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { parseLocalMapCommand } from "./aiMapLocalInterpreter";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import {
  MATA_DA_ESPERA_PROMPT, PASSO_CORTADO_PROMPT, TRILHA_DE_BRASA_PROMPT,
  mataDaEsperaGuard, passoCortadoGuard, trilhaDeBrasaGuard,
} from "./passagensNaturaisPresets";

const maps = [
  { label: "Mata", width: 48, height: 44, id: "MAP_PETALBURG_WOODS", secondary: "gTileset_Rustboro", prompt: MATA_DA_ESPERA_PROMPT, guard: mataDaEsperaGuard },
  { label: "Brasa", width: 35, height: 38, id: "MAP_FIERY_PATH", secondary: "gTileset_Lavaridge", prompt: TRILHA_DE_BRASA_PROMPT, guard: trilhaDeBrasaGuard },
  { label: "Passo", width: 30, height: 46, id: "MAP_JAGGED_PASS", secondary: "gTileset_Lavaridge", prompt: PASSO_CORTADO_PROMPT, guard: passoCortadoGuard },
] as const;

describe("presets de passagens naturais", () => {
  it("usa map id, dimensão e tileset reais", () => {
    for (const map of maps) {
      expect(map.guard({ width: map.width, height: map.height, mapId: map.id, atlasPrimary: "gTileset_General", atlasSecondary: map.secondary }).enabled, map.label).toBe(true);
      expect(map.guard({ width: map.width, height: map.height, mapId: "MAP_FAKE" }).enabled, map.label).toBe(false);
    }
  });

  it("permanece layered-only e protege behaviors funcionais", () => {
    for (const map of maps) {
      expect(isAiRemodelPrompt(map.prompt), map.label).toBe(true);
      expect(map.prompt).toMatch(/preservar todos os comportamentos funcionais/i);
      const layered = parseLayeredPrompt(map.prompt);
      expect(layered.active, map.label).toBe(true);
      expect(layered.errors, map.label).toEqual([]);
      const parsed = parseLocalMapCommand(map.prompt, [], [], map.width, map.height);
      expect(parsed.errors, map.label).toEqual([]);
      expect(parsed.plan?.connections, map.label).toEqual([]);
    }
  });

  it("mantém as três mecânicas críticas declaradas", () => {
    expect(MATA_DA_ESPERA_PROMPT).toMatch(/VAR_PETALBURG_WOODS_STATE/);
    expect(TRILHA_DE_BRASA_PROMPT).toMatch(/seis boulders/i);
    expect(PASSO_CORTADO_PROMPT).toMatch(/\(16,17\)/);
    expect(PASSO_CORTADO_PROMPT).toMatch(/STEP_CB_ASH/);
  });
});
