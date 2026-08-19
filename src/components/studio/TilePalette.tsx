import { useEffect, useRef, useState } from "react";
import { editorStore, useEditor } from "@/lib/editorStore";
import {
  CATEGORIES,
  DEMO_METATILES,
  TILE_PX,
  drawMetatile,
  type DemoMetatile,
  type MetatileCategory,
} from "@/lib/demoAtlas";
import { hex } from "@/lib/emeraldMap";
import { cn } from "@/lib/utils";

function TileSwatch({ tile, size = 32 }: { tile: DemoMetatile; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TILE_PX, TILE_PX);
    drawMetatile(ctx, tile);
  }, [tile]);
  return (
    <canvas
      ref={ref}
      className="pixelated block"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function TilePalette() {
  const state = useEditor();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MetatileCategory | "Todos">("Todos");

  const tiles = DEMO_METATILES.filter((tile) => {
    if (category !== "Todos" && tile.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      tile.name.toLowerCase().includes(q) ||
      String(tile.id).includes(q) ||
      hex(tile.id, 3).toLowerCase().includes(q)
    );
  });

  const selected = DEMO_METATILES.find((t) => t.id === state.selectedMetatile);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="panel-title">Metatiles</span>
        <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-warning">
          ATLAS DEMO
        </span>
      </div>

      <div className="space-y-2 border-b border-border p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nome ou id…"
          className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
        <div className="flex flex-wrap gap-1">
          {(["Todos", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-sm border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-surface",
                category === cat && "border-primary/50 bg-primary/15 text-primary",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              title={`${tile.name} — id ${tile.id} (${hex(tile.id, 3)}) · ${tile.category}`}
              onClick={() => editorStore.setMetatile(tile.id)}
              className={cn(
                "relative overflow-hidden rounded-sm border p-0 leading-none transition-shadow",
                state.selectedMetatile === tile.id
                  ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border hover:border-border-strong",
              )}
            >
              <TileSwatch tile={tile} size={44} />
              <span className="absolute bottom-0 right-0 bg-background/80 px-0.5 font-mono text-[8px] text-muted-foreground">
                {tile.id}
              </span>
            </button>
          ))}
        </div>
        {tiles.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">Nenhum metatile.</p>
        )}
      </div>

      <div className="border-t border-border p-2">
        <span className="panel-title">Selecionado</span>
        {selected ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="rounded-sm border border-border">
              <TileSwatch tile={selected} size={40} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium">{selected.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                id {selected.id} · {hex(selected.id, 3)}
              </p>
              <p className="text-[10px] text-muted-foreground">{selected.category}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            id {state.selectedMetatile} (fora do atlas demo)
          </p>
        )}
      </div>
    </aside>
  );
}
