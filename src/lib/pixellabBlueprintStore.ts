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

const ZONE_META = new Map(PIXELLAB_BLUEPRINT_ZONES.map((zone) => [zone.id, zone] as const));
const EMPTY_COLOR = "#272C29";

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

export function renderPixelLabBlueprint(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState = state): PixelLabBlueprintRender {
  if (typeof document === "undefined") throw new Error("Blueprint só pode ser renderizado no navegador.");
  if (snapshot.width <= 0 || snapshot.height <= 0 || snapshot.cells.length !== snapshot.width * snapshot.height) throw new Error("Blueprint ainda não está inicializado para este mapa.");
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.w > snapshot.width || bounds.y + bounds.h > snapshot.height) throw new Error("Bounds do blueprint ultrapassam o mapa.");

  const canvas = document.createElement("canvas");
  canvas.width = bounds.w * INIT_TILE_PX;
  canvas.height = bounds.h * INIT_TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível para o Blueprint PixelLab.");
  ctx.imageSmoothingEnabled = false;
  const used = new Set<PixelLabBlueprintZone>();

  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      const mapX = bounds.x + x;
      const mapY = bounds.y + y;
      const zone = snapshot.cells[mapY * snapshot.width + mapX] ?? "none";
      if (zone !== "none") used.add(zone);
      ctx.fillStyle = zone === "none" ? EMPTY_COLOR : (ZONE_META.get(zone)?.color ?? EMPTY_COLOR);
      ctx.fillRect(x * INIT_TILE_PX, y * INIT_TILE_PX, INIT_TILE_PX, INIT_TILE_PX);
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
  "The init image is a structural color blueprint, not finished art.",
  "Preserve the exact road topology, connectivity and mandatory entrance/exit cells shown by the blueprint.",
  "Keep building zones in their marked regions; building visuals may change but their placement zones and access connections must remain.",
  "Vegetation zones must remain outside walkable road areas and should read as blocked terrain.",
  "Water zones must remain water and must not cut mandatory connections unless the blueprint explicitly does so.",
  "Respect open/free zones and keep the result fully top-down with readable 16x16-tile RPG logic.",
  "Blueprint color legend: brown = roads/paths; red = building zones; blue = water; green = vegetation/blocked; light gray = open/free; yellow = mandatory entrances/exits; dark gray = unassigned.",
].join(" ");
