import { useEffect } from "react";
import { useClipboard } from "@/lib/clipboardStore";
import { patternLibraryStore, usePatternLibrary } from "@/lib/patternLibraryStore";
import { useSmartPath } from "@/lib/smartPathStore";

/**
 * The dedicated overlays all sit above MapCanvas. PatternLibrary already turns
 * the others off when it activates; this guard covers the inverse direction
 * (e.g. user clicks Smart Paths or Carimbo while a Pattern is active).
 */
export function ExclusivePaintModeGuard() {
  const patterns = usePatternLibrary();
  const smartPaths = useSmartPath();
  const clipboard = useClipboard();

  useEffect(() => {
    if (!patterns.enabled) return;
    if (smartPaths.enabled || clipboard.stampMode) {
      patternLibraryStore.setEnabled(false);
    }
  }, [patterns.enabled, smartPaths.enabled, clipboard.stampMode]);

  return null;
}
