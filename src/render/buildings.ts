import { BUILDINGS } from "../data/buildings";
import { CROPS, getItem } from "../data/items";
import { DECOR_DRAW } from "./decor";
import { doorAt, foundation as baseStones, groundShadow, hangingSign, house, lantern as lanternAt, roofSlab, wallTex, windowAt as windowNew, type HouseOpts, type WallKind } from "./houses";
import { hs, makeCanvas, mix, outline, rgba, type Paint } from "./palette";

/**
 * Cozy-farm-style buildings at 16px per tile. A building canvas is `w` tiles wide and
 * `h + 1` tiles tall (one tile of headroom for roofs). Walls are wooden siding or stone
 * over a cobble foundation, roofs are rows of shingles with an overhang shadow, windows
 * have frames and flower boxes, and shops hang a sign with an item icon.
 */

const cache = new Map<string, HTMLCanvasElement>();
const WOOD = "#b07a48", CREAM = "#f0e4c8";

// ------------------------------------------------------------ parts (thin adapters over ./houses)
function foundation(p: Paint, x: number, y: number, w: number, _h = 3) { baseStones(p, x, y, w); }
function walls(p: Paint, x: number, y: number, w: number, h: number, col: string, kind: "wood" | "stone" | "plaster" | "log" | WallKind) {
  wallTex(p, x, y, w, h, col, kind === "wood" ? "siding" : kind === "plaster" ? "timber" : kind);
}
function windowAt(p: Paint, x: number, y: number, box = true, lit = false) { windowNew(p, x, y, { box, lit }); }
function barnDoor(p: Paint, x: number, y: number, w: number, h: number, col: string) {
  wallTex(p, x, y, w, h, col, "plank", 3);
  const mid = x + Math.floor(w / 2);
  for (const [a, b] of [[x, mid], [mid, x + w - 1]]) { p.line(a + 1, y + 1, b - 1, y + h - 2, CREAM); p.line(b - 1, y + 1, a + 1, y + h - 2, CREAM); }
  p.rect(x, y, w, 1, CREAM); p.rect(x, y + h - 1, w, 1, CREAM); p.rect(x, y, 1, h, CREAM); p.rect(x + w - 1, y, 1, h, CREAM); p.rect(mid, y, 1, h, CREAM);
  p.rect(x - 1, y - 1, w + 2, 1, outline(col));
}

// ------------------------------------------------------------ building table
type Drawer = (p: Paint, W: number, H: number, level: number) => void;

