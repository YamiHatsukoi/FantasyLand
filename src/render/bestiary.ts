import { K, Sprite } from "./parts";
import { tint } from "../data/enemies";
import { shrink32 } from "./creatures";

/**
 * Hand-drawn 32x32 sprites for the named monsters of the first floors (slime, wolf, wasp...).
 *
 * Built with the shared part engine (see parts.ts). Sprites face right, like the procedural
 * creatures.
 */

type Draw = (s: Sprite) => void;

const BEASTS: Record<string, Draw> = {
  // ------------------------------------------------------------ floor 1: the green woods
  slime: (s) => {
    s.part((m) => m.ell(16, 21, 12.5, 9).clip((_, y) => y <= 29), "#5cc04a", { k: 1.1 });
    // jelly drips and the bubbles trapped inside
    s.part((m) => m.ell(6, 27, 2.2, 2.6), "#4aa83c");
    s.part((m) => m.ell(27, 28, 1.8, 2), "#4aa83c");
    for (const [x, y] of [[9, 24], [13, 26], [22, 25], [24, 18]]) { s.px(x, y, "#a8f08a"); s.px(x + 1, y - 1, "#e8ffd8"); }
    // moss cap with a little sprout
    s.part((m) => m.ell(14, 13.5, 8, 3).clip((_, y) => y <= 14), "#3a7a2a", { k: 0.8 });
    for (const x of [7, 10, 13, 17, 20]) s.px(x, 14 + (x % 2), "#2c5e22");
    s.part((m) => m.limb(15, 12, 16, 7, 0.6, 0.5), "#3c8a2c", { seam: false });
    s.part((m) => m.ell(13.5, 7, 2.4, 1.2), "#6ad04e");
    s.part((m) => m.ell(18.5, 6, 2.4, 1.2), "#7ae05a");
    // glossy shine
    s.part((m) => m.ell(9.5, 17.5, 2.5, 1.6), "#d8ffc0", { flat: true, seam: false });
    s.px(13, 16, "#d8ffc0");
    // face
    s.eye(16, 21, "#1e3a1a", 2);
    s.eye(23, 21, "#1e3a1a", 2);
    s.line(18, 25, 21, 25, "#1e3a1a");
    s.px(17, 24, "#1e3a1a"); s.px(22, 24, "#1e3a1a");
    s.px(14, 24, "#ff8a8a"); s.px(25, 24, "#ff8a8a");
  },
  wolf: (s) => {
    const fur = "#7a8090", far = "#5a6070";
    // far legs first
    s.part((m) => m.path([[10, 20], [9, 25], [10, 29]], 1.5, 1.1), far);
    s.part((m) => m.limb(21, 21, 22, 29, 1.4, 1.1), far);
    // bushy tail
    s.part((m) => m.path([[7, 17], [3, 14], [1, 9]], 2.4, 1.2), fur);
    s.part((m) => m.ell(1.5, 8.5, 1.4, 1.6), "#d0d4dc", { seam: false });
    s.part((m) => m.ell(14, 18, 8.5, 5.5), fur);
    s.part((m) => m.ell(21, 16, 5, 6), fur);
    // near legs
    s.part((m) => m.path([[13, 21], [12, 25], [13, 29]], 1.8, 1.2), fur);
    s.part((m) => m.limb(24, 20, 25, 29, 1.6, 1.2), fur);
    for (const x of [10, 13, 22, 25]) s.px(x, 30, "#3a3a48");
    // pale belly and chest ruff
    s.part((m) => m.ell(15, 22, 5, 1.1), "#b8bcc8", { seam: false, shine: false });
    s.part((m) => m.poly([[20, 14], [26, 15], [24, 23], [21, 20]]), "#d8dce4");
    // head + snout + ears
    s.part((m) => m.ell(25, 11, 4.5, 4), fur);
    s.part((m) => m.poly([[26, 10], [31.5, 12], [31.5, 14.5], [26, 15]]), "#8a90a0");
    s.part((m) => m.poly([[21.5, 9], [22.5, 3], [25, 8]]), far);
    s.part((m) => m.poly([[24.5, 8], [26.5, 2.5], [28, 9]]), fur);
    s.px(26, 6, "#e0a0a8"); s.px(26, 7, "#e0a0a8");
    // mane tufts along the neck and back
    for (const [x, y] of [[19, 10], [17, 12], [15, 13], [12, 13], [9, 14]]) { s.px(x, y, "#9aa0b0"); s.px(x + 1, y - 1, "#9aa0b0"); }
    s.px(31, 12, K); s.px(30, 12, K);
    s.line(27, 14, 31, 14, "#3a3040");
    s.px(29, 15, "#f4f0e6"); s.px(27, 15, "#f4f0e6");
    s.px(26, 10, "#ffc83a", true); s.px(27, 10, "#ffc83a", true); s.px(26, 9, K, true); s.px(27, 11, "#7a4a10", true);
    s.line(23, 13, 25, 15, "#5a6070", true);
  },
  mushroom: (s) => {
    // little feet and arms
    s.part((m) => m.ell(12, 29, 3, 1.6), "#c8a888");
    s.part((m) => m.ell(20.5, 29, 3, 1.6), "#c8a888");
    s.part((m) => m.ell(16, 23, 6.5, 6.5), "#f0e2c4");
    s.part((m) => m.limb(10, 22, 7, 26, 1.1, 1), "#e8d6b4");
    s.part((m) => m.limb(22, 22, 25, 25, 1.1, 1), "#e8d6b4");
    // gills under the cap
    s.part((m) => m.ell(16, 15.5, 11, 2.2), "#b89a78", { shine: false });
    for (let x = 7; x <= 25; x += 2) s.line(x, 15, 16 + (x - 16) * 0.7, 17, "#8a6a50", true);
    // the cap
    s.part((m) => m.ell(16, 12, 14, 9).clip((_, y) => y <= 14), "#d8382e", { k: 1.1 });
    for (const [x, y, r] of [[9, 8, 2], [16, 5, 2.4], [23, 8, 1.8], [12, 12, 1.4], [20, 11, 1.6], [27, 12, 1.2], [5, 12, 1.2]] as const)
      s.part((m) => m.ell(x, y, r, r * 0.8), "#fff4e8", { seam: false, k: 0.5 });
    // face
    s.part((m) => m.ell(13.5, 21.5, 1.4, 1.8), K, { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 21.5, 1.4, 1.8), K, { flat: true, seam: false });
    s.px(13, 20, "#ffffff", true); s.px(19, 20, "#ffffff", true);
    s.px(11, 24, "#f4a0a0"); s.px(12, 24, "#f4a0a0"); s.px(21, 24, "#f4a0a0"); s.px(22, 24, "#f4a0a0");
    s.line(15, 25, 17, 25, "#7a3a2a"); s.px(16, 26, "#c8584a");
  },
  wasp: (s) => {
    const wing = "#cfe8ff";
    // back wing
    s.part((m) => m.poly([[14, 13], [10, 6], [6, 2.5], [3.5, 3.5], [5, 8], [11, 13]]), "#b0cce8", { k: 0.4, seam: false });
    // legs
    for (const [x0, x1] of [[16, 13], [18, 17], [20, 22]]) s.part((m) => m.path([[x0, 18], [x0 - 1, 22], [x1, 26]], 0.6, 0.5), "#3a2a20", { seam: false });
    // striped abdomen and stinger
    s.part((m) => m.poly([[3, 25], [6, 21], [7, 24]]), "#2a2030", { seam: false });
    s.part((m) => m.ell(10, 19.5, 6.5, 4.6), "#f2b62a", { k: 1.1 });
    for (const x of [6, 9, 12]) for (let y = 14; y < 26; y++) { s.on(x, y + Math.round((x - 10) * 0.2), "#2a2030"); s.on(x + 1, y + Math.round((x - 10) * 0.2), "#3a2a30"); }
    s.part((m) => m.ell(17.5, 16, 4, 3.8), "#5a3a22");
    for (const [x, y] of [[16, 13], [18, 14], [16, 16], [19, 17]]) s.px(x, y, "#8a6a40");
    // head with a big compound eye, mandibles and feelers
    s.part((m) => m.ell(23.5, 14, 3.6, 3.4), "#f2c23a");
    s.part((m) => m.ell(24.5, 13, 2, 2.4), "#8a1e2a", { k: 0.8 });
    s.px(24, 12, "#ff9a8a", true); s.px(25, 12, "#ffd0c0", true);
    s.part((m) => m.poly([[25, 16], [29, 17], [26, 18.5]]), "#3a2a20");
    s.line(23, 11, 25, 6, "#2a2030"); s.line(25, 6, 28, 4, "#2a2030");
    s.line(24, 11, 28, 8, "#2a2030"); s.line(28, 8, 30, 8, "#2a2030");
    // front wing over the body
    s.part((m) => m.poly([[17, 13], [16.5, 6], [15, 1.5], [12, 0.5], [11, 4], [13, 10], [15, 13]]), wing, { k: 0.3 });
    s.line(16, 12, 14, 2, "#9ab8dc", true); s.line(14.5, 8, 12, 3, "#9ab8dc", true);
    s.px(13, 2, "#ffffff", true); s.px(12, 3, "#ffffff", true); s.px(15, 5, "#ffffff", true);
  },
  boar: (s) => {
    const hide = "#7a5236", far = "#5a3a26";
    s.part((m) => m.limb(9, 21, 9, 29, 1.8, 1.5), far);
    s.part((m) => m.limb(20, 22, 21, 29, 1.8, 1.5), far);
    s.part((m) => m.path([[4, 16], [2, 14], [3, 12]], 0.8, 0.6), hide, { seam: false });
    s.part((m) => m.ell(13.5, 18, 10, 7), hide);
    s.part((m) => m.limb(12, 22, 12, 29, 2.1, 1.7), hide);
    s.part((m) => m.limb(23, 22, 24, 29, 2.1, 1.7), hide);
    for (const x of [9, 12, 21, 24]) { s.px(x - 1, 30, "#2a2026"); s.px(x, 30, "#2a2026"); s.px(x + 1, 30, "#2a2026"); }
    // bristly mane
    for (let x = 6; x <= 22; x += 2) s.line(x, 12 - Math.round(Math.sin(x / 4)), x - 1, 9 - Math.round(Math.sin(x / 4)), "#4a3020");
    // stone plates grown into its back
    for (const [x, y, r] of [[9, 12, 2.6], [14, 11, 3], [19, 12, 2.4]] as const) {
      s.part((m) => m.poly([[x - r, y + 2], [x - r * 0.4, y - r], [x + r * 0.6, y - r * 0.6], [x + r, y + 2]]), "#9a9aa8", { k: 1.2 });
      s.line(x - 0.5, y - r * 0.4, x + 0.5, y + 1, "#6a6a7a", true);
    }
    s.part((m) => m.ell(24, 17, 5.5, 5.5), hide);
    s.part((m) => m.ell(29, 19, 2.8, 2.6), "#d8908a");
    s.px(30, 18, "#5a2a2a"); s.px(30, 20, "#5a2a2a");
    s.part((m) => m.poly([[21, 13], [22, 8.5], [25, 12]]), far);
    // curved tusks
    s.part((m) => m.path([[26, 22], [28, 22], [29.5, 18.5]], 0.8, 0.5), "#f4ead0", { seam: false });
    s.px(24, 15, "#ff5a3a", true); s.px(25, 15, "#ff9a5a", true); s.px(24, 14, K, true);
    s.line(22, 14, 26, 14, "#3a2418", true);
  },
  sapling: (s) => {
    const bark = "#7a5232";
    s.part((m) => m.path([[13, 25], [11, 28], [8, 30]], 1.6, 1), bark);
    s.part((m) => m.path([[19, 25], [21, 28], [24, 30]], 1.6, 1), bark);
    s.part((m) => m.ell(16, 21, 5.5, 6.5), "#8a5e3a");
    for (const x of [13, 15, 18]) s.line(x, 17, x + (x % 2), 26, "#6a4428", true);
    // twig arms ending in leaves
    s.part((m) => m.path([[11, 19], [7, 18], [4, 15]], 1, 0.6), bark);
    s.part((m) => m.path([[21, 19], [25, 19], [28, 16]], 1, 0.6), bark);
    s.part((m) => m.ell(3.5, 13.5, 2.2, 1.6), "#5aa83a");
    s.part((m) => m.ell(28.5, 14.5, 2.2, 1.6), "#5aa83a");
    // leafy crown
    s.part((m) => m.ell(10.5, 11, 5, 4.2), "#3e8a30");
    s.part((m) => m.ell(21.5, 11, 5, 4.2), "#3e8a30");
    s.part((m) => m.ell(16, 8, 7.5, 6), "#4ea23a");
    s.part((m) => m.ell(13, 5, 3.5, 2.6), "#6abe4a", { k: 0.8 });
    for (const [x, y] of [[9, 9], [12, 7], [17, 4], [20, 8], [23, 10], [15, 11]]) { s.px(x, y, "#a8e070"); s.px(x + 1, y + 1, "#2e6a24"); }
    s.part((m) => m.ell(20, 3, 1.4, 1.2), "#ff8aa8", { seam: false });
    s.px(20, 3, "#fff0a0", true);
    // face carved in the bark
    s.part((m) => m.ell(14, 20, 1.2, 1.5), "#2a1a10", { flat: true, seam: false });
    s.part((m) => m.ell(18.5, 20, 1.2, 1.5), "#2a1a10", { flat: true, seam: false });
    s.px(14, 20, "#ffe05a", true); s.px(18, 20, "#ffe05a", true);
    s.part((m) => m.ell(16.5, 24, 1.6, 0.8), "#2a1a10", { flat: true, seam: false });
  },
  treant: (s) => {
    const bark = "#6a4a30";
    // roots for legs
    s.part((m) => m.path([[11, 23], [8, 27], [4, 30]], 2.6, 1), bark);
    s.part((m) => m.path([[21, 23], [24, 27], [28, 30]], 2.6, 1), bark);
    s.part((m) => m.path([[16, 25], [16, 30]], 2, 1.4), "#5a3e28");
    // massive arms, the right one reaching forward with twig claws
    s.part((m) => m.path([[9, 15], [4, 18], [2, 23]], 2.2, 1.2), bark);
    s.part((m) => m.path([[23, 15], [28, 16], [30, 21]], 2.4, 1.3), bark);
    for (const [x, y, dx] of [[2, 23, -1], [30, 21, 1]] as const) { s.line(x, y, x + dx, y + 3, "#4a3220"); s.line(x, y, x + dx * 2, y + 2, "#4a3220"); s.line(x, y, x, y + 3, "#4a3220"); }
    s.part((m) => m.poly([[9, 10], [23, 10], [24, 26], [8, 26]]), "#7a5636");
    for (const x of [11, 14, 18, 21]) s.line(x, 12, x + ((x * 7) % 3) - 1, 25, "#5a3c24", true);
    // moss over the shoulders and a few mushrooms
    s.part((m) => m.ell(10, 12, 3.5, 1.6), "#4a8a32", { seam: false });
    s.part((m) => m.ell(22, 12, 3.5, 1.6), "#4a8a32", { seam: false });
    s.part((m) => m.ell(9, 21, 1.6, 1), "#e0c070");
    s.part((m) => m.ell(8, 23, 1.2, 0.8), "#e0c070");
    // the crown: layered leaf clumps
    s.part((m) => m.ell(6, 8, 5.5, 4.5), "#2e6a26");
    s.part((m) => m.ell(26, 8, 5.5, 4.5), "#2e6a26");
    s.part((m) => m.ell(16, 5.5, 10, 5.5), "#3e8a30");
    s.part((m) => m.ell(11, 3, 4, 2.5), "#5aa83a", { k: 0.8 });
    s.part((m) => m.ell(21, 3.5, 3.6, 2.4), "#5aa83a", { k: 0.8 });
    for (const [x, y] of [[4, 7], [8, 4], [14, 2], [19, 6], [24, 4], [28, 8], [12, 8], [22, 9]]) { s.px(x, y, "#9ad868"); s.px(x + 1, y + 1, "#245a1e"); }
    // hanging vines
    for (const [x, l] of [[5, 5], [27, 4], [12, 3]] as const) for (let k = 0; k < l; k++) s.px(x + (k % 2), 12 + k, k === l - 1 ? "#7ac04a" : "#3e8a30");
    // glowing face
    s.part((m) => m.ell(13, 16, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 16, 1.8, 1.4), "#1a120a", { flat: true, seam: false });
    s.glow(13, 16, "#ffd23a"); s.glow(19, 16, "#ffd23a");
    s.line(11, 14, 15, 15, "#3a2414"); s.line(22, 14, 18, 15, "#3a2414");
    s.part((m) => m.ell(16, 21, 3, 1.6), "#1a120a", { flat: true, seam: false });
    s.px(15, 20, "#c8a870"); s.px(17, 22, "#c8a870");
  },

  // ------------------------------------------------------------ floor 2: the amber dunes
  scorpion: (s) => {
    const amber = "#d88a2a", far = "#a8601e";
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[11 + k * 3, 23], [9 + k * 3, 26], [8 + k * 3.4, 30]], 0.6, 0.5), far, { seam: false });
    // tail arching over the back
    const tail: [number, number][] = [[7, 21], [4, 17], [4, 11], [7, 6], [12, 4], [16, 5]];
    tail.forEach(([x, y], i) => s.part((m) => m.ell(x, y, 2.6 - i * 0.2, 2.4 - i * 0.2), amber));
    s.part((m) => m.poly([[16, 4], [19, 6], [18.5, 10], [16.5, 7.5]]), "#f2c25a");
    s.px(18, 10, "#3a1a10"); s.px(18, 9, "#ffe08a", true);
    s.part((m) => m.ell(15, 22.5, 8.5, 4.5), amber, { k: 1.1 });
    for (const x of [10, 14, 18]) s.line(x, 19, x, 26, "#8a4a14", true);
    s.part((m) => m.ell(22.5, 21.5, 4, 3.4), "#e09a3a");
    for (let k = 0; k < 4; k++) s.part((m) => m.path([[13 + k * 3, 24], [14 + k * 3, 27], [15 + k * 3.2, 30]], 0.7, 0.5), amber, { seam: false });
    // pincers
    s.part((m) => m.path([[24, 23], [27, 26], [29, 26]], 1.1, 1), amber);
    s.part((m) => m.ell(29.5, 27, 2.4, 1.8), "#f2b24a");
    s.part((m) => m.path([[25, 19], [27, 16], [28.5, 15]], 1.2, 1), amber);
    s.part((m) => m.ell(29, 13.5, 2.8, 2.2), "#f2b24a");
    s.line(30, 13, 31, 14, K); s.px(31, 26, K);
    // glowing amber gems in its shell
    for (const [x, y] of [[13, 20], [18, 21]]) { s.px(x, y, "#ffe08a", true); s.px(x + 1, y, "#ffb02a", true); }
    s.px(24, 19, K, true); s.px(25, 19, K, true); s.px(24, 18, "#ff6a3a", true);
  },
  lizard: (s) => {
    const sand = "#d8a858", far = "#a87a3a";
    s.part((m) => m.path([[11, 24], [9, 27], [11, 29]], 1, 0.8), far);
    s.part((m) => m.path([[21, 24], [22, 27], [24, 29]], 1, 0.8), far);
    s.part((m) => m.path([[8, 23], [4, 25], [1, 29], [0, 31]], 2.8, 0.6), sand);
    s.part((m) => m.ell(15, 22, 9, 4.2), sand, { k: 1.1 });
    s.part((m) => m.ell(25, 19, 4, 3.2), sand);
    s.part((m) => m.poly([[26, 17], [31.5, 19], [31, 21.5], [26, 22]]), "#e2b868");
    s.line(27, 21, 31, 20, "#6a4a20");
    // sail-like frill of spines along the back
    for (let x = 9; x <= 22; x += 2) {
      const h = 3 + Math.round(Math.sin((x - 8) / 4.5) * 2);
      s.line(x, 18, x, 18 - h, "#e0602a");
      s.line(x + 1, 18, x + 1, 18 - h + 1, "#a83a1a");
    }
    s.line(9, 18, 23, 18, "#a83a1a");
    // banded markings, pale belly
    for (const x of [7, 11, 15, 19]) for (let y = 19; y < 23; y++) s.on(x + ((y + x) % 2), y, "#9a6a2a");
    s.part((m) => m.ell(15, 25, 7, 1.2), "#f2dca8", { seam: false });
    s.part((m) => m.path([[13, 24], [12, 27], [10, 29]], 1.2, 0.9), sand);
    s.part((m) => m.path([[23, 23], [25, 26], [27, 28]], 1.2, 0.9), sand);
    for (const [x, y] of [[9, 30], [11, 30], [26, 29], [28, 29]]) s.px(x, y, "#6a4a20");
    // slit eye and flicking tongue
    s.part((m) => m.ell(26, 18, 1.4, 1.2), "#ffe03a", { flat: true, seam: false });
    s.px(26, 18, K, true); s.px(26, 17, K, true);
    s.line(31, 21, 31, 23, "#e04a5a"); s.px(30, 24, "#e04a5a"); s.px(31, 24, "#e04a5a");
  },
  mummy: (s) => {
    const linen = "#dcd0b0", far = "#b8aa88";
    s.part((m) => m.limb(13, 23, 12, 30, 2.1, 1.8), far);
    s.part((m) => m.limb(18, 23, 19, 30, 2.2, 1.9), linen);
    // far arm reaching forward
    s.part((m) => m.path([[18, 13], [23, 14], [28, 15]], 1.6, 1.4), far);
    // loose strips trailing behind
    s.part((m) => m.path([[11, 15], [7, 19], [5, 25]], 0.8, 0.6), far, { seam: false });
    s.part((m) => m.path([[13, 5], [9, 6], [6, 10]], 0.8, 0.5), far, { seam: false });
    s.part((m) => m.ell(15.5, 18, 5.5, 7), linen);
    s.part((m) => m.ell(17, 7, 4.5, 4.6), linen);
    // near arm, hanging forward a little lower
    s.part((m) => m.path([[14, 14], [20, 17], [27, 18]], 1.8, 1.5), linen);
    // wrapping bands
    for (let y = -4; y < 34; y += 2) s.line(9, y + 4, 30, y - 1, "#a89a78", true);
    for (const [x, y] of [[13, 17], [17, 22], [14, 25], [20, 8], [23, 17]]) { s.on(x, y, "#5a4a38"); s.on(x + 1, y, "#5a4a38"); }
    for (const [x, y] of [[28, 15], [27, 19], [28, 18]]) s.px(x, y, "#6a5a40");
    // a gap in the wraps with a glowing eye
    s.part((m) => m.rect(16, 6, 6, 2), "#2a1e1a", { flat: true, seam: false });
    s.glow(19, 6, "#3ae0c0"); s.px(17, 7, "#1a8a7a", true);
  },
  vulture: (s) => {
    const feather = "#5a3a2a";
    // far wing
    s.part((m) => m.poly([[15, 13], [24, 3], [27, 5], [21, 15]]), "#3a2418");
    s.part((m) => m.limb(13, 25, 12, 30, 0.8, 0.6), "#c8a848", { seam: false });
    s.part((m) => m.limb(17, 25, 18, 30, 0.8, 0.6), "#c8a848", { seam: false });
    s.line(10, 30, 14, 30, "#5a4a28"); s.line(16, 30, 20, 30, "#5a4a28");
    s.part((m) => m.poly([[5, 25], [9, 20], [12, 24], [7, 28]]), "#3a2418");
    s.part((m) => m.ell(14.5, 19, 6, 7), feather);
    // near wing, ragged feather tips
    s.part((m) => m.poly([[14, 13], [4, 4], [1, 7], [1, 13], [3, 14], [2, 18], [5, 18], [5, 21], [9, 20], [15, 20]]), "#6a4430");
    for (const [x0, y0, x1, y1] of [[13, 15, 3, 9], [13, 17, 3, 15], [12, 19, 5, 19]]) s.line(x0, y0, x1, y1, "#4a2c1e", true);
    for (const [x, y] of [[4, 6], [2, 10], [3, 15], [5, 19]]) s.px(x, y, "#a8846a");
    // white ruff, bald pink head on a long neck
    s.part((m) => m.ell(19, 13, 4, 2.6), "#f2ead8");
    s.part((m) => m.limb(20, 12, 23, 7, 1.2, 1.1), "#d88a8a");
    s.part((m) => m.ell(24.5, 6, 3, 2.6), "#e8a0a0");
    s.part((m) => m.poly([[26, 4.5], [30.5, 6], [30.5, 8.5], [27, 7.5]]), "#c8c0a8");
    s.px(30, 8, "#3a3028"); s.px(29, 8, "#3a3028");
    s.px(25, 5, "#ffd23a", true); s.px(25, 4, K, true);
  },
  djinn: (s) => {
    const skin = "#e8b860";
    // swirling sand tail
    s.part((m) => m.path([[16, 20], [14, 24], [15, 27.5], [20, 29], [24, 27], [25, 25]], 4.2, 0.8), "#e2b864", { k: 0.8 });
    s.line(12, 24, 17, 27, "#c8984a", true); s.line(15, 29, 22, 28, "#c8984a", true);
    for (const [x, y] of [[8, 27], [26, 24], [6, 22], [27, 29], [10, 30]]) s.px(x, y, "#f2d890");
    s.part((m) => m.poly([[11, 13], [21, 13], [19, 22], [13, 22]]), skin);
    s.part((m) => m.rect(12, 20, 9, 2), "#7a3aa8");
    s.px(16, 20, "#ffd23a"); s.px(16, 21, "#ffd23a");
    // arms: one fist raised, gold bracers
    s.part((m) => m.path([[11, 14], [7, 17], [5, 13]], 1.6, 1.4), skin);
    s.part((m) => m.ell(5, 11.5, 1.8, 1.8), skin);
    s.part((m) => m.path([[21, 14], [25, 16], [28, 13]], 1.6, 1.4), skin);
    s.part((m) => m.ell(28.5, 11.5, 2, 2), skin);
    s.part((m) => m.rect(4, 13, 3, 1), "#ffd23a", { flat: true });
    s.part((m) => m.rect(27, 13, 3, 1), "#ffd23a", { flat: true });
    s.part((m) => m.ell(16, 8.5, 4, 4), skin);
    // flaming topknot of sand
    s.part((m) => m.poly([[13, 6], [15, 0], [17, 3], [19, 0.5], [20, 6]]), "#f2d070", { k: 0.7 });
    s.px(16, 2, "#fff4c0"); s.px(18, 3, "#fff4c0");
    s.part((m) => m.rect(12, 5, 8, 1.5), "#7a3aa8");
    s.part((m) => m.ell(16, 5.5, 1, 1), "#3ae0e0", { flat: true });
    s.glow(15, 8, "#3ae0ff"); s.glow(18, 8, "#3ae0ff");
    s.line(15, 11, 18, 11, "#8a5a20");
    s.line(13, 17, 15, 18, "#b8883a", true); s.line(19, 17, 17, 18, "#b8883a", true);
  },
  cactus: (s) => {
    const green = "#4e9a3a";
    // sand mound
    s.part((m) => m.ell(16, 30, 11, 2.4).clip((_, y) => y <= 31), "#d8b878", { k: 0.6 });
    // arms
    s.part((m) => m.path([[11, 19], [6, 19], [5, 13], [5, 9]], 2.2, 2), green);
    s.part((m) => m.path([[21, 15], [26, 15], [27, 10], [27, 6]], 2.2, 2), green);
    s.part((m) => m.poly([[10.5, 6], [21.5, 6], [22, 29], [10, 29]]), green, { k: 1.1 });
    s.part((m) => m.ell(16, 6, 5.5, 3.5), green);
    // ribs and spines
    for (const x of [12, 15, 18, 21]) s.line(x, 4, x, 28, "#3a7a2a", true);
    for (let y = 4; y < 28; y += 3) for (const x of [11, 14, 17, 20]) s.on(x + ((y >> 1) % 2), y, "#f2ead0");
    for (const [x, y] of [[4, 12], [6, 16], [26, 9], [28, 13], [4, 19], [27, 15]]) s.px(x, y, "#f2ead0");
    // flower crown
    s.part((m) => m.ell(17, 2, 2.4, 1.6), "#ff5a8a");
    s.px(17, 2, "#ffe05a", true);
    // ghoulish face
    s.part((m) => m.poly([[12, 11], [15.5, 12], [12.5, 14]]), "#1a0a10", { flat: true, seam: false });
    s.part((m) => m.poly([[20.5, 11], [17, 12], [20, 14]]), "#1a0a10", { flat: true, seam: false });
    s.px(13, 12, "#ff3a2a", true); s.px(19, 12, "#ff3a2a", true);
    s.part((m) => m.ell(16, 18.5, 3.2, 2), "#1a0a10", { flat: true, seam: false });
    for (const x of [14, 16, 18]) { s.px(x, 17, "#f2ead0", true); s.px(x - 1 + (x % 2), 20, "#f2ead0", true); }
  },
  wyrm: (s) => {
    const shell = "#c8883a";
    // sand bursting around the base
    s.part((m) => m.ell(14, 30, 14, 3).clip((_, y) => y <= 31), "#d8b070", { k: 0.6 });
    for (const [x, y] of [[2, 25], [5, 22], [3, 21], [28, 25]]) { s.px(x, y, "#e8c888"); s.px(x + 1, y + 1, "#c8a060"); }
    // armoured segments rising in an S
    const seg: [number, number, number][] = [[10, 27, 5.5], [8, 22, 5.2], [9, 17, 5], [12, 13, 4.8], [16, 10, 4.6]];
    for (const [x, y, r] of seg) {
      s.part((m) => m.ell(x, y, r, r * 0.85), shell, { k: 1.1 });
      s.part((m) => m.ell(x - 1, y - r * 0.35, r * 0.7, r * 0.35), "#e8b060", { seam: false, k: 0.6 });
    }
    // head: a round maw ringed with teeth
    s.part((m) => m.ell(21.5, 9, 7, 7), "#b0702a", { k: 1.1 });
    s.part((m) => m.ell(23, 9.5, 5, 5), "#5a1a1a", { k: 0.8 });
    s.part((m) => m.ell(23.5, 10, 2.6, 2.6), "#2a0a10", { flat: true, seam: false });
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      s.px(23 + Math.cos(ang) * 4.3, 9.5 + Math.sin(ang) * 4.3, "#f4ead0");
    }
    for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2 + 0.3; s.px(23.5 + Math.cos(ang) * 2.2, 10 + Math.sin(ang) * 2.2, "#e8d8b8"); }
    // mandibles and glowing pits of eyes on the shell
    s.part((m) => m.path([[18, 3], [22, 0.5], [26, 1]], 1, 0.6), "#7a4a20");
    s.part((m) => m.path([[19, 16], [23, 18], [27, 17]], 1, 0.6), "#7a4a20");
    s.glow(16, 5, "#ff6a2a"); s.glow(15, 13, "#ff6a2a");
  },

  // ------------------------------------------------------------ floor 3: the lantern marsh
  frogman: (s) => {
    const skin = "#5aa04a";
    // reed spear held upright
    s.part((m) => m.limb(27, 30, 27, 6, 0.6, 0.6), "#a8884a", { seam: false });
    s.part((m) => m.poly([[25.5, 7], [27, 0.5], [28.5, 7]]), "#a8b8c0");
    s.line(26, 8, 28, 8, "#e0d8a0");
    s.part((m) => m.path([[13, 23], [10, 27], [12, 30]], 1.8, 1.3), "#4a8a3a");
    s.part((m) => m.path([[18, 23], [21, 27], [19, 30]], 1.8, 1.3), skin);
    s.line(9, 30, 14, 30, "#3a6a2a"); s.line(17, 30, 22, 30, "#3a6a2a");
    s.part((m) => m.ell(15.5, 18, 6.5, 6.5), skin, { k: 1.1 });
    s.part((m) => m.ell(17, 19.5, 4, 4.5), "#d8e8a0", { seam: false, k: 0.6 });
    // reed skirt
    s.part((m) => m.poly([[9.5, 21], [22, 21], [23, 26], [9, 26]]), "#8a9a3a");
    for (let x = 10; x < 23; x += 2) s.line(x, 22, x, 26, "#5a6a2a", true);
    // arm gripping the spear, and the far arm
    s.part((m) => m.path([[10, 15], [7, 19], [8, 23]], 1.3, 1.1), "#4a8a3a");
    s.part((m) => m.path([[20, 15], [24, 17], [26.5, 15]], 1.4, 1.2), skin);
    s.part((m) => m.ell(27, 15, 1.6, 1.4), skin);
    // wide head with bulging eyes
    s.part((m) => m.ell(17, 9.5, 6.5, 4.5), skin);
    s.part((m) => m.ell(14, 5.5, 2.6, 2.6), skin);
    s.part((m) => m.ell(20.5, 5.5, 2.6, 2.6), skin);
    s.eye(14, 5.5, "#ffd23a", 1.6);
    s.eye(20.5, 5.5, "#ffd23a", 1.6);
    s.line(13, 11, 23, 12, "#2a4a1a");
    s.px(23, 11, "#2a4a1a");
    s.part((m) => m.ell(19, 13, 3, 1), "#c8d890", { seam: false });
    for (const [x, y] of [[11, 15], [13, 18], [12, 9], [21, 8], [19, 16]]) { s.on(x, y, "#3a7a2a"); s.on(x + 1, y, "#3a7a2a"); }
  },
  wisp: (s) => {
    // layered flame: deep blue rim, cyan body, white core
    s.part((m) => m.poly([[16, 1], [22, 9], [25, 16], [24, 23], [19, 27], [13, 27], [8, 23], [7, 16], [10, 10], [12, 12]]), "#2a6ae0", { k: 0.7 });
    s.part((m) => m.poly([[16, 6], [21, 12], [22, 19], [19, 24], [13, 24], [10, 19], [11, 13], [13, 14]]), "#4ab8ff", { seam: false, k: 0.6 });
    s.part((m) => m.ell(16, 18.5, 4.5, 4.5), "#bff0ff", { seam: false, k: 0.4 });
    s.part((m) => m.ell(16, 19, 2.5, 2.5), "#ffffff", { flat: true, seam: false });
    // trailing wisps below
    s.part((m) => m.path([[13, 27], [11, 29], [12, 31]], 1, 0.4), "#2a6ae0", { seam: false });
    s.part((m) => m.path([[19, 27], [21, 29], [20, 31]], 1, 0.4), "#2a6ae0", { seam: false });
    // a tiny face in the core
    s.px(15, 18, "#1a3a8a", true); s.px(18, 18, "#1a3a8a", true);
    s.px(16, 20, "#1a3a8a", true); s.px(17, 20, "#1a3a8a", true);
    for (const [x, y] of [[4, 8], [27, 6], [28, 20], [3, 19], [6, 2]]) { s.px(x, y, "#bff0ff", true); s.px(x + 1, y, "#4ab8ff", true); }
  },
  drowned: (s) => {
    const skin = "#7a9a8a";
    s.part((m) => m.limb(13, 22, 12, 30, 1.9, 1.6), "#5a7a6a");
    s.part((m) => m.limb(18, 22, 19, 30, 1.9, 1.6), skin);
    // ragged, soaked clothes
    s.part((m) => m.poly([[9, 11], [22, 11], [24, 25], [22, 23], [20, 26], [17, 23], [14, 26], [12, 23], [9, 25]]), "#3a4a5a");
    for (const x of [11, 15, 19]) s.line(x, 13, x - 1, 24, "#2a3444", true);
    // long arms dangling forward
    s.part((m) => m.path([[10, 12], [7, 19], [6, 25]], 1.6, 1.2), "#5a7a6a");
    s.part((m) => m.path([[21, 12], [26, 17], [28, 24]], 1.7, 1.3), skin);
    for (const [x, y] of [[5, 26], [6, 27], [27, 25], [29, 25], [28, 26]]) s.px(x, y, "#4a6a5a");
    // bloated head, hanging forward
    s.part((m) => m.ell(18, 7, 5.5, 5), skin);
    s.part((m) => m.ell(18, 4, 5.5, 2.6).clip((_, y) => y <= 5), "#2a3a30");
    s.part((m) => m.ell(15.5, 7.5, 1.5, 1.5), "#1a2420", { flat: true, seam: false });
    s.part((m) => m.ell(20.5, 7.5, 1.5, 1.5), "#1a2420", { flat: true, seam: false });
    s.px(15, 7, "#e8f04a", true); s.px(20, 7, "#e8f04a", true);
    s.line(17, 10, 20, 10, "#2a3a30"); s.px(18, 11, "#2a3a30");
    // seaweed and drips
    for (const [x, l] of [[13, 7], [22, 5], [16, 4]] as const) for (let k = 0; k < l; k++) s.px(x + Math.round(Math.sin(k)), 5 + k, k % 2 ? "#3a7a3a" : "#4a9a3a");
    for (const [x, y] of [[8, 28], [23, 29], [28, 28]]) { s.px(x, y, "#8ad0ff", true); s.px(x, y + 1, "#4a9ad8", true); }
    s.part((m) => m.ell(20, 3, 1.2, 0.8), "#4a9a3a", { seam: false });
  },
  leech: (s) => {
    const flesh = "#8a2a4a";
    // slime trail
    s.part((m) => m.ell(12, 30.5, 11, 1.2), "#5a8a5a", { k: 0.5, seam: false });
    // segmented body rearing up towards the right
    const seg: [number, number, number, number][] = [[4, 27, 3.2, 2.6], [8, 26.5, 4, 3.2], [13, 25.5, 4.5, 3.8], [18, 23, 4.6, 4.2], [21.5, 18.5, 4.2, 4.2], [23.5, 13.5, 3.8, 3.8]];
    for (const [x, y, rx, ry] of seg) s.part((m) => m.ell(x, y, rx, ry), flesh, { k: 1.1 });
    for (const [x, y] of [[8, 24], [13, 23], [18, 20], [21, 16]]) { s.px(x, y, "#ffb0c8", true); s.px(x + 1, y, "#e07a9a", true); }
    for (const [x, y] of [[6, 27], [11, 27], [16, 27], [19, 25], [22, 21]]) s.px(x, y, "#e0a03a");
    // the round sucker mouth with a ring of teeth
    s.part((m) => m.ell(26, 10, 4, 4), "#a83a5a", { k: 0.9 });
    s.part((m) => m.ell(26.5, 9.5, 2.6, 2.6), "#3a0a1a", { flat: true, seam: false });
    for (let a = 0; a < 10; a++) { const ang = (a / 10) * Math.PI * 2; s.px(26.5 + Math.cos(ang) * 2.2, 9.5 + Math.sin(ang) * 2.2, "#f4e0d8", true); }
    s.px(26, 9, "#ff4a6a", true);
    for (const [x, y] of [[29, 15], [30, 17]]) s.px(x, y, "#c84a6a", true);
  },
  crab: (s) => {
    const mud = "#6a5a4a";
    for (let k = 0; k < 3; k++) {
      s.part((m) => m.path([[11 - k, 22], [6 - k * 2, 24], [4 - k * 2, 29]], 0.8, 0.6), "#4a3e34");
      s.part((m) => m.path([[21 + k, 22], [26 + k * 2, 24], [28 + k * 1.5, 29]], 0.8, 0.6), mud);
    }
    // small claw behind, big claw in front
    s.part((m) => m.path([[9, 18], [5, 14], [4, 10]], 1.4, 1.2), "#4a3e34");
    s.part((m) => m.poly([[1, 9], [4, 5], [7, 8], [4, 9], [6, 11], [3, 12]]), "#5a4a3e");
    // carapace with riveted iron plates
    s.part((m) => m.ell(16, 20, 10.5, 6.5), mud, { k: 1.1 });
    s.part((m) => m.poly([[9, 16], [16, 14], [23, 16], [22, 20], [10, 20]]), "#8a8e98", { k: 1.2 });
    s.line(16, 14, 16, 20, "#5a5e6a", true);
    for (const [x, y] of [[11, 17], [14, 16], [18, 16], [21, 17]]) { s.px(x, y, "#d8dce4", true); s.px(x, y + 1, "#3a3e4a", true); }
    for (const [x, y] of [[8, 23], [12, 25], [20, 24], [24, 22]]) { s.on(x, y, "#4a3a2a"); s.on(x + 1, y, "#8a7a5a"); }
    s.part((m) => m.path([[23, 18], [27, 15], [28, 11]], 1.8, 1.6), mud);
    s.part((m) => m.poly([[25, 10], [27, 3], [31.5, 4], [31.5, 8], [29, 7], [31, 11], [27, 12.5]]), "#9a9ea8", { k: 1.2 });
    s.px(29, 6, "#3a3e4a"); s.px(30, 7, "#3a3e4a");
    // stalk eyes
    for (const x of [14, 19]) { s.line(x, 14, x, 11, "#4a3e34"); s.part((m) => m.ell(x, 10, 1.4, 1.4), "#e8e0c0", { flat: true, seam: false }); s.px(x + 1, 10, K, true); }
    s.line(15, 23, 18, 23, "#2a221c");
  },
  ghost: (s) => {
    const sheet = "#dcdcf2";
    // wavy tail
    s.part((m) => m.poly([[7, 15], [24, 15], [25, 23], [22, 27], [20, 25], [17, 29], [14, 26], [11, 29], [9, 25], [6, 27], [5, 20]]), sheet, { k: 0.8 });
    s.part((m) => m.ell(15.5, 12, 9, 9), sheet, { k: 0.8 });
    // lantern held out on a little arm
    s.part((m) => m.path([[22, 16], [26, 17], [27, 19]], 1.3, 1.1), "#c8c8e0");
    s.line(27, 19, 27, 21, "#3a3040");
    s.part((m) => m.rect(25, 21, 5, 1), "#5a4a3a", { flat: true });
    s.part((m) => m.ell(27.5, 24.5, 2.6, 3), "#ffb02a", { k: 0.6 });
    s.part((m) => m.ell(27.5, 24.5, 1.2, 1.6), "#fff0a0", { flat: true, seam: false });
    s.part((m) => m.rect(25, 27, 5, 1), "#5a4a3a", { flat: true });
    s.line(26, 22, 26, 26, "#c8701a", true); s.line(29, 22, 29, 26, "#c8701a", true);
    // warm light spilling onto the sheet
    for (const [x, y] of [[23, 20], [24, 22], [23, 24], [24, 18], [22, 23]]) s.on(x, y, "#ffe8b8");
    // hollow face
    s.part((m) => m.ell(13, 11, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
    s.part((m) => m.ell(19.5, 11, 1.8, 2.4), "#2a2440", { flat: true, seam: false });
    s.px(13, 10, "#8ae0ff", true); s.px(19, 10, "#8ae0ff", true);
    s.part((m) => m.ell(16.5, 16, 1.4, 1.8), "#2a2440", { flat: true, seam: false });
    s.px(10, 14, "#f0b0d0"); s.px(22, 14, "#f0b0d0");
  },
  queen: (s) => {
    const gown = "#2a5a6a", skin = "#a8c8d0";
    // tattered gown
    s.part((m) => m.poly([[11, 14], [21, 14], [26, 30], [23, 28], [21, 31], [18, 28], [15, 31], [12, 28], [9, 31], [6, 28]]), gown, { k: 1.1 });
    for (const x of [10, 14, 18, 22]) s.line(x + 1, 17, x - 1 + (x > 16 ? 3 : 0), 29, "#1a3a4a", true);
    s.part((m) => m.poly([[12, 14], [20, 14], [19, 20], [13, 20]]), "#3a7a8a");
    for (const [x, y] of [[14, 16], [16, 17], [18, 16], [16, 19]]) s.px(x, y, "#f4f0e8");
    // flowing hair behind with seaweed
    s.part((m) => m.poly([[10, 6], [14, 2], [20, 3], [21, 9], [18, 18], [13, 22], [8, 19], [7, 11]]), "#1e2a3a");
    for (const [x, y] of [[9, 12], [10, 16], [12, 19]]) { s.px(x, y, "#3a8a4a"); s.px(x, y + 1, "#2a6a3a"); }
    // trident sceptre with a pearl
    s.part((m) => m.limb(27, 30, 27, 6, 0.6, 0.6), "#c8a84a", { seam: false });
    s.part((m) => m.ell(27, 4.5, 1.6, 1.6), "#f4f0f8", { k: 0.5 });
    s.line(24, 7, 30, 7, "#c8a84a"); s.line(24, 7, 24, 4, "#c8a84a"); s.line(30, 7, 30, 4, "#c8a84a");
    s.part((m) => m.path([[20, 15], [24, 16], [26.5, 14]], 1.2, 1), skin);
    s.part((m) => m.path([[12, 15], [10, 20], [11, 23]], 1.1, 0.9), skin);
    s.part((m) => m.ell(16.5, 9, 4, 4.5), skin);
    // pearl-studded crown
    s.part((m) => m.poly([[12.5, 5], [13, 1.5], [14.5, 3.5], [16.5, 0.5], [18.5, 3.5], [20, 1.5], [20.5, 5]]), "#f2c23a", { k: 0.8 });
    s.px(16, 2, "#f4f0f8", true); s.px(13, 3, "#ff6a8a", true); s.px(20, 3, "#6ae0ff", true);
    s.glow(15, 9, "#3ae0ff"); s.glow(19, 9, "#3ae0ff");
    s.line(16, 12, 18, 12, "#4a6a7a");
    s.line(14, 10, 14, 13, "#5a8a9a", true);
    for (const [x, y] of [[8, 30], [25, 29], [5, 26]]) { s.px(x, y, "#8ad0ff", true); }
  },
};

export const isBeast = (id: string) => id in BEASTS;

const cache = new Map<string, HTMLCanvasElement>();

/** 32x32 hand-made sprite; `pal.__tint` re-colours it for elemental variants. */
export function beastCanvas(id: string, pal?: Record<string, string>): HTMLCanvasElement {
  const t = pal?.__tint;
  const k = `${id}|${t ?? ""}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const s = new Sprite(t ? (c) => tint(c, t, 0.45) : (c) => c);
  BEASTS[id](s);
  const c = s.toCanvas();
  cache.set(k, c);
  return c;
}

/** 16x16 map version, on the same pixel grid as the terrain. */
export function beastSmall(id: string, pal?: Record<string, string>): HTMLCanvasElement {
  return shrink32(`bs:${id}|${pal?.__tint ?? ""}`, () => beastCanvas(id, pal));
}
