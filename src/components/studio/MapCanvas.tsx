import { useCallback, useEffect, useRef } from "react";
import { editorStore, useEditor, type DemoEvent, type ViewMode } from "@/lib/editorStore";
import { METATILE_BY_ID, TILE_PX, getAtlasCanvas, getAtlasSlot } from "@/lib/demoAtlas";
import { getCollision, getElevation, idx } from "@/lib/emeraldMap";
import { realAtlasStore, useRealAtlas } from "@/lib/realAtlasStore";

const BASE = TILE_PX;

type DragState =
  | { mode: "paint"; sx: number; sy: number; ox: number; oy: number }
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { mode: "select"; sx: number; sy: number; ox: number; oy: number }
  | {
      mode: "event";
      eventId: string;
      lastX: number;
      lastY: number;
      historyStarted: boolean;
    };

function isEventView(viewMode: ViewMode) {
  return viewMode === "warps" || viewMode === "npcs" || viewMode === "triggers";
}

function eventMatchesView(event: DemoEvent, viewMode: ViewMode) {
  if (viewMode === "warps") return event.source === "warp";
  if (viewMode === "npcs") return event.source === "object";
  if (viewMode === "triggers") return event.source === "coord" || event.source === "bg";
  return false;
}

function eventColor(event: DemoEvent) {
  if (event.source === "warp") return "#4f9ad8";
  if (event.source === "object") return "#e0b155";
  if (event.source === "coord") return "#c471d8";
  return "#67c9c0";
}

function visualEditingBlocked(viewMode: ViewMode) {
  return viewMode === "visual" && realAtlasStore.ensureHydrated()?.compatibility === "reference";
}

