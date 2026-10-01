import { iconCanvas } from "./icons";
import { hs, outline, type Paint } from "./palette";

/**
 * Houses drawn in a three-quarter top-down view at 16px per tile: a deep roof seen from above
 * (staggered shingles, ridge cap, bargeboards, eave shadow), walls of real materials (siding,
 * planks, logs, stone, brick, timber frame) lit from the upper left, framed windows with sills
 * and glass, a door with a step, and hanging signs, lanterns and chimneys that are attached to
 * the building instead of floating next to it.
 */

export type WallKind = "siding" | "plank" | "log" | "stone" | "brick" | "timber";
export type RoofKind = "shingle" | "thatch" | "slate" | "tile";

export interface HouseOpts {
  wall: string;
  roof: string;
  /** "wood" and "plaster" are older names for "siding" and "timber". */
  wallKind?: WallKind | "wood" | "plaster";
  roofKind?: RoofKind;
  /** Window frames, door frame, fascia. */
  trim?: string;
  door?: string;
  chimney?: boolean;
  emblem?: string;
  floors?: number;
  lit?: boolean;
  /** A front-facing gable over the middle (temples, libraries, halls). */
  gable?: boolean;
  shutters?: string;
  /** Barrels and crates by the door. */
  props?: boolean;
  /** Small roof windows. */
  dormer?: boolean;
  /** Upgrade level: a pennant flies from the ridge from level 2. */
  level?: number;
  seed?: string;
}

export const DARKWOOD = "#6a4428";
export const STONE = "#9a9aa0";
const IRON = "#3a3640";
const SHADOW = "rgba(24,12,40,0.32)";

