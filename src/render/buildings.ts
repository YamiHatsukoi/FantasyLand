import { BUILDINGS } from "../data/buildings";
import { CROPS, getItem } from "../data/items";
import { iconCanvas, shade } from "./icons";

/** Procedurally drawn pixel-art buildings (16 px per tile). */
const cache = new Map<string, HTMLCanvasElement>();

type G = CanvasRenderingContext2D;
const K = "#1b1b2a";

function px(g: G, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function outline(g: G, x: number, y: number, w: number, h: number) {
  px(g, x, y, w, 1, K); px(g, x, y + h - 1, w, 1, K); px(g, x, y, 1, h, K); px(g, x + w - 1, y, 1, h, K);
}

function roof(g: G, x: number, y: number, w: number, h: number, c1: string, c2: string) {
  for (let i = 0; i < h; i++) {
    const inset = Math.max(0, Math.round(((h - i) / h) * (w / 2 - 2)));
    px(g, x + inset, y + i, w - inset * 2, 1, i % 3 === 0 ? c2 : c1);
    px(g, x + inset, y + i, 1, 1, K);
    px(g, x + w - inset - 1, y + i, 1, 1, K);
  }
  px(g, x + Math.round(w / 2) - 2, y - 1, 4, 1, K);
}

function wall(g: G, x: number, y: number, w: number, h: number, c: string, dark: string) {
  px(g, x, y, w, h, c);
  for (let yy = y + 2; yy < y + h; yy += 3) px(g, x, yy, w, 1, dark);
  outline(g, x, y, w, h);
}

function door(g: G, x: number, y: number) {
  px(g, x, y, 5, 7, "#5a3a1e"); px(g, x + 1, y + 1, 3, 6, "#7a5230"); px(g, x + 3, y + 4, 1, 1, "#f2c230"); outline(g, x, y, 5, 7);
}

function window_(g: G, x: number, y: number, lit = true) {
  px(g, x, y, 5, 4, K); px(g, x + 1, y + 1, 3, 2, lit ? "#ffe07a" : "#4a6a8a"); px(g, x + 2, y + 1, 1, 2, K);
}

/** Generic house-like building using the def's style colours and an item-icon emblem sign. */
function genericBuilding(g: G, type: string, level: number, W: number, H: number, base: number) {
  const def = BUILDINGS[type];
  const cat = def?.category ?? "core";
  const fallback: Record<string, { wall: string; roof: string }> = {
    core: { wall: "#d8c8a0", roof: "#9a3a2a" }, farm: { wall: "#c8a070", roof: "#8a5a2a" }, production: { wall: "#9a8a6a", roof: "#5a4a3a" },
    craft: { wall: "#a8a098", roof: "#5a4a6a" }, housing: { wall: "#d0b890", roof: "#8a3a2a" }, service: { wall: "#e0d8c8", roof: "#3a6a8a" }, decor: { wall: "#b0b0a8", roof: "#6a6a72" },
  };
  const st: { wall: string; roof: string; emblem?: string } = def?.style ?? fallback[cat];
  const tw = def?.size[0] ?? 1, th = def?.size[1] ?? 1;
  const tall = type === "apartment" || type === "palace" || type === "manor";
  const roofH = Math.max(8, Math.round(th * 5 + (tall ? 0 : 4)));
  const wallTop = Math.max(4, base + th * 4 - roofH + (tall ? -10 : 0));
  const wallH = H - 3 - (wallTop + roofH - 3);
  wall(g, 3, wallTop + roofH - 3, W - 6, wallH, st.wall, shade(st.wall, -0.12));
  roof(g, 1, wallTop, W - 2, roofH, st.roof, shade(st.roof, -0.2));
  // windows: rows of windows depend on height, columns on width
  const floors = tall ? Math.max(2, th + level - 1) : 1;
  const rowGap = Math.max(7, Math.floor((wallH - 10) / Math.max(1, floors)));
  for (let f = 0; f < floors; f++) {
    const y = wallTop + roofH + 1 + f * rowGap;
    if (y > H - 14) break;
    for (let x = 6; x < W - 10; x += 10) if (Math.abs(x + 2 - W / 2) > 4 || f > 0) window_(g, x, y, (x + f) % 3 !== 0);
  }
  door(g, Math.round(W / 2) - 2, H - 10);
  // emblem sign
  if (st.emblem) {
    const ic = iconCanvas(st.emblem, emblemPal(st.emblem), 1);
    const sx = tw >= 3 ? W - 16 : W - 13, sy = wallTop + roofH - 1;
    px(g, sx - 1, sy - 1, 12, 12, "#3a2a1a"); px(g, sx, sy, 10, 10, "#e8dcc0");
    g.drawImage(ic, 0, 0, 16, 16, sx, sy, 10, 10);
  }
  // level flourishes
  if (level >= 2) { px(g, 4, wallTop + 2, 1, 6, K); px(g, 5, wallTop + 2, 4, 3, level >= 3 ? "#f2c230" : "#c83a3a"); }
  if (type === "palace") { px(g, W / 2 - 1, 0, 2, 4, "#f2c230"); px(g, 6, 2, 3, wallTop, "#e8e0d0"); px(g, W - 9, 2, 3, wallTop, "#e8e0d0"); }
}

const EMBLEM_PAL: Record<string, [string, string, string]> = {
  egg: ["#f4efe6", "#d8c8a0", "#ffffff"], bottle: ["#f4f4f4", "#a0c8e8", "#ffffff"], wool: ["#f4f4f4", "#c8c8c8", "#ffffff"],
  log: ["#8a5a2a", "#c8a070", "#5a3a1e"], stone: ["#8a8f96", "#6a6e76", "#b0b4ba"], ore: ["#6a6e76", "#e08a3a", "#f2c542"],
  coin: ["#f2c542", "#c8902a", "#fff4b0"], bowl: ["#c8a070", "#f2c542", "#e04a2a"], ingot: ["#b0b4ba", "#e8e8f0", "#6a6e76"],
  plank: ["#c8a070", "#8a5a2a", "#e8c890"], block: ["#9a9ea4", "#6a6e76", "#c0c4ca"], cloth: ["#c870a0", "#f0c0d8", "#8a3a6a"],
  potion: ["#e04a4a", "#c8e0f0", "#ffffff"], book: ["#3a4a9a", "#f2c542", "#ffffff"], cup: ["#c8a070", "#f2e0a0", "#ffffff"], herb: ["#4ab04a", "#2a7a3a", "#a0e080"],
};
const emblemPal = (shape: string) => EMBLEM_PAL[shape] ?? ["#f2c542", "#8a5a2a", "#ffffff"];

export function buildingCanvas(type: string, level: number): HTMLCanvasElement {
  const key = `${type}:${level}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = BUILDINGS[type];
  const [tw, th] = def?.size ?? [1, 1];
  const W = tw * 16, H = th * 16 + 16; // extra headroom for roofs
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const base = 16; // top of the footprint
  // soft shadow
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(2, H - 5, W - 4, 4);

  switch (type) {
    case "house": {
      const roofC = ["#9a3a2a", "#a8452a", "#6a4aa0", "#2a6a9a", "#c89a2a"][level - 1] ?? "#9a3a2a";
      wall(g, 4, base + 10, W - 8, H - base - 13, "#d8c8a0", "#c4b088");
      roof(g, 1, 2, W - 2, base + 9, roofC, "#00000033");
      door(g, W / 2 - 2, H - 10);
      window_(g, 9, base + 16);
      window_(g, W - 14, base + 16);
      if (level >= 2) { px(g, W - 14, 4, 4, 10, "#7a6a5a"); outline(g, W - 14, 4, 4, 10); }
      if (level >= 3) { px(g, 6, 2, 1, 8, K); px(g, 7, 2, 5, 3, "#f2c230"); }
      if (level >= 4) window_(g, W / 2 - 2, base + 1);
      if (level >= 5) { px(g, W / 2 - 1, 0, 2, 3, "#f2c230"); }
      break;
    }
    case "gate": {
      px(g, 2, 6, 7, H - 9, "#8a8f96"); px(g, W - 9, 6, 7, H - 9, "#8a8f96");
      outline(g, 2, 6, 7, H - 9); outline(g, W - 9, 6, 7, H - 9);
      px(g, 2, 3, W - 4, 5, "#a0a5ac"); outline(g, 2, 3, W - 4, 5);
      px(g, 9, 8, W - 18, H - 11, "#2a1a4a");
      for (let i = 0; i < 6; i++) px(g, 10 + ((i * 3) % (W - 20)), 10 + i * 3, 3, 1, i % 2 ? "#b08aff" : "#7a4ad8");
      px(g, W / 2 - 2, 4, 4, 3, "#b08aff");
      break;
    }
    case "farm": {
      px(g, 1, base + 1, 14, 14, "#6a4a2a");
      for (let y = base + 3; y < base + 15; y += 3) px(g, 2, y, 12, 1, "#4a321a");
      outline(g, 1, base + 1, 14, 14);
      break;
    }
    case "kitchen": {
      wall(g, 3, base + 8, W - 6, H - base - 11, "#c8a878", "#b09060");
      roof(g, 1, base - 4, W - 2, 13, "#7a5a3a", "#00000022");
      px(g, W - 10, 1, 4, 12, "#6a5a4a"); outline(g, W - 10, 1, 4, 12);
      px(g, W - 9, 0, 2, 1, "#aaaaaa");
      door(g, 6, H - 10);
      px(g, W - 12, H - 9, 6, 5, K); px(g, W - 11, H - 8, 4, 3, "#ff9a3a");
      break;
    }
    case "forge": {
      wall(g, 2, base + 4, W - 4, H - base - 7, "#7a7a82", "#65656c");
      px(g, 1, base, W - 2, 5, "#4a4a52"); outline(g, 1, base, W - 2, 5);
      px(g, 5, base + 9, 9, 8, K); px(g, 6, base + 10, 7, 6, "#ff6a2a"); px(g, 8, base + 12, 3, 3, "#ffe45a");
      px(g, W - 13, H - 10, 9, 3, "#3a3a44"); px(g, W - 11, H - 7, 5, 3, "#3a3a44"); outline(g, W - 13, H - 10, 9, 3);
      px(g, W - 8, base - 6, 5, 10, "#5a5a62"); outline(g, W - 8, base - 6, 5, 10);
      break;
    }
    case "alchemy": {
      wall(g, 3, base + 8, W - 6, H - base - 11, "#7a8a6a", "#6a7a5a");
      roof(g, 1, base - 6, W - 2, 15, "#3a6a4a", "#00000022");
      door(g, 6, H - 10);
      px(g, W - 13, H - 9, 8, 6, K); px(g, W - 12, H - 8, 6, 4, "#3a3a3a"); px(g, W - 11, H - 10, 4, 2, "#6aff6a");
      px(g, W - 10, H - 13, 2, 2, "#8aff8a88");
      break;
    }
    case "library": {
      wall(g, 3, base + 2, W - 6, H - base - 5, "#b8b0d0", "#a098c0");
      roof(g, 1, 0, W - 2, base + 3, "#3a4a9a", "#00000022");
      door(g, W / 2 - 2, H - 10);
      window_(g, 6, base + 7); window_(g, W - 11, base + 7);
      px(g, W / 2 - 1, 2, 2, 2, "#c8e8ff");
      break;
    }
    case "well": {
      px(g, 2, base + 6, 12, 8, "#8a8f96"); outline(g, 2, base + 6, 12, 8);
      px(g, 4, base + 7, 8, 3, "#2a5a8a");
      px(g, 2, base - 4, 1, 10, "#5a3a1e"); px(g, 13, base - 4, 1, 10, "#5a3a1e");
      px(g, 1, base - 6, 14, 3, "#9a3a2a"); outline(g, 1, base - 6, 14, 3);
      break;
    }
    case "training": {
      for (const x of [5, 18]) {
        px(g, x + 3, base + 6, 2, 16, "#7a5230");
        px(g, x, base + 2, 8, 8, "#d8c090"); outline(g, x, base + 2, 8, 8);
        px(g, x + 2, base + 4, 4, 4, "#c83a3a"); px(g, x + 3, base + 5, 2, 2, "#f4efe6");
      }
      px(g, 2, H - 6, W - 4, 2, "#8a6a42");
      break;
    }
    case "lamp": {
      px(g, 7, base - 2, 2, 16, "#4a4a52");
      px(g, 5, base - 6, 6, 5, K); px(g, 6, base - 5, 4, 3, "#ffe07a");
      g.fillStyle = "rgba(255,224,122,0.25)";
      g.beginPath(); g.arc(8, base - 4, 7, 0, Math.PI * 2); g.fill();
      break;
    }
    case "flowers": {
      px(g, 1, base + 6, 14, 9, "#5a3a1e"); outline(g, 1, base + 6, 14, 9);
      const cols = ["#f78fb3", "#f7d44c", "#ffffff", "#b3a4ff", "#ff6a6a"];
      for (let i = 0; i < 7; i++) { const x = 3 + ((i * 5) % 10), y = base + 4 + (i % 3) * 3; px(g, x, y + 2, 1, 3, "#3f8f3a"); px(g, x - 1, y, 3, 2, cols[i % cols.length]); }
      break;
    }
    case "tree": {
      px(g, 7, base + 4, 3, 10, "#6a4a2a");
      g.fillStyle = "#2c6b33"; g.beginPath(); g.arc(8.5, base, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4a9a4a"; g.beginPath(); g.arc(7, base - 1.5, 4.5, 0, Math.PI * 2); g.fill();
      for (const [x, y] of [[4, base - 2], [11, base + 1], [8, base - 5]]) px(g, x, y, 2, 2, "#ff5a3a");
      break;
    }
    case "tent": {
      for (let i = 0; i < 12; i++) px(g, 8 - Math.ceil(i / 2) - 1, base - 2 + i, Math.ceil(i / 2) * 2 + 2, 1, i % 3 ? "#c8a070" : "#a8804a");
      px(g, 7, base + 5, 3, 5, "#3a2a1a");
      px(g, 8, base - 5, 1, 4, "#5a3a1e"); px(g, 9, base - 5, 3, 2, "#c83a3a");
      break;
    }
    case "sprinkler": {
      px(g, 7, base + 4, 2, 10, "#6a6a72"); px(g, 5, base + 3, 6, 2, "#8a8f96"); outline(g, 5, base + 3, 6, 2);
      g.fillStyle = "rgba(120,190,255,0.55)";
      for (let i = 0; i < 6; i++) g.fillRect(2 + i * 2.4, base + 1 + Math.abs(2.5 - i), 1, 1);
      px(g, 3, base + 13, 10, 2, "#5a8ac0");
      break;
    }
    case "compost": {
      px(g, 2, base + 5, 12, 9, "#5a3a1e"); outline(g, 2, base + 5, 12, 9);
      px(g, 3, base + 6, 10, 3, "#6a4a1a");
      for (const [x, y, c] of [[4, 6, "#4a8a3a"], [8, 5, "#8a6a3a"], [11, 6, "#6a9a3a"]] as const) px(g, x, base + y, 2, 2, c);
      break;
    }
    case "beehive": {
      px(g, 7, base + 8, 2, 7, "#6a4a2a");
      for (let i = 0; i < 4; i++) px(g, 4 + (i === 0 || i === 3 ? 1 : 0), base - 2 + i * 3, i === 0 || i === 3 ? 6 : 8, 3, i % 2 ? "#e8b030" : "#f2c542");
      outline(g, 4, base - 2, 8, 12);
      px(g, 7, base + 5, 2, 2, K);
      px(g, 13, base - 4, 1, 1, "#ffe45a"); px(g, 2, base, 1, 1, "#ffe45a");
      break;
    }
    case "fishpond": {
      g.fillStyle = "#6a5a4a"; g.beginPath(); g.ellipse(W / 2, base + 16, W / 2 - 1, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2a6aa0"; g.beginPath(); g.ellipse(W / 2, base + 16, W / 2 - 4, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4a8ac8"; g.beginPath(); g.ellipse(W / 2 - 4, base + 13, 6, 3, 0, 0, Math.PI * 2); g.fill();
      px(g, 10, base + 18, 4, 2, "#f28a3a"); px(g, 20, base + 12, 3, 2, "#c8c8d8");
      px(g, 4, base + 8, 2, 6, "#3f8f3a"); px(g, W - 6, base + 20, 2, 5, "#3f8f3a");
      break;
    }
    case "greenhouse": {
      px(g, 2, base + 4, W - 4, H - base - 7, "#9ad8e8");
      for (let x = 2; x < W - 2; x += 6) px(g, x, base + 4, 1, H - base - 7, "#e8f8ff");
      for (let y = base + 10; y < H - 3; y += 8) px(g, 2, y, W - 4, 1, "#e8f8ff");
      outline(g, 2, base + 4, W - 4, H - base - 7);
      roof(g, 1, base - 8, W - 2, 13, "#b8e8f0", "#ffffff66");
      for (let x = 6; x < W - 6; x += 7) { px(g, x, H - 12, 3, 5, "#3f9a3a"); px(g, x, H - 13, 3, 2, "#6fcf5a"); }
      break;
    }
    case "wall": {
      px(g, 0, base - 2, 16, H - base, "#8a8f96");
      for (let y = base - 2; y < H - 2; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) px(g, x, y, 1, 4, "#6a6e76");
      for (let y = base + 2; y < H; y += 4) px(g, 0, y, 16, 1, "#6a6e76");
      for (let x = 0; x < 16; x += 6) px(g, x, base - 5, 4, 3, "#9a9fa6");
      outline(g, 0, base - 2, 16, H - base - 1);
      break;
    }
    case "watchtower": {
      px(g, 4, base - 8, 8, H - base + 6, "#8a6a42"); outline(g, 4, base - 8, 8, H - base + 6);
      px(g, 2, base - 12, 12, 5, "#a07a4a"); outline(g, 2, base - 12, 12, 5);
      roof(g, 1, 0, 14, 5, "#6a3a2a", "#00000022");
      window_(g, 6, base);
      break;
    }
    case "fountain": {
      g.fillStyle = "#b0b0a8"; g.beginPath(); g.ellipse(W / 2, H - 10, W / 2 - 2, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4a9ad8"; g.beginPath(); g.ellipse(W / 2, H - 10, W / 2 - 5, 5, 0, 0, Math.PI * 2); g.fill();
      px(g, W / 2 - 2, base - 2, 4, 14, "#c8c8c0"); px(g, W / 2 - 5, base - 3, 10, 2, "#c8c8c0");
      g.fillStyle = "rgba(160,220,255,0.8)";
      for (let i = 0; i < 5; i++) g.fillRect(W / 2 - 6 + i * 3, base - 6 + Math.abs(2 - i), 1, 3);
      break;
    }
    case "statue": {
      px(g, 3, H - 8, 10, 5, "#9a9a92"); outline(g, 3, H - 8, 10, 5);
      px(g, 6, base - 6, 4, 4, "#c8c8c0"); px(g, 5, base - 2, 6, 9, "#b8b8b0"); px(g, 11, base - 8, 1, 12, "#d8d8d0");
      outline(g, 5, base - 2, 6, 9);
      break;
    }
    case "park": {
      px(g, 1, base + 1, W - 2, H - base - 3, "#3f7a3a");
      px(g, W / 2 - 2, base + 1, 4, H - base - 3, "#c8b890"); px(g, 1, base + 18, W - 2, 3, "#c8b890");
      for (const [x, y] of [[8, base + 6], [W - 9, base + 6], [8, H - 10], [W - 9, H - 10]]) {
        g.fillStyle = "#2c6b33"; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#4a9a4a"; g.beginPath(); g.arc(x - 1, y - 2, 3.5, 0, Math.PI * 2); g.fill();
      }
      px(g, W / 2 + 4, base + 12, 6, 2, "#7a5230");
      break;
    }
    case "arch": {
      px(g, 2, base - 6, 3, H - base + 3, "#8a6a42"); px(g, W - 5, base - 6, 3, H - base + 3, "#8a6a42");
      g.strokeStyle = "#3f8f3a"; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, base - 2, W / 2 - 4, Math.PI, 0); g.stroke();
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; px(g, W / 2 + Math.cos(a) * (W / 2 - 4) - 1, base - 2 + Math.sin(a) * (W / 2 - 4) - 1, 2, 2, ["#f78fb3", "#ffffff", "#f7d44c"][i % 3]); }
      break;
    }
    default:
      genericBuilding(g, type, level, W, H, base);
  }
  cache.set(key, c);
  return c;
}

/** Crop growth overlay drawn on top of a farm plot (stage 0..3, 3 = ready). */
export function cropCanvas(cropId: string, stage: number): HTMLCanvasElement {
  const key = `crop:${cropId}:${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d")!;
  const it = getItem(cropId);
  const col = it.col[0];
  const kind = CROPS[cropId]?.kind ?? "crop";
  if (kind === "tree") {
    // saplings grow into a small fruit tree
    const hgt = [3, 6, 9, 10][stage];
    px(g, 7, 15 - hgt, 2, hgt, "#6a4a2a");
    if (stage >= 1) { g.fillStyle = "#2c6b33"; g.beginPath(); g.arc(8, 15 - hgt, 2 + stage * 1.5, 0, Math.PI * 2); g.fill(); }
    if (stage >= 3) for (const [x, y] of [[5, 4], [10, 6], [7, 2]]) { px(g, x, y, 2, 2, col); }
    cache.set(key, c);
    return c;
  }
  if (stage >= 3) {
    // ripe: draw the actual produce icon small on the plot
    for (const x of [2, 7]) { px(g, x + 2, 9, 1, 5, "#3f9a3a"); px(g, x + 1, 9, 3, 2, "#6fcf5a"); }
    g.drawImage(iconCanvas(it.shape, it.col, 1), 0, 0, 16, 16, 3, 0, 11, 11);
    cache.set(key, c);
    return c;
  }
  for (const x of [3, 7, 11]) {
    if (stage === 0) { px(g, x + 1, 11, 1, 2, "#6fcf5a"); continue; }
    const hgt = stage === 1 ? 4 : 7;
    px(g, x + 1, 14 - hgt, 1, hgt, "#3f9a3a");
    px(g, x, 13 - hgt, 3, 2, "#6fcf5a");
    if (stage >= 3) { px(g, x, 12 - hgt, 3, 3, col); px(g, x, 12 - hgt, 3, 1, K); }
  }
  cache.set(key, c);
  return c;
}
