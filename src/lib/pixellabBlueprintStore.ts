import { useSyncExternalStore } from "react";
import type { PixelLabRegion } from "./pixellabMapRender";
import { INIT_TILE_PX } from "./pixellab";

export type PixelLabBlueprintZone =
  | "none"
  | "path"
  | "building"
  | "water"
  | "vegetation"
  | "free"
  | "entrance";

export interface PixelLabBlueprintZoneMeta {
  id: PixelLabBlueprintZone;
  label: string;
  color: string;
  promptLabel: string;
}

export const PIXELLAB_BLUEPRINT_ZONES: PixelLabBlueprintZoneMeta[] = [
  { id: "path", label: "Caminho", color: "#B86F4B", promptLabel: "road/path" },
  { id: "building", label: "Construção", color: "#D95555", promptLabel: "building zone" },
  { id: "water", label: "Água", color: "#4387D9", promptLabel: "water" },
  { id: "vegetation", label: "Vegetação", color: "#3C8A57", promptLabel: "vegetation/blocked" },
  { id: "free", label: "Livre", color: "#B9B9B2", promptLabel: "open/free area" },
  { id: "entrance", label: "Entrada/Saída", color: "#E4C34B", promptLabel: "mandatory entrance/exit" },
  { id: "none", label: "Apagar", color: "#222725", promptLabel: "unassigned" },
];

type Listener = () => void;
export interface PixelLabBlueprintState {
  width: number;
  height: number;
  cells: PixelLabBlueprintZone[];
  enabled: boolean;
  activeZone: PixelLabBlueprintZone;
  brushSize: 1 | 2 | 3;
  revision: number;
}

let state: PixelLabBlueprintState = {
  width: 0,
  height: 0,
  cells: [],
  enabled: false,
  activeZone: "path",
  brushSize: 1,
  revision: 0,
};
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener());
const blankCells = (width: number, height: number) => Array.from({ length: Math.max(0, width * height) }, () => "none" as PixelLabBlueprintZone);

export const pixelLabBlueprintStore = {
  subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot() { return state; },
  getServerSnapshot(): PixelLabBlueprintState { return { width: 0, height: 0, cells: [], enabled: false, activeZone: "path", brushSize: 1, revision: 0 }; },
  ensureDimensions(width: number, height: number) {
    if (state.width === width && state.height === height && state.cells.length === width * height) return;
    state = { ...state, width, height, cells: blankCells(width, height), enabled: false, revision: state.revision + 1 };
    emit();
  },
  setEnabled(enabled: boolean) { if (state.enabled === enabled) return; state = { ...state, enabled }; emit(); },
  toggleEnabled() { state = { ...state, enabled: !state.enabled }; emit(); },
  setActiveZone(activeZone: PixelLabBlueprintZone) { state = { ...state, activeZone }; emit(); },
  setBrushSize(brushSize: 1 | 2 | 3) { state = { ...state, brushSize }; emit(); },
  clear() { state = { ...state, cells: blankCells(state.width, state.height), revision: state.revision + 1 }; emit(); },
  paintCell(x: number, y: number, zone = state.activeZone, brushSize = state.brushSize) {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const cells = state.cells.slice();
    const before = Math.floor((brushSize - 1) / 2);
    const after = brushSize - before - 1;
    let changed = false;
    for (let yy = y - before; yy <= y + after; yy++) {
      for (let xx = x - before; xx <= x + after; xx++) {
        if (xx < 0 || yy < 0 || xx >= state.width || yy >= state.height) continue;
        const index = yy * state.width + xx;
        if (cells[index] === zone) continue;
        cells[index] = zone;
        changed = true;
      }
    }
    if (!changed) return;
    state = { ...state, cells, revision: state.revision + 1 };
    emit();
  },
};

export function usePixelLabBlueprint() {
  return useSyncExternalStore(pixelLabBlueprintStore.subscribe, pixelLabBlueprintStore.getSnapshot, pixelLabBlueprintStore.getServerSnapshot);
}

export function blueprintHasContent(snapshot: PixelLabBlueprintState = state) {
  return snapshot.cells.some((zone) => zone !== "none");
}

export function blueprintZoneCounts(snapshot: PixelLabBlueprintState = state) {
  const counts = new Map<PixelLabBlueprintZone, number>();
  for (const zone of snapshot.cells) counts.set(zone, (counts.get(zone) ?? 0) + 1);
  return counts;
}

export interface PixelLabBlueprintRender {
  bounds: PixelLabRegion;
  pixelWidth: number;
  pixelHeight: number;
  imageDataUrl: string;
  imageBase64: string;
  usedZones: PixelLabBlueprintZone[];
}

function stripDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function localZone(snapshot: PixelLabBlueprintState, bounds: PixelLabRegion, x: number, y: number): PixelLabBlueprintZone {
  if (x < 0 || y < 0 || x >= bounds.w || y >= bounds.h) return "none";
  return snapshot.cells[(bounds.y + y) * snapshot.width + bounds.x + x] ?? "none";
}