// ------------------------------------------------------------ tiny seeded noise
function rng(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stable per-cell noise in [0, 1). */
export const cell = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------ walls
function normWall(k: HouseOpts["wallKind"]): WallKind {
  return k === "wood" || k === undefined ? "siding" : k === "plaster" ? "timber" : k;
}

/** Fills a wall rectangle with a material, lit from the upper left. */
export function wallTex(p: Paint, x: number, y: number, w: number, h: number, col: string, kind: WallKind, s = 0) {
  p.rect(x, y, w, h, col);
  switch (kind) {
    case "siding":
      for (let yy = y, row = 0; yy < y + h; yy += 3, row++) {
        const c = hs(col, (cell(row, 0, s) - 0.5) * 0.12);
        p.rect(x, yy, w, 3, c);
        p.rect(x, yy, w, 1, hs(c, 0.14));
        p.rect(x, yy + 2, w, 1, hs(c, -0.24));
        if (cell(row, 1, s) > 0.5) p.px(x + 2 + Math.floor(cell(row, 2, s) * (w - 4)), yy + 1, hs(c, -0.3));
      }
      break;
    case "plank":
      for (let xx = x, col_ = 0; xx < x + w; xx += 3, col_++) {
        const c = hs(col, (cell(col_, 3, s) - 0.5) * 0.14);
        p.rect(xx, y, 3, h, c);
        p.rect(xx, y, 1, h, hs(c, -0.32));
        p.px(xx + 1, y, hs(c, 0.2));
        if (cell(col_, 4, s) > 0.6) p.px(xx + 1, y + 2 + Math.floor(cell(col_, 5, s) * (h - 4)), hs(c, -0.25));
      }
      break;
    case "log":
      for (let yy = y, row = 0; yy < y + h; yy += 3, row++) {
        const c = hs(col, (cell(row, 6, s) - 0.5) * 0.1);
        p.rect(x, yy, w, 1, hs(c, 0.22));
        p.rect(x, yy + 1, w, 1, c);
        p.rect(x, yy + 2, w, 1, hs(c, -0.34));
        // log ends poking out at the corners
        for (const ex of [x - 1, x + w - 1]) { p.rect(ex, yy, 2, 3, hs(c, 0.3)); p.px(ex + (ex < x ? 1 : 0), yy + 1, hs(c, -0.05)); p.px(ex, yy + 2, hs(c, -0.3)); }
      }
      break;
    case "stone": {
      const mortar = hs(col, -0.38);
      p.rect(x, y, w, h, mortar);
      for (let yy = y, row = 0; yy < y + h; row++) {
        const rh = 3 + (cell(row, 7, s) > 0.6 ? 1 : 0);
        let xx = x - Math.floor(cell(row, 8, s) * 4);
        for (let k = 0; xx < x + w; k++) {
          const bw = 4 + Math.floor(cell(row, 9 + k, s) * 4);
          const c = hs(col, (cell(row * 7 + k, 10, s) - 0.5) * 0.18);
          const x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + bw - 1);
          if (x1 > x0) {
            const hh = Math.min(rh - 1, y + h - yy);
            p.rect(x0, yy, x1 - x0, hh, c);
            p.rect(x0, yy, x1 - x0, 1, hs(c, 0.2));
            p.rect(x0, yy, 1, hh, hs(c, 0.12));
            if (hh > 1) p.rect(x0 + 1, yy + hh - 1, x1 - x0 - 1, 1, hs(c, -0.18));
          }
          xx += bw;
        }
        yy += rh;
      }
      break;
    }
    case "brick": {
      p.rect(x, y, w, h, hs("#d8ccb8", -0.1));
      for (let yy = y, row = 0; yy < y + h; yy += 3, row++) {
        for (let xx = x - (row % 2 ? 2 : 0), k = 0; xx < x + w; xx += 5, k++) {
          const c = hs(col, (cell(row, k, s) - 0.5) * 0.2);
          const x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + 4);
          if (x1 > x0) { p.rect(x0, yy, x1 - x0, 2, c); p.rect(x0, yy, x1 - x0, 1, hs(c, 0.12)); }
        }
      }
      break;
    }
    case "timber": {
      for (let i = 0; i < (w * h) / 10; i++) p.px(x + Math.floor(cell(i, 11, s) * w), y + Math.floor(cell(i, 12, s) * h), hs(col, -0.07));
      const beam = DARKWOOD;
      p.rect(x, y, 2, h, beam);
      p.rect(x + w - 2, y, 2, h, beam);
      p.rect(x, y + 2, w, 2, beam);
      const panels = Math.max(1, Math.round(w / 12));
      for (let k = 1; k < panels; k++) p.rect(x + Math.round((k * w) / panels) - 1, y + 2, 2, h - 2, beam);
      // diagonal braces in the outer panels
      const pw = Math.round(w / panels);
      if (h > 8) { p.line(x + 2, y + h - 1, x + Math.min(pw - 2, h - 4), y + 4, beam); p.line(x + w - 3, y + h - 1, x + w - 1 - Math.min(pw - 2, h - 4), y + 4, beam); }
      p.rect(x, y + 2, w, 1, hs(beam, 0.2));
      break;
    }
  }
  // light from the upper left: lit left edge, shaded right edge, a little occlusion at the base
  p.rect(x, y, 1, h, outline(col));
  p.rect(x + w - 1, y, 1, h, outline(col));
  p.g.fillStyle = "rgba(255,240,210,0.10)";
  p.g.fillRect(x + 1, y, 2, h);
  p.g.fillStyle = "rgba(20,10,40,0.12)";
  p.g.fillRect(x + w - 4, y, 3, h);
  p.g.fillRect(x + 1, y + h - 1, w - 2, 1);
}

/** Cobble foundation, three rows high. */
export function foundation(p: Paint, x: number, y: number, w: number, col = STONE) {
  p.rect(x, y, w, 3, hs(col, -0.3));
  for (let xx = x, k = 0; xx < x + w; k++) {
    const bw = 3 + Math.floor(cell(k, 20) * 3);
    const c = hs(col, (cell(k, 21) - 0.5) * 0.2);
    p.rect(xx, y, Math.min(bw - 1, x + w - xx), 2, c);
    p.px(xx, y, hs(c, 0.3));
    xx += bw;
  }
  p.rect(x, y + 2, w, 1, outline(col));
}

/** Contact shadow on the ground under the building. */
export function groundShadow(p: Paint, W: number, H: number, inset = 0) {
  p.g.fillStyle = SHADOW;
  p.g.fillRect(inset + 1, H - 2, W - inset * 2, 2);
  p.g.fillStyle = "rgba(24,12,40,0.16)";
  p.g.fillRect(inset + 2, H - 1, W - inset * 2, 1);
}

