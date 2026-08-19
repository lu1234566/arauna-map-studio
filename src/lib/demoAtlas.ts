/**
 * Atlas de DEMONSTRAÇÃO.
 *
 * Nenhum asset oficial de Pokémon é usado aqui: todos os metatiles são
 * desenhados proceduralmente em 16x16 px com paletas próprias, apenas para
 * permitir testar o editor. O atlas real virá dos arquivos gerados do repo
 * "Pokémon Juramento de Arauna".
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
  // Natureza 0x000+
  t(0x000, "Grama clara", "Natureza", ["#5c9c4a", "#6fb45a", "#4a8039"], "grass"),
  t(0x001, "Grama escura", "Natureza", ["#3f7a37", "#4c8f41", "#2f5f2a"], "grass"),
  t(0x002, "Grama alta", "Natureza", ["#357033", "#4f9a45", "#25502a"], "tallgrass"),
  t(0x003, "Árvore", "Natureza", ["#2b5a2c", "#3f8038", "#1c3a20"], "tree"),
  t(0x004, "Arbusto", "Natureza", ["#33693a", "#478a44", "#22482a"], "noise"),
  t(0x005, "Flores", "Natureza", ["#5c9c4a", "#e8d45a", "#d1584f"], "flowers"),
  t(0x006, "Terra batida", "Natureza", ["#9c7a4c", "#b08e5c", "#7d5f38"], "noise"),
  t(0x007, "Rocha", "Natureza", ["#7b7b74", "#9a9a90", "#5a5a55"], "rock"),

  // Caminhos 0x040+
  t(0x040, "Caminho areia", "Caminhos", ["#d8c08a", "#e6d3a3", "#bda06c"], "path"),
  t(0x041, "Borda caminho", "Caminhos", ["#c9ad76", "#d8c08a", "#a98a58"], "pathEdge"),
  t(0x042, "Cascalho", "Caminhos", ["#a99a86", "#c0b39c", "#857766"], "gravel"),
  t(0x043, "Calçada", "Caminhos", ["#bfbfb4", "#d4d4c9", "#9a9a90"], "floor"),
  t(0x044, "Degraus", "Caminhos", ["#b2a184", "#cbbb9e", "#8d7c62"], "stairs"),
  t(0x045, "Barranco", "Caminhos", ["#8c7350", "#a68a63", "#6b563a"], "ledge"),

  // Construções 0x080+
  t(0x080, "Parede madeira", "Construções", ["#b98d5c", "#cfa470", "#8f6a41"], "wall"),
  t(0x081, "Parede clara", "Construções", ["#ded3bc", "#f0e7d3", "#b8ab92"], "wall"),
  t(0x082, "Telhado vermelho", "Construções", ["#b0453c", "#c9584d", "#87322c"], "roof"),
  t(0x083, "Telhado azul", "Construções", ["#3d5f9c", "#4f76b8", "#2c4675"], "roof"),
  t(0x084, "Janela", "Construções", ["#8f6a41", "#7fc4d8", "#4b7f92"], "window"),
  t(0x085, "Porta", "Construções", ["#7a5433", "#5b3d24", "#c8a86a"], "door"),
  t(0x086, "Piso interno", "Construções", ["#c4a882", "#d6bd99", "#a58a67"], "floor"),

  // Água 0x0C0+
  t(0x0c0, "Água rasa", "Água", ["#4a86c4", "#67a2d8", "#356a9e"], "water"),
  t(0x0c1, "Água profunda", "Água", ["#2c5a90", "#3d74ae", "#1d3f68"], "deep"),
  t(0x0c2, "Borda d'água", "Água", ["#4a86c4", "#d8c08a", "#8fc6e0"], "waveTop"),
  t(0x0c3, "Areia molhada", "Água", ["#c5ab79", "#d8c08a", "#9d8355"], "sand"),

  // Decoração 0x100+
  t(0x100, "Placa", "Decoração", ["#5c9c4a", "#a97b44", "#e0cfa4"], "sign"),
  t(0x101, "Cerca", "Decoração", ["#5c9c4a", "#c8a86a", "#8a6c3d"], "fence"),
  t(0x102, "Toco", "Decoração", ["#5c9c4a", "#8f6a41", "#c39a63"], "stump"),
  t(0x103, "Caixa de correio", "Decoração", ["#5c9c4a", "#b0453c", "#e0e0d8"], "mailbox"),
  t(0x104, "Vaso", "Decoração", ["#c4a882", "#b0453c", "#4f9a45"], "flowers"),
];

export const METATILE_BY_ID = new Map<number, DemoMetatile>(
  DEMO_METATILES.map((m) => [m.id, m]),
);

export const TILE_PX = 16;

/** Ruído determinístico por (x,y,seed) — mantém o desenho estável entre renders. */
function rnd(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1) {
  ctx.fillRect(x, y, w, h);
}

