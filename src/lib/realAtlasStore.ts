import { useEffect, useSyncExternalStore } from "react";
import {
  METATILE_SIZE,
  atlasRecords,
  renderAtlasCanvas,
  type AtlasRecord,
  type RenderTilesetPair,
} from "./emeraldTileset";

export interface SavedAtlasRecord extends AtlasRecord {
  slot: number;
}

export interface SaveAtlasMetadata {
  primary?: string;
  secondary?: string;
  origin?: string;
  game?: string;
}

export interface SavedRealAtlas {
  format: "arauna-real-atlas-v2";
  primary: string;
  secondary: string;
  origin?: string;
  game?: string;
  columns: number;
  tileSize: number;
  width: number;
  height: number;
  createdAt: string;
  rgbaBase64: string;
  records: SavedAtlasRecord[];
}

const STORAGE_KEY = "arauna.realAtlas.v2";
const LEGACY_KEY = "arauna.realAtlas.v1";

type Listener = () => void;

function bytesToBase64(bytes: Uint8ClampedArray): string {
  let binary = "";
  const chunk = 0x8000;
  for (let start = 0; start < bytes.length; start += chunk) {
    const slice = bytes.subarray(start, Math.min(start + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(source: string): Uint8ClampedArray {
  const binary = atob(source);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class RealAtlasStore {
  private atlas: SavedRealAtlas | null = null;
  private hydrated = false;
  private listeners = new Set<Listener>();
  private canvasCache: { createdAt: string; canvas: HTMLCanvasElement } | null = null;
  private rowCache: { createdAt: string; canvas: HTMLCanvasElement } | null = null;
  private recordCache: { createdAt: string; map: Map<number, SavedAtlasRecord> } | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.atlas;
  getServerSnapshot = () => null;

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  hydrate = () => {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.removeItem(LEGACY_KEY);
        return;
      }
      const parsed = JSON.parse(raw) as SavedRealAtlas;
      const expectedBytes = parsed.width * parsed.height * 4;
      const valid =
        parsed?.format === "arauna-real-atlas-v2" &&
        typeof parsed.primary === "string" &&
        typeof parsed.secondary === "string" &&
        typeof parsed.rgbaBase64 === "string" &&
        Array.isArray(parsed.records) &&
        Number.isInteger(parsed.columns) &&
        parsed.columns > 0 &&
        parsed.tileSize === METATILE_SIZE &&
        Number.isInteger(parsed.width) &&
        Number.isInteger(parsed.height) &&
        expectedBytes > 0;
      if (!valid) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const bytes = base64ToBytes(parsed.rgbaBase64);
      if (bytes.length !== expectedBytes) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.atlas = parsed;
      this.emit();
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  ensureHydrated = (): SavedRealAtlas | null => {
    this.hydrate();
    return this.atlas;
  };

  savePair = (
    pair: RenderTilesetPair,
    columns = 16,
    metadata: SaveAtlasMetadata = {},
  ): SavedRealAtlas => {
    if (typeof window === "undefined") throw new Error("O atlas real só pode ser salvo no navegador.");
    const canvas = renderAtlasCanvas(pair, columns);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D indisponível para salvar o atlas real.");
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const records = atlasRecords(pair).map((record, slot) => ({ ...record, slot }));
    const atlas: SavedRealAtlas = {
      format: "arauna-real-atlas-v2",
      primary: metadata.primary ?? "gTileset_General",
      secondary: metadata.secondary ?? "gTileset_Petalburg",
      ...(metadata.origin ? { origin: metadata.origin } : {}),
      ...(metadata.game ? { game: metadata.game } : {}),
      columns,
      tileSize: METATILE_SIZE,
      width: canvas.width,
      height: canvas.height,
      createdAt: new Date().toISOString(),
      rgbaBase64: bytesToBase64(rgba),
      records,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atlas));
    localStorage.removeItem(LEGACY_KEY);
    this.atlas = atlas;
    this.hydrated = true;
    this.canvasCache = { createdAt: atlas.createdAt, canvas };
    this.rowCache = null;
    this.recordCache = null;
    this.emit();
    return atlas;
  };

  clear = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    }
    this.atlas = null;
    this.hydrated = true;
    this.canvasCache = null;
    this.rowCache = null;
    this.recordCache = null;
    this.emit();
  };

  recordFor = (id: number, atlas = this.ensureHydrated()): SavedAtlasRecord | undefined => {
    if (!atlas) return undefined;
    if (this.recordCache?.createdAt !== atlas.createdAt) {
      this.recordCache = {
        createdAt: atlas.createdAt,
        map: new Map(atlas.records.map((record) => [record.id, record])),
      };
    }
    return this.recordCache.map.get(id);
  };

  getCanvas = (atlas = this.ensureHydrated()): HTMLCanvasElement | null => {
    if (!atlas || typeof document === "undefined") return null;
    if (this.canvasCache?.createdAt === atlas.createdAt) return this.canvasCache.canvas;
    const bytes = base64ToBytes(atlas.rgbaBase64);
    if (bytes.length !== atlas.width * atlas.height * 4) return null;
    const canvas = document.createElement("canvas");
    canvas.width = atlas.width;
    canvas.height = atlas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const pixels = new Uint8ClampedArray(bytes.length);
    pixels.set(bytes);
    ctx.putImageData(new ImageData(pixels, atlas.width, atlas.height), 0, 0);
    this.canvasCache = { createdAt: atlas.createdAt, canvas };
    return canvas;
  };

  /** Compatibilidade com o MapCanvas: atlas de uma única linha, 16 px por slot. */
  getSingleRowCanvas = (atlas = this.ensureHydrated()): HTMLCanvasElement | null => {
    if (!atlas || typeof document === "undefined") return null;
    if (this.rowCache?.createdAt === atlas.createdAt) return this.rowCache.canvas;
    const source = this.getCanvas(atlas);
    if (!source) return null;
    const canvas = document.createElement("canvas");
    canvas.width = atlas.records.length * atlas.tileSize;
    canvas.height = atlas.tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    for (const record of atlas.records) {
      const rect = atlasSourceRect(atlas, record);
      ctx.drawImage(
        source,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        record.slot * atlas.tileSize,
        0,
        atlas.tileSize,
        atlas.tileSize,
      );
    }
    this.rowCache = { createdAt: atlas.createdAt, canvas };
    return canvas;
  };
}

export const realAtlasStore = new RealAtlasStore();

export function useRealAtlas(): SavedRealAtlas | null {
  const atlas = useSyncExternalStore(
    realAtlasStore.subscribe,
    realAtlasStore.getSnapshot,
    realAtlasStore.getServerSnapshot,
  );
  useEffect(() => realAtlasStore.hydrate(), []);
  return atlas;
}

export function atlasSourceRect(atlas: SavedRealAtlas, record: SavedAtlasRecord) {
  const x = (record.slot % atlas.columns) * atlas.tileSize;
  const y = Math.floor(record.slot / atlas.columns) * atlas.tileSize;
  return { x, y, w: atlas.tileSize, h: atlas.tileSize };
}
