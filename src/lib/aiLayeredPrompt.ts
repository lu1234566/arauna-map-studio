import {
  cloneMap,
  COLLISION_MASK,
  getCollision,
  idx,
  METATILE_MASK,
  type MapData,
} from "./emeraldMap";
import type { AiMapReconstructionPlan } from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import type { MapBlueprint } from "./mapBlueprint";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

const WATER_BEHAVIORS = new Set([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]);
const NORMAL_GROUND_BEHAVIOR = 0x00;
const MATERIAL_UNSET = -1;
const MATERIAL_PRESERVE = -2;

export const LAYER_OCCUPANCY = {
  unset: 0,
  base: 1,
  structure: 2,
  road: 3,
  detail: 4,
  overlay: 5,
  reserved: 6,
} as const;

export type LayerOccupancyName = keyof typeof LAYER_OCCUPANCY;
export type LayerMaterialRole = "base" | "urban" | "green" | "port" | "preserve" | "metatile";
export type LayerZoneKind = "ground" | "road";

export interface LayerMaterialSpec {
  role: LayerMaterialRole;
  explicitId?: number;
  source: string;
}

export interface PromptLayerZone {
  id: string;
  label: string;
  kind: LayerZoneKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  material: LayerMaterialSpec;
  line: number;
}

export interface ParsedLayeredPrompt {
  active: boolean;
  zones: PromptLayerZone[];
  requireFullCoverage: boolean;
  strictFinish: boolean;
  strictIsolation: boolean;
  /** O prompt declara explicitamente que tudo fora das zonas deve ser preservado. */
  preserveUnassigned: boolean;
  errors: string[];
  warnings: string[];
}

export interface LayeredBasePlan {
  active: boolean;
  map: MapData;
  touched: number[];
  occupancy: Uint8Array;
  materialByCell: Int32Array;
  parsed: ParsedLayeredPrompt;
  errors: string[];
  warnings: string[];
  assignedCount: number;
  eligibleCount: number;
  unsetCount: number;
  detailPreservedCount: number;
  detailRejectedCount: number;
}

