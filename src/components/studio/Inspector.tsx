import { useEffect, useState } from "react";
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
import {
  eventRecord,
  eventSourceLabel,
  type EditableEventSource,
} from "@/lib/eventMapJson";
import { realAtlasStore, useRealAtlas } from "@/lib/realAtlasStore";

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={mono ? "max-w-[170px] truncate font-mono text-[11px]" : "max-w-[170px] truncate text-[11px]"}
        title={value}
      >
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

function EventField({
  eventId,
  field,
  label,
  value,
}: {
  eventId: string;
  field: string;
  label: string;
  value: unknown;
}) {
  const textValue = value == null ? "" : String(value);
  const [draft, setDraft] = useState(textValue);
  useEffect(() => setDraft(textValue), [textValue]);

  const commit = () => {
    if (draft === textValue) return;
    editorStore.updateEventField(eventId, field, draft);
  };

  return (
    <label className="block py-0.5">
      <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          }
        }}
        className="h-7 w-full rounded-sm border border-border bg-canvas px-1.5 font-mono text-[10px] outline-none focus:border-primary/60"
      />
    </label>
  );
}

const EVENT_FIELDS: Record<EditableEventSource, Array<{ key: string; label: string }>> = {
  warp: [
    { key: "x", label: "X" },
    { key: "y", label: "Y" },
    { key: "elevation", label: "Elevation" },
    { key: "dest_map", label: "Destination map" },
    { key: "dest_warp_id", label: "Destination warp" },
  ],
  object: [
    { key: "local_id", label: "Local ID" },
    { key: "graphics_id", label: "Graphics ID" },
    { key: "x", label: "X" },
    { key: "y", label: "Y" },
    { key: "elevation", label: "Elevation" },
    { key: "movement_type", label: "Movement type" },
    { key: "movement_range_x", label: "Movement range X" },
    { key: "movement_range_y", label: "Movement range Y" },
    { key: "trainer_type", label: "Trainer type" },
    { key: "trainer_sight_or_berry_tree_id", label: "Trainer/Berry ID" },
    { key: "script", label: "Script" },
    { key: "flag", label: "Flag" },
  ],
  coord: [
    { key: "type", label: "Type" },
    { key: "x", label: "X" },
    { key: "y", label: "Y" },
    { key: "elevation", label: "Elevation" },
    { key: "var", label: "Variable" },
    { key: "var_value", label: "Variable value" },
    { key: "script", label: "Script" },
  ],
  bg: [
    { key: "type", label: "Type" },
    { key: "x", label: "X" },
    { key: "y", label: "Y" },
    { key: "elevation", label: "Elevation" },
    { key: "player_facing_dir", label: "Player facing" },
    { key: "script", label: "Script" },
  ],
};

function AddEventButtons({ viewMode }: { viewMode: string }) {
  const buttonClass =
    "rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/15";
  if (viewMode === "warps") {
    return <button type="button" className={buttonClass} onClick={() => editorStore.createEvent("warp")}>+ Warp</button>;
  }
  if (viewMode === "npcs") {
    return <button type="button" className={buttonClass} onClick={() => editorStore.createEvent("object")}>+ NPC/Objeto</button>;
  }
  if (viewMode === "triggers") {
    return (
      <>
        <button type="button" className={buttonClass} onClick={() => editorStore.createEvent("coord")}>+ Trigger</button>
        <button type="button" className={buttonClass} onClick={() => editorStore.createEvent("bg")}>+ BG event</button>
      </>
    );
  }
  return null;
}

