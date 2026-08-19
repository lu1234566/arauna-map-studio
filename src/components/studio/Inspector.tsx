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
      <span className={mono ? "font-mono text-[11px]" : "text-[11px]"}>{value}</span>
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
  const i = state.selectedCell;
  const width = state.map.width;
  const x = i != null ? i % width : null;
  const y = i != null ? Math.floor(i / width) : null;
  const id = i != null ? (state.map.metatiles[i] ?? 0) : null;
  const phys = i != null ? (state.map.physical[i] ?? 0) : 0;
  const raw = i != null ? rawValue(state.map, i) : 0;
  const tile = id != null ? METATILE_BY_ID.get(id) : undefined;
  const prot = x != null && y != null ? state.protectedCells.find((c) => c.x === x && c.y === y) : undefined;
  const cellEvents =
    x != null && y != null ? state.events.filter((e) => e.x === x && e.y === y) : [];

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
        <Row label="Origem" value={state.sourceFile ?? "novo (sem arquivo)"} mono={false} />
        <Row label="Alterações" value={state.dirty ? "não salvas" : "nenhuma"} mono={false} />
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
            <Row label="Nome (demo)" value={tile?.name ?? "—"} mono={false} />
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
          <span className="text-[11px] text-muted-foreground">Toggle</span>
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
        <ul className="space-y-0.5">
          {state.protectedCells.map((c) => (
            <li
              key={`${c.x},${c.y}`}
              className={
                "flex items-baseline justify-between gap-2 rounded-sm px-1 py-0.5 " +
                (prot && prot.x === c.x && prot.y === c.y ? "bg-surface" : "")
              }
            >
              <span className="font-mono text-[11px]">
                ({c.x},{c.y})
              </span>
              <span className="truncate text-[10px] text-muted-foreground">{c.reason}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Eventos nesta célula (demo)">
        {cellEvents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum evento.</p>
        ) : (
          <ul className="space-y-1">
            {cellEvents.map((e) => (
              <li key={e.label} className="rounded-sm bg-surface px-1.5 py-1">
                <p className="font-mono text-[10px] text-primary">
                  {e.label} · {e.kind}
                </p>
                <p className="text-[10px] text-muted-foreground">{e.detail}</p>
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
