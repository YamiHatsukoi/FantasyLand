/**
 * Adventure's pixel icons, all drawn in code: 24x24 item icons, 16x16 UI icons and 24x24 icons
 * for every Kai / Magnakai / Grand Master discipline. No emoji anywhere.
 *
 * How an icon is made: shapes are filled with *materials* (a hue-shifted tone ramp), then every
 * material is auto-shaded with a light from the top-left (rim light on lit edges, shadow on the
 * far edges, a soft gradient across larger areas), hand-placed details are laid on top, a
 * selective outline that follows the local hue is added, and glows / sparkles go last.
 *
 * Items are matched by their English name: explicit designs first, then keywords, then a
 * generic icon for the item type. Colour words in the name (Golden, Silver, Black, Red...)
 * tint the main material.
 */
import type { ItemType } from "../types";
import { Px, hs, rgba, hueOutline, memo } from "./px";

export type { ItemType };

export type UiIcon =
  | "cs" | "ep" | "epMax" | "gold" | "meal" | "arrows" | "backpack" | "weapons" | "special" | "map"
  | "book" | "save" | "menu" | "back" | "close" | "dice" | "skull" | "trophy" | "lock" | "flee"
  | "shield" | "mind" | "heal" | "potion" | "music" | "sound" | "settings" | "chart" | "info" | "user";

/* ================================================================== engine */

/** A material: a tone ramp of one colour. Identity matters: two materials never merge. */
interface Tone { b: string; g: string; l: string; m: string; s: string; d: string; gr: number; shiny: boolean }
type Cell = Tone | string | null;

function tone(c: string, o: { gr?: number; shiny?: boolean; k?: number } = {}): Tone {
  const k = o.k ?? 1;
  return { b: c, g: hs(c, 0.78), l: hs(c, 0.3 * k), m: hs(c, -0.13 * k), s: hs(c, -0.3 * k), d: hs(c, -0.5 * k), gr: o.gr ?? 1, shiny: !!o.shiny };
}

const NE = -Math.PI / 4;
const SE = Math.PI / 4;
/** Local coordinates: u along the angle, v across it (v > 0 = clockwise side). */
function loc(ox: number, oy: number, ang: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return (x: number, y: number): [number, number] => {
    const dx = x - ox, dy = y - oy;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
}

class Ic {
  cells: Cell[];
  over: [number, number, string][] = [];
  posts: ((p: Px) => void)[] = [];
  flip = false;
  outline = true;
  constructor(readonly S: number) { this.cells = new Array(S * S).fill(null); }

  private fx(x: number) { return this.flip ? this.S - 1 - x : x; }
  at(x: number, y: number): Cell {
    return x < 0 || y < 0 || x >= this.S || y >= this.S ? null : this.cells[y * this.S + x];
  }
  set(x: number, y: number, v: Cell) {
    x = this.fx(Math.round(x)); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.S || y >= this.S) return;
    this.cells[y * this.S + x] = v;
  }
  rect(x: number, y: number, w: number, h: number, v: Cell) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
  }
  line(x0: number, y0: number, x1: number, y1: number, v: Cell, over = false) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      if (over && typeof v === "string") this.o(x0, y0, v); else this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  /** Paints every pixel whose centre satisfies `f` (design-space coordinates). */
  fn(f: (x: number, y: number) => Cell | undefined, x0 = 0, y0 = 0, x1 = this.S - 1, y1 = this.S - 1) {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.S - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.S - 1, Math.ceil(x1)); x++) {
        const v = f(x + 0.5, y + 0.5);
        if (v !== undefined) this.set(x, y, v);
      }
  }
  ell(cx: number, cy: number, rx: number, ry: number, v: Cell) {
    this.fn((x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? v : undefined), cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1);
  }
  ring(cx: number, cy: number, rx: number, ry: number, t: number, v: Cell) {
    this.fn((x, y) => {
      const a = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2, b = ((x - cx) / (rx - t)) ** 2 + ((y - cy) / (ry - t)) ** 2;
      return a <= 1 && b > 1 ? v : undefined;
    }, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1);
  }
  poly(pts: [number, number][], v: Cell) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    this.fn((x, y) => (inPoly(pts, x, y) ? v : undefined), Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1);
  }
  /** Lit sphere (flat colours computed from a light at the top-left). */
  ball(cx: number, cy: number, r: number, T: Tone, clip?: (x: number, y: number) => boolean, ry = r) {
    this.fn((x, y) => {
      if (clip && !clip(x, y)) return undefined;
      const dx = (x - cx) / r, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 > 1) return undefined;
      const L = -dx * 0.55 - dy * 0.65 + Math.sqrt(1 - d2) * 0.52;
      return L > 0.9 ? T.g : L > 0.66 ? T.l : L > 0.36 ? T.b : L > 0.12 ? T.m : L > -0.12 ? T.s : T.d;
    }, cx - r - 1, cy - ry - 1, cx + r + 1, cy + ry + 1);
  }
  /** North-east diagonal run: step i at (x+i, y-i), one pixel per entry of `cols` to the right. */
  ne(x: number, y: number, len: number, cols: Cell[]) {
    for (let i = 0; i < len; i++) cols.forEach((v, k) => v !== null && this.set(x + i + k, y - i, v));
  }
  /** South-east diagonal run: step i at (x+i, y+i). */
  se(x: number, y: number, len: number, cols: Cell[]) {
    for (let i = 0; i < len; i++) cols.forEach((v, k) => v !== null && this.set(x + i + k, y + i, v));
  }
  /** Detail pixel laid over the shaded result (may be translucent). */
  o(x: number, y: number, col: string) {
    x = this.fx(Math.round(x)); y = Math.round(y);
    this.over.push([x, y, col]);
  }
  orect(x: number, y: number, w: number, h: number, col: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.o(i, j, col);
  }
  /** Overlay only on painted cells matching `f`. */
  ofn(f: (x: number, y: number) => string | undefined) {
    for (let y = 0; y < this.S; y++) for (let x = 0; x < this.S; x++) {
      const X = this.fx(x);
      if (!this.cells[y * this.S + X]) continue;
      const c = f(x + 0.5, y + 0.5);
      if (c) this.over.push([X, y, c]);
    }
  }
  post(f: (p: Px, fx: (x: number) => number) => void) { const fl = this.flip, S = this.S; this.posts.push((p) => f(p, (x) => (fl ? S - 1 - x : x))); }
  glow(col: string, r = 2, a = 0.5, near?: [number, number, number]) { this.post((p, fx) => halo(p, col, r, a, near && [fx(near[0]), near[1], near[2]])); }
  spark(x: number, y: number, col = "#fffbe6", big = false) { this.post((p, fx) => sparkle(p, fx(x), y, col, big)); }

  render(): HTMLCanvasElement {
    const S = this.S, p = new Px(S, S);
    const bb = new Map<Tone, [number, number, number, number]>();
    this.cells.forEach((v, i) => {
      if (!v || typeof v === "string") return;
      const x = i % S, y = (i / S) | 0, b = bb.get(v);
      if (!b) bb.set(v, [x, y, x, y]);
      else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = this.at(x, y);
      if (!v) continue;
      if (typeof v === "string") { p.px(x, y, v); continue; }
      const same = (dx: number, dy: number) => this.at(x + dx, y + dy) === v;
      let lv = 0;
      const tl = !same(-1, 0) || !same(0, -1), br = !same(1, 0) || !same(0, 1);
      if (tl) lv += 1;
      if (br) lv -= 1.1;
      else if (!same(2, 0) || !same(0, 2) || !same(1, 1)) lv -= 0.45;
      if (!same(1, 0) && !same(0, 1)) lv -= 0.6;
      const [x0, y0, x1, y1] = bb.get(v)!, w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w + h > 7) lv += (0.5 - ((x - x0 + 0.5) / w + (y - y0 + 0.5) / h) / 2) * 1.7 * v.gr;
      let c = lv >= 0.7 ? v.l : lv >= -0.3 ? v.b : lv >= -0.8 ? v.m : lv >= -1.45 ? v.s : v.d;
      if (v.shiny && tl && !br && !same(-1, -1) && lv > 1.15) c = v.g;
      p.px(x, y, c);
    }
    for (const [x, y, c] of this.over) p.px(x, y, c);
    if (this.outline) p.outline(hueOutline);
    for (const f of this.posts) f(p);
    return p.c;
  }
}

function inPoly(pts: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Soft translucent glow around the painted shape. */
function halo(p: Px, col: string, r: number, a: number, near?: [number, number, number]) {
  const d = p.g.getImageData(0, 0, p.w, p.h).data, W = p.w, H = p.h;
  const out: [number, number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3]) continue;
    if (near && Math.hypot(x - near[0], y - near[1]) > near[2]) continue;
    let best = 99;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const nx = x + i, ny = y + j;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !d[(ny * W + nx) * 4 + 3]) continue;
      best = Math.min(best, Math.hypot(i, j));
    }
    if (best <= r + 0.01) out.push([x, y, a * (1 - (best - 1) / (r + 0.5))]);
  }
  for (const [x, y, al] of out) p.px(x, y, rgba(col, Math.max(0.06, al)));
}

/** Four-point twinkle. */
function sparkle(p: Px, x: number, y: number, col: string, big: boolean) {
  p.px(x, y, "#ffffff");
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, rgba(col, 0.9));
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.px(x + dx, y + dy, rgba(col, 0.45));
}

/* ================================================================== palette */

const C = {
  steel: "#a7b2c4", iron: "#7d8394", dark: "#4a4757", gold: "#e6ad34", silver: "#ccd4e0", bronze: "#c27c3c", brass: "#cf9f45",
  wood: "#a76d3b", dwood: "#734a2b", leather: "#9a5e33", dleather: "#6c4027", strap: "#5a3522",
  cloth: "#b23a3e", linen: "#e2d3ae", paper: "#efdfb3", cork: "#c99158", glass: "#c9eef6",
  red: "#d23b3e", green: "#4aa64f", blue: "#3f74d4", purple: "#8b4fd0", skin: "#e8b48a", bone: "#ebe2c8", wax: "#c42f34",
  fire: "#f08a24", night: "#1d1828",
};

const TINTS: [RegExp, string][] = [
  [/\b(golden|gold|gilded|gilt)\b/, C.gold],
  [/\bsilver(y|ed)?\b/, C.silver],
  [/\b(bronze|copper|brass)\b/, C.bronze],
  [/\b(iron|steel)\b/, "#8b919f"],
  [/\b(black|ebony|ebon|obsidian|dark|shadow|onyx|jet)\b/, "#46414f"],
  [/\b(red|crimson|scarlet|ruby|blood)\b/, "#c9383a"],
  [/\b(blue|azure|sapphire|cobalt)\b/, "#3d6fd6"],
  [/\b(green|emerald|jade)\b/, "#3f9e4c"],
  [/\b(purple|violet|amethyst)\b/, "#8b4fd0"],
  [/\b(white|ivory|pale|pearl)\b/, "#ebe7de"],
  [/\b(yellow|amber|topaz)\b/, "#e9c441"],
  [/\borange\b/, "#e5802c"],
  [/\b(crystal|glass|diamond|clear)\b/, "#aee6f6"],
  [/\b(brown|oak|wooden)\b/, "#8d5b34"],
  [/\b(grey|gray)\b/, "#8e8e98"],
];

interface Ctx { n: string; tint?: string; type?: ItemType }

/* ================================================================== weapons */

interface SwordOpt {
  gx: number; gy: number; len: number; w: 2 | 3 | 4; gh: number; grip: number;
  blade: string; hilt: string; gripC: string; pommel?: string; taper?: number; gem?: string; curl?: boolean; ridge?: boolean;
}
function swordAt(c: Ic, o: SwordOpt) {
  const B = tone(o.blade, { shiny: true, gr: 0.5 }), H = tone(o.hilt, { shiny: true }), G = tone(o.gripC), P = tone(o.pommel ?? o.hilt, { shiny: true });
  const ks = o.w === 4 ? [-1, 0, 1, 2] : o.w === 3 ? [-1, 0, 1] : [0, 1];
  const taper = o.taper ?? 2;
  for (let i = 0; i < o.len; i++) {
    const rem = o.len - i;
    for (const k of ks) {
      if (rem === 1 && k !== 0) continue;
      if (rem <= taper && (k < 0 || k > 1)) continue;
      if (o.w === 4 && rem <= taper + 1 && k === 2) continue;
      c.set(o.gx + 1 + i + k, o.gy - 1 - i, B);
    }
  }
  if (o.ridge) for (let i = 1; i < o.len - 3; i++) { c.o(o.gx + 1 + i, o.gy - 1 - i, B.g); c.o(o.gx + 2 + i, o.gy - 1 - i, B.m); }
  // cross-guard (perpendicular to the blade)
  for (let j = -o.gh; j <= o.gh; j++) { c.set(o.gx + j, o.gy + j, H); c.set(o.gx + j + 1, o.gy + j, H); }
  if (o.curl) { c.set(o.gx - o.gh, o.gy - o.gh - 1, H); c.set(o.gx + o.gh + 2, o.gy + o.gh + 1, H); }
  // grip with leather wraps
  for (let i = 0; i < o.grip; i++) { c.set(o.gx - 1 - i, o.gy + 1 + i, G); c.set(o.gx - i, o.gy + 1 + i, G); }
  for (let i = 0; i < o.grip; i += 2) c.o(o.gx - 1 - i, o.gy + 1 + i, G.s);
  c.ball(o.gx - o.grip, o.gy + o.grip + 1.5, 1.8, P);
  if (o.gem) { c.set(o.gx, o.gy, o.gem); c.set(o.gx + 1, o.gy, o.gem); c.o(o.gx, o.gy, hs(o.gem, 0.6)); }
}

const sword = (c: Ic, k: Ctx) =>
  swordAt(c, { gx: 7, gy: 16, len: 13, w: 3, gh: 3, grip: 3, blade: k.tint ?? C.steel, hilt: C.brass, gripC: C.dleather, gem: undefined });
const broadsword = (c: Ic, k: Ctx) =>
  swordAt(c, { gx: 7, gy: 16, len: 13, w: 4, gh: 4, grip: 3, blade: k.tint ?? "#b4bdcc", hilt: "#8a8f9e", gripC: C.strap, taper: 3, curl: true, ridge: true, pommel: C.brass });
const shortSword = (c: Ic, k: Ctx) =>
  swordAt(c, { gx: 8, gy: 15, len: 11, w: 3, gh: 2, grip: 3, blade: k.tint ?? C.steel, hilt: C.bronze, gripC: C.leather, taper: 2 });
function dagger(c: Ic, k: Ctx) {
  swordAt(c, { gx: 9, gy: 15, len: 9, w: 3, gh: 2, grip: 3, blade: k.tint ?? "#b8c2d2", hilt: C.iron, gripC: C.dwood, taper: 5, curl: true, pommel: C.brass });
}
function sommerswerd(c: Ic) {
  swordAt(c, { gx: 7, gy: 16, len: 13, w: 3, gh: 4, grip: 3, blade: "#f7e9a8", hilt: C.gold, gripC: "#3d5fae", gem: "#ff7a2a", curl: true, pommel: C.gold });
  c.glow("#ffd85a", 2, 0.55);
  c.spark(15, 5, "#fff1a0", true);
  c.spark(19, 2, "#fff1a0");
  c.spark(11, 11, "#fff1a0");
}

function axe(c: Ic, k: Ctx) {
  const W = tone(C.wood), M = tone(k.tint ?? C.steel, { shiny: true }), E = tone(hs(k.tint ?? C.steel, 0.4), { shiny: true }), S = tone(hs(k.tint ?? C.steel, -0.25));
  c.ne(4, 21, 17, [W, W]);
  c.ne(4, 21, 4, [tone(C.dleather), tone(C.dleather)]);
  const L = loc(15, 11.5, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    const b = -v; // upper-left side
    if (b > 0.8 && b < 9.4) {
      const hw = 1.7 + (b - 0.8) * 0.62, edge = 9.1 - u * u * 0.05;
      if (Math.abs(u) <= hw && b <= edge) return b > edge - 1.4 ? E : M;
    }
    if (b >= -1.6 && b <= 0.8 && Math.abs(u) <= 2.1) return S;
    if (b < -1.6 && b > -4.6 && Math.abs(u) <= (b + 4.6) * 0.42) return S;
    return undefined;
  });
  c.o(14, 11, hs(C.steel, -0.55));
}

