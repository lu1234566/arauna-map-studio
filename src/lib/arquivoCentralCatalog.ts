import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import { ARQUIVO_CENTRAL_PRESETS } from "./arquivoCentralPresets";

export const ARQUIVO_CENTRAL_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = ARQUIVO_CENTRAL_PRESETS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  prompt: entry.prompt,
  guardFromAtlas: entry.guardFromAtlas,
}));
