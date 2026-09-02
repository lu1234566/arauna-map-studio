import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; secondary: string; label: string; preserves: readonly string[]; extra: readonly string[] }

const PRIMARY = "gTileset_General";
const SPECS = {
  mata: {
    id: "piloto-mata-da-espera", mapId: "MAP_PETALBURG_WOODS", source: "PetalburgWoods", width: 48, height: 44,
    secondary: "gTileset_Rustboro", label: "Mata da Espera",
    preserves: [
      "cena do pesquisador e agente: x=23..30, y=14..25 -> preservar",
      "árvores de Cut: x=17..21, y=8..13 -> preservar",
      "saídas norte para Route104: x=12..18, y=3..7 -> preservar",
      "saídas sul para Route104: x=14..39, y=36..40 -> preservar",
    ],
    extra: ["preservar os triggers VAR_PETALBURG_WOODS_STATE em (26,23) e (27,23), os seis warps e todos os itens visíveis/ocultos."],
  },
  brasa: {
    id: "piloto-trilha-de-brasa", mapId: "MAP_FIERY_PATH", source: "FieryPath", width: 35, height: 38,
    secondary: "gTileset_Lavaridge", label: "Trilha de Brasa",
    preserves: [
      "puzzle principal de Strength: x=1..20, y=8..27 -> preservar",
      "saída norte Route112: x=24..28, y=2..6 -> preservar",
      "saída sul Route112: x=24..28, y=34..37 -> preservar",
      "Pokémon de Arauna e corredor leste: x=18..30, y=18..32 -> preservar",
    ],
    extra: ["preservar os seis boulders de Strength e o espaço útil ao redor deles; nenhuma rota do puzzle pode ser aberta, fechada ou simplificada."],
  },
  passo: {
    id: "piloto-passo-cortado", mapId: "MAP_JAGGED_PASS", source: "JaggedPass", width: 30, height: 46,
    secondary: "gTileset_Lavaridge", label: "Passo Cortado",
    preserves: [
      "entrada dinâmica do esconderijo: x=13..19, y=14..21 -> preservar",
      "corredor de triggers/clima da abertura: x=11..24, y=11..22 -> preservar",
      "saídas MtChimney: x=11..16, y=3..7 -> preservar",
      "saídas Route112: x=12..17, y=38..42 -> preservar",
    ],
    extra: [
      "preservar byte a byte (16,17) e (16,18), alternadas entre parede e entrada de caverna por VAR_JAGGED_PASS_STATE.",
      "preservar os cinco triggers de OpenMagmaHideout, o warp (16,18), a guarda e todos os ledges/behaviors usados pela Acro Bike.",
      "preservar STEP_CB_ASH e os eventos de transição entre WEATHER_SUNNY e WEATHER_VOLCANIC_ASH.",
    ],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todas as paredes, árvores, rochas, bordas e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo Cut, Strength, ledges, Acro Bike, escadas, warps, clima e qualquer célula com behavior não-NORMAL.
- preservar integralmente warps, NPCs, treinadores, itens visíveis/ocultos, triggers, bg_events, collision, elevação e physical originais.
- preservar qualquer célula escrita por setmetatile e qualquer corredor usado por progressão roteirizada.
- não inventar metatile IDs, saídas, árvores, boulders, ledges, entradas, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e atlas real.`;

function prompt(spec: Spec) {
  return `RECONSTRUA ${spec.label.toUpperCase()} EM CAMADAS SOBRE O ${spec.source.toUpperCase()} REAL ${spec.width}x${spec.height}.
Mapa ${spec.width}x${spec.height}; nome="${spec.label}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${spec.width - 2}, y=1..${spec.height - 2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${spec.preserves.map((v) => `- ${v}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
${spec.extra.map((v) => `- ${v}`).join("\n")}`;
}

function norm(v: string | null | undefined) { return (v ?? "").trim().toLowerCase(); }
function guard(context: Context, spec: Spec) {
  if (context.width !== spec.width || context.height !== spec.height) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}.` };
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) return { enabled: false, reason: `Preset bloqueado: ${spec.label} usa ${spec.mapId}; aberto ${mapId}.` };
  if (context.atlasPrimary || context.atlasSecondary) {
    if (norm(context.atlasPrimary) !== PRIMARY.toLowerCase() || norm(context.atlasSecondary) !== spec.secondary.toLowerCase()) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${PRIMARY} + ${spec.secondary}.` };
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível com progressão e behaviors funcionais preservados.` };
}
function fromAtlas(spec: Spec, w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width: w, height: h, mapId: id, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const MATA_DA_ESPERA_PRESET_ID = SPECS.mata.id;
export const TRILHA_DE_BRASA_PRESET_ID = SPECS.brasa.id;
export const PASSO_CORTADO_PRESET_ID = SPECS.passo.id;
export const MATA_DA_ESPERA_PROMPT = prompt(SPECS.mata);
export const TRILHA_DE_BRASA_PROMPT = prompt(SPECS.brasa);
export const PASSO_CORTADO_PROMPT = prompt(SPECS.passo);
export const mataDaEsperaGuard = (c: Context) => guard(c, SPECS.mata);
export const trilhaDeBrasaGuard = (c: Context) => guard(c, SPECS.brasa);
export const passoCortadoGuard = (c: Context) => guard(c, SPECS.passo);
export const mataDaEsperaGuardFromAtlas = (w: number, h: number, id: string | null | undefined, a: SavedRealAtlas | null) => fromAtlas(SPECS.mata, w, h, id, a);
export const trilhaDeBrasaGuardFromAtlas = (w: number, h: number, id: string | null | undefined, a: SavedRealAtlas | null) => fromAtlas(SPECS.brasa, w, h, id, a);
export const passoCortadoGuardFromAtlas = (w: number, h: number, id: string | null | undefined, a: SavedRealAtlas | null) => fromAtlas(SPECS.passo, w, h, id, a);