function spear(c: Ic, k: Ctx) {
  const W = tone(C.wood), M = tone(k.tint ?? C.steel, { shiny: true }), Bd = tone(C.cloth);
  c.ne(2, 22, 13, [W, W]);
  const L = loc(15, 10.5, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    if (u > 0.4 && u < 8.6) { const t = (u - 0.4) / 8.2, hw = 2.5 * Math.sin(Math.PI * Math.pow(t, 0.7)) + 0.4; if (Math.abs(v) <= hw) return M; }
    if (u >= -1.2 && u <= 0.4 && Math.abs(v) <= 1.3) return Bd;
    return undefined;
  });
  c.o(17, 7, hs(C.steel, 0.7)); c.o(18, 6, hs(C.steel, 0.5));
  // little tassel hanging from the binding
  c.set(13, 13, Bd); c.set(13, 14, Bd); c.set(12, 15, Bd);
}

function giakSpear(c: Ic) {
  const W = tone("#5e4030"), M = tone("#5d5a66", { shiny: true }), Bd = tone("#8a2a24"), F = tone("#2c2a34");
  c.ne(2, 22, 13, [W, W]);
  for (let i = 2; i < 12; i += 3) c.o(3 + i, 22 - i, "#3a2a22");
  const L = loc(15, 10.5, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y), a = Math.abs(v);
    if (u > 0.4 && u <= 3.6 && a <= 0.9 + (u - 0.4) * 0.75) return M; // barbs flaring back
    if (u > 3.6 && u < 9 && a <= (9 - u) * 0.33 + (v > 0 && u < 6 ? 0.5 : 0)) return M; // crude jagged point
    if (u >= -1.4 && u <= 0.4 && a <= 1.4) return Bd;
    return undefined;
  });
  // notches hacked into the edge
  c.o(17, 9, "#2a2630"); c.o(19, 6, "#2a2630");
  // black feather trophy
  c.set(12, 14, F); c.set(11, 15, F); c.set(11, 16, F); c.set(10, 17, F); c.set(12, 15, F);
  c.o(11, 15, "#55526a");
}

function mace(c: Ic, k: Ctx) {
  const G = tone(C.dleather), H = tone(C.iron), M = tone(k.tint ?? "#9aa3b4", { shiny: true }), Sp = tone(hs(k.tint ?? "#9aa3b4", 0.25), { shiny: true });
  c.ne(4, 20, 9, [G, G]);
  for (let i = 0; i < 9; i += 2) c.o(5 + i, 20 - i, G.s);
  c.ball(4, 21.5, 1.7, H);
  const cx = 16, cy = 9.5;
  c.fn((x, y) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r <= 4.3) return undefined;
    if (r > 6.6) return undefined;
    const a = Math.atan2(dy, dx), seg = Math.PI / 4, off = Math.abs(((a + seg * 8.5) % seg) - seg / 2);
    return off * r <= (6.6 - r) * 0.62 ? Sp : undefined;
  });
  c.ball(cx, cy, 4.4, M);
  c.ne(12, 13, 2, [H, H]);
}

function club(c: Ic, k: Ctx) {
  const W = tone(k.tint ?? "#8c5a32");
  const L = loc(4.5, 20.5, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    if (u < -0.5 || u > 19) return undefined;
    const hw = 1.1 + Math.max(0, u - 5) * 0.17 - (u > 17 ? (u - 17) * 0.8 : 0);
    return Math.abs(v) <= hw ? W : undefined;
  });
  for (const [x, y] of [[14, 9], [17, 7], [16, 4], [12, 11]] as const) { c.o(x, y, W.d); c.o(x + 1, y, W.s); }
  c.ne(4, 20, 4, [tone(C.strap), tone(C.strap)]);
}

function warhammer(c: Ic, k: Ctx) {
  const W = tone(C.dwood), G = tone(C.strap), M = tone(k.tint ?? C.steel, { shiny: true }), F = tone(hs(k.tint ?? C.steel, 0.25), { shiny: true });
  c.ne(3, 21, 15, [W, W]);
  c.ne(3, 21, 5, [G, G]);
  c.ball(3, 22.3, 1.5, tone(C.iron));
  const L = loc(16, 9.5, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y), b = -v;
    if (b >= 1.6 && b <= 5.4 && Math.abs(u) <= 2.9) return F; // striking face
    if (b >= -1.8 && b < 1.6 && Math.abs(u) <= 2.1) return M; // body
    if (b < -1.8 && b > -6.8 && Math.abs(u) <= (b + 6.8) * 0.4) return M; // back spike
    if (u > 2.1 && u < 5 && Math.abs(v) <= (5 - u) * 0.45) return M; // top spike
    return undefined;
  });
}

function staff(c: Ic, k: Ctx) {
  const W = tone(k.tint ?? C.wood), M = tone(C.iron, { shiny: true }), Lt = tone(C.leather);
  c.ne(2, 22, 20, [W, W]);
  c.ne(2, 22, 2, [M, M]);
  c.ne(20, 4, 2, [M, M]);
  c.ne(9, 15, 3, [Lt, Lt]);
  c.ne(13, 11, 2, [Lt, Lt]);
  for (const i of [5, 15]) { c.o(3 + i, 22 - i, W.d); }
}

function bow(c: Ic, k: Ctx) {
  const W = tone(k.tint ?? C.wood, { gr: 0.4 }), G = tone(C.strap);
  const xAt = (y: number) => { const t = (y - 2) / 19; return 6.5 + 10 * Math.pow(Math.sin(Math.PI * t), 0.85) - (t < 0.06 || t > 0.94 ? 1 : 0); };
  let prev = xAt(2);
  for (let y = 2; y <= 21; y++) {
    const x = Math.round(xAt(y)), thick = y >= 9 && y <= 14 ? 3 : 2;
    const a = Math.min(x, Math.round(prev)), b = Math.max(x, Math.round(prev));
    for (let i = a; i <= b + thick - 1; i++) c.set(i, y, y >= 10 && y <= 13 ? G : W);
    prev = xAt(y);
  }
  c.line(7, 3, 7, 20, "#f0e6cc");
  c.set(6, 2, W); c.set(6, 21, W);
  c.o(17, 10, hs(C.strap, 0.4)); c.o(17, 12, hs(C.strap, 0.4));
}

function arrowAt(c: Ic, x: number, y: number, len: number, head: string, fl: string) {
  const W = tone(C.wood), H = tone(head, { shiny: true }), F = tone(fl);
  c.ne(x, y, len, [W]);
  const L = loc(x + len + 0.5, y - len + 0.5, NE);
  c.fn((px, py) => {
    const [u, v] = L(px, py);
    if (u >= -0.6 && u <= 4 && Math.abs(v) <= Math.min(1.9, (4 - u) * 0.6)) return H;
    return undefined;
  });
  const T = loc(x + 0.5, y + 0.5, NE);
  c.fn((px, py) => {
    const [u, v] = T(px, py);
    if (u >= 0.3 && u <= 4.5 && Math.abs(v) >= 0.7 && Math.abs(v) <= 1 + (4.5 - u) * 0.35) return F;
    return undefined;
  });
}
const arrow = (c: Ic, k: Ctx) => arrowAt(c, 3, 20, 13, k.tint ?? C.steel, "#e9e2d2");

function quiver(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? C.leather, { gr: 0.6 }), R = tone(C.dleather), W = tone(C.wood);
  const fl = ["#d8453f", "#ece6d6", "#d8453f"];
  [8, 12, 16].forEach((ax, i) => {
    const F = tone(fl[i]);
    c.rect(ax, 2 + (i === 1 ? -1 : 1), 1, 8, W);
    const top = i === 1 ? 1 : 3;
    for (let j = 0; j < 4; j++) { c.set(ax - 1, top + 1 + j, F); c.set(ax + 1, top + 1 + j, F); }
    c.set(ax, top, F);
  });
  c.rect(6, 9, 13, 2, R);
  c.fn((x, y) => (x >= 7 && x <= 18 && y >= 10.5 && y <= 21.5 && (y < 19 || ((x - 12.5) / 5.8) ** 2 + ((y - 19) / 2.8) ** 2 <= 1) ? L : undefined));
  c.line(7, 14, 18, 12, tone(C.strap));
  c.ofn((x, y) => (y > 15 && y < 20 && (Math.floor(x) + Math.floor(y)) % 3 === 0 && x > 8 && x < 17 ? rgba(C.dleather, 0.45) : undefined));
  c.o(10, 16, hs(C.gold, 0.2)); c.o(15, 16, hs(C.gold, 0.2));
}

/* ================================================================== armour */

function helmet(c: Ic, k: Ctx) {
  const M = tone(k.tint ?? C.steel, { shiny: true }), R = tone(hs(k.tint ?? C.steel, 0.3), { shiny: true }), T = tone(C.bronze, { shiny: true }), Ch = tone(k.tint ?? C.steel, { shiny: true });
  const dark = "#17141f";
  c.fn((x, y) => (y <= 12 && ((x - 12) / 8) ** 2 + ((y - 11.5) / 8.6) ** 2 <= 1 ? M : undefined));
  // cheek guards
  c.fn((x, y) => (y > 12 && y <= 21 && ((x >= 4 && x <= 10 - (y > 18 ? y - 18 : 0)) || (x >= 14 + (y > 18 ? y - 18 : 0) && x <= 20)) ? Ch : undefined));
  c.rect(10, 13, 4, 7, dark);
  c.rect(5, 13, 5, 2, dark);
  c.rect(14, 13, 5, 2, dark);
  c.rect(11, 11, 2, 7, R); // nasal guard
  c.rect(4, 11, 16, 2, T); // brow band
  c.rect(11, 3, 2, 8, R); // crest ridge
  for (const x of [6, 9, 15, 18]) c.o(x, 11, hs(C.bronze, 0.7));
  c.o(7, 6, hs(C.steel, 0.8)); c.o(8, 5, hs(C.steel, 0.6));
}

const VEST: [number, number][] = [[6, 3], [9, 3], [12, 10], [15, 3], [18, 3], [18, 5], [20, 8], [20, 21], [4, 21], [4, 8], [6, 5]];
function chainmail(c: Ic, k: Ctx) {
  const M = tone(k.tint ?? "#9ba6b8", { gr: 1.2 }), T = tone(C.leather);
  c.poly(VEST, M);
  c.rect(4, 20, 17, 2, T);
  c.line(9, 3, 12, 10, T); c.line(15, 3, 12, 10, T); c.line(10, 3, 12, 8, T); c.line(14, 3, 12, 8, T);
  c.ofn((x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    if (Y >= 20 || c.at(X, Y) !== M) return undefined;
    const col = (X + (Math.floor(Y / 2) % 2)) % 2, r = Y % 2;
    return r === 0 && col === 0 ? rgba("#ffffff", 0.3) : r === 1 && col === 1 ? rgba("#101830", 0.32) : undefined;
  });
  c.line(12, 11, 12, 19, rgba("#101830", 0.5), true);
  for (const y of [13, 16]) c.o(12, y, hs(C.brass, 0.3));
}

function leatherVest(c: Ic, k: Ctx) {
  const M = tone(k.tint ?? "#a7693b", { gr: 1.2 }), T = tone(C.dleather);
  c.poly(VEST, M);
  c.rect(4, 20, 17, 2, T);
  c.line(9, 3, 12, 10, T); c.line(15, 3, 12, 10, T);
  c.ofn((x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    if (c.at(X, Y) !== M) return undefined;
    return (X + Y) % 4 === 0 || (X - Y + 400) % 4 === 0 ? rgba("#3a1a08", 0.28) : undefined;
  });
  for (let y = 11; y <= 19; y += 2) { c.o(11, y, "#f0d8a8"); c.o(13, y, "#f0d8a8"); c.o(12, y + 1, "#5a3018"); }
  c.line(12, 11, 12, 19, rgba("#3a1a08", 0.55), true);
}

function shield(c: Ic, k: Ctx) {
  const Rm = tone(C.steel, { shiny: true }), F = tone(k.tint ?? "#2f5fb6", { gr: 1.3 }), B = tone(C.gold, { shiny: true });
  const hw = (y: number, sh: number) => (y < 11 ? 8.6 : 8.6 * Math.sqrt(Math.max(0, 1 - ((y - 11) / 11) ** 2))) - sh;
  const top = (x: number) => 3 + Math.abs(x - 12) * 0.08;
  c.fn((x, y) => (y >= top(x) && Math.abs(x - 12) <= hw(y, 0) ? Rm : undefined));
  c.fn((x, y) => (y >= top(x) + 1.5 && y <= 20.3 && Math.abs(x - 12) <= hw(y, 1.6) ? F : undefined));
  // sun emblem of Sommerlund
  c.ball(12, 11, 2.6, B);
  for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]] as const) c.set(Math.floor(12 + dx * (Math.abs(dx) === 3 ? 1 : 1)) - (dx < 0 ? 1 : 0), Math.floor(11 + dy) - (dy < 0 ? 1 : 0), B);
  c.o(6, 5, hs(C.steel, 0.8));
}

function cloak(c: Ic, k: Ctx, surgeon = false) {
  const col = k.tint ?? (surgeon ? "#dcd7c9" : "#3f6b45");
  const M = tone(col, { gr: 1.1 }), Hd = tone(col), Tr = tone(surgeon ? "#3f8a52" : C.gold);
  c.poly([[8, 6], [16, 6], [20, 20], [17, 21], [12, 20], [7, 21], [4, 20]], M);
  c.ell(12, 6.5, 5, 4.6, Hd);
  c.ell(12, 7.5, 2.8, 3, "#1a1622");
  // folds
  for (const [x, d] of [[8, 1], [12, 0], [16, -1]] as const) { c.line(x, 13, x - d, 20, rgba("#0c0816", 0.32), true); c.line(x + 1, 13, x + 1 - d, 20, rgba("#ffffff", 0.14), true); }
  c.ball(12, 11.5, 1.5, tone(C.gold, { shiny: true }));
  if (surgeon) {
    c.line(4, 20, 7, 21, Tr); c.line(17, 21, 20, 20, Tr); c.line(8, 6, 4, 20, Tr); c.line(16, 6, 20, 20, Tr);
    // herb badge on the breast
    c.o(15, 14, "#3f8a52"); c.o(16, 13, "#5fb46a"); c.o(15, 13, "#5fb46a"); c.o(14, 15, "#2d6a3c");
  }
}

function furs(c: Ic, k: Ctx) {
  const A = tone(k.tint ?? "#ece8de", { gr: 1.1 }), B = tone("#8f7058", { gr: 1 }), S = tone(C.strap);
  // lower pelt, darker, with a ragged fringe
  c.fn((x, y) => { const X = Math.floor(x), fr = [0, 2, 1, 2, 0, 1][X % 6]; return x >= 2 && x <= 22 && y >= 12 && y <= 18.6 + fr && !(x < 3 && y > 19) ? B : undefined; });
  // upper pelt, pale, rolled at the left end, shaggy hem
  c.fn((x, y) => { const X = Math.floor(x), fr = [1, 2, 0, 2, 1, 0, 2][X % 7]; return x >= 4 && x <= 21 && y >= 4 && y <= 13.6 + fr ? A : undefined; });
  c.ell(4.5, 9.5, 3.4, 5.6, A);
  c.ell(4.5, 9.5, 1.6, 2.8, tone(hs(k.tint ?? "#ece8de", -0.25)));
  for (const [x, y] of [[21, 5], [22, 8], [22, 11], [5, 3], [11, 3], [17, 3]] as const) c.set(x, y, A);
  for (const [x, y] of [[22, 13], [23, 16], [1, 14]] as const) c.set(x, y, B);
  // hair strokes
  c.ofn((x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), v = c.at(X, Y);
    if (v === A) return (X * 5 + Y * 3) % 8 === 0 ? rgba("#6a5a70", 0.35) : (X * 5 + Y * 3) % 8 === 1 ? rgba("#ffffff", 0.55) : undefined;
    if (v === B) return (X * 3 + Y * 5) % 7 === 0 ? rgba("#2a1408", 0.35) : (X * 3 + Y * 5) % 7 === 1 ? rgba("#e0c0a0", 0.35) : undefined;
    return undefined;
  });
  c.rect(14, 3, 2, 18, S);
  c.rect(14, 10, 2, 2, tone(C.brass, { shiny: true }));
}

