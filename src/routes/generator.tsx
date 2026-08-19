import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Dices, ExternalLink, MapPinned, RefreshCw, Save, Sparkles, Trophy } from "lucide-react";
import { SeedCandidateGallery } from "@/components/studio/SeedCandidateGallery";
import { createEmptyMap, type MapData } from "@/lib/emeraldMap";
import { planMapTemplate, serializeMapTemplates } from "@/lib/mapTemplate";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import type { MapPattern } from "@/lib/patternLibrary";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import {
  generateProceduralCandidates,
  type ProceduralSeedCandidate,
} from "@/lib/proceduralCandidates";
import {
  createProceduralBlueprintSpec,
  type ProceduralBlueprintResult,
  type ProceduralBlueprintSpec,
  type ProceduralExits,
} from "@/lib/proceduralBlueprint";
import { generateSafeProceduralBlueprint } from "@/lib/proceduralBlueprintSafety";
import { atlasSourceRect, realAtlasStore, useRealAtlas, type SavedRealAtlas } from "@/lib/realAtlasStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generator")({ component: ProceduralGenerator });

type PatternRole = "landmark" | "filler";

const scopeFromAtlas = (atlas: SavedRealAtlas | null) => atlas ? { primary: atlas.primary, secondary: atlas.secondary } : undefined;
const numeric = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copyText = (source: string) => void navigator.clipboard?.writeText(source);

