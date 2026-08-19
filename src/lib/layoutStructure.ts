import {
  ELEVATION_MASK,
  METATILE_MASK,
  PHYSICAL_MASK,
  cloneMap,
  parseMapBin,
  type MapData,
} from "./emeraldMap";
import { cloneMapJson, type EditableMapJson } from "./eventMapJson";

export type ResizeAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface ResizeResult {
  map: MapData;
  dx: number;
  dy: number;
  copiedCells: number;
  croppedCells: number;
  addedCells: number;
}

export interface ShiftedJsonResult {
  document: EditableMapJson;
  outOfBounds: Array<{ source: string; index: number; x: number; y: number }>;
  shiftedEvents: number;
  adjustedConnections: number;
}

export class LayoutStructureError extends Error {}

const EVENT_KEYS = ["warp_events", "object_events", "coord_events", "bg_events"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function axisOffset(oldSize: number, newSize: number, alignment: "start" | "center" | "end") {
  if (alignment === "start") return 0;
  if (alignment === "end") return newSize - oldSize;
  return Math.floor((newSize - oldSize) / 2);
}

function anchorAxes(anchor: ResizeAnchor): {
  horizontal: "start" | "center" | "end";
  vertical: "start" | "center" | "end";
} {
  const horizontal = anchor.endsWith("left") || anchor === "left"
    ? "start"
    : anchor.endsWith("right") || anchor === "right"
      ? "end"
      : "center";
  const vertical = anchor.startsWith("top") || anchor === "top"
    ? "start"
    : anchor.startsWith("bottom") || anchor === "bottom"
      ? "end"
      : "center";
  return { horizontal, vertical };
}

export function parseRawCell(value: string | number): number {
  const numeric = typeof value === "number"
    ? value
    : /^0x/i.test(value.trim())
      ? Number.parseInt(value.trim().slice(2), 16)
      : Number(value.trim());
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffff) {
    throw new LayoutStructureError(`Valor de célula inválido: ${String(value)}. Use 0..65535 ou 0x0000..0xFFFF.`);
  }
  return numeric;
}

export function resizeMapData(
  source: MapData,
  newWidth: number,
  newHeight: number,
  anchor: ResizeAnchor = "top-left",
  fillRaw = 0,
): ResizeResult {
  if (!Number.isInteger(newWidth) || !Number.isInteger(newHeight) || newWidth <= 0 || newHeight <= 0) {
    throw new LayoutStructureError(`Dimensão inválida: ${newWidth}×${newHeight}.`);
  }
  if (newWidth > 512 || newHeight > 512) {
    throw new LayoutStructureError("O Studio limita redimensionamento a 512×512 para evitar alocações acidentais enormes.");
  }

  const raw = parseRawCell(fillRaw);
  const axes = anchorAxes(anchor);
  const dx = axisOffset(source.width, newWidth, axes.horizontal);
  const dy = axisOffset(source.height, newHeight, axes.vertical);
  const size = newWidth * newHeight;
  const metatiles = new Uint16Array(size);
  const physical = new Uint16Array(size);
  metatiles.fill(raw & METATILE_MASK);
  physical.fill(raw & PHYSICAL_MASK);

  let copiedCells = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= newWidth || ny >= newHeight) continue;
      const from = y * source.width + x;
      const to = ny * newWidth + nx;
      metatiles[to] = source.metatiles[from] ?? 0;
      physical[to] = source.physical[from] ?? 0;
      copiedCells++;
    }
  }

  return {
    map: { width: newWidth, height: newHeight, metatiles, physical },
    dx,
    dy,
    copiedCells,
    croppedCells: source.width * source.height - copiedCells,
    addedCells: newWidth * newHeight - copiedCells,
  };
}

