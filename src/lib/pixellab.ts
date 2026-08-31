/**
 * PixelLab AI — helpers puros e client-safe (NENHUM token aqui).
 * A API oficial é chamada somente por src/lib/pixellab.functions.ts.
 */
export const PIXELLAB_API_BASE = "https://api.pixellab.ai/v2";
export const PIXELLAB_SECRET_NAME = "PIXELLAB_API_TOKEN";
export const TIER1_MAX_PX = 320;
export const TIER1_MIN_PX = 32;
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

export interface PixelLabPreset { id: string; label: string; promptSuffix: string }
export const PIXELLAB_PRESETS: PixelLabPreset[] = [
  { id: "parana-mata-atlantica", label: "Paraná / Mata Atlântica", promptSuffix: "Atlantic Forest of Paraná, Brazil; araucaria pines, subtropical vegetation, red clay paths, small Brazilian inland-town details" },
  { id: "amazonia", label: "Amazônia", promptSuffix: "Brazilian Amazon rainforest; dense canopy, broad dark rivers, stilted riverside details and lush tropical vegetation" },
  { id: "cerrado", label: "Cerrado", promptSuffix: "Brazilian cerrado savanna; twisted small trees, golden grass, termite mounds and red dirt roads" },
  { id: "caatinga", label: "Caatinga", promptSuffix: "Brazilian caatinga semi-arid biome; cacti, thorny shrubs, pale dry soil and rocky outcrops" },
  { id: "pantanal", label: "Pantanal", promptSuffix: "Brazilian Pantanal wetlands; flooded plains, water plants, wooden walkways, river channels and grassy islands" },
  { id: "litoral-mangue", label: "Litoral / Mangue", promptSuffix: "Brazilian coast and mangrove; sandy shore, fishing piers, shallow water, mangrove roots and coastal vegetation" },
  { id: "custom", label: "Personalizado", promptSuffix: "" },
];

export interface PixfluxRequestInput {
  description: string; width: number; height: number; seed?: number | null; textGuidanceScale?: number;
  outline?: PixelLabOutline; shading?: PixelLabShading; detail?: PixelLabDetail; view?: PixelLabView;
  initImageBase64?: string | null; initImageStrength?: number; colorImageBase64?: string | null;
}
export class PixelLabValidationError extends Error {}

function isPlainBase64(source: string): boolean {
  const compact = source.replace(/\s/g, "");
  return compact.length > 0 && compact.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(compact);
}
export function normalizeBase64Png(source: string): string {
  const trimmed = source.trim();
  const match = /^data:image\/(?:png|webp|jpeg|jpg);base64,(.+)$/is.exec(trimmed);
  const body = (match ? match[1] : trimmed).replace(/\s/g, "");
  if (!isPlainBase64(body)) throw new PixelLabValidationError("Imagem inválida: esperado base64 de imagem ou data URL.");
  return body;
}
export function normalizeImageDataUrl(source: string, format = "png"): string {
  const trimmed = source.trim();
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/is.exec(trimmed);
  if (match) return `data:image/${match[1]!.toLowerCase()};base64,${normalizeBase64Png(trimmed)}`;
  return `data:image/${format};base64,${normalizeBase64Png(trimmed)}`;
}

export function buildPixfluxPayload(input: PixfluxRequestInput): Record<string, unknown> {
  const description = input.description.trim();
  if (!description) throw new PixelLabValidationError("O prompt (description) é obrigatório.");
  if (description.length > 4000) throw new PixelLabValidationError("Prompt longo demais (máx. 4000 caracteres).");
  for (const [label, value] of [["largura", input.width], ["altura", input.height]] as const) {
    if (!Number.isInteger(value) || value < TIER1_MIN_PX || value > TIER1_MAX_PX) throw new PixelLabValidationError(`Tier 1: ${label} deve ser inteiro entre ${TIER1_MIN_PX} e ${TIER1_MAX_PX} px (recebido ${value}).`);
  }
  const guidance = input.textGuidanceScale ?? 8;
  if (!Number.isFinite(guidance) || guidance < 1 || guidance > 20) throw new PixelLabValidationError("text_guidance_scale deve estar entre 1 e 20.");
  const payload: Record<string, unknown> = { description, image_size: { width: input.width, height: input.height }, text_guidance_scale: guidance, view: input.view ?? "high top-down", isometric: false, no_background: false };
  if (input.outline) payload.outline = input.outline;
  if (input.shading) payload.shading = input.shading;
  if (input.detail) payload.detail = input.detail;
  if (input.seed != null) {
    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new PixelLabValidationError("Seed deve ser inteiro entre 0 e 4294967295.");
    payload.seed = input.seed;
  }
  if (input.initImageBase64) {
    const base64 = normalizeBase64Png(input.initImageBase64);
    if (base64.length > 2_000_000) throw new PixelLabValidationError("Init Image grande demais para o limite Tier 1 de 320×320.");
    payload.init_image = { type: "base64", base64 };
    const strength = input.initImageStrength ?? 300;
    if (!Number.isInteger(strength) || strength < 1 || strength > 999) throw new PixelLabValidationError("init_image_strength deve ser inteiro entre 1 e 999.");
    payload.init_image_strength = strength;
  }
  if (input.colorImageBase64) {
    const base64 = normalizeBase64Png(input.colorImageBase64);
    if (base64.length > 500_000) throw new PixelLabValidationError("color_image grande demais.");
    payload.color_image = { type: "base64", base64 };
  }
  return payload;
}

