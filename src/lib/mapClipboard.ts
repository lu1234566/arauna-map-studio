import {
  METATILE_MASK,
  getCollision,
  getElevation,
  idx,
  rawValue,
  type MapData,
} from "./emeraldMap";
import type { Selection } from "./editorStore";

export type ClipboardKind = "visual" | "collision" | "elevation" | "raw";

export interface RegionClipboard {
  kind: ClipboardKind;
  width: number;
  height: number;
  values: Uint16Array;
  source: { x: number; y: number };
}

export class ClipboardError extends Error {}

function normalizedSelection(map: MapData, selection: Selection): Selection {
  const x = Math.max(0, Math.min(map.width - 1, Math.floor(selection.x)));
  const y = Math.max(0, Math.min(map.height - 1, Math.floor(selection.y)));
  const right = Math.max(x + 1, Math.min(map.width, Math.ceil(selection.x + selection.w)));
  const bottom = Math.max(y + 1, Math.min(map.height, Math.ceil(selection.y + selection.h)));
  return { x, y, w: right - x, h: bottom - y };
}

export function clipboardValueAt(map: MapData, cellIndex: number, kind: ClipboardKind): number {
  if (kind === "visual") return (map.metatiles[cellIndex] ?? 0) & METATILE_MASK;
  const physical = map.physical[cellIndex] ?? 0;
  if (kind === "collision") return getCollision(physical);
  if (kind === "elevation") return getElevation(physical);
  return rawValue(map, cellIndex);
}

export function captureRegion(
  map: MapData,
  selection: Selection,
  kind: ClipboardKind,
): RegionClipboard {
  if (map.width <= 0 || map.height <= 0) throw new ClipboardError("Mapa sem dimensões válidas.");
  if (selection.w <= 0 || selection.h <= 0) throw new ClipboardError("Seleção vazia.");
  const sel = normalizedSelection(map, selection);
  const values = new Uint16Array(sel.w * sel.h);
  for (let y = 0; y < sel.h; y++) {
    for (let x = 0; x < sel.w; x++) {
      values[idx(x, y, sel.w)] = clipboardValueAt(map, idx(sel.x + x, sel.y + y, map.width), kind);
    }
  }
  return { kind, width: sel.w, height: sel.h, values, source: { x: sel.x, y: sel.y } };
}

export function cloneClipboard(clipboard: RegionClipboard): RegionClipboard {
  return {
    ...clipboard,
    source: { ...clipboard.source },
    values: new Uint16Array(clipboard.values),
  };
}

export function rotateClipboardClockwise(clipboard: RegionClipboard): RegionClipboard {
  const values = new Uint16Array(clipboard.width * clipboard.height);
  const nextWidth = clipboard.height;
  const nextHeight = clipboard.width;
  for (let y = 0; y < clipboard.height; y++) {
    for (let x = 0; x < clipboard.width; x++) {
      const nx = clipboard.height - 1 - y;
      const ny = x;
      values[idx(nx, ny, nextWidth)] = clipboard.values[idx(x, y, clipboard.width)] ?? 0;
    }
  }
  return { ...clipboard, width: nextWidth, height: nextHeight, values };
}

export function flipClipboardHorizontal(clipboard: RegionClipboard): RegionClipboard {
  const values = new Uint16Array(clipboard.values.length);
  for (let y = 0; y < clipboard.height; y++) {
    for (let x = 0; x < clipboard.width; x++) {
      values[idx(clipboard.width - 1 - x, y, clipboard.width)] =
        clipboard.values[idx(x, y, clipboard.width)] ?? 0;
    }
  }
  return { ...clipboard, values };
}

export function flipClipboardVertical(clipboard: RegionClipboard): RegionClipboard {
  const values = new Uint16Array(clipboard.values.length);
  for (let y = 0; y < clipboard.height; y++) {
    for (let x = 0; x < clipboard.width; x++) {
      values[idx(x, clipboard.height - 1 - y, clipboard.width)] =
        clipboard.values[idx(x, y, clipboard.width)] ?? 0;
    }
  }
  return { ...clipboard, values };
}

export function kindLabel(kind: ClipboardKind): string {
  if (kind === "visual") return "Visual";
  if (kind === "collision") return "Colisão";
  if (kind === "elevation") return "Elevação";
  return "RAW completo";
}
