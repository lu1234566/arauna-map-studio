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
const DEFAULT_SECONDARY = "gTileset_Petalburg";
const bootstrapPromises = new Map<string, Promise<SavedRealAtlas>>();

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

export function normalizeEmeraldSecondary(value: string) {
  const stripped = value.trim().replace(/^gTileset_/i, "");
  if (!stripped) throw new Error("Tileset secondary vazio.");
  const directory = stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const symbol = value.trim().startsWith("gTileset_")
    ? value.trim()
    : `gTileset_${stripped}`;
  return { directory, symbol };
}

async function buildPretEmeraldPair(secondaryDirectory: string): Promise<RenderTilesetPair> {
  const secondaryRoot = `data/tilesets/secondary/${secondaryDirectory}`;
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
    required(`${secondaryRoot}/tiles.png`).then((response) => response.blob()),
    required(`${PRIMARY_ROOT}/metatiles.bin`).then((response) => response.arrayBuffer()),
    required(`${secondaryRoot}/metatiles.bin`).then((response) => response.arrayBuffer()),
    required(`${PRIMARY_ROOT}/metatile_attributes.bin`).then((response) => response.arrayBuffer()),
    required(`${secondaryRoot}/metatile_attributes.bin`).then((response) => response.arrayBuffer()),
    paletteSet(PRIMARY_ROOT, [0, 1, 2, 3, 4, 5]),
    paletteSet(secondaryRoot, [6, 7, 8, 9, 10, 11, 12]),
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
 * Carrega sob demanda um par autêntico General + secondary diretamente do
 * pret/pokeemerald. É usado como fallback para arquivos BIN/JSON avulsos.
 * Workspaces locais continuam sendo a fonte preferencial porque podem conter
 * gráficos modificados do próprio Juramento de Arauna.
 */
export async function ensureAuthenticEmeraldTilesetPair(secondary: string): Promise<SavedRealAtlas> {
  const normalized = normalizeEmeraldSecondary(secondary);
  const existing = realAtlasStore.ensureHydrated();
  if (existing?.primary === "gTileset_General" && existing.secondary.toLowerCase() === normalized.symbol.toLowerCase()) {
    return existing;
  }

  const cached = bootstrapPromises.get(normalized.directory);
  if (cached) return cached;

  const promise = buildPretEmeraldPair(normalized.directory)
    .then((pair) => realAtlasStore.savePair(pair, 16, {
      primary: "gTileset_General",
      secondary: normalized.symbol,
      origin: "pret/pokeemerald@master",
      game: "Pokémon Emerald",
    }))
    .catch((error) => {
      bootstrapPromises.delete(normalized.directory);
      throw error;
    });
  bootstrapPromises.set(normalized.directory, promise);
  return promise;
}

/**
 * Fresh Lovable/browser previews receive real Emerald metatiles immediately.
 * Nothing is procedurally imitated: the browser reads the canonical pokeemerald
 * artifacts and reconstructs the same 16×16 metatiles used by the game.
 * A local Arauna Workspace always wins if it already installed an atlas.
 */
export async function ensureAuthenticEmeraldPreviewAtlas(): Promise<SavedRealAtlas> {
  const existing = realAtlasStore.ensureHydrated();
  if (existing) return existing;
  return ensureAuthenticEmeraldTilesetPair(DEFAULT_SECONDARY);
}
