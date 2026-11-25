/**
 * Furniture, fittings and building parts for explore mode, in FantasyLand's three-quarter
 * top-down style at 16px per tile (drawn into the world at 2x). Every sprite's bottom edge is
 * the ground line it stands on; wall pieces are drawn to hang on a two-row wall face (32px).
 * Light comes from the upper left: tops are lit, fronts are shaded, outlines follow the local
 * colour. Flames are not baked in: the explore view draws them live at the points given by
 * `FLAMES`.
 */
import { cell, doorAt, wallTex, windowAt } from "../../render/houses";
import { hs, makeCanvas, mix, outline, rgba, type Paint } from "../../render/palette";

const memo = <T>(make: (k: string) => T) => {
  const m = new Map<string, T>();
  return (k: string) => { let v = m.get(k); if (v === undefined) { v = make(k); m.set(k, v); } return v; };
};
const ell = (p: Paint, cx: number, cy: number, rx: number, ry: number, col: string) => {
  p.g.fillStyle = col; p.g.beginPath(); p.g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); p.g.fill();
};
export function poly(p: Paint, pts: [number, number][], col: string) {
  const ys = pts.map((q) => q[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) p.rect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1, col);
  }
}
const shadow = (p: Paint, cx: number, cy: number, rx: number, ry = 2) => {
  ell(p, cx + 1, cy, rx + 1, ry + 0.5, "rgba(24,12,40,.18)");
  ell(p, cx, cy, rx * 0.8, ry * 0.7, "rgba(24,12,40,.2)");
};
/** A box seen from three-quarters: a lit top face over a shaded front face, outlined. */
function box(p: Paint, x: number, y: number, w: number, top: number, front: number, col: string, o: { grain?: boolean; panels?: number } = {}) {
  p.rect(x, y, w, top, hs(col, 0.14));
  p.rect(x, y, w, 1, hs(col, 0.34));
  if (o.grain) for (let yy = y + 2; yy < y + top; yy += 2) p.rect(x + 1, yy, w - 2, 1, hs(col, 0.06 + (cell(yy, x, 3) - 0.5) * 0.08));
  p.rect(x, y + top, w, front, hs(col, -0.16));
  p.rect(x, y + top, w, 1, hs(col, -0.34));
  if (o.panels) {
    const pw = (w - 2) / o.panels;
    for (let k = 0; k < o.panels; k++) {
      const px = Math.round(x + 1 + k * pw);
      p.rect(px + 1, y + top + 2, Math.round(pw) - 2, front - 4, hs(col, -0.24));
      p.rect(px + 1, y + top + 2, Math.round(pw) - 2, 1, hs(col, -0.36));
      p.rect(px + 1, y + top + front - 3, Math.round(pw) - 2, 1, hs(col, -0.06));
    }
  }
  p.rect(x - 1, y, 1, top + front, outline(col));
  p.rect(x + w, y, 1, top + front, outline(col));
  p.rect(x, y - 1, w, 1, outline(col));
  p.rect(x, y + top + front, w, 1, outline(col));
}

// ------------------------------------------------------------ table-top things (small, reused)
const MUG = (p: Paint, x: number, y: number) => { p.rect(x, y, 3, 4, "#8a5a32"); p.rect(x, y, 3, 1, "#f4ecd8"); p.px(x + 1, y, "#fffaf0"); p.px(x + 3, y + 1, "#6a4428"); p.px(x + 3, y + 2, "#6a4428"); p.rect(x, y + 3, 3, 1, "#5a3a22"); };
const BOTTLE = (p: Paint, x: number, y: number, col: string) => { p.rect(x, y + 2, 2, 4, col); p.px(x, y + 1, hs(col, -0.2)); p.px(x, y, "#c8a070"); p.px(x, y + 3, hs(col, 0.5)); p.px(x + 1, y + 5, hs(col, -0.35)); };
const PLATE = (p: Paint, x: number, y: number, food: number) => {
  ell(p, x + 2.5, y + 1.5, 3, 1.6, "#e8e4dc"); ell(p, x + 2.5, y + 1.3, 2, 1, "#d0ccc4");
  if (food === 0) { p.rect(x + 1, y, 3, 2, "#c8843a"); p.px(x + 1, y, "#e8a85a"); }
  else if (food === 1) { p.rect(x + 1, y, 2, 2, "#a8603a"); p.px(x + 3, y + 1, "#7aa83e"); p.px(x + 1, y, "#c8784a"); }
  else { p.rect(x + 1, y + 1, 3, 1, "#e8c870"); p.px(x + 2, y, "#f0d890"); }
};
const BREAD = (p: Paint, x: number, y: number) => { ell(p, x + 2.5, y + 1.5, 3, 1.8, "#a8682e"); ell(p, x + 2, y + 1, 2, 1, "#d8a060"); p.px(x + 1, y + 1, "#7a4a1e"); p.px(x + 3, y + 1, "#7a4a1e"); };
const ROAST = (p: Paint, x: number, y: number) => { ell(p, x + 4, y + 3, 5, 2, "#e8e4dc"); ell(p, x + 4, y + 2, 3.5, 2, "#a8501e"); ell(p, x + 3, y + 1.5, 2, 1, "#d8803a"); p.rect(x + 7, y + 1, 2, 1, "#f0e4c8"); p.px(x, y + 2, "#f0e4c8"); };
const CANDLE = (p: Paint, x: number, y: number, h = 4) => { p.rect(x - 1, y + h, 3, 1, "#8a8070"); p.rect(x, y, 1, h, "#f4ecd8"); p.px(x, y - 1, "#2a1a10"); };
const APPLES = (p: Paint, x: number, y: number) => { for (const [dx, dy, c] of [[0, 1, "#c8302a"], [2, 0, "#d84a2a"], [3, 2, "#8ab03a"], [1, 2, "#c8302a"]] as const) { p.rect(x + dx, y + dy, 2, 2, c); p.px(x + dx, y + dy, hs(c, 0.4)); } };
const POTION = (p: Paint, x: number, y: number, col: string) => { p.rect(x, y + 2, 3, 3, col); p.px(x + 1, y + 1, "#c8c0b0"); p.px(x + 1, y, "#8a5a32"); p.px(x, y + 2, hs(col, 0.5)); p.rect(x, y + 5, 3, 1, hs(col, -0.4)); };
const BOOKS = (p: Paint, x: number, y: number, n: number, s: number) => { for (let k = 0; k < n; k++) { const c = ["#8a3a3a", "#3a5a8a", "#6a8a3a", "#8a6a3a", "#5a3a6a"][Math.floor(cell(k, s, 9) * 5)]; const h = 4 + Math.floor(cell(k, s, 10) * 3); p.rect(x + k * 2, y + 7 - h, 2, h, c); p.px(x + k * 2, y + 7 - h, hs(c, 0.4)); p.px(x + k * 2 + 1, y + 7 - h + 1, "#e8dcc4"); } };

// ------------------------------------------------------------ the furniture sprites
/** Live flame points: sprite kind -> art-pixel positions (from the sprite's bottom centre). */
export const FLAMES: Record<string, [number, number, number][]> = {};
const flames = (kind: string, pts: [number, number, number][]) => { FLAMES[kind] = pts; };

const DARK = "#5a3a22", IRON = "#3a3640", GOLD = "#e0b040", CLOTH = ["#8a2a2a", "#2a4a7a", "#3a6a3a", "#7a4a7a", "#b07a2a"];

