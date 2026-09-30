import { ROADSIDE_META } from "../story/roadside";
import type { Element } from "../combat/types";
import { hashString } from "../core/rng";
import { hs, makeCanvas, mix, outline, rgba, type Paint } from "./palette";

/**
 * Map objects that stand for story events, so the dungeon shows a cracked tablet, a monster
 * nest, an ore vein or a merchant's cart instead of a floating "!" or "?".
 * Every prop is drawn on a 32x32 canvas; its base sits around y = 29, centred on x = 16,
 * and it is drawn over the event's tile plus the tiles above and beside it.
 */

export interface PropCtx {
  el: Element;
  accent: string; // floor accent colour
  sig: string; // floor signature material colour
  stone: string; // floor cliff / rock colour
  seed: number;
}

type Drawer = (p: Paint, c: PropCtx) => void;

const WOOD = "#9a6a3a", DARK = "#5a3a22", BONE = "#e8e0c8", STONE = "#8a8a92";
const EL_COL: Record<Element, string> = {
  physical: "#c8b8a0", fire: "#ff6a2a", ice: "#8ad8ff", lightning: "#ffe14a", water: "#3a9ae0", earth: "#b08a4a",
  wind: "#9ef0c0", light: "#fff0a0", dark: "#8a5ac0", poison: "#9aff3a", arcane: "#c890ff",
};

function shadow(p: Paint, cx: number, cy: number, rx: number, ry = 2.5) {
  p.g.fillStyle = "rgba(20,10,40,.28)";
  p.g.beginPath();
  p.g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  p.g.fill();
}
function glow(p: Paint, x: number, y: number, r: number, col: string, a = 0.28) {
  const g = p.g.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  p.g.fillStyle = g;
  p.g.fillRect(x - r, y - r, r * 2, r * 2);
}
function box(p: Paint, x: number, y: number, w: number, h: number, col: string) {
  p.rect(x, y, w, h, col);
  p.rect(x, y, w, 1, hs(col, 0.3));
  p.rect(x, y, 1, h, hs(col, 0.15));
  p.rect(x + w - 1, y, 1, h, hs(col, -0.25));
  p.rect(x, y + h - 1, w, 1, outline(col));
}
function sparkle(p: Paint, x: number, y: number, col: string) {
  p.px(x, y, "#ffffff"); p.px(x - 1, y, col); p.px(x + 1, y, col); p.px(x, y - 1, col); p.px(x, y + 1, col);
}
const rnd = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

