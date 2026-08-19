import { useEffect, useRef } from "react";
import { clipboardStore, useClipboard } from "@/lib/clipboardStore";
import { mapTemplateStore, useMapTemplates } from "@/lib/mapTemplateStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { smartPathStore, useSmartPath } from "@/lib/smartPathStore";

/** Dedicated paint overlays share the same pointer surface above MapCanvas. */
export function ExclusivePaintModeGuard() {
  const patterns = usePatternLibrary();
  const templates = useMapTemplates();
  const smartPaths = useSmartPath();
  const clipboard = useClipboard();
  const previous = useRef({ pattern: false, template: false, smart: false, stamp: false });

  useEffect(() => {
    const patternActivated = patterns.enabled && !previous.current.pattern;
    const templateActivated = templates.enabled && !previous.current.template;
    const smartActivated = smartPaths.enabled && !previous.current.smart;
    const stampActivated = clipboard.stampMode && !previous.current.stamp;

    // The mode that just became active wins. This avoids a transient state with
    // two overlays turning both modes off in the same render.
    if (templateActivated) {
      if (patterns.enabled) patternLibraryStore.setEnabled(false);
      if (smartPaths.enabled) smartPathStore.setEnabled(false);
      if (clipboard.stampMode) clipboardStore.toggleStampMode(false);
    } else if (patternActivated) {
      if (templates.enabled) mapTemplateStore.setEnabled(false);
      if (smartPaths.enabled) smartPathStore.setEnabled(false);
      if (clipboard.stampMode) clipboardStore.toggleStampMode(false);
    } else if (smartActivated) {
      if (patterns.enabled) patternLibraryStore.setEnabled(false);
      if (templates.enabled) mapTemplateStore.setEnabled(false);
      if (clipboard.stampMode) clipboardStore.toggleStampMode(false);
    } else if (stampActivated) {
      if (patterns.enabled) patternLibraryStore.setEnabled(false);
      if (templates.enabled) mapTemplateStore.setEnabled(false);
      if (smartPaths.enabled) smartPathStore.setEnabled(false);
    }

    previous.current = {
      pattern: patterns.enabled,
      template: templates.enabled,
      smart: smartPaths.enabled,
      stamp: clipboard.stampMode,
    };
  }, [patterns.enabled, templates.enabled, smartPaths.enabled, clipboard.stampMode]);

  return null;
}
