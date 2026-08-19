import { useSyncExternalStore } from "react";
import { realAtlasStore, type SavedAtlasRecord, type SavedRealAtlas } from "./realAtlasStore";

export type GbaFamilyId = "emerald" | "ruby-sapphire" | "firered-leafgreen";

export interface GbaCatalogFamily {
  id: GbaFamilyId;
  label: string;
  sourceRepo: string;
  revision: string;
  native: boolean;
  primaryTileLimit: number;
  primaryMetatileLimit: number;
  primaryPaletteCount: number;
  totalPaletteCount: number;
}

export interface GbaCatalogPack {
  id: string;
  family: GbaFamilyId;
  familyLabel: string;
  native: boolean;
  compatibility: "native" | "reference";
  sourceRepo: string;
  sourceRevision: string;
  primary: string;
  secondary: string;
  primaryDirectory: string;
  secondaryDirectory: string;
  primaryTileLimit: number;
  primaryMetatileLimit: number;
  primaryPaletteCount: number;
  totalPaletteCount: number;
  primaryCount: number;
  secondaryCount: number;
  tileSize: number;
  columns: number;
  width: number;
  height: number;
  atlasUrl: string;
  primaryAttributes: Array<[number, number] | null>;
  secondaryAttributes: Array<[number, number] | null>;
  maps: string[];
  warnings: string[];
}

export interface GbaTilesetCatalog {
  format: "arauna-gba-tileset-catalog-v1";
  generatedFrom: string;
  defaultPackId: string;
  families: GbaCatalogFamily[];
  packs: GbaCatalogPack[];
  unresolvedPairs: string[];
}

type LibraryPhase = "idle" | "loading" | "ready" | "error";
export interface GbaLibraryState {
  phase: LibraryPhase;
  catalog: GbaTilesetCatalog | null;
  activatingPackId: string | null;
  error: string | null;
}

let state: GbaLibraryState = { phase: "idle", catalog: null, activatingPackId: null, error: null };
let catalogPromise: Promise<GbaTilesetCatalog> | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<GbaLibraryState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot(): GbaLibraryState {
  return { phase: "idle", catalog: null, activatingPackId: null, error: null };
}

export function useGbaTilesetLibrary() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function validateCatalog(value: unknown): GbaTilesetCatalog {
  const catalog = value as Partial<GbaTilesetCatalog>;
  if (
    catalog?.format !== "arauna-gba-tileset-catalog-v1" ||
    typeof catalog.defaultPackId !== "string" ||
    !Array.isArray(catalog.families) ||
    !Array.isArray(catalog.packs)
  ) {
    throw new Error("Catálogo GBA inválido ou ainda não gerado.");
  }
  return catalog as GbaTilesetCatalog;
}

export async function loadGbaTilesetCatalog(force = false): Promise<GbaTilesetCatalog> {
  if (!force && state.catalog) return state.catalog;
  if (!force && catalogPromise) return catalogPromise;
  emit({ phase: "loading", error: null });
  catalogPromise = fetch("/gba/catalog.json", { cache: force ? "reload" : "default" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Catálogo GBA indisponível (${response.status}).`);
      return validateCatalog(await response.json());
    })
    .then((catalog) => {
      emit({ phase: "ready", catalog, error: null });
      return catalog;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      emit({ phase: "error", error: message });
      throw error;
    })
    .finally(() => {
      catalogPromise = null;
    });
  return catalogPromise;
}

export function recordsForPack(pack: GbaCatalogPack): SavedAtlasRecord[] {
  const records: SavedAtlasRecord[] = [];
  let slot = 0;
  for (let localId = 0; localId < pack.primaryCount; localId++) {
    const attr = pack.primaryAttributes?.[localId] ?? null;
    records.push({
      id: localId,
      source: "primary",
      localId,
      behavior: attr?.[0] ?? null,
      layerType: attr?.[1] ?? null,
      slot: slot++,
    });
  }
  for (let localId = 0; localId < pack.secondaryCount; localId++) {
    const attr = pack.secondaryAttributes?.[localId] ?? null;
    records.push({
      id: pack.primaryMetatileLimit + localId,
      source: "secondary",
      localId,
      behavior: attr?.[0] ?? null,
      layerType: attr?.[1] ?? null,
      slot: slot++,
    });
  }
  return records;
}

async function loadAtlasImageData(pack: GbaCatalogPack): Promise<ImageData> {
  const response = await fetch(pack.atlasUrl);
  if (!response.ok) throw new Error(`Atlas ${pack.primary} + ${pack.secondary} indisponível (${response.status}).`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width !== pack.width || bitmap.height !== pack.height) {
      throw new Error(`Atlas ${pack.id} tem dimensões inesperadas: ${bitmap.width}×${bitmap.height}.`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D indisponível para carregar o atlas GBA.");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
}

export async function activateGbaPack(packOrId: GbaCatalogPack | string): Promise<SavedRealAtlas> {
  const catalog = await loadGbaTilesetCatalog();
  const pack = typeof packOrId === "string" ? catalog.packs.find((entry) => entry.id === packOrId) : packOrId;
  if (!pack) throw new Error(`Tileset GBA não encontrado: ${String(packOrId)}`);
  emit({ activatingPackId: pack.id, error: null });
  try {
    const image = await loadAtlasImageData(pack);
    const atlas = realAtlasStore.activate({
      packId: pack.id,
      family: pack.family,
      familyLabel: pack.familyLabel,
      compatibility: pack.compatibility,
      sourceRepo: pack.sourceRepo,
      sourceRevision: pack.sourceRevision,
      primary: pack.primary,
      secondary: pack.secondary,
      primaryMetatileLimit: pack.primaryMetatileLimit,
      columns: pack.columns,
      tileSize: pack.tileSize,
      image,
      records: recordsForPack(pack),
    });
    emit({ phase: "ready", activatingPackId: null, error: null });
    window.dispatchEvent(new Event("resize"));
    return atlas;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({ activatingPackId: null, error: message });
    throw error;
  }
}

export async function ensureDefaultGbaAtlas(): Promise<SavedRealAtlas | null> {
  const current = realAtlasStore.ensureHydrated();
  if (current) return current;
  try {
    const catalog = await loadGbaTilesetCatalog();
    return await activateGbaPack(catalog.defaultPackId);
  } catch {
    return null;
  }
}

export function packForActiveAtlas(catalog: GbaTilesetCatalog | null, atlas: SavedRealAtlas | null) {
  if (!catalog || !atlas) return null;
  return catalog.packs.find((pack) => pack.id === atlas.packId) ?? null;
}
