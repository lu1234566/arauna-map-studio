import { Eraser, MousePointer2, Paintbrush, Trash2 } from "lucide-react";
import {
  PIXELLAB_BLUEPRINT_ZONES,
  blueprintHasContent,
  pixelLabBlueprintStore,
  usePixelLabBlueprint,
} from "@/lib/pixellabBlueprintStore";
import { cn } from "@/lib/utils";

export function PixelLabBlueprintControls() {
  const blueprint = usePixelLabBlueprint();
  const hasContent = blueprintHasContent(blueprint);

  return (
    <div className="space-y-2 rounded border border-border bg-canvas p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] font-semibold">Blueprint visual</div>
          <div className="mt-0.5 text-[8px] leading-relaxed text-muted-foreground">
            Pinte zonas estruturais sobre a grade. Isso não altera o mapa real.
          </div>
        </div>
        <button
          type="button"
          onClick={() => pixelLabBlueprintStore.toggleEnabled()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[8px] font-semibold",
            blueprint.enabled
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border bg-toolbar text-muted-foreground hover:bg-surface",
          )}
        >
          {blueprint.enabled ? <Paintbrush className="size-3" /> : <MousePointer2 className="size-3" />}
          {blueprint.enabled ? "Pintando" : "Editar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PIXELLAB_BLUEPRINT_ZONES.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => pixelLabBlueprintStore.setActiveZone(zone.id)}
            className={cn(
              "flex items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[8px]",
              blueprint.activeZone === zone.id
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border bg-toolbar text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <span
              className="size-3 shrink-0 rounded-sm border border-white/20"
              style={{ background: zone.color }}
            />
            {zone.id === "none" && <Eraser className="size-3" />}
            <span className="truncate">{zone.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[8px] uppercase tracking-wide text-muted-foreground">Pincel</span>
        {([1, 2, 3] as const).map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => pixelLabBlueprintStore.setBrushSize(size)}
            className={cn(
              "grid size-7 place-items-center rounded border text-[9px] font-mono",
              blueprint.brushSize === size
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-toolbar text-muted-foreground hover:bg-surface",
            )}
          >
            {size}
          </button>
        ))}
        <button
          type="button"
          disabled={!hasContent}
          onClick={() => pixelLabBlueprintStore.clear()}
          className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-toolbar px-2 py-1.5 text-[8px] text-muted-foreground hover:bg-surface disabled:pointer-events-none disabled:opacity-35"
        >
          <Trash2 className="size-3" /> Limpar
        </button>
      </div>

      {blueprint.enabled && (
        <div className="rounded border border-primary/25 bg-primary/5 px-2 py-1.5 text-[8px] leading-relaxed text-muted-foreground">
          Arraste para pintar. Shift, Alt ou botão direito continuam movendo o mapa.
        </div>
      )}
    </div>
  );
}