// ------------------------------------------------------------ roofs
/** Colour of one roof pixel for a material (i: row from the ridge, x: column, t: 0 at ridge .. 1 at eave). */
function roofPx(kind: RoofKind, col: string, x: number, i: number, t: number, xr: number, s: number): string {
  const light = 0.07 - xr * 0.14 - t * 0.08; // brighter towards the upper left
  switch (kind) {
    case "shingle": {
      const row = Math.floor(i / 3), within = i % 3, off = row % 2 ? 2 : 0;
      const tile = Math.floor((x + off) / 4), wx = (x + off) % 4;
      const base = hs(col, light + (cell(row, tile, s) - 0.5) * 0.12);
      if (within === 2) return hs(base, -0.3);
      if (wx === 3) return hs(base, -0.36);
      return within === 0 && wx < 3 ? hs(base, 0.16) : base;
    }
    case "slate": {
      const row = Math.floor(i / 2), within = i % 2, off = row % 2 ? 1 : 0;
      const tile = Math.floor((x + off) / 3), wx = (x + off) % 3;
      const base = hs(col, light + (cell(row, tile, s) - 0.5) * 0.16);
      if (within === 1) return hs(base, -0.28);
      return wx === 2 ? hs(base, -0.22) : wx === 0 ? hs(base, 0.12) : base;
    }
    case "tile": {
      const wx = x % 3, within = i % 3;
      const base = hs(col, light + (cell(Math.floor(i / 3), Math.floor(x / 3), s) - 0.5) * 0.08);
      if (within === 2) return hs(base, -0.34);
      return wx === 0 ? hs(base, 0.22) : wx === 2 ? hs(base, -0.22) : base;
    }
    case "thatch": {
      const band = Math.floor(i / 3);
      const base = hs(col, light + (cell(x, band, s) - 0.5) * 0.22);
      if (i % 3 === 2 && cell(x, i, s) > 0.35) return hs(base, -0.3);
      return cell(x, i + 50, s) > 0.8 ? hs(base, 0.2) : base;
    }
  }
}

/**
 * Side-gable roof seen from above: a trapezoid from the ridge (top) to the eave (bottom), with
 * a ridge cap, dark bargeboards along the slanted ends and a fascia over the wall's shadow.
 */
export function roofSlab(p: Paint, x0: number, x1: number, top: number, eave: number, col: string, kind: RoofKind, s = 0) {
  const h = eave - top + 1;
  const inset = Math.max(1, Math.min(Math.round(h * 0.42), Math.floor((x1 - x0) / 2) - 4));
  const span = x1 - x0;
  for (let i = 0; i < h; i++) {
    const t = h > 1 ? i / (h - 1) : 1;
    const l = x0 + Math.round(inset * (1 - t)), r = x1 - Math.round(inset * (1 - t));
    for (let x = l; x <= r; x++) p.px(x, top + i, roofPx(kind, col, x - x0, i, t, (x - x0) / span, s));
    // bargeboards: lit on the left end, shaded on the right
    p.px(l, top + i, outline(col)); p.px(l + 1, top + i, hs(col, 0.32));
    p.px(r, top + i, outline(col)); p.px(r - 1, top + i, hs(col, -0.42));
  }
  // ridge cap
  const rl = x0 + inset, rr = x1 - inset;
  p.rect(rl, top - 2, rr - rl + 1, 2, hs(col, -0.12));
  p.rect(rl, top - 2, rr - rl + 1, 1, hs(col, 0.2));
  p.rect(rl - 1, top - 3, rr - rl + 3, 1, outline(col));
  p.px(rl - 1, top - 2, outline(col)); p.px(rr + 1, top - 2, outline(col));
  // thatch hangs over in a ragged fringe, the rest gets a straight fascia
  if (kind === "thatch") for (let x = x0; x <= x1; x++) { if (cell(x, 99, s) > 0.4) p.px(x, eave + 1, hs(col, -0.35)); }
  else p.rect(x0, eave + 1, span + 1, 1, outline(col));
  return { ridgeL: rl, ridgeR: rr };
}

