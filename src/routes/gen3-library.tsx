import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Gamepad2, Loader2, Search } from "lucide-react";
import {
  GEN3_SOURCES,
  discoverGen3Pairs,
  loadGen3RemotePair,
  remoteMetatileAttribute,
  remoteMetatileIds,
  renderGen3RemoteMetatile,
  type Gen3RemotePair,
  type Gen3Source,
  type Gen3TilesetPairRef,
} from "@/lib/gen3RemoteTilesets";
import { editorStore } from "@/lib/editorStore";
import { realAtlasStore, useRealAtlas } from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gen3-library")({ component: Gen3Library });

function Gen3Library() {
  const [sourceId, setSourceId] = useState(GEN3_SOURCES[0]!.id);
  const [pairs, setPairs] = useState<Gen3TilesetPairRef[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Gen3TilesetPairRef | null>(null);
  const [loaded, setLoaded] = useState<Gen3RemotePair | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Carregando catálogo Gen III…");
  const activeAtlas = useRealAtlas();
  const source = GEN3_SOURCES.find((item) => item.id === sourceId) ?? GEN3_SOURCES[0]!;

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setLoaded(null);
    setSelected(null);
    setMessage(`Lendo os pares de tilesets reais de ${source.label}…`);
    void discoverGen3Pairs(source)
      .then((next) => {
        if (cancelled) return;
        setPairs(next);
        setSelected(next[0] ?? null);
        setMessage(`${next.length} pares primary + secondary encontrados em ${source.owner}/${source.repo}.`);
      })
      .catch((error) => {
        if (cancelled) return;
        setPairs([]);
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [sourceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter((pair) => [
      pair.primarySymbol,
      pair.secondarySymbol,
      pair.primaryDir,
      pair.secondaryDir,
    ].some((value) => value.toLowerCase().includes(q)));
  }, [pairs, query]);

  const loadSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setLoaded(null);
    setMessage(`Reconstruindo ${selected.primarySymbol} + ${selected.secondarySymbol}…`);
    try {
      const pair = await loadGen3RemotePair(source, selected);
      setLoaded(pair);
      setMessage(
        `${source.profile.label}: ${pair.primaryMetatiles.count} primary + ${pair.secondaryMetatiles.count} secondary metatiles reais.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const installEmeraldPair = () => {
    if (!loaded || source.id !== "emerald") return;
    const atlas = realAtlasStore.savePair(loaded, 16, {
      primary: loaded.primarySymbol,
      secondary: loaded.secondarySymbol,
      origin: `${source.owner}/${source.repo}@${source.ref}`,
      game: source.profile.label,
    });
    const confirmation = `${atlas.primary} + ${atlas.secondary} agora é o atlas real ativo do editor.`;
    setMessage(confirmation);
    editorStore.setMessage(confirmation);
  };

  const loadedIsActive = Boolean(
    loaded &&
    activeAtlas?.primary === loaded.primarySymbol &&
    activeAtlas?.secondary === loaded.secondarySymbol,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface">
          <ArrowLeft className="size-3.5" /> Editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Biblioteca Gen III — tiles reais do GBA</h1>
          <p className="text-[10px] text-muted-foreground">Emerald · Ruby/Sapphire · FireRed/LeafGreen · dados dos decomps pret</p>
        </div>
        <div className="ml-auto rounded border border-success/30 bg-success/10 px-2 py-1 text-[10px] text-success">
          sem arte procedural
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_280px] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-border bg-panel">
          <div className="space-y-2 border-b border-border p-3">
            <label className="block text-[10px] font-medium text-muted-foreground">Jogo / família</label>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value as Gen3Source["id"])}
              className="h-8 w-full rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-primary/60"
            >
              {GEN3_SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="cidade, cave, gym, house…"
                className="h-8 w-full rounded border border-border bg-canvas pl-7 pr-2 text-xs outline-none focus:border-primary/60"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.map((pair) => {
              const active = selected?.primaryDir === pair.primaryDir && selected?.secondaryDir === pair.secondaryDir;
              return (
                <button
                  key={`${pair.primaryDir}|${pair.secondaryDir}`}
                  type="button"
                  onClick={() => { setSelected(pair); setLoaded(null); }}
                  className={cn(
                    "mb-1 block w-full rounded border p-2 text-left transition-colors",
                    active ? "border-primary/50 bg-primary/10" : "border-border bg-canvas hover:bg-surface",
                  )}
                >
                  <div className="truncate text-[10px] font-semibold">{pair.secondarySymbol}</div>
                  <div className="mt-0.5 truncate font-mono text-[8px] text-muted-foreground">+ {pair.primarySymbol}</div>
                  <div className="mt-1 text-[8px] text-muted-foreground">
                    {pair.usageCount ? `${pair.usageCount} layout(s) usam este par` : "par descoberto"}
                  </div>
                </button>
              );
            })}
            {!filtered.length && !busy && <p className="p-4 text-center text-xs text-muted-foreground">Nenhum par encontrado.</p>}
          </div>

          <div className="border-t border-border p-3">
            <button
              type="button"
              disabled={!selected || busy}
              onClick={() => void loadSelected()}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-primary/50 bg-primary/15 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Gamepad2 className="size-4" />}
              Abrir tiles reais
            </button>
          </div>
        </aside>

        <section className="min-w-0 overflow-auto bg-canvas p-4">
          {!loaded ? (
            <div className="grid h-full min-h-[360px] place-items-center text-center text-muted-foreground">
              <div className="max-w-md">
                {busy ? <Loader2 className="mx-auto mb-3 size-10 animate-spin opacity-50" /> : <Gamepad2 className="mx-auto mb-3 size-10 opacity-40" />}
                <p className="text-sm">Escolha um par primary + secondary.</p>
                <p className="mt-1 text-xs leading-relaxed">O Studio baixa tiles.png, paletas, metatiles.bin e atributos do decomp e reconstrói os metatiles 16×16 em cores reais.</p>
              </div>
            </div>
          ) : (
            <MetatileGallery pair={loaded} />
          )}
        </section>

        <aside className="overflow-y-auto border-l border-border bg-panel p-3">
          <h2 className="panel-title mb-2">Status</h2>
          <p className="rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed">{message}</p>

          <section className="mt-3 rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">{source.profile.label}</b><br />
            primary tiles/metatiles: {source.profile.primaryTileLimit}<br />
            secondary: {1024 - source.profile.primaryTileLimit}<br />
            paletas primary: {source.profile.primaryPaletteCount}<br />
            paletas secondary: {source.profile.totalPaletteCount - source.profile.primaryPaletteCount}<br />
            atributos: {source.profile.attributeBytes} byte(s) / metatile
          </section>

          {loaded && source.id === "emerald" ? (
            <section className="mt-3 rounded border border-success/40 bg-success/5 p-2">
              <p className="text-[9px] leading-relaxed text-muted-foreground">
                Este par é nativo de Emerald, portanto pode ser usado diretamente como atlas visual do editor de Arauna.
              </p>
              <button
                type="button"
                disabled={loadedIsActive}
                onClick={installEmeraldPair}
                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border border-success/50 bg-success/10 px-2 text-[10px] font-semibold text-success hover:bg-success/15 disabled:opacity-55"
              >
                {loadedIsActive ? <><Check className="size-3.5" /> Ativo no editor</> : "Usar este par no editor"}
              </button>
              {loadedIsActive && (
                <Link to="/" className="mt-1.5 inline-flex h-7 w-full items-center justify-center rounded border border-border text-[10px] hover:bg-surface">
                  Voltar ao editor
                </Link>
              )}
            </section>
          ) : (
            <section className="mt-3 rounded border border-warning/30 bg-warning/5 p-2 text-[9px] leading-relaxed text-warning">
              <b>Biblioteca visual ≠ conversão automática.</b> Arauna é baseado em Emerald. Tiles de FireRed/LeafGreen e Ruby/Sapphire podem ser estudados aqui, mas não são instalados como IDs do mapa: primeiro precisam ser convertidos para um tileset Emerald do projeto.
            </section>
          )}

          {source.id === "emerald" && !loaded && (
            <section className="mt-3 rounded border border-success/30 bg-success/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
              Carregue qualquer par Emerald desta lista para poder torná-lo o atlas ativo do editor.
            </section>
          )}

          <section className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
            Fonte de dados: <b className="text-foreground">{source.owner}/{source.repo}@{source.ref}</b>. Os arquivos são buscados em tempo de execução; o Studio não guarda um pacote refeito de sprites no repositório.
          </section>
        </aside>
      </main>
    </div>
  );
}

function MetatileGallery({ pair }: { pair: Gen3RemotePair }) {
  const ids = useMemo(() => remoteMetatileIds(pair), [pair]);
  return (
    <div className="mx-auto w-fit max-w-full">
      <div className="mb-3 flex items-center justify-between gap-4 text-[10px] text-muted-foreground">
        <div>
          <b className="text-foreground">{pair.primarySymbol}</b> + <b className="text-foreground">{pair.secondarySymbol}</b>
        </div>
        <span>{ids.length} metatiles</span>
      </div>
      <div className="grid grid-cols-[repeat(16,40px)] gap-px bg-border p-px shadow-2xl">
        {ids.map((id) => <MetatileCell key={id} pair={pair} id={id} />)}
      </div>
    </div>
  );
}

function MetatileCell({ pair, id }: { pair: Gen3RemotePair; id: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const image = useMemo(() => renderGen3RemoteMetatile(pair, id), [pair, id]);
  const attr = remoteMetatileAttribute(pair, id);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(image, 0, 0);
  }, [image]);
  return (
    <div
      title={`ID ${id} · 0x${id.toString(16).toUpperCase().padStart(3, "0")}${attr ? ` · behavior 0x${attr.behavior.toString(16).toUpperCase()} · layer ${attr.layerType}` : ""}`}
      className="relative size-10 overflow-hidden bg-background hover:z-10 hover:outline hover:outline-1 hover:outline-primary"
    >
      <canvas ref={ref} className="pixelated size-10" />
      <span className="absolute bottom-0 right-0 bg-background/80 px-0.5 font-mono text-[7px] text-foreground/80">{id}</span>
    </div>
  );
}