const D: Record<string, Drawer> = {
  house: (p, W, H, lv) => {
    const roofs = ["#b84a3a", "#c0563a", "#6a4aa0", "#3a6ab0", "#3a7a5a", "#c89a2a"];
    house(p, W, H, {
      wall: lv >= 5 ? "#e8dcc8" : lv >= 3 ? "#c89a6a" : "#b8804a", roof: roofs[lv - 1] ?? roofs[0],
      wallKind: lv >= 5 ? "timber" : lv >= 3 ? "siding" : "log", roofKind: lv >= 6 ? "tile" : lv >= 4 ? "slate" : "shingle",
      chimney: true, floors: lv >= 3 ? 2 : 1, shutters: lv >= 2 ? "#3a6a4a" : undefined, dormer: lv >= 4, gable: lv >= 5, level: lv, seed: "house", props: lv >= 2,
    });
  },
  gate: (p, W, H) => {
    groundShadow(p, W, H);
    // violet glow spilling on the ground
    p.g.fillStyle = "rgba(150,90,255,0.22)"; p.g.beginPath(); p.g.ellipse(W / 2, H - 3, 12, 3, 0, 0, Math.PI * 2); p.g.fill();
    // the portal itself, an arched opening
    const px0 = 8, px1 = W - 9, top = 14, bot = H - 5, cx = (px0 + px1) / 2, rx = (px1 - px0) / 2;
    for (let y = top - Math.round(rx) + 2; y <= bot; y++) for (let x = px0; x <= px1; x++) {
      const dy = y - (top + 2);
      if (dy < 0 && (x - cx) ** 2 / (rx * rx) + (dy * dy) / ((rx - 1) * (rx - 1)) > 1) continue;
      const d = Math.hypot((x - cx) / rx, (y - (top + bot) / 2) / ((bot - top) / 1.6));
      const sw = Math.sin(Math.atan2(y - (top + bot) / 2, x - cx) * 3 + d * 9);
      p.px(x, y, d < 0.35 ? "#f0d8ff" : sw > 0.55 ? "#9a6af0" : d < 0.7 ? "#5a2ab8" : "#2a1460");
    }
    // stone pillars with quoins and caps
    for (const x of [1, W - 8]) {
      walls(p, x, 10, 7, H - 15, "#8a8f9a", "stone");
      for (let y = 12; y < H - 6; y += 5) { p.rect(x + (y % 10 ? 0 : 3), y, 4, 3, hs("#8a8f9a", 0.22)); p.rect(x + (y % 10 ? 0 : 3), y + 3, 4, 1, hs("#8a8f9a", -0.3)); }
      p.rect(x - 1, 8, 9, 3, hs("#a0a4ae", 0.1)); p.rect(x - 1, 8, 9, 1, hs("#a0a4ae", 0.35)); p.rect(x - 1, 11, 9, 1, outline("#a0a4ae"));
      p.rect(x + 2, 5, 3, 3, "#b48aff"); p.px(x + 3, 6, "#f0e0ff");
      p.g.fillStyle = "rgba(180,140,255,0.3)"; p.g.beginPath(); p.g.arc(x + 3.5, 6.5, 4, 0, Math.PI * 2); p.g.fill();
    }
    // arch stones over the opening
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const x = Math.round(cx + Math.cos(a) * (rx + 1.5)), y = Math.round(top + 2 + Math.sin(a) * (rx + 0.5));
      p.rect(x - 1, y - 1, 3, 3, i % 2 ? "#9a9ea8" : "#b0b4be"); p.px(x - 1, y - 1, "#d0d4dc");
    }
    p.rect(cx - 1, top - rx - 1, 3, 3, "#c8a0ff"); p.px(cx, top - rx, "#ffffff");
    foundation(p, 0, H - 5, W);
    for (let i = 0; i < 7; i++) p.px(px0 + 2 + ((i * 7) % (px1 - px0 - 3)), top + 3 + ((i * 11) % (bot - top - 4)), "#ffffff");
  },
  well: (p, W, H) => {
    groundShadow(p, W, H);
    // round stone shaft seen from above: a ring of stones around dark water
    walls(p, 1, 21, 14, 7, "#9a9aa0", "stone");
    p.rect(1, 21, 14, 1, outline("#9a9aa0"));
    p.g.fillStyle = "#b8b8c0"; p.g.beginPath(); p.g.ellipse(8, 21, 7, 3.5, 0, 0, Math.PI * 2); p.g.fill();
    p.g.fillStyle = "#2a4a78"; p.g.beginPath(); p.g.ellipse(8, 21, 5, 2.2, 0, 0, Math.PI * 2); p.g.fill();
    p.rect(5, 20, 3, 1, "#6aa8e0"); p.px(10, 22, "#4a7ab8");
    for (const x of [2, 13]) p.column(x - 1, 9, 3, 13, "#7a4a2a");
    p.rect(2, 11, 12, 1, "#5a3a20"); p.rect(7, 12, 1, 6, "#c8a070");
    p.rect(6, 17, 3, 3, "#8a5a2a"); p.rect(6, 17, 3, 1, "#b88a5a"); p.rect(6, 18, 3, 1, "#4a4448");
    roofSlab(p, 0, 15, 4, 9, "#b84a3a", "shingle", 5);
    foundation(p, 0, H - 5, W);
  },
  compost: (p, W, H) => {
    groundShadow(p, W, H);
    walls(p, 1, 19, 14, 10, "#9a6a3a", "plank");
    p.rect(0, 18, 16, 2, "#7a4a2a"); p.rect(0, 18, 16, 1, "#a87a48");
    p.rect(2, 16, 12, 3, "#4a3220");
    for (const [x, c] of [[3, "#6fae4a"], [6, "#8a6a3a"], [9, "#a0c050"], [12, "#c8a060"]] as const) { p.rect(x, 15, 2, 2, c); p.px(x, 15, hs(c, 0.3)); }
    p.line(12, 14, 15, 7, "#7a4a2a"); p.rect(14, 5, 2, 3, "#b0b8c4");
  },
  greenhouse: (p, W, H, lv) => {
    groundShadow(p, W, H);
    const glass = "#a8dce8", frame = "#f4f8f8";
    const wallTop = H - 26, eave = wallTop + 1;
    // plants seen through the glass, then the panes over them
    p.rect(1, wallTop, W - 2, 21, "#6aa8a0");
    for (let x = 4; x < W - 4; x += 6) { p.blob(x + 2, wallTop + 12, 3, 3, lv > 1 ? "#4f9a35" : "#5aaa45"); p.px(x + 1, wallTop + 10, lv > 1 ? "#e84a6a" : "#f7d44c"); p.px(x + 3, wallTop + 12, "#f7d44c"); }
    p.g.fillStyle = "rgba(220,250,255,0.42)"; p.g.fillRect(1, wallTop, W - 2, 21);
    for (let x = 1; x < W - 1; x += 6) p.rect(x, wallTop, 1, 21, frame);
    for (let y = wallTop; y < wallTop + 21; y += 7) p.rect(1, y, W - 2, 1, frame);
    for (let i = 0; i < 5; i++) p.line(4 + i * 9, wallTop + 3, 7 + i * 9, wallTop + 1, "rgba(255,255,255,0.8)");
    walls(p, 1, H - 9, W - 2, 4, "#b86a4a", "brick");
    foundation(p, 0, H - 5, W);
    // glass roof: panes on a white frame, sky reflections towards the upper left
    const top = Math.max(6, eave - Math.round(W * 0.42)), h = eave - top + 1, inset = Math.round(h * 0.3);
    for (let i = 0; i < h; i++) {
      const t = i / (h - 1), l = Math.round(inset * (1 - t)), r = W - 1 - Math.round(inset * (1 - t));
      for (let x = l; x <= r; x++) {
        const edge = x === l || x === r, fr = (x - l) % 6 === 0 || i % 5 === 0;
        const refl = (x + i * 2) % 17 < 2 && x < W * 0.6;
        p.px(x, top + i, edge ? outline(glass) : fr ? frame : refl ? "#f0ffff" : hs(glass, 0.12 - t * 0.25 - (x / W) * 0.1));
      }
    }
    p.rect(inset, top - 2, W - 2 * inset, 2, frame); p.rect(inset - 1, top - 3, W - 2 * inset + 2, 1, outline(glass));
    p.rect(0, eave + 1, W, 1, outline(glass));
    doorAt(p, W / 2 - 3, H - 15, { col: "#88c8d8", trim: frame });
  },
  coop: (p, W, H, lv) => {
    house(p, W, H, { wall: "#c8945a", roof: "#8a4a2a", wallKind: "plank", roofKind: "shingle", seed: "coop", level: lv });
    // a little ramp and the residents
    p.rect(3, H - 11, 5, 5, "#2a1a14"); p.rect(3, H - 11, 5, 1, outline("#c8945a"));
    p.line(2, H - 4, 8, H - 8, WOOD, 2); for (let i = 0; i < 3; i++) p.px(4 + i * 2, H - 5 - i, hs(WOOD, -0.3));
    p.blob(W - 6, H - 4, 2.5, 2, "#ffffff"); p.px(W - 4, H - 6, "#e84a2a"); p.px(W - 3, H - 4, "#f2a030");
    if (lv >= 2) { p.blob(W - 11, H - 3, 2.5, 2, "#e8d8b8"); p.px(W - 9, H - 5, "#e84a2a"); }
  },
  barn: (p, W, H, lv) => {
    const red = "#b8442e";
    p.g.fillStyle = "rgba(24,12,40,0.3)"; p.g.fillRect(1, H - 2, W, 2);
    walls(p, 1, 14, W - 2, H - 19, red, "plank");
    for (const x of [1, W - 4]) { p.rect(x, 14, 3, H - 19, CREAM); p.rect(x, 14, 1, H - 19, hs(CREAM, 0.2)); }
    foundation(p, 0, H - 5, W);
    roofSlab(p, 0, W - 1, 3, 15, "#5a4a5a", "slate", 11);
    p.g.fillStyle = "rgba(24,12,40,0.32)"; p.g.fillRect(1, 17, W - 2, 2);
    // hay loft
    p.rect(W / 2 - 4, 19, 8, 6, CREAM); p.rect(W / 2 - 3, 20, 6, 4, "#3a2618"); p.rect(W / 2 - 3, 22, 6, 2, "#e8c860"); p.px(W / 2 - 2, 22, "#fff0a0");
    barnDoor(p, W / 2 - 8, H - 17, 16, 12, hs(red, -0.12));
    p.rect(3, H - 8, 5, 3, "#e8c860"); p.rect(3, H - 8, 5, 1, "#fff0a0"); p.rect(W - 8, H - 8, 5, 3, "#e8c860"); p.rect(W - 8, H - 8, 5, 1, "#fff0a0");
    if (lv >= 2) { p.rect(W - 6, 0, 1, 6, "#4a3a2a"); p.line(W - 9, 1, W - 3, 1, "#4a3a2a"); p.px(W - 3, 0, "#c8c8d0"); }
  },
  beehive: (p, W, H) => {
    groundShadow(p, W, H);
    p.column(5, H - 5, 2, 3, "#6a4428"); p.column(10, H - 5, 2, 3, "#6a4428");
    for (let k = 0; k < 3; k++) { walls(p, 3, 15 + k * 4, 10, 4, k % 2 ? "#e8d8a8" : "#f4e8c0", "siding"); p.rect(3, 18 + k * 4, 10, 1, outline("#f0e0b0")); }
    p.rect(2, 13, 12, 3, "#b88a4a"); p.rect(2, 13, 12, 1, "#d8aa6a"); p.rect(2, 15, 12, 1, outline("#b88a4a"));
    p.rect(6, 26, 4, 1, "#2a1a12");
    for (const [x, y] of [[13, 11], [1, 17], [12, 20]]) { p.px(x, y, "#ffd23a"); p.px(x + 1, y, "#2a2020"); }
  },
  silkhouse: (p, W, H, lv) => house(p, W, H, { wall: "#f0e0c0", roof: "#c8a050", wallKind: "timber", roofKind: "thatch", emblem: "wool", seed: "silk", level: lv }),
  lumber: (p, W, H) => {
    groundShadow(p, W, H);
    // stacked logs with cut ends facing us
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
      const x = 4 + k * 6 + row * 3, y = H - 9 - row * 5;
      p.rect(x - 3, y - 4, 1, 1, "#6a4428");
      p.blob(x, y, 3, 2.6, "#8a5a30");
      p.blob(x - 0.3, y - 0.2, 2, 1.7, "#e0b880", { outline: false, hi: 0.2, lo: -0.15 });
      p.px(x, y, "#b88a50");
    }
    // chopping block with an axe
    p.column(W - 11, H - 11, 7, 6, "#8a5a30"); p.rect(W - 11, H - 12, 7, 2, "#e0b880"); p.rect(W - 11, H - 12, 7, 1, "#f0d0a0");
    p.line(W - 8, H - 13, W - 3, H - 22, "#7a4a2a", 2); p.rect(W - 5, H - 24, 4, 3, "#b0b8c4"); p.px(W - 5, H - 24, "#e8f0f8");
    p.rect(2, H - 4, 3, 1, "#d8b078"); p.rect(W - 14, H - 3, 2, 1, "#d8b078");
  },
  quarry: (p, W, H) => {
    groundShadow(p, W, H);
    // a cut rock face with stacked blocks in front
    p.blob(W / 2, H - 13, W / 2 - 2, 10, "#8a8f96", { hi: 0.25, lo: -0.3 });
    for (const [x, y] of [[6, H - 16], [14, H - 19], [22, H - 15]]) { p.rect(x, y, 5, 1, "#6a6e76"); p.rect(x + 1, y + 1, 1, 3, "#6a6e76"); }
    for (const [x, y] of [[3, H - 10], [10, H - 10], [6, H - 15]]) { walls(p, x, y, 7, 5, "#b0b4ba", "stone"); p.rect(x, y, 7, 1, "#d0d4da"); }
    p.line(W - 9, H - 6, W - 4, H - 16, "#7a4a2a", 2); p.line(W - 8, H - 17, W - 1, H - 14, "#c8ccd4", 2);
    for (let i = 0; i < 6; i++) p.px(3 + ((i * 9) % (W - 6)), H - 3 - (i % 2), "#a0a4ac");
  },
  mine: (p, W, H) => {
    // a rocky hillside with a timber-framed tunnel, a rail and a cart of ore
    p.blob(W / 2, H - 14, W / 2, 13, "#7a6a5a", { hi: 0.2, lo: -0.3 });
    p.blob(7, H - 20, 5, 4, "#8a7a6a"); p.blob(W - 8, H - 23, 4, 3, "#6a5a4a");
    p.rect(W / 2 - 7, H - 19, 14, 15, "#140e0e");
    p.rect(W / 2 - 7, H - 19, 14, 4, "#241a18");
    for (const x of [W / 2 - 9, W / 2 + 6]) p.column(x, H - 21, 3, 17, "#8a5a30");
    p.rect(W / 2 - 10, H - 22, 20, 3, "#9a6a3a"); p.rect(W / 2 - 10, H - 22, 20, 1, "#c89a60"); p.rect(W / 2 - 10, H - 19, 20, 1, outline("#9a6a3a"));
    lanternAt(p, W / 2 + 4, H - 18);
    for (let x = 4; x < W - 3; x += 3) p.rect(x, H - 4, 2, 1, "#6a4a2a");
    p.rect(3, H - 5, W - 6, 1, "#8a8f96"); p.rect(3, H - 3, W - 6, 1, "#8a8f96");
    p.rect(W - 13, H - 10, 9, 5, "#5a5e66"); p.rect(W - 13, H - 10, 9, 1, "#8a8f96");
    p.blob(W - 11, H - 11, 2, 1.5, "#e0a040"); p.blob(W - 7, H - 11, 2, 1.5, "#c8c8d8");
    p.blob(W - 11, H - 4, 1.2, 1.2, "#2a2a30", { outline: false }); p.blob(W - 6, H - 4, 1.2, 1.2, "#2a2a30", { outline: false });
  },
  herbgarden: (p, W, H) => {
    for (const [x, y] of [[2, 18], [18, 18], [2, 32], [18, 32]]) {
      if (y + 12 > H) continue;
      p.g.fillStyle = "rgba(24,12,40,0.25)"; p.g.fillRect(x + 1, y + 10, 12, 1);
      walls(p, x, y + 6, 12, 4, "#9a6a3a", "plank");
      p.rect(x, y, 12, 7, "#7a5230"); p.rect(x + 1, y + 1, 10, 5, "#5a3a22");
      p.rect(x, y, 12, 1, "#b07a48"); p.rect(x, y, 1, 7, "#b07a48"); p.rect(x + 11, y, 1, 7, outline("#9a6a3a"));
      for (let i = 0; i < 3; i++) { const c = ["#4f9a35", "#6ab84a", "#3a8a5a"][i]; p.rect(x + 2 + i * 3, y + 1, 2, 4, c); p.px(x + 2 + i * 3, y, hs(c, 0.35)); p.px(x + 3 + i * 3, y + 2, ["#e8e0ff", "#f7d44c", "#ffffff"][i]); }
    }
  },
  market: (p, W, H) => {
    groundShadow(p, W, H);
    // counter with crates of produce
    walls(p, 2, H - 15, W - 4, 10, "#a8743e", "plank");
    p.rect(1, H - 16, W - 2, 2, "#c89058"); p.rect(1, H - 16, W - 2, 1, "#e0b078"); p.rect(1, H - 14, W - 2, 1, outline("#c89058"));
    const goods = ["#f28a3a", "#e84a4a", "#8ad86a", "#f7d44c", "#b88aff", "#e84a4a"];
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 7;
      p.rect(x, H - 20, 6, 4, "#8a5a30"); p.rect(x, H - 20, 6, 1, "#b07a48");
      for (let j = 0; j < 4; j++) p.blob(x + 1.5 + (j % 2) * 3, H - 21 + Math.floor(j / 2), 1.6, 1.4, goods[k], { outline: false });
    }
    // poles and a sloped striped awning with a scalloped valance
    for (const x of [2, W - 4]) p.column(x, 12, 2, H - 17, "#7a4a2a");
    const top = 6, eave = 16;
    for (let i = 0; i <= eave - top; i++) {
      const t = i / (eave - top), l = Math.round(5 * (1 - t)), r = W - 1 - Math.round(5 * (1 - t));
      for (let x = l; x <= r; x++) { const red = Math.floor((x + 1) / 4) % 2 === 0; const c = red ? "#d84a4a" : "#f8f0e0"; p.px(x, top + i, x === l || x === r ? outline("#d84a4a") : hs(c, 0.08 - t * 0.2)); }
    }
    for (let x = 0; x < W; x++) { const red = Math.floor((x + 1) / 4) % 2 === 0; p.px(x, eave + 1, red ? "#b83a3a" : "#e0d8c8"); if (x % 4 !== 3) p.px(x, eave + 2, red ? "#9a2a2a" : "#c8c0b0"); }
    p.g.fillStyle = "rgba(24,12,40,0.25)"; p.g.fillRect(2, eave + 3, W - 4, 2);
    hangingSign(p, W / 2 - 6, 0, "coin");
  },
  tent: (p, W, H) => {
    groundShadow(p, W, H);
    const c = "#d8b078";
    for (let i = 0; i < 16; i++) {
      const y = 13 + i, hw = 1 + i * 0.45;
      for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) {
        const lit = x < 8;
        p.px(x, y, (x === Math.round(8 - hw) || x === Math.round(8 + hw)) ? outline(c) : (x - 1) % 4 === 0 ? hs(c, -0.2) : hs(c, lit ? 0.12 : -0.08));
      }
    }
    for (let i = 0; i < 8; i++) { p.px(8 - Math.round(i * 0.35), 21 + i, "#3a2418"); p.px(8 + Math.round(i * 0.35), 21 + i, "#3a2418"); p.rect(9 - Math.round(i * 0.35), 21 + i, Math.round(i * 0.7) - 1, 1, "#2a1a12"); }
    p.rect(8, 9, 1, 5, "#4a3a2a"); p.rect(9, 9, 4, 2, "#c83a3a"); p.px(9, 11, "#9a2a2a");
    p.line(1, 29, 4, 22, "#c8b090"); p.line(15, 29, 12, 22, "#c8b090");
  },
  watchtower: (p, W, H) => {
    groundShadow(p, W, H);
    // four legs with a cross brace, a railed platform and a pointed roof
    for (const x of [2, 12]) p.column(x, 14, 2, H - 16, "#8a5a30");
    p.line(3, H - 4, 12, 16, "#7a4a2a"); p.line(12, H - 4, 3, 16, "#7a4a2a");
    walls(p, 1, 10, 14, 7, "#b07a48", "plank");
    p.rect(0, 16, 16, 2, "#7a4a2a"); p.rect(0, 16, 16, 1, "#a0703a");
    for (let x = 1; x < 15; x += 3) p.rect(x, 11, 1, 5, "#5a3a20");
    lanternAt(p, 7, 11);
    roofSlab(p, 0, 15, 3, 9, "#6a3a2a", "shingle", 4);
  },
  palace: (p, W, H, lv) => {
    house(p, W, H, { wall: "#f0e8d8", roof: "#3a6ab0", wallKind: "stone", roofKind: "tile", floors: 2, gable: true, dormer: true, trim: "#f8f0e0", door: "#7a3a5a", shutters: "#3a5a9a", seed: "palace", level: lv });
    for (const x of [0, W - 11]) {
      walls(p, x + 1, 14, 9, H - 19, "#e8e0d0", "stone");
      foundation(p, x, H - 5, 11);
      roofSlab(p, x - 1, x + 11, 4, 14, "#3a6ab0", "tile", x);
      windowAt(p, x + 3, 22, false, true); windowAt(p, x + 3, 34, false, true);
      p.rect(x + 5, 0, 1, 4, "#4a3a2a"); p.rect(x + 6, 0, 4, 2, "#f2c230");
    }
  },
  windmill: (p, W, H) => {
    groundShadow(p, W, H);
    // tapered plaster tower
    for (let y = 16; y < H - 5; y++) {
      const hw = 7 + (y - 16) * 0.28, l = Math.round(W / 2 - hw), r = Math.round(W / 2 + hw);
      for (let x = l; x <= r; x++) p.px(x, y, x === l || x === r ? outline("#e8dcc0") : x < l + 3 ? "#f8f0dc" : x > r - 4 ? "#d0c4a8" : (y % 4 === 0 && (x + y) % 7 === 0) ? "#d8ccb0" : "#e8dcc0");
    }
    foundation(p, W / 2 - 11, H - 5, 22);
    doorAt(p, W / 2 - 3, H - 14, { col: "#8a5230", arch: true });
    windowAt(p, W / 2 - 3, 21, false, true);
    roofSlab(p, W / 2 - 10, W / 2 + 9, 8, 17, "#8a3a2a", "shingle", 9);
    // sails: lattice frames on a hub
    p.g.save(); p.g.translate(W / 2, 13); p.g.rotate(0.35);
    for (let i = 0; i < 4; i++) {
      p.g.rotate(Math.PI / 2);
      p.g.fillStyle = "#6a4428"; p.g.fillRect(-1, 0, 2, 15);
      p.g.fillStyle = "#f4efe6"; p.g.fillRect(1, 3, 5, 11);
      p.g.fillStyle = "#c8b890"; for (let k = 4; k < 14; k += 3) p.g.fillRect(1, k, 5, 1);
      p.g.fillStyle = "#a89870"; p.g.fillRect(5, 3, 1, 11);
    }
    p.g.restore(); p.blob(W / 2, 13, 2.2, 2.2, "#5a3a1e");
  },
  ...DECOR_DRAW,
};

