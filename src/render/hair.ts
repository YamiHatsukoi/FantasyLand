import { hs } from "./palette";

/**
 * Anime-style hair built from parts: bangs, back length, side locks, volume and extras
 * (ponytails, buns, braids, drills, ahoge…). Every style draws on the 32x32 portrait and on
 * the 16x32 walking sprite (front, back and side views).
 */
export interface Pen {
  px(x: number, y: number, c: string | null): void;
  rect(x: number, y: number, w: number, h: number, c: string | null): void;
  line(x0: number, y0: number, x1: number, y1: number, c: string | null): void;
}

export type Bang = "none" | "blunt" | "spiky" | "side" | "split" | "curtain" | "eye" | "messy" | "wispy";
export type Extra =
  | "ahoge" | "pony" | "high_pony" | "side_pony" | "twintails" | "low_twintails" | "bun" | "twin_buns" | "braid" | "twin_braids"
  | "drills" | "mohawk" | "undercut" | "top_knot" | "ribbon" | "hairband" | "spikes" | "wave" | "curls";

export interface HairDef {
  id: string;
  name: string;
  bang: Bang;
  len: 0 | 1 | 2 | 3 | 4 | 5; // back length: buzz, short, neck, shoulder, back, hips
  side: 0 | 1 | 2 | 3; // locks in front of the ears
  vol?: 0 | 1 | 2; // 2 = big / fluffy
  extras?: Extra[];
}

const H = (id: string, name: string, bang: Bang, len: HairDef["len"], side: HairDef["side"], extras: Extra[] = [], vol: HairDef["vol"] = 1): HairDef => ({ id, name, bang, len, side, vol, extras });

/** 52 styles; old save names (short, spiky, long, …) are kept as ids. */
export const HAIR_STYLES: HairDef[] = [
  // short
  H("short", "Ngắn Gọn", "side", 1, 0),
  H("spiky", "Nhọn Anime", "spiky", 1, 1, ["spikes"]),
  H("buzz", "Húi Cua", "none", 0, 0, [], 0),
  H("crew", "Đầu Đinh", "blunt", 0, 0, [], 0),
  H("undercut", "Undercut", "side", 1, 0, ["undercut"]),
  H("mohawk", "Mohawk", "none", 0, 0, ["mohawk"], 0),
  H("slick", "Vuốt Ngược", "none", 1, 0, [], 1),
  H("messy", "Rối Bù", "messy", 1, 1, ["ahoge"]),
  H("bedhead", "Mới Ngủ Dậy", "messy", 1, 1, ["spikes", "ahoge"]),
  H("bowl", "Úp Tô", "blunt", 1, 1),
  H("pixie", "Pixie", "side", 1, 1),
  H("emo", "Che Một Mắt", "eye", 1, 1),
  H("curtain", "Rẽ Ngôi Giữa", "curtain", 1, 2),
  H("hero", "Nhân Vật Chính", "spiky", 2, 1, ["spikes", "ahoge"]),
  H("curly", "Xoăn Ngắn", "messy", 1, 1, ["curls"], 2),
  H("afro", "Afro", "none", 1, 0, ["curls"], 2),
  // medium
  H("bob", "Bob", "blunt", 2, 2),
  H("bob_side", "Bob Lệch", "side", 2, 2),
  H("hime_short", "Hime Ngắn", "blunt", 2, 3),
  H("wolf", "Wolf Cut", "messy", 2, 2, ["spikes"]),
  H("mullet", "Mullet", "spiky", 3, 1),
  H("shaggy", "Bù Xù Dài", "messy", 3, 2),
  H("wavy_mid", "Gợn Sóng Ngang Vai", "split", 3, 2, ["wave"]),
  H("layered", "Tỉa Tầng", "wispy", 3, 2),
  H("half_up", "Buộc Nửa Đầu", "side", 3, 2, ["top_knot"]),
  H("samurai", "Búi Samurai", "none", 2, 0, ["top_knot"], 1),
  H("man_bun", "Búi Sau Gáy", "side", 1, 1, ["bun"]),
  H("low_pony", "Đuôi Thấp", "split", 2, 1, ["pony"]),
  // long
  H("long", "Dài Thẳng", "split", 4, 2),
  H("long_blunt", "Dài Mái Bằng", "blunt", 4, 2),
  H("hime", "Hime Cut", "blunt", 5, 3),
  H("long_side", "Dài Mái Lệch", "side", 4, 2, ["ahoge"]),
  H("very_long", "Siêu Dài", "wispy", 5, 2),
  H("wavy_long", "Dài Gợn Sóng", "curtain", 4, 2, ["wave"]),
  H("curly_long", "Xoăn Dài", "messy", 4, 2, ["curls"], 2),
  H("long_ahoge", "Dài Có Ahoge", "spiky", 4, 2, ["ahoge"]),
  H("hairband", "Băng Đô", "none", 4, 2, ["hairband"]),
  H("ribbon", "Nơ Xinh", "blunt", 4, 2, ["ribbon"]),
  // tied
  H("ponytail", "Đuôi Ngựa", "side", 1, 1, ["high_pony"]),
  H("pony_long", "Đuôi Ngựa Dài", "spiky", 1, 2, ["high_pony", "ahoge"]),
  H("side_pony", "Đuôi Lệch", "side", 1, 1, ["side_pony"]),
  H("twintails", "Hai Bím Cao", "blunt", 1, 1, ["twintails"]),
  H("twintails_long", "Hai Bím Dài", "spiky", 1, 2, ["twintails", "ribbon"]),
  H("low_twintails", "Hai Bím Thấp", "split", 1, 1, ["low_twintails"]),
  H("bun", "Búi Tròn", "side", 1, 1, ["bun"]),
  H("odango", "Hai Búi", "blunt", 1, 1, ["twin_buns"]),
  H("odango_tails", "Búi Kèm Đuôi", "blunt", 1, 1, ["twin_buns", "twintails"]),
  H("braids", "Hai Bím Tết", "split", 1, 2, ["twin_braids"]),
  H("braid_side", "Tết Một Bên", "side", 2, 1, ["braid"]),
  H("drills", "Xoắn Tiểu Thư", "blunt", 3, 2, ["drills", "ribbon"]),
  H("drills_long", "Xoắn Công Chúa", "curtain", 4, 3, ["drills"]),
  H("bald", "Trọc", "none", 0, 0, [], 0),
];
export const HAIR_BY_ID: Record<string, HairDef> = Object.fromEntries(HAIR_STYLES.map((h) => [h.id, h]));
export const hairDef = (id: string) => HAIR_BY_ID[id] ?? HAIR_BY_ID.short;
const has = (d: HairDef, e: Extra) => !!d.extras?.includes(e);

