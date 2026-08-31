/**
 * PixelLab AI — helpers puros e client-safe (NENHUM token aqui).
 *
 * A API oficial (https://api.pixellab.ai/v2) é chamada SOMENTE pelo servidor
 * em src/lib/pixellab.functions.ts, lendo process.env.PIXELLAB_API_TOKEN.
 * Este módulo contém: limites Tier 1, presets, validação de payload e
 * sanitização/normalização defensiva das respostas.
 */

export const PIXELLAB_API_BASE = "https://api.pixellab.ai/v2";
export const PIXELLAB_SECRET_NAME = "PIXELLAB_API_TOKEN";

/** Tier 1: a UI limita a 320×320 mesmo que a API genérica aceite mais. */
export const TIER1_MAX_PX = 320;
export const TIER1_MIN_PX = 32;
/** 20×20 metatiles × 16 px = 320 px — máximo para Init Image no Tier 1. */
export const TIER1_MAX_TILES = 20;
export const INIT_TILE_PX = 16;

export type PixelLabOutline =
  | "single color black outline"
  | "single color outline"
  | "selective outline"
  | "lineless";
export type PixelLabShading =
  | "flat shading"
  | "basic shading"
  | "medium shading"
  | "detailed shading"
  | "highly detailed shading";
export type PixelLabDetail = "low detail" | "medium detail" | "highly detailed";
export type PixelLabView = "side" | "low top-down" | "high top-down";

export const OUTLINE_OPTIONS: PixelLabOutline[] = [
  "selective outline",
  "lineless",
  "single color outline",
  "single color black outline",
];
export const SHADING_OPTIONS: PixelLabShading[] = [
  "flat shading",
  "basic shading",
  "medium shading",
  "detailed shading",
  "highly detailed shading",
];
export const DETAIL_OPTIONS: PixelLabDetail[] = ["low detail", "medium detail", "highly detailed"];

export interface PixelLabPreset {
  id: string;
  label: string;
  /** Texto anexado ao prompt do usuário; nunca o substitui. */
  promptSuffix: string;
}

export const PIXELLAB_PRESETS: PixelLabPreset[] = [
  {
    id: "parana-mata-atlantica",
    label: "Paraná / Mata Atlântica",
    promptSuffix:
      "Atlantic Forest of Paraná Brazil, dense green araucaria pines, lush subtropical vegetation, red clay soil paths, GBA Pokémon Emerald style overworld map",
  },
  {
    id: "amazonia",
    label: "Amazônia",
    promptSuffix:
      "Amazon rainforest, giant trees, dense canopy, dark rivers, stilt houses, GBA Pokémon Emerald style overworld map",
  },
  {
    id: "cerrado",
    label: "Cerrado",
    promptSuffix:
      "Brazilian cerrado savanna, twisted small trees, golden dry grass, termite mounds, red dirt roads, GBA Pokémon Emerald style overworld map",
  },
  {
    id: "caatinga",
    label: "Caatinga",
    promptSuffix:
      "Brazilian caatinga semi-arid, cacti, thorny shrubs, cracked light brown soil, GBA Pokémon Emerald style overworld map",
  },
  {
    id: "pantanal",
    label: "Pantanal",
    promptSuffix:
      "Pantanal wetlands, flooded plains, water lilies, wooden walkways, tall grass islands, GBA Pokémon Emerald style overworld map",
  },
  {
    id: "litoral-mangue",
    label: "Litoral / Mangue",
    promptSuffix:
      "Brazilian coast with mangroves, sandy beach, fishing piers, shallow turquoise water, GBA Pokémon Emerald style overworld map",
  },
  { id: "custom", label: "Personalizado", promptSuffix: "" },
];

export interface PixfluxRequestInput {
  description: string;
  width: number;
  height: number;
  seed?: number | null;
  textGuidanceScale?: number;
  outline?: PixelLabOutline;
  shading?: PixelLabShading;
  detail?: PixelLabDetail;
  view?: PixelLabView;
  /** Base64 puro (sem prefixo data:) de PNG. */
  initImageBase64?: string | null;
  initImageStrength?: number;
  colorImageBase64?: string | null;
}

