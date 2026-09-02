import type { SavedRealAtlas } from "./realAtlasStore";

export const RUINAS_DA_QUEDA_PRIMARY = "gTileset_General";
export const RUINAS_DA_QUEDA_SECONDARY = "gTileset_MeteorFalls";

export const RUINAS_DA_QUEDA_1F_1R_PRESET_ID = "piloto-ruinas-da-queda-1f-1r" as const;
export const RUINAS_DA_QUEDA_1F_2R_PRESET_ID = "piloto-ruinas-da-queda-1f-2r" as const;
export const RUINAS_DA_QUEDA_B1F_1R_PRESET_ID = "piloto-ruinas-da-queda-b1f-1r" as const;
export const RUINAS_DA_QUEDA_B1F_2R_PRESET_ID = "piloto-ruinas-da-queda-b1f-2r" as const;
export const RUINAS_DA_QUEDA_BENTO_PRESET_ID = "piloto-ruinas-da-queda-bento" as const;

export const RUINAS_DA_QUEDA_1F_1R_PROMPT = `RECONSTRUA RUINAS DA QUEDA 1F 1R EM CAMADAS SOBRE O METEORFALLS_1F_1R REAL 30x42.
Mapa 30x42; nome="Ruínas da Queda — 1F · 1R"

CAMADA 1 — PISO CAMINHÁVEL DAS RUÍNAS
- ala norte oeste: x=1..14, y=1..14 -> piso base
- ala norte leste: x=15..28, y=1..14 -> piso base
- ala central oeste: x=1..14, y=15..29 -> piso base
- ala central leste: x=15..28, y=15..29 -> piso base
- ala sul oeste: x=1..14, y=30..40 -> piso base
- ala sul leste: x=15..28, y=30..40 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo norte sul oeste: x=4..10, y=2..40 -> piso base
- eixo norte sul leste: x=23..28, y=3..34 -> piso base
- travessia da cena do meteorito: x=5..17, y=17..25 -> piso base
- acesso sul Route 115: x=3..9, y=34..41 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- cena Lembrantes e Horizonte: x=4..17, y=16..25 -> preservar
- trigger do meteorito: x=12..16, y=16..21 -> preservar
- boca Route 114: x=24..29, y=15..21 -> preservar
- boca Route 115: x=3..9, y=36..41 -> preservar
- warp 1F 2R: x=7..13, y=0..6 -> preservar
- warp B1F norte: x=2..8, y=1..7 -> preservar
- warp B1F sul leste: x=23..29, y=25..31 -> preservar
- entrada da câmara profunda: x=1..7, y=0..5 -> preservar
- item noroeste: x=0..4, y=2..6 -> preservar
- item oeste central: x=0..4, y=12..16 -> preservar
- item nordeste: x=25..29, y=3..7 -> preservar
- item sudeste: x=24..29, y=30..34 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar toda água, bordas d'água, quedas, escadas, elevações e corredores em nível físico diferente do piso-base.
- preservar integralmente a cena do meteorito, Lembrantes, agentes do Horizonte, professor, trigger, itens e os seis warps reais.
- não inventar metatile IDs, paredes, água, passagens, escadas, quedas, pontes, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const RUINAS_DA_QUEDA_1F_2R_PROMPT = `RECONSTRUA RUINAS DA QUEDA 1F 2R EM CAMADAS SOBRE O METEORFALLS_1F_2R REAL 30x32.
Mapa 30x32; nome="Ruínas da Queda — 1F · 2R"

