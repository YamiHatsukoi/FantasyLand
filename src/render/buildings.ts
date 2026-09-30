import { BUILDINGS } from "../data/buildings";
import { CROPS, getItem } from "../data/items";
import { iconCanvas } from "./icons";
import { DECOR_DRAW } from "./decor";
import { hs, makeCanvas, mix, outline, rgba, type Paint } from "./palette";

/**
 * Cozy-farm-style buildings at 16px per tile. A building canvas is `w` tiles wide and
 * `h + 1` tiles tall (one tile of headroom for roofs). Walls are wooden siding or stone
 * over a cobble foundation, roofs are rows of shingles with an overhang shadow, windows
 * have frames and flower boxes, and shops hang a sign with an item icon.
 */

const cache = new Map<string, HTMLCanvasElement>();
const WOOD = "#b07a48", DARKWOOD = "#7a4a2a", STONE = "#9a9aa0", CREAM = "#f0e4c8";

// ------------------------------------------------------------ parts
function foundation(p: Paint, x: number, y: number, w: number, h = 3) {
  p.rect(x, y, w, h, hs(STONE, -0.1));
  for (let i = x; i < x + w; i += 4) {
    const o = ((i - x) / 4) % 2 ? 2 : 0;
    p.rect(i + o, y, 3, h - 1, STONE);
    p.px(i + o, y, hs(STONE, 0.3));
    p.px(i + o + 2, y + h - 2, hs(STONE, -0.3));
  }
  p.rect(x, y + h - 1, w, 1, outline(STONE));
}

/** Wooden siding (horizontal boards) or stone blocks. */
function walls(p: Paint, x: number, y: number, w: number, h: number, col: string, kind: "wood" | "stone" | "plaster" | "log") {
  p.rect(x, y, w, h, col);
  if (kind === "wood") for (let yy = y + 2; yy < y + h; yy += 3) { p.rect(x, yy, w, 1, hs(col, -0.2)); p.rect(x, yy - 1, w, 1, hs(col, 0.12)); }
  if (kind === "log") for (let yy = y + 1; yy < y + h; yy += 3) { p.rect(x, yy, w, 2, col); p.rect(x, yy + 2, w, 1, hs(col, -0.3)); p.px(x, yy, hs(col, 0.3)); p.px(x + w - 1, yy, hs(col, -0.15)); }
  if (kind === "stone") for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy - y) / 4 % 2 ? 3 : 0); xx < x + w; xx += 6) { p.rect(xx, yy, 5, 3, hs(col, 0.06)); p.px(xx, yy, hs(col, 0.3)); p.rect(xx, yy + 3, 6, 1, hs(col, -0.25)); }
  if (kind === "plaster") { for (let i = 0; i < w * h / 24; i++) p.px(x + ((i * 37) % w), y + ((i * 17) % h), hs(col, -0.08)); p.rect(x, y, 2, h, DARKWOOD); p.rect(x + w - 2, y, 2, h, DARKWOOD); p.rect(x, y + Math.floor(h / 2), w, 1, DARKWOOD); }
  p.rect(x, y, 1, h, outline(col));
  p.rect(x + w - 1, y, 1, h, outline(col));
  p.rect(x + 1, y, 1, h, hs(col, 0.18));
  p.rect(x + w - 2, y, 1, h, hs(col, -0.2));
}

/** Gable roof seen from the front: shingle rows narrowing to a ridge, with an overhang. */
function roof(p: Paint, x: number, top: number, w: number, h: number, col: string, kind: "shingle" | "thatch" | "slate" | "tile" = "shingle") {
  for (let i = 0; i < h; i++) {
    const inset = Math.round(((h - 1 - i) / Math.max(1, h - 1)) * Math.min(w / 2 - 3, h * 0.9));
    const y = top + i, x0 = x + inset, x1 = x + w - inset - 1;
    const rowCol = i % 3 === 2 ? hs(col, -0.18) : i % 3 === 0 ? hs(col, 0.08) : col;
    p.rect(x0, y, x1 - x0 + 1, 1, rowCol);
    if (kind === "shingle" && i % 3 === 2) for (let xx = x0 + (i % 6 === 2 ? 1 : 3); xx < x1; xx += 4) p.px(xx, y, hs(col, -0.35));
    if (kind === "thatch") for (let xx = x0; xx <= x1; xx += 2) p.px(xx, y, i % 2 ? hs(col, -0.2) : hs(col, 0.2));
    if (kind === "tile" && i % 2) for (let xx = x0; xx <= x1; xx += 3) p.px(xx, y, hs(col, -0.3));
    p.px(x0, y, outline(col));
    p.px(x1, y, outline(col));
    if (i < h / 2) p.px(x0 + 1, y, hs(col, 0.3));
  }
  p.rect(x + Math.round(w / 2) - 3, top - 1, 6, 1, outline(col));
  p.rect(x, top + h, w, 1, outline(col));
  p.rect(x + 1, top + h + 1, w - 2, 1, "rgba(30,15,40,.35)");
}

