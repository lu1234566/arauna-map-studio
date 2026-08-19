import { useSyncExternalStore } from "react";
import {
  decodeIndexedTilesPng,
  parseJascPalette,
  parseMetatilesBin,
  type MetatileSet,
  type RgbColor,
  type TileSheetData,
} from "./emeraldTileset";
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
  primaryCount?: number;
  secondaryCount?: number;
  tileSize: 16;
  columns: 16;
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

interface FamilySource {
  id: GbaFamilyId;
  label: string;
  repo: string;
  native: boolean;
  primaryTileLimit: number;
  primaryMetatileLimit: number;
  primaryPaletteCount: number;
  totalPaletteCount: number;
  attributeBytes: 2 | 4;
}

interface LayoutRecord {
  id?: string;
  name?: string;
  primary_tileset?: string;
  secondary_tileset?: string;
}

interface LayoutsDocument {
  layouts?: LayoutRecord[];
}

interface GithubContentEntry {
  name?: string;
  type?: string;
}

interface FamilyProfile {
  primaryTileLimit: number;
  primaryMetatileLimit: number;
  primaryPaletteCount: number;
  totalPaletteCount: number;
  attributeBytes: 2 | 4;
}

const SOURCES: FamilySource[] = [
  {
    id: "emerald",
    label: "Pokémon Emerald",
    repo: "pret/pokeemerald",
    native: true,
    primaryTileLimit: 512,
    primaryMetatileLimit: 512,
    primaryPaletteCount: 6,
    totalPaletteCount: 13,
    attributeBytes: 2,
  },
  {
    id: "ruby-sapphire",
    label: "Pokémon Ruby / Sapphire",
    repo: "pret/pokeruby",
    native: false,
    primaryTileLimit: 512,
    primaryMetatileLimit: 512,
    primaryPaletteCount: 6,
    totalPaletteCount: 12,
    attributeBytes: 2,
  },
  {
    id: "firered-leafgreen",
    label: "Pokémon FireRed / LeafGreen",
    repo: "pret/pokefirered",
    native: false,
    primaryTileLimit: 640,
    primaryMetatileLimit: 640,
    primaryPaletteCount: 7,
    totalPaletteCount: 13,
    attributeBytes: 4,
  },
];

const TILE_SIZE = 8;
const METATILE_SIZE = 16;
const TILES_PER_METATILE = 8;

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

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function symbolKey(symbol: string) {
  return normalized(symbol.replace(/^gTileset_/, ""));
}

function symbolDirectoryFallback(symbol: string) {
  return symbol
    .replace(/^gTileset_/, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/__+/g, "_")
    .toLowerCase();
}

function rawUrl(repo: string, revision: string, path: string) {
  return `https://raw.githubusercontent.com/${repo}/${revision}/${path}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`${response.status} ao carregar ${url}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ao carregar ${url}`);
  return response.text();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ao carregar ${url}`);
  return response.arrayBuffer();
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ao carregar ${url}`);
  return response.blob();
}

async function sourceRevision(repo: string): Promise<string> {
  try {
    const commit = await fetchJson<{ sha?: string }>(`https://api.github.com/repos/${repo}/commits/master`);
    return commit.sha || "master";
  } catch {
    return "master";
  }
}

async function directoryIndex(repo: string, revision: string, kind: "primary" | "secondary") {
  const index = new Map<string, string>();
  try {
    const entries = await fetchJson<GithubContentEntry[]>(
      `https://api.github.com/repos/${repo}/contents/data/tilesets/${kind}?ref=${revision}`,
    );
    for (const entry of entries) {
      if (entry.type === "dir" && entry.name) index.set(normalized(entry.name), entry.name);
    }
  } catch {
    // Se a API de metadados estiver temporariamente indisponível, ainda
    // tentamos a convenção de nomes do próprio decomp ao ativar o pack.
  }
  return index;
}

