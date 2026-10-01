import type { Rng } from "../core/rng";
import { hs, mix } from "./palette";
import { K, type Sprite } from "./parts";

/**
 * Body plans for the procedural creatures of floors 4-100, drawn with the part engine.
 * Each plan takes the creature's main colour (c), accent (a), eye colour (e) and its own
 * random stream, which picks horns, spikes, markings and weapons. Sprites face right.
 */
export type PlanArt = (s: Sprite, c: string, a: string, e: string, r: Rng) => void;

const dk = (c: string, f = -0.25) => hs(c, f);
const lt = (c: string, f = 0.3) => hs(c, f);
const BONE = "#e8e0cc";
const TEETH = "#f4ead8";
const MAW = "#3a0a14";

function horns(s: Sprite, x: number, y: number, a: string, r: Rng, kind = r.int(0, 3)) {
  if (kind === 1) {
    s.part((m) => m.path([[x - 2, y], [x - 4, y - 3], [x - 3, y - 6]], 1.2, 0.5), a);
    s.part((m) => m.path([[x + 2, y], [x + 4, y - 3], [x + 5, y - 6]], 1.2, 0.5), a);
  } else if (kind === 2) {
    s.part((m) => m.path([[x - 1, y], [x - 4, y - 2], [x - 5.5, y + 0.5], [x - 4, y + 2]], 1.3, 0.6), a);
    s.part((m) => m.path([[x + 1, y], [x + 4, y - 2], [x + 5.5, y + 0.5], [x + 4, y + 2]], 1.3, 0.6), a);
  } else if (kind === 3) {
    s.part((m) => m.path([[x, y + 1], [x + 1, y - 3], [x + 2.5, y - 6]], 1.4, 0.4), a);
  }
}
function spikes(s: Sprite, pts: [number, number][], a: string, r: Rng) {
  for (const [x, y] of pts) {
    const h = r.int(2, 4), lean = r.range(-0.8, 0.8);
    s.part((m) => m.poly([[x - 1.6, y + 1], [x + lean, y - h], [x + 1.6, y + 1]]), a, { k: 0.8 });
  }
}
/** Stripes, spots or nothing, blended into the shading of the body drawn so far. */
function markings(s: Sprite, x0: number, y0: number, x1: number, y1: number, a: string, r: Rng, kind = r.int(0, 2)) {
  const paint = (x: number, y: number, t = 0.55) => { const o = s.get(Math.round(x), Math.round(y)); if (o) s.px(x, y, mix(o, a, t)); };
  if (kind === 1) for (let x = x0; x <= x1; x += 4) for (let y = y0; y <= y1; y++) paint(x - ((y - y0) * 2) / Math.max(1, y1 - y0), y);
  if (kind === 2) for (let i = 0; i < 6; i++) {
    const x = r.int(x0, x1), y = r.int(y0, y1);
    paint(x, y); paint(x + 1, y); paint(x, y + 1, 0.4);
  }
}
const wing = (pts: [number, number][]) => (m: { poly: (p: [number, number][]) => unknown }) => m.poly(pts);

