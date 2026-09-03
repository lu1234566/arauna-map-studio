import type { SavedRealAtlas } from "./realAtlasStore";

interface Context { width: number; height: number; mapId?: string | null; atlasPrimary?: string | null; atlasSecondary?: string | null }
interface Spec { id: string; mapId: string; source: string; width: number; height: number; secondary: string; label: string; preserves: readonly string[]; extra: readonly string[]; connections: readonly string[] }

const PRIMARY = "gTileset_General";

const SPECS = {
  route112: {
    id: "piloto-rota-112-encosta-serra", mapId: "MAP_ROUTE112", source: "Route112", width: 40, height: 60, secondary: "gTileset_Lavaridge", label: "Rota 112 · Encosta da Serra",
    preserves: [
      "borda norte para Rota 113: x=0..39, y=0..1 -> preservar",
      "borda oeste para Casa da Cinza/Lavaridge: x=0..1, y=0..59 -> preservar",
      "borda leste para Rota 111: x=38..39, y=0..59 -> preservar",
      "estação do teleférico e dois warps em (28..29,27): x=24..33, y=23..32 -> preservar",
      "dois Lembrantes/Magma em (26,30)/(27,30): x=23..30, y=27..34 -> preservar",
      "acesso ao Jagged Pass em (6..7,46): x=3..10, y=43..51 -> preservar",
      "entrada sul de Fiery Path em (11,36): x=8..14, y=33..39 -> preservar",
      "entrada norte de Fiery Path em (22,10): x=19..25, y=7..13 -> preservar",
      "berries e treinadores do platô norte: x=25..34, y=3..14 -> preservar",
    ],
    extra: [
      "preservar os seis warp_events, todos os ledges/elevações e os acessos ao teleférico, Jagged Pass e Fiery Path.",
      "preservar LOCALID_ROUTE112_GRUNT_1/2, sight lines dos treinadores, berries, Nugget e placas.",
      "visual livre: encosta vulcânica de solo quente e vegetação mais seca, sem mover escadas, rampas, penhascos ou entradas.",
    ],
    connections: ["saida norte -> MAP_ROUTE113 offset -60", "saida oeste -> MAP_LAVARIDGE_TOWN offset 40", "saida leste -> MAP_ROUTE111 offset -20"],
  },
  route113: {
    id: "piloto-rota-113-campo-cinzas", mapId: "MAP_ROUTE113", source: "Route113", width: 100, height: 20, secondary: "gTileset_Fallarbor", label: "Rota 113 · Campo de Cinzas",
    preserves: [
      "borda sul para Rota 112: x=0..99, y=18..19 -> preservar",
      "borda oeste para Campo das Cinzas/Fallarbor: x=0..1, y=0..19 -> preservar",
      "borda leste para Rota 111: x=98..99, y=0..19 -> preservar",
      "fronteira oeste de weather triggers em x=14 e x=19: x=12..21, y=8..16 -> preservar",
      "fronteira leste de weather triggers em x=85..94: x=83..96, y=4..13 -> preservar",
      "Glass Workshop e warp em (33,5): x=29..36, y=2..8 -> preservar",
      "entrada Terra Cave em (41,12): x=38..44, y=9..15 -> preservar",
      "entrada Terra Cave em (88,5): x=85..91, y=2..8 -> preservar",
      "setor dos treinadores enterrados em (29,6)/(71,2): x=26..32, y=3..9 -> preservar",
      "setor do treinador enterrado leste em (71,2): x=68..77, y=0..7 -> preservar",
    ],
    extra: [
      "preservar todos os COORD_EVENT_WEATHER_VOLCANIC_ASH/SUNNY: eles delimitam a transição de clima e não podem ser separados do corredor navegável.",
      "preservar ash/tall-grass/secret-base behaviors, os três warps, itens e trainers buried exatamente nas células reais.",
      "visual livre: campo de cinza vulcânica amplo e ventoso usando apenas General + Fallarbor; não pintar por cima de solo coletável/ash behavior.",
    ],
    connections: ["saida sul -> MAP_ROUTE112 offset 60", "saida oeste -> MAP_FALLARBOR_TOWN offset 0", "saida leste -> MAP_ROUTE111 offset 0"],
  },
  route114: {
    id: "piloto-rota-114-vale-rochoso", mapId: "MAP_ROUTE114", source: "Route114", width: 40, height: 80, secondary: "gTileset_Fallarbor", label: "Rota 114 · Vale Rochoso",
    preserves: [
      "borda oeste para Rota 115: x=0..1, y=0..79 -> preservar",
      "borda leste para Campo das Cinzas/Fallarbor: x=38..39, y=0..79 -> preservar",
      "entrada anormal norte em (7,3)/(7,4): x=4..10, y=0..7 -> preservar",
      "entrada anormal sul em (6,45)/(6,46): x=3..9, y=42..49 -> preservar",
      "rio, pescadores e acessos do setor norte: x=16..34, y=3..31 -> preservar",
      "berries e dupla de treinadores em torno de (31,43..45): x=21..34, y=39..48 -> preservar",
      "encostas elevadas e Rock Smash do sul: x=8..33, y=50..76 -> preservar",
      "Pokémon de Arauna em (10,53): x=7..13, y=50..56 -> preservar",
      "Pokémon de Arauna em (32,30): x=29..35, y=27..33 -> preservar",
    ],
    extra: [
      "preservar as duas entradas criadas por AbnormalWeather: norte escreve (7,3)/(7,4), sul escreve (6,45)/(6,46).",
      "preservar todos os Rock Smash, secret bases, warps para casas/túneis, rios, elevações 4/5/7, trainers e itens.",
      "visual livre: vale fluvial rochoso com mata de encosta; não nivelar as plataformas nem alterar travessias de água.",
    ],
    connections: ["saida oeste -> MAP_ROUTE115 offset 40", "saida leste -> MAP_FALLARBOR_TOWN offset 0"],
  },
  route115: {
    id: "piloto-rota-115-costa-serra", mapId: "MAP_ROUTE115", source: "Route115", width: 40, height: 80, secondary: "gTileset_Fallarbor", label: "Rota 115 · Costa da Serra",
    preserves: [
      "borda sul para Serra do Uivo/Rustboro: x=0..39, y=78..79 -> preservar",
      "borda leste para Rota 114: x=38..39, y=0..79 -> preservar",
      "entrada anormal oeste em (21,5)/(21,6): x=18..24, y=2..9 -> preservar",
      "entrada anormal leste em (36,9)/(36,10): x=33..39, y=6..13 -> preservar",
      "entrada Meteor Falls em (27,37): x=24..30, y=34..40 -> preservar",
      "platô norte com berries/treinadores/itens: x=5..32, y=3..19 -> preservar",
      "setor central de caverna e relevo: x=7..34, y=25..44 -> preservar",
      "setor sul de Rock Smash, berries e treinadores: x=12..34, y=47..72 -> preservar",
    ],
    extra: [
      "preservar AbnormalWeather west/east exatamente em (21,5)/(21,6) e (36,9)/(36,10); os warps para Terra Cave já existem e dependem dessas bocas.",
      "preservar Meteor Falls, secret bases, Rock Smash, berries, itens, trainers e toda água/relevo funcional.",
      "visual livre: costa serrana com paredões e vegetação de altitude, sem criar atalho entre platôs ou mudar acesso à cachoeira/cavernas.",
    ],
    connections: ["saida sul -> MAP_RUSTBORO_CITY offset 0", "saida leste -> MAP_ROUTE114 offset -40"],
  },
  route116: {
    id: "piloto-rota-116-caminho-tunel", mapId: "MAP_ROUTE116", source: "Route116", width: 100, height: 20, secondary: "gTileset_Rustboro", label: "Rota 116 · Caminho do Túnel",
    preserves: [
      "borda sul para Vale do Silêncio/Verdanturf: x=0..99, y=18..19 -> preservar",
      "borda oeste para Serra do Uivo/Rustboro: x=0..1, y=0..19 -> preservar",
      "berries, Cut e itens do setor oeste: x=8..36, y=0..19 -> preservar",
      "palco de Briney/Devon/Wanda BF em x=38..46: x=34..50, y=5..14 -> preservar",
      "entrada anormal norte em (59,12)/(59,13): x=56..62, y=9..16 -> preservar",
      "itens e corredores do setor leste: x=52..84, y=5..17 -> preservar",
    ],
    extra: [
      "preservar os cinco Cut trees, trainers e sight lines do corredor; nenhuma árvore funcional pode ser absorvida pela decoração.",
      "preservar LOCALID_ROUTE116_BRINEY em (46,9), Devon employee em (46,11) e LOCALID_ROUTE116_WANDAS_BF, que pode ser fixado por script em (38,10).",
      "preservar AbnormalWeather em (59,12)/(59,13), todos os warps/secret bases/itens e as entradas do túnel/rest house.",
      "visual livre: estrada pedregosa de pé de serra, mata baixa e cortes de rocha; manter o corredor longo legível e funcional.",
    ],
    connections: ["saida sul -> MAP_VERDANTURF_TOWN offset 80", "saida oeste -> MAP_RUSTBORO_CITY offset 0"],
  },
  route117: {
    id: "piloto-rota-117-campos-encruzilhada", mapId: "MAP_ROUTE117", source: "Route117", width: 60, height: 20, secondary: "gTileset_Mauville", label: "Rota 117 · Campos de Encruzilhada",
    preserves: [
      "borda oeste para Vale do Silêncio/Verdanturf: x=0..1, y=0..19 -> preservar",
      "borda leste para Encruzilhada/Mauville: x=58..59, y=0..19 -> preservar",
      "Cut tree e treinadores do setor oeste: x=6..24, y=0..18 -> preservar",
      "corredor central e Pokémon overworld: x=23..45, y=0..18 -> preservar",
      "Day Care, homem e warp em (47..51,4..5): x=44..55, y=1..9 -> preservar",
      "berries e dupla de treinadores no leste: x=39..46, y=10..16 -> preservar",
    ],
    extra: [
      "preservar o warp MAP_ROUTE117_POKEMON_DAY_CARE em (51,5), LOCALID_DAYCARE_MAN em (47,4), placas e todos os Pokémon overworld.",
      "preservar o Cut tree em (15,2), berry trees, itens, corredores dos corredores/triathletes e todas as sight lines.",
      "visual livre: campos rurais abertos entre Vale do Silêncio e Encruzilhada, com vegetação baixa e caminho de terra discreto.",
    ],
    connections: ["saida oeste -> MAP_VERDANTURF_TOWN offset 0", "saida leste -> MAP_MAUVILLE_CITY offset 0"],
  },
} as const satisfies Record<string, Spec>;

