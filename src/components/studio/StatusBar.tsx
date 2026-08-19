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
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-toolbar px-3 font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">{hover}</span>
      <span className="h-4 w-px bg-border" />
      <span>{TOOL_LABEL[state.tool]}</span>
      <span className="h-4 w-px bg-border" />
      <span>Camada: {state.viewMode}</span>
      <span className="h-4 w-px bg-border" />
      <span>Zoom {Math.round(state.zoom * 100)}%</span>
      <span className="h-4 w-px bg-border" />
      <span>
        Undo {state.undoDepth} / Redo {state.redoDepth}
      </span>
      <span className="h-4 w-px bg-border" />
      <span>{state.map.metatiles.length * 2} bytes</span>
      <span className="ml-auto truncate text-foreground/80">{state.lastMessage}</span>
    </footer>
  );
}
