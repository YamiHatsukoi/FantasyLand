/**
 * Battle effects for Adventure: a small particle and effect library drawn straight onto the
 * 320x180 stage buffer, pixel-crisp (every mark is a whole art pixel, no smoothing).
 *
 * An FxLayer owns its own clock: the battle advances it (scaled for fast mode, frozen during
 * hit-stop) and draws it in three layers: "under" (ground marks, behind the fighters),
 * "over" (trails, sparks, bolts, particles) and "screen" (flashes, numbers, words).
 *
 * Effects: weapon trails (slash, thrust, whirl), rings and ground shock, sparks, debris, dust,
 * blood / ichor, wisps (with drain paths), claw marks, bites, projectiles (arrow, orb, bolt),
 * psychic waves, lightning, magic glyph circles, charge-up, impact stars, flashes, pop-up
 * damage numbers (bitmap digits) and words.
 */

export type Layer = "under" | "over" | "screen";
type G = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const R = Math.round;
const rad = (d: number) => (d * Math.PI) / 180;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/** Easing curves (k in 0..1). */
export const ease = {
  linear: (k: number) => k,
  inQuad: (k: number) => k * k,
  inCubic: (k: number) => k * k * k,
  outQuad: (k: number) => 1 - (1 - k) * (1 - k),
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  outQuart: (k: number) => 1 - (1 - k) ** 4,
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutQuad: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; },
  inBack: (k: number) => { const c1 = 1.7, c3 = c1 + 1; return c3 * k * k * k - c1 * k * k; },
  outElastic: (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export type Ease = (k: number) => number;

// ------------------------------------------------------------------ pixel primitives

export function dot(g: G, x: number, y: number, c: string, s = 1) {
  g.fillStyle = c;
  g.fillRect(R(x), R(y), s, s);
}

/** A 1px (or w px) line stepped pixel by pixel. */
export function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  g.fillStyle = c;
  const o = Math.floor(w / 2);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    g.fillRect(R(x0 + (x1 - x0) * k) - o, R(y0 + (y1 - y0) * k) - o, w, w);
  }
}

/** Ring (or flattened ellipse) of pixels. */
export function ring(g: G, cx: number, cy: number, r: number, c: string, ry = r, w = 1) {
  if (r < 0.5) { dot(g, cx, cy, c, w); return; }
  const n = Math.max(8, Math.ceil(TAU * Math.max(r, ry) * 1.15));
  g.fillStyle = c;
  const o = Math.floor(w / 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.fillRect(R(cx + Math.cos(a) * r) - o, R(cy + Math.sin(a) * ry) - o, w, w);
  }
}

/** Filled disc (or ellipse) by scanlines. */
export function disc(g: G, cx: number, cy: number, r: number, c: string, ry = r) {
  g.fillStyle = c;
  const rr = Math.max(0.5, r), yy = Math.max(0.5, ry);
  for (let dy = -Math.floor(yy); dy <= Math.floor(yy); dy++) {
    const half = Math.floor(rr * Math.sqrt(Math.max(0, 1 - (dy * dy) / (yy * yy))));
    g.fillRect(R(cx) - half, R(cy) + dy, half * 2 + 1, 1);
  }
}

// ------------------------------------------------------------------ bitmap digits

const DIGITS: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "-": [".....", ".....", ".....", "####.", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
};

const numCache = new Map<string, HTMLCanvasElement>();
/** A number drawn with bold bitmap digits: vertical gradient [top, mid, bottom], dark outline, drop shadow. */
export function digitsSprite(text: string, s: number, grad: [string, string, string], outline = "#1a0805"): HTMLCanvasElement {
  const key = `${text}|${s}|${grad.join()}|${outline}`;
  const hit = numCache.get(key);
  if (hit) return hit;
  const chars = [...text].filter((ch) => DIGITS[ch]);
  const cw = chars.reduce((a, ch) => a + (ch === "1" || ch === "!" ? 4 : ch === "-" ? 5 : 6), 0);
  const w = cw * s + 2 + s, h = 7 * s + 3 + s;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  // glyph mask (bold: each pixel widened by one art pixel at scale>1)
  const mask = new Uint8Array(w * h);
  let ox = 1;
  for (const ch of chars) {
    const rows = DIGITS[ch];
    const skip = ch === "1" || ch === "!" ? 1 : 0;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      if (rows[y][x] !== "#") continue;
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s + (s > 1 ? 1 : 0); xx++) {
        const px = ox + (x - skip) * s + xx, py = 1 + y * s + yy;
        if (px >= 0 && px < w && py < h) mask[py * w + px] = 1;
      }
    }
    ox += (ch === "1" || ch === "!" ? 4 : ch === "-" ? 5 : 6) * s;
  }
  const img = g.createImageData(w, h);
  const rgb = (c0: string) => { const n = parseInt(c0.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [t0, m0, b0, o0] = [...grad, outline].map(rgb);
  const set = (x: number, y: number, col: number[]) => { const i = (y * w + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; };
  const top = 1, bot = 1 + 7 * s;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask[y * w + x]) {
      const k = (y - top) / (bot - top);
      set(x, y, k < 0.3 ? t0 : k < 0.72 ? m0 : b0);
    } else {
      // outline: any neighbour (8-way) set, or shadow: pixel above-left set
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) { near = true; break; }
      }
      const shadow = !near && y - s >= 0 && x - 1 >= 0 && mask[(y - s) * w + x - 1] === 1 && y > 1;
      if (near || shadow) set(x, y, o0);
    }
  }
  g.putImageData(img, 0, 0);
  numCache.set(key, c);
  return c;
}