function boots(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? C.leather, { gr: 1 }), Cf = tone(hs(k.tint ?? C.leather, 0.2)), So = tone("#3a2a24");
  c.rect(7, 4, 7, 12, L);
  c.poly([[7, 14], [14, 13], [18, 15], [21, 17], [21, 20], [7, 20]], L);
  c.rect(6, 3, 9, 3, Cf);
  c.rect(6, 20, 16, 2, So);
  for (let y = 8; y < 15; y += 2) c.o(12, y, "#f0d8a8");
  c.o(8, 7, hs(C.leather, 0.5));
}

function gloves(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? C.leather, { gr: 0.9 }), Cf = tone(hs(k.tint ?? C.leather, -0.15));
  c.poly([[6, 15], [18, 15], [20, 22], [4, 22]], Cf);
  c.rect(7, 9, 10, 7, L);
  for (const [x, top] of [[7, 4], [10, 3], [13, 3], [16, 5]] as const) c.fn((px, py) => (px >= x && px <= x + 2.2 && py >= top + 0.5 && py <= 11 && (py > top + 1.5 || Math.abs(px - x - 1.1) < 0.8) ? L : undefined));
  c.poly([[7, 10], [4, 8], [3, 10], [7, 14]], L);
  for (const x of [10, 13, 16]) c.line(x, 6, x, 10, rgba("#2a1408", 0.4), true);
  c.line(6, 17, 18, 17, rgba("#2a1408", 0.4), true);
}

/* ================================================================== potions & consumables */

function liquidOf(k: Ctx) {
  const n = k.n;
  if (/alether|strength|might/.test(n)) return "#f08a24";
  if (/laumspur|herb|cure|antidote/.test(n)) return "#4fbf55";
  if (/heal|life|vital|restor/.test(n)) return "#d93a44";
  if (/poison|venom|gall/.test(n)) return "#8cc23a";
  if (/sleep|dream|mind/.test(n)) return "#8a6ae0";
  return k.tint ?? "#5f74e6";
}

function roundFlask(c: Ic, liquid: string, label?: "heart" | "leaf") {
  const G = tone(C.glass), Lq = tone(liquid), Ck = tone(C.cork), Lp = tone(hs(C.glass, 0.1));
  c.rect(10, 2, 4, 4, Ck);
  c.rect(9, 5, 6, 2, Lp);
  c.rect(10, 7, 4, 3, G);
  c.ball(12, 15, 6.7, G);
  c.ball(12, 15, 6.7, Lq, (_x, y) => y > 12.5);
  c.ofn((x, y) => (Math.floor(y) === 12 && Math.abs(x - 12) < 6 ? hs(liquid, 0.45) : undefined));
  c.o(8, 13, "#ffffff"); c.o(8, 14, "#ffffff"); c.o(9, 11, "#ffffff"); c.o(8, 15, rgba("#ffffff", 0.6));
  c.o(14, 16, rgba("#ffffff", 0.7)); c.o(13, 18, rgba("#ffffff", 0.5)); c.o(15, 14, rgba("#ffffff", 0.5));
  if (label === "heart") {
    const W = "#f4ead2";
    c.orect(10, 15, 5, 4, W);
    c.o(11, 16, liquid); c.o(13, 16, liquid); c.orect(11, 17, 3, 1, liquid); c.o(12, 18, liquid); c.o(12, 16, hs(liquid, 0.2));
  } else if (label === "leaf") {
    const W = "#f4ead2";
    c.orect(10, 15, 5, 4, W);
    c.o(13, 15, "#2f7a3a"); c.o(12, 16, "#3f9e4c"); c.o(13, 16, "#3f9e4c"); c.o(11, 17, "#3f9e4c"); c.o(12, 17, "#2f7a3a"); c.o(11, 18, "#2f7a3a");
  }
}

function tallBottle(c: Ic, liquid: string) {
  const G = tone(C.glass), Lq = tone(liquid, { gr: 0.8 }), Ck = tone(C.wax);
  c.rect(10, 2, 4, 3, Ck);
  c.rect(10, 5, 4, 4, G);
  c.poly([[10, 8], [14, 8], [17, 11], [17, 21], [7, 21], [7, 11]], G);
  c.poly([[7, 13], [17, 13], [17, 21], [7, 21]], Lq);
  c.orect(7, 13, 11, 1, hs(liquid, 0.45));
  c.line(8, 11, 8, 19, rgba("#ffffff", 0.8), true); c.o(9, 10, "#ffffff");
  c.orect(9, 15, 6, 3, "#f1e4c2"); c.orect(10, 16, 4, 1, hs(liquid, -0.3));
}

function vial(c: Ic, liquid: string) {
  const G = tone(C.glass), Lq = tone(liquid), Ck = tone(C.wax), Lp = tone(hs(C.glass, 0.1));
  c.rect(9, 2, 6, 3, Ck);
  c.rect(8, 5, 8, 2, Lp);
  c.fn((x, y) => (x >= 9 && x <= 15 && y >= 7 && (y <= 18 || ((x - 12) / 3) ** 2 + ((y - 18) / 3.4) ** 2 <= 1) ? G : undefined));
  c.fn((x, y) => (x >= 9 && x <= 15 && y >= 10 && (y <= 18 || ((x - 12) / 3) ** 2 + ((y - 18) / 3.4) ** 2 <= 1) ? Lq : undefined));
  c.orect(9, 10, 6, 1, hs(liquid, 0.5));
  c.line(10, 8, 10, 18, rgba("#ffffff", 0.75), true);
  c.o(13, 14, rgba("#ffffff", 0.7)); c.o(12, 17, rgba("#ffffff", 0.5)); c.o(14, 12, rgba("#ffffff", 0.5));
  // wax drips
  c.set(9, 5, Ck); c.set(14, 5, Ck); c.set(14, 6, Ck);
}

function potion(c: Ic, k: Ctx) {
  const liq = liquidOf(k);
  if (/alether/.test(k.n)) return vial(c, liq);
  if (/vial|phial/.test(k.n)) return vial(c, liq);
  if (/elixir|tonic|bottle/.test(k.n)) return tallBottle(c, liq);
  roundFlask(c, liq, /laumspur/.test(k.n) ? "leaf" : /heal/.test(k.n) ? "heart" : undefined);
}

function leaf(c: Ic, cx: number, cy: number, ang: number, len: number, wid: number, T: Cell) {
  const L = loc(cx, cy, ang);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    if (u < 0 || u > len) return undefined;
    return Math.abs(v) <= wid * Math.sin(Math.PI * Math.pow(u / len, 0.8)) ? T : undefined;
  }, cx - len - 1, cy - len - 1, cx + len + 1, cy + len + 1);
}

function herb(c: Ic, k: Ctx) {
  const col = k.tint ?? "#4fa64a";
  const St = tone("#5f8a3a"), Fl = tone("#efe9ff"), Ce = "#f2c84a";
  const stemX = (y: number) => 12 + Math.sin((21 - y) / 5) * 1.2;
  for (let y = 4; y <= 21; y++) c.set(Math.round(stemX(y)), y, St);
  const leaves: [number, number, number, number][] = [[18, -1, 6.5, 2.3], [16, 1, 6.5, 2.3], [13, -1, 6, 2.1], [11, 1, 6, 2.1], [8, -1, 5, 1.8], [7, 1, 5, 1.8]];
  for (const [y, side, len, w] of leaves) {
    const T = tone(side < 0 ? hs(col, -0.05) : col, { gr: 0.7 });
    const x = stemX(y) + (side > 0 ? 1 : 0);
    leaf(c, x, y, side > 0 ? -0.55 : Math.PI + 0.55, len, w, T);
  }
  for (const [y, side, len] of leaves) {
    const x = stemX(y) + (side > 0 ? 1 : 0);
    for (let t = 1; t < len - 1; t++) c.o(x + side * t * Math.cos(0.55), y - t * Math.sin(0.55), rgba("#e8ffd0", 0.4));
  }
  // laumspur flower buds
  for (const [x, y] of [[11, 3], [13, 2], [14, 4]] as const) { c.set(x, y, Fl); c.set(x + 1, y, Fl); c.set(x, y + 1, Fl); c.set(x + 1, y + 1, Fl); c.o(x, y, "#ffffff"); c.o(x + 1, y + 1, Ce); }
  if (/root/.test(k.n)) {
    const R = tone("#a7774a");
    c.line(12, 20, 9, 22, R); c.line(12, 20, 15, 22, R); c.line(12, 21, 12, 23, R);
  }
}

function meal(c: Ic) {
  const Cr = tone("#c98a42", { gr: 1.3 }), Ap = tone("#d23b3e"), Lf = tone("#4aa64f"), Stm = tone(C.dwood);
  c.ell(10, 11.5, 8.4, 5.6, Cr);
  for (const x of [5, 9, 13]) { c.line(x, 10, x + 2, 8, rgba("#6a3410", 0.6), true); c.o(x + 1, 10, rgba("#ffe8b0", 0.6)); c.o(x + 2, 9, rgba("#ffe8b0", 0.6)); }
  c.ball(16.5, 16, 4.6, tone("#d63e3e", { shiny: true }));
  void Ap;
  c.rect(16, 10, 1, 2, Stm);
  leaf(c, 17, 11, -0.4, 3.6, 1.3, Lf);
  // cheese wedge
  const Ch = tone("#f0c64a");
  c.poly([[3, 15], [10, 13.5], [11, 21], [3, 21]], Ch);
  c.o(5, 17, "#c99428"); c.o(8, 18, "#c99428"); c.o(6, 19, "#c99428"); c.o(9, 16, "#c99428");
}

function rations(c: Ic) {
  const Cl = tone("#d7c49a", { gr: 1.2 }), S = tone("#7a4a2a"), K = tone("#8e5a34");
  c.fn((x, y) => (x >= 3 && x <= 21 && y >= 8 && y <= 21 && !((x < 4.5 || x > 19.5) && (y < 9.5 || y > 19.5)) ? Cl : undefined));
  c.rect(11, 8, 2, 14, S);
  c.rect(3, 14, 19, 2, S);
  c.ell(9, 5.5, 2.8, 2, K); c.ell(15, 5.5, 2.8, 2, K);
  c.ell(9, 5.5, 1.2, 0.7, null); c.ell(15, 5.5, 1.2, 0.7, null);
  c.rect(11, 5, 2, 3, S);
  c.line(10, 7, 8, 9, K); c.line(13, 7, 15, 9, K);
  c.ofn((x, y) => (c.at(Math.floor(x), Math.floor(y)) === Cl && (Math.floor(x) * 7 + Math.floor(y) * 3) % 9 === 0 ? rgba("#6a5030", 0.3) : undefined));
  c.o(18, 18, "#b23a3e"); c.o(17, 18, "#b23a3e"); c.o(18, 19, "#8a2a2e");
}

function flask(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? C.leather), M = tone(C.iron, { shiny: true }), S = tone(C.strap);
  c.line(9, 7, 4, 12, S); c.line(15, 7, 20, 12, S);
  c.ball(12, 14.5, 7.2, L);
  c.ring(12, 14.5, 6.2, 6.2, 0.9, null);
  c.ofn((x, y) => { const r = Math.hypot(x - 12, y - 14.5); return r > 5.3 && r < 6.2 && (Math.floor(x) + Math.floor(y)) % 2 === 0 ? "#f0d8a8" : undefined; });
  c.rect(10, 4, 4, 4, M);
  c.rect(9, 2, 6, 3, tone(C.cork));
  // water drop emblem
  c.o(12, 12, "#9fd8ff"); c.o(11, 13, "#5aa8f0"); c.o(12, 13, "#9fd8ff"); c.o(13, 13, "#3a7ad0"); c.o(11, 14, "#3a7ad0"); c.o(12, 14, "#5aa8f0"); c.o(13, 14, "#2a5aa8"); c.o(12, 15, "#2a5aa8");
}

function bottle(c: Ic, k: Ctx) {
  const G = tone(k.tint ?? "#3f8a5a", { gr: 0.9 }), Ck = tone(C.cork);
  c.rect(10, 2, 4, 3, Ck);
  c.rect(10, 5, 4, 5, G);
  c.fn((x, y) => (x >= 7 && x <= 17 && y >= 10 && y <= 21 && (y > 12 || ((x - 12) / 5) ** 2 + ((y - 12.5) / 3) ** 2 <= 1) ? G : undefined));
  c.line(8, 12, 8, 19, rgba("#ffffff", 0.6), true); c.o(11, 6, rgba("#ffffff", 0.6));
  c.orect(8, 14, 9, 4, "#efe2bc"); c.orect(9, 15, 7, 1, "#8a3a2a"); c.orect(10, 16, 5, 1, "#b08a60");
}

function ointment(c: Ic, k: Ctx) {
  const J = tone(k.tint ?? "#dfd3bd", { gr: 1 }), Bd = tone("#4f7ac0"), Ld = tone("#8a5a34"), Kn = tone(C.brass, { shiny: true });
  c.fn((x, y) => (x >= 5 && x <= 19 && y >= 10 && y <= 21 && !((x < 6 || x > 18) && y > 20) ? J : undefined));
  c.rect(5, 13, 15, 2, Bd);
  c.ell(12, 9, 8, 2.6, Ld);
  c.rect(4, 8, 17, 2, Ld);
  c.ball(12, 6, 1.8, Kn);
  // leaf painted on the jar
  c.o(11, 17, "#3f9e4c"); c.o(12, 17, "#5fbf5f"); c.o(13, 16, "#5fbf5f"); c.o(12, 18, "#2f7a3a"); c.o(14, 16, "#3f9e4c"); c.o(11, 18, "#2f7a3a");
}

function fireSphere(c: Ic) {
  const F = tone("#f07a24", { shiny: true });
  F.g = "#fff8d0"; F.l = "#ffd25a"; F.b = "#f8a030"; F.m = "#e86a24"; F.s = "#c8401e"; F.d = "#8a2418";
  c.ball(12, 13, 7, F);
  // swirling flame streaks
  c.ofn((x, y) => {
    const a = Math.atan2(y - 13, x - 12), r = Math.hypot(x - 12, y - 13);
    if (r > 6.5) return undefined;
    const s = Math.sin(a * 3 + r * 0.9);
    return s > 0.85 ? rgba("#fff2a0", 0.65) : s < -0.9 ? rgba("#a02810", 0.35) : undefined;
  });
  flameAt(c, 9, 7, 5, 1.6); flameAt(c, 13.5, 6, 6, 1.9); flameAt(c, 17, 8, 4, 1.4);
  c.glow("#ff9a30", 3, 0.45);
  c.spark(5, 6, "#ffe080"); c.spark(20, 4, "#ffe080");
}

