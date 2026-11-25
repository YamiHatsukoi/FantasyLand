/**
 * Pixel art of the travel map, drawn in code at map scale (a tile is 16px): shaded ground with
 * soft biome edges, rivers/lakes/sea with banks and foam, worn roads and bridges, patchwork
 * fields, varied trees grown into natural forests, and a landmark for every place of the book
 * (walled towns, cottages, castles, inns, temples, ruins, cave mouths, camps, docks, ships,
 * snowy peaks...). Everything is painted once into one canvas; the map view only adds light
 * ambient touches (chimney smoke, fire glow, water glints) from the points returned here.
 */
import { hex, hs } from "../../render/palette";
import type { Bg } from "../types";
import { seeded } from "./px";

export type Pt = { x: number; y: number };
type Rnd = ReturnType<typeof seeded>;

// ------------------------------------------------------------------ numbers
export function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const bay = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ colours
const C32 = new Map<string, number>();
function c32(c: string) {
  let v = C32.get(c);
  if (v === undefined) { const [r, g, b] = hex(c); v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; C32.set(c, v); }
  return v;
}
const SHC = new Map<string, string>();
/** Cached hue-shifted shade (see render/palette hs). */
export function sh(c: string, f: number) {
  const k = c + (Math.round(f * 100) / 100);
  let v = SHC.get(k);
  if (v === undefined) { v = hs(c, Math.round(f * 100) / 100); SHC.set(k, v); }
  return v;
}

// ------------------------------------------------------------------ sprite surface
/** A small RGBA pixel surface written as 32-bit words (fast compared with fillRect per pixel). */
class Spr {
  d: Uint32Array;
  constructor(readonly w: number, readonly h: number) { this.d = new Uint32Array(w * h); }
  px(x: number, y: number, c: string) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c32(c);
  }
  clear(x: number, y: number) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 0; }
  on(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] !== 0; }
  rect(x: number, y: number, w: number, h: number, c: string) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  span(x0: number, x1: number, y: number, c: string) { for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) this.px(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 400; n++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      if (u * u + v * v <= 1) this.px(x, y, c);
    }
  }
  /** Dark outline around everything painted; colour derived from the neighbour unless given. */
  outline(col?: string, diag = false) {
    const { w, h, d } = this, out: [number, number][] = [], fixed = col ? c32(col) : 0;
    const nb = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[y * w + x]) continue;
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const v = d[ny * w + nx];
        if (v && (v >>> 24) === 255) { out.push([y * w + x, fixed || darkOf(v)]); break; }
      }
    }
    for (const [i, v] of out) d[i] = v;
    return this;
  }
  stamp(s: Spr, x: number, y: number, flip = false) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + (flip ? s.w - 1 - i : i)];
      if (!v) continue;
      const X = x + i, Y = y + j;
      if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = v;
    }
  }
  canvas() {
    const cv = document.createElement("canvas");
    cv.width = this.w; cv.height = this.h;
    const g = cv.getContext("2d")!;
    const im = g.createImageData(this.w, this.h);
    new Uint32Array(im.data.buffer).set(this.d);
    g.putImageData(im, 0, 0);
    return cv;
  }
}
function darkOf(v: number) {
  const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
  return ((255 << 24) | (Math.round(b * 0.3 + 10) << 16) | (Math.round(g * 0.24 + 6) << 8) | Math.round(r * 0.26 + 8)) >>> 0;
}

interface Blob { x: number; y: number; r: number; ry?: number }
/**
 * Fills overlapping balls lit from the upper left (leafy canopies, boulders, haystacks): each
 * pixel takes the front-most ball's normal, balls in front cast a soft shadow on those behind,
 * and a clumpy texture breaks the shading into leaves or stones.
 */
function lit(s: Spr, blobs: Blob[], pal: string[], o: { seed?: number; tex?: number; snow?: boolean; lift?: number; clump?: number } = {}) {
  const seed = o.seed ?? 0, tex = o.tex ?? 0.38, lift = o.lift ?? 0, cl = o.clump ?? 2;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of blobs) { const ry = b.ry ?? b.r; x0 = Math.min(x0, b.x - b.r); x1 = Math.max(x1, b.x + b.r); y0 = Math.min(y0, b.y - ry); y1 = Math.max(y1, b.y + ry); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const cx = x + 0.5, cy = y + 0.5;
    let k = -1, nx = 0, ny = 0;
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i], ry = b.ry ?? b.r, ux = (cx - b.x) / b.r, uy = (cy - b.y) / ry;
      if (ux * ux + uy * uy <= 1) { k = i; nx = ux; ny = uy; break; }
    }
    if (k < 0) continue;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let v = -0.42 * nx - 0.58 * ny + 0.7 * nz + lift;
    for (let j = k + 1; j < blobs.length; j++) {
      const b = blobs[j], ry = b.ry ?? b.r, ux = (cx + 1 - b.x) / (b.r + 0.6), uy = (cy + 1.6 - b.y) / (ry + 0.6);
      if (ux * ux + uy * uy <= 1) { v -= 0.5; break; }
    }
    v += (hash(Math.floor((x + (Math.floor(y / cl) & 1)) / cl), Math.floor(y / cl), seed) - 0.5) * tex + bay(x, y) * 0.22;
    const t = (v + 0.62) / 1.72;
    const i = clamp(Math.floor(t * pal.length), 0, pal.length - 1);
    if (o.snow && i >= pal.length - 2 && ny < 0.2 && hash(x, y, seed + 9) > 0.18) s.px(x, y, i === pal.length - 1 ? "#f4f8fc" : "#d4e0ee");
    else s.px(x, y, pal[i]);
  }
}

const memo = new Map<string, Spr>();
function cached(key: string, make: () => Spr) {
  let v = memo.get(key);
  if (!v) { v = make(); memo.set(key, v); }
  return v;
}
const cvCache = new Map<Spr, HTMLCanvasElement>();
const cvOf = (s: Spr) => { let c = cvCache.get(s); if (!c) { c = s.canvas(); cvCache.set(s, c); } return c; };

// ------------------------------------------------------------------ vegetation
const BARK = ["#3a2416", "#5a3a22", "#7a5230", "#946a3e"];
export const PAL = {
  oak: ["#1b4022", "#265a2c", "#337436", "#4a9042", "#6eae52"],
  oak2: ["#173a28", "#204e32", "#2c663c", "#40824c", "#60a062"],
  birch: ["#36561c", "#486e22", "#5e8a2a", "#7ea636", "#a6c850"],
  pine: ["#10302a", "#174234", "#20563e", "#307050", "#4a8a60"],
  willow: ["#24422a", "#305a34", "#3e7440", "#56904e", "#80b066"],
  autumnO: ["#5a2418", "#8a3a1c", "#b45a26", "#dc8a34", "#f2bc58"],
  autumnY: ["#5a4010", "#866218", "#b08a22", "#d6b232", "#f0d668"],
  autumnR: ["#48141a", "#72202a", "#9a3430", "#c25638", "#e68a52"],
  swamp: ["#1c2c1e", "#283c26", "#34502e", "#466238", "#607a46"],
  dry: ["#3e3e1c", "#565422", "#706c2a", "#8c8636", "#aaa44a"],
};

function trunk(s: Spr, x: number, top: number, base: number, w: number, pal = BARK) {
  for (let y = Math.round(top); y <= base; y++) for (let i = 0; i < w; i++) s.px(x + i, y, i === 0 ? pal[2] : i === w - 1 ? pal[0] : pal[1]);
  s.px(x - 1, base, pal[1]); s.px(x + w, base, pal[0]);
  if (w > 2) { s.px(x - 2, base, pal[0]); s.px(x + w + 1, base, pal[0]); s.px(x - 1, base - 1, pal[1]); }
}

function oak(seed: number, pal: string[], scale = 1, snow = false) {
  const r = seeded("oak" + seed);
  const W = Math.round(17 * scale) + 3, H = Math.round(21 * scale) + 3;
  const s = new Spr(W, H);
  const cx = W / 2, base = H - 2;
  const cr = (4.9 + r.next() * 1.3) * scale;
  const cy = base - 3.5 * scale - cr * 0.95;
  const tw = scale > 1.6 ? 4 : 2;
  trunk(s, Math.round(cx - tw / 2), cy, base, tw);
  if (scale > 1.6) { s.line(cx - 1, cy + cr * 0.5, cx - 5, cy + 1, BARK[1]); s.line(cx + 1, cy + cr * 0.4, cx + 5, cy, BARK[0]); }
  const blobs: Blob[] = [{ x: cx, y: cy, r: cr, ry: cr * 0.9 }];
  const n = 5 + r.int(0, 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.next() * 0.7, d = cr * (0.5 + r.next() * 0.28);
    blobs.push({ x: cx + Math.cos(a) * d * 1.1, y: cy + Math.sin(a) * d * 0.8, r: cr * (0.4 + r.next() * 0.17) });
  }
  blobs.sort((a, b) => a.y - b.y);
  lit(s, blobs, pal, { seed: r.int(0, 9999), snow, clump: scale > 1.5 ? 3 : 2 });
  return s.outline();
}

function pine(seed: number, pal: string[], scale = 1, snow = false) {
  const r = seeded("pine" + seed);
  const W = Math.round(13 * scale) + 2, H = Math.round(25 * scale) + 2;
  const s = new Spr(W, H);
  const cx = Math.floor(W / 2), base = H - 2;
  const tiers = 4 + (scale > 1.2 ? 1 : 0), bottom = base - 2;
  trunk(s, cx - 1, bottom - 3, base, 2);
  const span = bottom - 1;
  for (let t = 0; t < tiers; t++) {
    const top = 1 + Math.round((t * span) / (tiers + 0.6));
    const bot = Math.min(bottom, top + Math.round(span / (tiers - 0.4)));
    const hwMax = (1.8 + (t + 1) * ((W / 2 - 2) / tiers)) * (0.92 + r.next() * 0.12);
    for (let y = top; y <= bot; y++) {
      const f = (y - top) / Math.max(1, bot - top);
      const hw = 0.6 + f * hwMax + (hash(y, t, seed) - 0.5) * 1.1;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / Math.max(1, hw);
        let v = -0.62 * u + 0.25 - (f > 0.82 ? 0.55 : 0) + (f < 0.25 ? 0.2 : 0) + (hash(x, y, seed + 3) - 0.5) * 0.45 + bay(x, y) * 0.2;
        if (y === bot && (x & 1)) continue;
        const i = clamp(Math.floor(((v + 0.8) / 1.8) * pal.length), 0, pal.length - 1);
        if (snow && f < 0.5 && u < 0.35 && hash(x, y, seed + 7) > 0.25) s.px(x, y, u < -0.2 ? "#f4f8fc" : "#d0dcea");
        else s.px(x, y, pal[i]);
      }
    }
  }
  return s.outline();
}

function birch(seed: number, pal: string[], snow = false) {
  const r = seeded("birch" + seed);
  const W = 15, H = 25, s = new Spr(W, H);
  const cx = 7, base = H - 2;
  for (let y = 7; y <= base; y++) { s.px(cx, y, "#ece8dc"); s.px(cx + 1, y, "#b8b2a6"); if (hash(cx, y, seed) > 0.72) s.px(cx + (y & 1), y, "#2a2626"); }
  s.px(cx - 1, base, "#b8b2a6");
  s.line(cx, 12, cx - 3, 9, "#d8d2c6"); s.line(cx + 1, 10, cx + 4, 7, "#b8b2a6");
  const blobs: Blob[] = [];
  for (let i = 0; i < 7; i++) blobs.push({ x: cx + 0.5 + (r.next() - 0.5) * 8, y: 4 + r.next() * 10, r: 2.2 + r.next() * 1.4 });
  blobs.sort((a, b) => a.y - b.y);
  lit(s, blobs, pal, { seed: r.int(0, 999), tex: 0.5, snow });
  return s.outline();
}

function willow(seed: number, pal: string[]) {
  const r = seeded("willow" + seed);
  const W = 21, H = 22, s = new Spr(W, H);
  const cx = 10.5, base = H - 2;
  trunk(s, 9, 8, base, 3);
  const blobs: Blob[] = [{ x: cx, y: 8, r: 7.5, ry: 5.5 }];
  for (let i = 0; i < 5; i++) blobs.push({ x: cx + (r.next() - 0.5) * 11, y: 6 + r.next() * 5, r: 3 + r.next() * 1.5 });
  blobs.sort((a, b) => a.y - b.y);
  lit(s, blobs, pal, { seed: r.int(0, 999) });
  // hanging fronds
  for (let x = 3; x < W - 3; x++) {
    if (hash(x, 1, seed) < 0.25) continue;
    let top = 0;
    while (top < H && !s.on(x, top)) top++;
    let y0 = top + 3; while (y0 < H && s.on(x, y0)) y0++;
    const len = 2 + Math.floor(hash(x, 2, seed) * 6);
    for (let y = y0 - 2; y < Math.min(base, y0 + len); y++) s.px(x, y, (x + (y >> 1)) % 3 ? pal[2] : pal[3]);
  }
  return s.outline();
}

function deadTree(seed: number, col = "#6a5a4c") {
  const r = seeded("dead" + seed);
  const W = 17, H = 21, s = new Spr(W, H);
  const base = H - 2, cx = 8;
  const lite = sh(col, 0.3), dark = sh(col, -0.32);
  const br = (x: number, y: number, a: number, len: number, depth: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    s.line(x, y, x2, y2, Math.cos(a) < -0.2 ? lite : depth > 1 ? col : dark);
    if (depth <= 0) return;
    br(x2, y2, a - 0.5 - r.next() * 0.35, len * (0.62 + r.next() * 0.15), depth - 1);
    if (r.chance(0.85)) br(x2, y2, a + 0.45 + r.next() * 0.35, len * (0.58 + r.next() * 0.15), depth - 1);
  };
  const top = 7 + r.int(0, 2);
  for (let y = top; y <= base; y++) { s.px(cx, y, lite); s.px(cx + 1, y, dark); }
  s.px(cx - 1, base, col); s.px(cx + 2, base, dark); s.px(cx - 2, base, dark);
  br(cx + 0.5, top + 1, -Math.PI / 2 - 0.55, 4 + r.next() * 1.5, 2);
  br(cx + 0.5, top, -Math.PI / 2 + 0.5, 4 + r.next() * 1.5, 2);
  br(cx + 0.5, top + 4, -Math.PI / 2 + (r.chance(0.5) ? 1.1 : -1.1), 3.5, 1);
  return s.outline();
}

function bush(seed: number, pal: string[], berries?: string) {
  const r = seeded("bush" + seed);
  const s = new Spr(11, 8);
  const blobs: Blob[] = [{ x: 5.5, y: 4.5, r: 3.6, ry: 3 }, { x: 3 + r.next(), y: 5, r: 2.4 }, { x: 8 - r.next(), y: 5, r: 2.4 }, { x: 5 + r.next(), y: 3, r: 2.2 }];
  blobs.sort((a, b) => a.y - b.y);
  lit(s, blobs, pal, { seed: r.int(0, 999) });
  if (berries) for (let i = 0; i < 3; i++) s.px(r.int(3, 7), r.int(2, 5), berries);
  return s.outline();
}

function boulder(seed: number, w: number, snow = false, moss = true) {
  const r = seeded("rock" + seed);
  const s = new Spr(w + 2, Math.round(w * 0.8) + 2);
  const cx = (w + 2) / 2, cy = s.h / 2 + 0.5;
  const blobs: Blob[] = [{ x: cx, y: cy, r: w / 2 - 0.5, ry: s.h / 2 - 1.2 }, { x: cx - w * 0.2, y: cy + 1, r: w * 0.3 }, { x: cx + w * 0.22, y: cy + 0.5, r: w * 0.28 }];
  blobs.sort((a, b) => a.y - b.y);
  lit(s, blobs, ROCK, { seed: r.int(0, 999), tex: 0.3, clump: 2 });
  if (moss || snow) for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!s.on(x, y) || s.on(x, y - 1) || hash(x, y, seed) < 0.35) continue;
    s.px(x, y, snow ? "#eef3f8" : "#5a8a3a");
    if (snow && s.on(x, y + 1) && hash(x, y + 1, seed) > 0.5) s.px(x, y + 1, "#c8d6e6");
  }
  return s.outline();
}
const ROCK = ["#3a3434", "#524a46", "#6c645c", "#8a8276", "#aaa294"];

function reeds(seed: number) {
  const s = new Spr(7, 8);
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(hash(i, 0, seed) * 5), top = 1 + Math.floor(hash(i, 1, seed) * 3);
    for (let y = top; y < 8; y++) s.px(x, y, y < top + 2 ? "#8a9a4a" : "#4a6a2e");
    if (hash(i, 2, seed) > 0.5) { s.px(x, top, "#6a4428"); s.px(x, top + 1, "#5a3420"); }
  }
  return s;
}

function flowers(seed: number) {
  const s = new Spr(7, 5), cols = ["#f4e04c", "#f4f0f0", "#f08ab0", "#b8a0f0", "#f0a040"];
  const c = cols[Math.floor(hash(seed, 3) * cols.length)];
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(hash(i, 0, seed) * 5), y = 1 + Math.floor(hash(i, 1, seed) * 3);
    s.px(x, y + 1, "#3f7a32"); s.px(x, y, c);
  }
  return s;
}

// ------------------------------------------------------------------ buildings
type RoofKind = "thatch" | "shingle" | "slate" | "tile";
type WallKind = "timber" | "stone" | "plaster" | "log" | "plank";
interface HouseSpec {
  w: number; wallH: number; roofH: number; roof: string; roofKind: RoofKind; wall: string; wallKind: WallKind;
  door: number; wins: number[]; lit: number; chimney: number; storeys: 1 | 2; snow: boolean;
  ruined?: boolean; sign?: boolean; barn?: boolean; tall?: boolean; shutter?: string; dormer?: number; flowers?: boolean;
}
const WOOD = "#5a3a24";

