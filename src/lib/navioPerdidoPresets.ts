import type { SavedRealAtlas } from "./realAtlasStore";

export const NAVIO_PERDIDO_PRIMARY = "gTileset_General";
export const NAVIO_PERDIDO_SHIP_SECONDARY = "gTileset_InsideShip";
export const NAVIO_PERDIDO_FACILITY_SECONDARY = "gTileset_Facility";

export const NAVIO_PERDIDO_DECK_PRESET_ID = "piloto-navio-perdido-conves" as const;
export const NAVIO_PERDIDO_CORRIDORS_1F_PRESET_ID = "piloto-navio-perdido-corredores-1f" as const;
export const NAVIO_PERDIDO_ROOMS_1F_PRESET_ID = "piloto-navio-perdido-salas-1f" as const;
export const NAVIO_PERDIDO_CORRIDORS_B1F_PRESET_ID = "piloto-navio-perdido-corredores-b1f" as const;
export const NAVIO_PERDIDO_ROOMS_B1F_PRESET_ID = "piloto-navio-perdido-salas-b1f" as const;
export const NAVIO_PERDIDO_ROOMS2_B1F_PRESET_ID = "piloto-navio-perdido-salas2-b1f" as const;
export const NAVIO_PERDIDO_UNDERWATER1_PRESET_ID = "piloto-navio-perdido-submerso-1" as const;
export const NAVIO_PERDIDO_ROOM_B1F_PRESET_ID = "piloto-navio-perdido-sala-b1f" as const;
export const NAVIO_PERDIDO_ROOMS2_1F_PRESET_ID = "piloto-navio-perdido-salas2-1f" as const;
export const NAVIO_PERDIDO_CAPTAIN_PRESET_ID = "piloto-navio-perdido-capitao" as const;
export const NAVIO_PERDIDO_UNDERWATER2_PRESET_ID = "piloto-navio-perdido-submerso-2" as const;
export const NAVIO_PERDIDO_HIDDEN_CORRIDORS_PRESET_ID = "piloto-navio-perdido-piso-oculto-corredores" as const;
export const NAVIO_PERDIDO_HIDDEN_ROOMS_PRESET_ID = "piloto-navio-perdido-piso-oculto-salas" as const;

const SAFETY = `- preservar todas as paredes, divisórias, portas, obstáculos colidíveis e moldura do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo água, Dive, escadas, portas comportamentais, warps e qualquer célula com behavior não-NORMAL.
- preservar integralmente warps, NPCs, treinadores, itens, chaves, itens ocultos, triggers, bg_events e suas células de aproximação reservadas pelo map.json.
- preservar qualquer célula escrita por setmetatile e qualquer coordenada usada por setdivewarp, sparkle ou lógica de identificação de sala.
- preservar elevação, collision, behavior e physical originais de toda célula funcional.
- não inventar metatile IDs, portas, chaves, água, Dive, escadas, objetos, itens, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

function prompt(
  source: string,
  width: number,
  height: number,
  title: string,
  preserves: readonly string[] = [],
  extra: readonly string[] = [],
) {
  return `RECONSTRUA ${title.toUpperCase()} EM CAMADAS SOBRE O ${source.toUpperCase()} REAL ${width}x${height}.
Mapa ${width}x${height}; nome="${title}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${Math.max(1, width - 2)}, y=1..${Math.max(1, height - 2)} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${preserves.length ? preserves.map((value) => `- ${value}`).join("\n") : "- eventos, warps e corredores funcionais já identificados pelo map.json -> preservar"}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}${extra.length ? `\n${extra.map((value) => `- ${value}`).join("\n")}` : ""}`;
}

export const NAVIO_PERDIDO_DECK_PROMPT = prompt(
  "AbandonedShip_Deck", 23, 21, "Navio Perdido — Convés",
  ["todos os acessos entre exterior/convés e os objetos de exploração: x=1..21, y=1..19 -> preservar comportamentos funcionais, warps e eventos; piso NORMAL livre pode ser reorganizado"],
  ["este mapa usa General + Facility; preservar a marcação de descoberta do Navio Perdido e todos os pontos de transição do convés."],
);

