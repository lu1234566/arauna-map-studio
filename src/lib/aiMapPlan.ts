import {
  MAP_BLUEPRINT_FORMAT,
  compileMapBlueprint,
  type BlueprintCompileResult,
  type BlueprintRoute,
  type MapBlueprint,
} from "./mapBlueprint";
import type { MapTemplate, TemplatePoint } from "./mapTemplate";
import type {
  CardinalDirection,
  MapPattern,
  PatternPort,
} from "./patternLibrary";
import type { SmartPathPreset } from "./smartPath";

export const AI_MAP_PLAN_FORMAT = "arauna-ai-map-plan-v1" as const;

export interface AiPointRef {
  x?: number;
  y?: number;
  structure?: string;
  port?: string;
}

export interface AiStructurePlacement {
  id: string;
  label?: string;
  pattern: string;
  x: number;
  y: number;
}

export interface AiPlanRoute {
  smartPath: string;
  points: AiPointRef[];
  mode?: "add" | "erase";
}

export interface AiWarpPlan {
  label?: string;
  source: AiPointRef;
  destMap: string;
  destWarpId: string;
}

export interface AiConnectionPlan {
  direction: CardinalDirection;
  map: string;
  offset: number;
}

export interface AiMapPlan {
  format: typeof AI_MAP_PLAN_FORMAT;
  name: string;
  category?: string;
  tags?: string[];
  width: number;
  height: number;
  structures: AiStructurePlacement[];
  routes: AiPlanRoute[];
  warps: AiWarpPlan[];
  connections: AiConnectionPlan[];
  notes?: string[];
}

export interface ResolvedWarpPlan extends AiWarpPlan {
  x: number;
  y: number;
}

export interface AiMapCompileResult {
  valid: boolean;
  template: MapTemplate | null;
  blueprint: MapBlueprint | null;
  errors: string[];
  warnings: string[];
  warps: ResolvedWarpPlan[];
  connections: AiConnectionPlan[];
  blueprintResult: BlueprintCompileResult | null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function slug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "estrutura";
}

function resolveByIdNameOrTag<T extends { id: string; name: string; tags?: string[] }>(reference: string, items: T[]) {
  const exactId = items.find((item) => item.id === reference);
  if (exactId) return exactId;
  const key = normalize(reference);
  const exactName = items.filter((item) => normalize(item.name) === key);
  if (exactName.length === 1) return exactName[0]!;
  const tagged = items.filter((item) => (item.tags ?? []).some((tag) => normalize(tag) === key));
  if (tagged.length === 1) return tagged[0]!;
  const contains = items.filter((item) => {
    const haystack = [item.name, ...(item.tags ?? [])].map(normalize).join(" ");
    return haystack.includes(key) || key.includes(normalize(item.name));
  });
  return contains.length === 1 ? contains[0]! : null;
}

function resolveStructure(reference: string, structures: AiStructurePlacement[]) {
  const key = normalize(reference);
  return structures.find((structure) => structure.id === reference)
    ?? structures.find((structure) => normalize(structure.label ?? "") === key)
    ?? structures.find((structure) => normalize(structure.id) === key)
    ?? null;
}

function resolvePort(reference: string | undefined, ports: PatternPort[]) {
  if (!ports.length) return null;
  if (reference) {
    const key = normalize(reference);
    return ports.find((port) => port.id === reference)
      ?? ports.find((port) => normalize(port.name) === key)
      ?? null;
  }
  const entrances = ports.filter((port) => port.kind === "door" || port.kind === "entrance");
  return entrances.length === 1 ? entrances[0]! : null;
}

function validPoint(point: AiPointRef) {
  const absolute = Number.isInteger(point.x) && Number.isInteger(point.y);
  const semantic = Boolean(point.structure?.trim());
  return absolute || semantic;
}

