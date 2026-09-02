import type { SavedRealAtlas } from "./realAtlasStore";

export const MEMORIAL_DOS_NOMES_PRIMARY = "gTileset_General";
export const MEMORIAL_DOS_NOMES_SECONDARY = "gTileset_Facility";

export const MEMORIAL_DOS_NOMES_1F_PRESET_ID = "piloto-memorial-dos-nomes-1f" as const;
export const MEMORIAL_DOS_NOMES_2F_PRESET_ID = "piloto-memorial-dos-nomes-2f" as const;
export const MEMORIAL_DOS_NOMES_3F_PRESET_ID = "piloto-memorial-dos-nomes-3f" as const;
export const MEMORIAL_DOS_NOMES_4F_PRESET_ID = "piloto-memorial-dos-nomes-4f" as const;
export const MEMORIAL_DOS_NOMES_5F_PRESET_ID = "piloto-memorial-dos-nomes-5f" as const;
export const MEMORIAL_DOS_NOMES_6F_PRESET_ID = "piloto-memorial-dos-nomes-6f" as const;
export const MEMORIAL_DOS_NOMES_EXTERIOR_PRESET_ID = "piloto-memorial-dos-nomes-exterior" as const;
export const MEMORIAL_DOS_NOMES_SUMMIT_PRESET_ID = "piloto-memorial-dos-nomes-summit" as const;

const SAFETY = `- preservar todas as paredes e obstáculos colidíveis do mapa real.
- preservar todos os comportamentos funcionais do mapa real, incluindo pisos rachados, escadas, buracos, warps comportamentais e qualquer mecânica equivalente.
- preservar elevações, transições, eventos, itens e warps existentes; não normalizar células funcionais.
- não inventar metatile IDs, paredes, escadas, buracos, objetos, warps ou connections.
- este mapa não possui connections de borda; não criar saída artificial.`;

export const MEMORIAL_DOS_NOMES_1F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 1F EM CAMADAS SOBRE O MTPYRE_1F REAL 22x19.
Mapa 22x19; nome="Memorial dos Nomes — 1F"

CAMADA 1 — PISO DO ÁTRIO
- ala oeste: x=1..10, y=1..17 -> piso base
- ala leste: x=11..20, y=1..17 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo entrada e subida: x=9..19, y=1..18 -> piso base
- acesso ao exterior: x=1..7, y=4..9 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- saída dupla Route 122: x=15..20, y=16..18 -> preservar
- saída dupla para Exterior: x=1..6, y=4..8 -> preservar
- escada norte para 2F: x=9..13, y=0..3 -> preservar
- retorno leste para 2F: x=18..21, y=7..11 -> preservar
- guardiã e visitantes do átrio: x=11..21, y=0..12 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar a leitura de entrada vivida do Memorial; não inventar lápides, placas ou inscrições sem Pattern real compatível.`;

export const MEMORIAL_DOS_NOMES_2F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 2F EM CAMADAS SOBRE O MTPYRE_2F REAL 13x13.
Mapa 13x13; nome="Memorial dos Nomes — 2F"

CAMADA 1 — PISO DO SEGUNDO ANDAR
- salão principal: x=1..11, y=1..11 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- travessia norte: x=1..11, y=1..4 -> piso base
- travessia sul: x=4..12, y=8..12 -> piso base
- eixo central: x=4..8, y=3..12 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- retorno 1F noroeste: x=0..4, y=0..3 -> preservar
- subida 3F nordeste: x=8..12, y=0..3 -> preservar
- retorno e quedas sudeste: x=8..12, y=8..12 -> preservar
- queda sul central: x=4..8, y=10..12 -> preservar
- Ultra Ball oeste: x=0..2, y=8..12 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- o piso rachado e qualquer célula associada ao STEP_CB_CRACKED_FLOOR são intocáveis; o behavior real sempre vence a camada de piso.`;

export const MEMORIAL_DOS_NOMES_3F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 3F EM CAMADAS SOBRE O MTPYRE_3F REAL 13x13.
Mapa 13x13; nome="Memorial dos Nomes — 3F"