const D: Record<string, Drawer> = {
  // ---------------------------------------------------------------- world events
  tablet: (p, c) => {
    shadow(p, 16, 29, 9);
    const s = mix(c.stone, STONE, 0.5);
    p.rect(9, 8, 14, 21, outline(s));
    p.rect(10, 9, 12, 19, s);
    p.rect(10, 9, 12, 2, hs(s, 0.3));
    p.rect(20, 11, 2, 17, hs(s, -0.25));
    p.line(17, 9, 14, 16, hs(s, -0.45)); p.line(14, 16, 16, 21, hs(s, -0.45));
    for (const [x, y] of [[12, 13], [15, 13], [18, 13], [12, 18], [17, 18], [12, 23], [15, 23], [18, 23]]) { p.px(x, y, c.accent); p.px(x + 1, y, hs(c.accent, 0.3)); }
    glow(p, 16, 18, 10, c.accent, 0.18);
    p.rect(8, 27, 4, 2, "#4f8a3a"); p.rect(20, 26, 3, 3, "#4f8a3a"); p.px(9, 26, "#6fae4a");
  },
  wisp: (p, c) => {
    const col = mix(c.accent, "#c8e8ff", 0.5);
    glow(p, 16, 16, 14, col, 0.35);
    p.g.globalAlpha = 0.75;
    p.blob(16, 13, 5, 5, col, { outline: false });
    p.rect(11, 14, 10, 9, col);
    for (let x = 11; x < 21; x += 3) p.rect(x, 23, 2, 2 + ((x >> 1) % 2), col);
    p.g.globalAlpha = 1;
    p.rect(13, 12, 2, 2, "#1a1a2a"); p.rect(18, 12, 2, 2, "#1a1a2a");
    sparkle(p, 7, 9, col); sparkle(p, 25, 20, col);
  },
  nest: (p, c) => {
    shadow(p, 16, 28, 13, 3);
    const twig = mix(DARK, c.stone, 0.3);
    p.blob(16, 25, 13, 5, twig);
    p.blob(16, 23, 10, 3, hs(twig, -0.35), { outline: false });
    for (const [x, y] of [[8, 24], [22, 25], [12, 27], [25, 23]]) { p.line(x - 3, y, x + 3, y - 1, hs(twig, 0.25)); }
    for (const [x, y] of [[12, 20], [17, 19], [21, 21]]) p.blob(x, y, 2.5, 3, mix(BONE, c.accent, 0.25));
    p.line(5, 26, 10, 22, BONE, 2); p.px(4, 27, BONE); p.px(11, 21, BONE);
    p.blob(26, 26, 2, 2, BONE); p.px(25, 26, "#2a2a2a"); p.px(27, 26, "#2a2a2a");
  },
  ore_vein: (p, c) => {
    shadow(p, 16, 29, 11);
    const s = mix(c.stone, STONE, 0.4);
    p.blob(16, 22, 11, 8, s);
    p.blob(9, 25, 5, 4, hs(s, -0.1));
    const g = c.sig;
    for (const [x, y, h] of [[13, 13, 8], [17, 11, 10], [21, 15, 6], [10, 19, 5]] as const) {
      p.rect(x, y, 3, h, g); p.rect(x, y, 1, h, hs(g, 0.4)); p.rect(x + 2, y, 1, h, hs(g, -0.3)); p.px(x + 1, y - 1, hs(g, 0.5));
    }
    glow(p, 17, 15, 10, g, 0.3);
    sparkle(p, 23, 12, "#ffffff");
  },
  altar: (p, c) => {
    shadow(p, 16, 29, 10);
    const s = mix(c.stone, "#b8b0a0", 0.5);
    box(p, 8, 24, 16, 5, s);
    box(p, 11, 16, 10, 8, hs(s, 0.1));
    box(p, 9, 14, 14, 3, s);
    const e = EL_COL[c.el];
    glow(p, 16, 9, 11, e, 0.45);
    p.blob(16, 9, 3.5, 4, e);
    p.px(15, 7, "#ffffff");
    p.rect(13, 19, 6, 2, hs(e, -0.2));
  },
  memory: (p, c) => {
    glow(p, 16, 14, 15, "#ffe8a0", 0.4);
    shadow(p, 16, 29, 6, 1.5);
    const pg = "#f4ead0";
    p.rect(9, 9, 7, 10, pg); p.rect(16, 9, 7, 10, hs(pg, -0.08));
    p.rect(15, 9, 2, 10, hs(pg, -0.3));
    for (let y = 11; y < 18; y += 2) { p.rect(10, y, 4, 1, "#8a7a5a"); p.rect(18, y, 4, 1, "#8a7a5a"); }
    p.rect(9, 19, 14, 1, outline(pg));
    sparkle(p, 7, 7, "#ffe070"); sparkle(p, 25, 11, "#ffe070"); sparkle(p, 20, 23, c.accent);
  },
  // ---------------------------------------------------------------- hazards
  lava_crack: (p) => {
    p.blob(16, 25, 13, 4, "#3a1a14", { outline: false });
    p.line(5, 25, 13, 24, "#ff6a1a", 2); p.line(13, 24, 19, 27, "#ff8a2a", 2); p.line(19, 27, 27, 24, "#ff6a1a", 2);
    p.line(13, 24, 12, 20, "#ffb030"); glow(p, 16, 24, 12, "#ff6a1a", 0.4);
    for (const [x, y] of [[10, 16], [18, 13], [22, 18]]) { p.px(x, y, "#ffb030"); p.px(x, y - 1, "#ff6a1a"); }
  },
  frost: (p) => {
    shadow(p, 16, 28, 12, 3);
    p.blob(16, 25, 12, 4, "#e8f4ff");
    for (const [x, h] of [[9, 10], [14, 15], [19, 12], [23, 8]]) { p.rect(x, 27 - h, 3, h, "#aee4ff"); p.rect(x, 27 - h, 1, h, "#ffffff"); p.px(x + 1, 26 - h, "#ffffff"); }
    p.blob(17, 7, 8, 4, "#c8d8e8", { outline: false });
    for (const [x, y] of [[10, 12], [16, 14], [22, 11], [13, 17]]) p.px(x, y, "#ffffff");
  },
  lightning_rod: (p) => {
    shadow(p, 16, 29, 5);
    p.column(15, 6, 3, 23, "#8a8a92");
    p.rect(12, 26, 9, 3, "#5a5a62");
    glow(p, 16, 6, 10, "#ffe14a", 0.45);
    p.line(16, 5, 11, 0, "#ffe14a"); p.line(17, 5, 23, 1, "#ffe14a"); p.line(16, 5, 20, 13, "#fff6a0");
    p.px(16, 5, "#ffffff");
  },
  rapids: (p) => {
    p.blob(16, 24, 14, 5, "#2a6ab0", { outline: false });
    for (const [x, y] of [[7, 23], [14, 25], [21, 22], [25, 26]]) p.line(x, y, x + 4, y - 1, "#c8ecff");
    p.blob(12, 22, 4, 3, STONE); p.blob(22, 25, 3, 2, hs(STONE, -0.1));
    for (const [x, y] of [[8, 19], [18, 18], [26, 21]]) sparkle(p, x, y, "#8ad0ff");
  },
  boulders: (p, c) => {
    shadow(p, 16, 29, 13);
    const s = mix(c.stone, STONE, 0.5);
    p.blob(11, 23, 7, 6, s); p.blob(21, 24, 6, 5, hs(s, -0.1)); p.blob(16, 16, 6, 5, hs(s, 0.08));
    for (const [x, y] of [[6, 28], [26, 28], [14, 29]]) p.blob(x, y, 1.5, 1.2, hs(s, -0.2));
    p.line(14, 16, 17, 20, hs(s, -0.4));
  },
  rope_bridge: (p) => {
    for (const x of [6, 25]) { p.column(x, 12, 3, 17, WOOD); p.px(x + 1, 11, hs(WOOD, 0.3)); }
    p.line(8, 14, 25, 14, "#c8a060"); p.line(8, 18, 25, 18, "#c8a060");
    for (let x = 9; x < 25; x += 3) p.rect(x, 19, 2, 3, hs(WOOD, 0.1));
    for (const [x, y] of [[12, 8], [20, 6]]) { p.line(x, y, x + 5, y - 1, "#e0fff0"); }
  },
  glare: (p) => {
    glow(p, 16, 15, 15, "#fff8d0", 0.6);
    shadow(p, 16, 29, 7);
    p.rect(13, 8, 6, 20, "#fffbe0"); p.rect(13, 8, 2, 20, "#ffffff"); p.rect(17, 8, 2, 20, "#e8e0a0");
    p.px(15, 6, "#ffffff"); p.px(16, 7, "#ffffff");
    for (const [x, y] of [[6, 10], [26, 14], [9, 22], [24, 5]]) sparkle(p, x, y, "#fff0a0");
  },
  shadow_mist: (p) => {
    for (let i = 0; i < 5; i++) { p.g.globalAlpha = 0.35; p.blob(8 + i * 4, 22 - (i % 2) * 4, 6, 5, "#1a1028", { outline: false }); }
    p.g.globalAlpha = 1;
    p.rect(12, 18, 2, 1, "#ff4a6a"); p.rect(18, 18, 2, 1, "#ff4a6a");
    p.px(8, 24, "#c8a0ff"); p.px(24, 15, "#c8a0ff");
  },
  poison_mist: (p) => {
    p.blob(16, 26, 10, 3, "#3a4a1a", { outline: false });
    for (const [x, y, r] of [[12, 20, 4], [19, 16, 5], [14, 11, 3], [22, 9, 2.5]] as const) { p.g.globalAlpha = 0.6; p.blob(x, y, r, r, "#9aff3a", { outline: false }); }
    p.g.globalAlpha = 1;
    for (const [x, y] of [[10, 24], [16, 25], [21, 23]]) { p.px(x, y, "#d8ff6a"); }
  },
  rift: (p, c) => {
    glow(p, 16, 16, 14, "#c890ff", 0.45);
    p.line(16, 3, 13, 12, "#2a0a3a", 3); p.line(13, 12, 18, 20, "#2a0a3a", 3); p.line(18, 20, 15, 28, "#2a0a3a", 3);
    p.line(16, 3, 13, 12, "#e8c8ff"); p.line(13, 12, 18, 20, "#e8c8ff"); p.line(18, 20, 15, 28, "#e8c8ff");
    for (const [x, y] of [[8, 9], [23, 14], [10, 23]]) sparkle(p, x, y, c.accent);
  },
  sinkhole: (p) => {
    p.blob(16, 24, 12, 5, "#3a2a1a");
    p.blob(16, 25, 9, 3, "#0e0806", { outline: false });
    for (const [x, y] of [[5, 23], [26, 26], [9, 28]]) p.blob(x, y, 1.5, 1, "#7a6a5a");
  },
  // ---------------------------------------------------------------- wandering events
  cart: (p) => {
    shadow(p, 16, 29, 12);
    box(p, 5, 14, 20, 9, WOOD);
    p.rect(6, 10, 18, 4, "#e8d8a8"); p.rect(6, 10, 18, 1, "#fff0c8");
    for (const [x, col] of [[8, "#c83a3a"], [13, "#3a8a3a"], [18, "#e0a040"]] as const) p.blob(x + 1, 12, 2, 2, col);
    for (const x of [9, 21]) { p.blob(x, 25, 3.5, 3.5, DARK); p.px(x, 25, "#c8a060"); }
    p.line(25, 20, 30, 22, DARK, 2);
  },
  shrine: (p, c) => {
    shadow(p, 16, 29, 9);
    box(p, 10, 16, 12, 12, mix(c.stone, "#b8b0a0", 0.4));
    p.rect(8, 12, 16, 3, "#a83a2a"); p.rect(10, 10, 12, 2, "#c84a3a");
    p.rect(14, 19, 4, 6, "#2a1a14");
    glow(p, 16, 21, 5, "#ffd070", 0.6); p.px(16, 21, "#ffe070");
    p.rect(9, 27, 2, 2, "#6fae4a");
  },
  bait: (p) => {
    shadow(p, 16, 28, 8);
    for (const [x, y] of [[12, 25], [16, 24], [19, 26], [14, 27], [17, 21]]) { p.blob(x, y, 2, 1.3, "#f2c542"); p.px(x - 1, y - 1, "#fff0a0"); }
    p.blob(22, 23, 3, 3, BONE); p.px(21, 23, "#2a2a2a"); p.px(23, 23, "#2a2a2a");
    p.rect(8, 28, 16, 1, "rgba(0,0,0,.25)");
    sparkle(p, 11, 18, "#ffe070");
  },
  chest: (p) => {
    shadow(p, 16, 29, 10);
    box(p, 7, 17, 18, 11, "#a86a2a");
    p.blob(16, 17, 9, 4, "#c88a3a");
    p.rect(7, 20, 18, 2, "#e0b050"); p.rect(14, 19, 4, 5, "#f2c542"); p.px(15, 21, "#2a1a0a");
    p.px(10, 25, "#2a1a0a"); p.px(21, 25, "#2a1a0a");
  },
  bushes: (p) => {
    shadow(p, 16, 29, 13);
    p.blob(10, 23, 7, 6, "#3f7a3a"); p.blob(21, 22, 8, 7, "#4a8a3a"); p.blob(16, 18, 6, 5, "#5aa04a");
    p.px(9, 21, "#ffe060"); p.px(12, 21, "#ffe060"); p.px(21, 19, "#ff5050"); p.px(24, 19, "#ff5050");
  },
  dice_table: (p) => {
    shadow(p, 16, 29, 11);
    box(p, 6, 17, 20, 4, WOOD);
    for (const x of [8, 22]) p.rect(x, 21, 2, 7, DARK);
    box(p, 10, 13, 4, 4, BONE); box(p, 16, 12, 4, 4, BONE);
    p.px(11, 14, "#2a2a2a"); p.px(12, 15, "#2a2a2a"); p.px(18, 14, "#2a2a2a");
    p.blob(25, 12, 3, 3, BONE); p.px(24, 12, "#2a2a2a"); p.px(26, 12, "#2a2a2a");
  },
  crates: (p) => {
    shadow(p, 16, 29, 12);
    box(p, 5, 18, 10, 10, "#b08050"); p.line(5, 18, 14, 27, "#7a5030");
    box(p, 15, 20, 11, 8, "#a07040"); box(p, 10, 11, 9, 8, "#c09060");
    p.blob(24, 15, 3, 4, "#6a4a8a"); p.rect(23, 11, 3, 2, "#4a3a6a");
  },
  statue: (p, c) => {
    shadow(p, 16, 29, 9);
    const s = mix(c.stone, "#c8c8c8", 0.6);
    box(p, 9, 24, 14, 5, hs(s, -0.1));
    p.rect(12, 12, 8, 12, s); p.rect(12, 12, 2, 12, hs(s, 0.3));
    p.blob(16, 8, 4, 4, s);
    p.line(12, 14, 8, 19, s, 2); p.line(20, 14, 24, 10, s, 2);
    p.rect(15, 26, 2, 1, hs(s, -0.4));
  },
  // ---------------------------------------------------------------- hand-written floors
  whisper_tree: (p) => {
    shadow(p, 16, 29, 9);
    p.column(13, 14, 7, 15, "#6a4a2a");
    p.blob(16, 10, 11, 8, "#3f8a3a"); p.blob(11, 8, 5, 4, "#5aaa4a");
    p.rect(14, 18, 2, 2, "#1a0a0a"); p.rect(18, 18, 2, 2, "#1a0a0a"); p.rect(15, 22, 4, 1, "#1a0a0a");
  },
  fireflies: (p) => {
    for (const [x, y] of [[8, 12], [14, 7], [21, 11], [25, 18], [11, 19], [18, 16], [6, 23], [23, 25]]) { glow(p, x, y, 4, "#e8ff6a", 0.5); p.px(x, y, "#f8ffc0"); }
    for (let x = 4; x < 28; x += 3) p.line(x, 29, x + 1, 25 + (x % 3), "#4a9a3a");
  },
  signpost: (p) => {
    shadow(p, 16, 29, 5);
    p.column(15, 10, 3, 19, WOOD);
    box(p, 7, 11, 12, 5, "#c89a60"); box(p, 14, 17, 12, 5, "#b88a50");
    p.rect(9, 13, 7, 1, DARK); p.rect(16, 19, 7, 1, DARK);
    p.blob(10, 7, 4, 3, "#c83a3a"); p.px(9, 6, "#ffffff"); p.px(12, 7, "#ffffff");
  },
  spring: (p) => {
    p.blob(16, 25, 12, 4, "#6a6a72");
    p.blob(16, 25, 10, 3, "#4aa0e0", { outline: false });
    p.rect(9, 24, 5, 1, "#c8ecff");
    for (const [x, y] of [[16, 18], [14, 14], [18, 12]]) { p.px(x, y, "#8ad0ff"); p.px(x, y + 1, "#4aa0e0"); }
    p.rect(22, 20, 2, 6, "#4f8a3a"); p.px(22, 19, "#6fae4a");
  },
  tent: (p) => {
    shadow(p, 16, 29, 12);
    p.g.fillStyle = "#b8905a"; p.g.beginPath(); p.g.moveTo(16, 7); p.g.lineTo(3, 28); p.g.lineTo(29, 28); p.g.closePath(); p.g.fill();
    p.g.fillStyle = "#8a6a3a"; p.g.beginPath(); p.g.moveTo(16, 7); p.g.lineTo(16, 28); p.g.lineTo(29, 28); p.g.closePath(); p.g.fill();
    p.g.fillStyle = "#2a1a10"; p.g.beginPath(); p.g.moveTo(16, 15); p.g.lineTo(12, 28); p.g.lineTo(20, 28); p.g.closePath(); p.g.fill();
    p.line(16, 7, 16, 3, DARK);
  },
  palm_pool: (p) => {
    p.blob(18, 26, 11, 3, "#3a9ac0");
    p.column(8, 10, 3, 18, "#9a6a3a");
    for (const [dx, dy] of [[-7, 2], [7, 2], [-4, -3], [5, -3]]) p.line(9, 10, 9 + dx, 10 + dy, "#3f9a3a", 2);
    p.blob(9, 11, 2, 2, "#8a5a2a");
  },
  gate_arch: (p, c) => {
    const s = mix(c.stone, "#d8c090", 0.5);
    for (const x of [5, 22]) box(p, x, 8, 5, 21, s);
    box(p, 4, 5, 24, 5, hs(s, 0.1));
    p.rect(10, 10, 12, 19, "rgba(20,10,5,.55)");
    p.rect(13, 6, 6, 3, "#c8a040");
  },
  graves: (p) => {
    for (const [x, y] of [[8, 18], [18, 16], [23, 21]]) { shadow(p, x + 3, y + 11, 4, 1.5); box(p, x, y, 6, 11, "#8a8a92"); p.blob(x + 3, y, 3, 2, "#9a9aa2"); p.rect(x + 2, y + 3, 2, 1, "#5a5a62"); }
    p.px(12, 29, "#c83a3a"); p.px(13, 28, "#6fae4a");
  },
  whirl: (p) => {
    for (let i = 0; i < 4; i++) { p.g.strokeStyle = rgba("#e8c890", 0.7 - i * 0.12); p.g.lineWidth = 2; p.g.beginPath(); p.g.ellipse(16, 26 - i * 6, 4 + i * 3, 2 + i, 0, 0, Math.PI * 1.6); p.g.stroke(); }
    for (const [x, y] of [[7, 10], [24, 14], [12, 5]]) p.px(x, y, "#c8a060");
  },
  boat: (p) => {
    p.blob(16, 27, 13, 2, "rgba(30,60,80,.6)", { outline: false });
    p.g.fillStyle = "#7a5030"; p.g.beginPath(); p.g.moveTo(3, 20); p.g.lineTo(29, 20); p.g.lineTo(25, 26); p.g.lineTo(7, 26); p.g.closePath(); p.g.fill();
    p.rect(3, 20, 26, 1, "#a87a4a");
    p.column(15, 8, 2, 12, DARK);
    glow(p, 20, 10, 5, "#ffb030", 0.6); p.rect(19, 9, 3, 3, "#ffc850");
  },
  stilt_hut: (p) => {
    for (const x of [8, 22]) p.rect(x, 20, 2, 9, DARK);
    box(p, 6, 13, 20, 8, "#7a8a4a");
    p.g.fillStyle = "#a89a5a"; p.g.beginPath(); p.g.moveTo(16, 3); p.g.lineTo(3, 14); p.g.lineTo(29, 14); p.g.closePath(); p.g.fill();
    p.rect(14, 15, 4, 6, "#2a2a1a");
    p.blob(16, 27, 12, 2, "rgba(40,60,50,.5)", { outline: false });
  },
  bell: (p) => {
    for (const x of [7, 24]) p.column(x, 5, 2, 24, DARK);
    p.rect(6, 4, 21, 2, WOOD);
    p.blob(16, 15, 6, 7, "#b08a3a"); p.rect(10, 19, 13, 2, "#8a6a2a"); p.px(16, 22, "#6a4a1a");
    p.px(13, 11, "#f0d070");
    p.blob(16, 28, 12, 1.5, "rgba(30,60,60,.5)", { outline: false });
  },
  lanterns: (p) => {
    for (const [x, y] of [[9, 12], [17, 8], [23, 15], [13, 19]]) { glow(p, x, y, 6, "#ffb030", 0.45); box(p, x - 2, y - 2, 5, 6, "#e8702a"); p.rect(x - 1, y - 1, 3, 3, "#ffd070"); p.px(x, y - 3, DARK); }
    p.blob(16, 28, 12, 1.5, "rgba(20,30,40,.5)", { outline: false });
  },
  // ---------------------------------------------------------------- the gatekeeper's lair
  brazier: (p) => {
    shadow(p, 16, 29, 6);
    p.column(14, 18, 4, 11, "#4a4038");
    p.rect(10, 15, 12, 4, "#6a5a4a"); p.rect(10, 15, 12, 1, "#8a7a6a");
    glow(p, 16, 11, 11, "#ff8a2a", 0.55);
    p.blob(16, 12, 4, 5, "#ff6a1a", { outline: false }); p.blob(16, 13, 2, 3, "#ffd070", { outline: false });
    p.px(14, 6, "#ffb030"); p.px(18, 8, "#ffb030");
  },
  bone_pile: (p) => {
    shadow(p, 16, 28, 11, 3);
    for (const [x0, y0, x1, y1] of [[6, 27, 14, 23], [12, 28, 22, 25], [18, 23, 26, 27], [9, 24, 17, 26]]) p.line(x0, y0, x1, y1, BONE, 2);
    p.blob(16, 21, 3.5, 3, BONE); p.px(15, 21, "#2a2a2a"); p.px(17, 21, "#2a2a2a");
    p.blob(24, 24, 2.5, 2, BONE); p.px(23, 24, "#2a2a2a");
  },
  banner: (p, c) => {
    shadow(p, 16, 29, 4);
    p.column(15, 4, 2, 25, DARK);
    p.rect(17, 6, 9, 12, hs(c.accent, -0.35)); p.rect(17, 6, 9, 1, c.accent);
    p.g.fillStyle = hs(c.accent, -0.35); p.g.beginPath(); p.g.moveTo(17, 18); p.g.lineTo(26, 18); p.g.lineTo(21, 22); p.g.closePath(); p.g.fill();
    p.blob(21, 11, 2.5, 2.5, "#1a1a1a", { outline: false }); p.px(20, 11, c.accent); p.px(22, 11, c.accent);
  },
  campfire_tent: (p) => { D.tent(p, {} as PropCtx); glow(p, 26, 27, 5, "#ff8a2a", 0.6); p.px(26, 27, "#ffd070"); },
};

