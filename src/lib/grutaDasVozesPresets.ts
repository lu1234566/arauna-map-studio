import type { SavedRealAtlas } from "./realAtlasStore";

export const GRUTA_DAS_VOZES_PRIMARY = "gTileset_General";
export const GRUTA_DAS_VOZES_SECONDARY = "gTileset_Cave";

export const GRUTA_DAS_VOZES_1F_PRESET_ID = "piloto-gruta-das-vozes-1f" as const;
export const GRUTA_DAS_VOZES_B1F_PRESET_ID = "piloto-gruta-das-vozes-b1f" as const;
export const GRUTA_DAS_VOZES_B2F_PRESET_ID = "piloto-gruta-das-vozes-b2f" as const;
export const GRUTA_DAS_VOZES_BENTO_PRESET_ID = "piloto-gruta-das-vozes-bento" as const;

export const GRUTA_DAS_VOZES_1F_PROMPT = `RECONSTRUA GRUTA DAS VOZES 1F EM CAMADAS SOBRE O GRANITECAVE_1F REAL 42x15.
Mapa 42x15; nome="Gruta das Vozes — 1F"

CAMADA 1 — PISOS CAMINHÁVEIS DO LIMIAR
- ala oeste: x=1..16, y=1..13 -> piso base
- ala central: x=14..29, y=1..13 -> piso base
- ala leste: x=27..40, y=1..13 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- rota da entrada: x=32..40, y=8..13 -> piso base
- descida norte: x=32..38, y=1..6 -> piso base
- descida central: x=14..20, y=8..13 -> piso base
- acesso à câmara de Seu Bento: x=2..9, y=7..12 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- boca Route 106: x=34..40, y=9..14 -> preservar
- warp B1F norte: x=33..37, y=1..5 -> preservar
- warp B1F central: x=15..19, y=9..13 -> preservar
- entrada da câmara de Seu Bento: x=3..7, y=8..12 -> preservar
- área do guia: x=34..38, y=7..11 -> preservar
- Escape Rope: x=15..19, y=5..9 -> preservar
- Pokémon de Arauna: x=7..11, y=3..7 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar warps, NPCs, itens, Pokémon de Arauna, colisões, elevações e moldura existentes.
- não inventar metatile IDs, paredes, passagens, escadas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const GRUTA_DAS_VOZES_B1F_PROMPT = `RECONSTRUA GRUTA DAS VOZES B1F EM CAMADAS SOBRE O GRANITECAVE_B1F REAL 32x26.
Mapa 32x26; nome="Gruta das Vozes — B1F"

CAMADA 1 — PISOS CAMINHÁVEIS PROFUNDOS
- quadrante noroeste: x=1..15, y=1..12 -> piso base
- quadrante nordeste: x=16..30, y=1..12 -> piso base
- quadrante sudoeste: x=1..15, y=13..24 -> piso base
- quadrante sudeste: x=16..30, y=13..24 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- espinha leste: x=24..30, y=1..23 -> piso base
- retorno oeste: x=2..10, y=18..24 -> piso base
- travessia central: x=7..30, y=11..15 -> piso base
- galeria superior oeste: x=6..14, y=2..8 -> piso base
- galeria inferior: x=12..29, y=18..23 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- warp 1F leste: x=23..27, y=11..15 -> preservar
- warp 1F oeste: x=2..6, y=19..23 -> preservar
- warp B2F leste central: x=27..31, y=11..15 -> preservar
- warp B2F sudeste: x=26..30, y=19..23 -> preservar
- warp B2F noroeste: x=6..10, y=3..7 -> preservar
- warp B2F norte: x=10..14, y=1..5 -> preservar
- warp B2F nordeste: x=27..31, y=0..4 -> preservar
- item Poké Ball: x=13..17, y=19..23 -> preservar
- Pokémon de Arauna A: x=19..23, y=16..20 -> preservar
- Pokémon de Arauna B: x=15..19, y=10..14 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar integralmente os sete warps, item, Pokémon de Arauna, colisões, elevações e moldura existentes.
- não inventar metatile IDs, paredes, passagens, escadas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const GRUTA_DAS_VOZES_B2F_PROMPT = `RECONSTRUA GRUTA DAS VOZES B2F EM CAMADAS SOBRE O GRANITECAVE_B2F REAL 32x26.
Mapa 32x26; nome="Gruta das Vozes — B2F"

CAMADA 1 — PISOS CAMINHÁVEIS PROFUNDOS
- quadrante noroeste: x=1..15, y=1..12 -> piso base
- quadrante nordeste: x=16..30, y=1..12 -> piso base
- quadrante sudoeste: x=1..15, y=13..24 -> piso base
- quadrante sudeste: x=16..30, y=13..24 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- galeria norte: x=3..30, y=2..7 -> piso base
- eixo leste: x=26..30, y=2..22 -> piso base
- galeria central: x=5..29, y=10..15 -> piso base
- retorno sul: x=2..29, y=19..23 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- warp B1F leste central: x=27..31, y=11..15 -> preservar
- warp B1F sudeste: x=26..30, y=19..23 -> preservar
- warp B1F noroeste: x=6..10, y=3..7 -> preservar
- warp B1F norte: x=10..14, y=1..5 -> preservar
- warp B1F nordeste: x=27..31, y=0..4 -> preservar
- campo de Rock Smash oeste: x=0..9, y=10..24 -> preservar
- Repel: x=2..6, y=2..6 -> preservar
- Rare Candy: x=27..31, y=2..6 -> preservar
- Everstone nordeste: x=26..30, y=4..8 -> preservar
- Everstone central: x=13..17, y=9..13 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da caverna, incluindo toda geometria bloqueada do mapa real.
- preservar os cinco warps, todas as pedras de Rock Smash, itens visíveis e ocultos, colisões, elevações e moldura existentes.
- não inventar metatile IDs, paredes, passagens, escadas, buracos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.
- atuar somente sobre o chão já caminhável comprovado pelo map.bin e atlas real.`;

