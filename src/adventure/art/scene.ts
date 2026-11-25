/**
 * Living pixel-art dioramas for Adventure's story sections. A scene is composed once per spec
 * (seeded by the section id): sky, three or four depth layers graded for the time of day and
 * hazed with distance, then a short list of cheap per-frame animators (flames, smoke, water
 * shimmer, swaying grass, birds, insects, flags, lit windows) and front effects (weather, fog,
 * foreground foliage, vignette, mood grade). Static layers are pre-rendered to offscreen
 * canvases and cached; each frame only blits them and runs the animators.
 */
import { Px, hs, mix, rgba, seeded } from "./px";
import { Paint, hex, toHex } from "../../render/palette";
import { wallTex, windowAt, doorAt, type WallKind } from "../../render/houses";

// ============================================================ public API
export type Bg = "forest" | "hill" | "road" | "river" | "lake" | "field" | "village" | "town" | "city" | "castle" | "hall" | "ruins" | "cave" | "tunnel" | "swamp" | "mountain" | "bridge" | "camp" | "inn" | "ship" | "sea" | "coast" | "desert" | "temple" | "dungeon" | "sky";
export interface SceneSpec { bg: Bg; time: "dawn" | "day" | "dusk" | "night"; weather: "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow" | "wind"; mood: "calm" | "tense" | "danger" | "combat" | "sad" | "mystery" | "triumph"; seed: string }
export interface SceneHandle {
  w: number; h: number;
  groundY: number;
  slots: { x: number; y: number }[];
  interior: boolean;
  draw(ctx: CanvasRenderingContext2D, t: number): void;
  drawFront(ctx: CanvasRenderingContext2D, t: number): void;
  light(t: number): { tint: string; alpha: number };
}

export const SCENE_W = 320, SCENE_H = 180;
const W = SCENE_W, H = SCENE_H;
export const INTERIOR_BGS: readonly Bg[] = ["hall", "inn", "cave", "tunnel", "dungeon", "temple"];

type Time = SceneSpec["time"];
type Mood = SceneSpec["mood"];
type R = ReturnType<typeof seeded>;
type Fn = (g: CanvasRenderingContext2D, t: number) => void;
type RGB = [number, number, number];

// ============================================================ small utilities
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAY[(y & 3) * 4 + (x & 3)];
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const rng = (r: R, a: number, b: number) => a + r.next() * (b - a);
/** Stable hash noise in [0,1). */
const hn = (a: number, b = 0, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const rgbCache = new Map<string, RGB>();
const rgbOf = (c: string): RGB => { let v = rgbCache.get(c); if (!v) { v = hex(c); rgbCache.set(c, v); } return v; };

function cnv(w = W, h = H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
/** Copies a (read-back optimised) canvas into a plain one that blits fast every frame. */
function finalize(src: HTMLCanvasElement) {
  const [c, g] = cnv(src.width, src.height);
  g.drawImage(src, 0, 0);
  return c;
}
function lerpStops(stops: string[], t: number): RGB {
  t = clamp(t);
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), k = f - i;
  const a = rgbOf(stops[i]), b = rgbOf(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** A drawing surface: Px plus FantasyLand's Paint helpers and texture fills. */
class Layer extends Px {
  readonly p: Paint;
  constructor(w = W, h = H) { super(w, h); this.p = new Paint(this.g, w, h); }
  /** Fills a polygon pixel by pixel with a colour function (fast, through ImageData). */
  tex(pts: [number, number][], fn: (x: number, y: number) => string | null) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bx0 = Math.max(0, Math.floor(Math.min(...xs))), bx1 = Math.min(this.w - 1, Math.ceil(Math.max(...xs)));
    const by0 = Math.max(0, Math.floor(Math.min(...ys))), by1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    if (bx1 < bx0 || by1 < by0) return;
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const img = this.g.getImageData(bx0, by0, bw, bh), d = img.data;
    for (let y = by0; y <= by1; y++) {
      const cs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [qx, qy] = pts[(i + 1) % pts.length];
        const yc = y + 0.5;
        if ((ay <= yc && qy > yc) || (qy <= yc && ay > yc)) cs.push(ax + ((yc - ay) * (qx - ax)) / (qy - ay));
      }
      cs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cs.length; k += 2) {
        for (let x = Math.max(bx0, Math.round(cs[k])); x <= Math.min(bx1, Math.round(cs[k + 1]) - 1); x++) {
          const col = fn(x, y);
          if (!col) continue;
          const [r, g, b] = rgbOf(col), i = ((y - by0) * bw + (x - bx0)) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        }
      }
    }
    this.g.putImageData(img, bx0, by0);
  }
  /** Rectangle filled through a colour function. */
  texRect(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => string | null) {
    this.tex([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], fn);
  }
  /** Banded, Bayer-dithered vertical gradient (the pixel-art way to do a sky or a wall). */
  band(x0: number, y0: number, w: number, h: number, stops: string[], bands = 12, alphaKeep = false) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    w = Math.min(this.w - x0, Math.round(w)); h = Math.min(this.h - y0, Math.round(h));
    if (w <= 0 || h <= 0) return;
    const img = this.g.getImageData(x0, y0, w, h), d = img.data;
    const cols = Array.from({ length: bands + 1 }, (_, i) => lerpStops(stops, i / bands));
    for (let y = 0; y < h; y++) {
      const f = (y / Math.max(1, h - 1)) * bands, b0 = Math.floor(f), fr = f - b0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (alphaKeep && d[i + 3] === 0) continue;
        const c = cols[Math.min(bands, fr > bay(x + x0, y + y0) ? b0 + 1 : b0)];
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    this.g.putImageData(img, x0, y0);
  }
  /** Soft round light/dark spot (canvas gradient, for glows baked into a layer). */
  glow(x: number, y: number, r: number, col: string, a: number) {
    const gr = this.g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    this.g.fillStyle = gr; this.g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ============================================================ time of day & weather
interface TP { sky: string[]; grade: string; haze: string; dark: number; tint: string; ta: number; cloud: [string, string, string] }
const TIMES: Record<Time, TP> = {
  dawn: { sky: ["#34386e", "#76619a", "#d88a9c", "#ffb48c", "#ffe2b4"], grade: "#f2d4d0", haze: "#efb4a8", dark: 0.32, tint: "#ff9a8a", ta: 0.13, cloud: ["#ffe6cc", "#eeaab0", "#9a7096"] },
  day: { sky: ["#3a78cc", "#5a9ce4", "#88bff0", "#bfe0f8", "#e6f6fc"], grade: "#ffffff", haze: "#cbe2f4", dark: 0, tint: "#fff0c8", ta: 0.03, cloud: ["#ffffff", "#e8f0fa", "#b8cce4"] },
  dusk: { sky: ["#1e1846", "#4e2c66", "#a84c6c", "#ee845a", "#ffc070"], grade: "#f6b496", haze: "#d4846e", dark: 0.62, tint: "#ff7438", ta: 0.2, cloud: ["#ffc888", "#d0707a", "#5e3a68"] },
  night: { sky: ["#03050e", "#08102c", "#121c4a", "#1e2c62", "#2e3e74"], grade: "#525c98", haze: "#26345e", dark: 1, tint: "#1c2a6e", ta: 0.42, cloud: ["#4e5a80", "#343e62", "#222844"] },
};
const OVER: Record<SceneSpec["weather"], number> = { clear: 0, wind: 0.15, cloudy: 0.55, fog: 0.5, snow: 0.55, rain: 0.78, storm: 1 };
const GREY: Record<Time, string> = { dawn: "#9a8c98", day: "#a0a8b2", dusk: "#6a5a6a", night: "#161a26" };

// ============================================================ the build context
interface Win { x: number; y: number; w: number; h: number; on: boolean; ph: number; mx: number; my: number; col: string }
interface Tuft { x: number; y: number; h: number; c: [string, string]; n: number; ph: number }
interface C {
  s: SceneSpec; r: R; tp: TP; dark: number; over: number; wind: number;
  snow: boolean; wet: boolean; fog: boolean; storm: boolean;
  horizon: number; groundY: number; slots: { x: number; y: number }[]; interior: boolean;
  back: Fn[]; front: Fn[];
  comp: HTMLCanvasElement; compG: CanvasRenderingContext2D;
  sky: string[]; grade: string; haze: string;
  tint: string; ta: number;
  wins: Win[];
  /** Extra light the actors get from fires/torches nearby (warm). */
  warm: number;
  cloudCols: [string, string, string];
  /** x of the sun/moon, for glitter on water. */
  orbX?: number;
  /** Animators attached to the layer being drawn: they run right after it is blitted. */
  pend: Fn[];
  open: boolean;
}

const SLOTS_DEFAULT = [44, 90, 136, 184, 230, 276];
const stdSlots = (y: number, dy = 3, xs = SLOTS_DEFAULT) => xs.map((x, i) => ({ x, y: y + (i % 2 ? dy : 0) }));

function newC(s: SceneSpec): C {
  const tp = TIMES[s.time] ?? TIMES.day;
  const over = OVER[s.weather] ?? 0;
  const grey = GREY[s.time];
  const sky = tp.sky.map((c) => mix(c, grey, over * 0.78));
  let grade = mix(tp.grade, s.time === "night" ? "#3a4060" : "#aab0bc", over * 0.42);
  if (s.weather === "storm") grade = mix(grade, "#6a7088", 0.3);
  let haze = mix(tp.haze, grey, over * 0.6);
  if (s.weather === "fog") haze = mix(haze, s.time === "night" ? "#3a4458" : "#d4d8dc", 0.6);
  const [comp, compG] = cnv();
  const cloudCols = tp.cloud.map((c) => mix(c, s.time === "night" ? "#242834" : s.weather === "storm" ? "#5a6070" : "#a8b0ba", over * 0.7)) as [string, string, string];
  return {
    s, r: seeded(`${s.seed}|${s.bg}`), tp, dark: tp.dark, over, wind: s.weather === "wind" ? 1 : s.weather === "storm" ? 0.9 : s.weather === "rain" ? 0.4 : 0.15,
    snow: s.weather === "snow", wet: s.weather === "rain" || s.weather === "storm", fog: s.weather === "fog", storm: s.weather === "storm",
    horizon: 104, groundY: 152, slots: stdSlots(150), interior: false,
    back: [], front: [], pend: [], open: false, comp, compG, sky, grade, haze, tint: tp.tint, ta: tp.ta, wins: [], warm: 0, cloudCols,
  };
}

/** Multiplies a layer by the time-of-day grade and hazes it toward the horizon colour. */
function gradeCanvas(cv: HTMLCanvasElement, mul: string, haze: string, hazeA: number) {
  const g = cv.getContext("2d")!;
  if (mul.toLowerCase() !== "#ffffff") {
    const [m, mg] = cnv(cv.width, cv.height);
    mg.fillStyle = mul; mg.fillRect(0, 0, cv.width, cv.height);
    mg.globalCompositeOperation = "destination-in"; mg.drawImage(cv, 0, 0);
    g.globalCompositeOperation = "multiply"; g.drawImage(m, 0, 0);
  }
  if (hazeA > 0) {
    g.globalCompositeOperation = "source-atop"; g.globalAlpha = hazeA;
    g.fillStyle = haze; g.fillRect(0, 0, cv.width, cv.height);
  }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
}

/** Snow settles on every upward-facing edge of a layer. */
function snowify(L: Layer, depth = 2) {
  const img = L.g.getImageData(0, 0, L.w, L.h), d = img.data, w = L.w;
  const top = new Int16Array(w * L.h);
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y < L.h; y++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) { run = 0; continue; }
      run++;
      top[y * w + x] = run;
    }
  }
  for (let y = 0; y < L.h; y++) for (let x = 0; x < w; x++) {
    const k = top[y * w + x];
    if (k === 0 || k > depth + (hn(x, 7) > 0.6 ? 1 : 0)) continue;
    const i = (y * w + x) * 4;
    const lit = x > 0 && top[y * w + x - 1] === 0 ? 0 : 1;
    const c = k === 1 ? (lit ? [250, 252, 255] : [214, 226, 244]) : [226, 236, 250];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  L.g.putImageData(img, 0, 0);
}

/** Finish a layer: weather, grade, haze; blit it every frame, and remember it for reflections. */
/** Starts a scene layer: animators registered while it is open run after it. */
function lay(c: C) { c.open = true; return new Layer(); }
/** Registers an animator in draw order (after the open layer, if any). */
function anim(c: C, f: Fn) { (c.open ? c.pend : c.back).push(f); }

function commit(c: C, L: Layer, hazeA = 0, o: { grade?: boolean; snow?: boolean } = {}) {
  if (c.snow && o.snow !== false && !c.interior) snowify(L);
  if (o.grade !== false) gradeCanvas(L.c, c.grade, c.haze, hazeA);
  const fin = finalize(L.c);
  c.compG.drawImage(fin, 0, 0);
  c.back.push((g) => g.drawImage(fin, 0, 0));
  if (c.wins.length) { c.back.push(windowsFn(c, c.wins)); c.wins = []; }
  c.back.push(...c.pend); c.pend = []; c.open = false;
  return fin;
}

// ============================================================ glow sprites & light helpers
const glowSprite = (() => {
  const m = new Map<string, HTMLCanvasElement>();
  return (col: string) => {
    let s = m.get(col);
    if (!s) {
      const [c, g] = cnv(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.35, rgba(col, 0.45)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      s = c; m.set(col, s);
    }
    return s;
  };
})();
/** Additive soft light. */
function addGlow(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
  if (a <= 0.003) return;
  g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, a);
  g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
}
/** Flicker in [0,1] that never repeats visibly. */
const flick = (t: number, ph: number) => 0.72 + 0.14 * Math.sin(t * 0.011 + ph) + 0.09 * Math.sin(t * 0.037 + ph * 2.3) + 0.05 * Math.sin(t * 0.093 + ph * 5.1);

function windowsFn(c: C, ws: Win[]): Fn {
  const lit = ws.filter((w) => w.on);
  return (g, t) => {
    const k = c.dark;
    if (k < 0.2) return;
    for (const w of lit) {
      const f = flick(t, w.ph) * k;
      g.globalAlpha = clamp(f * 1.05);
      g.fillStyle = w.col; g.fillRect(w.x, w.y, w.w, w.h);
      g.fillStyle = "#fff2c0"; g.fillRect(w.x, w.y, w.w, Math.max(1, Math.floor(w.h / 2)));
      g.globalAlpha = clamp(k);
      g.fillStyle = "#2a1c18";
      if (w.mx >= 0) g.fillRect(w.mx, w.y, 1, w.h);
      if (w.my >= 0) g.fillRect(w.x, w.my, w.w, 1);
      g.globalAlpha = 1;
      addGlow(g, w.x + w.w / 2, w.y + w.h / 2, 7 + w.w, "#ffb050", 0.22 * f);
    }
  };
}

// ============================================================ shared animators
/** Pixel flame with its base at (x, y). */
function flame(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, ph: number, cols = ["#c8321e", "#f07a22", "#ffc43c", "#fff4c0"]) {
  const hgt = s * (1.5 + 0.28 * Math.sin(t * 0.017 + ph) + 0.16 * Math.sin(t * 0.041 + ph * 3));
  const rows = Math.max(3, Math.round(hgt));
  for (let i = 0; i < rows; i++) {
    const f = i / rows;
    const sway = Math.sin(t * 0.012 + i * 0.55 + ph) * f * s * 0.22 + Math.sin(t * 0.031 + ph) * f * 0.6;
    const half = s * 0.5 * Math.pow(1 - f, 0.75) * (0.85 + 0.15 * Math.sin(t * 0.05 + i + ph));
    const xx = x + sway;
    g.fillStyle = cols[0]; g.fillRect(Math.round(xx - half), y - i, Math.max(1, Math.round(half * 2)), 1);
    if (half > 1) { g.fillStyle = cols[1]; g.fillRect(Math.round(xx - half * 0.68), y - i, Math.max(1, Math.round(half * 1.36)), 1); }
    if (half > 1.6 && f < 0.7) { g.fillStyle = cols[2]; g.fillRect(Math.round(xx - half * 0.36), y - i, Math.max(1, Math.round(half * 0.72)), 1); }
    if (f < 0.3 && half > 1.2) { g.fillStyle = cols[3]; g.fillRect(Math.round(xx - 0.5), y - i, 1, 1); }
  }
  // licks that break off the top
  const lk = (t * 0.004 + ph) % 1;
  g.fillStyle = cols[1];
  g.fillRect(Math.round(x + Math.sin(ph + t * 0.009) * s * 0.3), Math.round(y - rows - lk * s * 0.8), 1, 1);
}
/** Embers rising from a fire. */
function embers(g: CanvasRenderingContext2D, x: number, y: number, n: number, rise: number, t: number, ph: number, wind = 0) {
  for (let i = 0; i < n; i++) {
    const per = 1400 + hn(i, 3) * 1600;
    const a = ((t + hn(i, 1) * per + ph * 100) % per) / per;
    const px = x + (hn(i, 2) - 0.5) * 6 + Math.sin(a * 9 + i) * 2.5 + wind * a * rise * 0.5;
    const py = y - a * rise;
    g.globalAlpha = (1 - a) * 0.95;
    g.fillStyle = a < 0.4 ? "#ffe08a" : "#ff8a3a";
    g.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
  g.globalAlpha = 1;
}
/** Rising, spreading smoke puffs from (x, y). */
function smoke(g: CanvasRenderingContext2D, x: number, y: number, t: number, o: { n?: number; rise?: number; per?: number; col?: string; a?: number; wind?: number; size?: number; ph?: number } = {}) {
  const n = o.n ?? 7, rise = o.rise ?? 34, per = o.per ?? 4200, col = o.col ?? "#d8d8e0", a0 = o.a ?? 0.5, wind = o.wind ?? 0.3, size = o.size ?? 1;
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = ((t / per + i / n + (o.ph ?? 0)) % 1);
    const px = x + wind * a * a * rise * 1.2 + Math.sin(a * 7 + i * 1.7 + (o.ph ?? 0)) * (1 + a * 3);
    const py = y - a * rise;
    const r = Math.max(1, Math.round((1 + a * 3.2) * size));
    g.globalAlpha = a0 * (1 - a) * Math.min(1, a * 6);
    g.fillRect(Math.round(px - r), Math.round(py - r + 1), r * 2, r * 2 - 2);
    g.fillRect(Math.round(px - r + 1), Math.round(py - r), r * 2 - 2, r * 2);
  }
  g.globalAlpha = 1;
}
/** A flock that crosses the sky now and then. */
function birdsFn(c: C, o: { y0: number; y1: number; col?: string; n?: number; scale?: number; per?: number; gull?: boolean }): Fn {
  const r = seeded(`${c.s.seed}birds${o.y0}`);
  const per = o.per ?? 26000 + r.next() * 14000, n = o.n ?? r.int(3, 6), dir = r.chance(0.5) ? 1 : -1;
  const base = rng(r, o.y0, o.y1), off = r.next() * per;
  const col = o.col ?? (c.dark > 0.5 ? "#141826" : "#2a2a3a");
  const birds = Array.from({ length: n }, (_, i) => ({ dx: -i * (7 + r.next() * 5), dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (3 + r.next() * 2), ph: r.next() * 6 }));
  const sc = o.scale ?? 1;
  return (g, t) => {
    const a = ((t + off) % per) / per;
    const span = W + 120;
    const lead = dir > 0 ? -60 + a * span * 1.4 : W + 60 - a * span * 1.4;
    if (lead < -80 || lead > W + 80) return;
    g.fillStyle = col;
    for (const b of birds) {
      const x = Math.round(lead + b.dx * dir), y = Math.round(base + b.dy + Math.sin(t * 0.002 + b.ph) * 2);
      const f = Math.floor((t * 0.012 + b.ph) % 4);
      const wing = f === 0 ? -1 : f === 2 ? 1 : 0;
      if (o.gull) {
        g.fillStyle = "#f4f4f4"; g.fillRect(x - 1, y, 3, 1);
        g.fillStyle = "#6a6a78";
        g.fillRect(x - 3, y + wing, 2, 1); g.fillRect(x + 2, y + wing, 2, 1);
        g.fillRect(x - 4, y + wing * 2, 1, 1); g.fillRect(x + 4, y + wing * 2, 1, 1);
      } else {
        g.fillRect(x, y, 1, 1);
        g.fillRect(x - 1 * sc, y + wing, 1 * sc, 1); g.fillRect(x + 1, y + wing, 1 * sc, 1);
        if (sc > 1 || wing !== 0) { g.fillRect(x - 2 * sc, y + wing * 2, 1, 1); g.fillRect(x + 1 + sc, y + wing * 2, 1, 1); }
      }
    }
  };
}
/** Butterflies wandering over flowers. */
function butterfliesFn(n: number, y0: number, y1: number, seed: string): Fn {
  const r = seeded(seed + "bfly");
  const bs = Array.from({ length: n }, () => ({ x: rng(r, 20, W - 20), y: rng(r, y0, y1), ph: r.next() * 9, sp: rng(r, 0.6, 1.3), col: r.pick(["#f8f0a0", "#ffffff", "#f8a0c8", "#a8d8ff", "#ffb050"]) }));
  return (g, t) => {
    for (const b of bs) {
      const s = t * 0.0004 * b.sp + b.ph;
      const x = Math.round(b.x + Math.sin(s) * 26 + Math.sin(s * 2.7) * 8);
      const y = Math.round(b.y + Math.sin(s * 1.9) * 6 + Math.cos(s * 4.1) * 3);
      const open = Math.floor(t * 0.02 + b.ph * 10) % 2 === 0;
      g.fillStyle = b.col;
      if (open) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); }
      else { g.fillRect(x - 1, y - 2, 1, 2); g.fillRect(x + 1, y - 2, 1, 2); }
      g.fillStyle = "#3a2a2a"; g.fillRect(x, y - 1, 1, 2);
    }
  };
}
/** Fireflies / wisps: glowing points that drift and pulse. */
function firefliesFn(n: number, y0: number, y1: number, seed: string, col = "#e8ff8a", glowCol = "#b8ff6a"): Fn {
  const r = seeded(seed + "ffly");
  const fs = Array.from({ length: n }, () => ({ x: rng(r, 6, W - 6), y: rng(r, y0, y1), ph: r.next() * 20, sp: rng(r, 0.5, 1.4) }));
  return (g, t) => {
    for (const f of fs) {
      const s = t * 0.0003 * f.sp + f.ph;
      const x = f.x + Math.sin(s) * 14 + Math.sin(s * 3.1) * 4, y = f.y + Math.cos(s * 1.3) * 8;
      const pulse = Math.max(0, Math.sin(t * 0.002 * f.sp + f.ph * 3));
      if (pulse < 0.05) continue;
      addGlow(g, x, y, 6, glowCol, 0.35 * pulse);
      g.globalAlpha = pulse; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.globalAlpha = 1;
    }
  };
}
/** Leaves drifting down and sideways. */
function leavesFn(n: number, cols: string[], seed: string, wind: number, y0 = -10): Fn {
  const r = seeded(seed + "leaf");
  const ls = Array.from({ length: n }, () => ({ x: r.next() * W, ph: r.next(), sp: rng(r, 0.7, 1.3), c: r.pick(cols), sw: r.next() * 9 }));
  return (g, t) => {
    for (const l of ls) {
      const per = 9000 / l.sp;
      const a = ((t / per) + l.ph) % 1;
      const y = y0 + a * (H - y0 + 10);
      const x = ((l.x + a * 70 * (wind + 0.25) + Math.sin(t * 0.0021 + l.sw) * 9) % (W + 20) + W + 20) % (W + 20) - 10;
      const f = Math.floor(t * 0.006 + l.sw) % 3;
      g.fillStyle = l.c;
      if (f === 0) g.fillRect(Math.round(x), Math.round(y), 2, 1);
      else if (f === 1) { g.fillRect(Math.round(x), Math.round(y), 1, 1); g.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1); }
      else g.fillRect(Math.round(x), Math.round(y), 1, 2);
    }
  };
}
/** Floating dust motes catching light. */
function motesFn(n: number, x0: number, x1: number, y0: number, y1: number, seed: string, col = "#fff0c0", a = 0.7): Fn {
  const r = seeded(seed + "mote");
  const ms = Array.from({ length: n }, () => ({ x: rng(r, x0, x1), y: rng(r, y0, y1), ph: r.next() * 9, sp: rng(r, 0.4, 1) }));
  return (g, t) => {
    g.fillStyle = col;
    for (const m of ms) {
      const s = t * 0.00018 * m.sp + m.ph;
      const x = m.x + Math.sin(s) * 10, y = m.y + Math.sin(s * 0.7 + 1) * 8 - ((t * 0.002 * m.sp) % 10);
      g.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(s * 3)));
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    g.globalAlpha = 1;
  };
}
/** Waving cloth flag on a pole top at (x, y). */
function flagFn(x: number, y: number, w: number, h: number, col: string, ph: number, c: C, emblem?: string): Fn {
  const lit = mix(hs(col, 0.25), c.grade, 0.0), dk = hs(col, -0.3);
  const gr = (k: string) => (c.grade === "#ffffff" ? k : mix(k, hs(c.grade, -0.2), c.dark * 0.55));
  const L1 = gr(lit), L0 = gr(col), L2 = gr(dk), E = emblem ? gr(emblem) : "";
  return (g, t) => {
    const sp = 0.006 + c.wind * 0.006;
    for (let i = 0; i < w; i++) {
      const f = i / w;
      const wv = Math.sin(t * sp - i * 0.55 + ph);
      const dy = Math.round(wv * (0.5 + f * 1.8 * (0.4 + c.wind)));
      const slope = Math.cos(t * sp - i * 0.55 + ph);
      const hh = h - (i > w - 3 && i % 2 ? 1 : 0) - Math.round(f * (h * 0.25));
      g.fillStyle = slope > 0.35 ? L1 : slope < -0.35 ? L2 : L0;
      g.fillRect(x + 1 + i, y + dy, 1, hh);
      if (E && i > w * 0.3 && i < w * 0.62) { g.fillStyle = E; g.fillRect(x + 1 + i, y + dy + Math.floor(hh / 2) - 1, 1, 2); }
    }
  };
}

// ============================================================ sky
function skyLayer(c: C, opts: { moon?: boolean; sun?: boolean } = {}) {
  const L = new Layer();
  const hz = c.horizon;
  L.band(0, 0, W, hz + 26, c.sky, 16);
  const r = seeded(c.s.seed + "sky");
  const t = c.s.time;
  if (t === "night" || (t === "dusk" && c.over < 0.5)) {
    const n = t === "night" ? Math.round(170 * (1 - c.over * 0.85)) : 30;
    for (let i = 0; i < n; i++) {
      const x = r.int(0, W - 1), y = Math.floor(Math.pow(r.next(), 1.3) * (hz - 8));
      const b = r.next();
      L.g.globalAlpha = (t === "dusk" ? 0.5 : 1) * (0.25 + b * 0.75) * (1 - y / hz * 0.6);
      L.px(x, y, b > 0.85 ? "#fff6d8" : b > 0.5 ? "#e8eeff" : "#a8b8e8");
      if (b > 0.95 && t === "night") { L.px(x - 1, y, "#8898c8"); L.px(x + 1, y, "#8898c8"); L.px(x, y - 1, "#8898c8"); L.px(x, y + 1, "#8898c8"); }
    }
    // milky way: a faint dithered diagonal band
    if (t === "night" && c.over < 0.3) {
      for (let i = 0; i < 900; i++) {
        const u = r.next(), x = u * W, cy = 10 + u * 50, y = cy + (r.next() - 0.5) * (18 + Math.sin(u * 7) * 6);
        L.g.globalAlpha = 0.12 + r.next() * 0.16;
        L.px(x, y, r.chance(0.3) ? "#c8b8ff" : "#d8e4ff");
      }
    }
    L.g.globalAlpha = 1;
  }
  if (t === "night" && opts.moon !== false) {
    const mx = r.int(40, W - 40), my = r.int(14, 34), mr = r.int(6, 9);
    c.orbX = mx;
    L.glow(mx, my, mr * 6, "#a8b8f0", c.over > 0.6 ? 0.15 : 0.32);
    const M = new Layer(mr * 2 + 3, mr * 2 + 3);
    M.ellipse(mr + 1, mr + 1, mr, mr, "#f4f0dc");
    M.ellipse(mr + 1 - 1, mr + 1 - 1, mr - 2, mr - 2, "#fffbea");
    for (let k = 0; k < 5; k++) { const a = r.next() * 6.3, d = r.next() * mr * 0.6; M.ellipse(mr + 1 + Math.cos(a) * d, mr + 1 + Math.sin(a) * d, r.int(0, 1) + 1, r.int(0, 1) + 1, "#ddd6bc"); }
    if (r.chance(0.6)) { // crescent / gibbous
      M.g.globalCompositeOperation = "destination-out";
      const off = r.int(3, mr);
      M.g.beginPath(); M.g.arc(mr + 1 + off * (r.chance(0.5) ? 1 : -1), mr + 1 - 1, mr, 0, Math.PI * 2); M.g.fill();
      M.g.globalCompositeOperation = "source-over";
    }
    L.g.globalAlpha = c.over > 0.6 ? 0.45 : 1;
    L.stamp(M, mx - mr - 1, my - mr - 1);
    L.g.globalAlpha = 1;
  }
  if (opts.sun !== false && t !== "night") {
    const dim = 1 - c.over * 0.85;
    if (t === "dawn") { const x = r.int(50, 110); c.orbX = x; L.glow(x, hz - 4, 90, "#ffd090", 0.55 * dim); L.glow(x, hz - 4, 26, "#fff0c0", 0.8 * dim); if (dim > 0.5) L.ellipse(x, hz - 6, 8, 8, "#fff4d0"); }
    else if (t === "dusk") { const x = r.int(200, 270); c.orbX = x; L.glow(x, hz - 6, 110, "#ff8a48", 0.55 * dim); L.glow(x, hz - 8, 30, "#ffd080", 0.8 * dim); if (dim > 0.5) { L.ellipse(x, hz - 10, 11, 11, "#ffcc70"); L.ellipse(x, hz - 11, 9, 9, "#ffe4a0"); for (let k = 0; k < 3; k++) L.rect(x - 14, hz - 13 + k * 4, 28, 1, mix(c.sky[3], "#ff9a60", 0.4)); } }
    else { const sx = r.int(220, 296); c.orbX = sx; L.glow(sx, 14, 90, "#fff8d8", 0.5 * dim); L.glow(sx, 14, 22, "#ffffff", 0.7 * dim); if (dim > 0.6) { L.ellipse(sx, 14, 7, 7, "#fff6c8"); L.ellipse(sx - 1, 13, 5, 5, "#fffef4"); } }
  }
  const fin = commit(c, L, 0, { grade: false, snow: false });
  void fin;
  // twinkle + shooting star
  if (t === "night" && c.over < 0.7) {
    const tw = Array.from({ length: 26 }, () => ({ x: r.int(0, W - 1), y: r.int(0, hz - 20), ph: r.next() * 9 }));
    const shootPer = 9000 + r.next() * 6000;
    c.back.push((g, tt) => {
      g.fillStyle = "#ffffff";
      for (const s of tw) { const a = Math.sin(tt * 0.003 + s.ph); if (a > 0.6) { g.globalAlpha = (a - 0.6) * 2.5; g.fillRect(s.x, s.y, 1, 1); g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); } }
      g.globalAlpha = 1;
      const k = Math.floor(tt / shootPer), ph = (tt % shootPer) / shootPer;
      if (ph < 0.06 && hn(k, 9) > 0.4) {
        const a = ph / 0.06, sx = 30 + hn(k, 1) * 240, sy = 8 + hn(k, 2) * 30;
        for (let i = 0; i < 9; i++) { g.globalAlpha = (1 - i / 9) * (1 - a); g.fillStyle = "#f0f4ff"; g.fillRect(Math.round(sx + a * 50 - i * 2), Math.round(sy + a * 20 - i), 1, 1); }
        g.globalAlpha = 1;
      }
    });
  }
  cloudsFn(c);
  if (c.storm) c.back.push(lightningBoltFn(c));
}

