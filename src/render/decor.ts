import { cell, doorAt, foundation, groundShadow, roofSlab, wallTex, windowAt } from "./houses";
import { hs, outline, type Paint } from "./palette";

/**
 * Decorations and outdoor buildings (fields, ponds, orchards, parks...) in the same
 * three-quarter style as the houses: leafy canopies with lit clumps and ragged edges, barked
 * trunks, water that deepens towards the middle inside a ring of stones, layered flames with a
 * glow, and stone and wood that reuse the house materials.
 * A 1x1 piece is drawn on a 16x32 canvas (bottom 16px = its tile), 2x1 on 32x32, 2x2 on 32x48,
 * 3x2 on 48x48 and 3x3 on 48x64. Ground contact sits around y = H - 2.
 */
type Drawer = (p: Paint, W: number, H: number, level: number) => void;

const WOOD = "#b07a48", DARK = "#6a4428", STONE = "#9a9aa0", LEAF = "#3f8a3a", IRON = "#34323c", GRASS = "#5aa83a";

// ------------------------------------------------------------ toolkit
function shadow(p: Paint, cx: number, cy: number, rx: number, ry = 2) {
  p.g.fillStyle = "rgba(24,12,40,.18)";
  p.g.beginPath(); p.g.ellipse(cx + 1, cy, rx + 1, ry + 0.5, 0, 0, Math.PI * 2); p.g.fill();
  p.g.fillStyle = "rgba(24,12,40,.2)";
  p.g.beginPath(); p.g.ellipse(cx, cy, rx * 0.8, ry * 0.75, 0, 0, Math.PI * 2); p.g.fill();
}
function ell(p: Paint, cx: number, cy: number, rx: number, ry: number, col: string) {
  p.g.fillStyle = col; p.g.beginPath(); p.g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); p.g.fill();
}
function glow(p: Paint, x: number, y: number, r: number, col = "255,210,110") {
  const gr = p.g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},0.38)`); gr.addColorStop(1, `rgba(${col},0)`);
  p.g.fillStyle = gr; p.g.fillRect(x - r, y - r, r * 2, r * 2);
}
/** A round post or pole: lit left edge, shaded right edge, outline. */
function post(p: Paint, x: number, top: number, bottom: number, col = WOOD, w = 2) {
  if (w <= 2) { p.rect(x, top, w, bottom - top, col); p.rect(x, top, 1, bottom - top, hs(col, 0.25)); if (w === 2) p.rect(x + 1, top, 1, bottom - top, hs(col, -0.25)); return; }
  p.column(x, top, w, bottom - top, col);
}
/** Leafy crown: a bumpy silhouette, clumps lit from the upper left, dark underside and outline. */
function canopy(p: Paint, cx: number, cy: number, rx: number, ry: number, col: string, s = 0) {
  const hi = hs(col, 0.42), lit = hs(col, 0.2), lo = hs(col, -0.22), dk = hs(col, -0.42), ol = outline(col);
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const a = Math.atan2(dy, dx);
      const bump = 1 + 0.1 * Math.sin(a * 7 + s) + 0.06 * Math.sin(a * 12 + s * 3);
      const d = Math.hypot(dx, dy) / bump;
      if (d > 1) continue;
      const n = cell(Math.floor((x + s) / 3), Math.floor(y / 3), s);
      const light = -dx * 0.55 - dy * 0.75 + (n - 0.5) * 0.7;
      let c = light > 0.85 ? hi : light > 0.3 ? lit : light < -0.6 ? dk : light < -0.15 ? lo : col;
      if (d > 0.88 && (dy > -0.25 || dx > 0.35)) c = ol;
      p.px(x, y, c);
    }
  }
}
function trunk(p: Paint, x: number, top: number, bottom: number, col = "#7a4a2a", w = 4) {
  p.column(x, top, w, bottom - top, col);
  for (let y = top + 2; y < bottom - 1; y += 3) p.px(x + 1 + (y % 2), y, hs(col, -0.3));
  p.px(x - 1, bottom - 1, hs(col, -0.1)); p.px(x + w, bottom - 1, hs(col, -0.25));
}
/** Water in a ring of stones: deeper towards the middle, shadow under the rim, ripples. */
function pond(p: Paint, cx: number, cy: number, rx: number, ry: number, s = 0, water = "#3a8ac8") {
  for (let y = Math.floor(cy - ry - 3); y <= Math.ceil(cy + ry + 3); y++) {
    for (let x = Math.floor(cx - rx - 3); x <= Math.ceil(cx + rx + 3); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      const dr = Math.hypot((x + 0.5 - cx) / (rx + 2.5), (y + 0.5 - cy) / (ry + 2));
      if (d <= 1) {
        const top = dy < -0.55 && d > 0.75;
        const depth = 1 - d;
        let c = hs(water, 0.18 - depth * 0.5);
        if (top) c = hs(water, -0.45);
        if ((x * 3 + y * 7 + s) % 23 === 0 && depth > 0.25) c = hs(water, 0.5);
        p.px(x, y, c);
      } else if (dr <= 1) {
        const n = cell(Math.floor(Math.atan2(dy, dx) * 4 + 9), 0, s);
        const sc = hs(STONE, (n - 0.5) * 0.3 + (dy < 0 ? 0.08 : -0.1));
        p.px(x, y, dr > 0.9 ? outline(STONE) : (Math.floor(Math.atan2(dy, dx) * 6 + s) % 2 === 0 && dr > 0.8) ? hs(sc, -0.2) : sc);
      }
    }
  }
  for (let k = 0; k < 3; k++) { const x = cx - rx * 0.4 + k * rx * 0.35, y = cy - ry * 0.1 + (k % 2) * ry * 0.35; p.rect(x, y, 3, 1, "rgba(220,245,255,0.7)"); }
}
function flame(p: Paint, x: number, y: number, s = 1) {
  glow(p, x, y, 9 * s, "255,150,60");
  p.blob(x, y, 2.6 * s, 4 * s, "#e8502a", { outline: false, hi: 0.2 });
  p.blob(x, y + 0.8 * s, 1.8 * s, 2.8 * s, "#ff9a3a", { outline: false });
  p.blob(x, y + 1.5 * s, 1 * s, 1.6 * s, "#ffe27a", { outline: false });
  p.px(x, y - 4 * s, "#ff7a3a");
}
function flower(p: Paint, x: number, y: number, col: string) {
  p.px(x - 1, y, col); p.px(x + 1, y, col); p.px(x, y - 1, hs(col, 0.25)); p.px(x, y + 1, hs(col, -0.2)); p.px(x, y, "#fff3a0");
}
function grassTufts(p: Paint, x0: number, y0: number, w: number, h: number, s: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(cell(i, 1, s) * w), y = y0 + Math.floor(cell(i, 2, s) * h);
    p.px(x, y, "#4a9030"); p.px(x + 1, y - 1, "#6ab84a");
  }
}
function plinth(p: Paint, x: number, y: number, w: number, h = 4, col = STONE) {
  wallTex(p, x, y, w, h, col, "stone", x + y);
  p.rect(x - 1, y - 1, w + 2, 2, hs(col, 0.15)); p.rect(x - 1, y - 1, w + 2, 1, hs(col, 0.38));
  p.rect(x - 1, y + 1, w + 2, 1, outline(col));
}
/** Fruit or blossom dots on a crown. */
function dots(p: Paint, pts: [number, number][], col: string) {
  for (const [x, y] of pts) { p.px(x, y, col); p.px(x + 1, y, hs(col, -0.25)); p.px(x, y - 1, hs(col, 0.4)); }
}
function fruitTree(p: Paint, cx: number, base: number, r: number, leaf: string, fruit: string | null, s: number, trunkCol = "#7a4a2a") {
  shadow(p, cx, base, r * 0.8, 2);
  trunk(p, cx - 2, base - r - 4, base, trunkCol);
  canopy(p, cx, base - r - 6, r, r * 0.85, leaf, s);
  if (fruit) dots(p, [[cx - r * 0.5, base - r - 6], [cx + r * 0.3, base - r - 9], [cx + r * 0.5, base - r - 4], [cx - r * 0.1, base - r - 3]].map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), fruit);
}
function fence(p: Paint, col: string, pointed = false) {
  shadow(p, 8, 30, 8, 1.5);
  for (const y of [21, 26]) { p.rect(0, y, 16, 2, col); p.rect(0, y, 16, 1, hs(col, 0.28)); p.rect(0, y + 2, 16, 1, outline(col)); }
  for (const x of [1, 12]) {
    post(p, x, 17, 30, col, 3);
    if (pointed) { p.px(x + 1, 16, hs(col, 0.2)); p.rect(x, 17, 3, 1, hs(col, 0.25)); }
    else p.rect(x, 17, 3, 1, hs(col, 0.3));
  }
}

// ------------------------------------------------------------ pieces
export const DECOR_DRAW: Record<string, Drawer> = {
  // ---------------------------------------------------------- farm & water buildings
  farm: (p) => {
    // tilled soil in a low wooden edging: furrows lit from above, a few clods
    const soil = "#7a4e2c";
    p.g.fillStyle = "rgba(24,12,40,.2)"; p.g.fillRect(1, 31, 15, 1);
    p.rect(0, 16, 16, 15, "#8a5a30");
    p.rect(0, 16, 16, 1, "#c89058"); p.rect(0, 16, 1, 15, "#b07a48"); p.rect(15, 16, 1, 15, outline("#8a5a30"));
    p.rect(0, 29, 16, 2, "#9a6a3a"); p.rect(0, 29, 16, 1, "#c08a50"); p.rect(0, 30, 16, 1, outline("#9a6a3a"));
    p.rect(1, 17, 14, 12, soil);
    for (let y = 18; y < 29; y += 3) { p.rect(1, y, 14, 1, hs(soil, 0.16)); p.rect(1, y + 1, 14, 1, soil); p.rect(1, y + 2, 14, 1, hs(soil, -0.3)); }
    for (let i = 0; i < 7; i++) { const x = 2 + Math.floor(cell(i, 3) * 12), y = 18 + Math.floor(cell(i, 4) * 10); p.px(x, y, hs(soil, 0.3)); p.px(x + 1, y + 1, hs(soil, -0.4)); }
    p.g.fillStyle = "rgba(24,12,40,.18)"; p.g.fillRect(1, 17, 14, 1);
  },
  sprinkler: (p) => {
    shadow(p, 8, 30, 4, 1.5);
    plinth(p, 5, 27, 6, 2, "#8a8f96");
    p.column(7, 16, 3, 11, "#9aa4b0");
    p.rect(5, 14, 7, 3, "#c8d0d8"); p.rect(5, 14, 7, 1, "#eef4f8"); p.rect(5, 16, 7, 1, outline("#c8d0d8"));
    p.px(8, 13, "#5ab0ff");
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; p.px(8 + Math.cos(a) * 7, 14 + Math.sin(a) * 6 + (i % 2), i % 2 ? "#8ad0ff" : "#c8ecff"); }
  },
  fishpond: (p, W, H) => {
    pond(p, W / 2, H - 15, W / 2 - 4, 10, 3);
    // lily pads and a flower, two fish shadows, reeds on the bank
    for (const [x, y] of [[9, H - 20], [21, H - 12]]) { ell(p, x, y, 3.2, 2, "#4f9a35"); p.px(x + 1, y - 1, "#7ac050"); p.px(x + 2, y, "#2f6a2a"); }
    p.blob(9, H - 21, 1.4, 1.2, "#f8b0d0", { outline: false }); p.px(9, H - 21, "#fff3a0");
    for (const [x, y, c] of [[17, H - 18, "#f28a3a"], [13, H - 11, "#e8e8f0"]] as const) { p.rect(x, y, 3, 1, c); p.px(x + 3, y, hs(c, -0.2)); p.px(x - 1, y - 1, hs(c, -0.2)); }
    for (const x of [3, 5, W - 4]) { p.rect(x, H - 30, 1, 8, "#4f8a35"); p.rect(x, H - 31, 1, 2, "#8a5a30"); }
    p.rect(W - 9, H - 9, 7, 2, "#b07a48"); p.rect(W - 9, H - 9, 7, 1, "#d8a070"); post(p, W - 8, H - 7, H - 3, DARK, 1); post(p, W - 3, H - 7, H - 3, DARK, 1);
  },
  orchard: (p, W, H) => {
    p.rect(1, 18, W - 2, H - 20, GRASS);
    p.rect(1, 18, W - 2, 1, hs(GRASS, 0.2)); p.rect(1, H - 3, W - 2, 1, hs(GRASS, -0.3));
    grassTufts(p, 2, 20, W - 4, H - 24, 7, 20);
    for (const [x, base, f, s] of [[9, 30, "#e8303a", 1], [25, 28, "#f0902a", 2], [40, 30, "#e8303a", 3], [16, 44, "#d8d060", 4], [33, 44, "#e8303a", 5]] as const) fruitTree(p, x, base, 6, "#3f8a3a", f, s);
    for (const [x, y] of [[2, 18], [W - 3, 18], [2, H - 4], [W - 3, H - 4]]) post(p, x, y - 4, y + 1, WOOD, 2);
  },
  fisherhut: (p, W, H) => {
    // a hut on stilts over the water
    for (let y = H - 9; y < H - 1; y++) for (let x = 0; x < W; x++) p.px(x, y, (x * 5 + y * 3) % 17 === 0 ? "#a8dcff" : y < H - 7 ? "#2a6aa8" : "#3a8ac8");
    for (const x of [4, 13, W - 6]) post(p, x, H - 14, H - 2, DARK, 2);
    p.rect(1, H - 15, W - 2, 2, "#b07a48"); p.rect(1, H - 15, W - 2, 1, "#d8a070"); p.rect(1, H - 13, W - 2, 1, outline("#b07a48"));
    wallTex(p, 4, H - 26, 16, 11, "#a87a48", "log", 4);
    roofSlab(p, 2, 21, 4, H - 25, "#c8a050", "thatch", 6);
    doorAt(p, 9, H - 24, { w: 5, h: 8, col: "#7a4a2a" });
    p.line(W - 5, 4, W - 2, H - 12, "#c8a878"); p.line(W - 5, 4, W - 9, H - 18, "#8a5a2a");
    p.rect(W - 9, H - 18, 2, 3, "#3a6ab0");
  },
  observatory: (p, W, H) => {
    groundShadow(p, W, H);
    wallTex(p, 2, 22, W - 4, H - 27, "#a8a8b4", "stone", 8);
    foundation(p, 0, H - 5, W);
    // dome: shaded half-sphere with an open slit and a telescope peeking out
    const cx = W / 2, cy = 23, r = W / 2 - 2;
    for (let y = cy - r; y <= cy; y++) for (let x = cx - r; x <= cx + r; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.6 - dy * 0.6;
      p.px(x, y, dx * dx + dy * dy > 0.86 ? outline("#4a5a9a") : l > 0.5 ? "#7a8ad0" : l > 0 ? "#5a6ab8" : "#44509a");
    }
    p.rect(cx - 2, cy - r + 1, 4, r - 1, "#141428");
    p.line(cx, cy - 4, cx + 10, cy - r - 4, "#c8a040", 2); p.rect(cx + 9, cy - r - 6, 3, 3, "#e8c860");
    for (const [x, y] of [[4, 4], [26, 3], [22, 9], [7, 11]]) { p.px(x, y, "#fff6a0"); }
    doorAt(p, cx - 3, H - 14, { col: "#5a4a6a", arch: true });
    windowAt(p, 5, 28, { w: 5, h: 6, lit: true }); windowAt(p, W - 10, 28, { w: 5, h: 6, lit: true });
  },
  treehouse: (p, W, H) => {
    shadow(p, W / 2, H - 3, 13, 3);
    trunk(p, W / 2 - 4, 20, H - 2, "#7a4a2a", 8);
    canopy(p, W / 2, 13, 15, 11, "#3f8a3a", 5);
    // platform, cabin and ladder
    p.rect(5, 27, 22, 2, "#9a6a3a"); p.rect(5, 27, 22, 1, "#c89a60"); p.rect(5, 29, 22, 1, outline("#9a6a3a"));
    wallTex(p, 8, 18, 16, 9, "#b07a48", "plank", 9);
    roofSlab(p, 6, 25, 11, 18, "#b84a3a", "shingle", 9);
    windowAt(p, 13, 20, { w: 5, h: 5, lit: true });
    for (let y = 30; y < H - 2; y += 3) p.rect(W / 2 + 5, y, 5, 1, "#c8a070");
    post(p, W / 2 + 4, 29, H - 2, DARK, 1); post(p, W / 2 + 9, 29, H - 2, DARK, 1);
  },
  training: (p, W, H) => {
    p.rect(1, 18, W - 2, H - 20, "#d8c090"); p.rect(1, 18, W - 2, 1, "#e8d4a8"); p.rect(1, H - 3, W - 2, 1, "#a8905a");
    for (let i = 0; i < 14; i++) p.px(2 + Math.floor(cell(i, 5) * (W - 4)), 19 + Math.floor(cell(i, 6) * (H - 22)), "#c0a870");
    for (const x of [8, 23]) {
      shadow(p, x + 1, 38, 4, 1.5);
      post(p, x, 20, 38, DARK, 2);
      p.rect(x - 5, 26, 12, 2, DARK);
      p.blob(x + 1, 29, 4, 5, "#d8b860"); for (let y = 25; y < 34; y += 2) p.rect(x - 2, y, 6, 1, "#b8983a");
      p.blob(x + 1, 21, 3, 3, "#e0c070"); p.rect(x - 1, 23, 5, 1, "#8a5a30");
      p.blob(x + 1, 29, 1.8, 1.8, "#c83a3a", { outline: false }); p.px(x + 1, 29, "#f8f0e0");
    }
    p.rect(W / 2 - 1, H - 12, 2, 8, "#c8ccd4"); p.rect(W / 2 - 3, H - 5, 6, 1, DARK);
  },
  lamp: (p) => {
    shadow(p, 8, 30, 3, 1.5);
    p.rect(5, 28, 6, 2, IRON); p.rect(5, 28, 6, 1, hs(IRON, 0.3));
    post(p, 7, 12, 28, IRON, 2);
    glow(p, 8, 9, 9);
    p.rect(4, 5, 8, 1, IRON); p.rect(5, 6, 6, 6, IRON); p.rect(6, 6, 4, 5, "#ffe07a"); p.rect(6, 6, 2, 2, "#fff6c8");
    p.rect(4, 12, 8, 1, IRON); p.px(7, 3, IRON); p.px(8, 4, IRON);
  },
  flowers: (p) => {
    p.g.fillStyle = "rgba(24,12,40,.2)"; p.g.fillRect(1, 30, 15, 1);
    wallTex(p, 0, 25, 16, 5, "#9a9aa0", "stone", 3);
    p.rect(1, 21, 14, 5, "#5a3a22"); p.rect(1, 21, 14, 1, "#7a5232");
    const cols = ["#e84a6a", "#f7d44c", "#ffffff", "#b88aff", "#f28a3a", "#6ab8ff"];
    for (let i = 0; i < 7; i++) { const x = 2 + i * 2, y = 18 + (i % 2) * 2; p.rect(x, y + 1, 1, 4, "#4f9a35"); flower(p, x, y, cols[i % cols.length]); }
  },
  tree: (p) => fruitTree(p, 8, 30, 7, LEAF, "#e8303a", 11),
  fountain: (p, W, H) => {
    pond(p, W / 2, H - 12, W / 2 - 3, 8, 7, "#4a9ad8");
    // a two-tier basin on a column, water falling in sheets
    p.column(W / 2 - 2, 16, 5, H - 28, "#c8c8d0");
    ell(p, W / 2, 18, 7, 2.5, "#b0b0b8"); ell(p, W / 2, 17.5, 5.5, 1.6, "#5aaae8");
    ell(p, W / 2, 11, 4, 1.6, "#c0c0c8"); p.rect(W / 2 - 1, 6, 2, 5, "#d0d0d8"); p.px(W / 2, 5, "#e8f4ff");
    p.g.fillStyle = "rgba(170,225,255,.8)";
    for (const dx of [-5, -3, 3, 5]) p.g.fillRect(W / 2 + dx, 19, 1, 6 + Math.abs(dx) % 3);
    for (const dx of [-3, 3]) p.g.fillRect(W / 2 + dx, 12, 1, 4);
    for (let i = 0; i < 5; i++) p.px(W / 2 - 4 + i * 2, H - 18 + (i % 2), "#e8f8ff");
  },
  statue: (p) => {
    shadow(p, 8, 30, 6, 2);
    plinth(p, 3, 25, 10, 5);
    const m = "#c8c8c0";
    p.column(6, 14, 5, 11, m); p.rect(5, 18, 7, 2, hs(m, -0.1));
    p.blob(8, 11, 3, 3, hs(m, 0.1)); p.px(7, 10, hs(m, -0.3));
    p.line(11, 15, 14, 5, hs(m, 0.15), 2); p.rect(12, 4, 3, 1, hs(m, 0.25));
    p.rect(4, 15, 2, 6, hs(m, -0.05));
  },
  park: (p, W, H) => {
    p.rect(1, 17, W - 2, H - 19, GRASS); p.rect(1, 17, W - 2, 1, hs(GRASS, 0.2)); p.rect(1, H - 3, W - 2, 1, hs(GRASS, -0.3));
    grassTufts(p, 2, 19, W - 4, H - 22, 3, 26);
    // crossing gravel paths with a little round plaza
    for (const [x, y, w, h] of [[W / 2 - 3, 17, 6, H - 19], [1, H - 24, W - 2, 6]]) { p.rect(x, y, w, h, "#d8c8a0"); for (let i = 0; i < (w * h) / 8; i++) p.px(x + Math.floor(cell(i, x) * w), y + Math.floor(cell(i, y) * h), "#c0b088"); }
    ell(p, W / 2, H - 21, 7, 4, "#d8c8a0");
    for (const [x, base, s] of [[9, 30, 1], [W - 9, 30, 2], [9, H - 5, 3], [W - 9, H - 5, 4]] as const) fruitTree(p, x, base, 5, LEAF, null, s);
    p.rect(W / 2 + 6, H - 30, 9, 2, WOOD); p.rect(W / 2 + 6, H - 30, 9, 1, hs(WOOD, 0.3)); post(p, W / 2 + 7, H - 28, H - 25, DARK, 1); post(p, W / 2 + 13, H - 28, H - 25, DARK, 1);
    for (let i = 0; i < 6; i++) flower(p, 4 + i * 3, H - 14 + (i % 2), ["#e84a6a", "#f7d44c", "#b88aff"][i % 3]);
  },
  arch: (p, W, H) => {
    shadow(p, W / 2, H - 2, W / 2 - 2, 1.5);
    for (const x of [2, W - 5]) post(p, x, 10, H - 2, "#f0ece0", 3);
    p.g.strokeStyle = "#e8e4d8"; p.g.lineWidth = 2; p.g.beginPath(); p.g.arc(W / 2, 12, W / 2 - 4, Math.PI, 0); p.g.stroke();
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI, x = W / 2 + Math.cos(a) * (W / 2 - 4), y = 12 + Math.sin(a) * (W / 2 - 4);
      p.blob(x, y, 2, 1.8, i % 2 ? "#3f8a3a" : "#4f9a45", { outline: false });
      if (i % 2 === 0) flower(p, Math.round(x), Math.round(y), ["#f78fb3", "#ffffff", "#f7d44c"][i % 3]);
    }
    for (const x of [3, W - 4]) for (let y = 14; y < H - 4; y += 4) p.px(x, y, "#4f9a35");
  },
  wall: (p, W, H) => {
    p.g.fillStyle = "rgba(24,12,40,.22)"; p.g.fillRect(0, H - 2, W, 2);
    wallTex(p, 0, 12, 16, H - 14, "#9a9aa0", "stone", 2);
    for (const x of [0, 6, 12]) { const w = x === 12 ? 4 : 4; p.rect(x, 7, w, 5, "#a8a8b0"); p.rect(x, 7, w, 1, "#d0d0d8"); p.rect(x + w - 1, 8, 1, 4, outline("#a8a8b0")); }
    p.rect(0, 12, 16, 1, outline("#9a9aa0"));
  },

  // ---------------------------------------------------------- small decorations
  bench: (p) => {
    shadow(p, 8, 29, 7, 1.5);
    const w = "#b07a48";
    for (const x of [2, 12]) post(p, x, 24, 30, DARK, 2);
    p.rect(1, 17, 14, 2, w); p.rect(1, 17, 14, 1, hs(w, 0.3)); p.rect(1, 19, 14, 1, outline(w));
    p.rect(1, 22, 14, 3, w); p.rect(1, 22, 14, 1, hs(w, 0.3)); p.rect(5, 22, 1, 3, hs(w, -0.2)); p.rect(10, 22, 1, 3, hs(w, -0.2)); p.rect(1, 25, 14, 1, outline(w));
    for (const x of [2, 12]) p.rect(x, 18, 2, 4, DARK);
  },
  stone_bench: (p) => {
    shadow(p, 8, 29, 7, 1.5);
    for (const x of [2, 11]) wallTex(p, x, 25, 3, 5, "#9a9aa0", "stone", x);
    p.rect(1, 21, 14, 4, "#b8b8c0"); p.rect(1, 21, 14, 1, "#dcdce4"); p.rect(1, 24, 14, 1, outline("#b8b8c0"));
    p.px(4, 23, "#6fae4a"); p.px(5, 23, "#8ad06a"); p.px(12, 22, "#a8a8b0");
  },
  paper_lantern: (p) => {
    shadow(p, 8, 30, 3, 1.5);
    post(p, 7, 8, 30, DARK, 2); p.rect(2, 7, 12, 1, DARK); p.rect(2, 7, 12, 1, hs(DARK, 0.2));
    for (const x of [4, 12]) {
      glow(p, x, 12, 7, "255,120,90");
      p.px(x, 8, "#2a1a1a");
      p.blob(x, 12, 2.6, 3.4, "#e83a3a", { outline: false, hi: 0.35 });
      for (const y of [10, 12, 14]) p.rect(x - 2, y, 5, 1, "#c82a2a");
      p.rect(x - 1, 9, 3, 1, "#2a1a1a"); p.rect(x - 1, 15, 3, 1, "#2a1a1a"); p.px(x, 16, "#f2c542");
    }
  },
  street_lamp: (p) => {
    shadow(p, 8, 30, 3, 1.5);
    p.rect(5, 27, 6, 3, IRON); p.rect(5, 27, 6, 1, hs(IRON, 0.35));
    post(p, 7, 6, 27, IRON, 2);
    p.line(8, 6, 12, 4, IRON); p.line(8, 8, 11, 6, IRON);
    glow(p, 12, 8, 9);
    p.rect(10, 4, 5, 1, IRON); p.rect(10, 5, 5, 5, IRON); p.rect(11, 5, 3, 4, "#ffe07a"); p.px(11, 5, "#fff6c8"); p.rect(10, 10, 5, 1, IRON);
  },
  torch: (p) => {
    shadow(p, 8, 30, 2, 1);
    post(p, 7, 13, 30, DARK, 2);
    p.rect(6, 11, 4, 3, "#5a3a1e"); p.rect(6, 12, 4, 1, "#8a8f96");
    flame(p, 8, 7, 1);
  },
  brazier: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    for (const [x0, x1] of [[4, 2], [11, 13], [7, 7]]) p.line(x0, 22, x1, 30, IRON);
    p.rect(2, 18, 12, 5, "#8a5a2a"); p.rect(2, 18, 12, 1, "#c88a4a"); p.rect(2, 22, 12, 1, outline("#8a5a2a"));
    p.rect(3, 19, 10, 1, "#3a2a2a"); for (const x of [4, 7, 10]) p.px(x, 19, "#ff8a3a");
    flame(p, 8, 13, 1.2);
  },
  flower_pot: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    const c = "#c8683a";
    for (let y = 22; y < 30; y++) { const w = 4 - (y - 22) * 0.12; p.rect(8 - w, y, w * 2, 1, c); p.px(8 - w, y, hs(c, 0.3)); p.px(8 + w - 1, y, hs(c, -0.3)); }
    p.rect(3, 21, 10, 2, hs(c, 0.1)); p.rect(3, 21, 10, 1, hs(c, 0.35)); p.rect(4, 22, 8, 1, "#4a3020");
    canopy(p, 8, 16, 5, 5, LEAF, 4);
    flower(p, 6, 14, "#e84a6a"); flower(p, 10, 17, "#f7d44c");
  },
  sunflowers: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    for (const [x, top] of [[4, 13], [9, 8], [13, 15]] as const) {
      p.rect(x, top + 3, 1, 30 - top - 3, "#4f9a35"); p.blob(x + 2, top + 10, 1.8, 1, "#5aaa4a", { outline: false }); p.blob(x - 1, top + 14, 1.8, 1, "#4a9a40", { outline: false });
      for (let a = 0; a < 8; a++) p.px(x + Math.round(Math.cos(a * 0.785) * 3), top + Math.round(Math.sin(a * 0.785) * 3), a % 2 ? "#f2c230" : "#ffd84a");
      p.blob(x, top, 2, 2, "#f2b020", { outline: false }); p.blob(x, top, 1.3, 1.3, "#6a3a1a", { outline: false }); p.px(x - 1, top - 1, "#8a5a2a");
    }
  },
  rose_bush: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    canopy(p, 8, 23, 7, 6, "#2f7a2a", 6);
    for (const [x, y] of [[4, 21], [9, 19], [12, 23], [7, 25], [11, 27], [3, 26]]) { p.rect(x, y, 2, 2, "#d8203a"); p.px(x, y, "#ff7a8a"); p.px(x + 1, y + 1, "#9a1028"); }
  },
  hedge: (p) => {
    shadow(p, 8, 30, 8, 1.5);
    for (let x = 0; x < 16; x += 4) canopy(p, x + 2, 21, 4, 4, "#3a7a32", x);
    p.rect(0, 22, 16, 7, "#3a7a32");
    for (let i = 0; i < 16; i++) p.px(Math.floor(cell(i, 7) * 16), 22 + Math.floor(cell(i, 8) * 7), cell(i, 9) > 0.5 ? "#4a9040" : "#2a5a28");
    p.rect(0, 29, 16, 1, outline("#3a7a32"));
  },
  fence_wood: (p) => fence(p, WOOD),
  fence_white: (p) => fence(p, "#ece8dc", true),
  fence_stone: (p) => {
    p.g.fillStyle = "rgba(24,12,40,.22)"; p.g.fillRect(0, 30, 16, 1);
    wallTex(p, 0, 20, 16, 10, STONE, "stone", 5);
    p.rect(0, 18, 16, 2, hs(STONE, 0.12)); p.rect(0, 18, 16, 1, hs(STONE, 0.38)); p.rect(0, 20, 16, 1, outline(STONE));
    p.px(3, 23, "#5a9a3a"); p.px(4, 22, "#7ab84a");
  },
  barrel: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    const c = "#a06a38";
    for (let y = 17; y < 30; y++) { const bulge = Math.round(Math.sin(((y - 17) / 13) * Math.PI) * 1.2); p.rect(3 - bulge, y, 10 + bulge * 2, 1, c); p.px(3 - bulge, y, outline(c)); p.px(4 - bulge, y, hs(c, 0.3)); p.px(11 + bulge, y, hs(c, -0.3)); p.px(12 + bulge, y, outline(c)); }
    for (const x of [6, 9]) p.rect(x, 18, 1, 11, hs(c, -0.18));
    for (const y of [19, 27]) p.rect(2, y, 12, 1, "#4a4652");
    ell(p, 8, 17, 5, 1.6, "#7a4a24"); ell(p, 8, 17, 3.8, 1, "#9a6a3a");
  },
  crates: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    const box = (x: number, y: number, s: number) => {
      const c = "#c89a5a";
      p.rect(x, y, s, s, c); p.rect(x, y, s, 1, hs(c, 0.32)); p.rect(x, y, 1, s, hs(c, 0.15));
      p.rect(x + s - 1, y, 1, s, outline(c)); p.rect(x, y + s - 1, s, 1, outline(c));
      p.line(x + 1, y + 1, x + s - 2, y + s - 2, hs(c, -0.3)); p.rect(x + 1, y + Math.floor(s / 2), s - 2, 1, hs(c, -0.15));
    };
    box(1, 21, 9); box(8, 23, 7); box(3, 13, 8);
  },
  hay_bale: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    const c = "#e0c060";
    p.rect(1, 20, 14, 10, c); p.rect(1, 19, 14, 2, hs(c, 0.25)); p.rect(1, 29, 14, 1, outline(c));
    for (let i = 0; i < 24; i++) p.px(1 + Math.floor(cell(i, 10) * 14), 21 + Math.floor(cell(i, 11) * 8), cell(i, 12) > 0.5 ? "#c8a040" : "#f0d880");
    for (const x of [4, 11]) { p.rect(x, 19, 1, 11, "#8a6a2a"); }
    p.rect(1, 20, 1, 9, hs(c, 0.15)); p.rect(14, 20, 1, 9, hs(c, -0.25));
  },
  scarecrow: (p) => {
    shadow(p, 8, 30, 4, 1.5);
    post(p, 7, 10, 30, DARK, 2); p.rect(1, 14, 14, 2, DARK);
    p.rect(4, 15, 8, 9, "#5a7ab0"); p.rect(4, 15, 8, 1, hs("#5a7ab0", 0.3)); p.rect(6, 18, 2, 2, "#c83a3a"); p.rect(4, 23, 8, 1, outline("#5a7ab0"));
    for (const x of [1, 14]) { p.px(x, 16, "#e0c060"); p.px(x, 17, "#c8a040"); }
    p.blob(8, 10, 3.5, 3.5, "#e8d8a8"); p.px(7, 10, "#2a1a1a"); p.px(9, 10, "#2a1a1a"); p.rect(7, 12, 3, 1, "#8a5a2a");
    p.rect(2, 6, 12, 2, "#b87a3a"); p.rect(2, 6, 12, 1, hs("#b87a3a", 0.3)); p.rect(5, 2, 6, 4, "#b87a3a"); p.rect(5, 5, 6, 1, "#c83a3a");
    p.px(13, 4, "#2a2a30"); p.px(14, 4, "#3a3a44");
  },
  signpost: (p) => {
    shadow(p, 8, 30, 3, 1.5);
    post(p, 7, 7, 30, DARK, 2);
    const board = (x: number, y: number, w: number, dir: 1 | -1, c: string) => {
      p.rect(x, y, w, 4, c); p.rect(x, y, w, 1, hs(c, 0.3)); p.rect(x, y + 3, w, 1, outline(c));
      const tip = dir > 0 ? x + w : x - 1; p.px(tip, y + 1, c); p.px(tip, y + 2, c); p.px(tip + dir, y + 2, c);
      for (let k = 2; k < w - 1; k += 2) p.px(x + k, y + 2, hs(c, -0.45));
    };
    board(2, 8, 11, 1, WOOD); board(4, 15, 10, -1, "#c8945a"); board(3, 21, 9, 1, "#a87a48");
  },
  mailbox: (p) => {
    shadow(p, 8, 30, 3, 1.5);
    post(p, 7, 18, 30, DARK, 2);
    const c = "#3a6ab0";
    p.rect(3, 12, 10, 7, c); p.blob(8, 12, 5, 2.5, c, { outline: false }); p.rect(3, 12, 1, 7, hs(c, 0.3)); p.rect(12, 12, 1, 7, outline(c)); p.rect(3, 18, 10, 1, outline(c));
    p.rect(4, 14, 7, 1, hs(c, -0.35)); p.rect(12, 8, 1, 7, "#c83a3a"); p.rect(12, 8, 3, 2, "#e84a4a");
  },
  bird_bath: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    plinth(p, 5, 27, 6, 2);
    p.column(6, 20, 4, 7, "#b8b8c0");
    ell(p, 8, 19, 7, 3, "#c8c8d0"); ell(p, 8, 19.5, 5.5, 2, "#a8a8b0"); ell(p, 8, 19.6, 4.5, 1.5, "#6ab8f0"); p.px(6, 19, "#d8f4ff");
    p.blob(11, 16, 2.2, 1.6, "#8a6a4a"); p.px(12, 15, "#2a1a1a"); p.px(13, 16, "#f0a030"); p.px(10, 17, "#6a4a30");
  },
  sundial: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    plinth(p, 4, 22, 8, 7, "#b8b8c0");
    ell(p, 8, 20, 7, 3, "#d8d0c0"); ell(p, 8, 20, 6, 2.2, "#e8e0d0");
    for (let a = 0; a < 12; a++) p.px(8 + Math.cos((a / 12) * Math.PI * 2) * 5, 20 + Math.sin((a / 12) * Math.PI * 2) * 1.8, "#7a7a82");
    p.line(8, 20, 11, 15, "#4a4a52"); p.line(8, 20, 12, 21, "rgba(40,30,50,.35)");
  },
  bush: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    canopy(p, 8, 24, 7, 6, LEAF, 8);
    p.px(5, 21, "#a0e080"); p.px(10, 22, "#e84a6a");
  },
  pine: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    trunk(p, 6, 23, 30, "#6a3a1e", 4);
    const c = "#2f6a3a";
    for (let i = 0; i < 4; i++) {
      const top = 3 + i * 5, w = 3 + i * 1.7;
      for (let y = top; y < top + 8; y++) {
        const hw = ((y - top) / 8) * w;
        for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) {
          const edge = y === top + 7 || x === Math.round(8 - hw) || x === Math.round(8 + hw);
          const lit = x < 8 - hw * 0.3;
          p.px(x, y, edge ? outline(c) : lit ? hs(c, 0.25) : x > 8 + hw * 0.4 ? hs(c, -0.2) : c);
        }
      }
    }
    p.px(8, 2, hs(c, 0.4));
  },
  sakura: (p) => {
    shadow(p, 8, 30, 7, 2);
    trunk(p, 6, 17, 30, "#6a3a3a", 4); p.line(9, 19, 13, 15, "#6a3a3a");
    canopy(p, 8, 11, 8, 7.5, "#f0a0c0", 12);
    dots(p, [[4, 12], [11, 8], [9, 15], [13, 11]], "#ffffff");
    for (const [x, y] of [[2, 26], [13, 28], [5, 29]]) p.px(x, y, "#f8c0d8");
  },
  maple: (p) => {
    shadow(p, 8, 30, 7, 2);
    trunk(p, 6, 17, 30, "#6a3a2a", 4);
    canopy(p, 8, 11, 8, 7.5, "#d8402a", 13);
    for (const [x, y] of [[3, 27], [12, 29], [14, 26]]) p.px(x, y, "#f06030");
  },
  palm: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    for (let y = 8; y < 30; y++) { const x = 7 + Math.round(Math.sin(y / 6) * 1.5); p.rect(x, y, 3, 1, y % 3 ? "#a07a4a" : "#7a5a3a"); p.px(x, y, "#c09a6a"); }
    for (const [dx, dy] of [[-7, 4], [7, 4], [-6, -2], [6, -2], [0, -5], [-3, 6], [3, 6]]) {
      p.line(8, 8, 8 + dx, 8 + dy, "#3f9a45", 2); p.line(8, 7, 8 + dx * 0.7, 7 + dy * 0.7, "#6ac060");
    }
    p.blob(7, 10, 1.6, 1.6, "#6a4a2a"); p.blob(10, 10, 1.6, 1.6, "#6a4a2a");
  },
  bamboo: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    for (const [x, top] of [[3, 6], [7, 3], [11, 8], [13, 12]] as const) {
      for (let y = top; y < 30; y++) { const node = (y - top) % 6 === 0; p.rect(x, y, 2, 1, node ? "#4a8a2a" : "#7ac050"); if (!node) p.px(x, y, "#a0e070"); }
      p.line(x + 1, top + 4, x + 5, top + 1, "#5aaa4a"); p.line(x, top + 9, x - 3, top + 7, "#4a9a40");
    }
  },
  giant_mushroom: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    p.column(6, 16, 5, 14, "#f0e8d8");
    p.rect(5, 17, 7, 1, "#d8d0c0");
    glow(p, 8, 12, 11, "120,190,255");
    for (let y = 5; y <= 16; y++) { const hw = Math.sqrt(Math.max(0, 1 - ((16 - y) / 11) ** 2)) * 8; for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) { const l = (8 - x) / 8 - (y - 10) / 8; p.px(x, y, y === 16 ? "#2a6ab0" : l > 0.6 ? "#a8dcff" : l > 0 ? "#5ab0ff" : "#3a8ae0"); } }
    for (const [x, y] of [[4, 12], [9, 8], [12, 13], [6, 9]]) { p.rect(x, y, 2, 2, "#e8f8ff"); p.px(x + 1, y + 1, "#c0e4ff"); }
  },
  crystal_cluster: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    glow(p, 8, 18, 12, "176,138,255");
    p.blob(8, 28, 7, 2.5, "#6a6a78");
    for (const [x, top, hw, c] of [[4, 14, 2, "#8ab8ff"], [8, 7, 3, "#b08aff"], [12, 16, 2, "#8ad8ff"]] as const) {
      for (let y = top; y < 28; y++) { const w = Math.min(hw, y - top); for (let xx = x - w; xx <= x + w; xx++) p.px(xx, y, xx === x - w ? hs(c, 0.45) : xx === x + w ? hs(c, -0.3) : xx === x ? hs(c, 0.15) : c); }
      p.px(x, top, "#ffffff"); p.px(x - 1, top + 3, "#ffffff");
    }
  },
  rock_garden: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    p.rect(1, 25, 14, 5, "#e8e0c8");
    for (let x = 2; x < 15; x += 2) { p.px(x, 26 + (x % 4 ? 0 : 2), "#c8c0a8"); }
    p.blob(6, 23, 4, 3.5, "#8a8a92"); p.blob(12, 25, 3, 2.4, "#9a9aa0"); p.blob(10, 21, 2, 1.6, "#7a7a84");
    p.blob(3, 22, 1.8, 1.2, "#6fae4a", { outline: false }); p.px(3, 21, "#a0e080");
  },
  stone_lantern: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    plinth(p, 4, 27, 8, 3);
    p.column(6, 20, 4, 7, "#a8a8b0");
    p.rect(4, 14, 8, 6, "#b0b0b8"); p.rect(4, 14, 1, 6, "#d0d0d8"); p.rect(11, 14, 1, 6, outline("#b0b0b8"));
    glow(p, 8, 17, 8);
    p.rect(6, 15, 4, 4, "#ffe07a"); p.px(6, 15, "#fff6c8");
    p.rect(2, 12, 12, 2, "#9a9aa0"); p.rect(2, 12, 12, 1, "#c8c8d0"); p.rect(4, 10, 8, 2, "#9a9aa0"); p.rect(7, 8, 2, 2, "#9a9aa0"); p.px(7, 8, "#c8c8d0");
  },
  totem: (p) => {
    shadow(p, 8, 30, 4, 1.5);
    const seg = (y: number, c: string) => {
      p.column(4, y, 8, 7, c);
      p.rect(5, y + 2, 2, 2, "#1a1a1a"); p.rect(9, y + 2, 2, 2, "#1a1a1a"); p.px(5, y + 2, "#f8f0e0"); p.px(9, y + 2, "#f8f0e0");
      p.rect(6, y + 5, 4, 1, "#e0e0d0"); p.rect(4, y + 6, 8, 1, outline(c));
    };
    seg(23, "#8a5a2a"); seg(16, "#3a8a8a"); seg(9, "#c83a3a");
    for (const x of [0, 12]) { p.rect(x, 10, 4, 3, "#e0b030"); p.rect(x, 10, 4, 1, "#f8d860"); }
    p.rect(6, 5, 4, 4, "#e0b030"); p.px(7, 5, "#f8d860");
  },
  banner: (p) => {
    shadow(p, 8, 30, 2, 1);
    post(p, 3, 3, 30, DARK, 2); p.px(3, 2, "#f2c542"); p.px(4, 2, "#f2c542");
    p.rect(3, 4, 11, 1, DARK);
    const c = "#3a6ab0";
    for (let y = 5; y < 17; y++) { const sway = Math.round(Math.sin(y / 3) * 0.6); p.rect(5 + sway, y, 9, 1, y % 4 === 0 ? hs(c, -0.12) : c); p.px(5 + sway, y, hs(c, 0.3)); p.px(13 + sway, y, outline(c)); }
    p.px(5, 17, c); p.px(13, 17, c); p.rect(7, 17, 5, 1, c); p.px(9, 18, c);
    p.blob(9, 10, 2, 2, "#8ad86a", { outline: false }); p.rect(9, 11, 1, 4, "#4f9a35"); p.rect(6, 6, 7, 1, "#f2c542");
  },
  wind_chime: (p) => {
    shadow(p, 8, 30, 3, 1);
    post(p, 3, 5, 30, DARK, 2); p.rect(3, 5, 11, 1, DARK);
    p.rect(5, 7, 9, 2, "#c89a5a"); p.rect(5, 7, 9, 1, "#e8c080");
    for (const [x, l] of [[6, 7], [8, 10], [10, 6], [12, 9]]) { p.rect(x, 9, 1, l - 4, "#c8c8c8"); p.rect(x, 5 + l, 1, 4, "#8ad8f0"); p.px(x, 5 + l, "#d8f8ff"); }
    p.rect(9, 18, 1, 3, "#c8c8c8"); p.rect(8, 21, 3, 2, "#f2c542");
  },
  snowman: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    const snow = "#f4f8ff";
    p.blob(8, 25, 6, 5, snow, { lo: -0.12 }); p.blob(8, 16, 4.2, 4, snow, { lo: -0.12 }); p.blob(8, 9, 3.2, 3, snow, { lo: -0.12 });
    p.px(7, 8, "#1a1a2a"); p.px(9, 8, "#1a1a2a"); p.px(8, 10, "#f07a2a"); p.px(9, 10, "#f07a2a");
    p.rect(5, 12, 7, 2, "#c83a3a"); p.rect(10, 13, 2, 4, "#c83a3a"); p.rect(5, 12, 7, 1, "#e85a5a");
    p.rect(4, 5, 8, 1, "#2a2a34"); p.rect(5, 1, 6, 4, "#2a2a34"); p.rect(5, 4, 6, 1, "#c83a3a");
    p.px(8, 16, "#2a2a34"); p.px(8, 19, "#2a2a34"); p.line(3, 15, 0, 12, "#6a4428"); p.line(13, 15, 15, 12, "#6a4428");
  },
  pumpkins: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    const pk = (x: number, y: number, r: number, face = false) => {
      p.blob(x, y, r, r * 0.8, "#f08a2a", { hi: 0.25 });
      for (const dx of [-r / 2, r / 2]) p.line(x + dx, y - r * 0.6, x + dx, y + r * 0.6, "#c8601a");
      p.rect(x - 1, y - r, 2, 2, "#4f7a2a"); p.px(x + 1, y - r - 1, "#6aa040");
      if (face) { p.px(x - 2, y - 1, "#3a1a0a"); p.px(x + 2, y - 1, "#3a1a0a"); p.rect(x - 2, y + 1, 5, 1, "#3a1a0a"); p.px(x, y + 2, "#3a1a0a"); }
    };
    pk(9, 20, 3); pk(5, 26, 4, true); pk(12, 27, 3);
  },
  cart: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    wallTex(p, 1, 18, 13, 6, WOOD, "plank", 4);
    p.rect(0, 17, 15, 1, hs(WOOD, 0.3)); p.rect(1, 24, 13, 1, outline(WOOD));
    p.line(13, 22, 16, 27, DARK);
    for (const [x, c] of [[3, "#e8303a"], [6, "#f2c230"], [9, "#4f9a35"], [11, "#f08a2a"], [5, "#e8303a"]] as const) p.blob(x, 16, 1.8, 1.5, c, { outline: false });
    for (let a = 0; a < 8; a++) p.line(5, 26, 5 + Math.cos(a * 0.785) * 3, 26 + Math.sin(a * 0.785) * 3, "#8a6a3a");
    p.g.strokeStyle = "#4a3020"; p.g.lineWidth = 1.5; p.g.beginPath(); p.g.arc(5.5, 26.5, 3.4, 0, Math.PI * 2); p.g.stroke();
    p.px(5, 26, "#2a1a10");
  },
  weapon_rack: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    for (const x of [1, 13]) post(p, x, 12, 30, DARK, 2);
    for (const y of [14, 26]) { p.rect(1, y, 14, 2, WOOD); p.rect(1, y, 14, 1, hs(WOOD, 0.3)); }
    p.rect(4, 5, 1, 21, "#c8ccd4"); p.px(4, 4, "#e8f0f8"); p.rect(3, 22, 3, 1, "#8a6a3a"); p.rect(4, 23, 1, 3, "#5a3a20");
    p.rect(8, 3, 1, 23, "#8a5a2a"); p.rect(7, 2, 3, 3, "#c8ccd4"); p.px(7, 2, "#e8f0f8");
    p.blob(12, 20, 2.5, 3.5, "#c83a3a"); p.blob(12, 20, 1.2, 2, "#e85a4a", { outline: false }); p.px(12, 20, "#f2c542");
  },
  cat_house: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    wallTex(p, 2, 19, 12, 11, "#e8a0b0", "plank", 3);
    roofSlab(p, 0, 15, 13, 19, "#b84a6a", "shingle", 3);
    ell(p, 8, 25, 3, 3, "#2a1a20"); p.rect(5, 25, 7, 5, "#2a1a20");
    p.px(7, 26, "#f2c542"); p.px(9, 26, "#f2c542");
    p.rect(1, 29, 14, 1, outline("#e8a0b0"));
  },
  dog_house: (p) => {
    shadow(p, 8, 30, 7, 1.5);
    wallTex(p, 2, 19, 12, 11, WOOD, "siding", 4);
    roofSlab(p, 0, 15, 13, 19, "#c83a3a", "shingle", 4);
    p.rect(5, 23, 6, 7, "#2a1a14"); p.px(5, 23, WOOD); p.px(10, 23, WOOD);
    p.rect(6, 20, 4, 2, "#f0e0c0"); p.px(7, 21, "#6a4428"); p.px(8, 21, "#6a4428");
    p.blob(13, 28, 2.2, 1.6, "#d8a060"); p.px(14, 27, "#2a1a1a"); p.px(12, 29, "#c89050");
  },
  campfire_ring: (p) => {
    shadow(p, 8, 29, 7, 2);
    for (let a = 0; a < 9; a++) p.blob(8 + Math.cos((a / 9) * Math.PI * 2) * 6, 26 + Math.sin((a / 9) * Math.PI * 2) * 3, 1.7, 1.3, a % 2 ? "#8a8f98" : "#a0a4ac");
    p.line(4, 27, 12, 24, "#7a4a2a", 2); p.line(4, 24, 12, 27, "#8a5a32", 2);
    p.rect(6, 25, 5, 1, "#ff8a3a");
    flame(p, 8, 21, 1.1);
  },
  angel_statue: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    plinth(p, 3, 26, 10, 4);
    const m = "#dcdcd4";
    for (const s of [-1, 1]) { p.blob(8 + s * 5, 14, 3, 5.5, hs(m, 0.08)); for (let y = 11; y < 19; y += 2) p.px(8 + s * 5, y, hs(m, -0.15)); }
    p.column(6, 13, 4, 13, m); p.rect(5, 20, 6, 6, hs(m, -0.05));
    p.blob(8, 10, 2.5, 2.5, hs(m, 0.1));
    p.g.strokeStyle = "#f2d860"; p.g.lineWidth = 1; p.g.beginPath(); p.g.ellipse(8, 6, 3, 1, 0, 0, Math.PI * 2); p.g.stroke();
  },
  sprout_statue: (p) => {
    shadow(p, 8, 30, 6, 1.5);
    plinth(p, 3, 26, 10, 4);
    p.blob(8, 20, 5, 5, "#e8e4d8"); p.px(6, 19, "#5a5a62"); p.px(10, 19, "#5a5a62"); p.rect(7, 22, 3, 1, "#a8a8a0");
    p.rect(8, 9, 1, 7, "#c8c8c0"); p.blob(5, 10, 3.2, 1.7, "#d8d8d0"); p.blob(11, 9, 3.2, 1.7, "#d8d8d0");
    p.px(4, 10, "#8ad86a"); p.px(12, 9, "#8ad86a"); p.px(9, 26, "#6fae4a");
  },
  obelisk: (p) => {
    shadow(p, 8, 30, 5, 1.5);
    plinth(p, 3, 27, 10, 3, "#7a7a82");
    for (let y = 5; y < 27; y++) { const w = y < 8 ? y - 4 : 4 - (y - 8) / 12; const x0 = Math.round(8 - w), x1 = Math.round(8 + w); p.rect(x0, y, x1 - x0, 1, "#8a8a98"); p.px(x0, y, "#b0b0c0"); p.px(x1 - 1, y, "#5a5a68"); }
    for (const y of [11, 15, 19, 23]) { p.rect(7, y, 2, 1, "#8ad8ff"); p.px(7, y, "#e0f8ff"); }
    glow(p, 8, 17, 6, "140,210,255");
  },
  stone_path: (p) => {
    for (const [x, y, w, h] of [[1, 17, 6, 5], [8, 16, 7, 6], [2, 23, 7, 7], [10, 23, 5, 6]]) {
      p.rect(x, y + 1, w, h, "#7a7468");
      p.rect(x, y, w, h, "#b8b0a0"); p.rect(x, y, w, 1, "#d8d0c0"); p.rect(x, y, 1, h, "#c8c0b0"); p.rect(x, y + h - 1, w, 1, "#8a8478"); p.rect(x + w - 1, y, 1, h, "#9a9488");
      p.px(x + 2, y + 2, "#a8a090");
    }
    p.px(8, 22, "#6ab84a"); p.px(7, 15, "#6ab84a");
  },
  flower_carpet: (p) => {
    const cols = ["#e84a6a", "#f7d44c", "#ffffff", "#b88aff", "#f28a3a", "#6ab8ff"];
    grassTufts(p, 1, 18, 14, 12, 9, 26);
    for (let i = 0; i < 9; i++) flower(p, 2 + Math.floor(cell(i, 13) * 12), 19 + Math.floor(cell(i, 14) * 10), cols[i % cols.length]);
  },
  picnic_rug: (p, W, H) => {
    p.g.fillStyle = "rgba(24,12,40,.15)"; p.g.fillRect(3, H - 2, W - 4, 1);
    for (let y = 18; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const a = (x >> 2) % 2, b = (y >> 2) % 2;
      p.px(x, y, a && b ? "#c83a3a" : a || b ? "#e86a6a" : "#f8f0e8");
    }
    p.rect(2, H - 3, W - 4, 1, "#a82a2a");
    // basket with a lid, a pie and a bottle
    wallTex(p, 7, 22, 9, 6, "#c89a5a", "plank", 2); p.rect(7, 21, 9, 1, "#e0b878");
    p.g.strokeStyle = "#8a6a3a"; p.g.lineWidth = 1; p.g.beginPath(); p.g.arc(11.5, 21, 3.5, Math.PI, 0); p.g.stroke();
    ell(p, 22, 31, 4, 2.5, "#f0d8a0"); ell(p, 22, 30.5, 3, 1.6, "#c84a3a"); p.rect(21, 29, 3, 1, "#f8e8c0");
    p.rect(20, 37, 3, 5, "#a8d8b8"); p.rect(20, 37, 1, 5, "#d8f8e8"); p.rect(21, 35, 1, 2, "#6a4428");
  },
  lily_pond: (p, W, H) => {
    pond(p, W / 2, H - 15, W / 2 - 3, 11, 5, "#3a8ac8");
    for (const [x, y] of [[9, H - 21], [20, H - 12], [22, H - 22]]) { ell(p, x, y, 3.6, 2.2, "#4f9a35"); p.px(x + 1, y - 1, "#7ac050"); p.line(x, y, x + 3, y, "#2f6a2a"); }
    p.blob(10, H - 22, 1.6, 1.4, "#f8b0d0", { outline: false }); p.px(10, H - 22, "#fff3a0");
    p.blob(21, H - 23, 1.4, 1.2, "#ffffff", { outline: false });
    p.rect(14, H - 15, 3, 1, "#f08a2a"); p.px(17, H - 15, "#f8b060");
  },
  gazebo: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 2, 3);
    // round wooden floor on a stone base
    ell(p, W / 2, H - 7, W / 2 - 2, 4, "#9a9aa0"); ell(p, W / 2, H - 8, W / 2 - 2, 4, "#c8a878"); ell(p, W / 2, H - 8.5, W / 2 - 3, 3, "#d8b888");
    for (const x of [3, 10, 21, 28]) post(p, x, 20, H - 8, "#f0ece0", 2);
    p.rect(3, H - 15, W - 6, 1, "#f0ece0"); for (let x = 4; x < W - 4; x += 3) p.rect(x, H - 14, 1, 4, "#e0dcd0");
    // octagonal roof
    for (let i = 0; i < 13; i++) {
      const w = 3 + i * 2.2, y = 7 + i, x0 = Math.round(W / 2 - w / 2), x1 = Math.round(W / 2 + w / 2);
      for (let x = x0; x <= x1; x++) p.px(x, y, x === x0 || x === x1 ? outline("#3a6a8a") : (x - x0) % 4 === 0 ? "#2a5a7a" : x < W / 2 ? "#5a8aaa" : "#3a6a8a");
    }
    p.rect(1, 20, W - 2, 1, outline("#3a6a8a")); p.g.fillStyle = "rgba(24,12,40,.25)"; p.g.fillRect(3, 21, W - 6, 2);
    p.rect(W / 2 - 1, 3, 2, 4, "#f2c542"); p.px(W / 2, 2, "#fff4b0");
  },
  wood_bridge: (p, W, H) => {
    for (let y = H - 9; y < H - 1; y++) for (let x = 0; x < W; x++) p.px(x, y, (x * 5 + y * 3) % 19 === 0 ? "#a8dcff" : "#3a8ac8");
    for (let x = 1; x < W - 1; x++) {
      const y = 20 - Math.round(Math.sin(((x - 1) / (W - 3)) * Math.PI) * 5);
      p.rect(x, y, 1, 5, x % 3 ? WOOD : hs(WOOD, -0.18)); p.px(x, y, hs(WOOD, 0.35)); p.px(x, y + 5, outline(WOOD));
      p.px(x, y - 4, "#c8945a");
      p.g.fillStyle = "rgba(24,12,40,.25)"; p.g.fillRect(x, y + 6, 1, 2);
    }
    for (const x of [2, 10, 21, 29]) { const y = 20 - Math.round(Math.sin(((x - 1) / (W - 3)) * Math.PI) * 5); post(p, x, y - 5, y, DARK, 2); }
  },
  torii: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 3, 2);
    const red = "#d8302a";
    for (const x of [6, W - 9]) { post(p, x, 8, H - 3, red, 3); p.rect(x - 1, H - 5, 5, 2, "#2a1a1a"); }
    p.rect(0, 5, W, 1, "#2a1a1a"); p.rect(1, 6, W - 2, 3, red); p.rect(1, 6, W - 2, 1, hs(red, 0.3)); p.px(0, 5, "#2a1a1a"); p.px(W - 1, 4, "#2a1a1a"); p.px(0, 4, "#2a1a1a");
    p.rect(3, 12, W - 6, 2, red); p.rect(3, 12, W - 6, 1, hs(red, 0.3));
    p.rect(W / 2 - 2, 9, 4, 3, "#2a1a1a"); p.px(W / 2, 10, "#f2c542");
  },
  dragon_statue: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 2, 3);
    plinth(p, 3, H - 8, W - 6, 6);
    const body = "#5a9a7a";
    for (let i = 0; i <= 24; i++) {
      const a = i / 24;
      const x = 6 + a * 18 + Math.sin(a * Math.PI * 2) * 3;
      const y = H - 11 - a * 24 + Math.cos(a * Math.PI * 2) * 3;
      p.blob(x, y, 3.4 - a * 1.2, 3.4 - a * 1.2, i % 4 ? body : hs(body, -0.15), { outline: i % 3 === 0 });
      if (i % 4 === 2) p.px(x, y - 3 + a, "#e0c060");
    }
    p.blob(26, 12, 4.5, 3.5, body); p.blob(29, 14, 3, 2, hs(body, 0.1));
    p.px(26, 11, "#f2c542"); p.px(31, 14, "#2a3a2a");
    p.line(24, 9, 21, 4, "#e0c060"); p.line(27, 9, 28, 4, "#e0c060");
    p.line(30, 16, 32, 19, "#e0e0d0");
  },
};
