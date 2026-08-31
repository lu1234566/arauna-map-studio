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
  const mapX = bounds.x + x;
  const mapY = bounds.y + y;
  return snapshot.cells[mapY * snapshot.width + mapX] ?? "none";
}

function isRoadLike(zone: PixelLabBlueprintZone) {
  return zone === "path" || zone === "entrance";
}

/**
 * Renderiza o Blueprint como DIAGRAMA SEMÂNTICO, não como blocos sólidos.
 * Isso reduz a tendência do Pixflux de copiar as cores/retângulos literalmente,
 * preservando apenas a informação espacial que queremos condicionar.
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
  ctx.imageSmoothingEnabled = false;
  const used = new Set<PixelLabBlueprintZone>();
  const t = INIT_TILE_PX;

  // Fundo neutro. Evita ensinar ao modelo uma cor de terreno específica.
  ctx.fillStyle = "#A9ADA7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grade técnica muito sutil apenas para registrar a lógica 16x16.
  ctx.strokeStyle = "rgba(55,60,57,0.10)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= bounds.w; x++) {
    ctx.beginPath(); ctx.moveTo(x * t + 0.5, 0); ctx.lineTo(x * t + 0.5, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= bounds.h; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * t + 0.5); ctx.lineTo(canvas.width, y * t + 0.5); ctx.stroke();
  }

  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      const zone = localZone(snapshot, bounds, x, y);
      if (zone === "none") continue;
      used.add(zone);
      const px = x * t;
      const py = y * t;
      const cx = px + t / 2;
      const cy = py + t / 2;

      if (zone === "path" || zone === "entrance") {
        // Caminhos viram um grafo de linhas conectadas, não retângulos marrons.
        ctx.strokeStyle = zone === "entrance" ? "#C19736" : "#715A49";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 5;
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        const neighbors = [
          [0, -1, cx, py],
          [1, 0, px + t, cy],
          [0, 1, cx, py + t],
          [-1, 0, px, cy],
        ] as const;
        for (const [dx, dy, ex, ey] of neighbors) {
          if (!isRoadLike(localZone(snapshot, bounds, x + dx, y + dy))) continue;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        }
        if (zone === "entrance") {
          ctx.strokeStyle = "#E6C54B";
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3, py + 3, t - 6, t - 6);
        }
        continue;
      }

      if (zone === "building") {
        // Construção = footprint/contorno, sem massa vermelha preenchida.
        ctx.strokeStyle = "#944A4A";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, t - 6, t - 6);
        ctx.beginPath();
        ctx.moveTo(px + 5, py + 5); ctx.lineTo(px + t - 5, py + t - 5);
        ctx.moveTo(px + t - 5, py + 5); ctx.lineTo(px + 5, py + t - 5);
        ctx.stroke();
        continue;
      }

      if (zone === "water") {
        // Água = linhas onduladas, não bloco azul sólido.
        ctx.strokeStyle = "#4D7594";
        ctx.lineWidth = 1.5;
        for (const oy of [5, 10]) {
          ctx.beginPath();
          ctx.moveTo(px + 2, py + oy);
          ctx.lineTo(px + 6, py + oy - 2);
          ctx.lineTo(px + 10, py + oy + 1);
          ctx.lineTo(px + 14, py + oy - 1);
          ctx.stroke();
        }
        continue;
      }

      if (zone === "vegetation") {
        // Vegetação = pontos/cruzes esparsos para marcar área bloqueada.
        ctx.fillStyle = "#4F7357";
        for (const [ox, oy] of [[4, 4], [11, 5], [7, 11], [13, 12]] as const) {
          ctx.fillRect(px + ox, py + oy, 2, 2);
        }
        ctx.strokeStyle = "rgba(63,94,70,0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2.5, py + 2.5, t - 5, t - 5);
        continue;
      }

      if (zone === "free") {
        // Área livre recebe só um marcador discreto; visual final fica livre para a IA.
        ctx.strokeStyle = "rgba(235,235,225,0.78)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
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
  "The init image is a schematic spatial diagram only, never finished artwork.",
  "Do not reproduce the blueprint colors, lines, hatching, grid, symbols, markers, flat fills or diagram appearance in the final image.",
  "Translate every schematic annotation into fully rendered natural pixel-art terrain, architecture and vegetation.",
  "Preserve the road graph topology, connectivity and mandatory entrance/exit positions shown by the diagram, while allowing natural visual variation inside each 16x16 tile cell.",
  "Keep building footprints inside their marked regions and preserve their access relationship to roads; redesign the actual buildings freely according to the text prompt.",
  "Vegetation annotations indicate blocked/vegetated space, not green paint. Render real trees, bushes and terrain there.",
  "Water annotations indicate water topology, not blue paint. Render natural pixel-art water while preserving its occupied area and crossings.",
  "Open/free annotations must remain visually open and walkable unless the text prompt explicitly says otherwise.",
  "The final output must look like a finished top-down GBA-era RPG map, not a blueprint, diagram, wireframe or colored planning image.",
].join(" ");
