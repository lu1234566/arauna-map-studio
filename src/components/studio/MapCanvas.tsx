import { useCallback, useEffect, useRef } from "react";
import { editorStore, useEditor } from "@/lib/editorStore";
import { METATILE_BY_ID, TILE_PX, getAtlasCanvas, getAtlasSlot } from "@/lib/demoAtlas";
import { getCollision, getElevation, idx } from "@/lib/emeraldMap";

const BASE = TILE_PX; // px por metatile a 100%

export function MapCanvas() {
  const state = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dragRef = useRef<{ mode: "paint" | "pan" | "select"; sx: number; sy: number; ox: number; oy: number } | null>(
    null,
  );

  const cellSize = BASE * state.zoom * 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const s = stateRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0d130f";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const cs = BASE * s.zoom * 2;
    const { width, height, metatiles, physical } = s.map;
    const ox = s.pan.x;
    const oy = s.pan.y;

    ctx.save();
    ctx.translate(ox, oy);

    // fundo do mapa
    ctx.fillStyle = "#141a16";
    ctx.fillRect(0, 0, width * cs, height * cs);

    const atlas = getAtlasCanvas();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y, width);
        const id = metatiles[i] ?? 0;
        const slot = getAtlasSlot(id);
        if (slot === undefined) {
          ctx.fillStyle = "#2a2f2b";
          ctx.fillRect(x * cs, y * cs, cs, cs);
          ctx.fillStyle = "#6b7a6e";
          ctx.fillRect(x * cs + cs / 2 - 1, y * cs + cs / 2 - 1, 2, 2);
        } else {
          ctx.drawImage(atlas, slot * TILE_PX, 0, TILE_PX, TILE_PX, x * cs, y * cs, cs, cs);
        }
      }
    }

    // overlays por modo
    if (s.viewMode === "collision" || s.viewMode === "elevation") {
      ctx.font = `${Math.max(8, Math.min(14, cs * 0.35))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = idx(x, y, width);
          const phys = physical[i] ?? 0;
          const value =
            s.viewMode === "collision" ? getCollision(phys) : getElevation(phys);
          ctx.fillStyle =
            s.viewMode === "collision"
              ? value === 0
                ? "rgba(60,180,110,0.28)"
                : "rgba(220,70,60,0.42)"
              : `rgba(90,140,220,${0.12 + Math.min(value, 15) * 0.035})`;
          ctx.fillRect(x * cs, y * cs, cs, cs);
          if (cs >= 22) {
            ctx.fillStyle = "rgba(255,255,255,0.82)";
            ctx.fillText(String(value), x * cs + cs / 2, y * cs + cs / 2);
          }
        }
      }
    }

    if (s.viewMode === "warps" || s.viewMode === "npcs" || s.viewMode === "triggers") {
      const kind = s.viewMode === "warps" ? "warp" : s.viewMode === "npcs" ? "npc" : "trigger";
      ctx.fillStyle = "rgba(10,14,11,0.55)";
      ctx.fillRect(0, 0, width * cs, height * cs);
      ctx.font = `bold ${Math.max(8, Math.min(13, cs * 0.34))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const ev of s.events.filter((e) => e.kind === kind)) {
        const color =
          kind === "warp" ? "#4f9ad8" : kind === "npc" ? "#e0b155" : "#c471d8";
        ctx.fillStyle = color + "55";
        ctx.fillRect(ev.x * cs, ev.y * cs, cs, cs);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ev.x * cs + 0.75, ev.y * cs + 0.75, cs - 1.5, cs - 1.5);
        if (cs >= 20) {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(ev.label, ev.x * cs + cs / 2, ev.y * cs + cs / 2);
        }
      }
    }

    // grid
    if (s.showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        ctx.moveTo(Math.round(x * cs) + 0.5, 0);
        ctx.lineTo(Math.round(x * cs) + 0.5, height * cs);
      }
      for (let y = 0; y <= height; y++) {
        ctx.moveTo(0, Math.round(y * cs) + 0.5);
        ctx.lineTo(width * cs, Math.round(y * cs) + 0.5);
      }
      ctx.stroke();
    }

    // cadeados de proteção
    for (const cell of s.protectedCells) {
      const active = s.protectProgression;
      ctx.fillStyle = active ? "rgba(224,177,85,0.22)" : "rgba(150,150,150,0.12)";
      ctx.fillRect(cell.x * cs, cell.y * cs, cs, cs);
      ctx.strokeStyle = active ? "#e0b155" : "rgba(180,180,180,0.5)";
      ctx.setLineDash([3, 2]);
      ctx.lineWidth = 1;
      ctx.strokeRect(cell.x * cs + 0.5, cell.y * cs + 0.5, cs - 1, cs - 1);
      ctx.setLineDash([]);
      const s2 = Math.max(6, cs * 0.34);
      const cx = cell.x * cs + cs / 2;
      const cy = cell.y * cs + cs / 2;
      ctx.fillStyle = active ? "#e0b155" : "rgba(200,200,200,0.6)";
      ctx.fillRect(cx - s2 / 2, cy - s2 * 0.1, s2, s2 * 0.6);
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = Math.max(1, s2 * 0.16);
      ctx.beginPath();
      ctx.arc(cx, cy - s2 * 0.1, s2 * 0.28, Math.PI, 0);
      ctx.stroke();
    }

    // seleção
    if (s.selection) {
      const { x, y, w, h } = s.selection;
      ctx.fillStyle = "rgba(110,220,150,0.14)";
      ctx.fillRect(x * cs, y * cs, w * cs, h * cs);
      ctx.strokeStyle = "#6ee49a";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cs + 0.5, y * cs + 0.5, w * cs - 1, h * cs - 1);
      ctx.setLineDash([]);
    }

    // hover
    if (s.hoverCell != null) {
      const hx = s.hoverCell % width;
      const hy = (s.hoverCell / width) | 0;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx * cs + 0.75, hy * cs + 0.75, cs - 1.5, cs - 1.5);
    }

    // célula selecionada
    if (s.selectedCell != null) {
      const sx = s.selectedCell % width;
      const sy = (s.selectedCell / width) | 0;
      ctx.strokeStyle = "#6ee49a";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx * cs + 1, sy * cs + 1, cs - 2, cs - 2);
    }

    ctx.restore();

    // réguas de coordenadas
    if (s.showCoords) {
      ctx.font = "10px ui-monospace, monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(20,26,22,0.9)";
      ctx.fillRect(0, 0, rect.width, 14);
      ctx.fillRect(0, 0, 18, rect.height);
      ctx.fillStyle = "rgba(180,200,185,0.75)";
      for (let x = 0; x < width; x++) {
        const px = ox + x * cs + cs / 2;
        if (px > 18 && px < rect.width) ctx.fillText(String(x), px, 7);
      }
      for (let y = 0; y < height; y++) {
        const py = oy + y * cs + cs / 2;
        if (py > 14 && py < rect.height) ctx.fillText(String(y), 9, py);
      }
    }
  }, []);

  useEffect(() => {
    draw();
  }, [draw, state]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // centraliza no primeiro render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const s = stateRef.current;
    const cs = BASE * s.zoom * 2;
    editorStore.setPan({
      x: Math.max(24, (rect.width - s.map.width * cs) / 2),
      y: Math.max(20, (rect.height - s.map.height * cs) / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cellFromEvent = (e: { clientX: number; clientY: number }) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const s = stateRef.current;
    const cs = BASE * s.zoom * 2;
    const x = Math.floor((e.clientX - rect.left - s.pan.x) / cs);
    const y = Math.floor((e.clientY - rect.top - s.pan.y) / cs);
    if (x < 0 || y < 0 || x >= s.map.width || y >= s.map.height) return null;
    return { x, y };
  };

  const applyTool = (x: number, y: number, continuous: boolean) => {
    const s = stateRef.current;
    if (s.tool === "pencil") editorStore.paint(x, y, continuous);
    else if (s.tool === "picker") editorStore.pick(x, y);
    else if (s.tool === "fill" && !continuous) editorStore.fill(x, y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const s = stateRef.current;
    if (e.button === 1 || e.button === 2 || e.altKey || e.shiftKey) {
      dragRef.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: s.pan.x, oy: s.pan.y };
      return;
    }
    const cell = cellFromEvent(e);
    if (!cell) return;
    editorStore.selectCell(idx(cell.x, cell.y, s.map.width));
    if (s.tool === "select") {
      dragRef.current = { mode: "select", sx: cell.x, sy: cell.y, ox: 0, oy: 0 };
      editorStore.setSelection({ x: cell.x, y: cell.y, w: 1, h: 1 });
      return;
    }
    if (s.tool === "pencil") {
      editorStore.beginStroke();
      dragRef.current = { mode: "paint", sx: 0, sy: 0, ox: 0, oy: 0 };
      editorStore.paint(cell.x, cell.y, true);
      return;
    }
    applyTool(cell.x, cell.y, false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const s = stateRef.current;
    if (drag?.mode === "pan") {
      editorStore.setPan({ x: drag.ox + (e.clientX - drag.sx), y: drag.oy + (e.clientY - drag.sy) });
      return;
    }
    const cell = cellFromEvent(e);
    editorStore.setHover(cell ? idx(cell.x, cell.y, s.map.width) : null);
    if (!cell || !drag) return;
    if (drag.mode === "select") {
      editorStore.setSelection({
        x: Math.min(drag.sx, cell.x),
        y: Math.min(drag.sy, cell.y),
        w: Math.abs(cell.x - drag.sx) + 1,
        h: Math.abs(cell.y - drag.sy) + 1,
      });
    } else if (drag.mode === "paint") {
      editorStore.paint(cell.x, cell.y, true);
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  // wheel nativo não-passivo: zoom ancorado no cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = Math.min(8, Math.max(0.5, s.zoom * Math.exp(-dy * 0.0015)));
      if (next === s.zoom) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / s.zoom;
      editorStore.setPan({ x: px - (px - s.pan.x) * k, y: py - (py - s.pan.y) * k });
      editorStore.setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const hoverTile =
    state.hoverCell != null ? METATILE_BY_ID.get(state.map.metatiles[state.hoverCell] ?? 0) : undefined;

  return (
    <div className="relative min-w-0 flex-1 bg-canvas">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        style={{ cursor: state.tool === "picker" ? "crosshair" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => {
          endDrag();
          editorStore.setHover(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="pixelated block" />
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded border border-border bg-panel/90 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        {state.hoverCell != null
          ? `(${state.hoverCell % state.map.width}, ${Math.floor(state.hoverCell / state.map.width)}) · ${hoverTile?.name ?? "id " + state.map.metatiles[state.hoverCell]}`
          : "mover o cursor sobre o mapa"}
        {"  ·  "}
        {cellSize.toFixed(0)}px/tile · arraste com Shift/botão direito para pan
      </div>

      {state.viewMode !== "visual" && (
        <div className="pointer-events-none absolute right-2 top-4 rounded border border-warning/40 bg-warning/15 px-2 py-1 text-[10px] font-medium text-warning">
          Camada somente leitura no MVP — dados de exemplo
        </div>
      )}
    </div>
  );
}
