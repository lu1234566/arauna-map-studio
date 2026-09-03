import type { AraunaPresetCatalogEntry } from "./araunaPresetCatalog";
import { ROTAS_INICIAIS_PRESETS } from "./rotasIniciaisPresets";

export const ROTAS_INICIAIS_CATALOG_ENTRIES: readonly AraunaPresetCatalogEntry[] = ROTAS_INICIAIS_PRESETS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  prompt: entry.prompt,
  guardFromAtlas: entry.guardFromAtlas,
}));
