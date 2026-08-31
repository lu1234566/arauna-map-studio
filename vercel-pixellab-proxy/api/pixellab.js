const PIXELLAB_BASE = "https://api.pixellab.ai/v2";
const PROD_ORIGIN = "https://arauna-map-studio.lovable.app";
const PREVIEW_ORIGIN = "https://id-preview--377c10fd-30f6-45b1-9ad2-881b6bc41a72.lovable.app";
const MAX_BODY_BYTES = 3_500_000;

function allowedOrigin(origin) {
  if (!origin) return false;
  if (origin === PROD_ORIGIN || origin === PREVIEW_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function cors(req, res) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (allowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-PixelLab-Token");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Cache-Control", "no-store");
  return origin;
}

function json(res, status, body) {
  res.status(status).json(body);
}

function safeDetail(value) {
  if (typeof value === "string") return value.slice(0, 800);
  if (!value || typeof value !== "object") return undefined;
  try {
    return JSON.stringify(value).slice(0, 800);
  } catch {
    return undefined;
  }
}

function validateImageSize(body) {
  const size = body?.image_size;
  if (!size || typeof size !== "object") return "image_size ausente.";
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return "image_size deve usar inteiros.";
  if (width < 32 || height < 32 || width > 320 || height > 320) return "Tier 1: image_size deve ficar entre 32 e 320 px por eixo.";
  return null;
}

async function pixellabFetch(path, token, init = {}) {
  const response = await fetch(`${PIXELLAB_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(45_000),
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw ? { detail: raw.slice(0, 800) } : null;
  }
  return { ok: response.ok, status: response.status, payload };
}

export default async function handler(req, res) {
  const origin = cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!allowedOrigin(origin)) return json(res, 403, { ok: false, message: "Origem não autorizada." });

  const tokenHeader = req.headers["x-pixellab-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (typeof token !== "string" || token.trim().length < 12 || token.length > 512) {
    return json(res, 401, { ok: false, message: "Chave PixelLab ausente ou inválida." });
  }

  const action = typeof req.query.action === "string" ? req.query.action : "";
  try {
    if (action === "balance" && req.method === "GET") {
      const result = await pixellabFetch("/balance", token.trim(), { method: "GET" });
      if (!result.ok) return json(res, result.status, { ok: false, message: safeDetail(result.payload) || `PixelLab HTTP ${result.status}` });
      const body = result.payload && typeof result.payload === "object" ? result.payload : {};
      return json(res, 200, {
        ok: true,
        usd: typeof body.usd === "number" ? body.usd : undefined,
        balance: typeof body.balance === "number" ? body.balance : undefined,
        subscription_generations: typeof body.subscription_generations === "number" ? body.subscription_generations : undefined,
        subscription_generation_count: typeof body.subscription_generation_count === "number" ? body.subscription_generation_count : undefined,
      });
    }

    if (action === "generate" && req.method === "POST") {
      const contentLength = Number(req.headers["content-length"] || 0);
      if (contentLength > MAX_BODY_BYTES) return json(res, 413, { ok: false, message: "Payload grande demais." });
      const sizeError = validateImageSize(req.body);
      if (sizeError) return json(res, 422, { ok: false, message: sizeError });
      const result = await pixellabFetch("/create-image-pixflux-background", token.trim(), {
        method: "POST",
        body: JSON.stringify(req.body ?? {}),
      });
      if (!result.ok) return json(res, result.status, { ok: false, message: safeDetail(result.payload) || `PixelLab HTTP ${result.status}` });
      const body = result.payload && typeof result.payload === "object" ? result.payload : {};
      const backgroundJobId =
        typeof body.background_job_id === "string" ? body.background_job_id :
        typeof body.job_id === "string" ? body.job_id :
        typeof body.id === "string" ? body.id : null;
      if (!backgroundJobId) return json(res, 502, { ok: false, message: "PixelLab aceitou o pedido, mas não retornou background_job_id." });
      return json(res, 200, { ok: true, background_job_id: backgroundJobId });
    }

    if (action === "job" && req.method === "GET") {
      const jobId = typeof req.query.jobId === "string" ? req.query.jobId : "";
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(jobId)) return json(res, 400, { ok: false, message: "jobId inválido." });
      const result = await pixellabFetch(`/background-jobs/${encodeURIComponent(jobId)}`, token.trim(), { method: "GET" });
      if (!result.ok) return json(res, result.status, { ok: false, message: safeDetail(result.payload) || `PixelLab HTTP ${result.status}` });
      const body = result.payload && typeof result.payload === "object" ? result.payload : {};
      const last = body.last_response && typeof body.last_response === "object" ? body.last_response : null;
      const image = last?.image && typeof last.image === "object" && typeof last.image.base64 === "string"
        ? { base64: last.image.base64 }
        : undefined;
      return json(res, 200, {
        ok: true,
        status: typeof body.status === "string" ? body.status : "unknown",
        last_response: last ? {
          ...(image ? { image } : {}),
          ...(last.usage && typeof last.usage === "object" ? { usage: last.usage } : {}),
          ...(typeof last.detail === "string" ? { detail: last.detail.slice(0, 800) } : {}),
        } : undefined,
        error: typeof body.error === "string" ? body.error.slice(0, 800) : undefined,
        detail: typeof body.detail === "string" ? body.detail.slice(0, 800) : undefined,
      });
    }

    return json(res, 405, { ok: false, message: "Ação ou método não suportado." });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Tempo esgotado ao falar com a PixelLab."
      : `Falha no proxy: ${error instanceof Error ? error.message : String(error)}`;
    return json(res, 502, { ok: false, message: message.slice(0, 800) });
  }
}