/** Front-facing gable over the middle: a wall triangle with an attic window, framed by the roof. */
function frontGable(p: Paint, cx: number, base: number, half: number, o: HouseOpts, wall: WallKind, s: number) {
  const apex = base - Math.round(half * 0.9);
  p.g.save();
  p.g.beginPath();
  p.g.moveTo(cx - half, base + 1); p.g.lineTo(cx, apex); p.g.lineTo(cx + 1, apex); p.g.lineTo(cx + half + 1, base + 1);
  p.g.closePath();
  p.g.clip();
  wallTex(p, cx - half, apex, half * 2 + 1, base - apex + 1, o.wall, wall === "timber" ? "timber" : wall, s + 7);
  p.g.restore();
  // round attic window
  const wy = base - Math.round((base - apex) * 0.55);
  p.rect(cx - 2, wy - 2, 5, 5, o.trim ?? "#f0e4c8");
  p.rect(cx - 1, wy - 1, 3, 3, o.lit === false ? "#5a86b0" : "#ffd878");
  p.px(cx - 1, wy - 1, "#fff4c0");
  p.px(cx - 2, wy - 2, "rgba(0,0,0,0)");
  // the roof's edge boards follow both slopes
  const rc = o.roof;
  for (let i = 0; i <= base - apex + 2; i++) {
    const y = apex - 2 + i;
    const hw = Math.round(((i - 1) / Math.max(1, base - apex + 1)) * (half + 2));
    for (let k = 0; k < 3; k++) {
      p.px(cx - hw - k, y, k === 0 ? hs(rc, 0.25) : k === 1 ? rc : outline(rc));
      p.px(cx + 1 + hw + k, y, k === 0 ? hs(rc, -0.2) : k === 1 ? hs(rc, -0.35) : outline(rc));
    }
  }
}

// ------------------------------------------------------------ openings & details
export function windowAt(p: Paint, x: number, y: number, o: { w?: number; h?: number; lit?: boolean; trim?: string; shutters?: string; box?: boolean } = {}) {
  const w = o.w ?? 6, h = o.h ?? 7, trim = o.trim ?? "#f0e4c8";
  if (o.shutters) for (const sx of [x - 3, x + w + 1]) { p.rect(sx, y, 2, h, o.shutters); for (let yy = y + 1; yy < y + h; yy += 2) p.rect(sx, yy, 2, 1, hs(o.shutters, -0.25)); p.rect(sx, y, 2, 1, hs(o.shutters, 0.2)); }
  p.rect(x - 1, y - 1, w + 2, h + 2, outline(trim));
  p.rect(x, y, w, h, trim);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  for (let yy = 0; yy < gh; yy++) {
    const t = yy / Math.max(1, gh - 1);
    p.rect(gx, gy + yy, gw, 1, o.lit ? (t < 0.5 ? "#ffe9a8" : "#f2b85a") : t < 0.4 ? "#7ab0d8" : "#3e6a94");
  }
  // reflection streak / warm core
  if (o.lit) { p.rect(gx + 1, gy + 1, Math.max(1, gw - 2), Math.max(1, gh - 3), "#fff2c4"); }
  else { p.px(gx, gy, "#d8f0ff"); p.px(gx + 1, gy, "#b0dcf4"); p.px(gx, gy + 1, "#b0dcf4"); }
  // mullions
  p.rect(x + Math.floor(w / 2), gy, 1, gh, trim);
  p.rect(gx, y + Math.floor(h / 2), gw, 1, trim);
  // sill and its shadow
  p.rect(x - 1, y + h, w + 2, 1, hs(trim, -0.12));
  p.g.fillStyle = SHADOW; p.g.fillRect(x - 1, y + h + 1, w + 2, 1);
  if (o.box) {
    p.rect(x - 1, y + h + 1, w + 2, 2, DARKWOOD);
    p.rect(x - 1, y + h + 1, w + 2, 1, hs(DARKWOOD, 0.25));
    for (let i = 0; i < w + 2; i++) {
      const fl = ["#e84a6a", "#f7d44c", "#ffffff", "#b88aff", "#f28a3a"][Math.floor(cell(x + i, y) * 5)];
      p.px(x - 1 + i, y + h, i % 2 ? "#4f9a35" : fl);
    }
  }
}

