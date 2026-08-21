import {
  METATILE_MASK,
  PHYSICAL_MASK,
  exportMapBin,
  idx,
  type MapData,
} from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import {
  atlasFingerprint,
  borderCells,
  canonicalJson,
  compileCityBundle,
  parseCityBundle,
  serializeCityBundle,
  verifyBundleIntegrity,
  type AraunaCityBundle,
  type FingerprintAtlas,
} from "./araunaCityBundle";
import {
  connectionEdgeDirection,
  edgeConnections,
  edgeInteriorAnchor,
  isConnectionEdgeWarpPosition,
  translateEdgePointToNeighbor,
  type MapPoint,
} from "./connectionEdgeWarp";
import {
  buildPassabilityGrid,
  cellPassability,
  connectedComponents,
  isKnownWarpBehavior,
  LENIENT_PASSABLE,
  VERIFIED_PASSABLE,
  type Passability,
  type PassabilityGrid,
} from "./mapPassability";
import { getPhysicalLayerValue } from "./physicalMap";
import { getWorkspaceAuditContext } from "./workspaceAuditContext";

export type ImplementabilitySeverity = "error" | "warning" | "info";
export type ImplementabilityCategory =
  | "grid"
  | "tilesets"
  | "mapJson"
  | "warps"
  | "npcs"
  | "triggers"
  | "connections"
  | "accessibility"
  | "weather"
  | "roundtrip";

export interface ImplementabilityIssue {
  code: string;
  severity: ImplementabilitySeverity;
  category: ImplementabilityCategory;
  message: string;
  x?: number;
  y?: number;
  eventSource?: "warp" | "object" | "coord" | "bg";
  eventIndex?: number;
}

export interface ImplementabilityCategorySummary {
  errors: number;
  warnings: number;
  info: number;
}

export interface GameImplementabilityReport {
  /** Zero hard errors. */
  pass: boolean;
  /**
   * Stronger than pass: zero errors, zero unresolved warnings, compatible real
   * atlas and a bundle whose round-trip matches the editor state.
   */
  implementable: boolean;
  confidence: "full" | "partial";
  fullyVerified: boolean;
  issues: ImplementabilityIssue[];
  categories: Record<ImplementabilityCategory, ImplementabilityCategorySummary>;
  counts: { errors: number; warnings: number; info: number };
}

export interface WorkspaceAuditMap {
  map?: MapData;
  mapJson: EditableMapJson;
  width?: number;
  height?: number;
  /** Atributos leves do par de tilesets; PNG/paletas não são necessários. */
  atlas?: FingerprintAtlas | null;
}

export interface ImplementabilityWorkspaceContext {
  /** Mapas indexados pelo id MAP_* do map.json. */
  maps: Record<string, WorkspaceAuditMap | undefined>;
  /** ID do mapa para o qual este contexto foi coletado. Evita contexto stale. */
  sourceMapId?: string | null;
  /** Falhas de leitura são informativas; dependência ausente continua warning. */
  loadErrors?: Record<string, string>;
}

export interface GameImplementabilityInput {
  map: MapData;
  mapJson: EditableMapJson | null;
  atlas?: FingerprintAtlas | null;
  declaredTilesets?: {
    primary?: string | null;
    secondary?: string | null;
    atlasFingerprint?: string | null;
  } | null;
  workspaceContext?: ImplementabilityWorkspaceContext | null;
  bundle?: AraunaCityBundle | null;
}

const CATEGORIES: ImplementabilityCategory[] = [
  "grid",
  "tilesets",
  "mapJson",
  "warps",
  "npcs",
  "triggers",
  "connections",
  "accessibility",
  "weather",
  "roundtrip",
];

/** Símbolos definidos em include/constants/weather.h do pokeemerald/Arauna. */
export const KNOWN_POKEEMERALD_WEATHER = new Set([
  "WEATHER_NONE",
  "WEATHER_SUNNY_CLOUDS",
  "WEATHER_SUNNY",
  "WEATHER_RAIN",
  "WEATHER_SNOW",
  "WEATHER_RAIN_THUNDERSTORM",
  "WEATHER_FOG_HORIZONTAL",
  "WEATHER_VOLCANIC_ASH",
  "WEATHER_SANDSTORM",
  "WEATHER_FOG_DIAGONAL",
  "WEATHER_UNDERWATER",
  "WEATHER_SHADE",
  "WEATHER_DROUGHT",
  "WEATHER_DOWNPOUR",
  "WEATHER_UNDERWATER_BUBBLES",
  "WEATHER_ABNORMAL",
  "WEATHER_ROUTE119_CYCLE",
  "WEATHER_ROUTE123_CYCLE",
]);

const BORDER_CONNECTION_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const VALID_CONNECTION_DIRECTIONS = new Set([
  "up",
  "down",
  "left",
  "right",
  "dive",
  "emerge",
]);
const OPPOSITE_DIRECTION: Record<string, string> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  dive: "emerge",
  emerge: "dive",
};

