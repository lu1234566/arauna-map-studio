import { useEffect } from "react";
import { starterPatternsForScope } from "@/lib/emeraldStarterPatterns";
import { serializeMapPatterns } from "@/lib/patternLibrary";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";

/** Instala estruturas canônicas somente quando a Biblioteca do usuário está vazia. */
export function AiStarterPatternBootstrap() {
  const atlas = useRealAtlas();
  const library = usePatternLibrary();

  useEffect(() => {
    if (!atlas || !library.hydrated || library.patterns.length) return;
    const patterns = starterPatternsForScope({ primary: atlas.primary, secondary: atlas.secondary });
    if (!patterns.length) return;
    patternLibraryStore.importJson(serializeMapPatterns(patterns));
  }, [atlas, library.hydrated, library.patterns.length]);

  return null;
}
