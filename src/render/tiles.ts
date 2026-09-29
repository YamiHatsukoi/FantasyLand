import { Rng, hashString } from "../core/rng";
import type { Biome } from "../world/biomes";

/**
 * Procedural 32x32 terrain art. Every biome gets its own tile set from its palette plus a
 * ground pattern, decoration style, liquid and a mix of tall obstacle motifs (trees,
 * crystals, ruins...). Obstacles are drawn as 32x48 sprites so they overlap what stands
 * behind them.
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
export const TS = 32;

type Ctx = CanvasRenderingContext2D;

// ------------------------------------------------------------ colour helpers
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
/** Lighten (f>0) or darken (f<0) a colour. */
export function sh(c: string, f: number): string {
  const [r, g, b] = hex(c);
  return f >= 0 ? toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : toHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
const alpha = (c: string, a: number) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

// ------------------------------------------------------------ pen
class Pen {
  constructor(public g: Ctx, public w: number, public h: number, public rng: Rng) {}
  px(x: number, y: number, c: string) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.g.fillStyle = c;
    this.g.fillRect(x, y, 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      this.rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    }
  }
  /** Shaded ball lit from the upper left: dark / mid / light with dithered transitions. */
  ball(cx: number, cy: number, rx: number, ry: number, dark: string, mid: string, light: string, outline = true) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const lit = -dx * 0.6 - dy * 0.8 + (1 - d) * 0.4;
        const b = bayer(x, y) * 0.3;
        const c = lit + b > 0.75 ? light : lit + b > 0.05 ? mid : dark;
        this.px(x, y, outline && d > 0.82 && lit < 0.2 ? sh(dark, -0.35) : c);
      }
    }
  }
  /** Vertical cylinder / column with side shading. */
  column(x: number, y: number, w: number, h: number, dark: string, mid: string, light: string) {
    for (let i = 0; i < w; i++) {
      const t = i / Math.max(1, w - 1);
      const c = t < 0.25 ? light : t < 0.7 ? mid : dark;
      this.rect(x + i, y, 1, h, c);
    }
  }
  tri(cx: number, top: number, bottom: number, halfW: number, dark: string, mid: string, light: string) {
    for (let y = top; y <= bottom; y++) {
      const hw = Math.round(((y - top) / Math.max(1, bottom - top)) * halfW);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const t = (x - (cx - hw)) / Math.max(1, hw * 2);
        this.px(x, y, t < 0.3 ? light : t < 0.75 ? mid : dark);
      }
    }
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, Pen, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  return [c, new Pen(g, w, h, new Rng(1)), g];
}

