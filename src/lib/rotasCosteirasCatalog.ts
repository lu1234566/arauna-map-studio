import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import { ROTAS_COSTEIRAS_PRESETS } from "./rotasCosteirasPresets";

export const ROTAS_COSTEIRAS_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = ROTAS_COSTEIRAS_PRESETS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  prompt: entry.prompt,
  guardFromAtlas: entry.guardFromAtlas,
}));