export function resolveAiPoint(
  point: AiPointRef,
  structures: AiStructurePlacement[],
  patterns: MapPattern[],
): { point: TemplatePoint | null; error?: string } {
  if (Number.isInteger(point.x) && Number.isInteger(point.y)) {
    return { point: { x: Number(point.x), y: Number(point.y) } };
  }
  if (!point.structure?.trim()) return { point: null, error: "Ponto sem coordenada nem estrutura." };
  const structure = resolveStructure(point.structure, structures);
  if (!structure) return { point: null, error: `Estrutura “${point.structure}” não encontrada.` };
  const pattern = resolveByIdNameOrTag(structure.pattern, patterns);
  if (!pattern) return { point: null, error: `Pattern “${structure.pattern}” da estrutura ${structure.id} não encontrado.` };
  const port = resolvePort(point.port, pattern.ports ?? []);
  if (!port) {
    return {
      point: null,
      error: point.port
        ? `Acesso “${point.port}” não existe no pattern “${pattern.name}”.`
        : `Pattern “${pattern.name}” não tem uma entrada única cadastrada; informe x/y no prompt ou cadastre um port.`,
    };
  }
  return { point: { x: structure.x + port.x, y: structure.y + port.y } };
}

function sanitizeConnection(value: AiConnectionPlan, index: number, errors: string[]) {
  const directions = new Set<CardinalDirection>(["north", "east", "south", "west"]);
  if (!directions.has(value.direction)) errors.push(`Conexão ${index + 1}: direção inválida.`);
  if (!value.map.trim()) errors.push(`Conexão ${index + 1}: mapa de destino vazio.`);
  if (!Number.isInteger(value.offset)) errors.push(`Conexão ${index + 1}: offset precisa ser inteiro.`);
}

