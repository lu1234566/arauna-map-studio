import { Bot, Braces, Check, Hammer, Sparkles, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { applyCompiledAiMap } from "@/lib/aiMapApply";
import {
  compileAiMapPlan,
  parseAiMapPlanJson,
  parseDetailedMapCommand,
  type AiMapCompileResult,
  type AiMapPlan,
} from "@/lib/aiMapPlan";
import { planMapWithGemini } from "@/lib/aiMapPlan.functions";
import { isAiRemodelPrompt } from "@/lib/aiMapReconstruction";
import { deriveAiReservedCells } from "@/lib/aiMapReservedCells";
import { useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

const EXAMPLE = `Mapa 20x20; nome="Vila Amanhecer IA"
estrutura "Casa do jogador" usar "casa do jogador" em (2,4)
estrutura "Laboratório" usar "Laboratório" em (3,12)
warp porta "Casa do jogador"."entrada" -> MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F:0
warp porta "Laboratório"."entrada" -> MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB:0
saida norte -> MAP_ROUTE101 offset 0`;

function SmallBadge({ children, good }: { children: React.ReactNode; good?: boolean }) {
  return (
    <span className={cn(
      "rounded border px-1.5 py-0.5 font-mono text-[8px]",
      good ? "border-success/30 bg-success/10 text-success" : "border-border bg-canvas text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

export function AiCityBuilderDock() {
  const editor = useEditor();
  const atlas = useRealAtlas();
  const patternState = usePatternLibrary();
  const pathState = useSmartPath();
  const runGemini = useServerFn(planMapWithGemini);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<AiMapPlan | null>(null);
  const [compiled, setCompiled] = useState<AiMapCompileResult | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Descreva a cidade com posições, estruturas, portas, rotas e saídas.");
  const [onlineModel, setOnlineModel] = useState<string | null>(null);

  const compatiblePatterns = useMemo(() => patternState.patterns.filter((pattern) => (
    !pattern.scope || Boolean(atlas && pattern.scope.primary === atlas.primary && pattern.scope.secondary === atlas.secondary)
  )), [patternState.patterns, atlas?.primary, atlas?.secondary]);

  const compatiblePaths = useMemo(() => pathState.presets.filter((preset) => (
    !preset.scope || Boolean(atlas && preset.scope.primary === atlas.primary && preset.scope.secondary === atlas.secondary)
  )), [pathState.presets, atlas?.primary, atlas?.secondary]);

  const reservedCells = useMemo(() => deriveAiReservedCells(
    editor.events,
    editor.mapJsonDocument,
    editor.map.width,
    editor.map.height,
  ), [editor.events, editor.mapJsonDocument, editor.map.width, editor.map.height]);

  const reconstructionActive = Boolean(editor.mapJsonDocument && isAiRemodelPrompt(prompt));

  const vocabulary = useMemo(() => ({
    patterns: compatiblePatterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      category: pattern.category,
      tags: pattern.tags,
      width: pattern.width,
      height: pattern.height,
      ports: pattern.ports ?? [],
    })),
    smartPaths: compatiblePaths.map((preset) => ({ id: preset.id, name: preset.name })),
  }), [compatiblePatterns, compatiblePaths]);

  const setAndCompile = (next: AiMapPlan, source: string) => {
    const result = compileAiMapPlan(next, compatiblePatterns, compatiblePaths);
    setPlan(next);
    setCompiled(result);
    setRawJson(`${JSON.stringify(next, null, 2)}\n`);
    setMessage(result.valid
      ? `${source}: plano válido — ${next.structures.length} estrutura(s), ${next.routes.length} rota(s), ${result.warps.length} warp(s), ${next.connections.length} conexão(ões).`
      : `${source}: ${result.errors[0] ?? "plano inválido."}`);
    return result;
  };

  const interpretLocal = () => {
    const parsed = parseDetailedMapCommand(
      prompt,
      compatiblePatterns,
      compatiblePaths,
      editor.map.width,
      editor.map.height,
    );
    if (!parsed.plan) {
      setPlan(null);
      setCompiled(null);
      setMessage(parsed.errors.join(" "));
      return;
    }
    setOnlineModel(null);
    setAndCompile(parsed.plan, "Interpretador preciso");
  };

  const interpretAi = async () => {
    if (!prompt.trim()) {
      setMessage("Escreva o comando antes de gerar.");
      return;
    }
    setBusy(true);
    setMessage("IA planejando a distribuição e validando o vocabulário GBA compatível com o tileset atual…");
    try {
      const response = await runGemini({
        data: {
          prompt,
          width: editor.map.width,
          height: editor.map.height,
          patterns: vocabulary.patterns,
          smartPaths: vocabulary.smartPaths,
          reservedCells,
        },
      });
      if (!response.ok) {
        setOnlineModel(null);
        setMessage(response.message);
        return;
      }
      setOnlineModel(response.model);
      setAndCompile(response.plan, `IA ${response.model}`);
    } catch (error) {
      setOnlineModel(null);
      setMessage(`Falha ao chamar a IA: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const compileEditedJson = () => {
    try {
      const next = parseAiMapPlanJson(rawJson);
      setAndCompile(next, "JSON editado");
    } catch (error) {
      setCompiled(null);
      setMessage(`JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const applyPlan = () => {
    if (!plan || !compiled?.valid || !compiled.template) return;
    const result = applyCompiledAiMap({
      prompt,
      plan,
      compiled,
      atlas,
      patterns: compatiblePatterns,
      smartPaths: compatiblePaths,
      reservedCells,
    });
    setMessage(result.message);
    if (!result.ok) return;
    requestMapCameraFit();
    setOpen(false);
  };

  return (
    <section className="absolute right-2 top-24 z-40 overflow-hidden rounded border border-primary/35 bg-panel/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-semibold",
            open ? "border-primary/60 bg-primary/20 text-primary" : "border-primary/35 bg-toolbar text-foreground hover:bg-surface",
          )}
          title="Construir mapa por prompt usando IA + compilador GBA seguro"
        >
          <WandSparkles className="size-3.5" /> Construir com IA
        </button>
        {!open && <span className="text-[8px] text-muted-foreground">prompt → cidade GBA</span>}
      </div>

      {open && (
        <div className="w-[560px] max-w-[calc(100vw-330px)] border-t border-border">
          <div className="space-y-2 p-2.5">
            <div className="flex flex-wrap gap-1">
              <SmallBadge good={compatiblePatterns.length >= 6}>{compatiblePatterns.length}/{patternState.patterns.length} Patterns compatíveis</SmallBadge>
              <SmallBadge good={Boolean(compatiblePaths.length)}>{compatiblePaths.length}/{pathState.presets.length} Smart Paths compatíveis</SmallBadge>
              <SmallBadge>{editor.map.width}×{editor.map.height}</SmallBadge>
              <SmallBadge good={Boolean(editor.mapJsonDocument)}>{editor.mapJsonDocument ? "map.json ativo" : "sem map.json"}</SmallBadge>
              {editor.mapJsonDocument && <SmallBadge good>{reservedCells.length} células/eventos protegidos</SmallBadge>}
              {atlas && <SmallBadge good>{atlas.secondary.replace(/^gTileset_/, "")}</SmallBadge>}
              {reconstructionActive && <SmallBadge good>Reconstrução de base ON</SmallBadge>}
              {onlineModel && <SmallBadge good>{onlineModel}</SmallBadge>}
            </div>

            {editor.mapJsonDocument ? (
              <div className="rounded border border-success/25 bg-success/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
                Mapa real ativo. O Studio usa somente Patterns/Smart Paths compatíveis com <b className="text-foreground">{atlas?.primary ?? "tileset primary"} + {atlas?.secondary ?? "tileset secondary"}</b>. Fachadas, trechos e eventos do próprio mapa entram automaticamente no planejamento, e uma verificação local bloqueia prédios sobre warps/triggers/NPCs.
              </div>
            ) : (
              <div className="rounded border border-warning/35 bg-warning/5 p-2 text-[9px] leading-relaxed text-warning">
                Para gerar um mapa que possa entrar no jogo, prefira <b>Workspace → abrir o mapa real</b>. Um BIN isolado não informa layout/tileset, warps, NPCs ou conexões; importe também o map.json ou use Workspace.
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              spellCheck={false}
              placeholder={'Ex.: "Laboratório no nordeste em (12,3), casa do jogador em (3,12), ligue a entrada da casa à praça e crie a saída norte para MAP_ROUTE101."'}
              className="h-36 w-full resize-y rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed outline-none focus:border-primary/60"
            />

            {reconstructionActive && (
              <div className="rounded border border-primary/30 bg-primary/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
                <b className="text-primary">Remodelagem ampla detectada.</b> Antes do Template, o Studio vai reconstruir somente piso NORMAL seguro: água/costa, colisão/elevação, warps, triggers e regiões ancoradas/fixas permanecem intactos. Pedidos pontuais não ativam esta etapa.
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setPrompt(EXAMPLE)} className="rounded border border-border bg-toolbar px-2 py-1 text-[9px] hover:bg-surface">Exemplo preciso</button>
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={interpretLocal}
                className="inline-flex items-center gap-1 rounded border border-border bg-toolbar px-2 py-1 text-[9px] hover:bg-surface disabled:opacity-35"
                title="Funciona sem API; exige comandos explícitos com coordenadas"
              >
                <Braces className="size-3" /> Interpretar local
              </button>
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={() => void interpretAi()}
                className="ml-auto inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/15 px-2.5 py-1 text-[9px] font-semibold text-primary hover:bg-primary/25 disabled:opacity-35"
              >
                {busy ? <Sparkles className="size-3 animate-pulse" /> : <Bot className="size-3" />} Gerar com IA
              </button>
            </div>

            {(rawJson || compiled) && (
              <div className="grid grid-cols-[1fr_190px] gap-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[8px] uppercase tracking-wide text-muted-foreground">Plano estruturado</span>
                    <button type="button" onClick={compileEditedJson} className="rounded border border-border px-1.5 py-0.5 text-[8px] hover:bg-surface">Revalidar JSON</button>
                  </div>
                  <textarea
                    value={rawJson}
                    onChange={(event) => setRawJson(event.target.value)}
                    spellCheck={false}
                    className="h-44 w-full resize-y rounded border border-border bg-canvas p-2 font-mono text-[8px] leading-relaxed outline-none focus:border-primary/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className={cn(
                    "rounded border p-2 text-[9px]",
                    compiled?.valid ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive",
                  )}>
                    <div className="flex items-center gap-1 font-semibold">
                      {compiled?.valid ? <Check className="size-3" /> : <X className="size-3" />}
                      {compiled?.valid ? "Plano compilável" : "Revisão necessária"}
                    </div>
                    {plan && (
                      <div className="mt-1 space-y-0.5 opacity-90">
                        <p>{plan.structures.length} estrutura(s)</p>
                        <p>{plan.routes.length} rota(s)</p>
                        <p>{compiled?.warps.length ?? 0} warp(s)</p>
                        <p>{plan.connections.length} conexão(ões)</p>
                      </div>
                    )}
                  </div>
                  {compiled?.errors.length ? <div className="max-h-24 overflow-y-auto rounded border border-destructive/25 p-1.5 text-[8px] text-destructive">{compiled.errors.join(" ")}</div> : null}
                  {compiled?.warnings.length ? <div className="max-h-24 overflow-y-auto rounded border border-warning/25 p-1.5 text-[8px] text-warning">{compiled.warnings.join(" ")}</div> : null}
                  <button
                    type="button"
                    disabled={!compiled?.valid || !compiled.template}
                    onClick={applyPlan}
                    className="inline-flex w-full items-center justify-center gap-1 rounded border border-success/50 bg-success/10 px-2 py-2 text-[9px] font-semibold text-success hover:bg-success/20 disabled:pointer-events-none disabled:opacity-35"
                  >
                    <Hammer className="size-3.5" /> Aplicar cidade no mapa
                  </button>
                </div>
              </div>
            )}

            <div className={cn(
              "rounded border px-2 py-1.5 text-[9px] leading-relaxed",
              compiled?.valid ? "border-success/25 bg-success/5 text-success" : "border-border bg-canvas text-muted-foreground",
            )}>
              {message}
            </div>

            <details className="text-[8px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Sintaxe local precisa (sem IA)</summary>
              <pre className="mt-1 whitespace-pre-wrap rounded border border-border bg-canvas p-2 font-mono leading-relaxed">{EXAMPLE}</pre>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