/** Look of the remaining (shop / housing / service) buildings. */
const HOUSES: Record<string, HouseOpts> = {
  kitchen: { wall: "#e0c8a0", roof: "#9a5a3a", wallKind: "timber", roofKind: "shingle", chimney: true, emblem: "bowl", props: true, door: "#a0603a" },
  forge: { wall: "#8a8a92", roof: "#4a4a58", wallKind: "stone", roofKind: "slate", chimney: true, emblem: "ingot", props: true, door: "#5a4a4a" },
  sawmill: { wall: "#b07a48", roof: "#6a4a2a", wallKind: "log", roofKind: "shingle", emblem: "plank", props: true },
  workshop: { wall: "#a0a4aa", roof: "#5a5e6a", wallKind: "stone", roofKind: "slate", emblem: "block", props: true },
  tailor: { wall: "#ecd8e0", roof: "#8a4a6a", wallKind: "timber", roofKind: "tile", emblem: "cloth", shutters: "#8a4a6a" },
  alchemy: { wall: "#8a9a78", roof: "#3a6a4a", wallKind: "stone", roofKind: "slate", chimney: true, emblem: "potion", door: "#4a3a6a" },
  library: { wall: "#c8c0d8", roof: "#3a4a9a", wallKind: "stone", roofKind: "slate", emblem: "book", gable: true, door: "#4a3a2a" },
  cottage: { wall: "#c8945a", roof: "#b84a3a", wallKind: "siding", roofKind: "shingle", chimney: true, shutters: "#3a6a4a" },
  stonehouse: { wall: "#b0b0a8", roof: "#4a5a8a", wallKind: "stone", roofKind: "slate", chimney: true, shutters: "#6a3a2a" },
  manor: { wall: "#ece4d4", roof: "#6a2a5a", wallKind: "timber", roofKind: "slate", chimney: true, floors: 2, dormer: true, shutters: "#4a3a5a" },
  apartment: { wall: "#c87a5a", roof: "#3a3a4a", wallKind: "brick", roofKind: "slate", floors: 3, trim: "#f0e8d8" },
  tavern: { wall: "#b07a48", roof: "#6a2a1a", wallKind: "siding", roofKind: "shingle", chimney: true, emblem: "cup", props: true, dormer: true },
  academy: { wall: "#d8d0e8", roof: "#4a3a8a", wallKind: "stone", roofKind: "slate", floors: 2, emblem: "book", gable: true },
  temple: { wall: "#f4f0e4", roof: "#2a8a6a", wallKind: "stone", roofKind: "tile", emblem: "herb", gable: true, trim: "#f8f4e8", door: "#a07a3a" },
  clinic: { wall: "#f4f4f4", roof: "#c83a3a", wallKind: "timber", roofKind: "tile", emblem: "potion", shutters: "#c83a3a" },
  warehouse: { wall: "#9a7a4a", roof: "#5a4a2a", wallKind: "plank", roofKind: "shingle", emblem: "plank", props: true },
  bakery: { wall: "#f0d8b0", roof: "#c8603a", wallKind: "timber", roofKind: "tile", chimney: true, props: true },
  winery: { wall: "#9a8a7a", roof: "#6a2a4a", wallKind: "stone", roofKind: "tile", props: true },
  dairy: { wall: "#f4f0e8", roof: "#4a7ab0", wallKind: "plank", roofKind: "shingle", props: true },
  bathhouse: { wall: "#c8a07a", roof: "#2a5a7a", wallKind: "plank", roofKind: "tile", chimney: true },
  inn: { wall: "#c89a6a", roof: "#3a6a4a", wallKind: "siding", roofKind: "shingle", chimney: true, dormer: true, props: true, shutters: "#3a4a6a" },
  guild: { wall: "#a8a098", roof: "#7a2a2a", wallKind: "stone", roofKind: "slate", floors: 2, gable: true, props: true },
};

