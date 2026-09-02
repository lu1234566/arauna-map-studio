import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Vila da Passagem sobre o slot real de Oldale.
 * O cruzamento norte/sul/oeste vira a leitura principal da vila, preservando
 * integralmente o bloqueio inicial e a cena do rival no limite sul.
 */
export const VILA_DA_PASSAGEM_PRESET_ID = "piloto-vila-da-passagem" as const;

export const VILA_DA_PASSAGEM_MAP_ID = "MAP_OLDALE_TOWN" as const;
export const VILA_DA_PASSAGEM_WIDTH = 20;
export const VILA_DA_PASSAGEM_HEIGHT = 20;
export const VILA_DA_PASSAGEM_PRIMARY = "gTileset_General";
export const VILA_DA_PASSAGEM_SECONDARY = "gTileset_Petalburg";

export const VILA_DA_PASSAGEM_PROMPT = `RECONSTRUA VILA DA PASSAGEM EM CAMADAS SOBRE O OLDALETOWN REAL 20x20.
Mapa 20x20; nome="Vila da Passagem — piloto de travessia"

CAMADA 1 — ZONAS BASE DA VILA
- bairro noroeste: x=1..8, y=1..8 -> piso base
- bairro nordeste: x=9..18, y=1..8 -> piso base
- bairro sudoeste: x=1..8, y=9..18 -> piso base
- bairro sudeste: x=9..18, y=9..18 -> piso base
- miolo da passagem: x=7..13, y=7..13 -> piso base

CAMADA 2 — ZONAS VERDES AGRUPADAS
- jardim noroeste: x=2..6, y=2..5 -> piso verde
- respiro leste: x=15..18, y=9..13 -> piso verde
- jardim sul: x=2..5, y=14..18 -> piso verde

CAMADA 3 — CAMINHOS E TRAVESSIAS
- eixo norte-sul: x=9..11, y=0..19 -> piso urbano
- saída oeste Route 102: x=0..10, y=9..11 -> piso urbano
- rua dos serviços norte: x=10..17, y=6..8 -> piso urbano
- acesso ao centro de atendimento: x=5..8, y=11..17 -> piso urbano
- acesso à moradia leste: x=13..16, y=11..17 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- bloqueio inicial oeste: x=0..2, y=8..12 -> preservar
- cena do rival sul: x=7..12, y=18..19 -> preservar
- conexão norte Route 103: x=0..19, y=0..1 -> preservar
- conexão sul Route 101: x=0..19, y=18..19 -> preservar
- conexão oeste Route 102: x=0..1, y=0..19 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, triggers, NPCs, placas, colisões funcionais e moldura existentes.
- preservar integralmente o bloqueio inicial da saída oeste e a cena do rival no sul.
- não inventar metatile IDs, edifícios ou conexões.
- reserved cells e protected cells sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida norte -> MAP_ROUTE103 offset 0
saida sul -> MAP_ROUTE101 offset 0
saida oeste -> MAP_ROUTE102 offset 0`;

export interface VilaDaPassagemContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface VilaDaPassagemGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function vilaDaPassagemGuard(context: VilaDaPassagemContext): VilaDaPassagemGuardResult {
  if (context.width !== VILA_DA_PASSAGEM_WIDTH || context.height !== VILA_DA_PASSAGEM_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${VILA_DA_PASSAGEM_WIDTH}×${VILA_DA_PASSAGEM_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== VILA_DA_PASSAGEM_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Vila da Passagem usa o slot real ${VILA_DA_PASSAGEM_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== VILA_DA_PASSAGEM_PRIMARY.toLowerCase() || secondary !== VILA_DA_PASSAGEM_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Vila da Passagem exige ${VILA_DA_PASSAGEM_PRIMARY} + ${VILA_DA_PASSAGEM_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Vila da Passagem” disponível: travessia norte/sul/oeste com bloqueio inicial, rival, eventos e conexões reais preservados.",
  };
}

export function vilaDaPassagemGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return vilaDaPassagemGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