function flameAt(c: Ic, cx: number, by: number, h: number, w: number) {
  const layers: [number, string][] = [[1, "#d8401e"], [0.74, "#f8862a"], [0.5, "#ffd04a"], [0.26, "#fff6c8"]];
  for (const [s, col] of layers) {
    const H = h * s, Wd = w * (0.35 + s * 0.65), base = by;
    c.fn((x, y) => {
      const dy = base - y;
      if (dy < -H * 0.35 || dy > H) return undefined;
      const wAt = dy < 0 ? Wd * Math.sqrt(1 - (dy / (H * 0.35)) ** 2) : Wd * Math.pow(1 - dy / H, 0.8);
      return Math.abs(x - cx - Math.sin(dy * 0.6) * 0.3 * h * 0.1) <= wAt ? col : undefined;
    }, cx - w - 1, by - h - 1, cx + w + 1, by + h);
  }
}

function soap(c: Ic, k: Ctx) {
  const col = k.tint ?? "#e9a7c4";
  const Tp = tone(hs(col, 0.2), { gr: 0.6 }), Fr = tone(col, { gr: 0.6 });
  c.fn((x, y) => (x >= 3 && x <= 21 && y >= 13 && y <= 20 && !((x < 4 || x > 20) && y > 19) ? Fr : undefined));
  c.poly([[5, 9], [19, 9], [21.5, 13], [2.5, 13]], Tp);
  // embossed flower on the top
  const e = hs(col, -0.2), h2 = hs(col, 0.5);
  for (const [x, y] of [[11, 10], [13, 10], [10, 11], [14, 11], [11, 12], [13, 12]] as const) c.o(x, y, e);
  c.o(12, 11, h2); c.o(12, 10, e); c.o(12, 12, e);
  c.orect(5, 16, 14, 1, rgba("#ffffff", 0.22));
  c.post((p) => {
    for (const [x, y, r] of [[18, 5, 2], [21, 2, 1], [14, 4, 1]] as const) {
      for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; p.px(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r), rgba("#d8f4ff", 0.9)); }
      p.px(x - Math.max(1, r - 1), y - Math.max(1, r - 1), "#ffffff");
    }
  });
}

/* ================================================================== gear */

function backpack(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? C.leather, { gr: 1.1 }), F = tone(hs(k.tint ?? C.leather, -0.12)), S = tone(C.strap), P = tone(hs(k.tint ?? C.leather, 0.06)), Bl = tone("#a83f3a", { gr: 0.5 }), Bk = tone(C.brass, { shiny: true });
  c.fn((x, y) => (x >= 4 && x <= 20 && y >= 6 && y <= 22 && !((x < 5 || x > 19) && (y < 7 || y > 21)) ? L : undefined));
  // bedroll strapped on top
  c.fn((x, y) => (x >= 3 && x <= 21 && y >= 2 && y <= 6.5 && !((x < 4 || x > 20) && (y < 3 || y > 5.5)) ? Bl : undefined));
  c.o(3, 3, hs("#a83f3a", 0.3)); c.o(3, 4, hs("#a83f3a", -0.2)); c.o(4, 4, hs("#a83f3a", 0.3));
  c.fn((x, y) => (x >= 5 && x <= 19 && y >= 6 && y <= 13 && (y < 11 || ((x - 12) / 7.5) ** 2 + ((y - 11) / 2.6) ** 2 <= 1) ? F : undefined));
  c.fn((x, y) => (x >= 7 && x <= 17 && y >= 15 && y <= 21 && !((x < 8 || x > 16) && y > 20) ? P : undefined));
  c.rect(8, 2, 2, 13, S); c.rect(15, 2, 2, 13, S);
  c.rect(8, 12, 2, 2, Bk); c.rect(15, 12, 2, 2, Bk);
  c.orect(8, 17, 9, 1, rgba("#2a1408", 0.35));
  c.o(12, 18, C.brass);
}

function pouch(c: Ic, k: Ctx) {
  const L = tone(k.tint ?? "#a8703e", { gr: 1 }), N = tone(hs(k.tint ?? "#a8703e", -0.1)), S = tone("#d8c08a");
  c.fn((x, y) => (((x - 12) / 7.6) ** 2 + ((y - 15.5) / 6.4) ** 2 <= 1 && y < 21.6 ? L : undefined));
  c.poly([[7, 5], [17, 5], [14, 9], [10, 9]], N);
  c.rect(9, 9, 6, 2, S);
  c.line(14, 10, 17, 14, S); c.line(17, 14, 17, 15, S);
  c.ball(17.5, 16, 1.2, tone(C.cloth));
  c.ofn((x, y) => (c.at(Math.floor(x), Math.floor(y)) === L && Math.floor(y) === 13 && Math.floor(x) % 2 === 0 ? rgba("#2a1408", 0.4) : undefined));
}

function map(c: Ic) {
  const A = tone("#efdfb3", { gr: 0.6 }), B = tone("#d6c08c", { gr: 0.6 }), Cc = tone("#e8d6a4", { gr: 0.6 });
  c.rect(3, 4, 6, 16, A); c.rect(9, 5, 6, 16, B); c.rect(15, 4, 6, 16, Cc);
  const ink = "#6a4a2a", sea = "#5a8ac0", red = "#c8302c";
  // coastline and sea
  for (let y = 5; y <= 19; y++) { const x = Math.round(16 + Math.sin(y * 0.7) * 1.6); c.o(x, y, ink); for (let xx = x + 1; xx <= 20; xx++) if ((xx + y) % 2 === 0) c.o(xx, y, rgba(sea, 0.7)); }
  // mountains
  for (const [mx, my] of [[5, 8], [7, 10]] as const) { c.o(mx, my, ink); c.o(mx - 1, my + 1, ink); c.o(mx + 1, my + 1, ink); }
  // forest dots
  for (const [x, y] of [[11, 8], [12, 9], [10, 10]] as const) c.o(x, y, "#3f7a3a");
  // dotted route ending in an X
  for (const [x, y] of [[5, 16], [7, 15], [9, 15], [11, 14], [13, 13]] as const) c.o(x, y, red);
  c.o(13, 16, red); c.o(15, 16, red); c.o(14, 17, red); c.o(13, 18, red); c.o(15, 18, red);
}

function scroll(c: Ic, k: Ctx) {
  const P = tone(k.tint ?? C.paper, { gr: 0.4 }), E = tone(hs(C.paper, -0.1)), K = tone(C.dwood), R = tone(C.cloth);
  const L = loc(12, 12, NE);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    if (Math.abs(v) <= 3.2 && Math.abs(u) <= 7.6) return Math.abs(u) > 6.6 ? E : P;
    if (Math.abs(v) <= 1.3 && Math.abs(u) <= 9.6) return K;
    return undefined;
  });
  // ribbon
  c.fn((x, y) => { const [u, v] = L(x, y); return Math.abs(u) <= 0.9 && Math.abs(v) <= 3.4 ? R : undefined; });
  c.ball(12.5, 12.5, 2.1, tone(C.wax, { shiny: true }));
  c.set(14, 15, R); c.set(15, 16, R); c.set(13, 16, R);
  // curls at the ends
  c.o(17, 5, hs(C.paper, -0.45)); c.o(18, 6, hs(C.paper, -0.45)); c.o(6, 17, hs(C.paper, -0.45)); c.o(7, 18, hs(C.paper, -0.45));
}

function letter(c: Ic, k: Ctx) {
  const P = tone(k.tint ?? "#ece0bd", { gr: 0.8 });
  c.rect(2, 6, 20, 13, P);
  const ln = rgba("#6a4a2a", 0.4);
  c.line(2, 6, 12, 13, ln, true); c.line(21, 6, 12, 13, ln, true);
  c.line(2, 18, 8, 13, ln, true); c.line(21, 18, 16, 13, ln, true);
  c.ball(12, 13, 2.8, tone(C.wax, { shiny: true }));
  c.set(10, 16, C.wax); c.set(9, 17, "#9a2026"); c.set(14, 16, C.wax); c.set(15, 17, "#9a2026");
  c.o(12, 13, "#8a1a20"); c.o(11, 13, "#8a1a20"); c.o(12, 12, "#8a1a20");
}

function book(c: Ic, k: Ctx) {
  const col = k.tint ?? "#8a3038";
  const Cv = tone(col, { gr: 1.1 }), Sp = tone(hs(col, -0.18)), Pg = tone("#efe6cc", { gr: 0.3 }), Au = tone(C.gold, { shiny: true });
  c.rect(5, 19, 16, 2, Pg);
  c.rect(4, 21, 17, 1, Sp);
  c.rect(6, 3, 15, 16, Cv);
  c.fn((x, y) => (x >= 3 && x <= 6 && y >= 3.5 && y <= 22 ? Sp : undefined));
  c.orect(7, 20, 13, 1, rgba("#9a8a6a", 0.6));
  for (const y of [6, 16]) c.orect(3, y, 3, 1, hs(C.gold, -0.1));
  c.rect(19, 3, 2, 3, Au); c.rect(19, 16, 2, 3, Au);
  c.rect(19, 9, 3, 4, Au);
  // emblem
  c.ofn((x, y) => (Math.abs(x - 13) + Math.abs(y - 11) <= 3.2 && Math.abs(x - 13) + Math.abs(y - 11) > 1.8 ? hs(C.gold, 0.15) : undefined));
  c.o(12, 10, hs(C.gold, 0.5)); c.o(12, 11, C.gold); c.o(13, 10, C.gold);
}

function torch(c: Ic) {
  const W = tone(C.wood), Wr = tone("#5e3a24"), Ir = tone(C.iron);
  c.ne(4, 22, 11, [W, W]);
  c.ne(11, 15, 1, [Ir, Ir, Ir]);
  c.ne(12, 13, 3, [Wr, Wr, Wr]);
  c.ne(12, 13, 1, [null, Wr, Wr, Wr]);
  for (let i = 0; i < 3; i++) c.o(12 + i, 13 - i, hs("#5e3a24", 0.35));
  flameAt(c, 15.5, 9.5, 8, 3.4);
  c.glow("#ffa040", 2, 0.45, [15.5, 5, 7]);
  c.spark(19, 2, "#ffe080");
  c.spark(11, 3, "#ffe080");
}

function lantern(c: Ic) {
  const M = tone(C.dark, { shiny: true }), G = tone("#ffe7a0"), Br = tone(C.brass, { shiny: true });
  c.ring(12, 3.5, 3.2, 2.8, 1.1, M);
  c.poly([[8, 6], [16, 6], [18, 9], [6, 9]], M);
  c.rect(7, 9, 10, 9, G);
  c.rect(6, 18, 12, 3, M);
  c.rect(7, 9, 1, 9, Br); c.rect(16, 9, 1, 9, Br); c.rect(11, 9, 2, 9, Br);
  flameAt(c, 12, 16, 5, 1.5);
  c.o(8, 10, "#ffffff");
  c.glow("#ffd070", 2, 0.4);
}

function candle(c: Ic) {
  const Wx = tone("#efe6cc", { gr: 0.8 }), D = tone(C.brass, { shiny: true });
  c.ell(12, 20.5, 8, 2, D);
  c.rect(9, 9, 6, 12, Wx);
  c.set(8, 11, Wx); c.set(8, 12, Wx); c.set(15, 10, Wx); c.set(15, 11, Wx); c.set(15, 12, Wx); c.set(15, 13, Wx);
  c.rect(12, 7, 1, 2, "#3a2a24");
  flameAt(c, 12.5, 6.2, 5, 1.8);
  c.glow("#ffd070", 2, 0.35);
}

function tinderbox(c: Ic) {
  const Fr = tone("#9a6a3e"), Tp = tone("#c08a52"), Sd = tone("#6e4528"), St = tone(C.iron, { shiny: true }), Fl = tone("#8e8a94");
  c.rect(2, 12, 12, 9, Fr);
  c.poly([[2, 12], [14, 12], [17, 9], [5, 9]], Tp);
  c.poly([[14, 12], [17, 9], [17, 18], [14, 21]], Sd);
  c.orect(2, 14, 12, 1, rgba("#2a1408", 0.5));
  c.orect(7, 15, 2, 2, C.brass);
  // flint
  c.poly([[15, 22], [17, 17], [21, 16], [22, 21]], Fl);
  c.o(18, 18, "#c8c4d0"); c.o(19, 17, "#d8d4e0");
  // fire steel striker (C shape)
  c.ring(18, 6, 4, 3, 1.4, St);
  c.rect(13, 5, 3, 3, null);
  c.post((p) => {
    for (const [x, y, a] of [[14, 11, 1], [16, 13, 0.9], [13, 9, 0.8], [18, 12, 0.7], [12, 12, 0.6]] as const) p.px(x, y, rgba(a > 0.85 ? "#fff6c0" : "#ffb030", a));
  });
}

function rope(c: Ic, k: Ctx) {
  const col = k.tint ?? "#c9a66b";
  const A = tone(col), B = tone(col), Cc = tone(col);
  c.ring(12, 13, 9.4, 7.6, 2.6, A);
  c.ring(12, 13.5, 6.6, 5, 2.4, B);
  c.ring(12, 14, 3.9, 2.7, 2, Cc);
  c.ofn((x, y) => ((Math.floor(x) - Math.floor(y) + 99) % 3 === 0 ? rgba("#4a2a10", 0.32) : undefined));
  // loose end
  const E = tone(col);
  c.line(18, 19, 21, 22, E); c.line(19, 19, 22, 22, E);
  c.o(22, 23, hs(col, 0.4)); c.o(21, 23, hs(col, 0.2));
}

function blanket(c: Ic, k: Ctx) {
  const col = k.tint ?? "#9c3b3b";
  const layers = [[3, 15, 6], [4, 10, 6], [5, 5, 6]] as const;
  for (const [x, y, h] of layers) {
    const T = tone(col, { gr: 0.6 });
    c.fn((px, py) => (px >= x && px <= 21 && py >= y && py <= y + h && !(px < x + 1.6 && (py < y + 1 || py > y + h - 1)) ? T : undefined));
  }
  c.ofn((x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    if (X % 5 === 2) return rgba("#f0d890", 0.45);
    if (Y % 5 === 3) return rgba("#1a1030", 0.25);
    return undefined;
  });
  for (let y = 6; y <= 21; y += 2) c.set(22, y, "#e8d8a8");
}

function key(c: Ic, k: Ctx) {
  const col = k.tint ?? C.brass;
  const K = tone(col, { shiny: true });
  c.ring(7.5, 7.5, 5, 5, 2.2, K);
  for (const [x, y] of [[7.5, 2], [2, 7.5]] as const) c.ball(x, y, 1.5, K);
  c.se(10, 10, 10, [K, K]);
  c.se(9, 11, 2, [K, K, K, K]);
  const L = loc(20, 20, SE);
  c.fn((x, y) => {
    const [u, v] = L(x, y);
    if (u < -6.5 || u > 0.8 || v < 0.6 || v > 4.6) return undefined;
    if (v > 2.6 && u > -4.2 && u < -2.4) return undefined;
    return K;
  });
  c.o(6, 4, hs(col, 0.8));
}

function gemShape(c: Ic, col: string, cx = 12, cy = 4, s = 1) {
  const T = tone(col);
  const P = (x: number, y: number): [number, number] => [cx + (x - 12) * s, cy + (y - 4) * s];
  c.poly([P(8, 4), P(12, 4), P(10, 9), P(3.5, 9)], T.l);
  c.poly([P(12, 4), P(16, 4), P(20.5, 9), P(14, 9)], T.b);
  c.poly([P(10, 9), P(12, 4), P(14, 9)], T.g);
  c.poly([P(3.5, 9), P(10, 9), P(12, 21)], T.b);
  c.poly([P(10, 9), P(14, 9), P(12, 21)], T.m);
  c.poly([P(14, 9), P(20.5, 9), P(12, 21)], T.s);
  return T;
}

function gem(c: Ic, k: Ctx) {
  const n = k.n;
  const col = k.tint ?? (/ruby/.test(n) ? "#d42a3a" : /emerald/.test(n) ? "#2aa84a" : /sapphire/.test(n) ? "#2a5ad8" : /diamond|crystal/.test(n) ? "#aee6f6" : /pearl|moon/.test(n) ? "#ece6f0" : "#d23a5a");
  gemShape(c, col);
  c.spark(9, 6, "#ffffff");
}

