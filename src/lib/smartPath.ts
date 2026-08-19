import { METATILE_MASK, idx, type MapData } from "./emeraldMap";

export const SMART_PATH_FORMAT = "arauna-smart-path-v1" as const;

export const DIR_N = 1;
export const DIR_E = 2;
export const DIR_S = 4;
export const DIR_W = 8;

export const SMART_PATH_MASK_ORDER = [
  0,
  DIR_N,
  DIR_E,
  DIR_S,
  DIR_W,
  DIR_N | DIR_S,
  DIR_E | DIR_W,
  DIR_N | DIR_E,
  DIR_E | DIR_S,
  DIR_S | DIR_W,
  DIR_W | DIR_N,
  DIR_N | DIR_E | DIR_S,
  DIR_E | DIR_S | DIR_W,
  DIR_S | DIR_W | DIR_N,
  DIR_W | DIR_N | DIR_E,
  DIR_N | DIR_E | DIR_S | DIR_W,
] as const;

export interface SmartPathScope {
  primary: string;
  secondary: string;
}

export interface SmartPathPreset {
  format: typeof SMART_PATH_FORMAT;
  id: string;
  name: string;
  /** index = NESW bitmask (N=1, E=2, S=4, W=8), value = metatile ID */
  variants: number[];
  /** metatile placed when erasing a smart-path cell */
  eraseMetatile: number;
  scope?: SmartPathScope;
  createdAt: string;
  updatedAt: string;
}

export type SmartPathMode = "add" | "erase";

export interface SmartPathUpdate {
  x: number;
  y: number;
  index: number;
  metatile: number;
  mask: number | null;
  reason: "target" | "retile";
}

export interface SmartPathPlan {
  updates: SmartPathUpdate[];
  skippedProtected: Array<{ x: number; y: number }>;
  mode: SmartPathMode;
  target: { x: number; y: number };
}

