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

export interface SavedRealAtlas {
  format: "arauna-real-atlas-v1";
  primary: string;
  secondary: string;
  columns: number;
  tileSize: number;
  width: number;
  height: number;
  createdAt: string;
  dataUrl: string;
  records: SavedAtlasRecord[];
}

const STORAGE_KEY = "arauna.realAtlas.v1";

type Listener = () => void;

class RealAtlasStore {
  private atlas: SavedRealAtlas | null = null;
  private hydrated = false;
  private listeners = new Set<Listener>();
  private imageCache: { dataUrl: string; promise: Promise<HTMLImageElement> } | null = null;

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
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedRealAtlas;
      if (
        parsed?.format !== "arauna-real-atlas-v1" ||
        typeof parsed.dataUrl !== "string" ||
        !Array.isArray(parsed.records) ||
        !Number.isInteger(parsed.columns) ||
        parsed.columns <= 0 ||
        parsed.tileSize !== METATILE_SIZE
      ) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.atlas = parsed;
      this.emit();
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  savePair = (pair: RenderTilesetPair, columns = 16): SavedRealAtlas => {
    if (typeof window === "undefined") {
      throw new Error("O atlas real só pode ser salvo no navegador.");
    }
    const canvas = renderAtlasCanvas(pair, columns);
    const records = atlasRecords(pair).map((record, slot) => ({ ...record, slot }));
    const atlas: SavedRealAtlas = {
      format: "arauna-real-atlas-v1",
      primary: "gTileset_General",
      secondary: "gTileset_Petalburg",
      columns,
      tileSize: METATILE_SIZE,
      width: canvas.width,
      height: canvas.height,
      createdAt: new Date().toISOString(),
      dataUrl: canvas.toDataURL("image/png"),
      records,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atlas));
    this.atlas = atlas;
    this.hydrated = true;
    this.imageCache = null;
    this.emit();
    return atlas;
  };

  clear = () => {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    this.atlas = null;
    this.hydrated = true;
    this.imageCache = null;
    this.emit();
  };

  recordFor = (id: number, atlas = this.atlas): SavedAtlasRecord | undefined =>
    atlas?.records.find((record) => record.id === id);

  loadImage = (atlas = this.atlas): Promise<HTMLImageElement> => {
    if (!atlas) return Promise.reject(new Error("Nenhum atlas real carregado."));
    if (this.imageCache?.dataUrl === atlas.dataUrl) return this.imageCache.promise;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Falha ao carregar a imagem do atlas real."));
      image.src = atlas.dataUrl;
    });
    this.imageCache = { dataUrl: atlas.dataUrl, promise };
    return promise;
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