function windowAt(p: Paint, x: number, y: number, box = true, lit = false) {
  p.rect(x, y, 6, 6, CREAM);
  p.rect(x + 1, y + 1, 4, 4, lit ? "#ffe89a" : "#6aa0c8");
  p.px(x + 1, y + 1, lit ? "#fff8d0" : "#b8e0f0");
  p.px(x + 2, y + 1, lit ? "#fff8d0" : "#98c8e8");
  p.rect(x + 3, y + 1, 1, 4, CREAM);
  p.rect(x + 1, y + 3, 4, 1, CREAM);
  p.rect(x - 1, y - 1, 8, 1, outline(CREAM));
  if (box) {
    p.rect(x - 1, y + 6, 8, 2, DARKWOOD);
    for (const [dx, c] of [[0, "#e84a6a"], [2, "#f7d44c"], [4, "#e84a6a"], [6, "#b88aff"]] as const) { p.px(x + dx, y + 5, c); p.px(x + dx, y + 6, "#4f9a35"); }
  }
}

function door(p: Paint, x: number, y: number, col = DARKWOOD, w = 6, h = 9) {
  p.rect(x, y, w, h, col);
  p.rect(x, y, w, 1, hs(col, 0.25));
  for (let i = x + 2; i < x + w; i += 2) p.rect(i, y + 1, 1, h - 1, hs(col, -0.2));
  p.px(x + w - 2, y + Math.floor(h / 2), "#f2c230");
  p.rect(x - 1, y - 1, w + 2, 1, outline(col));
  p.rect(x - 1, y + h, w + 2, 2, STONE);
  p.rect(x - 1, y + h + 1, w + 2, 1, hs(STONE, -0.3));
}

function barnDoor(p: Paint, x: number, y: number, w: number, h: number, col: string) {
  p.rect(x, y, w, h, col);
  p.rect(x, y, w, 1, CREAM); p.rect(x, y + h - 1, w, 1, CREAM); p.rect(x, y, 1, h, CREAM); p.rect(x + w - 1, y, 1, h, CREAM); p.rect(x + Math.floor(w / 2), y, 1, h, CREAM);
  p.line(x, y, x + Math.floor(w / 2), y + h - 1, CREAM); p.line(x + Math.floor(w / 2), y, x, y + h - 1, CREAM);
  p.line(x + Math.floor(w / 2), y, x + w - 1, y + h - 1, CREAM); p.line(x + w - 1, y, x + Math.floor(w / 2), y + h - 1, CREAM);
}

function chimney(p: Paint, x: number, y: number, h = 8) {
  p.rect(x, y, 5, h, "#a8503a");
  for (let yy = y + 1; yy < y + h; yy += 2) p.rect(x, yy, 5, 1, hs("#a8503a", -0.2));
  p.rect(x - 1, y, 7, 2, "#8a3a2a");
  p.rect(x - 1, y, 1, h, outline("#a8503a"));
  p.g.fillStyle = "rgba(230,230,240,.55)";
  p.g.fillRect(x + 1, y - 3, 3, 2); p.g.fillRect(x + 2, y - 6, 3, 2); p.g.fillRect(x + 3, y - 9, 2, 2);
}

function sign(p: Paint, x: number, y: number, emblem: string) {
  p.rect(x + 1, y - 2, 1, 2, DARKWOOD); p.rect(x + 8, y - 2, 1, 2, DARKWOOD);
  p.rect(x, y, 10, 9, "#d8b070"); p.rect(x, y, 10, 1, "#f0d8a0"); p.rect(x, y + 8, 10, 1, DARKWOOD);
  p.rect(x - 1, y, 1, 9, outline("#d8b070")); p.rect(x + 10, y, 1, 9, outline("#d8b070"));
  p.g.drawImage(iconCanvas(emblem, EMBLEM_PAL[emblem] ?? ["#f2c542", "#8a5a2a", "#ffffff"], 1), 0, 0, 16, 16, x + 1, y + 1, 8, 8);
}

const EMBLEM_PAL: Record<string, [string, string, string]> = {
  egg: ["#f4efe6", "#d8c8a0", "#ffffff"], bottle: ["#f4f4f4", "#a0c8e8", "#ffffff"], wool: ["#f4f4f4", "#c8c8c8", "#ffffff"],
  log: ["#8a5a2a", "#c8a070", "#5a3a1e"], stone: ["#8a8f96", "#6a6e76", "#b0b4ba"], ore: ["#6a6e76", "#e08a3a", "#f2c542"],
  coin: ["#f2c542", "#c8902a", "#fff4b0"], bowl: ["#c8a070", "#f2c542", "#e04a2a"], ingot: ["#b0b4ba", "#e8e8f0", "#6a6e76"],
  plank: ["#c8a070", "#8a5a2a", "#e8c890"], block: ["#9a9ea4", "#6a6e76", "#c0c4ca"], cloth: ["#c870a0", "#f0c0d8", "#8a3a6a"],
  potion: ["#e04a4a", "#c8e0f0", "#ffffff"], book: ["#3a4a9a", "#f2c542", "#ffffff"], cup: ["#c8a070", "#f2e0a0", "#ffffff"], herb: ["#4ab04a", "#2a7a3a", "#a0e080"],
};

