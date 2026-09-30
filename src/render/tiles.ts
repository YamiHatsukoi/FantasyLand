import { Rng, hashString } from "../core/rng";
import type { Biome } from "../world/biomes";
import { hs, makeCanvas, mix as mixC, outline, rgba, type Paint } from "./palette";

/**
 * Procedural terrain in a cozy farm-game style: 16px tiles shown chunky, lush hue-shifted
 * palettes, tufted grass, soft path edges, water with grassy banks and shimmer, cliffs
 * with a front face, and big layered trees (32x48 sprites that overhang their tile).
 */

export const T = {
  GROUND: 0,
  ALT: 1,
  DECOR: 2,
  OBSTACLE: 3,
  WATER: 4,
  SHALLOW: 5,
  WALL: 6,
} as const;

export const PASSABLE = new Set<number>([T.GROUND, T.ALT, T.DECOR, T.SHALLOW]);
export const VARIANTS = 4;
export const TS = 16;

/** Kept for callers that lighten/darken plainly. */
export const sh = (c: string, f: number) => hs(c, f);
export const mix = mixC;

// ------------------------------------------------------------ helpers
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

function noise2(seed: number, P = 4) {
  const rng = new Rng(seed);
  const grid = Array.from({ length: P * P }, () => rng.next());
  const at = (x: number, y: number) => grid[((y % P) + P) % P * P + ((x % P) + P) % P];
  return (x: number, y: number) => {
    const fx = (x / TS) * P, fy = (y / TS) * P;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Soft 3-tone base: mostly the base colour with gentle darker/lighter patches. */
function base(p: Paint, col: string, seed: number, amount = 1) {
  const n = noise2(seed);
  const lo = hs(col, -0.1 * amount), hi = hs(col, 0.08 * amount);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) + (bayer(x, y) - 0.5) * 0.25;
    p.px(x, y, v < 0.33 ? lo : v > 0.7 ? hi : col);
  }
}

// ------------------------------------------------------------ ground patterns (16x16)
type GroundFn = (p: Paint, c: string, r: Rng) => void;
const tuft = (p: Paint, x: number, y: number, c: string) => { p.px(x, y, c); p.px(x - 1, y - 1, c); p.px(x + 1, y - 1, c); p.px(x, y - 1, hs(c, 0.25)); };

export const GROUNDS: Record<string, GroundFn> = {
  grass: (p, c, r) => { for (let i = 0; i < 5; i++) tuft(p, r.int(1, 14), r.int(2, 15), hs(c, -0.22)); for (let i = 0; i < 4; i++) p.px(r.int(0, 15), r.int(0, 15), hs(c, 0.25)); },
  moss: (p, c, r) => { for (let i = 0; i < 5; i++) { const x = r.int(0, 14), y = r.int(0, 14); p.rect(x, y, 2, 2, hs(c, 0.18)); p.px(x + 1, y + 1, hs(c, -0.15)); } },
  sand: (p, c, r) => { for (let i = 0; i < 9; i++) p.px(r.int(0, 15), r.int(0, 15), i % 3 ? hs(c, -0.14) : hs(c, 0.25)); },
  dunes: (p, c, r) => { const o = r.int(0, 15); for (let x = 0; x < 16; x++) { p.px(x, (5 + Math.round(Math.sin((x + o) / 3) * 1.5) + 16) % 16, hs(c, -0.12)); p.px(x, (13 + Math.round(Math.sin((x + o) / 3) * 1.5) + 16) % 16, hs(c, -0.12)); } },
  rock: (p, c, r) => { for (let i = 0; i < 3; i++) { const x = r.int(1, 12), y = r.int(1, 13); p.rect(x, y, 3, 2, hs(c, 0.14)); p.rect(x, y + 2, 3, 1, hs(c, -0.2)); } },
  gravel: (p, c, r) => { for (let i = 0; i < 7; i++) { const x = r.int(0, 14), y = r.int(0, 14); p.px(x, y, hs(c, 0.25)); p.px(x + 1, y, hs(c, 0.1)); p.px(x, y + 1, hs(c, -0.25)); } },
  snow: (p, c, r) => { for (let i = 0; i < 4; i++) { const x = r.int(0, 12), y = r.int(0, 15); p.rect(x, y, 3, 1, hs(c, -0.08)); } for (let i = 0; i < 3; i++) p.px(r.int(0, 15), r.int(0, 15), "#ffffff"); },
  ice: (p, c, r) => { const x = r.int(0, 10), y = r.int(0, 10); p.line(x, y, x + 5, y + 5, hs(c, 0.35)); p.px(r.int(0, 15), r.int(0, 15), "#ffffff"); },
  ash: (p, c, r) => { for (let i = 0; i < 8; i++) p.px(r.int(0, 15), r.int(0, 15), i % 4 ? hs(c, -0.25) : "#ff8a3a"); },
  obsidian: (p, c, r) => { for (let i = 0; i < 2; i++) { const x = r.int(0, 12), y = r.int(0, 12); p.line(x, y, x + 3, y + 1, hs(c, 0.45)); } },
  mud: (p, c, r) => { for (let i = 0; i < 2; i++) { const x = r.int(1, 10), y = r.int(1, 13); p.rect(x, y, 4, 2, hs(c, -0.2)); p.rect(x + 1, y, 2, 1, hs(c, 0.2)); } },
  crystal: (p, c, r) => { for (let i = 0; i < 3; i++) { const x = r.int(1, 14), y = r.int(2, 14); p.px(x, y, hs(c, 0.55)); p.px(x, y + 1, hs(c, -0.2)); } },
  tiles: (p, c) => { for (let y = 0; y < 16; y += 8) { p.rect(0, y, 16, 1, hs(c, -0.28)); p.rect(y % 16 === 0 ? 7 : 3, y, 1, 8, hs(c, -0.28)); p.rect(0, y + 1, 16, 1, hs(c, 0.12)); } },
  bones: (p, c, r) => { const x = r.int(2, 9), y = r.int(3, 13); p.rect(x, y, 5, 1, "#e8e0d0"); p.px(x - 1, y - 1, "#e8e0d0"); p.px(x - 1, y + 1, "#e8e0d0"); p.px(x + 5, y - 1, "#e8e0d0"); p.px(x + 5, y + 1, "#e8e0d0"); },
  flesh: (p, c, r) => { let x = r.int(0, 15), y = 0; for (let k = 0; k < 16; k++) { p.px(x, y, hs(c, -0.3)); x += r.int(-1, 1); y++; } },
  cloud: (p, c, r) => { for (let i = 0; i < 2; i++) p.blob(r.int(3, 12), r.int(3, 12), 3, 2, hs(c, 0.1), { outline: false }); },
  metal: (p, c) => { p.rect(0, 7, 16, 1, hs(c, -0.3)); p.rect(7, 0, 1, 16, hs(c, -0.3)); for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) p.px(x, y, hs(c, 0.45)); },
  salt: (p, c, r) => { const x = r.int(0, 10), y = r.int(0, 10); p.line(x, y, x + 4, y, hs(c, -0.12)); p.line(x, y, x, y + 4, hs(c, -0.12)); },
  leaves: (p, c, r) => { const cols = ["#d0702a", "#e8a838", "#b0402a"]; for (let i = 0; i < 6; i++) { const x = r.int(0, 14), y = r.int(0, 14), col = r.pick(cols); p.px(x, y, col); p.px(x + 1, y, hs(col, -0.2)); } },
  petals: (p, c, r) => { for (let i = 0; i < 5; i++) { const x = r.int(0, 14), y = r.int(0, 14); p.px(x, y, "#ffd8e8"); p.px(x + 1, y, "#f090b8"); } },
  roots: (p, c, r) => { let x = r.int(2, 13), y = 0; for (let k = 0; k < 16; k++) { p.px(x, y, hs(c, -0.35)); y++; x += r.int(-1, 1); } },
  soil: (p, c) => { for (let y = 2; y < 16; y += 4) p.rect(0, y, 16, 1, hs(c, -0.18)); },
  lichen: (p, c, r) => { const cols = ["#d8d078", "#e8a868", "#a8d098"]; for (let i = 0; i < 3; i++) { const x = r.int(1, 13), y = r.int(1, 13), col = r.pick(cols); p.rect(x, y, 2, 2, col); } },
  void: (p, c, r) => { for (let i = 0; i < 3; i++) p.px(r.int(0, 15), r.int(0, 15), "#ffffff"); },
  circuit: (p, c, r) => { let x = r.int(0, 15), y = r.int(0, 15); const col = hs(c, 0.4); for (let k = 0; k < 8; k++) { p.px(x, y, col); r.chance(0.5) ? x++ : y++; } },
  paper: (p, c, r) => { for (let y = 2; y < 16; y += 3) p.rect(r.int(1, 4), y, r.int(4, 10), 1, hs(c, -0.3)); },
  amber: (p, c, r) => { for (let i = 0; i < 3; i++) p.px(r.int(1, 14), r.int(1, 14), "#ffe8a0"); },
  scales: (p, c) => { for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) { p.px(x, y, hs(c, -0.3)); p.px(x + 1, y + 1, hs(c, -0.3)); p.px(x + 2, y, hs(c, -0.3)); } },
  glass: (p, c, r) => { const x = r.int(0, 10), y = r.int(0, 12); p.line(x, y, x + 5, y - 3, hs(c, 0.5)); },
};