export interface LayeredFinishPlan {
  active: boolean;
  map: MapData;
  touched: number[];
  enforcedCount: number;
  collisionClearedCount: number;
  pathPreservedCount: number;
  detailPreservedCount: number;
  overlayPreservedCount: number;
  warnings: string[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "zona";
}

function inBounds(map: MapData, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function parseAxisRange(line: string, axis: "x" | "y") {
  const expression = new RegExp(
    `\\b${axis}\\s*[:=]\\s*(-?\\d+)\\s*(?:\\.\\.|…|ate|até|a|-)\\s*(-?\\d+)`,
    "i",
  );
  const match = line.match(expression);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function materialFromText(source: string): LayerMaterialSpec | null {
  const key = normalize(source);
  const hex = source.match(/(?:metatile|tile|id)?\s*0x([0-9a-f]{1,3})\b/i);
  if (hex) return { role: "metatile", explicitId: Number.parseInt(hex[1]!, 16), source };
  const decimal = source.match(/(?:metatile|tile|id)\s*#?\s*(\d{1,4})\b/i);
  if (decimal) return { role: "metatile", explicitId: Number(decimal[1]), source };
  if (/(preserv|manter|nao alterar|não alterar|agua|água|costa|litoral)/.test(key)) {
    return { role: "preserve", source };
  }
  if (/(grama|verde|veget|jardim|parque)/.test(key)) return { role: "green", source };
  if (/(bege|areia|portuar|porto|cais|promenade|doca)/.test(key)) return { role: "port", source };
  if (/(concret|paviment|urbano|calcad|calçad|asfalto|residencial)/.test(key)) return { role: "urban", source };
  if (/(base|neutro|comum|solo comum|piso comum)/.test(key)) return { role: "base", source };
  return null;
}

function sectionForHeading(line: string): LayerZoneKind | "finish" | null {
  const key = normalize(line);
  if (!/\bcamada\b/.test(key)) return null;
  if (/(rua|via|caminh|corredor|praca|praça|aproxim)/.test(key)) return "road";
  if (/(detalh|acabamento|finish|overlay|sobrepos)/.test(key)) return "finish";
  if (/(zona|base|solo|chao|chão|terreno|piso)/.test(key)) return "ground";
  return null;
}

function labelBeforeRange(line: string, fallback: string) {
  const xIndex = normalize(line).search(/\bx\s*[:=]/);
  const raw = (xIndex >= 0 ? line.slice(0, xIndex) : line)
    .replace(/^\s*[-*•]+\s*/, "")
    .replace(/\s*(?:em|:|=)\s*$/i, "")
    .trim();
  return raw || fallback;
}

export function parseLayeredPrompt(prompt: string): ParsedLayeredPrompt {
  const zones: PromptLayerZone[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = prompt.split(/\r?\n/);
  let section: LayerZoneKind | "finish" | null = null;
  let sawLayerHeading = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!.trim();
    if (!line) continue;
    const heading = sectionForHeading(line);
    if (heading) {
      section = heading;
      sawLayerHeading = true;
      continue;
    }

    const x = parseAxisRange(line, "x");
    const y = parseAxisRange(line, "y");
    if (!x || !y) continue;
    const kind: LayerZoneKind = section === "road" ? "road" : "ground";
    const arrow = line.match(/(?:→|->|=>)\s*(.+)$/);
    const target = arrow?.[1]?.trim() ?? (kind === "road" ? line : "");
    const material = materialFromText(target)
      ?? (kind === "road" ? { role: /porto|cais|doca/i.test(line) ? "port" as const : "urban" as const, source: line } : null);
    if (!material) {
      errors.push(`Camada, linha ${lineIndex + 1}: material não reconhecido em “${line}”.`);
      continue;
    }
    const label = labelBeforeRange(line, `${kind === "road" ? "via" : "zona"}-${zones.length + 1}`);
    zones.push({
      id: `${kind}-${slug(label)}-${zones.length + 1}`,
      label,
      kind,
      x1: x.min,
      x2: x.max,
      y1: y.min,
      y2: y.max,
      material,
      line: lineIndex + 1,
    });
  }

  const key = normalize(prompt);
  const requireFullCoverage = /(preencher\s*100%|100%\s*do\s*mapa|nenhuma\s*celula\s*(?:vazia|unset)|sem\s*celulas\s*(?:vazias|unset))/i.test(key);
  const strictFinish = sawLayerHeading && (
    /(nao\s*mistur|não\s*mistur|somente\s*um\s*tipo|apenas\s*nas\s*zonas|ocupacao|ocupação|sem\s*sobrepos)/i.test(key)
    || zones.length > 0
  );
  const active = sawLayerHeading && zones.length > 0;
  const strictIsolation = active;
  if (sawLayerHeading && !zones.length && !errors.length) {
    warnings.push("Prompt menciona camadas, mas nenhuma zona x=.. / y=.. foi reconhecida; o pipeline clássico será usado.");
  }
  return { active, zones, requireFullCoverage, strictFinish, strictIsolation, errors, warnings };
}

function behaviorMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.behavior]));
}

function layerTypeMap(atlas: SavedRealAtlas | null) {
  return new Map((atlas?.records ?? []).map((record) => [record.id & METATILE_MASK, record.layerType]));
}

