import { realAtlasStore } from "./realAtlasStore";

/**
 * Fallback visual do editor.
 *
 * Quando um atlas real General + Petalburg foi montado no Tileset Lab, as
 * funções getAtlasCanvas/getAtlasSlot passam a usar automaticamente aquele
 * atlas. Estes metatiles procedurais continuam existindo somente para que o
 * editor funcione antes da primeira configuração.
 */
export type MetatileCategory =
  | "Natureza"
  | "Caminhos"
  | "Construções"
  | "Água"
  | "Decoração";

export const CATEGORIES: MetatileCategory[] = [
  "Natureza",
  "Caminhos",
  "Construções",
  "Água",
  "Decoração",
];

export type PatternKind =
  | "flat"
  | "noise"
  | "grass"
  | "tallgrass"
  | "tree"
  | "flowers"
  | "path"
  | "pathEdge"
  | "gravel"
  | "stairs"
  | "wall"
  | "roof"
  | "window"
  | "door"
  | "floor"
  | "water"
  | "waveTop"
  | "deep"
  | "sand"
  | "sign"
  | "fence"
  | "rock"
  | "stump"
  | "mailbox"
  | "ledge";

export interface DemoMetatile {
  id: number;
  name: string;
  category: MetatileCategory;
  colors: [string, string, string];
  pattern: PatternKind;
}

const t = (
  id: number,
  name: string,
  category: MetatileCategory,
  colors: [string, string, string],
  pattern: PatternKind,
): DemoMetatile => ({ id, name, category, colors, pattern });

export const DEMO_METATILES: DemoMetatile[] = [
  t(0x000, "Grama clara", "Natureza", ["#5c9c4a", "#6fb45a", "#4a8039"], "grass"),
  t(0x001, "Grama escura", "Natureza", ["#3f7a37", "#4c8f41", "#2f5f2a"], "grass"),
  t(0x002, "Grama alta", "Natureza", ["#357033", "#4f9a45", "#25502a"], "tallgrass"),
  t(0x003, "Árvore", "Natureza", ["#2b5a2c", "#3f8038", "#1c3a20"], "tree"),
  t(0x004, "Arbusto", "Natureza", ["#33693a", "#478a44", "#22482a"], "noise"),
  t(0x005, "Flores", "Natureza", ["#5c9c4a", "#e8d45a", "#d1584f"], "flowers"),
  t(0x006, "Terra batida", "Natureza", ["#9c7a4c", "#b08e5c", "#7d5f38"], "noise"),
  t(0x007, "Rocha", "Natureza", ["#7b7b74", "#9a9a90", "#5a5a55"], "rock"),
  t(0x040, "Caminho areia", "Caminhos", ["#d8c08a", "#e6d3a3", "#bda06c"], "path"),
  t(0x041, "Borda caminho", "Caminhos", ["#c9ad76", "#d8c08a", "#a98a58"], "pathEdge"),
  t(0x042, "Cascalho", "Caminhos", ["#a99a86", "#c0b39c", "#857766"], "gravel"),
  t(0x043, "Calçada", "Caminhos", ["#bfbfb4", "#d4d4c9", "#9a9a90"], "floor"),
  t(0x044, "Degraus", "Caminhos", ["#b2a184", "#cbbb9e", "#8d7c62"], "stairs"),
  t(0x045, "Barranco", "Caminhos", ["#8c7350", "#a68a63", "#6b563a"], "ledge"),
  t(0x080, "Parede madeira", "Construções", ["#b98d5c", "#cfa470", "#8f6a41"], "wall"),
  t(0x081, "Parede clara", "Construções", ["#ded3bc", "#f0e7d3", "#b8ab92"], "wall"),
  t(0x082, "Telhado vermelho", "Construções", ["#b0453c", "#c9584d", "#87322c"], "roof"),
  t(0x083, "Telhado azul", "Construções", ["#3d5f9c", "#4f76b8", "#2c4675"], "roof"),
  t(0x084, "Janela", "Construções", ["#8f6a41", "#7fc4d8", "#4b7f92"], "window"),
  t(0x085, "Porta", "Construções", ["#7a5433", "#5b3d24", "#c8a86a"], "door"),
  t(0x086, "Piso interno", "Construções", ["#c4a882", "#d6bd99", "#a58a67"], "floor"),
  t(0x0c0, "Água rasa", "Água", ["#4a86c4", "#67a2d8", "#356a9e"], "water"),
  t(0x0c1, "Água profunda", "Água", ["#2c5a90", "#3d74ae", "#1d3f68"], "deep"),
  t(0x0c2, "Borda d'água", "Água", ["#4a86c4", "#d8c08a", "#8fc6e0"], "waveTop"),
  t(0x0c3, "Areia molhada", "Água", ["#c5ab79", "#d8c08a", "#9d8355"], "sand"),
  t(0x100, "Placa", "Decoração", ["#5c9c4a", "#a97b44", "#e0cfa4"], "sign"),
  t(0x101, "Cerca", "Decoração", ["#5c9c4a", "#c8a86a", "#8a6c3d"], "fence"),
  t(0x102, "Toco", "Decoração", ["#5c9c4a", "#8f6a41", "#c39a63"], "stump"),
  t(0x103, "Caixa de correio", "Decoração", ["#5c9c4a", "#b0453c", "#e0e0d8"], "mailbox"),
  t(0x104, "Vaso", "Decoração", ["#c4a882", "#b0453c", "#4f9a45"], "flowers"),
];

