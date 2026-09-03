import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; secondary: string; label: string; preserves: readonly string[]; extra: readonly string[]; connections: readonly string[] }

const PRIMARY = "gTileset_General";

const SPECS = {
  route104: {
    id: "piloto-rota-104-mata-costa", mapId: "MAP_ROUTE104", source: "Route104", width: 40, height: 80, secondary: "gTileset_Rustboro", label: "Rota 104 · Mata e Costa",
    preserves: [
      "borda norte para Serra do Uivo/Rustboro: x=0..39, y=0..1 -> preservar",
      "borda sul para Rota 105: x=0..39, y=78..79 -> preservar",
      "borda leste para Pampa da Espera: x=38..39, y=0..79 -> preservar",
      "palco de Ciro e saída da casa de Briney: x=13..21, y=47..55 -> preservar",
      "Briney e barco em torno de (12,51)/(12,54): x=8..16, y=48..58 -> preservar",
      "berries e acessos do setor norte: x=0..39, y=3..27 -> preservar",
      "berries e corredor costeiro central: x=1..27, y=38..46 -> preservar",
    ],
    extra: [
      "preservar LOCALID_ROUTE104_RIVAL, cujo estado pode ser fixado em (17,52), e o trigger em (17,51); toda a coreografia de aproximação/saída deve permanecer válida.",
      "preservar LOCALID_ROUTE104_BRINEY e LOCALID_ROUTE104_BOAT, VAR_BOARD_BRINEY_BOAT_STATE e todos os movimentos de embarque/partida; a água navegada pelo barco é behavior funcional e não pode mudar.",
      "preservar warps para Petalburg Woods/Mata da Espera, casa de Briney e floricultura, além de berries, itens e treinadores reais.",
      "visual livre: mata atlântica de borda, faixa costeira e solo quente, sem transformar a rota em corredor reto ou cobrir acessos às construções.",
    ],
    connections: ["saida norte -> MAP_RUSTBORO_CITY offset 0", "saida sul -> MAP_ROUTE105 offset 0", "saida leste -> MAP_PETALBURG_CITY offset 50"],
  },
  route105: {
    id: "piloto-rota-105-costa-rochosa", mapId: "MAP_ROUTE105", source: "Route105", width: 40, height: 80, secondary: "gTileset_Dewford", label: "Rota 105 · Costa Rochosa",
    preserves: [
      "borda norte para Rota 104: x=0..39, y=0..1 -> preservar",
      "borda sul para Rota 106: x=0..39, y=78..79 -> preservar",
      "entrada de Island Cave em (9,20): x=6..12, y=17..23 -> preservar",
      "faixa de nadadores e corrente de água norte/centro: x=0..39, y=3..64 -> preservar",
      "itens e área terrestre sul: x=2..18, y=52..76 -> preservar",
    ],
    extra: [
      "preservar a connection não-cardinal direction=dive para MAP_UNDERWATER_ROUTE105; ela permanece no map.json e não deve ser convertida em north/east/south/west.",
      "preservar todos os behaviors de água/Dive, os grandes movement ranges dos nadadores, a entrada de Island Cave, Iron, Heart Scale, Big Pearl e Pokémon de Arauna.",
      "visual livre somente em ilhotas/praia NORMAL: costa rochosa, vegetação baixa e areia discreta; não redesenhar o mar navegável.",
    ],
    connections: ["saida norte -> MAP_ROUTE104 offset 0", "saida sul -> MAP_ROUTE106 offset 0"],
  },
  route106: {
    id: "piloto-rota-106-enseada", mapId: "MAP_ROUTE106", source: "Route106", width: 80, height: 20, secondary: "gTileset_Dewford", label: "Rota 106 · Enseada",
    preserves: [
      "borda norte para Rota 105: x=0..79, y=0..1 -> preservar",
      "borda sul para Porto das Redes/Dewford: x=0..79, y=18..19 -> preservar",
      "entrada de Granite Cave em (48,16): x=45..51, y=13..19 -> preservar",
      "mar e nadadores no setor oeste/central: x=0..39, y=2..17 -> preservar",
      "praia com pescadores, itens ocultos e caverna: x=40..72, y=8..19 -> preservar",
    ],
    extra: [
      "preservar Protein em (29,14), três hidden items costeiros, placa, Pokémon de Arauna e sight/movement ranges dos nadadores e pescadores.",
      "visual livre: enseada brasileira com praia estreita e rocha clara; não alterar a boca da Granite Cave nem a continuidade aquática.",
    ],
    connections: ["saida norte -> MAP_ROUTE105 offset 0", "saida sul -> MAP_DEWFORD_TOWN offset 60"],
  },
  route107: {
    id: "piloto-rota-107-canal", mapId: "MAP_ROUTE107", source: "Route107", width: 60, height: 20, secondary: "gTileset_Dewford", label: "Rota 107 · Canal",
    preserves: [
      "borda oeste para Porto das Redes/Dewford: x=0..1, y=0..19 -> preservar",
      "borda leste para Rota 108: x=58..59, y=0..19 -> preservar",
      "canal aquático inteiro e sete treinadores: x=2..57, y=2..17 -> preservar",
    ],
    extra: [
      "a rota é essencialmente aquática; preservar água, trajetórias longas e sight lines de Darrin, Tony, Denise, Beth, Lisa, Ray e Camron.",
      "qualquer mudança visual deve limitar-se a piso NORMAL comprovado nas margens/ilhotas; não estreitar o canal nem criar terra no caminho dos nadadores.",
    ],
    connections: ["saida oeste -> MAP_DEWFORD_TOWN offset 0", "saida leste -> MAP_ROUTE108 offset 0"],
  },
  route108: {
    id: "piloto-rota-108-mar-navio", mapId: "MAP_ROUTE108", source: "Route108", width: 60, height: 20, secondary: "gTileset_Slateport", label: "Rota 108 · Mar do Navio Perdido",
    preserves: [
      "borda oeste para Rota 107: x=0..1, y=0..19 -> preservar",
      "borda leste para Rota 109: x=58..59, y=0..19 -> preservar",
      "entrada do Navio Perdido em (29,6): x=26..32, y=3..9 -> preservar",
      "mar e nadadores da rota: x=2..57, y=2..17 -> preservar",
      "ilha de Star Piece e dupla de treinadores: x=38..46, y=2..8 -> preservar",
    ],
    extra: [
      "preservar o warp MAP_ABANDONED_SHIP_DECK, Rare Candy oculto em (38,14), Star Piece em (42,4) e movement ranges de todos os nadadores.",
      "visual livre apenas em piso terrestre NORMAL: destroços/ilhas costeiras sugeridos somente com metatiles reais existentes; não inventar novos objetos ou alterar o casco/warp do navio.",
    ],
    connections: ["saida oeste -> MAP_ROUTE107 offset 0", "saida leste -> MAP_ROUTE109 offset -40"],
  },
  route109: {
    id: "piloto-rota-109-praia-porto", mapId: "MAP_ROUTE109", source: "Route109", width: 40, height: 63, secondary: "gTileset_Slateport", label: "Rota 109 · Praia de Porto do Sal",
    preserves: [
      "borda norte para Porto do Sal/Slateport: x=0..39, y=0..1 -> preservar",
      "borda oeste para Rota 108: x=0..1, y=0..62 -> preservar",
      "Briney e barco em (21,24)/(21,26): x=17..25, y=20..31 -> preservar",
      "casa de praia e setor infantil norte: x=7..35, y=3..20 -> preservar",
      "praia central com treinadores, itens e castelo de areia: x=5..35, y=21..48 -> preservar",
      "corredor sul e pescadores: x=12..28, y=49..62 -> preservar",
    ],
    extra: [
      "preservar LOCALID_ROUTE109_BRINEY/BOAT e toda a partida para Dewford; o barco cruza uma longa sequência de água e essa água deve permanecer behavior funcional.",
      "preservar o warp da Seashore House, PP Up, Potion, hidden items, Soft Sand, treinadores e todos os NPCs da praia.",
      "visual livre: praia mais orgânica e brasileira, com areia/vegetação costeira existentes no atlas; não mudar a posição funcional da doca do barco.",
    ],
    connections: ["saida norte -> MAP_SLATEPORT_CITY offset 0", "saida oeste -> MAP_ROUTE108 offset 40"],
  },
  route110: {
    id: "piloto-rota-110-corredor-encruzilhada", mapId: "MAP_ROUTE110", source: "Route110", width: 40, height: 100, secondary: "gTileset_Mauville", label: "Rota 110 · Corredor de Encruzilhada",
    preserves: [
      "borda norte para Encruzilhada/Mauville: x=0..39, y=0..1 -> preservar",
      "borda sul para Porto do Sal/Slateport: x=0..39, y=98..99 -> preservar",
      "borda oeste para Rota 103: x=0..1, y=0..99 -> preservar",
      "Cycling Road e seus corredores elevados: x=7..32, y=20..86 -> preservar",
      "palco de Ciro em (34,54) e triggers (33..35,56): x=30..38, y=50..61 -> preservar",
      "bloqueio do Horizonte/Aqua no sul: x=4..13, y=79..88 -> preservar",
      "berries e setor norte: x=2..10, y=7..14 -> preservar",
    ],
    extra: [
      "preservar LOCALID_ROUTE110_RIVAL e LOCALID_ROUTE110_RIVAL_ON_BIKE em (34,54), os três RivalTrigger em x=33,34,35 y=56 e toda a coreografia de aproximação/saída.",
      "preservar todos os ciclistas em elevation 4 e seus movement ranges longos; a Cycling Road não pode ser nivelada, estreitada ou atravessada por piso comum.",
      "preservar cinco objetos do Horizonte/Aqua em torno de (7..10,82..83), Trick House, entradas da Cycling Road, itens e todos os warps/eventos existentes.",
      "visual livre fora dos corredores: transição de várzea/campo para infraestrutura da Encruzilhada, usando apenas General + Mauville reais.",
    ],
    connections: ["saida norte -> MAP_MAUVILLE_CITY offset 0", "saida sul -> MAP_SLATEPORT_CITY offset 0", "saida oeste -> MAP_ROUTE103 offset 60"],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todos os comportamentos funcionais do mapa real, especialmente água, Dive, Surf, ledges, Cycling Road, elevações, warps, portas e qualquer behavior não-NORMAL.
- preservar integralmente object_events, warp_events, coord_events, bg_events, collision, elevation, physical, flags, sight lines e movement ranges.
- preservar moldura/bordas de conexão; connections cardeais listadas abaixo devem permanecer idênticas ao map.json real.
- connections não-cardinais como dive não são modeladas pelo AiMapPlan e devem permanecer intocadas no map.json.
- não inventar metatile IDs, água, areia, pedras, construções, atalhos, warps, eventos ou connections.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e atlas real; reserved/protected cells sempre vencem.`;

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
    if (norm(context.atlasPrimary) !== PRIMARY.toLowerCase() || norm(context.atlasSecondary) !== spec.secondary.toLowerCase()) return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${PRIMARY} + ${spec.secondary}.` };
  }
  return { enabled: true, reason: `${spec.label}: preset costeiro disponível com navegação, cenas e conexões preservadas.` };
}
function fromAtlas(spec: Spec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width, height, mapId, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const ROTAS_COSTEIRAS_SPECS = SPECS;
export const ROTAS_COSTEIRAS_PRESETS = Object.values(SPECS).map((spec) => ({
  id: spec.id, label: spec.label, prompt: prompt(spec),
  guard: (context: Context) => guard(context, spec),
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(spec, width, height, mapId, atlas),
})) as readonly {
  id: string; label: string; prompt: string;
  guard: (context: Context) => { enabled: boolean; reason: string };
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => { enabled: boolean; reason: string };
}[];