function roofPx(k: RoofKind, col: string, x: number, i: number, u: number, t: number, seed: number) {
  const light = 0.16 - u * 0.36 + (t < 0.2 ? 0.1 : 0);
  switch (k) {
    case "thatch": {
      const row = Math.floor(i / 2);
      const base = sh(col, light + (hash(x, row, seed) - 0.5) * 0.18);
      if (i % 2 === 1 && hash(x, i, seed) > 0.45) return sh(base, -0.22);
      return hash(x, i + 40, seed) > 0.86 ? sh(base, 0.18) : base;
    }
    case "shingle": case "slate": {
      const row = Math.floor(i / 2), off = (row & 1) * 2, step = k === "slate" ? 3 : 4;
      if (i % 2 === 1) return sh(col, light - 0.28);
      if ((x + off) % step === 0) return sh(col, light - 0.16);
      return sh(col, light + (hash(x >> 1, row, seed) - 0.5) * 0.1);
    }
    case "tile": {
      if (i % 3 === 2) return sh(col, light - 0.3);
      const m = x % 3;
      return sh(col, light + (m === 0 ? 0.14 : m === 2 ? -0.16 : 0));
    }
  }
}

function house(spec: HouseSpec, seed: number): { s: Spr; chim: Pt | null } {
  const r = seeded("house" + seed);
  const W = spec.w + 4, top = 1 + (spec.chimney >= 0 ? 3 : 0);
  const wTop = top + spec.roofH, wBot = wTop + spec.wallH - 1, H = wBot + 2;
  const s = new Spr(W, H);
  const rx0 = 1, rx1 = spec.w + 2, wx0 = 2, wx1 = spec.w + 1;
  // walls
  for (let y = wTop; y <= wBot; y++) for (let x = wx0; x <= wx1; x++) {
    const u = (x - wx0) / Math.max(1, wx1 - wx0), ry = y - wTop;
    let f = 0.06 - u * 0.24;
    let c = spec.wall;
    switch (spec.wallKind) {
      case "stone": {
        const row = Math.floor(ry / 3);
        if (ry % 3 === 2 || (x + (row & 1) * 2) % 4 === 0) f -= 0.22; else f += (hash(x >> 1, row, seed) - 0.5) * 0.14;
        break;
      }
      case "log": f += ry % 2 ? -0.28 : 0.04 + (hash(x, ry, seed) - 0.5) * 0.08; break;
      case "plank": f += x % 2 ? -0.12 : 0.04; break;
      default: f += (hash(x, y, seed) - 0.5) * 0.06;
    }
    if (ry === 0) f -= 0.42; else if (ry === 1) f -= 0.12;
    if (y === wBot && spec.wallKind !== "stone") c = "#7c766a", f = (x % 3 === 0 ? -0.2 : 0.02) - u * 0.2;
    s.px(x, y, sh(c, f));
  }
  if (spec.wallKind === "timber") {
    const posts = [wx0, wx1];
    for (let x = wx0 + 4; x < wx1 - 2; x += 4 + r.int(0, 1)) posts.push(x);
    for (const x of posts) for (let y = wTop + 1; y < wBot; y++) s.px(x, y, x === wx1 ? sh(WOOD, -0.25) : WOOD);
    if (spec.storeys === 2) { const y = wTop + Math.floor(spec.wallH / 2); s.span(wx0, wx1, y, WOOD); s.span(wx0, wx1, y + 1, sh(spec.wall, -0.3)); }
    else if (spec.wallH >= 6 && r.chance(0.6)) { const x = posts[2] ?? wx0 + 3; s.line(x - 3, wBot - 1, x, wTop + 2, sh(WOOD, 0.1)); }
  }
  if (spec.wallKind === "log") for (let y = wTop + 1; y < wBot; y += 2) { s.px(wx0, y, "#a87a4a"); s.px(wx1, y, "#6a4428"); }
  // windows
  const winRows = spec.storeys === 2 ? [wTop + 2, wTop + Math.floor(spec.wallH / 2) + 2] : [wTop + (spec.wallH >= 7 ? 3 : 2)];
  for (const wy of winRows) for (const wxo of spec.wins) {
    const x = wx0 + wxo;
    const on = !spec.ruined && hash(x, wy, seed) < spec.lit;
    const hgt = spec.tall ? 3 : 2;
    if (spec.ruined) { s.rect(x, wy, 2, hgt, "#1a1412"); continue; }
    if (spec.shutter) { s.px(x - 1, wy, spec.shutter); s.px(x - 1, wy + 1, sh(spec.shutter, -0.25)); s.px(x + 2, wy, sh(spec.shutter, -0.15)); s.px(x + 2, wy + 1, sh(spec.shutter, -0.35)); }
    for (let j = 0; j < hgt; j++) { s.px(x, wy + j, on ? (j ? "#f2b048" : "#fff0a8") : j ? "#2e4a6a" : "#8ab4d4"); s.px(x + 1, wy + j, on ? "#f6c460" : j ? "#22384e" : "#5a86ac"); }
    s.span(x, x + 1, wy + hgt, sh(spec.wall, -0.36));
  }
  // door
  const dx = wx0 + spec.door, dh = Math.min(spec.wallH - 2, spec.tall ? 5 : spec.storeys === 2 ? 4 : 3), dw = spec.barn ? 4 : spec.tall ? 3 : 2;
  for (let y = wBot - dh + 1; y <= wBot; y++) for (let i = 0; i < dw; i++) s.px(dx + i, y, spec.ruined ? "#140e0c" : i === 0 ? "#6a4228" : "#4a2c1a");
  if (spec.barn) { s.line(dx, wBot - dh + 1, dx + dw - 1, wBot, "#8a6a42"); s.line(dx + dw - 1, wBot - dh + 1, dx, wBot, "#8a6a42"); }
  if (spec.tall) { s.clear(dx, wBot - dh + 1); s.clear(dx + dw - 1, wBot - dh + 1); s.px(dx, wBot - dh + 1, sh(spec.wall, -0.1)); s.px(dx + dw - 1, wBot - dh + 1, sh(spec.wall, -0.3)); }
  s.span(dx - 1, dx + dw, wBot - dh, sh(spec.wall, -0.32));
  if (spec.sign) {
    const sx = dx + dw + 1 <= wx1 - 3 ? dx + dw + 1 : Math.max(wx0 + 1, dx - 4);
    s.rect(sx, wTop + 2, 3, 3, "#9a6a34"); s.px(sx + 1, wTop + 3, "#f6d050"); s.px(sx, wTop + 2, "#c08a48"); s.span(sx, sx + 2, wTop + 1, "#3a2416");
    s.px(sx + 3, wTop + 3, "#ffd870");
  }
  // roof
  for (let i = 0; i < spec.roofH; i++) {
    const t = i / Math.max(1, spec.roofH - 1);
    const inset = spec.roofKind === "thatch" ? (i === 0 ? 2 : i === 1 ? 1 : 0) : i === 0 ? 1 : 0;
    const l = rx0 + inset, rr = rx1 - inset;
    for (let x = l; x <= rr; x++) {
      const u = (x - rx0) / (rx1 - rx0);
      let c = roofPx(spec.roofKind, spec.roof, x, i, u, t, seed);
      if (i === spec.roofH - 1) c = sh(spec.roof, -0.36 - u * 0.2);
      else if (x === l) c = sh(spec.roof, 0.22);
      else if (x === rr) c = sh(spec.roof, -0.42);
      if (spec.snow && i < spec.roofH - 1 && (i < spec.roofH - 2 || hash(x, i, seed) > 0.4)) c = x === rr ? "#a8b8cc" : u < 0.5 ? (bay(x, i) > 0.3 ? "#dce6f0" : "#f4f8fc") : bay(x, i) > -0.1 ? "#c4d2e2" : "#dce6f0";
      s.px(x, top + i, c);
    }
  }
  if (spec.roofKind !== "thatch" && !spec.snow) { s.span(rx0 + 1, rx1 - 1, top, sh(spec.roof, -0.3)); s.span(rx0 + 2, rx1 - 2, top + 1, sh(spec.roof, 0.24)); }
  if (spec.roofKind === "thatch") for (let x = wx0; x <= wx1; x++) if (hash(x, 77, seed) > 0.45) s.px(x, wTop, sh(spec.roof, -0.34));
  if (spec.snow) for (let x = rx0 + 1; x < rx1; x++) if (hash(x, 5, seed) > 0.7) s.px(x, wTop, "#dbe8f4");
  if (spec.ruined) {
    for (let i = 0; i < 3; i++) {
      const hx = rx0 + 2 + r.int(0, spec.w - 3), hy = top + r.int(0, spec.roofH - 3);
      s.rect(hx, hy, 2 + r.int(0, 1), 2, "#1c1410"); s.px(hx, hy + 2, "#3a2a20");
    }
    for (let x = rx0; x <= rx1; x++) if (hash(x, 3, seed) > 0.55) s.clear(x, top);
  }
  // a small gable over the roof with an attic window
  if (spec.dormer !== undefined && !spec.ruined) {
    const dc = rx0 + spec.dormer, dh = Math.min(spec.roofH - 1, 5), yb = top + spec.roofH - 1;
    for (let i = 0; i <= dh; i++) {
      const y = yb - i, hw = Math.round((dh - i) * 0.8) + 1;
      for (let x = dc - hw; x <= dc + hw; x++) s.px(x, y, sh(spec.wallKind === "stone" || spec.wallKind === "log" ? "#e0d4b4" : spec.wall, x > dc ? -0.18 : 0.04));
      s.px(dc - hw - 1, y, sh(spec.roof, 0.25)); s.px(dc + hw + 1, y, sh(spec.roof, -0.45));
    }
    s.px(dc, yb - dh - 1, spec.snow ? "#eef3f8" : sh(spec.roof, 0.1));
    const on = hash(dc, yb, seed) < spec.lit;
    s.px(dc, yb - 2, on ? "#fff0a8" : "#8ab4d4"); s.px(dc, yb - 1, on ? "#f2b048" : "#2e4a6a"); s.px(dc + 1, yb - 1, sh(spec.wall, -0.3));
  }
  if (spec.flowers && !spec.ruined) for (const wxo of spec.wins) {
    const x = wx0 + wxo, y = winRows[winRows.length - 1] + 2;
    s.px(x, y, ["#e84a6a", "#f4d040", "#f0f0f0", "#b88aff"][(x + seed) & 3]); s.px(x + 1, y, "#4f9a35");
  }
  let chim: Pt | null = null;
  if (spec.chimney >= 0) {
    const cx = rx0 + spec.chimney, cb = top + Math.max(2, Math.floor(spec.roofH * 0.45));
    for (let y = top - 3; y <= cb; y++) { s.px(cx, y, "#a89888"); s.px(cx + 1, y, "#6a5a4e"); if ((y & 1) === 0) s.px(cx, y, "#8a7a6a"); }
    s.span(cx - 1, cx + 2, top - 3, spec.snow ? "#eef3f8" : "#4a3e36");
    if (!spec.ruined) chim = { x: cx + 0.5, y: top - 4 };
  }
  s.outline();
  return { s, chim };
}

function cottageSpec(r: Rnd, cold: boolean, o: { big?: boolean; town?: boolean; stone?: boolean } = {}): HouseSpec {
  const town = !!o.town, storeys: 1 | 2 = town ? (r.chance(0.7) ? 2 : 1) : o.big ? 2 : 1;
  const w = town ? r.int(9, 13) : o.big ? r.int(15, 18) : r.int(12, 16);
  const wallH = storeys === 2 ? r.int(9, 10) : r.int(6, 7);
  const roofKind: RoofKind = town ? r.pick(["shingle", "slate", "tile", "shingle"] as const) : r.pick(["thatch", "thatch", "shingle", "thatch", "slate"] as const);
  const roof = roofKind === "thatch" ? r.pick(["#c8a050", "#b89048", "#d0aa5a"]) : roofKind === "slate" ? r.pick(["#5a6478", "#4e5a6e", "#626a7a"]) : roofKind === "tile" ? r.pick(["#c0603a", "#b0502e", "#c87048"]) : r.pick(["#a8503a", "#8a4a32", "#6a5a8a", "#4a6a8a", "#9a4038", "#5a7a4a"]);
  const wallKind: WallKind = o.stone ? "stone" : town ? r.pick(["timber", "timber", "stone", "plaster"] as const) : r.pick(["timber", "plaster", "log", "stone", "timber"] as const);
  const wall = wallKind === "stone" ? r.pick(["#a09a8e", "#948e84", "#aaa496"]) : wallKind === "log" ? "#8a5a34" : r.pick(["#e8dcbc", "#ecdcc4", "#e0d0a8", "#f0e6d0", "#d8c8a0"]);
  const wins: number[] = [];
  for (let x = 1; x < w - 2; x += r.int(3, 5)) wins.push(x);
  const door = r.int(1, Math.max(1, w - 4));
  const winsFree = wins.filter((x) => x + 1 < door - 0 || x > door + 2);
  return {
    w, wallH, roofH: town ? r.int(6, 8) : r.int(6, 8), roof, roofKind, wall, wallKind, door, wins: storeys === 2 ? wins : winsFree,
    dormer: !town && w >= 13 && r.chance(0.45) ? (door > w / 2 ? r.int(3, Math.max(3, door - 2)) : r.int(Math.min(w - 2, door + 4), w - 2)) : town && r.chance(0.3) ? r.int(3, w - 2) : undefined,
    flowers: !town && r.chance(0.5),
    lit: 0.35, chimney: r.chance(town ? 0.6 : 0.85) ? r.int(2, w - 2) : -1, storeys, snow: cold,
    shutter: !town && r.chance(0.4) ? r.pick(["#3a6a4a", "#4a5a8a", "#8a3a2a"]) : undefined,
  };
}

export function houseSprite(kind: "cottage" | "town" | "big" | "stone" | "barn" | "ruined" | "hall" | "inn", v: number, cold: boolean) {
  const key = `h:${kind}:${v}:${cold}`;
  const hit = memo.get(key);
  if (hit) return { cv: cvOf(hit), chim: chimOf.get(hit) ?? null, w: hit.w, h: hit.h };
  const r = seeded(key);
  let spec: HouseSpec;
  if (kind === "hall") {
    const w = r.int(20, 26), wins: number[] = [];
    for (let x = 2; x < w - 3; x += 4) if (Math.abs(x - (w / 2 - 1.5)) > 2.5) wins.push(x);
    spec = { w, wallH: 9, roofH: 8, roof: r.pick(["#5a6478", "#8a4a32", "#4e5a6e"]), roofKind: "slate", wall: r.pick(["#b0a898", "#a49c8c"]), wallKind: "stone", door: Math.round(w / 2 - 1.5), wins, lit: 0.7, chimney: r.int(3, w - 4), storeys: 1, snow: cold, tall: true };
  } else if (kind === "inn") {
    spec = { ...cottageSpec(r, cold, { big: true }), sign: true, lit: 0.8, chimney: 3 };
  } else if (kind === "barn") {
    spec = { w: r.int(13, 16), wallH: 7, roofH: 7, roof: r.pick(["#5a4a3e", "#6a4a3a", "#4a5060"]), roofKind: "shingle", wall: r.pick(["#9a3a2a", "#8a3a28", "#7a5a3a"]), wallKind: "plank", door: 5, wins: [1], lit: 0, chimney: -1, storeys: 1, snow: cold, barn: true };
  } else if (kind === "ruined") {
    spec = { ...cottageSpec(r, false), ruined: true, roof: "#4a4038", wall: "#6a6058", snow: false };
  } else spec = cottageSpec(r, cold, { big: kind === "big", town: kind === "town", stone: kind === "stone" });
  const { s, chim } = house(spec, r.int(0, 99999));
  memo.set(key, s);
  if (chim) chimOf.set(s, chim);
  return { cv: cvOf(s), chim, w: s.w, h: s.h };
}
const chimOf = new Map<Spr, Pt>();

