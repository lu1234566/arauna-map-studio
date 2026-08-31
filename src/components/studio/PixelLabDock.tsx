import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useEditor } from "@/lib/editorStore";
import {
  DETAIL_OPTIONS, OUTLINE_OPTIONS, PIXELLAB_PRESETS, PIXELLAB_SECRET_NAME, SHADING_OPTIONS,
  type PixelLabDetail, type PixelLabOutline, type PixelLabShading, type SanitizedUsage,
} from "@/lib/pixellab";
import { getPixelLabJob, getPixelLabStatus, startPixelLabMapGeneration } from "@/lib/pixellab.functions";
import { renderPixelLabRegion, resolvePixelLabRegion, type PixelLabRegion } from "@/lib/pixellabMapRender";
import { pixelLabOverlayStore, usePixelLabOverlay } from "@/lib/pixellabOverlayStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

type ConnectionState = "idle" | "testing" | "connected" | "not-configured" | "error";
interface GenerationMeta { prompt: string; seed: number | null; width: number; height: number; bounds: PixelLabRegion | null }
interface GenerationResult extends GenerationMeta { imageDataUrl: string; usage?: SanitizedUsage }
const INPUT = "h-7 rounded border border-border bg-canvas px-2 text-[9px] outline-none focus:border-primary/60";
const LABEL = "text-[8px] uppercase tracking-wide text-muted-foreground";

function prettyUsage(usage?: SanitizedUsage) {
  if (!usage) return "Uso/custo não informado pela API.";
  const bits: string[] = [];
  if (usage.type) bits.push(usage.type);
  if (usage.usd != null) bits.push(`US$ ${usage.usd.toFixed(4)}`);
  if (usage.raw) for (const [key, value] of Object.entries(usage.raw)) bits.push(`${key}: ${value}`);
  return bits.length ? bits.join(" · ") : "Uso/custo não informado pela API.";
}

