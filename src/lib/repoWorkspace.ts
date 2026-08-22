import { editorStore } from "./editorStore";
import {
  combineOverworldPalettes,
  decodeIndexedTilesPng,
  parseJascPalette,
  parseMetatileAttributes,
  parseMetatilesBin,
  validateTilesetPair,
  type RenderTilesetPair,
  type RgbColor,
} from "./emeraldTileset";
import { realAtlasStore } from "./realAtlasStore";

export type TilesetSide = "primary" | "secondary";

export interface WorkspaceLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  primary_tileset: string;
  secondary_tileset: string;
  border_filepath: string;
  blockdata_filepath: string;
}

export interface WorkspaceMap {
  path: string;
  directory: string;
  id: string;
  name: string;
  layoutId: string;
  layout?: WorkspaceLayout;
  error?: string;
}

export interface WorkspaceTilesetDirectory {
  side: TilesetSide;
  name: string;
  path: string;
  key: string;
}

export interface AraunaWorkspace {
  files: Map<string, File>;
  filesLower: Map<string, File>;
  layouts: Map<string, WorkspaceLayout>;
  maps: WorkspaceMap[];
  tilesets: WorkspaceTilesetDirectory[];
}

export interface OpenWorkspaceMapResult {
  map: WorkspaceMap;
  layout: WorkspaceLayout;
  primaryDir: WorkspaceTilesetDirectory;
  secondaryDir: WorkspaceTilesetDirectory;
  warnings: string[];
}

export class WorkspaceError extends Error {}

const WORKSPACE_SOURCE_ROOTS = new Set(["data", "include", "src", "asm", "tools"]);