export type PixelLabJobPhase = "pending" | "in_progress" | "completed" | "failed" | "unknown";
export interface SanitizedUsage { type?: string; usd?: number; raw?: Record<string, number | string> }
export interface SanitizedJob { jobId: string; phase: PixelLabJobPhase; imageDataUrl?: string; usage?: SanitizedUsage; errorMessage?: string }
export interface SanitizedSubscription { status?: string; plan?: string; generations?: number; total?: number }
export interface SanitizedBalance { ok: true; creditsUsd?: number; subscription?: SanitizedSubscription; message: string }
function asRecord(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null }

export function isValidJobId(id: string): boolean { return /^[A-Za-z0-9_-]{4,128}$/.test(id) }
export function extractBackgroundJobId(body: unknown): string | null {
  const record = asRecord(body); if (!record) return null;
  for (const key of ["background_job_id", "job_id", "id"] as const) { const value = record[key]; if (typeof value === "string" && isValidJobId(value)) return value; }
  return null;
}
export function sanitizeUsage(value: unknown): SanitizedUsage | undefined {
  const record = asRecord(value); if (!record) return undefined; const usage: SanitizedUsage = {};
  if (typeof record.type === "string") usage.type = record.type;
  if (typeof record.usd === "number" && Number.isFinite(record.usd)) usage.usd = record.usd;
  const raw: Record<string, number | string> = {};
  for (const [key, entry] of Object.entries(record)) { if (key === "type" || key === "usd") continue; if (typeof entry === "number" && Number.isFinite(entry)) raw[key] = entry; else if (typeof entry === "string" && entry.length <= 120) raw[key] = entry; }
  if (Object.keys(raw).length) usage.raw = raw;
  return Object.keys(usage).length ? usage : undefined;
}
export function normalizeJobPhase(status: unknown): PixelLabJobPhase {
  if (typeof status !== "string") return "unknown"; const value = status.toLowerCase();
  if (["completed", "complete", "succeeded"].includes(value)) return "completed";
  if (["failed", "error", "cancelled"].includes(value)) return "failed";
  if (["in_progress", "processing", "running"].includes(value)) return "in_progress";
  if (["pending", "queued", "created"].includes(value)) return "pending";
  return "unknown";
}
export function sanitizeJobResponse(jobId: string, body: unknown): SanitizedJob {
  const record = asRecord(body) ?? {}; const phase = normalizeJobPhase(record.status); const job: SanitizedJob = { jobId, phase }; const lastResponse = asRecord(record.last_response);
  if (phase === "completed" && lastResponse) {
    const image = asRecord(lastResponse.image); const source = typeof image?.base64 === "string" ? image.base64 : null; const format = typeof image?.format === "string" && image.format.trim() ? image.format.trim() : "png";
    if (source) { try { job.imageDataUrl = normalizeImageDataUrl(source, format); } catch { job.errorMessage = "A PixelLab concluiu o job, mas retornou uma imagem base64 inválida."; } }
    const usage = sanitizeUsage(lastResponse.usage ?? record.usage); if (usage) job.usage = usage;
  }
  if (phase === "failed") { const detail = (typeof record.error === "string" && record.error) || (typeof lastResponse?.detail === "string" && lastResponse.detail) || (typeof record.detail === "string" && record.detail) || "O job PixelLab falhou sem detalhe adicional."; job.errorMessage = String(detail).slice(0, 500); }
  if (phase === "completed" && !job.imageDataUrl) { job.phase = "failed"; job.errorMessage ??= "Job concluído mas sem imagem em last_response.image.base64."; }
  return job;
}
export function friendlyHttpError(status: number, bodySnippet?: string): string {
  const detail = bodySnippet ? ` Detalhe da API: ${bodySnippet.slice(0, 300)}` : "";
  if (status === 401) return `Token PixelLab inválido ou ausente (401). Confira o secret ${PIXELLAB_SECRET_NAME} nos Secrets do Lovable.${detail}`;
  if (status === 402) return `Sem créditos disponíveis na conta PixelLab (402).${detail}`;
  if (status === 422) return `A API PixelLab rejeitou o payload (422).${detail}`;
  if (status === 429) return `Limite de requisições PixelLab atingido (429). Aguarde antes de gerar novamente.${detail}`;
  if (status >= 500) return `PixelLab indisponível no momento (${status}).${detail}`;
  return `Erro PixelLab HTTP ${status}.${detail}`;
}
export function sanitizeBalanceResponse(body: unknown): SanitizedBalance {
  const record = asRecord(body); const credits = asRecord(record?.credits); const subscription = asRecord(record?.subscription);
  const creditsUsd = credits?.type === "usd" && typeof credits.usd === "number" && Number.isFinite(credits.usd) ? credits.usd : undefined;
  const cleanSubscription: SanitizedSubscription = {};
  if (typeof subscription?.status === "string") cleanSubscription.status = subscription.status;
  if (typeof subscription?.plan === "string") cleanSubscription.plan = subscription.plan;
  if (typeof subscription?.generations === "number" && Number.isFinite(subscription.generations)) cleanSubscription.generations = subscription.generations;
  if (typeof subscription?.total === "number" && Number.isFinite(subscription.total)) cleanSubscription.total = subscription.total;
  const parts = ["Conectado à PixelLab."]; if (creditsUsd != null) parts.push(`Créditos: US$ ${creditsUsd.toFixed(2)}.`);
  if (cleanSubscription.generations != null && cleanSubscription.total != null) parts.push(`Assinatura: ${cleanSubscription.generations}/${cleanSubscription.total} gerações restantes.`); else if (cleanSubscription.generations != null) parts.push(`Assinatura: ${cleanSubscription.generations} gerações restantes.`);
  return { ok: true, ...(creditsUsd != null ? { creditsUsd } : {}), ...(Object.keys(cleanSubscription).length ? { subscription: cleanSubscription } : {}), message: parts.join(" ") };
}