export const NAVIO_PERDIDO_CORRIDORS_1F_PROMPT = prompt(
  "AbandonedShip_Corridors_1F", 18, 12, "Navio Perdido — Corredores 1F",
  ["portas e warps do corredor: preservar todas as células de acesso reservadas pelo map.json"],
);

export const NAVIO_PERDIDO_ROOMS_1F_PROMPT = prompt(
  "AbandonedShip_Rooms_1F", 18, 17, "Navio Perdido — Salas 1F",
  ["salas com NPCs/treinadores/itens e suas entradas: preservar todas as células reservadas pelo map.json"],
);

export const NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT = prompt(
  "AbandonedShip_Corridors_B1F", 13, 10, "Navio Perdido — Corredores B1F",
  [
    "porta dinâmica do depósito em (11,4): x=9..12, y=2..6 -> preservar",
    "zona de Dive e retorno submerso: preservar todo behavior aquático/Dive e suas células de aproximação",
  ],
  [
    "preservar byte a byte a célula (11,4), alternada por FLAG_USED_STORAGE_KEY entre METATILE_InsideShip_IntactDoor_Bottom_Locked e Unlocked.",
    "preservar o setdivewarp para MAP_ABANDONED_SHIP_UNDERWATER1 em (5,4) e o fluxo que consome ITEM_STORAGE_KEY.",
  ],
);

export const NAVIO_PERDIDO_ROOMS_B1F_PROMPT = prompt(
  "AbandonedShip_Rooms_B1F", 27, 8, "Navio Perdido — Salas B1F",
  ["zona de Dive para Underwater2 e todas as portas/warps das salas: preservar behaviors funcionais e eventos"],
  ["preservar o setdivewarp para MAP_ABANDONED_SHIP_UNDERWATER2, destino (17,4), e qualquer célula de Dive que o aciona."],
);

export const NAVIO_PERDIDO_ROOMS2_B1F_PROMPT = prompt(
  "AbandonedShip_Rooms2_B1F", 18, 8, "Navio Perdido — Salas B1F · Ala 2",
  ["entradas, itens e corredores entre salas: preservar todas as células funcionais/eventos do map.json"],
);

export const NAVIO_PERDIDO_UNDERWATER1_PROMPT = prompt(
  "AbandonedShip_Underwater1", 8, 8, "Navio Perdido — Trecho Submerso 1",
  ["todo o mapa submerso: x=0..7, y=0..7 -> preservar behaviors aquáticos e Dive; somente piso NORMAL comprovado pode mudar"],
  ["preservar o setdivewarp para MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS, destino (0,10)."],
);

export const NAVIO_PERDIDO_ROOM_B1F_PROMPT = prompt(
  "AbandonedShip_Room_B1F", 9, 8, "Navio Perdido — Sala B1F",
  ["porta, item/evento e warp da sala: preservar todas as células reservadas pelo map.json"],
);

export const NAVIO_PERDIDO_ROOMS2_1F_PROMPT = prompt(
  "AbandonedShip_Rooms2_1F", 9, 17, "Navio Perdido — Salas 1F · Ala 2",
  ["treinadores, batalha dupla, portas e warps: preservar todas as células e aproximações reservadas pelo map.json"],
);

export const NAVIO_PERDIDO_CAPTAIN_PROMPT = prompt(
  "AbandonedShip_CaptainsOffice", 9, 7, "Navio Perdido — Escritório do Capitão",
  ["entrada, objeto/item e ponto narrativo do escritório: preservar todas as células reservadas pelo map.json"],
  ["este mapa usa General + Facility; não substituir a linguagem visual por InsideShip automaticamente."],
);

export const NAVIO_PERDIDO_UNDERWATER2_PROMPT = prompt(
  "AbandonedShip_Underwater2", 21, 7, "Navio Perdido — Trecho Submerso 2",
  ["todo o corredor submerso: x=0..20, y=0..6 -> preservar behaviors aquáticos e Dive; somente piso NORMAL comprovado pode mudar"],
  ["preservar o setdivewarp de retorno para MAP_ABANDONED_SHIP_ROOMS_B1F, destino (13,7)."],
);

