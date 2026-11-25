/**
 * Monster and animal sprites for Adventure's battle screen, drawn entirely in code.
 *
 * Every creature is modelled in its own coordinate space (origin at the ground under its
 * centre, +x = the way it faces, -y = up) out of implicit shapes: ellipses, tapered capsules
 * and polygons, placed through a transform stack. Each shape is rasterised to a mask and
 * shaded in screen space with a 5-tone hue-shifted ramp (light from the upper left), so the
 * lighting stays right when the sprite is mirrored or a body is rotated (lunges, falls).
 * After the body is built it gets a hue-following selective outline, then glows, smears and
 * sparks are composited on top. Poses come from small rigs (humanoid, quadruped, winged,
 * serpent, crawler) solved with two-bone IK each frame.
 */
import { Px, hs, hueOutline, memo, mix, ramp } from "./px";

export type CPose = "idle" | "attack" | "hurt" | "dead" | "move";
export const CREATURE_FRAMES: Record<CPose, number> = { idle: 4, attack: 4, hurt: 2, dead: 1, move: 4 };

type P = [number, number];
type Mx = [number, number, number, number, number, number];

// ============================================================ colour helpers
const rgbMemo = new Map<string, [number, number, number]>();
function rgbOf(c: string): [number, number, number] {
  let v = rgbMemo.get(c);
  if (!v) {
    if (c.startsWith("rgb")) {
      const m = c.match(/[\d.]+/g)!.map(Number);
      v = [m[0], m[1], m[2]];
    } else {
      const n = parseInt(c.slice(1, 7), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    rgbMemo.set(c, v);
  }
  return v;
}

/** A material: five tones [deep, shadow, base, light, specular] plus surface options. */
interface Mat { t: string[]; rough: number; rim?: string }
function mat(base: string, o: { rough?: number; rim?: string; deep?: number; spec?: number } = {}): Mat {
  const [sh, b, li] = ramp(base);
  return { t: [hs(base, o.deep ?? -0.52), sh, b, li, hs(base, o.spec ?? 0.5)], rough: o.rough ?? 0, rim: o.rim };
}
/** The same material one step further from the light (far limbs, far wings). */
const dim = (m: Mat, k = 0.22): Mat => ({ t: m.t.map((c) => hs(c, -k)), rough: m.rough, rim: m.rim && hs(m.rim, -0.35) });
const flatMat = (c: string): Mat => ({ t: [c, c, c, c, c], rough: 0 });

function hash(x: number, y: number, s = 0) {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const rot = (v: P, a: number): P => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const dir = (a: number, l = 1): P => [Math.cos(a) * l, Math.sin(a) * l];
const PI = Math.PI;

/** Two-bone IK: returns [joint, reached end]. bend +1/-1 picks the side the joint bows to. */
function ik(a: P, b: P, l1: number, l2: number, bend: number): [P, P] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const j: P = add(a, dir(ang + bend * A, l1));
  const e: P = add(j, dir(Math.atan2(b[1] - j[1], b[0] - j[0]), l2));
  return [j, e];
}

// ============================================================ the sprite surface
interface FO {
  /** Darken already-painted pixels down-right of the shape (contact shadow). Default on. */
  cast?: boolean;
  /** Tone thresholds along the light->shadow axis. */
  hi?: number; mid?: number; lo?: number;
  /** Fixed tone index (0-4) instead of shading. */
  flat?: number;
  /** Specular glints where t < spec. */
  spec?: number;
  /** Per-pixel tone tweak: (screen x, y, tone, model x, y) => tone. */
  tex?: (x: number, y: number, i: number, mx: number, my: number) => number;
  /** Dark inner line where this shape borders pixels painted before it. */
  edge?: boolean;
  noRim?: boolean;
}

class Shape {
  mask: Uint8Array;
  private neg = false;
  constructor(private s: Spr) { this.mask = new Uint8Array(s.w * s.h); }
  private add(x0: number, y0: number, x1: number, y1: number, test: (x: number, y: number) => boolean) {
    const s = this.s, m = s.m, iv = inv(m);
    const cs = [s.tp(x0, y0), s.tp(x1, y0), s.tp(x0, y1), s.tp(x1, y1)];
    const sx0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0]))) - 1), sx1 = Math.min(s.w - 1, Math.ceil(Math.max(...cs.map((c) => c[0]))) + 1);
    const sy0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1]))) - 1), sy1 = Math.min(s.h - 1, Math.ceil(Math.max(...cs.map((c) => c[1]))) + 1);
    for (let py = sy0; py <= sy1; py++) for (let px = sx0; px <= sx1; px++) {
      const X = px + 0.5, Y = py + 0.5;
      if (test(iv[0] * X + iv[2] * Y + iv[4], iv[1] * X + iv[3] * Y + iv[5])) this.mask[py * s.w + px] = this.neg ? 0 : 1;
    }
    return this;
  }
  /** Everything added inside `f` is cut out of the shape instead. */
  cut(f: () => void) { this.neg = true; f(); this.neg = false; return this; }
  ell(cx: number, cy: number, rx: number, ry: number, a = 0) {
    const c = Math.cos(-a), sn = Math.sin(-a), r = Math.max(rx, ry);
    return this.add(cx - r, cy - r, cx + r, cy + r, (x, y) => {
      const dx = x - cx, dy = y - cy, u = dx * c - dy * sn, v = dx * sn + dy * c;
      return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
    });
  }
  /** Tapered capsule from (x0,y0) radius r0 to (x1,y1) radius r1. */
  cap(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0) {
    const r = Math.max(r0, r1), dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-6;
    return this.add(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y) => {
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1);
      const ex = x - (x0 + dx * t), ey = y - (y0 + dy * t), rr = r0 + (r1 - r0) * t;
      return ex * ex + ey * ey <= rr * rr;
    });
  }
  capP(a: P, b: P, r0: number, r1 = r0) { return this.cap(a[0], a[1], b[0], b[1], r0, r1); }
  /** Chain of capsules through [x, y, r] points. */
  chain(pts: [number, number, number][]) {
    for (let i = 0; i + 1 < pts.length; i++) this.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2]);
    if (pts.length === 1) this.cap(pts[0][0], pts[0][1], pts[0][0], pts[0][1], pts[0][2]);
    return this;
  }
  poly(pts: P[]) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return this.add(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }
  rect(x: number, y: number, w: number, h: number) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
}

function inv(m: Mx): Mx {
  const [a, b, c, d, e, f] = m, det = a * d - b * c || 1e-9;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

const LX = -0.6, LY = -0.8;

class Spr {
  readonly d: Uint8ClampedArray;
  m: Mx = [1, 0, 0, 1, 0, 0];
  private st: Mx[] = [];
  private post: (() => void)[] = [];
  /** Tint applied at the end (hurt flash). */
  flash = 0;
  /** The def's origin offset (dead poses re-centre themselves). */
  ox = 0;
  alpha = 1;
  constructor(readonly w: number, readonly h: number) { this.d = new Uint8ClampedArray(w * h * 4); }

  save() { this.st.push([...this.m] as Mx); }
  restore() { this.m = this.st.pop()!; }
  translate(x: number, y: number) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(a: number) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m;
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c;
  }
  scale(x: number, y: number) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  /** Runs f with a local frame at p rotated by a. */
  at(p: P, a: number, f: () => void) { this.save(); this.translate(p[0], p[1]); this.rotate(a); f(); this.restore(); }
  tp(x: number, y: number): P { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  solid(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] === 255; }
  setS(x: number, y: number, c: string) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgbOf(c), i = (y * this.w + x) * 4;
    this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255;
  }
  blendS(x: number, y: number, c: string, a: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    a = Math.min(1, a);
    const [r, g, b] = rgbOf(c), i = (y * this.w + x) * 4, da = this.d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.d[i] = (r * a + this.d[i] * da * (1 - a)) / oa;
    this.d[i + 1] = (g * a + this.d[i + 1] * da * (1 - a)) / oa;
    this.d[i + 2] = (b * a + this.d[i + 2] * da * (1 - a)) / oa;
    this.d[i + 3] = oa * 255;
  }
  /** Screen pixel of a model point. */
  sp(x: number, y: number): P { const [a, b] = this.tp(x, y); return [Math.floor(a), Math.floor(b)]; }
  dot(x: number, y: number, c: string) { const [a, b] = this.sp(x, y); this.setS(a, b, c); }
  dotA(x: number, y: number, c: string, al: number) { const [a, b] = this.sp(x, y); this.blendS(a, b, c, al); }
  /** Darkens the painted pixel under a model point (creases, pits). */
  crease(x: number, y: number, k = 0.6) {
    const [a, b] = this.sp(x, y);
    if (!this.solid(a, b)) return;
    const i = (b * this.w + a) * 4;
    this.d[i] *= k * 0.92; this.d[i + 1] *= k * 0.95; this.d[i + 2] = this.d[i + 2] * k + 6;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, al = 1) {
    let [ax, ay] = this.sp(x0, y0);
    const [bx, by] = this.sp(x1, y1);
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 400; n++) {
      if (al >= 1) this.setS(ax, ay, c); else this.blendS(ax, ay, c, al);
      if (ax === bx && ay === by) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; ax += sx; }
      if (e2 <= dx) { e += dx; ay += sy; }
    }
  }
  creaseLine(x0: number, y0: number, x1: number, y1: number, k = 0.62) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 1;
    const seen = new Set<number>();
    for (let i = 0; i <= n; i++) {
      const [a, b] = this.sp(lerp(x0, x1, i / n), lerp(y0, y1, i / n));
      if (seen.has(b * this.w + a)) continue;
      seen.add(b * this.w + a);
      const i4 = (b * this.w + a) * 4;
      if (!this.solid(a, b)) continue;
      this.d[i4] *= k * 0.92; this.d[i4 + 1] *= k * 0.95; this.d[i4 + 2] = this.d[i4 + 2] * k + 6;
    }
  }

  /** Builds a shape and paints it with a material. */
  fill(m: Mat, build: (b: Shape) => void, o: FO = {}) {
    const sh = new Shape(this);
    build(sh);
    this.paint(sh.mask, m, o);
  }

  private paint(mask: Uint8Array, m: Mat, o: FO) {
    const W = this.w, H = this.h, d = this.d;
    const inM = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
    const iv = inv(this.m);
    if (o.cast !== false) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        const nx = x + 1, ny = y + 1;
        if (nx >= W || ny >= H || mask[ny * W + nx] || d[(ny * W + nx) * 4 + 3] !== 255) continue;
        if (mask[(ny - 1) * W + nx] && mask[ny * W + nx - 1]) continue;
        const i = (ny * W + nx) * 4;
        if (d[i + 3] === 255 && !(mask[i / 4] === 2)) {
          d[i] *= 0.72; d[i + 1] *= 0.74; d[i + 2] = d[i + 2] * 0.8 + 6;
          mask[i / 4] = 2; // mark: darkened once
        }
      }
      for (let i = 0; i < mask.length; i++) if (mask[i] === 2) mask[i] = 0;
    }
    const march = (x: number, y: number, sx: number, sy: number) => {
      for (let k = 1; k < 16; k++) if (!inM(Math.round(x + sx * k), Math.round(y + sy * k))) return k;
      return 16;
    };
    const hi = o.hi ?? 0.24, mid = o.mid ?? 0.64, lo = o.lo ?? 0.88;
    const rgbT = m.t.map(rgbOf), rim = m.rim ? rgbOf(mix(m.rim, m.t[1], 0.45)) : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      let i: number;
      let rimHit = false;
      const dl = march(x, y, LX, LY), ds = march(x, y, -LX, -LY), tot = dl + ds;
      if (o.flat !== undefined) i = o.flat;
      else if (tot <= 2) i = 2;
      else {
        let t = (dl - 1) / (tot - 2);
        if (m.rough) t += (hash(x, y, 7) - 0.5) * m.rough * 0.6;
        i = t < hi ? 3 : t < mid ? 2 : t < lo || tot < 6 ? 1 : 0;
        if (o.spec !== undefined && t < o.spec && tot >= 4) i = 4;
        if (rim && !o.noRim && ds === 1 && tot >= 5 && !inM(x + 1, y)) rimHit = true;
      }
      if (o.tex) i = clamp(Math.round(o.tex(x, y, i, iv[0] * (x + 0.5) + iv[2] * (y + 0.5) + iv[4], iv[1] * (x + 0.5) + iv[3] * (y + 0.5) + iv[5])), 0, 4);
      if (o.edge) {
        for (const [ex, ey] of [[1, 0], [0, 1], [-1, 0]]) {
          const nx = x + ex, ny = y + ey;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || mask[ny * W + nx]) continue;
          if (d[(ny * W + nx) * 4 + 3] === 255) { i = Math.min(i, ey ? 0 : 1); break; }
        }
      }
      const c = rimHit && i <= 1 ? rim! : rgbT[i], j = (y * W + x) * 4;
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    }
  }

  /** Runs f after the outline pass, in the current transform (glows, smears, sparks). */
  later(f: () => void) {
    const m = [...this.m] as Mx;
    this.post.push(() => { const keep = this.m; this.m = m; f(); this.m = keep; });
  }
  /** A glowing point: solid core, soft halo (post pass). */
  glow(x: number, y: number, c: string, r = 2.5, core = 1) {
    this.later(() => {
      const [cx, cy] = this.tp(x, y);
      const ix = Math.floor(cx), iy = Math.floor(cy);
      const R = Math.ceil(r);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const dd = Math.hypot(dx, dy);
        if (dd > r) continue;
        this.blendS(ix + dx, iy + dy, c, 0.5 * (1 - dd / (r + 0.5)) ** 1.4);
      }
      this.setS(ix, iy, hs(c, 0.55));
      if (core > 1) { this.setS(ix + 1, iy, c); }
    });
  }
  /** Motion smear: an arc of fading light from angle a0 to a1 around (cx, cy) (post pass). */
  smear(cx: number, cy: number, r: number, a0: number, a1: number, th: number, c = "#fff4e0") {
    this.later(() => {
      const n = Math.ceil(Math.abs(a1 - a0) * r * 1.6) + 2;
      const seen = new Map<number, number>();
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = lerp(a0, a1, t);
        for (let k = 0; k <= th * 2; k++) {
          const rr = r - (k / 2) * (0.35 + 0.65 * t);
          const [x, y] = this.sp(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          const key = y * this.w + x, al = t * t * (1 - (k / (th * 2 + 1)) * 0.7) * 0.85;
          if ((seen.get(key) ?? -1) >= al) continue;
          seen.set(key, al);
        }
      }
      for (const [key, al] of seen) this.blendS(key % this.w, Math.floor(key / this.w), c, al);
    });
  }
  /** Straight speed lines trailing a thrust. */
  speed(x0: number, y0: number, x1: number, y1: number, c = "#fff4e0") {
    this.later(() => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4);
      for (let i = 0; i <= n; i++) { const t = i / n; this.dotA(lerp(x0, x1, t), lerp(y0, y1, t), c, t * 0.7); }
    });
  }
  /** Impact burst (post pass). */
  spark(x: number, y: number, size = 4, c = "#fff6c8", c2 = "#ffb040") {
    this.later(() => {
      const [cx, cy] = this.sp(x, y);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * PI * 2 + 0.2, len = k % 2 ? size * 0.55 : size;
        for (let r = 1; r <= len; r++) {
          const px = Math.round(cx + Math.cos(a) * r), py = Math.round(cy + Math.sin(a) * r);
          this.blendS(px, py, r < len * 0.5 ? c : c2, r < len * 0.6 ? 1 : 0.7);
        }
      }
      this.setS(cx, cy, "#ffffff");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.setS(cx + dx, cy + dy, c);
    });
  }
  /** Concentric psychic ripples (post pass). */
  ripple(x: number, y: number, r: number, c: string, a0 = -1.1, a1 = 1.1) {
    this.later(() => {
      const [cx, cy] = this.tp(x, y), fl = this.m[0] < 0 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const rr = r + k * 3.2;
        const n = Math.ceil(rr * 3);
        for (let i = 0; i <= n; i++) {
          const a = lerp(a0, a1, i / n);
          const px = Math.floor(cx + Math.cos(a) * rr * fl), py = Math.floor(cy + Math.sin(a) * rr);
          this.blendS(px, py, c, (0.9 - k * 0.25) * (1 - Math.abs(a) / (Math.abs(a1) + 0.3)));
        }
      }
    });
  }

  /** Outline, post effects, flash; returns the finished canvas. */
  finish(): HTMLCanvasElement {
    const W = this.w, H = this.h, d = this.d;
    const outs: [number, string][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3]) continue;
      let pick = -1, lit = false;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = (ny * W + nx) * 4;
        if (d[j + 3] === 255) { pick = j; lit = dy === 1 || dx === 1; break; }
      }
      if (pick < 0) continue;
      const nb: [number, number, number] = [d[pick], d[pick + 1], d[pick + 2]];
      const o = hueOutline(nb);
      outs.push([i, lit ? mix(toHex(rgbOf(o)), toHex(nb), 0.22) : o]);
    }
    for (const [i, c] of outs) { const [r, g, b] = rgbOf(c); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    for (const f of this.post) f();
    if (this.flash) {
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) {
        d[i] = lerp(d[i], 255, this.flash); d[i + 1] = lerp(d[i + 1], 236, this.flash); d[i + 2] = lerp(d[i + 2], 228, this.flash);
      }
    }
    if (this.alpha < 1) for (let i = 3; i < d.length; i += 4) d[i] *= this.alpha;
    const px = new Px(W, H);
    const img = px.g.createImageData(W, H);
    img.data.set(d);
    px.g.putImageData(img, 0, 0);
    return px.c;
  }
}

function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}