export function MapCanvas() {
  const state = useEditor();
  const activeAtlas = useRealAtlas();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const dragRef = useRef<DragState | null>(null);
  stateRef.current = state;

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

    ctx.fillStyle = "#141a16";
    ctx.fillRect(0, 0, width * cs, height * cs);

    const atlas = getAtlasCanvas();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y, width);
        const id = metatiles[i] ?? 0;
        const slot = getAtlasSlot(id);
        if (slot == null) {
          ctx.fillStyle = "#2a2f2b";
          ctx.fillRect(x * cs, y * cs, cs, cs);
          ctx.fillStyle = "#6b7a6e";
          ctx.fillRect(x * cs + cs / 2 - 1, y * cs + cs / 2 - 1, 2, 2);
        } else {
          ctx.drawImage(atlas, slot * TILE_PX, 0, TILE_PX, TILE_PX, x * cs, y * cs, cs, cs);
        }
      }
    }

    if (s.viewMode === "collision" || s.viewMode === "elevation") {
      ctx.font = `${Math.max(8, Math.min(14, cs * 0.35))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = idx(x, y, width);
          const phys = physical[i] ?? 0;
          const value = s.viewMode === "collision" ? getCollision(phys) : getElevation(phys);
          if (s.viewMode === "collision") {
            ctx.fillStyle = value === 0 ? "rgba(60,180,110,0.28)" : "rgba(220,70,60,0.42)";
          } else {
            ctx.fillStyle = `rgba(90,140,220,${0.12 + Math.min(value, 15) * 0.035})`;
          }
          ctx.fillRect(x * cs, y * cs, cs, cs);
          if (cs >= 22) {
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillText(String(value), x * cs + cs / 2, y * cs + cs / 2);
          }
        }
      }
    }

    if (isEventView(s.viewMode)) {
      ctx.fillStyle = "rgba(10,14,11,0.48)";
      ctx.fillRect(0, 0, width * cs, height * cs);
      ctx.font = `bold ${Math.max(8, Math.min(13, cs * 0.34))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const event of s.events.filter((entry) => eventMatchesView(entry, s.viewMode))) {
        const color = eventColor(event);
        const selected = event.id === s.selectedEventId;
        ctx.fillStyle = `${color}${selected ? "88" : "55"}`;
        ctx.fillRect(event.x * cs, event.y * cs, cs, cs);
        ctx.strokeStyle = selected ? "#ffffff" : color;
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.strokeRect(
          event.x * cs + (selected ? 1.25 : 0.75),
          event.y * cs + (selected ? 1.25 : 0.75),
          cs - (selected ? 2.5 : 1.5),
          cs - (selected ? 2.5 : 1.5),
        );
        if (selected) {
          ctx.strokeStyle = color;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(event.x * cs - 2, event.y * cs - 2, cs + 4, cs + 4);
          ctx.setLineDash([]);
        }
        if (cs >= 20) {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(event.label, event.x * cs + cs / 2, event.y * cs + cs / 2);
        }
      }
    }

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

    if (!isEventView(s.viewMode)) {
      for (const cell of s.protectedCells) {
        const active = s.protectProgression;
        ctx.fillStyle = active ? "rgba(224,177,85,0.22)" : "rgba(150,150,150,0.10)";
        ctx.fillRect(cell.x * cs, cell.y * cs, cs, cs);
        ctx.strokeStyle = active ? "#e0b155" : "rgba(180,180,180,0.45)";
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(cell.x * cs + 0.5, cell.y * cs + 0.5, cs - 1, cs - 1);
        ctx.setLineDash([]);
      }
    }

    if (s.selection && !isEventView(s.viewMode)) {
      const { x, y, w, h } = s.selection;
      ctx.fillStyle = "rgba(110,220,150,0.14)";
      ctx.fillRect(x * cs, y * cs, w * cs, h * cs);
      ctx.strokeStyle = "#6ee49a";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x * cs + 0.5, y * cs + 0.5, w * cs - 1, h * cs - 1);
      ctx.setLineDash([]);
    }

    if (s.hoverCell != null) {
      const hx = s.hoverCell % width;
      const hy = (s.hoverCell / width) | 0;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx * cs + 0.75, hy * cs + 0.75, cs - 1.5, cs - 1.5);
    }

    if (s.selectedCell != null && !isEventView(s.viewMode)) {
      const sx = s.selectedCell % width;
      const sy = (s.selectedCell / width) | 0;
      ctx.strokeStyle = "#6ee49a";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx * cs + 1, sy * cs + 1, cs - 2, cs - 2);
    }

    ctx.restore();

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

  useEffect(() => draw(), [draw, state, activeAtlas]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

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
  }, []);

  const cellFromEvent = (event: { clientX: number; clientY: number }) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const s = stateRef.current;
    const cs = BASE * s.zoom * 2;
    const x = Math.floor((event.clientX - rect.left - s.pan.x) / cs);
    const y = Math.floor((event.clientY - rect.top - s.pan.y) / cs);
    if (x < 0 || y < 0 || x >= s.map.width || y >= s.map.height) return null;
    return { x, y };
  };

  const blockReferencePaint = () => {
    const s = stateRef.current;
    if (!visualEditingBlocked(s.viewMode)) return false;
    editorStore.setMessage("Este tileset é referência de Ruby/Sapphire ou FRLG. Volte para um pack Emerald para pintar o map.bin de Arauna.");
    return true;
  };

  const applyTool = (x: number, y: number, continuous: boolean) => {
    const s = stateRef.current;
    if ((s.tool === "pencil" || s.tool === "fill") && blockReferencePaint()) return;
    if (s.tool === "pencil") editorStore.paint(x, y, continuous);
    else if (s.tool === "picker") editorStore.pick(x, y);
    else if (s.tool === "fill" && !continuous) editorStore.fill(x, y);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const s = stateRef.current;
    if (event.button === 1 || event.button === 2 || event.altKey || event.shiftKey) {
      dragRef.current = {
        mode: "pan",
        sx: event.clientX,
        sy: event.clientY,
        ox: s.pan.x,
        oy: s.pan.y,
      };
      return;
    }

    const cell = cellFromEvent(event);
    if (!cell) return;
    editorStore.selectCell(idx(cell.x, cell.y, s.map.width));

    if (isEventView(s.viewMode)) {
      const matches = s.events.filter(
        (entry) => eventMatchesView(entry, s.viewMode) && entry.x === cell.x && entry.y === cell.y,
      );
      if (!matches.length) {
        editorStore.selectEvent(null);
        return;
      }
      let chosen = matches[0]!;
      if (matches.length > 1 && s.selectedEventId) {
        const currentIndex = matches.findIndex((entry) => entry.id === s.selectedEventId);
        if (currentIndex >= 0) chosen = matches[(currentIndex + 1) % matches.length]!;
      }
      editorStore.selectEvent(chosen.id);
      dragRef.current = {
        mode: "event",
        eventId: chosen.id,
        lastX: chosen.x,
        lastY: chosen.y,
        historyStarted: false,
      };
      return;
    }

    if (s.tool === "select") {
      dragRef.current = { mode: "select", sx: cell.x, sy: cell.y, ox: 0, oy: 0 };
      editorStore.setSelection({ x: cell.x, y: cell.y, w: 1, h: 1 });
      return;
    }
    if (s.tool === "pencil") {
      if (blockReferencePaint()) return;
      editorStore.beginStroke();
      dragRef.current = { mode: "paint", sx: 0, sy: 0, ox: 0, oy: 0 };
      editorStore.paint(cell.x, cell.y, true);
      return;
    }
    applyTool(cell.x, cell.y, false);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const s = stateRef.current;
    if (drag?.mode === "pan") {
      editorStore.setPan({
        x: drag.ox + (event.clientX - drag.sx),
        y: drag.oy + (event.clientY - drag.sy),
      });
      return;
    }

    const cell = cellFromEvent(event);
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
      if (!blockReferencePaint()) editorStore.paint(cell.x, cell.y, true);
    } else if (drag.mode === "event" && (cell.x !== drag.lastX || cell.y !== drag.lastY)) {
      if (!drag.historyStarted) editorStore.beginStroke();
      editorStore.moveEvent(drag.eventId, cell.x, cell.y, true);
      dragRef.current = {
        ...drag,
        lastX: cell.x,
        lastY: cell.y,
        historyStarted: true,
      };
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const s = stateRef.current;
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = Math.min(8, Math.max(0.5, s.zoom * Math.exp(-dy * 0.0015)));
      if (next === s.zoom) return;
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const scale = next / s.zoom;
      editorStore.setPan({
        x: px - (px - s.pan.x) * scale,
        y: py - (py - s.pan.y) * scale,
      });
      editorStore.setZoom(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const hoverIndex = state.hoverCell;
  const hoverId = hoverIndex != null ? state.map.metatiles[hoverIndex] ?? 0 : null;
  const hoverTile = hoverId != null ? METATILE_BY_ID.get(hoverId) : undefined;
  const hoverPhysical = hoverIndex != null ? state.map.physical[hoverIndex] ?? 0 : 0;
  const hoverEvents = hoverIndex != null
    ? state.events.filter(
        (entry) =>
          eventMatchesView(entry, state.viewMode) &&
          entry.x === hoverIndex % state.map.width &&
          entry.y === Math.floor(hoverIndex / state.map.width),
      )
    : [];
  const hoverDetail =
    hoverIndex == null
      ? "mover o cursor sobre o mapa"
      : state.viewMode === "collision"
        ? `colisão ${getCollision(hoverPhysical)}`
        : state.viewMode === "elevation"
          ? `elevação ${getElevation(hoverPhysical)}`
          : isEventView(state.viewMode)
            ? hoverEvents.length
              ? hoverEvents.map((event) => `${event.label}/${event.source}`).join(", ")
              : "sem evento nesta camada"
            : hoverTile?.name ?? `id ${hoverId}`;
  const eventView = isEventView(state.viewMode);
  const draggingEvent = dragRef.current?.mode === "event";
  const referenceOnly = activeAtlas?.compatibility === "reference";

  return (
    <div className="relative min-w-0 flex-1 bg-canvas">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        style={{
          cursor: eventView
            ? draggingEvent
              ? "grabbing"
              : "grab"
            : referenceOnly && state.viewMode === "visual"
              ? "not-allowed"
              : state.tool === "picker"
                ? "crosshair"
                : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => {
          endDrag();
          editorStore.setHover(null);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas ref={canvasRef} className="pixelated block" />
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded border border-border bg-panel/90 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        {hoverIndex != null
          ? `(${hoverIndex % state.map.width}, ${Math.floor(hoverIndex / state.map.width)}) · ${hoverDetail}`
          : hoverDetail}
        {"  ·  "}
        {cellSize.toFixed(0)}px/tile · Shift/botão direito: pan
      </div>

      {referenceOnly && state.viewMode === "visual" && (
        <div className="pointer-events-none absolute right-2 top-4 rounded border border-warning/40 bg-warning/15 px-2 py-1 text-[10px] font-medium text-warning">
          Referência GBA · somente leitura · volte ao Emerald para pintar
        </div>
      )}

      {(state.viewMode === "collision" || state.viewMode === "elevation") && (
        <div className="pointer-events-none absolute right-2 top-4 rounded border border-success/40 bg-success/15 px-2 py-1 text-[10px] font-medium text-success">
          Camada editável · valor ativo {state.viewMode === "collision" ? state.selectedCollision : state.selectedElevation}
        </div>
      )}

      {eventView && (
        <div className="pointer-events-none absolute right-2 top-4 rounded border border-success/40 bg-success/15 px-2 py-1 text-[10px] font-medium text-success">
          Eventos editáveis · clique para selecionar · arraste para mover
        </div>
      )}
    </div>
  );
}
