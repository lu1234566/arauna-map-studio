import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Brush,
  Pipette,
  PaintBucket,
  SquareDashed,
  Undo2,
  Redo2,
  FilePlus2,
  Upload,
  Download,
  Save,
  ShieldCheck,
  ShieldOff,
  Grid3x3,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Info,
  Map,
  FolderOpen,
  Braces,
  Settings2,
} from "lucide-react";
import { editorStore, useEditor, type Tool, type ViewMode } from "@/lib/editorStore";
import { saveEditorToWritableWorkspace } from "@/lib/fileSystemWorkspace";
import { cn } from "@/lib/utils";
import { realAtlasStore } from "@/lib/realAtlasStore";
import { useWorkspaceSession } from "@/lib/workspaceSession";
import {
  LITTLEROOT_MAP_JSON,
  littlerootMapBinBuffer,
} from "@/data/littlerootSnapshot";

const TOOLS: { id: Tool; icon: typeof Brush; label: string; key: string }[] = [
  { id: "pencil", icon: Brush, label: "Lápis", key: "B" },
  { id: "picker", icon: Pipette, label: "Conta-gotas", key: "I" },
  { id: "fill", icon: PaintBucket, label: "Bucket fill", key: "G" },
  { id: "select", icon: SquareDashed, label: "Seleção retangular", key: "M" },
];

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "visual", label: "Visual" },
  { id: "collision", label: "Colisão" },
  { id: "elevation", label: "Elevação" },
  { id: "warps", label: "Warps" },
  { id: "npcs", label: "NPCs" },
  { id: "triggers", label: "Triggers/BG" },
];

