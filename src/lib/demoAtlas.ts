import { realAtlasStore } from "./realAtlasStore";

/**
 * Compatibility facade kept for older studio components.
 *
 * The procedural atlas that used to draw fake grass, trees, roofs, water and
 * fences with Canvas shapes has intentionally been removed. Runtime rendering
 * now succeeds only when a real Gen III atlas is active. Missing assets fail
 * closed instead of pretending to be Pokémon/GBA graphics.
 */
export type MetatileCategory = "Natureza" | "Caminhos" | "Construções" | "Água" | "Decoração";
export type PatternKind = never;

export interface DemoMetatile {
  id: number;
  name: string;
  category: MetatileCategory;
  colors: [string, string, string];
  pattern: PatternKind;
}

export const CATEGORIES: MetatileCategory[] = [];
export const DEMO_METATILES: DemoMetatile[] = [];
export const METATILE_BY_ID = new Map<number, DemoMetatile>();
export const TILE_PX = 16;

let missingCanvas: HTMLCanvasElement | null = null;

function getMissingCanvas(): HTMLCanvasElement {
  if (missingCanvas) return missingCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TILE_PX, TILE_PX);
  }
  missingCanvas = canvas;
  return canvas;
}

/** @deprecated Procedural metatiles were removed; retained only for type compatibility. */
export function drawMetatile(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, TILE_PX, TILE_PX);
}

export function getAtlasCanvas(): HTMLCanvasElement {
  const real = realAtlasStore.ensureHydrated();
  if (real) {
    const canvas = realAtlasStore.getSingleRowCanvas(real);
    if (canvas) return canvas;
  }
  return getMissingCanvas();
}

export function getAtlasSlot(id: number): number | undefined {
  const real = realAtlasStore.ensureHydrated();
  if (!real) return undefined;
  return realAtlasStore.recordFor(id, real)?.slot;
}

export function hasRealAtlas(): boolean {
  return Boolean(realAtlasStore.ensureHydrated());
}
