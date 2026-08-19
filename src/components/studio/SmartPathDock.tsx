import { useRef } from "react";
import { hex } from "@/lib/emeraldMap";
import {
  SMART_PATH_MASK_ORDER,
  maskLabel,
  validateSmartPathPreset,
} from "@/lib/smartPath";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";
import { useEditor } from "@/lib/editorStore";
import { cn } from "@/lib/utils";

function downloadText(source: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([source], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MaskGlyph({ mask }: { mask: number }) {
  const arm = "absolute bg-current";
  return (
    <span className="relative block size-7 shrink-0 text-primary" aria-label={maskLabel(mask)}>
      <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-current" />
      {Boolean(mask & 1) && <span className={`${arm} left-[13px] top-0 h-[11px] w-[2px]`} />}
      {Boolean(mask & 2) && <span className={`${arm} right-0 top-[13px] h-[2px] w-[11px]`} />}
      {Boolean(mask & 4) && <span className={`${arm} bottom-0 left-[13px] h-[11px] w-[2px]`} />}
      {Boolean(mask & 8) && <span className={`${arm} left-0 top-[13px] h-[2px] w-[11px]`} />}
    </span>
  );
}

function TinyButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded border px-2 py-1 text-[9px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/20 text-primary"
          : "border-border bg-toolbar text-foreground/80 hover:bg-surface",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

export function SmartPathDock() {
  const state = useSmartPath();
  const editor = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = state.presets.find((item) => item.id === state.activePresetId) ?? null;
  const validation = preset ? validateSmartPathPreset(preset) : null;
  const scope = preset ? smartPathStore.scopeStatus() : null;

  const importFile = async (file: File) => {
    smartPathStore.importJson(await file.text());
  };

  return (
    <section className="absolute left-2 top-2 z-30 flex max-h-[calc(100%-16px)] flex-col overflow-hidden rounded border border-border bg-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => smartPathStore.toggleEnabled()}
          className={cn(
            "rounded border px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
            state.enabled
              ? "border-primary/60 bg-primary/20 text-primary"
              : "border-border bg-toolbar text-foreground hover:bg-surface",
          )}
          title="Smart Paths (P): desenha conexões usando os 16 masks NESW do preset"
        >
          Smart Paths {state.enabled ? "ON" : "OFF"}
        </button>

        {preset && (
          <select
            value={preset.id}
            onChange={(event) => smartPathStore.selectPreset(event.target.value)}
            className="h-7 max-w-40 rounded border border-border bg-canvas px-1.5 text-[10px] outline-none focus:border-primary/60"
            title="Preset ativo"
          >
            {state.presets.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        )}

        {state.enabled && (
          <div className="flex rounded border border-border bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => smartPathStore.setMode("add")}
              className={cn("rounded px-2 py-1 text-[9px]", state.mode === "add" && "bg-success/20 text-success")}
            >
              + Adicionar
            </button>
            <button
              type="button"
              onClick={() => smartPathStore.setMode("erase")}
              className={cn("rounded px-2 py-1 text-[9px]", state.mode === "erase" && "bg-destructive/20 text-destructive")}
            >
              − Apagar
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => smartPathStore.setPanelOpen(!state.panelOpen)}
          className="rounded border border-border bg-toolbar px-2 py-1.5 text-[9px] text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          {state.panelOpen ? "Fechar" : "Configurar"}
        </button>
      </div>

      {state.panelOpen && (
        <div className="w-[430px] max-w-[calc(100vw-300px)] min-w-[340px] overflow-y-auto border-t border-border">
          <div className="space-y-2 border-b border-border p-2.5">
            <div className="flex flex-wrap gap-1">
              <TinyButton onClick={() => smartPathStore.createPreset()}>+ Novo preset</TinyButton>
              <TinyButton disabled={!preset} onClick={() => smartPathStore.duplicateActive()}>Duplicar</TinyButton>
              <TinyButton disabled={!preset} onClick={() => smartPathStore.deleteActive()}>Excluir</TinyButton>
              <TinyButton onClick={() => fileRef.current?.click()}>Importar JSON</TinyButton>
              <TinyButton
                disabled={!preset}
                onClick={() => {
                  const source = smartPathStore.exportActiveJson();
                  if (source && preset) downloadText(source, `${preset.name.replace(/[^a-z0-9_-]+/gi, "_")}.smartpath.json`);
                }}
              >
                Exportar JSON
              </TinyButton>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
              />
            </div>

            {!preset ? (
              <div className="rounded border border-warning/40 bg-warning/10 p-2 text-[10px] leading-relaxed text-warning">
                Nenhum preset. Selecione um metatile na paleta e clique <b>Novo preset</b>. O Studio não adivinha quais IDs formam curvas, T ou cruzamentos: você os define explicitamente para evitar gerar um mapa Emerald incorreto.
              </div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-[9px] uppercase tracking-wide text-muted-foreground">Nome</span>
                  <input
                    value={preset.name}
                    onChange={(event) => smartPathStore.renameActive(event.target.value)}
                    className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-primary/60"
                  />
                </label>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[9px] uppercase tracking-wide text-muted-foreground">Metatile ao apagar</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={1023}
                        value={preset.eraseMetatile}
                        onChange={(event) => smartPathStore.setEraseMetatile(Number(event.target.value))}
                        className="h-7 min-w-0 flex-1 rounded border border-border bg-canvas px-2 font-mono text-[10px] outline-none focus:border-primary/60"
                      />
                      <span className="w-12 font-mono text-[9px] text-muted-foreground">{hex(preset.eraseMetatile, 3)}</span>
                      <TinyButton onClick={() => smartPathStore.setEraseFromSelected()}>usar atual {editor.selectedMetatile}</TinyButton>
                    </div>
                  </label>
                  <div className="flex items-end pb-0.5">
                    <TinyButton onClick={() => smartPathStore.fillVariantsFromSelected()}>
                      16 masks ← ID {editor.selectedMetatile}
                    </TinyButton>
                  </div>
                </div>

                <div className={cn(
                  "rounded border p-2 text-[9px] leading-relaxed",
                  validation?.valid
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}>
                  {validation?.valid
                    ? `Preset estruturalmente válido.${validation.warnings.length ? ` ${validation.warnings.join(" ")}` : ""}`
                    : validation?.errors.join(" ")}
                </div>

                {scope && (
                  <div className={cn(
                    "rounded border px-2 py-1.5 text-[9px]",
                    scope.matches
                      ? "border-border bg-canvas text-muted-foreground"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}>
                    Tileset: {scope.message}
                  </div>
                )}
              </>
            )}
          </div>

          {preset && (
            <div className="p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">16 máscaras NESW</p>
                  <p className="text-[9px] text-muted-foreground">N=1 · E=2 · S=4 · W=8. IDs podem se repetir.</p>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">selecionado: {editor.selectedMetatile} / {hex(editor.selectedMetatile, 3)}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {SMART_PATH_MASK_ORDER.map((mask) => {
                  const value = preset.variants[mask] ?? 0;
                  return (
                    <div key={mask} className="flex items-center gap-1.5 rounded border border-border bg-canvas p-1.5">
                      <MaskGlyph mask={mask} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="w-8 font-mono text-[8px] text-muted-foreground">#{mask}</span>
                          <span className="truncate text-[9px] font-medium">{maskLabel(mask)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={1023}
                            value={value}
                            onChange={(event) => smartPathStore.setVariant(mask, Number(event.target.value))}
                            className="h-6 w-16 rounded border border-border bg-background px-1.5 font-mono text-[9px] outline-none focus:border-primary/60"
                          />
                          <span className="font-mono text-[8px] text-muted-foreground">{hex(value, 3)}</span>
                          <button
                            type="button"
                            title={`Usar metatile selecionado ${editor.selectedMetatile}`}
                            onClick={() => smartPathStore.setVariantFromSelected(mask)}
                            className="ml-auto rounded border border-border px-1 py-0.5 text-[8px] text-muted-foreground hover:bg-surface hover:text-primary"
                          >
                            ← atual
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-border px-2.5 py-2 text-[9px] leading-relaxed text-muted-foreground">
            Um Smart Path reconhece como parte do caminho qualquer metatile usado nos 16 masks. Ao pintar uma célula, só ela e os quatro vizinhos ortogonais são recalculados. Colisão e elevação não são tocadas. <b className="text-foreground">P</b> liga/desliga · <b className="text-foreground">E</b> alterna adicionar/apagar enquanto ativo.
          </div>
        </div>
      )}
    </section>
  );
}