export const furniture = memo((key: string): HTMLCanvasElement => {
  const [kind, a, b] = key.split("|");
  const v = Number(a) || 0;
  const mk = (w: number, h: number) => { const [c, p] = makeCanvas(w, h); return [c, p] as const; };
  switch (kind) {
    // ---- the tavern
    case "bar": {
      // one tile of a bar counter: v 0 middle, 1 left end, 2 right end; b: seed for what stands on it
      const [c, p] = mk(16, 26);
      const s = Number(b) || 0;
      const top = 9, fr = 15;
      p.rect(0, top, 16, 5, "#b07a42"); p.rect(0, top, 16, 1, "#e0aa68"); p.rect(0, top + 1, 16, 1, "#c88e50");
      for (let x = 2; x < 16; x += 5) p.px(x + (s % 3), top + 3, "#9a6436");
      p.rect(0, top + 5, 16, 1, "#4a2a14");
      p.rect(0, fr, 16, 10, "#7a4626");
      for (let x = 0; x < 16; x += 8) { p.rect(x + 1, fr + 2, 6, 6, "#6a3c20"); p.rect(x + 1, fr + 2, 6, 1, "#4e2a14"); p.rect(x + 1, fr + 7, 6, 1, "#8a5430"); p.rect(x + 7, fr + 1, 1, 8, "#5a3218"); }
      p.rect(0, fr + 8, 16, 1, "#9a6436"); p.rect(0, 24, 16, 1, "#3a1e0e"); p.rect(0, 25, 16, 1, "rgba(24,12,40,.35)");
      if (v === 1) { p.rect(0, top, 1, 16, "#3a1e0e"); p.rect(1, top + 1, 1, 4, "#e0aa68"); }
      if (v === 2) { p.rect(15, top, 1, 16, "#3a1e0e"); p.rect(14, fr, 1, 10, "#5a3218"); }
      p.rect(0, top - 1, 16, 1, "#3a1e0e");
      // on the counter
      const k = Math.floor(cell(s, 1, 41) * 6);
      if (k === 0) { MUG(p, 3, top - 3); MUG(p, 9, top - 2); }
      else if (k === 1) { BOTTLE(p, 4, top - 5, "#3a7a3a"); MUG(p, 9, top - 3); }
      else if (k === 2) { p.rect(5, top - 1, 7, 2, "#d8d0c0"); p.rect(5, top - 1, 7, 1, "#f0ece4"); MUG(p, 10, top - 3); }
      else if (k === 3) { BOTTLE(p, 3, top - 5, "#7a2a3a"); BOTTLE(p, 6, top - 5, "#c8a040"); }
      else if (k === 4) { PLATE(p, 5, top - 1, s % 3); }
      return c;
    }
    case "backbar": {
      // shelves of bottles and jars hung on the wall behind the bar (48 x 30)
      const [c, p] = mk(48, 30);
      const s = v;
      p.rect(1, 1, 46, 28, "#4a2a16");
      p.rect(2, 2, 44, 26, "#2a1a10");
      for (const y of [9, 18, 27]) { p.rect(0, y, 48, 2, "#8a5a32"); p.rect(0, y, 48, 1, "#b07a48"); p.rect(0, y + 2, 48, 1, "rgba(0,0,0,.35)"); }
      p.rect(0, 0, 48, 2, "#7a4a2a"); p.rect(0, 0, 48, 1, "#a8703c");
      p.rect(0, 0, 1, 30, "#3a1e0e"); p.rect(47, 0, 1, 30, "#3a1e0e"); p.rect(23, 2, 2, 26, "#6a3c20");
      const cols = ["#3a7a3a", "#7a2a3a", "#c8a040", "#3a4a8a", "#5a8a8a", "#8a4a1a", "#d8d0c0"];
      for (const [y, h] of [[9, 6], [18, 6], [27, 6]] as const) for (let x = 3; x < 45; x += 3) {
        if (x >= 22 && x <= 25) continue;
        const r = cell(x, y, s);
        if (r < 0.15) continue;
        const col = cols[Math.floor(cell(x, y + 1, s) * cols.length)];
        if (r < 0.35) { p.rect(x, y - 4, 3, 4, "#c8b890"); p.rect(x, y - 4, 3, 1, "#8a6a40"); p.px(x, y - 3, "#e8dcc4"); }
        else if (r < 0.5) { MUG(p, x, y - 4); x += 1; }
        else BOTTLE(p, x, y - h, col);
      }
      return c;
    }
    case "kegs": {
      // two casks lying on a cradle, ends toward the room, with taps (32 x 30)
      const [c, p] = mk(32, 30);
      shadow(p, 16, 28, 15, 2);
      p.rect(2, 22, 28, 6, DARK); p.rect(2, 22, 28, 1, "#7a4e2c");
      for (const x of [3, 27]) p.rect(x, 22, 2, 6, "#4a2e18");
      for (const [cx, cy] of [[9, 15], [23, 15]] as const) {
        p.rect(cx - 7, cy - 5, 14, 12, "#7a4a26");
        ell(p, cx, cy + 1, 7, 7, "#3a2414");
        ell(p, cx, cy + 1, 6, 6, "#a8703c");
        ell(p, cx - 1, cy, 4, 4, "#c08a50");
        for (const r of [6, 3]) { p.g.strokeStyle = IRON; p.g.lineWidth = 1; p.g.beginPath(); p.g.arc(cx + 0.5, cy + 1.5, r, 0, Math.PI * 2); p.g.stroke(); }
        p.rect(cx - 1, cy + 4, 2, 3, "#c8a040"); p.px(cx - 1, cy + 7, "#8a6a20");
      }
      // a third on top
      p.rect(9, 0, 14, 8, "#7a4a26"); ell(p, 16, 4, 6, 4, "#3a2414"); ell(p, 16, 4, 5, 3.4, "#a8703c"); p.rect(10, 0, 1, 8, IRON); p.rect(21, 0, 1, 8, IRON);
      return c;
    }
    case "table": {
      // a sturdy tavern table, fw tiles wide (a: width in tiles, b: seed for its food)
      const tw = Math.max(1, v || 2), s = Number(b) || 0;
      const W = tw * 16, [c, p] = mk(W, 24);
      shadow(p, W / 2, 22, W / 2 - 2, 2.4);
      const wd = "#9a6236";
      for (const x of [2, W - 5]) { p.rect(x, 13, 3, 9, hs(wd, -0.32)); p.rect(x, 13, 1, 9, hs(wd, -0.1)); }
      if (tw >= 3) p.rect(W / 2 - 1, 13, 3, 9, hs(wd, -0.32));
      p.rect(0, 4, W, 9, wd);
      for (let y = 5; y < 12; y += 2) p.rect(0, y, W, 1, hs(wd, 0.04 + (cell(y, s, 2) - 0.5) * 0.06));
      for (let x = 7; x < W; x += 8) p.rect(x, 4, 1, 9, hs(wd, -0.16));
      p.rect(0, 4, W, 1, hs(wd, 0.32)); p.rect(0, 12, W, 2, hs(wd, -0.3)); p.rect(0, 14, W, 1, hs(wd, -0.5));
      p.rect(-1 + 1, 4, 1, 11, outline(wd)); p.rect(W - 1, 4, 1, 11, outline(wd));
      // food and drink
      const slots = Math.floor(W / 7);
      for (let k = 0; k < slots; k++) {
        const x = 2 + k * 7 + Math.floor(cell(k, s, 4) * 2), r = cell(k, s, 5);
        if (r < 0.18) continue;
        if (r < 0.42) MUG(p, x, 4 + Math.floor(cell(k, s, 6) * 4));
        else if (r < 0.62) PLATE(p, x, 7, Math.floor(cell(k, s, 7) * 3));
        else if (r < 0.74) BREAD(p, x, 6);
        else if (r < 0.84 && W >= 32) { ROAST(p, x - 2, 5); k++; }
        else if (r < 0.92) BOTTLE(p, x + 1, 2, ["#3a7a3a", "#7a2a3a", "#c8a040"][k % 3]);
        else APPLES(p, x, 6);
      }
      CANDLE(p, Math.floor(W / 2) + (tw % 2 ? 0 : 3), 3, 4);
      return c;
    }
    case "roundtable": {
      const [c, p] = mk(24, 22);
      const s = v;
      shadow(p, 12, 20, 10, 2);
      p.rect(11, 12, 3, 8, "#6a4428"); p.rect(8, 19, 9, 1, "#5a3a22");
      ell(p, 12, 10, 11, 5.5, "#5a3218"); ell(p, 12, 9, 11, 5, "#9a6236"); ell(p, 11, 8, 8, 3, "#b07a48");
      p.rect(3, 12, 18, 1, "#6a3c20");
      const r = cell(s, 3, 9);
      MUG(p, 4, 6); if (r > 0.3) PLATE(p, 14, 8, s % 3); if (r > 0.6) BOTTLE(p, 9, 3, "#3a7a3a"); else BREAD(p, 9, 9);
      CANDLE(p, 12, 4, 3);
      return c;
    }
    case "chair": {
      // a: facing of the sitter: d (back at the top), l / r (side), u (back toward the viewer)
      const [c, p] = mk(14, 22);
      const wd = b || "#8a5430";
      shadow(p, 7, 20, 5, 1.4);
      if (a === "d") {
        for (const x of [2, 10]) p.rect(x, 12, 2, 8, hs(wd, -0.3));
        p.rect(2, 2, 10, 2, hs(wd, 0.1)); p.rect(2, 2, 10, 1, hs(wd, 0.35));
        for (const x of [2, 6, 10]) p.rect(x, 3, 2, 9, x === 6 ? hs(wd, -0.1) : wd);
        p.rect(1, 11, 12, 4, hs(wd, 0.12)); p.rect(1, 11, 12, 1, hs(wd, 0.32)); p.rect(1, 14, 12, 1, hs(wd, -0.35));
      } else if (a === "u") {
        for (const x of [2, 10]) p.rect(x, 14, 2, 6, hs(wd, -0.3));
        p.rect(1, 10, 12, 3, hs(wd, 0.1)); p.rect(1, 10, 12, 1, hs(wd, 0.3));
        for (const x of [2, 10]) { p.rect(x, 3, 2, 17, wd); p.rect(x, 3, 1, 17, hs(wd, 0.22)); }
        p.rect(2, 3, 10, 2, hs(wd, 0.12)); p.rect(2, 3, 10, 1, hs(wd, 0.36));
        for (const x of [5, 8]) { p.rect(x, 5, 1, 6, hs(wd, 0.04)); p.px(x + 1, 6, hs(wd, -0.3)); }
        p.rect(2, 10, 10, 1, hs(wd, -0.25));
      } else {
        const left = a === "l";
        const bx = left ? 10 : 2;
        for (const x of [3, 9]) p.rect(x, 13, 2, 7, hs(wd, -0.3));
        p.rect(2, 11, 10, 3, hs(wd, 0.12)); p.rect(2, 11, 10, 1, hs(wd, 0.32)); p.rect(2, 13, 10, 1, hs(wd, -0.3));
        p.rect(bx, 3, 2, 17, wd); p.rect(bx, 3, 1, 17, hs(wd, 0.25)); p.rect(bx - (left ? 0 : 0), 3, 2, 1, hs(wd, 0.4));
      }
      return c;
    }
    case "stool": {
      const [c, p] = mk(12, 14);
      shadow(p, 6, 12, 4, 1.3);
      p.rect(3, 6, 1, 6, "#5a3a22"); p.rect(8, 6, 1, 6, "#5a3a22"); p.rect(5, 7, 2, 6, "#4a2e18");
      ell(p, 6, 6, 4.5, 2.2, "#6a3c20"); ell(p, 6, 5.4, 4.2, 1.8, "#b07a48"); p.rect(3, 4, 4, 1, "#d09a5a");
      return c;
    }
    case "bench": {
      const tw = Math.max(1, v || 2), W = tw * 16, [c, p] = mk(W, 14);
      shadow(p, W / 2, 12, W / 2 - 2, 1.6);
      for (const x of [2, W - 4]) p.rect(x, 7, 2, 5, "#5a3a22");
      p.rect(0, 3, W, 4, "#9a6236"); p.rect(0, 3, W, 1, "#c08a58"); p.rect(0, 6, W, 1, "#5a3a22"); p.rect(0, 7, W, 1, "rgba(24,12,40,.3)");
      return c;
    }
    case "stairs": {
      // a staircase rising along the back wall: 2 tiles wide, 3 floor rows plus the 2-row wall (32 x 80)
      const [c, p] = mk(32, 80);
      const wd = "#9a6236";
      p.rect(0, 0, 32, 80, "rgba(0,0,0,0)");
      // the opening in the wall at the top (an upper landing in shadow)
      p.rect(2, 0, 26, 22, "#1a1008"); p.rect(2, 0, 26, 3, "#0e0a06");
      p.rect(0, 0, 2, 32, "#5a3a22"); p.rect(28, 0, 4, 32, "#5a3a22");
      // steps, lit treads and dark risers, receding upward
      const n = 13;
      for (let k = 0; k < n; k++) {
        const y = 76 - k * 5.6, x0 = 2 + Math.round(k * 0.35), x1 = 26 - Math.round(k * 0.2);
        const lit = 0.18 - k * 0.035;
        p.rect(x0, Math.round(y) - 5, x1 - x0, 6, hs(wd, -0.32 + lit));
        p.rect(x0, Math.round(y) - 5, x1 - x0, 2, hs(wd, 0.12 + lit));
        p.rect(x0, Math.round(y) - 5, x1 - x0, 1, hs(wd, 0.3 + lit));
        p.px(x0 + 3, Math.round(y) - 4, hs(wd, -0.2)); p.px(x1 - 4, Math.round(y) - 4, hs(wd, -0.2));
      }
      // stringer and banister on the open (right) side
      p.line(28, 78, 27, 6, "#4a2a14", 3);
      for (let k = 0; k < 7; k++) { const y = 74 - k * 10; p.rect(26, y - 10, 1, 10, "#6a4428"); }
      p.line(30, 64, 29, 2, "#b07a48", 2); p.line(30, 64, 29, 2, "#7a4a26", 1);
      p.rect(28, 62, 4, 14, "#8a5430"); p.rect(28, 62, 4, 2, "#c08a58"); p.rect(28, 60, 4, 2, "#d8a060");
      // wall stringer on the left
      p.line(1, 78, 1, 8, "#4a2a14", 2);
      shadow(p, 16, 78, 14, 1.5);
      return c;
    }
    case "hearth": {
      // a big stone fireplace in the wall: mantel, firebox, a pot on a crane (48 x 34)
      const [c, p] = mk(48, 34);
      const st = "#9a8c7c";
      wallTex(p, 3, 6, 42, 28, st, "stone", 5);
      for (const x of [3, 41]) { p.rect(x, 6, 4, 28, hs(st, 0.08)); p.rect(x, 6, 1, 28, hs(st, 0.3)); p.rect(x + 3, 6, 1, 28, hs(st, -0.3)); }
      // mantel shelf with things on it
      p.rect(0, 4, 48, 4, "#7a4a26"); p.rect(0, 4, 48, 1, "#b07a48"); p.rect(0, 7, 48, 1, "#3a1e0e"); p.rect(0, 8, 48, 1, "rgba(0,0,0,.3)");
      MUG(p, 6, 0); BOTTLE(p, 12, -2, "#7a2a3a"); p.rect(31, 0, 5, 4, "#d8d0c0"); p.rect(31, 0, 5, 1, "#f0ece4"); CANDLE(p, 40, 0, 4); CANDLE(p, 43, 1, 3);
      ell(p, 22, 2, 3, 2, "#c8a040"); p.rect(21, 0, 3, 2, "#e0c060");
      // the firebox
      p.rect(11, 13, 26, 21, "#2a1610");
      for (let i = 0; i < 13; i++) p.rect(11 + i, 13 - Math.round(Math.sqrt(Math.max(0, 169 - (13 - i) ** 2)) * 0.3), 26 - i * 2, 1, "#2a1610");
      p.rect(9, 11, 30, 2, hs(st, 0.2)); p.rect(13, 15, 22, 16, "#140a06");
      for (let y = 15; y < 31; y++) p.rect(13, y, 22, 1, mix("#140a06", "#5a2410", (y - 15) / 16));
      // logs and embers
      p.rect(15, 29, 18, 3, "#4a2a14"); p.line(16, 31, 31, 28, "#6a3c1e", 2); p.rect(18, 30, 12, 1, "#ff7a2a"); p.px(22, 29, "#ffd25a");
      p.rect(9, 32, 30, 2, hs(st, -0.2)); p.rect(9, 32, 30, 1, hs(st, 0.1));
      // the crane and the pot
      p.rect(14, 16, 1, 10, IRON); p.rect(14, 16, 12, 1, IRON); p.rect(24, 16, 1, 3, "#5a5660");
      ell(p, 24.5, 23, 5, 4, "#2a2830"); p.rect(19, 19, 11, 2, "#4a4850"); p.rect(20, 19, 9, 1, "#6a6870"); p.rect(21, 18, 7, 1, "#8a6a3a");
      p.px(21, 22, "#5a5860");
      return c;
    }
    case "chandelier": {
      // an iron wheel of candles hung from the beams (40 x 44); flames drawn live
      const [c, p] = mk(40, 44);
      for (let y = 0; y < 30; y += 2) { p.px(20, y, "#5a5660"); p.px(20, y + 1, "#3a3640"); }
      for (const dx of [-12, 12]) p.line(20, 22, 20 + dx, 34, "#4a4650");
      for (const [col, dy, lw] of [["#1a1820", 1, 3], ["#5a5660", 0, 2], ["#8a8890", -0.5, 1]] as const) { p.g.strokeStyle = col; p.g.lineWidth = lw; p.g.beginPath(); p.g.ellipse(20, 35 + dy, 14, 3.6, 0, 0, Math.PI * 2); p.g.stroke(); }
      p.rect(19, 30, 3, 6, "#4a4650");
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + 0.3, x = Math.round(20 + Math.cos(ang) * 14), y = Math.round(35 + Math.sin(ang) * 3.6);
        p.rect(x - 1, y - 1, 3, 1, "#8a8890"); p.rect(x, y - 5, 1, 4, "#f4ecd8"); p.px(x, y - 5, "#fffaf0");
      }
      return c;
    }
    case "lanternwall": {
      // an iron bracket with a glass lantern, for a wall face (12 x 18)
      const [c, p] = mk(12, 18);
      p.rect(1, 2, 7, 1, IRON); p.rect(1, 1, 2, 3, IRON); p.px(8, 3, IRON);
      p.rect(5, 4, 5, 2, "#2a2830"); p.rect(4, 6, 7, 8, "#2a2830"); p.rect(5, 7, 5, 6, "#ffd878"); p.rect(6, 8, 3, 4, "#fff4c0");
      p.rect(7, 7, 1, 6, "#3a3640"); p.rect(4, 14, 7, 1, "#2a2830"); p.px(7, 15, "#2a2830");
      return c;
    }
    case "hanglantern": {
      // a lantern on a chain from the ceiling (12 x 40), for the overhead layer
      const [c, p] = mk(12, 40);
      for (let y = 0; y < 26; y += 2) { p.px(6, y, "#5a5660"); p.px(6, y + 1, "#3a3640"); }
      p.rect(3, 26, 7, 2, "#2a2830"); p.rect(2, 28, 9, 9, "#2a2830"); p.rect(3, 29, 7, 7, "#ffd878"); p.rect(4, 30, 5, 5, "#fff4c0");
      p.rect(6, 29, 1, 7, "#3a3640"); p.rect(2, 37, 9, 1, "#2a2830"); p.rect(5, 38, 3, 1, "#2a2830");
      return c;
    }
    case "painting": {
      const [c, p] = mk(22, 18);
      p.rect(0, 0, 22, 16, "#8a6420"); p.rect(0, 0, 22, 1, "#e0b860"); p.rect(1, 1, 20, 14, "#c8983a"); p.rect(2, 2, 18, 12, "#3a2a20");
      if (v % 3 === 0) { p.rect(3, 3, 16, 6, "#7ab0d8"); p.rect(3, 9, 16, 4, "#4a7a3a"); p.blob(8, 8, 4, 2, "#3a6a3a", { outline: false }); p.rect(14, 4, 2, 2, "#fff0a0"); }
      else if (v % 3 === 1) { p.rect(3, 3, 16, 10, "#5a3a3a"); ell(p, 11, 7, 3, 3.5, "#e8c8a8"); p.rect(7, 10, 8, 3, "#3a2a5a"); p.rect(9, 3, 4, 2, "#3a2a1a"); }
      else { p.rect(3, 3, 16, 10, "#2a3a5a"); for (let x = 3; x < 19; x++) p.px(x, 9 + Math.round(Math.sin(x / 2) * 1.5), "#d8e8f0"); p.rect(10, 4, 3, 5, "#e8dcc4"); p.rect(9, 8, 5, 1, "#6a4428"); }
      p.rect(0, 16, 22, 1, "rgba(0,0,0,.35)");
      return c;
    }
    case "antlers": {
      const [c, p] = mk(26, 20);
      ell(p, 13, 13, 5, 3.5, "#5a3a22"); ell(p, 13, 12, 4, 3, "#8a5a32");
      p.rect(9, 9, 8, 9, "#8a5a32"); p.rect(11, 15, 4, 3, "#a87a4a"); p.px(11, 12, "#1a1010"); p.px(15, 12, "#1a1010"); p.rect(12, 17, 2, 1, "#2a1a14");
      const bone = "#e8dcc4";
      for (const s of [-1, 1]) {
        p.line(13 + s * 3, 9, 13 + s * 10, 2, bone, 1); p.line(13 + s * 6, 6, 13 + s * 6, 1, bone); p.line(13 + s * 8, 4, 13 + s * 11, 4, bone); p.line(13 + s * 4, 8, 13 + s * 3, 3, bone);
      }
      p.rect(8, 17, 10, 3, "#6a4428"); p.rect(8, 17, 10, 1, "#9a6a3a");
      return c;
    }
    case "shieldx": {
      // a shield over two crossed swords (24 x 22)
      const [c, p] = mk(24, 22);
      p.line(2, 2, 21, 20, "#c8ccd8", 2); p.line(21, 2, 2, 20, "#c8ccd8", 2);
      for (const [x, y] of [[2, 2], [21, 2]] as const) { p.rect(x - 1, y - 1, 3, 3, "#8a6420"); }
      const col = CLOTH[v % CLOTH.length];
      poly(p, [[6, 4], [18, 4], [18, 12], [12, 19], [6, 12]], "#3a2a20");
      poly(p, [[7, 5], [17, 5], [17, 12], [12, 17.5], [7, 12]], col);
      p.rect(7, 5, 10, 1, hs(col, 0.35)); p.rect(11, 5, 2, 12, GOLD); p.rect(7, 9, 10, 2, GOLD);
      return c;
    }
    case "tapestry": {
      const [c, p] = mk(28, 32);
      const col = b || CLOTH[v % CLOTH.length];
      p.rect(0, 0, 28, 2, "#6a4428"); p.px(0, 0, GOLD); p.px(27, 0, GOLD);
      p.rect(1, 2, 26, 26, col); p.rect(1, 2, 26, 1, hs(col, 0.3));
      for (let x = 1; x < 27; x += 4) p.rect(x, 3, 1, 25, hs(col, -0.1));
      p.rect(3, 4, 22, 22, hs(col, -0.18)); p.rect(4, 5, 20, 20, col);
      for (let k = 0; k < 20; k++) { p.px(4 + k, 5, GOLD); p.px(4 + k, 24, GOLD); }
      if (v % 2) { // a lion rampant
        p.blob(14, 13, 4, 5, GOLD, { outline: false }); p.blob(12, 9, 3, 3, GOLD, { outline: false }); p.rect(15, 16, 2, 5, GOLD); p.rect(11, 16, 2, 5, GOLD); p.line(18, 12, 21, 8, GOLD); p.px(11, 8, "#3a1a10");
      } else { // a tree and a star
        p.rect(13, 13, 2, 9, "#e8dcc4"); p.blob(14, 11, 6, 4, "#e8dcc4", { outline: false }); p.blob(14, 11, 5, 3, hs(col, 0.25), { outline: false }); p.rect(13, 6, 2, 2, GOLD);
      }
      for (let x = 2; x < 27; x += 2) { p.rect(x, 28, 1, 3 + (x % 4 ? 1 : 0), hs(col, -0.2)); p.px(x, 28, GOLD); }
      return c;
    }
    case "rug": {
      // a: width tiles, b: colour index / colour
      const tw = Math.max(2, v || 3), th = 2;
      const W = tw * 16, H = th * 16, [c, p] = mk(W, H);
      const col = b && b.startsWith("#") ? b : CLOTH[(Number(b) || 0) % CLOTH.length];
      p.rect(1, 1, W - 2, H - 2, hs(col, -0.35));
      p.rect(2, 2, W - 4, H - 4, col);
      p.rect(4, 4, W - 8, H - 8, hs(col, -0.18));
      p.rect(5, 5, W - 10, H - 10, hs(col, 0.06));
      for (let x = 6; x < W - 6; x += 2) { p.px(x, 3, "#e8c870"); p.px(x, H - 4, "#e8c870"); }
      for (let y = 6; y < H - 6; y += 2) { p.px(3, y, "#e8c870"); p.px(W - 4, y, "#e8c870"); }
      // a medallion and lozenges
      const cx = W / 2, cy = H / 2;
      for (let k = 0; k < 6; k++) { p.rect(cx - 6 + k, cy - k * 0.6, 12 - k * 2, 1, hs(col, -0.3)); p.rect(cx - 6 + k, cy + k * 0.6, 12 - k * 2, 1, hs(col, -0.3)); }
      ell(p, cx, cy, 3, 2, "#e8c870"); ell(p, cx, cy, 1.5, 1, hs(col, 0.3));
      for (const x of [9, W - 10]) { p.rect(x - 1, cy - 1, 3, 3, "#e8c870"); p.px(x, cy, hs(col, -0.3)); }
      for (let x = 1; x < W - 1; x += 2) { p.px(x, 0, "#e8dcc4"); p.px(x, H - 1, "#e8dcc4"); }
      return c;
    }
    case "runner": {
      // a long red carpet tile (a: 0 middle / 1 top end / 2 bottom end), 48 wide (3 tiles), 16 tall
      const [c, p] = mk(48, 16);
      const col = b || "#9a2030";
      p.rect(2, 0, 44, 16, col);
      p.rect(2, 0, 2, 16, GOLD); p.rect(44, 0, 2, 16, GOLD); p.rect(5, 0, 1, 16, hs(col, -0.3)); p.rect(42, 0, 1, 16, hs(col, -0.3));
      for (let y = 2; y < 16; y += 8) { for (let k = 0; k < 4; k++) { p.rect(24 - 4 + k, y + k, 8 - k * 2, 1, hs(col, 0.18)); p.rect(24 - 4 + k, y + 7 - k, 8 - k * 2, 1, hs(col, 0.18)); } }
      if (v === 1) { p.rect(2, 0, 44, 2, GOLD); for (let x = 3; x < 46; x += 2) p.px(x, 0, "#fff0b0"); }
      if (v === 2) { p.rect(2, 14, 44, 2, GOLD); for (let x = 3; x < 46; x += 2) p.px(x, 15, "#fff0b0"); }
      return c;
    }
    case "barrels": {
      // a stack of barrels / casks against a wall (32 x 30)
      const [c, p] = mk(32, 30);
      shadow(p, 16, 28, 15, 2);
      const one = (x: number, y: number, h: number) => {
        p.rect(x, y, 12, h, "#8a5430");
        for (let k = 0; k < 12; k += 3) p.rect(x + k, y, 1, h, "#6a3c20");
        p.rect(x, y, 2, h, "#a8703c"); p.rect(x + 10, y, 2, h, "#5a3218");
        for (const yy of [y + 2, y + h - 3]) p.rect(x, yy, 12, 1, IRON);
        ell(p, x + 6, y, 6, 2, "#5a3218"); ell(p, x + 6, y, 5, 1.4, "#a8703c");
        p.rect(x - 1, y, 1, h, "#2a1608"); p.rect(x + 12, y, 1, h, "#2a1608");
      };
      one(2, 14, 14); one(17, 15, 13); one(9, 3, 12);
      return c;
    }
    case "sacks": {
      const [c, p] = mk(22, 16);
      shadow(p, 11, 14, 10, 2);
      for (const [x, y, s] of [[6, 9, 5], [15, 10, 5], [10, 5, 4]] as const) {
        p.blob(x, y, s, s * 0.85, "#c8b080", { hi: 0.25 }); p.rect(x - 1, y - s - 1, 3, 2, "#8a7a50"); p.px(x, y - s - 2, "#6a5a3a");
      }
      p.rect(4, 13, 3, 1, "#e8d8a0"); p.px(8, 12, "#e8d8a0");
      return c;
    }
    case "crates": {
      const [c, p] = mk(28, 28);
      shadow(p, 14, 26, 13, 2);
      const crate = (x: number, y: number, w: number, h: number) => {
        box(p, x, y, w, 4, h - 4, "#b08850");
        p.line(x + 1, y + 5, x + w - 2, y + h - 2, "#7a5a30"); p.rect(x + 1, y + 5, w - 2, 1, "#8a6a40");
      };
      crate(2, 12, 14, 14); crate(15, 14, 11, 12); crate(5, 1, 12, 12);
      return c;
    }
    case "plant": {
      const [c, p] = mk(14, 22);
      shadow(p, 7, 20, 5, 1.4);
      p.rect(3, 14, 8, 6, "#a8603a"); p.rect(3, 14, 8, 1, "#c8804a"); p.rect(4, 19, 6, 1, "#7a4024"); p.rect(2, 13, 10, 2, "#b86a3e");
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; p.line(7, 13, 7 + Math.cos(a) * 6, 13 + Math.sin(a) * 10, k % 2 ? "#3f8a3a" : "#5aa84a", 2); }
      p.px(4, 5, "#e84a6a"); p.px(10, 6, "#f7d44c");
      return c;
    }
    case "bookcase": {
      // tall shelves against the back wall (16 x 40): the top rises over the wall face
      const [c, p] = mk(16, 40);
      shadow(p, 8, 38, 7, 1.5);
      p.rect(0, 2, 16, 36, "#5a3218"); p.rect(1, 3, 14, 34, "#2a180c");
      p.rect(0, 0, 16, 3, "#8a5430"); p.rect(0, 0, 16, 1, "#b07a48");
      for (const y of [11, 20, 29]) { p.rect(1, y, 14, 2, "#7a4826"); p.rect(1, y, 14, 1, "#a8703c"); }
      for (const [y, s] of [[11, 1], [20, 2], [29, 3]] as const) BOOKS(p, 2, y - 8, 6, s + v * 7);
      p.rect(2, 32, 12, 4, "#3a2214"); p.rect(4, 33, 3, 3, "#c8b890"); ell(p, 11, 34.5, 2, 1.5, "#8a8890");
      p.rect(0, 37, 16, 1, "#3a1e0e");
      return c;
    }
    case "cupboard": {
      // a dresser with plates and jugs (16 x 40)
      const [c, p] = mk(16, 40);
      shadow(p, 8, 38, 7, 1.5);
      p.rect(0, 0, 16, 22, "#6a3c20"); p.rect(1, 1, 14, 20, "#3a2214"); p.rect(0, 0, 16, 1, "#9a6236");
      for (const y of [8, 15]) { p.rect(1, y, 14, 1, "#8a5430"); }
      for (let k = 0; k < 3; k++) { ell(p, 4 + k * 4, 5, 1.8, 2.6, "#e8e4dc"); ell(p, 4 + k * 4, 5, 1, 1.6, ["#4a7ab0", "#c84a3a", "#4a7ab0"][k]); }
      p.rect(3, 10, 3, 5, "#c8a070"); p.rect(3, 10, 3, 1, "#e0c090"); p.rect(9, 11, 4, 4, "#d8d0c0"); p.rect(9, 11, 4, 1, "#f0ece4");
      p.rect(3, 17, 2, 4, "#5a8a8a"); p.rect(7, 18, 2, 3, "#8a3a3a"); p.rect(11, 17, 2, 4, "#c8a040");
      box(p, 0, 22, 16, 3, 13, "#8a5430", { panels: 2 });
      p.px(7, 30, GOLD); p.px(8, 30, GOLD);
      return c;
    }
    case "bed": {
      // a: colour index; a wooden bed with a quilt, headboard to the wall (20 x 36)
      const [c, p] = mk(20, 36);
      shadow(p, 10, 34, 9, 2);
      const col = CLOTH[v % CLOTH.length];
      p.rect(1, 0, 18, 8, "#6a3c20"); p.rect(1, 0, 18, 1, "#9a6236"); p.rect(3, 2, 14, 5, "#5a3218");
      p.rect(0, 0, 2, 34, "#7a4826"); p.rect(18, 0, 2, 34, "#5a3218"); p.px(0, 0, "#b07a48"); p.px(18, 0, "#9a6236");
      p.rect(2, 7, 16, 25, "#e8e0d0");
      p.rect(3, 8, 14, 6, "#f8f4ec"); p.rect(3, 13, 14, 1, "#d8d0c0"); p.rect(4, 9, 5, 4, "#fffaf2"); p.rect(11, 9, 5, 4, "#fffaf2");
      p.rect(2, 15, 16, 17, col); p.rect(2, 15, 16, 2, "#f4ecd8");
      for (let y = 18; y < 32; y += 4) for (let x = 2; x < 18; x += 4) p.rect(x + ((y / 4) % 2 ? 2 : 0), y, 2, 2, hs(col, 0.2));
      p.rect(2, 30, 16, 2, hs(col, -0.3));
      p.rect(0, 32, 20, 3, "#5a3218"); p.rect(0, 32, 20, 1, "#8a5430");
      return c;
    }
    case "chest": {
      const [c, p] = mk(18, 16);
      shadow(p, 9, 14, 8, 1.6);
      box(p, 1, 3, 16, 4, 8, "#8a5430");
      p.rect(1, 3, 16, 2, "#a8703c"); p.rect(1, 7, 16, 1, IRON); for (const x of [3, 13]) p.rect(x, 3, 2, 12, IRON);
      p.rect(8, 7, 2, 3, GOLD);
      return c;
    }
    case "armchair": {
      // a padded chair facing the fire (a: l / r)
      const [c, p] = mk(18, 22);
      shadow(p, 9, 20, 7, 1.6);
      const col = "#7a2a2a";
      const left = a === "l";
      p.rect(2, 9, 14, 9, hs(col, -0.1)); p.rect(2, 9, 14, 2, hs(col, 0.25));
      p.rect(left ? 12 : 1, 1, 5, 18, col); p.rect(left ? 12 : 1, 1, 5, 2, hs(col, 0.3)); p.rect(left ? 16 : 1, 1, 1, 18, hs(col, -0.4));
      p.rect(2, 7, 14, 3, hs(col, 0.08)); p.rect(2, 16, 14, 3, hs(col, -0.35));
      for (const x of [3, 14]) p.rect(x, 18, 2, 3, "#4a2a14");
      return c;
    }
    case "woodbin": {
      const [c, p] = mk(18, 14);
      shadow(p, 9, 12, 8, 1.5);
      for (let k = 0; k < 6; k++) { const x = 2 + (k % 3) * 5 + (k > 2 ? 2 : 0), y = k > 2 ? 4 : 8; ell(p, x + 2, y + 2, 2.4, 2.2, "#6a4428"); ell(p, x + 2, y + 2, 1.6, 1.5, "#c8a070"); }
      return c;
    }
    case "window": {
      // a curtained window in a wall face (a: lit 1/0; b: curtain colour)
      const [c, p] = mk(20, 22);
      const lit = a === "1";
      p.rect(2, 2, 16, 16, "#5a3a22"); windowAt(p, 4, 4, { w: 12, h: 12, lit, trim: "#c8b090" });
      const cur = b || "#8a2a2a";
      for (const [x0, dir] of [[1, 1], [15, -1]] as const) for (let y = 1; y < 19; y++) { const w = 3 + Math.round(Math.sin((y / 18) * Math.PI) * -1 + (y > 12 ? (y - 12) * 0.3 * (dir > 0 ? 1 : 1) : 0)); p.rect(dir > 0 ? x0 : x0 + 4 - w, y, w, 1, y % 3 ? cur : hs(cur, -0.2)); }
      p.rect(0, 0, 20, 2, "#6a4428"); p.rect(0, 0, 20, 1, "#9a6a3a");
      p.rect(2, 18, 16, 2, "#8a6a40"); p.rect(2, 18, 16, 1, "#b08a58");
      return c;
    }
    // ---- woodland undergrowth
    case "fern": {
      const [c, p] = mk(18, 14);
      const col = ["#3f8a3a", "#4f9a40", "#2f7a3a"][v % 3];
      for (let k = 0; k < 7; k++) {
        const a2 = Math.PI + 0.3 + (k / 6) * (Math.PI - 0.6);
        for (let t2 = 0; t2 < 8; t2++) { const x = 9 + Math.cos(a2) * t2 * 1.05, y = 13 + Math.sin(a2) * t2 * 1.25 + (t2 * t2) / 14; p.px(x, y, t2 > 5 ? hs(col, 0.25) : col); if (t2 % 2) { p.px(x - 1, y + 1, hs(col, -0.2)); p.px(x + 1, y + 1, hs(col, -0.1)); } }
      }
      return c;
    }
    case "cattail": {
      const [c, p] = mk(14, 22);
      for (let k = 0; k < 6; k++) { const x = 2 + k * 2, h = 10 + ((k * 7 + v) % 8); p.rect(x, 21 - h, 1, h, k % 2 ? "#5a8a32" : "#7aa040"); if (k % 2 === 0) p.rect(x, 21 - h - 4, 1, 4, "#7a4a22"); }
      p.line(1, 20, 4, 12, "#4a7a2a"); p.line(13, 20, 10, 13, "#6a9a3a");
      return c;
    }
    case "tallgrass": {
      const [c, p] = mk(16, 12);
      const col = b || "#5aa040";
      for (let k = 0; k < 9; k++) { const x = 1 + Math.floor(cell(k, v, 1) * 14), h = 4 + Math.floor(cell(k, v, 2) * 7); p.line(x, 11, x + (k % 3) - 1, 11 - h, k % 2 ? col : hs(col, -0.2)); }
      if (v % 4 === 0) { p.px(4, 3, "#f7d44c"); p.px(10, 4, "#ffffff"); }
      return c;
    }
    case "mossrock": {
      const [c, p] = mk(20, 14);
      shadow(p, 10, 12, 9, 2);
      p.blob(10, 8, 9, 5, "#7a7a76", { hi: 0.25 }); p.blob(6, 9, 4, 3, "#6a6a66");
      for (let x = 3; x < 17; x++) if (cell(x, v, 3) > 0.35) p.rect(x, 3 + Math.floor(cell(x, v, 4) * 2), 1, 2, cell(x, v, 5) > 0.5 ? "#5a8a3a" : "#4a7a30");
      p.line(10, 6, 12, 9, "#4a4a48");
      return c;
    }
    case "flowerpatch": {
      const [c, p] = mk(16, 12);
      const cols = [["#f7d44c", "#ffffff"], ["#e84a6a", "#f8b0c0"], ["#b88aff", "#ffffff"], ["#f28a3a", "#f7d44c"]][v % 4];
      for (let k = 0; k < 8; k++) { const x = 1 + Math.floor(cell(k, v, 6) * 14), y = 3 + Math.floor(cell(k, v, 7) * 8); p.line(x, y + 1, x, y + 3, "#3f8a3a"); p.px(x, y, cols[k % 2]); p.px(x - 1, y, hs(cols[k % 2], -0.2)); }
      return c;
    }
    // ---- dungeon
    case "cellbars": {
      // the iron front of a cell, two tiles wide, with a barred door (32 x 38)
      const [c, p] = mk(32, 38);
      const ir = "#4a4650", hi = "#8a8890";
      p.rect(0, 2, 32, 3, ir); p.rect(0, 2, 32, 1, hi); p.rect(0, 34, 32, 2, ir); p.rect(0, 36, 32, 2, "rgba(10,6,16,.4)");
      for (let x = 1; x < 32; x += 3) { p.rect(x, 5, 1, 29, ir); p.px(x, 5, hi); p.px(x, 18, hi); }
      p.rect(0, 18, 32, 2, ir); p.rect(0, 18, 32, 1, hi);
      p.rect(17, 5, 1, 29, "#2a2830"); p.rect(19, 22, 3, 4, "#6a6060"); p.px(20, 23, "#1a1418");
      return c;
    }
    case "straw": {
      const [c, p] = mk(18, 12);
      for (let k = 0; k < 40; k++) { const x = 1 + Math.floor(cell(k, 1, v) * 16), y = 2 + Math.floor(cell(k, 2, v) * 9); p.line(x, y, x + 2 + Math.floor(cell(k, 3, v) * 2), y + (k % 2 ? 1 : -1), k % 3 ? "#c8a858" : "#a8883a"); }
      return c;
    }
    case "skeleton": {
      // a prisoner's bones slumped against the wall, still chained (16 x 18)
      const [c, p] = mk(16, 18);
      const b = "#e0d6c0";
      p.line(3, 1, 5, 7, "#5a5860"); p.line(13, 1, 11, 7, "#5a5860");
      p.blob(8, 5, 2.6, 2.4, b); p.px(7, 5, "#2a1a1a"); p.px(9, 5, "#2a1a1a"); p.px(8, 7, "#8a7a6a");
      for (let y = 8; y < 13; y += 2) p.rect(6, y, 5, 1, b);
      p.rect(8, 8, 1, 6, hs(b, -0.1)); p.line(6, 8, 4, 11, b); p.line(10, 8, 12, 11, b);
      p.line(7, 14, 3, 16, b); p.line(9, 14, 13, 16, b); p.rect(6, 13, 5, 2, hs(b, -0.08));
      return c;
    }
    case "archway": {
      // stone jambs and an arch where a corridor passes through a wall, the door swung open (24 x 40)
      const [c, p] = mk(24, 40);
      const st = b || "#7a7684";
      for (const x of [0, 20]) { p.rect(x, 6, 4, 34, hs(st, x ? -0.15 : 0.08)); for (let y = 9; y < 40; y += 5) p.rect(x, y, 4, 1, hs(st, -0.3)); p.rect(x, 6, 1, 34, hs(st, 0.3)); }
      for (let i = 0; i < 24; i++) { const dx = i - 11.5, ay = Math.round(Math.sqrt(Math.max(0, 144 - dx * dx)) * 0.45); p.rect(i, 8 - ay, 1, 3, (i % 4 === 0) ? hs(st, -0.3) : hs(st, 0.12)); }
      p.rect(10, 0, 4, 4, hs(st, 0.2)); p.rect(10, 0, 4, 1, hs(st, 0.4));
      // the open door leaf against the left jamb, seen edge-on
      p.rect(4, 12, 3, 27, "#5a3a22"); p.rect(4, 12, 1, 27, "#7a5030"); p.rect(4, 17, 3, 1, "#3a3640"); p.rect(4, 31, 3, 1, "#3a3640");
      return c;
    }
    case "sarcophagus": {
      const [c, p] = mk(32, 24);
      shadow(p, 16, 22, 15, 2);
      const st = "#8a8478";
      box(p, 1, 6, 30, 9, 8, st);
      p.rect(3, 7, 26, 7, hs(st, 0.2)); p.blob(8, 10, 2.5, 2, hs(st, 0.3)); p.rect(10, 9, 14, 3, hs(st, 0.28)); p.rect(24, 8, 3, 5, hs(st, 0.25));
      p.rect(10, 10, 14, 1, hs(st, 0.05)); p.line(14, 9, 18, 12, hs(st, -0.1));
      for (let x = 4; x < 28; x += 6) p.rect(x, 17, 3, 3, hs(st, -0.32));
      return c;
    }
    case "cobweb": {
      const [c, p] = mk(16, 16);
      const col = "rgba(230,230,240,.55)";
      for (let k = 0; k < 5; k++) { const a = (k / 4) * (Math.PI / 2); p.line(0, 0, Math.cos(a) * 15, Math.sin(a) * 15, col); }
      for (const r of [5, 9, 13]) for (let k = 0; k < 4; k++) { const a0 = (k / 4) * (Math.PI / 2), a1 = ((k + 1) / 4) * (Math.PI / 2); p.line(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r * 0.92, Math.sin(a1) * r * 0.92, col); }
      if (a === "r") { const [c2, p2] = mk(16, 16); p2.g.translate(16, 0); p2.g.scale(-1, 1); p2.g.drawImage(c, 0, 0); return c2; }
      return c;
    }
    case "puddle": {
      const [c, p] = mk(20, 10);
      ell(p, 10, 5, 9, 4, "rgba(20,30,50,.55)"); ell(p, 9, 4.5, 6, 2.5, "rgba(60,90,120,.5)"); p.rect(6, 3, 3, 1, "rgba(200,230,255,.6)");
      return c;
    }
    // ---- ship
    case "mast": {
      // a mast with two yards and bellied sails, a crow's nest and shrouds to the rails (72 x 124)
      const [c, p] = mk(72, 124);
      const wd = "#7a4e2c", sail = "#efe6d0", cx = 36;
      ell(p, cx, 121, 6, 2, "rgba(24,12,40,.3)");
      // shrouds with ratlines
      for (const sd of [-1, 1]) {
        p.line(cx, 14, cx + sd * 33, 118, "#4a3a2a"); p.line(cx + sd * 2, 16, cx + sd * 28, 118, "#4a3a2a");
        for (let k = 1; k < 12; k++) { const t2 = k / 12, y = 14 + t2 * 104; p.line(cx + sd * (t2 * 33), y, cx + sd * (2 + t2 * 26), y + 1, "#6a5a40"); }
      }
      p.column(cx - 3, 6, 6, 114, wd);
      p.rect(cx - 4, 118, 8, 3, "#5a3a22"); p.rect(cx - 5, 120, 10, 2, "#4a2e18");
      // crow's nest
      p.rect(cx - 7, 8, 14, 5, "#6a4428"); p.rect(cx - 7, 8, 14, 1, "#a8703c"); p.rect(cx - 7, 12, 14, 1, "#3a2414");
      p.rect(cx - 1, 0, 2, 8, wd); p.rect(cx + 1, 0, 8, 3, "#c83a3a"); p.rect(cx + 1, 3, 5, 1, "#a82a2a");
      const sailAt = (top: number, bot: number, half: number) => {
        p.rect(cx - half - 2, top - 2, half * 2 + 4, 3, hs(wd, -0.1)); p.rect(cx - half - 2, top - 2, half * 2 + 4, 1, hs(wd, 0.25));
        for (let y = top; y < bot; y++) {
          const t2 = (y - top) / (bot - top), bulge = Math.round(Math.sin(t2 * Math.PI) * 4), hw2 = half + bulge;
          for (let x = -hw2; x <= hw2; x++) {
            const u = (x + hw2) / (2 * hw2);
            let col = hs(sail, u < 0.2 ? 0.1 : u > 0.75 ? -0.18 : 0) as string;
            if (t2 > 0.75) col = hs(col, -0.1);
            if ((x + half + 40) % 9 === 0) col = hs(col, -0.12);
            p.px(cx + x, y, col);
          }
          p.px(cx - hw2 - 1, y, "#a89a80"); p.px(cx + hw2 + 1, y, "#8a7a60");
        }
        p.rect(cx - half, bot, half * 2 + 1, 1, "#a89a80");
        p.line(cx - half - 2, top, cx - half - 6, bot + 8, "#5a4a3a"); p.line(cx + half + 2, top, cx + half + 6, bot + 8, "#5a4a3a");
      };
      sailAt(20, 52, 24); sailAt(60, 88, 20);
      p.rect(cx - 2, 20, 4, 68, "rgba(60,40,20,.25)");
      p.rect(cx - 3, 30, 6, 8, "#c83a3a"); p.rect(cx - 2, 31, 4, 6, "#e8c040");
      return c;
    }
    case "capstan": {
      const [c, p] = mk(18, 18);
      shadow(p, 9, 16, 7, 1.6);
      p.rect(4, 6, 10, 9, "#6a4428"); p.rect(4, 6, 2, 9, "#8a5a32"); p.rect(12, 6, 2, 9, "#4a2e18");
      ell(p, 9, 6, 5, 2, "#a8703c"); ell(p, 9, 6, 3, 1.2, "#7a4a26");
      for (const [x0, x1] of [[0, 18], [3, 15]] as const) p.rect(x0, 8 + (x0 ? 2 : 0), x1 - x0, 1, "#8a5a32");
      p.rect(4, 12, 10, 1, IRON);
      return c;
    }
    case "bell": {
      const [c, p] = mk(14, 26);
      shadow(p, 7, 24, 5, 1.4);
      p.rect(2, 6, 2, 18, "#6a4428"); p.rect(10, 6, 2, 18, "#6a4428"); p.rect(1, 4, 12, 3, "#8a5a32"); p.rect(1, 4, 12, 1, "#a8703c");
      poly(p, [[5, 8], [9, 8], [11, 15], [3, 15]], GOLD); p.rect(4, 8, 2, 7, "#f0d070"); p.rect(3, 15, 8, 1, "#a8802a"); p.px(7, 16, "#6a5020");
      return c;
    }
    case "nets": {
      const [c, p] = mk(22, 12);
      for (let y = 2; y < 11; y += 2) for (let x = 1 + (y % 4 ? 1 : 0); x < 21; x += 3) { p.px(x, y, "#c8b890"); p.px(x + 1, y + 1, "#a89870"); }
      ell(p, 6, 8, 3, 2, "#8a7a5a"); p.blob(15, 7, 3, 2, "#4a8aa8", { hi: 0.4 }); p.px(17, 6, "#c8e0f0");
      return c;
    }
    // ---- shop
    case "shopcounter": {
      // a: 0 middle 1 left 2 right; b: seed. Wares and a scale on top.
      const [c, p] = mk(16, 26);
      const s = Number(b) || 0, top = 9;
      p.rect(0, top, 16, 5, "#c8a870"); p.rect(0, top, 16, 1, "#f0d8a0"); p.rect(0, top + 5, 16, 1, "#5a3a1e");
      p.rect(0, top + 6, 16, 10, "#6a4a2e"); p.rect(1, top + 8, 14, 6, "#5a3c22"); p.rect(1, top + 8, 14, 1, "#3a2414");
      p.rect(0, 25, 16, 1, "rgba(24,12,40,.35)"); p.rect(0, top - 1, 16, 1, "#3a2414");
      if (v === 1) p.rect(0, top, 1, 16, "#3a2414");
      if (v === 2) p.rect(15, top, 1, 16, "#3a2414");
      const k = Math.floor(cell(s, 2, 43) * 6);
      if (k === 0) { p.rect(4, top - 6, 1, 6, IRON); p.rect(1, top - 6, 7, 1, IRON); ell(p, 2, top - 3, 2, 1, GOLD); ell(p, 7, top - 3, 2, 1, GOLD); p.rect(9, top - 2, 4, 2, "#e0c060"); }
      else if (k === 1) { POTION(p, 3, top - 6, "#c83a5a"); POTION(p, 7, top - 6, "#3a8ac8"); POTION(p, 11, top - 6, "#5ac85a"); }
      else if (k === 2) { p.rect(3, top - 2, 9, 3, "#e8dcc4"); p.rect(3, top - 2, 9, 1, "#fff8e8"); p.rect(7, top - 2, 1, 3, "#c8b890"); p.line(12, top - 5, 14, top, "#f0e8d0"); }
      else if (k === 3) { APPLES(p, 3, top - 3); APPLES(p, 9, top - 3); }
      else if (k === 4) { p.rect(3, top - 3, 10, 3, "#a8a8b0"); p.rect(3, top - 3, 10, 1, "#e8e8f0"); p.rect(12, top - 4, 3, 5, "#6a4428"); }
      return c;
    }
    case "goodsshelf": {
      // a tall shelf of wares against the wall (16 x 40); a: seed
      const [c, p] = mk(16, 40);
      shadow(p, 8, 38, 7, 1.5);
      p.rect(0, 2, 16, 36, "#6a4426"); p.rect(1, 3, 14, 34, "#3a2414");
      p.rect(0, 0, 16, 3, "#8a5a32"); p.rect(0, 0, 16, 1, "#b0804a");
      for (const y of [11, 20, 29]) { p.rect(1, y, 14, 2, "#8a5a32"); p.rect(1, y, 14, 1, "#b0804a"); }
      const s = v;
      for (const y of [11, 20, 29, 37]) {
        const r = Math.floor(cell(y, s, 5) * 5);
        if (r === 0) { POTION(p, 2, y - 6, "#c83a5a"); POTION(p, 6, y - 6, "#3a8ac8"); POTION(p, 10, y - 6, "#e0c040"); }
        else if (r === 1) { for (let x = 2; x < 14; x += 4) { p.rect(x, y - 5, 3, 5, "#c8b890"); p.rect(x, y - 5, 3, 1, "#8a6a40"); p.px(x + 1, y - 3, "#e8dcc4"); } }
        else if (r === 2) BOOKS(p, 2, y - 8, 6, s + y);
        else if (r === 3) { for (let x = 2; x < 14; x += 4) { ell(p, x + 1.5, y - 2, 2, 2, ["#c8b080", "#e8d8a0", "#a89060"][x % 3]); } }
        else { p.rect(2, y - 4, 5, 4, "#9a3a3a"); p.rect(2, y - 4, 5, 1, "#c85a5a"); p.rect(8, y - 3, 6, 3, "#3a5a8a"); p.rect(8, y - 3, 6, 1, "#5a7ab0"); }
      }
      p.rect(0, 37, 16, 1, "#2a1608");
      return c;
    }
    case "display": {
      // a low table of wares (32 x 22): weapons, shields, bolts of cloth or produce (a: kind)
      const [c, p] = mk(32, 22);
      shadow(p, 16, 20, 15, 2);
      box(p, 1, 8, 30, 6, 6, "#8a5a32");
      for (const x of [2, 28]) p.rect(x, 20, 2, 1, "#3a2214");
      if (v % 3 === 0) { // blades
        for (let k = 0; k < 3; k++) { const x = 4 + k * 9; p.rect(x, 9, 7, 1, "#d8dce8"); p.rect(x, 10, 7, 1, "#8a8e9a"); p.rect(x + 7, 8, 1, 4, GOLD); p.rect(x + 8, 9, 2, 2, "#5a3a22"); }
        poly(p, [[22, 2], [29, 2], [29, 8], [25.5, 11], [22, 8]], "#3a2a20"); poly(p, [[23, 3], [28, 3], [28, 8], [25.5, 10], [23, 8]], "#3a5a9a"); p.rect(25, 3, 1, 7, GOLD);
      } else if (v % 3 === 1) { // cloth
        for (let k = 0; k < 4; k++) { const col = CLOTH[(k + v) % CLOTH.length], x = 3 + k * 7; p.rect(x, 7 - (k % 2), 6, 5, col); p.rect(x, 7 - (k % 2), 6, 1, hs(col, 0.35)); p.rect(x + 5, 7 - (k % 2), 1, 5, hs(col, -0.3)); }
      } else { // produce in baskets
        for (let k = 0; k < 3; k++) { const x = 4 + k * 9; ell(p, x + 3, 10, 4, 2.5, "#a8803a"); ell(p, x + 3, 9, 3.2, 1.6, "#5a3a1e"); APPLES(p, x + 1, 6); if (k === 1) { p.rect(x + 1, 6, 4, 3, "#e8a030"); p.px(x + 2, 6, "#f8c860"); } }
      }
      return c;
    }
    case "armorstand": {
      const [c, p] = mk(16, 34);
      shadow(p, 8, 32, 6, 1.5);
      p.rect(7, 22, 2, 10, "#5a3a22"); p.rect(3, 31, 10, 2, "#5a3a22");
      const m = "#b8bcc8";
      p.rect(4, 10, 8, 12, m); p.rect(4, 10, 8, 2, hs(m, 0.3)); p.rect(11, 10, 1, 12, hs(m, -0.35)); p.rect(4, 15, 8, 1, hs(m, -0.25)); p.rect(4, 19, 8, 1, hs(m, -0.25));
      p.rect(2, 10, 3, 4, hs(m, 0.1)); p.rect(11, 10, 3, 4, hs(m, -0.1));
      p.rect(5, 2, 6, 7, m); p.rect(5, 2, 6, 1, hs(m, 0.35)); p.rect(6, 5, 4, 1, "#1a1a20"); p.rect(7, 0, 2, 2, "#c83a3a");
      p.rect(5, 22, 6, 3, "#6a4a3a");
      return c;
    }
    case "weaponwall": {
      // a wall board with spears, an axe and a bow (32 x 24)
      const [c, p] = mk(32, 24);
      p.rect(0, 2, 32, 20, "#6a4426"); p.rect(0, 2, 32, 1, "#9a6a3a"); p.rect(1, 3, 30, 18, "#5a3a20");
      for (const x of [4, 9]) { p.rect(x, 3, 1, 19, "#8a5a32"); poly(p, [[x - 1, 4], [x + 2, 4], [x + 0.5, 0]], "#c8ccd8"); }
      p.rect(16, 4, 1, 16, "#8a5a32"); poly(p, [[17, 4], [22, 3], [22, 10], [17, 9]], "#a8acb8"); p.rect(21, 3, 1, 7, "#e8ecf4");
      p.g.strokeStyle = "#8a5a32"; p.g.lineWidth = 1.5; p.g.beginPath(); p.g.arc(26, 12, 7, -Math.PI / 2, Math.PI / 2); p.g.stroke(); p.rect(26, 5, 1, 15, "#e8dcc4");
      for (const x of [2, 13, 24]) p.rect(x, 7, 3, 1, IRON);
      return c;
    }
    // ---- halls
    case "throne": {
      const [c, p] = mk(28, 40);
      shadow(p, 14, 38, 12, 2);
      const gold = "#d8a83a", red = "#8a1e2a";
      // tall back with a crest
      p.rect(5, 6, 18, 24, hs(gold, -0.2)); p.rect(6, 7, 16, 22, gold); p.rect(8, 9, 12, 18, red); p.rect(8, 9, 12, 2, hs(red, 0.3));
      for (let y = 12; y < 27; y += 4) for (let x = 9; x < 19; x += 4) p.px(x + ((y / 4) % 2 ? 2 : 0), y, hs(red, 0.25));
      poly(p, [[9, 6], [14, 0], [19, 6]], gold); p.px(14, 1, "#fff0a0"); for (const x of [6, 21]) { p.rect(x - 1, 2, 3, 5, gold); p.px(x, 2, "#fff0a0"); }
      p.rect(12, 3, 4, 3, "#c83a5a");
      // arms and seat
      for (const x of [2, 21]) { p.rect(x, 18, 5, 14, hs(gold, -0.1)); p.rect(x, 18, 5, 2, hs(gold, 0.35)); p.rect(x + 4, 18, 1, 14, hs(gold, -0.4)); }
      p.rect(7, 22, 14, 6, red); p.rect(7, 22, 14, 1, hs(red, 0.35)); p.rect(7, 27, 14, 2, hs(red, -0.25));
      p.rect(4, 29, 20, 7, hs(gold, -0.15)); p.rect(4, 29, 20, 1, hs(gold, 0.35)); p.rect(6, 31, 16, 3, hs(gold, -0.3));
      p.rect(4, 36, 20, 1, outline(gold));
      return c;
    }
    case "dais": {
      // a raised stone platform with steps, a tiles wide x 2 deep (flat, walkable)
      const tw = Math.max(3, v || 5), W = tw * 16, H = 32 + 6, [c, p] = mk(W, H);
      const st = b || "#b8b0a0";
      p.rect(0, 0, W, 24, st);
      for (let y = 0; y < 24; y += 6) for (let x = (y / 6) % 2 ? 0 : 8; x < W; x += 16) { p.rect(x, y, 1, 6, hs(st, -0.12)); p.rect(0, y, W, 1, hs(st, -0.1)); }
      p.rect(0, 0, W, 1, hs(st, 0.3));
      // two steps down to the floor
      p.rect(0, 24, W, 4, hs(st, -0.22)); p.rect(0, 24, W, 1, hs(st, 0.2));
      p.rect(-0, 28, W, 4, hs(st, 0.06)); p.rect(0, 28, W, 1, hs(st, 0.28));
      p.rect(0, 32, W, 4, hs(st, -0.3)); p.rect(0, 36, W, 2, "rgba(24,12,40,.3)");
      p.rect(0, 0, 1, 36, outline(st)); p.rect(W - 1, 0, 1, 36, outline(st));
      return c;
    }
    case "pillar": {
      // a column with a torch sconce on its front (16 x 52); flame live
      const [c, p] = mk(16, 52);
      const st = b || "#c8c0b0";
      shadow(p, 8, 49, 7, 2);
      p.rect(1, 42, 14, 8, hs(st, -0.12)); p.rect(1, 42, 14, 1, hs(st, 0.3)); p.rect(2, 40, 12, 2, hs(st, 0.08)); p.rect(1, 49, 14, 1, outline(st));
      p.column(3, 8, 10, 32, st);
      for (let x = 5; x < 12; x += 2) p.rect(x, 9, 1, 30, hs(st, -0.12));
      p.rect(1, 3, 14, 5, hs(st, 0.12)); p.rect(1, 3, 14, 1, hs(st, 0.35)); p.rect(1, 7, 14, 1, outline(st)); p.rect(2, 1, 12, 2, hs(st, 0.2));
      if (v) { p.rect(7, 20, 2, 7, "#5a3a22"); p.rect(6, 19, 4, 2, IRON); p.rect(6, 26, 4, 1, IRON); p.rect(8, 22, 1, 5, "#3a2414"); }
      return c;
    }
    case "armor": {
      // a suit of armour on a plinth, holding a halberd (16 x 40)
      const [c, p] = mk(16, 40);
      shadow(p, 8, 38, 6, 1.5);
      p.rect(3, 34, 10, 4, "#7a7680"); p.rect(3, 34, 10, 1, "#a8a4b0");
      const m = "#b0b4c0";
      p.rect(5, 24, 2, 10, hs(m, -0.1)); p.rect(9, 24, 2, 10, hs(m, -0.2));
      p.rect(4, 12, 8, 12, m); p.rect(4, 12, 8, 2, hs(m, 0.3)); p.rect(11, 12, 1, 12, hs(m, -0.35)); p.rect(4, 22, 8, 2, "#6a2a2a");
      p.rect(2, 12, 3, 9, hs(m, 0.06)); p.rect(11, 12, 3, 9, hs(m, -0.12));
      p.rect(5, 4, 6, 8, m); p.rect(5, 4, 6, 1, hs(m, 0.4)); p.rect(6, 7, 4, 1, "#141018"); p.rect(7, 1, 2, 3, "#c83a3a");
      p.rect(14, 0, 1, 34, "#6a4428"); poly(p, [[15, 2], [16, 4], [16, 9], [15, 8]], "#c8ccd8"); p.rect(12, 3, 2, 4, "#c8ccd8");
      return c;
    }
    case "banner": {
      const [c, p] = mk(14, 32);
      const col = b || CLOTH[v % CLOTH.length];
      p.rect(0, 0, 14, 2, "#4a3a2a"); p.px(0, 0, GOLD); p.px(13, 0, GOLD);
      p.rect(1, 2, 12, 24, col); p.rect(1, 2, 2, 24, hs(col, 0.2)); p.rect(11, 2, 2, 24, hs(col, -0.25));
      poly(p, [[1, 26], [13, 26], [7, 31]], col); p.line(1, 26, 7, 31, hs(col, -0.3)); p.line(13, 26, 7, 31, hs(col, -0.3));
      p.rect(1, 4, 12, 1, GOLD); p.rect(1, 23, 12, 1, GOLD);
      if (v % 2) { p.rect(4, 9, 6, 6, GOLD); p.rect(5, 10, 4, 4, col); p.px(7, 12, GOLD); p.rect(6, 16, 2, 4, GOLD); }
      else { poly(p, [[7, 8], [11, 12], [7, 20], [3, 12]], GOLD); poly(p, [[7, 10], [9.5, 12.5], [7, 18], [4.5, 12.5]], col); }
      return c;
    }
    case "brazier": {
      const [c, p] = mk(16, 24);
      shadow(p, 8, 22, 6, 1.5);
      p.line(4, 21, 7, 13, IRON, 2); p.line(12, 21, 9, 13, IRON, 2); p.rect(7, 13, 2, 8, "#2a2830");
      ell(p, 8, 11, 7, 3, "#2a2830"); ell(p, 8, 10, 6, 2, "#4a4850"); ell(p, 8, 10, 5, 1.4, "#ff8a2a"); p.rect(5, 9, 6, 1, "#ffd25a");
      p.rect(1, 10, 14, 2, "#3a3640"); p.rect(1, 10, 14, 1, "#6a6870");
      return c;
    }
    case "longtable": {
      // a banquet table, a tiles wide, with a cloth runner and a feast
      const tw = Math.max(2, v || 4), W = tw * 16, s = Number(b) || 0, [c, p] = mk(W, 26);
      shadow(p, W / 2, 24, W / 2 - 2, 2.4);
      const wd = "#8a5430";
      for (let x = 3; x < W - 3; x += 16) p.rect(x, 15, 3, 9, hs(wd, -0.32));
      p.rect(W - 6, 15, 3, 9, hs(wd, -0.32));
      p.rect(0, 4, W, 11, wd); p.rect(0, 4, W, 1, hs(wd, 0.32)); p.rect(0, 14, W, 2, hs(wd, -0.3));
      p.rect(0, 6, W, 6, "#e8e0d0"); p.rect(0, 6, W, 1, "#fffaf0"); p.rect(0, 11, W, 1, "#c8c0b0");
      for (let x = 0; x < W; x += 4) p.px(x, 12, "#c8c0b0");
      for (let k = 0; k * 8 + 4 < W - 4; k++) {
        const x = 3 + k * 8, r = cell(k, s, 11);
        if (r < 0.25) { MUG(p, x, 3); PLATE(p, x + 3, 9, k % 3); }
        else if (r < 0.45) { ROAST(p, x - 1, 6); }
        else if (r < 0.6) { BREAD(p, x, 7); BOTTLE(p, x + 5, 3, "#7a2a3a"); }
        else if (r < 0.75) { APPLES(p, x + 1, 6); }
        else { CANDLE(p, x + 3, 3, 4); PLATE(p, x - 1, 9, 2); }
      }
      return c;
    }
    case "desk": {
      // a clerk's desk with papers, a ledger, ink and a bell (32 x 24)
      const [c, p] = mk(32, 24);
      shadow(p, 16, 22, 15, 2);
      box(p, 1, 6, 30, 7, 9, "#7a4826", { panels: 2 });
      p.rect(3, 6, 9, 5, "#e8dcc4"); p.rect(3, 6, 9, 1, "#fff8e8"); p.rect(7, 6, 1, 5, "#c8b890"); for (let y = 8; y < 11; y++) { p.rect(4, y, 2, 1, "#8a7a6a"); p.rect(9, y, 2, 1, "#8a7a6a"); }
      p.rect(14, 5, 5, 4, "#f0e8d8"); p.rect(15, 4, 5, 4, "#f8f4ec"); p.line(22, 2, 24, 8, "#f0e8d0"); p.rect(23, 7, 3, 3, "#1a1a2a");
      ell(p, 28, 8, 2.5, 1.5, GOLD); p.px(28, 6, GOLD);
      return c;
    }
    case "noticeboard": {
      // a wall board crowded with notices and bounties (32 x 26)
      const [c, p] = mk(32, 26);
      p.rect(0, 0, 32, 24, "#5a3a22"); p.rect(2, 2, 28, 20, "#a8805a"); p.rect(0, 0, 32, 1, "#8a5a32");
      for (let k = 0; k < 8; k++) {
        const x = 3 + Math.floor(cell(k, v, 1) * 20), y = 3 + Math.floor(cell(k, v, 2) * 12), w = 5 + Math.floor(cell(k, v, 3) * 3), h = 6 + Math.floor(cell(k, v, 4) * 3);
        p.rect(x, y, w, h, k % 3 ? "#f0e8d0" : "#e8d8a8"); p.rect(x, y, w, 1, "#fffaf0");
        for (let yy = y + 2; yy < y + h - 1; yy += 2) p.rect(x + 1, yy, w - 2, 1, "#9a8a7a");
        p.px(x + (w >> 1), y, "#c83a3a");
        if (k === 2) { p.rect(x + 1, y + 2, w - 2, 3, "#c8a888"); p.px(x + 2, y + 3, "#3a2a20"); p.px(x + w - 3, y + 3, "#3a2a20"); }
      }
      p.rect(0, 24, 32, 2, "rgba(0,0,0,.3)");
      return c;
    }
    case "mapwall": {
      const [c, p] = mk(30, 22);
      p.rect(0, 0, 30, 20, "#e8d8a8"); p.rect(0, 0, 30, 1, "#fff0c8"); p.rect(0, 19, 30, 1, "#a8946a");
      p.blob(10, 9, 7, 5, "#a8c070", { outline: false }); p.blob(21, 11, 5, 4, "#a8c070", { outline: false }); p.blob(12, 8, 3, 2, "#8a9a60", { outline: false });
      for (let x = 2; x < 28; x += 2) p.px(x, 16, "#7aa0c0");
      p.line(6, 12, 20, 9, "#c83a3a"); p.px(20, 9, "#c83a3a"); p.rect(19, 8, 3, 3, "#c83a3a"); p.px(20, 9, "#fff0c0");
      p.rect(0, 0, 2, 2, "#8a5a32"); p.rect(28, 0, 2, 2, "#8a5a32"); p.rect(0, 20, 30, 2, "rgba(0,0,0,.3)");
      return c;
    }
    case "trophy": {
      // a boar / wolf head on a plaque (22 x 18)
      const [c, p] = mk(22, 18);
      poly(p, [[3, 2], [19, 2], [21, 9], [11, 17], [1, 9]], "#6a4428"); poly(p, [[4, 3], [18, 3], [20, 9], [11, 16], [2, 9]], "#8a5a32");
      const fur = v % 2 ? "#6a5a4a" : "#8a8a90";
      p.blob(11, 9, 5, 5, fur); p.rect(7, 3, 2, 3, fur); p.rect(13, 3, 2, 3, fur);
      p.rect(9, 11, 4, 4, hs(fur, 0.2)); p.px(9, 8, "#ffcc40"); p.px(13, 8, "#ffcc40"); p.px(10, 14, "#1a1010"); p.px(11, 14, "#1a1010");
      if (v % 2) { p.px(8, 13, "#f0e8d8"); p.px(14, 13, "#f0e8d8"); }
      return c;
    }
    // ---- temple
    case "altar": {
      // a stone altar under a cloth, with candles, a holy book and a golden symbol (48 x 34)
      const [c, p] = mk(48, 34);
      shadow(p, 24, 32, 22, 2.4);
      const st = "#e0d8c8";
      box(p, 2, 10, 44, 7, 15, st, { panels: 3 });
      p.rect(14, 10, 20, 20, "#7a2a6a"); p.rect(14, 10, 20, 1, "#a84a8a"); p.rect(14, 16, 20, 1, "#5a1a4a");
      for (let x = 14; x < 34; x += 2) p.px(x, 29, GOLD);
      p.rect(22, 19, 4, 6, GOLD); p.rect(20, 21, 8, 2, GOLD);
      // things on top
      p.rect(19, 7, 10, 4, "#f0e8d8"); p.rect(19, 7, 10, 1, "#fffaf0"); p.rect(23, 7, 1, 4, "#c8b890"); p.rect(24, 6, 1, 6, "#c83a3a");
      for (const x of [6, 10, 38, 42]) { p.rect(x - 1, 10, 3, 1, GOLD); p.rect(x, x % 4 ? 4 : 2, 1, x % 4 ? 6 : 8, "#f4ecd8"); }
      ell(p, 32, 10, 2.5, 1.2, GOLD); p.rect(31, 7, 3, 3, "#e8c040");
      ell(p, 15, 10, 2.5, 1.2, "#e8e4dc"); p.px(15, 9, "#f7d44c"); p.px(14, 9, "#e84a6a");
      return c;
    }
    case "saint": {
      // a robed statue with a halo on a plinth (20 x 52)
      const [c, p] = mk(20, 52);
      shadow(p, 10, 50, 8, 2);
      const st = b || "#d8d0c0";
      p.rect(2, 40, 16, 10, hs(st, -0.12)); p.rect(2, 40, 16, 1, hs(st, 0.3)); p.rect(2, 49, 16, 1, outline(st)); p.rect(3, 43, 14, 1, hs(st, -0.25));
      poly(p, [[5, 40], [7, 18], [13, 18], [15, 40]], st); poly(p, [[11, 18], [13, 18], [15, 40], [12, 40]], hs(st, -0.18)); poly(p, [[5, 40], [7, 18], [8, 18], [7, 40]], hs(st, 0.2));
      for (const y of [26, 33]) p.line(7, y, 13, y + 2, hs(st, -0.2));
      p.rect(6, 20, 8, 3, hs(st, 0.08)); p.rect(8, 22, 4, 4, hs(st, 0.15));
      p.blob(10, 14, 3.5, 4, st);
      p.g.strokeStyle = "#f2c542"; p.g.lineWidth = 1; p.g.beginPath(); p.g.ellipse(10, 11, 6, 2.2, 0, 0, Math.PI * 2); p.g.stroke();
      return c;
    }
    case "candelabra": {
      // a tall iron stand of candles (14 x 30); flames live
      const [c, p] = mk(14, 30);
      shadow(p, 7, 28, 5, 1.4);
      p.rect(6, 8, 2, 20, "#4a4248"); p.rect(3, 27, 8, 2, "#4a4248"); p.rect(4, 26, 6, 1, "#6a6268");
      p.rect(1, 8, 12, 1, "#4a4248"); p.rect(1, 6, 1, 2, "#4a4248"); p.rect(12, 6, 1, 2, "#4a4248");
      for (const [x, h] of [[1, 4], [6, 5], [12, 4]] as const) { p.rect(x - (x === 6 ? 0 : 0), 8 - h - (x === 6 ? 2 : 0), x === 6 ? 2 : 1, h, "#f4ecd8"); }
      return c;
    }
    case "pew": {
      // a pew of a tiles, seen from behind (the worshippers face the altar)
      const tw = Math.max(2, v || 3), W = tw * 16, [c, p] = mk(W, 22);
      shadow(p, W / 2, 20, W / 2 - 1, 1.6);
      const wd = "#7a4826";
      p.rect(1, 6, W - 2, 4, hs(wd, 0.1)); p.rect(1, 6, W - 2, 1, hs(wd, 0.3));
      p.rect(0, 9, W, 10, hs(wd, -0.08)); p.rect(0, 9, W, 1, hs(wd, 0.28)); p.rect(0, 9, W, 2, hs(wd, 0.12));
      for (let x = 6; x < W - 4; x += 10) { p.rect(x, 12, 7, 5, hs(wd, -0.2)); p.rect(x, 12, 7, 1, hs(wd, -0.34)); }
      for (const x of [0, W - 3]) { p.rect(x, 4, 3, 16, hs(wd, -0.05)); p.rect(x, 4, 3, 1, hs(wd, 0.35)); p.rect(x + 2, 4, 1, 16, hs(wd, -0.4)); }
      p.rect(0, 19, W, 1, outline(wd));
      return c;
    }
    case "stained": {
      // a tall arched window of coloured glass for a wall face (16 x 30)
      const [c, p] = mk(16, 30);
      p.rect(1, 6, 14, 24, "#6a6458");
      for (let i = 0; i < 7; i++) p.rect(1 + i, 6 - Math.round(Math.sqrt(49 - (7 - i) ** 2) * 0.85), 14 - i * 2, 1, "#6a6458");
      const cols = ["#c83a3a", "#3a6ac8", "#e0b030", "#3a9a5a", "#8a4ac8"];
      for (let y = 2; y < 28; y++) for (let x = 3; x < 13; x++) {
        const r2 = ((x - 8) / 5) ** 2 + ((y - 8) / 6) ** 2;
        if (y < 8 && r2 > 1) continue;
        const k = Math.floor(cell(Math.floor((x + (y >> 2)) / 3), y >> 2, v) * cols.length);
        p.px(x, y, (x + y) % 5 === 0 || y % 6 === 0 ? "#2a2420" : cols[k]);
      }
      p.rect(7, 2, 2, 26, "#2a2420"); p.rect(3, 15, 10, 1, "#2a2420");
      p.rect(0, 28, 16, 2, "#8a8478"); p.rect(0, 28, 16, 1, "#b0a898");
      return c;
    }
    case "font": {
      // a basin of holy water on a pedestal (18 x 22)
      const [c, p] = mk(18, 22);
      shadow(p, 9, 20, 7, 1.6);
      p.rect(6, 10, 6, 10, "#c8c0b0"); p.rect(6, 10, 2, 10, "#e0d8c8"); p.rect(4, 18, 10, 2, "#a8a090");
      ell(p, 9, 8, 8, 4, "#a8a090"); ell(p, 9, 7, 8, 3.5, "#d8d0c0"); ell(p, 9, 7, 6, 2.4, "#3a7ab0"); ell(p, 8, 6.5, 3, 1, "#8ac8f0");
      return c;
    }
    case "vase": {
      const [c, p] = mk(12, 20);
      shadow(p, 6, 18, 4, 1.2);
      p.blob(6, 14, 4, 4.5, "#3a6ab0", { hi: 0.4 }); p.rect(4, 8, 4, 3, "#3a6ab0"); p.rect(3, 7, 6, 1, "#5a8ad0");
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; const x = 6 + Math.cos(a) * 5, y = 7 + Math.sin(a) * 6; p.line(6, 8, x, y, "#3f8a3a"); p.rect(x - 1, y - 1, 2, 2, ["#f7d44c", "#ffffff", "#e84a6a", "#f7d44c", "#ffffff"][k]); }
      return c;
    }
    case "incense": {
      const [c, p] = mk(10, 12);
      p.rect(2, 7, 6, 4, "#c8a040"); p.rect(2, 7, 6, 1, "#f0d070"); p.rect(1, 10, 8, 1, "#8a6a20"); p.rect(4, 3, 1, 4, "#8a5a32"); p.rect(6, 4, 1, 3, "#8a5a32");
      return c;
    }
    case "fireplace": {
      // a small cottage fireplace (32 x 34)
      const [c, p] = mk(32, 34);
      const st = "#a8988a";
      wallTex(p, 2, 4, 28, 30, st, "stone", 9);
      p.rect(0, 4, 32, 3, "#7a4a26"); p.rect(0, 4, 32, 1, "#a8703c"); p.rect(0, 7, 32, 1, "rgba(0,0,0,.3)");
      CANDLE(p, 4, 0, 4); MUG(p, 25, 1); p.rect(12, 1, 6, 3, "#d8d0c0");
      p.rect(8, 13, 16, 21, "#2a1610"); p.rect(9, 15, 14, 17, "#140a06");
      for (let y = 15; y < 31; y++) p.rect(9, y, 14, 1, mix("#140a06", "#5a2410", (y - 15) / 16));
      p.rect(10, 29, 12, 3, "#4a2a14"); p.rect(12, 30, 8, 1, "#ff7a2a");
      ell(p, 16, 23, 4, 3.4, "#2a2830"); p.rect(12, 20, 9, 2, "#4a4850"); p.rect(15, 15, 2, 5, IRON);
      p.rect(6, 32, 20, 2, hs(st, -0.2));
      return c;
    }
    case "kitchen": {
      // a work counter with pots, a cleaver and hanging herbs (32 x 28)
      const [c, p] = mk(32, 28);
      shadow(p, 16, 26, 15, 2);
      box(p, 1, 12, 30, 5, 9, "#8a5a32", { panels: 2 });
      ell(p, 8, 12, 4, 2, "#3a3640"); ell(p, 8, 11, 3.4, 1.4, "#5a5660"); p.rect(4, 9, 8, 3, "#4a4650");
      p.rect(15, 10, 7, 3, "#c8a070"); p.rect(15, 10, 7, 1, "#e8c090"); p.rect(18, 8, 4, 2, "#d8dce8");
      ell(p, 27, 11, 3, 2.2, "#c8b080"); p.px(26, 9, "#c8302a"); p.px(28, 9, "#8ab03a");
      for (const x of [4, 10, 16, 22, 28]) { p.rect(x, 0, 1, 4, "#6a4428"); p.rect(x - 1, 4, 3, 3, ["#5a8a3a", "#c8a040", "#8a5a3a", "#5a8a3a", "#a8a8a0"][(x / 6) | 0]); }
      p.rect(0, 0, 32, 1, "#6a4428");
      return c;
    }
    case "loom": {
      // a spinning wheel (16 x 22)
      const [c, p] = mk(18, 22);
      shadow(p, 9, 20, 7, 1.5);
      p.line(3, 20, 7, 12, "#6a4428", 2); p.line(14, 20, 11, 12, "#6a4428", 2); p.rect(4, 13, 10, 2, "#8a5a32");
      p.g.strokeStyle = "#8a5a32"; p.g.lineWidth = 1; p.g.beginPath(); p.g.arc(9, 8, 6, 0, Math.PI * 2); p.g.stroke();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.line(9, 8, 9 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, "#a8703c"); }
      p.rect(13, 3, 3, 4, "#e8dcc4");
      return c;
    }
  }
  return makeCanvas(4, 4)[0];
});