export const METATILE_BY_ID = new Map<number, DemoMetatile>(
  DEMO_METATILES.map((tile) => [tile.id, tile]),
);

export const TILE_PX = 16;

function rnd(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1) {
  ctx.fillRect(x, y, w, h);
}

/** Desenha apenas o fallback DEMO de 16×16. */
export function drawMetatile(ctx: CanvasRenderingContext2D, tile: DemoMetatile) {
  const [a, b, c] = tile.colors;
  const S = TILE_PX;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, S, S);

  if (["noise", "gravel", "sand", "grass", "path"].includes(tile.pattern)) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const r = rnd(x, y, tile.id);
        if (r > 0.87) { ctx.fillStyle = b; pixel(ctx, x, y); }
        else if (r < 0.09) { ctx.fillStyle = c; pixel(ctx, x, y); }
      }
    }
  }

  switch (tile.pattern) {
    case "tallgrass":
      ctx.fillStyle = c;
      for (let x = 1; x < S; x += 3) { pixel(ctx, x, 7, 1, 7); pixel(ctx, x + 1, 9, 1, 5); }
      ctx.fillStyle = b;
      for (let x = 2; x < S; x += 4) pixel(ctx, x, 5, 1, 8);
      break;
    case "tree":
      ctx.fillStyle = c; ctx.fillRect(1, 1, 14, 13);
      ctx.fillStyle = b; ctx.fillRect(3, 2, 10, 9); ctx.fillRect(2, 5, 12, 5);
      ctx.fillStyle = "#76543a"; ctx.fillRect(7, 12, 3, 4);
      break;
    case "flowers":
      for (let i = 0; i < 7; i++) {
        const x = 2 + Math.floor(rnd(i, 2, tile.id) * 12);
        const y = 2 + Math.floor(rnd(i, 7, tile.id) * 12);
        ctx.fillStyle = i % 2 ? b : c; pixel(ctx, x, y, 2, 2);
      }
      break;
    case "pathEdge":
      ctx.fillStyle = c; ctx.fillRect(0, 0, S, 3);
      ctx.fillStyle = b; for (let x = 0; x < S; x += 2) pixel(ctx, x, 3);
      break;
    case "stairs":
      for (let y = 0; y < S; y += 4) { ctx.fillStyle = b; ctx.fillRect(0, y, S, 2); ctx.fillStyle = c; ctx.fillRect(0, y + 2, S, 1); }
      break;
    case "ledge":
      ctx.fillStyle = c; ctx.fillRect(0, 0, S, 5); ctx.fillStyle = b; for (let x = 0; x < S; x += 4) ctx.fillRect(x, 5, 2, 3);
      break;
    case "wall":
      ctx.fillStyle = c; for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 1);
      ctx.fillStyle = b; for (let y = 1; y < S; y += 4) for (let x = 3; x < S; x += 7) ctx.fillRect(x, y, 1, 3);
      break;
    case "roof":
      ctx.fillStyle = c; for (let y = 2; y < S; y += 4) ctx.fillRect(0, y, S, 1);
      ctx.fillStyle = b; for (let y = 0; y < S; y += 4) for (let x = 2; x < S; x += 7) ctx.fillRect(x, y, 4, 2);
      break;
    case "window":
      ctx.fillStyle = c; ctx.fillRect(2, 3, 12, 10); ctx.fillStyle = b; ctx.fillRect(3, 4, 10, 8); ctx.fillStyle = c; ctx.fillRect(7, 4, 1, 8); ctx.fillRect(3, 8, 10, 1);
      break;
    case "door":
      ctx.fillStyle = b; ctx.fillRect(2, 1, 12, 15); ctx.fillStyle = c; ctx.fillRect(4, 3, 8, 13); pixel(ctx, 10, 9, 2, 2);
      break;
    case "floor":
      ctx.fillStyle = c; ctx.fillRect(0, 0, S, 1); ctx.fillRect(0, 8, S, 1); ctx.fillRect(8, 0, 1, S);
      break;
    case "water":
    case "deep":
      ctx.fillStyle = b; ctx.fillRect(2, 5, 5, 1); ctx.fillRect(9, 11, 5, 1); ctx.fillStyle = c; ctx.fillRect(0, 2, 4, 1); ctx.fillRect(6, 8, 6, 1);
      break;
    case "waveTop":
      ctx.fillStyle = c; ctx.fillRect(0, 0, S, 4); ctx.fillStyle = b; for (let x = 0; x < S; x += 4) ctx.fillRect(x, 4, 2, 1);
      break;
    case "sign":
      ctx.fillStyle = c; ctx.fillRect(2, 2, 12, 8); ctx.fillStyle = b; ctx.fillRect(3, 3, 10, 6); ctx.fillRect(7, 10, 2, 5);
      break;
    case "fence":
      ctx.fillStyle = c; ctx.fillRect(0, 6, S, 2); ctx.fillRect(0, 11, S, 2); ctx.fillStyle = b; ctx.fillRect(3, 3, 2, 12); ctx.fillRect(11, 3, 2, 12);
      break;
    case "stump":
      ctx.fillStyle = c; ctx.fillRect(3, 5, 10, 9); ctx.fillStyle = b; ctx.fillRect(4, 4, 8, 5);
      break;
    case "mailbox":
      ctx.fillStyle = c; ctx.fillRect(7, 8, 2, 7); ctx.fillStyle = b; ctx.fillRect(4, 3, 8, 6);
      break;
    case "rock":
      ctx.fillStyle = b; ctx.fillRect(3, 5, 10, 8); ctx.fillStyle = c; ctx.fillRect(4, 4, 4, 2); ctx.fillRect(3, 11, 10, 2);
      break;
  }

  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0, S - 1, S, 1);
  ctx.fillRect(S - 1, 0, 1, S);
}

