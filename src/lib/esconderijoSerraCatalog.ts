import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import { ESCONDERIJO_SERRA_PRESETS } from "./esconderijoSerraPresets";

export const ESCONDERIJO_SERRA_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = ESCONDERIJO_SERRA_PRESETS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  prompt: entry.prompt,
  guardFromAtlas: entry.guardFromAtlas,
}));