/** include/constants/maps.h: símbolos aceitos no campo dest_warp_id. */
const SYMBOLIC_WARP_IDS: Record<string, number> = {
  WARP_ID_NONE: -1,
  WARP_ID_SECRET_BASE: 0x7e,
  WARP_ID_DYNAMIC: 0x7f,
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function integerLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  return SYMBOLIC_WARP_IDS[value] ?? null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function inBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function collisionAt(map: MapData, x: number, y: number): number | null {
  if (!inBounds(map, x, y)) return null;
  return getPhysicalLayerValue(map.physical[idx(x, y, map.width)] ?? 0, "collision");
}

function issue(
  issues: ImplementabilityIssue[],
  code: string,
  severity: ImplementabilitySeverity,
  category: ImplementabilityCategory,
  message: string,
  location: Partial<Pick<ImplementabilityIssue, "x" | "y" | "eventSource" | "eventIndex">> = {},
) {
  issues.push({ code, severity, category, message, ...location });
}

function eventPoint(entry: Record<string, unknown>): MapPoint | null {
  const x = integer(entry.x);
  const y = integer(entry.y);
  return x === null || y === null ? null : { x, y };
}

function arraysEqual(a: Uint16Array, b: Uint16Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function resolveWorkspaceContext(
  input: GameImplementabilityInput,
): ImplementabilityWorkspaceContext | null {
  const explicit = input.workspaceContext ?? null;
  if (explicit) return explicit;
  const active = getWorkspaceAuditContext();
  const mapId = text(input.mapJson?.id);
  if (!active || !mapId || active.sourceMapId !== mapId) return null;
  return active;
}

function auditGrid(input: GameImplementabilityInput, issues: ImplementabilityIssue[]) {
  const { map } = input;
  const expected = map.width * map.height;
  if (
    !Number.isInteger(map.width) ||
    !Number.isInteger(map.height) ||
    map.width <= 0 ||
    map.height <= 0
  ) {
    issue(issues, "GRID_DIMENSIONS", "error", "grid", `Dimensão inválida: ${map.width}×${map.height}.`);
    return;
  }
  if (map.metatiles.length !== expected) {
    issue(issues, "GRID_CELL_COUNT", "error", "grid", `${map.metatiles.length} metatiles; esperado ${expected}.`);
  }
  if (map.physical.length !== expected) {
    issue(issues, "GRID_PHYSICAL_COUNT", "error", "grid", `${map.physical.length} valores físicos; esperado ${expected}.`);
  }

  const scan = Math.min(expected, map.metatiles.length, map.physical.length);
  for (let i = 0; i < scan; i++) {
    const metatile = map.metatiles[i] ?? 0;
    const physical = map.physical[i] ?? 0;
    if (!Number.isInteger(metatile) || metatile < 0 || metatile > METATILE_MASK) {
      issue(issues, "GRID_METATILE_RANGE", "error", "grid", `Metatile ${metatile} fora de 0x000–0x3FF na célula ${i}.`);
      break;
    }
    if (
      !Number.isInteger(physical) ||
      physical < 0 ||
      physical > PHYSICAL_MASK ||
      (physical & ~PHYSICAL_MASK) !== 0
    ) {
      issue(issues, "GRID_PHYSICAL_RANGE", "error", "grid", `Bits físicos 0x${physical.toString(16)} inválidos na célula ${i}.`);
      break;
    }
  }

  const bytes = exportMapBin(map);
  if (bytes.byteLength !== expected * 2) {
    issue(issues, "GRID_BIN_SIZE", "error", "grid", `map.bin exportaria ${bytes.byteLength} bytes; esperado ${expected * 2}.`);
  } else {
    issue(issues, "GRID_BIN_SIZE_OK", "info", "grid", `${expected} células / ${bytes.byteLength} bytes reproduzíveis.`);
  }
}

function auditTilesets(input: GameImplementabilityInput, issues: ImplementabilityIssue[]) {
  const { map, atlas, declaredTilesets } = input;
  if (!atlas) {
    issue(issues, "ATLAS_NOT_LOADED", "warning", "tilesets", "Atlas GBA real não está carregado; metatiles e behaviors não podem ser certificados.");
    return;
  }

  const recordIds = new Set(atlas.records.map((entry) => entry.id));
  const missing = new Set<number>();
  for (const metatile of map.metatiles) if (!recordIds.has(metatile)) missing.add(metatile);
  if (missing.size) {
    issue(
      issues,
      "ATLAS_MISSING_METATILES",
      "error",
      "tilesets",
      `${missing.size} metatile(s) usados não existem no atlas ativo: ${[...missing]
        .slice(0, 12)
        .map((id) => `0x${id.toString(16).padStart(3, "0")}`)
        .join(", ")}${missing.size > 12 ? "…" : ""}.`,
    );
  } else {
    issue(issues, "ATLAS_METATILES_OK", "info", "tilesets", `Todos os metatiles usados existem no atlas ativo (${atlas.records.length} registros).`);
  }

  if (!declaredTilesets) return;
  if (declaredTilesets.primary && atlas.primary && declaredTilesets.primary !== atlas.primary) {
    issue(issues, "ATLAS_PRIMARY_MISMATCH", "error", "tilesets", `Primary do bundle (${declaredTilesets.primary}) difere do atlas (${atlas.primary}).`);
  }
  if (declaredTilesets.secondary && atlas.secondary && declaredTilesets.secondary !== atlas.secondary) {
    issue(issues, "ATLAS_SECONDARY_MISMATCH", "error", "tilesets", `Secondary do bundle (${declaredTilesets.secondary}) difere do atlas (${atlas.secondary}).`);
  }
  if (declaredTilesets.atlasFingerprint) {
    const active = atlasFingerprint(atlas);
    if (active !== declaredTilesets.atlasFingerprint) {
      issue(issues, "ATLAS_FINGERPRINT_MISMATCH", "error", "tilesets", `Fingerprint do atlas ativo (${active}) difere do bundle (${declaredTilesets.atlasFingerprint}).`);
    }
  }
}

function auditMapJson(input: GameImplementabilityInput, issues: ImplementabilityIssue[]) {
  const document = input.mapJson;
  if (!document) {
    issue(issues, "MAPJSON_MISSING", "error", "mapJson", "map.json não carregado; eventos, conexões, clima e propriedades seriam perdidos.");
    return;
  }
  for (const key of ["id", "name", "layout"] as const) {
    if (!text(document[key])) {
      issue(issues, `MAPJSON_${key.toUpperCase()}_MISSING`, "error", "mapJson", `Campo obrigatório ${key} ausente.`);
    }
  }
  for (const key of ["warp_events", "object_events", "coord_events", "bg_events", "connections"] as const) {
    const value = document[key];
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      issue(issues, `MAPJSON_${key.toUpperCase()}_TYPE`, "error", "mapJson", `${key} precisa ser array ou null quando presente.`);
    }
  }
  issue(issues, "MAPJSON_PRESENT", "info", "mapJson", "Documento map.json completo disponível para round-trip.");
}

function auditWeather(document: EditableMapJson | null, issues: ImplementabilityIssue[]) {
  if (!document) return;
  const weather = document.weather;
  if (typeof weather !== "string" || weather.length === 0) {
    issue(issues, "WEATHER_MISSING", "warning", "weather", "Campo weather ausente/vazio; o Studio não inventa clima automaticamente.");
    return;
  }
  if (KNOWN_POKEEMERALD_WEATHER.has(weather)) {
    issue(issues, "WEATHER_KNOWN", "info", "weather", `Clima preservado e reconhecido: ${weather}.`);
  } else if (weather.startsWith("WEATHER_")) {
    issue(issues, "WEATHER_CUSTOM_UNVERIFIED", "warning", "weather", `Clima ${weather} foi preservado, mas parece constante customizada e precisa existir no código do jogo.`);
  } else {
    issue(issues, "WEATHER_INVALID_SYMBOL", "warning", "weather", `Clima ${weather} não segue o formato WEATHER_* conhecido.`);
  }
}

function auditEdgeWarpTransition(
  input: GameImplementabilityInput,
  issues: ImplementabilityIssue[],
  workspaceContext: ImplementabilityWorkspaceContext | null,
  eventIndex: number,
  point: MapPoint,
) {
  const { map, mapJson } = input;
  if (!mapJson) return;
  const direction = connectionEdgeDirection(map.width, map.height, point);
  const loc = { eventSource: "warp" as const, eventIndex, ...point };
  if (!direction || !isConnectionEdgeWarpPosition(mapJson, map.width, map.height, point)) {
    issue(issues, "WARP_OUT_OF_BOUNDS", "error", "warps", `Warp ${eventIndex} está fora do layout e não pertence à primeira célula de uma conexão válida.`, loc);
    return;
  }

  const anchor = edgeInteriorAnchor(map.width, map.height, point);
  if (!anchor) {
    issue(issues, "WARP_EDGE_ANCHOR_INVALID", "error", "warps", `Warp ${eventIndex} não possui célula interna adjacente válida.`, loc);
    return;
  }
  if ((collisionAt(map, anchor.x, anchor.y) ?? 1) > 0) {
    issue(issues, "WARP_EDGE_ANCHOR_BLOCKED", "error", "warps", `Warp ${eventIndex} está na margem ${direction}, mas a célula interna adjacente (${anchor.x},${anchor.y}) é bloqueada.`, loc);
  }

  const candidates = edgeConnections(mapJson, direction);
  for (const connection of candidates) {
    if (!connection.map || connection.offset === null) continue;
    const neighbor = workspaceContext?.maps[connection.map];
    if (!neighbor) {
      const loadError = workspaceContext?.loadErrors?.[connection.map];
      issue(issues, "WARP_EDGE_NEIGHBOR_UNVERIFIED", "warning", "warps", `Warp ${eventIndex} usa a margem ${direction}, mas ${connection.map} não está disponível para certificar o tile conectado${loadError ? ` (${loadError})` : ""}.`, loc);
      return;
    }
    if (!neighbor.width || !neighbor.height) {
      issue(issues, "WARP_EDGE_GEOMETRY_UNVERIFIED", "warning", "warps", `Warp ${eventIndex}: dimensões de ${connection.map} não estão disponíveis para aplicar offset ${connection.offset}.`, loc);
      return;
    }

    const targetPoint = translateEdgePointToNeighbor(
      direction,
      point,
      connection.offset,
      neighbor.width,
      neighbor.height,
    );
    if (!targetPoint) continue;

    if (!neighbor.map || !neighbor.atlas) {
      const loadError = workspaceContext?.loadErrors?.[connection.map];
      issue(issues, "WARP_EDGE_TILE_UNVERIFIED", "warning", "warps", `Warp ${eventIndex} corresponde a ${connection.map} (${targetPoint.x},${targetPoint.y}), mas map.bin/behavior do vizinho não pôde ser certificado${loadError ? ` (${loadError})` : ""}.`, loc);
      return;
    }

    const targetState = cellPassability(
      neighbor.map,
      targetPoint.x,
      targetPoint.y,
      neighbor.atlas,
    );
    if (targetState.state === "blocked") {
      issue(issues, "WARP_EDGE_TARGET_BLOCKED", "error", "warps", `Warp ${eventIndex} cai em ${connection.map} (${targetPoint.x},${targetPoint.y}) bloqueado: ${targetState.reason}.`, loc);
    } else if (targetState.state === "unknown") {
      issue(issues, "WARP_EDGE_TARGET_UNKNOWN", "warning", "warps", `Warp ${eventIndex} cai em ${connection.map} (${targetPoint.x},${targetPoint.y}), mas o behavior não é certificável: ${targetState.reason}.`, loc);
    } else {
      issue(issues, "WARP_EDGE_TARGET_OK", "info", "warps", `Warp ${eventIndex} na margem ${direction} corresponde a ${connection.map} (${targetPoint.x},${targetPoint.y}) com passagem ${targetState.state} reconhecida pelo engine.`, loc);
    }
    return;
  }

  issue(issues, "WARP_EDGE_CONNECTION_MISMATCH", "error", "warps", `Warp ${eventIndex} está na margem ${direction}, mas nenhuma conexão dessa borda cobre sua coordenada após aplicar o offset.`, loc);
}

function auditEvents(
  input: GameImplementabilityInput,
  issues: ImplementabilityIssue[],
  workspaceContext: ImplementabilityWorkspaceContext | null,
) {
  const { map, mapJson } = input;
  if (!mapJson) return;
  const mapId = text(mapJson.id);

  const warps = array(mapJson.warp_events);
  const warpCells = new Map<string, number[]>();
  warps.forEach((raw, eventIndex) => {
    const entry = record(raw);
    if (!entry) {
      issue(issues, "WARP_NOT_OBJECT", "error", "warps", `Warp ${eventIndex} não é objeto.`, { eventSource: "warp", eventIndex });
      return;
    }
    const point = eventPoint(entry);
    if (!point) {
      issue(issues, "WARP_OUT_OF_BOUNDS", "error", "warps", `Warp ${eventIndex} não possui coordenadas inteiras válidas.`, { eventSource: "warp", eventIndex });
      return;
    }

    const inside = inBounds(map, point.x, point.y);
    const edge = !inside && isConnectionEdgeWarpPosition(mapJson, map.width, map.height, point);
    if (!inside && !edge) {
      issue(issues, "WARP_OUT_OF_BOUNDS", "error", "warps", `Warp ${eventIndex} está fora do mapa.`, { eventSource: "warp", eventIndex, ...point });
      return;
    }

    const loc = { eventSource: "warp" as const, eventIndex, ...point };
    if (inside && (collisionAt(map, point.x, point.y) ?? 0) > 0) {
      issue(issues, "WARP_BLOCKED", "error", "warps", `Warp ${eventIndex} está sobre collision > 0.`, loc);
    } else if (edge) {
      auditEdgeWarpTransition(input, issues, workspaceContext, eventIndex, point);
    }

    const destMap = text(entry.dest_map);
    const destWarp = integerLike(entry.dest_warp_id);
    if (!destMap) issue(issues, "WARP_DEST_MAP_INVALID", "error", "warps", `Warp ${eventIndex} não possui dest_map válido.`, loc);
    if (destWarp === null) issue(issues, "WARP_DEST_ID_INVALID", "error", "warps", `Warp ${eventIndex} possui dest_warp_id inválido (${String(entry.dest_warp_id)}).`, loc);

    const key = `${point.x},${point.y}`;
    const current = warpCells.get(key) ?? [];
    current.push(eventIndex);
    warpCells.set(key, current);

    if (!destMap || destWarp === null) return;

    if (destMap === "MAP_DYNAMIC") {
      issue(issues, "WARP_DYNAMIC_DEST_OK", "info", "warps", `Warp ${eventIndex} usa MAP_DYNAMIC; o engine ignora dest_warp_id e resolve o destino pelo dynamicWarp salvo.`, loc);
      return;
    }

    const target = workspaceContext?.maps[destMap];
    if (!target) {
      const loadError = workspaceContext?.loadErrors?.[destMap];
      issue(
        issues,
        "WARP_DEST_UNVERIFIED",
        "warning",
        "warps",
        `Destino ${destMap} não está disponível no contexto do Workspace${loadError ? ` (${loadError})` : ""}; warp ${eventIndex} não pôde ser verificado de ponta a ponta.`,
        loc,
      );
      return;
    }

    if (destWarp === -1) {
      issue(issues, "WARP_DEST_COORDINATE_MODE", "info", "warps", `Warp ${eventIndex} usa WARP_ID_NONE/-1 para ${destMap}; mapa de destino existe e o modo especial por coordenadas foi preservado.`, loc);
      return;
    }

    const targetWarps = array(target.mapJson.warp_events);
    if (destWarp < 0 || destWarp >= targetWarps.length || !record(targetWarps[destWarp])) {
      issue(issues, "WARP_DEST_NOT_FOUND", "error", "warps", `Destino ${destMap} warp ${destWarp} não existe.`, loc);
      return;
    }

    if (mapId) {
      const back = record(targetWarps[destWarp]);
      const backMap = back ? text(back.dest_map) : null;
      const backWarp = back ? integerLike(back.dest_warp_id) : null;
      if (backMap === mapId && backWarp === eventIndex) {
        issue(issues, "WARP_RECIPROCAL_OK", "info", "warps", `Warp ${eventIndex} possui retorno recíproco em ${destMap}.`, loc);
      } else {
        issue(issues, "WARP_RETURN_NONRECIPROCAL", "warning", "warps", `Warp ${eventIndex} chega a ${destMap}:${destWarp}, mas o retorno não aponta exatamente para ${mapId}:${eventIndex}; pode ser intencional, revise.`, loc);
      }
    }
  });

  for (const [cell, indexes] of warpCells) {
    if (indexes.length > 1) {
      issue(issues, "WARP_DUPLICATE_CELL", "warning", "warps", `Warps ${indexes.join(", ")} compartilham a célula ${cell}; confirme que a sobreposição é intencional.`);
    }
  }

  const objects = array(mapJson.object_events);
  const objectCells = new Map<string, number[]>();
  objects.forEach((raw, eventIndex) => {
    const entry = record(raw);
    if (!entry) {
      issue(issues, "NPC_NOT_OBJECT", "error", "npcs", `Object event ${eventIndex} não é objeto.`, { eventSource: "object", eventIndex });
      return;
    }
    const point = eventPoint(entry);
    if (!point || !inBounds(map, point.x, point.y)) {
      issue(issues, "NPC_OUT_OF_BOUNDS", "error", "npcs", `NPC ${eventIndex} está fora do mapa.`, { eventSource: "object", eventIndex, ...(point ?? {}) });
      return;
    }
    const loc = { eventSource: "object" as const, eventIndex, ...point };
    if ((collisionAt(map, point.x, point.y) ?? 0) > 0) {
      issue(issues, "NPC_BLOCKED", "error", "npcs", `NPC ${eventIndex} (${String(entry.local_id ?? entry.graphics_id ?? "sem id")}) nasce sobre collision > 0.`, loc);
    }

    const rangeX = integer(entry.movement_range_x);
    const rangeY = integer(entry.movement_range_y);
    if (rangeX === null || rangeY === null || rangeX < 0 || rangeY < 0) {
      issue(issues, "NPC_MOVEMENT_RANGE_INVALID", "error", "npcs", `NPC ${eventIndex} possui movement_range_x/y inválido.`, loc);
    } else {
      const minX = point.x - rangeX;
      const maxX = point.x + rangeX;
      const minY = point.y - rangeY;
      const maxY = point.y + rangeY;
      if (minX < 0 || minY < 0 || maxX >= map.width || maxY >= map.height) {
        issue(issues, "NPC_MOVEMENT_RANGE_BOUNDS", "error", "npcs", `Range do NPC ${eventIndex} (${rangeX},${rangeY}) ultrapassa os limites do mapa.`, loc);
      } else if (rangeX > 0 || rangeY > 0) {
        let blocked = 0;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if ((collisionAt(map, x, y) ?? 0) > 0) blocked++;
          }
        }
        if (blocked) {
          issue(issues, "NPC_MOVEMENT_RANGE_BLOCKS", "warning", "npcs", `Range retangular do NPC ${eventIndex} inclui ${blocked} célula(s) bloqueada(s); o movement_type pode restringir o percurso, então revise visualmente.`, loc);
        }
      }
    }

    const key = `${point.x},${point.y}`;
    const current = objectCells.get(key) ?? [];
    current.push(eventIndex);
    objectCells.set(key, current);
  });

  for (const [cell, indexes] of objectCells) {
    if (indexes.length > 1) {
      issue(issues, "NPC_SHARED_CELL", "warning", "npcs", `NPCs ${indexes.join(", ")} compartilham ${cell}. Flags podem torná-los mutuamente exclusivos; confirme na história/scripts.`);
    }
  }

  for (const source of ["coord_events", "bg_events"] as const) {
    const eventSource = source === "coord_events" ? ("coord" as const) : ("bg" as const);
    const seenCells = new Map<string, number[]>();
    array(mapJson[source]).forEach((raw, eventIndex) => {
      const entry = record(raw);
      if (!entry) {
        issue(issues, "TRIGGER_NOT_OBJECT", "error", "triggers", `${source}[${eventIndex}] não é objeto.`, { eventSource, eventIndex });
        return;
      }
      const point = eventPoint(entry);
      if (!point || !inBounds(map, point.x, point.y)) {
        issue(issues, "TRIGGER_OUT_OF_BOUNDS", "error", "triggers", `${source}[${eventIndex}] está fora do mapa.`, { eventSource, eventIndex, ...(point ?? {}) });
        return;
      }
      const key = `${point.x},${point.y}`;
      const current = seenCells.get(key) ?? [];
      current.push(eventIndex);
      seenCells.set(key, current);

      if (eventSource === "bg") {
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
        const accessible = neighbours.some(([dx, dy]) => {
          const x = point.x + dx;
          const y = point.y + dy;
          return inBounds(map, x, y) && (collisionAt(map, x, y) ?? 1) === 0;
        });
        if (!accessible) {
          issue(issues, "BG_NO_ADJACENT_ACCESS", "warning", "triggers", `BG event ${eventIndex} não possui vizinho collision=0 para interação evidente.`, { eventSource, eventIndex, ...point });
        }
      }
    });
    for (const [cell, indexes] of seenCells) {
      if (indexes.length > 1) {
        issue(issues, "TRIGGER_DUPLICATE_CELL", "warning", "triggers", `${source}: eventos ${indexes.join(", ")} compartilham a célula ${cell}; revise flags/variáveis.`);
      }
    }
  }
}