let demoCache: HTMLCanvasElement | null = null;
const demoIndex = new Map<number, number>();

function getDemoCanvas(): HTMLCanvasElement {
  if (demoCache) return demoCache;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX * DEMO_METATILES.length;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  DEMO_METATILES.forEach((tile, index) => {
    demoIndex.set(tile.id, index);
    ctx.save();
    ctx.translate(index * TILE_PX, 0);
    drawMetatile(ctx, tile);
    ctx.restore();
  });
  demoCache = canvas;
  return canvas;
}

/**
 * Atlas ativo do editor. Se o Tileset Lab já salvou General + Petalburg reais,
 * devolve uma versão em linha desse atlas; caso contrário usa o fallback DEMO.
 */
export function getAtlasCanvas(): HTMLCanvasElement {
  const real = realAtlasStore.ensureHydrated();
  if (real) {
    const canvas = realAtlasStore.getSingleRowCanvas(real);
    if (canvas) return canvas;
  }
  return getDemoCanvas();
}

export function getAtlasSlot(id: number): number | undefined {
  const real = realAtlasStore.ensureHydrated();
  if (real) return realAtlasStore.recordFor(id, real)?.slot;
  if (!demoCache) getDemoCanvas();
  return demoIndex.get(id);
}

export function hasRealAtlas(): boolean {
  return Boolean(realAtlasStore.ensureHydrated());
}