function vordakGem(c: Ic) {
  const T = gemShape(c, "#5a2a6e");
  void T;
  c.ofn((x, y) => (Math.hypot(x - 12, (y - 11) * 0.9) < 2.6 ? rgba("#ff3a2a", 0.75) : Math.hypot(x - 12, y - 11) < 3.8 ? rgba("#c02040", 0.35) : undefined));
  c.o(12, 11, "#ffd0a0");
  c.glow("#7a1a5a", 2, 0.45);
  c.spark(9, 6, "#ffb0c0");
}

function gemCluster(c: Ic) {
  const gems: [number, number, number, string][] = [[12, 8, 4.4, "#d42a3a"], [7, 16, 4.2, "#2aa84a"], [17, 16, 4.2, "#2a5ad8"]];
  for (const [x, y, r, col] of gems) {
    const T = tone(col, { shiny: true });
    c.ball(x, y, r, T);
    c.ofn((px, py) => (Math.hypot(px - x, py - y) < r && Math.abs(px - x - (py - y)) < 0.6 ? rgba("#ffffff", 0.2) : undefined));
  }
  c.spark(10, 6, "#ffffff"); c.spark(5, 14, "#ffffff"); c.spark(15, 14, "#ffffff");
}

function lorestone(c: Ic) {
  const L = tone("#8fe0f4"), M = tone("#5ab8e0"), D = tone("#3a7ac0");
  c.poly([[12, 1], [8, 6], [8, 17], [12, 22], [12, 1]], L.l);
  c.poly([[12, 1], [12, 22], [16, 17], [16, 6]], M.b);
  c.poly([[12, 1], [10, 6], [10, 17], [12, 22]], L.g);
  c.poly([[14, 6], [16, 6], [16, 17], [14, 18]], D.s);
  c.ofn((x, y) => (Math.hypot(x - 12, y - 12) < 2.2 ? rgba("#ffffff", 0.7) : undefined));
  c.glow("#8ff0ff", 3, 0.5);
  c.spark(5, 5, "#d0ffff", true); c.spark(19, 14, "#d0ffff"); c.spark(6, 19, "#d0ffff");
}

/** Necklace chain: a loop above the pendant, drawn thin after the outline. Call it last. */
function chain(c: Ic, cx: number, top: number, bail: number, rx: number, col: string) {
  const a = hs(col, 0.45), b = hs(col, -0.3), sh = rgba("#140c18", 0.6);
  const ry = (bail - top) * 0.62, cy = top + ry;
  const raw: [number, number][] = [];
  for (let s = 0; s <= 240; s++) {
    const t = Math.PI + (s / 240) * Math.PI;
    raw.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  for (const side of [-1, 1]) for (let s = 0; s <= 40; s++) { const t = s / 40; raw.push([cx + side * rx * (1 - t * 0.82), cy + (bail - cy) * t]); }
  const seen = new Set<string>(), pts: [number, number][] = [];
  for (const [x, y] of raw) { const P: [number, number] = [Math.round(x - 0.5), Math.round(y - 0.5)], key = P.join(); if (!seen.has(key)) { seen.add(key); pts.push(P); } }
  c.post((p, fx) => {
    for (const [x, y] of pts) if (!p.solid(fx(x), y + 1) && !seen.has(`${x},${y + 1}`)) p.px(fx(x), y + 1, sh);
    pts.forEach(([x, y]) => p.px(fx(x), y, (x + y) % 2 ? a : b));
  });
}

function starPendant(c: Ic, k: Ctx) {
  const S = tone(k.tint && !/crystal/.test(k.n) ? k.tint : "#bdf0ff", { shiny: true }), Ag = tone(C.silver, { shiny: true });
  c.ring(12, 10, 1.8, 1.8, 0.9, Ag);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3 : 7; pts.push([12 + Math.cos(a) * r, 16.3 + Math.sin(a) * r]); }
  c.poly(pts, S);
  c.ofn((x, y) => (c.at(Math.floor(x), Math.floor(y)) === S && x > 12 && y > 15 ? rgba("#3a7ab0", 0.25) : undefined));
  c.o(12, 16, "#ffffff");
  c.glow("#bff4ff", 2, 0.35);
  c.spark(9, 13, "#ffffff");
  chain(c, 12, 1, 9, 7, C.silver);
}

function amulet(c: Ic, k: Ctx) {
  const metal = k.tint && /gold|silver|bronze|iron/.test(k.n) ? k.tint : C.gold;
  const gemc = k.tint && !/gold|silver|bronze|iron/.test(k.n) ? k.tint : "#3a8ad8";
  const M = tone(metal, { shiny: true });
  c.ring(12, 10, 1.8, 1.8, 0.9, M);
  c.ball(12, 16, 5.8, M);
  c.ring(12, 16, 4.4, 4.4, 0.9, rgba("#5a3008", 0.25));
  c.ball(12, 16, 2.6, tone(gemc, { shiny: true }));
  c.spark(9, 13, "#ffffff");
  chain(c, 12, 1, 9, 7, metal);
}

function ringBand(c: Ic, col: string) {
  const M = tone(col, { shiny: true });
  c.ring(12, 15, 7, 6.4, 2.2, M);
  return M;
}
function ring(c: Ic, k: Ctx) {
  const metal = k.tint && /gold|silver|bronze|iron|black/.test(k.n) ? k.tint : C.gold;
  const gc = k.tint && !/gold|silver|bronze|iron|black/.test(k.n) ? k.tint : "#d42a4a";
  const M = ringBand(c, metal);
  c.rect(9, 7, 6, 3, M);
  c.ball(12, 5.6, 3.2, tone(gc, { shiny: true }));
  c.set(9, 5, M); c.set(15, 5, M);
  c.spark(10, 4, "#ffffff");
}
function signet(c: Ic) {
  const M = ringBand(c, C.gold);
  c.rect(8, 8, 8, 2, M);
  const F = tone(hs(C.gold, 0.05), { shiny: true });
  c.ell(12, 6.5, 6.2, 4.2, F);
  c.ell(12, 6.5, 4.4, 2.8, "#9a6418");
  // hammer of Hammerdal, raised on the seal face
  const e = "#ffe48a", es = "#d89a30";
  c.orect(9, 4, 6, 2, e); c.orect(11, 6, 2, 3, e); c.o(14, 5, es); c.o(12, 8, es); c.o(9, 5, es);
  c.spark(8, 4, "#fff6c0");
}

function coins(c: Ic, k: Ctx) {
  const col = k.tint && /silver|bronze|copper/.test(k.n) ? k.tint : C.gold;
  for (let i = 0; i < 4; i++) {
    const y = 19 - i * 2.4;
    const Sd = tone(hs(col, -0.2)), Tp = tone(col, { shiny: true });
    c.ell(9, y + 1.2, 6.4, 2.4, Sd);
    c.ell(9, y, 6.4, 2.4, Tp);
  }
  const F = tone(col, { shiny: true });
  c.ball(16.5, 13.5, 5.6, F);
  c.ring(16.5, 13.5, 4.3, 4.3, 0.8, rgba("#6a3a08", 0.35));
  // crown emblem
  const e = hs(col, -0.45);
  c.orect(15, 14, 4, 2, e); c.o(15, 13, e); c.o(17, 12, e); c.o(18, 13, e); c.o(16, 13, e);
  c.spark(14, 10, "#ffffff");
}

function crown(c: Ic, k: Ctx) {
  const M = tone(k.tint ?? C.gold, { shiny: true }), B = tone(hs(k.tint ?? C.gold, -0.1));
  c.poly([[3, 7], [7, 13], [12, 5], [17, 13], [21, 7], [20, 16], [4, 16]], M);
  c.rect(4, 15, 17, 4, B);
  for (const [x, y] of [[3, 6], [12, 4], [21, 6]] as const) c.ball(x, y, 1.4, M);
  c.ball(12, 17, 1.4, tone("#d42a3a", { shiny: true })); c.ball(7, 17, 1.1, tone("#3a6ad8", { shiny: true })); c.ball(17, 17, 1.1, tone("#3a6ad8", { shiny: true }));
  c.spark(9, 9, "#ffffff");
}

function idol(c: Ic, k: Ctx) {
  const M = tone(k.tint ?? C.gold, { shiny: true }), S = tone("#7a7480");
  c.rect(5, 19, 14, 3, S);
  c.poly([[9, 10], [15, 10], [17, 19], [7, 19]], M);
  c.ball(12, 7, 3.4, M);
  c.rect(10, 12, 4, 1, hs(k.tint ?? C.gold, -0.4));
  c.o(11, 7, "#e02a2a"); c.o(13, 7, "#e02a2a");
  c.line(9, 13, 14, 15, rgba("#5a3008", 0.4), true); c.line(15, 13, 10, 15, rgba("#5a3008", 0.4), true);
}

function skull(c: Ic, k: Ctx) {
  const B = tone(k.tint ?? C.bone, { gr: 1 }), J = tone(k.tint ?? C.bone);
  c.ell(12, 10, 7.6, 7, B);
  c.rect(8, 15, 8, 5, J);
  const d = "#2a1e22";
  c.ell(8.8, 11, 2, 2.3, d); c.ell(15.2, 11, 2, 2.3, d);
  c.set(11, 14, d); c.set(12, 14, d); c.set(11, 15, d); c.set(12, 15, d);
  for (const x of [9, 11, 13]) c.o(x, 18, hs(C.bone, -0.5));
  c.orect(9, 17, 6, 1, hs(C.bone, -0.4));
  c.o(8, 10, "#c0504a");
}

function bone(c: Ic, k: Ctx) {
  const B = tone(k.tint ?? C.bone);
  c.ne(6, 17, 12, [B, B]);
  for (const [x, y] of [[4.5, 17], [7, 20.5], [17, 3.5], [20.5, 6]] as const) c.ball(x, y, 2.4, B);
}

function feather(c: Ic, k: Ctx) {
  const col = k.tint ?? "#e8e2d2";
  const V = tone(col, { gr: 0.7 }), Q = tone(hs(col, 0.2));
  const L = loc(4, 20, NE);
  c.fn((x, y) => {
    const [u, v0] = L(x, y), v = v0 + Math.pow(Math.max(0, u - 3) / 18, 2) * 4;
    if (u < 3 || u > 22) return undefined;
    const w = 3.6 * Math.sin(Math.PI * Math.pow((u - 3) / 19, 0.7));
    return Math.abs(v) <= w ? V : undefined;
  });
  c.ofn((x, y) => { const [u, v0] = L(x, y), v = v0 + Math.pow(Math.max(0, u - 3) / 18, 2) * 4; return Math.abs(v) < 0.5 ? hs(col, 0.5) : Math.abs(Math.sin(u * 1.1 + v * 0.9)) < 0.18 && Math.abs(v) > 1.2 ? hs(col, -0.35) : undefined; });
  c.ne(3, 21, 3, [Q]);
  c.ofn((x, y) => { const [u] = L(x, y); return u > 16 ? rgba("#6a4a3a", 0.35) : undefined; });
}

function horn(c: Ic, k: Ctx) {
  const col = k.tint ?? "#e2d4b0";
  const H = tone(col, { gr: 1 }), Bd = tone(C.brass, { shiny: true });
  const P = (t: number): [number, number] => {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t;
    return [a * 3 + b * 7 + cc * 19, a * 6 + b * 21 + cc * 9];
  };
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, [x, y] = P(t), r = 0.9 + 3.4 * t * t;
    const band = (t > 0.36 && t < 0.42) || (t > 0.7 && t < 0.76) || t > 0.95;
    c.ell(x, y, r, r, band ? Bd : H);
  }
  c.ell(19.5, 9, 2, 3, "#3a2a20");
  c.ball(3, 6, 1.4, Bd);
}

function sceptre(c: Ic, k: Ctx) {
  const M = tone(C.gold, { shiny: true }), O = tone(k.tint ?? "#8a3ad8", { shiny: true });
  c.ne(4, 20, 12, [M, M]);
  c.ball(4, 21.3, 1.8, M);
  c.ball(11, 13, 1.8, M);
  c.ball(17.5, 6.5, 3.6, O);
  for (const [x, y] of [[13, 7], [16, 11], [14, 4], [19, 10]] as const) c.set(x, y, M);
  c.spark(16, 4, "#ffffff");
}

function wand(c: Ic, k: Ctx) {
  const W = tone(C.dwood), T = tone(k.tint ?? "#9ae0ff", { shiny: true });
  c.ne(4, 20, 12, [W, W]);
  c.ne(4, 20, 3, [tone(C.silver), tone(C.silver)]);
  c.ball(17.5, 6.5, 2, T);
  c.glow(k.tint ?? "#9ae0ff", 2, 0.4);
  c.spark(20, 3, "#ffffff", true); c.spark(13, 4, "#ffffff"); c.spark(21, 10, "#ffffff");
}

function orb(c: Ic, k: Ctx) {
  const O = tone(k.tint ?? "#7a5ae0", { shiny: true }), M = tone(C.gold, { shiny: true });
  c.ell(12, 20, 6, 2, M);
  c.poly([[8, 18], [16, 18], [14, 15], [10, 15]], M);
  c.ball(12, 10, 6.8, O);
  c.ofn((x, y) => (Math.hypot(x - 13, y - 11) < 2 ? rgba("#ffffff", 0.35) : undefined));
  c.glow(k.tint ?? "#9a7af0", 2, 0.3);
  c.spark(9, 6, "#ffffff");
}

function casket(c: Ic, k: Ctx) {
  const W = tone(k.tint ?? "#8c5a32", { gr: 1 }), Ld = tone(hs(k.tint ?? "#8c5a32", 0.1)), M = tone(C.gold, { shiny: true });
  c.rect(3, 11, 18, 10, W);
  c.fn((x, y) => (x >= 3 && x <= 21 && y >= 5 && y < 11 && ((x - 12) / 9.2) ** 2 + ((y - 11) / 6) ** 2 <= 1 ? Ld : undefined));
  c.rect(6, 6, 2, 15, M); c.rect(16, 6, 2, 15, M);
  c.rect(3, 10, 18, 1, M);
  c.rect(10, 10, 4, 5, M);
  c.o(11, 12, "#2a1a10"); c.o(12, 12, "#2a1a10"); c.o(11, 13, "#2a1a10");
  c.spark(5, 7, "#fff6c0");
}

/* ================================================================== item table */

type Draw = (c: Ic, k: Ctx) => void;