function shadowUnder(p: Paint, W: number, H: number) {
  p.g.fillStyle = "rgba(20,10,40,.25)";
  p.g.beginPath();
  p.g.ellipse(W / 2, H - 2, W / 2 - 1, 3, 0, 0, Math.PI * 2);
  p.g.fill();
}

// ------------------------------------------------------------ generic house
interface HouseOpts {
  wall: string; roof: string; wallKind?: "wood" | "stone" | "plaster" | "log"; roofKind?: "shingle" | "thatch" | "slate" | "tile";
  chimney?: boolean; emblem?: string; floors?: number; lit?: boolean;
}
function house(p: Paint, W: number, H: number, o: HouseOpts) {
  const tiles = W / 16;
  const floors = o.floors ?? 1;
  const wallH = Math.min(H - 14, 10 + floors * 9);
  const wallTop = H - 3 - wallH;
  const roofH = Math.max(8, Math.min(wallTop + 3, Math.round(W * 0.38)));
  shadowUnder(p, W, H);
  if (o.chimney) chimney(p, W - 12, Math.max(2, wallTop - roofH + 4), roofH - 2);
  walls(p, 1, wallTop, W - 2, wallH, o.wall, o.wallKind ?? "wood");
  foundation(p, 0, H - 4, W, 4);
  roof(p, -1 + 1, wallTop - roofH + 2, W, roofH, o.roof, o.roofKind);
  // windows
  const winY = wallTop + 3;
  for (let f = 0; f < floors; f++) {
    const y = winY + f * 9;
    if (y + 8 > H - 12 && f > 0) break;
    const slots = tiles <= 2 ? [4, W - 10] : tiles === 3 ? [4, W - 10] : [5, 17, W - 23, W - 11];
    for (const x of slots) if (f > 0 || Math.abs(x + 3 - W / 2) > 5) windowAt(p, x, y, f === floors - 1, o.lit ?? true);
  }
  door(p, Math.round(W / 2) - 3, H - 13, DARKWOOD);
  if (o.emblem) sign(p, W - 13 > W / 2 + 4 ? W - 13 : W / 2 + 4, wallTop + (floors > 1 ? 12 : 3), o.emblem);
}

// ------------------------------------------------------------ building table
type Drawer = (p: Paint, W: number, H: number, level: number) => void;

