/**
 * Props for staged scenes (director.ts): the objects a section's text talks about — a door that
 * opens, a chest, a sword on the ground, a corpse, a cart, a campfire... drawn in code at the
 * scale of the 32x48 characters, anchored at the bottom centre like them. States: "open",
 * "broken", "burning" (charred; the stage adds the flames). Ground decals (paths, streams,
 * paw prints) lie flat under the actors. Unknown words get a sensible generic object.
 */
import { creatureFrame } from "./creatures";
import { lookFor, personFrame } from "./people";
import { Px, hs, hueOutline, memo } from "./px";

export type PropState = "" | "open" | "broken" | "burning" | "closed";

export interface PropArt {
  /** Sprite, feet (bottom centre) at the prop's spot. */
  c: HTMLCanvasElement;
  /** Flat on the ground: drawn under every actor. */
  flat?: boolean;
  /** Where flames sit when it burns / for a lit prop (relative to the bottom centre). */
  flames?: { x: number; y: number; w: number; small?: boolean }[];
}

// ------------------------------------------------------------------ palette
const WOOD = ["#4a2e18", "#6e4628", "#8f5f36", "#b07c4a"];
const IRON = ["#2a2a32", "#4a4a56", "#70707e", "#a0a0ae"];
const STONE = ["#4e4c54", "#6c6a72", "#8c8a92", "#b0aeb4"];
const GOLD = ["#7a4a10", "#c08a24", "#f0c050", "#fff0a0"];
const CLOTH = ["#5a4030", "#8a6a48", "#b89a6a", "#dcc59a"];

/** Wood plank texture in a rectangle (vertical planks). */
function planks(p: Px, x: number, y: number, w: number, h: number, pal = WOOD, vertical = true, seed = 1) {
  p.rect(x, y, w, h, pal[2]);
  if (vertical) {
    for (let i = 0; i < w; i += 4) {
      p.rect(x + i, y, 1, h, pal[1]);
      p.rect(x + i + 1, y, 1, h, pal[3]);
      for (let k = 2; k < h; k += 5 + ((i * 7 + seed) % 4)) p.px(x + i + 2, y + k, pal[1]);
    }
  } else {
    for (let j = 0; j < h; j += 3) {
      p.rect(x, y + j, w, 1, pal[1]);
      p.rect(x, y + j + 1, w, 1, pal[3]);
      for (let k = 3; k < w; k += 6 + ((j * 5 + seed) % 5)) p.px(x + k, y + j + 2, pal[1]);
    }
  }
}

function finish(p: Px, o: Partial<PropArt> = {}, outline = true): PropArt {
  if (outline) p.outline(hueOutline);
  return { c: p.c, ...o };
}

