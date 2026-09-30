import { Rng, hashString } from "../core/rng";
import { outline } from "./palette";

/**
 * Procedural 32x32 creature sprites. A creature is a body plan (quadruped, bird, serpent,
 * golem...) plus colours and a seed that decides horns, spikes, wings, patterns and eyes.
 * Sprites are shaded from the upper left and get an automatic dark outline.
 */

export const PLANS = [
  "blob", "quad", "biped", "bird", "insect", "spider", "serpent", "fish", "crab", "plant", "golem", "ghost",
  "eye", "jelly", "dragon", "worm", "bat", "fungus", "knight", "elemental", "skeleton", "beetle", "frog", "turtle",
  "mech", "treant", "wolf", "cat", "bear", "deer", "lizard", "scorpion", "moth", "wraith", "mimic", "hydra",
] as const;
export type Plan = (typeof PLANS)[number];

type Col = string | null;
const S = 32;

function hx(c: string): [number, number, number] {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function sh(c: string, f: number): string {
  const [r, g, b] = hx(c);
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return "#" + [t(r), t(g), t(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

class Grid {
  g: Col[][] = Array.from({ length: S }, () => Array<Col>(S).fill(null));
  constructor(public rng: Rng) {}
  px(x: number, y: number, c: Col) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < S && y < S) this.g[y][x] = c;
  }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < S && y < S ? this.g[y][x] : null; }
  rect(x: number, y: number, w: number, h: number, c: Col) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
  /** Shaded ellipse lit from the upper left. */
  ball(cx: number, cy: number, rx: number, ry: number, base: string, lightF = 0.35, darkF = -0.35) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / Math.max(0.5, rx), dy = (y + 0.5 - cy) / Math.max(0.5, ry);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const lit = -dx * 0.55 - dy * 0.75 + (1 - d) * 0.5 + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 0.35;
      this.px(x, y, lit > 0.8 ? sh(base, lightF) : lit > 0.1 ? base : sh(base, darkF));
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.px(x + a - Math.floor(t / 2), y + b - Math.floor(t / 2), c);
    }
  }
  /** Tapered limb from (x0,y0) to (x1,y1). */
  limb(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.ball(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t, w0 + (w1 - w0) * t, c, 0.2, -0.3);
    }
  }
  eye(x: number, y: number, col: string, big = false) {
    if (big) { this.rect(x - 1, y - 1, 3, 3, "#ffffff"); this.rect(x, y, 2, 2, col); this.px(x, y, "#1b1b2a"); this.px(x - 1, y - 1, "#ffffff"); }
    else { this.px(x, y, col); this.px(x, y - 1, sh(col, 0.6)); }
  }
  mirror() { for (let y = 0; y < S; y++) for (let x = 0; x < S / 2; x++) this.g[y][S - 1 - x] = this.g[y][x]; }
  flipCopyOnto() { /* keep asymmetric */ }
}

export interface CreatureSpec {
  plan: Plan | string;
  c: string; // main colour
  c2?: string; // accent colour
  eye?: string;
  seed: number;
  boss?: boolean;
  /** Element of the floor: flames, frost spikes, sparks, drips... */
  el?: string;
  /** Material family of the floor: mushrooms, coral, bone plates, crystals, vines... */
  fam?: string;
}

// ------------------------------------------------------------ regional features
/** Top-most filled pixel per column (-1 when empty) and the body's filled pixels. */
function silhouette(g: Grid) {
  const top: number[] = [], bottom: number[] = [];
  const body: [number, number][] = [];
  for (let x = 0; x < S; x++) {
    top[x] = -1; bottom[x] = -1;
    for (let y = 0; y < S; y++) if (g.g[y][x]) { if (top[x] < 0) top[x] = y; bottom[x] = y; body.push([x, y]); }
  }
  return { top, bottom, body };
}