async function catalogForFamily(source: FamilySource) {
  const revision = await sourceRevision(source.repo);
  const [layouts, primaryDirectories, secondaryDirectories] = await Promise.all([
    fetchJson<LayoutsDocument>(rawUrl(source.repo, revision, "data/layouts/layouts.json")),
    directoryIndex(source.repo, revision, "primary"),
    directoryIndex(source.repo, revision, "secondary"),
  ]);
  const byPair = new Map<string, { primary: string; secondary: string; maps: string[] }>();

  for (const layout of layouts.layouts ?? []) {
    const primary = layout.primary_tileset;
    const secondary = layout.secondary_tileset;
    if (!primary || !secondary || primary === "NULL" || secondary === "NULL") continue;
    const key = `${primary}|${secondary}`;
    const existing = byPair.get(key) ?? { primary, secondary, maps: [] };
    const mapName = layout.name || layout.id;
    if (mapName) existing.maps.push(mapName);
    byPair.set(key, existing);
  }

  const family: GbaCatalogFamily = {
    id: source.id,
    label: source.label,
    sourceRepo: source.repo,
    revision,
    native: source.native,
    primaryTileLimit: source.primaryTileLimit,
    primaryMetatileLimit: source.primaryMetatileLimit,
    primaryPaletteCount: source.primaryPaletteCount,
    totalPaletteCount: source.totalPaletteCount,
  };

  const packs: GbaCatalogPack[] = [...byPair.values()].map((pair) => {
    const primaryResolved = primaryDirectories.get(symbolKey(pair.primary));
    const secondaryResolved = secondaryDirectories.get(symbolKey(pair.secondary));
    const primaryDirectory = primaryResolved ?? symbolDirectoryFallback(pair.primary);
    const secondaryDirectory = secondaryResolved ?? symbolDirectoryFallback(pair.secondary);
    const warnings: string[] = [];
    if (!primaryResolved && primaryDirectories.size) warnings.push(`Diretório primary de ${pair.primary} não foi confirmado pelo índice do repo.`);
    if (!secondaryResolved && secondaryDirectories.size) warnings.push(`Diretório secondary de ${pair.secondary} não foi confirmado pelo índice do repo.`);
    return {
      id: `${source.id}:${primaryDirectory}:${secondaryDirectory}`,
      family: source.id,
      familyLabel: source.label,
      native: source.native,
      compatibility: source.native ? "native" : "reference",
      sourceRepo: source.repo,
      sourceRevision: revision,
      primary: pair.primary,
      secondary: pair.secondary,
      primaryDirectory,
      secondaryDirectory,
      primaryTileLimit: source.primaryTileLimit,
      primaryMetatileLimit: source.primaryMetatileLimit,
      primaryPaletteCount: source.primaryPaletteCount,
      totalPaletteCount: source.totalPaletteCount,
      tileSize: 16,
      columns: 16,
      maps: [...new Set(pair.maps)].sort(),
      warnings,
    };
  });

  return { family, packs };
}