export const PLAN_ART: Record<string, PlanArt> = {
  blob: (s, c, a, e, r) => {
    s.part((m) => m.ell(16, 21, 12.5, 9).clip((_, y) => y <= 29), c, { k: 1.1 });
    s.part((m) => m.ell(6, 27, 2.2, 2.6), dk(c, -0.1));
    s.part((m) => m.ell(27, 28, 1.8, 2), dk(c, -0.1));
    for (const [x, y] of [[9, 24], [13, 26], [22, 25], [25, 19]]) { s.on(x, y, lt(c, 0.5)); s.on(x + 1, y - 1, lt(c, 0.75)); }
    if (r.chance(0.5)) for (let i = 0; i < 3; i++) { const x = r.int(7, 24), y = r.int(15, 26); s.part((m) => m.ell(x, y, 1.5, 1.1), a, { seam: false, k: 0.5 }); }
    s.part((m) => m.ell(9.5, 17.5, 2.5, 1.6), lt(c, 0.7), { flat: true, seam: false });
    s.px(13, 16, lt(c, 0.7));
    s.eye(16, 21, e, 2);
    s.eye(23, 21, e, 2);
    s.line(18, 25, 21, 25, dk(c, -0.6));
    if (r.chance(0.5)) horns(s, 16, 13, a, r, r.int(1, 3));
  },
  quad: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.limb(9, 21, 9, 29, 1.8, 1.4), far);
    s.part((m) => m.limb(20, 22, 21, 29, 1.8, 1.4), far);
    s.part((m) => m.path([[5, 16], [2, 16], [1, 20]], 0.9, 0.6), c, { seam: false });
    s.part((m) => m.ell(1, 21, 1.3, 1.5), a, { seam: false });
    s.part((m) => m.ell(14, 18, 10, 6.5), c, { k: 1.1 });
    markings(s, 5, 12, 23, 23, a, r);
    s.part((m) => m.ell(14, 23, 7, 1.2), lt(c, 0.3), { seam: false, shine: false });
    s.part((m) => m.limb(12, 22, 12, 29, 2, 1.6), c);
    s.part((m) => m.limb(23, 22, 24, 29, 2, 1.6), c);
    for (const x of [9, 12, 21, 24]) s.line(x - 1, 30, x + 1, 30, dk(a, -0.45));
    if (r.chance(0.6)) spikes(s, [[8, 12.5], [12, 11.5], [16, 11.5], [20, 12.5]], a, r);
    s.part((m) => m.poly([[21, 11], [22, 7.5], [24.5, 11]]), far);
    s.part((m) => m.ell(25, 14, 5, 4.8), c);
    s.part((m) => m.poly([[27, 13], [31.5, 15], [31, 18.5], [26, 18]]), lt(c, 0.15));
    s.px(30, 16, dk(c, -0.6));
    s.line(27, 18, 30, 18, dk(c, -0.55));
    s.eye(26, 12, e);
    horns(s, 25, 10, a, r);
  },
  wolf: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.path([[10, 20], [9, 25], [10, 29]], 1.5, 1.1), far);
    s.part((m) => m.limb(21, 21, 22, 29, 1.4, 1.1), far);
    s.part((m) => m.path([[7, 17], [3, 14], [1, 9]], 2.4, 1.2), c);
    s.part((m) => m.ell(1.5, 8.5, 1.4, 1.6), lt(c, 0.5), { seam: false });
    s.part((m) => m.ell(14, 18, 8.5, 5.5), c);
    s.part((m) => m.ell(21, 16, 5, 6), c);
    markings(s, 7, 13, 18, 18, a, r, r.int(0, 1));
    s.part((m) => m.path([[13, 21], [12, 25], [13, 29]], 1.8, 1.2), c);
    s.part((m) => m.limb(24, 20, 25, 29, 1.6, 1.2), c);
    for (const x of [10, 13, 22, 25]) s.px(x, 30, dk(c, -0.6));
    s.part((m) => m.poly([[20, 14], [26, 15], [24, 23], [21, 20]]), lt(c, 0.38));
    s.part((m) => m.ell(25, 11, 4.5, 4), c);
    s.part((m) => m.poly([[26, 10], [31.5, 12], [31.5, 14.5], [26, 15]]), lt(c, 0.12));
    s.part((m) => m.poly([[21.5, 9], [22.5, 3], [25, 8]]), far);
    s.part((m) => m.poly([[24.5, 8], [26.5, 2.5], [28, 9]]), c);
    s.px(26, 6, a); s.px(26, 7, a);
    for (const [x, y] of [[19, 10], [17, 12], [15, 13], [12, 13], [9, 14]]) { s.px(x, y, lt(c, 0.2)); s.px(x + 1, y - 1, lt(c, 0.2)); }
    if (r.chance(0.35)) spikes(s, [[11, 13], [15, 12.5], [19, 10]], a, r);
    s.px(31, 12, K); s.px(30, 12, K);
    s.line(27, 14, 31, 14, dk(c, -0.6));
    s.px(29, 15, TEETH); s.px(27, 15, TEETH);
    s.px(26, 10, e); s.px(27, 10, e); s.px(26, 9, lt(e, 0.6)); s.px(27, 11, dk(e, -0.5));
  },
  cat: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.limb(10, 21, 10, 29, 1.3, 1), far);
    s.part((m) => m.limb(21, 21, 21, 29, 1.3, 1), far);
    s.part((m) => m.path([[6, 18], [3, 14], [3, 8], [6, 5]], 1.4, 1), c);
    s.part((m) => m.ell(15, 19, 9, 5), c);
    markings(s, 6, 14, 24, 23, a, r, r.int(1, 2));
    s.part((m) => m.limb(13, 21, 13, 29, 1.5, 1.1), c);
    s.part((m) => m.limb(24, 20, 24, 29, 1.5, 1.1), c);
    for (const x of [13, 24]) { s.px(x, 30, lt(c, 0.4)); s.px(x + 1, 30, lt(c, 0.4)); }
    s.part((m) => m.ell(23, 18, 3.5, 4), lt(c, 0.4));
    s.part((m) => m.poly([[21, 9], [21.5, 3], [25, 7.5]]), c);
    s.part((m) => m.poly([[26, 7.5], [29, 3], [29.5, 9.5]]), c);
    s.px(22, 6, a); s.px(28, 6, a);
    s.part((m) => m.ell(25, 12, 5, 4.5), c);
    s.part((m) => m.ell(28, 14, 2.2, 1.6), lt(c, 0.4), { seam: false });
    s.px(30, 13, "#e07a8a");
    s.eye(25.5, 11, e, 1.7);
    s.px(26, 11, K);
    s.line(29, 15, 31, 14, lt(c, 0.7)); s.line(29, 16, 31, 17, lt(c, 0.7));
  },
  bear: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.limb(9, 21, 9, 29, 2.4, 2), far);
    s.part((m) => m.limb(21, 21, 21, 29, 2.4, 2), far);
    s.part((m) => m.ell(15, 18, 12, 8.5).ell(11, 12.5, 6, 4), c, { k: 1.1 });
    markings(s, 4, 11, 26, 26, a, r, r.int(0, 1) * 2);
    if (r.chance(0.5)) s.part((m) => m.ell(23, 21, 3.5, 1.5), a, { seam: false, k: 0.5 });
    s.part((m) => m.limb(13, 22, 13, 29, 2.6, 2.2), c);
    s.part((m) => m.limb(24, 21, 24, 29, 2.6, 2.2), c);
    for (const x of [11, 13, 15, 22, 24, 26]) s.px(x, 30, lt(a, 0.3));
    s.part((m) => m.ell(21, 7, 2, 2), c);
    s.part((m) => m.ell(26.5, 6.5, 2, 2), c);
    s.px(21, 7, a); s.px(27, 6, a);
    s.part((m) => m.ell(25, 12, 6, 5.5), c);
    s.part((m) => m.ell(29, 14, 3, 2.4), lt(c, 0.4));
    s.part((m) => m.ell(31, 13, 1, 1), K, { flat: true, seam: false });
    s.line(28, 16, 30, 16, dk(c, -0.6));
    s.eye(26, 11, e);
    if (r.chance(0.3)) horns(s, 24, 8, a, r, 1);
  },
  deer: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.limb(10, 20, 10, 30, 1.1, 0.9), far);
    s.part((m) => m.limb(20, 20, 21, 30, 1.1, 0.9), far);
    s.part((m) => m.ell(6, 15, 1.5, 1.5), lt(c, 0.6));
    s.part((m) => m.ell(15, 17, 9, 5), c);
    for (let i = 0; i < 6; i++) s.on(r.int(9, 21), r.int(13, 17), lt(c, 0.75));
    s.part((m) => m.ell(15, 21, 6, 1), lt(c, 0.35), { seam: false, shine: false });
    s.part((m) => m.limb(13, 20, 13, 30, 1.2, 0.9), c);
    s.part((m) => m.limb(23, 20, 23, 30, 1.2, 0.9), c);
    for (const x of [10, 13, 21, 23]) s.px(x, 31, dk(c, -0.6));
    s.part((m) => m.limb(22, 15, 25, 9, 2.4, 1.8), c);
    s.part((m) => m.poly([[23, 7], [20.5, 4], [24.5, 5.5]]), c);
    s.part((m) => m.ell(26.5, 8, 3.2, 2.8), c);
    s.part((m) => m.poly([[27, 7], [31, 9], [30, 10.5], [27, 10]]), lt(c, 0.15));
    s.px(31, 9, K);
    s.eye(27, 7, e);
    s.part((m) => m.path([[25, 5], [24, 2], [21.5, 0.5]], 0.7, 0.5), a, { seam: false });
    s.part((m) => m.path([[27.5, 5], [28.5, 2], [31, 0.5]], 0.7, 0.5), a, { seam: false });
    s.line(24, 2, 25.5, 0, a); s.line(28.5, 2, 27.5, 0, a);
  },
  lizard: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.path([[11, 24], [9, 27], [11, 29]], 1, 0.8), far);
    s.part((m) => m.path([[21, 24], [22, 27], [24, 29]], 1, 0.8), far);
    s.part((m) => m.path([[8, 23], [4, 25], [1, 29], [0, 31]], 2.8, 0.6), c);
    s.part((m) => m.ell(15, 22, 9, 4.2), c, { k: 1.1 });
    s.part((m) => m.ell(25, 19, 4, 3.2), c);
    s.part((m) => m.poly([[26, 17], [31.5, 19], [31, 21.5], [26, 22]]), lt(c, 0.12));
    s.line(27, 21, 31, 20, dk(c, -0.55));
    if (r.chance(0.7)) {
      for (let x = 9; x <= 22; x += 2) {
        const h = 3 + Math.round(Math.sin((x - 8) / 4.5) * 2);
        s.line(x, 18, x, 18 - h, a);
        s.line(x + 1, 18, x + 1, 18 - h + 1, dk(a, -0.3));
      }
      s.line(9, 18, 23, 18, dk(a, -0.3));
    } else spikes(s, [[10, 18], [14, 17.5], [18, 17.5], [22, 18]], a, r);
    markings(s, 7, 19, 22, 23, dk(c, -0.15), r, r.int(1, 2));
    s.part((m) => m.ell(15, 25, 7, 1.2), lt(c, 0.4), { seam: false });
    s.part((m) => m.path([[13, 24], [12, 27], [10, 29]], 1.2, 0.9), c);
    s.part((m) => m.path([[23, 23], [25, 26], [27, 28]], 1.2, 0.9), c);
    for (const [x, y] of [[9, 30], [11, 30], [26, 29], [28, 29]]) s.px(x, y, dk(c, -0.55));
    s.part((m) => m.ell(26, 18, 1.4, 1.2), e, { flat: true, seam: false });
    s.px(26, 18, K); s.px(26, 17, K);
    s.line(31, 21, 31, 23, "#e04a5a"); s.px(30, 24, "#e04a5a");
  },
  biped: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part((m) => m.limb(12, 22, 11, 30, 2.2, 1.9), far);
    s.part((m) => m.path([[20, 13], [24, 18], [25, 22]], 1.8, 1.6), far);
    s.part((m) => m.ell(25.5, 23.5, 2, 2), far);
    s.part((m) => m.limb(19, 22, 20, 30, 2.4, 2), c);
    s.part((m) => m.ell(15.5, 17, 7.5, 7.5), c, { k: 1.1 });
    markings(s, 8, 10, 23, 21, a, r);
    s.part((m) => m.ell(16.5, 19, 4.5, 4), lt(c, 0.3), { seam: false });
    s.part((m) => m.rect(9, 21, 14, 2), a);
    s.px(16, 21, lt(a, 0.6));
    if (r.chance(0.5)) s.part((m) => m.path([[7, 24], [5, 15], [4.5, 12]], 0.9, 1.9), "#8a5a3a");
    s.part((m) => m.path([[10, 12], [7, 18], [7, 23]], 1.9, 1.6), c);
    s.part((m) => m.ell(7, 24.5, 2.2, 2.2), c);
    s.part((m) => m.poly([[12.5, 6], [10, 3.5], [13, 8.5]]), c);
    s.part((m) => m.ell(17, 7, 5, 4.6), c);
    s.line(15, 5, 21, 5, dk(c, -0.45));
    s.eye(16, 7, e); s.eye(20, 7, e);
    s.line(16, 10, 20, 10, dk(c, -0.55));
    s.px(16, 9, TEETH); s.px(20, 9, TEETH);
    horns(s, 17, 3, a, r);
  },
  bird: (s, c, a, e, r) => {
    s.part(wing([[15, 13], [24, 4], [27, 6], [21, 15]]), dk(c, -0.25));
    s.part((m) => m.limb(13, 24, 12, 29, 0.8, 0.6), a, { seam: false });
    s.part((m) => m.limb(17, 24, 18, 29, 0.8, 0.6), a, { seam: false });
    s.line(10, 30, 14, 30, dk(a, -0.35)); s.line(16, 30, 20, 30, dk(a, -0.35));
    s.part(wing([[4, 24], [9, 19], [12, 23], [7, 28]]), dk(c, -0.2));
    s.line(5, 25, 9, 22, a, true);
    s.part((m) => m.ell(14.5, 18.5, 6, 7), c);
    s.part((m) => m.ell(17, 20, 3.5, 4.5), lt(c, 0.35), { seam: false });
    for (const [x, y] of [[16, 18], [18, 20], [16, 22]]) { s.on(x, y, dk(c, -0.1)); s.on(x + 1, y + 1, dk(c, -0.1)); }
    s.part(wing([[14, 13], [4, 5], [1, 8], [1, 13], [3, 14], [2, 18], [5, 18], [5, 21], [9, 20], [15, 20]]), hs(c, -0.08));
    for (const [x0, y0, x1, y1] of [[13, 15, 3, 9], [13, 17, 3, 15], [12, 19, 5, 19]]) s.line(x0, y0, x1, y1, dk(c, -0.4), true);
    for (const [x, y] of [[4, 6], [2, 10], [3, 15], [5, 19]]) s.on(x, y, a);
    if (r.chance(0.6)) s.part((m) => m.path([[19, 7], [16, 3], [13, 2]], 1, 0.5), a);
    s.part((m) => m.ell(21, 9, 4, 3.8), c);
    s.part(wing([[24, 8], [29.5, 9.5], [27.5, 11], [24, 11.5]]), a);
    s.px(28, 11, dk(a, -0.5));
    s.eye(22, 8, e);
    s.line(21, 7, 23, 6, dk(c, -0.5));
  },
  bat: (s, c, a, e, r) => {
    const mem = dk(c, -0.2);
    const L: [number, number][] = [[13, 13], [6, 8], [1, 10], [2, 15], [4, 14], [5, 19], [8, 17], [10, 20], [13, 18]];
    s.part(wing(L), mem, { k: 0.8 });
    s.part(wing(L.map(([x, y]) => [32 - x, y] as [number, number])), mem, { k: 0.8 });
    for (const [x, y] of [[6, 8], [2, 15], [5, 19]]) { s.line(13, 13, x, y, dk(c, -0.5), true); s.line(19, 13, 32 - x, y, dk(c, -0.5), true); }
    s.part((m) => m.poly([[12, 11], [11.5, 5], [15, 10]]), c);
    s.part((m) => m.poly([[17, 10], [20.5, 5], [20, 11]]), c);
    s.px(12, 8, a); s.px(20, 8, a);
    s.part((m) => m.ell(16, 16, 5, 6), c);
    s.part((m) => m.ell(16, 18.5, 3, 3.5), lt(c, 0.25), { seam: false });
    markings(s, 12, 16, 20, 21, a, r, 2 * r.int(0, 1));
    s.eye(14, 14, e, 1.3); s.eye(18, 14, e, 1.3);
    s.px(16, 16, dk(c, -0.6));
    s.px(15, 18, TEETH); s.px(17, 18, TEETH);
    s.line(14, 22, 14, 24, dk(c, -0.5)); s.line(18, 22, 18, 24, dk(c, -0.5));
  },
  moth: (s, c, a, e, r) => {
    for (const d of [-1, 1]) {
      s.part((m) => m.ell(16 + d * 8, 12, 7, 6), a, { k: 0.8 });
      s.part((m) => m.ell(16 + d * 7, 21, 5, 4.5), dk(a, -0.15), { k: 0.8 });
      s.part((m) => m.ell(16 + d * 9, 12, 2.4, 2.4), c, { seam: false, k: 0.6 });
      s.px(16 + d * 9, 12, e);
      for (let k = 0; k < 4; k++) s.on(16 + d * (4 + k * 3), 7 + (k % 2), dk(a, -0.3));
    }
    s.part((m) => m.ell(16, 17, 3, 8), c);
    for (const y of [14, 17, 20, 23]) s.line(14, y, 18, y, dk(c, -0.3), true);
    s.part((m) => m.ell(16, 9, 3.4, 2), lt(c, 0.5));
    s.part((m) => m.ell(16, 7.5, 2.6, 2.2), c);
    s.px(15, 7, e); s.px(17, 7, e);
    s.line(15, 5, 12, 1, dk(c, -0.4)); s.line(17, 5, 20, 1, dk(c, -0.4));
    s.px(12, 2, a); s.px(13, 3, a); s.px(20, 2, a); s.px(19, 3, a);
  },
  insect: (s, c, a, e, r) => {
    const winged = r.chance(0.5);
    if (winged) s.part(wing([[14, 13], [10, 6], [6, 2.5], [3.5, 3.5], [5, 8], [11, 13]]), "#b0cce8", { k: 0.4, seam: false });
    for (const [x0, x1] of [[16, 13], [18, 17], [20, 22]]) s.part((m) => m.path([[x0, 18], [x0 - 1, 22], [x1, 27]], 0.6, 0.5), dk(c, -0.4), { seam: false });
    if (r.chance(0.5)) s.part(wing([[3, 25], [6, 21], [7, 24]]), dk(c, -0.5), { seam: false });
    s.part((m) => m.ell(10, 19.5, 6.5, 4.6), c, { k: 1.1 });
    for (const x of [6, 9, 12]) for (let y = 14; y < 26; y++) s.on(x, y + Math.round((x - 10) * 0.2), a);
    s.part((m) => m.ell(17.5, 16, 4, 3.8), dk(c, -0.15));
    s.part((m) => m.ell(23.5, 14, 3.6, 3.4), c);
    s.part((m) => m.ell(24.5, 13, 2, 2.4), e, { k: 0.8 });
    s.px(24, 12, lt(e, 0.7));
    s.part(wing([[25, 16], [29, 17], [26, 18.5]]), dk(c, -0.4));
    s.line(23, 11, 25, 6, dk(c, -0.5)); s.line(25, 6, 28, 4, dk(c, -0.5));
    s.line(24, 11, 28, 8, dk(c, -0.5)); s.line(28, 8, 30, 8, dk(c, -0.5));
    if (winged) {
      s.part(wing([[17, 13], [16.5, 6], [15, 1.5], [12, 0.5], [11, 4], [13, 10], [15, 13]]), "#cfe8ff", { k: 0.3 });
      s.line(16, 12, 14, 2, "#9ab8dc", true); s.px(13, 2, "#ffffff"); s.px(15, 5, "#ffffff");
    }
  },
  beetle: (s, c, a, e, r) => {
    for (const x of [10, 15, 20]) s.part((m) => m.path([[x, 23], [x - 2, 26], [x - 3, 30]], 0.6, 0.5), dk(c, -0.45), { seam: false });
    s.part((m) => m.ell(15, 24, 9, 2.2), dk(c, -0.3));
    s.part((m) => m.ell(14, 19, 10, 7).clip((_, y) => y <= 24), c, { k: 1.3 });
    s.line(5, 21, 23, 15, dk(c, -0.45), true);
    markings(s, 6, 13, 21, 22, a, r, 2 * r.int(0, 1));
    for (const [x, y] of [[8, 14], [9, 13], [10, 13], [11, 12]]) s.on(x, y, lt(c, 0.8));
    for (const x of [12, 17, 22]) s.part((m) => m.path([[x, 24], [x + 1, 27], [x + 3, 30]], 0.7, 0.5), dk(c, -0.3), { seam: false });
    s.part((m) => m.ell(25, 20, 3.6, 3.2), dk(c, -0.2));
    s.part((m) => m.path([[26, 18], [29, 14], [29.5, 9], [27.5, 7]], 1.6, 0.6), a, { k: 1.1 });
    if (r.chance(0.5)) s.part((m) => m.path([[22, 14], [24, 11], [25.5, 10]], 1, 0.4), a);
    s.px(27, 20, e); s.px(27, 19, lt(e, 0.6));
    s.line(28, 22, 31, 24, dk(c, -0.5));
  },
  spider: (s, c, a, e, r) => {
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[14, 19 + k * 0.6], [8 - k, 11 + k * 2], [4 - k * 0.5, 22 + k * 2.5]], 0.7, 0.5), dk(c, -0.4), { seam: false });
    s.part((m) => m.ell(11, 18, 8, 7), c, { k: 1.2 });
    const kind = r.int(0, 2);
    if (kind === 0) { s.part((m) => m.poly([[9, 14], [13, 14], [11, 18], [13, 22], [9, 22], [11, 18]]), a, { seam: false, k: 0.6 }); }
    else markings(s, 4, 12, 18, 24, a, r, kind);
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[18, 19 + k * 0.6], [24 + k, 11 + k * 2], [28 + k * 0.8, 22 + k * 2.5]], 0.8, 0.5), dk(c, -0.2), { seam: false });
    s.part((m) => m.ell(20, 20, 5, 4), dk(c, -0.1));
    for (const [x, y] of [[23, 18], [24, 18], [22, 19], [25, 19]]) s.px(x, y, e);
    s.px(23, 17, lt(e, 0.7));
    s.part(wing([[23, 22], [25, 25], [22, 24]]), a);
    s.part(wing([[20, 23], [21, 26], [19, 24]]), a);
  },
  scorpion: (s, c, a, e, r) => {
    const far = dk(c, -0.25);
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[11 + k * 3, 23], [9 + k * 3, 26], [8 + k * 3.4, 30]], 0.6, 0.5), far, { seam: false });
    const tail: [number, number][] = [[7, 21], [4, 17], [4, 11], [7, 6], [12, 4], [16, 5]];
    tail.forEach(([x, y], i) => s.part((m) => m.ell(x, y, 2.6 - i * 0.2, 2.4 - i * 0.2), c));
    s.part(wing([[16, 4], [19, 6], [18.5, 10], [16.5, 7.5]]), a);
    s.px(18, 10, K);
    s.part((m) => m.ell(15, 22.5, 8.5, 4.5), c, { k: 1.1 });
    for (const x of [10, 14, 18]) s.line(x, 19, x, 26, dk(c, -0.45), true);
    s.part((m) => m.ell(22.5, 21.5, 4, 3.4), lt(c, 0.1));
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[13 + k * 3, 24], [14 + k * 3, 27], [15 + k * 3.2, 30]], 0.7, 0.5), c, { seam: false });
    s.part((m) => m.path([[24, 23], [27, 26], [29, 26]], 1.1, 1), c);
    s.part((m) => m.ell(29.5, 27, 2.4, 1.8), lt(c, 0.2));
    s.part((m) => m.path([[25, 19], [27, 16], [28.5, 15]], 1.2, 1), c);
    s.part((m) => m.ell(29, 13.5, 2.8, 2.2), lt(c, 0.2));
    s.line(30, 13, 31, 14, K); s.px(31, 26, K);
    if (r.chance(0.6)) for (const [x, y] of [[13, 20], [18, 21]]) { s.px(x, y, lt(a, 0.5)); s.px(x + 1, y, a); }
    s.px(24, 19, K); s.px(25, 19, K); s.px(24, 18, e);
  },
  serpent: (s, c, a, e, r) => {
    const hood = r.chance(0.45);
    s.part((m) => m.path([[2, 27], [9, 29.5], [17, 28.5], [23, 25], [22, 20], [15, 19], [11, 16], [13, 12], [19, 10]], 3.3, 2.4), c, { k: 1.1 });
    markings(s, 2, 9, 26, 31, a, r, r.int(1, 2));
    if (hood) { s.part((m) => m.ell(20, 9, 4.2, 5.5), dk(c, -0.1)); s.part((m) => m.ell(20, 9.5, 2, 3), a, { seam: false, k: 0.6 }); }
    s.part((m) => m.ell(23, 8.5, 4.3, 3.3), c);
    s.part(wing([[25, 6.5], [30, 8], [29.5, 10.5], [25, 11]]), c);
    s.line(26, 10, 29, 9.5, dk(c, -0.5));
    s.eye(24, 7, e);
    s.px(24, 8, K);
    s.line(30, 10, 31, 11, "#e04a5a"); s.px(31, 12, "#e04a5a"); s.px(32, 11, "#e04a5a");
    if (!hood && r.chance(0.4)) horns(s, 23, 5, a, r, 1);
  },
  worm: (s, c, a, e, r) => {
    s.part((m) => m.ell(13, 30.5, 11, 1.8).clip((_, y) => y <= 31), dk(c, -0.4), { k: 0.5 });
    const seg: [number, number, number][] = [[10, 27, 5.5], [8, 22, 5.2], [9, 17, 5], [12, 13, 4.8], [16, 10, 4.6]];
    for (const [x, y, rr] of seg) {
      s.part((m) => m.ell(x, y, rr, rr * 0.85), c, { k: 1.1 });
      s.part((m) => m.ell(x - 1, y - rr * 0.35, rr * 0.7, rr * 0.35), lt(c, 0.25), { seam: false, k: 0.6 });
    }
    markings(s, 3, 8, 21, 31, a, r, 2 * r.int(0, 1));
    s.part((m) => m.ell(21.5, 9, 7, 7), dk(c, -0.1), { k: 1.1 });
    s.part((m) => m.ell(23, 9.5, 5, 5), "#5a1a1a", { k: 0.8 });
    s.part((m) => m.ell(23.5, 10, 2.6, 2.6), "#2a0a10", { flat: true, seam: false });
    for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; s.px(23 + Math.cos(t) * 4.3, 9.5 + Math.sin(t) * 4.3, TEETH); }
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2 + 0.3; s.px(23.5 + Math.cos(t) * 2.2, 10 + Math.sin(t) * 2.2, "#e8d8b8"); }
    s.part((m) => m.path([[18, 3], [22, 0.5], [26, 1]], 1, 0.6), a);
    s.part((m) => m.path([[19, 16], [23, 18], [27, 17]], 1, 0.6), a);
    s.px(16, 5, e); s.px(15, 13, e);
  },
  fish: (s, c, a, e, r) => {
    s.part(wing([[7, 16], [1, 9], [2.5, 16], [1, 23]]), a, { k: 0.7 });
    s.part(wing([[11, 10.5], [16, 3.5], [20, 9.5]]), a, { k: 0.7 });
    s.part(wing([[13, 21.5], [11, 26], [16, 22.5]]), a, { k: 0.7 });
    s.part((m) => m.ell(16, 16, 10, 7), c, { k: 1.1 });
    s.part((m) => m.ell(17, 19.5, 7, 2.6), lt(c, 0.4), { seam: false });
    for (let y = 11; y < 20; y += 3) for (let x = 8 + (y % 2) * 2; x < 21; x += 4) { s.on(x, y, dk(c, -0.2)); s.on(x + 1, y + 1, dk(c, -0.2)); }
    markings(s, 7, 10, 21, 18, a, r, r.int(0, 1));
    s.line(21, 12, 20, 19, dk(c, -0.4), true);
    s.part(wing([[18, 17], [14, 21], [20, 20]]), a, { k: 0.6 });
    s.eye(23, 14, e, 1.6);
    s.line(25, 18, 26, 18, dk(c, -0.6));
    if (r.chance(0.5)) { s.px(24, 18, TEETH); s.px(26, 19, TEETH); }
  },
  crab: (s, c, a, e, r) => {
    const far = dk(c, -0.28);
    for (let k = 0; k < 3; k++) {
      s.part((m) => m.path([[11 - k, 22], [6 - k * 2, 24], [4 - k * 2, 29]], 0.8, 0.6), far);
      s.part((m) => m.path([[21 + k, 22], [26 + k * 2, 24], [28 + k * 1.5, 29]], 0.8, 0.6), c);
    }
    s.part((m) => m.path([[9, 18], [5, 14], [4, 10]], 1.4, 1.2), far);
    s.part(wing([[1, 9], [4, 5], [7, 8], [4, 9], [6, 11], [3, 12]]), dk(a, -0.15));
    s.part((m) => m.ell(16, 20, 10.5, 6.5), c, { k: 1.1 });
    markings(s, 7, 15, 25, 25, a, r, r.int(1, 2));
    s.part((m) => m.ell(16, 16.5, 6, 2.2), lt(c, 0.25), { seam: false, k: 0.6 });
    s.part((m) => m.path([[23, 18], [27, 15], [28, 11]], 1.8, 1.6), c);
    s.part(wing([[25, 10], [27, 3], [31.5, 4], [31.5, 8], [29, 7], [31, 11], [27, 12.5]]), a, { k: 1.1 });
    s.px(29, 6, dk(a, -0.5)); s.px(30, 7, dk(a, -0.5));
    for (const x of [14, 19]) { s.line(x, 14, x, 11, far); s.part((m) => m.ell(x, 10, 1.4, 1.4), "#f0e8d8", { flat: true, seam: false }); s.px(x + 1, 10, e); }
    s.line(15, 23, 18, 23, dk(c, -0.6));
  },
  frog: (s, c, a, e, r) => {
    s.part((m) => m.ell(7, 25, 4.5, 4), dk(c, -0.1));
    s.part((m) => m.ell(25, 25, 4.5, 4), dk(c, -0.1));
    s.line(3, 30, 8, 30, dk(c, -0.4)); s.line(24, 30, 29, 30, dk(c, -0.4));
    s.part((m) => m.ell(16, 21, 10.5, 8), c, { k: 1.1 });
    markings(s, 7, 14, 25, 24, a, r, 2);
    s.part((m) => m.ell(16, 25, 6.5, 3.6), lt(c, 0.45), { seam: false });
    s.part((m) => m.ell(10.5, 12.5, 4, 3.8), c);
    s.part((m) => m.ell(21.5, 12.5, 4, 3.8), c);
    s.eye(10.5, 12.5, e, 2); s.eye(21.5, 12.5, e, 2);
    s.line(9, 20, 23, 20, dk(c, -0.55)); s.px(8, 19, dk(c, -0.55)); s.px(24, 19, dk(c, -0.55));
    s.part((m) => m.limb(10, 24, 9, 29, 1.3, 1), c);
    s.part((m) => m.limb(22, 24, 23, 29, 1.3, 1), c);
    for (const x of [7, 9, 11, 21, 23, 25]) s.px(x, 30, lt(c, 0.3));
  },
  turtle: (s, c, a, e, r) => {
    const skin = a, far = dk(a, -0.22);
    s.part((m) => m.limb(9, 24, 8, 29, 1.8, 1.5), far);
    s.part((m) => m.limb(20, 24, 20, 29, 1.8, 1.5), far);
    s.part(wing([[4, 22], [1, 24], [4, 25]]), skin);
    s.part((m) => m.ell(15, 18, 11, 8.5).clip((_, y) => y <= 24), c, { k: 1.2 });
    s.part((m) => m.ell(15, 24, 12, 1.8), lt(c, 0.2));
    for (const x of [10, 15, 20]) s.line(x, 11, x + (x - 15) * 0.3, 23, dk(c, -0.45), true);
    s.line(4, 18, 26, 18, dk(c, -0.45), true);
    if (r.chance(0.6)) spikes(s, [[8, 13], [13, 10.5], [18, 10.5], [23, 13]], lt(c, 0.35), r);
    s.part((m) => m.limb(12, 25, 11, 30, 2, 1.7), skin);
    s.part((m) => m.limb(22, 25, 23, 30, 2, 1.7), skin);
    s.part((m) => m.limb(24, 21, 27, 18, 1.8, 1.6), skin);
    s.part((m) => m.ell(28.5, 17, 3.2, 2.6), skin);
    s.line(29, 19, 31, 18, dk(a, -0.55));
    s.eye(29, 16, e);
  },
  plant: (s, c, a, e, r) => {
    s.part((m) => m.path([[16, 31], [15, 25], [17, 19], [16, 15]], 1.3, 1.1), dk(c, -0.15));
    s.part(wing([[15, 26], [9, 21], [3.5, 23], [9, 27]]), c);
    s.part(wing([[17, 22], [23, 18], [28.5, 20], [23, 24]]), c);
    s.line(14, 25, 6, 23, dk(c, -0.35), true); s.line(18, 21, 26, 20, dk(c, -0.35), true);
    s.line(13, 31, 19, 31, dk(c, -0.45));
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 + 0.4; s.part((m) => m.ell(17 + Math.cos(t) * 8, 11 + Math.sin(t) * 7, 3, 2.4), lt(a, 0.15), { k: 0.7 }); }
    s.part((m) => m.ell(17, 11, 8, 7), a, { k: 1.1 });
    markings(s, 10, 4, 24, 10, lt(a, 0.5), r, 2);
    s.part((m) => m.ell(19, 13.5, 5, 3.4), MAW, { flat: true, seam: false });
    for (let x = 15; x <= 23; x += 2) { s.px(x, 11, TEETH); s.px(x + 1, 16, TEETH); }
    s.px(19, 14, "#e04a6a"); s.px(20, 14, "#e04a6a");
    s.eye(13, 8, e, 1.3);
    s.eye(20, 7, e);
  },
  fungus: (s, c, a, e, r) => {
    const stem = mix(c, "#f4ead8", 0.8);
    s.part((m) => m.ell(12, 29, 3, 1.6), dk(stem, -0.15));
    s.part((m) => m.ell(20.5, 29, 3, 1.6), dk(stem, -0.15));
    s.part((m) => m.ell(16, 23, 6.5, 6.5), stem);
    s.part((m) => m.limb(10, 22, 7, 26, 1.1, 1), stem);
    s.part((m) => m.limb(22, 22, 25, 25, 1.1, 1), stem);
    s.part((m) => m.ell(16, 15.5, 11, 2.2), dk(stem, -0.3), { shine: false });
    for (let x = 7; x <= 25; x += 2) s.line(x, 15, 16 + (x - 16) * 0.7, 17, dk(stem, -0.5), true);
    s.part((m) => m.ell(16, 12, 14, 9).clip((_, y) => y <= 14), c, { k: 1.1 });
    for (let i = 0; i < 7; i++) { const x = r.int(4, 28), y = r.int(5, 12), rr = r.range(1.1, 2.2); s.part((m) => m.ell(x, y, rr, rr * 0.8), a, { seam: false, k: 0.5 }); }
    s.eye(13.5, 21.5, e, 1.4); s.eye(19.5, 21.5, e, 1.4);
    s.line(15, 25, 17, 25, dk(stem, -0.6));
  },
  treant: (s, c, a, e, r) => {
    s.part((m) => m.path([[11, 23], [8, 27], [4, 30]], 2.6, 1), c);
    s.part((m) => m.path([[21, 23], [24, 27], [28, 30]], 2.6, 1), c);
    s.part((m) => m.path([[16, 25], [16, 30]], 2, 1.4), dk(c, -0.15));
    s.part((m) => m.path([[9, 15], [4, 18], [2, 23]], 2.2, 1.2), c);
    s.part((m) => m.path([[23, 15], [28, 16], [30, 21]], 2.4, 1.3), c);
    for (const [x, y, d] of [[2, 23, -1], [30, 21, 1]] as const) { s.line(x, y, x + d, y + 3, dk(c, -0.4)); s.line(x, y, x + d * 2, y + 2, dk(c, -0.4)); }
    s.part(wing([[9, 10], [23, 10], [24, 26], [8, 26]]), lt(c, 0.08));
    for (const x of [11, 14, 18, 21]) s.line(x, 12, x + ((x * 7) % 3) - 1, 25, dk(c, -0.3), true);
    s.part((m) => m.ell(6, 8, 5.5, 4.5), dk(a, -0.2));
    s.part((m) => m.ell(26, 8, 5.5, 4.5), dk(a, -0.2));
    s.part((m) => m.ell(16, 5.5, 10, 5.5), a);
    s.part((m) => m.ell(11, 3, 4, 2.5), lt(a, 0.2), { k: 0.8 });
    s.part((m) => m.ell(21, 3.5, 3.6, 2.4), lt(a, 0.2), { k: 0.8 });
    for (let i = 0; i < 8; i++) { const x = r.int(2, 29), y = r.int(2, 10); s.on(x, y, lt(a, 0.5)); s.on(x + 1, y + 1, dk(a, -0.4)); }
    s.part((m) => m.ell(13, 16, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 16, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
    s.px(13, 16, e); s.px(19, 16, e);
    s.part((m) => m.ell(16, 21, 3, 1.6), "#1a120a", { flat: true, seam: false });
  },
  golem: (s, c, a, e, r) => {
    s.part(wing([[9, 23], [14, 23], [14.5, 30.5], [8.5, 30.5]]), dk(c, -0.15));
    s.part(wing([[18, 23], [23, 23], [23.5, 30.5], [17.5, 30.5]]), c);
    s.part(wing([[7, 11], [16, 8.5], [25, 11], [24, 23.5], [8, 23.5]]), c, { k: 1.2 });
    for (let i = 0; i < 4; i++) { const x = r.int(9, 22), y = r.int(11, 21); s.line(x, y, x + r.int(-3, 3), y + r.int(2, 4), dk(c, -0.5), true); }
    s.part((m) => m.ell(16, 16, 2.4, 2.4), a, { k: 0.5 });
    s.px(15, 15, "#ffffff");
    s.part((m) => m.ell(5, 16, 4, 5.5), c);
    s.part((m) => m.ell(27, 16, 4, 5.5), c);
    s.part((m) => m.ell(5, 23.5, 3.4, 3), dk(c, -0.1));
    s.part((m) => m.ell(27, 23.5, 3.4, 3), dk(c, -0.1));
    if (r.chance(0.6)) for (const x of [6, 26]) s.part(wing([[x - 1.5, 11], [x, 6], [x + 1.5, 11]]), a, { k: 0.6 });
    s.part((m) => m.ell(16, 7, 4.5, 3.8), c);
    s.part((m) => m.rect(13, 6, 7, 2), K, { flat: true, seam: false });
    s.px(14, 6, e); s.px(18, 6, e); s.px(15, 6, lt(e, 0.5)); s.px(19, 6, lt(e, 0.5));
  },
  mech: (s, c, a, e, r) => {
    s.part((m) => m.rect(10, 23, 4, 7), dk(c, -0.2));
    s.part((m) => m.rect(18, 23, 4, 7), dk(c, -0.2));
    s.part((m) => m.rect(9, 29, 6, 2), dk(c, -0.35));
    s.part((m) => m.rect(17, 29, 6, 2), dk(c, -0.35));
    s.part((m) => m.rect(8, 11, 16, 13), c, { k: 1.2 });
    s.line(8, 15, 23, 15, dk(c, -0.4), true); s.line(16, 15, 16, 23, dk(c, -0.4), true);
    for (const [x, y] of [[9, 12], [22, 12], [9, 22], [22, 22]]) s.px(x, y, lt(c, 0.6));
    s.part((m) => m.ell(16, 19, 2.4, 2.4), a, { k: 0.6 });
    s.px(15, 18, "#ffffff");
    s.part((m) => m.rect(4, 13, 4, 10), dk(c, -0.1));
    s.part((m) => m.rect(24, 13, 4, 10), dk(c, -0.1));
    s.part((m) => m.rect(4, 23, 4, 2), a);
    s.part((m) => m.rect(24, 23, 4, 2), a);
    s.part((m) => m.rect(11, 4, 10, 7), c, { k: 1.2 });
    s.part((m) => m.rect(12, 6, 8, 2), e, { flat: true, seam: false });
    s.px(13, 6, "#ffffff");
    s.line(16, 3, 16, 1, dk(c, -0.4)); s.px(16, 0, a);
    for (const y of [17, 19, 21]) s.line(10, y, 12, y, dk(c, -0.5), true);
  },
  knight: (s, c, a, e, r) => {
    s.part(wing([[10, 11], [22, 11], [25, 28], [7, 28]]), dk(a, -0.25));
    s.part((m) => m.limb(13, 22, 12, 30, 2.2, 2), dk(c, -0.2));
    s.part((m) => m.limb(19, 22, 20, 30, 2.3, 2), c, { k: 1.3 });
    s.part((m) => m.ell(16, 16, 6.5, 7.5), c, { k: 1.4 });
    s.part((m) => m.rect(10, 21, 12, 1.5), dk(a, -0.3));
    s.part((m) => m.limb(25.5, 18, 28.5, 3, 0.9, 0.6), "#c8ccd8", { k: 1.3 });
    s.line(23, 18, 28, 17, a);
    s.part((m) => m.path([[21, 13], [24, 16], [25.5, 18]], 1.7, 1.5), c, { k: 1.3 });
    s.part((m) => m.ell(9, 17.5, 4.5, 6), a, { k: 1.1 });
    s.px(9, 17, lt(a, 0.6)); s.line(9, 13, 9, 22, dk(a, -0.35), true);
    s.part((m) => m.path([[16, 1.5], [13, 0], [10, 1.5], [8, 4]], 1.6, 0.8), a);
    s.part((m) => m.ell(16.5, 6.5, 5, 5.2), c, { k: 1.4 });
    s.part((m) => m.rect(14, 6, 8, 1.6), K, { flat: true, seam: false });
    s.px(17, 6, e); s.px(20, 6, e);
  },
  skeleton: (s, c, a, e, r) => {
    s.part((m) => m.limb(13, 22, 12, 30, 0.9, 0.8), dk(BONE, -0.15));
    s.part((m) => m.limb(19, 22, 20, 30, 0.9, 0.8), BONE);
    s.line(10, 30, 13, 30, BONE); s.line(19, 30, 22, 30, BONE);
    s.part((m) => m.path([[20, 12], [23, 16], [26, 17]], 0.8, 0.8), dk(BONE, -0.15));
    s.part((m) => m.limb(26, 20, 29, 4, 0.8, 0.5), a, { k: 1.2 });
    s.line(24, 18, 28, 17, dk(a, -0.3));
    s.part((m) => m.limb(16, 12, 16, 22, 0.8, 0.8), dk(BONE, -0.2));
    for (let y = 13; y <= 19; y += 2) s.part((m) => m.ell(16, y, 4.5 - (y - 13) * 0.25, 0.8), BONE, { k: 0.6 });
    s.part((m) => m.ell(16, 22, 3.5, 1.6), BONE);
    s.part(wing([[12, 22], [20, 22], [21, 27], [16, 25], [11, 27]]), c);
    if (r.chance(0.5)) s.part((m) => m.ell(12, 12, 2.5, 1.8), c, { k: 1.2 });
    s.part((m) => m.path([[12, 12], [9, 17], [8, 22]], 0.8, 0.8), BONE);
    s.part((m) => m.ell(16.5, 7, 5, 4.6), BONE);
    s.part((m) => m.rect(14, 10, 6, 2), BONE);
    s.part((m) => m.ell(14.5, 7, 1.4, 1.5), K, { flat: true, seam: false });
    s.part((m) => m.ell(18.5, 7, 1.4, 1.5), K, { flat: true, seam: false });
    s.px(14, 7, e); s.px(18, 7, e); s.px(16, 9, K);
    for (const x of [15, 17, 19]) s.px(x, 11, dk(BONE, -0.45));
  },
  ghost: (s, c, a, e, r) => {
    s.part(wing([[7, 15], [24, 15], [25, 23], [22, 27], [20, 25], [17, 29], [14, 26], [11, 29], [9, 25], [6, 27], [5, 20]]), c, { k: 0.8 });
    s.part((m) => m.ell(15.5, 12, 9, 9), c, { k: 0.8 });
    s.part((m) => m.path([[7, 15], [3, 18], [2, 21]], 1.5, 1), c, { k: 0.8 });
    s.part((m) => m.path([[23, 15], [27, 17], [28, 20]], 1.5, 1), c, { k: 0.8 });
    if (r.chance(0.5)) { s.part((m) => m.ell(28, 22, 2.4, 2.4), a, { k: 0.5 }); s.px(28, 22, "#ffffff"); }
    s.part((m) => m.ell(13, 11, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 11, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
    s.px(13, 10, e); s.px(19, 10, e);
    s.part((m) => m.ell(16.5, 16, 1.4, 1.8), "#2a2440", { flat: true, seam: false });
  },
  wraith: (s, c, a, e, r) => {
    s.part((m) => m.limb(28, 30, 27, 3, 0.6, 0.6), "#5a4a3a", { seam: false });
    s.part(wing([[27, 2.5], [20, 1.5], [14, 4.5], [21, 3.8], [27, 6]]), a, { k: 1.3 });
    s.part(wing([[11, 8], [21, 8], [25, 20], [27, 30], [23, 27], [20, 31], [16, 27], [12, 31], [9, 27], [5, 30], [8, 18]]), c, { k: 1.1 });
    for (const x of [11, 15, 19, 23]) s.line(x, 14, x - 1 + (x > 16 ? 2 : 0), 28, dk(c, -0.4), true);
    s.part((m) => m.ell(16, 9, 6.5, 6.5), dk(c, -0.1));
    s.part((m) => m.ell(17.5, 10, 3.6, 4), "#0e0a16", { flat: true, seam: false });
    s.px(16, 9, e); s.px(19, 9, e);
    s.part((m) => m.path([[21, 13], [25, 15], [27, 14]], 1.6, 1.2), c);
    s.px(27, 13, "#d8d0c0"); s.px(28, 14, "#d8d0c0");
    s.part((m) => m.rect(10, 18, 13, 1), a, { flat: true });
  },
  eye: (s, c, a, e, r) => {
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + 0.3, w = r.range(-2, 2);
      s.part((m) => m.path([[16, 16], [16 + Math.cos(t) * 8 - Math.sin(t) * w, 16 + Math.sin(t) * 8 + Math.cos(t) * w], [16 + Math.cos(t) * 13.5, 16 + Math.sin(t) * 13.5 + 1.5]], 1.7, 0.5), c);
    }
    s.part((m) => m.ell(16, 16, 10, 10), "#f0ece0", { k: 0.6 });
    for (let k = 0; k < 5; k++) { const t = r.range(0, Math.PI * 2); s.line(16 + Math.cos(t) * 9, 16 + Math.sin(t) * 9, 16 + Math.cos(t) * 6.5, 16 + Math.sin(t) * 6.5, "#d84a4a", true); }
    s.part((m) => m.ell(18, 15.5, 5.5, 5.5), e, { k: 0.8 });
    s.part((m) => m.ell(18.5, 15.5, 1.6, 3.4), K, { flat: true, seam: false });
    s.px(16, 13, "#ffffff"); s.px(17, 13, "#ffffff");
    s.part((m) => m.ell(16, 16, 10.5, 10.5).clip((_, y) => y <= 8), c);
    s.line(9, 9, 23, 9, dk(c, -0.5), true);
    markings(s, 6, 5, 26, 8, a, r, 2);
  },
  jelly: (s, c, a, e, r) => {
    for (const x of [8, 11, 14, 17, 20, 23]) { const p = r.range(0, 3); s.part((m) => m.path([[x, 16], [x + Math.sin(p) * 2, 22], [x + Math.sin(p + 2), 27], [x + Math.sin(p + 4) * 1.5, 31]], 0.7, 0.4), a, { seam: false, k: 0.6 }); }
    s.part((m) => m.path([[15, 16], [13, 22], [16, 27]], 1.4, 0.6), lt(c, 0.2), { k: 0.6 });
    s.part((m) => m.path([[18, 16], [20, 21], [18, 25]], 1.2, 0.6), lt(c, 0.2), { k: 0.6 });
    s.part((m) => m.ell(16, 11, 11, 8.5).clip((_, y) => y <= 16), c, { k: 0.7 });
    s.part((m) => m.ell(16, 9.5, 7, 4.5), lt(c, 0.3), { seam: false, k: 0.5 });
    s.part((m) => m.ell(16, 16, 11, 1.6), dk(c, -0.2));
    for (const [x, y] of [[9, 7], [12, 5], [22, 6]]) s.on(x, y, lt(c, 0.8));
    s.eye(12.5, 12, e, 1.3); s.eye(19.5, 12, e, 1.3);
  },
  elemental: (s, c, a, e, r) => {
    s.part((m) => m.path([[9, 14], [5, 17], [3, 13]], 1.6, 1.1), c, { k: 0.7 });
    s.part((m) => m.path([[23, 14], [27, 17], [29, 13]], 1.6, 1.1), c, { k: 0.7 });
    s.part((m) => m.rect(4, 15, 3, 1), a, { flat: true });
    s.part((m) => m.rect(26, 15, 3, 1), a, { flat: true });
    s.part(wing([[16, 0], [20, 5], [24, 9], [26, 16], [24, 22], [20, 26], [17, 31], [14, 26], [9, 22], [7, 15], [9, 8], [12, 6], [13, 9]]), c, { k: 0.6 });
    s.part(wing([[16, 5], [20, 10], [22, 16], [20, 22], [16, 25], [12, 22], [10, 16], [12, 11], [14, 12]]), lt(c, 0.3), { seam: false, k: 0.5 });
    s.part((m) => m.ell(16, 16, 4, 4.5), lt(c, 0.65), { seam: false, k: 0.4 });
    s.px(16, 17, "#ffffff"); s.px(16, 16, "#ffffff");
    s.part((m) => m.ell(14, 13, 1, 1.4), dk(c, -0.65), { flat: true, seam: false });
    s.part((m) => m.ell(18.5, 13, 1, 1.4), dk(c, -0.65), { flat: true, seam: false });
    s.px(14, 13, e); s.px(18, 13, e);
    for (let i = 0; i < 5; i++) { const x = r.int(1, 30), y = r.int(1, 30); if (!s.get(x, y)) s.px(x, y, i % 2 ? a : lt(c, 0.5)); }
  },
  dragon: (s, c, a, e, r) => {
    const far = dk(c, -0.22);
    s.part(wing([[14, 13], [19, 2], [24, 1], [22, 6], [25, 8], [20, 10], [19, 15]]), dk(c, -0.3), { k: 0.8 });
    s.part((m) => m.limb(10, 22, 9, 30, 2, 1.6), far);
    s.part((m) => m.limb(19, 22, 20, 30, 2, 1.6), far);
    s.part((m) => m.path([[7, 21], [3, 24], [1, 28.5], [4, 30.5]], 2.8, 0.6), c);
    s.part(wing([[3, 29], [6, 27], [6, 31]]), a);
    s.part((m) => m.ell(14.5, 19.5, 8.5, 6), c, { k: 1.1 });
    s.part((m) => m.ell(15, 23.5, 6, 1.8), a, { seam: false, k: 0.6 });
    for (const x of [11, 14, 17]) s.on(x, 23, dk(a, -0.3));
    spikes(s, [[8, 14.5], [11.5, 13.5], [15, 13.5], [18.5, 14]], a, r);
    s.part((m) => m.limb(12, 23, 12, 30, 2.2, 1.8), c);
    s.part((m) => m.limb(21, 22, 22, 30, 2.2, 1.8), c);
    for (const x of [11, 13, 21, 23]) s.px(x, 31, lt(a, 0.3));
    s.part((m) => m.path([[19, 17], [22, 13], [24, 10]], 2.8, 2.2), c);
    s.part((m) => m.path([[24, 6], [21.5, 3], [20, 0.5]], 0.9, 0.4), a);
    s.part((m) => m.ell(26, 8.5, 4.2, 3.4), c);
    s.part(wing([[27, 7], [31.5, 8.5], [31.5, 11], [27, 11.5]]), c);
    s.px(30, 8, K); s.px(29, 11, TEETH); s.px(31, 11, TEETH);
    s.line(28, 10, 31, 10, dk(c, -0.55));
    s.part((m) => m.path([[26.5, 5.5], [25.5, 2], [23.5, 0]], 0.9, 0.4), a);
    s.eye(26, 7, e);
    s.part(wing([[13, 14], [6, 3], [2, 2], [3, 6], [1, 9], [5, 10], [3, 13], [8, 14], [9, 17]]), dk(c, -0.12), { k: 0.8 });
    for (const [x, y] of [[2, 2], [1, 9], [3, 13]]) s.line(13, 14, x, y, dk(c, -0.45), true);
  },
  hydra: (s, c, a, e, r) => {
    const head = (x: number, y: number, col: string) => {
      s.part((m) => m.ell(x, y, 3.4, 2.6), col);
      s.part(wing([[x + 1, y - 1.5], [x + 5, y], [x + 4.5, y + 2], [x + 1, y + 2]]), col);
      s.line(x + 2, y + 1, x + 4, y + 1, dk(col, -0.55));
      s.eye(x, y - 1, e);
      s.part((m) => m.path([[x - 1, y - 2], [x - 3, y - 5]], 0.8, 0.4), a);
    };
    s.part((m) => m.path([[11, 20], [8, 13], [6, 8]], 2.4, 1.8), dk(c, -0.2));
    head(6, 7, dk(c, -0.2));
    s.part((m) => m.ell(15, 23, 11, 7), c, { k: 1.1 });
    s.part((m) => m.ell(16, 27, 7, 2.2), a, { seam: false, k: 0.6 });
    for (const x of [8, 22]) s.part((m) => m.limb(x, 26, x, 30, 2, 1.8), c);
    spikes(s, [[7, 18], [11, 16.5], [21, 17.5]], a, r);
    s.part((m) => m.path([[15, 19], [15, 11], [17, 5]], 2.6, 2), c);
    head(18, 4, c);
    s.part((m) => m.path([[19, 21], [24, 16], [26, 12]], 2.6, 2), c);
    head(26.5, 11, c);
  },
  mimic: (s, c, a, e, r) => {
    s.part(wing([[6, 13], [27, 9], [27, 17], [5, 17]]), MAW, { flat: true });
    s.part((m) => m.rect(5, 17, 22, 13), c, { k: 1.1 });
    for (const y of [21, 25]) s.line(5, y, 26, y, dk(c, -0.4), true);
    for (const x of [5, 25]) s.part((m) => m.rect(x, 17, 2, 13), a, { k: 1.3 });
    s.part((m) => m.ell(16, 22, 1.6, 2), a);
    s.px(16, 22, K);
    for (let x = 7; x < 26; x += 2) s.px(x, 16, TEETH);
    s.part((m) => m.path([[16, 16], [22, 18], [28, 22], [30, 26]], 1.4, 0.8), "#e04a6a");
    s.part(wing([[4, 10], [26, 6], [28, 9], [6, 13.5]]), c, { k: 1.1 });
    s.line(5, 11, 27, 7, a, true);
    for (let x = 8; x < 26; x += 2) s.px(x, 13.5 - (x - 6) * 0.2, TEETH);
    s.eye(11, 9.5, e, 1.3); s.eye(19, 8, e, 1.3);
  },
};
