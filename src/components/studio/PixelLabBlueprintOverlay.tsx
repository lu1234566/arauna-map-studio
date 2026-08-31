import { useEffect, useRef, useState } from "react";
import { TILE_PX } from "@/lib/demoAtlas";
import { editorStore, useEditor } from "@/lib/editorStore";
import {
  PIXELLAB_BLUEPRINT_ZONES,
  pixelLabBlueprintStore,
  usePixelLabBlueprint,
} from "@/lib/pixellabBlueprintStore";

const ZONE_COLOR = new Map(PIXELLAB_BLUEPRINT_ZONES.map((zone) => [zone.id, zone.color] as const));

type DragState =
  | { mode: "paint"; lastX: number; lastY: number }
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number };

export function PixelLabBlueprintOverlay() {
  const editor = useEditor();
  const blueprint = usePixelLabBlueprint();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    pixelLabBlueprintStore.ensureDimensions(editor.map.width, editor.map.height);
  }, [editor.map.width, editor.map.height]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setResizeTick((value) => value + 1));
    observer.observe(container);
    return () => observer.disconnect();
  }, [blueprint.enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!blueprint.enabled) return;

    const cs = TILE_PX * editor.zoom * 2;
    ctx.save();
    ctx.translate(editor.pan.x, editor.pan.y);
    for (let y = 0; y < blueprint.height; y++) {
      for (let x = 0; x < blueprint.width; x++) {
        const zone = blueprint.cells[y * blueprint.width + x] ?? "none";
        if (zone === "none") continue;
        ctx.globalAlpha = zone === "entrance" ? 0.78 : 0.58;
        ctx.fillStyle = ZONE_COLOR.get(zone) ?? "#ffffff";
        ctx.fillRect(x * cs, y * cs, cs, cs);
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cs + 0.5, y * cs + 0.5, cs - 1, cs - 1);
        if (zone === "entrance" && cs >= 18) {
          ctx.fillStyle = "#171b19";
          ctx.font = `bold ${Math.max(9, Math.min(14, cs * 0.36))}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("E", x * cs + cs / 2, y * cs + cs / 2);
        }
      }
    }
    ctx.restore();
  }, [blueprint, editor.zoom, editor.pan.x, editor.pan.y, editor.map.width, editor.map.height, resizeTick]);

  if (!blueprint.enabled) return null;

  const cellFromEvent = (event: { clientX: number; clientY: number }) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const cs = TILE_PX * editor.zoom * 2;
    const x = Math.floor((event.clientX - rect.left - editor.pan.x) / cs);
    const y = Math.floor((event.clientY - rect.top - editor.pan.y) / cs);
    if (x < 0 || y < 0 || x >= editor.map.width || y >= editor.map.height) return null;
    return { x, y };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (event.button === 1 || event.button === 2 || event.shiftKey || event.altKey) {
      dragRef.current = { mode: "pan", sx: event.clientX, sy: event.clientY, ox: editor.pan.x, oy: editor.pan.y };
      return;
    }
    const cell = cellFromEvent(event);
    if (!cell) return;
    pixelLabBlueprintStore.paintCell(cell.x, cell.y);
    dragRef.current = { mode: "paint", lastX: cell.x, lastY: cell.y };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "pan") {
      editorStore.setPan({ x: drag.ox + event.clientX - drag.sx, y: drag.oy + event.clientY - drag.sy });
      return;
    }
    const cell = cellFromEvent(event);
    if (!cell || (cell.x === drag.lastX && cell.y === drag.lastY)) return;
    pixelLabBlueprintStore.paintCell(cell.x, cell.y);
    dragRef.current = { mode: "paint", lastX: cell.x, lastY: cell.y };
  };

  const stop = () => { dragRef.current = null; };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 touch-none select-none"
      style={{ cursor: dragRef.current?.mode === "pan" ? "grabbing" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="pointer-events-none block" />
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-primary/40 bg-panel/95 px-2 py-1 text-[9px] font-semibold text-primary shadow-lg">
        Blueprint IA · {PIXELLAB_BLUEPRINT_ZONES.find((zone) => zone.id === blueprint.activeZone)?.label} · pincel {blueprint.brushSize}
      </div>
    </div>
  );
}