function cloudSprite(r: R, w: number, h: number, cols: [string, string, string]) {
  const L = new Layer(w + 4, h + 4);
  const n = Math.max(3, Math.round(w / 9));
  const base = h + 1;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), cx = 2 + 4 + f * (w - 8), bump = Math.sin(f * Math.PI);
    const rx = rng(r, 4, 8) + bump * 4, ry = Math.max(2, Math.round((rng(r, 0.45, 0.8) * bump + 0.25) * h));
    L.ellipse(cx, base - ry + 1, rx, ry, cols[1]);
  }
  L.rect(4, base - 2, w - 4, 3, cols[1]);
  // shading: lit tops, shaded bellies
  const img = L.g.getImageData(0, 0, L.w, L.h), d = img.data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < L.w && y < L.h && d[(y * L.w + x) * 4 + 3] > 0;
  const lit = rgbOf(cols[0]), sh = rgbOf(cols[2]), mid = rgbOf(mix(cols[1], cols[2], 0.45));
  const out: [number, number, RGB][] = [];
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    if (!on(x, y)) continue;
    if (!on(x, y - 1) || (!on(x, y - 2) && bay(x, y) > 0.4) || (!on(x - 1, y - 1) && !on(x - 2, y))) out.push([x, y, lit]);
    else if (y > base - 2) out.push([x, y, sh]);
    else if (y > base - 4 && bay(x, y) > 0.5) out.push([x, y, mid]);
  }
  for (const [x, y, c] of out) { const i = (y * L.w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
  L.g.putImageData(img, 0, 0);
  return finalize(L.c);
}

function cloudsFn(c: C, maxY?: number) {
  const r = seeded(c.s.seed + "clouds");
  const n = Math.round(3 + c.over * 9 + (c.s.weather === "clear" ? r.int(0, 2) : 0));
  const top = maxY ?? c.horizon - 22;
  const cl = Array.from({ length: n }, (_, i) => {
    const w = r.int(26, 70) + Math.round(c.over * 20), h = r.int(7, 14) + Math.round(c.over * 4);
    const y = Math.round(4 + Math.pow(r.next(), 0.9) * Math.max(6, top - 4 - h));
    const near = y / top;
    return { img: cloudSprite(r, w, h, c.cloudCols), x: r.next() * (W + 140), y, v: (0.0012 + near * 0.003 + r.next() * 0.001) * (1 + c.wind * 2.2), a: 0.75 + near * 0.25 - (i % 3) * 0.05 };
  }).sort((a, b) => a.y - b.y);
  // heavy weather: a solid deck of cloud along the top
  let deck: HTMLCanvasElement | null = null;
  if (c.over > 0.5) {
    const L = new Layer(W * 2, 34);
    const cols = c.cloudCols;
    for (let x = 0; x < L.w; x++) {
      const y = 10 + Math.round(Math.sin(x * 0.07 + 1) * 4 + Math.sin(x * 0.023) * 6 + hn(x >> 2, 3) * 3);
      L.rect(x, 0, 1, y, mix(cols[2], cols[1], 0.3));
      L.rect(x, y - 2, 1, 2, cols[2]);
      if (hn(x, 5) > 0.5) L.px(x, y, cols[2]);
    }
    deck = finalize(L.c);
  }
  c.back.push((g, t) => {
    if (deck) { const o = Math.round((t * 0.004 * (1 + c.wind)) % W); g.globalAlpha = 0.92; g.drawImage(deck, -o, 0); g.globalAlpha = 1; }
    for (const k of cl) {
      const span = W + k.img.width + 20;
      const x = Math.round(((k.x + t * k.v) % span) - k.img.width - 10);
      g.globalAlpha = k.a; g.drawImage(k.img, x, k.y); g.globalAlpha = 1;
    }
  });
}

/** Lightning timing shared by the bolt, the flash overlay and light(). */
function flashAt(seed: number, t: number) {
  const per = 6500, k = Math.floor(t / per), ph = t - k * per;
  if (hn(k, seed) < 0.35) return 0;
  const at = 600 + hn(k, seed + 1) * 3000, d = ph - at;
  if (d < 0 || d > 520) return 0;
  return d < 70 ? 1 : d < 140 ? 0.25 : d < 220 ? 0.85 : Math.max(0, 1 - (d - 220) / 300) * 0.5;
}
function lightningBoltFn(c: C): Fn {
  const seed = Math.floor(hn(c.s.seed.length, 7) * 1000);
  return (g, t) => {
    const f = flashAt(seed, t);
    if (f < 0.2) return;
    const k = Math.floor(t / 6500);
    let x = 40 + hn(k, 3) * 240, y = 0;
    g.fillStyle = "#f4f8ff";
    g.globalAlpha = f;
    const end = c.horizon + 4;
    let i = 0;
    while (y < end) {
      const nx = x + (hn(k, 10 + i) - 0.5) * 12, ny = y + 4 + hn(k, 40 + i) * 7;
      const steps = Math.ceil(ny - y);
      for (let s = 0; s <= steps; s++) { const u = s / steps; g.fillRect(Math.round(x + (nx - x) * u), Math.round(y + (ny - y) * u), 1, 1); }
      if (hn(k, 70 + i) > 0.8) { let bx = nx, by = ny; for (let j = 0; j < 4; j++) { bx += (hn(k, 90 + i * 5 + j) - 0.3) * 6; by += 3; g.fillRect(Math.round(bx), Math.round(by), 1, 1); } }
      x = nx; y = ny; i++;
    }
    g.globalAlpha = 1;
    addGlow(g, x, 20, 90, "#c8d8ff", 0.35 * f);
  };
}

// ============================================================ colour grading for per-frame sprites
/** Applies the scene's grade (and optional haze) to a colour, matching what commit() does to layers. */
function gc(c: C, col: string, haze = 0): string {
  const a = rgbOf(col), m = rgbOf(c.grade), z = rgbOf(c.haze);
  const r = (a[0] * m[0]) / 255, g = (a[1] * m[1]) / 255, b = (a[2] * m[2]) / 255;
  return toHex(r + (z[0] - r) * haze, g + (z[1] - g) * haze, b + (z[2] - b) * haze);
}
/** Grades a sprite canvas the way commit() grades layers, and returns a fast copy. */
function prep(c: C, L: Layer, haze = 0) {
  if (c.snow && !c.interior) snowify(L, 1);
  gradeCanvas(L.c, c.grade, c.haze, haze);
  return finalize(L.c);
}

// ============================================================ noise & ridges
function vnoise(x: number, y: number, s: number, seed: number) {
  const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hn(x0, y0, seed), b = hn(x0 + 1, y0, seed), c = hn(x0, y0 + 1, seed), d = hn(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy;
}
/** Midpoint-displacement ridge in [0,1], n samples. */
function fractal(r: R, n: number, rough = 0.55): number[] {
  let size = 1; while (size < n) size *= 2;
  const a = new Array<number>(size + 1).fill(0);
  a[0] = r.next(); a[size] = r.next();
  for (let step = size, sc = 0.9; step > 1; step /= 2, sc *= rough) {
    const h2 = step / 2;
    for (let i = h2; i < size; i += step) a[i] = (a[i - h2] + a[i + h2]) / 2 + (r.next() - 0.5) * sc;
  }
  const out = a.slice(0, n), lo = Math.min(...out), hi = Math.max(...out);
  return out.map((v) => (v - lo) / (hi - lo || 1));
}

/** A mountain range: distinct peaks with lit left faces, shaded right faces split by a wandering
 * spine, gullies, rock strata and optional snow caps. Returns the ridge heights. */
function mountains(L: Layer, c: C, base: number, amp: number, col: string, o: { rough?: number; snow?: number; seed?: string; peaks?: number } = {}) {
  const r = seeded(c.s.seed + (o.seed ?? "mtn") + base);
  const np = o.peaks ?? r.int(3, 6);
  const peaks = Array.from({ length: np }, (_, i) => ({
    x: (i + 0.2 + r.next() * 0.6) * (W / np) + (r.next() - 0.5) * 20,
    h: amp * (0.45 + r.next() * 0.55),
    sl: 0.55 + r.next() * 0.6, sr: 0.5 + r.next() * 0.6,
    drift: (r.next() - 0.3) * 0.5, s: r.int(0, 999),
  }));
  const det = fractal(r, W + 2, o.rough ?? 0.6);
  const ys: number[] = [], own: number[] = [];
  for (let x = 0; x < W; x++) {
    let best = -1e9, bi = 0;
    for (let i = 0; i < np; i++) {
      const p = peaks[i], d = x - p.x;
      const v = p.h - Math.abs(d) * (d < 0 ? p.sl : p.sr);
      if (v > best) { best = v; bi = i; }
    }
    ys.push(base - Math.max(2, best) - (det[x] - 0.5) * amp * 0.16);
    own.push(bi);
  }
  const lit = hs(col, 0.2), lit2 = hs(col, 0.34), sh = hs(col, -0.2), sh2 = hs(col, -0.34);
  const s1 = "#f8fafe", s2 = "#d4def0", s3 = "#9eaacc";
  for (let x = 0; x < W; x++) {
    const top = Math.round(ys[x]), p = peaks[own[x]];
    const py = base - p.h;
    for (let y = top; y < H; y++) {
      const d = y - top;
      const spine = p.x + (y - py) * p.drift + (vnoise(y, 0, 5, p.s) - 0.5) * 8;
      const litFace = x < spine;
      let cc = litFace ? col : sh;
      if (litFace && d < 2) cc = lit2;
      else if (litFace && vnoise(x - y * 0.6, y, 6, p.s + 1) > 0.66) cc = lit;
      if (!litFace && vnoise(x + y * 0.7, y, 5, p.s + 2) > 0.7) cc = sh2;
      // gullies running down the faces
      const gx = (x + (y - top) * (litFace ? 0.45 : -0.45)) % 13;
      if (Math.abs(gx) < 1 && vnoise(x, y, 8, p.s + 3) > 0.45 && d > 3) cc = litFace ? sh : sh2;
      if (Math.abs(x - spine) < 0.8 && d > 1) cc = litFace ? lit2 : sh;
      if (o.snow !== undefined) {
        const sl = o.snow + (vnoise(x, 0, 7, p.s + 4) - 0.5) * 12 + (litFace ? 3 : -2);
        if (y < sl) cc = d === 0 ? s1 : litFace ? (y > sl - 2 && bay(x, y) > 0.5 ? s2 : s1) : bay(x, y) > 0.35 ? s3 : s2;
        else if (y < sl + 4 && hn(x, y, p.s) > 0.6) cc = litFace ? s2 : s3;
      }
      L.px(x, y, cc);
      if (d > 70) { L.rect(x, y, 1, H - y, cc); break; }
    }
  }
  return ys;
}

/** Rolling hills with an optional patchwork of fields and hedgerows. */
function hills(L: Layer, c: C, base: number, amp: number, col: string, o: { freq?: number; fields?: boolean; trees?: string; seed?: string } = {}) {
  const r = seeded(c.s.seed + (o.seed ?? "hill") + base);
  const fq = o.freq ?? 0.02, p1 = r.next() * 9, p2 = r.next() * 9, seed = r.int(0, 999);
  const ys = Array.from({ length: W }, (_, x) => base - amp * (0.5 + 0.32 * Math.sin(x * fq + p1) + 0.18 * Math.sin(x * fq * 2.6 + p2) + 0.07 * Math.sin(x * fq * 6.3 + p1 * 2)));
  const fieldCols = [col, hs(col, 0.12), mix(col, "#c8b050", 0.35), hs(col, -0.1), mix(col, "#8a9a40", 0.3)];
  const lit = hs(col, 0.16), dk = hs(col, -0.16);
  for (let x = 0; x < W; x++) {
    const top = Math.round(ys[x]);
    const slope = (ys[Math.min(W - 1, x + 1)] - ys[Math.max(0, x - 1)]);
    for (let y = top; y < H; y++) {
      const d = y - top;
      let cc = col;
      if (o.fields && d > 1) {
        const fx = Math.floor((x + (y - top) * 0.6 * Math.sign(x - 160)) / 26), fy = Math.floor((y - base + amp) / 7);
        cc = fieldCols[Math.floor(hn(fx, fy, seed) * fieldCols.length)];
        if (((x + (y - top) * 0.6 * Math.sign(x - 160)) % 26 + 26) % 26 < 1 || (y - base + amp) % 7 === 0) cc = hs(col, -0.28);
      }
      if (d === 0) cc = slope < 0 ? lit : col;
      else if (d < 4 && slope < -0.2) cc = hs(cc, 0.08);
      else if (vnoise(x, y, 9, seed) > 0.72 && bay(x, y) > 0.5) cc = dk;
      L.px(x, y, cc);
      if (d > 26) { L.rect(x, y, 1, H - y, cc); break; }
    }
  }
  if (o.trees) {
    for (let x = r.int(0, 10); x < W; x += r.int(5, 22)) {
      const y = Math.round(ys[x]) + r.int(0, 3), s = r.int(2, 4);
      L.ellipse(x, y - s, s, s, o.trees);
      L.px(x - 1, y - s - 1, hs(o.trees, 0.25));
      L.rect(x - s + 1, y - 1, s * 2 - 1, 1, hs(o.trees, -0.3));
    }
  }
  return ys;
}

// ============================================================ trees, bushes, rocks
interface Sprite { img: HTMLCanvasElement; ox: number; oy: number; split: number }

function pineSprite(r: R, h: number, col: string, trunk = "#5a3a26"): Layer {
  const w = Math.round(h * 0.6) | 1, L = new Layer(w + 4, h + 3), cx = Math.floor((w + 4) / 2);
  L.rect(cx - 1, h - 6, 3, 7, trunk); L.px(cx - 1, h - 6, hs(trunk, 0.2)); L.rect(cx + 1, h - 6, 1, 7, hs(trunk, -0.3));
  const tiers = Math.max(3, Math.round(h / 8)), lit = hs(col, 0.2), lit2 = hs(col, 0.38), dk = hs(col, -0.22), dk2 = hs(col, -0.38);
  for (let k = 0; k < tiers; k++) {
    const t0 = Math.round((k * (h - 7)) / tiers * 0.92), t1 = Math.round(t0 + ((h - 7) / tiers) * 1.7);
    const mh = ((w / 2) * (0.3 + (0.7 * (k + 1)) / tiers));
    for (let y = t0; y <= t1; y++) {
      const f = (y - t0) / Math.max(1, t1 - t0), half = Math.round(mh * Math.pow(f, 0.85));
      for (let x = -half; x <= half; x++) {
        const u = x / (half || 1);
        let cc = u < -0.25 ? lit : u > 0.4 ? dk : col;
        if (y === t1 || (y === t1 - 1 && (x + k) % 3 !== 0)) cc = u < -0.3 ? col : dk2;
        if (u < -0.6 && f < 0.7 && (x + y) % 3 === 0) cc = lit2;
        if (r.next() > 0.93) cc = u < 0 ? lit2 : dk;
        L.px(cx + x, y + 1, cc);
      }
    }
  }
  L.px(cx, 0, lit2);
  L.outline((n) => `rgb(${Math.round(n[0] * 0.3)},${Math.round(n[1] * 0.3)},${Math.round(n[2] * 0.34) + 10})`);
  return L;
}

function broadSprite(r: R, s: number, col: string, kind: "oak" | "birch" | "round" | "willow" = "oak"): Layer {
  const w = Math.round(s * 2.6) + 6, h = Math.round(s * 3.1) + 4, L = new Layer(w, h), cx = Math.floor(w / 2);
  const trunk = kind === "birch" ? "#e8e4d8" : "#6a4630", th = Math.round(s * 1.25), tw = Math.max(2, Math.round(s / 3.2));
  const base = h - 1;
  // trunk with flared roots and two limbs
  L.rect(cx - Math.floor(tw / 2), base - th - s, tw, th + s, trunk);
  L.rect(cx - Math.floor(tw / 2) - 1, base - 2, tw + 2, 2, trunk); L.px(cx - Math.floor(tw / 2) - 2, base - 1, trunk); L.px(cx + Math.ceil(tw / 2) + 1, base - 1, trunk);
  L.rect(cx - Math.floor(tw / 2), base - th - s, 1, th + s, hs(trunk, 0.2));
  L.rect(cx + Math.ceil(tw / 2) - 1, base - th - s, 1, th + s, hs(trunk, -0.32));
  if (kind === "birch") for (let y = base - th - s; y < base; y += r.int(2, 4)) L.rect(cx - Math.floor(tw / 2) + r.int(0, tw - 1), y, r.int(1, 2), 1, "#2a2a2a");
  else for (let y = base - th; y < base; y += 3) L.px(cx - Math.floor(tw / 2) + 1 + (y % 2), y, hs(trunk, -0.25));
  L.line(cx, base - th, cx - s * 0.7, base - th - s * 0.8, trunk);
  L.line(cx, base - th + 1, cx + s * 0.8, base - th - s * 0.6, trunk);
  // canopy: clustered cel-shaded blobs, then dark pockets and bright leaf clusters
  const cy = base - th - s * 0.95;
  const blobs = kind === "willow" ? 7 : kind === "round" ? 5 : 8;
  const dk = hs(col, -0.24), lt = hs(col, 0.24), lt2 = hs(col, 0.42);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r.next() * 0.6, d = s * (kind === "round" ? 0.35 : 0.55) * r.next();
    const bx = cx + Math.cos(a) * d * 1.15, by = cy + Math.sin(a) * d * 0.75 + (kind === "willow" ? -s * 0.2 : 0);
    const br = s * rng(r, 0.48, 0.66);
    L.p.blob(bx, by, br * 1.08, br * 0.92, i % 3 === 0 ? hs(col, -0.06) : col, { outline: false, hi: 0.22, lo: -0.22 });
  }
  L.p.blob(cx, cy - s * 0.15, s * 0.7, s * 0.6, col, { outline: false, hi: 0.26, lo: -0.18 });
  const img = L.g.getImageData(0, 0, w, h), d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const top = cy - s * 1.1, bot = cy + s * 0.9;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, bot); y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y) || Math.abs(x - cx) < tw && y > cy + s * 0.5) continue;
    const u = (x - cx) / s, v = (y - cy) / s;
    const n = vnoise(x, y, 3, 77);
    if (u + v > 0.55 && n > 0.45) L.px(x, y, dk);
    else if (u + v < -0.6 && n > 0.62) L.px(x, y, lt);
    if (u + v < -0.9 && n > 0.8) L.px(x, y, lt2);
    if (!solid(x, y - 1) && u < 0.3) L.px(x, y, lt);
  }
  if (kind === "willow") {
    for (let x = cx - Math.round(s * 1.1); x <= cx + Math.round(s * 1.1); x += 2) {
      const len = Math.round(s * (0.8 + r.next() * 0.9));
      for (let k = 0; k < len; k++) L.px(x + (k > len * 0.6 ? 1 : 0), Math.round(cy + s * 0.3 + k), k % 3 ? col : dk);
    }
  }
  // fruit / blossoms now and then
  if (kind === "oak" && r.chance(0.25)) { const fc = r.pick(["#e84a4a", "#f8f0f0", "#f2c542"]); for (let i = 0; i < 9; i++) L.px(cx + r.int(-s, s), Math.round(cy + r.int(-s / 2, s / 2)), fc); }
  L.outline((n) => `rgb(${Math.round(n[0] * 0.3)},${Math.round(n[1] * 0.3)},${Math.round(n[2] * 0.34) + 10})`);
  return L;
}

function deadTreeSprite(r: R, h: number, col = "#4a3e3a"): Layer {
  const w = Math.round(h * 0.9), L = new Layer(w, h + 2), cx = Math.floor(w / 2);
  const branch = (x: number, y: number, a: number, len: number, th: number) => {
    if (len < 2) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    for (let k = 0; k < th; k++) L.line(x + k, y, x2 + k, y2, k === 0 ? hs(col, 0.18) : col);
    branch(x2, y2, a - 0.45 - r.next() * 0.3, len * 0.66, Math.max(1, th - 1));
    if (r.chance(0.8)) branch(x2, y2, a + 0.4 + r.next() * 0.3, len * 0.6, Math.max(1, th - 1));
  };
  L.rect(cx - 2, h - 4, 6, 5, col); L.px(cx - 3, h, col); L.px(cx + 4, h, col);
  branch(cx, h - 1, -Math.PI / 2 + (r.next() - 0.5) * 0.2, h * 0.38, 4);
  L.outline((n) => `rgb(${Math.round(n[0] * 0.4)},${Math.round(n[1] * 0.35)},${Math.round(n[2] * 0.4) + 8})`);
  return L;
}

/** Stamps a tree into a layer (feet at x,y). */
function plant(L: Layer, T: Layer, x: number, y: number) { L.stamp(T, Math.round(x - T.w / 2), Math.round(y - T.h + 1)); }

/** Registers a tree that sways in the wind, drawn per frame from a graded sprite. */
function swayTree(c: C, T: Layer, x: number, y: number, haze = 0): Sprite {
  const img = prep(c, T, haze);
  const sp: Sprite = { img, ox: Math.round(x - T.w / 2), oy: Math.round(y - T.h + 1), split: Math.round(T.h * 0.62) };
  const ph = hn(Math.round(x), Math.round(y)) * 6.28, amp = 0.6 + c.wind * 1.2;
  anim(c, (g, t) => {
    const dx = Math.round(Math.sin(t * 0.0011 * (1 + c.wind) + ph) * amp + c.wind * 0.6);
    const dx2 = Math.round(dx * 0.5);
    g.drawImage(img, 0, sp.split, img.width, img.height - sp.split, sp.ox, sp.oy + sp.split, img.width, img.height - sp.split);
    g.drawImage(img, 0, Math.round(sp.split * 0.5), img.width, sp.split - Math.round(sp.split * 0.5), sp.ox + dx2, sp.oy + Math.round(sp.split * 0.5), img.width, sp.split - Math.round(sp.split * 0.5));
    g.drawImage(img, 0, 0, img.width, Math.round(sp.split * 0.5), sp.ox + dx, sp.oy, img.width, Math.round(sp.split * 0.5));
  });
  return sp;
}

function bush(L: Layer, x: number, y: number, s: number, col: string, r: R, berries?: string) {
  for (let i = 0; i < 4; i++) L.p.blob(x + (i - 1.5) * s * 0.55, y - s * 0.55 - (i % 2) * s * 0.25, s * 0.55, s * 0.5, i % 2 ? col : hs(col, -0.05), { outline: false, hi: 0.25, lo: -0.25 });
  L.rect(x - s * 1.2, y - 1, s * 2.4, 1, hs(col, -0.4));
  if (berries) for (let i = 0; i < Math.round(s * 1.5); i++) L.px(x + r.int(-s, s), y - r.int(1, Math.round(s)), berries);
  for (let i = 0; i < s; i++) L.px(x + r.int(-s, s - 1), y - s - r.int(-1, 1), hs(col, 0.35));
}

function rock(L: Layer, x: number, y: number, w: number, h: number, col: string, r: R, moss?: string) {
  const n = 9, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const k = 0.78 + r.next() * 0.28;
    pts.push([x + Math.cos(a) * w * 0.5 * k, y + Math.sin(a) * h * k]);
  }
  pts.push([x + w * 0.5, y + 1], [x - w * 0.5, y + 1]);
  const lit = hs(col, 0.24), lit2 = hs(col, 0.42), dk = hs(col, -0.24), dk2 = hs(col, -0.42), seed = r.int(0, 999);
  L.tex(pts, (px, py) => {
    const u = (px - x) / (w * 0.5), v = (py - y) / h;
    const n2 = vnoise(px, py, 3, seed);
    if (v > -0.18) return dk2;
    if (u + v * 0.9 < -0.95 && n2 > 0.3) return lit2;
    if (u < -0.15 + n2 * 0.3) return v < -0.6 ? lit : col;
    return n2 > 0.55 ? dk : u > 0.6 ? dk : col;
  });
  if (moss) for (let xx = Math.round(x - w * 0.35); xx < x + w * 0.2; xx++) { const top = y - h * 0.9 * Math.sqrt(Math.max(0, 1 - ((xx - x) / (w * 0.5)) ** 2)); if (hn(xx, 3, seed) > 0.25) { L.px(xx, Math.round(top), moss); if (hn(xx, 5, seed) > 0.5) L.px(xx, Math.round(top) + 1, hs(moss, -0.2)); } }
  L.line(x - w * 0.1, y - h * 0.7, x + w * 0.05, y - h * 0.3, dk2);
}

// ============================================================ ground
interface GroundPal { c: string[]; tuft?: [string, string]; flowers?: string[]; pebble?: string }
const GROUND: Record<string, GroundPal> = {
  grass: { c: ["#3c8238", "#4f9a40", "#64b04a", "#80c656"], tuft: ["#3a7a34", "#8ccf5c"], flowers: ["#f8f0f0", "#f7d44c", "#e85a7a", "#a88aff"], pebble: "#a8a298" },
  meadow: { c: ["#4a8a36", "#5ea442", "#78b84c", "#98cc5c"], tuft: ["#457f30", "#a4d866"], flowers: ["#f8f0f0", "#f7d44c", "#e85a5a", "#f09a3a", "#b8a0ff"], pebble: "#a8a298" },
  dry: { c: ["#7a8a3a", "#94a04a", "#aab45a", "#c4c870"], tuft: ["#6a7a30", "#ccd078"], flowers: ["#f7d44c", "#f8f0f0"], pebble: "#b0a490" },
  dirt: { c: ["#7a5434", "#8f6640", "#a47a4c", "#b88c5a"], pebble: "#c8b090" },
  sand: { c: ["#d4aa6a", "#e0bc7c", "#ead08e", "#f4e0a6"], pebble: "#c09868" },
  snow: { c: ["#b8c4dc", "#cfd8ea", "#e2e9f4", "#f6f9fd"], tuft: ["#8a98a8", "#c8d4e0"], pebble: "#8a8a9a" },
  rock: { c: ["#5a5a68", "#6c6c7a", "#7e7e8a", "#92929c"], tuft: ["#5a7a48", "#8aa86a"], pebble: "#a4a4ac" },
  mud: { c: ["#3e4430", "#4c5236", "#5a6040", "#6c7048"], tuft: ["#4a5a30", "#7a8a48"], pebble: "#6a6a5a" },
  cave: { c: ["#2e2a34", "#3a3542", "#47414e", "#55505c"], pebble: "#6a6474" },
};

/** Fills the ground from y0 down with a textured surface; returns nothing, adds animated tufts. */
function ground(c: C, L: Layer, y0: number, kind: keyof typeof GROUND, o: { tufts?: number; flowers?: number; top?: (x: number) => number } = {}) {
  let k = kind;
  if (c.snow && (k === "grass" || k === "meadow" || k === "dry" || k === "dirt")) k = "snow";
  const pal = GROUND[k], seed = c.r.int(0, 9999);
  const top = o.top ?? (() => y0);
  const cols = pal.c;
  for (let x = 0; x < W; x++) {
    const ty = Math.round(top(x));
    for (let y = Math.max(0, ty); y < H; y++) {
      const depth = (y - y0) / (H - y0);
      const v = vnoise(x, y * 1.7, 10 + depth * 8, seed) * 0.75 + vnoise(x, y * 2, 3, seed + 1) * 0.25 + (bay(x, y) - 0.5) * 0.22;
      let i = v < 0.32 ? 0 : v < 0.5 ? 1 : v < 0.7 ? 2 : 3;
      if (y === ty) i = 3;
      else if (y === ty + 1 && i < 2) i = 2;
      L.px(x, y, cols[i]);
    }
  }
  // edge shadow and specks
  const r = seeded(c.s.seed + "gnd" + y0);
  for (let i = 0; i < 260; i++) {
    const x = r.int(0, W - 1), y = r.int(y0 + 2, H - 1);
    if (y < top(x) + 2) continue;
    L.px(x, y, r.chance(0.5) ? hs(cols[1], -0.2) : hs(cols[3], 0.15));
  }
  if (pal.pebble) for (let i = 0; i < 26; i++) { const x = r.int(0, W - 2), y = r.int(y0 + 4, H - 2); if (y < top(x) + 3) continue; L.rect(x, y, 2, 1, pal.pebble); L.px(x, y - 1, hs(pal.pebble, 0.3)); L.px(x + 1, y + 1, hs(pal.pebble, -0.4)); }
  if (pal.flowers && (o.flowers ?? 30) > 0) for (let i = 0; i < (o.flowers ?? 30); i++) {
    const x = r.int(2, W - 3), y = r.int(y0 + 3, H - 2);
    if (y < top(x) + 3) continue;
    const f = r.pick(pal.flowers);
    L.px(x, y + 1, "#3a7a34"); L.px(x, y, f);
    if (y > y0 + 20) { L.px(x - 1, y, f); L.px(x + 1, y, f); L.px(x, y - 1, f); L.px(x, y, "#f8e070"); }
  }
  if (pal.tuft) {
    const n = o.tufts ?? 46;
    const tufts: Tuft[] = [];
    for (let i = 0; i < n; i++) {
      const x = r.int(0, W - 1), y = r.int(y0 + 2, H);
      if (y < top(x) + 2) continue;
      const near = (y - y0) / (H - y0);
      tufts.push({ x, y, h: Math.round(2 + near * 5 + r.next() * 2), c: pal.tuft, n: near > 0.5 ? 5 : 3, ph: r.next() * 6 });
    }
    tuftsFn(c, tufts.filter((t) => t.y < 166), c.open ? c.pend : c.back);
    tuftsFn(c, tufts.filter((t) => t.y >= 166), c.front);
  }
}

function tuftsFn(c: C, ts: Tuft[], list: Fn[], reed = false) {
  if (!ts.length) return;
  const cols = new Map<string, string>();
  const g2 = (k: string) => { let v = cols.get(k); if (!v) { v = gc(c, k); cols.set(k, v); } return v; };
  ts.sort((a, b) => a.y - b.y);
  list.push((g, t) => {
    const ws = 0.0021 * (1 + c.wind * 1.6), amp = 0.4 + c.wind * 1.1;
    for (const tf of ts) {
      const sway = Math.sin(t * ws + tf.x * 0.06 + tf.ph) * amp + c.wind * 0.6;
      const mid = (tf.n - 1) / 2;
      for (let b = 0; b < tf.n; b++) {
        const hb = Math.max(1, tf.h - Math.round(Math.abs(b - mid) * 1.3));
        const bx = tf.x + b - Math.floor(mid) + (b < mid ? -0 : 0);
        const lean = (b - mid) * 0.35;
        const tip = Math.round((sway + lean) * hb / 4);
        const lo = Math.ceil(hb / 2);
        g.fillStyle = g2(tf.c[0]); g.fillRect(bx, tf.y - lo, 1, lo);
        g.fillStyle = g2(b % 2 ? tf.c[1] : tf.c[0]); g.fillRect(bx + Math.round(tip / 2), tf.y - hb, 1, hb - lo);
        g.fillStyle = g2(tf.c[1]); g.fillRect(bx + tip, tf.y - hb, 1, 1);
        if (reed && b === Math.floor(mid)) { g.fillStyle = g2("#6a4428"); g.fillRect(bx + tip, tf.y - hb - 3, 2, 3); g.fillStyle = g2("#8a5a34"); g.fillRect(bx + tip, tf.y - hb - 3, 1, 1); }
      }
    }
  });
}

// ============================================================ water
interface WaterOpts { col: string; amp?: number; squash?: number; glints?: number; reflect?: number; foam?: boolean; murk?: boolean }
/** Animated water band [y0, y1): reflections of what is already drawn, row-wobble, glints. */
function water(c: C, y0: number, y1: number, o: WaterOpts) {
  const h = y1 - y0;
  const L = new Layer(W, h);
  const skyLow = c.interior ? o.col : c.sky[c.sky.length - 2];
  L.band(0, 0, W, h, [mix(o.col, skyLow, 0.55), o.col, hs(o.col, -0.2), hs(o.col, -0.34)], 10);
  // reflection of the scene above, squashed and darkened
  const sq = o.squash ?? 1.0;
  L.g.globalAlpha = o.reflect ?? 0.5;
  for (let y = 0; y < h; y++) {
    const sy = Math.round(y0 - 1 - y / sq);
    if (sy < 0) break;
    L.g.drawImage(c.comp, 0, sy, W, 1, 0, y, W, 1);
  }
  L.g.globalAlpha = 1;
  L.g.globalCompositeOperation = "source-atop"; L.g.globalAlpha = 0.32; L.g.fillStyle = o.col; L.g.fillRect(0, 0, W, h);
  L.g.globalAlpha = 1; L.g.globalCompositeOperation = "source-over";
  const seed = c.r.int(0, 999);
  const lt = hs(mix(o.col, skyLow, 0.5), 0.3);
  for (let y = 1; y < h; y += 2) for (let x = 0; x < W; x++) {
    const v = vnoise(x, y * 3, 12 + y, seed);
    if (v > 0.74 && bay(x, y) > 0.45) L.px(x, y, lt);
    else if (v < 0.2 && bay(x, y) > 0.5) L.px(x, y, hs(o.col, -0.3));
  }
  if (o.murk) for (let i = 0; i < 40; i++) L.rect(c.r.int(0, W), c.r.int(2, h), c.r.int(3, 9), 1, mix(o.col, "#6a7a3a", 0.5));
  const img = prep(c, L, 0);
  const amp = o.amp ?? 1.2, glints = o.glints ?? 26;
  const gl = Array.from({ length: glints }, () => ({ x: c.r.next() * W, y: Math.pow(c.r.next(), 0.8) * (h - 2) + 1, ph: c.r.next() * 9, w: c.r.int(1, 4) }));
  const glCol = gc(c, c.dark > 0.6 ? "#b8c8f0" : "#f4fbff");
  const orb = c.orbX;
  anim(c, (g, t) => {
    for (let y = 0; y < h; y++) {
      const f = y / h;
      const dx = Math.round(Math.sin(t * 0.0016 + y * 0.8) * amp * (0.35 + f) + Math.sin(t * 0.0007 + y * 0.23) * amp * 0.5);
      g.drawImage(img, 0, y, W, 1, dx, y0 + y, W, 1);
      if (dx > 0) g.drawImage(img, 0, y, 1, 1, 0, y0 + y, dx, 1);
      else if (dx < 0) g.drawImage(img, W - 1, y, 1, 1, W + dx, y0 + y, -dx, 1);
    }
    g.fillStyle = glCol;
    for (const k of gl) {
      const a = Math.sin(t * 0.0021 + k.ph);
      if (a < 0.3) continue;
      g.globalAlpha = (a - 0.3) * 1.3;
      const x = Math.round((k.x + t * 0.004 * (1 + c.wind)) % W);
      g.fillRect(x, Math.round(y0 + k.y), k.w + Math.round(k.y / h * 3), 1);
    }
    if (orb !== undefined && c.over < 0.6) {
      for (let y = 1; y < h; y += 2) {
        const sp = 3 + y * 0.5;
        const v = Math.sin(t * 0.004 + y * 1.7);
        if (v < 0) continue;
        g.globalAlpha = v * 0.7;
        g.fillRect(Math.round(orb - sp / 2 + Math.sin(t * 0.002 + y) * sp * 0.4), y0 + y, Math.max(1, Math.round(sp * 0.5 * v)), 1);
      }
    }
    g.globalAlpha = 1;
  });
  if (c.wet) anim(c, ripplesFn(c, y0 + 2, y1, 14));
}

/** Rain rings on water. */
function ripplesFn(c: C, y0: number, y1: number, n: number): Fn {
  const col = gc(c, "#d8e8f8");
  return (g, t) => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const per = 700 + hn(i, 1) * 500, k = Math.floor((t + hn(i, 2) * per) / per), a = ((t + hn(i, 2) * per) % per) / per;
      const x = Math.round(hn(i, k, 3) * W), y = Math.round(y0 + hn(i, k, 4) * (y1 - y0));
      const r = Math.round(a * 3) + 1;
      g.globalAlpha = 1 - a;
      g.fillRect(x - r, y, 1, 1); g.fillRect(x + r, y, 1, 1); g.fillRect(x - r + 1, y - 1, r * 2 - 1, 1); g.fillRect(x - r + 1, y + 1, r * 2 - 1, 1);
    }
    g.globalAlpha = 1;
  };
}

// ============================================================ buildings
type RoofK = "thatch" | "shingle" | "slate" | "tile";
const DARKWOOD = "#5e3c24", IRON = "#34303a", STONE = "#9a9aa0";

/** Colour function for a roof surface (row i from the ridge, column x). */
function roofCol(kind: RoofK, col: string, x: number, i: number, t: number, u: number, s: number): string {
  const light = 0.08 - u * 0.16 - t * 0.06;
  switch (kind) {
    case "thatch": {
      const band = Math.floor(i / 3);
      const base = hs(col, light + (vnoise(x * 2, band * 5, 3, s) - 0.5) * 0.26);
      if (i % 3 === 2 && hn(x, i, s) > 0.3) return hs(base, -0.28);
      if (hn(x, i + 50, s) > 0.86) return hs(base, 0.22);
      return hn(x >> 1, i, s) > 0.8 ? hs(base, -0.12) : base;
    }
    case "shingle": {
      const row = Math.floor(i / 3), within = i % 3, off = row % 2 ? 2 : 0;
      const tile = Math.floor((x + off) / 4), wx = (x + off) % 4;
      const base = hs(col, light + (hn(row, tile, s) - 0.5) * 0.14);
      if (within === 2) return hs(base, -0.3);
      if (wx === 3) return hs(base, -0.34);
      return within === 0 && wx < 3 ? hs(base, 0.15) : base;
    }
    case "slate": {
      const row = Math.floor(i / 2), within = i % 2, off = row % 2 ? 1 : 0;
      const tile = Math.floor((x + off) / 3), wx = (x + off) % 3;
      const base = hs(col, light + (hn(row, tile, s) - 0.5) * 0.18);
      if (within === 1) return hs(base, -0.26);
      return wx === 2 ? hs(base, -0.2) : wx === 0 ? hs(base, 0.12) : base;
    }
    case "tile": {
      const wx = x % 3, within = i % 3;
      const base = hs(col, light + (hn(Math.floor(i / 3), Math.floor(x / 3), s) - 0.5) * 0.08);
      if (within === 2) return hs(base, -0.34);
      return wx === 0 ? hs(base, 0.22) : wx === 2 ? hs(base, -0.22) : base;
    }
  }
}

function addWin(c: C, x: number, y: number, w: number, h: number, on: boolean, col = "#ffc860") {
  c.wins.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2, on, ph: hn(x, y) * 50, mx: x + Math.floor(w / 2), my: y + Math.floor(h / 2), col });
}

/** Little cobbled plinth along a wall's foot. */
function plinth(L: Layer, x: number, y: number, w: number, col = STONE) {
  L.rect(x, y, w, 3, hs(col, -0.32));
  for (let xx = x, k = 0; xx < x + w; k++) {
    const bw = 3 + Math.floor(hn(k, xx, 20) * 3), cc = hs(col, (hn(k, 21, xx) - 0.5) * 0.24);
    L.rect(xx, y, Math.min(bw - 1, x + w - xx), 2, cc); L.px(xx, y, hs(cc, 0.3));
    xx += bw;
  }
}

interface HouseO { wall: string; kind: WallKind; roof: string; roofKind: RoofK; chimney?: boolean; door?: string; trim?: string; shutters?: string; box?: boolean; lantern?: boolean; s: number }