export const GRUTA_DAS_VOZES_BENTO_PROMPT = `RECONSTRUA A CÂMARA DE SEU BENTO NA GRUTA DAS VOZES SOBRE O GRANITECAVE_STEVENSROOM REAL 15x14.
Mapa 15x14; nome="Gruta das Vozes — Câmara de Seu Bento"

CAMADA 1 — PISO DA CÂMARA
- câmara principal: x=1..13, y=1..12 -> piso base

CAMADA 2 — CORREDOR DE ENCONTRO
- eixo entrada e encontro: x=5..9, y=2..11 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- saída para 1F: x=5..9, y=1..5 -> preservar
- encontro de Seu Bento: x=5..11, y=6..12 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
- preservar todas as paredes e rochas da câmara, incluindo toda geometria bloqueada do mapa real.
- preservar Seu Bento, o Pokémon de Arauna, o warp, colisões, elevações e moldura existentes.
- a função narrativa de registro de nomes não autoriza inventar papéis, placas, murais ou objetos sem Pattern real compatível.
- não inventar metatile IDs, passagens, objetos ou connections.
- este mapa não possui connections de borda; não criar saída artificial.`;

interface GrutaDasVozesContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface GrutaSpec {
  mapId: string;
  width: number;
  height: number;
  label: string;
}

const SPECS = {
  oneF: { mapId: "MAP_GRANITE_CAVE_1F", width: 42, height: 15, label: "Gruta das Vozes 1F" },
  b1f: { mapId: "MAP_GRANITE_CAVE_B1F", width: 32, height: 26, label: "Gruta das Vozes B1F" },
  b2f: { mapId: "MAP_GRANITE_CAVE_B2F", width: 32, height: 26, label: "Gruta das Vozes B2F" },
  bento: { mapId: "MAP_GRANITE_CAVE_STEVENS_ROOM", width: 15, height: 14, label: "Câmara de Seu Bento" },
} as const satisfies Record<string, GrutaSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function grutaGuard(context: GrutaDasVozesContext, spec: GrutaSpec) {
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
    if (primary !== GRUTA_DAS_VOZES_PRIMARY.toLowerCase() || secondary !== GRUTA_DAS_VOZES_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; a Gruta das Vozes exige ${GRUTA_DAS_VOZES_PRIMARY} + ${GRUTA_DAS_VOZES_SECONDARY}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: `${spec.label}: preset local disponível com paredes, warps, eventos e geometria bloqueada preservados.`,
  };
}

function fromAtlas(spec: GrutaSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return grutaGuard({
    width,
    height,
    mapId,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  }, spec);
}

export const grutaDasVozes1FGuard = (context: GrutaDasVozesContext) => grutaGuard(context, SPECS.oneF);
export const grutaDasVozesB1FGuard = (context: GrutaDasVozesContext) => grutaGuard(context, SPECS.b1f);
export const grutaDasVozesB2FGuard = (context: GrutaDasVozesContext) => grutaGuard(context, SPECS.b2f);
export const grutaDasVozesBentoGuard = (context: GrutaDasVozesContext) => grutaGuard(context, SPECS.bento);

export const grutaDasVozes1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneF, width, height, mapId, atlas);
export const grutaDasVozesB1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.b1f, width, height, mapId, atlas);
export const grutaDasVozesB2FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.b2f, width, height, mapId, atlas);
export const grutaDasVozesBentoGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.bento, width, height, mapId, atlas);