// ------------------------------------------------------------ decorations (16x16, on top of ground)
type DecorFn = (p: Paint, cols: string[], r: Rng, b: Biome) => void;
const flower = (p: Paint, x: number, y: number, c: string) => {
  p.px(x, y + 2, "#3f7a2a"); p.px(x, y + 1, "#4f9a35");
  p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, hs(c, 0.25)); p.px(x, y + 1, hs(c, -0.2)); p.px(x, y, "#fff3a0");
};
export const DECORS: Record<string, DecorFn> = {
  flowers: (p, cols, r) => { for (let i = 0; i < 3; i++) flower(p, r.int(2, 13), r.int(2, 12), r.pick(cols)); },
  grass: (p, cols, r) => { for (let k = 0; k < 2; k++) { const x = r.int(3, 12), y = r.int(9, 15), c = r.pick(cols); for (let i = -2; i <= 2; i++) for (let j = 0; j < 5 - Math.abs(i) * 1.5; j++) p.px(x + i + (j > 2 ? Math.sign(i) : 0), y - j, j > 2 ? hs(c, 0.2) : c); } },
  pebbles: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, 12), y = r.int(3, 13), c = r.pick(cols); p.rect(x, y, 2, 2, c); p.px(x, y, hs(c, 0.3)); p.rect(x, y + 2, 2, 1, outline(c)); } },
  bones: (p, cols, r) => { const x = r.int(3, 9), y = r.int(5, 11); p.rect(x, y, 5, 1, cols[0]); p.rect(x - 1, y - 1, 1, 3, cols[0]); p.rect(x + 5, y - 1, 1, 3, cols[0]); },
  reeds: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, 13), y = r.int(9, 15), c = r.pick(cols); p.rect(x, y - 7, 1, 8, c); p.rect(x, y - 9, 1, 2, "#7a4a2a"); } },
  snow: (p, cols, r) => { const x = r.int(3, 11), y = r.int(4, 12); p.blob(x, y, 3, 2, cols[0], { outline: false }); },
  embers: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, 13), y = r.int(2, 13); p.px(x, y, r.pick(cols)); p.px(x, y + 1, "#5a1a0a"); } },
  sparkles: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(2, 13), y = r.int(2, 13), c = r.pick(cols); p.px(x, y, "#ffffff"); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); } },
  leaves: (p, cols, r) => { for (let i = 0; i < 5; i++) { const x = r.int(1, 13), y = r.int(1, 13), c = r.pick(cols); p.rect(x, y, 2, 1, c); p.px(x + 1, y + 1, hs(c, -0.3)); } },
  shells: (p, cols, r) => { const x = r.int(3, 11), y = r.int(4, 11), c = r.pick(cols); p.blob(x, y, 2, 1.5, c); },
  glow: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(3, 12), y = r.int(3, 12), c = r.pick(cols); p.g.fillStyle = rgba(c, 0.3); p.g.fillRect(x - 1, y - 1, 3, 3); p.px(x, y, "#ffffff"); } },
  mushrooms: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(3, 12), y = r.int(6, 13), c = r.pick(cols); p.rect(x, y - 1, 1, 2, "#f0e4c8"); p.rect(x - 1, y - 3, 3, 2, c); p.px(x - 1, y - 3, hs(c, 0.35)); p.px(x + 1, y - 2, outline(c)); } },
  ferns: (p, cols, r) => { const x = r.int(4, 11), y = r.int(9, 14), c = r.pick(cols); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5; p.line(x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 5, k % 2 ? c : hs(c, -0.2)); } },
  crystals: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(3, 12), y = r.int(6, 14), c = r.pick(cols); p.rect(x, y - 4, 2, 4, c); p.px(x, y - 4, hs(c, 0.5)); p.px(x + 1, y - 1, outline(c)); } },
  runes: (p, cols, r) => { const c = r.pick(cols), x = r.int(3, 9), y = r.int(3, 9); p.line(x, y, x + 3, y + 3, c); p.line(x + 3, y, x, y + 3, c); },
  feathers: (p, cols, r) => { const x = r.int(2, 10), y = r.int(2, 12), c = r.pick(cols); p.line(x, y, x + 3, y + 2, c); },
  skulls: (p, cols, r) => { const x = r.int(4, 10), y = r.int(5, 11); p.blob(x, y, 2.5, 2, cols[0]); p.px(x - 1, y, "#2a1a2a"); p.px(x + 1, y, "#2a1a2a"); },
  puddles: (p, cols, r, b) => { const x = r.int(4, 11), y = r.int(4, 11); p.blob(x, y, 3.5, 1.8, b.water[0], { outline: false, hi: 0.4 }); },
  cracks: (p, cols, r) => { let x = r.int(3, 12), y = r.int(3, 12); for (let k = 0; k < 6; k++) { p.px(x, y, r.pick(cols)); x += r.int(-1, 1); y += r.int(-1, 1); } },
  bubbles: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(2, 13), y = r.int(2, 13), c = r.pick(cols); p.px(x, y - 1, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y + 1, c); } },
  candles: (p, cols, r) => { const x = r.int(4, 11), y = r.int(8, 14); p.rect(x, y - 3, 2, 4, "#f0e4c8"); p.px(x, y - 4, "#ffc83a"); },
  vines: (p, cols, r) => { let x = r.int(0, 15); for (let y = 0; y < 16; y++) { p.px(x, y, cols[0]); if (y % 3 === 0) p.px(x + 1, y, r.pick(cols)); x = (x + r.int(-1, 1) + 16) % 16; } },
  eyes: (p, cols, r) => { const x = r.int(3, 11), y = r.int(3, 11); p.rect(x - 1, y, 3, 2, "#f0ece0"); p.px(x, y, r.pick(cols)); },
  coins: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(2, 13), y = r.int(2, 13); p.px(x, y, "#f2c542"); p.px(x + 1, y, "#fff4b0"); } },
  seaweed: (p, cols, r) => { const x = r.int(3, 12), y = r.int(10, 15), c = r.pick(cols); for (let k = 0; k < 7; k++) p.px(x + Math.round(Math.sin(k / 2)), y - k, c); },
  gears: (p, cols, r) => { const x = r.int(4, 11), y = r.int(4, 11), c = r.pick(cols); p.blob(x, y, 2.5, 2.5, c); p.px(x, y, outline(c)); },
  glyphs: (p, cols, r) => { const c = r.pick(cols), x = r.int(3, 11), y = r.int(3, 11); p.line(x, y, x + 3, y, c); p.line(x + 1, y, x + 1, y + 3, c); },
  lanterns: (p, cols, r) => { const x = r.int(5, 10), y = r.int(6, 11), c = r.pick(cols); p.rect(x, y, 3, 4, c); p.rect(x + 1, y + 1, 1, 2, "#fff3a0"); },
};