/** Long cottage with a hipped roof (thatch or shingles), chimney, door, windows. */
function cottage(c: C, L: Layer, x: number, base: number, w: number, wallH: number, o: HouseO) {
  const r = seeded(`cot${o.s}`);
  const top = base - wallH;
  wallTex(L.p, x, top, w, wallH, o.wall, o.kind, o.s);
  plinth(L, x, base - 3, w);
  const trim = o.trim ?? "#efe2c4";
  const dx = Math.round(x + w * 0.5 - 3 + r.int(-Math.floor(w / 6), Math.floor(w / 6)));
  doorAt(L.p, dx, base - 13, { w: 7, h: 11, col: o.door ?? "#7a4a2c", arch: true });
  if (o.lantern) { L.rect(dx + 8, base - 14, 1, 2, IRON); lanternAt(c, L, dx + 8, base - 12); }
  const slots: number[] = [];
  for (let wx = x + 4; wx + 7 < x + w - 3; wx += 13) if (wx + 8 < dx - 1 || wx > dx + 9) slots.push(wx);
  for (const wx of slots) {
    windowAt(L.p, wx, top + 5, { w: 7, h: 7, trim, shutters: o.shutters, box: o.box });
    addWin(c, wx, top + 5, 7, 7, r.chance(0.8));
  }
  // roof
  const ov = 3, rh = Math.round(Math.min(w * 0.4, 22)), eave = top + 1, ridge = top - rh, inset = Math.round(rh * 0.75);
  const pts: [number, number][] = [[x - ov, eave + 2], [x + inset - ov, ridge], [x + w - inset + ov, ridge], [x + w + ov, eave + 2]];
  const x0 = x - ov, span = w + ov * 2;
  L.tex(pts, (px, py) => roofCol(o.roofKind, o.roof, px - x0, py - ridge, (py - ridge) / rh, (px - x0) / span, o.s));
  const dk = hs(o.roof, -0.45);
  L.line(x - ov, eave + 2, x + inset - ov, ridge, hs(o.roof, 0.3));
  L.line(x + w + ov, eave + 2, x + w - inset + ov, ridge, dk);
  L.rect(x + inset - ov, ridge - 1, w - inset * 2 + ov * 2 + 1, 2, hs(o.roof, o.roofKind === "thatch" ? -0.2 : -0.1));
  L.rect(x + inset - ov, ridge - 1, w - inset * 2 + ov * 2 + 1, 1, hs(o.roof, 0.15));
  if (o.roofKind === "thatch") {
    for (let xx = x - ov; xx <= x + w + ov; xx++) { const k = hn(xx, 99, o.s); L.px(xx, eave + 2, hs(o.roof, -0.3)); if (k > 0.35) L.px(xx, eave + 3, hs(o.roof, -0.4)); }
    for (let xx = x + inset - ov + 2; xx < x + w - inset + ov; xx += 4) L.px(xx, ridge, hs(o.roof, -0.35));
  } else L.rect(x - ov, eave + 2, span + 1, 1, dk);
  L.g.fillStyle = "rgba(30,14,40,0.35)"; L.g.fillRect(x, eave + 3, w, 2);
  if (o.chimney) {
    const cx = Math.round(r.chance(0.5) ? x + w * 0.22 : x + w * 0.7), ct = ridge - 7;
    const cb = ridge + Math.round(rh * 0.45);
    chimneyAt(L, cx, ct, cb);
    anim(c, smokeFn(c, cx + 2, ct - 2));
  }
  return { top, ridge };
}

function chimneyAt(L: Layer, x: number, top: number, bottom: number, col = "#9a5a44") {
  for (let y = top; y < bottom; y++) for (let xx = 0; xx < 5; xx++) {
    const row = Math.floor((y - top) / 2), b = ((xx + (row % 2) * 2) % 4 === 3) || (y - top) % 2 === 1;
    L.px(x + xx, y, b ? hs(col, -0.28) : xx === 0 ? hs(col, 0.22) : xx === 4 ? hs(col, -0.36) : col);
  }
  L.rect(x - 1, top - 2, 7, 2, "#a8a4a8"); L.rect(x - 1, top - 2, 7, 1, "#d0ccd0"); L.rect(x, top - 1, 5, 1, "#2a2026");
}

function smokeFn(c: C, x: number, y: number): Fn {
  const col = gc(c, c.dark > 0.6 ? "#8a90a8" : "#e4e4ec");
  const ph = hn(x, y);
  return (g, t) => smoke(g, x, y, t, { col, wind: 0.35 + c.wind * 1.4, rise: 30, a: c.wet ? 0.3 : 0.5, ph });
}

/** Hanging lantern that glows after dusk. */
function lanternAt(c: C, L: Layer, x: number, y: number) {
  L.rect(x - 1, y, 3, 1, IRON); L.rect(x - 1, y + 1, 3, 3, "#d8a040"); L.px(x, y + 2, "#fff0b0"); L.rect(x - 1, y + 4, 3, 1, IRON);
  const ph = hn(x, y) * 30;
  anim(c, (g, t) => {
    const k = Math.max(0.15, c.dark);
    const f = flick(t, ph);
    g.fillStyle = "#ffe08a"; g.globalAlpha = 0.6 + 0.4 * k; g.fillRect(x - 1, y + 1, 3, 3); g.fillStyle = "#fffbe0"; g.fillRect(x, y + 2, 1, 1); g.globalAlpha = 1;
    addGlow(g, x, y + 2, 12, "#ffb050", 0.4 * f * k);
  });
}

/** A projecting shop sign that swings a little. */
function signFn(c: C, x: number, y: number, kind: string, dir = 1): Fn {
  const S = new Layer(16, 16);
  const board = c.r.pick(["#c89a5a", "#8a5a34", "#5a7aa0", "#a04a3a", "#4a7a4a"]);
  S.rect(1, 3, 12, 9, hs(board, -0.5)); S.rect(2, 4, 10, 7, board); S.rect(2, 4, 10, 1, hs(board, 0.3)); S.rect(2, 10, 10, 1, hs(board, -0.3));
  const ic = "#f2d070";
  switch (kind) {
    case "mug": S.rect(5, 5, 4, 5, ic); S.rect(9, 6, 1, 3, ic); S.rect(5, 5, 4, 1, "#ffffff"); break;
    case "sword": S.line(4, 9, 10, 5, "#e0e4ec"); S.rect(5, 7, 1, 3, ic); S.px(4, 9, ic); break;
    case "bread": S.ellipse(7, 8, 3, 2, "#d89a4a"); S.px(6, 7, "#f4c880"); S.px(8, 7, "#f4c880"); break;
    case "potion": S.rect(6, 5, 2, 2, "#e0e0f0"); S.ellipse(7, 8, 2, 2, "#e04a6a"); S.px(6, 7, "#ffb0c0"); break;
    case "key": S.ellipse(5, 7, 1, 1, ic); S.rect(6, 7, 5, 1, ic); S.rect(9, 8, 1, 2, ic); break;
    default: S.ellipse(7, 7, 2, 2, ic); S.px(6, 6, "#ffffff");
  }
  const img = prep(c, S);
  const ph = hn(x, y) * 9;
  return (g, t) => {
    g.fillStyle = gc(c, IRON);
    g.fillRect(x - (dir > 0 ? 0 : 13), y, 14, 1);
    g.fillRect(x + (dir > 0 ? 0 : -1), y - 1, 2, 3);
    const sw = Math.round(Math.sin(t * 0.0017 * (1 + c.wind) + ph) * (0.4 + c.wind * 0.9));
    const bx = x + (dir > 0 ? 1 : -14);
    g.fillRect(bx + 3, y + 1, 1, 2); g.fillRect(bx + 10, y + 1, 1, 2);
    g.drawImage(img, 0, 3, 16, 13, bx + sw, y + 2, 16, 13);
  };
}

/** Gable-fronted town house: stone ground floor, jettied upper floors, steep roof, shop front. */
function townHouse(c: C, L: Layer, x: number, base: number, w: number, floors: number, o: { wall: string; kind: WallKind; ground: string; groundKind: WallKind; roof: string; roofKind: RoofK; s: number; shop?: boolean; sign?: string; awning?: string; trim?: string; chimney?: boolean; jetty?: boolean }) {
  const r = seeded(`th${o.s}`);
  const g0 = 18, fh = 15, j = o.jetty === false ? 0 : 2;
  const trim = o.trim ?? "#e8dcc0";
  // ground floor
  wallTex(L.p, x, base - g0, w, g0, o.ground, o.groundKind, o.s);
  plinth(L, x, base - 3, w, hs(o.ground, -0.05));
  const doorX = r.chance(0.5) ? x + 3 : x + w - 11;
  doorAt(L.p, doorX, base - 14, { w: 8, h: 12, col: r.pick(["#7a4a2c", "#5a3a5a", "#3a5a4a", "#8a3a2a"]), arch: true });
  if (o.shop && w > 26) {
    const sx = doorX === x + 3 ? x + 14 : x + 4, sw = w - 19;
    L.rect(sx - 1, base - 15, sw + 2, 11, hs(DARKWOOD, -0.2));
    L.band(sx, base - 14, sw, 9, ["#7aa8c8", "#3a5a7a"], 4);
    // goods on the sill
    for (let gx = sx + 1; gx < sx + sw - 1; gx += 3) { const col = r.pick(["#e04a4a", "#f2c542", "#7ad0f0", "#d89a4a", "#a070d0"]); L.rect(gx, base - 8, 2, 3, col); L.px(gx, base - 8, hs(col, 0.4)); }
    L.rect(sx - 1, base - 5, sw + 2, 1, hs(trim, -0.1));
    c.wins.push({ x: sx, y: base - 14, w: sw, h: 6, on: true, ph: hn(sx, base) * 40, mx: -1, my: -1, col: "#ffc860" });
    if (o.awning) {
      const ay = base - 19;
      for (let ax = sx - 3; ax < sx + sw + 3; ax++) {
        const st = Math.floor((ax - sx + 3) / 3) % 2 ? o.awning : "#f4ece0";
        L.rect(ax, ay, 1, 4, st); L.px(ax, ay, hs(st, 0.2));
        if ((ax - sx) % 3 === 1) L.px(ax, ay + 4, st);
      }
      L.rect(sx - 3, ay + 4, sw + 6, 1, "rgba(20,10,30,0.25)");
    }
  } else {
    const wx = doorX === x + 3 ? x + w - 11 : x + 4;
    windowAt(L.p, wx, base - 14, { w: 7, h: 7, trim }); addWin(c, wx, base - 14, 7, 7, r.chance(0.7));
  }
  // upper floors
  let top = base - g0, fx = x, fw = w;
  for (let f = 0; f < floors; f++) {
    fx -= j; fw += j * 2;
    L.rect(fx - 1, top - 1, fw + 2, 2, DARKWOOD); L.rect(fx - 1, top - 1, fw + 2, 1, hs(DARKWOOD, 0.25));
    if (j) for (let k = fx + 2; k < fx + fw - 2; k += 6) { L.rect(k, top + 1, 2, 2, hs(DARKWOOD, -0.1)); L.px(k, top + 3, hs(DARKWOOD, -0.3)); }
    wallTex(L.p, fx, top - fh, fw, fh - 1, o.wall, o.kind, o.s + f * 13);
    const n = Math.max(1, Math.floor((fw - 4) / 12));
    for (let k = 0; k < n; k++) {
      const wx = Math.round(fx + (fw / n) * (k + 0.5) - 3);
      windowAt(L.p, wx, top - fh + 4, { w: 7, h: 8, trim, box: r.chance(0.3), shutters: r.chance(0.3) ? r.pick(["#4a7a5a", "#6a3a3a", "#3a5a8a"]) : undefined });
      addWin(c, wx, top - fh + 4, 7, 8, r.chance(0.65));
    }
    top -= fh;
  }
  // gable roof
  const ov = 2, half = Math.round(fw / 2) + ov, cx = fx + fw / 2, rh = Math.round(half * 1.15);
  const apex = top - rh;
  // gable wall (triangle) with attic window
  L.tex([[cx - half + ov + 1, top], [cx, apex + 4], [cx + half - ov - 1, top]], (px, py) => ((px + py) % 7 === 0 ? hs(o.wall, -0.1) : (px - cx) > 0 ? hs(o.wall, -0.08) : o.wall));
  const aw = top - Math.round(rh * 0.5);
  L.rect(Math.round(cx) - 3, aw - 2, 6, 6, trim); L.rect(Math.round(cx) - 2, aw - 1, 4, 4, "#3e5a80"); L.px(Math.round(cx) - 2, aw - 1, "#9ac0e0");
  addWin(c, Math.round(cx) - 3, aw - 2, 6, 6, r.chance(0.5));
  // roof boards along both slopes (thick, textured)
  const thick = 5;
  L.tex([[cx - half, top + 1], [cx, apex], [cx + 1, apex], [cx + half + 1, top + 1], [cx + half + 1 - thick, top + 1], [cx + 0.5, apex + thick + 1], [cx - half + thick, top + 1]], (px, py) => {
    const along = Math.abs(px - cx) / half;
    return roofCol(o.roofKind, o.roof, Math.round(py + along * 3), Math.round(px), along, px > cx ? 0.9 : 0.1, o.s);
  });
  L.line(cx - half, top + 1, cx, apex, hs(o.roof, 0.3));
  L.line(cx + half + 1, top + 1, cx + 1, apex, hs(o.roof, -0.45));
  L.line(cx - half + thick, top + 1, cx + 0.5, apex + thick + 1, hs(o.roof, -0.5));
  L.line(cx + half + 1 - thick, top + 1, cx + 0.5, apex + thick + 1, hs(o.roof, -0.5));
  L.px(Math.round(cx), apex - 1, hs(o.roof, -0.4));
  if (o.chimney) { const chx = Math.round(cx + half * 0.45); chimneyAt(L, chx, apex + Math.round(rh * 0.3), apex + Math.round(rh * 0.55) + 4); anim(c, smokeFn(c, chx + 2, apex + Math.round(rh * 0.3) - 2)); }
  if (o.sign) anim(c, signFn(c, doorX === x + 3 ? x + w : x, base - g0 - 6, o.sign, doorX === x + 3 ? 1 : -1));
  return { top: apex, x: fx, w: fw };
}

/** Crenellated stone wall from x0 to x1 (top = walkway). */
function castleWall(c: C, L: Layer, x0: number, x1: number, top: number, base: number, col: string, s: number, o: { slits?: boolean; moss?: boolean } = {}) {
  wallTex(L.p, x0, top, x1 - x0, base - top, col, "stone", s);
  // merlons
  for (let x = x0; x < x1; x += 7) {
    const mw = Math.min(4, x1 - x);
    wallTex(L.p, x, top - 5, mw, 5, col, "stone", s + x);
    L.rect(x, top - 5, mw, 1, hs(col, 0.25));
    L.px(x + mw, top - 4, hs(col, -0.45));
  }
  L.rect(x0, top, x1 - x0, 1, hs(col, -0.35));
  L.rect(x0, top + 1, x1 - x0, 1, hs(col, 0.15));
  // corbel line
  for (let x = x0; x < x1; x += 3) { L.px(x, top + 3, hs(col, -0.3)); L.px(x + 1, top + 3, hs(col, -0.15)); }
  if (o.slits) for (let x = x0 + 9; x < x1 - 4; x += 18) { L.rect(x, top + 9, 2, 7, "#1a1420"); L.px(x, top + 9, "#3a3040"); L.rect(x - 1, top + 8, 4, 1, hs(col, 0.2)); }
  // weathering: damp streaks and moss at the foot
  for (let x = x0; x < x1; x++) {
    if (hn(x, s, 3) > 0.9) { const len = 3 + Math.floor(hn(x, s, 4) * 10); L.g.fillStyle = "rgba(30,30,40,0.18)"; L.g.fillRect(x, top + 2, 1, len); }
    if (o.moss !== false && hn(x, s, 5) > 0.45) L.px(x, base - 1 - Math.floor(hn(x, s, 6) * 3), hs("#5a8a3a", (hn(x, 2, s) - 0.5) * 0.3));
  }
}

/** Round tower with a conical roof or a battlement, a flag on top. */
function roundTower(c: C, L: Layer, cx: number, base: number, w: number, h: number, col: string, o: { roof?: string; flag?: string; s: number; windows?: number }) {
  const x = Math.round(cx - w / 2), top = base - h;
  wallTex(L.p, x, top, w, h, col, "stone", o.s);
  // cylinder shading
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w * 2 - 1;
    const shade = u < -0.55 ? 0.12 : u > 0.3 ? -(u - 0.3) * 0.55 : 0;
    L.g.fillStyle = shade > 0 ? `rgba(255,240,210,${shade})` : `rgba(20,14,40,${-shade})`;
    L.g.fillRect(x + i, top, 1, h);
  }
  const nwin = o.windows ?? Math.floor(h / 22);
  for (let k = 0; k < nwin; k++) {
    const wy = top + 10 + k * 20;
    if (wy > base - 16) break;
    L.rect(Math.round(cx) - 2, wy - 1, 4, 1, hs(col, 0.2));
    L.rect(Math.round(cx) - 1, wy, 3, 7, "#1a1622"); L.px(Math.round(cx) - 1, wy, hs(col, -0.2));
    addWin(c, Math.round(cx) - 2, wy - 1, 5, 9, hn(k, o.s) > 0.35, "#ffb848");
  }
  if (o.roof) {
    const ov = 3, rh = Math.round(w * 1.15), apex = top - rh;
    L.tex([[x - ov, top + 1], [cx, apex], [cx + 1, apex], [x + w + ov, top + 1]], (px, py) => {
      const u = (px - (x - ov)) / (w + ov * 2);
      const base0 = roofCol("slate", o.roof!, px, py - apex, (py - apex) / rh, u, o.s);
      return u > 0.62 ? hs(base0, -0.18) : u < 0.25 ? hs(base0, 0.06) : base0;
    });
    L.rect(x - ov, top + 1, w + ov * 2 + 1, 1, hs(o.roof, -0.5));
    L.rect(Math.round(cx), apex - 4, 1, 4, "#c8a040");
    if (o.flag) anim(c, flagFn(Math.round(cx), apex - 12, 10, 5, o.flag, o.s, c));
    L.rect(Math.round(cx), apex - 12, 1, 9, "#4a3a2a");
  } else {
    castleWall(c, L, x - 2, x + w + 2, top, top + 6, col, o.s + 3, { moss: false });
    if (o.flag) { L.rect(Math.round(cx), top - 20, 1, 15, "#4a3a2a"); anim(c, flagFn(Math.round(cx), top - 20, 12, 6, o.flag, o.s, c)); }
  }
}

function squareTower(c: C, L: Layer, x: number, base: number, w: number, h: number, col: string, o: { s: number; flag?: string; roof?: string }) {
  wallTex(L.p, x, base - h, w, h, col, "stone", o.s);
  L.g.fillStyle = "rgba(20,14,40,0.22)"; L.g.fillRect(x + w - 4, base - h, 4, h);
  L.g.fillStyle = "rgba(255,240,210,0.10)"; L.g.fillRect(x, base - h, 3, h);
  for (let wy = base - h + 10; wy < base - 18; wy += 18) { L.rect(x + w / 2 - 2, wy, 4, 8, "#1a1622"); L.rect(x + w / 2 - 3, wy - 1, 6, 1, hs(col, 0.2)); L.rect(x + w / 2 - 2, wy, 4, 1, hs(col, -0.2)); addWin(c, x + w / 2 - 3, wy - 1, 6, 9, hn(wy, o.s) > 0.4, "#ffb848"); }
  if (o.roof) {
    const apex = base - h - Math.round(w * 0.95);
    L.tex([[x - 2, base - h + 1], [x + w / 2, apex], [x + w + 2, base - h + 1]], (px, py) => roofCol("slate", o.roof!, px, py - apex, 0.5, (px - x) / w, o.s));
    L.rect(x - 2, base - h + 1, w + 4, 1, hs(o.roof, -0.5));
    if (o.flag) { L.rect(Math.round(x + w / 2), apex - 12, 1, 12, "#4a3a2a"); anim(c, flagFn(Math.round(x + w / 2), apex - 12, 10, 5, o.flag, o.s, c)); }
  } else {
    castleWall(c, L, x - 1, x + w + 1, base - h, base - h + 5, col, o.s + 1, { moss: false });
    if (o.flag) { L.rect(Math.round(x + w / 2), base - h - 22, 1, 17, "#4a3a2a"); anim(c, flagFn(Math.round(x + w / 2), base - h - 22, 12, 6, o.flag, o.s, c)); }
  }
}

/** Gate arch with a portcullis (or open, showing light beyond). */
function gateArch(L: Layer, cx: number, base: number, w: number, h: number, col: string, open: boolean, beyond = "#c8b890") {
  const x = Math.round(cx - w / 2), top = base - h, rr = w / 2;
  const inside = (px: number, py: number) => py >= top + rr ? true : (px - cx + 0.5) ** 2 + (py - (top + rr)) ** 2 <= rr * rr;
  for (let py = top; py < base; py++) for (let px = x; px < x + w; px++) {
    if (!inside(px, py)) continue;
    const d = (py - top) / h;
    if (open) L.px(px, py, py > base - 8 ? hs(beyond, -0.2) : mix("#2a2430", beyond, clamp(d * 1.2 - 0.1)));
    else L.px(px, py, "#141018");
  }
  // voussoirs
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) {
    const ax = cx + Math.cos(a) * (rr + 1.5), ay = top + rr + Math.sin(a) * (rr + 1.5);
    L.rect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3, hs(col, 0.15)); L.px(Math.round(ax) - 1, Math.round(ay) - 1, hs(col, 0.35));
  }
  if (!open) {
    for (let px = x + 2; px < x + w - 1; px += 4) for (let py = top + 2; py < base - 1; py++) if (inside(px, py)) L.px(px, py, "#5a5460");
    for (let py = top + 4; py < base - 1; py += 4) for (let px = x; px < x + w; px++) if (inside(px, py)) L.px(px, py, "#5a5460");
    for (let px = x + 2; px < x + w - 1; px += 4) L.px(px, base - 1, "#8a8490");
  }
}

// ============================================================ props
function fence(L: Layer, x0: number, x1: number, y: number, col = "#8a6440", step = 8, h = 9) {
  for (let x = x0; x <= x1; x += step) {
    L.rect(x, y - h, 2, h, col); L.px(x, y - h, hs(col, 0.3)); L.rect(x + 1, y - h + 1, 1, h - 1, hs(col, -0.3));
    L.px(x, y - h - 1, hs(col, 0.1));
  }
  for (const ry of [y - h + 2, y - 4]) { L.rect(x0, ry, x1 - x0 + 2, 1, hs(col, 0.15)); L.rect(x0, ry + 1, x1 - x0 + 2, 1, hs(col, -0.3)); }
}
function well(c: C, L: Layer, x: number, y: number) {
  const st = "#9a96a0";
  L.ellipse(x, y - 7, 10, 3, hs(st, -0.3));
  wallTex(L.p, x - 10, y - 9, 21, 9, st, "stone", 9);
  L.ellipse(x, y - 9, 10, 2, hs(st, 0.2)); L.ellipse(x, y - 9, 8, 1, "#1a2230");
  L.rect(x - 9, y - 26, 2, 17, DARKWOOD); L.rect(x + 8, y - 26, 2, 17, DARKWOOD);
  L.tex([[x - 13, y - 25], [x, y - 33], [x + 1, y - 33], [x + 14, y - 25]], (px, py) => roofCol("shingle", "#8a4a30", px, py, 0.5, (px - x + 13) / 27, 3));
  L.rect(x - 13, y - 25, 28, 1, "#3a2018");
  L.rect(x - 8, y - 21, 17, 1, "#7a5a3a"); L.rect(x, y - 21, 1, 7, "#c8b890");
  L.rect(x - 2, y - 15, 5, 4, "#8a5a34"); L.rect(x - 2, y - 15, 5, 1, "#4a4448"); L.rect(x - 2, y - 12, 5, 1, "#4a4448");
  void c;
}
function signpost(L: Layer, x: number, y: number, r: R) {
  const wood = "#8a6440";
  L.rect(x, y - 30, 3, 30, wood); L.rect(x, y - 30, 1, 30, hs(wood, 0.25)); L.rect(x + 2, y - 30, 1, 30, hs(wood, -0.3));
  const n = r.int(2, 3);
  for (let k = 0; k < n; k++) {
    const dir = (k + r.int(0, 1)) % 2 ? 1 : -1, by = y - 28 + k * 7, len = r.int(12, 17);
    const bx = dir > 0 ? x + 1 : x + 2 - len;
    const pts: [number, number][] = dir > 0 ? [[bx, by], [bx + len, by], [bx + len + 3, by + 2.5], [bx + len, by + 5], [bx, by + 5]] : [[bx, by], [bx + len, by], [bx + len, by + 5], [bx, by + 5], [bx - 3, by + 2.5]];
    const bc = hs("#c89a5a", (k - 1) * 0.06);
    L.tex(pts, (px, py) => (py === by ? hs(bc, 0.25) : py === by + 4 ? hs(bc, -0.3) : (px + py) % 5 === 0 ? hs(bc, -0.1) : bc));
    for (let i = 2; i < len - 2; i += 2) if (hn(i, k) > 0.3) L.px(bx + i, by + 2, "#4a3020");
  }
  L.rect(x - 2, y - 1, 7, 2, "rgba(20,10,30,0.3)");
}
function cart(L: Layer, x: number, y: number, r: R) {
  const wd = "#8a5a34";
  L.rect(x, y - 14, 30, 8, wd); for (let i = 0; i < 30; i += 5) L.rect(x + i, y - 14, 1, 8, hs(wd, -0.3)); L.rect(x, y - 14, 30, 1, hs(wd, 0.3));
  if (r.chance(0.6)) { L.p.blob(x + 15, y - 16, 13, 4, "#e0c060", { outline: false }); for (let i = 0; i < 14; i++) L.px(x + 3 + r.int(0, 24), y - 17 - r.int(0, 3), "#f8e090"); }
  else { for (let i = 0; i < 3; i++) { L.rect(x + 3 + i * 8, y - 21, 7, 7, "#9a6236"); L.rect(x + 3 + i * 8, y - 19, 7, 1, "#4a4448"); L.rect(x + 3 + i * 8, y - 21, 1, 7, "#b88050"); } }
  L.line(x + 30, y - 9, x + 44, y - 5, wd);
  for (const wx of [x + 7, x + 23]) {
    for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) {
      const d = Math.sqrt(xx * xx + yy * yy);
      if (d <= 5.2 && d > 3.6) L.px(wx + xx, y - 5 + yy, xx + yy < -2 ? "#7a5434" : "#4a3020");
    }
    for (let a = 0; a < 6.28; a += 0.785) L.line(wx, y - 5, wx + Math.cos(a) * 3.5, y - 5 + Math.sin(a) * 3.5, "#6a4428");
    L.rect(wx - 1, y - 6, 2, 2, "#3a2a1a");
  }
}
function barrelAt(L: Layer, x: number, y: number, col = "#9a6236") {
  L.rect(x, y - 10, 8, 10, col);
  L.rect(x + 1, y - 11, 6, 1, hs(col, -0.15)); L.rect(x + 1, y, 6, 1, hs(col, -0.4));
  L.rect(x, y - 10, 2, 10, hs(col, 0.2)); L.rect(x + 6, y - 10, 2, 10, hs(col, -0.3));
  for (const hy of [y - 9, y - 3]) L.rect(x, hy, 8, 1, "#4a4448");
  L.rect(x + 2, y - 11, 4, 1, hs(col, 0.25));
}
function crateAt(L: Layer, x: number, y: number, s = 9, col = "#b88450") {
  L.rect(x, y - s, s, s, col); L.rect(x, y - s, s, 1, hs(col, 0.3)); L.rect(x, y - s, 1, s, hs(col, 0.15));
  L.rect(x + s - 1, y - s, 1, s, hs(col, -0.35)); L.rect(x, y - 1, s, 1, hs(col, -0.35));
  L.line(x + 1, y - 2, x + s - 2, y - s + 1, hs(col, -0.25));
  L.rect(x + 1, y - s + 1, s - 2, 1, hs(col, -0.15));
}
/** A street lamp whose flame lights at dusk. */
function lampPost(c: C, L: Layer, x: number, y: number) {
  L.rect(x, y - 26, 2, 26, IRON); L.rect(x - 1, y - 2, 4, 2, IRON); L.px(x, y - 26, "#5a5460");
  L.rect(x - 2, y - 32, 6, 1, IRON); L.rect(x - 1, y - 31, 4, 4, "#d8b060"); L.rect(x - 2, y - 27, 6, 1, IRON); L.px(x + 1, y - 33, IRON);
  const ph = hn(x, y) * 20;
  anim(c, (g, t) => {
    if (c.dark < 0.25) return;
    const f = flick(t, ph);
    g.fillStyle = "#ffe8a0"; g.globalAlpha = c.dark; g.fillRect(x - 1, y - 31, 4, 4); g.fillStyle = "#ffffff"; g.fillRect(x, y - 30, 2, 2); g.globalAlpha = 1;
    addGlow(g, x + 1, y - 29, 20, "#ffb850", 0.5 * f * c.dark);
  });
}
/** Wall-mounted torch with a living flame. */
function torch(c: C, L: Layer, x: number, y: number, s = 3.2) {
  L.rect(x - 1, y, 3, 2, IRON); L.rect(x, y + 2, 1, 5, "#6a4428"); L.rect(x - 2, y + 5, 5, 1, IRON); L.px(x - 2, y + 4, IRON); L.px(x + 2, y + 4, IRON);
  L.rect(x - 1, y - 1, 3, 1, "#3a2a1a");
  const ph = hn(x, y) * 40;
  c.warm += 0.03;
  anim(c, (g, t) => {
    const f = flick(t, ph) * (c.interior ? 1 : 0.3 + 0.7 * c.dark);
    addGlow(g, x, y - 4, 34, "#ff9a3a", 0.32 * f);
    addGlow(g, x, y - 3, 10, "#ffd080", 0.35 * f);
    flame(g, x, y - 1, s, t, ph);
    smoke(g, x, y - 9, t, { n: 4, rise: 14, col: "#3a3238", a: 0.25, wind: 0.2, per: 2400, ph });
  });
}
function banner(L: Layer, x: number, y: number, w: number, h: number, col: string, emblem = "#f2c542", kind = 0) {
  L.rect(x - 2, y - 1, w + 4, 2, "#5a3a20"); L.px(x - 3, y - 1, "#c8a040"); L.px(x + w + 2, y - 1, "#c8a040");
  L.tex([[x, y + 1], [x + w, y + 1], [x + w, y + h], [x + w / 2, y + h + 5], [x, y + h]], (px, py) => {
    const u = (px - x) / w;
    const fold = Math.floor(u * 4) % 2;
    let cc = fold ? hs(col, -0.12) : col;
    if (u < 0.12) cc = hs(col, 0.2); else if (u > 0.85) cc = hs(col, -0.3);
    if (px === x + 1 || px === x + w - 2) cc = emblem;
    return cc;
  });
  const cx = x + w / 2, cy = y + h * 0.45;
  if (kind === 0) { L.rect(cx - 2, cy - 3, 4, 7, emblem); L.rect(cx - 3, cy - 2, 6, 2, emblem); L.px(cx - 1, cy + 4, emblem); }
  else if (kind === 1) { L.ellipse(cx, cy, 3, 3, emblem); L.ellipse(cx, cy, 1, 1, col); }
  else { L.line(cx - 3, cy - 3, cx + 3, cy + 3, emblem); L.line(cx + 3, cy - 3, cx - 3, cy + 3, emblem); }
  L.rect(x + 1, y + h - 1, w - 2, 1, emblem);
}
/** A fluted column (optionally broken) from top to base. */
function column(L: Layer, x: number, top: number, base: number, w: number, col: string, o: { broken?: boolean; ivy?: boolean; s?: number } = {}) {
  const s = o.s ?? 0, lit = hs(col, 0.26), dk = hs(col, -0.28), dk2 = hs(col, -0.42);
  // base & capital
  L.rect(x - 2, base - 4, w + 4, 4, col); L.rect(x - 2, base - 4, w + 4, 1, lit); L.rect(x - 2, base - 1, w + 4, 1, dk2); L.rect(x + w, base - 4, 2, 4, dk);
  const shaftTop = o.broken ? top : top + 5;
  for (let i = 0; i < w; i++) {
    const u = i / (w - 1);
    const cc = i % 3 === 2 ? (u < 0.4 ? col : dk) : u < 0.25 ? lit : u > 0.7 ? dk : col;
    L.rect(x + i, shaftTop, 1, base - 4 - shaftTop, cc);
  }
  if (o.broken) {
    for (let i = 0; i < w; i++) {
      const cut = Math.round(hn(i, s) * 5 + (i / w) * 3);
      L.g.clearRect(x + i, shaftTop - 1, 1, cut + 1);
      L.px(x + i, shaftTop + cut, i < w / 2 ? lit : col);
    }
  } else {
    L.rect(x - 3, top, w + 6, 3, col); L.rect(x - 3, top, w + 6, 1, lit); L.rect(x - 3, top + 2, w + 6, 1, dk2);
    L.rect(x - 1, top + 3, w + 2, 2, dk); L.rect(x - 1, top + 3, w + 2, 1, col);
    L.px(x - 3, top + 3, col); L.px(x + w + 2, top + 3, dk);
  }
  for (let y = shaftTop; y < base - 4; y++) if (hn(y, s, 4) > 0.94) L.px(x + Math.floor(hn(y, s, 5) * w), y, dk2);
  if (o.ivy) ivy(L, x + w / 2, base - 4, Math.round((base - shaftTop) * (0.5 + hn(s, 9) * 0.5)), s);
}
function ivy(L: Layer, x: number, y: number, len: number, s: number) {
  let px = x;
  for (let k = 0; k < len; k++) {
    px += Math.round(Math.sin(k * 0.45 + s) * 0.8);
    const yy = y - k;
    L.px(px, yy, "#3a6a2a");
    if (k % 2 === 0) { const side = (k >> 1) % 2 ? 1 : -1; L.px(px + side, yy, "#5a9a3a"); L.px(px + side * 2, yy - 1, hs("#5a9a3a", 0.2)); L.px(px + side, yy - 1, "#4a8a32"); }
  }
}

// ============================================================ per-frame line helper
function pline(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
}

