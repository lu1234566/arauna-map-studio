import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; label: string; preserves: readonly string[]; extra: readonly string[]; connections: readonly string[] }

const PRIMARY = "gTileset_General";
const SECONDARY = "gTileset_Petalburg";

const SPECS = {
  route101: {
    id: "piloto-rota-101-terra-de-arauna", mapId: "MAP_ROUTE101", source: "Route101", width: 20, height: 20, label: "Rota 101 · Terra de Arauna",
    preserves: [
      "faixa norte de conexão com Vila da Passagem: x=0..19, y=0..1 -> preservar",
      "faixa sul de conexão com Vila Amanhecer e triggers: x=0..19, y=18..19 -> preservar",
      "palco completo do resgate de Anahi/Birch: x=0..12, y=10..19 -> preservar",
      "bolsa dos iniciais e aproximação em torno de (7,14): x=5..9, y=12..16 -> preservar",
      "NPCs e Pokémon de Arauna no leste/norte: x=11..19, y=3..17 -> preservar",
    ],
    extra: [
      "preservar LOCALID_ROUTE101_BIRCH, LOCALID_ROUTE101_ZIGZAGOON, a bolsa, todos os triggers VAR_ROUTE101_STATE e as células usadas por PreventExitSouth/West/North.",
      "preservar byte a byte o corredor de movimento roteirizado: StartBirchRescue reposiciona Birch em (0,15), Zigzagoon em (0,16), move o jogador quatro passos ao norte e executa perseguição/círculos antes da escolha do inicial.",
      "preservar setobjectxy do jogador em (6,13) e o fluxo final que envia para o laboratório; a remodelagem não pode deslocar o palco da escolha do inicial.",
      "visual fora das zonas protegidas: mata sul-brasileira clara, gramado natural e pequenos trechos de solo quente, mantendo legibilidade GBA e sem inventar objetos.",
    ],
    connections: [
      "saida norte -> MAP_OLDALE_TOWN offset 0",
      "saida sul -> MAP_LITTLEROOT_TOWN offset 0",
    ],
  },
  route102: {
    id: "piloto-rota-102-terra-de-arauna", mapId: "MAP_ROUTE102", source: "Route102", width: 50, height: 20, label: "Rota 102 · Terra de Arauna",
    preserves: [
      "faixa oeste da conexão com Pampa da Espera: x=0..1, y=0..19 -> preservar",
      "faixa leste da conexão com Vila da Passagem: x=48..49, y=0..19 -> preservar",
      "berry trees em (24,2) e (25,2): x=22..27, y=0..4 -> preservar",
      "Potion em (11,15) e seu acesso: x=9..13, y=13..17 -> preservar",
      "corredores e sight lines dos quatro treinadores: x=5..36, y=2..18 -> preservar",
      "Pokémon de Arauna oeste em (3,4): x=1..5, y=2..6 -> preservar",
      "Pokémon de Arauna leste em (44,5): x=42..46, y=3..7 -> preservar",
    ],
    extra: [
      "preservar Calvin, Rick, Tiana e Allen com sight ranges originais, berry growth ids, placas e todos os NPCs/eventos.",
      "visual livre: caminho rural horizontal entre campos baixos, pequenos bolsões de mata e solo avermelhado, sem criar obstáculos que alterem linhas de visão ou acesso às berries.",
    ],
    connections: [
      "saida oeste -> MAP_PETALBURG_CITY offset -10",
      "saida leste -> MAP_OLDALE_TOWN offset 0",
    ],
  },
  route103: {
    id: "piloto-rota-103-terra-de-arauna", mapId: "MAP_ROUTE103", source: "Route103", width: 80, height: 22, label: "Rota 103 · Terra de Arauna",
    preserves: [
      "borda norte: x=0..79, y=0..1 -> preservar",
      "borda sul e conexão com Vila da Passagem: x=0..79, y=20..21 -> preservar",
      "borda oeste: x=0..1, y=0..21 -> preservar",
      "borda leste e conexão com Rota 110: x=78..79, y=0..21 -> preservar",
      "palco do primeiro confronto com Ciro e Anahi/Birch: x=4..14, y=0..10 -> preservar",
      "canal aquático central e nadadores: x=31..47, y=2..17 -> preservar",
      "entrada dinâmica de Altering Cave em (45,5)/(45,6): x=43..47, y=3..8 -> preservar",
      "setor leste de berries, Cut, itens e treinadores: x=48..76, y=2..17 -> preservar",
      "Pokémon de Arauna oeste em (3,9): x=1..5, y=7..11 -> preservar",
      "Pokémon de Arauna central em (28,8): x=26..30, y=6..10 -> preservar",
    ],
    extra: [
      "preservar LOCALID_ROUTE103_RIVAL em (10,3), seus movimentos de saída/jump_2_down e todas as células necessárias para a cena de Ciro.",
      "preservar MAP_SCRIPT_ON_LOAD: após FLAG_SYS_GAME_CLEAR, setmetatile escreve METATILE_General_CaveEntrance_Top em (45,5) e Bottom em (45,6); essas duas células são imutáveis.",
      "preservar os dois Cut trees, três berry trees, Guard Spec, PP Up, nadadores e todas as linhas de visão/movement ranges do setor leste.",
      "visual livre: transição de campos e mata para margem d'água, com leitura costeira brasileira discreta; não reduzir o canal nem criar atalho entre as margens.",
    ],
    connections: [
      "saida sul -> MAP_OLDALE_TOWN offset 0",
      "saida leste -> MAP_ROUTE110 offset -60",
    ],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todos os comportamentos funcionais do mapa real, incluindo água, tall grass, ledges, Cut, warps, entradas dinâmicas, conexões e qualquer célula com behavior não-NORMAL.
- preservar integralmente object_events, coord_events, bg_events, flags, scripts de cena, collision, elevation, physical, sight lines e movement ranges.
- preservar a moldura externa e toda célula de conexão indicada; nenhuma saída pode mudar de lado, largura funcional ou offset.
- não inventar metatile IDs, árvores, cercas, água, estruturas, atalhos, warps, eventos ou connections.
- detalhes visuais só podem reutilizar metatiles/patterns reais compatíveis com General + Petalburg e nunca cobrir reserved/protected cells.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e atlas real.`;

function prompt(spec: Spec) {
  return `RECONSTRUA ${spec.label.toUpperCase()} EM CAMADAS SOBRE O ${spec.source.toUpperCase()} REAL ${spec.width}x${spec.height}.
Mapa ${spec.width}x${spec.height}; nome="${spec.label}"

CAMADA 1 — PISO NORMAL LIVRE
- área interna comprovada: x=1..${spec.width - 2}, y=1..${spec.height - 2} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${spec.preserves.map((value) => `- ${value}`).join("\n")}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
${spec.extra.map((value) => `- ${value}`).join("\n")}

${spec.connections.join("\n")}`;
}

function norm(value: string | null | undefined) { return (value ?? "").trim().toLowerCase(); }
function guard(context: Context, spec: Spec) {
  if (context.width !== spec.width || context.height !== spec.height) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}.` };
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) return { enabled: false, reason: `Preset bloqueado: ${spec.label} usa ${spec.mapId}; aberto ${mapId}.` };
  if (context.atlasPrimary || context.atlasSecondary) {
    if (norm(context.atlasPrimary) !== PRIMARY.toLowerCase() || norm(context.atlasSecondary) !== SECONDARY.toLowerCase()) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${PRIMARY} + ${SECONDARY}.` };
  }
  return { enabled: true, reason: `${spec.label}: preset disponível com cenas, bordas e conexões reais preservadas.` };
}
function fromAtlas(spec: Spec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width, height, mapId, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const ROTAS_INICIAIS_SPECS = SPECS;
export const ROTAS_INICIAIS_PRESETS = Object.values(SPECS).map((spec) => ({
  id: spec.id,
  label: spec.label,
  prompt: prompt(spec),
  guard: (context: Context) => guard(context, spec),
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(spec, width, height, mapId, atlas),
})) as readonly {
  id: string; label: string; prompt: string;
  guard: (context: Context) => { enabled: boolean; reason: string };
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => { enabled: boolean; reason: string };
}[];