function resolveMaterial(
  material: LayerMaterialSpec,
  reconstruction: AiMapReconstructionPlan,
  portMetatile: number | null,
  atlas: SavedRealAtlas,
) {
  if (material.role === "preserve") return { id: MATERIAL_PRESERVE, error: null as string | null };
  if (material.role === "base") {
    return reconstruction.baseMetatile == null
      ? { id: MATERIAL_UNSET, error: "piso-base real não pôde ser derivado" }
      : { id: reconstruction.baseMetatile & METATILE_MASK, error: null };
  }
  if (material.role === "urban") {
    return reconstruction.urbanMetatile == null
      ? { id: MATERIAL_UNSET, error: "piso urbano real não pôde ser derivado" }
      : { id: reconstruction.urbanMetatile & METATILE_MASK, error: null };
  }
  if (material.role === "green") {
    return reconstruction.greenMetatile == null
      ? { id: MATERIAL_UNSET, error: "piso verde real não pôde ser derivado" }
      : { id: reconstruction.greenMetatile & METATILE_MASK, error: null };
  }
  if (material.role === "port") {
    return portMetatile == null
      ? { id: MATERIAL_UNSET, error: "piso portuário/bege real não pôde ser derivado" }
      : { id: portMetatile & METATILE_MASK, error: null };
  }

  const id = Number(material.explicitId) & METATILE_MASK;
  const record = atlas.records.find((candidate) => (candidate.id & METATILE_MASK) === id);
  if (!record) return { id: MATERIAL_UNSET, error: `metatile explícito 0x${id.toString(16).toUpperCase()} não existe no atlas ativo` };
  if ((record.behavior ?? -1) !== NORMAL_GROUND_BEHAVIOR) {
    return { id: MATERIAL_UNSET, error: `metatile explícito 0x${id.toString(16).toUpperCase()} não é piso NORMAL` };
  }
  if ((record.layerType ?? 0) !== 0) {
    return { id: MATERIAL_UNSET, error: `metatile explícito 0x${id.toString(16).toUpperCase()} usa layering; não pode ser material-base` };
  }
  return { id, error: null };
}

function coordinateTag(pattern: MapPattern, prefix: string) {
  for (const tag of pattern.tags ?? []) {
    const match = tag.match(new RegExp(`^${prefix}:\\s*(-?\\d+)\\s*,\\s*(-?\\d+)$`, "i"));
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
  }
  return null;
}

function originalOrigin(pattern: MapPattern) {
  const fixed = coordinateTag(pattern, "fixed-origin");
  if (fixed) return fixed;
  const anchor = coordinateTag(pattern, "warp-anchor");
  if (!anchor) return null;
  const port = (pattern.ports ?? []).find((candidate) => candidate.id === "entrada" || normalize(candidate.name) === "entrada");
  return port ? { x: anchor.x - port.x, y: anchor.y - port.y } : null;
}

function contextKind(pattern: MapPattern): "green" | "urban" | "port" | null {
  const key = normalize(`${pattern.id} ${pattern.name} ${pattern.category} ${(pattern.tags ?? []).join(" ")}`);
  if (pattern.id.toLowerCase().includes("-green-") || /(trecho verde|vegetac|jardim)/.test(key)) return "green";
  if (pattern.id.toLowerCase().includes("-coast-") || /(trecho costeiro|porto|cais|doca)/.test(key)) return "port";
  if (pattern.id.toLowerCase().includes("-urban-") || /(trecho urbano|urbanismo|rua)/.test(key)) return "urban";
  return null;
}

function patternByReference(reference: string, patterns: MapPattern[]) {
  const direct = patterns.find((pattern) => pattern.id === reference);
  if (direct) return direct;
  const key = normalize(reference);
  const matches = patterns.filter((pattern) => normalize(pattern.name) === key);
  return matches.length === 1 ? matches[0]! : null;
}

function markRect(mask: Uint8Array, map: MapData, x: number, y: number, width: number, height: number, value = 1) {
  for (let py = Math.max(0, y); py < Math.min(map.height, y + height); py++) {
    for (let px = Math.max(0, x); px < Math.min(map.width, x + width); px++) {
      mask[idx(px, py, map.width)] = value;
    }
  }
}

function buildProtectionMasks(
  map: MapData,
  atlas: SavedRealAtlas,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  blueprint: MapBlueprint | null,
  strictIsolation: boolean,
) {
  const structure = new Uint8Array(map.width * map.height);
  const reserved = new Uint8Array(map.width * map.height);
  const coast = new Uint8Array(map.width * map.height);
  const behaviors = behaviorMap(atlas);

  for (const cell of reservedCells) {
    if (inBounds(map, cell.x, cell.y)) reserved[idx(cell.x, cell.y, map.width)] = 1;
  }

  if (!strictIsolation) {
    for (const pattern of patterns) {
      const origin = originalOrigin(pattern);
      if (origin) markRect(structure, map, origin.x, origin.y, pattern.width, pattern.height);
    }
  }

  for (const placement of blueprint?.patterns ?? []) {
    const pattern = patternByReference(placement.pattern, patterns);
    if (!pattern || contextKind(pattern)) continue;
    markRect(structure, map, placement.x, placement.y, pattern.width, pattern.height);
  }

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(x, y, map.width);
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if (!WATER_BEHAVIORS.has(behaviors.get(id) ?? -1)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (inBounds(map, px, py)) coast[idx(px, py, map.width)] = 1;
        }
      }
    }
  }
  return { structure, reserved, coast, behaviors };
}

