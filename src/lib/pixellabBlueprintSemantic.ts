import type { PixelLabRegion } from "./pixellabMapRender";
import type { PixelLabBlueprintState, PixelLabBlueprintZone } from "./pixellabBlueprintStore";

type Point = { x: number; y: number };
type Box = { x0: number; y0: number; x1: number; y1: number; count: number };

function localZone(snapshot: PixelLabBlueprintState, bounds: PixelLabRegion, x: number, y: number): PixelLabBlueprintZone {
  if (x < 0 || y < 0 || x >= bounds.w || y >= bounds.h) return "none";
  const mapX = bounds.x + x;
  const mapY = bounds.y + y;
  return snapshot.cells[mapY * snapshot.width + mapX] ?? "none";
}

function roadLike(zone: PixelLabBlueprintZone) {
  return zone === "path" || zone === "entrance";
}

function horizontalRoadRuns(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState) {
  const runs: string[] = [];
  for (let y = 0; y < bounds.h; y++) {
    let start = -1;
    for (let x = 0; x <= bounds.w; x++) {
      const active = x < bounds.w && roadLike(localZone(snapshot, bounds, x, y));
      if (active && start < 0) start = x;
      if (!active && start >= 0) {
        const end = x - 1;
        if (end - start >= 1) runs.push(`horizontal road y=${y}, x=${start}..${end}`);
        start = -1;
      }
    }
  }
  return runs;
}

function verticalRoadRuns(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState) {
  const runs: string[] = [];
  for (let x = 0; x < bounds.w; x++) {
    let start = -1;
    for (let y = 0; y <= bounds.h; y++) {
      const active = y < bounds.h && roadLike(localZone(snapshot, bounds, x, y));
      if (active && start < 0) start = y;
      if (!active && start >= 0) {
        const end = y - 1;
        if (end - start >= 1) runs.push(`vertical road x=${x}, y=${start}..${end}`);
        start = -1;
      }
    }
  }
  return runs;
}

function isolatedRoadPoints(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      if (!roadLike(localZone(snapshot, bounds, x, y))) continue;
      const connected = roadLike(localZone(snapshot, bounds, x - 1, y)) ||
        roadLike(localZone(snapshot, bounds, x + 1, y)) ||
        roadLike(localZone(snapshot, bounds, x, y - 1)) ||
        roadLike(localZone(snapshot, bounds, x, y + 1));
      if (!connected) points.push({ x, y });
    }
  }
  return points;
}

function zoneComponents(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState, zone: PixelLabBlueprintZone): Box[] {
  const visited = new Set<string>();
  const boxes: Box[] = [];
  const key = (x: number, y: number) => `${x},${y}`;

  for (let y = 0; y < bounds.h; y++) {
    for (let x = 0; x < bounds.w; x++) {
      if (localZone(snapshot, bounds, x, y) !== zone || visited.has(key(x, y))) continue;
      const queue: Point[] = [{ x, y }];
      visited.add(key(x, y));
      let x0 = x, x1 = x, y0 = y, y1 = y, count = 0;
      while (queue.length) {
        const point = queue.shift()!;
        count++;
        x0 = Math.min(x0, point.x); x1 = Math.max(x1, point.x);
        y0 = Math.min(y0, point.y); y1 = Math.max(y1, point.y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = point.x + dx, ny = point.y + dy;
          const k = key(nx, ny);
          if (nx < 0 || ny < 0 || nx >= bounds.w || ny >= bounds.h || visited.has(k)) continue;
          if (localZone(snapshot, bounds, nx, ny) !== zone) continue;
          visited.add(k);
          queue.push({ x: nx, y: ny });
        }
      }
      boxes.push({ x0, y0, x1, y1, count });
    }
  }
  return boxes.sort((a, b) => b.count - a.count);
}

function entrancePoints(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < bounds.h; y++) for (let x = 0; x < bounds.w; x++) {
    if (localZone(snapshot, bounds, x, y) === "entrance") points.push({ x, y });
  }
  return points;
}

function formatBoxes(label: string, boxes: Box[]) {
  if (!boxes.length) return "";
  return `${label}: ${boxes.slice(0, 10).map((b) => `box x=${b.x0}..${b.x1}, y=${b.y0}..${b.y1} (${b.count} cells)`).join("; ")}.`;
}

/**
 * Converts the painted blueprint into text-only spatial constraints.
 * No visual guide is sent to PixelLab, preventing diagram artifacts from leaking into the artwork.
 */
export function describePixelLabBlueprint(bounds: PixelLabRegion, snapshot: PixelLabBlueprintState): string {
  const roads = [...horizontalRoadRuns(bounds, snapshot), ...verticalRoadRuns(bounds, snapshot)];
  const isolated = isolatedRoadPoints(bounds, snapshot);
  const entrances = entrancePoints(bounds, snapshot);
  const buildings = zoneComponents(bounds, snapshot, "building");
  const water = zoneComponents(bounds, snapshot, "water");
  const vegetation = zoneComponents(bounds, snapshot, "vegetation");
  const free = zoneComponents(bounds, snapshot, "free");

  const clauses = [
    `Use a logical ${bounds.w} by ${bounds.h} planning grid only as spatial instructions; x increases left-to-right and y increases top-to-bottom. Do not draw or show the grid.`,
    roads.length ? `Mandatory road topology: ${roads.slice(0, 24).join("; ")}. Preserve connectivity and intersections, but render them as natural finished roads, never rails, ladders or diagram lines.` : "",
    isolated.length ? `Additional isolated road/path cells: ${isolated.slice(0, 20).map((p) => `(${p.x},${p.y})`).join(", ")}.` : "",
    entrances.length ? `Mandatory map entrances/exits: ${entrances.map((p) => `(${p.x},${p.y})`).join(", ")}. Each must connect to the road network and remain at the corresponding edge/position.` : "",
    formatBoxes("Building zones", buildings),
    formatBoxes("Water zones", water),
    formatBoxes("Vegetation/blocked zones", vegetation),
    formatBoxes("Open/free zones", free),
    "These coordinates are planning constraints, not visible content. Produce a complete natural pixel-art map with no numbers, coordinates, grid, boxes, rails, ladders, guide marks, schematic symbols or blueprint colors.",
  ].filter(Boolean);

  return clauses.join(" ").slice(0, 3000);
}