// ============================================================ animation state
interface A {
  pose: CPose; f: number; n: number;
  /** Cycle phase 0..1 and its sine/cosine. */
  t: number; s: number; c: number;
  /** Attack stage 0 wind-up, 1 strike, 2 impact, 3 recover; -1 otherwise. */
  st: number;
  /** Hurt frame or -1. */
  hu: number;
  dead: boolean;
}
function anim(pose: CPose, f: number): A {
  const n = CREATURE_FRAMES[pose], fr = ((f % n) + n) % n, t = fr / n;
  return { pose, f: fr, n, t, s: Math.sin(t * PI * 2), c: Math.cos(t * PI * 2), st: pose === "attack" ? fr : -1, hu: pose === "hurt" ? fr : -1, dead: pose === "dead" };
}
type Ex = "n" | "atk" | "hurt" | "dead";
const exOf = (a: A): Ex => (a.dead ? "dead" : a.hu >= 0 ? "hurt" : a.st === 1 || a.st === 2 || a.st === 0 ? "atk" : "n");

// ============================================================ weapons (local frame: hand at 0,0, blade along +x)
const IRON = mat("#8a8f9e"), STEEL = mat("#b4bccb"), DARKSTEEL = mat("#4a4e5e", { rim: "#7a86a8" }), WOOD = mat("#7a5232"), DARKWOOD = mat("#4e3424");
const GOLD = mat("#d8a23a"), BONE = mat("#d8ceb0"), LEATHER = mat("#5a3e2c");

type Weapon = (s: Spr, a: A) => P; // returns the tip in the hand frame
const W: Record<string, Weapon> = {
  spear: (s) => {
    s.fill(WOOD, (b) => b.cap(-14, 0, 12, 0, 0.7), { cast: false });
    s.fill(IRON, (b) => b.poly([[11, -1.6], [14.5, -1.5], [19, 0], [14.5, 1.5], [11, 1.6], [11.8, 0]]), { spec: 0.12 });
    s.fill(LEATHER, (b) => b.rect(10, -1, 1.6, 2), { cast: false });
    s.dot(-14, 0, "#3a2818");
    s.line(12.5, 0, 17.5, 0, "#dfe6f0");
    return [19, 0];
  },
  sword: (s) => {
    s.fill(LEATHER, (b) => b.cap(-2.2, 0, 1, 0, 0.8));
    s.fill(IRON, (b) => b.ell(-2.8, 0, 1, 1));
    s.fill(STEEL, (b) => b.poly([[1.5, -1.1], [12.5, -0.9], [15, 0.1], [12.5, 1.1], [1.5, 1.1]]), { spec: 0.15 });
    s.fill(IRON, (b) => b.rect(0.6, -2.6, 1.5, 5.2));
    s.line(2.5, 0, 12, 0, "#e8eef6");
    return [15, 0];
  },
  scimitar: (s) => {
    s.fill(LEATHER, (b) => b.cap(-2.5, 0, 1, 0, 0.8));
    s.fill(DARKSTEEL, (b) => b.ell(-3, 0, 1.1, 1.1));
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([1.5 + t * 13, -0.8 - t * t * 2.2 - (t > 0.75 ? (t - 0.75) * 6 : 0)]); }
    for (let i = 8; i >= 0; i--) { const t = i / 8; pts.push([1.5 + t * 13 - (t > 0.8 ? 1 : 0), 1 + t * 0.6 - t * t * 1.6]); }
    s.fill(STEEL, (b) => b.poly(pts), { spec: 0.18 });
    s.fill(DARKSTEEL, (b) => b.poly([[0.4, -2.8], [2, -2.2], [2, 2.2], [0.4, 2.8]]));
    return [14.5, -3];
  },
  mace: (s) => {
    s.fill(DARKWOOD, (b) => b.cap(-3, 0, 10, 0, 0.8));
    s.fill(DARKSTEEL, (b) => b.ell(11.5, 0, 2.8, 2.6), { spec: 0.15 });
    for (const a of [0, 1, 2, 3, 4, 5]) { const p = add([11.5, 0], dir(a * 1.05 - 0.5, 3.6)); s.fill(DARKSTEEL, (b) => b.cap(11.5, 0, p[0], p[1], 1, 0.3), { cast: false }); }
    s.dot(11, -1, "#c8d0e8");
    return [14, 0];
  },
  axe: (s) => {
    s.fill(DARKWOOD, (b) => b.cap(-12, 0, 13, 0, 0.9), { cast: false });
    s.fill(IRON, (b) => b.poly([[8, -1], [10, -4], [12, -7.5], [15, -8], [16.5, -4], [17, 0], [16.5, 4], [15, 8], [12, 7.5], [10, 4], [8, 1]]), { spec: 0.12, tex: (x, y, i) => (hash(x, y, 3) < 0.12 ? i - 1 : i) });
    s.fill(IRON, (b) => b.poly([[11, -1], [8.5, -3], [7, -4.5], [8, -0.5]]));
    s.line(16, -6, 16.6, 0, "#dfe6f0");
    s.line(16.6, 0, 16, 6, "#dfe6f0");
    return [17, 0];
  },
  club: (s) => {
    s.fill(mat("#6a4a30", { rough: 0.6 }), (b) => b.cap(-2, 0, 13, 0, 1.1, 3.2));
    for (const [x, y] of [[6, -1.5], [9, 1.8], [11.5, -2], [13, 0.5]] as P[]) s.fill(IRON, (b) => b.ell(x, y, 0.8, 0.8));
    return [15, 0];
  },
  staff: (s) => {
    s.fill(WOOD, (b) => b.cap(-11, 0, 13, 0, 0.75), { cast: false });
    s.fill(mat("#6a8a3a"), (b) => { b.ell(13, -1.5, 1.6, 1, 0.5); b.ell(12, 1.6, 1.4, 0.8, -0.6); });
    s.fill(mat("#9ad0e8"), (b) => b.ell(14.2, 0, 1.3, 1.3), { spec: 0.3 });
    s.glow(14.2, 0, "#bff0ff", 2.6);
    return [15, 0];
  },
  halberd: (s) => {
    s.fill(DARKWOOD, (b) => b.cap(-10, 0, 18, 0, 0.75), { cast: false });
    s.fill(IRON, (b) => b.poly([[11, -0.6], [12, -5], [15.5, -5.6], [16, -1], [11, 0.8]]), { spec: 0.12 });
    s.fill(IRON, (b) => b.poly([[16, -1.2], [23, 0], [16, 1.2]]), { spec: 0.15 });
    s.fill(IRON, (b) => b.poly([[12, 0.6], [14, 3.8], [14.5, 0.8]]));
    return [23, 0];
  },
};

// ============================================================ humanoid rig
interface HB { thigh: number; shin: number; up: number; fore: number; torso: number; stance: number; hunch: number }
type Style = "thrust" | "swing" | "chop" | "claw" | "staff" | "cast";
interface HJ {
  hip: P; lean: number; neck: P; sh: P[]; el: P[]; ha: P[]; hp: P[]; kn: P[]; ft: P[];
  head: number; wa: number[]; ex: Ex; bob: number;
}

function humPose(b: HB, a: A, style: Style): HJ {
  const L = b.thigh + b.shin, arm = b.up + b.fore;
  let hx = 0, hy = -L * 0.93, lean = b.hunch, head = 0, bob = 0;
  let f0: P = [-b.stance, 0], f1: P = [b.stance * 0.85, 0];
  let h0: P, h1: P, w0: number, w1: number;
  // rest pose by style (hands relative to the shoulders)
  switch (style) {
    case "thrust": h1 = [arm * 0.55, arm * 0.55]; w1 = -1.25; h0 = [-arm * 0.1, arm * 0.8]; w0 = 1.2; break;
    case "swing": h1 = [arm * 0.45, arm * 0.7]; w1 = -0.85; h0 = [-arm * 0.2, arm * 0.8]; w0 = 1.3; break;
    case "chop": h1 = [arm * 0.55, arm * 0.45]; w1 = -2.1; h0 = [arm * 0.25, arm * 0.7]; w0 = -2.1; break;
    case "claw": h1 = [arm * 0.6, arm * 0.45]; w1 = 0.3; h0 = [arm * 0.35, arm * 0.55]; w0 = 0.5; break;
    case "staff": h1 = [arm * 0.5, arm * 0.45]; w1 = -1.62; h0 = [-arm * 0.1, arm * 0.8]; w0 = 1.3; break;
    case "cast": h1 = [arm * 0.4, arm * 0.7]; w1 = 1.1; h0 = [-arm * 0.15, arm * 0.8]; w0 = 1.3; break;
  }
  if (a.pose === "idle") {
    bob = (1 - a.c) * 0.55;
    hy += bob;
    h1 = add(h1, [0, bob * 0.6]);
    h0 = add(h0, [0, bob * 0.8]);
    head = a.s * 0.04;
  } else if (a.pose === "move") {
    const p = a.t * PI * 2, sw = Math.cos(p);
    f1 = [b.stance * 0.2 + sw * b.stance * 1.1, -Math.max(0, Math.sin(p)) * 2.2];
    f0 = [b.stance * 0.2 - sw * b.stance * 1.1, -Math.max(0, -Math.sin(p)) * 2.2];
    hy -= Math.abs(Math.sin(p)) * 0.9 - 0.4;
    lean += 0.08;
    h1 = add(h1, [-sw * 1.2, 0]);
    h0 = add(h0, [sw * 2.4, 0]);
  } else if (a.st >= 0) {
    const st = a.st;
    if (style === "thrust") {
      if (st === 0) { lean -= 0.14; hx -= 2; h1 = [-arm * 0.35, arm * 0.45]; w1 = -0.12; f1 = [b.stance * 0.5, 0]; hy += 1; }
      if (st === 1) { lean += 0.3; hx += 2.5; f1 = [b.stance + 4, 0]; h1 = [arm * 0.85, arm * 0.3]; w1 = 0.04; }
      if (st === 2) { lean += 0.38; hx += 3.5; f1 = [b.stance + 5, 0]; h1 = [arm * 0.92, arm * 0.25]; w1 = 0.07; hy += 0.5; }
      if (st === 3) { lean += 0.1; hx += 1; h1 = [arm * 0.45, arm * 0.5]; w1 = -0.7; }
      h0 = st === 0 ? [-arm * 0.6, arm * 0.4] : [-arm * 0.45, arm * 0.6];
    } else if (style === "swing" || style === "cast") {
      if (st === 0) { lean -= 0.14; hx -= 1.5; h1 = [-arm * 0.25, -arm * 0.75]; w1 = -2.45; head = -0.12; hy += 0.6; }
      if (st === 1) { lean += 0.3; hx += 3; f1 = [b.stance + 3, 0]; h1 = [arm * 0.9, arm * 0.15]; w1 = 0.45; }
      if (st === 2) { lean += 0.4; hx += 4; f1 = [b.stance + 3.5, 0]; h1 = [arm * 0.8, arm * 0.5]; w1 = 1.0; hy += 1; }
      if (st === 3) { lean += 0.12; hx += 1; h1 = [arm * 0.5, arm * 0.6]; w1 = -0.3; }
      h0 = st === 0 ? [arm * 0.4, arm * 0.3] : [-arm * 0.5, arm * 0.55];
    } else if (style === "chop") {
      if (st === 0) { lean -= 0.2; hx -= 2; h1 = [-arm * 0.1, -arm * 0.85]; w1 = -2.6; h0 = [-arm * 0.35, -arm * 0.7]; w0 = w1; head = -0.15; hy += 0.8; }
      if (st === 1) { lean += 0.35; hx += 3; f1 = [b.stance + 3, 0]; h1 = [arm * 0.85, arm * 0.05]; w1 = 0.3; h0 = [arm * 0.55, arm * 0.25]; w0 = w1; }
      if (st === 2) { lean += 0.48; hx += 4; f1 = [b.stance + 3.5, 0]; h1 = [arm * 0.75, arm * 0.6]; w1 = 1.05; h0 = [arm * 0.45, arm * 0.55]; w0 = w1; hy += 1.5; }
      if (st === 3) { lean += 0.15; hx += 1; h1 = [arm * 0.6, arm * 0.4]; w1 = -1.2; h0 = [arm * 0.3, arm * 0.6]; w0 = w1; }
    } else if (style === "claw") {
      if (st === 0) { lean -= 0.2; hx -= 2; h1 = [-arm * 0.1, -arm * 0.85]; w1 = -2; h0 = [-arm * 0.4, -arm * 0.6]; w0 = -2.3; head = -0.2; hy += 0.6; }
      if (st === 1) { lean += 0.35; hx += 3.5; f1 = [b.stance + 3, 0]; h1 = [arm * 0.95, arm * 0.1]; w1 = 0.4; h0 = [arm * 0.5, -arm * 0.4]; w0 = -0.6; }
      if (st === 2) { lean += 0.45; hx += 4.5; f1 = [b.stance + 3.5, 0]; h1 = [arm * 0.8, arm * 0.55]; w1 = 1.1; h0 = [arm * 0.9, arm * 0.1]; w0 = 0.4; hy += 1; }
      if (st === 3) { lean += 0.12; hx += 1; h1 = [arm * 0.6, arm * 0.5]; w1 = 0.4; h0 = [arm * 0.4, arm * 0.6]; w0 = 0.5; }
    } else if (style === "staff") {
      if (st === 0) { lean -= 0.12; hx -= 1.5; h1 = [-arm * 0.2, -arm * 0.6]; w1 = -2.2; }
      if (st === 1) { lean += 0.25; hx += 2.5; f1 = [b.stance + 2, 0]; h1 = [arm * 0.9, arm * 0.0]; w1 = -0.1; }
      if (st === 2) { lean += 0.3; hx += 3; f1 = [b.stance + 2.5, 0]; h1 = [arm * 0.95, arm * 0.1]; w1 = 0.05; }
      if (st === 3) { lean += 0.08; hx += 1; h1 = [arm * 0.5, arm * 0.4]; w1 = -1.2; }
    }
  } else if (a.hu >= 0) {
    const k = a.hu === 0 ? 1 : 0.55;
    lean -= 0.38 * k; hx -= 2.5 * k; head = -0.4 * k; hy += 1.2 * k;
    f1 = [b.stance * 0.5, 0]; f0 = [-b.stance * 1.2, 0];
    h1 = [-arm * 0.15, -arm * 0.3 * k]; w1 = -1.9;
    h0 = [-arm * 0.6, arm * 0.2]; w0 = 2.2;
    if (style === "chop") { h0 = add(h1, [-2, 2]); w0 = w1; }
  } else if (a.dead) {
    // a crumpled pose; the drawing is laid down by deadLay()
    lean = 0.05; hy = -L * 0.88; head = 0.35;
    f1 = [L * 0.45, -L * 0.25]; f0 = [L * 0.2, -L * 0.05];
    h1 = [-arm * 0.6, -arm * 0.75]; h0 = [arm * 0.3, arm * 0.85]; w1 = -1.6; w0 = 1.4;
  }
  if (style === "chop" && a.st < 0 && a.hu < 0 && !a.dead) { /* both hands on the haft */ }
  const R = (v: P) => rot(v, lean);
  const hip: P = [hx, hy];
  const neck = add(hip, R([0, -b.torso]));
  const shc = add(hip, R([0, -b.torso + 1.6]));
  const sh = [add(shc, R([-1.2, 0.3])), add(shc, R([0.8, 0]))];
  const hp = [add(hip, R([-1, 0])), add(hip, R([0.8, 0]))];
  const wa = [w0!, w1!];
  const hand = [add(sh[0], h0!), add(sh[1], h1!)];
  if (style === "chop") hand[0] = add(hand[1], dir(wa[1], -4.5)), (wa[0] = wa[1]);
  const el: P[] = [], ha: P[] = [];
  for (let i = 0; i < 2; i++) { const [e, h] = ik(sh[i], hand[i], b.up, b.fore, 1); el.push(e); ha.push(h); }
  const kn: P[] = [], ft = [f0, f1];
  for (let i = 0; i < 2; i++) { const [k, f] = ik(hp[i], ft[i], b.thigh, b.shin, -1); kn.push(k); ft[i] = f; }
  return { hip, lean, neck, sh, el, ha, hp, kn, ft, head, wa, ex: exOf(a), bob };
}

interface HumSpec {
  b: HB; style: Style;
  weapon?: Weapon;
  /** Behind everything (cloaks, tails, wings, far-hand shield). */
  behind?(s: Spr, j: HJ, a: A): void;
  leg(s: Spr, j: HJ, i: number, a: A): void;
  arm(s: Spr, j: HJ, i: number, a: A): void;
  /** Local frame: hip at origin, up = -y (rotated by lean). */
  torso(s: Spr, j: HJ, a: A): void;
  /** Local frame: neck at origin. */
  head(s: Spr, j: HJ, a: A): void;
  /** Item in the far hand (local frame at hand, along wa[0]). */
  offhand?(s: Spr, j: HJ, a: A): void;
  front?(s: Spr, j: HJ, a: A): void;
  /** Lying length & thickness of the body (dead pose). */
  lie?: [number, number];
}

/** Draws a humanoid from a spec; handles attack effects and the dead pose. */
function drawHum(s: Spr, a: A, sp: HumSpec) {
  const j = humPose(sp.b, a, sp.style);
  const H = sp.b.thigh + sp.b.shin + sp.b.torso + 8;
  if (a.dead) {
    const [len, th] = sp.lie ?? [H, 5];
    s.save();
    s.translate(len * 0.5 + 2 - s.ox, -th);
    s.rotate(-PI / 2);
  }
  sp.behind?.(s, j, a);
  sp.arm(s, j, 0, a);
  if (sp.offhand) s.at(j.ha[0], j.wa[0], () => sp.offhand!(s, j, a));
  sp.leg(s, j, 0, a);
  sp.leg(s, j, 1, a);
  s.at(j.hip, j.lean, () => sp.torso(s, j, a));
  s.at(j.neck, j.lean + j.head, () => sp.head(s, j, a));
  let tip: P | null = null;
  if (sp.weapon && !a.dead) s.at(j.ha[1], j.wa[1], () => { const t = sp.weapon!(s, a); tip = s.tp(t[0], t[1]); });
  sp.arm(s, j, 1, a);
  sp.front?.(s, j, a);
  if (a.dead) {
    s.restore();
    if (sp.weapon) s.at([sp.b.stance + 6, -1.2], 0.04, () => sp.weapon!(s, a));
  }
  // attack effects
  if (a.st === 1 || a.st === 2) {
    const reach = sp.b.up + sp.b.fore;
    if (sp.style === "thrust") {
      const h = j.ha[1];
      s.speed(h[0] - 14, h[1] + 1, h[0] - 2, h[1] + 1);
      s.speed(h[0] - 10, h[1] - 2, h[0] - 3, h[1] - 2);
    } else if (sp.style !== "staff") {
      const wl = sp.weapon ? 12 : 3;
      s.smear(j.sh[1][0], j.sh[1][1], reach + wl, a.st === 1 ? -1.75 : -0.9, a.st === 1 ? 0.45 : 1.0, 2.5);
      if (sp.style === "claw") s.smear(j.sh[1][0], j.sh[1][1] + 3, reach + 1, a.st === 1 ? -1.6 : -0.8, a.st === 1 ? 0.4 : 1.0, 1);
    }
    if (a.st === 2 && tip) {
      const m = inv(s.m), [tx, ty] = tip as P;
      s.spark(m[0] * tx + m[2] * ty + m[4], m[1] * tx + m[3] * ty + m[5], 4);
    }
  }
}

