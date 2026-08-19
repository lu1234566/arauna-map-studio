import { useEditor } from "@/lib/editorStore";

const TOOL_LABEL: Record<string, string> = {
  pencil: "Lápis",
  picker: "Conta-gotas",
  fill: "Bucket fill",
  select: "Seleção",
};

export function StatusBar() {
  const state = useEditor();
  const width = state.map.width;
  const hover =
    state.hoverCell != null
      ? `X ${state.hoverCell % width} · Y ${Math.floor(state.hoverCell / width)}`
      : "X — · Y —";

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-toolbar px-3 font-mono text-[11px] text-muted-foreground">
      <span className="shrink-0 text-foreground">{hover}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">{TOOL_LABEL[state.tool]}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Camada: {state.viewMode}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Zoom {Math.round(state.zoom * 100)}%</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Undo {state.undoDepth} / Redo {state.redoDepth}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">{state.map.metatiles.length * 2} bytes</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className={state.sourceFile ? "shrink-0 text-success" : "shrink-0 text-warning"}>
        BIN {state.sourceFile ? "✓" : "—"}
      </span>
      <span className={state.mapMetadata ? "shrink-0 text-success" : "shrink-0 text-warning"}>
        JSON {state.mapMetadata ? "✓" : "—"}
      </span>
      <span className="ml-auto truncate text-foreground/80">{state.lastMessage}</span>
    </footer>
  );
}