/** Darkens a canvas into its burnt version. */
function charred(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(26,16,12,.62)";
  g.fillRect(0, 0, c.width, c.height);
  // glowing embers along the edges
  const d = g.getImageData(0, 0, c.width, c.height);
  let seed = 9;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    if (d.data[i + 3] && seed % 23 === 0) { d.data[i] = 255; d.data[i + 1] = 110 + (seed % 80); d.data[i + 2] = 30; }
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ------------------------------------------------------------------ the props
type Make = (state: PropState) => PropArt;

const door: Make = (st) => {
  const p = new Px(26, 38);
  // stone frame
  p.rect(0, 2, 26, 36, STONE[1]);
  p.rect(1, 2, 24, 1, STONE[3]);
  for (let y = 4; y < 38; y += 5) { p.rect(0, y, 3, 1, STONE[0]); p.rect(23, y + 2, 3, 1, STONE[0]); }
  p.rect(2, 0, 22, 3, STONE[2]); p.rect(11, 0, 4, 3, STONE[3]);
  // opening
  p.rect(3, 4, 20, 34, "#120c0a");
  if (st === "open") {
    p.rect(4, 6, 18, 32, "#1e1410");
    p.rect(3, 30, 20, 8, "#2a1e16");
    // door swung inwards: a thin slab on the left
    planks(p, 3, 4, 5, 34, WOOD, true, 3);
    p.rect(8, 4, 1, 34, WOOD[0]);
    p.rect(3, 10, 5, 2, IRON[1]); p.rect(3, 28, 5, 2, IRON[1]);
    // light spilling out
    for (let y = 12; y < 38; y++) p.px(12 + ((y * 3) % 7), y, "rgba(255,200,120,.18)");
  } else if (st === "broken") {
    planks(p, 3, 4, 20, 34, WOOD, true, 5);
    p.poly([[9, 10], [17, 8], [19, 18], [12, 24], [8, 18]], "#120c0a");
    p.line(8, 18, 3, 30, WOOD[0]); p.line(19, 18, 23, 26, WOOD[0]);
    p.rect(3, 34, 7, 3, WOOD[1]);
  } else {
    planks(p, 3, 4, 20, 34, WOOD, true, 7);
    p.rect(3, 9, 20, 2, IRON[1]); p.rect(3, 9, 20, 1, IRON[2]);
    p.rect(3, 29, 20, 2, IRON[1]); p.rect(3, 29, 20, 1, IRON[2]);
    for (const x of [5, 12, 19]) { p.px(x, 10, IRON[3]); p.px(x, 30, IRON[3]); }
    p.rect(18, 20, 2, 3, IRON[0]); p.px(18, 20, GOLD[2]);
  }
  return finish(p, { flames: [{ x: 0, y: -18, w: 18 }] });
};

const gate: Make = (st) => {
  const p = new Px(44, 44);
  // two posts + arch
  p.rect(0, 6, 7, 38, STONE[1]); p.rect(37, 6, 7, 38, STONE[1]);
  p.rect(0, 6, 7, 1, STONE[3]); p.rect(37, 6, 7, 1, STONE[3]);
  p.rect(0, 0, 44, 7, STONE[2]);
  for (let x = 1; x < 44; x += 6) p.rect(x, 0, 4, 2, STONE[3]);
  for (let y = 10; y < 44; y += 6) { p.rect(1, y, 5, 1, STONE[0]); p.rect(38, y + 3, 5, 1, STONE[0]); }
  if (st === "open") {
    p.rect(7, 7, 30, 37, "rgba(20,14,10,.55)");
    planks(p, 7, 8, 5, 36, WOOD, true, 2); planks(p, 32, 8, 5, 36, WOOD, true, 4);
  } else {
    planks(p, 7, 8, 30, 36, WOOD, true, st === "broken" ? 9 : 1);
    for (const y of [14, 34]) { p.rect(7, y, 30, 2, IRON[1]); p.rect(7, y, 30, 1, IRON[2]); }
    p.rect(21, 8, 2, 36, WOOD[0]);
    if (st === "broken") { p.poly([[14, 18], [28, 16], [30, 30], [16, 32]], "#140e0a"); p.line(14, 18, 10, 40, WOOD[0]); }
  }
  return finish(p, { flames: [{ x: 0, y: -24, w: 30 }] });
};

const crate: Make = (st) => {
  const p = new Px(18, 16);
  if (st === "broken") {
    planks(p, 1, 9, 16, 7, WOOD, false, 3);
    p.poly([[1, 9], [6, 4], [8, 9]], WOOD[2]); p.poly([[11, 9], [16, 6], [17, 9]], WOOD[3]);
    p.line(2, 15, 9, 8, WOOD[0]);
    p.rect(5, 12, 3, 2, "#d8c890"); p.rect(10, 13, 3, 2, "#c8b070");
    return finish(p, { flames: [{ x: 0, y: -6, w: 14 }] });
  }
  if (st === "open") {
    planks(p, 1, 5, 16, 11, WOOD, true, 2);
    p.rect(1, 5, 16, 2, "#2a1a10");
    p.poly([[0, 5], [6, 0], [8, 1], [3, 6]], WOOD[3]);
    p.rect(5, 4, 8, 2, "#d8c890");
  } else {
    planks(p, 1, 2, 16, 14, WOOD, true, 6);
    p.rect(1, 2, 16, 2, WOOD[3]); p.rect(1, 14, 16, 2, WOOD[1]);
    p.line(2, 4, 16, 13, WOOD[1]); p.line(2, 5, 16, 14, WOOD[3]);
  }
  return finish(p, { flames: [{ x: 0, y: -8, w: 14 }] });
};

const barrel: Make = () => {
  const p = new Px(14, 18);
  p.ellipse(7, 9, 6, 8, WOOD[2]);
  p.rect(1, 3, 12, 13, WOOD[2]);
  for (let x = 2; x < 13; x += 3) p.rect(x, 2, 1, 14, WOOD[1]);
  for (const y of [4, 13]) { p.rect(1, y, 12, 2, IRON[1]); p.rect(1, y, 12, 1, IRON[2]); }
  p.ellipse(7, 2, 5, 1, WOOD[3]);
  p.rect(3, 6, 1, 6, WOOD[3]);
  return finish(p, { flames: [{ x: 0, y: -10, w: 10 }] });
};

const chest: Make = (st) => {
  const p = new Px(20, 18);
  // body
  planks(p, 1, 8, 18, 10, WOOD, false, 2);
  p.rect(1, 8, 18, 1, WOOD[3]);
  for (const x of [2, 16]) { p.rect(x, 8, 2, 10, IRON[1]); p.rect(x, 8, 1, 10, IRON[2]); }
  if (st === "open") {
    // lid thrown back, gold inside
    p.poly([[1, 8], [3, 0], [17, 0], [19, 8]], WOOD[1]);
    p.rect(3, 1, 14, 2, WOOD[3]);
    p.rect(2, 6, 16, 3, "#2a1608");
    for (let x = 3; x < 17; x += 2) p.px(x, 6 + (x % 3 === 0 ? 0 : 1), x % 4 ? GOLD[2] : GOLD[3]);
    p.rect(5, 5, 3, 2, GOLD[2]); p.rect(12, 5, 2, 2, GOLD[1]); p.px(9, 4, "#8ad0ff");
  } else if (st === "broken") {
    p.poly([[1, 8], [4, 3], [10, 4], [8, 8]], WOOD[2]);
    p.line(10, 8, 14, 17, WOOD[0]);
    p.rect(13, 6, 5, 2, WOOD[1]);
  } else {
    // domed lid
    p.rect(1, 3, 18, 6, WOOD[2]); p.rect(2, 2, 16, 1, WOOD[3]); p.rect(1, 3, 18, 1, WOOD[3]);
    for (const x of [2, 16]) { p.rect(x, 2, 2, 7, IRON[1]); p.rect(x, 2, 1, 7, IRON[2]); }
    p.rect(8, 7, 4, 4, GOLD[1]); p.rect(9, 8, 2, 2, GOLD[3]); p.px(9, 10, "#2a1608");
  }
  return finish(p, { flames: [{ x: 0, y: -8, w: 14 }] });
};

const sword: Make = () => {
  // lying on the ground, blade catching the light
  const p = new Px(28, 8);
  p.rect(1, 4, 18, 2, IRON[2]); p.rect(1, 4, 18, 1, IRON[3]); p.px(0, 5, IRON[2]);
  p.rect(2, 5, 16, 1, IRON[1]);
  p.rect(19, 1, 2, 7, GOLD[1]); p.px(19, 1, GOLD[3]);
  p.rect(21, 4, 5, 2, "#5a3420"); p.px(22, 4, "#7a4a2c"); p.px(24, 4, "#7a4a2c");
  p.rect(26, 3, 2, 3, GOLD[2]);
  p.px(6, 4, "#ffffff"); p.px(12, 4, "#e8f0ff");
  return finish(p);
};

const crossbow: Make = () => {
  const p = new Px(22, 8);
  p.rect(2, 4, 18, 2, WOOD[2]); p.rect(2, 4, 18, 1, WOOD[3]);
  p.line(6, 0, 4, 7, IRON[2]); p.line(7, 0, 5, 7, IRON[1]);
  p.line(6, 0, 18, 4, "#d8d0c0"); p.line(5, 7, 18, 5, "#d8d0c0");
  p.rect(16, 5, 3, 3, WOOD[1]);
  return finish(p);
};

/** A fallen body: a person's dead frame, with a dark stain. */
const corpse: Make = (st) => {
  const fr = personFrame(lookFor(st === "broken" ? "kai-monk" : "holmgard-soldier"), "right", "dead", 0);
  const p = new Px(fr.width + 6, fr.height);
  p.ellipse(fr.width / 2 + 3, fr.height - 3, 12, 2, "rgba(90,8,6,.85)");
  p.stamp(fr, 3, 0);
  p.g.globalCompositeOperation = "source-atop";
  p.g.fillStyle = "rgba(40,30,40,.28)";
  p.g.fillRect(0, 0, p.w, p.h);
  p.g.globalCompositeOperation = "source-over";
  return { c: p.c, flames: [{ x: 0, y: -6, w: 18 }] };
};

const bones: Make = () => {
  const p = new Px(22, 9);
  const B = "#e8e0cc", D = "#a89e88";
  p.ellipse(5, 4, 4, 3, B); p.rect(3, 4, 2, 1, "#2a2420"); p.rect(6, 4, 2, 1, "#2a2420"); p.rect(4, 7, 3, 1, D);
  p.line(10, 6, 20, 3, B); p.px(9, 6, B); p.px(9, 7, B); p.px(21, 2, B); p.px(21, 4, B);
  p.line(11, 8, 19, 8, D); p.px(10, 8, B); p.px(20, 7, B);
  p.rect(13, 4, 1, 3, D); p.rect(16, 3, 1, 4, D);
  return finish(p);
};

const graves: Make = () => {
  const p = new Px(40, 22);
  const stone = (x: number, h: number, cross: boolean) => {
    if (cross) { p.rect(x + 3, 22 - h, 3, h, STONE[2]); p.rect(x, 22 - h + 3, 9, 3, STONE[2]); p.rect(x + 3, 22 - h, 1, h, STONE[3]); return; }
    p.rect(x, 22 - h + 3, 10, h - 3, STONE[2]); p.ellipse(x + 5, 22 - h + 3, 5, 3, STONE[2]);
    p.rect(x, 22 - h + 3, 1, h - 3, STONE[3]); p.rect(x + 3, 22 - h + 5, 4, 1, STONE[0]); p.rect(x + 4, 22 - h + 7, 2, 1, STONE[0]);
  };
  stone(1, 16, false); stone(15, 20, true); stone(27, 13, false);
  p.rect(0, 20, 40, 2, "#3a4a2a"); for (let x = 0; x < 40; x += 3) p.px(x, 19, "#5a7a3a");
  return finish(p);
};

const sarcophagus: Make = (st) => {
  const p = new Px(38, 16);
  p.rect(1, 6, 36, 10, STONE[1]); p.rect(1, 6, 36, 1, STONE[3]);
  for (let x = 4; x < 36; x += 8) p.rect(x, 9, 4, 4, STONE[0]);
  if (st === "open") { p.poly([[4, 6], [30, 0], [36, 2], [10, 7]], STONE[2]); p.rect(3, 5, 32, 2, "#120c0e"); }
  else { p.rect(0, 3, 38, 4, STONE[2]); p.rect(0, 3, 38, 1, STONE[3]); p.ellipse(19, 3, 6, 2, STONE[2]); p.ellipse(19, 2, 3, 1, STONE[3]); }
  return finish(p);
};

const statue: Make = (st) => {
  const p = new Px(22, 50);
  p.rect(2, 40, 18, 10, STONE[1]); p.rect(2, 40, 18, 1, STONE[3]); p.rect(0, 46, 22, 4, STONE[0]);
  // a robed figure, arm raised
  p.poly([[6, 40], [8, 18], [14, 18], [16, 40]], STONE[2]);
  p.ellipse(11, 14, 3, 4, STONE[2]); p.px(10, 13, STONE[0]); p.px(12, 13, STONE[0]);
  p.line(14, 20, 18, 8, STONE[2]); p.line(15, 20, 19, 8, STONE[1]); p.rect(17, 4, 3, 4, STONE[3]);
  p.rect(8, 18, 1, 22, STONE[3]); p.rect(12, 26, 1, 14, STONE[1]);
  if (st === "broken") { p.g.clearRect(13, 0, 9, 20); p.rect(9, 38, 10, 3, STONE[2]); }
  return finish(p);
};

const pillars: Make = (st) => {
  const p = new Px(40, 52);
  for (const x of [2, 28]) {
    const h = st === "broken" && x > 10 ? 30 : 52;
    p.rect(x, 52 - h + 4, 10, h - 8, STONE[2]); p.rect(x, 52 - h + 4, 2, h - 8, STONE[3]); p.rect(x + 7, 52 - h + 4, 2, h - 8, STONE[1]);
    p.rect(x - 1, 52 - h, 12, 4, STONE[3]); p.rect(x - 1, 48, 12, 4, STONE[1]);
    for (let y = 52 - h + 8; y < 48; y += 4) p.px(x + 4, y, STONE[1]);
  }
  return finish(p);
};

const signpost: Make = (st) => {
  const p = new Px(26, 40);
  p.rect(11, 6, 3, 34, WOOD[1]); p.rect(11, 6, 1, 34, WOOD[3]);
  const board = (y: number, left: boolean) => {
    const x0 = left ? 1 : 12;
    p.rect(x0, y, 13, 5, WOOD[2]); p.rect(x0, y, 13, 1, WOOD[3]);
    p.poly(left ? [[x0, y], [x0 - 2, y + 2], [x0, y + 5]] : [[x0 + 13, y], [x0 + 15, y + 2], [x0 + 13, y + 5]], WOOD[2]);
    for (let x = x0 + 2; x < x0 + 11; x += 2) p.px(x, y + 2, WOOD[0]);
  };
  if (st === "broken") { board(28, true); p.line(14, 16, 20, 8, WOOD[1]); }
  else { board(8, false); board(16, true); }
  p.rect(9, 38, 7, 2, "#4a3a28");
  return finish(p, { flames: [{ x: 0, y: -26, w: 12 }] });
};

const campfire: Make = (st) => {
  const p = new Px(22, 10);
  // ring of stones and crossed logs; flames come from the stage
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.ellipse(11 + Math.cos(a) * 9, 7 + Math.sin(a) * 2.5, 2, 1, i % 2 ? STONE[2] : STONE[1]); }
  p.line(4, 7, 17, 4, WOOD[1]); p.line(4, 8, 17, 5, WOOD[2]);
  p.line(5, 3, 18, 8, WOOD[1]); p.line(5, 4, 18, 9, WOOD[2]);
  p.ellipse(11, 6, 3, 1, st === "broken" ? "#3a3030" : "#ff9a30");
  return finish(p, { flames: st === "broken" ? [] : [{ x: 0, y: -4, w: 10 }] });
};