// ------------------------------------------------------------ tall obstacles (32x48, base at y=46)
type Obs = [string, string, string, string];
type ObsFn = (p: Paint, o: Obs, r: Rng) => void;
const OW = 32, OH = 48;
const bark = (o: Obs) => mixC(o[0], "#6a4428", 0.72);

/** Stardew-like tree crown: a mass of leaf clumps, darker at the back, lit on top. */
function crown(p: Paint, r: Rng, cx: number, cy: number, rx: number, ry: number, col: string) {
  p.blob(cx, cy + 1, rx, ry, hs(col, -0.18));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.next() * 0.5;
    const d = 0.45 + r.next() * 0.25;
    p.blob(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * 0.45, ry * 0.45, i < 3 ? hs(col, -0.08) : col);
  }
  p.blob(cx - rx * 0.15, cy - ry * 0.25, rx * 0.55, ry * 0.5, col, { hi: 0.38 });
  for (let i = 0; i < 10; i++) {
    const x = cx + r.int(-rx + 2, rx - 2), y = cy + r.int(-ry + 2, ry - 2);
    p.px(x, y, hs(col, -0.3));
    p.px(x + 1, y - 1, hs(col, 0.3));
  }
}
function trunk(p: Paint, x: number, top: number, w: number, col: string) {
  p.column(x, top, w, 46 - top, col);
  p.rect(x - 1, 44, w + 2, 2, hs(col, -0.2));
  p.px(x - 2, 45, outline(col)); p.px(x + w + 1, 45, outline(col));
  for (let y = top + 3; y < 44; y += 4) p.px(x + 2, y, hs(col, -0.3));
}
const shadow = (p: Paint, w = 11) => { p.g.fillStyle = "rgba(20,10,40,.28)"; p.g.beginPath(); p.g.ellipse(16, 46, w, 2.6, 0, 0, Math.PI * 2); p.g.fill(); };

