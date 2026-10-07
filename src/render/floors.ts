import type { GameState } from "../core/state";
import { BUILDINGS, PAINT_FLOORS } from "../data/buildings";
import { SZ_W, layoutKey } from "../world/sanctuary";
import { cell } from "./houses";
import { hs, makeCanvas, mix } from "./palette";

/**
 * Ground cover (roads, plazas, lawns, ponds): one 16x16 tile per piece, drawn straight into the
 * sanctuary's ground. Neighbours of the same family join without a seam; where the family ends
 * the tile draws its edge (a kerb, a frayed lawn, a carpet trim, a bank of earth, sand or stone),
 * and water rounds its outer corners and fills its inner ones, so any outline reads as a pond.
 */
const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS: [number, number, number][] = [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, W], [1, -1, NE], [1, 1, SE], [-1, 1, SW], [-1, -1, NW]];

type Side = "n" | "s" | "e" | "w";
/** Distance from a pixel centre to where the family ends, and which way that is. */
function edge(i: number, j: number, mask: number, R: number): { d: number; side: Side } {
  const x = i + 0.5, y = j + 0.5;
  let d = 99, side: Side = "n";
  const take = (v: number, s: Side) => { if (v < d) { d = v; side = s; } };
  if (!(mask & N)) take(y, "n");
  if (!(mask & S)) take(16 - y, "s");
  if (!(mask & W)) take(x, "w");
  if (!(mask & E)) take(16 - x, "e");
  // outer corners: rounded
  const round = (cx: number, cy: number, s: Side) => {
    const dx = Math.abs(cx - x), dy = Math.abs(cy - y);
    if (dx < R && dy < R) take(R - Math.hypot(R - dx, R - dy), s);
  };
  if (!(mask & N) && !(mask & W)) round(0, 0, "n");
  if (!(mask & N) && !(mask & E)) round(16, 0, "n");
  if (!(mask & S) && !(mask & W)) round(0, 16, "s");
  if (!(mask & S) && !(mask & E)) round(16, 16, "s");
  // inner corners: the diagonal neighbour is missing though both sides are there
  if (mask & N && mask & W && !(mask & NW)) take(Math.hypot(x, y), "n");
  if (mask & N && mask & E && !(mask & NE)) take(Math.hypot(16 - x, y), "n");
  if (mask & S && mask & W && !(mask & SW)) take(Math.hypot(x, 16 - y), "s");
  if (mask & S && mask & E && !(mask & SE)) take(Math.hypot(16 - x, 16 - y), "s");
  return { d, side };
}

const n1 = (i: number, j: number, s: number) => cell(i, j, s);
const vary = (c: string, i: number, j: number, s: number, amt = 0.08) => hs(c, (n1(i, j, s) - 0.5) * amt * 2);

/** Nearest and second-nearest of jittered points on a grid (periodic over the tile): stones. */
/** `size` must divide 16, so the pattern repeats seamlessly from tile to tile. */
function stones(i: number, j: number, size: 4 | 8, s: number) {
  const k = 16 / size;
  let d1 = 99, d2 = 99, id = 0;
  const ci = Math.floor(i / size), cj = Math.floor(j / size);
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const gx = ci + ox, gy = cj + oy;
    const wx = ((gx % k) + k) % k, wy = ((gy % k) + k) % k;
    const px = (gx + 0.2 + cell(wx, wy, s) * 0.6) * size, py = (gy + 0.2 + cell(wx, wy, s + 9) * 0.6) * size;
    const d = Math.hypot(px - (i + 0.5), py - (j + 0.5));
    if (d < d1) { d2 = d1; d1 = d; id = wx * 7 + wy * 13; } else if (d < d2) d2 = d;
  }
  return { gap: d2 - d1, id, d1 };
}

type Style = "soft" | "kerb" | "trim" | "board" | "glass";
interface PathDef { style: Style; R: number; px: (i: number, j: number, v: number) => string }

/** A plain painted floor: an even colour with a faint grain and soft tile joints. */
const paint = (col: string): PathDef => ({ style: "kerb", R: 0, px: (i, j, v) => {
  if (i % 8 === 7 || j % 8 === 7) return hs(col, -0.06); // faint joints between painted boards
  return vary(col, i, j, v, 0.025);
} });