// ------------------------------------------------------------ ground patterns
/** Tileable value noise in [0,1]. */
function noise2(seed: number) {
  const P = 8;
  const rng = new Rng(seed);
  const grid = Array.from({ length: P * P }, () => rng.next());
  const at = (x: number, y: number) => grid[((y % P) + P) % P * P + ((x % P) + P) % P];
  return (x: number, y: number, period = 32) => {
    const fx = (x / period) * P, fy = (y / period) * P;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function baseFill(p: Pen, cols: readonly string[], seed: number, contrast = 1) {
  const n = noise2(seed);
  const n2 = noise2(seed ^ 0x5151);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = (n(x, y) * 0.7 + n2(x * 2, y * 2) * 0.3 - 0.5) * contrast + 0.5 + (bayer(x, y) - 0.5) * 0.18;
    p.px(x, y, v < 0.36 ? cols[1] : v > 0.64 ? cols[2] : cols[0]);
  }
}

type GroundFn = (p: Pen, c: readonly string[], rng: Rng) => void;
const blade = (p: Pen, x: number, y: number, h: number, c: string, lean = 0) => { for (let i = 0; i < h; i++) p.px(x + Math.round((lean * i) / h), y - i, c); };

export const GROUNDS: Record<string, GroundFn> = {
  grass: (p, c, r) => { for (let i = 0; i < 16; i++) blade(p, r.int(0, 31), r.int(3, 31), r.int(2, 4), i % 3 ? sh(c[2], 0.12) : sh(c[1], -0.15), r.int(-1, 1)); },
  moss: (p, c, r) => { for (let i = 0; i < 10; i++) { const x = r.int(0, 30), y = r.int(0, 30); p.rect(x, y, 2, 2, sh(c[2], 0.15)); p.px(x + 1, y + 1, sh(c[1], -0.1)); } },
  sand: (p, c, r) => { for (let i = 0; i < 26; i++) p.px(r.int(0, 31), r.int(0, 31), i % 2 ? sh(c[2], 0.2) : sh(c[1], -0.12)); },
  dunes: (p, c, r) => { const o = r.int(0, 31); for (let y = 4; y < 32; y += 9) for (let x = 0; x < 32; x++) p.px(x, (y + Math.round(Math.sin((x + o) / 5) * 2) + 32) % 32, sh(c[1], -0.1)); },
  rock: (p, c, r) => { for (let i = 0; i < 4; i++) { let x = r.int(0, 31), y = r.int(0, 31); for (let k = 0; k < 8; k++) { p.px(x, y, sh(c[1], -0.28)); x += r.int(-1, 1); y += 1; } } for (let i = 0; i < 6; i++) p.px(r.int(0, 31), r.int(0, 31), sh(c[2], 0.25)); },
  gravel: (p, c, r) => { for (let i = 0; i < 18; i++) { const x = r.int(0, 30), y = r.int(0, 30); p.rect(x, y, 2, 1, sh(c[2], 0.2)); p.px(x, y + 1, sh(c[1], -0.25)); } },
  snow: (p, c, r) => { for (let i = 0; i < 10; i++) p.px(r.int(0, 31), r.int(0, 31), "#ffffff"); for (let i = 0; i < 3; i++) { const x = r.int(0, 26), y = r.int(0, 31); p.rect(x, y, 5, 1, sh(c[1], -0.06)); } },
  ice: (p, c, r) => { for (let i = 0; i < 3; i++) { const x = r.int(0, 31), y = r.int(0, 31); p.line(x, y, x + r.int(-8, 8), y + r.int(4, 10), sh(c[2], 0.35)); } p.rect(r.int(2, 20), r.int(2, 20), 6, 1, "#ffffff"); },
  ash: (p, c, r) => { for (let i = 0; i < 20; i++) p.px(r.int(0, 31), r.int(0, 31), i % 4 ? sh(c[1], -0.25) : "#ff8a3a"); },
  obsidian: (p, c, r) => { for (let i = 0; i < 5; i++) { const x = r.int(0, 28), y = r.int(0, 28); p.line(x, y, x + 3, y + 2, sh(c[2], 0.4)); } },
  mud: (p, c, r) => { for (let i = 0; i < 4; i++) { const x = r.int(2, 26), y = r.int(2, 28); p.rect(x, y, r.int(3, 6), 2, sh(c[1], -0.25)); p.rect(x + 1, y, 2, 1, sh(c[2], 0.25)); } },
  crystal: (p, c, r) => { for (let i = 0; i < 6; i++) { const x = r.int(1, 29), y = r.int(2, 30); p.px(x, y, sh(c[2], 0.5)); p.px(x + 1, y - 1, sh(c[2], 0.3)); p.px(x, y + 1, sh(c[1], -0.2)); } },
  tiles: (p, c) => { for (let y = 0; y < 32; y += 8) { p.rect(0, y, 32, 1, sh(c[1], -0.3)); for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) p.rect(x, y, 1, 8, sh(c[1], -0.3)); p.rect(0, y + 1, 32, 1, sh(c[2], 0.15)); } },
  bones: (p, c, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, 24), y = r.int(3, 28); p.rect(x, y, 6, 1, "#e8e0d0"); p.px(x - 1, y - 1, "#e8e0d0"); p.px(x - 1, y + 1, "#e8e0d0"); p.px(x + 6, y - 1, "#e8e0d0"); p.px(x + 6, y + 1, "#e8e0d0"); } },
  flesh: (p, c, r) => { for (let i = 0; i < 5; i++) { let x = r.int(0, 31), y = r.int(0, 31); for (let k = 0; k < 10; k++) { p.px(x, y, sh(c[1], -0.3)); x += r.int(-1, 1); y += r.int(0, 1); } } for (let i = 0; i < 4; i++) p.px(r.int(0, 31), r.int(0, 31), sh(c[2], 0.3)); },
  cloud: (p, c, r) => { for (let i = 0; i < 5; i++) p.ball(r.int(2, 29), r.int(2, 29), 4, 3, c[0], sh(c[0], 0.15), "#ffffff", false); },
  metal: (p, c, r) => { p.rect(0, 15, 32, 1, sh(c[1], -0.3)); p.rect(15, 0, 1, 32, sh(c[1], -0.3)); for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28], [19, 19]]) { p.px(x, y, sh(c[2], 0.4)); p.px(x + 1, y + 1, sh(c[1], -0.3)); } if (r.chance(0.5)) p.rect(r.int(2, 20), r.int(2, 26), 8, 1, sh(c[2], 0.2)); },
  salt: (p, c, r) => { for (let i = 0; i < 6; i++) { const x = r.int(0, 28), y = r.int(0, 28); p.line(x, y, x + 4, y, sh(c[1], -0.12)); p.line(x, y, x, y + 4, sh(c[1], -0.12)); } },
  leaves: (p, c, r) => { const cols = ["#c8602a", "#e0a030", "#a0402a", "#d88040"]; for (let i = 0; i < 14; i++) { const x = r.int(0, 30), y = r.int(0, 30); p.rect(x, y, 2, 1, r.pick(cols)); p.px(x + 1, y + 1, sh(r.pick(cols), -0.2)); } },
  petals: (p, c, r) => { for (let i = 0; i < 10; i++) { const x = r.int(0, 30), y = r.int(0, 30); p.px(x, y, "#ffd0e0"); p.px(x + 1, y, "#f090b8"); } },
  roots: (p, c, r) => { for (let i = 0; i < 3; i++) { let x = r.int(0, 31), y = 0; for (let k = 0; k < 32; k++) { p.px(x, y, sh(c[1], -0.35)); p.px(x + 1, y, sh(c[1], -0.15)); y++; x += r.int(-1, 1); } } },
  soil: (p, c, r) => { for (let y = 3; y < 32; y += 6) for (let x = 0; x < 32; x++) if (r.chance(0.8)) p.px(x, y, sh(c[1], -0.2)); },
  lichen: (p, c, r) => { const cols = ["#c8c870", "#e0a060", "#a0c890"]; for (let i = 0; i < 6; i++) { const x = r.int(1, 28), y = r.int(1, 28), col = r.pick(cols); p.rect(x, y, 3, 2, col); p.px(x + 3, y + 1, col); } },
  void: (p, c, r) => { for (let i = 0; i < 8; i++) p.px(r.int(0, 31), r.int(0, 31), i % 3 ? "#ffffff" : sh(c[2], 0.6)); },
  circuit: (p, c, r) => { for (let i = 0; i < 4; i++) { let x = r.int(0, 31), y = r.int(0, 31); const col = sh(c[2], 0.35); for (let k = 0; k < 10; k++) { p.px(x, y, col); if (k % 5 === 4) r.chance(0.5) ? x++ : y++; else r.chance(0.5) ? x++ : y++; } p.rect(x - 1, y - 1, 3, 3, col); } },
  paper: (p, c, r) => { for (let y = 2; y < 32; y += 4) for (let x = r.int(1, 4); x < 30; x += r.int(2, 5)) p.rect(x, y, r.int(1, 3), 1, sh(c[1], -0.35)); },
  amber: (p, c, r) => { for (let i = 0; i < 5; i++) { const x = r.int(2, 28), y = r.int(2, 28); p.px(x, y, "#ffe8a0"); p.px(x + 1, y, sh(c[2], 0.3)); } },
  scales: (p, c) => { for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 32; x += 4) { p.px(x, y, sh(c[1], -0.3)); p.px(x + 1, y + 1, sh(c[1], -0.3)); p.px(x + 2, y, sh(c[1], -0.3)); p.px(x + 1, y, sh(c[2], 0.2)); } },
  glass: (p, c, r) => { for (let i = 0; i < 4; i++) { const x = r.int(0, 31), y = r.int(0, 31); p.line(x, y, x + r.int(4, 10), y + r.int(-6, 6), sh(c[2], 0.5)); } },
};