export function normalizeWorkspacePath(input: string): string {
  let path = input.replace(/\\/g, "/").replace(/^\.\//, "");
  while (path.startsWith("/")) path = path.slice(1);

  // webkitRelativePath inclui o nome da pasta escolhida. Para o Studio, os
  // caminhos precisam ser relativos à raiz real do pokeemerald, não à pasta
  // selecionada no Chrome. Antes só `data/` era recortado e headers ficavam
  // como `pokemon-juramento-de-arauna/include/...`, invisíveis à auditoria.
  const parts = path.split("/").filter(Boolean);
  const sourceRootIndex = parts.findIndex((part) => WORKSPACE_SOURCE_ROOTS.has(part.toLowerCase()));
  if (sourceRootIndex >= 0) path = parts.slice(sourceRootIndex).join("/");

  return path.replace(/\/{2,}/g, "/");
}

export function normalizeTilesetKey(value: string): string {
  return value
    .replace(/^gTileset_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function parseLayoutsSource(source: string): WorkspaceLayout[] {
  const parsed = JSON.parse(source) as { layouts?: unknown };
  if (!Array.isArray(parsed.layouts)) {
    throw new WorkspaceError("data/layouts/layouts.json não contém uma lista 'layouts'.");
  }

  return parsed.layouts.map((item, index) => {
    const raw = item as Partial<WorkspaceLayout>;
    const width = Number(raw.width);
    const height = Number(raw.height);
    if (
      typeof raw.id !== "string" ||
      typeof raw.name !== "string" ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      typeof raw.primary_tileset !== "string" ||
      typeof raw.secondary_tileset !== "string" ||
      typeof raw.blockdata_filepath !== "string"
    ) {
      throw new WorkspaceError(`Layout inválido na posição ${index} de layouts.json.`);
    }
    return {
      id: raw.id,
      name: raw.name,
      width,
      height,
      primary_tileset: raw.primary_tileset,
      secondary_tileset: raw.secondary_tileset,
      border_filepath: typeof raw.border_filepath === "string" ? raw.border_filepath : "",
      blockdata_filepath: normalizeWorkspacePath(raw.blockdata_filepath),
    };
  });
}

export function expectedMapBinBytes(width: number, height: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new WorkspaceError(`Dimensão inválida: ${width}×${height}.`);
  }
  return width * height * 2;
}

function filePath(file: File): string {
  const withRelativePath = file as File & { webkitRelativePath?: string };
  return normalizeWorkspacePath(withRelativePath.webkitRelativePath || file.name);
}

function buildFileMaps(files: Iterable<File>) {
  const exact = new Map<string, File>();
  const lower = new Map<string, File>();
  for (const file of files) {
    const path = filePath(file);
    if (!path) continue;
    exact.set(path, file);
    lower.set(path.toLowerCase(), file);
  }
  return { exact, lower };
}

function findFile(workspace: Pick<AraunaWorkspace, "files" | "filesLower">, path: string): File | undefined {
  const normalized = normalizeWorkspacePath(path);
  return workspace.files.get(normalized) ?? workspace.filesLower.get(normalized.toLowerCase());
}

function requireFile(workspace: Pick<AraunaWorkspace, "files" | "filesLower">, path: string): File {
  const file = findFile(workspace, path);
  if (!file) throw new WorkspaceError(`Arquivo obrigatório não encontrado: ${normalizeWorkspacePath(path)}`);
  return file;
}

function detectTilesetDirectories(paths: Iterable<string>): WorkspaceTilesetDirectory[] {
  const found = new Map<string, WorkspaceTilesetDirectory>();
  for (const path of paths) {
    const match = path.match(/^data\/tilesets\/(primary|secondary)\/([^/]+)\//i);
    const sideRaw = match?.[1];
    const name = match?.[2];
    if (!sideRaw || !name) continue;
    const side = sideRaw.toLowerCase() as TilesetSide;
    const dir = `data/tilesets/${side}/${name}`;
    const id = `${side}:${normalizeTilesetKey(name)}`;
    if (!found.has(id)) {
      found.set(id, { side, name, path: dir, key: normalizeTilesetKey(name) });
    }
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function resolveTilesetDirectory(
  tilesets: WorkspaceTilesetDirectory[],
  side: TilesetSide,
  symbol: string,
): WorkspaceTilesetDirectory | undefined {
  const key = normalizeTilesetKey(symbol);
  return tilesets.find((tileset) => tileset.side === side && tileset.key === key);
}

export async function loadAraunaWorkspace(files: FileList | File[]): Promise<AraunaWorkspace> {
  const array = Array.from(files);
  const { exact, lower } = buildFileMaps(array);
  const layoutsFile = exact.get("data/layouts/layouts.json") ?? lower.get("data/layouts/layouts.json");
  if (!layoutsFile) {
    throw new WorkspaceError(
      "Não encontrei data/layouts/layouts.json. Selecione a raiz do repositório ou diretamente a pasta data/.",
    );
  }

  const layoutList = parseLayoutsSource(await layoutsFile.text());
  const layouts = new Map(layoutList.map((layout) => [layout.id, layout]));
  const tilesets = detectTilesetDirectories(exact.keys());
  const maps: WorkspaceMap[] = [];

  for (const [path, file] of exact) {
    const match = path.match(/^data\/maps\/([^/]+)\/map\.json$/i);
    const directory = match?.[1];
    if (!directory) continue;
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const id = typeof raw.id === "string" ? raw.id : directory;
      const name = typeof raw.name === "string" ? raw.name : directory;
      const layoutId = typeof raw.layout === "string" ? raw.layout : "";
      const layout = layouts.get(layoutId);
      const mapEntry: WorkspaceMap = {
        path,
        directory,
        id,
        name,
        layoutId,
        ...(layout ? { layout } : {}),
        ...(!layoutId
          ? { error: "map.json sem campo layout" }
          : !layout
            ? { error: `Layout ${layoutId} não encontrado em layouts.json` }
            : {}),
      };
      maps.push(mapEntry);
    } catch (error) {
      maps.push({
        path,
        directory,
        id: directory,
        name: directory,
        layoutId: "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  maps.sort((a, b) => a.name.localeCompare(b.name));
  return { files: exact, filesLower: lower, layouts, maps, tilesets };
}

async function readPalettes(workspace: AraunaWorkspace, dir: WorkspaceTilesetDirectory) {
  const palettes = new Map<number, RgbColor[]>();
  const prefix = `${dir.path}/palettes/`.toLowerCase();
  for (const [path, file] of workspace.files) {
    if (!path.toLowerCase().startsWith(prefix)) continue;
    const match = path.match(/\/(\d{2})\.pal$/i);
    const paletteIndex = match?.[1];
    if (!paletteIndex) continue;
    palettes.set(Number(paletteIndex), parseJascPalette(await file.text()));
  }
  return palettes;
}

async function buildTilesetPair(
  workspace: AraunaWorkspace,
  primaryDir: WorkspaceTilesetDirectory,
  secondaryDir: WorkspaceTilesetDirectory,
): Promise<RenderTilesetPair> {
  const primaryTilesFile = requireFile(workspace, `${primaryDir.path}/tiles.png`);
  const secondaryTilesFile = requireFile(workspace, `${secondaryDir.path}/tiles.png`);
  const primaryMetatilesFile = requireFile(workspace, `${primaryDir.path}/metatiles.bin`);
  const secondaryMetatilesFile = requireFile(workspace, `${secondaryDir.path}/metatiles.bin`);
  const primaryAttrsFile = requireFile(workspace, `${primaryDir.path}/metatile_attributes.bin`);
  const secondaryAttrsFile = requireFile(workspace, `${secondaryDir.path}/metatile_attributes.bin`);

  const [
    primaryTiles,
    secondaryTiles,
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    primaryPalettes,
    secondaryPalettes,
  ] = await Promise.all([
    decodeIndexedTilesPng(primaryTilesFile),
    decodeIndexedTilesPng(secondaryTilesFile),
    primaryMetatilesFile.arrayBuffer().then(parseMetatilesBin),
    secondaryMetatilesFile.arrayBuffer().then(parseMetatilesBin),
    primaryAttrsFile.arrayBuffer().then(parseMetatileAttributes),
    secondaryAttrsFile.arrayBuffer().then(parseMetatileAttributes),
    readPalettes(workspace, primaryDir),
    readPalettes(workspace, secondaryDir),
  ]);

  return {
    primaryTiles,
    secondaryTiles,
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    palettes: combineOverworldPalettes(primaryPalettes, secondaryPalettes),
  };
}

function relabelSavedAtlas(primary: string, secondary: string) {
  const atlas = realAtlasStore.getSnapshot();
  if (!atlas || typeof window === "undefined") return;
  atlas.primary = primary;
  atlas.secondary = secondary;
  try {
    localStorage.setItem("arauna.realAtlas.v2", JSON.stringify(atlas));
    localStorage.removeItem("arauna.realAtlas.v1");
  } catch {
    /* storage opcional */
  }
}

export async function openWorkspaceMap(
  workspace: AraunaWorkspace,
  map: WorkspaceMap,
): Promise<OpenWorkspaceMapResult> {
  if (map.error) throw new WorkspaceError(`${map.name}: ${map.error}`);
  const layout = map.layout ?? workspace.layouts.get(map.layoutId);
  if (!layout) throw new WorkspaceError(`Layout não encontrado: ${map.layoutId || "(vazio)"}`);

  const mapBin = requireFile(workspace, layout.blockdata_filepath);
  const mapJson = requireFile(workspace, map.path);
  const expectedBytes = expectedMapBinBytes(layout.width, layout.height);
  if (mapBin.size !== expectedBytes) {
    throw new WorkspaceError(
      `${layout.blockdata_filepath} possui ${mapBin.size} bytes; esperado ${expectedBytes} para ${layout.width}×${layout.height}.`,
    );
  }

  const primaryDir = resolveTilesetDirectory(workspace.tilesets, "primary", layout.primary_tileset);
  if (!primaryDir) {
    throw new WorkspaceError(
      `Tileset primary ${layout.primary_tileset} não encontrado em data/tilesets/primary/.`,
    );
  }
  const secondaryDir = resolveTilesetDirectory(workspace.tilesets, "secondary", layout.secondary_tileset);
  if (!secondaryDir) {
    throw new WorkspaceError(
      `Tileset secondary ${layout.secondary_tileset} não encontrado em data/tilesets/secondary/.`,
    );
  }

  const pair = await buildTilesetPair(workspace, primaryDir, secondaryDir);
  const warnings = validateTilesetPair(pair);
  realAtlasStore.savePair(pair, 16);
  relabelSavedAtlas(layout.primary_tileset, layout.secondary_tileset);

  const binResult = editorStore.importBufferSized(
    await mapBin.arrayBuffer(),
    layout.blockdata_filepath,
    layout.width,
    layout.height,
  );
  if (!binResult.ok) throw new WorkspaceError(binResult.message);

  const jsonResult = editorStore.importMapJson(await mapJson.text(), map.path);
  if (!jsonResult.ok) throw new WorkspaceError(jsonResult.message);

  editorStore.setMessage(
    `${map.name} aberto pelo Workspace — ${layout.width}×${layout.height}; ` +
      `${layout.primary_tileset} + ${layout.secondary_tileset}` +
      (warnings.length ? `; ${warnings.length} aviso(s) de tileset.` : "."),
  );

  return { map, layout, primaryDir, secondaryDir, warnings };
}