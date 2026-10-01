import { hs } from "./palette";
import { K, type Sprite } from "./parts";

/**
 * Hand-drawn gatekeepers of the milestone floors (10, 20 ... 100). They are shown at twice
 * the size of normal monsters, so they get the whole 32x32 canvas. Keyed by enemy id.
 */
type Draw = (s: Sprite) => void;
const GOLD = "#e8b030";

function gear(s: Sprite, x: number, y: number, r: number, c: string) {
  s.part((m) => m.ell(x, y, r, r), c, { k: 1.2 });
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; s.part((m) => m.ell(x + Math.cos(t) * (r + 0.6), y + Math.sin(t) * (r + 0.6), 0.9, 0.9), c, { seam: false, k: 1.2 }); }
  s.part((m) => m.ell(x, y, r * 0.35, r * 0.35), hs(c, -0.5), { flat: true, seam: false });
}

export const BOSS_ART: Record<string, Draw> = {
  // floor 10: a clockwork lord
  boss10: (s) => {
    const brass = "#c89a3a";
    gear(s, 5, 7, 3.5, hs(brass, -0.2));
    gear(s, 27, 9, 3, hs(brass, -0.2));
    s.part((m) => m.limb(12, 23, 11, 30, 2.4, 2.2), hs(brass, -0.25));
    s.part((m) => m.limb(20, 23, 21, 30, 2.4, 2.2), brass);
    s.part((m) => m.path([[9, 13], [5, 18], [5, 23]], 2, 1.8), hs(brass, -0.2));
    s.part((m) => m.path([[23, 13], [27, 18], [27, 23]], 2, 1.8), brass);
    gear(s, 5, 25, 2.2, brass); gear(s, 27, 25, 2.2, brass);
    s.part((m) => m.ell(16, 17, 8, 8), brass, { k: 1.3 });
    s.part((m) => m.ell(16, 17, 6, 6), "#f4ecd0", { k: 0.4 });
    for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; s.px(16 + Math.cos(t) * 5, 17 + Math.sin(t) * 5, k % 3 ? "#8a7a5a" : K); }
    s.line(16, 17, 16, 13, K); s.line(16, 17, 19, 18, "#a83a2a");
    s.px(16, 17, GOLD);
    s.part((m) => m.limb(16, 25, 16, 29, 0.5, 0.5), "#8a6a2a", { seam: false });
    s.part((m) => m.ell(16, 29.5, 1.6, 1.4), GOLD);
    s.part((m) => m.rect(12, 4, 8, 6), brass, { k: 1.3 });
    s.part((m) => m.rect(13, 6, 6, 2), "#ffe8a0", { flat: true, seam: false });
    s.px(14, 6, "#ffffff"); s.px(17, 6, "#ffffff");
    for (const x of [12, 15, 18]) s.part((m) => m.poly([[x, 4], [x + 1, 0.5], [x + 2, 4]]), GOLD, { k: 0.8 });
  },
  // floor 20: the undying pharaoh
  boss20: (s) => {
    const linen = "#dcd0b0", lapis = "#6a3ad8";
    s.part((m) => m.limb(13, 23, 12, 30, 2.2, 1.9), "#b8aa88");
    s.part((m) => m.limb(19, 23, 20, 30, 2.3, 2), linen);
    for (let y = 22; y < 31; y += 2) s.line(10, y, 22, y - 1, "#a89a78", true);
    s.part((m) => m.poly([[10, 12], [22, 12], [23, 24], [9, 24]]), linen, { k: 1.1 });
    for (let y = 13; y < 24; y += 2) s.line(9, y + 1, 23, y - 1, "#a89a78", true);
    s.part((m) => m.ell(16, 13.5, 6.5, 2.4), GOLD, { k: 1.1 });
    for (let x = 11; x <= 21; x += 2) s.on(x, 13, lapis);
    s.part((m) => m.ell(16, 18, 1.8, 1.6), "#3aa8a0", { k: 0.6 });
    // crook and flail held crossed
    s.part((m) => m.path([[7, 26], [10, 14], [8, 9], [6, 10]], 0.6, 0.6), GOLD, { seam: false });
    s.part((m) => m.path([[25, 26], [22, 14]], 0.6, 0.6), GOLD, { seam: false });
    for (const [x, y] of [[23, 13], [25, 14], [27, 13]]) s.line(22, 14, x, y + 3, lapis);
    s.part((m) => m.path([[11, 14], [12, 18], [15, 19]], 1.4, 1.2), "#c8bc9a");
    s.part((m) => m.path([[21, 14], [20, 18], [17, 19]], 1.4, 1.2), linen);
    // striped headdress and golden mask
    s.part((m) => m.poly([[9, 13], [10, 5], [16, 1.5], [22, 5], [23, 13], [20, 10], [12, 10]]), GOLD, { k: 1.1 });
    for (const y of [4, 7, 10]) s.line(9, y + 1, 23, y + 1, lapis, true);
    s.part((m) => m.ell(16, 7.5, 3.6, 4), "#f2c23a", { k: 1.2 });
    s.part((m) => m.rect(13, 6.5, 6, 1.4), "#1a1226", { flat: true, seam: false });
    s.glow(14, 7, "#c87aff"); s.glow(18, 7, "#c87aff");
    s.part((m) => m.limb(16, 11, 16, 13, 0.6, 0.4), lapis);
    s.part((m) => m.ell(16, 2, 1, 1.2), "#3aa8a0", { flat: true });
  },
  // floor 30: the guardian who cradles a sprout
  boss30: (s) => {
    const bark = "#6a4a2a", leaf = "#8ad86a";
    s.part((m) => m.path([[11, 24], [7, 28], [3, 30]], 2.6, 1), bark);
    s.part((m) => m.path([[21, 24], [25, 28], [29, 30]], 2.6, 1), bark);
    s.part((m) => m.poly([[8, 9], [24, 9], [25, 27], [7, 27]]), hs(bark, 0.08), { k: 1.1 });
    for (const x of [10, 13, 19, 22]) s.line(x, 11, x + ((x * 3) % 3) - 1, 26, hs(bark, -0.3), true);
    // the hollow with the sprout, glowing
    s.part((m) => m.ell(16, 19, 4.5, 4.5), "#2a1a0e", { flat: true, seam: false });
    s.part((m) => m.ell(16, 21, 3, 1.2), "#5a3a1e", { flat: true, seam: false });
    s.part((m) => m.limb(16, 21, 16, 17, 0.5, 0.4), "#5aa83a", { seam: false });
    s.part((m) => m.ell(14.5, 16.5, 1.6, 0.9), leaf, { seam: false });
    s.part((m) => m.ell(17.5, 16, 1.6, 0.9), leaf, { seam: false });
    for (const [x, y] of [[13, 15], [19, 18], [15, 22], [18, 14]]) s.px(x, y, "#fff0a0", true);
    // arms curled protectively around the hollow
    s.part((m) => m.path([[8, 13], [4, 18], [7, 23], [12, 23]], 2.2, 1.6), bark);
    s.part((m) => m.path([[24, 13], [28, 18], [25, 23], [20, 23]], 2.2, 1.6), bark);
    s.part((m) => m.ell(6, 7, 5.5, 4.5), "#4a8a3a");
    s.part((m) => m.ell(26, 7, 5.5, 4.5), "#4a8a3a");
    s.part((m) => m.ell(16, 5, 10, 5), "#5aa83a");
    s.part((m) => m.ell(12, 2.5, 4, 2.2), leaf, { k: 0.8 });
    s.part((m) => m.ell(21, 3, 3.6, 2.2), leaf, { k: 0.8 });
    for (const [x, y] of [[5, 6], [9, 3], [15, 1], [22, 5], [27, 7], [18, 7]]) s.px(x, y, "#c8f0a0");
    s.part((m) => m.ell(12.5, 12, 1.6, 1), "#1a120a", { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 12, 1.6, 1), "#1a120a", { flat: true, seam: false });
    s.px(12, 12, leaf, true); s.px(19, 12, leaf, true);
  },
  // floor 40: the bell-ringer
  boss40: (s) => {
    const robe = "#e8e0d0", bronze = "#b8843a";
    s.part((m) => m.limb(22, 0, 22, 9, 0.5, 0.5), "#8a7a5a", { seam: false });
    s.part((m) => m.poly([[11, 8], [21, 8], [25, 21], [27, 30], [23, 27], [20, 31], [16, 27], [12, 31], [9, 27], [5, 30], [8, 18]]), robe, { k: 0.9 });
    for (const x of [11, 15, 19]) s.line(x, 14, x - 1 + (x > 16 ? 2 : 0), 28, hs(robe, -0.3), true);
    s.part((m) => m.ell(16, 8.5, 6, 6), hs(robe, -0.1));
    s.part((m) => m.ell(17.5, 9.5, 3.4, 3.8), "#0e0a16", { flat: true, seam: false });
    s.glow(16, 9, "#ffe8a0"); s.glow(19, 9, "#ffe8a0");
    // the great bell, held up by the rope
    s.part((m) => m.poly([[18, 13], [26, 13], [28, 23], [29.5, 25], [14.5, 25], [16, 23]]), bronze, { k: 1.3 });
    s.part((m) => m.ell(22, 13, 4, 1.6), hs(bronze, 0.2));
    s.line(15, 23, 29, 23, hs(bronze, -0.45), true);
    s.line(17, 17, 27, 17, hs(bronze, -0.35), true);
    s.part((m) => m.ell(22, 26.5, 1.6, 1.6), hs(bronze, -0.3));
    s.part((m) => m.path([[11, 15], [14, 13], [18, 12]], 1.3, 1), robe);
    for (const [x, y] of [[12, 27], [31, 21], [30, 15], [13, 21]]) s.px(x, y, "#fff4c0", true);
    for (let k = 0; k < 5; k++) s.px(4 + k * 0.6, 11 - k, k % 2 ? "#ffe8a0" : "#fff4c0", true);
  },
  // floor 50: the first to press a flower
  boss50: (s) => {
    const robe = "#8a8070", page = "#f2e8cc";
    s.part((m) => m.poly([[10, 10], [21, 11], [24, 22], [26, 30], [6, 30], [8, 19]]), robe, { k: 1.1 });
    for (const x of [10, 14, 19, 23]) s.line(x, 14, x - 1, 29, hs(robe, -0.35), true);
    s.part((m) => m.ell(15, 8, 5, 5), hs(robe, -0.15));
    s.part((m) => m.ell(17, 9, 3, 3.4), "#2a2018", { flat: true, seam: false });
    s.px(16, 9, "#e8d8a0", true); s.px(18, 9, "#e8d8a0", true);
    // the open book of pressed flowers
    s.part((m) => m.poly([[15, 15], [22, 13], [29, 15], [29, 22], [22, 20], [15, 22]]), "#6a3a2a", { k: 1.1 });
    s.part((m) => m.poly([[16, 15.5], [22, 14], [22, 20], [16, 21]]), page, { k: 0.4 });
    s.part((m) => m.poly([[22, 14], [28, 15.5], [28, 21], [22, 20]]), page, { k: 0.4 });
    s.line(22, 14, 22, 20, "#8a6a4a");
    for (const [x, y, c] of [[18, 17, "#e85a7a"], [25, 17, "#e8a03a"], [19, 19, "#5aa83a"], [26, 19, "#8a5ac8"]] as const) { s.px(x, y, c, true); s.px(x + 1, y, c, true); s.px(x, y - 1, c, true); }
    s.part((m) => m.path([[19, 14], [22, 13]], 1, 0.8), robe);
    for (const [x, y] of [[28, 14], [29, 13]]) s.px(x, y, "#d8d0c0");
    // autumn leaves drifting
    for (const [x, y, c] of [[3, 5, "#e8702a"], [6, 13, "#c8401a"], [28, 5, "#f2b52a"], [2, 22, "#e8702a"], [30, 26, "#c8401a"]] as const) { s.px(x, y, c, true); s.px(x + 1, y + 1, c, true); }
  },
  // floor 60: the thing under the bed
  boss60: (s) => {
    const wood = "#7a4a3a", sheet = "#e8d8f0", dark = "#1a1226";
    s.part((m) => m.rect(2, 20, 28, 9), "#100a18", { flat: true });
    s.part((m) => m.rect(1, 9, 3, 22), wood, { k: 1.2 });
    s.part((m) => m.rect(28, 13, 3, 18), wood, { k: 1.2 });
    s.part((m) => m.ell(2.5, 8.5, 2, 1.6), wood);
    s.part((m) => m.poly([[3, 15], [29, 15], [30, 21], [2, 21]]), sheet, { k: 0.8 });
    for (const x of [8, 14, 20, 26]) s.line(x, 16, x - 1, 21, "#b8a8d0", true);
    s.part((m) => m.ell(8, 13.5, 4, 2), "#f4ecf8", { k: 0.5 });
    s.part((m) => m.poly([[13, 15], [29, 14], [30, 18], [12, 18]]), "#ff9ac8", { k: 0.8 });
    // eyes and claws in the dark underneath
    for (const [x, y] of [[8, 24], [11, 24], [18, 25], [21, 25], [25, 23]]) { s.px(x, y, "#ffe040", true); s.px(x, y + 1, "#c89a10", true); }
    s.part((m) => m.ell(15, 27.5, 4, 1), dark, { flat: true });
    for (let x = 12; x < 19; x += 2) s.px(x, 27, "#f4ead8", true);
    for (const [x0, x1] of [[6, 4], [24, 27]]) s.part((m) => m.path([[x0, 22], [x1, 25], [x1 + (x1 > 16 ? 1 : -1), 30]], 0.9, 0.5), "#3a2a5a");
    s.part((m) => m.path([[10, 21], [8, 18], [9, 16]], 0.8, 0.5), "#3a2a5a");
    for (const [x, y] of [[8, 15], [10, 15], [9, 14]]) s.px(x, y, "#f4ead8", true);
    s.px(2, 3, "#ffb8d8", true); s.px(26, 5, "#ffb8d8", true); s.px(18, 3, "#ff8ab8", true);
  },
  // floor 70: the keeper of the star gate
  boss70: (s) => {
    const stone = "#9a9a7a", glow = "#fff0c0";
    for (let k = 0; k < 64; k++) { const t = (k / 64) * Math.PI * 2; s.px(16 + Math.cos(t) * 14, 14 + Math.sin(t) * 13, k % 4 ? "#c8b878" : glow, true); }
    for (const [x, y] of [[4, 4], [28, 3], [2, 20], [30, 22], [16, 0.5]]) { s.px(x, y, "#ffffff", true); s.px(x - 1, y, glow, true); s.px(x + 1, y, glow, true); s.px(x, y - 1, glow, true); s.px(x, y + 1, glow, true); }
    s.part((m) => m.limb(12, 23, 11, 30, 2.6, 2.3), hs(stone, -0.2));
    s.part((m) => m.limb(20, 23, 21, 30, 2.6, 2.3), stone, { k: 1.2 });
    s.part((m) => m.poly([[8, 11], [24, 11], [23, 24], [9, 24]]), stone, { k: 1.3 });
    s.line(16, 12, 16, 23, hs(stone, -0.4), true); s.line(9, 18, 23, 18, hs(stone, -0.4), true);
    s.part((m) => m.ell(16, 15, 2, 2), glow, { k: 0.4 });
    s.part((m) => m.ell(7, 12, 3.5, 2.6), stone, { k: 1.3 });
    s.part((m) => m.ell(25, 12, 3.5, 2.6), stone, { k: 1.3 });
    // key-staff
    s.part((m) => m.limb(27, 30, 27, 6, 0.7, 0.7), "#c8a84a", { seam: false });
    s.part((m) => m.ell(27, 4, 2.4, 2.4), "#c8a84a", { k: 1.1 });
    s.part((m) => m.ell(27, 4, 1, 1), "#1a1226", { flat: true, seam: false });
    s.line(27, 26, 29, 26, "#c8a84a"); s.line(27, 28, 29, 28, "#c8a84a");
    s.part((m) => m.path([[23, 13], [26, 16], [27, 17]], 1.8, 1.5), stone);
    s.part((m) => m.path([[9, 13], [6, 18], [7, 23]], 1.8, 1.5), hs(stone, -0.15));
    s.part((m) => m.ell(16, 6.5, 5, 5), stone, { k: 1.3 });
    s.part((m) => m.rect(13, 6, 7, 1.6), "#1a1226", { flat: true, seam: false });
    s.glow(14, 6, glow); s.glow(18, 6, glow);
    s.part((m) => m.poly([[12, 3], [16, -1], [20, 3]]), "#c8b878", { k: 0.8 });
  },
  // floor 80: the judge of the hands
  boss80: (s) => {
    const robe = "#2a2a3a", hand = "#f4f0ea";
    s.part((m) => m.poly([[10, 9], [22, 9], [26, 30], [6, 30]]), robe, { k: 1.2 });
    for (const x of [11, 16, 21]) s.line(x, 12, x + (x - 16) * 0.4, 29, hs(robe, 0.25), true);
    s.part((m) => m.rect(12, 12, 8, 1.2), hand, { flat: true });
    s.part((m) => m.ell(16, 7, 4.5, 4.5), hs(robe, -0.2));
    s.part((m) => m.ell(16.5, 7.5, 3, 3), "#0a0812", { flat: true, seam: false });
    s.glow(15, 7, "#ffffff"); s.glow(18, 7, "#ffffff");
    s.part((m) => m.poly([[11, 4], [12, -0.5], [20, -0.5], [21, 4]]), hs(robe, -0.1), { k: 1.2 });
    s.part((m) => m.rect(11, 3, 10, 1), hand, { flat: true });
    // the scales of judgement
    s.line(16, 13, 16, 19, "#c8a84a"); s.line(10, 15, 22, 15, "#c8a84a");
    for (const x of [10, 22]) { s.line(x, 15, x - 1.5, 18, "#c8a84a"); s.line(x, 15, x + 1.5, 18, "#c8a84a"); s.part((m) => m.ell(x, 18.5, 2.2, 0.9), "#e8c84a", { k: 1.1 }); }
    // pale hands rising all around
    for (const [x, y, d] of [[3, 9, -1], [29, 9, 1], [2, 20, -1], [30, 20, 1], [7, 3, -1], [25, 3, 1]] as const) {
      s.line(x, y + 1, x - d, y + 5, hs(hand, -0.4));
      s.part((m) => m.ell(x, y, 1.8, 1.6), hand, { k: 0.5 });
      for (const f of [-2, 0, 2]) { s.px(x + f, y - 2, hand, true); s.px(x + f, y - 3, hand, true); }
      s.px(x + d * 2.6, y, hand, true);
    }
  },
  // floor 90: a hedge of thorns closed around something
  boss90: (s) => {
    const vine = "#3a2a2a", leaf = "#c8ff8a";
    s.part((m) => m.ell(16, 16, 6, 6), "#fff0f4", { k: 0.3 });
    s.part((m) => m.ell(16, 16, 3.5, 3.5), "#ffd0e0", { flat: true, seam: false });
    s.px(16, 16, "#ffffff", true);
    for (const [r0, ph] of [[11, 0], [9.5, 1.3], [12.5, 2.4], [8, 3.1]] as const) s.part((m) => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 26; k++) { const t = ph + (k / 26) * Math.PI * 2.2; pts.push([16 + Math.cos(t) * (r0 + Math.sin(t * 3) * 1.5), 16 + Math.sin(t) * (r0 * 0.95 + Math.cos(t * 2))]); }
      m.path(pts, 1.4, 1);
    }, vine, { k: 1.1 });
    for (let k = 0; k < 22; k++) { const t = (k / 22) * Math.PI * 2, rr = 9 + (k % 3) * 2; const x = 16 + Math.cos(t) * rr, y = 16 + Math.sin(t) * rr; if (s.get(Math.round(x), Math.round(y))) { s.px(x + Math.cos(t) * 1.5, y + Math.sin(t) * 1.5, "#c8b8a8"); } }
    for (const [x, y] of [[6, 7], [26, 6], [4, 22], [27, 24], [16, 3]]) { s.part((m) => m.ell(x, y, 1.8, 1.2), leaf, { seam: false }); }
    for (const [x, y] of [[9, 26], [24, 10], [7, 14]]) { s.part((m) => m.ell(x, y, 1.6, 1.6), "#e83a5a", { k: 0.7 }); s.px(x, y, "#ff9ab0", true); }
  },
  // floor 100
  boss100: (s) => {
    const heart = "#8a1a3a", bloom = "#ffe0f0";
    for (const [pts, w] of [[[[10, 24], [6, 28], [2, 30]], 1.4], [[[22, 24], [26, 28], [30, 30]], 1.4], [[[16, 26], [15, 31]], 1.6], [[[8, 12], [3, 9], [1, 4]], 1], [[[24, 12], [29, 9], [31, 4]], 1]] as [[number, number][], number][]) s.part((m) => m.path(pts, w, 0.5), "#4a3a2a");
    s.part((m) => m.ell(11, 12, 6.5, 6).ell(21, 12, 6.5, 6).poly([[4.8, 14], [27.2, 14], [16, 28]]), heart, { k: 1.2 });
    s.line(16, 8, 16, 14, "#5a0a20", true);
    for (const [x0, y0, x1, y1] of [[9, 10, 13, 20], [22, 9, 19, 19], [12, 15, 16, 24]]) s.line(x0, y0, x1, y1, "#b8304a", true);
    s.part((m) => m.ell(9, 9, 2.4, 1.6), "#e86a8a", { flat: true, seam: false });
    for (const [x, y] of [[6, 5], [25, 4], [16, 5], [3, 15], [29, 16], [12, 27], [21, 26]]) {
      s.part((m) => m.ell(x, y, 1.8, 1.6), bloom, { k: 0.6 });
      s.px(x, y, "#ffd23a", true);
    }
    for (const [x, y] of [[1, 22], [30, 10], [14, 1], [27, 28]]) s.px(x, y, "#fff4f8", true);
  },
};