const candle: Make = () => {
  const p = new Px(8, 12);
  p.rect(2, 3, 4, 8, "#efe6c8"); p.rect(2, 3, 1, 8, "#ffffff"); p.rect(5, 3, 1, 8, "#c8bc98");
  p.rect(0, 10, 8, 2, GOLD[1]); p.px(4, 2, "#3a2a20");
  return finish(p, { flames: [{ x: 0, y: -12, w: 1, small: true }] });
};

const torch: Make = () => {
  const p = new Px(8, 28);
  p.rect(3, 6, 2, 22, WOOD[1]); p.rect(3, 6, 1, 22, WOOD[3]); p.rect(2, 4, 4, 4, "#5a3a22");
  return finish(p, { flames: [{ x: 0, y: -27, w: 2, small: true }] });
};

const cart: Make = (st) => {
  const p = new Px(46, 26);
  // bed
  planks(p, 2, 6, 38, 10, WOOD, false, 4);
  p.rect(2, 6, 38, 1, WOOD[3]);
  for (const x of [2, 20, 38]) p.rect(x, 4, 2, 12, WOOD[1]);
  p.line(40, 13, 46, 15, WOOD[1]); p.line(40, 14, 46, 16, WOOD[2]);
  if (st !== "broken") {
    // load under a cloth
    p.ellipse(20, 6, 15, 5, CLOTH[2]); p.ellipse(18, 4, 10, 3, CLOTH[3]); p.line(8, 6, 32, 5, CLOTH[1]);
  } else { p.rect(4, 15, 12, 4, WOOD[1]); }
  const wheel = (cx: number, broke: boolean) => {
    p.ellipse(cx, 20, 6, 6, WOOD[0]); p.ellipse(cx, 20, 5, 5, WOOD[2]); p.ellipse(cx, 20, 3, 3, "rgba(0,0,0,0)");
    p.g.clearRect(cx - 3, 18, 7, 5);
    p.line(cx - 4, 20, cx + 4, 20, WOOD[1]); p.line(cx, 16, cx, 24, WOOD[1]); p.rect(cx - 1, 19, 2, 2, IRON[2]);
    if (broke) p.g.clearRect(cx - 6, 21, 13, 6);
  };
  wheel(10, false); wheel(32, st === "broken");
  return finish(p, { flames: [{ x: -4, y: -12, w: 30 }] });
};