const D: Record<string, Drawer> = {
  house: (p, W, H, lv) => {
    const roofs = ["#b84a3a", "#c85a3a", "#6a4aa0", "#3a6ab0", "#c89a2a", "#d8a830"];
    house(p, W, H, { wall: lv >= 4 ? "#d8c8b0" : "#c8945a", roof: roofs[lv - 1] ?? roofs[0], wallKind: lv >= 4 ? "plaster" : lv >= 2 ? "wood" : "log", chimney: true, floors: lv >= 3 ? 2 : 1 });
    if (lv >= 5) { p.rect(2, H - 14, W - 4, 1, DARKWOOD); for (let x = 3; x < W - 3; x += 4) p.rect(x, H - 13, 1, 9, CREAM); }
    if (lv >= 6) { p.rect(W / 2 - 1, 0, 2, 4, "#f2c230"); p.rect(W / 2, 0, 5, 3, "#c83a3a"); }
  },
  gate: (p, W, H) => {
    shadowUnder(p, W, H);
    for (const x of [2, W - 9]) { p.rect(x, 10, 7, H - 12, STONE); walls(p, x, 10, 7, H - 12, "#8a8f98", "stone"); }
    p.rect(1, 6, W - 2, 6, "#a0a4ac"); p.rect(1, 6, W - 2, 1, hs("#a0a4ac", 0.3)); p.rect(1, 11, W - 2, 1, outline("#a0a4ac"));
    p.rect(9, 12, W - 18, H - 14, "#2a1650");
    for (let i = 0; i < 8; i++) p.px(10 + ((i * 5) % (W - 20)), 14 + i * 3, i % 2 ? "#c8a0ff" : "#7a4ad8");
    p.rect(W / 2 - 2, 7, 4, 3, "#b08aff");
  },
  farm: (p, W, H) => {
    // tilled soil with furrows
    const soil = "#7a5230";
    p.rect(1, 17, 14, 14, soil);
    for (let y = 18; y < 31; y += 3) { p.rect(2, y, 12, 1, hs(soil, -0.28)); p.rect(2, y + 1, 12, 1, hs(soil, 0.12)); }
    p.rect(1, 17, 14, 1, hs(soil, 0.25)); p.rect(1, 30, 14, 1, outline(soil)); p.rect(1, 17, 1, 14, outline(soil)); p.rect(14, 17, 1, 14, outline(soil));
  },
  well: (p, W, H) => {
    shadowUnder(p, W, H);
    p.rect(2, 20, 12, 9, STONE); walls(p, 2, 20, 12, 9, "#9a9aa0", "stone");
    p.rect(3, 20, 10, 2, "#2a4a7a"); p.px(5, 20, "#6aa0d8");
    p.rect(2, 8, 2, 12, DARKWOOD); p.rect(12, 8, 2, 12, DARKWOOD);
    roof(p, 0, 3, 16, 6, "#b84a3a");
    p.rect(7, 12, 1, 5, "#c8a070"); p.rect(6, 17, 3, 3, "#8a5a2a");
  },
  sprinkler: (p) => { p.rect(7, 22, 2, 8, "#8a8f96"); p.blob(8, 21, 3, 2, "#c8ccd4"); p.px(7, 20, "#6ab8ff"); p.g.fillStyle = "rgba(120,190,255,.6)"; for (let i = 0; i < 6; i++) p.g.fillRect(2 + i * 2.4, 16 + Math.abs(2.5 - i), 1, 1); },
  compost: (p, W, H) => { shadowUnder(p, W, H); p.rect(1, 20, 14, 10, WOOD); walls(p, 1, 20, 14, 10, WOOD, "wood"); p.rect(2, 19, 12, 3, "#5a3a1e"); for (const [x, c] of [[3, "#6fae4a"], [7, "#8a6a3a"], [11, "#a0c050"]] as const) p.rect(x, 18, 2, 2, c); },
  greenhouse: (p, W, H, lv) => {
    shadowUnder(p, W, H);
    p.rect(2, 14, W - 4, H - 18, "#a8dce8");
    for (let x = 2; x < W - 2; x += 6) p.rect(x, 14, 1, H - 18, "#f0fcff");
    for (let y = 22; y < H - 4; y += 8) p.rect(2, y, W - 4, 1, "#f0fcff");
    p.rect(2, 14, 1, H - 18, outline("#a8dce8")); p.rect(W - 3, 14, 1, H - 18, outline("#a8dce8"));
    for (let i = 0; i < 12; i++) { const w = W - 4 - i * 3; if (w < 4) break; p.rect(2 + i * 1.5, 13 - i, w, 1, i % 2 ? "#c8f0f8" : "#e8fcff"); }
    for (let x = 6; x < W - 6; x += 7) { p.rect(x, H - 12, 4, 6, "#4f9a35"); p.blob(x + 2, H - 13, 2, 2, lv > 1 ? "#e84a6a" : "#6fcf5a"); }
    foundation(p, 0, H - 4, W, 4);
    door(p, W / 2 - 3, H - 13, "#a8dce8");
  },
  coop: (p, W, H, lv) => {
    house(p, W, H, { wall: "#c8945a", roof: "#8a4a2a", wallKind: "wood" });
    p.rect(3, H - 10, 5, 5, "#3a2a1a"); p.line(3, H - 4, 8, H - 8, WOOD, 2);
    p.blob(W - 6, H - 3, 2, 2, "#ffffff"); p.px(W - 5, H - 4, "#e84a2a");
    if (lv >= 2) p.blob(W - 10, H - 3, 2, 2, "#e8e0c8");
  },
  barn: (p, W, H) => {
    shadowUnder(p, W, H);
    const red = "#b8442e";
    walls(p, 1, 12, W - 2, H - 15, red, "wood");
    for (const x of [1, W - 3]) p.rect(x, 12, 2, H - 15, CREAM);
    roof(p, 0, 2, W, 11, "#6a3a2a", "slate");
    p.rect(W / 2 - 3, 4, 6, 5, CREAM); p.rect(W / 2 - 2, 5, 4, 3, "#3a2a1a");
    barnDoor(p, W / 2 - 7, H - 15, 14, 12, hs(red, -0.1));
    foundation(p, 0, H - 3, W, 3);
  },
  beehive: (p, W, H) => { shadowUnder(p, W, H); p.rect(3, 15, 10, 14, "#f0e4c0"); walls(p, 3, 15, 10, 14, "#f0e4c0", "wood"); p.rect(2, 13, 12, 3, "#c89a5a"); p.rect(6, 25, 4, 1, "#3a2a1a"); p.px(13, 12, "#ffe45a"); p.px(1, 17, "#ffe45a"); p.rect(4, 29, 8, 2, DARKWOOD); },
  fishpond: (p, W, H) => {
    p.g.fillStyle = "#8a8f96"; p.g.beginPath(); p.g.ellipse(W / 2, H / 2 + 8, W / 2 - 1, H / 2 - 7, 0, 0, Math.PI * 2); p.g.fill();
    p.g.fillStyle = "#3a7ab8"; p.g.beginPath(); p.g.ellipse(W / 2, H / 2 + 8, W / 2 - 4, H / 2 - 10, 0, 0, Math.PI * 2); p.g.fill();
    p.rect(8, H / 2 + 4, 6, 1, "#8ac0e8"); p.rect(16, H / 2 + 12, 4, 1, "#8ac0e8");
    p.blob(10, H / 2 + 10, 2, 1, "#f28a3a"); p.blob(22, H / 2 + 5, 2, 1, "#e8e8f0");
    p.rect(4, 12, 2, 6, "#4f9a35"); p.rect(W - 6, H - 8, 2, 5, "#4f9a35"); p.blob(W - 8, H / 2 + 12, 3, 1.5, "#4fae4a");
  },
  silkhouse: (p, W, H) => house(p, W, H, { wall: "#f0e0c0", roof: "#c89a5a", wallKind: "plaster", roofKind: "thatch", emblem: "wool" }),
  lumber: (p, W, H) => {
    shadowUnder(p, W, H);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) { const x = 4 + j * 8 + i * 4, y = H - 8 - i * 6; p.blob(x, y, 4, 3, "#9a6a3a"); p.blob(x, y, 2, 1.5, "#e0b880", { outline: false }); }
    p.rect(W - 8, 10, 2, 18, DARKWOOD); p.rect(W - 14, 10, 14, 2, DARKWOOD); p.line(W - 11, 12, W - 4, 20, "#c8ccd4", 2);
  },
  quarry: (p, W, H) => {
    shadowUnder(p, W, H);
    p.blob(W / 2, H - 10, W / 2 - 2, 9, "#8a8f96"); p.blob(10, H - 7, 6, 5, "#a0a4ac"); p.blob(W - 9, H - 6, 5, 4, "#7a7e86");
    p.line(W - 12, 12, W - 4, 22, DARKWOOD, 2); p.line(W - 14, 13, W - 8, 11, "#c8ccd4", 2);
  },
  mine: (p, W, H) => {
    p.blob(W / 2, H - 12, W / 2, 14, "#7a6a5a");
    p.rect(W / 2 - 7, H - 16, 14, 13, "#1a1414");
    p.rect(W / 2 - 8, H - 18, 16, 3, WOOD); p.rect(W / 2 - 8, H - 18, 2, 16, WOOD); p.rect(W / 2 + 6, H - 18, 2, 16, WOOD);
    p.rect(4, H - 4, W - 8, 2, "#6a5a4a"); p.blob(W - 6, H - 6, 4, 3, "#c8a040");
  },
  herbgarden: (p, W, H) => {
    for (const [x, y] of [[2, 18], [18, 18], [2, 32], [18, 32]]) {
      if (y + 12 > H) continue;
      p.rect(x, y, 12, 10, WOOD); p.rect(x + 1, y + 1, 10, 7, "#6a4428");
      for (let i = 0; i < 3; i++) { p.rect(x + 2 + i * 3, y + 2, 2, 4, "#4f9a35"); p.px(x + 2 + i * 3, y + 1, "#8ad86a"); }
    }
  },
  market: (p, W, H) => {
    shadowUnder(p, W, H);
    p.rect(3, H - 14, W - 6, 10, WOOD); walls(p, 3, H - 14, W - 6, 10, WOOD, "wood");
    for (let x = 2; x < W - 2; x += 4) { p.rect(x, 10, 4, 7, Math.floor(x / 4) % 2 ? "#e84a4a" : "#f8f0e0"); p.rect(x, 17, 4, 1, "#a83a3a"); }
    p.rect(2, 9, W - 4, 1, outline("#e84a4a"));
    p.rect(3, 17, 1, H - 21, DARKWOOD); p.rect(W - 4, 17, 1, H - 21, DARKWOOD);
    for (let x = 6; x < W - 6; x += 5) p.blob(x + 1, H - 16, 2, 2, ["#f28a3a", "#e84a4a", "#8ad86a", "#f7d44c"][Math.floor(x / 5) % 4]);
    sign(p, W / 2 - 5, 0, "coin");
  },
  tent: (p, W, H) => {
    shadowUnder(p, W, H);
    for (let i = 0; i < 14; i++) { const w = 2 + i; p.rect(8 - w / 2, 16 + i, w, 1, i % 3 ? "#d8b078" : "#c09860"); }
    p.rect(6, 24, 4, 6, "#3a2a1a"); p.rect(8, 12, 1, 5, DARKWOOD); p.rect(9, 12, 4, 2, "#c83a3a");
  },
  training: (p, W, H) => {
    for (const x of [7, 22]) { p.rect(x, 20, 2, H - 22, WOOD); p.blob(x + 1, 18, 5, 5, "#d8c090"); p.blob(x + 1, 18, 3, 3, "#c83a3a", { outline: false }); p.blob(x + 1, 18, 1.5, 1.5, "#f8f0e0", { outline: false }); p.rect(x - 4, 26, 10, 2, WOOD); }
    p.rect(2, H - 5, W - 4, 2, hs(WOOD, -0.2));
  },
  lamp: (p) => { p.rect(7, 12, 2, 18, "#3a3a4a"); p.rect(6, 29, 4, 2, "#3a3a4a"); p.rect(5, 7, 6, 6, "#3a3a4a"); p.rect(6, 8, 4, 4, "#ffe07a"); p.rect(4, 6, 8, 1, "#2a2a3a"); p.g.fillStyle = "rgba(255,224,122,.25)"; p.g.beginPath(); p.g.arc(8, 10, 7, 0, Math.PI * 2); p.g.fill(); },
  flowers: (p) => {
    p.rect(1, 22, 14, 9, "#6a4428"); p.rect(1, 22, 14, 1, "#8a5a38"); p.rect(1, 30, 14, 1, outline("#6a4428"));
    const cols = ["#e84a6a", "#f7d44c", "#ffffff", "#b88aff", "#f28a3a"];
    for (let i = 0; i < 6; i++) { const x = 3 + (i % 3) * 4, y = 20 + Math.floor(i / 3) * 4; p.rect(x, y + 2, 1, 3, "#4f9a35"); p.px(x - 1, y, cols[i % 5]); p.px(x + 1, y, cols[i % 5]); p.px(x, y - 1, cols[i % 5]); p.px(x, y + 1, cols[i % 5]); p.px(x, y, "#fff3a0"); }
  },
  tree: (p) => {
    p.g.fillStyle = "rgba(20,10,40,.28)"; p.g.beginPath(); p.g.ellipse(8, 30, 7, 2, 0, 0, Math.PI * 2); p.g.fill();
    p.column(6, 18, 4, 13, "#7a4a2a");
    p.blob(8, 11, 8, 8, "#3f8a3a"); p.blob(5, 9, 4, 4, "#4f9a45"); p.blob(11, 12, 4, 4, "#3f8a3a"); p.blob(7, 7, 4, 3, "#5aaa4a", { hi: 0.4 });
    for (const [x, y] of [[4, 11], [11, 8], [8, 14]]) { p.px(x, y, "#e84a3a"); p.px(x + 1, y, "#f07a5a"); }
  },
  fountain: (p, W, H) => {
    p.g.fillStyle = "#a8a8b0"; p.g.beginPath(); p.g.ellipse(W / 2, H - 10, W / 2 - 1, 8, 0, 0, Math.PI * 2); p.g.fill();
    p.g.fillStyle = "#4a9ad8"; p.g.beginPath(); p.g.ellipse(W / 2, H - 10, W / 2 - 4, 5, 0, 0, Math.PI * 2); p.g.fill();
    p.rect(W / 2 - 4, H - 12, 3, 1, "#a8d8ff");
    p.column(W / 2 - 2, 14, 4, H - 25, "#c8c8d0"); p.blob(W / 2, 14, 5, 2, "#c8c8d0");
    p.g.fillStyle = "rgba(160,220,255,.85)"; for (let i = 0; i < 5; i++) p.g.fillRect(W / 2 - 6 + i * 3, 9 + Math.abs(2 - i), 1, 4);
  },
  statue: (p) => { p.rect(3, 24, 10, 7, "#9a9aa0"); walls(p, 3, 24, 10, 7, "#9a9aa0", "stone"); p.column(6, 10, 5, 14, "#c8c8c0"); p.blob(8, 8, 3, 3, "#c8c8c0"); p.line(11, 12, 14, 4, "#d8d8d0", 2); },
  park: (p, W, H) => {
    p.rect(1, 17, W - 2, H - 19, "#5aa83a");
    for (let i = 0; i < 30; i++) p.px(2 + ((i * 37) % (W - 4)), 18 + ((i * 17) % (H - 21)), "#4a9030");
    p.rect(W / 2 - 2, 17, 4, H - 19, "#d8c890"); p.rect(1, H - 14, W - 2, 3, "#d8c890");
    for (const [x, y] of [[8, 18], [W - 9, 18], [8, H - 8], [W - 9, H - 8]]) { p.column(x - 1, y, 3, 6, "#7a4a2a"); p.blob(x, y - 3, 6, 5, "#3f8a3a"); p.blob(x - 1, y - 5, 3, 2.5, "#5aaa4a"); }
    p.rect(W / 2 + 5, H - 20, 7, 2, WOOD); p.rect(W / 2 + 5, H - 18, 1, 2, DARKWOOD); p.rect(W / 2 + 11, H - 18, 1, 2, DARKWOOD);
  },
  arch: (p, W, H) => {
    p.column(2, 8, 3, H - 9, WOOD); p.column(W - 5, 8, 3, H - 9, WOOD);
    p.g.strokeStyle = "#4f9a35"; p.g.lineWidth = 3; p.g.beginPath(); p.g.arc(W / 2, 12, W / 2 - 4, Math.PI, 0); p.g.stroke();
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; p.rect(W / 2 + Math.cos(a) * (W / 2 - 4) - 1, 12 + Math.sin(a) * (W / 2 - 4) - 1, 2, 2, ["#f78fb3", "#ffffff", "#f7d44c"][i % 3]); }
  },
  wall: (p, W, H) => { walls(p, 0, 10, 16, H - 11, "#9a9aa0", "stone"); for (let x = 0; x < 16; x += 6) { p.rect(x, 6, 4, 4, "#a8a8b0"); p.rect(x, 6, 4, 1, hs("#a8a8b0", 0.3)); } },
  watchtower: (p, W, H) => {
    shadowUnder(p, W, H);
    p.rect(3, 12, 10, H - 13, WOOD); walls(p, 3, 12, 10, H - 13, WOOD, "log");
    p.rect(1, 8, 14, 5, DARKWOOD); for (let x = 2; x < 15; x += 3) p.rect(x, 9, 1, 4, WOOD);
    roof(p, 0, 1, 16, 7, "#6a3a2a"); windowAt(p, 5, 16, false, true);
  },
  palace: (p, W, H) => {
    house(p, W, H, { wall: "#f0e8d8", roof: "#d8a830", wallKind: "plaster", roofKind: "tile", floors: 2, lit: true });
    for (const x of [1, W - 9]) { p.rect(x, 2, 8, H - 6, "#e8e0d0"); walls(p, x, 6, 8, H - 10, "#e8e0d0", "stone"); roof(p, x - 1, 0, 10, 7, "#d8a830", "tile"); }
    p.rect(W / 2 - 1, 0, 2, 5, "#f2c230"); p.rect(W / 2 + 1, 0, 5, 3, "#c83a3a");
  },
  orchard: (p, W, H) => {
    p.rect(1, 18, W - 2, H - 20, "#5aa83a");
    for (let i = 0; i < 24; i++) p.px(2 + ((i * 37) % (W - 4)), 19 + ((i * 17) % (H - 22)), "#4a9030");
    for (const [x, y, f] of [[8, 22, "#e8303a"], [24, 20, "#f0902a"], [40, 22, "#e8303a"], [16, 34, "#d8d060"], [32, 34, "#e8303a"]] as const) {
      p.g.fillStyle = "rgba(20,10,40,.25)"; p.g.beginPath(); p.g.ellipse(x, y + 12, 6, 2, 0, 0, Math.PI * 2); p.g.fill();
      p.column(x - 1, y + 2, 3, 10, "#7a4a2a"); p.blob(x, y, 7, 6, "#3f8a3a"); p.blob(x - 2, y - 2, 3, 2.5, "#5aaa4a", { outline: false });
      for (const [dx, dy] of [[-3, 0], [2, -2], [3, 2], [-1, 3]]) { p.px(x + dx, y + dy, f); p.px(x + dx, y + dy - 1, hs(f, 0.4)); }
    }
  },
  windmill: (p, W, H) => {
    shadowUnder(p, W, H);
    for (let y = 14; y < H - 3; y++) { const w = 8 + (y - 14) * 0.35; p.rect(W / 2 - w, y, w * 2, 1, y % 3 ? "#e8dcc0" : "#d8c8a8"); }
    p.rect(W / 2 - 9, H - 4, 18, 2, hs(STONE, -0.1)); door(p, W / 2 - 3, H - 13, DARKWOOD);
    roof(p, W / 2 - 10, 6, 20, 9, "#8a3a2a");
    p.g.save(); p.g.translate(W / 2, 14); p.g.rotate(0.35);
    for (let i = 0; i < 4; i++) { p.g.rotate(Math.PI / 2); p.g.fillStyle = "#7a4a2a"; p.g.fillRect(-1, 0, 2, 14); p.g.fillStyle = "#f4efe6"; p.g.fillRect(1, 3, 4, 10); p.g.fillStyle = "#c8b890"; p.g.fillRect(1, 3, 4, 1); }
    p.g.restore(); p.blob(W / 2, 14, 2, 2, "#5a3a1e");
  },
  fisherhut: (p, W, H) => {
    p.g.fillStyle = "#4a9ad8"; p.g.fillRect(0, H - 9, W, 8); p.g.fillStyle = "#6ab8f0"; for (let x = 2; x < W; x += 6) p.g.fillRect(x, H - 7, 3, 1);
    for (const x of [3, W - 5]) p.rect(x, H - 14, 2, 12, DARKWOOD);
    p.rect(1, H - 15, W - 2, 2, WOOD);
    p.rect(4, 8, 14, H - 23, WOOD); walls(p, 4, 8, 14, H - 23, WOOD, "log"); roof(p, 2, 1, 18, 8, "#8a6a3a", "thatch"); door(p, 8, H - 23 - 1 + 6, DARKWOOD, 5, 8);
    p.line(W - 6, 6, W - 2, H - 8, "#c8a878"); p.line(W - 6, 6, W - 10, H - 16, "#8a5a2a", 1);
  },
  observatory: (p, W, H) => {
    shadowUnder(p, W, H);
    walls(p, 3, 20, W - 6, H - 23, "#b0b0b8", "stone"); foundation(p, 1, H - 4, W - 2, 4);
    p.g.fillStyle = "#3a4a8a"; p.g.beginPath(); p.g.arc(W / 2, 21, W / 2 - 4, Math.PI, 0); p.g.fill();
    p.g.fillStyle = "#5a6ab0"; p.g.beginPath(); p.g.arc(W / 2 - 3, 18, 6, Math.PI, 1.5 * Math.PI); p.g.fill();
    p.rect(W / 2 - 2, 8, 4, 13, "#1a1a2a"); p.line(W / 2, 12, W / 2 + 9, 3, "#c8a040", 2); p.rect(W / 2 + 8, 2, 3, 3, "#e8c860");
    for (const [x, y] of [[4, 6], [26, 4], [22, 10]]) p.px(x, y, "#fff6a0");
    door(p, W / 2 - 3, H - 13, DARKWOOD);
  },
  treehouse: (p, W, H) => {
    p.g.fillStyle = "rgba(20,10,40,.28)"; p.g.beginPath(); p.g.ellipse(W / 2, H - 3, 12, 3, 0, 0, Math.PI * 2); p.g.fill();
    p.column(W / 2 - 3, 20, 7, H - 22, "#7a4a2a");
    p.blob(W / 2, 12, 15, 11, "#3f8a3a"); p.blob(W / 2 - 6, 9, 6, 5, "#5aaa4a"); p.blob(W / 2 + 7, 14, 6, 5, "#3a7a32");
    p.rect(8, 16, 16, 10, WOOD); walls(p, 8, 16, 16, 10, WOOD, "wood"); roof(p, 6, 9, 20, 8, "#b84a3a"); windowAt(p, 13, 18, false, true);
    for (let y = 26; y < H - 3; y += 3) p.rect(W / 2 + 4, y, 5, 1, "#c8a070");
    p.rect(W / 2 + 4, 26, 1, H - 29, DARKWOOD); p.rect(W / 2 + 8, 26, 1, H - 29, DARKWOOD);
  },
  ...DECOR_DRAW,
};

