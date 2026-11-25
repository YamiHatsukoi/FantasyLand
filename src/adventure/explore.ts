/**
 * Explore mode: a section played as a small walkable area. The place is built as a top-down
 * tile map (forest clearing, village, city gate, inn, dungeon, ship deck...) from the scene's
 * background, the same every visit (seeded by the place), and the section's choices stand in
 * it: exits at the map's edges, doors on buildings, people to talk to and things to look at.
 * The hero walks there (tap / click with A*, or the keyboard); reaching a spot opens a little
 * prompt that picks the choice.
 *
 * Scale: terrain, buildings and props are FantasyLand's 16px art drawn at 2x (a tile is 32
 * world pixels); characters are Adventure's 32x48 sprites at 1x, so a person is one tile wide.
 * The world is drawn into a small buffer at world resolution and scaled up crisp (integer
 * factor, sub-pixel camera). The ground, water banks, walls and floors are pre-rendered once;
 * each frame only blits it and draws sprites, particles, light and weather.
 */
import { sfx } from "../audio/sfx";
import { Rng, hashString } from "../core/rng";
import { buildingCanvas, cropCanvas } from "../render/buildings";
import { floorTile } from "../render/floors";
import { barrel, cell, chimney, crate, doorAt, foundation, groundShadow, hangingSign, lantern, roofSlab, wallTex, windowAt, type RoofKind, type WallKind } from "../render/houses";
import { makeCanvas, outline, type Paint } from "../render/palette";
import { propCanvas } from "../render/props";
import { OBSTACLES, T, tileSet } from "../render/tiles";
import { BIOMES, type Biome } from "../world/biomes";
import { findPath } from "../world/mapgen";
import { creatureFrame, creatureSize } from "./art/creatures";
import { FLAMES, archWin, battlements, castleDoor, drawShip, dungeonFace, furniture, hangBanner, towerArt } from "./art/interiors";
import { iconEl, uiIcon } from "./art/icons";
import { lookFor, personFrame, type Facing, type Look, type Pose } from "./art/people";
import { Px, hs, mix, rgba } from "./art/px";
import { isMonster } from "./stage";
import type { Choice, Scene } from "./types";

// ============================================================ public API
type Side = "north" | "south" | "east" | "west";
type Via = NonNullable<Choice["via"]>;

export interface ExploreOpts {
  host: HTMLElement;
  seed: string;
  scene: Scene;
  heroLook: Look;
  entryFrom?: Side;
  spots: { key: number; label: string; via: Via; locked?: string }[];
  onPick: (key: number) => void;
}

// ============================================================ constants & small utilities
/** World pixels per art pixel of the terrain (FantasyLand art is drawn at 2x). */
const N = 2;
/** World pixels per tile. */
const TW = 16 * N;
/** Feet of a character standing in a tile, from the tile's top. */
const FEET = 25;

type Pt = { x: number; y: number };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const DIR4: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SIDE_V: Record<Side, Pt> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

/** Smooth value noise in [0, 1). */
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = cell(xi, yi, s), b = cell(xi + 1, yi, s), c = cell(xi, yi + 1, s), d = cell(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s: number) => noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.1;

