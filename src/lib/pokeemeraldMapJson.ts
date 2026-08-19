export type MapEventKind = "warp" | "npc" | "trigger";
export type MapEventSource = "warp" | "object" | "coord" | "bg";

export interface ParsedMapEvent {
  x: number;
  y: number;
  kind: MapEventKind;
  source: MapEventSource;
  label: string;
  detail: string;
}

export interface ParsedProtectedCell {
  x: number;
  y: number;
  reason: string;
}

export interface ParsedConnection {
  map: string;
  direction: string;
  offset: number;
}

export interface PokeemeraldMapMetadata {
  id: string;
  name: string;
  layout: string;
  music: string | null;
  regionMapSection: string | null;
  mapType: string | null;
  connections: ParsedConnection[];
  events: ParsedMapEvent[];
  protectedCells: ParsedProtectedCell[];
  counts: {
    warps: number;
    objects: number;
    coordEvents: number;
    bgEvents: number;
  };
}

export class MapJsonParseError extends Error {}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function coord(entry: JsonRecord): { x: number; y: number } | null {
  const x = integer(entry.x);
  const y = integer(entry.y);
  return x !== null && y !== null ? { x, y } : null;
}

function compact(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function requireString(root: JsonRecord, key: string): string {
  const value = text(root[key]);
  if (!value) throw new MapJsonParseError(`map.json inválido: campo obrigatório \"${key}\" ausente.`);
  return value;
}

function addProtected(
  map: Map<string, ParsedProtectedCell>,
  x: number,
  y: number,
  reason: string,
) {
  const key = `${x},${y}`;
  const current = map.get(key);
  if (!current) {
    map.set(key, { x, y, reason });
    return;
  }
  if (!current.reason.includes(reason)) current.reason += ` | ${reason}`;
}

/**
 * Interpreta data/maps/<MapName>/map.json do pokeemerald.
 *
 * O arquivo não contém os metatiles do layout: ele complementa map.bin com
 * warps, object events, coord events, background events e conexões.
 */
export function parsePokeemeraldMapJson(source: string): PokeemeraldMapMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MapJsonParseError(`JSON inválido: ${reason}`);
  }

  const root = record(parsed);
  if (!root) throw new MapJsonParseError("map.json inválido: a raiz precisa ser um objeto JSON.");

  const id = requireString(root, "id");
  const name = requireString(root, "name");
  const layout = requireString(root, "layout");

  const warpEntries = array(root.warp_events);
  const objectEntries = array(root.object_events);
  const coordEntries = array(root.coord_events);
  const bgEntries = array(root.bg_events);
  const events: ParsedMapEvent[] = [];
  const protectedByCoord = new Map<string, ParsedProtectedCell>();

  warpEntries.forEach((raw, index) => {
    const entry = record(raw);
    if (!entry) return;
    const point = coord(entry);
    if (!point) return;
    const destMap = text(entry.dest_map) ?? "destino desconhecido";
    const destWarp = text(entry.dest_warp_id) ?? String(entry.dest_warp_id ?? "?");
    const elevation = integer(entry.elevation);
    const label = `W${index}`;
    const detail = compact([
      `→ ${destMap}`,
      `warp ${destWarp}`,
      elevation !== null ? `elev ${elevation}` : null,
    ]);
    events.push({ ...point, kind: "warp", source: "warp", label, detail });
    addProtected(protectedByCoord, point.x, point.y, `${label}: ${destMap}`);
  });

  objectEntries.forEach((raw, index) => {
    const entry = record(raw);
    if (!entry) return;
    const point = coord(entry);
    if (!point) return;
    const graphics = text(entry.graphics_id) ?? "OBJ_EVENT";
    const localId = text(entry.local_id);
    const movement = text(entry.movement_type);
    const script = text(entry.script);
    const flag = text(entry.flag);
    const label = localId ?? `N${index}`;
    const detail = compact([
      graphics,
      movement,
      script && script !== "0x0" ? `script ${script}` : null,
      flag && flag !== "0" ? `flag ${flag}` : null,
    ]);
    events.push({ ...point, kind: "npc", source: "object", label, detail });
  });

  coordEntries.forEach((raw, index) => {
    const entry = record(raw);
    if (!entry) return;
    const point = coord(entry);
    if (!point) return;
    const script = text(entry.script);
    const variable = text(entry.var);
    const value = text(entry.var_value) ?? String(entry.var_value ?? "?");
    const label = `T${index}`;
    const detail = compact([
      variable ? `${variable} = ${value}` : null,
      script ? `script ${script}` : null,
    ]);
    events.push({ ...point, kind: "trigger", source: "coord", label, detail });
    addProtected(protectedByCoord, point.x, point.y, `${label}: ${script ?? "coord event"}`);
  });

  bgEntries.forEach((raw, index) => {
    const entry = record(raw);
    if (!entry) return;
    const point = coord(entry);
    if (!point) return;
    const script = text(entry.script);
    const type = text(entry.type) ?? "bg";
    const facing = text(entry.player_facing_dir);
    // O MVP ainda não possui uma camada "Signs" separada; BG events aparecem
    // na camada Triggers, mas mantêm origem/label próprios no inspetor.
    const label = `S${index}`;
    const detail = compact([
      type.toUpperCase(),
      script ? `script ${script}` : null,
      facing,
    ]);
    events.push({ ...point, kind: "trigger", source: "bg", label, detail });
    addProtected(protectedByCoord, point.x, point.y, `${label}: ${script ?? type}`);
  });

  const connections: ParsedConnection[] = [];
  for (const raw of array(root.connections)) {
    const entry = record(raw);
    if (!entry) continue;
    const map = text(entry.map);
    const direction = text(entry.direction);
    const offset = integer(entry.offset);
    if (!map || !direction || offset === null) continue;
    connections.push({ map, direction, offset });
  }

  return {
    id,
    name,
    layout,
    music: text(root.music),
    regionMapSection: text(root.region_map_section),
    mapType: text(root.map_type),
    connections,
    events,
    protectedCells: Array.from(protectedByCoord.values()),
    counts: {
      warps: warpEntries.length,
      objects: objectEntries.length,
      coordEvents: coordEntries.length,
      bgEvents: bgEntries.length,
    },
  };
}

export function metadataOutOfBounds(
  metadata: PokeemeraldMapMetadata,
  width: number,
  height: number,
): ParsedMapEvent[] {
  return metadata.events.filter(
    (event) => event.x < 0 || event.y < 0 || event.x >= width || event.y >= height,
  );
}