export const PATHS: Record<string, PathDef> = {
  ...Object.fromEntries(PAINT_FLOORS.map(([key, , , col]) => [`paint_${key}`, paint(col)])),
  dirt_road: { style: "soft", R: 3, px: (i, j, v) => {
    const base = "#a8805a";
    if (n1(i, j, v + 1) > 0.94) return "#c8a880";
    if (n1(i, j, v + 2) > 0.95) return "#7a5a3a";
    return vary(base, i >> 1, j >> 1, v, 0.07);
  } },
  gravel: { style: "soft", R: 3, px: (i, j, v) => {
    const r = n1(i, j, v);
    return r > 0.8 ? "#d8d0c0" : r > 0.55 ? "#b0a898" : r > 0.3 ? "#9a9284" : r > 0.1 ? "#c0b4a0" : "#7a7266";
  } },
  cobble: { style: "kerb", R: 0, px: (i, j, v) => {
    const st = stones(i, j, 4, 3);
    if (st.gap < 0.9) return "#5a5650";
    const c = ["#b8b4a8", "#a8a49a", "#c4bcae", "#9c988e"][st.id % 4];
    return st.d1 < 1 ? hs(c, 0.18) : vary(c, i, j, v, 0.04);
  } },
  sand_path: { style: "soft", R: 4, px: (i, j, v) => {
    if (n1(i, j, v + 3) > 0.96) return "#c8b080";
    if (n1(i, j, v + 4) > 0.97) return "#ffffff";
    return vary("#ecdcae", i, j, v, 0.05);
  } },
  lawn: { style: "soft", R: 3, px: (i, j, v) => {
    const stripe = (j >> 2) % 2 ? "#5cb040" : "#68bc4a";
    return n1(i, j, v) > 0.9 ? hs(stripe, -0.12) : stripe;
  } },
  clover: { style: "soft", R: 3, px: (i, j, v) => {
    const r = n1(i, j, v + 5);
    if (r > 0.96) return "#ffffff";
    if (r > 0.93) return "#f7d44c";
    return vary("#4f9e38", i >> 1, j >> 1, v, 0.1);
  } },
  plank_deck: { style: "board", R: 0, px: (i, j) => {
    const row = j >> 2;
    const seam = (row * 7) % 16;
    if (j % 4 === 3) return "#5a3a22";
    if (i === seam) return "#6a4428";
    if ((i === seam + 1 || i === seam - 2) && j % 4 === 1) return "#3a2614";
    const c = ["#b88050", "#a87444", "#c08a58", "#b07a48"][(row + (i > seam ? 1 : 0)) % 4];
    return j % 4 === 0 ? hs(c, 0.15) : vary(c, i, j, row, 0.03);
  } },
  flagstone: { style: "kerb", R: 0, px: (i, j, v) => {
    const st = stones(i, j, 8, 11);
    if (st.gap < 1.1) return "#6a6a5a";
    const c = ["#a8a8a0", "#b4ae9e", "#9a9e98", "#bcb8ac"][st.id % 4];
    return vary(c, i, j, v, 0.035);
  } },
  moss_stone: { style: "soft", R: 2, px: (i, j, v) => {
    const st = stones(i, j, 4, 21);
    if (st.gap < 1.1) return n1(i, j, v) > 0.4 ? "#4f8a35" : "#3a6a2a";
    if (n1(i >> 1, j >> 1, st.id) > 0.82) return "#6aa04a";
    return vary(["#8e908a", "#9a9890", "#84877f"][st.id % 3], i, j, v, 0.04);
  } },
  brick_road: { style: "kerb", R: 0, px: (i, j, v) => {
    const row = j >> 2, off = row % 2 ? 4 : 0;
    if (j % 4 === 3 || (i + off) % 8 === 7) return "#8a7a6a";
    const c = ["#b8503a", "#a8462f", "#c45c42", "#9e4430"][(((i + off) >> 3) + row * 3) % 4];
    return j % 4 === 0 ? hs(c, 0.14) : vary(c, i, j, v, 0.03);
  } },
  herringbone: { style: "kerb", R: 0, px: (i, j) => {
    const cx = i >> 3, cy = j >> 3, a = i & 7, b = j & 7;
    const vert = (cx + cy) % 2 === 0;
    const u = vert ? a : b, w = vert ? b : a;
    if (u % 4 === 3 || w === 7) return "#8a7a6a";
    const c = ["#c06048", "#a84a34", "#b45640"][((u >> 2) + cx + cy) % 3];
    return u % 4 === 0 ? hs(c, 0.14) : c;
  } },
  checker: { style: "kerb", R: 0, px: (i, j) => {
    const light = ((i >> 3) + (j >> 3)) % 2 === 0;
    const c = light ? "#e8e4dc" : "#3c3c48";
    if ((i & 7) === 0 || (j & 7) === 0) return hs(c, 0.12);
    if ((i & 7) === 7 || (j & 7) === 7) return hs(c, -0.18);
    return c;
  } },
  red_carpet: { style: "trim", R: 0, px: (i, j, v) => {
    const c = "#b82a3a";
    if ((i + j) % 8 === 0 && (i - j + 16) % 8 === 0) return "#e8b84a";
    return (i + j) % 2 ? vary(c, i, j, v, 0.04) : hs(c, -0.06);
  } },
  mosaic: { style: "kerb", R: 0, px: (i, j) => {
    if (i % 3 === 2 || j % 3 === 2) return "#d8d0bc";
    const cx = Math.floor(i / 3) * 3 + 1, cy = Math.floor(j / 3) * 3 + 1;
    const ring = Math.floor(Math.hypot(cx - 7.5, cy - 7.5) / 2.4);
    return ["#f2c84a", "#3a7ad8", "#ffffff", "#2a5aa8", "#e8a03a", "#3a9a8a"][ring % 6];
  } },
  starlight: { style: "glass", R: 0, px: (i, j, v) => {
    if ((i & 7) === 7 || (j & 7) === 7) return "#0e0e22";
    const r = n1(i, j, v + 8);
    if (r > 0.975) return "#ffffff";
    if (r > 0.955) return "#ffe27a";
    if (r > 0.94) return "#8ad8ff";
    const c = "#22224a";
    return (i & 7) === 0 || (j & 7) === 0 ? "#34346a" : vary(c, i >> 1, j >> 1, (i >> 3) + (j >> 3) * 2, 0.06);
  } },
};

