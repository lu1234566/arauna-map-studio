/**
 * PixelLab AI — server functions (o token NUNCA sai do servidor).
 *
 * Lê process.env.PIXELLAB_API_TOKEN somente dentro dos handlers.
 * Erros retornados são sanitizados: sem headers, sem token, sem URLs internas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  DETAIL_OPTIONS,
  OUTLINE_OPTIONS,
  PIXELLAB_API_BASE,
  PIXELLAB_SECRET_NAME,
  PixelLabValidationError,
  SHADING_OPTIONS,
  TIER1_MAX_PX,
  TIER1_MIN_PX,
  buildPixfluxPayload,
  friendlyHttpError,
  isValidJobId,
  sanitizeBalanceResponse,
  sanitizeJobResponse,
  type PixelLabDetail,
  type PixelLabOutline,
  type PixelLabShading,
} from "./pixellab";

const REQUEST_TIMEOUT_MS = 30_000;

function readToken(): string | null {
  const token = process.env.PIXELLAB_API_TOKEN?.trim();
  return token && token.length > 4 ? token : null;
}

async function pixellabFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${PIXELLAB_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  // Snippet de corpo apenas: nunca expor headers da requisição/resposta.
  const snippet = body && typeof body === "object" ? JSON.stringify(body).slice(0, 300) : raw.slice(0, 300);
  return { status: response.status, ok: response.ok, body, snippet };
}

function failureMessage(error: unknown): string {
  if (error instanceof PixelLabValidationError) return error.message;
  if (error instanceof Error && error.name === "TimeoutError") {
    return "Tempo esgotado ao falar com a API PixelLab (30 s). Tente novamente.";
  }
  return `Falha de rede ao falar com a API PixelLab: ${error instanceof Error ? error.message : String(error)}`;
}

const notConfigured = {
  ok: false as const,
  configured: false as const,
  message: `Secret ${PIXELLAB_SECRET_NAME} não configurado. Adicione-o nos Secrets do Lovable (Project Settings → Secrets); nunca cole o token no navegador ou no código.`,
};

/** a) Status/teste de conexão: GET /balance, resposta sanitizada. */
export const getPixelLabStatus = createServerFn({ method: "GET" }).handler(async () => {
  const token = readToken();
  if (!token) return notConfigured;
  try {
    const result = await pixellabFetch("/balance", token, { method: "GET" });
    if (!result.ok) {
      return {
        ok: false as const,
        configured: true as const,
        message: friendlyHttpError(result.status, result.snippet),
      };
    }
    const balance = sanitizeBalanceResponse(result.body);
    return {
      ok: true as const,
      configured: true as const,
      ...(balance.usd != null ? { balanceUsd: balance.usd } : {}),
      message: balance.usd != null ? `Conectado. Saldo: US$ ${balance.usd.toFixed(2)}.` : (balance.message ?? "Conectado."),
    };
  } catch (error) {
    return { ok: false as const, configured: true as const, message: failureMessage(error) };
  }
});

const startSchema = z.object({
  description: z.string().min(1).max(4000),
  width: z.number().int().min(TIER1_MIN_PX).max(TIER1_MAX_PX),
  height: z.number().int().min(TIER1_MIN_PX).max(TIER1_MAX_PX),
  seed: z.number().int().min(0).max(4294967295).nullable().optional(),
  textGuidanceScale: z.number().min(1).max(20).optional(),
  outline: z.enum(OUTLINE_OPTIONS as [PixelLabOutline, ...PixelLabOutline[]]).optional(),
  shading: z.enum(SHADING_OPTIONS as [PixelLabShading, ...PixelLabShading[]]).optional(),
  detail: z.enum(DETAIL_OPTIONS as [PixelLabDetail, ...PixelLabDetail[]]).optional(),
  initImageBase64: z.string().max(2_800_000).nullable().optional(),
  initImageStrength: z.number().int().min(1).max(999).optional(),
  colorImageBase64: z.string().max(700_000).nullable().optional(),
});

/** b) Inicia job assíncrono Pixflux com limites Tier 1 aplicados no servidor. */
export const startPixelLabMapGeneration = createServerFn({ method: "POST" })
  .validator(startSchema)
  .handler(async ({ data }) => {
    const token = readToken();
    if (!token) return notConfigured;
    try {
      const payload = buildPixfluxPayload({
        description: data.description,
        width: data.width,
        height: data.height,
        seed: data.seed ?? null,
        textGuidanceScale: data.textGuidanceScale ?? 8,
        ...(data.outline ? { outline: data.outline } : {}),
        ...(data.shading ? { shading: data.shading } : {}),
        ...(data.detail ? { detail: data.detail } : {}),
        view: "high top-down",
        initImageBase64: data.initImageBase64 ?? null,
        initImageStrength: data.initImageStrength ?? 300,
        colorImageBase64: data.colorImageBase64 ?? null,
      });
      const result = await pixellabFetch("/create-image-pixflux-background", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        return {
          ok: false as const,
          configured: true as const,
          message: friendlyHttpError(result.status, result.snippet),
        };
      }
      const body = (result.body ?? {}) as Record<string, unknown>;
      const jobId =
        (typeof body.job_id === "string" && body.job_id) ||
        (typeof body.id === "string" && body.id) ||
        null;
      if (!jobId || !isValidJobId(jobId)) {
        return {
          ok: false as const,
          configured: true as const,
          message: "A API PixelLab aceitou o pedido mas não retornou um job_id reconhecível.",
        };
      }
      return { ok: true as const, configured: true as const, jobId };
    } catch (error) {
      return { ok: false as const, configured: true as const, message: failureMessage(error) };
    }
  });

const jobSchema = z.object({ jobId: z.string().min(4).max(128) });

/** c) Consulta job: retorna fase e, quando completed, imagem + usage sanitizado. */
export const getPixelLabJob = createServerFn({ method: "POST" })
  .validator(jobSchema)
  .handler(async ({ data }) => {
    const token = readToken();
    if (!token) return notConfigured;
    if (!isValidJobId(data.jobId)) {
      return { ok: false as const, configured: true as const, message: "job_id inválido." };
    }
    try {
      const result = await pixellabFetch(`/background-jobs/${encodeURIComponent(data.jobId)}`, token, {
        method: "GET",
      });
      if (!result.ok) {
        return {
          ok: false as const,
          configured: true as const,
          message: friendlyHttpError(result.status, result.snippet),
        };
      }
      return {
        ok: true as const,
        configured: true as const,
        job: sanitizeJobResponse(data.jobId, result.body),
      };
    } catch (error) {
      return { ok: false as const, configured: true as const, message: failureMessage(error) };
    }
  });
