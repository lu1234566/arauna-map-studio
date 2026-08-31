import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExclusivePaintModeGuard } from "@/components/studio/ExclusivePaintModeGuard";
import { Inspector } from "@/components/studio/Inspector";
import { MapCanvas } from "@/components/studio/MapCanvas";
import { MapMinimap } from "@/components/studio/MapMinimap";
import { MapTemplateOverlay } from "@/components/studio/MapTemplateOverlay";
import { MapTemplateScopeGuard } from "@/components/studio/MapTemplateScopeGuard";
import { PatternOverlay } from "@/components/studio/PatternOverlay";
import { PatternScopeGuard } from "@/components/studio/PatternScopeGuard";
import { PixelLabBlueprintOverlay } from "@/components/studio/PixelLabBlueprintOverlay";
import { PixelLabOverlay } from "@/components/studio/PixelLabOverlay";
import { SmartPathOverlay } from "@/components/studio/SmartPathOverlay";
import { SmartPathScopeGuard } from "@/components/studio/SmartPathScopeGuard";
import { StampOverlay } from "@/components/studio/StampOverlay";
import { StatusBar } from "@/components/studio/StatusBar";
import { StudioAssistantDrawer } from "@/components/studio/StudioAssistantDrawer";
import { TilePalette } from "@/components/studio/TilePalette";
import { TopToolbar } from "@/components/studio/TopToolbar";
import { ValidationPanel } from "@/components/studio/ValidationPanel";
import { clipboardStore } from "@/lib/clipboardStore";
import { auditCompleteGameState } from "@/lib/completeGameAudit";
import { editorStore, useEditor } from "@/lib/editorStore";
import type { GameImplementabilityReport } from "@/lib/gameImplementability";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import { patternLibraryStore } from "@/lib/patternLibraryStore";
import { ensureAuthenticEmeraldPreviewAtlas } from "@/lib/pretEmeraldBootstrap";
import { realAtlasStore } from "@/lib/realAtlasStore";
import {
  clearScriptSpatialContext,
  getScriptSpatialContext,
  refreshScriptSpatialContext,
} from "@/lib/scriptSpatialContext";
import { referencedScriptWarpMapIds } from "@/lib/scriptSpatialContracts";
import { smartPathStore } from "@/lib/smartPathStore";
import { clearWorkspaceAuditContext } from "@/lib/workspaceAuditContext";
import { refreshWorkspaceAuditContextWithScriptMaps } from "@/lib/workspaceScriptDependencies";
import {
  clearWorkspaceSymbolAuditContext,
  refreshWorkspaceSymbolAuditContext,
} from "@/lib/workspaceSymbolAudit";
import { useWorkspaceSession } from "@/lib/workspaceSession";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const state = useEditor();
  const session = useWorkspaceSession();
  const [completeGameAudit, setCompleteGameAudit] = useState<GameImplementabilityReport | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const renderedGameAudit = state.gameAudit ? completeGameAudit : null;

  useEffect(() => {
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
    if (!state.gameAudit && completeGameAudit) setCompleteGameAudit(null);
  }, [state.gameAudit, completeGameAudit]);

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
        if (mapTemplateStore.getState().enabled) {
          event.preventDefault();
          mapTemplateStore.setEnabled(false);
        } else if (patternLibraryStore.getState().enabled) {
          event.preventDefault();
          patternLibraryStore.setEnabled(false);
        } else if (smartPathStore.getState().enabled) {
          event.preventDefault();
          smartPathStore.setEnabled(false);
        } else if (clipboardStore.getState().stampMode) {
          event.preventDefault();
          clipboardStore.toggleStampMode(false);
        } else editorStore.setSelection(null);
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
      if (key === "e" && smartPathStore.getState().enabled) {
        event.preventDefault();
        smartPathStore.toggleMode();
        return;
      }
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
      const document = editorStore.getState().mapJsonDocument;
      try {
        if (session?.workspace) {
          const scriptContext = await refreshScriptSpatialContext(session.workspace, document);
          const scriptMapIds = scriptContext?.contracts ? referencedScriptWarpMapIds(scriptContext.contracts) : [];
          await Promise.all([
            refreshWorkspaceAuditContextWithScriptMaps(session.workspace, document, scriptMapIds),
            refreshWorkspaceSymbolAuditContext(session.workspace, document),
          ]);
        } else {
          clearWorkspaceAuditContext();
          clearWorkspaceSymbolAuditContext();
          const scriptContext = getScriptSpatialContext();
          if (!document || scriptContext?.sourceDocument !== document) clearScriptSpatialContext();
        }
      } catch (error) {
        clearWorkspaceAuditContext();
        clearWorkspaceSymbolAuditContext();
        const scriptContext = getScriptSpatialContext();
        if (!document || scriptContext?.sourceDocument !== document) clearScriptSpatialContext();
        editorStore.setMessage(
          `Não foi possível carregar dependências/fontes do Workspace para a auditoria: ${error instanceof Error ? error.message : String(error)}. A validação seguirá como parcial.`,
        );
      }

      editorStore.runValidation();
      const after = editorStore.getState();
      if (after.gameAudit) {
        const complete = auditCompleteGameState({
          map: after.map,
          mapJson: after.mapJsonDocument,
          mapName: after.mapName,
          atlas: realAtlasStore.ensureHydrated(),
        });
        setCompleteGameAudit(complete.report);
        const status = complete.report.implementable
          ? "IMPLEMENTÁVEL NO JOGO"
          : complete.report.pass
            ? `parcial: ${complete.report.counts.warnings} aviso(s) pendente(s)`
            : `${complete.report.counts.errors} erro(s) de implementação`;
        editorStore.setMessage(`Validação concluída: ${status}.`);
      } else {
        setCompleteGameAudit(null);
      }
    })();
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <TopToolbar onValidate={validateForGame} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {leftSidebarOpen ? (
          <div className="relative flex shrink-0 border-r border-border">
            <TilePalette />
            <button
              type="button"
              onClick={() => setLeftSidebarOpen(false)}
              className="absolute right-1 top-1 z-50 grid size-6 place-items-center rounded border border-border bg-toolbar/95 text-muted-foreground shadow hover:bg-surface hover:text-foreground"
              title="Recolher Metatiles"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex w-8 shrink-0 items-start justify-center border-r border-border bg-panel pt-2">
            <button
              type="button"
              onClick={() => setLeftSidebarOpen(true)}
              className="grid size-6 place-items-center rounded border border-border bg-toolbar text-muted-foreground hover:bg-surface hover:text-foreground"
              title="Abrir Metatiles"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}

        <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
          <MapCanvas />
          <PixelLabOverlay />
          <PixelLabBlueprintOverlay />
          <StampOverlay />
          <SmartPathOverlay />
          <PatternOverlay />
          <MapTemplateOverlay />
          <ExclusivePaintModeGuard />
          <SmartPathScopeGuard />
          <PatternScopeGuard />
          <MapTemplateScopeGuard />
          <MapMinimap />
          <StudioAssistantDrawer />
        </main>

        {rightSidebarOpen ? (
          <div className="relative flex shrink-0 border-l border-border">
            <button
              type="button"
              onClick={() => setRightSidebarOpen(false)}
              className="absolute left-1 top-1 z-50 grid size-6 place-items-center rounded border border-border bg-toolbar/95 text-muted-foreground shadow hover:bg-surface hover:text-foreground"
              title="Recolher Propriedades"
            >
              <ChevronRight className="size-3.5" />
            </button>
            <Inspector />
          </div>
        ) : (
          <div className="flex w-8 shrink-0 items-start justify-center border-l border-border bg-panel pt-2">
            <button
              type="button"
              onClick={() => setRightSidebarOpen(true)}
              className="grid size-6 place-items-center rounded border border-border bg-toolbar text-muted-foreground hover:bg-surface hover:text-foreground"
              title="Abrir Propriedades"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
        )}

        {state.validation && (
          <ValidationPanel
            report={state.validation}
            gameAudit={renderedGameAudit}
            onClose={() => editorStore.clearValidation()}
          />
        )}
      </div>
      <StatusBar />
    </div>
  );
}
