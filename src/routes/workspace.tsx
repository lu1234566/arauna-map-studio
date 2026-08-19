import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  FolderOpen,
  Layers3,
  Loader2,
  Map as MapIcon,
  Search,
  X,
} from "lucide-react";
import {
  loadAraunaWorkspace,
  openWorkspaceMap,
  type WorkspaceMap,
} from "@/lib/repoWorkspace";
import {
  inferWorkspaceLabel,
  useWorkspaceSession,
  workspaceSessionStore,
} from "@/lib/workspaceSession";

export const Route = createFileRoute("/workspace")({ component: WorkspaceRoute });

function WorkspaceRoute() {
  const navigate = useNavigate();
  const directoryRef = useRef<HTMLInputElement>(null);
  const session = useWorkspaceSession();
  const workspace = session?.workspace ?? null;
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(() =>
    session
      ? `Workspace ${session.label} continua ativo nesta sessão. Escolha outro mapa sem selecionar a pasta novamente.`
      : "Selecione a raiz do repositório Pokémon Juramento de Arauna ou diretamente a pasta data/.",
  );
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    directoryRef.current?.setAttribute("webkitdirectory", "");
    directoryRef.current?.setAttribute("directory", "");
  }, []);

  const filteredMaps = useMemo(() => {
    if (!workspace) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return workspace.maps;
    return workspace.maps.filter((map) => {
      const layout = map.layout;
      return [
        map.name,
        map.id,
        map.directory,
        map.layoutId,
        layout?.name,
        layout?.primary_tileset,
        layout?.secondary_tileset,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [workspace, query]);

  const handleDirectory = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoadingWorkspace(true);
    setError(null);
    setMessage(`Indexando ${files.length} arquivos localmente…`);
    try {
      const next = await loadAraunaWorkspace(files);
      const label = inferWorkspaceLabel(files);
      workspaceSessionStore.open(next, label);
      setMessage(
        `Workspace ${label} pronto: ${next.maps.length} mapas, ${next.layouts.size} layouts e ${next.tilesets.length} diretórios de tileset detectados.`,
      );
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setError(text);
      setMessage("Falha ao abrir o workspace.");
    } finally {
      setLoadingWorkspace(false);
      if (directoryRef.current) directoryRef.current.value = "";
    }
  };

  const handleOpenMap = async (map: WorkspaceMap) => {
    if (!workspace || openingPath) return;
    setOpeningPath(map.path);
    setError(null);
    setMessage(`Abrindo ${map.name}: mapa, metadados e tilesets…`);
    try {
      const result = await openWorkspaceMap(workspace, map);
      workspaceSessionStore.setLastMap(map.path);
      setMessage(
        `${result.map.name} pronto — ${result.layout.width}×${result.layout.height}, ` +
          `${result.layout.primary_tileset} + ${result.layout.secondary_tileset}.`,
      );
      await navigate({ to: "/" });
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setError(text);
      setMessage(`Não foi possível abrir ${map.name}.`);
    } finally {
      setOpeningPath(null);
    }
  };

  const closeWorkspace = () => {
    workspaceSessionStore.clear();
    setQuery("");
    setError(null);
    setMessage("Workspace fechado. Selecione a pasta data/ para iniciar outra sessão.");
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
          <h1 className="text-sm font-semibold">Workspace Arauna</h1>
          <p className="text-[10px] text-muted-foreground">
            mapas + layouts + tilesets do pokeemerald em um único fluxo local
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {session && (
            <span
              className="max-w-56 truncate rounded border border-success/30 bg-success/10 px-2 py-1 text-[10px] text-success"
              title={session.label}
            >
              <CheckCircle2 className="mr-1 inline size-3" /> {session.label}
            </span>
          )}
          {workspace && (
            <button
              type="button"
              onClick={closeWorkspace}
              disabled={Boolean(openingPath)}
              className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-[10px] text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" /> Fechar
            </button>
          )}
          <button
            type="button"
            onClick={() => directoryRef.current?.click()}
            disabled={loadingWorkspace || Boolean(openingPath)}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            {loadingWorkspace ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
            {workspace ? "Trocar pasta" : "Abrir pasta data/"}
          </button>
          <input
            ref={directoryRef}
            className="hidden"
            type="file"
            multiple
            onChange={(event) => void handleDirectory(event.target.files)}
          />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-panel p-3">
          <h2 className="panel-title mb-2">Como usar</h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Selecione uma vez a pasta <b className="text-foreground">data/</b> do clone local ou a raiz inteira do repositório. O workspace permanece ativo enquanto esta aba do Studio estiver aberta, inclusive ao voltar ao editor e retornar aqui.
          </p>

          <div className="mt-3 rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">
            Ao abrir um mapa, o Studio resolve automaticamente <b>layouts.json</b>, dimensão, <b>map.bin</b>, <b>map.json</b>, primary tileset, secondary tileset, paletas e atributos.
          </div>

          <h2 className="panel-title mb-2 mt-4">Status</h2>
          <p className="rounded border border-border bg-canvas p-2 text-[11px] leading-relaxed">{message}</p>
          {error && (
            <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[10px] leading-relaxed text-destructive">
              <AlertTriangle className="mr-1 inline size-3" /> {error}
            </div>
          )}

          {workspace && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric icon={Database} label="Arquivos" value={workspace.files.size} />
              <Metric icon={MapIcon} label="Mapas" value={workspace.maps.length} />
              <Metric icon={Layers3} label="Layouts" value={workspace.layouts.size} />
              <Metric icon={Layers3} label="Tilesets" value={workspace.tilesets.length} />
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-canvas">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!workspace}
              placeholder="Buscar mapa, MAP_*, LAYOUT_* ou tileset…"
              className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60 disabled:opacity-50"
            />
            {workspace && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {filteredMaps.length}/{workspace.maps.length}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!workspace ? (
              <div className="grid h-full place-items-center text-center text-muted-foreground">
                <div>
                  <FolderOpen className="mx-auto mb-3 size-10 opacity-40" />
                  <p className="text-sm">Nenhum workspace aberto.</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed">
                    Clique em “Abrir pasta data/”. No Chromebook, escolha a pasta data do repositório extraído.
                  </p>
                </div>
              </div>
            ) : filteredMaps.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">Nenhum mapa corresponde à busca.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredMaps.map((map) => (
                  <MapRow
                    key={map.path}
                    map={map}
                    busy={openingPath === map.path}
                    disabled={Boolean(openingPath)}
                    recent={session?.lastMapPath === map.path}
                    onOpen={() => void handleOpenMap(map)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-canvas p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-1 font-mono text-lg leading-none">{value}</div>
    </div>
  );
}

function MapRow({
  map,
  busy,
  disabled,
  recent,
  onOpen,
}: {
  map: WorkspaceMap;
  busy: boolean;
  disabled: boolean;
  recent: boolean;
  onOpen: () => void;
}) {
  const layout = map.layout;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || Boolean(map.error)}
      title={map.error ?? `Abrir ${map.name}`}
      className={
        "group flex min-h-24 items-start gap-3 rounded border bg-panel/70 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-45 " +
        (recent ? "border-primary/50" : "border-border")
      }
    >
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded border border-border bg-canvas">
        {busy ? <Loader2 className="size-4 animate-spin text-primary" /> : <MapIcon className="size-4 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-xs font-semibold">{map.name}</span>
          {recent && <span className="shrink-0 text-[8px] uppercase tracking-wide text-primary">último</span>}
          {layout && (
            <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
              {layout.width}×{layout.height}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[9px] text-muted-foreground">{map.id}</p>
        <p className="mt-1 truncate font-mono text-[9px] text-foreground/70">{map.layoutId || "layout ausente"}</p>
        {layout ? (
          <p className="mt-1 truncate text-[9px] text-muted-foreground">
            {layout.primary_tileset} + {layout.secondary_tileset}
          </p>
        ) : (
          <p className="mt-1 truncate text-[9px] text-destructive">{map.error ?? "Layout não resolvido"}</p>
        )}
      </div>
    </button>
  );
}
