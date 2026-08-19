import { useEffect } from "react";
import { editorStore } from "@/lib/editorStore";
import { mapTemplateStore, useMapTemplates } from "@/lib/mapTemplateStore";
import { useRealAtlas } from "@/lib/realAtlasStore";

export function MapTemplateScopeGuard() {
  const state = useMapTemplates();
  const atlas = useRealAtlas();
  const active = state.templates.find((template) => template.id === state.activeTemplateId) ?? null;

  useEffect(() => {
    if (!state.enabled || !active) return;
    const status = mapTemplateStore.dependencyStatus(active);
    if (status?.valid) return;
    mapTemplateStore.setEnabled(false);
    editorStore.setMessage(`Templates desativados: ${status?.errors[0] ?? "dependências incompatíveis com o mapa atual."}`);
  }, [
    state.enabled,
    active?.id,
    active?.updatedAt,
    atlas?.primary,
    atlas?.secondary,
  ]);

  return null;
}
