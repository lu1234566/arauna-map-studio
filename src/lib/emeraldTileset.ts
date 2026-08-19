export const TILE_SIZE = 8;
export const METATILE_SIZE = 16;
export const TILES_PER_METATILE = 8;
export const PRIMARY_TILE_LIMIT = 512;
export const PRIMARY_METATILE_LIMIT = 512;
export const PRIMARY_PALETTE_COUNT = 6;
export const TOTAL_PALETTE_COUNT = 13;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface TileEntry {
  tileId: number;
  hFlip: boolean;
  vFlip: boolean;
  palette: number;
  raw: number;
}

export interface TileSheetData {
  width: number;
  height: number;
  tilesPerRow: number;
  tileCount: number;
  pixels: Uint8Array;
}

export interface MetatileSet {
  entries: Uint16Array;
  count: number;
}

export interface MetatileAttribute {
  raw: number;
  behavior: number;
  layerType: number;
}

export interface RenderTilesetPair {
  primaryTiles: TileSheetData;
  secondaryTiles: TileSheetData;
  primaryMetatiles: MetatileSet;
  secondaryMetatiles: MetatileSet;
  primaryAttributes?: MetatileAttribute[];
  secondaryAttributes?: MetatileAttribute[];
  palettes: Array<RgbColor[] | undefined>;
}

export interface AtlasRecord {
  id: number;
  source: "primary" | "secondary";
  localId: number;
  behavior: number | null;
  layerType: number | null;
}

export class TilesetParseError extends Error {}

const INDEX_GRAYS = [255, 238, 222, 205, 189, 172, 156, 139, 115, 98, 82, 65, 49, 32, 16, 0];

export function decodeTileEntry(raw: number): TileEntry {
  return {
    raw: raw & 0xffff,
    tileId: raw & 0x03ff,
    hFlip: Boolean(raw & 0x0400),
    vFlip: Boolean(raw & 0x0800),
    palette: (raw >>> 12) & 0x0f,
  };
}

export function parseMetatilesBin(buffer: ArrayBuffer): MetatileSet {
  if (buffer.byteLength === 0 || buffer.byteLength % (TILES_PER_METATILE * 2) !== 0) {
    throw new TilesetParseError(
      `metatiles.bin inválido: ${buffer.byteLength} bytes; esperado múltiplo de ${TILES_PER_METATILE * 2}.`,
    );
  }
  const count = buffer.byteLength / (TILES_PER_METATILE * 2);
  const view = new DataView(buffer);
  const entries = new Uint16Array(count * TILES_PER_METATILE);
  for (let i = 0; i < entries.length; i++) entries[i] = view.getUint16(i * 2, true);
  return { entries, count };
}

export function parseMetatileAttributes(buffer: ArrayBuffer): MetatileAttribute[] {
  if (buffer.byteLength % 2 !== 0) {
    throw new TilesetParseError("metatile_attributes.bin precisa ter tamanho par.");
  }
  const view = new DataView(buffer);
  const out: MetatileAttribute[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += 2) {
    const raw = view.getUint16(offset, true);
    out.push({ raw, behavior: raw & 0x00ff, layerType: (raw >>> 12) & 0x0f });
  }
  return out;
}

export function parseJascPalette(source: string): RgbColor[] {
  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] !== "JASC-PAL") throw new TilesetParseError("Paleta inválida: cabeçalho JASC-PAL ausente.");
  const count = Number(lines[2]);
  if (!Number.isInteger(count) || count !== 16) {
    throw new TilesetParseError(`Paleta inválida: esperado 16 cores, recebido ${lines[2] ?? "?"}.`);
  }
  const colors = lines.slice(3, 19).map((line, index) => {
    const values = line.split(/\s+/).map(Number);
    if (values.length !== 3 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new TilesetParseError(`Cor JASC inválida na posição ${index}.`);
    }
    return { r: values[0], g: values[1], b: values[2] };
  });
  if (colors.length !== 16) throw new TilesetParseError("Paleta JASC incompleta.");
  return colors;
}