export const OBSTACLES: Record<string, ObsFn> = {
  tree: (p, o, r) => { shadow(p, 12); trunk(p, 13, 26, 6, bark(o)); crown(p, r, 16, 15, 14, 12, o[1]); },
  autumn_tree: (p, o, r) => { shadow(p, 12); trunk(p, 13, 26, 6, bark(o)); crown(p, r, 16, 15, 14, 12, r.pick(["#d8602a", "#e89a30", "#c8402a"])); },
  sakura: (p, o, r) => { shadow(p, 12); trunk(p, 14, 24, 5, "#7a4a3a"); p.line(16, 26, 8, 16, "#7a4a3a", 2); p.line(17, 24, 25, 15, "#7a4a3a", 2); crown(p, r, 16, 14, 14, 11, "#f4a8c8"); for (let i = 0; i < 6; i++) p.px(r.int(4, 28), r.int(4, 24), "#ffffff"); },
  birch: (p, o, r) => { shadow(p, 9); p.column(14, 14, 5, 32, "#e8e4dc"); for (let y = 18; y < 44; y += 5) p.rect(15, y, 2, 1, "#3a3440"); crown(p, r, 16, 12, 11, 10, o[1]); },
  willow: (p, o, r) => { shadow(p, 13); trunk(p, 13, 22, 6, bark(o)); crown(p, r, 16, 12, 14, 9, o[1]); for (let x = 3; x < 30; x += 2) { const l = r.int(8, 18); for (let y = 16; y < 16 + l; y++) p.px(x + (y % 5 === 0 ? 1 : 0), y, y % 3 ? o[1] : hs(o[1], -0.2)); } },
  pine: (p, o, r) => { shadow(p, 9); trunk(p, 14, 36, 4, bark(o)); for (let k = 0; k < 4; k++) { const top = 4 + k * 8, bot = 18 + k * 7, hw = 5 + k * 3; for (let y = top; y <= bot; y++) { const w = Math.round(((y - top) / (bot - top)) * hw); for (let x = 16 - w; x <= 16 + w; x++) p.px(x, y, x === 16 - w || x === 16 + w || y === bot ? outline(o[1]) : x < 16 - w / 3 ? hs(o[1], 0.22) : x > 16 + w / 2 ? hs(o[1], -0.25) : o[1]); } } },
  palm: (p, o, r) => { shadow(p, 8); for (let i = 0; i < 30; i++) p.rect(15 + Math.round(Math.sin(i / 9) * 2), 14 + i, 3, 1, i % 4 ? bark(o) : hs(bark(o), -0.3)); for (let k = 0; k < 6; k++) { const a = Math.PI + (k / 5) * Math.PI; for (let t = 0; t < 13; t++) { const x = 16 + Math.cos(a) * t, y = 14 + Math.sin(a) * t * 0.6 + t * t * 0.05; p.px(x, y, o[1]); p.px(x, y + 1, hs(o[1], -0.3)); } } p.blob(16, 15, 2.5, 2, "#8a5a2a"); },
  baobab: (p, o, r) => { shadow(p, 12); p.column(10, 16, 12, 30, bark(o)); for (const [x, y] of [[8, 12], [16, 8], [24, 12]]) crown(p, r, x, y, 7, 5, o[1]); },
  mangrove: (p, o, r) => { shadow(p, 12); for (const x of [7, 12, 20, 25]) p.line(16, 32, x, 46, bark(o), 2); trunk(p, 14, 24, 4, bark(o)); crown(p, r, 16, 15, 14, 10, o[1]); },
  jungle_tree: (p, o, r) => { shadow(p, 13); trunk(p, 12, 14, 7, bark(o)); for (let y = 16; y < 42; y += 5) p.px(12 + (y % 4), y, "#4a8a3a"); crown(p, r, 16, 10, 15, 9, o[1]); p.line(5, 14, 4, 34, "#3f8f3a"); p.line(27, 12, 28, 30, "#3f8f3a"); },
  dead_tree: (p, o) => { shadow(p, 8); const c = bark(o); trunk(p, 14, 12, 5, c); p.line(15, 20, 5, 9, c, 2); p.line(17, 24, 27, 12, c, 2); p.line(8, 12, 7, 5, c); p.line(25, 14, 28, 7, c); p.line(16, 12, 16, 3, c, 2); },
  bush: (p, o, r) => { shadow(p, 12); crown(p, r, 16, 36, 13, 9, o[1]); for (let i = 0; i < 4; i++) { const x = r.int(7, 25), y = r.int(30, 40); p.px(x, y, o[3]); p.px(x + 1, y, hs(o[3], 0.3)); } },
  fern: (p, o) => { shadow(p, 9); for (let k = 0; k < 9; k++) { const a = Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5); for (let t = 0; t < 15; t++) { const x = 16 + Math.cos(a) * t, y = 46 + Math.sin(a) * t * 1.6; p.px(x, y, t % 3 ? o[1] : hs(o[1], 0.25)); p.px(x, y + 1, hs(o[1], -0.25)); } } },
  thorn: (p, o, r) => { shadow(p, 10); for (let k = 0; k < 7; k++) { const x = r.int(4, 28), y = r.int(12, 30); p.line(16, 46, x, y, hs(o[1], -0.15), 2); p.px(x, y, hs(o[1], 0.3)); p.px(x + 1, y + 3, o[3]); } },
  cactus: (p, o) => { shadow(p, 8); p.column(12, 10, 8, 36, o[1]); p.column(4, 16, 6, 10, o[1]); p.rect(6, 24, 6, 4, o[1]); p.column(22, 20, 6, 10, o[1]); p.rect(20, 28, 4, 4, o[1]); for (let y = 12; y < 44; y += 3) { p.px(14, y, hs(o[1], 0.4)); p.px(18, y + 1, hs(o[1], -0.35)); } p.blob(16, 10, 3, 2, "#f070a0"); },
  giant_flower: (p, o) => { shadow(p, 8); p.column(15, 18, 3, 28, "#4f9a35"); p.blob(10, 36, 5, 2, "#4f9a35"); p.blob(22, 30, 5, 2, "#4f9a35"); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.blob(16 + Math.cos(a) * 6, 13 + Math.sin(a) * 5, 4.5, 4, o[1]); } p.blob(16, 13, 3.5, 3.5, o[3]); },
  rock: (p, o, r) => { shadow(p, 12); p.blob(16, 38, 13, 8, o[1], { hi: 0.25 }); p.blob(10, 40, 6, 5, hs(o[1], -0.05)); p.line(13, 35, 17, 39, hs(o[1], -0.35)); p.px(12, 33, hs(o[1], 0.45)); if (r.chance(0.5)) p.rect(20, 32, 3, 1, "#6fae4a"); },
  lava_rock: (p, o, r) => { shadow(p, 12); p.blob(16, 38, 13, 8, o[1]); for (let i = 0; i < 3; i++) { let x = r.int(9, 23), y = 32; for (let k = 0; k < 7; k++) { p.px(x, y, o[3]); x += r.int(-1, 1); y++; } } },
  sand_dune: (p, o) => { p.blob(16, 42, 15, 5, o[1], { outline: false, hi: 0.3 }); p.line(5, 40, 26, 38, hs(o[1], 0.35)); },
  stalagmite: (p, o) => { shadow(p, 10); for (const [x, top, hw] of [[16, 8, 6], [8, 26, 4], [25, 22, 4]] as const) for (let y = top; y < 46; y++) { const w = Math.round(((y - top) / (46 - top)) * hw); for (let xx = x - w; xx <= x + w; xx++) p.px(xx, y, xx === x - w || xx === x + w ? outline(o[1]) : xx < x ? hs(o[1], 0.15) : o[1]); } },
  crystal: (p, o) => { shadow(p, 10); p.g.fillStyle = rgba(o[3], 0.2); p.g.beginPath(); p.g.arc(16, 30, 13, 0, Math.PI * 2); p.g.fill(); for (const [x, top, hw] of [[9, 24, 3], [16, 8, 5], [24, 20, 3]] as const) for (let y = top; y < 46; y++) { const w = y < top + hw ? y - top : hw; for (let xx = x - w; xx <= x + w; xx++) p.px(xx, y, xx === x - w || xx === x + w ? outline(o[1]) : xx < x ? hs(o[1], 0.45) : xx === x ? hs(o[1], 0.2) : o[1]); } },
  ice_spike: (p, o) => OBSTACLES.crystal(p, [o[0], "#a8d8f8", o[2], "#ffffff"], new Rng(1)),
  iceberg: (p, o) => { p.blob(16, 36, 14, 10, "#c8e8f8", { hi: 0.4 }); p.blob(14, 26, 8, 9, "#d8f0ff"); p.rect(3, 42, 26, 2, "#ffffff"); },
  giant_mushroom: (p, o, r) => { shadow(p, 10); p.column(13, 24, 7, 22, "#efe2c8"); p.blob(16, 18, 15, 10, o[1]); for (let i = 0; i < 6; i++) p.blob(r.int(6, 26), r.int(11, 20), 1.8, 1.4, "#fff8f0", { outline: false }); p.rect(3, 25, 26, 2, hs(o[1], -0.45)); },
  spore_stalk: (p, o, r) => { shadow(p, 10); for (const x of [9, 16, 23]) { const top = r.int(8, 20); p.column(x - 1, top, 3, 46 - top, o[1]); p.blob(x, top, 3, 3, o[3]); } },
  coral: (p, o, r) => { shadow(p, 10); for (const [x, top] of [[8, 18], [16, 8], [24, 14]] as const) { p.column(x - 2, top, 4, 46 - top, o[1]); p.line(x, top + 10, x + 5, top + 5, o[1], 2); p.line(x, top + 14, x - 5, top + 9, o[1], 2); p.blob(x, top, 2.5, 2.5, hs(o[1], 0.2)); } },
  coral_tree: (p, o) => { shadow(p, 10); p.column(14, 28, 4, 18, o[1]); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; p.line(16, 30, 16 + Math.cos(a) * 13, 30 + Math.sin(a) * 18, o[1], 2); p.blob(16 + Math.cos(a) * 13, 30 + Math.sin(a) * 18, 2.2, 2.2, hs(o[1], 0.25)); } },
  kelp: (p, o) => { for (const x0 of [9, 16, 23]) for (let y = 6; y < 46; y++) p.rect(x0 + Math.round(Math.sin(y / 4 + x0) * 2), y, 3, 1, y % 5 ? o[1] : hs(o[1], 0.3)); },
  shell_spire: (p, o) => { shadow(p, 9); for (let k = 0; k < 7; k++) p.blob(16, 42 - k * 5, 10 - k * 1.2, 4, o[1]); },
  bamboo: (p, o, r) => { for (const x of [7, 15, 23]) { p.column(x, 2 + r.int(0, 6), 4, 44, o[1]); for (let y = 8; y < 46; y += 7) p.rect(x, y, 4, 1, hs(o[1], -0.4)); p.line(x + 4, r.int(8, 22), x + 9, r.int(4, 18), hs(o[1], 0.2)); } },
  pillar: (p, o) => { shadow(p, 9); p.column(10, 8, 12, 38, o[1]); p.rect(7, 4, 18, 4, hs(o[1], 0.2)); p.rect(7, 4, 18, 1, outline(o[1])); p.rect(7, 42, 18, 4, hs(o[1], -0.2)); for (let x = 13; x < 21; x += 3) p.rect(x, 10, 1, 30, hs(o[1], -0.12)); },
  broken_pillar: (p, o) => { shadow(p, 9); p.column(10, 24, 12, 22, o[1]); for (let x = 10; x < 22; x++) p.rect(x, 22 + ((x * 7) % 4), 1, 3, hs(o[1], 0.15)); p.blob(26, 43, 4, 3, o[1]); },
  obelisk: (p, o) => { shadow(p, 8); p.column(12, 8, 9, 38, o[1]); for (let y = 2; y < 8; y++) p.rect(16 - (y - 2) * 0.7, y, (y - 2) * 1.4 + 1, 1, hs(o[1], 0.2)); for (let y = 12; y < 40; y += 6) p.rect(15, y, 3, 2, o[3]); },
  statue: (p, o) => { shadow(p, 10); p.rect(8, 38, 16, 8, hs(o[1], -0.1)); p.rect(8, 38, 16, 1, hs(o[1], 0.3)); p.column(12, 20, 8, 18, o[1]); p.blob(16, 16, 4, 4, o[1]); p.line(20, 22, 26, 12, o[1], 2); },
  tombstone: (p, o) => { shadow(p, 9); p.column(9, 22, 14, 24, o[1]); p.blob(16, 22, 7, 5, o[1]); p.rect(15, 25, 2, 9, hs(o[1], -0.35)); p.rect(12, 28, 8, 2, hs(o[1], -0.35)); p.rect(10, 43, 12, 3, "#5a9a3a"); },
  bone_spire: (p, o) => { shadow(p, 8); for (let k = 0; k < 8; k++) p.blob(16, 42 - k * 5, 5 - k * 0.3, 3, "#e0d4bc"); p.blob(16, 5, 4, 3, "#e8dcc4"); p.px(14, 5, "#2a1a2a"); p.px(18, 5, "#2a1a2a"); },
  ribcage: (p, o) => { p.line(4, 44, 28, 44, "#d8ccb4", 2); for (let x = 6; x < 28; x += 5) { p.line(x, 44, x + 2, 22, "#e8dcc4", 2); p.px(x + 3, 22, "#8a7a6a"); } },
  vent: (p, o) => { p.blob(16, 42, 12, 5, o[1]); p.blob(16, 41, 5, 2, "#2a1a1a", { outline: false }); p.g.fillStyle = rgba(o[3], 0.35); for (let k = 0; k < 4; k++) { p.g.beginPath(); p.g.arc(16 + k, 32 - k * 7, 3 + k, 0, Math.PI * 2); p.g.fill(); } },
  mound: (p, o) => { shadow(p, 12); for (let y = 10; y < 46; y++) { const w = Math.round(((y - 10) / 36) * 12); p.rect(16 - w, y, w * 2, 1, y % 5 ? o[1] : hs(o[1], -0.2)); } },
  hive: (p, o) => { for (let k = 0; k < 6; k++) p.blob(16, 16 + k * 5, 9 - Math.abs(k - 2.5) * 1.4, 3, "#e8b040"); p.rect(15, 32, 3, 3, "#3a2a1a"); p.line(16, 6, 16, 12, "#6a4a2a"); },
  crystal_tree: (p, o) => { shadow(p, 10); p.column(14, 26, 4, 20, o[1]); p.g.fillStyle = rgba(o[3], 0.25); p.g.beginPath(); p.g.arc(16, 16, 13, 0, Math.PI * 2); p.g.fill(); for (const [x, y] of [[8, 16], [16, 8], [24, 16], [12, 22], [21, 23]]) { p.rect(x - 2, y - 5, 4, 8, o[1]); p.rect(x - 2, y - 5, 2, 8, hs(o[1], 0.4)); p.px(x + 1, y + 2, outline(o[1])); } },
  glass_spire: (p, o) => { for (const [x, top] of [[10, 14], [18, 4], [25, 20]] as const) { p.rect(x - 2, top, 4, 46 - top, rgba(o[1], 0.75)); p.rect(x - 2, top, 1, 46 - top, "rgba(255,255,255,.8)"); } },
  geode: (p, o) => { shadow(p, 12); p.blob(16, 36, 13, 10, "#7a7a86"); p.blob(16, 36, 8, 6, o[1], { hi: 0.5 }); },
  amber_tree: (p, o, r) => { shadow(p, 12); trunk(p, 14, 26, 5, bark(o)); crown(p, r, 16, 15, 13, 11, "#e8a030"); },
  gear: (p, o) => { shadow(p, 12); p.blob(16, 30, 13, 13, o[1]); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.rect(16 + Math.cos(a) * 14 - 2, 30 + Math.sin(a) * 14 - 2, 4, 4, o[1]); } p.blob(16, 30, 4, 4, "#3a2a1a", { outline: false }); },
  pipe: (p, o) => { p.column(6, 12, 8, 34, o[1]); p.column(18, 22, 8, 24, o[1]); p.rect(4, 12, 12, 3, hs(o[1], 0.3)); p.rect(16, 22, 12, 3, hs(o[1], 0.3)); p.px(9, 28, o[3]); },
  scrap: (p, o, r) => { for (let i = 0; i < 6; i++) { const x = r.int(4, 22), y = r.int(26, 40); p.rect(x, y, r.int(4, 9), r.int(3, 6), hs(o[1], r.next() * 0.4 - 0.2)); } p.line(8, 44, 24, 20, o[2], 2); },
  cloud_puff: (p, o) => { p.blob(10, 34, 9, 7, "#f0f4ff"); p.blob(22, 34, 9, 7, "#f0f4ff"); p.blob(16, 26, 10, 8, "#ffffff"); },
  floating_rock: (p, o, r) => { p.blob(16, 22, 12, 7, o[1]); for (let y = 26; y < 38; y++) { const w = Math.round(((38 - y) / 12) * 8); p.rect(16 - w, y, w * 2, 1, hs(o[1], -0.25)); } p.g.fillStyle = "rgba(20,10,40,.25)"; p.g.fillRect(12, 44, 8, 2); crown(p, r, 16, 15, 7, 3, "#5aa83a"); },
  tentacle: (p, o) => { for (let y = 46; y > 8; y--) { const t = (46 - y) / 38, x = 16 + Math.sin(y / 5) * 6 * t; p.blob(x, y, 5 - t * 3, 1.5, o[1], { outline: false }); } },
  eyestalk: (p, o) => { p.line(16, 46, 16, 18, o[1], 3); p.blob(16, 14, 8, 7, "#f4f0e4"); p.blob(17, 14, 4, 4, o[3]); p.rect(17, 13, 2, 2, "#1a1020"); },
  lantern: (p, o) => { p.rect(15, 12, 2, 34, "#4a3a3a"); p.rect(9, 10, 14, 2, "#4a3a3a"); p.rect(10, 14, 12, 12, hs(o[3], -0.3)); p.rect(12, 16, 8, 8, "#fff0a0"); p.g.fillStyle = "rgba(255,220,140,.22)"; p.g.beginPath(); p.g.arc(16, 20, 13, 0, Math.PI * 2); p.g.fill(); },
  torii: (p, o) => { p.column(8, 16, 4, 30, "#c8402a"); p.column(20, 16, 4, 30, "#c8402a"); p.rect(3, 10, 26, 4, "#c8402a"); p.rect(3, 9, 26, 1, "#2a1a1a"); p.rect(6, 18, 20, 3, "#a8301a"); },
  candle: (p, o) => { for (const [x, h] of [[9, 18], [16, 28], [23, 14]] as const) { p.column(x - 2, 46 - h, 5, h, "#efe2c8"); p.blob(x, 44 - h, 1.5, 3, "#ffc83a", { outline: false }); } },
  book_stack: (p, o) => { shadow(p, 10); for (let k = 0; k < 8; k++) { const c = ["#8a3a3a", "#3a5a8a", "#6a8a3a", "#8a6a3a"][k % 4]; p.rect(8 + (k % 3), 42 - k * 4, 16, 4, c); p.rect(8 + (k % 3), 42 - k * 4, 16, 1, hs(c, 0.3)); p.rect(22 + (k % 3), 42 - k * 4, 2, 4, "#efe2c8"); } },
  clock: (p, o) => { shadow(p, 9); p.column(10, 18, 12, 28, o[1]); p.blob(16, 14, 9, 9, o[1]); p.blob(16, 14, 6, 6, "#f8f0dc", { outline: false }); p.line(16, 14, 16, 10, "#2a1a1a"); p.line(16, 14, 19, 15, "#2a1a1a"); },
  cage: (p, o) => { for (let x = 6; x <= 26; x += 4) p.rect(x, 14, 1, 32, o[1]); p.rect(5, 14, 23, 2, hs(o[1], 0.3)); p.rect(5, 44, 23, 2, hs(o[1], -0.3)); },
  salt_pillar: (p, o) => { shadow(p, 8); p.column(11, 12, 10, 34, "#ece6e6"); for (let y = 14; y < 44; y += 3) p.rect(12, y, 8, 1, "#d8d0d0"); },
  web: (p) => { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(16, 26, 16 + Math.cos(a) * 14, 26 + Math.sin(a) * 17, "rgba(255,255,255,.7)"); } },
  ruin_wall: (p, o) => { shadow(p, 13); for (let y = 24; y < 46; y += 5) for (let x = y % 2 ? 2 : 5; x < 30; x += 7) { if (y < 30 && x > 18) continue; p.rect(x, y, 6, 4, o[1]); p.rect(x, y, 6, 1, hs(o[1], 0.3)); p.rect(x, y + 3, 6, 1, hs(o[1], -0.3)); } p.line(20, 24, 24, 32, "#4f9a35"); },
  heart_tree: (p, o, r) => { shadow(p, 12); trunk(p, 13, 26, 6, bark(o)); p.blob(10, 14, 8, 8, o[1]); p.blob(22, 14, 8, 8, o[1]); for (let y = 16; y < 32; y++) { const w = Math.round(((32 - y) / 16) * 13); p.rect(16 - w, y, w * 2, 1, o[1]); } },
  geyser: (p, o) => OBSTACLES.vent(p, o, new Rng(1)),
};

