import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  atlasSourceRect,
  realAtlasStore,
  useRealAtlas,
  type SavedAtlasRecord,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

function DemoSwatch({ tile, size = 32 }: { tile: DemoMetatile; size?: number }) {
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
  return <canvas ref={ref} className="pixelated block" style={{ width: size, height: size }} aria-hidden />;
}

function RealSwatch({
  atlas,
  record,
  size = 32,
}: {
  atlas: SavedRealAtlas;
  record: SavedAtlasRecord;
  size?: number;
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

export function TilePalette() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const [query, setQuery] = useState("");
  const [demoCategory, setDemoCategory] = useState<MetatileCategory | "Todos">("Todos");
  const [realCategory, setRealCategory] = useState<"Todos" | "Primary" | "Secondary">("Todos");

  const demoTiles = useMemo(
    () =>
      DEMO_METATILES.filter((tile) => {
        if (demoCategory !== "Todos" && tile.category !== demoCategory) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          tile.name.toLowerCase().includes(q) ||
          String(tile.id).includes(q) ||
          hex(tile.id, 3).toLowerCase().includes(q)
        );
      }),
    [demoCategory, query],
  );

  const realTiles = useMemo(() => {
    if (!atlas) return [];
    const q = query.trim().toLowerCase();
    return atlas.records.filter((record) => {
      if (realCategory === "Primary" && record.source !== "primary") return false;
      if (realCategory === "Secondary" && record.source !== "secondary") return false;
      if (!q) return true;
      return (
        String(record.id).includes(q) ||
        hex(record.id, 3).toLowerCase().includes(q) ||
        String(record.localId).includes(q) ||
        (record.behavior != null && `behavior ${record.behavior}`.includes(q))
      );
    });
  }, [atlas, query, realCategory]);

  const selectedDemo = DEMO_METATILES.find((tile) => tile.id === state.selectedMetatile);
  const selectedReal = atlas ? realAtlasStore.recordFor(state.selectedMetatile, atlas) : undefined;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="panel-title">Metatiles</span>
        {atlas ? (
          <span className="rounded-sm bg-success/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-success">
            ATLAS REAL
          </span>
        ) : (
          <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-warning">
            ATLAS DEMO
          </span>
        )}
      </div>

      <div className="space-y-2 border-b border-border p-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={atlas ? "Buscar ID / hex / behavior…" : "Buscar nome ou id…"}
          className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
        {atlas ? (
          <div className="flex flex-wrap gap-1">
            {(["Todos", "Primary", "Secondary"] as const).map((category) => (
              <FilterButton
                key={category}
                active={realCategory === category}
                onClick={() => setRealCategory(category)}
              >
                {category}
              </FilterButton>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(["Todos", ...CATEGORIES] as const).map((category) => (
              <FilterButton
                key={category}
                active={demoCategory === category}
                onClick={() => setDemoCategory(category)}
              >
                {category}
              </FilterButton>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {atlas
            ? realTiles.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  title={`ID ${record.id} (${hex(record.id, 3)}) · ${record.source} local ${record.localId}${record.behavior != null ? ` · behavior 0x${record.behavior.toString(16).padStart(2, "0")}` : ""}`}
                  onClick={() => editorStore.setMetatile(record.id)}
                  className={cn(
                    "relative overflow-hidden rounded-sm border p-0 leading-none transition-shadow",
                    state.selectedMetatile === record.id
                      ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <RealSwatch atlas={atlas} record={record} size={44} />
                  <span className="absolute bottom-0 right-0 bg-background/85 px-0.5 font-mono text-[8px] text-foreground/80">
                    {record.id}
                  </span>
                </button>
              ))
            : demoTiles.map((tile) => (
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
                  <DemoSwatch tile={tile} size={44} />
                  <span className="absolute bottom-0 right-0 bg-background/80 px-0.5 font-mono text-[8px] text-muted-foreground">
                    {tile.id}
                  </span>
                </button>
              ))}
        </div>
        {(atlas ? realTiles.length : demoTiles.length) === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">Nenhum metatile.</p>
        )}
      </div>

      <div className="border-t border-border p-2">
        <span className="panel-title">Selecionado</span>
        {atlas && selectedReal ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="rounded-sm border border-border">
              <RealSwatch atlas={atlas} record={selectedReal} size={40} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="font-mono text-xs font-medium">ID {selectedReal.id} · {hex(selectedReal.id, 3)}</p>
              <p className="text-[10px] text-muted-foreground">
                {selectedReal.source} · local {selectedReal.localId}
              </p>
              <p className="text-[10px] text-muted-foreground">
                behavior {selectedReal.behavior == null ? "—" : hex(selectedReal.behavior, 2)} · layer {selectedReal.layerType ?? "—"}
              </p>
            </div>
          </div>
        ) : !atlas && selectedDemo ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="rounded-sm border border-border"><DemoSwatch tile={selectedDemo} size={40} /></div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium">{selectedDemo.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">id {selectedDemo.id} · {hex(selectedDemo.id, 3)}</p>
              <p className="text-[10px] text-muted-foreground">{selectedDemo.category}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            id {state.selectedMetatile} (não existe no atlas ativo)
          </p>
        )}
      </div>
    </aside>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-surface",
        active && "border-primary/50 bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}
