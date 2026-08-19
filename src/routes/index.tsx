import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Inspector } from "@/components/studio/Inspector";
import { MapCanvas } from "@/components/studio/MapCanvas";
import { StatusBar } from "@/components/studio/StatusBar";
import { TilePalette } from "@/components/studio/TilePalette";
import { TopToolbar } from "@/components/studio/TopToolbar";
import { ValidationPanel } from "@/components/studio/ValidationPanel";
import { editorStore, useEditor } from "@/lib/editorStore";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const state = useEditor();

  useEffect(() => {
    editorStore.hydrate();

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) editorStore.redo();
        else editorStore.undo();
        return;
      }

      if (modifier && key === "y") {
        event.preventDefault();
        editorStore.redo();
        return;
      }

      if (key === "b") editorStore.setTool("pencil");
      else if (key === "i") editorStore.setTool("picker");
      else if (key === "g") editorStore.setTool("fill");
      else if (key === "m") editorStore.setTool("select");
      else if (key === "+" || key === "=") editorStore.setZoom(editorStore.getState().zoom + 0.5);
      else if (key === "-") editorStore.setZoom(editorStore.getState().zoom - 0.5);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <TopToolbar onValidate={() => editorStore.runValidation()} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <TilePalette />
        <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
          <MapCanvas />
        </main>
        <Inspector />

        {state.validation && (
          <ValidationPanel
            report={state.validation}
            onClose={() => editorStore.clearValidation()}
          />
        )}
      </div>

      <StatusBar />
    </div>
  );
}