/** [prop, person?] for each hand-written or generic event id. */
const FIXED: Record<string, string> = {
  g_merchant: "person:merchant", g_shrine: "shrine", g_trap: "bait", g_wounded: "person:wounded", g_mimic: "chest",
  g_ambush: "bushes", g_lost_soul: "wisp", g_gamble: "dice_table", g_cache: "crates", g_statue: "statue",
  f1_whisper: "whisper_tree", f1_fireflies: "fireflies", f1_lyra: "person:lyra", f1_village: "signpost", f1_tears: "spring", f1_hunter_camp: "campfire_tent",
  f2_caravan: "cart", f2_oasis: "palm_pool", f2_zahr: "gate_arch", f2_amber: "ore_vein", f2_graveyard: "graves", f2_storm: "whirl",
  f3_ferry: "boat", f3_morwen: "person:morwen", f3_frogs: "stilt_hut", f3_bell: "bell", f3_lanterns: "lanterns", f3_kaito: "person:kaito",
};
const HAZARD: Record<Element, string> = {
  fire: "lava_crack", ice: "frost", lightning: "lightning_rod", water: "rapids", earth: "boulders", wind: "rope_bridge",
  light: "glare", dark: "shadow_mist", poison: "poison_mist", arcane: "rift", physical: "sinkhole",
};

