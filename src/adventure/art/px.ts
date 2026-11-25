/**
 * Small pixel-art toolkit shared by Adventure's art modules (characters, creatures, icons,
 * scenes). Everything is drawn in code at native resolution and scaled up with
 * nearest-neighbour, like FantasyLand.
 */
import { hs, mix, rgba } from "../../render/palette";

export { hs, mix, rgba };

/** Deterministic random numbers from a string seed. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  };
}

/** A pixel surface: set pixels and rectangles, then outline and export. */
export class Px {
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  constructor(readonly w: number, readonly h: number) {
    this.c = document.createElement("canvas");
    this.c.width = w;
    this.c.height = h;
    this.g = this.c.getContext("2d", { willReadFrequently: true })!;
    this.g.imageSmoothingEnabled = false;
  }

  px(x: number, y: number, col: string) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, col: string) {
    if (w <= 0 || h <= 0) return;
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Horizontal run from x0 to x1 inclusive. */
  span(x0: number, x1: number, y: number, col: string) {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, col);
  }

  /** Filled ellipse (pixel-exact). */
  ellipse(cx: number, cy: number, rx: number, ry: number, col: string) {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry || 1))));
      this.span(Math.round(cx - w), Math.round(cx + w), Math.round(cy + y), col);
    }
  }

  /** Pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, col: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  /** Filled polygon from integer points (scanline). */
  poly(pts: [number, number][], col: string) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.span(Math.round(xs[i]), Math.round(xs[i + 1]) - 1, y, col);
    }
  }

  /** Is the pixel painted (alpha > 0)? */
  solid(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.g.getImageData(x, y, 1, 1).data[3] > 0;
  }

  /**
   * Dark outline around the painted shape (sprite readability). `col` may be a function of the
   * neighbouring colour, for a hue-shifted "selective" outline.
   */
  outline(col: string | ((neighbour: [number, number, number]) => string) = "#140f14") {
    const img = this.g.getImageData(0, 0, this.w, this.h);
    const d = img.data, W = this.w, H = this.h;
    const out: [number, number, string][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = (ny * W + nx) * 4;
        if (d[i + 3] > 0) {
          out.push([x, y, typeof col === "string" ? col : col([d[i], d[i + 1], d[i + 2]])]);
          break;
        }
      }
    }
    for (const [x, y, c] of out) this.px(x, y, c);
    return this;
  }

  /** Draws another surface/canvas onto this one. */
  stamp(src: Px | HTMLCanvasElement, x: number, y: number, flip = false) {
    const c = src instanceof Px ? src.c : src;
    if (!flip) { this.g.drawImage(c, Math.round(x), Math.round(y)); return; }
    this.g.save();
    this.g.translate(Math.round(x) + c.width, Math.round(y));
    this.g.scale(-1, 1);
    this.g.drawImage(c, 0, 0);
    this.g.restore();
  }

  url() { return this.c.toDataURL(); }
}

/** Outline colour that follows the hue of what it surrounds (softer than black). */
export const hueOutline = ([r, g, b]: [number, number, number]) =>
  `rgb(${Math.round(r * 0.22)},${Math.round(g * 0.18)},${Math.round(b * 0.24) + 8})`;

/** Three-tone ramp of a base colour: [shadow, base, light]. */
export const ramp = (c: string): [string, string, string] => [hs(c, -0.28), c, hs(c, 0.22)];

/** Caches canvases by key. */
export function memo<T>(make: (key: string) => T) {
  const m = new Map<string, T>();
  return (key: string) => {
    let v = m.get(key);
    if (v === undefined) { v = make(key); m.set(key, v); }
    return v;
  };
}
