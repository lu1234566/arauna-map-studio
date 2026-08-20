import { Bot, Braces, Check, Hammer, Sparkles, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { applyCompiledAiMap } from "@/lib/aiMapApply";
import { planLayeredPromptBase } from "@/lib/aiLayeredPrompt";
import { planAiMapIdentityBase } from "@/lib/aiMapIdentity";
import {
  compileAiMapPlan,
  parseAiMapPlanJson,
  parseDetailedMapCommand,
  type AiMapCompileResult,
  type AiMapPlan,
} from "@/lib/aiMapPlan";
import { planMapWithGemini } from "@/lib/aiMapPlan.functions";
import { isAiRemodelPrompt, planAiMapReconstruction } from "@/lib/aiMapReconstruction";
import { deriveAiReservedCells } from "@/lib/aiMapReservedCells";
import { getCollision, METATILE_MASK } from "@/lib/emeraldMap";
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

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canonicalizeLayerPrompt(value: string) {
  const lines = value.split(/\r?\n/);
  const result: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const hasRange = /\bx\s*[:=]\s*-?\d+\s*(?:\.\.|…|ate|até|a|-)\s*-?\d+/i.test(line)
      && /\by\s*[:=]\s*-?\d+\s*(?:\.\.|…|ate|até|a|-)\s*-?\d+/i.test(line);
    if (!hasRange || /(?:→|->|=>)/.test(line)) {
      result.push(line);
      continue;
    }
    let next = index + 1;
    while (next < lines.length && !lines[next]!.trim()) next++;
    const materialLine = lines[next]?.trim() ?? "";
    if (/^(?:→|->|=>)\s*\S+/i.test(materialLine)) {
      result.push(`${line.trimEnd()} ${materialLine}`);
      for (let skipped = index + 1; skipped < next; skipped++) result.push(lines[skipped] ?? "");
      index = next;
      continue;
    }
    result.push(line);
  }
  return result.join("\n");
}