// live flame points of the sprites that carry candles or torches (art px from the bottom centre)
flames("table1", [[0, -22, 0.35]]);
flames("table2", [[3, -22, 0.35]]);
flames("table3", [[0, -22, 0.35]]);
flames("roundtable", [[0, -19, 0.35]]);
flames("chandelier", Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + 0.3; return [Math.round(Math.cos(a) * 14), Math.round(Math.sin(a) * 3.6) - 14, 0.42] as [number, number, number]; }));
flames("candelabra", [[-6, -27, 0.4], [0, -30, 0.45], [6, -27, 0.4]]);
flames("pillar", [[0, -34, 0.65]]);
flames("altar", [[-18, -30, 0.35], [-14, -30, 0.35], [14, -30, 0.35], [18, -30, 0.35]]);

// ------------------------------------------------------------ outdoor buildings
/** A round or square tower with a conical roof (for keeps and castle corners). */
export function towerArt(p: Paint, x: number, top: number, w: number, bottom: number, o: { stone: string; roof?: string; lit: boolean; seed: number; slits?: boolean; flag?: string }) {
  const st = o.stone;
  // body: vertical cylinder shading over coursed stone
  wallTex(p, x, top, w, bottom - top, st, "stone", o.seed);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    const sh = t < 0.15 ? 0.16 : t > 0.7 ? -0.12 - (t - 0.7) * 0.6 : 0;
    if (sh) { p.g.fillStyle = sh > 0 ? `rgba(255,240,210,${sh})` : `rgba(20,10,40,${-sh})`; p.g.fillRect(x + i, top, 1, bottom - top); }
  }
  p.rect(x - 1, top, 1, bottom - top, outline(st)); p.rect(x + w, top, 1, bottom - top, outline(st));
  // corbelled parapet with merlons
  p.rect(x - 2, top - 3, w + 4, 4, hs(st, 0.06)); p.rect(x - 2, top - 3, w + 4, 1, hs(st, 0.3)); p.rect(x - 2, top + 1, w + 4, 1, hs(st, -0.4));
  for (let k = x - 2; k < x + w + 2; k += 3) p.rect(k, top + 1, 1, 2, hs(st, -0.3));
  if (o.roof) {
    const cx = x + w / 2, ph = Math.round(w * 1.25);
    for (let i = 0; i <= ph; i++) {
      const hw = Math.round(((i / ph) * (w + 4)) / 2);
      for (let xx = -hw; xx <= hw; xx++) {
        const u = (xx + hw) / Math.max(1, 2 * hw);
        p.px(cx + xx, top - 3 - ph + i, hs(o.roof, (u < 0.35 ? 0.15 : u > 0.7 ? -0.25 : 0) + (i % 3 === 0 ? -0.1 : 0)));
      }
      p.px(cx - hw - 1, top - 3 - ph + i, outline(o.roof)); p.px(cx + hw + 1, top - 3 - ph + i, outline(o.roof));
    }
    p.rect(cx - 1 - (w + 4) / 2, top - 3, w + 6, 1, outline(o.roof));
    if (o.flag) { p.rect(Math.round(cx), top - 3 - ph - 9, 1, 9, "#4a3a2a"); p.rect(Math.round(cx) + 1, top - 3 - ph - 9, 6, 2, o.flag); p.rect(Math.round(cx) + 1, top - 3 - ph - 7, 4, 2, hs(o.flag, -0.2)); }
  } else {
    for (let k = x - 2; k < x + w + 2; k += 4) { p.rect(k, top - 7, 3, 4, st); p.rect(k, top - 7, 3, 1, hs(st, 0.3)); p.rect(k + 2, top - 6, 1, 3, hs(st, -0.3)); }
    if (o.flag) { const fx = Math.round(x + w / 2); p.rect(fx, top - 18, 1, 12, "#4a3a2a"); p.rect(fx + 1, top - 18, 7, 3, o.flag); p.rect(fx + 1, top - 15, 5, 2, hs(o.flag, -0.2)); }
  }
  // windows / arrow slits
  for (let y = top + 5; y < bottom - 8; y += 11) {
    const wx = Math.round(x + w / 2 - 1);
    if (o.slits) { p.rect(wx, y, 2, 6, "#1a161a"); if (o.lit) p.rect(wx, y + 1, 1, 4, "#ffc860"); }
    else { p.rect(wx - 1, y, 4, 6, "#1a161a"); p.rect(wx, y - 1, 2, 1, "#1a161a"); if (o.lit) p.rect(wx, y + 1, 2, 4, "#ffc860"); else p.rect(wx, y + 1, 1, 2, "#4a5a7a"); p.rect(wx - 1, y + 6, 4, 1, hs(st, 0.2)); }
  }
}

