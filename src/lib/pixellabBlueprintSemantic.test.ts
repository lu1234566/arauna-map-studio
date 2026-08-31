import { describe, expect, it } from "vitest";
import { describePixelLabBlueprint } from "./pixellabBlueprintSemantic";
import type { PixelLabBlueprintState } from "./pixellabBlueprintStore";

function blank(width: number, height: number): PixelLabBlueprintState {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => "none" as const),
    enabled: false,
    activeZone: "path",
    brushSize: 1,
    revision: 0,
  };
}

describe("PixelLab semantic blueprint", () => {
  it("descreve uma estrada em T sem depender de imagem-guia", () => {
    const state = blank(20, 20);
    for (let x = 0; x < 20; x++) state.cells[11 * 20 + x] = "path";
    for (let y = 11; y < 20; y++) state.cells[y * 20 + 10] = "path";
    state.cells[11 * 20] = "entrance";

    const prompt = describePixelLabBlueprint({ x: 0, y: 0, w: 20, h: 20 }, state);
    expect(prompt).toMatch(/horizontal road y=11, x=0\.\.19/i);
    expect(prompt).toMatch(/vertical road x=10, y=11\.\.19/i);
    expect(prompt).toMatch(/Mandatory map entrances\/exits: \(0,11\)/i);
    expect(prompt).toMatch(/never rails, ladders/i);
    expect(prompt).toMatch(/Do not draw or show the grid/i);
  });

  it("resume zonas por componentes e caixas", () => {
    const state = blank(10, 10);
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 5; x++) state.cells[y * 10 + x] = "vegetation";
    state.cells[7 * 10 + 1] = "building";
    state.cells[7 * 10 + 2] = "building";

    const prompt = describePixelLabBlueprint({ x: 0, y: 0, w: 10, h: 10 }, state);
    expect(prompt).toMatch(/Vegetation\/blocked zones: box x=2\.\.5, y=1\.\.3 \(12 cells\)/i);
    expect(prompt).toMatch(/Building zones: box x=1\.\.2, y=7\.\.7 \(2 cells\)/i);
  });
});
