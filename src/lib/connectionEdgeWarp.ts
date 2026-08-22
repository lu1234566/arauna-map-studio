import type { EditableMapJson } from "./eventMapJson";

export type BorderConnectionDirection = "up" | "down" | "left" | "right";

export interface MapPoint {
  x: number;
  y: number;
}

export interface EdgeConnectionEntry {
  index: number;
  direction: BorderConnectionDirection;
  map: string | null;
  offset: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * pokeemerald keeps a connection buffer around a layout (MAP_OFFSET = 7).
 * Events may therefore legitimately sit on the FIRST cell just outside the
 * layout when that side has a map connection. SlateportCity's vanilla
 * Harbor warp at (40,7) on a 40x60 layout is the canonical example.
 *
 * We intentionally accept only the first margin cell here. Anything farther
 * outside needs an explicit future engine rule instead of being silently
 * blessed by the Studio.
 */
export function connectionEdgeDirection(
  width: number,
  height: number,
  point: MapPoint,
): BorderConnectionDirection | null {
  if (point.x === width && point.y >= 0 && point.y < height) return "right";
  if (point.x === -1 && point.y >= 0 && point.y < height) return "left";
  if (point.y === height && point.x >= 0 && point.x < width) return "down";
  if (point.y === -1 && point.x >= 0 && point.x < width) return "up";
  return null;
}

export function edgeInteriorAnchor(
  width: number,
  height: number,
  point: MapPoint,
): MapPoint | null {
  const direction = connectionEdgeDirection(width, height, point);
  if (!direction) return null;
  if (direction === "right") return { x: width - 1, y: point.y };
  if (direction === "left") return { x: 0, y: point.y };
  if (direction === "down") return { x: point.x, y: height - 1 };
  return { x: point.x, y: 0 };
}

export function edgeConnections(
  document: EditableMapJson,
  direction: BorderConnectionDirection,
): EdgeConnectionEntry[] {
  if (!Array.isArray(document.connections)) return [];
  const entries: EdgeConnectionEntry[] = [];
  document.connections.forEach((raw, index) => {
    if (!isRecord(raw) || raw.direction !== direction) return;
    entries.push({
      index,
      direction,
      map: text(raw.map),
      offset: integer(raw.offset),
    });
  });
  return entries;
}

export function isConnectionEdgeWarpPosition(
  document: EditableMapJson,
  width: number,
  height: number,
  point: MapPoint,
): boolean {
  const direction = connectionEdgeDirection(width, height, point);
  return Boolean(direction && edgeConnections(document, direction).length > 0);
}

/**
 * Convert a source map's first connection-margin coordinate to the actual
 * border cell of the connected layout using pokeemerald's offset semantics.
 */
export function translateEdgePointToNeighbor(
  direction: BorderConnectionDirection,
  sourcePoint: MapPoint,
  offset: number,
  neighborWidth: number,
  neighborHeight: number,
): MapPoint | null {
  if (
    !Number.isInteger(neighborWidth) ||
    !Number.isInteger(neighborHeight) ||
    neighborWidth <= 0 ||
    neighborHeight <= 0
  ) {
    return null;
  }

  if (direction === "right" || direction === "left") {
    const y = sourcePoint.y - offset;
    if (y < 0 || y >= neighborHeight) return null;
    return { x: direction === "right" ? 0 : neighborWidth - 1, y };
  }

  const x = sourcePoint.x - offset;
  if (x < 0 || x >= neighborWidth) return null;
  return { x, y: direction === "down" ? 0 : neighborHeight - 1 };
}