function connectionOverlapBorder(
  map: MapData,
  direction: string,
  offset: number,
  neighbor: WorkspaceAuditMap,
): { cells: MapPoint[]; dimensionKnown: boolean } {
  const border = borderCells(map.width, map.height, direction);
  const destinationAxisSize = direction === "up" || direction === "down"
    ? neighbor.width
    : neighbor.height;
  if (!destinationAxisSize || destinationAxisSize <= 0) {
    return { cells: border, dimensionKnown: false };
  }
  return {
    cells: border.filter((point) => {
      const coordinate = direction === "up" || direction === "down" ? point.x : point.y;
      const destinationCoordinate = coordinate - offset;
      return destinationCoordinate >= 0 && destinationCoordinate < destinationAxisSize;
    }),
    dimensionKnown: true,
  };
}

function auditConnections(
  input: GameImplementabilityInput,
  issues: ImplementabilityIssue[],
  workspaceContext: ImplementabilityWorkspaceContext | null,
) {
  const { map, mapJson, atlas } = input;
  if (!mapJson) return;
  const currentMapId = text(mapJson.id);
  const connections = array(mapJson.connections);
  const grid = buildPassabilityGrid(map, atlas ?? null);
  const seen = new Set<string>();

  connections.forEach((raw, index) => {
    const entry = record(raw);
    if (!entry) {
      issue(issues, "CONNECTION_NOT_OBJECT", "error", "connections", `Conexão ${index} não é objeto.`);
      return;
    }
    const direction = text(entry.direction);
    const destMap = text(entry.map);
    const offset = integer(entry.offset);
    if (!direction || !VALID_CONNECTION_DIRECTIONS.has(direction)) {
      issue(issues, "CONNECTION_DIRECTION_INVALID", "error", "connections", `Conexão ${index}: direção inválida (${String(entry.direction)}).`);
      return;
    }
    if (!destMap || !destMap.startsWith("MAP_")) {
      issue(issues, "CONNECTION_MAP_INVALID", "error", "connections", `Conexão ${index}: destino inválido (${String(entry.map)}).`);
    }
    if (offset === null) {
      issue(issues, "CONNECTION_OFFSET_INVALID", "error", "connections", `Conexão ${index}: offset precisa ser inteiro.`);
    }

    const signature = `${direction}|${destMap}|${offset}`;
    if (seen.has(signature)) {
      issue(issues, "CONNECTION_DUPLICATE", "warning", "connections", `Conexão ${index} duplica direção/destino/offset de outra conexão.`);
    }
    seen.add(signature);

    const neighbor = destMap ? workspaceContext?.maps[destMap] : undefined;

    if (BORDER_CONNECTION_DIRECTIONS.has(direction)) {
      const baseBorder = borderCells(map.width, map.height, direction);
      let relevantBorder = baseBorder;
      if (offset !== null && neighbor) {
        const overlap = connectionOverlapBorder(map, direction, offset, neighbor);
        relevantBorder = overlap.cells;
        if (!overlap.dimensionKnown) {
          issue(issues, "CONNECTION_GEOMETRY_UNVERIFIED", "warning", "connections", `Conexão ${index} (${direction}) tem vizinho carregado, mas a dimensão do layout de ${destMap} não está disponível; o intervalo do offset não pôde ser certificado.`);
        } else if (!relevantBorder.length) {
          issue(issues, "CONNECTION_GEOMETRY_NO_OVERLAP", "error", "connections", `Conexão ${index} (${direction}, offset ${offset}) não sobrepõe nenhuma coordenada da borda com ${destMap}.`);
        }
      } else if (!neighbor) {
        issue(issues, "CONNECTION_GEOMETRY_UNVERIFIED", "warning", "connections", `Conexão ${index} (${direction}) não teve a geometria do offset certificada porque o mapa vizinho não está carregado.`);
      }

      if (relevantBorder.length) {
        const states = relevantBorder.map((point) => grid.at(point.x, point.y));
        const nonBlocked = states.filter((state) => state !== "blocked").length;
        const strict = states.filter((state) => state === "passable").length;
        const conditional = states.filter((state) => state === "conditional").length;
        if (!nonBlocked) {
          issue(issues, "CONNECTION_BORDER_CLOSED", "error", "connections", `Conexão ${direction} não possui célula não-bloqueada no intervalo de borda atingido pelo offset.`);
        } else if (!strict && conditional > 0) {
          issue(issues, "CONNECTION_BORDER_CONDITIONAL_OK", "info", "connections", `Conexão ${direction} depende de ${conditional} abertura(s) condicional(is) reconhecida(s) pelo engine (por exemplo água/corrente), sem exigir behavior desconhecido.`);
        } else if (!strict) {
          issue(issues, "CONNECTION_BORDER_UNKNOWN", "warning", "connections", `Conexão ${direction} possui ${nonBlocked} abertura(s), mas todas dependem de behavior desconhecido no auditor.`);
        }
      }
    } else {
      issue(issues, "CONNECTION_SPECIAL_VERTICAL", "info", "connections", `Conexão ${direction} é especial (Dive/Emerge): não possui borda 2D convencional; destino e reciprocidade serão verificados.`);
    }

    if (!destMap || !currentMapId) return;
    if (!neighbor) {
      const loadError = workspaceContext?.loadErrors?.[destMap];
      issue(issues, "CONNECTION_NEIGHBOR_UNVERIFIED", "warning", "connections", `Mapa vizinho ${destMap} não está disponível no contexto${loadError ? ` (${loadError})` : ""}; reciprocidade não pôde ser confirmada.`);
      return;
    }

    const reciprocalCandidates = array(neighbor.mapJson.connections).flatMap((candidate) => {
      const connection = record(candidate);
      if (
        !connection ||
        text(connection.map) !== currentMapId ||
        text(connection.direction) !== OPPOSITE_DIRECTION[direction]
      ) {
        return [];
      }
      return [connection];
    });

    if (!reciprocalCandidates.length) {
      issue(issues, "CONNECTION_RECIPROCAL_MISSING", "error", "connections", `${destMap} não possui conexão ${OPPOSITE_DIRECTION[direction]} de volta para ${currentMapId}.`);
      return;
    }

    if (offset === null) return;
    if (BORDER_CONNECTION_DIRECTIONS.has(direction)) {
      const reciprocalOffsets = reciprocalCandidates
        .map((connection) => integer(connection.offset))
        .filter((value): value is number => value !== null);
      if (!reciprocalOffsets.includes(-offset)) {
        issue(
          issues,
          "CONNECTION_RECIPROCAL_OFFSET_MISMATCH",
          "error",
          "connections",
          `${destMap} retorna para ${currentMapId}, mas nenhum offset recíproco é ${-offset}; encontrados: ${reciprocalOffsets.length ? reciprocalOffsets.join(", ") : "inválidos"}.`,
        );
        return;
      }
      issue(issues, "CONNECTION_RECIPROCAL_OK", "info", "connections", `${direction} offset ${offset} ↔ ${destMap} ${OPPOSITE_DIRECTION[direction]} offset ${-offset} verificados.`);
    } else {
      issue(issues, "CONNECTION_RECIPROCAL_OK", "info", "connections", `${direction} ↔ ${destMap} ${OPPOSITE_DIRECTION[direction]} verificados; offset especial preservado.`);
    }
  });
}