// ------------------------------------------------------------ liquids
const LIQ: Record<string, [string, string, string]> = {
  lava: ["#d8481a", "#ff8a2a", "#ffe06a"], acid: ["#5a9a2a", "#8ad83a", "#e0ff8a"], void: ["#140a24", "#2a1a4a", "#b08aff"],
  tar: ["#1a1618", "#2a2426", "#6a6068"], mercury: ["#8a90a0", "#c8ccd8", "#ffffff"], honey: ["#d88a1a", "#f0b030", "#fff0a0"],
  blood: ["#7a1a24", "#a82a34", "#e05a60"], cloud: ["#b8cce8", "#e0ecfc", "#ffffff"], ink: ["#141838", "#26305a", "#6a7ac0"],
  light: ["#e8d880", "#fff4c0", "#ffffff"], sand: ["#d0a868", "#e8c488", "#fff0c8"],
};
export function liquidColors(b: Biome): [string, string, string] {
  return b.liquid && b.liquid !== "water" ? LIQ[b.liquid] ?? b.water : [b.water[0], b.water[1], b.water[2]];
}

// ------------------------------------------------------------ tile set
export interface TileSet {
  tiles: HTMLCanvasElement[][];
  water: HTMLCanvasElement[];
  tall: HTMLCanvasElement[];
  /** Cliff front face (drawn instead of the wall top when the tile below is not a wall). */
  wallFace: HTMLCanvasElement;
  /** Grassy bank overhanging the top edge of a liquid tile; rotate for other sides. */
  shore: HTMLCanvasElement;
  /** Grass tufts spilling over the top edge of a path tile; rotate for other sides. */
  edge: HTMLCanvasElement;
}

