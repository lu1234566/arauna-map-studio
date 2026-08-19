import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ExternalLink, Layers3, Loader2, Search, X } from "lucide-react";
import { editorStore } from "@/lib/editorStore";
import {
  GEN3_SOURCES,
  discoverGen3Pairs,
  loadGen3RemotePair,
  type Gen3TilesetPairRef,
} from "@/lib/gen3RemoteTilesets";
import { realAtlasStore, type SavedRealAtlas } from "@/lib/realAtlasStore";
import { cn } from "@/lib/utils";

const EMERALD = GEN3_SOURCES.find((source) => source.id === "emerald")!;

function shortSymbol(value: string) {
  return value.replace(/^gTileset_/, "");
}

function samePair(atlas: SavedRealAtlas | null, pair: Gen3TilesetPairRef) {
  return Boolean(
    atlas &&
    atlas.primary === pair.primarySymbol &&
    atlas.secondary === pair.secondarySymbol,
  );
}

export function TilesetQuickPicker({ atlas }: { atlas: SavedRealAtlas | null }) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Gen3TilesetPairRef[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPair, setLoadingPair] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || pairs.length || busy) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void discoverGen3Pairs(EMERALD)
      .then((next) => {
        if (!cancelled) setPairs(next);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [busy, open, pairs.length]);

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

  const activatePair = async (pair: Gen3TilesetPairRef) => {
    const key = `${pair.primaryDir}|${pair.secondaryDir}`;
    if (loadingPair || samePair(atlas, pair)) return;
    setLoadingPair(key);
    setError(null);
    try {
      const loaded = await loadGen3RemotePair(EMERALD, pair);
      const installed = realAtlasStore.savePair(loaded, 16, {
        primary: loaded.primarySymbol,
        secondary: loaded.secondarySymbol,
        origin: `${EMERALD.owner}/${EMERALD.repo}@${EMERALD.ref}`,
        game: EMERALD.profile.label,
      });
      const currentId = editorStore.getState().selectedMetatile;
      if (!realAtlasStore.recordFor(currentId, installed)) {
        const first = installed.records[0];
        if (first) editorStore.setMetatile(first.id);
      }
      editorStore.setMessage(
        `Tileset ativo: ${installed.primary} + ${installed.secondary} — metatiles reais de Pokémon Emerald.`,
      );
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingPair(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded border px-2 py-2 text-left transition-colors",
          open ? "border-primary/50 bg-primary/10" : "border-border bg-canvas hover:bg-surface",
        )}
        title="Trocar o par primary + secondary sem sair do editor"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded border border-success/30 bg-success/10 text-success">
          <Layers3 className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold text-foreground">
            {atlas ? shortSymbol(atlas.secondary) : "Emerald real"}
          </span>
          <span className="block truncate font-mono text-[8px] text-muted-foreground">
            {atlas ? `+ ${shortSymbol(atlas.primary)}` : "carregando atlas…"}
          </span>
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wide text-primary">trocar</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-[calc(100%+8px)] top-0 z-50 flex h-[min(70vh,620px)] w-80 flex-col overflow-hidden rounded-md border border-border bg-panel shadow-2xl">
          <div className="flex items-start gap-2 border-b border-border bg-toolbar px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Tilesets de Pokémon Emerald</p>
              <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
                Pares reais usados pelos layouts do decomp. Selecionar um par troca a paleta do editor imediatamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-7 shrink-0 place-items-center rounded border border-border text-muted-foreground hover:bg-surface hover:text-foreground"
              title="Fechar seletor"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-2 border-b border-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                placeholder="Buscar primary / secondary…"
                className="h-8 w-full rounded border border-border bg-canvas pl-7 pr-2 text-[11px] outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
              <span>{filtered.length} par(es) Emerald</span>
              <Link to="/gen3-library" className="inline-flex items-center gap-1 text-primary hover:underline">
                Todas as famílias <ExternalLink className="size-2.5" />
              </Link>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {busy && (
              <div className="grid min-h-36 place-items-center text-center text-[10px] text-muted-foreground">
                <div><Loader2 className="mx-auto mb-2 size-5 animate-spin" />Lendo layouts reais de Emerald…</div>
              </div>
            )}

            {!busy && error && (
              <div className="rounded border border-warning/40 bg-warning/10 p-2 text-[9px] leading-relaxed text-warning">
                {error}
              </div>
            )}

            {!busy && !error && (
              <div className="space-y-1">
                {filtered.map((pair) => {
                  const key = `${pair.primaryDir}|${pair.secondaryDir}`;
                  const active = samePair(atlas, pair);
                  const loading = loadingPair === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={Boolean(loadingPair)}
                      onClick={() => void activatePair(pair)}
                      className={cn(
                        "w-full rounded border px-2 py-2 text-left transition-colors disabled:opacity-60",
                        active
                          ? "border-success/40 bg-success/10"
                          : "border-border bg-canvas hover:border-primary/30 hover:bg-surface",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[10px] font-semibold">{shortSymbol(pair.secondarySymbol)}</span>
                            {active && <span className="rounded bg-success/15 px-1 py-0.5 text-[7px] font-bold text-success">ATIVO</span>}
                          </div>
                          <p className="truncate font-mono text-[8px] text-muted-foreground">+ {shortSymbol(pair.primarySymbol)}</p>
                          <p className="mt-1 text-[8px] text-muted-foreground">{pair.usageCount} layout(s) usam este par</p>
                        </div>
                        <span className="grid size-6 shrink-0 place-items-center rounded border border-border bg-background/50 text-muted-foreground">
                          {loading ? <Loader2 className="size-3 animate-spin" /> : active ? <Check className="size-3 text-success" /> : <ChevronDown className="size-3 -rotate-90" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!busy && !error && filtered.length === 0 && (
              <p className="p-6 text-center text-[10px] text-muted-foreground">Nenhum par corresponde à busca.</p>
            )}
          </div>

          <div className="border-t border-border bg-toolbar px-3 py-2 text-[9px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">Arauna = pokeemerald.</b> Ruby/Sapphire e FireRed/LeafGreen ficam na Biblioteca Gen III como referência e não são instalados cegamente no map.bin.
          </div>
        </div>
      )}
    </div>
  );
}
