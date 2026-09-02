import { Check, Hammer, MapPinned, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ExactGridPreview } from "@/components/studio/ExactGridPreview";
import { compileAiExactGrid, type AiExactGridPlan } from "@/lib/aiExactGrid";
import { applyExactGridToEditor } from "@/lib/aiExactGridApply";
import { planAiMapIdentityBase } from "@/lib/aiMapIdentity";
import { parseLocalMapCommand } from "@/lib/aiMapLocalInterpreter";
import { compileAiMapPlan, type AiMapCompileResult } from "@/lib/aiMapPlan";
import { planAiMapReconstruction } from "@/lib/aiMapReconstruction";
import { deriveAiReservedCells } from "@/lib/aiMapReservedCells";
import { ARAUNA_ADDITIONAL_PRESETS, type AraunaPresetCatalogEntry } from "@/lib/araunaPresetCatalog";
import { editorStore, useEditor } from "@/lib/editorStore";
import { requestMapCameraFit } from "@/lib/mapCamera";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

interface PreparedPreset {
  id: string;
  label: string;
  compiled: AiMapCompileResult;
  grid: AiExactGridPlan;
}

export function AraunaPresetLauncher() {
  const editor = useEditor();
  const atlas = useRealAtlas();
  const patternState = usePatternLibrary();
  const pathState = useSmartPath();
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPreset | null>(null);
  const [message, setMessage] = useState("Abra um mapa real para preparar um preset local de Arauna.");

  const compatiblePatterns = useMemo(() => patternState.patterns.filter((pattern) => (
    !pattern.scope || Boolean(atlas && pattern.scope.primary === atlas.primary && pattern.scope.secondary === atlas.secondary)
  )), [patternState.patterns, atlas?.primary, atlas?.secondary]);

  const compatiblePaths = useMemo(() => pathState.presets.filter((preset) => (
    !preset.scope || Boolean(atlas && preset.scope.primary === atlas.primary && preset.scope.secondary === atlas.secondary)
  )), [pathState.presets, atlas?.primary, atlas?.secondary]);

  const reservedCells = useMemo(() => deriveAiReservedCells(
    editor.events,
    editor.mapJsonDocument,
    editor.map.width,
    editor.map.height,
  ), [editor.events, editor.mapJsonDocument, editor.map.width, editor.map.height]);

  const entries = useMemo(() => ARAUNA_ADDITIONAL_PRESETS.map((entry) => ({
    entry,
    guard: entry.guardFromAtlas(
      editor.map.width,
      editor.map.height,
      editor.mapMetadata?.id ?? null,
      atlas,
    ),
  })), [editor.map.width, editor.map.height, editor.mapMetadata?.id, atlas?.primary, atlas?.secondary]);

  const availableCount = entries.filter(({ guard }) => guard.enabled).length;

  const preparePreset = (entry: AraunaPresetCatalogEntry) => {
    const guard = entry.guardFromAtlas(
      editor.map.width,
      editor.map.height,
      editor.mapMetadata?.id ?? null,
      atlas,
    );
    if (!guard.enabled) {
      setPrepared(null);
      setMessage(guard.reason);
      return;
    }
    if (!editor.mapJsonDocument) {
      setPrepared(null);
      setMessage("Preset bloqueado: abra o mapa pelo Workspace com map.json ativo antes de preparar um Exact Grid aplicável ao jogo.");
      return;
    }
    if (!atlas) {
      setPrepared(null);
      setMessage("Preset bloqueado: o atlas real do tileset ainda não foi carregado.");
      return;
    }

    const parsed = parseLocalMapCommand(
      entry.prompt,
      compatiblePatterns,
      compatiblePaths,
      editor.map.width,
      editor.map.height,
    );
    if (!parsed.plan) {
      setPrepared(null);
      setMessage(`Falha no preset ${entry.label}: ${parsed.errors.join(" ")}`);
      return;
    }

    const compiled = compileAiMapPlan(parsed.plan, compatiblePatterns, compatiblePaths);
    if (!compiled.valid || !compiled.template || !compiled.blueprint) {
      setPrepared(null);
      setMessage(`Preset ${entry.label} não compilou: ${compiled.errors[0] ?? "plano incompleto."}`);
      return;
    }

    const reconstruction = planAiMapReconstruction(
      editor.map,
      atlas,
      compatiblePatterns,
      reservedCells,
      compatiblePaths,
    );
    const identity = planAiMapIdentityBase(
      reconstruction.map,
      atlas,
      compatiblePatterns,
      reservedCells,
      reconstruction,
    );
    const grid = compileAiExactGrid({
      sourceMap: editor.map,
      prompt: entry.prompt,
      compiled,
      atlas,
      patterns: compatiblePatterns,
      smartPaths: compatiblePaths,
      reservedCells,
      reconstruction,
      portMetatile: identity.portMetatile ?? null,
      canPaint: (x, y) => !editorStore.isProtected(x, y),
    });

    setPrepared({ id: entry.id, label: entry.label, compiled, grid });
    setMessage(grid.valid
      ? `${entry.label}: Exact Grid pronto — ${grid.resolvedCount}/${grid.totalCount} células, ${grid.changedCount} diferença(s), checksum ${grid.checksum}. Revise e aplique separadamente.`
      : `${entry.label}: aplicação bloqueada — ${grid.errors[0] ?? "Exact Grid inválido."}`);
  };

  const applyPrepared = () => {
    if (!prepared?.grid.valid) return;
    const result = applyExactGridToEditor(prepared.grid, prepared.compiled);
    setMessage(result.message);
    if (!result.ok) return;
    requestMapCameraFit();
    setPrepared(null);
  };

  return (
    <div className="absolute right-[132px] top-12 z-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded border bg-panel/95 px-2.5 text-[10px] font-semibold shadow-lg backdrop-blur-sm",
          open ? "border-primary/60 text-primary" : "border-primary/35 text-foreground hover:bg-primary/10",
        )}
        title="Presets determinísticos adicionais de Arauna — sem Gemini/PixelLab"
      >
        <MapPinned className="size-3.5" /> Presets Arauna
        {availableCount > 0 && (
          <span className="rounded bg-success/15 px-1 font-mono text-[8px] text-success">{availableCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[390px] max-w-[calc(100vw-20px)] overflow-hidden rounded border border-primary/35 bg-panel/98 shadow-2xl backdrop-blur-sm">
          <div className="border-b border-border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <ShieldCheck className="size-3.5 text-success" /> Presets locais certificados
            </div>
            <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground">
              Só o preset compatível com o mapa/tileset aberto é liberado. Preparar gera um Exact Grid para revisão; aplicar continua sendo um clique separado.
            </p>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1">
              {entries.map(({ entry, guard }) => {
                const selected = prepared?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={!guard.enabled}
                    onClick={() => preparePreset(entry)}
                    title={guard.reason}
                    className={cn(
                      "min-h-10 rounded border px-2 py-1 text-left text-[9px] leading-tight transition-colors",
                      selected
                        ? "border-success/60 bg-success/15 text-success"
                        : guard.enabled
                          ? "border-success/35 bg-success/5 text-foreground hover:bg-success/10"
                          : "border-border bg-canvas text-muted-foreground opacity-45",
                    )}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      {guard.enabled ? <Check className="size-3 text-success" /> : <X className="size-3" />}
                      {entry.label}
                    </span>
                    <span className="mt-0.5 block text-[7px] opacity-75">{guard.enabled ? "Preparar Exact Grid" : "Mapa incompatível"}</span>
                  </button>
                );
              })}
            </div>

            <div className={cn(
              "mt-2 rounded border p-2 text-[8px] leading-relaxed",
              prepared?.grid.valid ? "border-success/30 bg-success/5 text-success" : "border-border bg-canvas text-muted-foreground",
            )}>
              {message}
            </div>

            {prepared?.grid.errors.length ? (
              <div className="mt-2 max-h-24 overflow-y-auto rounded border border-destructive/35 bg-destructive/5 p-2 text-[8px] text-destructive">
                {prepared.grid.errors.join(" ")}
              </div>
            ) : null}

            {prepared?.grid.valid && (
              <div className="mt-2 space-y-2">
                <ExactGridPreview grid={prepared.grid} atlas={atlas} />
                <button
                  type="button"
                  onClick={applyPrepared}
                  className="inline-flex w-full items-center justify-center gap-1 rounded border border-success/50 bg-success/10 px-2 py-2 text-[10px] font-semibold text-success hover:bg-success/20"
                >
                  <Hammer className="size-3.5" /> Aplicar {prepared.label} · {prepared.grid.checksum}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