function center(x: number, y: number) {
  return { x: x * INIT_TILE_PX + INIT_TILE_PX / 2, y: y * INIT_TILE_PX + INIT_TILE_PX / 2 };
}

function isRoadLike(zone: PixelLabBlueprintZone) {
  return zone === "path" || zone === "entrance";
}

function drawConnectedNetwork(
  ctx: CanvasRenderingContext2D,
  bounds: PixelLabRegion,
  snapshot: PixelLabBlueprintState,
  zone: "path" | "water",
  color: string,
  lineWidth: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      if (localZone(snapshot, bounds, x, y) !== zone) continue;
      const from = center(x, y);
      ctx.beginPath();
      ctx.arc(from.x, from.y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();

      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const neighbor = localZone(snapshot, bounds, x + dx, y + dy);
        const connected = zone === "path" ? isRoadLike(neighbor) : neighbor === "water";
        if (!connected) continue;
        const to = center(x + dx, y + dy);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Exporta uma referência SEMÂNTICA leve para o Pixflux.
 * O editor continua colorido para o usuário, mas a IA recebe somente sinais
 * espaciais contínuos — sem grade, sem blocos por tile e sem aparência de mapa pronto.
 */
export function renderPixelLabBlueprint(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState = state): PixelLabBlueprintRender {
  if (typeof document === "undefined") throw new Error("Blueprint só pode ser renderizado no navegador.");
  if (snapshot.width <= 0 || snapshot.height <= 0 || snapshot.cells.length !== snapshot.width * snapshot.height) throw new Error("Blueprint ainda não está inicializado para este mapa.");
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.w > snapshot.width || bounds.y + bounds.h > snapshot.height) throw new Error("Bounds do blueprint ultrapassam o mapa.");

  const canvas = document.createElement("canvas");
  canvas.width = bounds.w * INIT_TILE_PX;
  canvas.height = bounds.h * INIT_TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível para o Blueprint PixelLab.");
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#D7D8D2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const used = new Set<PixelLabBlueprintZone>();

  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      const zone = localZone(snapshot, bounds, x, y);
      if (zone !== "none") used.add(zone);
      const px = x * INIT_TILE_PX;
      const py = y * INIT_TILE_PX;
      const c = center(x, y);

      if (zone === "building") {
        ctx.save();
        ctx.strokeStyle = "rgba(137,83,83,0.62)";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, INIT_TILE_PX - 8, INIT_TILE_PX - 8);
        ctx.restore();
      } else if (zone === "vegetation") {
        ctx.save();
        ctx.fillStyle = "rgba(75,104,78,0.48)";
        for (const [ox, oy, radius] of [[-3, 2, 1.8], [2, -2, 1.6], [3, 3, 1.4]] as const) {
          ctx.beginPath();
          ctx.arc(c.x + ox, c.y + oy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (zone === "free") {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,248,0.34)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Redes contínuas, desenhadas depois das zonas para evitar o efeito "escada".
  drawConnectedNetwork(ctx, bounds, snapshot, "path", "rgba(111,88,72,0.66)", 5);
  drawConnectedNetwork(ctx, bounds, snapshot, "water", "rgba(72,108,136,0.58)", 7);

  // Entrada/saída é só um nó de ligação discreto; não vira bloco amarelo.
  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      if (localZone(snapshot, bounds, x, y) !== "entrance") continue;
      const c = center(x, y);
      ctx.save();
      ctx.strokeStyle = "rgba(142,119,58,0.74)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (localZone(snapshot, bounds, x + dx, y + dy) !== "path") continue;
        const to = center(x + dx, y + dy);
        ctx.save();
        ctx.strokeStyle = "rgba(111,88,72,0.66)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  const imageDataUrl = canvas.toDataURL("image/png");
  return {
    bounds,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    imageDataUrl,
    imageBase64: stripDataUrl(imageDataUrl),
    usedZones: [...used],
  };
}

export const PIXELLAB_BLUEPRINT_PROMPT_APPENDIX = [
  "The init image is only a loose semantic planning guide, never artwork and never a tile-grid image.",
  "Do not reproduce the guide itself: no grid, boxes, rails, ladders, schematic lines, guide dots, flat guide colors or planning symbols in the final image.",
  "Translate every guide mark into finished natural pixel-art terrain, architecture and vegetation according to the written description.",
  "Keep the connectivity of the main road network and mandatory entrance/exit nodes, but make road widths, curves, landscaping and silhouettes organic rather than diagram-like.",
  "Building outlines indicate approximate placement only; create real buildings with readable doors connected to the road network.",
  "Vegetation marks indicate blocked green areas, water lines indicate water corridors, and faint free-area marks reserve breathing room.",
  "The final output must be a fully rendered top-down GBA-era RPG map with natural terrain transitions and readable 16x16-tile logic, not a blueprint or wireframe.",
].join(" ");
