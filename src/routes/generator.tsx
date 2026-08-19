import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Dices,
  ExternalLink,
  MapPinned,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { createEmptyMap, type MapData } from "@/lib/emeraldMap";
import {
  createBlueprintSpec,
  generateMapBlueprint,
  type BlueprintExits,
  type BlueprintResult,
  type MapBlueprintSpec,
} from "@/lib/mapBlueprint";
import { planMapTemplate, serializeMapTemplates } from "@/lib/mapTemplate";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { atlasSourceRect, realAtlasStore, useRealAtlas, type SavedRealAtlas } from "@/lib/realAtlasStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generator")({ component: BlueprintGenerator });

type PatternRole = "landmark" | "filler";

function currentScope(atlas: SavedRealAtlas | null) {
  return atlas ? { primary: atlas.primary, secondary: atlas.secondary } : undefined;
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function BlueprintGenerator() {
  const patterns = usePatternLibrary();
  const smartPaths = useSmartPath();
  const atlas = useRealAtlas();
  const [spec, setSpec] = useState<MapBlueprintSpec>(() => createBlueprintSpec(30, 24));
  const [result, setResult] = useState<BlueprintResult | null>(null);
  const [saved, setSaved] = useState("");

  const patternById = useMemo(
    () => new Map(patterns.patterns.map((pattern) => [pattern.id, pattern])),
    [patterns.patterns],
  );
  const pathById = useMemo(
    () => new Map(smartPaths.presets.map((preset) => [preset.id, preset])),
    [smartPaths.presets],
  );

  const previewMap = useMemo(() => {
    if (!result?.ok || !result.template) return null;
    const blank = createEmptyMap(spec.width, spec.height, 0);
    const plan = planMapTemplate(
      blank,
      result.template,
      0,
      0,
      patterns.patterns,
      smartPaths.presets,
      currentScope(atlas),
    );
    return plan.valid ? plan.map : null;
  }, [result, spec.width, spec.height, patterns.patterns, smartPaths.presets, atlas]);

  const setOptionalId = (field: "centerPatternId" | "roadPresetId", value: string) => {
    setSpec((current) => {
      const next: MapBlueprintSpec = { ...current };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
    setResult(null);
    setSaved("");
  };

  const update = <K extends keyof MapBlueprintSpec>(key: K, value: MapBlueprintSpec[K]) => {
    setSpec((current) => ({ ...current, [key]: value }));
    setResult(null);
    setSaved("");
  };

  const togglePattern = (role: PatternRole, id: string) => {
    const key = role === "landmark" ? "landmarkPatternIds" : "fillerPatternIds";
    const source = spec[key];
    update(key, source.includes(id) ? source.filter((item) => item !== id) : [...source, id]);
  };

  const toggleExit = (direction: keyof BlueprintExits) => {
    update("exits", { ...spec.exits, [direction]: !spec.exits[direction] });
  };

  const generate = () => {
    const next = generateMapBlueprint(spec, patterns.patterns, smartPaths.presets, currentScope(atlas));
    setResult(next);
    setSaved("");
  };

  const saveTemplate = () => {
    if (!result?.ok || !result.template) return;
    const importResult = mapTemplateStore.importJson(serializeMapTemplates([result.template]));
    setSaved(importResult.ok
      ? `Template salvo na biblioteca (${importResult.count}). Volte ao Editor e use T para posicioná-lo.`
      : `Falha ao salvar: ${importResult.message}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface">
          <ArrowLeft className="size-3.5" /> Editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Blueprint Generator</h1>
          <p className="text-[10px] text-muted-foreground">Composição determinística usando somente peças GBA verificadas</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <span className="rounded border border-border bg-canvas px-2 py-1">{patterns.patterns.length} padrões</span>
          <span className="rounded border border-border bg-canvas px-2 py-1">{smartPaths.presets.length} Smart Paths</span>
          <span className={cn(
            "rounded border px-2 py-1",
            atlas ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning",
          )}>
            {atlas ? `${atlas.primary} + ${atlas.secondary}` : "atlas real ausente"}
          </span>
          <button type="button" onClick={generate} className="inline-flex h-8 items-center gap-1.5 rounded border border-primary/50 bg-primary/15 px-3 text-xs font-semibold text-primary hover:bg-primary/20">
            <Sparkles className="size-3.5" /> Gerar blueprint
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(420px,1fr)_330px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border bg-panel p-3">
          <SectionTitle title="Mapa" subtitle="Dimensões e regras estruturais" />
          <label className="mb-2 block">
            <span className="field-label">Nome</span>
            <input value={spec.name} onChange={(event) => update("name", event.target.value)} className="input-compact w-full" />
          </label>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label><span className="field-label">Largura</span><input type="number" min={5} max={512} value={spec.width} onChange={(event) => update("width", numeric(event.target.value, spec.width))} className="input-compact w-full font-mono" /></label>
            <label><span className="field-label">Altura</span><input type="number" min={5} max={512} value={spec.height} onChange={(event) => update("height", numeric(event.target.value, spec.height))} className="input-compact w-full font-mono" /></label>
          </div>
          <label className="mb-2 block">
            <span className="field-label">Seed</span>
            <div className="flex gap-1">
              <input value={spec.seed} onChange={(event) => update("seed", event.target.value)} className="input-compact min-w-0 flex-1 font-mono" />
              <button type="button" title="Criar nova seed" onClick={() => update("seed", `arauna-${Date.now().toString(36)}`)} className="grid size-7 place-items-center rounded border border-border hover:bg-surface"><Dices className="size-3.5" /></button>
            </div>
          </label>
          <label className="mb-2 block"><span className="field-label">Categoria</span><input value={spec.category} onChange={(event) => update("category", event.target.value)} className="input-compact w-full" /></label>

          <div className="mb-4 grid grid-cols-3 gap-1.5">
            <label><span className="field-label">Margem</span><input type="number" min={0} max={32} value={spec.margin} onChange={(event) => update("margin", numeric(event.target.value, spec.margin))} className="input-compact w-full font-mono" /></label>
            <label><span className="field-label">Espaço</span><input type="number" min={0} max={16} value={spec.spacing} onChange={(event) => update("spacing", numeric(event.target.value, spec.spacing))} className="input-compact w-full font-mono" /></label>
            <label><span className="field-label">Fillers</span><input type="number" min={0} max={512} value={spec.fillerCount} onChange={(event) => update("fillerCount", numeric(event.target.value, spec.fillerCount))} className="input-compact w-full font-mono" /></label>
          </div>

          <SectionTitle title="Âncoras" subtitle="Centro e rede de circulação" />
          <label className="mb-2 block">
            <span className="field-label">Peça central</span>
            <select value={spec.centerPatternId ?? ""} onChange={(event) => setOptionalId("centerPatternId", event.target.value)} className="input-compact w-full">
              <option value="">Sem peça central</option>
              {patterns.patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} · {pattern.width}×{pattern.height}</option>)}
            </select>
          </label>
          <label className="mb-3 block">
            <span className="field-label">Estrada / conexão</span>
            <select value={spec.roadPresetId ?? ""} onChange={(event) => setOptionalId("roadPresetId", event.target.value)} className="input-compact w-full">
              <option value="">Sem Smart Path</option>
              {smartPaths.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>

          <span className="field-label">Saídas do mapa</span>
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {(["north", "east", "south", "west"] as const).map((direction) => (
              <button key={direction} type="button" onClick={() => toggleExit(direction)} className={cn("rounded border px-2 py-1.5 text-[10px]", spec.exits[direction] ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface")}>
                {spec.exits[direction] ? "✓ " : ""}{directionLabel(direction)}
              </button>
            ))}
          </div>

          <div className="rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">
            O gerador nunca escolhe metatile por conta própria. Ele posiciona <b className="text-foreground">patterns</b> já aprovados e cria ruas usando um <b className="text-foreground">Smart Path</b> já configurado.
          </div>
        </aside>

        <section className="min-w-0 overflow-y-auto bg-canvas p-4">
          <div className="mx-auto flex min-h-full max-w-[980px] flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Prévia do layout</h2>
                <p className="text-[10px] text-muted-foreground">A seed fixa o mesmo arranjo. Rotas usam busca em grade para contornar estruturas.</p>
              </div>
              <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface"><RefreshCw className="size-3.5" /> Recalcular</button>
            </div>

            <div className="grid min-h-[480px] flex-1 place-items-center overflow-auto rounded-lg border border-border bg-background/40 p-4 shadow-inner">
              {!result ? (
                <EmptyPreview title="Pronto para gerar" text="Escolha as peças à esquerda/direita e clique em Gerar blueprint." />
              ) : !result.ok ? (
                <EmptyPreview title="Blueprint bloqueado" text={result.errors.join(" ")} error />
              ) : previewMap ? (
                <GbaMapPreview map={previewMap} atlas={atlas} result={result} />
              ) : (
                <SchematicPreview result={result} width={spec.width} height={spec.height} />
              )}
            </div>

            {result?.ok && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Estruturas" value={String(result.placements.length)} />
                <Stat label="Conexões" value={String(result.roads.length)} />
                <Stat label="Elementos no template" value={String(result.template?.elements.length ?? 0)} />
              </div>
            )}

            {result?.warnings.length ? (
              <div className="rounded border border-warning/30 bg-warning/5 p-2 text-[10px] leading-relaxed text-warning">{result.warnings.join(" ")}</div>
            ) : null}
            {result?.errors.length ? (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-[10px] leading-relaxed text-destructive">{result.errors.join(" ")}</div>
            ) : null}
          </div>
        </section>

        <aside className="overflow-y-auto border-l border-border bg-panel p-3">
          <SectionTitle title="Vocabulário" subtitle="Quais peças o gerador pode usar" />
          {!patterns.patterns.length ? (
            <div className="mb-3 rounded border border-warning/30 bg-warning/5 p-2 text-[10px] leading-relaxed text-warning">
              A Biblioteca de Padrões está vazia. No Editor, selecione/copie estruturas aprovadas e salve-as em <b>Padrões</b>.
            </div>
          ) : (
            <>
              <PatternRoleList title="Marcos obrigatórios" hint="Cada item marcado será colocado uma vez e ligado ao centro." role="landmark" selected={spec.landmarkPatternIds} patterns={patterns.patterns} onToggle={togglePattern} />
              <PatternRoleList title="Preenchimento" hint="O gerador sorteia entre os itens marcados até atingir Fillers." role="filler" selected={spec.fillerPatternIds} patterns={patterns.patterns} onToggle={togglePattern} />
            </>
          )}

          <section className="mt-4 border-t border-border pt-3">
            <h2 className="panel-title mb-2">Resultado</h2>
            {!result?.ok || !result.template ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">Gere um blueprint válido para transformá-lo em um Template reutilizável.</p>
            ) : (
              <div className="space-y-2">
                <div className="rounded border border-success/30 bg-success/5 p-2 text-[10px] text-success">
                  <div className="flex items-center gap-1 font-semibold"><Check className="size-3.5" /> Blueprint válido</div>
                  <p className="mt-1 opacity-80">{result.template.name} · {result.template.width}×{result.template.height}</p>
                </div>
                <button type="button" onClick={saveTemplate} className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-primary/50 bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20"><Save className="size-3.5" /> Salvar como Template</button>
                <Link to="/" className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-border px-3 py-2 text-xs hover:bg-surface"><ExternalLink className="size-3.5" /> Abrir Editor</Link>
                {saved && <p className="rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed text-muted-foreground">{saved}</p>}
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function PatternRoleList({
  title,
  hint,
  role,
  selected,
  patterns,
  onToggle,
}: {
  title: string;
  hint: string;
  role: PatternRole;
  selected: string[];
  patterns: ReturnType<typeof usePatternLibrary>["patterns"];
  onToggle: (role: PatternRole, id: string) => void;
}) {
  return (
    <section className="mb-4">
      <h3 className="text-[11px] font-semibold">{title}</h3>
      <p className="mb-1.5 text-[9px] leading-relaxed text-muted-foreground">{hint}</p>
      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {patterns.map((pattern) => {
          const active = selected.includes(pattern.id);
          return (
            <button key={pattern.id} type="button" onClick={() => onToggle(role, pattern.id)} className={cn("flex w-full items-center gap-2 rounded border p-1.5 text-left", active ? "border-primary/40 bg-primary/10" : "border-border bg-canvas hover:bg-surface")}>
              <span className={cn("grid size-4 shrink-0 place-items-center rounded border text-[9px]", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{active ? "✓" : ""}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium">{pattern.name}</span><span className="block truncate text-[8px] text-muted-foreground">{pattern.category} · {pattern.width}×{pattern.height}</span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GbaMapPreview({ map, atlas, result }: { map: MapData; atlas: SavedRealAtlas | null; result: BlueprintResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = 16;
    canvas.width = map.width * cell;
    canvas.height = map.height * cell;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const source = atlas ? realAtlasStore.getCanvas(atlas) : null;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const id = map.metatiles[y * map.width + x] ?? 0;
        const record = atlas ? realAtlasStore.recordFor(id, atlas) : undefined;
        if (source && atlas && record) {
          const rect = atlasSourceRect(atlas, record);
          ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, x * cell, y * cell, cell, cell);
        } else {
          ctx.fillStyle = (x + y) % 2 ? "#20252a" : "#252b31";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }, [map, atlas]);

  if (!atlas) return <SchematicPreview result={result} width={map.width} height={map.height} />;
  return (
    <div className="max-h-full max-w-full overflow-auto rounded border border-border bg-black/20 p-1 shadow-2xl">
      <canvas ref={canvasRef} className="block max-h-[68vh] max-w-full object-contain [image-rendering:pixelated]" />
    </div>
  );
}

function SchematicPreview({ result, width, height }: { result: BlueprintResult; width: number; height: number }) {
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  return (
    <div className="relative aspect-[5/4] w-full max-w-[720px] overflow-hidden rounded border border-border bg-panel shadow-xl">
      <svg className="absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {result.roads.map((road, index) => (
          <polyline key={`${road.kind}-${road.label}-${index}`} points={road.points.map((point) => `${point.x + 0.5},${point.y + 0.5}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.45" className="text-primary/70" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {result.placements.map((placement, index) => (
        <div key={`${placement.patternId}-${index}`} title={`${placement.role}: ${placement.patternId}`} className={cn("absolute grid place-items-center overflow-hidden rounded-sm border text-center text-[8px] font-semibold shadow", placement.role === "center" ? "border-primary bg-primary/25 text-primary" : placement.role === "landmark" ? "border-success/50 bg-success/15 text-success" : "border-border bg-surface text-muted-foreground")} style={{ left: `${placement.x * scaleX}%`, top: `${placement.y * scaleY}%`, width: `${placement.width * scaleX}%`, height: `${placement.height * scaleY}%` }}>
          <span className="max-w-full truncate px-1">{placement.patternId}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyPreview({ title, text, error }: { title: string; text: string; error?: boolean }) {
  return <div className={cn("max-w-md text-center", error ? "text-destructive" : "text-muted-foreground")}><MapPinned className="mx-auto mb-3 size-10 opacity-40" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed">{text}</p></div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-2"><h2 className="panel-title">{title}</h2><p className="text-[9px] text-muted-foreground">{subtitle}</p></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-border bg-panel p-2 text-center"><div className="text-lg font-semibold text-primary">{value}</div><div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div></div>;
}

function directionLabel(direction: keyof BlueprintExits) {
  if (direction === "north") return "Norte";
  if (direction === "east") return "Leste";
  if (direction === "south") return "Sul";
  return "Oeste";
}