interface Cols { c: string; hl: string; hd: string; hdd: string; acc: string }
// ribbons and ties are always a bright colour that stands out: pink, or white on red/pink hair
function ribbonFor(hair: string) {
  const n = parseInt(hair.slice(1, 7), 16);
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  return r > gg + 50 && r > b + 20 ? "#f4f0ea" : "#e84a6a";
}
const colsOf = (hair: string, _accent: string): Cols => ({ c: hair, hl: hs(hair, 0.3), hd: hs(hair, -0.22), hdd: hs(hair, -0.4), acc: ribbonFor(hair) });

// ============================================================ portrait (32x32)
// head spans x 6..25, crown at y 3, hairline ~y 10, eyes y 13..16, chin y 22

/** Hair behind the head (drawn before the face). */
export function portraitBack(g: Pen, d: HairDef, hair: string, accent: string) {
  if (d.id === "bald") return;
  const k = colsOf(hair, accent);
  const bottom = [0, 16, 21, 26, 31, 31][d.len];
  const flare = [0, 0, 1, 2, 3, 4][d.len];
  if (d.len >= 1) {
    for (let y = 8; y <= bottom; y++) {
      const t = (y - 8) / Math.max(1, bottom - 8);
      let w = 10.5 + (d.vol === 2 ? 2 : 0) + flare * t;
      if (has(d, "wave")) w += Math.round(Math.sin(y / 2) * 1.2);
      const x0 = Math.round(16 - w), x1 = Math.round(15 + w);
      for (let x = x0; x <= x1; x++) g.px(x, y, x === x0 + 1 ? k.c : (x - x0) % 4 === 3 && y > 10 ? k.hdd : k.hd);
    }
    // pointed strand tips along the bottom
    if (d.len >= 3) for (let x = 4; x <= 27; x += 3) { g.px(x, bottom + 1, k.hd); g.px(x + 1, bottom + 1, k.hdd); }
  }
  if (has(d, "pony") || has(d, "high_pony")) {
    const y0 = has(d, "high_pony") ? 6 : 14;
    for (let y = y0; y < 31; y++) { const w = y < y0 + 4 ? 2 : 3 - (y - y0) / 12; g.rect(Math.round(26 + (y - y0) * 0.12), y, Math.max(1, Math.round(w)), 1, y % 3 ? k.hd : k.c); }
  }
  if (has(d, "bun")) disc(g, 16, 9, 4, k.hd, k.hdd);
  if (has(d, "curls") && d.len >= 2) for (const [x, y] of [[5, 20], [26, 20], [4, 25], [27, 25]]) disc(g, x, y, 2, k.hd, k.hdd);
}

