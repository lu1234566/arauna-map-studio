import { useRef } from "react";
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
  ShieldCheck,
  ShieldOff,
  Grid3x3,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Info,
} from "lucide-react";
import { editorStore, useEditor, type Tool, type ViewMode } from "@/lib/editorStore";
import { cn } from "@/lib/utils";

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
  { id: "triggers", label: "Triggers" },
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

export function TopToolbar({ onValidate }: { onValidate: () => void }) {
  const state = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    const buffer = await file.arrayBuffer();
    editorStore.importBuffer(buffer, file.name);
  };

  const handleExport = () => {
    const bytes = editorStore.exportBytes();
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map.bin";
    a.click();
    URL.revokeObjectURL(url);
    editorStore.setMessage(`Exportado map.bin — ${bytes.byteLength} bytes.`);
  };

  return (
    <header className="flex flex-col border-b border-border bg-toolbar">
      <div className="flex h-11 items-center gap-1 px-2">
        <div className="mr-2 flex items-center gap-2">
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
        <TB title="Importar map.bin (800 bytes)" onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" /> Importar
        </TB>
        <TB title="Exportar map.bin" onClick={handleExport}>
          <Download className="size-3.5" /> Exportar
        </TB>
        <TB title="Validar mapa" onClick={onValidate}>
          <CheckCircle2 className="size-3.5" /> Validar
        </TB>
        <input
          ref={fileRef}
          type="file"
          accept=".bin,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = "";
          }}
        />

        <Divider />

        <TB
          title="Desfazer (Ctrl+Z)"
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

        <div className="ml-auto flex items-center gap-1">
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
            title="Bloqueia edição visual das células de progressão"
            active={state.protectProgression}
            onClick={editorStore.toggleProtect}
          >
            {state.protectProgression ? (
              <ShieldCheck className="size-3.5" />
            ) : (
              <ShieldOff className="size-3.5" />
            )}
            Proteger progressão
          </TB>
          <Divider />
          <Link
            to="/formato"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-transparent px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
          >
            <Info className="size-3.5" /> Sobre o formato
          </Link>
        </div>
      </div>

      <div className="flex h-8 items-center gap-1 border-t border-border px-2">
        <span className="panel-title mr-1">Ferramentas</span>
        {TOOLS.map((tool) => (
          <TB
            key={tool.id}
            title={`${tool.label} (${tool.key})`}
            active={state.tool === tool.id}
            onClick={() => editorStore.setTool(tool.id)}
          >
            <tool.icon className="size-3.5" /> {tool.label}
          </TB>
        ))}

        <Divider />
        <span className="panel-title mr-1">Camada</span>
        {VIEWS.map((view) => (
          <TB
            key={view.id}
            title={view.id === "visual" ? "Camada editável" : "Somente leitura no MVP"}
            active={state.viewMode === view.id}
            onClick={() => editorStore.setViewMode(view.id)}
          >
            {view.label}
            {view.id !== "visual" && (
              <span className="text-[9px] text-muted-foreground">ro</span>
            )}
          </TB>
        ))}
      </div>
    </header>
  );
}
