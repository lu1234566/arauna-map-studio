import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function BlueprintGeneratorLauncher() {
  return (
    <Link
      to="/generator"
      className="absolute bottom-9 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded border border-primary/50 bg-panel/95 px-3 py-1.5 text-[10px] font-semibold text-primary shadow-lg backdrop-blur-sm transition-colors hover:bg-primary/15"
      title="Gerar layouts usando padrões e Smart Paths já verificados"
    >
      <Sparkles className="size-3.5" /> Blueprint Generator
    </Link>
  );
}