CAMADA 1 — PISO CAMINHÁVEL SUPERIOR
- quadrante noroeste: x=1..14, y=1..15 -> piso base
- quadrante nordeste: x=15..28, y=1..15 -> piso base
- quadrante sudoeste: x=1..14, y=16..30 -> piso base
- quadrante sudeste: x=15..28, y=16..30 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo oeste: x=2..10, y=9..30 -> piso base
- travessia central: x=4..23, y=11..24 -> piso base
- retorno sul: x=7..13, y=25..31 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- retorno 1F 1R: x=7..13, y=27..31 -> preservar
- warp B1F oeste: x=2..6, y=12..16 -> preservar
- warp B1F centro: x=5..9, y=18..22 -> preservar
- warp B1F leste: x=19..23, y=21..25 -> preservar
- treinador norte: x=11..15, y=0..4 -> preservar
- dupla de treinadores: x=4..9, y=10..14 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar toda água, bordas d'água, escadas, elevações e corredores em nível físico diferente do piso-base.
- preservar os quatro warps e os três treinadores reais.
- não inventar metatile IDs, paredes, água, passagens, escadas, quedas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const RUINAS_DA_QUEDA_B1F_1R_PROMPT = `RECONSTRUA RUINAS DA QUEDA B1F 1R EM CAMADAS SOBRE O METEORFALLS_B1F_1R REAL 29x38.
Mapa 29x38; nome="Ruínas da Queda — B1F · 1R"

CAMADA 1 — PISO CAMINHÁVEL PROFUNDO
- quadrante noroeste: x=1..13, y=1..18 -> piso base
- quadrante nordeste: x=14..27, y=1..18 -> piso base
- quadrante sudoeste: x=1..13, y=19..36 -> piso base
- quadrante sudeste: x=14..27, y=19..36 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo norte: x=3..21, y=2..8 -> piso base
- travessia central: x=4..22, y=9..18 -> piso base
- descida oeste: x=1..9, y=18..26 -> piso base
- descida sul leste: x=17..23, y=20..37 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- warp 1F2R noroeste: x=3..7, y=4..8 -> preservar
- warp 1F2R oeste alto: x=5..9, y=9..13 -> preservar
- warp 1F2R centro: x=16..20, y=13..17 -> preservar
- warp B1F2R norte: x=15..19, y=1..5 -> preservar
- warp 1F1R oeste baixo: x=1..5, y=21..25 -> preservar
- warp 1F1R sul leste: x=18..22, y=34..37 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar toda água, bordas d'água, escadas e especialmente os corredores em elevação 4 e 5 do map.bin real.
- preservar integralmente os seis warps; nenhuma normalização pode alterar sua elevação ou acesso.
- não inventar metatile IDs, paredes, água, passagens, escadas, quedas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const RUINAS_DA_QUEDA_B1F_2R_PROMPT = `RECONSTRUA RUINAS DA QUEDA B1F 2R EM CAMADAS SOBRE O METEORFALLS_B1F_2R REAL 11x18.
Mapa 11x18; nome="Ruínas da Queda — B1F · 2R"

CAMADA 1 — CÂMARA PROFUNDA
- câmara principal: x=1..9, y=1..16 -> piso base

CAMADA 2 — CORREDOR DE LEITURA
- eixo item e retorno: x=3..7, y=2..16 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- TM Dragon Claw: x=3..7, y=1..5 -> preservar
- retorno B1F1R: x=3..7, y=13..17 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da câmara, incluindo toda geometria bloqueada do mapa real.
- preservar água, escadas, elevações, o item e o único warp real.
- não inventar metatile IDs, paredes, água, passagens, escadas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.`;

export const RUINAS_DA_QUEDA_BENTO_PROMPT = `RECONSTRUA A CÂMARA PROFUNDA DE SEU BENTO NAS RUINAS DA QUEDA SOBRE O METEORFALLS_STEVENSCAVE REAL 30x32.
Mapa 30x32; nome="Ruínas da Queda — Câmara de Seu Bento"

CAMADA 1 — PISO DA CÂMARA
- quadrante noroeste: x=1..14, y=1..15 -> piso base
- quadrante nordeste: x=15..28, y=1..15 -> piso base
- quadrante sudoeste: x=1..14, y=16..30 -> piso base
- quadrante sudeste: x=15..28, y=16..30 -> piso base

