import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; label: string; preserves: readonly string[]; extra: readonly string[] }

const PRIMARY = "gTileset_General";
const SECONDARY = "gTileset_Facility";

const SPECS = {
  floor1: {
    id: "piloto-arquivo-central-1f", mapId: "MAP_AQUA_HIDEOUT_1F", source: "AquaHideout_1F", width: 28, height: 30, label: "Arquivo Central · 1F",
    preserves: [
      "guardas de bloqueio da entrada em (13,11) e (14,11): x=11..16, y=9..13 -> preservar",
      "saída dupla para Lilycove/Porto do Sal em (13,27) e (14,27): x=11..16, y=25..29 -> preservar",
      "acesso B1F em (22,1): x=20..24, y=0..3 -> preservar",
      "patrulha do treinador interno em torno de (20,4): x=7..23, y=1..10 -> preservar",
    ],
    extra: [
      "preservar os dois guardas narrativos e a lógica de dicas condicionada por FLAG_GROUDON_AWAKENED_MAGMA_HIDEOUT e FLAG_RECEIVED_RED_OR_BLUE_ORB.",
      "preservar os três warps reais; a entrada bloqueada deve continuar fisicamente compatível com os dois NPCs lado a lado.",
    ],
  },
  floorB1: {
    id: "piloto-arquivo-central-b1f", mapId: "MAP_AQUA_HIDEOUT_B1F", source: "AquaHideout_B1F", width: 51, height: 24, label: "Arquivo Central · B1F · Rede de Teleportes",
    preserves: [
      "escadas e acessos de nível no norte: x=1..33, y=0..6 -> preservar",
      "rede principal de teleportes oeste/centro: x=1..34, y=2..22 -> preservar",
      "matriz de teleportes leste: x=40..50, y=1..19 -> preservar",
      "cofre de Master Ball, Nugget e Electrode em x=13..18, y=7..12 -> preservar",
      "treinadores e itens no setor central/leste: x=18..33, y=10..23 -> preservar",
    ],
    extra: [
      "preservar todos os 25 warp_events byte a byte e em suas coordenadas atuais; muitos apontam para outros warp ids do próprio B1F e formam o labirinto de teleporte.",
      "preservar Master Ball em (15,9), Nugget em (15,10), Electrode 1 em (16,9) e Electrode 2 em (16,10), inclusive flags e scripts de batalha/remoção.",
      "preservar MAP_SCRIPT_ON_RESUME/MAP_SCRIPT_ON_TRANSITION e FLAG_SYS_CTRL_OBJ_DELETE, FLAG_DEFEATED_ELECTRODE_1_AQUA_HIDEOUT e FLAG_DEFEATED_ELECTRODE_2_AQUA_HIDEOUT.",
      "não deslocar, espelhar, ordenar ou simplificar nenhum teleporte; a aparente desordem é mecânica de progressão, não ruído visual.",
    ],
  },
  floorB2: {
    id: "piloto-arquivo-central-b2f", mapId: "MAP_AQUA_HIDEOUT_B2F", source: "AquaHideout_B2F", width: 34, height: 24, label: "Arquivo Central · B2F · Doca do Submersível",
    preserves: [
      "três retornos B1F no norte em (18,1), (12,1) e (3,3): x=1..20, y=0..5 -> preservar",
      "rede interna de teleportes: x=3..33, y=6..22 -> preservar",
      "palco de Campo/Matt e submersível: x=17..31, y=15..23 -> preservar",
      "corredor de saída do submersível para a esquerda: x=14..21, y=18..22 -> preservar",
      "triggers de detecção em (28,16) e (28,17): x=26..30, y=14..19 -> preservar",
      "treinadores e Nest Ball: x=1..26, y=3..15 -> preservar",
    ],
    extra: [
      "preservar todos os dez warp_events do B2F e seus pares; a rede de teleportes não pode ser reorganizada.",
      "preservar LOCALID_AQUA_HIDEOUT_MATT em (23,19) e LOCALID_AQUA_HIDEOUT_SUBMARINE em (19,20), além dos dois triggers VAR_TEMP_1 em (28,16)/(28,17).",
      "preservar AquaHideout_B2F_Movement_SumbarineDepartLeft: o submersível anda quatro tiles à esquerda antes de removeobject; todo esse corredor deve permanecer livre e na mesma elevação.",
      "preservar FLAG_TEAM_AQUA_ESCAPED_IN_SUBMARINE e a lógica OnTransition que impede Matt de notar o jogador depois da fuga.",
    ],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todas as paredes, divisórias, portas, terminais, máquinas e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo teleportes, escadas, warps, portas, transições e qualquer célula com behavior não-NORMAL.
- preservar integralmente warp_events, NPCs, treinadores, itens, flags, triggers, collision, elevação, physical e células de aproximação.
- preservar sight lines e movement ranges dos treinadores e todo corredor usado por movimento roteirizado de NPC/objeto.
- preservar qualquer estrutura cuja posição seja referenciada por local id, warp id, flag ou script de batalha/evento.
- não inventar metatile IDs, teleportes, escadas, portas, objetos, atalhos, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e atlas real.`;

function prompt(spec: Spec) {
  return `RECONSTRUA ${spec.label.toUpperCase()} EM CAMADAS SOBRE O ${spec.source.toUpperCase()} REAL ${spec.width}x${spec.height}.
Mapa ${spec.width}x${spec.height}; nome="${spec.label}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${spec.width - 2}, y=1..${spec.height - 2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${spec.preserves.map((value) => `- ${value}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
${spec.extra.map((value) => `- ${value}`).join("\n")}`;
}

function norm(value: string | null | undefined) { return (value ?? "").trim().toLowerCase(); }
function guard(context: Context, spec: Spec) {
  if (context.width !== spec.width || context.height !== spec.height) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}.` };
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) return { enabled: false, reason: `Preset bloqueado: ${spec.label} usa ${spec.mapId}; aberto ${mapId}.` };
  if (context.atlasPrimary || context.atlasSecondary) {
    if (norm(context.atlasPrimary) !== PRIMARY.toLowerCase() || norm(context.atlasSecondary) !== SECONDARY.toLowerCase()) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${PRIMARY} + ${SECONDARY}.` };
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível com teleportes, eventos e behaviors funcionais preservados.` };
}
function fromAtlas(spec: Spec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width, height, mapId, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const ARQUIVO_CENTRAL_SPECS = SPECS;
export const ARQUIVO_CENTRAL_PRESETS = Object.values(SPECS).map((spec) => ({
  id: spec.id,
  label: spec.label,
  prompt: prompt(spec),
  guard: (context: Context) => guard(context, spec),
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(spec, width, height, mapId, atlas),
})) as readonly {
  id: string;
  label: string;
  prompt: string;
  guard: (context: Context) => { enabled: boolean; reason: string };
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => { enabled: boolean; reason: string };
}[];
