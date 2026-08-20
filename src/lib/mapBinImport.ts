export interface MapBinDimensions {
  width: number;
  height: number;
}

function verticalEqualityScore(buffer: ArrayBuffer, width: number, height: number) {
  if (height < 2) return 0;
  const view = new DataView(buffer);
  let equal = 0;
  let comparisons = 0;

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const a = view.getUint16((y * width + x) * 2, true) & 0x03ff;
      const b = view.getUint16(((y + 1) * width + x) * 2, true) & 0x03ff;
      if (a === b) equal++;
      comparisons++;
    }
  }

  return comparisons ? equal / comparisons : 0;
}

/**
 * map.bin stores cells only, not width/height. Return plausible dimensions
 * ranked by structural continuity; callers must still let the user confirm.
 */
export function mapBinDimensionCandidates(
  buffer: ArrayBuffer,
  minDimension = 8,
  maxDimension = 160,
): MapBinDimensions[] {
  if (buffer.byteLength === 0 || buffer.byteLength % 2 !== 0) return [];
  const cells = buffer.byteLength / 2;
  const candidates: Array<MapBinDimensions & { score: number }> = [];

  for (let width = minDimension; width <= Math.min(maxDimension, cells); width++) {
    if (cells % width !== 0) continue;
    const height = cells / width;
    if (height < minDimension || height > maxDimension) continue;
    const aspect = Math.min(width, height) / Math.max(width, height);
    const continuity = verticalEqualityScore(buffer, width, height);
    candidates.push({ width, height, score: continuity + aspect * 0.02 });
  }

  return candidates
    .sort((a, b) => b.score - a.score || Math.abs(a.width - a.height) - Math.abs(b.width - b.height))
    .map(({ width, height }) => ({ width, height }));
}

export function parseMapBinDimensionInput(source: string, cellCount: number): MapBinDimensions | null {
  const match = source.trim().match(/^(\d+)\s*(?:x|×|,|\*)\s*(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (width * height !== cellCount) return null;
  return { width, height };
}