export function doorAt(p: Paint, x: number, y: number, o: { w?: number; h?: number; col?: string; trim?: string; arch?: boolean; double?: boolean } = {}) {
  const w = o.w ?? 6, h = o.h ?? 9, col = o.col ?? "#8a5230", trim = o.trim ?? hs(DARKWOOD, -0.1);
  p.rect(x - 1, y - 1, w + 2, h + 1, trim);
  p.rect(x - 2, y - 2, w + 4, 1, outline(trim));
  p.rect(x, y, w, h, col);
  for (let xx = x + 1; xx < x + w; xx += 2) p.rect(xx, y, 1, h, hs(col, -0.18));
  p.rect(x, y, 1, h, hs(col, 0.2));
  p.rect(x, y + 2, w, 1, hs(col, -0.3));
  p.rect(x, y + h - 3, w, 1, hs(col, -0.3));
  if (o.double) p.rect(x + Math.floor(w / 2), y, 1, h, outline(col));
  if (o.arch) { p.px(x, y, trim); p.px(x + w - 1, y, trim); p.rect(x + 1, y - 1, w - 2, 1, trim); }
  p.px(x + w - 2, y + Math.floor(h / 2), "#f2c230");
  if (o.double) p.px(x + Math.floor(w / 2) - 2, y + Math.floor(h / 2), "#f2c230");
  // stone step
  p.rect(x - 2, y + h, w + 4, 2, hs(STONE, 0.1));
  p.rect(x - 2, y + h, w + 4, 1, hs(STONE, 0.35));
  p.rect(x - 2, y + h + 1, w + 4, 1, hs(STONE, -0.25));
}

export function lantern(p: Paint, x: number, y: number) {
  p.g.fillStyle = "rgba(255,210,110,0.22)";
  p.g.beginPath(); p.g.arc(x + 1.5, y + 3, 4.5, 0, Math.PI * 2); p.g.fill();
  p.rect(x + 1, y - 1, 1, 1, IRON);
  p.rect(x, y, 3, 1, IRON);
  p.rect(x, y + 1, 3, 3, "#ffd25a");
  p.px(x + 1, y + 2, "#fff6c8");
  p.rect(x, y + 4, 3, 1, IRON);
}

/** A sign on an iron bracket sticking out of the wall at (x, y). */
export function hangingSign(p: Paint, x: number, y: number, emblem: string) {
  p.rect(x, y, 11, 1, IRON);
  p.px(x, y - 1, IRON); p.px(x + 10, y + 1, IRON);
  p.px(x + 2, y + 1, IRON); p.px(x + 8, y + 1, IRON);
  const bx = x + 1, by = y + 2, board = "#c89a5a";
  p.rect(bx - 1, by - 1, 11, 10, outline(board));
  p.rect(bx, by, 9, 8, board);
  p.rect(bx, by, 9, 1, hs(board, 0.3));
  p.rect(bx, by + 7, 9, 1, hs(board, -0.3));
  p.g.drawImage(iconCanvas(emblem, EMBLEM_PAL[emblem] ?? ["#f2c542", "#8a5a2a", "#ffffff"], 1), 0, 0, 16, 16, bx + 1, by, 8, 8);
  p.g.fillStyle = SHADOW; p.g.fillRect(bx + 1, by + 9, 9, 1);
}

export const EMBLEM_PAL: Record<string, [string, string, string]> = {
  egg: ["#f4efe6", "#d8c8a0", "#ffffff"], bottle: ["#f4f4f4", "#a0c8e8", "#ffffff"], wool: ["#f4f4f4", "#c8c8c8", "#ffffff"],
  log: ["#8a5a2a", "#c8a070", "#5a3a1e"], stone: ["#8a8f96", "#6a6e76", "#b0b4ba"], ore: ["#6a6e76", "#e08a3a", "#f2c542"],
  coin: ["#f2c542", "#c8902a", "#fff4b0"], bowl: ["#c8a070", "#f2c542", "#e04a2a"], ingot: ["#b0b4ba", "#e8e8f0", "#6a6e76"],
  plank: ["#c8a070", "#8a5a2a", "#e8c890"], block: ["#9a9ea4", "#6a6e76", "#c0c4ca"], cloth: ["#c870a0", "#f0c0d8", "#8a3a6a"],
  potion: ["#e04a4a", "#c8e0f0", "#ffffff"], book: ["#3a4a9a", "#f2c542", "#ffffff"], cup: ["#c8a070", "#f2e0a0", "#ffffff"], herb: ["#4ab04a", "#2a7a3a", "#a0e080"],
};

