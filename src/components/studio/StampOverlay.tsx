import { useEffect, useRef, useState } from "react";
import { clipboardStore, useClipboard } from "@/lib/clipboardStore";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";

interface CellPoint {
  x: number;
  y: number;
}

export function StampOverlay() {
  const editor = useEditor();
  const clipboardState = useClipboard();
  const clipboard = clipboardState.clipboard;
  const [hover, setHover] = useState<CellPoint | null>(null);
  const dragging = useRef(false);
  const lastStamp = useRef<string | null>(null);
  const editableView =
    editor.viewMode === "visual" ||
    editor.viewMode === "collision" ||
    editor.viewMode === "elevation";
  const active = Boolean(clipboardState.stampMode && clipboard && editableView);
  const cellSize = TILE_PX * editor.zoom * 2;

  useEffect(() => {
    if (clipboardState.stampMode && !editableView) clipboardStore.toggleStampMode(false);
  }, [clipboardState.stampMode, editableView]);

  if (!active || !clipboard) return null;

  const showInternalGrid =
    clipboard.width <= 32 && clipboard.height <= 32 && cellSize >= 4;

  const cellFromEvent = (event: {
    currentTarget: EventTarget & HTMLDivElement;
    clientX: number;
    clientY: number;
  }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - editor.pan.x) / cellSize);
    const y = Math.floor((event.clientY - rect.top - editor.pan.y) / cellSize);
    if (x < 0 || y < 0 || x >= editor.map.width || y >= editor.map.height) return null;
    return { x, y };
  };

  const stamp = (cell: CellPoint) => {
    const key = `${cell.x},${cell.y}`;
    if (lastStamp.current === key) return;
    lastStamp.current = key;
    clipboardStore.stampAt(cell.x, cell.y, false);
  };

  return (
    <div
      className="absolute inset-0 z-20 touch-none select-none overflow-hidden"
      style={{ cursor: "copy" }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const cell = cellFromEvent(event);
        if (!cell) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        editorStore.beginStroke();
        dragging.current = true;
        lastStamp.current = null;
        setHover(cell);
        stamp(cell);
      }}
      onPointerMove={(event) => {
        const cell = cellFromEvent(event);
        setHover(cell);
        if (dragging.current && cell) stamp(cell);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        lastStamp.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
        lastStamp.current = null;
      }}
      onPointerLeave={() => {
        if (!dragging.current) setHover(null);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hover && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
          style={{
            left: editor.pan.x + hover.x * cellSize,
            top: editor.pan.y + hover.y * cellSize,
            width: clipboard.width * cellSize,
            height: clipboard.height * cellSize,
          }}
        >
          <div className="absolute -top-5 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary-foreground">
            {clipboard.width}×{clipboard.height} · ({hover.x},{hover.y})
          </div>
          {showInternalGrid && (
            <>
              {Array.from({ length: clipboard.width + 1 }, (_, index) => (
                <span
                  key={`v-${index}`}
                  className="absolute bottom-0 top-0 border-l border-primary/25"
                  style={{ left: index * cellSize }}
                />
              ))}
              {Array.from({ length: clipboard.height + 1 }, (_, index) => (
                <span
                  key={`h-${index}`}
                  className="absolute left-0 right-0 border-t border-primary/25"
                  style={{ top: index * cellSize }}
                />
              ))}
            </>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-center text-[10px] text-foreground shadow-lg">
        <b className="text-primary">Carimbo multi-metatile ativo</b> · clique/arraste para
        pintar · Esc para sair
      </div>
    </div>
  );
}