const RULES: [RegExp, Draw][] = [
  [/sommerswerd|sun ?sword/, sommerswerd],
  [/broad ?sword|great ?sword|claymore|two-handed|bastard/, broadsword],
  [/short ?sword|gladius/, shortSword],
  [/dagger|knife|dirk|stiletto|\bkris\b/, dagger],
  [/giak.*spear|spear.*giak|barbed/, giakSpear],
  [/spear|lance|\bpike|javelin|trident|halberd|glaive/, spear],
  [/war ?hammer|\bhammer\b|\bmaul\b/, warhammer],
  [/\bmace|morning ?star|flail/, mace],
  [/\bclub|cudgel|bludgeon|cosh/, club],
  [/quarter ?staff|\bstaff\b|\bstave\b/, staff],
  [/quiver/, quiver],
  [/\b(long|short|cross)?bows?\b/, bow],
  [/arrow|\bbolts?\b|\bdarts?\b/, arrow],
  [/axe\b|\baxe|hatchet|cleaver/, axe],
  [/sword|blade|sabre|saber|scimitar|rapier|falchion|cutlass/, sword],
  [/shield|buckler/, shield],
  [/helm|\bcap\b|coif/, helmet],
  [/chain ?mail|\bmail\b|hauberk|plate|armou?r|cuirass|breastplate|brigandine/, chainmail],
  [/waistcoat|jerkin|\bvest\b|tunic|padded|gambeson|jacket/, leatherVest],
  [/alether|potion|elixir|draught|philt|tonic|\bbrew\b|remedy|\bvials?\b|phial/, potion],
  [/laumspur|herb|\broots?\b|\bleaf|leaves|\bweed|flower|moss|mushroom|fungus|plant|sprig|\boede\b|petal|blossom/, herb],
  [/ration|provision/, (c) => rations(c)],
  [/\bmeals?\b|food|bread|loaf|cheese|\bmeat|fruit|apple|jerky|biscuit|\bcake/, (c) => meal(c)],
  [/\bkeys?\b/, key],
  [/vordak/, (c) => vordakGem(c)],
  [/tomb guardian|\bgems\b|jewels/, (c) => gemCluster(c)],
  [/lore ?stone|lore-?circle/, (c) => lorestone(c)],
  [/star.*(pendant|amulet|necklace)|(pendant|amulet|necklace).*star/, starPendant],
  [/pendant|amulet|necklace|talisman|medallion|locket|brooch|charm|\btorc\b|\bmedal\b|insignia|badge/, amulet],
  [/fire-?sphere|fire ?ball|fire ?orb|ember/, (c) => fireSphere(c)],
  [/\bmaps?\b|\bchart\b|atlas/, (c) => map(c)],
  [/scroll|parchment|scripture/, scroll],
  [/letter|message|\bnote\b|missive|dispatch|envelope|\bpage\b|document|\bdeed\b|warrant/, letter],
  [/book|tome|journal|diary|codex|grimoire|manual|almanac|ledger/, book],
  [/seal|signet/, (c) => signet(c)],
  [/(^|[\s-])(ear|finger)?rings?\b/, ring],
  [/torch|firebrand/, (c) => torch(c)],
  [/lantern|\blamp\b/, (c) => lantern(c)],
  [/candle/, (c) => candle(c)],
  [/tinder|flint|matches|fire ?starter/, (c) => tinderbox(c)],
  [/\brope|\bcord\b|twine|grapnel|grappling/, rope],
  [/soap/, soap],
  [/blanket|bedroll|sleeping/, blanket],
  [/flask|water|canteen|waterskin|wineskin|\boil\b|\bskin\b/, flask],
  [/bottle|\bjug\b|wine|\bale\b|brandy|spirits/, bottle],
  [/ointment|salve|\bbalm\b|unguent|cream|\bjar\b|\bpot\b|poultice/, ointment],
  [/\bfurs?\b|\bpelts?\b|\bhide\b/, furs],
  [/cloak|\bcape\b|\brobes?\b|mantle|shawl|\bhood\b/, (c, k) => cloak(c, k, /surgeon|healer|physician/.test(k.n))],
  [/boots?\b|shoes|sandals/, boots],
  [/gloves?\b|gauntlets?/, gloves],
  [/\bcrown\b|tiara|circlet|diadem/, crown],
  [/crowns|coins?\b|\bgold\b|money|\blune|nobles|ducats|kika|treasure/, coins],
  [/backpack|\bpack\b|rucksack|knapsack/, backpack],
  [/\bbag\b|pouch|\bsack\b|purse|satchel|\bpowder\b|\bdust\b|\bsalt\b/, pouch],
  [/idol|statue|statuette|figurine|effigy|totem/, idol],
  [/skull/, skull],
  [/\bbones?\b/, bone],
  [/feather|quill|plume/, feather],
  [/\bhorn\b|bugle|trumpet|\btusk/, horn],
  [/sceptre|scepter|\brod\b/, sceptre],
  [/\bwand\b/, wand],
  [/\borb\b|sphere|globe|crystal ball/, orb],
  [/\bgem|jewel|stone|crystal|diamond|ruby|emerald|sapphire|pearl|opal|shard|prism|topaz|amber/, gem],
  [/\bbox\b|casket|chest|coffer|reliquary/, casket],
];

