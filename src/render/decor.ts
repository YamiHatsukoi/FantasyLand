import { hs, outline, type Paint } from "./palette";

/**
 * Decorations for the sanctuary, in the same cozy-farm pixel style as the buildings.
 * A 1x1 decoration is drawn on a 16x32 canvas (bottom 16px = its tile, top 16px headroom),
 * 2x1 on 32x32 and 2x2 on 32x48. Ground contact sits around y = H - 2.
 */
type Drawer = (p: Paint, W: number, H: number, level: number) => void;

const WOOD = "#b07a48", DARK = "#7a4a2a", STONE = "#9a9aa0", LEAF = "#3f8a3a", LEAF2 = "#5aaa4a";

function shadow(p: Paint, cx: number, cy: number, rx: number, ry = 2) {
  p.g.fillStyle = "rgba(20,10,40,.26)";
  p.g.beginPath();
  p.g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  p.g.fill();
}
function ell(p: Paint, cx: number, cy: number, rx: number, ry: number, col: string) {
  p.g.fillStyle = col;
  p.g.beginPath();
  p.g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  p.g.fill();
}
function glow(p: Paint, x: number, y: number, r: number, col = "rgba(255,210,110,.22)") {
  p.g.fillStyle = col;
  p.g.beginPath();
  p.g.arc(x, y, r, 0, Math.PI * 2);
  p.g.fill();
}
function post(p: Paint, x: number, top: number, bottom: number, col = WOOD, w = 2) {
  p.rect(x, top, w, bottom - top, col);
  p.rect(x, top, 1, bottom - top, hs(col, 0.25));
  p.rect(x + w - 1, top, 1, bottom - top, hs(col, -0.25));
}
function flower(p: Paint, x: number, y: number, col: string) {
  p.px(x - 1, y, col); p.px(x + 1, y, col); p.px(x, y - 1, col); p.px(x, y + 1, col); p.px(x, y, "#fff3a0");
}
function tree(p: Paint, trunk: string, crowns: [number, number, number, number, string][], fruit?: [string, [number, number][]]) {
  shadow(p, 8, 30, 7);
  p.column(6, 18, 4, 13, trunk);
  for (const [x, y, rx, ry, c] of crowns) p.blob(x, y, rx, ry, c);
  if (fruit) for (const [x, y] of fruit[1]) { p.px(x, y, fruit[0]); p.px(x + 1, y, hs(fruit[0], 0.35)); }
}
function fenceBase(p: Paint, col: string, pointed = false) {
  for (const x of [1, 13]) { post(p, x, 18, 30, col); if (pointed) p.px(x, 17, col); }
  for (const y of [21, 26]) { p.rect(0, y, 16, 2, col); p.rect(0, y, 16, 1, hs(col, 0.25)); p.rect(0, y + 2, 16, 1, outline(col)); }
}

