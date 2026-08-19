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
  const presetPrimary = preset?.scope?.primary ?? null;
  const presetSecondary = preset?.scope?.secondary ?? null;
  const atlasPrimary = atlas?.primary ?? null;
  const atlasSecondary = atlas?.secondary ?? null;

  useEffect(() => {
    if (!smart.enabled || !presetPrimary || !presetSecondary) return;
    const matches = presetPrimary === atlasPrimary && presetSecondary === atlasSecondary;
    if (matches) return;
    smartPathStore.setEnabled(false);
    editorStore.setMessage(
      atlasPrimary && atlasSecondary
        ? `Smart Paths desativado: o preset pertence a ${presetPrimary} + ${presetSecondary}, mas o mapa atual usa ${atlasPrimary} + ${atlasSecondary}.`
        : "Smart Paths desativado: o preset é vinculado a um tileset, mas nenhum atlas real está carregado.",
    );
  }, [smart.enabled, presetPrimary, presetSecondary, atlasPrimary, atlasSecondary]);

  return null;
}