function componentStats(grid: PassabilityGrid, labels: Int32Array) {
  const stats = new Map<number, { size: number; strict: number }>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] ?? -1;
    if (label < 0) continue;
    const current = stats.get(label) ?? { size: 0, strict: 0 };
    current.size++;
    if (grid.states[i] === "passable") current.strict++;
    stats.set(label, current);
  }
  return stats;
}

/** Prioriza solo confirmado e usa o tamanho da componente como desempate. */
function mainComponent(grid: PassabilityGrid, labels: Int32Array): number {
  const stats = componentStats(grid, labels);
  let best = -1;
  let bestStrict = -1;
  let bestSize = -1;
  for (const [label, value] of stats) {
    if (value.strict > bestStrict || (value.strict === bestStrict && value.size > bestSize)) {
      best = label;
      bestStrict = value.strict;
      bestSize = value.size;
    }
  }
  return best;
}

function connectionOpeningIndexes(
  map: MapData,
  entry: Record<string, unknown>,
  states: Passability[],
  workspaceContext: ImplementabilityWorkspaceContext | null,
): number[] {
  const direction = text(entry.direction);
  if (!direction || !BORDER_CONNECTION_DIRECTIONS.has(direction)) return [];

  const destMap = text(entry.map);
  const offset = integer(entry.offset);
  const neighbor = destMap ? workspaceContext?.maps[destMap] : undefined;
  const cells = offset !== null && neighbor
    ? connectionOverlapBorder(map, direction, offset, neighbor).cells
    : borderCells(map.width, map.height, direction);

  return cells
    .map((point) => idx(point.x, point.y, map.width))
    .filter((i) => states[i] !== "blocked");
}