/** Hair over the head (drawn after the face and eyes). */
export function portraitFront(g: Pen, d: HairDef, hair: string, accent: string) {
  const k = colsOf(hair, accent);
  if (d.id === "bald") { g.rect(11, 5, 5, 1, "rgba(255,255,255,0.35)"); return; }
  const vol = d.vol ?? 1;
  // ---- crown cap
  const shaved = has(d, "undercut") || has(d, "mohawk");
  for (let y = 1; y < 11; y++) {
    let w = y < 4 ? 5 + (y - 1) * 2.2 : 10.5;
    w += vol === 2 ? (y < 4 ? 1.5 : 2) : vol === 0 ? -0.5 : 0;
    const x0 = Math.round(16 - w), x1 = Math.round(15 + w);
    for (let x = x0; x <= x1; x++) {
      if (shaved && (x < 11 || x > 20) && y > 3) { g.px(x, y, hs(k.hd, -0.1)); continue; }
      const edge = x >= x1 - 1 ? k.hd : x <= x0 + 1 ? k.c : k.c;
      g.px(x, y, vol === 0 && y > 3 ? hs(k.c, -0.05) : edge);
    }
  }
  if (vol === 0 && !shaved && d.bang !== "blunt") for (let x = 9; x <= 22; x += 2) g.px(x, 8, k.hd); // stubble texture
  // angel ring highlight
  for (let x = 8; x <= 23; x++) { const d = Math.abs(x - 15.5); if (d > 2.5 && d < 3.5) continue; g.px(x, d > 5.5 ? 6 : 5, d < 1 ? hs(k.hl, 0.2) : k.hl); }
  g.px(10, 3, k.hl); g.px(11, 3, k.hl); g.px(9, 4, k.hl);
  // side hair over the temples
  if (d.len >= 1 && !shaved) { g.rect(5, 8, 3, 7, k.c); g.rect(24, 8, 3, 7, k.hd); }
  // ---- extras on top
  if (has(d, "mohawk")) for (let y = 0; y < 10; y++) { g.rect(13, y, 6, 1, y % 3 ? k.c : k.hl); }
  if (has(d, "spikes")) for (const x of [7, 11, 15, 19, 23]) { g.px(x, 1, k.c); g.px(x + 1, 0, k.c); g.px(x + 1, 1, k.c); }
  if (has(d, "top_knot")) { disc(g, 16, 1, 2, k.c, k.hd); g.rect(14, 3, 4, 1, k.acc); }
  if (has(d, "twin_buns")) { disc(g, 7, 3, 3, k.c, k.hd); disc(g, 24, 3, 3, k.c, k.hd); g.px(6, 2, k.hl); g.px(23, 2, k.hl); }
  if (has(d, "hairband")) { g.rect(7, 6, 18, 2, k.acc); g.rect(7, 6, 18, 1, hs(k.acc, 0.3)); }
  // ---- bangs: bottom edge per column, with strand shading
  const bottomAt = bangBottom(d.bang);
  for (let x = 7; x <= 24; x++) {
    const b = bottomAt(x);
    if (b <= 9) continue;
    const gap = x % 4 === 1; // the notch between two locks sits in shadow
    for (let y = 9; y <= b; y++) g.px(x, y, y === b || (gap && y >= b - 2) ? k.hd : x % 4 === 3 && y === 10 ? k.hl : k.c);
  }
  // ---- side locks in front of the ears
  const lockEnd = [0, 18, 24, 30][d.side];
  if (lockEnd) {
    for (let y = 10; y <= lockEnd; y++) {
      const tip = y > lockEnd - 3;
      if (!tip) { g.px(5, y, k.c); g.px(6, y, k.c); g.px(7, y, k.hd); g.px(24, y, k.hd); g.px(25, y, k.hd); g.px(26, y, k.hdd); }
      else { g.px(6, y, k.c); g.px(7, y, k.hd); g.px(24, y, k.hd); g.px(25, y, k.hdd); }
    }
    g.px(5, 11, k.hl); // glint
  }
  // ---- extras in front
  if (has(d, "ahoge")) { g.line(16, 3, 17, 0, k.c); g.px(18, 0, k.c); g.px(19, 1, k.c); g.px(16, 2, k.hl); }
  if (has(d, "twintails")) { tail(g, 6, 5, -1, k); tail(g, 25, 5, 1, k); g.rect(5, 5, 3, 2, k.acc); g.rect(24, 5, 3, 2, k.acc); }
  if (has(d, "low_twintails")) { for (const [x, s] of [[6, -1], [25, 1]] as const) for (let y = 17; y < 32; y++) g.rect(x + s * Math.round((y - 17) * 0.1) - 1, y, 3, 1, y % 3 ? k.c : k.hd); g.rect(5, 17, 3, 2, k.acc); g.rect(24, 17, 3, 2, k.acc); }
  if (has(d, "side_pony")) { tail(g, 25, 7, 1, k, 4); g.rect(24, 7, 4, 2, k.acc); }
  if (has(d, "twin_braids")) { braid(g, 6, 15, k); braid(g, 25, 15, k); }
  if (has(d, "braid")) braid(g, 25, 15, k);
  if (has(d, "drills")) for (const x of [5, 26]) for (let i = 0; i < 5; i++) { const y = 15 + i * 3; disc(g, x, y, 2, k.c, k.hd); g.px(x - 1, y - 1, k.hl); }
  if (has(d, "ribbon")) { g.rect(21, 2, 3, 3, k.acc); g.rect(25, 2, 3, 3, k.acc); g.rect(24, 3, 1, 1, hs(k.acc, -0.3)); g.px(22, 2, hs(k.acc, 0.35)); }
  if (has(d, "curls")) for (const [x, y] of [[6, 5], [25, 5], [4, 9], [27, 9], [5, 13], [26, 13]]) disc(g, x, y, 2, k.c, k.hd);
}