export function chimney(p: Paint, x: number, top: number, bottom: number, col = "#a8503a") {
  const h = bottom - top;
  p.rect(x, top, 5, h, col);
  for (let yy = top + 2, r = 0; yy < bottom; yy += 2, r++) { p.rect(x, yy, 5, 1, hs(col, -0.28)); p.px(x + (r % 2 ? 2 : 0), yy - 1, hs(col, -0.2)); }
  p.rect(x, top, 1, h, hs(col, 0.25));
  p.rect(x + 4, top, 1, h, outline(col));
  p.rect(x - 1, top - 2, 7, 2, hs(STONE, -0.05));
  p.rect(x - 1, top - 2, 7, 1, hs(STONE, 0.3));
  p.rect(x, top - 2, 5, 1, "#2a2026");
  for (const [dx, dy, r, a] of [[2, -5, 2, 0.5], [4, -9, 2.5, 0.38], [3, -14, 3, 0.25]] as const) {
    p.g.fillStyle = `rgba(232,232,240,${a})`;
    p.g.beginPath(); p.g.arc(x + dx, top + dy, r, 0, Math.PI * 2); p.g.fill();
  }
}

export function pennant(p: Paint, x: number, y: number, col: string) {
  p.rect(x, y - 8, 1, 9, "#4a3a2a");
  p.px(x, y - 9, "#f2c230");
  for (let i = 0; i < 3; i++) p.rect(x + 1, y - 8 + i, 5 - i * 2, 1, i === 0 ? hs(col, 0.2) : col);
  p.px(x + 1, y - 5, hs(col, -0.3));
}

export function barrel(p: Paint, x: number, y: number) {
  const c = "#9a6236";
  p.rect(x, y, 4, 5, c);
  p.rect(x, y, 1, 5, hs(c, 0.25));
  p.rect(x + 3, y, 1, 5, hs(c, -0.3));
  p.rect(x, y + 1, 4, 1, "#4a4448"); p.rect(x, y + 3, 4, 1, "#4a4448");
  p.rect(x, y - 1, 4, 1, hs(c, -0.15));
  p.rect(x - 1, y, 1, 5, outline(c)); p.rect(x + 4, y, 1, 5, outline(c)); p.rect(x, y + 5, 4, 1, outline(c));
}

export function crate(p: Paint, x: number, y: number) {
  const c = "#c08a50";
  p.rect(x, y, 5, 4, c);
  p.rect(x, y, 5, 1, hs(c, 0.25));
  p.line(x, y + 1, x + 4, y + 3, hs(c, -0.3));
  p.rect(x - 1, y, 1, 4, outline(c)); p.rect(x + 5, y, 1, 4, outline(c)); p.rect(x - 1, y + 4, 7, 1, outline(c));
}