/** Crenellated wall walk seen from the front: merlons over a parapet. */
export function battlements(p: Paint, x: number, y: number, w: number, st: string) {
  p.rect(x, y, w, 4, hs(st, 0.08)); p.rect(x, y, w, 1, hs(st, 0.3)); p.rect(x, y + 3, w, 1, hs(st, -0.35));
  for (let k = x; k < x + w - 1; k += 5) { p.rect(k, y - 4, 3, 4, st); p.rect(k, y - 4, 3, 1, hs(st, 0.32)); p.rect(k + 2, y - 3, 1, 3, hs(st, -0.3)); p.px(k - 1, y - 4, outline(st)); }
}

/** A great arched castle door with a raised portcullis. */
export function castleDoor(p: Paint, cx: number, bottom: number, w: number, h: number, st: string, closed: boolean) {
  const x = Math.round(cx - w / 2), y = bottom - h;
  // voussoirs around the arch
  for (let i = -2; i <= w + 1; i++) {
    const dx = i - w / 2 + 0.5, r = w / 2 + 2;
    const ay = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)) * 0.7);
    p.rect(x + i, y + Math.round(w * 0.35) - ay - 1, 1, ay + 2, (i + 20) % 3 ? hs(st, 0.12) : hs(st, -0.2));
  }
  p.rect(x - 2, y + Math.round(w * 0.35), 2, h - Math.round(w * 0.35), hs(st, 0.12)); p.rect(x + w, y + Math.round(w * 0.35), 2, h - Math.round(w * 0.35), hs(st, -0.12));
  for (let i = 0; i < w; i++) {
    const dx = i - w / 2 + 0.5, r = w / 2;
    const ay = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)) * 0.7);
    p.rect(x + i, y + Math.round(w * 0.35) - ay, 1, h - Math.round(w * 0.35) + ay, "#1a1410");
  }
  if (closed) {
    doorAt(p, x, y + 2, { w, h: h - 2, col: "#7a4a2a", arch: true, double: true });
  } else {
    for (let yy = y + 2; yy < bottom; yy++) p.rect(x, yy, w, 1, mix("#0e0a08", "#3a2a20", (yy - y) / h));
    // the portcullis teeth hanging under the arch
    for (let k = x + 1; k < x + w; k += 3) { p.rect(k, y + 1, 1, 6, "#4a4448"); p.px(k, y + 7, "#6a6468"); }
    p.rect(x, y + 3, w, 1, "#4a4448");
  }
}