function bangBottom(b: Bang): (x: number) => number {
  switch (b) {
    case "blunt": return (x) => 12 + (x % 3 === 0 ? 1 : 0);
    case "spiky": return (x) => 11 + [0, 1, 3, 1][x % 4];
    case "side": return (x) => Math.round(15 - (x - 7) * 0.35) + (x % 3 === 0 ? 1 : 0);
    case "split": return (x) => (x >= 14 && x <= 17 ? 9 : 10 + Math.round(Math.abs(x - 15.5) * 0.35) + (x % 3 === 0 ? 1 : 0));
    case "curtain": return (x) => (x >= 13 && x <= 18 ? 9 : x <= 8 || x >= 23 ? 18 : 11 + Math.round(Math.abs(x - 15.5) * 0.5));
    case "eye": return (x) => (x >= 8 && x <= 15 ? 16 : 11) + (x % 3 === 0 ? 1 : 0);
    case "messy": return (x) => 11 + [2, 0, 3, 1, 0, 2][x % 6];
    case "wispy": return (x) => (x % 4 === 2 ? 13 : 10);
    default: return () => 9;
  }
}

function disc(g: Pen, cx: number, cy: number, r: number, c: string, dark: string) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) g.px(cx + x, cy + y, x + y > r * 0.6 ? dark : c);
}
function tail(g: Pen, x0: number, y0: number, dir: -1 | 1, k: Cols, w0 = 3) {
  for (let y = y0; y < 32; y++) {
    const t = (y - y0) / (31 - y0);
    const x = x0 + dir * Math.round(Math.sin(t * Math.PI * 0.8) * 4);
    const w = Math.max(1, Math.round(w0 - t * 1.5));
    g.rect(dir < 0 ? x - w + 1 : x, y, w, 1, y % 4 === 0 ? k.hd : k.c);
    g.px(dir < 0 ? x - w + 1 : x, y, k.hl);
  }
}
function braid(g: Pen, x: number, y0: number, k: Cols) {
  for (let y = y0; y < 31; y += 3) { g.rect(x - 1, y, 3, 2, k.c); g.px(x - 1, y, k.hl); g.rect(x - 1, y + 2, 3, 1, k.hd); }
  g.rect(x - 1, 30, 3, 1, k.acc);
}

