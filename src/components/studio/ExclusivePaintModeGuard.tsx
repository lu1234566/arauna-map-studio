import { useEffect } from "react";
import { useClipboard } from "@/lib/clipboardStore";
import { mapTemplateStore, useMapTemplates } from "@/lib/mapTemplateStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useSmartPath } from "@/lib/smartPathStore";

/** Dedicated overlays share the same pointer surface above MapCanvas. */
export function ExclusivePaintModeGuard() {
  const patterns = usePatternLibrary();
  const templates = useMapTemplates();
  const smartPaths = useSmartPath();
  const clipboard = useClipboard();

  useEffect(() => {
    if (patterns.enabled && (templates.enabled || smartPaths.enabled || clipboard.stampMode)) {
      patternLibraryStore.setEnabled(false);
    }
    if (templates.enabled && (patterns.enabled || smartPaths.enabled || clipboard.stampMode)) {
      mapTemplateStore.setEnabled(false);
    }
  }, [patterns.enabled, templates.enabled, smartPaths.enabled, clipboard.stampMode]);

  return null;
}
