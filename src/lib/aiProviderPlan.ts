import { AI_MAP_PLAN_FORMAT, parseAiMapPlanJson, type AiMapPlan } from "./aiMapPlan";

const COLLECTION_KEYS = ["structures", "routes", "warps", "connections"] as const;

export interface AiProviderPatternPortRef {
  id: string;
  name: string;
  kind: "door" | "entrance" | "exit" | "connection";
  x: number;
  y: number;
  direction?: "north" | "east" | "south" | "west";
}

export interface AiProviderPatternRef {
  id: string;
  name: string;
  tags?: string[];
  ports?: AiProviderPatternPortRef[];
}

export interface AiProviderPlanDefaults {
  width?: number;
  height?: number;
  name?: string;
  prompt?: string;
  patterns?: AiProviderPatternRef[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeCollection(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (isRecord(value)) {
    return Object.keys(value).length ? [value] : [];
  }
  throw new Error(`A IA retornou “${key}” em formato inválido; esperado uma lista JSON.`);
}

function firstNonEmptyString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function positiveInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function patternScore(
  structure: Record<string, unknown>,
  pattern: AiProviderPatternRef,
  prompt: string,
) {
  const cues = [
    firstNonEmptyString(structure, ["label"]),
    firstNonEmptyString(structure, ["name"]),
    firstNonEmptyString(structure, ["id"]),
  ].filter(Boolean).map(normalizeText);
  const patternId = normalizeText(pattern.id);
  const patternName = normalizeText(pattern.name);
  const tags = (pattern.tags ?? []).map(normalizeText).filter(Boolean);
  const promptKey = normalizeText(prompt);
  let score = 0;

  for (const cue of cues) {
    if (cue === patternId || cue === patternName || tags.includes(cue)) score += 120;
    if (cue.length >= 4 && (patternName.includes(cue) || cue.includes(patternName))) score += 45;
    for (const tag of tags) {
      if (tag.length >= 4 && (cue.includes(tag) || tag.includes(cue))) score += 30;
    }
  }

  if (patternName && promptKey.includes(patternName)) score += 25;
  if (patternId && promptKey.includes(patternId)) score += 25;
  return score;
}

function reconcilePattern(
  structure: Record<string, unknown>,
  defaults: AiProviderPlanDefaults,
) {
  const direct = firstNonEmptyString(structure, [
    "pattern",
    "patternId",
    "pattern_id",
    "patternName",
    "pattern_name",
  ]);
  if (direct) return direct;

  const patterns = defaults.patterns ?? [];
  if (!patterns.length) return "";
  const scored = patterns
    .map((pattern) => ({ pattern, score: patternScore(structure, pattern, defaults.prompt ?? "") }))
    .filter((candidate) => candidate.score >= 60)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return "";
  const second = scored[1];
  if (second && second.score === best.score) return "";
  return best.pattern.id;
}

function reconcileStructure(value: unknown, defaults: AiProviderPlanDefaults) {
  if (!isRecord(value)) return value;
  const pattern = reconcilePattern(value, defaults);
  return pattern ? { ...value, pattern } : value;
}

function sourceIsUsable(value: unknown) {
  if (!isRecord(value)) return false;
  const hasAbsolute = Number.isInteger(Number(value["x"])) && Number.isInteger(Number(value["y"]));
  const hasSemantic = typeof value["structure"] === "string" && value["structure"].trim().length > 0;
  return hasAbsolute || hasSemantic;
}

function structureCues(structure: Record<string, unknown>) {
  return [
    firstNonEmptyString(structure, ["label"]),
    firstNonEmptyString(structure, ["name"]),
    firstNonEmptyString(structure, ["id"]),
  ].filter((value, index, values) => value.length >= 4 && values.indexOf(value) === index);
}

function nearestStructureBeforeDestination(
  destination: string,
  structures: unknown[],
  prompt: string,
) {
  const promptKey = prompt.toLocaleLowerCase("pt-BR");
  const destinationIndex = promptKey.indexOf(destination.toLocaleLowerCase("pt-BR"));
  if (destinationIndex < 0) return null;

  const candidates = structures.flatMap((value) => {
    if (!isRecord(value)) return [];
    let nearest = -1;
    for (const cue of structureCues(value)) {
      const position = promptKey.lastIndexOf(cue.toLocaleLowerCase("pt-BR"), destinationIndex);
      if (position > nearest) nearest = position;
    }
    if (nearest < 0) return [];
    return [{ structure: value, distance: destinationIndex - nearest }];
  }).filter((candidate) => candidate.distance <= 2200)
    .sort((a, b) => a.distance - b.distance);

  const best = candidates[0];
  if (!best) return null;
  const second = candidates[1];
  if (second && second.distance === best.distance) return null;
  return best.structure;
}

function resolveUniqueEntrancePort(patternReference: string, defaults: AiProviderPlanDefaults) {
  const key = normalizeText(patternReference);
  const pattern = (defaults.patterns ?? []).find((candidate) => {
    return normalizeText(candidate.id) === key || normalizeText(candidate.name) === key;
  });
  if (!pattern) return null;
  const ports = pattern.ports ?? [];
  const exactId = ports.filter((port) => normalizeText(port.id) === "entrada");
  if (exactId.length === 1) return exactId[0]!;
  const exactName = ports.filter((port) => normalizeText(port.name) === "entrada");
  if (exactName.length === 1) return exactName[0]!;
  const entrances = ports.filter((port) => port.kind === "door" || port.kind === "entrance");
  return entrances.length === 1 ? entrances[0]! : null;
}

function reconcileWarpSource(
  value: unknown,
  structures: unknown[],
  defaults: AiProviderPlanDefaults,
) {
  if (!isRecord(value) || sourceIsUsable(value["source"])) return value;
  const destination = firstNonEmptyString(value, ["destMap", "dest_map"]);
  const prompt = defaults.prompt ?? "";
  if (!destination || !prompt) return value;

  const structure = nearestStructureBeforeDestination(destination, structures, prompt);
  if (!structure) return value;
  const structureId = firstNonEmptyString(structure, ["id"]);
  const patternReference = firstNonEmptyString(structure, ["pattern"]);
  if (!structureId || !patternReference) return value;
  const port = resolveUniqueEntrancePort(patternReference, defaults);
  if (!port) return value;
  return { ...value, source: { structure: structureId, port: port.id } };
}

/**
 * Normaliza pequenas variações comuns de provedores de IA antes de entregar o
 * plano ao compilador. Além de item único -> lista, reconcilia apenas campos
 * técnicos determinísticos. Warps sem source só são reparados quando destino,
 * estrutura e uma porta de entrada podem ser associados sem ambiguidade ao prompt.
 */
export function parseAiProviderPlan(
  source: string,
  defaults: AiProviderPlanDefaults = {},
): AiMapPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`A IA retornou JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) throw new Error("A IA precisa retornar um objeto JSON na raiz.");

  const normalized: Record<string, unknown> = { ...parsed };
  for (const key of COLLECTION_KEYS) normalized[key] = normalizeCollection(parsed[key], key);
  normalized["structures"] = (normalized["structures"] as unknown[])
    .map((value) => reconcileStructure(value, defaults));
  normalized["warps"] = (normalized["warps"] as unknown[])
    .map((value) => reconcileWarpSource(value, normalized["structures"] as unknown[], defaults));

  const format = typeof parsed["format"] === "string" ? parsed["format"].trim() : "";
  normalized["format"] = format || AI_MAP_PLAN_FORMAT;

  const name = typeof parsed["name"] === "string" ? parsed["name"].trim() : "";
  normalized["name"] = name || defaults.name?.trim() || "Mapa gerado por IA";

  const width = positiveInteger(parsed["width"]);
  const height = positiveInteger(parsed["height"]);
  if (width == null && defaults.width != null) normalized["width"] = defaults.width;
  if (height == null && defaults.height != null) normalized["height"] = defaults.height;

  const notes = parsed["notes"];
  if (Array.isArray(notes)) normalized["notes"] = notes;
  else if (notes == null || (isRecord(notes) && Object.keys(notes).length === 0)) normalized["notes"] = [];
  else if (typeof notes === "string") normalized["notes"] = [notes];
  else throw new Error("A IA retornou “notes” em formato inválido; esperado texto ou lista de textos.");

  return parseAiMapPlanJson(JSON.stringify(normalized));
}
