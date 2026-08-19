import { useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editorStore";
import { type TemplatePoint } from "@/lib/mapTemplate";
import { mapTemplateStore, useMapTemplates } from "@/lib/mapTemplateStore";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

function downloadText(source: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([source], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SmallButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded border px-2 py-1 text-[9px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/20 text-primary"
          : "border-border bg-toolbar text-foreground/80 hover:bg-surface",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

function parsePoints(source: string): TemplatePoint[] {
  const result: TemplatePoint[] = [];
  for (const chunk of source.split(";").map((value) => value.trim()).filter(Boolean)) {
    const values = chunk.split(",").map((value) => Number(value.trim()));
    const x = values[0];
    const y = values[1];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`Ponto inválido: “${chunk}”. Use x,y; x,y.`);
    }
    result.push({ x, y });
  }
  if (!result.length) throw new Error("Informe pelo menos um ponto.");
  for (let i = 1; i < result.length; i++) {
    const a = result[i - 1]!;
    const b = result[i]!;
    if (a.x !== b.x && a.y !== b.y) {
      throw new Error(`Segmento ${i}→${i + 1} precisa ser horizontal ou vertical.`);
    }
  }
  return result;
}

export function MapTemplateDock() {
  const state = useMapTemplates();
  const patterns = usePatternLibrary();
  const smartPaths = useSmartPath();
  const atlas = useRealAtlas();
  const editor = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [patternX, setPatternX] = useState(0);
  const [patternY, setPatternY] = useState(0);
  const [pathPoints, setPathPoints] = useState("2,2; 2,8; 8,8");

  const active = state.templates.find((template) => template.id === state.activeTemplateId) ?? null;
  const activePattern = patterns.patterns.find((pattern) => pattern.id === patterns.activePatternId) ?? null;
  const activePath = smartPaths.presets.find((preset) => preset.id === smartPaths.activePresetId) ?? null;
  const dependencies = active ? mapTemplateStore.dependencyStatus(active) : null;

  const patternNames = useMemo(
    () => new Map(patterns.patterns.map((pattern) => [pattern.id, pattern.name])),
    [patterns.patterns],
  );
  const pathNames = useMemo(
    () => new Map(smartPaths.presets.map((preset) => [preset.id, preset.name])),
    [smartPaths.presets],
  );

  const createTemplate = () => {
    const name = window.prompt("Nome do template:", `Template ${state.templates.length + 1}`);
    if (name === null) return;
    const width = Number(window.prompt("Largura em metatiles:", String(Math.min(editor.map.width, 30))));
    if (!Number.isInteger(width) || width < 1) return;
    const height = Number(window.prompt("Altura em metatiles:", String(Math.min(editor.map.height, 30))));
    if (!Number.isInteger(height) || height < 1) return;
    mapTemplateStore.createTemplate(name, width, height);
  };

  return (
    <section className="absolute right-2 top-2 z-30 flex max-h-[calc(100%-16px)] flex-col overflow-hidden rounded border border-border bg-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => mapTemplateStore.toggleEnabled()}
          className={cn(
            "rounded border px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
            state.enabled
              ? "border-primary/60 bg-primary/20 text-primary"
              : "border-border bg-toolbar text-foreground hover:bg-surface",
          )}
          title="Templates (T): aplica uma composição de padrões + Smart Paths"
        >
          Templates {state.enabled ? "ON" : "OFF"}
        </button>

        {active && (
          <select
            value={active.id}
            onChange={(event) => mapTemplateStore.selectTemplate(event.target.value)}
            className="h-7 max-w-44 rounded border border-border bg-canvas px-1.5 text-[10px] outline-none focus:border-primary/60"
          >
            {state.templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => mapTemplateStore.setPanelOpen(!state.panelOpen)}
          className="rounded border border-border bg-toolbar px-2 py-1.5 text-[9px] text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          {state.panelOpen ? "Fechar" : "Compor"}
        </button>
      </div>

      {state.panelOpen && (
        <div className="w-[460px] max-w-[calc(100vw-310px)] min-w-[360px] overflow-y-auto border-t border-border">
          <div className="space-y-2 border-b border-border p-2.5">
            <div className="flex flex-wrap gap-1">
              <SmallButton onClick={createTemplate}>+ Novo template</SmallButton>
              <SmallButton disabled={!active} onClick={() => mapTemplateStore.duplicateActive()}>Duplicar</SmallButton>
              <SmallButton disabled={!active} onClick={() => mapTemplateStore.deleteActive()}>Excluir</SmallButton>
              <SmallButton onClick={() => fileRef.current?.click()}>Importar JSON</SmallButton>
              <SmallButton
                disabled={!active}
                onClick={() => {
                  const source = mapTemplateStore.exportActiveJson();
                  if (source && active) downloadText(source, `${active.name.replace(/[^a-z0-9_-]+/gi, "_")}.template.json`);
                }}
              >
                Exportar atual
              </SmallButton>
              <SmallButton
                disabled={!state.templates.length}
                onClick={() => {
                  const source = mapTemplateStore.exportAllJson();
                  if (source) downloadText(source, "arauna-map-templates.json");
                }}
              >
                Exportar todos
              </SmallButton>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void file.text().then((source) => mapTemplateStore.importJson(source));
                  event.target.value = "";
                }}
              />
            </div>

            {!active ? (
              <div className="rounded border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                Crie um template para combinar padrões aprovados e Smart Paths em uma composição reutilizável.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Nome</span>
                    <input
                      value={active.name}
                      onChange={(event) => mapTemplateStore.renameActive(event.target.value)}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Categoria</span>
                    <input
                      value={active.category}
                      onChange={(event) => mapTemplateStore.setCategory(event.target.value)}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Tags</span>
                  <input
                    value={active.tags.join(", ")}
                    onChange={(event) => mapTemplateStore.setTags(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))}
                    placeholder="vila, rural, praça, floresta"
                    className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                  />
                </label>

                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
                  <label>
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Largura</span>
                    <input
                      type="number"
                      min={1}
                      max={512}
                      value={active.width}
                      onChange={(event) => mapTemplateStore.setSize(Number(event.target.value), active.height)}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 font-mono text-[10px]"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Altura</span>
                    <input
                      type="number"
                      min={1}
                      max={512}
                      value={active.height}
                      onChange={(event) => mapTemplateStore.setSize(active.width, Number(event.target.value))}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 font-mono text-[10px]"
                    />
                  </label>
                  <SmallButton disabled={!atlas} onClick={() => mapTemplateStore.bindScopeToCurrentAtlas()}>
                    Vincular atlas
                  </SmallButton>
                </div>

                <div className={cn(
                  "rounded border p-2 text-[9px] leading-relaxed",
                  dependencies?.valid
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}>
                  {dependencies?.valid
                    ? `Dependências OK: ${dependencies.patternIds.length} padrão(ões), ${dependencies.smartPathIds.length} Smart Path(s).${dependencies.warnings.length ? ` ${dependencies.warnings.join(" ")}` : ""}`
                    : dependencies?.errors.join(" ")}
                </div>
              </>
            )}
          </div>

          {active && (
            <div className="space-y-3 p-2.5">
              <section className="rounded border border-border bg-canvas p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide">Adicionar padrão</p>
                    <p className="text-[9px] text-muted-foreground">Usa o padrão selecionado na Biblioteca.</p>
                  </div>
                  <span className="max-w-40 truncate text-[9px] text-primary">{activePattern?.name ?? "nenhum selecionado"}</span>
                </div>
                <div className="grid grid-cols-[70px_70px_1fr] gap-1.5">
                  <input type="number" value={patternX} onChange={(event) => setPatternX(Number(event.target.value))} className="h-7 rounded border border-border bg-background px-2 font-mono text-[10px]" title="Offset X no template" />
                  <input type="number" value={patternY} onChange={(event) => setPatternY(Number(event.target.value))} className="h-7 rounded border border-border bg-background px-2 font-mono text-[10px]" title="Offset Y no template" />
                  <SmallButton disabled={!activePattern} onClick={() => mapTemplateStore.addActivePattern(patternX, patternY)}>
                    + Padrão em ({patternX},{patternY})
                  </SmallButton>
                </div>
              </section>

              <section className="rounded border border-border bg-canvas p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide">Adicionar Smart Path</p>
                    <p className="text-[9px] text-muted-foreground">Waypoints: x,y; x,y; x,y</p>
                  </div>
                  <span className="max-w-40 truncate text-[9px] text-primary">{activePath?.name ?? "nenhum selecionado"}</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={pathPoints}
                    onChange={(event) => setPathPoints(event.target.value)}
                    className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 font-mono text-[9px]"
                  />
                  <SmallButton
                    disabled={!activePath}
                    onClick={() => {
                      try {
                        mapTemplateStore.addActiveSmartPath(parsePoints(pathPoints));
                      } catch (error) {
                        window.alert(error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    + Smart Path
                  </SmallButton>
                </div>
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide">Composição · {active.elements.length} elemento(s)</p>
                  <span className="text-[8px] text-muted-foreground">coordenadas relativas</span>
                </div>
                {!active.elements.length ? (
                  <div className="rounded border border-dashed border-border p-3 text-center text-[9px] text-muted-foreground">
                    Adicione padrões e caminhos. O template referencia peças verificadas; não armazena screenshots.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {active.elements.map((element, index) => (
                      <div key={`${element.type}-${index}`} className="flex items-center gap-2 rounded border border-border bg-canvas px-2 py-1.5 text-[9px]">
                        <span className="w-16 shrink-0 rounded bg-surface px-1 py-0.5 text-center font-mono text-[8px] uppercase text-muted-foreground">{element.type}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {element.type === "pattern"
                            ? `${patternNames.get(element.patternId) ?? element.patternId} @ (${element.x},${element.y})`
                            : `${pathNames.get(element.presetId) ?? element.presetId} · ${element.points.map((point) => `${point.x},${point.y}`).join(" → ")}`}
                        </span>
                        <button type="button" onClick={() => mapTemplateStore.removeElement(index)} className="text-[9px] text-muted-foreground hover:text-destructive">
                          remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="rounded border border-primary/20 bg-primary/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
                <b className="text-foreground">Templates</b> formam o vocabulário de composição para uma futura geração por instrução: casas, praças e vegetação vêm da Biblioteca; conexões vêm dos Smart Paths. <b className="text-foreground">T</b> liga/desliga.
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
