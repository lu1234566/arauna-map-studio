import { useEffect, useRef, useState } from "react";
import { clipboardStore, useClipboard } from "@/lib/clipboardStore";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import type { RegionClipboard } from "@/lib/mapClipboard";
import { atlasSourceRect, realAtlasStore, useRealAtlas, type SavedRealAtlas } from "@/lib/realAtlasStore";

interface CellPoint {
  x: number;
  y: number;
}

function GhostCanvas({ clipboard, atlas }: { clipboard: RegionClipboard; atlas: SavedRealAtlas | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderable = clipboard.kind === "visual" || clipboard.kind === "raw";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !atlas || !renderable) return;
    const source = realAtlasStore.getCanvas(atlas);
    if (!source) return;
    canvas.width = clipboard.width * atlas.tileSize;
    canvas.height = clipboard.height * atlas.tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const raw = clipboard.values[y * clipboard.width + x] ?? 0;
        const id = clipboard.kind === "raw" ? raw & 0x03ff : raw;
        const record = realAtlasStore.recordFor(id, atlas);
        const dx = x * atlas.tileSize;
        const dy = y * atlas.tileSize;
        if (!record) {
          ctx.fillStyle = "rgba(120, 120, 120, 0.45)";
          ctx.fillRect(dx, dy, atlas.tileSize, atlas.tileSize);
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.moveTo(dx + 2, dy + 2);
          ctx.lineTo(dx + atlas.tileSize - 2, dy + atlas.tileSize - 2);
          ctx.moveTo(dx + atlas.tileSize - 2, dy + 2);
          ctx.lineTo(dx + 2, dy + atlas.tileSize - 2);
          ctx.stroke();
          continue;
        }
        const rect = atlasSourceRect(atlas, record);
        ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, dx, dy, atlas.tileSize, atlas.tileSize);
      }
    }
  }, [atlas, clipboard, renderable]);

  if (!atlas || !renderable) return null;
  return (
    <canvas
      ref={ref}
      className="pixelated pointer-events-none absolute inset-0 size-full opacity-75"
      aria-hidden
    />
  );
}

export function StampOverlay() {
  const editor = useEditor();
  const atlas = useRealAtlas();
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

  const blockedCells = hover
    ? Array.from({ length: clipboard.width * clipboard.height }, (_, index) => {
        const x = index % clipboard.width;
        const y = Math.floor(index / clipboard.width);
        const tx = hover.x + x;
        const ty = hover.y + y;
        const out = tx < 0 || ty < 0 || tx >= editor.map.width || ty >= editor.map.height;
        const protectedCell = !out && editorStore.isProtected(tx, ty);
        return protectedCell ? { x, y } : null;
      }).filter((cell): cell is CellPoint => Boolean(cell))
    : [];

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
          className="pointer-events-none absolute overflow-visible border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
          style={{
            left: editor.pan.x + hover.x * cellSize,
            top: editor.pan.y + hover.y * cellSize,
            width: clipboard.width * cellSize,
            height: clipboard.height * cellSize,
          }}
        >
          <GhostCanvas clipboard={clipboard} atlas={atlas} />
          <div className="absolute -top-5 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary-foreground">
            {clipboard.width}×{clipboard.height} · ({hover.x},{hover.y})
            {blockedCells.length ? ` · ${blockedCells.length} protegida(s)` : ""}
          </div>
          {showInternalGrid && (
            <>
              {Array.from({ length: clipboard.width + 1 }, (_, index) => (
                <span
                  key={`v-${index}`}
                  className="absolute bottom-0 top-0 z-10 border-l border-primary/25"
                  style={{ left: index * cellSize }}
                />
              ))}
              {Array.from({ length: clipboard.height + 1 }, (_, index) => (
                <span
                  key={`h-${index}`}
                  className="absolute left-0 right-0 z-10 border-t border-primary/25"
                  style={{ top: index * cellSize }}
                />
              ))}
            </>
          )}
          {blockedCells.map((cell) => (
            <span
              key={`protected-${cell.x}-${cell.y}`}
              className="absolute z-20 border border-warning bg-warning/35"
              style={{
                left: cell.x * cellSize,
                top: cell.y * cellSize,
                width: cellSize,
                height: cellSize,
              }}
              title="Célula protegida: não será alterada"
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-center text-[10px] text-foreground shadow-lg">
        <b className="text-primary">Carimbo multi-metatile ativo</b> · preview real · clique/arraste para
        pintar · Esc para sair
      </div>
    </div>
  );
}