/** Look of the remaining (shop / housing / service) buildings. */
const HOUSES: Record<string, HouseOpts> = {
  kitchen: { wall: "#d8b888", roof: "#8a5a3a", wallKind: "plaster", chimney: true, emblem: "bowl" },
  forge: { wall: "#8a8a92", roof: "#4a4a58", wallKind: "stone", chimney: true, emblem: "ingot" },
  sawmill: { wall: "#b07a48", roof: "#6a4a2a", wallKind: "log", emblem: "plank" },
  workshop: { wall: "#a0a4aa", roof: "#5a5e6a", wallKind: "stone", emblem: "block" },
  tailor: { wall: "#e0c8d8", roof: "#8a4a6a", wallKind: "plaster", emblem: "cloth" },
  alchemy: { wall: "#8a9a78", roof: "#3a6a4a", wallKind: "stone", chimney: true, emblem: "potion" },
  library: { wall: "#c8c0d8", roof: "#3a4a9a", wallKind: "stone", emblem: "book" },
  cottage: { wall: "#c8945a", roof: "#b84a3a", wallKind: "wood", chimney: true },
  stonehouse: { wall: "#b0b0a8", roof: "#4a5a8a", wallKind: "stone", chimney: true },
  manor: { wall: "#ece4d4", roof: "#6a2a5a", wallKind: "plaster", chimney: true, floors: 2 },
  apartment: { wall: "#d0c8b8", roof: "#3a3a4a", wallKind: "stone", floors: 3 },
  tavern: { wall: "#b07a48", roof: "#6a2a1a", wallKind: "wood", chimney: true, emblem: "cup" },
  academy: { wall: "#d8d0e8", roof: "#4a3a8a", wallKind: "stone", floors: 2, emblem: "book" },
  temple: { wall: "#f4f0e4", roof: "#2a8a5a", wallKind: "plaster", roofKind: "tile", emblem: "herb" },
  clinic: { wall: "#f4f4f4", roof: "#c83a3a", wallKind: "plaster", emblem: "potion" },
  warehouse: { wall: "#9a7a4a", roof: "#5a4a2a", wallKind: "wood", emblem: "plank" },
};

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
    house(p, W, H, { ...o, floors: Math.min((o.floors ?? 1) + (level >= 3 && tw >= 3 ? 1 : 0), 3) });
    if (level >= 2) { p.rect(3, 3, 1, 7, DARKWOOD); p.rect(4, 3, 4, 3, level >= 3 ? "#f2c230" : "#c83a3a"); }
  }
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------ crops (16x16 overlay on a farm plot)
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