const boat: Make = (st) => {
  const p = new Px(52, 16);
  p.poly([[0, 4], [52, 4], [46, 15], [6, 15]], WOOD[1]);
  p.poly([[1, 4], [51, 4], [49, 7], [3, 7]], WOOD[2]);
  p.rect(2, 4, 48, 1, WOOD[3]);
  for (let y = 9; y < 15; y += 3) p.rect(6, y, 40, 1, WOOD[0]);
  p.rect(14, 2, 3, 3, WOOD[2]); p.rect(34, 2, 3, 3, WOOD[2]);
  p.line(36, 1, 50, -3, WOOD[3]);
  if (st === "broken") { p.g.clearRect(30, 9, 9, 7); p.line(30, 9, 38, 15, WOOD[0]); }
  return finish(p, { flames: [{ x: 0, y: -8, w: 40 }] });
};

const tent: Make = (st) => {
  const p = new Px(44, 32);
  const c = ["#5a4a2c", "#8a7448", "#b29a64", "#d4c08a"];
  p.poly([[22, 0], [44, 32], [0, 32]], c[2]);
  p.poly([[22, 0], [44, 32], [30, 32]], c[1]);
  p.line(22, 0, 0, 32, c[3]);
  if (st === "open") p.poly([[22, 10], [29, 32], [15, 32]], "#1a120c");
  else { p.poly([[22, 10], [28, 32], [16, 32]], c[1]); p.line(22, 10, 22, 32, c[0]); }
  p.rect(21, 0, 2, 3, WOOD[1]); p.rect(22, -2, 1, 3, "#c03020");
  if (st === "broken") { p.g.clearRect(26, 4, 10, 10); p.line(26, 10, 34, 20, c[0]); }
  return finish(p, { flames: [{ x: 0, y: -14, w: 30 }] });
};

const hut: Make = (st) => {
  const p = new Px(54, 46);
  // log walls, thatched roof
  planks(p, 6, 22, 42, 24, WOOD, false, 8);
  p.rect(6, 22, 42, 1, WOOD[3]);
  const th = ["#6a5428", "#8e7438", "#b0944c", "#cfb466"];
  p.poly([[0, 24], [27, 2], [54, 24]], th[2]);
  for (let y = 6; y < 24; y += 3) p.line(27 - (y - 2) * 1.2, y, 27 + (y - 2) * 1.2, y, y % 2 ? th[1] : th[3]);
  p.line(0, 24, 54, 24, th[0]);
  p.rect(22, 30, 10, 16, st === "open" ? "#120c08" : WOOD[1]);
  if (st !== "open") { p.rect(23, 31, 8, 15, WOOD[2]); p.px(29, 38, GOLD[2]); }
  p.rect(10, 28, 7, 6, "#1a120c"); p.rect(10, 28, 7, 1, WOOD[3]); p.rect(13, 28, 1, 6, WOOD[1]);
  p.rect(38, 28, 7, 6, "#e8b860"); p.rect(41, 28, 1, 6, WOOD[1]);
  if (st === "broken") { p.g.clearRect(30, 2, 20, 14); p.line(30, 10, 46, 22, th[0]); }
  return finish(p, { flames: [{ x: -10, y: -34, w: 20 }, { x: 10, y: -28, w: 18 }] });
};

