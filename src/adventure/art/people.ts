/**
 * Adventure's people: 32x48 hand-shaded characters (4 facings, 6 poses) and 32x32 portrait
 * busts, all drawn in code from a `Look`. Bodies are posed from a small rig (shoulder / hand /
 * hip / foot joints solved with two-bone IK) so that every weapon can really be swung, and
 * every part is painted with hue-shifted 3-tone ramps, selective outlines and real faces.
 */
import { Px, hs, hueOutline, memo, mix, ramp, seeded } from "./px";

// ------------------------------------------------------------------ public types
export type Pose = "idle" | "walk" | "attack" | "hurt" | "cast" | "dead";
export type Facing = "down" | "up" | "left" | "right";
export type Build = "normal" | "slim" | "broad" | "old" | "child";
export type HairStyle = "short" | "messy" | "long" | "ponytail" | "braid" | "bun" | "bald" | "balding" | "wild" | "cropped" | "curly";
export type Beard = "none" | "stubble" | "moustache" | "goatee" | "short" | "full" | "long";
/**
 * tunic: belted knee tunic over trousers. robe: ankle robe with a trimmed front. gown: bodice
 * and long skirt. tabard: mail shirt under a long tabard. armor: plate cuirass with pauldrons.
 * leather: studded jerkin. rags: torn and patched. noble: long coat with fur collar.
 * peasant: plain smock with rope belt.
 */
export type Outfit = "tunic" | "robe" | "gown" | "tabard" | "armor" | "leather" | "rags" | "noble" | "peasant";
export type Headgear = "none" | "hood" | "crown" | "helmet" | "cap" | "circlet" | "wrap";
export type WeaponKind = "none" | "sword" | "broadsword" | "shortsword" | "dagger" | "axe" | "mace" | "warhammer" | "spear" | "quarterstaff" | "bow" | "staff";
export type OffHand = "none" | "shield" | "book";

export interface Look {
  build: Build;
  fem: boolean;
  skin: string;
  eyes: string;
  hair: string;
  hairStyle: HairStyle;
  beard: Beard;
  beardCol?: string;
  /** stern / kind / wild brows and wrinkles */
  mood?: "kind" | "stern" | "wild" | "sly";
  wrinkles?: boolean;
  scar?: boolean;
  outfit: Outfit;
  /** main cloth colour */
  main: string;
  /** trim / embroidery / second colour */
  trim: string;
  /** shirt / sleeves under the outfit */
  shirt: string;
  pants: string;
  boots: string;
  belt: string;
  /** buckles, clasps, studs (gold, brass, iron) */
  buckle: string;
  /** armour steel */
  metal: string;
  cloak?: string;
  /** cloak lining / inside */
  lining?: string;
  hood?: "up" | "down";
  hat: Headgear;
  hatCol: string;
  plume?: string;
  /** scarf over the lower face */
  mask?: string;
  /** heraldic device on tabard / shield: [field, charge] */
  device?: [string, string];
  pouch?: boolean;
  /** waist sash (robes, coats, gowns) */
  sash?: string;
  /** apron over a gown */
  apron?: string;
  /** blade colour (e.g. a golden sword, which then glows) */
  blade?: string;
  chain?: boolean;
  gloves?: string;
  weapon: WeaponKind;
  off: OffHand;
  offCol?: string;
  /** colour of the glow when casting */
  magic: string;
}

export const PERSON_FRAMES: Record<Pose, number> = { idle: 2, walk: 4, attack: 4, hurt: 2, cast: 3, dead: 1 };

// ------------------------------------------------------------------ colour helpers
const SH = new Map<string, string>();
/** Cached hue-shifted shade (see palette.hs). */
const sh = (c: string, f: number) => {
  const k = c + f;
  let v = SH.get(k);
  if (!v) { v = hs(c, f); SH.set(k, v); }
  return v;
};
interface Tone { d2: string; d: string; b: string; l: string; l2: string }
const TONES = new Map<string, Tone>();
/** Five steps of a material: deep shadow, shadow, base, light, specular. [d, b, l] is px.ramp. */
function tone(c: string): Tone {
  let t = TONES.get(c);
  if (!t) {
    const [d, b, l] = ramp(c);
    t = { d2: sh(c, -0.5), d, b, l, l2: sh(c, 0.45) };
    TONES.set(c, t);
  }
  return t;
}
const mx = (a: string, b: string, t: number) => mix(a, b, t);
const SKT = new Map<string, Tone>();
/** Skin gets its own ramp: shadows drift to a soft rose-violet instead of saturated orange. */
function skinTone(c: string): Tone {
  let t = SKT.get(c);
  if (!t) {
    t = { d2: mix(c, "#5a2c3c", 0.48), d: mix(c, "#9a5866", 0.3), b: c, l: mix(c, "#fff3e2", 0.32), l2: mix(c, "#ffffff", 0.6) };
    SKT.set(c, t);
  }
  return t;
}

// ------------------------------------------------------------------ pixel grid
type Cell = string | null;
interface Fx { x: number; y: number; c: string; a: number }

/** A colour grid that is painted, outlined, then turned into a canvas (via Px). */
class Grid {
  c: Cell[];
  /** light effects keyed by pixel index (the strongest wins) */
  fx = new Map<number, Fx>();
  constructor(readonly w: number, readonly h: number) { this.c = new Array(w * h).fill(null); }
  px(x: number, y: number, col: Cell) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.c[y * this.w + x] = col;
  }
  get(x: number, y: number): Cell {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x];
  }
  /** Paint only where something is already painted. */
  over(x: number, y: number, col: string) { if (this.get(x, y)) this.px(x, y, col); }
  rect(x: number, y: number, w: number, h: number, col: Cell) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.px(xx, yy, col);
  }
  span(x0: number, x1: number, y: number, col: Cell) {
    const a = Math.round(Math.min(x0, x1)), b = Math.round(Math.max(x0, x1));
    for (let x = a; x <= b; x++) this.px(x, y, col);
  }
  vline(x: number, y0: number, y1: number, col: Cell) {
    const a = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    for (let y = a; y <= b; y++) this.px(x, y, col);
  }
  line(x0: number, y0: number, x1: number, y1: number, col: Cell) {
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
  poly(pts: [number, number][], col: Cell) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.px(x, y, col);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, col: Cell) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
      if (dx * dx + dy * dy <= 1) this.px(x, y, col);
    }
  }
  /**
   * Shaded capsule from a to b (pixel centres), radius r, lit from the upper left:
   * [shadow, base, light]. Used for limbs, hafts and blades.
   */
  limb(ax: number, ay: number, bx: number, by: number, r: number, t: [string, string, string], hiBias = 0.3) {
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1e-6, len = Math.sqrt(len2);
    const ux = vx / len, uy = vy / len;
    // normal pointing towards the light (upper left)
    let nx = -uy, ny = ux;
    if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; }
    const x0 = Math.floor(Math.min(ax, bx) - r - 1), x1 = Math.ceil(Math.max(ax, bx) + r + 1);
    const y0 = Math.floor(Math.min(ay, by) - r - 1), y1 = Math.ceil(Math.max(ay, by) + r + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x - ax, py = y - ay;
      const k = Math.max(0, Math.min(1, (px * vx + py * vy) / len2));
      const qx = px - vx * k, qy = py - vy * k;
      const d = Math.sqrt(qx * qx + qy * qy);
      if (d > r + 0.15) continue;
      const s = (qx * nx + qy * ny) / (r || 1);
      this.px(x, y, s > hiBias + 0.15 ? t[2] : s < -0.25 ? t[0] : t[1]);
    }
  }
  /** Contour around a limb, painted only over what is already there (separates overlapping parts). */
  contour(ax: number, ay: number, bx: number, by: number, r: number, col: string) {
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1e-6;
    for (let y = Math.floor(Math.min(ay, by) - r - 1); y <= Math.ceil(Math.max(ay, by) + r + 1); y++) for (let x = Math.floor(Math.min(ax, bx) - r - 1); x <= Math.ceil(Math.max(ax, bx) + r + 1); x++) {
      const k = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
      const d = Math.hypot(x - ax - vx * k, y - ay - vy * k);
      if (d <= r + 0.15 && this.get(x, y)) this.px(x, y, col);
    }
  }
  glow(x: number, y: number, c: string, a: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0.01) return;
    const k = y * this.w + x, o = this.fx.get(k);
    if (!o || o.a < a) this.fx.set(k, { x, y, c, a });
  }
  /** Soft round light (not outlined). */
  halo(cx: number, cy: number, r: number, c: string, a: number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d <= 1) this.glow(x, y, c, a * (1 - d * d));
    }
  }
  flip() {
    const n = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) n.c[y * this.w + x] = this.c[y * this.w + (this.w - 1 - x)];
    for (const f of this.fx.values()) n.glow(this.w - 1 - f.x, f.y, f.c, f.a);
    return n;
  }
  /** Rotate 90° clockwise into a new grid of h x w. */
  rotCW() {
    const n = new Grid(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) n.px(this.h - 1 - y, x, this.c[y * this.w + x]);
    return n;
  }
  /** Rotate 90° counter-clockwise into a new grid of h x w. */
  rotCCW() {
    const n = new Grid(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) n.px(y, this.w - 1 - x, this.c[y * this.w + x]);
    return n;
  }
  /** Copy painted cells of another grid at an offset. */
  blit(o: Grid, dx: number, dy: number) {
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const v = o.c[y * o.w + x]; if (v) this.px(x + dx, y + dy, v); }
    for (const f of o.fx.values()) this.glow(f.x + dx, f.y + dy, f.c, f.a);
  }
  /**
   * Selective outline: a softer, local-hue line on top/left edges (towards the light) and a
   * dark hue outline on the bottom/right.
   */
  outline() {
    const out: [number, number, string][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.c[y * this.w + x]) continue;
      const below = this.get(x, y + 1), right = this.get(x + 1, y), left = this.get(x - 1, y), above = this.get(x, y - 1);
      const lit = below ?? right;
      const dark = above ?? left;
      if (dark) out.push([x, y, hueOutline(hexRGB(dark))]);
      else if (lit) out.push([x, y, below ? sh(lit, -0.55) : sh(lit, -0.6)]);
    }
    for (const [x, y, c] of out) this.px(x, y, c);
  }
  canvas(): HTMLCanvasElement {
    const p = new Px(this.w, this.h);
    const img = p.g.createImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.c.length; i++) {
      const v = this.c[i];
      if (!v) continue;
      const [r, g, b] = hexRGB(v);
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    // light effects are blended on top (additive-ish, they are not outlined)
    for (const f of this.fx.values()) {
      if (f.x < 0 || f.y < 0 || f.x >= this.w || f.y >= this.h) continue;
      const i = (f.y * this.w + f.x) * 4;
      const [r, g, b] = hexRGB(f.c);
      const a0 = d[i + 3] / 255, a = Math.min(1, f.a);
      if (a0 === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(a * 255); continue; }
      d[i] = Math.min(255, d[i] * (1 - a) + r * a + d[i] * a * 0.35);
      d[i + 1] = Math.min(255, d[i + 1] * (1 - a) + g * a + d[i + 1] * a * 0.35);
      d[i + 2] = Math.min(255, d[i + 2] * (1 - a) + b * a + d[i + 2] * a * 0.35);
      d[i + 3] = Math.max(d[i + 3], Math.round(a * 255));
    }
    p.g.putImageData(img, 0, 0);
    return p.c;
  }
}