// ============================================================ front: weather, fog, vignette, mood
function rainFn(c: C): Fn {
  const n = c.storm ? 170 : 105, r = seeded(c.s.seed + "rain");
  const drops = Array.from({ length: n }, () => ({ x: r.next() * (W + 60), y: r.next() * (H + 20), sp: rng(r, 0.8, 1.25), len: r.int(3, 6), near: r.next() }));
  const vy = 0.3, vx = -(0.04 + c.wind * 0.1);
  const col = c.dark > 0.6 ? "#8aa0d0" : "#c8dcf4", col2 = c.dark > 0.6 ? "#6a80b0" : "#a0b8d8";
  const splashY0 = c.interior ? H : c.groundY - 10;
  return (g, t) => {
    for (const d of drops) {
      const sp = d.sp * (0.75 + d.near * 0.5);
      const y = ((d.y + t * vy * sp) % (H + 20)) - 10;
      const x = ((((d.x + t * vx * sp) % (W + 60)) + W + 60) % (W + 60)) - 30;
      g.globalAlpha = 0.35 + d.near * 0.4;
      g.fillStyle = d.near > 0.6 ? col : col2;
      const len = d.len + Math.round(d.near * 3);
      const slant = vx / vy;
      for (let k = 0; k < len; k += 2) g.fillRect(Math.round(x - slant * k), Math.round(y + k), 1, 2);
    }
    if (!c.interior) {
      g.fillStyle = col;
      for (let i = 0; i < 26; i++) {
        const per = 380 + hn(i, 4) * 300, k = Math.floor((t + hn(i, 5) * per) / per), a = ((t + hn(i, 5) * per) % per) / per;
        const x = Math.round(hn(i, k, 6) * W), y = Math.round(splashY0 + hn(i, k, 7) * (H - splashY0));
        g.globalAlpha = (1 - a) * 0.8;
        if (a < 0.5) { g.fillRect(x, y - 1 - Math.round(a * 4), 1, 1); g.fillRect(x - 1 - Math.round(a * 2), y - Math.round(a * 3), 1, 1); g.fillRect(x + 1 + Math.round(a * 2), y - Math.round(a * 3), 1, 1); }
        else { g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); }
      }
    }
    g.globalAlpha = 1;
  };
}
function snowFn(c: C): Fn {
  const r = seeded(c.s.seed + "snow");
  const fl = Array.from({ length: 130 }, () => ({ x: r.next() * W, y: r.next() * H, z: r.next(), ph: r.next() * 9 }));
  return (g, t) => {
    for (const f of fl) {
      const sp = 0.012 + f.z * 0.028;
      const y = (f.y + t * sp) % (H + 4) - 2;
      const x = (((f.x + t * sp * (0.4 + c.wind * 2.2) * 0.6 + Math.sin(t * 0.0013 + f.ph) * (3 + f.z * 4)) % W) + W) % W;
      g.globalAlpha = 0.55 + f.z * 0.45;
      g.fillStyle = f.z > 0.5 ? "#ffffff" : "#dde6f4";
      const s = f.z > 0.82 ? 2 : 1;
      g.fillRect(Math.round(x), Math.round(y), s, s);
    }
    g.globalAlpha = 1;
  };
}
function windFn(c: C): Fn {
  const r = seeded(c.s.seed + "wind");
  const st = Array.from({ length: 14 }, () => ({ y: r.next() * H, ph: r.next(), len: r.int(8, 22), sp: rng(r, 0.12, 0.22) }));
  const col = c.dark > 0.6 ? "#8a94b8" : "#f4f4f0";
  return (g, t) => {
    g.fillStyle = col;
    for (const s of st) {
      const x = ((s.ph * (W + 80) + t * s.sp) % (W + 80)) - 40;
      const y = s.y + Math.sin(t * 0.002 + s.ph * 9) * 3;
      g.globalAlpha = 0.22;
      g.fillRect(Math.round(x), Math.round(y), s.len, 1);
      g.fillRect(Math.round(x + s.len * 0.6), Math.round(y - 1), Math.round(s.len * 0.4), 1);
    }
    g.globalAlpha = 1;
  };
}
/** Tileable fog bank texture, scrolled per frame. */
function fogBank(c: C, h: number, density: number, seed: string, col: string) {
  const [cv, g] = cnv(W * 2, h);
  const r = seeded(seed);
  const n = Math.round(26 * density);
  for (let i = 0; i < n; i++) {
    const x = r.next() * W * 2, y = h * (0.35 + r.next() * 0.45), rx = rng(r, 30, 80), ry = rng(r, 8, h * 0.45);
    for (const ox of [-W * 2, 0, W * 2]) {
      const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rx);
      gr.addColorStop(0, rgba(col, 0.42 * density)); gr.addColorStop(1, rgba(col, 0));
      g.save(); g.translate(x + ox, y); g.scale(1, ry / rx); g.translate(-(x + ox), -y);
      g.fillStyle = gr; g.fillRect(x + ox - rx, y - rx, rx * 2, rx * 2); g.restore();
    }
  }
  // pixel-quantise the alpha a little so the fog sits with the art
  const img = g.getImageData(0, 0, W * 2, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] / 18) * 18;
  g.putImageData(img, 0, 0);
  return cv;
}
function fogFn(c: C, y: number, h: number, density: number, speed: number, col?: string): Fn {
  const fcol = col ?? (c.dark > 0.6 ? "#4a5878" : c.s.time === "dusk" ? "#c89890" : "#e8ecf0");
  const img = fogBank(c, h, density, c.s.seed + "fog" + y, fcol);
  return (g, t) => {
    const o = ((t * speed) % (W * 2) + W * 2) % (W * 2);
    g.drawImage(img, -o, y); g.drawImage(img, W * 2 - o, y);
  };
}

const vignettes = new Map<string, HTMLCanvasElement>();
function vignette(strength: number, col = "#0a0614") {
  const key = strength.toFixed(2) + col;
  let v = vignettes.get(key);
  if (!v) {
    const [cv, g] = cnv();
    const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, strength));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    v = cv; vignettes.set(key, v);
  }
  return v;
}

interface MoodFx { op?: GlobalCompositeOperation; col?: string; a?: number; op2?: GlobalCompositeOperation; col2?: string; a2?: number; edge?: string; edgeA?: number; pulse?: number }
const MOODS: Record<Mood, MoodFx> = {
  calm: {},
  tense: { op: "multiply", col: "#c4c0d4", a: 0.4, edge: "#140a1e", edgeA: 0.25 },
  danger: { op: "multiply", col: "#e8907c", a: 0.42, edge: "#5a0808", edgeA: 0.5, pulse: 0.0016 },
  combat: { op: "multiply", col: "#f0a888", a: 0.35, edge: "#6a1008", edgeA: 0.45, pulse: 0.0032 },
  sad: { op: "saturation", col: "#808080", a: 0.5, op2: "multiply", col2: "#90a4cc", a2: 0.35, edge: "#0a1428", edgeA: 0.3 },
  mystery: { op: "soft-light", col: "#7038c0", a: 0.5, op2: "multiply", col2: "#a8c8b8", a2: 0.3, edge: "#10301e", edgeA: 0.4, pulse: 0.0009 },
  triumph: { op: "soft-light", col: "#ffc030", a: 0.55, op2: "screen", col2: "#4a3010", a2: 0.35 },
};

function finishFront(c: C) {
  const ext = !c.interior;
  if (c.wet && ext) c.front.push(rainFn(c));
  if (c.snow && ext) c.front.push(snowFn(c));
  if (c.s.weather === "wind" && ext) c.front.push(windFn(c));
  if (c.fog && ext) { c.front.push(fogFn(c, c.horizon - 30, 70, 0.9, 0.006)); c.front.push(fogFn(c, c.groundY - 40, 80, 0.8, -0.011)); }
  if (c.storm) {
    const seed = Math.floor(hn(c.s.seed.length, 7) * 1000);
    c.front.push((g, t) => { const f = flashAt(seed, t); if (f > 0) { g.globalAlpha = f * (c.interior ? 0.18 : 0.42); g.fillStyle = "#e8f0ff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } });
  }
  const m = MOODS[c.s.mood] ?? {};
  const vig = vignette(c.interior ? 0.62 : 0.42);
  const edge = m.edge ? vignette(m.edgeA ?? 0.4, m.edge) : null;
  c.front.push((g, t) => {
    g.drawImage(vig, 0, 0);
    if (m.op && m.col) { g.globalCompositeOperation = m.op; g.globalAlpha = m.a ?? 0.3; g.fillStyle = m.col; g.fillRect(0, 0, W, H); }
    if (m.op2 && m.col2) { g.globalCompositeOperation = m.op2; g.globalAlpha = m.a2 ?? 0.3; g.fillStyle = m.col2; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = "source-over";
    if (edge) { g.globalAlpha = m.pulse ? 0.65 + 0.35 * Math.sin(t * m.pulse) : 1; g.drawImage(edge, 0, 0); }
    g.globalAlpha = 1;
  });
  if (c.s.mood === "triumph") c.front.push(motesFn(18, 0, W, 10, H - 20, c.s.seed + "tri", "#ffe8a0", 0.8));
  if (c.s.mood === "mystery") c.front.push(firefliesFn(10, 30, H - 30, c.s.seed + "mys", "#d8b8ff", "#9a6aff"));
}

// ============================================================ scene assembly
const CACHE = new Map<string, SceneHandle>();
const CACHE_MAX = 10;

export function makeScene(spec: SceneSpec): SceneHandle {
  const key = `${spec.bg}|${spec.time}|${spec.weather}|${spec.mood}|${spec.seed}`;
  const hit = CACHE.get(key);
  if (hit) { CACHE.delete(key); CACHE.set(key, hit); return hit; }
  const c = newC(spec);
  c.interior = INTERIOR_BGS.includes(spec.bg);
  (BUILD[spec.bg] ?? BUILD.field)(c);
  finishFront(c);
  const back = c.back, front = c.front;
  const flashSeed = Math.floor(hn(spec.seed.length, 7) * 1000);
  const warm = Math.min(0.2, c.warm);
  const handle: SceneHandle = {
    w: W, h: H, groundY: c.groundY, slots: c.slots, interior: c.interior,
    draw(ctx, t) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      for (const f of back) f(ctx, t);
      ctx.restore();
    },
    drawFront(ctx, t) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      for (const f of front) f(ctx, t);
      ctx.restore();
    },
    light(t) {
      if (c.storm) { const f = flashAt(flashSeed, t); if (f > 0.3) return { tint: "#e8f0ff", alpha: 0.45 * f }; }
      if (warm > 0.02 && (c.interior || c.dark > 0.4)) {
        const f = flick(t, 3);
        return { tint: mix(c.tint, "#ff9038", c.interior ? 0.8 : 0.45), alpha: (c.ta * (c.interior ? 0.4 : 0.8) + warm) * (0.9 + 0.12 * (f - 0.72)) };
      }
      return { tint: c.tint, alpha: c.ta };
    },
  };
  CACHE.set(key, handle);
  while (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  return handle;
}

type Builder = (c: C) => void;

// ============================================================ exterior pieces
function treeLine(L: Layer, y: number, col: string, o: { pine?: number; h?: [number, number]; step?: [number, number]; seed: string; fill?: boolean }) {
  const r = seeded(o.seed), [h0, h1] = o.h ?? [8, 16], [s0, s1] = o.step ?? [4, 8];
  const lit = hs(col, 0.14), dk = hs(col, -0.16);
  for (let x = -8; x < W + 8; x += r.int(s0, s1)) {
    const h = r.int(h0, h1), yy = y + r.int(-1, 2);
    if (r.next() < (o.pine ?? 0.5)) {
      for (let k = 0; k < h; k++) {
        const half = Math.round((k / h) * h * 0.3 + (k % 3 === 2 ? 1 : 0));
        L.span(x - half, x + half, yy - h + k, col);
        L.px(x - half, yy - h + k, lit);
        if (half > 1) L.px(x + half, yy - h + k, dk);
      }
    } else {
      const rad = h * 0.42;
      L.ellipse(x, yy - h * 0.55, rad, h * 0.48, col);
      L.ellipse(x - rad * 0.35, yy - h * 0.62, rad * 0.5, h * 0.3, lit);
      L.ellipse(x + rad * 0.45, yy - h * 0.4, rad * 0.4, h * 0.26, dk);
    }
  }
  if (o.fill !== false) L.rect(0, y, W, H - y, col);
}
function fern(L: Layer, x: number, y: number, s: number, col: string) {
  const lt = hs(col, 0.25), dk = hs(col, -0.25);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI + 0.35 + (k / 5) * (Math.PI - 0.7);
    let px = x, py = y;
    for (let i = 0; i < s; i++) {
      const f = i / s, aa = a + (a < -Math.PI / 2 ? -1 : 1) * f * 0.9;
      px += Math.cos(aa); py += Math.sin(aa) * 0.8 + f * 0.5;
      L.px(px, py, i % 2 ? col : dk);
      if (i % 2 === 0 && i < s - 1) { L.px(px, py - 1, lt); L.px(px + (a < -Math.PI / 2 ? -1 : 1), py + 1, col); }
    }
  }
}
function mushroom(L: Layer, x: number, y: number, col = "#d8402a") {
  L.rect(x, y - 3, 2, 3, "#f0e8d8");
  L.rect(x - 2, y - 5, 6, 2, col); L.rect(x - 1, y - 6, 4, 1, col);
  L.px(x - 1, y - 5, "#ffffff"); L.px(x + 2, y - 6, "#ffffff"); L.px(x - 2, y - 4, hs(col, -0.3)); L.px(x + 3, y - 4, hs(col, -0.3));
}
function logAt(L: Layer, x: number, y: number, len: number, col = "#6a4630") {
  L.rect(x, y - 6, len, 6, col);
  L.rect(x, y - 6, len, 1, hs(col, 0.25)); L.rect(x, y - 1, len, 1, hs(col, -0.35));
  for (let i = 4; i < len; i += 5) L.px(x + i, y - 3 - (i % 2), hs(col, -0.3));
  L.ellipse(x, y - 3, 2, 3, "#c8a070"); L.ellipse(x, y - 3, 1, 1, "#9a7048");
  for (let i = 0; i < len; i += 2) if (hn(i, x) > 0.5) L.px(x + i, y - 7, "#5a9a3a");
}
function shaftsFn(c: C, n: number, col: string, slope: number, a: number): Fn {
  const mk = (k: number) => {
    const [cv, g] = cnv();
    const r = seeded(c.s.seed + "shaft" + k);
    for (let i = 0; i < n; i++) {
      const x = r.next() * W * 1.1 - 30, w = rng(r, 5, 16);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.7, rgba(col, 0.25)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + slope * H, H); g.lineTo(x + slope * H, H); g.closePath(); g.fill();
    }
    return cv;
  };
  const A = mk(0), B = mk(1);
  return (g, t) => {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 0.0006)); g.drawImage(A, 0, 0);
    g.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 0.00047 + 2)); g.drawImage(B, 0, 0);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  };
}
/** Foliage framing the bottom corners (and optionally the top), drawn in front of actors. */
function frontFoliage(c: C, col: string, o: { top?: boolean; corners?: boolean; kind?: "fern" | "reed" | "rock" } = {}) {
  const L = new Layer();
  const r = seeded(c.s.seed + "ff");
  if (o.corners !== false) for (const side of [0, 1]) {
    const x0 = side ? W - 4 : 4;
    if (o.kind === "rock") { rock(L, side ? W - 10 : 10, H + 2, 34, 14, "#5a5a68", r, "#4a7a3a"); continue; }
    for (let i = 0; i < 4; i++) {
      const x = x0 + (side ? -1 : 1) * r.int(0, 18), y = H + 2 - r.int(0, 4);
      if (o.kind === "reed") { for (let k = 0; k < 6; k++) { const hh = r.int(14, 26), xx = x + r.int(-6, 6); L.rect(xx, y - hh, 1, hh, k % 2 ? "#5a7a30" : "#7a9a40"); if (k % 3 === 0) L.rect(xx, y - hh - 4, 2, 4, "#6a4428"); } }
      else fern(L, x, y, r.int(11, 17), hs(col, (r.next() - 0.5) * 0.2));
    }
    bush(L, side ? W - 2 : 2, H + 3, 9, hs(col, -0.15), r);
  }
  if (o.top) {
    for (let x = -6; x < W + 6; x += r.int(5, 11)) {
      const len = Math.round(Math.pow(Math.abs((x - W / 2) / (W / 2)), 1.6) * 16 + r.int(0, 4));
      if (len < 2) continue;
      L.p.blob(x, -2, r.int(5, 9), len * 0.6 + 3, hs(col, -0.1 + (r.next() - 0.5) * 0.15), { outline: false });
      if (r.chance(0.5)) for (let k = 0; k < len + 6; k++) L.px(x + Math.round(Math.sin(k * 0.4) * 0.6), k, k % 3 ? "#3a6a2a" : "#5a9a3a");
    }
  }
  L.outline((n) => `rgb(${Math.round(n[0] * 0.3)},${Math.round(n[1] * 0.3)},${Math.round(n[2] * 0.34) + 10})`);
  const img = prep(c, L, 0);
  // darken the foreground a touch: it is closer and out of the light
  const g0 = img.getContext("2d")!;
  g0.globalCompositeOperation = "source-atop"; g0.fillStyle = "rgba(10,10,30,0.25)"; g0.fillRect(0, 0, W, H); g0.globalCompositeOperation = "source-over";
  c.front.push((g, t) => {
    const dx = Math.round(Math.sin(t * 0.0013 * (1 + c.wind)) * (0.5 + c.wind * 0.8));
    g.drawImage(img, 0, 0, W, 40, dx, 0, W, 40);
    g.drawImage(img, 0, 40, W, H - 40, 0, 40, W, H - 40);
  });
}
function treeOf(r: R, kind: string, h: number, col: string): Layer {
  if (kind === "pine" || (kind === "mixed" && r.chance(0.5))) return pineSprite(r, h, kind === "pine" ? col : hs(col, -0.12));
  if (kind === "birch") return broadSprite(r, h * 0.32, hs(col, 0.08), "birch");
  if (kind === "willow") return broadSprite(r, h * 0.34, col, "willow");
  return broadSprite(r, h * 0.33, col, r.chance(0.3) ? "round" : "oak");
}

/** Generic far + mid backdrop for open country. */
function countryBackdrop(c: C, o: { mtn?: boolean; snow?: boolean; hillCol?: string; trees?: string; fields?: boolean; base?: number }) {
  const r = c.r, base = o.base ?? c.horizon;
  if (o.mtn) {
    const L0 = lay(c);
    mountains(L0, c, base - 4, r.int(34, 52), "#7f8cb0", { snow: o.snow ? base - 30 : undefined, seed: "far" });
    commit(c, L0, 0.6);
  }
  const L1 = lay(c);
  hills(L1, c, base + 4, 14, o.hillCol ?? "#6f9a6a", { freq: 0.018, seed: "h1" });
  treeLine(L1, base + 8, hs(o.hillCol ?? "#6f9a6a", -0.12), { seed: c.s.seed + "tl1", h: [5, 10], step: [3, 9], pine: 0.4, fill: false });
  commit(c, L1, 0.42);
  const L2 = lay(c);
  const ys = hills(L2, c, base + 16, 14, "#5c9a48", { freq: 0.026, fields: o.fields, trees: o.trees ?? "#3c7a3c", seed: "h2" });
  commit(c, L2, 0.18);
  return ys;
}

// ============================================================ exterior builders
function bForest(c: C) {
  const r = c.r; c.horizon = 92;
  skyLayer(c);
  const kind = r.pick(["pine", "mixed", "broad", "birch"]);
  const green = kind === "pine" ? "#2f6a48" : kind === "birch" ? "#6aa646" : "#3d8240";
  const L1 = lay(c);
  hills(L1, c, 100, 12, "#5a8a6a", { freq: 0.025, seed: "f1" });
  treeLine(L1, 102, "#4c7c60", { pine: kind === "pine" ? 0.9 : 0.4, h: [8, 16], step: [3, 6], seed: c.s.seed + "f1" });
  commit(c, L1, 0.55);
  const L2 = lay(c);
  treeLine(L2, 116, hs(green, -0.2), { pine: kind === "pine" ? 0.9 : 0.35, h: [20, 32], step: [5, 9], seed: c.s.seed + "f2" });
  for (let x = -10; x < W + 10; x += r.int(16, 26)) plant(L2, treeOf(r, kind, 36 + r.int(0, 18), hs(green, -0.06)), x, 118 + r.int(0, 3));
  commit(c, L2, 0.3);
  const L2b = lay(c);
  for (let x = -20; x < W + 20; x += r.int(26, 44)) plant(L2b, treeOf(r, kind, 58 + r.int(0, 22), green), x, 124 + r.int(0, 3));
  L2b.p.blob(W / 2, -8, W * 0.7, 18, hs(green, -0.1), { outline: false });
  commit(c, L2b, 0.12);
  if (c.s.time !== "night" && c.over < 0.6) anim(c, shaftsFn(c, 5, c.s.time === "day" ? "#fff6d0" : "#ffc890", 0.35, 0.16));
  const L3 = lay(c);
  ground(c, L3, 122, kind === "birch" ? "meadow" : "grass", { flowers: 16, tufts: 54 });
  // leaf litter & a winding path
  const px0 = r.int(110, 210);
  for (let y = 122; y < H; y++) {
    const f = (y - 122) / (H - 122), cx = px0 + Math.sin(f * 3 + r.next() * 0.1) * 30 * f, hw = 4 + f * 26;
    for (let x = Math.round(cx - hw); x <= cx + hw; x++) if (hn(x, y, 5) > 0.15 + Math.abs(x - cx) / hw * 0.5) L3.px(x, y, (x + y) % 5 === 0 ? "#8a6a44" : bay(x, y) > 0.5 ? "#9a7a4c" : "#a88a58");
  }
  for (let i = 0; i < 120; i++) { const x = r.int(0, W), y = r.int(124, H); L3.px(x, y, r.pick(["#c8902a", "#a05a2a", "#d8b040", "#7a5a2a"])); }
  // big trunks at the edges, their canopy above the frame
  for (const side of [0, 1]) {
    if (r.chance(0.25)) continue;
    const tw = r.int(12, 18), tx = side ? W - tw + r.int(0, 6) : -r.int(0, 6), bark = kind === "birch" ? "#e0dcd0" : "#5a3e2c";
    for (let x = 0; x < tw; x++) {
      const u = x / tw;
      for (let y = 0; y < 140; y++) {
        let cc = u < 0.2 ? hs(bark, 0.2) : u > 0.7 ? hs(bark, -0.3) : bark;
        if (kind === "birch") { if (hn(Math.floor(y / 3), x >> 2, 9) > 0.8) cc = "#2a2a2a"; }
        else if (hn(x, Math.floor(y / 4), 7) > 0.78) cc = hs(cc, -0.25); else if (hn(x, y, 8) > 0.96) cc = hs(cc, 0.3);
        L3.px(tx + x, y, cc);
      }
    }
    for (let k = 0; k < 4; k++) L3.line(tx + tw / 2, 132, tx + tw / 2 + (side ? -1 : 1) * r.int(8, 18), 142 + r.int(0, 4), hs(bark, -0.1));
    L3.p.blob(tx + tw / 2, 10, 34, 22, green, { outline: false });
    if (kind !== "birch") ivy(L3, tx + (side ? 2 : tw - 3), 138, r.int(30, 70), r.int(0, 99));
  }
  // undergrowth
  for (let i = 0; i < 7; i++) bush(L3, r.int(0, W), r.int(124, 134), r.int(5, 9), hs(green, (r.next() - 0.5) * 0.2), r, r.chance(0.3) ? "#d83a4a" : undefined);
  for (let i = 0; i < 6; i++) fern(L3, r.int(10, W - 10), r.int(128, 140), r.int(7, 11), hs(green, 0.05));
  for (let i = 0; i < r.int(2, 6); i++) mushroom(L3, r.int(20, W - 20), r.int(132, 142), r.chance(0.7) ? "#d8402a" : "#c89040");
  if (r.chance(0.6)) logAt(L3, r.int(20, 220), 140, r.int(22, 40));
  if (r.chance(0.5)) rock(L3, r.int(30, 290), 136, r.int(10, 18), r.int(6, 9), "#7a7a86", r, "#5a9a3a");
  commit(c, L3, 0);
  swayTree(c, treeOf(r, kind, 52 + r.int(0, 14), green), r.int(58, 100), 130);
  swayTree(c, treeOf(r, kind, 48 + r.int(0, 14), green), r.int(222, 266), 128);
  frontFoliage(c, green, { top: true });
  if (c.dark < 0.5 && !c.wet) anim(c, butterfliesFn(3, 110, 140, c.s.seed));
  if (c.dark >= 0.5 && !c.wet) anim(c, firefliesFn(22, 70, 150, c.s.seed));
  if (c.s.time !== "night" && c.over < 0.6) anim(c, motesFn(20, 40, 280, 40, 130, c.s.seed));
  c.front.push(leavesFn(c.s.weather === "wind" ? 14 : 6, kind === "pine" ? ["#5a7a3a", "#8a6a3a"] : ["#d8a030", "#c86a2a", "#7ab040", "#a8c040"], c.s.seed, c.wind));
  c.groundY = 152; c.slots = stdSlots(150);
}

function windmill(c: C, L: Layer, x: number, base: number, s = 1) {
  const h = Math.round(34 * s), w0 = Math.round(14 * s), w1 = Math.round(8 * s);
  L.tex([[x - w0 / 2, base], [x - w1 / 2, base - h], [x + w1 / 2, base - h], [x + w0 / 2, base]], (px, py) => {
    const u = (px - x) / (w0 / 2);
    const row = Math.floor((base - py) / 3);
    const cc = u < -0.4 ? "#f0e8dc" : u > 0.4 ? "#b8b0b0" : "#ddd4cc";
    return (base - py) % 3 === 0 && (px + row * 2) % 5 === 0 ? hs(cc, -0.15) : cc;
  });
  L.tex([[x - w1 / 2 - 2, base - h + 1], [x, base - h - 7 * s], [x + w1 / 2 + 2, base - h + 1]], (px, py) => roofCol("shingle", "#8a4a32", px, py, 0.5, (px - x + 6) / 12, 4));
  L.rect(x - 2, base - 8, 4, 8, "#6a4428"); L.rect(x - 1, base - h + 10, 2, 3, "#3a4a6a");
  const hx = x, hy = base - h - 1;
  const col = gc(c, "#6a4a30"), sail = gc(c, "#efe6d4");
  anim(c, (g, t) => {
    const a0 = t * (0.0007 + c.wind * 0.0012);
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a), len = 20 * s;
      g.fillStyle = col; pline(g, hx, hy, hx + ca * len, hy + sa * len);
      g.fillStyle = sail;
      for (let i = 5; i < len; i += 2) { const px = hx + ca * i, py = hy + sa * i; pline(g, px, py, px - sa * 4 * s, py + ca * 4 * s); }
    }
    g.fillStyle = col; g.fillRect(hx - 1, hy - 1, 3, 3);
  });
}
function sheepFn(c: C, pts: { x: number; y: number }[]): Fn {
  const wool = gc(c, "#f2eee6"), woolS = gc(c, "#c8c0b8"), face = gc(c, "#2a2228");
  return (g, t) => {
    for (const p of pts) {
      const ph = hn(p.x, p.y) * 9, graze = Math.sin(t * 0.0009 + ph) > 0.2 ? 1 : 0, dir = hn(p.y, p.x) > 0.5 ? 1 : -1;
      const x = Math.round(p.x + Math.sin(t * 0.00012 + ph) * 6), y = p.y;
      g.fillStyle = woolS; g.fillRect(x - 3, y - 4, 7, 4);
      g.fillStyle = wool; g.fillRect(x - 3, y - 5, 7, 3); g.fillRect(x - 2, y - 6, 5, 1);
      g.fillStyle = face; g.fillRect(x + dir * 4 - (dir < 0 ? 1 : 0), y - 5 + graze * 2, 2, 2);
      g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1);
    }
  };
}
function bHill(c: C) {
  const r = c.r; c.horizon = 106;
  skyLayer(c);
  countryBackdrop(c, { mtn: true, snow: r.chance(0.6), fields: true });
  const L3 = lay(c);
  const p = r.next() * 6;
  const top = (x: number) => 126 + Math.sin(x * 0.011 + p) * 6 + Math.sin(x * 0.03 + p) * 2;
  ground(c, L3, 120, "meadow", { top, flowers: 40, tufts: 60 });
  // drystone wall following the slope
  for (let x = 0; x < W; x += 3) { const y = Math.round(top(x)) + 6; for (let k = 0; k < 2; k++) { const cc = hs("#9a968c", (hn(x, k) - 0.5) * 0.3); L3.rect(x, y - 3 + k * 2, 3, 2, cc); L3.px(x, y - 3 + k * 2, hs(cc, 0.3)); } L3.px(x + 2, y, "#4a4840"); }
  for (let i = 0; i < 4; i++) rock(L3, r.int(10, W - 10), r.int(140, 170), r.int(8, 16), r.int(5, 8), "#8a8a94", r, "#6aa040");
  const wm = r.chance(0.55);
  commit(c, L3, 0);
  if (wm) { const L = lay(c); windmill(c, L, r.int(180, 280), Math.round(top(230)) - 2, 0.9); commit(c, L, 0.1); }
  anim(c, sheepFn(c, Array.from({ length: r.int(2, 5) }, () => { const x = r.int(20, 300); return { x, y: Math.round(top(x)) + r.int(9, 13) }; })));
  swayTree(c, broadSprite(r, r.int(13, 17), "#4a9040", "oak"), r.chance(0.5) ? r.int(20, 70) : r.int(250, 300), Math.round(top(60)) + 10);
  if (!c.wet) { anim(c, birdsFn(c, { y0: 30, y1: 60 })); if (c.dark < 0.5) anim(c, butterfliesFn(3, 128, 150, c.s.seed)); else anim(c, firefliesFn(12, 110, 150, c.s.seed)); }
  c.front.push(leavesFn(c.s.weather === "wind" ? 10 : 0, ["#7ab040", "#a8c040"], c.s.seed, c.wind));
  c.groundY = 152; c.slots = stdSlots(150);
}

function bRoad(c: C) {
  const r = c.r; c.horizon = 106;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.6), snow: r.chance(0.4) });
  const L3 = lay(c);
  ground(c, L3, 120, r.chance(0.3) ? "dry" : "grass", { flowers: 26, tufts: 50 });
  // the road recedes to a vanishing point
  const vx = r.int(120, 200), vy = 120;
  const dirt = c.snow ? ["#c8ccd8", "#d8dce6", "#b8bcca"] : ["#a07a4c", "#b08a58", "#8a6a40"];
  for (let y = vy; y < H; y++) {
    const f = (y - vy) / (H - vy), hw = 3 + f * 110, cx = vx + (160 - vx) * f;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - cx) / hw;
      const edge = Math.abs(u) > 0.92 - hn(x, y, 3) * 0.12;
      if (edge && hn(x, y, 4) > 0.5) continue;
      let cc = dirt[0];
      const n = vnoise(x, y * 2, 6, 3);
      if (n > 0.6) cc = dirt[1]; else if (n < 0.3) cc = dirt[2];
      if (Math.abs(Math.abs(u) - 0.42) < 0.05 + f * 0.02) cc = hs(dirt[2], -0.18); // cart ruts
      if (Math.abs(u) < 0.08 && hn(x, y, 6) > 0.6) cc = c.snow ? "#e8ecf4" : "#6a9a40"; // grass down the middle
      L3.px(x, y, cc);
      if (hn(x, y, 7) > 0.985) { L3.px(x, y, "#c8c0b0"); L3.px(x, y + 1, "#6a6050"); }
    }
  }
  if (c.wet) for (let i = 0; i < 6; i++) { const f = rng(r, 0.3, 1), y = Math.round(vy + f * (H - vy)), cx = vx + (160 - vx) * f + (r.next() - 0.5) * f * 120; L3.ellipse(cx, y, 4 + f * 10, 1 + f * 2, mix(c.sky[3], "#5a6a8a", 0.4)); }
  // fence posts along one side, receding
  const side = r.chance(0.5) ? 1 : -1;
  for (let k = 0; k < 9; k++) {
    const f = Math.pow(k / 8, 1.6), y = Math.round(vy + 4 + f * (H - vy - 4)), cx = vx + (160 - vx) * f + side * (12 + f * 140);
    const ph = Math.max(2, Math.round(3 + f * 12));
    L3.rect(cx, y - ph, Math.max(1, Math.round(1 + f * 2)), ph, "#7a5a3a");
    L3.px(cx, y - ph, "#a88058");
    if (k > 0) { const f0 = Math.pow((k - 1) / 8, 1.6), y0 = Math.round(vy + 4 + f0 * (H - vy - 4)), x0 = vx + (160 - vx) * f0 + side * (12 + f0 * 140), ph0 = Math.max(2, Math.round(3 + f0 * 12)); L3.line(x0, y0 - ph0 * 0.7, cx, y - ph * 0.7, "#8a6a44"); L3.line(x0, y0 - ph0 * 0.3, cx, y - ph * 0.3, "#8a6a44"); }
  }
  const spx = side > 0 ? r.int(20, 60) : r.int(260, 300);
  signpost(L3, spx, 142, r);
  if (r.chance(0.5)) { // milestone
    const mx = side > 0 ? r.int(240, 290) : r.int(30, 80);
    L3.rect(mx, 128, 7, 9, "#a8a4a0"); L3.rect(mx + 1, 127, 5, 1, "#a8a4a0"); L3.rect(mx, 128, 2, 9, "#c8c4c0"); L3.rect(mx + 5, 128, 2, 9, "#7a7680"); L3.px(mx + 3, 131, "#5a5660"); L3.px(mx + 3, 133, "#5a5660");
  }
  if (r.chance(0.4)) cart(L3, side > 0 ? r.int(220, 250) : r.int(40, 70), 136, r);
  for (let i = 0; i < 4; i++) bush(L3, r.chance(0.5) ? r.int(0, 60) : r.int(260, W), r.int(122, 132), r.int(4, 8), "#4a8a3c", r);
  commit(c, L3, 0);
  swayTree(c, broadSprite(r, r.int(12, 16), "#4a9040", r.chance(0.5) ? "oak" : "round"), side > 0 ? r.int(250, 300) : r.int(20, 70), 128);
  if (!c.wet) anim(c, birdsFn(c, { y0: 24, y1: 60 }));
  if (c.s.weather === "wind" || r.chance(0.4)) c.front.push(motesFn(16, 0, W, 110, 170, c.s.seed + "dust", "#e0c890", 0.5));
  frontFoliage(c, "#4a8a3c", { corners: r.chance(0.6) });
  c.groundY = 152; c.slots = stdSlots(150);
}

function reeds(c: C, xs: [number, number], y0: number, y1: number, n: number, list?: Fn[]) {
  const r = seeded(c.s.seed + "reed" + y0);
  const ts: Tuft[] = Array.from({ length: n }, () => ({ x: r.int(xs[0], xs[1]), y: r.int(y0, y1), h: r.int(8, 15), c: ["#4a6a2a", "#8aa848"] as [string, string], n: 3, ph: r.next() * 6 }));
  tuftsFn(c, ts, list ?? (c.open ? c.pend : c.back), true);
}
function bRiver(c: C) {
  const r = c.r; c.horizon = 100;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.5), snow: r.chance(0.3), base: 98 });
  const L2 = lay(c);
  treeLine(L2, 116, "#3a7040", { seed: c.s.seed + "rb", h: [14, 24], step: [5, 10], pine: 0.4 });
  for (let x = 0; x < W; x += r.int(30, 60)) plant(L2, treeOf(r, "mixed", r.int(28, 40), "#3f8040"), x, 118);
  L2.rect(0, 116, W, 3, "#4a7a3a"); for (let x = 0; x < W; x++) if (hn(x, 2) > 0.5) L2.px(x, 115, "#5a9a40");
  commit(c, L2, 0.2);
  water(c, 118, 140, { col: "#3a78a8", amp: 1.2, glints: 30 });
  const L3 = lay(c);
  const p = r.next() * 9, top = (x: number) => 138 + Math.sin(x * 0.03 + p) * 3 + Math.sin(x * 0.09) * 1.5;
  ground(c, L3, 136, "grass", { top, flowers: 24, tufts: 46 });
  for (let x = 0; x < W; x++) { const y = Math.round(top(x)); L3.px(x, y, "#8a6a44"); L3.px(x, y + 1, "#6a5034"); if (hn(x, 11) > 0.6) L3.px(x, y - 1, "#7a5a3a"); }
  const rocks: [number, number][] = [];
  for (let i = 0; i < r.int(2, 4); i++) { const x = r.int(20, 300), y = r.int(124, 134); rock(L3, x, y, r.int(7, 13), r.int(3, 5), "#7a7a86", r); rocks.push([x, y]); }
  if (r.chance(0.4)) { // little jetty
    const jx = r.int(40, 240);
    for (let k = 0; k < 4; k++) L3.rect(jx + k * 9, 128, 2, 14, "#5a3e28");
    for (let x = jx - 1; x < jx + 30; x += 3) { L3.rect(x, 127, 3, 2, "#a07a4c"); L3.px(x, 127, "#c09a68"); L3.px(x + 2, 128, "#6a4a2c"); }
  }
  commit(c, L3, 0);
  reeds(c, [0, W], 134, 142, 34);
  const foam = gc(c, "#f0f8ff");
  anim(c, (g, t) => { g.fillStyle = foam; for (const [x, y] of rocks) for (let k = 0; k < 4; k++) { const a = (t * 0.003 + k * 1.6) % 6.28; g.globalAlpha = 0.5 + 0.5 * Math.sin(a); g.fillRect(Math.round(x - 8 + k * 4 + Math.sin(a) * 2), y + 1 + (k % 2), 2, 1); } g.globalAlpha = 1; });
  anim(c, fishFn(c, 120, 136));
  if (!c.wet) { anim(c, birdsFn(c, { y0: 20, y1: 50 })); if (c.dark < 0.5) anim(c, dragonfliesFn(c, 120, 140)); else anim(c, firefliesFn(16, 110, 150, c.s.seed)); }
  frontFoliage(c, "#4a8a3c", { kind: "reed" });
  c.groundY = 154; c.slots = stdSlots(152, 3);
}
function fishFn(c: C, y0: number, y1: number): Fn {
  const col = gc(c, "#c8d8e0");
  return (g, t) => {
    const per = 7000, k = Math.floor(t / per), a = (t % per) / 900;
    if (a > 1 || hn(k, 31) < 0.4) return;
    const x = 30 + hn(k, 32) * 260, y = y0 + hn(k, 33) * (y1 - y0);
    const px = x + a * 14, py = y - Math.sin(a * Math.PI) * 9;
    g.fillStyle = col; g.fillRect(Math.round(px), Math.round(py), 3, 1); g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 1, 1);
    if (a > 0.85 || a < 0.12) { g.globalAlpha = 0.7; g.fillRect(Math.round(x + (a > 0.5 ? 14 : 0)) - 2, Math.round(y), 5, 1); g.globalAlpha = 1; }
  };
}
function dragonfliesFn(c: C, y0: number, y1: number): Fn {
  const col = gc(c, "#40c0e0"), wing = gc(c, "#e0f4ff");
  return (g, t) => {
    for (let i = 0; i < 2; i++) {
      const s = t * 0.0005 + i * 4, dart = Math.floor(s * 2) / 2;
      const x = 60 + hn(Math.floor(dart * 2), i) * 200 + Math.sin(t * 0.01) * 0.5, y = y0 + hn(Math.floor(dart * 2), i + 5) * (y1 - y0);
      g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 4, 1);
      g.fillStyle = wing; const f = Math.floor(t / 40) % 2; g.fillRect(Math.round(x) + 1, Math.round(y) - 1 - f, 1, 1); g.fillRect(Math.round(x) + 2, Math.round(y) - 1 - f, 1, 1);
    }
  };
}