// ------------------------------------------------------------ decorations
type DecorFn = (p: Pen, cols: string[], rng: Rng, b: Biome) => void;
export const DECORS: Record<string, DecorFn> = {
  flowers: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 28), y = r.int(4, 28), c = r.pick(cols); blade(p, x, y + 3, 3, "#3f8f3a"); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); p.px(x, y, "#fff3a0"); } },
  grass: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 27), y = r.int(8, 30); for (let k = -2; k <= 2; k++) blade(p, x + k, y, 4 + (2 - Math.abs(k)) * 2, r.pick(cols), k); } },
  pebbles: (p, cols, r) => { for (let i = 0; i < 5; i++) { const x = r.int(2, 27), y = r.int(3, 28), c = r.pick(cols); p.rect(x, y, 3, 2, c); p.px(x, y, sh(c, 0.3)); p.rect(x, y + 2, 3, 1, "rgba(0,0,0,.25)"); } },
  bones: (p, cols, r) => { const x = r.int(4, 18), y = r.int(8, 22); p.rect(x, y, 9, 2, cols[0]); p.rect(x - 1, y - 1, 2, 4, cols[0]); p.rect(x + 8, y - 1, 2, 4, cols[0]); const sx = r.int(4, 24), sy = r.int(4, 24); p.ball(sx, sy, 3, 3, sh(cols[0], -0.3), cols[0], "#ffffff", false); p.px(sx - 1, sy, "#1b1b2a"); p.px(sx + 1, sy, "#1b1b2a"); },
  reeds: (p, cols, r) => { for (let i = 0; i < 5; i++) { const x = r.int(3, 28), y = r.int(12, 30); blade(p, x, y, r.int(8, 13), r.pick(cols), r.int(-1, 1)); p.rect(x - 1, y - r.int(10, 12), 2, 3, "#6a4a2a"); } },
  snow: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, 24), y = r.int(4, 28); p.ball(x, y, r.int(3, 5), 2, sh(cols[0], -0.1), cols[0], "#ffffff", false); } },
  embers: (p, cols, r) => { for (let i = 0; i < 6; i++) { const x = r.int(2, 29), y = r.int(2, 29); p.px(x, y, r.pick(cols)); p.px(x, y + 1, "#5a1a0a"); } p.line(r.int(0, 10), r.int(10, 30), r.int(18, 31), r.int(0, 30), "#ff6a1a"); },
  sparkles: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 28), y = r.int(3, 28), c = r.pick(cols); p.px(x, y, "#ffffff"); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); } },
  leaves: (p, cols, r) => { for (let i = 0; i < 9; i++) { const x = r.int(1, 29), y = r.int(1, 29), c = r.pick(cols); p.rect(x, y, 3, 2, c); p.px(x + 1, y + 1, sh(c, -0.3)); } },
  shells: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(3, 26), y = r.int(4, 27), c = r.pick(cols); p.ball(x, y, 3, 2, sh(c, -0.25), c, "#ffffff", false); p.line(x - 2, y + 1, x + 2, y - 1, sh(c, -0.35)); } },
  glow: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 28), y = r.int(3, 28), c = r.pick(cols); p.g.fillStyle = alpha(c, 0.25); p.g.beginPath(); p.g.arc(x + 0.5, y + 0.5, 3, 0, Math.PI * 2); p.g.fill(); p.px(x, y, "#ffffff"); p.px(x + 1, y, c); } },
  mushrooms: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(4, 27), y = r.int(8, 28), c = r.pick(cols); p.rect(x, y - 2, 2, 3, "#e8dcc0"); p.ball(x + 1, y - 3, 3, 2, sh(c, -0.3), c, sh(c, 0.4), false); p.px(x, y - 4, "#ffffff"); } },
  ferns: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(6, 24), y = r.int(14, 28), c = r.pick(cols); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; p.line(x, y, x + Math.cos(a) * 8, y + Math.sin(a) * 8, k % 2 ? c : sh(c, -0.2)); } } },
  crystals: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(4, 26), y = r.int(8, 28), c = r.pick(cols), hgt = r.int(4, 8); p.tri(x, y - hgt, y, 2, sh(c, -0.3), c, sh(c, 0.5)); } },
  runes: (p, cols, r) => { const c = r.pick(cols); const x = r.int(6, 20), y = r.int(6, 20); p.g.strokeStyle = alpha(c, 0.8); p.g.lineWidth = 1; p.g.beginPath(); p.g.arc(x + 4.5, y + 4.5, 5, 0, Math.PI * 2); p.g.stroke(); p.line(x + 2, y + 2, x + 7, y + 7, c); p.line(x + 7, y + 2, x + 2, y + 7, c); },
  feathers: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(3, 26), y = r.int(3, 26), c = r.pick(cols); p.line(x, y, x + 5, y + 3, c); p.line(x + 1, y + 1, x + 4, y + 1, sh(c, 0.3)); } },
  skulls: (p, cols, r) => { const x = r.int(6, 24), y = r.int(8, 24); p.ball(x, y, 4, 3, sh(cols[0], -0.3), cols[0], "#ffffff", false); p.rect(x - 2, y + 2, 5, 2, cols[0]); p.px(x - 2, y, "#1b1b2a"); p.px(x + 1, y, "#1b1b2a"); },
  puddles: (p, cols, r, b) => { const x = r.int(4, 20), y = r.int(6, 24); p.ball(x + 4, y, 5, 2, b.water[0], b.water[1], b.water[2], false); },
  cracks: (p, cols, r) => { for (let i = 0; i < 2; i++) { let x = r.int(4, 28), y = r.int(4, 28); for (let k = 0; k < 9; k++) { p.px(x, y, r.pick(cols)); x += r.int(-1, 1); y += r.int(-1, 1); } } },
  bubbles: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 28), y = r.int(3, 28), c = r.pick(cols); p.px(x, y - 1, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y + 1, c); p.px(x - 1, y - 1, "#ffffff"); } },
  candles: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(6, 25), y = r.int(12, 28); p.rect(x, y - 5, 2, 6, "#e8dcc0"); p.px(x, y - 7, "#ffe06a"); p.px(x, y - 6, "#ff8a2a"); p.g.fillStyle = "rgba(255,200,100,.18)"; p.g.beginPath(); p.g.arc(x + 1, y - 6, 4, 0, Math.PI * 2); p.g.fill(); } },
  vines: (p, cols, r) => { let x = r.int(0, 31), y = 0; for (let k = 0; k < 32; k++) { p.px(x, y, cols[0]); if (k % 4 === 0) p.rect(x + 1, y, 2, 2, r.pick(cols)); y++; x = (x + r.int(-1, 1) + 32) % 32; } },
  eyes: (p, cols, r) => { for (let i = 0; i < 2; i++) { const x = r.int(4, 26), y = r.int(4, 26); p.ball(x, y, 3, 2, "#e8e0d0", "#ffffff", "#ffffff", false); p.rect(x, y - 1, 1, 2, r.pick(cols)); } },
  coins: (p, cols, r) => { for (let i = 0; i < 4; i++) { const x = r.int(3, 28), y = r.int(3, 28); p.rect(x, y, 2, 1, "#f2c542"); p.px(x, y, "#fff4b0"); } },
  seaweed: (p, cols, r) => { for (let i = 0; i < 3; i++) { const x = r.int(4, 27), y = r.int(14, 30), c = r.pick(cols); for (let k = 0; k < 10; k++) p.px(x + Math.round(Math.sin(k / 2) * 1.5), y - k, k % 2 ? c : sh(c, 0.2)); } },
  gears: (p, cols, r) => { const x = r.int(6, 24), y = r.int(6, 24), c = r.pick(cols); p.ball(x, y, 4, 4, sh(c, -0.3), c, sh(c, 0.3), false); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.px(x + Math.cos(a) * 5, y + Math.sin(a) * 5, c); } p.px(x, y, "#1b1b2a"); },
  glyphs: (p, cols, r) => { const c = r.pick(cols); for (let i = 0; i < 3; i++) { const x = r.int(3, 25), y = r.int(3, 25); p.line(x, y, x + 3, y, c); p.line(x + 1, y, x + 1, y + 4, c); p.px(x + 3, y + 3, c); } },
  lanterns: (p, cols, r) => { const x = r.int(8, 22), y = r.int(12, 24), c = r.pick(cols); p.rect(x, y, 4, 5, c); p.rect(x + 1, y + 1, 2, 3, "#fff3a0"); p.g.fillStyle = alpha(c, 0.2); p.g.beginPath(); p.g.arc(x + 2, y + 2, 7, 0, Math.PI * 2); p.g.fill(); },
};