/** Round stone tower with a cone roof or battlements. */
function tower(seed: number, o: { w: number; h: number; top: "cone" | "crenel"; roof: string; stone?: string; flag?: string | null; snow?: boolean }) {
  const stone = o.stone ?? "#a29c90", w = o.w;
  const coneH = o.top === "cone" ? Math.round(w * 1.05) : 2;
  const flagH = o.flag ? 5 : 0;
  const W = w + 4, H = o.h + flagH + 2;
  const s = new Spr(W, H);
  const x0 = 2, bodyTop = flagH + coneH, bot = H - 2, cx = x0 + (w - 1) / 2;
  for (let y = bodyTop - 1; y <= bot; y++) for (let x = x0; x < x0 + w; x++) {
    const u = (x - x0 + 0.5) / w, ry = y - bodyTop;
    let f = u < 0.32 ? 0.14 - (0.32 - u) * 0.5 : 0.14 - (u - 0.32) * 0.95;
    const row = Math.floor(ry / 3);
    if (ry % 3 === 2 || (x + (row & 1) * 2) % 4 === 0) f -= 0.18; else f += (hash(x, row, seed) - 0.5) * 0.12;
    s.px(x, y, sh(stone, f));
  }
  for (let y = bodyTop + 3; y < bot - 5; y += 5) { s.px(Math.round(cx), y, "#1c1618"); s.px(Math.round(cx), y + 1, "#1c1618"); }
  const dx = Math.round(cx) - 1;
  s.rect(dx, bot - 3, 3, 4, "#2a1c16"); s.px(dx + 1, bot - 3, "#3a2a20"); s.clear(dx, bot - 3); s.clear(dx + 2, bot - 3);
  s.px(dx, bot - 3, sh(stone, 0)); s.px(dx + 2, bot - 3, sh(stone, -0.3));
  if (o.top === "cone") {
    for (let i = 0; i < coneH; i++) {
      const hw = 0.5 + (i / Math.max(1, coneH - 1)) * (w / 2 + 0.6);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - (cx - hw)) / (2 * hw + 0.01);
        let f = 0.2 - u * 0.6 + ((x & 1) ? -0.1 : 0);
        if (i === coneH - 1) f = -0.4 - u * 0.2;
        let c = sh(o.roof, f);
        if (o.snow && i < coneH - 1 && u < 0.6) c = u < 0.3 ? "#f4f8fc" : "#d0dcea";
        s.px(x, flagH + i, c);
      }
    }
  } else {
    const y = bodyTop - 2;
    for (let x = x0 - 1; x <= x0 + w; x++) {
      s.px(x, y + 1, sh(stone, 0.3 - ((x - x0) / w) * 0.5));
      if (((x - x0 + 1) % 3) !== 2) s.px(x, y, o.snow ? "#eef3f8" : sh(stone, 0.18 - ((x - x0) / w) * 0.5));
    }
    s.span(x0, x0 + w - 1, y + 2, sh(stone, -0.45));
  }
  if (o.flag) {
    const px = Math.round(cx), fy = o.top === "cone" ? flagH : bodyTop - 2;
    for (let y = 0; y < fy; y++) s.px(px, y, "#3a2a20");
    s.rect(px + 1, 0, 3, 2, o.flag); s.px(px + 3, 1, sh(o.flag, -0.3)); s.px(px + 1, 0, sh(o.flag, 0.3));
  }
  return s.outline();
}

/** Square keep with battlements, banners and an arched gate. */
function keep(seed: number, w: number, h: number, o: { stone: string; banner: string; roof: string; snow: boolean }) {
  const s = new Spr(w + 4, h + 9);
  const x0 = 2, x1 = x0 + w - 1, top = 8, bot = s.h - 2;
  for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (w - 1), ry = y - top, row = Math.floor(ry / 3);
    let f = 0.1 - u * 0.3;
    if (ry % 3 === 2 || (x + (row & 1) * 3) % 5 === 0) f -= 0.17; else f += (hash(x >> 1, row, seed) - 0.5) * 0.12;
    s.px(x, y, sh(o.stone, f));
  }
  // battlements and the walk behind them
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    s.px(x, top - 1, sh(o.stone, 0.32 - ((x - x0) / w) * 0.4));
    s.px(x, top - 2, sh(o.stone, 0.2 - ((x - x0) / w) * 0.4));
    if ((x - x0 + 1) % 3 !== 2) s.px(x, top - 3, o.snow ? "#eef3f8" : sh(o.stone, 0.12 - ((x - x0) / w) * 0.4));
  }
  s.span(x0, x1, top, sh(o.stone, -0.45));
  // corner turrets with cone roofs
  for (const tx of [x0 - 1, x1 - 2]) {
    for (let y = top - 3; y <= top + 6; y++) for (let i = 0; i < 4; i++) s.px(tx + i, y, sh(o.stone, i === 0 ? 0.18 : i === 3 ? -0.35 : 0));
    for (let i = 0; i < 5; i++) { const hw = i * 0.55; for (let x = Math.round(tx + 1.5 - hw); x <= Math.round(tx + 1.5 + hw); x++) s.px(x, top - 8 + i, o.snow && x <= tx + 1 ? "#eef3f8" : sh(o.roof, x <= tx + 1 ? 0.15 : -0.3)); }
    s.px(tx + 1, top - 9, "#3a2a20");
  }
  // windows
  for (let y = top + 4; y < bot - 7; y += 6) for (let x = x0 + 4; x < x1 - 3; x += 4) { s.px(x, y, "#1a1416"); s.px(x, y + 1, hash(x, y, seed) > 0.6 ? "#f6c460" : "#1a1416"); s.px(x, y + 2, "#1a1416"); }
  // banners
  for (const bx of [x0 + 2, x1 - 3]) {
    s.span(bx - 1, bx + 2, top + 2, "#3a2a20");
    for (let y = top + 3; y < top + 9; y++) { s.px(bx, y, o.banner); s.px(bx + 1, y, sh(o.banner, -0.3)); }
    s.px(bx, top + 9, o.banner); s.px(bx + 1, top + 5, "#f2d060"); s.px(bx, top + 5, "#f2d060");
  }
  // gate
  const gx = Math.round((x0 + x1) / 2) - 2;
  for (let y = bot - 6; y <= bot; y++) for (let i = 0; i < 5; i++) {
    if (y === bot - 6 && (i === 0 || i === 4)) continue;
    s.px(gx + i, y, (i & 1) && y > bot - 5 ? "#3a2c24" : "#120c0c");
  }
  s.span(gx - 1, gx + 5, bot - 7, sh(o.stone, 0.3));
  return s.outline();
}

export interface CastleStyle { stone: string; roof: string; banner: string; snow: boolean }
export function castleSprite(size: 0 | 1 | 2, v: number, st: CastleStyle) {
  const key = `castle:${size}:${v}:${st.stone}${st.roof}${st.banner}${st.snow}`;
  const s = cached(key, () => {
    if (size === 0) return tower(v, { w: 8, h: 20, top: v & 1 ? "cone" : "crenel", roof: st.roof, stone: st.stone, flag: st.banner, snow: st.snow });
    if (size === 1) {
      const c = new Spr(32, 34);
      c.stamp(keep(v, 14, 18, st), 7, 0);
      const t = tower(v, { w: 7, h: 15, top: "cone", roof: st.roof, stone: st.stone, flag: st.banner, snow: st.snow });
      // curtain wall
      wallH(c, 4, 26, 24, st.stone, st.snow);
      c.stamp(t, -1, c.h - t.h); c.stamp(t, c.w - t.w + 1, c.h - t.h);
      gateArch(c, 16, c.h - 2, st.stone);
      return c;
    }
    const c = new Spr(48, 44);
    const back = tower(v + 1, { w: 7, h: 22, top: "cone", roof: st.roof, stone: st.stone, flag: null, snow: st.snow });
    c.stamp(back, 2, 6); c.stamp(back, c.w - back.w - 2, 6);
    wallH(c, 6, 22, 36, st.stone, st.snow);
    c.stamp(keep(v, 20, 24, st), 12, 0);
    for (const x of [5, 41]) for (let y = 24; y < 36; y++) for (let i = 0; i < 4; i++) c.px(x + i - 1, y, sh(st.stone, i === 0 ? 0.25 : i === 3 ? -0.4 : 0.05 + (hash(x + i, y, v) - 0.5) * 0.1));
    wallH(c, 6, 34, 36, st.stone, st.snow);
    const ft = tower(v + 2, { w: 10, h: 19, top: v & 1 ? "crenel" : "cone", roof: st.roof, stone: st.stone, flag: st.banner, snow: st.snow });
    c.stamp(ft, -1, c.h - ft.h); c.stamp(ft, c.w - ft.w + 1, c.h - ft.h);
    gateArch(c, 24, c.h - 2, st.stone);
    for (const bx of [17, 30]) for (let y = c.h - 9; y < c.h - 4; y++) { c.px(bx, y, st.banner); c.px(bx + 1, y, sh(st.banner, -0.3)); }
    return c;
  });
  return { cv: cvOf(s), w: s.w, h: s.h };
}
/** Horizontal battlemented wall: merlons, walk, then the face. */
function wallH(s: Spr, x0: number, top: number, len: number, stone: string, snow: boolean) {
  for (let x = x0; x < x0 + len; x++) {
    if ((x - x0) % 3 !== 2) s.px(x, top, snow ? "#eef3f8" : sh(stone, 0.22));
    s.px(x, top + 1, sh(stone, 0.32)); s.px(x, top + 2, sh(stone, 0.12));
    for (let y = top + 3; y < top + 9; y++) {
      const ry = y - top - 3, row = Math.floor(ry / 2);
      let f = -0.05 - ry * 0.035;
      if (ry % 2 === 1 && (x + row * 2) % 5 === 0) f -= 0.2; else if (ry % 2 === 1) f -= 0.08;
      s.px(x, y, sh(stone, f + (hash(x >> 1, row, 3) - 0.5) * 0.1));
    }
    s.px(x, top + 3, sh(stone, -0.4));
  }
}
function gateArch(s: Spr, cx: number, bot: number, stone: string) {
  for (let y = bot - 6; y <= bot; y++) for (let i = -3; i <= 3; i++) {
    if (y === bot - 6 && Math.abs(i) > 1) continue;
    if (y === bot - 5 && Math.abs(i) > 2) continue;
    s.px(cx + i, y, Math.abs(i) === 3 || (y === bot - 6) ? sh(stone, 0.3) : (i & 1) && y > bot - 4 ? "#3a2c24" : "#100a0a");
  }
}

function temple(seed: number, big: boolean, snow: boolean) {
  const n = big ? 5 : 4, W = big ? 30 : 24, H = big ? 28 : 23;
  const s = new Spr(W, H);
  const M = "#e4ddcf", base = H - 2;
  // steps
  for (let k = 0; k < 3; k++) { const y = base - k; s.span(1 + k, W - 2 - k, y, sh(M, k === 0 ? -0.3 : -0.1 + k * 0.08)); }
  const colTop = base - (big ? 14 : 11), x0 = 4, x1 = W - 5;
  // dark interior
  s.rect(x0 + 1, colTop + 1, x1 - x0 - 1, base - 3 - colTop, "#2e2630");
  s.rect(x0 + 1, colTop + 1, x1 - x0 - 1, 2, "#1a1418");
  const cw = (x1 - x0) / (n - 1);
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + i * cw);
    for (let y = colTop; y <= base - 3; y++) { s.px(cx - 1, y, sh(M, 0.15)); s.px(cx, y, M); s.px(cx + 1, y, sh(M, -0.32)); }
    s.span(cx - 2, cx + 2, colTop, sh(M, 0.05)); s.span(cx - 2, cx + 2, base - 3, sh(M, -0.15));
  }
  // entablature and pediment
  s.span(2, W - 3, colTop - 1, sh(M, 0.1)); s.span(2, W - 3, colTop - 2, sh(M, -0.25)); s.span(2, W - 3, colTop - 3, sh(M, 0.22));
  const pt = colTop - 3, ph = big ? 8 : 6;
  for (let i = 1; i <= ph; i++) {
    const y = pt - i, hw = (W / 2 - 2) * (1 - i / (ph + 1));
    for (let x = Math.round(W / 2 - hw); x <= Math.round(W / 2 + hw - 1); x++) s.px(x, y, x < W / 2 ? sh(M, 0.1) : sh(M, -0.12));
    s.px(Math.round(W / 2 - hw), y, snow ? "#f4f8fc" : sh("#8a7a6a", 0.1)); s.px(Math.round(W / 2 + hw - 1), y, snow ? "#d0dcea" : sh("#8a7a6a", -0.3));
  }
  s.px(W / 2 - 1, pt - 3, "#d8b040"); s.px(W / 2, pt - 3, "#a88a30");
  return s.outline();
}

/** Stone church: a nave with tall windows and a bell tower with a spire. */
function church(seed: number, snow: boolean) {
  const { s: nave } = house({ w: 15, wallH: 8, roofH: 7, roof: "#4e5a6e", roofKind: "slate", wall: "#b4ac9c", wallKind: "stone", door: 6, wins: [2, 11], lit: 0.8, chimney: -1, storeys: 1, snow, tall: true }, seed);
  const s = new Spr(28, 40);
  s.stamp(nave, 9, s.h - nave.h);
  const tx = 2, tw = 9, tTop = 14, bot = s.h - 2;
  for (let y = tTop; y <= bot; y++) for (let x = tx; x < tx + tw; x++) {
    const ry = y - tTop, row = Math.floor(ry / 3);
    let f = 0.12 - ((x - tx) / tw) * 0.4;
    if (ry % 3 === 2 || (x + (row & 1) * 2) % 4 === 0) f -= 0.15;
    s.px(x, y, sh("#b4ac9c", f));
  }
  s.rect(tx + 3, tTop + 3, 3, 4, "#1a1416"); s.px(tx + 4, tTop + 4, "#c8a040");
  s.rect(tx + 3, bot - 4, 3, 5, "#3a2418"); s.span(tx + 2, tx + 6, bot - 5, "#d4ccbc");
  s.span(tx - 1, tx + tw, tTop - 1, "#8a8478"); s.span(tx - 1, tx + tw, tTop, "#6a645a");
  for (let i = 0; i < 13; i++) {
    const hw = (i / 12) * (tw / 2 + 0.5);
    for (let x = Math.round(tx + tw / 2 - 0.5 - hw); x <= Math.round(tx + tw / 2 - 0.5 + hw); x++) s.px(x, 1 + i, snow && x < tx + tw / 2 ? "#eef3f8" : sh("#4e5a6e", x < tx + tw / 2 - 0.5 ? 0.18 : -0.3));
  }
  s.px(tx + 4, 0, "#d8b040");
  return s.outline();
}

function ruins(seed: number, w: number, snow: boolean) {
  const r = seeded("ruin" + seed);
  const H = Math.round(w * 0.8), s = new Spr(w, H);
  const S = "#aaa292", base = H - 2;
  const stone = (x: number, y: number, f: number) => s.px(x, y, sh(S, f + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.12));
  // cracked flagstone floor (seen from above)
  const fy0 = base - Math.round(H * 0.42), fx0 = 2, fx1 = w - 3;
  for (let y = fy0; y <= base; y++) for (let x = fx0; x <= fx1; x++) {
    if (hash(x >> 2, y >> 1, seed + 1) < 0.16 || ((x === fx0 || x === fx1 || y === base) && hash(x, y, seed) < 0.5)) continue;
    const joint = (y - fy0) % 3 === 2 || (x + (((y - fy0) / 3) | 0) * 2) % 5 === 0;
    s.px(x, y, joint ? "#7e786c" : sh("#c4bcac", (hash(x >> 2, ((y - fy0) / 3) | 0, seed) - 0.5) * 0.16 - (y === base ? 0.3 : 0)));
  }
  // back wall with a broken arch
  const wy = fy0 + 1, wl = 3 + r.int(0, 2), wr = w - 4 - r.int(0, 2);
  const archC = Math.round((wl + wr) / 2) + r.int(-2, 2);
  for (let x = wl; x <= wr; x++) {
    const hgt = Math.max(3, Math.round(H * 0.42 - Math.abs(x - (wl + 3)) * 0.35 + (noise(x / 2, 0, seed) - 0.5) * 6 - (x > archC + 4 ? (x - archC - 4) * 0.7 : 0)));
    for (let j = 0; j < hgt; j++) {
      const y = wy - j, row = (j / 2) | 0;
      let f = 0.04 - ((x - wl) / (wr - wl)) * 0.22;
      if (j % 2 === 1 || (x + row * 2) % 4 === 0) f -= 0.18;
      if (j === hgt - 1) f = 0.3;
      if (Math.abs(x - archC) <= 1 && j < Math.min(hgt - 2, 6)) { s.px(x, y, j < 5 ? "#2a2428" : "#3a3238"); continue; }
      if (Math.abs(x - archC) === 2 && j === 5) f = 0.25;
      stone(x, y, f);
    }
    if (hash(x, 3, seed) > 0.55) for (let j = 0; j < 3 + (hash(x, 4, seed) * 4 | 0); j++) s.px(x, wy - Math.floor(hash(x, 5, seed) * hgt * 0.6) - j, j % 2 ? "#3e6e2c" : "#5a8e3a");
  }
  // standing columns of different heights, one fallen across the floor
  const cols = [fx0 + 3, fx0 + 3 + Math.round((fx1 - fx0) * 0.33), fx0 + 3 + Math.round((fx1 - fx0) * 0.66)];
  cols.forEach((cx, k) => {
    if (k === 1 && r.chance(0.5)) return;
    const hgt = [r.int(8, 12), r.int(3, 6), r.int(6, 10)][k], y0 = base - 2;
    for (let j = 0; j < hgt; j++) { s.px(cx - 1, y0 - j, "#f0eade"); s.px(cx, y0 - j, "#ccc4b4"); s.px(cx + 1, y0 - j, "#968e80"); }
    s.span(cx - 2, cx + 2, y0, "#a8a090"); s.span(cx - 2, cx + 2, y0 + 1, "#7a7266");
    if (hgt > 7) { s.span(cx - 2, cx + 2, y0 - hgt, "#e0d8c8"); s.span(cx - 2, cx + 2, y0 - hgt - 1, "#f4eee2"); }
    else { s.px(cx - 1, y0 - hgt, "#f0eade"); s.px(cx + 1, y0 - hgt + 1, "#968e80"); }
  });
  const fx = cols[1] + 3, fyy = base - 3;
  for (let i = 0; i < 9 && fx + i < w - 2; i++) { s.px(fx + i, fyy, "#f0eade"); s.px(fx + i, fyy + 1, i % 3 === 2 ? "#8a8274" : "#ccc4b4"); s.px(fx + i, fyy + 2, "#8a8274"); }
  for (let i = 0; i < 8; i++) { const rx = r.int(1, w - 3), ry = base - r.int(0, 3); s.px(rx, ry, "#b8b0a0"); s.px(rx + 1, ry, "#7a7266"); }
  if (snow) for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (s.on(x, y) && !s.on(x, y - 1) && hash(x, y, 5) > 0.3) s.px(x, y, "#f4f8fc");
  return s.outline();
}

