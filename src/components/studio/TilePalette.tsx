import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { editorStore, useEditor } from "@/lib/editorStore";
import { hex } from "@/lib/emeraldMap";
import {
  atlasSourceRect,
  realAtlasStore,
  useRealAtlas,
  type SavedAtlasRecord,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";
import { MetatileGrid } from "./MetatileGrid";
import { TilesetQuickPicker } from "./TilesetQuickPicker";

type TileDensity = "compact" | "normal" | "large";

const DENSITY: Record<TileDensity, { size: number; columns: number; label: string }> = {
  compact: { size: 28, columns: 7, label: "C" },
  normal: { size: 36, columns: 5, label: "N" },
  large: { size: 48, columns: 4, label: "G" },
};

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
  const [realCategory, setRealCategory] = useState<"Todos" | "Primary" | "Secondary">("Todos");
  const [density, setDensity] = useState<TileDensity>("compact");
  const densityConfig = DENSITY[density];

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
        record.source.includes(q) ||
        (record.behavior != null && `behavior ${record.behavior}`.includes(q)) ||
        (record.behavior != null && `0x${record.behavior.toString(16)}`.includes(q)) ||
        (record.layerType != null && `layer ${record.layerType}`.includes(q))
      );
    });
  }, [atlas, query, realCategory]);

  const selectedReal = atlas ? realAtlasStore.recordFor(state.selectedMetatile, atlas) : undefined;

  if (state.viewMode === "collision" || state.viewMode === "elevation") {
    return <PhysicalPalette mode={state.viewMode} />;
  }

  if (state.viewMode === "warps" || state.viewMode === "npcs" || state.viewMode === "triggers") {
    return <EventPalette />;
  }

  return (
    <aside className="relative z-30 flex w-64 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="leading-tight">
          <span className="panel-title">Metatiles</span>
          {atlas && <p className="mt-0.5 font-mono text-[8px] text-muted-foreground">{realTiles.length}/{atlas.records.length} visíveis</p>}
        </div>
        {atlas ? (
          <span className="rounded-sm bg-success/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-success">
            GBA REAL
          </span>
        ) : (
          <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-warning">
            CARREGANDO REAL
          </span>
        )}
      </div>

      {atlas ? (
        <>
          <div className="space-y-2 border-b border-border p-2">
            <TilesetQuickPicker atlas={atlas} />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID, hex, behavior, layer…"
              className="h-7 w-full rounded border border-border bg-canvas px-2 text-[11px] outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {(["Todos", "Primary", "Secondary"] as const).map((category) => (
                  <FilterButton
                    key={category}
                    active={realCategory === category}
                    onClick={() => setRealCategory(category)}
                  >
                    {category === "Todos" ? "Todos" : category === "Primary" ? "P" : "S"}
                  </FilterButton>
                ))}
              </div>
              <div className="flex items-center overflow-hidden rounded border border-border bg-canvas" title="Densidade da paleta">
                {(Object.keys(DENSITY) as TileDensity[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDensity(key)}
                    className={cn(
                      "grid h-6 w-6 place-items-center border-l border-border text-[9px] font-semibold first:border-l-0 hover:bg-surface",
                      density === key && "bg-primary/15 text-primary",
                    )}
                    title={key === "compact" ? "Compacto" : key === "normal" ? "Normal" : "Grande"}
                  >
                    {DENSITY[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded border border-border bg-canvas px-2 py-1 text-[8px] text-muted-foreground">
              <span className="truncate"><b className="text-foreground">P</b> {atlas.primary.replace(/^gTileset_/, "")}</span>
              <span className="px-1 text-border-strong">+</span>
              <span className="truncate text-right"><b className="text-foreground">S</b> {atlas.secondary.replace(/^gTileset_/, "")}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <MetatileGrid
              atlas={atlas}
              records={realTiles}
              selectedMetatile={state.selectedMetatile}
              size={densityConfig.size}
              columns={densityConfig.columns}
              densityLabel={densityConfig.label}
            />
            {realTiles.length === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">Nenhum metatile corresponde ao filtro.</p>
            )}
          </div>

          <div className="border-t border-border bg-toolbar/40 p-2">
            <span className="panel-title">Selecionado</span>
            {selectedReal ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="rounded-sm border border-border bg-canvas">
                  <RealSwatch atlas={atlas} record={selectedReal} size={40} />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-xs font-medium">ID {selectedReal.id} · {hex(selectedReal.id, 3)}</p>
                    <span className="rounded bg-surface px-1 text-[7px] uppercase text-muted-foreground">{selectedReal.source}</span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">local {selectedReal.localId}</p>
                  <p className="text-[9px] text-muted-foreground">
                    behavior {selectedReal.behavior == null ? "—" : hex(selectedReal.behavior, 2)} · layer {selectedReal.layerType ?? "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                id {state.selectedMetatile} (não existe no atlas ativo)
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="size-8 animate-pulse rounded border border-success/30 bg-success/10" />
          <div>
            <p className="text-xs font-semibold">Buscando metatiles reais do Emerald…</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              O Studio não usa mais árvores, casas ou caminhos desenhados com formas genéricas como fallback.
            </p>
          </div>
          <Link
            to="/workspace"
            className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/15"
          >
            Abrir Workspace Arauna
          </Link>
          <Link
            to="/gen3-library"
            className="rounded border border-border px-2 py-1 text-[10px] text-foreground/80 hover:bg-surface"
          >
            Biblioteca Gen III
          </Link>
        </div>
      )}
    </aside>
  );
}

function EventPalette() {
  const state = useEditor();
  const [query, setQuery] = useState("");
  const label = state.viewMode === "warps" ? "Warps" : state.viewMode === "npcs" ? "NPCs" : "Triggers/BG";
  const events = state.events.filter((event) => {
    const layerMatch = state.viewMode === "warps"
      ? event.source === "warp"
      : state.viewMode === "npcs"
        ? event.source === "object"
        : event.source === "coord" || event.source === "bg";
    if (!layerMatch) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [event.label, event.source, event.detail, event.id, String(event.x), String(event.y)]
      .some((value) => value.toLowerCase().includes(q));
  });

  const addAtSelection = (source: "warp" | "object" | "coord" | "bg") => editorStore.createEvent(source);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="panel-title">{label}</span>
        <span className={cn(
          "rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
          state.mapJsonDocument ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
        )}>
          {state.mapJsonDocument ? "EDITÁVEL" : "JSON AUSENTE"}
        </span>
      </div>

      <div className="space-y-2 border-b border-border p-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar label, script, ID…"
          className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
        {state.mapJsonDocument && (
          <div className="flex flex-wrap gap-1">
            {state.viewMode === "warps" && <SmallAdd onClick={() => addAtSelection("warp")}>+ Warp</SmallAdd>}
            {state.viewMode === "npcs" && <SmallAdd onClick={() => addAtSelection("object")}>+ NPC</SmallAdd>}
            {state.viewMode === "triggers" && (
              <>
                <SmallAdd onClick={() => addAtSelection("coord")}>+ Trigger</SmallAdd>
                <SmallAdd onClick={() => addAtSelection("bg")}>+ BG</SmallAdd>
              </>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => editorStore.selectEvent(event.id)}
              className={cn(
                "w-full rounded border p-2 text-left transition-colors",
                state.selectedEventId === event.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-canvas hover:bg-surface",
              )}
            >
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[10px] font-semibold text-primary">{event.label}</span>
                <span className="text-[8px] uppercase tracking-wide text-muted-foreground">{event.source}</span>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground">{event.x},{event.y}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">{event.detail || "sem detalhe"}</p>
            </button>
          ))}
        </div>
        {events.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Nenhum evento nesta camada.</p>}
      </div>

      <div className="border-t border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
        {state.mapJsonDocument ? (
          <>
            <p><b className="text-foreground">{events.length}</b> evento(s) visíveis.</p>
            <p className="mt-1">Clique para selecionar; arraste no mapa para mover. Campos completos ficam no inspetor.</p>
          </>
        ) : (
          <p>Abra o mapa pelo <b className="text-foreground">Workspace</b> ou importe map.json para editar.</p>
        )}
      </div>
    </aside>
  );
}

