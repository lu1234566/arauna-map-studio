import { useEditor } from "@/lib/editorStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { useWorkspaceSession } from "@/lib/workspaceSession";

const TOOL_LABEL: Record<string, string> = {
  pencil: "Lápis",
  picker: "Conta-gotas",
  fill: "Bucket fill",
  select: "Seleção",
};

export function StatusBar() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const session = useWorkspaceSession();
  const width = state.map.width;
  const hover = state.hoverCell != null
    ? `X ${state.hoverCell % width} · Y ${Math.floor(state.hoverCell / width)}`
    : "X — · Y —";
  const layerValue = state.viewMode === "collision"
    ? ` · valor ${state.selectedCollision}`
    : state.viewMode === "elevation"
      ? ` · valor ${state.selectedElevation}`
      : "";
  const eventView = state.viewMode === "warps" || state.viewMode === "npcs" || state.viewMode === "triggers";
  const selectedEvent = state.selectedEventId
    ? state.events.find((event) => event.id === state.selectedEventId)
    : null;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-toolbar px-3 font-mono text-[11px] text-muted-foreground">
      <span className="shrink-0 text-foreground">{hover}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">{eventView ? "Selecionar/arrastar evento" : TOOL_LABEL[state.tool]}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Camada: {state.viewMode}{layerValue}</span>
      {eventView && selectedEvent && (
        <>
          <span className="h-4 w-px shrink-0 bg-border" />
          <span className="shrink-0 text-primary">{selectedEvent.label} · {selectedEvent.source}</span>
        </>
      )}
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Zoom {Math.round(state.zoom * 100)}%</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">Undo {state.undoDepth} / Redo {state.redoDepth}</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0">{state.map.metatiles.length * 2} bytes</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <span className={state.sourceFile ? "shrink-0 text-success" : "shrink-0 text-warning"}>
        BIN {state.sourceFile ? "✓" : "—"}{state.dirty ? "*" : ""}
      </span>
      <span className={state.mapMetadata ? "shrink-0 text-success" : "shrink-0 text-warning"}>
        JSON {state.mapMetadata ? "✓" : "—"}{state.mapJsonDirty ? "*" : ""}
      </span>
      <span className={atlas ? "shrink-0 text-success" : "shrink-0 text-warning"}>ATLAS {atlas ? "REAL ✓" : "DEMO"}</span>
      {session && (
        <span
          className={session.writeAccess ? "shrink-0 text-success" : "shrink-0 text-warning"}
          title={`${session.label} · ${session.writeAccess ? "leitura + escrita" : "somente leitura"}`}
        >
          WORKSPACE {session.writeAccess ? "R/W ✓" : "RO"}
        </span>
      )}
      <span className="ml-auto truncate text-foreground/80">{state.lastMessage}</span>
    </footer>
  );
}