function ProceduralGenerator() {
  const patterns = usePatternLibrary();
  const smartPaths = useSmartPath();
  const atlas = useRealAtlas();
  const [spec, setSpec] = useState<ProceduralBlueprintSpec>(() => createProceduralBlueprintSpec(30, 24));
  const [result, setResult] = useState<ProceduralBlueprintResult | null>(null);
  const [saved, setSaved] = useState("");
  const [candidates, setCandidates] = useState<ProceduralSeedCandidate[]>([]);
  const [candidateCount, setCandidateCount] = useState(8);

  const previewMap = useMemo(() => {
    const template = result?.compiled?.template;
    if (!result?.ok || !template) return null;
    const plan = planMapTemplate(
      createEmptyMap(spec.width, spec.height, 0),
      template,
      0,
      0,
      patterns.patterns,
      smartPaths.presets,
      scopeFromAtlas(atlas),
    );
    return plan.valid ? plan.map : null;
  }, [result, spec.width, spec.height, patterns.patterns, smartPaths.presets, atlas]);

  const resetResult = () => {
    setResult(null);
    setCandidates([]);
    setSaved("");
  };

  const update = <K extends keyof ProceduralBlueprintSpec>(key: K, value: ProceduralBlueprintSpec[K]) => {
    setSpec((current) => ({ ...current, [key]: value }));
    resetResult();
  };

  const setOptionalId = (field: "centerPatternId" | "roadPresetId", value: string) => {
    setSpec((current) => {
      const next: ProceduralBlueprintSpec = { ...current };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
    resetResult();
  };

  const togglePattern = (role: PatternRole, id: string) => {
    const key = role === "landmark" ? "landmarkPatternIds" : "fillerPatternIds";
    const values = spec[key];
    update(key, values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  };

  const generate = () => {
    setCandidates([]);
    setResult(generateSafeProceduralBlueprint(spec, patterns.patterns, smartPaths.presets, scopeFromAtlas(atlas)));
    setSaved("");
  };

  const selectCandidate = (candidate: ProceduralSeedCandidate) => {
    setSpec((current) => ({ ...current, seed: candidate.seed }));
    setResult(candidate.result);
    setSaved("");
  };

  const generateCandidates = () => {
    const gallery = generateProceduralCandidates(
      spec,
      patterns.patterns,
      smartPaths.presets,
      scopeFromAtlas(atlas),
      candidateCount,
    );
    setCandidates(gallery);
    const best = gallery[0];
    if (best) selectCandidate(best);
  };

  const saveTemplate = () => {
    const template = result?.compiled?.template;
    if (!result?.ok || !template) return;
    const imported = mapTemplateStore.importJson(serializeMapTemplates([template]));
    setSaved(imported.ok
      ? `Template salvo (${imported.count}). Volte ao Editor e use T para posicioná-lo.`
      : `Falha ao salvar: ${imported.message}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><ArrowLeft className="size-3.5" /> Editor</Link>
        <div><h1 className="text-sm font-semibold">Procedural Blueprint Generator</h1><p className="text-[10px] text-muted-foreground">Seed + vocabulário verificado → Blueprint IA → Template GBA</p></div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <Badge>{patterns.patterns.length} padrões</Badge><Badge>{smartPaths.presets.length} Smart Paths</Badge>
          <span className={cn("rounded border px-2 py-1", atlas ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>{atlas ? `${atlas.primary} + ${atlas.secondary}` : "atlas real ausente"}</span>
          <select value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))} className="h-8 rounded border border-border bg-canvas px-1.5 text-[10px]" title="Quantidade de seeds para comparar">
            {[4, 8, 12, 16, 24].map((count) => <option key={count} value={count}>{count} seeds</option>)}
          </select>
          <button type="button" onClick={generateCandidates} className="inline-flex h-8 items-center gap-1.5 rounded border border-border px-2.5 text-xs hover:bg-surface"><Trophy className="size-3.5 text-warning" /> Melhor de {candidateCount}</button>
          <button type="button" onClick={generate} className="inline-flex h-8 items-center gap-1.5 rounded border border-primary/50 bg-primary/15 px-3 text-xs font-semibold text-primary hover:bg-primary/20"><Sparkles className="size-3.5" /> Gerar</button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(420px,1fr)_330px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border bg-panel p-3">
          <SectionTitle title="Mapa" subtitle="Dimensões e regras estruturais" />
          <Field label="Nome"><input value={spec.name} onChange={(event) => update("name", event.target.value)} className="input-compact w-full" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largura"><input type="number" min={5} max={512} value={spec.width} onChange={(event) => update("width", numeric(event.target.value, spec.width))} className="input-compact w-full font-mono" /></Field>
            <Field label="Altura"><input type="number" min={5} max={512} value={spec.height} onChange={(event) => update("height", numeric(event.target.value, spec.height))} className="input-compact w-full font-mono" /></Field>
          </div>
          <Field label="Seed">
            <div className="flex gap-1"><input value={spec.seed} onChange={(event) => update("seed", event.target.value)} className="input-compact min-w-0 flex-1 font-mono" /><button type="button" title="Nova seed" onClick={() => update("seed", `arauna-${Date.now().toString(36)}`)} className="grid size-7 place-items-center rounded border border-border hover:bg-surface"><Dices className="size-3.5" /></button></div>
          </Field>
          <Field label="Categoria"><input value={spec.category} onChange={(event) => update("category", event.target.value)} className="input-compact w-full" /></Field>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Margem"><input type="number" min={0} max={32} value={spec.margin} onChange={(event) => update("margin", numeric(event.target.value, spec.margin))} className="input-compact w-full font-mono" /></Field>
            <Field label="Espaço"><input type="number" min={0} max={16} value={spec.spacing} onChange={(event) => update("spacing", numeric(event.target.value, spec.spacing))} className="input-compact w-full font-mono" /></Field>
            <Field label="Fillers"><input type="number" min={0} max={512} value={spec.fillerCount} onChange={(event) => update("fillerCount", numeric(event.target.value, spec.fillerCount))} className="input-compact w-full font-mono" /></Field>
          </div>

          <div className="mt-3"><SectionTitle title="Âncoras" subtitle="Centro e rede de circulação" /></div>
          <Field label="Peça central">
            <select value={spec.centerPatternId ?? ""} onChange={(event) => setOptionalId("centerPatternId", event.target.value)} className="input-compact w-full"><option value="">Sem peça central</option>{patterns.patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} · {pattern.width}×{pattern.height}</option>)}</select>
          </Field>
          <Field label="Estrada / conexão">
            <select value={spec.roadPresetId ?? ""} onChange={(event) => setOptionalId("roadPresetId", event.target.value)} className="input-compact w-full"><option value="">Sem Smart Path</option>{smartPaths.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
          </Field>
          <span className="field-label">Saídas do mapa</span>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {(["north", "east", "south", "west"] as const).map((direction) => <button key={direction} type="button" onClick={() => update("exits", { ...spec.exits, [direction]: !spec.exits[direction] })} className={cn("rounded border px-2 py-1.5 text-[10px]", spec.exits[direction] ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface")}>{spec.exits[direction] ? "✓ " : ""}{directionLabel(direction)}</button>)}
          </div>
          <Info>O algoritmo só usa <b>Patterns</b> cadastrados e um <b>Smart Path</b> existente. Rotas que atravessariam uma estrutura são descartadas antes da compilação.</Info>
        </aside>

        <section className="min-w-0 overflow-y-auto bg-canvas p-4">
          <div className="mx-auto flex min-h-full max-w-[980px] flex-col gap-3">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Prévia do layout</h2><p className="text-[10px] text-muted-foreground">A mesma seed reproduz o mesmo arranjo; “Melhor de N” compara várias seeds e abre automaticamente a mais completa.</p></div><button type="button" onClick={generate} className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface"><RefreshCw className="size-3.5" /> Recalcular</button></div>
            <div className="grid min-h-[480px] flex-1 place-items-center overflow-auto rounded-lg border border-border bg-background/40 p-4 shadow-inner">
              {!result ? <EmptyPreview title="Pronto para gerar" text="Escolha as peças e clique em Gerar ou Melhor de N." /> : !result.ok ? <EmptyPreview title="Geração bloqueada" text={result.errors.join(" ")} error /> : previewMap ? <GbaMapPreview map={previewMap} atlas={atlas} result={result} /> : <SchematicPreview result={result} width={spec.width} height={spec.height} />}
            </div>
            {result?.ok && <div className="grid grid-cols-4 gap-2"><Stat label="Estruturas" value={result.placements.length} /><Stat label="Conexões" value={result.roads.length} /><Stat label="Blueprint" value={(result.blueprint?.patterns.length ?? 0) + (result.blueprint?.routes.length ?? 0)} /><Stat label="Template" value={result.compiled?.template?.elements.length ?? 0} /></div>}
            <SeedCandidateGallery candidates={candidates} activeSeed={spec.seed} onSelect={selectCandidate} />
            {result?.warnings.length ? <div className="rounded border border-warning/30 bg-warning/5 p-2 text-[10px] leading-relaxed text-warning">{result.warnings.join(" ")}</div> : null}
            {result?.errors.length ? <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-[10px] leading-relaxed text-destructive">{result.errors.join(" ")}</div> : null}
          </div>
        </section>

        <aside className="overflow-y-auto border-l border-border bg-panel p-3">
          <SectionTitle title="Vocabulário" subtitle="Peças permitidas nesta geração" />
          {!patterns.patterns.length ? <div className="mb-3 rounded border border-warning/30 bg-warning/5 p-2 text-[10px] text-warning">A Biblioteca está vazia. Salve estruturas aprovadas em <b>Padrões</b>.</div> : <><PatternRoleList title="Marcos obrigatórios" hint="Cada item é colocado uma vez e ligado ao hub." role="landmark" selected={spec.landmarkPatternIds} patterns={patterns.patterns} onToggle={togglePattern} /><PatternRoleList title="Preenchimento" hint="Sorteia entre os itens até atingir Fillers." role="filler" selected={spec.fillerPatternIds} patterns={patterns.patterns} onToggle={togglePattern} /></>}
          <section className="mt-4 border-t border-border pt-3">
            <h2 className="panel-title mb-2">Resultado</h2>
            {!result?.ok || !result.compiled?.template || !result.blueprint ? <p className="text-[10px] leading-relaxed text-muted-foreground">Gere um layout válido para salvar o Template ou reutilizar o Blueprint JSON.</p> : <div className="space-y-2">
              <div className="rounded border border-success/30 bg-success/5 p-2 text-[10px] text-success"><div className="flex items-center gap-1 font-semibold"><Check className="size-3.5" /> Blueprint compilado</div><p className="mt-1 opacity-80">{result.compiled.template.name} · {result.compiled.template.width}×{result.compiled.template.height}</p></div>
              <button type="button" onClick={() => copyText(`${JSON.stringify(result.blueprint, null, 2)}\n`)} className="action-wide"><ClipboardCopy className="size-3.5" /> Copiar Blueprint JSON</button>
              <button type="button" onClick={saveTemplate} className="action-wide border-primary/50 bg-primary/15 font-semibold text-primary hover:bg-primary/20"><Save className="size-3.5" /> Salvar como Template</button>
              <Link to="/" className="action-wide"><ExternalLink className="size-3.5" /> Abrir Editor</Link>
              {saved && <p className="rounded border border-border bg-canvas p-2 text-[9px] leading-relaxed text-muted-foreground">{saved}</p>}
            </div>}
          </section>
        </aside>
      </main>
    </div>
  );
}

function PatternRoleList({ title, hint, role, selected, patterns, onToggle }: { title: string; hint: string; role: PatternRole; selected: string[]; patterns: MapPattern[]; onToggle: (role: PatternRole, id: string) => void }) {
  return <section className="mb-4"><h3 className="text-[11px] font-semibold">{title}</h3><p className="mb-1.5 text-[9px] text-muted-foreground">{hint}</p><div className="max-h-52 space-y-1 overflow-y-auto pr-1">{patterns.map((pattern) => { const active = selected.includes(pattern.id); return <button key={pattern.id} type="button" onClick={() => onToggle(role, pattern.id)} className={cn("flex w-full items-center gap-2 rounded border p-1.5 text-left", active ? "border-primary/40 bg-primary/10" : "border-border bg-canvas hover:bg-surface")}><span className={cn("grid size-4 shrink-0 place-items-center rounded border text-[9px]", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{active ? "✓" : ""}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium">{pattern.name}</span><span className="block truncate text-[8px] text-muted-foreground">{pattern.category} · {pattern.width}×{pattern.height}</span></span></button>; })}</div></section>;
}

function GbaMapPreview({ map, atlas, result }: { map: MapData; atlas: SavedRealAtlas | null; result: ProceduralBlueprintResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const cell = 16;
    canvas.width = map.width * cell;
    canvas.height = map.height * cell;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const source = atlas ? realAtlasStore.getCanvas(atlas) : null;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
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
  }, [map, atlas]);
  if (!atlas) return <SchematicPreview result={result} width={map.width} height={map.height} />;
  return <div className="max-h-full max-w-full overflow-auto rounded border border-border bg-black/20 p-1 shadow-2xl"><canvas ref={ref} className="block max-h-[68vh] max-w-full object-contain [image-rendering:pixelated]" /></div>;
}

function SchematicPreview({ result, width, height }: { result: ProceduralBlueprintResult; width: number; height: number }) {
  const sx = 100 / width, sy = 100 / height;
  return <div className="relative aspect-[5/4] w-full max-w-[720px] overflow-hidden rounded border border-border bg-panel shadow-xl"><svg className="absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{result.roads.map((road, i) => <polyline key={`${road.kind}-${road.label}-${i}`} points={road.points.map((point) => `${point.x + 0.5},${point.y + 0.5}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.45" className="text-primary/70" vectorEffect="non-scaling-stroke" />)}</svg>{result.placements.map((p, i) => <div key={`${p.patternId}-${i}`} className={cn("absolute grid place-items-center overflow-hidden rounded-sm border text-[8px] font-semibold shadow", p.role === "center" ? "border-primary bg-primary/25 text-primary" : p.role === "landmark" ? "border-success/50 bg-success/15 text-success" : "border-border bg-surface text-muted-foreground")} style={{ left: `${p.x * sx}%`, top: `${p.y * sy}%`, width: `${p.width * sx}%`, height: `${p.height * sy}%` }}><span className="max-w-full truncate px-1">{p.patternId}</span></div>)}</div>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded border border-border bg-canvas px-2 py-1">{children}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mb-2 block"><span className="field-label">{label}</span>{children}</label>; }
function Info({ children }: { children: React.ReactNode }) { return <div className="rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">{children}</div>; }
function EmptyPreview({ title, text, error }: { title: string; text: string; error?: boolean }) { return <div className={cn("max-w-md text-center", error ? "text-destructive" : "text-muted-foreground")}><MapPinned className="mx-auto mb-3 size-10 opacity-40" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed">{text}</p></div>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-2"><h2 className="panel-title">{title}</h2><p className="text-[9px] text-muted-foreground">{subtitle}</p></div>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded border border-border bg-panel p-2 text-center"><div className="text-lg font-semibold text-primary">{value}</div><div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div></div>; }
function directionLabel(direction: keyof ProceduralExits) { if (direction === "north") return "Norte"; if (direction === "east") return "Leste"; if (direction === "south") return "Sul"; return "Oeste"; }