function graveyard(seed: number, snow: boolean) {
  const r = seeded("grave" + seed);
  const s = new Spr(28, 22);
  // crypt at the back
  const { s: crypt } = house({ w: 10, wallH: 6, roofH: 5, roof: "#5a5a66", roofKind: "slate", wall: "#9a948a", wallKind: "stone", door: 4, wins: [], lit: 0, chimney: -1, storeys: 1, snow, tall: true }, seed);
  s.stamp(crypt, 9, 0);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    const x = 2 + i * 5 + (row ? 2 : 0) + r.int(-1, 1), y = 15 + row * 4;
    if (r.chance(0.3)) { s.px(x + 1, y - 3, "#c8c4bc"); s.span(x, x + 2, y - 2, "#c8c4bc"); s.px(x + 1, y - 1, "#9a968e"); s.px(x + 1, y, "#9a968e"); }
    else { s.span(x, x + 1, y - 3, "#d0ccc4"); s.px(x, y - 2, "#bcb8b0"); s.px(x + 1, y - 2, "#8a867e"); s.px(x, y - 1, "#bcb8b0"); s.px(x + 1, y - 1, "#8a867e"); }
    s.span(x - 1, x + 2, y, "#3a3226");
  }
  return s.outline();
}

/** Rocky outcrop with a dark mouth: cave, mine tunnel or dungeon door. */
function outcrop(seed: number, w: number, kind: "cave" | "tunnel" | "dungeon" | "mine", snow: boolean) {
  const r = seeded("crop" + seed + kind);
  const H = Math.round(w * 0.78), s = new Spr(w, H);
  const cx = w / 2, base = H - 2;
  const blobs: Blob[] = [
    { x: cx + (r.next() - 0.5) * 3, y: H * 0.42, r: w * 0.3, ry: H * 0.34 },
    { x: cx - w * 0.25, y: H * 0.58, r: w * 0.22, ry: H * 0.3 },
    { x: cx + w * 0.26, y: H * 0.6, r: w * 0.21, ry: H * 0.28 },
    { x: cx + (r.next() - 0.5) * w * 0.3, y: H * 0.68, r: w * 0.3, ry: H * 0.26 },
    { x: cx - w * 0.38, y: H * 0.8, r: w * 0.12, ry: H * 0.14 },
    { x: cx + w * 0.38, y: H * 0.82, r: w * 0.11, ry: H * 0.13 },
  ];
  lit(s, blobs, ROCK, { seed: r.int(0, 999), tex: 0.32, clump: 2 });
  // cracks
  for (let k = 0; k < 3; k++) { let x = r.int(3, w - 4), y = r.int(2, Math.round(H * 0.5)); for (let i = 0; i < 4; i++) { if (s.on(x, y)) s.px(x, y, ROCK[0]); x += r.int(-1, 1); y++; } }
  // moss or snow on the tops
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
    if (!s.on(x, y) || s.on(x, y - 1) || hash(x, y, seed) < 0.3) continue;
    s.px(x, y, snow ? "#f4f8fc" : hash(x, y, seed + 1) > 0.5 ? "#5e8e3c" : "#4a7a32");
    if (s.on(x, y + 1) && hash(x, y + 2, seed) > 0.45) s.px(x, y + 1, snow ? "#d0dcea" : "#3e6a2c");
  }
  const mw = Math.max(5, Math.round(w * 0.3)), mh = Math.max(5, Math.round(H * 0.46));
  const mx0 = Math.round(cx - mw / 2), top = base - mh + 1;
  const spring = top + Math.round(mw / 2);
  const inside = (x: number, y: number) => {
    if (y < top || y > base || x < mx0 || x >= mx0 + mw) return false;
    if (y >= spring) return true;
    const dx = (x + 0.5 - (mx0 + mw / 2)) / (mw / 2), dy = (spring - y) / (spring - top + 0.5);
    return dx * dx + dy * dy <= 1.05 + (kind === "cave" ? (hash(x, y, seed) - 0.5) * 0.5 : 0);
  };
  for (let y = top; y <= base; y++) for (let x = mx0 - 1; x <= mx0 + mw; x++) {
    if (!inside(x, y)) continue;
    const e = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1);
    s.px(x, y, e ? "#2a2228" : y > base - 1 ? "#1a1418" : "#0a080c");
  }
  if (kind === "cave") for (let x = mx0 + 1; x < mx0 + mw - 1; x += 2) if (hash(x, 9, seed) > 0.35) { let y = top; while (y < base && !inside(x, y)) y++; s.px(x, y, "#6a6260"); if (hash(x, 8, seed) > 0.5) s.px(x, y + 1, "#4a4446"); }
  if (kind === "tunnel" || kind === "mine") {
    for (let y = top + 1; y <= base; y++) { s.px(mx0 - 1, y, "#9a6a3c"); s.px(mx0, y, "#6a4428"); s.px(mx0 + mw - 1, y, "#7a5030"); s.px(mx0 + mw, y, "#4a2e1a"); }
    s.span(mx0 - 2, mx0 + mw + 1, top, "#a87a44"); s.span(mx0 - 2, mx0 + mw + 1, top + 1, "#6a4428");
    if (kind === "mine") { for (let y = base - 3; y <= base; y++) { s.px(cx - 2, y, "#8a8a90"); s.px(cx + 1, y, "#8a8a90"); } s.span(cx - 3, cx + 2, base - 1, "#5a3a22"); }
  }
  if (kind === "dungeon") {
    for (let y = top - 1; y <= base; y++) for (const x of [mx0 - 2, mx0 - 1, mx0 + mw, mx0 + mw + 1]) {
      if (y < spring - 1 && !(x === mx0 - 1 || x === mx0 + mw)) continue;
      s.px(x, y, (y - top) % 3 === 2 ? "#8a8680" : x < cx ? "#c8c2b8" : "#a8a29a");
    }
    for (let x = mx0; x < mx0 + mw; x++) { let y = top - 1; while (y < base && !inside(x, y + 1)) y++; s.px(x, y, (x % 3) ? "#c8c2b8" : "#8a8680"); }
    s.px(Math.round(cx) - 1, top - 2, "#dcd6cc"); s.px(Math.round(cx), top - 2, "#b8b2a8");
    for (let k = 1; k <= 2; k++) s.span(mx0 + 1, mx0 + mw - 2, base - k * 2 + 1, "#3a3236");
    for (const tx of [mx0 - 4, mx0 + mw + 3]) { s.px(tx, spring, "#5a3a22"); s.px(tx, spring + 1, "#5a3a22"); s.px(tx, spring - 1, "#f8a030"); s.px(tx, spring - 2, "#ffe070"); }
  }
  return s.outline();
}

/** Mountain peak: lit and shaded faces split by a ridge, strata, and a jagged snow cap. */
function peak(seed: number, w: number, h: number, snowLine: number) {
  const r = seeded("peak" + seed);
  const s = new Spr(w, h);
  const ax = w * (0.4 + r.next() * 0.2), base = h - 1;
  const L = ["#5e564c", "#776d60", "#90867a", "#aaa092"], D = ["#3a343a", "#463e42", "#544a4c"];
  for (let y = 1; y <= base; y++) {
    const t = (y - 1) / (base - 1);
    const sl = ax - t * ax * (0.92 + (noise(y / 3, 0, seed) - 0.5) * 0.3) - (noise(y / 6, 1, seed) - 0.5) * 3 * t;
    const sr = ax + t * (w - ax) * (0.9 + (noise(y / 3, 2, seed) - 0.5) * 0.3) + (noise(y / 6, 3, seed) - 0.5) * 3 * t;
    const ridge = ax + t * w * 0.1 + (noise(y / 2.5, 4, seed) - 0.5) * 3 * Math.min(1, t * 3);
    const sn = snowLine + (noise(y / 2, 5, seed) - 0.5) * 0.12;
    for (let x = Math.max(0, Math.round(sl)); x <= Math.min(w - 1, Math.round(sr)); x++) {
      const lightFace = x < ridge;
      const gully = noise(x / 2.2 + y * 0.35, y / 7, seed + 6);
      const strat = hash(x >> 1, y, seed) - 0.5;
      const snowy = t < sn + (gully - 0.5) * 0.25 * (lightFace ? 1 : 0.6);
      let c: string;
      if (snowy) c = lightFace ? (gully < 0.35 ? "#d6e0ec" : "#f4f8fc") : gully < 0.4 ? "#8e9cb4" : "#aebcd2";
      else if (lightFace) c = L[clamp(Math.floor((0.55 + (x - sl) / Math.max(1, ridge - sl) * 0.35 - (gully < 0.3 ? 0.4 : 0) + strat * 0.3 + bay(x, y) * 0.3) * L.length), 0, L.length - 1)];
      else c = D[clamp(Math.floor((0.6 - (x - ridge) / Math.max(1, sr - ridge) * 0.4 + strat * 0.3 + bay(x, y) * 0.3) * D.length), 0, D.length - 1)];
      s.px(x, y, c);
    }
  }
  return s.outline("#241e26");
}

/** Mossy rocky crag (a heap of boulders) for rocky ground without real mountains. */
function crag(seed: number, w: number) {
  const r = seeded("crag" + seed);
  const H = Math.round(w * 0.72), s = new Spr(w, H);
  const top = Math.round(H * 0.42);
  // a flat-topped rock shelf: grassy top, then a cliff face with strata
  for (let x = 1; x < w - 1; x++) {
    const u = x / (w - 1);
    const t0 = Math.round(top - Math.sin(u * Math.PI) * top * 0.8 + (noise(x / 3, 1, seed) - 0.5) * 4);
    const b0 = H - 2 - Math.round((noise(x / 4, 2, seed) - 0.5) * 2) - (u < 0.1 || u > 0.9 ? 2 : 0);
    const face = Math.round(t0 + (b0 - t0) * 0.42);
    for (let y = Math.max(1, t0); y <= b0; y++) {
      if (y < face) s.px(x, y, y === t0 ? "#7ab04e" : hash(x, y, seed) > 0.55 ? "#5e9440" : "#4e8436");
      else {
        let f = 0.1 - u * 0.45 - (y - face) * 0.02;
        if ((y + (noise(x / 5, 3, seed) * 3 | 0)) % 3 === 0) f -= 0.18;
        if (noise(x / 1.5, 4, seed) > 0.72) f -= 0.2;
        if (y === face) f += 0.28;
        s.px(x, y, sh("#8a8274", f));
      }
    }
  }
  for (let i = 0; i < 3; i++) { const bx = r.int(2, w - 4), by = H - 2 - r.int(0, 1); s.px(bx, by, "#9a9284"); s.px(bx + 1, by, "#6a645a"); }
  return s.outline();
}

/** Low grassy mound, lit from the upper left, painted flat on the ground. */
function hillock(seed: number, w: number, pal: string[]) {
  const r = seeded("hillock" + seed);
  const H = Math.round(w * 0.45), s = new Spr(w, H);
  const blobs: Blob[] = [{ x: w / 2, y: H * 0.62, r: w * 0.46, ry: H * 0.5 }, { x: w * (0.35 + r.next() * 0.1), y: H * 0.55, r: w * 0.26, ry: H * 0.42 }, { x: w * (0.6 + r.next() * 0.1), y: H * 0.6, r: w * 0.24, ry: H * 0.38 }];
  lit(s, blobs, pal, { seed: r.int(0, 999), tex: 0.22, lift: -0.05 });
  for (let x = 0; x < w; x++) { let y = H - 1; while (y > 0 && !s.on(x, y)) y--; if (s.on(x, y)) s.px(x, y, sh(pal[0], -0.15)); }
  return s;
}

