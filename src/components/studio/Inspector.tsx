import { editorStore, useEditor } from "@/lib/editorStore";
import { METATILE_BY_ID } from "@/lib/demoAtlas";
import {
  METATILE_MASK,
  PHYSICAL_MASK,
  getCollision,
  getElevation,
  hex,
  rawValue,
} from "@/lib/emeraldMap";

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={mono ? "max-w-[170px] truncate font-mono text-[11px]" : "max-w-[170px] truncate text-[11px]"} title={value}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-3 py-2">
      <h3 className="panel-title mb-1">{title}</h3>
      {children}
    </section>
  );
}

export function Inspector() {
  const state = useEditor();
  const metadata = state.mapMetadata;
  const i = state.selectedCell;
  const width = state.map.width;
  const x = i != null ? i % width : null;
  const y = i != null ? Math.floor(i / width) : null;
  const id = i != null ? (state.map.metatiles[i] ?? 0) : null;
  const phys = i != null ? (state.map.physical[i] ?? 0) : 0;
  const raw = i != null ? rawValue(state.map, i) : 0;
  const tile = id != null ? METATILE_BY_ID.get(id) : undefined;
  const prot = x != null && y != null ? state.protectedCells.find((cell) => cell.x === x && cell.y === y) : undefined;
  const cellEvents =
    x != null && y != null ? state.events.filter((event) => event.x === x && event.y === y) : [];

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel">
      <div className="border-b border-border px-3 py-2">
        <span className="panel-title">Propriedades</span>
      </div>

      <Section title="Mapa">
        <Row label="Nome" value={state.mapName} mono={false} />
        <Row label="Dimensão" value={`${state.map.width} × ${state.map.height}`} />
        <Row label="Células" value={String(state.map.metatiles.length)} />
        <Row label="Bytes ao exportar" value={`${state.map.metatiles.length * 2}`} />
        <Row label="map.bin" value={state.sourceFile ?? "não importado"} mono={false} />
        <Row label="map.json" value={state.mapJsonSource ?? "não importado"} mono={false} />
        <Row label="Alterações" value={state.dirty ? "não salvas" : "nenhuma"} mono={false} />
      </Section>

      <Section title="Metadados pokeemerald">
        {!metadata ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Importe <b>data/maps/.../map.json</b> para carregar warps, NPCs, triggers, BG events e conexões reais.
          </p>
        ) : (
          <>
            <Row label="Map ID" value={metadata.id} />
            <Row label="Name" value={metadata.name} />
            <Row label="Layout" value={metadata.layout} />
            <Row label="Music" value={metadata.music ?? "—"} />
            <Row label="Map type" value={metadata.mapType ?? "—"} />
            <Row label="Region" value={metadata.regionMapSection ?? "—"} />
            <Row label="Warps" value={String(metadata.counts.warps)} />
            <Row label="NPCs" value={String(metadata.counts.objects)} />
            <Row label="Coord events" value={String(metadata.counts.coordEvents)} />
            <Row label="BG events" value={String(metadata.counts.bgEvents)} />
            <Row label="Conexões" value={String(metadata.connections.length)} />
            {metadata.connections.map((connection, index) => (
              <div key={`${connection.direction}-${connection.map}-${index}`} className="mt-1 rounded-sm bg-surface px-1.5 py-1 font-mono text-[9px] text-muted-foreground">
                {connection.direction} → {connection.map} · offset {connection.offset}
              </div>
            ))}
          </>
        )}
      </Section>

      <Section title="Célula selecionada">
        {i == null ? (
          <p className="text-[11px] text-muted-foreground">
            Clique numa célula do mapa para inspecionar.
          </p>
        ) : (
          <>
            <Row label="X" value={String(x)} />
            <Row label="Y" value={String(y)} />
            <Row label="Índice" value={String(i)} />
            <Row label="Metatile ID" value={`${id} · ${hex(id ?? 0, 3)}`} />
            <Row label="Nome (atlas demo)" value={tile?.name ?? "—"} mono={false} />
            <Row label="Valor bruto" value={hex(raw)} />
            <Row label="Bits físicos" value={hex(phys)} />
            <Row label="Colisão" value={`${getCollision(phys)}`} />
            <Row label="Elevação" value={`${getElevation(phys)}`} />
            <Row label="Offset no .bin" value={`${i * 2} (0x${(i * 2).toString(16).toUpperCase()})`} />
          </>
        )}
      </Section>

      <Section title="Máscaras">
        <Row label="Metatile" value={hex(METATILE_MASK)} />
        <Row label="Físico" value={hex(PHYSICAL_MASK)} />
        <Row label="Ordem" value="uint16 little-endian" mono={false} />
      </Section>

      <Section title="Proteção de progressão">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {metadata ? "derivada do map.json" : "sem map.json"}
          </span>
          <button
            type="button"
            onClick={editorStore.toggleProtect}
            className={
              "rounded-sm border px-2 py-0.5 text-[10px] font-semibold " +
              (state.protectProgression
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground")
            }
          >
            {state.protectProgression ? "LIGADO" : "DESLIGADO"}
          </button>
        </div>
        {state.protectedCells.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma célula protegida carregada.</p>
        ) : (
          <ul className="space-y-0.5">
            {state.protectedCells.map((cell) => (
              <li
                key={`${cell.x},${cell.y}`}
                className={
                  "flex items-baseline justify-between gap-2 rounded-sm px-1 py-0.5 " +
                  (prot && prot.x === cell.x && prot.y === cell.y ? "bg-surface" : "")
                }
                title={cell.reason}
              >
                <span className="font-mono text-[11px]">
                  ({cell.x},{cell.y})
                </span>
                <span className="truncate text-[10px] text-muted-foreground">{cell.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Eventos nesta célula">
        {cellEvents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum evento.</p>
        ) : (
          <ul className="space-y-1">
            {cellEvents.map((event, eventIndex) => (
              <li key={`${event.label}-${eventIndex}`} className="rounded-sm bg-surface px-1.5 py-1">
                <p className="font-mono text-[10px] text-primary">
                  {event.label} · {event.source ?? event.kind}
                </p>
                <p className="break-words text-[10px] leading-relaxed text-muted-foreground">{event.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {state.selection && (
        <Section title="Seleção">
          <Row
            label="Retângulo"
            value={`x${state.selection.x} y${state.selection.y} · ${state.selection.w}×${state.selection.h}`}
          />
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={editorStore.fillSelection}
              className="rounded-sm border border-border px-2 py-0.5 text-[10px] hover:bg-surface"
            >
              Preencher com metatile
            </button>
            <button
              type="button"
              onClick={() => editorStore.setSelection(null)}
              className="rounded-sm border border-border px-2 py-0.5 text-[10px] hover:bg-surface"
            >
              Limpar
            </button>
          </div>
        </Section>
      )}
    </aside>
  );
}
