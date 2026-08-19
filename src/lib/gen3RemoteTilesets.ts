import {
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_METATILE,
  decodeIndexedTilesPng,
  decodeTileEntry,
  parseJascPalette,
  parseMetatilesBin,
  type MetatileSet,
  type RgbColor,
  type TileSheetData,
} from "./emeraldTileset";

export type Gen3SourceId = "emerald" | "ruby-sapphire" | "firered-leafgreen";

export interface Gen3Profile {
  id: Gen3SourceId;
  label: string;
  primaryTileLimit: number;
  primaryMetatileLimit: number;
  primaryPaletteCount: number;
  totalPaletteCount: number;
  attributeBytes: 2 | 4;
}

export interface Gen3Source {
  id: Gen3SourceId;
  label: string;
  owner: string;
  repo: string;
  ref: string;
  profile: Gen3Profile;
}

export interface Gen3MetatileAttribute {
  raw: number;
  behavior: number;
  layerType: number;
}

export interface Gen3RemotePair {
  source: Gen3Source;
  primaryDir: string;
  secondaryDir: string;
  primarySymbol: string;
  secondarySymbol: string;
  primaryTiles: TileSheetData;
  secondaryTiles: TileSheetData;
  primaryMetatiles: MetatileSet;
  secondaryMetatiles: MetatileSet;
  primaryAttributes: Gen3MetatileAttribute[];
  secondaryAttributes: Gen3MetatileAttribute[];
  palettes: Array<RgbColor[] | undefined>;
}

export interface Gen3TilesetPairRef {
  primarySymbol: string;
  secondarySymbol: string;
  primaryDir: string;
  secondaryDir: string;
  usageCount: number;
}

export const GEN3_PROFILES: Record<Gen3SourceId, Gen3Profile> = {
  emerald: {
    id: "emerald",
    label: "Pokémon Emerald",
    primaryTileLimit: 512,
    primaryMetatileLimit: 512,
    primaryPaletteCount: 6,
    totalPaletteCount: 13,
    attributeBytes: 2,
  },
  "ruby-sapphire": {
    id: "ruby-sapphire",
    label: "Pokémon Ruby / Sapphire",
    primaryTileLimit: 512,
    primaryMetatileLimit: 512,
    primaryPaletteCount: 6,
    totalPaletteCount: 12,
    attributeBytes: 2,
  },
  "firered-leafgreen": {
    id: "firered-leafgreen",
    label: "Pokémon FireRed / LeafGreen",
    primaryTileLimit: 640,
    primaryMetatileLimit: 640,
    primaryPaletteCount: 7,
    totalPaletteCount: 13,
    attributeBytes: 4,
  },
};

export const GEN3_SOURCES: Gen3Source[] = [
  { id: "emerald", label: "Emerald", owner: "pret", repo: "pokeemerald", ref: "master", profile: GEN3_PROFILES.emerald },
  { id: "ruby-sapphire", label: "Ruby / Sapphire", owner: "pret", repo: "pokeruby", ref: "master", profile: GEN3_PROFILES["ruby-sapphire"] },
  { id: "firered-leafgreen", label: "FireRed / LeafGreen", owner: "pret", repo: "pokefirered", ref: "master", profile: GEN3_PROFILES["firered-leafgreen"] },
];

function rawRoot(source: Gen3Source) {
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.ref}`;
}

function apiRoot(source: Gen3Source) {
  return `https://api.github.com/repos/${source.owner}/${source.repo}/contents`;
}

