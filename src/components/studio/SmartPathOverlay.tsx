import { useEffect, useRef, useState } from "react";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

interface CellPoint {
  x: number;
  y: number;
}

type DragState =
  | { mode: "paint"; lastKey: string }
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
  | null;

export function SmartPathOverlay() {
  const editor = useEditor();
  const smart = useSmartPath();
  const [hover, setHover] = useState<CellPoint | null>(null);
  const dragRef = useRef<DragState>(null);
  const active = smart.enabled && editor.viewMode === "visual";
  const cellSize = TILE_PX * editor.zoom * 2;

  useEffect(() => {
    if (smart.enabled && editor.viewMode !== "visual") smartPathStore.setEnabled(false);
  }, [smart.enabled, editor.viewMode]);

  if (!active) return null;

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

  return (
    <div
      className="absolute inset-0 z-20 touch-none select-none overflow-hidden"
      style={{ cursor: smart.mode === "add" ? "crosshair" : "not-allowed" }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.button === 1 || event.button === 2 || event.altKey || event.shiftKey) {
          dragRef.current = {
            mode: "pan",
            sx: event.clientX,
            sy: event.clientY,
            ox: editor.pan.x,
            oy: editor.pan.y,
          };
          return;
        }
        if (event.button !== 0) return;
        const cell = cellFromEvent(event);
        if (!cell) return;
        const key = `${cell.x},${cell.y}`;
        dragRef.current = { mode: "paint", lastKey: key };
        setHover(cell);
        editorStore.selectCell(cell.y * editor.map.width + cell.x);
        // Sempre abre uma única transação de histórico no pointerdown. Assim,
        // mesmo se a primeira célula já estiver correta e só as próximas mudarem,
        // todo o gesto de arraste continua sendo um único Undo.
        editorStore.beginStroke();
        smartPathStore.applyAt(cell.x, cell.y, true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag?.mode === "pan") {
          editorStore.setPan({
            x: drag.ox + (event.clientX - drag.sx),
            y: drag.oy + (event.clientY - drag.sy),
          });
          return;
        }
        const cell = cellFromEvent(event);
        setHover(cell);
        editorStore.setHover(cell ? cell.y * editor.map.width + cell.x : null);
        if (!cell || drag?.mode !== "paint") return;
        const key = `${cell.x},${cell.y}`;
        if (key === drag.lastKey) return;
        dragRef.current = { mode: "paint", lastKey: key };
        smartPathStore.applyAt(cell.x, cell.y, true);
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onPointerLeave={() => {
        if (!dragRef.current) setHover(null);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hover && (
        <div
          className={cn(
            "pointer-events-none absolute border-2",
            smart.mode === "add"
              ? "border-success bg-success/15"
              : "border-destructive bg-destructive/15",
          )}
          style={{
            left: editor.pan.x + hover.x * cellSize,
            top: editor.pan.y + hover.y * cellSize,
            width: cellSize,
            height: cellSize,
          }}
        >
          <span className={cn(
            "absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold",
            smart.mode === "add"
              ? "bg-success text-background"
              : "bg-destructive text-destructive-foreground",
          )}>
            {smart.mode === "add" ? "+ caminho" : "− caminho"} · {hover.x},{hover.y}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-center text-[10px] text-foreground shadow-lg">
        <b className="text-primary">Smart Paths</b> · {smart.mode === "add" ? "adicionando" : "apagando"} · clique/arraste · E troca modo · P sai · Shift/Alt/botão direito move o canvas
      </div>
    </div>
  );
}