const sets = new Map<string, TileSet>();

export function tileSet(b: Biome): TileSet {
  const hit = sets.get(b.id);
  if (hit) return hit;
  const seed = hashString(b.id);
  const g0 = b.ground[0], path = b.alt[0], cliff = b.wall[0];
  const pattern = GROUNDS[b.pattern ?? defaultPattern(b)] ?? GROUNDS.grass;
  const decor = DECORS[b.decor] ?? DECORS.pebbles;
  const liquid = liquidColors(b);
  const motifs = [b.obstacle, ...(b.obstacles ?? [])].filter((m) => OBSTACLES[m]);
  if (!motifs.length) motifs.push("rock");

  const make = (fn: (p: Paint, v: number, r: Rng) => void) => Array.from({ length: VARIANTS }, (_, v) => {
    const [c, p] = makeCanvas(TS, TS);
    fn(p, v, new Rng(seed + v * 7919));
    return c;
  });
  const ground = (p: Paint, v: number, r: Rng) => { base(p, g0, seed + v); pattern(p, g0, r); };
  const tiles: HTMLCanvasElement[][] = [];
  tiles[T.GROUND] = make(ground);
  tiles[T.ALT] = make((p, v, r) => {
    base(p, path, seed + 99 + v, 0.8);
    for (let i = 0; i < 4; i++) { const x = r.int(0, 14), y = r.int(0, 14); p.px(x, y, hs(path, -0.22)); p.px(x + 1, y, hs(path, 0.2)); }
  });
  tiles[T.DECOR] = make((p, v, r) => { ground(p, v, r); decor(p, b.decorColors, r, b); });
  tiles[T.WALL] = make((p, v, r) => {
    // cliff top: a darker, mossier version of the ground
    const top = mixC(g0, cliff, 0.35);
    base(p, top, seed + 300 + v);
    pattern(p, top, r);
  });
  tiles[T.SHALLOW] = make((p, v, r) => {
    const c = mixC(liquid[1], path, 0.25);
    base(p, c, seed + 500 + v, 0.7);
    for (let i = 0; i < 2; i++) p.rect(r.int(1, 10), r.int(2, 14), r.int(2, 4), 1, rgba(liquid[2], 0.8));
    p.px(r.int(1, 14), r.int(1, 14), hs(path, -0.2));
  });
  const water: HTMLCanvasElement[] = Array.from({ length: 4 }, (_, f) => { const [c, p] = makeCanvas(TS, TS); waterFrame(p, liquid, f, seed); return c; });
  tiles[T.WATER] = water;

  const tall = motifs.flatMap((m, mi) => Array.from({ length: mi === 0 ? 3 : 2 }, (_, v) => {
    const [c, p] = makeCanvas(OW, OH);
    const tint = v === 1 ? 0.06 : v === 2 ? -0.06 : 0;
    const o = b.obs.map((x, i) => (i < 3 ? hs(x, tint) : x)) as Obs;
    OBSTACLES[m](p, o, new Rng(seed + mi * 131 + v * 17));
    return c;
  }));
  tiles[T.OBSTACLE] = make((p, v, r) => { ground(p, v, r); p.g.drawImage(tall[v % tall.length], 0, 0, OW, OH, 0, -8, 16, 24); });

  // cliff face: layered rock strata with a grassy lip and a dark foot
  const [wallFace, wp] = makeCanvas(TS, TS);
  wp.rect(0, 0, TS, TS, cliff);
  const r2 = new Rng(seed + 9);
  for (let y = 4; y < 14; y += 4) { wp.rect(0, y, TS, 1, hs(cliff, -0.28)); wp.rect(0, y + 1, TS, 1, hs(cliff, 0.15)); }
  for (let i = 0; i < 5; i++) wp.rect(r2.int(0, 14), r2.int(2, 12), 1, r2.int(2, 4), hs(cliff, -0.35));
  wp.rect(0, 0, TS, 2, mixC(g0, cliff, 0.35));
  for (let x = 0; x < TS; x += 2) wp.px(x + (x % 4 ? 1 : 0), 2, hs(mixC(g0, cliff, 0.35), -0.2));
  wp.rect(0, 14, TS, 2, hs(cliff, -0.45));

  // water bank: ground lip + dark wet shadow + a line of foam
  const [shore, sp] = makeCanvas(TS, TS);
  for (let x = 0; x < TS; x++) {
    const h = 2 + ((x * 7 + seed) % 3 === 0 ? 1 : 0);
    sp.rect(x, 0, 1, h, g0);
    sp.px(x, h, hs(g0, -0.3));
    sp.px(x, h + 1, rgba(hs(liquid[0], -0.4), 0.6));
    if (x % 3 === 0) sp.px(x, h + 2, rgba(liquid[2], 0.8));
  }

  const [edge, ep] = makeCanvas(TS, TS);
  for (let x = 0; x < TS; x++) {
    const h = 1 + ((x * 5 + seed) % 4 === 0 ? 2 : (x * 3) % 5 === 0 ? 1 : 0);
    ep.rect(x, 0, 1, h, g0);
    ep.px(x, h, hs(g0, -0.25));
  }

  const set: TileSet = { tiles, water, tall, wallFace, shore, edge };
  sets.set(b.id, set);
  return set;
}