/** Desenha um metatile demo 16x16 no contexto, na origem (0,0). */
export function drawMetatile(ctx: CanvasRenderingContext2D, tile: DemoMetatile) {
  const [a, b, c] = tile.colors;
  const S = TILE_PX;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, S, S);

  switch (tile.pattern) {
    case "flat":
      break;
    case "noise":
    case "gravel":
    case "sand":
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const r = rnd(x, y, tile.id);
          if (r > 0.82) {
            ctx.fillStyle = b;
            px(ctx, x, y);
          } else if (r < 0.16) {
            ctx.fillStyle = c;
            px(ctx, x, y);
          }
        }
      break;
    case "grass":
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const r = rnd(x, y, tile.id);
          if (r > 0.88) {
            ctx.fillStyle = b;
            px(ctx, x, y, 1, 2);
          } else if (r < 0.08) {
            ctx.fillStyle = c;
            px(ctx, x, y);
          }
        }
      break;
    case "tallgrass":
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rnd(i, 3, tile.id) * (S - 2)) + 1;
        const y = Math.floor(rnd(i, 9, tile.id) * (S - 7)) + 5;
        ctx.fillStyle = c;
        px(ctx, x, y, 1, 5);
        ctx.fillStyle = b;
        px(ctx, x - 1, y + 1, 1, 3);
        px(ctx, x + 1, y + 2, 1, 3);
      }
      break;
    case "tree":
      ctx.fillStyle = c;
      ctx.fillRect(1, 1, S - 2, S - 2);
      ctx.fillStyle = b;
      for (let y = 2; y < S - 2; y++)
        for (let x = 2; x < S - 2; x++) if (rnd(x, y, tile.id) > 0.45) px(ctx, x, y);
      ctx.fillStyle = c;
      ctx.fillRect(6, S - 4, 4, 3);
      break;
    case "flowers":
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) if (rnd(x, y, tile.id) > 0.9) {
          ctx.fillStyle = c;
          px(ctx, x, y);
        }
      for (let i = 0; i < 5; i++) {
        const x = 2 + Math.floor(rnd(i, 1, tile.id) * (S - 5));
        const y = 2 + Math.floor(rnd(i, 2, tile.id) * (S - 5));
        ctx.fillStyle = b;
        px(ctx, x, y, 2, 2);
        px(ctx, x - 1, y + 1);
        px(ctx, x + 2, y + 1);
      }
      break;
    case "path":
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const r = rnd(x, y, tile.id);
          if (r > 0.9) {
            ctx.fillStyle = b;
            px(ctx, x, y);
          } else if (r < 0.1) {
            ctx.fillStyle = c;
            px(ctx, x, y);
          }
        }
      break;
    case "pathEdge":
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, S, 3);
      ctx.fillStyle = b;
      for (let x = 0; x < S; x += 2) px(ctx, x, 3);
      break;
    case "stairs":
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? b : c;
        ctx.fillRect(0, i * 4, S, 3);
        ctx.fillStyle = c;
        ctx.fillRect(0, i * 4 + 3, S, 1);
      }
      break;
    case "ledge":
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, S, 5);
      ctx.fillStyle = b;
      for (let x = 0; x < S; x += 4) ctx.fillRect(x, 5, 2, 3);
      break;
    case "wall":
      ctx.fillStyle = c;
      for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 1);
      ctx.fillStyle = b;
      for (let y = 0; y < S; y += 4)
        for (let x = (y / 4) % 2 ? 0 : 4; x < S; x += 8) ctx.fillRect(x, y + 1, 1, 3);
      break;
    case "roof":
      ctx.fillStyle = c;
      for (let y = 2; y < S; y += 4) ctx.fillRect(0, y, S, 1);
      ctx.fillStyle = b;
      for (let y = 0; y < S; y += 4)
        for (let x = (y / 4) % 2 ? 2 : 6; x < S; x += 8) ctx.fillRect(x, y, 4, 2);
      break;
    case "window":
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = c;
      ctx.fillRect(2, 3, S - 4, S - 7);
      ctx.fillStyle = b;
      ctx.fillRect(3, 4, S - 6, S - 9);
      ctx.fillStyle = c;
      ctx.fillRect(S / 2 - 1, 3, 1, S - 7);
      ctx.fillRect(2, 8, S - 4, 1);
      break;
    case "door":
      ctx.fillStyle = b;
      ctx.fillRect(2, 1, S - 4, S - 1);
      ctx.fillStyle = a;
      ctx.fillRect(3, 2, S - 6, S - 2);
      ctx.fillStyle = c;
      ctx.fillRect(S - 6, 8, 2, 2);
      break;
    case "floor":
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, S, 1);
      ctx.fillRect(0, 8, S, 1);
      ctx.fillRect(0, 0, 1, S);
      ctx.fillRect(8, 8, 1, 8);
      ctx.fillStyle = b;
      ctx.fillRect(1, 1, S - 2, 1);
      break;
    case "water":
    case "deep":
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) if (rnd(x, y, tile.id) > 0.88) {
          ctx.fillStyle = b;
          px(ctx, x, y, 2, 1);
        }
      ctx.fillStyle = c;
      ctx.fillRect(2, 5, 5, 1);
      ctx.fillRect(9, 11, 5, 1);
      break;
    case "waveTop":
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, S, 4);
      ctx.fillStyle = b;
      for (let x = 0; x < S; x += 4) ctx.fillRect(x, 4, 2, 1);
      break;
    case "sign":
      ctx.fillStyle = c;
      ctx.fillRect(2, 2, S - 4, 8);
      ctx.fillStyle = b;
      ctx.fillRect(3, 3, S - 6, 6);
      ctx.fillRect(7, 10, 2, 5);
      break;
    case "fence":
      ctx.fillStyle = c;
      ctx.fillRect(0, 6, S, 2);
      ctx.fillRect(0, 11, S, 2);
      ctx.fillStyle = b;
      ctx.fillRect(3, 3, 2, 12);
      ctx.fillRect(11, 3, 2, 12);
      break;
    case "stump":
      ctx.fillStyle = c;
      ctx.fillRect(3, 5, 10, 9);
      ctx.fillStyle = b;
      ctx.fillRect(4, 4, 8, 5);
      break;
    case "mailbox":
      ctx.fillStyle = c;
      ctx.fillRect(7, 8, 2, 7);
      ctx.fillStyle = b;
      ctx.fillRect(4, 3, 8, 6);
      ctx.fillStyle = c;
      ctx.fillRect(5, 5, 3, 2);
      break;
    case "rock":
      ctx.fillStyle = b;
      ctx.fillRect(3, 5, 10, 8);
      ctx.fillStyle = c;
      ctx.fillRect(3, 11, 10, 2);
      ctx.fillRect(4, 4, 4, 2);
      break;
  }

  // leve vinheta para dar volume de tile GBA
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0, S - 1, S, 1);
  ctx.fillRect(S - 1, 0, 1, S);
}

let atlasCache: HTMLCanvasElement | null = null;
const atlasIndex = new Map<number, number>();

/** Canvas único com todos os metatiles demo em linha (16px cada). */
export function getAtlasCanvas(): HTMLCanvasElement {
  if (atlasCache) return atlasCache;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX * DEMO_METATILES.length;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  DEMO_METATILES.forEach((tile, i) => {
    atlasIndex.set(tile.id, i);
    ctx.save();
    ctx.translate(i * TILE_PX, 0);
    ctx.beginPath();
    ctx.rect(0, 0, TILE_PX, TILE_PX);
    ctx.clip();
    drawMetatile(ctx, tile);
    ctx.restore();
  });
  atlasCache = canvas;
  return canvas;
}

export function getAtlasSlot(id: number): number | undefined {
  if (!atlasCache) getAtlasCanvas();
  return atlasIndex.get(id);
}
