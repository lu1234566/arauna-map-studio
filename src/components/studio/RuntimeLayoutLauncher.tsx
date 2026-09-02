import { Layers3, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { editorStore, useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import {
  activeWorkspaceLayout,
  openWorkspaceRuntimeLayout,
  runtimeLayoutsForMap,
  type RuntimeWorkspaceLayout,
} from "@/lib/runtimeWorkspaceLayouts";
import { cn } from "@/lib/utils";
import { useWorkspaceSession, workspaceSessionStore } from "@/lib/workspaceSession";
import { prepareWorkspaceTransition } from "@/lib/workspaceSwitchGuard";

export function RuntimeLayoutLauncher() {
  const editor = useEditor();
  const session = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  const [layouts, setLayouts] = useState<RuntimeWorkspaceLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const currentMap = useMemo(() => {
    if (!session?.lastMapPath) return null;
    return session.workspace.maps.find((map) => map.path === session.lastMapPath) ?? null;
  }, [session?.workspace, session?.lastMapPath]);

  const active = useMemo(() => (
    session ? activeWorkspaceLayout(session.workspace, editor.sourceFile) : null
  ), [session?.workspace, editor.sourceFile]);

  useEffect(() => {
    let cancelled = false;
    if (!session || !currentMap) {
      setLayouts([]);
      return;
    }
    setLoading(true);
    void runtimeLayoutsForMap(session.workspace, currentMap)
      .then((next) => {
        if (!cancelled) setLayouts(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.workspace, currentMap?.path]);

  if (!session || !currentMap || layouts.length <= 1) return null;

  const switchLayout = async (layoutId: string) => {
    if (switching || active?.id === layoutId) return;
    const transition = await prepareWorkspaceTransition(session);
    if (!transition.proceed) return;

    setSwitching(layoutId);
    try {
      const result = await openWorkspaceRuntimeLayout(session.workspace, currentMap, layoutId);
      workspaceSessionStore.setLastMap(currentMap.path);
      requestMapCameraFit();
      editorStore.setMessage(
        `${currentMap.name}: layout físico ${result.layout.id} aberto — ${result.layout.width}×${result.layout.height}, ` +
          `${result.layout.primary_tileset} + ${result.layout.secondary_tileset}. O map.json permanece o mesmo; Salvar pasta grava este map.bin específico.`,
      );
      setOpen(false);
    } catch (cause) {
      editorStore.setMessage(
        `Falha ao abrir layout runtime ${layoutId}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="absolute right-[258px] top-12 z-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded border bg-panel/95 px-2.5 text-[10px] font-semibold shadow-lg backdrop-blur-sm",
          open ? "border-warning/60 text-warning" : "border-warning/35 text-foreground hover:bg-warning/10",
        )}
        title="Alternar entre o layout base e layouts trocados por setmaplayoutindex em runtime"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Layers3 className="size-3.5" />}
        Layouts runtime
        <span className="rounded bg-warning/15 px-1 font-mono text-[8px] text-warning">{layouts.length}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[360px] max-w-[calc(100vw-20px)] rounded border border-warning/35 bg-panel/98 p-2 shadow-2xl backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold">
            <ShieldCheck className="size-3.5 text-success" /> Variantes físicas detectadas no scripts.inc
          </div>
          <p className="mb-2 text-[8px] leading-relaxed text-muted-foreground">
            O map.json continua sendo o mapa lógico. Aqui você alterna somente o map.bin/layout que o jogo pode selecionar em runtime. Alterações pendentes são salvas ou a troca é cancelada pelo mesmo guard do Workspace.
          </p>
          <div className="space-y-1">
            {layouts.map((entry) => {
              const selected = active?.id === entry.layout.id;
              return (
                <button
                  key={entry.layout.id}
                  type="button"
                  disabled={Boolean(switching) || selected}
                  onClick={() => void switchLayout(entry.layout.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-[9px]",
                    selected
                      ? "border-success/50 bg-success/10 text-success"
                      : "border-border bg-canvas text-foreground hover:border-warning/45 hover:bg-warning/5",
                  )}
                >
                  <span>
                    <b>{entry.isBase ? "Base" : "Runtime"}</b> · {entry.layout.id}
                    <span className="mt-0.5 block font-mono text-[7px] opacity-70">
                      {entry.layout.blockdata_filepath}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[8px] opacity-70">
                    {entry.layout.width}×{entry.layout.height}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