export class PixelLabValidationError extends Error {}

function isPlainBase64(source: string): boolean {
  return /^[A-Za-z0-9+/=\s]+$/.test(source) && source.replace(/\s/g, "").length % 4 === 0;
}

/** Aceita data URL PNG ou base64 puro; devolve base64 puro. */
export function normalizeBase64Png(source: string): string {
  const trimmed = source.trim();
  const match = /^data:image\/(?:png|webp|jpeg);base64,(.+)$/s.exec(trimmed);
  const body = (match ? match[1] : trimmed).replace(/\s/g, "");
  if (!body || !isPlainBase64(body)) {
    throw new PixelLabValidationError("Imagem inválida: esperado PNG em base64 ou data URL.");
  }
  return body;
}

/**
 * Valida e monta o corpo EXATO enviado a /create-image-pixflux-background.
 * Nunca inclui token. Lança PixelLabValidationError com mensagem clara.
 */
export function buildPixfluxPayload(input: PixfluxRequestInput): Record<string, unknown> {
  const description = input.description.trim();
  if (!description) throw new PixelLabValidationError("O prompt (description) é obrigatório.");
  if (description.length > 4000) {
    throw new PixelLabValidationError("Prompt longo demais (máx. 4000 caracteres).");
  }

  for (const [label, value] of [
    ["largura", input.width],
    ["altura", input.height],
  ] as const) {
    if (!Number.isInteger(value) || value < TIER1_MIN_PX || value > TIER1_MAX_PX) {
      throw new PixelLabValidationError(
        `Tier 1: ${label} deve ser inteiro entre ${TIER1_MIN_PX} e ${TIER1_MAX_PX} px (recebido ${value}).`,
      );
    }
  }

  const guidance = input.textGuidanceScale ?? 8;
  if (!Number.isFinite(guidance) || guidance < 1 || guidance > 20) {
    throw new PixelLabValidationError("text_guidance_scale deve estar entre 1 e 20.");
  }

  const payload: Record<string, unknown> = {
    description,
    image_size: { width: input.width, height: input.height },
    text_guidance_scale: guidance,
    view: input.view ?? "high top-down",
    isometric: false,
    no_background: false,
  };
  if (input.outline) payload.outline = input.outline;
  if (input.shading) payload.shading = input.shading;
  if (input.detail) payload.detail = input.detail;

  if (input.seed != null) {
    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 2 ** 32 - 1) {
      throw new PixelLabValidationError("Seed deve ser inteiro entre 0 e 4294967295.");
    }
    payload.seed = input.seed;
  }

  if (input.initImageBase64) {
    const base64 = normalizeBase64Png(input.initImageBase64);
    // ~4/3 da carga binária; 320×320 RGBA PNG fica muito abaixo disso.
    if (base64.length > 2_000_000) {
      throw new PixelLabValidationError("Init Image grande demais para o Tier 1 (limite 320×320).");
    }
    payload.init_image = { type: "base64", base64 };
    const strength = input.initImageStrength ?? 300;
    if (!Number.isInteger(strength) || strength < 1 || strength > 999) {
      throw new PixelLabValidationError("init_image_strength deve ser inteiro entre 1 e 999.");
    }
    payload.init_image_strength = strength;
  }

  if (input.colorImageBase64) {
    const base64 = normalizeBase64Png(input.colorImageBase64);
    if (base64.length > 500_000) {
      throw new PixelLabValidationError("color_image grande demais.");
    }
    payload.color_image = { type: "base64", base64 };
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Sanitização de respostas (defensiva; nunca repassa headers/token)
// ---------------------------------------------------------------------------

export type PixelLabJobPhase = "pending" | "in_progress" | "completed" | "failed" | "unknown";

export interface SanitizedUsage {
  type?: string;
  usd?: number;
  raw?: Record<string, number | string>;
}

export interface SanitizedJob {
  jobId: string;
  phase: PixelLabJobPhase;
  /** data URL pronto para <img>, presente só quando completed. */
  imageDataUrl?: string;
  usage?: SanitizedUsage;
  errorMessage?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function sanitizeUsage(value: unknown): SanitizedUsage | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const usage: SanitizedUsage = {};
  if (typeof record.type === "string") usage.type = record.type;
  if (typeof record.usd === "number" && Number.isFinite(record.usd)) usage.usd = record.usd;
  const raw: Record<string, number | string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (key === "type" || key === "usd") continue;
    if (typeof entry === "number" && Number.isFinite(entry)) raw[key] = entry;
    else if (typeof entry === "string" && entry.length <= 120) raw[key] = entry;
  }
  if (Object.keys(raw).length) usage.raw = raw;
  return Object.keys(usage).length ? usage : undefined;
}