// ------------------------------------------------------------ tall obstacles (32x48)
type ObsFn = (p: Pen, o: [string, string, string, string], r: Rng, b: Biome) => void;
const OW = 32, OH = 48, BASE = 44; // obstacle canvas size and ground line
/** Bark colour: the biome's darkest obstacle tone pulled towards brown. */
const bark = (o: string[]) => mix(o[0], "#5a3a1e", 0.7);
const trunk = (p: Pen, x: number, y: number, w: number, h: number, c: string) => p.column(x, y, w, h, sh(c, -0.35), c, sh(c, 0.25));

function canopy(p: Pen, o: [string, string, string, string], cx: number, cy: number, rx: number, ry: number) {
  p.ball(cx, cy, rx, ry, o[0], o[1], o[2]);
  for (let i = 0; i < 6; i++) p.px(cx + p.rng.int(-rx + 2, rx - 2), cy + p.rng.int(-ry + 2, ry - 2), sh(o[2], 0.2));
}

export const OBSTACLES: Record<string, ObsFn> = {
  tree: (p, o) => { trunk(p, 14, 26, 5, 18, bark(o)); canopy(p, o, 16, 18, 13, 11); canopy(p, o, 11, 14, 7, 6); },
  pine: (p, o) => { trunk(p, 14, 36, 4, 8, bark(o)); for (let k = 0; k < 4; k++) p.tri(16, 4 + k * 8, 18 + k * 7, 5 + k * 3, o[0], o[1], o[2]); },
  sakura: (p, o) => { trunk(p, 14, 24, 4, 20, bark(o)); p.line(16, 26, 8, 16, bark(o), 2); p.line(17, 24, 25, 14, bark(o), 2); canopy(p, o, 9, 14, 8, 7); canopy(p, o, 23, 13, 8, 7); canopy(p, o, 16, 9, 9, 7); for (let i = 0; i < 8; i++) p.px(p.rng.int(2, 30), p.rng.int(2, 22), "#ffffff"); },
  autumn_tree: (p, o) => { trunk(p, 14, 26, 5, 18, bark(o)); canopy(p, ["#8a2a1a", "#d0602a", "#f0a040", o[3]], 16, 17, 13, 11); for (let i = 0; i < 5; i++) p.px(p.rng.int(4, 28), p.rng.int(30, 44), "#e0802a"); },
  birch: (p, o) => { p.column(14, 12, 4, 32, "#b0b0a8", "#e8e8e0", "#ffffff"); for (let y = 16; y < 42; y += 5) p.rect(14 + (y % 3), y, 2, 1, "#2a2a2a"); canopy(p, o, 16, 11, 9, 9); },
  willow: (p, o) => { trunk(p, 14, 22, 5, 22, bark(o)); canopy(p, o, 16, 12, 13, 9); for (let x = 4; x < 29; x += 2) p.line(x, 14, x + p.rng.int(-1, 1), 30 + p.rng.int(0, 8), x % 4 ? o[1] : o[2]); },
  baobab: (p, o) => { p.column(10, 16, 12, 28, sh(bark(o), -0.35), bark(o), sh(bark(o), 0.25)); for (const [x, y] of [[8, 12], [16, 9], [24, 12]]) canopy(p, o, x, y, 6, 4); },
  palm: (p, o) => { for (let i = 0; i < 30; i++) p.rect(15 + Math.round(Math.sin(i / 9) * 2), 14 + i, 3, 1, i % 4 ? bark(o) : sh(bark(o), -0.3)); for (let k = 0; k < 6; k++) { const a = Math.PI + (k / 5) * Math.PI; for (let t = 0; t < 12; t++) p.px(16 + Math.cos(a) * t, 14 + Math.sin(a) * t * 0.6 + t * t * 0.04, t % 3 ? o[1] : o[2]); } p.ball(16, 15, 2, 2, o[3], sh(o[3], 0.2), sh(o[3], 0.4), false); },
  mangrove: (p, o) => { for (const x of [7, 12, 19, 24]) p.line(16, 30, x, 44, bark(o), 2); trunk(p, 14, 22, 4, 10, bark(o)); canopy(p, o, 16, 16, 13, 9); },
  jungle_tree: (p, o) => { trunk(p, 13, 14, 6, 30, bark(o)); for (let y = 16; y < 40; y += 4) p.px(13 + (y % 6), y, "#4a8a3a"); canopy(p, o, 16, 11, 15, 9); p.line(6, 16, 5, 36, "#3f8f3a"); p.line(26, 14, 27, 32, "#3f8f3a"); },
  dead_tree: (p, o) => { trunk(p, 14, 12, 4, 32, bark(o)); p.line(15, 20, 5, 10, bark(o), 2); p.line(17, 24, 27, 13, bark(o), 2); p.line(8, 13, 7, 6, bark(o)); p.line(25, 15, 28, 8, bark(o)); p.line(16, 12, 16, 3, bark(o), 2); },
  cactus: (p, o) => { p.column(12, 8, 8, 36, o[0], o[1], o[2]); p.column(4, 18, 6, 4, o[0], o[1], o[2]); p.column(4, 10, 5, 10, o[0], o[1], o[2]); p.column(21, 22, 6, 4, o[0], o[1], o[2]); p.column(22, 14, 5, 10, o[0], o[1], o[2]); for (let y = 10; y < 42; y += 4) p.px(16, y, sh(o[2], 0.4)); p.ball(16, 8, 3, 2, "#c83a5a", "#f070a0", "#ffd0e0", false); },
  rock: (p, o) => { p.ball(16, 34, 13, 10, o[0], o[1], o[2]); p.ball(10, 38, 7, 5, o[0], o[1], o[2]); p.line(12, 30, 18, 36, sh(o[0], -0.2)); },
  lava_rock: (p, o) => { p.ball(16, 34, 13, 10, o[0], o[1], o[2]); for (let i = 0; i < 3; i++) { let x = p.rng.int(8, 24), y = 28; for (let k = 0; k < 8; k++) { p.px(x, y, o[3]); x += p.rng.int(-1, 1); y++; } } },
  stalagmite: (p, o) => { p.tri(16, 6, 44, 7, o[0], o[1], o[2]); p.tri(8, 24, 44, 4, o[0], o[1], o[2]); p.tri(25, 20, 44, 4, o[0], o[1], o[2]); },
  crystal: (p, o) => { for (const [x, top, hw] of [[9, 20, 4], [16, 6, 6], [24, 16, 4]] as const) p.tri(x, top, 44, hw, o[0], o[1], o[2]); p.line(16, 8, 16, 40, sh(o[2], 0.5)); p.px(15, 12, "#ffffff"); p.g.fillStyle = alpha(o[3], 0.25); p.g.beginPath(); p.g.arc(16, 26, 14, 0, Math.PI * 2); p.g.fill(); },
  ice_spike: (p, o) => { for (const [x, top, hw] of [[8, 18, 4], [16, 4, 5], [25, 14, 4]] as const) p.tri(x, top, 44, hw, o[0], o[1], o[2]); p.line(14, 10, 14, 40, "#ffffff"); },
  iceberg: (p, o) => { p.ball(16, 32, 14, 12, o[0], o[1], o[2]); p.tri(16, 8, 30, 8, o[0], o[1], o[2]); p.rect(3, 40, 26, 2, "#ffffff"); },
  giant_mushroom: (p, o) => { p.column(13, 22, 7, 22, "#c8b8a0", "#e8dcc0", "#fff8e8"); p.ball(16, 18, 15, 10, o[0], o[1], o[2]); for (let i = 0; i < 7; i++) p.ball(p.rng.int(6, 26), p.rng.int(11, 22), 1.6, 1.3, "#ffffff", "#ffffff", "#ffffff", false); p.rect(4, 25, 24, 2, sh(o[0], -0.3)); },
  spore_stalk: (p, o) => { for (const x of [9, 16, 23]) { const top = p.rng.int(6, 18); p.column(x - 1, top, 3, 44 - top, o[0], o[1], o[2]); p.ball(x, top, 3, 3, o[3], sh(o[3], 0.2), "#ffffff", false); } },
  coral: (p, o) => { for (const [x, top] of [[8, 16], [16, 6], [24, 12]] as const) { p.column(x - 2, top, 4, 44 - top, o[0], o[1], o[2]); p.line(x, top + 10, x + 6, top + 4, o[1], 2); p.line(x, top + 14, x - 6, top + 8, o[1], 2); p.ball(x, top, 2, 2, o[1], o[2], "#ffffff", false); } },
  kelp: (p, o) => { for (const x0 of [8, 15, 22]) for (let y = 4; y < 44; y++) p.rect(x0 + Math.round(Math.sin(y / 4 + x0) * 2), y, 3, 1, y % 5 ? o[1] : o[2]); },
  shell_spire: (p, o) => { for (let k = 0; k < 7; k++) p.ball(16, 40 - k * 5, 10 - k * 1.2, 4, o[0], o[1], o[2]); },
  bamboo: (p, o) => { for (const x of [6, 14, 22]) { p.column(x, 2, 4, 42, o[0], o[1], o[2]); for (let y = 8; y < 44; y += 8) p.rect(x, y, 4, 1, sh(o[0], -0.3)); p.line(x + 4, p.rng.int(6, 20), x + 9, p.rng.int(2, 18), o[2]); } },
  fern: (p, o) => { for (let k = 0; k < 9; k++) { const a = Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5); for (let t = 0; t < 16; t++) p.px(16 + Math.cos(a) * t, 44 + Math.sin(a) * t * 1.6, t % 3 ? o[1] : o[2]); } },
  bush: (p, o) => { p.ball(10, 36, 9, 8, o[0], o[1], o[2]); p.ball(22, 36, 9, 8, o[0], o[1], o[2]); p.ball(16, 30, 9, 8, o[0], o[1], o[2]); for (let i = 0; i < 4; i++) p.px(p.rng.int(6, 26), p.rng.int(26, 40), o[3]); },
  thorn: (p, o) => { for (let k = 0; k < 7; k++) { const x = p.rng.int(4, 28); p.line(16, 44, x, p.rng.int(10, 30), o[1], 2); for (let t = 0; t < 3; t++) p.px(x + p.rng.int(-2, 2), p.rng.int(14, 34), o[2]); } },
  giant_flower: (p, o) => { p.line(16, 44, 16, 18, "#3f8f3a", 2); p.ball(10, 34, 5, 2, "#2f7a2f", "#3f9a3a", "#6fcf5a", false); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.ball(16 + Math.cos(a) * 7, 14 + Math.sin(a) * 6, 5, 4, o[0], o[1], o[2]); } p.ball(16, 14, 4, 4, sh(o[3], -0.3), o[3], sh(o[3], 0.4)); },
  pillar: (p, o) => { p.column(10, 6, 12, 38, o[0], o[1], o[2]); p.rect(7, 3, 18, 4, o[2]); p.rect(7, 40, 18, 4, o[0]); for (let x = 12; x < 22; x += 3) p.rect(x, 8, 1, 32, sh(o[0], -0.1)); p.line(12, 18, 16, 24, sh(o[0], -0.4)); },
  broken_pillar: (p, o) => { p.column(10, 20, 12, 24, o[0], o[1], o[2]); for (let x = 10; x < 22; x++) p.rect(x, 18 + ((x * 7) % 5), 1, 3, o[1]); p.ball(26, 41, 4, 3, o[0], o[1], o[2]); },
  obelisk: (p, o) => { p.tri(16, 2, 8, 4, o[0], o[1], o[2]); p.column(12, 8, 9, 36, o[0], o[1], o[2]); for (let y = 12; y < 38; y += 6) p.rect(15, y, 3, 2, o[3]); },
  statue: (p, o) => { p.rect(8, 36, 16, 8, o[0]); p.rect(8, 36, 16, 2, o[2]); p.column(12, 18, 8, 18, o[0], o[1], o[2]); p.ball(16, 14, 4, 4, o[0], o[1], o[2]); p.line(20, 20, 26, 10, o[1], 2); },
  tombstone: (p, o) => { p.column(9, 18, 14, 26, o[0], o[1], o[2]); p.ball(16, 18, 7, 5, o[0], o[1], o[2], false); p.rect(15, 22, 2, 9, sh(o[0], -0.3)); p.rect(12, 25, 8, 2, sh(o[0], -0.3)); },
  bone_spire: (p, o) => { for (let k = 0; k < 8; k++) p.ball(16, 42 - k * 5, 5 - k * 0.3, 3, "#a89880", "#d8ccb4", "#fff8e8"); p.ball(16, 4, 4, 3, "#a89880", "#d8ccb4", "#fff8e8"); p.px(14, 4, "#1b1b2a"); p.px(18, 4, "#1b1b2a"); },
  ribcage: (p, o) => { p.line(4, 40, 28, 40, "#d8ccb4", 2); for (let x = 6; x < 28; x += 5) { p.line(x, 40, x + 2, 18, "#e8dcc4", 2); p.px(x + 2, 17, "#fff8e8"); } },
  vent: (p, o) => { p.ball(16, 38, 12, 6, o[0], o[1], o[2]); p.ball(16, 36, 5, 2, "#1b1b2a", "#2a2a2a", "#3a3a3a", false); p.g.fillStyle = alpha(o[3], 0.35); for (let k = 0; k < 4; k++) { p.g.beginPath(); p.g.arc(16 + k, 28 - k * 7, 3 + k, 0, Math.PI * 2); p.g.fill(); } },
  mound: (p, o) => { p.tri(16, 6, 44, 12, o[0], o[1], o[2]); for (let i = 0; i < 5; i++) p.rect(p.rng.int(8, 22), p.rng.int(14, 40), 2, 2, "#1b1b2a"); },
  hive: (p, o) => { for (let k = 0; k < 6; k++) p.ball(16, 14 + k * 5, 9 - Math.abs(k - 2.5) * 1.5, 3, o[0], o[1], o[2]); p.rect(15, 30, 3, 3, "#1b1b2a"); p.line(16, 4, 16, 10, o[3]); },
  crystal_tree: (p, o) => { p.column(14, 24, 4, 20, o[0], o[1], o[2]); for (const [x, y] of [[8, 14], [16, 8], [24, 14], [12, 20], [21, 21]]) p.tri(x, y - 6, y + 4, 3, o[0], o[1], o[2]); p.g.fillStyle = alpha(o[3], 0.25); p.g.beginPath(); p.g.arc(16, 16, 13, 0, Math.PI * 2); p.g.fill(); },
  glass_spire: (p, o) => { for (const [x, top] of [[10, 12], [18, 2], [24, 18]] as const) { p.tri(x, top, 44, 3, alpha(o[0], 0.8), alpha(o[1], 0.7), alpha("#ffffff", 0.9)); } },
  geode: (p, o) => { p.ball(16, 32, 13, 12, "#4a4a52", "#6a6a72", "#8a8a92"); p.ball(16, 32, 8, 7, o[0], o[1], o[2], false); for (let i = 0; i < 6; i++) p.px(p.rng.int(10, 22), p.rng.int(27, 37), "#ffffff"); },
  amber_tree: (p, o) => { trunk(p, 14, 24, 4, 20, bark(o)); p.ball(16, 16, 12, 11, "#a0601a", "#e09a30", "#ffd880"); p.g.fillStyle = "rgba(255,220,120,.25)"; p.g.beginPath(); p.g.arc(16, 16, 15, 0, Math.PI * 2); p.g.fill(); },
  gear: (p, o) => { p.ball(16, 26, 13, 13, o[0], o[1], o[2]); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.rect(16 + Math.cos(a) * 14 - 2, 26 + Math.sin(a) * 14 - 2, 4, 4, o[1]); } p.ball(16, 26, 4, 4, "#1b1b2a", "#2a2a2a", "#3a3a3a", false); },
  pipe: (p, o) => { p.column(6, 10, 8, 34, o[0], o[1], o[2]); p.column(18, 20, 8, 24, o[0], o[1], o[2]); p.rect(4, 10, 12, 3, o[2]); p.rect(16, 20, 12, 3, o[2]); p.rect(14, 30, 4, 4, o[1]); p.px(9, 26, o[3]); },
  scrap: (p, o) => { for (let i = 0; i < 6; i++) { const x = p.rng.int(4, 22), y = p.rng.int(22, 38); p.rect(x, y, p.rng.int(4, 9), p.rng.int(3, 7), p.rng.pick([o[0], o[1], o[2]])); } p.line(8, 40, 24, 16, o[2], 2); },
  cloud_puff: (p, o) => { p.ball(10, 30, 9, 7, o[0], o[1], o[2]); p.ball(22, 30, 9, 7, o[0], o[1], o[2]); p.ball(16, 22, 10, 8, o[0], o[1], o[2]); },
  floating_rock: (p, o) => { p.ball(16, 18, 12, 7, o[0], o[1], o[2]); p.tri(16, 22, 34, 8, o[0], sh(o[0], -0.2), o[1]); p.rect(12, 40, 8, 2, "rgba(0,0,0,.25)"); canopy(p, ["#2c6b33", "#3f8f3a", "#6fcf5a", o[3]], 16, 12, 7, 3); },
  tentacle: (p, o) => { for (let y = 44; y > 6; y--) { const t = (44 - y) / 38; const x = 16 + Math.sin(y / 5) * 6 * t; p.ball(x, y, 5 - t * 3, 1.5, o[0], o[1], o[2], false); } for (let y = 14; y < 40; y += 6) p.px(16 + Math.sin(y / 5) * 6 * ((44 - y) / 38) + 2, y, o[3]); },
  eyestalk: (p, o) => { p.line(16, 44, 16, 16, o[1], 3); p.ball(16, 12, 8, 7, "#c8c0b0", "#f0ece0", "#ffffff"); p.ball(17, 12, 4, 4, sh(o[3], -0.3), o[3], sh(o[3], 0.4), false); p.rect(17, 11, 2, 2, "#1b1b2a"); },
  lantern: (p, o) => { p.rect(15, 10, 2, 34, o[3]); p.rect(9, 8, 14, 2, o[3]); p.rect(10, 12, 12, 12, o[0]); p.rect(12, 14, 8, 8, "#fff0a0"); p.g.fillStyle = "rgba(255,220,140,.25)"; p.g.beginPath(); p.g.arc(16, 18, 13, 0, Math.PI * 2); p.g.fill(); },
  torii: (p, o) => { p.rect(8, 14, 4, 30, o[1]); p.rect(20, 14, 4, 30, o[1]); p.rect(3, 8, 26, 4, o[1]); p.rect(3, 8, 26, 1, o[2]); p.rect(6, 16, 20, 3, o[0]); },
  candle: (p, o) => { for (const [x, h] of [[9, 18], [16, 28], [23, 14]] as const) { p.column(x - 2, 44 - h, 5, h, "#c8bca0", "#e8dcc0", "#fff8e8"); p.ball(x, 42 - h, 1.5, 3, "#ff8a2a", "#ffc83a", "#fff3a0", false); } },
  book_stack: (p, o) => { for (let k = 0; k < 8; k++) p.rect(8 + (k % 3), 40 - k * 4, 16, 4, [o[0], o[1], o[3], o[2]][k % 4]); },
  clock: (p, o) => { p.column(10, 16, 12, 28, o[0], o[1], o[2]); p.ball(16, 12, 9, 9, o[0], o[1], o[2]); p.ball(16, 12, 6, 6, "#e8e0d0", "#f8f4e8", "#ffffff", false); p.line(16, 12, 16, 8, "#1b1b2a"); p.line(16, 12, 19, 13, "#1b1b2a"); },
  cage: (p, o) => { for (let x = 6; x <= 26; x += 4) p.rect(x, 12, 1, 32, o[1]); p.rect(5, 12, 23, 2, o[2]); p.rect(5, 42, 23, 2, o[0]); p.ball(16, 10, 10, 3, o[0], o[1], o[2], false); },
  salt_pillar: (p, o) => { p.column(11, 10, 10, 34, "#c8c0c0", "#ece6e6", "#ffffff"); for (let y = 12; y < 42; y += 3) p.rect(11, y, 10, 1, "#d8d0d0"); p.tri(16, 4, 10, 5, "#c8c0c0", "#ece6e6", "#ffffff"); },
  web: (p, o) => { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(16, 24, 16 + Math.cos(a) * 15, 24 + Math.sin(a) * 18, alpha("#ffffff", 0.7)); } p.g.strokeStyle = alpha("#ffffff", 0.6); for (const r of [5, 10, 15]) { p.g.beginPath(); p.g.ellipse(16, 24, r, r * 1.2, 0, 0, Math.PI * 2); p.g.stroke(); } },
  sand_dune: (p, o) => { p.ball(16, 40, 15, 8, o[0], o[1], o[2]); p.line(4, 38, 28, 36, sh(o[2], 0.3)); },
  ruin_wall: (p, o) => { for (let y = 22; y < 44; y += 5) for (let x = (y % 2 ? 2 : 5); x < 30; x += 7) { if (y < 28 && x > 18) continue; p.rect(x, y, 6, 4, o[1]); p.rect(x, y, 6, 1, o[2]); p.rect(x, y + 3, 6, 1, o[0]); } p.line(20, 22, 24, 30, "#3f8f3a"); },
  coral_tree: (p, o) => { p.column(14, 26, 4, 18, o[0], o[1], o[2]); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; p.line(16, 28, 16 + Math.cos(a) * 14, 28 + Math.sin(a) * 18, o[1], 2); p.ball(16 + Math.cos(a) * 14, 28 + Math.sin(a) * 18, 2, 2, o[1], o[2], "#ffffff", false); } },
  heart_tree: (p, o) => { trunk(p, 13, 24, 6, 20, bark(o)); p.ball(11, 14, 8, 8, o[0], o[1], o[2]); p.ball(21, 14, 8, 8, o[0], o[1], o[2]); p.tri(16, 16, 32, 13, o[0], o[1], o[2]); },
};

