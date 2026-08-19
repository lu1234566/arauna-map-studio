import { useMemo, useRef, useState } from "react";
import { kindLabel } from "@/lib/mapClipboard";
import { useClipboard } from "@/lib/clipboardStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
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
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
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

export function PatternLibraryDock() {
  const state = usePatternLibrary();
  const clipboard = useClipboard();
  const atlas = useRealAtlas();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const fileRef = useRef<HTMLInputElement>(null);
  const active = state.patterns.find((pattern) => pattern.id === state.activePatternId) ?? null;

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(state.patterns.map((pattern) => pattern.category || "Geral"))).sort()],
    [state.patterns],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return state.patterns.filter((pattern) => {
      if (category !== "Todos" && pattern.category !== category) return false;
      if (!normalized) return true;
      return [pattern.name, pattern.category, ...pattern.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [state.patterns, query, category]);

  const scope = !active
    ? null
    : !active.scope
      ? { matches: true, message: "Sem vínculo de tileset." }
      : !atlas
        ? { matches: false, message: "Atlas real não carregado." }
        : active.scope.primary === atlas.primary && active.scope.secondary === atlas.secondary
          ? { matches: true, message: `${atlas.primary} + ${atlas.secondary}` }
          : {
              matches: false,
              message: `Padrão: ${active.scope.primary} + ${active.scope.secondary}; atlas: ${atlas.primary} + ${atlas.secondary}`,
            };

  const saveClipboard = () => {
    if (!clipboard.clipboard) {
      patternLibraryStore.saveClipboardAsPattern();
      return;
    }
    const defaultName = `Padrão ${state.patterns.length + 1}`;
    const name = window.prompt("Nome do padrão:", defaultName);
    if (name === null) return;
    const suggestedCategory = active?.category || "Geral";
    const selectedCategory = window.prompt("Categoria:", suggestedCategory);
    if (selectedCategory === null) return;
    patternLibraryStore.saveClipboardAsPattern(name, selectedCategory);
  };

  return (
    <section className="absolute left-2 bottom-9 z-30 flex max-h-[58%] flex-col overflow-hidden rounded border border-border bg-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => patternLibraryStore.toggleEnabled()}
          className={cn(
            "rounded border px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
            state.enabled
              ? "border-primary/60 bg-primary/20 text-primary"
              : "border-border bg-toolbar text-foreground hover:bg-surface",
          )}
          title="Biblioteca de Padrões (L): carimba estruturas reutilizáveis no mapa"
        >
          Padrões {state.enabled ? "ON" : "OFF"}
        </button>

        {active && (
          <span className="max-w-36 truncate rounded bg-primary/10 px-1.5 py-1 font-mono text-[9px] text-primary">
            {active.width}×{active.height} · {active.name}
          </span>
        )}

        <button
          type="button"
          onClick={() => patternLibraryStore.setPanelOpen(!state.panelOpen)}
          className="rounded border border-border bg-toolbar px-2 py-1.5 text-[9px] text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          {state.panelOpen ? "Fechar" : "Biblioteca"}
        </button>
      </div>

      {state.panelOpen && (
        <div className="flex min-h-0 w-[420px] max-w-[calc(100vw-300px)] min-w-[330px] flex-col border-t border-border">
          <div className="space-y-2 border-b border-border p-2">
            <div className="flex flex-wrap gap-1">
              <SmallButton
                title="Salva o clipboard atual como um padrão persistente"
                disabled={!clipboard.clipboard}
                onClick={saveClipboard}
              >
                + Salvar clipboard
              </SmallButton>
              <SmallButton disabled={!active} onClick={() => patternLibraryStore.duplicateActive()}>Duplicar</SmallButton>
              <SmallButton disabled={!active} onClick={() => patternLibraryStore.deleteActive()}>Excluir</SmallButton>
              <SmallButton onClick={() => fileRef.current?.click()}>Importar JSON</SmallButton>
              <SmallButton
                disabled={!active}
                onClick={() => {
                  const source = patternLibraryStore.exportActiveJson();
                  if (source && active) {
                    downloadText(source, `${active.name.replace(/[^a-z0-9_-]+/gi, "_")}.pattern.json`);
                  }
                }}
              >
                Exportar atual
              </SmallButton>
              <SmallButton
                disabled={!state.patterns.length}
                onClick={() => {
                  const source = patternLibraryStore.exportAllJson();
                  if (source) downloadText(source, "arauna-pattern-library.json");
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
                  if (file) void file.text().then((source) => patternLibraryStore.importJson(source));
                  event.target.value = "";
                }}
              />
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-1.5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar casa, praça, árvores…"
                className="h-7 rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-7 rounded border border-border bg-canvas px-1.5 text-[10px] outline-none focus:border-primary/60"
              >
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[170px_1fr] overflow-hidden">
            <div className="overflow-y-auto border-r border-border p-1.5">
              {!filtered.length && (
                <div className="rounded border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                  {state.patterns.length
                    ? "Nenhum padrão combina com o filtro."
                    : "Copie uma região e use “Salvar clipboard” para criar blocos reutilizáveis."}
                </div>
              )}
              <div className="space-y-1">
                {filtered.map((pattern) => (
                  <button
                    key={pattern.id}
                    type="button"
                    onClick={() => patternLibraryStore.selectPattern(pattern.id)}
                    className={cn(
                      "block w-full rounded border p-2 text-left transition-colors",
                      pattern.id === state.activePatternId
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-canvas hover:bg-surface",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-medium">{pattern.name}</span>
                      <span className="shrink-0 font-mono text-[8px] text-muted-foreground">{pattern.width}×{pattern.height}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground">
                      <span className="truncate">{pattern.category}</span>
                      <span>{kindLabel(pattern.kind)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 overflow-y-auto p-2.5">
              {!active ? (
                <p className="text-[10px] text-muted-foreground">Selecione um padrão.</p>
              ) : (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Nome</span>
                    <input
                      value={active.name}
                      onChange={(event) => patternLibraryStore.renameActive(event.target.value)}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Categoria</span>
                    <input
                      value={active.category}
                      onChange={(event) => patternLibraryStore.setCategory(event.target.value)}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[8px] uppercase tracking-wide text-muted-foreground">Tags (vírgula)</span>
                    <input
                      value={active.tags.join(", ")}
                      onChange={(event) => patternLibraryStore.setTags(
                        event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                      )}
                      className="h-7 w-full rounded border border-border bg-canvas px-2 text-[10px] outline-none focus:border-primary/60"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border text-center text-[9px]">
                    <div className="bg-canvas p-2"><b>{active.width}×{active.height}</b><br/><span className="text-muted-foreground">tamanho</span></div>
                    <div className="bg-canvas p-2"><b>{kindLabel(active.kind)}</b><br/><span className="text-muted-foreground">camada</span></div>
                    <div className="bg-canvas p-2"><b>{active.values.length}</b><br/><span className="text-muted-foreground">células</span></div>
                  </div>

                  {scope && (
                    <div className={cn(
                      "rounded border p-2 text-[9px] leading-relaxed",
                      scope.matches
                        ? "border-border bg-canvas text-muted-foreground"
                        : "border-warning/40 bg-warning/10 text-warning",
                    )}>
                      <div>Tileset: {scope.message}</div>
                      {(!active.scope || !scope.matches) && (
                        <div className="mt-1.5">
                          <SmallButton
                            disabled={!atlas || (active.kind !== "visual" && active.kind !== "raw")}
                            onClick={() => patternLibraryStore.bindScopeToCurrentAtlas()}
                          >
                            Vincular atlas atual
                          </SmallButton>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={Boolean(active.scope && scope && !scope.matches)}
                    onClick={() => patternLibraryStore.toggleEnabled()}
                    className={cn(
                      "w-full rounded border px-2 py-2 text-[10px] font-semibold",
                      state.enabled
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "border-border bg-toolbar hover:bg-surface",
                      active.scope && scope && !scope.matches && "pointer-events-none opacity-40",
                    )}
                  >
                    {state.enabled ? "Carimbo de padrão ATIVO" : "Usar este padrão como carimbo"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border px-2.5 py-2 text-[9px] leading-relaxed text-muted-foreground">
            A biblioteca guarda estruturas que você já aprovou — casas, praças, entradas, pontes, lagos, grupos de árvores etc. <b className="text-foreground">L</b> liga/desliga o padrão ativo. Presets Visual/RAW podem ficar vinculados ao tileset para impedir reuso acidental com IDs incompatíveis.
          </div>
        </div>
      )}
    </section>
  );
}