export function compileAiMapPlan(
  plan: AiMapPlan,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
): AiMapCompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const warps: ResolvedWarpPlan[] = [];

  if (plan.format !== AI_MAP_PLAN_FORMAT) errors.push(`Formato inválido: esperado ${AI_MAP_PLAN_FORMAT}.`);
  if (!plan.name.trim()) errors.push("Plano sem nome.");
  if (!Number.isInteger(plan.width) || plan.width < 1 || plan.width > 512) errors.push("width precisa ser inteiro entre 1 e 512.");
  if (!Number.isInteger(plan.height) || plan.height < 1 || plan.height > 512) errors.push("height precisa ser inteiro entre 1 e 512.");

  const ids = new Set<string>();
  const blueprintPatterns = plan.structures.flatMap((structure, index) => {
    if (!structure.id.trim()) {
      errors.push(`Estrutura ${index + 1}: id vazio.`);
      return [];
    }
    if (ids.has(structure.id)) errors.push(`Estrutura ${index + 1}: id duplicado “${structure.id}”.`);
    ids.add(structure.id);
    if (!Number.isInteger(structure.x) || !Number.isInteger(structure.y)) {
      errors.push(`Estrutura ${structure.id}: coordenadas precisam ser inteiras.`);
      return [];
    }
    const pattern = resolveByIdNameOrTag(structure.pattern, patterns);
    if (!pattern) {
      errors.push(`Estrutura ${structure.id}: pattern “${structure.pattern}” não existe ou é ambíguo.`);
      return [];
    }
    return [{ pattern: pattern.id, x: structure.x, y: structure.y }];
  });

  const blueprintRoutes: BlueprintRoute[] = plan.routes.flatMap((route, routeIndex) => {
    if (!route.smartPath.trim()) {
      errors.push(`Rota ${routeIndex + 1}: Smart Path vazio.`);
      return [];
    }
    if (!route.points.length) {
      errors.push(`Rota ${routeIndex + 1}: sem pontos.`);
      return [];
    }
    const points: TemplatePoint[] = [];
    for (const [pointIndex, reference] of route.points.entries()) {
      if (!validPoint(reference)) {
        errors.push(`Rota ${routeIndex + 1}, ponto ${pointIndex + 1}: referência inválida.`);
        continue;
      }
      const resolved = resolveAiPoint(reference, plan.structures, patterns);
      if (!resolved.point) {
        errors.push(`Rota ${routeIndex + 1}, ponto ${pointIndex + 1}: ${resolved.error}`);
        continue;
      }
      points.push(resolved.point);
    }
    if (points.length !== route.points.length) return [];
    return [{ smartPath: route.smartPath, points, mode: route.mode ?? "add" }];
  });

  for (const [index, warp] of plan.warps.entries()) {
    if (!warp.destMap.trim()) errors.push(`Warp ${index + 1}: destMap vazio.`);
    if (!warp.destWarpId.trim()) errors.push(`Warp ${index + 1}: destWarpId vazio.`);
    const resolved = resolveAiPoint(warp.source, plan.structures, patterns);
    if (!resolved.point) {
      errors.push(`Warp ${index + 1}: ${resolved.error}`);
      continue;
    }
    if (resolved.point.x < 0 || resolved.point.y < 0 || resolved.point.x >= plan.width || resolved.point.y >= plan.height) {
      errors.push(`Warp ${index + 1}: (${resolved.point.x},${resolved.point.y}) fora do mapa.`);
      continue;
    }
    warps.push({ ...warp, x: resolved.point.x, y: resolved.point.y });
  }

  plan.connections.forEach((connection, index) => sanitizeConnection(connection, index, errors));
  if (errors.length) {
    return { valid: false, template: null, blueprint: null, errors, warnings, warps, connections: plan.connections, blueprintResult: null };
  }

  const blueprint: MapBlueprint = {
    format: MAP_BLUEPRINT_FORMAT,
    name: plan.name,
    category: plan.category ?? "IA",
    tags: [...(plan.tags ?? []), "ai-plan"],
    width: plan.width,
    height: plan.height,
    patterns: blueprintPatterns,
    routes: blueprintRoutes,
  };
  const blueprintResult = compileMapBlueprint(blueprint, patterns, smartPaths);
  errors.push(...blueprintResult.errors);
  warnings.push(...blueprintResult.warnings, ...(plan.notes ?? []));
  return {
    valid: blueprintResult.valid && errors.length === 0,
    template: blueprintResult.template,
    blueprint,
    errors,
    warnings,
    warps,
    connections: plan.connections,
    blueprintResult,
  };
}

export function parseAiMapPlanJson(source: string): AiMapPlan {
  const raw = JSON.parse(source) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Plano de IA precisa ser um objeto JSON.");
  const structuresRaw = Array.isArray(raw.structures) ? raw.structures : [];
  const routesRaw = Array.isArray(raw.routes) ? raw.routes : [];
  const warpsRaw = Array.isArray(raw.warps) ? raw.warps : [];
  const connectionsRaw = Array.isArray(raw.connections) ? raw.connections : [];
  const parsePoint = (value: unknown): AiPointRef => {
    const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      ...(item.x != null ? { x: Number(item.x) } : {}),
      ...(item.y != null ? { y: Number(item.y) } : {}),
      ...(item.structure != null ? { structure: String(item.structure) } : {}),
      ...(item.port != null ? { port: String(item.port) } : {}),
    };
  };
  return {
    format: String(raw.format ?? "") as typeof AI_MAP_PLAN_FORMAT,
    name: String(raw.name ?? ""),
    category: raw.category == null ? undefined : String(raw.category),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    width: Number(raw.width),
    height: Number(raw.height),
    structures: structuresRaw.map((value, index) => {
      const item = value as Record<string, unknown>;
      return {
        id: String(item.id ?? `structure-${index + 1}`),
        label: item.label == null ? undefined : String(item.label),
        pattern: String(item.pattern ?? ""),
        x: Number(item.x),
        y: Number(item.y),
      };
    }),
    routes: routesRaw.map((value) => {
      const item = value as Record<string, unknown>;
      return {
        smartPath: String(item.smartPath ?? ""),
        mode: item.mode === "erase" ? "erase" : "add",
        points: Array.isArray(item.points) ? item.points.map(parsePoint) : [],
      };
    }),
    warps: warpsRaw.map((value) => {
      const item = value as Record<string, unknown>;
      return {
        label: item.label == null ? undefined : String(item.label),
        source: parsePoint(item.source),
        destMap: String(item.destMap ?? ""),
        destWarpId: String(item.destWarpId ?? "0"),
      };
    }),
    connections: connectionsRaw.map((value) => {
      const item = value as Record<string, unknown>;
      return {
        direction: String(item.direction ?? "north") as CardinalDirection,
        map: String(item.map ?? ""),
        offset: Number(item.offset ?? 0),
      };
    }),
    notes: Array.isArray(raw.notes) ? raw.notes.map(String) : [],
  };
}

