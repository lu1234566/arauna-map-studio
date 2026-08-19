import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import { clipboardStore } from "@/lib/clipboardStore";
import { editorStore } from "@/lib/editorStore";
import { hex } from "@/lib/emeraldMap";
import {
  atlasSourceRect,
  realAtlasStore,
  type SavedAtlasRecord,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

type BrushRange = { start: number; end: number };

function MetatileThumb({
  atlas,
  record,
  size,
}: {
  atlas: SavedRealAtlas;
  record: SavedAtlasRecord;
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const source = realAtlasStore.getCanvas(atlas);
    if (!canvas || !source) return;
    const rect = atlasSourceRect(atlas, record);
    canvas.width = atlas.tileSize;
    canvas.height = atlas.tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, atlas.tileSize, atlas.tileSize);
  }, [atlas, record]);
  return <canvas ref={ref} className="pixelated block" style={{ width: size, height: size }} aria-hidden />;
}

function rectangle(range: BrushRange, columns: number) {
  const ax = range.start % columns;
  const ay = Math.floor(range.start / columns);
  const bx = range.end % columns;
  const by = Math.floor(range.end / columns);
  return {
    left: Math.min(ax, bx),
    right: Math.max(ax, bx),
    top: Math.min(ay, by),
    bottom: Math.max(ay, by),
  };
}