export function Inspector() {
  const state = useEditor();
  const atlas = useRealAtlas();
  const metadata = state.mapMetadata;
  const i = state.selectedCell;
  const width = state.map.width;
  const x = i != null ? i % width : null;
  const y = i != null ? Math.floor(i / width) : null;
  const id = i != null ? (state.map.metatiles[i] ?? 0) : null;
  const phys = i != null ? (state.map.physical[i] ?? 0) : 0;
  const raw = i != null ? rawValue(state.map, i) : 0;
  const demoTile = id != null ? METATILE_BY_ID.get(id) : undefined;
  const realTile = atlas && id != null ? realAtlasStore.recordFor(id, atlas) : undefined;
  const prot = x != null && y != null
    ? state.protectedCells.find((cell) => cell.x === x && cell.y === y)
    : undefined;
  const cellEvents = x != null && y != null
    ? state.events.filter((event) => event.x === x && event.y === y)
    : [];
  const eventLayer =
    state.viewMode === "warps" || state.viewMode === "npcs" || state.viewMode === "triggers";
  const editableLayer =
    state.viewMode === "visual" ||
    state.viewMode === "collision" ||
    state.viewMode === "elevation" ||
    (eventLayer && Boolean(state.mapJsonDocument));

  const selectionFillLabel =
    state.viewMode === "collision"
      ? `Aplicar colisão ${state.selectedCollision}`
      : state.viewMode === "elevation"
        ? `Aplicar elevação ${state.selectedElevation}`
        : "Aplicar metatile";

  const selectedEntry =
    state.mapJsonDocument && state.selectedEventId
      ? eventRecord(state.mapJsonDocument, state.selectedEventId)
      : null;
  const selectedEvent = state.selectedEventId
    ? state.events.find((event) => event.id === state.selectedEventId)
    : undefined;

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
        <Row label="Atlas gráfico" value={atlas ? `${atlas.primary} + ${atlas.secondary}` : "DEMO"} mono={false} />
        <Row label="map.bin alterado" value={state.dirty ? "SIM" : "não"} mono={false} />
        <Row label="map.json alterado" value={state.mapJsonDirty ? "SIM" : "não"} mono={false} />
      </Section>

      <Section title="Edição atual">
        <Row label="Camada" value={state.viewMode} mono={false} />
        <Row label="Modo" value={editableLayer ? "editável" : "somente leitura"} mono={false} />
        {state.viewMode === "visual" && (
          <Row label="Metatile ativo" value={`${state.selectedMetatile} · ${hex(state.selectedMetatile, 3)}`} />
        )}
        {state.viewMode === "collision" && <Row label="Colisão ativa" value={String(state.selectedCollision)} />}
        {state.viewMode === "elevation" && <Row label="Elevação ativa" value={String(state.selectedElevation)} />}
        {eventLayer && (
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Clique num evento para selecionar. Arraste no canvas para mover. Use os campos abaixo para editar o map.json.
          </p>
        )}
      </Section>

      {eventLayer && (
        <Section title="Editor de eventos">
          {!state.mapJsonDocument ? (
            <p className="text-[10px] leading-relaxed text-warning">
              Abra um map.json real pelo Workspace para habilitar criação e edição.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-1">
                <AddEventButtons viewMode={state.viewMode} />
              </div>
              {selectedEntry && selectedEvent ? (
                <div className="rounded border border-primary/30 bg-primary/5 p-2">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[10px] font-semibold text-primary">
                        {selectedEvent.label} · {selectedEntry.source}:{selectedEntry.index}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {eventSourceLabel(selectedEntry.source)} · ({selectedEvent.x},{selectedEvent.y})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => editorStore.removeEvent(selectedEvent.id)}
                      className="shrink-0 rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive hover:bg-destructive/15"
                    >
                      Excluir
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    {EVENT_FIELDS[selectedEntry.source].map((field) => (
                      <EventField
                        key={`${selectedEvent.id}-${field.key}`}
                        eventId={selectedEvent.id}
                        field={field.key}
                        label={field.label}
                        value={selectedEntry.record[field.key]}
                      />
                    ))}
                  </div>

                  {Object.entries(selectedEntry.record).some(
                    ([key]) => !EVENT_FIELDS[selectedEntry.source].some((field) => field.key === key),
                  ) && (
                    <details className="mt-2 rounded-sm border border-border bg-canvas p-1.5">
                      <summary className="cursor-pointer text-[9px] text-muted-foreground">Campos extras preservados</summary>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(selectedEntry.record)
                          .filter(([key]) => !EVENT_FIELDS[selectedEntry.source].some((field) => field.key === key))
                          .map(([key, value]) => (
                            <Row key={key} label={key} value={typeof value === "string" ? value : JSON.stringify(value)} />
                          ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Nenhum evento selecionado. Você também pode clicar em uma célula vazia e criar um novo evento nela.
                </p>
              )}
            </>
          )}
        </Section>
      )}

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
              <div
                key={`${connection.direction}-${connection.map}-${index}`}
                className="mt-1 rounded-sm bg-surface px-1.5 py-1 font-mono text-[9px] text-muted-foreground"
              >
                {connection.direction} → {connection.map} · offset {connection.offset}
              </div>
            ))}
          </>
        )}
      </Section>

      <Section title="Célula selecionada">
        {i == null ? (
          <p className="text-[11px] text-muted-foreground">Clique numa célula do mapa para inspecionar.</p>
        ) : (
          <>
            <Row label="X" value={String(x)} />
            <Row label="Y" value={String(y)} />
            <Row label="Índice" value={String(i)} />
            <Row label="Metatile ID" value={`${id} · ${hex(id ?? 0, 3)}`} />
            {realTile ? (
              <>
                <Row label="Atlas" value="REAL" mono={false} />
                <Row label="Origem" value={`${realTile.source} · local ${realTile.localId}`} />
                <Row label="Behavior" value={realTile.behavior == null ? "—" : hex(realTile.behavior, 2)} />
                <Row label="Layer type" value={realTile.layerType == null ? "—" : String(realTile.layerType)} />
              </>
            ) : (
              <Row label="Nome (fallback)" value={demoTile?.name ?? "—"} mono={false} />
            )}
            <Row label="Valor bruto" value={hex(raw)} />
            <Row label="Bits físicos" value={hex(phys)} />
            <Row label="Colisão" value={`${getCollision(phys)}`} />
            <Row label="Elevação" value={`${getElevation(phys)}`} />
            <Row label="Offset no .bin" value={`${i * 2} (0x${(i * 2).toString(16).toUpperCase()})`} />
          </>
        )}
      </Section>

      <Section title="Eventos nesta célula">
        {cellEvents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum evento.</p>
        ) : (
          <ul className="space-y-1">
            {cellEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => editorStore.selectEvent(event.id)}
                  className={
                    "w-full rounded-sm border px-1.5 py-1 text-left " +
                    (state.selectedEventId === event.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent bg-surface hover:border-border")
                  }
                >
                  <p className="font-mono text-[10px] text-primary">{event.label} · {event.source}</p>
                  <p className="break-words text-[10px] leading-relaxed text-muted-foreground">{event.detail}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Máscaras">
        <Row label="Metatile" value={hex(METATILE_MASK)} />
        <Row label="Físico" value={hex(PHYSICAL_MASK)} />
        <Row label="Colisão" value="0x0C00 · bits 10–11" />
        <Row label="Elevação" value="0xF000 · bits 12–15" />
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
                <span className="font-mono text-[11px]">({cell.x},{cell.y})</span>
                <span className="truncate text-[10px] text-muted-foreground">{cell.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {state.selection && !eventLayer && (
        <Section title="Seleção">
          <Row
            label="Retângulo"
            value={`x${state.selection.x} y${state.selection.y} · ${state.selection.w}×${state.selection.h}`}
          />
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={editorStore.fillSelection}
              disabled={!editableLayer}
              className="rounded-sm border border-border px-2 py-0.5 text-[10px] hover:bg-surface disabled:opacity-35"
            >
              {selectionFillLabel}
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
