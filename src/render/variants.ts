import { mix } from "./palette";
import { K } from "./parts";
import { BONE, MAW, TEETH, dk, horns, lt, markings, spikes, wing, type PlanArt } from "./plans";

/**
 * Two extra silhouettes per body plan, so creatures sharing a plan on different floors read
 * as different animals: a "quad" may be a grazer or a rhino, a "bird" a soaring raptor or a
 * flightless runner. Variant 0 is the base drawing in plans.ts.
 */
const GLASS = "#cfe8ff";
const WOOD = "#8a5a3a";
const STEEL = "#c8ccd8";
const FLAME = "#ffb02a";

type P = [number, number];
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [32 - x, y]);

export const VARIANTS: Record<string, [PlanArt, PlanArt]> = {
  blob: [
    // tall dripping slime with a single big eye
    (s, c, a, e, r) => {
      s.part((m) => m.ell(16, 20, 9, 10).ell(16, 26, 12, 4).poly([[12, 13], [17, 2.5], [20, 13]]).clip((_, y) => y <= 29), c, { k: 1.1 });
      for (const [x, h] of [[6, 3], [26, 2], [11, 2]] as const) s.part((m) => m.limb(x, 27, x, 27 + h, 1.4, 1), dk(c, -0.1));
      s.part((m) => m.ell(12, 24, 2, 2), a, { seam: false, k: 0.5 });
      s.part((m) => m.ell(12, 13, 1.6, 2.4), lt(c, 0.7), { flat: true, seam: false });
      s.eye(17, 18, e, 3);
      s.part((m) => m.ell(17.5, 25, 4, 1.6), MAW, { flat: true, seam: false });
      for (const x of [15, 17, 19]) s.px(x, 24, TEETH);
      if (r.chance(0.4)) horns(s, 17, 6, a, r, 1);
    },
    // a big slime with a little one tagging along
    (s, c, a, e, r) => {
      s.part((m) => m.ell(19, 22, 10.5, 8).clip((_, y) => y <= 29), c, { k: 1.1 });
      s.part((m) => m.ell(6, 26.5, 4.6, 3.6).clip((_, y) => y <= 29), lt(c, 0.12));
      for (const [x, y] of [[13, 24], [22, 27], [26, 19]]) { s.on(x, y, lt(c, 0.5)); s.on(x + 1, y - 1, lt(c, 0.75)); }
      s.part((m) => m.ell(13.5, 17.5, 2.4, 1.4), lt(c, 0.7), { flat: true, seam: false });
      s.eye(19, 20, e, 1.8); s.eye(25, 20, e, 1.8);
      s.part((m) => m.ell(22, 25, 2.6, 1.6), MAW, { flat: true, seam: false });
      s.px(21, 24, TEETH); s.px(23, 24, TEETH);
      s.eye(7, 26, e); s.eye(4, 26, e);
      if (r.chance(0.6)) spikes(s, [[15, 15], [19, 14], [23, 15]], a, r);
    },
  ],
  quad: [
    // long-necked, humped grazer
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(9, 20, 9, 30, 1.2, 1), far);
      s.part((m) => m.limb(18, 20, 18, 30, 1.2, 1), far);
      s.part((m) => m.path([[5, 16], [3, 19], [3, 22]], 0.7, 0.5), c, { seam: false });
      s.part((m) => m.ell(13, 18, 9, 5.5).ell(11, 13, 4.5, 3.4), c, { k: 1.1 });
      markings(s, 5, 11, 21, 22, a, r, 2);
      s.part((m) => m.limb(12, 21, 12, 30, 1.4, 1.1), c);
      s.part((m) => m.limb(21, 21, 21, 30, 1.4, 1.1), c);
      for (const x of [9, 12, 18, 21]) s.px(x, 31, dk(a, -0.4));
      s.part((m) => m.limb(19, 16, 25, 8, 2.5, 1.8), c);
      s.part((m) => m.poly([[24, 5], [23, 1.5], [26, 4.5]]), far);
      s.part((m) => m.ell(26.5, 7, 3.4, 2.7), c);
      s.part(wing([[27, 6], [31.5, 7.5], [31, 10], [27, 9.5]]), lt(c, 0.18));
      s.px(31, 8, K);
      s.eye(27, 6, e);
      if (r.chance(0.5)) horns(s, 26, 4, a, r, 1);
    },
    // armoured rhino with a nose horn
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(9, 22, 9, 29, 2.3, 2), far);
      s.part((m) => m.limb(20, 22, 20, 29, 2.3, 2), far);
      s.part((m) => m.ell(14, 19, 11, 7.5), c, { k: 1.2 });
      s.part(wing([[15, 12], [23, 13], [24, 21], [17, 22]]), dk(a, -0.1), { k: 1.2 });
      for (const y of [15, 18]) s.line(16, y, 23, y + 0.5, dk(a, -0.45), true);
      s.part(wing([[4, 14], [10, 12], [12, 18], [5, 20]]), dk(a, -0.1), { k: 1.2 });
      s.part((m) => m.limb(12, 23, 12, 30, 2.6, 2.2), c);
      s.part((m) => m.limb(23, 23, 23, 30, 2.6, 2.2), c);
      for (const x of [9, 12, 20, 23]) s.line(x - 1, 31, x + 1, 31, dk(c, -0.6));
      s.part((m) => m.poly([[22, 13], [23, 10], [25, 14]]), far);
      s.part((m) => m.ell(26, 19, 5, 4.5), c);
      s.part(wing([[27.5, 17], [31.5, 9.5], [31, 18]]), lt(a, 0.2), { k: 1.1 });
      s.part(wing([[26, 15.5], [27, 12], [28, 16]]), lt(a, 0.2));
      s.eye(25, 17, e);
      s.line(27, 22, 30, 21, dk(c, -0.55));
    },
  ],
  wolf: [
    // maned, sloped-back hunter
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.path([[9, 22], [8, 26], [9, 30]], 1.4, 1), far);
      s.part((m) => m.limb(21, 20, 21, 30, 1.5, 1.1), far);
      s.part((m) => m.path([[6, 20], [3, 21], [2, 24]], 0.9, 0.6), c, { seam: false });
      s.part((m) => m.ell(2, 25, 1.4, 1.6), dk(a, -0.2), { seam: false });
      s.part((m) => m.ell(12.5, 20, 7.5, 4.6).ell(20, 16, 5.5, 6.5), c, { k: 1.1 });
      markings(s, 6, 13, 24, 23, dk(c, -0.35), r, 2);
      s.part(wing([[14, 14], [15.5, 9], [18, 11], [19.5, 6.5], [22, 9.5], [24, 6.5], [25, 12], [23, 19], [17, 17]]), a, { k: 0.9 });
      for (const [x, y] of [[17, 12], [20, 10], [22, 14]]) s.line(x, y, x - 1, y + 3, dk(a, -0.35), true);
      s.part((m) => m.path([[12, 22], [12, 26], [13, 30]], 1.6, 1.1), c);
      s.part((m) => m.limb(24, 20, 24, 30, 1.6, 1.2), c);
      s.part((m) => m.ell(23, 7, 1.6, 1.6), far);
      s.part((m) => m.ell(25.5, 12, 4.2, 3.8), c);
      s.part(wing([[27, 11], [31.5, 12.5], [31, 15.5], [26.5, 15.5]]), lt(c, 0.1));
      s.px(31, 12, K);
      s.line(27, 15, 30, 15, dk(c, -0.6));
      s.px(28, 16, TEETH);
      s.px(26, 11, e); s.px(27, 11, e); s.px(26, 10, lt(e, 0.6));
    },
    // armoured dire wolf, jaws open
    (s, c, a, e, r) => {
      const far = dk(c, -0.22), plate = lt(a, 0.15);
      s.part((m) => m.path([[10, 21], [9, 25], [10, 30]], 1.7, 1.2), far);
      s.part((m) => m.limb(21, 21, 22, 30, 1.6, 1.2), far);
      s.part((m) => m.path([[6, 17], [2, 15], [0, 11]], 2, 0.8), c);
      s.part((m) => m.ell(14, 18, 9, 6).ell(21, 16, 5.5, 6.5), c, { k: 1.1 });
      for (const [x, y] of [[9, 12.5], [13.5, 11.5], [18, 11]] as const) s.part(wing([[x - 2.5, y + 2], [x - 1, y - 2.5], [x + 2.5, y - 1], [x + 2, y + 2.5]]), plate, { k: 1.3 });
      s.part((m) => m.path([[13, 22], [12, 26], [13, 30]], 1.9, 1.3), c);
      s.part((m) => m.limb(24, 21, 25, 30, 1.8, 1.3), c);
      for (const x of [10, 13, 22, 25]) { s.px(x, 31, plate); s.px(x + 1, 31, plate); }
      s.part((m) => m.poly([[21.5, 8], [22.5, 2.5], [25, 7]]), far);
      s.part((m) => m.ell(25, 10.5, 4.8, 4), c);
      s.part(wing([[26, 8.5], [31.5, 10.5], [31, 12.5], [26, 12.5]]), lt(c, 0.12));
      s.part(wing([[25.5, 14], [30.5, 15.5], [29.5, 17.5], [24.5, 16]]), dk(c, -0.15));
      s.part(wing([[27, 12.5], [31, 13], [30, 15.5], [26.5, 14.5]]), MAW, { flat: true, seam: false });
      for (const x of [28, 30]) { s.px(x, 13, TEETH); s.px(x - 1, 15, TEETH); }
      s.px(31, 10, K);
      s.glow(26, 9, e);
      s.line(23, 8, 25, 12, dk(c, -0.45), true);
    },
  ],
  cat: [
    // sabre-toothed brute
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(9, 21, 9, 30, 1.9, 1.5), far);
      s.part((m) => m.limb(20, 21, 20, 30, 1.9, 1.5), far);
      s.part((m) => m.path([[5, 18], [3, 21], [3, 24]], 1, 0.7), c, { seam: false });
      s.part((m) => m.ell(15, 19, 10, 6.5), c, { k: 1.1 });
      markings(s, 5, 13, 24, 25, a, r, 1);
      s.part((m) => m.ell(15, 24, 6.5, 1.3), lt(c, 0.35), { seam: false, shine: false });
      s.part((m) => m.limb(12, 22, 12, 30, 2.1, 1.6), c);
      s.part((m) => m.limb(23, 21, 23, 30, 2.1, 1.6), c);
      for (const x of [12, 23]) { s.px(x - 1, 31, TEETH); s.px(x + 1, 31, TEETH); }
      s.part((m) => m.ell(21.5, 9, 1.5, 1.5), c);
      s.part((m) => m.ell(25, 12.5, 5.5, 4.8), c);
      s.part(wing([[27, 12], [31.5, 13.5], [31, 16.5], [26, 16]]), lt(c, 0.35));
      s.px(31, 13, "#7a3a3a");
      s.part(wing([[27, 15.5], [28.5, 15.5], [27.8, 21.5]]), TEETH, { k: 0.4 });
      s.part(wing([[29.5, 15.5], [30.8, 15.5], [30.2, 20]]), TEETH, { k: 0.4 });
      s.eye(25.5, 11, e, 1.4);
      s.line(23, 9, 27, 10, dk(c, -0.5));
    },
    // winged cat with a spiked tail
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part(wing([[15, 14], [20, 3], [25, 2], [23, 7], [26, 9], [20, 15]]), dk(a, -0.25), { k: 0.8 });
      s.part((m) => m.limb(10, 21, 10, 29, 1.3, 1), far);
      s.part((m) => m.limb(21, 21, 21, 29, 1.3, 1), far);
      s.part((m) => m.path([[6, 18], [2, 15], [2, 9], [5, 6]], 1.3, 0.9), c);
      s.part(wing([[4, 7], [6, 2], [8, 6]]), a);
      s.part((m) => m.ell(15, 19, 9, 5), c);
      markings(s, 6, 14, 24, 23, a, r, 2);
      s.part((m) => m.limb(13, 21, 13, 29, 1.5, 1.1), c);
      s.part((m) => m.limb(24, 20, 24, 29, 1.5, 1.1), c);
      s.part((m) => m.poly([[21, 9], [21.5, 3], [25, 7.5]]), c);
      s.part((m) => m.poly([[26, 7.5], [29, 3], [29.5, 9.5]]), c);
      s.line(21, 3, 21, 1, dk(c, -0.5)); s.line(29, 3, 29, 1, dk(c, -0.5));
      s.part((m) => m.ell(25, 12, 5, 4.5), c);
      s.part((m) => m.ell(28, 14, 2.2, 1.6), lt(c, 0.4), { seam: false });
      s.px(30, 13, "#e07a8a");
      s.eye(25.5, 11, e, 1.7);
      s.part(wing([[14, 15], [6, 6], [3, 8], [5, 10], [2, 13], [7, 14], [5, 17], [12, 18]]), a, { k: 0.8 });
      for (const [x, y] of [[6, 6], [2, 13], [5, 17]]) s.line(14, 15, x, y, dk(a, -0.4), true);
    },
  ],
  bear: [
    // rearing up on its hind legs
    (s, c, a, e, r) => {
      s.part((m) => m.limb(12, 22, 11, 30, 2.6, 2.3), dk(c, -0.2));
      s.part((m) => m.path([[22, 13], [26, 9], [27, 4]], 2, 1.6), dk(c, -0.2));
      s.part((m) => m.limb(19, 22, 20, 30, 2.7, 2.3), c);
      s.part((m) => m.ell(15.5, 17, 7.5, 8.5), c, { k: 1.1 });
      s.part((m) => m.ell(17, 19, 4.5, 5.5), lt(c, 0.3), { seam: false });
      if (r.chance(0.5)) s.part((m) => m.ell(17, 13, 4, 1.4), a, { seam: false, k: 0.5 });
      s.part((m) => m.path([[9, 12], [5, 8], [4, 4]], 2.2, 1.7), c);
      for (const [x, y] of [[3, 2], [4, 1.5], [5, 2]]) s.px(x, y, TEETH);
      for (const [x, y] of [[26, 2], [27, 1.5], [28, 2]]) s.px(x, y, TEETH);
      s.part((m) => m.ell(13.5, 2.8, 1.8, 1.8), c);
      s.part((m) => m.ell(19, 2.3, 1.8, 1.8), c);
      s.part((m) => m.ell(17, 6.5, 5, 4.5), c);
      s.part((m) => m.ell(21, 8, 2.7, 2), lt(c, 0.4));
      s.px(23, 7, K);
      s.part((m) => m.ell(21, 9.5, 1.4, 0.9), MAW, { flat: true, seam: false });
      s.eye(18, 5, e);
    },
    // crystal-backed bear, head low
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(9, 21, 9, 29, 2.4, 2), far);
      s.part((m) => m.limb(21, 21, 21, 29, 2.4, 2), far);
      s.part((m) => m.ell(15, 19, 12, 8), c, { k: 1.1 });
      for (const [x, y, h] of [[8, 13, 7], [13, 11, 9], [18, 12, 7], [11, 14, 5]] as const) {
        s.part(wing([[x - 2, y + 2], [x - 0.5, y - h], [x + 2.2, y + 2]]), a, { k: 1.4 });
        s.line(x - 0.5, y - h + 2, x - 1, y + 1, lt(a, 0.6), true);
      }
      s.part((m) => m.limb(13, 22, 13, 29, 2.6, 2.2), c);
      s.part((m) => m.limb(24, 21, 24, 29, 2.6, 2.2), c);
      for (const x of [11, 13, 15, 22, 24, 26]) s.px(x, 30, lt(a, 0.3));
      s.part((m) => m.ell(23, 12, 1.8, 1.8), c);
      s.part((m) => m.ell(26, 16.5, 5.5, 5), c);
      s.part((m) => m.ell(29.5, 18.5, 2.6, 2.2), lt(c, 0.4));
      s.part((m) => m.ell(31, 17.5, 0.9, 0.9), K, { flat: true, seam: false });
      s.eye(27, 15, e);
    },
  ],
  deer: [
    // stocky ibex with curled horns and a beard
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(10, 20, 10, 30, 1.4, 1.1), far);
      s.part((m) => m.limb(20, 20, 20, 30, 1.4, 1.1), far);
      s.part(wing([[5, 13], [3, 11], [6, 12]]), c);
      s.part((m) => m.ell(14.5, 18, 9.5, 5.8), c, { k: 1.1 });
      markings(s, 5, 13, 23, 23, dk(c, -0.3), r, r.int(0, 1));
      s.part((m) => m.limb(13, 21, 13, 30, 1.6, 1.2), c);
      s.part((m) => m.limb(22, 21, 22, 30, 1.6, 1.2), c);
      for (const x of [10, 13, 20, 22]) s.px(x, 31, K);
      s.part((m) => m.limb(21, 16, 24, 11, 2.6, 2.2), c);
      s.part((m) => m.ell(25.5, 10.5, 3.6, 3), c);
      s.part(wing([[26, 9], [30.5, 11], [29.5, 13], [26, 12.5]]), lt(c, 0.15));
      s.part(wing([[25, 13], [28, 13], [26.5, 17]]), lt(c, 0.45));
      s.part((m) => m.path([[24, 8], [21, 4.5], [17.5, 5], [17, 9], [20, 10]], 1.7, 0.7), a, { k: 1.1 });
      s.eye(26, 9, e);
    },
    // unicorn with a mane and a spiral horn
    (s, c, a, e, r) => {
      const far = dk(c, -0.2);
      s.part((m) => m.limb(10, 20, 10, 30, 1.2, 1), far);
      s.part((m) => m.limb(20, 20, 21, 30, 1.2, 1), far);
      s.part((m) => m.path([[6, 15], [2, 18], [1, 24], [3, 27]], 1.8, 0.7), a, { k: 0.8 });
      s.part((m) => m.ell(15, 17, 9, 5), c);
      s.part((m) => m.limb(13, 20, 13, 30, 1.3, 1), c);
      s.part((m) => m.limb(23, 20, 23, 30, 1.3, 1), c);
      for (const x of [13, 23]) { s.px(x - 1, 29, lt(a, 0.3)); s.px(x + 1, 29, lt(a, 0.3)); }
      s.part((m) => m.limb(22, 15, 25, 8, 2.5, 1.9), c);
      s.part(wing([[20, 14], [21, 9], [22, 6], [24, 4], [24, 9], [22.5, 14]]), a, { k: 0.8 });
      s.part((m) => m.ell(26.5, 7.5, 3.2, 2.8), c);
      s.part(wing([[27, 6.5], [31, 8.5], [30, 10], [27, 9.5]]), lt(c, 0.15));
      s.px(31, 8, K);
      s.part((m) => m.path([[27, 5], [29.5, 0.5]], 0.9, 0.3), lt(a, 0.4), { k: 1.2 });
      s.px(28, 3, dk(a, -0.3)); s.px(29, 1, dk(a, -0.3));
      s.eye(27, 6, e);
    },
  ],
  lizard: [
    // upright raptor
    (s, c, a, e, r) => {
      s.part((m) => m.path([[13, 22], [12, 26], [14, 30]], 1.5, 1), dk(c, -0.22));
      s.part((m) => m.path([[11, 18], [6, 17], [1, 20], [0, 23]], 2.8, 0.5), c);
      s.part((m) => m.ell(15, 17, 6, 5), c, { k: 1.1 });
      markings(s, 9, 12, 21, 21, a, r, r.int(1, 2));
      s.part((m) => m.ell(16, 21, 3.2, 3.6), c);
      s.part((m) => m.path([[16, 24], [17, 27.5], [16, 30]], 1.5, 1), c);
      s.line(15, 31, 19, 31, dk(c, -0.55)); s.line(12, 31, 15, 31, dk(c, -0.6));
      s.part((m) => m.path([[19, 17], [21, 19], [22, 18]], 0.7, 0.5), c, { seam: false });
      s.part((m) => m.path([[19, 14], [22, 10]], 2.3, 1.9), c);
      s.part((m) => m.ell(24.5, 8.5, 4.3, 3), c);
      s.part(wing([[25, 7], [31.5, 8.5], [31.5, 11], [25, 11.5]]), lt(c, 0.1));
      s.line(26, 11, 31, 10, dk(c, -0.6));
      for (const x of [27, 29, 31]) s.px(x, 11, TEETH);
      for (const [x, y] of [[21, 6], [19, 8], [17, 11]]) s.part(wing([[x, y + 1.5], [x - 2, y - 1.5], [x + 1.5, y]]), a);
      s.eye(25, 7, e);
    },
    // wide horned toad-lizard with a neck frill
    (s, c, a, e, r) => {
      s.part((m) => m.path([[6, 25], [2, 27], [0, 26]], 1.8, 0.6), c);
      s.part((m) => m.path([[10, 25], [7, 28], [6, 30]], 1.3, 1), dk(c, -0.2));
      s.part((m) => m.ell(14, 23, 10, 5), c, { k: 1.1 });
      markings(s, 5, 18, 23, 27, a, r, 2);
      if (r.chance(0.6)) spikes(s, [[8, 19], [12, 18], [16, 18], [20, 19]], lt(c, 0.35), r);
      s.part((m) => m.path([[13, 26], [11, 29], [13, 30.5]], 1.4, 1), c);
      s.part((m) => m.path([[20, 26], [22, 29], [24, 30.5]], 1.4, 1), c);
      s.part((m) => m.ell(22, 18, 5.5, 6.5).clip((x) => x <= 24), a, { k: 0.9 });
      for (const [x, y] of [[18, 13], [17, 17], [18, 22]]) s.line(23, 18, x, y, dk(a, -0.35), true);
      s.part((m) => m.ell(26, 20, 4.5, 3.4), c);
      s.part(wing([[27, 19], [31.5, 20.5], [31, 23], [26.5, 23]]), lt(c, 0.12));
      s.line(27, 22.5, 31, 22, dk(c, -0.55));
      s.eye(27, 19, e);
      horns(s, 26, 17, lt(c, 0.4), r, 1);
    },
  ],
  biped: [
    // cyclops with a spiked club
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(12, 22, 11, 30, 2.3, 2), far);
      s.part((m) => m.path([[20, 13], [24, 18], [25, 22]], 1.9, 1.6), far);
      s.part((m) => m.ell(25.5, 23.5, 2, 2), far);
      s.part((m) => m.limb(19, 22, 20, 30, 2.4, 2.1), c);
      s.part((m) => m.ell(15.5, 16.5, 8, 7.5), c, { k: 1.1 });
      s.part((m) => m.ell(16.5, 18.5, 5, 4.2), lt(c, 0.3), { seam: false });
      s.part(wing([[8.5, 21], [23, 21], [21, 26], [18, 24], [15, 27], [12, 24], [9, 25]]), a);
      s.part((m) => m.path([[6, 26], [4, 15], [4, 11]], 1, 2.4), WOOD);
      for (const [x, y] of [[2, 12], [6, 12], [3, 15], [5.5, 16]]) s.px(x, y, STEEL);
      s.part((m) => m.path([[10, 12], [7, 18], [6, 23]], 2, 1.7), c);
      s.part((m) => m.ell(6, 24.5, 2.2, 2.2), c);
      s.part((m) => m.ell(17, 6.5, 5.5, 5), c);
      s.eye(18, 6, e, 2.4);
      s.line(15, 3, 21, 3, dk(c, -0.5));
      s.line(15, 10, 21, 10, dk(c, -0.55));
      for (const x of [16, 18, 20]) s.px(x, 10, TEETH);
      if (r.chance(0.5)) horns(s, 17, 1, a, r, 3);
    },
    // hunched goblin with a spear
    (s, c, a, e, r) => {
      s.part((m) => m.limb(26, 30, 28, 4, 0.6, 0.6), WOOD, { seam: false });
      s.part(wing([[26.5, 6], [28.5, 0], [30, 5.5]]), STEEL, { k: 1.3 });
      s.part((m) => m.path([[13, 22], [10, 26], [12, 30]], 1.4, 1.1), dk(c, -0.22));
      s.part((m) => m.path([[17, 22], [20, 26], [18, 30]], 1.5, 1.1), c);
      s.part((m) => m.ell(15, 18, 6, 6), c, { k: 1.1 });
      s.part(wing([[9, 19], [21, 19], [22, 25], [19, 23], [16, 26], [13, 23], [9, 24]]), a);
      s.part((m) => m.path([[11, 15], [8, 19], [9, 22]], 1, 0.9), dk(c, -0.22));
      s.part((m) => m.path([[19, 15], [24, 15], [27, 13]], 1.1, 0.9), c);
      s.part(wing([[15, 9], [9, 6], [14, 11]]), c);
      s.part((m) => m.ell(19, 11, 4.5, 4), c);
      s.part(wing([[22, 10], [26.5, 12.5], [22.5, 13.5]]), lt(c, 0.12));
      s.line(18, 14, 22, 14, dk(c, -0.6));
      s.px(19, 14, TEETH); s.px(21, 14, TEETH);
      s.eye(20, 10, e, 1.3);
      s.line(18, 8, 21, 9, dk(c, -0.5));
    },
  ],
  bird: [
    // soaring with both wings raised
    (s, c, a, e, r) => {
      const L: P[] = [[13, 15], [8, 5], [2, 2], [4, 7], [0.5, 9], [5, 12], [2, 15], [9, 18]];
      s.part(wing(L), dk(c, -0.15), { k: 0.8 });
      s.part(wing(mirror(L)), c, { k: 0.8 });
      for (const [x, y] of [[2, 2], [0.5, 9], [2, 15]]) { s.line(13, 15, x, y, dk(c, -0.45), true); s.line(19, 15, 32 - x, y, dk(c, -0.4), true); }
      for (const [x, y] of [[3, 3], [1, 9], [3, 15]]) { s.on(x, y, a); s.on(32 - x, y, a); }
      s.part(wing([[13, 23], [16, 30], [19, 23]]), dk(c, -0.15));
      s.part((m) => m.ell(16, 17, 5, 6.5), c);
      s.part((m) => m.ell(16.5, 19, 3, 4), lt(c, 0.35), { seam: false });
      s.line(14, 23, 13, 27, a); s.line(18, 23, 19, 27, a);
      s.part((m) => m.ell(16.5, 9, 3.8, 3.4), c);
      s.part(wing([[18.5, 8.5], [23, 10], [21, 11.5], [18.5, 11.5]]), a);
      s.eye(17.5, 8, e);
    },
    // flightless runner with a hooked beak
    (s, c, a, e, r) => {
      s.part((m) => m.path([[11, 20], [13, 25], [10, 30]], 0.9, 0.7), dk(a, -0.25), { seam: false });
      s.part(wing([[3, 15], [8, 13], [8, 19], [2, 21]]), dk(c, -0.2));
      for (const y of [16, 18]) s.line(3, y + 1, 7, y, a, true);
      s.part((m) => m.ell(12.5, 17, 7, 5.5), c, { k: 1.1 });
      s.part((m) => m.path([[15, 20], [17, 25], [14, 30]], 1, 0.7), a, { seam: false });
      s.line(9, 31, 12, 31, dk(a, -0.4)); s.line(13, 31, 17, 31, dk(a, -0.4));
      s.part(wing([[10, 15], [15, 14], [13, 19]]), dk(c, -0.1));
      s.part((m) => m.path([[17, 14], [20, 9], [21.5, 5.5]], 2, 1.6), c);
      s.part((m) => m.ell(23, 5, 3.4, 2.8), c);
      s.part(wing([[25, 3.5], [31, 4.5], [30.5, 8], [28.5, 6.5], [25, 7.5]]), a, { k: 1.1 });
      s.eye(23.5, 4, e);
      if (r.chance(0.6)) s.part((m) => m.path([[21, 3], [19, 0.5], [17, 0.5]], 0.8, 0.4), a);
    },
  ],
  bat: [
    // horned, tailed gargoyle-bat
    (s, c, a, e, r) => {
      const L: P[] = [[13, 13], [7, 6], [1, 6], [3, 10], [0.5, 13], [4, 14], [3, 19], [8, 17], [10, 21], [13, 18]];
      s.part(wing(L), dk(c, -0.25), { k: 0.8 });
      s.part(wing(mirror(L)), dk(c, -0.25), { k: 0.8 });
      for (const [x, y] of [[1, 6], [0.5, 13], [3, 19]]) { s.line(13, 13, x, y, dk(c, -0.55), true); s.line(19, 13, 32 - x, y, dk(c, -0.55), true); }
      s.part((m) => m.path([[16, 21], [15, 26], [18, 29]], 0.9, 0.6), c, { seam: false });
      s.part(wing([[17, 28], [21, 28], [19, 31]]), a);
      s.part((m) => m.ell(16, 16, 5.5, 6.5), c, { k: 1.1 });
      markings(s, 11, 13, 21, 22, a, r, 1);
      horns(s, 16, 10, a, r, 1);
      s.glow(14, 14, e); s.glow(18, 14, e);
      s.part((m) => m.ell(16, 18.5, 1.8, 1), MAW, { flat: true, seam: false });
      s.px(15, 18, TEETH); s.px(17, 18, TEETH);
    },
    // side-on fruit bat with long ears
    (s, c, a, e, r) => {
      s.part(wing([[15, 15], [11, 4], [5, 1], [6, 5], [2, 6], [6, 9], [4, 12], [11, 14]]), dk(c, -0.3), { k: 0.8 });
      s.part((m) => m.ell(16, 17, 6, 4.2), c);
      s.part((m) => m.ell(16, 19.5, 4, 1.4), lt(c, 0.3), { seam: false, shine: false });
      s.part(wing([[21, 12], [22, 4], [24.5, 11]]), c);
      s.px(22, 8, a);
      s.part((m) => m.ell(23.5, 15, 3.6, 3.2), c);
      s.part(wing([[25, 14], [29.5, 15.5], [28.5, 17], [25, 17]]), lt(c, 0.12));
      s.px(28, 17, TEETH);
      s.eye(24, 14, e, 1.2);
      s.part(wing([[14, 18], [19, 25], [12, 31], [9, 27], [5, 29], [6, 24], [2, 23], [7, 21]]), dk(c, -0.12), { k: 0.8 });
      for (const [x, y] of [[12, 31], [5, 29], [2, 23]]) s.line(15, 19, x, y, dk(c, -0.5), true);
      markings(s, 11, 14, 21, 20, a, r, 2);
    },
  ],
  moth: [
    // swallowtail butterfly
    (s, c, a, e, r) => {
      for (const d of [-1, 1]) {
        const X = (x: number) => 16 + d * x;
        s.part(wing([[X(1), 9], [X(9), 2], [X(15), 4], [X(14), 12], [X(2), 15]]), a, { k: 0.8 });
        s.part(wing([[X(1), 15], [X(11), 15], [X(12), 21], [X(9), 24], [X(8), 30], [X(6), 24], [X(1), 21]]), dk(a, -0.12), { k: 0.8 });
        for (const [x, y] of [[9, 3], [14, 6], [12, 16]]) s.line(X(1.5), 12, X(x), y, dk(a, -0.45), true);
        s.part((m) => m.ell(X(9), 19, 1.6, 1.6), c, { seam: false, k: 0.5 });
        for (let k = 0; k < 4; k++) s.on(X(14 - k), 5 + k * 2, lt(a, 0.6));
      }
      s.part((m) => m.ell(16, 16, 1.6, 8), c);
      s.part((m) => m.ell(16, 7.5, 2, 1.8), c);
      s.px(15, 7, e); s.px(17, 7, e);
      s.line(15, 6, 12, 1, dk(c, -0.4)); s.line(17, 6, 20, 1, dk(c, -0.4));
      s.px(12, 1, a); s.px(20, 1, a);
    },
    // dragonfly
    (s, c, a, e, r) => {
      for (const [x0, y0, x1, y1] of [[17, 15, 3, 7], [18, 16, 4, 13]] as const) s.part((m) => m.limb(x0, y0, x1, y1, 2.2, 1.6), mix(GLASS, a, 0.25), { k: 0.4, seam: false });
      s.part((m) => m.path([[2, 20], [8, 19.5], [15, 18]], 1, 1.3), c, { k: 1.1 });
      for (let x = 3; x < 15; x += 2) s.on(x, 19.5, dk(c, -0.4));
      for (const x of [18, 20, 22]) s.part((m) => m.path([[x, 19], [x, 23], [x + 1, 26]], 0.5, 0.4), dk(c, -0.4), { seam: false });
      s.part((m) => m.ell(19.5, 17.5, 3, 2.6), c);
      s.part((m) => m.ell(24, 16, 3, 2.8), c);
      s.part((m) => m.ell(25, 15, 2, 2.2), e, { k: 0.7 });
      s.px(24, 14, lt(e, 0.7));
      for (const [x0, y0, x1, y1] of [[20, 16, 30, 9], [20, 17, 29, 20]] as const) s.part((m) => m.limb(x0, y0, x1, y1, 2.2, 1.5), mix(GLASS, a, 0.15), { k: 0.4 });
      s.line(21, 16, 29, 10, mix(GLASS, a, 0.5), true); s.line(21, 17, 28, 20, mix(GLASS, a, 0.5), true);
    },
  ],
  insect: [
    // mantis with raised blades
    (s, c, a, e, r) => {
      for (const [x0, x1] of [[10, 7], [14, 13], [16, 18]]) s.part((m) => m.path([[x0, 22], [x0 - 2, 25], [x1, 30]], 0.6, 0.5), dk(c, -0.4), { seam: false });
      s.part((m) => m.limb(4, 22, 12, 20, 2.6, 3.4), c, { k: 1.1 });
      for (const x of [5, 7, 9]) s.line(x, 19, x - 1, 24, dk(c, -0.35), true);
      s.part(wing([[3, 21], [9, 16], [14, 18], [6, 22]]), lt(a, 0.2), { k: 0.5 });
      s.part((m) => m.limb(14, 20, 19, 11, 1.5, 1.3), c);
      s.part(wing([[19, 8], [25, 9], [22, 13.5], [19, 12]]), c);
      s.part((m) => m.ell(23.5, 9.5, 1.6, 1.8), e, { k: 0.7 });
      s.px(23, 9, lt(e, 0.7));
      s.line(20, 8, 17, 2, dk(c, -0.5)); s.line(21, 8, 23, 2, dk(c, -0.5));
      s.part((m) => m.path([[19, 13], [24, 16], [22, 20]], 1, 0.8), c);
      s.part((m) => m.path([[22, 20], [27, 16], [28, 12]], 0.8, 0.5), lt(c, 0.15));
      for (const [x, y] of [[24, 18], [26, 16], [27, 14]]) s.px(x, y, TEETH);
    },
    // ant soldier with huge mandibles
    (s, c, a, e, r) => {
      for (const [x0, x1] of [[13, 9], [15, 15], [17, 21]]) s.part((m) => m.path([[x0, 20], [x0 + (x1 - x0) * 0.4, 16], [x1, 30]], 0.6, 0.5), dk(c, -0.45), { seam: false });
      s.part((m) => m.ell(7, 20, 5.5, 4.5), c, { k: 1.2 });
      markings(s, 2, 16, 12, 24, a, r, 1);
      s.part((m) => m.ell(14.5, 19.5, 3, 2.5), dk(c, -0.1));
      for (const [x0, x1] of [[14, 11], [16, 17], [18, 24]]) s.part((m) => m.path([[x0, 21], [x0 + (x1 - x0) * 0.4, 18], [x1, 30]], 0.7, 0.5), dk(c, -0.25), { seam: false });
      s.part((m) => m.ell(21.5, 16, 4.6, 4.2), c, { k: 1.1 });
      s.part(wing([[24, 18], [31, 17], [27, 21]]), a, { k: 1.1 });
      s.part(wing([[24, 15], [31, 13], [28, 17]]), a, { k: 1.1 });
      s.eye(22, 14, e);
      s.line(21, 12, 22, 7, dk(c, -0.5)); s.line(22, 7, 26, 5, dk(c, -0.5));
    },
  ],
  beetle: [
    // stag beetle with pincers
    (s, c, a, e, r) => {
      for (const x of [9, 14, 19]) s.part((m) => m.path([[x, 23], [x - 2, 26], [x - 3, 30]], 0.6, 0.5), dk(c, -0.45), { seam: false });
      s.part((m) => m.ell(13, 20, 9, 6).clip((_, y) => y <= 24), c, { k: 1.3 });
      s.line(4, 21, 21, 16, dk(c, -0.45), true);
      for (const [x, y] of [[7, 15], [8, 14], [9, 14]]) s.on(x, y, lt(c, 0.8));
      for (const x of [11, 16, 21]) s.part((m) => m.path([[x, 24], [x + 1, 27], [x + 3, 30]], 0.7, 0.5), dk(c, -0.3), { seam: false });
      s.part((m) => m.ell(23, 19.5, 3.5, 3.2), dk(c, -0.2));
      s.part((m) => m.path([[25, 17.5], [28.5, 13], [31, 15]], 1.1, 0.6), a, { k: 1.2 });
      s.part((m) => m.path([[25, 21], [29.5, 19.5], [31, 23]], 1.1, 0.6), a, { k: 1.2 });
      s.px(28, 14, TEETH); s.px(29, 20, TEETH);
      s.px(24, 18, e);
    },
    // round, spotted ladybird seen from the front
    (s, c, a, e, r) => {
      for (const d of [-1, 1]) for (const y of [21, 24, 27]) s.part((m) => m.path([[16 + d * 7, y], [16 + d * 11, y + 1], [16 + d * 12, y + 3]], 0.6, 0.5), dk(c, -0.6), { seam: false });
      s.part((m) => m.ell(16, 19.5, 11, 9).clip((_, y) => y <= 27), c, { k: 1.4 });
      s.line(16, 11, 16, 27, dk(c, -0.5), true);
      for (let i = 0; i < 6; i++) { const x = r.int(7, 25), y = r.int(14, 25); if (Math.abs(x - 16) > 1) s.part((m) => m.ell(x, y, 1.6, 1.4), dk(a, -0.4), { seam: false, flat: true }); }
      for (const [x, y] of [[9, 14], [10, 13], [11, 12]]) s.on(x, y, lt(c, 0.8));
      s.part((m) => m.ell(16, 10, 5, 3), dk(c, -0.7));
      s.px(13, 10, TEETH); s.px(19, 10, TEETH);
      s.px(14, 9, e); s.px(18, 9, e);
      s.line(14, 7, 12, 4, dk(c, -0.6)); s.line(18, 7, 20, 4, dk(c, -0.6));
    },
  ],
  spider: [
    // long-legged harvestman
    (s, c, a, e, r) => {
      for (let k = 0; k < 4; k++) {
        const sp = 2 + k * 3.3;
        s.part((m) => m.path([[15, 12], [15 - sp * 0.7, 3 + k], [15 - sp * 1.15, 30]], 0.55, 0.45), dk(c, -0.4), { seam: false });
        s.part((m) => m.path([[17, 12], [17 + sp * 0.7, 3 + k], [17 + sp * 1.15, 30]], 0.6, 0.45), dk(c, -0.2), { seam: false });
      }
      s.part((m) => m.ell(16, 12.5, 4.6, 3.6), c, { k: 1.2 });
      markings(s, 12, 10, 20, 15, a, r, 2);
      s.px(17, 10, e); s.px(18, 10, e); s.px(17, 9, lt(e, 0.6));
    },
    // hairy tarantula
    (s, c, a, e, r) => {
      const leg = (pts: P[], col: string) => { s.part((m) => m.path(pts, 1.3, 0.8), col, { seam: false }); for (const [x, y] of pts.slice(1)) s.on(x, y - 1, lt(col, 0.35)); };
      for (let k = 0; k < 4; k++) leg([[13, 21], [7 - k, 13 + k * 2], [4 - k * 0.6, 23 + k * 2.4]], dk(c, -0.35));
      s.part((m) => m.ell(9.5, 19, 7.5, 6.5), c, { k: 1.1 });
      for (let i = 0; i < 14; i++) s.on(r.int(3, 16), r.int(13, 25), lt(c, 0.35));
      markings(s, 4, 13, 15, 24, a, r, 2);
      for (let k = 0; k < 4; k++) leg([[19, 22], [24 + k, 14 + k * 2], [28 + k * 0.7, 23 + k * 2.4]], dk(c, -0.12));
      s.part((m) => m.ell(19.5, 21, 5, 4), dk(c, -0.05));
      for (const [x, y] of [[22, 19], [23, 19], [22, 18], [23, 18]]) s.px(x, y, e);
      s.part(wing([[22, 23], [24.5, 27], [21, 25]]), a);
      s.part(wing([[19, 24], [20, 28], [18, 25.5]]), a);
    },
  ],
  scorpion: [
    // giant crushing claws
    (s, c, a, e, r) => {
      const far = dk(c, -0.25);
      for (let k = 0; k < 4; k++) s.part((m) => m.path([[9 + k * 3, 24], [7 + k * 3, 27], [6 + k * 3.4, 30]], 0.6, 0.5), far, { seam: false });
      const tail: P[] = [[5, 22], [2, 18], [2, 13], [5, 9], [9, 8]];
      tail.forEach(([x, y], i) => s.part((m) => m.ell(x, y, 2.4 - i * 0.2, 2.2 - i * 0.2), c));
      s.part(wing([[9, 7.5], [12, 9], [11, 12.5], [9.5, 10]]), a);
      s.part((m) => m.ell(12.5, 23.5, 7.5, 4), c, { k: 1.1 });
      s.part((m) => m.ell(19, 22.5, 3.6, 3.2), lt(c, 0.1));
      s.part((m) => m.path([[20, 21], [23, 16], [24, 13]], 1.4, 1.2), c);
      s.part(wing([[21, 12], [27, 4], [31.5, 6], [30, 10], [26, 10], [31, 13], [27, 16], [22, 15]]), lt(c, 0.2), { k: 1.2 });
      s.part((m) => m.path([[21, 24], [25, 26]], 1.2, 1), c);
      s.part(wing([[24, 23.5], [30, 22], [31.5, 26.5], [28, 26], [30.5, 29], [25, 28.5]]), lt(c, 0.2), { k: 1.2 });
      for (let k = 0; k < 3; k++) s.part((m) => m.path([[11 + k * 3, 25], [12 + k * 3, 28], [13 + k * 3, 30]], 0.7, 0.5), c, { seam: false });
      s.px(20, 20, K); s.px(21, 20, e);
    },
    // twin-tailed
    (s, c, a, e, r) => {
      const far = dk(c, -0.25);
      for (let k = 0; k < 4; k++) s.part((m) => m.path([[11 + k * 3, 23], [9 + k * 3, 26], [8 + k * 3.4, 30]], 0.6, 0.5), far, { seam: false });
      for (const [dx, col] of [[-3, far], [0, c]] as const) {
        const tail: P[] = [[7, 21], [4 + dx, 17], [4 + dx, 11], [7 + dx, 6], [12 + dx * 0.6, 4 + dx * 0.3], [16 + dx * 0.4, 5 + dx * 0.5]];
        tail.forEach(([x, y], i) => s.part((m) => m.ell(x, y, 2.3 - i * 0.2, 2.1 - i * 0.2), col));
        s.part(wing([[16 + dx * 0.4, 4 + dx * 0.5], [19 + dx * 0.4, 6 + dx * 0.5], [18.5 + dx * 0.4, 10 + dx * 0.5]]), a);
      }
      s.part((m) => m.ell(15, 22.5, 8.5, 4.5), c, { k: 1.1 });
      for (const x of [10, 14, 18]) s.line(x, 19, x, 26, dk(c, -0.45), true);
      s.part((m) => m.ell(22.5, 21.5, 4, 3.4), lt(c, 0.1));
      for (let k = 0; k < 4; k++) s.part((m) => m.path([[13 + k * 3, 24], [14 + k * 3, 27], [15 + k * 3.2, 30]], 0.7, 0.5), c, { seam: false });
      s.part((m) => m.path([[24, 23], [27, 26], [29, 26]], 1.1, 1), c);
      s.part((m) => m.ell(29.5, 27, 2.4, 1.8), lt(c, 0.2));
      s.part((m) => m.path([[25, 19], [27, 16], [28.5, 15]], 1.2, 1), c);
      s.part((m) => m.ell(29, 13.5, 2.8, 2.2), lt(c, 0.2));
      s.px(24, 19, K); s.px(24, 18, e);
    },
  ],
  serpent: [
    // rearing cobra
    (s, c, a, e, r) => {
      s.part((m) => m.ell(14, 27, 11, 4).clip((_, y) => y <= 31), c, { k: 1.1 });
      s.line(5, 27, 22, 26, dk(c, -0.45), true);
      s.part((m) => m.path([[18, 26], [19, 19], [17, 13], [19, 8]], 3, 2.5), c);
      for (const y of [16, 19, 22]) s.on(19, y, lt(c, 0.4));
      s.part((m) => m.ell(18.5, 11, 5.5, 6.5), dk(c, -0.08));
      s.part((m) => m.ell(16.5, 11, 1.3, 1.8), a, { seam: false, flat: true });
      s.part((m) => m.ell(20.5, 11, 1.3, 1.8), a, { seam: false, flat: true });
      s.part((m) => m.ell(21, 6.5, 3.6, 2.7), c);
      s.part(wing([[23, 5.5], [27.5, 6.5], [27, 8.5], [23, 9]]), c);
      s.eye(22, 5.5, e);
      s.line(27, 8, 29, 9, "#e04a5a"); s.px(30, 8, "#e04a5a"); s.px(30, 10, "#e04a5a");
      markings(s, 4, 23, 25, 31, a, r, 1);
    },
    // feathered, winged serpent
    (s, c, a, e, r) => {
      s.part(wing([[12, 20], [8, 9], [3, 6], [5, 11], [2, 13], [7, 16], [5, 19]]), dk(a, -0.2), { k: 0.8 });
      s.part((m) => m.path([[1, 25], [6, 28], [11, 25], [16, 22], [20, 25], [24, 21], [24, 16]], 2.4, 2.1), c, { k: 1.1 });
      for (const [x, y] of [[4, 27], [9, 27], [14, 24], [19, 27], [23, 23]]) s.on(x, y, lt(c, 0.4));
      markings(s, 1, 19, 25, 30, a, r, 2);
      s.part(wing([[14, 22], [12, 10], [8, 5], [11, 10], [9, 13], [13, 15], [11, 18]]), a, { k: 0.8 });
      for (const [x, y] of [[8, 5], [9, 13], [11, 18]]) s.line(14, 21, x, y, dk(a, -0.35), true);
      s.part(wing([[23, 14], [21, 9], [24, 11], [24, 7], [26, 12]]), a);
      s.part((m) => m.ell(26, 15, 3.6, 2.8), c);
      s.part(wing([[27, 14], [31.5, 15], [31, 17], [27, 17.5]]), c);
      s.eye(26.5, 14, e);
      s.line(31, 17, 32, 18, "#e04a5a");
    },
  ],
  worm: [
    // centipede crawling along the ground
    (s, c, a, e, r) => {
      for (let i = 0; i < 8; i++) {
        const x = 3 + i * 3, y = 24 - Math.sin(i / 1.6) * 1.5;
        s.line(x, y + 2, x - 1, y + 6, dk(c, -0.45)); s.line(x + 1, y + 2, x + 2, y + 6, dk(c, -0.3));
        s.part((m) => m.ell(x, y, 2.6, 2.6), i % 2 ? c : lt(c, 0.08), { k: 1.1 });
      }
      markings(s, 1, 20, 26, 27, a, r, 2);
      s.part((m) => m.ell(27, 21.5, 3.6, 3.2), dk(c, -0.1));
      s.part(wing([[28, 24], [31.5, 23], [30, 26.5]]), a);
      s.part(wing([[28, 20], [31.5, 19], [30.5, 22]]), a);
      s.eye(27.5, 20.5, e);
      s.line(27, 19, 29, 14, dk(c, -0.45)); s.line(29, 14, 31, 13, dk(c, -0.45));
      s.line(25, 19, 25, 15, dk(c, -0.45)); s.line(25, 15, 23, 13, dk(c, -0.45));
    },
    // tunnel worm with a crown of feelers
    (s, c, a, e, r) => {
      s.part((m) => m.ell(14, 30.5, 11, 1.8).clip((_, y) => y <= 31), dk(c, -0.4), { k: 0.5 });
      const seg: [number, number, number][] = [[12, 27, 5.5], [11, 22, 5], [13, 17.5, 4.6], [16, 14, 4.3]];
      for (const [x, y, rr] of seg) s.part((m) => m.ell(x, y, rr, rr * 0.85), c, { k: 1.1 });
      markings(s, 6, 11, 21, 31, a, r, 2);
      for (const [x, y] of [[9, 24], [12, 19], [15, 15]]) s.px(x, y, e);
      for (let k = 0; k < 5; k++) {
        const t = -Math.PI * 0.85 + k * 0.42;
        s.part((m) => m.path([[19, 11], [19 + Math.cos(t) * 5, 11 + Math.sin(t) * 5], [19 + Math.cos(t + 0.4) * 9, 11 + Math.sin(t + 0.4) * 9]], 1.1, 0.4), a);
      }
      s.part((m) => m.ell(20, 11, 3, 2.6), MAW, { flat: true, seam: false });
      for (const [x, y] of [[18, 10], [21, 10], [20, 12]]) s.px(x, y, TEETH);
    },
  ],
  fish: [
    // anglerfish with a glowing lure
    (s, c, a, e, r) => {
      s.part(wing([[7, 18], [1, 13], [2.5, 18], [1, 24]]), dk(a, -0.1), { k: 0.7 });
      s.part((m) => m.ell(15, 18, 10, 8.5), c, { k: 1.1 });
      markings(s, 6, 10, 23, 25, a, r, 2);
      s.part(wing([[16, 21], [26, 15], [25.5, 25], [16, 23]]), MAW, { flat: true, seam: false });
      for (const [x, y] of [[18, 20], [20, 19], [22, 18], [24, 17], [19, 23], [21, 24], [23, 24]]) s.px(x, y, TEETH);
      s.part(wing([[10, 24], [8, 29], [14, 25]]), a, { k: 0.7 });
      s.part((m) => m.path([[16, 10], [19, 4], [24, 3], [26, 6]], 0.5, 0.4), dk(c, -0.3), { seam: false });
      s.part((m) => m.ell(26.5, 7, 1.8, 1.8), e, { flat: true });
      s.px(26, 6, "#ffffff");
      s.eye(19, 14, e);
    },
    // swordfish with a tall sail
    (s, c, a, e, r) => {
      s.part(wing([[6, 16], [1, 9], [3, 16], [1, 23]]), a, { k: 0.7 });
      s.part(wing([[8, 13], [12, 2], [16, 4], [21, 12]]), a, { k: 0.7 });
      for (const x of [11, 14, 17]) s.line(x, 12, x - 1, 5, dk(a, -0.3), true);
      s.part((m) => m.ell(15, 16, 11, 4.8), c, { k: 1.1 });
      s.part((m) => m.ell(16, 18.5, 8, 1.8), lt(c, 0.45), { seam: false });
      markings(s, 6, 12, 22, 17, dk(c, -0.25), r, 1);
      s.part(wing([[24.5, 14.5], [32, 15.5], [24.5, 17]]), lt(a, 0.3), { k: 1.1 });
      s.part(wing([[16, 19], [12, 23], [18, 20.5]]), a);
      s.eye(22, 15, e, 1.2);
    },
  ],
  crab: [
    // hermit crab in a spiral shell
    (s, c, a, e, r) => {
      for (let k = 0; k < 3; k++) s.part((m) => m.path([[18 + k * 2, 23], [21 + k * 2.5, 26], [21 + k * 3, 30]], 0.8, 0.6), c);
      s.part((m) => m.ell(12, 17, 10, 9).ell(7, 25, 6, 4), a, { k: 1.2 });
      for (let k = 0; k < 18; k++) { const t = k * 0.6, rr = 1 + k * 0.42; s.on(12 + Math.cos(t) * rr, 16 + Math.sin(t) * rr, dk(a, -0.45)); }
      if (r.chance(0.6)) spikes(s, [[6, 10], [11, 8], [16, 9]], lt(a, 0.3), r);
      s.part((m) => m.ell(22, 20, 4.5, 3.6), c);
      s.part((m) => m.path([[24, 20], [27, 16]], 1.3, 1.1), c);
      s.part(wing([[25, 15], [28, 11], [31.5, 13], [29, 14.5], [31, 16.5], [27.5, 17.5]]), lt(c, 0.15), { k: 1.1 });
      s.part((m) => m.path([[24, 22], [28, 23]], 1, 0.9), c);
      s.part((m) => m.ell(29, 23.5, 1.8, 1.4), lt(c, 0.15));
      for (const x of [21, 24]) { s.line(x, 17, x, 13, dk(c, -0.3)); s.part((m) => m.ell(x, 12, 1.3, 1.3), "#f0e8d8", { flat: true, seam: false }); s.px(x + 1, 12, e); }
    },
    // long-tailed lobster
    (s, c, a, e, r) => {
      for (let k = 0; k < 4; k++) s.part((m) => m.path([[14 + k * 2.5, 22], [14 + k * 3, 26], [15 + k * 3, 30]], 0.6, 0.5), dk(c, -0.25), { seam: false });
      const tail: P[] = [[11, 20], [7, 21], [4, 23], [2.5, 26]];
      tail.forEach(([x, y], i) => s.part((m) => m.ell(x, y, 3 - i * 0.4, 2.6 - i * 0.3), c));
      s.part(wing([[3, 26], [0, 30], [5, 29.5]]), a);
      s.part((m) => m.ell(17.5, 19.5, 6.5, 4), c, { k: 1.2 });
      markings(s, 4, 16, 23, 24, a, r, r.int(1, 2));
      s.part((m) => m.path([[22, 18], [25, 14], [27, 13]], 1.1, 1), c);
      s.part(wing([[25, 12.5], [29, 9], [31.5, 11.5], [29, 12], [31, 14], [27, 15]]), lt(c, 0.2), { k: 1.2 });
      s.part((m) => m.path([[22, 21], [26, 23]], 1, 0.9), c);
      s.part(wing([[25, 22], [29, 20.5], [31, 23.5], [28.5, 23.5], [30, 26], [26, 25]]), lt(c, 0.2), { k: 1.2 });
      s.line(23, 16, 30, 3, dk(c, -0.4)); s.line(22, 16, 25, 2, dk(c, -0.4));
      s.px(23, 17, e); s.px(22, 17, K);
    },
  ],
  frog: [
    // warty horned toad
    (s, c, a, e, r) => {
      s.part((m) => m.ell(6, 25.5, 4.6, 4), dk(c, -0.1));
      s.part((m) => m.ell(26, 25.5, 4.6, 4), dk(c, -0.1));
      s.part((m) => m.ell(16, 21, 12, 8), c, { k: 1.1 });
      for (let i = 0; i < 14; i++) { const x = r.int(6, 26), y = r.int(14, 24); s.on(x, y, lt(c, 0.35)); s.on(x, y + 1, dk(c, -0.3)); }
      s.part((m) => m.ell(16, 25.5, 7, 3.4), lt(c, 0.4), { seam: false });
      for (const x of [10, 22]) {
        s.part((m) => m.ell(x, 14, 3.5, 2.8), c);
        s.part((m) => m.ell(x, 14, 1.8, 1.4), e, { flat: true, seam: false });
        s.px(x, 14, K); s.px(x, 13, K);
        s.part(wing([[x - 3, 12.5], [x - 1, 8], [x + 1, 12]]), a);
      }
      s.line(7, 20, 25, 20, dk(c, -0.6)); s.px(6, 19, dk(c, -0.6)); s.px(26, 19, dk(c, -0.6));
      for (const x of [9, 23]) s.part((m) => m.limb(x, 24, x, 29, 1.4, 1.1), c);
    },
    // upright frog warrior with a spear
    (s, c, a, e, r) => {
      s.part((m) => m.limb(27, 30, 27, 6, 0.6, 0.6), WOOD, { seam: false });
      s.part(wing([[25.5, 7], [27, 0.5], [28.5, 7]]), STEEL, { k: 1.2 });
      s.part((m) => m.path([[13, 23], [10, 27], [12, 30]], 1.8, 1.3), dk(c, -0.15));
      s.part((m) => m.path([[18, 23], [21, 27], [19, 30]], 1.8, 1.3), c);
      s.line(9, 31, 14, 31, dk(c, -0.4)); s.line(17, 31, 22, 31, dk(c, -0.4));
      s.part((m) => m.ell(15.5, 18, 6.5, 6.5), c, { k: 1.1 });
      s.part((m) => m.ell(17, 19.5, 4, 4.5), lt(c, 0.45), { seam: false, k: 0.6 });
      s.part(wing([[9.5, 21], [22, 21], [23, 26], [9, 26]]), a);
      for (let x = 10; x < 23; x += 2) s.line(x, 22, x, 26, dk(a, -0.35), true);
      s.part((m) => m.path([[10, 15], [7, 19], [8, 23]], 1.3, 1.1), dk(c, -0.15));
      s.part((m) => m.path([[20, 15], [24, 17], [26.5, 15]], 1.4, 1.2), c);
      s.part((m) => m.ell(17, 9.5, 6.5, 4.5), c);
      s.part((m) => m.ell(14, 5.5, 2.6, 2.6), c);
      s.part((m) => m.ell(20.5, 5.5, 2.6, 2.6), c);
      s.eye(14, 5.5, e, 1.6); s.eye(20.5, 5.5, e, 1.6);
      s.line(13, 11, 23, 12, dk(c, -0.6));
      markings(s, 9, 12, 22, 20, dk(c, -0.3), r, 2);
    },
  ],
  turtle: [
    // tall-domed tortoise grown over with crystals
    (s, c, a, e, r) => {
      const skin = mix(a, "#8a7a6a", 0.4);
      s.part((m) => m.limb(9, 24, 8, 30, 2.4, 2.1), dk(skin, -0.2));
      s.part((m) => m.limb(20, 24, 20, 30, 2.4, 2.1), dk(skin, -0.2));
      s.part((m) => m.ell(15, 17.5, 10, 9.5).clip((_, y) => y <= 25), c, { k: 1.2 });
      s.part((m) => m.ell(15, 25, 11, 1.7), lt(c, 0.2));
      for (const x of [11, 15, 19]) s.line(x, 10, x + (x - 15) * 0.4, 24, dk(c, -0.45), true);
      s.line(5, 18, 25, 18, dk(c, -0.45), true);
      for (const [x, y, h] of [[10, 10, 6], [15, 8, 8], [20, 10, 5]] as const) {
        s.part(wing([[x - 2, y + 2], [x, y - h], [x + 2, y + 2]]), a, { k: 1.4 });
        s.line(x - 0.5, y - h + 2, x - 1, y + 1, lt(a, 0.6), true);
      }
      s.part((m) => m.limb(12, 25, 12, 31, 2.6, 2.2), skin);
      s.part((m) => m.limb(22, 25, 22, 31, 2.6, 2.2), skin);
      s.part((m) => m.limb(24, 22, 27, 20, 1.6, 1.4), skin);
      s.part((m) => m.ell(28.5, 19.5, 2.8, 2.3), skin);
      s.eye(29, 19, e);
    },
    // low, ridged snapping turtle with a big hooked head
    (s, c, a, e, r) => {
      s.part((m) => m.path([[5, 24], [2, 25], [0, 24]], 1.3, 0.5), a);
      s.part((m) => m.limb(8, 25, 6, 30, 1.8, 1.5), dk(a, -0.2));
      s.part((m) => m.ell(14, 21, 12, 5.5).clip((_, y) => y <= 25), c, { k: 1.2 });
      for (const x of [8, 13, 18]) s.line(x, 16, x + 1, 25, dk(c, -0.45), true);
      spikes(s, [[6, 17], [10, 15.5], [14, 15], [18, 15.5], [22, 17]], dk(c, -0.15), r);
      markings(s, 3, 16, 25, 25, a, r, 2);
      s.part((m) => m.limb(12, 25, 11, 30, 2, 1.7), a);
      s.part((m) => m.limb(21, 25, 22, 30, 2, 1.7), a);
      s.part((m) => m.ell(26.5, 21, 4.6, 3.6), a);
      s.part(wing([[28.5, 19], [32, 21], [30.5, 24], [28.5, 22.5]]), dk(a, -0.25), { k: 1.1 });
      s.line(26, 23, 30, 23, dk(a, -0.55));
      s.eye(27, 20, e);
    },
  ],
  plant: [
    // tangle of vines with three biting heads
    (s, c, a, e, r) => {
      s.part(wing([[6, 31], [9, 26], [16, 28], [23, 26], [26, 31]]), dk(c, -0.3));
      const heads: [number, number, number][] = [[7, 14, 4], [16, 8, 5], [25, 15, 4]];
      for (const [x, y] of heads) s.part((m) => m.path([[16, 28], [(16 + x) / 2 + (x < 16 ? -2 : 2), (28 + y) / 2], [x, y + 3]], 1.3, 1), c);
      s.part(wing([[10, 24], [4, 21], [2, 24], [7, 26]]), c);
      s.part(wing([[22, 22], [28, 19], [30, 22], [25, 24]]), c);
      for (const [x, y, rr] of heads) {
        s.part((m) => m.ell(x, y, rr, rr * 0.85), a, { k: 1.1 });
        s.part((m) => m.ell(x + rr * 0.3, y + 0.5, rr * 0.6, rr * 0.4), MAW, { flat: true, seam: false });
        s.px(x, y, TEETH); s.px(x + 1, y + 1, TEETH);
        s.px(x - 1, y - rr * 0.6, e);
      }
    },
    // walking bulb with root legs
    (s, c, a, e, r) => {
      for (const [x0, x1] of [[12, 7], [15, 13], [18, 20], [20, 25]]) s.part((m) => m.path([[x0, 26], [(x0 + x1) / 2, 28.5], [x1, 31]], 1.1, 0.6), dk(c, -0.35));
      for (const [x, h] of [[13, 9], [16, 12], [19, 8]] as const) s.part(wing([[x - 1.5, 14], [x + (x - 16) * 0.5, 14 - h], [x + 1.5, 14]]), a);
      s.part((m) => m.ell(16, 20, 8.5, 8), c, { k: 1.1 });
      for (const x of [11, 16, 21]) s.line(x, 13, x + (x - 16) * 0.3, 27, dk(c, -0.25), true);
      s.eye(14, 18, e, 1.5); s.eye(20, 18, e, 1.5);
      s.part(wing([[12, 22], [21, 22], [19.5, 25], [13.5, 25]]), MAW, { flat: true, seam: false });
      for (const x of [13, 15, 17, 19]) s.px(x, 22, TEETH);
    },
  ],
  fungus: [
    // cluster of three mushrooms
    (s, c, a, e, r) => {
      const stem = mix(c, "#f4ead8", 0.8);
      for (const [x, y, w, h] of [[6, 22, 5, 3.6], [26, 20, 5.5, 4]] as const) {
        s.part((m) => m.limb(x, y + 2, x, 30, 1.6, 2), stem);
        s.part((m) => m.ell(x, y, w, h).clip((_, yy) => yy <= y + 1), dk(c, -0.1), { k: 1.1 });
      }
      s.part((m) => m.ell(16, 24, 5.5, 6.5), stem);
      s.part((m) => m.ell(16, 13, 11, 8).clip((_, y) => y <= 15), c, { k: 1.1 });
      for (let i = 0; i < 6; i++) { const x = r.int(7, 25), y = r.int(6, 13), rr = r.range(1, 1.8); s.part((m) => m.ell(x, y, rr, rr * 0.8), a, { seam: false, k: 0.5 }); }
      s.eye(14, 22, e, 1.3); s.eye(19, 22, e, 1.3);
      s.line(15, 26, 18, 26, dk(stem, -0.6));
    },
    // tall honeycombed morel with glowing spores
    (s, c, a, e, r) => {
      const stem = mix(c, "#f4ead8", 0.8);
      s.part((m) => m.limb(16, 18, 16, 30, 3.2, 3.8), stem);
      s.part((m) => m.limb(12.5, 22, 9, 25, 0.9, 0.8), stem);
      s.part((m) => m.limb(19.5, 22, 23, 25, 0.9, 0.8), stem);
      s.part(wing([[16, 1], [22, 9], [23, 18], [9, 18], [10, 9]]), c, { k: 1.1 });
      for (let y = 4; y < 18; y += 3) s.line(9, y, 23, y + 1, dk(c, -0.45), true);
      for (let x = 11; x < 23; x += 3) s.line(x, 3, x + 1, 18, dk(c, -0.45), true);
      s.eye(14, 23, e, 1.3); s.eye(18.5, 23, e, 1.3);
      for (let i = 0; i < 6; i++) { const x = r.int(1, 30), y = r.int(1, 28); if (!s.get(x, y)) { s.px(x, y, a); s.px(x, y - 1, lt(a, 0.6)); } }
    },
  ],
  treant: [
    // old stump creature with sprouts
    (s, c, a, e, r) => {
      s.part((m) => m.path([[9, 26], [5, 29], [2, 30]], 2.2, 0.9), c);
      s.part((m) => m.path([[23, 26], [27, 29], [30, 30]], 2.2, 0.9), c);
      s.part(wing([[7, 11], [25, 11], [26, 28], [6, 28]]), lt(c, 0.06), { k: 1.1 });
      for (const x of [9, 13, 18, 22]) s.line(x, 13, x + ((x * 5) % 3) - 1, 27, dk(c, -0.3), true);
      s.part((m) => m.ell(16, 11, 9, 2.6), lt(c, 0.35), { k: 0.6 });
      for (const rr of [2, 4.5, 7]) for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2; s.on(16 + Math.cos(t) * rr, 11 + Math.sin(t) * rr * 0.3, dk(c, -0.15)); }
      for (const [x, h] of [[10, 5], [19, 7], [23, 4]] as const) { s.part((m) => m.limb(x, 11, x, 11 - h, 0.5, 0.4), dk(a, -0.2), { seam: false }); s.part((m) => m.ell(x + 1.5, 11 - h, 1.8, 1.1), a); }
      s.part((m) => m.ell(8, 21, 1.6, 1), "#e0c070");
      s.part((m) => m.ell(12.5, 18, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
      s.part((m) => m.ell(19.5, 18, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
      s.px(12, 18, e); s.px(19, 18, e);
      s.part((m) => m.ell(16, 23, 3, 1.4), "#1a120a", { flat: true, seam: false });
    },
    // pine treant in tiers
    (s, c, a, e, r) => {
      s.part((m) => m.path([[12, 25], [9, 28], [6, 30]], 2, 0.9), c);
      s.part((m) => m.path([[20, 25], [23, 28], [26, 30]], 2, 0.9), c);
      s.part(wing([[12, 14], [20, 14], [21, 27], [11, 27]]), lt(c, 0.06));
      s.part((m) => m.path([[12, 19], [6, 20], [3, 17]], 1.3, 0.7), c);
      s.part((m) => m.path([[20, 19], [26, 20], [29, 17]], 1.3, 0.7), c);
      for (const [y, w] of [[17, 13], [11, 10], [5, 7]] as const) {
        s.part(wing([[16 - w, y + 1], [16, y - 7], [16 + w, y + 1]]), a, { k: 1.1 });
        for (let x = 16 - w + 2; x < 16 + w - 1; x += 3) s.on(x, y, lt(a, 0.75));
      }
      s.part((m) => m.ell(14, 21, 1.4, 1.2), "#1a120a", { flat: true, seam: false });
      s.part((m) => m.ell(18.5, 21, 1.4, 1.2), "#1a120a", { flat: true, seam: false });
      s.px(14, 21, e); s.px(18, 21, e);
      s.line(14, 24, 18, 24, "#1a120a");
    },
  ],
  golem: [
    // angular crystal golem
    (s, c, a, e, r) => {
      s.part(wing([[10, 22], [14, 22], [15, 30.5], [8.5, 30.5]]), dk(c, -0.15), { k: 1.3 });
      s.part(wing([[18, 22], [22, 22], [23.5, 30.5], [17, 30.5]]), c, { k: 1.3 });
      s.part(wing([[16, 6], [25, 12], [22, 23], [10, 23], [7, 12]]), c, { k: 1.4 });
      s.line(16, 6, 16, 23, lt(c, 0.5), true); s.line(7, 12, 22, 23, dk(c, -0.4), true);
      s.part(wing([[4, 10], [9, 9], [8, 20], [3, 18]]), c, { k: 1.4 });
      s.part(wing([[23, 9], [29, 10], [29, 19], [24, 20]]), c, { k: 1.4 });
      s.part(wing([[3, 20], [8, 20], [7, 26], [2, 24]]), lt(c, 0.15), { k: 1.3 });
      s.part(wing([[24, 20], [29, 20], [30, 25], [25, 26]]), lt(c, 0.15), { k: 1.3 });
      s.part(wing([[12, 6], [16, 0], [20, 6], [16, 9]]), lt(c, 0.1), { k: 1.3 });
      s.px(15, 5, e); s.px(17, 5, e);
      s.part((m) => m.ell(16, 15, 2, 2.4), a, { k: 0.5 });
      s.px(15, 14, "#ffffff");
    },
    // floating stones held together by runes
    (s, c, a, e, r) => {
      s.part((m) => m.ell(16, 30.5, 8, 1.2), dk(c, -0.5), { flat: true });
      s.part((m) => m.ell(16, 17, 7, 6), c, { k: 1.2 });
      for (let i = 0; i < 3; i++) { const x = r.int(11, 20), y = r.int(13, 20); s.line(x, y, x + r.int(-2, 2), y + 3, dk(c, -0.5), true); }
      s.part((m) => m.ell(16, 17, 1.8, 1.8), e, { flat: true });
      s.px(16, 17, "#ffffff");
      for (const [x, y] of [[13, 14], [19, 14], [13, 20], [19, 20]]) s.on(x, y, a);
      s.part((m) => m.ell(5, 17, 3.4, 3), c, { k: 1.2 });
      s.part((m) => m.ell(27, 16, 3.6, 3.2), c, { k: 1.2 });
      s.part((m) => m.ell(11, 26.5, 2.6, 2), dk(c, -0.1));
      s.part((m) => m.ell(21, 26.5, 2.6, 2), dk(c, -0.1));
      s.part((m) => m.ell(16, 6.5, 4, 3.4), c, { k: 1.2 });
      s.px(15, 6, e); s.px(18, 6, e);
      for (const [x, y] of [[9, 17], [23, 16], [16, 10.5], [13, 24], [19, 24]]) { s.px(x, y, a); s.px(x, y + 1, lt(a, 0.5)); }
    },
  ],
  mech: [
    // four-legged walker with a cannon
    (s, c, a, e, r) => {
      for (const [x0, x1, x2] of [[11, 5, 3], [21, 27, 29], [13, 10, 9], [19, 22, 23]] as const) s.part((m) => m.path([[x0, 18], [x1, 14], [x2, 30]], 1, 0.8), dk(c, -0.25), { k: 1.2 });
      s.part((m) => m.ell(16, 16, 8.5, 5.5), c, { k: 1.3 });
      s.line(8, 17, 24, 17, dk(c, -0.45), true);
      s.part((m) => m.rect(22, 13, 9, 2), dk(c, -0.15), { k: 1.2 });
      s.px(31, 13, a);
      s.part((m) => m.ell(16, 12.5, 4, 2.6), e, { flat: true });
      s.px(15, 12, "#ffffff");
      s.line(11, 11, 11, 6, dk(c, -0.4)); s.px(11, 5, a);
      for (const x of [10, 13, 19, 22]) s.on(x, 19, a);
    },
    // hovering rotor drone
    (s, c, a, e, r) => {
      for (const d of [-1, 1]) {
        s.line(16 + d * 5, 11, 16 + d * 11, 7, dk(c, -0.35));
        s.part((m) => m.ell(16 + d * 11, 6, 4.5, 0.9), mix(GLASS, c, 0.3), { k: 0.4, seam: false });
        s.px(16 + d * 11, 7, dk(c, -0.4));
      }
      s.part((m) => m.ell(16, 15, 7, 6.5), c, { k: 1.3 });
      for (let x = 10; x < 23; x += 3) s.on(x, 19, a);
      s.part((m) => m.ell(17, 15, 3, 3), dk(c, -0.6), { flat: true });
      s.part((m) => m.ell(17.5, 15, 1.8, 1.8), e, { flat: true });
      s.px(17, 14, "#ffffff");
      for (const d of [-1, 1]) s.part((m) => m.path([[16 + d * 3, 21], [16 + d * 5, 25], [16 + d * 3, 28]], 0.7, 0.5), dk(c, -0.3), { seam: false });
    },
  ],
  knight: [
    // spearman behind a tower shield
    (s, c, a, e, r) => {
      s.part((m) => m.limb(24, 30, 26, 0.5, 0.6, 0.6), WOOD, { seam: false });
      s.part(wing([[24.5, 3], [26, -1], [27.5, 3], [26, 5]]), STEEL, { k: 1.3 });
      s.part((m) => m.limb(13, 22, 12, 30, 2.2, 2), dk(c, -0.2));
      s.part((m) => m.limb(19, 22, 20, 30, 2.3, 2), c, { k: 1.3 });
      s.part((m) => m.ell(16, 16, 6.5, 7.5), c, { k: 1.4 });
      s.part((m) => m.path([[21, 13], [24, 15], [25, 14]], 1.6, 1.4), c, { k: 1.3 });
      s.part((m) => m.ell(16.5, 6.5, 5, 5.2), c, { k: 1.4 });
      s.part((m) => m.rect(15, 5, 7, 1.6), K, { flat: true, seam: false });
      s.px(18, 5, e); s.px(20, 5, e);
      s.part((m) => m.rect(4, 10, 9, 18), a, { k: 1.2 });
      s.line(8, 10, 8, 27, dk(a, -0.4), true); s.line(4, 18, 12, 18, dk(a, -0.4), true);
      for (const [x, y] of [[5, 11], [11, 11], [5, 26], [11, 26]]) s.px(x, y, lt(a, 0.6));
    },
    // heavy axeman with a horned helm
    (s, c, a, e, r) => {
      s.part((m) => m.limb(27, 28, 23, 4, 0.7, 0.7), WOOD, { seam: false });
      s.part(wing([[23.5, 4], [30, 1], [31, 9], [24.5, 9.5]]), STEEL, { k: 1.4 });
      s.part(wing([[23, 5], [18, 3], [19, 9], [23.5, 8]]), STEEL, { k: 1.4 });
      s.part((m) => m.limb(12, 22, 11, 30, 2.5, 2.2), dk(c, -0.2));
      s.part((m) => m.limb(19, 22, 20, 30, 2.6, 2.2), c, { k: 1.3 });
      s.part((m) => m.ell(15.5, 16, 7.5, 8), c, { k: 1.4 });
      s.part((m) => m.ell(9, 11, 3.5, 2.6), a, { k: 1.2 });
      s.part((m) => m.ell(22, 11, 3.5, 2.6), a, { k: 1.2 });
      s.part((m) => m.rect(9, 21, 13, 2), dk(a, -0.3));
      s.part((m) => m.path([[21, 14], [24, 17], [25.5, 16]], 1.8, 1.6), c, { k: 1.3 });
      s.part((m) => m.ell(16, 6, 5, 5), c, { k: 1.4 });
      s.part((m) => m.path([[12, 4], [9, 2], [8, -1]], 1.2, 0.5), BONE);
      s.part((m) => m.path([[20, 4], [23, 2], [24, -1]], 1.2, 0.5), BONE);
      s.part((m) => m.rect(13, 6, 7, 1.6), K, { flat: true, seam: false });
      s.px(15, 6, e); s.px(18, 6, e);
    },
  ],
  skeleton: [
    // skeleton archer
    (s, c, a, e, r) => {
      s.part((m) => m.limb(13, 22, 12, 30, 0.9, 0.8), dk(BONE, -0.15));
      s.part((m) => m.limb(19, 22, 20, 30, 0.9, 0.8), BONE);
      s.part((m) => m.limb(16, 12, 16, 22, 0.8, 0.8), dk(BONE, -0.2));
      for (let y = 13; y <= 19; y += 2) s.part((m) => m.ell(16, y, 4.5 - (y - 13) * 0.25, 0.8), BONE, { k: 0.6 });
      s.part(wing([[12, 22], [20, 22], [21, 27], [16, 25], [11, 27]]), c);
      s.part((m) => m.path([[12, 12], [9, 17], [8, 22]], 0.8, 0.8), BONE);
      s.part((m) => m.path([[25, 3], [28.5, 9], [29, 16], [28.5, 23], [25, 29]], 0.7, 0.7), WOOD, { seam: false });
      s.line(25, 3, 25, 29, "#e8e0cc");
      s.line(20, 16, 30, 16, a); s.px(31, 16, STEEL); s.px(19, 15, a); s.px(19, 17, a);
      s.part((m) => m.path([[20, 12], [23, 15], [27, 16]], 0.8, 0.8), BONE);
      s.part((m) => m.ell(16.5, 6.5, 6, 5.6).clip((_, y) => y <= 8), c, { k: 1.1 });
      s.part((m) => m.ell(17, 7.5, 4.5, 4.2), BONE);
      s.part((m) => m.ell(16.5, 7.5, 1.3, 1.4), K, { flat: true, seam: false });
      s.part((m) => m.ell(19.5, 7.5, 1.2, 1.4), K, { flat: true, seam: false });
      s.px(16, 7, e); s.px(19, 7, e);
      for (const x of [16, 18]) s.px(x, 11, dk(BONE, -0.45));
    },
    // skeleton mage in a robe
    (s, c, a, e, r) => {
      s.part((m) => m.limb(25, 30, 25, 6, 0.6, 0.6), WOOD, { seam: false });
      s.part((m) => m.ell(25, 4.5, 2.2, 2.2), e, { k: 0.5 });
      s.px(24, 4, "#ffffff");
      s.part(wing([[10, 12], [22, 12], [24, 30], [8, 30]]), c, { k: 1.1 });
      for (const x of [12, 16, 20]) s.line(x, 14, x + (x - 16) * 0.3, 29, dk(c, -0.4), true);
      s.part((m) => m.rect(10, 18, 13, 1.4), a);
      s.part((m) => m.path([[20, 13], [23, 15], [25, 14]], 1.4, 1.1), c);
      s.px(25, 13, BONE); s.px(26, 14, BONE);
      s.part((m) => m.ell(16.5, 8, 4.6, 4.2), BONE);
      s.part(wing([[10.5, 6], [16, -1], [22.5, 6]]), a, { k: 1.1 });
      s.part((m) => m.ell(15, 8.5, 1.3, 1.4), K, { flat: true, seam: false });
      s.part((m) => m.ell(18.5, 8.5, 1.3, 1.4), K, { flat: true, seam: false });
      s.px(15, 8, e); s.px(18, 8, e);
      for (const x of [15, 17, 19]) s.px(x, 11, dk(BONE, -0.45));
    },
  ],
  ghost: [
    // chained spirit with a long tail
    (s, c, a, e, r) => {
      s.part((m) => m.path([[15, 16], [12, 22], [7, 26], [3, 25], [2, 21]], 5.5, 0.8), c, { k: 0.8 });
      s.part((m) => m.ell(17, 11, 8, 8), c, { k: 0.8 });
      s.part((m) => m.path([[10, 13], [6, 15], [4, 13]], 1.4, 1), c, { k: 0.8 });
      s.part((m) => m.path([[24, 13], [28, 16], [29, 19]], 1.4, 1), c, { k: 0.8 });
      for (const [x, y] of [[4, 13], [29, 19]]) s.part((m) => m.rect(x - 1, y - 1, 3, 2), dk(a, -0.2), { k: 1.2 });
      for (let k = 0; k < 6; k++) { s.px(29 + (k % 2), 21 + k * 1.6, k % 2 ? dk(a, -0.3) : a); s.px(3 - (k % 2), 15 + k * 1.6, k % 2 ? dk(a, -0.3) : a); }
      s.part((m) => m.ell(14.5, 10, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
      s.part((m) => m.ell(20.5, 10, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
      s.px(14, 9, e); s.px(20, 9, e);
      s.part((m) => m.ell(17.5, 15, 2, 1.4), "#2a2440", { flat: true, seam: false });
    },
    // skull under a drifting shroud
    (s, c, a, e, r) => {
      s.part(wing([[8, 8], [24, 8], [27, 20], [25, 28], [22, 25], [19, 30], [16, 26], [12, 30], [9, 26], [6, 28], [5, 18]]), c, { k: 0.8 });
      for (const x of [10, 15, 20]) s.line(x, 14, x - 1, 27, dk(c, -0.3), true);
      s.part((m) => m.ell(16.5, 11, 5, 4.6), BONE);
      s.part((m) => m.rect(14, 14, 6, 2), BONE);
      s.part((m) => m.ell(14.5, 11, 1.4, 1.6), K, { flat: true, seam: false });
      s.part((m) => m.ell(18.5, 11, 1.4, 1.6), K, { flat: true, seam: false });
      s.glow(14, 11, e); s.glow(19, 11, e);
      for (const x of [15, 17, 19]) s.px(x, 15, dk(BONE, -0.45));
      s.part((m) => m.ell(16, 6, 9, 4).clip((_, y) => y <= 7), c, { k: 0.8 });
      if (r.chance(0.5)) s.part((m) => m.rect(10, 17, 13, 1), a, { flat: true });
    },
  ],
  wraith: [
    // crowned wraith carrying a lantern
    (s, c, a, e, r) => {
      s.part((m) => m.limb(27, 30, 27, 8, 0.6, 0.6), "#5a4a3a", { seam: false });
      s.line(27, 8, 27, 11, "#3a3040");
      s.part((m) => m.ell(27, 14, 2.4, 2.8), FLAME, { k: 0.6 });
      s.part((m) => m.ell(27, 14, 1, 1.4), "#fff0a0", { flat: true, seam: false });
      s.part(wing([[11, 8], [21, 8], [25, 20], [26, 30], [22, 27], [19, 31], [16, 27], [12, 31], [9, 27], [5, 30], [8, 18]]), c, { k: 1.1 });
      for (const x of [11, 15, 19]) s.line(x, 14, x - 1 + (x > 16 ? 2 : 0), 28, dk(c, -0.4), true);
      s.part((m) => m.ell(16, 9, 6.5, 6.5), dk(c, -0.1));
      s.part((m) => m.ell(17.5, 10, 3.6, 4), "#0e0a16", { flat: true, seam: false });
      s.px(16, 9, e); s.px(19, 9, e);
      s.part(wing([[11, 4], [11.5, -0.5], [13.5, 2], [16, -1], [18.5, 2], [20.5, -0.5], [21, 4]]), a, { k: 0.8 });
      s.part((m) => m.path([[21, 13], [25, 12], [26.5, 11]], 1.4, 1.1), c);
    },
    // many-armed shadow
    (s, c, a, e, r) => {
      for (const [pts, col] of [[[[14, 14], [8, 9], [3, 11]], dk(c, -0.25)], [[[18, 14], [24, 9], [29, 10]], dk(c, -0.25)], [[[14, 17], [7, 19], [3, 24]], c], [[[18, 17], [25, 19], [29, 24]], c]] as [P[], string][]) {
        s.part((m) => m.path(pts, 1.4, 0.6), col, { k: 0.8 });
        const [x, y] = pts[2];
        for (const d of [-1, 0, 1]) s.px(x + (x < 16 ? -1 : 1), y + d, "#d8d0c0");
      }
      s.part(wing([[11, 8], [21, 8], [24, 22], [25, 30], [21, 27], [18, 31], [15, 27], [11, 31], [8, 27], [7, 18]]), c, { k: 1.1 });
      markings(s, 8, 12, 24, 29, a, r, 1);
      s.part((m) => m.ell(16, 8, 5.5, 5.5), dk(c, -0.1));
      s.part((m) => m.ell(16.5, 9, 3.4, 3.6), "#0e0a16", { flat: true, seam: false });
      for (const [x, y] of [[15, 8], [18, 8], [16.5, 10.5]]) s.px(x, y, e);
    },
  ],
  eye: [
    // eye on bat wings
    (s, c, a, e, r) => {
      const L: P[] = [[9, 15], [5, 6], [0.5, 7], [2, 11], [0, 14], [4, 15], [2, 19], [8, 18]];
      s.part(wing(L), dk(c, -0.2), { k: 0.8 });
      s.part(wing(mirror(L)), dk(c, -0.2), { k: 0.8 });
      for (const [x, y] of [[0.5, 7], [0, 14], [2, 19]]) { s.line(9, 15, x, y, dk(c, -0.5), true); s.line(23, 15, 32 - x, y, dk(c, -0.5), true); }
      s.part((m) => m.path([[16, 24], [15, 28], [18, 30]], 1, 0.4), c, { seam: false });
      s.part((m) => m.ell(16, 16, 8, 8), "#f0ece0", { k: 0.6 });
      for (let k = 0; k < 4; k++) { const t = r.range(0, Math.PI * 2); s.line(16 + Math.cos(t) * 7, 16 + Math.sin(t) * 7, 16 + Math.cos(t) * 5, 16 + Math.sin(t) * 5, "#d84a4a", true); }
      s.part((m) => m.ell(17.5, 15.5, 4.5, 4.5), e, { k: 0.8 });
      s.part((m) => m.ell(18, 15.5, 1.3, 2.8), K, { flat: true, seam: false });
      s.px(16, 13, "#ffffff");
      s.part((m) => m.ell(16, 16, 8.5, 8.5).clip((_, y) => y <= 10), c);
    },
    // fleshy mass of three eyes
    (s, c, a, e, r) => {
      for (const x of [8, 13, 19, 24]) s.part((m) => m.path([[x, 24], [x + r.range(-2, 2), 28], [x + r.range(-2, 2), 31]], 1.4, 0.5), dk(c, -0.15));
      s.part((m) => m.ell(16, 18, 12, 9), c, { k: 1.1 });
      markings(s, 5, 10, 27, 26, a, r, 2);
      for (const [x, y, rr] of [[11, 15, 4.5], [21, 13, 3.5], [19, 21, 3]] as const) {
        s.part((m) => m.ell(x, y, rr, rr), "#f0ece0", { k: 0.6 });
        s.part((m) => m.ell(x + rr * 0.25, y, rr * 0.6, rr * 0.6), e, { k: 0.7 });
        s.part((m) => m.ell(x + rr * 0.3, y, rr * 0.2, rr * 0.45), K, { flat: true, seam: false });
        s.px(x - rr * 0.3, y - rr * 0.4, "#ffffff");
      }
    },
  ],
  jelly: [
    // squid
    (s, c, a, e, r) => {
      for (const [x, p] of [[10, 0], [13, 1], [16, 2], [19, 3], [22, 4]]) s.part((m) => m.path([[x, 20], [x + Math.sin(p) * 2, 25], [x + Math.sin(p + 2) * 2, 30]], 0.9, 0.4), dk(c, -0.1), { k: 0.7 });
      s.part((m) => m.path([[12, 21], [7, 26], [3, 25], [2, 22]], 0.8, 0.5), a);
      s.part((m) => m.path([[20, 21], [25, 26], [29, 25], [30, 22]], 0.8, 0.5), a);
      s.part(wing([[16, 1], [21, 8], [22, 20], [10, 20], [11, 8]]), c, { k: 1.1 });
      s.part(wing([[11, 6], [6, 9], [11, 12]]), dk(c, -0.15));
      s.part(wing([[21, 6], [26, 9], [21, 12]]), dk(c, -0.15));
      markings(s, 11, 4, 21, 18, a, r, 2);
      s.eye(13, 16, e, 1.6); s.eye(19, 16, e, 1.6);
    },
    // floating man-o'-war
    (s, c, a, e, r) => {
      for (const x of [9, 12, 15, 18, 21, 24]) { const p = r.range(0, 3); s.part((m) => m.path([[x, 13], [x + Math.sin(p), 20], [x + Math.sin(p + 2) * 1.5, 26], [x + Math.sin(p + 3), 31]], 0.6, 0.4), a, { seam: false, k: 0.5 }); for (let y = 16; y < 30; y += 4) s.on(x + Math.sin(p + y), y, lt(a, 0.5)); }
      s.part((m) => m.ell(16, 11, 11, 4.5), c, { k: 0.6 });
      s.part(wing([[8, 9], [12, 2], [17, 4], [22, 1], [25, 8]]), lt(a, 0.15), { k: 0.6 });
      for (const x of [12, 16, 20]) s.line(x, 8, x, 3, dk(a, -0.3), true);
      s.part((m) => m.ell(13, 10, 4, 1.6), lt(c, 0.5), { seam: false, k: 0.4 });
      s.eye(19, 12, e, 1.2); s.eye(23, 12, e);
    },
  ],
  elemental: [
    // humanoid of dark rock split by its burning core
    (s, c, a, e, r) => {
      const rock = mix(c, "#3a3040", 0.65);
      s.part((m) => m.limb(12, 22, 11, 30, 2.2, 1.9), dk(rock, -0.15));
      s.part((m) => m.limb(20, 22, 21, 30, 2.3, 2), rock);
      s.part((m) => m.ell(16, 16, 7, 7.5), rock, { k: 1.2 });
      s.part((m) => m.path([[10, 12], [6, 17], [5, 22]], 2, 1.7), rock);
      s.part((m) => m.path([[22, 12], [26, 16], [27, 21]], 2, 1.7), rock);
      for (let i = 0; i < 6; i++) { const x = r.int(10, 22), y = r.int(10, 22); s.line(x, y, x + r.int(-3, 3), y + r.int(2, 4), c, true); }
      s.part((m) => m.ell(16, 16, 2.6, 3), c, { k: 0.4 });
      s.px(16, 16, "#ffffff");
      s.part((m) => m.ell(16.5, 6, 4.5, 4), rock, { k: 1.2 });
      s.part((m) => m.poly([[13, 4], [16, -1], [20, 4]]), c, { k: 0.5 });
      s.px(15, 6, c); s.px(19, 6, c); s.px(15, 5, lt(c, 0.6)); s.px(19, 5, lt(c, 0.6));
    },
    // orb ringed by orbiting shards
    (s, c, a, e, r) => {
      for (let k = 0; k < 48; k++) { const t = (k / 48) * Math.PI * 2; if (Math.sin(t) < 0) s.px(16 + Math.cos(t) * 13, 16 + Math.sin(t) * 4, dk(a, -0.2)); }
      s.part((m) => m.ell(16, 16, 8, 8), c, { k: 0.6 });
      s.part((m) => m.ell(16, 16, 5, 5), lt(c, 0.4), { seam: false, k: 0.4 });
      s.part((m) => m.ell(16, 16, 2.4, 2.4), "#ffffff", { flat: true, seam: false });
      s.part((m) => m.ell(14, 15, 0.8, 1.3), dk(c, -0.6), { flat: true, seam: false });
      s.part((m) => m.ell(18.5, 15, 0.8, 1.3), dk(c, -0.6), { flat: true, seam: false });
      for (let k = 0; k < 48; k++) { const t = (k / 48) * Math.PI * 2; if (Math.sin(t) >= 0) s.px(16 + Math.cos(t) * 13, 16 + Math.sin(t) * 4, a); }
      for (const [x, y] of [[4, 13], [27, 20], [9, 4], [24, 4]]) s.part(wing([[x - 1.5, y + 1.5], [x, y - 2.5], [x + 1.5, y + 1.5]]), a, { k: 1.2 });
      s.px(16, 24, e);
    },
  ],
  dragon: [
    // heavy wingless drake
    (s, c, a, e, r) => {
      const far = dk(c, -0.22);
      s.part((m) => m.limb(9, 22, 8, 30, 2.6, 2.2), far);
      s.part((m) => m.limb(20, 22, 21, 30, 2.6, 2.2), far);
      s.part((m) => m.path([[6, 21], [2, 23], [0, 27]], 3, 0.8), c);
      s.part((m) => m.ell(14, 19, 10, 7), c, { k: 1.2 });
      s.part((m) => m.ell(15, 24, 7, 2), a, { seam: false, k: 0.6 });
      for (const x of [11, 14, 17]) s.on(x, 24, dk(a, -0.3));
      spikes(s, [[6, 14], [10, 12.5], [14, 12], [18, 12.5], [22, 14]], a, r);
      s.part((m) => m.limb(12, 24, 11, 31, 2.9, 2.4), c);
      s.part((m) => m.limb(22, 23, 23, 31, 2.9, 2.4), c);
      for (const x of [10, 12, 22, 24]) s.px(x, 31, lt(a, 0.3));
      s.part((m) => m.ell(25.5, 14, 5, 4.2), c);
      s.part(wing([[22, 10], [21, 5], [25, 9]]), a);
      s.part(wing([[26, 10], [27, 5], [29, 10]]), a);
      s.part(wing([[27, 13], [32, 14.5], [31.5, 17.5], [27, 18]]), c);
      s.line(28, 17, 31, 17, dk(c, -0.55)); s.px(29, 18, TEETH); s.px(31, 18, TEETH);
      s.eye(26, 13, e);
    },
    // wyvern with wings for arms
    (s, c, a, e, r) => {
      s.part(wing([[15, 12], [19, 2], [25, 2], [22, 6], [24, 9], [19, 12]]), dk(c, -0.3), { k: 0.8 });
      s.part((m) => m.path([[11, 21], [10, 26], [12, 30]], 2, 1.3), dk(c, -0.22));
      s.part((m) => m.path([[9, 19], [4, 18], [1, 13], [2, 9]], 2.6, 0.6), c);
      s.part(wing([[1, 10], [3, 6], [4.5, 10]]), a);
      s.part((m) => m.ell(13.5, 18, 6.5, 5), c, { k: 1.1 });
      s.part((m) => m.ell(14, 21.5, 4.5, 1.5), a, { seam: false, k: 0.6 });
      s.part((m) => m.path([[15, 21], [16, 26], [15, 30]], 2.2, 1.4), c);
      s.line(13, 31, 18, 31, lt(a, 0.3));
      s.part((m) => m.path([[18, 15], [22, 11], [24, 8]], 2.2, 1.8), c);
      s.part((m) => m.ell(26, 7.5, 3.6, 2.8), c);
      s.part(wing([[27, 6], [31.5, 7.5], [31, 10], [27, 10]]), c);
      s.px(29, 10, TEETH); s.px(31, 7, K);
      s.part((m) => m.path([[25, 5], [23, 2], [21, 1]], 0.8, 0.4), a);
      s.eye(26, 6, e);
      s.part(wing([[13, 14], [7, 4], [2, 3], [5, 7], [1, 10], [6, 11], [4, 15], [9, 15], [10, 19]]), dk(c, -0.12), { k: 0.8 });
      for (const [x, y] of [[2, 3], [1, 10], [4, 15]]) s.line(13, 14, x, y, dk(c, -0.45), true);
      s.px(7, 4, TEETH);
    },
  ],
  hydra: [
    // five small heads
    (s, c, a, e, r) => {
      const head = (x: number, y: number, col: string) => {
        s.part((m) => m.ell(x, y, 2.6, 2), col);
        s.part(wing([[x + 1, y - 1], [x + 4, y], [x + 3.5, y + 1.5], [x + 1, y + 1.5]]), col);
        s.px(x, y - 1, e);
      };
      const necks: [number, number, string][] = [[4, 9, dk(c, -0.25)], [10, 4, dk(c, -0.15)], [17, 2, c], [23, 5, c], [27, 11, c]];
      s.part((m) => m.ell(16, 24, 11, 6.5), c, { k: 1.1 });
      for (const [x, y, col] of necks) { s.part((m) => m.path([[16 + (x - 16) * 0.3, 20], [x + (16 - x) * 0.2, y + 7], [x, y + 2]], 1.8, 1.3), col); head(x, y, col); }
      s.part((m) => m.ell(16, 27, 7, 2), a, { seam: false, k: 0.6 });
      for (const x of [8, 23]) s.part((m) => m.limb(x, 27, x, 31, 2, 1.8), c);
    },
    // two heads up front and a biting tail
    (s, c, a, e, r) => {
      const head = (x: number, y: number, col: string) => {
        s.part((m) => m.ell(x, y, 3.4, 2.6), col);
        s.part(wing([[x + 1, y - 1.5], [x + 5, y], [x + 4.5, y + 2], [x + 1, y + 2]]), col);
        s.line(x + 2, y + 1, x + 4, y + 1, dk(col, -0.55));
        s.eye(x, y - 1, e);
      };
      s.part((m) => m.path([[8, 22], [3, 18], [2, 11], [5, 8]], 2.4, 1.6), dk(c, -0.15));
      s.part((m) => m.ell(5, 7, 2.6, 2.2), dk(c, -0.15));
      s.part(wing([[6, 5], [9, 3.5], [8.5, 6.5]]), MAW, { flat: true });
      s.px(4, 6, e);
      s.part((m) => m.ell(15, 23, 10.5, 7), c, { k: 1.1 });
      s.part((m) => m.ell(16, 27, 7, 2.2), a, { seam: false, k: 0.6 });
      for (const x of [9, 22]) s.part((m) => m.limb(x, 26, x, 30, 2, 1.8), c);
      spikes(s, [[9, 17], [13, 16], [17, 16]], a, r);
      s.part((m) => m.path([[17, 19], [17, 12], [19, 7]], 2.4, 2), dk(c, -0.15));
      head(20, 6, dk(c, -0.15));
      s.part((m) => m.path([[21, 21], [25, 16], [26, 12]], 2.6, 2), c);
      head(26.5, 11, c);
    },
  ],
  mimic: [
    // barrel mimic
    (s, c, a, e, r) => {
      s.part((m) => m.ell(16, 8, 9, 2.5), MAW, { flat: true });
      s.part((m) => m.ell(16, 19, 10, 11).clip((_, y) => y >= 9 && y <= 30), c, { k: 1.1 });
      for (const x of [10, 14, 18, 22]) s.line(x, 10, x, 29, dk(c, -0.35), true);
      for (const y of [13, 25]) s.part((m) => m.rect(6, y, 20, 1.6), a, { k: 1.3 });
      for (let x = 9; x < 24; x += 2) s.px(x, 9 + (x % 4 === 1 ? 1 : 0), TEETH);
      s.part((m) => m.path([[16, 9], [21, 6], [26, 7], [29, 11]], 1.3, 0.7), "#e04a6a");
      s.eye(12, 18, e, 1.5); s.eye(20, 18, e, 1.5);
      s.part(wing([[4, 6], [17, 1], [19, 3], [6, 8.5]]), c, { k: 1.1 });
    },
    // cursed urn with a mouth on its belly
    (s, c, a, e, r) => {
      s.part((m) => m.ell(16, 20, 10, 9).rect(11, 6, 10, 6).rect(9, 5, 14, 2).rect(11, 28, 10, 3), c, { k: 1.2 });
      s.part((m) => m.path([[7, 13], [3, 15], [5, 20]], 1, 0.9), c);
      s.part((m) => m.path([[25, 13], [29, 15], [27, 20]], 1, 0.9), c);
      for (const y of [14, 27]) s.line(7, y, 25, y, a, true);
      markings(s, 7, 15, 25, 26, a, r, 1);
      s.part(wing([[10, 20], [22, 20], [20, 25], [12, 25]]), MAW, { flat: true, seam: false });
      for (const x of [11, 13, 15, 17, 19, 21]) { s.px(x, 20, TEETH); s.px(x + 0.5, 25, TEETH); }
      s.eye(12.5, 16, e, 1.3); s.eye(19.5, 16, e, 1.3);
      for (let i = 0; i < 3; i++) { const x = r.int(9, 23), y = r.int(9, 27); s.line(x, y, x + 2, y + 3, dk(c, -0.5), true); }
    },
  ],
};
