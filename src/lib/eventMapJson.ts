import type { MapEventSource } from "./pokeemeraldMapJson";

export type EditableMapJson = Record<string, unknown>;
export type EditableEventSource = MapEventSource;
export type EditableJsonRecord = Record<string, unknown>;

const EVENT_ARRAY_KEY: Record<EditableEventSource, string> = {
  warp: "warp_events",
  object: "object_events",
  coord: "coord_events",
  bg: "bg_events",
};

const NUMERIC_FIELDS = new Set([
  "x",
  "y",
  "elevation",
  "movement_range_x",
  "movement_range_y",
  "offset",
]);

const BOOLEAN_FIELDS = new Set([
  "requires_flash",
  "allow_cycling",
  "allow_escaping",
  "allow_running",
  "show_map_name",
]);

export class EventMapJsonError extends Error {}

function isRecord(value: unknown): value is EditableJsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneMapJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseEditableMapJson(source: string): EditableMapJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EventMapJsonError(`JSON inválido: ${reason}`);
  }
  if (!isRecord(parsed)) throw new EventMapJsonError("map.json precisa ter um objeto JSON na raiz.");
  return parsed;
}

export function eventId(source: EditableEventSource, index: number): string {
  return `${source}:${index}`;
}

export function parseEventId(id: string): { source: EditableEventSource; index: number } | null {
  const match = id.match(/^(warp|object|coord|bg):(\d+)$/);
  if (!match) return null;
  return { source: match[1] as EditableEventSource, index: Number(match[2]) };
}

function rawEventArray(document: EditableMapJson, source: EditableEventSource): unknown[] {
  const value = document[EVENT_ARRAY_KEY[source]];
  return Array.isArray(value) ? value : [];
}

export function eventArray(
  document: EditableMapJson,
  source: EditableEventSource,
): EditableJsonRecord[] {
  return rawEventArray(document, source).filter(isRecord);
}

export function eventRecord(
  document: EditableMapJson,
  id: string,
): { source: EditableEventSource; index: number; record: EditableJsonRecord } | null {
  const parsed = parseEventId(id);
  if (!parsed) return null;
  const raw = rawEventArray(document, parsed.source)[parsed.index];
  if (!isRecord(raw)) return null;
  return { ...parsed, record: raw };
}

function requireEventArray(document: EditableMapJson, source: EditableEventSource): unknown[] {
  const key = EVENT_ARRAY_KEY[source];
  const value = document[key];
  if (value == null) {
    const created: unknown[] = [];
    document[key] = created;
    return created;
  }
  if (!Array.isArray(value)) throw new EventMapJsonError(`${key} não é uma lista.`);
  return value;
}

function normalizeFieldValue(key: string, value: unknown, current: unknown): unknown {
  if (NUMERIC_FIELDS.has(key) || typeof current === "number") {
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(number) || !Number.isInteger(number)) {
      throw new EventMapJsonError(`${key} precisa ser um número inteiro.`);
    }
    return number;
  }
  if (BOOLEAN_FIELDS.has(key) || typeof current === "boolean") {
    if (typeof value === "boolean") return value;
    if (String(value).toLowerCase() === "true") return true;
    if (String(value).toLowerCase() === "false") return false;
    throw new EventMapJsonError(`${key} precisa ser true ou false.`);
  }
  return value;
}

export function updateMapField(
  document: EditableMapJson,
  key: string,
  value: unknown,
): EditableMapJson {
  const next = cloneMapJson(document);
  next[key] = normalizeFieldValue(key, value, next[key]);
  return next;
}

export function updateEventField(
  document: EditableMapJson,
  id: string,
  key: string,
  value: unknown,
): EditableMapJson {
  const next = cloneMapJson(document);
  const parsed = parseEventId(id);
  if (!parsed) throw new EventMapJsonError(`ID de evento inválido: ${id}`);
  const array = requireEventArray(next, parsed.source);
  const raw = array[parsed.index];
  if (!isRecord(raw)) throw new EventMapJsonError(`Evento não encontrado: ${id}`);
  raw[key] = normalizeFieldValue(key, value, raw[key]);
  return next;
}

export function moveEvent(
  document: EditableMapJson,
  id: string,
  x: number,
  y: number,
): EditableMapJson {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new EventMapJsonError("As coordenadas do evento precisam ser inteiras.");
  }
  let next = updateEventField(document, id, "x", x);
  next = updateEventField(next, id, "y", y);
  return next;
}

