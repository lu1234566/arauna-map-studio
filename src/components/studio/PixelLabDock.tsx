import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editorStore";
import {
  DETAIL_OPTIONS,
  OUTLINE_OPTIONS,
  PIXELLAB_PRESETS,
  SHADING_OPTIONS,
  type PixelLabDetail,
  type PixelLabOutline,
  type PixelLabShading,
  type SanitizedUsage,
} from "@/lib/pixellab";
import {
  pixelLabRegionDiversity,
  renderPixelLabRegion,
  resolvePixelLabRegion,
  type PixelLabRegion,
} from "@/lib/pixellabMapRender";
import { pixelLabOverlayStore, usePixelLabOverlay } from "@/lib/pixellabOverlayStore";
import {
  blueprintHasContent,
  pixelLabBlueprintStore,
  renderPixelLabBlueprint,
  usePixelLabBlueprint,
} from "@/lib/pixellabBlueprintStore";
import { describePixelLabBlueprint } from "@/lib/pixellabBlueprintSemantic";
import {
  DEFAULT_PIXELLAB_PROXY_URL,
  getPixelLabProxyJob,
  getPixelLabProxyStatus,
  loadPixelLabProxyUrl,
  loadPixelLabSessionKey,
  savePixelLabProxyUrl,
  savePixelLabSessionKey,
  startPixelLabProxyGeneration,
} from "@/lib/pixellabProxyClient";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";
import { PixelLabBlueprintControls } from "./PixelLabBlueprintControls";

type ConnectionState = "idle" | "testing" | "connected" | "error";
type ReferenceMode = "text" | "map" | "blueprint";
type FidelityPreset = "free" | "inspired" | "preserve" | "strong" | "advanced";

interface GenerationMeta {
  prompt: string;
  seed: number | null;
  width: number;
  height: number;
  bounds: PixelLabRegion | null;
  source: ReferenceMode | "refine";
}

interface GenerationResult extends GenerationMeta {
  imageDataUrl: string;
  usage?: SanitizedUsage;
}

const INPUT = "h-7 rounded border border-border bg-canvas px-2 text-[9px] outline-none focus:border-primary/60";
const LABEL = "text-[8px] uppercase tracking-wide text-muted-foreground";
const FIDELITY: Record<Exclude<FidelityPreset, "advanced">, { label: string; strength: number; hint: string }> = {
  free: { label: "Livre", strength: 250, hint: "mais criatividade" },
  inspired: { label: "Inspirado", strength: 400, hint: "segue a composição" },
  preserve: { label: "Preservar layout", strength: 550, hint: "prioriza topologia" },
  strong: { label: "Preservar fortemente", strength: 700, hint: "máxima aderência prática" },
};

function prettyUsage(usage?: SanitizedUsage) {
  if (!usage) return "Uso/custo não informado pela API.";
  const bits: string[] = [];
  if (usage.type) bits.push(usage.type);
  if (usage.usd != null) bits.push(`US$ ${usage.usd.toFixed(4)}`);
  if (usage.raw) for (const [key, value] of Object.entries(usage.raw)) bits.push(`${key}: ${value}`);
  return bits.length ? bits.join(" · ") : "Uso/custo não informado pela API.";
}

function dataUrlBase64(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Imagem gerada inválida para refinamento.");
  return dataUrl.slice(comma + 1);
}

