import { parseAiMapPlanJson, type AiMapPlan } from "./aiMapPlan";

const COLLECTION_KEYS = ["structures", "routes", "warps", "connections"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCollection(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (isRecord(value)) {
    // Modelos às vezes devolvem um único item em vez de uma lista.
    // Um objeto vazio significa "nenhum item"; um objeto preenchido vira lista de 1 item.
    return Object.keys(value).length ? [value] : [];
  }
  throw new Error(`A IA retornou “${key}” em formato inválido; esperado uma lista JSON.`);
}

/**
 * Normaliza pequenas variações comuns de provedores de IA antes de entregar o
 * plano ao compilador. Nunca inventa conteúdo: apenas converte item único -> lista
 * e campo ausente/objeto vazio -> lista vazia.
 */
export function parseAiProviderPlan(source: string): AiMapPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`A IA retornou JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) throw new Error("A IA precisa retornar um objeto JSON na raiz.");

  const normalized: Record<string, unknown> = { ...parsed };
  for (const key of COLLECTION_KEYS) normalized[key] = normalizeCollection(parsed[key], key);

  const notes = parsed["notes"];
  if (Array.isArray(notes)) normalized["notes"] = notes;
  else if (notes == null || (isRecord(notes) && Object.keys(notes).length === 0)) normalized["notes"] = [];
  else if (typeof notes === "string") normalized["notes"] = [notes];
  else throw new Error("A IA retornou “notes” em formato inválido; esperado texto ou lista de textos.");

  return parseAiMapPlanJson(JSON.stringify(normalized));
}