export async function loadGbaTilesetCatalog(force = false): Promise<GbaTilesetCatalog> {
  if (!force && state.catalog) return state.catalog;
  if (!force && catalogPromise) return catalogPromise;
  emit({ phase: "loading", error: null });

  catalogPromise = Promise.allSettled(SOURCES.map(catalogForFamily))
    .then((results) => {
      const families: GbaCatalogFamily[] = [];
      const packs: GbaCatalogPack[] = [];
      const unresolvedPairs: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          families.push(result.value.family);
          packs.push(...result.value.packs);
        } else {
          unresolvedPairs.push(`${SOURCES[index]!.label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      });
      if (!families.length) throw new Error("Não foi possível alcançar os repositórios pret para montar a biblioteca GBA.");

      const catalog: GbaTilesetCatalog = {
        format: "arauna-gba-tileset-catalog-v1",
        generatedFrom: "pret Gen III decomps (carregamento direto no navegador)",
        defaultPackId: "emerald:general:petalburg",
        families,
        packs: packs.sort((a, b) => `${a.family}|${a.primary}|${a.secondary}`.localeCompare(`${b.family}|${b.primary}|${b.secondary}`)),
        unresolvedPairs,
      };
      emit({ phase: "ready", catalog, error: unresolvedPairs.length ? unresolvedPairs.join(" · ") : null });
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

function parseAttributes(buffer: ArrayBuffer, profile: FamilyProfile) {
  if (!buffer.byteLength || buffer.byteLength % profile.attributeBytes !== 0) return [] as Array<[number, number]>;
  const view = new DataView(buffer);
  const result: Array<[number, number]> = [];
  for (let offset = 0; offset < buffer.byteLength; offset += profile.attributeBytes) {
    if (profile.attributeBytes === 4) {
      const raw = view.getUint32(offset, true);
      result.push([raw & 0x01ff, (raw >>> 29) & 0x03]);
    } else {
      const raw = view.getUint16(offset, true);
      result.push([raw & 0x00ff, (raw >>> 12) & 0x0f]);
    }
  }
  return result;
}

async function optionalAttributes(url: string, profile: FamilyProfile) {
  try {
    return parseAttributes(await fetchBuffer(url), profile);
  } catch {
    return [] as Array<[number, number]>;
  }
}

async function loadPalettes(pack: GbaCatalogPack) {
  const palettes: Array<RgbColor[] | undefined> = Array(pack.totalPaletteCount).fill(undefined);
  const warnings = [...pack.warnings];
  await Promise.all(
    Array.from({ length: pack.totalPaletteCount }, async (_, index) => {
      const directory = index < pack.primaryPaletteCount ? pack.primaryDirectory : pack.secondaryDirectory;
      const kind = index < pack.primaryPaletteCount ? "primary" : "secondary";
      const path = `data/tilesets/${kind}/${directory}/palettes/${String(index).padStart(2, "0")}.pal`;
      try {
        palettes[index] = parseJascPalette(await fetchText(rawUrl(pack.sourceRepo, pack.sourceRevision, path)));
      } catch {
        warnings.push(`Paleta ${String(index).padStart(2, "0")} ausente em ${kind}/${directory}.`);
      }
    }),
  );
  return { palettes, warnings };
}

function tilePixel(sheet: TileSheetData, localTileId: number, x: number, y: number): number | null {
  if (localTileId < 0 || localTileId >= sheet.tileCount) return null;
  const tileX = (localTileId % sheet.tilesPerRow) * TILE_SIZE;
  const tileY = Math.floor(localTileId / sheet.tilesPerRow) * TILE_SIZE;
  return sheet.pixels[(tileY + y) * sheet.width + tileX + x] ?? null;
}

function draw8x8(
  image: ImageData,
  profile: FamilyProfile,
  primaryTiles: TileSheetData,
  secondaryTiles: TileSheetData,
  palettes: Array<RgbColor[] | undefined>,
  entryRaw: number,
  destX: number,
  destY: number,
) {
  const tileId = entryRaw & 0x03ff;
  const hFlip = Boolean(entryRaw & 0x0400);
  const vFlip = Boolean(entryRaw & 0x0800);
  const paletteId = (entryRaw >>> 12) & 0x0f;
  const primary = tileId < profile.primaryTileLimit;
  const sheet = primary ? primaryTiles : secondaryTiles;
  const localTileId = primary ? tileId : tileId - profile.primaryTileLimit;
  const palette = palettes[paletteId];

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const sx = hFlip ? TILE_SIZE - 1 - px : px;
      const sy = vFlip ? TILE_SIZE - 1 - py : py;
      const paletteIndex = tilePixel(sheet, localTileId, sx, sy);
      if (paletteIndex === 0) continue;
      const out = ((destY + py) * METATILE_SIZE + destX + px) * 4;
      if (paletteIndex == null || !palette?.[paletteIndex]) {
        image.data[out] = 255;
        image.data[out + 1] = 0;
        image.data[out + 2] = 255;
        image.data[out + 3] = 255;
        continue;
      }
      const color = palette[paletteIndex]!;
      image.data[out] = color.r;
      image.data[out + 1] = color.g;
      image.data[out + 2] = color.b;
      image.data[out + 3] = 255;
    }
  }
}

function renderMetatile(
  profile: FamilyProfile,
  primaryTiles: TileSheetData,
  secondaryTiles: TileSheetData,
  palettes: Array<RgbColor[] | undefined>,
  set: MetatileSet,
  localId: number,
) {
  const image = new ImageData(METATILE_SIZE, METATILE_SIZE);
  const base = localId * TILES_PER_METATILE;
  const positions: Array<[number, number]> = [[0, 0], [8, 0], [0, 8], [8, 8]];
  for (let layer = 0; layer < 2; layer++) {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const [x, y] = positions[quadrant]!;
      draw8x8(
        image,
        profile,
        primaryTiles,
        secondaryTiles,
        palettes,
        set.entries[base + layer * 4 + quadrant]!,
        x,
        y,
      );
    }
  }
  return image;
}

function buildRecords(
  pack: GbaCatalogPack,
  primaryMetatiles: MetatileSet,
  secondaryMetatiles: MetatileSet,
  primaryAttributes: Array<[number, number]>,
  secondaryAttributes: Array<[number, number]>,
): SavedAtlasRecord[] {
  const records: SavedAtlasRecord[] = [];
  let slot = 0;
  for (let localId = 0; localId < primaryMetatiles.count; localId++) {
    const attr = primaryAttributes[localId];
    records.push({
      id: localId,
      source: "primary",
      localId,
      behavior: attr?.[0] ?? null,
      layerType: attr?.[1] ?? null,
      slot: slot++,
    });
  }
  for (let localId = 0; localId < secondaryMetatiles.count; localId++) {
    const attr = secondaryAttributes[localId];
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

function renderAtlas(
  pack: GbaCatalogPack,
  profile: FamilyProfile,
  primaryTiles: TileSheetData,
  secondaryTiles: TileSheetData,
  primaryMetatiles: MetatileSet,
  secondaryMetatiles: MetatileSet,
  palettes: Array<RgbColor[] | undefined>,
  records: SavedAtlasRecord[],
) {
  const rows = Math.ceil(records.length / pack.columns);
  const canvas = document.createElement("canvas");
  canvas.width = pack.columns * METATILE_SIZE;
  canvas.height = rows * METATILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível para montar os metatiles GBA.");
  ctx.imageSmoothingEnabled = false;

  for (const record of records) {
    const set = record.source === "primary" ? primaryMetatiles : secondaryMetatiles;
    const image = renderMetatile(profile, primaryTiles, secondaryTiles, palettes, set, record.localId);
    const x = (record.slot % pack.columns) * METATILE_SIZE;
    const y = Math.floor(record.slot / pack.columns) * METATILE_SIZE;
    ctx.putImageData(image, x, y);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function loadPackAssets(pack: GbaCatalogPack) {
  const source = SOURCES.find((candidate) => candidate.id === pack.family);
  if (!source) throw new Error(`Família desconhecida: ${pack.family}`);
  const profile: FamilyProfile = {
    primaryTileLimit: source.primaryTileLimit,
    primaryMetatileLimit: source.primaryMetatileLimit,
    primaryPaletteCount: source.primaryPaletteCount,
    totalPaletteCount: source.totalPaletteCount,
    attributeBytes: source.attributeBytes,
  };
  const primaryBase = `data/tilesets/primary/${pack.primaryDirectory}`;
  const secondaryBase = `data/tilesets/secondary/${pack.secondaryDirectory}`;

  const [primaryTilesBlob, secondaryTilesBlob, primaryMetatilesBuffer, secondaryMetatilesBuffer, primaryAttributes, secondaryAttributes, paletteResult] = await Promise.all([
    fetchBlob(rawUrl(pack.sourceRepo, pack.sourceRevision, `${primaryBase}/tiles.png`)),
    fetchBlob(rawUrl(pack.sourceRepo, pack.sourceRevision, `${secondaryBase}/tiles.png`)),
    fetchBuffer(rawUrl(pack.sourceRepo, pack.sourceRevision, `${primaryBase}/metatiles.bin`)),
    fetchBuffer(rawUrl(pack.sourceRepo, pack.sourceRevision, `${secondaryBase}/metatiles.bin`)),
    optionalAttributes(rawUrl(pack.sourceRepo, pack.sourceRevision, `${primaryBase}/metatile_attributes.bin`), profile),
    optionalAttributes(rawUrl(pack.sourceRepo, pack.sourceRevision, `${secondaryBase}/metatile_attributes.bin`), profile),
    loadPalettes(pack),
  ]);

  const [primaryTiles, secondaryTiles] = await Promise.all([
    decodeIndexedTilesPng(primaryTilesBlob),
    decodeIndexedTilesPng(secondaryTilesBlob),
  ]);
  const primaryMetatiles = parseMetatilesBin(primaryMetatilesBuffer);
  const secondaryMetatiles = parseMetatilesBin(secondaryMetatilesBuffer);
  pack.primaryCount = primaryMetatiles.count;
  pack.secondaryCount = secondaryMetatiles.count;
  pack.warnings = paletteResult.warnings;

  const records = buildRecords(pack, primaryMetatiles, secondaryMetatiles, primaryAttributes, secondaryAttributes);
  const image = renderAtlas(
    pack,
    profile,
    primaryTiles,
    secondaryTiles,
    primaryMetatiles,
    secondaryMetatiles,
    paletteResult.palettes,
    records,
  );
  return { image, records };
}

export async function activateGbaPack(packOrId: GbaCatalogPack | string): Promise<SavedRealAtlas> {
  const catalog = await loadGbaTilesetCatalog();
  const pack = typeof packOrId === "string" ? catalog.packs.find((entry) => entry.id === packOrId) : packOrId;
  if (!pack) throw new Error(`Tileset GBA não encontrado: ${String(packOrId)}`);
  emit({ activatingPackId: pack.id, error: null });
  try {
    const { image, records } = await loadPackAssets(pack);
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
      records,
    });
    emit({ phase: "ready", catalog: { ...catalog, packs: [...catalog.packs] }, activatingPackId: null, error: pack.warnings.length ? pack.warnings.join(" · ") : null });
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
    const defaultPack = catalog.packs.find((pack) => pack.id === catalog.defaultPackId);
    if (!defaultPack) throw new Error("O par Emerald General + Petalburg não foi encontrado no catálogo pret.");
    return await activateGbaPack(defaultPack);
  } catch {
    return null;
  }
}

export function packForActiveAtlas(catalog: GbaTilesetCatalog | null, atlas: SavedRealAtlas | null) {
  if (!catalog || !atlas) return null;
  return catalog.packs.find((pack) => pack.id === atlas.packId) ?? null;
}
