import { describe, expect, it } from "vitest";
import {
  buildPixfluxPayload, extractBackgroundJobId, friendlyHttpError, normalizeBase64Png,
  normalizeImageDataUrl, sanitizeBalanceResponse, sanitizeJobResponse,
} from "./pixellab";
import { dominantPaletteFromPixels, resolvePixelLabRegion } from "./pixellabMapRender";
import {
  PIXELLAB_BLUEPRINT_PROMPT_APPENDIX,
  blueprintHasContent,
  pixelLabBlueprintStore,
} from "./pixellabBlueprintStore";

const ONE_PX_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZzC8AAAAASUVORK5CYII=";

describe("PixelLab Tier 1", () => {
  it("aceita 320x320", () => {
    const payload = buildPixfluxPayload({ description: "cidade", width: 320, height: 320 });
    expect(payload.image_size).toEqual({ width: 320, height: 320 });
    expect(payload.text_guidance_scale).toBe(8);
    expect(payload.view).toBe("high top-down");
  });
  it("rejeita limites inválidos", () => {
    expect(() => buildPixfluxPayload({ description: "x", width: 321, height: 320 })).toThrow(/Tier 1/);
    expect(() => buildPixfluxPayload({ description: "x", width: 320, height: 320, textGuidanceScale: 21 })).toThrow(/1 e 20/);
    expect(() => buildPixfluxPayload({ description: "x", width: 320, height: 320, seed: -1 })).toThrow(/Seed/);
  });
});

describe("PixelLab responses", () => {
  it("prioriza background_job_id", () => expect(extractBackgroundJobId({ background_job_id: "abcd-1234", job_id: "fallback" })).toBe("abcd-1234"));
  it("não duplica data URL", () => {
    const data = `data:image/png;base64,${ONE_PX_PNG}`;
    expect(normalizeImageDataUrl(data)).toBe(data);
    expect(normalizeImageDataUrl(ONE_PX_PNG)).toBe(data);
    expect(normalizeBase64Png(data)).toBe(ONE_PX_PNG);
  });
  it("sanitiza job concluído", () => {
    const job = sanitizeJobResponse("abcd-1234", { status: "completed", last_response: { image: { type: "base64", base64: `data:image/png;base64,${ONE_PX_PNG}` }, usage: { type: "usd", usd: 0.01 } } });
    expect(job.phase).toBe("completed");
    expect(job.imageDataUrl).toBe(`data:image/png;base64,${ONE_PX_PNG}`);
    expect(job.usage?.usd).toBe(0.01);
  });
  it("interpreta balance real", () => {
    const balance = sanitizeBalanceResponse({ credits: { type: "usd", usd: 10.5 }, subscription: { type: "generations", status: "active", plan: "Tier 1", generations: 120, total: 500 } });
    expect(balance.creditsUsd).toBe(10.5);
    expect(balance.subscription?.generations).toBe(120);
    expect(balance.message).toMatch(/120\/500/);
  });
  it("mensagens HTTP críticas", () => {
    expect(friendlyHttpError(401)).toMatch(/token/i); expect(friendlyHttpError(402)).toMatch(/créditos/i);
    expect(friendlyHttpError(422)).toMatch(/payload/i); expect(friendlyHttpError(429)).toMatch(/limite/i);
  });
});

describe("PixelLab map reference", () => {
  it("aceita seleção 20x20", () => {
    const region = resolvePixelLabRegion({ width: 40, height: 30 }, { x: 5, y: 4, w: 20, h: 20 });
    expect(region.ok).toBe(true); if (region.ok) expect([region.pixelWidth, region.pixelHeight]).toEqual([320, 320]);
  });
  it("bloqueia 21 tiles", () => expect(resolvePixelLabRegion({ width: 40, height: 30 }, { x: 0, y: 0, w: 21, h: 20 }).ok).toBe(false));
  it("extrai paleta determinística", () => {
    const rgba = new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,0]);
    expect(dominantPaletteFromPixels(rgba, 2)).toEqual(["#FF0000", "#00FF00"]);
  });
});

describe("PixelLab visual blueprint", () => {
  it("mantém blueprint em store separado e reinicia ao mudar dimensões", () => {
    pixelLabBlueprintStore.ensureDimensions(20, 20);
    pixelLabBlueprintStore.clear();
    pixelLabBlueprintStore.paintCell(5, 5, "path", 1);
    expect(blueprintHasContent(pixelLabBlueprintStore.getSnapshot())).toBe(true);
    expect(pixelLabBlueprintStore.getSnapshot().cells[5 * 20 + 5]).toBe("path");

    pixelLabBlueprintStore.ensureDimensions(10, 8);
    const resized = pixelLabBlueprintStore.getSnapshot();
    expect([resized.width, resized.height, resized.cells.length]).toEqual([10, 8, 80]);
    expect(blueprintHasContent(resized)).toBe(false);
  });

  it("pincel 3x3 pinta somente a grade do blueprint", () => {
    pixelLabBlueprintStore.ensureDimensions(5, 5);
    pixelLabBlueprintStore.clear();
    pixelLabBlueprintStore.paintCell(2, 2, "building", 3);
    const snapshot = pixelLabBlueprintStore.getSnapshot();
    expect(snapshot.cells.filter((zone) => zone === "building")).toHaveLength(9);
    expect(snapshot.cells[2 * 5 + 2]).toBe("building");
  });

  it("prompt estrutural preserva conectividade sem exigir reprodução literal do guia", () => {
    expect(PIXELLAB_BLUEPRINT_PROMPT_APPENDIX).toMatch(/connectivity of the main road network/i);
    expect(PIXELLAB_BLUEPRINT_PROMPT_APPENDIX).toMatch(/mandatory entrance\/exit/i);
    expect(PIXELLAB_BLUEPRINT_PROMPT_APPENDIX).toMatch(/16x16-tile/i);
    expect(PIXELLAB_BLUEPRINT_PROMPT_APPENDIX).toMatch(/not a blueprint or wireframe/i);
  });
});
