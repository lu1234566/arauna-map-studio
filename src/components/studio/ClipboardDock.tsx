import { clipboardStore, useClipboard } from "@/lib/clipboardStore";
import { useEditor } from "@/lib/editorStore";
import { kindLabel } from "@/lib/mapClipboard";
import { smartPathStore } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

function Action({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/20 text-primary"
          : "border-border bg-toolbar text-foreground/85 hover:bg-surface",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

export function ClipboardDock() {
  const editor = useEditor();
  const clipboardState = useClipboard();
  const clipboard = clipboardState.clipboard;
  const selection = editor.selection;
  const editableLayer = editor.viewMode === "visual" || editor.viewMode === "collision" || editor.viewMode === "elevation";
  const hasAnchor = Boolean(selection || editor.selectedCell != null);
  const selectedCellLabel = editor.selectedCell == null
    ? "sem seleção ativa"
    : `célula (${editor.selectedCell % editor.map.width},${Math.floor(editor.selectedCell / editor.map.width)})`;

  // Não ocupa o canvas só porque uma célula foi clicada. O dock é contextual:
  // aparece apenas em camadas editáveis quando há seleção regional ou clipboard.
  if (!editableLayer || (!selection && !clipboard)) return null;

  return (
    <section className="absolute bottom-9 right-2 z-30 w-[310px] overflow-hidden rounded border border-border bg-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Seleção / Clipboard</p>
          <p className="text-[9px] text-muted-foreground">
            {selection ? `seleção ${selection.w}×${selection.h} em (${selection.x},${selection.y})` : selectedCellLabel}
          </p>
        </div>
        {clipboard && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
            {clipboard.width}×{clipboard.height} · {kindLabel(clipboard.kind)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 p-2">
        <Action
          title="Copiar a camada ativa da seleção (Ctrl+C)"
          disabled={!editableLayer || !hasAnchor}
          onClick={() => clipboardStore.copySelection()}
        >
          Copiar
        </Action>
        <Action
          title="Recortar a camada ativa e zerar somente essa camada (Ctrl+X)"
          disabled={!editableLayer || !hasAnchor}
          onClick={() => clipboardStore.cutSelection()}
        >
          Recortar
        </Action>
        <Action
          title="Copiar metatile + colisão + elevação da região"
          disabled={!hasAnchor}
          onClick={() => clipboardStore.copyRawSelection()}
        >
          Copiar RAW
        </Action>
        <Action
          title="Colar usando a célula/seleção atual como canto superior esquerdo (Ctrl+V)"
          disabled={!clipboard || !hasAnchor}
          onClick={() => clipboardStore.pasteAtSelected()}
        >
          Colar
        </Action>
        <Action
          title="Ativar carimbo multi-metatile no mapa (V); clique ou arraste para repetir o padrão"
          disabled={!clipboard}
          active={clipboardState.stampMode}
          onClick={() => {
            if (!clipboardState.stampMode && smartPathStore.getState().enabled) {
              smartPathStore.setEnabled(false);
            }
            clipboardStore.toggleStampMode();
          }}
        >
          {clipboardState.stampMode ? "Carimbo ON" : "Carimbo"}
        </Action>
      </div>

      {clipboard && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          <span className="mr-1 text-[9px] uppercase tracking-wide text-muted-foreground">Transformar</span>
          <Action title="Girar clipboard 90° no sentido horário" onClick={() => clipboardStore.rotate()}>↻ 90°</Action>
          <Action title="Espelhar clipboard horizontalmente" onClick={() => clipboardStore.flipHorizontal()}>↔ Esp.</Action>
          <Action title="Espelhar clipboard verticalmente" onClick={() => clipboardStore.flipVertical()}>↕ Esp.</Action>
          <button
            type="button"
            onClick={() => clipboardStore.clear()}
            className="ml-auto text-[9px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-destructive"
          >
            limpar
          </button>
        </div>
      )}

      <div className="border-t border-border px-2.5 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
        Ctrl+C/X/V · Ctrl+Shift+C copia RAW · V alterna carimbo · Esc sai do carimbo. Colagem de camada preserva os outros bits físicos do destino.
      </div>
    </section>
  );
}