function warpAccessPoint(map: MapData, mapJson: EditableMapJson, point: MapPoint): MapPoint | null {
  if (inBounds(map, point.x, point.y)) return point;
  if (!isConnectionEdgeWarpPosition(mapJson, map.width, map.height, point)) return null;
  return edgeInteriorAnchor(map.width, map.height, point);
}

function auditAccessibility(
  input: GameImplementabilityInput,
  issues: ImplementabilityIssue[],
  workspaceContext: ImplementabilityWorkspaceContext | null,
) {
  const { map, mapJson, atlas } = input;
  if (!mapJson || map.metatiles.length !== map.width * map.height || map.physical.length !== map.width * map.height) return;

  const grid = buildPassabilityGrid(map, atlas ?? null);
  const lenient = connectedComponents(grid, LENIENT_PASSABLE);
  const verified = connectedComponents(grid, VERIFIED_PASSABLE);
  const mainLenient = mainComponent(grid, lenient);
  const mainVerified = mainComponent(grid, verified);

  const criticalIndexes = new Set<number>();
  array(mapJson.warp_events).forEach((raw) => {
    const entry = record(raw);
    const point = entry ? eventPoint(entry) : null;
    const accessPoint = point ? warpAccessPoint(map, mapJson, point) : null;
    if (accessPoint) criticalIndexes.add(idx(accessPoint.x, accessPoint.y, map.width));
  });
  array(mapJson.connections).forEach((raw) => {
    const entry = record(raw);
    if (!entry) return;
    for (const cell of connectionOpeningIndexes(map, entry, grid.states, workspaceContext)) {
      criticalIndexes.add(cell);
    }
  });

  if (criticalIndexes.size && mainLenient < 0) {
    issue(issues, "ACCESS_NO_NAVIGABLE_COMPONENT", "error", "accessibility", "Existem warps/saídas críticas, mas nenhuma componente fisicamente navegável foi encontrada.");
    return;
  }

  if (atlas && criticalIndexes.size && mainVerified < 0) {
    issue(issues, "ACCESS_NO_VERIFIED_COMPONENT", "warning", "accessibility", "Nenhuma componente crítica pôde ser formada apenas com behaviors conhecidos; a acessibilidade depende de estados unknown.");
  }

  array(mapJson.warp_events).forEach((raw, eventIndex) => {
    const entry = record(raw);
    const point = entry ? eventPoint(entry) : null;
    const accessPoint = point ? warpAccessPoint(map, mapJson, point) : null;
    if (!point || !accessPoint) return;
    const cell = idx(accessPoint.x, accessPoint.y, map.width);
    const state = grid.states[cell] ?? "unknown";
    if (state === "blocked") return;

    const lenientLabel = lenient[cell] ?? -1;
    if (lenientLabel < 0 || (mainLenient >= 0 && lenientLabel !== mainLenient)) {
      issue(issues, "ACCESS_WARP_ISOLATED", "error", "accessibility", `Warp ${eventIndex} está isolado da principal componente fisicamente possível.`, { eventSource: "warp", eventIndex, ...point });
      return;
    }

    if (atlas) {
      const verifiedLabel = verified[cell] ?? -1;
      if (verifiedLabel < 0 || (mainVerified >= 0 && verifiedLabel !== mainVerified)) {
        issue(issues, "ACCESS_REQUIRES_UNKNOWN_BEHAVIOR", "warning", "accessibility", `Acesso ao warp ${eventIndex} só foi demonstrado quando behaviors unknown são aceitos; não é possível certificar o caminho integralmente.`, { eventSource: "warp", eventIndex, ...point });
      } else if (state === "conditional") {
        const result = cellPassability(map, accessPoint.x, accessPoint.y, atlas);
        if (isKnownWarpBehavior(result.behavior)) {
          issue(issues, "ACCESS_WARP_ENGINE_BEHAVIOR_OK", "info", "accessibility", `Warp ${eventIndex} usa behavior especial 0x${(result.behavior ?? 0).toString(16)} reconhecido pelo engine.`, { eventSource: "warp", eventIndex, ...point });
        }
      }
    }
  });

  array(mapJson.connections).forEach((raw, connectionIndex) => {
    const entry = record(raw);
    if (!entry) return;
    const direction = text(entry.direction);
    if (!direction || !BORDER_CONNECTION_DIRECTIONS.has(direction)) return;
    const openings = connectionOpeningIndexes(map, entry, grid.states, workspaceContext);
    if (!openings.length || mainLenient < 0) return;
    if (!openings.some((cell) => lenient[cell] === mainLenient)) {
      issue(issues, "ACCESS_CONNECTION_ISOLATED", "error", "accessibility", `Abertura da conexão ${connectionIndex} (${direction}) no intervalo atingido pelo offset não alcança a componente navegável principal.`);
      return;
    }
    if (atlas && mainVerified >= 0 && !openings.some((cell) => verified[cell] === mainVerified)) {
      issue(issues, "ACCESS_CONNECTION_REQUIRES_UNKNOWN", "warning", "accessibility", `Conexão ${connectionIndex} (${direction}) só alcança a componente principal quando behaviors unknown são aceitos.`);
    }
  });

  if (!atlas && criticalIndexes.size) {
    issue(issues, "ACCESS_ATLAS_PARTIAL", "warning", "accessibility", "Pathfinding foi conservador e sem behavior real: somente bloqueios físicos são conclusivos.");
  }
}