function nearestIndexGray(value: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < INDEX_GRAYS.length; i++) {
    const distance = Math.abs(value - INDEX_GRAYS[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Os tiles.png do pokeemerald são PNGs indexados em tons de cinza; cada tom
 * representa um índice 4bpp (0..15). O browser já decodifica o PNG, então
 * reconstruímos somente o índice, sem depender de uma biblioteca PNG.
 */
export async function decodeIndexedTilesPng(file: Blob): Promise<TileSheetData> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width % TILE_SIZE !== 0 || bitmap.height % TILE_SIZE !== 0) {
      throw new TilesetParseError(
        `tiles.png inválido: ${bitmap.width}×${bitmap.height}; dimensões precisam ser múltiplas de 8.`,
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new TilesetParseError("Canvas 2D indisponível no navegador.");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < pixels.length; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 2) {
        throw new TilesetParseError(
          "tiles.png não parece ser o indexed PNG em tons de cinza esperado pelo pokeemerald.",
        );
      }
      pixels[i] = nearestIndexGray(r);
    }
    const tilesPerRow = canvas.width / TILE_SIZE;
    return {
      width: canvas.width,
      height: canvas.height,
      tilesPerRow,
      tileCount: tilesPerRow * (canvas.height / TILE_SIZE),
      pixels,
    };
  } finally {
    bitmap.close();
  }
}

export function paletteNumberFromFileName(name: string): number | null {
  const match = name.replace(/\\/g, "/").match(/(?:^|\/)(\d{2})\.pal$/i);
  return match ? Number(match[1]) : null;
}

export async function parsePaletteFiles(files: Iterable<File>): Promise<Map<number, RgbColor[]>> {
  const out = new Map<number, RgbColor[]>();
  for (const file of files) {
    const index = paletteNumberFromFileName(file.webkitRelativePath || file.name);
    if (index === null) continue;
    out.set(index, parseJascPalette(await file.text()));
  }
  return out;
}

export function combineOverworldPalettes(
  primary: Map<number, RgbColor[]>,
  secondary: Map<number, RgbColor[]>,
): Array<RgbColor[] | undefined> {
  const palettes: Array<RgbColor[] | undefined> = Array(TOTAL_PALETTE_COUNT).fill(undefined);
  for (let i = 0; i < PRIMARY_PALETTE_COUNT; i++) palettes[i] = primary.get(i);
  for (let i = PRIMARY_PALETTE_COUNT; i < TOTAL_PALETTE_COUNT; i++) palettes[i] = secondary.get(i);
  return palettes;
}

function tilePixel(sheet: TileSheetData, localTileId: number, x: number, y: number): number | null {
  if (localTileId < 0 || localTileId >= sheet.tileCount) return null;
  const tileX = (localTileId % sheet.tilesPerRow) * TILE_SIZE;
  const tileY = Math.floor(localTileId / sheet.tilesPerRow) * TILE_SIZE;
  return sheet.pixels[(tileY + y) * sheet.width + tileX + x] ?? null;
}

function resolveTile(pair: RenderTilesetPair, tileId: number): { sheet: TileSheetData; localId: number } | null {
  if (tileId < PRIMARY_TILE_LIMIT) {
    if (tileId >= pair.primaryTiles.tileCount) return null;
    return { sheet: pair.primaryTiles, localId: tileId };
  }
  const localId = tileId - PRIMARY_TILE_LIMIT;
  if (localId >= pair.secondaryTiles.tileCount) return null;
  return { sheet: pair.secondaryTiles, localId };
}

function draw8x8(
  image: ImageData,
  pair: RenderTilesetPair,
  entryRaw: number,
  destX: number,
  destY: number,
) {
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
      const color = palette[paletteIndex];
      image.data[out] = color.r;
      image.data[out + 1] = color.g;
      image.data[out + 2] = color.b;
      image.data[out + 3] = 255;
    }
  }
}