export interface SmartPathValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSmartPathPreset(preset: SmartPathPreset): SmartPathValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (preset.format !== SMART_PATH_FORMAT) errors.push(`Formato inválido: ${String(preset.format)}.`);
  if (!preset.id.trim()) errors.push("Preset sem id.");
  if (!preset.name.trim()) errors.push("Preset sem nome.");
  if (!Array.isArray(preset.variants) || preset.variants.length !== 16) {
    errors.push("O preset precisa mapear exatamente os 16 masks NESW (0..15).");
  } else {
    preset.variants.forEach((value, mask) => {
      if (!Number.isInteger(value) || value < 0 || value > METATILE_MASK) {
        errors.push(`Mask ${mask}: metatile ${String(value)} fora de 0..0x03FF.`);
      }
    });
  }
  if (!Number.isInteger(preset.eraseMetatile) || preset.eraseMetatile < 0 || preset.eraseMetatile > METATILE_MASK) {
    errors.push(`Metatile de apagar ${String(preset.eraseMetatile)} fora de 0..0x03FF.`);
  }
  const family = new Set(preset.variants);
  if (family.has(preset.eraseMetatile)) {
    errors.push("O metatile de apagar também pertence à família do Smart Path; isso impediria desconectar o caminho.");
  }
  if (family.size < 16) {
    warnings.push(`O preset usa ${family.size} metatile(s) distinto(s) para 16 masks. Duplicatas são permitidas.`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function smartPathFamily(preset: SmartPathPreset): Set<number> {
  return new Set(preset.variants.map((value) => value & METATILE_MASK));
}

export function maskLabel(mask: number): string {
  if (mask === 0) return "isolado";
  const parts: string[] = [];
  if (mask & DIR_N) parts.push("N");
  if (mask & DIR_E) parts.push("E");
  if (mask & DIR_S) parts.push("S");
  if (mask & DIR_W) parts.push("W");
  return parts.join("+");
}

function inBounds(map: MapData, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function smartPathNeighborMask(
  map: MapData,
  x: number,
  y: number,
  family: Set<number>,
  override?: { x: number; y: number; member: boolean },
): number {
  const memberAt = (nx: number, ny: number) => {
    if (!inBounds(map, nx, ny)) return false;
    if (override && nx === override.x && ny === override.y) return override.member;
    return family.has((map.metatiles[idx(nx, ny, map.width)] ?? 0) & METATILE_MASK);
  };
  let mask = 0;
  if (memberAt(x, y - 1)) mask |= DIR_N;
  if (memberAt(x + 1, y)) mask |= DIR_E;
  if (memberAt(x, y + 1)) mask |= DIR_S;
  if (memberAt(x - 1, y)) mask |= DIR_W;
  return mask;
}

/**
 * Plans one Smart Path brush operation without mutating MapData.
 * Only the target and its four orthogonal neighbors ever need re-tiling.
 */
export function planSmartPath(
  map: MapData,
  preset: SmartPathPreset,
  targetX: number,
  targetY: number,
  mode: SmartPathMode,
  canEdit: (x: number, y: number) => boolean = () => true,
): SmartPathPlan {
  const validation = validateSmartPathPreset(preset);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  if (!inBounds(map, targetX, targetY)) {
    return { updates: [], skippedProtected: [], mode, target: { x: targetX, y: targetY } };
  }
  if (!canEdit(targetX, targetY)) {
    return {
      updates: [],
      skippedProtected: [{ x: targetX, y: targetY }],
      mode,
      target: { x: targetX, y: targetY },
    };
  }

  const family = smartPathFamily(preset);
  const targetCurrent = (map.metatiles[idx(targetX, targetY, map.width)] ?? 0) & METATILE_MASK;
  // "Apagar" só remove uma célula que já pertence a esta família. Isso impede
  // um clique acidental de substituir casa/água/árvore por eraseMetatile.
  if (mode === "erase" && !family.has(targetCurrent)) {
    return { updates: [], skippedProtected: [], mode, target: { x: targetX, y: targetY } };
  }

  const override = { x: targetX, y: targetY, member: mode === "add" };
  const positions = [
    { x: targetX, y: targetY, reason: "target" as const },
    { x: targetX, y: targetY - 1, reason: "retile" as const },
    { x: targetX + 1, y: targetY, reason: "retile" as const },
    { x: targetX, y: targetY + 1, reason: "retile" as const },
    { x: targetX - 1, y: targetY, reason: "retile" as const },
  ];
  const updates: SmartPathUpdate[] = [];
  const skippedProtected: Array<{ x: number; y: number }> = [];

  for (const position of positions) {
    const { x, y, reason } = position;
    if (!inBounds(map, x, y)) continue;
    if (!canEdit(x, y)) {
      skippedProtected.push({ x, y });
      continue;
    }
    const current = (map.metatiles[idx(x, y, map.width)] ?? 0) & METATILE_MASK;
    if (x === targetX && y === targetY && mode === "erase") {
      const desired = preset.eraseMetatile & METATILE_MASK;
      if (current !== desired) {
        updates.push({ x, y, index: idx(x, y, map.width), metatile: desired, mask: null, reason });
      }
      continue;
    }

    const virtualMember = x === targetX && y === targetY
      ? mode === "add"
      : family.has(current);
    if (!virtualMember) continue;
    const mask = smartPathNeighborMask(map, x, y, family, override);
    const desired = preset.variants[mask]! & METATILE_MASK;
    if (current !== desired) {
      updates.push({ x, y, index: idx(x, y, map.width), metatile: desired, mask, reason });
    }
  }

  return { updates, skippedProtected, mode, target: { x: targetX, y: targetY } };
}

export function applySmartPathPlan(map: MapData, plan: SmartPathPlan): MapData {
  const next: MapData = {
    width: map.width,
    height: map.height,
    metatiles: new Uint16Array(map.metatiles),
    physical: new Uint16Array(map.physical),
  };
  for (const update of plan.updates) next.metatiles[update.index] = update.metatile & METATILE_MASK;
  return next;
}

export function createSmartPathPreset(
  name: string,
  seedMetatile: number,
  eraseMetatile: number,
  scope?: SmartPathScope,
): SmartPathPreset {
  const now = new Date().toISOString();
  const safeSeed = seedMetatile & METATILE_MASK;
  const safeErase = eraseMetatile & METATILE_MASK;
  const id = `smart-path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    format: SMART_PATH_FORMAT,
    id,
    name: name.trim() || "Novo Smart Path",
    variants: Array.from({ length: 16 }, () => safeSeed),
    eraseMetatile: safeErase,
    ...(scope ? { scope: { ...scope } } : {}),
    createdAt: now,
    updatedAt: now,
  };
}