function bLake(c: C) {
  const r = c.r; c.horizon = 98;
  skyLayer(c);
  const L0 = lay(c);
  mountains(L0, c, 102, r.int(30, 50), "#7a88aa", { snow: r.chance(0.6) ? 74 : undefined, seed: "lk" });
  commit(c, L0, 0.45);
  const L1 = lay(c);
  treeLine(L1, 106, "#3e6a50", { seed: c.s.seed + "lk1", h: [6, 12], step: [3, 6], pine: 0.7, fill: false });
  L1.rect(0, 105, W, 2, "#4a6a48");
  if (r.chance(0.5)) { const tx = r.int(40, 280); L1.rect(tx, 88, 6, 18, "#a8a0a0"); L1.rect(tx - 1, 86, 8, 2, "#8a8288"); L1.tex([[tx - 1, 86], [tx + 3, 78], [tx + 7, 86]], () => "#5a4a6a"); L1.px(tx + 2, 94, "#2a2430"); addWin(c, tx + 1, 93, 3, 4, true); }
  commit(c, L1, 0.3);
  water(c, 107, 146, { col: "#3a6e9c", amp: 1, squash: 1, glints: 40, reflect: 0.6 });
  const swans = gc(c, "#f8f8f4"), beak = gc(c, "#e8902a");
  anim(c, (g, t) => { // ducks / swans drifting
    for (let i = 0; i < 3; i++) {
      const x = Math.round(((hn(i, 1) * W + t * 0.003 * (i % 2 ? 1 : -1)) % (W + 20) + W + 20) % (W + 20)) - 10, y = Math.round(118 + hn(i, 2) * 18 + Math.sin(t * 0.002 + i) * 0.6);
      g.fillStyle = swans; g.fillRect(x, y - 2, 5, 2); g.fillRect(x + (i % 2 ? 4 : 0), y - 5, 1, 3); g.fillStyle = beak; g.fillRect(x + (i % 2 ? 5 : -1), y - 5, 1, 1);
      g.globalAlpha = 0.35; g.fillStyle = swans; g.fillRect(x - 1, y, 7, 1); g.globalAlpha = 1;
    }
  });
  if (r.chance(0.5)) anim(c, boatFn(c, r.int(60, 260), 112));
  const L3 = lay(c);
  const p = r.next() * 9, top = (x: number) => 144 + Math.sin(x * 0.025 + p) * 3;
  ground(c, L3, 142, r.chance(0.5) ? "grass" : "sand", { top, flowers: 14, tufts: 30 });
  for (let x = 0; x < W; x++) { const y = Math.round(top(x)); for (let k = 0; k < 3; k++) if (hn(x, k, 3) > 0.4) L3.px(x, y + k, k === 0 ? "#c8b890" : "#a89870"); }
  for (let i = 0; i < 14; i++) { const x = r.int(0, W), y = r.int(130, 141); L3.ellipse(x, y, r.int(2, 4), 1, "#3a7a3a"); L3.px(x - 1, y - 1, "#5aa04a"); if (r.chance(0.3)) { L3.px(x + 1, y - 1, "#f0a0c0"); L3.px(x + 1, y - 2, "#ffffff"); } }
  for (let i = 0; i < 6; i++) rock(L3, r.int(0, W), r.int(146, 160), r.int(5, 10), r.int(3, 5), "#8a8a94", r);
  commit(c, L3, 0);
  reeds(c, [0, 90], 136, 146, 18); reeds(c, [230, W], 136, 146, 18);
  if (c.s.time === "dawn" || c.fog) c.front.push(fogFn(c, 100, 50, 0.6, 0.004));
  if (!c.wet) { anim(c, birdsFn(c, { y0: 20, y1: 50 })); if (c.dark >= 0.5) anim(c, firefliesFn(14, 120, 150, c.s.seed)); }
  c.groundY = 156; c.slots = stdSlots(154, 3);
}
function boatFn(c: C, x: number, y: number): Fn {
  const L = new Layer(24, 22);
  L.tex([[1, 16], [23, 16], [19, 21], [4, 21]], (px, py) => (py === 16 ? "#a07a4c" : py > 19 ? "#4a3020" : "#6a4630"));
  L.rect(11, 2, 1, 14, "#5a3e28");
  L.tex([[12, 2], [21, 14], [12, 14]], (px) => (px > 17 ? "#d8d0c0" : "#f4ecdc"));
  L.tex([[10, 4], [10, 14], [4, 14]], () => "#e4dccc");
  const img = prep(c, L, 0.25);
  return (g, t) => {
    const dx = Math.sin(t * 0.00015) * 20, dy = Math.round(Math.sin(t * 0.0015) * 0.8);
    g.drawImage(img, Math.round(x + dx), y - 21 + dy);
  };
}

// ------------------------------------------------------------ field
function wheatFn(c: C, y0: number, y1: number): Fn {
  const N = 8, frames: HTMLCanvasElement[] = [];
  const r = seeded(c.s.seed + "wheat");
  const stalks: { x: number; y: number; h: number; c: number }[] = [];
  for (let y = y0; y <= y1; y += 2) {
    const f = (y - y0) / (y1 - y0);
    for (let x = -4; x < W + 4; x += f < 0.3 ? 1 : 2) if (r.next() < 0.85) stalks.push({ x: x + r.int(0, 1), y: y + r.int(0, 1), h: Math.round(4 + f * 14 + r.next() * 3), c: r.int(0, 3) });
  }
  const pal = c.snow ? ["#c8b890", "#d8ccb0", "#b0a080", "#e8e0d0"] : ["#d8a840", "#e8c060", "#c08a30", "#f4dc88"];
  for (let k = 0; k < N; k++) {
    const L = new Layer(W, H);
    const ph = (k / N) * Math.PI * 2;
    for (const s of stalks) {
      const f = (s.y - y0) / (y1 - y0);
      const lean = Math.sin(s.x * 0.045 - ph + s.y * 0.05) * (0.8 + c.wind * 1.6) * (0.4 + f) + c.wind * 1.2;
      const col = pal[s.c];
      for (let i = 0; i < s.h; i++) { const u = i / s.h; L.px(Math.round(s.x + lean * u * u * 2), s.y - i, i < s.h * 0.3 ? hs(col, -0.25) : col); }
      const tx = Math.round(s.x + lean * 2), ty = s.y - s.h;
      L.rect(tx, ty - 2, 1, 3, hs(col, 0.25)); if (f > 0.5) { L.px(tx - 1, ty - 1, col); L.px(tx + 1, ty, col); }
    }
    L.rect(0, y1 + 1, W, H - y1, "rgba(0,0,0,0)");
    frames.push(prep(c, L, 0));
  }
  return (g, t) => g.drawImage(frames[Math.floor(t / (170 - c.wind * 60)) % N], 0, 0);
}
function bField(c: C) {
  const r = c.r; c.horizon = 104;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.3), fields: true });
  const L2 = lay(c);
  // farmstead in the distance
  const fx = r.int(30, 230);
  cottage(c, L2, fx, 124, 34, 12, { wall: "#e8dcc4", kind: "timber", roof: "#c8a050", roofKind: "thatch", chimney: true, s: r.int(0, 99) });
  if (r.chance(0.6)) windmill(c, L2, fx > 160 ? fx - 50 : fx + 80, 124, 0.8);
  for (let i = 0; i < 3; i++) { const hx = r.int(0, W); L2.p.blob(hx, 120, 6, 5, "#d8b050", { outline: false }); L2.rect(hx - 6, 124, 13, 1, "#8a6a30"); }
  L2.rect(0, 124, W, H - 124, "#9aa848");
  commit(c, L2, 0.15);
  anim(c, wheatFn(c, 124, 146));
  const L3 = lay(c);
  ground(c, L3, 146, "dirt", { tufts: 0 });
  for (let x = 0; x < W; x++) { if (hn(x, 3) > 0.3) L3.px(x, 146, "#8a9a3a"); if (hn(x, 4) > 0.6) L3.px(x, 147, "#7a8a30"); }
  for (let x = 0; x < W; x += 2) if (hn(x, 5) > 0.5) L3.px(x, 158 + Math.round(hn(x, 6) * 3), "#8a6a40");
  for (let i = 0; i < 12; i++) { const x = r.int(0, W), y = r.int(144, 150); L3.px(x, y, "#e03a2a"); L3.px(x + 1, y, "#e03a2a"); L3.px(x, y + 1, "#2a1a1a"); }
  const scx = r.chance(0.5) ? r.int(16, 40) : r.int(280, 304);
  L3.rect(scx, 118, 2, 34, "#6a4a2a"); L3.rect(scx - 9, 126, 20, 2, "#6a4a2a");
  L3.rect(scx - 5, 124, 12, 12, "#6a7aa0"); L3.rect(scx - 5, 124, 3, 12, "#8a9ac0"); L3.ellipse(scx + 1, 120, 4, 4, "#e0c890"); L3.rect(scx - 5, 114, 13, 3, "#8a5a3a"); L3.rect(scx - 2, 111, 7, 3, "#8a5a3a");
  L3.px(scx - 1, 119, "#2a1a1a"); L3.px(scx + 2, 119, "#2a1a1a"); for (let k = 0; k < 4; k++) L3.px(scx - 10 - k % 2, 127 + k, "#e8d070");
  commit(c, L3, 0);
  if (!c.wet) { anim(c, birdsFn(c, { y0: 30, y1: 70 })); if (c.dark < 0.5) anim(c, butterfliesFn(4, 112, 140, c.s.seed)); else anim(c, firefliesFn(16, 110, 145, c.s.seed)); }
  c.groundY = 156; c.slots = stdSlots(154, 3);
}

// ------------------------------------------------------------ village
function chickensFn(c: C, n: number, y0: number, y1: number): Fn {
  const r = seeded(c.s.seed + "chk");
  const ch = Array.from({ length: n }, () => ({ x: r.int(30, 290), y: r.int(y0, y1), ph: r.next() * 9, col: r.pick(["#f4f0e8", "#c87a3a", "#8a5a3a"]) }));
  const comb = gc(c, "#e03a2a"), leg = gc(c, "#e8a030");
  const cols = ch.map((k) => gc(c, k.col));
  return (g, t) => ch.forEach((k, i) => {
    const s = t * 0.00025 + k.ph, dir = Math.cos(s) > 0 ? 1 : -1;
    const x = Math.round(k.x + Math.sin(s) * 14), y = k.y;
    const peck = Math.sin(t * 0.004 + k.ph * 3) > 0.7 ? 2 : 0;
    g.fillStyle = cols[i]; g.fillRect(x - 2, y - 4, 5, 3); g.fillRect(x - 3 * dir + (dir < 0 ? 0 : 0), y - 5, 1, 2);
    g.fillRect(x + 2 * dir, y - 6 + peck, 2, 2);
    g.fillStyle = comb; g.fillRect(x + 2 * dir + (dir > 0 ? 1 : 0), y - 7 + peck, 1, 1);
    g.fillStyle = leg; g.fillRect(x, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x + 3 * dir + (dir > 0 ? 1 : -1), y - 5 + peck, 1, 1);
  });
}
function laundryFn(c: C, x0: number, x1: number, y: number): Fn {
  const r = seeded(c.s.seed + "laundry");
  const items: { x: number; w: number; h: number; col: string }[] = [];
  for (let x = x0 + 4; x < x1 - 8; x += r.int(9, 13)) items.push({ x, w: r.int(5, 8), h: r.int(6, 10), col: gc(c, r.pick(["#f4f0e8", "#a8c8e8", "#e8a0a0", "#c8d890", "#f0d890"])) });
  const rope = gc(c, "#d8ccb0");
  return (g, t) => {
    g.fillStyle = rope;
    for (let x = x0; x <= x1; x++) { const u = (x - x0) / (x1 - x0); g.fillRect(x, Math.round(y + Math.sin(u * Math.PI) * 3), 1, 1); }
    for (const it of items) {
      const u = (it.x - x0) / (x1 - x0), yy = Math.round(y + Math.sin(u * Math.PI) * 3);
      for (let i = 0; i < it.w; i++) {
        const sw = Math.round(Math.sin(t * 0.003 * (1 + c.wind) + it.x * 0.3 + i * 0.4) * (0.6 + c.wind * 1.4));
        g.fillStyle = i % 3 === 2 ? hs(it.col, -0.15) : it.col;
        g.fillRect(it.x + i, yy + 1, 1, it.h - 2);
        g.fillRect(it.x + i + sw, yy + it.h - 1, 1, 1);
      }
    }
  };
}
function bVillage(c: C) {
  const r = c.r; c.horizon = 100;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.35), base: 98 });
  const L2 = lay(c);
  treeLine(L2, 122, "#3c7840", { seed: c.s.seed + "vt", h: [12, 22], step: [6, 12], fill: false });
  const walls = ["#e8dcc4", "#d8c8a8", "#c8b898", "#e0d0c0"], kinds: WallKind[] = ["timber", "timber", "plank", "log", "stone"];
  const back = r.int(2, 3);
  for (let i = 0; i < back; i++) {
    const w = r.int(36, 46), x = Math.round((i + 0.5) * (W / back) - w / 2 + r.int(-20, 20));
    cottage(c, L2, x, 122, w, r.int(12, 15), { wall: r.pick(walls), kind: r.pick(kinds), roof: r.chance(0.6) ? "#c8a050" : r.pick(["#a85a3a", "#6a7a8a"]), roofKind: r.chance(0.6) ? "thatch" : "shingle", chimney: r.chance(0.7), s: r.int(0, 999), shutters: r.chance(0.5) ? r.pick(["#4a7a5a", "#7a3a3a", "#3a5a8a"]) : undefined });
  }
  commit(c, L2, 0.22);
  const L3 = lay(c);
  ground(c, L3, 126, "grass", { flowers: 30, tufts: 40 });
  // trodden village green / square
  for (let y = 132; y < H; y++) for (let x = 0; x < W; x++) {
    const f = (y - 132) / (H - 132), d = Math.abs(x - 160) / (120 + f * 100);
    if (d + vnoise(x, y, 9, 4) * 0.35 < 0.8) L3.px(x, y, c.snow ? (bay(x, y) > 0.5 ? "#dce4f0" : "#c8d0e0") : vnoise(x, y * 2, 5, 5) > 0.55 ? "#b08a5a" : bay(x, y) > 0.7 ? "#8a6a44" : "#a07a4c");
  }
  const n = r.int(2, 3), slotsX: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = r.int(46, 60), x = Math.round(i * (W / n) + r.int(0, Math.max(1, W / n - w)));
    slotsX.push(x + w / 2);
    cottage(c, L3, x, 134, w, r.int(15, 19), { wall: r.pick(walls), kind: r.pick(kinds), roof: r.chance(0.65) ? "#d0a850" : r.pick(["#a85a3a", "#7a5a8a", "#5a7a9a"]), roofKind: r.chance(0.65) ? "thatch" : "shingle", chimney: r.chance(0.8), s: r.int(0, 999), box: r.chance(0.6), lantern: r.chance(0.5), shutters: r.chance(0.5) ? r.pick(["#4a7a5a", "#7a3a3a", "#3a5a8a"]) : undefined });
  }
  for (let i = 0; i < 3; i++) { const fx = r.int(-10, 260); fence(L3, fx, fx + r.int(20, 50), 140); }
  if (r.chance(0.7)) well(c, L3, r.int(40, 280), 144);
  for (let i = 0; i < 3; i++) { const bx = r.int(10, 300); if (r.chance(0.5)) barrelAt(L3, bx, 140); else crateAt(L3, bx, 140); }
  for (let i = 0; i < 4; i++) bush(L3, r.int(0, W), 135, r.int(4, 6), "#4a8a3c", r, r.chance(0.4) ? r.pick(["#f0a0c0", "#f8e060", "#ffffff"]) : undefined);
  commit(c, L3, 0);
  if (r.chance(0.6)) { const lx = r.int(20, 200); const L = lay(c); for (const px of [lx, lx + 50]) { L.rect(px, 116, 2, 22, "#6a4a2a"); L.px(px, 116, "#8a6a4a"); } commit(c, L, 0); anim(c, laundryFn(c, lx + 1, lx + 50, 118)); }
  if (r.chance(0.7)) { const L = lay(c); lampPost(c, L, r.chance(0.5) ? r.int(10, 40) : r.int(280, 310), 148); commit(c, L, 0); }
  anim(c, chickensFn(c, r.int(2, 4), 144, 150));
  swayTree(c, broadSprite(r, r.int(12, 15), "#4a9040", r.chance(0.3) ? "round" : "oak"), r.chance(0.5) ? r.int(4, 30) : r.int(290, 316), 136);
  if (!c.wet) anim(c, birdsFn(c, { y0: 20, y1: 50 }));
  if (c.dark >= 0.5 && !c.wet) anim(c, firefliesFn(8, 120, 150, c.s.seed));
  c.groundY = 154; c.slots = stdSlots(152, 3);
}

// ------------------------------------------------------------ town & city
function cobbles(L: Layer, y0: number, col: string, wet = false, sky = "#8ab0d0") {
  L.rect(0, y0, W, H - y0, hs(col, -0.5));
  let y = y0, row = 0;
  while (y < H) {
    const f = (y - y0) / (H - y0), rh = Math.round(2 + f * 4);
    let x = -Math.floor(hn(row, 1) * 10);
    while (x < W) {
      const sw = Math.round(3 + f * 7 + hn(row, x, 2) * 3);
      const cc = hs(col, (hn(row, x, 3) - 0.5) * 0.28);
      L.rect(x, y, sw - 1, rh - 1, cc);
      L.rect(x + 1, y, sw - 3, 1, hs(cc, 0.22)); L.px(x, y + 1, hs(cc, 0.12));
      if (rh > 3) L.rect(x + 1, y + rh - 2, sw - 3, 1, hs(cc, -0.18));
      if (wet && hn(row, x, 4) > 0.6) L.px(x + 1, y, mix(sky, "#ffffff", 0.3));
      x += sw;
    }
    y += rh; row++;
  }
  L.g.fillStyle = "rgba(20,10,30,0.25)"; L.g.fillRect(0, y0, W, 2);
}
function puddles(c: C, L: Layer, y0: number, n: number) {
  const r = seeded(c.s.seed + "pud");
  for (let i = 0; i < n; i++) { const x = r.int(10, W - 10), y = r.int(y0 + 6, H - 4), w = r.int(6, 16); L.ellipse(x, y, w, Math.max(1, Math.round(w / 6)), mix(c.sky[2], "#3a4a6a", 0.45)); L.span(x - w + 3, x - 2, y - 1, mix(c.sky[3], "#ffffff", 0.2)); }
}
function buntingFn(c: C, x0: number, y0: number, x1: number, y1: number): Fn {
  const cols = ["#e04a4a", "#f2c542", "#4a8ae0", "#f4f0e8", "#4ab060"].map((k) => gc(c, k)), rope = gc(c, "#3a3030");
  return (g, t) => {
    const n = Math.round(x1 - x0), sag = 8;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag + Math.sin(t * 0.0018 + u * 4) * 0.6 * (0.5 + c.wind));
      g.fillStyle = rope; g.fillRect(x, y, 1, 1);
      if (i % 6 === 2) { g.fillStyle = cols[(i / 6 | 0) % cols.length]; const sw = Math.round(Math.sin(t * 0.004 * (1 + c.wind) + i) * c.wind); g.fillRect(x - 1, y + 1, 4, 2); g.fillRect(x + sw, y + 3, 2, 2); g.fillRect(x + sw, y + 5, 1, 1); }
    }
  };
}
function pigeonsFn(c: C, n: number, y0: number, y1: number): Fn {
  const r = seeded(c.s.seed + "pig");
  const ps = Array.from({ length: n }, () => ({ x: r.int(20, 300), y: r.int(y0, y1), ph: r.next() * 9 }));
  const body = gc(c, "#8a8a9a"), dk = gc(c, "#5a5a6a"), neck = gc(c, "#6a8a7a");
  return (g, t) => ps.forEach((p) => {
    const s = t * 0.0003 + p.ph, dir = Math.cos(s * 0.7) > 0 ? 1 : -1, x = Math.round(p.x + Math.sin(s * 0.7) * 10), peck = Math.sin(t * 0.005 + p.ph) > 0.6 ? 1 : 0;
    g.fillStyle = body; g.fillRect(x - 2, p.y - 3, 4, 2); g.fillStyle = dk; g.fillRect(x - 2 - dir, p.y - 3, 1, 1);
    g.fillStyle = neck; g.fillRect(x + dir * 2 - (dir < 0 ? 1 : 0), p.y - 4 + peck, 1, 2);
  });
}
function townFar(c: C, col: string, spire = true) {
  const L = lay(c), r = c.r;
  for (let x = -6; x < W; x += r.int(10, 18)) {
    const w = r.int(10, 18), h = r.int(8, 18), b = c.horizon + 14;
    L.rect(x, b - h, w, h + 30, hs(col, (r.next() - 0.5) * 0.1));
    L.tex([[x - 1, b - h], [x + w / 2, b - h - w * 0.6], [x + w + 1, b - h]], () => hs(col, -0.12));
    if (r.chance(0.4)) addWin(c, x + 2 + r.int(0, w - 6), b - h + 3, 3, 3, true);
  }
  if (spire) {
    const sx = r.int(60, 260), b = c.horizon + 4;
    L.rect(sx, b - 26, 10, 40, hs(col, 0.06)); L.tex([[sx - 1, b - 26], [sx + 5, b - 50], [sx + 11, b - 26]], () => hs(col, -0.1));
    L.rect(sx + 3, b - 20, 3, 5, hs(col, -0.3)); L.px(sx + 5, b - 52, hs(col, -0.2));
  }
  commit(c, L, 0.45);
}
function bTown(c: C) {
  const r = c.r; c.horizon = 96;
  skyLayer(c);
  countryBackdrop(c, { base: 92 });
  townFar(c, "#8a8494");
  const L2 = lay(c);
  const base = 136;
  let x = -r.int(4, 18);
  const signs = ["mug", "sword", "bread", "potion", "key", "coin"];
  const tops: { x: number; y: number }[] = [];
  while (x < W) {
    const w = r.int(30, 44), floors = r.int(1, 2);
    const info = townHouse(c, L2, x, base, w, floors, {
      wall: r.pick(["#efe4cc", "#e8d8b8", "#d8c8b0", "#f0e0d0", "#e0d4c0"]), kind: r.chance(0.75) ? "timber" : "plank",
      ground: r.pick(["#a8a4a0", "#b0a090", "#9a9aa4"]), groundKind: r.chance(0.6) ? "stone" : "brick",
      roof: r.pick(["#a8503a", "#8a4a3a", "#5a6a80", "#7a5a4a", "#b86a3a"]), roofKind: r.chance(0.6) ? "shingle" : "slate",
      s: r.int(0, 999), shop: r.chance(0.6), sign: r.chance(0.5) ? r.pick(signs) : undefined, awning: r.chance(0.4) ? r.pick(["#c84a4a", "#4a7ac8", "#4a9a5a"]) : undefined, chimney: r.chance(0.4),
    });
    tops.push({ x: x + w / 2, y: info.top });
    x += w + r.int(0, 3);
  }
  commit(c, L2, 0);
  const L3 = lay(c);
  cobbles(L3, base, "#9a9488", c.wet, c.sky[3]);
  if (c.wet) puddles(c, L3, base, 5);
  if (r.chance(0.5)) { // market stall
    const sx = r.int(30, 230), sc0 = r.pick(["#c84a4a", "#4a7ac8", "#d8a030"]);
    for (const px of [sx, sx + 38]) L3.rect(px, 128, 2, 16, "#6a4a2a");
    for (let i = 0; i < 42; i++) { const st = Math.floor(i / 4) % 2 ? sc0 : "#f4ece0"; L3.rect(sx - 2 + i, 122, 1, 6, st); if (i % 4 === 1) L3.px(sx - 2 + i, 128, st); }
    L3.rect(sx, 136, 40, 3, "#8a5a34"); L3.rect(sx, 136, 40, 1, "#b08050");
    for (let i = 0; i < 12; i++) { const col = r.pick(["#e04a4a", "#f2c542", "#7ac050", "#e8902a", "#a060c0"]); L3.ellipse(sx + 3 + i * 3, 135, 1, 1, col); }
  }
  for (let i = 0; i < 3; i++) { const bx = r.int(4, 310); if (r.chance(0.5)) barrelAt(L3, bx, 140); else crateAt(L3, bx, 140); }
  commit(c, L3, 0);
  const L4 = lay(c);
  lampPost(c, L4, r.int(20, 70), 142); lampPost(c, L4, r.int(250, 300), 142);
  commit(c, L4, 0);
  if (tops.length > 2 && r.chance(0.6)) { const a = tops[r.int(0, tops.length - 2)]; anim(c, buntingFn(c, a.x, 108, a.x + r.int(80, 140), 110)); }
  anim(c, pigeonsFn(c, r.int(2, 5), 146, 158));
  if (!c.wet) anim(c, birdsFn(c, { y0: 16, y1: 40 }));
  c.groundY = 154; c.slots = stdSlots(152, 3);
}
function fountainFn(c: C, x: number, y: number): Fn {
  const wcol = gc(c, "#bfe0f8"), wcol2 = gc(c, "#8ac0e8");
  return (g, t) => {
    for (let i = 0; i < 26; i++) {
      const a = ((t * 0.0012 + i / 26) % 1), side = i % 2 ? 1 : -1;
      const px = x + side * a * 12, py = y - 16 + (-(1 - (2 * a - 1) ** 2)) * 6 + a * 14;
      g.fillStyle = i % 3 ? wcol : wcol2; g.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    g.fillStyle = wcol; for (let k = 0; k < 4; k++) g.fillRect(x, y - 22 + Math.round(((t * 0.02 + k * 2) % 6)), 1, 1);
    for (let k = 0; k < 6; k++) { const a = Math.sin(t * 0.004 + k * 1.3); if (a > 0.3) g.fillRect(x - 14 + k * 5, y - 2, 2, 1); }
  };
}
function bCity(c: C) {
  const r = c.r; c.horizon = 96;
  skyLayer(c);
  const L0 = lay(c);
  hills(L0, c, 100, 18, "#7a9478", { seed: "ch" });
  // castle on the hill behind the city
  const kx = r.int(80, 240);
  for (const [dx, w, h] of [[-26, 10, 30], [-8, 16, 46], [12, 10, 36], [26, 8, 24]] as const) {
    L0.rect(kx + dx, 96 - h, w, h + 10, "#9a98a8"); L0.rect(kx + dx + w - 2, 96 - h, 2, h + 10, "#7a7888");
    L0.tex([[kx + dx - 1, 96 - h], [kx + dx + w / 2, 96 - h - w], [kx + dx + w + 1, 96 - h]], () => "#5a5a7a");
    addWin(c, kx + dx + w / 2 - 1, 96 - h + 6, 3, 4, true);
  }
  commit(c, L0, 0.45);
  townFar(c, "#9a90a0", false);
  const variant = r.chance(0.5) ? "gate" : "plaza";
  const L2 = lay(c);
  const wall = "#b0aaa8";
  if (variant === "gate") {
    // houses peeking over the wall
    for (let x = -10; x < W; x += r.int(18, 30)) { const w = r.int(18, 26), h = r.int(22, 40); wallTex(L2.p, x, 132 - h, w, h, r.pick(["#d8ccb8", "#c8c0b0", "#e0d4c0"]), "timber", x + 99); L2.tex([[x - 2, 132 - h], [x + w / 2, 132 - h - w * 0.7], [x + w + 2, 132 - h]], (px, py) => roofCol("slate", "#6a6a88", px, py, 0.5, (px - x) / w, 4)); addWin(c, x + 4, 132 - h + 4, 5, 5, r.chance(0.6)); }
    castleWall(c, L2, 0, W, 108, 140, wall, 11, { slits: true });
    const gx = 160 + r.int(-30, 30);
    squareTower(c, L2, gx - 44, 140, 26, 54, wall, { s: 21, flag: r.pick(["#c83a3a", "#3a5ac8", "#e0b030"]), roof: r.chance(0.5) ? "#4a4a6a" : undefined });
    squareTower(c, L2, gx + 18, 140, 26, 54, wall, { s: 22, flag: r.pick(["#c83a3a", "#3a5ac8", "#e0b030"]), roof: r.chance(0.5) ? "#4a4a6a" : undefined });
    wallTex(L2.p, gx - 18, 100, 36, 40, wall, "stone", 30);
    castleWall(c, L2, gx - 18, gx + 18, 100, 104, wall, 31);
    gateArch(L2, gx, 140, 22, 30, wall, r.chance(0.6), "#c8b48a");
    const bc = r.pick(["#a82a2a", "#2a4aa8", "#2a7a3a"]);
    banner(L2, gx - 40, 112, 10, 22, bc, "#f2c542", r.int(0, 2)); banner(L2, gx + 30, 112, 10, 22, bc, "#f2c542", r.int(0, 2));
    torch(c, L2, gx - 15, 116); torch(c, L2, gx + 15, 116);
  } else {
    let x = -r.int(4, 14);
    while (x < W) {
      const w = r.int(34, 46);
      townHouse(c, L2, x, 138, w, r.int(2, 3), { wall: r.pick(["#d8d0c4", "#c8c4bc", "#e0d8cc"]), kind: r.chance(0.5) ? "stone" : "brick", ground: "#a8a4a0", groundKind: "stone", roof: r.pick(["#5a6a80", "#4a5a70", "#7a4a3a"]), roofKind: "slate", s: r.int(0, 999), shop: r.chance(0.5), sign: r.chance(0.4) ? r.pick(["mug", "sword", "potion", "key", "coin"]) : undefined, jetty: false, chimney: r.chance(0.4) });
      x += w + 1;
    }
  }
  commit(c, L2, 0);
  const L3 = lay(c);
  cobbles(L3, variant === "gate" ? 140 : 138, "#a49e94", c.wet, c.sky[3]);
  if (c.wet) puddles(c, L3, 140, 5);
  let fx = -1;
  if (variant === "plaza" && r.chance(0.7)) {
    fx = r.int(120, 200);
    L3.ellipse(fx, 146, 22, 5, "#7a7a84"); L3.ellipse(fx, 145, 20, 4, "#3a6a98"); L3.rect(fx - 22, 146, 45, 4, "#9a9aa4"); L3.rect(fx - 22, 146, 45, 1, "#c4c4cc");
    L3.rect(fx - 2, 128, 4, 18, "#a4a4ae"); L3.ellipse(fx, 128, 6, 2, "#9a9aa4"); L3.rect(fx - 1, 122, 2, 6, "#a4a4ae");
  }
  commit(c, L3, 0);
  if (fx > 0) anim(c, fountainFn(c, fx, 146));
  const L4 = lay(c);
  lampPost(c, L4, r.int(14, 60), 150); lampPost(c, L4, r.int(260, 306), 150);
  commit(c, L4, 0);
  anim(c, pigeonsFn(c, r.int(2, 5), 150, 162));
  if (!c.wet) anim(c, birdsFn(c, { y0: 16, y1: 40 }));
  c.groundY = 156; c.slots = fx > 0 ? stdSlots(158, 2, [36, 76, 116, 204, 244, 284]) : stdSlots(156, 3);
}

// ------------------------------------------------------------ castle
function bCastle(c: C) {
  const r = c.r; c.horizon = 108;
  skyLayer(c);
  const L0 = lay(c);
  mountains(L0, c, 112, r.int(40, 60), "#7a84a4", { snow: r.chance(0.6) ? 80 : undefined, seed: "cm" });
  commit(c, L0, 0.55);
  const L1 = lay(c);
  hills(L1, c, 126, 16, "#6a9a58", { freq: 0.014, trees: "#3c7a3c", seed: "crise" });
  commit(c, L1, 0.15);
  const L2 = lay(c);
  const stone = r.pick(["#b4aca4", "#a8a8b4", "#c0b098"]), roof = r.pick(["#3a4a7a", "#7a3a3a", "#3a5a4a", "#4a4a6a"]), flag = r.pick(["#d83a3a", "#3a5ad8", "#e8c030", "#f4f4f4"]);
  const cx = 160 + r.int(-30, 30), base = 132;
  // keep
  squareTower(c, L2, cx - 22, base - 20, 44, 62, stone, { s: 1, flag, roof: r.chance(0.5) ? roof : undefined });
  roundTower(c, L2, cx - 34, base - 14, 14, 76, stone, { roof, flag, s: 2 });
  roundTower(c, L2, cx + 36, base - 14, 12, 64, stone, { roof, flag, s: 3 });
  // curtain wall with towers
  castleWall(c, L2, cx - 120, cx + 120, base - 34, base, stone, 5, { slits: true });
  for (const dx of [-120, -64, 64, 120]) roundTower(c, L2, cx + dx, base, 18, 50, stone, { roof: r.chance(0.6) ? roof : undefined, flag: r.chance(0.5) ? flag : undefined, s: dx + 200 });
  // gatehouse
  wallTex(L2.p, cx - 16, base - 44, 32, 44, stone, "stone", 7);
  castleWall(c, L2, cx - 18, cx + 18, base - 44, base - 40, stone, 8);
  gateArch(L2, cx, base, 18, 24, stone, false);
  banner(L2, cx - 30, base - 30, 8, 18, flag, "#f2c542", 0); banner(L2, cx + 22, base - 30, 8, 18, flag, "#f2c542", 0);
  torch(c, L2, cx - 12, base - 26); torch(c, L2, cx + 12, base - 26);
  commit(c, L2, 0.04);
  water(c, 132, 140, { col: "#3a6a7a", amp: 0.8, glints: 12, murk: true });
  const L3 = lay(c);
  ground(c, L3, 140, "grass", { flowers: 18, tufts: 40 });
  // drawbridge & road
  L3.tex([[cx - 10, 130], [cx + 10, 130], [cx + 14, 141], [cx - 14, 141]], (px, py) => ((px - cx + 20) % 4 === 0 ? "#5a3a20" : py === 130 ? "#b08a5a" : "#8a6440"));
  for (let y = 141; y < H; y++) { const f = (y - 141) / (H - 141), hw = 14 + f * 50; for (let x = Math.round(cx - hw); x <= cx + hw; x++) if (hn(x, y, 3) > Math.abs(x - cx) / hw * 0.6) L3.px(x, y, vnoise(x, y, 4, 2) > 0.5 ? "#a8906a" : "#988060"); }
  L3.line(cx - 10, 130, cx - 16, 108, "#3a3030"); L3.line(cx + 10, 130, cx + 16, 108, "#3a3030");
  commit(c, L3, 0);
  if (!c.wet) anim(c, birdsFn(c, { y0: 20, y1: 50 }));
  c.groundY = 154; c.slots = stdSlots(152, 3);
}

// ------------------------------------------------------------ ruins
function arch(L: Layer, x: number, base: number, w: number, h: number, col: string, s: number, broken = 0) {
  const pw = 7;
  column(L, x, base - h, base, pw, col, { s, ivy: hn(s, 1) > 0.4 });
  column(L, x + w - pw, base - h + (broken ? Math.round(broken) : 0), base, pw, col, { s: s + 1, broken: broken > 0, ivy: hn(s, 2) > 0.5 });
  if (!broken) {
    const cx = x + w / 2, rr = (w - pw * 2) / 2 + 1, top = base - h;
    for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.12) {
      const ax = cx + Math.cos(a) * (rr + 2), ay = top + Math.sin(a) * (rr + 2) * 0.9;
      L.rect(Math.round(ax) - 2, Math.round(ay) - 2, 5, 4, hs(col, (hn(Math.round(a * 10), s) - 0.5) * 0.2));
      L.px(Math.round(ax) - 2, Math.round(ay) - 2, hs(col, 0.3));
    }
  }
}
function bRuins(c: C) {
  const r = c.r; c.horizon = 106;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.5), hillCol: "#7a9478" });
  const stone = r.pick(["#c8bca8", "#b4b0a8", "#c0b4a0"]);
  const L2 = lay(c);
  // ruined wall with empty arched windows
  const wx = r.int(-20, 120), ww = r.int(120, 190), wb = 132;
  for (let x = wx; x < wx + ww; x++) {
    const h = 26 + Math.round(Math.sin((x - wx) * 0.05) * 10 + vnoise(x, 0, 6, 3) * 22);
    for (let y = wb - h; y < wb; y++) {
      const row = Math.floor((y - wb) / 4), bx = Math.floor((x + (row % 2) * 4) / 8);
      const cc = hs(stone, (hn(row, bx, 9) - 0.5) * 0.24 - 0.04);
      L2.px(x, y, (y - wb) % 4 === 0 || (x + (row % 2) * 4) % 8 === 0 ? hs(stone, -0.38) : y === wb - h ? hs(cc, 0.25) : cc);
    }
  }
  for (let ax = wx + 12; ax < wx + ww - 20; ax += 30) {
    for (let y = 104; y < 124; y++) for (let x = ax; x < ax + 12; x++) { const dx = x - ax - 5.5, dy = y - 110; if (dy > 0 || dx * dx + dy * dy < 36) if (L2.solid(x, y)) L2.px(x, y, mix(c.sky[3], "#ffffff", 0.1)); }
    L2.g.clearRect(ax, 106, 12, 18);
    for (let y = 104; y < 124; y++) L2.px(ax - 1, y, hs(stone, 0.2));
  }
  for (let i = 0; i < 40; i++) ivy(L2, wx + r.int(0, ww), wb, r.int(4, 20), r.int(0, 99));
  commit(c, L2, 0.18);
  const L3 = lay(c);
  ground(c, L3, 132, "meadow", { flowers: 30, tufts: 60 });
  // broken colonnade
  const n = r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const x = Math.round(20 + (i + r.next() * 0.4) * (280 / n)), h = r.int(40, 78), broken = r.chance(0.6);
    column(L3, x, 140 - h, 140, 9, stone, { broken, ivy: r.chance(0.6), s: i * 7 + 1 });
    if (!broken && i < n - 1 && r.chance(0.5)) { L3.rect(x - 3, 140 - h - 5, 280 / n * 0.8, 5, stone); L3.rect(x - 3, 140 - h - 5, 280 / n * 0.8, 1, hs(stone, 0.25)); L3.rect(x - 3, 140 - h - 1, 280 / n * 0.8, 1, hs(stone, -0.4)); }
  }
  if (r.chance(0.5)) arch(L3, r.int(40, 200), 140, 46, 62, stone, 3, r.chance(0.5) ? 20 : 0);
  // fallen drums and blocks
  for (let i = 0; i < 6; i++) {
    const x = r.int(0, W), y = r.int(142, 172), w = r.int(8, 16), h = r.int(5, 8);
    if (r.chance(0.5)) { L3.rect(x, y - h, w, h, stone); L3.rect(x, y - h, w, 1, hs(stone, 0.3)); L3.rect(x + w - 2, y - h, 2, h, hs(stone, -0.3)); L3.ellipse(x, y - h / 2, 2, h / 2, hs(stone, 0.15)); }
    else rock(L3, x, y, w, h, stone, r, "#5a9a3a");
  }
  if (r.chance(0.5)) plant(L3, deadTreeSprite(r, r.int(40, 60)), r.chance(0.5) ? r.int(10, 60) : r.int(260, 310), 140);
  commit(c, L3, 0);
  anim(c, birdsFn(c, { y0: 30, y1: 70, col: "#1a1418", n: r.int(2, 4) }));
  c.front.push(motesFn(16, 0, W, 60, 160, c.s.seed, c.dark > 0.5 ? "#a8c0ff" : "#fff0c0", 0.5));
  if (c.s.time !== "day" || c.fog) c.front.push(fogFn(c, 120, 50, 0.5, 0.005));
  frontFoliage(c, "#4a8a3c", { corners: true });
  c.groundY = 154; c.slots = stdSlots(152, 3);
}