// ------------------------------------------------------------------ small props
function well(snow: boolean) {
  const s = new Spr(10, 11);
  s.ellipse(5, 8, 4, 2.3, "#8a8478"); s.ellipse(5, 7.6, 2.4, 1.3, "#1a2a3a"); s.span(2, 8, 9, "#6a645a"); s.px(2, 7, "#b0a898");
  for (let y = 2; y < 8; y++) { s.px(1, y, "#6a4428"); s.px(8, y, "#4a2e1a"); }
  for (let i = 0; i < 4; i++) s.span(1 + i - 1, 9 - i, 3 - i, snow ? (i < 2 ? "#eef3f8" : "#d0dcea") : i === 0 ? "#7a3a28" : "#a8503a");
  s.px(5, 5, "#6a5a4a");
  return s.outline();
}
function signpost() {
  const s = new Spr(9, 11);
  for (let y = 2; y < 10; y++) s.px(4, y, y < 4 ? "#8a5a30" : "#6a4428");
  s.span(1, 5, 3, "#b88a50"); s.px(0, 3, "#b88a50"); s.span(4, 7, 5, "#a07a44"); s.px(8, 5, "#a07a44");
  return s.outline();
}
function tent(seed: number, col: string, stripe?: string) {
  const s = new Spr(13, 10);
  for (let y = 1; y <= 8; y++) {
    const hw = (y - 1) * 0.75 + 0.5;
    for (let x = Math.round(6 - hw); x <= Math.round(6 + hw); x++) {
      let c = x < 6 ? sh(col, 0.12) : x === 6 ? sh(col, 0.25) : sh(col, -0.25);
      if (stripe && (x & 2)) c = x < 6 ? sh(stripe, 0.1) : sh(stripe, -0.25);
      s.px(x, y, c);
    }
  }
  for (let y = 5; y <= 8; y++) for (let x = 6 - (y - 5) * 0.5; x <= 6 + (y - 5) * 0.5; x++) s.px(x, y, "#1e1612");
  s.px(6, 0, "#5a3a22"); s.span(0, 12, 9, "#5a4a30");
  s.clear(0, 9); s.clear(12, 9);
  void seed;
  return s.outline();
}
function campfire() {
  const s = new Spr(9, 7);
  s.px(1, 5, "#8a8478"); s.px(7, 5, "#6a645a"); s.px(2, 6, "#6a645a"); s.px(6, 6, "#5a544a"); s.px(4, 6, "#7a746a");
  s.line(2, 5, 6, 4, "#6a4428"); s.line(2, 4, 6, 5, "#4a2e1a");
  s.px(4, 3, "#f8a030"); s.px(3, 4, "#f06020"); s.px(5, 4, "#f8a030"); s.px(4, 2, "#ffe070"); s.px(4, 4, "#fff0a0"); s.px(5, 3, "#f06020");
  return s;
}
function haystack(seed: number) {
  const s = new Spr(9, 8);
  lit(s, [{ x: 4.5, y: 4.6, r: 3.8, ry: 3.2 }], ["#7a5a1e", "#a07a2a", "#c8a03c", "#e0c060", "#f2dc8a"], { seed, tex: 0.5, clump: 1 });
  return s.outline();
}
function stall(col: string) {
  const s = new Spr(10, 9);
  for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) s.px(x, y, ((x >> 1) & 1) ? "#f0e8d8" : col);
  for (let x = 0; x < 10; x += 2) s.px(x, 3, col);
  s.px(1, 4, "#5a3a22"); s.px(1, 5, "#5a3a22"); s.px(8, 4, "#4a2e1a"); s.px(8, 5, "#4a2e1a");
  s.rect(1, 6, 8, 2, "#8a5a30"); s.span(1, 8, 6, "#a87040");
  s.px(2, 5, "#e84a3a"); s.px(4, 5, "#f4d040"); s.px(6, 5, "#6ab04a"); s.px(3, 5, "#f08a30");
  return s.outline();
}
function fountain() {
  const s = new Spr(13, 9);
  s.ellipse(6.5, 5.5, 6, 3, "#b0a898"); s.ellipse(6.5, 5.2, 4.6, 2, "#4a86b8"); s.px(4, 4, "#a8d8f0"); s.px(8, 5, "#a8d8f0");
  s.span(1, 11, 8, "#7a7268");
  s.rect(6, 1, 1, 4, "#c8c0b0"); s.px(7, 2, "#8a8278"); s.px(6, 0, "#d8f0ff"); s.px(5, 1, "#a8d8f0"); s.px(8, 1, "#a8d8f0");
  return s.outline();
}
function windmill(snow: boolean) {
  const s = new Spr(21, 27), cx = 10;
  for (let y = 9; y <= 25; y++) {
    const hw = 3 + (y - 9) * 0.18;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) s.px(x, y, sh("#e2d8c4", 0.08 - ((x - cx + hw) / (2 * hw)) * 0.4 - ((y % 4 === 0) ? 0.06 : 0)));
  }
  s.rect(cx - 1, 22, 2, 4, "#4a2c1a"); s.px(cx, 15, "#2a3a4a");
  for (let i = 0; i < 4; i++) { const hw = 1 + i; s.span(cx - hw, cx + hw, 6 + i, snow ? (i < 3 ? "#eef3f8" : "#c8d6e6") : sh("#8a4a32", 0.1 - i * 0.05)); }
  const hub = { x: cx, y: 9 };
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (let k = 1; k <= 8; k++) s.px(hub.x + dx * k, hub.y + dy * k, "#5a3a22");
    for (let k = 3; k <= 8; k++) s.px(hub.x + dx * k + (dy > 0 ? -dx : dx) * 0, hub.y + dy * k - dy, k % 2 ? "#efe6cf" : "#c8bca0");
  }
  s.px(hub.x, hub.y, "#3a2416");
  return s.outline();
}
function wagon(cover: boolean) {
  const s = new Spr(16, 11);
  s.rect(2, 6, 12, 2, "#7a5030"); s.span(2, 13, 6, "#9a6a3c");
  if (cover) for (let y = 1; y < 6; y++) { const hw = y === 1 ? 4 : 5.5; for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) s.px(x, y, x < 8 ? (x % 3 ? "#efe6cf" : "#d8ccb0") : x % 3 ? "#c8bca0" : "#b0a488"); }
  else { s.rect(3, 4, 10, 2, "#8a5a34"); s.px(5, 3, "#c8a040"); s.px(9, 3, "#6a4a2a"); }
  for (const wx of [4, 11]) { s.ellipse(wx, 8.5, 2, 2, "#3a2a1e"); s.px(wx, 8, "#8a6a42"); }
  s.line(14, 7, 15, 8, "#6a4428");
  return s.outline();
}
function stairs() {
  const s = new Spr(10, 8);
  s.rect(0, 0, 10, 8, "#9a948a"); s.rect(1, 1, 8, 6, "#1a1416");
  for (let k = 0; k < 3; k++) s.span(2, 7, 2 + k * 2, sh("#6a645c", -k * 0.15));
  s.span(0, 9, 0, "#c0bab0"); s.px(9, 3, "#6a645a");
  return s.outline();
}
function rowboat() {
  const s = new Spr(12, 6);
  for (let x = 1; x < 11; x++) { const d = x < 2 || x > 9 ? 1 : 0; s.px(x, 2 + d, "#a8743e"); s.px(x, 3, x < 2 || x > 9 ? "#6a4428" : "#5a3a22"); if (!d) s.px(x, 4, "#4a2c18"); }
  s.span(2, 9, 2, "#c08a50"); s.px(5, 3, "#8a5a30"); s.line(6, 1, 9, 0, "#8a6a42");
  return s.outline();
}
function ship(seed: number, ghost: boolean) {
  const s = new Spr(26, 27);
  const hull = ghost ? "#3a3438" : "#6a3e22", sail = ghost ? "#8a8a86" : "#efe6cf";
  for (let y = 18; y <= 24; y++) {
    const t = (y - 18) / 6, l = 2 + Math.round(t * 3), r = 23 - Math.round(t * t * 5);
    for (let x = l; x <= r; x++) s.px(x, y, y === 18 ? sh(hull, 0.45) : y % 2 ? sh(hull, -0.1 - (x - l) / (r - l) * 0.2) : sh(hull, 0.08 - (x - l) / (r - l) * 0.2));
  }
  s.rect(2, 15, 6, 3, sh(hull, 0.05)); s.span(2, 7, 15, sh(hull, 0.4)); s.px(4, 16, "#f6c460");
  for (let y = 1; y < 18; y++) s.px(13, y, "#4a2c18");
  for (let y = 4; y < 16; y++) for (let x = 7; x <= 19; x++) {
    const t = (y - 4) / 12, bulge = Math.sin(t * Math.PI) * 1.5;
    if (x < 7 + bulge || x > 19 - bulge * 0.3) continue;
    if (ghost && hash(x, y, seed) > 0.8) continue;
    s.px(x, y, x < 13 ? sh(sail, 0.05 - t * 0.1) : sh(sail, -0.15 - t * 0.12));
  }
  if (!ghost) for (let x = 7; x <= 19; x++) s.px(x, 9, x < 13 ? "#b8402e" : "#94301e");
  s.span(7, 19, 4, "#5a3a22"); s.span(8, 18, 16, "#5a3a22");
  s.rect(14, 0, 4, 2, ghost ? "#2a2a2a" : "#c83a2a");
  s.line(23, 18, 25, 15, "#5a3a22");
  return s.outline();
}
function watchtowerWood(snow: boolean) {
  const s = new Spr(14, 28);
  for (let y = 12; y <= 26; y++) { s.px(2, y, "#7a5030"); s.px(11, y, "#4a2e1a"); s.px(5, y, "#6a4428"); s.px(8, y, "#5a3a22"); }
  s.line(2, 14, 11, 20, "#5a3a22"); s.line(11, 14, 2, 20, "#6a4428"); s.line(2, 20, 11, 26, "#5a3a22");
  s.rect(1, 10, 12, 3, "#8a5a34"); s.span(1, 12, 10, "#a87444"); s.span(1, 12, 12, "#5a3a22");
  for (let y = 7; y < 10; y++) { s.px(1, y, "#6a4428"); s.px(12, y, "#4a2e1a"); }
  for (let i = 0; i < 6; i++) s.span(6 - i - 1, 7 + i + 1, 1 + i, snow ? (i < 4 ? "#eef3f8" : "#c8d6e6") : sh("#b89048", 0.1 - i * 0.04 - (i === 5 ? 0.3 : 0)));
  return s.outline();
}
function garden(seed: number, cold: boolean) {
  const s = new Spr(13, 9);
  s.rect(1, 2, 11, 6, cold ? "#c8d0d8" : "#6a4a2e");
  if (!cold) for (let y = 3; y < 8; y += 2) for (let x = 2; x < 11; x++) if (hash(x, y, seed) > 0.25) s.px(x, y, (x + y) % 3 ? "#5aa040" : "#7ac050");
  if (!cold && seed % 2) { s.px(4, 5, "#e8503a"); s.px(8, 3, "#e8503a"); s.px(6, 7, "#f0a030"); }
  for (let x = 0; x < 13; x++) { s.px(x, 1, x % 3 === 0 ? "#c8a070" : "#9a7048"); s.px(x, 8, x % 3 === 0 ? "#c8a070" : "#9a7048"); }
  for (let y = 1; y < 9; y++) { s.px(0, y, "#9a7048"); s.px(12, y, "#7a5030"); }
  for (let x = 0; x < 13; x += 3) { s.px(x, 0, "#d8b080"); s.px(x, 7, "#d8b080"); }
  return s.outline();
}
function stumps() {
  const s = new Spr(6, 5);
  s.rect(1, 1, 4, 3, "#7a5030"); s.span(1, 4, 1, "#c8a070"); s.px(2, 1, "#a07a4a"); s.px(4, 2, "#5a3a22"); s.px(0, 3, "#5a3a22");
  return s.outline();
}
function woodpile() {
  const s = new Spr(9, 5);
  for (let i = 0; i < 4; i++) { s.px(1 + i * 2, 3, "#c8a070"); s.px(2 + i * 2, 3, "#8a5a30"); }
  for (let i = 0; i < 3; i++) { s.px(2 + i * 2, 2, "#c8a070"); s.px(3 + i * 2, 2, "#8a5a30"); }
  return s.outline();
}
function cactus() {
  const s = new Spr(9, 12);
  for (let y = 1; y < 11; y++) { s.px(4, y, "#5a9a45"); s.px(5, y, "#2f6b33"); }
  for (let y = 4; y < 7; y++) s.px(1, y, "#5a9a45"); s.span(1, 3, 7, "#4f8a3a");
  for (let y = 3; y < 6; y++) s.px(7, y, "#2f6b33"); s.span(6, 7, 6, "#2f6b33");
  return s.outline();
}

// ------------------------------------------------------------------ the painter
export const G = { GRASS: 0, FOREST: 1, MEADOW: 2, HILL: 3, ROCK: 4, SNOW: 5, SAND: 6, SWAMP: 7, DIRT: 8 } as const;
const GROUND: string[][] = [
  ["#3a7234", "#45823e", "#519248", "#62a252"],
  ["#2b5a2e", "#336634", "#3c733a", "#478142"],
  ["#539240", "#60a048", "#6eae50", "#80bc5c"],
  ["#6c883a", "#7a9642", "#88a44c", "#9ab25a"],
  ["#6e6858", "#7d7666", "#8c8574", "#9c9582"],
  ["#b6c4d6", "#cad6e4", "#dce5ef", "#eef3f9"],
  ["#c8a668", "#d5b576", "#e0c284", "#eacf96"],
  ["#323e2a", "#3b4930", "#455436", "#51603d"],
  ["#6c5236", "#7a5e3e", "#886a46", "#967650"],
];
const GROUND32 = GROUND.map((p) => p.map(c32));
const AMP = [0.35, 0.3, 0.25, 1.0, 1.25, 0.7, 0.45, 0.12, 0.2];
const WATER = {
  fresh: ["#23507c", "#2b5e8c", "#3772a2", "#4c8ab8", "#6aa6cc"],
  sea: ["#1c4876", "#24588a", "#2e6c9e", "#3f86b6", "#5ea2cc"],
  swamp: ["#20362c", "#284436", "#325240", "#40624c", "#527458"],
  ice: ["#8cb2d2", "#9ec0dc", "#b2d0e6", "#c6deee", "#dceaf4"],
};
const W32 = Object.fromEntries(Object.entries(WATER).map(([k, v]) => [k, v.map(c32)])) as Record<keyof typeof WATER, number[]>;

export interface ArtNode { id: string; x: number; y: number; bg: Bg; imp: number }
export interface ArtInput {
  key: string;
  w: number; h: number;
  nodes: ArtNode[];
  /** Ground kind (G) per tile. */
  kind: Uint8Array;
  /** Tree density 0..1 per tile. */
  trees: Float32Array;
  /** Built-up district id per tile (0 = none). */
  district: Uint16Array;
  /** District ids that get a town wall. */
  walled: Set<number>;
  roads: Pt[][];
  rivers: Pt[][];
  lakes: { x: number; y: number; rx: number; ry: number; sea: boolean; swamp?: boolean }[];
  cold: boolean;
}
export interface MapFx { smoke: Pt[]; fires: Pt[]; glints: Pt[] }

interface Obj { cv: HTMLCanvasElement; x: number; y: number; z: number }

/** Chamfer distance (in px, capped) from every cell to the nearest cell where `src` is set. */
function distance(src: Uint8Array, W: number, H: number, cap = 60, lab?: Uint8Array) {
  const d = new Uint16Array(W * H), INF = cap * 3;
  for (let i = 0; i < W * H; i++) d[i] = src[i] ? 0 : INF;
  const L = lab ?? new Uint8Array(0), hasL = !!lab;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const i = r + x;
      let v = d[i];
      if (!v) continue;
      let j = -1, c: number;
      if (x > 0 && (c = d[i - 1] + 3) < v) { v = c; j = i - 1; }
      if (y > 0) {
        if ((c = d[i - W] + 3) < v) { v = c; j = i - W; }
        if (x > 0 && (c = d[i - W - 1] + 4) < v) { v = c; j = i - W - 1; }
        if (x < W - 1 && (c = d[i - W + 1] + 4) < v) { v = c; j = i - W + 1; }
      }
      if (j >= 0) { d[i] = v; if (hasL) L[i] = L[j]; }
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const r = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const i = r + x;
      let v = d[i];
      if (!v) continue;
      let j = -1, c: number;
      if (x < W - 1 && (c = d[i + 1] + 3) < v) { v = c; j = i + 1; }
      if (y < H - 1) {
        if ((c = d[i + W] + 3) < v) { v = c; j = i + W; }
        if (x < W - 1 && (c = d[i + W + 1] + 4) < v) { v = c; j = i + W + 1; }
        if (x > 0 && (c = d[i + W - 1] + 4) < v) { v = c; j = i + W - 1; }
      }
      if (j >= 0) { d[i] = v; if (hasL) L[i] = L[j]; }
    }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = Math.min(255, Math.round(d[i] / 3));
  return out;
}

// occupancy bits (2px cells)
const O_WATER = 1, O_ROAD = 2, O_DIST = 4, O_BLD = 8, O_FIELD = 16, O_CLEAR = 32, O_WALL = 64;