const EL_FX: Record<string, (g: Grid, r: Rng) => void> = {
  fire: (g, r) => {
    const { top } = silhouette(g);
    for (let x = 1; x < S - 1; x++) {
      if (top[x] < 3 || !r.chance(0.35)) continue;
      const h = r.int(2, 4);
      for (let k = 1; k <= h; k++) g.px(x, top[x] - k, k === h ? "#fff0a0" : k > h / 2 ? "#ffb02a" : "#ff5a1a");
    }
  },
  ice: (g, r) => {
    const { top } = silhouette(g);
    for (let x = 2; x < S - 2; x += r.int(3, 5)) {
      if (top[x] < 4) continue;
      const h = r.int(2, 4);
      for (let k = 0; k < h; k++) { g.px(x, top[x] - 1 - k, k === h - 1 ? "#ffffff" : "#a8e0ff"); if (k === 0) { g.px(x - 1, top[x] - 1, "#6ab8e8"); g.px(x + 1, top[x] - 1, "#6ab8e8"); } }
    }
  },
  lightning: (g, r) => {
    for (let i = 0; i < 3; i++) {
      let x = r.int(2, S - 3), y = r.int(2, 10);
      for (let k = 0; k < 5; k++) { g.px(x, y, k % 2 ? "#fff6a0" : "#ffd23a"); x += r.pick([-1, 1]); y++; }
    }
  },
  water: (g, r) => {
    const { bottom } = silhouette(g);
    for (let x = 3; x < S - 3; x += r.int(4, 7)) if (bottom[x] > 0 && bottom[x] < S - 3) { g.px(x, bottom[x] + 1, "#6ac0ff"); g.px(x, bottom[x] + 2, "#a8e0ff"); }
  },
  earth: (g, r) => {
    const { body } = silhouette(g);
    for (let i = 0; i < 6 && body.length; i++) { const [x, y] = r.pick(body); g.px(x, y, "#7a6040"); g.px(x + 1, y, "#9a7a50"); g.px(x, y + 1, "#5a4a30"); }
  },
  wind: (g, r) => {
    for (let i = 0; i < 3; i++) { const y = r.int(8, 26), x0 = r.int(0, 4); for (let k = 0; k < r.int(4, 7); k++) g.px(x0 + k, y + (k > 3 ? -1 : 0), "#e6fff0"); }
  },
  light: (g, r) => {
    const { top } = silhouette(g);
    const ys = top.filter((y) => y >= 0);
    const t = Math.max(1, Math.min(...ys) - 3);
    for (let x = 11; x <= 21; x++) if (x < 13 || x > 19 || r.chance(0.9)) g.px(x, t + (x === 11 || x === 21 ? 1 : 0), "#fff6b0");
  },
  dark: (g, r) => {
    const { bottom } = silhouette(g);
    for (let x = 2; x < S - 2; x++) if (bottom[x] > 0 && r.chance(0.4)) for (let k = 1; k <= r.int(1, 3); k++) g.px(x + r.int(-1, 1), Math.min(S - 1, bottom[x] + k - 3), k === 1 ? "#5a2a8a" : "#3a1a5a");
  },
  poison: (g, r) => {
    const { bottom, body } = silhouette(g);
    for (let x = 3; x < S - 3; x += r.int(3, 6)) if (bottom[x] > 0 && bottom[x] < S - 3) { g.px(x, bottom[x] + 1, "#8be04e"); g.px(x, bottom[x] + 2, "#5aa82a"); }
    for (let i = 0; i < 3 && body.length; i++) { const [x, y] = r.pick(body); g.px(x, y, "#b8ff6a"); }
  },
  arcane: (g, r) => {
    for (let i = 0; i < 4; i++) { const x = r.int(1, S - 2), y = r.int(1, 14); if (g.get(x, y)) continue; g.px(x, y, "#ff8cf0"); g.px(x + 1, y, "#ffc8f8"); g.px(x, y + 1, "#c85ac0"); }
  },
};

