import { useEffect, useRef, useState } from "react";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";

interface CellPoint { x: number; y: number }
type DragState =
  | { mode: "stamp"; lastKey: string }
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
  | null;

export function PatternOverlay() {
  const editor = useEditor();
  const library = usePatternLibrary();
  const pattern = library.patterns.find((item) => item.id === library.activePatternId) ?? null;
  const [hover, setHover] = useState<CellPoint | null>(null);
  const dragRef = useRef<DragState>(null);
  const active = Boolean(library.enabled && pattern);
  const cellSize = TILE_PX * editor.zoom * 2;

  useEffect(() => {
    if (!library.enabled || !pattern) return;
    const expectedMode = pattern.kind === "visual" || pattern.kind === "raw" ? "visual" : pattern.kind;
    if (editor.viewMode !== expectedMode) patternLibraryStore.setEnabled(false);
  }, [library.enabled, pattern?.id, pattern?.kind, editor.viewMode]);

  if (!active || !pattern) return null;

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
        editorStore.beginStroke();
        const key = `${cell.x},${cell.y}`;
        dragRef.current = { mode: "stamp", lastKey: key };
        setHover(cell);
        patternLibraryStore.applyAt(cell.x, cell.y, true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag?.mode === "pan") {
          editorStore.setPan({
            x: drag.ox + event.clientX - drag.sx,
            y: drag.oy + event.clientY - drag.sy,
          });
          return;
        }
        const cell = cellFromEvent(event);
        setHover(cell);
        editorStore.setHover(cell ? cell.y * editor.map.width + cell.x : null);
        if (!cell || drag?.mode !== "stamp") return;
        const key = `${cell.x},${cell.y}`;
        if (key === drag.lastKey) return;
        dragRef.current = { mode: "stamp", lastKey: key };
        patternLibraryStore.applyAt(cell.x, cell.y, true);
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onPointerLeave={() => { if (!dragRef.current) setHover(null); }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hover && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
          style={{
            left: editor.pan.x + hover.x * cellSize,
            top: editor.pan.y + hover.y * cellSize,
            width: pattern.width * cellSize,
            height: pattern.height * cellSize,
          }}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary-foreground">
            {pattern.name} · {pattern.width}×{pattern.height} · ({hover.x},{hover.y})
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-[10px] text-foreground shadow-lg">
        <b className="text-primary">Padrão: {pattern.name}</b> · clique/arraste para carimbar · L/Esc sai · Shift/Alt/botão direito move
      </div>
    </div>
  );
}