const watchtower: Make = () => {
  const p = new Px(30, 64);
  for (const x of [4, 24]) { p.rect(x, 18, 2, 46, WOOD[1]); p.rect(x, 18, 1, 46, WOOD[3]); }
  p.line(5, 30, 25, 50, WOOD[1]); p.line(25, 30, 5, 50, WOOD[1]);
  planks(p, 1, 10, 28, 8, WOOD, true, 3);
  p.poly([[0, 10], [15, 0], [30, 10]], "#7a3a24"); p.line(0, 10, 30, 10, "#4a2214");
  p.rect(10, 12, 10, 3, "#1a120c");
  return finish(p);
};

const fence: Make = (st) => {
  const p = new Px(44, 18);
  for (let x = 1; x < 44; x += 7) {
    if (st === "broken" && x > 20 && x < 32) { p.rect(x, 12, 2, 6, WOOD[1]); continue; }
    p.rect(x, 2, 3, 16, WOOD[2]); p.rect(x, 2, 1, 16, WOOD[3]); p.px(x + 1, 1, WOOD[2]);
  }
  for (const y of [6, 12]) { p.rect(0, y, st === "broken" && y === 6 ? 20 : 44, 2, WOOD[1]); p.rect(0, y, st === "broken" && y === 6 ? 20 : 44, 1, WOOD[3]); }
  return finish(p, { flames: [{ x: 0, y: -8, w: 34 }] });
};

const wall: Make = (st) => {
  const p = new Px(50, 30);
  p.rect(0, 4, 50, 26, STONE[1]);
  for (let y = 4; y < 30; y += 5) for (let x = (y / 5) % 2 ? 0 : -5; x < 50; x += 10) {
    p.rect(x + 1, y + 1, 8, 3, STONE[2]); p.rect(x + 1, y + 1, 8, 1, STONE[3]);
  }
  for (let x = 0; x < 50; x += 10) p.rect(x, 0, 6, 5, STONE[2]);
  if (st === "broken") { p.g.clearRect(18, 0, 16, 16); p.poly([[18, 16], [24, 8], [30, 12], [34, 16]], STONE[1]); p.rect(14, 27, 10, 3, STONE[2]); }
  return finish(p);
};

const bridge: Make = (st) => {
  const p = new Px(64, 16);
  planks(p, 0, 8, 64, 4, WOOD, true, 2);
  p.rect(0, 8, 64, 1, WOOD[3]);
  for (const x of [2, 30, 60]) { p.rect(x, 0, 2, 16, WOOD[1]); p.rect(x, 0, 1, 16, WOOD[3]); }
  p.line(2, 1, 30, 3, "#c8b080"); p.line(30, 3, 60, 1, "#c8b080");
  if (st === "broken") { p.g.clearRect(34, 4, 14, 12); p.line(34, 10, 38, 15, WOOD[1]); }
  return finish(p, { flames: [{ x: 0, y: -10, w: 50 }] });
};

const stairs: Make = () => {
  const p = new Px(32, 24);
  for (let i = 0; i < 6; i++) { const y = 24 - (i + 1) * 4, x = i * 3; p.rect(x, y, 32 - x, 4, i % 2 ? STONE[1] : STONE[2]); p.rect(x, y, 32 - x, 1, STONE[3]); }
  return finish(p);
};

const trapdoor: Make = (st) => {
  const p = new Px(26, 12);
  p.ellipse(13, 9, 12, 3, "#2a1e14");
  if (st === "open") {
    p.ellipse(13, 9, 10, 2, "#0a0604");
    p.poly([[3, 9], [5, 0], [21, 0], [23, 9]], WOOD[2]); p.rect(5, 1, 16, 1, WOOD[3]);
    p.rect(12, 3, 2, 3, IRON[2]);
  } else {
    p.ellipse(13, 9, 10, 2, WOOD[2]);
    for (let x = 5; x < 22; x += 4) p.rect(x, 7, 1, 5, WOOD[1]);
    p.rect(11, 8, 4, 1, IRON[2]); p.px(13, 9, IRON[3]);
  }
  return { ...finish(p), flat: st !== "open" };
};

const lever: Make = (st) => {
  const p = new Px(14, 20);
  p.rect(2, 14, 10, 6, STONE[1]); p.rect(2, 14, 10, 1, STONE[3]);
  if (st === "open") { p.line(7, 15, 12, 4, IRON[2]); p.line(8, 15, 13, 4, IRON[1]); p.ellipse(12, 3, 2, 2, "#c03020"); }
  else { p.line(7, 15, 2, 4, IRON[2]); p.line(8, 15, 3, 4, IRON[1]); p.ellipse(2, 3, 2, 2, "#c03020"); }
  return finish(p);
};

const key: Make = () => {
  const p = new Px(14, 7);
  p.ellipse(3, 3, 3, 3, GOLD[2]); p.rect(2, 2, 2, 2, "rgba(0,0,0,0)"); p.g.clearRect(2, 2, 2, 2);
  p.rect(6, 3, 7, 1, GOLD[2]); p.rect(6, 2, 7, 1, GOLD[3]);
  p.rect(10, 4, 1, 2, GOLD[1]); p.rect(12, 4, 1, 3, GOLD[1]);
  return finish(p);
};

const scroll: Make = (st) => {
  const p = new Px(16, 8);
  const P = ["#a88a5a", "#d8c08a", "#f0e0b0"];
  if (st === "open") {
    p.rect(2, 1, 12, 6, P[2]); p.rect(0, 0, 2, 8, P[1]); p.rect(14, 0, 2, 8, P[1]);
    for (let y = 2; y < 6; y++) p.rect(4, y, 4 + ((y * 3) % 5), 1, "#5a4030");
  } else {
    p.rect(1, 2, 14, 5, P[1]); p.rect(1, 2, 14, 1, P[2]); p.rect(1, 6, 14, 1, P[0]);
    p.rect(7, 2, 2, 5, "#a02020"); p.px(7, 4, "#e05040");
  }
  return finish(p);
};

const gem: Make = () => {
  const p = new Px(9, 9);
  p.poly([[4, 0], [8, 3], [4, 9], [0, 3]], "#2aa0e0");
  p.poly([[4, 0], [8, 3], [4, 4]], "#8ae0ff"); p.poly([[0, 3], [4, 4], [4, 9]], "#1a6aa8");
  p.px(3, 2, "#ffffff");
  return finish(p);
};