async function fetchRequired(url: string): Promise<Response> {
  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

function normalizeTilesetKey(value: string) {
  return value.replace(/^gTileset_/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function directoryNames(source: Gen3Source, side: "primary" | "secondary"): Promise<string[]> {
  const response = await fetchRequired(`${apiRoot(source)}/data/tilesets/${side}?ref=${encodeURIComponent(source.ref)}`);
  const entries = await response.json() as Array<{ name?: string; type?: string }>;
  return entries.filter((entry) => entry.type === "dir" && entry.name).map((entry) => entry.name!).sort();
}

export async function discoverGen3Pairs(source: Gen3Source): Promise<Gen3TilesetPairRef[]> {
  const [primaryDirs, secondaryDirs, layoutsResponse] = await Promise.all([
    directoryNames(source, "primary"),
    directoryNames(source, "secondary"),
    fetchRequired(`${rawRoot(source)}/data/layouts/layouts.json`),
  ]);
  const layoutsJson = await layoutsResponse.json() as { layouts?: Array<Record<string, unknown>> };
  const primaryByKey = new Map(primaryDirs.map((dir) => [normalizeTilesetKey(dir), dir]));
  const secondaryByKey = new Map(secondaryDirs.map((dir) => [normalizeTilesetKey(dir), dir]));
  const pairs = new Map<string, Gen3TilesetPairRef>();

  for (const layout of layoutsJson.layouts ?? []) {
    const primarySymbol = typeof layout.primary_tileset === "string" ? layout.primary_tileset : "";
    const secondarySymbol = typeof layout.secondary_tileset === "string" ? layout.secondary_tileset : "";
    if (!primarySymbol || !secondarySymbol) continue;
    const primaryDir = primaryByKey.get(normalizeTilesetKey(primarySymbol));
    const secondaryDir = secondaryByKey.get(normalizeTilesetKey(secondarySymbol));
    if (!primaryDir || !secondaryDir) continue;
    const key = `${primaryDir}|${secondaryDir}`;
    const current = pairs.get(key);
    if (current) current.usageCount++;
    else pairs.set(key, { primarySymbol, secondarySymbol, primaryDir, secondaryDir, usageCount: 1 });
  }

  if (!pairs.size) {
    // Fallback útil para repos antigos/variantes: combina os diretórios sem
    // fingir que sabemos quais mapas usam cada par.
    for (const primaryDir of primaryDirs) {
      for (const secondaryDir of secondaryDirs) {
        pairs.set(`${primaryDir}|${secondaryDir}`, {
          primarySymbol: `gTileset_${primaryDir}`,
          secondarySymbol: `gTileset_${secondaryDir}`,
          primaryDir,
          secondaryDir,
          usageCount: 0,
        });
      }
    }
  }

  return [...pairs.values()].sort((a, b) => b.usageCount - a.usageCount || a.secondaryDir.localeCompare(b.secondaryDir));
}

function parseAttributes(buffer: ArrayBuffer, profile: Gen3Profile): Gen3MetatileAttribute[] {
  if (buffer.byteLength % profile.attributeBytes !== 0) {
    throw new Error(`metatile_attributes.bin inválido para ${profile.label}: ${buffer.byteLength} bytes.`);
  }
  const view = new DataView(buffer);
  const out: Gen3MetatileAttribute[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += profile.attributeBytes) {
    if (profile.attributeBytes === 2) {
      const raw = view.getUint16(offset, true);
      out.push({ raw, behavior: raw & 0xff, layerType: (raw >>> 12) & 0x0f });
    } else {
      const raw = view.getUint32(offset, true);
      // FRLG: behavior occupies bits 0-8; layer type bits 29-30.
      out.push({ raw, behavior: raw & 0x1ff, layerType: (raw >>> 29) & 0x03 });
    }
  }
  return out;
}

async function loadPalettes(source: Gen3Source, root: string, indexes: number[]): Promise<Map<number, RgbColor[]>> {
  const result = new Map<number, RgbColor[]>();
  await Promise.all(indexes.map(async (index) => {
    const file = `${String(index).padStart(2, "0")}.pal`;
    const response = await fetchRequired(`${rawRoot(source)}/${root}/palettes/${file}`);
    result.set(index, parseJascPalette(await response.text()));
  }));
  return result;
}

export async function loadGen3RemotePair(source: Gen3Source, ref: Gen3TilesetPairRef): Promise<Gen3RemotePair> {
  const primaryRoot = `data/tilesets/primary/${ref.primaryDir}`;
  const secondaryRoot = `data/tilesets/secondary/${ref.secondaryDir}`;
  const profile = source.profile;
  const primaryPaletteIds = Array.from({ length: profile.primaryPaletteCount }, (_, index) => index);
  const secondaryPaletteIds = Array.from(
    { length: profile.totalPaletteCount - profile.primaryPaletteCount },
    (_, index) => profile.primaryPaletteCount + index,
  );

  const [
    primaryTilesBlob,
    secondaryTilesBlob,
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    primaryPalettes,
    secondaryPalettes,
  ] = await Promise.all([
    fetchRequired(`${rawRoot(source)}/${primaryRoot}/tiles.png`).then((response) => response.blob()),
    fetchRequired(`${rawRoot(source)}/${secondaryRoot}/tiles.png`).then((response) => response.blob()),
    fetchRequired(`${rawRoot(source)}/${primaryRoot}/metatiles.bin`).then((response) => response.arrayBuffer()).then(parseMetatilesBin),
    fetchRequired(`${rawRoot(source)}/${secondaryRoot}/metatiles.bin`).then((response) => response.arrayBuffer()).then(parseMetatilesBin),
    fetchRequired(`${rawRoot(source)}/${primaryRoot}/metatile_attributes.bin`).then((response) => response.arrayBuffer()).then((buffer) => parseAttributes(buffer, profile)),
    fetchRequired(`${rawRoot(source)}/${secondaryRoot}/metatile_attributes.bin`).then((response) => response.arrayBuffer()).then((buffer) => parseAttributes(buffer, profile)),
    loadPalettes(source, primaryRoot, primaryPaletteIds),
    loadPalettes(source, secondaryRoot, secondaryPaletteIds),
  ]);

  const palettes: Array<RgbColor[] | undefined> = Array(profile.totalPaletteCount).fill(undefined);
  for (const [id, colors] of primaryPalettes) palettes[id] = colors;
  for (const [id, colors] of secondaryPalettes) palettes[id] = colors;

  return {
    source,
    primaryDir: ref.primaryDir,
    secondaryDir: ref.secondaryDir,
    primarySymbol: ref.primarySymbol,
    secondarySymbol: ref.secondarySymbol,
    primaryTiles: await decodeIndexedTilesPng(primaryTilesBlob),
    secondaryTiles: await decodeIndexedTilesPng(secondaryTilesBlob),
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    palettes,
  };
}

function tilePixel(sheet: TileSheetData, localTileId: number, x: number, y: number) {
  if (localTileId < 0 || localTileId >= sheet.tileCount) return null;
  const tileX = (localTileId % sheet.tilesPerRow) * TILE_SIZE;
  const tileY = Math.floor(localTileId / sheet.tilesPerRow) * TILE_SIZE;
  return sheet.pixels[(tileY + y) * sheet.width + tileX + x] ?? null;
}

function resolveTile(pair: Gen3RemotePair, tileId: number) {
  const limit = pair.source.profile.primaryTileLimit;
  if (tileId < limit) return tileId < pair.primaryTiles.tileCount ? { sheet: pair.primaryTiles, localId: tileId } : null;
  const localId = tileId - limit;
  return localId < pair.secondaryTiles.tileCount ? { sheet: pair.secondaryTiles, localId } : null;
}

function draw8x8(image: ImageData, pair: Gen3RemotePair, entryRaw: number, destX: number, destY: number) {
  const entry = decodeTileEntry(entryRaw);
  const resolved = resolveTile(pair, entry.tileId);
  const palette = pair.palettes[entry.palette];
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const sx = entry.hFlip ? TILE_SIZE - 1 - px : px;
      const sy = entry.vFlip ? TILE_SIZE - 1 - py : py;
      const paletteIndex = resolved ? tilePixel(resolved.sheet, resolved.localId, sx, sy) : null;
      if (paletteIndex === 0) continue;
      const out = ((destY + py) * METATILE_SIZE + destX + px) * 4;
      if (paletteIndex === null || !palette?.[paletteIndex]) {
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

export function remoteMetatileCount(pair: Gen3RemotePair) {
  return pair.primaryMetatiles.count + pair.secondaryMetatiles.count;
}

export function renderGen3RemoteMetatile(pair: Gen3RemotePair, metatileId: number): ImageData {
  const limit = pair.source.profile.primaryMetatileLimit;
  const primary = metatileId < limit;
  const localId = primary ? metatileId : metatileId - limit;
  const set = primary ? pair.primaryMetatiles : pair.secondaryMetatiles;
  if (localId < 0 || localId >= set.count) throw new Error(`Metatile ${metatileId} não existe em ${pair.source.label}.`);
  const image = new ImageData(METATILE_SIZE, METATILE_SIZE);
  const base = localId * TILES_PER_METATILE;
  const positions: Array<[number, number]> = [[0, 0], [8, 0], [0, 8], [8, 8]];
  for (let layer = 0; layer < 2; layer++) {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const [x, y] = positions[quadrant]!;
      draw8x8(image, pair, set.entries[base + layer * 4 + quadrant] ?? 0, x, y);
    }
  }
  return image;
}

export function remoteMetatileAttribute(pair: Gen3RemotePair, metatileId: number): Gen3MetatileAttribute | undefined {
  const limit = pair.source.profile.primaryMetatileLimit;
  return metatileId < limit
    ? pair.primaryAttributes[metatileId]
    : pair.secondaryAttributes[metatileId - limit];
}

export function remoteMetatileIds(pair: Gen3RemotePair): number[] {
  const limit = pair.source.profile.primaryMetatileLimit;
  return [
    ...Array.from({ length: pair.primaryMetatiles.count }, (_, id) => id),
    ...Array.from({ length: pair.secondaryMetatiles.count }, (_, localId) => limit + localId),
  ];
}