// ------------------------------------------------------------ ship
/**
 * The hull and deck of a ship, drawn smooth over the tile layout (native px). The deck is the
 * region |y - cy| <= halfW(x); the hull side shows below the deck's southern edge.
 */
export function drawShip(p: Paint, o: { cx: number; cy: number; halfL: number; halfW: number; deckOf: (u: number) => number }) {
  const { cx, cy, halfL, halfW, deckOf } = o;
  const x0 = Math.floor(cx - halfL * 1.08), x1 = Math.ceil(cx + halfL * 1.1);
  const hw = (x: number) => deckOf((x - cx) / halfL) * halfW;
  const hullDrop = 13;
  // water shadow and foam
  for (let x = x0 - 4; x <= x1 + 4; x++) {
    const h = hw(Math.min(x1, Math.max(x0, x)));
    if (h <= 0) continue;
    p.g.fillStyle = "rgba(10,30,60,.35)"; p.g.fillRect(x, Math.round(cy + h + hullDrop - 1), 1, 5);
    if (cell(x, 1, 7) > 0.35) { p.g.fillStyle = "rgba(240,250,255,.75)"; p.g.fillRect(x, Math.round(cy + h + hullDrop - 1 + (cell(x, 2, 7) > 0.5 ? 1 : 0)), 1, 1); }
  }
  // hull side below the deck edge
  for (let x = x0; x <= x1; x++) {
    const h = hw(x);
    if (h <= 0.5) continue;
    const top = Math.round(cy + h), u = (x - cx) / halfL;
    const lift = u > 0.6 ? Math.round((u - 0.6) * 10) : 0;
    for (let y = top - lift; y < top + hullDrop; y++) {
      const k = y - top;
      let col = k < 2 ? "#3a2210" : k % 3 === 0 ? "#4a2c16" : (k >> 1) % 2 ? "#6a4022" : "#7a4a28";
      if (k >= hullDrop - 4) col = k === hullDrop - 4 ? "#e8dcc4" : "#2a3a5a";
      if (cell(x >> 2, k, 3) > 0.92 && k > 2 && k < hullDrop - 4) col = "#5a3218";
      p.px(x, y, col);
    }
    if (x % 11 === 0 && u > -0.85 && u < 0.7) { p.rect(x - 1, top + 3, 3, 3, "#1a1410"); p.px(x - 1, top + 3, "#3a2a20"); }
  }
  // deck: planks along the ship
  for (let x = x0; x <= x1; x++) {
    const h = hw(x);
    if (h <= 0.5) continue;
    const yA = Math.round(cy - h), yB = Math.round(cy + h);
    for (let y = yA; y <= yB; y++) {
      const row = Math.floor((y - cy + 200) / 4), within = (y - cy + 200) % 4;
      const seam = ((x + row * 13) % 26 + 26) % 26;
      let col = ["#b88050", "#a87444", "#c08a58", "#b07a48"][((row % 4) + 4) % 4];
      if (within === 3) col = "#6a4428";
      else if (within === 0) col = hs(col, 0.12);
      if (seam === 0) col = "#6a4428";
      if (seam === 1 && within === 1) col = "#4a2e18";
      p.px(x, y, col);
    }
  }
  // bulwark: a thick rail all round, lit on the north side
  for (let x = x0; x <= x1; x++) {
    const h = hw(x);
    if (h <= 0.5) continue;
    const yA = Math.round(cy - h), yB = Math.round(cy + h);
    p.rect(x, yA - 4, 1, 4, "#7a4a28"); p.px(x, yA - 4, "#c8945a"); p.px(x, yA - 3, "#a8703c"); p.px(x, yA, "rgba(24,12,40,.35)"); p.px(x, yA + 1, "rgba(24,12,40,.2)");
    p.rect(x, yB - 1, 1, 3, "#5a3418"); p.px(x, yB - 2, "#a8703c"); p.px(x, yB - 3, "rgba(24,12,40,.25)");
    if (x % 8 === 0) { p.rect(x, yA - 4, 1, 5, "#4a2a14"); p.rect(x, yB - 2, 1, 4, "#4a2a14"); }
  }
  // the ends
  for (const x of [x0, x1]) { const h = hw(x); if (h > 0.5) p.rect(x, Math.round(cy - h) - 4, 1, Math.round(h * 2) + 6, "#4a2a14"); }
}