// ============================================================ walking sprite (16x32)
// face x 4..11, y top+3..top+10; eyes at top+6..7

export function spriteBack(g: Pen, d: HairDef, hair: string, accent: string, dir: 0 | 1 | 2, top: number) {
  if (d.id === "bald") return;
  const k = colsOf(hair, accent);
  const hlen = [0, 0, 3, 6, 10, 13][d.len];
  if (hlen) {
    if (dir === 0) { g.rect(3, top + 5, 2, hlen, k.hd); g.rect(11, top + 5, 2, hlen, k.hd); }
    if (dir === 1) g.rect(3, top + 5, 10, hlen, k.hd);
    if (dir === 2) g.rect(3, top + 5, 5, hlen, k.hd);
  }
  if ((has(d, "pony") || has(d, "high_pony")) && dir === 0) { const y0 = has(d, "high_pony") ? top + 3 : top + 7; g.rect(12, y0, 2, 9, k.hd); }
  if (has(d, "twintails") && dir === 0) { g.rect(1, top + 2, 2, 10, k.hd); g.rect(13, top + 2, 2, 10, k.hd); }
}

export function spriteFront(g: Pen, d: HairDef, hair: string, accent: string, dir: 0 | 1 | 2, top: number) {
  if (d.id === "bald") return;
  const k = colsOf(hair, accent);
  const vol = d.vol ?? 1;
  const shaved = has(d, "undercut") || has(d, "mohawk");
  const big = vol === 2 ? 1 : 0;
  if (dir === 1) {
    g.rect(3 - big, top + 1 - big, 10 + big * 2, 10, k.c); g.rect(4, top - big, 8, 1, k.c); g.rect(4, top + 1, 3, 2, k.hl); g.rect(3, top + 8, 10, 3, k.hd);
    if (d.len >= 3) g.rect(3, top + 11, 10, 2, k.hd);
  } else if (dir === 2) {
    g.rect(4, top + 1 - big, 8 + big, 3, k.c); g.rect(5, top - big, 6, 1, k.c); g.rect(3 - big, top + 2, 4 + big, 7, k.c); g.rect(4, top + 1, 3, 1, k.hl);
    const b = d.bang === "none" ? 0 : d.bang === "eye" || d.bang === "curtain" ? 3 : 1;
    if (b) g.rect(10, top + 3, 3, b, k.c);
    if (shaved) g.rect(3, top + 4, 4, 4, hs(k.hd, -0.1));
    // long hair seen from the side: it falls down the back, lit on its outer edge, and the
    // locks by the face drop in front of the ear and over the shoulder
    const hang = [0, 0, 3, 6, 10, 13][d.len];
    if (hang && !shaved) {
      for (let i = 0; i < hang; i++) {
        const y = top + 8 + i;
        const w = Math.max(2, 4 + big - Math.floor((i * 2) / Math.max(4, hang)));
        g.rect(2 - big, y, w, 1, k.c);
        g.px(2 - big, y, k.hd);
        if (i % 4 === 1) g.px(3 - big, y, k.hl);
        g.px(1 + w - big, y, k.hd);
      }
      g.rect(3 - big, top + 8 + hang - 1, 2, 1, k.hd);
    }
    const sideLock = d.len >= 2 ? [0, 4, 7, 10][d.side] : 0;
    if (sideLock && !shaved) {
      g.rect(6, top + 4, 2, sideLock, k.c);
      g.rect(7, top + 4, 1, sideLock, k.hd);
      g.px(6, top + 4 + sideLock - 1, k.hd);
    }
    // tails tied low, braids and drills: one hangs at the back of the head
    if (has(d, "low_twintails") || has(d, "twin_braids") || has(d, "drills")) {
      for (let y = top + 8; y < top + 16; y++) g.rect(1, y, 2, 1, y % 2 ? k.c : k.hd);
    }
  } else {
    g.rect(4, top - big, 8, 1, k.c); g.rect(3 - big, top + 1, 10 + big * 2, 3, k.c);
    if (!shaved) { g.rect(3 - big, top + 4, 2, 3, k.c); g.rect(11, top + 4, 2 + big, 3, k.hd); }
    else { g.rect(3, top + 2, 2, 3, hs(k.hd, -0.1)); g.rect(11, top + 2, 2, 3, hs(k.hd, -0.1)); }
    g.rect(5, top + 1, 3, 1, k.hl); g.px(4, top + 2, k.hl);
    // bangs
    switch (d.bang) {
      case "blunt": g.rect(4, top + 4, 8, 1, k.c); g.px(5, top + 5, k.hd); g.px(10, top + 5, k.hd); break;
      case "spiky": for (const x of [4, 6, 9, 11]) g.px(x, top + 5, k.c); g.rect(4, top + 4, 8, 1, k.c); break;
      case "side": g.rect(4, top + 4, 6, 1, k.c); g.rect(4, top + 5, 3, 1, k.c); break;
      case "split": g.px(5, top + 4, k.c); g.px(10, top + 4, k.c); break;
      case "curtain": g.rect(4, top + 4, 2, 3, k.c); g.rect(10, top + 4, 2, 3, k.hd); break;
      case "eye": g.rect(4, top + 4, 5, 2, k.c); g.px(5, top + 6, k.c); break;
      case "messy": g.rect(4, top + 4, 8, 1, k.c); for (const x of [5, 8, 10]) g.px(x, top + 5, k.c); break;
      case "wispy": g.px(6, top + 4, k.c); g.px(9, top + 4, k.c); g.px(7, top + 5, k.c); break;
      default: break;
    }
    const lock = [0, 3, 6, 9][d.side];
    if (lock) { g.rect(3, top + 4, 1, lock, k.c); g.rect(12, top + 4, 1, lock, k.hd); }
    if (has(d, "twintails")) { g.px(2, top + 2, k.acc); g.px(13, top + 2, k.acc); }
    if (has(d, "low_twintails")) { g.rect(2, top + 8, 2, 7, k.c); g.rect(12, top + 8, 2, 7, k.hd); }
    if (has(d, "twin_braids")) for (const x of [2, 12]) for (let y = top + 8; y < top + 16; y += 2) { g.rect(x, y, 2, 1, k.c); g.rect(x, y + 1, 2, 1, k.hd); }
    if (has(d, "braid")) for (let y = top + 8; y < top + 16; y += 2) { g.rect(12, y, 2, 1, k.c); g.rect(12, y + 1, 2, 1, k.hd); }
    if (has(d, "drills")) for (const x of [2, 12]) for (let y = top + 7; y < top + 15; y += 3) { g.rect(x, y, 2, 2, k.c); g.px(x + 1, y + 2, k.hd); }
    if (has(d, "side_pony")) g.rect(13, top + 3, 2, 10, k.hd);
  }
  // extras visible from every side
  if (has(d, "mohawk")) g.rect(dir === 2 ? 5 : 7, top - 2, dir === 2 ? 5 : 2, 3, k.c);
  if (has(d, "spikes")) for (let x = 3; x <= 12; x += 2) g.px(x, top - 1, k.c);
  if (has(d, "ahoge")) { g.px(8, top - 1, k.c); g.px(9, top - 2, k.c); }
  if (has(d, "bun") || has(d, "top_knot")) g.rect(6, top - 2, 4, 2, k.c);
  if (has(d, "twin_buns")) { g.rect(2, top - 1, 3, 3, k.c); g.rect(11, top - 1, 3, 3, k.c); }
  if ((has(d, "pony") || has(d, "high_pony")) && dir !== 0) { const x = dir === 2 ? 2 : 7; const y0 = has(d, "high_pony") ? top + 2 : top + 6; g.rect(x, y0, 2, 9, k.c); g.px(x, y0, k.acc); }
  if (has(d, "twintails") && dir !== 0) { g.rect(1, top + 2, 2, 10, k.c); if (dir === 1) g.rect(13, top + 2, 2, 10, k.c); }
  if (has(d, "hairband") && dir !== 1) g.rect(4, top + 2, 8, 1, k.acc);
  if (has(d, "ribbon")) { g.px(dir === 2 ? 4 : 11, top, k.acc); g.px(dir === 2 ? 5 : 12, top - 1, k.acc); }
  if (has(d, "curls")) for (const [x, y] of [[3, 3], [12, 3], [2, 6], [13, 6]]) g.px(x, top + y, k.hl);
}