const textCache = new Map<string, HTMLCanvasElement>();
/** A word in the game's pixel font, thresholded to hard pixels, with a dark outline. */
export function wordSprite(text: string, size: number, col: string, outline = "#140805"): HTMLCanvasElement {
  const key = `${text}|${size}|${col}|${outline}|${document.fonts?.check?.(`${size}px VT323`) ? 1 : 0}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const m = document.createElement("canvas").getContext("2d")!;
  m.font = `${size}px VT323, monospace`;
  const tw = Math.ceil(m.measureText(text).width);
  const w = tw + 4, h = Math.ceil(size * 1.25) + 4;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.font = `${size}px VT323, monospace`;
  g.textBaseline = "top";
  g.fillStyle = "#fff";
  g.fillText(text, 2, 2);
  const src = g.getImageData(0, 0, w, h);
  const out = g.createImageData(w, h);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src.data[(y * w + x) * 4 + 3] > 110;
  const rgb = (c0: string) => { const n = parseInt(c0.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const fc = rgb(col), oc = rgb(outline), hi = fc.map((v) => Math.min(255, v + 60));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let col0: number[] | null = null;
    if (on(x, y)) col0 = on(x, y - 1) ? fc : hi;
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)) col0 = oc;
    if (col0) { out.data[i] = col0[0]; out.data[i + 1] = col0[1]; out.data[i + 2] = col0[2]; out.data[i + 3] = 255; }
  }
  g.clearRect(0, 0, w, h);
  g.putImageData(out, 0, 0);
  textCache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ particles

type Kind = "px" | "spark" | "debris" | "smoke" | "drop" | "star" | "ember" | "wisp";
interface Part {
  kind: Kind;
  x: number; y: number; vx: number; vy: number;
  /** gravity (px/ms²), drag per ms (0..1) */
  g: number; drag: number;
  life: number; max: number;
  size: number;
  col: string; col2?: string;
  glow?: boolean;
  /** Ground line where debris bounces and drops splat. */
  floor?: number;
  bounced?: number;
  seed: number;
}

interface Effect { t0: number; dur: number; layer: Layer; draw: (g: G, k: number, age: number) => void; done?: () => void }

export interface SparkOpts { n?: number; dir?: number; spread?: number; speed?: number; col?: string; col2?: string; life?: number; g?: number; glow?: boolean }

export class FxLayer {
  t = 0;
  private parts: Part[] = [];
  private fx: Effect[] = [];
  /** Screen shake request (art px amplitude, until time) read by the battle. */
  shakeAmp = 0;
  shakeUntil = 0;

  constructor(public groundY: number, public maxParts = 520) {}

  /** Advances the effect clock and the particle simulation by dt (ms). */
  step(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    const f = dt / 16.67;
    for (const p of this.parts) {
      p.life += dt;
      const d = (1 - p.drag) ** f;
      p.vx *= d; p.vy *= d;
      p.vy += p.g * dt;
      p.x += p.vx * f; p.y += p.vy * f;
      if (p.floor !== undefined && p.y >= p.floor) {
        if (p.kind === "debris" && (p.bounced ?? 0) < 2 && Math.abs(p.vy) > 0.35) {
          p.y = p.floor; p.vy *= -0.38; p.vx *= 0.6; p.bounced = (p.bounced ?? 0) + 1;
        } else if (p.kind === "drop") {
          // splat: becomes a short-lived flat mark on the ground
          p.y = p.floor; p.vx = 0; p.vy = 0; p.g = 0; p.kind = "px"; p.size = 2; p.max = Math.min(p.max, p.life + 500);
        } else { p.y = p.floor; p.vy = 0; p.vx *= 0.7; }
      }
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    const live: Effect[] = [];
    for (const e of this.fx) {
      if (this.t - e.t0 >= e.dur) e.done?.();
      else live.push(e);
    }
    this.fx = live;
  }

  clear() { this.parts = []; this.fx = []; }

  shake(amp: number, ms: number) {
    if (amp >= this.shakeAmp || this.t > this.shakeUntil) this.shakeAmp = amp;
    this.shakeUntil = Math.max(this.shakeUntil, this.t + ms);
  }
  /** Current shake offset (whole pixels). */
  shakeOffset(): [number, number] {
    if (this.t >= this.shakeUntil) return [0, 0];
    const left = (this.shakeUntil - this.t) / 260;
    const a = this.shakeAmp * Math.min(1, left + 0.25);
    return [R((Math.random() - 0.5) * 2 * a), R((Math.random() - 0.5) * 1.5 * a)];
  }

  /** Adds a timed effect; resolves when it ends. */
  add(dur: number, draw: Effect["draw"], layer: Layer = "over"): Promise<void> {
    return new Promise((res) => this.fx.push({ t0: this.t, dur, layer, draw, done: res }));
  }

  private push(p: Omit<Part, "life" | "seed"> & { life?: number }) {
    if (this.parts.length >= this.maxParts) this.parts.splice(0, this.parts.length - this.maxParts + 1);
    this.parts.push({ life: 0, seed: Math.random(), ...p });
  }

  draw(g: G, layer: Layer) {
    for (const e of this.fx) if (e.layer === layer) {
      const age = this.t - e.t0;
      e.draw(g, clamp01(age / e.dur), age);
    }
    if (layer === "over") this.drawParts(g);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  private drawParts(g: G) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      const a = p.kind === "smoke" ? (1 - k) * 0.55 : 1 - k * k;
      g.globalAlpha = Math.max(0, a);
      g.globalCompositeOperation = p.glow ? "lighter" : "source-over";
      const x = R(p.x), y = R(p.y);
      switch (p.kind) {
        case "spark": {
          // a streak along the velocity: bright head, coloured tail
          const sp = Math.hypot(p.vx, p.vy);
          const n = Math.min(5, Math.max(1, R(sp * 1.4)));
          g.fillStyle = p.col2 ?? p.col;
          for (let i = 1; i <= n; i++) g.fillRect(R(p.x - (p.vx / (sp || 1)) * i), R(p.y - (p.vy / (sp || 1)) * i), 1, 1);
          g.fillStyle = k < 0.5 ? "#ffffff" : p.col;
          g.fillRect(x, y, 1, 1);
          break;
        }
        case "smoke": {
          const r = p.size * (0.6 + k * 1.1);
          // dithered puff: a disc with holes for a soft-but-crisp look
          g.fillStyle = p.col;
          const rr = Math.ceil(r);
          for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            if (k > 0.45 && ((x + dx + y + dy) & 1)) continue;
            g.fillRect(x + dx, y + dy, 1, 1);
          }
          break;
        }
        case "star": {
          const s = k < 0.5 ? 2 : 1;
          g.fillStyle = p.col;
          g.fillRect(x - s, y, s * 2 + 1, 1);
          g.fillRect(x, y - s, 1, s * 2 + 1);
          g.fillStyle = "#fff";
          g.fillRect(x, y, 1, 1);
          break;
        }
        case "wisp": {
          const wob = Math.sin(p.life / 90 + p.seed * 9) * 1.5;
          g.fillStyle = p.col;
          g.fillRect(R(p.x + wob), y, p.size, p.size);
          g.globalAlpha *= 0.6;
          g.fillStyle = p.col2 ?? p.col;
          g.fillRect(R(p.x + wob * 0.5), y + p.size, 1, 2);
          break;
        }
        case "debris": {
          g.fillStyle = p.col;
          g.fillRect(x, y, p.size, p.size);
          if (p.size > 1 && p.col2) { g.fillStyle = p.col2; g.fillRect(x, y, p.size - 1, 1); }
          break;
        }
        default:
          g.fillStyle = p.col;
          g.fillRect(x, y, p.size, p.kind === "drop" && Math.abs(p.vy) > 1 ? p.size + 1 : p.size);
      }
    }
  }

  // ------------------------------------------------------------------ particle emitters

  /** Hot sparks flying out (metal on metal, impacts). dir in degrees (0 = right, 90 = down). */
  sparks(x: number, y: number, o: SparkOpts = {}) {
    const n = o.n ?? 10, sp = o.speed ?? 2.4, spread = o.spread ?? 360;
    for (let i = 0; i < n; i++) {
      const a = rad((o.dir ?? 0) + (Math.random() - 0.5) * spread);
      const v = sp * rnd(0.35, 1);
      this.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 0.0009, drag: 0.06, max: (o.life ?? 320) * rnd(0.6, 1.2), size: 1, col: o.col ?? "#ffc84a", col2: o.col2 ?? "#ff7a1a", glow: o.glow ?? true, floor: this.groundY + 4 });
    }
  }

  /** Generic pixel burst. */
  burst(x: number, y: number, o: SparkOpts & { size?: number } = {}) {
    const n = o.n ?? 12, sp = o.speed ?? 1.4, spread = o.spread ?? 360;
    for (let i = 0; i < n; i++) {
      const a = rad((o.dir ?? 0) + (Math.random() - 0.5) * spread), v = sp * rnd(0.2, 1);
      this.push({ kind: "px", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 0.002, drag: 0.04, max: (o.life ?? 480) * rnd(0.6, 1.2), size: o.size ?? (Math.random() < 0.3 ? 2 : 1), col: o.col ?? "#fff", glow: o.glow });
    }
  }

  /** Twinkling stars (victory, magic). */
  stars(x: number, y: number, o: SparkOpts & { w?: number; h?: number } = {}) {
    for (let i = 0; i < (o.n ?? 8); i++) {
      this.push({ kind: "star", x: x + rnd(-(o.w ?? 10), o.w ?? 10), y: y + rnd(-(o.h ?? 10), o.h ?? 10), vx: rnd(-0.2, 0.2), vy: -(o.speed ?? 0.5) * rnd(0.4, 1), g: o.g ?? 0, drag: 0.02, max: (o.life ?? 900) * rnd(0.6, 1.2), size: 1, col: o.col ?? "#ffe07a", glow: true });
    }
  }

  /** Embers rising (fire, golden victory). */
  embers(x: number, y: number, o: SparkOpts & { w?: number } = {}) {
    for (let i = 0; i < (o.n ?? 10); i++) {
      this.push({ kind: "ember", x: x + rnd(-(o.w ?? 8), o.w ?? 8), y: y + rnd(-3, 3), vx: rnd(-0.25, 0.25), vy: -(o.speed ?? 0.7) * rnd(0.4, 1), g: -0.0004, drag: 0.01, max: (o.life ?? 1000) * rnd(0.5, 1.2), size: Math.random() < 0.25 ? 2 : 1, col: o.col ?? "#ffb040", glow: true });
    }
  }

  /** Rock / wood / bone chunks thrown up, bouncing on the ground. */
  debris(x: number, y: number, o: { n?: number; cols?: string[]; dir?: number; spread?: number; speed?: number; up?: number } = {}) {
    const cols = o.cols ?? ["#6a5a48", "#8a7860", "#4a3e32"];
    for (let i = 0; i < (o.n ?? 10); i++) {
      const a = rad((o.dir ?? -90) + (Math.random() - 0.5) * (o.spread ?? 120)), v = (o.speed ?? 2.4) * rnd(0.35, 1);
      const c = cols[i % cols.length];
      this.push({ kind: "debris", x: x + rnd(-3, 3), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ?? 0), g: 0.0075, drag: 0.01, max: rnd(700, 1100), size: Math.random() < 0.4 ? 2 : 1, col: c, col2: "#b0a088", floor: this.groundY + R(rnd(-1, 3)) });
    }
  }

  /** Dust clouds rolling along the ground. dir: +1 right, -1 left, 0 both ways. */
  dust(x: number, y: number, o: { n?: number; dir?: number; col?: string; speed?: number; size?: number; life?: number } = {}) {
    for (let i = 0; i < (o.n ?? 6); i++) {
      const d = o.dir === undefined || o.dir === 0 ? (Math.random() < 0.5 ? -1 : 1) : o.dir;
      this.push({ kind: "smoke", x: x + rnd(-3, 3), y: y - rnd(0, 3), vx: d * (o.speed ?? 0.9) * rnd(0.3, 1), vy: -rnd(0.05, 0.3), g: 0, drag: 0.05, max: (o.life ?? 560) * rnd(0.7, 1.2), size: (o.size ?? 2.5) * rnd(0.7, 1.2), col: o.col ?? "#c8b898" });
    }
  }

  /** Smoke puffs (dark magic, death). */
  smoke(x: number, y: number, o: { n?: number; col?: string; w?: number; h?: number; rise?: number; size?: number; life?: number } = {}) {
    for (let i = 0; i < (o.n ?? 8); i++) {
      this.push({ kind: "smoke", x: x + rnd(-(o.w ?? 6), o.w ?? 6), y: y + rnd(-(o.h ?? 6), o.h ?? 6), vx: rnd(-0.2, 0.2), vy: -(o.rise ?? 0.35) * rnd(0.4, 1), g: 0, drag: 0.02, max: (o.life ?? 800) * rnd(0.7, 1.2), size: (o.size ?? 2.5) * rnd(0.7, 1.3), col: o.col ?? "#3a2a4a" });
    }
  }

  /** Blood or ichor spraying in a direction (+1 right / -1 left) and splatting on the ground. */
  blood(x: number, y: number, o: { dir: number; n?: number; col?: string; col2?: string; speed?: number }) {
    for (let i = 0; i < (o.n ?? 10); i++) {
      const a = rad((o.dir > 0 ? -25 : 205) + rnd(-35, 30)), v = (o.speed ?? 2) * rnd(0.3, 1);
      this.push({ kind: "drop", x: x + rnd(-2, 2), y: y + rnd(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.006, drag: 0.02, max: rnd(650, 1000), size: Math.random() < 0.35 ? 2 : 1, col: i % 3 === 0 && o.col2 ? o.col2 : o.col ?? "#b81e1a", floor: this.groundY + R(rnd(-2, 3)) });
    }
  }

  /** Floating wisps (souls, dark magic) drifting up. */
  wisps(x: number, y: number, o: { n?: number; col?: string; col2?: string; w?: number; h?: number; rise?: number; life?: number } = {}) {
    for (let i = 0; i < (o.n ?? 8); i++) {
      this.push({ kind: "wisp", x: x + rnd(-(o.w ?? 6), o.w ?? 6), y: y + rnd(-(o.h ?? 8), o.h ?? 8), vx: rnd(-0.15, 0.15), vy: -(o.rise ?? 0.5) * rnd(0.4, 1), g: 0, drag: 0.01, max: (o.life ?? 900) * rnd(0.6, 1.2), size: Math.random() < 0.4 ? 2 : 1, col: o.col ?? "#7a4ab8", col2: o.col2 ?? "#2a1a3a", glow: false });
    }
  }

  // ------------------------------------------------------------------ shaped effects

  /**
   * A crescent weapon trail sweeping from angle a0 to a1 (degrees, 0 = right, 90 = down),
   * mirrored when dir = -1. ry < 1 flattens it.
   */
  slash(x: number, y: number, o: { r: number; a0: number; a1: number; dir?: number; col?: string; edge?: string; thick?: number; dur?: number; ry?: number; glow?: boolean }) {
    const dir = o.dir ?? 1, dur = o.dur ?? 190, th = o.thick ?? 4, ry = o.ry ?? 1;
    const col = o.col ?? "#cfe6ff", edge = o.edge ?? "#ffffff";
    return this.add(dur, (g, k) => {
      const head = ease.outCubic(clamp01(k * 1.7));
      const tail = ease.outCubic(clamp01(k * 1.7 - 0.5));
      const ah = o.a0 + (o.a1 - o.a0) * head, at = o.a0 + (o.a1 - o.a0) * tail;
      const span = ah - at;
      if (Math.abs(span) < 0.5) return;
      const steps = Math.ceil((Math.abs(span) * Math.PI / 180) * o.r * 1.6) + 2;
      const fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1;
      g.globalCompositeOperation = o.glow === false ? "source-over" : "lighter";
      for (let i = 0; i <= steps; i++) {
        const u = i / steps; // 0 at tail, 1 at head
        const a = rad(at + span * u);
        const w = Math.max(1, R(th * Math.sin(u * Math.PI * 0.92 + 0.08)));
        const cx = Math.cos(a), cy = Math.sin(a);
        for (let j = 0; j < w; j++) {
          const rr = o.r - j;
          const px = x + dir * cx * rr, py = y + cy * rr * ry;
          g.globalAlpha = fade * (j === 0 ? 1 : 0.85 - j * 0.12) * (0.35 + u * 0.65);
          g.fillStyle = j === 0 && u > 0.25 ? edge : col;
          g.fillRect(R(px), R(py), 1, 1);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    });
  }

  /** A straight piercing streak from x0 to x1 at height y (spear, dagger, fist). */
  thrust(x0: number, y: number, x1: number, o: { col?: string; dur?: number; w?: number } = {}) {
    const dur = o.dur ?? 160, col = o.col ?? "#e8f4ff";
    return this.add(dur, (g, k) => {
      const head = ease.outExpo(clamp01(k * 2));
      const tail = ease.inQuad(k);
      const xa = x0 + (x1 - x0) * tail, xb = x0 + (x1 - x0) * head;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 1 - k * 0.6;
      line(g, xa, y, xb, y, col, o.w ?? 1);
      g.globalAlpha = (1 - k) * 0.5;
      line(g, xa, y - 1, xb, y - 1, col);
      line(g, xa, y + 1, xb, y + 1, col);
      // diamond glint at the tip
      if (k < 0.7) { const s = R(3 * (1 - k)) + 1; g.globalAlpha = 1; line(g, xb - s, y, xb + s, y, "#fff"); line(g, xb, y - s, xb, y + s, "#fff"); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /** Horizontal speed lines streaming past a rectangle (dir = way of travel). */
  speedLines(x: number, y: number, w: number, h: number, dir: number, o: { n?: number; dur?: number; col?: string } = {}) {
    const lines = Array.from({ length: o.n ?? 9 }, () => ({ y: R(rnd(0, h)), len: R(rnd(6, 18)), off: rnd(0, 1), sp: rnd(0.8, 1.6) }));
    return this.add(o.dur ?? 220, (g, k) => {
      g.globalAlpha = 0.75 * (1 - k);
      for (const l of lines) {
        const p = (l.off + k * l.sp) % 1;
        const lx = dir > 0 ? x + w - p * (w + l.len) : x + p * (w + l.len) - l.len;
        line(g, lx, y + l.y, lx + l.len, y + l.y, o.col ?? "#ffffff");
      }
      g.globalAlpha = 1;
    });
  }

  /** Expanding ring (shockwave, impact, landing). */
  ring(x: number, y: number, o: { r0?: number; r1: number; dur?: number; col?: string; ry?: number; w?: number; layer?: Layer; glow?: boolean; e?: Ease }) {
    const e = o.e ?? ease.outCubic;
    return this.add(o.dur ?? 300, (g, k) => {
      const r = (o.r0 ?? 2) + (o.r1 - (o.r0 ?? 2)) * e(k);
      g.globalAlpha = 1 - k;
      if (o.glow) g.globalCompositeOperation = "lighter";
      ring(g, x, y, r, o.col ?? "#fff", r * (o.ry ?? 1), k < 0.4 ? o.w ?? 2 : 1);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }, o.layer ?? "over");
  }

  /** Ground shock: flattened rings, cracks, debris and dust (overhead smashes, big stomps). */
  shock(x: number, y: number, o: { r?: number; cols?: string[]; dust?: string; n?: number } = {}) {
    const r = o.r ?? 22;
    this.ring(x, y, { r0: 3, r1: r, ry: 0.28, dur: 380, col: "#fff4d8", w: 2, layer: "under" });
    this.ring(x, y, { r0: 2, r1: r * 0.6, ry: 0.28, dur: 300, col: "#ffd890", w: 1, layer: "under" });
    const cracks = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI + rnd(-0.2, 0.2);
      const pts: [number, number][] = [[x, y]];
      let cx = x, cy = y;
      for (let s = 0; s < 4; s++) { cx += Math.cos(a) * rnd(2, 4) * (i % 2 ? 1 : -1) + rnd(-1, 1); cy += rnd(-0.6, 0.8); pts.push([cx, cy]); }
      return pts;
    });
    this.add(700, (g, k) => {
      g.globalAlpha = (1 - k) * 0.9;
      for (const pts of cracks) for (let i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], "#2a1e14");
      g.globalAlpha = 1;
    }, "under");
    this.debris(x, y - 1, { n: o.n ?? 14, cols: o.cols, speed: 2.8, spread: 110 });
    this.dust(x, y, { n: 10, dir: 0, col: o.dust ?? "#c8b898", speed: 1.4, size: 3 });
  }

  /** A star-shaped impact flash (the "hit spark" of fighting games). */
  impact(x: number, y: number, o: { r?: number; col?: string; dur?: number; rays?: number } = {}) {
    const r = o.r ?? 9, col = o.col ?? "#fff3c0", n = o.rays ?? 8;
    const rays = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + rnd(-0.25, 0.25), l: r * (i % 2 ? 0.55 : 1) * rnd(0.8, 1.15) }));
    return this.add(o.dur ?? 150, (g, k) => {
      g.globalCompositeOperation = "lighter";
      const s = k < 0.35 ? ease.outQuad(k / 0.35) : 1;
      g.globalAlpha = 1 - ease.inQuad(k);
      for (const ray of rays) {
        const l = ray.l * s;
        line(g, x + Math.cos(ray.a) * l * 0.25, y + Math.sin(ray.a) * l * 0.25, x + Math.cos(ray.a) * l, y + Math.sin(ray.a) * l, col);
      }
      disc(g, x, y, Math.max(1, R((r * 0.38) * (1 - k))), "#ffffff");
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /** Parallel claw marks raking diagonally. */
  claw(x: number, y: number, o: { n?: number; dir?: number; col?: string; len?: number; dur?: number } = {}) {
    const n = o.n ?? 3, dir = o.dir ?? 1, len = o.len ?? 16, col = o.col ?? "#ff4a3a";
    return this.add(o.dur ?? 260, (g, k) => {
      for (let i = 0; i < n; i++) {
        const st = i * 0.12, kk = clamp01((k - st) / 0.35);
        if (kk <= 0) continue;
        const ox = (i - (n - 1) / 2) * 4;
        const x0 = x + ox - dir * len * 0.45, y0 = y - len * 0.5, x1 = x + ox + dir * len * 0.45, y1 = y + len * 0.5;
        const xe = x0 + (x1 - x0) * ease.outCubic(kk), ye = y0 + (y1 - y0) * ease.outCubic(kk);
        const fade = 1 - clamp01((k - 0.55) / 0.45);
        g.globalAlpha = fade;
        line(g, x0 + dir, y0, xe + dir, ye, col);
        line(g, x0, y0, xe, ye, "#ffffff");
      }
      g.globalAlpha = 1;
    });
  }

  /** Jaws snapping shut (bites). */
  bite(x: number, y: number, o: { col?: string; size?: number; dur?: number } = {}) {
    const s = o.size ?? 10, col = o.col ?? "#fff8e8";
    return this.add(o.dur ?? 240, (g, k) => {
      const close = ease.inCubic(clamp01(k / 0.45));
      const gap = R(s * (1 - close)) + 1;
      g.globalAlpha = 1 - clamp01((k - 0.6) / 0.4);
      for (let i = -2; i <= 2; i++) {
        const tx = x + i * 3;
        // upper teeth point down, lower teeth point up
        line(g, tx - 1, y - gap - 2, tx, y - gap + 1, col); line(g, tx + 1, y - gap - 2, tx, y - gap + 1, col);
        line(g, tx - 1, y + gap + 2, tx, y + gap - 1, col); line(g, tx + 1, y + gap + 2, tx, y + gap - 1, col);
      }
      line(g, x - 8, y - gap - 3, x + 8, y - gap - 3, "#c83a2a");
      line(g, x - 8, y + gap + 3, x + 8, y + gap + 3, "#c83a2a");
      g.globalAlpha = 1;
    });
  }

  /** Whirling rings around a point (quarterstaff spin). */
  whirl(x: number, y: number, o: { r?: number; dur?: number; col?: string; turns?: number } = {}) {
    const r = o.r ?? 14, turns = o.turns ?? 2;
    return this.add(o.dur ?? 380, (g, k) => {
      const a0 = k * turns * TAU;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) {
        const u = i / 26;
        const a = a0 - u * 2.4;
        g.globalAlpha = (1 - u) * (1 - k * 0.5);
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.45;
        dot(g, px, py, u < 0.15 ? "#ffffff" : o.col ?? "#e8d0a0");
        dot(g, x - Math.cos(a) * r, y - Math.sin(a) * r * 0.45, u < 0.15 ? "#ffffff" : o.col ?? "#e8d0a0");
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /** Jagged lightning / dark bolt between two points, re-jagged every few frames. */
  bolt(x0: number, y0: number, x1: number, y1: number, o: { col?: string; core?: string; dur?: number; jag?: number; w?: number } = {}) {
    const jag = o.jag ?? 4;
    let pts: [number, number][] = [], at = -1;
    return this.add(o.dur ?? 220, (g, k, age) => {
      if (at < 0 || age - at > 45) {
        at = age;
        const n = Math.max(4, R(Math.hypot(x1 - x0, y1 - y0) / 7));
        pts = Array.from({ length: n + 1 }, (_, i) => {
          const u = i / n, e = i === 0 || i === n ? 0 : 1;
          return [x0 + (x1 - x0) * u + rnd(-1, 1) * e, y0 + (y1 - y0) * u + rnd(-jag, jag) * e] as [number, number];
        });
      }
      g.globalAlpha = 1 - ease.inQuad(k);
      g.globalCompositeOperation = "lighter";
      for (let i = 1; i < pts.length; i++) {
        line(g, pts[i - 1][0], pts[i - 1][1] - 1, pts[i][0], pts[i][1] - 1, o.col ?? "#9a5aff");
        line(g, pts[i - 1][0], pts[i - 1][1] + 1, pts[i][0], pts[i][1] + 1, o.col ?? "#9a5aff");
        line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o.core ?? "#f4e8ff");
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /**
   * A projectile from (x0,y0) to (x1,y1) over dur ms, rising `arc` px at mid-flight, with a
   * fading trail. head draws the missile at its position and heading.
   */
  projectile(x0: number, y0: number, x1: number, y1: number, o: { dur: number; arc?: number; head: (g: G, x: number, y: number, ang: number, k: number) => void; trail?: string; trailLen?: number; e?: Ease }) {
    const e = o.e ?? ease.linear;
    const pos = (k: number): [number, number] => {
      const u = e(clamp01(k));
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * (o.arc ?? 0)];
    };
    return this.add(o.dur, (g, k) => {
      const [x, y] = pos(k);
      const [px, py] = pos(k - 0.04);
      if (o.trail) {
        const n = o.trailLen ?? 8;
        g.globalCompositeOperation = "lighter";
        for (let i = 1; i <= n; i++) {
          const [tx, ty] = pos(k - i * 0.022);
          g.globalAlpha = (1 - i / (n + 1)) * 0.8;
          dot(g, tx, ty, o.trail);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      }
      o.head(g, x, y, Math.atan2(y - py, x - px), k);
    });
  }

  /** Psychic wave: arcs ")))" travelling from x0 to x1 with ripples at the head. */
  psiWave(x0: number, y: number, x1: number, o: { col?: string; col2?: string; dur?: number; h?: number } = {}) {
    const col = o.col ?? "#c9a2ff", col2 = o.col2 ?? "#ffffff", h = o.h ?? 12, dir = Math.sign(x1 - x0) || 1;
    return this.add(o.dur ?? 300, (g, k) => {
      const head = x0 + (x1 - x0) * ease.inOutQuad(k);
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const cx = head - dir * i * 7;
        if ((cx - x0) * dir < 0) continue;
        const hh = h * (1 - i * 0.14) * (0.7 + 0.3 * Math.sin(k * 20 + i));
        g.globalAlpha = (1 - i * 0.18) * (k > 0.85 ? (1 - k) / 0.15 : 1);
        // a ")" arc: points of an ellipse half facing the travel direction
        for (let s = -6; s <= 6; s++) {
          const a = (s / 6) * 1.2;
          dot(g, cx + dir * Math.cos(a) * 4 - dir * 4, y + Math.sin(a) * hh, i === 0 ? col2 : col);
        }
      }
      // ripple distortion at the head
      g.globalAlpha = 0.55;
      ring(g, head, y, 3 + ((k * 40) % 6), col, 6 + ((k * 40) % 6));
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /** A magic circle: rings, rotating rune ticks and a star (charge-ups, victory). */
  glyph(x: number, y: number, o: { r?: number; col?: string; dur?: number; ry?: number; layer?: Layer; spin?: number } = {}) {
    const r = o.r ?? 12, ry = o.ry ?? 1, col = o.col ?? "#c9a2ff";
    return this.add(o.dur ?? 600, (g, k) => {
      const grow = ease.outBack(clamp01(k / 0.3));
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const rr = r * grow, rot = k * (o.spin ?? 2.5);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.9 * fade;
      ring(g, x, y, rr, col, rr * ry);
      g.globalAlpha = 0.6 * fade;
      ring(g, x, y, rr * 0.72, col, rr * 0.72 * ry);
      g.globalAlpha = 0.9 * fade;
      for (let i = 0; i < 12; i++) {
        const a = rot + (i / 12) * TAU;
        const cx = x + Math.cos(a) * rr * 0.86, cy = y + Math.sin(a) * rr * 0.86 * ry;
        dot(g, cx, cy, i % 3 ? col : "#ffffff", i % 3 ? 1 : 2);
      }
      // five-point star inside
      const pts = Array.from({ length: 5 }, (_, i) => { const a = -rot * 0.6 + (i * 2 * TAU) / 5 - Math.PI / 2; return [x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.7 * ry] as [number, number]; });
      g.globalAlpha = 0.5 * fade;
      for (let i = 0; i < 5; i++) line(g, pts[i][0], pts[i][1], pts[(i + 1) % 5][0], pts[(i + 1) % 5][1], col);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }, o.layer ?? "over");
  }

  /** Energy gathering into a point: converging motes and a pulsing core. */
  charge(x: number, y: number, o: { col?: string; dur?: number; r?: number } = {}) {
    const col = o.col ?? "#c9a2ff", r = o.r ?? 16;
    const motes = Array.from({ length: 14 }, () => ({ a: rnd(0, TAU), d: rnd(0.7, 1.2), s: rnd(0, 0.35) }));
    return this.add(o.dur ?? 320, (g, k) => {
      g.globalCompositeOperation = "lighter";
      for (const m of motes) {
        const kk = clamp01((k - m.s) / (1 - m.s));
        if (kk <= 0 || kk >= 1) continue;
        const d = r * m.d * (1 - ease.inQuad(kk));
        g.globalAlpha = kk;
        const px = x + Math.cos(m.a) * d, py = y + Math.sin(m.a) * d;
        dot(g, px, py, col);
        dot(g, px + Math.cos(m.a) * 2, py + Math.sin(m.a) * 2, col);
      }
      g.globalAlpha = 0.8;
      disc(g, x, y, 1 + k * 3 + Math.sin(k * 30) * 0.7, col);
      dot(g, x, y, "#ffffff", 2);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    });
  }

  /** A full-screen colour flash (screen layer). */
  flash(col = "#ffffff", dur = 90, alpha = 0.55) {
    return this.add(dur, (g, k) => {
      g.globalAlpha = alpha * (1 - k);
      g.fillStyle = col;
      g.fillRect(-20, -20, 360, 220);
      g.globalAlpha = 1;
    }, "screen");
  }

  /** Pop-up sprite (number or word): jumps up with a pop, hangs, then fades and floats. */
  pop(spr: HTMLCanvasElement, x: number, y: number, o: { dur?: number; rise?: number; big?: boolean; drift?: number } = {}) {
    const dur = o.dur ?? 900, rise = o.rise ?? 14, drift = o.drift ?? 0;
    return this.add(dur, (g, k, age) => {
      const up = age < 160 ? ease.outBack(age / 160) * rise : rise + ((age - 160) / dur) * 6;
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      // pop: first frames drawn one size up (whole pixels), shaking for big hits
      const s = o.big && age < 90 ? 2 : 1;
      const jx = o.big && age < 220 ? R((Math.random() - 0.5) * 2) : 0;
      const w = spr.width * s, h = spr.height * s;
      g.globalAlpha = fade;
      g.drawImage(spr, R(x - w / 2 + drift * k + jx), R(y - up - h / 2), w, h);
      g.globalAlpha = 1;
    }, "screen");
  }

  /** Damage number: "-n" in bold digits; crit = larger, gold and shaking. */
  number(x: number, y: number, n: number, o: { crit?: boolean; heal?: boolean; small?: boolean; grad?: [string, string, string]; prefix?: string } = {}) {
    const grad: [string, string, string] = o.grad ?? (o.heal ? ["#d8ffc0", "#7ae05a", "#2a8a2a"] : o.crit ? ["#fffbe0", "#ffd23a", "#e0641a"] : ["#ffffff", "#ffe8d0", "#f0a080"]);
    const spr = digitsSprite(`${o.prefix ?? (o.heal ? "+" : "-")}${n}${o.crit ? "!" : ""}`, o.small ? 1 : o.crit ? 3 : 2, grad);
    return this.pop(spr, x, y, { big: o.crit, rise: o.crit ? 18 : 14, dur: o.crit ? 1100 : 900, drift: rnd(-4, 4) });
  }

  /** A word popping up (TRƯỢT, ĐỠ!, MIỄN NHIỄM...). */
  word(x: number, y: number, text: string, col: string, o: { size?: number; dur?: number } = {}) {
    return this.pop(wordSprite(text, o.size ?? 16, col), x, y, { rise: 10, dur: o.dur ?? 850 });
  }
}

// ------------------------------------------------------------------ projectile heads

/** An arrow pointing along ang. */
export function arrowHead(g: G, x: number, y: number, ang: number) {
  const cx = Math.cos(ang), cy = Math.sin(ang);
  line(g, x - cx * 9, y - cy * 9, x, y, "#8a6238");
  line(g, x - cx * 1, y - cy * 1, x + cx * 1.5, y + cy * 1.5, "#e8eef6");
  dot(g, x + cx * 2, y + cy * 2, "#ffffff");
  // fletching
  dot(g, x - cx * 9 - cy * 1, y - cy * 9 + cx * 1, "#e8e0d0");
  dot(g, x - cx * 9 + cy * 1, y - cy * 9 - cx * 1, "#e8e0d0");
  dot(g, x - cx * 8 - cy * 1, y - cy * 8 + cx * 1, "#c84a3a");
  dot(g, x - cx * 8 + cy * 1, y - cy * 8 - cx * 1, "#c84a3a");
}

/** A glowing orb with a flickering halo. */
export function orbHead(col: string, core = "#ffffff", r = 3) {
  return (g: G, x: number, y: number, _a: number, k: number) => {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.45;
    disc(g, x, y, r + 1 + (Math.sin(k * 40) > 0 ? 1 : 0), col);
    g.globalAlpha = 1;
    disc(g, x, y, r, col);
    disc(g, x, y, Math.max(1, r - 2), core);
    g.globalCompositeOperation = "source-over";
  };
}

/** A dark crackling sphere (Vordak mind bolts). */
export function darkOrbHead(col = "#a04aff") {
  return (g: G, x: number, y: number, _a: number, k: number) => {
    disc(g, x, y, 4, "#1a0a2a");
    g.globalCompositeOperation = "lighter";
    ring(g, x, y, 4 + (Math.sin(k * 50) > 0 ? 1 : 0), col);
    for (let i = 0; i < 3; i++) {
      const a = k * 30 + i * 2.1;
      line(g, x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 6, col);
    }
    dot(g, x, y, "#f0d8ff", 2);
    g.globalCompositeOperation = "source-over";
  };
}
