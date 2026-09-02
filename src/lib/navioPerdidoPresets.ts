import type { SavedRealAtlas } from "./realAtlasStore";

export const NAVIO_PERDIDO_PRIMARY = "gTileset_General";
export const NAVIO_PERDIDO_SHIP_SECONDARY = "gTileset_InsideShip";
export const NAVIO_PERDIDO_FACILITY_SECONDARY = "gTileset_Facility";

interface NavioPerdidoContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface NavioPerdidoSpec {
  id: string;
  mapId: string;
  source: string;
  width: number;
  height: number;
  secondary: string;
  label: string;
  preserves?: readonly string[];
  extra?: readonly string[];
}

const SPECS = {
  deck: {
    id: "piloto-navio-perdido-conves", mapId: "MAP_ABANDONED_SHIP_DECK", source: "AbandonedShip_Deck",
    width: 23, height: 21, secondary: NAVIO_PERDIDO_FACILITY_SECONDARY, label: "Navio Perdido · Convés",
    extra: ["preservar a marcação de descoberta do Navio Perdido e todos os pontos de transição do convés."],
  },
  corridors1F: {
    id: "piloto-navio-perdido-corredores-1f", mapId: "MAP_ABANDONED_SHIP_CORRIDORS_1F", source: "AbandonedShip_Corridors_1F",
    width: 18, height: 12, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Corredores 1F",
  },
  rooms1F: {
    id: "piloto-navio-perdido-salas-1f", mapId: "MAP_ABANDONED_SHIP_ROOMS_1F", source: "AbandonedShip_Rooms_1F",
    width: 18, height: 17, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas 1F",
  },
  corridorsB1F: {
    id: "piloto-navio-perdido-corredores-b1f", mapId: "MAP_ABANDONED_SHIP_CORRIDORS_B1F", source: "AbandonedShip_Corridors_B1F",
    width: 13, height: 10, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Corredores B1F",
    preserves: ["porta dinâmica do depósito: x=9..12, y=2..6 -> preservar"],
    extra: [
      "preservar byte a byte a célula (11,4), alternada por FLAG_USED_STORAGE_KEY entre porta trancada e destrancada.",
      "preservar o setdivewarp para MAP_ABANDONED_SHIP_UNDERWATER1, destino (5,4), e o fluxo que consome ITEM_STORAGE_KEY.",
    ],
  },
  roomsB1F: {
    id: "piloto-navio-perdido-salas-b1f", mapId: "MAP_ABANDONED_SHIP_ROOMS_B1F", source: "AbandonedShip_Rooms_B1F",
    width: 27, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas B1F",
    extra: ["preservar o setdivewarp para MAP_ABANDONED_SHIP_UNDERWATER2, destino (17,4), e qualquer célula de Dive que o aciona."],
  },
  rooms2B1F: {
    id: "piloto-navio-perdido-salas2-b1f", mapId: "MAP_ABANDONED_SHIP_ROOMS2_B1F", source: "AbandonedShip_Rooms2_B1F",
    width: 18, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas B1F · Ala 2",
  },
  underwater1: {
    id: "piloto-navio-perdido-submerso-1", mapId: "MAP_ABANDONED_SHIP_UNDERWATER1", source: "AbandonedShip_Underwater1",
    width: 8, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Submerso 1",
    extra: ["preservar o setdivewarp para MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS, destino (0,10); água/Dive são behaviors funcionais intocáveis."],
  },
  roomB1F: {
    id: "piloto-navio-perdido-sala-b1f", mapId: "MAP_ABANDONED_SHIP_ROOM_B1F", source: "AbandonedShip_Room_B1F",
    width: 9, height: 8, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Sala B1F",
  },
  rooms21F: {
    id: "piloto-navio-perdido-salas2-1f", mapId: "MAP_ABANDONED_SHIP_ROOMS2_1F", source: "AbandonedShip_Rooms2_1F",
    width: 9, height: 17, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Salas 1F · Ala 2",
    extra: ["preservar treinadores, batalha dupla e corredores de aproximação exatamente nas células reservadas pelo map.json."],
  },
  captain: {
    id: "piloto-navio-perdido-capitao", mapId: "MAP_ABANDONED_SHIP_CAPTAINS_OFFICE", source: "AbandonedShip_CaptainsOffice",
    width: 9, height: 7, secondary: NAVIO_PERDIDO_FACILITY_SECONDARY, label: "Navio Perdido · Escritório do Capitão",
    extra: ["este mapa usa General + Facility; não substituir sua linguagem visual por InsideShip automaticamente."],
  },
  underwater2: {
    id: "piloto-navio-perdido-submerso-2", mapId: "MAP_ABANDONED_SHIP_UNDERWATER2", source: "AbandonedShip_Underwater2",
    width: 21, height: 7, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Submerso 2",
    extra: ["preservar o setdivewarp de retorno para MAP_ABANDONED_SHIP_ROOMS_B1F, destino (13,7); água/Dive são behaviors funcionais intocáveis."],
  },
  hiddenCorridors: {
    id: "piloto-navio-perdido-piso-oculto-corredores", mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS", source: "AbandonedShip_HiddenFloorCorridors",
    width: 13, height: 11, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Piso Oculto · Corredores",
    preserves: [
      "porta RM.1: x=1..5, y=6..10 -> preservar",
      "porta RM.2: x=4..8, y=6..10 -> preservar",
      "porta RM.4: x=1..5, y=1..5 -> preservar",
      "porta RM.6: x=7..11, y=1..5 -> preservar",
    ],
    extra: [
      "preservar byte a byte (3,8), (6,8), (3,3) e (9,3), reescritas por FLAG_USED_ROOM_1_KEY, FLAG_USED_ROOM_2_KEY, FLAG_USED_ROOM_4_KEY e FLAG_USED_ROOM_6_KEY.",
      "preservar o setdivewarp de retorno para MAP_ABANDONED_SHIP_UNDERWATER1, destino (5,4), e o consumo das quatro Room Keys.",
    ],
  },
  hiddenRooms: {
    id: "piloto-navio-perdido-piso-oculto-salas", mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_ROOMS", source: "AbandonedShip_HiddenFloorRooms",
    width: 44, height: 15, secondary: NAVIO_PERDIDO_SHIP_SECONDARY, label: "Navio Perdido · Piso Oculto · Salas",
    preserves: [
      "âncora coluna central: x=20..22, y=0..14 -> preservar",
      "âncora coluna direita: x=35..37, y=0..14 -> preservar",
      "âncora da fileira superior: x=0..43, y=1..3 -> preservar",
      "sparkle fixo A: x=10..10, y=10..10 -> preservar",
      "sparkle fixo B: x=8..8, y=5..5 -> preservar",
      "sparkle fixo C: x=11..11, y=3..3 -> preservar",
      "sparkle fixo D: x=16..16, y=3..3 -> preservar",
      "sparkle fixo E: x=25..25, y=2..2 -> preservar",
      "sparkle fixo F: x=24..24, y=6..6 -> preservar",
      "chave RM.1: x=42..42, y=10..10 -> preservar",
      "chave RM.2: x=20..20, y=5..5 -> preservar",
      "chave RM.4: x=1..1, y=12..12 -> preservar",
      "chave RM.6: x=1..1, y=2..2 -> preservar",
    ],
    extra: [
      "a lógica classifica as seis salas pelas coordenadas do jogador: x=21, x=36 e y=2; não deslocar as entradas associadas.",
      "como a busca depende de coordenadas absolutas, não reorganizar as seis salas; apenas normalizar piso NORMAL livre dentro da geometria existente.",
    ],
  },
} as const satisfies Record<string, NavioPerdidoSpec>;