CAMADA 2 — CORREDOR DE ENCONTRO
- eixo entrada e encontro: x=8..21, y=2..30 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- encontro de Seu Bento: x=16..22, y=1..6 -> preservar
- retorno 1F1R: x=7..13, y=27..31 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da câmara, incluindo toda geometria bloqueada do mapa real.
- preservar água, escadas, elevações, Seu Bento e o warp real.
- a função narrativa da câmara não autoriza inventar monumentos, inscrições, papéis ou objetos sem Pattern real compatível.
- não inventar metatile IDs, paredes, água, passagens, escadas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.`;

interface RuinasDaQuedaContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface RuinasSpec {
  mapId: string;
  width: number;
  height: number;
  label: string;
}

const SPECS = {
  oneFOneR: { mapId: "MAP_METEOR_FALLS_1F_1R", width: 30, height: 42, label: "Ruínas da Queda 1F · 1R" },
  oneFTwoR: { mapId: "MAP_METEOR_FALLS_1F_2R", width: 30, height: 32, label: "Ruínas da Queda 1F · 2R" },
  b1fOneR: { mapId: "MAP_METEOR_FALLS_B1F_1R", width: 29, height: 38, label: "Ruínas da Queda B1F · 1R" },
  b1fTwoR: { mapId: "MAP_METEOR_FALLS_B1F_2R", width: 11, height: 18, label: "Ruínas da Queda B1F · 2R" },
  bento: { mapId: "MAP_METEOR_FALLS_STEVENS_CAVE", width: 30, height: 32, label: "Ruínas da Queda · Câmara de Seu Bento" },
} as const satisfies Record<string, RuinasSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function ruinasGuard(context: RuinasDaQuedaContext, spec: RuinasSpec) {
  if (context.width !== spec.width || context.height !== spec.height) {
    return {
      enabled: false,
      reason: `Preset bloqueado: ${spec.label} exige ${spec.width}×${spec.height}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }
  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== spec.mapId) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; ${spec.label} usa ${spec.mapId}.`,
    };
  }
  const primary = normalized(context.atlasPrimary);
  const secondary = normalized(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== RUINAS_DA_QUEDA_PRIMARY.toLowerCase() || secondary !== RUINAS_DA_QUEDA_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Ruínas da Queda exige ${RUINAS_DA_QUEDA_PRIMARY} + ${RUINAS_DA_QUEDA_SECONDARY}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: `${spec.label}: preset local disponível com paredes, água, elevações, warps e eventos preservados.`,
  };
}

function fromAtlas(spec: RuinasSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return ruinasGuard({
    width,
    height,
    mapId,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  }, spec);
}

export const ruinasDaQueda1F1RGuard = (context: RuinasDaQuedaContext) => ruinasGuard(context, SPECS.oneFOneR);
export const ruinasDaQueda1F2RGuard = (context: RuinasDaQuedaContext) => ruinasGuard(context, SPECS.oneFTwoR);
export const ruinasDaQuedaB1F1RGuard = (context: RuinasDaQuedaContext) => ruinasGuard(context, SPECS.b1fOneR);
export const ruinasDaQuedaB1F2RGuard = (context: RuinasDaQuedaContext) => ruinasGuard(context, SPECS.b1fTwoR);
export const ruinasDaQuedaBentoGuard = (context: RuinasDaQuedaContext) => ruinasGuard(context, SPECS.bento);

export const ruinasDaQueda1F1RGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneFOneR, width, height, mapId, atlas);
export const ruinasDaQueda1F2RGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneFTwoR, width, height, mapId, atlas);
export const ruinasDaQuedaB1F1RGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.b1fOneR, width, height, mapId, atlas);
export const ruinasDaQuedaB1F2RGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.b1fTwoR, width, height, mapId, atlas);
export const ruinasDaQuedaBentoGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.bento, width, height, mapId, atlas);
