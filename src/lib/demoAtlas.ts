import { realAtlasStore } from "./realAtlasStore";

/**
 * Compatibilidade de renderização para componentes antigos do Studio.
 *
 * O protótipo original desenhava grama, árvores, telhados e água com formas
 * geométricas procedurais. Isso era útil apenas para validar a UI, mas podia
 * ser confundido com tiles reais do GBA. A partir de agora o editor nunca
 * inventa arte: ou existe um atlas real, ou a célula fica explicitamente
 * "não resolvida" até um atlas real ser carregado.
 */
export type MetatileCategory =
  | "Natureza"
  | "Caminhos"
  | "Construções"
  | "Água"
  | "Decoração";

export const CATEGORIES: MetatileCategory[] = [];
export const TILE_PX = 16;

export interface DemoMetatile {
  id: number;
  name: string;
  category: MetatileCategory;
  colors: [string, string, string];
  pattern: string;
}

/** Não existem mais metatiles DEMO semânticos no produto. */
export const DEMO_METATILES: DemoMetatile[] = [];
export const METATILE_BY_ID = new Map<number, DemoMetatile>();

/** Mantido só para compatibilidade de imports antigos; não desenha arte falsa. */
export function drawMetatile(ctx: CanvasRenderingContext2D, _tile?: DemoMetatile) {
  ctx.clearRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = "#161b18";
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.strokeStyle = "#3a433d";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(TILE_PX, TILE_PX);
  ctx.moveTo(TILE_PX, 0);
  ctx.lineTo(0, TILE_PX);
  ctx.stroke();
}

let unresolvedCanvas: HTMLCanvasElement | null = null;

function getUnresolvedCanvas(): HTMLCanvasElement {
  if (unresolvedCanvas) return unresolvedCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawMetatile(ctx);
  unresolvedCanvas = canvas;
  return canvas;
}

/** Retorna SOMENTE o atlas real salvo; sem substituição por arte inventada. */
export function getAtlasCanvas(): HTMLCanvasElement {
  const real = realAtlasStore.ensureHydrated();
  if (real) {
    const canvas = realAtlasStore.getSingleRowCanvas(real);
    if (canvas) return canvas;
  }
  return getUnresolvedCanvas();
}

/** Sem atlas real, nenhum ID é fingido como se fosse um tile válido. */
export function getAtlasSlot(id: number): number | undefined {
  const real = realAtlasStore.ensureHydrated();
  return real ? realAtlasStore.recordFor(id, real)?.slot : undefined;
}

export function hasRealAtlas(): boolean {
  return Boolean(realAtlasStore.ensureHydrated());
}
