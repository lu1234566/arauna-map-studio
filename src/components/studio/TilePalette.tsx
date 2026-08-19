import { useEffect, useMemo, useRef, useState } from "react";
import { editorStore, useEditor } from "@/lib/editorStore";
import { hex } from "@/lib/emeraldMap";
import {
  activateGbaPack,
  ensureDefaultGbaAtlas,
  loadGbaTilesetCatalog,
  useGbaTilesetLibrary,
} from "@/lib/gbaTilesetLibrary";
import {
  atlasSourceRect,
  realAtlasStore,
  useRealAtlas,
  type SavedAtlasRecord,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

function RealSwatch({ atlas, record, size = 32 }: { atlas: SavedRealAtlas; record: SavedAtlasRecord; size?: number }) {
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
  const library = useGbaTilesetLibrary();
  const [query, setQuery] = useState("");
  const [realCategory, setRealCategory] = useState<"Todos" | "Primary" | "Secondary">("Todos");

  useEffect(() => {
    void loadGbaTilesetCatalog().then(() => ensureDefaultGbaAtlas());
  }, []);

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

  const selectedReal = atlas ? realAtlasStore.recordFor(state.selectedMetatile, atlas) : undefined;
  const referenceOnly = atlas?.compatibility === "reference";

  if (state.viewMode === "collision" || state.viewMode === "elevation") return <PhysicalPalette mode={state.viewMode} />;
  if (state.viewMode === "warps" || state.viewMode === "npcs" || state.viewMode === "triggers") return <EventPalette />;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="panel-title">Metatiles GBA</span>
        {atlas ? (
          <span className={cn(
            "rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
            referenceOnly ? "bg-warning/20 text-warning" : "bg-success/15 text-success",
          )}>{referenceOnly ? "REFERÊNCIA" : "NATIVO"}</span>
        ) : (
          <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary">CARREGANDO</span>
        )}
      </div>

      <div className="space-y-2 border-b border-border p-2">
        {library.catalog && (
          <select
            value={atlas?.packId ?? library.catalog.defaultPackId}
            disabled={Boolean(library.activatingPackId)}
            onChange={(event) => void activateGbaPack(event.target.value)}
            className="h-8 w-full rounded border border-border bg-canvas px-1.5 text-[10px] outline-none focus:border-primary/60"
            title="Trocar par de tilesets real"
          >
            {library.catalog.families.map((family) => (
              <optgroup key={family.id} label={family.label}>
                {library.catalog!.packs.filter((pack) => pack.family === family.id).map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.primary.replace("gTileset_", "")} + {pack.secondary.replace("gTileset_", "")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        {atlas && (
          <div className="rounded border border-border bg-canvas px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">{atlas.familyLabel}</b><br />
            {atlas.primary} + {atlas.secondary}
          </div>
        )}

        {referenceOnly && (
          <div className="rounded border border-warning/40 bg-warning/10 p-2 text-[9px] leading-relaxed text-warning">
            FRLG/Ruby-Sapphire estão em modo de referência. Pintura direta fica bloqueada porque os IDs não são equivalentes aos de Emerald/Arauna.
          </div>
        )}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar ID / hex / behavior…"
          disabled={!atlas}
          className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60 disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-1">
          {(["Todos", "Primary", "Secondary"] as const).map((category) => (
            <FilterButton key={category} active={realCategory === category} onClick={() => setRealCategory(category)}>{category}</FilterButton>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!atlas ? (
          <div className="grid min-h-40 place-items-center px-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Carregando tileset real de Pokémon Emerald…</p>
              <p className="mt-1">Nenhum atlas geométrico será usado como substituto.</p>
              {library.error && <p className="mt-2 text-warning">{library.error}</p>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {realTiles.map((record) => (
              <button
                key={record.id}
                type="button"
                disabled={referenceOnly}
                title={`ID ${record.id} (${hex(record.id, 3)}) · ${record.source} local ${record.localId}${record.behavior != null ? ` · behavior 0x${record.behavior.toString(16).padStart(2, "0")}` : ""}`}
                onClick={() => editorStore.setMetatile(record.id)}
                className={cn(
                  "relative overflow-hidden rounded-sm border p-0 leading-none transition-shadow disabled:cursor-not-allowed disabled:opacity-70",
                  state.selectedMetatile === record.id
                    ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-border hover:border-border-strong",
                )}
              >
                <RealSwatch atlas={atlas} record={record} size={44} />
                <span className="absolute bottom-0 right-0 bg-background/85 px-0.5 font-mono text-[8px] text-foreground/80">{record.id}</span>
              </button>
            ))}
          </div>
        )}
        {atlas && realTiles.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Nenhum metatile.</p>}
      </div>

      <div className="border-t border-border p-2">
        <span className="panel-title">Selecionado</span>
        {atlas && selectedReal ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="rounded-sm border border-border"><RealSwatch atlas={atlas} record={selectedReal} size={40} /></div>
            <div className="min-w-0 leading-tight">
              <p className="font-mono text-xs font-medium">ID {selectedReal.id} · {hex(selectedReal.id, 3)}</p>
              <p className="text-[10px] text-muted-foreground">{selectedReal.source} · local {selectedReal.localId}</p>
              <p className="text-[10px] text-muted-foreground">behavior {selectedReal.behavior == null ? "—" : hex(selectedReal.behavior, 2)} · layer {selectedReal.layerType ?? "—"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">id {state.selectedMetatile}{atlas ? " (não existe no atlas ativo)" : ""}</p>
        )}
      </div>
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
        <span className={cn("rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider", state.mapJsonDocument ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
          {state.mapJsonDocument ? "EDITÁVEL" : "JSON AUSENTE"}
        </span>
      </div>
      <div className="space-y-2 border-b border-border p-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar label, script, ID…" className="h-7 w-full rounded border border-border bg-canvas px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60" />
        {state.mapJsonDocument && (
          <div className="flex flex-wrap gap-1">
            {state.viewMode === "warps" && <SmallAdd onClick={() => addAtSelection("warp")}>+ Warp</SmallAdd>}
            {state.viewMode === "npcs" && <SmallAdd onClick={() => addAtSelection("object")}>+ NPC</SmallAdd>}
            {state.viewMode === "triggers" && <><SmallAdd onClick={() => addAtSelection("coord")}>+ Trigger</SmallAdd><SmallAdd onClick={() => addAtSelection("bg")}>+ BG</SmallAdd></>}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {events.map((event) => (
            <button key={event.id} type="button" onClick={() => editorStore.selectEvent(event.id)} className={cn("w-full rounded border p-2 text-left transition-colors", state.selectedEventId === event.id ? "border-primary/50 bg-primary/10" : "border-border bg-canvas hover:bg-surface")}>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[10px] font-semibold text-primary">{event.label}</span><span className="text-[8px] uppercase tracking-wide text-muted-foreground">{event.source}</span><span className="ml-auto font-mono text-[9px] text-muted-foreground">{event.x},{event.y}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">{event.detail || "sem detalhe"}</p>
            </button>
          ))}
        </div>
        {events.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Nenhum evento nesta camada.</p>}
      </div>
      <div className="border-t border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
        {state.mapJsonDocument ? <><p><b className="text-foreground">{events.length}</b> evento(s) visíveis.</p><p className="mt-1">Clique para selecionar; arraste no mapa para mover. Campos completos ficam no inspetor.</p></> : <p>Abra o mapa pelo <b className="text-foreground">Workspace</b> ou importe map.json para editar.</p>}
      </div>
    </aside>
  );
}

function SmallAdd({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary hover:bg-primary/15">{children}</button>;
}

function PhysicalPalette({ mode }: { mode: "collision" | "elevation" }) {
  const state = useEditor();
  const values = mode === "collision" ? [0, 1, 2, 3] : Array.from({ length: 16 }, (_, index) => index);
  const selected = mode === "collision" ? state.selectedCollision : state.selectedElevation;
  const label = mode === "collision" ? "Colisão" : "Elevação";
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2"><span className="panel-title">{label}</span><span className="rounded-sm bg-success/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-success">EDITÁVEL</span></div>
      <div className="border-b border-border p-3 text-[10px] leading-relaxed text-muted-foreground"><p>Escolha um valor e use <b className="text-foreground">Lápis</b>, <b className="text-foreground">Conta-gotas</b>, <b className="text-foreground">Bucket fill</b> ou seleção.</p><p className="mt-1">A edição altera somente os bits de {label.toLowerCase()}, preservando metatile e {mode === "collision" ? "elevação" : "colisão"}.</p></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className={mode === "collision" ? "grid grid-cols-2 gap-2" : "grid grid-cols-4 gap-1.5"}>
          {values.map((value) => (
            <button key={value} type="button" onClick={() => mode === "collision" ? editorStore.setCollision(value) : editorStore.setElevation(value)} className={cn("grid min-h-12 place-items-center rounded border font-mono transition-colors", selected === value ? "border-primary bg-primary/15 text-primary shadow-[0_0_0_1px_var(--color-primary)]" : "border-border bg-canvas text-foreground/80 hover:bg-surface")} title={`${label} ${value}`}>
              <span className="text-sm font-semibold">{value}</span><span className="text-[8px] text-muted-foreground">0x{value.toString(16).toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border p-3"><span className="panel-title">Valor ativo</span><p className="mt-1 font-mono text-lg text-primary">{selected}</p><p className="text-[10px] text-muted-foreground">{mode === "collision" ? "bits 10–11 do map.bin" : "bits 12–15 do map.bin"}</p></div>
    </aside>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-sm border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-surface", active && "border-primary/50 bg-primary/15 text-primary")}>{children}</button>;
}