// ------------------------------------------------------------ swamp
function bubblesFn(c: C, y0: number, y1: number): Fn {
  const col = gc(c, "#a8b890");
  return (g, t) => {
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const per = 2200 + hn(i, 1) * 1800, k = Math.floor(t / per), a = (t % per) / per;
      const x = Math.round(20 + hn(i, k, 2) * 280), y = Math.round(y0 + hn(i, k, 3) * (y1 - y0));
      if (a < 0.7) { const s = a < 0.35 ? 1 : 2; g.globalAlpha = 0.9; g.fillRect(x, y - s, s, s); }
      else { g.globalAlpha = 1 - a; g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); g.fillRect(x, y - 2, 1, 1); }
    }
    g.globalAlpha = 1;
  };
}
function bSwamp(c: C) {
  const r = c.r; c.horizon = 100;
  c.sky = c.sky.map((k) => mix(k, "#4a6a50", 0.25));
  c.haze = mix(c.haze, "#8aa088", 0.4);
  skyLayer(c);
  const L1 = lay(c);
  treeLine(L1, 110, "#4a6450", { seed: c.s.seed + "sw1", h: [10, 22], step: [6, 14], pine: 0.2 });
  for (let x = 0; x < W; x += r.int(20, 40)) plant(L1, deadTreeSprite(r, r.int(26, 40), "#4a5048"), x, 112);
  commit(c, L1, 0.55);
  const L2 = lay(c);
  for (let x = -10; x < W + 10; x += r.int(28, 50)) plant(L2, r.chance(0.5) ? broadSprite(r, r.int(12, 16), "#4a6a38", "willow") : deadTreeSprite(r, r.int(44, 64), "#3e3a34"), x, 122);
  L2.rect(0, 120, W, 3, "#3a4a30");
  for (let x = 0; x < W; x++) if (hn(x, 8) > 0.4) L2.px(x, 119, "#4a5a34");
  commit(c, L2, 0.25);
  water(c, 122, 148, { col: "#3e5040", amp: 0.6, glints: 10, reflect: 0.45, murk: true });
  anim(c, bubblesFn(c, 126, 146));
  const L3 = lay(c);
  // lily pads & duckweed on the water, then muddy hummocks the party stands on
  for (let i = 0; i < 22; i++) { const x = r.int(0, W), y = r.int(126, 146); L3.ellipse(x, y, r.int(2, 4), 1, "#4a7a34"); L3.px(x - 1, y - 1, "#6a9a44"); if (r.chance(0.2)) { L3.px(x + 1, y - 1, "#e8e0f0"); L3.px(x + 1, y - 2, "#f8a0c8"); } }
  for (let i = 0; i < 160; i++) L3.px(r.int(0, W), r.int(124, 147), r.chance(0.5) ? "#5a7a34" : "#6a8a3a");
  const p = r.next() * 9, top = (x: number) => 146 + Math.sin(x * 0.04 + p) * 3 + Math.sin(x * 0.11) * 1.5;
  ground(c, L3, 143, "mud", { top, tufts: 40 });
  for (let i = 0; i < 6; i++) { const x = r.int(0, W), y = r.int(150, 176); L3.ellipse(x, y, r.int(6, 14), r.int(1, 2), mix("#3e5040", c.sky[3], 0.25)); }
  for (let i = 0; i < 5; i++) { const x = r.int(0, W), y = Math.round(top(x)) + 2; for (let k = 0; k < 3; k++) L3.line(x, y, x + r.int(-8, 8), y + r.int(3, 7), "#3a3028"); }
  commit(c, L3, 0);
  reeds(c, [0, W], 140, 150, 30);
  anim(c, firefliesFn(c.dark > 0.4 ? 20 : 8, 100, 150, c.s.seed, "#d8ffb0", "#80ff90"));
  c.front.push(fogFn(c, 104, 60, 0.7, 0.004, c.dark > 0.6 ? "#3a5a50" : "#b8c8b0"));
  c.front.push(fogFn(c, 136, 50, 0.5, -0.008, c.dark > 0.6 ? "#3a5a50" : "#c0d0b8"));
  frontFoliage(c, "#4a6a38", { kind: "reed" });
  c.groundY = 158; c.slots = stdSlots(156, 3);
}

// ------------------------------------------------------------ mountain
function eagleFn(c: C): Fn {
  const col = gc(c, "#2a2028"), r = seeded(c.s.seed + "eagle");
  const cx = r.int(80, 240), cy = r.int(30, 50);
  return (g, t) => {
    const a = t * 0.00035, x = Math.round(cx + Math.cos(a) * 50), y = Math.round(cy + Math.sin(a) * 12);
    const f = Math.floor(t / 300) % 6 === 0 ? 1 : 0;
    g.fillStyle = col; g.fillRect(x - 1, y, 3, 1); g.fillRect(x - 5, y - 1 + f, 4, 1); g.fillRect(x + 2, y - 1 + f, 4, 1); g.fillRect(x - 6, y - f, 1, 1); g.fillRect(x + 6, y - f, 1, 1);
  };
}
function bMountain(c: C) {
  const r = c.r; c.horizon = 112;
  skyLayer(c);
  const L0 = lay(c);
  mountains(L0, c, 112, r.int(50, 70), "#8a94b8", { snow: 82, seed: "m0", peaks: r.int(3, 5) });
  commit(c, L0, 0.5);
  // sea of cloud between the ranges
  if (r.chance(0.6)) anim(c, cloudDriftFn(c, 100, 0.85, 7));
  const L1 = lay(c);
  mountains(L1, c, 130, r.int(36, 52), "#6a7090", { snow: 96, seed: "m1" });
  for (let i = 0; i < 10; i++) plant(L1, pineSprite(r, r.int(10, 16), "#2a5a48"), r.int(0, W), r.int(124, 132));
  commit(c, L1, 0.22);
  const L3 = lay(c);
  const p = r.next() * 9, top = (x: number) => 136 + Math.sin(x * 0.02 + p) * 5 + vnoise(x, 0, 7, 3) * 4;
  ground(c, L3, 132, "rock", { top, tufts: 24, flowers: 0 });
  for (let i = 0; i < 26; i++) { const x = r.int(0, W), y = r.int(140, 178); L3.rect(x, y, r.int(4, 12), 1, "#4a4a58"); }
  if (!c.snow) for (let i = 0; i < 5; i++) { const x = r.int(0, W), y = r.int(142, 175), w = r.int(6, 14); for (let k = 0; k < 3; k++) L3.ellipse(x + r.int(-w / 2, w / 2), y + r.int(-1, 1), r.int(3, w), r.int(1, 2), k ? "#e8eef8" : "#c4cee4"); L3.span(x - w / 2, x, y - 1, "#ffffff"); }
  for (let i = 0; i < 5; i++) rock(L3, r.int(0, W), r.int(140, 176), r.int(12, 28), r.int(7, 14), "#7a7a88", r, r.chance(0.4) ? "#5a8a4a" : undefined);
  if (r.chance(0.6)) { const kx = r.int(30, 290), ky = Math.round(top(kx)) + 6; for (let k = 0; k < 5; k++) { const w = 9 - k * 2; L3.rect(kx - w / 2, ky - (k + 1) * 3, w, 3, k % 2 ? "#9a9aa4" : "#888894"); L3.px(kx - w / 2, ky - (k + 1) * 3, "#c8c8d0"); } }
  for (const side of [0, 1]) if (r.chance(0.6)) { const T = pineSprite(r, r.int(40, 60), "#2a5a48"); plant(L3, T, side ? r.int(285, 315) : r.int(5, 35), Math.round(top(side ? 300 : 20)) + 4); }
  commit(c, L3, 0);
  anim(c, eagleFn(c));
  if (!c.snow && (c.s.weather === "wind" || r.chance(0.5))) c.front.push(snowDriftFn(c));
  frontFoliage(c, "#5a6a58", { kind: "rock" });
  c.groundY = 156; c.slots = stdSlots(154, 3);
}
function snowDriftFn(c: C): Fn {
  const r = seeded(c.s.seed + "drift");
  const ps = Array.from({ length: 30 }, () => ({ x: r.next() * W, y: rng(r, 120, 178), ph: r.next() * 9, sp: rng(r, 0.03, 0.07) }));
  return (g, t) => { g.fillStyle = "#f0f4ff"; for (const p of ps) { const x = ((p.x + t * p.sp * (1 + c.wind)) % (W + 20)) - 10, y = p.y + Math.sin(t * 0.003 + p.ph) * 2; g.globalAlpha = 0.5; g.fillRect(Math.round(x), Math.round(y), 1, 1); } g.globalAlpha = 1; };
}

// ------------------------------------------------------------ bridge
function bBridge(c: C) {
  const r = c.r; c.horizon = 98;
  skyLayer(c);
  countryBackdrop(c, { mtn: r.chance(0.6), snow: r.chance(0.4), base: 96 });
  const L2 = lay(c);
  // valley banks converging toward the river
  for (let y = 112; y < 130; y++) { const f = (y - 112) / 18; L2.rect(0, y, 120 - f * 90, 1, hs("#4a8a3c", -f * 0.2)); L2.rect(200 + f * 90, y, W, 1, hs("#4a8a3c", -f * 0.2)); }
  treeLine(L2, 114, "#3a7040", { seed: c.s.seed + "bt", h: [10, 20], step: [5, 10], pine: 0.5, fill: false });
  commit(c, L2, 0.25);
  water(c, 114, H, { col: "#3a74a4", amp: 1.4, glints: 40 });
  const stone = r.chance(0.6);
  const L3 = lay(c);
  if (stone) {
    const sc = r.pick(["#b0a898", "#a4a0a4", "#c0b4a0"]);
    // far parapet
    wallTex(L3.p, 0, 128, W, 10, sc, "stone", 4);
    L3.rect(0, 127, W, 2, hs(sc, 0.25)); L3.rect(0, 137, W, 1, hs(sc, -0.4));
    // deck
    cobbles(L3, 138, hs(sc, -0.08), c.wet, c.sky[3]);
    L3.g.clearRect(0, 156, W, H - 156);
    // front face with arches showing the river below
    wallTex(L3.p, 0, 156, W, 24, sc, "stone", 5);
    L3.rect(0, 156, W, 2, hs(sc, 0.3)); L3.rect(0, 158, W, 1, hs(sc, -0.3));
    for (let ax = 30; ax < W; ax += 100) {
      for (let y = 164; y < H; y++) for (let x = ax - 30; x < ax + 30; x++) { const dx = (x - ax) / 30, dy = (y - 186) / 22; if (dx * dx + dy * dy < 1) L3.g.clearRect(x, y, 1, 1); }
      for (let a = Math.PI; a < Math.PI * 2; a += 0.1) L3.rect(Math.round(ax + Math.cos(a) * 31) - 1, Math.round(186 + Math.sin(a) * 23) - 1, 3, 3, hs(sc, 0.12));
    }
    for (let x = 0; x < W; x += 2) if (hn(x, 77) > 0.6) L3.px(x, 157 + Math.floor(hn(x, 78) * 18), "#4a7a3a");
  } else {
    const wd = "#9a6a40";
    for (let x = 0; x < W; x += 18) { L3.rect(x, 116, 3, 24, hs(wd, -0.2)); L3.px(x, 116, hs(wd, 0.3)); }
    for (const ry of [120, 128]) { for (let x = 0; x < W; x++) L3.px(x, ry + Math.round(Math.sin((x % 18) / 18 * Math.PI) * 2), "#c8b080"); }
    for (let y = 138; y < 158; y += 3) for (let x = 0; x < W; x += 1) { const cc = hs(wd, (hn(Math.floor(x / 26), y, 3) - 0.5) * 0.3 + (y - 138) * 0.004); L3.px(x, y, (x + y * 7) % 26 === 0 ? hs(wd, -0.4) : cc); L3.px(x, y + 1, cc); L3.px(x, y + 2, hs(cc, -0.3)); }
    L3.rect(0, 158, W, 3, hs(wd, -0.35));
    for (let x = 6; x < W; x += 40) { L3.rect(x, 158, 5, 22, "#5a3e28"); L3.rect(x, 158, 1, 22, "#7a5a3a"); }
    L3.line(0, 162, W, 162, "#4a3020");
  }
  commit(c, L3, 0);
  anim(c, fishFn(c, 120, 135));
  if (!c.wet) anim(c, birdsFn(c, { y0: 20, y1: 60 }));
  c.groundY = 150; c.slots = stdSlots(150, 1);
}

// ------------------------------------------------------------ camp
function tent(L: Layer, x: number, base: number, w: number, h: number, col: string) {
  const cx = x + w / 2;
  L.tex([[x, base], [cx, base - h], [x + w, base]], (px, py) => {
    const u = (px - x) / w;
    const fold = Math.floor(u * 6) % 2;
    let cc = u < 0.5 ? (fold ? col : hs(col, 0.08)) : fold ? hs(col, -0.2) : hs(col, -0.26);
    if (py > base - 2) cc = hs(cc, -0.15);
    return cc;
  });
  L.tex([[cx - w * 0.16, base], [cx, base - h * 0.55], [cx + w * 0.16, base]], () => "#2a1c18");
  L.line(cx, base - h * 0.55, cx - w * 0.2, base, hs(col, 0.25));
  L.rect(Math.round(cx), base - h - 4, 1, 5, "#6a4428");
  L.line(x, base, x - 6, base, "#c8b890"); L.line(x + w, base, x + w + 6, base, "#c8b890");
  L.line(cx, base - h, x - 6, base, "#a89870"); L.line(cx, base - h, x + w + 6, base, "#a89870");
}
function bCamp(c: C) {
  const r = c.r; c.horizon = 100;
  skyLayer(c);
  countryBackdrop(c, { base: 98 });
  const L2 = lay(c);
  treeLine(L2, 118, "#2e5a40", { pine: 0.8, h: [22, 36], step: [6, 11], seed: c.s.seed + "cp" });
  for (let x = -10; x < W + 10; x += r.int(18, 32)) plant(L2, pineSprite(r, r.int(40, 62), "#2f6a48"), x, 124 + r.int(0, 3));
  commit(c, L2, 0.2);
  const L3 = lay(c);
  ground(c, L3, 126, "grass", { flowers: 10, tufts: 36 });
  const fx = 160 + r.int(-8, 8), fy = 146;
  for (let y = 130; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - fx) / 1.0, (y - fy) * 2.4); if (d + vnoise(x, y, 7, 3) * 30 < 90) L3.px(x, y, c.snow ? "#d8e0ec" : vnoise(x, y * 2, 4, 1) > 0.6 ? "#9a7a50" : "#8a6a44"); }
  tent(L3, r.int(20, 60), 138, r.int(34, 42), r.int(22, 28), r.pick(["#c8b490", "#8a9a6a", "#a8786a"]));
  tent(L3, r.int(220, 250), 136, r.int(30, 38), r.int(20, 26), r.pick(["#c8b490", "#7a8aa0", "#b0906a"]));
  // stone ring, logs and gear
  for (let a = 0; a < Math.PI * 2; a += 0.5) { const sx = fx + Math.cos(a) * 9, sy = fy + Math.sin(a) * 3; L3.rect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 2, "#8a8a90"); L3.px(Math.round(sx) - 1, Math.round(sy) - 1, "#b0b0b8"); }
  L3.ellipse(fx, fy, 6, 2, "#2a1a14"); L3.line(fx - 5, fy, fx + 4, fy - 2, "#5a3a22"); L3.line(fx - 4, fy - 2, fx + 5, fy, "#4a3020");
  L3.line(fx - 10, fy - 2, fx, fy - 20, "#4a3a2a"); L3.line(fx + 10, fy - 2, fx, fy - 20, "#4a3a2a"); L3.line(fx, fy - 20, fx, fy - 12, "#5a5a60");
  L3.ellipse(fx, fy - 10, 4, 3, "#3a3a44"); L3.rect(fx - 4, fy - 13, 9, 1, "#5a5a68");
  logAt(L3, fx - 46, 146, 22); logAt(L3, fx + 26, 148, 20);
  for (let i = 0; i < 5; i++) L3.line(r.int(90, 110) + i, 138, r.int(96, 106) + i * 2, 130, "#7a5434");
  L3.rect(r.int(270, 300), 140, 12, 4, r.pick(["#7a3a3a", "#3a5a7a"])); 
  commit(c, L3, 0);
  // firelight on the ground, flames, smoke, sparks
  c.warm += 0.12;
  anim(c, (g, t) => {
    const f = flick(t, 1);
    addGlow(g, fx, fy - 6, 90, "#ff8a30", 0.28 * f * (0.5 + c.dark * 0.7));
    addGlow(g, fx, fy - 4, 30, "#ffc060", 0.45 * f);
    flame(g, fx - 2, fy, 5, t, 1); flame(g, fx + 2, fy, 4.5, t, 2.7); flame(g, fx, fy + 1, 6.5, t, 5.1);
    embers(g, fx, fy - 8, 14, 50, t, 1, c.wind);
    smoke(g, fx, fy - 18, t, { col: c.dark > 0.6 ? "#6a6a7a" : "#c8c8d0", wind: 0.4 + c.wind * 1.4, rise: 50, a: 0.35, n: 9, per: 5200, size: 1.3 });
  });
  const L4 = lay(c);
  const lx = r.int(16, 30);
  L4.rect(lx, 112, 2, 36, "#6a4a2a"); L4.rect(lx, 112, 6, 1, "#6a4a2a"); L4.px(lx + 5, 113, IRON);
  lanternAt(c, L4, lx + 5, 114);
  commit(c, L4, 0);
  if (c.dark >= 0.5 && !c.wet) anim(c, firefliesFn(14, 100, 140, c.s.seed));
  else if (!c.wet) anim(c, birdsFn(c, { y0: 20, y1: 50 }));
  frontFoliage(c, "#2f6a48");
  c.groundY = 154; c.slots = stdSlots(152, 3, [34, 76, 118, 204, 246, 288]);
}

// ------------------------------------------------------------ sea, ship, coast
/** Open sea from the horizon to y1: rows of waves in perspective, animated. */
function seaFn(c: C, y0: number, y1: number, col: string, bob = 0): void {
  // static base with reflection of the sky
  water(c, y0, y1, { col, amp: 1.6, glints: 46, reflect: 0.35 });
  const crest = gc(c, mix(col, "#ffffff", 0.55)), crest2 = gc(c, mix(col, "#ffffff", 0.3)), trough = gc(c, hs(col, -0.3));
  const rows: { y: number; f: number }[] = [];
  for (let y = y0 + 2; y < y1; y += Math.max(2, Math.round(2 + ((y - y0) / (y1 - y0)) * 7))) rows.push({ y, f: (y - y0) / (y1 - y0) });
  const swell = c.storm ? 2.5 : c.wet || c.s.weather === "wind" ? 1.6 : 1;
  anim(c, (g, t) => {
    const by = Math.round(Math.sin(t * 0.0011) * bob);
    for (const rw of rows) {
      const len = Math.round(3 + rw.f * 14), gap = Math.round(10 + rw.f * 26), sp = 0.004 + rw.f * 0.01;
      const off = (t * sp + rw.y * 17) % (len + gap);
      const amp = Math.round((0.5 + rw.f * 2) * swell);
      for (let x = -len - gap + off; x < W; x += len + gap) {
        const k = Math.sin(t * 0.002 + x * 0.05 + rw.y);
        const yy = rw.y + by + Math.round(k * amp * 0.5);
        g.fillStyle = trough; g.fillRect(Math.round(x), yy + 1, len, 1);
        g.fillStyle = k > 0 ? crest : crest2; g.fillRect(Math.round(x + 1), yy, len - 2, 1);
        if (rw.f > 0.5 && k > 0.6) { g.fillStyle = crest; g.fillRect(Math.round(x + len / 2), yy - 1, 2, 1); }
      }
    }
  });
}
function distantShipFn(c: C, x: number, y: number): Fn {
  const L = new Layer(26, 24);
  L.tex([[1, 18], [25, 18], [21, 23], [5, 23]], () => "#5a3e2c");
  L.rect(9, 3, 1, 15, "#4a3020"); L.rect(17, 6, 1, 12, "#4a3020");
  L.tex([[10, 4], [16, 5], [16, 15], [10, 16]], (px) => (px > 14 ? "#d8d0c0" : "#f0e8d8"));
  L.tex([[4, 6], [8, 5], [8, 16], [4, 15]], () => "#e8e0d0"); L.tex([[18, 7], [23, 8], [23, 16], [18, 16]], () => "#e8e0d0");
  L.rect(9, 1, 5, 2, "#c83a3a");
  const img = prep(c, L, 0.35);
  return (g, t) => { const dx = Math.round(Math.sin(t * 0.00006) * 30), dy = Math.round(Math.sin(t * 0.0013) * 0.7); g.drawImage(img, x + dx, y - 23 + dy); };
}
function deckPlanks(L: Layer, y0: number, col: string) {
  for (let y = y0; y < H; y++) {
    const f = (y - y0) / (H - y0);
    for (let x = 0; x < W; x++) {
      // planks converge toward a vanishing point above the horizon
      const u = (x - 160) / (0.6 + f * 1.4), k = Math.floor(u / 9), within = ((u % 9) + 9) % 9;
      let cc = hs(col, (hn(k, 3) - 0.5) * 0.2);
      if (within < 0.7) cc = hs(col, -0.42);
      else if (within < 1.6) cc = hs(cc, 0.15);
      const seam = Math.floor((y - y0) / (3 + f * 10) + hn(k, 5) * 3);
      if (hn(k, seam, 9) > 0.92 && (y - y0) % Math.round(3 + f * 10) === 0) cc = hs(col, -0.4);
      if (hn(x >> 1, y, 4) > 0.97) cc = hs(cc, -0.2);
      L.px(x, y, cc);
    }
  }
}
function bShip(c: C) {
  const r = c.r; c.horizon = 104;
  skyLayer(c);
  const Lf = lay(c);
  if (r.chance(0.5)) { const ix = r.int(20, 240); Lf.p.blob(ix + 30, 106, 34, 8, "#6a8a7a", { outline: false }); Lf.rect(ix, 104, 64, 3, "#5a7a6a"); }
  commit(c, Lf, 0.5);
  seaFn(c, 104, 140, c.storm ? "#2a4a5a" : "#2a6a9a", 1.5);
  if (r.chance(0.6)) anim(c, distantShipFn(c, r.int(30, 260), 110));
  const L = lay(c);
  const wood = r.pick(["#9a6a40", "#8a5a38", "#a87a4a"]);
  // bulwark (the ship's side rail behind the party)
  for (let y = 124; y < 142; y++) for (let x = 0; x < W; x++) { const pl = Math.floor((y - 124) / 3); const cc = hs(wood, (hn(pl, Math.floor(x / 40), 3) - 0.5) * 0.2 - 0.12); L.px(x, y, (y - 124) % 3 === 2 ? hs(cc, -0.3) : cc); }
  L.rect(0, 121, W, 3, hs(wood, 0.15)); L.rect(0, 121, W, 1, hs(wood, 0.4)); L.rect(0, 124, W, 1, hs(wood, -0.45));
  for (let x = 8; x < W; x += 26) { L.rect(x, 118, 3, 24, hs(wood, -0.25)); L.rect(x, 118, 3, 1, hs(wood, 0.3)); }
  deckPlanks(L, 142, wood);
  L.g.fillStyle = "rgba(20,10,20,0.3)"; L.g.fillRect(0, 142, W, 3);
  // mast, yard, sail, rigging
  const mx = r.int(150, 210);
  L.rect(mx - 3, 0, 6, 146, "#6a4428"); L.rect(mx - 3, 0, 2, 146, "#8a5a34"); L.rect(mx + 2, 0, 1, 146, "#4a2c18");
  for (let y = 20; y < 146; y += 30) { L.rect(mx - 4, y, 8, 2, "#3a3030"); }
  L.rect(mx - 70, 10, 140, 3, "#5a3a22"); L.rect(mx - 70, 10, 140, 1, "#7a5434");
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) L.line(mx + side * 2, 16 + k * 3, mx + side * (60 + k * 16), 121, "#3a2a20");
    for (let y = 40; y < 118; y += 8) { const f = (y - 16) / 105; L.line(mx + side * (2 + f * 60), y, mx + side * (2 + f * 92), y, "#4a3a2a"); }
  }
  barrelAt(L, r.int(20, 60), 146); barrelAt(L, r.int(20, 60) + 10, 146); crateAt(L, r.int(250, 290), 146, 11);
  for (let k = 0; k < 3; k++) L.ellipse(r.int(90, 120), 148, 5 - k, 2 - (k > 1 ? 1 : 0), k % 2 ? "#c8b080" : "#a89060");
  commit(c, L, 0);
  // the sail billows: four pre-rendered shapes cycled
  const sails: HTMLCanvasElement[] = [];
  const sc0 = r.pick(["#f0e8d8", "#e8dcc0", "#d8c8a8"]), stripe = r.chance(0.5) ? r.pick(["#c83a3a", "#3a5ac8"]) : null;
  for (let k = 0; k < 4; k++) {
    const S = new Layer();
    const bul = 4 + k * 2;
    S.tex([[mx - 62, 13], [mx + 62, 13], [mx + 58 + bul, 70], [mx - 58 - bul, 70]], (px, py) => {
      const v = (py - 13) / 57, u = (px - mx) / 62;
      const sh = Math.sin(v * Math.PI) * bul;
      let cc = u + v * 0.3 < -0.2 ? hs(sc0, 0.1) : u > 0.4 ? hs(sc0, -0.15) : sc0;
      if (Math.abs(((px - mx) % 31 + 31) % 31) < 1) cc = hs(sc0, -0.22);
      if (stripe && Math.abs(u) < 0.25) cc = u < 0 ? stripe : hs(stripe, -0.15);
      if (py > 66 - sh * 0.3) cc = hs(cc, -0.2);
      return cc;
    });
    for (let x = mx - 58 - bul; x < mx + 58 + bul; x++) { const u = (x - mx) / 62; const y = Math.round(70 + Math.cos(u * Math.PI / 2) * bul * 0.8); for (let yy = 70; yy < y; yy++) S.px(x, yy, hs(sc0, -0.2)); S.px(x, y, hs(sc0, -0.4)); }
    sails.push(prep(c, S, 0));
  }
  anim(c, (g, t) => { const ph = (Math.sin(t * 0.0012 * (1 + c.wind)) + 1) / 2; g.drawImage(sails[Math.min(3, Math.floor(ph * 4))], 0, 0); });
  const L2 = lay(c);
  lanternAt(c, L2, mx + 6, 90); L2.rect(mx + 3, 89, 4, 1, IRON);
  commit(c, L2, 0);
  anim(c, birdsFn(c, { y0: 20, y1: 60, gull: true, n: 3 }));
  c.groundY = 156; c.slots = stdSlots(154, 3, [40, 84, 128, 228, 260, 292]);
}
function bSea(c: C) {
  const r = c.r; c.horizon = 110;
  skyLayer(c);
  const Lf = lay(c);
  for (let i = 0; i < r.int(1, 3); i++) { const ix = r.int(0, 280), w = r.int(20, 60); Lf.p.blob(ix + w / 2, 111, w / 2, r.int(4, 10), "#6a8098", { outline: false }); }
  Lf.g.clearRect(0, 112, W, H);
  commit(c, Lf, 0.55);
  seaFn(c, 110, 160, c.storm ? "#24485a" : "#2a669a", 1);
  if (r.chance(0.7)) anim(c, distantShipFn(c, r.int(20, 270), 116));
  if (r.chance(0.5)) anim(c, (g, t) => { // a whale's back now and then
    const per = 16000, a = (t % per) / per, k = Math.floor(t / per);
    if (a > 0.25) return;
    const x = 40 + hn(k, 1) * 220, y = 128 + hn(k, 2) * 14, rise = Math.sin((a / 0.25) * Math.PI) * 4;
    g.fillStyle = gc(c, "#2a3a4a"); g.fillRect(Math.round(x), Math.round(y - rise), 18, Math.ceil(rise)); g.fillRect(Math.round(x + 4), Math.round(y - rise - 1), 10, 1);
    if (a > 0.08 && a < 0.16) { g.fillStyle = gc(c, "#e8f0f8"); for (let i = 0; i < 6; i++) g.fillRect(Math.round(x + 6 + (i - 3) * (a - 0.08) * 40), Math.round(y - rise - 3 - Math.sin(i) * 4 * (a - 0.08) * 12), 1, 1); }
  });
  // the bow of the party's ship
  const L = lay(c), wood = "#8a5a38";
  deckPlanks(L, 150, wood);
  L.tex([[0, 150], [W, 150], [W, 158], [0, 158]], (px, py) => (py === 150 ? hs(wood, 0.35) : hs(wood, -0.2 + (py - 150) * 0.02)));
  for (let x = 4; x < W; x += 22) { L.rect(x, 136, 3, 16, hs(wood, -0.2)); L.px(x, 136, hs(wood, 0.3)); }
  L.rect(0, 136, W, 2, hs(wood, 0.25)); L.rect(0, 138, W, 1, hs(wood, -0.4));
  L.g.clearRect(0, 158, W, 0);
  commit(c, L, 0);
  // spray when the bow dips
  const spray = gc(c, "#e8f4ff");
  anim(c, (g, t) => { const a = (t % 3800) / 3800; if (a > 0.3) return; g.fillStyle = spray; for (let i = 0; i < 16; i++) { const k = a / 0.3; g.globalAlpha = 1 - k; g.fillRect(Math.round(hn(i, 1) * W), Math.round(140 - Math.sin(k * Math.PI) * (6 + hn(i, 2) * 10)), 1, 1); } g.globalAlpha = 1; });
  anim(c, birdsFn(c, { y0: 30, y1: 70, gull: true, n: 4 }));
  c.groundY = 160; c.slots = stdSlots(160, 2);
}
function lighthouse(c: C, L: Layer, x: number, base: number) {
  for (let y = base - 50; y < base; y++) {
    const f = (base - y) / 50, w = Math.round(12 - f * 4);
    for (let i = 0; i < w; i++) { const u = i / w; const band = Math.floor((base - y) / 8) % 2; const cc = band ? "#c83a3a" : "#f4f0e8"; L.px(x - w / 2 + i, y, u < 0.3 ? hs(cc, 0.1) : u > 0.7 ? hs(cc, -0.25) : cc); }
  }
  L.rect(x - 6, base - 52, 12, 2, "#3a3a44"); L.rect(x - 4, base - 60, 8, 8, "#ffe8a0"); L.rect(x - 4, base - 60, 1, 8, "#3a3a44"); L.rect(x + 3, base - 60, 1, 8, "#3a3a44");
  L.tex([[x - 6, base - 60], [x, base - 67], [x + 1, base - 67], [x + 7, base - 60]], () => "#3a3a50");
  const lx = x, ly = base - 56;
  anim(c, (g, t) => {
    if (c.dark < 0.3) return;
    const a = (t * 0.0012) % (Math.PI * 2), sweep = Math.cos(a);
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.22 * c.dark * Math.max(0, Math.sin(a) * 0.5 + 0.5);
    g.fillStyle = "#fff0b0";
    g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + sweep * 320, ly - 14); g.lineTo(lx + sweep * 320, ly + 14); g.closePath(); g.fill();
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    addGlow(g, lx, ly, 16, "#ffe8a0", 0.6 * c.dark);
  });
}
function bCoast(c: C) {
  const r = c.r; c.horizon = 100;
  skyLayer(c);
  const left = r.chance(0.5);
  seaFn(c, 100, 140, "#2a72a4");
  const L = lay(c);
  // cliff headland on one side
  const cx0 = left ? 0 : W - 110;
  for (let x = cx0; x < cx0 + 110; x++) {
    const u = left ? x / 110 : 1 - (x - cx0) / 110;
    const top = Math.round(96 + Math.pow(u, 2.2) * 44 + vnoise(x, 0, 6, 1) * 4);
    for (let y = top; y < 142; y++) {
      const d = y - top;
      let cc = d < 3 ? (c.snow ? "#eef2f8" : "#5aa046") : vnoise(x, y * 0.5, 5, 2) > 0.6 ? "#8a8070" : (x + y) % 9 === 0 ? "#6a6058" : "#a09482";
      if (d >= 3 && (left ? (x > 100) : (x < cx0 + 10))) cc = hs(cc, -0.15);
      L.px(x, y, cc);
    }
  }
  const hasLight = r.chance(0.6);
  if (hasLight) lighthouse(c, L, left ? r.int(22, 46) : r.int(W - 46, W - 22), 98);
  // rocks in the surf
  const rocks: [number, number][] = [];
  for (let i = 0; i < 3; i++) { const x = left ? r.int(120, 300) : r.int(20, 200), y = r.int(122, 134); rock(L, x, y, r.int(8, 16), r.int(4, 8), "#6a6a74", r); rocks.push([x, y]); }
  commit(c, L, 0);
  const L3 = lay(c);
  ground(c, L3, 140, "sand", { tufts: 0 });
  for (let i = 0; i < 14; i++) { const x = r.int(0, W), y = r.int(148, 178); L3.px(x, y, r.pick(["#f8e8e0", "#e8c8b0", "#f0f0f0"])); L3.px(x + 1, y, "#c8a890"); }
  for (let i = 0; i < 3; i++) { const x = r.int(0, W), y = r.int(150, 176); L3.line(x, y, x + r.int(10, 20), y - r.int(0, 3), "#a08a6a"); L3.line(x, y + 1, x + r.int(10, 20), y, "#6a5a48"); }
  for (let i = 0; i < 4; i++) { const x = r.int(0, W), y = r.int(140, 148); for (let k = 0; k < 5; k++) L3.line(x, y, x + r.int(-5, 5), y - r.int(4, 8), "#8aa050"); }
  commit(c, L3, 0);
  // the surf washing up the beach and back
  const foam = gc(c, "#f4faff"), wet = gc(c, "#a88a5a"), shallow = gc(c, "#4aa0c8");
  anim(c, (g, t) => {
    const a = Math.sin(t * 0.0009), reach = 141 + Math.round((a + 1) * 4);
    for (let x = 0; x < W; x++) {
      const e = reach + Math.round(Math.sin(x * 0.07 + t * 0.001) * 1.5 + Math.sin(x * 0.19) * 1);
      g.fillStyle = wet; g.fillRect(x, 140, 1, Math.max(0, e - 140 + 3));
      g.fillStyle = shallow; g.globalAlpha = 0.55; g.fillRect(x, 140, 1, Math.max(0, e - 140)); g.globalAlpha = 1;
      if ((x + Math.floor(t / 120)) % 5 !== 0) { g.fillStyle = foam; g.fillRect(x, e, 1, 1); }
      if (hn(x, Math.floor(t / 400)) > 0.8) g.fillRect(x, e - 2, 1, 1);
    }
    g.fillStyle = foam;
    for (const [x, y] of rocks) for (let k = 0; k < 6; k++) { const ph = (t * 0.002 + k) % 6.28; g.globalAlpha = Math.max(0, Math.sin(ph)); g.fillRect(Math.round(x - 10 + k * 4), y + 1 - Math.round(Math.sin(ph) * 3), 2, 1); }
    g.globalAlpha = 1;
  });
  const crab = gc(c, "#e0603a");
  anim(c, (g, t) => { const x = Math.round(((t * 0.008) % (W + 40)) - 20), y = 166 + Math.round(Math.sin(t * 0.001) * 2), f = Math.floor(t / 150) % 2; g.fillStyle = crab; g.fillRect(x, y - 2, 4, 2); g.fillRect(x - 1, y - 3 - f, 1, 1); g.fillRect(x + 4, y - 3 - f, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 4, y, 1, 1); });
  anim(c, birdsFn(c, { y0: 30, y1: 70, gull: true, n: 3 }));
  frontFoliage(c, "#8aa050", { kind: "reed", corners: r.chance(0.5) });
  c.groundY = 158; c.slots = stdSlots(156, 3);
}

