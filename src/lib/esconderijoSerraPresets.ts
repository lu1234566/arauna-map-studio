import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; label: string; preserves: readonly string[]; extra: readonly string[] }

const PRIMARY = "gTileset_General";
const SECONDARY = "gTileset_Lavaridge";

const SPECS = {
  floor1: {
    id: "piloto-esconderijo-serra-1f", mapId: "MAP_MAGMA_HIDEOUT_1F", source: "MagmaHideout_1F", width: 37, height: 38, label: "Esconderijo da Serra · 1F",
    preserves: [
      "saída para Passo Cortado em (10,34): x=8..12, y=32..36 -> preservar",
      "acesso 2F ala 1 em (25,34): x=23..27, y=32..36 -> preservar",
      "acesso 2F ala 2 em (31,3): x=29..33, y=1..5 -> preservar",
      "acesso 2F ala 3 em (20,22): x=18..22, y=20..24 -> preservar",
      "puzzle de Strength em torno de (5,22), (7,22) e (6,23): x=2..10, y=19..27 -> preservar",
    ],
    extra: [
      "preservar os três boulders de Strength, seus espaços de empurrão e todos os quatro warps do mapa.",
      "preservar MAP_SCRIPT_ON_TRANSITION que zera VAR_JAGGED_PASS_ASH_WEATHER ao entrar no esconderijo.",
    ],
  },
  floor2r1: {
    id: "piloto-esconderijo-serra-2f-ala1", mapId: "MAP_MAGMA_HIDEOUT_2F_1R", source: "MagmaHideout_2F_1R", width: 33, height: 39, label: "Esconderijo da Serra · 2F · Ala 1",
    preserves: [
      "warp para 2F ala 2 em (11,23): x=9..13, y=21..25 -> preservar",
      "retorno 1F em (8,2): x=6..10, y=0..4 -> preservar",
      "acesso 3F ala 1 em (17,33): x=15..19, y=31..35 -> preservar",
      "corredores de patrulha dos quatro treinadores: x=5..24, y=5..24 -> preservar",
    ],
    extra: ["preservar sight lines e faixas de movimento dos quatro treinadores; a remodelagem não pode criar bloqueios artificiais entre eles e o jogador."],
  },
  floor2r2: {
    id: "piloto-esconderijo-serra-2f-ala2", mapId: "MAP_MAGMA_HIDEOUT_2F_2R", source: "MagmaHideout_2F_2R", width: 49, height: 28, label: "Esconderijo da Serra · 2F · Ala 2",
    preserves: [
      "warp para 2F ala 1 em (10,22): x=8..12, y=20..24 -> preservar",
      "retorno 1F em (36,4): x=34..38, y=2..6 -> preservar",
      "núcleo de treinadores e itens: x=5..32, y=4..16 -> preservar",
    ],
    extra: ["preservar Max Elixir em (21,7), Full Restore em (14,6) e as linhas de visão dos quatro treinadores."],
  },
  floor2r3: {
    id: "piloto-esconderijo-serra-2f-ala3", mapId: "MAP_MAGMA_HIDEOUT_2F_3R", source: "MagmaHideout_2F_3R", width: 60, height: 19, label: "Esconderijo da Serra · 2F · Ala 3",
    preserves: [
      "retorno 1F em (16,1): x=14..18, y=0..3 -> preservar",
      "acesso 3F ala 3 em (16,13): x=14..18, y=11..15 -> preservar",
      "corredor vertical que liga os dois warps: x=13..19, y=0..16 -> preservar",
    ],
    extra: ["esta ala é uma ligação pura entre dois níveis; não criar atalhos laterais que anulem o percurso real."],
  },
  floor3r1: {
    id: "piloto-esconderijo-serra-3f-ala1", mapId: "MAP_MAGMA_HIDEOUT_3F_1R", source: "MagmaHideout_3F_1R", width: 28, height: 24, label: "Esconderijo da Serra · 3F · Ala 1",
    preserves: [
      "acesso 4F em (7,21): x=5..9, y=19..23 -> preservar",
      "acesso 3F ala 2 em (21,9): x=19..23, y=7..11 -> preservar",
      "retorno 2F ala 1 em (23,3): x=21..25, y=1..5 -> preservar",
      "treinadores e Nugget: x=0..24, y=5..23 -> preservar",
    ],
    extra: ["preservar a diferença de elevação dos treinadores e warps; não nivelar corredores que dependem de elevation 0/4."],
  },
  floor3r2: {
    id: "piloto-esconderijo-serra-3f-ala2", mapId: "MAP_MAGMA_HIDEOUT_3F_2R", source: "MagmaHideout_3F_2R", width: 24, height: 17, label: "Esconderijo da Serra · 3F · Ala 2",
    preserves: [
      "retorno 3F ala 1 em (12,15): x=10..14, y=13..16 -> preservar",
      "treinador em (16,3): x=13..19, y=1..6 -> preservar",
      "PP Max em (5,9): x=3..7, y=7..11 -> preservar",
    ],
    extra: ["preservar o único caminho de retorno; não criar uma segunda saída ou conexão de borda."],
  },
  floor3r3: {
    id: "piloto-esconderijo-serra-3f-ala3", mapId: "MAP_MAGMA_HIDEOUT_3F_3R", source: "MagmaHideout_3F_3R", width: 33, height: 24, label: "Esconderijo da Serra · 3F · Ala 3",
    preserves: [
      "retorno 2F ala 3 em (16,1): x=14..18, y=0..3 -> preservar",
      "acesso 4F em (16,21): x=14..18, y=19..23 -> preservar",
      "Escape Rope em (9,19): x=7..11, y=17..21 -> preservar",
      "eixo vertical entre os dois warps: x=13..19, y=0..23 -> preservar",
    ],
    extra: ["preservar o percurso vertical e o item real; não transformar a ala em corredor direto sem os obstáculos existentes."],
  },
  floor4: {
    id: "piloto-esconderijo-serra-4f", mapId: "MAP_MAGMA_HIDEOUT_4F", source: "MagmaHideout_4F", width: 59, height: 28, label: "Esconderijo da Serra · 4F · Câmara de Luzia",
    preserves: [
      "câmara central da criatura e Luzia: x=13..24, y=14..24 -> preservar",
      "Raul e guardas no corredor norte/leste: x=20..34, y=2..24 -> preservar",
      "warp 3F ala 1 em (46,7): x=44..48, y=5..9 -> preservar",
      "warp 3F ala 3 em (20,21): x=18..22, y=19..23 -> preservar",
      "Max Revive em (3,7): x=1..5, y=5..9 -> preservar",
    ],
    extra: [
      "preservar byte a byte o palco narrativo em torno de (16,17) e (16,21): Groudon dormindo/desperto, Luzia/Maxie e todos os movement scripts usam esse eixo.",
      "preservar LOCALID_MAGMA_HIDEOUT_4F_GROUDON, GROUDON_SLEEPING, MAXIE, TABITHA/RAUL e os três grunts, inclusive suas células de aproximação.",
      "preservar a sequência DoOrbEffect, ShakeCamera, remoção/adição de objetos e a posição relativa necessária para GroudonApproach e GroudonExit.",
      "não reinterpretar dofieldeffectsparkle 18,42: é comportamento herdado do pokeemerald e não deve orientar nova geometria.",
    ],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todas as paredes, rochas, lava, bordas, desníveis e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo Strength, escadas, warps, ledges, mudanças de elevação e qualquer célula com behavior não-NORMAL.
- preservar integralmente warps, NPCs, treinadores, itens, flags, triggers, scripts de transição, collision, elevação e physical originais.
- preservar sight lines e movement ranges dos treinadores sempre que o mapa real os utiliza para progressão ou combate.
- não inventar metatile IDs, saídas, boulders, lava, escadas, warps, atalhos ou connections.
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
    if (norm(context.atlasPrimary) !== PRIMARY.toLowerCase() || norm(context.atlasSecondary) !== SECONDARY.toLowerCase()) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${PRIMARY} + ${SECONDARY}.` };
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível com progressão, warps e behaviors funcionais preservados.` };
}
function fromAtlas(spec: Spec, w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width: w, height: h, mapId: id, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const ESCONDERIJO_SERRA_SPECS = SPECS;
export const ESCONDERIJO_SERRA_PRESETS = Object.values(SPECS).map((spec) => ({ id: spec.id, label: spec.label, prompt: prompt(spec), guard: (c: Context) => guard(c, spec), guardFromAtlas: (w: number, h: number, id: string | null | undefined, a: SavedRealAtlas | null) => fromAtlas(spec, w, h, id, a) })) as readonly {
  id: string; label: string; prompt: string; guard: (c: Context) => { enabled: boolean; reason: string }; guardFromAtlas: (w: number, h: number, id: string | null | undefined, a: SavedRealAtlas | null) => { enabled: boolean; reason: string };
}[];
