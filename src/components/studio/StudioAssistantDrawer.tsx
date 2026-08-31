import { useState } from "react";
import {
  Boxes,
  Braces,
  Clipboard,
  Gamepad2,
  Library,
  MapPinned,
  Route,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { pixelLabBlueprintStore } from "@/lib/pixellabBlueprintStore";
import { cn } from "@/lib/utils";
import { CityBundleDock } from "./CityBundleDock";
import { ClipboardDock } from "./ClipboardDock";
import { Gen3LibraryLauncher } from "./Gen3LibraryLauncher";
import { MapBlueprintDock } from "./MapBlueprintDock";
import { MapTemplateDock } from "./MapTemplateDock";
import { PatternLibraryDock } from "./PatternLibraryDock";
import { PixelLabDock } from "./PixelLabDock";
import { ProceduralGeneratorLauncher } from "./ProceduralGeneratorLauncher";
import { SmartPathDock } from "./SmartPathDock";

type AssistantId = "pixellab" | "paths" | "patterns" | "templates" | "blueprint-json" | "clipboard" | "procedural" | "gen3" | "city";

const ITEMS: { id: AssistantId; label: string; icon: typeof Sparkles }[] = [
  { id: "pixellab", label: "PixelLab", icon: Sparkles },
  { id: "paths", label: "Caminhos", icon: Route },
  { id: "patterns", label: "Padrões", icon: Library },
  { id: "templates", label: "Templates", icon: Boxes },
  { id: "blueprint-json", label: "Blueprint JSON", icon: Braces },
  { id: "clipboard", label: "Clipboard", icon: Clipboard },
  { id: "procedural", label: "Procedural", icon: WandSparkles },
  { id: "gen3", label: "Biblioteca Gen3", icon: Gamepad2 },
  { id: "city", label: "Cidade", icon: MapPinned },
];

function AssistantContent({ id }: { id: AssistantId }) {
  if (id === "pixellab") return <PixelLabDock />;
  if (id === "paths") return <SmartPathDock />;
  if (id === "patterns") return <PatternLibraryDock />;
  if (id === "templates") return <MapTemplateDock />;
  if (id === "blueprint-json") return <MapBlueprintDock />;
  if (id === "clipboard") return <ClipboardDock />;
  if (id === "procedural") return <ProceduralGeneratorLauncher />;
  if (id === "gen3") return <Gen3LibraryLauncher />;
  return <CityBundleDock />;
}

export function StudioAssistantDrawer() {
  const [active, setActive] = useState<AssistantId | null>(null);

  const changeActive = (next: AssistantId | null) => {
    pixelLabBlueprintStore.setEnabled(false);
    setActive(next);
  };

  return (
    <div className="pointer-events-none absolute inset-y-2 right-2 z-50 flex max-w-[calc(100%-16px)] items-start gap-1">
      {active && (
        <aside className="pointer-events-auto flex h-full w-[410px] max-w-[calc(100vw-390px)] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-panel/98 shadow-2xl backdrop-blur-sm">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-toolbar px-2.5">
            <span className="text-[10px] font-semibold">Assistentes · {ITEMS.find((item) => item.id === active)?.label}</span>
            <button
              type="button"
              onClick={() => changeActive(null)}
              className="ml-auto grid size-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
              title="Fechar assistente"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="assistant-drawer-host relative min-h-0 flex-1 overflow-auto p-1.5">
            <AssistantContent id={active} />
          </div>
        </aside>
      )}

      <nav className="pointer-events-auto flex max-h-full w-11 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-toolbar/95 p-1 shadow-xl backdrop-blur-sm">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => changeActive(active === item.id ? null : item.id)}
            className={cn(
              "group relative grid size-8 shrink-0 place-items-center rounded border text-muted-foreground transition-colors",
              active === item.id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-transparent hover:border-border hover:bg-surface hover:text-foreground",
            )}
            title={item.label}
          >
            <item.icon className="size-4" />
            <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded border border-border bg-panel px-2 py-1 text-[9px] text-foreground shadow-lg group-hover:block">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <style>{`
        .assistant-drawer-host > section {
          position: static !important;
          inset: auto !important;
          width: 100% !important;
          max-width: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-color: transparent !important;
        }
        .assistant-drawer-host > section > div:last-child {
          max-width: none !important;
        }
      `}</style>
    </div>
  );
}
