/**
 * Procedural 16x16 pixel icons for items. Each item has a `shape` (drawer below) and a
 * 3-colour palette, so every item gets its own icon without hand-drawn assets.
 * Shapes are drawn into a colour grid, then an automatic dark outline is added.
 */

export type Palette = [string, string, string]; // main, secondary, accent

type Grid = (string | null)[][];

function hex(c: string) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
export function shade(c: string, f: number): string {
  const [r, g, b] = hex(c);
  return f >= 0 ? toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : toHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

class Pen {
  g: Grid = Array.from({ length: 16 }, () => Array(16).fill(null));
  constructor(public p: Palette) {}
  get a() { return this.p[0]; }
  get al() { return shade(this.p[0], 0.35); }
  get ad() { return shade(this.p[0], -0.3); }
  get c() { return this.p[1]; }
  get cl() { return shade(this.p[1], 0.35); }
  get cd() { return shade(this.p[1], -0.3); }
  get e() { return this.p[2]; }
  px(x: number, y: number, col: string) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < 16 && y < 16) this.g[y][x] = col;
  }
  rect(x: number, y: number, w: number, h: number, col: string) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, col);
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      for (let k = 0; k < t; k++) this.px(x + (k % 2), y + Math.floor(k / 2), col);
    }
  }
  disc(cx: number, cy: number, r: number, col: string) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) this.px(cx + x, cy + y, col);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, col: string) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) this.px(cx + x, cy + y, col);
  }
  /** Shaded ball: base disc, dark lower-right, highlight upper-left. */
  ball(cx: number, cy: number, r: number, base: string) {
    this.disc(cx, cy, r, shade(base, -0.3));
    this.disc(cx - 0.5, cy - 0.5, r - 1, base);
    this.px(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), shade(base, 0.6));
    if (r > 3) this.px(cx - Math.ceil(r / 2) + 1, cy - Math.ceil(r / 2), shade(base, 0.4));
  }
  outline(col = "#1b1b2a") {
    const out: [number, number][] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (this.g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.g[y + dy]?.[x + dx])) out.push([x, y]);
    }
    for (const [x, y] of out) this.g[y][x] = col;
  }
}

type Drawer = (p: Pen) => void;