export function shiftMapJsonForResize(
  source: EditableMapJson,
  dx: number,
  dy: number,
  newWidth: number,
  newHeight: number,
): ShiftedJsonResult {
  const document = cloneMapJson(source);
  const outOfBounds: ShiftedJsonResult["outOfBounds"] = [];
  let shiftedEvents = 0;

  for (const key of EVENT_KEYS) {
    const events = document[key];
    if (!Array.isArray(events)) continue;
    events.forEach((value, index) => {
      if (!isRecord(value)) return;
      const x = Number(value["x"]);
      const y = Number(value["y"]);
      if (!Number.isInteger(x) || !Number.isInteger(y)) return;
      const nextX = x + dx;
      const nextY = y + dy;
      value["x"] = nextX;
      value["y"] = nextY;
      if (dx !== 0 || dy !== 0) shiftedEvents++;
      if (nextX < 0 || nextY < 0 || nextX >= newWidth || nextY >= newHeight) {
        outOfBounds.push({ source: key, index, x: nextX, y: nextY });
      }
    });
  }

  let adjustedConnections = 0;
  const connections = document["connections"];
  if (Array.isArray(connections)) {
    connections.forEach((value) => {
      if (!isRecord(value)) return;
      const direction = String(value["direction"] ?? "");
      const offset = Number(value["offset"]);
      if (!Number.isInteger(offset)) return;
      const delta = direction === "up" || direction === "down"
        ? dx
        : direction === "left" || direction === "right"
          ? dy
          : 0;
      if (delta !== 0) {
        value["offset"] = offset + delta;
        adjustedConnections++;
      }
    });
  }

  return { document, outOfBounds, shiftedEvents, adjustedConnections };
}

export function updateLayoutDimensionsSource(
  layoutsSource: string,
  layoutId: string,
  width: number,
  height: number,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(layoutsSource);
  } catch (error) {
    throw new LayoutStructureError(
      `layouts.json inválido: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new LayoutStructureError("layouts.json precisa ter um objeto na raiz.");
  }
  const layouts = parsed["layouts"];
  if (!Array.isArray(layouts)) {
    throw new LayoutStructureError("layouts.json não contém a lista layouts.");
  }
  const layout = layouts.find(
    (value) => isRecord(value) && value["id"] === layoutId,
  );
  if (!layout || !isRecord(layout)) {
    throw new LayoutStructureError(`Layout ${layoutId} não encontrado em layouts.json.`);
  }
  layout["width"] = width;
  layout["height"] = height;
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function parseEmeraldBorder(buffer: ArrayBuffer): MapData {
  if (buffer.byteLength !== 8) {
    throw new LayoutStructureError(
      `border.bin possui ${buffer.byteLength} bytes. O formato Emerald esperado pelo Studio é 2×2 = 8 bytes.`,
    );
  }
  return parseMapBin(buffer, 2, 2);
}

export function cloneBorder(border: MapData): MapData {
  if (border.width !== 2 || border.height !== 2) {
    throw new LayoutStructureError("O border Emerald precisa permanecer 2×2.");
  }
  return cloneMap(border);
}

export function setBorderRaw(border: MapData, index: number, rawValue: number): MapData {
  if (border.width !== 2 || border.height !== 2 || index < 0 || index >= 4) {
    throw new LayoutStructureError("Célula de border inválida.");
  }
  const raw = parseRawCell(rawValue);
  const next = cloneBorder(border);
  next.metatiles[index] = raw & METATILE_MASK;
  next.physical[index] = raw & PHYSICAL_MASK;
  return next;
}

export function borderCellRaw(border: MapData, index: number): number {
  if (index < 0 || index >= border.metatiles.length) return 0;
  return ((border.physical[index] ?? 0) & PHYSICAL_MASK) | ((border.metatiles[index] ?? 0) & METATILE_MASK);
}

export function describeRawCell(rawValue: number) {
  const raw = parseRawCell(rawValue);
  return {
    raw,
    metatile: raw & METATILE_MASK,
    collision: (raw >> 10) & 0x3,
    elevation: (raw & ELEVATION_MASK) >> 12,
  };
}
