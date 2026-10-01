import { Rng, hashString } from "../core/rng";
import { hs, mix, outline } from "./palette";
import { Sprite } from "./parts";
import { PLAN_ART } from "./plans";
import { VARIANTS } from "./variants";

/**
 * Procedural 32x32 creature sprites. A creature is a body plan (quadruped, bird, serpent,
 * golem...; drawn in plans.ts) plus colours and a seed that decides horns, spikes, markings
 * and eyes. The floor's material family and element then leave their mark, and the sprite
 * gets an automatic dark outline.
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

class Grid {
  g: Col[][] = Array.from({ length: S }, () => Array<Col>(S).fill(null));
  constructor(public rng: Rng) {}
  px(x: number, y: number, c: Col) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < S && y < S) this.g[y][x] = c;
  }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < S && y < S ? this.g[y][x] : null; }
  rect(x: number, y: number, w: number, h: number, c: Col) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.px(x + a - Math.floor(t / 2), y + b - Math.floor(t / 2), c);
    }
  }
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
  /** Silhouette variant 0-2; picked from the seed when left out. */
  v?: number;
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

// ------------------------------------------------------------ public API
const cache = new Map<string, HTMLCanvasElement>();
const smallCache = new Map<string, HTMLCanvasElement>();

/**
 * 16x16 version for the map, made by picking the dominant colour of every 2x2 block so the
 * sprite sits on the same pixel grid as the terrain. Outlines and eyes win ties so the
 * silhouette and face survive the reduction.
 */
export function creatureSmall(s: CreatureSpec): HTMLCanvasElement {
  return shrink32(creatureKey(s), () => creatureCanvas(s));
}

/** Halves a 32x32 sprite onto the 16px map grid (see creatureSmall); cached under `key`. */
export function shrink32(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  const hit = smallCache.get(key);
  if (hit) return hit;
  const big = make();
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

/** Which of the plan's three silhouettes this creature uses. */
export function variantOf(s: CreatureSpec): number {
  return s.v ?? ((s.seed >>> 5) % 3);
}

export function creatureKey(s: CreatureSpec) {
  return `cr:${s.plan}:${s.c}:${s.c2 ?? ""}:${s.eye ?? ""}:${s.seed}:${s.boss ? 1 : 0}:${s.el ?? ""}:${s.fam ?? ""}${s.v === undefined ? "" : `:${s.v}`}`;
}

export function parseCreature(id: string): CreatureSpec | null {
  if (!id.startsWith("cr:")) return null;
  const [, plan, c, c2, eye, seed, boss, el, fam, v] = id.split(":");
  return { plan, c, c2: c2 || undefined, eye: eye || undefined, seed: Number(seed), boss: boss === "1", el: el || undefined, fam: fam || undefined, v: v ? Number(v) : undefined };
}

export function creatureCanvas(s: CreatureSpec): HTMLCanvasElement {
  const key = creatureKey(s);
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(s.seed || hashString(key));
  const g = new Grid(rng);
  const a = s.c2 ?? sh(s.c, 0.45);
  const e = s.eye ?? (rng.chance(0.5) ? "#ffe14a" : "#ff4a4a");
  const art = new Sprite((c) => c);
  const v = variantOf(s);
  ((v && VARIANTS[s.plan]?.[v - 1]) || PLAN_ART[s.plan] || PLAN_ART.blob)(art, s.c, a, e, rng);
  for (let i = 0; i < S * S; i++) g.g[Math.floor(i / S)][i % S] = art.g[i];
  // the region leaves its mark: family first (body), then the element (aura)
  if (s.fam) FAM_FX[s.fam]?.(g, new Rng(s.seed ^ 0x5eed));
  if (s.el) EL_FX[s.el]?.(g, new Rng(s.seed ^ 0xe1e));
  if (s.boss) {
    // bosses get a crown of accent spikes and a rim of accent light along their top/right edges
    const { top } = silhouette(g);
    let cx = 16, t = 99;
    for (let x = 10; x <= 24; x++) if (top[x] >= 0 && top[x] < t) { t = top[x]; cx = x; }
    if (t >= 4) {
      const gold = hs(a, 0.15), dark = hs(a, -0.35);
      for (let x = cx - 4; x <= cx + 4; x++) { g.px(x, t - 1, gold); g.px(x, t - 2, x % 2 ? gold : dark); }
      for (const dx of [-4, 0, 4]) { g.px(cx + dx, t - 3, gold); g.px(cx + dx, t - 4 + (dx ? 1 : 0), hs(a, 0.5)); }
      g.px(cx, t - 2, "#ff4a6a");
    }
    const rim = hs(a, 0.35);
    const lit = Array.from({ length: S }, (_, y) => g.g[y].map((c, x) => !!c && (!g.get(x, y - 1) || !g.get(x + 1, y))));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (lit[y][x]) g.px(x, y, mix(g.g[y][x]!, rim, 0.55));
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
