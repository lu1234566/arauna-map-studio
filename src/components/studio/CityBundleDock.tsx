import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Download, FileJson2, ShieldCheck, Upload } from "lucide-react";
import { canonicalJson, parseCityBundle, serializeCityBundle } from "@/lib/araunaCityBundle";
import { installBundleDependencyContextFromImport } from "@/lib/bundleDependencyContext";
import {
  scriptSpatialSnapshotFromBundle,
  sharedEventsSnapshotFromBundle,
  validateBundleDependencies,
} from "@/lib/cityBundleDependencies";
import { auditCompleteGameState } from "@/lib/completeGameAudit";
import { editorStore, useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import { useRealAtlas } from "@/lib/realAtlasStore";
import {
  buildScriptSpatialContext,
  getScriptSpatialContext,
  installScriptSpatialContextFromBundle,
  refreshScriptSpatialContext,
} from "@/lib/scriptSpatialContext";
import { referencedScriptWarpMapIds } from "@/lib/scriptSpatialContracts";
import { buildWorkspaceAuditContext, sharedEventsContextKey } from "@/lib/workspaceAuditContext";
import { refreshWorkspaceAuditContextWithScriptMaps } from "@/lib/workspaceScriptDependencies";
import { useWorkspaceSession } from "@/lib/workspaceSession";
import { cn } from "@/lib/utils";

function downloadText(source: string, fileName: string) {
  const blob = new Blob([source], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "mapa";
}

function dependencyErrorText(issues: Array<{ code: string; message: string }>) {
  return issues.map((found) => `${found.code}: ${found.message}`).join("\n");
}

/**
 * Entrada/saída do bundle completo. Fica separado dos botões BIN/JSON para
 * deixar claro que este arquivo contém grid + map.json + contratos + checksums.
 */
export function CityBundleDock() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const session = useWorkspaceSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousAtlasRef = useRef<string | null | undefined>(undefined);
  const audit = useMemo(
    () =>
      state.gameAudit
        ? auditCompleteGameState({
            map: state.map,
            mapJson: state.mapJsonDocument,
            mapName: state.mapName,
            atlas,
          }).report
        : null,
    [state.gameAudit, state.map, state.mapJsonDocument, state.mapName, atlas],
  );

  useEffect(() => {
    const key = atlas?.createdAt ?? null;
    if (previousAtlasRef.current === undefined) {
      previousAtlasRef.current = key;
      return;
    }
    if (previousAtlasRef.current !== key) {
      previousAtlasRef.current = key;
      editorStore.clearValidation();
      editorStore.setMessage(
        "Atlas alterado. Rode Validar novamente antes de considerar o mapa implementável.",
      );
    }
  }, [atlas?.createdAt]);

  const importBundle = async (file: File) => {
    const source = await file.text();

    // PRE-FLIGHT: nenhuma mutação do EditorStore acontece antes de todos os
    // snapshots externos passarem formato, checksum e derivação.
    let parsed;
    try {
      parsed = parseCityBundle(source);
      const dependencyIssues = validateBundleDependencies(parsed);
      if (dependencyIssues.length) {
        window.alert(
          `Cidade JSON rejeitada sem alterar o editor.\n\n${dependencyErrorText(dependencyIssues)}`,
        );
        return;
      }

      if (session?.workspace) {
        // Se a mesma fonte existe na pasta aberta, bundle e Workspace precisam
        // concordar. Um snapshot antigo não pode substituir silenciosamente a
        // versão atual dos eventos/scripts do jogo.
        const [workspacePreview, scriptPreview] = await Promise.all([
          buildWorkspaceAuditContext(session.workspace, parsed.mapJson),
          buildScriptSpatialContext(session.workspace, parsed.mapJson),
        ]);

        const sharedName =
          typeof parsed.mapJson.shared_events_map === "string"
            ? parsed.mapJson.shared_events_map.trim()
            : "";
        const bundledShared = sharedEventsSnapshotFromBundle(parsed);
        const liveShared = sharedName
          ? (workspacePreview.maps[sharedEventsContextKey(sharedName)]?.mapJson ?? null)
          : null;
        if (
          bundledShared &&
          liveShared &&
          canonicalJson(bundledShared.mapJson) !== canonicalJson(liveShared)
        ) {
          window.alert(
            `Cidade JSON rejeitada sem alterar o editor.\n\n` +
              `BUNDLE_SHARED_EVENTS_STALE: o snapshot de ${sharedName} difere do map.json existente no Workspace.`,
          );
          return;
        }

        const bundledScripts = scriptSpatialSnapshotFromBundle(parsed);
        if (
          bundledScripts &&
          scriptPreview.contracts &&
          !scriptPreview.error &&
          bundledScripts.sourceChecksum !== scriptPreview.sourceChecksum
        ) {
          window.alert(
            `Cidade JSON rejeitada sem alterar o editor.\n\n` +
              `BUNDLE_SCRIPT_SPATIAL_STALE: ${bundledScripts.sourcePath} difere das fontes de script efetivas existentes no Workspace.`,
          );
          return;
        }
      }
    } catch (error) {
      window.alert(
        `Cidade JSON rejeitada sem alterar o editor.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const before = editorStore.getState();
    const result = editorStore.importCityBundle(source, file.name);
    if (!result.ok) {
      if (editorStore.getState() !== before) {
        console.error("Arauna City import violated atomicity invariant");
      }
      window.alert(`Cidade JSON rejeitada sem alterar o editor.\n\n${result.message}`);
      return;
    }

    const after = editorStore.getState();
    installBundleDependencyContextFromImport(result.bundle, after.mapJsonDocument);

    if (session?.workspace && after.mapJsonDocument) {
      // Recarrega contra a MESMA instância de mapJson instalada pelo editor.
      // A lista de dependências inclui também MAP_* descobertos nos scripts.
      const live = await refreshScriptSpatialContext(session.workspace, after.mapJsonDocument);
      if (!live?.contracts || live.error) {
        installScriptSpatialContextFromBundle(result.bundle, after.mapJsonDocument);
      }
      const activeContracts = getScriptSpatialContext()?.contracts;
      await refreshWorkspaceAuditContextWithScriptMaps(
        session.workspace,
        after.mapJsonDocument,
        activeContracts ? referencedScriptWarpMapIds(activeContracts) : [],
      );
    } else {
      installScriptSpatialContextFromBundle(result.bundle, after.mapJsonDocument);
    }

    // O gameAudit calculado dentro do import antecede a instalação dos
    // snapshots acima. Nunca exibimos esse selo como atual: o usuário roda
    // Validar e recebe a auditoria completa unificada.
    editorStore.clearValidation();
    editorStore.setMessage(
      "Cidade JSON importada com dependências preservadas. Rode Validar para calcular o selo Game-ready atual.",
    );
    requestMapCameraFit();
  };

  const exportBundle = () => {
    const document = state.mapJsonDocument;
    const scriptContext = getScriptSpatialContext();
    if (
      !document ||
      !scriptContext ||
      scriptContext.sourceDocument !== document ||
      scriptContext.sourceMapId !== document.id ||
      !scriptContext.contracts ||
      scriptContext.error ||
      !scriptContext.source
    ) {
      window.alert(
        "Exportação bloqueada por segurança.\n\n" +
          "As fontes de script efetivas ainda não estão certificadas para esta versão do mapa. " +
          "Abra/importe pelo Workspace e rode Validar; bundles importados também precisam conter o snapshot espacial íntegro.",
      );
      return;
    }

    const complete = auditCompleteGameState({
      map: state.map,
      mapJson: document,
      mapName: state.mapName,
      atlas,
    });
    if (!complete.bundle) {
      window.alert(
        "Não foi possível montar a Cidade JSON completa. Rode Validar e corrija os erros do mapa.json/grid.",
      );
      return;
    }

    if (!scriptSpatialSnapshotFromBundle(complete.bundle)) {
      window.alert(
        "Exportação bloqueada: o snapshot íntegro das fontes de script não pôde ser embutido no bundle.",
      );
      return;
    }

    const sharedName =
      typeof document.shared_events_map === "string" ? document.shared_events_map.trim() : "";
    if (sharedName && !sharedEventsSnapshotFromBundle(complete.bundle)) {
      window.alert(
        `Exportação bloqueada por segurança.\n\n` +
          `Este mapa usa shared_events_map=${sharedName}, mas a fonte compartilhada não está disponível no Workspace nem no bundle importado.`,
      );
      return;
    }

    const source = serializeCityBundle(complete.bundle);
    const base = safeName(complete.bundle.identity.name);
    downloadText(source, `${base}.arauna-city.json`);
    editorStore.setMessage(
      complete.report.implementable
        ? `Cidade JSON exportada: ${base}.arauna-city.json — IMPLEMENTÁVEL NO JOGO.`
        : `Cidade JSON exportada para revisão. Auditoria: ${complete.report.counts.errors} erro(s), ${complete.report.counts.warnings} aviso(s); dependências externas podem continuar parciais.`,
    );
  };

  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-panel/95 p-1 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1.5 px-1.5" title="Bundle completo arauna-city-v1">
        <FileJson2 className="size-3.5 text-primary" />
        <span className="text-[10px] font-semibold">Cidade JSON</span>
      </div>
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-medium hover:bg-surface"
        onClick={() => inputRef.current?.click()}
        title="Importar grid + map.json + eventos + conexões + clima + integridade em uma única transação"
      >
        <Upload className="size-3.5" /> Importar
      </button>
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-medium hover:bg-surface disabled:pointer-events-none disabled:opacity-35"
        disabled={!state.mapJsonDocument}
        onClick={exportBundle}
        title="Exportar bundle completo; map.bin/map.json avulsos continuam disponíveis no toolbar"
      >
        <Download className="size-3.5" /> Exportar
      </button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <div
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold",
          audit?.implementable
            ? "bg-success/10 text-success"
            : audit?.pass
              ? "bg-warning/10 text-warning"
              : audit
                ? "bg-destructive/10 text-destructive"
                : "bg-surface text-muted-foreground",
        )}
        title={
          audit
            ? `${audit.counts.errors} erro(s), ${audit.counts.warnings} aviso(s) · confiança ${audit.confidence}`
            : "Rode Validar para calcular implementabilidade"
        }
      >
        {audit?.implementable ? (
          <ShieldCheck className="size-3.5" />
        ) : (
          <AlertTriangle className="size-3.5" />
        )}
        {audit?.implementable
          ? "Game-ready"
          : audit
            ? audit.pass
              ? "Parcial"
              : "Bloqueado"
            : "Não auditado"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importBundle(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