export function paintMap(inp: ArtInput): { art: HTMLCanvasElement; fx: MapFx } {
  const { w, h, nodes, kind, cold } = inp;
  const TSZ = 16, W = w * TSZ, H = h * TSZ;
  const R = seeded("map:" + inp.key);
  const S = Math.floor(R.next() * 1000);
  const fx: MapFx = { smoke: [], fires: [], glints: [] };

  // ---------------------------------------------------------- water and road masks
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const wc = mk(), wg = wc.getContext("2d")!;
  const blobPath = (g: CanvasRenderingContext2D, l: { x: number; y: number; rx: number; ry: number }, seed: number) => {
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2, k = 0.82 + noise(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, seed) * 0.36;
      const x = (l.x + 0.5) * TSZ + Math.cos(a) * l.rx * TSZ * k, y = (l.y + 0.5) * TSZ + Math.sin(a) * l.ry * TSZ * k;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.fill();
  };
  inp.lakes.forEach((l, i) => { wg.fillStyle = l.sea ? "#ff0000" : l.swamp ? "#0000ff" : "#00ff00"; blobPath(wg, l, S + i); });
  wg.lineCap = "round"; wg.lineJoin = "round"; wg.strokeStyle = "#00ff00";
  inp.rivers.forEach((rv, ri) => {
    for (let i = 0; i < rv.length - 1; i++) {
      wg.lineWidth = 9 + noise(i / 5, ri, S + 31) * 6;
      wg.beginPath(); wg.moveTo((rv[i].x + 0.5) * TSZ, (rv[i].y + 0.5) * TSZ); wg.lineTo((rv[i + 1].x + 0.5) * TSZ, (rv[i + 1].y + 0.5) * TSZ); wg.stroke();
    }
  });
  const wd = wg.getImageData(0, 0, W, H).data;
  const water = new Uint8Array(W * H), waterKind = new Uint8Array(W * H); // 0 fresh 1 sea 2 swamp
  for (let i = 0; i < W * H; i++) {
    const r = wd[i * 4], g = wd[i * 4 + 1], b = wd[i * 4 + 2];
    if (r > 110 || g > 110 || b > 110) { water[i] = 1; waterKind[i] = r >= g && r >= b ? 1 : b > g ? 2 : 0; }
  }
  const rc = mk(), rg = rc.getContext("2d")!;
  rg.lineCap = "round"; rg.lineJoin = "round"; rg.globalCompositeOperation = "lighter";
  const roadPath = (pts: Pt[]) => { rg.beginPath(); pts.forEach((p, i) => (i ? rg.lineTo((p.x + 0.5) * TSZ, (p.y + 0.5) * TSZ) : rg.moveTo((p.x + 0.5) * TSZ, (p.y + 0.5) * TSZ))); rg.stroke(); };
  for (const [lw, col] of [[8, "#0000ff"], [5, "#00ff00"], [2, "#ff0000"]] as const) { rg.lineWidth = lw; rg.strokeStyle = col; for (const p of inp.roads) roadPath(p); }
  const rd = rg.getImageData(0, 0, W, H).data;
  const road = new Uint8Array(W * H); // 1 rim, 2 body, 3 core
  for (let i = 0; i < W * H; i++) road[i] = rd[i * 4] > 120 ? 3 : rd[i * 4 + 1] > 120 ? 2 : rd[i * 4 + 2] > 120 ? 1 : 0;
  const dIn = distance(water.map((v) => (v ? 0 : 1)), W, H, 40);
  const seaLab = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) seaLab[i] = water[i] && waterKind[i] === 1 ? 1 : 0;
  const dOut = distance(water, W, H, 40, seaLab);
  const isSeaNear = seaLab;

  // ---------------------------------------------------------- occupancy
  const OW = W >> 1, OH = H >> 1, occ = new Uint8Array(OW * OH);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = (y >> 1) * OW + (x >> 1);
    if (water[i]) occ[o] |= O_WATER;
    if (road[i] >= 2) occ[o] |= O_ROAD;
  }
  const distAt = (x: number, y: number) => { const tx = Math.floor(x / TSZ), ty = Math.floor(y / TSZ); return tx >= 0 && ty >= 0 && tx < w && ty < h ? inp.district[ty * w + tx] : 0; };
  for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) if (distAt(ox * 2, oy * 2)) occ[oy * OW + ox] |= O_DIST;
  const any = (x0: number, y0: number, x1: number, y1: number, bits: number) => {
    const a = Math.max(0, Math.floor(x0 / 2)), b = Math.max(0, Math.floor(y0 / 2)), c = Math.min(OW - 1, Math.floor(x1 / 2)), d = Math.min(OH - 1, Math.floor(y1 / 2));
    if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) return true;
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) if (occ[y * OW + x] & bits) return true;
    return false;
  };
  const all = (x0: number, y0: number, x1: number, y1: number, bits: number) => {
    const a = Math.max(0, Math.floor(x0 / 2)), b = Math.max(0, Math.floor(y0 / 2)), c = Math.min(OW - 1, Math.floor(x1 / 2)), d = Math.min(OH - 1, Math.floor(y1 / 2));
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) if (!(occ[y * OW + x] & bits)) return false;
    return true;
  };
  const mark = (x0: number, y0: number, x1: number, y1: number, bit: number) => {
    const a = Math.max(0, Math.floor(x0 / 2)), b = Math.max(0, Math.floor(y0 / 2)), c = Math.min(OW - 1, Math.floor(x1 / 2)), d = Math.min(OH - 1, Math.floor(y1 / 2));
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) occ[y * OW + x] |= bit;
  };

  const objs: Obj[] = [];
  const shadows: { x: number; y: number; rx: number; ry: number; a: number }[] = [];
  const yards: { x: number; y: number; r: number; k: "dirt" | "pave" }[] = [];
  const fields: { x: number; y: number; w: number; h: number; t: number; seed: number }[] = [];
  const put = (cv: HTMLCanvasElement, x: number, y: number, z = y + cv.height) => objs.push({ cv, x: Math.round(x), y: Math.round(y), z });
  /** Places a building-like sprite with its base centred at (cx, by). */
  const place = (sp: { cv: HTMLCanvasElement; w: number; h: number; chim?: Pt | null }, cx: number, by: number, o: { force?: boolean; avoid?: number; shadow?: number } = {}) => {
    const x = Math.round(cx - sp.w / 2), y = Math.round(by - sp.h);
    const fy = y + Math.round(sp.h * 0.45);
    if (!o.force && any(x + 1, fy, x + sp.w - 2, by, o.avoid ?? (O_WATER | O_ROAD | O_BLD | O_WALL))) return false;
    mark(x + 1, y + 3, x + sp.w - 2, by + 1, O_BLD);
    put(sp.cv, x, y);
    if (o.shadow !== 0) shadows.push({ x: x + sp.w * 0.58, y: by - 1, rx: sp.w * 0.55, ry: 3.2, a: o.shadow ?? 1 });
    if (sp.chim) fx.smoke.push({ x: x + sp.chim.x, y: y + sp.chim.y });
    return true;
  };
  const sprite = (s: Spr) => ({ cv: cvOf(s), w: s.w, h: s.h });

  // ---------------------------------------------------------- per-node room and clearings
  const room = nodes.map((n, i) => {
    let d = 99;
    nodes.forEach((m, j) => { if (j !== i) d = Math.min(d, Math.hypot(m.x - n.x, m.y - n.y)); });
    return d * TSZ;
  });
  for (const n of nodes) { const cx = n.x * TSZ + 8, cy = n.y * TSZ + 8; mark(cx - 5, cy - 5, cx + 5, cy + 7, O_CLEAR); }

  const kindAtTile = (tx: number, ty: number) => kind[clamp(ty, 0, h - 1) * w + clamp(tx, 0, w - 1)];
  const castleStyle: CastleStyle = {
    stone: R.pick(["#a8a294", "#9c978c", "#b0a898"]), roof: R.pick(["#4e5a74", "#8a3a2e", "#3e5a6a", "#7a4030"]), banner: R.pick(["#b8302a", "#2a5aa8", "#c8a030", "#2a7a4a"]), snow: cold,
  };

  // ---------------------------------------------------------- town walls
  const D = inp.district;
  const inD = (tx: number, ty: number, id: number) => tx >= 0 && ty >= 0 && tx < w && ty < h && D[ty * w + tx] === id;
  const ST = castleStyle.stone;
  const towerSm = sprite(tower(S, { w: 8, h: 14, top: "cone", roof: castleStyle.roof, stone: ST, flag: null, snow: cold }));
  const towerFl = sprite(tower(S + 1, { w: 8, h: 15, top: "cone", roof: castleStyle.roof, stone: ST, flag: castleStyle.banner, snow: cold }));
  const towers: Pt[] = [];
  const addTower = (sp: { cv: HTMLCanvasElement; w: number; h: number }, cx: number, by: number) => {
    if (towers.some((t) => Math.abs(t.x - cx) < 17 && Math.abs(t.y - by) < 17)) return;
    towers.push({ x: cx, y: by });
    place(sp, cx, by, { force: true });
  };
  const roadAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H ? road[Math.round(y) * W + Math.round(x)] : 0;
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const id = D[ty * w + tx];
    if (!id || !inp.walled.has(id)) continue;
    const X = tx * TSZ, Y = ty * TSZ;
    const n = !inD(tx, ty - 1, id), s = !inD(tx, ty + 1, id), wv = !inD(tx - 1, ty, id), e = !inD(tx + 1, ty, id);
    const seg = (horiz: boolean, x: number, y: number) => {
      const len = 16;
      const gate = horiz ? [...Array(len).keys()].some((i) => roadAt(x + i, y + 4) >= 2) : [...Array(len).keys()].some((i) => roadAt(x + 2, y + i) >= 2);
      const wetN = horiz ? water[(y + 4) * W + x + 8] : water[(y + 8) * W + x + 2];
      if (wetN) return;
      const sp = new Spr(horiz ? len : 6, horiz ? 10 : len + 2);
      if (horiz) {
        wallH(sp, 0, 0, len, ST, cold);
        if (gate) for (let i = 0; i < len; i++) if (roadAt(x + i, y + 4) >= 1) for (let j = 0; j < 10; j++) sp.clear(i, j);
        mark(x, y + 1, x + len - 1, y + 9, O_WALL);
        put(cvOf(sp), x, y, y + 9);
      } else {
        for (let j = 0; j < len + 2; j++) {
          const row = j;
          sp.px(0, j, (row % 3) !== 2 ? (cold ? "#eef3f8" : sh(ST, 0.2)) : sh(ST, -0.2));
          sp.px(1, j, sh(ST, 0.3)); sp.px(2, j, sh(ST, 0.15)); sp.px(3, j, sh(ST, 0.05)); sp.px(4, j, sh(ST, -0.35));
          if ((row % 3) !== 2) sp.px(5, j, cold ? "#d0dcea" : sh(ST, -0.1)); else sp.px(5, j, sh(ST, -0.45));
        }
        if (gate) for (let j = 0; j < len + 2; j++) if (roadAt(x + 2, y + j) >= 1) for (let i = 0; i < 6; i++) sp.clear(i, j);
        mark(x, y, x + 5, y + len, O_WALL);
        put(cvOf(sp), x, y, y + len);
      }
      if (gate) {
        const gx = horiz ? x + [...Array(len).keys()].find((i) => roadAt(x + i, y + 4) >= 2)! : x + 3;
        const gy = horiz ? y + 9 : y + [...Array(len).keys()].find((i) => roadAt(x + 2, y + i) >= 2)!;
        if (horiz) { addTower(towerFl, gx - 8, gy + 1); addTower(towerFl, gx + 9, gy + 1); }
        else { addTower(towerSm, gx, gy - 6); addTower(towerSm, gx, gy + 12); }
      }
    };
    if (n) seg(true, X, Y);
    if (s) seg(true, X, Y + TSZ - 10);
    if (wv) seg(false, X, Y - (n ? 0 : 1));
    if (e) seg(false, X + TSZ - 6, Y - (n ? 0 : 1));
    // towers at corners and along long runs
    const corner = (cx: number, by: number) => addTower(towerSm, cx, by);
    if (n && wv) corner(X + 3, Y + 9);
    if (n && e) corner(X + TSZ - 3, Y + 9);
    if (s && wv) corner(X + 3, Y + TSZ);
    if (s && e) corner(X + TSZ - 3, Y + TSZ);
    if (!n && !wv && inD(tx, ty - 1, id) && inD(tx - 1, ty, id) && !inD(tx - 1, ty - 1, id)) corner(X + 3, Y + 9);
    if (!n && !e && inD(tx, ty - 1, id) && inD(tx + 1, ty, id) && !inD(tx + 1, ty - 1, id)) corner(X + TSZ - 3, Y + 9);
    if (!s && !wv && inD(tx, ty + 1, id) && inD(tx - 1, ty, id) && !inD(tx - 1, ty + 1, id)) corner(X + 3, Y + TSZ);
    if (!s && !e && inD(tx, ty + 1, id) && inD(tx + 1, ty, id) && !inD(tx + 1, ty + 1, id)) corner(X + TSZ - 3, Y + TSZ);
    if (n && !wv && !e && tx % 4 === 0) corner(X + 8, Y + 9);
    if (s && !wv && !e && tx % 4 === 2) corner(X + 8, Y + TSZ);
  }

  // ---------------------------------------------------------- landmarks of the places
  const has = (id: string, re: RegExp) => re.test(id);
  const order = nodes.map((n, i) => i).sort((a, b) => nodes[b].imp - nodes[a].imp || room[b] - room[a]);
  const villageLike: number[] = [];
  for (const i of order) {
    const n = nodes[i], id = n.id, rm = room[i], cx = n.x * TSZ + 8, cy = n.y * TSZ + 8;
    const r = seeded(inp.key + id);
    const inDist = !!D[n.y * w + n.x];
    const big = rm >= 60, mid = rm >= 36;
    const bg = n.bg;
    const around = (sp: { cv: HTMLCanvasElement; w: number; h: number; chim?: Pt | null }, dmin: number, dmax: number, tries = 14, avoid?: number) => {
      for (let t = 0; t < tries; t++) {
        const a = r.next() * Math.PI * 2, d = dmin + r.next() * (dmax - dmin);
        if (place(sp, cx + Math.cos(a) * d, cy + 6 + Math.sin(a) * d * 0.75, { avoid })) return true;
      }
      return false;
    };
    const behind = (sp: { cv: HTMLCanvasElement; w: number; h: number; chim?: Pt | null }, force = true) => place(sp, cx - (sp.w < 26 ? 7 : 0), cy - 4, { force });
    if (inDist) {
      if (bg === "castle") behind(castleSprite(rm >= 56 ? 2 : rm >= 30 ? 1 : 0, r.int(0, 5), castleStyle), true);
      else if (bg === "hall") behind(houseSprite("hall", r.int(0, 5), cold));
      else if (bg === "city" && n.imp >= 4) { behind(castleSprite(2, r.int(0, 5), castleStyle)); yards.push({ x: cx, y: cy + 10, r: 18, k: "pave" }); place(sprite(fountain()), cx - 16, cy + 16, { force: true }); }
      else if (bg === "temple") behind(sprite(cached("temple" + mid + cold, () => temple(1, mid, cold))));
      else if (bg === "inn") behind(houseSprite("inn", r.int(0, 5), cold));
      else if (bg === "dungeon" || bg === "tunnel" || bg === "cave") place(sprite(cached("stairs", stairs)), cx + 6, cy + 2, { force: true });
      else if (bg === "forest" || bg === "field") { for (let k = 0; k < 3; k++) place(sprite(cached("oak" + k, () => oak(k, PAL.oak))), cx - 12 + k * 10, cy + 2 + (k & 1) * 6, { force: false, avoid: O_WATER | O_BLD | O_WALL }); }
      if ((bg === "city" || bg === "town") && n.imp < 4 && r.chance(0.6)) { const ok = place(sprite(cached("well" + cold, () => well(cold))), cx + 10, cy + 4); if (!ok) place(sprite(cached("stall0", () => stall("#c83a2a"))), cx - 10, cy + 6); }
      continue;
    }
    switch (bg) {
      case "city": case "town": case "village": case "inn": {
        if (bg === "inn" || has(id, /inn|tavern/)) {
          behind(houseSprite("inn", r.int(0, 7), cold));
          around(houseSprite("barn", r.int(0, 3), cold), 18, 26);
          around(sprite(cached("wagon0", () => wagon(true))), 14, 22);
          yards.push({ x: cx, y: cy + 4, r: 12, k: "dirt" });
          villageLike.push(i);
          break;
        }
        if (has(id, /burnt|abandon|deserted/)) { behind(houseSprite("ruined", r.int(0, 5), cold)); break; }
        if (has(id, /house|cottage|cabin|hut$|home|shop/) && !has(id, /huts/)) { behind(houseSprite(has(id, /stone/) ? "stone" : "cottage", r.int(0, 15), cold)); around(sprite(cached("woodpile", woodpile)), 10, 14); villageLike.push(i); break; }
        const nH = has(id, /huts/) ? 3 : big ? 5 : mid ? 4 : rm >= 26 ? 3 : 2;
        if (has(id, /farm/)) { behind(houseSprite("big", r.int(0, 7), cold)); around(houseSprite("barn", r.int(0, 3), cold), 16, 24); around(sprite(cached("hay" + 1, () => haystack(1))), 12, 20); around(sprite(cached("hay" + 2, () => haystack(2))), 12, 22); }
        else {
          let placed = 0;
          for (let k = 0; k < 40 && placed < nH; k++) {
            const a = (placed / nH) * Math.PI * 2 + r.next() * 1.2 - 0.6 - Math.PI / 2;
            const d = 13 + k * 0.7 + r.next() * Math.min(10, rm * 0.25);
            const sp = houseSprite(r.chance(0.2) ? "big" : "cottage", r.int(0, 15), cold);
            if (place(sp, cx + Math.cos(a) * d * 1.2, cy + 5 + Math.sin(a) * d * 0.8)) placed++;
          }
          if (!placed) { behind(houseSprite("cottage", r.int(0, 15), cold)); placed = 1; }
          for (let g = 0; g < (nH >= 3 ? 2 : 1); g++) around(sprite(cached("garden" + g + cold, () => garden(g, cold))), 14, 26, 10);
          if (r.chance(0.6)) around(sprite(cached("woodpile", woodpile)), 10, 20, 6);
          if (nH >= 3) place(sprite(cached("well" + cold, () => well(cold))), cx + 7, cy + 1);
          if (r.chance(0.5)) around(sprite(cached("hay3", () => haystack(3))), 18, 30);
        }
        yards.push({ x: cx, y: cy + 3, r: 6 + nH, k: "dirt" });
        villageLike.push(i);
        break;
      }
      case "castle": behind(castleSprite(big ? 2 : mid ? 1 : 0, r.int(0, 5), castleStyle)); break;
      case "hall": behind(houseSprite("hall", r.int(0, 5), cold)); break;
      case "temple": behind(sprite(cached("temple" + mid + cold, () => temple(1, mid, cold)))); break;
      case "ruins":
        if (has(id, /crypt|tomb|grave/)) behind(sprite(cached("grave" + cold, () => graveyard(2, cold))));
        else behind(sprite(cached("ruin" + (mid ? 38 : 28) + cold + (r.int(0, 2)), () => ruins(r.int(0, 99), mid ? 38 : 28, cold))));
        break;
      case "cave": case "tunnel": case "dungeon": {
        const k = has(id, /mine|shaft|gallery|ore/) ? "mine" : bg === "dungeon" ? (has(id, /grave|crypt|tomb/) ? "grave" : "dungeon") : bg === "tunnel" ? "tunnel" : "cave";
        if (k === "grave") { behind(sprite(cached("grave" + cold, () => graveyard(2, cold)))); break; }
        const sz = rm >= 48 ? 30 : rm >= 30 ? 24 : 18;
        behind(sprite(cached(`crop:${k}:${sz}:${cold}:${r.int(0, 3)}`, () => outcrop(r.int(0, 999), sz, k as "cave", cold))));
        if (k === "dungeon") fx.fires.push({ x: cx - sz * 0.15 - 3, y: cy - 6 }, { x: cx + sz * 0.15 + 3, y: cy - 6 });
        break;
      }
      case "camp": {
        place(sprite(cached("fire", campfire)), cx + 1, cy + 6, { force: true, shadow: 0 });
        fx.fires.push({ x: cx + 1, y: cy + 3 });
        const cols = ["#d8c8a0", "#7a8a4a", "#c8b088", "#a85a3a"];
        const nT = big ? 4 : mid ? 3 : 2;
        for (let k = 0; k < nT; k++) around(sprite(cached("tent" + k, () => tent(k, cols[k], k === 3 ? "#e8dcc0" : undefined))), 11, 17, 10);
        if (has(id, /wagon|player|troupe|troubadour/)) around(sprite(cached("wagon0", () => wagon(true))), 16, 22);
        if (has(id, /fort/)) for (let k = 0; k < 2; k++) around(sprite(cached("wt" + cold, () => watchtowerWood(cold))), 18, 26);
        yards.push({ x: cx, y: cy + 4, r: 12, k: "dirt" });
        break;
      }
      case "mountain": {
        const n2 = big ? 3 : mid ? 2 : 1;
        for (let k = 0; k < n2; k++) {
          const pw = (big ? 34 : mid ? 28 : 20) - k * 6;
          const p = sprite(cached(`peak:${pw}:${r.int(0, 3)}`, () => peak(r.int(0, 999), pw, Math.round(pw * 0.85), 0.42)));
          const ox = k === 0 ? 0 : (k === 1 ? -1 : 1) * pw * 0.7;
          place(p, cx + ox, cy - 2 - (k ? 4 : 0), { force: k === 0, shadow: 0 });
        }
        if (has(id, /camp|shelter/)) around(sprite(cached("tent1", () => tent(1, "#7a8a4a"))), 10, 14);
        break;
      }
      case "hill":
        if (has(id, /mine|tunnel/)) behind(sprite(cached(`crop:mine:24:${cold}:0`, () => outcrop(7, 24, "mine", cold))));
        else if (has(id, /monastery/)) behind(sprite(cached("ruin38" + cold + "m", () => ruins(5, 38, cold))));
        else if (has(id, /hut/)) behind(houseSprite("cottage", r.int(0, 15), cold));
        else if (has(id, /quarry|gantry/)) { behind(sprite(cached(`crop:cave:24:${cold}:1`, () => outcrop(8, 24, "cave", cold)))); around(sprite(cached("wagon1", () => wagon(false))), 12, 18); }
        else { place(sprite(cached("boulder12" + cold, () => boulder(3, 12, cold))), cx + 4, cy - 1, { force: true }); around(sprite(cached("boulder8" + cold, () => boulder(4, 8, cold))), 8, 14); }
        break;
      case "forest":
        if (has(id, /watchtower|guard/)) behind(sprite(cached("wt" + cold, () => watchtowerWood(cold))));
        else if (has(id, /great-tree|ancient|druid/)) behind(sprite(cached("bigoak", () => oak(77, PAL.oak, 2.1))));
        else if (has(id, /cabin|hut|cottage|house/)) behind(houseSprite(has(id, /burnt|deserted/) ? "ruined" : "cottage", r.int(0, 15), cold));
        else if (has(id, /wagon/)) behind(sprite(cached("wagon0", () => wagon(true))));
        else if (has(id, /rock|stone|boulder/)) behind(sprite(cached("boulder14" + cold, () => boulder(5, 14, cold))));
        else { place(sprite(cached("stumps", stumps)), cx - 7, cy + 4, { force: true }); }
        break;
      case "road":
        if (has(id, /tower/)) behind(sprite(tower(9, { w: 8, h: 18, top: "crenel", roof: castleStyle.roof, stone: ST, flag: castleStyle.banner, snow: cold })));
        else if (has(id, /wagon/)) place(sprite(cached("wagon1", () => wagon(false))), cx + 8, cy + 2, { force: true });
        else place(sprite(cached("sign", signpost)), cx + 7, cy + 4, { force: true });
        break;
      case "field": case "sky":
        if (has(id, /camp|tent/)) { place(sprite(cached("tent0", () => tent(0, "#d8c8a0"))), cx, cy - 1, { force: true }); fx.fires.push({ x: cx + 9, y: cy + 4 }); place(sprite(cached("fire", campfire)), cx + 9, cy + 7, { force: true, shadow: 0 }); }
        else if (has(id, /shrine/)) behind(sprite(cached("temple" + false + cold, () => temple(1, false, cold))));
        else if (has(id, /rock/)) behind(sprite(cached("boulder14" + cold, () => boulder(5, 14, cold))));
        else if (has(id, /cottage|outbuilding|house/)) { behind(houseSprite(has(id, /burnt/) ? "ruined" : "cottage", r.int(0, 15), cold)); villageLike.push(i); }
        else if (bg === "field" && !cold && mid && r.chance(0.6)) { behind(sprite(cached("mill" + cold, () => windmill(cold)))); villageLike.push(i); }
        else if (bg === "field" && !cold) { place(sprite(cached("hay1", () => haystack(1))), cx + 7, cy + 2); place(sprite(cached("hay2", () => haystack(2))), cx - 6, cy + 6); villageLike.push(i); }
        break;
      case "swamp":
        for (let k = 0; k < 3; k++) around(sprite(cached("dead" + k, () => deadTree(k))), 8, 18, 6, O_WATER | O_BLD | O_ROAD);
        break;
      case "desert":
        place(sprite(cached("boulder10", () => boulder(6, 10, false, false))), cx + 8, cy);
        around(sprite(cached("cactus", cactus)), 10, 18);
        break;
      case "ship": case "sea": {
        if (bg === "sea" && !has(id, /fleet|battle|boat|galley|wreck/)) break;
        const ghost = has(id, /ghost|death|hulk|wreck/);
        const sp = sprite(cached("ship" + ghost, () => ship(3, ghost)));
        place(sp, cx, cy + 6, { force: true, shadow: 0 });
        if (has(id, /fleet|battle/)) { place(sp, cx - 26, cy + 14, { force: true, shadow: 0 }); place(sp, cx + 24, cy + 2, { force: true, shadow: 0 }); }
        break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------- docks and boats by the water
  const docks: { x: number; y: number; dx: number; dy: number; len: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!["coast", "lake", "river"].includes(n.bg) && !/harbour|quay|dock|port|boat|ferry/.test(n.id)) continue;
    const cx = n.x * TSZ + 8, cy = n.y * TSZ + 8;
    let best: Pt | null = null, bd = 1e9;
    for (let a = 0; a < 16; a++) for (let d = 4; d < 44; d += 2) {
      const x = Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * d), y = Math.round(cy + Math.sin((a / 16) * Math.PI * 2) * d);
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      if (water[y * W + x]) { if (d < bd) { bd = d; best = { x, y }; } break; }
    }
    if (!best) continue;
    const dx = (best.x - cx) / bd, dy = (best.y - cy) / bd;
    const len = n.bg === "coast" || /harbour|quay|port/.test(n.id) ? 22 : 14;
    docks.push({ x: best.x - dx * 2, y: best.y - dy * 2, dx, dy, len });
    const bx = best.x + dx * (len - 3) + (Math.abs(dy) > Math.abs(dx) ? 9 : 0), by = best.y + dy * (len - 3) + (Math.abs(dy) > Math.abs(dx) ? 0 : 7);
    put(cvOf(cached("rowboat", rowboat)), bx - 6, by - 3, by + 1);
    if (n.bg === "coast" && room[i] > 40) put(cvOf(cached("ship" + false, () => ship(3, false))), best.x + dx * 40 - 13, best.y + dy * 40 - 22, best.y + dy * 40 + 4);
  }

  // ---------------------------------------------------------- district houses
  const dIds = new Set<number>();
  for (let i = 0; i < w * h; i++) if (D[i]) dIds.add(D[i]);
  if (dIds.size) {
    const rr = seeded(inp.key + "town");
    // a church in every sizeable town, market stalls on its square
    for (const id of dIds) {
      const cells: number[] = [];
      for (let i = 0; i < w * h; i++) if (D[i] === id) cells.push(i);
      if (cells.length < 22) continue;
      const ch = sprite(cached("church" + cold, () => church(3, cold)));
      for (let t = 0; t < 30; t++) {
        const c = cells[rr.int(0, cells.length - 1)], x = (c % w) * TSZ + 8, y = Math.floor(c / w) * TSZ + 14;
        if (all(x - ch.w / 2, y - ch.h, x + ch.w / 2, y + 2, O_DIST) && place(ch, x, y, { avoid: O_WATER | O_ROAD | O_BLD | O_WALL | O_CLEAR })) break;
      }
      const sq = nodes.find((n) => D[n.y * w + n.x] === id);
      if (sq) {
        const cols = ["#c83a2a", "#2a6ab8", "#3a8a3a", "#d8a030"];
        for (let k = 0, got = 0; k < 16 && got < 3; k++) {
          const a = rr.next() * Math.PI * 2, d = 12 + rr.next() * 10;
          if (place(sprite(cached("stall" + (k % 4), () => stall(cols[k % 4]))), sq.x * TSZ + 8 + Math.cos(a) * d, sq.y * TSZ + 14 + Math.sin(a) * d * 0.7, { avoid: O_WATER | O_ROAD | O_BLD | O_WALL })) got++;
        }
      }
    }
    let v = 0;
    for (let y = 6; y < H; y += rr.int(15, 18) + (rr.chance(0.25) ? 6 : 0)) {
      let x = rr.int(0, 6);
      while (x < W) {
        if (!distAt(x + 6, y)) { x += 6; continue; }
        const kindH = rr.chance(0.2) ? "stone" : "town";
        const sp = houseSprite(kindH, (v++ * 7 + rr.int(0, 3)) % 24, cold);
        const ok = all(x, y - 4, x + sp.w, y, O_DIST) && place(sp, x + sp.w / 2, y, { avoid: O_WATER | O_ROAD | O_BLD | O_WALL | O_CLEAR });
        if (ok) x += sp.w - 2 + rr.int(0, 2);
        else {
          if (all(x, y - 4, x + 8, y, O_DIST) && !any(x, y - 10, x + 9, y, O_WATER | O_ROAD | O_BLD | O_WALL | O_CLEAR) && rr.chance(0.25)) {
            const t = cached("oak" + (v % 4), () => oak(v % 4, PAL.oak));
            place(sprite(t), x + 5, y + 1);
          }
          x += 5;
        }
      }
    }
    for (const n of nodes) { const id = D[n.y * w + n.x]; if (id) yards.push({ x: n.x * TSZ + 8, y: n.y * TSZ + 10, r: 7, k: inp.walled.has(id) ? "pave" : "dirt" }); }
  }

  // ---------------------------------------------------------- fields round farms and villages
  for (const i of villageLike) {
    const n = nodes[i], cx = n.x * TSZ + 8, cy = n.y * TSZ + 8, r = seeded(inp.key + n.id + "f");
    const blocks = n.bg === "field" ? 3 : 2;
    for (let b = 0, tries = 0; b < blocks && tries < 12; tries++) {
      const a = r.next() * Math.PI * 2, d = 30 + r.next() * 30;
      const cols = r.int(2, 3), rows = r.int(1, 3), cw = r.int(15, 22), ch = r.int(10, 14);
      const ox = Math.round(cx + Math.cos(a) * d - (cols * (cw + 2)) / 2), oy = Math.round(cy + Math.sin(a) * d * 0.8 - (rows * (ch + 2)) / 2);
      let got = 0;
      for (let q = 0; q < rows; q++) for (let p = 0; p < cols; p++) {
        const fw = cw + r.int(-3, 3), fh = ch + r.int(-2, 2);
        const x = ox + p * (cw + 2), y = oy + q * (ch + 2);
        if (any(x - 1, y - 1, x + fw, y + fh, O_WATER | O_ROAD | O_BLD | O_FIELD | O_DIST | O_WALL | O_CLEAR)) continue;
        fields.push({ x, y, w: fw, h: fh, t: r.int(0, 5), seed: r.int(0, 999) });
        mark(x, y, x + fw - 1, y + fh - 1, O_FIELD);
        got++;
      }
      if (got) b++;
    }
  }

  // ---------------------------------------------------------- warped ground kind per pixel
  const W4 = (W >> 2) + 2, H4 = (H >> 2) + 2;
  const mac = new Float32Array(W4 * H4), warpX = new Float32Array(W4 * H4), warpY = new Float32Array(W4 * H4), shade = new Float32Array(W4 * H4), hgt = new Float32Array(W4 * H4);
  const ampAt = (px: number, py: number) => {
    const fx2 = px / TSZ - 0.5, fy2 = py / TSZ - 0.5, x0 = Math.floor(fx2), y0 = Math.floor(fy2), u = fx2 - x0, v = fy2 - y0;
    const a = AMP[kindAtTile(x0, y0)], b = AMP[kindAtTile(x0 + 1, y0)], c = AMP[kindAtTile(x0, y0 + 1)], d = AMP[kindAtTile(x0 + 1, y0 + 1)];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
  for (let gy = 0; gy < H4; gy++) for (let gx = 0; gx < W4; gx++) {
    const px = gx * 4, py = gy * 4, i = gy * W4 + gx;
    warpX[i] = (noise(px / 44, py / 44, S + 1) - 0.5) * 30 + (noise(px / 12, py / 12, S + 2) - 0.5) * 8;
    warpY[i] = (noise(px / 44, py / 44, S + 3) - 0.5) * 30 + (noise(px / 12, py / 12, S + 4) - 0.5) * 8;
    mac[i] = noise(px / 26, py / 26, S + 18);
    hgt[i] = (noise(px / 70, py / 70, S + 5) * 0.55 + noise(px / 32, py / 32, S + 6) * 0.3 + noise(px / 14, py / 14, S + 7) * 0.15) * ampAt(px, py);
  }
  for (let gy = 1; gy < H4 - 1; gy++) for (let gx = 1; gx < W4 - 1; gx++) { const i = gy * W4 + gx; shade[i] = (hgt[i - W4 - 1] - hgt[i + W4 + 1]) * 9; }
  const kindAt = (x: number, y: number) => {
    const i = (y >> 2) * W4 + (x >> 2);
    const jx = (hash(x, y, S + 8) - 0.5) * 5, jy = (hash(x, y, S + 9) - 0.5) * 5;
    return kindAtTile(Math.floor((x + warpX[i] + jx) / TSZ), Math.floor((y + warpY[i] + jy) / TSZ));
  };

  const img = new ImageData(W, H);
  const buf = new Uint32Array(img.data.buffer);
  const PAVE = ["#6a665e", "#8a857a", "#9c968a", "#aea89a"].map(c32);
  const ROADC = cold ? ["#7a7068", "#988c80", "#ac9e90", "#b8ac9c"].map(c32) : ["#7a5c3c", "#9a7a50", "#b0905e", "#c2a272"].map(c32);
  const MUD = ["#4a3a28", "#5a4830"].map(c32);
  const TROD = (cold ? ["#a8a49c", "#bab6ae", "#cac6be"] : ["#8a7048", "#a08458", "#b49868"]).map(c32);
  const SANDW = ["#b0905a", "#c4a46a"].map(c32);
  const FOAM = c32("#e8f2f6"), FOAM2 = c32("#b8dcec");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, g4 = (y >> 2) * W4 + (x >> 2);
    const k = kindAt(x, y);
    const b = bay(x, y);
    if (water[i]) {
      const wk = waterKind[i] === 1 ? "sea" : waterKind[i] === 2 || k === G.SWAMP ? "swamp" : k === G.SNOW || (cold && k === G.ROCK) ? "ice" : "fresh";
      const P = W32[wk], d = dIn[i];
      let t = d + b * 2.2 + (noise(x / 18, y / 18, S + 11) - 0.5) * 3;
      let idx = t < 2 ? 4 : t < 4.5 ? 3 : t < 8 ? 2 : t < 13 ? 1 : 0;
      // static ripples
      const cx2 = Math.floor(x / 11), cy2 = Math.floor(y / 6), hx = hash(cx2, cy2, S + 12);
      if (d > 3 && hx > 0.45 && y === cy2 * 6 + Math.floor(hash(cx2, cy2, S + 13) * 5) && x - cx2 * 11 >= Math.floor(hx * 6) && x - cx2 * 11 < Math.floor(hx * 6) + 3) idx = Math.min(4, idx + 1);
      if (wk === "ice" && hash(x >> 2, y >> 2, S) > 0.93) idx = 0;
      buf[i] = P[idx];
      if (d <= 1 && wk === "sea") buf[i] = b > -0.2 ? FOAM : FOAM2;
      else if (d <= 1 && wk === "fresh") buf[i] = FOAM2;
      continue;
    }
    const dw = dOut[i];
    // pave inside walled towns
    const did = distAt(x, y);
    if (did && inp.walled.has(did)) {
      const rowY = Math.floor(y / 3), off = (rowY & 1) * 2, cell = Math.floor((x + off) / 4);
      const edge = y % 3 === 2 || (x + off) % 4 === 3;
      const hv = hash(cell, rowY, S + 14);
      buf[i] = edge ? PAVE[0] : PAVE[hv < 0.3 ? 1 : hv < 0.85 ? 2 : 3];
      if (road[i] >= 2 && !edge) buf[i] = PAVE[3];
      continue;
    }
    // shore
    if (isSeaNear[i] && dw < 7 + noise(x / 10, y / 10, S + 15) * 6) { buf[i] = dw < 2 ? SANDW[b > 0 ? 0 : 1] : GROUND32[G.SAND][clamp(Math.floor(1.6 + b * 1.6 + (hash(x, y, S) - 0.5) * 0.8), 0, 3)]; if (!road[i]) continue; }
    // roads
    if (road[i] >= 2 || (road[i] === 1 && hash(x, y, S + 16) > 0.55)) {
      const core = road[i] === 3;
      const t = (core ? 2.5 : road[i] === 2 ? 1.5 : 0.4) + b * 1.1 + (hash(x, y, S + 17) - 0.5) * 0.8;
      buf[i] = ROADC[clamp(Math.floor(t), 0, 3)];
      continue;
    }
    const fx4 = (x & 3) / 4, fy4 = (y & 3) / 4;
    const mv = mac[g4] * (1 - fx4) * (1 - fy4) + mac[g4 + 1] * fx4 * (1 - fy4) + mac[g4 + W4] * (1 - fx4) * fy4 + mac[g4 + W4 + 1] * fx4 * fy4;
    const sv = shade[g4] * (1 - fx4) * (1 - fy4) + shade[g4 + 1] * fx4 * (1 - fy4) + shade[g4 + W4] * (1 - fx4) * fy4 + shade[g4 + W4 + 1] * fx4 * fy4;
    let t = 1.55 + sv + (mv - 0.5) * 1.5 + b * 0.9 + (hash(x, y, S + 19) - 0.5) * 0.55;
    if (road[i] === 1) t -= 0.8;
    const kk: number = k === G.ROCK && noise(x / 34, y / 34, S + 20) + bay(x, y) * 0.12 > (cold ? 0.5 : 0.56) ? (cold ? G.SNOW : G.HILL) : k;
    buf[i] = GROUND32[kk][clamp(Math.floor(t), 0, 3)];
    if (dw <= 2 && !isSeaNear[i] && waterKind[i] !== 1) buf[i] = cold ? GROUND32[G.ROCK][dw <= 1 ? 1 : 2] : MUD[dw <= 1 || b > 0.1 ? 0 : 1];
  }
  // village yards and town squares
  for (const yd of yards) for (let y = Math.floor(yd.y - yd.r); y <= yd.y + yd.r; y++) for (let x = Math.floor(yd.x - yd.r * 1.3); x <= yd.x + yd.r * 1.3; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (water[i]) continue;
    const u = (x - yd.x) / (yd.r * 1.3), v = (y - yd.y) / yd.r, d = u * u + v * v + (noise(x / 5, y / 5, S + 21) - 0.5) * 0.5 + bay(x, y) * 0.25;
    if (d > 1) continue;
    if (yd.k === "pave") { const rowY = Math.floor(y / 3), off = (rowY & 1) * 2; buf[i] = y % 3 === 2 || (x + off) % 4 === 3 ? PAVE[1] : PAVE[hash(Math.floor((x + off) / 4), rowY, S) > 0.5 ? 3 : 2]; }
    else if (d < 0.5 || bay(x, y) + (hash(x, y, S + 3) - 0.5) * 0.6 > (d - 0.5) * 1.6 - 0.3) buf[i] = TROD[clamp(Math.floor(1.6 - d + bay(x, y) * 0.9 + (hash(x, y, S) - 0.5) * 0.8), 0, 2)];
  }
  // fields: crop rows inside a hedge
  const CROPS: [string, string, string][] = [["#c8a040", "#e0bc58", "#a88430"], ["#5a8a32", "#78a840", "#6a4a2e"], ["#7a5a3a", "#8e6c46", "#664a30"], ["#9a8ac8", "#b8a8e0", "#5a8a3a"], ["#8aa040", "#a8b84a", "#70883a"], ["#d8c060", "#ecd888", "#b8a048"]];
  for (const f of fields) {
    const [a, bcol, c] = CROPS[cold ? 2 : f.t].map(c32);
    const vert = f.seed % 2 === 0;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x, ex = x === f.x || x === f.x + f.w - 1, ey = y === f.y || y === f.y + f.h - 1;
      if (ex || ey) { buf[i] = cold ? c32("#c8d4e2") : (x + y) % 3 === 0 ? c32("#2e5a2a") : c32("#3a6a30"); continue; }
      const along = vert ? x - f.x : y - f.y;
      buf[i] = along % 3 === 0 ? c : (hash(x, y, f.seed) > 0.75 ? a : along % 3 === 1 ? bcol : a);
    }
  }
  // ground speckles: tufts, flowers, pebbles
  for (let cy = 0; cy < H; cy += 5) for (let cx = 0; cx < W; cx += 5) {
    const hx = hash(cx, cy, S + 22);
    const x = cx + Math.floor(hash(cx, cy, S + 23) * 5), y = cy + Math.floor(hash(cx, cy, S + 24) * 5);
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
    const i = y * W + x;
    if (water[i] || road[i] || distAt(x, y) || any(x, y, x, y, O_FIELD)) continue;
    const k = kindAt(x, y);
    if (k <= G.HILL || k === G.SWAMP) {
      if (hx < 0.5) {
        const dark = GROUND32[k][0], lite = GROUND32[k][3];
        buf[i] = dark; buf[i - W - 1] = dark; buf[i - W + 1] = dark; buf[i - W] = lite;
      } else if ((k === G.MEADOW && hx > 0.88) || (k === G.GRASS && hx > 0.95)) {
        const fc = c32(["#f4e04c", "#f4f0f0", "#f08ab0", "#b8a0f0", "#f0a040"][Math.floor(hash(cx, cy, S + 25) * 5)]);
        buf[i] = fc; if (hx > 0.93) buf[i + 2] = fc;
      }
    } else if (k === G.ROCK || k === G.SAND || k === G.DIRT) {
      if (hx < 0.3) { buf[i] = GROUND32[k][3]; buf[i + W] = GROUND32[k][0]; }
    } else if (k === G.SNOW && hx < 0.2) buf[i] = c32("#ffffff");
  }
  // soft shadows of everything standing
  const shadowMask = new Uint8Array(W * H);
  for (const s of shadows) for (let y = Math.floor(s.y - s.ry); y <= s.y + s.ry; y++) for (let x = Math.floor(s.x - s.rx); x <= s.x + s.rx; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const u = (x + 0.5 - s.x) / s.rx, v = (y + 0.5 - s.y) / s.ry;
    if (u * u + v * v <= 1) shadowMask[y * W + x] = 1;
  }

  // peaks near mountains (or anywhere rocky in cold lands), crags and boulders elsewhere
  const mountains = nodes.filter((n) => n.bg === "mountain");
  for (let gy = 0; gy < H / 14 + 2; gy++) for (let gx = 0; gx < W / 14; gx++) {
    const x = gx * 14 + Math.floor(hash(gx, gy, S + 33) * 14), y = gy * 14 + Math.floor(hash(gx, gy, S + 34) * 14);
    if (y >= H + 8 || x >= W) continue;
    const k = kindAt(x, Math.min(H - 1, y)), roll = hash(gx, gy, S + 35);
    const alpine = cold || mountains.some((m) => Math.hypot(m.x * TSZ - x, m.y * TSZ - y) < 9 * TSZ);
    const range = noise(x / 150, y / 150, S + 40);
    let p: Spr | null = null, pw = 0;
    const inRange = range > 0.58;
    if (alpine && (k === G.ROCK || k === G.SNOW) && roll < (inRange ? 0.8 : k === G.ROCK ? 0.12 : 0.03)) {
      pw = 18 + Math.floor(hash(gx, gy, S + 36) * 4) * 6 + (inRange ? 8 : 0);
      p = cached(`peak:${pw}:${(gx * 3 + gy) % 5}`, () => peak(gx * 7 + gy, pw, Math.round(pw * (0.75 + hash(gx, gy, 3) * 0.2)), 0.36 + hash(gx, gy, 4) * 0.12));
    } else if (!alpine && k === G.ROCK && roll < 0.2) {
      pw = 16 + Math.floor(hash(gx, gy, S + 36) * 3) * 5;
      p = cached(`crag:${pw}:${gx % 4}`, () => crag(gx * 7 + gy, pw));
    }
    if (!p) continue;
    if (any(x - pw / 2, y - p.h * 0.4, x + pw / 2, Math.min(H - 1, y), O_WATER | O_ROAD | O_WALL | O_DIST | O_CLEAR | O_FIELD)) continue;
    if (any(x - pw / 4, y - 5, x + pw / 4, Math.min(H - 1, y), O_BLD)) continue;
    mark(x - pw / 2 + 3, y - p.h * 0.35, x + pw / 2 - 3, y, O_BLD);
    put(cvOf(p), x - p.w / 2, y - p.h + 1, y);
    if (!alpine) shadows.push({ x: x + 3, y: y - 1, rx: pw * 0.5, ry: 3, a: 1 });
  }

  // ---------------------------------------------------------- trees, bushes, rocks
  const treeKinds = new Map<string, Spr[]>();
  const variants = (k: string, make: (v: number) => Spr, n = 8) => { let a = treeKinds.get(k); if (!a) { a = []; for (let v = 0; v < n; v++) a.push(make(v)); treeKinds.set(k, a); } return a; };
  const plant = (s: Spr, x: number, y: number, shadowR = 0.42) => {
    const X = Math.round(x - s.w / 2), Y = Math.round(y - s.h + 1);
    put(cvOf(s), X, Y, y);
    shadows.push({ x: x + 2.5, y: y - 0.5, rx: s.w * shadowR, ry: 2.6, a: 1 });
    for (let yy = Math.floor(y - 2); yy <= y + 2; yy++) for (let xx = Math.floor(x + 2.5 - s.w * shadowR); xx <= x + 2.5 + s.w * shadowR; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const u = (xx + 0.5 - x - 2.5) / (s.w * shadowR), v = (yy + 0.5 - y + 0.5) / 2.6;
      if (u * u + v * v <= 1 && !water[yy * W + xx]) shadowMask[yy * W + xx] = 1;
    }
  };
  const tileTrees = (x: number, y: number) => {
    const fx2 = x / TSZ - 0.5, fy2 = y / TSZ - 0.5, x0 = clamp(Math.floor(fx2), 0, w - 2), y0 = clamp(Math.floor(fy2), 0, h - 2), u = clamp(fx2 - x0, 0, 1), v = clamp(fy2 - y0, 0, 1);
    const T = inp.trees;
    return T[y0 * w + x0] * (1 - u) * (1 - v) + T[y0 * w + x0 + 1] * u * (1 - v) + T[(y0 + 1) * w + x0] * (1 - u) * v + T[(y0 + 1) * w + x0 + 1] * u * v;
  };
  const STEP = 6;
  for (let gy = 0; gy < H / STEP + 2; gy++) for (let gx = 0; gx < W / STEP + 1; gx++) {
    const x = gx * STEP + Math.floor(hash(gx, gy, S + 26) * STEP), y = gy * STEP + Math.floor(hash(gx, gy, S + 27) * STEP);
    if (x < 2 || x >= W - 2 || y < 4 || y >= H + 14) continue;
    const yy = Math.min(H - 1, y);
    const k = kindAt(x, yy);
    let dens = tileTrees(x, yy) * (cold ? 0.6 : 1);
    const clearing = clamp((noise(x / 70, y / 70, S + 28) - 0.3) * 3.2, 0, 1);
    dens *= 0.3 + 0.7 * clearing;
    const roll = hash(gx, gy, S + 29);
    const i = yy * W + x;
    if (water[i] || dOut[i] < 3) {
      // reeds and lilies along fresh water
      if (!water[i] && dOut[i] >= 1 && !isSeaNear[i] && roll < 0.35 && !road[i] && !any(x - 2, y - 4, x + 2, y, O_BLD | O_WALL | O_DIST)) put(cvOf(cached("reeds" + (gx % 4), () => reeds(gx % 4))), x - 3, y - 7, y);
      if (water[i] && dIn[i] >= 3 && dIn[i] < 8 && waterKind[i] !== 1 && roll < 0.12 && !(cold)) { buf[i] = c32("#4e8a3a"); buf[i + 1] = c32("#4e8a3a"); buf[i - W] = c32("#6aa84a"); if (roll < 0.03) buf[i + 2] = c32("#f0a0c0"); }
      continue;
    }
    if (roll > dens * 0.95) {
      // sparse decorations in the open
      if (roll > 0.985 && !any(x - 4, y - 6, x + 4, y + 1, O_WATER | O_ROAD | O_BLD | O_WALL | O_DIST | O_FIELD | O_CLEAR)) {
        if (k === G.ROCK || k === G.HILL || (k === G.SNOW && roll > 0.993)) plant(variants("boulder" + cold, (v) => boulder(v, 7 + (v % 3) * 2, cold || k === G.SNOW), 6)[gx % 6], x, y, 0.4);
        else if (k <= G.MEADOW) plant(variants("bush", (v) => bush(v, v % 2 ? PAL.oak : PAL.oak2, v % 3 === 0 ? "#d04a5a" : undefined), 6)[gx % 6], x, y, 0.4);
        else if (k === G.SAND && !cold) plant(cached("cactus", cactus), x, y, 0.3);
      } else if (roll > 0.97 && k === G.MEADOW && !any(x - 3, y - 4, x + 3, y, O_WATER | O_ROAD | O_BLD | O_WALL | O_DIST | O_FIELD | O_CLEAR)) put(cvOf(cached("flw" + (gx % 5), () => flowers(gx % 5))), x - 3, y - 4, y);
      continue;
    }
    if (any(x - 3, y - 2, x + 3, y, O_WATER | O_ROAD | O_BLD | O_WALL | O_DIST | O_FIELD | O_CLEAR)) continue;
    if (any(x - 6, y - 16, x + 6, y - 2, O_BLD | O_WALL)) continue;
    // species by ground
    const pick = hash(gx, gy, S + 30), v = Math.floor(hash(gx, gy, S + 31) * 8);
    let sp: Spr;
    const nearWater = dOut[i] < 16 && !isSeaNear[i];
    if (cold || k === G.SNOW) sp = pick < 0.82 ? variants("pineS", (q) => pine(q, PAL.pine, 0.9 + (q % 3) * 0.12, true))[v] : variants("birchS", (q) => birch(q, PAL.birch, true))[v];
    else if (k === G.SWAMP) sp = pick < 0.38 ? variants("dead", (q) => deadTree(q))[v] : pick < 0.62 ? variants("willow", (q) => willow(q, PAL.willow))[v] : variants("oakSw", (q) => oak(q, PAL.swamp, 0.85))[v];
    else if (nearWater && pick < 0.3) sp = variants("willow", (q) => willow(q, PAL.willow))[v];
    else if (k === G.ROCK) sp = pick < 0.7 ? variants("pine", (q) => pine(q, PAL.pine, 0.85 + (q % 3) * 0.12))[v] : pick < 0.9 ? variants("birch", (q) => birch(q, PAL.birch))[v] : variants("dead2", (q) => deadTree(q + 20))[v];
    else if (k === G.HILL) sp = pick < 0.35 ? variants("autO", (q) => oak(q, q % 3 === 0 ? PAL.autumnR : q % 3 === 1 ? PAL.autumnO : PAL.autumnY, 0.95))[v] : pick < 0.7 ? variants("oak", (q) => oak(q, q % 2 ? PAL.oak : PAL.oak2, 0.9 + (q % 3) * 0.08))[v] : variants("birch", (q) => birch(q, PAL.birch))[v];
    else if (k === G.SAND) { if (pick < 0.5) continue; sp = variants("dry", (q) => oak(q, PAL.dry, 0.75))[v]; }
    else {
      const pineShare = clamp((noise(x / 140, y / 140, S + 32) - 0.35) * 1.1, 0.04, 0.6);
      sp = pick < pineShare ? variants("pine", (q) => pine(q, PAL.pine, 0.85 + (q % 3) * 0.12))[v]
        : pick < pineShare + 0.07 ? variants("birch", (q) => birch(q, PAL.birch))[v]
        : pick > 0.965 ? variants("autO", (q) => oak(q, q % 3 === 0 ? PAL.autumnR : q % 3 === 1 ? PAL.autumnO : PAL.autumnY, 0.95))[v]
        : variants("oakF", (q) => oak(q + 50, q % 3 ? PAL.oak2 : PAL.oak, 0.95 + (q % 4) * 0.1), 12)[Math.floor(hash(gx, gy, S + 37) * 12)];
    }
    plant(sp, x, Math.min(H + 12, y));
  }
  // ---------------------------------------------------------- compose
  for (let i = 0; i < W * H; i++) if (shadowMask[i]) {
    const v = buf[i];
    const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
    buf[i] = ((255 << 24) | (Math.round(b * 0.7 + 8) << 16) | (Math.round(g * 0.66 + 2) << 8) | Math.round(r * 0.6 + 2)) >>> 0;
  }
  const art = mk(), c = art.getContext("2d")!;
  c.putImageData(img, 0, 0);
  c.imageSmoothingEnabled = false;
  // rolling hills: low mounds painted on the ground under everything standing
  const HPAL = cold ? ["#9aaac0", "#b4c2d4", "#ccd8e6", "#e0e8f2", "#f2f6fa"] : ["#5a7430", "#6a863a", "#7a9844", "#8eaa52", "#a4bc64"];
  for (let gy = 0; gy < H / 18; gy++) for (let gx = 0; gx < W / 18; gx++) {
    const x = gx * 18 + Math.floor(hash(gx, gy, S + 41) * 18), y = gy * 18 + Math.floor(hash(gx, gy, S + 42) * 18);
    if (x >= W || y >= H || kindAt(x, y) !== G.HILL || hash(gx, gy, S + 43) > 0.45) continue;
    const hw = 18 + Math.floor(hash(gx, gy, S + 44) * 3) * 6;
    const hk = cached(`hillock:${hw}:${(gx + gy) % 4}:${cold}`, () => hillock(gx * 5 + gy, hw, HPAL));
    const X = Math.round(x - hw / 2), Y = Math.round(y - hk.h);
    if (any(X - 1, Y - 1, X + hw, y + 1, O_WATER | O_ROAD | O_DIST | O_FIELD | O_WALL | O_BLD)) continue;
    c.drawImage(cvOf(hk), X, Y);
  }
  // bridges where roads cross water; long sea crossings are left to boats
  const stoneNear = (x: number, y: number) => nodes.some((n) => n.bg === "bridge" && Math.hypot(n.x * TSZ + 8 - x, n.y * TSZ + 8 - y) < 28);
  for (const pts of inp.roads) {
    const line: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * TSZ));
      for (let k = 0; k < L; k++) line.push({ x: (a.x + (b.x - a.x) * (k / L) + 0.5) * TSZ, y: (a.y + (b.y - a.y) * (k / L) + 0.5) * TSZ });
    }
    let k = 0;
    while (k < line.length) {
      const p = line[k], i = Math.round(p.y) * W + Math.round(p.x);
      if (!water[i]) { k++; continue; }
      let e = k; while (e < line.length && water[Math.round(line[e].y) * W + Math.round(line[e].x)]) e++;
      if (e - k > 44 || waterKind[i] === 1) { k = e; continue; }
      const s0 = Math.max(0, k - 4), s1 = Math.min(line.length - 1, e + 3);
      const stone = stoneNear(p.x, p.y);
      const dx = line[s1].x - line[s0].x, dy = line[s1].y - line[s0].y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const plank = stone ? ["#b8b0a0", "#8a8476", "#d4ccbc", "#5e584e"] : ["#9a6a3c", "#6a4428", "#b8844a", "#4a2e1a"];
      c.fillStyle = "rgba(10,20,40,.35)";
      for (let j = s0; j <= s1; j++) for (let o = -4; o <= 4; o++) c.fillRect(Math.round(line[j].x + nx * o), Math.round(line[j].y + ny * o) + 3, 1, 1);
      for (let j = s0; j <= s1; j++) {
        for (let o = -4; o <= 4; o++) {
          const edge = Math.abs(o) === 4;
          c.fillStyle = edge ? plank[(j - s0) % 4 === 0 ? 2 : 3] : (j - s0) % 3 === 0 ? plank[1] : o < 0 ? plank[2] : plank[0];
          c.fillRect(Math.round(line[j].x + nx * o), Math.round(line[j].y + ny * o), 1, 1);
        }
      }
      k = e;
    }
  }
  // docks
  for (const d of docks) {
    const nx = -d.dy, ny = d.dx;
    for (let j = 0; j < d.len; j++) for (let o = -2; o <= 2; o++) {
      const x = Math.round(d.x + d.dx * j + nx * o), y = Math.round(d.y + d.dy * j + ny * o);
      c.fillStyle = Math.abs(o) === 2 ? "#5a3a22" : j % 3 === 0 ? "#6a4428" : "#a87444";
      c.fillRect(x, y, 1, 1);
      if (Math.abs(o) === 2 && j % 5 === 4) { c.fillStyle = "#3a2416"; c.fillRect(x, y + 1, 1, 2); }
    }
  }
  objs.sort((a, b) => a.z - b.z || a.x - b.x);
  for (const o of objs) c.drawImage(o.cv, o.x, o.y);

  // water glints for the view to twinkle
  const gr = seeded(inp.key + "glint");
  for (let n = 0; n < 6000 && fx.glints.length < 260; n++) {
    const x = gr.int(0, W - 1), y = gr.int(0, H - 1);
    if (water[y * W + x] && dIn[y * W + x] > 4 && !(cold && waterKind[y * W + x] === 0)) fx.glints.push({ x, y });
  }
  return { art, fx };
}