/** What stands on the map for an event: a prop to draw, or a person (sprite id). */
export function eventLook(eventId: string, ctx: PropCtx, portrait?: string): { prop: string } | { person: string } {
  const fixed = FIXED[eventId] ?? ROADSIDE_META[eventId]?.look;
  if (fixed) return fixed.startsWith("person:") ? { person: fixed.slice(7) } : { prop: fixed };
  const m = /^([a-z]+)\d+$/.exec(eventId);
  switch (m?.[1]) {
    case "lore": return { prop: "tablet" };
    case "echo": return { prop: "wisp" };
    case "nest": return { prop: "nest" };
    case "hazard": return { prop: HAZARD[ctx.el] ?? "sinkhole" };
    case "vein": return { prop: "ore_vein" };
    case "native": return { person: "native" };
    case "altar": return { prop: "altar" };
    case "beat": return portrait && portrait !== "villager" && portrait !== "sprout" ? { person: portrait } : { prop: "memory" };
    default: return { prop: "memory" };
  }
}

const cache = new Map<string, HTMLCanvasElement>();
export function propCanvas(prop: string, ctx: PropCtx): HTMLCanvasElement {
  const key = `${prop}|${ctx.el}|${ctx.accent}|${ctx.sig}|${ctx.stone}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, p] = makeCanvas(32, 32);
  (D[prop] ?? D.memory)(p, ctx);
  cache.set(key, c);
  return c;
}

/** A villager look for people met on the road (natives, merchants, the wounded). */
export function roadsidePal(seed: string): Record<string, string> {
  const r = rnd(hashString(seed));
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  return {
    h: pick(["#2a1a12", "#6b3f22", "#c8a060", "#e8e0d0", "#b04a2a", "#3a3a4a", "#3a6b3a", "#f0d26a"]),
    c: pick(["#3b6fd6", "#7b4bc4", "#3e8a3a", "#a33a3a", "#d8c090", "#b0763a", "#5a8ac0", "#e0a040"]),
    b: pick(["#6a4a2a", "#3a3a4a", "#4a5a3a", "#6a2a2a"]),
    p: pick(["#4a3a2a", "#2a2a3a", "#5a4a3a"]),
    s: pick(["#f5d6b8", "#e8b890", "#c68a5a", "#8a5a3a", "#efe0c0"]),
    g: r() < 0.5 ? "f" : "m",
  };
}

export const PROP_IDS = Object.keys(D);
