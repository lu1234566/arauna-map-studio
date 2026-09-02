import { describe, expect, it } from "vitest";
import { parseLayeredPrompt } from "./aiLayeredPrompt";
import { isAiRemodelPrompt } from "./aiMapReconstruction";
import { parseDetailedMapCommand } from "./aiMapPlan";
import {
  BAIA_DAS_LUZES_HEIGHT,
  BAIA_DAS_LUZES_PROMPT,
  BAIA_DAS_LUZES_WIDTH,
  baiaDasLuzesGuard,
} from "./baiaDasLuzesPreset";

describe("piloto Baía das Luzes", () => {
  it("libera apenas no Lilycove real 80x40 com General + Lilycove", () => {
    expect(baiaDasLuzesGuard({
      width: 80,
      height: 40,
      mapId: "MAP_LILYCOVE_CITY",
      atlasPrimary: "gTileset_General",
      atlasSecondary: "gTileset_Lilycove",
    }).enabled).toBe(true);

    expect(baiaDasLuzesGuard({ width: 40, height: 40, mapId: "MAP_LILYCOVE_CITY" }).enabled).toBe(false);
    expect(baiaDasLuzesGuard({ width: 80, height: 40, mapId: "MAP_MOSSDEEP_CITY" }).enabled).toBe(false);
  });

  it("separa a cidade moderna dos corredores narrativos e da costa", () => {
    expect(isAiRemodelPrompt(BAIA_DAS_LUZES_PROMPT)).toBe(true);
    const layered = parseLayeredPrompt(BAIA_DAS_LUZES_PROMPT);
    expect(layered.active).toBe(true);
    expect(layered.errors).toEqual([]);
    expect(layered.preserveUnassigned).toBe(true);
    expect(layered.strictIsolation).toBe(false);
    expect(layered.zones).toHaveLength(19);
    expect(layered.zones.filter((zone) => zone.kind === "road")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "base")).toHaveLength(5);
    expect(layered.zones.filter((zone) => zone.material.role === "green")).toHaveLength(3);
    expect(layered.zones.filter((zone) => zone.material.role === "urban")).toHaveLength(4);
    expect(layered.zones.filter((zone) => zone.material.role === "preserve")).toHaveLength(7);

    const ciro = layered.zones.find((zone) => zone.label.includes("Ciro"));
    const archive = layered.zones.find((zone) => zone.label.includes("Arquivo Vivo"));
    expect(ciro).toMatchObject({ x1: 23, x2: 31, y1: 4, y2: 10 });
    expect(archive).toMatchObject({ x1: 64, x2: 79, y1: 0, y2: 18 });

    for (const zone of layered.zones) {
      expect(zone.x1).toBeGreaterThanOrEqual(0);
      expect(zone.y1).toBeGreaterThanOrEqual(0);
      expect(zone.x2).toBeLessThan(BAIA_DAS_LUZES_WIDTH);
      expect(zone.y2).toBeLessThan(BAIA_DAS_LUZES_HEIGHT);
    }
  });

  it("compila exatamente as duas conexões costeiras reais", () => {
    const parsed = parseDetailedMapCommand(BAIA_DAS_LUZES_PROMPT, [], [], 80, 40);
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "west", map: "MAP_ROUTE121", offset: 10 }),
      expect.objectContaining({ direction: "east", map: "MAP_ROUTE124", offset: -10 }),
    ]));
    expect(parsed.plan?.connections).toHaveLength(2);
  });
});