// ------------------------------------------------------------ desert
function dunes(L: Layer, base: number, amp: number, col: string, seed: number) {
  const lit = hs(col, 0.14), sh = hs(col, -0.18), sh2 = hs(col, -0.3);
  for (let x = 0; x < W; x++) {
    const v = Math.sin(x * 0.012 + seed) * 0.6 + Math.sin(x * 0.031 + seed * 2) * 0.4;
    const top = Math.round(base - amp * (0.5 + v * 0.5));
    const slope = Math.cos(x * 0.012 + seed) * 0.6 * 0.012 + Math.cos(x * 0.031 + seed * 2) * 0.4 * 0.031;
    for (let y = top; y < H; y++) {
      const d = y - top;
      let cc = slope > 0 ? (d < 6 ? sh : col) : d < 2 ? lit : col;
      if (slope > 0.008 && d < 12) cc = sh2;
      if ((y + Math.round(Math.sin(x * 0.2 + y * 0.3) * 1.5)) % 5 === 0 && d > 3 && bay(x, y) > 0.4) cc = hs(cc, -0.08);
      L.px(x, y, cc);
      if (d > 30) { L.rect(x, y, 1, H - y, cc); break; }
    }
  }
}
function bDesert(c: C) {
  const r = c.r; c.horizon = 108;
  if (c.s.time === "day") c.sky = c.sky.map((k, i) => mix(k, ["#3a80d0", "#68a8e0", "#a0d0f0", "#e0e8d0", "#f8f0d0"][i] ?? k, 0.5));
  skyLayer(c);
  // far mesas, shimmering in the heat
  const L0 = new Layer();
  for (let i = 0; i < r.int(2, 4); i++) { const x = r.int(0, 260), w = r.int(30, 70), h = r.int(14, 30); L0.tex([[x, 112], [x + 6, 112 - h], [x + w - 6, 112 - h], [x + w, 112]], (px, py) => (py < 112 - h + 2 ? "#d8a088" : px > x + w * 0.6 ? "#a87068" : "#c08878")); for (let y = 112 - h + 4; y < 112; y += 4) L0.rect(x + 4, y, w - 8, 1, "#a87068"); }
  dunes(L0, 114, 6, "#e0b890", r.next() * 9);
  gradeCanvas(L0.c, c.grade, c.haze, 0.45);
  const far = finalize(L0.c);
  c.compG.drawImage(far, 0, 0);
  c.back.push((g, t) => { if (c.dark > 0.5) { g.drawImage(far, 0, 0); return; } for (let y = 60; y < 120; y++) g.drawImage(far, 0, y, W, 1, Math.round(Math.sin(t * 0.004 + y * 0.9) * 0.8), y, W, 1); g.drawImage(far, 0, 120, W, H - 120, 0, 120, W, H - 120); });
  const L1 = lay(c);
  dunes(L1, 124, 14, "#e8c088", r.next() * 9);
  const feature = r.pick(["pyramid", "oasis", "obelisk", "none"]);
  if (feature === "pyramid") { const px = r.int(60, 240); L1.tex([[px - 40, 122], [px, 86], [px + 40, 122]], (x, y) => ((y - 86) % 4 === 0 ? "#b89060" : x < px ? "#e8c890" : "#c09868")); }
  if (feature === "obelisk") { const px = r.int(40, 280); L1.tex([[px - 4, 124], [px - 3, 90], [px, 86], [px + 3, 90], [px + 4, 124]], (x) => (x < px ? "#d8b890" : "#a88a68")); for (let y = 94; y < 120; y += 5) L1.px(px - 1, y, "#7a5a40"); }
  commit(c, L1, 0.18);
  const L3 = lay(c);
  ground(c, L3, 132, "sand", { tufts: 0 });
  for (let y = 134; y < H; y += 3) for (let x = 0; x < W; x++) if (Math.sin(x * 0.15 + y * 0.6 + Math.sin(x * 0.03) * 3) > 0.7) L3.px(x, y, "#c89a60");
  if (feature === "oasis") {
    const ox = r.int(60, 220);
    L3.ellipse(ox, 138, 30, 4, "#3a8ab0"); L3.ellipse(ox - 4, 137, 20, 2, "#6ab0d0"); L3.ellipse(ox, 142, 32, 2, "#7aa048");
    for (let k = 0; k < 3; k++) palm(L3, ox - 26 + k * 24 + r.int(-4, 4), 140 - r.int(0, 3), r.int(30, 42), r);
  }
  for (let i = 0; i < r.int(1, 3); i++) { const x = r.int(10, 310), y = r.int(140, 170); L3.rect(x, y - 14, 3, 14, "#5a9a50"); L3.rect(x - 4, y - 10, 2, 5, "#5a9a50"); L3.rect(x - 4, y - 6, 4, 2, "#5a9a50"); L3.rect(x + 4, y - 12, 2, 6, "#5a9a50"); L3.rect(x + 2, y - 7, 3, 2, "#5a9a50"); L3.px(x, y - 14, "#7aba70"); }
  if (r.chance(0.6)) { const x = r.int(20, 300), y = r.int(150, 170); L3.ellipse(x, y - 3, 4, 3, "#f0e8d8"); L3.px(x - 2, y - 3, "#2a2020"); L3.px(x + 1, y - 3, "#2a2020"); L3.rect(x - 1, y, 3, 1, "#e0d8c8"); L3.line(x + 6, y, x + 16, y - 2, "#e8e0d0"); }
  for (let i = 0; i < 5; i++) rock(L3, r.int(0, W), r.int(140, 176), r.int(6, 14), r.int(3, 6), "#b08a68", r);
  commit(c, L3, 0);
  anim(c, birdsFn(c, { y0: 30, y1: 60, n: 2, scale: 2, col: "#2a2020" }));
  c.front.push(motesFn(30, 0, W, 120, 178, c.s.seed + "sand", "#f0d8a0", 0.6));
  if (c.s.weather === "wind" || c.storm) c.front.push(fogFn(c, 110, 70, 0.8, 0.03, "#d8b080"));
  c.groundY = 156; c.slots = stdSlots(154, 3);
}
function palm(L: Layer, x: number, y: number, h: number, r: R) {
  const lean = (r.next() - 0.5) * 12;
  for (let i = 0; i < h; i++) { const f = i / h, px = Math.round(x + lean * f * f); L.rect(px, y - i, 3, 1, i % 3 === 0 ? "#6a5030" : "#8a6a40"); L.px(px, y - i, "#a8885a"); }
  const tx = Math.round(x + lean) + 1, ty = y - h;
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI + (r.next() - 0.5) * 0.3, len = r.int(12, 18);
    for (let i = 0; i < len; i++) { const f = i / len, px = tx + Math.cos(a) * i, py = ty + Math.sin(a) * i * 0.6 + f * f * 8; L.px(px, py, "#3a8a3a"); if (i % 2 === 0) { L.px(px, py + 1, "#2a6a2a"); L.px(px, py - 1, "#5aaa4a"); } }
  }
  L.ellipse(tx, ty + 1, 2, 1, "#6a4a2a");
}

// ------------------------------------------------------------ sky
function bSky(c: C) {
  const r = c.r; c.horizon = 150;
  skyLayer(c);
  // a sea of cloud far below
  const cloudRow = (y: number, sz: number, a: number, seed: string) => {
    const L = lay(c), cr = seeded(c.s.seed + seed);
    for (let x = -30; x < W + 30; x += cr.int(18, 30)) L.p.blob(x, y + cr.int(-3, 3), sz + cr.int(0, sz), sz * 0.6 + cr.int(0, 4), c.cloudCols[1], { outline: false, hi: 0.3, lo: -0.2 });
    L.rect(0, y + 2, W, H - y, mix(c.cloudCols[1], c.cloudCols[2], 0.3));
    commit(c, L, a, { grade: false, snow: false });
  };
  cloudRow(110, 10, 0.35, "c1");
  // floating islands with waterfalls
  const L = lay(c);
  const isl: [number, number, number][] = [];
  for (let i = 0; i < r.int(2, 3); i++) {
    const x = r.int(30, 290), y = r.int(60, 100), w = r.int(20, 44);
    isl.push([x, y, w]);
    L.tex([[x - w / 2, y], [x + w / 2, y], [x + w * 0.2, y + w * 0.6], [x, y + w * 0.8], [x - w * 0.25, y + w * 0.5]], (px, py) => (py < y + 2 ? "#6ab050" : px > x + w * 0.1 ? "#6a5a5a" : "#8a7a72"));
    for (let k = 0; k < 3; k++) plant(L, pineSprite(r, r.int(8, 14), "#2f6a48"), x - w / 3 + r.int(0, w * 0.6), y + 1);
    if (r.chance(0.4)) { L.rect(x - 3, y - 14, 6, 14, "#d8d0c8"); L.tex([[x - 4, y - 14], [x, y - 20], [x + 4, y - 14]], () => "#5a5a8a"); }
  }
  commit(c, L, 0.35);
  const fall = gc(c, "#d8f0ff", 0.3), fall2 = gc(c, "#90c8f0", 0.3);
  anim(c, (g, t) => {
    for (const [x, y, w] of isl) {
      const fx = Math.round(x + w * 0.3);
      for (let k = 0; k < 40; k++) { const yy = y + ((k * 3 + t * 0.03) % 70); g.fillStyle = k % 3 ? fall : fall2; g.globalAlpha = 1 - (yy - y) / 70; g.fillRect(fx + (k % 2), Math.round(yy), 1, 2); }
    }
    g.globalAlpha = 1;
  });
  cloudRow(128, 16, 0.15, "c2");
  // the island the party stands on
  const L3 = lay(c);
  const top = (x: number) => 144 + Math.sin(x * 0.02 + 1) * 3;
  ground(c, L3, 140, "meadow", { top, flowers: 30, tufts: 40 });
  for (let x = 0; x < W; x++) { const b = 164 + Math.round(vnoise(x, 0, 9, 4) * 10); for (let y = b; y < H; y++) L3.g.clearRect(x, y, 1, 1); for (let y = b - 8; y < b; y++) L3.px(x, y, (y + x) % 7 === 0 ? "#5a4a48" : "#7a6a62"); }
  for (let i = 0; i < 16; i++) { const x = r.int(0, W); for (let k = 0; k < r.int(4, 14); k++) L3.px(x + Math.round(Math.sin(k) * 0.6), 168 + k, "#5a4030"); }
  commit(c, L3, 0);
  anim(c, cloudDriftFn(c, 170, 0.5));
  anim(c, birdsFn(c, { y0: 60, y1: 110, col: "#f4f4f4" }));
  if (c.s.time !== "night") anim(c, shaftsFn(c, 4, "#fff0c0", -0.25, 0.12));
  c.groundY = 156; c.slots = stdSlots(154, 3);
}
function cloudDriftFn(c: C, y: number, a: number, n = 4): Fn {
  const r = seeded(c.s.seed + "drift" + y);
  const cl = Array.from({ length: n }, () => ({ img: cloudSprite(r, r.int(50, 90), r.int(10, 16), c.cloudCols), x: r.next() * W * 1.5, y: y + r.int(-6, 8), v: rng(r, 0.003, 0.009) }));
  return (g, t) => { g.globalAlpha = a; for (const k of cl) g.drawImage(k.img, Math.round(((k.x + t * k.v) % (W + 100)) - 100), k.y); g.globalAlpha = 1; };
}

// ============================================================ interiors
/** Contour-shaded rock: bulges lit from above, shadowed beneath, strata and cracks. */
function rockFace(col: string, seed: number, scale = 1) {
  const lv = [hs(col, -0.42), hs(col, -0.26), hs(col, -0.1), col, hs(col, 0.14)];
  const lit = hs(col, 0.32), sh = hs(col, -0.55);
  const v = (x: number, y: number) => vnoise(x, y * 1.3, 16 * scale, seed) * 0.65 + vnoise(x, y * 1.2, 6 * scale, seed + 1) * 0.35;
  return (x: number, y: number) => {
    const a = v(x, y), up = v(x, y - 2), dn = v(x, y + 2);
    const q = a * 4.2 + (bay(x, y) - 0.5) * 0.5;
    let cc = lv[Math.max(0, Math.min(4, Math.floor(q)))];
    if (a - up > 0.035) cc = lit;
    else if (a - dn > 0.05) cc = sh;
    if (hn(x, y, seed) > 0.992) cc = sh;
    return cc;
  };
}
const IN_GRADE: Record<Time, string> = { dawn: "#e4d6d4", day: "#f2eae2", dusk: "#d8c4bc", night: "#a49cb8" };
function interiorSetup(c: C, k = 1) {
  c.grade = mix("#ffffff", IN_GRADE[c.s.time], k);
  if (c.over > 0.5) c.grade = mix(c.grade, "#a0a4b0", 0.2);
  c.haze = "#100c18";
  c.dark = Math.max(c.dark, 0.7); // lamps are lit indoors
  c.tint = "#ff9a48"; c.ta = 0.1;
}
/** Floor in one-point perspective: fn gets (u across, v depth) in floor units. */
function perspFloor(L: Layer, y0: number, vx: number, vy: number, fn: (u: number, v: number, x: number, y: number) => string) {
  L.texRect(0, y0, W, H - y0, (x, y) => { const dz = y - vy; return fn((x - vx) / dz, 400 / dz, x, y); });
}
/** A window in an interior wall showing the time of day outside (and the weather). */
function roomWindow(c: C, L: Layer, x: number, y: number, w: number, h: number, o: { arch?: boolean; frame?: string; stained?: boolean; bars?: boolean } = {}) {
  const fr = o.frame ?? "#5a3e28";
  const inside = (px: number, py: number) => !o.arch || py >= y + w / 2 || (px - x - w / 2 + 0.5) ** 2 + (py - y - w / 2) ** 2 <= (w / 2) ** 2;
  L.rect(x - 2, y - 2 + (o.arch ? 0 : 0), w + 4, h + 4, hs(fr, -0.3));
  for (let py = y - 2; py < y + h + 2; py++) for (let px = x - 2; px < x + w + 2; px++) if (o.arch && py < y + w / 2 && (px - x - w / 2 + 0.5) ** 2 + (py - y - w / 2) ** 2 > (w / 2 + 2) ** 2) L.g.clearRect(px, py, 1, 1);
  const sky = c.sky;
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (!inside(px, py)) continue;
    const f = (py - y) / h;
    let cc = toHex(...lerpStops(sky, 0.15 + f * 0.7));
    if (o.stained) {
      const seg = Math.floor((px - x) / 4) + Math.floor((py - y) / 5) * 3;
      cc = ["#c83a4a", "#3a6ad8", "#e8c040", "#4aa060", "#8a4ac8", "#e8803a"][((seg % 6) + 6) % 6];
      if ((px - x) % 4 === 0 || (py - y) % 5 === 0) cc = "#2a2228";
    } else if (c.s.time === "night" && hn(px, py, 5) > 0.93) cc = "#e8eeff";
    L.px(px, py, cc);
  }
  if (!o.stained) {
    L.rect(x + Math.floor(w / 2), y, 1, h, fr);
    for (let py = y + Math.round(h / 3); py < y + h; py += Math.round(h / 3)) L.rect(x, py, w, 1, fr);
    if (o.bars) for (let px = x + 2; px < x + w; px += 3) L.rect(px, y, 1, h, IRON);
  }
  L.rect(x - 3, y + h + 1, w + 6, 2, hs(fr, 0.15)); L.rect(x - 3, y + h + 1, w + 6, 1, hs(fr, 0.4));
  if (c.wet) { const col = gc(c, "#a8c0e0"); anim(c, (g, t) => { g.fillStyle = col; for (let i = 0; i < 6; i++) { const px = x + 1 + Math.floor(hn(i, 3) * (w - 2)), py = y + ((t * 0.08 + hn(i, 4) * h) % h); if (inside(px, Math.round(py))) { g.globalAlpha = 0.7; g.fillRect(px, Math.round(py), 1, 3); } } g.globalAlpha = 1; }); }
}
/** Light falling through a window onto the floor. */
function windowLight(c: C, x: number, y: number, w: number, h: number, floorY: number, dx: number, col?: string): Fn {
  const [cv, g] = cnv();
  const cl = col ?? (c.s.time === "night" ? "#8aa0e0" : c.s.time === "dusk" ? "#ffa860" : c.s.time === "dawn" ? "#ffc8a0" : "#fff4d0");
  const gr = g.createLinearGradient(0, y, 0, H);
  gr.addColorStop(0, rgba(cl, 0.5)); gr.addColorStop(1, rgba(cl, 0.08));
  g.fillStyle = gr;
  const fy = floorY + (H - floorY) * 0.6;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + dx + 18, fy); g.lineTo(x + dx - 10, fy); g.closePath(); g.fill();
  g.fillStyle = rgba(cl, 0.18); g.beginPath(); g.ellipse(x + w / 2 + dx + 4, fy - 2, w + 10, 6, 0, 0, Math.PI * 2); g.fill();
  const a = (c.over > 0.6 ? 0.4 : 1) * (c.s.time === "night" ? 0.45 : 0.75) * (h > 0 ? 1 : 1);
  return (gg, t) => { gg.globalCompositeOperation = "lighter"; gg.globalAlpha = a * (0.8 + 0.2 * Math.sin(t * 0.0005)); gg.drawImage(cv, 0, 0); gg.globalCompositeOperation = "source-over"; gg.globalAlpha = 1; };
}
function candle(c: C, L: Layer, x: number, y: number, h = 5) {
  L.rect(x, y - h, 2, h, "#f4ecd8"); L.px(x, y - h, "#ffffff"); L.px(x + 1, y - h + 1, "#d8ccb0");
  const ph = hn(x, y) * 40;
  c.warm += 0.008;
  anim(c, (g, t) => { const f = flick(t, ph); addGlow(g, x + 1, y - h - 2, 9, "#ffb050", 0.4 * f); g.fillStyle = "#ffb040"; g.fillRect(x, y - h - 2, 2, 2); g.fillStyle = "#fff4c0"; g.fillRect(x + (Math.sin(t * 0.02 + ph) > 0.5 ? 1 : 0), y - h - 3, 1, 2); });
}
function chainsFn(c: C, pts: { x: number; y: number; len: number }[]): Fn {
  const col = gc(c, "#5a5660"), hi = gc(c, "#8a8690");
  return (g, t) => {
    for (const p of pts) {
      const sw = Math.sin(t * 0.0012 + p.x) * 1.2;
      for (let i = 0; i < p.len; i++) { const f = i / p.len, x = Math.round(p.x + sw * f * f); g.fillStyle = i % 2 ? col : hi; g.fillRect(x, p.y + i, i % 2 ? 1 : 2, 1); }
      const ex = Math.round(p.x + sw);
      g.fillStyle = col; g.fillRect(ex - 2, p.y + p.len, 5, 1); g.fillRect(ex - 2, p.y + p.len, 1, 3); g.fillRect(ex + 2, p.y + p.len, 1, 3); g.fillRect(ex - 2, p.y + p.len + 3, 5, 1);
    }
  };
}
function dripsFn(c: C, pts: { x: number; y: number; to: number }[]): Fn {
  const col = gc(c, "#a8d0f0");
  return (g, t) => {
    g.fillStyle = col;
    pts.forEach((p, i) => {
      const per = 1800 + hn(i, 1) * 2400, a = ((t + hn(i, 2) * per) % per) / per;
      if (a < 0.4) { g.globalAlpha = a / 0.4; g.fillRect(p.x, p.y, 1, 1 + (a > 0.3 ? 1 : 0)); }
      else if (a < 0.62) { const k = (a - 0.4) / 0.22; g.globalAlpha = 1; g.fillRect(p.x, Math.round(p.y + (p.to - p.y) * k * k), 1, 2); }
      else if (a < 0.8) { const k = (a - 0.62) / 0.18; g.globalAlpha = 1 - k; const rr = Math.round(1 + k * 4); g.fillRect(p.x - rr, p.to, 1, 1); g.fillRect(p.x + rr, p.to, 1, 1); g.fillRect(p.x - 1, p.to - 1 - Math.round(k * 2), 1, 1); g.fillRect(p.x + 1, p.to - 1 - Math.round(k * 2), 1, 1); }
    });
    g.globalAlpha = 1;
  };
}
function ceilingBeams(L: Layer, y: number, col: string, n = 6) {
  L.rect(0, 0, W, y, hs(col, -0.45));
  for (let i = 0; i <= n; i++) { const x = Math.round((i / n) * W - 4); L.rect(x, 0, 8, y, col); L.rect(x, 0, 1, y, hs(col, 0.25)); L.rect(x + 7, 0, 1, y, hs(col, -0.3)); }
  L.rect(0, y, W, 6, col); L.rect(0, y, W, 1, hs(col, 0.25)); L.rect(0, y + 5, W, 1, hs(col, -0.4));
  for (let x = 0; x < W; x += 5) if (hn(x, y) > 0.6) L.px(x, y + 2 + Math.floor(hn(x, 2) * 3), hs(col, -0.2));
}

// ------------------------------------------------------------ royal hall
function bHall(c: C) {
  const r = c.r; interiorSetup(c, 0.8);
  const stone = r.pick(["#b8aca0", "#a8a4b0", "#c4b8a4"]), floorY = 116, vx = 160, vy = 30;
  const L = lay(c);
  wallTex(L.p, 0, 0, W, floorY, stone, "stone", r.int(0, 99));
  L.g.fillStyle = "rgba(20,10,30,0.35)"; L.g.fillRect(0, 0, W, 14); L.g.fillStyle = "rgba(20,10,30,0.18)"; L.g.fillRect(0, 14, W, 10);
  // vaulted ribs along the top
  for (let x = 0; x < W; x += 64) for (let a = 0; a < Math.PI; a += 0.06) L.rect(Math.round(x + 32 - Math.cos(a) * 32), Math.round(Math.sin(a) * 10), 2, 2, hs(stone, -0.25));
  // tall windows with light
  const nw = r.chance(0.5) ? 2 : 4, wins: number[] = [];
  for (let i = 0; i < nw; i++) { const wx = nw === 2 ? (i ? 238 : 66) : [34, 96, 210, 272][i]; wins.push(wx); roomWindow(c, L, wx - 7, 22, 14, 44, { arch: true, frame: hs(stone, -0.3), stained: r.chance(0.3) }); }
  // banners between
  const bc = r.pick(["#a82a2a", "#2a3a98", "#2a6a3a", "#6a2a7a"]);
  for (const bx of nw === 2 ? [100, 204] : [66, 240]) banner(L, bx - 6, 20, 12, 50, bc, "#f2c542", r.int(0, 2));
  // floor: polished checkered marble with a carpet from the dais to the viewer
  const m1 = r.pick(["#d8d0c4", "#c8c8d0"]), m2 = r.pick(["#5a4a48", "#3a3a4a", "#6a4a3a"]);
  const carpet = r.pick(["#a82a2a", "#8a2a4a", "#2a4a8a"]);
  perspFloor(L, floorY, vx, vy, (u, v, x, y) => {
    const a = Math.floor(u * 3), b = Math.floor(v * 0.9);
    let cc = (a + b) % 2 ? m1 : m2;
    if (Math.abs(u * 3 - Math.round(u * 3)) < 0.04 || Math.abs(v * 0.9 - Math.round(v * 0.9)) < 0.05) cc = hs(cc, -0.15);
    if (Math.abs(u) < 0.55) cc = Math.abs(u) > 0.47 ? "#e8c050" : Math.abs(u) > 0.42 ? hs(carpet, -0.2) : hn(x, y, 2) > 0.9 ? hs(carpet, 0.1) : carpet;
    if (hn(x, y, 3) > 0.985) cc = hs(cc, 0.3);
    return cc;
  });
  L.g.fillStyle = "rgba(255,250,240,0.08)"; L.g.fillRect(0, floorY, W, 10);
  L.rect(0, floorY - 3, W, 3, hs(stone, -0.3)); L.rect(0, floorY - 3, W, 1, hs(stone, 0.1));
  // dais & throne
  for (let k = 0; k < 3; k++) { const w = 70 - k * 14, y = floorY - k * 4; L.rect(vx - w / 2, y - 4, w, 4, hs(stone, 0.05 - k * 0.04)); L.rect(vx - w / 2, y - 4, w, 1, hs(stone, 0.3)); L.rect(vx - w / 2 + 6, y - 4, w - 12, 4, hs(carpet, -0.05 * k)); L.rect(vx - w / 2 + 6, y - 4, w - 12, 1, hs(carpet, 0.2)); }
  const ty = floorY - 12, gold = "#e0b040";
  L.rect(vx - 10, ty - 40, 20, 40, gold); L.rect(vx - 8, ty - 38, 16, 30, carpet); L.rect(vx - 8, ty - 38, 3, 30, hs(carpet, 0.2));
  L.ellipse(vx, ty - 42, 8, 5, gold); L.px(vx, ty - 48, "#ff5050"); L.rect(vx - 1, ty - 47, 3, 2, gold);
  L.rect(vx - 14, ty - 14, 4, 14, gold); L.rect(vx + 10, ty - 14, 4, 14, gold); L.rect(vx - 14, ty - 16, 6, 2, hs(gold, 0.3)); L.rect(vx + 8, ty - 16, 6, 2, hs(gold, 0.3));
  L.rect(vx - 10, ty - 8, 20, 4, hs(carpet, 0.15)); L.rect(vx - 10, ty - 4, 20, 4, hs(gold, -0.2));
  L.rect(vx - 10, ty - 40, 1, 40, hs(gold, 0.35)); L.rect(vx + 9, ty - 40, 1, 40, hs(gold, -0.3));
  // great pillars
  for (const px of [6, 104, 206, 302]) {
    const big = px < 20 || px > 290, w = big ? 16 : 10, top = big ? 0 : 12, base = big ? H - 8 : floorY;
    column(L, px - w / 2, top, base, w, hs(stone, 0.06), { s: px });
    if (!big) torch(c, L, px, 50);
  }
  commit(c, L, 0);
  for (const wx of wins) anim(c, windowLight(c, wx - 7, 22, 14, 44, floorY, (wx - 160) * 0.35));
  // chandelier
  const chx = 160, chy = 26;
  const Lc = lay(c);
  Lc.rect(chx, 0, 1, chy, IRON); Lc.ellipse(chx, chy + 2, 20, 2, "#c8a040"); Lc.span(chx - 17, chx + 17, chy + 2, "#7a5a20");
  for (let k = -2; k <= 2; k++) candle(c, Lc, chx + k * 8, chy + 1, 4);
  commit(c, Lc, 0);
  anim(c, motesFn(26, 20, 300, 30, 130, c.s.seed, "#fff4d0", 0.6));
  c.groundY = 156; c.slots = stdSlots(154, 3, [40, 84, 124, 196, 236, 280]);
}