const SAFETY = `- preservar todas as paredes, divisórias, portas, obstáculos colidíveis e moldura do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo água, Dive, escadas, portas comportamentais, warps e qualquer célula com behavior não-NORMAL.
- preservar integralmente warps, NPCs, treinadores, itens, chaves, itens ocultos, triggers, bg_events e suas células de aproximação reservadas pelo map.json.
- preservar qualquer célula escrita por setmetatile e qualquer coordenada usada por setdivewarp, sparkle ou lógica de identificação de sala.
- preservar elevação, collision, behavior e physical originais de toda célula funcional.
- não inventar metatile IDs, portas, chaves, água, Dive, escadas, objetos, itens, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

function buildPrompt(spec: NavioPerdidoSpec) {
  const preserveLines = spec.preserves?.length
    ? spec.preserves.map((value) => `- ${value}`).join("\n")
    : "- eventos e warps conhecidos pelo map.json permanecem reservados; nenhuma coordenada de evento pode ser reutilizada.";
  const extras = spec.extra?.length ? `\n${spec.extra.map((value) => `- ${value}`).join("\n")}` : "";
  return `RECONSTRUA ${spec.label.toUpperCase()} EM CAMADAS SOBRE O ${spec.source.toUpperCase()} REAL ${spec.width}x${spec.height}.