const pouch: Make = () => {
  const p = new Px(10, 10);
  p.ellipse(5, 6, 4, 4, CLOTH[1]); p.ellipse(4, 5, 2, 2, CLOTH[2]);
  p.rect(3, 1, 4, 2, CLOTH[0]); p.rect(2, 2, 6, 1, "#c03020");
  p.px(8, 8, GOLD[2]); p.px(9, 9, GOLD[3]);
  return finish(p);
};

const sack: Make = () => {
  const p = new Px(14, 16);
  p.ellipse(7, 10, 6, 6, CLOTH[2]); p.ellipse(5, 9, 3, 4, CLOTH[3]);
  p.rect(5, 2, 4, 4, CLOTH[1]); p.rect(4, 4, 6, 1, "#5a4030");
  p.line(7, 8, 9, 14, CLOTH[1]);
  return finish(p, { flames: [{ x: 0, y: -8, w: 10 }] });
};

const bottles: Make = () => {
  const p = new Px(16, 12);
  const b = (x: number, h: number, col: string) => { p.rect(x, 12 - h, 4, h, col); p.rect(x + 1, 12 - h - 3, 2, 3, col); p.px(x + 1, 12 - h + 1, "#ffffff"); p.rect(x + 1, 12 - h - 4, 2, 1, WOOD[1]); };
  b(1, 7, "#3a8a4a"); b(6, 9, "#8a3a2a"); b(11, 6, "#3a5a9a");
  return finish(p);
};

const table: Make = (st) => {
  const p = new Px(34, 16);
  planks(p, 0, 2, 34, 4, WOOD, true, 6);
  p.rect(0, 2, 34, 1, WOOD[3]);
  p.rect(2, 6, 3, 10, WOOD[1]); p.rect(29, 6, 3, 10, WOOD[1]);
  if (st !== "broken") { p.rect(8, 0, 4, 2, "#c8c0b0"); p.rect(20, -1, 3, 3, "#8a3a2a"); p.rect(14, 1, 6, 1, "#e8d8a0"); }
  return finish(p, { flames: [{ x: 0, y: -8, w: 26 }] });
};

const bench: Make = () => {
  const p = new Px(30, 10);
  planks(p, 0, 2, 30, 3, WOOD, true, 2); p.rect(0, 2, 30, 1, WOOD[3]);
  p.rect(3, 5, 2, 5, WOOD[1]); p.rect(25, 5, 2, 5, WOOD[1]);
  return finish(p);
};

const bed: Make = () => {
  const p = new Px(40, 16);
  planks(p, 0, 8, 40, 8, WOOD, false, 3);
  p.rect(0, 2, 3, 14, WOOD[1]); p.rect(37, 4, 3, 12, WOOD[1]);
  p.rect(3, 5, 34, 4, "#d8d0c0"); p.rect(3, 5, 9, 3, "#f0ece0");
  p.rect(12, 4, 25, 5, "#8a3a2a"); p.rect(12, 4, 25, 1, "#b05a40");
  return finish(p);
};

const tapestry: Make = () => {
  const p = new Px(22, 34);
  p.rect(0, 0, 22, 2, WOOD[2]);
  p.rect(2, 2, 18, 30, "#7a2020"); p.rect(2, 2, 18, 1, "#a03030");
  p.rect(4, 4, 14, 26, "#8a2a24");
  p.ellipse(11, 14, 4, 5, GOLD[2]); p.rect(10, 18, 2, 8, GOLD[1]);
  for (let x = 2; x < 20; x += 3) p.rect(x, 32, 2, 2, GOLD[1]);
  return finish(p);
};

const banners: Make = () => {
  const p = new Px(30, 44);
  for (const [x, col] of [[3, "#2a5ab0"], [19, "#c09020"]] as const) {
    p.rect(x + 3, 0, 1, 44, WOOD[1]);
    p.rect(x, 4, 8, 20, col); p.poly([[x, 24], [x + 4, 20], [x + 8, 24]], "rgba(0,0,0,0)");
    p.g.clearRect(x + 3, 21, 2, 3);
    p.rect(x, 4, 8, 1, hs(col, 0.25)); p.rect(x + 2, 9, 4, 4, "#f0e0b0");
  }
  return finish(p, { flames: [{ x: 0, y: -30, w: 22 }] });
};

const rocks: Make = (st) => {
  const p = new Px(36, 18);
  p.ellipse(10, 12, 9, 6, STONE[1]); p.ellipse(8, 10, 5, 3, STONE[2]); p.px(6, 8, STONE[3]);
  p.ellipse(25, 13, 10, 5, STONE[1]); p.ellipse(23, 11, 6, 3, STONE[2]);
  p.ellipse(18, 15, 5, 3, STONE[0]);
  if (st === "broken") for (let i = 0; i < 6; i++) p.rect(2 + i * 6, 16, 2, 2, STONE[2]);
  p.rect(2, 16, 4, 1, "#4a6a3a"); p.rect(30, 16, 3, 1, "#4a6a3a");
  return finish(p);
};

const cliff: Make = () => {
  const p = new Px(54, 46);
  p.poly([[0, 46], [4, 14], [14, 4], [26, 8], [36, 0], [48, 10], [54, 46]], STONE[1]);
  p.poly([[4, 14], [14, 4], [26, 8], [22, 20], [10, 22]], STONE[2]);
  p.poly([[36, 0], [48, 10], [40, 18]], STONE[2]);
  for (let y = 18; y < 46; y += 6) p.line(6 + (y % 12), y, 18 + (y % 9), y + 3, STONE[0]);
  p.rect(10, 2, 8, 3, "#4a7a3a"); p.rect(34, 0, 6, 2, "#4a7a3a");
  return finish(p);
};

const caveMouth: Make = () => {
  const p = new Px(56, 40);
  p.poly([[0, 40], [6, 12], [20, 2], [36, 2], [50, 12], [56, 40]], STONE[1]);
  p.poly([[12, 40], [16, 18], [28, 10], [40, 18], [44, 40]], "#0a0808");
  p.poly([[6, 12], [20, 2], [24, 8], [10, 16]], STONE[2]);
  for (let x = 18; x < 40; x += 5) p.poly([[x, 12], [x + 3, 12], [x + 1, 17]], STONE[0]);
  return finish(p);
};