const FAM_FX: Record<string, (g: Grid, r: Rng) => void> = {
  fungal: (g, r) => { const { top } = silhouette(g); for (let x = 3; x < S - 4; x += r.int(5, 9)) if (top[x] > 3) { g.rect(x - 1, top[x] - 2, 4, 2, "#c83a5a"); g.px(x, top[x] - 2, "#ffffff"); g.px(x, top[x] - 1 + 1, "#e8dcc0"); } },
  crystal: (g, r) => { const { top } = silhouette(g); for (let i = 0; i < 3; i++) { const x = r.int(5, S - 6); if (top[x] < 4) continue; for (let k = 0; k < 4; k++) g.px(x + (k > 1 ? 1 : 0), top[x] - k, k < 2 ? "#b88aff" : "#e8d8ff"); } },
  bonewaste: (g, r) => { const { body } = silhouette(g); const ys = [...new Set(body.map(([, y]) => y))]; for (const y of ys.filter((_, i) => i % 4 === 2)) for (const [x, yy] of body) if (yy === y && r.chance(0.7)) g.px(x, y, "#e8e0cc"); },
  volcano: (g, r) => { const { body } = silhouette(g); for (let i = 0; i < 4 && body.length; i++) { let [x, y] = r.pick(body); for (let k = 0; k < 4; k++) { if (g.get(x, y)) g.px(x, y, k % 2 ? "#ffb02a" : "#ff5a1a"); x += r.int(-1, 1); y += 1; } } },
  reef: (g, r) => { const { top } = silhouette(g); for (let i = 0; i < 2; i++) { const x = r.int(6, S - 7); if (top[x] < 5) continue; g.line(x, top[x], x, top[x] - 4, "#ff7a8a"); g.line(x, top[x] - 2, x - 2, top[x] - 4, "#ff7a8a"); g.line(x, top[x] - 3, x + 2, top[x] - 5, "#ffb0b8"); } },
  sakura: (g, r) => { for (let i = 0; i < 6; i++) { const x = r.int(1, S - 2), y = r.int(1, S - 2); if (!g.get(x, y)) { g.px(x, y, "#ffb8d8"); g.px(x + 1, y, "#ff8ab8"); } } },
  jungle: (g, r) => { const { bottom } = silhouette(g); for (let x = 4; x < S - 4; x += r.int(5, 8)) if (bottom[x] > 0) for (let k = 0; k < r.int(2, 5); k++) g.px(x + (k % 2), Math.max(0, bottom[x] - 6 + k * 2), "#3a8a2a"); },
  ruins: (g, r) => { const { body } = silhouette(g); const ys = [...new Set(body.map(([, y]) => y))]; const band = ys[Math.floor(ys.length * 0.45)]; for (const [x, y] of body) if (y === band || y === band + 1) g.px(x, y, y === band ? "#a8a8b8" : "#6a6a7a"); void r; },
  tundra: (g, r) => { const { top } = silhouette(g); for (let x = 0; x < S; x++) if (top[x] >= 0 && r.chance(0.5)) g.px(x, top[x], "#ffffff"); },
  glacier: (g, r) => { const { top } = silhouette(g); for (let x = 0; x < S; x++) if (top[x] >= 0 && r.chance(0.6)) { g.px(x, top[x], "#e8f8ff"); if (r.chance(0.3)) g.px(x, top[x] + 1, "#a8d8f0"); } },
  autumn: (g, r) => { for (let i = 0; i < 5; i++) { const x = r.int(1, S - 2), y = r.int(1, S - 2); if (!g.get(x, y)) g.px(x, y, r.pick(["#e8702a", "#c8401a", "#f2b52a"])); } },
  bamboo: (g, r) => { const { body } = silhouette(g); for (const [x, y] of body) if (y % 5 === 0 && r.chance(0.6)) g.px(x, y, "#4a7a2a"); },
  desert: (g, r) => { const { body } = silhouette(g); const ys = [...new Set(body.map(([, y]) => y))]; for (const y of ys.filter((_, i) => i % 5 === 1)) for (const [x, yy] of body) if (yy === y && r.chance(0.8)) g.px(x, y, "#d8c8a0"); },
  swamp: (g, r) => { const { top } = silhouette(g); for (let x = 2; x < S - 2; x++) if (top[x] >= 0 && r.chance(0.3)) { g.px(x, top[x], "#5a8a3a"); g.px(x, top[x] + 1, "#3a6a2a"); } },
  forest: (g, r) => { for (let i = 0; i < 3; i++) { const x = r.int(2, S - 3), y = r.int(2, 12); if (!g.get(x, y)) { g.px(x, y, "#4a9a3a"); g.px(x + 1, y + 1, "#2c6b33"); } } },
};

type Drawer = (g: Grid, c: string, a: string, e: string, r: Rng) => void;

const horns = (g: Grid, x: number, y: number, a: string, r: Rng, kind = r.int(0, 3)) => {
  if (kind === 0) return;
  if (kind === 1) { g.line(x - 3, y, x - 5, y - 5, a, 2); g.line(x + 3, y, x + 5, y - 5, a, 2); }
  if (kind === 2) { g.line(x - 2, y, x - 6, y - 2, a, 2); g.line(x - 6, y - 2, x - 6, y - 6, a); g.line(x + 2, y, x + 6, y - 2, a, 2); g.line(x + 6, y - 2, x + 6, y - 6, a); }
  if (kind === 3) { g.line(x, y - 1, x, y - 6, a, 2); }
};
const spikes = (g: Grid, x0: number, x1: number, y: number, a: string, r: Rng) => { for (let x = x0; x <= x1; x += 3) g.line(x, y, x + r.int(-1, 1), y - r.int(2, 4), a); };
const pattern = (g: Grid, x0: number, y0: number, x1: number, y1: number, a: string, r: Rng) => {
  const kind = r.int(0, 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!g.get(x, y)) continue;
    if (kind === 1 && (x + y) % 6 === 0 && r.chance(0.7)) g.px(x, y, a);
    if (kind === 2 && x % 5 === 0 && y % 4 === 0) { g.px(x, y, a); g.px(x + 1, y, a); }
  }
};
const wings = (g: Grid, cx: number, cy: number, w: number, h: number, c: string) => {
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    for (let i = 0; i < w; i++) {
      const top = cy - h + Math.round((i / w) * h * 0.5);
      g.line(cx + s * (3 + i), top, cx + s * (3 + i), cy + Math.round((1 - i / w) * 3), i % 3 === 0 ? sh(c, -0.3) : c);
    }
  }
};

