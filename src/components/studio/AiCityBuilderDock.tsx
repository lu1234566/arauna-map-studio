import { Bot, Braces, Check, Hammer, Sparkles, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  compileAiMapPlan,
  parseAiMapPlanJson,
  parseDetailedMapCommand,
  type AiMapCompileResult,
  type AiMapPlan,
} from "@/lib/aiMapPlan";
import { planMapWithGemini } from "@/lib/aiMapPlan.functions";
import { editorStore, useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import { serializeMapTemplates } from "@/lib/mapTemplate";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

const EXAMPLE = `Mapa 20x20; nome="Vila Amanhecer IA"
estrutura "Casa do jogador" usar "casa do jogador" em (2,4)
estrutura "Laboratório" usar "Laboratório" em (3,12)
warp porta "Casa do jogador"."entrada" -> MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F:0
warp porta "Laboratório"."entrada" -> MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB:0
saida norte -> MAP_ROUTE101 offset 0`;

const CONNECTION_DIRECTION = {
  north: "up",
  east: "right",
  south: "down",
  west: "left",
} as const;

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

function connectionIndex(direction: string) {
  const document = editorStore.getState().mapJsonDocument;
  const source = document?.["connections"];
  const connections = Array.isArray(source) ? source : [];
  return connections.findIndex((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return String((value as Record<string, unknown>)["direction"] ?? "") === direction;
  });
}

export function AiCityBuilderDock() {
  const editor = useEditor();
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

  const vocabulary = useMemo(() => ({
    patterns: patternState.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      category: pattern.category,
      tags: pattern.tags,
      width: pattern.width,
      height: pattern.height,
      ports: pattern.ports ?? [],
    })),
    smartPaths: pathState.presets.map((preset) => ({ id: preset.id, name: preset.name })),
  }), [patternState.patterns, pathState.presets]);

  const setAndCompile = (next: AiMapPlan, source: string) => {
    const result = compileAiMapPlan(next, patternState.patterns, pathState.presets);
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
      patternState.patterns,
      pathState.presets,
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
    setMessage("IA planejando a distribuição e validando o vocabulário…");
    try {
      const response = await runGemini({
        data: {
          prompt,
          width: editor.map.width,
          height: editor.map.height,
          patterns: vocabulary.patterns,
          smartPaths: vocabulary.smartPaths,
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
    if (plan.width !== editor.map.width || plan.height !== editor.map.height) {
      setMessage(`O plano mede ${plan.width}×${plan.height}, mas o mapa aberto mede ${editor.map.width}×${editor.map.height}. Ajuste o comando antes de aplicar.`);
      return;
    }
    const imported = mapTemplateStore.importJson(serializeMapTemplates([compiled.template]));
    if (!imported.ok) {
      setMessage(`Falha ao instalar Template: ${imported.message}`);
      return;
    }
    if (!mapTemplateStore.setEnabled(true)) {
      setMessage("O Template foi salvo, mas não pôde ser ativado. Verifique tileset/Patterns/Smart Paths.");
      return;
    }
    const changes = mapTemplateStore.applyAt(0, 0);
    mapTemplateStore.setEnabled(false);
    mapTemplateStore.setPanelOpen(false);

    let topologyApplied = 0;
    let topologyPending = 0;
    if (editorStore.getState().mapJsonDocument) {
      for (const warp of compiled.warps) {
        const existing = editorStore.getState().events.find(
          (event) => event.source === "warp" && event.x === warp.x && event.y === warp.y,
        );
        const id = existing?.id ?? editorStore.createEvent("warp", warp.x, warp.y);
        if (!id) continue;
        editorStore.updateEventField(id, "dest_map", warp.destMap);
        editorStore.updateEventField(id, "dest_warp_id", warp.destWarpId);
        topologyApplied++;
      }
      for (const connection of compiled.connections) {
        const direction = CONNECTION_DIRECTION[connection.direction];
        let index = connectionIndex(direction);
        if (index < 0) {
          const created = editorStore.createConnection(direction);
          if (created == null) continue;
          index = created;
        }
        editorStore.updateConnection(index, "map", connection.map);
        editorStore.updateConnection(index, "offset", connection.offset);
        topologyApplied++;
      }
    } else {
      topologyPending = compiled.warps.length + compiled.connections.length;
    }
    const topologyText = topologyPending
      ? ` ${topologyPending} warp/conexão ficaram pendentes porque este mapa ainda não tem map.json aberto.`
      : topologyApplied
        ? ` ${topologyApplied} warp/conexão foram criados ou atualizados no map.json.`
        : "";
    requestMapCameraFit();
    setMessage(`Mapa aplicado: ${changes} alteração(ões) de tile/camada.${topologyText}`);
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
              <SmallBadge good={Boolean(patternState.patterns.length)}>{patternState.patterns.length} Patterns</SmallBadge>
              <SmallBadge good={Boolean(pathState.presets.length)}>{pathState.presets.length} Smart Paths</SmallBadge>
              <SmallBadge>{editor.map.width}×{editor.map.height}</SmallBadge>
              <SmallBadge good={Boolean(editor.mapJsonDocument)}>{editor.mapJsonDocument ? "map.json ativo" : "sem map.json"}</SmallBadge>
              {onlineModel && <SmallBadge good>{onlineModel}</SmallBadge>}
            </div>

            <div className="rounded border border-primary/25 bg-primary/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
              Diga exatamente onde cada estrutura fica. A IA só pode usar estruturas e caminhos já cadastrados. Para portas sem <b className="text-foreground">port</b> semântico, informe a coordenada exata da entrada. Warps e conexões só são criados quando o destino é explicitamente informado.
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              spellCheck={false}
              placeholder={'Ex.: "Laboratório no nordeste em (12,3), casa do jogador em (3,12), ligue a entrada da casa à praça e crie a saída norte para MAP_ROUTE101."'}
              className="h-36 w-full resize-y rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed outline-none focus:border-primary/60"
            />

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