// ------------------------------------------------------------ inn
function bInn(c: C) {
  const r = c.r; interiorSetup(c, 0.75);
  const wood = r.pick(["#8a5a38", "#7a5034", "#9a6a44"]), floorY = 120, vx = 160, vy = 40;
  const L = lay(c);
  wallTex(L.p, 0, 0, W, floorY, hs(wood, 0.05), "plank", r.int(0, 99));
  // plaster upper wall with timber frame
  wallTex(L.p, 0, 14, W, 46, "#e0d0b0", "timber", r.int(0, 99));
  L.rect(0, 58, W, 3, hs(wood, -0.2)); L.rect(0, 58, W, 1, hs(wood, 0.2));
  ceilingBeams(L, 10, hs(wood, -0.15));
  perspFloor(L, floorY, vx, vy, (u, v, x, y) => {
    const k = Math.floor(u * 7), within = u * 7 - k;
    let cc = hs(wood, (hn(k, 3) - 0.5) * 0.18 - 0.05);
    if (within < 0.06) cc = hs(wood, -0.45);
    const seg = Math.floor(v * 0.6 + hn(k, 1) * 4);
    if (Math.abs(v * 0.6 + hn(k, 1) * 4 - seg) < 0.04) cc = hs(wood, -0.35);
    if (hn(x, y, 2) > 0.97) cc = hs(cc, -0.15);
    return cc;
  });
  L.rect(0, floorY - 2, W, 2, hs(wood, -0.4));
  const hearthLeft = r.chance(0.5);
  const hx = hearthLeft ? 14 : W - 84;
  const bx0 = hearthLeft ? W - 112 : 0;
  // hearth: stone chimney breast
  wallTex(L.p, hx, 10, 70, floorY - 10, "#9a948c", "stone", 3);
  L.rect(hx - 3, 64, 76, 4, "#6a4428"); L.rect(hx - 3, 64, 76, 1, "#9a6a44");
  L.rect(hx + 12, 76, 46, floorY - 76, "#1a1214");
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.15) L.rect(Math.round(hx + 35 + Math.cos(a) * 24), Math.round(80 + Math.sin(a) * 6), 3, 3, "#b0a89c");
  L.rect(hx + 8, floorY - 4, 54, 4, "#b0a89c"); L.rect(hx + 8, floorY - 4, 54, 1, "#d0c8bc");
  for (let k = 0; k < 3; k++) L.rect(hx + 22 + k * 7, floorY - 8 - (k % 2) * 2, 12, 3, "#5a3a22");
  L.rect(hx + 34, 72, 1, 16, IRON); L.ellipse(hx + 35, 92, 7, 5, "#2a2a30"); L.rect(hx + 28, 88, 15, 2, "#4a4a52");
  for (let k = 0; k < 4; k++) { const mx = hx + 4 + k * 17; if (r.chance(0.6)) { L.rect(mx, 58, 5, 6, r.pick(["#c8a070", "#8a8a9a", "#e0d8c8"])); L.rect(mx + 5, 59, 1, 3, "#6a5040"); } }
  if (r.chance(0.7)) { L.rect(hx + 26, 26, 18, 14, "#6a4428"); for (const [dx, dy] of [[-6, -6], [-9, -10], [-4, -12], [6, -6], [9, -10], [4, -12]]) L.line(hx + 35, 28, hx + 35 + dx, 28 + dy, "#e8dcc0"); L.rect(hx + 32, 28, 6, 8, "#8a6a4a"); }
  // bar counter, shelves, kegs
  L.rect(bx0 + 4, 22, 104, 2, "#5a3a22"); L.rect(bx0 + 4, 40, 104, 2, "#5a3a22");
  for (let k = 0; k < 18; k++) { const x = bx0 + 8 + k * 5 + r.int(0, 1), col = r.pick(["#3a7a4a", "#7a2a3a", "#c8a040", "#4a5a9a", "#e0d8c8", "#8a5a2a"]); const h = r.int(5, 9); L.rect(x, 22 - h, 3, h, col); L.rect(x + 1, 22 - h - 2, 1, 2, col); L.px(x, 22 - h + 1, hs(col, 0.4)); }
  for (let k = 0; k < 14; k++) { const x = bx0 + 8 + k * 7; L.rect(x, 34, 5, 6, r.pick(["#c8a070", "#d8d0c0", "#8a6a4a"])); L.rect(x + 5, 35, 1, 3, "#6a5040"); }
  for (let k = 0; k < 3; k++) { const kx = bx0 + 14 + k * 30; L.ellipse(kx + 8, 54, 9, 8, "#8a5a34"); L.ellipse(kx + 8, 54, 4, 4, "#a87a4a"); L.rect(kx + 7, 60, 2, 4, "#c8a040"); L.rect(kx, 51, 17, 1, "#4a4448"); L.rect(kx, 57, 17, 1, "#4a4448"); }
  wallTex(L.p, bx0 + 2, 96, 108, 22, wood, "plank", 7);
  L.rect(bx0, 92, 112, 4, hs(wood, 0.25)); L.rect(bx0, 92, 112, 1, hs(wood, 0.5)); L.rect(bx0, 95, 112, 1, hs(wood, -0.4));
  for (let k = 0; k < 5; k++) { const mx = bx0 + 10 + k * 22 + r.int(0, 6); if (r.chance(0.6)) { L.rect(mx, 86, 5, 6, "#c8a070"); L.rect(mx, 86, 5, 1, "#f8f0e0"); L.rect(mx + 5, 87, 1, 3, "#8a6a4a"); } }
  for (let k = 0; k < 3; k++) { const sx = bx0 + 16 + k * 36; L.ellipse(sx, 104, 6, 2, "#6a4428"); L.rect(sx - 4, 106, 1, 14, "#5a3a22"); L.rect(sx + 3, 106, 1, 14, "#5a3a22"); }
  // window in the middle wall
  const wx = r.int(130, 170);
  roomWindow(c, L, wx, 24, 22, 28, { frame: "#5a3e28" });
  // notice board
  const nbx = hearthLeft ? wx + 36 : wx - 40;
  L.rect(nbx, 28, 24, 18, "#8a6440"); L.rect(nbx + 1, 29, 22, 16, "#c09a6a");
  for (let k = 0; k < 4; k++) { L.rect(nbx + 2 + (k % 2) * 11, 30 + Math.floor(k / 2) * 8, 9, 7, "#f0e8d4"); L.px(nbx + 6 + (k % 2) * 11, 30 + Math.floor(k / 2) * 8, "#c83a3a"); for (let l = 0; l < 3; l++) L.rect(nbx + 3 + (k % 2) * 11, 32 + l * 2 + Math.floor(k / 2) * 8, 6, 1, "#a8a090"); }
  // tables with candles and mugs, barrels
  const tables = [r.int(96, 120), r.int(196, 220)];
  for (const tx of tables) {
    L.ellipse(tx, 112, 16, 3, "#7a4a2c"); L.ellipse(tx, 111, 15, 2, "#9a6a44"); L.rect(tx - 2, 114, 4, 10, "#5a3a22"); L.rect(tx - 6, 123, 12, 2, "#4a2c18");
    for (const sx of [tx - 20, tx + 18]) { L.ellipse(sx, 118, 4, 1, "#7a4a2c"); L.rect(sx - 3, 119, 1, 7, "#5a3a22"); L.rect(sx + 2, 119, 1, 7, "#5a3a22"); }
    L.rect(tx + 4, 106, 4, 5, "#c8a070"); L.rect(tx + 4, 106, 4, 1, "#fff8e8"); L.rect(tx - 9, 108, 6, 2, "#e8e0d0");
    candle(c, L, tx - 2, 110, 4);
  }
  barrelAt(L, hearthLeft ? 296 : 8, 128); barrelAt(L, hearthLeft ? 304 : 16, 128); barrelAt(L, hearthLeft ? 300 : 12, 118, "#8a5a34");
  // rug before the hearth
  L.ellipse(hx + 35, floorY + 6, 30, 4, "#8a3a3a"); L.ellipse(hx + 35, floorY + 6, 26, 3, "#a85a3a"); L.ellipse(hx + 35, floorY + 6, 20, 2, "#c8a050");
  commit(c, L, 0);
  // fire, pot steam, cat
  c.warm += 0.12;
  const fx = hx + 35, fy = floorY - 6;
  anim(c, (g, t) => {
    const f = flick(t, 2);
    addGlow(g, fx, fy - 8, 110, "#ff8a30", 0.3 * f);
    addGlow(g, fx, fy - 6, 34, "#ffc060", 0.5 * f);
    flame(g, fx - 8, fy, 6, t, 0.3); flame(g, fx + 7, fy, 5.5, t, 2.1); flame(g, fx, fy + 1, 8, t, 4.4); flame(g, fx - 3, fy, 5, t, 6.2);
    embers(g, fx, fy - 8, 8, 18, t, 2);
    smoke(g, fx, 86, t, { col: "#f0f0f0", a: 0.3, rise: 12, n: 4, per: 2600, wind: 0 });
  });
  if (r.chance(0.7)) { const cx = hx + 35 + r.int(-14, 14), cy = floorY + 8, fur = gc(c, r.pick(["#e8902a", "#3a3438", "#c8c0b8"])); anim(c, (g, t) => { g.fillStyle = fur; g.fillRect(cx - 5, cy - 3, 9, 3); g.fillRect(cx - 4, cy - 4, 7, 1); g.fillRect(cx + 3, cy - 5, 3, 3); g.fillRect(cx + 3, cy - 6, 1, 1); g.fillRect(cx + 5, cy - 6, 1, 1); const tl = Math.sin(t * 0.0015) > 0.6 ? -1 : 0; g.fillRect(cx - 8, cy - 1 + tl, 3, 1); g.fillRect(cx - 9, cy - 2 + tl * 2, 1, 1); }); }
  const lamps = [r.int(60, 90), r.int(230, 260)];
  anim(c, (g, t) => {
    for (const lx of lamps) {
      const sw = Math.sin(t * 0.0011 + lx) * 1.5, ex = Math.round(lx + sw);
      g.fillStyle = gc(c, IRON); pline(g, lx, 16, ex, 30);
      g.fillRect(ex - 2, 30, 5, 1); g.fillStyle = "#ffd070"; g.fillRect(ex - 2, 31, 5, 4); g.fillStyle = "#fff4c0"; g.fillRect(ex - 1, 32, 3, 2); g.fillStyle = gc(c, IRON); g.fillRect(ex - 2, 35, 5, 1);
      addGlow(g, ex, 33, 26, "#ffb050", 0.35 * flick(t, lx));
    }
  });
  anim(c, windowLight(c, wx, 24, 22, 28, floorY, 10));
  anim(c, motesFn(14, 60, 260, 40, 120, c.s.seed, "#ffe8b0", 0.5));
  c.groundY = 156; c.slots = stdSlots(152, 4);
}

// ------------------------------------------------------------ cave
function bCave(c: C) {
  const r = c.r; interiorSetup(c, 0.4);
  c.grade = mix(c.grade, "#8890a8", 0.45);
  const rockC = r.pick(["#6a6070", "#6a6460", "#5a6068", "#70605a"]), floorY = 124;
  const L = lay(c);
  const opening = r.chance(0.5);
  const ox = r.int(110, 210), oy = r.int(56, 76);
  // back wall: contour-shaded rock, darker toward the edges, around a mouth / dark passage
  const rf = rockFace(rockC, r.int(0, 999));
  L.texRect(0, 0, W, H, (x, y) => {
    const cc = rf(x, y);
    const e = Math.max(Math.abs(x - 160) / 160, Math.abs(y - 70) / 90);
    return e > 0.75 ? mix(cc, "#0a0810", (e - 0.75) * 1.6) : cc;
  });
  const mr = (a: number) => 1 + (vnoise(a * 9, 0, 3, 41) - 0.5) * 0.5;
  const inMouth = (x: number, y: number, k = 1) => { const dx = (x - ox) / 30, dy = (y - oy) / 36; const a = Math.atan2(dy, dx); return dx * dx + (dy < 0 ? dy * dy : 0) < (mr(a) * k) ** 2; };
  for (let y = oy - 46; y < floorY + 4; y++) for (let x = ox - 46; x < ox + 46; x++) {
    if (inMouth(x, y, 1.18) && !inMouth(x, y)) L.px(x, y, hs(rockC, (y < oy ? 0.25 : -0.3) + (x < ox ? 0.1 : -0.15)));
    if (!inMouth(x, y)) continue;
    if (opening) {
      const f = clamp((y - (oy - 36)) / 70);
      let cc = toHex(...lerpStops(c.sky, 0.45 + f * 0.5));
      const hill = oy + 6 + Math.sin(x * 0.12) * 3 + vnoise(x, 0, 6, 8) * 6;
      if (y > hill) cc = c.s.time === "night" ? "#1c2a30" : mix("#5a8a50", c.sky[3], 0.35);
      if (y > hill + 8) cc = c.s.time === "night" ? "#18241c" : "#4a7a3a";
      L.px(x, y, cc);
    } else {
      const d = Math.hypot((x - ox) / 30, (y - oy) / 36);
      L.px(x, y, mix(hs(rockC, -0.45), "#050308", clamp(1.3 - d)));
    }
  }
  // floor
  const ff = rockFace(hs(rockC, -0.05), r.int(0, 999), 0.8);
  L.texRect(0, floorY, W, H - floorY, (x, y) => ff(x, Math.round(y * 1.8)));
  for (let x = 0; x < W; x++) { const y = floorY + Math.round(vnoise(x, 0, 12, 5) * 4 - 2); L.px(x, y, hs(rockC, 0.2)); L.px(x, y - 1, hs(rockC, -0.45)); }
  // stalactites & stalagmites
  const tips: { x: number; y: number; to: number }[] = [];
  for (let x = r.int(-4, 6); x < W; x += r.int(7, 16)) {
    const len = r.int(6, 34) * (Math.abs(x - ox) < 40 ? 0.5 : 1), w = Math.max(2, Math.round(len / 4));
    L.tex([[x - w, 0], [x + w, 0], [x + 0.5, len]], (px) => (px < x - w * 0.3 ? hs(rockC, 0.15) : px > x + w * 0.3 ? hs(rockC, -0.3) : rockC));
    L.px(x, Math.round(len) - 1, hs(rockC, 0.4));
    if (r.chance(0.35)) tips.push({ x, y: Math.round(len), to: floorY + r.int(8, 40) });
  }
  for (let i = 0; i < r.int(4, 8); i++) {
    const x = r.int(0, W), base = r.int(floorY + 2, floorY + 14), len = r.int(8, 26), w = Math.max(2, Math.round(len / 3.5));
    if (Math.abs(x - 160) < 30) continue;
    L.tex([[x - w, base], [x + 0.5, base - len], [x + w, base]], (px) => (px < x - w * 0.2 ? hs(rockC, 0.18) : px > x + w * 0.3 ? hs(rockC, -0.3) : rockC));
  }
  // glowing fungi and crystals
  const fungi: [number, number, string][] = [];
  const fcol = r.pick(["#6af0d0", "#90f070", "#b080ff"]);
  for (let i = 0; i < r.int(5, 9); i++) {
    const x = r.int(4, W - 4), y = r.chance(0.5) ? r.int(floorY - 30, floorY + 4) : r.int(floorY + 10, H - 8);
    for (let k = 0; k < r.int(2, 5); k++) { const mx = x + r.int(-5, 5), my = y + r.int(-2, 2); L.rect(mx, my - 2, 1, 2, "#c8d8c8"); L.rect(mx - 1, my - 3, 3, 1, fcol); L.px(mx, my - 4, hs(fcol, 0.4)); }
    fungi.push([x, y - 3, fcol]);
  }
  const crystal = r.pick(["#b080ff", "#70c8ff", "#ff80b0"]);
  const crys: [number, number][] = [];
  for (let i = 0; i < r.int(2, 4); i++) {
    const x = r.int(10, W - 10), y = r.int(floorY + 6, H - 10);
    if (Math.abs(x - 160) < 50) continue;
    for (let k = 0; k < 4; k++) { const h = r.int(5, 12), dx = (k - 1.5) * 3; L.tex([[x + dx - 1.5, y], [x + dx + k - 2, y - h], [x + dx + 1.5, y]], (px) => (px < x + dx ? hs(crystal, 0.3) : hs(crystal, -0.2))); }
    crys.push([x, y - 6]);
  }
  // a still pool
  const poolX = r.int(60, 260);
  commit(c, L, 0);
  if (r.chance(0.6)) {
    const pw = r.int(26, 40), py = r.int(floorY + 8, floorY + 14);
    const P = lay(c);
    P.ellipse(poolX, py, pw + 2, 6, hs(rockC, -0.4)); P.ellipse(poolX, py, pw, 5, "#16222e"); P.ellipse(poolX - 4, py - 1, pw * 0.7, 3, "#22384a");
    P.span(poolX - pw * 0.5, poolX + pw * 0.1, py - 3, "#4a7090"); P.span(poolX + 4, poolX + pw * 0.6, py + 1, "#2e4a60");
    commit(c, P, 0);
    anim(c, (g, t) => { g.fillStyle = gc(c, "#8ab8d8"); const a = (t % 2400) / 2400, rr = Math.round(a * 10); g.globalAlpha = 1 - a; g.fillRect(poolX - rr, py, 1, 1); g.fillRect(poolX + rr, py, 1, 1); g.fillRect(poolX - Math.round(rr * 0.6), py - 1, Math.round(rr * 1.2) + 1, 1); g.globalAlpha = 1; });
    tips.push({ x: poolX, y: 18, to: py });
  }
  anim(c, dripsFn(c, tips));
  anim(c, (g, t) => {
    for (const [x, y, col] of fungi) addGlow(g, x, y, 16, col, 0.25 + 0.12 * Math.sin(t * 0.0015 + x));
    for (const [x, y] of crys) { addGlow(g, x, y, 14, crystal, 0.22 + 0.1 * Math.sin(t * 0.002 + y)); if (Math.sin(t * 0.003 + x) > 0.97) { g.fillStyle = "#ffffff"; g.fillRect(x, y - 3, 1, 3); g.fillRect(x - 1, y - 2, 3, 1); } }
  });
  if (opening) anim(c, windowLight(c, ox - 20, oy - 20, 40, 40, floorY, 0));
  anim(c, birdsFn(c, { y0: 20, y1: 50, col: "#1a1418", n: r.int(2, 4), per: 14000 }));
  anim(c, motesFn(12, 60, 260, 40, 130, c.s.seed, fcol, 0.5));
  c.front.push(fogFn(c, 132, 48, 0.4, 0.004, "#3a3a50"));
  c.groundY = 156; c.slots = stdSlots(154, 3);
}

// ------------------------------------------------------------ tunnel
function bTunnel(c: C) {
  const r = c.r; interiorSetup(c, 0.4);
  c.grade = mix(c.grade, "#9090a8", 0.4);
  const vx = 160 + r.int(-10, 10), vy = 92;
  const L = lay(c);
  const mine = r.chance(0.6);
  const rockC = mine ? "#6a5a50" : "#7a7480";
  // rock everywhere, darker toward the vanishing point
  const rf = rockFace(rockC, r.int(0, 999), 0.7);
  L.texRect(0, 0, W, H, (x, y) => {
    const d = Math.min(1, Math.hypot(x - vx, (y - vy) * 1.6) / 170);
    const sc = 0.3 + d * 0.7;
    return mix("#08060a", rf(Math.round(vx + (x - vx) / sc), Math.round(vy + (y - vy) / sc)), Math.pow(d, 0.8));
  });
  const z = [1, 1.4, 2, 2.9, 4.2, 6.2];
  // floor
  L.texRect(0, vy, W, H - vy, (x, y) => {
    const dz = y - vy; if (dz < 3) return null;
    const u = (x - vx) / dz;
    if (Math.abs(u) > 2.2) return null;
    const d = Math.min(1, dz / 80);
    let cc = hs(mine ? "#7a6450" : "#6a6874", (vnoise(x, y * 2, 4, 6) - 0.5) * 0.3);
    if (mine) { // rails and sleepers
      const v = 400 / dz;
      if (Math.abs(Math.abs(u) - 0.55) < 0.05) cc = "#a0a0b0";
      else if ((v % 6) < 1.5 && Math.abs(u) < 0.85) cc = "#5a3e28";
    } else if (Math.abs(u) < 0.35) cc = mix("#20405a", c.sky[2], 0.15);
    return mix("#08060a", cc, Math.pow(d, 0.7));
  });
  // frames / arches from far to near
  for (let i = z.length - 1; i >= 0; i--) {
    const s = 1 / z[i], hw = 170 * s, top = vy - 120 * s, bot = vy + 90 * s, bw = Math.max(1, Math.round(9 * s));
    const dim = Math.min(1, 1.25 * s + 0.15);
    const tint = (col: string) => mix("#08060a", col, dim);
    if (mine) {
      const wd = "#8a6440";
      L.rect(vx - hw, top, bw, bot - top, tint(wd)); L.rect(vx + hw - bw, top, bw, bot - top, tint(hs(wd, -0.25)));
      L.rect(vx - hw - bw, top - bw, hw * 2 + bw * 2, bw + 1, tint(hs(wd, 0.1)));
      L.rect(vx - hw, top, 1, bot - top, tint(hs(wd, 0.3)));
      if (i < 4) for (let k = 0; k < 3; k++) L.line(vx - hw + bw, top + bw + k * 3 * s, vx - hw + bw + 10 * s, top + bw, tint(wd));
    } else {
      for (let a = Math.PI; a <= Math.PI * 2; a += 0.04) { const ax = vx + Math.cos(a) * hw, ay = top + hw * 0.6 + Math.sin(a) * hw * 0.6; L.rect(Math.round(ax) - bw / 2, Math.round(ay) - bw / 2, bw, bw, tint(hn(Math.round(a * 20), i) > 0.5 ? "#9a94a0" : "#8a8490")); }
      L.rect(vx - hw - bw / 2, top + hw * 0.6, bw, bot - top - hw * 0.6, tint("#8a8490")); L.rect(vx + hw - bw / 2, top + hw * 0.6, bw, bot - top - hw * 0.6, tint("#7a7480"));
    }
  }
  // the near side walls
  if (mine) { cart(L, r.chance(0.5) ? 18 : 250, 150, r); }
  else { for (let y = 0; y < H; y += 6) for (let x = 0; x < 26; x += 8) { L.rect(x + (y / 6 % 2) * 4, y, 7, 5, hs("#8a8490", (hn(x, y) - 0.5) * 0.2 - 0.2)); L.rect(W - 26 + x + (y / 6 % 2) * 4, y, 7, 5, hs("#8a8490", (hn(x, y, 2) - 0.5) * 0.2 - 0.3)); } }
  commit(c, L, 0);
  // lanterns on the nearer frames
  const lamps = [0, 1, 3].map((i) => { const s = 1 / z[i]; return { x: Math.round(vx + (i % 2 ? 1 : -1) * 170 * s * 0.8), y: Math.round(vy - 120 * s + 10 * s), s }; });
  c.warm += 0.08;
  anim(c, (g, t) => {
    for (const lp of lamps) {
      const f = flick(t, lp.x);
      addGlow(g, lp.x, lp.y + 3, 50 * lp.s + 10, "#ffa040", 0.35 * f);
      g.fillStyle = gc(c, IRON); g.fillRect(lp.x, lp.y - 3, 1, 3);
      g.fillStyle = "#ffd070"; g.fillRect(lp.x - 1, lp.y, Math.max(2, Math.round(4 * lp.s)), Math.max(2, Math.round(5 * lp.s))); g.fillStyle = "#fff4c0"; g.fillRect(lp.x, lp.y + 1, 1, Math.max(1, Math.round(2 * lp.s)));
    }
  });
  if (!mine) anim(c, (g, t) => { g.fillStyle = gc(c, "#6a90b0"); for (let y = vy + 6; y < H; y += 3) { const dz = y - vy, w = 0.35 * dz; const x = vx - w + ((t * 0.01 * (dz / 20)) % (w * 2)); g.globalAlpha = 0.5; g.fillRect(Math.round(x), y, Math.max(1, Math.round(dz / 20)), 1); } g.globalAlpha = 1; });
  anim(c, dripsFn(c, Array.from({ length: 5 }, (_, i) => ({ x: r.int(40, 280), y: r.int(10, 30), to: 140 + i * 6 }))));
  anim(c, motesFn(14, 40, 280, 50, 150, c.s.seed, "#ffe0a0", 0.4));
  c.front.push(fogFn(c, 120, 60, 0.4, 0.006, "#2a2830"));
  c.groundY = 158; c.slots = stdSlots(156, 2, [36, 80, 124, 196, 240, 284]);
}

// ------------------------------------------------------------ dungeon
function bDungeon(c: C) {
  const r = c.r; interiorSetup(c, 0.45);
  c.grade = mix(c.grade, "#8a88a0", 0.45);
  const stone = r.pick(["#6a6a78", "#7a7068", "#5e6470"]), floorY = 118, vx = 160, vy = 40;
  const L = lay(c);
  wallTex(L.p, 0, 0, W, floorY, stone, "stone", r.int(0, 99));
  for (let i = 0; i < 400; i++) { const x = r.int(0, W), y = r.int(0, floorY); if (r.chance(0.5)) L.px(x, y, r.chance(0.5) ? "#4a6a3a" : "#3a3a40"); }
  for (let x = 0; x < W; x++) if (hn(x, 3) > 0.92) { const len = r.int(5, 30); L.g.fillStyle = "rgba(20,30,20,0.25)"; L.g.fillRect(x, r.int(0, 40), 1, len); }
  perspFloor(L, floorY, vx, vy, (u, v, x, y) => {
    const a = Math.floor(u * 2.4 + (Math.floor(v * 0.7) % 2) * 0.5), b = Math.floor(v * 0.7);
    let cc = hs(stone, (hn(a, b, 4) - 0.5) * 0.25 - 0.1);
    if (Math.abs(u * 2.4 + (b % 2) * 0.5 - Math.round(u * 2.4 + (b % 2) * 0.5)) < 0.05 || Math.abs(v * 0.7 - Math.round(v * 0.7)) < 0.06) cc = hs(stone, -0.45);
    if (hn(x, y, 6) > 0.97) cc = "#4a5a3a";
    return cc;
  });
  L.rect(0, floorY - 2, W, 2, hs(stone, -0.5));
  // a cell: iron bars across part of the back wall, darkness behind
  const cx0 = r.chance(0.5) ? r.int(20, 50) : r.int(170, 200), cw = 100;
  L.rect(cx0, 30, cw, floorY - 30, "#0c0a10");
  for (let i = 0; i < 40; i++) L.px(cx0 + r.int(4, cw - 4), floorY - r.int(1, 6), r.pick(["#6a5a30", "#8a7a40", "#5a4a28"]));
  if (r.chance(0.6)) { const sx = cx0 + r.int(16, cw - 30); L.ellipse(sx, floorY - 12, 3, 3, "#5a5650"); L.rect(sx - 1, floorY - 9, 2, 6, "#4a4640"); L.line(sx - 6, floorY - 4, sx + 6, floorY - 2, "#4a4640"); L.px(sx - 1, floorY - 13, "#0c0a10"); L.px(sx + 1, floorY - 13, "#0c0a10"); }
  L.rect(cx0 - 2, 27, cw + 4, 3, "#3a3640"); L.rect(cx0 - 2, 27, cw + 4, 1, "#6a6670");
  for (let x = cx0 + 2; x < cx0 + cw; x += 6) { L.rect(x, 30, 2, floorY - 30, "#3a3640"); L.px(x, 30, "#7a7680"); L.rect(x, 30, 1, floorY - 30, "#5a5660"); }
  for (const y of [56, 92]) { L.rect(cx0, y, cw, 2, "#3a3640"); L.rect(cx0, y, cw, 1, "#6a6670"); }
  L.rect(cx0 + cw - 14, 70, 4, 6, "#8a7a40");
  // barred window high on the wall
  const wx = cx0 > 150 ? r.int(50, 90) : r.int(230, 270);
  roomWindow(c, L, wx, 16, 16, 12, { bars: true, frame: "#3a3640" });
  // bones & straw, a puddle
  for (let i = 0; i < 3; i++) { const bx = r.int(10, 310), by = r.int(124, 170); L.rect(bx, by, 6, 1, "#e0d8c8"); L.px(bx - 1, by - 1, "#e0d8c8"); L.px(bx - 1, by + 1, "#e0d8c8"); L.px(bx + 6, by - 1, "#e0d8c8"); L.px(bx + 6, by + 1, "#e0d8c8"); }
  for (let i = 0; i < 60; i++) L.px(r.int(0, W), r.int(120, 140), r.pick(["#8a7a40", "#6a5a30"]));
  const pud = r.int(60, 260); L.ellipse(pud, 150, 18, 2, "#1a2028"); L.span(pud - 10, pud + 4, 149, "#3a4a5a");
  commit(c, L, 0);
  const Lt = lay(c); torch(c, Lt, cx0 > 150 ? 130 : 190, 50); torch(c, Lt, cx0 > 150 ? 20 : 300, 50); commit(c, Lt, 0);
  anim(c, chainsFn(c, [{ x: cx0 > 150 ? 100 : 230, y: 30, len: 26 }, { x: cx0 > 150 ? 110 : 240, y: 30, len: 30 }]));
  anim(c, windowLight(c, wx, 16, 16, 12, floorY, (wx - 160) * 0.4));
  anim(c, dripsFn(c, [{ x: r.int(40, 280), y: 2, to: 150 }, { x: pud, y: 4, to: 150 }]));
  const rat = gc(c, "#4a4048");
  anim(c, (g, t) => { const per = 11000, a = (t % per) / per; if (a > 0.3) return; const k = Math.floor(t / per), dir = hn(k, 1) > 0.5 ? 1 : -1, x = Math.round(dir > 0 ? -10 + a / 0.3 * 340 : 330 - a / 0.3 * 340), y = 124 + Math.round(hn(k, 2) * 8); g.fillStyle = rat; g.fillRect(x, y - 2, 5, 2); g.fillRect(x + (dir > 0 ? 5 : -1), y - 2, 1, 1); g.fillRect(x - dir * 3 + (dir > 0 ? 0 : 5), y - 1, 3, 1); if (Math.floor(t / 60) % 2) { g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 3, y, 1, 1); } });
  c.front.push(fogFn(c, 130, 50, 0.4, 0.004, "#2a2a38"));
  c.groundY = 156; c.slots = stdSlots(154, 3);
}

// ------------------------------------------------------------ temple
function bTemple(c: C) {
  const r = c.r; interiorSetup(c, 0.7);
  const stone = r.pick(["#d8ccb4", "#c8c4c8", "#e0d4c0"]), floorY = 118, vx = 160, vy = 36;
  const L = lay(c);
  wallTex(L.p, 0, 0, W, floorY, stone, "stone", r.int(0, 99));
  L.g.fillStyle = "rgba(30,20,40,0.3)"; L.g.fillRect(0, 0, W, 12);
  // apse niche with a statue
  const nx = vx, nw = 50;
  for (let y = 10; y < floorY - 12; y++) for (let x = nx - nw / 2; x < nx + nw / 2; x++) { const dx = (x - nx) / (nw / 2), dy = (y - 36) / 26; if (y > 36 || dx * dx + dy * dy < 1) L.px(x, y, mix(hs(stone, -0.4), hs(stone, -0.2), Math.abs(dx))); }
  const sc = r.pick(["#e8e4dc", "#c8b070", "#9ab0a8"]);
  // the statue: robed figure, arms raised or holding a sword/orb
  L.rect(nx - 9, 96, 18, 10, hs(stone, 0.1)); L.rect(nx - 9, 96, 18, 1, hs(stone, 0.3));
  L.tex([[nx - 8, 96], [nx - 5, 58], [nx + 5, 58], [nx + 8, 96]], (px) => (px < nx - 2 ? hs(sc, 0.15) : px > nx + 3 ? hs(sc, -0.25) : sc));
  for (let y = 62; y < 96; y += 5) L.line(nx - 3 + (y % 2), y, nx - 1, y + 4, hs(sc, -0.2));
  L.ellipse(nx, 53, 4, 5, sc); L.px(nx - 2, 52, hs(sc, 0.3)); L.rect(nx - 4, 48, 8, 2, hs(sc, -0.1));
  const pose = r.int(0, 2);
  if (pose === 0) { L.line(nx - 5, 62, nx - 12, 44, sc); L.line(nx + 5, 62, nx + 12, 44, sc); }
  else if (pose === 1) { L.rect(nx - 1, 36, 2, 40, "#d8d8e8"); L.rect(nx - 4, 66, 8, 2, "#c8a040"); L.line(nx - 5, 64, nx - 1, 68, sc); L.line(nx + 5, 64, nx + 1, 68, sc); }
  else { L.line(nx - 5, 64, nx, 70, sc); L.line(nx + 5, 64, nx, 70, sc); L.ellipse(nx, 70, 3, 3, "#a8d8ff"); }
  // halo/rose window above
  const rw = 16, ry = 26;
  for (let y = ry - rw; y <= ry + rw; y++) for (let x = nx - rw; x <= nx + rw; x++) {
    const dx = x - nx, dy = y - ry, d = Math.hypot(dx, dy);
    if (d > rw) continue;
    const ang = Math.atan2(dy, dx), seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12), ring = d < 5 ? 0 : d < 11 ? 1 : 2;
    let cc = ["#e8c040", "#c83a4a", "#3a6ad8", "#4aa060", "#8a4ac8", "#e8803a"][(seg + ring * 2) % 6];
    if (d > rw - 1.5 || Math.abs(d - 5) < 0.6 || Math.abs(d - 11) < 0.6 || (ring > 0 && Math.abs(((ang + Math.PI) / (Math.PI * 2)) * 12 - Math.round(((ang + Math.PI) / (Math.PI * 2)) * 12)) < 0.08)) cc = "#2a2228";
    L.px(x, y, cc);
  }
  // tall stained lancets either side
  const lancets = [56, 264];
  for (const lx of lancets) roomWindow(c, L, lx - 7, 20, 14, 48, { arch: true, stained: true, frame: hs(stone, -0.3) });
  // floor: tiles with a mosaic runner
  const t1 = hs(stone, -0.05), t2 = hs(stone, -0.2), run = r.pick(["#8a3a3a", "#3a5a8a", "#6a4a8a"]);
  perspFloor(L, floorY, vx, vy, (u, v, x, y) => {
    const a = Math.floor(u * 4), b = Math.floor(v * 1.1);
    let cc = (a + b) % 2 ? t1 : t2;
    if (Math.abs(u * 4 - Math.round(u * 4)) < 0.05 || Math.abs(v * 1.1 - Math.round(v * 1.1)) < 0.06) cc = hs(stone, -0.35);
    if (Math.abs(u) < 0.4) { cc = Math.abs(u) > 0.34 ? "#c8a040" : (Math.floor(u * 10) + b) % 2 ? run : hs(run, 0.2); }
    if (hn(x, y, 4) > 0.985) cc = hs(cc, 0.25);
    return cc;
  });
  // altar on steps
  for (let k = 0; k < 3; k++) { const w = 90 - k * 18, y = floorY - k * 4; L.rect(vx - w / 2, y - 4, w, 4, hs(stone, 0.1 - k * 0.05)); L.rect(vx - w / 2, y - 4, w, 1, hs(stone, 0.35)); }
  const ay = floorY - 12;
  L.rect(vx - 22, ay - 14, 44, 14, hs(stone, 0.05)); L.rect(vx - 24, ay - 16, 48, 3, hs(stone, 0.25)); L.rect(vx - 24, ay - 16, 48, 1, hs(stone, 0.45));
  L.rect(vx - 14, ay - 13, 28, 13, run); L.rect(vx - 14, ay - 13, 28, 1, "#e8c050"); L.rect(vx - 2, ay - 10, 4, 8, "#e8c050"); L.rect(vx - 4, ay - 8, 8, 2, "#e8c050");
  L.rect(vx - 6, ay - 20, 12, 4, "#c8a040"); L.ellipse(vx, ay - 21, 5, 1, "#e8d080");
  // pillars
  for (const px of [12, 96, 224, 308]) column(L, px - 6, 4, floorY + (px < 20 || px > 300 ? 50 : 0), 12, hs(stone, 0.04), { s: px });
  commit(c, L, 0);
  // candles on the altar, braziers, incense
  const Lc = lay(c);
  for (let k = -3; k <= 3; k++) if (k !== 0) candle(c, Lc, vx + k * 6 - 1, ay - 16, 4 + (Math.abs(k) % 2) * 2);
  for (const bx of [70, 250]) { Lc.rect(bx - 1, floorY + 4, 3, 16, "#5a4a3a"); Lc.rect(bx - 5, floorY + 18, 11, 2, "#5a4a3a"); Lc.ellipse(bx, floorY + 3, 7, 2, "#8a6a3a"); Lc.rect(bx - 7, floorY + 1, 15, 2, "#a8803a"); }
  commit(c, Lc, 0);
  c.warm += 0.08;
  anim(c, (g, t) => {
    for (const bx of [70, 250]) { const f = flick(t, bx); addGlow(g, bx, floorY - 4, 46, "#ff9a3a", 0.35 * f); flame(g, bx - 2, floorY + 1, 5, t, bx); flame(g, bx + 2, floorY + 1, 4.5, t, bx + 2); embers(g, bx, floorY - 6, 6, 30, t, bx); }
    smoke(g, vx, ay - 22, t, { col: "#e8e0f0", a: 0.35, rise: 60, n: 9, per: 6000, wind: 0.1, size: 1.2 });
  });
  const shCols = ["#ff7080", "#70a0ff", "#ffd060", "#a080ff"];
  lancets.forEach((lx, i) => anim(c, windowLight(c, lx - 7, 20, 14, 48, floorY, (lx - 160) * 0.3, shCols[(i * 2 + r.int(0, 1)) % 4])));
  anim(c, windowLight(c, nx - 10, 14, 20, 20, floorY, 0, "#ffe8a0"));
  anim(c, motesFn(30, 30, 290, 20, 140, c.s.seed, "#fff0c0", 0.7));
  c.groundY = 156; c.slots = stdSlots(154, 3, [36, 80, 120, 200, 240, 284]);
}

const BUILD: Record<Bg, Builder> = {
  forest: bForest, hill: bHill, road: bRoad, river: bRiver, lake: bLake, field: bField, village: bVillage, town: bTown, city: bCity,
  castle: bCastle, hall: bHall, ruins: bRuins, cave: bCave, tunnel: bTunnel, swamp: bSwamp, mountain: bMountain, bridge: bBridge,
  camp: bCamp, inn: bInn, ship: bShip, sea: bSea, coast: bCoast, desert: bDesert, temple: bTemple, dungeon: bDungeon, sky: bSky,
};