export function renderMetatileImage(pair: RenderTilesetPair, metatileId: number): ImageData {
  const primary = metatileId < PRIMARY_METATILE_LIMIT;
  const localId = primary ? metatileId : metatileId - PRIMARY_METATILE_LIMIT;
  const set = primary ? pair.primaryMetatiles : pair.secondaryMetatiles;
  if (localId < 0 || localId >= set.count) {
    throw new TilesetParseError(`Metatile ${metatileId} não existe no par carregado.`);
  }
  const image = new ImageData(METATILE_SIZE, METATILE_SIZE);
  const base = localId * TILES_PER_METATILE;
  const positions: Array<[number, number]> = [
    [0, 0],
    [8, 0],
    [0, 8],
    [8, 8],
  ];

  // pokeemerald padrão: 2 camadas de 4 tiles; camada superior é composta por último.
  for (let layer = 0; layer < 2; layer++) {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const [x, y] = positions[quadrant];
      draw8x8(image, pair, set.entries[base + layer * 4 + quadrant], x, y);
    }
  }
  return image;
}

export function atlasRecords(pair: RenderTilesetPair): AtlasRecord[] {
  const records: AtlasRecord[] = [];
  for (let localId = 0; localId < pair.primaryMetatiles.count; localId++) {
    const attr = pair.primaryAttributes?.[localId];
    records.push({
      id: localId,
      source: "primary",
      localId,
      behavior: attr?.behavior ?? null,
      layerType: attr?.layerType ?? null,
    });
  }
  for (let localId = 0; localId < pair.secondaryMetatiles.count; localId++) {
    const attr = pair.secondaryAttributes?.[localId];
    records.push({
      id: PRIMARY_METATILE_LIMIT + localId,
      source: "secondary",
      localId,
      behavior: attr?.behavior ?? null,
      layerType: attr?.layerType ?? null,
    });
  }
  return records;
}

export function renderAtlasCanvas(pair: RenderTilesetPair, columns = 16): HTMLCanvasElement {
  const records = atlasRecords(pair);
  const rows = Math.ceil(records.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * METATILE_SIZE;
  canvas.height = rows * METATILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new TilesetParseError("Canvas 2D indisponível.");
  ctx.imageSmoothingEnabled = false;
  records.forEach((record, index) => {
    const image = renderMetatileImage(pair, record.id);
    const x = (index % columns) * METATILE_SIZE;
    const y = Math.floor(index / columns) * METATILE_SIZE;
    ctx.putImageData(image, x, y);
  });
  return canvas;
}

export function validateTilesetPair(pair: RenderTilesetPair): string[] {
  const warnings: string[] = [];
  if (pair.primaryTiles.tileCount < PRIMARY_TILE_LIMIT) {
    warnings.push(`Primary tiles.png possui ${pair.primaryTiles.tileCount} tiles; o padrão Emerald reserva 512.`);
  }
  if (pair.primaryMetatiles.count !== PRIMARY_METATILE_LIMIT) {
    warnings.push(`Primary metatiles.bin possui ${pair.primaryMetatiles.count} metatiles; esperado 512 para General.`);
  }
  if (pair.primaryAttributes && pair.primaryAttributes.length !== pair.primaryMetatiles.count) {
    warnings.push("Quantidade de atributos primários não corresponde aos metatiles primários.");
  }
  if (pair.secondaryAttributes && pair.secondaryAttributes.length !== pair.secondaryMetatiles.count) {
    warnings.push("Quantidade de atributos secundários não corresponde aos metatiles secundários.");
  }
  for (let i = 0; i < TOTAL_PALETTE_COUNT; i++) {
    if (!pair.palettes[i]) warnings.push(`Paleta ${String(i).padStart(2, "0")} não carregada.`);
  }
  return warnings;
}