/** Does the (Vietnamese or English) label contain one of the words? Whole words, diacritics kept. */
function hasWord(label: string, words: string[]) {
  const s = ` ${label.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return words.some((w) => s.includes(` ${w.normalize("NFC")} `));
}

// ============================================================ art: caches and helpers
const memo = <T>(make: (k: string) => T) => {
  const m = new Map<string, T>();
  return (k: string) => { let v = m.get(k); if (v === undefined) { v = make(k); m.set(k, v); } return v; };
};

/** A tall FantasyLand obstacle sprite (32x48 art, base at y = 46). */
const tallArt = memo((k: string) => {
  const [motif, cols, v] = k.split("|");
  const [c, p] = makeCanvas(32, 48);
  const o = cols.split(",") as [string, string, string, string];
  (OBSTACLES[motif] ?? OBSTACLES.rock)(p, o, new Rng(hashString(k) + Number(v) * 131));
  return c;
});
const tall = (motif: string, b: Biome | [string, string, string, string], v: number) =>
  tallArt(`${motif}|${(Array.isArray(b) ? b : b.obs).join(",")}|${v}`);

/** Light sprite: a soft round falloff in one colour. */
const lightArt = memo((col: string) => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 1));
  gr.addColorStop(0.35, rgba(col, 0.55));
  gr.addColorStop(0.7, rgba(col, 0.16));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
});

/** Canvas tinted over its painted pixels (murky water, night windows...). */
function tinted(src: HTMLCanvasElement, col: string, a: number, cache: Map<HTMLCanvasElement, HTMLCanvasElement>) {
  let c = cache.get(src);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = rgba(col, a);
  g.fillRect(0, 0, c.width, c.height);
  cache.set(src, c);
  return c;
}

/** Native-scale canvas (16px tiles); drawn into the world at 2x. */
function art(w: number, h: number): [HTMLCanvasElement, Paint] {
  const [c, p] = makeCanvas(w, h);
  return [c, p];
}
const ell = (p: Paint, cx: number, cy: number, rx: number, ry: number, col: string) => {
  p.g.fillStyle = col; p.g.beginPath(); p.g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); p.g.fill();
};
/** Filled polygon, scanline (pixel-exact, no anti-aliasing). */
function poly(p: Paint, pts: [number, number][], col: string) {
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
const softShadow = (p: Paint, cx: number, cy: number, rx: number, ry = 2) => {
  ell(p, cx + 1, cy, rx + 1, ry + 0.5, "rgba(24,12,40,.16)");
  ell(p, cx, cy, rx * 0.8, ry * 0.75, "rgba(24,12,40,.2)");
};

// ------------------------------------------------------------ buildings
export type BStyle = "house" | "cottage" | "inn" | "shop" | "smith" | "temple" | "tower" | "keep" | "hut" | "tent" | "cave" | "ruin" | "barn" | "manor" | "gatehouse" | "stable";

interface BSpec {
  style: BStyle;
  /** Footprint in tiles (door at the bottom middle). */
  tw: number;
  th: number;
  lit: boolean;
  seed: number;
  snow?: boolean;
  closed?: boolean;
}

const HOUSE_LOOKS: { wall: string; roof: string; wk: WallKind; rk: RoofKind; trim?: string; door?: string; shutters?: string }[] = [
  { wall: "#c8945a", roof: "#b84a3a", wk: "siding", rk: "shingle", shutters: "#3a6a4a" },
  { wall: "#b07a48", roof: "#c8a05a", wk: "log", rk: "thatch" },
  { wall: "#e8dcc4", roof: "#6a4a3a", wk: "timber", rk: "thatch" },
  { wall: "#b0b0a8", roof: "#4a5a8a", wk: "stone", rk: "slate", shutters: "#6a3a2a" },
  { wall: "#ece4d4", roof: "#9a3a2a", wk: "timber", rk: "tile", shutters: "#4a3a5a" },
  { wall: "#c87a5a", roof: "#3a3a4a", wk: "brick", rk: "slate", trim: "#f0e8d8" },
  { wall: "#a8a098", roof: "#7a2a2a", wk: "stone", rk: "shingle" },
  { wall: "#d8c8a8", roof: "#3a6a4a", wk: "plank", rk: "shingle", door: "#6a4a2a" },
];

/**
 * A building in FantasyLand's three-quarter style (render/houses.ts parts), with taller walls
 * than the sanctuary's so a door fits a 48-pixel hero. Canvas: footprint plus headroom; the
 * footprint's bottom edge is the canvas bottom.
 */
const buildingArt = memo((key: string) => {
  const o = JSON.parse(key) as BSpec;
  const W = o.tw * 16, head = o.style === "tower" ? 46 : o.style === "keep" ? 50 : o.style === "gatehouse" ? 30 : 14, H = o.th * 16 + head;
  const [c, p] = art(W, H);
  const r = new Rng(o.seed);
  const look = HOUSE_LOOKS[o.seed % HOUSE_LOOKS.length];
  const lit = o.lit;
  const snowRoof = (top: number, bottom: number, x0: number, x1: number) => {
    if (!o.snow) return;
    for (let y = top; y < bottom; y += 1) for (let x = x0; x <= x1; x++) if (cell(x, y, o.seed) > 0.42 + (y - top) / (bottom - top) * 0.5) p.px(x, y, cell(x, y, 3) > 0.5 ? "#f4f8fc" : "#dce8f4");
  };
  const std = (wall: string, roof: string, wk: WallKind, rk: RoofKind, extra: { floors?: number; chimney?: boolean; emblem?: string; trim?: string; door?: string; shutters?: string; gable?: boolean; props?: boolean; doorH?: number; dormer?: boolean } = {}) => {
    const floors = extra.floors ?? 1;
    const foundTop = H - 4;
    const wallH = 24 + (floors - 1) * 12;
    const wallTop = foundTop - wallH;
    const eave = wallTop + 1;
    const roofTop = Math.max(2, H - o.th * 16 - 6);
    groundShadow(p, W, H);
    wallTex(p, 1, wallTop, W - 2, wallH, wall, wk, o.seed);
    foundation(p, 0, foundTop, W);
    const { ridgeL } = roofSlab(p, 0, W - 1, roofTop, eave, roof, rk, o.seed);
    snowRoof(roofTop - 2, eave, 1, W - 2);
    p.g.fillStyle = "rgba(24,12,40,0.32)"; p.g.fillRect(1, eave + 2, W - 2, 2);
    if (extra.chimney) chimney(p, W - 13 - (o.seed % 2) * 6, Math.max(3, roofTop - 4), roofTop + Math.round((eave - roofTop) * 0.45));
    const trim = extra.trim ?? (wk === "stone" || wk === "brick" ? "#e8dcc4" : "#f0e4c8");
    const doorW = W >= 48 ? 10 : 8, doorH = extra.doorH ?? 16;
    const doorX = Math.round(W / 2 - doorW / 2), doorY = foundTop - doorH;
    if (extra.gable && W >= 48) {
      // a front gable over the door
      const half = Math.min(14, Math.round(W * 0.2)), base = eave, apex = base - Math.round(half * 0.85);
      p.g.save(); p.g.beginPath(); p.g.moveTo(W / 2 - half - 1, base + 1); p.g.lineTo(W / 2, apex); p.g.lineTo(W / 2 + half + 1, base + 1); p.g.closePath(); p.g.clip();
      wallTex(p, W / 2 - half - 1, apex, half * 2 + 2, base - apex + 2, wall, wk, o.seed + 3); p.g.restore();
      for (let i = 0; i <= base - apex + 1; i++) { const y = apex - 1 + i, hw = Math.round((i / (base - apex + 1)) * (half + 2)); p.px(W / 2 - hw - 1, y, hs(roof, 0.2)); p.px(W / 2 - hw - 2, y, outline(roof)); p.px(W / 2 + hw, y, hs(roof, -0.3)); p.px(W / 2 + hw + 1, y, outline(roof)); }
      p.rect(W / 2 - 3, apex + 5, 6, 5, trim); p.rect(W / 2 - 2, apex + 6, 4, 3, lit ? "#ffd878" : "#4a6a94");
    }
    const winY = foundTop - 15;
    const slotsL = W >= 80 ? [6, 18] : W >= 48 ? [5] : [];
    const slotsR = W >= 80 ? [W - 12, W - 24] : W >= 48 ? [W - 11] : [W - 10];
    for (const x of slotsL) if (x + 6 < doorX - 1) windowAt(p, x, winY, { lit, trim, box: !o.snow && wk !== "stone", shutters: extra.shutters });
    if (extra.emblem) { hangingSign(p, W - 13, wallTop + 3, extra.emblem); if (W >= 80) windowAt(p, slotsR[1], winY, { lit, trim, shutters: extra.shutters }); }
    else for (const x of slotsR) if (x > doorX + doorW + 1) windowAt(p, x, winY, { lit, trim, box: !o.snow && wk !== "stone", shutters: extra.shutters });
    for (let f = 1; f < floors; f++) {
      const y = winY - f * 12;
      if (y < eave + 3) break;
      for (const x of [...slotsL, ...slotsR.slice(0, 1), W >= 48 ? Math.round(W / 2 - 3) : -1]) if (x >= 0) windowAt(p, x, y, { lit: lit && cell(x, f, o.seed) > 0.3, trim, shutters: extra.shutters });
    }
    if (o.closed) { p.rect(doorX - 1, doorY - 1, doorW + 2, doorH + 1, "#3a2a1e"); p.rect(doorX, doorY, doorW, doorH, "#5a3a22"); for (let x = doorX + 1; x < doorX + doorW; x += 2) p.rect(x, doorY, 1, doorH, "#4a2e1a"); }
    else doorAt(p, doorX, doorY, { w: doorW, h: doorH, col: extra.door ?? look.door, double: doorW >= 10, arch: extra.gable });
    if (W >= 48) lantern(p, doorX + doorW + 2, doorY + 2);
    if (extra.props && W >= 48) { barrel(p, W - 7, H - 10); crate(p, 2, H - 9); }
    if (extra.dormer && W >= 64) for (const dx of [Math.round(W * 0.22), Math.round(W * 0.78) - 6]) {
      const dy = roofTop + Math.round((eave - roofTop) * 0.3);
      p.rect(dx, dy - 1, 6, 7, wall); p.rect(dx, dy - 1, 1, 7, outline(wall)); p.rect(dx + 5, dy - 1, 1, 7, outline(wall));
      windowAt(p, dx + 1, dy, { w: 4, h: 5, lit, trim });
      for (let i = 0; i < 4; i++) { p.rect(dx + 2 - i, dy - 5 + i, 2 * i + 2, 1, hs(roof, 0.1 - i * 0.08)); p.px(dx + 2 - i, dy - 5 + i, outline(roof)); p.px(dx + 3 + i, dy - 5 + i, outline(roof)); }
    }
    return { ridgeL, roofTop, eave, doorX, doorY, doorW };
  };
  switch (o.style) {
    case "house": case "cottage": case "manor": {
      const L = o.style === "manor" ? HOUSE_LOOKS[4] : look;
      std(L.wall, L.roof, L.wk, L.rk, { chimney: o.style !== "manor" || true, floors: o.style === "manor" ? 2 : o.th >= 3 && r.chance(0.5) ? 2 : 1, trim: L.trim, door: L.door, shutters: L.shutters, dormer: o.style === "manor", gable: o.style === "manor" });
      break;
    }
    case "inn":
      std("#b07a48", "#6a2a1a", "siding", "shingle", { chimney: true, emblem: "cup", props: true, dormer: true, floors: 2 });
      break;
    case "shop":
      std("#e0c8a0", "#3a6a8a", "timber", "tile", { emblem: r.pick(["coin", "bottle", "cloth", "bowl", "potion"]), shutters: "#3a6a8a", props: true });
      break;
    case "smith":
      std("#8a8a92", "#4a4a58", "stone", "slate", { chimney: true, emblem: "ingot", props: true, door: "#5a4a4a" });
      break;
    case "temple":
      std("#f4f0e4", "#2a6a8a", "stone", "tile", { gable: true, trim: "#f8f4e8", door: "#a07a3a", doorH: 18 });
      break;
    case "barn": {
      const s = std("#9a3a2a", "#5a4a3a", "plank", "shingle", { doorH: 18 });
      p.rect(s.doorX - 2, s.doorY - 2, s.doorW + 4, 20, "#f0e4c8");
      p.rect(s.doorX, s.doorY, s.doorW, 18, "#7a2a1e");
      p.line(s.doorX, s.doorY, s.doorX + s.doorW - 1, s.doorY + 17, "#f0e4c8"); p.line(s.doorX + s.doorW - 1, s.doorY, s.doorX, s.doorY + 17, "#f0e4c8");
      break;
    }
    case "hut": {
      std("#8a6a44", "#b8a060", "log", "thatch", { chimney: false });
      break;
    }
    case "keep": {
      // a hall under a slate roof between two round towers, a great door, banners on the walls
      const st = "#aaa496", foundTop = H - 4, cxm = W / 2;
      groundShadow(p, W, H);
      const tW = Math.max(18, Math.round(W * 0.21));
      const faceTop = H - Math.round(o.th * 16 * 0.66);
      roofSlab(p, tW - 6, W - tW + 5, Math.max(16, faceTop - 26), faceTop - 3, "#4a5a7a", "slate", o.seed);
      p.rect(Math.round(cxm) - 1, Math.max(16, faceTop - 26) - 12, 1, 10, "#4a3a2a"); p.rect(Math.round(cxm), Math.max(16, faceTop - 26) - 12, 8, 3, "#d83a3a"); p.rect(Math.round(cxm), Math.max(16, faceTop - 26) - 9, 6, 2, "#a82a2a");
      wallTex(p, tW - 2, faceTop, W - 2 * tW + 4, foundTop - faceTop, st, "stone", o.seed);
      p.g.fillStyle = "rgba(20,10,40,.18)"; p.g.fillRect(tW - 2, faceTop + 2, W - 2 * tW + 4, 3);
      battlements(p, tW - 2, faceTop - 1, W - 2 * tW + 4, st);
      // buttresses
      for (const bx of [Math.round(cxm - 17), Math.round(cxm + 14)]) { p.rect(bx, faceTop + 6, 3, foundTop - faceTop - 6, hs(st, 0.08)); p.rect(bx, faceTop + 6, 1, foundTop - faceTop - 6, hs(st, 0.3)); p.rect(bx + 2, faceTop + 6, 1, foundTop - faceTop - 6, hs(st, -0.32)); poly(p, [[bx, faceTop + 6], [bx + 3, faceTop + 3], [bx + 3, faceTop + 6]], hs(st, 0.2)); }
      // arched windows and hanging banners
      const winY = faceTop + 8;
      for (const wx of [Math.round(cxm - 26), Math.round(cxm + 22)]) if (wx > tW && wx < W - tW - 4) archWin(p, wx, winY, lit);
      for (const bx of [Math.round(cxm - 12), Math.round(cxm + 8)]) hangBanner(p, bx, faceTop + 4, o.seed % 2 ? "#a82a3a" : "#2a4a9a");
      // the towers
      for (const tx of [3, W - tW - 3]) towerArt(p, tx, Math.max(30, faceTop - 22), tW, foundTop, { stone: hs(st, -0.04), roof: "#3e4c6e", lit, seed: o.seed + tx, flag: tx < 10 ? "#d83a3a" : "#e8c040" });
      castleDoor(p, cxm, foundTop, 16, 24, st, !!o.closed);
      // a crest over the door
      poly(p, [[cxm - 4, foundTop - 33], [cxm + 4, foundTop - 33], [cxm + 4, foundTop - 28], [cxm, foundTop - 25], [cxm - 4, foundTop - 28]], "#2a4a9a"); p.rect(cxm - 1, foundTop - 33, 2, 7, "#e8c040");
      foundation(p, 0, foundTop, W, "#8a8a90");
      if (lit) { lantern(p, Math.round(cxm - 13), foundTop - 20); lantern(p, Math.round(cxm + 11), foundTop - 20); }
      break;
    }
    case "tower": {
      const st = "#a49e90", foundTop = H - 4, tw2 = Math.min(W - 10, 32), tx = Math.round(W / 2 - tw2 / 2);
      groundShadow(p, W, H);
      // a lean-to of stone at the foot
      wallTex(p, 2, foundTop - 14, W - 4, 14, hs(st, -0.06), "stone", o.seed + 3);
      p.rect(2, foundTop - 16, W - 4, 3, "#6a4a3a"); p.rect(2, foundTop - 16, W - 4, 1, "#8a6a4a");
      towerArt(p, tx, Math.max(40, H - o.th * 16 - 6), tw2, foundTop, { stone: st, roof: "#7a3a2a", lit, seed: o.seed, flag: "#c83a3a" });
      castleDoor(p, W / 2, foundTop, 10, 17, st, true);
      foundation(p, 0, foundTop, W, "#8a8a90");
      if (lit) lantern(p, Math.round(W / 2 + 7), foundTop - 14);
      break;
    }
    case "gatehouse": {
      const st = "#a8a294", foundTop = H - 4, tw2 = 14;
      groundShadow(p, W, H);
      wallTex(p, 8, 22, W - 16, foundTop - 22, st, "stone", o.seed);
      battlements(p, 8, 22, W - 16, st);
      for (const tx of [1, W - tw2 - 1]) towerArt(p, tx, 14, tw2, foundTop, { stone: hs(st, -0.04), lit, seed: o.seed + tx, slits: true });
      castleDoor(p, W / 2, foundTop, 14, 22, st, !!o.closed);
      foundation(p, 0, foundTop, W, "#8a8a90");
      if (lit) { lantern(p, Math.round(W / 2 - 11), foundTop - 18); lantern(p, Math.round(W / 2 + 9), foundTop - 18); }
      break;
    }
    case "stable": {
      // an open-fronted timber stable: stalls with horses looking out, hay in the loft
      const foundTop = H - 4, wall = "#8a5a32", roof = "#6a4a2a";
      groundShadow(p, W, H);
      const wallTop = foundTop - 24, roofTop = Math.max(2, H - o.th * 16 - 6);
      wallTex(p, 1, wallTop, W - 2, 24, wall, "plank", o.seed);
      roofSlab(p, 0, W - 1, roofTop, wallTop + 1, roof, "shingle", o.seed);
      p.g.fillStyle = "rgba(24,12,40,0.32)"; p.g.fillRect(1, wallTop + 3, W - 2, 2);
      const n = Math.max(2, Math.floor((W - 4) / 15));
      const sw = (W - 4) / n;
      for (let k = 0; k < n; k++) {
        const x = Math.round(2 + k * sw), w = Math.round(sw) - 3;
        p.rect(x + 1, wallTop + 6, w, foundTop - wallTop - 6, "#2a1a10");
        for (let yy = wallTop + 6; yy < foundTop; yy++) p.rect(x + 1, yy, w, 1, mix("#1a100a", "#3a2a1a", (yy - wallTop - 6) / 18));
        // the horse's head over the half door
        const coat = ["#8a5a32", "#4a3a2a", "#c8a878", "#2a2420"][(o.seed + k) % 4];
        if ((o.seed + k) % 3 !== 2) { const hx = x + Math.round(w / 2) - 2; p.rect(hx, wallTop + 9, 5, 7, coat); p.rect(hx + 1, wallTop + 14, 3, 3, hs(coat, 0.2)); p.px(hx, wallTop + 8, coat); p.px(hx + 4, wallTop + 8, coat); p.px(hx + 1, wallTop + 11, "#1a1010"); p.px(hx + 3, wallTop + 11, "#1a1010"); p.rect(hx + 2, wallTop + 7, 1, 4, hs(coat, -0.4)); }
        // half door
        p.rect(x + 1, foundTop - 9, w, 9, "#a8703c"); p.rect(x + 1, foundTop - 9, w, 1, "#d09a5a");
        p.line(x + 1, foundTop - 8, x + w, foundTop - 1, "#7a4a26"); p.rect(x + 1, foundTop - 5, w, 1, "#7a4a26");
        p.rect(x - 1, wallTop + 4, 2, foundTop - wallTop - 4, "#5a3a20");
      }
      p.rect(W - 3, wallTop + 4, 2, foundTop - wallTop - 4, "#5a3a20");
      // hay at the loft door and a lantern
      p.rect(Math.round(W / 2) - 5, roofTop + 4, 10, 7, "#3a2a1a"); p.rect(Math.round(W / 2) - 4, roofTop + 7, 8, 4, "#e8c860"); p.rect(Math.round(W / 2) - 4, roofTop + 7, 8, 1, "#f8e090");
      foundation(p, 0, foundTop, W, "#8a8a80");
      if (lit) lantern(p, 4, wallTop + 6);
      break;
    }
    case "tent": {
      const cloth = ["#c8b890", "#a8503a", "#5a7a4a", "#e0d8c0"][o.seed % 4];
      softShadow(p, W / 2, H - 3, W / 2 - 2, 3);
      const apex = H - o.th * 16 - 2, base = H - 3;
      for (let y = apex; y <= base; y++) {
        const t = (y - apex) / (base - apex), hw = Math.round(2 + t * (W / 2 - 4));
        for (let x = W / 2 - hw; x <= W / 2 + hw; x++) p.px(x, y, x < W / 2 ? hs(cloth, 0.12 - t * 0.05) : hs(cloth, -0.16));
        p.px(W / 2 - hw, y, outline(cloth)); p.px(W / 2 + hw, y, outline(cloth));
      }
      for (let y = apex + 6; y < base; y += 5) { const t = (y - apex) / (base - apex); p.rect(W / 2 - Math.round(2 + t * (W / 2 - 4)) + 1, y, Math.round(2 + t * (W / 2 - 4)) - 1, 1, hs(cloth, 0.02)); }
      // door flap
      const dh = 15;
      poly(p, [[W / 2 - 5, base], [W / 2, base - dh], [W / 2 + 5, base]], "#2a1e14");
      p.line(W / 2, base - dh, W / 2 - 7, base, hs(cloth, 0.25));
      p.rect(W / 2, apex - 5, 1, 6, "#5a3a22"); p.rect(W / 2 + 1, apex - 5, 4, 2, "#c83a3a");
      for (const [x0, x1] of [[2, W / 2 - 8], [W - 3, W / 2 + 8]]) p.line(x0, base, x1, base - 6, "#8a7a5a");
      break;
    }
    case "cave": {
      // a rocky outcrop with a dark mouth
      const rock = "#7a6e62";
      softShadow(p, W / 2, H - 3, W / 2 - 1, 3);
      for (const [bx, by, rx, ry, k] of [[W / 2, H - 16, W / 2 - 1, 15, 0], [W * 0.25, H - 10, W * 0.25, 10, 0.06], [W * 0.75, H - 12, W * 0.26, 12, -0.04], [W / 2, H - 26, W * 0.34, 12, 0.1]] as const) p.blob(bx, by, rx, ry, hs(rock, k), { hi: 0.22 });
      for (let i = 0; i < 9; i++) { const x = 4 + Math.floor(cell(i, 1, o.seed) * (W - 8)), y = H - 34 + Math.floor(cell(i, 2, o.seed) * 26); p.line(x, y, x + 3, y + 2, hs(rock, -0.32)); p.px(x, y - 1, hs(rock, 0.3)); }
      for (let i = 0; i < 6; i++) { const x = 3 + Math.floor(cell(i, 5, o.seed) * (W - 6)); p.rect(x, H - 34 + Math.floor(cell(i, 6, o.seed) * 6), 2, 1, "#5a8a3a"); }
      const mw = 14, mh = 18, mx = Math.round(W / 2 - mw / 2), my = H - 3 - mh;
      for (let y = 0; y < mh; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((mh - y) / mh) ** 2.2)) * (mw / 2)); p.rect(W / 2 - hw, my + y, hw * 2, 1, y < 3 ? "#0e0a0c" : mix("#0e0a0c", "#2a2020", y / mh)); }
      p.rect(mx - 1, H - 3, mw + 2, 1, hs(rock, -0.35));
      if (o.snow) snowRoof(H - 40, H - 22, 2, W - 3);
      break;
    }
    case "ruin": {
      const st = "#9a948a";
      softShadow(p, W / 2, H - 3, W / 2 - 1, 3);
      // two broken pillars and a cracked lintel over a doorway
      for (const px0 of [3, W - 11]) {
        const top = H - 34 - (px0 > 10 ? 6 : 0);
        p.column(px0, top, 8, H - 4 - top, st);
        for (let y = top + 4; y < H - 4; y += 5) p.rect(px0 + 1, y, 6, 1, hs(st, -0.2));
        p.rect(px0 - 1, top, 10, 2, hs(st, 0.2));
      }
      p.rect(3, H - 36, W - 14, 4, hs(st, 0.08)); p.rect(3, H - 36, W - 14, 1, hs(st, 0.3)); p.rect(3, H - 32, W - 14, 1, outline(st));
      p.line(W / 2 + 3, H - 36, W / 2 + 6, H - 32, outline(st));
      p.rect(11, H - 31, W - 22, 27, "#1a1416");
      for (let y = H - 31; y < H - 4; y++) p.rect(11, y, W - 22, 1, mix("#0e0a0c", "#2a2420", (y - (H - 31)) / 30));
      for (let i = 0; i < 8; i++) { const x = Math.floor(cell(i, 9, o.seed) * W); p.rect(x, H - 6 - Math.floor(cell(i, 8, o.seed) * 28), 1, 3, "#4a8a3a"); }
      break;
    }
  }
  return c;
});
export const buildingSprite = (b: BSpec) => buildingArt(JSON.stringify(b));

// ------------------------------------------------------------ props (native scale, bottom = ground)
const propArt = memo((key: string): HTMLCanvasElement => {
  const [kind, a1, a2] = key.split("|");
  const v = Number(a1) || 0;
  const mk = (w: number, h: number) => art(w, h);
  switch (kind) {
    case "well": {
      const [c, p] = mk(28, 34);
      softShadow(p, 14, 31, 12, 3);
      const st = "#9a9aa0";
      ell(p, 14, 26, 11, 5, hs(st, -0.25));
      for (let y = 21; y < 31; y++) p.rect(3, y, 22, 1, y < 23 ? hs(st, 0.2) : hs(st, -0.05 - (y - 23) * 0.02));
      for (let x = 3; x < 25; x += 4) for (let y = 23; y < 31; y += 3) p.rect(x + ((y / 3) % 2 ? 2 : 0), y, 1, 2, hs(st, -0.3));
      ell(p, 14, 21, 11, 4, hs(st, 0.15)); ell(p, 14, 21, 8, 2.6, "#1a2a3a"); ell(p, 15, 21.5, 4, 1.2, "#3a6a8a");
      for (const x of [4, 23]) { p.rect(x, 4, 2, 18, "#6a4428"); p.rect(x, 4, 1, 18, "#8a5a32"); }
      p.rect(9, 9, 10, 2, "#5a3a22"); p.line(14, 11, 14, 16, "#c8b890");
      p.rect(12, 16, 5, 4, "#8a5a32"); p.rect(12, 16, 5, 1, "#3a3640");
      for (let i = 0; i < 6; i++) { p.rect(1 + i, 6 - i, 26 - i * 2, 1, hs("#a8503a", 0.1 - i * 0.04)); }
      p.rect(1, 6, 26, 1, outline("#a8503a"));
      return c;
    }
    case "stone": {
      const [c, p] = mk(16, 34);
      softShadow(p, 8, 31, 7, 2);
      const st = "#8a8a84";
      poly(p, [[3, 31], [2, 12], [5, 3], [10, 1], [13, 6], [14, 31]], st);
      poly(p, [[3, 31], [2, 12], [5, 3], [7, 4], [6, 31]], hs(st, 0.18));
      poly(p, [[11, 31], [13, 6], [14, 31]], hs(st, -0.22));
      for (const [x, y] of [[7, 10], [8, 14], [6, 18], [9, 22]]) { p.px(x, y, "#7ad8ff"); p.px(x + 1, y, "#4aa0d8"); }
      for (let i = 0; i < 5; i++) p.rect(3 + i, 26 + (i % 3), 2, 1, "#4a7a3a");
      p.rect(2, 31, 13, 1, outline(st));
      return c;
    }
    case "boat": {
      const [c, p] = mk(36, 16);
      const w = "#8a5a32";
      ell(p, 18, 12, 17, 4, "rgba(10,30,60,.35)");
      poly(p, [[1, 6], [35, 6], [31, 13], [5, 13]], hs(w, -0.15));
      poly(p, [[1, 6], [35, 6], [33, 8], [3, 8]], hs(w, 0.2));
      p.rect(4, 8, 28, 3, "#5a3a22");
      for (const x of [10, 18, 26]) p.rect(x, 7, 2, 5, hs(w, 0.1));
      p.line(5, 9, 0, 14, "#c8a070"); p.line(30, 9, 35, 3, "#c8a070");
      p.rect(1, 5, 34, 1, outline(w));
      return c;
    }
    case "signpost": {
      // a post with one board pointing to a side (a1: e / w / n / s)
      const [c, p] = mk(20, 30);
      softShadow(p, 10, 28, 4, 1.5);
      const wd = "#8a5a32";
      p.rect(9, 6, 3, 23, wd); p.rect(9, 6, 1, 23, hs(wd, 0.25)); p.rect(11, 6, 1, 23, hs(wd, -0.3));
      const board = "#c89a5a";
      const dir = a1;
      if (dir === "e" || dir === "w" || dir === "n" || dir === "s") {
        const pts: [number, number][] = dir === "w" ? [[1, 9], [4, 6], [18, 6], [18, 12], [4, 12]] : dir === "e" ? [[2, 6], [16, 6], [19, 9], [16, 12], [2, 12]] : [[3, 7], [17, 7], [17, 13], [3, 13]];
        poly(p, pts, outline(board));
        poly(p, pts.map(([x, y]) => [x + (x < 10 ? 1 : -1), y + (y < 9 ? 1 : -1)] as [number, number]), board);
        p.rect(4, 8, 12, 1, hs(board, 0.25));
        if (dir === "n") { poly(p, [[10, 1], [14, 6], [6, 6]], board); p.px(10, 2, hs(board, 0.3)); }
        if (dir === "s") { poly(p, [[6, 14], [14, 14], [10, 19]], board); }
        for (let x = 6; x < 15; x += 2) p.px(x, 10, hs(board, -0.35));
      }
      return c;
    }
    case "log": {
      const [c, p] = mk(30, 12);
      softShadow(p, 15, 10, 13, 2);
      p.column(2, 3, 26, 7, "#7a4e2c");
      for (let x = 4; x < 26; x += 5) p.px(x, 5, "#5a3a22");
      ell(p, 3, 6.5, 2, 3.5, "#c8a070"); ell(p, 3, 6.5, 1, 2, "#a07a48");
      p.rect(14, 1, 1, 2, "#5aa83a"); p.px(15, 1, "#7ac050");
      return c;
    }
    case "bedroll": {
      const [c, p] = mk(14, 24);
      const cl = ["#8a3a3a", "#3a5a8a", "#5a6a3a"][v % 3];
      p.rect(1, 2, 12, 20, hs(cl, -0.1)); p.rect(1, 2, 12, 1, hs(cl, 0.25));
      for (let y = 5; y < 22; y += 4) p.rect(1, y, 12, 1, hs(cl, -0.3));
      p.rect(2, 2, 10, 5, "#e0d4b4"); p.rect(2, 2, 10, 1, "#f4ecd8");
      p.rect(0, 2, 1, 20, outline(cl)); p.rect(13, 2, 1, 20, outline(cl)); p.rect(1, 22, 12, 1, outline(cl));
      return c;
    }
    case "table": {
      // round or long table with things on it (v: variety)
      const [c, p] = mk(32, 22);
      softShadow(p, 16, 20, 14, 2.5);
      const wd = "#9a6236";
      p.rect(3, 13, 2, 7, hs(wd, -0.3)); p.rect(27, 13, 2, 7, hs(wd, -0.3));
      p.rect(1, 6, 30, 8, wd); p.rect(1, 6, 30, 1, hs(wd, 0.3)); p.rect(1, 12, 30, 2, hs(wd, -0.28));
      for (let x = 4; x < 30; x += 7) p.rect(x, 7, 1, 5, hs(wd, -0.12));
      p.rect(0, 6, 1, 8, outline(wd)); p.rect(31, 6, 1, 8, outline(wd));
      const things = [[5, "#d8d0c0"], [12, "#c8a040"], [19, "#a85a3a"], [25, "#e8dcc4"]] as const;
      things.forEach(([x, col], i) => {
        if (cell(i, v, 3) < 0.3) return;
        if (i % 2) { p.rect(x, 4, 3, 4, col); p.rect(x, 4, 3, 1, hs(col, 0.3)); p.px(x + 3, 5, col); }
        else { ell(p, x + 2, 8, 3, 1.4, "#e8e4dc"); p.px(x + 1, 7, "#c8783a"); p.px(x + 2, 7, "#a8603a"); }
      });
      return c;
    }
    case "stool": {
      const [c, p] = mk(10, 12);
      softShadow(p, 5, 10, 4, 1.4);
      p.rect(2, 6, 1, 4, "#5a3a22"); p.rect(7, 6, 1, 4, "#5a3a22");
      ell(p, 5, 5, 4, 2, "#9a6236"); ell(p, 5, 4.5, 3.5, 1.4, "#b07a48");
      return c;
    }
    case "bench": {
      const [c, p] = mk(30, 12);
      softShadow(p, 15, 10, 13, 1.6);
      p.rect(3, 6, 2, 4, "#5a3a22"); p.rect(25, 6, 2, 4, "#5a3a22");
      p.rect(1, 3, 28, 4, "#9a6236"); p.rect(1, 3, 28, 1, "#c08a58"); p.rect(1, 6, 28, 1, "#6a4428");
      return c;
    }
    case "counter": {
      // bar counter segment (v: 0 middle, 1 left end, 2 right end), 16 wide
      const [c, p] = mk(16, 28);
      const wd = "#7a4a2a";
      p.rect(0, 10, 16, 16, hs(wd, -0.12));
      for (let x = 1; x < 16; x += 4) p.rect(x, 12, 1, 13, hs(wd, -0.32));
      p.rect(0, 6, 16, 5, "#a8703c"); p.rect(0, 6, 16, 1, "#d09a5a"); p.rect(0, 10, 16, 1, "#4a2a14");
      p.rect(0, 25, 16, 1, "#2a1a10");
      if (v === 1) p.rect(0, 6, 1, 20, "#3a2214");
      if (v === 2) p.rect(15, 6, 1, 20, "#3a2214");
      if (cell(v, 1, Number(a2) || 0) > 0.5) { p.rect(5, 2, 3, 5, "#4a7a3a"); p.rect(6, 0, 1, 2, "#4a7a3a"); p.px(5, 3, "#8ac07a"); }
      else { p.rect(9, 3, 4, 4, "#c8a040"); p.rect(9, 3, 4, 1, "#f0e0a0"); p.px(13, 4, "#c8a040"); }
      return c;
    }
    case "shelf": {
      // wall shelf with bottles / books, 32 wide, hung on a wall face
      const [c, p] = mk(30, 22);
      const wd = "#6a4428";
      for (const y of [8, 19]) { p.rect(0, y, 30, 2, wd); p.rect(0, y, 30, 1, hs(wd, 0.3)); }
      for (let i = 0; i < 9; i++) {
        const x = 1 + i * 3 + (cell(i, v, 7) > 0.5 ? 1 : 0), col = ["#3a6a3a", "#8a3a3a", "#3a4a8a", "#c8a040", "#6a3a6a"][Math.floor(cell(i, v, 8) * 5)];
        if (v % 2) { const h = 4 + Math.floor(cell(i, 2, v) * 3); p.rect(x, 8 - h, 2, h, col); p.px(x, 8 - h, hs(col, 0.4)); }
        else { p.rect(x, 4, 2, 4, col); p.rect(x + 0.5, 2, 1, 2, col); p.px(x, 5, hs(col, 0.5)); }
        const h2 = 5 + Math.floor(cell(i, 3, v) * 4); p.rect(x, 19 - h2, 2, h2, ["#8a3a3a", "#3a5a8a", "#6a8a3a", "#8a6a3a"][i % 4]); p.px(x, 19 - h2 + 1, "#e8dcc4");
      }
      return c;
    }
    case "hearth": {
      // fireplace built into a wall face: 48 wide, 32 tall (2 wall rows)
      const [c, p] = mk(44, 32);
      const st = "#9a8a7a";
      wallTex(p, 2, 4, 40, 28, st, "stone", 5);
      p.rect(0, 2, 44, 4, hs(st, 0.15)); p.rect(0, 2, 44, 1, hs(st, 0.35)); p.rect(0, 5, 44, 1, outline(st));
      p.rect(11, 12, 22, 20, "#1a100c");
      for (let i = 0; i < 12; i++) p.rect(11 + i, 12 - Math.round(Math.sqrt(Math.max(0, 121 - (11 - i) ** 2)) * 0.25), 22 - i * 2, 1, "#1a100c");
      p.rect(13, 27, 18, 2, "#5a3a22"); p.line(14, 29, 30, 26, "#7a4e2c");
      p.rect(9, 30, 26, 2, hs(st, -0.25));
      return c;
    }
    case "pillar": {
      const [c, p] = mk(16, 44);
      const st = a1 || "#c8c0b0";
      softShadow(p, 8, 41, 7, 2);
      p.rect(2, 36, 12, 6, hs(st, -0.1)); p.rect(2, 36, 12, 1, hs(st, 0.3));
      p.column(4, 7, 8, 30, st);
      for (let x = 5; x < 12; x += 2) p.rect(x, 8, 1, 28, hs(st, -0.12));
      p.rect(2, 3, 12, 5, hs(st, 0.12)); p.rect(2, 3, 12, 1, hs(st, 0.35)); p.rect(2, 7, 12, 1, outline(st));
      return c;
    }
    case "throne": {
      const [c, p] = mk(24, 34);
      softShadow(p, 12, 32, 10, 2);
      const gold = "#d8a83a", red = "#8a1e2a";
      p.rect(4, 2, 16, 24, gold); p.rect(6, 4, 12, 20, red); p.rect(6, 4, 12, 1, hs(red, 0.3));
      p.px(12, 1, gold); p.rect(10, 0, 5, 2, gold);
      p.rect(2, 18, 20, 12, hs(gold, -0.1)); p.rect(4, 18, 16, 6, red); p.rect(2, 18, 20, 1, hs(gold, 0.35));
      p.rect(2, 29, 20, 3, hs(gold, -0.35));
      for (const x of [3, 20]) p.rect(x, 14, 2, 16, hs(gold, 0.1));
      return c;
    }
    case "altar": {
      const [c, p] = mk(32, 26);
      softShadow(p, 16, 24, 14, 2.5);
      const st = "#d8d0c0";
      p.rect(2, 10, 28, 14, hs(st, -0.15)); p.rect(2, 7, 28, 4, st); p.rect(2, 7, 28, 1, hs(st, 0.3));
      p.rect(10, 7, 12, 15, "#7a2a6a"); p.rect(10, 7, 12, 1, "#a84a8a"); p.rect(14, 13, 4, 4, "#f2c542");
      for (const x of [4, 8, 24, 27]) { p.rect(x, 2, 2, 5, "#f0e4c8"); p.px(x, 1, "#ffc83a"); }
      p.rect(2, 23, 28, 1, outline(st));
      return c;
    }
    case "statue": {
      const [c, p] = mk(20, 44);
      softShadow(p, 10, 41, 8, 2);
      const st = a1 || "#a8a49c";
      p.rect(2, 32, 16, 10, hs(st, -0.12)); p.rect(2, 32, 16, 1, hs(st, 0.3)); p.rect(2, 41, 16, 1, outline(st));
      p.column(6, 14, 8, 18, st);
      p.blob(10, 10, 4, 4, st);
      p.line(6, 16, 2, 6, st, 2); p.rect(1, 2, 2, 6, hs(st, 0.2));
      p.rect(6, 22, 8, 1, hs(st, -0.3));
      return c;
    }
    case "corpseBones": {
      const [c, p] = mk(22, 12);
      const b = "#e8dcc4";
      p.blob(5, 6, 3, 2.5, b); p.px(4, 6, "#2a1a1a"); p.px(6, 6, "#2a1a1a");
      p.line(8, 7, 18, 8, b); for (let x = 10; x < 18; x += 2) { p.px(x, 6, b); p.px(x, 9, b); }
      p.line(18, 8, 21, 5, b); p.line(18, 8, 21, 11, b);
      return c;
    }
    case "gatepost": {
      // a square gate tower seen from the front: battlements, arrow slit, stone blocks
      const [c, p] = mk(20, 60);
      const st = a1 || "#a8a294";
      softShadow(p, 10, 58, 9, 2);
      wallTex(p, 1, 12, 18, 46, st, "stone", 11);
      p.rect(0, 8, 20, 5, hs(st, 0.12)); p.rect(0, 8, 20, 1, hs(st, 0.35)); p.rect(0, 12, 20, 1, outline(st));
      for (let x = 0; x < 20; x += 5) { p.rect(x, 3, 3, 5, st); p.rect(x, 3, 3, 1, hs(st, 0.3)); }
      p.rect(9, 20, 2, 9, "#1e1a1e"); p.rect(9, 36, 2, 7, "#1e1a1e");
      p.rect(0, 12, 1, 46, outline(st)); p.rect(19, 12, 1, 46, outline(st));
      return c;
    }
    case "chest2": return propCanvas("chest");
    case "crates": return buildingCanvas("crates", 1);
    case "barrel": return buildingCanvas("barrel", 1);
    case "hay": return buildingCanvas("hay_bale", 1);
    case "cart": return buildingCanvas("cart", 1);
    case "fountain": return buildingCanvas("fountain", 1);
    case "stall": return buildingCanvas("market_stall", 1);
    case "lamp": return buildingCanvas("street_lamp", 1);
    case "notice": return buildingCanvas("notice_board", 1);
    case "rack": return buildingCanvas("weapon_rack", 1);
    case "dummy": return buildingCanvas("training_dummy", 1);
    case "scarecrow": return buildingCanvas("scarecrow", 1);
    case "pumpkins": return buildingCanvas("pumpkins", 1);
    case "flowers": return buildingCanvas("flowers", 1);
    case "pot": return buildingCanvas("flower_pot", 1);
    case "bench2": return buildingCanvas("stone_bench", 1);
    case "brazier": return buildingCanvas("brazier", 1);
    case "lantern2": return buildingCanvas("stone_lantern", 1);
    case "totem": return buildingCanvas("totem", 1);
    case "woodpile": {
      const [c, p] = mk(24, 16);
      softShadow(p, 12, 14, 11, 2);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const x = 3 + i * 5 + row * 2.5, y = 11 - row * 4;
        ell(p, x + 2, y, 2.6, 2.4, "#6a4428"); ell(p, x + 2, y, 1.8, 1.7, "#c8a070"); p.px(x + 2, y, "#8a6a40");
      }
      return c;
    }
    case "fence": {
      // a fence piece along x (a1: "h") or y ("v")
      const [c, p] = mk(16, 20);
      const wd = "#9a6a3a";
      if (a1 === "v") { p.rect(7, 2, 3, 17, wd); p.rect(7, 2, 1, 17, hs(wd, 0.25)); p.rect(9, 2, 1, 17, hs(wd, -0.3)); p.rect(6, 18, 5, 1, "rgba(24,12,40,.25)"); }
      else {
        for (const x of [1, 13]) { p.rect(x, 6, 2, 12, wd); p.rect(x, 6, 1, 12, hs(wd, 0.25)); p.px(x, 5, hs(wd, 0.2)); }
        for (const y of [8, 13]) { p.rect(0, y, 16, 2, wd); p.rect(0, y, 16, 1, hs(wd, 0.25)); }
        p.rect(0, 18, 16, 1, "rgba(24,12,40,.22)");
      }
      return c;
    }
    case "bush": {
      const [c, p] = mk(20, 16);
      softShadow(p, 10, 14, 9, 2);
      const g = a1 || "#3f8a3a";
      p.blob(10, 9, 9, 6, hs(g, -0.15));
      p.blob(7, 8, 5, 4, g, { hi: 0.32 }); p.blob(13, 8, 5, 4, g, { hi: 0.32 }); p.blob(10, 6, 5, 3.5, hs(g, 0.06), { hi: 0.35 });
      if (v % 3 === 0) for (const [x, y] of [[6, 7], [12, 5], [14, 9]]) { p.px(x, y, "#e84a6a"); p.px(x + 1, y, "#ff8aa0"); }
      return c;
    }
    case "rock": {
      const [c, p] = mk(18, 14);
      softShadow(p, 9, 12, 8, 2);
      const st = a1 || "#8a8a90";
      p.blob(9, 8, 8, 5, st, { hi: 0.25 });
      p.blob(5, 9, 4, 3, hs(st, -0.06));
      p.line(9, 6, 11, 9, hs(st, -0.35));
      if (v % 2) for (let i = 0; i < 4; i++) p.px(3 + i * 3, 4 + (i % 2), "#5a8a3a");
      return c;
    }
    case "stump": {
      const [c, p] = mk(16, 14);
      softShadow(p, 8, 12, 7, 2);
      p.column(3, 5, 10, 7, "#6a4428");
      ell(p, 8, 5, 5, 2.2, "#c8a070"); ell(p, 8, 5, 3, 1.3, "#a07a48"); p.px(8, 5, "#6a4428");
      p.px(2, 11, "#5a3a22"); p.px(13, 11, "#5a3a22");
      return c;
    }
    case "reeds": {
      const [c, p] = mk(14, 18);
      for (let k = 0; k < 6; k++) {
        const x = 1 + k * 2 + (k % 2), h = 9 + ((k * 5 + v) % 6);
        p.rect(x, 17 - h, 1, h, k % 2 ? "#5a8a32" : "#7aa83e");
        if (k % 2 === 0) p.rect(x, 17 - h - 3, 1, 3, "#8a5a2a");
      }
      return c;
    }
    case "mushrooms": {
      const [c, p] = mk(14, 10);
      for (const [x, y, s, col] of [[3, 8, 2, "#d84a3a"], [8, 9, 3, "#e8a04a"], [11, 7, 1.6, "#d84a3a"]] as const) {
        p.rect(x, y - 2, 1, 3, "#f0e4c8"); p.blob(x, y - 3, s, s * 0.7, col); p.px(x - 1, y - 4, "#ffffff");
      }
      return c;
    }
    case "glowshroom": {
      const [c, p] = mk(14, 12);
      for (const [x, y, s] of [[3, 10, 2], [8, 11, 2.6], [11, 9, 1.6]] as const) {
        p.rect(x, y - 3, 1, 4, "#c8e0d8"); p.blob(x, y - 4, s, s * 0.7, "#5ad8c8", { hi: 0.5, outline: false }); p.px(x, y - 5, "#e0fff8");
      }
      return c;
    }
    case "bones": {
      const [c, p] = mk(16, 10);
      const b = "#e0d4bc";
      p.blob(4, 5, 2.6, 2, b); p.px(3, 5, "#2a1a1a"); p.px(5, 5, "#2a1a1a");
      p.line(8, 7, 14, 4, b); p.px(7, 6, b); p.px(15, 5, b); p.line(8, 3, 12, 8, hs(b, -0.1));
      return c;
    }
    case "chains": {
      const [c, p] = mk(12, 22);
      for (const x of [3, 8]) for (let y = 0; y < 16 + (x % 5); y += 2) p.rect(x, y, 1 + (y % 4 ? 0 : 1), 1, "#5a5860");
      p.rect(2, 16, 4, 3, "#6a6870"); p.rect(7, 18, 4, 3, "#6a6870");
      return c;
    }
    case "bars": {
      // iron bars of a cell, in a wall face (16 x 32)
      const [c, p] = mk(16, 30);
      p.rect(1, 2, 14, 27, "#0e0c10");
      for (let x = 2; x < 15; x += 3) { p.rect(x, 2, 1, 27, "#6a6870"); p.px(x, 2, "#9a98a0"); }
      p.rect(1, 2, 14, 2, "#4a4850"); p.rect(1, 16, 14, 1, "#4a4850");
      return c;
    }
    case "torch": {
      // a sconce on a wall face (flame drawn live)
      const [c, p] = mk(8, 14);
      p.rect(3, 6, 2, 7, "#5a3a22"); p.rect(2, 5, 4, 2, "#3a3640"); p.rect(2, 12, 4, 1, "#3a3640");
      return c;
    }
    case "banner": {
      const [c, p] = mk(14, 30);
      const col = a1 || "#8a1e2a";
      p.rect(0, 0, 14, 2, "#4a3a2a"); p.px(0, 0, "#f2c230"); p.px(13, 0, "#f2c230");
      p.rect(1, 2, 12, 24, col); p.rect(1, 2, 2, 24, hs(col, 0.2)); p.rect(11, 2, 2, 24, hs(col, -0.25));
      poly(p, [[1, 26], [13, 26], [7, 30]], col);
      p.rect(4, 9, 6, 6, "#f2c542"); p.rect(5, 10, 4, 4, col); p.px(7, 12, "#f2c542");
      return c;
    }
    case "window": {
      // a window in a wall face (lit at night)
      const [c, p] = mk(14, 18);
      windowAt(p, 2, 3, { w: 10, h: 12, lit: a1 === "1", trim: a2 || "#d8ccb4" });
      return c;
    }
    case "bed": {
      const [c, p] = mk(18, 30);
      softShadow(p, 9, 28, 8, 2);
      p.rect(1, 2, 16, 26, "#7a4a2a"); p.rect(2, 4, 14, 22, "#e8dcc4");
      p.rect(2, 10, 14, 16, ["#8a3a3a", "#3a5a8a", "#5a7a3a"][v % 3]); p.rect(2, 10, 14, 1, "#f4ecd8");
      p.rect(4, 5, 10, 4, "#f8f4ec"); p.rect(1, 2, 16, 2, "#9a6236");
      return c;
    }
    case "rug": {
      const [c, p] = mk(48, 32);
      const col = a1 || "#8a2a2a";
      p.rect(0, 0, 48, 32, hs(col, -0.2)); p.rect(2, 2, 44, 28, col); p.rect(5, 5, 38, 22, hs(col, -0.12));
      for (let x = 7; x < 42; x += 6) for (let y = 8; y < 25; y += 6) { p.px(x, y, "#e8c870"); p.px(x + 1, y + 1, "#e8c870"); }
      p.rect(2, 2, 44, 1, "#e8c870"); p.rect(2, 29, 44, 1, "#e8c870");
      for (let x = 1; x < 47; x += 2) { p.px(x, 0, "#e8dcc4"); p.px(x, 31, "#e8dcc4"); }
      return c;
    }
    case "mast": {
      const [c, p] = mk(48, 96);
      const wd = "#7a4e2c";
      ell(p, 24, 93, 5, 2, "rgba(24,12,40,.3)");
      p.column(22, 4, 5, 90, wd);
      p.rect(4, 10, 40, 3, hs(wd, -0.1)); p.rect(8, 44, 32, 3, hs(wd, -0.1));
      // furled / set sail
      const sail = "#ece4d0";
      for (let y = 13; y < 42; y++) { const bulge = Math.round(Math.sin(((y - 13) / 29) * Math.PI) * 3); p.rect(6 - bulge, y, 36 + bulge * 2, 1, y % 6 === 0 ? hs(sail, -0.1) : hs(sail, (y - 13) / 29 * -0.12)); }
      p.rect(22, 13, 5, 29, hs(sail, -0.18));
      for (let y = 47; y < 70; y++) { const bulge = Math.round(Math.sin(((y - 47) / 23) * Math.PI) * 2); p.rect(10 - bulge, y, 28 + bulge * 2, 1, hs(sail, (y - 47) / 23 * -0.12)); }
      p.line(4, 12, 2, 90, "#5a4632"); p.line(44, 12, 46, 90, "#5a4632");
      p.rect(23, 0, 3, 4, "#c83a3a");
      return c;
    }
    case "wheel": {
      const [c, p] = mk(20, 24);
      softShadow(p, 10, 22, 6, 1.5);
      p.rect(8, 12, 4, 10, "#6a4428");
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(10, 9, 10 + Math.cos(a) * 9, 9 + Math.sin(a) * 9, "#8a5a32"); }
      p.g.strokeStyle = "#9a6a3a"; p.g.lineWidth = 2; p.g.beginPath(); p.g.arc(10, 9, 6, 0, Math.PI * 2); p.g.stroke();
      p.blob(10, 9, 2, 2, "#c8a040");
      return c;
    }
    case "cannon": {
      const [c, p] = mk(24, 16);
      softShadow(p, 12, 14, 10, 2);
      p.rect(4, 9, 14, 5, "#6a4428"); ell(p, 6, 13, 2.5, 2.5, "#4a3020"); ell(p, 16, 13, 2.5, 2.5, "#4a3020");
      p.column(2, 4, 20, 5, "#3a3a44"); p.rect(20, 3, 3, 7, "#2a2a34");
      return c;
    }
    case "rope": {
      const [c, p] = mk(14, 10);
      for (let r = 5; r > 0; r -= 1.5) { p.g.strokeStyle = r > 3 ? "#c8a870" : "#a8885a"; p.g.lineWidth = 1.4; p.g.beginPath(); p.g.ellipse(7, 6, r + 1, r * 0.6, 0, 0, Math.PI * 2); p.g.stroke(); }
      return c;
    }
    case "hatch": {
      const [c, p] = mk(28, 20);
      p.rect(1, 2, 26, 17, "#4a2e18"); p.rect(3, 4, 22, 13, "#8a5a32");
      for (let x = 5; x < 25; x += 4) p.rect(x, 4, 1, 13, "#6a4428");
      p.rect(3, 9, 22, 2, "#3a3640"); p.rect(12, 8, 4, 4, "#5a5660");
      return c;
    }
    case "stairsDown": {
      const [c, p] = mk(28, 26);
      p.rect(0, 0, 28, 26, "#3a3640");
      for (let i = 0; i < 6; i++) { const y = 2 + i * 4, inset = i * 1.5; p.rect(2 + inset, y, 24 - inset * 2, 3, hs("#8a8890", -i * 0.12)); p.rect(2 + inset, y, 24 - inset * 2, 1, hs("#a8a8b0", -i * 0.12)); }
      p.rect(9, 22, 10, 4, "#0e0c10");
      return c;
    }
    case "tomb": return tall("tombstone", ["#4a4a44", "#9a9488", "#d8d0c0", "#6a6258"], v);
    case "cross": {
      const [c, p] = mk(12, 20);
      p.rect(5, 3, 2, 16, "#7a5a3a"); p.rect(2, 6, 8, 2, "#7a5a3a"); p.rect(4, 18, 4, 1, "#5a8a3a");
      return c;
    }
    case "lever": {
      const [c, p] = mk(12, 16);
      p.rect(2, 10, 8, 5, "#5a5660"); p.line(6, 11, 9, 3, "#7a4e2c"); p.blob(9, 3, 1.6, 1.6, "#c83a3a");
      return c;
    }
    case "books": {
      const [c, p] = mk(14, 12);
      for (let k = 0; k < 4; k++) { const col = ["#8a3a3a", "#3a5a8a", "#6a8a3a", "#8a6a3a"][k]; p.rect(2 + (k % 2), 10 - k * 2.5, 10, 2, col); p.rect(2 + (k % 2), 10 - k * 2.5, 10, 1, hs(col, 0.3)); }
      return c;
    }
    case "bag": {
      const [c, p] = mk(12, 12);
      softShadow(p, 6, 10, 5, 1.5);
      p.blob(6, 7, 4.5, 3.8, "#a8885a", { hi: 0.3 }); p.rect(4, 2, 4, 2, "#8a6a40"); p.px(6, 1, "#5a3a22");
      return c;
    }
    case "herbs": {
      const [c, p] = mk(14, 14);
      for (let k = 0; k < 5; k++) { const x = 2 + k * 2.4; p.line(7, 13, x, 4 + (k % 2) * 2, "#4f9a35"); p.px(x, 3 + (k % 2) * 2, ["#f7d44c", "#ffffff", "#b88aff"][k % 3]); }
      return c;
    }
    case "pool": {
      const [c, p] = mk(30, 18);
      ell(p, 15, 10, 14, 7, "#6a6a70"); ell(p, 15, 9.5, 12, 5.6, "#2a64a8"); ell(p, 13, 8.5, 7, 3, "#5ab4e4"); p.rect(9, 7, 4, 1, "#d8f4ff");
      return c;
    }
    case "anvil": {
      const [c, p] = mk(18, 14);
      softShadow(p, 9, 12, 7, 1.6);
      p.rect(6, 7, 6, 5, "#3a3640"); p.rect(2, 3, 14, 4, "#5a5660"); p.rect(2, 3, 14, 1, "#8a8890"); poly(p, [[16, 3], [18, 4], [16, 6]], "#5a5660");
      return c;
    }
    case "candles": {
      const [c, p] = mk(12, 16);
      p.rect(5, 6, 2, 10, "#6a5a4a"); p.rect(2, 14, 8, 2, "#6a5a4a");
      for (const [x, h] of [[2, 4], [5, 6], [8, 4]] as const) { p.rect(x, 6 - h + 4 - 2, 2, h, "#f0e4c8"); }
      return c;
    }
  }
  return mk(4, 4)[0];
});
const prop = (kind: string, a1: string | number = "", a2: string | number = "") => propArt(`${kind}|${a1}|${a2}`);

// ------------------------------------------------------------ critters (world scale, like people)
type Critter = "chicken" | "cat" | "dog" | "rabbit" | "deer" | "duck" | "frog" | "pigeon" | "butterfly" | "rat" | "bat" | "lizard" | "gull" | "crow" | "fish";

/** One frame of a small animal, facing right (flip for left). `pose`: walk / idle / act (peck, sit, fly...). */
const critterArt = memo((k: string): HTMLCanvasElement => {
  const [kind, pose, fs, vs] = k.split("|") as [Critter, string, string, string];
  const f = Number(fs), v = Number(vs);
  const leg = (s: Px, x: number, y: number, h: number, col: string) => s.rect(x, y, 1, h, col);
  let s: Px;
  switch (kind) {
    case "chicken": {
      s = new Px(14, 14);
      const body = v % 3 === 1 ? "#c8783a" : v % 3 === 2 ? "#3a3030" : "#f4f0e8", sh = hs(body, -0.2);
      const peck = pose === "act" && f % 2 === 1;
      const lx = pose === "walk" ? (f % 2 ? 1 : -1) : 0;
      leg(s, 6 + lx, 10, 3, "#e8a030"); leg(s, 8 - lx, 10, 3, "#e8a030");
      s.ellipse(6, 8, 4, 3, body); s.rect(3, 9, 6, 1, sh); s.rect(1, 5, 2, 3, body); s.px(1, 4, body);
      const hx = peck ? 10 : 9, hy = peck ? 8 : 4;
      s.rect(hx, hy, 3, 3, body); s.px(hx + 1, hy - 1, "#e83a2a"); s.px(hx + 2, hy - 1, "#e83a2a"); s.px(hx + 3, hy + 1, "#f0b030"); s.px(hx + 2, hy + 2, "#e83a2a");
      s.px(hx + 2, hy, "#1a1010");
      if (!peck) s.rect(8, 5, 2, 3, body);
      s.px(5, 7, sh); s.px(6, 8, hs(body, 0.15));
      break;
    }
    case "cat": {
      s = new Px(18, 14);
      const fur = ["#e08a3a", "#3a3438", "#d8d0c8", "#8a7a6a"][v % 4], dk = hs(fur, -0.25);
      if (pose === "act") {
        // sitting, tail curled, blinking
        s.ellipse(8, 9, 4, 4, fur); s.rect(5, 11, 7, 2, fur); s.rect(9, 3, 5, 5, fur); s.px(9, 2, fur); s.px(13, 2, fur);
        s.px(11, 5, f % 6 === 0 ? dk : "#2a2a1a"); s.px(13, 5, f % 6 === 0 ? dk : "#2a2a1a"); s.px(12, 6, "#e89aa0");
        s.rect(2, 11, 4, 1, fur); s.px(2, 10, fur); s.px(1, 10, dk);
        s.px(7, 8, dk); s.px(8, 10, dk);
      } else {
        const st = pose === "walk" ? f % 2 : 0;
        for (const [x, o] of [[4, st], [6, -st], [11, -st], [13, st]] as const) leg(s, x + o, 10, 3, dk);
        s.rect(4, 7, 10, 4, fur); s.rect(4, 7, 10, 1, hs(fur, 0.15)); s.px(6, 9, dk); s.px(9, 8, dk);
        s.rect(13, 4, 4, 4, fur); s.px(13, 3, fur); s.px(16, 3, fur); s.px(15, 5, "#2a2a1a"); s.px(17, 6, "#e89aa0");
        s.rect(2, 4 + (f % 2), 1, 4, fur); s.px(3, 7, fur); s.px(2, 3 + (f % 2), dk);
      }
      break;
    }
    case "dog": {
      s = new Px(20, 16);
      const fur = ["#a8743a", "#5a4a3a", "#e8dcc8"][v % 3], dk = hs(fur, -0.25);
      const st = pose === "walk" ? f % 2 : 0;
      for (const [x, o] of [[5, st], [7, -st], [13, -st], [15, st]] as const) leg(s, x + o, 11, 4, dk);
      s.rect(4, 7, 13, 5, fur); s.rect(4, 7, 13, 1, hs(fur, 0.15));
      s.rect(15, 3, 5, 5, fur); s.rect(18, 6, 2, 2, fur); s.px(19, 6, "#1a1010"); s.px(17, 4, "#1a1010"); s.rect(15, 3, 2, 4, dk);
      s.rect(2, 5 - (pose === "act" ? f % 2 : 0), 2, 1, fur); s.px(3, 6, fur); s.px(4, 6, fur);
      if (pose === "act") s.px(19, 9, "#e86a7a");
      break;
    }
    case "rabbit": {
      s = new Px(12, 12);
      const fur = v % 2 ? "#e8e0d8" : "#9a8a72", dk = hs(fur, -0.22);
      const hop = pose === "walk" ? [0, -2, -3, -1][f % 4] : 0;
      s.ellipse(5, 8 + hop, 3, 2, fur); s.rect(2, 9 + hop, 2, 2, fur); s.rect(7, 5 + hop, 3, 3, fur);
      s.rect(7, 1 + hop, 1, 4, fur); s.rect(9, 1 + hop, 1, 4, dk); s.px(9, 6 + hop, "#1a1010"); s.px(1, 7 + hop, "#ffffff");
      if (hop === 0) { s.rect(4, 10, 3, 1, dk); }
      break;
    }
    case "deer": {
      s = new Px(30, 30);
      const fur = "#a8703a", dk = hs(fur, -0.25), lt = hs(fur, 0.25);
      const st = pose === "walk" ? [1, 0, -1, 0][f % 4] : 0;
      for (const [x, o] of [[8, st], [10, -st], [19, -st], [21, st]] as const) { leg(s, x + o, 18, 9, dk); s.px(x + o, 27, "#2a1a14"); }
      s.ellipse(15, 15, 8, 4, fur); s.rect(8, 12, 14, 2, lt); s.px(7, 13, "#f4ecd8"); s.px(6, 12, "#f4ecd8");
      const graze = pose === "act";
      const hx = graze ? 23 : 22, hy = graze ? 17 : 6;
      s.rect(21, graze ? 13 : 8, 3, graze ? 5 : 7, fur);
      s.rect(hx, hy, 5, 4, fur); s.rect(hx + 4, hy + 2, 2, 2, fur); s.px(hx + 5, hy + 2, "#1a1010"); s.px(hx + 2, hy + 1, "#1a1010");
      s.px(hx, hy - 1, fur); s.px(hx + 1, hy - 1, dk);
      if (v % 2 === 0) { s.line(hx + 1, hy - 1, hx - 1, hy - 6, "#d8c8a8"); s.line(hx + 2, hy - 1, hx + 4, hy - 6, "#d8c8a8"); s.px(hx - 2, hy - 4, "#d8c8a8"); s.px(hx + 5, hy - 4, "#d8c8a8"); }
      for (const [x, y] of [[11, 14], [14, 13], [17, 14]]) s.px(x, y, "#f4ecd8");
      break;
    }
    case "duck": {
      s = new Px(14, 10);
      const body = "#8a6a4a";
      const bob = f % 2;
      s.ellipse(6, 6 + bob, 5, 2, body); s.rect(2, 4 + bob, 3, 2, body); s.rect(5, 5 + bob, 4, 1, "#e8dcc4");
      s.rect(9, 1 + bob, 3, 4, v % 2 ? "#2a7a3a" : "#8a6a4a"); s.px(12, 3 + bob, "#f0b030"); s.px(13, 3 + bob, "#f0b030"); s.px(10, 2 + bob, "#1a1010");
      s.px(10, 5 + bob, "#f4f0e8");
      break;
    }
    case "frog": {
      s = new Px(10, 8);
      const g = "#5aa83a";
      const jump = pose === "walk" ? [0, -2, -3, -1][f % 4] : 0;
      s.ellipse(5, 5 + jump, 3, 2, g); s.px(3, 2 + jump, g); s.px(7, 2 + jump, g); s.px(3, 2 + jump, "#1a1010"); s.px(7, 2 + jump, "#1a1010");
      s.rect(1, 6 + jump, 2, 1, hs(g, -0.2)); s.rect(7, 6 + jump, 2, 1, hs(g, -0.2)); s.px(5, 4 + jump, hs(g, 0.3));
      break;
    }
    case "pigeon": case "crow": case "gull": {
      s = new Px(14, 12);
      const body = kind === "crow" ? "#2a2830" : kind === "gull" ? "#f4f4f0" : "#8a8a98";
      const wing = kind === "gull" ? "#a8b0b8" : hs(body, -0.15);
      if (pose === "fly") {
        const up = f % 2 === 0;
        s.ellipse(7, 7, 4, 2, body);
        if (up) { s.line(6, 6, 2, 1, wing); s.line(8, 6, 12, 1, wing); s.line(5, 6, 1, 2, wing); }
        else { s.line(6, 7, 1, 10, wing); s.line(8, 7, 13, 10, wing); }
        s.px(11, 6, body); s.px(12, 6, kind === "gull" ? "#f0b030" : "#3a3a3a");
      } else {
        const peck = pose === "act" && f % 2 === 1;
        leg(s, 6, 9, 2, "#c86a5a"); leg(s, 8, 9, 2, "#c86a5a");
        s.ellipse(6, 7, 4, 2.5, body); s.rect(2, 6, 5, 2, wing); s.px(1, 7, wing);
        const hx = peck ? 10 : 9, hy = peck ? 7 : 3;
        s.rect(hx, hy, 3, 3, body); s.px(hx + 3, hy + 1, kind === "gull" ? "#f0b030" : "#3a3a3a"); s.px(hx + 1, hy + 1, "#1a1010");
        if (!peck) s.rect(8, 5, 2, 2, kind === "pigeon" ? "#6a9a8a" : body);
      }
      break;
    }
    case "butterfly": {
      s = new Px(8, 7);
      const col = ["#f7d44c", "#ffffff", "#f090b8", "#8ab8ff"][v % 4];
      if (f % 2 === 0) { s.rect(0, 1, 3, 3, col); s.rect(5, 1, 3, 3, col); s.rect(1, 4, 2, 2, hs(col, -0.15)); s.rect(5, 4, 2, 2, hs(col, -0.15)); }
      else { s.rect(2, 0, 2, 4, col); s.rect(4, 0, 2, 4, hs(col, -0.1)); }
      s.rect(4, 2, 1, 4, "#2a2020");
      return s.c;
    }
    case "rat": {
      s = new Px(14, 8);
      const fur = "#6a5e58", st = pose === "walk" ? f % 2 : 0;
      s.ellipse(6, 4, 4, 2, fur); s.rect(9, 3, 3, 2, fur); s.px(12, 4, "#e8a0a0"); s.px(10, 3, "#1a1010"); s.px(9, 2, "#c8a0a0");
      s.line(2, 4, 0, 6 - st, "#c89a9a"); s.px(4 + st, 6, hs(fur, -0.3)); s.px(8 - st, 6, hs(fur, -0.3));
      break;
    }
    case "bat": {
      s = new Px(14, 8);
      const b = "#3a2e3a", up = f % 2 === 0;
      s.ellipse(7, 4, 2, 2, b); s.px(6, 2, b); s.px(8, 2, b); s.px(6, 3, "#e84a4a"); s.px(8, 3, "#e84a4a");
      if (up) { s.poly([[5, 4], [0, 0], [1, 3], [3, 3]], b); s.poly([[9, 4], [14, 0], [13, 3], [11, 3]], b); }
      else { s.poly([[5, 4], [0, 7], [2, 5]], b); s.poly([[9, 4], [14, 7], [12, 5]], b); }
      break;
    }
    case "lizard": {
      s = new Px(14, 6);
      const g = "#8aa04a", st = f % 2;
      s.rect(3, 2, 7, 2, g); s.rect(10, 2, 3, 2, g); s.px(12, 2, "#1a1010"); s.line(3, 3, 0, 4, g);
      s.px(4, 1 + st, g); s.px(4, 4 - st, g); s.px(9, 1 + (1 - st), g); s.px(9, 4 - (1 - st), g);
      break;
    }
    case "fish": {
      s = new Px(8, 5);
      s.rect(1, 1, 5, 3, "#c8d8e8"); s.px(6, 2, "#c8d8e8"); s.px(0, 0, "#a8b8c8"); s.px(0, 4, "#a8b8c8"); s.px(5, 1, "#1a1a2a");
      return s.c;
    }
    default: s = new Px(4, 4);
  }
  s.outline((n) => `rgb(${Math.round(n[0] * 0.25)},${Math.round(n[1] * 0.2)},${Math.round(n[2] * 0.25) + 10})`);
  return s.c;
});
/** A person frame cut off at the hips, for someone sitting (the chair or table hides the rest). */
const seatCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function seated(c: HTMLCanvasElement) {
  let o = seatCache.get(c);
  if (o) return o;
  o = document.createElement("canvas");
  o.width = c.width; o.height = 37;
  o.getContext("2d")!.drawImage(c, 0, 0);
  seatCache.set(c, o);
  return o;
}
const flipCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function flipped(c: HTMLCanvasElement) {
  let f = flipCache.get(c);
  if (!f) {
    f = document.createElement("canvas");
    f.width = c.width; f.height = c.height;
    const g = f.getContext("2d")!;
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
    flipCache.set(c, f);
  }
  return f;
}
const critter = (kind: Critter, pose: string, f: number, v: number, left: boolean) => {
  const c = critterArt(`${kind}|${pose}|${f}|${v}`);
  return left ? flipped(c) : c;
};

// ============================================================ the area model
/** Ground of a tile. */
const G = {
  VOID: 0, GRASS: 1, FLOWER: 2, DIRT: 3, COBBLE: 4, FLAG: 5, PLANK: 6, CARPET: 7, WATER: 8, DEEP: 9, BRIDGE: 10,
  SAND: 11, WALL: 12, CAVE: 13, MARBLE: 14, MUD: 15, SOIL: 16, ROCK: 17, DECK: 18, RAIL: 19, GATE: 20, PATHSAND: 21,
  PARQ: 22, CHECK: 23,
} as const;
const UNWALK = new Set<number>([G.VOID, G.WATER, G.DEEP, G.WALL, G.ROCK, G.RAIL]);
const WATERY = new Set<number>([G.WATER, G.DEEP, G.BRIDGE]);

type Kind = "wild" | "settle" | "interior" | "under" | "ship";

interface Obj {
  /** World position of the ground contact (bottom centre), sort key = y. */
  x: number;
  y: number;
  img?: HTMLCanvasElement;
  /** Scale of `img` (2 for terrain art, 1 for world-scale sprites). */
  s: number;
  /** Live drawing (flames, flags...), after `img`. */
  live?: (g: CanvasRenderingContext2D, x: number, y: number, t: number) => void;
  /** Drawn under everything that stands (rugs, wall decorations). */
  flat?: boolean;
  /** Trees, rocks... removable to open a path. */
  soft?: boolean;
  tiles: number[];
  /** Fade when the hero walks behind it. */
  fade?: boolean;
  dy?: number;
  flip?: boolean;
  /** Overhead (chandeliers, hanging lanterns): drawn after everyone. */
  over?: boolean;
}

interface Light { x: number; y: number; r: number; col: string; flick?: number; on: "always" | "dark"; glow?: number }
interface Emitter { x: number; y: number; kind: "smoke" | "fire" | "embers" | "incense" | "drip" | "steam" | "spray" | "sparkle"; on?: "always" | "dark"; acc: number }

type SpotKind = "exit" | "door" | "npc" | "object";
interface PSpot {
  key: number;
  label: string;
  via: Via;
  locked?: string;
  kind: SpotKind;
  /** Tile the hero walks to. */
  stand: Pt;
  /** Tiles where the prompt shows. */
  zone: Set<number>;
  /** World point the label floats over. */
  ax: number;
  ay: number;
  /** World rectangle that taps on (sprite of the thing). */
  hit: { x0: number; y0: number; x1: number; y1: number };
  face: Pt;
  side?: Side;
  npc?: Actor;
  el?: HTMLDivElement;
}

type AI = "hero" | "still" | "npc" | "wander" | "patrol" | "flee" | "swim" | "fly" | "perch";
interface Actor {
  id: string;
  type: "person" | "monster" | "critter";
  look?: Look;
  critter?: Critter;
  variant: number;
  x: number;
  y: number;
  path: Pt[];
  speed: number;
  facing: Facing;
  moving: boolean;
  phase: number;
  ai: AI;
  home: Pt;
  range: number;
  wait: number;
  /** Height above the ground (flying birds, hopping). */
  z: number;
  alpha: number;
  pose?: string;
  route?: Pt[];
  routeI?: number;
  bark?: string[];
  barkAt?: number;
  timid?: number;
  step?: number;
  gone?: number;
  sit?: boolean;
  /** How far a sitter's cropped body sits below the feet line. */
  sitDy?: number;
}

interface Area {
  w: number;
  h: number;
  gnd: Uint8Array;
  block: Uint8Array;
  objs: Obj[];
  lights: Light[];
  emit: Emitter[];
  spots: PSpot[];
  actors: Actor[];
  start: Pt;
  startWalk?: Pt;
  kind: Kind;
  bg: Scene["bg"];
  biome: Biome;
  wallStyle: WallStyle;
  floor: string;
  /** Extra ground variant data: crop kinds, bridge orientation... */
  extra: Map<number, string>;
  water: number[];
  indoor: boolean;
  dark: boolean;
  murky: boolean;
  snow: boolean;
  hub: Pt;
}

type WallStyle = "stone" | "rock" | "wood" | "marble" | "brick" | "city" | "hedge" | "palace";
/** What kind of room an interior is (inns, shops and houses share the "inn" background). */
type IVar = "tavern" | "shop" | "house" | "throne" | "guild" | "temple";
interface Seat { x: number; y: number; facing: Facing; dy: number }

// ============================================================ generation
const BIOME_FOR: Partial<Record<Scene["bg"], string>> = {
  forest: "forest", road: "meadow", field: "meadow", hill: "hill", mountain: "mountain", sky: "mountain", river: "forest", lake: "forest",
  bridge: "forest", camp: "forest", village: "meadow", town: "meadow", city: "meadow", castle: "meadow", ruins: "ruinsGrass", swamp: "swamp",
  desert: "desert", coast: "beach", sea: "beach", ship: "beach", inn: "forest", hall: "forest", temple: "forest", cave: "cave", tunnel: "cave", dungeon: "dungeon",
};
const EXTRA_BIOMES: Record<string, Biome> = {
  meadow: { ...BIOMES.forest, id: "x-meadow", ground: ["#5a9a42", "#64a64a", "#4e8a3a"], obs: ["#245a2a", "#33793a", "#56a84e", "#5a3a1e"], decorColors: ["#f7d44c", "#ffffff", "#f78fb3", "#b3a4ff"] },
  hill: { ...BIOMES.forest, id: "x-hill", ground: ["#6a9a48", "#76a652", "#5c8a3e"], pattern: "grass", decor: "pebbles", decorColors: ["#a8a8a0", "#8a8a84"], obs: ["#2a5a32", "#3a7a3e", "#62a454", "#5a3a1e"] },
  mountain: { ...BIOMES.forest, id: "x-mountain", ground: ["#7a8a66", "#86967a", "#6a7a58"], pattern: "rock", decor: "pebbles", decorColors: ["#b0b0a8", "#8a8a84"], wall: ["#5a5a5e", "#6a6a70"], obs: ["#1f4a3a", "#2a6a4a", "#d8e8e0", "#4a3a2a"] },
  ruinsGrass: { ...BIOMES.forest, id: "x-ruins", ground: ["#5a7a44", "#66864e", "#4e6c3a"], decor: "pebbles", decorColors: ["#9a9a92", "#7a8a6a"], obs: ["#2a4a2a", "#3a5e36", "#5a8a4a", "#4a3a2a"] },
  beach: { ...BIOMES.reef, id: "x-beach", ground: ["#e6d2a2", "#eedcae", "#dcc694"], decor: "shells", obs: ["#1a4a1a", "#2a7a2a", "#6ac04a", "#6a4a2a"] },
  cave: { ...BIOMES.ruins, id: "x-cave", ground: ["#5a4c42", "#62544a", "#52463c"], pattern: "gravel", decor: "pebbles", decorColors: ["#7a6a5a", "#4a3e36"], wall: ["#2a2220", "#3a302a"] },
  dungeon: { ...BIOMES.ruins, id: "x-dungeon", ground: ["#4a4a52", "#52525a", "#44444c"], pattern: "rock", decor: "pebbles", decorColors: ["#6a6a72", "#3a3a40"], wall: ["#1e1c22", "#2a2830"] },
  snow: { ...BIOMES.tundra, id: "x-snow" },
};
const biomeOf = (bg: Scene["bg"], weather: Scene["weather"]): Biome => {
  const id = BIOME_FOR[bg] ?? "forest";
  if (weather === "snow" && !["cave", "tunnel", "dungeon", "inn", "hall", "temple", "desert", "ship", "sea"].includes(bg)) return BIOMES.tundra;
  return EXTRA_BIOMES[id] ?? BIOMES[id] ?? BIOMES.forest;
};

/** The building / feature style a door's label asks for. */
function doorStyle(label: string, kind: Kind, bg: Scene["bg"]): BStyle {
  if (hasWord(label, ["hang", "động", "hang động", "cave", "hầm", "hầm mộ", "cavern", "mỏ"])) return "cave";
  if (hasWord(label, ["tháp", "tower", "pháo đài", "đồn", "fort", "tháp canh"])) return "tower";
  if (hasWord(label, ["đền", "chùa", "miếu", "thánh đường", "temple", "shrine", "điện thờ", "tu viện", "monastery"])) return "temple";
  if (hasWord(label, ["quán", "quán trọ", "nhà trọ", "lữ quán", "inn", "tavern", "quán rượu"])) return "inn";
  if (hasWord(label, ["cửa hàng", "cửa hiệu", "tiệm", "shop", "chợ", "market", "hiệu"])) return "shop";
  if (hasWord(label, ["lò rèn", "thợ rèn", "smith", "forge", "xưởng"])) return "smith";
  if (hasWord(label, ["lều", "tent", "trại"])) return "tent";
  if (hasWord(label, ["lâu đài", "castle", "dinh", "cung", "cung điện", "palace", "thành"])) return "keep";
  if (hasWord(label, ["cổng", "gate"])) return "gatehouse";
  if (hasWord(label, ["chòi", "túp lều", "hut", "lán"])) return "hut";
  if (hasWord(label, ["chuồng", "kho", "stable", "barn", "nhà kho"])) return "barn";
  if (hasWord(label, ["phế tích", "ruin", "đổ nát", "tàn tích", "di tích"])) return "ruin";
  if (hasWord(label, ["dinh thự", "manor", "biệt thự"])) return "manor";
  if (kind === "wild") return bg === "camp" ? "tent" : bg === "ruins" ? "ruin" : bg === "hill" || bg === "mountain" ? "cave" : "hut";
  return "house";
}

type ObjectKind = "well" | "chest" | "corpse" | "stone" | "boat" | "fire" | "altar" | "statue" | "grave" | "tree" | "sign" | "book" | "table" | "cart" | "horse" | "bones" | "lever" | "rack" | "herbs" | "pool" | "bag" | "fountain" | "anvil" | "barrel" | "crates" | "marker";
function objectKind(label: string): ObjectKind {
  const L = label;
  if (hasWord(L, ["giếng", "well"])) return "well";
  if (hasWord(L, ["rương", "hòm", "chest", "hộp", "box", "két"])) return "chest";
  if (hasWord(L, ["xác", "thi thể", "tử thi", "corpse", "body", "người chết", "xác chết"])) return "corpse";
  if (hasWord(L, ["hài cốt", "xương", "bộ xương", "bones", "skeleton"])) return "bones";
  if (hasWord(L, ["thuyền", "ghe", "xuồng", "bè", "boat", "raft", "đò"])) return "boat";
  if (hasWord(L, ["lửa", "đống lửa", "lửa trại", "fire", "campfire", "bếp lửa"])) return "fire";
  if (hasWord(L, ["bàn thờ", "tế đàn", "altar", "đàn tế"])) return "altar";
  if (hasWord(L, ["tượng", "bức tượng", "statue", "pho tượng"])) return "statue";
  if (hasWord(L, ["mộ", "mồ", "nấm mồ", "ngôi mộ", "grave", "tomb", "bia mộ"])) return "grave";
  if (hasWord(L, ["tảng đá", "cột đá", "phiến đá", "đá", "bia", "menhir", "stone", "monolith", "tấm bia", "cột mốc"])) return "stone";
  if (hasWord(L, ["giá vũ khí", "vũ khí", "kiếm", "weapon", "rack", "giáo", "cung"])) return "rack";
  if (hasWord(L, ["sách", "book", "cuộn", "thư", "bản đồ", "scroll", "letter", "map"])) return "book";
  if (hasWord(L, ["bàn", "table"])) return "table";
  if (hasWord(L, ["xe", "xe ngựa", "xe bò", "cart", "wagon"])) return "cart";
  if (hasWord(L, ["ngựa", "horse"])) return "horse";
  if (hasWord(L, ["cần gạt", "lever", "tay quay"])) return "lever";
  if (hasWord(L, ["thảo dược", "cỏ", "hoa", "herb", "herbs", "thảo mộc", "nấm"])) return "herbs";
  if (hasWord(L, ["đài phun", "fountain"])) return "fountain";
  if (hasWord(L, ["suối", "hồ", "ao", "vũng", "spring", "pool", "nước"])) return "pool";
  if (hasWord(L, ["túi", "gói", "bao", "bag", "pack", "tay nải", "ba lô"])) return "bag";
  if (hasWord(L, ["đe", "anvil"])) return "anvil";
  if (hasWord(L, ["thùng", "barrel"])) return "barrel";
  if (hasWord(L, ["hàng hóa", "kiện hàng", "crate", "crates"])) return "crates";
  if (hasWord(L, ["biển", "bảng", "sign", "bảng tin", "biển báo"])) return "sign";
  if (hasWord(L, ["cây", "tree", "gốc cây", "cây cổ thụ"])) return "tree";
  return "marker";
}

class Gen {
  w: number;
  h: number;
  gnd: Uint8Array;
  block: Uint8Array;
  /** Tiles kept clear of decoration (paths, spots, fronts of doors). */
  keep: Uint8Array;
  objs: Obj[] = [];
  lights: Light[] = [];
  emit: Emitter[] = [];
  extra = new Map<number, string>();
  r: Rng;
  hub: Pt;
  ends: Partial<Record<Side, Pt>> = {};
  /** Places prepared for doors, NPCs and objects (in order of prominence). */
  doorSlots: { x: number; y: number; tw: number; th: number; style?: BStyle; wall?: "n" | "s" | "e" | "w"; used?: boolean; fixed?: Obj }[] = [];
  npcSlots: Pt[] = [];
  objSlots: Pt[] = [];
  closed: Side[] = [];
  /** Interiors: the room's kind, the sides with ways out, the host's place and chairs to sit on. */
  ivar: IVar = "tavern";
  exits = new Set<Side>();
  host: { at: Pt; stand: Pt; face: Facing; sitDy?: number; re: RegExp; used?: boolean } | null = null;
  seats: Seat[] = [];
  hasStairs = false;
  rooms: { x: number; y: number; w: number; h: number }[] = [];
  constructor(w: number, h: number, public seed: number, public scene: Scene, public kind: Kind, public biome: Biome, public lit: boolean) {
    this.w = w; this.h = h;
    this.gnd = new Uint8Array(w * h).fill(G.GRASS);
    this.block = new Uint8Array(w * h);
    this.keep = new Uint8Array(w * h);
    this.r = new Rng(seed);
    this.hub = { x: w >> 1, y: h >> 1 };
  }
  i(x: number, y: number) { return y * this.w + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x: number, y: number) { return this.inb(x, y) ? this.gnd[this.i(x, y)] : G.VOID; }
  set(x: number, y: number, g: number) { if (this.inb(x, y)) this.gnd[this.i(x, y)] = g; }
  walk(x: number, y: number) { return this.inb(x, y) && !UNWALK.has(this.gnd[this.i(x, y)]) && !this.block[this.i(x, y)]; }
  open(x: number, y: number) { return this.inb(x, y) && !UNWALK.has(this.gnd[this.i(x, y)]); }
  rect(x0: number, y0: number, w: number, h: number, g: number) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, g); }
  /** Area free for a footprint: open ground, nothing on it, not kept. */
  free(x0: number, y0: number, w: number, h: number, ok: (g: number) => boolean = (g) => !UNWALK.has(g) && g !== G.BRIDGE) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!this.inb(x, y)) return false;
      const i = this.i(x, y);
      if (this.block[i] || this.keep[i] || !ok(this.gnd[i])) return false;
    }
    return true;
  }
  markKeep(x0: number, y0: number, w = 1, h = 1) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.inb(x, y)) this.keep[this.i(x, y)] = 1; }

  /** Adds an object standing on a footprint of tiles (blocked unless `walkable`). */
  put(o: Omit<Obj, "tiles"> & { tiles?: number[] }, fx: number, fy: number, fw = 1, fh = 1, walkable = false): Obj {
    const tiles: number[] = [];
    for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if (this.inb(x, y)) { tiles.push(this.i(x, y)); if (!walkable) this.block[this.i(x, y)] = 1; }
    const obj: Obj = { ...o, tiles };
    this.objs.push(obj);
    return obj;
  }
  /** A sprite (2x terrain art) standing at the bottom centre of a footprint. */
  sprite(img: HTMLCanvasElement, fx: number, fy: number, fw = 1, fh = 1, o: Partial<Obj> & { walkable?: boolean } = {}) {
    return this.put({ x: (fx + fw / 2) * TW, y: (fy + fh) * TW - (o.dy ?? 2), img, s: 2, ...o }, fx, fy, fw, fh, o.walkable);
  }
  tree(x: number, y: number, motif: string, v: number, cols?: [string, string, string, string]) {
    const img = tall(motif, cols ?? this.biome, v);
    return this.put({ x: x * TW + TW / 2 + (cell(x, y, 5) - 0.5) * 8, y: (y + 1) * TW - 4, img, s: 2, soft: true, fade: true }, x, y);
  }

  /** A road between two tiles: a gentle curve, 4-connected, `width` tiles wide. */
  road(a: Pt, b: Pt, g: number, width = 1, bend = 0.25, over: (cur: number) => number = (cur) => (WATERY.has(cur) ? G.BRIDGE : g)) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const off = (this.r.next() - 0.5) * len * bend;
    const mx = (a.x + b.x) / 2 - (dy / len) * off, my = (a.y + b.y) / 2 + (dx / len) * off;
    const n = Math.max(2, Math.ceil(len * 2));
    let last: Pt | null = null;
    const pts: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = Math.round((1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x);
      const y = Math.round((1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y);
      if (last && last.x === x && last.y === y) continue;
      if (last && last.x !== x && last.y !== y) pts.push({ x, y: last.y });
      pts.push({ x, y });
      last = { x, y };
    }
    for (const p of pts) for (let ox = 0; ox < width; ox++) for (let oy = 0; oy < width; oy++) {
      const x = p.x + ox - (width > 2 ? 1 : 0), y = p.y + oy - (width > 2 ? 1 : 0);
      if (!this.inb(x, y)) continue;
      const cur = this.get(x, y);
      if (cur === G.WALL && this.kind !== "under" && over(cur) === g) continue;
      this.set(x, y, over(cur));
      this.keep[this.i(x, y)] = 1;
    }
    return pts;
  }

  /** Clears blockers / bridges water so every point is reachable from `from`. */
  connect(from: Pt, targets: Pt[], g: number) {
    const W = this.w, H = this.h;
    const reach = this.flood(from);
    for (const t of targets) {
      if (reach[this.i(t.x, t.y)]) continue;
      // cheapest way through: open ground 1, soft objects 3, water 6, walls 9 (underground only)
      const dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
      const start = this.i(t.x, t.y);
      dist[start] = 0;
      const heap: [number, number][] = [[0, start]];
      let goal = -1;
      while (heap.length) {
        heap.sort((p, q) => q[0] - p[0]);
        const [d, k] = heap.pop()!;
        if (d > dist[k]) continue;
        if (reach[k]) { goal = k; break; }
        const x = k % W, y = (k / W) | 0;
        for (const [ddx, ddy] of DIR4) {
          const nx = x + ddx, ny = y + ddy;
          if (!this.inb(nx, ny)) continue;
          const nk = this.i(nx, ny), gg = this.gnd[nk];
          let c = 1;
          if (this.block[nk]) c = this.objs.some((o) => o.soft && o.tiles.includes(nk)) ? 3 : Infinity;
          if (gg === G.WATER || gg === G.DEEP) c = Math.max(c, 6);
          if (gg === G.WALL || gg === G.ROCK || gg === G.VOID) c = this.kind === "under" || gg === G.ROCK ? Math.max(c, 9) : Infinity;
          if (gg === G.RAIL) c = Infinity;
          if (!isFinite(c)) continue;
          if (d + c < dist[nk]) { dist[nk] = d + c; prev[nk] = k; heap.push([d + c, nk]); }
        }
      }
      for (let k = goal; k >= 0 && k !== start; k = prev[k]) this.clearTile(k, g);
      this.clearTile(start, g);
      const again = this.flood(from);
      for (let k = 0; k < reach.length; k++) reach[k] = again[k];
    }
  }
  clearTile(k: number, g: number) {
    const gg = this.gnd[k];
    if (gg === G.WATER || gg === G.DEEP) this.gnd[k] = G.BRIDGE;
    else if (gg === G.WALL || gg === G.ROCK || gg === G.VOID) this.gnd[k] = g;
    if (this.block[k]) {
      this.objs = this.objs.filter((o) => {
        if (!o.soft || !o.tiles.includes(k)) return true;
        for (const t of o.tiles) this.block[t] = 0;
        return false;
      });
    }
    this.keep[k] = 1;
  }
  flood(from: Pt) {
    const seen = new Uint8Array(this.w * this.h);
    const q = [this.i(from.x, from.y)];
    seen[q[0]] = 1;
    while (q.length) {
      const k = q.pop()!;
      const x = k % this.w, y = (k / this.w) | 0;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (!this.walk(nx, ny)) continue;
        const nk = this.i(nx, ny);
        if (!seen[nk]) { seen[nk] = 1; q.push(nk); }
      }
    }
    return seen;
  }
  /** Nearest open, unblocked tile to a point (ring search). */
  nearFree(p: Pt, ok: (x: number, y: number) => boolean = (x, y) => this.walk(x, y), maxR = 8): Pt | null {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = p.x + dx, y = p.y + dy;
      if (this.inb(x, y) && ok(x, y)) return { x, y };
    }
    return null;
  }
  /** Ends of the four roads at the map's edges, and where they meet the edge. */
  edgePoint(s: Side, jitter = 4): Pt {
    const r = this.r;
    if (s === "north") return { x: clamp(this.hub.x + r.int(-jitter, jitter), 3, this.w - 4), y: 0 };
    if (s === "south") return { x: clamp(this.hub.x + r.int(-jitter, jitter), 3, this.w - 4), y: this.h - 1 };
    if (s === "west") return { x: 0, y: clamp(this.hub.y + r.int(-jitter, jitter), 3, this.h - 4) };
    return { x: this.w - 1, y: clamp(this.hub.y + r.int(-jitter, jitter), 3, this.h - 4) };
  }
}

// ------------------------------------------------------------ recipes
const SIDES: Side[] = ["north", "east", "south", "west"];
const PINE: [string, string, string, string] = ["#1a3a32", "#2a5a46", "#4a8a5a", "#4a3a2a"];
const SNOWPINE: [string, string, string, string] = ["#1a3a3a", "#2a5a4a", "#e8f4f8", "#4a3a2a"];
/** Broadleaf palettes (dark oak, bright beech, yellow-green), so a wood is not one tree repeated. */
const OAK: [string, string, string, string][] = [["#1c4424", "#2c6230", "#4e9440", "#4a321e"], ["#2a5a22", "#4a8a30", "#86c050", "#5a4028"], ["#3a5a1e", "#5e8a2a", "#a8c84a", "#5a4632"]];
const FIR: [string, string, string, string] = ["#123028", "#1e4a3a", "#3a7a52", "#3a2a1e"];

/** Finds free footprints near a point (for buildings), best first. */
function findLots(g: Gen, around: Pt, sizes: [number, number][], n: number, ok: (x: number, y: number, w: number, h: number) => boolean, margin = 1) {
  const lots: { x: number; y: number; tw: number; th: number }[] = [];
  const cands: { x: number; y: number; tw: number; th: number; d: number }[] = [];
  for (const [tw, th] of sizes) for (let y = 1; y + th < g.h - 1; y++) for (let x = 1; x + tw < g.w; x++) {
    const d = Math.hypot(x + tw / 2 - around.x, y + th - around.y) + cell(x, y, g.seed + tw) * 1.5;
    cands.push({ x, y, tw, th, d });
  }
  cands.sort((a, b) => a.d - b.d);
  const taken = new Uint8Array(g.w * g.h);
  for (const c of cands) {
    if (lots.length >= n) break;
    let clash = false;
    for (let y = c.y - margin; y < c.y + c.th + margin + 1 && !clash; y++) for (let x = c.x - margin; x < c.x + c.tw + margin && !clash; x++) if (g.inb(x, y) && taken[g.i(x, y)]) clash = true;
    if (clash || !ok(c.x, c.y, c.tw, c.th)) continue;
    lots.push(c);
    for (let y = c.y; y < c.y + c.th + 1; y++) for (let x = c.x; x < c.x + c.tw; x++) if (g.inb(x, y)) taken[g.i(x, y)] = 1;
  }
  return lots;
}

/** Wild places: forest clearings, roads, fields, hills, rivers, lakes, coasts, swamps, deserts, camps, ruins. */
function wildBase(g: Gen) {
  const { r, scene } = g, bg = scene.bg;
  g.hub = { x: (g.w >> 1) + r.int(-3, 3), y: (g.h >> 1) + r.int(-2, 1) };
  const hub = g.hub;
  const path = bg === "desert" ? G.PATHSAND : bg === "ruins" ? G.FLAG : bg === "coast" || bg === "sea" ? G.PATHSAND : G.DIRT;
  // ---- water and land features
  if (bg === "river" || bg === "bridge") {
    const yc = hub.y + (bg === "bridge" ? 4 : 5), hw = bg === "bridge" ? 3 : 2.3, ph = r.next() * 6;
    for (let x = 0; x < g.w; x++) {
      const c = yc + Math.sin(x / 7 + ph) * 1.4 + (noise(x / 5, 0, g.seed) - 0.5) * 0.8;
      for (let y = 0; y < g.h; y++) { const d = Math.abs(y - c); if (d < hw) g.set(x, y, d < hw - 1.3 ? G.DEEP : G.WATER); }
    }
  } else if (bg === "lake") {
    const cx = hub.x + (r.chance(0.5) ? 8 : -8), cy = hub.y - 4;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d = ((x - cx) / 7.5) ** 2 + ((y - cy) / 5.5) ** 2 + (noise(x / 3, y / 3, g.seed) - 0.5) * 0.7;
      if (d < 1) g.set(x, y, d < 0.45 ? G.DEEP : G.WATER);
    }
  } else if (bg === "coast" || bg === "sea") {
    for (let y = 0; y < g.h; y++) {
      const sx = g.w - 9 + Math.round((noise(0, y / 4, g.seed) - 0.5) * 4);
      for (let x = sx - 3; x < g.w; x++) g.set(x, y, x >= sx + 2 ? G.DEEP : x >= sx ? G.WATER : G.SAND);
    }
  } else if (bg === "swamp") {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (Math.hypot(x - hub.x, y - hub.y) < 4.5) continue;
      const n = fbm(x / 7, y / 7, g.seed);
      if (n > 0.6) g.set(x, y, G.WATER); else if (n > 0.53) g.set(x, y, G.MUD);
    }
  } else if (bg === "desert") {
    if (r.chance(0.5)) {
      const cx = hub.x - 7, cy = hub.y + 4;
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) if (((x - cx) / 3.6) ** 2 + ((y - cy) / 2.4) ** 2 + (noise(x, y, g.seed) - 0.5) * 0.5 < 1) g.set(x, y, G.WATER);
    }
  } else if (bg === "hill" || bg === "mountain" || bg === "sky") {
    const lim = bg === "hill" ? 0.68 : 0.62;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.hypot(x - hub.x, y - hub.y) > 6 && fbm(x / 6, y / 6, g.seed + 3) > lim) g.set(x, y, G.ROCK);
  }
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y) !== G.ROCK) continue;
    const n = DIR4.filter(([dx, dy]) => g.get(x + dx, y + dy) === G.ROCK).length;
    if (n < 2 || (g.get(x, y + 1) !== G.ROCK && g.get(x, y - 1) !== G.ROCK)) g.set(x, y, G.GRASS);
  }
  // ---- roads to the four edges (an edge without an exit is closed later)
  const width = bg === "road" ? 2 : 1;
  for (const s of SIDES) {
    const end = g.edgePoint(s, 5);
    g.ends[s] = end;
    g.road(hub, end, path, width, 0.35, (cur) => (WATERY.has(cur) ? G.BRIDGE : cur === G.ROCK ? path : cur === G.MUD ? path : path));
  }
  // ---- the clearing
  const R = bg === "camp" ? 5.6 : bg === "ruins" ? 4.2 : 3.4;
  for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, y * 1.25);
    const tx = hub.x + x, ty = hub.y + y;
    if (!g.inb(tx, ty) || d > R + noise(tx / 2, ty / 2, g.seed) * 1.2) continue;
    if (g.get(tx, ty) === G.ROCK || g.get(tx, ty) === G.MUD) g.set(tx, ty, G.GRASS);
    g.keep[g.i(tx, ty)] = 1;
    if (bg === "ruins" && d < R - 0.6 && cell(tx, ty, g.seed) > 0.18) g.set(tx, ty, G.FLAG);
    if (bg === "camp" && d < 2.2) g.set(tx, ty, G.DIRT);
  }
  // ---- slots for doors, people and things
  const style = (s: BStyle | undefined) => s;
  const lots = findLots(g, { x: hub.x, y: hub.y - 3 }, [[3, 2]], 3, (x, y, w, h) => {
    if (y + h >= hub.y + 1) return false;
    if (!g.free(x, y, w, h, (gg) => gg === G.GRASS || gg === G.FLOWER || gg === G.SAND || gg === G.MUD || gg === G.ROCK)) return false;
    const fx = x + (w >> 1);
    return g.open(fx, y + h);
  });
  for (const l of lots) g.doorSlots.push({ x: l.x - 1, y: l.y - 1, tw: 5, th: 3, style: style(undefined) });
  for (const l of lots) g.markKeep(l.x - 1, l.y - 1, 5, 4);
  const ring: Pt[] = [];
  for (let d = 2; d <= 4; d++) for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2 + d;
    const p = { x: Math.round(hub.x + Math.cos(ang) * d * 1.15), y: Math.round(hub.y + Math.sin(ang) * d * 0.85) };
    if (g.inb(p.x, p.y) && g.open(p.x, p.y) && g.get(p.x, p.y) !== G.BRIDGE && !ring.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 3)) ring.push(p);
  }
  g.npcSlots = ring.filter((_, i) => i % 2 === 0).concat(ring.filter((_, i) => i % 2 === 1));
  g.objSlots = [...ring].reverse();
  // ---- the camp itself
  if (bg === "camp") {
    const fire = g.put({ x: hub.x * TW + TW / 2, y: hub.y * TW + TW - 6, img: prop("log", 0), s: 0, live: campfire }, hub.x, hub.y);
    fire.img = undefined;
    g.lights.push({ x: hub.x * TW + TW / 2, y: hub.y * TW + 14, r: 150, col: "#ffb060", flick: 1, on: "always", glow: 0.5 });
    g.emit.push({ x: hub.x * TW + TW / 2, y: hub.y * TW + 8, kind: "fire", acc: 0 });
    g.emit.push({ x: hub.x * TW + TW / 2, y: hub.y * TW, kind: "smoke", acc: 0 });
    for (const [dx, dy] of [[-2, 0], [2, 0]] as const) if (g.free(hub.x + dx, hub.y + dy, 1, 1)) g.sprite(prop("log", dx), hub.x + dx - 0.5 + (dx < 0 ? 0 : 0), hub.y + dy, 1, 1, { s: 2 });
  }
}

/** Villages, towns, cities and castle courtyards. */
function settleBase(g: Gen) {
  const { r, scene } = g, bg = scene.bg;
  const walled = bg === "city" || bg === "castle";
  g.hub = { x: (g.w >> 1) + r.int(-2, 2), y: (g.h >> 1) + r.int(-1, 1) };
  const hub = g.hub;
  const road = bg === "village" ? G.DIRT : bg === "castle" ? G.FLAG : G.COBBLE;
  // ---- walls with gates at the road ends
  if (walled) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (y <= 2 || y >= g.h - 1 || x <= 0 || x >= g.w - 1) g.set(x, y, G.WALL);
    // the castle green: a paved apron before the keep, the rest grass crossed by paved ways
    if (bg === "castle") g.rect(hub.x - 6, 7, 13, 2, G.FLAG);
  }
  // ---- plaza
  const [pw, ph] = bg === "village" ? [7, 5] : bg === "town" ? [9, 6] : bg === "city" ? [11, 7] : [9, 6];
  const px0 = hub.x - (pw >> 1), py0 = hub.y - (ph >> 1);
  for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) {
    if (bg === "village" && (x === px0 || x === px0 + pw - 1) && (y === py0 || y === py0 + ph - 1)) continue;
    g.set(x, y, road);
    g.keep[g.i(x, y)] = 1;
  }
  // ---- roads to the edges
  const width = bg === "village" ? 2 : bg === "city" ? 3 : 2;
  for (const s of SIDES) {
    const end = g.edgePoint(s, bg === "village" ? 4 : 2);
    if (walled) { if (s === "north") end.y = 0; }
    g.ends[s] = end;
    const pts = g.road(hub, end, road, width, bg === "village" ? 0.3 : 0.05, (cur) => (cur === G.WALL ? G.GATE : WATERY.has(cur) ? G.BRIDGE : road));
    void pts;
  }
  if (walled) {
    // gate passages through the wall: the road tiles in the wall become a gate
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === G.GATE) g.keep[g.i(x, y)] = 1;
  }
  // ---- building lots: doors face south onto a road or the plaza
  const nLots = bg === "village" ? 8 : bg === "town" ? 11 : bg === "city" ? 14 : 7;
  const sizes: [number, number][] = bg === "castle" ? [[5, 2], [3, 3], [5, 3]] : bg === "village" ? [[3, 2], [3, 3], [5, 2]] : [[3, 3], [5, 3], [3, 2], [5, 2]];
  const isRoad = (gg: number) => gg === road || gg === G.COBBLE || gg === G.DIRT || (gg === G.FLAG && bg !== "castle");
  const nearRoad = (fx: number, fy: number): Pt | null => {
    let best: Pt | null = null, bd = 7;
    for (let dy = -5; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = fx + dx, y = fy + dy; if (!g.inb(x, y) || !isRoad(g.get(x, y))) continue; const d = Math.abs(dx) + Math.abs(dy) + (dy < 0 ? 2 : 0); if (d < bd) { bd = d; best = { x, y }; } }
    return best;
  };
  const lots = findLots(g, hub, sizes, nLots, (x, y, w, h) => {
    if (!g.free(x, y, w, h, (gg) => gg === G.GRASS || gg === G.FLOWER || gg === G.FLAG)) return false;
    if (walled && (y < 4 || x < 2 || x + w > g.w - 2)) return false;
    // something to walk on in front of the door, a road not too far
    const fx = x + (w >> 1), fy = y + h;
    if (!g.open(fx, fy)) return false;
    return nearRoad(fx, fy) !== null;
  }, 1);
  if (bg === "castle") {
    // the keep stands at the north of the courtyard
    g.doorSlots.push({ x: hub.x - 3, y: 3, tw: 7, th: 4, style: "keep" });
    g.markKeep(hub.x - 4, 3, 9, 5);
  }
  for (const l of lots) {
    if (bg === "castle" && l.y < 8 && Math.abs(l.x + l.tw / 2 - hub.x) < 6) continue;
    g.doorSlots.push({ x: l.x, y: l.y, tw: l.tw, th: l.th });
    g.markKeep(l.x, l.y, l.tw, l.th);
    // a short path from the door to the road
    const fx = l.x + (l.tw >> 1);
    const to = nearRoad(fx, l.y + l.th);
    if (to && bg !== "castle") {
      const pathG = bg === "village" ? G.DIRT : G.COBBLE;
      let x = fx, y = l.y + l.th;
      const lay = () => { const gg = g.get(x, y); if (!UNWALK.has(gg) && !isRoad(gg) && gg !== G.GATE) g.set(x, y, pathG); g.keep[g.i(x, y)] = 1; };
      lay();
      if (to.y > y) { while (y < to.y) { y++; lay(); } while (x !== to.x) { x += Math.sign(to.x - x); lay(); } }
      else {
        const sideX = to.x < fx ? l.x - 1 : l.x + l.tw;
        while (x !== sideX) { x += Math.sign(sideX - x); lay(); }
        while (y !== to.y) { y += Math.sign(to.y - y); lay(); }
        while (x !== to.x) { x += Math.sign(to.x - x); lay(); }
      }
    }
  }
  // ---- slots for people and things: around the plaza
  const ring: Pt[] = [];
  for (let y = py0 - 1; y <= py0 + ph; y++) for (let x = px0 - 1; x <= px0 + pw; x++) {
    if (!g.inb(x, y) || !g.open(x, y)) continue;
    const edge = x === px0 || x === px0 + pw - 1 || y === py0 || y === py0 + ph - 1;
    if (!edge) continue;
    if (ring.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) < 3)) continue;
    ring.push({ x, y });
  }
  ring.sort((a, b) => cell(a.x, a.y, g.seed) - cell(b.x, b.y, g.seed));
  g.objSlots = [{ x: hub.x, y: hub.y }, ...ring];
  g.npcSlots = ring.filter((p) => Math.abs(p.x - hub.x) + Math.abs(p.y - hub.y) > 1);
}

/** Inns, shops, houses, halls and temples: one furnished room. */
function interiorBase(g: Gen) {
  const v = g.ivar;
  g.gnd.fill(G.WALL);
  const floor = ({ tavern: G.PLANK, shop: G.PLANK, house: G.PARQ, throne: G.FLAG, guild: G.PARQ, temple: G.MARBLE } as const)[v];
  g.rect(1, 3, g.w - 2, g.h - 4, floor);
  const cx = g.w >> 1, cy = 3 + ((g.h - 4) >> 1);
  g.hub = { x: cx, y: cy };
  g.ends = { north: { x: cx, y: 2 }, south: { x: cx, y: g.h - 1 }, west: { x: 0, y: cy + 1 }, east: { x: g.w - 1, y: cy + 1 } };
  // doors in the back wall (placed clear of the room's fittings), then the side walls
  const xs = ({ tavern: [4, 13], shop: [4], house: [11], throne: [3, 24, 6, 21], guild: [3, 20], temple: [3, 20] } as const)[v];
  for (const x of xs) if (x > 1 && x < g.w - 2) g.doorSlots.push({ x, y: 2, tw: 1, th: 1, wall: "n" });
  g.doorSlots.push({ x: 0, y: cy - 2, tw: 1, th: 1, wall: "w" }, { x: g.w - 1, y: cy - 2, tw: 1, th: 1, wall: "e" });
  for (const p of [g.ends.south!, g.ends.north!]) g.markKeep(p.x - 1, p.y - 1, 3, 3);
  for (const d of g.doorSlots) g.markKeep(d.wall === "w" ? 1 : d.wall === "e" ? g.w - 2 : d.x, d.wall === "n" ? 3 : d.y);
  g.markKeep(1, cy, g.w - 2, 2);
  // the aisle up the middle (halls and temples keep the dais at its head)
  const head = v === "throne" || v === "temple" ? 5 : 3;
  g.markKeep(cx - 1, head, 3, g.h - 1 - head);
  if (g.exits.has("north")) g.markKeep(cx - 1, 3, 3, 2);
  const north = g.exits.has("north");
  // fixed fittings that people stand behind (before the spots are given out)
  const fix = (img: HTMLCanvasElement, x: number, y: number, fw = 1, fh = 1, o: Partial<Obj> & { walkable?: boolean } = {}) => g.sprite(img, x, y, fw, fh, o);
  const counterRow = (kind: string, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) fix(fur(kind, x === x0 ? 1 : x === x1 ? 2 : 0, g.seed + x * 7), x, y, 1, 1, { dy: 2 }); };
  if (v === "tavern") {
    counterRow("bar", 15, g.w - 2, 5);
    g.host = { at: { x: 17, y: 4 }, stand: { x: 17, y: 6 }, face: "down", re: /keep|host|owner|bar|tender|chủ|chu|quán|landlord|innkeeper|tavern|maid/i };
  } else if (v === "shop") {
    counterRow("shopcounter", 10, g.w - 2, 5);
    g.host = { at: { x: 12, y: 4 }, stand: { x: 12, y: 6 }, face: "down", re: /keep|owner|merchant|trader|seller|smith|chủ|chu|thương|buôn|bán|thợ|shop|vendor|alchemist/i };
  } else if (v === "guild") {
    for (const x of [15, 17]) fix(fur("desk"), x, 5, 2, 1, { dy: 3 });
    g.host = { at: { x: 17, y: 4 }, stand: { x: 17, y: 6 }, face: "down", re: /master|clerk|keeper|captain|chief|leader|chủ|trưởng|thủ lĩnh|guild|hội/i };
  } else if (v === "throne") {
    const tx = north ? cx - 4 : cx;
    fix(fur("dais", 9), cx - 4, 3, 9, 2, { flat: true, walkable: true, dy: -6 });
    fix(fur("throne"), tx, 3, 1, 1, { dy: 9 });
    g.block[g.i(tx, 3)] = 0;
    g.host = { at: { x: tx, y: 3 }, stand: { x: tx, y: 5 }, face: "down", sitDy: -27, re: /king|queen|lord|lady|duke|prince|princess|emperor|baron|regent|vua|hoàng|chúa|quân|công|lãnh|vương|tước|quan|ruler/i };
  } else if (v === "temple") {
    const ax = north ? cx - 5 : cx;
    fix(fur("dais", 9, "#e8e2d4"), cx - 4, 3, 9, 2, { flat: true, walkable: true, dy: -6 });
    const alt = fix(fur("altar"), ax - 1, 4, 3, 1, { dy: 4, live: flamesLive("altar") });
    g.lights.push({ x: alt.x, y: alt.y - 50, r: 120, col: "#ffe0a0", flick: 0.4, on: "always", glow: 0.45 });
    g.emit.push({ x: alt.x + 16, y: alt.y - 56, kind: "incense", acc: 0 });
    g.host = { at: { x: ax, y: 3 }, stand: { x: ax, y: 5 }, face: "down", re: /priest|monk|abbot|nun|cleric|sage|hermit|sư|thầy|tu|đạo|tế|giáo|trụ trì|shaman|oracle/i };
  }
  if (g.host) g.markKeep(g.host.stand.x, g.host.stand.y);
  // where people stand around (people with something to say wait in the open)
  const ring: Pt[] = [];
  for (const [dx, dy] of [[-3, 1], [3, 1], [-3, -2], [3, -2], [-5, 1], [5, 1], [-2, 3], [2, 3], [-6, -1], [6, -1]] as const) {
    const p = { x: cx + dx, y: cy + dy };
    if (g.inb(p.x, p.y) && g.walk(p.x, p.y)) ring.push(p);
  }
  g.npcSlots = ring;
  g.objSlots = [{ x: cx - 3, y: cy - 1 }, { x: cx + 3, y: cy + 2 }, { x: cx - 3, y: cy + 2 }, { x: cx + 3, y: cy - 1 }];
}

/** Dungeons, tunnels and caves. */
function underBase(g: Gen) {
  const { r, scene } = g, bg = scene.bg;
  g.gnd.fill(G.WALL);
  const floor = bg === "dungeon" ? G.FLAG : G.CAVE;
  g.hub = { x: (g.w >> 1) + r.int(-2, 2), y: (g.h >> 1) + r.int(-1, 1) };
  const hub = g.hub;
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  if (bg === "dungeon") {
    // separate rooms with thick walls between, joined by narrow corridors of rough stone
    rooms.push({ x: hub.x - 4, y: hub.y - 3, w: 9, h: 6 });
    for (let tries = 0; tries < 400 && rooms.length < 8; tries++) {
      const w = r.int(5, 8), h = r.int(3, 5), x = r.int(2, g.w - w - 3), y = r.int(5, g.h - h - 2);
      if (rooms.some((q) => x < q.x + q.w + 4 && x + w + 4 > q.x && y < q.y + q.h + 5 && y + h + 5 > q.y)) continue;
      rooms.push({ x, y, w, h });
    }
    for (const q of rooms) g.rect(q.x, q.y, q.w, q.h, floor);
    const inRoom = (x: number, y: number) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    const dig = (x: number, y: number) => { if (!inRoom(x, y) && g.get(x, y) === G.WALL) g.set(x, y, G.CAVE); };
    const joined = [rooms[0]];
    const centre = (q: typeof rooms[0]) => ({ x: q.x + (q.w >> 1), y: q.y + (q.h >> 1) });
    for (const q of rooms.slice(1).sort((a, b) => Math.hypot(centre(a).x - hub.x, centre(a).y - hub.y) - Math.hypot(centre(b).x - hub.x, centre(b).y - hub.y))) {
      const a = centre(q);
      const b = joined.map(centre).sort((p, s) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(s.x - a.x, s.y - a.y))[0];
      const horizFirst = r.chance(0.5);
      const mid = horizFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      for (const [p, t] of [[a, mid], [mid, b]] as const) for (let x = Math.min(p.x, t.x); x <= Math.max(p.x, t.x); x++) for (let y = Math.min(p.y, t.y); y <= Math.max(p.y, t.y); y++) dig(x, y);
      joined.push(q);
    }
    g.rooms = rooms;
  } else if (bg === "cave") {
    const W = g.w, H = g.h;
    let m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = x < 1 || y < 3 || x >= W - 1 || y >= H - 1 ? 1 : r.chance(0.45) ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const n2 = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; c += xx < 0 || yy < 0 || xx >= W || yy >= H ? 1 : m[yy * W + xx]; }
        n2[y * W + x] = x < 1 || y < 3 || x >= W - 1 || y >= H - 1 ? 1 : c >= 5 ? 1 : 0;
      }
      m = n2;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!m[y * W + x]) g.set(x, y, floor);
    for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) if ((x / 5.5) ** 2 + (y / 3.5) ** 2 < 1) g.set(hub.x + x, hub.y + y, floor);
  } else {
    // tunnel: a chamber where the passages meet
    g.rect(hub.x - 3, hub.y - 2, 7, 5, floor);
  }
  // passages to the four edges
  for (const s of SIDES) {
    const end = g.edgePoint(s, 3);
    g.ends[s] = end;
    if (bg === "dungeon") g.road(hub, end, G.CAVE, 1, 0, (cur) => (cur === G.WALL || cur === G.VOID ? G.CAVE : cur));
    else g.road(hub, end, floor, bg === "tunnel" ? 3 : 2, bg === "cave" ? 0.5 : bg === "tunnel" ? 0.4 : 0, (cur) => (cur === G.WALL || cur === G.VOID ? floor : cur));
  }
  // keep the north wall solid enough for a face (2 rows) everywhere
  for (let x = 0; x < g.w; x++) { if (g.get(x, 1) !== G.WALL && g.ends.north!.x !== x && g.ends.north!.x + 1 !== x) g.set(x, 1, G.WALL); }
  // drop floor pockets that are not reachable
  const reach = g.flood(hub);
  for (let k = 0; k < g.w * g.h; k++) if (!reach[k] && !UNWALK.has(g.gnd[k])) g.gnd[k] = G.WALL;
  // thin walls between two floors look odd: a wall tile with floor above and below opens up
  for (let y = 1; y < g.h - 1; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === G.WALL && !UNWALK.has(g.get(x, y - 1)) && !UNWALK.has(g.get(x, y + 1))) g.set(x, y, floor);
  // door slots in faces of walls (two wall rows above a floor)
  const cands: Pt[] = [];
  for (let y = 3; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    if (g.get(x, y) === floor && g.get(x, y - 1) === G.WALL && g.get(x, y - 2) === G.WALL && g.get(x - 1, y - 1) === G.WALL && g.get(x + 1, y - 1) === G.WALL && !UNWALK.has(g.get(x - 1, y)) && !UNWALK.has(g.get(x + 1, y)))
      cands.push({ x, y: y - 1 });
  }
  cands.sort((a, b) => Math.hypot(a.x - hub.x, (a.y - hub.y) * 1.4) - Math.hypot(b.x - hub.x, (b.y - hub.y) * 1.4) + (cell(a.x, a.y, g.seed) - cell(b.x, b.y, g.seed)) * 3);
  for (const c of cands) if (!g.doorSlots.some((d) => Math.abs(d.x - c.x) < 4 && Math.abs(d.y - c.y) < 3)) g.doorSlots.push({ x: c.x, y: c.y, tw: 1, th: 1, wall: "n" });
  g.doorSlots = g.doorSlots.slice(0, 6);
  for (const d of g.doorSlots) g.markKeep(d.x, d.y + 1);
  const ring: Pt[] = [];
  for (let d = 1; d <= 4; d++) for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2 + d * 0.7;
    const p = { x: Math.round(hub.x + Math.cos(ang) * d * 1.3), y: Math.round(hub.y + Math.sin(ang) * d * 0.8) };
    if (g.inb(p.x, p.y) && g.open(p.x, p.y) && !ring.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 3)) ring.push(p);
  }
  g.npcSlots = ring;
  g.objSlots = [...ring].reverse();
  void rooms;
}

/** Half-width of a ship's deck along its length (u: -1 stern .. 1 bow), in units of its beam. */
const shipTaper = (u: number) => (u > 0.2 ? Math.sqrt(Math.max(0, 1 - ((u - 0.2) / 0.85) ** 2)) : u < -0.8 ? 0.8 : 1);
const SHIP = { halfL: 12, halfW: 4 };
/** A ship moored between piers. */
function shipBase(g: Gen) {
  g.gnd.fill(G.DEEP);
  const cx = g.w >> 1, cy = (g.h >> 1);
  g.hub = { x: cx, y: cy };
  const { halfL, halfW } = SHIP;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const u = (x - cx) / halfL, v = (y - cy) / halfW;
    const taper = shipTaper(u);
    if (Math.abs(u) <= 1.05 && Math.abs(v) <= taper) g.set(x, y, Math.abs(v) > taper - 1 / halfW || Math.abs(u) > 0.98 ? G.RAIL : G.DECK);
  }
  // water near the hull is lighter
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === G.DEEP) {
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) { const gg = g.get(x + dx, y + dy); if (gg === G.RAIL) near = true; }
    if (near) g.set(x, y, G.WATER);
  }
  g.ends = { north: { x: cx - 2, y: 0 }, south: { x: cx + 1, y: g.h - 1 }, west: { x: 0, y: cy }, east: { x: g.w - 1, y: cy } };
  g.doorSlots.push({ x: cx + 3, y: cy - 1, tw: 1, th: 1, wall: "s" }, { x: cx - 6, y: cy + 1, tw: 1, th: 1, wall: "s" });
  const slots: Pt[] = [];
  for (const [dx, dy] of [[-3, 0], [5, 1], [-1, -2], [2, 2], [-8, -1], [8, -1], [0, 1], [-5, 2]] as const) if (g.get(cx + dx, cy + dy) === G.DECK) slots.push({ x: cx + dx, y: cy + dy });
  g.npcSlots = slots;
  g.objSlots = [...slots].reverse();
  g.markKeep(cx - 9, cy, 18, 1);
}

// ------------------------------------------------------------ spots
const NPC_HINT = /guard|soldier|sentry|captain|knight|watch|lính|gác/i;

type NpcPlace = { id: string; at: Pt; spot?: PSpot; facing?: Facing; sitDy?: number };
function attachSpots(g: Gen, spots: ExploreOpts["spots"], actorIds: string[], entry: Side | undefined): { spots: PSpot[]; npcs: NpcPlace[] } {
  const out: PSpot[] = [];
  const npcs: NpcPlace[] = [];
  const bg = g.scene.bg;
  const r = new Rng(g.seed ^ 0x5eed);
  const usedSides = new Set<Side>();
  const zoneOf = (pts: Pt[]) => new Set(pts.filter((p) => g.inb(p.x, p.y)).map((p) => g.i(p.x, p.y)));
  const sideOpen = new Set<Side>(spots.filter((s) => s.via.exit).map((s) => s.via.exit!));
  if (entry) sideOpen.add(entry);

  // ---- exits
  for (const s of spots) {
    const side = s.via.exit;
    if (!side) continue;
    let end = g.ends[side];
    if (!end || usedSides.has(side)) {
      // a second way out on the same side: a branch off the hub
      const p = g.edgePoint(side, 9);
      const shift = usedSides.has(side) ? (side === "north" || side === "south" ? { x: p.x < g.hub.x ? -6 : 6, y: 0 } : { x: 0, y: p.y < g.hub.y ? -5 : 5 }) : { x: 0, y: 0 };
      end = { x: clamp(p.x + shift.x, 2, g.w - 3), y: clamp(p.y + shift.y, 2, g.h - 3) };
      if (side === "north") end.y = 0; if (side === "south") end.y = g.h - 1; if (side === "west") end.x = 0; if (side === "east") end.x = g.w - 1;
      const floor = g.kind === "under" ? (bg === "dungeon" ? G.FLAG : G.CAVE) : g.kind === "interior" ? g.gnd[g.i(g.hub.x, g.hub.y)] : g.kind === "settle" ? (bg === "village" ? G.DIRT : G.COBBLE) : G.DIRT;
      g.road(g.hub, end, floor, 1, 0.2, (cur) => (cur === G.WALL && g.kind !== "under" ? (g.kind === "settle" ? G.GATE : floor) : WATERY.has(cur) ? G.BRIDGE : floor));
    }
    usedSides.add(side);
    const v = SIDE_V[side];
    if (g.kind === "interior") g.set(end.x, end.y, g.gnd[g.i(g.hub.x, g.hub.y)]);
    if (g.kind === "ship") shipGangway(g, side, end);
    const stand = { x: end.x - v.x, y: end.y - v.y };
    const zonePts = [end, stand];
    for (const [dx, dy] of DIR4) { const q = { x: end.x + dx, y: end.y + dy }; if (g.open(q.x, q.y) && (dx === v.x || dy === v.y ? false : true)) zonePts.push(q, { x: q.x - v.x, y: q.y - v.y }); }
    const sp: PSpot = {
      key: s.key, label: s.label, via: s.via, locked: s.locked, kind: "exit", stand, zone: zoneOf(zonePts.filter((p) => g.open(p.x, p.y))),
      ax: end.x * TW + TW / 2 + v.x * -8, ay: end.y * TW + (side === "south" ? 0 : side === "north" ? TW : 4), side,
      hit: { x0: Math.min(end.x, stand.x) * TW - TW, y0: Math.min(end.y, stand.y) * TW - TW, x1: (Math.max(end.x, stand.x) + 2) * TW, y1: (Math.max(end.y, stand.y) + 2) * TW },
      face: v,
    };
    g.markKeep(end.x - 1, end.y - 1, 3, 3);
    g.markKeep(stand.x - 1, stand.y - 1, 3, 3);
    out.push(sp);
    // a signpost pointing out of the area
    if (g.kind === "wild" || g.kind === "settle") {
      const at = { x: end.x - v.x * 3 + (v.x ? 0 : 1), y: end.y - v.y * 3 + (v.y ? 0 : -1) };
      const alt = [{ x: at.x, y: at.y }, { x: at.x - (v.x ? 0 : 2), y: at.y }, { x: at.x, y: at.y + (v.y ? 0 : 2) }, { x: at.x + (v.x ? 0 : 1), y: at.y }];
      const spot = alt.find((p) => g.inb(p.x, p.y) && g.free(p.x, p.y, 1, 1) && g.get(p.x, p.y) !== G.BRIDGE && !(g.kind === "settle" && (bg === "city" || bg === "castle") && g.get(p.x, p.y) === G.WALL));
      if (spot) g.sprite(prop("signpost", side[0]), spot.x, spot.y, 1, 1, { dy: 2 });
    }
  }
  if (g.kind === "ship" && entry && !usedSides.has(entry) && g.ends[entry]) shipGangway(g, entry, g.ends[entry]!);
  // ---- closed sides: a fence, rubble or a shut gate
  for (const side of SIDES) {
    if (sideOpen.has(side)) continue;
    const end = g.ends[side];
    if (!end) continue;
    g.closed.push(side);
    closeSide(g, side, end);
  }

  // ---- doors
  const doorSpots = spots.filter((s) => s.via.door && !s.via.exit);
  for (const s of doorSpots) {
    const slot = g.doorSlots.find((d) => !d.used && (d.style !== "keep" || doorStyle(s.label, g.kind, bg) === "keep" || g.doorSlots.filter((x) => !x.used).length === 1))
      ?? g.doorSlots.find((d) => !d.used);
    if (!slot) { spots.push({ ...s, via: { object: s.label } }); continue; }
    slot.used = true;
    const style = slot.style ?? doorStyle(s.label, g.kind, bg);
    out.push(placeDoor(g, slot, style, s, zoneOf));
  }

  // ---- people
  const npcIds = new Set<string>();
  const others = actorIds.filter((id) => id !== "lonewolf" && id !== "hero");
  let slotI = 0;
  const takeSlot = (pref?: (p: Pt) => number): Pt | null => {
    const free = g.npcSlots.filter((p) => g.walk(p.x, p.y) && !g.keep[g.i(p.x, p.y)] || (g.walk(p.x, p.y) && g.kind !== "wild"));
    if (pref) free.sort((a, b) => pref(a) - pref(b));
    const p = (pref ? free[0] : free[slotI++ % Math.max(1, free.length)]) ?? g.nearFree(g.hub, (x, y) => g.walk(x, y) && !g.block[g.i(x, y)]);
    if (!p) return null;
    g.block[g.i(p.x, p.y)] = 1;
    g.npcSlots = g.npcSlots.filter((q) => q !== p);
    return p;
  };
  for (const s of spots.filter((x) => x.via.npc && !x.via.exit && !x.via.door)) {
    const id = s.via.npc!;
    npcIds.add(id);
    // the keeper of the place stands at their post (behind the bar, on the throne, at the altar)
    const H = g.host;
    if (H && !H.used && (H.re.test(id) || H.re.test(s.label))) {
      H.used = true;
      const zp = [H.stand, ...[-1, 1].map((d) => ({ x: H.stand.x + d, y: H.stand.y }))].filter((p) => g.walk(p.x, p.y));
      g.block[g.i(H.at.x, H.at.y)] = 1;
      const top = H.at.y * TW + FEET - 54 + (H.sitDy ?? 0);
      const sp: PSpot = {
        key: s.key, label: s.label, via: s.via, locked: s.locked, kind: "npc", stand: H.stand, zone: zoneOf(zp),
        ax: H.at.x * TW + TW / 2, ay: top, hit: { x0: H.at.x * TW - 4, y0: top + 2, x1: H.at.x * TW + TW + 4, y1: H.at.y * TW + FEET + 4 },
        face: { x: Math.sign(H.at.x - H.stand.x), y: Math.sign(H.at.y - H.stand.y) },
      };
      for (const p of zp) g.markKeep(p.x, p.y);
      out.push(sp);
      npcs.push({ id, at: H.at, spot: sp, facing: H.face, sitDy: H.sitDy });
      continue;
    }
    // guards wait by the gate they watch
    let pref: ((p: Pt) => number) | undefined;
    if (NPC_HINT.test(id) && g.kind === "settle") {
      const gate = out.find((o) => o.kind === "exit") ?? null;
      if (gate) { const gp = { x: gate.stand.x, y: gate.stand.y }; pref = (p) => Math.abs(Math.hypot(p.x - gp.x, p.y - gp.y) - 2.2); g.npcSlots.push(...[[-2, -1], [2, -1], [-2, 1], [2, 1], [-1, -2], [1, -2]].map(([dx, dy]) => ({ x: gp.x + dx, y: gp.y + dy })).filter((p) => g.walk(p.x, p.y))); }
    }
    const at = takeSlot(pref);
    if (!at) continue;
    const near: Pt[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.walk(at.x + dx, at.y + dy)) near.push({ x: at.x + dx, y: at.y + dy });
    near.sort((a, b) => Math.hypot(a.x - g.hub.x, a.y - g.hub.y) - Math.hypot(b.x - g.hub.x, b.y - g.hub.y) + (a.y > at.y ? -0.6 : 0) - (b.y > at.y ? -0.6 : 0));
    const stand = near.find((p) => p.x === at.x || p.y === at.y) ?? near[0] ?? { x: at.x, y: at.y + 1 };
    const sp: PSpot = {
      key: s.key, label: s.label, via: s.via, locked: s.locked, kind: "npc", stand, zone: zoneOf([stand, ...near.filter((p) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) <= 1)]),
      ax: at.x * TW + TW / 2, ay: at.y * TW + FEET - 54,
      hit: { x0: at.x * TW - 4, y0: at.y * TW + FEET - 52, x1: at.x * TW + TW + 4, y1: at.y * TW + FEET + 4 },
      face: { x: at.x - stand.x, y: at.y - stand.y },
    };
    for (const p of [stand, ...near]) g.markKeep(p.x, p.y);
    out.push(sp);
    npcs.push({ id, at, spot: sp });
  }
  for (const id of others) {
    if (npcIds.has(id)) continue;
    npcIds.add(id);
    const at = takeSlot();
    if (at) npcs.push({ id, at });
  }

  // ---- things
  for (const s of spots.filter((x) => x.via.object && !x.via.exit && !x.via.door && !x.via.npc)) {
    const kind = objectKind(s.via.object ?? s.label);
    const sp = placeObject(g, kind, s, zoneOf, r);
    if (sp) out.push(sp);
  }
  // anything else that came with a "via" we do not know: a glowing marker
  for (const s of spots.filter((x) => !x.via.exit && !x.via.door && !x.via.npc && !x.via.object)) {
    const sp = placeObject(g, "marker", s, zoneOf, r);
    if (sp) out.push(sp);
  }
  return { spots: out, npcs };
}

function shipGangway(g: Gen, side: Side, end: Pt) {
  const v = SIDE_V[side];
  // walk from the edge toward the hull until the deck
  let x = end.x, y = end.y;
  for (let k = 0; k < 40; k++) {
    const gg = g.get(x, y);
    if (gg === G.DECK) break;
    g.set(x, y, gg === G.RAIL ? G.DECK : G.BRIDGE);
    if (side === "north" || side === "south") { g.set(x + 1, y, g.get(x + 1, y) === G.RAIL ? G.DECK : g.get(x + 1, y) === G.DECK ? G.DECK : G.BRIDGE); }
    g.keep[g.i(x, y)] = 1;
    x -= v.x; y -= v.y;
    if (!g.inb(x, y)) break;
  }
}

function closeSide(g: Gen, side: Side, end: Pt) {
  const v = SIDE_V[side];
  const bg = g.scene.bg;
  if (g.kind === "interior" || g.kind === "ship") return;
  if (g.kind === "under") {
    // the passage caved in a few tiles before the edge
    for (let k = 0; k < 3; k++) {
      const x = end.x - v.x * k, y = end.y - v.y * k;
      for (let o = -2; o <= 2; o++) { const xx = x + (v.x ? 0 : o), yy = y + (v.y ? 0 : o); if (g.inb(xx, yy)) { g.set(xx, yy, G.WALL); g.keep[g.i(xx, yy)] = 0; } }
    }
    const p = { x: end.x - v.x * 3, y: end.y - v.y * 3 };
    if (g.walk(p.x, p.y)) g.sprite(prop("rock", "#6a6058", 1), p.x, p.y, 1, 1, { soft: false });
    return;
  }
  if (g.kind === "settle" && (bg === "city" || bg === "castle")) {
    // the gate stays shut: wall it again (the gatehouse shows a closed door)
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== G.GATE) continue;
      const onSide = side === "north" ? y <= 2 : side === "south" ? y >= g.h - 1 : side === "west" ? x <= 0 : x >= g.w - 1;
      if (onSide) { g.set(x, y, G.WALL); g.keep[g.i(x, y)] = 0; }
    }
    return;
  }
  // wild places and villages: the road fades out into the wilds, with a fence or fallen log across
  const len = g.kind === "settle" ? 2 : 4;
  for (let k = 0; k < len; k++) {
    const x = end.x - v.x * k, y = end.y - v.y * k;
    for (let o = -1; o <= 2; o++) {
      const xx = x + (v.x ? 0 : o), yy = y + (v.y ? 0 : o);
      if (!g.inb(xx, yy)) continue;
      const gg = g.get(xx, yy);
      if (gg === G.DIRT || gg === G.PATHSAND || gg === G.FLAG || gg === G.COBBLE) g.set(xx, yy, bg === "desert" ? G.SAND : G.GRASS);
      if (gg === G.BRIDGE) g.set(xx, yy, G.WATER);
      g.keep[g.i(xx, yy)] = 0;
    }
  }
  const p = { x: end.x - v.x * len, y: end.y - v.y * len };
  if (g.kind === "settle") {
    for (let o = -1; o <= 2; o++) { const xx = p.x + (v.x ? 0 : o), yy = p.y + (v.y ? 0 : o); if (g.inb(xx, yy) && g.walk(xx, yy)) g.sprite(prop("fence", v.x ? "v" : "h"), xx, yy, 1, 1, { dy: 0 }); }
  } else if (g.walk(p.x, p.y) && bg !== "desert") {
    g.sprite(prop("log"), p.x, p.y, 1, 1, { soft: true });
    if (g.walk(p.x + (v.x ? 0 : 1), p.y + (v.y ? 0 : 1))) g.block[g.i(p.x + (v.x ? 0 : 1), p.y + (v.y ? 0 : 1))] = 1;
  }
}

function placeDoor(g: Gen, slot: Gen["doorSlots"][0], style: BStyle, s: ExploreOpts["spots"][0], zoneOf: (p: Pt[]) => Set<number>): PSpot {
  const base = { key: s.key, label: s.label, via: s.via, locked: s.locked, kind: "door" as const };
  if (slot.wall) {
    // a door in a wall face (interiors, dungeons, ship hatches)
    const x = slot.x, y = slot.y;
    if (slot.wall === "s") {
      // a hatch on the deck
      g.sprite(prop("hatch"), x, y, 1, 1, { flat: true, dy: -6 });
      const stand = { x, y: y + 1 };
      g.markKeep(x, y + 1);
      return { ...base, stand, zone: zoneOf([stand, { x: x - 1, y }, { x: x + 1, y }]), ax: x * TW + TW / 2, ay: y * TW - 4, hit: { x0: x * TW - 8, y0: y * TW - 8, x1: x * TW + TW + 8, y1: y * TW + TW + 8 }, face: { x: 0, y: -1 } };
    }
    if (slot.wall === "w" || slot.wall === "e") {
      const dir = slot.wall === "w" ? 1 : -1;
      g.extra.set(g.i(x, y), `door:${hasWord(s.label, ["cầu thang", "lên", "xuống", "stairs", "lầu", "gác"]) ? "stairs" : "side"}`);
      const stand = { x: x + dir, y };
      g.markKeep(stand.x, stand.y);
      return { ...base, stand, zone: zoneOf([stand]), ax: x * TW + TW / 2 + dir * 14, ay: y * TW - 18, hit: { x0: x * TW - 8, y0: y * TW - 24, x1: x * TW + TW + 8, y1: y * TW + TW + 8 }, face: { x: -dir, y: 0 } };
    }
    const stairs = hasWord(s.label, ["cầu thang", "lên", "lầu", "gác", "upstairs", "stairs", "tầng trên"]) ? "up" : hasWord(s.label, ["xuống", "hầm", "downstairs", "dưới"]) ? "down" : "door";
    if (stairs === "up" && g.kind === "interior" && g.free(x - 2, 3, 2, 3) && g.free(x - 2, 6, 2, 1)) {
      // a real staircase up the back wall; the hero steps onto its foot
      g.sprite(fur("stairs"), x - 2, 3, 2, 3, { flat: true, dy: 0 });
      g.hasStairs = true;
      const stand = { x: x - 1, y: 6 };
      g.markKeep(x - 2, 6, 3, 1);
      return { ...base, stand, zone: zoneOf([stand, { x: x - 2, y: 6 }]), ax: (x - 1) * TW, ay: 2 * TW, hit: { x0: (x - 2) * TW, y0: TW, x1: x * TW, y1: 7 * TW }, face: { x: 0, y: -1 } };
    }
    g.extra.set(g.i(x, y), `door:${stairs}`);
    const stand = { x, y: y + 1 };
    g.markKeep(x - 1, y + 1, 3, 2);
    return { ...base, stand, zone: zoneOf([stand]), ax: x * TW + TW / 2, ay: (y - 1) * TW - 6, hit: { x0: x * TW - 6, y0: (y - 1) * TW, x1: x * TW + TW + 6, y1: (y + 2) * TW }, face: { x: 0, y: -1 } };
  }
  // a building on a footprint, door at the bottom middle
  const size: Record<BStyle, [number, number]> = { house: [3, 2], cottage: [3, 2], inn: [5, 3], shop: [3, 2], smith: [3, 2], temple: [5, 3], tower: [3, 3], keep: [7, 4], hut: [3, 2], tent: [3, 2], cave: [3, 2], ruin: [3, 2], barn: [5, 2], manor: [5, 3], gatehouse: [3, 2], stable: [5, 2] };
  let [tw, th] = size[style];
  tw = Math.min(tw, slot.tw); th = Math.min(th, slot.th);
  if (tw % 2 === 0) tw--;
  const x0 = slot.x + ((slot.tw - tw) >> 1), y0 = slot.y + slot.th - th;
  const img = buildingSprite({ style, tw, th, lit: g.lit, seed: (g.seed + slot.x * 31 + slot.y * 7) >>> 0, snow: g.scene.weather === "snow" });
  for (let y = y0; y < y0 + th; y++) for (let x = x0; x < x0 + tw; x++) { g.set(x, y, G.GRASS); g.keep[g.i(x, y)] = 1; }
  g.put({ x: (x0 + tw / 2) * TW, y: (y0 + th) * TW, img, s: 2, fade: true }, x0, y0, tw, th);
  houseExtras(g, style, x0, y0, tw, th, img);
  const dx = x0 + (tw >> 1), dy = y0 + th - 1;
  const stand = { x: dx, y: dy + 1 };
  if (!g.open(stand.x, stand.y)) g.set(stand.x, stand.y, g.kind === "settle" ? G.COBBLE : G.DIRT);
  g.markKeep(stand.x - 1, stand.y, 3, 2);
  const doorTop = (y0 + th) * TW - 8 - (style === "tower" || style === "keep" ? 40 : 36);
  return {
    ...base, stand, zone: zoneOf([stand]), ax: dx * TW + TW / 2, ay: doorTop - 6,
    hit: { x0: x0 * TW, y0: (y0 + th) * TW - img.height * 2, x1: (x0 + tw) * TW, y1: (y0 + th) * TW + 6 },
    face: { x: 0, y: -1 },
  };
}

/** Light, smoke and glow that come with a building. */
function houseExtras(g: Gen, style: BStyle, x0: number, y0: number, tw: number, th: number, img: HTMLCanvasElement) {
  const bx = x0 * TW, by = (y0 + th) * TW, W = tw * 16, H = img.height;
  const wpx = (ax: number, ay: number) => ({ x: bx + ax * 2, y: by - (H - ay) * 2 });
  if (["house", "cottage", "inn", "smith", "manor"].includes(style)) {
    const c = wpx(W - 13 - ((((g.seed + x0 * 31 + y0 * 7) >>> 0) % 2) * 6) + 2, Math.max(3, H - th * 16 - 6) - 6);
    g.emit.push({ x: c.x + 1, y: c.y, kind: "smoke", acc: Math.random() * 1000 });
  }
  if (style === "smith") g.emit.push({ x: bx + W, y: by - 24, kind: "embers", on: "always", acc: 0 });
  if (style !== "tent" && style !== "cave" && style !== "ruin") {
    const foundTop = H - 4, winY = foundTop - 15;
    const xs = W >= 80 ? [6, 18, W - 12, W - 24] : W >= 48 ? [5, W - 11] : [W - 10];
    for (const x of xs) { const p = wpx(x + 3, winY + 3); g.lights.push({ x: p.x, y: p.y + 4, r: 26, col: "#ffc870", on: "dark", glow: 0.35, flick: 0.2 }); }
    if (W >= 48) { const p = wpx(Math.round(W / 2 + 5 + 3.5), foundTop - 14); g.lights.push({ x: p.x, y: p.y, r: 34, col: "#ffd27a", on: "dark", glow: 0.5, flick: 0.3 }); }
  }
  if (style === "tower" || style === "keep" || style === "gatehouse") {
    const p = wpx(W / 2, H - 22);
    g.lights.push({ x: p.x - 22, y: p.y, r: 40, col: "#ffc060", on: "dark", glow: 0.4, flick: 0.6 }, { x: p.x + 22, y: p.y, r: 40, col: "#ffc060", on: "dark", glow: 0.4, flick: 0.6 });
  }
  if (style === "cave") g.lights.push({ x: bx + W, y: by - 10, r: 22, col: "#2a1a10", on: "always" });
}

function placeObject(g: Gen, kind: ObjectKind, s: ExploreOpts["spots"][0], zoneOf: (p: Pt[]) => Set<number>, r: Rng): PSpot | null {
  const bg = g.scene.bg;
  let at: Pt | null = null;
  if (kind === "boat") {
    // on the water, next to a walkable shore near the middle
    let best: Pt | null = null, bd = Infinity;
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 2; x++) {
      const gg = g.get(x, y);
      if ((gg !== G.WATER && gg !== G.DEEP) || g.block[g.i(x, y)] || g.get(x + 1, y) === G.BRIDGE || g.get(x, y) === G.BRIDGE) continue;
      if (!WATERY.has(g.get(x + 1, y)) || g.get(x + 1, y) === G.BRIDGE) continue;
      const shore = DIR4.some(([dx, dy]) => g.walk(x + dx, y + dy) && g.get(x + dx, y + dy) !== G.BRIDGE);
      if (!shore) continue;
      const d = Math.hypot(x - g.hub.x, y - g.hub.y) + cell(x, y, g.seed) * 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    at = best;
    if (!at) kind = "marker";
  }
  if (!at && kind === "fire" && bg === "camp") at = { ...g.hub };
  if (!at && (kind === "altar" || kind === "statue") && g.kind === "interior" && g.walk(g.hub.x, 3)) at = { x: g.hub.x, y: 3 };
  if (!at && kind === "well" && g.kind === "settle" && g.free(g.hub.x, g.hub.y, 1, 1)) at = { ...g.hub };
  if (!at) {
    const slots = g.objSlots.filter((p) => g.free(p.x, p.y, 1, 1, (gg) => !UNWALK.has(gg) && gg !== G.BRIDGE) || (g.walk(p.x, p.y) && !g.block[g.i(p.x, p.y)]));
    at = slots[0] ?? g.nearFree(g.hub, (x, y) => g.walk(x, y) && !g.keep[g.i(x, y)], 9) ?? g.nearFree(g.hub);
    if (at) g.objSlots = g.objSlots.filter((p) => p.x !== at!.x || p.y !== at!.y);
  }
  if (!at) return null;
  const { x, y } = at;
  const cx = x * TW + TW / 2, foot = (y + 1) * TW;
  let topY = foot - 40;
  let walkable = false;
  const put = (img: HTMLCanvasElement, o: Partial<Obj> = {}) => { const ob = g.put({ x: cx, y: foot - 3, img, s: 2, ...o }, x, y, 1, 1, walkable); topY = foot - img.height * (o.s ?? 2) - 3; return ob; };
  switch (kind) {
    case "well": put(prop("well")); break;
    case "chest": put(propCanvas("chest"), { live: sparkleLive }); break;
    case "corpse": {
      const look = lookFor(/forest|road|camp|field/.test(bg) ? "soldier" : bg === "dungeon" ? "prisoner" : "traveller");
      put(personFrame(look, "down", "dead", 0), { s: 1, dy: 0 });
      g.objs[g.objs.length - 1].y = foot - 8;
      topY = foot - 30;
      break;
    }
    case "bones": put(prop("corpseBones")); topY = foot - 30; break;
    case "stone": put(prop("stone")); g.lights.push({ x: cx, y: foot - 30, r: 30, col: "#6ad0ff", on: "dark", glow: 0.25, flick: 0.2 }); break;
    case "boat": {
      const img = prop("boat");
      g.put({ x: cx + TW / 2, y: foot - 4, img, s: 2, live: (c, ox, oy, t) => { void c; void ox; void oy; void t; } }, x, y, 2, 1);
      topY = foot - 40;
      break;
    }
    case "fire": {
      if (bg === "camp" && x === g.hub.x && y === g.hub.y) { topY = foot - 46; break; }
      put(prop("log", 1), { live: campfire });
      g.objs[g.objs.length - 1].img = undefined;
      g.lights.push({ x: cx, y: foot - 14, r: 140, col: "#ffb060", flick: 1, on: "always", glow: 0.5 });
      g.emit.push({ x: cx, y: foot - 20, kind: "fire", acc: 0 }, { x: cx, y: foot - 30, kind: "smoke", acc: 0 });
      topY = foot - 46;
      break;
    }
    case "altar": put(prop("altar")); g.lights.push({ x: cx, y: foot - 40, r: 50, col: "#ffd890", on: "always", glow: 0.4, flick: 0.5 }); g.emit.push({ x: cx, y: foot - 50, kind: "incense", acc: 0 }); break;
    case "statue": put(prop("statue", g.kind === "under" ? "#7a7a80" : "#b0aca0")); break;
    case "grave": put(prop("tomb", 0)); break;
    case "tree": {
      const img = tall(bg === "swamp" ? "willow" : bg === "desert" ? "palm" : "tree", g.biome, 7);
      g.put({ x: cx, y: foot - 4, img, s: 3, fade: true }, x, y);
      topY = foot - img.height * 3 + 10;
      break;
    }
    case "sign": put(prop("notice")); break;
    case "book": put(prop("table", 3), { live: (c, ox, oy) => { c.drawImage(prop("books"), ox - 8, oy - 40, 28, 24); } }); break;
    case "table": put(prop("table", 1)); break;
    case "cart": put(prop("cart")); break;
    case "horse": {
      const f = creatureFrame("horse", "idle", 0, "right");
      put(f, { s: 1, live: (c, ox, oy, t) => { const fr = creatureFrame("horse", "idle", Math.floor(t / 520), "right"); c.drawImage(fr, Math.round(ox - fr.width / 2), Math.round(oy - fr.height)); } });
      g.objs[g.objs.length - 1].img = undefined;
      topY = foot - creatureSize("horse").h - 4;
      break;
    }
    case "lever": put(prop("lever")); break;
    case "rack": put(prop("rack")); break;
    case "herbs": walkable = false; put(prop("herbs")); break;
    case "pool": put(prop("pool")); break;
    case "bag": put(prop("bag")); break;
    case "fountain": put(prop("fountain")); g.emit.push({ x: cx, y: foot - 40, kind: "spray", acc: 0 }); break;
    case "anvil": put(prop("anvil")); break;
    case "barrel": put(prop("barrel")); break;
    case "crates": put(prop("crates")); break;
    default: {
      // a glowing marker on the ground
      g.put({ x: cx, y: foot - 12, s: 1, flat: true, live: markerLive }, x, y, 1, 1, true);
      g.block[g.i(x, y)] = 0;
      topY = foot - 40;
      g.lights.push({ x: cx, y: foot - 14, r: 40, col: "#9ad8ff", on: "always", glow: 0.3, flick: 0.4 });
    }
  }
  void r;
  // stand on the side facing the hub (south first)
  const near: Pt[] = [];
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1]] as const) if (g.walk(x + dx, y + dy)) near.push({ x: x + dx, y: y + dy });
  if (kind === "marker") near.unshift({ x, y });
  if (kind === "boat") near.sort((a, b) => Math.hypot(a.x - g.hub.x, a.y - g.hub.y) - Math.hypot(b.x - g.hub.x, b.y - g.hub.y));
  let stand = near[0];
  if (!stand) {
    // open the ground in front of it
    stand = { x, y: y + 1 };
    g.connect(g.hub, [stand], g.kind === "settle" ? G.COBBLE : G.DIRT);
  }
  for (const p of near) g.markKeep(p.x, p.y);
  return {
    key: s.key, label: s.label, via: s.via, locked: s.locked, kind: "object", stand, zone: zoneOf(near.filter((p) => Math.abs(p.x - x) + Math.abs(p.y - y) <= 1)),
    ax: cx + (kind === "boat" ? TW / 2 : 0), ay: topY - 4,
    hit: { x0: x * TW - 6, y0: topY, x1: x * TW + TW * (kind === "boat" ? 2 : 1) + 6, y1: foot + 4 },
    face: { x: x - stand.x, y: y - stand.y },
  };
}

// ------------------------------------------------------------ decoration
/** Trees, bushes, rocks and small things over every free tile (tile-hashed, so stable per place). */
function decorateWild(g: Gen) {
  const bg = g.scene.bg, s = g.seed, snow = g.scene.weather === "snow";
  const pine = snow ? SNOWPINE : PINE;
  const dens: Partial<Record<Scene["bg"], number>> = { forest: 0.4, camp: 0.32, road: 0.26, field: 0.12, hill: 0.22, mountain: 0.2, sky: 0.15, river: 0.26, lake: 0.26, bridge: 0.26, swamp: 0.17, desert: 0.05, coast: 0.12, sea: 0.1, ruins: 0.28 };
  const base = dens[bg] ?? 0.3;
  const motifs: [string, number, [string, string, string, string]?][] =
    bg === "desert" ? [["cactus", 3], ["rock", 2], ["dead_tree", 1]]
      : bg === "swamp" ? [["mangrove", 3], ["dead_tree", 2], ["willow", 2]]
        : bg === "mountain" || bg === "sky" ? [["pine", 4, pine], ["rock", 2], ["dead_tree", 1]]
          : bg === "hill" ? [["tree", 3], ["pine", 2, pine], ["rock", 1]]
            : bg === "coast" || bg === "sea" ? [["palm", 3], ["rock", 1], ["bush", 1]]
              : bg === "ruins" ? [["tree", 3], ["broken_pillar", 2, ["#4a4a44", "#9a9488", "#d8d0c0", "#6a6258"]], ["ruin_wall", 1, ["#4a4a44", "#9a9488", "#d8d0c0", "#6a6258"]]]
                : bg === "lake" || bg === "river" || bg === "bridge" ? [["tree", 4], ["willow", 2], ["birch", 1]]
                  : bg === "forest" || bg === "camp" ? [["tree", 4], ["oak", 2], ["pine", 2, pine], ["birch", 2], ["bush", 1], ["fir", 1, pine]]
                    : [["tree", 5], ["pine", 2, pine], ["birch", 1], ["bush", 1]];
  const total = motifs.reduce((a, m) => a + m[1], 0);
  const pickMotif = (h: number) => { let acc = 0; for (const m of motifs) { acc += m[1] / total; if (h < acc) return m; } return motifs[0]; };
  // the camp: tents around the fire, bedrolls
  if (bg === "camp") {
    const tents = [[-6, -3], [5, -4], [-5, 3]];
    tents.forEach(([dx, dy], i) => {
      const x0 = g.hub.x + dx - 1, y0 = g.hub.y + dy - 1;
      for (let yy = y0; yy < y0 + 2; yy++) for (let xx = x0; xx < x0 + 3; xx++) if (!g.inb(xx, yy) || g.block[g.i(xx, yy)] || UNWALK.has(g.get(xx, yy)) || g.get(xx, yy) === G.DIRT) return;
      g.put({ x: (x0 + 1.5) * TW, y: (y0 + 2) * TW, img: buildingSprite({ style: "tent", tw: 3, th: 2, lit: g.lit, seed: g.seed + i }), s: 2, fade: true }, x0, y0, 3, 2);
      if (g.free(x0 + 3, y0 + 1, 1, 1)) g.sprite(prop("bedroll", i), x0 + 3, y0 + 1, 1, 1, { flat: true, walkable: true, dy: 4 });
    });
    const spots = [[3, 2], [-3, -2]] as const;
    for (const [dx, dy] of spots) if (g.free(g.hub.x + dx, g.hub.y + dy, 1, 1)) g.sprite(r2(g) ? prop("rack") : prop("woodpile"), g.hub.x + dx, g.hub.y + dy);
  }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const i = g.i(x, y), gg = g.gnd[i];
    if (g.keep[i] || g.block[i]) continue;
    if (!(gg === G.GRASS || gg === G.FLOWER || gg === G.SAND || gg === G.MUD || gg === G.ROCK)) continue;
    const edge = Math.min(x, y, g.w - 1 - x, g.h - 1 - y);
    const clump = fbm(x / 5, y / 5, s + 11);
    const dHub = Math.hypot(x - g.hub.x, (y - g.hub.y) * 1.2);
    const near = (k: number) => { for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { if (g.inb(x + dx, y + dy) && g.keep[g.i(x + dx, y + dy)]) return true; } return false; };
    let d = base * (0.4 + clump * 1.3) + (edge < 3 ? (3 - edge) * 0.18 * (base > 0.2 ? 1 : 0.25) : 0);
    // glades open up between groves
    const glade = fbm(x / 7, y / 6, s + 31);
    const glades = bg === "forest" || bg === "swamp" || bg === "camp" || bg === "river" || bg === "lake" || bg === "road";
    if (glades && glade < 0.4) d *= 0.12; else if (glades && glade > 0.62) d *= 1.35;
    if (dHub < 6) d *= 0.35;
    if (near(1)) d *= 0.45;
    const h = cell(x, y, s + 1);
    if (gg === G.ROCK) { if (h < 0.12) g.tree(x, y, bg === "desert" ? "rock" : "pine", (x + y) % 3, pine); continue; }
    if (h < d) {
      const m = pickMotif(cell(x, y, s + 2));
      if (m[0] === "bush") g.sprite(prop("bush", g.biome.obs[1], x + y), x, y, 1, 1, { soft: true, dy: 1 });
      else if (m[0] === "rock") g.sprite(prop("rock", bg === "desert" ? "#c8a070" : "#8a8a90", x), x, y, 1, 1, { soft: true, dy: 2 });
      else if (m[0] === "oak") g.tree(x, y, "tree", 3 + Math.floor(cell(x, y, s + 3) * 3), snow ? undefined : OAK[Math.floor(cell(x, y, s + 8) * OAK.length)]);
      else if (m[0] === "fir") g.tree(x, y, "pine", 4 + Math.floor(cell(x, y, s + 3) * 3), FIR);
      else g.tree(x, y, m[0], Math.floor(cell(x, y, s + 3) * 3), m[2]);
      continue;
    }
    const wildish = bg === "forest" || bg === "swamp" || bg === "camp" || bg === "river" || bg === "lake" || bg === "road" || bg === "hill" || bg === "bridge";
    // small things
    const h2 = cell(x, y, s + 4);
    if (h2 < 0.035) g.sprite(prop("bush", g.biome.obs[1], x * 3 + y), x, y, 1, 1, { soft: true, dy: 1 });
    else if (h2 < 0.055) g.sprite(prop("rock", bg === "desert" ? "#c8a070" : bg === "swamp" ? "#5a5e50" : "#8a8a90", x), x, y, 1, 1, { soft: true, dy: 2 });
    else if (h2 < 0.065 && bg !== "desert") g.sprite(prop("stump"), x, y, 1, 1, { soft: true, dy: 2 });
    else if (h2 < 0.09 && (bg === "forest" || bg === "swamp" || bg === "camp")) g.sprite(prop("mushrooms"), x, y, 1, 1, { soft: true, walkable: true, flat: true, dy: 8 });
    else if (h2 < 0.15 && wildish) g.sprite(fur(bg === "swamp" ? "cattail" : "fern", x + y), x, y, 1, 1, { soft: true, walkable: true, dy: 3 });
    else if (h2 < 0.2 && wildish && !snow) g.sprite(fur("tallgrass", x * 5 + y, bg === "swamp" ? "#6a8a3a" : ""), x, y, 1, 1, { soft: true, walkable: true, dy: 2 });
    else if (h2 < 0.215 && wildish && bg !== "swamp") g.sprite(fur("mossrock", x), x, y, 1, 1, { soft: true, dy: 2 });
    else if (h2 < 0.228 && wildish && g.free(x + 1, y, 1, 1)) { g.sprite(prop("log"), x, y, 2, 1, { soft: true, dy: 3 }); }
    else if (h2 < 0.3 && gg === G.GRASS && bg !== "desert" && !snow && (!glades || glade < 0.5)) g.set(x, y, G.FLOWER);
    else if (h2 < 0.33 && glades && glade < 0.4 && !snow && bg !== "swamp") g.sprite(fur("flowerpatch", x + y * 3), x, y, 1, 1, { walkable: true, flat: true, dy: 4 });
  }
  // reeds and lily pads on the banks
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const gg = g.get(x, y);
    if (gg !== G.WATER || g.block[g.i(x, y)]) continue;
    const bank = DIR4.some(([dx, dy]) => { const n = g.get(x + dx, y + dy); return n === G.GRASS || n === G.FLOWER || n === G.MUD; });
    const h = cell(x, y, s + 9);
    if (bank && h < 0.3 && bg !== "coast" && bg !== "sea") g.put({ x: x * TW + TW / 2, y: (y + 1) * TW - 6, img: prop("reeds", x), s: 2 }, x, y, 1, 1);
    else if (!bank && h < 0.14 && (bg === "lake" || bg === "swamp" || bg === "river")) g.put({ x: x * TW + TW / 2, y: y * TW + 22, s: 1, flat: true, live: lily(x * 7 + y) }, x, y, 1, 1);
  }
  if (bg === "field") farmPlots(g, 2);
  if (bg === "road" && g.free(g.hub.x + 3, g.hub.y - 2, 1, 1)) g.sprite(prop("cart"), g.hub.x + 3, g.hub.y - 2);
}
const r2 = (g: Gen) => g.r.chance(0.5);

function farmPlots(g: Gen, n: number) {
  const lots = findLots(g, g.hub, [[5, 3], [4, 3]], n, (x, y, w, h) => g.free(x - 1, y - 1, w + 2, h + 2, (gg) => gg === G.GRASS || gg === G.FLOWER), 1);
  const crops = ["wheat", "carrot", "cabbage", "pumpkin", "corn", "potato"];
  lots.forEach((l, k) => {
    const crop = crops[(g.seed + k) % crops.length];
    for (let y = l.y; y < l.y + l.th; y++) for (let x = l.x; x < l.x + l.tw; x++) { g.set(x, y, G.SOIL); g.extra.set(g.i(x, y), crop); g.keep[g.i(x, y)] = 1; }
    for (let x = l.x - 1; x <= l.x + l.tw; x++) if (g.free(x, l.y - 1, 1, 1)) g.sprite(prop("fence", "h"), x, l.y - 1, 1, 1, { dy: 0 });
    for (const x of [l.x - 1, l.x + l.tw]) for (let y = l.y; y < l.y + l.th; y++) if (g.free(x, y, 1, 1) && (y !== l.y + l.th - 1 || x !== l.x - 1)) g.sprite(prop("fence", "v"), x, y, 1, 1, { dy: 0 });
    if (g.free(l.x + l.tw + 1, l.y, 1, 1)) g.sprite(prop("scarecrow"), l.x + l.tw + 1, l.y);
  });
}

function decorateSettle(g: Gen) {
  const bg = g.scene.bg, s = g.seed;
  // fill the remaining lots with houses
  const looks: BStyle[] = bg === "village" ? ["cottage", "house", "hut", "barn", "house"] : bg === "castle" ? ["stable", "smith", "tower", "house"] : ["house", "shop", "house", "manor", "smith", "house", "inn"];
  g.doorSlots.forEach((d, k) => {
    if (d.used) return;
    const style = d.style ?? looks[(bg === "castle" ? k : k + s) % looks.length];
    const [tw, th] = [Math.min(d.tw, style === "keep" ? 7 : 5), Math.min(d.th, style === "keep" ? 4 : 3)];
    const x0 = d.x + ((d.tw - tw) >> 1), y0 = d.y + d.th - th;
    if (!g.free(x0, y0, tw, th, () => true) && !g.doorSlots.includes(d)) return;
    const img = buildingSprite({ style, tw: tw % 2 ? tw : tw - 1, th, lit: g.lit && cell(k, 1, s) > 0.25, seed: (s + d.x * 31 + d.y * 7) >>> 0, snow: g.scene.weather === "snow", closed: true });
    g.put({ x: (x0 + tw / 2) * TW, y: (y0 + th) * TW, img, s: 2, fade: true }, x0, y0, tw, th);
    houseExtras(g, style, x0, y0, tw, th, img);
  });
  const road = bg === "village" ? G.DIRT : bg === "castle" ? G.FLAG : G.COBBLE;
  // props by the houses and along the roads
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const i = g.i(x, y), gg = g.gnd[i];
    if (g.keep[i] || g.block[i]) continue;
    const h = cell(x, y, s + 21), nearRoad = DIR4.some(([dx, dy]) => g.get(x + dx, y + dy) === road || g.get(x + dx, y + dy) === G.COBBLE);
    const nearHouse = g.block[g.i(x, y - 1)] && !g.keep[g.i(x, y - 1)];
    if (gg === G.WALL || gg === G.GATE) continue;
    if (nearHouse && h < 0.22) { g.sprite(prop(["barrel", "crates", "woodpile", "pot", "hay"][Math.floor(h * 22) % 5]), x, y); continue; }
    if (nearRoad && (bg === "town" || bg === "city") && (x * 7 + y * 3) % 9 === 0 && h < 0.6) { const o = g.sprite(prop("lamp"), x, y); g.lights.push({ x: o.x, y: o.y - 44, r: 56, col: "#ffd890", on: "dark", glow: 0.45, flick: 0.15 }); continue; }
    if (bg === "castle" && h < 0.03 && (nearHouse || x < 4 || x > g.w - 5)) { g.sprite(prop(["rack", "dummy", "hay", "barrel"][Math.floor(h * 80) % 4]), x, y); continue; }
    if (gg === G.GRASS || gg === G.FLOWER) {
      const edge = Math.min(x, y, g.w - 1 - x, g.h - 1 - y);
      const dens = bg === "village" ? 0.2 : bg === "town" ? 0.08 : 0.04;
      const d = dens * (0.5 + fbm(x / 5, y / 5, s) * 1.2) + (edge < 3 && bg === "village" ? 0.3 : 0);
      if (h < d && !nearRoad) { if (bg === "city" || bg === "castle") g.sprite(prop("bush", "#3f8a3a", x), x, y, 1, 1, { soft: true }); else g.tree(x, y, cell(x, y, 3) > 0.8 ? "pine" : "tree", (x + y) % 3, cell(x, y, 3) > 0.8 ? PINE : undefined); continue; }
      if (h < d + 0.04 && !nearRoad) { g.sprite(prop("bush", "#3f8a3a", x + y), x, y, 1, 1, { soft: true }); continue; }
      if (cell(x, y, s + 5) < 0.18 && g.scene.weather !== "snow") g.set(x, y, G.FLOWER);
    }
  }
  if (bg === "village") farmPlots(g, 2);
  if (bg === "town" || bg === "city") {
    // market stalls around the square
    const cands = g.objSlots.slice(1).filter((p) => g.free(p.x, p.y, 2, 1) && !g.npcSlots.some((q) => q.x === p.x && q.y === p.y));
    cands.slice(0, bg === "city" ? 3 : 2).forEach((p) => g.sprite(prop("stall"), p.x, p.y, 2, 1));
  }
  // the centre piece of the square, if nothing took it
  if (g.free(g.hub.x, g.hub.y, 1, 1)) {
    if (bg === "village") g.sprite(prop("well"), g.hub.x, g.hub.y);
    else if (g.free(g.hub.x, g.hub.y, 2, 2)) { const o = g.sprite(prop("fountain"), g.hub.x, g.hub.y, 2, 2); g.emit.push({ x: o.x, y: o.y - 40, kind: "spray", acc: 0 }); }
  }
  if (bg === "town" || bg === "village") { const p = g.nearFree({ x: g.hub.x - 3, y: g.hub.y - 2 }, (x, y) => g.free(x, y, 1, 1)); if (p) g.sprite(prop("notice"), p.x, p.y); }
  // banners on the city wall, towers and torches by the gates
  if (bg === "city" || bg === "castle") {
    const isGate = (x: number, y: number) => g.get(x, y) === G.GATE && (y <= 2 || y >= g.h - 1 || x <= 0 || x >= g.w - 1);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== G.WALL) continue;
      const row = y <= 2 || y >= g.h - 1;
      const nextTo = row ? isGate(x - 1, y) || isGate(x + 1, y) : isGate(x, y - 1) || isGate(x, y + 1);
      if (!nextTo || (y <= 2 && y !== 2)) continue;
      g.put({ x: x * TW + TW / 2, y: (y + 1) * TW - 1, img: prop("gatepost", bg === "castle" ? "#9a968c" : "#a8a294"), s: 2, fade: true }, x, y, 1, 1, true);
    }
    for (let x = 2; x < g.w - 2; x += 5) if (g.get(x, 2) === G.WALL && g.get(x, 3) !== G.WALL) g.put({ x: x * TW + TW / 2, y: 2 * TW + 20, img: prop("banner", bg === "castle" ? "#2a4a8a" : "#8a1e2a"), s: 2, flat: true }, x, 2, 1, 1, true);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== G.WALL) continue;
      const nextGate = DIR4.some(([dx, dy]) => g.get(x + dx, y + dy) === G.GATE);
      if (nextGate && cell(x, y, 9) > 0.3 && (y === 2 || y === g.h - 1 || x === 0 || x === g.w - 1)) wallTorch(g, x, y);
    }
    // round towers at the corners of the curtain wall
    const ct = cornerTower(`${bg === "castle" ? "#9a968c" : "#a8a294"}|${g.lit ? 1 : 0}`);
    for (const [x, y] of [[0, 0], [g.w - 2, 0], [0, g.h - 3], [g.w - 2, g.h - 3]] as const) g.put({ x: (x + 1) * TW, y: (y + 3) * TW + (y ? 0 : 0), img: ct, s: 2, fade: y > 0 }, x, y, 2, 3, true);
  }
  if (bg === "castle") {
    const wp = g.nearFree({ x: g.hub.x + 3, y: g.hub.y - 2 }, (x, y) => g.free(x, y, 1, 1) && g.get(x, y) !== G.FLAG, 4);
    if (wp) g.sprite(prop("well"), wp.x, wp.y);
    // flower beds and hedges along the keep, hay and a cart by the stables, a training ground
    for (const dx of [-6, 5]) for (let k = 0; k < 2; k++) { const x = g.hub.x + dx + k, y = 7; if (g.free(x, y - 1, 1, 1)) g.sprite(prop("bush", "#3f8a3a", x + k), x, y - 1, 1, 1, { dy: 1 }); }
    for (const [x, y] of [[3, 5], [4, 5], [g.w - 5, 5], [g.w - 4, 5]] as const) if (g.free(x, y, 1, 1)) g.sprite(prop("flowers"), x, y);
    const yard = findLots(g, { x: 5, y: g.h - 6 }, [[4, 3]], 1, (x, y, w, h) => g.free(x, y, w, h), 1)[0];
    if (yard) { g.sprite(prop("dummy"), yard.x, yard.y); g.sprite(prop("dummy"), yard.x + 2, yard.y); g.sprite(prop("rack"), yard.x + 3, yard.y + 1); g.sprite(prop("hay"), yard.x, yard.y + 2); }
    for (const [x, y] of [[g.w - 4, g.h - 4], [g.w - 5, g.h - 4]] as const) if (g.free(x, y, 1, 1)) g.sprite(prop(x % 2 ? "barrel" : "crates"), x, y);
  }
}
/** A round tower of the curtain wall, crenellated, seen from the courtyard (32 x 48). */
const cornerTower = memo((k: string) => {
  const [st, lit] = k.split("|");
  const [c, p] = art(32, 48);
  softShadow(p, 16, 46, 14, 2);
  towerArt(p, 3, 10, 26, 46, { stone: st, lit: lit === "1", seed: 7, slits: true });
  return c;
});

function wallTorch(g: Gen, x: number, y: number) {
  const wx = x * TW + TW / 2, wy = y * TW + 6;
  g.put({ x: wx, y: wy + 20, img: prop("torch"), s: 2, flat: true, dy: 0, live: torchLive }, x, y, 1, 1, true);
  g.lights.push({ x: wx, y: wy + 14, r: 118, col: "#ffa850", flick: 1, on: "always", glow: 0.55 });
  g.emit.push({ x: wx, y: wy + 2, kind: "embers", acc: Math.random() * 500 });
}

function decorateInterior(g: Gen) {
  const v = g.ivar, s = g.seed, cx = g.hub.x, cy = g.hub.y, W = g.w, Hh = g.h;
  const usedX = new Set(g.doorSlots.filter((d) => d.used && d.wall === "n").map((d) => d.x));
  const north = g.exits.has("north");
  /** Is the back wall free over these columns (no door, no way out)? */
  const wallFree = (x0: number, x1 = x0) => { for (let x = x0; x <= x1; x++) if (usedX.has(x) || x < 1 || x > W - 2 || (north && Math.abs(x - cx) <= 1)) return false; return true; };
  /** A flat piece hung on the back wall face, centred on a world x; `bottom` is its bottom in world px. */
  const onWall = (img: HTMLCanvasElement, wx: number, bottom: number, extra: Partial<Obj> = {}) => g.put({ x: wx, y: bottom, img, s: 2, flat: true, ...extra }, Math.floor(wx / TW), 2, 1, 1, true);
  const midX = (x0: number, x1: number) => ((x0 + x1 + 1) / 2) * TW;
  /** Furniture standing on free floor. */
  const put = (img: HTMLCanvasElement, x: number, y: number, fw = 1, fh = 1, o: Partial<Obj> & { walkable?: boolean } = {}) => (g.free(x, y, fw, fh) ? g.sprite(img, x, y, fw, fh, o) : null);
  const light = (x: number, y: number, r: number, col: string, flick = 0.6, glow = 0.35) => g.lights.push({ x, y, r, col, flick, on: "always", glow });
  /** A table with chairs round it; north and side chairs are seats for patrons. */
  const tableSet = (x: number, y: number, tw: number, o: { north?: boolean; south?: boolean; sides?: boolean; round?: boolean; wood?: string } = {}) => {
    const t = o.round ? put(fur("roundtable", s + x * 3 + y), x, y, 1, 1, { dy: 4, live: flamesLive("roundtable") }) : put(fur("table", tw, s + x * 3 + y), x, y, tw, 1, { dy: 4, live: flamesLive(`table${tw}`) });
    if (!t) return;
    light(t.x, t.y - 34, 46, "#ffc870", 0.7, 0.32);
    const chair = (cxx: number, cyy: number, f: string, facing: Facing, dy: number) => {
      const c = put(fur("chair", f, o.wood ?? ""), cxx, cyy, 1, 1, { dy: f === "u" ? 1 : 8 });
      if (c && f !== "u") g.seats.push({ x: cxx, y: cyy, facing, dy });
    };
    if (o.north !== false) for (let k = 0; k < tw; k++) chair(x + k, y - 1, "d", "down", -12);
    if (o.sides !== false) { chair(x - 1, y, "r", "right", -8); chair(x + tw, y, "l", "left", -8); }
    if (o.south) for (let k = 0; k < tw; k++) chair(x + k, y + 1, "u", "up", 0);
  };
  const overhead = (img: HTMLCanvasElement, x: number, y: number, kind: string, lightCol = "#ffc870") => {
    const o = g.put({ x: x * TW + TW / 2, y: (y + 1) * TW, img, s: 2, over: true, live: flamesLive(kind) }, x, y, 1, 1, true);
    light(o.x, o.y - 30, 120, lightCol, 0.5, 0.3);
  };
  const hearthAt = (wx: number, big: boolean) => {
    const img = big ? fur("hearth") : fur("fireplace");
    onWall(img, wx, 3 * TW + 4, { live: big ? hearthLive : fireplaceLive });
    light(wx, 3 * TW - 6, big ? 190 : 150, "#ff9a4a", 1, 0.5);
    g.emit.push({ x: wx, y: 3 * TW - 16, kind: "embers", acc: 0 }, { x: wx + 1, y: 3 * TW - 40, kind: "steam", acc: 0 });
  };
  switch (v) {
    case "tavern": {
      // the bar: shelves of bottles, kegs on a cradle, stools along the counter
      if (wallFree(15, 17)) onWall(fur("backbar", s % 7), midX(15, 17), 2 * TW + 28);
      put(fur("kegs"), 19, 3, 2, 1, { dy: 2 });
      put(fur("barrels"), 15, 3, 1, 1, { dy: 2 });
      if (wallFree(19)) onWall(fur("lanternwall"), 19 * TW + 4, 2 * TW + 18);
      for (const x of [15, 16, 18, 19]) put(fur("stool"), x, 6, 1, 1, { dy: 4 });
      light(17 * TW, 4 * TW, 110, "#ffb860", 0.5, 0.3);
      // the hearth with chairs round a rug, a staircase in the corner
      if (wallFree(6, 8)) { hearthAt(midX(6, 8), true); g.sprite(fur("rug", 3, 0), 6, 4, 3, 2, { flat: true, walkable: true, dy: 2 }); put(fur("armchair", "r"), 5, 5, 1, 1, { dy: 3 }); put(fur("armchair", "l"), 9, 5, 1, 1, { dy: 3 }); put(fur("woodbin"), 9, 3, 1, 1, { dy: 3 }); }
      if (!g.hasStairs && g.free(1, 3, 2, 3)) g.sprite(fur("stairs"), 1, 3, 2, 3, { flat: true, dy: 0 });
      else put(fur("barrels"), 1, 3, 2, 1, { dy: 2 });
      // tables
      tableSet(2, 11, 2); tableSet(6, 11, 2); tableSet(14, 11, 2, { south: true }); tableSet(18, 11, 1, { round: true });
      tableSet(3, 7, 1, { round: true, north: false });
      put(fur("barrels"), 1, 13, 2, 1, { dy: 2 }); put(fur("crates"), 20, 13, 1, 1, { dy: 2 }); put(fur("sacks"), 19, 13, 1, 1, { dy: 2 }); put(fur("plant"), 9, 13, 1, 1, { dy: 2 });
      put(fur("bench", 2), 6, 13, 2, 1, { dy: 4 });
      // the walls
      if (wallFree(10)) onWall(fur("painting", s % 3), 10 * TW, 2 * TW + 24);
      if (wallFree(12)) onWall(fur("antlers"), 12 * TW + TW, 2 * TW + 14);
      for (const x of [5, 14]) if (wallFree(x)) onWall(fur("lanternwall"), x * TW + TW / 2, 2 * TW + 18);
      if (wallFree(3)) onWall(fur("window", g.lit ? 1 : 0, "#7a2a2a"), 3 * TW + TW / 2, 2 * TW + 26, { live: windowLive(g) });
      overhead(fur("chandelier"), cx, 6, "chandelier");
      overhead(fur("chandelier"), cx, 9, "chandelier");
      break;
    }
    case "shop": {
      for (const x of [10, 11, 13, 14]) put(fur("goodsshelf", s + x), x, 3, 1, 1, { dy: 2 });
      for (const x of [1, 2, 3]) put(fur("goodsshelf", s + x * 5), x, 3, 1, 1, { dy: 2 });
      if (wallFree(6, 7)) onWall(fur("weaponwall"), 7 * TW, 2 * TW + 24);
      put(fur("display", 0), 2, 5, 2, 1, { dy: 3 });
      put(fur("armorstand"), 5, 4, 1, 1, { dy: 2 });
      put(fur("display", 1 + (s % 2)), 2, 9, 2, 1, { dy: 3 });
      put(fur("barrels"), 1, 10, 1, 1, { dy: 2 }); put(fur("sacks"), 4, 10, 1, 1, { dy: 2 }); put(fur("crates"), 14, 10, 1, 1, { dy: 2 });
      put(fur("display", 2), 11, 9, 2, 1, { dy: 3 }); put(fur("plant"), 14, 9, 1, 1, { dy: 2 }); put(fur("chest"), 6, 10, 1, 1, { dy: 2 });
      g.sprite(fur("rug", 3, 4), cx - 1, cy + 2, 3, 2, { flat: true, walkable: true, dy: 2 });
      if (wallFree(12)) onWall(fur("painting", 1), 12 * TW + TW / 2, 2 * TW + 22);
      if (wallFree(9)) onWall(fur("window", g.lit ? 1 : 0, "#3a5a7a"), 9 * TW + TW / 2, 2 * TW + 26, { live: windowLive(g) });
      overhead(fur("hanglantern"), 4, 7, "none"); overhead(fur("hanglantern"), 12, 7, "none");
      light(12 * TW, 4 * TW, 90, "#ffc870");
      break;
    }
    case "house": {
      if (wallFree(3, 4)) { hearthAt(4 * TW, false); g.sprite(fur("rug", 3, 1), 2, 4, 3, 2, { flat: true, walkable: true, dy: 2 }); put(fur("armchair", "r"), 1, 5, 1, 1, { dy: 3 }); put(fur("loom"), 5, 4, 1, 1, { dy: 2 }); put(fur("woodbin"), 1, 3, 1, 1, { dy: 2 }); }
      put(fur("bed", s % 5), 13, 3, 1, 2, { dy: 2 }); put(fur("bed", (s + 2) % 5), 14, 3, 1, 2, { dy: 2 });
      put(fur("chest"), 13, 5, 1, 1, { dy: 2 }); put(fur("cupboard"), 10, 3, 1, 1, { dy: 2 }); put(fur("plant"), 12, 3, 1, 1, { dy: 2 });
      tableSet(2, 9, 2, { south: true });
      put(fur("kitchen"), 11, 9, 2, 1, { dy: 2 }); put(fur("barrels"), 14, 9, 1, 2, { dy: 2 }); put(fur("sacks"), 13, 10, 1, 1, { dy: 2 });
      if (wallFree(7)) onWall(fur("window", g.lit ? 1 : 0, "#3a6a4a"), 7 * TW + TW / 2, 2 * TW + 26, { live: windowLive(g) });
      if (wallFree(9)) onWall(fur("window", g.lit ? 1 : 0, "#3a6a4a"), 9 * TW + TW / 2, 2 * TW + 26, { live: windowLive(g) });
      if (wallFree(6)) onWall(fur("painting", s % 3), 6 * TW, 2 * TW + 22);
      overhead(fur("hanglantern"), 3, 8, "none");
      break;
    }
    case "guild": {
      for (const x of [15, 16]) put(fur("bookcase", s + x), x, 3, 1, 1, { dy: 2 });
      put(fur("chest"), 19, 3, 1, 1, { dy: 2 }); put(fur("barrels"), 20, 3, 2, 1, { dy: 2 });
      if (wallFree(18)) onWall(fur("mapwall"), 18 * TW + TW / 2, 2 * TW + 22);
      if (wallFree(5, 6)) onWall(fur("noticeboard", s % 9), 6 * TW, 2 * TW + 26);
      if (wallFree(8, 9)) { hearthAt(9 * TW, false); put(fur("armchair", "r"), 7, 4, 1, 1, { dy: 3 }); put(fur("armchair", "l"), 10, 4, 1, 1, { dy: 3 }); }
      for (const [x, k] of [[2, 0], [13, 1], [22, 1]] as const) if (wallFree(x)) onWall(fur("trophy", k + s), x * TW + TW / 2, 2 * TW + 16);
      if (wallFree(4)) onWall(fur("shieldx", s % 5), 4 * TW + TW / 2, 2 * TW + 22);
      put(fur("armorstand"), 1, 5, 1, 1, { dy: 2 }); put(fur("armorstand"), 22, 6, 1, 1, { dy: 2 });
      g.sprite(prop("rack"), 1, 7, 1, 1, { dy: 2 });
      // long tables with benches and adventurers
      for (const x0 of [3, 15]) {
        const t = put(fur("longtable", 4, s + x0), x0, 12, 4, 1, { dy: 4 });
        if (!t) continue;
        light(t.x, t.y - 30, 70, "#ffc870", 0.6, 0.3);
        if (put(fur("bench", 4), x0, 11, 4, 1, { dy: 8 })) for (let k = 0; k < 4; k++) g.seats.push({ x: x0 + k, y: 11, facing: "down", dy: -8 });
        put(fur("bench", 4), x0, 13, 4, 1, { dy: 1 });
      }
      put(fur("barrels"), 1, 13, 1, 1, { dy: 2 }); put(fur("crates"), 22, 13, 1, 1, { dy: 2 });
      g.sprite(fur("rug", 3, 1), cx - 1, cy + 2, 3, 2, { flat: true, walkable: true, dy: 2 });
      overhead(fur("chandelier"), cx, 6, "chandelier"); overhead(fur("chandelier"), cx, 12, "chandelier");
      break;
    }
    case "throne": {
      // the red carpet from the door to the steps
      for (let y = 5; y < Hh - 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (g.get(x, y) !== G.WALL) g.set(x, y, G.CARPET);
      for (const x of [cx - 3, cx + 3]) { const o = put(fur("brazier"), x, 3, 1, 1, { dy: 2 }); if (o) { light(o.x, o.y - 24, 120, "#ffa850", 1, 0.5); g.emit.push({ x: o.x, y: o.y - 26, kind: "embers", acc: 0 }); } }
      for (const x of [cx - 4, cx + 4]) put(fur("banner", 1, x < cx ? "#8a1e2a" : "#2a4a8a"), x, 3, 1, 1, { dy: 10, walkable: true });
      // columns with torches down both sides
      for (const y of [6, 9, 13, 16]) for (const x of [cx - 5, cx + 5]) { const o = put(fur("pillar", 1, "#c8c0b0"), x, y, 1, 1, { dy: 0, live: flamesLive("pillar") }); if (o) { light(o.x, o.y - 66, 90, "#ffa850", 1, 0.45); } }
      for (const y of [6, 13]) for (const x of [1, W - 2]) put(fur("armor"), x, y, 1, 1, { dy: 2 });
      // tapestries and banners on the back wall
      for (let x = 2; x < W - 2; x += 3) {
        if (Math.abs(x - cx) < 5 || !wallFree(x, x + 1)) continue;
        onWall(x % 2 ? fur("tapestry", x, "#7a1e2a") : fur("tapestry", x + 1, "#2a3a7a"), (x + 1) * TW, 2 * TW + 30);
      }
      if (wallFree(cx - 1, cx + 1)) onWall(fur("shieldx", 1), (cx + 0.5) * TW, 2 * TW + 16);
      // side tables for a feast and plants
      put(fur("longtable", 4, s), 2, 15, 4, 1, { dy: 4 }); put(fur("longtable", 4, s + 3), W - 6, 15, 4, 1, { dy: 4 });
      put(fur("vase"), 4, 9, 1, 1, { dy: 2 }); put(fur("vase"), W - 5, 9, 1, 1, { dy: 2 });
      overhead(fur("chandelier"), cx, 8, "chandelier"); overhead(fur("chandelier"), cx, 14, "chandelier");
      break;
    }
    case "temple": {
      for (let y = 5; y < Hh - 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (g.get(x, y) !== G.WALL) g.set(x, y, G.CARPET);
      for (const x of [cx - 4, cx + 4]) put(fur("saint", 0, "#e0d8c8"), x, 3, 1, 1, { dy: 2 });
      for (const x of [cx - 3, cx + 3]) { const o = put(fur("candelabra"), x, 4, 1, 1, { dy: 2, live: flamesLive("candelabra") }); if (o) light(o.x, o.y - 56, 70, "#ffd890", 0.6, 0.4); }
      put(fur("vase"), cx - 2, 3, 1, 1, { dy: 4 }); put(fur("vase"), cx + 2, 3, 1, 1, { dy: 4 });
      for (const y of [6, 8, 12, 14]) for (const x of [cx - 8, cx - 5, cx + 2, cx + 5]) {
        if (put(fur("pew", 3), x, y, 3, 1, { dy: 2 })) for (let k = 0; k < 3; k++) g.seats.push({ x: x + k, y, facing: "up", dy: -4 });
      }
      for (const y of [7, 13]) for (const x of [1, W - 2]) put(fur("pillar", 0, "#e8e2d4"), x, y, 1, 1, { dy: 0 });
      for (const x of [cx - 3, cx + 3]) put(fur("font"), x, Hh - 3, 1, 1, { dy: 3 });
      for (const x of [2, 5, W - 6, W - 3]) if (wallFree(x)) {
        onWall(fur("stained", x), x * TW + TW / 2, 2 * TW + 30, { live: stainedLive(g, x) });
        g.lights.push({ x: x * TW + TW / 2 + 20, y: 4 * TW + 10, r: 70, col: ["#c85a8a", "#5a8ae0", "#e0b040", "#5ac08a"][x % 4], on: "always", glow: 0.2 });
      }
      put(fur("incense"), cx + 2, 5, 1, 1, { dy: 6, walkable: true });
      break;
    }
  }
}

function decorateUnder(g: Gen) {
  const bg = g.scene.bg, s = g.seed;
  if (bg === "dungeon") dungeonRooms(g);
  for (let y = 2; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const i = g.i(x, y), gg = g.gnd[i];
    // wall dressings on faces (a wall with floor under it and wall above)
    if (gg === G.WALL && !UNWALK.has(g.get(x, y + 1)) && g.get(x, y - 1) === G.WALL && !g.extra.has(i)) {
      const h = cell(x, y, s + 31);
      if (g.objs.some((o) => o.flat && o.tiles.includes(i))) continue;
      if (h < (bg === "dungeon" ? 0.2 : 0.12) && x % 2 === 0) wallTorch(g, x, y - 1);
      else if (bg === "dungeon" && h < 0.27) g.put({ x: x * TW + TW / 2, y: y * TW + 22, img: prop("chains"), s: 2, flat: true }, x, y, 1, 1, true);
      continue;
    }
    if (UNWALK.has(gg) || g.keep[i] || g.block[i]) continue;
    const h = cell(x, y, s + 41);
    const wallNear = DIR4.some(([dx, dy]) => g.get(x + dx, y + dy) === G.WALL);
    if (bg === "cave") {
      if (wallNear && h < 0.16) g.tree(x, y, "stalagmite", (x + y) % 3, ["#2a221e", "#6a5a4e", "#9a8a7a", "#4a3a2e"]);
      else if (h < 0.04) { g.tree(x, y, "crystal", x % 2, ["#2a4a8a", "#5a8ae0", "#c8e8ff", "#6a3ab0"]); g.lights.push({ x: x * TW + 16, y: y * TW + 6, r: 60, col: "#7ab0ff", on: "always", glow: 0.35, flick: 0.2 }); }
      else if (h < 0.08) { g.sprite(prop("glowshroom"), x, y, 1, 1, { flat: true, walkable: true, dy: 6 }); g.lights.push({ x: x * TW + 16, y: y * TW + 20, r: 34, col: "#5ad8c8", on: "always", glow: 0.3 }); }
      else if (h < 0.11) g.sprite(prop("rock", "#6a5a50", x), x, y, 1, 1, { soft: true });
    } else if (bg === "dungeon") {
      if (wallNear && h < 0.06) g.sprite(prop(["barrel", "crates", "barrel"][x % 3]), x, y);
      else if (h < 0.05) g.sprite(prop("bones"), x, y, 1, 1, { flat: true, walkable: true, dy: 8 });
      else if (h < 0.07) g.sprite(prop("rock", "#5a5860", x), x, y, 1, 1, { soft: true });
    } else {
      if (wallNear && h < 0.1 && (x + y) % 3 === 0) { const o = g.sprite(prop("lantern2"), x, y); g.lights.push({ x: o.x, y: o.y - 24, r: 70, col: "#ffb860", flick: 0.6, on: "always", glow: 0.4 }); }
      else if (h < 0.06) g.sprite(prop("rock", "#6a5a50", x), x, y, 1, 1, { soft: true });
      else if (h < 0.08) g.sprite(prop("crates"), x, y);
      else if (h < 0.1) g.sprite(prop("bones"), x, y, 1, 1, { flat: true, walkable: true, dy: 8 });
    }
  }
  if (bg === "dungeon") {
    for (const [dx, dy] of [[-3, -2], [3, -2]] as const) if (g.free(g.hub.x + dx, g.hub.y + dy, 1, 1)) { const o = g.sprite(prop("brazier"), g.hub.x + dx, g.hub.y + dy); g.lights.push({ x: o.x, y: o.y - 20, r: 100, col: "#ffa040", flick: 1, on: "always", glow: 0.5 }); g.emit.push({ x: o.x, y: o.y - 26, kind: "embers", acc: 0 }); }
  }
  if (bg === "cave") g.emit.push({ x: g.hub.x * TW, y: g.hub.y * TW - 60, kind: "drip", acc: 0 });
}

/** Dungeon rooms: cells along the walls, archways where corridors come in, and a use for each room. */
function dungeonRooms(g: Gen) {
  const s = g.seed;
  const W = (x: number, y: number) => g.get(x, y) === G.WALL;
  // archways where a corridor passes through a room's north wall
  for (let y = 3; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    if (g.get(x, y) !== G.CAVE || g.get(x, y + 1) !== G.FLAG || !W(x - 1, y) || !W(x + 1, y) || !W(x - 1, y - 1) || !W(x + 1, y - 1)) continue;
    g.put({ x: x * TW + TW / 2, y: (y + 1) * TW, img: fur("archway"), s: 2, flat: true }, x, y, 1, 1, true);
  }
  g.rooms.forEach((q, k) => {
    const theme = k === 0 ? "hall" : ["prison", "guard", "store", "crypt", "prison"][(k + s) % 5];
    const free = (x: number, y: number, w = 1, h = 1) => g.free(x, y, w, h) && g.get(x, y) === G.FLAG;
    if (theme === "prison" || (theme === "hall" && q.w >= 9)) {
      // cells let into the north wall, barred
      for (let x = q.x + 1; x + 1 < q.x + q.w - 1; x += 3) {
        let ok = true;
        for (let yy = q.y - 4; yy <= q.y - 1 && ok; yy++) for (let xx = x - 1; xx <= x + 2 && ok; xx++) if (!W(xx, yy) || g.keep[g.i(xx, yy)] || g.extra.has(g.i(xx, yy)) || g.block[g.i(xx, yy)]) ok = false;
        for (const xx of [x, x + 1]) if (g.keep[g.i(xx, q.y)] || g.block[g.i(xx, q.y)]) ok = false;
        if (!ok) continue;
        g.rect(x, q.y - 2, 2, 2, G.FLAG);
        g.put({ x: (x + 1) * TW, y: q.y * TW, img: fur("cellbars"), s: 2 }, x, q.y - 1, 2, 1);
        g.put({ x: (x + 1) * TW, y: (q.y - 1) * TW + 4, img: fur("straw", x), s: 2, flat: true }, x, q.y - 2, 2, 1);
        if (cell(x, q.y, s) > 0.4) g.put({ x: x * TW + TW / 2 + (cell(x, 1, s) > 0.5 ? TW : 0), y: (q.y - 1) * TW - 2, img: fur("skeleton"), s: 2, flat: true }, x, q.y - 2, 1, 1);
        else g.put({ x: x * TW + TW, y: (q.y - 1) * TW + 8, img: prop("bones"), s: 2, flat: true }, x, q.y - 2, 1, 1);
        g.put({ x: x * TW + TW / 2, y: (q.y - 3) * TW + 22, img: prop("chains"), s: 2, flat: true }, x, q.y - 3, 1, 1, true);
        x += 1;
        if (theme === "hall") break;
      }
    }
    const spot = (fw = 1): Pt | null => {
      for (let t = 0; t < 30; t++) {
        const x = q.x + Math.floor(cell(t, k, s + 5) * q.w), y = q.y + Math.floor(cell(t, k, s + 6) * q.h);
        if (free(x, y, fw, 1)) return { x, y };
      }
      return null;
    };
    const at = (img: HTMLCanvasElement, fw = 1, o: Partial<Obj> & { walkable?: boolean } = {}) => { const p = spot(fw); return p ? g.sprite(img, p.x, p.y, fw, 1, { dy: 2, ...o }) : null; };
    // cobwebs in the upper corners
    if (W(q.x - 1, q.y - 1)) g.put({ x: q.x * TW + 16, y: (q.y - 1) * TW + 4, img: fur("cobweb"), s: 2, flat: true }, q.x, q.y - 1, 1, 1, true);
    if (W(q.x + q.w, q.y - 1) && cell(k, 2, s) > 0.4) g.put({ x: (q.x + q.w) * TW - 16, y: (q.y - 1) * TW + 4, img: fur("cobweb", "r"), s: 2, flat: true }, q.x + q.w - 1, q.y - 1, 1, 1, true);
    if (theme === "guard") {
      const p = spot(2);
      if (p && free(p.x, p.y, 2, 1)) {
        const t = g.sprite(fur("table", 2, s + k), p.x, p.y, 2, 1, { dy: 4, live: flamesLive("table2") });
        g.lights.push({ x: t.x, y: t.y - 34, r: 60, col: "#ffc870", flick: 0.7, on: "always", glow: 0.35 });
        for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1]] as const) if (free(p.x + dx, p.y + dy)) g.sprite(fur("stool"), p.x + dx, p.y + dy, 1, 1, { dy: 4 });
      }
      at(prop("rack")); at(fur("barrels")); at(fur("armorstand"));
    } else if (theme === "store") {
      at(fur("crates")); at(fur("barrels")); at(fur("sacks")); at(fur("crates")); at(prop("barrel"));
    } else if (theme === "crypt") {
      at(fur("sarcophagus"), 2, { dy: 3 }); at(fur("sarcophagus"), 2, { dy: 3 });
      const c = at(fur("candelabra"), 1, { live: flamesLive("candelabra") });
      if (c) g.lights.push({ x: c.x, y: c.y - 56, r: 70, col: "#ffd890", flick: 0.6, on: "always", glow: 0.4 });
      at(prop("bones"), 1, { flat: true, walkable: true, dy: 8 });
    } else if (theme === "prison") {
      at(prop("bones"), 1, { flat: true, walkable: true, dy: 8 }); at(fur("straw", k), 1, { flat: true, walkable: true, dy: 6 }); at(prop("rack"));
    }
    if (theme === "hall") for (const [x, y] of [[q.x + 1, q.y + 1], [q.x + q.w - 2, q.y + 1], [q.x + 1, q.y + q.h - 1], [q.x + q.w - 2, q.y + q.h - 1]] as const) {
      if (!free(x, y)) continue;
      const o = g.sprite(fur("pillar", 1, "#8a8694"), x, y, 1, 1, { dy: 0, live: flamesLive("pillar") });
      g.lights.push({ x: o.x, y: o.y - 66, r: 100, col: "#ffa850", flick: 1, on: "always", glow: 0.5 });
    }
    if (cell(k, 9, s) > 0.5) at(fur("puddle", 0), 1, { flat: true, walkable: true, dy: 8 });
  });
}

function decorateShip(g: Gen) {
  const cx = g.hub.x, cy = g.hub.y;
  for (const dx of [-4, 4]) if (g.get(cx + dx, cy - 1) === G.DECK && !g.block[g.i(cx + dx, cy - 1)]) g.put({ x: (cx + dx) * TW + TW / 2, y: cy * TW - 2, img: fur("mast"), s: 2, fade: true }, cx + dx, cy - 1, 1, 1);
  if (g.free(cx - 10, cy, 1, 1)) g.sprite(prop("wheel"), cx - 10, cy);
  const on = (dx: number, dy: number, img: HTMLCanvasElement, fw = 1, o: Partial<Obj> & { walkable?: boolean } = {}) => {
    const x = cx + dx, y = cy + dy;
    for (let k = 0; k < fw; k++) if (g.get(x + k, y) !== G.DECK) return null;
    return g.free(x, y, fw, 1) ? g.sprite(img, x, y, fw, 1, o) : null;
  };
  on(-7, -3, fur("barrels"), 2, { dy: 2 }); on(-7, 3, fur("crates"), 1, { dy: 2 }); on(-6, 3, fur("sacks")); on(6, 3, fur("barrels"), 2, { dy: 2 });
  on(1, -3, prop("rope")); on(9, 0, fur("capstan")); on(-11, -1, fur("bell"));
  on(-2, 3, prop("cannon")); on(2, 3, prop("cannon")); on(-1, -3, prop("cannon")); on(3, -3, prop("cannon"));
  on(5, -3, fur("nets"), 1, { flat: true, walkable: true, dy: 6 }); on(-3, 2, prop("rope"));
  for (const [dx, dy] of [[-10, -2], [10, 1], [-10, 2]] as const) { const o = on(dx, dy, prop("lamp")); if (o) g.lights.push({ x: o.x, y: o.y - 44, r: 60, col: "#ffd890", on: "dark", glow: 0.45, flick: 0.2 }); }
}

// ------------------------------------------------------------ live drawings (flames, sparkles...)
function flame(c: CanvasRenderingContext2D, x: number, y: number, t: number, size = 1) {
  const f = t / 70;
  const h = (7 + Math.sin(f) * 1.5 + Math.sin(f * 2.3) * 1) * size, w = 4.5 * size;
  const layers: [string, number, number][] = [["#d8401a", 1, 1], ["#ff8a2a", 0.75, 0.82], ["#ffd25a", 0.48, 0.6], ["#fff6c8", 0.22, 0.35]];
  for (const [col, sw, sh] of layers) {
    c.fillStyle = col;
    const hh = h * sh * 2, ww = w * sw * 2;
    for (let k = 0; k < hh; k += 2) {
      const tt = k / hh, wob = Math.sin(f * 1.7 + k * 0.6) * (1 - tt) * 1.2 * size;
      const ww2 = Math.max(1, Math.round(ww * (1 - tt * tt) * 0.5) * 2);
      c.fillRect(Math.round(x - ww2 / 2 + wob), Math.round(y - k - 2), ww2, 2);
    }
  }
}
function campfire(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  // stones and logs, then the flames
  c.fillStyle = "rgba(24,12,40,.3)"; c.beginPath(); c.ellipse(x, y + 1, 16, 5, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, sx = Math.round(x + Math.cos(a) * 12), sy = Math.round(y - 3 + Math.sin(a) * 4.5);
    c.fillStyle = k % 2 ? "#8a8a92" : "#9a9aa2"; c.fillRect(sx - 3, sy - 2, 6, 4); c.fillStyle = "#c0c0c8"; c.fillRect(sx - 3, sy - 2, 4, 1); c.fillStyle = "#4a4850"; c.fillRect(sx - 3, sy + 2, 6, 1);
  }
  c.fillStyle = "#6a4428"; c.fillRect(x - 9, y - 6, 18, 3); c.fillStyle = "#8a5a32"; c.fillRect(x - 7, y - 8, 14, 3);
  c.fillStyle = "#ff8a2a"; c.globalAlpha = 0.6 + Math.sin(t / 90) * 0.2; c.fillRect(x - 6, y - 5, 12, 2); c.globalAlpha = 1;
  flame(c, x, y - 6, t, 1.5);
  flame(c, x - 5, y - 6, t + 300, 0.8);
  flame(c, x + 5, y - 6, t + 650, 0.9);
}
function torchLive(c: CanvasRenderingContext2D, x: number, y: number, t: number) { flame(c, x, y - 26, t + x * 13, 0.7); }
/** Fire in a hearth sprite, with the cooking pot hung over it drawn back on top. */
function potFire(c: CanvasRenderingContext2D, x: number, y: number, t: number, big: boolean) {
  const w = big ? 22 : 14, k = big ? 1 : 0.75;
  c.fillStyle = `rgba(255,120,40,${0.22 + Math.sin(t / 130) * 0.05})`; c.fillRect(x - w, y - 36, w * 2, 30);
  flame(c, x - 9 * k, y - 8, t, 1.05 * k); flame(c, x + 9 * k, y - 8, t + 400, 0.95 * k); flame(c, x, y - 7, t + 200, 1.4 * k);
  const rx = big ? 10 : 8, ry = big ? 8 : 7, px = x + (big ? 1 : 0);
  c.fillStyle = "#1e1c24"; c.beginPath(); c.ellipse(px, y - 21, rx, ry, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#3a3842"; c.beginPath(); c.ellipse(px - 3, y - 23, rx * 0.45, ry * 0.4, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#4a4850"; c.fillRect(px - rx - 1, y - 29 - (big ? 1 : 0), rx * 2 + 2, 4);
  c.fillStyle = "#6a6870"; c.fillRect(px - rx + 1, y - 29 - (big ? 1 : 0), rx * 2 - 2, 1);
  c.fillStyle = "#8a6a3a"; c.fillRect(px - rx + 2, y - 30 - (big ? 1 : 0), rx * 2 - 4, 1);
  if (Math.floor(t / 300) % 3 === 0) { c.fillStyle = "#c89a5a"; c.fillRect(px - 3 + (Math.floor(t / 300) % 5), y - 31, 2, 1); }
}
function hearthLive(c: CanvasRenderingContext2D, x: number, y: number, t: number) { potFire(c, x, y, t, true); }
function fireplaceLive(c: CanvasRenderingContext2D, x: number, y: number, t: number) { potFire(c, x, y, t, false); }
/** A furniture sprite (native scale). */
const fur = (kind: string, a: string | number = "", b: string | number = "") => furniture(`${kind}|${a}|${b}`);
/** Candle and torch flames at the points a furniture sprite lists. */
function flamesLive(kind: string) {
  const pts = FLAMES[kind] ?? [];
  return (c: CanvasRenderingContext2D, x: number, y: number, t: number) => { for (const [dx, dy, sz] of pts) flame(c, x + dx * 2, y + dy * 2, t + dx * 97 + x * 7, sz); };
}
/** Coloured daylight falling from a stained-glass window. */
function stainedLive(g: Gen, seed: number) {
  const day = !g.lit;
  const cols = ["255,120,160", "120,160,255", "255,210,110", "120,230,160"];
  return (c: CanvasRenderingContext2D, x: number, y: number, t: number) => {
    const a = (day ? 0.13 : 0.06) + Math.sin(t / 2600 + seed) * 0.02;
    c.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      c.fillStyle = `rgba(${cols[(seed + k) % 4]},${a})`;
      const o = -10 + k * 7;
      c.beginPath(); c.moveTo(x + o, y - 30); c.lineTo(x + o + 7, y - 30); c.lineTo(x + o + 40, y + 70); c.lineTo(x + o + 30, y + 70); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = "source-over";
  };
}
function sparkleLive(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const k = Math.floor(t / 180) % 12;
  if (k < 3) { const sx = x - 8 + ((t / 500) % 1) * 4 + k * 6, sy = y - 26 + k * 2; c.fillStyle = "#fff6c0"; c.fillRect(sx, sy - 2, 1, 5); c.fillRect(sx - 2, sy, 5, 1); }
}
function markerLive(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const p = (Math.sin(t / 300) + 1) / 2;
  c.strokeStyle = `rgba(150,220,255,${0.5 + p * 0.4})`; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y, 11 + p * 2, 5 + p, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = "rgba(150,220,255,.18)"; c.beginPath(); c.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 3; k++) {
    const ph = ((t / 1400 + k / 3) % 1), sx = x + Math.sin(k * 2.1 + t / 600) * 7, sy = y - ph * 28;
    c.globalAlpha = 1 - ph; c.fillStyle = "#e0f6ff"; c.fillRect(Math.round(sx), Math.round(sy), 2, 2); c.globalAlpha = 1;
  }
  const bob = Math.round(Math.sin(t / 260) * 2);
  c.fillStyle = "#1a3a5a"; c.fillRect(x - 3, y - 36 + bob, 6, 11); c.fillRect(x - 3, y - 22 + bob, 6, 5);
  c.fillStyle = "#bfeaff"; c.fillRect(x - 2, y - 35 + bob, 4, 9); c.fillRect(x - 2, y - 21 + bob, 4, 3);
}
function lily(seed: number) {
  return (c: CanvasRenderingContext2D, x: number, y: number, t: number) => {
    const dx = Math.round(Math.sin(t / 1800 + seed) * 1.5);
    c.fillStyle = "#2f6a2a"; c.beginPath(); c.ellipse(x + dx + 1, y + 1, 7, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#4f9a35"; c.beginPath(); c.ellipse(x + dx, y, 7, 4, 0, 0.3, Math.PI * 2); c.fill();
    if (seed % 3 === 0) { c.fillStyle = "#f8b0d0"; c.fillRect(x + dx - 2, y - 3, 4, 3); c.fillStyle = "#fff3a0"; c.fillRect(x + dx - 1, y - 2, 2, 1); }
  };
}
function windowLive(g: Gen, coloured = false) {
  const day = !g.lit;
  return (c: CanvasRenderingContext2D, x: number, y: number, t: number) => {
    if (!day) return;
    // a shaft of daylight falling on the floor
    const a = 0.1 + Math.sin(t / 2400 + x) * 0.02;
    c.globalCompositeOperation = "lighter";
    c.fillStyle = coloured ? `rgba(255,200,150,${a})` : `rgba(255,240,200,${a})`;
    c.beginPath(); c.moveTo(x - 9, y - 18); c.lineTo(x + 9, y - 18); c.lineTo(x + 34, y + 60); c.lineTo(x + 6, y + 60); c.closePath(); c.fill();
    if (coloured) { c.fillStyle = `rgba(140,120,255,${a * 0.7})`; c.beginPath(); c.moveTo(x - 9, y - 18); c.lineTo(x, y - 18); c.lineTo(x + 18, y + 60); c.lineTo(x + 6, y + 60); c.closePath(); c.fill(); }
    c.globalCompositeOperation = "source-over";
  };
}

// ------------------------------------------------------------ the static ground
const FAMILY: Partial<Record<number, string>> = {
  [G.DIRT]: "dirt_road", [G.PATHSAND]: "sand_path", [G.COBBLE]: "cobble", [G.GATE]: "cobble", [G.FLAG]: "flagstone",
  [G.PLANK]: "plank_deck", [G.DECK]: "plank_deck", [G.CARPET]: "red_carpet", [G.MARBLE]: "mosaic", [G.PARQ]: "herringbone", [G.CHECK]: "checker",
};
const sameFam = (a: number, b: number) => a === b || (FAMILY[a] && FAMILY[a] === FAMILY[b]) || ((a === G.DIRT || a === G.PATHSAND) && b === G.BRIDGE);
const WALL_LOOK: Record<WallStyle, { face: string; kind: WallKind | "rock"; cap: string; trim: string }> = {
  stone: { face: "#6a6672", kind: "stone", cap: "#24222a", trim: "#8a8692" },
  rock: { face: "#6a5a4c", kind: "rock", cap: "#201a18", trim: "#8a7a6a" },
  wood: { face: "#d8c8a4", kind: "timber", cap: "#3a2a1e", trim: "#6a4428" },
  marble: { face: "#ddd6c6", kind: "stone", cap: "#6a6458", trim: "#f0ece0" },
  brick: { face: "#a8604a", kind: "brick", cap: "#3a2a26", trim: "#d8ccb8" },
  city: { face: "#a8a294", kind: "stone", cap: "#5e5a52", trim: "#c8c2b4" },
  hedge: { face: "#3f7a3a", kind: "rock", cap: "#2a5a2a", trim: "#5a9a4a" },
  palace: { face: "#b4a890", kind: "stone", cap: "#2e2620", trim: "#d8c080" },
};

function renderGround(a: Area): HTMLCanvasElement {
  const { w, h, gnd } = a;
  const [nat, p] = art(w * 16, h * 16);
  const c = p.g;
  const set = tileSet(a.biome);
  const sand = tileSet(a.biome.id === BIOMES.desert.id ? BIOMES.desert : EXTRA_BIOMES.beach);
  const swamp = tileSet(BIOMES.swamp);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : gnd[y * w + x]);
  const v = (x: number, y: number) => Math.floor(cell(x, y, 77) * 4);
  const tintCache = new Map<HTMLCanvasElement, HTMLCanvasElement>();
  const indoor = a.kind === "interior" || a.kind === "under";
  const landUnder = (x: number, y: number) => {
    const near = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
    if (a.kind === "ship") return null;
    if (near.includes(G.SAND) || a.bg === "coast" || a.bg === "sea" || a.bg === "desert") return sand.tiles[T.GROUND][v(x, y)];
    if (a.kind === "under") return set.tiles[T.GROUND][v(x, y)];
    return set.tiles[T.GROUND][v(x, y)];
  };
  // ---- ground and floors
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = gnd[y * w + x], X = x * 16, Y = y * 16, vv = v(x, y);
    if (g === G.VOID || g === G.WALL) { c.fillStyle = "#0c0a0e"; c.fillRect(X, Y, 16, 16); continue; }
    // the ship is drawn whole over the water afterwards
    if (a.kind === "ship" && (g === G.DECK || g === G.RAIL)) { c.drawImage(floorTile("deep_water", 255, 0, vv), X, Y); continue; }
    if (g === G.GRASS || g === G.FLOWER || g === G.ROCK || g === G.SOIL) c.drawImage(set.tiles[g === G.FLOWER ? T.DECOR : T.GROUND][vv], X, Y);
    else if (g === G.SAND) c.drawImage(sand.tiles[T.GROUND][vv], X, Y);
    else if (g === G.MUD) c.drawImage(swamp.tiles[T.SHALLOW][vv], X, Y);
    else if (g === G.CAVE) c.drawImage(set.tiles[T.GROUND][vv], X, Y);
    const fam = FAMILY[g];
    if (fam) {
      if (!indoor && a.kind !== "ship") { const u = landUnder(x, y); if (u) c.drawImage(u, X, Y); }
      let m = 0;
      DIR8.forEach(([dx, dy, bit]) => {
        const n = at(x + dx, y + dy);
        if (n === -1 || sameFam(g, n) || (indoor && (n === G.WALL || n === G.VOID)) || (a.kind === "ship" && n === G.RAIL)) m |= bit;
      });
      c.drawImage(floorTile(fam, m, 0, vv), X, Y);
    }
    if (g === G.SOIL) {
      c.fillStyle = "#6a4a2e"; c.fillRect(X, Y, 16, 16);
      for (let k = 2; k < 16; k += 4) { c.fillStyle = "#4e3420"; c.fillRect(X, Y + k, 16, 1); c.fillStyle = "#86603c"; c.fillRect(X, Y + k - 1, 16, 1); }
    }
    if (WATERY.has(g)) {
      const u = landUnder(x, y);
      if (u) c.drawImage(u, X, Y);
      let m = 0, same = 0;
      DIR8.forEach(([dx, dy, bit]) => {
        const n = at(x + dx, y + dy);
        if (n === -1 || WATERY.has(n) || (a.kind === "ship" && (n === G.RAIL || n === G.DECK))) m |= bit;
        if (bit < 16 && n === G.BRIDGE) same |= bit;
      });
      if (g === G.BRIDGE) {
        const lr = [at(x - 1, y), at(x + 1, y)], ud = [at(x, y - 1), at(x, y + 1)];
        const horiz = lr.some((n) => n === G.BRIDGE || (n >= 0 && !UNWALK.has(n))) && !ud.some((n) => n === G.BRIDGE);
        c.drawImage(floorTile("boardwalk", m, same | (horiz ? 256 : 0), vv), X, Y);
      } else {
        const type = g === G.DEEP ? "deep_water" : a.bg === "lake" && cell(x, y, 3) > 0.9 ? "lotus_water" : "pond_water";
        let tile = floorTile(type, m, 0, vv);
        if (a.murky) tile = tinted(tile, "#3a5a2a", 0.5, tintCache);
        if (a.kind === "under") tile = tinted(tile, "#1a2a3a", 0.35, tintCache);
        c.drawImage(tile, X, Y);
      }
    }
    if (g === G.ROCK && at(x, y + 1) !== G.ROCK) c.drawImage(set.wallFace, X, Y);
    if (g === G.ROCK && at(x, y + 1) === G.ROCK) c.drawImage(set.tiles[T.WALL][vv], X, Y);
    if (g === G.RAIL) {
      // ship's bulwark: a thick rail, the hull below it where water is under
      c.fillStyle = "#5a3a22"; c.fillRect(X, Y, 16, 16);
      c.fillStyle = "#8a5a32"; c.fillRect(X, Y + 2, 16, 6); c.fillStyle = "#a8703c"; c.fillRect(X, Y + 2, 16, 1);
      c.fillStyle = "#3a2414"; c.fillRect(X, Y + 8, 16, 1);
      if (WATERY.has(at(x, y + 1)) || at(x, y + 1) === -1) { for (let k = 9; k < 16; k += 3) { c.fillStyle = k % 2 ? "#4a2e18" : "#5a3a22"; c.fillRect(X, Y + k, 16, 3); } }
      else { c.fillStyle = "#9a6a3a"; c.fillRect(X, Y + 9, 16, 7); for (let k = 0; k < 16; k += 4) { c.fillStyle = "#6a4428"; c.fillRect(X + k, Y + 9, 1, 7); } }
    }
  }
  // ---- the ship: a smooth hull, a planked deck and bulwarks, opened where a gangway comes aboard
  if (a.kind === "ship") {
    const cxp = (w >> 1) * 16 + 8, cyp = (h >> 1) * 16 + 8, hl = SHIP.halfL * 16;
    drawShip(p, {
      cx: cxp, cy: cyp, halfL: hl, halfW: 1,
      deckOf: (u) => {
        if (Math.abs(u) > 1.06) return 0;
        let t = shipTaper(u);
        if (u < -0.55) { const k = Math.min(1, Math.max(0, (u + 0.95) / 0.4)); t = 0.8 + 0.2 * k * k * (3 - 2 * k); }
        if (u < -0.98) t *= Math.sqrt(Math.max(0.2, 1 - ((u + 0.98) / 0.09) ** 2));
        return t * SHIP.halfW * 16 + 7;
      },
    });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (gnd[y * w + x] !== G.DECK || !DIR4.some(([dx, dy]) => at(x + dx, y + dy) === G.BRIDGE)) continue;
      c.drawImage(floorTile("plank_deck", 255, 0, v(x, y)), x * 16, y * 16 - 4, 16, 22);
    }
  }
  // ---- crops
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (gnd[y * w + x] !== G.SOIL) continue;
    const crop = a.extra.get(y * w + x) ?? "wheat";
    try { c.drawImage(cropCanvas(crop, cell(x, y, 5) > 0.15 ? 3 : 2), x * 16, y * 16 - 3); } catch { /* unknown crop */ }
  }
  // ---- walls: caps, faces, doors
  const L = WALL_LOOK[a.wallStyle];
  const isW = (x: number, y: number) => at(x, y) === G.WALL || at(x, y) === -1;
  const floorAt = (x: number, y: number) => { const n = at(x, y); return n >= 0 && n !== G.WALL && n !== G.VOID; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (gnd[y * w + x] !== G.WALL) continue;
    const X = x * 16, Y = y * 16;
    const lower = floorAt(x, y + 1), upper = !lower && at(x, y + 1) === G.WALL && floorAt(x, y + 2);
    if (lower || upper) continue;
    // cap seen from above
    c.fillStyle = L.cap; c.fillRect(X, Y, 16, 16);
    if (a.wallStyle === "city") {
      c.fillStyle = hs(L.cap, 0.12);
      for (let k = 0; k < 16; k += 4) c.fillRect(X + k, Y + ((x + k) % 8 < 4 ? 0 : 2), 3, 3);
      c.fillStyle = hs(L.cap, -0.25); c.fillRect(X, Y + 13, 16, 3);
    } else if (a.wallStyle === "rock") {
      for (let k = 0; k < 6; k++) { c.fillStyle = hs(L.cap, (cell(x * 6 + k, y, 3) - 0.5) * 0.5); c.fillRect(X + Math.floor(cell(x, y * 6 + k, 4) * 13), Y + Math.floor(cell(x + k, y, 5) * 13), 3, 2); }
    } else {
      c.fillStyle = hs(L.cap, 0.08);
      for (let k = 0; k < 3; k++) c.fillRect(X + Math.floor(cell(x, y, k) * 12), Y + Math.floor(cell(y, x, k) * 12), 4, 1);
    }
    // rims where the wall meets open floor or a face
    for (const [dx, dy, side] of [[0, -1, "n"], [0, 1, "s"], [-1, 0, "w"], [1, 0, "e"]] as const) {
      const n = at(x + dx, y + dy);
      if (n === G.WALL || n === -1 || n === G.VOID) continue;
      c.fillStyle = side === "s" ? hs(L.cap, -0.4) : hs(L.trim, -0.1);
      if (side === "n") c.fillRect(X, Y, 16, 2);
      if (side === "s") c.fillRect(X, Y + 13, 16, 3);
      if (side === "w") c.fillRect(X, Y, 2, 16);
      if (side === "e") c.fillRect(X + 14, Y, 2, 16);
    }
  }
  // faces: runs along each row of "lower face" tiles
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const lowerAt = (xx: number) => at(xx, y) === G.WALL && floorAt(xx, y + 1);
      if (!lowerAt(x)) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < w && lowerAt(x1 + 1)) x1++;
      // split the run into pieces of the same height (two rows where the wall above is there too)
      let k = x;
      while (k <= x1) {
        const tall2 = isW(k, y - 1) && !floorAt(k, y - 1);
        let k1 = k;
        while (k1 + 1 <= x1 && (isW(k1 + 1, y - 1) && !floorAt(k1 + 1, y - 1)) === tall2) k1++;
        const top = tall2 ? (y - 1) * 16 : y * 16, hh = tall2 ? 32 : 16, X0 = k * 16, Wd = (k1 - k + 1) * 16;
        if (L.kind === "rock") rockFace(p, X0, top, Wd, hh, L.face, x + y);
        else if (a.wallStyle === "wood") {
          wallTex(p, X0, top, Wd, hh, L.face, "timber", 3);
          c.fillStyle = "#7a5030"; c.fillRect(X0, top + hh - 11, Wd, 11);
          for (let xx = X0; xx < X0 + Wd; xx += 4) { c.fillStyle = "#6a4428"; c.fillRect(xx, top + hh - 11, 1, 11); }
          c.fillStyle = "#9a6a3a"; c.fillRect(X0, top + hh - 12, Wd, 2);
        } else {
          wallTex(p, X0, top, Wd, hh, L.face, L.kind as WallKind, x * 3 + y);
          if (a.kind === "under" && hh > 16) dungeonFace(p, X0, top, Wd, hh, L.face, x * 7 + y);
        }
        c.fillStyle = L.trim; c.fillRect(X0, top, Wd, 2);
        c.fillStyle = hs(L.trim, 0.25); c.fillRect(X0, top, Wd, 1);
        c.fillStyle = "rgba(10,6,16,.45)"; c.fillRect(X0, top + hh - 1, Wd, 1);
        if (a.wallStyle === "city") for (let xx = X0; xx < X0 + Wd; xx += 6) { c.fillStyle = L.face; c.fillRect(xx, top - 3, 4, 3); c.fillStyle = hs(L.face, 0.25); c.fillRect(xx, top - 3, 4, 1); }
        k = k1 + 1;
      }
      // the floor under a wall is in its shadow
      c.fillStyle = "rgba(10,6,20,.28)"; c.fillRect(x * 16, (y + 1) * 16, (x1 - x + 1) * 16, 3);
      c.fillStyle = "rgba(10,6,20,.14)"; c.fillRect(x * 16, (y + 1) * 16 + 3, (x1 - x + 1) * 16, 3);
      x = x1 + 1;
    }
  }
  // side walls cast a little shadow too
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!floorAt(x, y)) continue;
    if (at(x - 1, y) === G.WALL) { c.fillStyle = "rgba(10,6,20,.2)"; c.fillRect(x * 16, y * 16, 3, 16); }
  }
  // doors and openings in walls
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = a.extra.get(y * w + x);
    if (!e?.startsWith("door:")) continue;
    const kind = e.slice(5), X = x * 16, Y = y * 16;
    if (kind === "side") {
      c.fillStyle = "#1a120c"; c.fillRect(X + 4, Y - 14, 8, 28);
      c.fillStyle = "#7a4a2a"; c.fillRect(X + 5, Y - 13, 6, 26); c.fillStyle = "#5a3420"; c.fillRect(X + 7, Y - 13, 1, 26);
      c.fillStyle = "#f2c230"; c.fillRect(X + 9, Y, 1, 2);
      continue;
    }
    if (kind === "up" || kind === "down") {
      c.fillStyle = "#1a1410"; c.fillRect(X + 1, Y - 14, 14, 30);
      for (let k = 0; k < 6; k++) {
        const yy = kind === "up" ? Y + 12 - k * 5 : Y - 12 + k * 5;
        c.fillStyle = hs(kind === "up" ? "#9a7a5a" : "#6a6060", -k * 0.08); c.fillRect(X + 2, yy, 12, 3);
        c.fillStyle = hs(kind === "up" ? "#c8a070" : "#8a8080", -k * 0.08); c.fillRect(X + 2, yy, 12, 1);
      }
      c.fillStyle = L.trim; c.fillRect(X, Y - 16, 16, 2); c.fillRect(X, Y - 16, 1, 32); c.fillRect(X + 15, Y - 16, 1, 32);
      continue;
    }
    doorAt(p, X + 2, Y - 8, { w: 12, h: 23, col: a.kind === "under" ? "#5a3a22" : "#8a5230", arch: true, double: true });
    if (a.kind === "under") { c.fillStyle = "#3a3640"; c.fillRect(X + 2, Y - 2, 12, 1); c.fillRect(X + 2, Y + 8, 12, 1); }
  }
  // openings that lead out: where an exit crosses a wall row of an interior
  if (a.kind === "interior") for (const s of a.spots) {
    if (s.kind !== "exit" || !s.side) continue;
    const ex = s.side === "north" ? { x: s.stand.x, y: s.stand.y - 1 } : s.side === "south" ? { x: s.stand.x, y: s.stand.y + 1 } : s.side === "west" ? { x: s.stand.x - 1, y: s.stand.y } : { x: s.stand.x + 1, y: s.stand.y };
    const X = ex.x * 16, Y = ex.y * 16;
    if (s.side === "north") {
      c.fillStyle = "#1a140e"; c.fillRect(X + 1, Y - 14, 14, 30);
      const gr = c.createLinearGradient(0, Y - 14, 0, Y + 16); gr.addColorStop(0, a.dark ? "#2a3048" : "#cfe4f4"); gr.addColorStop(1, a.dark ? "#1a1a28" : "#8ab070");
      c.fillStyle = gr; c.fillRect(X + 2, Y - 12, 12, 28);
      c.fillStyle = L.trim; c.fillRect(X, Y - 16, 16, 2); c.fillRect(X, Y - 16, 2, 32); c.fillRect(X + 14, Y - 16, 2, 32);
    } else {
      // a doormat on the threshold
      c.fillStyle = "#8a6a3a"; c.fillRect(X + 2, Y + 3, 12, 10); c.fillStyle = "#a8844a"; c.fillRect(X + 3, Y + 4, 10, 8);
      for (let k = 4; k < 12; k += 2) { c.fillStyle = "#7a5a30"; c.fillRect(X + 3, Y + k, 10, 1); }
    }
  }
  // ---- scale up to world pixels
  const out = document.createElement("canvas");
  out.width = w * TW; out.height = h * TW;
  const o = out.getContext("2d")!;
  o.imageSmoothingEnabled = false;
  o.drawImage(nat, 0, 0, out.width, out.height);
  return out;
}
const DIR8: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];

/** Rough rock face of caves: strata, cracks and a ragged dark foot. */
function rockFace(p: Paint, x: number, y: number, w: number, h: number, col: string, s: number) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const n = noise((x + xx) / 5, (y + yy) / 3, s) * 0.7 + cell(x + xx, y + yy, s) * 0.3;
    const band = Math.sin((y + yy) / 3.2 + noise((x + xx) / 9, 0, s + 1) * 4);
    let c = hs(col, (n - 0.5) * 0.4 + (band > 0.7 ? 0.12 : band < -0.8 ? -0.2 : 0) - (yy / h) * 0.18);
    if (yy < 2) c = hs(col, 0.2);
    p.px(x + xx, y + yy, c);
  }
  for (let k = 0; k < w / 5; k++) { const cx = x + Math.floor(cell(k, s, 1) * w), cy = y + 3 + Math.floor(cell(k, s, 2) * (h - 6)); p.line(cx, cy, cx + 1, cy + 4, hs(col, -0.45)); }
  for (let xx = 0; xx < w; xx++) p.rect(x + xx, y + h - 2 - (cell(x + xx, s, 3) > 0.6 ? 1 : 0), 1, 3, hs(col, -0.5));
}

// ------------------------------------------------------------ building an area
function interiorVar(sc: Scene): IVar {
  const L = sc.place ?? "";
  if (sc.bg === "temple") return "temple";
  if (sc.bg === "hall") return hasWord(L, ["hội", "hội quán", "guild", "phường hội", "doanh trại", "barracks", "hiệp hội", "nghiệp đoàn", "võ đường"]) ? "guild" : "throne";
  if (sc.bg !== "inn") return "tavern";
  if (hasWord(L, ["quán", "quán trọ", "nhà trọ", "lữ quán", "inn", "tavern", "quán rượu", "tửu quán", "tửu lâu"])) return "tavern";
  if (hasWord(L, ["cửa hàng", "cửa hiệu", "tiệm", "shop", "store", "hiệu", "chợ", "market", "lò rèn", "smithy", "forge"])) return "shop";
  if (hasWord(L, ["nhà", "home", "house", "cottage", "chòi", "túp lều", "phòng", "room", "lều", "hut", "dinh thự", "manor"])) return "house";
  return "tavern";
}

function buildArea(o: ExploreOpts): Area {
  const sc = o.scene, bg = sc.bg;
  const kind: Kind = ["inn", "hall", "temple"].includes(bg) ? "interior" : ["cave", "tunnel", "dungeon"].includes(bg) ? "under" : ["ship", "sea"].includes(bg) ? "ship" : ["village", "town", "city", "castle"].includes(bg) ? "settle" : "wild";
  const biome = biomeOf(bg, sc.weather);
  const dark = sc.time === "night" || sc.time === "dusk" || kind === "under";
  const seed = hashString(`${o.seed}|${bg}`);
  const ivar = interiorVar(sc);
  const ISIZE: Record<IVar, [number, number]> = { tavern: [22, 15], shop: [16, 12], house: [16, 12], throne: [28, 19], guild: [24, 16], temple: [24, 18] };
  const [w, h] = kind === "interior" ? ISIZE[ivar] : [36, 26];
  const g = new Gen(w, h, seed, sc, kind, biome, dark);
  g.ivar = ivar;
  for (const s of o.spots) if (s.via.exit) g.exits.add(s.via.exit);
  if (o.entryFrom) g.exits.add(o.entryFrom);
  if (kind === "wild") wildBase(g);
  else if (kind === "settle") settleBase(g);
  else if (kind === "interior") interiorBase(g);
  else if (kind === "under") underBase(g);
  else shipBase(g);
  const { spots, npcs } = attachSpots(g, o.spots, sc.actors, o.entryFrom);
  if (kind === "wild") decorateWild(g);
  else if (kind === "settle") decorateSettle(g);
  else if (kind === "interior") decorateInterior(g);
  else if (kind === "under") decorateUnder(g);
  else decorateShip(g);
  // where the hero comes in
  let start: Pt, startWalk: Pt | undefined;
  const entry = o.entryFrom;
  if (entry && g.ends[entry]) {
    const e = g.ends[entry]!, v = SIDE_V[entry];
    start = { x: e.x, y: e.y };
    if (!g.walk(start.x, start.y)) start = { x: e.x - v.x, y: e.y - v.y };
    startWalk = { x: e.x - v.x * 3, y: e.y - v.y * 3 };
    g.markKeep(startWalk.x, startWalk.y);
  } else {
    start = g.nearFree({ x: g.hub.x, y: g.hub.y + (kind === "interior" ? 3 : 2) }, (x, y) => g.walk(x, y) && !spots.some((s) => s.zone.has(g.i(x, y)))) ?? g.hub;
  }
  if (!g.walk(start.x, start.y)) { const k = g.i(start.x, start.y); g.block[k] = 0; if (UNWALK.has(g.gnd[k])) g.gnd[k] = G.DIRT; }
  // everything reachable from where the hero stands
  const floorG = kind === "under" ? (bg === "dungeon" ? G.FLAG : G.CAVE) : kind === "interior" ? g.gnd[g.i(g.hub.x, g.hub.y)] : kind === "ship" ? G.DECK : kind === "settle" ? (bg === "village" ? G.DIRT : G.COBBLE) : bg === "desert" ? G.PATHSAND : G.DIRT;
  for (const s of spots) if (!g.walk(s.stand.x, s.stand.y)) { const k = g.i(s.stand.x, s.stand.y); if (!g.objs.some((ob) => !ob.soft && ob.tiles.includes(k))) g.clearTile(k, floorG); }
  g.connect(start, [g.hub, ...spots.map((s) => s.stand), ...(startWalk ? [startWalk] : [])], floorG);
  if (startWalk && !g.walk(startWalk.x, startWalk.y)) startWalk = undefined;
  const water: number[] = [];
  for (let k = 0; k < w * h; k++) if (g.gnd[k] === G.WATER || g.gnd[k] === G.DEEP) water.push(k);
  const wallStyle: WallStyle = kind === "under" ? (bg === "dungeon" ? "stone" : "rock") : kind === "interior" ? ({ tavern: "wood", shop: "wood", house: "wood", throne: "palace", guild: "brick", temple: "marble" } as const)[ivar] : "city";
  const area: Area = {
    w, h, gnd: g.gnd, block: g.block, objs: g.objs, lights: g.lights, emit: g.emit, spots, actors: [], start, startWalk, kind, bg, biome, wallStyle,
    floor: FAMILY[floorG] ?? "", extra: g.extra, water, indoor: kind === "interior" || kind === "under", dark, murky: bg === "swamp", snow: sc.weather === "snow", hub: g.hub,
  };
  // the people of the section
  for (const n of npcs) {
    const person = !isMonster(n.id);
    const a: Actor = {
      id: n.id, type: person ? "person" : "monster", look: person ? lookFor(n.id) : undefined, variant: 0,
      x: n.at.x * TW + TW / 2, y: n.at.y * TW + FEET, path: [], speed: 0.05, facing: n.facing ?? "down", moving: false, phase: Math.random() * 1000,
      ai: n.spot ? "npc" : "still", home: n.at, range: 0, wait: 0, z: 0, alpha: 1, sit: n.sitDy !== undefined, sitDy: n.sitDy,
    };
    if (n.spot) n.spot.npc = a;
    area.actors.push(a);
  }
  populate(area, g, sc);
  return area;
}

/** Wandering villagers, guards and animals that fit the place. */
function populate(a: Area, g: Gen, sc: Scene) {
  const bg = a.bg, night = sc.time === "night", wet = sc.weather === "rain" || sc.weather === "storm" || sc.weather === "snow";
  const r = new Rng(g.seed ^ 0xa11ce);
  const walkTiles: number[] = [];
  for (let k = 0; k < a.w * a.h; k++) if (!UNWALK.has(a.gnd[k]) && !a.block[k] && a.gnd[k] !== G.BRIDGE) walkTiles.push(k);
  const waterTiles = a.water.filter((k) => a.gnd[k] === G.WATER || a.gnd[k] === G.DEEP);
  const near = (p: Pt, rad: number) => walkTiles.filter((k) => Math.hypot((k % a.w) - p.x, ((k / a.w) | 0) - p.y) < rad);
  const add = (type: Actor["type"], o: Partial<Actor>, tiles: number[]) => {
    if (!tiles.length) return;
    const k = tiles[r.int(0, tiles.length - 1)], x = k % a.w, y = (k / a.w) | 0;
    a.actors.push({
      id: o.id ?? "wanderer", type, variant: r.int(0, 7), x: x * TW + TW / 2, y: y * TW + FEET, path: [], speed: 0.045, facing: r.pick(["down", "left", "right", "up"] as Facing[]),
      moving: false, phase: r.next() * 2000, ai: "wander", home: { x, y }, range: 6, wait: r.int(0, 3000), z: 0, alpha: 1, ...o,
    });
  };
  const person = (id: string, ai: AI, tiles: number[], bark: string[], extra: Partial<Actor> = {}) => add("person", { id, look: lookFor(id), ai, bark, speed: ai === "patrol" ? 0.05 : 0.042, ...extra }, tiles);
  const animal = (c: Critter, n: number, tiles: number[], extra: Partial<Actor> = {}) => { for (let i = 0; i < n; i++) add("critter", { critter: c, speed: c === "deer" ? 0.06 : c === "rabbit" ? 0.07 : c === "rat" ? 0.08 : c === "chicken" ? 0.03 : 0.04, range: c === "chicken" ? 3 : 7, timid: c === "chicken" ? 1.6 : c === "cat" || c === "dog" ? 0 : 3, ...extra }, tiles); };
  const all = walkTiles, plaza = near(a.hub, 7);
  const mood = sc.mood;
  const worried = mood === "tense" || mood === "danger" || mood === "combat" || mood === "sad";
  const folkBark = worried ? ["Dạo này chẳng yên chút nào...", "Cẩn thận đấy, lữ khách.", "Mong mọi chuyện qua mau."] : night ? ["Khuya rồi, về nghỉ thôi.", "Đêm nay lạnh quá.", "Chúc ngủ ngon."] : ["Chào lữ khách!", "Hôm nay trời đẹp nhỉ.", "Đi đường bình an.", "Ghé chợ chưa?"];
  const guardBark = worried ? ["Đứng lại! À... đi đi.", "Giữ cảnh giác."] : ["Mọi thứ yên ổn.", "Đi đường cẩn thận."];
  const folk = night ? 1 : wet ? 2 : 4;
  // people sitting at tables, on benches and in pews
  const seats = [...g.seats].sort((p, q) => cell(p.x, p.y, g.seed) - cell(q.x, q.y, g.seed));
  const sitDown = (id: string, n: number, bark: string[]) => {
    for (let i = 0; i < n && seats.length; i++) {
      const st = seats.pop()!, k = st.y * a.w + st.x;
      if (a.actors.some((x) => Math.floor(x.x / TW) === st.x && Math.floor((x.y - FEET + TW / 2) / TW) === st.y)) continue;
      a.actors.push({ id: `${id}-${i}`, type: "person", look: lookFor(`${id}-${i}`), variant: 0, x: st.x * TW + TW / 2, y: st.y * TW + FEET, path: [], speed: 0.04, facing: st.facing, moving: false, phase: r.next() * 2000, ai: "still", home: { x: st.x, y: st.y }, range: 0, wait: 0, z: 0, alpha: 1, bark, sit: true, sitDy: st.dy });
      a.block[k] = 1;
    }
  };
  /** The keeper of the place, when no section spot put someone there. */
  const keeper = (id: string, bark: string[]) => {
    const H = g.host;
    if (!H || H.used) return;
    a.actors.push({ id, type: "person", look: lookFor(id), variant: 0, x: H.at.x * TW + TW / 2, y: H.at.y * TW + FEET, path: [], speed: 0.04, facing: H.face, moving: false, phase: r.next() * 2000, ai: "still", home: H.at, range: 0, wait: 0, z: 0, alpha: 1, bark, sit: H.sitDy !== undefined, sitDy: H.sitDy });
    a.block[H.at.y * a.w + H.at.x] = 1;
  };
  const guardPost = (p: Pt, id: string) => {
    if (!g.walk(p.x, p.y)) return;
    a.actors.push({ id, type: "person", look: lookFor(id), variant: 0, x: p.x * TW + TW / 2, y: p.y * TW + FEET, path: [], speed: 0.04, facing: "down", moving: false, phase: r.next() * 2000, ai: "still", home: p, range: 0, wait: 0, z: 0, alpha: 1, bark: guardBark });
    a.block[p.y * a.w + p.x] = 1;
  };
  if (a.kind === "interior") {
    switch (g.ivar) {
      case "tavern":
        keeper(`innkeeper-${g.seed % 5}`, ["Mời quý khách!", "Uống gì nào?", "Phòng trên lầu còn trống."]);
        sitDown(`patron-${g.seed % 31}`, night ? 6 : 4, ["Thêm một vại nữa!", "Nghe đồn gì chưa?", "Rượu ở đây ngon đấy.", "Món hầm hôm nay tuyệt lắm."]);
        person(`servant-${g.seed % 7}`, "wander", all, ["Mời quý khách!", "Có ngay đây ạ."], { range: 8 });
        animal("cat", 1, all);
        animal("rat", 1, all, { timid: 2.5 });
        break;
      case "shop":
        keeper(`merchant-${g.seed % 5}`, ["Hàng tốt, giá phải chăng!", "Cứ xem thoải mái."]);
        if (!night) person(`townsfolk-${g.seed % 97}`, "wander", all, folkBark, { range: 5 });
        animal("cat", 1, all);
        break;
      case "house":
        sitDown(`villager-${g.seed % 41}`, 1, folkBark);
        animal(g.seed % 2 ? "cat" : "dog", 1, all);
        break;
      case "guild":
        keeper(`clerk-${g.seed % 5}`, ["Có việc mới trên bảng đấy.", "Ký tên ở đây."]);
        sitDown(`adventurer-${g.seed % 23}`, 4, ["Chuyến đi vừa rồi suýt chết!", "Ai cần người hộ tống không?", "Treo thưởng cao đấy."]);
        person(`guard-${g.seed % 13}`, "wander", all, guardBark, { range: 6 });
        animal("dog", 1, all);
        break;
      case "throne":
        guardPost({ x: g.hub.x - 2, y: 5 }, `guard-${g.seed % 13}`);
        guardPost({ x: g.hub.x + 2, y: 5 }, `guard-${(g.seed % 13) + 1}`);
        for (let i = 0; i < 2; i++) person(`guard-${(g.seed % 13) + 2 + i}`, "patrol", all, guardBark);
        person(`servant-${g.seed % 7}`, "wander", all, folkBark);
        person(`noble-${g.seed % 11}`, "wander", all, ["Thật vinh dự.", "Bệ hạ hôm nay có vẻ mệt."], { range: 5 });
        break;
      case "temple":
        keeper(`priest-${g.seed % 5}`, ["Bình an cho người.", "Hãy thắp một ngọn nến."]);
        sitDown(`pilgrim-${g.seed % 17}`, 3, ["...", "Xin phù hộ cho chúng con."]);
        for (let i = 0; i < 2; i++) person(`monk-${g.seed % 9}-${i}`, "wander", all, ["Bình an cho người.", "Hãy giữ yên lặng."], { speed: 0.03 });
        animal("pigeon", 2, all, { timid: 3 });
        break;
    }
  } else switch (bg) {
    case "village":
      for (let i = 0; i < folk; i++) person(`villager-${g.seed % 97}-${i}`, "wander", plaza, folkBark, { range: 9 });
      if (!night) animal("chicken", 4, near(a.hub, 9));
      animal("cat", 1, plaza, { ai: "wander" });
      if (!night && !wet) animal("dog", 1, plaza);
      if (!night) animal("butterfly", 3, all, { ai: "fly" });
      break;
    case "town": case "city":
      for (let i = 0; i < folk + 1; i++) person(`townsfolk-${g.seed % 97}-${i}`, "wander", all, folkBark, { range: 12 });
      person(`guard-${g.seed % 13}`, "patrol", plaza, guardBark);
      if (bg === "city") person(`guard-${(g.seed % 13) + 1}`, "patrol", all, guardBark);
      if (!night) animal("pigeon", 5, plaza, { timid: 3.2 });
      animal("cat", 1, all);
      break;
    case "castle":
      for (let i = 0; i < 3; i++) person(`guard-${(g.seed % 13) + i}`, "patrol", all, guardBark);
      // sentries keep watch on the walls
      for (const [x, y, f] of [[0, 9, "right"], [a.w - 1, 15, "left"], [0, 18, "right"], [a.w - 1, 6, "left"]] as const) {
        if (a.gnd[y * a.w + x] !== G.WALL) continue;
        a.actors.push({ id: `guard-${(g.seed % 13) + x + y}`, type: "person", look: lookFor(`guard-${(g.seed % 13) + 3}`), variant: 0, x: x * TW + TW / 2, y: y * TW + FEET, path: [], speed: 0, facing: f, moving: false, phase: r.next() * 2000, ai: "still", home: { x, y }, range: 0, wait: 0, z: 0, alpha: 1 });
      }
      if (!night) person(`servant-${g.seed % 7}`, "wander", plaza, folkBark);
      if (!night) animal("chicken", 2, all);
      animal("crow", 1, all, { timid: 3 });
      break;
    case "forest": case "road": case "field": case "hill": case "mountain": case "sky": case "camp": case "lake": case "river": case "bridge": case "ruins":
      if (!night && bg !== "camp") animal("deer", bg === "forest" || bg === "hill" ? 2 : 1, all.filter((k) => Math.hypot((k % a.w) - a.hub.x, ((k / a.w) | 0) - a.hub.y) > 6), { range: 8 });
      if (bg !== "mountain") animal("rabbit", night ? 1 : 3, all);
      if (!night && !wet) animal("butterfly", 4, near(a.hub, 10), { ai: "fly" });
      if (bg === "ruins") { animal("crow", 3, all, { timid: 3 }); animal("lizard", 2, all, { timid: 2 }); }
      if (bg === "camp") { person(`soldier-${g.seed % 9}`, "wander", near(a.hub, 5), ["Lửa ấm quá.", "Nghỉ chút đã."], { range: 4 }); }
      if (bg === "road" && !night) person(`traveller-${g.seed % 9}`, "wander", all, folkBark, { range: 14 });
      break;
    case "swamp":
      animal("frog", 5, all, { timid: 2.5 });
      if (!night) animal("butterfly", 2, all, { ai: "fly" });
      animal("crow", 1, all, { timid: 3 });
      break;
    case "desert":
      animal("lizard", 4, all, { timid: 2.5 });
      break;
    case "coast": case "sea": case "ship":
      animal("gull", bg === "ship" ? 2 : 4, all, { timid: 3 });
      if (bg === "ship") for (let i = 0; i < (night ? 1 : 3); i++) person(`sailor-${g.seed % 11}-${i}`, "wander", all, ["Gió thuận đấy.", "Coi chừng sóng."], { range: 10 });
      break;
    case "dungeon": case "tunnel": case "cave":
      animal("rat", 3, all, { timid: 2.5 });
      animal("bat", bg === "cave" ? 3 : 2, all, { ai: "fly" });
      break;
  }
  // ducks and fish in open water
  if (waterTiles.length > 20 && a.kind !== "under") {
    if (bg !== "sea" && bg !== "ship" && bg !== "coast" && !night) for (let i = 0; i < 3; i++) add("critter", { critter: "duck", ai: "swim", speed: 0.015, range: 5 }, waterTiles);
  }
  // patrols: a loop of points around the hub
  for (const ac of a.actors) if (ac.ai === "patrol") {
    const pts: Pt[] = [];
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + r.next();
      const p = { x: clamp(Math.round(a.hub.x + Math.cos(ang) * 7), 1, a.w - 2), y: clamp(Math.round(a.hub.y + Math.sin(ang) * 5), 1, a.h - 2) };
      const q = g.nearFree(p, (x, y) => g.walk(x, y), 5);
      if (q) pts.push(q);
    }
    ac.route = pts;
    ac.routeI = 0;
  }
}

// ============================================================ runtime
const CSS = `
.ex-root{position:relative;width:100%;height:100%;overflow:hidden;background:#0c0a0e;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;outline:none}
.ex-root>canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer}
.ex-ui{position:absolute;inset:0;pointer-events:none;font-family:var(--pixel,"VT323",ui-monospace,monospace);overflow:hidden}
.ex-label{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis;padding:0 6px 1px;font-size:15px;line-height:1.15;color:#fff3d6;background:rgba(18,12,8,.78);border:2px solid #0b0805;box-shadow:inset 0 0 0 1px rgba(216,178,90,.5);text-shadow:1px 1px 0 #000;opacity:0;transition:opacity .25s;display:flex;align-items:center;gap:4px}
.ex-label.on{opacity:1}
.ex-label.locked{color:#c8b8a0}
.ex-label .ex-arr{color:#f2c542}
.ex-label img{flex:none}
.ex-prompt{position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:auto;width:max-content;min-width:120px;max-width:min(280px,86%);padding:7px 10px 9px;background:#f1e5c5;color:#2b2016;border:2px solid #24170c;box-shadow:inset 0 0 0 2px #fff8e4,inset 0 -3px 0 2px #d8c08c,0 3px 0 rgba(0,0,0,.45);text-align:center;animation:exPop .18s ease-out}
.ex-prompt::after{content:"";position:absolute;left:50%;bottom:-8px;margin-left:-6px;border:6px solid transparent;border-top:6px solid #24170c;border-bottom:0}
.ex-prompt.below{transform:translate(-50%,0)}
.ex-prompt.below::after{bottom:auto;top:-8px;border-top:0;border-bottom:6px solid #24170c}
.ex-prompt b{display:block;font-weight:normal;font-size:19px;line-height:1.05;margin:0 0 6px}
.ex-btn{font:inherit;font-size:21px;line-height:1;padding:4px 16px 5px;background:#e0b85a;color:#2a1c05;border:2px solid #2a1c05;box-shadow:inset -2px -2px 0 #a8782a,inset 2px 2px 0 #fae29a;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ex-btn:hover{background:#ecc66a}
.ex-btn:active{transform:translateY(1px);box-shadow:inset 2px 2px 0 #a8782a}
.ex-btn kbd{font:inherit;font-size:15px;opacity:.6}
.ex-lock{display:flex;gap:6px;align-items:center;justify-content:center;font-size:17px;line-height:1.05;color:#8a2a1a}
.ex-bark{position:absolute;left:0;top:0;transform:translate(-50%,-100%);background:#fffaf0;color:#2a2018;padding:0 7px 1px;font-size:16px;line-height:1.2;border:2px solid #2a2018;white-space:nowrap;animation:exPop .2s ease-out;transition:opacity .3s}
.ex-bark::after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-4px;border:4px solid transparent;border-top:4px solid #2a2018;border-bottom:0}
.ex-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:1px 10px 2px;background:rgba(0,0,0,.55);color:#efe3c4;font-size:17px;white-space:nowrap;transition:opacity .6s;border-radius:2px}
@keyframes exPop{from{opacity:0;margin-top:6px}to{opacity:1;margin-top:0}}
`;
let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
}

const VERB: Record<SpotKind, string> = { exit: "Đi", door: "Vào", npc: "Nói chuyện", object: "Xem" };
const facingTo = (dx: number, dy: number): Facing => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g?: number; glow?: boolean; grow?: number; kind?: "ring" | "puff" | "streak" | "leaf" | "fish" }

/** Ambient light of the place at its time of day and weather (null: plain daylight). */
function ambient(a: Area, sc: Scene): [number, number, number] | null {
  if (a.kind === "under") return [62, 58, 82];
  const w = sc.weather;
  if (a.kind === "interior") return sc.time === "night" ? [92, 80, 98] : sc.time === "dusk" ? [168, 140, 122] : [214, 196, 172];
  const base: Record<Scene["time"], [number, number, number]> = { dawn: [236, 204, 196], day: [255, 255, 255], dusk: [214, 146, 128], night: [56, 66, 116] };
  let c = base[sc.time];
  const k = w === "rain" ? 0.8 : w === "storm" ? 0.66 : w === "cloudy" ? 0.9 : w === "fog" ? 0.88 : w === "snow" ? 0.94 : 1;
  c = [c[0] * k, c[1] * k * (w === "fog" ? 1.01 : 1), c[2] * Math.min(1.05, k + 0.06)] as [number, number, number];
  if (c[0] > 250 && c[1] > 250 && c[2] > 250) return null;
  return c.map((v) => Math.round(clamp(v, 0, 255))) as [number, number, number];
}

const fogArt = memo(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  for (let k = 0; k < 26; k++) {
    const x = cell(k, 1, 9) * 256, y = cell(k, 2, 9) * 256, r = 30 + cell(k, 3, 9) * 60;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256], [256, 256], [-256, -256], [256, -256], [-256, 256]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, "rgba(225,232,240,.5)"); gr.addColorStop(1, "rgba(225,232,240,0)");
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return c;
});
const cloudArt = memo(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  for (let k = 0; k < 7; k++) {
    const x = cell(k, 4, 3) * 512, y = cell(k, 5, 3) * 512, r = 70 + cell(k, 6, 3) * 70;
    for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, "rgba(10,14,30,.5)"); gr.addColorStop(0.6, "rgba(10,14,30,.3)"); gr.addColorStop(1, "rgba(10,14,30,0)");
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return c;
});

export function mountExplore(o: ExploreOpts): { destroy(): void; pause(on: boolean): void } {
  injectStyle();
  const sc = o.scene;
  const A = buildArea(o);
  const ground = renderGround(A);
  const MW = A.w * TW, MH = A.h * TW;
  const outdoor = !A.indoor;

  // ---- DOM
  const root = document.createElement("div");
  root.className = "ex-root";
  root.tabIndex = 0;
  const canvas = document.createElement("canvas");
  const ui = document.createElement("div");
  ui.className = "ex-ui";
  root.append(canvas, ui);
  o.host.append(root);
  const ctx = canvas.getContext("2d")!;
  const buf = document.createElement("canvas");
  const g = buf.getContext("2d")!;
  const lightC = document.createElement("canvas");
  const lg = lightC.getContext("2d")!;
  let S = 2, dpr = 1, bw = 1, bh = 1, cssW = 1, cssH = 1;
  let vignette: HTMLCanvasElement | null = null;
  const resize = () => {
    const r = root.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    S = Math.max(1, Math.round(Math.min(canvas.height / 330, canvas.width / 440)));
    bw = Math.ceil(canvas.width / S) + 2; bh = Math.ceil(canvas.height / S) + 2;
    buf.width = bw; buf.height = bh; lightC.width = bw; lightC.height = bh;
    g.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
    vignette = document.createElement("canvas");
    vignette.width = bw; vignette.height = bh;
    const vg = vignette.getContext("2d")!;
    const gr = vg.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.35, bw / 2, bh / 2, Math.hypot(bw, bh) * 0.6);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, A.indoor ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.28)");
    vg.fillStyle = gr; vg.fillRect(0, 0, bw, bh);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(root);

  // ---- the hero
  const tileOf = (a: { x: number; y: number }): Pt => ({ x: clamp(Math.floor(a.x / TW), 0, A.w - 1), y: clamp(Math.floor((a.y - FEET + TW / 2) / TW), 0, A.h - 1) });
  const hero: Actor = {
    id: "hero", type: "person", look: o.heroLook, variant: 0, x: A.start.x * TW + TW / 2, y: A.start.y * TW + FEET, path: [], speed: 0.105,
    facing: o.entryFrom ? facingTo(-SIDE_V[o.entryFrom].x, -SIDE_V[o.entryFrom].y) : "down", moving: false, phase: 0, ai: "hero", home: A.start, range: 0, wait: 0, z: 0, alpha: 1, step: 0,
  };
  const canWalk = (x: number, y: number) => x >= 0 && y >= 0 && x < A.w && y < A.h && !UNWALK.has(A.gnd[y * A.w + x]) && !A.block[y * A.w + x];
  const pathTo = (from: Pt, to: Pt, walk = canWalk, limit = 6000) => (from.x === to.x && from.y === to.y ? [] : findPath({ w: A.w, h: A.h }, walk, from.x, from.y, to.x, to.y, limit));
  if (A.startWalk) hero.path = pathTo(A.start, A.startWalk) ?? [];
  const actors = [hero, ...A.actors];

  // ---- camera
  const camT = () => ({ x: hero.x - (bw - 2) / 2, y: hero.y - 22 - (bh - 2) / 2 });
  const clampCam = (c: Pt) => ({
    x: MW <= bw - 2 ? (MW - (bw - 2)) / 2 : clamp(c.x, 0, MW - (bw - 2)),
    y: MH <= bh - 2 ? (MH - (bh - 2)) / 2 : clamp(c.y, 0, MH - (bh - 2)),
  });
  let cam = clampCam(camT());

  // ---- labels and prompt
  const lockIcon = () => iconEl(uiIcon("lock"), 1);
  for (const s of A.spots) {
    const el = document.createElement("div");
    el.className = `ex-label ${s.kind}${s.locked ? " locked" : ""}`;
    if (s.locked) el.append(lockIcon());
    if (s.kind === "exit") { const arr = document.createElement("span"); arr.className = "ex-arr"; arr.textContent = s.side === "north" ? "↑" : s.side === "south" ? "↓" : s.side === "east" ? "→" : "←"; el.append(arr); }
    el.append(document.createTextNode(s.label));
    ui.append(el);
    s.el = el;
  }
  let prompt: HTMLDivElement | null = null;
  let active: PSpot | null = null;
  let target: PSpot | null = null;
  let picking = false;
  const toScreen = (wx: number, wy: number) => ({ x: ((wx - cam.x) * S) / dpr, y: ((wy - cam.y) * S) / dpr });
  const pick = (s: PSpot) => {
    if (picking || s.locked || paused) return;
    picking = true;
    sfx("click");
    hidePrompt();
    hero.facing = facingTo(s.face.x, s.face.y);
    if (s.kind === "exit" && s.side) {
      const v = SIDE_V[s.side], t = tileOf(hero);
      const out = { x: clamp(t.x + v.x, 0, A.w - 1), y: clamp(t.y + v.y, 0, A.h - 1) };
      if (canWalk(out.x, out.y)) hero.path = [out];
    }
    setTimeout(() => { if (alive) o.onPick(s.key); }, s.kind === "exit" ? 260 : 140);
  };
  const showPrompt = (s: PSpot) => {
    hidePrompt();
    const el = document.createElement("div");
    el.className = "ex-prompt";
    const b = document.createElement("b");
    b.textContent = s.label;
    el.append(b);
    if (s.locked) {
      const l = document.createElement("div");
      l.className = "ex-lock";
      l.append(lockIcon(), document.createTextNode(s.locked));
      el.append(l);
      sfx("error");
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ex-btn";
      btn.textContent = VERB[s.kind];
      btn.addEventListener("pointerdown", (e) => e.stopPropagation());
      btn.addEventListener("click", (e) => { e.stopPropagation(); pick(s); });
      el.append(btn);
      sfx("blip", "520");
    }
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    ui.append(el);
    prompt = el;
    active = s;
    placeUi();
  };
  function hidePrompt() { prompt?.remove(); prompt = null; active = null; }
  const barks: { el: HTMLDivElement; a: Actor; until: number }[] = [];
  const labelSize = new WeakMap<HTMLElement, { w: number; h: number }>();
  let barkReady = 0;

  const hint = document.createElement("div");
  hint.className = "ex-hint";
  hint.textContent = matchMedia("(pointer: coarse)").matches ? "Chạm vào nơi muốn đến" : "Bấm chuột hoặc dùng phím mũi tên để đi";
  ui.append(hint);
  const hintTimer = setTimeout(() => { hint.style.opacity = "0"; }, 3800);

  function placeUi() {
    const near = tileOf(hero);
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const order = A.spots.map((s) => ({ s, p: toScreen(s.ax, s.ay - (s.npc ? s.npc.z : 0)) })).sort((a, b) => b.p.y - a.p.y);
    for (const { s, p } of order) {
      const el = s.el!;
      const d = Math.hypot(s.stand.x - near.x, s.stand.y - near.y);
      const on = s !== active && (d < 6 || target === s);
      el.classList.toggle("on", on);
      if (!on) continue;
      let size = labelSize.get(el);
      if (!size) { size = { w: el.offsetWidth, h: el.offsetHeight }; labelSize.set(el, size); }
      const half = Math.min(size.w / 2, cssW / 2 - 2);
      const lx = clamp(p.x, half + 2, cssW - half - 2);
      let ly = Math.max(size.h + 2, Math.min(cssH - 2, p.y));
      for (let k = 0; k < 4; k++) {
        const hit = placed.find((r) => lx - half < r.x1 && lx + half > r.x0 && ly - size!.h < r.y1 && ly > r.y0);
        if (!hit) break;
        ly = hit.y0 - 2;
      }
      placed.push({ x0: lx - half, x1: lx + half, y0: ly - size.h, y1: ly });
      el.style.transform = `translate(${Math.round(lx)}px,${Math.round(ly)}px) translate(-50%,-100%)`;
    }
    if (prompt && active) {
      const p = toScreen(active.ax, active.ay);
      const below = p.y < 90;
      prompt.classList.toggle("below", below);
      const half = Math.min(prompt.offsetWidth / 2, cssW / 2 - 4);
      const x = clamp(p.x, half + 4, cssW - half - 4);
      prompt.style.transform = below ? `translate(${Math.round(x)}px,${Math.round(Math.max(4, p.y + 40))}px) translate(-50%,0)` : `translate(${Math.round(x)}px,${Math.round(p.y - 4)}px) translate(-50%,-100%)`;
      (prompt.style as CSSStyleDeclaration & { left: string }).left = "0";
    }
    for (const b of barks) {
      const p = toScreen(b.a.x, b.a.y - 52 - b.a.z);
      b.el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-100%)`;
    }
  }

  // ---- input
  let paused = false, alive = true;
  let tapFx: { x: number; y: number; t: number; ok: boolean } | null = null;
  const keys = new Set<string>();
  const KEYMAP: Record<string, Pt> = { ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 } };
  const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable); };
  const onKey = (e: KeyboardEvent) => {
    if (paused || !root.isConnected || typing()) return;
    if (e.type === "keyup") { keys.delete(e.code); return; }
    if (KEYMAP[e.code]) { keys.add(e.code); target = null; e.preventDefault(); return; }
    if ((e.code === "Enter" || e.code === "Space" || e.code === "KeyE") && active && !active.locked) { e.preventDefault(); pick(active); }
    if (e.code === "Escape" && prompt) hidePrompt();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  const onBlur = () => keys.clear();
  window.addEventListener("blur", onBlur);
  let down: { x: number; y: number; id: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; root.focus({ preventScroll: true }); });
  canvas.addEventListener("pointercancel", () => { down = null; });
  canvas.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || paused || picking || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    const r = canvas.getBoundingClientRect();
    const wx = cam.x + ((e.clientX - r.left) * dpr) / S, wy = cam.y + ((e.clientY - r.top) * dpr) / S;
    tap(wx, wy);
  });
  function tap(wx: number, wy: number) {
    keys.clear();
    // a spot under the finger (people and things first, the nearest)
    const t = { x: Math.floor(wx / TW), y: Math.floor(wy / TW) };
    const hits = A.spots.filter((s) => (wx >= s.hit.x0 && wx <= s.hit.x1 && wy >= s.hit.y0 && wy <= s.hit.y1) || s.zone.has(t.y * A.w + t.x));
    hits.sort((p, q) => Math.hypot(p.ax - wx, p.ay + 20 - wy) - Math.hypot(q.ax - wx, q.ay + 20 - wy));
    const s = hits[0];
    const here = tileOf(hero);
    if (s) {
      if (s.zone.has(here.y * A.w + here.x) && !hero.path.length) { hero.facing = facingTo(s.face.x, s.face.y); if (active !== s) showPrompt(s); return; }
      const p = pathTo(here, s.stand);
      if (p) { hero.path = p; target = s; hidePrompt(); tapFx = { x: s.stand.x * TW + TW / 2, y: s.stand.y * TW + FEET - 4, t: now, ok: true }; return; }
    }
    // plain ground: walk there, or as close as possible
    let dest: Pt | null = canWalk(t.x, t.y) ? t : null;
    if (!dest) {
      let best = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = t.x + dx, y = t.y + dy;
        if (!canWalk(x, y)) continue;
        const dd = Math.hypot((x + 0.5) * TW - wx, (y + 0.5) * TW - wy);
        if (dd < best) { best = dd; dest = { x, y }; }
      }
    }
    target = null;
    if (!dest) { tapFx = { x: wx, y: wy, t: now, ok: false }; return; }
    const p = pathTo(here, dest);
    if (p) { hero.path = p; hidePrompt(); tapFx = { x: dest.x * TW + TW / 2, y: dest.y * TW + FEET - 4, t: now, ok: true }; }
    else tapFx = { x: wx, y: wy, t: now, ok: false };
  }

  // ---- particles
  const parts: Part[] = [];
  const puff = (x: number, y: number, col: string, n = 3, spread = 0.03) => {
    for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - 0.5) * 8, y: y - Math.random() * 2, vx: (Math.random() - 0.5) * spread, vy: -0.01 - Math.random() * 0.012, life: 0, max: 380 + Math.random() * 260, col, size: 2, kind: "puff", grow: 0.004 });
  };
  const splash = (x: number, y: number) => parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 420, col: "rgba(220,240,255,.8)", size: 1, kind: "ring" });
  const wind = sc.weather === "wind" || sc.weather === "storm" ? 1 : 0.25;
  const rainy = outdoor && (sc.weather === "rain" || sc.weather === "storm");
  const night = sc.time === "night";
  const darkish = A.dark || A.indoor;
  const amb = ambient(A, sc);
  let lightning = 0, nextBolt = 4000 + Math.random() * 6000;
  let fishAt = 3000;

  // ---- AI
  const randomNear = (a: Actor, rad: number, ok: (x: number, y: number) => boolean) => {
    for (let k = 0; k < 12; k++) {
      const x = a.home.x + Math.round((Math.random() * 2 - 1) * rad), y = a.home.y + Math.round((Math.random() * 2 - 1) * rad);
      if (ok(x, y)) return { x, y };
    }
    return null;
  };
  const swimOk = (x: number, y: number) => x >= 0 && y >= 0 && x < A.w && y < A.h && (A.gnd[y * A.w + x] === G.WATER || A.gnd[y * A.w + x] === G.DEEP) && !A.block[y * A.w + x];
  const think = (a: Actor, dt: number) => {
    const hd = Math.hypot(hero.x - a.x, hero.y - a.y) / TW;
    if (a.gone) { a.gone -= dt; if (a.gone <= 0) { a.gone = 0; const p = randomNear(a, 8, canWalk); if (p && hd > 4) { a.x = p.x * TW + TW / 2; a.y = p.y * TW + FEET; a.z = 0; a.alpha = 1; a.ai = "wander"; a.path = []; } else a.gone = 2000; } return; }
    if (a.ai === "npc" || a.ai === "still") {
      if (hd < 5 && !a.sit) a.facing = facingTo(hero.x - a.x, hero.y - a.y);
      return;
    }
    if (a.ai === "fly") {
      // butterflies and bats drift on their own
      const t = now / 1000 + a.phase;
      const sp = a.critter === "bat" ? 0.05 : 0.02;
      a.x += Math.cos(t * 0.7 + Math.sin(t * 1.3)) * sp * dt;
      a.y += Math.sin(t * 0.9 + Math.cos(t * 0.6)) * sp * 0.6 * dt;
      a.z = (a.critter === "bat" ? 34 : 14) + Math.sin(t * 2.2) * 6;
      a.x = clamp(a.x, TW, MW - TW); a.y = clamp(a.y, TW, MH - TW);
      a.facing = Math.cos(t * 0.7 + Math.sin(t * 1.3)) > 0 ? "right" : "left";
      if (a.alpha < 1 && a.critter !== "pigeon" && a.critter !== "crow" && a.critter !== "gull") a.alpha = 1;
      return;
    }
    if (a.ai === "flee" && (a.critter === "pigeon" || a.critter === "crow" || a.critter === "gull")) {
      // up and away
      a.z += dt * 0.09; a.x += (a.x > hero.x ? 1 : -1) * dt * 0.12; a.y -= dt * 0.03;
      a.facing = a.x > hero.x ? "right" : "left";
      a.alpha = Math.max(0, a.alpha - dt / 1800);
      if (a.alpha <= 0) { a.gone = 6000 + Math.random() * 8000; a.alpha = 0; }
      return;
    }
    if (a.timid && hd < a.timid && a.ai !== "flee" && a.type === "critter") {
      if (a.critter === "pigeon" || a.critter === "crow" || a.critter === "gull") { a.ai = "flee"; a.path = []; if (Math.random() < 0.5) sfx("whoosh"); return; }
      // run off, away from the hero
      const t = tileOf(a);
      let best: Pt | null = null, bd = -1;
      for (let k = 0; k < 10; k++) {
        const p = { x: t.x + Math.round((Math.random() * 2 - 1) * 6), y: t.y + Math.round((Math.random() * 2 - 1) * 6) };
        if (!canWalk(p.x, p.y)) continue;
        const d = Math.hypot(p.x * TW - hero.x, p.y * TW - hero.y);
        if (d > bd) { bd = d; best = p; }
      }
      if (best) { const p = pathTo(t, best, canWalk, 600); if (p) { a.path = p; a.ai = "flee"; a.wait = 0; } }
      return;
    }
    if (a.path.length || a.moving) return;
    if (a.ai === "flee") { a.ai = "wander"; a.wait = 1500 + Math.random() * 2000; }
    if (a.wait > 0) { a.wait -= dt; return; }
    const t = tileOf(a);
    if (a.ai === "patrol" && a.route?.length) {
      a.routeI = ((a.routeI ?? 0) + 1) % a.route.length;
      const p = pathTo(t, a.route[a.routeI], canWalk, 1500);
      if (p) a.path = p;
      a.wait = 1800 + Math.random() * 1500;
      return;
    }
    if (a.ai === "swim") {
      const p = randomNear(a, a.range, swimOk);
      if (p) { const q = pathTo(t, p, swimOk, 500); if (q) a.path = q; }
      a.wait = 1500 + Math.random() * 3000;
      return;
    }
    const p = randomNear(a, a.range, canWalk);
    if (p) { const q = pathTo(t, p, canWalk, 900); if (q && q.length < a.range * 3) a.path = q; }
    a.wait = (a.type === "person" ? 2500 : 1200) + Math.random() * (a.type === "person" ? 4000 : 3000);
    // a word to the hero passing by
  };
  const move = (a: Actor, dt: number) => {
    if (!a.path.length) { a.moving = false; return; }
    const nx = a.path[0].x * TW + TW / 2, ny = a.path[0].y * TW + FEET;
    const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
    const sp = a.speed * (a.ai === "flee" ? 2.4 : 1) * dt;
    a.moving = true;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) a.facing = facingTo(dx, dy);
    if (d <= sp) {
      a.x = nx; a.y = ny;
      a.path.shift();
      a.step = (a.step ?? 0) + 1;
      if (a === hero) stepped();
      if (!a.path.length) a.moving = false;
    } else { a.x += (dx / d) * sp; a.y += (dy / d) * sp; }
    a.phase += sp;
  };
  const stepped = () => {
    const t = tileOf(hero), gg = A.gnd[t.y * A.w + t.x];
    if (hero.step! % 2 === 0) sfx("step");
    if (gg === G.DIRT || gg === G.PATHSAND || gg === G.SAND || gg === G.CAVE) puff(hero.x, hero.y, gg === G.SAND || gg === G.PATHSAND ? "#e8d0a0" : "#c8a880", 2);
    else if (A.snow && (gg === G.GRASS || gg === G.FLOWER)) puff(hero.x, hero.y, "#ffffff", 3);
    else if (gg === G.MUD || (rainy && gg !== G.PLANK)) { splash(hero.x - 4, hero.y); splash(hero.x + 4, hero.y + 1); }
  };

  // ---- the frame
  let raf = 0, last = 0, now = 0;
  const visibleObjs = (x0: number, y0: number, x1: number, y1: number) => A.objs.filter((ob) => {
    const w = (ob.img ? ob.img.width * ob.s : 48) / 2, h = ob.img ? ob.img.height * ob.s : 64;
    return ob.x + w >= x0 && ob.x - w <= x1 && ob.y >= y0 && ob.y - h <= y1 + 40;
  });
  const drawObj = (ob: Obj, ox: number, oy: number, fadeIt: boolean) => {
    if (ob.img) {
      const w = ob.img.width * ob.s, h = ob.img.height * ob.s;
      if (fadeIt) g.globalAlpha = 0.5;
      const src = ob.flip ? flipped(ob.img) : ob.img;
      g.drawImage(src, Math.round(ob.x - w / 2 - ox), Math.round(ob.y - h - ox * 0 - oy), w, h);
      g.globalAlpha = 1;
    }
    ob.live?.(g, Math.round(ob.x - ox), Math.round(ob.y - oy), now);
  };
  const actorImg = (a: Actor): [HTMLCanvasElement, number] => {
    if (a.type === "person") {
      const pose: Pose = a.moving ? "walk" : "idle";
      const f = a.moving ? Math.floor(a.phase / 7.5) : Math.floor((now + a.phase * 100) / 480);
      const fr = personFrame(a.look ?? lookFor(a.id), a.facing, pose, f);
      if (a.sit && !a.moving) return [seated(fr), -(a.sitDy ?? 0)];
      return [fr, 0];
    }
    if (a.type === "monster") {
      const f = Math.floor((now + a.phase * 50) / (a.moving ? 130 : 380));
      return [creatureFrame(a.id, a.moving ? "move" : "idle", f, a.facing === "right" ? "right" : "left"), creatureSize(a.id).flying ? 16 + Math.round(Math.sin((now + a.phase) / 300) * 3) : 0];
    }
    const c = a.critter!;
    const left = a.facing === "left" || (a.facing === "up" && a.variant % 2 === 1);
    if (c === "butterfly" || c === "bat") return [critter(c, "fly", Math.floor(now / (c === "bat" ? 90 : 120) + a.phase), a.variant, left), a.z];
    if ((c === "pigeon" || c === "crow" || c === "gull") && (a.ai === "flee" || a.z > 0)) return [critter(c, "fly", Math.floor(now / 90), a.variant, left), a.z];
    if (a.moving) return [critter(c, "walk", Math.floor(a.phase / (c === "rabbit" || c === "frog" ? 4 : 5)), a.variant, left), 0];
    const actPose = c === "chicken" || c === "pigeon" || c === "crow" || c === "gull" || c === "deer" || c === "cat" || c === "dog" ? "act" : "idle";
    const f = Math.floor((now + a.phase * 100) / (c === "chicken" ? 260 : 420));
    const busy = Math.sin(now / 2300 + a.phase) > -0.2;
    return [critter(c, busy ? actPose : "idle", f, a.variant, left), 0];
  };

  const frame = (t: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const dt = Math.min(50, last ? t - last : 16);
    last = t; now = t;
    // hero: keys, then path
    if (!picking && keys.size && !hero.path.length) {
      const k = [...keys].pop()!;
      const v = KEYMAP[k];
      if (v) {
        const here = tileOf(hero), nx = here.x + v.x, ny = here.y + v.y;
        if (canWalk(nx, ny)) hero.path = [{ x: nx, y: ny }];
        else hero.facing = facingTo(v.x, v.y);
        hidePrompt();
        target = null;
      }
    }
    move(hero, dt);
    for (const a of A.actors) { think(a, dt); move(a, dt); }
    // arriving at a spot opens its prompt
    if (!hero.path.length && !picking) {
      const here = tileOf(hero), k = here.y * A.w + here.x;
      const s = (target && target.zone.has(k) ? target : null) ?? A.spots.find((sp) => sp.zone.has(k)) ?? null;
      if (s && s !== active && !keys.size) { hero.facing = facingTo(s.face.x, s.face.y); showPrompt(s); target = null; }
      else if (!s && active) hidePrompt();
    } else if (active && hero.path.length) hidePrompt();
    // barks from passers-by
    if (now > barkReady) for (const a of A.actors) {
      if (!a.bark?.length || a.gone) continue;
      if (Math.hypot(hero.x - a.x, hero.y - a.y) < TW * 1.8 && (a.barkAt ?? 0) < now - 20000) {
        a.barkAt = now; barkReady = now + 5000;
        const el = document.createElement("div");
        el.className = "ex-bark";
        el.textContent = a.bark[Math.floor(Math.random() * a.bark.length)];
        ui.append(el);
        barks.push({ el, a, until: now + 2600 });
        a.facing = facingTo(hero.x - a.x, hero.y - a.y);
        if (!a.path.length) a.wait = Math.max(a.wait, 1500);
        break;
      }
    }
    for (let i = barks.length - 1; i >= 0; i--) if (now > barks[i].until) { barks[i].el.remove(); barks.splice(i, 1); }
    // camera
    const ct = clampCam(camT());
    const k = Math.min(1, dt * 0.0075);
    cam = { x: cam.x + (ct.x - cam.x) * k, y: cam.y + (ct.y - cam.y) * k };
    if (Math.abs(ct.x - cam.x) < 0.05) cam.x = ct.x;
    if (Math.abs(ct.y - cam.y) < 0.05) cam.y = ct.y;
    const ox = Math.floor(cam.x), oy = Math.floor(cam.y);
    const fx = cam.x - ox, fy = cam.y - oy;
    const x1 = ox + bw, y1 = oy + bh;

    // ---- ground
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#0c0a0e";
    g.fillRect(0, 0, bw, bh);
    g.drawImage(ground, -ox, -oy);
    // water: glints and slow ripples
    const tx0 = Math.max(0, Math.floor(ox / TW)), ty0 = Math.max(0, Math.floor(oy / TW)), tx1 = Math.min(A.w - 1, Math.ceil(x1 / TW)), ty1 = Math.min(A.h - 1, Math.ceil(y1 / TW));
    for (const wk of A.water) {
      const x = wk % A.w, y = (wk / A.w) | 0;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
      const inner = [[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => { const n = A.gnd[(y + dy) * A.w + x + dx]; return x + dx < 0 || y + dy < 0 || x + dx >= A.w || y + dy >= A.h || n === G.WATER || n === G.DEEP || A.kind === "ship"; });
      if (!inner) continue;
      const X = x * TW - ox, Y = y * TW - oy;
      if (cell(x, y, 13) < 0.45) {
        const ph = now / 1600 + cell(x, y, 14) * 6;
        g.fillStyle = A.murky ? "rgba(140,180,120,.35)" : "rgba(170,225,250,.45)";
        g.fillRect(X + 6 + Math.round(Math.sin(ph) * 5) * 2, Y + 8 + Math.floor(cell(x, y, 15) * 16), 10, 2);
      }
      for (let kk = 0; kk < 2; kk++) {
        if (Math.sin(now / 650 + cell(x, y, 60 + kk) * 40) < 0.94) continue;
        g.fillStyle = "rgba(245,252,255,.95)";
        g.fillRect(X + 4 + Math.floor(cell(x, y, 70 + kk) * 22), Y + 4 + Math.floor(cell(x, y, 80 + kk) * 22), 4, 2);
      }
    }
    // flat things: rugs, wall dressings, markers
    const vis = visibleObjs(ox - 40, oy - 40, x1 + 40, y1 + 40);
    for (const ob of vis) if (ob.flat) drawObj(ob, ox, oy, false);
    // ground markers: exits, the tap target
    for (const s of A.spots) {
      if (s.kind !== "exit" || !s.side) continue;
      const v = SIDE_V[s.side];
      const ex = s.stand.x * TW + TW / 2 + v.x * TW * 0.6 - ox, ey = s.stand.y * TW + TW / 2 + v.y * TW * 0.6 - oy + 4;
      for (let c = 0; c < 3; c++) {
        const ph = ((now / 900 + c / 3) % 1);
        g.globalAlpha = Math.sin(ph * Math.PI) * (s.locked ? 0.4 : 0.85);
        g.fillStyle = s.locked ? "#a89890" : "#ffe08a";
        const px = ex + v.x * (ph * 18 - 9), py = ey + v.y * (ph * 18 - 9);
        chevron(g, Math.round(px), Math.round(py), v);
      }
      g.globalAlpha = 1;
    }
    if (tapFx && now - tapFx.t < 500) {
      const p = (now - tapFx.t) / 500;
      g.strokeStyle = tapFx.ok ? `rgba(255,236,170,${1 - p})` : `rgba(255,120,100,${1 - p})`;
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(Math.round(tapFx.x - ox), Math.round(tapFx.y - oy), 6 + p * 8, 3 + p * 4, 0, 0, Math.PI * 2); g.stroke();
    }
    // shadows of everyone standing
    g.fillStyle = "rgba(20,10,30,.3)";
    for (const a of actors) {
      if (a.gone || a.alpha <= 0) continue;
      const big = a.type === "person" ? 9 : a.type === "monster" ? Math.max(8, creatureSize(a.id).w * 0.3) : a.critter === "deer" ? 9 : 4;
      const sh = a.z > 0 ? Math.max(0.3, 1 - a.z / 60) : 1;
      if (a.ai === "swim") continue;
      g.globalAlpha = a.alpha * sh;
      g.beginPath(); g.ellipse(Math.round(a.x - ox), Math.round(a.y - oy) - 1, big * sh, 3 * sh, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // ---- things and people, back to front
    const items: { y: number; ob?: Obj; a?: Actor }[] = [];
    for (const ob of vis) if (!ob.flat && !ob.over) items.push({ y: ob.y, ob });
    for (const a of actors) if (!a.gone && a.x > ox - 40 && a.x < x1 + 40 && a.y > oy - 20 && a.y < y1 + 80) items.push({ y: a.y, a });
    items.sort((p, q) => p.y - q.y);
    const hx0 = hero.x - 14, hx1 = hero.x + 14, hy0 = hero.y - 44, hy1 = hero.y;
    for (const it of items) {
      if (it.ob) {
        const ob = it.ob;
        let fadeIt = false;
        if (ob.fade && ob.img && ob.y > hero.y + 2) {
          const w = ob.img.width * ob.s, h = ob.img.height * ob.s;
          fadeIt = ob.x - w * 0.32 < hx1 && ob.x + w * 0.32 > hx0 && ob.y - h * 0.9 < hy1 && ob.y - 10 > hy0 && ob.y - hero.y < TW * 2.2;
        }
        drawObj(ob, ox, oy, fadeIt);
        continue;
      }
      const a = it.a!;
      const [img, z] = actorImg(a);
      const sx = Math.round(a.x - img.width / 2 - ox), sy = Math.round(a.y - img.height - z - oy);
      g.globalAlpha = a.alpha;
      if (a.ai === "swim") {
        g.drawImage(img, sx, sy + 3);
        g.fillStyle = "rgba(220,240,255,.5)";
        g.fillRect(sx + 1, Math.round(a.y - oy) - 1, img.width - 2, 1);
      } else g.drawImage(img, sx, sy);
      g.globalAlpha = 1;
      // a speech mark over people who have something to say
      if (a.ai === "npc") {
        const sp = A.spots.find((s) => s.npc === a);
        if (sp && sp !== active) speechMark(g, Math.round(a.x - ox), sy - 4 + Math.round(Math.sin(now / 280) * 1.5), !!sp.locked);
      }
    }
    for (const ob of vis) if (ob.over) drawObj(ob, ox, oy, false);
    // ---- particles
    for (const em of A.emit) {
      if (em.x < ox - 80 || em.x > x1 + 80 || em.y < oy - 120 || em.y > y1 + 120) continue;
      em.acc += dt;
      const every = em.kind === "smoke" ? 300 : em.kind === "fire" ? 90 : em.kind === "embers" ? 420 : em.kind === "incense" ? 260 : em.kind === "spray" ? 50 : em.kind === "drip" ? 900 : em.kind === "steam" ? 380 : 600;
      while (em.acc > every) {
        em.acc -= every;
        if (em.kind === "smoke") parts.push({ x: em.x + (Math.random() - 0.5) * 3, y: em.y, vx: 0.006 * wind + (Math.random() - 0.5) * 0.004, vy: -0.014 - Math.random() * 0.006, life: 0, max: 2600 + Math.random() * 1200, col: night ? "#6a6a78" : "#d8d8e0", size: 3, kind: "puff", grow: 0.0016 });
        else if (em.kind === "fire" || em.kind === "embers") parts.push({ x: em.x + (Math.random() - 0.5) * 10, y: em.y, vx: (Math.random() - 0.5) * 0.02 + 0.004 * wind, vy: -0.03 - Math.random() * 0.03, life: 0, max: 700 + Math.random() * 700, col: Math.random() < 0.5 ? "#ffb040" : "#ff6a2a", size: Math.random() < 0.3 ? 2 : 1, glow: true });
        else if (em.kind === "steam") parts.push({ x: em.x + (Math.random() - 0.5) * 8, y: em.y, vx: (Math.random() - 0.5) * 0.006, vy: -0.02, life: 0, max: 1500, col: "#e8e8f0", size: 2, kind: "puff", grow: 0.0014 });
        else if (em.kind === "incense") parts.push({ x: em.x + (Math.random() - 0.5) * 2, y: em.y, vx: (Math.random() - 0.5) * 0.004, vy: -0.012, life: 0, max: 2200, col: "#e8e0f0", size: 1, kind: "puff", grow: 0.0008 });
        else if (em.kind === "spray") parts.push({ x: em.x + (Math.random() - 0.5) * 4, y: em.y, vx: (Math.random() - 0.5) * 0.05, vy: -0.07 - Math.random() * 0.03, life: 0, max: 700, col: "#c8ecff", size: 2, g: 0.00022 });
        else if (em.kind === "drip") {
          const kx = ox + Math.random() * bw, ky = oy + Math.random() * bh;
          const tt = tileOf({ x: kx, y: ky + FEET });
          if (canWalk(tt.x, tt.y)) parts.push({ x: kx, y: ky - 50, vx: 0, vy: 0.16, life: 0, max: 320, col: "#9ac8e8", size: 1, kind: "streak" });
        }
      }
    }
    // ambient: fireflies, leaves, dust
    if (outdoor && night && !rainy && A.kind !== "ship" && Math.random() < dt / 260 && parts.filter((p) => p.glow && p.kind === undefined && p.g === -1).length < 18)
      parts.push({ x: ox + Math.random() * bw, y: oy + Math.random() * bh, vx: 0, vy: 0, life: 0, max: 4000 + Math.random() * 3000, col: "#d8ff8a", size: 2, glow: true, g: -1 });
    if (outdoor && (A.bg === "forest" || A.bg === "camp" || sc.weather === "wind" || A.biome.id === "autumn") && A.kind === "wild" && Math.random() < dt / 520)
      parts.push({ x: ox + Math.random() * bw, y: oy - 10, vx: 0.02 * wind + 0.01, vy: 0.022, life: 0, max: 7000, col: A.biome.id === BIOMES.tundra.id ? "#e0e8e8" : Math.random() < 0.5 ? "#6fae4a" : "#c8a040", size: 2, kind: "leaf" });
    if ((A.kind === "interior" || A.bg === "desert") && Math.random() < dt / 380)
      parts.push({ x: ox + Math.random() * bw, y: oy + Math.random() * bh, vx: (Math.random() - 0.5) * 0.006 + (A.bg === "desert" ? 0.03 : 0), vy: -0.002, life: 0, max: 3000, col: A.bg === "desert" ? "#e8d0a0" : "#fff0c0", size: 1, glow: A.kind === "interior" });
    // fish jumping now and then
    if (A.water.length > 30 && A.kind !== "under" && (fishAt -= dt) < 0) {
      fishAt = 2500 + Math.random() * 5000;
      const wk = A.water[Math.floor(Math.random() * A.water.length)], x = (wk % A.w) * TW + TW / 2, y = ((wk / A.w) | 0) * TW + TW / 2;
      if (x > ox && x < x1 && y > oy && y < y1) { parts.push({ x, y, vx: 0.03, vy: -0.09, life: 0, max: 520, col: "#c8d8e8", size: 2, g: 0.00035, kind: "fish" }); splash(x, y + 2); setTimeout(() => splash(x + 15, y + 2), 520); }
    }
    if (rainy && Math.random() < dt / 30) splash(ox + Math.random() * bw, oy + Math.random() * bh);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.g === -1) { p.x += Math.sin(now / 900 + i) * 0.02 * dt; p.y += Math.cos(now / 1100 + i * 2) * 0.015 * dt; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; }
      if (p.kind === "leaf") p.x += Math.sin(now / 400 + i) * 0.03 * dt;
      const sx = Math.round(p.x - ox), sy = Math.round(p.y - oy);
      if (sx < -10 || sy < -10 || sx > bw + 10 || sy > bh + 10) { if (p.kind === "leaf" || p.g === -1) parts.splice(i, 1); continue; }
      const f = p.life / p.max;
      if (p.kind === "ring") {
        g.fillStyle = p.col; g.globalAlpha = 1 - f;
        const r = 1 + f * 5;
        g.fillRect(sx - Math.round(r), sy, 1, 1); g.fillRect(sx + Math.round(r), sy, 1, 1); g.fillRect(sx, sy - Math.round(r * 0.4), 1, 1);
        g.globalAlpha = 1;
        continue;
      }
      if (p.kind === "streak") { g.fillStyle = p.col; g.fillRect(sx, sy, 1, 4); if (p.life + dt >= p.max) splash(p.x, p.y + 4); continue; }
      if (p.kind === "fish") { g.drawImage(critter("fish", "idle", 0, 0, false), sx - 4, sy - 2); continue; }
      const alpha = p.kind === "puff" ? (1 - f) * (f < 0.15 ? f / 0.15 : 1) * 0.7 : p.g === -1 ? 0.5 + 0.5 * Math.sin(now / 300 + i * 3) : 1 - f * f;
      const size = Math.round(p.size + (p.grow ?? 0) * p.life);
      g.globalAlpha = clamp(alpha, 0, 1);
      if (p.glow) { g.globalCompositeOperation = "lighter"; g.fillStyle = rgba(p.col, 0.25); g.fillRect(sx - size, sy - size, size * 3, size * 3); }
      g.fillStyle = p.col;
      g.fillRect(sx - (size >> 1), sy - (size >> 1), size, size);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    }
    if (parts.length > 600) parts.splice(0, parts.length - 600);
    // ---- light
    if (amb) {
      lg.globalCompositeOperation = "source-over";
      lg.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`;
      lg.fillRect(0, 0, bw, bh);
      lg.globalCompositeOperation = "lighter";
      const strong = darkish || night || sc.time === "dusk";
      for (const L of A.lights) {
        if (L.on === "dark" && !strong) continue;
        if (L.x < ox - L.r || L.x > x1 + L.r || L.y < oy - L.r || L.y > y1 + L.r) continue;
        const fl = L.flick ? 1 + (Math.sin(now / 83 + L.x) * 0.05 + Math.sin(now / 37 + L.y) * 0.03) * L.flick : 1;
        const r = L.r * fl;
        lg.globalAlpha = A.indoor || night ? 0.9 : 0.55;
        lg.drawImage(lightArt(L.col), Math.round(L.x - ox - r), Math.round(L.y - oy - r), Math.round(r * 2), Math.round(r * 2));
      }
      if (A.kind === "under" || night) {
        const r = A.kind === "under" ? 96 : 64;
        lg.globalAlpha = A.kind === "under" ? 0.75 : 0.4;
        lg.drawImage(lightArt("#ffe2b8"), Math.round(hero.x - ox - r), Math.round(hero.y - 20 - oy - r), r * 2, r * 2);
      }
      lg.globalAlpha = 1;
      g.globalCompositeOperation = "multiply";
      g.drawImage(lightC, 0, 0);
      g.globalCompositeOperation = "lighter";
      if (strong) for (const L of A.lights) {
        if (!L.glow || (L.on === "dark" && !strong)) continue;
        if (L.x < ox - L.r || L.x > x1 + L.r || L.y < oy - L.r || L.y > y1 + L.r) continue;
        const r = L.r * 0.5 * (L.flick ? 1 + Math.sin(now / 61 + L.x) * 0.06 * L.flick : 1);
        g.globalAlpha = L.glow * 0.45;
        g.drawImage(lightArt(L.col), Math.round(L.x - ox - r), Math.round(L.y - oy - r), Math.round(r * 2), Math.round(r * 2));
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    // ---- weather
    if (outdoor) weather(dt, ox, oy);
    if (vignette) g.drawImage(vignette, 0, 0);
    // ---- to the screen, scaled crisp, with a sub-pixel camera
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, -Math.round(fx * S), -Math.round(fy * S), bw * S, bh * S);
    placeUi();
  };

  const weather = (dt: number, ox: number, oy: number) => {
    const w = sc.weather, t = now;
    if (w === "cloudy" || w === "rain" || w === "storm") {
      const c = cloudArt(""), s = 3;
      g.globalAlpha = w === "cloudy" ? 0.28 : 0.2;
      const px = ((-ox - t * 0.012) % (512 * s) + 512 * s) % (512 * s) - 512 * s, py = ((-oy - t * 0.004) % (512 * s) + 512 * s) % (512 * s) - 512 * s;
      for (let yy = py; yy < bh; yy += 512 * s) for (let xx = px; xx < bw; xx += 512 * s) g.drawImage(c, xx, yy, 512 * s, 512 * s);
      g.globalAlpha = 1;
    }
    if (w === "rain" || w === "storm") {
      const n = Math.round((bw * bh) / (w === "storm" ? 420 : 700));
      g.fillStyle = "rgba(190,210,240,.42)";
      const slant = w === "storm" ? 0.35 : 0.15;
      for (let i = 0; i < n; i++) {
        const sx = cell(i, 1, 21), sy = cell(i, 2, 21), sp = 0.32 + cell(i, 3, 21) * 0.18;
        const y = ((sy * (bh + 40) + t * sp) % (bh + 40)) - 20;
        const x = (((sx * (bw + 60) + t * sp * slant - (oy * 0)) % (bw + 60)) + bw + 60) % (bw + 60) - 30;
        g.fillRect(Math.round(x), Math.round(y), 1, 6);
        g.fillRect(Math.round(x - slant * 6), Math.round(y - 6), 1, 3);
      }
      if (w === "storm") {
        nextBolt -= dt;
        if (nextBolt < 0) { lightning = 380; nextBolt = 5000 + Math.random() * 7000; }
        if (lightning > 0) {
          lightning -= dt;
          const a = lightning > 250 ? 0.55 : lightning > 180 ? 0.1 : lightning > 90 ? 0.4 : lightning / 90 * 0.2;
          g.fillStyle = `rgba(230,236,255,${a})`;
          g.fillRect(0, 0, bw, bh);
        }
      }
    }
    if (w === "snow") {
      const n = Math.round((bw * bh) / 900);
      g.fillStyle = "#ffffff";
      for (let i = 0; i < n; i++) {
        const sx = cell(i, 4, 21), sy = cell(i, 5, 21), sp = 0.018 + cell(i, 6, 21) * 0.02, big = cell(i, 7, 21) > 0.7;
        const y = (((sy * (bh + 20) + t * sp - oy * 0.3) % (bh + 20)) + bh + 20) % (bh + 20) - 10;
        const x = (((sx * (bw + 20) + Math.sin(t / 900 + i) * 8 - ox * 0.3 + t * 0.004) % (bw + 20)) + bw + 20) % (bw + 20) - 10;
        g.globalAlpha = big ? 0.95 : 0.7;
        g.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
      }
      g.globalAlpha = 1;
    }
    if (w === "fog") {
      const c = fogArt(""), s = 2;
      for (const [k, sp, al] of [[0, 0.006, 0.32], [1, -0.004, 0.22]] as const) {
        g.globalAlpha = al;
        const px = ((-ox * (0.9 + k * 0.2) - t * sp) % (256 * s) + 256 * s) % (256 * s) - 256 * s, py = ((-oy * (0.9 + k * 0.2) + k * 90) % (256 * s) + 256 * s) % (256 * s) - 256 * s;
        for (let yy = py; yy < bh; yy += 256 * s) for (let xx = px; xx < bw; xx += 256 * s) g.drawImage(c, xx, yy, 256 * s, 256 * s);
      }
      g.globalAlpha = 1;
      g.fillStyle = "rgba(210,218,228,.08)";
      g.fillRect(0, 0, bw, bh);
    }
    if (w === "wind" || w === "storm") {
      g.fillStyle = "rgba(255,255,255,.16)";
      for (let i = 0; i < 14; i++) {
        const x = ((cell(i, 8, 21) * (bw + 200) + t * 0.35) % (bw + 200)) - 100, y = cell(i, 9, 21) * bh + Math.sin(t / 500 + i) * 6;
        g.fillRect(Math.round(x), Math.round(y), 18 + Math.round(cell(i, 10, 21) * 20), 1);
      }
    }
  };
  raf = requestAnimationFrame(frame);
  if (A.startWalk) sfx("step");

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(hintTimer);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      root.remove();
    },
    pause(on: boolean) {
      paused = on;
      keys.clear();
      if (!on) last = 0;
    },
  };
}

function chevron(g: CanvasRenderingContext2D, x: number, y: number, v: Pt) {
  // a small arrow head pointing along v, 2-pixel strokes
  for (let k = 0; k < 4; k++) {
    if (v.y) { g.fillRect(x - 6 + k * 2 - 1, y - v.y * (k - 3) * 2 - 1, 2, 2); g.fillRect(x + 6 - k * 2 - 1, y - v.y * (k - 3) * 2 - 1, 2, 2); }
    else { g.fillRect(x - v.x * (k - 3) * 2 - 1, y - 6 + k * 2 - 1, 2, 2); g.fillRect(x - v.x * (k - 3) * 2 - 1, y + 6 - k * 2 - 1, 2, 2); }
  }
}
function speechMark(g: CanvasRenderingContext2D, x: number, y: number, locked: boolean) {
  g.fillStyle = "#24170c";
  g.fillRect(x - 8, y - 11, 16, 10); g.fillRect(x - 7, y - 12, 14, 12); g.fillRect(x - 2, y - 1, 4, 2); g.fillRect(x - 1, y + 1, 2, 1);
  g.fillStyle = locked ? "#d8ccb8" : "#fff8e4";
  g.fillRect(x - 7, y - 10, 14, 8); g.fillRect(x - 6, y - 11, 12, 10); g.fillRect(x - 1, y - 1, 2, 1);
  g.fillStyle = locked ? "#8a7a6a" : "#2a2018";
  for (const dx of [-4, -1, 2]) g.fillRect(x + dx, y - 7, 2, 2);
}