function drawItem(key: string, type: ItemType | undefined, S = 24): HTMLCanvasElement {
  const n = key.toLowerCase().replace(/[’']/g, "'").trim();
  const tint = TINTS.find(([re]) => re.test(n))?.[1];
  const k: Ctx = { n, tint, type };
  const c = new Ic(S);
  const rule = RULES.find(([re]) => re.test(n));
  if (rule) rule[1](c, k);
  else if (type === "weapon") sword(c, k);
  else if (type === "meal") meal(c);
  else if (type === "backpack") pouch(c, k);
  else casket(c, { ...k, tint: undefined });
  return c.render();
}

const itemCache = memo((k: string) => { const [type, ...rest] = k.split("|"); return drawItem(rest.join("|"), (type || undefined) as ItemType | undefined); });

/** 24x24 icon for an item, by its English name (transparent, cached). */
export function itemIcon(key: string, type?: ItemType): HTMLCanvasElement {
  return itemCache(`${type ?? ""}|${key}`);
}

/* ================================================================== UI icons (16x16) */

function heartFn(c: Ic, cx: number, cy: number, s: number, v: Cell) {
  c.fn((x, y) => {
    const X = (x - cx) / s, Y = -(y - cy) / s;
    return (X * X + Y * Y - 1) ** 3 - X * X * Y * Y * Y <= 0 ? v : undefined;
  });
}

const UI: Record<UiIcon, (c: Ic) => void> = {
  cs: (c) => swordAt(c, { gx: 5, gy: 11, len: 9, w: 3, gh: 2, grip: 2, blade: C.steel, hilt: C.brass, gripC: C.dleather }),
  ep: (c) => { heartFn(c, 8, 8.4, 6.6, tone("#e03a48", { gr: 1.3 })); c.o(4, 5, "#ffd0d4"); c.o(5, 4, "#ffffff"); },
  epMax: (c) => {
    heartFn(c, 7.5, 8, 6.2, tone("#e03a48", { gr: 1.3 }));
    c.o(4, 5, "#ffd0d4"); c.o(5, 4, "#ffffff");
    const G = tone(C.gold, { shiny: true });
    c.rect(11, 9, 3, 7, G); c.rect(9, 11, 7, 3, G);
  },
  gold: (c) => {
    for (let i = 0; i < 3; i++) { const y = 13 - i * 2; c.ell(6, y + 1, 4.6, 1.8, tone(hs(C.gold, -0.2))); c.ell(6, y, 4.6, 1.8, tone(C.gold, { shiny: true })); }
    c.ball(11.5, 8.5, 4, tone(C.gold, { shiny: true }));
    c.orect(11, 8, 2, 2, hs(C.gold, -0.4));
  },
  meal: (c) => {
    const M = tone("#c8743a", { gr: 1.2 }), B = tone(C.bone);
    const L = loc(10, 6, SE + Math.PI / 2);
    c.fn((x, y) => { const [u, v] = L(x, y); return (u / 5.2) ** 2 + (v / 4.2) ** 2 <= 1 ? M : undefined; });
    c.se(4, 10, 3, [B, B]);
    c.ball(2.8, 13, 1.5, B); c.ball(4.5, 14.5, 1.5, B);
    c.o(9, 4, "#ffd8a0"); c.o(8, 5, "#f0b070");
  },
  arrows: (c) => {
    for (const [x, y] of [[1, 12], [4, 14]] as const) {
      const W = tone(C.wood), H = tone(C.steel, { shiny: true }), F = tone("#e04a3a");
      c.ne(x, y, 9, [W]);
      c.set(x + 9, y - 9, H); c.set(x + 10, y - 10, H); c.set(x + 9, y - 10, H); c.set(x + 10, y - 9, H); c.set(x + 8, y - 10, H); c.set(x + 10, y - 8, H);
      c.set(x, y - 1, F); c.set(x + 1, y + 0, F); c.set(x + 1, y - 2, F); c.set(x + 2, y, F);
    }
  },
  backpack: (c) => {
    const L = tone(C.leather, { gr: 1.1 }), F = tone(hs(C.leather, -0.12)), S = tone(C.strap), Bk = tone(C.brass);
    c.fn((x, y) => (x >= 2 && x <= 14 && y >= 3 && y <= 15 && !((x < 3 || x > 13) && (y < 4 || y > 14)) ? L : undefined));
    c.fn((x, y) => (x >= 3 && x <= 13 && y >= 3 && y <= 9 && (y < 7 || ((x - 8) / 5.5) ** 2 + ((y - 7) / 2.2) ** 2 <= 1) ? F : undefined));
    c.ring(8, 2.4, 2.4, 1.8, 0.9, S);
    c.rect(7, 8, 2, 2, Bk);
    c.rect(4, 11, 8, 4, tone(hs(C.leather, 0.05)));
  },
  weapons: (c) => {
    swordAt(c, { gx: 4, gy: 11, len: 10, w: 2, gh: 2, grip: 2, blade: C.steel, hilt: C.brass, gripC: C.dleather });
    c.flip = true;
    swordAt(c, { gx: 4, gy: 11, len: 10, w: 2, gh: 2, grip: 2, blade: C.steel, hilt: C.brass, gripC: C.dleather });
    c.flip = false;
  },
  special: (c) => {
    const T = tone("#a05ae0");
    c.poly([[5, 3], [11, 3], [14, 6.5], [2, 6.5]], T.l);
    c.poly([[8, 3], [11, 3], [14, 6.5], [9.5, 6.5]], T.b);
    c.poly([[2, 6.5], [8, 6.5], [8, 15]], T.b);
    c.poly([[8, 6.5], [14, 6.5], [8, 15]], T.s);
    c.poly([[6, 6.5], [10, 6.5], [8, 15]], T.m);
    c.spark(5, 4, "#ffffff");
    c.spark(14, 2, "#ffe8ff");
  },
  map: (c) => {
    const A = tone("#efdfb3", { gr: 0.5 }), B = tone("#d6c08c", { gr: 0.5 });
    c.rect(1, 3, 5, 11, A); c.rect(6, 4, 5, 11, B); c.rect(11, 3, 4, 11, A);
    const red = "#c8302c";
    c.o(3, 11, red); c.o(5, 10, red); c.o(7, 9, red); c.o(9, 8, red);
    c.o(11, 6, red); c.o(13, 6, red); c.o(12, 7, red); c.o(11, 8, red); c.o(13, 8, red);
    c.o(3, 6, "#6a4a2a"); c.o(2, 7, "#6a4a2a"); c.o(4, 7, "#6a4a2a");
  },
  book: (c) => {
    const Cv = tone("#8a3038", { gr: 1 }), Sp = tone(hs("#8a3038", -0.18)), Pg = tone("#efe6cc");
    c.rect(4, 12, 11, 2, Pg);
    c.rect(4, 2, 11, 10, Cv);
    c.rect(2, 2, 2, 13, Sp);
    c.rect(3, 14, 12, 1, Sp);
    c.orect(8, 5, 4, 3, hs(C.gold, 0.1)); c.orect(9, 6, 2, 1, "#8a3038");
  },
  save: (c) => {
    const P = tone(C.paper, { gr: 0.6 });
    c.rect(1, 4, 10, 11, P);
    for (const y of [7, 9, 11]) c.orect(3, y, 6, 1, rgba("#6a4a2a", 0.5));
    const F = tone("#f2f0ea", { gr: 0.5 });
    const L = loc(6, 13, NE);
    c.fn((x, y) => { const [u, v] = L(x, y); if (u < 2 || u > 13) return undefined; return Math.abs(v + 0.5) <= 2.2 * Math.sin(Math.PI * (u - 2) / 11) ? F : undefined; });
    c.ne(5, 14, 3, ["#3a2a24"]);
    c.o(4, 15, "#1a1018");
  },
  menu: (c) => { for (const y of [3, 7, 11]) c.rect(2, y, 12, 2, tone("#ead9b0")); },
  back: (c) => { const T = tone("#ead9b0"); c.poly([[1, 8], [7, 2], [7, 5.5], [14, 5.5], [14, 10.5], [7, 10.5], [7, 14]], T); },
  close: (c) => { const T = tone("#e0504a"); c.se(2, 2, 11, [T, T, T]); c.flip = true; c.se(2, 2, 11, [T, T, T]); c.flip = false; },
  dice: (c) => {
    const F = tone("#f2ede2", { gr: 0.5 }), Tp = tone("#ffffff"), Sd = tone("#c8c0b0");
    c.rect(1, 5, 10, 10, F);
    c.poly([[1, 5], [11, 5], [15, 1], [5, 1]], Tp);
    c.poly([[11, 5], [15, 1], [15, 11], [11, 15]], Sd);
    const pip = "#b0202a";
    for (const [x, y] of [[3, 7], [6, 10], [8, 12], [8, 7], [3, 12]] as const) c.o(x, y, pip);
    c.o(9, 3, pip); c.o(13, 8, "#5a2020");
  },
  skull: (c) => {
    const B = tone(C.bone, { gr: 1 });
    c.ell(8, 7, 6.2, 5.8, B); c.rect(5, 11, 6, 4, tone(C.bone));
    const d = "#2a1e22";
    c.ell(5.5, 7.8, 1.6, 1.8, d); c.ell(10.5, 7.8, 1.6, 1.8, d);
    c.set(7, 10, d); c.set(8, 10, d);
    c.o(6, 13, hs(C.bone, -0.5)); c.o(8, 13, hs(C.bone, -0.5)); c.o(10, 13, hs(C.bone, -0.5));
  },
  trophy: (c) => {
    const G = tone(C.gold, { shiny: true });
    c.fn((x, y) => (y >= 1 && y <= 8 && ((x - 8) / 5) ** 2 + ((y - 1) / 7.4) ** 2 <= 1 ? G : undefined));
    c.ring(3, 4.5, 2.4, 2.6, 1, G); c.ring(13, 4.5, 2.4, 2.6, 1, G);
    c.rect(7, 8, 2, 4, G);
    c.rect(4, 12, 8, 3, tone(hs(C.gold, -0.15)));
    c.o(5, 3, "#fff6c0");
  },
  lock: (c) => {
    const S = tone(C.silver, { shiny: true }), B = tone(C.gold, { shiny: true });
    c.ring(8, 6, 4.6, 5, 1.6, S);
    c.rect(2, 7, 12, 8, B);
    c.o(7, 10, "#2a1a10"); c.o(8, 10, "#2a1a10"); c.o(7, 11, "#2a1a10"); c.o(8, 11, "#2a1a10"); c.o(7, 12, "#2a1a10");
  },
  flee: (c) => {
    const Fr = tone(C.dwood);
    c.rect(1, 1, 9, 14, Fr);
    c.rect(3, 3, 5, 12, "#120e18");
    const A = tone("#5ac85a");
    c.poly([[5, 6.5], [10, 6.5], [10, 3], [15, 8], [10, 13], [10, 9.5], [5, 9.5]], A);
  },
  shield: (c) => {
    const R = tone(C.steel, { shiny: true }), F = tone("#2f5fb6", { gr: 1.2 }), G = tone(C.gold, { shiny: true });
    const hw = (y: number, s: number) => (y < 7 ? 6.6 : 6.6 * Math.sqrt(Math.max(0, 1 - ((y - 7) / 8.2) ** 2))) - s;
    c.fn((x, y) => (y >= 1 && Math.abs(x - 8) <= hw(y, 0) ? R : undefined));
    c.fn((x, y) => (y >= 2.4 && Math.abs(x - 8) <= hw(y, 1.4) && y < 13.6 ? F : undefined));
    c.rect(7, 3, 2, 10, G); c.rect(3, 6, 10, 2, G);
  },
  mind: (c) => {
    const P = tone("#e890b8", { gr: 1 }), Q = tone("#d87aa8");
    c.ell(5.5, 8, 4.6, 5.6, P); c.ell(10.5, 8, 4.6, 5.6, Q);
    c.ofn((x, y) => { const s = Math.sin(x * 1.7 + Math.sin(y * 1.3) * 2); return Math.abs(s) < 0.22 ? rgba("#7a2a5a", 0.6) : undefined; });
    c.line(8, 3, 8, 13, rgba("#7a2a5a", 0.7), true);
    c.o(3, 5, "#ffe0f0");
  },
  heal: (c) => { const G = tone("#3fba5a", { gr: 1 }); c.rect(5, 1, 6, 14, G); c.rect(1, 5, 14, 6, G); c.o(6, 2, "#d8ffd8"); c.o(2, 6, "#d8ffd8"); },
  potion: (c) => {
    const G = tone(C.glass), L = tone("#d93a44"), Ck = tone(C.cork);
    c.rect(6, 1, 4, 3, Ck); c.rect(6, 4, 4, 3, G);
    c.ball(8, 10.5, 5, G);
    c.ball(8, 10.5, 5, L, (_x, y) => y > 9);
    c.o(5, 9, "#ffffff"); c.o(5, 10, "#ffffff"); c.o(6, 8, "#ffffff");
  },
  music: (c) => {
    const N = tone("#ead9b0");
    c.ell(4, 13, 2.6, 2, N); c.ell(12, 11, 2.6, 2, N);
    c.rect(6, 3, 1, 10, N); c.rect(14, 1, 1, 10, N);
    c.poly([[6, 2.5], [15, 0.5], [15, 3.5], [6, 5.5]], N);
  },
  sound: (c) => {
    const S = tone("#ead9b0");
    c.rect(1, 5, 4, 6, S); c.poly([[4, 5], [9, 1], [9, 15], [4, 11]], S);
    c.post((p) => {
      for (const [r, a] of [[3, 1], [5.5, 0.8]] as const)
        for (let t = -0.9; t <= 0.9; t += 0.1) p.px(Math.round(10 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), rgba("#ead9b0", a));
    });
  },
  settings: (c) => {
    const G = tone("#b8bfcc", { shiny: true });
    c.fn((x, y) => {
      const r = Math.hypot(x - 8, y - 8), a = Math.atan2(y - 8, x - 8);
      const tooth = Math.cos(a * 8) > 0.3;
      return r <= (tooth ? 7.4 : 5.6) && r > 2.2 ? G : undefined;
    });
  },
  chart: (c) => {
    c.rect(2, 9, 3, 5, tone("#5a9ae0")); c.rect(7, 5, 3, 9, tone("#5ac87a")); c.rect(12, 2, 3, 12, tone(C.gold));
    c.rect(1, 14, 15, 1, tone("#ead9b0"));
  },
  info: (c) => {
    c.ball(8, 8, 7, tone("#3f74d4", { shiny: true }));
    c.orect(7, 6, 2, 6, "#ffffff"); c.orect(7, 3, 2, 2, "#ffffff"); c.orect(6, 11, 4, 1, "#ffffff");
  },
  user: (c) => {
    const S = tone("#ead9b0");
    c.ball(8, 5, 3.6, S);
    c.fn((x, y) => (y >= 10 && ((x - 8) / 6.4) ** 2 + ((y - 15.5) / 5.6) ** 2 <= 1 ? tone("#ead9b0") : undefined));
  },
};

const uiCache = memo((n: string) => { const c = new Ic(16); UI[n as UiIcon](c); return c.render(); });
/** 16x16 interface icon. */
export function uiIcon(name: UiIcon): HTMLCanvasElement { return uiCache(name); }

/* ================================================================== discipline icons (24x24) */

function eyeShape(c: Ic, cx: number, cy: number, w: number, h: number, iris: string) {
  const W = tone("#f4efe6");
  c.fn((x, y) => (Math.abs(y - cy) <= h * (1 - ((x - cx) / w) ** 2) ? W : undefined), cx - w, cy - h - 1, cx + w, cy + h + 1);
  c.ball(cx, cy, Math.min(h, 3.2), tone(iris, { shiny: true }));
  c.set(Math.floor(cx), Math.floor(cy), "#100c18"); c.set(Math.floor(cx) - 1, Math.floor(cy), "#100c18");
  c.o(Math.floor(cx) - 2, Math.floor(cy) - 2, "#ffffff");
}

function headProfile(c: Ic, col: string) {
  const H = tone(col, { gr: 1 });
  c.ell(8.5, 10, 5.8, 6.4, H);
  c.poly([[12, 9], [15, 13], [13, 14], [13, 16], [11, 18], [5, 18], [4, 22], [12, 22], [12, 18]], H);
  c.poly([[3, 16], [11, 16], [12, 22], [3, 22]], H);
  return H;
}

function shieldShape(c: Ic, rim: string, field: string) {
  const Rm = tone(rim, { shiny: true }), F = tone(field, { gr: 1.3 });
  const hw = (y: number, sh: number) => (y < 11 ? 8.4 : 8.4 * Math.sqrt(Math.max(0, 1 - ((y - 11) / 11) ** 2))) - sh;
  c.fn((x, y) => (y >= 2.5 && Math.abs(x - 12) <= hw(y, 0) ? Rm : undefined));
  c.fn((x, y) => (y >= 4 && y <= 20.3 && Math.abs(x - 12) <= hw(y, 1.6) ? F : undefined));
}

function bubble(c: Ic, col: string) {
  c.ring(12, 12, 10.5, 10.5, 1.6, tone(hs(col, 0.25), { shiny: true }));
  c.fn((x, y) => (Math.hypot(x - 12, y - 12) < 9 ? rgba(col, 0.28) : undefined));
  c.ofn((x, y) => { const r = Math.hypot(x - 12, y - 12); return r < 9 && ((Math.floor(x) + Math.floor(y) * 2) % 6 === 0) ? rgba("#ffffff", 0.3) : undefined; });
  c.o(6, 6, "#ffffff"); c.o(7, 5, rgba("#ffffff", 0.7)); c.o(5, 7, rgba("#ffffff", 0.7));
}

function boltShape(c: Ic, col: string) {
  c.poly([[14, 1], [6, 13], [11, 13], [8, 23], [18, 9], [13, 9], [17, 1]], tone(col, { shiny: true, gr: 1.2 }));
}

function paw(c: Ic, cx: number, cy: number, col: string, s = 1) {
  const T = tone(col);
  c.ell(cx, cy + 1.4 * s, 2.5 * s, 2 * s, T);
  for (const [dx, dy] of [[-3.1, -1.9], [-1.15, -3.7], [1.15, -3.7], [3.1, -1.9]] as const) c.ell(cx + dx * s, cy + dy * s, 0.85 * s + 0.15, 1.05 * s + 0.15, tone(col));
}

function wolfHead(c: Ic, fur: string, eye: string) {
  const F = tone(fur, { gr: 1 }), M = tone(hs(fur, 0.35)), D = tone(hs(fur, -0.2));
  c.poly([[4, 2], [9, 8], [5, 11]], D); c.poly([[20, 2], [15, 8], [19, 11]], D);
  c.poly([[5, 8], [19, 8], [21, 13], [16, 18], [12, 22], [8, 18], [3, 13]], F);
  c.poly([[9, 13], [15, 13], [14, 19], [12, 21], [10, 19]], M);
  c.rect(11, 18, 2, 2, "#1a1418");
  c.set(8, 11, eye); c.set(9, 11, eye); c.set(15, 11, eye); c.set(14, 11, eye);
  c.o(8, 11, hs(eye, 0.6)); c.o(15, 11, hs(eye, 0.6));
  c.o(5, 4, hs(fur, 0.4)); c.o(18, 4, hs(fur, -0.4));
}

function crystalBall(c: Ic, col: string) {
  const M = tone(C.gold, { shiny: true });
  c.poly([[6, 22], [18, 22], [16, 18], [8, 18]], M);
  c.ball(12, 10.5, 8, tone(col, { shiny: true }));
  c.ofn((x, y) => { const r = Math.hypot(x - 13, y - 11); return r < 3 ? rgba("#ffffff", 0.5 - r * 0.12) : undefined; });
  c.glow(hs(col, 0.3), 2, 0.35);
  c.spark(8, 6, "#ffffff");
}

function openBook(c: Ic) {
  const P = tone(C.paper, { gr: 0.5 }), Q = tone(hs(C.paper, -0.06), { gr: 0.5 }), Cv = tone("#6a2a5a");
  c.poly([[1, 15], [11.5, 17], [11.5, 22], [1, 20]], Cv); c.poly([[12.5, 17], [23, 15], [23, 20], [12.5, 22]], Cv);
  c.poly([[2, 12], [11.5, 14], [11.5, 20], [2, 18]], P);
  c.poly([[12.5, 14], [22, 12], [22, 18], [12.5, 20]], Q);
  for (const y of [15, 17]) { c.line(4, y - 1, 10, y + 0, rgba("#6a4a2a", 0.45), true); c.line(14, y, 20, y - 1, rgba("#6a4a2a", 0.45), true); }
}

const DISC: Record<string, (c: Ic) => void> = {
  // ---------------------------------------------------------------- Kai
  camouflage: (c) => {
    const greens = ["#3f8a44", "#4f9e48", "#357a3c", "#5aac52", "#2f6e38"];
    const balls: [number, number, number][] = [[7, 14, 5.5], [17, 14, 5.5], [12, 8, 6], [5, 18, 4], [19, 18, 4], [12, 18, 5]];
    balls.forEach(([x, y, r], i) => c.ball(x, y, r, tone(greens[i % greens.length])));
    c.ofn((x, y) => (Math.sin(x * 2.1 + y * 1.7) > 0.93 ? rgba("#c8f0a0", 0.5) : undefined));
    c.rect(7, 12, 10, 3, "#14101a");
    c.rect(8, 13, 2, 1, "#f0e070"); c.rect(14, 13, 2, 1, "#f0e070");
  },
  hunting: (c) => {
    bow(c, { n: "" });
    arrowAt(c, 2, 20, 15, C.steel, "#d8453f");
  },
  sixthsense: (c) => {
    c.post((p) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        for (let r = 9; r <= 11; r++) p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r * 0.85), rgba("#ffd860", r === 9 ? 0.9 : 0.5));
      }
    });
    eyeShape(c, 12, 12, 9, 5, "#5a6ae0");
  },
  tracking: (c) => {
    paw(c, 7, 16.5, "#7a4e30", 1.45); paw(c, 16.5, 7.5, "#7a4e30", 1.45);
    c.post((p) => { for (const [x, y] of [[2, 23], [4, 22], [20, 14], [22, 13], [21, 1]] as const) p.px(x, y, rgba("#c8a070", 0.8)); });
  },
  healing: (c) => {
    const S = tone(C.skin, { gr: 1.1 });
    c.rect(7, 18, 9, 5, tone(hs(C.skin, -0.1)));
    c.fn((x, y) => (x >= 6 && x <= 17 && y >= 10 && y <= 19 && !(x > 16 && y > 18) ? S : undefined));
    for (const [x, top] of [[6, 4], [9, 2], [12, 2], [15, 4]] as const) c.fn((px, py) => (px >= x && px <= x + 2.2 && py >= top + 0.5 && py <= 11 && (py > top + 1.5 || Math.abs(px - x - 1.1) < 0.8) ? S : undefined));
    c.poly([[7, 12], [3, 8], [1.5, 10], [6, 17]], S);
    for (const x of [9, 12, 15]) c.line(x, 5, x, 10, rgba("#8a4a2a", 0.4), true);
    c.orect(10, 12, 3, 7, "#4fd06a"); c.orect(8, 14, 7, 3, "#4fd06a"); c.orect(11, 13, 1, 5, "#c8ffd0"); c.orect(9, 15, 5, 1, "#c8ffd0");
    c.glow("#6aff8a", 2, 0.45);
    c.spark(20, 4, "#d8ffd8", true); c.spark(3, 3, "#d8ffd8");
  },
  weaponskill: (c) => {
    sword(c, { n: "" });
    c.flip = true;
    axe(c, { n: "" });
    c.flip = false;
  },
  mindshield: (c) => {
    shieldShape(c, C.silver, "#5a3a9a");
    c.ofn((x, y) => { const r = Math.hypot(x - 12, y - 11), a = Math.atan2(y - 11, x - 12); return r < 6 && Math.abs(((a + r * 0.9 + 20 * Math.PI) % (Math.PI)) - Math.PI / 2) < 0.35 ? rgba("#d8b0ff", 0.85) : undefined; });
    c.glow("#b07aff", 2, 0.35);
  },
  mindblast: (c) => {
    headProfile(c, "#3a4a7a");
    c.o(10, 8, "#ff8ae0");
    c.post((p) => {
      for (const [r, a] of [[4, 1], [7, 0.85], [10, 0.6]] as const)
        for (let t = -0.8; t <= 0.8; t += 0.07) p.px(Math.round(12 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), rgba("#ff6ad8", a));
      p.px(13, 8, "#ffffff"); p.px(12, 8, "#ffd0f0");
    });
  },
  animalkinship: (c) => wolfHead(c, "#8e8e9e", "#f0c040"),
  mindovermatter: (c) => {
    c.poly([[6, 6], [12, 3], [18, 5], [19, 11], [14, 14], [7, 13]], tone("#8e8a94", { gr: 1.2 }));
    c.o(9, 6, "#d0ccd8"); c.o(15, 10, "#5a5662");
    c.post((p) => {
      for (const [ry, a] of [[1.6, 0.9], [2.3, 0.6]] as const) for (let x = 3; x <= 21; x++) {
        const t = (x - 12) / 9, y = Math.round(19 + ry * Math.sqrt(Math.max(0, 1 - t * t)) * (ry > 2 ? 1 : -1));
        p.px(x, y, rgba("#c07aff", a));
      }
      for (const [x, y] of [[4, 9], [20, 8], [5, 14], [19, 14]] as const) p.px(x, y, rgba("#d8b0ff", 0.8));
    });
    c.glow("#b07aff", 1, 0.3);
  },
  // ---------------------------------------------------------------- Magnakai
  weaponmastery: (c) => {
    const L = tone("#4f9e48");
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.62 + i * 0.3;
      leaf(c, 12 + Math.cos(a) * 9, 13 + Math.sin(a) * 8.5, a + Math.PI / 2 + 0.3, 3.4, 1.3, L);
      leaf(c, 12 - Math.cos(a) * 9, 13 + Math.sin(a) * 8.5, Math.PI - (a + Math.PI / 2 + 0.3), 3.4, 1.3, L);
    }
    const B = tone(C.silver, { shiny: true }), H = tone(C.gold, { shiny: true });
    c.rect(11, 2, 2, 14, B); c.set(11, 1, B);
    c.rect(7, 15, 10, 2, H); c.rect(11, 17, 2, 3, tone(C.dleather)); c.ball(12, 21, 1.6, H);
    c.spark(10, 4, "#ffffff");
  },
  animalcontrol: (c) => {
    const F = tone("#9a6a42", { gr: 1 }), Mn = tone("#3a2a24");
    c.poly([[9, 3], [11, 1], [13, 4], [17, 7], [21, 15], [20, 18], [16, 18], [12, 13], [11, 22], [4, 22], [6, 10]], F);
    c.poly([[9, 3], [6, 10], [4, 22], [2, 22], [3, 9], [6, 3]], Mn);
    c.ell(19, 16.5, 2.5, 2, tone(hs("#9a6a42", 0.15)));
    c.set(14, 8, "#100c10"); c.o(14, 7, "#ffffff");
    c.set(20, 16, "#3a2018");
  },
  curing: (c) => {
    heartFn(c, 12, 12.5, 9.5, tone("#e03a48", { gr: 1.3 }));
    const W = tone("#f4fff4");
    c.rect(11, 7, 3, 10, W); c.rect(7, 10, 11, 3, W);
    c.glow("#7aff9a", 2, 0.4);
    c.spark(5, 4, "#d8ffd8");
  },
  invisibility: (c) => {
    c.outline = false;
    const f = rgba("#9ad8ff", 0.16);
        c.fn((x, y) => (y >= 10 && y <= 22 && Math.abs(x - 12) <= 3 + (y - 10) * 0.45 ? f : undefined));
    c.fn((x, y) => (Math.hypot(x - 12, y - 6) <= 3.6 ? rgba("#9ad8ff", 0.22) : undefined));
    c.post((p) => {
      const pts: [number, number][] = [];
      for (let t = 0; t < 40; t++) { const a = (t / 40) * Math.PI * 2; pts.push([12 + Math.cos(a) * 4.4, 6 + Math.sin(a) * 4.4]); }
      for (let y = 10; y <= 22; y++) { const w = 3 + (y - 10) * 0.45 + 1; pts.push([12 - w, y], [12 + w, y]); }
      pts.forEach(([x, y], i) => i % 2 === 0 && p.px(Math.round(x), Math.round(y), rgba("#d8f4ff", 0.95)));
    });
  },
  huntmastery: (c) => {
    const rings = ["#e8e2d2", "#d23b3e", "#e8e2d2", "#d23b3e"];
    rings.forEach((col, i) => c.ell(10, 14, 9 - i * 2.2, 9 - i * 2.2, tone(col)));
    c.ofn((x, y) => (Math.hypot(x - 10, y - 14) < 9 ? undefined : undefined));
    arrowAt(c, 10, 14, 9, C.steel, "#3f9e4c");
  },
  pathsmanship: (c) => {
    const R = tone("#b8a070", { shiny: true });
    c.ring(12, 12, 9, 9, 1.6, R);
    c.poly([[12, 1], [14, 10], [12, 12], [10, 10]], tone("#d23b3e"));
    c.poly([[12, 23], [14, 14], [12, 12], [10, 14]], tone("#e8e2d2"));
    c.poly([[1, 12], [10, 10], [12, 12], [10, 14]], tone("#e8e2d2"));
    c.poly([[23, 12], [14, 10], [12, 12], [14, 14]], tone("#e8e2d2"));
    c.ball(12, 12, 1.5, tone(C.gold, { shiny: true }));
  },
  psisurge: (c) => {
    c.post((p) => {
      for (let t = 0; t < 70; t++) { const a = t * 0.18, r = 1.5 + t * 0.14; p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), rgba("#c070ff", 0.55)); }
    });
    boltShape(c, "#b04ae8");
    c.glow("#d080ff", 2, 0.45);
  },
  psiscreen: (c) => {
    bubble(c, "#6a8aff");
    eyeShape(c, 12, 12, 5.5, 3, "#7a4ad8");
  },
  nexus: (c) => {
    flameAt(c, 8, 20, 17, 5.2);
    const I = tone("#9ad8ff", { shiny: true });
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) { const dx = Math.cos(a) * 5, dy = Math.sin(a) * 5; c.line(17 - dx, 12 - dy, 17 + dx, 12 + dy, I); }
    for (const [x, y] of [[17, 7], [17, 17], [13, 9], [21, 15], [21, 9], [13, 15]] as const) { c.set(x, y, I); }
    c.spark(17, 12, "#ffffff");
  },
  divination: (c) => crystalBall(c, "#8a5ae0"),
  // ---------------------------------------------------------------- Grand Master / New Order
  grandweaponmastery: (c) => {
    swordAt(c, { gx: 7, gy: 17, len: 13, w: 3, gh: 3, grip: 3, blade: "#e8eef8", hilt: C.gold, gripC: "#3d5fae" });
    c.flip = true;
    swordAt(c, { gx: 7, gy: 17, len: 13, w: 3, gh: 3, grip: 3, blade: "#e8eef8", hilt: C.gold, gripC: "#3d5fae" });
    c.flip = false;
    c.ball(12, 10, 2.2, tone("#ff8a2a", { shiny: true }));
    c.glow("#ffd85a", 1, 0.45);
    c.spark(12, 3, "#fff1a0", true);
  },
  animalmastery: (c) => {
    const W = tone("#f2eee6", { gr: 1 }), Bd = tone("#6a4a32"), Bk = tone("#f0b830", { shiny: true });
    c.poly([[2, 22], [5, 12], [9, 5], [15, 3], [19, 7], [18, 12], [14, 16], [12, 22]], Bd);
    c.poly([[5, 12], [9, 5], [15, 3], [19, 7], [18, 11], [13, 13], [8, 15]], W);
    c.poly([[17, 6], [23, 8], [22, 13], [19, 11], [17, 11]], Bk);
    c.set(14, 7, "#100c10"); c.set(15, 7, "#f0b830");
    c.o(10, 7, "#ffffff");
  },
  deliverance: (c) => {
    c.post((p) => {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; for (let r = 7; r <= (i % 2 ? 10 : 11.5); r++) p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), rgba("#ffd860", 1 - (r - 7) * 0.16)); }
    });
    c.ball(12, 12, 6.4, tone("#ffd860", { shiny: true }));
    const W = tone("#ffffff");
    c.rect(11, 8, 3, 9, W); c.rect(8, 11, 9, 3, W);
  },
  assimilance: (c) => {
    const M = tone("#7a4ab0", { gr: 1.1 }), G = tone(C.gold, { shiny: true });
    c.fn((x, y) => { const dx = Math.abs(x - 12); return y >= 7 && y <= 17 && dx <= 11 - Math.max(0, y - 12) * 0.9 - (dx < 2 && y > 13 ? 9 : 0) ? M : undefined; });
    c.ell(7.5, 11, 2.6, 1.7, "#120e18"); c.ell(16.5, 11, 2.6, 1.7, "#120e18");
    c.line(2, 8, 22, 8, G);
    for (const x of [3, 21]) c.ball(x, 7, 1.4, G);
    c.post((p) => { for (let y = 17; y <= 22; y++) p.px(y % 2 ? 2 : 3, y, rgba(C.gold, 0.8)); });
  },
  grandhuntmastery: (c) => {
    paw(c, 12, 12.5, C.gold, 1.5);
    const R = tone("#e8e2d2", { shiny: true });
    c.ring(12, 12, 10.5, 10.5, 1.4, R);
    for (const [x, y, w, h] of [[11, 0, 2, 4], [11, 20, 2, 4], [0, 11, 4, 2], [20, 11, 4, 2]] as const) c.rect(x, y, w, h, R);
  },
  grandpathsmanship: (c) => {
    c.poly([[1, 22], [9, 6], [13, 12], [16, 8], [23, 22]], tone("#7a7a8e", { gr: 1.2 }));
    c.poly([[9, 6], [7, 10], [9, 9], [11, 10]], tone("#ffffff")); c.poly([[16, 8], [14.5, 11], [16, 10.5], [17.5, 11.5]], tone("#ffffff"));
    c.post((p) => { for (const [x, y] of [[12, 21], [11, 19], [12, 17], [14, 15], [15, 13], [13, 12]] as const) p.px(x, y, "#f0d070"); sparkle(p, 20, 3, "#fff1a0", true); });
  },
  kaisurge: (c) => {
    c.post((p) => {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (let r = 8; r <= 11; r++) p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), rgba("#ffd860", 0.9 - (r - 8) * 0.2)); }
    });
    boltShape(c, "#f8c030");
    c.glow("#ffe080", 2, 0.45);
  },
  kaiscreen: (c) => {
    c.post((p) => { for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; for (let r = 11; r <= 12; r++) p.px(Math.round(12 + Math.cos(a) * r), Math.round(18 + Math.sin(a) * r), rgba("#ffe080", r === 11 ? 0.9 : 0.45)); } });
    const R = tone("#ffd860", { shiny: true });
    c.fn((x, y) => { const r = Math.hypot(x - 12, y - 18); return y <= 18 && r <= 10 && r > 8.6 ? R : undefined; });
    c.fn((x, y) => (y <= 18 && Math.hypot(x - 12, y - 18) <= 8.6 ? rgba("#ffd860", 0.22) : undefined));
    c.rect(1, 18, 22, 3, tone("#7a6a4a"));
    c.ball(12, 12, 2, tone(C.skin));
    c.poly([[9, 18], [10, 14], [14, 14], [15, 18]], tone("#3f7a45"));
    c.o(6, 11, "#ffffff"); c.o(7, 10, rgba("#ffffff", 0.7)); c.o(5, 12, rgba("#ffffff", 0.7));
  },
  grandnexus: (c) => {
    const q: [number, string][] = [[0, "#e8502a"], [1, "#3a7ad8"], [2, "#4aa64f"], [3, "#e8e4f0"]];
    for (const [i, col] of q) {
      const T = tone(col);
      c.fn((x, y) => {
        const a = (Math.atan2(y - 12, x - 12) + Math.PI * 2.75) % (Math.PI * 2);
        return Math.hypot(x - 12, y - 12) <= 9 && Math.floor(a / (Math.PI / 2)) === i ? T : undefined;
      });
    }
    c.ring(12, 12, 10.5, 10.5, 1.6, tone(C.gold, { shiny: true }));
    c.ball(12, 12, 2.2, tone("#ffffff"));
  },
  telegnosis: (c) => {
    const H = tone("#3a3e6a", { gr: 1.1 });
    c.fn((x, y) => (y >= 15 && ((x - 12) / 10) ** 2 + ((y - 24) / 8.5) ** 2 <= 1 ? H : undefined));
    c.ball(12, 11, 6.2, tone("#3a3e6a"));
    c.post((p) => {
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; for (let r = 4; r <= 6; r++) p.px(Math.round(12 + Math.cos(a) * r * 1.6), Math.round(9 + Math.sin(a) * r * 1.25), rgba("#9ae8ff", 0.95 - (r - 4) * 0.3)); }
      for (const [x, y] of [[11, 9], [12, 9], [10, 10], [13, 10], [11, 11], [12, 11]] as const) p.px(x, y, "#e8fbff");
      p.px(11, 10, "#3ab8e8"); p.px(12, 10, "#1a5a9a");
    });
  },
  magimagic: (c) => {
    openBook(c);
    c.post((p) => {
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5, b = -Math.PI / 2 + ((i + 1) * 4 * Math.PI) / 5; for (let t = 0; t <= 1; t += 0.1) p.px(Math.round(12 + Math.cos(a + (b - a) * 0) * 0 + (Math.cos(a) * (1 - t) + Math.cos(b) * t) * 5), Math.round(6 + (Math.sin(a) * (1 - t) + Math.sin(b) * t) * 5), rgba("#c88aff", 0.95)); }
      sparkle(p, 4, 4, "#e0c0ff", false); sparkle(p, 20, 3, "#e0c0ff", true);
    });
  },
  kaialchemy: (c) => {
    const G = tone(C.glass), L = tone("#4fd06a");
    c.ball(10, 13, 6.5, G);
    c.ball(10, 13, 6.5, L, (_x, y) => y > 12.5);
    c.poly([[12, 7], [14, 5], [22, 10], [21, 12], [14, 8.5]], G);
    c.rect(8, 3, 4, 5, G);
    c.o(7, 11, "#ffffff"); c.o(7, 12, "#ffffff"); c.o(8, 10, "#ffffff");
    flameAt(c, 10, 22.5, 3, 3);
    c.post((p) => { for (const [x, y] of [[9, 1], [11, 2], [21, 14], [22, 16]] as const) p.px(x, y, rgba("#9aff9a", 0.8)); });
  },
  astrology: (c) => {
    const M = tone("#f2e08a", { shiny: true });
    c.fn((x, y) => (Math.hypot(x - 10, y - 12) <= 8.5 && Math.hypot(x - 14, y - 9.5) > 7 ? M : undefined));
    c.spark(18, 15, "#fff6c0", true); c.spark(20, 5, "#fff6c0"); c.spark(14, 20, "#fff6c0");
  },
  herbmastery: (c) => {
    const S = tone("#9a96a4", { gr: 1 }), P = tone("#c8c2d0");
    leaf(c, 11, 10, -Math.PI / 2 - 0.5, 8, 2.4, tone("#4fa64a"));
    leaf(c, 13, 10, -Math.PI / 2 + 0.6, 7, 2.2, tone("#3f8a44"));
    c.ne(13, 12, 9, [P, P]);
    c.fn((x, y) => (y >= 11 && y <= 22 && ((x - 12) / 9) ** 2 + ((y - 11) / 10) ** 2 <= 1 ? S : undefined));
    c.rect(3, 11, 18, 2, tone(hs("#9a96a4", 0.15)));
    c.ofn((x, y) => (y > 13 && y < 19 && Math.floor(y) === 15 ? rgba("#3a3448", 0.35) : undefined));
  },
  elementalism: (c) => {
    flameAt(c, 12, 11, 10, 4);
    const W = tone("#3a7ad8", { shiny: true });
    c.fn((x, y) => { const dy = y - 18.5; return dy > -7 && (dy >= 0 ? Math.hypot(x - 5.5, dy) <= 4 : Math.abs(x - 5.5) <= 4 * (1 + dy / 7)) ? W : undefined; });
    c.o(4, 17, "#cfe8ff"); c.o(4, 18, "#cfe8ff");
    leaf(c, 13, 22, -0.75, 10, 3, tone("#4aa64f"));
    c.ofn((x, y) => { const [u, v] = loc(13, 22, -0.75)(x, y); return u > 1 && u < 9 && Math.abs(v) < 0.5 ? rgba("#d8ffc0", 0.6) : undefined; });
  },
  bardsmanship: (c) => {
    const W = tone("#c0803e", { gr: 1.2 }), N = tone(C.dwood), P = tone("#5a3a24");
    c.ne(11, 13, 9, [N, N]);
    c.poly([[18, 7], [21, 2], [23, 4], [20, 8]], P);
    c.ell(9, 15.5, 7, 7, W);
    c.ell(12, 11.5, 4.5, 4.5, W);
    c.ball(10, 14, 2, tone("#2a1a12"));
    c.post((p) => { for (let i = 0; i < 12; i++) { p.px(9 + i, 17 - i, rgba("#f0e8d8", 0.8)); } });
    c.rect(5, 18, 5, 2, tone(C.dwood));
  },
};

