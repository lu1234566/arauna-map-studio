import { TILE_PX } from "./demoAtlas";
import { editorStore } from "./editorStore";

function largestPixelCanvas() {
  if (typeof document === "undefined") return null;
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>("canvas.pixelated"));
  return canvases.reduce<HTMLCanvasElement | null>((best, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (!area) return best;
    if (!best) return canvas;
    const bestRect = best.getBoundingClientRect();
    return area > bestRect.width * bestRect.height ? canvas : best;
  }, null);
}

/** Reenquadra o mapa inteiro no maior canvas pixelado visível do editor. */
export function fitMapCamera() {
  if (typeof window === "undefined") return false;
  const canvas = largestPixelCanvas();
  const viewport = canvas?.parentElement;
  if (!canvas || !viewport) return false;

  const rect = viewport.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  const state = editorStore.getState();
  const mapPixelWidthAtZoom1 = state.map.width * TILE_PX * 2;
  const mapPixelHeightAtZoom1 = state.map.height * TILE_PX * 2;
  if (!mapPixelWidthAtZoom1 || !mapPixelHeightAtZoom1) return false;

  const horizontalPadding = 48;
  const verticalPadding = 44;
  const rawZoom = Math.min(
    Math.max(1, rect.width - horizontalPadding) / mapPixelWidthAtZoom1,
    Math.max(1, rect.height - verticalPadding) / mapPixelHeightAtZoom1,
  );

  // Mantém passos de 0,25: tamanhos de célula continuam amigáveis a pixel art.
  const zoom = Math.min(8, Math.max(0.5, Math.floor(rawZoom * 4) / 4 || 0.5));
  const cell = TILE_PX * zoom * 2;
  editorStore.setZoom(zoom);
  editorStore.setPan({
    x: (rect.width - state.map.width * cell) / 2,
    y: (rect.height - state.map.height * cell) / 2,
  });
  return true;
}

export function requestMapCameraFit() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => fitMapCamera());
}