/**
 * What an upgrade adds around any building, special shapes included: planters at the corners
 * (flowering from level 3), lamp posts (3), banners on poles (4), a golden shimmer (5+), and a
 * row of small gold stars on the ground, one per level above the first.
 */
function dressing(p: Paint, W: number, H: number, level: number) {
  const g = p.g;
  const planter = (x: number, flowers: boolean) => {
    p.rect(x, H - 5, 5, 3, "#9a5a32"); p.rect(x, H - 5, 5, 1, "#c07a48"); p.rect(x, H - 3, 5, 1, "#6a3a22");
    p.blob(x + 2.5, H - 7, 3.2, 2.6, "#4a9a3a");
    if (flowers) for (const [dx, dy, c] of [[1, -8, "#ff8ab8"], [3, -9, "#ffe05a"], [4, -7, "#ff8ab8"]] as const) p.px(x + dx, H + dy, c);
  };
  const post = (x: number) => {
    p.rect(x, H - 13, 1, 11, "#3a3640"); p.rect(x - 1, H - 3, 3, 1, "#2a2630");
    p.rect(x - 1, H - 16, 3, 3, "#3a3640"); p.px(x, H - 15, "#ffe08a");
    g.fillStyle = "rgba(255,220,120,.18)"; g.beginPath(); g.arc(x + 0.5, H - 14.5, 4, 0, Math.PI * 2); g.fill();
  };
  const banner = (x: number, col: string) => {
    p.rect(x, H - 22, 1, 20, "#5a4632"); p.px(x, H - 23, "#f2c230");
    p.rect(x + 1, H - 21, 4, 8, col); p.rect(x + 1, H - 21, 4, 1, hs(col, 0.25)); p.rect(x + 4, H - 21, 1, 8, hs(col, -0.25));
    p.px(x + 1, H - 13, col); p.px(x + 3, H - 13, col); p.px(x + 2, H - 17, "#f2c230");
  };
  const wide = W >= 48;
  const stars = () => {
    const n = Math.min(6, level - 1);
    const x0 = Math.round(W / 2 - (n * 4 - 1) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 4, y = H - 2;
      p.px(x + 1, y - 1, "#ffe58a"); p.rect(x, y, 3, 1, "#f2c230"); p.px(x + 1, y + 1, "#b8861a");
    }
  };
  // one-tile pieces only get their stars: props would bury them
  if (W < 32) return stars();
  // the shimmer sits on the building itself, never in the empty sky above a low one
  const solid = g.getImageData(0, 0, W, H).data;
  const opaque = (x: number, y: number) => solid[(y * W + x) * 4 + 3] > 200;
  planter(1, level >= 3);
  if (W >= 32) planter(W - 6, level >= 3);
  if (level >= 3) { post(wide ? 8 : 7); if (wide) post(W - 9); }
  if (level >= 4) { banner(0, level >= 5 ? "#c8302a" : "#3a6ab0"); if (W >= 32) banner(W - 6, level >= 5 ? "#c8302a" : "#3a6ab0"); }
  if (level >= 5) {
    let placed = 0;
    for (let i = 0; i < 60 && placed < 7; i++) {
      const x = 3 + Math.floor(cellNoise(i, level) * (W - 6)), y = 3 + Math.floor(cellNoise(i + 99, level) * (H - 14));
      if (!opaque(x, y)) continue;
      placed++;
      p.px(x, y, "#fff6c0");
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.px(x + dx, y + dy, "rgba(255,214,90,.75)");
    }
  }
  stars();
}
const cellNoise = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function buildingCanvas(type: string, level: number): HTMLCanvasElement {
  const key = `${type}:${level}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = BUILDINGS[type];
  const [tw, th] = def?.size ?? [1, 1];
  const W = tw * 16, H = th * 16 + 16;
  const [c, p] = makeCanvas(W, H);
  if (D[type]) D[type](p, W, H, level);
  else {
    const o = HOUSES[type] ?? { wall: def?.style?.wall ?? "#c8945a", roof: def?.style?.roof ?? "#b84a3a", emblem: def?.style?.emblem };
    house(p, W, H, { ...o, emblem: o.emblem ?? def?.style?.emblem, floors: Math.min((o.floors ?? 1) + (level >= 3 && tw >= 3 ? 1 : 0), 3), level, seed: type });
  }
  if ((def?.maxLevel ?? 1) > 1 && level >= 2) dressing(p, W, H, level);
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------ crops (16x16 overlay on a farm plot)
/** Crop sprites stand on the bottom rows of their canvas; lift them so they grow from the middle of the plot. */
export const CROP_LIFT = 0.3;

export function cropCanvas(cropId: string, stage: number): HTMLCanvasElement {
  const key = `crop:${cropId}:${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, p] = makeCanvas(16, 16);
  const it = getItem(cropId);
  const fruit = it.col[0];
  const kind = CROPS[cropId]?.kind ?? "crop";
  const shape = it.shape;
  const leaf = "#5aa83a", leafD = hs(leaf, -0.28), leafL = hs(leaf, 0.3);
  const stem = (x: number, top: number) => p.rect(x, top, 1, 14 - top, leafD);
  const leafPair = (x: number, y: number, s = 2) => { p.rect(x - s, y, s, 1, leaf); p.rect(x + 1, y - 1, s, 1, leaf); p.px(x - s, y - 1, leafL); p.px(x + s, y - 2, leafL); };
  if (stage === 0) {
    for (const x of [4, 11]) { p.px(x, 12, "#6a4428"); p.px(x, 11, leaf); p.px(x - 1, 10, leafL); p.px(x + 1, 10, leaf); }
  } else if (kind === "tree") {
    const h = [0, 7, 10, 12][stage];
    p.column(7, 14 - h, 2, h, "#7a4a2a");
    p.blob(8, 14 - h, 3 + stage, 2 + stage * 0.8, leaf);
    if (stage >= 3) for (const [x, y] of [[5, 5], [10, 6], [8, 3]]) { p.px(x, y, fruit); p.px(x + 1, y, hs(fruit, 0.3)); }
  } else if (shape === "grain") {
    for (const x of [3, 6, 9, 12]) {
      const top = stage === 1 ? 9 : stage === 2 ? 5 : 3;
      stem(x, top);
      if (stage >= 2) leafPair(x, 11);
      if (stage === 3) { p.rect(x - 1, top - 1, 2, 4, fruit); p.px(x - 1, top - 1, hs(fruit, 0.3)); }
    }
  } else if (shape === "root" || shape === "leafy") {
    for (const x of [4, 11]) {
      const s = stage === 1 ? 1.8 : stage === 2 ? 2.6 : 3;
      p.blob(x, 10, s, s, shape === "leafy" ? mix(leaf, fruit, 0.35) : leaf, { hi: 0.35 });
      if (stage === 3 && shape === "root") { p.blob(x, 13, 2, 1.5, fruit); }
    }
  } else if (shape === "gourd" || shape === "fruit" || shape === "pod") {
    p.line(2, 12, 13, 12, leafD);
    for (const x of [3, 8, 12]) if (stage >= 1) p.blob(x, 10, stage >= 2 ? 2.4 : 1.6, stage >= 2 ? 2 : 1.4, leaf);
    if (stage === 3) { if (shape === "gourd") p.blob(8, 11, 4, 3, fruit, { hi: 0.4 }); else for (const x of [4, 10]) p.blob(x, 9, 2, 2, fruit, { hi: 0.4 }); }
  } else if (shape === "flower") {
    for (const x of [4, 11]) {
      const top = stage === 1 ? 10 : stage === 2 ? 6 : 5;
      stem(x, top); leafPair(x, 11);
      if (stage === 3) { p.px(x - 1, top, fruit); p.px(x + 1, top, fruit); p.px(x, top - 1, hs(fruit, 0.3)); p.px(x, top + 1, hs(fruit, -0.2)); p.px(x, top, "#fff3a0"); }
      else if (stage === 2) p.px(x, top, hs(fruit, -0.2));
    }
  } else if (shape === "mushroom") {
    for (const x of [4, 11]) { const s = stage; p.rect(x, 13 - s, 1, s + 1, "#f0e4c8"); p.blob(x, 12 - s, 1 + s * 0.8, 1 + s * 0.5, fruit); }
  } else {
    // berries, herbs and everything else: a leafy bush that fruits
    for (const x of [4, 11]) {
      const s = stage === 1 ? 2 : stage === 2 ? 3 : 3.4;
      p.blob(x, 10, s, s * 0.9, leaf, { hi: 0.35 });
      if (stage === 3) for (const [dx, dy] of [[-1, -1], [1, 0], [0, 1]]) { p.px(x + dx, 10 + dy, fruit); p.px(x + dx + 1, 10 + dy, hs(fruit, 0.3)); }
    }
  }
  cache.set(key, c);
  return c;
}

export const rgbaCol = rgba;