function roleCode(role: LayerMaterialRole) {
  if (role === "urban") return 2;
  if (role === "green") return 3;
  if (role === "port") return 4;
  if (role === "preserve") return 5;
  if (role === "metatile") return 6;
  return 1;
}

function expectedContextRole(kind: "green" | "urban" | "port") {
  return kind === "green" ? 3 : kind === "port" ? 4 : 2;
}

/**
 * Etapa A — zone-first. O mapa visual nasce de uma occupancy map lógica. Zonas de
 * solo são aplicadas em ordem; uma camada posterior pode sobrescrever o material
 * de uma camada anterior. Estruturas/eventos ficam reservados e corredores de rua
 * têm prioridade sobre o solo. Em isolamento estrito, somente estruturas citadas
 * pelo Blueprint continuam protegidas; fachadas mineradas antigas não vazam para
 * a composição nova.
 */
export function planLayeredPromptBase(
  sourceMap: MapData,
  prompt: string,
  atlas: SavedRealAtlas | null,
  patterns: MapPattern[],
  reservedCells: AiReservedCell[],
  reconstruction: AiMapReconstructionPlan | null,
  portMetatile: number | null,
  blueprint: MapBlueprint | null,
): LayeredBasePlan {
  const parsed = parseLayeredPrompt(prompt);
  const map = cloneMap(sourceMap);
  const occupancy = new Uint8Array(sourceMap.width * sourceMap.height);
  const materialByCell = new Int32Array(sourceMap.width * sourceMap.height);
  materialByCell.fill(MATERIAL_UNSET);
  const errors = [...parsed.errors];
  const warnings = [...parsed.warnings];
  const touched: number[] = [];

  const inactive = (): LayeredBasePlan => ({
    active: false,
    map,
    touched,
    occupancy,
    materialByCell,
    parsed,
    errors,
    warnings,
    assignedCount: 0,
    eligibleCount: 0,
    unsetCount: 0,
    detailPreservedCount: 0,
    detailRejectedCount: 0,
  });
  if (!parsed.active) return inactive();
  if (!atlas || !reconstruction) {
    errors.push("Camadas zone-first exigem atlas real e vocabulário de reconstrução carregados.");
    return { ...inactive(), active: true };
  }

  const { structure, reserved, coast } = buildProtectionMasks(
    sourceMap,
    atlas,
    patterns,
    reservedCells,
    blueprint,
    parsed.strictIsolation,
  );
  for (let i = 0; i < occupancy.length; i++) {
    if (structure[i]) occupancy[i] = LAYER_OCCUPANCY.structure;
    else if (reserved[i] || coast[i]) occupancy[i] = LAYER_OCCUPANCY.reserved;
  }

  const roleByCell = new Int8Array(sourceMap.width * sourceMap.height);
  const roadByCell = new Uint8Array(sourceMap.width * sourceMap.height);
  let groundOverrideCount = 0;

  for (const zone of parsed.zones) {
    if (zone.x1 < 0 || zone.y1 < 0 || zone.x2 >= sourceMap.width || zone.y2 >= sourceMap.height) {
      errors.push(`Zona “${zone.label}” (linha ${zone.line}) ultrapassa ${sourceMap.width}×${sourceMap.height}.`);
      continue;
    }
    const resolved = resolveMaterial(zone.material, reconstruction, portMetatile, atlas);
    if (resolved.error) {
      errors.push(`Zona “${zone.label}”: ${resolved.error}.`);
      continue;
    }
    const role = roleCode(zone.material.role);
    for (let y = zone.y1; y <= zone.y2; y++) {
      for (let x = zone.x1; x <= zone.x2; x++) {
        const i = idx(x, y, sourceMap.width);
        const previous = materialByCell[i];
        if (zone.kind === "road") {
          if (previous !== MATERIAL_UNSET && previous !== resolved.id) groundOverrideCount++;
          roadByCell[i] = 1;
          roleByCell[i] = role;
          materialByCell[i] = resolved.id;
          continue;
        }
        if (previous !== MATERIAL_UNSET && previous !== resolved.id) groundOverrideCount++;
        roleByCell[i] = role;
        materialByCell[i] = resolved.id;
      }
    }
  }

  if (groundOverrideCount) {
    warnings.push(`${groundOverrideCount} célula(s) receberam material de uma camada posterior; ordem do prompt venceu deterministicamente.`);
  }
  if (parsed.strictIsolation) {
    warnings.push("Isolamento estrito A+B: somente estruturas presentes no plano, eventos reservados e costa protegida sobrevivem ao mapa-base antigo.");
  }

  let detailPreservedCount = 0;
  let detailRejectedCount = 0;
  for (const placement of blueprint?.patterns ?? []) {
    const pattern = patternByReference(placement.pattern, patterns);
    if (!pattern) continue;
    const kind = contextKind(pattern);
    if (!kind) continue;
    const expected = expectedContextRole(kind);
    let allowed = true;
    for (let py = 0; py < pattern.height && allowed; py++) {
      for (let px = 0; px < pattern.width; px++) {
        const x = placement.x + px;
        const y = placement.y + py;
        if (!inBounds(sourceMap, x, y)) { allowed = false; break; }
        const i = idx(x, y, sourceMap.width);
        if (roleByCell[i] !== expected && !(kind === "urban" && roadByCell[i])) {
          allowed = false;
          break;
        }
      }
    }
    if (!allowed) {
      detailRejectedCount++;
      warnings.push(`Detail “${pattern.name}” será descartado no finish layer porque está fora da zona ${kind}.`);
      continue;
    }
    detailPreservedCount++;
    markRect(occupancy, sourceMap, placement.x, placement.y, pattern.width, pattern.height, LAYER_OCCUPANCY.detail);
  }

  let assignedCount = 0;
  let eligibleCount = 0;
  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    if (structure[i] || reserved[i] || coast[i]) continue;
    eligibleCount++;
    if (materialByCell[i] !== MATERIAL_UNSET || roadByCell[i]) assignedCount++;
  }
  const unsetCount = Math.max(0, eligibleCount - assignedCount);
  if (parsed.requireFullCoverage && unsetCount) {
    errors.push(`Camadas exigem cobertura total, mas ${unsetCount} célula(s) editável(is) ficaram UNSET. Defina outra zona antes de aplicar.`);
  }

  if (errors.length) {
    return {
      active: true,
      map,
      touched,
      occupancy,
      materialByCell,
      parsed,
      errors,
      warnings,
      assignedCount,
      eligibleCount,
      unsetCount,
      detailPreservedCount,
      detailRejectedCount,
    };
  }

  for (let i = 0; i < sourceMap.metatiles.length; i++) {
    if (structure[i] || reserved[i] || coast[i] || occupancy[i] === LAYER_OCCUPANCY.detail) continue;
    const desired = materialByCell[i];
    if (desired === MATERIAL_UNSET || desired === MATERIAL_PRESERVE) continue;
    const current = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const currentCollision = getCollision(map.physical[i] ?? 0);
    if (current !== desired) {
      map.metatiles[i] = desired;
      touched.push(i);
    }
    if (currentCollision !== 0) {
      map.physical[i] = ((map.physical[i] ?? 0) & ~COLLISION_MASK) & 0xffff;
      touched.push(i);
    }
    occupancy[i] = roadByCell[i] ? LAYER_OCCUPANCY.road : LAYER_OCCUPANCY.base;
  }

  warnings.push(
    `Zone-first: ${parsed.zones.filter((zone) => zone.kind === "ground").length} zona(s) de solo + ${parsed.zones.filter((zone) => zone.kind === "road").length} corredor(es); ${assignedCount}/${eligibleCount} célula(s) editáveis receberam dono de camada e ${unsetCount} ficaram UNSET.`,
  );
  return {
    active: true,
    map,
    touched: Array.from(new Set(touched)),
    occupancy,
    materialByCell,
    parsed,
    errors,
    warnings,
    assignedCount,
    eligibleCount,
    unsetCount,
    detailPreservedCount,
    detailRejectedCount,
  };
}