function pathTile(type: string, mask: number, v: number): HTMLCanvasElement {
  const def = PATHS[type];
  const [c, p] = makeCanvas(16, 16);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const base = def.px(i, j, v);
    const { d, side } = edge(i, j, mask, def.R);
    let col: string | null = base;
    switch (def.style) {
      case "soft": {
        const ragged = d + (n1(i, j, v + 31) - 0.5) * 1.6;
        if (ragged < 0.6) col = null;
        else if (ragged < 1.6) col = hs(base, -0.22);
        break;
      }
      case "kerb":
        if (d < 1) col = side === "s" ? "#5a564e" : side === "n" ? "#d8d4c8" : "#b8b4a8";
        else if (d < 2) col = side === "s" ? "#8a867c" : side === "n" ? "#8a867c" : "#a8a49a";
        else if (d < 3 && side === "n") col = hs(base, -0.18); // the kerb's shadow
        break;
      case "trim":
        if (d < 1) col = "#6a1a24";
        else if (d < 2.5) col = d < 1.6 ? "#f2c84a" : "#c8962a";
        break;
      case "board":
        if (d < 1) col = "#3a2614";
        else if (d < 2.5 && side === "s") col = "#5a3a22";
        break;
      case "glass":
        if (d < 1) col = "#8a8aa8";
        else if (d < 2) col = "#5a5a80";
        break;
    }
    if (col) p.px(i, j, col);
  }
  return c;
}

// ------------------------------------------------------------ water
const WATERS = new Set(["pond_water", "lotus_water", "reed_water", "koi_water", "deep_water", "stepping_stones", "boardwalk"]);

