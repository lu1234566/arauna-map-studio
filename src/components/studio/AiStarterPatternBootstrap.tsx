import { useEffect } from "react";
import { deriveSemanticEventPatterns } from "@/lib/aiMapSemanticRegions";
import { deriveMapPatterns, deriveMapSmartPaths } from "@/lib/aiMapVocabulary";
import { starterPatternsForScope } from "@/lib/emeraldStarterPatterns";
import { useEditor } from "@/lib/editorStore";
import { serializeMapPatterns, type PatternScope } from "@/lib/patternLibrary";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";

const LEGACY_STARTER_IDS = new Set([
  "emerald-littleroot-house-west",
  "emerald-littleroot-house-east",
  "emerald-littleroot-birch-lab",
]);

function scopeMatches(candidate: PatternScope | undefined, scope: PatternScope) {
  return !candidate || (candidate.primary === scope.primary && candidate.secondary === scope.secondary);
}

function pruneAutomaticVocabulary(scope: PatternScope) {
  const stalePatternIds = patternLibraryStore.getState().patterns
    .filter((pattern) => (pattern.id.startsWith("auto-") || LEGACY_STARTER_IDS.has(pattern.id)) && !scopeMatches(pattern.scope, scope))
    .map((pattern) => pattern.id);
  for (const id of stalePatternIds) {
    patternLibraryStore.selectPattern(id);
    patternLibraryStore.deleteActive();
  }

  const stalePathIds = smartPathStore.getState().presets
    .filter((preset) => preset.id.startsWith("auto-") && !scopeMatches(preset.scope, scope))
    .map((preset) => preset.id);
  for (const id of stalePathIds) {
    smartPathStore.selectPreset(id);
    smartPathStore.deleteActive();
  }
}

/**
 * Instala vocabulário GBA real para a IA.
 *
 * - mantém o starter pack canônico quando o scope suportar;
 * - com map.json ativo, extrai fachadas, mercado e trechos RAW do mapa aberto;
 * - cria Smart Paths usando pisos/costa reais do próprio mapa;
 * - remove apenas vocabulário AUTOMÁTICO de outros tilesets;
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
    pruneAutomaticVocabulary(scope);

    const mapDerived = editor.mapJsonDocument
      ? [
          ...deriveMapPatterns(editor.map, editor.events, editor.mapName, scope, atlas),
          ...deriveSemanticEventPatterns(editor.map, editor.events, editor.mapName, scope),
        ]
      : [];
    const candidates = [
      ...starterPatternsForScope(scope),
      ...mapDerived,
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