function axisRange(line: string, axis: "x" | "y") {
  const match = line.match(new RegExp(`\\b${axis}\\s*[:=]\\s*(-?\\d+)\\s*(?:\\.\\.|…|ate|até|a|-)\\s*(-?\\d+)`, "i"));
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function roleForLayerLine(line: string) {
  const arrow = line.match(/(?:→|->|=>)\s*(.+)$/);
  if (!arrow) return null;
  const key = normalized(arrow[1] ?? "");
  if (/(preserv|manter|nao alterar|agua|costa|litoral)/.test(key)) return "preserve" as const;
  if (/(grama|verde|veget|jardim|parque)/.test(key)) return "green" as const;
  if (/(bege|areia|portuar|porto|cais|promenade|doca)/.test(key)) return "port" as const;
  if (/(concret|paviment|urbano|calcad|asfalto|residencial)/.test(key)) return "urban" as const;
  if (/(base|neutro|comum|solo comum|piso comum)/.test(key)) return "base" as const;
  return null;
}

function hexMetatile(id: number) {
  return `0x${(id & METATILE_MASK).toString(16).toUpperCase().padStart(3, "0")}`;
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

  const canonicalPrompt = useMemo(() => canonicalizeLayerPrompt(prompt), [prompt]);
  const reconstructionActive = Boolean(editor.mapJsonDocument && isAiRemodelPrompt(canonicalPrompt));
  const reconstructionPreview = useMemo(() => reconstructionActive
    ? planAiMapReconstruction(editor.map, atlas, compatiblePatterns, reservedCells, compatiblePaths)
    : null, [
      reconstructionActive,
      editor.map,
      atlas?.createdAt,
      compatiblePatterns,
      compatiblePaths,
      reservedCells,
    ]);

  const identityPreview = useMemo(() => (
    reconstructionActive && reconstructionPreview
      ? planAiMapIdentityBase(reconstructionPreview.map, atlas, compatiblePatterns, reservedCells, reconstructionPreview)
      : null
  ), [reconstructionActive, reconstructionPreview, atlas?.createdAt, compatiblePatterns, reservedCells]);

  const resolvedPrompt = useMemo(() => {
    if (!atlas || !reconstructionPreview) return canonicalPrompt;
    const records = new Map(atlas.records.map((record) => [record.id & METATILE_MASK, record]));
    const safe = (id: number) => {
      const record = records.get(id & METATILE_MASK);
      return Boolean(record && (record.behavior ?? -1) === 0 && (record.layerType ?? 0) === 0);
    };
    const dominantInRange = (line: string, excluded: Set<number>) => {
      const xr = axisRange(line, "x");
      const yr = axisRange(line, "y");
      if (!xr || !yr) return null;
      const counts = new Map<number, number>();
      for (let y = Math.max(0, yr.min); y <= Math.min(editor.map.height - 1, yr.max); y++) {
        for (let x = Math.max(0, xr.min); x <= Math.min(editor.map.width - 1, xr.max); x++) {
          const cellIndex = y * editor.map.width + x;
          if (getCollision(editor.map.physical[cellIndex] ?? 0) !== 0) continue;
          const id = (editor.map.metatiles[cellIndex] ?? 0) & METATILE_MASK;
          if (!id || excluded.has(id) || !safe(id)) continue;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };

    const base = reconstructionPreview.baseMetatile;
    const urban = reconstructionPreview.urbanMetatile;
    const green = reconstructionPreview.greenMetatile;
    const port = identityPreview?.portMetatile ?? null;
    return canonicalPrompt.split(/\r?\n/).map((line) => {
      if (!/(?:→|->|=>)/.test(line) || /(?:metatile|tile|id)?\s*0x[0-9a-f]{1,3}\b/i.test(line)) return line;
      const role = roleForLayerLine(line);
      if (!role || role === "preserve") return line;
      const excluded = new Set<number>();
      if (base != null) excluded.add(base & METATILE_MASK);
      let desired: number | null = null;
      if (role === "base") desired = base;
      if (role === "urban") desired = urban ?? dominantInRange(line, excluded);
      if (urban != null) excluded.add(urban & METATILE_MASK);
      if (role === "green") desired = green ?? dominantInRange(line, excluded);
      if (green != null) excluded.add(green & METATILE_MASK);
      if (role === "port") desired = port ?? dominantInRange(line, excluded);
      if (desired == null || !safe(desired)) return line;
      return line.replace(/(?:→|->|=>)\s*(.+)$/, `-> metatile ${hexMetatile(desired)}`);
    }).join("\n");
  }, [canonicalPrompt, atlas?.createdAt, reconstructionPreview, identityPreview?.portMetatile, editor.map]);

  const layeredPreview = useMemo(() => (
    reconstructionPreview && compiled?.valid
      ? planLayeredPromptBase(
          editor.map,
          resolvedPrompt,
          atlas,
          compatiblePatterns,
          reservedCells,
          reconstructionPreview,
          identityPreview?.portMetatile ?? null,
          compiled.blueprint,
        )
      : null
  ), [
    reconstructionPreview,
    compiled,
    editor.map,
    resolvedPrompt,
    atlas?.createdAt,
    compatiblePatterns,
    reservedCells,
    identityPreview?.portMetatile,
  ]);

  const layeredReady = !layeredPreview?.active || layeredPreview.errors.length === 0;
  const planReady = Boolean(compiled?.valid && compiled.template && layeredReady);

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
    if (!plan || !compiled?.valid || !compiled.template) {
      setMessage("Aplicação indisponível: o plano estruturado ainda não está compilável.");
      return;
    }
    if (layeredPreview?.active && layeredPreview.errors.length) {
      setMessage(`Aplicação bloqueada pelo preflight A+B: ${layeredPreview.errors.slice(0, 3).join(" ")}`);
      return;
    }
    setMessage("Aplicando zone-first + finish layer ao mapa…");
    try {
      const result = applyCompiledAiMap({
        prompt: resolvedPrompt,
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
    } catch (error) {
      setMessage(`Falha real ao aplicar o mapa: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="absolute right-2 top-24 z-40 flex max-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded border border-primary/35 bg-panel/95 shadow-2xl backdrop-blur-sm">
      <div className="shrink-0 flex items-center gap-1.5 p-1.5">
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
        <div className="flex min-h-0 w-[560px] max-w-[calc(100vw-330px)] flex-1 flex-col border-t border-border">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-2 p-2.5 pb-3">
              <div className="flex flex-wrap gap-1">
                <SmallBadge good={compatiblePatterns.length >= 6}>{compatiblePatterns.length}/{patternState.patterns.length} Patterns compatíveis</SmallBadge>
                <SmallBadge good={Boolean(compatiblePaths.length)}>{compatiblePaths.length}/{pathState.presets.length} Smart Paths compatíveis</SmallBadge>
                <SmallBadge>{editor.map.width}×{editor.map.height}</SmallBadge>
                <SmallBadge good={Boolean(editor.mapJsonDocument)}>{editor.mapJsonDocument ? "map.json ativo" : "sem map.json"}</SmallBadge>
                {editor.mapJsonDocument && <SmallBadge good>{reservedCells.length} células/eventos protegidos</SmallBadge>}
                {atlas && <SmallBadge good>{atlas.secondary.replace(/^gTileset_/, "")}</SmallBadge>}
                {reconstructionActive && <SmallBadge good>Reconstrução de base ON</SmallBadge>}
                {reconstructionPreview?.baseMetatile != null && (
                  <SmallBadge good={reconstructionPreview.changedCount > 0}>
                    base {hexMetatile(reconstructionPreview.baseMetatile)} · {reconstructionPreview.changedCount} células
                  </SmallBadge>
                )}
                {layeredPreview?.active && (
                  <SmallBadge good={layeredReady}>A+B {layeredPreview.parsed.zones.length} zonas</SmallBadge>
                )}
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
                className="h-32 max-h-56 w-full resize-y rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed outline-none focus:border-primary/60"
              />

              {reconstructionActive && (
                <div className="max-h-24 overflow-y-auto rounded border border-primary/30 bg-primary/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
                  <b className="text-primary">Remodelagem ampla detectada.</b> Antes do Template, o Studio vai reconstruir somente piso NORMAL seguro: água/costa, colisão/elevação, warps, triggers e regiões ancoradas/fixas permanecem intactos. Pedidos pontuais não ativam esta etapa.
                  {reconstructionPreview?.warnings[0] ? <span> {reconstructionPreview.warnings[0]}</span> : null}
                </div>
              )}

              {layeredPreview?.active && layeredPreview.errors.length ? (
                <div className="max-h-24 overflow-y-auto rounded border border-destructive/35 bg-destructive/5 p-2 text-[9px] leading-relaxed text-destructive">
                  <b>Preflight A+B:</b> {layeredPreview.errors.join(" ")}
                </div>
              ) : layeredPreview?.active ? (
                <div className="rounded border border-success/25 bg-success/5 p-2 text-[9px] leading-relaxed text-success">
                  Preflight A+B válido: {layeredPreview.assignedCount}/{layeredPreview.eligibleCount} células editáveis atribuídas; {layeredPreview.unsetCount} UNSET/preservadas.
                </div>
              ) : null}

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
                <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[8px] uppercase tracking-wide text-muted-foreground">Plano estruturado</span>
                      <button type="button" onClick={compileEditedJson} className="rounded border border-border px-1.5 py-0.5 text-[8px] hover:bg-surface">Revalidar JSON</button>
                    </div>
                    <textarea
                      value={rawJson}
                      onChange={(event) => setRawJson(event.target.value)}
                      spellCheck={false}
                      className="h-36 max-h-52 w-full resize-y rounded border border-border bg-canvas p-2 font-mono text-[8px] leading-relaxed outline-none focus:border-primary/60"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className={cn(
                      "rounded border p-2 text-[9px]",
                      planReady ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive",
                    )}>
                      <div className="flex items-center gap-1 font-semibold">
                        {planReady ? <Check className="size-3" /> : <X className="size-3" />}
                        {planReady ? "Plano + camadas aplicáveis" : "Revisão necessária"}
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
                    {compiled?.errors.length ? <div className="max-h-20 overflow-y-auto rounded border border-destructive/25 p-1.5 text-[8px] text-destructive">{compiled.errors.join(" ")}</div> : null}
                    {layeredPreview?.errors.length ? <div className="max-h-20 overflow-y-auto rounded border border-destructive/25 p-1.5 text-[8px] text-destructive">{layeredPreview.errors.join(" ")}</div> : null}
                    {compiled?.warnings.length ? <div className="max-h-20 overflow-y-auto rounded border border-warning/25 p-1.5 text-[8px] text-warning">{compiled.warnings.join(" ")}</div> : null}
                  </div>
                </div>
              )}

              <details className="text-[8px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Sintaxe local precisa (sem IA)</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded border border-border bg-canvas p-2 font-mono leading-relaxed">{EXAMPLE}</pre>
              </details>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-panel/98 p-2 shadow-[0_-8px_20px_rgba(0,0,0,0.22)]">
            <div className={cn(
              "mb-1.5 max-h-16 overflow-y-auto rounded border px-2 py-1.5 text-[9px] leading-relaxed",
              planReady ? "border-success/25 bg-success/5 text-success" : "border-border bg-canvas text-muted-foreground",
            )}>
              {message}
            </div>
            <button
              type="button"
              disabled={!planReady}
              onClick={applyPlan}
              className="inline-flex w-full items-center justify-center gap-1 rounded border border-success/50 bg-success/10 px-2 py-2 text-[10px] font-semibold text-success hover:bg-success/20 disabled:pointer-events-none disabled:opacity-35"
            >
              <Hammer className="size-3.5" /> Aplicar cidade no mapa
            </button>
          </div>
        </div>
      )}
    </section>
  );
}