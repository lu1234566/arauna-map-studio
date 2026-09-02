import type { SavedRealAtlas } from "./realAtlasStore";

/**
 * Preset determinístico de Porto das Redes sobre o slot real de Dewford.
 * A vila ganha uma leitura de comunidade pesqueira/cais sem mover o embarque
 * herdado, as duas conexões de borda ou qualquer estrutura/evento existente.
 */
export const PORTO_DAS_REDES_PRESET_ID = "piloto-porto-das-redes" as const;

export const PORTO_DAS_REDES_MAP_ID = "MAP_DEWFORD_TOWN" as const;
export const PORTO_DAS_REDES_WIDTH = 20;
export const PORTO_DAS_REDES_HEIGHT = 20;
export const PORTO_DAS_REDES_PRIMARY = "gTileset_General";
export const PORTO_DAS_REDES_SECONDARY = "gTileset_Dewford";

export const PORTO_DAS_REDES_PROMPT = `RECONSTRUA PORTO DAS REDES EM CAMADAS SOBRE O DEWFORDTOWN REAL 20x20.
Mapa 20x20; nome="Porto das Redes — piloto pesqueiro"

CAMADA 1 — ZONAS BASE COSTEIRAS
- bairro noroeste: x=1..8, y=1..8 -> piso base
- bairro nordeste: x=9..18, y=1..7 -> piso base
- miolo oeste: x=1..7, y=8..15 -> piso base
- miolo leste: x=13..18, y=8..16 -> piso base
- faixa sul: x=1..18, y=16..18 -> piso base
- faixa do cais: x=10..14, y=6..11 -> piso portuário

CAMADA 2 — ZONAS VERDES DA COMUNIDADE
- respiro da casa de marés: x=1..6, y=5..8 -> piso verde
- praça das histórias: x=5..9, y=11..15 -> piso verde
- borda verde sudoeste: x=1..5, y=14..18 -> piso verde

CAMADA 3 — CAMINHOS, VIAS E CAIS
- caminho salão-centro: x=2..4, y=3..12 -> piso urbano
- rua central: x=2..17, y=10..12 -> piso urbano
- caminho do ginásio: x=7..9, y=11..18 -> piso urbano
- ligação casa-do-mar e cais: x=8..13, y=8..10 -> piso portuário
- piso de embarque: x=11..14, y=7..9 -> piso portuário
- acesso às moradias leste: x=13..18, y=13..15 -> piso urbano

CAMADA 4 — ZONAS DE PRESERVAÇÃO
- embarque Briney e barco: x=11..13, y=7..10 -> preservar
- conexão norte Route 106: x=0..19, y=0..1 -> preservar
- conexão leste Route 107: x=18..19, y=0..19 -> preservar

CAMADA 5 — PRESERVAÇÃO FINAL
- preservar todas as estruturas reais, fachadas, portas, warps, NPCs, placas, barco, colisões funcionais, água, costa e moldura existentes.
- preservar o ponto de embarque do marinheiro veterano e o barco; não mover nem recriar esses objetos.
- não inventar metatile IDs, água, píeres, barcos ou conexões.
- reserved cells, protected cells e a máscara costeira sempre vencem qualquer camada de piso.
- manter acessos funcionais das portas e a física original das células protegidas.

saida norte -> MAP_ROUTE106 offset -60
saida leste -> MAP_ROUTE107 offset 0`;

export interface PortoDasRedesContext {
  width: number;
  height: number;
  mapId?: string | null;
  atlasPrimary?: string | null;
  atlasSecondary?: string | null;
}

export interface PortoDasRedesGuardResult {
  enabled: boolean;
  reason: string;
}

function normalizeTileset(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function portoDasRedesGuard(context: PortoDasRedesContext): PortoDasRedesGuardResult {
  if (context.width !== PORTO_DAS_REDES_WIDTH || context.height !== PORTO_DAS_REDES_HEIGHT) {
    return {
      enabled: false,
      reason: `Preset bloqueado: exige o layout ${PORTO_DAS_REDES_WIDTH}×${PORTO_DAS_REDES_HEIGHT}; o mapa aberto é ${context.width}×${context.height}.`,
    };
  }

  const mapId = (context.mapId ?? "").trim().toUpperCase();
  if (mapId && mapId !== PORTO_DAS_REDES_MAP_ID) {
    return {
      enabled: false,
      reason: `Preset bloqueado: o map.json aberto é ${mapId}; Porto das Redes usa o slot real ${PORTO_DAS_REDES_MAP_ID}.`,
    };
  }

  const primary = normalizeTileset(context.atlasPrimary);
  const secondary = normalizeTileset(context.atlasSecondary);
  if (primary || secondary) {
    if (primary !== PORTO_DAS_REDES_PRIMARY.toLowerCase() || secondary !== PORTO_DAS_REDES_SECONDARY.toLowerCase()) {
      return {
        enabled: false,
        reason: `Preset bloqueado: o atlas ativo é ${context.atlasPrimary ?? "?"} + ${context.atlasSecondary ?? "?"}; Porto das Redes exige ${PORTO_DAS_REDES_PRIMARY} + ${PORTO_DAS_REDES_SECONDARY}.`,
      };
    }
  }

  return {
    enabled: true,
    reason: "Preset “Piloto Porto das Redes” disponível: vila pesqueira compacta com cais, praça comunitária e embarque/conexões reais preservados.",
  };
}

export function portoDasRedesGuardFromAtlas(
  width: number,
  height: number,
  mapId: string | null | undefined,
  atlas: SavedRealAtlas | null,
) {
  return portoDasRedesGuard({
    width,
    height,
    mapId: mapId ?? null,
    atlasPrimary: atlas?.primary ?? null,
    atlasSecondary: atlas?.secondary ?? null,
  });
}