const log: Make = (st) => {
  const p = new Px(40, 10);
  p.rect(4, 2, 32, 8, WOOD[1]); p.rect(4, 2, 32, 2, WOOD[2]); p.rect(4, 9, 32, 1, WOOD[0]);
  for (let x = 8; x < 34; x += 6) p.px(x, 5 + (x % 3), WOOD[0]);
  p.ellipse(4, 6, 3, 4, "#c8a070"); p.ellipse(4, 6, 1, 2, "#8a6040");
  for (let x = 8; x < 34; x += 4) p.px(x, 1, "#5a9a3a");
  return finish(p, { flames: st === "burning" ? [{ x: 0, y: -6, w: 28 }] : [] });
};

const ferns: Make = () => {
  const p = new Px(30, 16);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + 0.4 + (k / 6) * (Math.PI - 0.8);
    let x = 15, y = 15;
    for (let i = 0; i < 12; i++) { x += Math.cos(a) * 1.1; y += Math.sin(a) * 1.0 + i * 0.07; p.px(x, y, i % 2 ? "#4a8a3a" : "#3a6a2a"); if (i % 2 === 0) p.px(x, y - 1, "#7ab04a"); }
  }
  return finish(p);
};

const farm: Make = () => {
  // haystack and a rake
  const p = new Px(36, 26);
  const H = ["#9a7a2a", "#c8a040", "#e8c860", "#fff0a0"];
  p.ellipse(18, 18, 16, 8, H[1]); p.ellipse(18, 12, 12, 10, H[1]); p.ellipse(16, 8, 7, 5, H[2]);
  for (let i = 0; i < 30; i++) p.px(6 + ((i * 7) % 24), 6 + ((i * 11) % 18), i % 3 ? H[0] : H[3]);
  p.line(30, 2, 34, 26, WOOD[2]);
  return finish(p, { flames: [{ x: 0, y: -14, w: 26 }] });
};

const arrows: Make = () => {
  const p = new Px(26, 14);
  for (const [x, l] of [[3, 10], [10, 12], [17, 9], [22, 11]]) {
    p.line(x, 14, x + 3, 14 - l, WOOD[3]);
    p.rect(x + 2, 14 - l, 3, 2, "#e8e0d0"); p.px(x + 3, 14 - l - 1, "#c03020");
  }
  return finish(p);
};


const altar: Make = (st) => {
  const p = new Px(30, 22);
  p.rect(2, 8, 26, 14, STONE[1]); p.rect(0, 5, 30, 4, STONE[2]); p.rect(0, 5, 30, 1, STONE[3]);
  for (let x = 5; x < 26; x += 7) p.rect(x, 11, 3, 8, STONE[0]);
  if (st !== "broken") { p.rect(12, 1, 6, 4, GOLD[1]); p.rect(13, 0, 4, 2, GOLD[3]); p.px(15, 2, "#c03020"); }
  else p.g.clearRect(20, 5, 10, 8);
  return finish(p, { flames: [{ x: -10, y: -22, w: 1, small: true }, { x: 10, y: -22, w: 1, small: true }] });
};

const throne: Make = () => {
  const p = new Px(26, 40);
  p.rect(3, 0, 20, 30, "#6a1a1a"); p.rect(5, 2, 16, 26, "#8a2a24"); p.rect(3, 0, 20, 2, GOLD[2]);
  for (const x of [2, 12, 22]) { p.rect(x, 0, 2, 4, GOLD[2]); p.px(x, -1, GOLD[3]); }
  p.rect(0, 24, 26, 6, GOLD[1]); p.rect(0, 24, 26, 1, GOLD[3]);
  p.rect(1, 30, 4, 10, GOLD[1]); p.rect(21, 30, 4, 10, GOLD[1]); p.rect(5, 30, 16, 3, "#5a1414");
  p.rect(12, 8, 2, 2, "#8ad0ff");
  return finish(p);
};

const ladder: Make = (st) => {
  const p = new Px(14, 46);
  p.rect(1, 0, 2, 46, WOOD[2]); p.rect(11, 0, 2, 46, WOOD[2]); p.rect(1, 0, 1, 46, WOOD[3]);
  for (let y = 4; y < 46; y += 6) { if (st === "broken" && y > 20 && y < 34) continue; p.rect(3, y, 8, 2, WOOD[1]); p.rect(3, y, 8, 1, WOOD[3]); }
  return finish(p);
};

const rope: Make = () => {
  const p = new Px(16, 12);
  for (let i = 0; i < 3; i++) p.ellipse(8, 8 - i, 7 - i, 3, i % 2 ? "#a88a50" : "#c8a868");
  p.ellipse(8, 7, 3, 1, "rgba(0,0,0,0)"); p.g.clearRect(6, 6, 5, 2);
  p.line(13, 6, 16, 2, "#c8a868");
  return finish(p);
};

const ruins: Make = () => {
  const p = new Px(50, 34);
  p.rect(2, 8, 8, 26, STONE[1]); p.rect(2, 8, 2, 26, STONE[3]); p.poly([[2, 8], [6, 2], [10, 8]], STONE[1]);
  p.rect(12, 20, 26, 14, STONE[1]); p.poly([[12, 20], [20, 14], [26, 18], [32, 12], [38, 20]], STONE[1]);
  for (let y = 22; y < 34; y += 4) p.rect(14, y, 22, 1, STONE[0]);
  p.rect(40, 26, 8, 8, STONE[2]); p.rect(42, 30, 6, 4, STONE[0]);
  p.rect(0, 32, 50, 2, "#3a4a2a");
  return finish(p);
};