export function normalizeJobPhase(status: unknown): PixelLabJobPhase {
  if (typeof status !== "string") return "unknown";
  const value = status.toLowerCase();
  if (value === "completed" || value === "complete" || value === "succeeded") return "completed";
  if (value === "failed" || value === "error" || value === "cancelled") return "failed";
  if (value === "in_progress" || value === "processing" || value === "running") return "in_progress";
  if (value === "pending" || value === "queued" || value === "created") return "pending";
  return "unknown";
}

/** Normaliza GET /background-jobs/{id}. Nunca inclui token/headers. */
export function sanitizeJobResponse(jobId: string, body: unknown): SanitizedJob {
  const record = asRecord(body) ?? {};
  const phase = normalizeJobPhase(record.status);
  const job: SanitizedJob = { jobId, phase };

  const lastResponse = asRecord(record.last_response);
  if (phase === "completed" && lastResponse) {
    const image = asRecord(lastResponse.image);
    const base64 = typeof image?.base64 === "string" ? image.base64 : null;
    if (base64) job.imageDataUrl = `data:image/png;base64,${base64.replace(/\s/g, "")}`;
    const usage = sanitizeUsage(lastResponse.usage);
    if (usage) job.usage = usage;
  }
  if (phase === "failed") {
    const detail =
      (typeof record.error === "string" && record.error) ||
      (typeof lastResponse?.detail === "string" && lastResponse.detail) ||
      (typeof record.detail === "string" && record.detail) ||
      "O job PixelLab falhou sem detalhe adicional.";
    job.errorMessage = String(detail).slice(0, 500);
  }
  if (phase === "completed" && !job.imageDataUrl) {
    job.phase = "failed";
    job.errorMessage = "Job concluído mas sem imagem em last_response.image.base64.";
  }
  return job;
}

/** Mensagens úteis por status HTTP, sem vazar headers/token. */
export function friendlyHttpError(status: number, bodySnippet?: string): string {
  const detail = bodySnippet ? ` Detalhe da API: ${bodySnippet.slice(0, 300)}` : "";
  if (status === 401)
    return `Token PixelLab inválido ou ausente (401). Confira o secret ${PIXELLAB_SECRET_NAME} nos Secrets do Lovable.${detail}`;
  if (status === 402) return `Sem créditos na conta PixelLab (402). Recarregue o saldo em pixellab.ai.${detail}`;
  if (status === 422) return `A API PixelLab rejeitou o payload (422).${detail}`;
  if (status === 429) return `Limite de requisições PixelLab atingido (429). Aguarde e tente de novo.${detail}`;
  if (status >= 500) return `PixelLab indisponível no momento (${status}). Tente novamente em instantes.${detail}`;
  return `Erro PixelLab HTTP ${status}.${detail}`;
}

export function isValidJobId(id: string): boolean {
  return /^[A-Za-z0-9_-]{4,128}$/.test(id);
}

export interface SanitizedBalance {
  ok: boolean;
  usd?: number;
  message?: string;
}

export function sanitizeBalanceResponse(body: unknown): SanitizedBalance {
  const record = asRecord(body);
  if (!record) return { ok: true, message: "Conectado (resposta de saldo sem campos conhecidos)." };
  const usd =
    typeof record.usd === "number"
      ? record.usd
      : typeof record.balance === "number"
        ? record.balance
        : undefined;
  return usd != null && Number.isFinite(usd)
    ? { ok: true, usd }
    : { ok: true, message: "Conectado." };
}