export function PixelLabDock() {
  const editor = useEditor();
  const atlas = useRealAtlas();
  const overlay = usePixelLabOverlay();
  const blueprint = usePixelLabBlueprint();

  const [open, setOpen] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Cole sua chave PixelLab abaixo. Ela fica somente nesta aba do navegador.");
  const [apiKey, setApiKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_PIXELLAB_PROXY_URL);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState("parana-mata-atlantica");
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(320);
  const [seedText, setSeedText] = useState("");
  const [guidance, setGuidance] = useState(8);
  const [outline, setOutline] = useState<PixelLabOutline>("selective outline");
  const [shading, setShading] = useState<PixelLabShading>("basic shading");
  const [detail, setDetail] = useState<PixelLabDetail>("medium detail");
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("text");
  const [usePalette, setUsePalette] = useState(true);
  const [fidelity, setFidelity] = useState<FidelityPreset>("preserve");
  const [advancedStrength, setAdvancedStrength] = useState(550);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState("PixelLab cria somente um concept visual; o mapa não é alterado.");
  const [jobMeta, setJobMeta] = useState<GenerationMeta | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const pollLock = useRef(false);

  useEffect(() => {
    setApiKey(loadPixelLabSessionKey());
    setProxyUrl(loadPixelLabProxyUrl());
  }, []);

  useEffect(() => {
    pixelLabBlueprintStore.ensureDimensions(editor.map.width, editor.map.height);
  }, [editor.map.width, editor.map.height]);

  const preset = useMemo(
    () => PIXELLAB_PRESETS.find((item) => item.id === presetId) ?? PIXELLAB_PRESETS[0]!,
    [presetId],
  );
  const region = useMemo(
    () => resolvePixelLabRegion(editor.map, editor.selection),
    [editor.map.width, editor.map.height, editor.selection?.x, editor.selection?.y, editor.selection?.w, editor.selection?.h],
  );
  const diversity = useMemo(
    () => region.ok ? pixelLabRegionDiversity(editor.map, region.bounds) : null,
    [editor.map, region],
  );
  const mapReferenceAvailable = Boolean(atlas && region.ok && diversity?.meaningful);
  const blueprintReady = blueprintHasContent(blueprint);
  const regionSized = referenceMode !== "text";
  const usesInitImage = referenceMode === "map";
  const outputWidth = regionSized && region.ok ? region.pixelWidth : width;
  const outputHeight = regionSized && region.ok ? region.pixelHeight : height;
  const keyReady = apiKey.trim().length >= 12;
  const initStrength = fidelity === "advanced" ? advancedStrength : FIDELITY[fidelity].strength;

  const blueprintPreview = useMemo(() => {
    if (referenceMode !== "blueprint" || !region.ok || !blueprintReady) return null;
    try { return renderPixelLabBlueprint(region.bounds, blueprint); } catch { return null; }
  }, [referenceMode, region, blueprint.revision, blueprint.width, blueprint.height, blueprintReady]);

  const blueprintSemantic = useMemo(() => {
    if (referenceMode !== "blueprint" || !region.ok || !blueprintReady) return "";
    try { return describePixelLabBlueprint(region.bounds, blueprint); } catch { return ""; }
  }, [referenceMode, region, blueprint.revision, blueprint.width, blueprint.height, blueprintReady]);

  const updateApiKey = (value: string) => {
    setApiKey(value);
    savePixelLabSessionKey(value);
    setConnection("idle");
    setConnectionMessage(
      value.trim()
        ? "Chave carregada nesta sessão. Clique em Testar conexão."
        : "Cole sua chave PixelLab. Ela não será salva permanentemente.",
    );
  };

  const updateProxyUrl = (value: string) => {
    setProxyUrl(value);
    if (value.trim().startsWith("https://")) savePixelLabProxyUrl(value);
    setConnection("idle");
  };

  const testConnection = async () => {
    if (!keyReady) {
      setConnection("error");
      setConnectionMessage("Cole uma chave PixelLab válida antes de testar.");
      return;
    }
    setConnection("testing");
    setConnectionMessage("Testando PixelLab pelo proxy Vercel…");
    try {
      const response = await getPixelLabProxyStatus(apiKey, proxyUrl);
      setConnection("connected");
      setConnectionMessage(response.message);
    } catch (error) {
      setConnection("error");
      setConnectionMessage(`Falha ao testar: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const description = () => [
    prompt.trim(),
    preset.promptSuffix,
    "top-down GBA-era RPG overworld map, readable 16x16 tile logic, clear walkable paths, coherent building footprints, no text labels, no characters",
    referenceMode === "blueprint" ? blueprintSemantic : "",
  ].filter(Boolean).join(". ");

  const startGeneration = async (options: {
    variation?: boolean;
    initImageBase64?: string | null;
    initStrength?: number;
    meta?: GenerationMeta;
  } = {}) => {
    if (!keyReady) {
      setJobMessage("Cole sua chave PixelLab e teste a conexão antes de gerar.");
      return;
    }
    if (busy || tracking) return;

    setBusy(true);
    setJobMessage("Enviando job para a PixelLab…");
    try {
      const parsedSeed = options.variation || !seedText.trim() ? null : Number(seedText);
      if (parsedSeed != null && (!Number.isInteger(parsedSeed) || parsedSeed < 0 || parsedSeed > 0xffffffff)) {
        throw new Error("Seed deve ser um inteiro entre 0 e 4294967295.");
      }
      const meta = options.meta ?? {
        prompt: description(),
        seed: parsedSeed,
        width: outputWidth,
        height: outputHeight,
        bounds: null,
        source: referenceMode,
      };
      const response = await startPixelLabProxyGeneration(apiKey, proxyUrl, {
        description: meta.prompt,
        width: meta.width,
        height: meta.height,
        seed: parsedSeed,
        textGuidanceScale: guidance,
        outline,
        shading,
        detail,
        view: "high top-down",
        initImageBase64: options.initImageBase64 ?? null,
        initImageStrength: options.initImageBase64 ? (options.initStrength ?? 450) : undefined,
      });
      setJobMeta({ ...meta, seed: parsedSeed });
      setJobId(response.jobId);
      setTracking(true);
      setConnection("connected");
      setConnectionMessage("Conectado à PixelLab pelo proxy Vercel.");
      setJobMessage(`Job ${response.jobId.slice(0, 8)}… enviado. Acompanhando a cada 5 s.`);
    } catch (error) {
      setConnection("error");
      setJobMessage(`Não foi possível iniciar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const generate = async (variation = false) => {
    if (!prompt.trim()) {
      setJobMessage("Descreva o mapa antes de gerar.");
      return;
    }
    if (busy || tracking) return;
    if (regionSized && !region.ok) {
      setJobMessage(region.message);
      return;
    }
    if (referenceMode === "map" && !mapReferenceAvailable) {
      setJobMessage("O mapa/seleção está vazio, quase uniforme ou sem atlas real. Use Somente texto ou Blueprint.");
      return;
    }
    if (referenceMode === "blueprint" && !blueprintReady) {
      setJobMessage("Pinte pelo menos uma zona no Blueprint visual antes de gerar.");
      return;
    }

    setResult(null);
    setBusy(true);
    setJobMessage(referenceMode === "blueprint" ? "Convertendo Blueprint em regras espaciais…" : "Preparando referência limpa…");
    try {
      let initImageBase64: string | null = null;
      let colorImageBase64: string | null = null;
      let bounds: PixelLabRegion | null = null;
      let generationWidth = Math.round(width);
      let generationHeight = Math.round(height);

      if (referenceMode === "map") {
        if (!region.ok) throw new Error(region.message);
        const rendered = renderPixelLabRegion(editor.map, region.bounds);
        initImageBase64 = rendered.imageBase64;
        colorImageBase64 = usePalette ? rendered.paletteBase64 : null;
        generationWidth = rendered.pixelWidth;
        generationHeight = rendered.pixelHeight;
        bounds = rendered.bounds;
      } else if (referenceMode === "blueprint") {
        if (!region.ok) throw new Error(region.message);
        if (!blueprintSemantic) throw new Error("Não foi possível converter o Blueprint em topologia semântica.");
        generationWidth = region.pixelWidth;
        generationHeight = region.pixelHeight;
        // Intencionalmente sem init image: evita que linhas, cores ou símbolos do diagrama virem arte.
        bounds = null;
      }

      const parsedSeed = variation || !seedText.trim() ? null : Number(seedText);
      if (parsedSeed != null && (!Number.isInteger(parsedSeed) || parsedSeed < 0 || parsedSeed > 0xffffffff)) {
        throw new Error("Seed deve ser um inteiro entre 0 e 4294967295.");
      }
      const finalPrompt = description();
      const response = await startPixelLabProxyGeneration(apiKey, proxyUrl, {
        description: finalPrompt,
        width: generationWidth,
        height: generationHeight,
        seed: parsedSeed,
        textGuidanceScale: guidance,
        outline,
        shading,
        detail,
        view: "high top-down",
        initImageBase64,
        initImageStrength: usesInitImage ? initStrength : undefined,
        colorImageBase64,
      });
      setJobMeta({
        prompt: finalPrompt,
        seed: parsedSeed,
        width: generationWidth,
        height: generationHeight,
        bounds,
        source: referenceMode,
      });
      setJobId(response.jobId);
      setTracking(true);
      setConnection("connected");
      setConnectionMessage("Conectado à PixelLab pelo proxy Vercel.");
      setJobMessage(
        referenceMode === "blueprint"
          ? `Blueprint convertido em regras. Job ${response.jobId.slice(0, 8)}… enviado sem imagem-guia.`
          : `Job ${response.jobId.slice(0, 8)}… enviado. Acompanhando a cada 5 s.`,
      );
    } catch (error) {
      setConnection("error");
      setJobMessage(`Não foi possível iniciar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const refineResult = async () => {
    if (!result || busy || tracking) return;
    setResult(null);
    const meta: GenerationMeta = {
      prompt: `${result.prompt}. Refine this existing finished map while preserving its composition, improving natural terrain transitions, readable roads, coherent architecture and polished GBA-era pixel-art detail.`,
      seed: null,
      width: result.width,
      height: result.height,
      bounds: result.bounds,
      source: "refine",
    };
    await startGeneration({
      variation: true,
      initImageBase64: dataUrlBase64(result.imageDataUrl),
      initStrength: 450,
      meta,
    });
  };

  useEffect(() => {
    if (!jobId || !tracking || !keyReady) return;
    let active = true;
    const poll = async () => {
      if (!active || pollLock.current) return;
      pollLock.current = true;
      try {
        const job = await getPixelLabProxyJob(apiKey, proxyUrl, jobId);
        if (!active) return;
        if (job.phase === "completed" && job.imageDataUrl) {
          setTracking(false);
          const fallback: GenerationMeta = {
            prompt: "",
            seed: null,
            width,
            height,
            bounds: null,
            source: "text",
          };
          const completed = { imageDataUrl: job.imageDataUrl, usage: job.usage, ...(jobMeta ?? fallback) };
          setResult(completed);
          setJobMessage(
            completed.source === "blueprint"
              ? `Concept concluído por Blueprint semântico. ${prettyUsage(job.usage)} Sem alinhamento de overlay.`
              : `Concept concluído. ${prettyUsage(job.usage)}`,
          );
        } else if (job.phase === "failed") {
          setTracking(false);
          setJobMessage(job.errorMessage ?? "A geração PixelLab falhou.");
        } else {
          setJobMessage(`PixelLab: ${job.phase === "in_progress" ? "processando" : job.phase}…`);
        }
      } catch (error) {
        if (active) {
          setTracking(false);
          setJobMessage(`Falha no acompanhamento: ${error instanceof Error ? error.message : String(error)}`);
        }
      } finally {
        pollLock.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, tracking, jobMeta, apiKey, proxyUrl, keyReady, width, height]);

  const showOverlay = () => {
    if (!result?.bounds) {
      setJobMessage("Sem referência espacial não há alinhamento confiável para overlay.");
      return;
    }
    pixelLabOverlayStore.show(result.imageDataUrl, result.bounds);
  };

  const downloadResult = () => {
    if (!result || typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = result.imageDataUrl;
    anchor.download = `arauna-pixellab-concept-${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <section className="absolute left-2 top-2 z-50 flex flex-col rounded border border-primary/35 bg-panel/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "rounded border px-2.5 py-1.5 text-[10px] font-semibold",
            open ? "border-primary/60 bg-primary/20 text-primary" : "border-primary/35 bg-toolbar hover:bg-surface",
          )}
        >
          ✦ PixelLab Concept
        </button>
        {!open && <span className="text-[8px] text-muted-foreground">texto · mapa · blueprint</span>}
      </div>

      {open && (
        <div className="max-h-[calc(100dvh-110px)] w-[390px] max-w-[calc(100vw-360px)] overflow-y-auto border-t border-border p-2.5">
          <div className="space-y-2.5">
            <div className="rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed">
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "font-semibold",
                  connection === "connected" ? "text-success" : connection === "error" ? "text-destructive" : "text-muted-foreground",
                )}>
                  {connection === "connected" ? "● Conectado" : connection === "testing" ? "● Testando…" : connection === "error" ? "● Erro" : "● PixelLab"}
                </span>
                <button
                  type="button"
                  onClick={() => void testConnection()}
                  disabled={connection === "testing" || !keyReady}
                  className="rounded border border-border bg-toolbar px-2 py-1 text-[8px] hover:bg-surface disabled:opacity-40"
                >
                  Testar conexão
                </button>
              </div>
              <p className="mt-1 text-muted-foreground">{connectionMessage}</p>
              <label className="mt-2 block space-y-1">
                <span className={LABEL}>Chave API PixelLab</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => updateApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Cole sua chave aqui"
                  className={cn(INPUT, "w-full font-mono")}
                />
              </label>
              <p className="mt-1 text-[8px] text-muted-foreground">Guardada só em sessionStorage desta aba. Não vai para GitHub nem Lovable Secrets.</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[8px] text-muted-foreground">Proxy Vercel</summary>
                <label className="mt-1 block space-y-1">
                  <span className={LABEL}>URL do proxy</span>
                  <input value={proxyUrl} onChange={(event) => updateProxyUrl(event.target.value)} spellCheck={false} className={cn(INPUT, "w-full font-mono")} />
                </label>
              </details>
            </div>

            <div>
              <div className={LABEL}>Descrição do mapa</div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-1 h-24 w-full resize-y rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed outline-none focus:border-primary/60"
                placeholder="Ex.: pequena vila do interior do Paraná, praça irregular, riacho ao leste…"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className={LABEL}>Região / bioma</span>
                <select value={presetId} onChange={(event) => setPresetId(event.target.value)} className={cn(INPUT, "w-full")}>
                  {PIXELLAB_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL}>Seed (opcional)</span>
                <input
                  value={seedText}
                  onChange={(event) => setSeedText(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  placeholder="automática"
                  className={cn(INPUT, "w-full font-mono")}
                />
              </label>
            </div>

            <div className="space-y-2 rounded border border-border bg-canvas p-2">
              <div className={LABEL}>Fonte de referência</div>
              <div className="grid grid-cols-3 gap-1">
                {([ ["text", "Somente texto"], ["map", "Mapa atual"], ["blueprint", "Blueprint"] ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setReferenceMode(id);
                      if (id !== "blueprint") pixelLabBlueprintStore.setEnabled(false);
                    }}
                    className={cn(
                      "rounded border px-1.5 py-1.5 text-[8px]",
                      referenceMode === id
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-toolbar text-muted-foreground hover:bg-surface",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {regionSized && (
                <div className={cn(
                  "rounded border px-2 py-1.5 text-[8px]",
                  region.ok ? "border-success/25 text-success" : "border-warning/30 text-warning",
                )}>
                  {region.ok
                    ? `${region.source === "selection" ? "Seleção" : "Mapa inteiro"}: (${region.bounds.x},${region.bounds.y}) ${region.bounds.w}×${region.bounds.h} → ${region.pixelWidth}×${region.pixelHeight}px`
                    : region.message}
                </div>
              )}
              {referenceMode === "map" && (
                <>
                  <label className="flex items-center justify-between gap-2 text-[9px]">
                    <span><b>Usar paleta atual</b><br /><span className="text-muted-foreground">Até 24 cores da região real.</span></span>
                    <input
                      type="checkbox"
                      disabled={!mapReferenceAvailable}
                      checked={usePalette && mapReferenceAvailable}
                      onChange={(event) => setUsePalette(event.target.checked)}
                    />
                  </label>
                  {diversity && !diversity.meaningful && (
                    <p className="text-[8px] text-warning">Região vazia/quase uniforme: use Somente texto ou Blueprint.</p>
                  )}
                </>
              )}
            </div>

            {referenceMode === "blueprint" && (
              <>
                <PixelLabBlueprintControls />
                {blueprintPreview && (
                  <div className="rounded border border-border bg-canvas p-2">
                    <div className={LABEL}>Prévia do Blueprint · não enviada à PixelLab</div>
                    <img
                      src={blueprintPreview.imageDataUrl}
                      alt="Blueprint visual local"
                      className="mt-1 max-h-40 w-full border border-border object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <div className="mt-1 text-[8px] text-muted-foreground">
                      {blueprintPreview.usedZones.length} tipo(s) de zona · {blueprintPreview.pixelWidth}×{blueprintPreview.pixelHeight}px · somente visualização local
                    </div>
                  </div>
                )}
                <div className="rounded border border-primary/25 bg-primary/5 px-2 py-1.5 text-[8px] leading-relaxed text-muted-foreground">
                  <b className="text-primary">Blueprint semântico:</b> a planta vira regras espaciais no prompt. Nenhum diagrama, cor, grade ou linha é enviado como imagem para a PixelLab.
                </div>
                {blueprintSemantic && (
                  <details className="rounded border border-border bg-canvas p-2">
                    <summary className="cursor-pointer text-[8px] font-semibold">Ver regras espaciais geradas</summary>
                    <p className="mt-1 whitespace-pre-wrap text-[8px] leading-relaxed text-muted-foreground">{blueprintSemantic}</p>
                  </details>
                )}
              </>
            )}

            {referenceMode === "map" && (
              <div className="rounded border border-border bg-canvas p-2">
                <div className={LABEL}>Fidelidade ao Init Image</div>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {(Object.keys(FIDELITY) as Array<keyof typeof FIDELITY>).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFidelity(id)}
                      className={cn(
                        "rounded border px-2 py-1.5 text-left text-[8px]",
                        fidelity === id
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-toolbar text-muted-foreground hover:bg-surface",
                      )}
                    >
                      <b>{FIDELITY[id].label}</b><br />
                      <span className="opacity-75">{FIDELITY[id].strength} · {FIDELITY[id].hint}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFidelity("advanced")}
                    className={cn(
                      "rounded border px-2 py-1.5 text-left text-[8px]",
                      fidelity === "advanced"
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-toolbar text-muted-foreground hover:bg-surface",
                    )}
                  >
                    <b>Avançado</b><br /><span className="opacity-75">valor manual</span>
                  </button>
                </div>
                {fidelity === "advanced" && (
                  <label className="mt-2 block text-[8px]">
                    Init strength: <b>{advancedStrength}</b>
                    <input
                      type="range"
                      min={1}
                      max={999}
                      value={advancedStrength}
                      onChange={(event) => setAdvancedStrength(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </label>
                )}
                <p className="mt-1 text-[8px] text-muted-foreground">Este controle vale apenas quando uma imagem real do mapa é enviada como Init Image.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className={LABEL}>Largura</span>
                <input
                  type="number"
                  min={32}
                  max={320}
                  disabled={regionSized}
                  value={outputWidth}
                  onChange={(event) => setWidth(Math.max(32, Math.min(320, Number(event.target.value) || 32)))}
                  className={cn(INPUT, "w-full")}
                />
              </label>
              <label className="space-y-1">
                <span className={LABEL}>Altura</span>
                <input
                  type="number"
                  min={32}
                  max={320}
                  disabled={regionSized}
                  value={outputHeight}
                  onChange={(event) => setHeight(Math.max(32, Math.min(320, Number(event.target.value) || 32)))}
                  className={cn(INPUT, "w-full")}
                />
              </label>
            </div>

            <details className="rounded border border-border bg-canvas p-2">
              <summary className="cursor-pointer text-[9px] font-semibold">Ajustes PixelLab</summary>
              <div className="mt-2 space-y-2">
                <label className="block text-[8px]">
                  Guidance: <b>{guidance}</b>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={0.5}
                    value={guidance}
                    onChange={(event) => setGuidance(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <select value={outline} onChange={(event) => setOutline(event.target.value as PixelLabOutline)} className={cn(INPUT, "min-w-0 w-full")}>
                    {OUTLINE_OPTIONS.map((value) => <option key={value}>{value}</option>)}
                  </select>
                  <select value={shading} onChange={(event) => setShading(event.target.value as PixelLabShading)} className={cn(INPUT, "min-w-0 w-full")}>
                    {SHADING_OPTIONS.map((value) => <option key={value}>{value}</option>)}
                  </select>
                  <select value={detail} onChange={(event) => setDetail(event.target.value as PixelLabDetail)} className={cn(INPUT, "min-w-0 w-full")}>
                    {DETAIL_OPTIONS.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </div>
              </div>
            </details>

            <button
              type="button"
              disabled={busy || tracking || !keyReady || !prompt.trim() || (regionSized && !region.ok) || (referenceMode === "map" && !mapReferenceAvailable) || (referenceMode === "blueprint" && !blueprintReady)}
              onClick={() => void generate(false)}
              className="w-full rounded border border-primary/50 bg-primary/15 px-3 py-2 text-[10px] font-semibold text-primary hover:bg-primary/25 disabled:opacity-35"
            >
              {busy ? "Preparando…" : tracking ? "PixelLab processando…" : "✦ Gerar concept"}
            </button>

            {tracking && (
              <button
                type="button"
                onClick={() => setTracking(false)}
                className="w-full rounded border border-border bg-toolbar px-2 py-1.5 text-[9px] text-muted-foreground hover:bg-surface"
              >
                Parar acompanhamento local
              </button>
            )}

            <div className="rounded border border-border bg-canvas px-2 py-1.5 text-[8px] leading-relaxed text-muted-foreground">{jobMessage}</div>

            {result && (
              <div className="space-y-2 rounded border border-success/25 bg-success/5 p-2">
                <img
                  src={result.imageDataUrl}
                  alt="Concept PixelLab"
                  className="mx-auto max-h-64 max-w-full border border-border bg-canvas"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="text-[8px] text-muted-foreground">
                  {result.width}×{result.height}px · seed {result.seed ?? "automática"} · {prettyUsage(result.usage)}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {result.bounds && (
                    overlay.visible
                      ? <button type="button" onClick={() => pixelLabOverlayStore.hide()} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface">Ocultar overlay</button>
                      : <button type="button" onClick={showOverlay} className="rounded border border-success/35 bg-success/10 px-2 py-1.5 text-[8px] text-success hover:bg-success/20">Mostrar como overlay</button>
                  )}
                  <button type="button" onClick={downloadResult} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface">Baixar PNG</button>
                  <button type="button" disabled={busy || tracking} onClick={() => void refineResult()} className="rounded border border-primary/35 bg-primary/10 px-2 py-1.5 text-[8px] text-primary hover:bg-primary/20 disabled:opacity-35">Refinar arte</button>
                  <button type="button" disabled={busy || tracking} onClick={() => void generate(true)} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface disabled:opacity-35">Gerar variação</button>
                </div>
                {result.bounds && overlay.imageDataUrl && (
                  <label className="block text-[8px] text-muted-foreground">
                    Opacidade do overlay: {Math.round(overlay.opacity * 100)}%
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(overlay.opacity * 100)}
                      onChange={(event) => pixelLabOverlayStore.setOpacity(Number(event.target.value) / 100)}
                      className="mt-1 w-full"
                    />
                  </label>
                )}
                {!result.bounds && (
                  <p className="text-[8px] text-warning">
                    {result.source === "blueprint"
                      ? "Blueprint semântico: concept sem alinhamento de overlay. Use Refinar arte para uma segunda passagem visual."
                      : "Sem referência espacial: resultado somente como concept."}
                  </p>
                )}
              </div>
            )}

            <p className="text-[8px] leading-relaxed text-muted-foreground">
              Blueprint e geração nunca alteram map.bin, map.json, colisão, elevação, eventos ou Undo. A chave fica só na sessão da aba e passa por HTTPS pelo proxy Vercel.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
