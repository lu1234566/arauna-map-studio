import { parseLayeredPrompt } from "./aiLayeredPrompt";
import {
  AI_MAP_PLAN_FORMAT,
  parseDetailedMapCommand,
  type AiMapPlan,
} from "./aiMapPlan";
import type { MapPattern } from "./patternLibrary";
import type { SmartPathPreset } from "./smartPath";

const NO_STRUCTURED_COMMANDS = "O interpretador local não encontrou comandos estruturados.";

function layeredPlanName(source: string) {
  const quoted = source.match(/\bnome\s*=\s*"([^"]+)"/i)?.[1]?.trim();
  return quoted || "Remodelagem em camadas";
}

/**
 * Extensão fail-closed do interpretador local.
 *
 * `parseDetailedMapCommand` continua sendo a autoridade para structures/routes/
 * warps/connections. Só aceitamos o fallback sem esses comandos quando:
 * - o único erro foi exatamente "nenhum comando estruturado";
 * - `parseLayeredPrompt` reconheceu zonas válidas;
 * - não há erro de sintaxe nas camadas.
 *
 * Isso permite mapas legítimos sem conexão de borda (como Sootopolis/M'Boi)
 * sem inventar uma saída, warp ou estrutura artificial apenas para satisfazer o
 * parser clássico.
 */
export function parseLocalMapCommand(
  source: string,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  width: number,
  height: number,
) {
  const classic = parseDetailedMapCommand(source, patterns, smartPaths, width, height);
  if (classic.plan) return classic;

  const onlyMissingStructuredCommands =
    classic.errors.length === 1 && classic.errors[0]?.startsWith(NO_STRUCTURED_COMMANDS);
  if (!onlyMissingStructuredCommands) return classic;

  const layered = parseLayeredPrompt(source);
  if (!layered.active || layered.errors.length) return classic;

  const plan: AiMapPlan = {
    format: AI_MAP_PLAN_FORMAT,
    name: layeredPlanName(source),
    category: "Prompt",
    tags: ["prompt", "precise", "layered-only"],
    width,
    height,
    structures: [],
    routes: [],
    warps: [],
    connections: [],
    notes: [
      ...classic.warnings,
      ...layered.warnings,
      "Plano local composto somente por camadas Exact Grid; nenhuma conexão, warp ou estrutura foi inventada.",
    ],
  };
  return { plan, errors: [], warnings: plan.notes ?? [] };
}