function inRange(index: number, range: BrushRange | null, columns: number) {
  if (!range) return false;
  const rect = rectangle(range, columns);
  const x = index % columns;
  const y = Math.floor(index / columns);
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function MetatileGrid({
  atlas,
  records,
  selectedMetatile,
  size,
  columns,
  densityLabel,
}: {
  atlas: SavedRealAtlas;
  records: SavedAtlasRecord[];
  selectedMetatile: number;
  size: number;
  columns: number;
  densityLabel: string;
}) {
  const [page, setPage] = useState(0);
  const [brushMode, setBrushMode] = useState(false);
  const [draft, setDraft] = useState<BrushRange | null>(null);
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);
  const dragRef = useRef<BrushRange | null>(null);
  const pageSize = columns * 16;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRecords = useMemo(
    () => records.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [records, safePage, pageSize],
  );

  useEffect(() => {
    setPage(0);
    setDraft(null);
    setBrushRange(null);
    setBrushMode(false);
    dragRef.current = null;
  }, [atlas.createdAt, columns, records]);

  useEffect(() => {
    if (page < pageCount) return;
    setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const finishBrush = useCallback(() => {
    const range = dragRef.current;
    dragRef.current = null;
    if (!brushMode || !range) return;
    const rect = rectangle(range, columns);
    const width = rect.right - rect.left + 1;
    const height = rect.bottom - rect.top + 1;
    const values: number[] = [];
    for (let y = rect.top; y <= rect.bottom; y++) {
      for (let x = rect.left; x <= rect.right; x++) {
        const record = pageRecords[y * columns + x];
        if (!record) {
          editorStore.setMessage("O brush alcançou uma área vazia no fim da página. Selecione apenas metatiles visíveis.");
          setDraft(null);
          return;
        }
        values.push(record.id);
      }
    }
    if (!clipboardStore.loadVisualBrush(width, height, values, true)) return;
    const first = values[0];
    if (first != null) editorStore.setMetatile(first);
    setBrushRange(range);
    setDraft(null);
    setBrushMode(false);
  }, [brushMode, columns, pageRecords]);

  useEffect(() => {
    if (!brushMode) return;
    const onPointerUp = () => finishBrush();
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [brushMode, finishBrush]);

  const movePage = (next: number) => {
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
    setDraft(null);
    setBrushRange(null);
    dragRef.current = null;
  };

  const beginBrush = (index: number) => {
    const range = { start: index, end: index };
    dragRef.current = range;
    setDraft(range);
  };

  const extendBrush = (index: number) => {
    const current = dragRef.current;
    if (!current) return;
    const next = { ...current, end: index };
    dragRef.current = next;
    setDraft(next);
  };

  const activeRange = draft ?? brushRange;
  const brushRect = activeRange ? rectangle(activeRange, columns) : null;
  const brushSize = brushRect
    ? `${brushRect.right - brushRect.left + 1}×${brushRect.bottom - brushRect.top + 1}`
    : null;

  if (!records.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1 rounded border border-border bg-toolbar/60 px-1.5 py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => movePage(safePage - 1)}
            disabled={safePage === 0}
            className="grid size-6 place-items-center rounded border border-border bg-canvas text-muted-foreground hover:bg-surface disabled:opacity-30"
            title="Bloco anterior de metatiles"
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="min-w-16 text-center font-mono text-[8px] text-muted-foreground">
            bloco {safePage + 1}/{pageCount}
          </span>
          <button
            type="button"
            onClick={() => movePage(safePage + 1)}
            disabled={safePage >= pageCount - 1}
            className="grid size-6 place-items-center rounded border border-border bg-canvas text-muted-foreground hover:bg-surface disabled:opacity-30"
            title="Próximo bloco de metatiles"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setBrushMode((value) => !value);
            setDraft(null);
            dragRef.current = null;
          }}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[8px] font-semibold",
            brushMode
              ? "border-primary/60 bg-primary/20 text-primary"
              : "border-border bg-canvas text-foreground/80 hover:bg-surface",
          )}
          title="Arraste sobre a grade para criar um brush multi-metatile"
        >
          <MousePointer2 className="size-3" /> {brushMode ? "arraste" : brushSize ? `brush ${brushSize}` : "brush"}
        </button>
      </div>

      {brushMode && (
        <div className="rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[8px] leading-relaxed text-primary">
          Arraste um retângulo sobre os metatiles. Ao soltar, ele vira um carimbo visual pronto para pintar no mapa.
        </div>
      )}

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onPointerUp={finishBrush}
      >
        {pageRecords.map((record, index) => {
          const brushSelected = inRange(index, activeRange, columns);
          return (
            <button
              key={record.id}
              type="button"
              title={`ID ${record.id} (${hex(record.id, 3)}) · ${record.source} local ${record.localId}${record.behavior != null ? ` · behavior 0x${record.behavior.toString(16).padStart(2, "0")}` : ""}${record.layerType != null ? ` · layer ${record.layerType}` : ""}`}
              onClick={() => {
                if (brushMode) return;
                if (clipboardStore.getState().stampMode) clipboardStore.toggleStampMode(false);
                setBrushRange(null);
                editorStore.setMetatile(record.id);
              }}
              onPointerDown={(event) => {
                if (!brushMode || event.button !== 0) return;
                event.preventDefault();
                beginBrush(index);
              }}
              onPointerEnter={() => {
                if (brushMode) extendBrush(index);
              }}
              className={cn(
                "relative grid place-items-center overflow-hidden rounded-sm border p-0 leading-none transition-shadow",
                brushSelected
                  ? "border-primary bg-primary/15 shadow-[0_0_0_1px_var(--color-primary)]"
                  : selectedMetatile === record.id && !brushRange
                    ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                    : record.source === "secondary"
                      ? "border-border-strong hover:border-primary/50"
                      : "border-border hover:border-border-strong",
              )}
            >
              <MetatileThumb atlas={atlas} record={record} size={size} />
              <span className={cn(
                "absolute bottom-0 right-0 bg-background/85 px-0.5 font-mono text-foreground/80",
                densityLabel === "C" ? "text-[6px]" : "text-[7px]",
              )}>
                {record.id}
              </span>
              {record.source === "secondary" && (
                <span className="absolute left-0 top-0 bg-primary/75 px-0.5 text-[6px] font-bold text-primary-foreground">S</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-0.5 font-mono text-[7px] text-muted-foreground">
        <span>{safePage * pageSize + 1}–{Math.min(records.length, (safePage + 1) * pageSize)}</span>
        <span>{records.length} metatiles filtrados</span>
      </div>
    </div>
  );
}