const D: Record<string, Drawer> = {
  blob: (g, c, a, e, r) => { g.ball(16, 22, 12, 9, c); g.ball(12, 18, 4, 3, sh(c, 0.35), 0.3); g.eye(12, 21, e, true); g.eye(20, 21, e, true); g.rect(14, 25, 4, 1, sh(c, -0.5)); if (r.chance(0.5)) horns(g, 16, 14, a, r); },
  quad: (g, c, a, e, r) => { for (const x of [7, 11, 20, 24]) g.limb(x, 20, x - 1, 29, 1.8, 1.4, sh(c, -0.1)); g.ball(16, 18, 11, 6, c); g.ball(26, 13, 5, 4, c); g.rect(29, 14, 2, 2, sh(c, -0.4)); g.eye(27, 12, e); horns(g, 26, 9, a, r); g.line(5, 16, 1, 12 + r.int(0, 6), c, 2); spikes(g, 9, 21, 12, a, r); pattern(g, 6, 13, 26, 23, a, r); },
  wolf: (g, c, a, e, r) => { for (const x of [7, 11, 20, 24]) g.limb(x, 19, x, 29, 1.6, 1.2, sh(c, -0.12)); g.ball(15, 18, 10, 5, c); g.ball(25, 13, 5, 4, c); g.limb(27, 14, 31, 15, 2, 1, c); g.px(31, 15, "#1b1b2a"); g.line(22, 9, 23, 5, c, 2); g.line(26, 9, 27, 5, c, 2); g.eye(26, 12, e); g.limb(5, 16, 1, 10, 2, 1, sh(c, 0.2)); g.ball(15, 20, 7, 2, sh(c, 0.3)); if (r.chance(0.4)) spikes(g, 10, 20, 13, a, r); },
  cat: (g, c, a, e, r) => { for (const x of [8, 12, 20, 24]) g.limb(x, 20, x, 29, 1.4, 1.1, c); g.ball(16, 18, 10, 5, c); g.ball(25, 12, 5, 5, c); g.line(22, 7, 22, 4, c, 2); g.line(28, 7, 28, 4, c, 2); g.eye(24, 12, e, true); g.eye(28, 12, e); g.limb(6, 17, 2, 6, 1.5, 1, c); pattern(g, 6, 13, 30, 23, a, r); },
  bear: (g, c, a, e, r) => { for (const x of [7, 12, 20, 25]) g.limb(x, 20, x, 29, 2.4, 2, sh(c, -0.12)); g.ball(16, 17, 12, 8, c); g.ball(24, 11, 6, 5, c); g.ball(21, 6, 2, 2, c); g.ball(27, 6, 2, 2, c); g.ball(27, 13, 3, 2, sh(c, 0.3)); g.px(29, 12, "#1b1b2a"); g.eye(24, 10, e); horns(g, 24, 7, a, r, r.int(0, 1)); },
  deer: (g, c, a, e, r) => { for (const x of [9, 12, 20, 23]) g.limb(x, 19, x, 30, 1.2, 1, sh(c, -0.1)); g.ball(16, 17, 9, 5, c); g.limb(23, 15, 26, 8, 2, 1.6, c); g.ball(27, 8, 3, 3, c); g.eye(27, 7, e); g.line(26, 5, 22, 0, a); g.line(24, 3, 21, 3, a); g.line(28, 5, 30, 0, a); g.line(29, 2, 31, 3, a); for (let i = 0; i < 5; i++) g.px(r.int(10, 21), r.int(14, 18), "#ffffff"); },
  lizard: (g, c, a, e, r) => { for (const x of [9, 20]) { g.limb(x, 21, x - 3, 27, 1.3, 1, c); g.limb(x + 2, 21, x + 5, 27, 1.3, 1, c); } g.ball(16, 20, 9, 4, c); g.ball(26, 17, 5, 3, c); g.eye(27, 16, e); g.limb(7, 21, 1, 25, 2.5, 0.6, c); spikes(g, 9, 22, 16, a, r); pattern(g, 7, 17, 30, 24, a, r); },
  biped: (g, c, a, e, r) => { g.limb(12, 22, 11, 30, 2, 1.6, sh(c, -0.1)); g.limb(20, 22, 21, 30, 2, 1.6, sh(c, -0.1)); g.ball(16, 17, 7, 7, c); g.limb(9, 13, 5, 23, 1.8, 1.4, c); g.limb(23, 13, 27, 23, 1.8, 1.4, c); g.ball(16, 7, 5, 5, c); g.eye(14, 7, e); g.eye(18, 7, e); horns(g, 16, 3, a, r); g.rect(12, 20, 9, 2, a); },
  bird: (g, c, a, e, r) => { g.limb(13, 23, 12, 30, 0.8, 0.6, a); g.limb(18, 23, 19, 30, 0.8, 0.6, a); wings(g, 16, 16, 12, 9, sh(c, -0.1)); g.ball(16, 17, 6, 7, c); g.ball(16, 8, 4, 4, c); g.rect(19, 8, 4, 2, a); g.px(22, 9, sh(a, -0.4)); g.eye(17, 7, e); g.line(16, 4, 14, 1, a); g.line(12, 24, 16, 28, sh(c, -0.2), 2); },
  bat: (g, c, a, e, r) => { wings(g, 16, 14, 13, 10, sh(c, -0.2)); g.ball(16, 15, 5, 6, c); g.line(13, 9, 12, 5, c, 2); g.line(19, 9, 20, 5, c, 2); g.eye(14, 13, e, true); g.eye(18, 13, e, true); g.px(15, 18, "#ffffff"); g.px(17, 18, "#ffffff"); },
  moth: (g, c, a, e, r) => { for (const s of [-1, 1]) { g.ball(16 + s * 8, 12, 7, 6, a); g.ball(16 + s * 7, 21, 5, 4, sh(a, -0.15)); g.ball(16 + s * 9, 12, 2, 2, c); } g.ball(16, 17, 3, 8, c); g.line(15, 9, 12, 3, c); g.line(17, 9, 20, 3, c); g.eye(15, 11, e); g.eye(17, 11, e); },
  insect: (g, c, a, e, r) => { for (const y of [18, 21, 24]) { g.line(12, y, 6, y + 4, sh(c, -0.3)); g.line(20, y, 26, y + 4, sh(c, -0.3)); } g.ball(16, 24, 6, 6, c); g.ball(16, 16, 4, 4, c); g.ball(16, 10, 4, 3, c); g.eye(14, 10, e, true); g.eye(18, 10, e, true); g.line(14, 7, 11, 2, a); g.line(18, 7, 21, 2, a); if (r.chance(0.5)) wings(g, 16, 17, 8, 6, sh("#c8e8ff", -0.1)); pattern(g, 10, 19, 22, 30, a, r); },
  beetle: (g, c, a, e, r) => { for (const y of [19, 23, 27]) { g.line(10, y, 4, y + 3, sh(c, -0.4)); g.line(22, y, 28, y + 3, sh(c, -0.4)); } g.ball(16, 22, 9, 9, c, 0.5); g.line(16, 14, 16, 30, sh(c, -0.4)); g.ball(16, 11, 5, 3, sh(c, -0.2)); g.line(16, 9, 16, 2, a, 2); g.line(16, 3, 13, 5, a); g.eye(13, 11, e); g.eye(19, 11, e); },
  spider: (g, c, a, e, r) => { for (let k = 0; k < 4; k++) { g.line(12, 18 + k, 3 - k, 12 + k * 5, sh(c, -0.3)); g.line(20, 18 + k, 29 + k, 12 + k * 5, sh(c, -0.3)); } g.ball(16, 24, 8, 6, c); g.ball(16, 16, 5, 4, c); for (const [x, y] of [[14, 15], [18, 15], [13, 17], [19, 17]]) g.px(x, y, e); pattern(g, 9, 19, 23, 30, a, r); },
  scorpion: (g, c, a, e, r) => { for (let k = 0; k < 3; k++) { g.line(11, 22 + k * 2, 5, 27 + k, sh(c, -0.3)); g.line(21, 22 + k * 2, 27, 27 + k, sh(c, -0.3)); } g.ball(16, 23, 7, 5, c); for (let i = 0; i < 5; i++) g.ball(16 + Math.sin(i) * 2, 17 - i * 3, 2.5, 2, c); g.line(18, 3, 22, 6, a, 2); g.ball(7, 17, 3, 2, c); g.ball(25, 17, 3, 2, c); g.eye(14, 21, e); g.eye(18, 21, e); },
  serpent: (g, c, a, e, r) => { for (let i = 0; i < 26; i++) { const t = i / 26; g.ball(4 + i, 24 + Math.sin(i / 3) * 3 - t * 10, 3.5 - t, 3.5 - t, i % 4 ? c : sh(c, -0.1)); } g.ball(27, 10, 5, 4, c); g.eye(28, 9, e, true); g.line(31, 12, 32, 14, "#e04a4a"); if (r.chance(0.5)) { g.line(24, 6, 22, 2, a, 2); g.line(28, 6, 30, 2, a, 2); } pattern(g, 3, 12, 30, 30, a, r); },
  worm: (g, c, a, e, r) => { for (let i = 0; i < 7; i++) g.ball(16, 30 - i * 3.5, 6 - i * 0.2, 3, i % 2 ? c : sh(c, 0.1)); g.ball(16, 6, 6, 5, sh(c, -0.1)); g.ball(16, 6, 4, 3, "#3a0a14", 0, 0); for (let i = 0; i < 8; i++) g.px(12 + i, 4 + (i % 2) * 3, "#ffffff"); },
  fish: (g, c, a, e, r) => { g.ball(15, 17, 11, 7, c); g.line(4, 17, 0, 11, a, 3); g.line(4, 17, 0, 23, a, 3); g.line(14, 10, 18, 5, a, 2); g.ball(15, 20, 8, 3, sh(c, 0.3)); g.eye(22, 15, e, true); g.line(25, 19, 27, 19, "#1b1b2a"); pattern(g, 5, 11, 25, 23, a, r); },
  crab: (g, c, a, e, r) => { for (let k = 0; k < 3; k++) { g.line(10, 22 + k, 3, 27 + k * 2, sh(c, -0.3)); g.line(22, 22 + k, 29, 27 + k * 2, sh(c, -0.3)); } g.ball(16, 21, 10, 6, c); g.limb(8, 18, 4, 11, 1.6, 1.4, c); g.ball(4, 9, 3, 3, a); g.limb(24, 18, 28, 11, 1.6, 1.4, c); g.ball(28, 9, 3, 3, a); g.line(13, 16, 13, 12, c); g.line(19, 16, 19, 12, c); g.eye(13, 11, e, true); g.eye(19, 11, e, true); },
  frog: (g, c, a, e, r) => { g.limb(7, 26, 3, 30, 2, 1.4, c); g.limb(25, 26, 29, 30, 2, 1.4, c); g.ball(16, 21, 11, 8, c); g.ball(10, 12, 4, 4, c); g.ball(22, 12, 4, 4, c); g.eye(10, 12, e, true); g.eye(22, 12, e, true); g.line(9, 22, 23, 22, sh(c, -0.5)); g.ball(16, 25, 7, 3, sh(c, 0.35)); pattern(g, 6, 14, 26, 28, a, r); },
  turtle: (g, c, a, e, r) => { for (const x of [8, 22]) { g.limb(x, 24, x - 2, 29, 2, 1.6, a); g.limb(x + 2, 24, x + 4, 29, 2, 1.6, a); } g.ball(26, 21, 4, 3, a); g.eye(27, 20, e); g.ball(15, 19, 12, 9, c, 0.4); for (const [x, y] of [[10, 16], [16, 13], [20, 18], [13, 21]]) g.ball(x, y, 3, 2, sh(c, -0.25), 0.2, -0.2); spikes(g, 7, 23, 11, sh(c, 0.3), r); },
  plant: (g, c, a, e, r) => { g.line(16, 31, 16, 16, sh(c, -0.3), 3); for (const s of [-1, 1]) g.ball(16 + s * 7, 24, 6, 3, sh(c, -0.1)); g.ball(16, 11, 9, 8, a); g.ball(16, 13, 6, 4, "#3a0a14", 0, 0); for (let i = 0; i < 6; i++) g.px(11 + i * 2, 11, "#ffffff"); g.eye(12, 7, e); g.eye(20, 7, e); },
  fungus: (g, c, a, e, r) => { g.ball(16, 25, 6, 6, "#e8dcc0", 0.2); g.ball(16, 13, 13, 8, c); for (let i = 0; i < 6; i++) g.ball(r.int(7, 25), r.int(8, 15), 1.5, 1.2, a, 0, 0); g.eye(13, 24, e); g.eye(19, 24, e); g.line(10, 30, 8, 31, "#e8dcc0", 2); g.line(22, 30, 24, 31, "#e8dcc0", 2); },
  treant: (g, c, a, e, r) => { g.limb(11, 22, 8, 31, 3, 2.5, sh(c, -0.2)); g.limb(21, 22, 24, 31, 3, 2.5, sh(c, -0.2)); g.ball(16, 18, 8, 9, c); g.limb(9, 14, 3, 6, 2, 1, c); g.limb(23, 14, 29, 6, 2, 1, c); g.ball(16, 6, 12, 6, a); g.ball(9, 5, 5, 4, a); g.ball(23, 5, 5, 4, a); g.eye(13, 15, e, true); g.eye(19, 15, e, true); g.line(13, 21, 19, 21, sh(c, -0.5)); },
  golem: (g, c, a, e, r) => { g.rect(9, 23, 5, 8, sh(c, -0.1)); g.rect(18, 23, 5, 8, sh(c, -0.1)); g.ball(16, 17, 10, 8, c, 0.3); g.ball(5, 18, 4, 6, c); g.ball(27, 18, 4, 6, c); g.ball(16, 7, 5, 4, c); g.eye(14, 7, e, true); g.eye(18, 7, e, true); for (let i = 0; i < 4; i++) g.line(r.int(9, 22), r.int(11, 22), r.int(9, 22), r.int(11, 22), sh(c, -0.4)); g.ball(16, 16, 2, 2, a, 0.6); },
  mech: (g, c, a, e, r) => { g.rect(10, 23, 4, 8, sh(c, -0.2)); g.rect(18, 23, 4, 8, sh(c, -0.2)); g.rect(8, 11, 16, 13, c); g.rect(8, 11, 16, 2, sh(c, 0.3)); g.rect(4, 13, 4, 10, sh(c, -0.1)); g.rect(24, 13, 4, 10, sh(c, -0.1)); g.rect(11, 4, 10, 7, c); g.rect(12, 6, 8, 2, e); g.rect(14, 15, 4, 4, a); g.line(16, 4, 16, 0, a); for (const [x, y] of [[9, 12], [22, 12], [9, 22], [22, 22]]) g.px(x, y, "#1b1b2a"); },
  knight: (g, c, a, e, r) => { g.limb(12, 22, 11, 30, 2.2, 2, sh(c, -0.1)); g.limb(20, 22, 21, 30, 2.2, 2, sh(c, -0.1)); g.ball(16, 16, 7, 8, c, 0.45); g.ball(16, 6, 5, 5, c, 0.5); g.rect(12, 6, 9, 2, "#1b1b2a"); g.px(14, 6, e); g.px(18, 6, e); g.line(16, 1, 16, -1, a, 2); g.limb(9, 13, 6, 22, 2, 1.6, c); g.line(24, 8, 28, 28, "#c8ccd8", 2); g.rect(22, 18, 5, 2, a); g.ball(6, 18, 4, 6, a, 0.3); },
  skeleton: (g, c, a, e, r) => { const b = "#e8e0cc"; g.line(12, 22, 11, 30, b, 2); g.line(20, 22, 21, 30, b, 2); g.line(16, 12, 16, 22, b, 2); for (let y = 13; y < 21; y += 2) g.line(12, y, 20, y, b); g.line(12, 13, 7, 22, b, 2); g.line(20, 13, 25, 22, b, 2); g.ball(16, 7, 5, 5, b, 0.3); g.rect(13, 7, 2, 2, e); g.rect(17, 7, 2, 2, e); g.rect(14, 11, 4, 1, "#1b1b2a"); g.ball(16, 22, 5, 2, c); g.line(25, 22, 28, 6, a, 2); },
  ghost: (g, c, a, e, r) => { g.ball(16, 13, 10, 10, c, 0.5); g.rect(6, 13, 21, 10, c); for (let x = 6; x < 27; x += 4) g.ball(x + 2, 24, 2, 3, c); g.eye(12, 12, e, true); g.eye(20, 12, e, true); g.ball(16, 18, 2, 2, "#1b1b2a", 0, 0); g.limb(6, 15, 2, 20, 2, 1, c); g.limb(26, 15, 30, 20, 2, 1, c); },
  wraith: (g, c, a, e, r) => { for (let y = 10; y < 31; y++) { const w = 3 + (y - 10) * 0.45; g.rect(16 - w + Math.sin(y / 3) * 2, y, w * 2, 1, y % 3 ? c : sh(c, -0.2)); } g.ball(16, 9, 6, 6, sh(c, -0.4), 0, 0); g.eye(14, 9, e); g.eye(18, 9, e); g.line(8, 16, 3, 22, sh(c, 0.2), 2); g.line(24, 16, 30, 10, sh(c, 0.2), 2); g.line(30, 10, 30, 30, a); },
  eye: (g, c, a, e, r) => { for (let k = 0; k < 6; k++) { const ang = (k / 6) * Math.PI * 2; g.line(16, 16, 16 + Math.cos(ang) * 14, 16 + Math.sin(ang) * 14, sh(c, -0.3), 2); } g.ball(16, 16, 10, 10, "#f0ece0", 0.3); g.ball(17, 15, 6, 6, e, 0.4); g.ball(17, 15, 3, 3, "#1b1b2a", 0, 0); g.px(15, 13, "#ffffff"); g.px(16, 13, "#ffffff"); },
  jelly: (g, c, a, e, r) => { g.ball(16, 11, 11, 8, c, 0.5); g.rect(5, 11, 23, 4, c); for (let x = 7; x < 26; x += 3) for (let y = 15; y < 31; y++) g.px(x + Math.round(Math.sin((y + x) / 3)), y, y % 3 ? sh(c, -0.1) : a); g.eye(12, 11, e); g.eye(20, 11, e); },
  elemental: (g, c, a, e, r) => { for (let y = 2; y < 31; y++) { const w = Math.sin((y / 30) * Math.PI) * 11 + r.int(-1, 1); for (let x = -w; x <= w; x++) { const d = Math.abs(x) / Math.max(1, w); g.px(16 + x, y, d < 0.35 ? sh(c, 0.6) : d < 0.7 ? c : sh(c, -0.25)); } } g.eye(13, 13, "#ffffff", true); g.eye(19, 13, "#ffffff", true); g.rect(14, 19, 5, 1, sh(c, -0.5)); },
  dragon: (g, c, a, e, r) => { wings(g, 13, 14, 12, 11, sh(c, -0.25)); for (const x of [9, 20]) g.limb(x, 22, x, 30, 2.4, 2, sh(c, -0.1)); g.ball(15, 20, 9, 6, c); g.limb(6, 22, 0, 28, 3, 1, c); g.limb(21, 16, 25, 9, 3, 2.4, c); g.ball(27, 8, 5, 4, c); g.rect(30, 9, 2, 2, sh(c, -0.3)); g.eye(28, 7, e, true); horns(g, 27, 5, a, r, 2); spikes(g, 9, 21, 15, a, r); g.ball(15, 22, 6, 2, sh(a, 0.3)); },
  hydra: (g, c, a, e, r) => { g.ball(16, 24, 11, 7, c); for (const [x, t] of [[6, 4], [16, 0], [26, 4]] as const) { g.limb(16 + (x - 16) * 0.3, 20, x, t + 6, 2.2, 1.8, c); g.ball(x, t + 5, 3.5, 3, c); g.eye(x + 1, t + 4, e); } spikes(g, 8, 24, 18, a, r); },
  mimic: (g, c, a, e, r) => { g.rect(5, 16, 22, 14, c); g.rect(5, 16, 22, 2, sh(c, 0.3)); g.rect(5, 8, 22, 6, c); g.rect(5, 8, 22, 1, sh(c, 0.3)); g.rect(5, 14, 22, 2, "#3a0a14"); for (let x = 6; x < 26; x += 3) { g.px(x, 14, "#ffffff"); g.px(x + 1, 15, "#ffffff"); } g.rect(14, 18, 4, 4, a); g.eye(10, 11, e, true); g.eye(22, 11, e, true); g.line(27, 15, 31, 20, "#e04a6a", 2); },
};