function SmallAdd({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary hover:bg-primary/15"
    >
      {children}
    </button>
  );
}

function PhysicalPalette({ mode }: { mode: "collision" | "elevation" }) {
  const state = useEditor();
  const values = mode === "collision" ? [0, 1, 2, 3] : Array.from({ length: 16 }, (_, index) => index);
  const selected = mode === "collision" ? state.selectedCollision : state.selectedElevation;
  const label = mode === "collision" ? "Colisão" : "Elevação";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="panel-title">{label}</span>
        <span className="rounded-sm bg-success/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-success">EDITÁVEL</span>
      </div>

      <div className="border-b border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
        <p>Escolha um valor e use <b className="text-foreground">Lápis</b>, <b className="text-foreground">Conta-gotas</b>, <b className="text-foreground">Bucket fill</b> ou seleção.</p>
        <p className="mt-1">A edição altera somente os bits de {label.toLowerCase()}, preservando metatile e {mode === "collision" ? "elevação" : "colisão"}.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className={mode === "collision" ? "grid grid-cols-2 gap-2" : "grid grid-cols-4 gap-1.5"}>
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => mode === "collision" ? editorStore.setCollision(value) : editorStore.setElevation(value)}
              className={cn(
                "grid min-h-12 place-items-center rounded border font-mono transition-colors",
                selected === value
                  ? "border-primary bg-primary/15 text-primary shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border bg-canvas text-foreground/80 hover:bg-surface",
              )}
              title={`${label} ${value}`}
            >
              <span className="text-sm font-semibold">{value}</span>
              <span className="text-[8px] text-muted-foreground">0x{value.toString(16).toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-3">
        <span className="panel-title">Valor ativo</span>
        <p className="mt-1 font-mono text-lg text-primary">{selected}</p>
        <p className="text-[10px] text-muted-foreground">
          {mode === "collision" ? "bits 10–11 do map.bin" : "bits 12–15 do map.bin"}
        </p>
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
