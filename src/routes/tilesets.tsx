import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ExternalLink, Loader2, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  activateGbaPack,
  loadGbaTilesetCatalog,
  useGbaTilesetLibrary,
  type GbaCatalogPack,
  type GbaFamilyId,
} from "@/lib/gbaTilesetLibrary";
import { realAtlasStore, useRealAtlas, type SavedRealAtlas } from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tilesets")({ component: GbaTilesetLibrary });

type FamilyFilter = "all" | GbaFamilyId;

function shortTilesetName(value: string) {
  return value.replace(/^gTileset_/, "");
}

function GbaTilesetLibrary() {
  const library = useGbaTilesetLibrary();
  const activeAtlas = useRealAtlas();
  const [family, setFamily] = useState<FamilyFilter>("emerald");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void loadGbaTilesetCatalog();
  }, []);

  const packs = useMemo(() => {
    const catalog = library.catalog;
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.packs.filter((pack) => {
      if (family !== "all" && pack.family !== family) return false;
      if (!q) return true;
      return [pack.primary, pack.secondary, pack.familyLabel, pack.id, ...pack.maps]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [family, library.catalog, query]);

  useEffect(() => {
    if (!packs.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !packs.some((pack) => pack.id === selectedId)) {
      const active = packs.find((pack) => pack.id === activeAtlas?.packId);
      setSelectedId((active ?? packs[0]).id);
    }
  }, [activeAtlas?.packId, packs, selectedId]);

  const selected = packs.find((pack) => pack.id === selectedId) ?? null;
  const familyCounts = useMemo(() => {
    const result = new Map<string, number>();
    for (const pack of library.catalog?.packs ?? []) result.set(pack.family, (result.get(pack.family) ?? 0) + 1);
    return result;
  }, [library.catalog]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-toolbar px-4 py-2">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface">
          <ArrowLeft className="size-3.5" /> Editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Biblioteca real de tilesets Pokémon GBA</h1>
          <p className="text-[10px] text-muted-foreground">Metatiles 16×16 montados no navegador a partir dos arquivos reais dos decomps pret</p>
        </div>
        {activeAtlas && (
          <div className="ml-auto rounded border border-success/30 bg-success/10 px-2 py-1 text-[10px] text-success">
            Ativo · {activeAtlas.familyLabel} · {shortTilesetName(activeAtlas.primary)} + {shortTilesetName(activeAtlas.secondary)}
          </div>
        )}
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_340px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border bg-panel p-3">
          <section className="rounded border border-success/30 bg-success/5 p-3 text-[10px] leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-foreground">Sem placeholders geométricos</p>
                <p className="mt-1">O preview só aparece depois que o par real termina de carregar. O editor nunca inventa uma árvore, telhado ou caminho para ocupar o lugar de um asset ausente.</p>
              </div>
            </div>
          </section>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tileset, mapa, cidade…"
              className="h-8 w-full rounded border border-border bg-canvas pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
          </div>

          <div className="mt-3 space-y-1">
            <FamilyButton active={family === "emerald"} onClick={() => setFamily("emerald")} label="Emerald" count={familyCounts.get("emerald") ?? 0} badge="NATIVO" />
            <FamilyButton active={family === "ruby-sapphire"} onClick={() => setFamily("ruby-sapphire")} label="Ruby / Sapphire" count={familyCounts.get("ruby-sapphire") ?? 0} badge="REF." />
            <FamilyButton active={family === "firered-leafgreen"} onClick={() => setFamily("firered-leafgreen")} label="FireRed / LeafGreen" count={familyCounts.get("firered-leafgreen") ?? 0} badge="REF." />
            <FamilyButton active={family === "all"} onClick={() => setFamily("all")} label="Todas as famílias" count={library.catalog?.packs.length ?? 0} />
          </div>

          <div className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <p><b className="text-foreground">Emerald</b> é a família nativa de Juramento de Arauna e pode ser usada para pintura do mapa.</p>
            <p className="mt-2"><b className="text-foreground">Ruby/Sapphire e FRLG</b> são carregados com a arte real, mas permanecem em referência porque offsets, paletas e atributos não são equivalentes aos de pokeemerald.</p>
            <p className="mt-2">Os arquivos são buscados sob demanda e o cache HTTP do navegador evita downloads repetidos desnecessários.</p>
          </div>
        </aside>

        <section className="min-w-0 overflow-y-auto bg-canvas p-4">
          {library.phase === "loading" && !library.catalog ? (
            <CenteredStatus icon={<Loader2 className="size-8 animate-spin" />} title="Lendo os layouts reais da era GBA…" detail="Consultando Emerald, Ruby/Sapphire e FireRed/LeafGreen para montar a lista de pares usados pelos mapas." />
          ) : library.error && !library.catalog ? (
            <CenteredStatus icon={<TriangleAlert className="size-8 text-warning" />} title="Não foi possível montar a biblioteca" detail={library.error} />
          ) : (
            <>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Pares primary + secondary usados pelos jogos</h2>
                  <p className="text-[10px] text-muted-foreground">{packs.length} combinação(ões) neste filtro</p>
                </div>
                {library.catalog?.unresolvedPairs.length ? (
                  <span className="max-w-sm rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[9px] text-warning">Alguma família não respondeu; as demais continuam disponíveis.</span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                {packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    atlas={pack.id === activeAtlas?.packId ? activeAtlas : null}
                    selected={pack.id === selectedId}
                    busy={pack.id === library.activatingPackId}
                    onSelect={() => setSelectedId(pack.id)}
                    onActivate={() => void activateGbaPack(pack)}
                  />
                ))}
              </div>
              {!packs.length && <p className="p-8 text-center text-xs text-muted-foreground">Nenhum tileset corresponde ao filtro.</p>}
            </>
          )}
        </section>

        <aside className="overflow-y-auto border-l border-border bg-panel p-3">
          {selected ? (
            <PackInspector
              pack={selected}
              atlas={selected.id === activeAtlas?.packId ? activeAtlas : null}
              busy={selected.id === library.activatingPackId}
            />
          ) : <p className="text-xs text-muted-foreground">Selecione um pack.</p>}
        </aside>
      </main>
    </div>
  );
}

function FamilyButton({ active, onClick, label, count, badge }: { active: boolean; onClick: () => void; label: string; count: number; badge?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded border px-2 py-2 text-left text-xs", active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-canvas hover:bg-surface")}>
      <span className="font-medium">{label}</span>
      {badge && <span className="rounded bg-background/60 px-1 text-[8px] font-bold tracking-wider">{badge}</span>}
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

function PackCard({ pack, atlas, selected, busy, onSelect, onActivate }: { pack: GbaCatalogPack; atlas: SavedRealAtlas | null; selected: boolean; busy: boolean; onSelect: () => void; onActivate: () => void }) {
  const active = Boolean(atlas);
  return (
    <article className={cn("overflow-hidden rounded border bg-panel", selected ? "border-primary/60" : "border-border")}>
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="h-24 overflow-hidden bg-background/60 p-2">
          {atlas ? (
            <AtlasPreview atlas={atlas} fit />
          ) : (
            <div className="grid h-full place-items-center px-3 text-center text-[9px] leading-relaxed text-muted-foreground">
              <span>Preview real carregado sob demanda<br />— sem imagem substituta —</span>
            </div>
          )}
        </div>
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-1">
            <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold tracking-wider", pack.native ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{pack.native ? "NATIVO" : "REFERÊNCIA"}</span>
            {active && <span className="rounded bg-primary/15 px-1 py-0.5 text-[8px] font-bold text-primary">ATIVO</span>}
          </div>
          <p className="mt-1 truncate text-[11px] font-semibold">{shortTilesetName(pack.primary)}</p>
          <p className="truncate text-[10px] text-muted-foreground">+ {shortTilesetName(pack.secondary)}</p>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            {pack.primaryCount != null && pack.secondaryCount != null ? `${pack.primaryCount + pack.secondaryCount} metatiles · ` : ""}{pack.maps.length} layout(s)
          </p>
        </div>
      </button>
      <button type="button" disabled={busy || active} onClick={onActivate} className="flex h-7 w-full items-center justify-center gap-1 border-t border-border text-[10px] font-medium text-primary hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent">
        {busy ? <><Loader2 className="size-3 animate-spin" /> Baixando assets reais…</> : active ? <><Check className="size-3" /> Ativo</> : "Carregar tiles reais"}
      </button>
    </article>
  );
}

function PackInspector({ pack, atlas, busy }: { pack: GbaCatalogPack; atlas: SavedRealAtlas | null; busy: boolean }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="text-sm font-semibold">{shortTilesetName(pack.primary)}</h2><p className="text-[10px] text-muted-foreground">+ {shortTilesetName(pack.secondary)}</p></div>
        <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider", pack.native ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{pack.native ? "EMERALD NATIVO" : "REFERÊNCIA"}</span>
      </div>

      <div className="mt-3 min-h-48 overflow-auto rounded border border-border bg-background/50 p-2">
        {atlas ? <AtlasPreview atlas={atlas} scale={2} /> : (
          <div className="grid min-h-44 place-items-center px-5 text-center text-[10px] leading-relaxed text-muted-foreground">
            <div><p className="font-medium text-foreground">Preview ainda não carregado</p><p className="mt-1">Clique em “Carregar tiles reais”. Não existe fallback geométrico.</p></div>
          </div>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-[10px]">
        <Info label="Família" value={pack.familyLabel} />
        <Info label="Primary" value={pack.primaryCount == null ? "sob demanda" : `${pack.primaryCount} metatiles`} />
        <Info label="Secondary" value={pack.secondaryCount == null ? "sob demanda" : `${pack.secondaryCount} metatiles`} />
        <Info label="Offset secondary" value={String(pack.primaryMetatileLimit)} />
        <Info label="Paletas primary" value={String(pack.primaryPaletteCount)} />
        <Info label="Paletas totais" value={String(pack.totalPaletteCount)} />
      </dl>

      {!pack.native && (
        <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-[10px] leading-relaxed text-warning">
          Este pack é real, mas não é diretamente compatível com pokeemerald. Ele pode ser estudado e visualizado; a pintura direta fica bloqueada no editor para não confundir os IDs com os de Arauna.
        </div>
      )}

      <button type="button" disabled={Boolean(atlas) || busy} onClick={() => void activateGbaPack(pack)} className="mt-3 flex h-8 w-full items-center justify-center gap-1 rounded border border-primary/40 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50">
        {busy ? <><Loader2 className="size-3.5 animate-spin" /> Montando metatiles…</> : atlas ? <><Check className="size-3.5" /> Pack ativo</> : "Carregar e abrir no editor"}
      </button>

      <section className="mt-4 border-t border-border pt-3">
        <h3 className="panel-title">Layouts que usam este par</h3>
        <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line rounded border border-border bg-canvas p-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
          {pack.maps.length ? pack.maps.join("\n") : "Nenhum layout listado"}
        </div>
      </section>

      <section className="mt-4 border-t border-border pt-3 text-[9px] leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1 font-medium text-foreground"><ExternalLink className="size-3" /> Fonte técnica</p>
        <p className="mt-1">{pack.sourceRepo}</p>
        <p className="break-all font-mono">rev {pack.sourceRevision}</p>
        <p className="mt-1">tiles.png + metatiles.bin + metatile_attributes.bin + palettes/*.pal</p>
      </section>

      {pack.warnings.length > 0 && (
        <section className="mt-4 border-t border-border pt-3">
          <h3 className="panel-title text-warning">Avisos ao carregar</h3>
          <ul className="mt-1 space-y-1 text-[9px] text-warning">{pack.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

function AtlasPreview({ atlas, scale = 1, fit = false }: { atlas: SavedRealAtlas; scale?: number; fit?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const source = realAtlasStore.getCanvas(atlas);
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
  }, [atlas]);
  return (
    <canvas
      ref={ref}
      className={cn("pixelated block", fit && "mx-auto max-h-full max-w-full object-contain")}
      style={fit ? { imageRendering: "pixelated", width: "auto", height: "100%" } : { imageRendering: "pixelated", width: atlas.width * scale, height: atlas.height * scale }}
      aria-label={`Atlas real ${atlas.primary} + ${atlas.secondary}`}
    />
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono">{value}</dd></div>;
}

function CenteredStatus({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="grid min-h-[50vh] place-items-center text-center"><div className="max-w-sm"><div className="mx-auto mb-3 grid place-items-center text-muted-foreground">{icon}</div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></div></div>;
}