CAMADA 1 — PISO DO TERCEIRO ANDAR
- salão principal: x=1..11, y=1..11 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- travessia norte: x=1..11, y=1..5 -> piso base
- travessia sul: x=1..11, y=9..12 -> piso base
- eixo central: x=4..8, y=3..11 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- retorno 2F nordeste: x=8..12, y=0..3 -> preservar
- subida 4F noroeste: x=0..4, y=0..3 -> preservar
- subida 4F sudeste: x=7..11, y=8..12 -> preservar
- subida 4F sudoeste: x=0..3, y=10..12 -> preservar
- retornos 2F sul: x=4..12, y=10..12 -> preservar
- faixa de treinadores e Pokémon de Arauna: x=0..12, y=2..6 -> preservar
- Super Repel oeste: x=0..2, y=5..9 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar os dois Pokémon de Arauna e todos os treinadores nos pontos reais.`;

export const MEMORIAL_DOS_NOMES_4F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 4F EM CAMADAS SOBRE O MTPYRE_4F REAL 13x13.
Mapa 13x13; nome="Memorial dos Nomes — 4F"

CAMADA 1 — PISO DO QUARTO ANDAR
- salão principal: x=1..11, y=1..11 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo norte sul: x=8..12, y=1..12 -> piso base
- travessia oeste: x=1..10, y=4..8 -> piso base
- retorno sul: x=1..12, y=9..12 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- subida 5F norte: x=8..12, y=0..3 -> preservar
- retorno 3F oeste: x=0..4, y=3..7 -> preservar
- subida 5F leste: x=10..12, y=8..12 -> preservar
- retorno 3F sudeste: x=7..11, y=8..12 -> preservar
- retorno 3F sudoeste: x=0..4, y=10..12 -> preservar
- faixa de treinadora e Pokémon de Arauna: x=7..12, y=1..9 -> preservar
- Sea Incense: x=1..5, y=9..12 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar os Pokémon de Arauna, item e treinadora em seus pontos reais.`;

export const MEMORIAL_DOS_NOMES_5F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 5F EM CAMADAS SOBRE O MTPYRE_5F REAL 13x13.
Mapa 13x13; nome="Memorial dos Nomes — 5F"

CAMADA 1 — PISO DO QUINTO ANDAR
- salão principal: x=1..11, y=1..11 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo oeste: x=1..5, y=1..11 -> piso base
- travessia central: x=2..11, y=5..9 -> piso base
- retorno sul: x=1..12, y=9..12 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- subida 6F noroeste: x=0..4, y=0..3 -> preservar
- retorno 4F nordeste: x=8..12, y=3..7 -> preservar
- subida 6F sudoeste: x=0..3, y=8..12 -> preservar
- retornos 4F leste: x=10..12, y=8..12 -> preservar
- treinador e Pokémon de Arauna: x=1..11, y=5..10 -> preservar
- Lax Incense: x=4..8, y=9..12 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar os Pokémon de Arauna, item e treinador em seus pontos reais.`;

export const MEMORIAL_DOS_NOMES_6F_PROMPT = `RECONSTRUA MEMORIAL DOS NOMES 6F EM CAMADAS SOBRE O MTPYRE_6F REAL 13x13.
Mapa 13x13; nome="Memorial dos Nomes — 6F"

CAMADA 1 — PISO DO SEXTO ANDAR
- salão principal: x=1..11, y=1..11 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo oeste: x=1..5, y=1..11 -> piso base
- faixa de combate: x=4..11, y=2..10 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- retorno 5F norte: x=0..4, y=0..3 -> preservar
- retorno 5F sudoeste: x=0..3, y=8..12 -> preservar
- Valerie e Cedric: x=4..12, y=1..5 -> preservar
- TM Shadow Ball: x=4..8, y=7..11 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar os dois treinadores, o TM e seus corredores de aproximação reais.`;

export const MEMORIAL_DOS_NOMES_EXTERIOR_PROMPT = `RECONSTRUA O EXTERIOR DO MEMORIAL DOS NOMES EM CAMADAS SOBRE O MTPYRE_EXTERIOR REAL 38x51.
Mapa 38x51; nome="Memorial dos Nomes — Exterior"

CAMADA 1 — PISO DAS ENCOSTAS
- encosta noroeste: x=1..18, y=1..24 -> piso base
- encosta nordeste: x=19..36, y=1..24 -> piso base
- encosta sudoeste: x=1..18, y=25..49 -> piso base
- encosta sudeste: x=19..36, y=25..49 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo de subida: x=17..27, y=8..44 -> piso base
- retorno ao 1F: x=7..13, y=38..46 -> piso base
- aproximação ao Summit: x=16..23, y=7..13 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- retorno ao 1F: x=7..13, y=39..45 -> preservar
- entrada dupla do Summit: x=16..23, y=7..13 -> preservar
- faixa de triggers de névoa: x=21..28, y=19..23 -> preservar
- faixa de triggers de sol: x=20..25, y=25..30 -> preservar
- Max Potion: x=25..29, y=13..17 -> preservar
- TM Skill Swap: x=17..21, y=38..42 -> preservar
- Ultra Ball oculto: x=7..11, y=6..10 -> preservar
- Max Ether oculto: x=14..18, y=20..24 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar integralmente os cinco triggers climáticos; névoa e sol não podem ser deslocados ou apagados.`;

export const MEMORIAL_DOS_NOMES_SUMMIT_PROMPT = `RECONSTRUA O SUMMIT DO MEMORIAL DOS NOMES EM CAMADAS SOBRE O MTPYRE_SUMMIT REAL 50x37.
Mapa 50x37; nome="Memorial dos Nomes — Summit"