// ------------------------------------------------------------ liquids
const LIQ: Record<string, [string, string, string]> = {
  lava: ["#c83a1a", "#ff7a2a", "#ffe06a"], acid: ["#4a8a1a", "#8ad83a", "#e0ff8a"], void: ["#0a0614", "#2a1a4a", "#b08aff"],
  tar: ["#141214", "#2a2426", "#6a6068"], mercury: ["#8a90a0", "#c8ccd8", "#ffffff"], honey: ["#c87a1a", "#f0b030", "#fff0a0"],
  blood: ["#6a0a14", "#a01a24", "#e05a60"], cloud: ["#c8d8f0", "#e8f0fc", "#ffffff"], ink: ["#0e1024", "#1e2448", "#6a7ac0"],
  light: ["#e8d880", "#fff4c0", "#ffffff"], sand: ["#c8a060", "#e0bc80", "#fff0c8"],
};
export function liquidColors(b: Biome): [string, string, string] {
  return b.liquid && b.liquid !== "water" ? LIQ[b.liquid] ?? b.water : b.water;
}

// ------------------------------------------------------------ tile set
export interface TileSet {
  /** tiles[type][variant] — full 32x32 tiles (obstacle tiles include a small obstacle, for minimaps / fallback). */
  tiles: HTMLCanvasElement[][];
  water: HTMLCanvasElement[]; // animation frames
  /** 32x48 obstacle sprites, anchored at the bottom of the tile. */
  tall: HTMLCanvasElement[];
  /** Cliff face drawn under a wall tile when the tile below is not a wall. */
  wallFace: HTMLCanvasElement;
  /** Foam edge (top edge) drawn on liquid tiles next to land; rotate for other sides. */
  shore: HTMLCanvasElement;
  /** Jagged strip of ground drawn over the top edge of a path tile that borders ground; rotate for other sides. */
  edge: HTMLCanvasElement;
}