function waterTile(type: string, mask: number, same: number, v: number): HTMLCanvasElement {
  const [c, p] = makeCanvas(16, 16);
  const deep = type === "deep_water";
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const { d, side } = edge(i, j, mask, 6);
    const ragged = d + (n1(i, j, v + 41) - 0.5) * 0.9;
    if (ragged < 0.7) continue;
    let col: string;
    if (side === "n" && d < 4.2) {
      // the far bank: a lip of grass, then the face of the earth bank seen from the front
      col = d < 1.6 ? (n1(i, j, v) > 0.5 ? "#3f7a2c" : "#4a8a32") : (j + i) % 3 === 0 ? "#4a3220" : d < 3 ? "#7a5634" : "#5e4228";
    } else if (side === "s" && d < 2.6) {
      col = d < 1.5 ? (n1(i, j, v + 2) > 0.4 ? "#e0d0a0" : "#c8b888") : "#b8e4f0"; // sand and foam
    } else if ((side === "e" || side === "w") && d < 2.4) {
      col = d < 1.5 ? (n1(i >> 1, j, v + 3) > 0.5 ? "#a09a8c" : "#8a8478") : "#a8dcf0";
    } else {
      const shade = side === "n" ? Math.max(0, 1 - (d - 4.2) / 2.5) * 0.35 : 0; // shadow under the far bank
      const t = deep ? 0.6 + Math.min(0.4, d / 20) : Math.min(1, Math.max(0, (d - 2.5) / 9));
      col = mix("#5ab4e4", "#2a64a8", t);
      if (shade) col = hs(col, -shade);
      if (n1(i >> 2, j, v + 5) > 0.9 && (i & 3) !== 3) col = hs(col, 0.32); // ripples
    }
    p.px(i, j, col);
  }
  const rnd = (k: number) => cell(v, k, 77);
  const ell = (cx: number, cy: number, rx: number, ry: number, col: string) => { p.g.fillStyle = col; p.g.beginPath(); p.g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); p.g.fill(); };
  switch (type) {
    case "lotus_water": {
      for (const [x, y] of [[4 + rnd(1) * 2, 5 + rnd(2) * 2], [10 + rnd(3) * 2, 10 + rnd(4) * 2], [11, 4 + rnd(5) * 2]]) {
        ell(x, y + 0.6, 2.8, 1.8, "#2f6a2a"); ell(x, y, 2.8, 1.7, "#4f9a35"); p.px(x + 1, y - 1, "#7ac050"); p.line(x, y, x + 2.5, y, "#2f6a2a");
      }
      const fx = 10 + rnd(3) * 2, fy = 9 + rnd(4) * 2;
      p.px(fx, fy - 1, "#f8b0d0"); p.px(fx - 1, fy, "#e878a8"); p.px(fx + 1, fy, "#e878a8"); p.px(fx, fy, "#fff3a0");
      break;
    }
    case "reed_water":
      for (const [x0, y0] of [[3 + Math.round(rnd(1) * 2), 12], [10 + Math.round(rnd(2) * 2), 9]]) {
        for (let k = 0; k < 4; k++) {
          const x = x0 + k, h = 5 + ((k * 3 + v) % 3);
          p.rect(x, y0 - h, 1, h, k % 2 ? "#5a8a32" : "#7aa83e");
          if (k % 2 === 0) p.rect(x, y0 - h - 2, 1, 2, "#8a5a2a");
        }
        p.rect(x0 - 1, y0, 6, 1, "#3a74a8");
      }
      break;
    case "koi_water":
      for (const [x, y, col] of [[4 + rnd(1) * 3, 6 + rnd(2) * 2, "#f08a2a"], [9 + rnd(3) * 2, 11 + rnd(4), "#ffffff"]] as [number, number, string][]) {
        p.rect(x, y, 4, 2, col); p.px(x + 4, y, hs(col, -0.15)); p.px(x - 1, y + 1, hs(col, -0.2)); p.px(x + 1, y, "#e83a2a"); p.px(x + 3, y, "#1a1a1a");
      }
      break;
    case "stepping_stones":
      for (const [x, y] of [[4, 4], [11, 8], [5, 12]] as [number, number][]) {
        ell(x + 0.5, y + 1.6, 3.2, 1.8, "#2a5a8a"); ell(x, y + 0.6, 3.2, 2, "#6a6860"); ell(x, y, 3, 1.8, "#a8a498"); p.px(x - 1, y - 1, "#d0ccc0");
      }
      break;
    case "boardwalk": {
      // one deck over the whole bridge: boards run across the way it is walked (bit 256: east-west,
      // decided for the whole bridge), rails only along its open sides
      const horiz = (same & 256) !== 0;
      const at = (u: number, w: number, col: string) => p.px(horiz ? u : w, horiz ? w : u, col);
      const sideA = horiz ? N : W, sideB = horiz ? S : E;
      const w0 = same & sideA ? 0 : 3, w1 = same & sideB ? 16 : 13;
      for (let u = 0; u < 16; u++) for (let w = w0; w < w1; w++) {
        const board = (u + v * 3) >> 2;
        let col = u % 4 === 3 ? "#6a4428" : ["#b88050", "#a87444", "#c08a58", "#b07a48"][board % 4];
        if ((w === 5 || w === 10) && u % 4 === 1) col = "#4a2e18"; // nails
        if (w === w0 && !(same & sideA)) col = hs(col, 0.2);
        at(u, w, col);
      }
      if (!(same & sideB)) { for (let u = 0; u < 16; u++) { at(u, 13, "#5a3a22"); at(u, 14, "#3a2614"); at(u, 15, "#2a5a8a"); } }
      // rails and posts on the open long sides
      for (const [open, rw, pw] of [[!(same & sideA), 2, 0], [!(same & sideB), 12, 10]] as [boolean, number, number][]) {
        if (!open) continue;
        for (let u = 0; u < 16; u++) at(u, rw, "#7a4e2c");
        for (const u of [1, 9]) for (let w = pw; w < pw + 3; w++) { at(u, w, "#5a3a22"); at(u + 1, w, "#3a2614"); }
      }
      break;
    }
  }
  return c;
}

