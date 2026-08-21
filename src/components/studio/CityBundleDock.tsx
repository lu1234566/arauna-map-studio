import { useEffect, useRef } from "react";
import { AlertTriangle, Download, FileJson2, ShieldCheck, Upload } from "lucide-react";
import { editorStore, useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import { useRealAtlas } from "@/lib/realAtlasStore";
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

/**
 * Entrada/saída do bundle completo. Fica separado dos botões BIN/JSON para
 * deixar claro que este arquivo contém grid + map.json + contratos + checksums.
 */
export function CityBundleDock() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousAtlasRef = useRef<string | null | undefined>(undefined);
  const audit = state.gameAudit;

  useEffect(() => {
    const key = atlas?.createdAt ?? null;
    if (previousAtlasRef.current === undefined) {
      previousAtlasRef.current = key;
      return;
    }
    if (previousAtlasRef.current !== key) {
      previousAtlasRef.current = key;
      // Um PASS foi calculado contra um atlas específico. Trocar/limpar atlas
      // invalida imediatamente esse selo para não manter um Game-ready stale.
      editorStore.clearValidation();
      editorStore.setMessage("Atlas alterado. Rode Validar novamente antes de considerar o mapa implementável.");
    }
  }, [atlas?.createdAt]);

  const importBundle = async (file: File) => {
    const source = await file.text();
    const before = editorStore.getState();
    const result = editorStore.importCityBundle(source, file.name);
    if (!result.ok) {
      // importCityBundle é transacional e não altera state/history na falha.
      if (editorStore.getState() !== before) {
        console.error("Arauna City import violated atomicity invariant");
      }
      window.alert(`Cidade JSON rejeitada sem alterar o editor.\n\n${result.message}`);
      return;
    }
    requestMapCameraFit();
  };

  const exportBundle = () => {
    const result = editorStore.exportCityBundle();
    if (!result.ok) {
      window.alert(`Não foi possível montar a Cidade JSON.\n\n${result.message}`);
      return;
    }
    const base = safeName(result.bundle.identity.name);
    downloadText(result.source, `${base}.arauna-city.json`);
    editorStore.setMessage(
      result.gameAudit.implementable
        ? `Cidade JSON exportada: ${base}.arauna-city.json — IMPLEMENTÁVEL NO JOGO.`
        : `Cidade JSON exportada para revisão. Auditoria: ${result.gameAudit.counts.errors} erro(s), ${result.gameAudit.counts.warnings} aviso(s); dependências externas podem continuar parciais.`,
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
        {audit?.implementable ? "Game-ready" : audit ? (audit.pass ? "Parcial" : "Bloqueado") : "Não auditado"}
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
