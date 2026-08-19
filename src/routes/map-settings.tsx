import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Cable, Check, Plus, Settings2, Trash2 } from "lucide-react";
import { editorStore, useEditor, type ConnectionDirection } from "@/lib/editorStore";

export const Route = createFileRoute("/map-settings")({ component: MapSettingsPage });

type JsonRecord = Record<string, unknown>;

const TEXT_FIELDS = [
  ["music", "Música"],
  ["region_map_section", "Seção do mapa"],
  ["weather", "Clima"],
  ["map_type", "Tipo de mapa"],
  ["battle_scene", "Cena de batalha"],
] as const;

const BOOLEAN_FIELDS = [
  ["requires_flash", "Requer Flash"],
  ["allow_cycling", "Permitir bicicleta"],
  ["allow_escaping", "Permitir escapar"],
  ["allow_running", "Permitir correr"],
  ["show_map_name", "Mostrar nome do mapa"],
] as const;

const DIRECTIONS: ConnectionDirection[] = ["up", "down", "left", "right"];

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function TextSetting({ field, label, value }: { field: string; label: string; value: unknown }) {
  const current = value == null ? "" : String(value);
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = () => {
    if (draft !== current) editorStore.updateMapSetting(field, draft);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
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
        className="h-8 w-full rounded border border-border bg-canvas px-2 font-mono text-xs outline-none focus:border-primary/60"
      />
    </label>
  );
}

function BooleanSetting({ field, label, value }: { field: string; label: string; value: unknown }) {
  const enabled = value === true;
  return (
    <button
      type="button"
      onClick={() => editorStore.updateMapSetting(field, !enabled)}
      className={
        "flex h-9 items-center justify-between rounded border px-2 text-left text-xs transition-colors " +
        (enabled
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-canvas text-muted-foreground hover:bg-surface")
      }
    >
      <span>{label}</span>
      <span className={enabled ? "text-success" : "text-muted-foreground"}>
        {enabled ? <Check className="size-4" /> : "OFF"}
      </span>
    </button>
  );
}

function ConnectionTextField({
  index,
  field,
  label,
  value,
}: {
  index: number;
  field: "map" | "offset";
  label: string;
  value: unknown;
}) {
  const current = value == null ? "" : String(value);
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = () => {
    if (draft !== current) editorStore.updateConnection(index, field, draft);
  };

  return (
    <label className="block min-w-0">
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
        className="h-7 w-full rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus:border-primary/60"
      />
    </label>
  );
}

function ConnectionCard({ index, connection }: { index: number; connection: JsonRecord }) {
  const direction = String(connection.direction ?? "up") as ConnectionDirection;
  const known = new Set(["map", "offset", "direction"]);
  const extras = Object.entries(connection).filter(([key]) => !known.has(key));

  return (
    <article className="rounded border border-border bg-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <Cable className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] font-semibold">Conexão {index}</span>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">{direction}</span>
        <button
          type="button"
          onClick={() => editorStore.removeConnection(index)}
          className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive hover:bg-destructive/15"
        >
          <Trash2 className="size-3" /> Remover
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_110px_90px]">
        <ConnectionTextField index={index} field="map" label="Mapa de destino" value={connection.map} />
        <label className="block">
          <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground">Direção</span>
          <select
            value={DIRECTIONS.includes(direction) ? direction : "up"}
            onChange={(event) => editorStore.updateConnection(index, "direction", event.target.value)}
            className="h-7 w-full rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus:border-primary/60"
          >
            {DIRECTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <ConnectionTextField index={index} field="offset" label="Offset" value={connection.offset} />
      </div>

      {extras.length > 0 && (
        <details className="mt-2 rounded-sm border border-border bg-canvas p-1.5">
          <summary className="cursor-pointer text-[9px] text-muted-foreground">Campos extras preservados ({extras.length})</summary>
          <div className="mt-1 space-y-1 font-mono text-[9px] text-muted-foreground">
            {extras.map(([key, value]) => (
              <div key={key} className="flex gap-2"><span>{key}</span><span className="ml-auto truncate">{JSON.stringify(value)}</span></div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function MapSettingsPage() {
  const state = useEditor();
  const document = state.mapJsonDocument;
  const connections = useMemo(() => {
    if (!document || !Array.isArray(document.connections)) return [];
    return document.connections.flatMap((value, index) =>
      isRecord(value) ? [{ index, connection: value }] : [],
    );
  }, [document]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
        >
          <ArrowLeft className="size-3.5" /> Editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Configurações do mapa</h1>
          <p className="text-[10px] text-muted-foreground">map.json · propriedades e conexões</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <span className="font-mono text-muted-foreground">{state.mapMetadata?.id ?? "sem map.json"}</span>
          {state.mapJsonDirty && (
            <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-warning">JSON ALTERADO *</span>
          )}
        </div>
      </header>

      {!document || !state.mapMetadata ? (
        <main className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-lg rounded border border-warning/30 bg-warning/5 p-5">
            <Settings2 className="mx-auto mb-3 size-8 text-warning" />
            <h2 className="text-sm font-semibold">Nenhum map.json carregado</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Abra um mapa pelo Workspace ou importe um map.json no editor. Esta tela altera o documento real e participa do mesmo undo/redo.
            </p>
          </div>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(520px,1.2fr)]">
          <section className="min-w-0 rounded border border-border bg-panel">
            <div className="border-b border-border px-3 py-2">
              <h2 className="panel-title">Propriedades gerais</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">ID, nome e layout ficam bloqueados aqui porque renomeá-los exige alterações em outros arquivos do repositório.</p>
            </div>

            <div className="grid gap-2 border-b border-border p-3 text-[10px]">
              <div className="flex gap-3"><span className="w-20 text-muted-foreground">ID</span><code>{state.mapMetadata.id}</code></div>
              <div className="flex gap-3"><span className="w-20 text-muted-foreground">Nome</span><code>{state.mapMetadata.name}</code></div>
              <div className="flex gap-3"><span className="w-20 text-muted-foreground">Layout</span><code>{state.mapMetadata.layout}</code></div>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {TEXT_FIELDS.map(([field, label]) => (
                <TextSetting key={field} field={field} label={label} value={document[field]} />
              ))}
            </div>

            <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {BOOLEAN_FIELDS.map(([field, label]) => (
                <BooleanSetting key={field} field={field} label={label} value={document[field]} />
              ))}
            </div>

            <div className="border-t border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
              Alterações são aplicadas ao documento em memória, marcam <b className="text-foreground">map.json</b> como alterado e podem ser desfeitas com Ctrl+Z no editor.
            </div>
          </section>

          <section className="min-w-0 rounded border border-border bg-panel">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <div>
                <h2 className="panel-title">Conexões entre mapas</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">Destino, direção e offset do array connections.</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-1">
                {DIRECTIONS.map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => editorStore.createConnection(direction)}
                    className="inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-1 text-[9px] text-primary hover:bg-primary/15"
                  >
                    <Plus className="size-3" /> {direction}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 p-3">
              {connections.map(({ index, connection }) => (
                <ConnectionCard
                  key={`${index}-${String(connection.map)}-${String(connection.direction)}`}
                  index={index}
                  connection={connection}
                />
              ))}
              {connections.length === 0 && (
                <div className="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Este mapa não possui conexões. Use os botões acima para criar uma.
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