const sets = new Map<string, TileSet>();

export function tileSet(b: Biome): TileSet {
  const hit = sets.get(b.id);
  if (hit) return hit;
  const seed = hashString(b.id);
  const pattern = GROUNDS[b.pattern ?? defaultPattern(b)] ?? GROUNDS.grass;
  const decor = DECORS[b.decor] ?? DECORS.pebbles;
  const liquid = liquidColors(b);
  const motifs = [b.obstacle, ...(b.obstacles ?? [])].filter((m) => OBSTACLES[m]);
  if (!motifs.length) motifs.push("rock");

  const make = (fn: (p: Pen, v: number) => void) => {
    const out: HTMLCanvasElement[] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const [c, p] = canvas(TS, TS);
      p.rng = new Rng(seed + v * 7919 + out.length);
      fn(p, v);
      out.push(c);
    }
    return out;
  };
  const ground = (p: Pen, v: number) => { baseFill(p, b.ground, seed + v); pattern(p, b.ground, p.rng); };
  const tiles: HTMLCanvasElement[][] = [];
  tiles[T.GROUND] = make(ground);
  tiles[T.ALT] = make((p, v) => { baseFill(p, b.alt, seed + 99 + v, 0.8); for (let i = 0; i < 14; i++) p.px(p.rng.int(0, 31), p.rng.int(0, 31), sh(b.alt[1], -0.2)); for (let i = 0; i < 6; i++) p.rect(p.rng.int(0, 30), p.rng.int(0, 30), 2, 1, sh(b.alt[2], 0.2)); });
  tiles[T.DECOR] = make((p, v) => { ground(p, v); decor(p, b.decorColors, p.rng, b); });
  tiles[T.WALL] = make((p, v) => {
    baseFill(p, [b.wall[0], sh(b.wall[0], -0.15), b.wall[1]], seed + 300 + v, 1.2);
    for (let i = 0; i < 5; i++) { const x = p.rng.int(0, 28), y = p.rng.int(0, 28); p.rect(x, y, 4, 3, sh(b.wall[1], 0.1)); p.rect(x, y + 3, 4, 1, sh(b.wall[0], -0.3)); }
    if (v % 2) GROUNDS[b.pattern ?? "grass"]?.(p, [b.wall[0], sh(b.wall[0], -0.2), b.wall[1]], p.rng);
  });
  tiles[T.SHALLOW] = make((p, v) => {
    baseFill(p, [liquid[1], mix(liquid[1], b.ground[0], 0.35), sh(liquid[1], 0.12)], seed + 500 + v, 0.8);
    for (let i = 0; i < 4; i++) p.rect(p.rng.int(1, 26), p.rng.int(1, 30), p.rng.int(3, 6), 1, liquid[2]);
  });
  tiles[T.WATER] = make((p, v) => waterFrame(p, liquid, v, seed));
  const tall = motifs.flatMap((m, mi) => Array.from({ length: mi === 0 ? 3 : 2 }, (_, v) => {
    const [c, p] = canvas(OW, OH);
    p.rng = new Rng(seed + mi * 131 + v * 17);
    // soft contact shadow
    p.g.fillStyle = "rgba(0,0,0,.28)";
    p.g.beginPath();
    p.g.ellipse(16, BASE + 1, 12, 3.5, 0, 0, Math.PI * 2);
    p.g.fill();
    const tint = v === 1 ? 0.06 : v === 2 ? -0.06 : 0;
    const o = b.obs.map((x, i) => (i < 3 ? sh(x, tint) : x)) as [string, string, string, string];
    OBSTACLES[m](p, o, p.rng, b);
    return c;
  }));
  tiles[T.OBSTACLE] = make((p, v) => { ground(p, v); p.g.drawImage(tall[v % tall.length], 0, 0, OW, OH, 4, -6, 24, 36); });

  const water: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) { const [c, p] = canvas(TS, TS); waterFrame(p, liquid, f, seed); water.push(c); }

  const [wallFace, wp] = canvas(TS, TS);
  wp.rect(0, 0, TS, TS, sh(b.wall[0], -0.35));
  for (let x = 0; x < TS; x += 4) wp.rect(x, 0, 1, TS, sh(b.wall[0], -0.5));
  for (let y = 5; y < TS; y += 7) for (let x = (y % 2 ? 2 : 0); x < TS; x += 8) wp.rect(x, y, 5, 1, sh(b.wall[0], -0.15));
  wp.rect(0, 0, TS, 2, sh(b.wall[1], 0.1));
  const grd = wp.g.createLinearGradient(0, 0, 0, TS);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,.35)");
  wp.g.fillStyle = grd;
  wp.g.fillRect(0, 0, TS, TS);

  const [shore, sp] = canvas(TS, TS);
  for (let x = 0; x < TS; x++) {
    const h = 2 + Math.round((Math.sin(x / 3) + 1) * 1);
    sp.rect(x, 0, 1, h, alpha(liquid[2], 0.85));
    sp.px(x, h, alpha(liquid[2], 0.4));
  }
  const [edge, ep] = canvas(TS, TS);
  ep.g.drawImage(tiles[T.GROUND][0], 0, 0);
  ep.g.globalCompositeOperation = "destination-in";
  for (let x = 0; x < TS; x++) {
    const h = 3 + Math.round((Math.sin(x * 0.7 + seed) + Math.sin(x * 0.23 + seed * 3) + 2) * 1.2);
    ep.g.fillStyle = "#000";
    ep.g.fillRect(x, 0, 1, h);
  }
  ep.g.globalCompositeOperation = "source-over";
  const set: TileSet = { tiles, water, tall, wallFace, shore, edge };
  sets.set(b.id, set);
  return set;
}

function waterFrame(p: Pen, liquid: [string, string, string], f: number, seed: number) {
  const n = noise2(seed ^ 0xabc);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x + f * 2, y + Math.sin((x + f * 4) / 6) * 2) + (bayer(x, y) - 0.5) * 0.15;
    p.px(x, y, v > 0.62 ? liquid[1] : v < 0.3 ? sh(liquid[0], -0.12) : liquid[0]);
  }
  const r = new Rng(seed + 77);
  for (let i = 0; i < 5; i++) {
    const x = (r.int(0, 31) + f * 3) % 32, y = r.int(2, 29);
    p.rect(x, y, 5, 1, liquid[2]);
    p.rect((x + 2) % 32, y + 1, 2, 1, liquid[1]);
  }
}

function defaultPattern(b: Biome): string {
  const map: Record<string, string> = {
    flowers: "grass", grass: "grass", pebbles: "rock", bones: "sand", reeds: "mud", snow: "snow", embers: "ash",
    sparkles: "crystal", leaves: "leaves", shells: "sand", glow: "moss",
  };
  return map[b.decor] ?? "grass";
}

/** Height (in tiles) that obstacle sprites rise above their tile. */
export const TALL_EXTRA = (OH - TS) / TS;
