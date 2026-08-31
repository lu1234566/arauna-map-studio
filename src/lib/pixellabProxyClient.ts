import {
  buildPixfluxPayload,
  extractBackgroundJobId,
  sanitizeBalanceResponse,
  sanitizeJobResponse,
  type PixfluxRequestInput,
  type SanitizedJob,
} from "./pixellab";

export const DEFAULT_PIXELLAB_PROXY_URL = "https://arauna-pixellab-proxy.vercel.app";
export const PIXELLAB_SESSION_KEY = "arauna.pixellab.session-key.v1";
export const PIXELLAB_PROXY_URL_KEY = "arauna.pixellab.proxy-url.v1";

function normalizeProxyUrl(source: string) {
  const value = source.trim().replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("URL do proxy inválido."); }
  if (url.protocol !== "https:") throw new Error("O proxy PixelLab precisa usar HTTPS.");
  if (!url.hostname.endsWith(".vercel.app") && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Use um domínio .vercel.app para o proxy PixelLab.");
  }
  return url.origin;
}

function normalizeKey(apiKey: string) {
  const key = apiKey.trim();
  if (key.length < 12 || key.length > 512) throw new Error("Cole uma chave PixelLab válida.");
  return key;
}

async function relayFetch(
  proxyUrl: string,
  apiKey: string,
  action: "balance" | "generate" | "job",
  init: RequestInit = {},
  jobId?: string,
) {
  const base = normalizeProxyUrl(proxyUrl);
  const url = new URL(`${base}/api/pixellab`);
  url.searchParams.set("action", action);
  if (jobId) url.searchParams.set("jobId", jobId);
  const response = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
    headers: {
      "X-PixelLab-Token": normalizeKey(apiKey),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const message = typeof record?.message === "string" ? record.message : typeof body === "string" ? body : `Proxy HTTP ${response.status}`;
    if (response.status === 401) throw new Error(`Chave PixelLab rejeitada. ${message}`);
    if (response.status === 402) throw new Error(`Sem créditos/gerações disponíveis na PixelLab. ${message}`);
    if (response.status === 429) throw new Error(`Limite de requisições PixelLab atingido. ${message}`);
    throw new Error(message.slice(0, 800));
  }
  return body;
}

export async function getPixelLabProxyStatus(apiKey: string, proxyUrl = DEFAULT_PIXELLAB_PROXY_URL) {
  const body = await relayFetch(proxyUrl, apiKey, "balance", { method: "GET" });
  return sanitizeBalanceResponse(body);
}

export async function startPixelLabProxyGeneration(
  apiKey: string,
  proxyUrl: string,
  input: PixfluxRequestInput,
) {
  const payload = buildPixfluxPayload(input);
  const body = await relayFetch(proxyUrl, apiKey, "generate", { method: "POST", body: JSON.stringify(payload) });
  const jobId = extractBackgroundJobId(body);
  if (!jobId) throw new Error("O proxy não retornou background_job_id reconhecível.");
  return { jobId };
}

export async function getPixelLabProxyJob(
  apiKey: string,
  proxyUrl: string,
  jobId: string,
): Promise<SanitizedJob> {
  const body = await relayFetch(proxyUrl, apiKey, "job", { method: "GET" }, jobId);
  return sanitizeJobResponse(jobId, body);
}

export function loadPixelLabSessionKey() {
  if (typeof window === "undefined") return "";
  try { return sessionStorage.getItem(PIXELLAB_SESSION_KEY) ?? ""; } catch { return ""; }
}

export function savePixelLabSessionKey(value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value.trim()) sessionStorage.setItem(PIXELLAB_SESSION_KEY, value.trim());
    else sessionStorage.removeItem(PIXELLAB_SESSION_KEY);
  } catch { /* sessionStorage indisponível */ }
}

export function loadPixelLabProxyUrl() {
  if (typeof window === "undefined") return DEFAULT_PIXELLAB_PROXY_URL;
  try { return localStorage.getItem(PIXELLAB_PROXY_URL_KEY) ?? DEFAULT_PIXELLAB_PROXY_URL; } catch { return DEFAULT_PIXELLAB_PROXY_URL; }
}

export function savePixelLabProxyUrl(value: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PIXELLAB_PROXY_URL_KEY, normalizeProxyUrl(value)); } catch { /* localStorage indisponível */ }
}