CAMADA 1 — PISO DO CUME
- quadrante noroeste: x=1..24, y=1..18 -> piso base
- quadrante nordeste: x=25..48, y=1..18 -> piso base
- quadrante sudoeste: x=1..24, y=19..35 -> piso base
- quadrante sudeste: x=25..48, y=19..35 -> piso base

CAMADA 2 — CORREDORES DE LEITURA
- eixo da subida: x=20..26, y=5..33 -> piso base
- travessia dos confrontos: x=18..28, y=9..20 -> piso base
- faixa sul: x=8..38, y=24..33 -> piso base

CAMADA 3 — ZONAS DE PRESERVAÇÃO
- núcleo Dona Zila e líderes: x=19..27, y=3..10 -> preservar
- seis triggers de estado: x=20..26, y=5..11 -> preservar
- corredor dos quatro agentes: x=19..27, y=9..20 -> preservar
- saída tripla para Exterior: x=20..26, y=29..33 -> preservar
- Zinc oculto: x=7..11, y=23..27 -> preservar
- Rare Candy oculto: x=35..39, y=5..9 -> preservar

CAMADA 4 — PRESERVAÇÃO FINAL
${SAFETY}
- preservar integralmente Dona Zila, agentes do Horizonte, líderes herdados, seis triggers e toda a encenação de confronto do Memorial dos Nomes.
- nenhuma remodelagem pode mover ou redesenhar o palco narrativo x=19..27, y=3..20.`;

interface MemorialContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

interface MemorialSpec {
  mapId: string;
  width: number;
  height: number;
  label: string;
}

const SPECS = {
  oneF: { mapId: "MAP_MT_PYRE_1F", width: 22, height: 19, label: "Memorial dos Nomes 1F" },
  twoF: { mapId: "MAP_MT_PYRE_2F", width: 13, height: 13, label: "Memorial dos Nomes 2F" },
  threeF: { mapId: "MAP_MT_PYRE_3F", width: 13, height: 13, label: "Memorial dos Nomes 3F" },
  fourF: { mapId: "MAP_MT_PYRE_4F", width: 13, height: 13, label: "Memorial dos Nomes 4F" },
  fiveF: { mapId: "MAP_MT_PYRE_5F", width: 13, height: 13, label: "Memorial dos Nomes 5F" },
  sixF: { mapId: "MAP_MT_PYRE_6F", width: 13, height: 13, label: "Memorial dos Nomes 6F" },
  exterior: { mapId: "MAP_MT_PYRE_EXTERIOR", width: 38, height: 51, label: "Memorial dos Nomes Exterior" },
  summit: { mapId: "MAP_MT_PYRE_SUMMIT", width: 50, height: 37, label: "Memorial dos Nomes Summit" },
} as const satisfies Record<string, MemorialSpec>;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function memorialGuard(context: MemorialContext, spec: MemorialSpec) {
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
    if (primary !== MEMORIAL_DOS_NOMES_PRIMARY.toLowerCase() || secondary !== MEMORIAL_DOS_NOMES_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: atlas ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Memorial dos Nomes exige ${MEMORIAL_DOS_NOMES_PRIMARY} + ${MEMORIAL_DOS_NOMES_SECONDARY}.`,
      };
    }
  }
  return {
    enabled: true,
    reason: `${spec.label}: preset local disponível com paredes, behaviors funcionais, elevações, warps e eventos preservados.`,
  };
}

function fromAtlas(spec: MemorialSpec, width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) {
  return memorialGuard({
    width,
    height,
    mapId,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  }, spec);
}

export const memorialDosNomes1FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.oneF);
export const memorialDosNomes2FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.twoF);
export const memorialDosNomes3FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.threeF);
export const memorialDosNomes4FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.fourF);
export const memorialDosNomes5FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.fiveF);
export const memorialDosNomes6FGuard = (context: MemorialContext) => memorialGuard(context, SPECS.sixF);
export const memorialDosNomesExteriorGuard = (context: MemorialContext) => memorialGuard(context, SPECS.exterior);
export const memorialDosNomesSummitGuard = (context: MemorialContext) => memorialGuard(context, SPECS.summit);

export const memorialDosNomes1FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.oneF, width, height, mapId, atlas);
export const memorialDosNomes2FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.twoF, width, height, mapId, atlas);
export const memorialDosNomes3FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.threeF, width, height, mapId, atlas);
export const memorialDosNomes4FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.fourF, width, height, mapId, atlas);
export const memorialDosNomes5FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.fiveF, width, height, mapId, atlas);
export const memorialDosNomes6FGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.sixF, width, height, mapId, atlas);
export const memorialDosNomesExteriorGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.exterior, width, height, mapId, atlas);
export const memorialDosNomesSummitGuardFromAtlas = (width: number, height: number, mapId: string | null | undefined, atlas: SavedRealAtlas | null) => fromAtlas(SPECS.summit, width, height, mapId, atlas);
