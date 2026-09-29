import { BUILDINGS } from "../data/buildings";

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
    default:
      px(g, 2, base + 2, W - 4, H - base - 4, "#888");
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
  const fruit: Record<string, string> = {
    wheat: "#f2c542", moon_radish: "#f0f0ff", fire_berry: "#e8402a", silver_herb: "#c8d8e0",
    spirit_mushroom: "#b88aff", golden_date: "#c8902a", star_pumpkin: "#ff9a2a", ghost_lotus: "#e0c8ff",
  };
  const col = fruit[cropId] ?? "#fff";
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