function smartPathFamily(smartPaths: SmartPathPreset[]) {
  const family = new Set<number>();
  for (const preset of smartPaths) {
    for (const value of preset.variants ?? []) family.add(Number(value) & METATILE_MASK);
  }
  return family;
}

/**
 * Etapa B — finish layer. Reimpõe o material exato de cada zona depois que
 * estruturas/Smart Paths foram compostos. Smart Paths só sobrevivem quando estão
 * numa zona de rua ou quando foram realmente desenhados depois da base A+B; tiles
 * antigos da mesma família deixam de vazar para o resultado.
 */
export function finishLayeredPromptMap(
  sourceMap: MapData,
  basePlan: LayeredBasePlan,
  atlas: SavedRealAtlas | null,
  smartPaths: SmartPathPreset[],
): LayeredFinishPlan {
  const map = cloneMap(sourceMap);
  const touched: number[] = [];
  const warnings: string[] = [];
  if (!basePlan.active || basePlan.errors.length || !atlas) {
    return {
      active: false,
      map,
      touched,
      enforcedCount: 0,
      collisionClearedCount: 0,
      pathPreservedCount: 0,
      detailPreservedCount: 0,
      overlayPreservedCount: 0,
      warnings,
    };
  }

  const paths = smartPathFamily(smartPaths);
  const layers = layerTypeMap(atlas);
  let enforcedCount = 0;
  let collisionClearedCount = 0;
  let pathPreservedCount = 0;
  let detailPreservedCount = 0;
  let overlayPreservedCount = 0;

  for (let i = 0; i < map.metatiles.length; i++) {
    const occupancy = basePlan.occupancy[i];
    if (occupancy === LAYER_OCCUPANCY.structure || occupancy === LAYER_OCCUPANCY.reserved) {
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if ((layers.get(id) ?? 0) > 0) overlayPreservedCount++;
      continue;
    }
    if (occupancy === LAYER_OCCUPANCY.detail) {
      detailPreservedCount++;
      const id = (map.metatiles[i] ?? 0) & METATILE_MASK;
      if ((layers.get(id) ?? 0) > 0) overlayPreservedCount++;
      continue;
    }

    const current = (map.metatiles[i] ?? 0) & METATILE_MASK;
    const beforeTemplate = (basePlan.map.metatiles[i] ?? 0) & METATILE_MASK;
    const generatedPath = paths.has(current) && (
      occupancy === LAYER_OCCUPANCY.road
      || current !== beforeTemplate
    );
    if (generatedPath) {
      basePlan.occupancy[i] = LAYER_OCCUPANCY.road;
      pathPreservedCount++;
      continue;
    }

    const desired = basePlan.materialByCell[i];
    if (desired === MATERIAL_UNSET || desired === MATERIAL_PRESERVE) continue;
    if (current !== desired) {
      map.metatiles[i] = desired;
      touched.push(i);
      enforcedCount++;
    }
    if (getCollision(map.physical[i] ?? 0) !== 0) {
      map.physical[i] = ((map.physical[i] ?? 0) & ~COLLISION_MASK) & 0xffff;
      touched.push(i);
      collisionClearedCount++;
    }
  }

  warnings.push(
    `Finish layer: ${enforcedCount} célula(s) voltaram ao material exato da zona; ${pathPreservedCount} célula(s) de Smart Path realmente desenhadas, ${detailPreservedCount} célula(s) de detalhe permitido e ${overlayPreservedCount} overlay(s) dentro de estruturas/detalhes foram preservados.`,
  );
  return {
    active: true,
    map,
    touched: Array.from(new Set(touched)),
    enforcedCount,
    collisionClearedCount,
    pathPreservedCount,
    detailPreservedCount,
    overlayPreservedCount,
    warnings,
  };
}
