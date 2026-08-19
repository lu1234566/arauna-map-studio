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
  pickWritableAraunaWorkspace,
  writableDirectoryPickerSupported,
} from "@/lib/fileSystemWorkspace";
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
import { prepareWorkspaceTransition } from "@/lib/workspaceSwitchGuard";

export const Route = createFileRoute("/workspace")({ component: WorkspaceRoute });

function WorkspaceRoute() {
  const navigate = useNavigate();
  const directoryRef = useRef<HTMLInputElement>(null);
  const session = useWorkspaceSession();
  const workspace = session?.workspace ?? null;
  const [query, setQuery] = useState("");
  const [writableSupported, setWritableSupported] = useState(false);
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
    setWritableSupported(writableDirectoryPickerSupported());
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

  const allowTransition = async () => {
    const result = await prepareWorkspaceTransition(session);
    if (!result.proceed) {
      setMessage(
        result.reason && result.reason !== "cancelled"
          ? `Troca cancelada: ${result.reason}`
          : "Troca cancelada. O mapa atual e suas alterações foram mantidos.",
      );
      return false;
    }
    return true;
  };

  const handleDirectory = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!(await allowTransition())) {
      if (directoryRef.current) directoryRef.current.value = "";
      return;
    }
    setLoadingWorkspace(true);
    setError(null);
    setMessage(`Indexando ${files.length} arquivos localmente em modo somente leitura…`);
    try {
      const next = await loadAraunaWorkspace(files);
      const label = inferWorkspaceLabel(files);
      workspaceSessionStore.open(next, label, null);
      setMessage(
        `Workspace ${label} pronto em SOMENTE LEITURA: ${next.maps.length} mapas, ${next.layouts.size} layouts e ${next.tilesets.length} diretórios de tileset. Você pode editar e baixar BIN/JSON, mas não sobrescrever a pasta diretamente.`,
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

  const handleWritableDirectory = async () => {
    if (loadingWorkspace || openingPath) return;
    if (!(await allowTransition())) return;
    setLoadingWorkspace(true);
    setError(null);
    setMessage("Solicitando acesso de leitura e escrita à pasta…");
    try {
      const selection = await pickWritableAraunaWorkspace();
      setMessage(`Indexando ${selection.files.length} arquivos da pasta data/…`);
      const next = await loadAraunaWorkspace(selection.files);
      workspaceSessionStore.open(next, selection.access.label, selection.access);
      setMessage(
        `Workspace ${selection.access.label} pronto com GRAVAÇÃO DIRETA: ${next.maps.length} mapas, ${next.layouts.size} layouts e ${next.tilesets.length} tilesets. No editor, “Salvar pasta” grava BIN/JSON de volta nos arquivos originais.`,
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setMessage("Seleção de pasta cancelada.");
      } else {
        const text = cause instanceof Error ? cause.message : String(cause);
        setError(text);
        setMessage("Falha ao abrir a pasta com permissão de escrita.");
      }
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handleOpenMap = async (map: WorkspaceMap) => {
    if (!workspace || openingPath) return;
    if (!(await allowTransition())) return;
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

  const closeWorkspace = async () => {
    if (!(await allowTransition())) return;
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
              className={
                "max-w-64 truncate rounded border px-2 py-1 text-[10px] " +
                (session.writeAccess
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning")
              }
              title={`${session.label} · ${session.writeAccess ? "leitura + escrita" : "somente leitura"}`}
            >
              <CheckCircle2 className="mr-1 inline size-3" /> {session.label} · {session.writeAccess ? "R/W" : "RO"}
            </span>
          )}
          {workspace && (
            <button
              type="button"
              onClick={() => void closeWorkspace()}
              disabled={Boolean(openingPath)}
              className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-[10px] text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" /> Fechar
            </button>
          )}
          {writableSupported && (
            <button
              type="button"
              onClick={() => void handleWritableDirectory()}
              disabled={loadingWorkspace || Boolean(openingPath)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
              title="Recomendado no Chrome/Chromebook: permite salvar alterações diretamente nos arquivos locais"
            >
              {loadingWorkspace ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
              {workspace ? "Trocar pasta R/W" : "Abrir pasta R/W"}
            </button>
          )}
          <button
            type="button"
            onClick={() => directoryRef.current?.click()}
            disabled={loadingWorkspace || Boolean(openingPath)}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-border px-2 text-[10px] text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
            title="Fallback: lê os arquivos, mas salvar exige baixar BIN/JSON"
          >
            <FolderOpen className="size-3" /> Somente leitura
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
            No Chrome/Chromebook, prefira <b className="text-foreground">Abrir pasta R/W</b>. Selecione a raiz do repositório ou diretamente <b className="text-foreground">data/</b>. O navegador pedirá permissão e o Studio poderá salvar as mudanças de volta no clone local.
          </p>

          <div className="mt-3 rounded border border-success/30 bg-success/5 p-2 text-[10px] leading-relaxed text-muted-foreground">
            <b className="text-success">R/W:</b> o botão <b className="text-foreground">Salvar pasta</b> do editor grava o map.bin e/ou map.json modificados exatamente nos caminhos de origem. Antes de trocar de mapa, alterações pendentes nunca são descartadas silenciosamente.
          </div>

          <div className="mt-2 rounded border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted-foreground">
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
            <>
              <div className="mt-3 rounded border border-border bg-canvas p-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Acesso ao disco</span>
                  <span className={session?.writeAccess ? "font-semibold text-success" : "font-semibold text-warning"}>
                    {session?.writeAccess ? "LEITURA + ESCRITA" : "SOMENTE LEITURA"}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric icon={Database} label="Arquivos" value={workspace.files.size} />
                <Metric icon={MapIcon} label="Mapas" value={workspace.maps.length} />
                <Metric icon={Layers3} label="Layouts" value={workspace.layouts.size} />
                <Metric icon={Layers3} label="Tilesets" value={workspace.tilesets.length} />
              </div>
            </>
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
                    {writableSupported
                      ? "Clique em “Abrir pasta R/W” e escolha a raiz do repositório ou a pasta data/."
                      : "Seu navegador não expôs escrita em diretório; use “Somente leitura” e escolha a pasta data/."}
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
