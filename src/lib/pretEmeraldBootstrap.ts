import {
  combineOverworldPalettes,
  decodeIndexedTilesPng,
  parseJascPalette,
  parseMetatileAttributes,
  parseMetatilesBin,
  type RenderTilesetPair,
  type RgbColor,
} from "./emeraldTileset";
import { realAtlasStore, type SavedRealAtlas } from "./realAtlasStore";

const RAW_ROOT = "https://raw.githubusercontent.com/pret/pokeemerald/master";
const PRIMARY_ROOT = "data/tilesets/primary/general";
const SECONDARY_ROOT = "data/tilesets/secondary/petalburg";

let bootstrapPromise: Promise<SavedRealAtlas> | null = null;

async function required(path: string): Promise<Response> {
  const response = await fetch(`${RAW_ROOT}/${path}`, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${response.status}.`);
  return response;
}

async function paletteSet(root: string, indexes: number[]): Promise<Map<number, RgbColor[]>> {
  const entries = await Promise.all(indexes.map(async (index) => {
    const name = `${String(index).padStart(2, "0")}.pal`;
    const source = await (await required(`${root}/palettes/${name}`)).text();
    return [index, parseJascPalette(source)] as const;
  }));
  return new Map(entries);
}

async function buildPretEmeraldGeneralPetalburg(): Promise<RenderTilesetPair> {
  const [
    primaryTilesBlob,
    secondaryTilesBlob,
    primaryMetatilesBuffer,
    secondaryMetatilesBuffer,
    primaryAttributesBuffer,
    secondaryAttributesBuffer,
    primaryPalettes,
    secondaryPalettes,
  ] = await Promise.all([
    required(`${PRIMARY_ROOT}/tiles.png`).then((response) => response.blob()),
    required(`${SECONDARY_ROOT}/tiles.png`).then((response) => response.blob()),
    required(`${PRIMARY_ROOT}/metatiles.bin`).then((response) => response.arrayBuffer()),
    required(`${SECONDARY_ROOT}/metatiles.bin`).then((response) => response.arrayBuffer()),
    required(`${PRIMARY_ROOT}/metatile_attributes.bin`).then((response) => response.arrayBuffer()),
    required(`${SECONDARY_ROOT}/metatile_attributes.bin`).then((response) => response.arrayBuffer()),
    paletteSet(PRIMARY_ROOT, [0, 1, 2, 3, 4, 5]),
    paletteSet(SECONDARY_ROOT, [6, 7, 8, 9, 10, 11, 12]),
  ]);

  return {
    primaryTiles: await decodeIndexedTilesPng(primaryTilesBlob),
    secondaryTiles: await decodeIndexedTilesPng(secondaryTilesBlob),
    primaryMetatiles: parseMetatilesBin(primaryMetatilesBuffer),
    secondaryMetatiles: parseMetatilesBin(secondaryMetatilesBuffer),
    primaryAttributes: parseMetatileAttributes(primaryAttributesBuffer),
    secondaryAttributes: parseMetatileAttributes(secondaryAttributesBuffer),
    palettes: combineOverworldPalettes(primaryPalettes, secondaryPalettes),
  };
}

/**
 * Fresh Lovable/browser previews now receive real Emerald metatiles immediately.
 * Nothing is bundled or redrawn: the browser reads the canonical pokeemerald
 * decomp artifacts and reconstructs the same 16×16 metatiles used by the game.
 * A local Arauna Workspace always wins if it already installed an atlas.
 */
export async function ensureAuthenticEmeraldPreviewAtlas(): Promise<SavedRealAtlas> {
  const existing = realAtlasStore.ensureHydrated();
  if (existing) return existing;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = buildPretEmeraldGeneralPetalburg()
    .then((pair) => realAtlasStore.savePair(pair, 16))
    .catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  return bootstrapPromise;
}