export const DECOR_DRAW: Record<string, Drawer> = {
  bench: (p) => {
    shadow(p, 8, 29, 7);
    p.rect(1, 20, 14, 2, WOOD); p.rect(1, 20, 14, 1, hs(WOOD, 0.3)); p.rect(1, 23, 14, 3, WOOD); p.rect(1, 23, 14, 1, hs(WOOD, 0.3)); p.rect(1, 26, 14, 1, outline(WOOD));
    for (const x of [2, 12]) p.rect(x, 26, 2, 4, DARK);
  },
  stone_bench: (p) => {
    shadow(p, 8, 29, 7);
    p.rect(1, 22, 14, 4, "#b8b8c0"); p.rect(1, 22, 14, 1, "#d8d8e0"); p.rect(1, 26, 14, 1, outline("#b8b8c0"));
    for (const x of [2, 11]) p.rect(x, 26, 3, 4, "#8a8a92");
    p.px(4, 24, "#6fae4a"); p.px(5, 24, "#6fae4a");
  },
  paper_lantern: (p) => {
    shadow(p, 8, 30, 3);
    post(p, 7, 8, 30, DARK); p.rect(3, 7, 10, 1, DARK);
    p.blob(4, 12, 2.5, 3.5, "#e83a3a", { outline: false }); p.blob(12, 12, 2.5, 3.5, "#e83a3a", { outline: false });
    for (const x of [4, 12]) { p.px(x, 9, "#2a1a1a"); p.px(x, 15, "#f2c542"); p.px(x - 1, 11, "#ff8a6a"); }
    glow(p, 8, 12, 8);
  },
  street_lamp: (p) => {
    shadow(p, 8, 30, 3);
    post(p, 7, 6, 30, "#3a3a48"); p.rect(5, 28, 6, 2, "#3a3a48");
    p.line(8, 6, 12, 3, "#3a3a48"); p.rect(10, 3, 5, 5, "#3a3a48"); p.rect(11, 4, 3, 3, "#ffe07a"); p.rect(10, 2, 5, 1, "#2a2a36");
    glow(p, 12, 6, 7);
  },
  torch: (p) => {
    shadow(p, 8, 30, 2);
    post(p, 7, 12, 30, DARK); p.rect(6, 11, 4, 3, "#5a3a1e");
    p.blob(8, 7, 2.5, 4, "#ff7a2a", { outline: false }); p.blob(8, 8, 1.5, 2.5, "#ffd05a", { outline: false }); p.px(8, 3, "#ff9a4a");
    glow(p, 8, 8, 8, "rgba(255,150,60,.22)");
  },
  brazier: (p) => {
    shadow(p, 8, 30, 5);
    for (const x of [4, 11]) p.line(x, 22, x + (x < 8 ? -1 : 1), 30, "#5a4a3a");
    p.rect(3, 18, 10, 5, "#b87a3a"); p.rect(3, 18, 10, 1, hs("#b87a3a", 0.35)); p.rect(2, 17, 12, 1, "#8a5a2a");
    p.blob(8, 14, 4, 4, "#ff6a2a", { outline: false }); p.blob(8, 15, 2.5, 2.5, "#ffc040", { outline: false });
    glow(p, 8, 14, 9, "rgba(255,140,60,.22)");
  },
  flower_pot: (p) => {
    shadow(p, 8, 30, 5);
    p.rect(4, 22, 8, 8, "#c8683a"); p.rect(3, 21, 10, 2, "#d8784a"); p.rect(4, 22, 1, 8, hs("#c8683a", 0.3)); p.rect(11, 22, 1, 8, hs("#c8683a", -0.3));
    p.blob(8, 16, 5, 5, LEAF); p.blob(6, 14, 2.5, 2.5, LEAF2, { outline: false }); p.blob(10, 17, 2, 2, "#2f7a2a", { outline: false });
  },
  sunflowers: (p) => {
    shadow(p, 8, 30, 6);
    for (const [x, top] of [[4, 12], [9, 8], [13, 14]] as const) {
      p.rect(x, top + 3, 1, 30 - top - 3, "#4f9a35"); p.rect(x + 1, top + 9, 2, 1, LEAF2);
      p.blob(x, top, 3, 3, "#f2c230", { outline: false }); p.blob(x, top, 1.4, 1.4, "#7a4a1a", { outline: false });
    }
  },
  rose_bush: (p) => {
    shadow(p, 8, 30, 7);
    p.blob(8, 23, 7, 6, "#2f7a2a"); p.blob(6, 21, 3, 3, "#3f8a3a", { outline: false });
    for (const [x, y] of [[4, 21], [9, 19], [12, 23], [7, 25], [11, 27], [3, 26]]) { p.rect(x, y, 2, 2, "#d8203a"); p.px(x, y, "#ff6a7a"); }
  },
  hedge: (p) => {
    shadow(p, 8, 30, 8);
    p.rect(0, 17, 16, 13, "#3a7a32"); p.rect(0, 17, 16, 2, "#5aaa4a"); p.rect(0, 29, 16, 1, outline("#3a7a32"));
    for (let i = 0; i < 12; i++) p.px((i * 7) % 16, 20 + ((i * 5) % 9), i % 2 ? "#4a9040" : "#2f6a2a");
  },
  fence_wood: (p) => fenceBase(p, WOOD),
  fence_white: (p) => fenceBase(p, "#f0ece0", true),
  fence_stone: (p) => {
    p.rect(0, 20, 16, 10, STONE);
    for (let y = 20; y < 30; y += 4) for (let x = (y / 4) % 2 ? 0 : 3; x < 16; x += 6) { p.rect(x, y, 5, 3, hs(STONE, 0.08)); p.px(x, y, hs(STONE, 0.35)); p.rect(x, y + 3, 6, 1, hs(STONE, -0.3)); }
    p.rect(0, 19, 16, 1, hs(STONE, 0.3));
  },
  barrel: (p) => {
    shadow(p, 8, 30, 5);
    p.column(3, 17, 10, 13, WOOD); for (const y of [19, 27]) p.rect(3, y, 10, 1, "#5a5a62");
    ell(p, 8, 17, 5, 1.6, "#8a5a2a"); ell(p, 8, 17, 3.5, 1, "#3a6ab0");
  },
  crates: (p) => {
    shadow(p, 8, 30, 7);
    const box = (x: number, y: number, s: number) => { p.rect(x, y, s, s, "#c89a5a"); p.rect(x, y, s, 1, hs("#c89a5a", 0.3)); p.line(x, y, x + s - 1, y + s - 1, "#8a6a3a"); p.rect(x, y + s - 1, s, 1, outline("#c89a5a")); p.rect(x, y, 1, s, hs("#c89a5a", 0.15)); };
    box(1, 21, 9); box(8, 23, 7); box(3, 13, 8);
  },
  hay_bale: (p) => {
    shadow(p, 8, 30, 7);
    p.rect(1, 20, 14, 10, "#e0c060"); p.rect(1, 20, 14, 2, "#f0d880");
    for (let i = 0; i < 14; i++) p.px(1 + ((i * 5) % 14), 22 + ((i * 3) % 7), "#c8a040");
    for (const x of [4, 11]) p.rect(x, 20, 1, 10, "#a07a2a");
  },
  scarecrow: (p) => {
    shadow(p, 8, 30, 4);
    post(p, 7, 10, 30, DARK); p.rect(2, 14, 12, 2, DARK);
    p.rect(4, 15, 8, 8, "#5a7ab0"); p.rect(4, 15, 8, 1, hs("#5a7ab0", 0.3)); for (const x of [2, 13]) p.rect(x, 14, 1, 3, "#e0c060");
    p.blob(8, 10, 3.5, 3.5, "#e8d8a8"); p.px(7, 10, "#2a1a1a"); p.px(9, 10, "#2a1a1a"); p.rect(7, 12, 3, 1, "#8a5a2a");
    p.rect(3, 6, 10, 2, "#b87a3a"); p.rect(5, 3, 6, 3, "#b87a3a"); p.rect(5, 5, 6, 1, "#c83a3a");
  },
  signpost: (p) => {
    shadow(p, 8, 30, 3);
    post(p, 7, 8, 30, DARK);
    p.rect(2, 9, 11, 4, WOOD); p.px(13, 10, WOOD); p.px(13, 11, WOOD); p.px(14, 11, WOOD); p.rect(2, 9, 11, 1, hs(WOOD, 0.3));
    p.rect(4, 15, 10, 4, "#c8945a"); p.px(3, 16, "#c8945a"); p.px(2, 17, "#c8945a"); p.rect(4, 15, 10, 1, hs("#c8945a", 0.3));
    for (const [x, y] of [[4, 11], [7, 11], [9, 11], [6, 17], [9, 17], [11, 17]]) p.px(x, y, "#5a3a1e");
  },
  mailbox: (p) => {
    shadow(p, 8, 30, 3);
    post(p, 7, 18, 30, DARK);
    p.rect(3, 12, 10, 7, "#3a6ab0"); p.blob(8, 12, 5, 2.5, "#3a6ab0", { outline: false }); p.rect(3, 12, 1, 7, hs("#3a6ab0", 0.3));
    p.rect(12, 9, 1, 6, "#c83a3a"); p.rect(12, 9, 3, 2, "#c83a3a"); p.rect(5, 15, 5, 1, "#1a2a4a");
  },
  bird_bath: (p) => {
    shadow(p, 8, 30, 5);
    p.column(6, 20, 4, 10, "#b8b8c0"); p.rect(4, 28, 8, 2, "#a8a8b0");
    ell(p, 8, 19, 7, 3, "#c8c8d0"); ell(p, 8, 19, 5, 1.8, "#6ab8f0"); p.px(6, 18, "#d8f0ff");
    p.blob(11, 16, 2, 1.6, "#8a6a4a", { outline: false }); p.px(12, 15, "#2a1a1a"); p.px(13, 16, "#f0a030");
  },
  sundial: (p) => {
    shadow(p, 8, 30, 5);
    p.column(5, 21, 6, 9, "#b8b8c0");
    ell(p, 8, 20, 7, 3, "#d8d0c0"); p.line(8, 20, 12, 16, "#5a5a62", 1); p.line(8, 20, 8, 17, "#5a5a62");
    for (let a = 0; a < 8; a++) p.px(8 + Math.cos(a / 8 * Math.PI * 2) * 5.5, 20 + Math.sin(a / 8 * Math.PI * 2) * 2.2, "#7a7a82");
  },
  bush: (p) => { shadow(p, 8, 30, 7); p.blob(8, 24, 7, 6, LEAF); p.blob(5, 22, 3.5, 3, LEAF2); p.blob(11, 25, 3, 2.5, "#2f7a2a"); p.px(5, 20, "#8ad86a"); },
  pine: (p) => {
    shadow(p, 8, 30, 6);
    p.column(7, 24, 3, 7, "#6a3a1e");
    for (let i = 0; i < 4; i++) { const y = 5 + i * 5, w = 3 + i * 1.6; p.g.fillStyle = i % 2 ? "#2f6a3a" : "#3a7a42"; p.g.beginPath(); p.g.moveTo(8, y - 3); p.g.lineTo(8 + w, y + 5); p.g.lineTo(8 - w, y + 5); p.g.fill(); }
    p.px(6, 9, "#5aa860"); p.px(5, 14, "#5aa860"); p.px(4, 19, "#5aa860");
  },
  sakura: (p) => tree(p, "#6a3a3a", [[8, 11, 8, 8, "#f0a0c0"], [5, 9, 4, 4, "#f8c0d8"], [11, 13, 4, 4, "#e890b0"], [7, 7, 3, 2.5, "#ffe0ee"]], ["#ffffff", [[4, 12], [11, 8], [9, 15], [13, 11]]]),
  maple: (p) => tree(p, "#6a3a2a", [[8, 11, 8, 8, "#d8402a"], [5, 9, 4, 4, "#f06030"], [11, 13, 4, 4, "#b8301a"], [7, 7, 3, 2.5, "#ff8a4a"]]),
  palm: (p) => {
    shadow(p, 8, 30, 5);
    for (let y = 8; y < 30; y++) p.rect(7 + Math.round(Math.sin(y / 6) * 1.5), y, 3, 1, y % 3 ? "#a07a4a" : "#7a5a3a");
    for (const [dx, dy] of [[-7, 3], [7, 3], [-6, -3], [6, -3], [0, -6]]) p.line(8, 8, 8 + dx, 8 + dy, "#3f9a45", 2);
    p.blob(7, 10, 1.5, 1.5, "#6a4a2a", { outline: false }); p.blob(10, 10, 1.5, 1.5, "#6a4a2a", { outline: false });
  },
  bamboo: (p) => {
    shadow(p, 8, 30, 6);
    for (const [x, top] of [[3, 6], [7, 3], [11, 8], [13, 12]] as const) {
      for (let y = top; y < 30; y++) p.rect(x, y, 2, 1, (y - top) % 6 === 0 ? "#4a8a2a" : "#7ac050");
      p.line(x + 1, top + 4, x + 5, top + 1, "#5aaa4a"); p.line(x, top + 9, x - 3, top + 7, "#5aaa4a");
    }
  },
  giant_mushroom: (p) => {
    shadow(p, 8, 30, 6);
    p.column(6, 16, 5, 14, "#f0e8d8");
    p.blob(8, 12, 8, 6, "#5ab0ff"); p.blob(6, 10, 3, 2, "#9ad0ff", { outline: false });
    for (const [x, y] of [[4, 12], [9, 9], [12, 13]]) p.rect(x, y, 2, 2, "#e0f4ff");
    glow(p, 8, 12, 9, "rgba(120,190,255,.2)");
  },
  crystal_cluster: (p) => {
    shadow(p, 8, 30, 6);
    for (const [x, top, hw, c] of [[4, 14, 2, "#8ab8ff"], [8, 8, 3, "#b08aff"], [12, 16, 2, "#8ad8ff"]] as const) {
      for (let y = top; y < 29; y++) { const w = Math.min(hw, y - top); for (let xx = x - w; xx <= x + w; xx++) p.px(xx, y, xx === x - w ? hs(c, 0.45) : xx === x + w ? hs(c, -0.25) : c); }
      p.px(x, top, "#ffffff");
    }
    p.rect(2, 28, 12, 2, "#6a6a78");
    glow(p, 8, 18, 10, "rgba(176,138,255,.2)");
  },
  rock_garden: (p) => {
    shadow(p, 8, 30, 7);
    p.rect(1, 26, 14, 4, "#e0d8c0"); for (let x = 2; x < 15; x += 3) p.px(x, 27, "#c8c0a8");
    p.blob(6, 23, 4, 4, "#8a8a92"); p.blob(12, 25, 3, 2.5, "#9a9aa0"); p.blob(4, 21, 1.5, 1, "#6fae4a", { outline: false });
  },
  stone_lantern: (p) => {
    shadow(p, 8, 30, 5);
    p.rect(4, 27, 8, 3, STONE); p.column(6, 20, 4, 7, "#a8a8b0");
    p.rect(4, 14, 8, 6, "#b0b0b8"); p.rect(6, 15, 4, 4, "#ffe07a");
    p.rect(2, 12, 12, 2, "#9a9aa0"); p.rect(4, 10, 8, 2, "#9a9aa0"); p.rect(7, 8, 2, 2, "#9a9aa0");
    glow(p, 8, 17, 7);
  },
  totem: (p) => {
    shadow(p, 8, 30, 4);
    const seg = (y: number, c: string) => { p.rect(4, y, 8, 7, c); p.rect(4, y, 8, 1, hs(c, 0.3)); p.rect(5, y + 2, 2, 2, "#1a1a1a"); p.rect(9, y + 2, 2, 2, "#1a1a1a"); p.rect(6, y + 5, 4, 1, "#e0e0d0"); };
    seg(23, "#8a5a2a"); seg(16, "#3a8a8a"); seg(9, "#c83a3a");
    p.rect(1, 10, 3, 3, "#e0b030"); p.rect(12, 10, 3, 3, "#e0b030"); p.rect(6, 6, 4, 3, "#e0b030");
  },
  banner: (p) => {
    shadow(p, 8, 30, 2);
    post(p, 3, 3, 30, DARK); p.px(3, 2, "#f2c542");
    p.rect(5, 4, 9, 11, "#3a6ab0"); p.rect(5, 4, 9, 1, hs("#3a6ab0", 0.3)); p.px(5, 15, "#3a6ab0"); p.px(13, 15, "#3a6ab0"); p.rect(7, 15, 5, 1, "#3a6ab0");
    p.blob(9, 9, 2, 2, "#8ad86a", { outline: false }); p.rect(9, 10, 1, 3, "#4f9a35");
  },
  wind_chime: (p) => {
    shadow(p, 8, 30, 3);
    post(p, 3, 6, 30, DARK); p.rect(3, 6, 10, 1, DARK);
    for (const [x, l] of [[6, 7], [8, 10], [10, 6], [12, 9]]) { p.rect(x, 7, 1, l - 3, "#c8c8c8"); p.rect(x, 4 + l, 1, 3, "#8ad8f0"); }
    p.rect(5, 7, 8, 1, "#c89a5a");
  },
  snowman: (p) => {
    shadow(p, 8, 30, 6);
    p.blob(8, 25, 6, 5, "#f4f8ff"); p.blob(8, 16, 4, 4, "#f4f8ff"); p.blob(8, 9, 3, 3, "#f4f8ff");
    p.px(7, 8, "#1a1a2a"); p.px(9, 8, "#1a1a2a"); p.px(8, 10, "#f07a2a"); p.px(9, 10, "#f07a2a");
    p.rect(5, 12, 7, 2, "#c83a3a"); p.rect(10, 13, 2, 4, "#c83a3a"); p.rect(5, 5, 6, 1, "#2a2a34"); p.rect(6, 2, 4, 3, "#2a2a34");
    p.px(8, 16, "#2a2a34"); p.px(8, 19, "#2a2a34");
  },
  pumpkins: (p) => {
    shadow(p, 8, 30, 7);
    const pk = (x: number, y: number, r: number, face = false) => { p.blob(x, y, r, r * 0.8, "#f08a2a"); p.rect(x - 1, y - r, 2, 2, "#4f7a2a"); p.line(x, y - r + 2, x, y + r - 2, "#c8601a"); if (face) { p.px(x - 2, y - 1, "#3a1a0a"); p.px(x + 2, y - 1, "#3a1a0a"); p.rect(x - 2, y + 1, 5, 1, "#3a1a0a"); } };
    pk(5, 26, 4, true); pk(12, 27, 3); pk(9, 20, 3);
  },
  cart: (p) => {
    shadow(p, 8, 30, 7);
    p.rect(1, 18, 13, 6, WOOD); p.rect(1, 18, 13, 1, hs(WOOD, 0.3)); for (let x = 3; x < 13; x += 3) p.rect(x, 19, 1, 5, DARK);
    p.line(13, 22, 16, 26, DARK);
    for (const [x, c] of [[3, "#e8303a"], [6, "#f2c230"], [9, "#4f9a35"], [11, "#f08a2a"]] as const) p.blob(x, 17, 1.8, 1.5, c, { outline: false });
    ell(p, 5, 26, 3.5, 3.5, "#5a3a1e"); ell(p, 5, 26, 2, 2, "#8a6a3a"); p.px(5, 26, "#3a2a1a");
  },
  weapon_rack: (p) => {
    shadow(p, 8, 30, 7);
    for (const x of [1, 14]) post(p, x, 12, 30, DARK, 1);
    p.rect(1, 14, 14, 1, WOOD); p.rect(1, 26, 14, 1, WOOD);
    p.rect(4, 6, 1, 20, "#c8ccd4"); p.rect(3, 22, 3, 1, "#8a6a3a");
    p.rect(8, 4, 1, 22, "#8a5a2a"); p.rect(7, 3, 3, 3, "#c8ccd4");
    p.blob(12, 20, 2.5, 3.5, "#c83a3a"); p.px(12, 20, "#f2c542");
  },
  cat_house: (p) => {
    shadow(p, 8, 30, 7);
    p.rect(2, 19, 12, 11, "#e8a0b0"); p.rect(2, 19, 1, 11, hs("#e8a0b0", 0.3)); p.rect(13, 19, 1, 11, hs("#e8a0b0", -0.3));
    for (let i = 0; i < 6; i++) p.rect(8 - i - 1, 13 + i, i * 2 + 2, 1, "#b84a6a");
    ell(p, 8, 25, 3, 3, "#3a2a2a"); p.rect(5, 25, 7, 4, "#3a2a2a");
    p.px(7, 26, "#f2c542"); p.px(9, 26, "#f2c542");
  },
  dog_house: (p) => {
    shadow(p, 8, 30, 7);
    p.rect(2, 19, 12, 11, WOOD); p.rect(2, 19, 1, 11, hs(WOOD, 0.3));
    for (let i = 0; i < 6; i++) p.rect(8 - i - 1, 13 + i, i * 2 + 2, 1, "#c83a3a");
    p.rect(5, 23, 6, 7, "#2a1a1a"); p.rect(6, 16, 4, 2, "#f0e0c0");
    p.blob(13, 28, 2, 1.5, "#d8a060"); p.px(14, 27, "#2a1a1a");
  },
  campfire_ring: (p) => {
    shadow(p, 8, 29, 7);
    for (let a = 0; a < 8; a++) p.blob(8 + Math.cos(a / 8 * Math.PI * 2) * 6, 26 + Math.sin(a / 8 * Math.PI * 2) * 3, 1.6, 1.3, a % 2 ? "#8a8f98" : "#9a9aa0");
    p.line(4, 27, 12, 24, "#7a4a2a", 2); p.line(4, 24, 12, 27, "#8a5a32", 2);
    p.blob(8, 21, 3, 4, "#ff6a2a", { outline: false }); p.blob(8, 22, 1.8, 2.5, "#ffc040", { outline: false });
    glow(p, 8, 22, 9, "rgba(255,150,60,.2)");
  },
  angel_statue: (p) => {
    shadow(p, 8, 30, 6);
    p.rect(3, 26, 10, 4, STONE); p.rect(3, 26, 10, 1, hs(STONE, 0.3));
    p.column(6, 13, 4, 13, "#d8d8d0"); p.blob(8, 10, 2.5, 2.5, "#e0e0d8");
    for (const s of [-1, 1]) { p.blob(8 + s * 5, 14, 3, 5, "#ecece4"); }
    p.g.strokeStyle = "#f2d860"; p.g.lineWidth = 1; p.g.beginPath(); p.g.ellipse(8, 6, 3, 1, 0, 0, Math.PI * 2); p.g.stroke();
  },
  sprout_statue: (p) => {
    shadow(p, 8, 30, 6);
    p.rect(3, 26, 10, 4, STONE); p.rect(3, 26, 10, 1, hs(STONE, 0.3));
    p.blob(8, 20, 5, 5, "#e8e4d8"); p.px(6, 19, "#5a5a62"); p.px(10, 19, "#5a5a62"); p.px(8, 22, "#8a8a92");
    p.rect(8, 10, 1, 6, "#c8c8c0"); p.blob(5, 11, 3, 1.6, "#d8d8d0"); p.blob(11, 10, 3, 1.6, "#d8d8d0");
    p.px(4, 10, "#8ad86a"); p.px(12, 9, "#8ad86a");
  },
  obelisk: (p) => {
    shadow(p, 8, 30, 5);
    p.rect(3, 27, 10, 3, "#7a7a82");
    for (let y = 5; y < 27; y++) { const w = y < 8 ? y - 4 : 4 - (y - 8) / 12; p.rect(8 - w, y, w * 2, 1, y % 5 ? "#8a8a98" : "#7a7a88"); }
    for (const y of [11, 15, 19, 23]) p.rect(7, y, 2, 1, "#8ad8ff");
    p.px(7, 6, "#c8c8d8");
  },
  stone_path: (p) => {
    for (const [x, y, w, h] of [[1, 17, 6, 5], [8, 16, 7, 6], [2, 23, 7, 7], [10, 23, 5, 6]]) {
      p.rect(x, y, w, h, "#b8b0a0"); p.rect(x, y, w, 1, "#d0c8b8"); p.rect(x, y + h - 1, w, 1, "#8a8478");
    }
  },
  flower_carpet: (p) => {
    const cols = ["#e84a6a", "#f7d44c", "#ffffff", "#b88aff", "#f28a3a", "#6ab8ff"];
    for (let i = 0; i < 22; i++) { const x = 1 + ((i * 7) % 14), y = 18 + ((i * 5) % 12); p.px(x, y, i % 3 ? "#5aaa3a" : "#4a9030"); p.px(x + 1, y, "#6ab84a"); }
    for (let i = 0; i < 7; i++) flower(p, 2 + ((i * 5) % 12), 19 + ((i * 4) % 10), cols[i % cols.length]);
  },
  picnic_rug: (p, W, H) => {
    for (let y = 18; y < H - 2; y++) for (let x = 2; x < W - 2; x++) p.px(x, y, ((x >> 2) + (y >> 2)) % 2 ? "#e84a4a" : "#f8f0e8");
    p.rect(2, H - 2, W - 4, 1, "#b83a3a");
    p.rect(8, 22, 8, 6, "#c89a5a"); p.rect(8, 22, 8, 1, hs("#c89a5a", 0.3)); p.g.strokeStyle = "#8a6a3a"; p.g.beginPath(); p.g.arc(12, 22, 4, Math.PI, 0); p.g.stroke();
    p.blob(22, 30, 3, 2, "#f0e0c0"); p.blob(22, 30, 1.5, 1, "#e8303a", { outline: false });
    p.rect(20, 38, 3, 4, "#d8e8ff"); p.rect(20, 38, 3, 1, "#ffffff");
  },
  lily_pond: (p, W, H) => {
    ell(p, W / 2, H - 14, W / 2 - 1, 12, "#8a8f98");
    ell(p, W / 2, H - 14, W / 2 - 3, 10, "#3a8ac8"); ell(p, W / 2 - 3, H - 18, 8, 4, "#5aa8e0");
    for (const [x, y] of [[9, 30], [20, 36], [22, 26]]) { ell(p, x, y, 3.5, 2.2, "#4f9a35"); p.px(x, y - 1, "#2f7a2a"); }
    p.blob(10, 29, 1.6, 1.4, "#f8b0d0", { outline: false }); p.px(10, 29, "#fff3a0");
    p.rect(15, 34, 3, 1, "#f08a2a"); p.px(18, 34, "#f8b060");
  },
  gazebo: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 2, 3);
    p.rect(2, H - 6, W - 4, 3, "#c8b898"); p.rect(2, H - 6, W - 4, 1, "#e0d0b0");
    for (const x of [4, 14, 26]) post(p, x, 18, H - 6, "#f0ece0");
    p.rect(3, H - 14, W - 6, 1, "#f0ece0");
    for (let i = 0; i < 10; i++) { const w = 4 + i * 2.8; p.rect(W / 2 - w / 2, 8 + i, w, 1, i % 2 ? "#3a6a8a" : "#4a7a9a"); }
    p.rect(W / 2 - 1, 4, 2, 4, "#f2c542");
  },
  wood_bridge: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 2, 2);
    for (let x = 1; x < W - 1; x++) { const y = 20 - Math.round(Math.sin(((x - 1) / (W - 3)) * Math.PI) * 5); p.rect(x, y, 1, 6, x % 3 ? WOOD : hs(WOOD, -0.15)); p.px(x, y, hs(WOOD, 0.35)); p.px(x, y - 4, "#c8945a"); }
    for (const x of [2, 10, 21, 29]) { const y = 20 - Math.round(Math.sin(((x - 1) / (W - 3)) * Math.PI) * 5); p.rect(x, y - 5, 1, 5, DARK); }
  },
  torii: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 3, 2);
    for (const x of [6, W - 9]) post(p, x, 8, H - 3, "#d8302a", 3);
    p.rect(1, 6, W - 2, 3, "#d8302a"); p.rect(0, 5, W, 1, "#2a1a1a"); p.rect(3, 12, W - 6, 2, "#d8302a");
    p.rect(W / 2 - 2, 9, 4, 3, "#2a1a1a"); p.px(W / 2, 10, "#f2c542");
  },
  dragon_statue: (p, W, H) => {
    shadow(p, W / 2, H - 3, W / 2 - 2, 3);
    p.rect(3, H - 8, W - 6, 6, STONE); p.rect(3, H - 8, W - 6, 1, hs(STONE, 0.3));
    const body = "#5a9a7a";
    // coiled body rising from the plinth to the head on the right
    for (let i = 0; i <= 24; i++) {
      const a = i / 24;
      const x = 6 + a * 18 + Math.sin(a * Math.PI * 2) * 3;
      const y = H - 11 - a * 24 + Math.cos(a * Math.PI * 2) * 3;
      p.blob(x, y, 3.4 - a * 1.2, 3.4 - a * 1.2, i % 4 ? body : hs(body, -0.15), { outline: false });
      if (i % 4 === 2) p.px(x, y - 3 + a, "#e0c060");
    }
    p.blob(26, 12, 4.5, 3.5, body); p.blob(29, 14, 3, 2, hs(body, 0.1));
    p.px(26, 11, "#f2c542"); p.px(31, 14, "#2a3a2a");
    p.line(24, 9, 21, 4, "#e0c060"); p.line(27, 9, 28, 4, "#e0c060");
    p.line(30, 16, 32, 19, "#e0e0d0");
  },
};