// ------------------------------------------------------------ dungeon wall dressing
/** Pilasters, a plinth, damp and cracks over a dungeon wall face (native px). */
export function dungeonFace(p: Paint, x: number, y: number, w: number, h: number, col: string, s: number) {
  // plinth
  p.rect(x, y + h - 4, w, 3, hs(col, -0.22)); p.rect(x, y + h - 4, w, 1, hs(col, 0.12));
  // pilasters every few tiles
  for (let xx = x + 6; xx < x + w - 4; xx += 32) {
    p.rect(xx, y + 2, 5, h - 6, hs(col, 0.1)); p.rect(xx, y + 2, 1, h - 6, hs(col, 0.32)); p.rect(xx + 4, y + 2, 1, h - 6, hs(col, -0.35));
    for (let yy = y + 5; yy < y + h - 5; yy += 4) p.rect(xx + 1, yy, 3, 1, hs(col, -0.12));
    p.rect(xx - 1, y + 2, 7, 2, hs(col, 0.2)); p.rect(xx - 1, y + h - 6, 7, 2, hs(col, -0.1));
  }
  // damp streaks, moss, cracks
  for (let k = 0; k < w / 9; k++) {
    const cx = x + Math.floor(cell(k, s, 11) * w), r = cell(k, s, 12);
    if (r < 0.35) for (let yy = y + 3; yy < y + h - 4; yy++) if (cell(cx, yy, s) > 0.3) p.px(cx, yy, rgba("#0a0a10", 0.25));
    else if (r < 0.55) { for (let i = 0; i < 4; i++) p.px(cx + i - 1, y + h - 5 - (i % 2), "#3a5a2a"); p.px(cx, y + h - 6, "#4a7a3a"); }
    else if (r < 0.75) { const cy = y + 4 + Math.floor(cell(k, s, 13) * (h - 10)); p.line(cx, cy, cx + 2, cy + 3, hs(col, -0.45)); p.line(cx + 2, cy + 3, cx + 1, cy + 6, hs(col, -0.45)); }
  }
  // the top lip throws a band of shadow
  p.g.fillStyle = "rgba(10,6,16,.25)"; p.g.fillRect(x, y + 2, w, 2);
}

