import { idx, type MapData } from "./emeraldMap";
import { INIT_TILE_PX, TIER1_MAX_TILES, TIER1_MIN_PX, normalizeBase64Png } from "./pixellab";
import { atlasSourceRect, realAtlasStore } from "./realAtlasStore";

export interface PixelLabRegion { x: number; y: number; w: number; h: number }
export type PixelLabRegionResolution =
  | { ok: true; bounds: PixelLabRegion; pixelWidth: number; pixelHeight: number; source: "selection" | "map" }
  | { ok: false; message: string };
export interface PixelLabRenderedRegion { bounds: PixelLabRegion; pixelWidth: number; pixelHeight: number; imageDataUrl: string; imageBase64: string; paletteDataUrl: string | null; paletteBase64: string | null; paletteColors: string[] }

export function resolvePixelLabRegion(map: Pick<MapData, "width" | "height">, selection: PixelLabRegion | null): PixelLabRegionResolution {
  const bounds = selection ?? { x: 0, y: 0, w: map.width, h: map.height };
  if (![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isInteger) || bounds.w <= 0 || bounds.h <= 0) return { ok: false, message: "A seleção do Init Image é inválida." };
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.w > map.width || bounds.y + bounds.h > map.height) return { ok: false, message: "A seleção do Init Image ultrapassa os limites do mapa." };
  if (bounds.w > TIER1_MAX_TILES || bounds.h > TIER1_MAX_TILES) return { ok: false, message: `Tier 1: selecione no máximo ${TIER1_MAX_TILES}×${TIER1_MAX_TILES} metatiles para usar como Init Image.` };
  const pixelWidth = bounds.w * INIT_TILE_PX, pixelHeight = bounds.h * INIT_TILE_PX;
  if (pixelWidth < TIER1_MIN_PX || pixelHeight < TIER1_MIN_PX) return { ok: false, message: "O Init Image precisa ter pelo menos 2×2 metatiles (32×32 px)." };
  return { ok: true, bounds, pixelWidth, pixelHeight, source: selection ? "selection" : "map" };
}

export function pixelLabRegionDiversity(map: MapData, bounds: PixelLabRegion) {
  const counts = new Map<number, number>();
  const total = bounds.w * bounds.h;
  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      const id = map.metatiles[idx(bounds.x + x, bounds.y + y, map.width)] ?? 0;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const dominantCount = Math.max(0, ...counts.values());
  return {
    uniqueMetatiles: counts.size,
    dominantRatio: total > 0 ? dominantCount / total : 1,
    meaningful: counts.size >= 2 && dominantCount / Math.max(total, 1) < 0.98,
  };
}

export function dominantPaletteFromPixels(rgba: Uint8ClampedArray, maxColors = 24): string[] {
  const counts = new Map<number, number>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < 32) continue;
    const key = ((rgba[i] ?? 0) << 16) | ((rgba[i + 1] ?? 0) << 8) | (rgba[i + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, Math.max(1, Math.min(32, maxColors))).map(([key]) => `#${key.toString(16).padStart(6, "0").toUpperCase()}`);
}

function paletteCanvas(colors: string[]): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !colors.length) return null;
  const columns = Math.min(8, colors.length), rows = Math.ceil(colors.length / columns), swatch = 8;
  const canvas = document.createElement("canvas"); canvas.width = columns * swatch; canvas.height = rows * swatch;
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  colors.forEach((color, index) => { ctx.fillStyle = color; ctx.fillRect((index % columns) * swatch, Math.floor(index / columns) * swatch, swatch, swatch); });
  return canvas;
}

export function renderPixelLabRegion(map: MapData, bounds: PixelLabRegion): PixelLabRenderedRegion {
  if (typeof document === "undefined") throw new Error("Renderização PixelLab só está disponível no navegador.");
  const diversity = pixelLabRegionDiversity(map, bounds);
  if (!diversity.meaningful) {
    throw new Error(
      "A região está vazia ou quase uniforme e não serve como Init Image/paleta. Desmarque ‘Usar mapa/seleção como Init Image’ e ‘Usar paleta atual’ para gerar somente pelo prompt, ou desenhe um rascunho com pelo menos dois tipos de metatile.",
    );
  }
  const atlas = realAtlasStore.ensureHydrated(); const source = realAtlasStore.getCanvas(atlas);
  if (!atlas || !source) throw new Error("Carregue um atlas/tileset real antes de gerar um Init Image PixelLab.");
  const canvas = document.createElement("canvas"); canvas.width = bounds.w * INIT_TILE_PX; canvas.height = bounds.h * INIT_TILE_PX;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new Error("Canvas 2D indisponível para renderizar o Init Image."); ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < bounds.h; y++) for (let x = 0; x < bounds.w; x++) {
    const id = map.metatiles[idx(bounds.x + x, bounds.y + y, map.width)] ?? 0;
    const record = realAtlasStore.recordFor(id, atlas);
    if (!record) throw new Error(`Metatile 0x${id.toString(16).toUpperCase().padStart(3, "0")} não existe no atlas real ativo.`);
    const rect = atlasSourceRect(atlas, record);
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, x * INIT_TILE_PX, y * INIT_TILE_PX, INIT_TILE_PX, INIT_TILE_PX);
  }
  const paletteColors = dominantPaletteFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data, 24);
  const palette = paletteCanvas(paletteColors); const imageDataUrl = canvas.toDataURL("image/png"); const paletteDataUrl = palette?.toDataURL("image/png") ?? null;
  return { bounds, pixelWidth: canvas.width, pixelHeight: canvas.height, imageDataUrl, imageBase64: normalizeBase64Png(imageDataUrl), paletteDataUrl, paletteBase64: paletteDataUrl ? normalizeBase64Png(paletteDataUrl) : null, paletteColors };
}