function parsePrecisePoint(token: string): AiPointRef | null {
  const coordinate = token.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  if (coordinate) return { x: Number(coordinate[1]), y: Number(coordinate[2]) };
  const semantic = token.match(/(?:porta|entrada|acesso)\s+["“]?([^"”.]+)["”]?\s*[.:/]\s*["“]?([^"”]+)["”]?/i);
  if (semantic) return { structure: semantic[1]!.trim(), port: semantic[2]!.trim() };
  return null;
}

function directionFromPt(value: string): CardinalDirection | null {
  const key = normalize(value);
  if (["norte", "north", "cima"].includes(key)) return "north";
  if (["leste", "east", "direita"].includes(key)) return "east";
  if (["sul", "south", "baixo"].includes(key)) return "south";
  if (["oeste", "west", "esquerda"].includes(key)) return "west";
  return null;
}

/**
 * Fallback local determinístico para comandos detalhados. Não tenta adivinhar uma cidade
 * inteira; ele reconhece posições/rotas/warps explícitos e deixa linguagem livre para o LLM.
 */
export function parseDetailedMapCommand(
  source: string,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  defaultWidth: number,
  defaultHeight: number,
): { plan: AiMapPlan | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = source.split(/[\n;]+/).map((line) => line.trim()).filter(Boolean);
  let width = defaultWidth;
  let height = defaultHeight;
  let name = "Mapa por comando";
  const dimensions = source.match(/(?:mapa\s*)?(\d+)\s*[x×]\s*(\d+)/i);
  if (dimensions) {
    width = Number(dimensions[1]);
    height = Number(dimensions[2]);
  }
  const quotedName = source.match(/(?:nome|mapa)\s*[:=]\s*["“]([^"”]+)["”]/i);
  if (quotedName) name = quotedName[1]!.trim();

  const structures: AiStructurePlacement[] = [];
  const routes: AiPlanRoute[] = [];
  const warps: AiWarpPlan[] = [];
  const connections: AiConnectionPlan[] = [];

  for (const line of lines) {
    const structureMatch = line.match(/^(?:estrutura|structure)\s+["“]?(.+?)["”]?\s+(?:usar|usa|usando|=)\s+["“](.+?)["”]\s+(?:em|at)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i);
    if (structureMatch) {
      const label = structureMatch[1]!.trim();
      const patternRef = structureMatch[2]!.trim();
      const pattern = resolveByIdNameOrTag(patternRef, patterns);
      if (!pattern) errors.push(`Estrutura “${label}”: pattern “${patternRef}” não encontrado de forma única.`);
      structures.push({
        id: `${slug(label)}-${structures.length + 1}`,
        label,
        pattern: pattern?.id ?? patternRef,
        x: Number(structureMatch[3]),
        y: Number(structureMatch[4]),
      });
      continue;
    }

    const routeMatch = line.match(/^(?:rota|caminho|estrada)\s+["“](.+?)["”]\s*:\s*(.+)$/i);
    if (routeMatch) {
      const pathRef = routeMatch[1]!.trim();
      const preset = resolveByIdNameOrTag(pathRef, smartPaths);
      const points = routeMatch[2]!.split(/\s*->\s*/).map(parsePrecisePoint).filter((point): point is AiPointRef => Boolean(point));
      if (!preset) errors.push(`Rota: Smart Path “${pathRef}” não encontrado de forma única.`);
      if (points.length < 1) errors.push(`Rota “${pathRef}” não contém pontos reconhecíveis.`);
      routes.push({ smartPath: preset?.id ?? pathRef, points, mode: "add" });
      continue;
    }

    const warpMatch = line.match(/^warp\s+(.+?)\s*->\s*([A-Z0-9_]+)(?::([^\s]+))?/i);
    if (warpMatch) {
      const point = parsePrecisePoint(warpMatch[1]!);
      if (!point) errors.push(`Warp: origem não reconhecida em “${warpMatch[1]}”.`);
      else warps.push({ source: point, destMap: warpMatch[2]!, destWarpId: warpMatch[3] ?? "0" });
      continue;
    }

    const connectionMatch = line.match(/^(?:saida|saída|conexao|conexão)\s+(norte|sul|leste|oeste|north|south|east|west)\s*(?:em\s*\([^)]*\)\s*)?->\s*([A-Z0-9_]+)(?:\s+offset\s+(-?\d+))?/i);
    if (connectionMatch) {
      const direction = directionFromPt(connectionMatch[1]!);
      if (direction) connections.push({ direction, map: connectionMatch[2]!, offset: Number(connectionMatch[3] ?? 0) });
      continue;
    }
  }

  if (!structures.length && !routes.length && !warps.length && !connections.length) {
    errors.push("O interpretador local não encontrou comandos estruturados. Use o modo IA para linguagem livre ou escreva linhas com estrutura/rota/warp/saída.");
  }
  const plan: AiMapPlan = {
    format: AI_MAP_PLAN_FORMAT,
    name,
    category: "Prompt",
    tags: ["prompt", "precise"],
    width,
    height,
    structures,
    routes,
    warps,
    connections,
    notes: warnings,
  };
  return { plan: errors.length ? null : plan, errors, warnings };
}

