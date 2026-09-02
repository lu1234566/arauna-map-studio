import { getCollision, type MapData } from "./emeraldMap";
import { LAYER_OCCUPANCY, type LayeredBasePlan } from "./aiLayeredPrompt";

export interface ExactGridBlockedGeometrySafetyStats {
  enabled: boolean;
  protectedCount: number;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Segurança opt-in para cavernas e outros mapas onde paredes do map.bin não
 * devem ser convertidas em piso apenas porque um range retangular as atravessou.
 *
 * Ela só é ativada quando o prompt declara explicitamente preservar paredes,
 * rocha/rochas ou geometria bloqueada. Células que já tinham colisão no mapa real
 * são restauradas integralmente e passam a owner=preserve antes do Template e de
 * qualquer normalização física posterior.
 *
 * Cidades continuam com o comportamento atual: se o prompt não pedir essa
 * proteção, obstáculos antigos ainda podem ser limpos durante uma remodelagem.
 */
export function protectExactGridBlockedGeometry({
  sourceMap,
  layered,
  prompt,
}: {
  sourceMap: MapData;
  layered: LayeredBasePlan;
  prompt: string;
}): ExactGridBlockedGeometrySafetyStats {
  const key = normalize(prompt);
  const enabled = /preserv\w*[^\n]{0,40}\b(?:pared(?:e|es)|rocha(?:s)?|geometria\s+(?:bloqueada|rochosa)|colis(?:ao|oes)\s+bloquead)/.test(key);
  if (!enabled || !layered.active) return { enabled, protectedCount: 0 };

  let protectedCount = 0;
  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    if (getCollision(sourceMap.physical[i] ?? 0) === 0) continue;
    const owner = layered.occupancy[i];
    if (owner === LAYER_OCCUPANCY.reserved || owner === LAYER_OCCUPANCY.structure) continue;

    layered.map.metatiles[i] = sourceMap.metatiles[i] ?? 0;
    layered.map.physical[i] = sourceMap.physical[i] ?? 0;
    layered.occupancy[i] = LAYER_OCCUPANCY.reserved;
    protectedCount++;
  }

  if (protectedCount) {
    layered.warnings.push(
      `Segurança de geometria bloqueada: ${protectedCount} célula(s) originalmente colidível(is) foram restauradas do mapa real e marcadas como preserve.`,
    );
  }

  return { enabled, protectedCount };
}