function waterFrame(p: Paint, liquid: [string, string, string], f: number, seed: number) {
  p.rect(0, 0, TS, TS, liquid[0]);
  const deep = hs(liquid[0], -0.12);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (((x + y * 2 + f) % 11) < 2 && bayer(x, y) > 0.5) p.px(x, y, deep);
  // drifting shimmer lines
  const r = new Rng(seed + 77);
  for (let i = 0; i < 3; i++) {
    const x = (r.int(0, 15) + f * 2) % 16, y = r.int(1, 14);
    p.rect(x, y, 3, 1, liquid[1]);
    p.px((x + 1) % 16, y - 1 < 0 ? 0 : y - 1, rgba(liquid[2], 0.7));
  }
  if (f % 2 === 0) p.px(r.int(0, 15), r.int(0, 15), liquid[2]);
}

function defaultPattern(b: Biome): string {
  const map: Record<string, string> = {
    flowers: "grass", grass: "grass", pebbles: "rock", bones: "sand", reeds: "mud", snow: "snow", embers: "ash",
    sparkles: "crystal", leaves: "leaves", shells: "sand", glow: "moss",
  };
  return map[b.decor] ?? "grass";
}

/** Obstacle sprites are 2 tiles wide and 3 tall, anchored at the bottom centre of their tile. */
export const TALL_W = OW / TS;
export const TALL_H = OH / TS;
