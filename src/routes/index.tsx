import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClipboardDock } from "@/components/studio/ClipboardDock";
import { Inspector } from "@/components/studio/Inspector";
import { MapCanvas } from "@/components/studio/MapCanvas";
import { SmartPathDock } from "@/components/studio/SmartPathDock";
import { SmartPathOverlay } from "@/components/studio/SmartPathOverlay";
import { StampOverlay } from "@/components/studio/StampOverlay";
import { StatusBar } from "@/components/studio/StatusBar";
import { TilePalette } from "@/components/studio/TilePalette";
import { TopToolbar } from "@/components/studio/TopToolbar";
import { ValidationPanel } from "@/components/studio/ValidationPanel";
import { clipboardStore } from "@/lib/clipboardStore";
import { editorStore, useEditor } from "@/lib/editorStore";
import { smartPathStore } from "@/lib/smartPathStore";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const state = useEditor();

  // Smart Paths assume a dedicated visual brush. If the normal toolbar changes
  // to picker/fill/selection, hand control back to MapCanvas automatically.
  useEffect(() => {
    if (state.tool !== "pencil" && smartPathStore.getState().enabled) {
      smartPathStore.setEnabled(false);
    }
  }, [state.tool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
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

      if (modifier && key === "c") {
        event.preventDefault();
        if (event.shiftKey) clipboardStore.copyRawSelection();
        else clipboardStore.copySelection();
        return;
      }

      if (modifier && key === "x") {
        event.preventDefault();
        clipboardStore.cutSelection(event.shiftKey ? "raw" : undefined);
        return;
      }

      if (modifier && key === "v") {
        event.preventDefault();
        clipboardStore.pasteAtSelected();
        return;
      }

      if (key === "escape") {
        if (smartPathStore.getState().enabled) {
          event.preventDefault();
          smartPathStore.setEnabled(false);
        } else if (clipboardStore.getState().stampMode) {
          event.preventDefault();
          clipboardStore.toggleStampMode(false);
        } else {
          editorStore.setSelection(null);
        }
        return;
      }

      if (key === "p") {
        event.preventDefault();
        if (!smartPathStore.getState().enabled) editorStore.setTool("pencil");
        smartPathStore.toggleEnabled();
        return;
      }

      if (key === "e" && smartPathStore.getState().enabled) {
        event.preventDefault();
        smartPathStore.toggleMode();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        if (smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
        clipboardStore.toggleStampMode();
        return;
      }

      if (key === "b" || key === "i" || key === "g" || key === "m") {
        if (smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
        if (clipboardStore.getState().stampMode) clipboardStore.toggleStampMode(false);
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
          <StampOverlay />
          <SmartPathOverlay />
          <SmartPathDock />
          <ClipboardDock />
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