const SAFETY = `- preservar todos os behaviors funcionais do mapa real: água/Surf, tall grass/ash, ledges, escadas, Cut, Rock Smash, secret bases, elevações, warps, portas e qualquer behavior não-NORMAL.
- preservar integralmente object_events, warp_events, coord_events, bg_events, collision, elevation, physical, flags, sight lines e movement ranges.
- preservar toda célula escrita em runtime por setmetatile/setobjectxyperm e as áreas de aproximação necessárias às cenas.
- preservar as bordas de conexão e manter idênticas as connections cardeais listadas abaixo.
- não inventar metatile IDs, água, relevo, construções, atalhos, warps, eventos ou connections.
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
  return { enabled: true, reason: `${spec.label}: preset disponível com relevo, cenas, runtime geometry e conexões preservados.` };
}
function fromAtlas(spec: Spec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) { return guard({ width, height, mapId, atlasPrimary: atlas?.primary, atlasSecondary: atlas?.secondary }, spec); }

export const ROTAS_INTERIORES_SPECS = SPECS;
export const ROTAS_INTERIORES_PRESETS = Object.values(SPECS).map((spec) => ({
  id: spec.id, label: spec.label, prompt: prompt(spec),
  guard: (context: Context) => guard(context, spec),
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(spec, width, height, mapId, atlas),
})) as readonly {
  id: string; label: string; prompt: string;
  guard: (context: Context) => { enabled: boolean; reason: string };
  guardFromAtlas: (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => { enabled: boolean; reason: string };
}[];
