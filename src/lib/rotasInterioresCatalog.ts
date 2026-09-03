import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import { ROTAS_INTERIORES_PRESETS } from "./rotasInterioresPresets";

export const ROTAS_INTERIORES_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = ROTAS_INTERIORES_PRESETS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  prompt: entry.prompt,
  guardFromAtlas: entry.guardFromAtlas,
}));