const RGB = new Map<string, [number, number, number]>();
function hexRGB(c: string): [number, number, number] {
  let v = RGB.get(c);
  if (!v) {
    const n = parseInt(c.slice(1, 7), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RGB.set(c, v);
  }
  return v;
}

// ------------------------------------------------------------------ geometry
type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const rad = (deg: number) => (deg * Math.PI) / 180;
const dirOf = (deg: number): V => [Math.cos(rad(deg)), Math.sin(rad(deg))];

/** Two-bone IK: elbow/knee for a limb from root to target, bending towards `hint`. */
function ik(root: V, target: V, a: number, b: number, hint: V): { mid: V; end: V } {
  let dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const maxD = (a + b) * 0.999, minD = Math.abs(a - b) + 0.01;
  const ux = dx / d, uy = dy / d;
  if (d > maxD) d = maxD;
  if (d < minD) d = minD;
  dx = ux * d; dy = uy * d;
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
  const al = Math.acos(cosA);
  const r1: V = [ux * Math.cos(al) - uy * Math.sin(al), ux * Math.sin(al) + uy * Math.cos(al)];
  const r2: V = [ux * Math.cos(-al) - uy * Math.sin(-al), ux * Math.sin(-al) + uy * Math.cos(-al)];
  const pick = r1[0] * hint[0] + r1[1] * hint[1] >= r2[0] * hint[0] + r2[1] * hint[1] ? r1 : r2;
  return { mid: [root[0] + pick[0] * a, root[1] + pick[1] * a], end: [root[0] + dx, root[1] + dy] };
}

// ------------------------------------------------------------------ body metrics per build
interface Dims {
  T: number; // skull top
  sy: number; // shoulder line
  wy: number; // belt line
  hy: number; // hip joints
  fy: number; // soles
  sw: number; // shoulder half width
  ww: number; // waist half width
  hw: number; // skirt / hip half width
  arm: [number, number];
  leg: [number, number];
  ar: number;
  lr: number;
  stoop: number;
}
function dims(L: Look): Dims {
  const d: Dims = { T: 2, sy: 18, wy: 28, hy: 31, fy: 46, sw: 6, ww: 5, hw: 5, arm: [5, 5.5], leg: [7.2, 7.8], ar: 1.5, lr: 2, stoop: 0 };
  if (L.fem) { d.sw = 5; d.ww = 4; d.hw = 5; d.ar = 1.3; d.lr = 1.8; }
  if (L.build === "slim") { d.sw = 5; d.ww = 4; d.hw = 4; d.ar = 1.3; d.lr = 1.8; }
  if (L.build === "broad") { d.sw = 7; d.ww = 6; d.hw = 6; d.ar = 1.9; d.lr = 2.2; }
  if (L.build === "old") { d.T = 4; d.sy = 19; d.stoop = 1; d.sw = 5; d.ww = 5; }
  if (L.build === "child") { d.T = 13; d.sy = 29; d.wy = 36; d.hy = 38; d.sw = 4; d.ww = 4; d.hw = 4; d.arm = [3.5, 4]; d.leg = [4.2, 4.4]; d.ar = 1.2; d.lr = 1.6; }
  return d;
}

// ------------------------------------------------------------------ rig
type Face = "calm" | "fierce" | "pain" | "focus" | "dead";
type Style = "arc" | "over" | "thrust" | "bow" | "staff" | "fist";
interface Rig {
  bob: number; // whole body
  breath: number; // shoulders + head
  lean: number; // side view: chest forward
  hdx: number;
  hdy: number;
  hR: V; // weapon hand, relative to its shoulder
  hL: V; // off hand
  fR: V; // [dx, lift] relative to the hip
  fL: V;
  wA: number; // weapon angle (deg, 0 = right, 90 = down)
  wBack?: boolean;
  face: Face;
  cloak: number;
  fx?: "arc" | "over" | "thrust" | "release" | "cast";
  fxArc?: [number, number];
  draw?: number; // bow: 0 slack .. 1 full draw ; -1 released
  castR?: boolean;
  glow?: number;
}

const styleOf = (w: WeaponKind): Style =>
  w === "spear" || w === "dagger" ? "thrust"
    : w === "axe" || w === "mace" || w === "warhammer" ? "over"
      : w === "bow" ? "bow"
        : w === "quarterstaff" || w === "staff" ? "staff"
          : w === "none" ? "fist" : "arc";

const R0 = (o: Partial<Rig>): Rig => ({ bob: 0, breath: 0, lean: 0, hdx: 0, hdy: 0, hR: [0, 10], hL: [0, 10], fR: [0, 0], fL: [0, 0], wA: 80, face: "calm", cloak: 0, ...o });

/** Idle angle / hand placement of a carried weapon (side view). */
function carrySide(w: WeaponKind): Partial<Rig> {
  switch (w) {
    case "spear": case "quarterstaff": case "staff": return { hR: [2, 8], wA: -90 };
    case "warhammer": return { hR: [1, 9], wA: -70 };
    case "bow": return { hL: [2, 8], hR: [0, 10], wA: 0 };
    case "dagger": return { hR: [1, 9], wA: 45 };
    case "axe": case "mace": return { hR: [1, 9], wA: 60 };
    default: return { hR: [1, 9], wA: 62 };
  }
}
/** Same for the front / back views (hand at the side). */
function carryFront(w: WeaponKind): Partial<Rig> {
  switch (w) {
    case "spear": case "quarterstaff": case "staff": return { hR: [-1, 9], wA: -90 };
    case "warhammer": return { hR: [-1, 9], wA: -100 };
    case "bow": return { hL: [1, 9], wA: 0 };
    case "dagger": return { hR: [-1, 10], wA: 100 };
    default: return { hR: [-1, 10], wA: 105 };
  }
}

function rigSide(pose: Pose, f: number, w: WeaponKind): Rig {
  const c = carrySide(w);
  const st = styleOf(w);
  switch (pose) {
    case "idle":
      return R0({ ...c, hL: c.hL ?? [-1, 9.5], fR: [2, 0], fL: [-2, 0], breath: f === 1 ? 1 : 0, cloak: f });
    case "walk": {
      const ph = [
        { fR: [5, 0] as V, fL: [-4, 0] as V, bob: 1, sw: -1 },
        { fR: [0, 0] as V, fL: [1, 3] as V, bob: 0, sw: 0 },
        { fR: [-4, 0] as V, fL: [5, 0] as V, bob: 1, sw: 1 },
        { fR: [1, 3] as V, fL: [0, 0] as V, bob: 0, sw: 0 },
      ][f % 4];
      const swing = ph.sw * 3;
      const hR: V = c.wA === -90 ? [2 + swing * 0.3, 8] : [1 + swing, 9 - Math.abs(swing) * 0.2];
      const hL: V = w === "bow" ? [2 - swing * 0.3, 8] : [-swing, 9 - Math.abs(swing) * 0.2];
      return R0({ ...c, hR, hL, fR: ph.fR, fL: ph.fL, bob: ph.bob, cloak: 1 + (f % 2), wA: c.wA! + (c.wA === -90 ? 0 : swing * 4) });
    }
    case "attack":
      if (st === "thrust") return [
        R0({ hR: [-4, 4], hL: [2, 5], wA: w === "dagger" ? 5 : 0, lean: -1, fR: [4, 0], fL: [-4, 0], bob: 1, face: "fierce" }),
        R0({ hR: [8, 1], hL: [6, 2], wA: 0, lean: 2, hdx: 1, fR: [7, 0], fL: [-4, 0], bob: 2, face: "fierce", fx: "thrust" }),
        R0({ hR: [6, 2], hL: [4, 3], wA: 2, lean: 1, hdx: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce" }),
        R0({ hR: [1, 5], hL: [2, 6], wA: -15, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
      ][f % 4];
      if (st === "over") return [
        R0({ hR: [-3, -8], hL: [-2, -7], wA: -170, wBack: true, lean: -1, hdx: -1, fR: [4, 0], fL: [-4, 0], face: "fierce" }),
        R0({ hR: [5, -6], hL: [4, -5], wA: -30, lean: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce", fx: "over", fxArc: [-170, -30] }),
        R0({ hR: [6, 5], hL: [5, 6], wA: 80, lean: 2, hdx: 1, fR: [6, 0], fL: [-4, 0], bob: 2, face: "fierce", fx: "over", fxArc: [-60, 80] }),
        R0({ hR: [3, 7], hL: [-1, 8], wA: 60, lean: 1, fR: [4, 0], fL: [-3, 0], bob: 1, face: "fierce" }),
      ][f % 4];
      if (st === "bow") return [
        R0({ hL: [7, 1], hR: [5, 1], wA: 0, draw: 0, fR: [3, 0], fL: [-3, 0], face: "focus" }),
        R0({ hL: [8, 0], hR: [-1, 0], wA: 0, draw: 1, lean: -1, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
        R0({ hL: [8, 0], hR: [-3, -1], wA: 0, draw: -1, lean: 0, fR: [3, 0], fL: [-3, 0], face: "fierce", fx: "release" }),
        R0({ hL: [6, 4], hR: [1, 6], wA: 10, draw: 0, fR: [3, 0], fL: [-3, 0], face: "calm" }),
      ][f % 4];
      if (st === "fist") return [
        R0({ hR: [-3, 4], hL: [3, 3], wA: 0, lean: -1, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
        R0({ hR: [9, 1], hL: [-1, 5], wA: 0, lean: 2, hdx: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce", fx: "thrust" }),
        R0({ hR: [6, 3], hL: [1, 5], wA: 0, lean: 1, fR: [5, 0], fL: [-4, 0], bob: 1, face: "fierce" }),
        R0({ hR: [3, 5], hL: [2, 5], wA: 0, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
      ][f % 4];
      if (st === "staff") return [
        R0({ hR: [-3, 2], hL: [-5, 4], wA: -150, wBack: true, lean: -1, fR: [4, 0], fL: [-4, 0], face: "fierce" }),
        R0({ hR: [6, 1], hL: [3, 3], wA: 5, lean: 2, hdx: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce", fx: "arc", fxArc: [-150, 5] }),
        R0({ hR: [5, 5], hL: [2, 6], wA: 40, lean: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce" }),
        R0({ hR: [2, 6], hL: [-1, 7], wA: -60, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
      ][f % 4];
      return [
        R0({ hR: [-4, -6], hL: [3, 5], wA: -140, wBack: true, lean: -1, hdx: -1, fR: [4, 0], fL: [-4, 0], face: "fierce" }),
        R0({ hR: [7, 0], hL: [-2, 6], wA: 8, lean: 2, hdx: 1, fR: [7, 0], fL: [-4, 0], bob: 2, face: "fierce", fx: "arc", fxArc: [-140, 8] }),
        R0({ hR: [5, 6], hL: [-2, 6], wA: 85, lean: 1, hdx: 1, fR: [6, 0], fL: [-4, 0], bob: 1, face: "fierce", fx: "arc", fxArc: [8, 85] }),
        R0({ hR: [3, 5], hL: [0, 7], wA: -45, fR: [3, 0], fL: [-3, 0], face: "fierce" }),
      ][f % 4];
    case "hurt":
      return [
        R0({ ...c, hR: [-3, 7], hL: [-4, 5], wA: (c.wA ?? 60) + 25, lean: -2, hdx: -1, hdy: 1, fR: [1, 0], fL: [-4, 0], bob: 1, face: "pain", cloak: 2 }),
        R0({ ...c, hR: [-1, 8], hL: [-2, 7], wA: (c.wA ?? 60) + 10, lean: -1, hdx: -1, fR: [2, 0], fL: [-3, 0], bob: 1, face: "pain", cloak: 1 }),
      ][f % 2];
    case "cast": {
      const castR = w === "staff" || w === "none";
      const up: V[] = [[3, 3], [6, -4], [8, -3]];
      const hand = up[f % 3];
      const base = castR ? { hR: hand, hL: [-1, 9] as V, wA: w === "staff" ? -80 + f * 10 : 0 } : { ...c, hL: [hand[0] + 1, hand[1]] as V };
      return R0({ ...base, castR, fR: [2, 0], fL: [-3, 0], lean: f === 0 ? 0 : 1, bob: f === 0 ? 0 : 1, face: "focus", fx: "cast", glow: f, cloak: f });
    }
    case "dead":
      return R0({ hR: [5, 6], hL: [4, 7], wA: 0, lean: 3, fR: [6, -6], fL: [5, -4], face: "dead" });
  }
}

/** Front (down) rigs. R is the character's right hand, i.e. the viewer's left. */
function rigFront(pose: Pose, f: number, w: WeaponKind): Rig {
  const c = carryFront(w);
  const st = styleOf(w);
  switch (pose) {
    case "idle":
      return R0({ ...c, hR: c.hR ?? [-1, 10], hL: c.hL ?? [1, 10], breath: f === 1 ? 1 : 0, cloak: f });
    case "walk": {
      const lift = [[2, 0], [0, 0], [0, 2], [0, 0]][f % 4];
      const sw = [1, 0, -1, 0][f % 4];
      return R0({ ...c, hR: add(c.hR ?? [-1, 10], [0, -sw]), hL: add(c.hL ?? [1, 10], [0, sw]), fR: [0, lift[0]], fL: [0, lift[1]], bob: f % 2 === 1 ? 0 : 1, cloak: 1 + (f % 2) });
    }
    case "attack":
      if (st === "thrust") return [
        R0({ hR: [1, 4], hL: [5, 6], wA: -90, face: "fierce", bob: 1 }),
        R0({ hR: [3, 10], hL: [6, 9], wA: 90, face: "fierce", bob: 1, fx: "thrust" }),
        R0({ hR: [2, 9], hL: [5, 9], wA: 95, face: "fierce" }),
        R0({ hR: [0, 8], hL: [2, 9], wA: -80, face: "fierce" }),
      ][f % 4];
      if (st === "over") return [
        R0({ hR: [4, -10], hL: [6, -9], wA: -100, wBack: true, face: "fierce" }),
        R0({ hR: [5, -6], hL: [7, -5], wA: -60, face: "fierce", fx: "over", fxArc: [-100, -40] }),
        R0({ hR: [5, 8], hL: [7, 8], wA: 90, face: "fierce", bob: 2, fx: "over", fxArc: [-40, 90] }),
        R0({ hR: [2, 9], hL: [3, 9], wA: 100, face: "fierce", bob: 1 }),
      ][f % 4];
      if (st === "bow") return [
        R0({ hL: [-4, 3], hR: [3, 4], wA: 90, draw: 0, face: "focus" }),
        R0({ hL: [-5, 2], hR: [1, 0], wA: 90, draw: 1, face: "fierce" }),
        R0({ hL: [-5, 2], hR: [-1, -1], wA: 90, draw: -1, face: "fierce", fx: "release" }),
        R0({ hL: [-2, 7], hR: [0, 9], wA: 90, draw: 0 }),
      ][f % 4];
      if (st === "fist") return [
        R0({ hR: [1, 4], hL: [-1, 5], face: "fierce" }),
        R0({ hR: [4, 8], hL: [0, 7], face: "fierce", bob: 1, fx: "thrust" }),
        R0({ hR: [3, 7], hL: [0, 7], face: "fierce" }),
        R0({ hR: [1, 6], hL: [-1, 7], face: "fierce" }),
      ][f % 4];
      return [
        R0({ hR: [-3, -7], hL: [1, 7], wA: -120, face: "fierce" }),
        R0({ hR: [3, 5], hL: [1, 8], wA: 70, face: "fierce", bob: 1, fx: "arc", fxArc: [-120, 70] }),
        R0({ hR: [7, 7], hL: [0, 9], wA: 130, face: "fierce", bob: 1, fx: "arc", fxArc: [70, 130] }),
        R0({ hR: [1, 6], hL: [1, 9], wA: -60, face: "fierce" }),
      ][f % 4];
    case "hurt":
      return [
        R0({ ...c, hR: [-4, 6], hL: [4, 6], wA: (c.wA ?? 100) + 20, bob: 1, hdy: 1, face: "pain", cloak: 2 }),
        R0({ ...c, hR: [-2, 8], hL: [2, 8], bob: 1, face: "pain", cloak: 1 }),
      ][f % 2];
    case "cast": {
      const castR = w === "staff" || w === "none";
      const up: V[] = [[1, 4], [2, -4], [3, -7]];
      const hand = up[f % 3];
      const base = castR ? { hR: hand, hL: [1, 10] as V, wA: w === "staff" ? -90 : 0 } : { ...c, hL: [-hand[0], hand[1]] as V };
      return R0({ ...base, castR, bob: f === 0 ? 0 : 1, face: "focus", fx: "cast", glow: f, cloak: f });
    }
    case "dead":
      return R0({ face: "dead" });
  }
}

// ------------------------------------------------------------------ hair styles
interface HairDef {
  /** front: lowest hair row per face column (12 columns), relative to the skull top; < 0 = no hair */
  fringe: number[];
  /** locks beside the face (columns just outside the skull) */
  side: number;
  /** back of the head / long hair behind the shoulders */
  back: number;
  /** side view: lowest row of the fringe over the forehead */
  sideFringe: number;
  tufts?: number[];
  tail?: "pony" | "braid" | "bun";
  wild?: boolean;
  curly?: boolean;
  bald?: boolean;
}
const HAIR: Record<HairStyle, HairDef> = {
  short: { fringe: [8, 6, 5, 4, 5, 4, 4, 4, 5, 5, 6, 8], side: 7, back: 12, sideFringe: 5 },
  messy: { fringe: [11, 9, 6, 5, 7, 5, 4, 6, 5, 6, 9, 11], side: 10, back: 15, sideFringe: 6, tufts: [3, 8] },
  long: { fringe: [15, 11, 7, 5, 4, 3, 3, 4, 5, 7, 11, 15], side: 19, back: 25, sideFringe: 5 },
  ponytail: { fringe: [9, 7, 5, 4, 4, 3, 3, 4, 4, 5, 7, 9], side: 8, back: 12, sideFringe: 4, tail: "pony" },
  braid: { fringe: [11, 8, 5, 4, 3, 3, 3, 3, 4, 5, 8, 11], side: 10, back: 13, sideFringe: 4, tail: "braid" },
  bun: { fringe: [8, 6, 4, 3, 3, 3, 3, 3, 3, 4, 6, 8], side: 6, back: 11, sideFringe: 3, tail: "bun" },
  bald: { fringe: Array(12).fill(-1), side: -1, back: -1, sideFringe: -1, bald: true },
  balding: { fringe: [10, 8, -1, -1, -1, -1, -1, -1, -1, -1, 8, 10], side: 10, back: 12, sideFringe: -1, bald: true },
  wild: { fringe: [14, 11, 7, 5, 6, 4, 5, 6, 4, 6, 11, 14], side: 15, back: 19, sideFringe: 8, wild: true, tufts: [1, 4, 7, 10] },
  cropped: { fringe: [6, 5, 4, 3, 3, 3, 3, 3, 3, 4, 5, 6], side: 6, back: 11, sideFringe: 3 },
  curly: { fringe: [10, 8, 6, 5, 5, 4, 4, 5, 5, 6, 8, 10], side: 11, back: 14, sideFringe: 5, curly: true },
};

interface Head { x0: number; T: number; face: Face; view: "front" | "back" | "side" }

const SCLERA = "#f3eee6";
const lipOf = (L: Look) => (L.fem ? mx(skinTone(L.skin).d, "#c04a58", 0.5) : mx(skinTone(L.skin).d, "#8a4048", 0.3));
const lineOf = (L: Look) => mx(sh(L.skin, -0.7), "#1c1018", 0.45);
const browOf = (L: Look) => mx(mix(sh(L.hair, -0.3), "#3a2a2a", 0.35), lineOf(L), 0.25);
const blushOf = (L: Look) => mx(L.skin, "#e87a6a", 0.15);

/** Skull rows (front/back view): [x from, x to] relative to x0, for T-relative rows 0..14. */
const SKULL: [number, number][] = [
  [2, 9], [1, 10], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [1, 10], [2, 9],
];
/** Profile rows (facing right). */
const PROFILE: [number, number][] = [
  [3, 8], [1, 9], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 11], [0, 10], [0, 10], [0, 11], [1, 12], [1, 11], [2, 10], [3, 9],
];

function faceFront(g: Grid, L: Look, h: Head) {
  const { x0, T } = h;
  const sk = skinTone(L.skin);
  // ears
  for (const [ex, c1, c2] of [[x0 - 1, sk.b, sk.d], [x0 + 12, sk.d, sk.d2]] as [number, string, string][]) {
    g.px(ex, T + 8, c1); g.px(ex, T + 9, c2); g.px(ex, T + 10, c1);
  }
  SKULL.forEach(([a, b], r) => {
    for (let x = a; x <= b; x++) {
      let c = sk.b;
      if (x <= 1 && r >= 3 && r <= 11) c = sk.l;
      if (x >= 11 || (x === 10 && r >= 11)) c = sk.d;
      if (r === 14 || (r === 13 && (x === 1 || x === 10))) c = sk.d;
      if (r <= 1 && x <= 5) c = sk.l;
      g.px(x0 + x, T + r, c);
    }
  });
  // cheek bones / jaw light
  g.px(x0 + 2, T + 11, blushOf(L)); g.px(x0 + 9, T + 11, mx(blushOf(L), sk.d, 0.4));
  g.px(x0 + 1, T + 12, sk.l);
  const ln = lineOf(L), br = browOf(L);
  const iris = L.eyes, ir = tone(iris);
  const pupil = mx(ir.d2, "#120a14", 0.5);
  // eyes: [left eye cols 2..4], [right eye cols 7..9]
  const eyes = (calm: boolean) => {
    for (const side of [0, 1]) {
      const o = side === 0 ? 2 : 7; // first column
      const outer = side === 0 ? o : o + 2, inner = side === 0 ? o + 2 : o;
      const mid = o + 1;
      // upper lid
      g.span(x0 + o, x0 + o + 2, T + 8, ln);
      if (L.fem) g.px(x0 + (side === 0 ? o - 1 : o + 3), T + 8, ln);
      g.px(x0 + outer, T + 9, SCLERA);
      g.px(x0 + mid, T + 9, side === 0 ? "#ffffff" : pupil);
      g.px(x0 + inner, T + 9, side === 0 ? pupil : "#ffffff");
      g.px(x0 + mid, T + 10, side === 0 ? ir.b : ir.d);
      g.px(x0 + inner, T + 10, side === 0 ? ir.d : ir.b);
      g.px(x0 + outer, T + 10, sk.d);
      if (!calm) g.px(x0 + outer, T + 9, sk.d);
    }
  };
  const brow = (kind: "flat" | "angry" | "up" | "sad") => {
    for (const side of [0, 1]) {
      const o = side === 0 ? 2 : 7;
      const outer = side === 0 ? o : o + 2, inner = side === 0 ? o + 2 : o;
      const yo = kind === "angry" ? 6 : kind === "up" ? 6 : 7;
      const yi = kind === "angry" ? 7 : kind === "sad" ? 6 : yo;
      g.px(x0 + outer, T + yo, br); g.px(x0 + o + 1, T + Math.min(yo, yi) + (kind === "angry" ? 1 : 0), br); g.px(x0 + inner, T + yi, br);
      if (kind === "angry") g.px(x0 + inner, T + 8, ln);
    }
  };
  const mood = L.mood ?? "kind";
  switch (h.face) {
    case "calm": eyes(true); brow(mood === "stern" ? "angry" : mood === "wild" ? "up" : mood === "sly" ? "angry" : "flat"); break;
    case "fierce": eyes(false); brow("angry"); break;
    case "focus": eyes(true); brow("up"); break;
    case "pain":
      for (const o of [2, 7]) { g.span(x0 + o, x0 + o + 2, T + 9, ln); g.px(x0 + (o === 2 ? o + 2 : o), T + 8, ln); g.px(x0 + (o === 2 ? o : o + 2), T + 10, sk.d); }
      brow("sad");
      break;
    case "dead":
      for (const o of [2, 7]) { g.span(x0 + o, x0 + o + 2, T + 9, ln); g.px(x0 + o + 1, T + 10, sk.d); }
      brow("flat");
      break;
  }
  // nose: bridge light, shadow on the right, nostril
  g.px(x0 + 5, T + 10, sk.l);
  g.px(x0 + 6, T + 11, sk.d);
  g.px(x0 + 5, T + 12, mx(sk.d, sk.b, 0.4));
  g.px(x0 + 6, T + 12, sk.d2);
  // mouth
  const lip = lipOf(L);
  if (h.face === "fierce") { g.span(x0 + 4, x0 + 7, T + 13, ln); g.px(x0 + 5, T + 13, "#efe8dc"); g.px(x0 + 6, T + 13, "#d8d0c4"); }
  else if (h.face === "pain" || h.face === "dead") { g.px(x0 + 5, T + 13, ln); g.px(x0 + 6, T + 13, ln); g.px(x0 + 5, T + 14, sh(lip, -0.2)); g.px(x0 + 6, T + 14, sk.d2); }
  else {
    g.px(x0 + 5, T + 13, lip); g.px(x0 + 6, T + 13, sh(lip, -0.15));
    if (L.fem) g.px(x0 + 5, T + 14, sh(lip, 0.25));
    else if (mood === "kind") { g.px(x0 + 4, T + 13, mx(lip, L.skin, 0.5)); g.px(x0 + 7, T + 13, mx(lip, L.skin, 0.6)); }
    if (mood === "sly") g.px(x0 + 7, T + 12, mx(lip, L.skin, 0.4));
  }
  if (L.wrinkles) {
    g.px(x0 + 1, T + 10, sk.d); g.px(x0 + 10, T + 10, sk.d2);
    g.px(x0 + 3, T + 12, sk.d); g.px(x0 + 8, T + 12, sk.d);
    g.px(x0 + 4, T + 5, sk.d); g.px(x0 + 7, T + 5, sk.d);
  }
  if (L.scar) { g.px(x0 + 8, T + 7, "#b86a6a"); g.px(x0 + 9, T + 9, "#c47a72"); g.px(x0 + 9, T + 10, "#b86a6a"); g.px(x0 + 10, T + 11, "#b86a6a"); }
}

function faceSide(g: Grid, L: Look, h: Head) {
  const { x0, T } = h;
  const sk = skinTone(L.skin);
  PROFILE.forEach(([a, b], r) => {
    for (let x = a; x <= b; x++) {
      let c = sk.b;
      if (r === 14 || (r === 13 && x <= 4)) c = sk.d;
      if (x === b && r >= 2 && r <= 6) c = sk.l;
      if (r <= 1) c = sk.l;
      if (x <= 2 && r >= 9) c = sk.d;
      g.px(x0 + x, T + r, c);
    }
  });
  // jaw line and cheek
  g.px(x0 + 4, T + 12, sk.d); g.px(x0 + 5, T + 13, sk.d);
  g.px(x0 + 8, T + 11, blushOf(L));
  // ear
  g.px(x0 + 4, T + 8, sk.b); g.px(x0 + 5, T + 8, sk.b); g.px(x0 + 4, T + 9, sk.d); g.px(x0 + 5, T + 9, sk.d2); g.px(x0 + 4, T + 10, sk.b); g.px(x0 + 5, T + 10, sk.d);
  const ln = lineOf(L), br = browOf(L);
  const ir = tone(L.eyes), pupil = mx(ir.d2, "#120a14", 0.5);
  const e = x0 + 8;
  switch (h.face) {
    case "pain": case "dead":
      g.span(e, e + 1, T + 9, ln); g.px(e + 1, T + 10, sk.d);
      g.px(e, T + 7, br); g.px(e + 1, T + (h.face === "pain" ? 6 : 7), br);
      break;
    default: {
      const fierce = h.face === "fierce";
      g.span(e - 1, e + 1, T + 8, ln);
      if (L.fem) g.px(e + 2, T + 8, ln);
      g.px(e, T + 9, fierce ? pupil : "#ffffff"); g.px(e + 1, T + 9, pupil);
      g.px(e, T + 10, ir.b); g.px(e + 1, T + 10, ir.d);
      g.px(e - 1, T + 9, fierce ? sk.d : SCLERA);
      const up = h.face === "focus" ? -1 : 0;
      g.px(e - 1, T + 7 + up, br); g.px(e, T + 7 + up, br); g.px(e + 1, T + (fierce || L.mood === "stern" ? 8 : 7) + up, br);
    }
  }
  // nose
  if (L.fem || L.build === "child") { g.px(x0 + 12, T + 11, null); g.px(x0 + 11, T + 12, sk.d); }
  else { g.px(x0 + 12, T + 11, sk.b); g.px(x0 + 11, T + 12, sk.d); g.px(x0 + 12, T + 12, sk.d); }
  g.px(x0 + 11, T + 10, sk.l);
  // mouth
  const lip = lipOf(L);
  if (h.face === "fierce") { g.px(x0 + 10, T + 13, ln); g.px(x0 + 9, T + 13, ln); }
  else if (h.face === "pain" || h.face === "dead") { g.px(x0 + 10, T + 13, ln); g.px(x0 + 9, T + 13, sh(lip, -0.2)); }
  else { g.px(x0 + 10, T + 13, lip); g.px(x0 + 9, T + 13, mx(lip, L.skin, 0.5)); }
  if (L.wrinkles) { g.px(x0 + 7, T + 10, sk.d); g.px(x0 + 9, T + 12, sk.d); g.px(x0 + 8, T + 5, sk.d); }
  if (L.scar) { g.px(x0 + 7, T + 9, "#c47a72"); g.px(x0 + 8, T + 11, "#b86a6a"); g.px(x0 + 7, T + 12, "#b86a6a"); }
}

function headBack(g: Grid, L: Look, h: Head) {
  const { x0, T } = h;
  const sk = skinTone(L.skin);
  g.px(x0 - 1, T + 8, sk.d); g.px(x0 - 1, T + 9, sk.d2); g.px(x0 - 1, T + 10, sk.d);
  g.px(x0 + 12, T + 8, sk.b); g.px(x0 + 12, T + 9, sk.d); g.px(x0 + 12, T + 10, sk.b);
  SKULL.forEach(([a, b], r) => { for (let x = a; x <= b; x++) g.px(x0 + x, T + r, r >= 12 ? sk.d : x >= 9 ? sk.d : sk.b); });
}

/** Hair colour at a pixel, given its position in the hairdo. */
function hairShade(t: Tone, u: number, y: number, top: number, bottom: number, strand: boolean | undefined): string {
  const depth = y - top;
  if (y === bottom && bottom - top > 1) return t.d;
  if (depth <= 1 && u >= 0.15 && u <= 0.6) return depth === 0 && u > 0.25 && u < 0.5 ? t.l2 : t.l;
  if (depth === 2 && u >= 0.25 && u <= 0.45) return t.l;
  if (u >= 0.8) return strand ? t.d2 : t.d;
  if (strand && depth >= 3) return t.d;
  return t.b;
}

/** Long hair falling behind the head and shoulders (front view, drawn before the face). */
function hairBehindFront(g: Grid, L: Look, h: Head) {
  const H = HAIR[L.hairStyle];
  const t = tone(L.hair);
  const { x0, T } = h;
  if (H.back > 13 && !H.bald) {
    for (let x = x0 - 2; x <= x0 + 13; x++) {
      const u = (x - x0 + 2) / 15;
      const ragged = H.wild ? ((x * 7) % 3) : (x % 2);
      const bottom = T + H.back - ragged - (x === x0 - 2 || x === x0 + 13 ? 2 : 0);
      for (let y = T + 4; y <= bottom; y++) g.px(x, y, y >= bottom - 1 ? t.d2 : u > 0.6 ? t.d : (x - x0) % 3 === 0 ? t.d : t.b);
    }
  }
  if (H.tail === "braid") {
    for (let y = T + 10; y <= T + 22; y++) { const x = x0 + 12 + ((y >> 1) % 2); g.px(x, y, (y % 2) ? t.b : t.d); g.px(x + 1, y, t.d); }
    g.px(x0 + 12, T + 23, L.trim); g.px(x0 + 13, T + 23, L.trim);
  }
}

function hairFront(g: Grid, L: Look, h: Head) {
  const H = HAIR[L.hairStyle];
  const t = tone(L.hair);
  const { x0, T } = h;
  const sk = skinTone(L.skin);
  if (L.hairStyle === "bald" || L.hairStyle === "balding") {
    // scalp shine
    g.px(x0 + 3, T + 1, sk.l2); g.px(x0 + 4, T + 1, sk.l2); g.px(x0 + 2, T + 2, sk.l);
  }
  // side locks outside the skull
  if (H.side > 0) for (const x of [x0 - 1, x0 + 12]) {
    for (let y = T + 2; y <= T + H.side; y++) {
      if (H.side > 11 || y < T + 8 || y > T + 10) g.px(x, y, y === T + H.side ? t.d2 : x > x0 ? t.d : t.b);
    }
  }
  for (let i = 0; i < 12; i++) {
    const v = H.fringe[i];
    if (v < 0) continue;
    const x = x0 + i;
    const top = L.hairStyle === "balding" ? T + 3 : i === 0 || i === 11 ? T + 1 : SKULL[0][0] <= i && i <= SKULL[0][1] ? T - 1 : T;
    const bottom = T + v;
    const prev = H.fringe[i - 1] ?? v, next = H.fringe[i + 1] ?? v;
    for (let y = top; y <= bottom; y++) {
      const strand = (y > T + Math.min(prev, next) && (i % 3 === 1)) || (H.curly && (x + y) % 3 === 0);
      g.px(x, y, hairShade(t, i / 11, y, top, bottom, strand));
    }
    // soft shadow the fringe throws on the forehead
    if (g.get(x, bottom + 1) && bottom + 1 < T + 13 && bottom >= T + 3) g.px(x, bottom + 1, i >= 10 ? sk.d2 : sk.d);
  }
  if (H.tufts) for (const i of H.tufts) { g.px(x0 + i, T - 2, t.b); if (H.wild) { g.px(x0 + i - 1, T - 3, t.d); } }
  if (H.wild) { g.px(x0 - 2, T + 5, t.d); g.px(x0 - 2, T + 9, t.d); g.px(x0 + 13, T + 6, t.d2); g.px(x0 + 13, T + 11, t.d2); g.px(x0 - 2, T + 13, t.d); }
  if (H.curly) for (const [dx, dy] of [[1, 1], [4, 0], [8, 0], [10, 2]]) g.px(x0 + dx, T + dy - 1, t.l);
  if (H.tail === "bun") { g.ellipse(x0 + 5.5, T - 2, 2.5, 1.6, t.b); g.px(x0 + 4, T - 3, t.l); g.px(x0 + 5, T - 3, t.l2); g.px(x0 + 7, T - 1, t.d); }
  if (H.tail === "pony") { g.px(x0 + 12, T + 6, t.d); g.px(x0 + 12, T + 7, t.d); g.px(x0 + 13, T + 7, t.d2); }
}

function hairBack(g: Grid, L: Look, h: Head, overCloak: boolean) {
  const H = HAIR[L.hairStyle];
  const t = tone(L.hair);
  const { x0, T } = h;
  if (H.bald && L.hairStyle === "bald") { const sk = skinTone(L.skin); g.px(x0 + 4, T + 1, sk.l2); g.px(x0 + 5, T + 1, sk.l); return; }
  const len = L.hairStyle === "balding" ? 11 : Math.max(H.back, 11);
  for (let x = x0 - 1; x <= x0 + 12; x++) {
    const i = x - x0;
    const u = (i + 1) / 13;
    if (L.hairStyle === "balding" && i >= 1 && i <= 10 && overCloak === false) {
      // ring of hair around the back of the head
      for (let y = T + 6; y <= T + 11; y++) g.px(x, y, y === T + 11 ? t.d : u > 0.7 ? t.d : t.b);
      continue;
    }
    const top = i < 0 || i > 11 ? T + 2 : SKULL[0][0] <= i && i <= SKULL[0][1] ? T - 1 : T;
    const rag = H.wild ? (i * 5) % 3 : (i % 3 === 0 ? 1 : 0);
    const bottom = T + len - rag - (i < 1 || i > 10 ? 1 : 0);
    for (let y = top; y <= bottom; y++) {
      if (overCloak && y < T + 15) continue;
      const strand = (i % 3 === 1 && y > top + 3) || (H.curly && (x + y) % 3 === 0);
      g.px(x, y, hairShade(t, u, y, top, bottom, strand));
    }
  }
  if (!overCloak) {
    if (H.tufts) for (const i of H.tufts) g.px(x0 + i, T - 2, t.b);
    if (H.tail === "bun") { g.ellipse(x0 + 5.5, T + 4, 2.5, 2, t.b); g.px(x0 + 4, T + 3, t.l); g.px(x0 + 7, T + 5, t.d); g.span(x0 + 4, x0 + 7, T + 6, t.d2); }
    if (H.tail === "pony") for (let y = T + 8; y <= T + 18; y++) { g.px(x0 + 5, y, t.b); g.px(x0 + 6, y, y > T + 16 ? t.d2 : t.d); if (y < T + 14) g.px(x0 + 4, y, t.l); }
    if (H.tail === "pony") g.span(x0 + 4, x0 + 7, T + 8, L.trim);
    if (H.tail === "braid") for (let y = T + 10; y <= T + 22; y++) { g.px(x0 + 5 + ((y >> 1) % 2), y, y % 2 ? t.b : t.l); g.px(x0 + 6 - ((y >> 1) % 2), y, t.d); }
  }
}

function hairSide(g: Grid, L: Look, h: Head, behind: boolean) {
  const H = HAIR[L.hairStyle];
  const t = tone(L.hair);
  const { x0, T } = h;
  if (behind) {
    // long hair falling down the back
    if (H.back > 13 && !H.bald) {
      for (let x = x0 - 1; x <= x0 + 5; x++) {
        const bottom = T + H.back - ((x * 3) % 2) - (x === x0 - 1 ? 3 : 0);
        for (let y = T + 6; y <= bottom; y++) g.px(x, y, y >= bottom - 1 ? t.d2 : x <= x0 ? t.d : (x % 3 === 0 ? t.d : t.b));
      }
    }
    if (H.tail === "pony") for (let y = T + 7; y <= T + 18; y++) { const x = x0 - 2 + Math.floor((y - T - 7) / 5); g.px(x, y, t.b); g.px(x + 1, y, t.d); }
    if (H.tail === "braid") for (let y = T + 9; y <= T + 22; y++) { g.px(x0 + 1, y, y % 2 ? t.b : t.l); g.px(x0 + 2, y, t.d); }
    return;
  }
  const sk = skinTone(L.skin);
  if (H.bald && L.hairStyle === "bald") { g.px(x0 + 5, T, sk.l2); g.px(x0 + 6, T, sk.l2); g.px(x0 + 4, T + 1, sk.l); return; }
  // columns over the skull, back of the head to the forehead
  const TOPS: Record<number, number> = { [-1]: 3, 0: 1, 1: 0, 2: 0, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1, 9: 0, 10: 1, 11: 2 };
  const nape = Math.max(9, Math.min(H.back, 14));
  for (let i = -1; i <= 11; i++) {
    const x = x0 + i;
    let top = T + TOPS[i];
    let bottom: number;
    if (L.hairStyle === "balding") {
      if (i > 5) continue;
      top = T + 4; bottom = T + (i <= 3 ? 11 : 7);
    } else if (i <= 3) bottom = T + nape - (i === -1 ? 2 : 0) - (i === 3 ? 1 : 0) + (i === 1 && nape > 11 ? 1 : 0);
    else if (i <= 5) bottom = H.side > 10 ? T + H.side : T + 7;
    else if (i === 6) bottom = T + Math.min(H.sideFringe + 1, 7);
    else bottom = T + H.sideFringe - (i >= 10 ? 1 : 0) - (i === 11 ? 1 : 0);
    if (i >= 6 && H.sideFringe < 0) bottom = T + 1;
    if (i === 11 && H.sideFringe < 5) continue;
    for (let y = top; y <= bottom; y++) {
      const depth = y - top;
      let c = t.b;
      if (depth <= 1 && i >= 1 && i <= 7) c = depth === 0 && i >= 3 && i <= 5 ? t.l2 : t.l;
      else if (depth === 2 && i >= 2 && i <= 4) c = t.l;
      else if (i <= 0) c = depth < 2 ? t.b : t.d;
      else if ((i % 3 === 1 && depth > 2) || (H.curly && (x + y) % 3 === 0)) c = t.d;
      else if (i >= 9 && depth > 1) c = t.d;
      if (y === bottom && bottom - top > 2) c = y > T + 9 ? t.d2 : t.d;
      g.px(x, y, c);
    }
    if (i >= 6 && bottom >= T + 3 && g.get(x, bottom + 1)) g.px(x, bottom + 1, sk.d);
  }
  // a lock in front of the ear for long styles
  if (H.side > 10) for (let y = T + 6; y <= T + H.side; y++) { g.px(x0 + 5, y, y === T + H.side ? t.d2 : t.b); g.px(x0 + 6, y, t.d); }
  if (H.tufts) { g.px(x0 + 3, T - 2, t.b); g.px(x0 + 7, T - 2, t.b); g.px(x0 - 2, T + 4, t.d); }
  if (H.wild) { g.px(x0 - 2, T + 8, t.d); g.px(x0 - 2, T + 12, t.d2); g.px(x0 + 9, T - 2, t.d); }
  if (H.tail === "bun") { g.ellipse(x0 + 1, T + 2, 2, 2, t.b); g.px(x0, T + 1, t.l); g.px(x0 + 1, T + 4, t.d); }
}

function beardFront(g: Grid, L: Look, h: Head, long: boolean) {
  if (L.beard === "none") return;
  const t = tone(L.beardCol ?? L.hair);
  const { x0, T } = h;
  const lip = lipOf(L);
  switch (L.beard) {
    case "stubble":
      for (const [x, y] of [[1, 12], [3, 13], [5, 14], [7, 14], [9, 13], [10, 12], [2, 13], [8, 13], [6, 14], [4, 14]]) g.px(x0 + x, T + y, mx(L.skin, t.d, 0.45));
      return;
    case "moustache":
      g.span(x0 + 3, x0 + 8, T + 12, t.b); g.px(x0 + 3, T + 13, t.d); g.px(x0 + 8, T + 13, t.d); g.px(x0 + 4, T + 12, t.l);
      return;
    case "goatee":
      g.span(x0 + 4, x0 + 7, T + 12, t.b); g.span(x0 + 5, x0 + 6, T + 14, t.b); g.span(x0 + 5, x0 + 6, T + 15, t.d); g.px(x0 + 4, T + 12, t.l);
      return;
  }
  const rows = L.beard === "short" ? 1 : L.beard === "full" ? 2 : long ? 11 : 0;
  // jaw and chin
  for (let r = 10; r <= 14 + rows; r++) {
    const [a, b] = r <= 14 ? SKULL[r] : [Math.min(9, 2 + Math.floor((r - 14) / 2.5)), Math.max(2, 9 - Math.floor((r - 14) / 2.5))];
    for (let x = a; x <= b; x++) {
      if (r === 10 && x > 1 && x < 10) continue;
      if (r === 11 && x > 2 && x < 9) continue;
      if (L.beard === "short" && r === 12 && x > 3 && x < 8) continue;
      const u = x / 11;
      const c = r >= 14 + rows - 1 ? t.d : u > 0.7 ? t.d : (x + r) % 3 === 0 ? t.l : t.b;
      g.px(x0 + x, T + r, c);
    }
  }
  // moustache and mouth
  g.span(x0 + 3, x0 + 8, T + 12, t.b); g.px(x0 + 4, T + 12, t.l); g.px(x0 + 8, T + 12, t.d);
  g.px(x0 + 5, T + 13, sh(lip, -0.25)); g.px(x0 + 6, T + 13, sh(lip, -0.3));
}

function beardSide(g: Grid, L: Look, h: Head, long: boolean) {
  if (L.beard === "none") return;
  const t = tone(L.beardCol ?? L.hair);
  const { x0, T } = h;
  if (L.beard === "stubble") { for (const [x, y] of [[5, 12], [7, 13], [9, 14], [6, 13], [8, 14], [10, 14]]) g.px(x0 + x, T + y, mx(L.skin, t.d, 0.45)); return; }
  if (L.beard === "moustache") { g.span(x0 + 9, x0 + 11, T + 12, t.b); g.px(x0 + 9, T + 13, t.d); return; }
  if (L.beard === "goatee") { g.span(x0 + 9, x0 + 11, T + 12, t.b); g.span(x0 + 8, x0 + 10, T + 14, t.b); g.px(x0 + 9, T + 15, t.d); return; }
  const extra = L.beard === "short" ? 0 : L.beard === "full" ? 2 : long ? 11 : 0;
  for (let r = 9; r <= 14 + extra; r++) {
    const a = r <= 14 ? Math.max(4, PROFILE[r][0] + (r < 12 ? 3 : 1)) : 5 + Math.floor((r - 14) / 3);
    const b = r <= 14 ? Math.min(PROFILE[r][1], r >= 12 ? 11 : 6) : 10 - Math.floor((r - 14) / 4);
    for (let x = a; x <= b; x++) {
      if (r <= 11 && x > 6) continue;
      g.px(x0 + x, T + r, r >= 14 + extra - 1 ? t.d : (x + r) % 3 === 0 ? t.l : x < 6 ? t.d : t.b);
    }
  }
  g.span(x0 + 9, x0 + 11, T + 12, t.b); g.px(x0 + 10, T + 13, sh(lipOf(L), -0.25));
}

// ------------------------------------------------------------------ headgear
const GOLD = "#e3b23c";
const tint = (g: Grid, x: number, y: number, col: string, t: number) => { const c = g.get(x, y); if (c) g.px(x, y, mx(c, col, t)); };

function hatDraw(g: Grid, L: Look, h: Head) {
  const { x0, T, view } = h;
  const side = view === "side", back = view === "back";
  const c = tone(L.hatCol);
  switch (L.hat) {
    case "crown": {
      const gt = tone(L.hatCol || GOLD);
      const a = side ? 1 : 0, b = side ? 10 : 11;
      for (let x = a; x <= b; x++) { g.px(x0 + x, T + 2, x <= 2 ? gt.l : x >= b - 1 ? gt.d : gt.b); g.px(x0 + x, T + 3, x >= b - 1 ? gt.d2 : gt.d); }
      const pts = side ? [2, 5, 8] : [0, 3, 8, 11];
      for (const p of pts) { g.px(x0 + p, T + 1, gt.b); g.px(x0 + p, T, gt.l); }
      if (!side) { g.px(x0 + 5, T + 1, gt.b); g.px(x0 + 6, T + 1, gt.d); g.px(x0 + 5, T, gt.l2); g.px(x0 + 6, T, gt.b); g.px(x0 + 5, T - 1, gt.l); }
      if (!back) {
        g.px(x0 + (side ? 6 : 5), T + 2, "#d8344a"); g.px(x0 + (side ? 6 : 6), T + 3, "#8a1a30");
        if (!side) { g.px(x0 + 2, T + 2, "#4a7ad8"); g.px(x0 + 9, T + 2, "#4a7ad8"); }
      }
      g.px(x0 + (side ? 3 : 1), T + 2, gt.l2);
      return;
    }
    case "circlet": {
      const gt = tone(L.hatCol);
      const a = side ? 3 : 0, b = side ? 10 : 11;
      for (let x = a; x <= b; x++) g.px(x0 + x, T + 4, x <= a + 1 ? gt.l : x >= b - 1 ? gt.d : gt.b);
      if (!back) { const gx = side ? 10 : 5; g.px(x0 + gx, T + 4, L.magic); g.px(x0 + gx + (side ? 0 : 1), T + 4, side ? L.magic : sh(L.magic, -0.3)); g.glow(x0 + gx, T + 4, "#ffffff", 0.35); }
      return;
    }
    case "helmet": {
      const m = tone(L.metal);
      const a = side ? -1 : -1, b = side ? 11 : 12;
      for (let y = T - 2; y <= T + 5; y++) {
        const r = y - (T - 2);
        const inset = r === 0 ? 4 : r === 1 ? 2 : r === 2 ? 1 : 0;
        for (let x = a + inset; x <= b - inset; x++) {
          const u = (x - a) / (b - a);
          let col = u < 0.3 ? m.l : u > 0.75 ? m.d : m.b;
          if (r <= 2 && u > 0.2 && u < 0.45) col = m.l2;
          if (y === T + 5) col = u < 0.5 ? m.l : m.d;
          if (y === T + 4) col = m.d;
          g.px(x0 + x, y, col);
        }
      }
      // crest ridge and rivets
      if (!side) { for (let y = T - 2; y <= T + 3; y++) g.px(x0 + 5, y, y < T + 1 ? m.l2 : m.l); g.px(x0 + 6, T + 1, m.d); }
      else for (let x = 1; x <= 8; x++) g.px(x0 + x, T - 2 + (x < 3 || x > 6 ? 1 : 0), m.l2);
      for (const rx of side ? [1, 5, 9] : [0, 3, 8, 11]) g.px(x0 + rx, T + 5, m.l2);
      if (view === "front") { g.vline(x0 + 5, T + 6, T + 11, m.l); g.vline(x0 + 6, T + 6, T + 11, m.d); g.px(x0 + 5, T + 12, m.d); g.px(x0 + 6, T + 12, m.d2); }
      if (side) {
        g.vline(x0 + 11, T + 6, T + 11, m.d); g.vline(x0 + 12, T + 6, T + 10, m.b);
        for (let y = T + 6; y <= T + 11; y++) { g.px(x0 - 1, y, m.d); g.px(x0, y, m.b); g.px(x0 + 1, y, y === T + 11 ? m.d : m.l); }
      }
      if (back) for (let y = T + 6; y <= T + 12; y++) for (let x = -1; x <= 12; x++) g.px(x0 + x, y, y === T + 12 ? m.d2 : (x + y) % 2 ? m.d : m.b);
      if (L.plume) {
        const p = tone(L.plume);
        if (side) {
          for (let i = 0; i < 7; i++) { g.px(x0 + 5 - i, T - 3 + Math.floor(i / 2), i < 2 ? p.l : p.b); g.px(x0 + 5 - i, T - 2 + Math.floor(i / 2), p.d); }
          g.px(x0 - 2, T + 1, p.d2);
        } else {
          // a crest of feathers running over the top of the helmet
          const top = Math.max(0, T - 4);
          for (let y = top; y <= T + (back ? 4 : 1); y++) {
            const w = y <= top + 1 ? 1 : 2;
            for (let x = 6 - w; x <= 5 + w; x++) g.px(x0 + x, y, y === top ? p.l2 : x === 6 - w ? p.l : x === 5 + w ? p.d : (x + y) % 3 === 0 ? p.d : p.b);
          }
        }
      }
      return;
    }
    case "cap": {
      for (let y = T - 2; y <= T + 3; y++) {
        const r = y - (T - 2);
        const inset = r === 0 ? 3 : r === 1 ? 1 : 0;
        for (let x = -1 + inset; x <= 12 - inset; x++) {
          const u = (x + 1) / 13;
          g.px(x0 + x, y, u < 0.3 ? c.l : u > 0.72 ? c.d : (x + y) % 4 === 0 ? c.d : c.b);
        }
      }
      const tr = tone(L.trim);
      for (let x = -2; x <= 13; x++) { g.px(x0 + x, T + 3, x < 3 ? tr.l : x > 9 ? tr.d : tr.b); g.px(x0 + x, T + 4, tr.d); }
      if (!back) { g.px(x0 + (side ? 2 : 10), T - 3, "#e8e4d8"); g.px(x0 + (side ? 1 : 11), T - 4, "#e8e4d8"); g.px(x0 + (side ? 0 : 12), T - 4, "#c8c0b0"); }
      return;
    }
    case "wrap": {
      for (let y = T - 1; y <= T + 4; y++) {
        const r = y - (T - 1);
        const inset = r === 0 ? 3 : r === 1 ? 1 : 0;
        for (let x = inset - (side ? 0 : 0); x <= 11 - inset; x++) {
          const u = x / 11;
          g.px(x0 + x, y, y === T + 4 ? c.d : u < 0.3 ? c.l : u > 0.75 ? c.d : (x - y) % 4 === 0 ? c.d : c.b);
        }
      }
      // knot tails
      const kx = side ? x0 - 1 : back ? x0 + 6 : x0 + 12;
      g.px(kx, T + 3, c.b); g.px(kx, T + 4, c.d); g.px(kx + (side ? -1 : 1), T + 5, c.b); g.px(kx + (side ? -1 : 1), T + 6, c.d); g.px(kx, T + 6, c.d2);
      return;
    }
    default: return;
  }
}

/** Raised hood: a shell around the head with an opening for the face. */
function hoodUp(g: Grid, col: string, h: Head) {
  const { x0, T, view } = h;
  const c = tone(col);
  const open = (x: number, y: number) => {
    const r = y - T, i = x - x0;
    if (view === "back") return false;
    if (view === "side") return r >= 4 && r <= 15 && i >= (r < 6 ? 8 : 7) && i <= 13;
    if (r < 3 || r > 15) return false;
    const a = r === 3 ? 3 : r === 4 ? 2 : 1, b = 11 - a;
    return i >= a && i <= b;
  };
  const xa = view === "side" ? -2 : -2, xb = view === "side" ? 12 : 13;
  for (let y = T - 3; y <= T + 17; y++) {
    const r = y - (T - 3);
    const inset = r === 0 ? 4 : r === 1 ? 2 : r === 2 ? 1 : 0;
    for (let x = x0 + xa + inset; x <= x0 + xb - inset; x++) {
      if (open(x, y)) continue;
      if (view === "front" && y > T + 15 && (x < x0 - 1 || x > x0 + 12)) continue;
      const u = (x - x0 - xa) / (xb - xa);
      let k = u < 0.22 ? c.l : u > 0.78 ? c.d : c.b;
      if (r <= 2 && u > 0.2 && u < 0.5) k = c.l2;
      if (view === "back" && (x === x0 + 5 || x === x0 + 6) && r > 3) k = x === x0 + 5 ? c.d : c.l;
      if (view === "side" && x <= x0 + 1 && r > 5) k = c.d;
      g.px(x, y, k);
    }
  }
  // rim of the opening catches light, and throws a shadow on the face
  for (let y = T + 3; y <= T + 15; y++) for (let x = x0 - 1; x <= x0 + 13; x++) {
    if (!open(x, y)) continue;
    const edgeL = !open(x - 1, y), edgeR = !open(x + 1, y), edgeT = !open(x, y - 1);
    if (edgeL || edgeR || edgeT) tint(g, x, y, c.d2, 0.55);
    if (edgeL && !open(x - 1, y)) g.px(x - 1, y, view === "side" ? c.l : c.l);
    if (edgeR && view === "front") g.px(x + 1, y, c.b);
  }
}

function maskDraw(g: Grid, L: Look, h: Head) {
  if (!L.mask) return;
  const c = tone(L.mask);
  const { x0, T, view } = h;
  if (view === "back") { for (let x = 4; x <= 7; x++) g.px(x0 + x, T + 11, c.d); g.px(x0 + 5, T + 12, c.b); g.px(x0 + 6, T + 13, c.d); return; }
  for (let r = 11; r <= 15; r++) {
    const [a, b] = view === "side" ? [r <= 12 ? 6 : 4, r <= 12 ? 12 : r <= 13 ? 11 : 10] : r <= 14 ? [SKULL[r][0] - (r < 13 ? 1 : 0), SKULL[r][1] + (r < 13 ? 1 : 0)] : [3, 8];
    for (let x = a; x <= b; x++) g.px(x0 + x, T + r, (x - r) % 3 === 0 ? c.d : x <= a + 1 ? c.l : x >= b - 1 ? c.d : c.b);
  }
}

function drawHead(g: Grid, L: Look, h: Head) {
  if (h.view === "front") {
    faceFront(g, L, h);
    hairFront(g, L, h);
  } else if (h.view === "side") {
    faceSide(g, L, h);
    hairSide(g, L, h, false);
  } else {
    headBack(g, L, h);
    hairBack(g, L, h, false);
  }
  const longBeard = L.beard === "long";
  if (h.view === "front") beardFront(g, L, h, longBeard);
  if (h.view === "side") beardSide(g, L, h, longBeard);
  maskDraw(g, L, h);
  if (L.hood === "up" && L.cloak) hoodUp(g, L.cloak, h);
  hatDraw(g, L, h);
}

// ------------------------------------------------------------------ body
type View = "front" | "back" | "side";
interface Body { g: Grid; L: Look; D: Dims; R: Rig; view: View; T: number; sy: number; wy: number; hy: number; cloakHem?: number }

const ROPE = "#b39a64";
const isLong = (o: Outfit) => o === "robe" || o === "gown";
function hemOf(b: Body) {
  const { L, D, hy } = b;
  const o = L.outfit;
  if (isLong(o)) return D.fy - 2;
  const h = o === "tabard" ? hy + 8 : o === "noble" ? hy + 8 : o === "rags" ? hy + 6 : o === "leather" ? hy + 3 : hy + 4;
  return Math.min(h, D.fy - 4);
}
/** Cloth colour of the upper body. */
const bodyCol = (L: Look) => (L.outfit === "tabard" || L.outfit === "armor" ? L.metal : L.main);

/** Shade a horizontal run by position across it (u in 0..1). */
function shadeU(t: Tone, u: number) { return u < 0.13 ? t.l : u > 0.86 ? t.d2 : u > 0.72 ? t.d : t.b; }

// ---------- legs and boots
function bootFront(g: Grid, L: Look, cx: number, sole: number, inner: -1 | 1, child: boolean) {
  const t = tone(L.boots);
  const h = child ? 3 : 5;
  for (let y = sole - h; y <= sole; y++) {
    const r = y - (sole - h);
    const x0 = Math.round(cx - 2), x1 = Math.round(cx + 1) + (r >= h - 1 ? 0 : 0);
    const xa = r >= h - 1 && inner === -1 ? x0 : x0, xb = r >= h - 1 ? x1 + (inner === 1 ? 0 : 0) : x1;
    for (let x = xa; x <= xb; x++) {
      let c = x === xa ? t.l : x >= xb ? t.d : t.b;
      if (r === 0 && !child) c = x === xa ? t.l2 : x >= xb ? t.b : t.l; // folded cuff
      if (r === 1 && !child) c = t.d;
      if (y === sole) c = x === xa ? t.d : t.d2;
      if (y === sole - 1 && x === xa + 1) c = t.l;
      g.px(x, y, c);
    }
  }
}
function bootSide(g: Grid, L: Look, ax: number, sole: number, child: boolean, far: boolean) {
  const t = tone(far ? sh(L.boots, -0.2) : L.boots);
  const h = child ? 3 : 5;
  for (let y = sole - h; y <= sole; y++) {
    const r = y - (sole - h);
    const toe = r >= h - 1 ? 2 : r >= h - 2 ? 1 : 0;
    const x0 = Math.round(ax - 1.5), x1 = Math.round(ax + 1.5) + toe;
    for (let x = x0; x <= x1; x++) {
      let c = x === x0 ? t.l : x >= x1 ? t.d : t.b;
      if (r === 0 && !child) c = x === x0 ? t.l2 : t.l;
      if (r === 1 && !child) c = t.d;
      if (y === sole) c = t.d2;
      g.px(x, y, c);
    }
    if (r === h - 2) g.px(x1, y - 1, t.l);
  }
}

function legsFront(b: Body) {
  const { g, L, D, R, view, hy } = b;
  const back = view === "back";
  const p = tone(L.pants);
  const covered = isLong(L.outfit);
  const child = L.build === "child";
  const legs: [number, number][] = back ? [[17.5, R.fR[1]], [13.5, R.fL[1]]] : [[13.5, R.fR[1]], [17.5, R.fL[1]]];
  for (const [hx, lift] of legs) {
    const sole = D.fy - lift;
    const top = sole - (child ? 3 : 5);
    if (!covered) {
      g.limb(hx, hy, hx, top, D.lr - 0.25, [p.d, p.b, p.l], 0.35);
      // knee and inner seam
      g.px(Math.round(hx - 1), Math.round((hy + top) / 2) + 1, p.l);
      g.px(Math.round(hx + (hx < 15.5 ? 1 : -1)), Math.round((hy + top) / 2) + 2, p.d);
      if (L.outfit === "armor") {
        const m = tone(L.metal);
        for (let y = top - 4; y < top; y++) { g.px(Math.round(hx - 1.5), y, m.l); g.px(Math.round(hx - 0.5), y, m.l2); g.px(Math.round(hx + 0.5), y, m.b); g.px(Math.round(hx + 1.5), y, m.d); }
        g.px(Math.round(hx - 0.5), top - 5, m.l); g.px(Math.round(hx + 0.5), top - 5, m.d);
      }
    }
    bootFront(g, L, hx + 0.5, sole, hx < 15.5 ? 1 : -1, child);
  }
  // shadow between the legs
  if (!covered) for (let y = hy + 2; y < D.fy - 6; y++) if (g.get(15, y) && g.get(16, y)) { g.px(15, y, p.d); g.px(16, y, p.d2); }
}

function legsSide(b: Body, far: boolean) {
  const { g, L, D, R, hy } = b;
  const f = far ? R.fL : R.fR;
  const p = tone(far ? sh(L.pants, -0.22) : L.pants);
  const child = L.build === "child";
  const hip: V = [15.5 + (far ? -0.5 : 0.5), hy];
  const foot: V = [15.5 + f[0], D.fy - f[1]];
  const ankle: V = [foot[0], foot[1] - (child ? 3 : 5)];
  const { mid } = ik(hip, ankle, D.leg[0] * (child ? 1 : 1), D.leg[1] - (child ? 0 : 3), [0.9, -0.3]);
  if (!isLong(L.outfit)) {
    g.limb(hip[0], hip[1], mid[0], mid[1], D.lr, [p.d, p.b, p.l]);
    g.limb(mid[0], mid[1], ankle[0], ankle[1], D.lr - 0.3, [p.d, p.b, p.l]);
    g.px(Math.round(mid[0]) + 1, Math.round(mid[1]), p.l);
    if (L.outfit === "armor") { const m = tone(far ? sh(L.metal, -0.2) : L.metal); g.limb(mid[0], mid[1] + 1, ankle[0], ankle[1], D.lr - 0.4, [m.d, m.b, m.l2]); g.px(Math.round(mid[0]) + 1, Math.round(mid[1]), m.l2); }
  }
  bootSide(g, L, ankle[0], foot[1], child, far);
}

// ---------- torso
function rowsFront(b: Body): [number, number, number][] {
  const { D, sy, wy, L } = b;
  const rows: [number, number, number][] = [];
  for (let y = sy; y <= wy + 1; y++) {
    let hw = y === sy ? D.sw - 1 : y <= sy + 3 ? D.sw : D.sw + ((D.ww - D.sw) * (y - sy - 3)) / Math.max(1, wy - sy - 3);
    if (L.fem && y >= wy - 3) hw -= 0.5;
    rows.push([y, Math.round(16 - hw), Math.round(15 + hw)]);
  }
  return rows;
}

function torsoFront(b: Body) {
  const { g, L, D, R, view, sy, wy, hy } = b;
  const back = view === "back";
  const o = L.outfit;
  const up = tone(bodyCol(L)), main = tone(L.main), tr = tone(L.trim), bt = tone(L.belt), bk = tone(L.buckle), m = tone(L.metal);
  const hem = hemOf(b);
  const long = isLong(o);
  const mail = o === "tabard";
  // upper body
  for (const [y, x0, x1] of rowsFront(b)) for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    let c = shadeU(up, u);
    if (mail) c = u < 0.13 ? m.l : u > 0.75 ? ((x + y) % 2 ? m.d2 : m.d) : (x + y) % 2 ? m.d : m.b;
    if (o === "armor" && y <= sy + 1 && u > 0.2 && u < 0.5) c = m.l2;
    g.px(x, y, c);
  }
  // skirt / lower body
  const sway = R.cloak % 2 ? 1 : 0;
  for (let y = wy + 2; y <= hem; y++) {
    const k = (y - wy - 2) / Math.max(1, hem - wy - 2);
    const hw = long ? D.ww + 0.5 + k * (D.sw + (o === "gown" ? 2.5 : 1.5) - D.ww) : D.ww + 0.5 + k * (o === "noble" ? 1.5 : 1);
    const x0 = Math.round(16 - hw), x1 = Math.round(15 + hw);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      // hem lifts over the stepping foot
      if (y === hem && long && ((x < 16 && R.fR[1] > 0 && !back) || (x >= 16 && R.fL[1] > 0 && !back) || (x >= 16 && R.fR[1] > 0 && back) || (x < 16 && R.fL[1] > 0 && back))) continue;
      if (o === "rags" && y >= hem - 1 && ((x * 7 + y) % 4 === 0 || (y === hem && x % 3 === 1))) continue;
      let c = mail && y <= hy + 4 ? ((x + y) % 2 ? m.d : m.b) : shadeU(o === "armor" ? main : main, u);
      if (mail && y > hy + 4) continue;
      if (y === hem && (o === "tunic" || o === "robe" || o === "noble" || o === "gown")) c = u < 0.2 ? tr.l : u > 0.75 ? tr.d : tr.b;
      if (y === hem && (o === "peasant" || o === "leather")) c = main.d;
      g.px(x, y, c);
    }
    // folds
    const folds = long ? [x0 + 2, 15 + (sway ? 1 : 0), x1 - 2] : [x0 + 2, x1 - 2];
    if (y > wy + 3 && y < hem) for (const fx of folds) { g.over(fx, y, main.d); if (y > wy + 5) g.over(fx - 1, y, main.l); }
  }
  // front slit of a tunic
  if (!long && !back && (o === "tunic" || o === "peasant")) for (let y = hem - 2; y <= hem; y++) { g.over(15, y, main.d2); g.over(16, y, main.d); }

  const cx0 = 15, cx1 = 16;
  switch (o) {
    case "tunic": case "peasant":
      if (!back) {
        // V neckline with lacing
        g.px(cx0, sy, sh(L.skin, -0.2)); g.px(cx1, sy, sh(L.skin, -0.3));
        g.px(cx0, sy + 1, sh(L.skin, -0.25)); g.px(cx1, sy + 1, o === "tunic" ? tr.d : main.d2);
        g.px(cx0 - 1, sy, o === "tunic" ? tr.l : main.l); g.px(cx1 + 1, sy, o === "tunic" ? tr.b : main.d);
        g.px(cx0, sy + 2, o === "tunic" ? tr.b : main.d); g.px(cx1, sy + 2, main.d);
        if (o === "tunic") { g.px(cx0 - 1, sy + 1, tr.b); g.px(cx1 + 1, sy + 1, tr.d); g.px(cx0, sy + 3, tr.d); }
        // chest folds
        g.px(cx0 - 3, sy + 5, up.d); g.px(cx1 + 2, sy + 6, up.d); g.px(cx1 + 3, sy + 7, up.d2);
      }
      break;
    case "robe":
      if (!back) {
        for (let y = sy; y <= hem; y++) { g.over(cx0, y, y === hem ? tr.d : tr.l); g.over(cx1, y, y === hem ? tr.d2 : tr.b); }
        g.px(cx0 - 1, sy, tr.l); g.px(cx1 + 1, sy, tr.d); g.px(cx0 - 2, sy, tr.b); g.px(cx1 + 2, sy, tr.d);
        for (let y = sy + 6; y < hem; y += 5) { g.px(cx0, y, tr.l2); g.px(cx1, y + 2, tr.l); }
      } else for (let y = sy + 2; y < hem; y++) g.over(cx1, y, main.d);
      break;
    case "gown":
      if (!back) {
        g.span(cx0 - 2, cx1 + 2, sy, L.skin); g.span(cx0 - 1, cx1 + 1, sy + 1, sh(L.skin, -0.2));
        g.span(cx0 - 3, cx1 + 3, sy + 1, tr.b); g.px(cx0 - 3, sy, tr.l); g.px(cx1 + 3, sy, tr.d); g.span(cx0 - 1, cx1 + 1, sy + 2, tr.d);
        for (let y = sy + 3; y < wy; y++) { g.px(y % 2 ? cx0 : cx1, y, tr.l); g.px(y % 2 ? cx1 : cx0, y, up.d); }
        if (L.apron) {
          const a = tone(L.apron);
          for (let y = wy + 1; y <= hem - 3; y++) for (let x = 12; x <= 19; x++) g.px(x, y, x === 12 ? a.l : x >= 18 ? a.d : (x === 15 && y > wy + 3) ? a.d : a.b);
          g.span(12, 19, wy + 1, a.d);
        }
      } else if (L.apron) { g.span(13, 18, wy, tone(L.apron).b); g.px(15, wy + 1, tone(L.apron).d); g.px(16, wy + 2, tone(L.apron).d); }
      break;
    case "tabard": {
      const tb = tone(L.main);
      const tx0 = Math.round(16 - D.sw + 2), tx1 = Math.round(15 + D.sw - 2);
      for (let y = sy; y <= hem; y++) for (let x = tx0; x <= tx1; x++) {
        const u = (x - tx0) / (tx1 - tx0);
        let c = u < 0.15 ? tb.l : u > 0.8 ? tb.d : tb.b;
        if (y === hem || y === hem - 1) c = y === hem ? tr.d : tr.b;
        if (y > wy + 2 && (x === tx0 + 2) && y < hem - 1) c = tb.d;
        g.px(x, y, c);
      }
      if (L.device) {
        const [fc, cc] = L.device;
        const f = tone(fc), ch = tone(cc);
        const dy = sy + 3;
        for (let r = 0; r < 6; r++) {
          const a = r < 4 ? 13 : r === 4 ? 14 : 15, bb = r < 4 ? 18 : r === 4 ? 17 : 16;
          for (let x = a; x <= bb; x++) g.px(x, dy + r, x === a ? f.l : x === bb ? f.d : f.b);
        }
        g.px(15, dy + 1, ch.l2); g.px(16, dy + 1, ch.l); g.px(15, dy + 2, ch.b); g.px(16, dy + 2, ch.d);
        g.px(14, dy + 2, ch.b); g.px(17, dy + 2, ch.d); g.px(15, dy + 3, ch.d); g.px(16, dy + 3, ch.d); g.px(15, dy + 4, ch.d2);
      }
      break;
    }
    case "armor":
      if (!back) {
        for (let y = sy + 1; y <= wy - 1; y++) { g.over(cx0, y, m.l2); g.over(cx1, y, m.l); }
        for (let x = 11; x <= 20; x++) if (Math.abs(x - 15.5) > 1) g.over(x, sy + 7 + (Math.abs(x - 15.5) > 3 ? -1 : 0), m.d);
        g.span(14, 17, sy - 1, m.b); g.px(14, sy - 1, m.l); g.px(17, sy - 1, m.d);
        for (const [y, x0, x1] of rowsFront(b)) if (y <= wy - 1) { g.over(x0, y, tr.l); g.over(x1, y, tr.d); }
        g.span(13, 18, sy, tr.b);
      } else for (let y = sy + 1; y <= wy - 1; y++) { g.over(cx0, y, m.l); g.over(cx1, y, m.d); }
      // faulds
      for (let y = wy + 2; y <= wy + 5; y++) for (let x = Math.round(16 - D.ww - 1); x <= Math.round(15 + D.ww + 1); x++) {
        const u = (x - 16 + D.ww + 1) / (2 * D.ww + 1);
        g.px(x, y, (y - wy) % 2 === 0 ? (u < 0.2 ? m.l2 : u > 0.75 ? m.d : m.l) : (u > 0.75 ? m.d2 : m.d));
      }
      break;
    case "leather":
      if (!back) {
        for (let y = sy + 1; y <= wy - 1; y++) { g.px(cx0, y, main.d2); if (y % 2) { g.px(cx0 - 1, y, main.l); g.px(cx1, y, main.d); } }
        for (const [sx, sy2] of [[12, 3], [19, 3], [13, 7], [18, 7], [12, 10], [19, 10]] as V[]) if (sy + sy2 < wy) { g.over(sx, sy + sy2, bk.l); g.over(sx + 1, sy + sy2 + 1, bk.d); }
        // baldric
        for (let i = 0; i <= wy - sy; i++) { const x = Math.round(11 + (i * 9) / (wy - sy)), y = sy + i; g.over(x, y, bt.b); g.over(x + 1, y, bt.d); }
        g.px(14, sy + 4, bk.l2); g.px(15, sy + 4, bk.b);
      } else for (let i = 0; i <= wy - sy; i++) { const x = Math.round(20 - (i * 9) / (wy - sy)), y = sy + i; g.over(x, y, bt.b); g.over(x - 1, y, bt.d); }
      break;
    case "rags": {
      const patch = tone(mx(L.main, L.trim, 0.6));
      for (const [px0, py0, w, h] of [[12, sy + 4, 2, 2], [18, sy + 8, 2, 3], [13, wy + 3, 3, 2]] as [number, number, number, number][]) for (let y = py0; y < py0 + h; y++) for (let x = px0; x < px0 + w; x++) g.over(x, y, (x + y) % 3 ? patch.b : patch.d);
      g.over(17, sy + 2, main.d2); g.over(18, sy + 3, main.d2); g.over(12, wy - 3, main.d2);
      if (!back) { g.px(cx0, sy, sh(L.skin, -0.2)); g.px(cx1, sy, sh(L.skin, -0.3)); g.px(cx0, sy + 1, sh(L.skin, -0.3)); }
      break;
    }
    case "noble":
      if (!back) {
        for (let y = sy + 1; y <= hem; y++) for (let x = 14; x <= 17; x++) {
          const s = tone(y <= wy + 1 ? L.shirt : L.pants);
          if (y > wy + 1 && y > hem - 1) continue;
          g.over(x, y, x === 14 ? s.l : x === 17 ? s.d : s.b);
        }
        for (let y = sy + 2; y < wy; y += 2) g.over(15, y, bk.l);
        for (let y = sy; y <= hem; y++) { g.over(13, y, tr.l); g.over(18, y, tr.d); }
        if (L.chain) { const gc = tone(GOLD); for (const [x, y] of [[12, 2], [13, 3], [14, 4], [15, 5], [16, 5], [17, 4], [18, 3], [19, 2]] as V[]) g.px(x, sy + y, (x % 2) ? gc.l : gc.b); g.px(15, sy + 6, gc.l2); g.px(16, sy + 6, gc.d); g.px(15, sy + 7, gc.d); }
      } else for (let y = sy + 3; y <= hem; y++) g.over(15, y, main.d);
      break;
  }
  // belt
  if (o !== "robe" && o !== "noble") {
    const rope = o === "rags" || o === "peasant";
    const bc = rope ? tone(ROPE) : L.outfit === "gown" ? tone(L.sash ?? L.trim) : bt;
    for (const [y, x0, x1] of rowsFront(b).filter((r) => r[0] >= wy)) for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      g.px(x, y, rope ? ((x + y) % 2 ? bc.l : bc.d) : y === wy ? (u < 0.2 ? bc.l : u > 0.8 ? bc.d : bc.b) : bc.d);
    }
    if (!back) {
      if (rope) { g.px(17, wy + 2, bc.b); g.px(17, wy + 3, bc.d); g.px(18, wy + 2, bc.d); }
      else if (o !== "gown") {
        g.px(cx0, wy, bk.l2); g.px(cx1, wy, bk.b); g.px(cx0, wy + 1, bk.b); g.px(cx1, wy + 1, bk.d);
        g.px(cx1 + 1, wy + 2, bt.d); g.px(cx1 + 1, wy + 3, bt.d2);
      }
      if (L.pouch) {
        const pt = tone(sh(L.belt, 0.08));
        for (let y = wy + 1; y <= wy + 4; y++) for (let x = 18; x <= 20; x++) g.px(x, y, y === wy + 4 ? pt.d2 : x === 18 ? pt.l : x === 20 ? pt.d : pt.b);
        g.span(18, 20, wy + 1, pt.l); g.px(19, wy + 2, bk.l);
      }
    } else if (L.pouch) { for (let y = wy + 1; y <= wy + 3; y++) g.span(11, 12, y, tone(L.belt).d); }
  } else {
    // sash with hanging knot
    const s = tone(L.sash ?? L.trim);
    for (const [y, x0, x1] of rowsFront(b).filter((r) => r[0] >= wy)) for (let x = x0; x <= x1; x++) g.px(x, y, y === wy ? shadeU(s, (x - x0) / (x1 - x0)) : s.d);
    if (!back) { g.px(18, wy + 2, s.b); g.px(18, wy + 3, s.d); g.px(19, wy + 2, s.d); g.px(18, wy + 4, s.d2); }
  }
}

function sideRows(b: Body): [number, number, number][] {
  const { sy, wy, R, L } = b;
  const rows: [number, number, number][] = [];
  const big = L.build === "broad" ? 1 : 0;
  for (let y = sy; y <= wy + 1; y++) {
    const k = (wy - y) / Math.max(1, wy - sy);
    const ln = Math.round(R.lean * k);
    let a = 13, z = 18;
    if (y >= sy + 1 && y <= sy + 5) { a = 12; z = 19; }
    else if (y > sy + 5 && y <= sy + 7) { a = 12; z = 19; }
    else if (y > sy + 7) { a = 13; z = 18 + big; }
    if (L.build === "child") { a += 0; z -= 1; }
    if (L.build === "old" && y < sy + 4) { a -= 1; }
    rows.push([y, a + ln - big, z + ln]);
  }
  return rows;
}

function torsoSide(b: Body) {
  const { g, L, R, sy, wy, hy } = b;
  const o = L.outfit;
  const up = tone(bodyCol(L)), main = tone(L.main), tr = tone(L.trim), bt = tone(L.belt), bk = tone(L.buckle), m = tone(L.metal);
  const hem = hemOf(b);
  const long = isLong(o);
  const mail = o === "tabard";
  const rows = sideRows(b);
  for (const [y, a, z] of rows) for (let x = a; x <= z; x++) {
    const u = (x - a) / (z - a);
    let c = u < 0.15 ? up.l : u > 0.8 ? up.d : up.b;
    if (mail) c = u < 0.15 ? m.l : (x + y) % 2 ? m.d : m.b;
    if (o === "armor" && u > 0.5 && u < 0.75 && y < sy + 6) c = m.l2;
    g.px(x, y, c);
  }
  // skirt
  const fwd = Math.max(R.fR[0], R.fL[0]) > 3 ? 1 : 0, bwd = Math.min(R.fR[0], R.fL[0]) < -3 ? 1 : 0;
  const trail = R.cloak % 2;
  for (let y = wy + 2; y <= hem; y++) {
    const k = (y - wy - 2) / Math.max(1, hem - wy - 2);
    const a = Math.round(13 - k * (long ? 2.5 + trail : 1) - bwd * k);
    const z = Math.round(18 + k * (long ? 2 : 1) + fwd * k * (long ? 2 : 1));
    if (mail && y > hy + 4) break;
    for (let x = a; x <= z; x++) {
      const u = (x - a) / (z - a);
      if (o === "rags" && y >= hem - 1 && (x * 5 + y) % 3 === 0) continue;
      let c = mail ? ((x + y) % 2 ? m.d : m.b) : u < 0.15 ? main.l : u > 0.8 ? main.d : main.b;
      if (y === hem && (o === "tunic" || o === "robe" || o === "gown" || o === "noble")) c = u > 0.7 ? tr.d : tr.b;
      if (!mail && y > wy + 3 && y < hem && (x === a + 2 || x === z - 2)) c = main.d;
      g.px(x, y, c);
    }
  }
  const front = rows.map((r) => r[2]), backX = rows.map((r) => r[1]);
  const fr = (y: number) => front[Math.max(0, Math.min(front.length - 1, y - sy))];
  switch (o) {
    case "tunic": case "peasant":
      g.px(fr(sy) - 1, sy, sh(L.skin, -0.2)); g.px(fr(sy), sy, sh(L.skin, -0.3)); g.px(fr(sy + 1), sy + 1, o === "tunic" ? tr.b : main.d);
      g.px(fr(sy + 4) - 2, sy + 4, up.d);
      break;
    case "robe":
      for (let y = sy; y <= wy; y++) g.px(fr(y), y, tr.d);
      g.px(fr(sy) - 1, sy, tr.l);
      break;
    case "gown":
      g.px(fr(sy), sy, L.skin); g.px(fr(sy) - 1, sy, tr.b); g.px(fr(sy + 1), sy + 1, tr.d);
      if (L.apron) { const a = tone(L.apron); for (let y = wy + 1; y <= hem - 3; y++) { g.px(fr(wy) + 1 + Math.floor((y - wy) / 4), y, a.d); g.px(fr(wy) + Math.floor((y - wy) / 4), y, a.b); } }
      break;
    case "tabard": {
      const tb = tone(L.main);
      for (let y = sy; y <= hem; y++) {
        const f = y <= wy + 1 ? fr(y) : 18 + (y > hy + 2 ? 1 : 0) + Math.round(R.lean * 0);
        const bx = y <= wy + 1 ? backX[y - sy] : 13;
        for (let x = f - 2; x <= f; x++) g.px(x, y, y >= hem - 1 ? (y === hem ? tr.d : tr.b) : x === f ? tb.d : x === f - 2 ? tb.l : tb.b);
        for (let x = bx; x <= bx + 1; x++) g.px(x, y, y >= hem - 1 ? (y === hem ? tr.d : tr.b) : x === bx ? tb.l : tb.b);
      }
      if (L.device) { g.px(fr(sy + 4) - 1, sy + 4, L.device[0]); g.px(fr(sy + 4), sy + 4, sh(L.device[0], -0.3)); g.px(fr(sy + 5) - 1, sy + 5, L.device[1]); g.px(fr(sy + 6) - 1, sy + 6, L.device[0]); }
      break;
    }
    case "armor":
      for (let y = sy + 1; y < wy; y++) g.px(fr(y), y, tr.d);
      for (let y = wy + 2; y <= wy + 5; y++) for (let x = 12; x <= 19; x++) g.px(x, y, (y - wy) % 2 === 0 ? (x < 14 ? m.l2 : x > 17 ? m.d : m.l) : m.d);
      break;
    case "leather":
      for (const [x, y] of [[14, 3], [17, 5], [14, 8], [17, 10]] as V[]) if (sy + y < wy) g.over(x + Math.round(R.lean * 0.5), sy + y, bk.l);
      for (let i = 0; i <= wy - sy; i++) g.over(Math.round(fr(sy + i) - 1 - i * 0.2), sy + i, i % 2 ? bt.b : bt.d);
      break;
    case "rags":
      g.over(15, sy + 4, mx(L.main, L.trim, 0.6)); g.over(16, sy + 4, mx(L.main, L.trim, 0.6)); g.over(16, sy + 5, mx(L.main, L.trim, 0.5)); g.over(14, wy - 2, main.d2);
      break;
    case "noble":
      for (let y = sy + 1; y <= hem; y++) { const f = y <= wy + 1 ? fr(y) : 19; g.over(f, y, tr.l); g.over(f - 1, y, tr.d); }
      if (L.chain) { g.px(fr(sy + 3), sy + 3, GOLD); g.px(fr(sy + 4), sy + 4, tone(GOLD).l); }
      break;
  }
  // belt / sash
  const rope = o === "rags" || o === "peasant";
  const bc = o === "robe" || o === "noble" || o === "gown" ? tone(L.sash ?? L.trim) : rope ? tone(ROPE) : bt;
  for (const [y, a, z] of rows.filter((r) => r[0] >= wy)) for (let x = a; x <= z; x++) g.px(x, y, rope ? ((x + y) % 2 ? bc.l : bc.d) : y === wy ? (x === a ? bc.l : bc.b) : bc.d);
  if (o !== "robe" && o !== "noble" && !rope && o !== "gown") { g.px(fr(wy) - 1, wy, bk.l2); g.px(fr(wy), wy, bk.b); g.px(fr(wy) - 1, wy + 1, bk.d); }
  if (o === "robe" || o === "noble") { g.px(fr(wy) + 1, wy + 1, bc.b); g.px(fr(wy) + 1, wy + 2, bc.d); }
  if (L.pouch) { const pt = tone(sh(L.belt, 0.08)); for (let y = wy + 1; y <= wy + 4; y++) for (let x = 13; x <= 15; x++) g.px(x, y, y === wy + 4 ? pt.d2 : x === 13 ? pt.l : x === 15 ? pt.d : pt.b); g.span(13, 15, wy + 1, pt.l); g.px(14, wy + 2, bk.l); }
}

// ---------- arms
interface ArmLook { upper: Tone; fore: Tone; cuff?: string; bell: boolean; skin: Tone }
function armLook(L: Look, far: boolean): ArmLook {
  const dk = (c: string) => tone(far ? sh(c, -0.22) : c);
  const skin = far ? skinTone(sh(L.skin, -0.18)) : skinTone(L.skin);
  const glove = L.gloves ? dk(L.gloves) : skin;
  switch (L.outfit) {
    case "tabard": return { upper: dk(L.metal), fore: L.gloves ? glove : dk(L.shirt), cuff: L.gloves ? sh(L.gloves, 0.2) : undefined, bell: false, skin: glove };
    case "armor": return { upper: dk(L.metal), fore: dk(L.metal), cuff: L.trim, bell: false, skin: glove };
    case "leather": return { upper: dk(L.shirt), fore: dk(L.belt), cuff: L.shirt, bell: false, skin: glove };
    case "rags": return { upper: dk(L.main), fore: skin, cuff: sh(L.main, -0.3), bell: false, skin: glove };
    case "peasant": return { upper: dk(L.main), fore: dk(L.shirt), bell: false, skin: glove };
    case "robe": return { upper: dk(L.main), fore: dk(L.main), cuff: L.trim, bell: true, skin: glove };
    case "gown": return { upper: dk(L.main), fore: dk(L.main), cuff: L.trim, bell: L.build !== "child", skin: glove };
    case "noble": return { upper: dk(L.main), fore: dk(L.main), cuff: L.trim, bell: false, skin: glove };
    default: return { upper: dk(L.main), fore: dk(L.main), cuff: L.trim, bell: false, skin: glove };
  }
}
/** Draws an arm from the shoulder towards the hand target; returns the hand position. */
function arm(g: Grid, L: Look, D: Dims, S: V, target: V, hint: V, far: boolean, fist = false): V {
  const A = armLook(L, far);
  const { mid, end } = ik(S, target, D.arm[0], D.arm[1], hint);
  const r = D.ar;
  const cc = sh(A.upper.d2, -0.25);
  g.contour(S[0], S[1] + 1.2, mid[0], mid[1], r + 0.9, cc);
  g.contour(mid[0], mid[1], end[0], end[1], r + 0.8, cc);
  g.limb(S[0], S[1], mid[0], mid[1], r, [A.upper.d, A.upper.b, A.upper.l]);
  const dx = end[0] - mid[0], dy = end[1] - mid[1], dl = Math.hypot(dx, dy) || 1;
  const wrist: V = [end[0] - (dx / dl) * 0.8, end[1] - (dy / dl) * 0.8];
  g.limb(mid[0], mid[1], wrist[0], wrist[1], r - 0.2, [A.fore.d, A.fore.b, A.fore.l]);
  if (A.bell) g.limb(wrist[0] - (dx / dl) * 1.6, wrist[1] - (dy / dl) * 1.6, wrist[0], wrist[1], r + 0.45, [A.fore.d, A.fore.b, A.fore.l]);
  if (A.cuff) { const ct = tone(far ? sh(A.cuff, -0.2) : A.cuff); g.limb(wrist[0] - (dx / dl) * 0.4, wrist[1] - (dy / dl) * 0.4, wrist[0], wrist[1], r - (A.bell ? -0.4 : 0.1), [ct.d, ct.b, ct.l]); }
  // the hand
  const hr = fist ? 1.25 : 1.1;
  g.limb(end[0] - (dx / dl) * 0.3, end[1] - (dy / dl) * 0.3, end[0] + (dx / dl) * 0.4, end[1] + (dy / dl) * 0.4, hr, [A.skin.d, A.skin.b, A.skin.l], 0.1);
  return end;
}

// ---------- cloaks
function cloakBehindFront(b: Body) {
  const { g, L, D, R, sy } = b;
  if (!L.cloak) return;
  const c = tone(L.cloak), li = tone(L.lining ?? sh(L.cloak, -0.25));
  const s = [0, 1, -1][R.cloak % 3];
  const top = sy + 1, hem = D.fy - (L.build === "child" ? 2 : 3);
  for (let y = top; y <= hem; y++) {
    const k = (y - top) / (hem - top);
    const x0 = Math.round(16 - D.sw - 0.5 - k * 1.5 + s * k), x1 = Math.round(15 + D.sw + 0.5 + k * 1.5 + s * k);
    for (let x = x0; x <= x1; x++) {
      if (y === hem && (x + s) % 3 === 0) continue;
      let col = x === x0 ? c.b : x === x1 ? c.d : x === x0 + 1 ? li.b : li.d;
      if (y > top + 8 && (x === x0 + 4 || x === x1 - 4)) col = li.d2;
      if (y === hem) col = x === x0 ? c.d : li.d2;
      g.px(x, y, col);
    }
  }
}
function cloakCollarFront(b: Body) {
  const { g, L, D, sy } = b;
  if (!L.cloak || L.hood === "up") return;
  const c = tone(L.cloak), bk = tone(L.buckle);
  const x0 = Math.round(16 - D.sw), x1 = Math.round(15 + D.sw);
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    g.px(x, sy - 1, u < 0.2 ? c.l : u > 0.75 ? c.d : c.b);
    if (L.hood === "down") { g.px(x, sy - 2, u < 0.25 ? c.l : u > 0.7 ? c.d : (x % 3 === 0 ? c.d : c.b)); g.px(x, sy, x % 3 === 1 ? c.d : u > 0.75 ? c.d : c.b); }
  }
  if (L.hood === "down") { g.span(x0 + 1, x1 - 1, sy - 3, c.l); for (let x = 13; x <= 18; x++) g.px(x, sy + 1, x === 13 || x === 18 ? c.d : c.b); }
  g.px(15, sy + 1, bk.l2); g.px(16, sy + 1, bk.b); g.px(15, sy + 2, bk.d); g.px(16, sy + 2, bk.d2);
}
function mantleFront(b: Body, SR: V, SL: V) {
  const { g, L, D, sy } = b;
  if (!L.cloak) return;
  const c = tone(L.cloak);
  for (const [S, right] of [[SR, false], [SL, true]] as [V, boolean][]) {
    const cx = S[0] + (right ? -0.5 : 0.5);
    for (let y = sy - 1; y <= sy + 3; y++) {
      const w = y === sy - 1 ? 1 : y === sy + 3 ? 1.5 : 2.2;
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
        const u = (x - cx + w) / (2 * w);
        g.px(x, y, y === sy + 3 ? c.d2 : u < 0.3 ? c.l : u > 0.7 ? c.d : c.b);
      }
    }
  }
  void D;
}
function cloakBackOver(b: Body) {
  const { g, L, D, R, sy } = b;
  if (!L.cloak) return;
  const c = tone(L.cloak);
  const s = [0, -1, 1][R.cloak % 3];
  const hem = D.fy - (L.build === "child" ? 2 : 3);
  for (let y = sy - 1; y <= hem; y++) {
    const k = (y - sy) / (hem - sy);
    const w = y === sy - 1 ? D.sw - 1 : y === sy ? D.sw + 0.5 : D.sw + 1.5 + k * 2.5;
    const x0 = Math.round(16 - w + s * Math.max(0, k)), x1 = Math.round(15 + w + s * Math.max(0, k));
    for (let x = x0; x <= x1; x++) {
      if (y === hem && (x - s) % 3 === 0) continue;
      const u = (x - x0) / (x1 - x0);
      let col = u < 0.14 ? c.l : u > 0.82 ? c.d : c.b;
      const fold = [x0 + 3, Math.round(15.5 + s * k), x1 - 3];
      if (y > sy + 5 && fold.includes(x)) col = c.d;
      if (y > sy + 8 && fold.map((f) => f - 1).includes(x)) col = c.l;
      if (y === hem) col = c.d2;
      g.px(x, y, col);
    }
  }
  if (L.hood === "down") {
    const li = tone(L.lining ?? sh(L.cloak, -0.25));
    for (let y = sy - 3; y <= sy + 5; y++) {
      const r = y - (sy - 3);
      const w = r < 2 ? 4.5 : r < 6 ? 4 - (r - 2) * 0.4 : 2.4 - (r - 6) * 0.9;
      for (let x = Math.round(15.5 - w); x <= Math.round(15.5 + w); x++) {
        const u = (x - 15.5 + w) / (2 * w);
        g.px(x, y, r === 0 ? (u > 0.15 && u < 0.85 ? li.d2 : c.b) : u < 0.25 ? c.l : u > 0.7 ? c.d : r === 1 && u > 0.2 && u < 0.8 ? li.d : c.b);
      }
    }
  }
}
function cloakSideBehind(b: Body) {
  const { g, L, D, R, sy } = b;
  if (!L.cloak) return;
  const c = tone(L.cloak);
  const trail = R.cloak;
  const hem = b.cloakHem ?? D.fy - (L.build === "child" ? 2 : 3);
  const ln = Math.round(R.lean * 0.5);
  for (let y = sy - 1; y <= hem; y++) {
    const k = (y - sy) / (hem - sy);
    const a = Math.round(12 + ln - Math.max(0, k) * (3.5 + trail * 1.2) - (y > sy + 2 ? 1 : 0)), z = Math.round(16 + ln - Math.max(0, k) * 1.5);
    for (let x = a; x <= z; x++) {
      if (y === hem && (x + trail) % 3 === 0) continue;
      let col = x === a ? c.l : x >= z - 1 ? c.d : c.b;
      if (y > sy + 6 && (x - a === 2 + Math.round(k * 2) || x - a === 5)) col = c.d;
      if (y === hem) col = c.d2;
      g.px(x, y, col);
    }
  }
}
function mantleSide(b: Body, S: V) {
  const { g, L, sy } = b;
  if (!L.cloak) return;
  const c = tone(L.cloak), bk = tone(L.buckle);
  for (let y = sy - 1; y <= sy + 3; y++) {
    const a = Math.round(S[0] - 4), z = Math.round(S[0] + (y < sy + 1 ? 3 : 2));
    for (let x = a; x <= z; x++) g.px(x, y, y === sy + 3 ? c.d2 : x <= a + 1 ? c.l : x >= z - 1 ? c.d : c.b);
  }
  if (L.hood === "down") for (let y = sy - 4; y <= sy; y++) for (let x = Math.round(S[0] - 6); x <= Math.round(S[0] - 2); x++) g.px(x, y, x === Math.round(S[0] - 6) ? c.l : y === sy - 4 ? c.l : x === Math.round(S[0] - 2) ? c.d : c.b);
  if (L.hood !== "up") { g.px(Math.round(S[0] + 3), sy - 1, bk.l2); g.px(Math.round(S[0] + 3), sy, bk.d); }
}

// ------------------------------------------------------------------ weapons
const STEEL = "#c3c9d4", WOOD = "#8a5a34", GRIP = "#4e3222";
const BLADE: Partial<Record<WeaponKind, [number, number, number]>> = {
  // [blade length, half width, guard half width]
  sword: [13, 0.85, 2.2], broadsword: [15, 1.25, 2.8], shortsword: [9, 0.8, 1.8], dagger: [5.5, 0.6, 1.4],
};

/**
 * Draws a weapon held at `hand`, pointing along `ang`. `edge` flips which side an axe or
 * hammer head is on. For bows, `hand2` is the drawing hand and `draw` the string tension.
 */
function drawWeapon(g: Grid, L: Look, kind: WeaponKind, hand: V, ang: number, opt: { draw?: number; hand2?: V; flipEdge?: boolean } = {}) {
  if (kind === "none") return;
  const u = dirOf(ang);
  let n: V = [-u[1], u[0]];
  if (opt.flipEdge) n = [-n[0], -n[1]];
  const P = (t: number, s = 0): V => [hand[0] + u[0] * t + n[0] * s, hand[1] + u[1] * t + n[1] * s];
  const seg = (t0: number, t1: number, r: number, c: string, bias = 0.3) => { const a = P(t0), b = P(t1), t = tone(c); g.limb(a[0], a[1], b[0], b[1], r, [t.d, t.b, t.l], bias); };
  const steel = L.blade ?? STEEL;
  const st = tone(steel);
  const bl = BLADE[kind];
  if (bl) {
    const [len, hw, gw] = bl;
    seg(-3.3, -3, 0.9, L.buckle);
    seg(-2.6, -0.8, 0.55, GRIP);
    const g0 = P(0, -gw), g1 = P(0, gw), gt = tone(L.buckle);
    g.limb(g0[0], g0[1], g1[0], g1[1], 0.55, [gt.d, gt.b, gt.l]);
    seg(1, len - 2, hw, steel, 0.0);
    seg(len - 2, len, hw * 0.45, steel, 0.0);
    // edge glint and fuller
    for (let t = 2; t < len - 2; t += 1) { const p = P(t, 0); if (hw >= 1.2) g.px(p[0], p[1], st.d); }
    const tip = P(len - 1.5);
    g.px(tip[0], tip[1], st.l2);
    const gl = P(3, hw >= 1 ? -0.6 : 0);
    g.px(gl[0], gl[1], st.l2);
    if (L.blade) { const m = P(len * 0.6); g.halo(m[0], m[1], 5, L.blade, 0.22); }
    return;
  }
  switch (kind) {
    case "axe": {
      seg(-3, 12, 0.6, WOOD);
      const head: V[] = [P(8.3, 0.4), P(7, 4.3), P(9.5, 5), P(12.6, 4.4), P(11.6, 0.4)];
      g.poly(head, st.b);
      g.line(...P(7.2, 4.2), ...P(12.4, 4.3), st.l2);
      g.line(...P(8.6, 1.2), ...P(11.3, 1.2), st.d);
      g.line(...P(9.2, -0.6), ...P(10.8, -0.6), st.d);
      g.px(...P(10, -1.4), st.d2);
      seg(11.8, 12.6, 0.7, L.buckle);
      return;
    }
    case "mace": {
      seg(-2.5, 8.5, 0.6, WOOD);
      seg(-2.8, -2.2, 0.8, L.buckle);
      const c = P(10.3);
      g.ellipse(c[0], c[1], 1.9, 1.9, st.b);
      g.px(c[0] - 1, c[1] - 1, st.l2); g.px(c[0], c[1] - 1, st.l); g.px(c[0] + 1, c[1] + 1, st.d);
      for (const s of [-1, 1]) { g.px(...P(10.3, s * 3), st.d); g.px(...P(10.3 + s * 3, 0), st.d); }
      g.px(...P(13.4), st.l);
      return;
    }
    case "warhammer": {
      seg(-6, 14, 0.6, WOOD);
      seg(-6.4, -5.8, 0.8, L.buckle);
      g.poly([P(11.6, -2.2), P(11.6, 3.4), P(14.4, 3.4), P(14.4, -2.2)], st.b);
      g.line(...P(11.8, 3.3), ...P(14.2, 3.3), st.l2);
      g.line(...P(14.3, -2), ...P(14.3, 3.2), st.d);
      g.line(...P(12.6, -2.4), ...P(13.4, -4.6), st.d);
      g.px(...P(12.4, 0), st.l);
      seg(14.6, 15.6, 0.45, steel);
      return;
    }
    case "spear": {
      seg(-12, 16, 0.5, WOOD);
      seg(15, 16.2, 0.75, L.buckle);
      g.poly([P(16, -1), P(18.5, -1.3), P(21.5, 0), P(18.5, 1.3), P(16, 1)], st.b);
      g.line(...P(16.5, -0.3), ...P(20.8, 0), st.l2);
      g.px(...P(18, 1), st.d);
      if (L.trim) { g.px(...P(14.5, 1.2), L.trim); g.px(...P(13.5, 1.6), sh(L.trim, -0.2)); }
      return;
    }
    case "quarterstaff":
      seg(-13, 13, 0.65, WOOD);
      seg(-13.4, -11.8, 0.75, "#8a8e96"); seg(11.8, 13.4, 0.75, "#8a8e96");
      seg(-1.5, 1.5, 0.75, GRIP);
      return;
    case "staff": {
      seg(-7, 14, 0.65, sh(WOOD, -0.15));
      const w = tone(sh(WOOD, -0.15));
      g.px(...P(4, 0.9), w.d); g.px(...P(9, -0.9), w.l);
      // curling head holding a crystal
      g.px(...P(14.5, 1.5), w.b); g.px(...P(15.5, 2), w.d); g.px(...P(16.6, 1.6), w.d); g.px(...P(14.5, -1.4), w.b); g.px(...P(15.5, -1.9), w.l);
      const cr = P(16.4), m = tone(L.magic);
      g.px(cr[0], cr[1] - 1, m.l2); g.px(cr[0], cr[1], m.l); g.px(cr[0] + 1, cr[1], m.b); g.px(cr[0], cr[1] + 1, m.d); g.px(cr[0] - 1, cr[1], m.b);
      g.halo(cr[0], cr[1], 3, L.magic, 0.3);
      return;
    }
    case "bow": {
      const draw = opt.draw ?? 0;
      const bend = 1.4 + Math.max(0, draw) * 1.8;
      const wt = tone(sh(WOOD, 0.05));
      const pts: V[] = [];
      for (let k = -7; k <= 7; k++) pts.push(P(-bend * (k * k) / 49 + (Math.abs(k) > 5 ? 0.4 : 0), k));
      for (let i = 0; i + 1 < pts.length; i++) g.line(...pts[i], ...pts[i + 1], Math.abs(i - 7) < 2 ? GRIP : i < 7 ? wt.l : wt.b);
      // outer side of the limbs is darker
      for (let i = 2; i < pts.length - 2; i++) if (Math.abs(i - 7) >= 2) g.px(pts[i][0] + u[0], pts[i][1] + u[1], wt.d);
      const tipA = pts[0], tipB = pts[pts.length - 1];
      const nock: V = draw > 0 && opt.hand2 ? opt.hand2 : [(tipA[0] + tipB[0]) / 2, (tipA[1] + tipB[1]) / 2];
      const str = "#e9e2cf";
      g.line(...tipA, ...nock, str); g.line(...nock, ...tipB, str);
      if (draw >= 0 && opt.hand2) {
        // nocked arrow
        const a0 = nock, a1 = P(3.5);
        g.line(a0[0], a0[1], a1[0], a1[1], "#d8b880");
        g.px(a1[0] + u[0], a1[1] + u[1], st.l2); g.px(a1[0] + u[0] * 2, a1[1] + u[1] * 2, st.b);
        g.px(a0[0] - u[0] + n[0], a0[1] - u[1] + n[1], "#d84a3a"); g.px(a0[0] - u[0] - n[0], a0[1] - u[1] - n[1], "#f0ece0");
      }
      return;
    }
    default: return;
  }
}

function drawShield(g: Grid, L: Look, at: V, view: View | "back") {
  const col = tone(L.offCol ?? L.main), rim = tone(L.metal), bk = tone(L.buckle);
  const [cx, cy] = at;
  if (view === "side") {
    for (let y = -5; y <= 4; y++) { const w = y < -3 || y > 2 ? 0 : 1; for (let x = -w; x <= w + 1; x++) g.px(cx + x, cy + y, x === -w ? rim.l : x === w + 1 ? rim.d : col.d); }
    g.px(cx + 2, cy - 1, bk.l); g.px(cx + 2, cy, bk.d);
    return;
  }
  // heater shield
  for (let y = -5; y <= 5; y++) {
    const w = y < 1 ? 3.5 : 3.5 - (y - 0.5) * 0.75;
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      const u = (x - cx + w) / (2 * w);
      const edge = x === Math.round(cx - w) || x === Math.round(cx + w) || y === -5;
      let c = edge ? (u < 0.5 ? rim.l : rim.d) : u < 0.25 ? col.l : u > 0.7 ? col.d : col.b;
      if (view === "back") c = edge ? rim.d : u > 0.6 ? tone(WOOD).d : tone(WOOD).b;
      g.px(x, cy + y, c);
    }
  }
  if (view === "back") { g.span(cx - 2, cx + 2, cy - 1, tone(L.belt).d); g.span(cx - 2, cx + 2, cy + 2, tone(L.belt).d); return; }
  if (L.device) {
    const ch = tone(L.device[1]);
    g.px(cx, cy - 2, ch.l2); g.px(cx - 1, cy - 1, ch.b); g.px(cx, cy - 1, ch.l); g.px(cx + 1, cy - 1, ch.b); g.px(cx, cy, ch.d); g.px(cx, cy + 1, ch.d2);
  } else { g.px(cx, cy - 1, bk.l2); g.px(cx, cy, bk.b); g.px(cx + 1, cy, bk.d); }
  g.px(cx - 2, cy - 4, col.l2);
}

function drawBook(g: Grid, L: Look, at: V, view: View) {
  const c = tone(L.offCol ?? "#7a3a2a"), bk = tone(L.buckle);
  const [x, y] = [Math.round(at[0]), Math.round(at[1])];
  const w = view === "side" ? 2 : 3;
  for (let yy = -2; yy <= 2; yy++) for (let xx = 0; xx <= w; xx++) g.px(x - 1 + xx, y + yy, xx === 0 ? c.l : xx === w ? c.d : yy === -2 ? c.l : c.b);
  g.span(x - 1, x - 1 + w, y + 3, "#e8e0c8");
  g.px(x, y, bk.l);
}

// ------------------------------------------------------------------ effects
const REACH: Record<WeaponKind, number> = { none: 2, sword: 13, broadsword: 15, shortsword: 9, dagger: 5.5, axe: 12.5, mace: 12, warhammer: 15, spear: 21, quarterstaff: 13, staff: 16, bow: 6 };

function smear(g: Grid, c: V, r0: number, r1: number, a0: number, a1: number) {
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 2.5));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, a = rad(a0 + (a1 - a0) * k);
    for (let r = r0; r <= r1 + 0.01; r += 0.5) {
      const q = (r - r0) / Math.max(0.01, r1 - r0);
      g.glow(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, k > 0.7 && q > 0.6 ? "#ffffff" : "#dfe8ff", (0.06 + 0.55 * k * k) * (0.35 + 0.65 * q));
    }
  }
}
function sparkle(g: Grid, x: number, y: number, col: string, big: boolean) {
  g.glow(x, y, "#ffffff", 0.95);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.glow(x + dx, y + dy, col, 0.7);
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) g.glow(x + dx, y + dy, col, 0.35);
}
function castFx(g: Grid, at: V, level: number, col: string, dir: V | null) {
  g.halo(at[0], at[1], 2.5 + level * 1.6, col, 0.5 + level * 0.12);
  g.halo(at[0], at[1], 1.3, "#ffffff", 0.95);
  const n = 2 + level * 2;
  for (let i = 0; i < n; i++) {
    const a = rad(i * 137.5 + level * 47), r = 3 + ((i * 7) % 4) + level;
    g.glow(at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, i % 2 ? "#ffffff" : col, 0.85 - i * 0.05);
  }
  if (level >= 2 && dir) {
    for (let t = 2; t < 26; t++) {
      const x = at[0] + dir[0] * t, y = at[1] + dir[1] * t;
      g.glow(x, y, col, 0.5 * (1 - t / 26));
      g.glow(x - dir[1], y + dir[0], col, 0.22 * (1 - t / 26));
      g.glow(x + dir[1], y - dir[0], col, 0.22 * (1 - t / 26));
    }
    sparkle(g, at[0] + dir[0] * 5, at[1] + dir[1] * 5, col, true);
  }
}

// ------------------------------------------------------------------ composing a frame
function paint(L: Look, facing: Facing, pose: Pose, frame: number): Grid {
  if (pose === "dead") return paintDead(L);
  const view: View = facing === "up" ? "back" : facing === "down" ? "front" : "side";
  const D = dims(L);
  const R = view === "side" ? rigSide(pose, frame, L.weapon) : rigFront(pose, frame, L.weapon);
  const g = new Grid(32, 48);
  const T = D.T + R.bob + R.breath + R.hdy;
  const sy = D.sy + R.bob + R.breath, wy = D.wy + R.bob, hy = D.hy + R.bob;
  const b: Body = { g, L, D, R, view, T, sy, wy, hy };
  const flipEdge = view === "back" || (view === "side" && pose !== "attack");
  const fist = L.weapon !== "none" || pose === "attack";
  let castAt: V | null = null, castDir: V | null = null;
  let tipFx: (() => void) | null = null;

  if (view === "side") {
    const ln = Math.round(R.lean);
    const S: V = [15 + ln, sy + 2], Sf: V = [16 + ln, sy + 2];
    const head: Head = { x0: 10 + R.hdx + ln + D.stoop, T: T + D.stoop, face: R.face, view };
    cloakSideBehind(b);
    hairSide(g, L, head, true);
    const handR0 = add(S, R.hR), handL0 = add(Sf, R.hL);
    const weapon = () => {
      if (L.weapon === "bow") return;
      drawWeapon(g, L, L.weapon, hR, R.wA, { flipEdge });
    };
    let hR: V = handR0;
    const hL = arm(g, L, D, Sf, handL0, [-0.4, 1], true, L.weapon !== "none" && L.weapon !== "bow");
    if (R.wBack) { hR = ik(S, handR0, D.arm[0], D.arm[1], [-0.4, 1]).end; weapon(); }
    legsSide(b, true);
    legsSide(b, false);
    torsoSide(b);
    if (L.off === "shield") drawShield(g, L, [Math.max(hL[0] + 1, 21 + ln), hL[1] - 2], "side");
    if (L.off === "book" && !R.castR) drawBook(g, L, hL, "side");
    mantleSide(b, S);
    const sk = skinTone(L.skin);
    for (let y = T + 14; y <= sy; y++) { g.px(14 + ln, y, sk.d); g.px(15 + ln, y, sk.b); g.px(16 + ln, y, sk.d); }
    drawHead(g, L, head);
    hR = arm(g, L, D, S, handR0, [-0.4, 1], false, fist);
    if (!R.wBack) weapon();
    if (L.weapon === "bow") {
      const aim = R.draw !== undefined && (pose === "attack") ? R.wA : 0;
      drawWeapon(g, L, "bow", hL, pose === "attack" ? aim : 0, { draw: R.draw ?? 0, hand2: pose === "attack" ? hR : undefined });
      if (R.fx === "release") {
        const ay = hL[1];
        for (let x = Math.round(hL[0]) + 4; x <= Math.round(hL[0]) + 10; x++) g.px(x, ay, "#d8b880");
        g.px(Math.round(hL[0]) + 11, ay, STEEL); g.px(Math.round(hL[0]) + 12, ay, "#eef2f8");
        tipFx = () => { for (let x = Math.round(hL[0]) - 2; x < Math.round(hL[0]) + 4; x++) { g.glow(x, ay - 1, "#ffffff", 0.25); g.glow(x, ay + 1, "#ffffff", 0.18); } };
      }
    }
    if (R.fx === "arc" || R.fx === "over") { const a = R.fxArc!; tipFx = () => smear(g, hR, REACH[L.weapon] * 0.45, REACH[L.weapon] + 0.5, a[0], a[1]); }
    if (R.fx === "thrust") {
      const u = dirOf(R.wA), len = REACH[L.weapon];
      tipFx = () => {
        for (const o of [-2, 0, 2]) for (let t = len - 9; t < len - 2; t++) g.glow(hR[0] + u[0] * t - u[1] * o, hR[1] + u[1] * t + u[0] * o - (o === 0 ? 2 : 0), "#e8f0ff", 0.12 + 0.3 * ((t - len + 9) / 7));
        sparkle(g, hR[0] + u[0] * (len + 1), hR[1] + u[1] * (len + 1), "#fff4c8", false);
      };
    }
    if (R.fx === "cast") {
      castAt = R.castR ? (L.weapon === "staff" ? add(hR, [Math.cos(rad(R.wA)) * 16.4, Math.sin(rad(R.wA)) * 16.4]) : add(hR, [1, 0])) : add(hL, [1, 0]);
      castDir = [1, 0];
    }
  } else {
    const back = view === "back";
    const mir = (v: V): V => (back ? [-v[0], v[1]] : v);
    const wA = back ? 180 - R.wA : R.wA;
    const SR: V = back ? [15 + D.sw + 0.5, sy + 2] : [16 - D.sw - 0.5, sy + 2];
    const SL: V = back ? [16 - D.sw - 0.5, sy + 2] : [15 + D.sw + 0.5, sy + 2];
    const hintR: V = back ? [1, 0.3] : [-1, 0.3], hintL: V = back ? [-1, 0.3] : [1, 0.3];
    const tR = add(SR, mir(R.hR)), tL = add(SL, mir(R.hL));
    const head: Head = { x0: 10 + R.hdx, T: T + D.stoop, face: R.face, view };
    const handR = ik(SR, tR, D.arm[0], D.arm[1], hintR).end, handL = ik(SL, tL, D.arm[0], D.arm[1], hintL).end;
    const raised = handR[1] < sy + 3;
    const weapon = () => {
      if (L.weapon === "bow") drawWeapon(g, L, "bow", handL, back ? 90 : pose === "attack" ? 90 : 0, { draw: R.draw ?? 0, hand2: pose === "attack" ? handR : undefined });
      else drawWeapon(g, L, L.weapon, handR, wA, { flipEdge });
    };
    const offItem = () => {
      if (L.off === "shield") drawShield(g, L, [handL[0] + (back ? -1 : 1), handL[1] - 3], back ? "back" : "front");
      if (L.off === "book" && !(R.castR === false && R.fx === "cast")) drawBook(g, L, handL, view);
    };
    if (!back) {
      cloakBehindFront(b);
      hairBehindFront(g, L, head);
      if (R.wBack) weapon();
    } else {
      if (!raised) weapon();
      if (L.off === "book") offItem();
    }
    legsFront(b);
    torsoFront(b);
    if (!back) cloakCollarFront(b);
    arm(g, L, D, SR, tR, hintR, false, fist);
    arm(g, L, D, SL, tL, hintL, false, L.off === "shield" || L.weapon === "bow");
    if (!back) mantleFront(b, SR, SL);
    if (back) { cloakBackOver(b); }
    const sk = skinTone(L.skin);
    for (let y = T + 13; y <= sy; y++) for (let x = 14; x <= 17; x++) g.px(x + R.hdx, y, x === 17 ? sk.d2 : sk.d);
    if (L.outfit === "noble") furCollar(b);
    if (L.outfit === "armor") pauldrons(b, SR, SL);
    drawHead(g, L, head);
    if (back) hairBack(g, L, head, true);
    if (!back && L.beard === "long") beardFront(g, L, head, true);
    if (!back) { if (!R.wBack) weapon(); offItem(); }
    else { if (raised) weapon(); if (L.off === "shield") offItem(); }
    // seen from behind, a blow that lands in front of the body is hidden by it
    const shown = !back || raised;
    if ((R.fx === "arc" || R.fx === "over") && shown) { const a = R.fxArc!; const aa: [number, number] = back ? [180 - a[0], 180 - a[1]] : a; tipFx = () => smear(g, handR, REACH[L.weapon] * 0.45, REACH[L.weapon] + 0.5, aa[0], aa[1]); }
    if (back) { /* no tip effects */ } else if (R.fx === "thrust") tipFx = () => { const u = dirOf(wA), len = REACH[L.weapon]; sparkle(g, handR[0] + u[0] * (len + 1), handR[1] + u[1] * (len + 1), "#fff4c8", true); };
    if (R.fx === "release") tipFx = () => sparkle(g, handL[0], handL[1] + (back ? -4 : 4), "#ffffff", false);
    if (R.fx === "cast") {
      castAt = R.castR ? (L.weapon === "staff" ? add(handR, [Math.cos(rad(wA)) * 16.4, Math.sin(rad(wA)) * 16.4]) : handR) : handL;
      castDir = back ? null : [0, 1];
    }
  }
  g.outline();
  if (tipFx) (tipFx as () => void)();
  if (castAt) {
    castFx(g, castAt, R.glow ?? 0, L.magic, castDir);
    // the mind glows too
    const fx = view === "side" ? 18 + Math.round(R.lean) : 15.5;
    if ((R.glow ?? 0) > 0) g.halo(fx, T + 6, 2 + (R.glow ?? 0), L.magic, 0.18 * (R.glow ?? 0));
  }
  if (pose === "hurt" && frame === 0) for (let i = 0; i < g.c.length; i++) { const v = g.c[i]; if (v) g.c[i] = mx(v, "#ff5a48", 0.14); }
  return facing === "left" ? g.flip() : g;
}

function furCollar(b: Body) {
  const { g, L, D, sy, view } = b;
  const f = tone(L.trim);
  for (let x = Math.round(16 - D.sw - 1); x <= Math.round(15 + D.sw + 1); x++) {
    const u = (x - 16 + D.sw + 1) / (2 * D.sw + 1);
    for (let y = sy - 1; y <= sy + 2; y++) {
      if (view === "front" && y > sy && x >= 14 && x <= 17) continue;
      if (y === sy + 2 && (x % 2 === 0)) continue;
      g.px(x, y, (x * 3 + y) % 4 === 0 ? f.l2 : u < 0.3 ? f.l : u > 0.75 ? f.d : f.b);
    }
  }
}
function pauldrons(b: Body, SR: V, SL: V) {
  const { g, L, sy } = b;
  const m = tone(L.metal), tr = tone(L.trim);
  for (const S of [SR, SL]) {
    const cx = S[0] + (S[0] < 16 ? 0.5 : -0.5);
    for (let y = sy - 1; y <= sy + 3; y++) {
      const w = y === sy - 1 ? 1.5 : 2.5;
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
        const u = (x - cx + w) / (2 * w);
        g.px(x, y, y === sy + 3 ? tr.d : y === sy + 2 ? tr.b : u < 0.35 && y <= sy ? m.l2 : u < 0.4 ? m.l : u > 0.7 ? m.d : m.b);
      }
    }
  }
}

/** Lying on the ground: the side figure, curled, turned on its side. */
function paintDead(L: Look): Grid {
  const D = dims(L);
  const s = new Grid(32, 48);
  const R = rigSide("dead", 0, L.weapon);
  // a slightly shortened body so that the whole figure fits across 32 pixels
  const k = L.build === "child" ? 0 : 1;
  R.hdy = 5 * k; R.lean = 0;
  R.fR = [-2, 10 * k], R.fL = [0, 9 * k];
  const T = D.T + R.hdy;
  const b: Body = { g: s, L, D, R, view: "side", T, sy: D.sy + 4 * k, wy: D.wy + k, hy: D.hy + k, cloakHem: D.hy + 2 };
  const ln = Math.round(R.lean);
  const S: V = [15 + ln, b.sy + 2];
  cloakSideBehind(b);
  hairSide(s, L, { x0: 10 + ln + 1, T, face: "dead", view: "side" }, true);
  arm(s, L, D, [16 + ln, b.sy + 2], add(S, [2, 8]), [0.4, 1], true);
  legsSide(b, true); legsSide(b, false);
  torsoSide(b);
  mantleSide(b, S);
  const sk = skinTone(L.skin);
  for (let y = T + 14; y <= b.sy; y++) { s.px(14 + ln, y, sk.d); s.px(15 + ln, y, sk.b); s.px(16 + ln, y, sk.d); }
  drawHead(s, L, { x0: 10 + ln + 1, T, face: "dead", view: "side" });
  arm(s, L, D, S, add(S, [-1, 9]), [0.4, 1], false);
  const r = s.rotCCW();
  let x0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.get(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const g = new Grid(32, 48);
  // centre it; if it is too long, keep the head (left side) and lose the feet
  const bw = x1 - x0 + 1;
  g.blit(r, bw <= 30 ? Math.round((32 - bw) / 2) - x0 : 1 - x0, 46 - y1);
  // the dropped weapon lies on the ground in front
  if (L.weapon !== "none") {
    if (L.weapon === "bow") drawWeapon(g, L, "bow", [20, 45], -90, {});
    else { const len = REACH[L.weapon]; drawWeapon(g, L, L.weapon, [Math.round(18 - len / 2), 46], -6, { flipEdge: true }); }
  }
  if (L.off === "shield") drawShield(g, L, [26, 41], "front");
  g.outline();
  return g;
}

// ------------------------------------------------------------------ looks
const BASE: Look = {
  build: "normal", fem: false, skin: "#e9b994", eyes: "#4a6a8a", hair: "#6b4428", hairStyle: "short", beard: "none",
  outfit: "tunic", main: "#7a6a4a", trim: "#a89060", shirt: "#d8ccb0", pants: "#5a4a3a", boots: "#4a3424", belt: "#5a3a22",
  buckle: "#c9a040", metal: "#aeb6c4", hat: "none", hatCol: "#6a4a30", weapon: "none", off: "none", magic: "#9ad8ff",
};

const SKINS = ["#f1c9a5", "#e9b994", "#dca883", "#c98f68", "#b57a55", "#f4d3b8"];
const HAIRS = ["#2a1e18", "#4a3020", "#6b4428", "#8a5a2e", "#a8763a", "#c8a060", "#3a2a24", "#5a2a1a"];
const EYES = ["#3a5a7a", "#4a6a3a", "#5a3a22", "#2a2a3a", "#4a7a8a", "#6a5a3a"];
const EARTH = ["#7a6a4a", "#6a5a3a", "#8a7a5a", "#5a6a4a", "#7a5a3a", "#6a6a5a", "#8a6a4a", "#5a5a6a", "#9a8a6a"];

/** Sommerlund's soldiers: white tabards with a purple field and a golden device. */
const SOMMER: Partial<Look> = {
  outfit: "tabard", main: "#eeebe3", trim: "#d9a93a", metal: "#b8bfca", shirt: "#7a6a8a", pants: "#4e4458", boots: "#3e2e22",
  belt: "#4a3020", buckle: "#d9a93a", hat: "helmet", device: ["#6a3a9a", "#f0c040"], gloves: "#5a3a24", offCol: "#6a3a9a",
};
const RANGER: Partial<Look> = {
  outfit: "tunic", main: "#5e6b3a", trim: "#8a6a3a", shirt: "#c8b890", pants: "#5a4430", boots: "#4a3020", belt: "#4a3020",
  cloak: "#4c5a30", lining: "#3a4424", hood: "up", weapon: "bow", pouch: true, gloves: "#6a4a2a",
};
const BANDIT: Partial<Look> = {
  outfit: "leather", main: "#6a4a30", trim: "#8a2a2a", shirt: "#8a7a5a", pants: "#4a3a2a", boots: "#3a2a1e", belt: "#3a2618", buckle: "#9a8a70",
  mask: "#8a2e2a", hat: "wrap", hatCol: "#4a3a2c", weapon: "sword", mood: "sly", beard: "stubble",
};

/** Hand-made looks for the story's characters (`vary`: face and hair picked per id). */
const PRESETS: Record<string, Partial<Look> & { vary?: boolean }> = {
  lonewolf: {
    skin: "#f0c49e", hair: "#7a4824", hairStyle: "messy", eyes: "#3f6e8f", outfit: "tunic", main: "#4f8c3e", trim: "#d6c072",
    shirt: "#e0d4b4", pants: "#6a5034", boots: "#5a3a22", belt: "#6e4424", buckle: "#ddb444", cloak: "#2f6a36", lining: "#234e2a",
    hood: "down", pouch: true, weapon: "axe", mood: "kind", magic: "#a8f0ff",
  },
  "king-ulnar": {
    build: "normal", hair: "#c4c0bc", hairStyle: "long", beard: "full", beardCol: "#d4d0cc", wrinkles: true, mood: "stern", eyes: "#4a5a7a",
    outfit: "robe", main: "#f2efe8", trim: "#d9a93a", sash: "#d9a93a", cloak: "#6a3a92", lining: "#4a2a6a", hat: "crown", hatCol: "#e3b23c", boots: "#5a3a6a",
  },
  "royal-courtier": {
    build: "slim", scar: true, mood: "sly", hair: "#2e2420", hairStyle: "short", beard: "goatee", skin: "#e2b892", eyes: "#3a3a2a",
    outfit: "robe", main: "#ece9f0", trim: "#7a4aa6", sash: "#7a4aa6", boots: "#3a2a3a",
  },
  "prince-pelathar": {
    hair: "#caa15a", hairStyle: "short", eyes: "#4a6a9a", outfit: "armor", metal: "#cdd3de", trim: "#e0b040", main: "#6a3a9a",
    pants: "#3e3450", boots: "#4a3a5a", cloak: "#efebe3", lining: "#6a3a9a", hat: "circlet", hatCol: "#e3b23c", weapon: "sword", mood: "stern", magic: "#ff6a8a",
  },
  banedon: {
    build: "slim", hair: "#ecd27e", hairStyle: "messy", eyes: "#4a8ac8", skin: "#f3cfae", outfit: "robe", main: "#7ab6e6", trim: "#f2f4ff",
    sash: "#3e6ea8", boots: "#4a4a6a", weapon: "staff", magic: "#bfeaff", mood: "kind",
  },
  "young-wizard": { build: "slim", hair: "#8a5a2e", hairStyle: "short", outfit: "robe", main: "#4e5cb0", trim: "#e0c060", sash: "#e0c060", weapon: "staff", magic: "#c8a8ff" },
  "theurgist-apprentice": { build: "slim", hair: "#3a2a24", hairStyle: "cropped", outfit: "robe", main: "#8a3a4a", trim: "#e3b23c", sash: "#5a2a3a", off: "book", offCol: "#3a4a8a", magic: "#ffd27a" },
  guildmaster: {
    build: "broad", hair: "#8a7a6a", hairStyle: "balding", beard: "short", beardCol: "#9a8a7a", wrinkles: true, outfit: "noble", main: "#34437a",
    trim: "#e8dcc6", shirt: "#a8383a", pants: "#3a2a2a", chain: true, hat: "cap", hatCol: "#2a2a4a", mood: "stern", off: "book", offCol: "#6a2a2a",
  },
  sage: {
    build: "old", hair: "#ecebe6", hairStyle: "balding", beard: "long", beardCol: "#f2f1ec", wrinkles: true, eyes: "#5a6a7a", outfit: "robe",
    main: "#56638a", trim: "#d6c08a", sash: "#8a7a5a", weapon: "quarterstaff", mood: "kind",
  },
  hermit: {
    build: "old", hair: "#bdb8ae", hairStyle: "wild", beard: "long", beardCol: "#c8c3ba", wrinkles: true, skin: "#c99a74", outfit: "rags",
    main: "#7a6a4e", trim: "#a08a6a", pants: "#5a4a38", boots: "#6a5440", weapon: "quarterstaff", mood: "wild",
  },
  druid: {
    skin: "#d8c4ae", eyes: "#c8402a", hair: "#2a2a22", hairStyle: "long", outfit: "robe", main: "#2c3326", trim: "#6a2a24", sash: "#4a1e1a",
    cloak: "#232a1f", lining: "#141a12", hood: "up", weapon: "staff", magic: "#8aff5a", mood: "stern", boots: "#2a2420",
  },
  "druid-elder": {
    build: "old", skin: "#cdb8a0", eyes: "#e04a2a", hair: "#7a7a70", hairStyle: "long", beard: "long", beardCol: "#8a8a80", wrinkles: true,
    outfit: "robe", main: "#262b20", trim: "#7a2a22", sash: "#5a1e1a", cloak: "#1b2017", lining: "#0f130c", hood: "up", weapon: "staff", magic: "#b0ff4a", mood: "stern", boots: "#2a2420",
  },
  physician: {
    hair: "#5a4a3a", hairStyle: "short", beard: "short", beardCol: "#6a5a48", wrinkles: true, outfit: "noble", main: "#3a3244", trim: "#d8d0bf",
    shirt: "#e6decf", pants: "#2e2a30", hat: "cap", hatCol: "#2a2430", pouch: true, off: "book", offCol: "#5a3a2a", mood: "kind",
  },
  herbalist: {
    fem: true, hair: "#8a5434", hairStyle: "braid", eyes: "#4a7a3a", outfit: "gown", main: "#5e7e44", trim: "#c8a868", sash: "#7a5a34",
    apron: "#e8dcc0", hat: "wrap", hatCol: "#b89a5a", pouch: true, mood: "kind",
  },
  merchant: {
    build: "broad", skin: "#efc09a", hair: "#4a3020", hairStyle: "short", beard: "short", outfit: "noble", main: "#a33a36", trim: "#e2d2b0",
    shirt: "#e6c060", pants: "#4a2a30", chain: true, hat: "cap", hatCol: "#5e2a5a", mood: "sly", pouch: true,
  },
  ferryman: {
    build: "broad", skin: "#c48c62", hair: "#6a5a4a", hairStyle: "cropped", beard: "full", beardCol: "#7a6a58", wrinkles: true, outfit: "peasant",
    main: "#5e6e7e", shirt: "#c8b898", pants: "#4a4a4a", hat: "wrap", hatCol: "#7a5a3a", weapon: "quarterstaff",
  },
  refugee: {
    vary: true, outfit: "rags", main: "#8a7a5a", trim: "#6a5a40", cloak: "#6a5a44", lining: "#4a3e30", hood: "up", pants: "#5a4a3a", boots: "#5a4434", mood: "kind",
  },
  refugees: { vary: true, outfit: "peasant", main: "#7a6a50", shirt: "#b8a888", cloak: "#5e5040", lining: "#43382c", hood: "down", mood: "kind" },
  "young-woman": {
    fem: true, hair: "#a8683a", hairStyle: "long", eyes: "#4a7a4a", skin: "#f3cfb0", outfit: "gown", main: "#b4584c", trim: "#e8d4a8",
    sash: "#7a3a34", apron: "#ece2cc", mood: "kind",
  },
  madman: { hair: "#5a4a3a", hairStyle: "wild", beard: "stubble", skin: "#d8b08e", eyes: "#8a6a2a", outfit: "rags", main: "#6a6a52", trim: "#8a7a5a", mood: "wild", boots: "#5a4a3a" },
  "old-madman": {
    build: "old", hair: "#d0ccc4", hairStyle: "wild", beard: "long", beardCol: "#d8d4cc", wrinkles: true, skin: "#d0a684", eyes: "#9a7a2a",
    outfit: "rags", main: "#5e5a48", trim: "#8a7a5a", mood: "wild", weapon: "quarterstaff",
  },
  bandit: { ...BANDIT, vary: true },
  robber: { ...BANDIT, vary: true, mask: undefined, hat: "wrap", hatCol: "#2e2a26", main: "#4e3a2a", trim: "#3a3a3a", weapon: "dagger", beard: "short" },
  "bandit-soldier": { ...BANDIT, vary: true, hat: "helmet", metal: "#8e8c86", mask: "#5a2a24", weapon: "spear", off: "shield", offCol: "#5a4a32" },
  "holmgard-soldier": { ...SOMMER, vary: true, weapon: "spear" },
  "holmgard-guard": { ...SOMMER, vary: true, weapon: "spear", off: "shield" },
  "king-guard-soldier": { ...SOMMER, vary: true, weapon: "sword", off: "shield", plume: "#7a3aa8" },
  "king-guard-cavalry": { ...SOMMER, vary: true, weapon: "broadsword", plume: "#7a3aa8", cloak: "#6a3a9a", lining: "#4a2a6a", hood: undefined },
  "prince-soldier": { ...SOMMER, vary: true, weapon: "sword", off: "shield", device: ["#3a5aa8", "#f0c040"], offCol: "#3a5aa8" },
  bodyguard: { ...SOMMER, vary: true, build: "broad", weapon: "broadsword", off: "shield", plume: "#e3b23c" },
  "fake-soldier": { ...SOMMER, vary: true, device: ["#5a3a6a", "#b0a060"], trim: "#a8864a", mood: "sly", beard: "stubble", weapon: "sword" },
  "border-ranger": { ...RANGER, vary: true, hood: "down" },
  ranger: { ...RANGER, vary: true },
  "red-stranger": {
    skin: "#e0c4a8", eyes: "#2a1a1a", hair: "#1e1414", hairStyle: "short", outfit: "robe", main: "#a8262a", trim: "#3a1416", sash: "#3a1416",
    cloak: "#8a1c22", lining: "#4a0e12", hood: "up", mood: "sly", magic: "#ff6a3a", boots: "#2a1414",
  },
};

/** Generic looks picked by a keyword in an unknown id. */
/** Matches any of the words at a word start ("old" does not match "soldier"). */
const kw = (words: string) => new RegExp(`(^|[^a-z])(${words})`);
const KEYWORDS: [RegExp, Partial<Look>][] = [
  [kw("king|queen"), { outfit: "robe", main: "#f0ece4", trim: "#d9a93a", cloak: "#6a3a92", lining: "#4a2a6a", hat: "crown", hatCol: "#e3b23c", mood: "stern" }],
  [kw("prince"), { outfit: "armor", metal: "#cdd3de", trim: "#e0b040", main: "#6a3a9a", hat: "circlet", hatCol: "#e3b23c", weapon: "sword" }],
  [kw("knight|paladin"), { outfit: "armor", metal: "#c0c6d0", trim: "#d9a93a", main: "#3a5aa8", hat: "helmet", plume: "#d83a3a", weapon: "sword", off: "shield", offCol: "#3a5aa8" }],
  [kw("cavalry|rider"), { ...SOMMER, weapon: "broadsword", cloak: "#6a3a9a", lining: "#4a2a6a", plume: "#7a3aa8" }],
  [kw("soldier|guard|warrior|sentry|captain|army|militia"), { ...SOMMER, weapon: "spear" }],
  [kw("ranger|hunter|archer|scout|woodsman"), { ...RANGER }],
  [kw("bandit|robber|thief|brigand|outlaw|cutthroat"), { ...BANDIT }],
  [kw("pirate"), { ...BANDIT, mask: undefined, hat: "wrap", hatCol: "#b8302a", main: "#3a3a5a", weapon: "sword" }],
  [kw("sailor|fisher|boatman|ferry"), { outfit: "peasant", main: "#4a6a8a", shirt: "#e0d8c8", hat: "wrap", hatCol: "#3a4a6a" }],
  [kw("wizard|mage|magician|sorcer|theurg|apprentice"), { outfit: "robe", main: "#4e5cb0", trim: "#e0c060", weapon: "staff", magic: "#c8a8ff" }],
  [kw("druid|cultist|warlock|necromancer"), { outfit: "robe", main: "#2c3326", trim: "#6a2a24", cloak: "#232a1f", lining: "#141a12", hood: "up", weapon: "staff", magic: "#8aff5a", eyes: "#c8402a" }],
  [kw("priest|cleric|monk|friar|abbot|healer"), { outfit: "robe", main: "#8a6a44", trim: "#e8dcc0", sash: "#5a4024", hairStyle: "cropped" }],
  [kw("physician|doctor|herbal|apothec"), { outfit: "noble", main: "#3a3244", trim: "#d8d0bf", hat: "cap", hatCol: "#2a2430", pouch: true }],
  [kw("merchant|trader|innkeep|shopkeep|guild|noble|lord|baron|duke|courtier"), { outfit: "noble", main: "#7a2e3a", trim: "#e2d2b0", shirt: "#d8b860", chain: true, hat: "cap", hatCol: "#3a2a4a" }],
  [kw("lady|princess"), { fem: true, outfit: "gown", main: "#8a4aa0", trim: "#e8c870", hat: "circlet", hatCol: "#e3b23c", hairStyle: "long" }],
  [kw("hermit|beggar|madman|mad|refugee|prisoner|slave"), { outfit: "rags", main: "#7a6a4e", trim: "#a08a6a", hairStyle: "wild" }],
  [kw("sage|elder|old|grand"), { build: "old", hair: "#dcdad4", beard: "long", beardCol: "#e8e6e0", wrinkles: true, outfit: "robe", main: "#5a6a7a", trim: "#c8b080" }],
  [kw("child|boy|girl|kid|urchin"), { build: "child", outfit: "peasant" }],
  [kw("woman|wife|maid|mother|widow|girl|daughter|sister|nurse|lady"), { fem: true, outfit: "gown", apron: "#e8dcc0" }],
  [kw("villager|peasant|farmer|townsman|townsfolk|man|stranger|traveller|traveler|pilgrim"), { outfit: "peasant" }],
];
const HUMAN = kw("lonewolf|lone-wolf|kai|king|queen|prince|princess|knight|paladin|soldier|guard|warrior|captain|cavalry|ranger|hunter|archer|scout|bandit|robber|thief|brigand|pirate|sailor|fisher|ferry|wizard|mage|magician|sorcer|theurg|apprentice|druid|priest|cleric|monk|healer|physician|herbal|merchant|trader|innkeep|guild|noble|lord|lady|baron|duke|courtier|hermit|beggar|madman|refugee|prisoner|sage|elder|child|boy|girl|woman|man|villager|peasant|farmer|stranger|traveller|traveler|pilgrim|bodyguard|elf|human|person|people|crowd|messenger|herald|servant|smith|cook|woodsman|scholar|nomad|mercenary|sentry|militia|trimis|banedon|ulnar|pelathar");
const NOT_HUMAN = kw("kakarmi|giak|gourgaz|kraan|zlanbeast|vordak|helghast|doomwolf|wolf|bear|boar|snake|serpent|rat|dog|hound|horse|dragon|wyvern|zombie|skeleton|ghoul|ghost|spirit|wraith|spider|bat|troll|ogre|goblin|orc|lizard|crocodile|bird|eagle|hawk|beast|monster|creature|demon|daemon|darklord|gnaag|crypt|spawn|burrow|kalkoth|elemental|golem|slime|worm|insect|fish|shark|squid|plant|tree|vine|statue|undead|hellhound|automaton|construct");

/** True for human / elf / wizard actors (people), false for monsters and animals. */
export function isPersonActor(actorId: string): boolean {
  const id = actorId.toLowerCase();
  if (id in PRESETS) return true;
  if (NOT_HUMAN.test(id)) return false;
  return HUMAN.test(id);
}

const looks = new Map<string, Look>();
/** Preset look for a known id, or a deterministic villager-like look built from the id. */
export function lookFor(actorId: string): Look {
  const id = actorId.toLowerCase();
  const hit = looks.get(id);
  if (hit) return hit;
  const r = seeded(id);
  const p = PRESETS[id];
  let L: Look;
  const varied = (fem: boolean): Partial<Look> => ({
    skin: r.pick(SKINS), hair: r.pick(HAIRS), eyes: r.pick(EYES),
    hairStyle: fem ? r.pick<HairStyle>(["long", "braid", "bun", "ponytail"]) : r.pick<HairStyle>(["short", "messy", "cropped", "curly", "short"]),
    beard: fem ? "none" : r.pick<Beard>(["none", "none", "stubble", "short", "moustache", "full", "goatee"]),
  });
  if (p) {
    const { vary, ...rest } = p;
    L = { ...BASE, ...(vary ? varied(!!rest.fem) : {}), ...rest };
    if (vary && rest.hat === "helmet") L.beard = r.pick<Beard>(["none", "stubble", "short", "moustache", "full"]);
  } else {
    const kw = KEYWORDS.filter(([re]) => re.test(id)).map(([, v]) => v);
    const fem = kw.some((k) => k.fem) || (!kw.length && r.chance(0.4));
    L = { ...BASE, ...varied(fem), fem, main: r.pick(EARTH), shirt: r.pick(["#d8ccb0", "#c8b898", "#e0d6c0", "#b8a888"]), pants: r.pick(["#5a4a3a", "#4a4a4a", "#6a5a44", "#4a3e34"]), trim: r.pick(["#a89060", "#8a6a4a", "#b85a4a", "#5a7a9a"]), outfit: fem ? "gown" : r.pick<Outfit>(["peasant", "tunic", "peasant"]) };
    if (fem) L.apron = r.chance(0.6) ? "#e8dcc0" : undefined;
    for (const k of kw) Object.assign(L, k);
    if (L.build === "old" && L.hair === BASE.hair) L.hair = "#d8d6d0";
    if (L.build === "old" && !L.fem) L.hairStyle = r.pick<HairStyle>(["balding", "short", "wild"]);
    if (L.fem) L.beard = "none";
    if (L.outfit === "gown" && !L.fem) L.outfit = "peasant";
  }
  looks.set(id, L);
  return L;
}

const resolve = (look: Look | string): Look => (typeof look === "string" ? lookFor(look) : look);

/** Weapon kind for an item name (English or Vietnamese). */
export function weaponKind(name?: string): WeaponKind {
  if (!name) return "none";
  const s = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const has = (...w: string[]) => w.some((x) => new RegExp(`(^|[^a-z])${x}([^a-z]|$)`).test(s) || s.includes(x.replace(/ /g, "")) && x.length > 4);
  if (has("broadsword", "broad sword", "dai kiem", "trong kiem")) return "broadsword";
  if (has("short sword", "shortsword", "doan kiem")) return "shortsword";
  if (has("dagger", "knife", "dao gam", "dao", "dao nho")) return "dagger";
  if (has("warhammer", "war hammer", "hammer", "bua chien", "bua")) return "warhammer";
  if (has("quarterstaff", "staff", "gay", "truong", "gay chien")) return "quarterstaff";
  if (has("sword", "sommerswerd", "kiem", "guom")) return "sword";
  if (has("axe", "riu")) return "axe";
  if (has("mace", "chuy", "dui")) return "mace";
  if (has("spear", "lance", "pike", "giao", "thuong", "mac")) return "spear";
  if (has("bow", "cung")) return "bow";
  return "none";
}

/** The look holding a given item (undefined / unknown = empty hands). The Sommerswerd shines gold. */
export function withWeapon(look: Look | string, weapon?: string): Look {
  const L = resolve(look);
  const kind = weaponKind(weapon);
  const gold = !!weapon && /sommerswerd/i.test(weapon);
  return { ...L, weapon: kind, blade: gold ? "#f2d470" : undefined };
}

// ------------------------------------------------------------------ public drawing API
const keyOf = (L: Look) => JSON.stringify(L);
const lookByKey = new Map<string, Look>();
const frames = memo((key: string) => {
  const [k, facing, pose, frame] = key.split("\u0001");
  return paint(lookByKey.get(k)!, facing as Facing, pose as Pose, Number(frame)).canvas();
});

/** One 32x48 frame (transparent, feet at the bottom centre). Cached. */
export function personFrame(look: Look | string, facing: Facing, pose: Pose, frame: number): HTMLCanvasElement {
  const L = resolve(look);
  const k = keyOf(L);
  if (!lookByKey.has(k)) lookByKey.set(k, L);
  const n = PERSON_FRAMES[pose];
  const f = ((Math.floor(frame) % n) + n) % n;
  return frames([k, facing, pose, f].join("\u0001"));
}

// ------------------------------------------------------------------ portrait (32x32 bust)
const PSKULL: [number, number][] = [
  [4, 11], [2, 13], [1, 14], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [0, 15], [1, 14], [1, 14],
  [2, 13], [2, 13], [3, 12], [4, 11], [6, 9],
];
/** Sprite fringe (12 columns, 15 rows) resampled for the 16-column, 21-row portrait head. */
const pf = (arr: number[], i: number) => {
  const t = (i * 11) / 15, a = Math.floor(t), b = Math.min(11, a + 1), v0 = arr[a], v1 = arr[b];
  if (v0 < 0 && v1 < 0) return -1;
  if (v0 < 0 || v1 < 0) return t - a < 0.5 ? (v0 < 0 ? -1 : Math.round(v0 * 1.4)) : v1 < 0 ? -1 : Math.round(v1 * 1.4);
  return Math.round((v0 + (v1 - v0) * (t - a)) * 1.4);
};

function paintPortrait(L: Look): Grid {
  const g = new Grid(32, 32);
  const x0 = 8, T = 3;
  const H = HAIR[L.hairStyle];
  const sk = skinTone(L.skin), ht = tone(L.hair);
  const ln = lineOf(L), br = browOf(L);
  const child = L.build === "child";
  const D = dims(L);
  const wide = L.build === "broad" ? 1 : L.fem || L.build === "slim" || child ? -1 : 0;

  // cloak / long hair behind the shoulders
  if (L.cloak) {
    const c = tone(L.cloak);
    for (let y = 21; y < 32; y++) { const w = 11 + wide + (y - 21) * 0.6; for (let x = Math.round(16 - w); x <= Math.round(15 + w); x++) g.px(x, y, x < 9 ? c.l : x > 23 ? c.d : c.b); }
  }
  if (H.back > 13 && !H.bald) {
    for (let x = x0 - 3; x <= x0 + 18; x++) {
      const bottom = Math.min(31, T + Math.round(H.back * 1.15) - (x % 2) - (x < x0 - 1 || x > x0 + 16 ? 2 : 0));
      for (let y = T + 5; y <= bottom; y++) g.px(x, y, y >= bottom - 1 ? ht.d2 : x > x0 + 11 ? ht.d : (x - x0) % 3 === 0 ? ht.d : ht.b);
    }
  }
  // shoulders and clothes
  const up = tone(bodyCol(L)), tr = tone(L.trim), m = tone(L.metal), bk = tone(L.buckle), main = tone(L.main);
  for (let y = 25; y < 32; y++) {
    const w = 7 + wide + (y - 25) * 1.4 + (y > 27 ? 1 : 0);
    const a = Math.round(16 - w), b = Math.round(15 + w);
    for (let x = a; x <= b; x++) {
      const u = (x - a) / (b - a);
      let c = shadeU(up, u);
      if (L.outfit === "tabard") c = u < 0.13 ? m.l : (x + y) % 2 ? m.d : m.b;
      if (L.outfit === "armor" && u > 0.15 && u < 0.35 && y < 28) c = m.l2;
      g.px(x, y, c);
    }
  }
  // neck
  for (let y = T + 18; y <= 26; y++) for (let x = 12; x <= 19; x++) g.px(x, y, x >= 18 ? sk.d2 : y <= T + 19 ? sk.d2 : x <= 12 ? sk.b : sk.d);
  switch (L.outfit) {
    case "tabard": {
      const tb = tone(L.main);
      for (let y = 26; y < 32; y++) for (let x = 10; x <= 21; x++) g.px(x, y, x === 10 ? tb.l : x >= 20 ? tb.d : tb.b);
      if (L.device) { const f = tone(L.device[0]), ch = tone(L.device[1]); for (let y = 27; y < 32; y++) for (let x = 12 + Math.max(0, y - 30); x <= 19 - Math.max(0, y - 30); x++) g.px(x, y, x === 12 ? f.l : x === 19 ? f.d : f.b); g.px(15, 28, ch.l2); g.px(16, 28, ch.l); g.px(14, 29, ch.b); g.px(15, 29, ch.b); g.px(16, 29, ch.d); g.px(17, 29, ch.d); g.px(15, 30, ch.d); g.px(16, 30, ch.d); g.px(15, 31, ch.d2); }
      for (let x = 11; x <= 20; x++) g.px(x, 25, x < 14 ? m.l : m.d);
      break;
    }
    case "armor":
      for (let y = 26; y < 32; y++) { g.px(15, y, m.l2); g.px(16, y, m.l); }
      for (const cx of [6, 25]) for (let y = 25; y < 31; y++) for (let x = cx - 4; x <= cx + 4; x++) { const d = Math.hypot((x - cx) / 4.5, (y - 27) / 3.2); if (d <= 1) g.px(x, y, y >= 29 ? tr.d : d > 0.8 ? tr.b : x < cx - 1 && y < 27 ? m.l2 : x < cx ? m.l : m.d); }
      g.span(11, 20, 25, m.b); g.span(12, 19, 24, m.l);
      break;
    case "robe":
      for (let y = 25; y < 32; y++) { const o = Math.max(0, 31 - y) * 0.6; g.px(Math.round(14 - o), y, tr.l); g.px(Math.round(17 + o), y, tr.d); g.px(Math.round(15 - o), y, tr.b); g.px(Math.round(16 + o), y, tr.b); }
      break;
    case "gown":
      for (let x = 12; x <= 19; x++) g.px(x, 26, x >= 18 ? sk.d : sk.b);
      g.span(11, 20, 27, tr.b); g.px(11, 27, tr.l); g.px(20, 27, tr.d);
      break;
    case "leather":
      for (let y = 26; y < 32; y++) { g.px(Math.round(8 + (y - 26) * 1.6), y, tone(L.belt).b); g.px(Math.round(9 + (y - 26) * 1.6), y, tone(L.belt).d); }
      for (const [x, y] of [[11, 28], [21, 28], [13, 31], [19, 30]] as V[]) g.px(x, y, bk.l);
      g.span(14, 17, 26, main.d2);
      break;
    case "noble": {
      const s = tone(L.shirt);
      for (let y = 26; y < 32; y++) for (let x = 14; x <= 17; x++) g.px(x, y, x === 14 ? s.l : x === 17 ? s.d : s.b);
      g.px(15, 28, bk.l); g.px(15, 30, bk.l);
      const f = tone(L.trim);
      for (let y = 24; y < 29; y++) for (let x = 3; x <= 28; x++) { if (x >= 12 && x <= 19 && y > 24) continue; if (!g.get(x, y + 1)) continue; if (y === 28 && x % 2) continue; g.px(x, y, (x * 3 + y) % 4 === 0 ? f.l2 : x < 12 ? f.l : x > 20 ? f.d : f.b); }
      if (L.chain) { const gc = tone(GOLD); for (const [x, y] of [[10, 28], [11, 29], [12, 30], [13, 31], [18, 31], [19, 30], [20, 29], [21, 28]] as V[]) g.px(x, y, x % 2 ? gc.l : gc.b); }
      break;
    }
    case "rags":
      g.px(9, 29, mx(L.main, L.trim, 0.6)); g.px(10, 29, mx(L.main, L.trim, 0.6)); g.px(10, 30, mx(L.main, L.trim, 0.6)); g.px(21, 28, main.d2); g.px(22, 29, main.d2);
      g.span(13, 18, 26, sk.d); g.span(14, 17, 27, sk.d2);
      break;
    default:
      g.px(15, 26, sk.d); g.px(16, 26, sk.d2); g.px(15, 27, sk.d2); g.px(14, 26, tr.l); g.px(17, 26, tr.d); g.px(14, 27, tr.b); g.px(17, 27, tr.d); g.px(15, 28, tr.b); g.px(16, 28, tr.d);
      g.px(11, 29, up.d); g.px(21, 30, up.d);
  }
  if (L.cloak && L.hood !== "up") {
    const c = tone(L.cloak);
    for (let x = 4; x <= 27; x++) { const y0 = 24 + Math.round(Math.abs(x - 15.5) * 0.15); for (let y = y0; y <= y0 + (L.hood === "down" ? 2 : 1); y++) if (x < 13 || x > 18 || y > y0) g.px(x, y, x < 9 ? c.l : x > 22 ? c.d : (x % 3 === 0 ? c.d : c.b)); }
    for (const sx of [5, 26]) for (let y = 25; y <= 29; y++) for (let x = sx - 3; x <= sx + 3; x++) if (Math.hypot(x - sx, (y - 26) * 1.3) < 3.6) g.px(x, y, x < sx ? c.l : c.d);
    g.px(15, 27, bk.l2); g.px(16, 27, bk.b); g.px(15, 28, bk.d); g.px(16, 28, bk.d2);
  }
  // ears
  for (const [ex, c1, c2] of [[x0 - 1, sk.b, sk.d], [x0 + 16, sk.d, sk.d2]] as [number, string, string][]) for (let y = T + 10; y <= T + 14; y++) g.px(ex, y, y === T + 10 || y === T + 14 ? c2 : c1);
  g.px(x0 - 2, T + 11, sk.b); g.px(x0 - 2, T + 12, sk.d); g.px(x0 + 17, T + 11, sk.d); g.px(x0 + 17, T + 12, sk.d2);
  // face
  PSKULL.forEach(([a, b], r) => {
    for (let x = a; x <= b; x++) {
      let c = sk.b;
      if (x <= 1 && r >= 3 && r <= 14) c = sk.l;
      if (r <= 2 && x <= 7) c = sk.l;
      if (x >= 14 || (x >= 13 && r >= 15)) c = sk.d;
      if (r >= 19 || (r === 18 && (x <= 3 || x >= 12))) c = sk.d;
      if (x === b && r >= 4) c = sk.d2;
      g.px(x0 + x, T + r, c);
    }
  });
  if (child) { g.px(x0 + 1, T + 15, sk.b); }
  // cheeks
  const bl = blushOf(L);
  for (const [x, y] of [[2, 14], [3, 14], [2, 15], [12, 14], [13, 14]] as V[]) g.px(x0 + x, T + y, x > 8 ? mx(bl, sk.d, 0.4) : bl);
  g.px(x0 + 3, T + 16, sk.l);
  // eyes
  const ir = tone(L.eyes), pupil = mx(ir.d2, "#120a14", 0.5);
  const mood = L.mood ?? "kind";
  for (const e of [2, 10]) {
    g.span(x0 + e, x0 + e + 3, T + 10, ln);
    if (L.fem) { g.px(x0 + (e === 2 ? e - 1 : e + 4), T + 10, ln); g.px(x0 + (e === 2 ? e - 1 : e + 4), T + 9, ln); }
    const sc2 = mx(SCLERA, sk.d, 0.35);
    g.px(x0 + e, T + 11, e === 2 ? SCLERA : sc2); g.px(x0 + e + 1, T + 11, "#ffffff"); g.px(x0 + e + 2, T + 11, pupil); g.px(x0 + e + 3, T + 11, e === 2 ? sc2 : sc2);
    g.px(x0 + e, T + 12, sc2); g.px(x0 + e + 1, T + 12, ir.b); g.px(x0 + e + 2, T + 12, ir.l); g.px(x0 + e + 3, T + 12, sc2);
    g.px(x0 + e, T + 13, mx(sk.b, sk.d, 0.5)); g.span(x0 + e + 1, x0 + e + 2, T + 13, sk.d); g.px(x0 + e + 3, T + 13, mx(sk.b, sk.d, 0.5));
    if (L.eyes === "#c8402a" || L.eyes === "#e04a2a") { g.glow(x0 + e + 1, T + 12, L.eyes, 0.6); g.glow(x0 + e + 2, T + 11, L.eyes, 0.5); }
    // brows
    const inner = e === 2 ? e + 3 : e, outer = e === 2 ? e : e + 3;
    const angry = mood === "stern" || mood === "sly";
    const wild = mood === "wild";
    for (let x = e; x <= e + 3; x++) {
      const t = (x - outer) / (inner - outer); // 0 outer .. 1 inner
      const y = T + 8 + (angry ? (t > 0.6 ? 1 : 0) : wild ? (t > 0.5 ? -1 : 0) : mood === "kind" ? (t < 0.3 ? 1 : 0) : 0);
      g.px(x0 + x, y, t > 0.3 ? br : sh(br, 0.15));
    }
  }
  // nose
  g.px(x0 + 7, T + 12, sk.l); g.px(x0 + 7, T + 13, sk.l);
  g.px(x0 + 8, T + 13, mx(sk.b, sk.d, 0.5)); g.px(x0 + 8, T + 14, sk.d);
  g.px(x0 + 6, T + 15, sk.d); g.px(x0 + 7, T + 15, sk.l); g.px(x0 + 8, T + 15, sk.b); g.px(x0 + 9, T + 15, sk.d2);
  g.span(x0 + 7, x0 + 8, T + 16, sk.d);
  // mouth
  const lip = lipOf(L);
  g.span(x0 + 6, x0 + 9, T + 17, sh(lip, -0.15));
  g.px(x0 + 5, T + 17, mx(lip, sk.b, mood === "kind" ? 0.5 : 0.75)); g.px(x0 + 10, T + 17, mx(lip, sk.b, mood === "kind" ? 0.5 : 0.75));
  if (mood === "kind") { g.px(x0 + 5, T + 16, mx(lip, sk.b, 0.7)); g.px(x0 + 10, T + 16, mx(lip, sk.b, 0.7)); }
  if (mood === "sly") g.px(x0 + 10, T + 16, mx(lip, sk.b, 0.4));
  g.span(x0 + 7, x0 + 8, T + 18, L.fem ? sh(lip, 0.25) : mx(lip, sk.b, 0.6));
  g.px(x0 + 7, T + 19, sk.d);
  if (L.wrinkles) {
    g.px(x0 + 1, T + 12, sk.d); g.px(x0 + 14, T + 12, sk.d2); g.px(x0 + 1, T + 11, sk.d);
    g.px(x0 + 4, T + 15, sk.d); g.px(x0 + 4, T + 16, sk.d); g.px(x0 + 11, T + 15, sk.d); g.px(x0 + 11, T + 16, sk.d);
    g.span(x0 + 5, x0 + 10, T + 6, mx(sk.b, sk.d, 0.6)); g.px(x0 + 2, T + 14, sk.d);
  }
  if (L.scar) for (const [x, y] of [[11, 8], [12, 9], [12, 11], [13, 13], [13, 14], [14, 15]] as V[]) g.px(x0 + x, T + y, y % 2 ? "#c47a72" : "#b0605c");

  // beard
  if (L.beard !== "none") {
    const bt = tone(L.beardCol ?? L.hair);
    if (L.beard === "stubble") for (let r = 15; r <= 20; r++) { const [a, b] = PSKULL[r]; for (let x = a; x <= b; x++) if ((x * 3 + r * 2) % 5 === 0 && !(r === 17 && x >= 5 && x <= 10)) g.px(x0 + x, T + r, mx(L.skin, bt.d, 0.35)); }
    else {
      const mo = () => { g.span(x0 + 4, x0 + 11, T + 16, bt.b); g.px(x0 + 4, T + 17, bt.d); g.px(x0 + 11, T + 17, bt.d); g.span(x0 + 5, x0 + 7, T + 16, bt.l); g.px(x0 + 3, T + 17, bt.d); g.px(x0 + 12, T + 17, bt.d2); };
      if (L.beard === "moustache") mo();
      else if (L.beard === "goatee") { mo(); for (let r = 19; r <= 22; r++) for (let x = 6; x <= 9; x++) if (r < 22 || (x > 6 && x < 9)) g.px(x0 + x, T + r, x === 9 ? bt.d2 : r === 22 ? bt.d2 : (x + r) % 3 === 0 ? bt.b : bt.d); g.span(x0 + 6, x0 + 9, T + 17, sh(lip, -0.3)); }
      else {
        const extra = L.beard === "short" ? 1 : L.beard === "full" ? 3 : 12;
        for (let r = 11; r <= 20 + extra; r++) {
          const [a, b] = r <= 20 ? PSKULL[r] : [Math.min(7, 4 + Math.floor((r - 20) / 2)), Math.max(8, 11 - Math.floor((r - 20) / 2))];
          for (let x = a; x <= b; x++) {
            if (r <= 15 && x > (r <= 13 ? 0 : 2) && x < (r <= 13 ? 15 : 13)) continue;
            if (r === 16 && x > 3 && x < 12) continue;
            if (L.beard === "short" && r <= 17 && x > 3 && x < 12) continue;
            if (r === 17 && x >= 6 && x <= 9) continue;
            if (r >= 32 - T) continue;
            const c = r >= 20 + extra - 1 ? bt.d2 : x > 11 ? bt.d : (x + r) % 3 === 0 ? bt.l : (x * 2 + r) % 5 === 0 ? bt.d : bt.b;
            g.px(x0 + x, T + r, c);
          }
        }
        mo();
        g.span(x0 + 6, x0 + 9, T + 17, sh(lip, -0.3)); g.span(x0 + 7, x0 + 8, T + 18, mx(lip, bt.b, 0.5));
      }
    }
  }
  // hair over the head
  if (L.hairStyle === "bald" || L.hairStyle === "balding") { g.px(x0 + 4, T + 1, sk.l2); g.px(x0 + 5, T + 1, sk.l2); g.px(x0 + 3, T + 2, sk.l2); g.px(x0 + 6, T + 2, sk.l); }
  if (H.side > 0) {
    const sideB = T + Math.round(H.side * 1.4);
    for (const x of [x0 - 1, x0 + 16, x0 - 2, x0 + 17]) {
      const far = x === x0 - 2 || x === x0 + 17;
      for (let y = T + 3 + (far ? 2 : 0); y <= sideB - (far ? 2 : 0); y++) {
        if (H.side <= 11 && y >= T + 10 && y <= T + 14) continue;
        g.px(x, y, y >= sideB - 1 ? ht.d2 : x > x0 ? ht.d : ht.b);
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    const v = pf(H.fringe, i);
    if (v < 0) continue;
    const x = x0 + i;
    const sk0 = PSKULL[0];
    const top = L.hairStyle === "balding" ? T + 4 : i >= sk0[0] && i <= sk0[1] ? T - 1 : i >= 1 && i <= 14 ? T : T + 2;
    const bottom = T + v;
    const prev = pf(H.fringe, Math.max(0, i - 1)), next = pf(H.fringe, Math.min(15, i + 1));
    for (let y = top; y <= bottom; y++) {
      const strand = (y > T + Math.min(prev, next) && i % 3 === 1) || (!!H.curly && (x + y) % 3 === 0) || (y > top + 3 && i % 4 === 2);
      g.px(x, y, hairShade(ht, i / 15, y, top, bottom, strand));
    }
    if (bottom >= T + 4 && bottom + 1 < T + 17 && g.get(x, bottom + 1)) g.px(x, bottom + 1, i >= 13 ? sk.d2 : sk.d);
  }
  // highlight sheen across the crown
  if (!H.bald) for (const [x, y] of [[4, 0], [5, 0], [3, 1], [6, 1], [7, 1], [9, 0]] as V[]) if (g.get(x0 + x, T + y - 1)) g.px(x0 + x, T + y - 1, y === 0 && x < 6 ? ht.l2 : ht.l);
  // glossy band following the curve of the head, broken by strands
  if (!H.bald) for (let i = 2; i <= 12; i++) { const y = T + 2 + Math.round(Math.abs(i - 6) * 0.35); if (i % 3 !== 0 && g.get(x0 + i, y) && y < T + pf(H.fringe, i)) g.px(x0 + i, y, i < 8 ? ht.l : ht.b); }
  if (H.tufts && H.wild) for (const i of H.tufts) { const x = x0 + Math.round(i * 1.36); g.px(x, T - 2, ht.b); g.px(x + 1, T - 2, ht.d); g.px(x - 1, T - 3, ht.d); }
  else if (H.tufts) { g.px(x0 + 5, T - 2, ht.b); g.px(x0 + 11, T - 2, ht.d); }
  if (H.wild) for (const [x, y] of [[-3, 6], [-3, 11], [18, 7], [18, 13], [-3, 15], [18, 16]] as V[]) g.px(x0 + x, T + y, ht.d);
  if (H.tail === "bun") { g.ellipse(x0 + 7.5, T - 3, 3.5, 2.2, ht.b); g.px(x0 + 5, T - 4, ht.l); g.px(x0 + 6, T - 5, ht.l2); g.span(x0 + 6, x0 + 10, T - 1, ht.d); }
  if (H.tail === "braid") for (let y = T + 14; y < 32; y++) { const x = x0 + 16 + ((y >> 1) % 2); g.px(x, y, y % 2 ? ht.b : ht.l); g.px(x + 1, y, ht.d); }

  // masks, hoods and hats
  if (L.mask) { const c = tone(L.mask); for (let r = 15; r <= 22; r++) { const [a, b] = r <= 20 ? PSKULL[r] : [3, 12]; for (let x = a - 1; x <= b + 1; x++) g.px(x0 + x, T + r, (x - r) % 4 === 0 ? c.d : x <= a ? c.l : x >= b - 1 ? c.d : c.b); } }
  if (L.hood === "up" && L.cloak) {
    const c = tone(L.cloak);
    const open = (x: number, y: number) => { const r = y - T, i = x - x0; if (r < 4 || r > 22) return false; const a = r === 4 ? 4 : r === 5 ? 2 : r > 20 ? 3 : 1; return i >= a && i <= 15 - a; };
    for (let y = T - 3; y < 32; y++) {
      const r = y - (T - 3);
      const w = r === 0 ? 5 : r === 1 ? 7 : r === 2 ? 8.5 : y > 24 ? 13 : 10.5;
      for (let x = Math.round(15.5 - w); x <= Math.round(15.5 + w); x++) {
        if (open(x, y)) continue;
        const u = (x - 15.5 + w) / (2 * w);
        let k = u < 0.2 ? c.l : u > 0.8 ? c.d : c.b;
        if (r <= 2 && u > 0.25 && u < 0.5) k = c.l2;
        if (y > 24 && Math.abs(x - 15.5) < 3) k = c.d;
        g.px(x, y, k);
      }
    }
    for (let y = T + 4; y <= T + 22; y++) for (let x = x0; x <= x0 + 15; x++) { if (!open(x, y)) continue; if (!open(x - 1, y) || !open(x + 1, y) || !open(x, y - 1)) tint(g, x, y, c.d2, 0.55); else if (!open(x - 2, y) || !open(x + 2, y) || !open(x, y - 2)) tint(g, x, y, c.d2, 0.25); }
  }
  const hc = tone(L.hatCol);
  switch (L.hat) {
    case "crown": {
      const gt = tone(L.hatCol);
      for (let x = 0; x <= 15; x++) { g.px(x0 + x, T + 3, x < 4 ? gt.l : x > 12 ? gt.d : gt.b); g.px(x0 + x, T + 4, x > 12 ? gt.d2 : gt.d); }
      for (const p of [0, 4, 11, 15]) { g.px(x0 + p, T + 2, gt.b); g.px(x0 + p, T + 1, gt.l); g.px(x0 + p, T, gt.l2); }
      for (let y = T - 1; y <= T + 2; y++) { g.px(x0 + 7, y, gt.l); g.px(x0 + 8, y, gt.b); }
      g.px(x0 + 7, T - 2, gt.l2);
      g.px(x0 + 7, T + 3, "#e04a5a"); g.px(x0 + 8, T + 3, "#d8344a"); g.px(x0 + 7, T + 4, "#8a1a30"); g.px(x0 + 8, T + 4, "#8a1a30");
      g.px(x0 + 3, T + 3, "#6a9ae8"); g.px(x0 + 12, T + 3, "#4a7ad8");
      g.glow(x0 + 7, T + 3, "#ffffff", 0.4);
      break;
    }
    case "circlet": {
      const gt = tone(L.hatCol);
      for (let x = 0; x <= 15; x++) g.px(x0 + x, T + 5, x < 4 ? gt.l : x > 12 ? gt.d : gt.b);
      g.px(x0 + 7, T + 5, L.magic); g.px(x0 + 8, T + 5, sh(L.magic, -0.3)); g.px(x0 + 7, T + 4, gt.b); g.px(x0 + 8, T + 4, gt.d); g.glow(x0 + 7, T + 5, "#ffffff", 0.45);
      break;
    }
    case "helmet": {
      for (let y = T - 3; y <= T + 6; y++) {
        const r = y - (T - 3);
        const inset = r === 0 ? 5 : r === 1 ? 3 : r === 2 ? 1 : 0;
        for (let x = -1 + inset; x <= 16 - inset; x++) {
          const u = (x + 1) / 17;
          let c = u < 0.3 ? m.l : u > 0.72 ? m.d : m.b;
          if (r <= 3 && u > 0.2 && u < 0.42) c = m.l2;
          if (y === T + 6) c = u < 0.5 ? m.l : m.d;
          if (y === T + 5) c = m.d;
          g.px(x0 + x, y, c);
        }
      }
      for (let y = T - 3; y <= T + 4; y++) g.px(x0 + 7, y, y < T ? m.l2 : m.l);
      for (const rx of [0, 4, 11, 15]) g.px(x0 + rx, T + 6, m.l2);
      for (let y = T + 7; y <= T + 14; y++) { g.px(x0 + 7, y, m.l); g.px(x0 + 8, y, m.d); }
      g.px(x0 + 7, T + 15, m.d); g.px(x0 + 8, T + 15, m.d2);
      for (const x of [-2, -1, 16, 17]) for (let y = T + 6; y <= T + 13; y++) g.px(x0 + x, y, x < 0 ? (x === -2 ? m.l : m.b) : (x === 17 ? m.d2 : m.d));
      if (L.plume) { const p = tone(L.plume); for (let y = T - 8; y <= T - 3; y++) { g.px(x0 + 7, y, y < T - 6 ? p.l2 : p.l); g.px(x0 + 8, y, p.b); g.px(x0 + 6, y, p.d); g.px(x0 + 9, y, p.d); } g.px(x0 + 9, T - 8, p.b); g.px(x0 + 10, T - 7, p.d); }
      break;
    }
    case "cap": {
      for (let y = T - 3; y <= T + 3; y++) {
        const r = y - (T - 3);
        const inset = r === 0 ? 4 : r === 1 ? 2 : 0;
        for (let x = -1 + inset; x <= 16 - inset; x++) { const u = (x + 1) / 17; g.px(x0 + x, y, u < 0.3 ? hc.l : u > 0.72 ? hc.d : (x + y) % 4 === 0 ? hc.d : hc.b); }
      }
      for (let x = -2; x <= 17; x++) { g.px(x0 + x, T + 4, x < 3 ? tr.l : x > 13 ? tr.d : tr.b); g.px(x0 + x, T + 5, tr.d); }
      g.px(x0 + 14, T - 4, "#ece8dc"); g.px(x0 + 15, T - 5, "#ece8dc"); g.px(x0 + 16, T - 6, "#d8d0c0"); g.px(x0 + 15, T - 4, "#c8c0b0");
      break;
    }
    case "wrap": {
      for (let y = T - 2; y <= T + 5; y++) {
        const r = y - (T - 2);
        const inset = r === 0 ? 4 : r === 1 ? 2 : r === 2 ? 1 : 0;
        for (let x = inset - 1; x <= 16 - inset; x++) { const u = (x + 1) / 17; g.px(x0 + x, y, y === T + 5 ? hc.d : u < 0.3 ? hc.l : u > 0.75 ? hc.d : (x - y) % 4 === 0 ? hc.d : hc.b); }
      }
      g.px(x0 + 17, T + 4, hc.b); g.px(x0 + 18, T + 5, hc.d); g.px(x0 + 18, T + 6, hc.b); g.px(x0 + 19, T + 7, hc.d);
      break;
    }
    default: break;
  }
  g.outline();
  void D;
  return g;
}

const portraits = memo((key: string) => paintPortrait(lookByKey.get(key)!).canvas());
/** 32x32 head-and-shoulders bust for dialogue boxes. Cached. */
export function portrait(look: Look | string): HTMLCanvasElement {
  const L = resolve(look);
  const k = keyOf(L);
  if (!lookByKey.has(k)) lookByKey.set(k, L);
  return portraits(k);
}

/** Ids with hand-made looks (for previews and tests). */
export const PERSON_PRESETS = Object.keys(PRESETS);
