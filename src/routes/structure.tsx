import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Grid2X2,
  Loader2,
  Maximize2,
  Save,
} from "lucide-react";
import { editorStore, useEditor } from "@/lib/editorStore";
import {
  borderCellRaw,
  describeRawCell,
  parseRawCell,
  resizeMapData,
  setBorderRaw,
  type ResizeAnchor,
} from "@/lib/layoutStructure";
import { openWorkspaceMap } from "@/lib/repoWorkspace";
import {
  applyDraftLayoutToWorkspace,
  buildStructuralDraft,
  loadStructuralSource,
  structuralWrites,
  writeStructuralFiles,
  type StructuralSource,
} from "@/lib/structuralWorkspace";
import { useWorkspaceSession } from "@/lib/workspaceSession";

export const Route = createFileRoute("/structure")({ component: StructurePage });

const ANCHORS: Array<{ id: ResizeAnchor; label: string }> = [
  { id: "top-left", label: "↖" },
  { id: "top", label: "↑" },
  { id: "top-right", label: "↗" },
  { id: "left", label: "←" },
  { id: "center", label: "•" },
  { id: "right", label: "→" },
  { id: "bottom-left", label: "↙" },
  { id: "bottom", label: "↓" },
  { id: "bottom-right", label: "↘" },
];

function download(data: string | ArrayBuffer, fileName: string) {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: "application/json;charset=utf-8" })
      : new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeDownloadName(path: string) {
  return path.replace(/[\\/]+/g, "__");
}