const D: Record<string, Drawer> = {
  // ------------------------------------------------------------ weapons
  sword: (p) => {
    p.line(13, 2, 5, 10, p.al, 1); p.line(12, 2, 4, 10, p.a, 1); p.line(13, 3, 5, 11, p.ad, 1);
    p.line(3, 8, 8, 13, p.c, 1); p.line(3, 9, 7, 13, p.cd, 1);
    p.line(4, 11, 2, 13, p.cd, 2); p.px(1, 14, p.e); p.px(2, 14, p.e);
  },
  axe: (p) => {
    p.line(4, 14, 11, 3, p.c, 2);
    p.ellipse(11, 5, 3, 4, p.a); p.line(13, 2, 14, 7, p.al); p.px(9, 4, p.ad); p.px(9, 7, p.ad);
    p.px(12, 1, p.e);
  },
  spear: (p) => {
    p.line(2, 14, 11, 5, p.c, 2);
    p.line(11, 5, 14, 1, p.a, 2); p.px(15, 0, p.al); p.px(12, 3, p.al);
    p.px(10, 7, p.e); p.px(9, 6, p.e);
  },
  bow: (p) => {
    for (let i = 0; i <= 12; i++) { const t = i / 12; const x = 3 + Math.sin(t * Math.PI) * 7; p.px(x, 2 + i, i % 4 === 0 ? p.al : p.a); p.px(x + 1, 2 + i, p.ad); }
    p.line(3, 2, 3, 14, p.cl); p.px(9, 8, p.e); p.px(10, 8, p.e);
  },
  dagger: (p) => {
    p.line(12, 3, 7, 8, p.al); p.line(11, 3, 6, 8, p.a); p.line(12, 4, 7, 9, p.ad);
    p.line(4, 7, 8, 11, p.c); p.line(5, 10, 3, 12, p.cd, 2); p.px(2, 13, p.e);
  },
  staff: (p) => {
    p.line(3, 14, 11, 5, p.c, 2);
    p.ball(12, 4, 3, p.e); p.px(9, 3, p.a); p.px(14, 7, p.a); p.px(10, 7, p.a);
  },
  wand: (p) => {
    p.line(3, 13, 10, 6, p.c, 1); p.line(4, 13, 11, 6, p.cd, 1);
    p.px(11, 5, p.e); p.px(12, 4, p.e); p.px(13, 3, p.al); p.px(12, 2, p.al); p.px(14, 4, p.al); p.px(11, 3, p.a); p.px(13, 5, p.a);
  },
  shield: (p) => {
    p.rect(3, 2, 10, 7, p.a); for (let i = 0; i < 5; i++) p.rect(4 + i, 9 + i, 8 - i * 2, 1, p.a);
    p.rect(3, 2, 10, 1, p.al); p.rect(7, 3, 2, 9, p.c); p.rect(4, 5, 8, 2, p.c); p.px(7, 5, p.e); p.px(8, 6, p.e);
    p.rect(12, 3, 1, 6, p.ad);
  },
  fist: (p) => {
    for (let k = 0; k < 4; k++) p.rect(4 + k * 2, 3 + (k === 0 || k === 3 ? 1 : 0), 2, 4, k % 2 ? p.al : p.a);
    p.rect(4, 7, 8, 4, p.a); p.rect(2, 6, 3, 3, p.a); p.rect(4, 7, 8, 1, p.ad);
    p.rect(5, 11, 6, 3, p.c); p.rect(5, 13, 6, 1, p.cd); p.px(7, 9, p.e); p.px(9, 9, p.e);
  },
  scythe: (p) => {
    p.line(3, 14, 10, 2, p.c, 2);
    for (let i = 0; i < 8; i++) p.px(10 - i, 2 + Math.round(Math.sin((i / 8) * Math.PI) * -1 + i * 0.35), p.a);
    p.line(10, 2, 3, 4, p.al); p.line(10, 3, 4, 5, p.a); p.px(3, 5, p.ad); p.px(11, 2, p.e);
  },
  tome: (p) => {
    p.rect(3, 3, 10, 11, p.a); p.rect(3, 3, 2, 11, p.ad); p.rect(12, 4, 1, 9, p.al); p.rect(5, 13, 8, 1, "#e8e0c8");
    p.disc(8, 8, 2, p.e); p.px(8, 8, p.c);
  },
  // ------------------------------------------------------------ armour
  robe: (p) => {
    p.rect(5, 2, 6, 3, p.a); p.rect(3, 4, 10, 3, p.a); for (let i = 0; i < 8; i++) p.rect(4 - Math.floor(i / 3), 7 + i, 8 + Math.floor(i / 3) * 2, 1, p.a);
    p.rect(7, 3, 2, 12, p.c); p.rect(3, 4, 1, 3, p.ad); p.rect(4, 14, 8, 1, p.ad); p.px(7, 6, p.e); p.px(8, 6, p.e);
  },
  leather: (p) => {
    p.rect(4, 3, 8, 11, p.a); p.rect(2, 3, 3, 5, p.a); p.rect(11, 3, 3, 5, p.a); p.rect(6, 2, 4, 2, p.ad);
    p.rect(4, 9, 8, 2, p.c); p.px(7, 9, p.e); p.px(8, 9, p.e); p.rect(4, 13, 8, 1, p.ad); p.rect(4, 3, 1, 10, p.al);
  },
  mail: (p) => {
    p.rect(4, 3, 8, 11, p.a); p.rect(2, 3, 3, 6, p.a); p.rect(11, 3, 3, 6, p.a);
    for (let y = 4; y < 14; y += 2) for (let x = 4 + (y % 4 ? 1 : 0); x < 12; x += 2) p.px(x, y, p.al);
    p.rect(6, 2, 4, 2, p.c); p.rect(4, 13, 8, 1, p.ad); p.px(7, 8, p.e);
  },
  plate: (p) => {
    p.rect(4, 3, 8, 11, p.a); p.rect(1, 3, 4, 4, p.a); p.rect(11, 3, 4, 4, p.a);
    p.rect(1, 3, 4, 1, p.al); p.rect(11, 3, 4, 1, p.al); p.rect(7, 4, 2, 9, p.al); p.rect(4, 9, 8, 1, p.ad);
    p.rect(6, 2, 4, 1, p.c); p.px(7, 6, p.e); p.px(8, 6, p.e); p.rect(4, 13, 8, 1, p.ad);
  },
  helmet: (p) => {
    p.ellipse(8, 8, 5, 5, p.a); p.rect(3, 9, 10, 4, p.a); p.rect(5, 8, 6, 2, "#1b1b2a"); p.rect(7, 2, 2, 5, p.c); p.px(6, 4, p.al); p.px(4, 6, p.al);
  },
  ring: (p) => {
    p.ellipse(8, 10, 4, 3, p.a); p.ellipse(8, 10, 2, 1, "") ; clearCenter(p, 8, 10);
    p.px(5, 9, p.al); p.ball(8, 5, 2, p.e); p.px(6, 6, p.c); p.px(10, 6, p.c);
  },
  amulet: (p) => {
    p.line(3, 2, 8, 9, p.c); p.line(13, 2, 8, 9, p.c); p.px(3, 1, p.c); p.px(13, 1, p.c);
    p.disc(8, 11, 3, p.a); p.ball(8, 11, 2, p.e);
  },
  charm: (p) => {
    p.line(8, 1, 8, 4, p.c); p.rect(5, 4, 6, 8, p.a); p.rect(6, 12, 4, 2, p.a); p.rect(5, 4, 6, 1, p.al);
    p.rect(7, 6, 2, 4, p.e); p.px(6, 7, p.e); p.px(9, 7, p.e); p.px(7, 14, p.c); p.px(8, 15, p.c);
  },
  boots: (p) => {
    p.rect(3, 3, 4, 9, p.a); p.rect(3, 11, 7, 3, p.a); p.rect(9, 5, 4, 7, p.ad); p.rect(9, 11, 6, 3, p.ad);
    p.rect(3, 3, 4, 2, p.c); p.rect(3, 13, 7, 1, p.cd); p.rect(9, 13, 6, 1, p.cd); p.px(4, 7, p.e);
  },
  earring: (p) => {
    p.disc(8, 3, 1, p.c); p.line(8, 4, 8, 7, p.c); p.ball(8, 10, 3, p.a); p.px(8, 10, p.e); p.px(7, 13, p.e); p.px(9, 13, p.e);
  },
  // ------------------------------------------------------------ more weapons
  mace: (p) => {
    p.line(3, 14, 9, 7, p.c, 2); p.px(2, 15, p.e);
    p.ball(11, 5, 3, p.a); for (const [x, y] of [[11, 1], [15, 5], [11, 9], [7, 5], [14, 2], [8, 2]]) p.px(x, y, p.al);
  },
  whip: (p) => {
    p.line(2, 14, 5, 11, p.c, 2); p.px(1, 15, p.e);
    for (let i = 0; i < 14; i++) { const a = i / 13; p.px(5 + Math.sin(a * 5) * 3 + a * 6, 11 - a * 9, i % 3 ? p.a : p.ad); }
  },
  greatsword: (p) => {
    p.line(14, 1, 5, 10, p.al, 2); p.line(13, 1, 4, 10, p.a, 2); p.line(14, 3, 6, 11, p.ad);
    p.line(2, 8, 8, 14, p.c, 2); p.line(4, 12, 1, 15, p.cd, 2); p.px(5, 11, p.e);
  },
  greataxe: (p) => {
    p.line(3, 15, 10, 2, p.c, 2);
    p.ellipse(11, 5, 4, 5, p.a); p.ellipse(5, 5, 2, 3, p.a); p.line(15, 1, 15, 9, p.al); p.px(1, 4, p.al);
    p.px(10, 5, p.ad); p.px(11, 1, p.e);
  },
  hammer: (p) => {
    p.line(3, 15, 9, 6, p.c, 2);
    p.rect(6, 1, 9, 6, p.a); p.rect(6, 1, 9, 1, p.al); p.rect(6, 6, 9, 1, p.ad); p.rect(9, 3, 3, 2, p.e);
  },
  crossbow: (p) => {
    p.line(3, 13, 12, 4, p.c, 2);
    for (let i = 0; i <= 10; i++) { const t = i / 10; p.px(3 + t * 10 - Math.sin(t * Math.PI) * 2, 3 + t * 10 - Math.sin(t * Math.PI) * 2 + (t < 0.5 ? 0 : 0), p.a); }
    p.line(4, 2, 14, 12, p.a); p.line(3, 3, 13, 13, p.ad); p.line(7, 8, 13, 2, p.cl); p.px(14, 1, p.e);
  },
  katana: (p) => {
    for (let i = 0; i < 11; i++) { const x = 14 - i, y = 1 + i + Math.round(Math.sin((i / 10) * Math.PI) * -0.8); p.px(x, y, p.al); p.px(x - 1, y, p.a); p.px(x, y + 1, p.ad); }
    p.rect(3, 11, 3, 1, p.e); p.rect(4, 10, 1, 3, p.e); p.line(3, 13, 1, 15, p.c, 2);
  },
  lute: (p) => {
    p.line(9, 7, 14, 1, p.c, 2); p.rect(13, 1, 2, 2, p.cd);
    p.ellipse(6, 10, 5, 4, p.a); p.ellipse(6, 10, 3, 2, p.al); p.disc(6, 10, 1, "#2a1a10"); p.line(4, 12, 13, 2, p.e);
  },
  // ------------------------------------------------------------ head / hands / legs / feet
  hat: (p) => {
    for (let i = 0; i < 9; i++) p.rect(8 - Math.floor(i / 2), 1 + i, Math.floor(i / 2) * 2 + 1, 1, p.a);
    p.px(9, 1, p.a); p.px(10, 1, p.al); p.rect(1, 10, 14, 2, p.ad); p.rect(3, 10, 10, 1, p.a); p.rect(4, 8, 8, 2, p.c); p.px(8, 5, p.e);
  },
  cap: (p) => {
    p.ellipse(8, 8, 6, 5, p.a); p.rect(2, 8, 12, 5, p.a); p.rect(2, 11, 12, 2, p.c); p.rect(2, 12, 12, 1, p.cd);
    p.px(5, 5, p.al); p.px(4, 6, p.al); p.px(8, 4, p.e); p.line(8, 3, 8, 10, p.ad);
  },
  helm: (p) => {
    p.ellipse(8, 7, 6, 6, p.a); p.rect(2, 7, 12, 7, p.a); p.rect(4, 8, 8, 2, "#1b1b2a"); p.rect(7, 10, 2, 4, "#1b1b2a");
    p.rect(7, 1, 2, 7, p.al); p.px(4, 4, p.al); p.rect(2, 13, 12, 1, p.ad); p.px(3, 11, p.e); p.px(12, 11, p.e);
  },
  gloves: (p) => {
    p.rect(4, 6, 7, 7, p.a); for (let k = 0; k < 4; k++) p.rect(4 + k * 2, 2 + (k === 0 || k === 3 ? 1 : 0), 1, 4, k % 2 ? p.al : p.a);
    p.rect(11, 7, 2, 3, p.a); p.rect(4, 12, 7, 2, p.c); p.px(7, 9, p.e);
  },
  bracers: (p) => {
    p.rect(3, 3, 10, 10, p.a); p.rect(3, 3, 10, 1, p.al); p.rect(3, 12, 10, 1, p.ad);
    for (const y of [5, 8, 11]) p.rect(3, y, 10, 1, p.c); p.px(8, 7, p.e); p.px(8, 10, p.e);
  },
  gauntlets: (p) => {
    p.rect(3, 7, 9, 7, p.a); p.rect(3, 7, 9, 1, p.al); for (let k = 0; k < 4; k++) p.rect(3 + k * 2, 2 + (k === 0 ? 2 : 0), 2, 5, k % 2 ? p.a : p.al);
    p.rect(12, 8, 2, 3, p.a); p.rect(3, 12, 9, 2, p.ad); p.px(7, 10, p.e); p.px(8, 10, p.e);
  },
  pants: (p) => {
    p.rect(3, 2, 10, 4, p.a); p.rect(3, 6, 4, 8, p.a); p.rect(9, 6, 4, 8, p.a); p.rect(3, 2, 10, 1, p.c);
    p.rect(3, 13, 4, 1, p.ad); p.rect(9, 13, 4, 1, p.ad); p.px(4, 7, p.al); p.px(8, 2, p.e);
  },
  leggings: (p) => {
    p.rect(3, 2, 10, 4, p.a); p.rect(3, 6, 4, 8, p.a); p.rect(9, 6, 4, 8, p.a); p.rect(3, 2, 10, 2, p.c);
    p.rect(3, 8, 4, 2, p.c); p.rect(9, 8, 4, 2, p.c); p.px(4, 11, p.al); p.px(8, 3, p.e);
  },
  greaves: (p) => {
    p.rect(3, 2, 4, 12, p.a); p.rect(9, 2, 4, 12, p.a); p.rect(3, 2, 4, 1, p.al); p.rect(9, 2, 4, 1, p.al);
    p.ellipse(5, 7, 2, 1, p.al); p.ellipse(11, 7, 2, 1, p.al); p.rect(3, 13, 4, 1, p.ad); p.rect(9, 13, 4, 1, p.ad); p.px(5, 4, p.e); p.px(11, 4, p.e);
  },
  shoes: (p) => {
    p.rect(2, 8, 6, 4, p.a); p.rect(2, 11, 6, 2, p.c); p.rect(9, 6, 5, 4, p.ad); p.rect(9, 9, 6, 2, p.cd);
    p.px(3, 8, p.al); p.px(6, 9, p.e); p.px(12, 7, p.e);
  },
  sabatons: (p) => {
    p.rect(2, 4, 5, 8, p.a); p.rect(2, 10, 8, 4, p.a); p.rect(9, 3, 5, 8, p.ad); p.rect(9, 9, 6, 4, p.ad);
    for (const y of [6, 9]) { p.rect(2, y, 5, 1, p.al); p.rect(9, y - 1, 5, 1, p.a); } p.rect(2, 13, 8, 1, p.c); p.px(4, 5, p.e);
  },
  // ------------------------------------------------------------ materials
  log: (p) => {
    p.rect(2, 6, 12, 6, p.a); p.rect(2, 6, 12, 1, p.al); p.rect(2, 11, 12, 1, p.ad);
    p.ellipse(13, 9, 2, 3, p.c); p.px(13, 9, p.cd); p.px(5, 8, p.ad); p.px(9, 10, p.ad); p.px(4, 5, p.e);
  },
  plank: (p) => {
    p.rect(1, 4, 14, 3, p.a); p.rect(2, 8, 13, 3, p.al); p.rect(1, 12, 14, 2, p.a);
    p.line(3, 5, 12, 5, p.ad); p.line(4, 9, 13, 9, p.a); p.px(10, 13, p.ad); p.px(1, 4, p.c);
  },
  stone: (p) => { p.ellipse(8, 9, 6, 5, p.a); p.ellipse(7, 8, 4, 3, p.al); p.px(5, 7, shade(p.a, 0.6)); p.px(10, 12, p.ad); p.px(11, 10, p.c); },
  block: (p) => {
    p.rect(3, 5, 10, 8, p.a); p.rect(3, 3, 10, 2, p.al); p.rect(13, 4, 1, 8, p.ad);
    p.line(3, 9, 12, 9, p.ad); p.line(8, 5, 8, 9, p.ad); p.line(5, 9, 5, 12, p.ad); p.line(10, 9, 10, 12, p.ad);
  },
  brick: (p) => {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { const x = 2 + k * 6 + (r % 2 ? 3 : 0); p.rect(x, 4 + r * 3, 5, 2, r % 2 ? p.ad : p.a); p.px(x, 4 + r * 3, p.al); }
  },
  ore: (p) => {
    p.ellipse(8, 9, 6, 5, p.c); p.ellipse(7, 8, 4, 3, p.cl);
    p.disc(6, 8, 1, p.a); p.disc(10, 10, 1, p.a); p.px(9, 6, p.a); p.px(5, 7, p.al); p.px(9, 9, p.al); p.px(4, 11, p.e);
  },
  ingot: (p) => {
    p.rect(3, 7, 10, 5, p.a); p.rect(4, 5, 8, 2, p.al); p.rect(3, 11, 10, 1, p.ad); p.px(5, 5, shade(p.a, 0.7)); p.px(6, 5, shade(p.a, 0.7));
    p.rect(12, 6, 1, 5, p.ad); p.px(4, 8, p.e);
  },
  herb: (p) => {
    p.line(8, 14, 8, 6, p.c); p.ellipse(5, 7, 2, 3, p.a); p.ellipse(11, 7, 2, 3, p.a); p.ellipse(8, 4, 2, 3, p.al);
    p.ellipse(6, 11, 2, 1, p.ad); p.ellipse(10, 11, 2, 1, p.ad); p.px(8, 2, p.e);
  },
  flower: (p) => {
    p.line(8, 14, 8, 8, p.c); p.ellipse(6, 12, 2, 1, p.cd);
    for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) p.disc(8 + dx, 6 + dy, 2, p.a);
    p.disc(8, 6, 1, p.e);
  },
  mushroom: (p) => {
    p.rect(6, 8, 4, 6, p.c); p.rect(6, 13, 4, 1, p.cd);
    p.ellipse(8, 6, 6, 4, p.a); p.rect(2, 7, 13, 2, p.ad); p.disc(5, 4, 1, p.e); p.disc(10, 5, 1, p.e); p.px(8, 3, p.al);
  },
  fiber: (p) => {
    for (let i = 0; i < 5; i++) p.line(3 + i * 2, 14, 5 + i * 2 - (i % 2) * 3, 2, i % 2 ? p.a : p.al);
    p.rect(3, 9, 11, 2, p.c);
  },
  cloth: (p) => {
    p.rect(2, 4, 12, 9, p.a); p.rect(2, 4, 12, 1, p.al); p.rect(2, 12, 12, 1, p.ad);
    for (let x = 3; x < 14; x += 3) p.line(x, 5, x, 11, p.c); p.rect(12, 4, 2, 9, p.ad); p.px(4, 7, p.e);
  },
  hide: (p) => {
    p.ellipse(8, 8, 6, 5, p.a); p.rect(1, 4, 3, 3, p.a); p.rect(12, 4, 3, 3, p.a); p.rect(1, 10, 3, 3, p.a); p.rect(12, 10, 3, 3, p.a);
    p.px(6, 7, p.ad); p.px(9, 9, p.ad); p.px(7, 10, p.c); p.px(10, 6, p.c);
  },
  roll: (p) => {
    p.rect(3, 5, 10, 7, p.a); p.ellipse(3, 8, 2, 3, p.al); p.px(3, 8, p.ad); p.rect(3, 5, 10, 1, p.al); p.rect(3, 11, 10, 1, p.ad);
    p.rect(7, 5, 2, 7, p.c);
  },
  bone: (p) => { p.line(4, 12, 12, 4, p.a, 2); p.disc(3, 12, 1, p.a); p.disc(5, 14, 1, p.a); p.disc(12, 2, 1, p.a); p.disc(14, 4, 1, p.a); p.line(5, 11, 11, 5, p.al); },
  scale: (p) => {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r % 2); k++) { const x = 3 + k * 4 + (r % 2) * 2, y = 4 + r * 3; p.ellipse(x + 1, y + 1, 2, 2, r % 2 ? p.ad : p.a); p.px(x, y, p.al); }
    p.px(8, 12, p.e);
  },
  fang: (p) => { for (let i = 0; i < 10; i++) p.rect(6 + Math.floor(i / 3), 3 + i, Math.max(1, 5 - Math.floor(i / 2)), 1, i < 2 ? p.c : p.a); p.px(6, 4, p.al); p.px(7, 6, p.al); },
  claw: (p) => { for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) p.px(3 + k * 4 + Math.round(Math.sin(i / 3) * 2), 3 + i, i > 5 ? p.c : p.a); p.rect(3, 11, 11, 3, p.c); },
  feather: (p) => {
    p.line(3, 14, 12, 3, p.c); for (let i = 0; i < 8; i++) { p.line(4 + i, 12 - i, 2 + i, 8 - i + 2, p.a); p.line(5 + i, 13 - i, 8 + i, 12 - i, p.al); }
    p.px(12, 3, p.e);
  },
  horn: (p) => { for (let i = 0; i < 11; i++) p.disc(4 + i * 0.8, 13 - i + Math.sin(i / 3) * 2, Math.max(0, 2 - Math.floor(i / 4)), i > 8 ? p.al : p.a); p.px(5, 12, p.c); p.px(6, 10, p.c); },
  gel: (p) => { p.ellipse(8, 10, 6, 4, p.a); p.ellipse(8, 8, 4, 4, p.a); p.px(5, 7, shade(p.a, 0.7)); p.px(6, 6, shade(p.a, 0.5)); p.rect(3, 13, 10, 1, p.ad); },
  gem: (p) => {
    for (let y = 0; y < 5; y++) p.rect(8 - (y + 2), 3 + y, (y + 2) * 2, 1, y === 0 ? p.al : p.a);
    for (let y = 0; y < 6; y++) p.rect(8 - (6 - y), 8 + y, (6 - y) * 2, 1, y % 2 ? p.ad : p.a);
    p.px(6, 4, "#ffffff"); p.px(5, 6, shade(p.a, 0.6));
  },
  crystal: (p) => {
    p.line(8, 1, 8, 13, p.al, 2); p.line(5, 5, 5, 13, p.a, 2); p.line(11, 6, 11, 13, p.a, 2); p.px(8, 0, p.e); p.px(5, 4, p.e); p.px(11, 5, p.e);
    p.rect(3, 13, 11, 2, p.c);
  },
  dust: (p) => { for (let i = 0; i < 5; i++) p.rect(8 - i - 1, 7 + i, i * 2 + 2, 1, i % 2 ? p.a : p.al); p.px(5, 5, p.e); p.px(11, 4, p.e); p.px(9, 6, p.e); },
  sand: (p) => { for (let i = 0; i < 6; i++) p.rect(8 - i - 1, 8 + i, i * 2 + 2, 1, i % 2 ? p.a : p.ad); p.px(8, 8, p.al); p.px(6, 11, p.c); },
  essence: (p) => { p.ball(8, 8, 5, p.a); p.disc(8, 8, 2, p.e); p.px(3, 3, p.al); p.px(13, 12, p.al); p.px(13, 3, p.e); },
  orb: (p) => { p.ball(8, 8, 5, p.a); p.rect(5, 13, 6, 2, p.c); },
  shell: (p) => { for (let i = 0; i < 6; i++) p.line(8, 13, 3 + i * 2, 4 + Math.abs(i - 2.5), i % 2 ? p.a : p.al); p.rect(5, 12, 7, 2, p.ad); p.px(8, 13, p.e); },
  pearl: (p) => { p.ball(8, 8, 4, p.a); p.px(6, 6, "#ffffff"); },
  coin: (p) => { p.ellipse(8, 8, 5, 5, p.a); p.ellipse(8, 8, 3, 3, p.al); p.rect(7, 6, 2, 5, p.ad); },
  key: (p) => { p.disc(5, 5, 3, p.a); p.disc(5, 5, 1, ""); clearCenter(p, 5, 5); p.line(7, 7, 13, 13, p.a, 2); p.rect(11, 12, 2, 3, p.a); p.rect(9, 10, 2, 3, p.a); p.px(4, 3, p.al); },
  thorn: (p) => { p.line(3, 13, 12, 3, p.a, 2); for (const [x, y] of [[5, 10], [8, 7], [10, 5]]) { p.px(x - 1, y - 2, p.a); p.px(x + 2, y + 1, p.a); } p.px(12, 2, p.e); },
  wax: (p) => { p.rect(6, 5, 4, 9, p.a); p.rect(6, 5, 1, 9, p.al); p.rect(5, 13, 6, 2, p.c); p.line(8, 2, 8, 4, "#3a2a1a"); p.px(8, 1, p.e); p.px(8, 0, shade(p.e, 0.5)); },
  silk: (p) => { p.rect(4, 4, 8, 9, p.a); p.rect(3, 3, 10, 2, p.c); p.rect(3, 12, 10, 2, p.c); for (let y = 5; y < 12; y += 2) p.line(4, y, 11, y, p.al); },
  sac: (p) => { p.ellipse(8, 9, 5, 5, p.a); p.rect(7, 2, 2, 4, p.c); p.ellipse(6, 7, 2, 2, p.al); p.px(9, 11, p.e); },
  wing: (p) => { for (let i = 0; i < 6; i++) p.line(3, 4, 5 + i * 2, 13 - (i % 2), i % 2 ? p.a : p.al); p.line(3, 4, 14, 6, p.c); },
  seed: (p) => { p.ellipse(8, 9, 5, 5, p.a); p.rect(6, 3, 4, 3, p.a); p.rect(5, 5, 6, 1, p.c); p.ellipse(8, 10, 2, 2, p.al); p.px(8, 10, p.e); },
  sapling: (p) => { p.rect(4, 11, 8, 4, p.c); p.rect(4, 11, 8, 1, p.cl); p.line(8, 11, 8, 5, p.ad); p.ellipse(6, 5, 2, 1, p.a); p.ellipse(10, 4, 2, 1, p.al); },
  // ------------------------------------------------------------ produce & food
  grain: (p) => { p.line(8, 14, 8, 4, p.c); for (let i = 0; i < 4; i++) { p.ellipse(6, 4 + i * 2, 1, 1, p.a); p.ellipse(10, 4 + i * 2, 1, 1, p.a); } p.px(8, 2, p.al); p.px(8, 3, p.a); },
  root: (p) => { for (let i = 0; i < 9; i++) p.rect(8 - Math.max(0, 3 - Math.floor(i / 3)), 5 + i, Math.max(1, 7 - Math.floor(i / 1.5)), 1, p.a); p.line(7, 1, 5, 5, p.c, 2); p.line(9, 1, 11, 5, p.c, 2); p.px(6, 7, p.al); },
  fruit: (p) => { p.ball(8, 9, 5, p.a); p.line(8, 4, 9, 1, p.cd); p.ellipse(11, 3, 2, 1, p.c); },
  berry: (p) => { for (const [x, y] of [[6, 7], [10, 7], [8, 10], [5, 11], [11, 11], [8, 5]]) p.ball(x, y, 2, p.a); p.rect(7, 1, 2, 3, p.c); },
  gourd: (p) => { p.ellipse(8, 10, 6, 4, p.a); p.line(5, 7, 5, 13, p.ad); p.line(11, 7, 11, 13, p.ad); p.line(8, 6, 8, 14, p.ad); p.rect(7, 3, 2, 3, p.c); p.px(6, 8, p.al); },
  leafy: (p) => { p.ellipse(8, 9, 5, 5, p.a); p.ellipse(6, 7, 3, 3, p.al); p.ellipse(10, 8, 3, 3, p.a); p.line(8, 5, 8, 13, p.ad); p.px(8, 14, p.c); },
  pod: (p) => { p.ellipse(8, 8, 3, 6, p.a); p.line(8, 3, 8, 13, p.ad); p.px(7, 5, p.e); p.px(7, 8, p.e); p.px(7, 11, p.e); p.line(8, 1, 10, 0, p.c); },
  bread: (p) => { p.ellipse(8, 10, 6, 4, p.a); p.ellipse(8, 8, 5, 3, p.al); p.line(5, 7, 6, 10, p.ad); p.line(8, 6, 9, 10, p.ad); p.line(11, 7, 12, 10, p.ad); },
  bowl: (p) => {
    p.ellipse(8, 10, 6, 3, p.c); p.rect(2, 8, 12, 2, p.c); p.rect(3, 7, 10, 2, p.a); p.rect(4, 7, 3, 1, p.al);
    p.rect(4, 13, 8, 1, p.cd); p.px(9, 7, p.e); p.px(6, 8, p.ad); p.line(6, 5, 7, 3, "#ffffff"); p.line(10, 5, 11, 2, "#ffffff");
  },
  meat: (p) => { p.ellipse(9, 7, 5, 4, p.a); p.ellipse(9, 7, 3, 2, p.al); p.line(5, 10, 2, 14, "#f4efe6", 2); p.disc(2, 14, 1, "#f4efe6"); },
  fish: (p) => { p.ellipse(7, 8, 5, 3, p.a); p.rect(12, 6, 2, 5, p.a); p.px(14, 5, p.a); p.px(14, 11, p.a); p.px(4, 7, "#1b1b2a"); p.line(3, 9, 10, 9, p.al); p.px(7, 5, p.c); },
  cake: (p) => { p.rect(3, 7, 10, 6, p.a); p.rect(3, 6, 10, 2, p.c); p.rect(3, 12, 10, 1, p.ad); for (let x = 4; x < 13; x += 3) p.px(x, 8, p.cl); p.px(8, 4, p.e); p.px(8, 5, p.e); },
  cup: (p) => {
    p.rect(4, 6, 7, 8, p.a); p.rect(4, 6, 7, 1, p.al); p.rect(4, 13, 7, 1, p.ad); p.rect(11, 8, 2, 3, p.a); p.rect(12, 9, 1, 1, "");
    p.rect(5, 8, 1, 4, p.al); p.line(6, 4, 7, 2, "#ffffff"); p.line(9, 4, 10, 2, "#ffffff");
  },
  egg: (p) => { p.ellipse(8, 9, 4, 5, p.a); p.px(6, 6, "#ffffff"); p.px(10, 11, p.ad); p.px(9, 7, p.e); },
  bottle: (p) => { p.rect(5, 6, 6, 8, p.a); p.rect(6, 3, 4, 3, p.a); p.rect(6, 2, 4, 1, p.c); p.rect(5, 9, 6, 3, p.c); p.px(6, 7, "#ffffff"); },
  jar: (p) => { p.rect(4, 5, 8, 9, p.a); p.rect(3, 4, 10, 2, p.c); p.rect(5, 8, 6, 4, p.e); p.px(5, 6, p.al); },
  cheese: (p) => { for (let i = 0; i < 8; i++) p.rect(3, 5 + i, 3 + i + 3, 1, p.a); p.rect(3, 12, 11, 1, p.ad); p.disc(6, 9, 1, p.ad); p.disc(9, 11, 0, p.ad); },
  skewer: (p) => { p.line(2, 14, 13, 3, "#c8a878"); for (const t of [0.3, 0.5, 0.7]) p.disc(2 + 11 * t, 14 - 11 * t, 2, t === 0.5 ? p.c : p.a); },
  // ------------------------------------------------------------ alchemy & misc
  potion: (p) => { p.ball(8, 10, 4, p.a); p.rect(7, 3, 2, 3, p.c); p.rect(6, 2, 4, 1, p.cd); p.rect(5, 9, 6, 1, p.al); p.px(6, 8, "#ffffff"); },
  vial: (p) => { p.rect(6, 3, 4, 11, p.c); p.rect(6, 7, 4, 7, p.a); p.rect(5, 2, 6, 1, p.cd); p.px(6, 8, "#ffffff"); p.rect(6, 13, 4, 1, p.ad); },
  flask: (p) => { for (let i = 0; i < 7; i++) p.rect(8 - Math.floor(i / 1.5) - 1, 7 + i, Math.floor(i / 1.5) * 2 + 2, 1, i < 2 ? p.c : p.a); p.rect(7, 2, 2, 5, p.c); p.rect(6, 1, 4, 1, p.cd); p.px(6, 11, "#ffffff"); },
  bomb: (p) => { p.ball(7, 10, 5, p.a); p.rect(9, 4, 3, 2, p.c); p.line(11, 3, 13, 1, "#c8a878"); p.px(14, 0, p.e); p.px(13, 0, "#ffe45a"); },
  scroll: (p) => { p.rect(4, 3, 8, 10, "#e8dcc0"); p.rect(3, 2, 10, 2, p.a); p.rect(3, 12, 10, 2, p.a); for (let y = 5; y < 11; y += 2) p.line(5, y, 10, y, p.c); p.px(8, 13, p.e); },
  book: (p) => { p.rect(3, 3, 10, 11, p.a); p.rect(3, 3, 2, 11, p.ad); p.rect(5, 13, 8, 1, "#e8e0c8"); p.rect(7, 5, 4, 3, p.c); p.px(9, 6, p.e); },
  wool: (p) => { for (const [x, y] of [[6, 7], [10, 7], [8, 10], [5, 11], [11, 11]]) p.disc(x, y, 3, p.a); p.px(5, 5, p.al); p.px(9, 5, p.al); },
  honey: (p) => { p.rect(4, 6, 8, 8, p.e); p.rect(3, 4, 10, 2, p.c); p.rect(5, 8, 6, 4, p.a); p.line(8, 6, 8, 9, p.a); },
  compost: (p) => { p.rect(3, 7, 10, 7, p.c); p.rect(3, 7, 10, 1, p.cl); for (let i = 0; i < 6; i++) p.px(4 + i * 1.6, 5 + (i % 2), p.a); p.px(6, 10, p.a); p.px(10, 11, p.e); },
  gear: (p) => { p.disc(8, 8, 5, p.a); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) p.rect(x - 1, y - 1, 2, 2, p.a); p.disc(8, 8, 2, p.c); p.px(8, 8, ""); clearCenter(p, 8, 8); },
  rope: (p) => { for (let r = 5; r >= 2; r -= 1) p.ellipse(8, 8, r + 1, r, r % 2 ? p.a : p.al); p.px(8, 8, p.ad); p.line(12, 10, 14, 14, p.a); },
  glass: (p) => { p.rect(3, 3, 10, 10, p.a); p.rect(3, 3, 10, 1, p.al); p.line(5, 11, 11, 5, "#ffffff"); p.line(6, 12, 12, 6, shade(p.a, 0.5)); },
  nail: (p) => { for (const x of [4, 8, 12]) { p.rect(x - 1, 3, 3, 2, p.a); p.line(x, 5, x, 13, p.al); } },

  // ------------------------------------------------------------ map markers (world map)
  m_house: (p) => {
    for (let i = 0; i < 6; i++) p.rect(7 - i, 2 + i, 2 + i * 2, 1, i < 2 ? p.al : p.a); // roof
    p.rect(2, 7, 12, 1, p.ad);
    p.rect(3, 8, 10, 6, p.c); p.rect(3, 8, 10, 1, p.cd);
    p.rect(7, 10, 2, 4, p.cd); p.rect(4, 9, 2, 2, p.e); p.rect(10, 9, 2, 2, p.e);
    p.rect(11, 2, 2, 3, p.cd); p.px(11, 1, "#d8d8e0");
    p.rect(2, 14, 12, 1, p.ad);
  },
  m_skull: (p) => {
    p.ball(8, 7, 6, p.a);
    p.rect(4, 11, 8, 3, p.a); p.rect(4, 13, 8, 1, p.ad);
    p.rect(4, 6, 3, 3, p.e); p.rect(9, 6, 3, 3, p.e); p.px(5, 7, "#fff6a0"); p.px(10, 7, "#fff6a0");
    p.px(7, 10, p.ad); p.px(8, 10, p.ad);
    for (const x of [5, 7, 9]) p.px(x, 12, p.ad);
    // crown
    p.rect(3, 0, 10, 2, p.c); for (const x of [3, 7, 11]) p.px(x + 1, 0, p.cl);
  },
  m_stairs: (p) => {
    for (let i = 0; i < 4; i++) { p.rect(2 + i * 3, 11 - i * 3, 12 - i * 3, 3, i % 2 ? p.a : p.al); p.rect(2 + i * 3, 13 - i * 3, 12 - i * 3, 1, p.ad); }
    p.line(8, 1, 8, 4, p.e); p.line(6, 3, 8, 1, p.e); p.line(10, 3, 8, 1, p.e);
  },
  m_portal: (p) => {
    p.ellipse(8, 8, 6, 7, p.ad); p.ellipse(8, 8, 5, 6, p.a); p.ellipse(8, 8, 3, 4, p.al); p.ellipse(8, 8, 1, 2, "#ffffff");
    p.px(3, 3, p.e); p.px(13, 12, p.e); p.px(12, 2, p.e);
  },
  m_chest: (p) => {
    p.rect(2, 5, 12, 4, p.a); p.rect(3, 4, 10, 1, p.al); p.rect(2, 8, 12, 1, p.ad);
    p.rect(2, 9, 12, 5, p.a); p.rect(2, 13, 12, 1, p.ad);
    p.rect(2, 5, 1, 9, p.c); p.rect(13, 5, 1, 9, p.c); p.rect(2, 9, 12, 1, p.c);
    p.rect(7, 8, 2, 3, p.e); p.px(7, 8, "#fff6a0");
  },
  m_flame: (p) => {
    p.line(3, 14, 13, 12, p.c, 2); p.line(3, 12, 13, 14, p.cd, 2);
    p.ellipse(8, 9, 4, 4, p.a); p.rect(7, 2, 2, 5, p.a); p.px(6, 4, p.a); p.px(10, 5, p.a);
    p.ellipse(8, 10, 2, 3, p.al); p.px(8, 6, p.al);
    p.ellipse(8, 11, 1, 1, "#fff6c0");
  },
  m_star: (p) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3 : 7; pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) p.px(x, y, x + y < 15 ? p.al : x + y > 17 ? p.ad : p.a);
    }
    p.rect(7, 5, 2, 4, p.e); p.rect(7, 10, 2, 1, p.e);
  },
  m_mystery: (p) => {
    p.ball(8, 8, 6, p.a);
    p.rect(6, 4, 4, 1, "#ffffff"); p.px(5, 5, "#ffffff"); p.px(10, 5, "#ffffff"); p.px(10, 6, "#ffffff");
    p.px(9, 7, "#ffffff"); p.px(8, 8, "#ffffff"); p.px(8, 9, "#ffffff"); p.px(8, 11, "#ffffff");
  },
  m_hero: (p) => {
    p.disc(8, 8, 7, p.c);
    p.disc(8, 8, 6, p.a);
    p.rect(7, 2, 2, 12, p.al); p.rect(2, 7, 12, 2, p.al);
    p.disc(8, 8, 2, p.e); p.px(8, 1, p.e);
  },
  m_ore: (p) => {
    p.ellipse(8, 10, 6, 4, p.ad); p.ellipse(7, 9, 5, 3, p.a);
    p.rect(5, 7, 2, 2, p.e); p.rect(9, 9, 2, 2, p.e); p.px(5, 7, "#ffffff");
  },
};

