import { ARAUNA_ADDITIONAL_PRESETS } from "./araunaPresetCatalog";
import { CAVERNAS_MBOI_CATALOG_ENTRIES } from "./cavernasMboiCatalog";
import { GRUTA_DA_MARE_CATALOG_ENTRIES } from "./grutaDaMareCatalog";
import { GRUTA_DA_ORIGEM_CATALOG_ENTRIES } from "./grutaDaOrigemCatalog";
import { TORRE_JURAMENTO_CATALOG_ENTRIES } from "./torreJuramentoCatalog";
import { USINA_VELHA_CATALOG_ENTRIES } from "./usinaVelhaCatalog";

/**
 * Catálogo efetivamente consumido pelo launcher. O catálogo histórico permanece
 * estável e famílias grandes podem ser anexadas sem transformar um único arquivo
 * numa lista de dezenas de imports manuais.
 */
export const ARAUNA_ALL_PRESETS = [
  ...ARAUNA_ADDITIONAL_PRESETS,
  ...CAVERNAS_MBOI_CATALOG_ENTRIES,
  ...GRUTA_DA_ORIGEM_CATALOG_ENTRIES,
  ...GRUTA_DA_MARE_CATALOG_ENTRIES,
  ...USINA_VELHA_CATALOG_ENTRIES,
  ...TORRE_JURAMENTO_CATALOG_ENTRIES,
] as const;