export function PixelLabDock() {
  const editor = useEditor();
  const atlas = useRealAtlas();
  const overlay = usePixelLabOverlay();
  const checkConnection = useServerFn(getPixelLabStatus);
  const startGeneration = useServerFn(startPixelLabMapGeneration);
  const pollJob = useServerFn(getPixelLabJob);

  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState(`Secret esperado: ${PIXELLAB_SECRET_NAME}`);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState("parana-mata-atlantica");
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(320);
  const [seedText, setSeedText] = useState("");
  const [guidance, setGuidance] = useState(8);
  const [outline, setOutline] = useState<PixelLabOutline>("selective outline");
  const [shading, setShading] = useState<PixelLabShading>("basic shading");
  const [detail, setDetail] = useState<PixelLabDetail>("medium detail");
  const [initStrength, setInitStrength] = useState(300);
  const [useInit, setUseInit] = useState(true);
  const [usePalette, setUsePalette] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState("PixelLab cria somente um concept visual; o mapa não é alterado.");
  const [jobMeta, setJobMeta] = useState<GenerationMeta | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const pollLock = useRef(false);

  const preset = useMemo(() => PIXELLAB_PRESETS.find((item) => item.id === presetId) ?? PIXELLAB_PRESETS[0]!, [presetId]);
  const region = useMemo(
    () => resolvePixelLabRegion(editor.map, editor.selection),
    [editor.map.width, editor.map.height, editor.selection?.x, editor.selection?.y, editor.selection?.w, editor.selection?.h],
  );
  const mapReferenceAvailable = Boolean(atlas && region.ok);
  const outputWidth = useInit && region.ok ? region.pixelWidth : width;
  const outputHeight = useInit && region.ok ? region.pixelHeight : height;

  const testConnection = async () => {
    setConnection("testing");
    setConnectionMessage("Testando conexão segura com a PixelLab…");
    try {
      const response = await checkConnection();
      if (response.ok) { setConnection("connected"); setConnectionMessage(response.message); }
      else { setConnection(response.configured ? "error" : "not-configured"); setConnectionMessage(response.message); }
    } catch (error) {
      setConnection("error");
      setConnectionMessage(`Falha ao testar: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const description = () => [
    prompt.trim(), preset.promptSuffix,
    "top-down GBA-era RPG overworld map, readable 16x16 tile logic, clear walkable paths, coherent building footprints, no text labels, no characters",
  ].filter(Boolean).join(". ");

  const generate = async (variation = false) => {
    if (!prompt.trim()) { setJobMessage("Descreva o mapa antes de gerar."); return; }
    if (busy || tracking) return;
    if (useInit && !region.ok) { setJobMessage(region.message); return; }
    setBusy(true); setResult(null); setJobMessage("Preparando referência limpa e enviando o job…");
    try {
      let rendered: ReturnType<typeof renderPixelLabRegion> | null = null;
      const paletteEnabled = usePalette && mapReferenceAvailable;
      if (useInit || paletteEnabled) {
        if (!region.ok) throw new Error(region.message);
        if (!atlas) throw new Error("Atlas real indisponível para Init Image/paleta.");
        rendered = renderPixelLabRegion(editor.map, region.bounds);
      }
      const parsedSeed = variation || !seedText.trim() ? null : Number(seedText);
      if (parsedSeed != null && (!Number.isInteger(parsedSeed) || parsedSeed < 0 || parsedSeed > 0xffffffff)) throw new Error("Seed deve ser um inteiro entre 0 e 4294967295.");
      const generationWidth = useInit && rendered ? rendered.pixelWidth : Math.round(width);
      const generationHeight = useInit && rendered ? rendered.pixelHeight : Math.round(height);
      const finalPrompt = description();
      const response = await startGeneration({ data: {
        description: finalPrompt, width: generationWidth, height: generationHeight, seed: parsedSeed,
        textGuidanceScale: guidance, outline, shading, detail,
        initImageBase64: useInit ? rendered?.imageBase64 ?? null : null,
        initImageStrength: initStrength,
        colorImageBase64: paletteEnabled ? rendered?.paletteBase64 ?? null : null,
      } });
      if (!response.ok) {
        setConnection(response.configured ? "error" : "not-configured"); setJobMessage(response.message); return;
      }
      setJobMeta({ prompt: finalPrompt, seed: parsedSeed, width: generationWidth, height: generationHeight, bounds: useInit && rendered ? rendered.bounds : null });
      setJobId(response.jobId); setTracking(true); setConnection("connected"); setConnectionMessage("Conectado à PixelLab.");
      setJobMessage(`Job ${response.jobId.slice(0, 8)}… enviado. Acompanhando a cada 5 s.`);
    } catch (error) {
      setJobMessage(`Não foi possível iniciar: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!jobId || !tracking) return;
    let active = true;
    const poll = async () => {
      if (!active || pollLock.current) return;
      pollLock.current = true;
      try {
        const response = await pollJob({ data: { jobId } });
        if (!active) return;
        if (!response.ok) { setTracking(false); setJobMessage(response.message); return; }
        const job = response.job;
        if (job.phase === "completed" && job.imageDataUrl) {
          setTracking(false);
          setResult({ imageDataUrl: job.imageDataUrl, usage: job.usage, ...(jobMeta ?? { prompt: "", seed: null, width, height, bounds: null }) });
          setJobMessage(`Concept concluído. ${prettyUsage(job.usage)}`);
        } else if (job.phase === "failed") { setTracking(false); setJobMessage(job.errorMessage ?? "A geração PixelLab falhou."); }
        else setJobMessage(`PixelLab: ${job.phase === "in_progress" ? "processando" : job.phase}…`);
      } catch (error) {
        if (active) setJobMessage(`Falha no acompanhamento: ${error instanceof Error ? error.message : String(error)}`);
      } finally { pollLock.current = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, tracking, jobMeta]);

  const showOverlay = () => {
    if (!result?.bounds) { setJobMessage("Sem Init Image não há alinhamento espacial confiável para overlay."); return; }
    pixelLabOverlayStore.show(result.imageDataUrl, result.bounds);
  };
  const downloadResult = () => {
    if (!result || typeof document === "undefined") return;
    const anchor = document.createElement("a"); anchor.href = result.imageDataUrl; anchor.download = `arauna-pixellab-concept-${Date.now()}.png`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };

  return (
    <section className="absolute left-2 top-2 z-50 flex flex-col rounded border border-primary/35 bg-panel/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button type="button" onClick={() => setOpen((value) => !value)} className={cn("rounded border px-2.5 py-1.5 text-[10px] font-semibold", open ? "border-primary/60 bg-primary/20 text-primary" : "border-primary/35 bg-toolbar hover:bg-surface")}>✦ PixelLab Concept</button>
        {!open && <span className="text-[8px] text-muted-foreground">visual → referência</span>}
      </div>
      {open && <div className="max-h-[calc(100dvh-110px)] w-[390px] max-w-[calc(100vw-360px)] overflow-y-auto border-t border-border p-2.5"><div className="space-y-2.5">
        <div className="rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed">
          <div className="flex items-center justify-between gap-2"><span className={cn("font-semibold", connection === "connected" ? "text-success" : connection === "error" ? "text-destructive" : "text-muted-foreground")}>{connection === "connected" ? "● Conectado" : connection === "testing" ? "● Testando…" : connection === "not-configured" ? "● Não configurado" : connection === "error" ? "● Erro" : "● PixelLab"}</span><button type="button" onClick={() => void testConnection()} disabled={connection === "testing"} className="rounded border border-border bg-toolbar px-2 py-1 text-[8px] hover:bg-surface disabled:opacity-40">Testar conexão</button></div>
          <p className="mt-1 text-muted-foreground">{connectionMessage}</p>
          {connection === "not-configured" && <p className="mt-1 text-warning">Lovable → Project Settings → Secrets → Add secret → <b>{PIXELLAB_SECRET_NAME}</b></p>}
        </div>

        <div><div className={LABEL}>Descrição do mapa</div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-1 h-24 w-full resize-y rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed outline-none focus:border-primary/60" placeholder="Ex.: pequena vila do interior do Paraná, praça irregular, riacho ao leste…" /></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className={LABEL}>Região / bioma</span><select value={presetId} onChange={(event) => setPresetId(event.target.value)} className={cn(INPUT, "w-full")}>{PIXELLAB_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="space-y-1"><span className={LABEL}>Seed (opcional)</span><input value={seedText} onChange={(event) => setSeedText(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="automática" className={cn(INPUT, "w-full font-mono")} /></label>
        </div>

        <div className="rounded border border-border bg-canvas p-2">
          <label className="flex items-center justify-between gap-2 text-[9px]"><span><b>Usar mapa/seleção como Init Image</b><br /><span className="text-muted-foreground">Seleção atual tem prioridade; máximo 20×20 metatiles.</span></span><input type="checkbox" checked={useInit} onChange={(event) => setUseInit(event.target.checked)} /></label>
          <div className={cn("mt-1.5 rounded border px-2 py-1.5 text-[8px]", region.ok ? "border-success/25 text-success" : "border-warning/30 text-warning")}>{region.ok ? `${region.source === "selection" ? "Seleção" : "Mapa inteiro"}: (${region.bounds.x},${region.bounds.y}) ${region.bounds.w}×${region.bounds.h} tiles → ${region.pixelWidth}×${region.pixelHeight}px` : region.message}</div>
          <label className="mt-2 flex items-center justify-between gap-2 text-[9px]"><span><b>Usar paleta atual</b><br /><span className="text-muted-foreground">Extrai até 24 cores reais da região.</span></span><input type="checkbox" disabled={!mapReferenceAvailable} checked={usePalette && mapReferenceAvailable} onChange={(event) => setUsePalette(event.target.checked)} /></label>
          {!atlas && <p className="mt-1 text-[8px] text-warning">Carregue o atlas/tileset real para habilitar Init Image e paleta.</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className={LABEL}>Largura</span><input type="number" min={32} max={320} disabled={useInit} value={outputWidth} onChange={(event) => setWidth(Math.max(32, Math.min(320, Number(event.target.value) || 32)))} className={cn(INPUT, "w-full")} /></label>
          <label className="space-y-1"><span className={LABEL}>Altura</span><input type="number" min={32} max={320} disabled={useInit} value={outputHeight} onChange={(event) => setHeight(Math.max(32, Math.min(320, Number(event.target.value) || 32)))} className={cn(INPUT, "w-full")} /></label>
        </div>

        <details className="rounded border border-border bg-canvas p-2"><summary className="cursor-pointer text-[9px] font-semibold">Ajustes PixelLab</summary><div className="mt-2 space-y-2">
          <label className="block text-[8px]">Guidance: <b>{guidance}</b><input type="range" min={1} max={20} step={0.5} value={guidance} onChange={(event) => setGuidance(Number(event.target.value))} className="mt-1 w-full" /></label>
          <label className="block text-[8px]">Init strength: <b>{initStrength}</b><input type="range" min={1} max={999} value={initStrength} onChange={(event) => setInitStrength(Number(event.target.value))} className="mt-1 w-full" /></label>
          <div className="grid grid-cols-3 gap-1.5">
            <select value={outline} onChange={(event) => setOutline(event.target.value as PixelLabOutline)} className={cn(INPUT, "min-w-0 w-full")}>{OUTLINE_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={shading} onChange={(event) => setShading(event.target.value as PixelLabShading)} className={cn(INPUT, "min-w-0 w-full")}>{SHADING_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={detail} onChange={(event) => setDetail(event.target.value as PixelLabDetail)} className={cn(INPUT, "min-w-0 w-full")}>{DETAIL_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select>
          </div>
        </div></details>

        <button type="button" disabled={busy || tracking || !prompt.trim() || (useInit && (!mapReferenceAvailable || !region.ok))} onClick={() => void generate(false)} className="w-full rounded border border-primary/50 bg-primary/15 px-3 py-2 text-[10px] font-semibold text-primary hover:bg-primary/25 disabled:opacity-35">{busy ? "Preparando…" : tracking ? "PixelLab processando…" : "✦ Gerar concept"}</button>
        {tracking && <button type="button" onClick={() => setTracking(false)} className="w-full rounded border border-border bg-toolbar px-2 py-1.5 text-[9px] text-muted-foreground hover:bg-surface">Parar acompanhamento local</button>}
        <div className="rounded border border-border bg-canvas px-2 py-1.5 text-[8px] leading-relaxed text-muted-foreground">{jobMessage}</div>

        {result && <div className="space-y-2 rounded border border-success/25 bg-success/5 p-2">
          <img src={result.imageDataUrl} alt="Concept PixelLab" className="mx-auto max-h-64 max-w-full border border-border bg-canvas" style={{ imageRendering: "pixelated" }} />
          <div className="text-[8px] text-muted-foreground">{result.width}×{result.height}px · seed {result.seed ?? "automática"} · {prettyUsage(result.usage)}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {result.bounds && (overlay.visible ? <button type="button" onClick={() => pixelLabOverlayStore.hide()} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface">Ocultar overlay</button> : <button type="button" onClick={showOverlay} className="rounded border border-success/35 bg-success/10 px-2 py-1.5 text-[8px] text-success hover:bg-success/20">Mostrar como overlay</button>)}
            <button type="button" onClick={downloadResult} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface">Baixar PNG</button>
            <button type="button" disabled={busy || tracking} onClick={() => void generate(true)} className="rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] hover:bg-surface disabled:opacity-35">Gerar variação</button>
          </div>
          {result.bounds && overlay.imageDataUrl && <label className="block text-[8px] text-muted-foreground">Opacidade do overlay: {Math.round(overlay.opacity * 100)}%<input type="range" min={5} max={100} value={Math.round(overlay.opacity * 100)} onChange={(event) => pixelLabOverlayStore.setOpacity(Number(event.target.value) / 100)} className="mt-1 w-full" /></label>}
          {!result.bounds && <p className="text-[8px] text-warning">Sem Init Image: o resultado fica somente como referência; não há alinhamento espacial confiável.</p>}
        </div>}

        <p className="text-[8px] leading-relaxed text-muted-foreground">A geração nunca altera map.bin, map.json, colisão, elevação, eventos ou Undo. A chave da API nunca é digitada neste painel.</p>
      </div></div>}
    </section>
  );
}
