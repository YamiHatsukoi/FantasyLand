/**
 * Colour helpers for the "cozy farm game" look: shadows drift towards blue/purple and
 * highlights towards warm yellow instead of plain darken/lighten, and outlines are a dark
 * version of the local colour rather than black.
 */

export function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Move a hue towards a target by `amt` degrees (shortest way round). */
function towards(h: number, target: number, amt: number) {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) < amt) return target;
  return h + Math.sign(d) * amt;
}

/**
 * Hue-shifted shade. f in [-1, 1]: negative = shadow (darker, cooler, a bit more saturated),
 * positive = highlight (lighter, warmer).
 */
export function hs(c: string, f: number): string {
  const [r, g, b] = hex(c);
  let [h, s, l] = rgb2hsl(r, g, b);
  if (f < 0) {
    h = s < 0.08 ? h : towards(h, 250, -f * 30);
    s = Math.min(1, s + -f * 0.15);
    l = l * (1 + f * 0.9);
  } else {
    h = s < 0.08 ? h : towards(h, 55, f * 22);
    s = Math.max(0, s - f * 0.1);
    l = l + (1 - l) * f * 0.85;
  }
  return toHex(...hsl2rgb(h, s, l));
}

/** Dark, saturated outline colour derived from a fill colour. */
export const outline = (c: string) => hs(c, -0.62);

export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export const rgba = (c: string, a: number) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

/** Pixel painter over a canvas with hue-shifted shading helpers. */
export class Paint {
  constructor(public g: CanvasRenderingContext2D, public w: number, public h: number) {}
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
  /**
   * Clean, cel-shaded blob lit from the upper left: highlight crescent, base, shadow band,
   * and a coloured outline. `col` is the base colour.
   */
  blob(cx: number, cy: number, rx: number, ry: number, col: string, opts: { outline?: boolean; hi?: number; lo?: number } = {}) {
    const hi = hs(col, opts.hi ?? 0.3), lo = hs(col, opts.lo ?? -0.28), ol = outline(col);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        let c = col;
        const lit = -dx * 0.6 - dy * 0.8;
        if (lit > 0.55 && d > 0.2) c = hi;
        else if (dy > 0.35 || lit < -0.6) c = lo;
        if (opts.outline !== false && d > 0.78 && (dy > -0.2 || dx > 0.5)) c = d > 0.9 ? ol : c;
        this.px(x, y, c);
      }
    }
  }
  /** Vertical cylinder shading (for trunks, pillars, stalks). */
  column(x: number, y: number, w: number, h: number, col: string) {
    const hi = hs(col, 0.28), lo = hs(col, -0.3), ol = outline(col);
    for (let i = 0; i < w; i++) {
      const c = i === 0 || i === w - 1 ? ol : i === 1 ? hi : i >= w - 2 ? lo : col;
      this.rect(x + i, y, 1, h, w <= 2 ? col : c);
    }
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Paint, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  return [c, new Paint(g, w, h), g];
}
