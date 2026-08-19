import { Map as MapIcon, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import {
  atlasSourceRect,
  realAtlasStore,
  useRealAtlas,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";

const MAX_W = 168;
const MAX_H = 126;

function minimapScale(width: number, height: number) {
  if (!width || !height) return 1;
  return Math.max(1, Math.min(6, Math.floor(Math.min(MAX_W / width, MAX_H / height))));
}

function drawMapBase(
  canvas: HTMLCanvasElement,
  atlas: SavedRealAtlas | null,
  metatiles: Uint16Array,
  width: number,
  height: number,
  scale: number,
) {
  canvas.width = Math.max(1, width * scale);
  canvas.height = Math.max(1, height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#202720";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!atlas) return;
  const source = realAtlasStore.getCanvas(atlas);
  if (!source) return;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = metatiles[y * width + x] ?? 0;
      const record = realAtlasStore.recordFor(id, atlas);
      const dx = x * scale;
      const dy = y * scale;
      if (!record) {
        ctx.fillStyle = "#4a514b";
        ctx.fillRect(dx, dy, scale, scale);
        continue;
      }
      const rect = atlasSourceRect(atlas, record);
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, dx, dy, scale, scale);
    }
  }
}

export function MapMinimap() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const [open, setOpen] = useState(true);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const scale = useMemo(
    () => minimapScale(state.map.width, state.map.height),
    [state.map.width, state.map.height],
  );
  const miniWidth = state.map.width * scale;
  const miniHeight = state.map.height * scale;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    drawMapBase(canvas, atlas, state.map.metatiles, state.map.width, state.map.height, scale);
    baseRef.current = canvas;
  }, [atlas, state.map.metatiles, state.map.width, state.map.height, scale]);

  useEffect(() => {
    const host = canvasRef.current?.parentElement?.parentElement?.parentElement;
    if (!(host instanceof HTMLElement)) return;
    hostRef.current = host;
    const update = () => {
      const rect = host.getBoundingClientRect();
      setViewport({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base || !open) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);

    const editorCell = TILE_PX * state.zoom * 2;
    const leftCells = Math.max(0, -state.pan.x / editorCell);
    const topCells = Math.max(0, -state.pan.y / editorCell);
    const rightCells = Math.min(state.map.width, (viewport.width - state.pan.x) / editorCell);
    const bottomCells = Math.min(state.map.height, (viewport.height - state.pan.y) / editorCell);
    const visibleW = Math.max(0, rightCells - leftCells);
    const visibleH = Math.max(0, bottomCells - topCells);

    if (visibleW > 0 && visibleH > 0) {
      ctx.fillStyle = "rgba(110, 228, 154, 0.08)";
      ctx.fillRect(leftCells * scale, topCells * scale, visibleW * scale, visibleH * scale);
      ctx.strokeStyle = "rgba(110, 228, 154, 0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(leftCells * scale) + 0.5,
        Math.round(topCells * scale) + 0.5,
        Math.max(1, Math.round(visibleW * scale) - 1),
        Math.max(1, Math.round(visibleH * scale) - 1),
      );
    }

    if (state.selectedCell != null) {
      const sx = state.selectedCell % state.map.width;
      const sy = Math.floor(state.selectedCell / state.map.width);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx * scale + 0.5, sy * scale + 0.5, Math.max(1, scale - 1), Math.max(1, scale - 1));
    }
  }, [open, scale, state.map.width, state.map.height, state.pan, state.selectedCell, state.zoom, viewport]);

  const navigate = (event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cellX = ((event.clientX - rect.left) / rect.width) * state.map.width;
    const cellY = ((event.clientY - rect.top) / rect.height) * state.map.height;
    const editorCell = TILE_PX * state.zoom * 2;
    editorStore.setPan({
      x: viewport.width / 2 - cellX * editorCell,
      y: viewport.height / 2 - cellY * editorCell,
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-9 left-2 z-20 grid size-8 place-items-center rounded border border-border bg-panel/90 text-muted-foreground shadow-lg backdrop-blur-sm hover:bg-surface hover:text-foreground"
        title="Abrir minimapa"
      >
        <MapIcon className="size-3.5" />
      </button>
    );
  }

  return (
    <section className="absolute bottom-9 left-2 z-20 overflow-hidden rounded border border-border bg-panel/90 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <div className="flex items-center gap-1.5">
          <MapIcon className="size-3 text-primary" />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-foreground">Minimapa</span>
          <span className="font-mono text-[8px] text-muted-foreground">{state.map.width}×{state.map.height}</span>
        </div>
        <div className="ml-3 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editorStore.setZoom(state.zoom - 0.5)}
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
            title="Diminuir zoom do editor"
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => editorStore.setZoom(state.zoom + 0.5)}
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
            title="Aumentar zoom do editor"
          >
            <Plus className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
            title="Recolher minimapa"
          >
            ×
          </button>
        </div>
      </div>
      <div className="bg-black/30 p-1.5">
        <canvas
          ref={canvasRef}
          className="pixelated block cursor-crosshair border border-border/60 bg-canvas"
          style={{ width: miniWidth, height: miniHeight, maxWidth: MAX_W, maxHeight: MAX_H }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            navigate(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) navigate(event);
          }}
          onPointerUp={(event) => {
            dragging.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { dragging.current = false; }}
          title="Clique ou arraste para centralizar a câmera"
        />
      </div>
    </section>
  );
}