function defaultEvent(
  source: EditableEventSource,
  x: number,
  y: number,
  currentMapId: string,
): EditableJsonRecord {
  switch (source) {
    case "warp":
      return { x, y, elevation: 0, dest_map: currentMapId, dest_warp_id: "0" };
    case "object":
      return {
        graphics_id: "OBJ_EVENT_GFX_BOY_1",
        x,
        y,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: "0x0",
        flag: "0",
      };
    case "coord":
      return {
        type: "trigger",
        x,
        y,
        elevation: 3,
        var: "VAR_TEMP_0",
        var_value: "0",
        script: "0x0",
      };
    case "bg":
      return {
        type: "sign",
        x,
        y,
        elevation: 0,
        player_facing_dir: "BG_EVENT_PLAYER_FACING_ANY",
        script: "0x0",
      };
  }
}

export function addEvent(
  document: EditableMapJson,
  source: EditableEventSource,
  x: number,
  y: number,
): { document: EditableMapJson; id: string } {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new EventMapJsonError("As coordenadas do evento precisam ser inteiras.");
  }
  const next = cloneMapJson(document);
  const array = requireEventArray(next, source);
  const previous = array.length > 0 ? array[array.length - 1] : null;
  const currentMapId = typeof next.id === "string" ? next.id : "MAP_LITTLEROOT_TOWN";
  let created: EditableJsonRecord;

  if (source !== "object" && isRecord(previous)) {
    created = { ...cloneMapJson(previous), x, y };
  } else {
    created = defaultEvent(source, x, y, currentMapId);
  }

  array.push(created);
  return { document: next, id: eventId(source, array.length - 1) };
}

export function removeEvent(document: EditableMapJson, id: string): EditableMapJson {
  const parsed = parseEventId(id);
  if (!parsed) throw new EventMapJsonError(`ID de evento inválido: ${id}`);
  const next = cloneMapJson(document);
  const array = requireEventArray(next, parsed.source);
  if (parsed.index < 0 || parsed.index >= array.length || !isRecord(array[parsed.index])) {
    throw new EventMapJsonError(`Evento não encontrado: ${id}`);
  }
  array.splice(parsed.index, 1);
  return next;
}

function rawConnections(document: EditableMapJson): unknown[] {
  return Array.isArray(document.connections) ? document.connections : [];
}

function requireConnections(document: EditableMapJson): unknown[] {
  if (document.connections == null) {
    const created: unknown[] = [];
    document.connections = created;
    return created;
  }
  if (!Array.isArray(document.connections)) {
    throw new EventMapJsonError("connections não é uma lista.");
  }
  return document.connections;
}

export function connectionRecord(
  document: EditableMapJson,
  index: number,
): EditableJsonRecord | null {
  if (!Number.isInteger(index) || index < 0) return null;
  const raw = rawConnections(document)[index];
  return isRecord(raw) ? raw : null;
}

export function updateConnectionField(
  document: EditableMapJson,
  index: number,
  key: "map" | "direction" | "offset",
  value: unknown,
): EditableMapJson {
  const next = cloneMapJson(document);
  const array = requireConnections(next);
  const raw = array[index];
  if (!isRecord(raw)) throw new EventMapJsonError(`Conexão ${index} não encontrada.`);
  raw[key] = normalizeFieldValue(key, value, raw[key]);
  return next;
}

export function addConnection(
  document: EditableMapJson,
  direction: "up" | "down" | "left" | "right" = "up",
): { document: EditableMapJson; index: number } {
  const next = cloneMapJson(document);
  const array = requireConnections(next);
  const currentMapId = typeof next.id === "string" ? next.id : "MAP_LITTLEROOT_TOWN";
  array.push({ map: currentMapId, offset: 0, direction });
  return { document: next, index: array.length - 1 };
}

export function removeConnection(document: EditableMapJson, index: number): EditableMapJson {
  const next = cloneMapJson(document);
  const array = requireConnections(next);
  if (!Number.isInteger(index) || index < 0 || index >= array.length || !isRecord(array[index])) {
    throw new EventMapJsonError(`Conexão ${index} não encontrada.`);
  }
  array.splice(index, 1);
  return next;
}

export function stringifyMapJson(document: EditableMapJson): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function eventSourceLabel(source: EditableEventSource): string {
  if (source === "warp") return "Warp";
  if (source === "object") return "NPC/Objeto";
  if (source === "coord") return "Trigger";
  return "BG event";
}
