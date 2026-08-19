import { useEffect } from "react";
import { editorStore } from "@/lib/editorStore";
import { useRealAtlas } from "@/lib/realAtlasStore";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";

/**
 * A preset may be correct for Petalburg but dangerous in another secondary
 * tileset where the same numeric IDs mean different graphics. Re-check the
 * scope whenever Workspace swaps the real atlas and fail closed.
 */
export function SmartPathScopeGuard() {
  const smart = useSmartPath();
  const atlas = useRealAtlas();
  const preset = smart.presets.find((item) => item.id === smart.activePresetId) ?? null;

  useEffect(() => {
    if (!smart.enabled || !preset?.scope) return;
    const matches = Boolean(
      atlas &&
      preset.scope.primary === atlas.primary &&
      preset.scope.secondary === atlas.secondary,
    );
    if (matches) return;
    smartPathStore.setEnabled(false);
    editorStore.setMessage(
      atlas
        ? `Smart Paths desativado: o preset pertence a ${preset.scope.primary} + ${preset.scope.secondary}, mas o mapa atual usa ${atlas.primary} + ${atlas.secondary}.`
        : "Smart Paths desativado: o preset é vinculado a um tileset, mas nenhum atlas real está carregado.",
    );
  }, [
    smart.enabled,
    preset?.id,
    preset?.updatedAt,
    preset?.scope?.primary,
    preset?.scope?.secondary,
    atlas?.primary,
    atlas?.secondary,
  ]);

  return null;
}