Mapa ${spec.width}x${spec.height}; nome="${spec.label}"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..${Math.max(1, spec.width - 2)}, y=1..${Math.max(1, spec.height - 2)} -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
${preserveLines}

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}${extras}`;
}

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

export const NAVIO_PERDIDO_DECK_PRESET_ID = SPECS.deck.id;
export const NAVIO_PERDIDO_CORRIDORS_1F_PRESET_ID = SPECS.corridors1F.id;
export const NAVIO_PERDIDO_ROOMS_1F_PRESET_ID = SPECS.rooms1F.id;
export const NAVIO_PERDIDO_CORRIDORS_B1F_PRESET_ID = SPECS.corridorsB1F.id;
export const NAVIO_PERDIDO_ROOMS_B1F_PRESET_ID = SPECS.roomsB1F.id;
export const NAVIO_PERDIDO_ROOMS2_B1F_PRESET_ID = SPECS.rooms2B1F.id;
export const NAVIO_PERDIDO_UNDERWATER1_PRESET_ID = SPECS.underwater1.id;
export const NAVIO_PERDIDO_ROOM_B1F_PRESET_ID = SPECS.roomB1F.id;
export const NAVIO_PERDIDO_ROOMS2_1F_PRESET_ID = SPECS.rooms21F.id;
export const NAVIO_PERDIDO_CAPTAIN_PRESET_ID = SPECS.captain.id;
export const NAVIO_PERDIDO_UNDERWATER2_PRESET_ID = SPECS.underwater2.id;
export const NAVIO_PERDIDO_HIDDEN_CORRIDORS_PRESET_ID = SPECS.hiddenCorridors.id;
export const NAVIO_PERDIDO_HIDDEN_ROOMS_PRESET_ID = SPECS.hiddenRooms.id;

export const NAVIO_PERDIDO_DECK_PROMPT = buildPrompt(SPECS.deck);
export const NAVIO_PERDIDO_CORRIDORS_1F_PROMPT = buildPrompt(SPECS.corridors1F);
export const NAVIO_PERDIDO_ROOMS_1F_PROMPT = buildPrompt(SPECS.rooms1F);
export const NAVIO_PERDIDO_CORRIDORS_B1F_PROMPT = buildPrompt(SPECS.corridorsB1F);
export const NAVIO_PERDIDO_ROOMS_B1F_PROMPT = buildPrompt(SPECS.roomsB1F);
export const NAVIO_PERDIDO_ROOMS2_B1F_PROMPT = buildPrompt(SPECS.rooms2B1F);
export const NAVIO_PERDIDO_UNDERWATER1_PROMPT = buildPrompt(SPECS.underwater1);
export const NAVIO_PERDIDO_ROOM_B1F_PROMPT = buildPrompt(SPECS.roomB1F);
export const NAVIO_PERDIDO_ROOMS2_1F_PROMPT = buildPrompt(SPECS.rooms21F);
export const NAVIO_PERDIDO_CAPTAIN_PROMPT = buildPrompt(SPECS.captain);
export const NAVIO_PERDIDO_UNDERWATER2_PROMPT = buildPrompt(SPECS.underwater2);
export const NAVIO_PERDIDO_HIDDEN_CORRIDORS_PROMPT = buildPrompt(SPECS.hiddenCorridors);
export const NAVIO_PERDIDO_HIDDEN_ROOMS_PROMPT = buildPrompt(SPECS.hiddenRooms);

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