const discCache = memo((d: string) => {
  const c = new Ic(24);
  (DISC[d] ?? ((cc: Ic) => DISC.sixthsense(cc)))(c);
  return c.render();
});
/** 24x24 icon for a Kai discipline id (Kai, Magnakai, Grand Master and New Order). */
export function discIcon(disc: string): HTMLCanvasElement { return discCache(disc); }

/* ================================================================== DOM helper */

const urls = new WeakMap<HTMLCanvasElement, string>();
/** An <img> of the icon, scaled by an integer factor with crisp nearest-neighbour pixels. */
export function iconEl(c: HTMLCanvasElement, scale = 2, cls?: string): HTMLImageElement {
  let u = urls.get(c);
  if (!u) { u = c.toDataURL(); urls.set(c, u); }
  const img = new Image(c.width * scale, c.height * scale);
  img.src = u;
  img.alt = "";
  img.draggable = false;
  img.className = cls ?? "px-icon";
  img.style.imageRendering = "pixelated";
  img.style.width = `${c.width * scale}px`;
  img.style.height = `${c.height * scale}px`;
  return img;
}

/** Item names that have an explicit hand-made design (handy for previews and tests). */
export const KNOWN_ITEMS = [
  "Axe", "Sword", "Broadsword", "Short Sword", "Dagger", "Spear", "Giak Spear", "Mace", "Warhammer", "Quarterstaff", "Bow", "Quiver", "Arrow",
  "Helmet", "Chainmail Waistcoat", "Padded Leather Waistcoat", "Shield", "Healing Potion", "Potion of Laumspur", "Laumspur", "Alether",
  "Meal", "Special Rations", "Backpack", "Map of Sommerlund", "Golden Key", "Silver Key", "Vordak Gem", "Tomb Guardian Gems",
  "Crystal Star Pendant", "Scroll", "Message", "Torch", "Tinderbox", "Rope", "Tablet of Perfumed Soap", "Surgeon's Cloak", "Gold Crowns",
  "Sommerswerd", "Lorestone", "Seal of Hammerdal", "Blanket", "Flask of Water", "Ointment", "Fire-sphere", "Kalte Furs", "Ring", "Amulet", "Book",
] as const;