// ------------------------------------------------------------ tiles, cached
const cache = new Map<string, HTMLCanvasElement>();
export function floorTile(type: string, mask: number, same: number, v: number): HTMLCanvasElement {
  const water = WATERS.has(type);
  // paths only care about their four sides (inner corners matter to water alone): treat the
  // diagonals as filled so four tiles meeting at a point show no corner dot
  const m = water ? mask : (mask & 15) | NE | SE | SW | NW;
  const key = `${type}|${m}|${type === "boardwalk" ? same & 271 : 0}|${v}`;
  let c = cache.get(key);
  if (!c) {
    c = water ? waterTile(type, m, same, v) : PATHS[type] ? pathTile(type, m, v) : makeCanvas(16, 16)[0];
    cache.set(key, c);
  }
  return c;
}

export const isWaterFloor = (type: string) => WATERS.has(type);

/**
 * Keeps the floors painted into a ground canvas. Only tiles whose piece or neighbours changed
 * are repainted (the ground under them first, through `ground`).
 */
export class FloorLayer {
  private prev = new Map<number, string>();
  private key = -1;
  /** Water tiles (y * SZ_W + x), for the glints drawn live. */
  water: number[] = [];

  reset() { this.prev.clear(); this.key = -1; }

  update(gc: CanvasRenderingContext2D, g: GameState, ground: (x: number, y: number) => void) {
    const k = layoutKey(g);
    if (k === this.key) return;
    this.key = k;
    const cur = new Map<number, string>();
    for (const b of g.buildings) if (BUILDINGS[b.type]?.floor) cur.set(b.y * SZ_W + b.x, b.type);
    const dirty = new Set<number>();
    const mark = (i: number) => { const x = i % SZ_W, y = (i / SZ_W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dirty.add((y + dy) * SZ_W + x + dx); };
    let bridges = false;
    for (const [i, t] of cur) if (this.prev.get(i) !== t) { mark(i); bridges ||= t === "boardwalk"; }
    for (const [i, t] of this.prev) if (cur.get(i) !== t) { mark(i); bridges ||= t === "boardwalk"; }
    // a bridge is drawn as one: when one changes, every bridge tile is redrawn with its bridge's direction
    const across = bridgeDirections(cur);
    if (bridges) for (const i of across.keys()) dirty.add(i);
    const fam = (i: number) => { const t = cur.get(i); return t ? BUILDINGS[t].floor : undefined; };
    for (const i of dirty) {
      if (i < 0) continue;
      const x = i % SZ_W, y = (i / SZ_W) | 0;
      ground(x, y);
      const t = cur.get(i);
      if (!t) continue;
      const f = fam(i);
      let mask = 0, same = 0;
      for (const [dx, dy, bit] of DIRS) {
        const o = (y + dy) * SZ_W + x + dx;
        if (fam(o) === f) mask |= bit;
        if (cur.get(o) === t) same |= bit;
      }
      if (across.get(i)) same |= 256;
      gc.drawImage(floorTile(t, mask, same, Math.floor(cell(x, y, 5) * 4)), x * 16, y * 16);
    }
    this.prev = cur;
    this.water = [...cur].filter(([, t]) => WATERS.has(t)).map(([i]) => i);
  }
}

/**
 * Which way each bridge tile runs: true for east-west. A bridge (boardwalk tiles touching side by
 * side) runs along its longer side; a single tile spans the narrow way across the water around it.
 */
function bridgeDirections(cur: Map<number, string>): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const isB = (i: number) => cur.get(i) === "boardwalk";
  const isW = (i: number) => WATERS.has(cur.get(i) ?? "");
  for (const [start, t] of cur) {
    if (t !== "boardwalk" || out.has(start)) continue;
    const part: number[] = [start];
    out.set(start, false);
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let k = 0; k < part.length; k++) {
      const i = part[k], x = i % SZ_W, y = (i / SZ_W) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const o of [i - SZ_W, i + SZ_W, i - 1, i + 1]) if (isB(o) && !out.has(o)) { out.set(o, false); part.push(o); }
    }
    let horiz = x1 - x0 > y1 - y0;
    if (x1 - x0 === y1 - y0) {
      // square: cross towards the land that is nearer (water on both sides of the other way)
      const wet = (dx: number, dy: number) => part.every((i) => isW(i + dy * SZ_W + dx) || isB(i + dy * SZ_W + dx));
      horiz = !(wet(-1, 0) && wet(1, 0)) && wet(0, -1) && wet(0, 1);
    }
    // each tile follows the longer of its own row and column of bridge, so the arms of a cross
    // or an L each run their own way; a tie keeps the bridge's direction
    const run = (i: number, step: number) => { let n = 1; for (let o = i + step; isB(o); o += step) n++; for (let o = i - step; isB(o); o -= step) n++; return n; };
    for (const i of part) { const hr = run(i, 1), vr = run(i, SZ_W); out.set(i, hr === vr ? horiz : hr > vr); }
  }
  return out;
}

/** Sun glints twinkling on water in view. */
export function waterGlints(c: CanvasRenderingContext2D, water: number[], t: number, sx: (x: number) => number, sy: (y: number) => number, tile: number, vr: { x0: number; y0: number; x1: number; y1: number }) {
  const px = Math.max(1, Math.round(tile / 16));
  c.fillStyle = "rgba(240,252,255,0.9)";
  for (const i of water) {
    const x = i % SZ_W, y = (i / SZ_W) | 0;
    if (x < vr.x0 - 1 || x > vr.x1 + 1 || y < vr.y0 - 1 || y > vr.y1 + 1) continue;
    for (let k = 0; k < 2; k++) {
      const ph = cell(x, y, 60 + k);
      if (Math.sin(t / 700 + ph * 40) < 0.93) continue;
      const gx = 4 + Math.floor(cell(x, y, 70 + k) * 8), gy = 5 + Math.floor(cell(x, y, 80 + k) * 7);
      c.fillRect(sx(x) + (gx * tile) / 16, sy(y) + (gy * tile) / 16, px * 2, px);
    }
  }
}