function auditRoundTrip(input: GameImplementabilityInput, issues: ImplementabilityIssue[]) {
  const bundle = input.bundle;
  if (!bundle) {
    issue(issues, "ROUNDTRIP_BUNDLE_NOT_PROVIDED", "warning", "roundtrip", "Nenhum Arauna City bundle foi fornecido nesta auditoria; round-trip completo não foi comprovado.");
    return;
  }

  for (const found of verifyBundleIntegrity(bundle)) {
    issue(issues, found.code, "error", "roundtrip", found.message);
  }
  if (issues.some((found) => found.category === "roundtrip" && found.severity === "error")) return;

  try {
    const first = compileCityBundle(bundle);
    if (
      first.map.width !== input.map.width ||
      first.map.height !== input.map.height ||
      !arraysEqual(first.map.metatiles, input.map.metatiles) ||
      !arraysEqual(first.map.physical, input.map.physical) ||
      canonicalJson(first.mapJson) !== canonicalJson(input.mapJson)
    ) {
      issue(issues, "ROUNDTRIP_INPUT_MISMATCH", "error", "roundtrip", "O bundle íntegro não corresponde ao mapa/map.json atualmente auditado.");
      return;
    }

    const reparsed = parseCityBundle(serializeCityBundle(bundle));
    const second = compileCityBundle(reparsed);
    if (
      first.map.width !== second.map.width ||
      first.map.height !== second.map.height ||
      !arraysEqual(first.map.metatiles, second.map.metatiles) ||
      !arraysEqual(first.map.physical, second.map.physical) ||
      canonicalJson(first.mapJson) !== canonicalJson(second.mapJson)
    ) {
      issue(issues, "ROUNDTRIP_SEMANTIC_MISMATCH", "error", "roundtrip", "Serialize → parse → compile alterou mapa ou map.json.");
    } else {
      issue(issues, "ROUNDTRIP_OK", "info", "roundtrip", "Arauna City JSON recompila para o mesmo grid e map.json semântico.");
    }
  } catch (error) {
    issue(issues, "ROUNDTRIP_EXCEPTION", "error", "roundtrip", `Falha no round-trip: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function auditGameImplementability(input: GameImplementabilityInput): GameImplementabilityReport {
  const issues: ImplementabilityIssue[] = [];
  const workspaceContext = resolveWorkspaceContext(input);

  auditGrid(input, issues);
  auditTilesets(input, issues);
  auditMapJson(input, issues);
  auditWeather(input.mapJson, issues);
  auditEvents(input, issues, workspaceContext);
  auditConnections(input, issues, workspaceContext);
  auditAccessibility(input, issues, workspaceContext);
  auditRoundTrip(input, issues);

  const categories = Object.fromEntries(
    CATEGORIES.map((category) => [category, { errors: 0, warnings: 0, info: 0 }]),
  ) as Record<ImplementabilityCategory, ImplementabilityCategorySummary>;
  const counts = { errors: 0, warnings: 0, info: 0 };
  for (const found of issues) {
    if (found.severity === "error") {
      counts.errors++;
      categories[found.category].errors++;
    } else if (found.severity === "warning") {
      counts.warnings++;
      categories[found.category].warnings++;
    } else {
      counts.info++;
      categories[found.category].info++;
    }
  }

  const pass = counts.errors === 0;
  const roundTripOk = issues.some((found) => found.code === "ROUNDTRIP_OK" && found.severity === "info");
  const fullyVerified = Boolean(input.atlas && input.bundle && roundTripOk) && pass && counts.warnings === 0;
  return {
    pass,
    implementable: fullyVerified,
    confidence: fullyVerified ? "full" : "partial",
    fullyVerified,
    issues,
    categories,
    counts,
  };
}