function clearCenter(p: Pen, x: number, y: number) {
  p.g[y][x] = null;
}

const cache = new Map<string, string>();
const canvasCache = new Map<string, HTMLCanvasElement>();

/** 16x16 icon drawn onto a canvas at `scale` (cached). */
export function iconCanvas(shape: string, pal: Palette, scale = 1): HTMLCanvasElement {
  const key = `${shape}|${pal.join(",")}|${scale}`;
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const pen = new Pen(pal);
  (D[shape] ?? D.orb)(pen);
  // empty-string colours are "holes"
  for (const row of pen.g) for (let i = 0; i < 16; i++) if (row[i] === "") row[i] = null;
  pen.outline();
  const c = document.createElement("canvas");
  c.width = 16 * scale;
  c.height = 16 * scale;
  const g = c.getContext("2d")!;
  pen.g.forEach((row, y) => row.forEach((col, x) => {
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x * scale, y * scale, scale, scale);
  }));
  canvasCache.set(key, c);
  return c;
}

/** Data URL of a 16x16 icon scaled `scale` times. */
export function iconURL(shape: string, pal: Palette, scale = 2): string {
  const key = `${shape}|${pal.join(",")}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = iconCanvas(shape, pal, scale).toDataURL();
  cache.set(key, url);
  return url;
}

export const ICON_SHAPES = Object.keys(D);

// ------------------------------------------------------------ world-map pins
export type MapPin = "hero" | "town" | "event" | "boss" | "stairs" | "portal" | "chest" | "camp" | "mystery" | "ore";
const PINS: Record<MapPin, [string, Palette]> = {
  hero: ["m_hero", ["#3a8ae0", "#ffffff", "#ffe14a"]],
  town: ["m_house", ["#c8503a", "#e8d8b0", "#ffe38a"]],
  event: ["m_star", ["#ffd23a", "#ffffff", "#7a3a10"]],
  boss: ["m_skull", ["#ece6d8", "#e8c040", "#c01a2a"]],
  stairs: ["m_stairs", ["#b08aff", "#6a4ab0", "#ffffff"]],
  portal: ["m_portal", ["#3a8ae0", "#ffffff", "#bfe8ff"]],
  chest: ["m_chest", ["#b8743a", "#e8c040", "#e8c040"]],
  camp: ["m_flame", ["#ff7a2a", "#7a4a2a", "#ffffff"]],
  mystery: ["m_mystery", ["#5ab8d8", "#ffffff", "#ffffff"]],
  ore: ["m_ore", ["#8a8a96", "#ffffff", "#6ae0ff"]],
};
export const mapPinURL = (k: MapPin) => iconURL(PINS[k][0], PINS[k][1], 2);
