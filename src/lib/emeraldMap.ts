/**
 * Formato de map.bin do pokeemerald decomp.
 *
 * Cada célula do mapa é um uint16 little-endian:
 *   bits 0-9  (0x03FF) -> metatile id
 *   bits 10-15 (0xFC00) -> bits "físicos" (colisão + elevação)
 *
 * Em pokeemerald: colisão = bits 10-11 (0x0C00), elevação = bits 12-15 (0xF000).
 */

export const METATILE_MASK = 0x03ff;
export const PHYSICAL_MASK = 0xfc00;
export const COLLISION_MASK = 0x0c00;
export const COLLISION_SHIFT = 10;
export const ELEVATION_MASK = 0xf000;
export const ELEVATION_SHIFT = 12;

export const DEFAULT_WIDTH = 20;
export const DEFAULT_HEIGHT = 20;

export interface MapData {
  width: number;
  height: number;
  /** metatile ids (0..0x3FF), length = width * height */
  metatiles: Uint16Array;
  /** bits físicos já mascarados com 0xFC00, mesma ordem */
  physical: Uint16Array;
}

export const idx = (x: number, y: number, width: number) => y * width + x;

export function createEmptyMap(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  fillMetatile = 0,
): MapData {
  const size = width * height;
  const metatiles = new Uint16Array(size);
  metatiles.fill(fillMetatile & METATILE_MASK);
  return { width, height, metatiles, physical: new Uint16Array(size) };
}

export function cloneMap(map: MapData): MapData {
  return {
    width: map.width,
    height: map.height,
    metatiles: new Uint16Array(map.metatiles),
    physical: new Uint16Array(map.physical),
  };
}

export class MapParseError extends Error {}

/** Lê um map.bin (uint16 LE). Valida tamanho exato para as dimensões esperadas. */
export function parseMapBin(
  buffer: ArrayBuffer,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): MapData {
  const expectedBytes = width * height * 2;
  if (buffer.byteLength !== expectedBytes) {
    throw new MapParseError(
      `Tamanho inválido: ${buffer.byteLength} bytes. Esperado ${expectedBytes} bytes (${width}x${height} × 2).`,
    );
  }
  const view = new DataView(buffer);
  const size = width * height;
  const metatiles = new Uint16Array(size);
  const physical = new Uint16Array(size);
  for (let i = 0; i < size; i++) {
    const value = view.getUint16(i * 2, true); // little-endian
    metatiles[i] = value & METATILE_MASK;
    physical[i] = value & PHYSICAL_MASK;
  }
  return { width, height, metatiles, physical };
}

/** Reconstrói (physicalBits | metatileId) em uint16 little-endian. */
export function exportMapBin(map: MapData): Uint8Array {
  const size = map.width * map.height;
  const bytes = new Uint8Array(size * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < size; i++) {
    const value = ((map.physical[i] ?? 0) & PHYSICAL_MASK) | ((map.metatiles[i] ?? 0) & METATILE_MASK);
    view.setUint16(i * 2, value, true);
  }
  return bytes;
}

export function rawValue(map: MapData, i: number): number {
  return ((map.physical[i] ?? 0) & PHYSICAL_MASK) | ((map.metatiles[i] ?? 0) & METATILE_MASK);
}

export function getCollision(physical: number): number {
  return (physical & COLLISION_MASK) >> COLLISION_SHIFT;
}

export function getElevation(physical: number): number {
  return (physical & ELEVATION_MASK) >> ELEVATION_SHIFT;
}

export function hex(value: number, digits = 4): string {
  return "0x" + value.toString(16).toUpperCase().padStart(digits, "0");
}

export interface ValidationIssue {
  level: "error" | "warn" | "info";
  message: string;
}

export interface ValidationReport {
  pass: boolean;
  issues: ValidationIssue[];
  byteLength: number;
  cellCount: number;
}

export function validateMap(map: MapData): ValidationReport {
  const issues: ValidationIssue[] = [];
  const expectedCells = map.width * map.height;
  const cellCount = map.metatiles.length;

  if (cellCount !== expectedCells) {
    issues.push({
      level: "error",
      message: `Contagem de células ${cellCount} não bate com ${map.width}×${map.height} = ${expectedCells}.`,
    });
  } else {
    issues.push({ level: "info", message: `Contagem de células OK: ${cellCount}.` });
  }

  let badIds = 0;
  let badRaw = 0;
  for (let i = 0; i < cellCount; i++) {
    const id = map.metatiles[i] ?? 0;
    if (!Number.isInteger(id) || id < 0 || id > METATILE_MASK) badIds++;
    const raw = rawValue(map, i);
    if (!Number.isInteger(raw) || raw < 0 || raw > 0xffff) badRaw++;
  }
  if (badIds > 0) {
    issues.push({ level: "error", message: `${badIds} célula(s) com metatile ID fora de 0x0000–0x03FF.` });
  } else {
    issues.push({ level: "info", message: "Todos os metatile IDs ≤ 0x03FF." });
  }
  if (badRaw > 0) {
    issues.push({ level: "error", message: `${badRaw} célula(s) com valor fora do intervalo uint16.` });
  } else {
    issues.push({ level: "info", message: "Todos os valores brutos são uint16 válidos." });
  }

  const bytes = exportMapBin(map);
  const expectedBytes = expectedCells * 2;
  if (bytes.byteLength !== expectedBytes) {
    issues.push({
      level: "error",
      message: `Saída de ${bytes.byteLength} bytes; esperado ${expectedBytes} bytes.`,
    });
  } else {
    issues.push({ level: "info", message: `Exportação gera ${bytes.byteLength} bytes.` });
  }

  return {
    pass: issues.every((i) => i.level !== "error"),
    issues,
    byteLength: bytes.byteLength,
    cellCount,
  };
}

/** Flood fill 4-direções sobre os metatile ids. Retorna índices alterados. */
export function floodFill(
  map: MapData,
  startX: number,
  startY: number,
  newId: number,
  isBlocked: (x: number, y: number) => boolean = () => false,
): number[] {
  const { width, height, metatiles } = map;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return [];
  const target = metatiles[idx(startX, startY, width)] ?? 0;
  const replacement = newId & METATILE_MASK;
  if (target === replacement) return [];

  const changed: number[] = [];
  const seen = new Uint8Array(width * height);
  const stack: number[] = [idx(startX, startY, width)];

  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    if (metatiles[i] !== target) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (isBlocked(x, y)) continue;
    metatiles[i] = replacement;
    changed.push(i);
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }
  return changed;
}