// --- limb helpers
function limb(s: Spr, m: Mat, p: P[], r: number[], o: FO = {}) {
  s.fill(m, (b) => { for (let i = 0; i + 1 < p.length; i++) b.capP(p[i], p[i + 1], r[i], r[i + 1]); }, o);
}
/** A foot/boot at the ankle, pointing forward. */
function foot(s: Spr, m: Mat, ft: P, len: number, h: number, o: FO = {}) {
  s.fill(m, (b) => b.poly([[ft[0] - 1.6, ft[1] - h - 0.5], [ft[0] + len * 0.55, ft[1] - h * 0.7], [ft[0] + len, ft[1] - 0.6], [ft[0] + len, ft[1]], [ft[0] - 1.8, ft[1]]]), o);
}
const mid = (a: P, b: P, t = 0.5): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// ============================================================ the Giak family
interface GiakOpts { skin: string; armour: string; helm?: boolean; captain?: boolean; mountain?: boolean }
function giakSpec(o: GiakOpts): HumSpec {
  const SK = mat(o.skin, { rough: 0.12 }), SKd = dim(SK);
  const ARM = mat(o.armour, { rim: "#6a6a8a" }), ARMd = dim(ARM);
  const CLOTH = mat(o.mountain ? "#5a4636" : "#3a3440");
  const FUR = mat("#8a7a62", { rough: 0.9 });
  const METAL = DARKSTEEL;
  const b: HB = { thigh: 6, shin: 6.5, up: 5.5, fore: 5, torso: 10, stance: 3.2, hunch: 0.28 };
  const sp: HumSpec = {
    b, style: o.captain ? "swing" : "thrust",
    weapon: o.captain ? W.sword : W.spear,
    lie: [34, 5],
    behind(s, j) {
      if (o.mountain) {
        // ragged fur cape
        s.at(j.neck, j.lean, () => s.fill(dim(FUR, 0.1), (b) => b.poly([[-2, -1], [-5.5, 4], [-6.5, 10], [-4, 9], [-3.5, 11.5], [-1, 8]])));
      }
    },
    leg(s, j, i, a) {
      const m = i ? SK : SKd, bt = i ? LEATHER : dim(LEATHER);
      const ankle = add(j.ft[i], [0, -1.2]);
      limb(s, m, [j.hp[i], j.kn[i], ankle], [2.3, 1.7, 1.3]);
      limb(s, i ? CLOTH : dim(CLOTH), [j.hp[i], mid(j.hp[i], j.kn[i], 0.75)], [2.6, 2.1]);
      // bare clawed feet
      s.fill(m, (b) => b.poly([[ankle[0] - 1.4, ankle[1] - 0.6], [ankle[0] + 3.6, ankle[1] + 0.6], [ankle[0] + 4.2, ankle[1] + 1.2], [ankle[0] - 1.6, ankle[1] + 1.2]]));
      s.dot(ankle[0] + 4.3, ankle[1] + 1, "#e8dcc0");
      s.dot(ankle[0] + 2.6, ankle[1] + 1.3, i ? "#cfc2a6" : "#9a8e78");
      if (a.dead) return;
      // leather wrap on the shin
      s.fill(bt, (b) => b.capP(mid(j.kn[i], ankle, 0.35), mid(j.kn[i], ankle, 0.8), 1.8, 1.5), { cast: false, tex: (x, y, t) => ((x + y) % 3 === 0 ? t - 1 : t) });
    },
    arm(s, j, i) {
      const m = i ? SK : SKd;
      limb(s, m, [j.sh[i], j.el[i], j.ha[i]], [2, 1.6, 1.3]);
      // knuckle claws
      s.fill(m, (b) => b.ell(j.ha[i][0], j.ha[i][1], 1.7, 1.6));
      if (i) {
        s.fill(o.mountain ? FUR : ARM, (b) => b.ell(j.sh[1][0] + 0.2, j.sh[1][1] + 0.4, 2.9, 2.4, j.lean), { spec: 0.1 });
        if (!o.mountain) s.dot(j.sh[1][0] + 0.5, j.sh[1][1] - 0.4, "#9a98b0");
      }
    },
    torso(s, j, a) {
      // hunched, pot-bellied body
      s.fill(SK, (b) => { b.ell(0.3, -6.5, 4.3, 5); b.ell(0.4, -2.2, 3.8, 3.2); });
      // black leather jerkin with studs
      s.fill(ARM, (b) => { b.poly([[-4.2, -10.2], [3.6, -10.2], [4.6, -5], [4.4, -0.6], [-4, -0.6], [-4.6, -5]]); });
      s.creaseLine(-4, -5.6, 4.2, -5.2, 0.7);
      if (o.mountain) s.fill(FUR, (b) => { b.ell(0, -9.6, 4.8, 2.4); }, { tex: (x, y, t) => (hash(x, y, 4) < 0.3 ? t - 1 : t) });
      // belt with buckle
      s.fill(LEATHER, (b) => b.rect(-4.3, -2.2, 8.8, 1.8), { cast: false });
      s.fill(o.captain ? GOLD : IRON, (b) => b.rect(1.6, -2.4, 1.8, 2.2), { spec: 0.2 });
      for (const [x, y] of [[-1.5, -8], [2.6, -7.6], [0.5, -4], [3.2, -3.8]] as P[]) s.dot(x, y, "#9a98b0");
      // loincloth tatters
      s.fill(CLOTH, (b) => b.poly([[-2.5, -0.6], [3.5, -0.6], [3, 3], [1.5, 2], [0.5, 3.6], [-1, 2], [-2.2, 3]]), { cast: false });
      void a;
    },
    head(s, j, a) {
      const ex = j.ex;
      const earM = dim(SK, 0.08), INNER = mat("#6e3e4c");
      const open = ex === "atk" || ex === "hurt";
      // far ear: a bat wing of skin raised behind the skull
      s.fill(dim(SK, 0.3), (b) => b.poly([[-1.2, -6.8], [2.2, -7.6], [3.6, -10.5], [4.4, -14.2], [2, -12.4], [0.4, -12.8], [-0.4, -10.4]]));
      s.fill(dim(INNER, 0.25), (b) => b.poly([[0.2, -8], [3, -12.6], [1.6, -11.6], [0.5, -11.8]]), { cast: false });
      s.fill(SK, (b) => {
        b.ell(0.2, -4.8, 4.2, 3.7);
        b.ell(3.4, -3.4, 2.8, 2.3); // broad muzzle
        if (!open) b.ell(2.2, -1.3, 3.3, 1.7); // jaw
      });
      if (open) s.fill(SK, (b) => b.poly([[-1, -2.2], [4.5, -0.2], [5.4, 1.2], [3.6, 1.4], [-1.2, -0.4]]));
      // bat nose-leaf and flat nostrils
      const NOSE = mat(mix(o.skin, "#9a6a6e", 0.45));
      s.fill(NOSE, (b) => { b.ell(5.6, -3.4, 1.4, 1.3); b.poly([[5, -4.2], [5.8, -6.6], [6.6, -4.2]]); });
      s.dot(6.2, -3.2, "#1a1014");
      s.dot(5.2, -2.6, "#1a1014");
      // mouth: wide, ragged teeth
      if (open) {
        s.fill(flatMat("#3a0c16"), (b) => b.poly([[0.4, -2.6], [6.6, -2.4], [5.4, 0.6], [0.6, -1.1]]), { cast: false });
        s.fill(flatMat("#7a2030"), (b) => b.ell(2.6, -0.9, 1.6, 0.6), { cast: false });
        for (const x of [1.6, 3, 4.4, 5.8]) s.dot(x, -2.3, "#f0e6d0");
        for (const x of [2.4, 4, 5.2]) s.dot(x, 0.1, "#d8ccb0");
        s.dot(5.9, -1.6, "#f0e6d0");
      } else {
        s.line(0.6, -1.9, 6, -2.2, "#1e1418");
        for (const x of [1.8, 3.4, 5]) s.dot(x, -1.5, "#f0e6d0");
        s.dot(5.6, -2.8, "#f0e6d0");
      }
      // near ear: broad, swept back, ribbed like a bat wing with a ragged notch
      s.fill(earM, (b) => b.poly([[-2.6, -4], [-0.6, -7.6], [-3.4, -9.6], [-8.2, -13.6], [-8, -10.8], [-10.4, -9.8], [-8.4, -7.8], [-8.6, -5.8], [-5.6, -4.4]]));
      s.fill(INNER, (b) => b.poly([[-2.2, -6.2], [-7.4, -12], [-7.4, -10.2], [-8.8, -9.6], [-6.6, -7.6], [-6.6, -5.8]]), { cast: false });
      s.creaseLine(-3, -6.2, -7.2, -11.4, 0.6);
      if (o.helm) {
        s.fill(METAL, (b) => {
          b.ell(0.4, -6.2, 4.6, 3.2);
          b.cut(() => b.rect(-6, -4.2, 13, 6));
          b.poly([[-4.4, -5], [4.8, -5], [5, -3.6], [-4.6, -3.6]]);
          b.poly([[-0.6, -8.8], [0.6, -13.5], [1.6, -8.8]]);
        }, { spec: 0.14 });
        s.fill(METAL, (b) => b.rect(3.8, -5, 1.2, 3.2));
        for (const x of [-3, -1, 1, 3]) s.dot(x, -4.4, "#a8acc4");
      } else {
        // brow ridge and skull crease
        s.creaseLine(1.5, -6.2, 4.4, -5.6);
        s.creaseLine(-1.5, -7.6, 0.5, -8.1, 0.75);
      }
      // eye
      if (ex === "dead") { s.line(2.6, -5.2, 3.8, -4.4, "#1a1014"); s.line(2.6, -4.4, 3.8, -5.2, "#1a1014"); }
      else if (ex === "hurt") s.line(2.6, -4.9, 4.2, -4.6, "#ffd040");
      else { s.dot(3.2, -5, "#ffe070"); s.dot(4, -5, "#ffb020"); s.glow(3.6, -4.9, "#ffc030", 2.2); }
      void a;
    },
    offhand: o.mountain ? (s) => {
      // round hide shield on the far arm
      s.fill(mat("#6a5038", { rough: 0.3 }), (b) => b.ell(1, 0, 4.5, 4.5));
      s.fill(IRON, (b) => b.ell(1, 0, 1.4, 1.4), { spec: 0.3 });
    } : undefined,
  };
  return sp;
}
function giak(o: GiakOpts): Def {
  const sp = giakSpec(o);
  return { w: 52, h: 46, flying: false, ox: -6, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ shared humanoid parts
interface LimbOpts {
  skin: Mat; sleeve?: Mat; pants?: Mat; boot?: Mat; glove?: Mat; pad?: Mat;
  legR?: [number, number, number]; armR?: [number, number, number]; footLen?: number;
  claws?: string; bones?: boolean; padR?: number; bootTop?: number; hoof?: boolean;
}
/** Standard leg/arm drawers (far side darker). */
function limbs(o: LimbOpts) {
  const lr = o.legR ?? [2.4, 1.9, 1.5], ar = o.armR ?? [2, 1.6, 1.3];
  const pick = (m: Mat | undefined, i: number) => (m ? (i ? m : dim(m)) : undefined);
  const leg = (s: Spr, j: HJ, i: number) => {
    const sk = pick(o.skin, i)!, ankle = add(j.ft[i], [0, -1.3]);
    if (o.bones) {
      limb(s, sk, [j.hp[i], j.kn[i]], [1, 0.9]);
      limb(s, sk, [j.kn[i], ankle], [0.9, 0.8]);
      s.fill(sk, (b) => { b.ell(j.kn[i][0], j.kn[i][1], 1.3, 1.2); b.ell(ankle[0] + 1.2, ankle[1] + 0.6, 2.2, 0.9); });
      s.dot(ankle[0] + 3, ankle[1] + 1, i ? "#efe6cc" : "#b8ae96");
      return;
    }
    limb(s, pick(o.pants, i) ?? sk, [j.hp[i], j.kn[i], ankle], lr);
    if (o.hoof) {
      s.fill(sk, (b) => b.capP(ankle, add(ankle, [1.2, 0.4]), 1.4));
      s.fill(pick(mat("#2a2228"), i)!, (b) => b.poly([[ankle[0] - 1, ankle[1] + 0.2], [ankle[0] + 2.6, ankle[1] + 0.2], [ankle[0] + 3, ankle[1] + 1.3], [ankle[0] - 1.4, ankle[1] + 1.3]]));
      return;
    }
    const boot = pick(o.boot, i);
    if (boot) limb(s, boot, [mid(j.kn[i], ankle, o.bootTop ?? 0.35), ankle], [lr[1] + 0.35, lr[2] + 0.3]);
    foot(s, boot ?? sk, add(ankle, [0, 1.3]), o.footLen ?? 4, 2.2);
    if (o.claws && !boot) for (const dx of [o.footLen ?? 4, (o.footLen ?? 4) - 1.6]) s.dot(ankle[0] + dx, ankle[1] + 1.2, o.claws);
  };
  const arm = (s: Spr, j: HJ, i: number) => {
    const sk = pick(o.skin, i)!, sl = pick(o.sleeve, i);
    if (o.bones) {
      limb(s, sk, [j.sh[i], j.el[i]], [1, 0.9]);
      limb(s, sk, [j.el[i], j.ha[i]], [0.8, 0.7]);
      s.fill(sk, (b) => { b.ell(j.el[i][0], j.el[i][1], 1.1, 1.1); b.ell(j.ha[i][0], j.ha[i][1], 1.4, 1.2); });
    } else {
      limb(s, sl ?? sk, [j.sh[i], j.el[i]], [ar[0], ar[1]]);
      limb(s, pick(o.glove, i) ?? sk, [j.el[i], j.ha[i]], [ar[1], ar[2]]);
      s.fill(pick(o.glove, i) ?? sk, (b) => b.ell(j.ha[i][0], j.ha[i][1], ar[2] + 0.5, ar[2] + 0.4));
    }
    if (o.claws) {
      const d = Math.atan2(j.ha[i][1] - j.el[i][1], j.ha[i][0] - j.el[i][0]);
      for (const k of [-0.6, 0, 0.6]) { const p = add(j.ha[i], dir(d + k, ar[2] + 1.6)); s.dot(p[0], p[1], i ? o.claws : hs(o.claws, -0.3)); }
    }
    if (i && o.pad) s.fill(o.pad, (b) => b.ell(j.sh[1][0], j.sh[1][1] + 0.5, o.padR ?? 3, (o.padR ?? 3) * 0.8, j.lean), { spec: 0.12 });
  };
  return { leg, arm };
}

/** A cloak hanging from the shoulders behind the body, hem rippling with the frame. */
function cloak(s: Spr, j: HJ, a: A, T: number, len: number, m: Mat, lining?: Mat) {
  const w = Math.sin(a.t * PI * 2) * 0.8, lunge = a.st === 1 || a.st === 2 ? 2.5 : 0, hurt = a.hu >= 0 ? -2 : 0;
  s.at(j.hip, j.lean, () => {
    const pts: P[] = [[1.5, -T + 0.5], [-2.5, -T + 0.5], [-4.5 - lunge * 0.5, -T * 0.4], [-7 - lunge + w + hurt, len - T * 0.15]];
    const n = 6;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      pts.push([lerp(-7 - lunge + w + hurt, -1.5 + w * 0.5, t), len - T * 0.15 + (k % 2 ? -1.8 : 0) + Math.sin(t * 3 + a.t * 6.28) * 0.6 + t * 1.2]);
    }
    pts.push([1.5, -T * 0.2]);
    if (lining) s.fill(lining, (b) => b.poly(pts.map(([x, y]) => [x - 1, y + 0.8] as P)));
    s.fill(m, (b) => b.poly(pts));
  });
}

// ============================================================ Drakkarim
function drakkar(): Def {
  const ARMR = mat("#34323e", { rim: "#7c88b0" }), PLATE = mat("#46465a", { rim: "#8a96c0" }), MAIL = mat("#2e2e38", { rough: 0.15 });
  const CLOAK = mat("#1e1a24", { rim: "#5a4a6a" }), RED = mat("#8a1a22"), LINE = mat("#6a1018");
  const b: HB = { thigh: 8, shin: 8, up: 7, fore: 6.5, torso: 13, stance: 4, hunch: 0.06 };
  const L = limbs({ skin: MAIL, boot: PLATE, glove: PLATE, sleeve: MAIL, pad: PLATE, padR: 3.6, legR: [2.8, 2.2, 1.8], armR: [2.3, 1.9, 1.6], footLen: 5, bootTop: 0.1 });
  const sp: HumSpec = {
    b, style: "swing", weapon: W.scimitar, lie: [40, 6],
    behind: (s, j, a) => { if (!a.dead) cloak(s, j, a, b.torso, b.thigh + b.shin - 2, CLOAK, LINE); },
    leg: (s, j, i) => {
      L.leg(s, j, i);
      const m = i ? PLATE : dim(PLATE);
      s.fill(m, (bb) => bb.ell(j.kn[i][0] + 0.6, j.kn[i][1], 2, 1.8), { spec: 0.15 });
      s.dot(j.kn[i][0] + 1.6, j.kn[i][1] - 1.2, i ? "#9aa4c8" : "#5a6078");
    },
    arm: (s, j, i) => {
      L.arm(s, j, i);
      if (i) {
        // spiked pauldron
        s.at(j.sh[1], j.lean, () => {
          s.fill(PLATE, (bb) => { bb.ell(0, 0.4, 3.8, 3); bb.poly([[-1.5, -1.8], [-3.5, -6.4], [0.5, -2.4]]); bb.poly([[1, -2.2], [1.6, -5.4], [2.8, -1.6]]); }, { spec: 0.1 });
          s.creaseLine(-3.4, 1.4, 3.4, 1.4, 0.6);
        });
      }
    },
    torso: (s) => {
      const T = b.torso;
      s.fill(MAIL, (bb) => { bb.ell(0, -T * 0.25, 4.6, 4); });
      s.fill(ARMR, (bb) => bb.poly([[-4.6, -T + 1], [3.8, -T + 1], [5.4, -T * 0.62], [4.6, -T * 0.3], [0, -T * 0.22], [-4.8, -T * 0.32]]), { spec: 0.08 });
      s.creaseLine(0.2, -T + 2, 1, -T * 0.32, 0.72);
      // red tabard strip and belt
      s.fill(RED, (bb) => bb.poly([[0, -T * 0.25], [3.6, -T * 0.25], [3.2, 5.5], [1.6, 4.6], [0.4, 6]]), { cast: false });
      s.fill(LEATHER, (bb) => bb.rect(-4.8, -T * 0.3, 9.8, 2));
      s.fill(IRON, (bb) => bb.ell(2.6, -T * 0.3 + 1, 1.1, 1.1), { spec: 0.3 });
      // tassets
      s.fill(PLATE, (bb) => { bb.poly([[-4.6, -T * 0.16], [-0.5, -T * 0.16], [-1, 3.2], [-5, 2.6]]); });
      // gorget
      s.fill(PLATE, (bb) => bb.ell(0.4, -T + 0.6, 3.6, 1.8), { spec: 0.15 });
    },
    head: (s, j) => {
      const ex = j.ex;
      s.fill(PLATE, (bb) => {
        bb.ell(0.4, -5.2, 4, 4.6);
        bb.poly([[1.4, -9.2], [4.8, -7.2], [5.6, -2.2], [4.4, 0], [0.6, 0.2]]);
      }, { spec: 0.1 });
      // crest of blades
      s.fill(ARMR, (bb) => bb.poly([[-3.6, -7.2], [-1.6, -9.6], [0.4, -10.2], [2.4, -9.8], [0.6, -12.6], [-1.6, -13.4], [-3.2, -12], [-5.6, -12.4], [-4.6, -9.6]]));
      // T-visor: horizontal eye slit + vertical breath slot
      s.fill(flatMat("#0c0a10"), (bb) => { bb.rect(1.2, -6.4, 4.6, 1.3); bb.rect(4, -5.6, 1.2, 3.6); }, { cast: false });
      for (const y of [-3.2, -1.8]) s.dot(2.4, y, "#14121a");
      if (ex !== "dead") {
        s.dot(3.2, -5.8, "#ff5030"); s.dot(4.6, -5.8, "#ff3020");
        s.glow(4, -5.7, "#ff3020", ex === "atk" ? 3.2 : 2.4);
      }
      s.dot(-0.6, -7.6, "#a0a8d0");
    },
  };
  return { w: 56, h: 52, flying: false, ox: -6, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ Vordak
function vordak(): Def {
  const ROBE = mat("#3a2e44", { rim: "#8a6aa8", rough: 0.15 }), ROBEd = dim(ROBE, 0.2), BONE_ = mat("#b8b8a0"), HOOD = mat("#2e2438", { rim: "#7a5a9a" });
  const b: HB = { thigh: 8.5, shin: 8.5, up: 7.5, fore: 7, torso: 14, stance: 3.4, hunch: 0.14 };
  const EYE = "#ff3a2a";
  const sp: HumSpec = {
    b, style: "swing", weapon: W.mace, lie: [44, 6],
    leg: (s, j, i, a) => {
      // only bony feet show under the robe
      const ankle = j.ft[i];
      s.fill(i ? BONE_ : dim(BONE_), (bb) => bb.poly([[ankle[0] - 1.5, ankle[1] - 1.6], [ankle[0] + 3.4, ankle[1] - 0.6], [ankle[0] + 3.6, ankle[1]], [ankle[0] - 1.6, ankle[1]]]));
      if (i === 0) return;
      // the robe skirt, hung in model space from the waist to a ragged hem
      const waist = add(j.hip, rot([0, -3], j.lean));
      const xs = [j.ft[0][0], j.ft[1][0], waist[0]];
      const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 5.5;
      const hemY = a.dead ? -0.5 : -1.2;
      const pts: P[] = [add(waist, rot([-5, 0], j.lean)), add(waist, rot([5, 0], j.lean))];
      const n = 9;
      for (let k = 0; k <= n; k++) {
        const x = lerp(x1, x0, k / n), rag = (k % 2 ? 2.2 : 0) + hash(k, 3) * 1.2 + Math.sin(a.t * 6.28 + k) * 0.6;
        pts.push([x, hemY - rag + (k === 0 || k === n ? 1 : 0)]);
      }
      s.fill(ROBE, (bb) => bb.poly(pts), { tex: (x, y, t, mx) => (Math.abs(Math.sin(mx * 0.9)) < 0.18 ? t - 1 : t) });
    },
    arm: (s, j, i) => {
      const m = i ? ROBE : ROBEd, bm = i ? BONE_ : dim(BONE_);
      s.fill(m, (bb) => { bb.capP(j.sh[i], j.el[i], 2.6, 2.4); bb.capP(j.el[i], mid(j.el[i], j.ha[i], 0.7), 2.4, 3.2); });
      // bony hand with long fingers
      const d = Math.atan2(j.ha[i][1] - j.el[i][1], j.ha[i][0] - j.el[i][0]);
      s.fill(bm, (bb) => { bb.ell(j.ha[i][0], j.ha[i][1], 1.4, 1.2); for (const k of [-0.5, 0, 0.5]) { const p = add(j.ha[i], dir(d + k, 2.6)); bb.capP(j.ha[i], p, 0.5); } });
    },
    torso: (s) => {
      const T = b.torso;
      s.fill(ROBE, (bb) => { bb.poly([[-5, -T + 1.5], [4, -T + 1.5], [5.6, -T * 0.5], [5, 0], [-5, 0], [-6, -T * 0.5]]); }, { tex: (x, y, t, mx) => (Math.abs(Math.sin(mx * 1.1 + 0.5)) < 0.15 ? t - 1 : t) });
      s.fill(mat("#4a3a2a"), (bb) => bb.rect(-5.4, -4, 11, 1.4), { cast: false });
      s.fill(GOLD, (bb) => bb.ell(1.6, -3.3, 1.2, 1.2), { spec: 0.3 });
      s.dot(1.6, -3.3, "#c02020");
    },
    head: (s, j, a) => {
      const ex = j.ex;
      // deep hood
      s.fill(HOOD, (bb) => { bb.ell(-0.4, -5.6, 5.4, 5.6); bb.poly([[-5.6, -4], [-3.4, -12.8], [0.6, -11.6], [-5.4, 1]]); bb.poly([[-4, 1.4], [5.6, 0.6], [5.6, -3], [-4, -3]]); });
      s.fill(flatMat("#0a060e"), (bb) => bb.ell(2.6, -4.6, 3.2, 4), { cast: false });
      // skull face, gaunt, lit from the eyes
      s.fill(mat("#8a8c7a"), (bb) => { bb.ell(2.6, -4.9, 2.6, 3); bb.poly([[1, -2.4], [5, -2.4], [4.4, 0.2], [1.6, 0.2]]); }, { hi: 0.4 });
      s.fill(flatMat("#140c10"), (bb) => { bb.ell(3.5, -5.2, 1.1, 1); }, { cast: false });
      s.dot(4.8, -3.6, "#1a1014");
      for (const x of [2, 3, 4]) { s.dot(x, -1.2, "#1a1014"); }
      s.line(1.6, -0.6, 4.4, -0.6, "#3a3028");
      if (ex !== "dead") {
        const big = ex === "atk" || a.pose === "idle" && a.f === 2;
        s.dot(3.6, -5.2, "#ffd0a0");
        s.glow(3.6, -5.1, EYE, big ? 2.6 : 1.8);
      }
    },
    front: (s, j, a) => {
      // mind attack: crimson ripples from the brow while the mace comes down
      if (a.st === 0) s.glow(j.neck[0] + 3, j.neck[1] - 5, "#c040ff", 4.5);
      if (a.st === 1 || a.st === 2) s.ripple(j.neck[0] + 5 + a.st * 3, j.neck[1] - 5, 3 + a.st * 2, "#d070ff");
    },
  };
  return { w: 56, h: 56, flying: false, ox: -6, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ skeletons
function ribcage(s: Spr, T: number, m: Mat) {
  // spine, ribs and pelvis
  s.fill(m, (bb) => bb.cap(-1.6, 0, -1.2, -T + 1, 0.9));
  s.fill(m, (bb) => { for (let k = 0; k < 4; k++) { const y = -T + 3 + k * 2.1; bb.ell(0.2, y, 3.6 - k * 0.3, 0.75); } });
  s.fill(flatMat("#1a1418"), (bb) => { for (let k = 0; k < 3; k++) bb.ell(0.4, -T + 4.1 + k * 2.1, 2.6 - k * 0.3, 0.35); }, { cast: false });
  s.fill(m, (bb) => { bb.poly([[-3.4, -1.8], [3, -1.8], [2, 1.2], [0, 0.4], [-2.4, 1.2]]); });
  s.dot(0, -0.6, "#1a1418");
}
function skull(s: Spr, ex: Ex, m: Mat, eye: string, jaw = true) {
  s.fill(m, (bb) => { bb.ell(0.6, -5, 3.8, 3.8); bb.ell(2.6, -2.8, 2.2, 1.8); });
  if (jaw) s.fill(m, (bb) => bb.poly([[0, -1.8], [4.4, -1.8], [4.2, ex === "atk" ? 1.6 : 0.4], [0.6, ex === "atk" ? 1 : 0.2]]));
  s.fill(flatMat("#120c10"), (bb) => { bb.ell(2.8, -5, 1.3, 1.2); }, { cast: false });
  s.dot(4.4, -3.4, "#120c10");
  for (const x of [1.4, 2.4, 3.4]) s.dot(x, -1.6, "#3a3028");
  s.creaseLine(1, -1, 4.2, -1, 0.5);
  if (ex === "dead") return;
  s.glow(3, -5, eye, ex === "atk" ? 3 : 2.2);
}
function skeleton(king: boolean): Def {
  const BN = mat(king ? "#cfc4a2" : "#d8cfb4"), RUST = mat("#8a5a3a", { rough: 0.5 });
  const CAPE = mat("#5a1e3a", { rim: "#b06090" }), ERM = mat("#ece8e0"), CROWN = GOLD;
  const b: HB = king ? { thigh: 8, shin: 8, up: 7, fore: 6.5, torso: 13, stance: 3.6, hunch: 0.04 } : { thigh: 7.5, shin: 7.5, up: 6.5, fore: 6, torso: 12, stance: 3.4, hunch: 0.1 };
  const L = limbs({ skin: BN, bones: true });
  const eye = king ? "#60e0ff" : "#ff5040";
  const sp: HumSpec = {
    b, style: "swing", weapon: king ? W.sword : (s, a) => { const t = W.sword(s, a); s.fill(RUST, (bb) => { bb.ell(6, 0.4, 1, 0.8); bb.ell(10, -0.3, 0.8, 0.6); }, { cast: false }); return t; },
    lie: [40, 4],
    behind: king ? (s, j, a) => { if (!a.dead) cloak(s, j, a, b.torso, b.thigh + b.shin - 1, CAPE, dim(CAPE, 0.4)); } : undefined,
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => {
      L.arm(s, j, i);
      if (i && king) s.fill(GOLD, (bb) => bb.ell(j.sh[1][0], j.sh[1][1], 2.8, 2.2, j.lean), { spec: 0.2 });
    },
    offhand: king ? undefined : (s) => {
      s.fill(mat("#5a4a3a", { rough: 0.4 }), (bb) => bb.ell(1, 0, 4.4, 4.8));
      s.fill(RUST, (bb) => { bb.ell(1, 0, 4.4, 4.8); bb.cut(() => bb.ell(1, 0, 3.4, 3.8)); }, { cast: false });
      s.fill(IRON, (bb) => bb.ell(1, 0, 1.4, 1.4), { spec: 0.3 });
    },
    torso: (s) => {
      ribcage(s, b.torso, BN);
      if (king) {
        s.fill(GOLD, (bb) => bb.rect(-3.6, -3.2, 7.4, 1.4), { spec: 0.2 });
        s.fill(mat("#4a1a30"), (bb) => bb.poly([[-3, -2], [3.4, -2], [3, 4], [-2.6, 4]]), { cast: false });
        s.fill(ERM, (bb) => bb.ell(0, -b.torso + 0.5, 4.6, 2.2), { tex: (x, y, t) => ((x * 3 + y * 5) % 7 === 0 ? 0 : t) });
      }
    },
    head: (s, j) => {
      skull(s, j.ex, BN, eye);
      if (king) {
        s.fill(CROWN, (bb) => { bb.rect(-3, -9.4, 7.4, 2.2); for (const x of [-2.6, 0.6, 3.6]) bb.poly([[x - 1.1, -9], [x, -12.2], [x + 1.1, -9]]); }, { spec: 0.25 });
        s.dot(0.6, -8.4, "#e02040"); s.dot(3.4, -8.4, "#40a0ff");
        s.glow(0.6, -12.2, "#ffe080", 1.5);
      }
    },
  };
  return { w: 52, h: king ? 54 : 50, flying: false, ox: -5, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ zombie, crypt spawn
function zombie(): Def {
  const SK = mat("#7a8a6a", { rough: 0.3 }), SHIRT = mat("#6a5a48", { rough: 0.4 }), PANTS = mat("#3e3a44");
  const b: HB = { thigh: 7.5, shin: 7.5, up: 6.5, fore: 6, torso: 12, stance: 3.6, hunch: 0.22 };
  const L = limbs({ skin: SK, sleeve: SHIRT, pants: PANTS, claws: "#d8d0b0", footLen: 4 });
  const sp: HumSpec = {
    b, style: "claw", lie: [38, 5],
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => L.arm(s, j, i),
    torso: (s) => {
      const T = b.torso;
      s.fill(SHIRT, (bb) => { bb.poly([[-4.4, -T + 1], [3.6, -T + 1], [4.6, -T * 0.4], [4.4, 1], [2, 2.4], [0.4, 0.8], [-2, 2.6], [-4.4, 1]]); });
      // a rent in the shirt showing rotten ribs
      s.fill(SK, (bb) => bb.poly([[0.6, -T * 0.72], [3.6, -T * 0.66], [3, -T * 0.36], [1, -T * 0.42]]));
      for (let k = 0; k < 3; k++) s.creaseLine(1, -T * 0.66 + k * 1.3, 3.2, -T * 0.62 + k * 1.3, 0.55);
      s.fill(LEATHER, (bb) => bb.rect(-4.4, -1.6, 8.8, 1.3), { cast: false });
    },
    head: (s, j) => {
      const ex = j.ex;
      s.fill(SK, (bb) => { bb.ell(0.6, -4.8, 3.8, 4.2); bb.poly([[0, -2], [4.6, -2.4], [4.4, ex === "atk" ? 1.8 : 0.4], [0.6, 0.6]]); });
      s.fill(mat("#3a3228", { rough: 0.8 }), (bb) => bb.poly([[-3.4, -6], [-1, -9.4], [2.6, -9.2], [3.6, -7.6], [0.8, -8.2], [-2.4, -4]]));
      s.fill(flatMat("#1a1416"), (bb) => bb.ell(2.8, -5, 1.2, 1.1), { cast: false });
      if (ex === "atk") s.fill(flatMat("#2a0c10"), (bb) => bb.poly([[1.4, -1.2], [4.2, -1.4], [4, 1], [1.6, 0.4]]), { cast: false });
      else s.line(1.4, -0.8, 4.2, -1, "#2a1a1a");
      s.dot(4.6, -3.4, "#4a5a3a");
      if (ex !== "dead") s.glow(3, -5, "#c0ff60", 1.8);
    },
  };
  return { w: 52, h: 48, flying: false, ox: -4, draw: (s, a) => drawHum(s, a, sp) };
}

function cryptSpawn(): Def {
  const SK = mat("#9aa0a4", { rough: 0.25 }), SHROUD = mat("#6a645a", { rough: 0.5 }), GUM = "#5a1a2a";
  const b: HB = { thigh: 7, shin: 7.5, up: 9, fore: 9, torso: 13, stance: 4.2, hunch: 0.55 };
  const L = limbs({ skin: SK, claws: "#f0ead8", legR: [2.2, 1.6, 1.3], armR: [2, 1.5, 1.6], footLen: 5 });
  const sp: HumSpec = {
    b, style: "claw", lie: [40, 6],
    behind: (s, j, a) => {
      if (a.dead) return;
      // tattered burial shroud hanging from the hunched back
      s.at(j.hip, j.lean, () => s.fill(dim(SHROUD, 0.1), (bb) => bb.poly([[-4, -b.torso], [2, -b.torso - 1], [-2, -b.torso * 0.3], [-6 + Math.sin(a.t * 6.28), 6], [-4.6, 3.6], [-3.6, 7], [-2.4, 2]])));
    },
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => {
      L.arm(s, j, i);
      if (i) s.fill(SHROUD, (bb) => bb.capP(j.sh[1], mid(j.sh[1], j.el[1], 0.6), 2.6, 2.2));
    },
    torso: (s) => {
      const T = b.torso;
      s.fill(SK, (bb) => { bb.ell(0.8, -T * 0.4, 5.6, 6.2); bb.ell(-0.6, -T * 0.82, 4.6, 3.8); });
      // split belly with ribs showing through
      s.fill(flatMat("#2a1820"), (bb) => bb.ell(2.6, -T * 0.5, 2.2, 3.2), { cast: false });
      for (let k = 0; k < 3; k++) s.fill(mat("#e0d8c0"), (bb) => bb.cap(1.2, -T * 0.66 + k * 1.6, 4.2, -T * 0.6 + k * 1.6, 0.5), { cast: false });
      s.fill(SHROUD, (bb) => bb.poly([[-5, -2], [5, -2.6], [5.6, 2.6], [3.4, 1.4], [1.6, 3.6], [-0.6, 1.4], [-2.4, 3], [-5, 1]]));
      s.creaseLine(-4, -T, 1, -T * 1.05, 0.7);
    },
    head: (s, j) => {
      const ex = j.ex, open = ex === "atk" || ex === "hurt";
      // long, low skull with a lipless maw
      s.fill(SK, (bb) => { bb.ell(1.4, -3.6, 4.6, 3.2, 0.15); bb.ell(5, -2.4, 2.4, 1.8); });
      s.fill(SK, (bb) => bb.poly([[0, -1], [6.8, open ? 1.6 : -0.6], [6, open ? 3.2 : 0.6], [0.4, 1]]));
      s.fill(flatMat(GUM), (bb) => bb.poly([[1, -1.4], [7, -1.6], [6.6, open ? 1.4 : -0.6], [1, 0]]), { cast: false });
      for (let x = 1.6; x < 7; x += 1.1) { s.dot(x, -1.4, "#f4eedc"); s.dot(x + 0.4, open ? 1 : -0.4, "#e0d8c0"); }
      s.fill(flatMat("#0c0810"), (bb) => bb.ell(3.6, -4.4, 1.4, 1), { cast: false });
      s.creaseLine(-2, -6, 3, -6.6, 0.7);
      if (ex !== "dead") s.glow(3.8, -4.4, "#80ffd0", ex === "atk" ? 2.8 : 2);
    },
  };
  return { w: 56, h: 48, flying: false, ox: -6, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ Gourgaz
function gourgaz(): Def {
  const SC = mat("#5a6a34", { rough: 0.2 }), BELLY = mat("#c0b070"), SPINE = mat("#8a4a2a");
  const HARN = LEATHER;
  const b: HB = { thigh: 9, shin: 9, up: 8, fore: 8, torso: 15, stance: 5, hunch: 0.3 };
  const L = limbs({ skin: SC, claws: "#efe6c8", legR: [3.4, 2.6, 2], armR: [2.8, 2.4, 2], footLen: 5.5 });
  const scales = (x: number, y: number, t: number, mx: number, my: number) => ((Math.floor(mx * 0.8 + Math.floor(my * 0.7) * 0.5) + Math.floor(my * 0.7)) % 2 === 0 && t > 1 && hash(x, y) < 0.5 ? t - 1 : t);
  const sp: HumSpec = {
    b, style: "chop", lie: [50, 7],
    weapon: (s) => { s.save(); s.translate(-4, 0); const t = W.axe(s, anim("idle", 0)); s.restore(); return [t[0] - 4, t[1]]; },
    behind: (s, j, a) => {
      // heavy tail dragging on the ground
      const sw = Math.sin(a.t * 6.28) * 1.2;
      s.fill(SC, (bb) => bb.chain([[j.hip[0] - 1, j.hip[1] + 1, 3.6], [j.hip[0] - 7, j.hip[1] + 6, 2.8], [j.hip[0] - 13 + sw, -2.6, 1.8], [j.hip[0] - 19 + sw, -1, 0.7]]), { tex: scales });
      for (let k = 0; k < 4; k++) { const p: P = [j.hip[0] - 4 - k * 4 + sw * k * 0.25, j.hip[1] + 2 + k * 2.6 - (k > 2 ? 1 : 0)]; s.fill(SPINE, (bb) => bb.poly([[p[0] - 1, p[1] - 1.5], [p[0] - 2.2, p[1] - 4], [p[0] + 0.8, p[1] - 2]])); }
    },
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => {
      L.arm(s, j, i);
      if (i) s.fill(mat("#6a5040"), (bb) => bb.ell(j.sh[1][0], j.sh[1][1] + 0.5, 3.4, 2.8, j.lean), { tex: (x, y, t) => (hash(x, y, 2) < 0.2 ? t - 1 : t) });
    },
    torso: (s) => {
      const T = b.torso;
      s.fill(SC, (bb) => { bb.ell(0, -T * 0.66, 6.4, 5.8); bb.ell(0.6, -T * 0.25, 5.4, 4.6); }, { tex: scales });
      s.fill(BELLY, (bb) => { bb.ell(3.4, -T * 0.42, 2.8, 5.6); }, { tex: (x, y, t, mx, my) => (Math.abs(my % 2) < 0.5 ? t - 1 : t) });
      // dorsal spines
      for (let k = 0; k < 4; k++) s.fill(SPINE, (bb) => bb.poly([[-5.6 + k * 0.3, -T * 0.4 - k * 2.6], [-9 + k * 0.4, -T * 0.5 - k * 2.6], [-5.2 + k * 0.4, -T * 0.55 - k * 2.6]]));
      // harness
      s.fill(HARN, (bb) => bb.poly([[-5, -T + 1.6], [-3.4, -T + 0.6], [5.4, -T * 0.25], [4.6, -T * 0.12]]), { cast: false });
      s.fill(HARN, (bb) => bb.rect(-5.6, -2.8, 11.6, 2.2), { cast: false });
      s.fill(IRON, (bb) => bb.ell(1.4, -T * 0.6, 1.2, 1.2), { spec: 0.3 });
      s.fill(mat("#4a3a2a"), (bb) => bb.poly([[-3, -0.8], [4.2, -0.8], [3.6, 4.6], [1.6, 3.4], [-0.6, 4.8], [-2.6, 3.2]]), { cast: false });
    },
    head: (s, j) => {
      const ex = j.ex, open = ex === "atk" || ex === "hurt";
      s.fill(SC, (bb) => {
        bb.ell(0.6, -4.2, 4.2, 3.6);
        bb.poly([[1, -7], [9.6, -4.4], [10, -2.6], [2, -1]]);
        bb.poly([[0, -1.8], [9, open ? 1.8 : -1.4], [8.4, open ? 3 : -0.2], [0.4, 1.4]]);
      }, { tex: scales });
      s.fill(flatMat("#3a1014"), (bb) => bb.poly([[2, -1.6], [9.4, -2.4], [8.6, open ? 1.6 : -1.2], [2, -0.2]]), { cast: false });
      for (let x = 3; x < 9.5; x += 1.3) { s.dot(x, -2.2, "#f4ecd0"); if (open) s.dot(x - 0.5, 1.2 - (x - 3) * 0.05, "#e0d6b8"); }
      // horned brow and slit eye
      s.fill(SPINE, (bb) => bb.poly([[-1.6, -6.4], [-5.6, -9.4], [-1, -8], [2.6, -7.2]]));
      s.creaseLine(1.6, -6.6, 4.6, -5.8, 0.55);
      s.dot(9.2, -4, "#1a1410");
      if (ex !== "dead") { s.dot(3.2, -5.2, "#ffe040"); s.dot(3.8, -5.2, "#ff9020"); s.glow(3.5, -5.2, "#ffc020", 2); }
    },
  };
  return { w: 68, h: 60, flying: false, ox: -2, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ Kakarmi
function kakarmi(): Def {
  const FUR = mat("#8a6240", { rough: 0.45 }), FACE = mat("#d8b88a"), CLOTH = mat("#4a6a3a");
  const b: HB = { thigh: 4, shin: 4, up: 4, fore: 3.6, torso: 7, stance: 2.4, hunch: 0.06 };
  const L = limbs({ skin: FUR, legR: [1.9, 1.6, 1.4], armR: [1.5, 1.3, 1.2], footLen: 3.4 });
  const sp: HumSpec = {
    b, style: "staff", weapon: (s, a) => { s.save(); s.scale(0.8, 1); const t = W.staff(s, a); s.restore(); return [t[0] * 0.8, t[1]]; }, lie: [24, 4],
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => L.arm(s, j, i),
    torso: (s) => {
      s.fill(FUR, (bb) => { bb.ell(0.3, -3.6, 3.6, 4.2); });
      s.fill(FACE, (bb) => bb.ell(1.8, -3.4, 1.6, 3), { cast: false });
      // leaf mantle and satchel strap
      s.fill(CLOTH, (bb) => bb.poly([[-3.8, -7], [3, -7.2], [3.6, -5], [1.6, -5.6], [0, -4.4], [-1.8, -5.6], [-4, -4.6]]), { tex: (x, y, t) => (x % 3 === 0 ? t - 1 : t) });
      s.fill(LEATHER, (bb) => bb.cap(-3, -6.4, 3, -1.2, 0.5), { cast: false });
      s.fill(mat("#7a5a3a"), (bb) => bb.ell(-3, -1.4, 1.8, 1.6));
    },
    head: (s, j) => {
      const ex = j.ex;
      s.fill(FUR, (bb) => { bb.ell(0.4, -4.4, 4.4, 4); bb.ell(-1.8, -8.4, 1.6, 1.8); bb.ell(2.6, -8.2, 1.4, 1.6); });
      s.fill(mat("#c08a70"), (bb) => bb.ell(-1.6, -8.2, 0.7, 0.9), { cast: false });
      s.fill(FACE, (bb) => { bb.ell(2.4, -3.4, 2.6, 2.4); });
      s.dot(4.8, -3.6, "#2a1a14");
      if (ex === "dead") { s.line(2, -5.4, 3.2, -4.4, "#1a1010"); s.line(2, -4.4, 3.2, -5.4, "#1a1010"); return; }
      if (ex === "hurt") { s.line(1.8, -5, 3.6, -4.6, "#1a1010"); return; }
      s.fill(flatMat("#1a120e"), (bb) => bb.ell(2.6, -4.9, 1.1, 1.3), { cast: false });
      s.dot(2.4, -5.4, "#ffffff");
      s.dot(3, -4.4, "#6a4a2a");
      s.line(3.2, -2.4, 4.4, -2.6, "#6a4a3a");
    },
  };
  return { w: 36, h: 34, flying: false, ox: -3, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ big brutes: troll, giant, demon, beastman
function troll(): Def {
  const SK = mat("#6a7a5a", { rough: 0.3 }), MOSS = mat("#4a5a2a", { rough: 0.8 }), CLOTH = mat("#5a4632", { rough: 0.4 });
  const b: HB = { thigh: 9, shin: 9, up: 10, fore: 9, torso: 16, stance: 5.5, hunch: 0.35 };
  const L = limbs({ skin: SK, legR: [3.6, 3, 2.4], armR: [3.2, 2.8, 2.6], footLen: 6, claws: "#d8d0b0" });
  const sp: HumSpec = {
    b, style: "swing", lie: [54, 8],
    weapon: (s, a) => { s.save(); s.scale(1.3, 1.3); const t = W.club(s, a); s.restore(); return [t[0] * 1.3, 0]; },
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => L.arm(s, j, i),
    torso: (s) => {
      const T = b.torso;
      s.fill(SK, (bb) => { bb.ell(-0.6, -T * 0.7, 7, 6); bb.ell(1.4, -T * 0.32, 6.6, 6); });
      s.fill(mat("#8a9a72"), (bb) => bb.ell(3.6, -T * 0.32, 3.4, 4.6), { cast: false });
      s.fill(MOSS, (bb) => { bb.ell(-3, -T * 0.9, 4.6, 2.4); bb.ell(-5, -T * 0.66, 2.2, 3); });
      s.fill(CLOTH, (bb) => bb.poly([[-5.6, -2.6], [6.6, -2.6], [5.6, 4], [3, 2.6], [0.6, 4.8], [-2, 2.6], [-5, 4]]));
      s.fill(LEATHER, (bb) => bb.rect(-5.8, -3.4, 12.6, 1.8), { cast: false });
    },
    head: (s, j) => {
      const ex = j.ex, open = ex === "atk" || ex === "hurt";
      s.fill(SK, (bb) => { bb.ell(1, -4.8, 4.6, 4.4); bb.poly([[-1, -2], [7, -2.6], [7, open ? 2.4 : 1], [0, 1.6]]); });
      s.fill(SK, (bb) => bb.ell(6, -4.6, 2, 2.4));
      if (open) s.fill(flatMat("#3a1418"), (bb) => bb.poly([[2.6, -1.6], [6.8, -1.8], [6.4, 1.4], [3, 0.6]]), { cast: false });
      else s.line(2.6, -1, 6.8, -1.4, "#2a2018");
      s.fill(mat("#ece0c0"), (bb) => { bb.poly([[5.2, -1.4], [6.2, -4.2], [6.6, -1.2]]); bb.poly([[2.6, -1], [3.2, -3.4], [3.8, -0.8]]); });
      s.fill(mat("#2a2a1e", { rough: 0.9 }), (bb) => bb.poly([[-3.4, -6], [-1.6, -9.8], [2, -9.6], [-0.4, -8], [-2.6, -3]]));
      s.creaseLine(2, -6.6, 5.4, -6, 0.5);
      if (ex !== "dead") s.glow(4.2, -5.6, "#ffb030", 1.8);
    },
  };
  return { w: 64, h: 62, flying: false, ox: -4, draw: (s, a) => drawHum(s, a, sp) };
}

function giant(): Def {
  const SK = mat("#c89a78"), HIDE = mat("#7a5a3a", { rough: 0.4 }), FUR = mat("#9a8a70", { rough: 0.9 }), BEARD = mat("#8a5a2a", { rough: 0.6 });
  const b: HB = { thigh: 12, shin: 12, up: 11, fore: 10, torso: 20, stance: 6, hunch: 0.12 };
  const L = limbs({ skin: SK, pants: HIDE, boot: mat("#4a3426"), legR: [4, 3.2, 2.6], armR: [3.4, 3, 2.6], footLen: 7 });
  const sp: HumSpec = {
    b, style: "swing", lie: [66, 9],
    weapon: (s, a) => { s.save(); s.scale(1.6, 1.5); const t = W.club(s, a); s.restore(); return [t[0] * 1.6, 0]; },
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => {
      L.arm(s, j, i);
      if (i) s.fill(FUR, (bb) => bb.ell(j.sh[1][0], j.sh[1][1] + 0.6, 4.2, 3.4, j.lean));
    },
    torso: (s) => {
      const T = b.torso;
      s.fill(HIDE, (bb) => { bb.poly([[-7, -T + 1.5], [6, -T + 1.5], [8, -T * 0.5], [7.6, 1], [-7.4, 1], [-8, -T * 0.5]]); }, { tex: (x, y, t, mx, my) => (Math.abs(mx - my * 0.3 + 2) < 0.5 ? t - 1 : t) });
      s.fill(FUR, (bb) => bb.ell(-0.6, -T + 1.6, 7.4, 3));
      s.fill(LEATHER, (bb) => bb.rect(-7.8, -4.4, 16, 2.4), { cast: false });
      s.fill(GOLD, (bb) => bb.rect(1.6, -4.8, 3, 3.2), { spec: 0.2 });
    },
    head: (s, j) => {
      const ex = j.ex;
      s.fill(SK, (bb) => { bb.ell(1, -6, 5, 5.4); bb.ell(5.6, -5.4, 1.6, 1.8); });
      s.fill(BEARD, (bb) => { bb.poly([[-2.6, -5], [5.6, -3.6], [6.4, -1], [4.6, 3.6], [1.4, 4.2], [-1.8, 0.4]]); bb.poly([[-4.2, -7.4], [-1, -11.6], [4.4, -11.4], [6, -9], [1, -9.6], [-2.4, -4.4]]); });
      s.creaseLine(2.6, -7.8, 5.8, -7.2, 0.55);
      if (ex === "atk" || ex === "hurt") s.fill(flatMat("#3a1414"), (bb) => bb.ell(4.4, -2.2, 1.4, 1.2), { cast: false });
      if (ex !== "dead") { s.dot(4.4, -6.8, "#f0f0f0"); s.dot(4.8, -6.8, "#2a3a6a"); }
    },
  };
  return { w: 76, h: 76, flying: false, ox: -6, draw: (s, a) => drawHum(s, a, sp) };
}

function demon(): Def {
  const SK = mat("#a02a2a", { rim: "#ff8a40" }), HORN = mat("#2e2a26"), WING = mat("#5a1a24", { rim: "#c04a3a" });
  const b: HB = { thigh: 9, shin: 9, up: 8.5, fore: 8, torso: 15, stance: 5, hunch: 0.2 };
  const L = limbs({ skin: SK, legR: [3.2, 2.4, 1.8], armR: [2.8, 2.3, 2], claws: "#f0e0c0", hoof: true });
  const sp: HumSpec = {
    b, style: "claw", lie: [52, 7],
    behind: (s, j, a) => {
      if (a.dead) return;
      const flap = a.pose === "idle" ? 0.35 + a.s * 0.18 : a.st === 0 ? 0.05 : a.st >= 1 ? 0.75 : a.hu >= 0 ? 0.6 : 0.3 + a.s * 0.3;
      const sh = add(j.neck, rot([-3, 2], j.lean));
      batWing(s, dim(WING, 0.25), add(sh, [2, -1]), flap - 0.06, 22, true);
      batWing(s, WING, sh, flap, 24, false);
      // tail
      s.fill(SK, (bb) => bb.chain([[j.hip[0] - 2, j.hip[1] + 1, 1.8], [j.hip[0] - 9, j.hip[1] + 6, 1.2], [j.hip[0] - 13, -3 + a.s, 0.8], [j.hip[0] - 15, -7 + a.s, 0.5]]));
      s.fill(HORN, (bb) => bb.poly([[j.hip[0] - 15, -9 + a.s], [j.hip[0] - 17, -6 + a.s], [j.hip[0] - 13.6, -6.6 + a.s]]));
    },
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => L.arm(s, j, i),
    torso: (s) => {
      const T = b.torso;
      s.fill(SK, (bb) => { bb.ell(0, -T * 0.68, 6.4, 5.6); bb.ell(0.6, -T * 0.26, 4.6, 4.6); });
      for (let k = 0; k < 3; k++) s.creaseLine(1, -T * 0.42 + k * 2.4, 4.4, -T * 0.42 + k * 2.4, 0.7);
      s.creaseLine(1.4, -T * 0.86, 1.8, -T * 0.55, 0.7);
      s.fill(mat("#2a1a1a"), (bb) => bb.poly([[-4.6, -2.6], [5, -2.6], [4.4, 3], [0.4, 1.6], [-4, 3]]));
      s.fill(GOLD, (bb) => bb.rect(-4.8, -3.2, 10, 1.4), { spec: 0.2 });
    },
    head: (s, j) => {
      const ex = j.ex, open = ex === "atk" || ex === "hurt";
      s.fill(HORN, (bb) => bb.poly([[-2, -7], [-6, -10.6], [-6.4, -14.4], [-4, -11], [0.2, -8.6]]));
      s.fill(SK, (bb) => { bb.ell(0.8, -4.8, 4, 4.2); bb.poly([[1, -3.4], [6, -3.2], [5.6, open ? 1.6 : 0.4], [1, 0.8]]); });
      s.fill(HORN, (bb) => bb.poly([[0.6, -7.6], [1.6, -12.6], [4.6, -14.6], [3, -11.4], [3, -7.2]]), { spec: 0.1 });
      if (open) s.fill(flatMat("#2a0606"), (bb) => bb.poly([[2, -1.6], [5.8, -1.6], [5.4, 1.2], [2.4, 0.4]]), { cast: false });
      else s.line(2, -1, 5.6, -1.2, "#3a0a0a");
      s.dot(3, -1.4, "#fff0d0"); s.dot(5, -1.4, "#fff0d0");
      s.creaseLine(2, -6, 5, -5, 0.5);
      if (ex !== "dead") { s.dot(3.6, -4.8, "#ffff80"); s.glow(3.8, -4.8, "#ffd020", 2.4); }
    },
  };
  return { w: 76, h: 66, flying: false, ox: -2, draw: (s, a) => drawHum(s, a, sp) };
}

function beastman(): Def {
  const FUR = mat("#6a4a34", { rough: 0.5 }), MANE = mat("#3a2a22", { rough: 0.9 }), SCALE = mat("#5a5a64", { rim: "#9aa0c0" }), CLOTH = mat("#6a2a2a");
  const b: HB = { thigh: 8, shin: 8, up: 7, fore: 6.5, torso: 13, stance: 4, hunch: 0.16 };
  const L = limbs({ skin: FUR, pants: dim(CLOTH, 0.1), boot: LEATHER, legR: [2.8, 2.2, 1.7], armR: [2.3, 1.9, 1.6], pad: SCALE, padR: 3.2, footLen: 5, claws: "#e8dcc0" });
  const sp: HumSpec = {
    b, style: "thrust", weapon: W.halberd, lie: [42, 6],
    leg: (s, j, i) => L.leg(s, j, i),
    arm: (s, j, i) => L.arm(s, j, i),
    torso: (s) => {
      const T = b.torso;
      s.fill(SCALE, (bb) => bb.poly([[-4.8, -T + 1], [4, -T + 1], [5.4, -T * 0.5], [4.8, 1.6], [-4.8, 1.6], [-5.4, -T * 0.5]]), { tex: (x, y, t, mx, my) => ((Math.floor(my) % 2 === 0 ? Math.floor(mx + 0.5) : Math.floor(mx)) % 2 === 0 && t > 0 ? t - 1 : t) });
      s.fill(CLOTH, (bb) => bb.poly([[-1, -2], [3.6, -2], [3, 5.6], [-0.6, 5.6]]), { cast: false });
      s.fill(LEATHER, (bb) => bb.rect(-5, -2.8, 10.4, 1.8), { cast: false });
      s.fill(MANE, (bb) => bb.ell(-1.6, -T + 1, 5, 2.6));
    },
    head: (s, j) => {
      const ex = j.ex, open = ex === "atk" || ex === "hurt";
      s.fill(MANE, (bb) => bb.poly([[-5, -3], [-4.6, -9], [-1.6, -11], [1, -8.8], [-0.6, -2]]));
      s.fill(FUR, (bb) => { bb.ell(0.6, -5, 4, 3.8); bb.poly([[2, -6.4], [8.2, -4.4], [8.4, -2.2], [2, -1.6]]); bb.poly([[0.6, -2], [7.4, open ? 0.4 : -1.4], [7, open ? 2 : -0.2], [0.8, 0.6]]); });
      s.fill(FUR, (bb) => bb.poly([[-1.6, -7.2], [-3, -12.2], [0.8, -8.4]]));
      s.fill(flatMat("#1a1012"), (bb) => bb.ell(8, -3.8, 0.8, 0.8), { cast: false });
      if (open) s.fill(flatMat("#3a0c12"), (bb) => bb.poly([[2.4, -1.6], [7.8, -1.6], [7, 0.8], [2.6, 0.2]]), { cast: false });
      s.fill(mat("#f0e6cc"), (bb) => bb.poly([[5.4, -1], [6, -4.2], [6.8, -0.8]]));
      s.creaseLine(1.6, -6.6, 4.4, -5.8, 0.5);
      if (ex !== "dead") s.glow(3.4, -5.4, "#ff7030", 2);
    },
  };
  return { w: 64, h: 52, flying: false, ox: -9, draw: (s, a) => drawHum(s, a, sp) };
}

// ============================================================ wings
/**
 * Leathery wing from the shoulder: arm, forearm, three or four finger spars and a scalloped
 * membrane back to the flank. u = 1 raised, 0.5 swept back, 0 lowered.
 */
function batWing(s: Spr, m: Mat, sh: P, u: number, span: number, far: boolean, root?: P) {
  const a1 = lerp(-4.0, -2.15, u), a2 = a1 + lerp(0.2, 0.95, u);
  const E = add(sh, dir(a1, span * 0.3)), Wr = add(E, dir(a2, span * 0.28));
  const tips: P[] = [0, 1, 2, 3].map((k) => add(Wr, dir(a2 - 0.15 - k * lerp(0.42, 0.62, u), span * (0.5 - k * 0.05))));
  const back = root ?? add(sh, dir(a1 + PI * 0.75, span * 0.12));
  const poly: P[] = [sh, E, Wr, tips[0]];
  for (let k = 1; k < 4; k++) {
    const mm = mid(tips[k - 1], tips[k]);
    poly.push(mid(mm, Wr, 0.24), tips[k]);
  }
  poly.push(mid(mid(tips[3], back), Wr, 0.2), back);
  const mem = far ? dim(m, 0.12) : m;
  s.fill(mem, (b) => b.poly(poly), { tex: (x, y, t) => (t > 2 ? 2 : t), hi: 0.08, mid: 0.7 });
  const bone = { t: m.t.map((c) => hs(c, 0.12)), rough: 0, rim: m.rim } as Mat;
  s.fill(bone, (b) => {
    b.capP(sh, E, span * 0.05 + 0.8, span * 0.035 + 0.7);
    b.capP(E, Wr, span * 0.035 + 0.7, 0.8);
    for (const t of tips) b.capP(Wr, t, 0.6, 0.35);
  }, { cast: false });
  // thumb claw
  s.fill(mat("#e8dcc0"), (b) => b.capP(Wr, add(Wr, dir(a2 + 0.9, 2.2)), 0.7, 0.3), { cast: false });
}

/** Feathered wing (birds, the winged serpent): layered coverts and separated primaries. */
function featherWing(s: Spr, m: Mat, sh: P, u: number, span: number, far: boolean) {
  const a1 = lerp(-4.0, -2.2, u), a2 = a1 + lerp(0.25, 0.9, u);
  const E = add(sh, dir(a1, span * 0.3)), Wr = add(E, dir(a2, span * 0.3));
  const mm = far ? dim(m, 0.14) : m, cov = { t: mm.t.map((c) => hs(c, 0.1)), rough: 0, rim: mm.rim } as Mat;
  // primaries and secondaries fanned from the wrist and forearm
  const fe: [P, number, number][] = [];
  for (let k = 0; k < 6; k++) fe.push([Wr, a2 - 0.08 - k * lerp(0.2, 0.28, u), span * (0.5 - k * 0.025)]);
  for (let k = 0; k < 4; k++) fe.push([mid(E, Wr, 1 - k * 0.3), a2 - 1.3 - k * 0.22, span * (0.38 - k * 0.04)]);
  s.fill(mm, (b) => {
    for (const [p, a, l] of fe) b.capP(p, add(p, dir(a, l)), 1.6, 0.8);
  }, { hi: 0.15 });
  for (const [p, a, l] of fe.slice(0, 6)) { const q = add(p, dir(a, l * 0.92)); s.creaseLine(p[0], p[1], q[0], q[1], 0.75); }
  // coverts
  s.fill(cov, (b) => { b.capP(sh, E, 2.6, 2.4); b.capP(E, Wr, 2.4, 1.6); b.poly([sh, E, Wr, add(mid(E, Wr), dir(a2 - 1.6, 3.6)), add(sh, dir(a1 + 2.2, 3))]); }, { cast: true });
}

// ============================================================ quadruped rig
interface QB {
  len: number; shH: number; hipH: number;
  fl: [number, number, number]; hl: [number, number, number];
  /** Neck root offset from the shoulder, neck length and resting angle. */
  neck: [number, number, number, number];
  stride: number;
  /** Rears up instead of lunging (bears, horses). */
  rear?: boolean;
}
interface QJ {
  c: P; pitch: number; sh: P; hp: P;
  feet: P[]; joint: P[]; ank: P[]; tops: P[];
  head: P; ha: number; jaw: number; tail: number; ex: Ex; br: number;
}
function quadPose(b: QB, a: A): QJ {
  let cx = 0, cy = 0, pitch = 0, jaw = 0, tail = Math.sin(a.t * PI * 2) * 0.15, br = 0;
  let hA = b.neck[3], nl = b.neck[2];
  const fx = b.len / 2 + 1, hx = -b.len / 2 + 1;
  let feet: P[] = [[fx - 2, 0], [hx - 2.5, 0], [fx + 1, 0], [hx + 0.5, 0]];
  if (a.pose === "idle") {
    br = (1 - a.c) * 0.5; cy += br * 0.8; hA += a.s * 0.05;
  } else if (a.pose === "move") {
    const p = a.t * PI * 2;
    const step = (ph: number): P => [Math.cos(ph) * b.stride, -Math.max(0, Math.sin(ph)) * b.stride * 0.45];
    const fs = [step(p + PI), step(p), step(p), step(p + PI)];
    feet = feet.map((f, i) => add(f, fs[i]));
    cy -= Math.abs(Math.cos(p)) * 1 - 0.5; hA += 0.06; tail += 0.2;
  } else if (a.st >= 0) {
    const st = a.st;
    if (b.rear) {
      if (st === 0) { pitch = -0.55; cx = -3; hA -= 0.3; jaw = 0.7; feet[0] = [fx + 2, -12]; feet[2] = [fx + 4, -14]; }
      if (st === 1) { pitch = -0.25; cx = 2; hA += 0.1; jaw = 1; feet[0] = [fx + 6, -6]; feet[2] = [fx + 10, -8]; }
      if (st === 2) { pitch = 0.04; cx = 4; cy = 1; hA += 0.25; jaw = 0.8; feet[0] = [fx + 6, 0]; feet[2] = [fx + 10, 0]; }
      if (st === 3) { pitch = 0; cx = 1.5; hA += 0.1; jaw = 0.2; feet[0] = [fx + 3, 0]; feet[2] = [fx + 4, 0]; }
      if (st <= 1) { feet[1] = add(feet[1], [3, 0]); feet[3] = add(feet[3], [3, 0]); }
    } else {
      if (st === 0) { cx = -3.5; cy = 2.5; pitch = 0.06; hA += 0.35; jaw = 0.25; feet[0] = add(feet[0], [-2, 0]); feet[2] = add(feet[2], [-1, 0]); }
      if (st === 1) { cx = 5; cy = -1.5; pitch = -0.16; hA -= 0.05; jaw = 1; feet[0] = [fx + 6, -3]; feet[2] = [fx + 9, -5]; feet[1] = add(feet[1], [2, 0]); }
      if (st === 2) { cx = 6.5; cy = 0; pitch = -0.05; hA += 0.1; jaw = 0.15; feet[0] = [fx + 7, 0]; feet[2] = [fx + 10, 0]; feet[1] = add(feet[1], [3, 0]); feet[3] = add(feet[3], [3, 0]); }
      if (st === 3) { cx = 2; pitch = 0; jaw = 0.1; feet[0] = add(feet[0], [2, 0]); feet[2] = add(feet[2], [3, 0]); }
      tail -= 0.25;
    }
  } else if (a.hu >= 0) {
    const k = a.hu === 0 ? 1 : 0.55;
    cx = -3 * k; cy = 1.5 * k; pitch = -0.12 * k; hA -= 0.55 * k; jaw = 0.7 * k; tail += 0.5 * k;
    feet[0] = add(feet[0], [-1, 0]); feet[2] = add(feet[2], [-2, 0]);
  } else if (a.dead) {
    cy = Math.min(b.shH, b.hipH) - b.fl[2] - 4.5; pitch = 0.02; hA = 0.25; nl *= 0.9; jaw = 0.35; tail = 0.9;
    feet = [[fx + 8, -2], [hx + 10, -1.5], [fx + 11, -1], [hx + 13, -0.8]];
  }
  const c: P = [cx, cy];
  const R = (v: P): P => add(c, rot(v, pitch));
  const sh = R([b.len / 2, -b.shH]), hp = R([-b.len / 2, -b.hipH]);
  const tops = [add(sh, [-1, 0]), add(hp, [-1, 0]), sh, hp];
  const joint: P[] = [], ank: P[] = [];
  for (let i = 0; i < 4; i++) {
    const front = i % 2 === 0, L3 = front ? b.fl : b.hl;
    const anchor: P = front ? add(feet[i], [-0.4, -L3[2]]) : add(feet[i], [-1.6, -L3[2]]);
    const [jt, e] = ik(tops[i], anchor, L3[0], L3[1], front ? 1 : -1);
    joint.push(jt); ank.push(e);
    if (a.dead) { ank[i] = e; }
  }
  const nr = add(sh, rot([b.neck[0], b.neck[1]], pitch));
  const head = add(nr, dir(hA + pitch - PI / 2, nl));
  return { c, pitch, sh, hp, feet, joint, ank, tops, head, ha: pitch + (a.dead ? 0.35 : hA * 0.4 - 0.1), jaw, tail, ex: exOf(a), br };
}

interface QSpec {
  b: QB;
  leg(s: Spr, j: QJ, i: number, a: A): void;
  body(s: Spr, j: QJ, a: A): void;
  /** Local frame at j.head, rotated by j.ha. Returns the mouth point (for bite sparks). */
  head(s: Spr, j: QJ, a: A): P;
  tail?(s: Spr, j: QJ, a: A): void;
  /** Between the body and the near legs (saddles, riders). */
  over?(s: Spr, j: QJ, a: A): void;
  behind?(s: Spr, j: QJ, a: A): void;
}
function drawQuad(s: Spr, a: A, q: QSpec) {
  const j = quadPose(q.b, a);
  q.behind?.(s, j, a);
  q.leg(s, j, 0, a);
  q.leg(s, j, 1, a);
  q.tail?.(s, j, a);
  q.body(s, j, a);
  q.leg(s, j, 3, a);
  q.over?.(s, j, a);
  q.leg(s, j, 2, a);
  let mouth: P = [0, 0];
  s.at(j.head, j.ha, () => { const m = q.head(s, j, a); mouth = s.tp(m[0], m[1]); });
  if (a.st === 1 || a.st === 2) {
    const iv = inv(s.m), mm: P = [iv[0] * mouth[0] + iv[2] * mouth[1] + iv[4], iv[1] * mouth[0] + iv[3] * mouth[1] + iv[5]];
    if (q.b.rear) {
      const p = j.ank[2];
      s.smear(p[0] - 4, p[1] - 6, 9, -1.6, a.st === 1 ? 0.2 : 1.1, 2);
      if (a.st === 2) s.spark(p[0] + 3, p[1] + 1, 4);
    } else {
      s.speed(j.sh[0] - 16, j.sh[1] + 2, j.sh[0] - 4, j.sh[1] + 2);
      s.speed(j.hp[0] - 6, j.hp[1] - 2, j.hp[0] + 4, j.hp[1] - 2);
      if (a.st === 2) s.spark(mm[0] + 1, mm[1], 5);
    }
  }
}

/** Digitigrade leg with a paw (wolves, cats) or hoof. */
function qLeg(s: Spr, m: Mat, j: QJ, i: number, r: [number, number, number], paw: "paw" | "hoof" | "bear", claw = "#e8dcc0", extra?: (top: P) => void) {
  const mm = i < 2 ? dim(m) : m;
  const top = j.tops[i], jt = j.joint[i], an = j.ank[i], ft = j.feet[i];
  const front = i % 2 === 0;
  s.fill(mm, (b) => {
    b.capP(add(top, [0, 1]), jt, r[0], r[1]);
    b.capP(jt, an, r[1], r[2]);
    b.capP(an, add(ft, [0, -0.8]), r[2], r[2] * 0.9);
    if (paw === "paw") b.ell(ft[0] + 0.8, ft[1] - 0.9, r[2] + 0.8, 1.1);
    if (paw === "bear") b.ell(ft[0] + 1, ft[1] - 1.2, r[2] + 1.4, 1.4);
  });
  extra?.(top);
  if (paw === "hoof") s.fill(i < 2 ? dim(mat("#2e2622")) : mat("#3a302a"), (b) => b.poly([[ft[0] - 1.4, ft[1] - 2.4], [ft[0] + 1.6, ft[1] - 2.4], [ft[0] + 2.2, ft[1]], [ft[0] - 1.8, ft[1]]]));
  else {
    const n = paw === "bear" ? 3 : 2;
    for (let k = 0; k < n; k++) s.dot(ft[0] + r[2] + (paw === "bear" ? 2.2 : 1.6) - k * 1.1, ft[1] - 0.4, i < 2 ? hs(claw, -0.35) : claw);
  }
  void front;
}

const furTex = (k = 0.35) => (x: number, y: number, t: number, mx: number, my: number) => {
  // short diagonal strokes of fur breaking the tone bands
  const st = hash(Math.floor(mx * 0.7 + my * 0.35), Math.floor(my * 0.9), 11);
  return st < k * 0.4 ? t - 1 : st > 1 - k * 0.3 ? t + 1 : t;
};

// ============================================================ wolves
interface WolfOpts { fur: string; belly: string; eye: string; size: number; mane?: boolean; rider?: boolean }
function wolf(o: WolfOpts): Def {
  const k = o.size;
  const FUR = mat(o.fur, { rim: o.mane ? "#7a5a9a" : undefined }), BEL = mat(o.belly), MANE = mat(hs(o.fur, -0.15), { rim: o.mane ? "#8a6aaa" : undefined });
  const b: QB = { len: 24 * k, shH: 20 * k, hipH: 19 * k, fl: [7 * k, 7 * k, 4 * k], hl: [7.5 * k, 7 * k, 5 * k], neck: [2 * k, -2 * k, 6 * k, 0.95], stride: 5 * k };
  const ft = furTex(0.5);
  const rider = o.rider ? giakSpec({ skin: "#76707e", armour: "#26222e" }) : null;
  const q: QSpec = {
    b,
    leg: (s, j, i) => qLeg(s, FUR, j, i, i % 2 ? [3.6 * k, 2.2 * k, 1.5 * k] : [3.2 * k, 2 * k, 1.5 * k], "paw"),
    tail: (s, j, a) => {
      const base = add(j.hp, [-2 * k, -1 * k]);
      const t = j.tail + (a.dead ? 0 : 0);
      const p1 = add(base, dir(PI * 0.85 + t * 0.5, 6 * k)), p2 = add(p1, dir(PI * 0.62 + t, 7 * k));
      s.fill(MANE, (bb) => bb.chain([[base[0], base[1], 2.2 * k], [p1[0], p1[1], 2.6 * k], [p2[0], p2[1], 1 * k]]), { tex: ft });
    },
    body: (s, j, a) => {
      s.at(j.c, j.pitch, () => {
        const L = b.len, br = j.br * 0.6;
        s.fill(FUR, (bb) => {
          bb.ell(L * 0.32, -b.shH + 1 * k, 7.6 * k + br, 7 * k + br * 0.5); // chest
          bb.ell(0, -b.shH + 1 * k, 9 * k, 5.2 * k); // barrel
          bb.ell(-L * 0.36, -b.hipH, 6.2 * k, 5.8 * k); // haunch
        }, { tex: ft });
        s.fill(BEL, (bb) => { bb.ell(L * 0.36, -b.shH + 5.5 * k, 4 * k, 3.6 * k); bb.ell(-1 * k, -b.shH + 5 * k, 7 * k, 1.4 * k); }, { tex: ft, cast: false });
        if (o.mane) s.fill(MANE, (bb) => {
          for (let n = 0; n < 7; n++) { const x = L * 0.44 - n * 2.4 * k, y = -b.shH - 5 * k + n * 0.5 * k; bb.poly([[x - 2.2 * k, y + 3 * k], [x - 0.6 * k, y - 2.4 * k - (n % 2) * k], [x + 1.6 * k, y + 3 * k]]); }
        }, { tex: ft });
        if (a.dead) return;
        // haunch muscle crease
        s.creaseLine(-L * 0.36 + 3 * k, -b.hipH - 4 * k, -L * 0.3 + 1 * k, -b.hipH + 3 * k, 0.75);
      });
    },
    over: rider ? (s, j, a) => {
      const seat = add(j.c, rot([b.len * 0.1, -b.shH - 6 * k], j.pitch));
      drawRider(s, a, rider, seat, j.pitch);
    } : undefined,
    head: (s, j, a) => {
      const ex = j.ex, jaw = j.jaw;
      // ruff, skull, muzzle, jaw
      s.fill(MANE, (bb) => { bb.ell(-1.6 * k, 0.6 * k, 4.6 * k, 5.2 * k); }, { tex: ft });
      s.fill(FUR, (bb) => { bb.poly([[-2 * k, -4.6 * k], [-0.6 * k, -9.4 * k], [1.6 * k, -4.6 * k]]); bb.poly([[0.4 * k, -4.2 * k], [2.2 * k, -9 * k], [3.4 * k, -3.6 * k]]); });
      s.fill(mat("#4a2a30"), (bb) => bb.poly([[0.6 * k, -4.6 * k], [1.6 * k, -7.6 * k], [2.4 * k, -4.4 * k]]), { cast: false });
      s.fill(FUR, (bb) => {
        bb.ell(1.4 * k, -1.8 * k, 4.2 * k, 3.4 * k);
        bb.poly([[2 * k, -4 * k], [9.6 * k, -1.8 * k], [10 * k, 0.2 * k], [2.6 * k, 1 * k]]);
      }, { tex: ft });
      s.at([3 * k, 0.6 * k], jaw * 0.55, () => {
        s.fill(BEL, (bb) => bb.poly([[-1 * k, -0.8 * k], [6.6 * k, -0.4 * k], [6 * k, 1.4 * k], [-0.4 * k, 1.6 * k]]));
        if (jaw > 0.2) { s.dot(5.4 * k, -0.9 * k, "#f4ecd8"); s.dot(3.6 * k, -0.9 * k, "#f4ecd8"); }
      });
      if (jaw > 0.2) s.fill(flatMat("#4a0e18"), (bb) => bb.poly([[3.4 * k, 0.3 * k], [9.4 * k, 0.4 * k], [3.4 * k + Math.cos(jaw * 0.55) * 6 * k, 0.6 * k + Math.sin(jaw * 0.55) * 6 * k]]), { cast: false });
      for (const x of [5, 7.6]) s.dot(x * k, 0.6 * k, "#f4ecd8");
      s.dot(9.2 * k, 0.9 * k, "#f4ecd8");
      s.fill(flatMat("#141014"), (bb) => bb.ell(9.8 * k, -1.2 * k, 0.9 * k, 0.9 * k), { cast: false });
      s.creaseLine(2.4 * k, -3.6 * k, 5.2 * k, -2.6 * k, 0.6);
      if (ex === "dead") s.line(3 * k, -2.8 * k, 4.6 * k, -2.4 * k, "#141014");
      else { s.dot(3.6 * k, -2.6 * k, hs(o.eye, 0.5)); s.glow(3.8 * k, -2.5 * k, o.eye, ex === "atk" ? 3 : 2.2); }
      return [10 * k, 0.4 * k];
    },
  };
  const w = Math.round(64 * k), h = Math.round(44 * k) + (o.rider ? 14 : 0);
  return { w, h, flying: false, ox: -2, draw: (s, a) => drawQuad(s, a, q) };
}

/** A humanoid rider seated at `seat`: legs straddle the mount, upper body follows its pose. */
function drawRider(s: Spr, a: A, sp: HumSpec, seat: P, pitch: number) {
  const ra = a.dead ? anim("hurt", 0) : a;
  const j = humPose(sp.b, ra, sp.style);
  const d: P = [seat[0] - j.hip[0], seat[1] - j.hip[1]];
  const mv = (p: P) => add(p, d);
  const jj: HJ = { ...j, hip: mv(j.hip), neck: mv(j.neck), sh: j.sh.map(mv), el: j.el.map(mv), ha: j.ha.map(mv), hp: j.hp.map(mv), kn: [], ft: [] };
  jj.lean += pitch;
  for (let i = 0; i < 2; i++) {
    jj.kn.push(add(jj.hp[i], rot([3.6, 3.2], pitch)));
    jj.ft.push(add(jj.hp[i], rot([2.2, 9.4], pitch)));
  }
  if (a.dead) return;
  sp.arm(s, jj, 0, ra);
  if (sp.offhand) s.at(jj.ha[0], jj.wa[0], () => sp.offhand!(s, jj, ra));
  s.at(jj.hip, jj.lean, () => sp.torso(s, jj, ra));
  sp.leg(s, jj, 1, ra);
  s.at(jj.neck, jj.lean + jj.head, () => sp.head(s, jj, ra));
  if (sp.weapon) s.at(jj.ha[1], jj.wa[1], () => sp.weapon!(s, ra));
  sp.arm(s, jj, 1, ra);
}

// ============================================================ bears, cats, horses, rats, beasts
function bear(fur: string, muzzle: string): Def {
  const FUR = mat(fur, { rim: "#6a6a8a", rough: 0.1 }), MZ = mat(muzzle);
  const b: QB = { len: 24, shH: 21, hipH: 19, fl: [8, 7, 3], hl: [8, 7, 4], neck: [3, 1, 5, 1.2], stride: 5, rear: true };
  const ft = furTex(0.6);
  const q: QSpec = {
    b,
    leg: (s, j, i) => qLeg(s, FUR, j, i, i % 2 ? [5, 3.4, 2.6] : [4.4, 3.2, 2.6], "bear", "#f0e8d8"),
    body: (s, j) => {
      s.at(j.c, j.pitch, () => {
        const br = j.br * 0.7;
        s.fill(FUR, (bb) => {
          bb.ell(7, -b.shH + 1, 9 + br, 8.4 + br * 0.5); // shoulder hump
          bb.ell(-2, -b.shH + 2, 11, 7.4);
          bb.ell(-11, -b.hipH + 0.5, 8, 7.8);
        }, { tex: ft });
        s.fill(FUR, (bb) => bb.poly([[0, -b.shH - 6], [8, -b.shH - 8.6], [13, -b.shH - 4], [4, -b.shH - 4]]), { tex: ft, cast: false });
      });
    },
    tail: (s, j) => s.fill(FUR, (bb) => bb.ell(j.hp[0] - 6.6, j.hp[1] - 2, 2, 1.6), { tex: ft }),
    head: (s, j) => {
      const ex = j.ex, jaw = j.jaw;
      s.fill(FUR, (bb) => { bb.ell(0, -1, 5.4, 5); bb.ell(-1.6, -5.6, 1.8, 1.8); bb.ell(2, -6, 1.6, 1.6); }, { tex: ft });
      s.fill(mat("#4a3a3a"), (bb) => bb.ell(-1.4, -5.4, 0.8, 0.8), { cast: false });
      s.fill(MZ, (bb) => { bb.poly([[2, -3], [9, -1.6], [9.4, 0.8], [2.4, 2]]); });
      s.at([3, 1.4], jaw * 0.5, () => s.fill(MZ, (bb) => bb.poly([[-1, -0.6], [5.6, -0.4], [5, 1.4], [-0.4, 1.6]])));
      if (jaw > 0.2) {
        s.fill(flatMat("#4a1018"), (bb) => bb.poly([[3.4, 1], [9, 0.8], [3.4 + Math.cos(jaw * 0.5) * 5.6, 1.6 + Math.sin(jaw * 0.5) * 5.6]]), { cast: false });
        s.dot(8, 1, "#f4ecd8"); s.dot(5.4, 1, "#f4ecd8");
      }
      s.fill(flatMat("#141014"), (bb) => bb.ell(9, -1.4, 1, 0.9), { cast: false });
      if (ex === "dead") s.line(2.6, -2.8, 4, -2.4, "#141014");
      else { s.dot(3.2, -2.6, "#1a1012"); s.dot(3.2, -2.9, ex === "atk" ? "#ff8040" : "#d0a060"); if (ex === "atk") s.glow(3.2, -2.8, "#ff6020", 2); }
      return [9, 1];
    },
  };
  return { w: 72, h: 56, flying: false, ox: -2, draw: (s, a) => drawQuad(s, a, q) };
}

function mountainCat(): Def {
  const FUR = mat("#b08a52", { rough: 0.15 }), PALE = mat("#e8d8b0"), SPOT = "#6a4a2a";
  const b: QB = { len: 24, shH: 14, hipH: 15, fl: [5.6, 5, 3], hl: [6.4, 5.6, 4.4], neck: [3, -1, 5, 1.05], stride: 5.5 };
  const spots = (x: number, y: number, t: number, mx: number, my: number) => {
    const u = mx * 0.5, v = my * 0.6, h = hash(Math.floor(u), Math.floor(v), 5);
    return h < 0.3 && Math.hypot(u - Math.floor(u) - 0.5, v - Math.floor(v) - 0.5) < 0.32 ? Math.min(t, 1) - 1 : t;
  };
  const q: QSpec = {
    b,
    leg: (s, j, i) => qLeg(s, FUR, j, i, i % 2 ? [3.4, 2, 1.5] : [2.8, 1.9, 1.5], "paw"),
    tail: (s, j, a) => {
      const base = add(j.hp, [-2, -1]), t = j.tail;
      const p1 = add(base, dir(PI * 0.9 + t * 0.4, 7)), p2 = add(p1, dir(PI * 0.6 + t, 7)), p3 = add(p2, dir(PI * 0.15 + t * 1.5 + (a.pose === "idle" ? a.s * 0.4 : 0), 4));
      s.fill(FUR, (bb) => bb.chain([[base[0], base[1], 1.6], [p1[0], p1[1], 1.4], [p2[0], p2[1], 1.4], [p3[0], p3[1], 1.4]]));
      s.fill(mat("#3a2a1a"), (bb) => bb.cap(p2[0] + (p3[0] - p2[0]) * 0.5, p2[1] + (p3[1] - p2[1]) * 0.5, p3[0], p3[1], 1.5), { cast: false });
    },
    body: (s, j) => {
      s.at(j.c, j.pitch, () => {
        s.fill(FUR, (bb) => { bb.ell(8, -b.shH + 0.5, 5.4 + j.br * 0.4, 5.4); bb.ell(-1, -b.shH + 0.5, 9, 4.4); bb.ell(-9, -b.hipH + 0.5, 5.4, 5.4); }, { tex: spots });
        s.fill(PALE, (bb) => bb.ell(1, -b.shH + 4.4, 9, 1.4), { cast: false });
      });
    },
    head: (s, j) => {
      const ex = j.ex, jaw = j.jaw;
      s.fill(FUR, (bb) => { bb.ell(1, -1.4, 4, 3.6); bb.poly([[-1.6, -3.6], [-1, -8.4], [1.2, -4.2]]); bb.poly([[1, -4], [2.2, -8.6], [3.4, -3.6]]); });
      s.dot(-1, -8.8, "#2a1a12"); s.dot(2.2, -9, "#2a1a12");
      s.fill(PALE, (bb) => { bb.ell(4.4, -0.4, 2.4, 1.8); });
      s.at([3, 1], jaw * 0.6, () => s.fill(PALE, (bb) => bb.poly([[-0.6, -0.6], [3.8, -0.4], [3.4, 1], [0, 1.2]])));
      if (jaw > 0.2) { s.fill(flatMat("#5a1020"), (bb) => bb.poly([[3, 0.4], [6.4, 0.2], [3 + Math.cos(jaw * 0.6) * 3.8, 1 + Math.sin(jaw * 0.6) * 3.8]]), { cast: false }); s.dot(5.6, 0.4, "#ffffff"); s.dot(3.8, 2, "#ffffff"); }
      s.fill(flatMat("#c07070"), (bb) => bb.ell(6.2, -1.2, 0.8, 0.6), { cast: false });
      s.creaseLine(3.6, -2.4, 5, -0.6, 0.6);
      if (ex === "dead") s.line(2.6, -2.6, 4, -2.4, "#1a1010");
      else { s.dot(3.2, -2.6, "#e8e040"); s.dot(3.8, -2.6, "#1a1010"); s.glow(3.4, -2.6, "#d0f040", 1.6); }
      return [6, 0.8];
    },
  };
  return { w: 64, h: 40, flying: false, ox: -3, draw: (s, a) => drawQuad(s, a, q) };
}

function horse(): Def {
  const COAT = mat("#7a4a2a"), MANE = mat("#2a1e1a", { rough: 0.5 }), SADDLE = mat("#5a2e1e"), CLOTH = mat("#2a4a7a");
  const b: QB = { len: 26, shH: 27, hipH: 28, fl: [8.5, 8, 6], hl: [9, 8.5, 7], neck: [3, -3, 11, 0.55], stride: 6, rear: true };
  const q: QSpec = {
    b,
    leg: (s, j, i) => {
      qLeg(s, COAT, j, i, i % 2 ? [4.4, 2, 1.4] : [3.4, 1.8, 1.4], "hoof");
      const ft = j.feet[i];
      s.fill(i < 2 ? dim(mat("#e8e0d0")) : mat("#e8e0d0"), (bb) => bb.cap(ft[0], ft[1] - 3, ft[0] + 0.2, ft[1] - 2.2, 1.6), { cast: false });
    },
    tail: (s, j, a) => {
      const base = add(j.hp, [-3, -2]), sw = j.tail;
      s.fill(MANE, (bb) => bb.chain([[base[0], base[1], 1.8], [base[0] - 4, base[1] + 4, 2.6], [base[0] - 5 + sw * 3, base[1] + 12, 2], [base[0] - 4 + sw * 5, base[1] + 18 - (a.dead ? 6 : 0), 0.8]]), { tex: (x, y, t) => (x % 2 ? t - 1 : t) });
    },
    body: (s, j) => {
      s.at(j.c, j.pitch, () => {
        s.fill(COAT, (bb) => { bb.ell(9, -b.shH + 2, 6.6, 7.4); bb.ell(0, -b.shH + 1, 11, 6.4); bb.ell(-10, -b.hipH + 2, 7, 7.4); });
        // saddle cloth, saddle, girth
        s.fill(CLOTH, (bb) => bb.poly([[-6, -b.shH - 3.6], [5, -b.shH - 3.6], [6, -b.shH + 4], [-7, -b.shH + 4]]), { cast: false });
        s.fill(GOLD, (bb) => bb.rect(-7, -b.shH + 3.4, 13, 1), { cast: false });
        s.fill(SADDLE, (bb) => { bb.poly([[-5, -b.shH - 4.6], [4, -b.shH - 4.6], [5, -b.shH - 7], [6, -b.shH - 3], [-4.6, -b.shH - 2.6], [-6.4, -b.shH - 6.6]]); });
        s.fill(LEATHER, (bb) => bb.rect(-0.4, -b.shH - 3, 1.4, 9), { cast: false });
        s.fill(IRON, (bb) => bb.ell(0.2, -b.shH + 6.6, 1.2, 1.4), { spec: 0.3 });
      });
    },
    head: (s, j) => {
      const ex = j.ex, jaw = j.jaw;
      // neck goes back down to the shoulder: draw it in the head frame towards the body
      s.fill(COAT, (bb) => { bb.capP([0, 0], [-4, 10], 3.4, 5); bb.ell(1.6, -1, 3.4, 3); bb.poly([[1, -3.4], [10, -0.4], [10.6, 2.6], [8.6, 3.6], [1.6, 2]]); });
      s.fill(MANE, (bb) => bb.chain([[-1, -3.6, 1.4], [-3.4, 0, 1.8], [-5.6, 5, 1.6], [-7, 9, 1]]), { tex: (x, y, t) => ((x + y) % 2 ? t - 1 : t) });
      s.fill(COAT, (bb) => { bb.poly([[-0.6, -3], [0, -6.6], [1.6, -3]]); });
      s.fill(mat("#e8e0d0"), (bb) => bb.poly([[3.6, -2.2], [9, 0], [8.6, 1]]), { cast: false });
      s.at([8.6, 2.6], jaw * 0.35, () => s.fill(COAT, (bb) => bb.ell(-1, 0.6, 2.2, 1)));
      // bridle
      s.fill(LEATHER, (bb) => { bb.cap(1.4, -2.8, 2.6, 2.2, 0.5); bb.cap(2.6, 0.6, 9.6, 1.2, 0.5); }, { cast: false });
      s.fill(IRON, (bb) => bb.ell(9.2, 2, 0.8, 0.8));
      s.dot(10, 1, "#1a1010");
      if (ex === "dead") s.line(3, -1.6, 4.4, -1.2, "#1a1010");
      else { s.dot(3.6, -1.4, "#1a1010"); s.dot(3.4, -1.8, "#ffffff"); }
      return [10, 2];
    },
  };
  return { w: 76, h: 62, flying: false, ox: 0, draw: (s, a) => drawQuad(s, a, q) };
}

function rat(): Def {
  const FUR = mat("#6a5a52", { rough: 0.2 }), PINK = mat("#c88a8a");
  const b: QB = { len: 11, shH: 6, hipH: 7.5, fl: [2.6, 2.4, 1.4], hl: [3, 3, 2], neck: [2, 1, 2.4, 1.2], stride: 3 };
  const ft = furTex(0.5);
  const q: QSpec = {
    b,
    leg: (s, j, i) => qLeg(s, PINK, j, i, [1.4, 0.9, 0.7], "paw", "#e0d0c0"),
    tail: (s, j, a) => {
      const b0 = add(j.hp, [-2, 0]);
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 6; k++) pts.push([b0[0] - k * 2.6, b0[1] + 2 + Math.sin(k * 0.9 + a.t * 6.28) * 1.4 + k * 0.4, 1 - k * 0.12]);
      s.fill(PINK, (bb) => bb.chain(pts));
    },
    body: (s, j) => s.at(j.c, j.pitch, () => s.fill(FUR, (bb) => { bb.ell(-1, -6.6, 7.6, 4.6 + j.br * 0.3); bb.ell(3.6, -6, 4, 3.8); }, { tex: ft })),
    head: (s, j) => {
      s.fill(FUR, (bb) => { bb.ell(0.6, -0.4, 2.8, 2.4); bb.poly([[1, -2], [6.2, 0.4], [1.4, 1.8]]); }, { tex: ft });
      s.fill(PINK, (bb) => bb.ell(-0.8, -2.6, 1.4, 1.6));
      s.dot(6.2, 0.4, "#2a1a1a");
      if (j.jaw > 0.2) { s.dot(5, 1.4, "#fff8e0"); s.dot(5.4, 1.4, "#fff8e0"); }
      if (j.ex !== "dead") s.glow(2.2, -0.8, "#ff4030", 1.4);
      return [6, 0.8];
    },
  };
  return { w: 40, h: 22, flying: false, ox: -2, draw: (s, a) => drawQuad(s, a, q) };
}

function beast(): Def {
  const HIDE = mat("#5a4a5a", { rim: "#a07ab0", rough: 0.1 }), HORN = mat("#e0d4b4"), SPIKE = mat("#3a2a3a");
  const b: QB = { len: 26, shH: 20, hipH: 18, fl: [7, 6.5, 3.4], hl: [7.4, 6.6, 4], neck: [4, 2, 3.6, 1.45], stride: 4.6 };
  const q: QSpec = {
    b,
    leg: (s, j, i) => qLeg(s, HIDE, j, i, i % 2 ? [4.6, 3.2, 2.4] : [4.4, 3.2, 2.4], "bear", "#e8dcc0"),
    tail: (s, j) => { const p = j.hp; s.fill(HIDE, (bb) => bb.chain([[p[0] - 3, p[1], 2], [p[0] - 9, p[1] + 3, 1.2], [p[0] - 12, p[1] + 8, 0.6]])); },
    body: (s, j) => {
      s.at(j.c, j.pitch, () => {
        s.fill(HIDE, (bb) => { bb.ell(6, -b.shH + 1, 9 + j.br * 0.6, 8.4); bb.ell(-3, -b.shH + 2, 10, 6.6); bb.ell(-10, -b.hipH + 1, 6.4, 6.4); }, { tex: (x, y, t, mx, my) => (hash(Math.floor(mx / 2), Math.floor(my / 2), 9) < 0.18 ? t - 1 : t) });
        for (let n = 0; n < 6; n++) { const x = 11 - n * 4, y = -b.shH - 7 + Math.abs(n - 1.5) * 0.9; s.fill(SPIKE, (bb) => bb.poly([[x - 2, y + 3], [x - 2.6, y - 3.6], [x + 1.4, y + 3]]), { spec: 0.1 }); }
      });
    },
    head: (s, j) => {
      const ex = j.ex, jaw = j.jaw;
      s.fill(HIDE, (bb) => { bb.ell(1, -0.6, 4.6, 4.2); bb.poly([[2, -3], [9, -1], [9.4, 1.6], [2, 2.4]]); });
      s.at([3, 1.6], jaw * 0.5, () => s.fill(HIDE, (bb) => bb.poly([[-1, -0.6], [6, -0.4], [5.6, 1.6], [0, 1.8]])));
      if (jaw > 0.2) s.fill(flatMat("#3a0a14"), (bb) => bb.poly([[3.4, 1.2], [9, 1], [3.4 + Math.cos(jaw * 0.5) * 5.6, 1.8 + Math.sin(jaw * 0.5) * 5.6]]), { cast: false });
      s.fill(HORN, (bb) => { bb.poly([[0, -3.4], [-3, -8], [-1.6, -11.6], [-1, -8.2], [2.2, -4]]); bb.poly([[7, 1.2], [9.4, -3.4], [8.6, 1.6]]); }, { spec: 0.15 });
      s.dot(9, -0.6, "#1a1014");
      if (ex !== "dead") { s.dot(3.6, -1.8, "#fff080"); s.glow(3.6, -1.8, "#ffa020", 2.2); }
      return [9, 1.2];
    },
  };
  return { w: 72, h: 54, flying: false, ox: -2, draw: (s, a) => drawQuad(s, a, q) };
}

function dragon(): Def {
  const SC = mat("#2e6a4a", { rim: "#a0e070" }), BEL = mat("#d8c070"), WING = mat("#7a2e2a", { rim: "#e0704a" }), HORN = mat("#e8dcc0");
  const b: QB = { len: 26, shH: 20, hipH: 20, fl: [6.5, 6.5, 3.6], hl: [7, 6.6, 4.4], neck: [3, -2, 13, 0.75], stride: 4 };
  const scales = (x: number, y: number, t: number, mx: number, my: number) => ((Math.floor(mx / 1.6 + (Math.floor(my / 1.4) % 2) * 0.5) + Math.floor(my / 1.4)) % 2 === 0 && t > 1 ? t - 1 : t);
  const q: QSpec = {
    b,
    behind: (s, j, a) => {
      if (a.dead) { batWing(s, WING, add(j.sh, [-6, -6]), 0.42, 34, false, add(j.hp, [2, -4])); return; }
      const u = a.pose === "idle" ? 0.78 + a.s * 0.14 : a.st === 0 ? 1 : a.st >= 1 ? 0.45 : a.hu >= 0 ? 0.6 : 0.55 + a.s * 0.4;
      batWing(s, dim(WING, 0.28), add(j.sh, [-2, -9]), u + 0.06, 32, true, add(j.hp, [4, -6]));
    },
    leg: (s, j, i) => qLeg(s, SC, j, i, i % 2 ? [4.4, 3, 2.2] : [3.6, 2.6, 2], "bear", "#f0e8d0"),
    tail: (s, j, a) => {
      const p = j.hp, sw = j.tail * 4;
      s.fill(SC, (bb) => bb.chain([[p[0] - 2, p[1], 4.6], [p[0] - 12, p[1] + 6, 3.2], [p[0] - 20, -4 + sw, 2], [p[0] - 26, -8 + sw, 1.2], [p[0] - 28, -12 + sw * 1.5, 0.5]]), { tex: scales });
      s.fill(SC, (bb) => bb.poly([[p[0] - 28, -12 + sw * 1.5], [p[0] - 32, -16 + sw * 1.5], [p[0] - 27, -15 + sw * 1.5], [p[0] - 25, -11 + sw]]));
      void a;
    },
    body: (s, j, a) => {
      s.at(j.c, j.pitch, () => {
        s.fill(SC, (bb) => { bb.ell(6, -b.shH + 1, 8 + j.br * 0.6, 7.6); bb.ell(-3, -b.shH + 1, 10, 7); bb.ell(-10, -b.hipH + 1, 7, 7); }, { tex: scales });
        s.fill(BEL, (bb) => bb.ell(1, -b.shH + 6, 11, 2.4), { tex: (x, y, t, mx) => (Math.abs(mx % 2.2) < 0.6 ? t - 1 : t), cast: false });
        for (let n = 0; n < 6; n++) { const x = 8 - n * 4.4, y = -b.shH - 7 + Math.abs(n - 1) * 0.3; s.fill(HORN, (bb) => bb.poly([[x - 1.6, y + 1.8], [x - 2, y - 2.2], [x + 1, y + 1.8]])); }
      });
      if (!a.dead) {
        const u = a.pose === "idle" ? 0.78 + a.s * 0.14 : a.st === 0 ? 1 : a.st >= 1 ? 0.45 : a.hu >= 0 ? 0.6 : 0.55 + a.s * 0.4;
        batWing(s, WING, add(j.sh, [-5, -7]), u, 36, false, add(j.hp, [3, -5]));
      }
    },
    head: (s, j, a) => {
      const ex = j.ex, jaw = j.jaw;
      // long neck back down to the chest
      s.fill(SC, (bb) => bb.chain([[0, 1, 3], [-3, 6, 3.6], [-5, 11, 4.4]]), { tex: scales });
      s.fill(BEL, (bb) => bb.chain([[1.6, 2, 1.4], [-0.6, 7, 1.8], [-1.6, 11, 2]]), { cast: false, tex: (x, y, t, mx, my) => (Math.abs(my % 2) < 0.6 ? t - 1 : t) });
      s.fill(SC, (bb) => { bb.ell(1, -1, 4, 3.4); bb.poly([[2, -3.6], [11, -1.6], [11.4, 0.6], [2.6, 1.6]]); }, { tex: scales });
      s.at([3.6, 1], jaw * 0.6, () => s.fill(SC, (bb) => bb.poly([[-1, -0.4], [7.6, 0], [7, 1.6], [-0.4, 1.8]])));
      if (jaw > 0.2) s.fill(flatMat("#5a1010"), (bb) => bb.poly([[4, 0.8], [11, 0.6], [4 + Math.cos(jaw * 0.6) * 7.6, 1.6 + Math.sin(jaw * 0.6) * 7.6]]), { cast: false });
      for (let x = 5; x < 11; x += 1.6) s.dot(x, 0.9, "#f8f0d8");
      s.fill(HORN, (bb) => { bb.poly([[-1, -3], [-6.6, -6.4], [-0.6, -4.8]]); bb.poly([[1, -3.6], [-3.4, -8.6], [2.6, -4]]); }, { spec: 0.15 });
      s.dot(10.6, -1, "#1a1010");
      if (ex !== "dead") { s.dot(4, -1.8, "#ffff80"); s.glow(4, -1.8, "#ffb020", 2.4); }
      // fire breath
      if (a.st === 1 || a.st === 2) {
        const n = a.st === 1 ? 10 : 18;
        s.later(() => {
          for (let k = 0; k < n * 6; k++) {
            const t = hash(k, 1, a.st) ** 0.8, r = t * n, sp = (hash(k, 2, a.st) - 0.5) * (1 + t * 7);
            const col = t < 0.25 ? "#fff6c0" : t < 0.55 ? "#ffc040" : t < 0.8 ? "#ff7020" : "#c02a10";
            s.dotA(11 + r * 1.4, 1 + sp, col, 0.95 - t * 0.35);
          }
        });
      }
      return [11, 0.8];
    },
  };
  return { w: 96, h: 72, flying: false, ox: -4, draw: (s, a) => drawQuad(s, a, q) };
}

//@@CHUNKS@@
// ============================================================ registry
/** A creature: canvas size, flying flag, model x-offset of the origin (+ = forward), drawer. */
interface Def { w: number; h: number; flying: boolean; ox?: number; draw(s: Spr, a: A): void }

const DEFS: Record<string, () => Def> = {
  giak: () => giak({ skin: "#76707e", armour: "#26222e" }),
  "giak-captain": () => giak({ skin: "#6e6878", armour: "#2a2234", helm: true, captain: true }),
  "giak-mountain": () => giak({ skin: "#867a6c", armour: "#3a3230", mountain: true }),
  drakkar: drakkar,
  vordak: vordak,
  "skeleton-king": () => skeleton(true),
  skeleton: () => skeleton(false),
  zombie: zombie,
  "crypt-spawn": cryptSpawn,
  gourgaz: gourgaz,
  kakarmi: kakarmi,
  troll: troll,
  giant: giant,
  demon: demon,
  monster: beastman,
  doomwolf: () => wolf({ fur: "#2c2834", belly: "#4a4250", eye: "#ff2a20", size: 1.2, mane: true }),
  "doomwolf-rider": () => wolf({ fur: "#2c2834", belly: "#4a4250", eye: "#ff2a20", size: 1.2, mane: true, rider: true }),
  wolf: () => wolf({ fur: "#7a7a82", belly: "#c8c0b4", eye: "#ffc040", size: 0.9 }),
  "black-bear": () => bear("#24222a", "#8a6a4a"),
  bear: () => bear("#5a3a24", "#a07a52"),
  "mountain-cat": mountainCat,
  horse: horse,
  rat: rat,
  beast: beast,
  dragon: dragon,
};

const defOf = memo((k: string) => (DEFS[k] ?? DEFS.giak)());

/** Keyword table, most specific first. Each entry: [creature key, ...substrings]. */
const KEYS: [string, ...string[]][] = [
  ["giak-captain", "giak captain", "giak officer", "giak sergeant", "giak leader"],
  ["giak-mountain", "mountain giak", "aarnak giak"],
  ["giak", "giak", "bọn giak"],
];

function norm(s: string) {
  return s.toLowerCase().replace(/[’']/g, "").replace(/\(.*?\)/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();
}
const keyOf = memo((idOrName: string): string => {
  const raw = idOrName.trim().toLowerCase();
  if (DEFS[raw]) return raw;
  const n = norm(idOrName), id = n.replace(/\s+/g, "-");
  if (DEFS[id]) return id;
  for (const [k, ...subs] of KEYS) if (subs.some((x) => n.includes(x))) return k;
  return "";
});

export function isCreature(actorIdOrFoeName: string): boolean {
  return !!keyOf(actorIdOrFoeName);
}

export function creatureSize(idOrName: string): { w: number; h: number; flying: boolean } {
  const d = defOf(keyOf(idOrName) || "giak");
  return { w: d.w, h: d.h, flying: d.flying };
}

const frameCache = memo((k: string) => {
  const [key, pose, f, facing] = k.split("|");
  const d = defOf(key);
  const a = anim(pose as CPose, Number(f));
  const s = new Spr(d.w, d.h);
  s.translate(Math.floor(d.w / 2), d.h - 1);
  if (facing === "left") s.scale(-1, 1);
  if (d.ox) { s.translate(d.ox, 0); s.ox = d.ox; }
  if (a.hu === 0) s.flash = 0.42;
  d.draw(s, a);
  return s.finish();
});

/** A creature frame: transparent canvas of creatureSize(), anchored at the bottom centre, cached. */
export function creatureFrame(idOrName: string, pose: CPose, frame: number, facing: "left" | "right"): HTMLCanvasElement {
  const key = keyOf(idOrName) || "giak";
  const n = CREATURE_FRAMES[pose] ?? 1;
  return frameCache(`${key}|${pose}|${((frame % n) + n) % n}|${facing}`);
}

/** All creature keys (for previews and tests). */
export const CREATURE_KEYS = Object.keys(DEFS);
