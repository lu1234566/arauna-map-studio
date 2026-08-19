import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, FolderOpen, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import {
  PRIMARY_METATILE_LIMIT,
  atlasRecords,
  combineOverworldPalettes,
  decodeIndexedTilesPng,
  parseJascPalette,
  parseMetatileAttributes,
  parseMetatilesBin,
  renderAtlasCanvas,
  renderMetatileImage,
  validateTilesetPair,
  type RenderTilesetPair,
  type RgbColor,
} from "@/lib/emeraldTileset";
import { realAtlasStore, useRealAtlas } from "@/lib/realAtlasStore";

export const Route = createFileRoute("/tilesets")({ component: TilesetLab });

type Side = "primary" | "secondary";
interface SideFiles {
  tiles: File | null;
  metatiles: File | null;
  attributes: File | null;
  palettes: File[];
}
const emptySide = (): SideFiles => ({ tiles: null, metatiles: null, attributes: null, palettes: [] });

function TilesetLab() {
  const [primary, setPrimary] = useState<SideFiles>(emptySide);
  const [secondary, setSecondary] = useState<SideFiles>(emptySide);
  const [pair, setPair] = useState<RenderTilesetPair | null>(null);
  const [message, setMessage] = useState(
    "Carregue General (primary) e Petalburg (secondary). Tudo é processado localmente no navegador.",
  );
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(0);
  const savedAtlas = useRealAtlas();

  const records = useMemo(() => (pair ? atlasRecords(pair) : []), [pair]);
  const warnings = useMemo(() => (pair ? validateTilesetPair(pair) : []), [pair]);

  const update = (side: Side, patch: Partial<SideFiles>) => {
    if (side === "primary") setPrimary((current) => ({ ...current, ...patch }));
    else setSecondary((current) => ({ ...current, ...patch }));
    setPair(null);
  };

  const build = async () => {
    if (!primary.tiles || !primary.metatiles || !secondary.tiles || !secondary.metatiles) {
      setMessage("Faltam arquivos obrigatórios: tiles.png e metatiles.bin dos dois tilesets.");
      return;
    }
    setBusy(true);
    try {
      const [primaryTiles, secondaryTiles, primaryMetatiles, secondaryMetatiles] = await Promise.all([
        decodeIndexedTilesPng(primary.tiles),
        decodeIndexedTilesPng(secondary.tiles),
        primary.metatiles.arrayBuffer().then(parseMetatilesBin),
        secondary.metatiles.arrayBuffer().then(parseMetatilesBin),
      ]);
      const primaryPalettes = await readPalettes(primary.palettes);
      const secondaryPalettes = await readPalettes(secondary.palettes);
      const primaryAttributes = primary.attributes
        ? parseMetatileAttributes(await primary.attributes.arrayBuffer())
        : undefined;
      const secondaryAttributes = secondary.attributes
        ? parseMetatileAttributes(await secondary.attributes.arrayBuffer())
        : undefined;
      const next: RenderTilesetPair = {
        primaryTiles,
        secondaryTiles,
        primaryMetatiles,
        secondaryMetatiles,
        primaryAttributes,
        secondaryAttributes,
        palettes: combineOverworldPalettes(primaryPalettes, secondaryPalettes),
      };
      setPair(next);
      setSelectedId(0);
      const issues = validateTilesetPair(next);
      const saved = realAtlasStore.savePair(next, 16);
      setMessage(
        `Atlas montado e salvo no editor: ${saved.records.length} metatiles (${primaryMetatiles.count} primary + ${secondaryMetatiles.count} secondary).` +
          (issues.length ? ` ${issues.length} aviso(s).` : " Sem avisos."),
      );
    } catch (error) {
      setPair(null);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const exportPng = async () => {
    if (!pair) return;
    const canvas = renderAtlasCanvas(pair, 16);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) downloadBlob(blob, "general-petalburg-metatiles.png");
  };

  const exportJson = () => {
    if (!pair) return;
    const payload = {
      format: "arauna-metatile-atlas-v1",
      primary: "gTileset_General",
      secondary: "gTileset_Petalburg",
      tileSize: 8,
      metatileSize: 16,
      primaryTileOffset: 0,
      secondaryTileOffset: 512,
      secondaryMetatileOffset: PRIMARY_METATILE_LIMIT,
      palettes: pair.palettes.map((palette) => palette ?? null),
      records: atlasRecords(pair),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      "general-petalburg-metatiles.json",
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface">
          <ArrowLeft className="size-3.5" /> Editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Tileset Lab — General + Petalburg</h1>
          <p className="text-[10px] text-muted-foreground">Gerador local de atlas real para pokeemerald</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {savedAtlas && (
            <span className="mr-2 rounded border border-success/30 bg-success/10 px-2 py-1 text-[10px] text-success">
              Atlas ativo · {savedAtlas.records.length} IDs
            </span>
          )}
          <button type="button" onClick={() => void build()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 text-xs text-primary hover:bg-primary/15 disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> Montar e usar
          </button>
          <button type="button" disabled={!pair} onClick={() => void exportPng()} className="inline-flex h-8 items-center gap-1.5 rounded border border-border px-2 text-xs hover:bg-surface disabled:opacity-30">
            <Download className="size-3.5" /> PNG
          </button>
          <button type="button" disabled={!pair} onClick={exportJson} className="inline-flex h-8 items-center gap-1.5 rounded border border-border px-2 text-xs hover:bg-surface disabled:opacity-30">
            <Download className="size-3.5" /> JSON
          </button>
          <button type="button" disabled={!savedAtlas} onClick={() => realAtlasStore.clear()} title="Remover atlas real salvo" className="inline-flex h-8 items-center rounded border border-border px-2 text-xs hover:bg-surface disabled:opacity-30">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_260px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border bg-panel p-3">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Selecione os arquivos do repositório do jogo. Ao clicar em <b>Montar e usar</b>, o atlas fica salvo neste navegador e o editor principal passa a priorizá-lo sobre o atlas DEMO.
          </p>
          <FileGroup title="Primary · General" root="data/tilesets/primary/general" value={primary} onChange={(patch) => update("primary", patch)} paletteHint="Selecione 00.pal até 05.pal" />
          <FileGroup title="Secondary · Petalburg" root="data/tilesets/secondary/petalburg" value={secondary} onChange={(patch) => update("secondary", patch)} paletteHint="Selecione 06.pal até 12.pal" />
          <div className="mt-3 rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">Regra Emerald:</b><br />512 tiles/metatiles pertencem ao primary. O secondary começa no ID 512 e pode reutilizar tiles do primary. As paletas 0–5 vêm do primary; 6–12, do secondary.
          </div>
        </aside>

        <section className="min-w-0 overflow-auto bg-canvas p-4">
          {!pair ? (
            <div className="grid h-full place-items-center text-center text-muted-foreground">
              <div><ImageIcon className="mx-auto mb-3 size-10 opacity-40" /><p className="text-sm">O atlas real aparecerá aqui.</p><p className="mt-1 text-xs">Carregue os arquivos à esquerda e clique em “Montar e usar”.</p></div>
            </div>
          ) : (
            <div className="mx-auto w-fit">
              <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{records.length} metatiles renderizados</span><span>16×16 px · pixel-perfect</span></div>
              <div className="grid grid-cols-16 gap-px bg-border p-px shadow-2xl">
                {records.map((record) => <MetatileButton key={record.id} pair={pair} id={record.id} selected={record.id === selectedId} onSelect={() => setSelectedId(record.id)} />)}
              </div>
            </div>
          )}
        </section>

        <aside className="overflow-y-auto border-l border-border bg-panel p-3">
          <h2 className="panel-title mb-2">Status</h2>
          <p className="rounded border border-border bg-canvas p-2 text-[11px] leading-relaxed">{message}</p>
          {warnings.length > 0 && <div className="mt-3"><h3 className="panel-title mb-1">Avisos</h3><ul className="space-y-1">{warnings.map((warning) => <li key={warning} className="rounded border border-warning/30 bg-warning/5 p-1.5 text-[10px] text-warning">{warning}</li>)}</ul></div>}
          {pair && <SelectedInfo pair={pair} id={selectedId} />}
          {savedAtlas && <div className="mt-3 rounded border border-success/30 bg-success/5 p-2 text-[10px] leading-relaxed text-success">Persistido em localStorage em {new Date(savedAtlas.createdAt).toLocaleString("pt-BR")}. Volte ao Editor para usar os gráficos reais.</div>}
        </aside>
      </main>
    </div>
  );
}

async function readPalettes(files: File[]): Promise<Map<number, RgbColor[]>> {
  const result = new Map<number, RgbColor[]>();
  for (const file of files) {
    const match = file.name.match(/^(\d{2})\.pal$/i);
    if (match) result.set(Number(match[1]), parseJascPalette(await file.text()));
  }
  return result;
}

function FileGroup({ title, root, value, onChange, paletteHint }: { title: string; root: string; value: SideFiles; onChange: (patch: Partial<SideFiles>) => void; paletteHint: string }) {
  return (
    <section className="mb-3 rounded-md border border-border bg-background/20 p-2.5">
      <div className="mb-2"><h2 className="text-xs font-semibold">{title}</h2><p className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{root}</p></div>
      <FileLine label="tiles.png" file={value.tiles} accept="image/png" onFile={(file) => onChange({ tiles: file })} />
      <FileLine label="metatiles.bin" file={value.metatiles} accept=".bin" onFile={(file) => onChange({ metatiles: file })} />
      <FileLine label="metatile_attributes.bin" file={value.attributes} accept=".bin" optional onFile={(file) => onChange({ attributes: file })} />
      <label className="mt-2 block rounded border border-dashed border-border p-2 hover:bg-surface">
        <span className="flex cursor-pointer items-center gap-1.5 text-[11px]"><FolderOpen className="size-3.5" /> Paletas .pal</span>
        <span className="mt-0.5 block text-[9px] text-muted-foreground">{value.palettes.length ? `${value.palettes.length} arquivo(s)` : paletteHint}</span>
        <input className="hidden" type="file" accept=".pal" multiple onChange={(event) => onChange({ palettes: Array.from(event.target.files ?? []) })} />
      </label>
    </section>
  );
}

function FileLine({ label, file, accept, optional, onFile }: { label: string; file: File | null; accept: string; optional?: boolean; onFile: (file: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className="mb-1 flex items-center gap-1"><button type="button" onClick={() => ref.current?.click()} className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border border-border px-2 text-left text-[10px] hover:bg-surface"><FolderOpen className="size-3 shrink-0" /><span className="min-w-0 truncate">{file?.name ?? label}</span></button>{optional && <span className="text-[8px] text-muted-foreground">opc.</span>}<input ref={ref} className="hidden" type="file" accept={accept} onChange={(event) => onFile(event.target.files?.[0] ?? null)} /></div>;
}

function MetatileButton({ pair, id, selected, onSelect }: { pair: RenderTilesetPair; id: number; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const image = useMemo(() => renderMetatileImage(pair, id), [pair, id]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 16;
    canvas.height = 16;
    canvas.getContext("2d")?.putImageData(image, 0, 0);
  }, [image]);
  return <button type="button" title={`Metatile ${id} · 0x${id.toString(16).toUpperCase().padStart(3, "0")}`} onClick={onSelect} className={`relative size-8 overflow-hidden bg-background p-0 ${selected ? "z-10 outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-foreground/60"}`}><canvas ref={ref} className="pixelated size-8" /></button>;
}

function SelectedInfo({ pair, id }: { pair: RenderTilesetPair; id: number }) {
  const source = id < PRIMARY_METATILE_LIMIT ? "primary" : "secondary";
  const localId = source === "primary" ? id : id - PRIMARY_METATILE_LIMIT;
  const attr = source === "primary" ? pair.primaryAttributes?.[localId] : pair.secondaryAttributes?.[localId];
  return <section className="mt-3 border-t border-border pt-3"><h3 className="panel-title mb-1">Selecionado</h3><dl className="space-y-1 font-mono text-[10px]"><InfoRow label="ID" value={`${id} / 0x${id.toString(16).toUpperCase().padStart(3, "0")}`} /><InfoRow label="Origem" value={source} /><InfoRow label="Local ID" value={String(localId)} /><InfoRow label="Behavior" value={attr ? `0x${attr.behavior.toString(16).toUpperCase().padStart(2, "0")}` : "—"} /><InfoRow label="Layer type" value={attr ? String(attr.layerType) : "—"} /></dl></section>;
}
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