// flat ground decals
function decal(w: number, h: number, paint: (p: Px) => void): PropArt {
  const p = new Px(w, h);
  paint(p);
  return { c: p.c, flat: true };
}
const pathDecal: Make = () => decal(70, 10, (p) => {
  p.ellipse(35, 5, 34, 4, "rgba(120,90,56,.55)"); p.ellipse(35, 5, 28, 2, "rgba(150,116,76,.5)");
  for (let i = 0; i < 18; i++) p.px(6 + ((i * 13) % 58), 3 + ((i * 7) % 5), "rgba(200,180,140,.7)");
});
const crossroadsDecal: Make = () => decal(80, 14, (p) => {
  p.ellipse(40, 7, 38, 4, "rgba(120,90,56,.55)"); p.poly([[30, 0], [50, 0], [56, 14], [24, 14]], "rgba(130,98,62,.5)");
});
const waterDecal: Make = (st) => decal(st === "open" ? 90 : 70, 12, (p) => {
  const w = p.w;
  p.ellipse(w / 2, 6, w / 2 - 1, 5, "rgba(40,90,140,.8)"); p.ellipse(w / 2, 5, w / 2 - 6, 3, "rgba(70,130,180,.8)");
  for (let i = 0; i < 10; i++) p.rect(8 + ((i * 17) % (w - 16)), 3 + (i % 3) * 2, 4, 1, "rgba(200,230,255,.8)");
});
const pawDecal: Make = () => decal(46, 8, (p) => {
  for (let i = 0; i < 6; i++) { const x = 3 + i * 7, y = 2 + (i % 2) * 3; p.ellipse(x, y + 1, 1, 1, "rgba(40,28,20,.7)"); p.px(x - 1, y - 1, "rgba(40,28,20,.7)"); p.px(x + 1, y - 1, "rgba(40,28,20,.7)"); }
});
const bloodDecal: Make = () => decal(22, 6, (p) => { p.ellipse(11, 3, 10, 2, "rgba(110,8,6,.85)"); p.ellipse(7, 3, 4, 1, "rgba(150,16,10,.85)"); p.px(19, 1, "rgba(110,8,6,.85)"); });
const scorchDecal: Make = () => decal(30, 8, (p) => { p.ellipse(15, 4, 14, 3, "rgba(20,14,10,.75)"); p.ellipse(15, 4, 8, 2, "rgba(10,6,4,.8)"); });

/** Horse: the living creature sprite, standing still (the stage animates it). */
const horse: Make = () => ({ c: creatureFrame("horse", "idle", 0, "left") });

const MAKERS: Record<string, Make> = {
  door, gate, crate, barrel, chest, sword, crossbow, corpse, body: corpse, bones, skeleton: bones, graves, grave: graves, tomb: sarcophagus, sarcophagus, coffin: sarcophagus,
  statue, pillars, pillar: pillars, signpost, sign: signpost, campfire, fire: campfire, candle, torch, cart, wagon: cart, boat, raft: boat, ship: boat,
  tent, tents: tent, hut, cabin: hut, house: hut, watchtower, tower: watchtower, fence, wall, bridge, stairs, steps: stairs, trapdoor, hatch: trapdoor, lever,
  key, scroll, map: scroll, letter: scroll, book: scroll, gem, jewel: gem, crystal: gem, pouch, purse: pouch, coins: pouch, sack, bag: sack, bottles, potion: bottles, bottle: bottles,
  table, bench, bed, tapestry, banners, banner: banners, flag: banners, rocks, rock: rocks, boulder: rocks, stones: rocks, cliff, "cave-mouth": caveMouth, cave: caveMouth,
  altar, shrine: altar, throne, ladder, rope, ruins, rubble: ruins, vial: bottles, flask: bottles, chair: bench, stool: bench, well: barrel, coffer: chest, box: crate, crates: crate, barrels: barrel,
  log, "fallen-tree": log, tree: log, ferns, bush: ferns, plants: ferns, farm, haystack: farm, hay: farm, arrows,
  path: pathDecal, road: pathDecal, track: pathDecal, crossroads: crossroadsDecal, stream: waterDecal, river: (s) => waterDecal(s || "open"), lake: (s) => waterDecal(s || "open"), pool: waterDecal, puddle: waterDecal,
  pawprints: pawDecal, footprints: pawDecal, tracks: pawDecal, blood: bloodDecal, scorch: scorchDecal, horse,
};

/** Best maker for a prop word: exact, then a known word inside it, then a generic object. */
export function propKind(word: string): string {
  const w = word.toLowerCase().trim();
  if (MAKERS[w]) return w;
  const parts = w.split(/[-_\s]+/);
  for (const part of [...parts].reverse()) if (MAKERS[part]) return part;
  for (const k of Object.keys(MAKERS)) if (k.length > 3 && w.includes(k)) return k;
  if (/box|case|cask/.test(w)) return "crate";
  if (/barrel|keg|tun/.test(w)) return "barrel";
  if (/weapon|blade|axe|spear|mace|dagger/.test(w)) return "sword";
  if (/coin|gold|treasure/.test(w)) return "pouch";
  return "sack";
}

const cache = memo((key: string): PropArt => {
  const [kind, state] = key.split("|") as [string, PropState];
  const make = MAKERS[kind] ?? sack;
  const base = make(state === "burning" ? "" : state);
  if (state !== "burning") return base;
  const flames = base.flames && base.flames.length ? base.flames : [{ x: 0, y: -Math.round(base.c.height * 0.6), w: Math.max(6, Math.round(base.c.width * 0.6)) }];
  return { ...base, c: base.flat ? base.c : charred(base.c), flames };
});

/** The art of a prop (cached): its word as written in the staging and its state. */
export function propArt(word: string, state: string = ""): PropArt {
  const st = (["open", "broken", "burning", "closed"].includes(state) ? (state === "closed" ? "" : state) : "") as PropState;
  return cache(`${propKind(word)}|${st}`);
}

/** True when the word names a prop the art knows (not the generic fallback). */
export const isKnownProp = (word: string) => !!MAKERS[word.toLowerCase().trim()] || word.toLowerCase().split(/[-_\s]+/).some((w) => !!MAKERS[w]);

/** Props that are alive (animated sprite) rather than a still object. */
export const isLivingProp = (word: string) => propKind(word) === "horse";
/** Props that carry their own small flame (campfire, candle, torch) when not broken. */
export const isLitProp = (word: string) => ["campfire", "candle", "torch"].includes(propKind(word));
