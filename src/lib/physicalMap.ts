import {
  COLLISION_MASK,
  COLLISION_SHIFT,
  ELEVATION_MASK,
  ELEVATION_SHIFT,
  PHYSICAL_MASK,
  idx,
  type MapData,
} from "./emeraldMap";

export type PhysicalLayer = "collision" | "elevation";

export function clampCollision(value: number): number {
  return Math.min(3, Math.max(0, Math.trunc(value)));
}

export function clampElevation(value: number): number {
  return Math.min(15, Math.max(0, Math.trunc(value)));
}

export function getPhysicalLayerValue(physical: number, layer: PhysicalLayer): number {
  return layer === "collision"
    ? (physical & COLLISION_MASK) >>> COLLISION_SHIFT
    : (physical & ELEVATION_MASK) >>> ELEVATION_SHIFT;
}

export function setPhysicalLayerValue(
  physical: number,
  layer: PhysicalLayer,
  value: number,
): number {
  const safePhysical = physical & PHYSICAL_MASK;
  if (layer === "collision") {
    const collision = clampCollision(value);
    return (safePhysical & ~COLLISION_MASK) | ((collision << COLLISION_SHIFT) & COLLISION_MASK);
  }
  const elevation = clampElevation(value);
  return (safePhysical & ~ELEVATION_MASK) | ((elevation << ELEVATION_SHIFT) & ELEVATION_MASK);
}

/**
 * Flood fill 4-direções em apenas um campo físico. O outro campo físico e o
 * metatile visual permanecem intactos.
 */
export function floodFillPhysical(
  map: MapData,
  startX: number,
  startY: number,
  layer: PhysicalLayer,
  value: number,
  isBlocked: (x: number, y: number) => boolean = () => false,
): number[] {
  const { width, height, physical } = map;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return [];

  const startIndex = idx(startX, startY, width);
  const target = getPhysicalLayerValue(physical[startIndex] ?? 0, layer);
  const replacement = layer === "collision" ? clampCollision(value) : clampElevation(value);
  if (target === replacement) return [];

  const changed: number[] = [];
  const seen = new Uint8Array(width * height);
  const stack: number[] = [startIndex];

  while (stack.length) {
    const current = stack.pop();
    if (current == null || seen[current]) continue;
    seen[current] = 1;

    const x = current % width;
    const y = (current / width) | 0;
    if (isBlocked(x, y)) continue;
    if (getPhysicalLayerValue(physical[current] ?? 0, layer) !== target) continue;

    physical[current] = setPhysicalLayerValue(physical[current] ?? 0, layer, replacement);
    changed.push(current);

    if (x > 0) stack.push(current - 1);
    if (x < width - 1) stack.push(current + 1);
    if (y > 0) stack.push(current - width);
    if (y < height - 1) stack.push(current + width);
  }

  return changed;
}