// ------------------------------------------------------------ the house
export function house(p: Paint, W: number, H: number, o: HouseOpts) {
  const s = Math.floor(rng(o.seed ?? `${o.wall}${o.roof}`)() * 1000);
  // upgrades show in the materials: better walls and roofs, shutters, dormers, gilded trim
  const lv = o.level ?? 1;
  let wall = normWall(o.wallKind);
  if (lv >= 3 && (wall === "plank" || wall === "log")) wall = "timber";
  let roofKind = o.roofKind ?? "shingle";
  if (lv >= 3 && roofKind === "thatch") roofKind = "shingle";
  if (lv >= 4 && roofKind === "shingle") roofKind = "tile";
  if (lv >= 2 && !o.shutters) o = { ...o, shutters: hs(o.roof, -0.1) };
  if (lv >= 3 && !o.chimney && W >= 32) o = { ...o, chimney: true };
  if (lv >= 4) o = { ...o, dormer: true };
  const trim = lv >= 5 ? "#f2d27a" : o.trim ?? (wall === "stone" || wall === "brick" ? "#e8dcc4" : "#f0e4c8");
  const floors = o.floors ?? 1;
  const foundTop = H - 5;
  const wallH = (W <= 32 ? 15 : 16) + (floors - 1) * 10;
  const wallTop = foundTop - wallH;
  const eave = wallTop + 1;
  const roofH = Math.max(10, Math.min(Math.round(W * 0.46), eave - 3));
  const roofTop = eave - roofH + 1;

  groundShadow(p, W, H);
  wallTex(p, 1, wallTop, W - 2, wallH, o.wall, wall, s);
  foundation(p, 0, foundTop, W, lv >= 5 ? "#e8e4d8" : lv >= 3 ? "#b8b4a8" : STONE);
  const { ridgeL } = roofSlab(p, 0, W - 1, roofTop, eave, o.roof, roofKind, s);
  // the roof's shadow on the top of the wall
  p.g.fillStyle = SHADOW; p.g.fillRect(1, eave + 2, W - 2, 2);
  p.g.fillStyle = "rgba(24,12,40,0.14)"; p.g.fillRect(1, eave + 4, W - 2, 1);

  if (o.gable && W >= 32) frontGable(p, Math.floor(W / 2) - (W % 2 ? 0 : 1), eave, Math.min(Math.round(W * 0.22), Math.floor(roofH * 0.9)), o, wall, s);
  if (o.dormer && W >= 48) {
    for (const dx of [Math.round(W * 0.25), Math.round(W * 0.75) - 6]) {
      const dy = roofTop + Math.round(roofH * 0.35);
      // cheeks, a little gable roof, and the window
      p.rect(dx, dy - 1, 6, 7, o.wall); p.rect(dx, dy - 1, 1, 7, outline(o.wall)); p.rect(dx + 5, dy - 1, 1, 7, outline(o.wall));
      windowAt(p, dx + 1, dy, { w: 4, h: 5, lit: o.lit !== false, trim });
      for (let i = 0; i < 4; i++) { p.rect(dx + 3 - i - 1, dy - 5 + i, 2 * i + 2, 1, i === 3 ? outline(o.roof) : hs(o.roof, 0.1 - i * 0.08)); p.px(dx + 2 - i, dy - 5 + i, outline(o.roof)); p.px(dx + 3 + i, dy - 5 + i, outline(o.roof)); }
      p.g.fillStyle = SHADOW; p.g.fillRect(dx, dy + 6, 6, 1);
    }
  }
  if (o.chimney) chimney(p, W - 13, Math.max(3, roofTop - 3), roofTop + Math.round(roofH * 0.45));

  // door, ground-floor windows (a shop hangs its sign where the right window would be)
  const doorH = Math.min(10, wallH - 4), doorW = W >= 48 ? 8 : 6;
  const doorX = Math.round(W / 2 - doorW / 2), doorY = foundTop - doorH;
  const lit = o.lit !== false;
  const winY = doorY + 2;
  const left = W >= 48 ? [5, 14] : [4];
  const right = W >= 48 ? [W - 11, W - 20] : [W - 10];
  for (const x of left) if (x + 6 < doorX - 1) windowAt(p, x, winY, { lit, trim, box: true, shutters: o.shutters });
  if (o.emblem) {
    hangingSign(p, W - 13, wallTop + 4, o.emblem);
    if (W >= 48) windowAt(p, right[1], winY, { lit, trim, box: true, shutters: o.shutters });
  } else for (const x of right) if (x > doorX + doorW + 1) windowAt(p, x, winY, { lit, trim, box: true, shutters: o.shutters });
  // upper floors
  for (let f = 1; f < floors; f++) {
    const y = winY - f * 10;
    if (y < eave + 4) break;
    const slots = W >= 48 ? [5, 14, W - 20, W - 11] : [4, W - 10];
    for (const x of slots) windowAt(p, x, y, { lit: lit && f === 1, trim, shutters: o.shutters });
    if (W >= 48) windowAt(p, doorX + Math.floor(doorW / 2) - 3, y, { lit: false, trim });
  }
  doorAt(p, doorX, doorY, { w: doorW, h: doorH, col: o.door, double: doorW >= 8, arch: o.gable });
  // a lantern by the door wherever there is room for it
  const lx = doorX + doorW + 2;
  const signFrom = W - 13;
  if (W >= 48) {
    if (!o.emblem || lx + 3 < signFrom) lantern(p, lx, doorY + 1);
    else lantern(p, doorX - 5, doorY + 1);
  }
  if (o.props && W >= 48) { barrel(p, W - 7, H - 10); crate(p, 2, H - 9); }
  if ((o.level ?? 1) >= 2) pennant(p, ridgeL + 2, roofTop - 3, (o.level ?? 1) >= 4 ? "#f2c230" : (o.level ?? 1) >= 3 ? "#3a8ad8" : "#d83a3a");

}