export const NAVIO_PERDIDO_HIDDEN_CORRIDORS_PROMPT = prompt(
  "AbandonedShip_HiddenFloorCorridors", 13, 11, "Navio Perdido — Piso Oculto · Corredores",
  [
    "porta RM.1 em (3,8): x=1..5, y=6..10 -> preservar",
    "porta RM.2 em (6,8): x=4..8, y=6..10 -> preservar",
    "porta RM.4 em (3,3): x=1..5, y=1..5 -> preservar",
    "porta RM.6 em (9,3): x=7..11, y=1..5 -> preservar",
    "zona de Dive/retorno submerso e todas as entradas das seis salas: preservar",
  ],
  [
    "preservar byte a byte (3,8), (6,8), (3,3) e (9,3), reescritas em runtime conforme FLAG_USED_ROOM_1_KEY, FLAG_USED_ROOM_2_KEY, FLAG_USED_ROOM_4_KEY e FLAG_USED_ROOM_6_KEY.",
    "preservar o setdivewarp de retorno para MAP_ABANDONED_SHIP_UNDERWATER1, destino (5,4), e o consumo das quatro Room Keys.",
  ],
);

export const NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT = prompt(
  "AbandonedShip_HiddenFloorRooms", 44, 15, "Navio Perdido — Piso Oculto · Salas",
  [
    "linha superior de salas e entradas: x=0..43, y=0..6 -> preservar warps, entradas e pontos de sparkle",
    "linha inferior de salas e entradas: x=0..43, y=7..14 -> preservar warps, entradas e pontos de sparkle",
  ],
  [
    "preservar a classificação das seis salas por posição do jogador: colunas x=21 e x=36 e linha superior y=2 não podem ter suas entradas deslocadas.",
    "preservar os sparkles fixos em (10,10), (8,5), (11,3), (16,3), (25,2) e (24,6).",
    "preservar os sparkles das chaves em (42,10) RM.1, (20,5) RM.2, (1,12) RM.4 e (1,2) RM.6; a geometria não pode mudar o significado dessas coordenadas.",
    "como a lógica de busca depende de coordenadas absolutas, não reorganizar as seis salas; apenas normalizar piso NORMAL livre dentro da geometria existente.",
  ],
);

interface NavioPerdidoContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface NavioPerdidoSpec {
  mapId: string;
  width: number;
  height: number;
  secondary: string;
  label: string;
}

