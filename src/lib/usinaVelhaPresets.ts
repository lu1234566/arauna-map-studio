import type { SavedRealAtlas } from "./realAtlasStore";

export const USINA_VELHA_PRIMARY = "gTileset_General";
export const USINA_VELHA_ENTRANCE_SECONDARY = "gTileset_Facility";
export const USINA_VELHA_INSIDE_SECONDARY = "gTileset_BikeShop";

export const USINA_VELHA_ENTRANCE_PRESET_ID = "piloto-usina-velha-entrada" as const;
export const USINA_VELHA_INSIDE_PRESET_ID = "piloto-usina-velha-interior" as const;

const SAFETY = `- preservar todas as paredes, barreiras, máquinas e obstáculos colidíveis do mapa real.
- preservar integralmente botões, barreiras azul/verde, gerador, portas, triggers, itens, Voltorb disfarçados, Pokémon de Arauna, warps e células de aproximação.
- preservar qualquer metatile escrito por setmetatile nos scripts de OnLoad, OnResume, BlueButton, GreenButton e RedButton.
- preservar elevação, collision, behavior e physical originais de toda célula funcional.
- não inventar metatile IDs, barreiras, botões, geradores, portas, itens, Pokémon, warps ou connections.
- estes mapas não possuem connections de borda; não criar saída artificial.
- atuar somente sobre piso NORMAL livre comprovado pelo map.bin e pelo atlas real.`;

export const USINA_VELHA_ENTRANCE_PROMPT = `RECONSTRUA USINA VELHA — ENTRADA EM CAMADAS SOBRE O NEWMAUVILLE_ENTRANCE REAL 9x9.
Mapa 9x9; nome="Usina Velha — Entrada"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..7, y=1..7 -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
- saída Route110: x=2..6, y=4..8 -> preservar
- porta para o interior: x=2..6, y=0..4 -> preservar
- trigger da porta VAR_NEW_MAUVILLE_STATE: x=2..6, y=0..4 -> preservar
- Pokémon de Arauna/Xangô: x=3..7, y=1..5 -> preservar

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar a porta trancada e a lógica da Basement Key; o preset não pode abrir, fechar ou deslocar o corredor de acesso.`;

export const USINA_VELHA_INSIDE_PROMPT = `RECONSTRUA USINA VELHA — INTERIOR EM CAMADAS SOBRE O NEWMAUVILLE_INSIDE REAL 41x41.
Mapa 41x41; nome="Usina Velha — Interior"

CAMADA 1 — PISO NORMAL LIVRE
- interior comprovado: x=1..39, y=1..39 -> piso base

CAMADA 2 — ZONAS DE PRESERVAÇÃO
- saída para entrada: x=30..34, y=31..35 -> preservar
- gerador e botão vermelho: x=30..37, y=0..8 -> preservar
- barreira azul/verde norte oeste: x=8..12, y=0..5 -> preservar
- barreira azul/verde norte central: x=19..23, y=0..7 -> preservar
- barreira azul/verde oeste média: x=8..12, y=14..29 -> preservar
- barreira azul/verde centro leste: x=26..30, y=20..27 -> preservar
- barreira azul/verde sul central: x=21..25, y=32..39 -> preservar
- barreira azul/verde sul leste: x=35..39, y=31..38 -> preservar
- botões e itens oeste: x=0..8, y=8..28 -> preservar
- botões e itens centro: x=11..19, y=8..24 -> preservar
- botão/Voltorb central leste: x=23..27, y=16..20 -> preservar
- botão verde sul: x=16..20, y=34..38 -> preservar
- botão azul sul: x=28..32, y=36..40 -> preservar
- Ultra Ball: x=30..34, y=23..27 -> preservar
- Thunder Stone: x=37..40, y=2..6 -> preservar

CAMADA 3 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar byte a byte as células de barreira escritas em x=23,y=34..37; x=10,y=16..19; x=10,y=0..3; x=37,y=33..36; x=28,y=22..25; x=10,y=24..27; x=21,y=2..5.
- preservar os botões em (6,11), (13,10), (16,22), (4,26), (30,38), (2,11), (17,10), (25,18), (18,36) e o botão vermelho em (33,6).
- preservar o gerador dinâmico em x=32..35,y=2..3 e todos os oito bg_events do gerador.
- preservar os três Voltorb em (25,18), (6,11), (13,10) e todos os itens reais; eventos sobrepostos a botões sempre vencem qualquer camada de piso.`;

interface UsinaVelhaContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface UsinaVelhaSpec {
  mapId: string;
  width: number;
  height: number;
  secondary: string;
  label: string;
}

const SPECS = {
  entrance: { mapId: "MAP_NEW_MAUVILLE_ENTRANCE", width: 9, height: 9, secondary: USINA_VELHA_ENTRANCE_SECONDARY, label: "Usina Velha · Entrada" },
  inside: { mapId: "MAP_NEW_MAUVILLE_INSIDE", width: 41, height: 41, secondary: USINA_VELHA_INSIDE_SECONDARY, label: "Usina Velha · Interior" },
} as const satisfies Record<string, UsinaVelhaSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function guard(context: UsinaVelhaContext, spec: UsinaVelhaSpec) {
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
    if (primary !== USINA_VELHA_PRIMARY.toLowerCase() || secondary !== spec.secondary.toLowerCase()) {
      return { enabled: false, reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; ${spec.label} exige ${USINA_VELHA_PRIMARY} + ${spec.secondary}.` };
    }
  }
  return { enabled: true, reason: `${spec.label}: preset local disponível; botões, barreiras, gerador, eventos e estado elétrico permanecem preservados.` };
}

function fromAtlas(spec: UsinaVelhaSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return guard({ width, height, mapId, atlasPrimary: atlas?.primary ?? null, atlasSecondary: atlas?.secondary ?? null }, spec);
}

export const usinaVelhaEntranceGuard = (context: UsinaVelhaContext) => guard(context, SPECS.entrance);
export const usinaVelhaInsideGuard = (context: UsinaVelhaContext) => guard(context, SPECS.inside);
export const usinaVelhaEntranceGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.entrance, width, height, mapId, atlas);
export const usinaVelhaInsideGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.inside, width, height, mapId, atlas);
