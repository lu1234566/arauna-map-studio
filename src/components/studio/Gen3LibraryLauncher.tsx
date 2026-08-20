import { Link } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import "@/lib/flexibleBinImportBootstrap";
import { useEditor } from "@/lib/editorStore";
import { AiCityBuilderDock } from "./AiCityBuilderDock";
import { AiStarterPatternBootstrap } from "./AiStarterPatternBootstrap";

export function Gen3LibraryLauncher() {
  const editor = useEditor();
  const aiSessionKey = [
    editor.sourceFile ?? "novo",
    editor.mapName,
    `${editor.map.width}x${editor.map.height}`,
  ].join("|");

  return (
    <>
      <AiStarterPatternBootstrap />
      <AiCityBuilderDock key={aiSessionKey} />
      <Link
        to="/gen3-library"
        className="absolute right-2 top-12 z-30 inline-flex h-8 items-center gap-1.5 rounded border border-success/40 bg-panel/95 px-2.5 text-[10px] font-semibold text-success shadow-lg backdrop-blur-sm hover:bg-success/10"
        title="Abrir biblioteca com metatiles reais de Emerald, Ruby/Sapphire e FireRed/LeafGreen"
      >
        <Gamepad2 className="size-3.5" /> Tiles GBA reais
      </Link>
    </>
  );
}