function StructurePage() {
  const navigate = useNavigate();
  const session = useWorkspaceSession();
  const editor = useEditor();
  const [source, setSource] = useState<StructuralSource | null>(null);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(20);
  const [anchor, setAnchor] = useState<ResizeAnchor>("top-left");
  const [fillRaw, setFillRaw] = useState("0x0000");
  const [borderRaw, setBorderRawValues] = useState<string[]>([
    "0x0000",
    "0x0000",
    "0x0000",
    "0x0000",
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Carregando estrutura do mapa…");
  const [error, setError] = useState<string | null>(null);

  const workspace = session?.workspace ?? null;
  const currentMap = useMemo(() => {
    if (!workspace || !session?.lastMapPath) return null;
    return workspace.maps.find((map) => map.path === session.lastMapPath) ?? null;
  }, [workspace, session?.lastMapPath]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!workspace || !currentMap) {
        setSource(null);
        setMessage("Abra um mapa pelo Workspace antes de editar a estrutura.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await loadStructuralSource(workspace, currentMap);
        if (cancelled) return;
        const selectedMetatile = editorStore.getState().selectedMetatile;
        setSource(next);
        setWidth(next.layout.width);
        setHeight(next.layout.height);
        setFillRaw(
          `0x${selectedMetatile.toString(16).toUpperCase().padStart(4, "0")}`,
        );
        setBorderRawValues(
          next.border
            ? [0, 1, 2, 3].map(
                (index) =>
                  `0x${borderCellRaw(next.border!, index).toString(16).toUpperCase().padStart(4, "0")}`,
              )
            : ["0x0000", "0x0000", "0x0000", "0x0000"],
        );
        setMessage(
          `${currentMap.name}: estrutura ${next.layout.width}×${next.layout.height} carregada.`,
        );
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setMessage("Não foi possível carregar a estrutura.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspace, currentMap]);

  const computed = useMemo(() => {
    if (!source) return null;
    try {
      const fill = parseRawCell(fillRaw);
      const resize = resizeMapData(source.map, width, height, anchor, fill);
      let border = source.border;
      if (border) {
        borderRaw.forEach((value, index) => {
          border = setBorderRaw(border!, index, parseRawCell(value));
        });
      }
      const draft = buildStructuralDraft(source, resize, border);
      const writes = structuralWrites(source, draft);
      return { draft, writes, error: null as string | null };
    } catch (cause) {
      return {
        draft: null,
        writes: [],
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [source, width, height, anchor, fillRaw, borderRaw]);

  const dirtyEditor = editor.dirty || editor.mapJsonDirty;
  const blockedEvents = computed?.draft?.outOfBounds ?? [];
  const reciprocalIssues = computed?.draft?.reciprocalConnectionIssues ?? [];
  const canApply = Boolean(
    source &&
      computed?.draft &&
      computed.writes.length > 0 &&
      !dirtyEditor &&
      blockedEvents.length === 0 &&
      reciprocalIssues.length === 0 &&
      !saving,
  );

  const applyWritable = async () => {
    if (
      !workspace ||
      !session?.writeAccess ||
      !source ||
      !computed?.draft ||
      !canApply
    ) {
      return;
    }
    if (computed.draft.resize.croppedCells > 0) {
      const confirmed = window.confirm(
        `O resize removerá ${computed.draft.resize.croppedCells} célula(s) do terreno. Eventos e conexões recíprocas passaram na pré-validação. Deseja continuar?`,
      );
      if (!confirmed) return;
    }
    setSaving(true);
    setError(null);
    setMessage(
      "Gravando map.bin, map.json, layouts.json, conexões vizinhas e border.bin necessários…",
    );
    try {
      const saved = await writeStructuralFiles(
        workspace,
        session.writeAccess,
        computed.writes,
      );
      applyDraftLayoutToWorkspace(source, workspace, computed.draft);
      setMessage(`Estrutura salva: ${saved.join(" + ")}. Reabrindo mapa…`);
      await openWorkspaceMap(workspace, source.mapEntry);
      editorStore.setMessage(
        `Estrutura salva com sucesso — ${computed.draft.map.width}×${computed.draft.map.height}.`,
      );
      await navigate({ to: "/" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setMessage("Falha ao salvar a estrutura.");
    } finally {
      setSaving(false);
    }
  };

  const downloadReadOnly = () => {
    if (!source || !computed?.draft || !canApply) return;
    if (computed.draft.resize.croppedCells > 0) {
      const confirmed = window.confirm(
        `O resize removerá ${computed.draft.resize.croppedCells} célula(s) do terreno. Deseja gerar os arquivos mesmo assim?`,
      );
      if (!confirmed) return;
    }
    for (const write of computed.writes) {
      download(write.data, safeDownloadName(write.path));
    }
    setMessage(
      `${computed.writes.length} arquivo(s) estrutural(is) baixado(s) com o caminho embutido no nome. Reponha cada um no caminho listado antes de reabrir o Workspace.`,
    );
  };

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
          <h1 className="text-sm font-semibold">Estrutura do layout</h1>
          <p className="text-[10px] text-muted-foreground">
            resize seguro · origem · border.bin 2×2
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {source && (
            <span className="font-mono text-muted-foreground">{source.layout.id}</span>
          )}
          {session && (
            <span
              className={
                session.writeAccess
                  ? "rounded border border-success/30 bg-success/10 px-2 py-1 text-success"
                  : "rounded border border-warning/30 bg-warning/10 px-2 py-1 text-warning"
              }
            >
              {session.writeAccess ? "R/W" : "RO"}
            </span>
          )}
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="min-w-0 rounded border border-border bg-panel">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Maximize2 className="size-4 text-primary" />
            <div>
              <h2 className="panel-title">Redimensionar map.bin</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                O conteúdo antigo é reposicionado pela âncora. Eventos, conexões locais e conexões recíprocas acompanham o deslocamento.
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Largura
              </span>
              <input
                type="number"
                min={1}
                max={512}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                className="h-8 w-full rounded border border-border bg-canvas px-2 font-mono text-xs outline-none focus:border-primary/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Altura
              </span>
              <input
                type="number"
                min={1}
                max={512}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value))}
                className="h-8 w-full rounded border border-border bg-canvas px-2 font-mono text-xs outline-none focus:border-primary/60"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Raw para novas células
              </span>
              <input
                value={fillRaw}
                onChange={(event) => setFillRaw(event.target.value)}
                className="h-8 w-full rounded border border-border bg-canvas px-2 font-mono text-xs outline-none focus:border-primary/60"
              />
              <span className="mt-1 block text-[9px] text-muted-foreground">
                Aceita decimal ou hexadecimal, ex. 0x3001. Inclui metatile + colisão + elevação.
              </span>
            </label>
          </div>

          <div className="border-t border-border p-3">
            <span className="mb-2 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Âncora do conteúdo existente
            </span>
            <div className="grid w-36 grid-cols-3 gap-1">
              {ANCHORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAnchor(item.id)}
                  title={item.id}
                  className={
                    "grid h-10 place-items-center rounded border text-base " +
                    (anchor === item.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-canvas text-muted-foreground hover:bg-surface")
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {computed?.draft && (
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border text-[10px] sm:grid-cols-4">
              <Metric
                label="Deslocamento"
                value={`${computed.draft.resize.dx >= 0 ? "+" : ""}${computed.draft.resize.dx}, ${computed.draft.resize.dy >= 0 ? "+" : ""}${computed.draft.resize.dy}`}
              />
              <Metric
                label="Células copiadas"
                value={String(computed.draft.resize.copiedCells)}
              />
              <Metric label="Novas" value={String(computed.draft.resize.addedCells)} />
              <Metric
                label="Cortadas"
                value={String(computed.draft.resize.croppedCells)}
                danger={computed.draft.resize.croppedCells > 0}
              />
              <Metric label="Eventos movidos" value={String(computed.draft.shiftedEvents)} />
              <Metric
                label="Conexões locais"
                value={String(computed.draft.adjustedConnections)}
              />
              <Metric
                label="Recíprocas"
                value={String(computed.draft.reciprocalConnectionsAdjusted)}
              />
              <Metric
                label="Mapas vizinhos"
                value={String(computed.draft.neighbors.filter((neighbor) => neighbor.source !== neighbor.originalSource).length)}
              />
            </div>
          )}
        </section>

        <section className="min-w-0 rounded border border-border bg-panel">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Grid2X2 className="size-4 text-primary" />
            <div>
              <h2 className="panel-title">Border do mapa</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Emerald usa border.bin 2×2; cada célula é o mesmo uint16 do map.bin.
              </p>
            </div>
          </div>

          {!source?.border ? (
            <div className="p-4 text-xs text-muted-foreground">
              Este layout não possui border.bin carregável.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3">
              {borderRaw.map((value, index) => {
                let detail: ReturnType<typeof describeRawCell> | null = null;
                try {
                  detail = describeRawCell(parseRawCell(value));
                } catch {
                  detail = null;
                }
                return (
                  <label key={index} className="rounded border border-border bg-canvas p-2">
                    <span className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
                      Célula {index} <span>({index % 2},{Math.floor(index / 2)})</span>
                    </span>
                    <input
                      value={value}
                      onChange={(event) =>
                        setBorderRawValues((current) =>
                          current.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        )
                      }
                      className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary/60"
                    />
                    {detail ? (
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center font-mono text-[9px] text-muted-foreground">
                        <span>tile {detail.metatile}</span>
                        <span>col {detail.collision}</span>
                        <span>elev {detail.elevation}</span>
                      </div>
                    ) : (
                      <p className="mt-2 text-[9px] text-destructive">Raw inválido</p>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="border-t border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
            O editor não altera a dimensão do border: ela permanece{" "}
            <b className="text-foreground">2×2</b>, compatível com a estrutura atual do
            pokeemerald de Arauna.
          </div>
        </section>

        <section className="rounded border border-border bg-panel p-3 xl:col-span-2">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="panel-title">Pré-validação estrutural</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {message}
              </p>
              {loading && (
                <p className="mt-2 text-[10px] text-primary">
                  <Loader2 className="mr-1 inline size-3 animate-spin" /> Lendo arquivos do
                  Workspace…
                </p>
              )}
              {computed?.error && <Warning text={computed.error} />}
              {error && <Warning text={error} />}
              {dirtyEditor && (
                <Warning text="Há alterações normais não salvas no editor. Salve-as primeiro para que o resize não parta de arquivos antigos do Workspace." />
              )}
              {blockedEvents.length > 0 && (
                <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
                  <AlertTriangle className="mr-1 inline size-3" />
                  Resize bloqueado: {blockedEvents.length} evento(s) ficariam fora do novo
                  mapa. Mova-os antes de diminuir/realinhar.
                  <ul className="mt-1 font-mono">
                    {blockedEvents.slice(0, 8).map((event) => (
                      <li key={`${event.source}-${event.index}`}>
                        {event.source}[{event.index}] → ({event.x},{event.y})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {reciprocalIssues.length > 0 && (
                <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
                  <AlertTriangle className="mr-1 inline size-3" />
                  Resize bloqueado: não foi possível provar a simetria de {reciprocalIssues.length}
                  conexão(ões) vizinha(s).
                  <ul className="mt-1 font-mono">
                    {reciprocalIssues.slice(0, 8).map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {computed?.draft &&
                !computed.error &&
                blockedEvents.length === 0 &&
                reciprocalIssues.length === 0 && (
                  <p className="mt-2 text-[10px] text-success">
                    <CheckCircle2 className="mr-1 inline size-3" /> Eventos permanecem nos
                    limites e conexões recíprocas estão coerentes. {computed.writes.length}{" "}
                    arquivo(s) precisam mudar.
                  </p>
                )}
              {computed?.writes.length ? (
                <p className="mt-1 break-all font-mono text-[9px] text-muted-foreground">
                  {computed.writes.map((write) => write.path).join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-2">
              {session?.writeAccess ? (
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={() => void applyWritable()}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {saving ? "Salvando…" : "Aplicar na pasta"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={downloadReadOnly}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="size-3.5" /> Baixar arquivos
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-panel p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 font-mono text-sm " + (danger ? "text-warning" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-[10px] leading-relaxed text-warning">
      <AlertTriangle className="mr-1 inline size-3" />
      {text}
    </div>
  );
}