export function aiPlanContract(patterns: MapPattern[], smartPaths: SmartPathPreset[], width: number, height: number) {
  const patternList = patterns.map((pattern) => {
    const ports = (pattern.ports ?? []).map((port) => `${port.id}:${port.name}@(${port.x},${port.y})/${port.kind}${port.direction ? `/${port.direction}` : ""}`).join(", ");
    return `- ${pattern.name} [id=${pattern.id}, ${pattern.width}x${pattern.height}, tags=${pattern.tags.join("|") || "-"}, ports=${ports || "nenhum"}]`;
  }).join("\n") || "- nenhum pattern";
  const pathList = smartPaths.map((preset) => `- ${preset.name} [id=${preset.id}]`).join("\n") || "- nenhum Smart Path";
  return `Você planeja mapas de Pokémon Emerald para Juramento de Arauna. O mapa atual mede ${width}x${height} metatiles. Use SOMENTE os Patterns e Smart Paths abaixo. Não invente IDs, nomes ou tiles. Coordenadas têm origem (0,0) no canto superior esquerdo. Estruturas usam x/y do canto superior esquerdo. Para uma porta, prefira {"structure":"id-ou-label","port":"id-ou-nome"} quando o port existir; se não existir, use coordenada absoluta {"x":N,"y":N}. Rotas precisam ser ortogonais. Warps devem apontar para destMap real informado pelo usuário; nunca invente destinos. Conexões de borda só devem ser criadas se o usuário pedir explicitamente. Preserve exatamente posições/direções dadas pelo usuário e só estime quando ele não especificar.\n\nPATTERNS:\n${patternList}\n\nSMART PATHS:\n${pathList}`;
}