// ------------------------------------------------------------ public API
const cache = new Map<string, HTMLCanvasElement>();
const smallCache = new Map<string, HTMLCanvasElement>();

/**
 * 16x16 version for the map, made by picking the dominant colour of every 2x2 block so the
 * sprite sits on the same pixel grid as the terrain. Outlines and eyes win ties so the
 * silhouette and face survive the reduction.
 */
export function creatureSmall(s: CreatureSpec): HTMLCanvasElement {
  const key = creatureKey(s);
  const hit = smallCache.get(key);
  if (hit) return hit;
  const big = creatureCanvas(s);
  const data = big.getContext("2d")!.getImageData(0, 0, 32, 32).data;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  const col = (x: number, y: number) => {
    const i = (y * 32 + x) * 4;
    return data[i + 3] < 128 ? null : `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const cells = [col(x * 2, y * 2), col(x * 2 + 1, y * 2), col(x * 2, y * 2 + 1), col(x * 2 + 1, y * 2 + 1)];
    const filled = cells.filter((v): v is string => !!v);
    if (filled.length < 2) continue;
    const counts = new Map<string, number>();
    for (const v of filled) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = filled[0], bestN = 0;
    for (const [v, n] of counts) {
      const score = n + (lum(v) < 60 ? 0.6 : 0) + (lum(v) > 200 && n === 1 ? 0.4 : 0);
      if (score > bestN) { best = v; bestN = score; }
    }
    ctx.fillStyle = best;
    ctx.fillRect(x, y, 1, 1);
  }
  smallCache.set(key, c);
  return c;
}

export function creatureKey(s: CreatureSpec) {
  return `cr:${s.plan}:${s.c}:${s.c2 ?? ""}:${s.eye ?? ""}:${s.seed}:${s.boss ? 1 : 0}:${s.el ?? ""}:${s.fam ?? ""}`;
}

export function parseCreature(id: string): CreatureSpec | null {
  if (!id.startsWith("cr:")) return null;
  const [, plan, c, c2, eye, seed, boss, el, fam] = id.split(":");
  return { plan, c, c2: c2 || undefined, eye: eye || undefined, seed: Number(seed), boss: boss === "1", el: el || undefined, fam: fam || undefined };
}

export function creatureCanvas(s: CreatureSpec): HTMLCanvasElement {
  const key = creatureKey(s);
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(s.seed || hashString(key));
  const g = new Grid(rng);
  const a = s.c2 ?? sh(s.c, 0.45);
  const e = s.eye ?? (rng.chance(0.5) ? "#ffe14a" : "#ff4a4a");
  (D[s.plan] ?? D.blob)(g, s.c, a, e, rng);
  // the region leaves its mark: family first (body), then the element (aura)
  if (s.fam) FAM_FX[s.fam]?.(g, new Rng(s.seed ^ 0x5eed));
  if (s.el) EL_FX[s.el]?.(g, new Rng(s.seed ^ 0xe1e));
  if (s.boss) {
    // bosses get a crown of accent spikes and a glowing core
    for (let x = 9; x <= 23; x += 3) if (g.get(x, 3) === null) g.line(x, 3, x, 0, a);
  }
  // outline
  const out = Array.from({ length: S }, (_, y) => g.g[y].slice());
  const K = "#1b1b2a";
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g.g[y][x]) continue;
    const n = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => g.get(x + dx, y + dy)).find((v) => v);
    if (n) out[y][x] = n === K ? K : outline(n);
  }
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  out.forEach((row, y) => row.forEach((col, x) => {
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }));
  cache.set(key, c);
  return c;
}
