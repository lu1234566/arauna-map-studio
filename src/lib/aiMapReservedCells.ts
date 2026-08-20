export type AiReservedCellKind = "warp" | "npc" | "trigger";

export interface AiReservedCell {
  x: number;
  y: number;
  kind: AiReservedCellKind;
  label: string;
}

interface EventLike {
  x: number;
  y: number;
  kind: AiReservedCellKind;
  label: string;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function integer(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function priority(kind: AiReservedCellKind) {
  if (kind === "warp") return 3;
  if (kind === "trigger") return 2;
  return 1;
}

/**
 * Reserva para a IA todos os eventos reais do mapa e expande object_events
 * pelo movement_range_x/y. Isso não altera o map.json: é apenas contexto para
 * impedir que uma construção nova seja colocada em cima de NPC/warp/trigger.
 */
export function deriveAiReservedCells(
  events: EventLike[],
  mapJsonDocument: JsonRecord | null,
  width: number,
  height: number,
): AiReservedCell[] {
  const cells = new Map<string, AiReservedCell>();
  const add = (cell: AiReservedCell) => {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) return;
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) return;
    const key = `${cell.x},${cell.y}`;
    const current = cells.get(key);
    if (!current || priority(cell.kind) > priority(current.kind)) cells.set(key, cell);
  };

  for (const event of events) {
    add({ x: event.x, y: event.y, kind: event.kind, label: event.label });
  }

  const objectEvents = Array.isArray(mapJsonDocument?.object_events)
    ? mapJsonDocument.object_events
    : [];
  for (const raw of objectEvents) {
    const object = record(raw);
    if (!object) continue;
    const x = integer(object.x, Number.NaN);
    const y = integer(object.y, Number.NaN);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const rangeX = Math.max(0, Math.min(6, integer(object.movement_range_x)));
    const rangeY = Math.max(0, Math.min(6, integer(object.movement_range_y)));
    const label = String(object.local_id ?? object.graphics_id ?? "NPC");
    for (let dy = -rangeY; dy <= rangeY; dy++) {
      for (let dx = -rangeX; dx <= rangeX; dx++) {
        add({ x: x + dx, y: y + dy, kind: "npc", label });
      }
    }
  }

  return [...cells.values()]
    .sort((a, b) => a.y - b.y || a.x - b.x || priority(b.kind) - priority(a.kind))
    .slice(0, 1200);
}
