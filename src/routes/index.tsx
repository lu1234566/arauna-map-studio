import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CityBundleDock } from "@/components/studio/CityBundleDock";
import { ClipboardDock } from "@/components/studio/ClipboardDock";
import { ExclusivePaintModeGuard } from "@/components/studio/ExclusivePaintModeGuard";
import { Gen3LibraryLauncher } from "@/components/studio/Gen3LibraryLauncher";
import { Inspector } from "@/components/studio/Inspector";
import { MapBlueprintDock } from "@/components/studio/MapBlueprintDock";
import { MapCanvas } from "@/components/studio/MapCanvas";
import { MapMinimap } from "@/components/studio/MapMinimap";
import { MapTemplateDock } from "@/components/studio/MapTemplateDock";
import { MapTemplateOverlay } from "@/components/studio/MapTemplateOverlay";
import { MapTemplateScopeGuard } from "@/components/studio/MapTemplateScopeGuard";
import { PatternLibraryDock } from "@/components/studio/PatternLibraryDock";
import { PatternOverlay } from "@/components/studio/PatternOverlay";
import { PatternScopeGuard } from "@/components/studio/PatternScopeGuard";
import { ProceduralGeneratorLauncher } from "@/components/studio/ProceduralGeneratorLauncher";
import { SmartPathDock } from "@/components/studio/SmartPathDock";
import { SmartPathOverlay } from "@/components/studio/SmartPathOverlay";
import { SmartPathScopeGuard } from "@/components/studio/SmartPathScopeGuard";
import { StampOverlay } from "@/components/studio/StampOverlay";
import { StatusBar } from "@/components/studio/StatusBar";
import { TilePalette } from "@/components/studio/TilePalette";
import { TopToolbar } from "@/components/studio/TopToolbar";
import { ValidationPanel } from "@/components/studio/ValidationPanel";
import { clipboardStore } from "@/lib/clipboardStore";
import { editorStore, useEditor } from "@/lib/editorStore";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import { patternLibraryStore } from "@/lib/patternLibraryStore";
import { ensureAuthenticEmeraldPreviewAtlas } from "@/lib/pretEmeraldBootstrap";
import { realAtlasStore } from "@/lib/realAtlasStore";
import { smartPathStore } from "@/lib/smartPathStore";
import {
  clearWorkspaceAuditContext,
  refreshWorkspaceAuditContext,
} from "@/lib/workspaceAuditContext";
import { useWorkspaceSession } from "@/lib/workspaceSession";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const state = useEditor();
  const session = useWorkspaceSession();

  useEffect(() => {
    // A prévia vazia do Lovable/Chrome deve mostrar o Emerald real, nunca
    // quadrados procedurais. Workspaces locais continuam tendo prioridade.
    if (realAtlasStore.ensureHydrated()) return;
    void ensureAuthenticEmeraldPreviewAtlas()
      .then((atlas) => {
        editorStore.setMessage(
          `Atlas GBA real carregado: ${atlas.primary} + ${atlas.secondary} (pret/pokeemerald). Abra Workspace para usar exatamente os tilesets do mapa Arauna.`,
        );
      })
      .catch((error) => {
        editorStore.setMessage(
          `Não foi possível buscar o atlas Emerald real pela internet: ${error instanceof Error ? error.message : String(error)} Abra Workspace para carregar os tilesets locais.`,
        );
      });
  }, []);

  useEffect(() => {
    if (state.tool !== "pencil" && smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
    if (state.tool !== "pencil" && patternLibraryStore.getState().enabled) patternLibraryStore.setEnabled(false);
    if (state.tool !== "pencil" && mapTemplateStore.getState().enabled) mapTemplateStore.setEnabled(false);
  }, [state.tool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (typing) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "z") { event.preventDefault(); event.shiftKey ? editorStore.redo() : editorStore.undo(); return; }
      if (modifier && key === "y") { event.preventDefault(); editorStore.redo(); return; }
      if (modifier && key === "c") { event.preventDefault(); event.shiftKey ? clipboardStore.copyRawSelection() : clipboardStore.copySelection(); return; }
      if (modifier && key === "x") { event.preventDefault(); clipboardStore.cutSelection(event.shiftKey ? "raw" : undefined); return; }
      if (modifier && key === "v") { event.preventDefault(); clipboardStore.pasteAtSelected(); return; }

      if (key === "escape") {
        if (mapTemplateStore.getState().enabled) { event.preventDefault(); mapTemplateStore.setEnabled(false); }
        else if (patternLibraryStore.getState().enabled) { event.preventDefault(); patternLibraryStore.setEnabled(false); }
        else if (smartPathStore.getState().enabled) { event.preventDefault(); smartPathStore.setEnabled(false); }
        else if (clipboardStore.getState().stampMode) { event.preventDefault(); clipboardStore.toggleStampMode(false); }
        else editorStore.setSelection(null);
        return;
      }

      if (key === "t") {
        event.preventDefault();
        if (!mapTemplateStore.getState().enabled) editorStore.setTool("pencil");
        mapTemplateStore.toggleEnabled();
        return;
      }
      if (key === "l") {
        event.preventDefault();
        if (mapTemplateStore.getState().enabled) mapTemplateStore.setEnabled(false);
        if (!patternLibraryStore.getState().enabled) editorStore.setTool("pencil");
        patternLibraryStore.toggleEnabled();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        if (mapTemplateStore.getState().enabled) mapTemplateStore.setEnabled(false);
        if (patternLibraryStore.getState().enabled) patternLibraryStore.setEnabled(false);
        if (!smartPathStore.getState().enabled) editorStore.setTool("pencil");
        smartPathStore.toggleEnabled();
        return;
      }
      if (key === "e" && smartPathStore.getState().enabled) { event.preventDefault(); smartPathStore.toggleMode(); return; }
      if (key === "v") {
        event.preventDefault();
        if (mapTemplateStore.getState().enabled) mapTemplateStore.setEnabled(false);
        if (patternLibraryStore.getState().enabled) patternLibraryStore.setEnabled(false);
        if (smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
        clipboardStore.toggleStampMode();
        return;
      }

      if (key === "b" || key === "i" || key === "g" || key === "m") {
        if (mapTemplateStore.getState().enabled) mapTemplateStore.setEnabled(false);
        if (patternLibraryStore.getState().enabled) patternLibraryStore.setEnabled(false);
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

  const validateForGame = () => {
    void (async () => {
      try {
        await refreshWorkspaceAuditContext(
          session?.workspace,
          editorStore.getState().mapJsonDocument,
        );
      } catch (error) {
        clearWorkspaceAuditContext();
        editorStore.setMessage(
          `Não foi possível carregar dependências do Workspace para a auditoria: ${error instanceof Error ? error.message : String(error)}. A validação seguirá como parcial.`,
        );
      }
      editorStore.runValidation();
    })();
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <TopToolbar onValidate={validateForGame} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <TilePalette />
        <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
          <MapCanvas />
          <MapMinimap />
          <CityBundleDock />
          <StampOverlay />
          <SmartPathOverlay />
          <PatternOverlay />
          <MapTemplateOverlay />
          <ExclusivePaintModeGuard />
          <SmartPathScopeGuard />
          <PatternScopeGuard />
          <MapTemplateScopeGuard />
          <SmartPathDock />
          <PatternLibraryDock />
          <MapTemplateDock />
          <MapBlueprintDock />
          <ClipboardDock />
          <ProceduralGeneratorLauncher />
          <Gen3LibraryLauncher />
        </main>
        <Inspector />
        {state.validation && (
          <ValidationPanel
            report={state.validation}
            gameAudit={state.gameAudit}
            onClose={() => editorStore.clearValidation()}
          />
        )}
      </div>
      <StatusBar />
    </div>
  );
}
