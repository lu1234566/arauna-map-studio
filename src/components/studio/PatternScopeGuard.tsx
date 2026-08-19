import { useEffect } from "react";
import { editorStore } from "@/lib/editorStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useRealAtlas } from "@/lib/realAtlasStore";

export function PatternScopeGuard() {
  const library = usePatternLibrary();
  const atlas = useRealAtlas();
  const pattern = library.patterns.find((item) => item.id === library.activePatternId) ?? null;
  const presetPrimary = pattern?.scope?.primary ?? null;
  const presetSecondary = pattern?.scope?.secondary ?? null;
  const atlasPrimary = atlas?.primary ?? null;
  const atlasSecondary = atlas?.secondary ?? null;

  useEffect(() => {
    if (!library.enabled || !presetPrimary || !presetSecondary) return;
    if (presetPrimary === atlasPrimary && presetSecondary === atlasSecondary) return;
    patternLibraryStore.setEnabled(false);
    editorStore.setMessage(
      atlasPrimary && atlasSecondary
        ? `Padrão desativado: pertence a ${presetPrimary} + ${presetSecondary}, mas o mapa atual usa ${atlasPrimary} + ${atlasSecondary}.`
        : "Padrão desativado: ele é vinculado a um tileset e o atlas real não está disponível.",
    );
  }, [library.enabled, presetPrimary, presetSecondary, atlasPrimary, atlasSecondary]);

  return null;
}
