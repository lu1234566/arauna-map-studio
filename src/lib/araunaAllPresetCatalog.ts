import { ARAUNA_ADDITIONAL_PRESETS } from "./araunaPresetCatalog";
import { ARQUIVO_CENTRAL_CATALOG_ENTRIES } from "./arquivoCentralCatalog";
import { CAVERNAS_MBOI_CATALOG_ENTRIES } from "./cavernasMboiCatalog";
import { ESCONDERIJO_SERRA_CATALOG_ENTRIES } from "./esconderijoSerraCatalog";
import { GRUTA_DA_MARE_CATALOG_ENTRIES } from "./grutaDaMareCatalog";
import { GRUTA_DA_ORIGEM_CATALOG_ENTRIES } from "./grutaDaOrigemCatalog";
import { NAVIO_PERDIDO_CATALOG_ENTRIES } from "./navioPerdidoCatalog";
import { PASSAGENS_NATURAIS_CATALOG_ENTRIES } from "./passagensNaturaisCatalog";
import { ROTAS_COSTEIRAS_CATALOG_ENTRIES } from "./rotasCosteirasCatalog";
import { ROTAS_INICIAIS_CATALOG_ENTRIES } from "./rotasIniciaisCatalog";
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
  ...NAVIO_PERDIDO_CATALOG_ENTRIES,
  ...PASSAGENS_NATURAIS_CATALOG_ENTRIES,
  ...ESCONDERIJO_SERRA_CATALOG_ENTRIES,
  ...ARQUIVO_CENTRAL_CATALOG_ENTRIES,
  ...ROTAS_INICIAIS_CATALOG_ENTRIES,
  ...ROTAS_COSTEIRAS_CATALOG_ENTRIES,
] as const;
