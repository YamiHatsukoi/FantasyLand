import { hs, mix, outline } from "./palette";

/**
 * Shared engine for 32x32 monster art. A sprite is built from "parts": each part is a mask
 * (ellipses, limbs, polygons) shaded as one volume, lit from the upper left with hue-shifted
 * highlights and shadows, with a thin dark seam where it overlaps what was drawn before.
 * toCanvas() adds a coloured outline.
 */

export const S = 32;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

export class Mask {
  m = new Uint8Array(S * S);
  set(x: number, y: number) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S) this.m[y * S + x] = 1; }
  has(x: number, y: number) { return x >= 0 && y >= 0 && x < S && y < S && this.m[y * S + x] === 1; }
  ell(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / Math.max(0.5, rx), dy = (y + 0.5 - cy) / Math.max(0.5, ry);
      if (dx * dx + dy * dy <= 1) this.set(x, y);
    }
    return this;
  }
  rect(x: number, y: number, w: number, h: number) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy); return this; }
  /** Tapered stroke from (x0,y0) to (x1,y1), radius w0 -> w1. */
  limb(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2);
    for (let i = 0; i <= n; i++) { const t = i / n, w = w0 + (w1 - w0) * t; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w); }
    return this;
  }
  /** Stroke through several points (a bent leg, a curling tail). */
  path(pts: [number, number][], w0: number, w1: number) {
    const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0) || 1;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      this.limb(ax, ay, bx, by, w0 + (w1 - w0) * (acc / total), w0 + (w1 - w0) * ((acc + len) / total));
      acc += len;
    }
    return this;
  }
  poly(pts: [number, number][]) {
    const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y);
    }
    return this;
  }
  /** Keeps only pixels for which keep(x, y) is true. */
  clip(keep: (x: number, y: number) => boolean) { for (let i = 0; i < S * S; i++) if (this.m[i] && !keep(i % S, Math.floor(i / S))) this.m[i] = 0; return this; }
}

export interface PartOpts {
  /** Draw a dark seam over whatever this part overlaps (default true). */
  seam?: boolean;
  /** Single colour, no shading (eyes, teeth, glows). */
  flat?: boolean;
  /** Shading strength, 1 = normal. */
  k?: number;
  /** Highlight crescent on the lit edge (default true). */
  shine?: boolean;
}

export class Sprite {
  g: (string | null)[] = Array(S * S).fill(null);
  constructor(public T: (c: string) => string) {}
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < S && y < S ? this.g[y * S + x] : null; }
  px(x: number, y: number, c: string, raw = false) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S) this.g[y * S + x] = raw ? c : this.T(c); }
  /** Only paints over pixels that are already filled (markings, stripes, cracks). */
  on(x: number, y: number, c: string, raw = false) { if (this.get(Math.round(x), Math.round(y))) this.px(x, y, c, raw); }
  line(x0: number, y0: number, x1: number, y1: number, c: string, onlyOn = false, raw = false) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; if (onlyOn) this.on(x, y, c, raw); else this.px(x, y, c, raw); }
  }
  part(shape: (m: Mask) => unknown, color: string, o: PartOpts = {}) {
    const m = new Mask();
    shape(m);
    const base = this.T(color);
    if (o.flat) { for (let i = 0; i < S * S; i++) if (m.m[i]) this.g[i] = base; return m; }
    const k = o.k ?? 1;
    const ramp = [hs(base, 0.42 * k), hs(base, 0.18 * k), base, hs(base, -0.3 * k), hs(base, -0.52 * k)];
    const dist = (x: number, y: number, dx: number, dy: number) => { let d = 0; while (d < 9 && m.has(x + dx * (d + 1), y + dy * (d + 1))) d++; return d; };
    const seams: number[] = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!m.has(x, y)) continue;
      const up = dist(x, y, 0, -1), dn = dist(x, y, 0, 1), lf = dist(x, y, -1, 0), rt = dist(x, y, 1, 0);
      let s = 0.62 * ((up + 0.5) / (up + dn + 1)) + 0.38 * ((lf + 0.5) / (lf + rt + 1)) + BAYER[(y & 3) * 4 + (x & 3)] * 0.14;
      if (dn === 0) s = Math.max(s, 0.8);
      let t = s < 0.3 ? 1 : s < 0.58 ? 2 : s < 0.78 ? 3 : 4;
      if (o.shine !== false && (up === 0 || lf === 0) && s < 0.42 && up + dn > 2) t = 0;
      this.g[y * S + x] = ramp[t];
      if (o.seam !== false) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.has(nx, ny) && this.get(nx, ny)) seams.push(ny * S + nx);
      }
    }
    for (const i of seams) { const c = this.g[i]; if (c) this.g[i] = hs(c, -0.45); }
    return m;
  }
  /** Round eye with a pupil looking right and a catch-light. */
  eye(x: number, y: number, iris: string, r = 1) {
    if (r <= 1) { this.px(x, y, iris); this.px(x, y - 1, hs(iris, 0.6)); return; }
    this.part((m) => m.ell(x, y, r, r), "#f4f0e6", { flat: true, seam: false });
    this.part((m) => m.ell(x + r * 0.35, y + 0.2, r * 0.7, r * 0.75), iris, { flat: true, seam: false });
    this.px(x + r * 0.45, y + 0.3, "#1a1226", true);
    if (r >= 1.6) this.px(x + r * 0.45, y + 1.3, "#1a1226", true);
    this.px(x, y - r * 0.4, "#ffffff", true);
  }
  glow(x: number, y: number, c: string) { this.px(x, y, "#ffffff", true); this.px(x - 1, y, c, true); this.px(x + 1, y, c, true); }
  toCanvas() {
    const out = this.g.slice();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (this.g[y * S + x]) continue;
      const n = [[0, 1], [0, -1], [-1, 0], [1, 0]].map(([dx, dy]) => this.get(x + dx, y + dy)).filter((v): v is string => !!v);
      if (!n.length) continue;
      // darkest neighbour decides the outline; the bottom edge is a touch darker (it sits on the ground)
      const below = this.get(x, y - 1);
      out[y * S + x] = mix(outline(n[0]), "#140c1c", below ? 0.45 : 0.3);
    }
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    out.forEach((col, i) => { if (!col) return; ctx.fillStyle = col; ctx.fillRect(i % S, Math.floor(i / S), 1, 1); });
    return c;
  }
}

export const K = "#1a1226";