const SPECS = {
  deck: { mapId: "MAP_ABANDONED_SHIP_DECK", width: 23, height: 21, secondary: NAVIO_PERDIDO_FACILITY_SECONDARY, label: "Navio Perdido · Convés" },
  corridors1F: { mapId: "MAP_ABANDONED_SHIP_CORRIDORS_1F", width: 18, height: 12, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Corredores 1F" },
  rooms1F: { mapId: "MAP_ABANDONED_SHIP_ROOMS_1F", width: 18, height: 17, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas 1F" },
  corridorsB1F: { mapId: "MAP_ABANDONED_SHIP_CORRIDORS_B1F", width: 13, height: 10, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Corredores B1F" },
  roomsB1F: { mapId: "MAP_ABANDONED_SHIP_ROOMS_B1F", width: 27, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas B1F" },
  rooms2B1F: { mapId: "MAP_ABANDONED_SHIP_ROOMS2_B1F", width: 18, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas B1F · Ala 2" },
  underwater1: { mapId: "MAP_ABANDONED_SHIP_UNDERWATER1", width: 8, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Submerso 1" },
  roomB1F: { mapId: "MAP_ABANDONED_SHIP_ROOM_B1F", width: 9, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Sala B1F" },
  rooms21F: { mapId: "MAP_ABANDONED_SHIP_ROOMS2_1F", width: 9, height: 17, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas 1F · Ala 2" },
  captain: { mapId: "MAP_ABANDONED_SHIP_CAPTAINS_OFFICE", width: 9, height: 7, secondary: NAVIO_PERDIDO_FACILITY_SECONDARY, label: "Navio Perdido · Escritório do Capitão" },
  underwater2: { mapId: "MAP_ABANDONED_SHIP_UNDERWATER2", width: 21, height: 7, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Submerso 2" },
  hiddenCorridors: { mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS", width: 13, height: 11, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Piso Oculto · Corredores" },
  hiddenRooms: { mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_ROOMS", width: 44, height: 15, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Piso Oculto · Salas" },
} as const satisfies Record<string, NavioPerdidoSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: NavioPerdidoContext, spec: NavioPerdidoSpec) {
  if (context.width !== spec.width || context.height !== spec.height) {
    return { enabled: false, reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}; o mapa aberto é ${context.width}×${context.height}.` };
  }
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) {
    return { enabled: false, reason: `Preset bloqueado: o map.json aberto é ${mapId}; ${spec.label} usa ${spec.mapId}.` };
  }
  const primary = normalized(context.atlasPrimary);
  const secondary = normalized(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== NAVIO_PERDIDO_PRIMARY.toLowerCase() || secondary !== spec.secondary.toLowerCase()) {
      return { enabled: false, reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; ${spec.label} exige ${NAVIO_PERDIDO_PRIMARY} + ${spec.secondary}.` };
    }
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível; Dive, portas/chaves, itens, sparkle, warps e behaviors funcionais permanecem preservados.` };
}

function fromAtlas(spec: NavioPerdidoSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({ width, height, mapId, atlasPrimary: atlas?.primary ?? null, atlasSecondary: atlas?.secondary ?? null }, spec);
}

export const navioPerdidoDeckGuard = (context: NavioPerdidoContext) => guard(context, SPECS.deck);
export const navioPerdidoCorridors1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.corridors1F);
export const navioPerdidoRooms1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.rooms1F);
export const navioPerdidoCorridorsB1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.corridorsB1F);
export const navioPerdidoRoomsB1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.roomsB1F);
export const navioPerdidoRooms2B1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.rooms2B1F);
export const navioPerdidoUnderwater1Guard = (context: NavioPerdidoContext) => guard(context, SPECS.underwater1);
export const navioPerdidoRoomB1FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.roomB1F);
export const navioPerdidoRooms21FGuard = (context: NavioPerdidoContext) => guard(context, SPECS.rooms21F);
export const navioPerdidoCaptainGuard = (context: NavioPerdidoContext) => guard(context, SPECS.captain);
export const navioPerdidoUnderwater2Guard = (context: NavioPerdidoContext) => guard(context, SPECS.underwater2);
export const navioPerdidoHiddenCorridorsGuard = (context: NavioPerdidoContext) => guard(context, SPECS.hiddenCorridors);
export const navioPerdidoHiddenRoomsGuard = (context: NavioPerdidoContext) => guard(context, SPECS.hiddenRooms);

export const navioPerdidoDeckGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.deck, w, h, id, atlas);
export const navioPerdidoCorridors1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.corridors1F, w, h, id, atlas);
export const navioPerdidoRooms1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.rooms1F, w, h, id, atlas);
export const navioPerdidoCorridorsB1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.corridorsB1F, w, h, id, atlas);
export const navioPerdidoRoomsB1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.roomsB1F, w, h, id, atlas);
export const navioPerdidoRooms2B1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.rooms2B1F, w, h, id, atlas);
export const navioPerdidoUnderwater1GuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.underwater1, w, h, id, atlas);
export const navioPerdidoRoomB1FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.roomB1F, w, h, id, atlas);
export const navioPerdidoRooms21FGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.rooms21F, w, h, id, atlas);
export const navioPerdidoCaptainGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.captain, w, h, id, atlas);
export const navioPerdidoUnderwater2GuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.underwater2, w, h, id, atlas);
export const navioPerdidoHiddenCorridorsGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.hiddenCorridors, w, h, id, atlas);
export const navioPerdidoHiddenRoomsGuardFromAtlas = (w: number, h: number, id: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.hiddenRooms, w, h, id, atlas);
