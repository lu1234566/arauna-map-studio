import { useEffect } from "react";
import { deriveMapPatterns, deriveMapSmartPaths } from "@/lib/aiMapVocabulary";
import { starterPatternsForScope } from "@/lib/emeraldStarterPatterns";
import { useEditor } from "@/lib/editorStore";
import { serializeMapPatterns } from "@/lib/patternLibrary";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";

/**
 * Instala vocabulário GBA real para a IA.
 *
 * - mantém o starter pack canônico quando o scope suportar;
 * - com map.json ativo, extrai fachadas e trechos RAW do próprio mapa aberto;
 * - cria Smart Paths conservadores usando pisos caminháveis reais do mapa;
 * - nunca duplica os IDs automáticos já instalados.
 */
export function AiStarterPatternBootstrap() {
  const editor = useEditor();
  const atlas = useRealAtlas();
  const library = usePatternLibrary();
  const paths = useSmartPath();

  useEffect(() => {
    if (!atlas || !library.hydrated || !paths.hydrated) return;
    const scope = { primary: atlas.primary, secondary: atlas.secondary };

    const candidates = [
      ...starterPatternsForScope(scope),
      ...(editor.mapJsonDocument
        ? deriveMapPatterns(editor.map, editor.events, editor.mapName, scope, atlas)
        : []),
    ];
    const existingPatternIds = new Set(patternLibraryStore.getState().patterns.map((pattern) => pattern.id));
    const missingPatterns = candidates.filter((pattern) => !existingPatternIds.has(pattern.id));
    if (missingPatterns.length) {
      const imported = patternLibraryStore.importJson(serializeMapPatterns(missingPatterns));
      if (imported.ok) patternLibraryStore.setPanelOpen(false);
    }

    if (editor.mapJsonDocument) {
      const pathCandidates = deriveMapSmartPaths(editor.map, editor.mapName, scope, atlas);
      const existingPathIds = new Set(smartPathStore.getState().presets.map((preset) => preset.id));
      const missingPaths = pathCandidates.filter((preset) => !existingPathIds.has(preset.id));
      if (missingPaths.length) {
        const imported = smartPathStore.importJson(`${JSON.stringify(missingPaths, null, 2)}\n`);
        if (imported.ok) smartPathStore.setPanelOpen(false);
      }
    }
  }, [
    atlas?.createdAt,
    library.hydrated,
    paths.hydrated,
    editor.sourceFile,
    editor.mapJsonSource,
    editor.mapName,
  ]);

  return null;
}
