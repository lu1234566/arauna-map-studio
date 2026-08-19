import { useRef, useState } from "react";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import { mapTemplateStore, useMapTemplates } from "@/lib/mapTemplateStore";
import { cn } from "@/lib/utils";

interface CellPoint {
  x: number;
  y: number;
}

type DragState =
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
  | null;

export function MapTemplateOverlay() {
  const editor = useEditor();
  const templates = useMapTemplates();
  const active = templates.templates.find((template) => template.id === templates.activeTemplateId) ?? null;
  const [hover, setHover] = useState<CellPoint | null>(null);
  const dragRef = useRef<DragState>(null);
  const cellSize = TILE_PX * editor.zoom * 2;

  if (!templates.enabled || !active) return null;

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

  const overflows = hover
    ? hover.x + active.width > editor.map.width || hover.y + active.height > editor.map.height
    : false;

  return (
    <div
      className="absolute inset-0 z-20 touch-none select-none overflow-hidden"
      style={{ cursor: "copy" }}
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
        setHover(cell);
        mapTemplateStore.applyAt(cell.x, cell.y);
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
            "pointer-events-none absolute border-2 bg-primary/10",
            overflows ? "border-warning" : "border-primary",
          )}
          style={{
            left: editor.pan.x + hover.x * cellSize,
            top: editor.pan.y + hover.y * cellSize,
            width: active.width * cellSize,
            height: active.height * cellSize,
          }}
        >
          <span className={cn(
            "absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold",
            overflows ? "bg-warning text-background" : "bg-primary text-primary-foreground",
          )}>
            {active.name} · {active.width}×{active.height} · origem {hover.x},{hover.y}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-center text-[10px] text-foreground shadow-lg">
        <b className="text-primary">Templates</b> · clique para aplicar · T/Esc sai · Shift/Alt/botão direito move o canvas
      </div>
    </div>
  );
}