/** A tall arched window in a stone face. */
export function archWin(p: Paint, x: number, y: number, lit: boolean) {
  p.rect(x - 1, y + 1, 7, 12, "#4a4448"); p.rect(x, y - 1, 5, 2, "#4a4448");
  p.rect(x, y + 1, 5, 11, "#1a161a"); p.rect(x + 1, y, 3, 1, "#1a161a");
  for (let yy = y + 1; yy < y + 11; yy++) p.rect(x + 1, yy, 3, 1, lit ? (yy < y + 6 ? "#ffe08a" : "#f0a848") : yy < y + 4 ? "#7aa0c8" : "#3e5a80");
  p.rect(x + 2, y + 1, 1, 10, "#2a2428"); p.rect(x + 1, y + 6, 3, 1, "#2a2428");
  if (!lit) p.px(x + 1, y + 1, "#d8f0ff");
  p.rect(x - 1, y + 12, 7, 1, "#d8d0c0");
}

/** A long banner hung from a wall top. */
export function hangBanner(p: Paint, x: number, y: number, col: string) {
  p.rect(x - 1, y, 8, 1, "#4a3a2a"); p.px(x - 1, y, GOLD); p.px(x + 6, y, GOLD);
  p.rect(x, y + 1, 6, 16, col); p.rect(x, y + 1, 1, 16, hs(col, 0.25)); p.rect(x + 5, y + 1, 1, 16, hs(col, -0.3));
  poly(p, [[x, y + 17], [x + 6, y + 17], [x + 3, y + 21]], col);
  p.rect(x, y + 3, 6, 1, GOLD); p.rect(x + 2, y + 7, 2, 5, GOLD); p.rect(x + 1, y + 8, 4, 1, GOLD);
}