function TB({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
        "border border-transparent text-foreground/80 hover:bg-surface hover:text-foreground",
        active && "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TopToolbar({ onValidate }: { onValidate: () => void }) {
  const state = useEditor();
  const session = useWorkspaceSession();
  const binRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const handleImportBin = async (file: File) => {
    const buffer = await file.arrayBuffer();
    editorStore.importBuffer(buffer, file.name);
  };

  const handleImportJson = async (file: File) => {
    const source = await file.text();
    editorStore.importMapJson(source, file.name);
  };

  const loadRealLittleroot = () => {
    const binaryResult = editorStore.importBuffer(
      littlerootMapBinBuffer(),
      "LittlerootTown/map.bin (snapshot Arauna)",
    );
    if (!binaryResult.ok) return;
    editorStore.importMapJson(
      LITTLEROOT_MAP_JSON,
      "LittlerootTown/map.json (snapshot Arauna)",
    );
    const atlas = realAtlasStore.getSnapshot();
    editorStore.setMessage(
      atlas
        ? `Vila Amanhecer/LittlerootTown carregada do snapshot. Atlas ativo: ${atlas.primary} + ${atlas.secondary}.`
        : "Vila Amanhecer/LittlerootTown carregada do snapshot. Abra Workspace ou Tilesets para carregar os gráficos reais; enquanto isso o fallback DEMO permanece.",
    );
  };

  const binSourceWritable = Boolean(
    session?.writeAccess && state.sourceFile?.startsWith("data/"),
  );
  const jsonSourceWritable = Boolean(
    session?.writeAccess && state.mapJsonSource?.startsWith("data/"),
  );

  const handleExportBin = () => {
    const bytes = editorStore.exportBytes();
    downloadBlob(
      new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/octet-stream" }),
      "map.bin",
    );
    if (binSourceWritable) {
      editorStore.setMessage(
        `map.bin baixado (${bytes.byteLength} bytes). A origem local continua marcada como alterada até usar “Salvar pasta”.`,
      );
    } else {
      editorStore.markBinExported();
      editorStore.setMessage(`Exportado map.bin — ${bytes.byteLength} bytes.`);
    }
  };

  const handleExportJson = () => {
    const source = editorStore.exportMapJsonSource();
    if (!source) return;
    const byteLength = new TextEncoder().encode(source).byteLength;
    downloadBlob(new Blob([source], { type: "application/json;charset=utf-8" }), "map.json");
    if (jsonSourceWritable) {
      editorStore.setMessage(
        `map.json baixado (${byteLength} bytes). A origem local continua marcada como alterada até usar “Salvar pasta”.`,
      );
    } else {
      editorStore.markMapJsonExported();
      editorStore.setMessage(`Exportado map.json — ${byteLength} bytes.`);
    }
  };

  const handleSaveWorkspace = async () => {
    const currentSession = session;
    if (!currentSession?.writeAccess || savingWorkspace) return;
    setSavingWorkspace(true);
    editorStore.setMessage("Salvando alterações diretamente na pasta local…");
    try {
      const result = await saveEditorToWritableWorkspace(
        currentSession.workspace,
        currentSession.writeAccess,
      );
      if (result.saved.length) {
        editorStore.setMessage(`Salvo na pasta local: ${result.saved.join(" + ")}.`);
      } else {
        editorStore.setMessage("Nada para salvar: map.bin e map.json não possuem alterações pendentes.");
      }
    } catch (cause) {
      editorStore.setMessage(
        `Falha ao salvar na pasta: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSavingWorkspace(false);
    }
  };

  const eventView = state.viewMode === "warps" || state.viewMode === "npcs" || state.viewMode === "triggers";
  const hasWorkspaceChanges = state.dirty || state.mapJsonDirty;
  const directSaveAvailable = Boolean(
    session?.writeAccess &&
      session.lastMapPath &&
      state.sourceFile?.startsWith("data/") &&
      state.mapJsonSource?.startsWith("data/"),
  );

  return (
    <header className="flex flex-col border-b border-border bg-toolbar">
      <div className="flex h-11 items-center gap-1 overflow-x-auto px-2">
        <div className="mr-2 flex shrink-0 items-center gap-2">
          <div className="grid size-6 place-items-center rounded-sm bg-primary/20 text-[10px] font-bold text-primary">
            AM
          </div>
          <div className="leading-tight">
            <h1 className="text-[13px] font-semibold tracking-tight">Arauna Map Studio</h1>
            <p className="text-[10px] text-muted-foreground">
              pokeemerald decomp · Juramento de Arauna
            </p>
          </div>
        </div>

        <Divider />

        <TB title="Novo mapa 20×20" onClick={editorStore.newMap}>
          <FilePlus2 className="size-3.5" /> Novo 20×20
        </TB>
        <TB
          title="Carregar snapshot interno da Vila Amanhecer/LittlerootTown"
          onClick={loadRealLittleroot}
        >
          <Map className="size-3.5" /> Vila snapshot
        </TB>
        <TB title="Importar map.bin 20×20 manualmente" onClick={() => binRef.current?.click()}>
          <Upload className="size-3.5" /> map.bin
        </TB>
        <TB title="Importar data/maps/.../map.json manualmente" onClick={() => jsonRef.current?.click()}>
          <Upload className="size-3.5" /> map.json
        </TB>

        {session?.writeAccess && (
          <TB
            title={
              directSaveAvailable
                ? "Gravar map.bin e/ou map.json alterados diretamente na pasta local"
                : "Abra um mapa pelo Workspace R/W para habilitar gravação direta"
            }
            active={directSaveAvailable && hasWorkspaceChanges}
            onClick={() => void handleSaveWorkspace()}
            disabled={!directSaveAvailable || !hasWorkspaceChanges || savingWorkspace}
          >
            <Save className="size-3.5" /> {savingWorkspace ? "Salvando…" : "Salvar pasta"}
            {hasWorkspaceChanges && <span className="text-[9px] text-warning">*</span>}
          </TB>
        )}

        <TB title={binSourceWritable ? "Baixar uma cópia do map.bin; não salva a origem local" : "Baixar map.bin atual"} onClick={handleExportBin}>
          <Download className="size-3.5" /> BIN
          {state.dirty && <span className="text-[9px] text-warning">*</span>}
        </TB>
        <TB
          title={jsonSourceWritable ? "Baixar uma cópia do map.json; não salva a origem local" : "Baixar map.json com eventos editados"}
          onClick={handleExportJson}
          disabled={!state.mapJsonDocument}
        >
          <Braces className="size-3.5" /> JSON
          {state.mapJsonDirty && <span className="text-[9px] text-warning">*</span>}
        </TB>
        <TB title="Validar layout, bits físicos, eventos e conexões" onClick={onValidate}>
          <CheckCircle2 className="size-3.5" /> Validar
        </TB>
        <input
          ref={binRef}
          type="file"
          accept=".bin,application/octet-stream"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportBin(file);
            event.target.value = "";
          }}
        />
        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportJson(file);
            event.target.value = "";
          }}
        />

        <Divider />

        <TB
          title="Desfazer (Ctrl+Z) — inclui mapa, colisão, elevação, eventos e configurações JSON"
          onClick={editorStore.undo}
          disabled={state.undoDepth === 0}
        >
          <Undo2 className="size-3.5" />
        </TB>
        <TB
          title="Refazer (Ctrl+Shift+Z)"
          onClick={editorStore.redo}
          disabled={state.redoDepth === 0}
        >
          <Redo2 className="size-3.5" />
        </TB>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <TB title="Mais zoom (+)" onClick={() => editorStore.setZoom(state.zoom + 0.5)}>
            <ZoomIn className="size-3.5" />
          </TB>
          <span className="w-11 text-center font-mono text-[11px] text-muted-foreground">
            {Math.round(state.zoom * 100)}%
          </span>
          <TB title="Menos zoom (−)" onClick={() => editorStore.setZoom(state.zoom - 0.5)}>
            <ZoomOut className="size-3.5" />
          </TB>
          <Divider />
          <TB title="Alternar grid" active={state.showGrid} onClick={editorStore.toggleGrid}>
            <Grid3x3 className="size-3.5" /> Grid
          </TB>
          <TB
            title="Bloqueia pintura do terreno em células críticas derivadas de warps, coord events e BG events"
            active={state.protectProgression}
            onClick={editorStore.toggleProtect}
          >
            {state.protectProgression ? (
              <ShieldCheck className="size-3.5" />
            ) : (
              <ShieldOff className="size-3.5" />
            )}
            Proteger
          </TB>
          <Divider />
          <Link
            to="/workspace"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            title="Abra a pasta data/ e escolha qualquer mapa"
          >
            <FolderOpen className="size-3.5" /> Workspace
          </Link>
          <Link
            to="/map-settings"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-transparent px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
            title="Editar propriedades gerais e conexões do map.json"
          >
            <Settings2 className="size-3.5" /> Config. mapa
            {state.mapJsonDirty && <span className="text-warning">*</span>}
          </Link>
          <Link
            to="/tilesets"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-transparent px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
          >
            <Map className="size-3.5" /> Tilesets
          </Link>
          <Link
            to="/formato"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-transparent px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
          >
            <Info className="size-3.5" /> Formato
          </Link>
        </div>
      </div>

      <div className="flex h-8 items-center gap-1 overflow-x-auto border-t border-border px-2">
        <span className="panel-title mr-1 shrink-0">Ferramentas</span>
        {TOOLS.map((tool) => (
          <TB
            key={tool.id}
            title={eventView ? "Em camadas de eventos, clique seleciona e arraste move" : `${tool.label} (${tool.key})`}
            active={!eventView && state.tool === tool.id}
            disabled={eventView}
            onClick={() => editorStore.setTool(tool.id)}
          >
            <tool.icon className="size-3.5" /> {tool.label}
          </TB>
        ))}

        <Divider />
        <span className="panel-title mr-1 shrink-0">Camada</span>
        {VIEWS.map((view) => (
          <TB
            key={view.id}
            title={
              view.id === "warps" || view.id === "npcs" || view.id === "triggers"
                ? "Camada de eventos editável quando map.json está carregado"
                : "Camada editável"
            }
            active={state.viewMode === view.id}
            onClick={() => editorStore.setViewMode(view.id)}
          >
            {view.label}
            {(view.id === "warps" || view.id === "npcs" || view.id === "triggers") && (
              <span className={cn("text-[9px]", state.mapJsonDocument ? "text-success" : "text-warning")}>
                {state.mapJsonDocument ? "edit" : "json"}
              </span>
            )}
          </TB>
        ))}
      </div>
    </header>
  );
}
