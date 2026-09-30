import { Rng, hashString } from "../core/rng";
import { hs, outline } from "./palette";

/**
 * Cozy-farm-style humanoids. Every person (hero, companions, villagers) is described by a
 * Look and drawn as a 16x32 walking sprite (down / up / side, 4-frame walk cycle) plus a
 * detailed 32x32 portrait bust for menus and dialogue.
 */

export type HairStyle = "short" | "spiky" | "long" | "ponytail" | "bob" | "bun" | "braids" | "mohawk" | "bald" | "curly";
export type Outfit = "tunic" | "robe" | "armor" | "vest" | "dress" | "cloak" | "uniform" | "jacket" | "apron";
export type Hat = "none" | "wizard" | "witch" | "hood" | "helmet" | "circlet" | "bandana" | "cap" | "mushroom" | "straw" | "crown" | "flower";
export type Ears = "none" | "elf" | "beast" | "fin";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: string;
  top: string;
  accent: string;
  pants: string;
  shoes: string;
  outfit: Outfit;
  hat: Hat;
  hatCol: string;
  ears: Ears;
  beard?: boolean;
  glow?: boolean; // glowing eyes
  cape?: string;
  fem?: boolean;
  weapon?: Held;
  off?: Held; // off-hand item: shield, tome, orb or a second weapon
  gloves?: string;
}
interface Held { kind: string; c0: string; c1: string; c2: string }

const BASE_LOOK: Look = {
  skin: "#f2c8a0", hair: "#6b3f22", hairStyle: "short", eyes: "#2a3a6a", top: "#3b6fd6", accent: "#c9a227",
  pants: "#5a4430", shoes: "#4a3020", outfit: "tunic", hat: "none", hatCol: "#6a3a8a", ears: "none",
};

/** Hand-made looks for the named characters. */
const PRESETS: Record<string, Partial<Look>> = {
  hero_warrior: { hair: "#6b3f22", hairStyle: "short", top: "#3b6fd6", accent: "#d8a82a", pants: "#6a4a30", outfit: "tunic", cape: "#b83a2a" },
  hero_mage: { hair: "#e0dcf0", hairStyle: "long", top: "#7b4bc4", accent: "#e6c35a", pants: "#3a2a5a", outfit: "robe", hat: "wizard", hatCol: "#5a3494", eyes: "#6a3aa0" },
  hero_ranger: { hair: "#8a5a2a", hairStyle: "ponytail", top: "#3e8a3a", accent: "#8a5a2a", pants: "#5a4a2a", outfit: "cloak", hat: "hood", hatCol: "#2f6a2f", cape: "#2f6a2f" },
  hero_rogue: { hair: "#2a2a34", hairStyle: "spiky", top: "#3a3a4a", accent: "#c83a3a", pants: "#2a2a34", outfit: "vest", hat: "bandana", hatCol: "#c83a3a" },
  hero_cleric: { hair: "#f0d26a", hairStyle: "long", top: "#f0eef6", accent: "#e0b03a", pants: "#b8b0d0", outfit: "robe", hat: "circlet", hatCol: "#e0b03a", fem: true },
  hero_guardian: { hair: "#b04a2a", hairStyle: "short", top: "#a8b0bc", accent: "#c83a3a", pants: "#5a5e6a", outfit: "armor", hat: "helmet", hatCol: "#a8b0bc", beard: true },
  hero_witch: { hair: "#3a5a4a", hairStyle: "long", top: "#2a4a3a", accent: "#8be04e", pants: "#1f2f2a", outfit: "robe", hat: "witch", hatCol: "#1f3a2e", fem: true },
  hero_monk: { hair: "#2a2a34", hairStyle: "bald", top: "#e0a040", accent: "#c83a3a", pants: "#e0a040", outfit: "robe", hat: "none" },
  hero_paladin: { hair: "#e8c870", hairStyle: "short", top: "#e8e8f0", accent: "#e0b03a", pants: "#8a8aa0", outfit: "armor", cape: "#3a5ab0", hat: "circlet", hatCol: "#e0b03a" },
  hero_bard: { hair: "#c86a3a", hairStyle: "curly", top: "#3a8ab0", accent: "#f0d060", pants: "#5a3a2a", outfit: "vest", hat: "cap", hatCol: "#6a3a8a", cape: "#c83a5a" },
  hero_necromancer: { skin: "#e0dcd8", hair: "#e8e8f0", hairStyle: "long", eyes: "#8ad8ff", top: "#2a2030", accent: "#8ad8ff", pants: "#1a1420", outfit: "robe", hat: "hood", hatCol: "#1a1420" },
  hero_druid: { hair: "#6a8a3a", hairStyle: "braids", top: "#6a8a3a", accent: "#c8a060", pants: "#5a4a2a", outfit: "cloak", hat: "flower", hatCol: "#f090b8", cape: "#4a6a2a" },
  hero_spellblade: { hair: "#3a4a8a", hairStyle: "ponytail", top: "#4a3a6a", accent: "#8ad8ff", pants: "#2a2a3a", outfit: "jacket", cape: "#6a3aa0" },
  hero_dragoon: { hair: "#8a2a2a", hairStyle: "spiky", top: "#6a2a2a", accent: "#e0a040", pants: "#3a2a2a", outfit: "armor", hat: "helmet", hatCol: "#8a3a3a" },
  lyra: { skin: "#f5d8bc", hair: "#e4ecf2", hairStyle: "long", eyes: "#3a8a5a", top: "#2f7a4a", accent: "#9a6a3a", pants: "#2a4a32", outfit: "cloak", ears: "elf", cape: "#5a4a2a", fem: true },
  bram: { skin: "#efe0c0", hair: "#b0763a", hairStyle: "short", top: "#c8a878", accent: "#7a4a22", pants: "#6a4a2a", outfit: "tunic", hat: "mushroom", hatCol: "#d83a2a" },
  samira: { skin: "#c68a5a", hair: "#2a1a12", hairStyle: "braids", eyes: "#6a3a1a", top: "#e0a040", accent: "#b0302a", pants: "#8a5a2a", outfit: "robe", hat: "circlet", hatCol: "#e8c040", fem: true },
  morwen: { skin: "#d8e0c8", hair: "#3a5a4a", hairStyle: "long", eyes: "#8be04e", top: "#2a4a3a", accent: "#8be04e", pants: "#1f2f2a", outfit: "robe", hat: "witch", hatCol: "#1f3a2e", fem: true },
  kaito: { skin: "#ecc8a0", hair: "#1a1a1a", hairStyle: "spiky", top: "#23233a", accent: "#d8b030", pants: "#23233a", outfit: "uniform" },
  hana: { skin: "#f2d0b0", hair: "#1a1a2a", hairStyle: "bob", top: "#c83a3a", accent: "#e8e0d0", pants: "#3a3a4a", outfit: "jacket", fem: true },
  villager: { hair: "#8a6a4a", top: "#a0a060", accent: "#6a5a3a", pants: "#5a4a3a", outfit: "apron" },
  nomad: { skin: "#b07a4a", hair: "#e8e0d0", hairStyle: "short", top: "#d8c090", accent: "#8a3a2a", pants: "#a08060", outfit: "cloak", hat: "straw", hatCol: "#d8b060", beard: true },
};

export const isPerson = (id: string) => id in PRESETS;

const STYLES: HairStyle[] = ["short", "spiky", "long", "ponytail", "bob", "bun", "braids", "curly", "mohawk", "short"];
const EYES = ["#2a3a6a", "#3a2a1a", "#2a6a3a", "#6a3aa0", "#1a1a1a", "#3a6ab0"];

/** Builds a look from a sprite id plus the palette overrides stored on characters / NPCs. */
export function lookFor(id: string, pal?: Record<string, string>): Look {
  const L: Look = { ...BASE_LOOK, ...(PRESETS[id] ?? PRESETS.villager) };
  if (!pal) return L;
  const generic = id === "villager" || id === "hero_mage" && !!pal.j;
  // randomness only depends on the identity keys, never on gear or custom choices
  const idKeys = ["h", "c", "b", "p", "s", "t", "r", "j", "g", "k"].map((k) => pal[k] ?? "").join("|");
  const r = new Rng(hashString(idKeys));
  if (pal.h) L.hair = pal.h;
  if (pal.c) L.top = pal.c;
  if (pal.b) L.accent = pal.b;
  if (pal.p) L.pants = pal.p;
  if (pal.s) L.skin = pal.s;
  if (pal.t) L.hatCol = pal.t;
  if (generic || id === "villager") {
    L.fem = pal.g ? pal.g === "f" : r.chance(0.5);
    L.hairStyle = L.fem ? r.pick<HairStyle>(["long", "ponytail", "bob", "bun", "braids", "curly"]) : r.pick(STYLES);
    L.eyes = r.pick(EYES);
    L.beard = !L.fem && r.chance(0.2);
  } else if (pal.g) L.fem = pal.g === "f";
  if (id === "villager") {
    const job = pal.j ?? "";
    const byJob: Record<string, Partial<Look>> = {
      guard: { outfit: "armor", hat: r.chance(0.6) ? "helmet" : "none", hatCol: "#a8b0bc" },
      mercenary: { outfit: "armor", hat: r.chance(0.3) ? "bandana" : "none" },
      priest: { outfit: "robe", hat: "circlet", hatCol: "#e0b03a" },
      scholar: { outfit: "robe", hat: r.chance(0.5) ? "wizard" : "none" },
      hunter: { outfit: "cloak", hat: "hood", cape: L.pants },
      adventurer: { outfit: r.pick<Outfit>(["tunic", "vest", "cloak"]), cape: r.chance(0.4) ? L.accent : undefined },
      farmer: { outfit: "apron", hat: "straw", hatCol: "#d8b060" },
      merchant: { outfit: "vest", hat: r.chance(0.5) ? "cap" : "none" },
      blacksmith: { outfit: "apron", beard: !L.fem },
      innkeeper: { outfit: "apron" },
      child: { outfit: "tunic" },
      elder: { outfit: "robe", hair: "#e8e4dc", beard: !L.fem },
      bard: { outfit: "vest", hat: "cap", cape: L.accent },
      herbalist: { outfit: "dress", hat: "flower", hatCol: "#f090b8" },
      fisher: { outfit: "vest", hat: "straw", hatCol: "#c8a060" },
    };
    Object.assign(L, byJob[job] ?? { outfit: r.pick<Outfit>(["tunic", "vest", "dress", "apron"]) });
    if (L.outfit === "dress" && !L.fem) L.outfit = "tunic";
  }
  const byClass: Record<string, Partial<Look>> = {
    monk: { outfit: "robe", hairStyle: L.fem ? "bun" : "bald", hat: "none" },
    paladin: { outfit: "armor", cape: L.accent, hat: "circlet", hatCol: "#e0b03a" },
    bard: { outfit: "vest", hat: "cap", cape: L.accent },
    necromancer: { outfit: "robe", hat: "hood", hatCol: "#2a2030", top: "#2a2030" },
    druid: { outfit: "cloak", hat: "flower", hatCol: "#f090b8" },
    spellblade: { outfit: "jacket", cape: L.accent },
    dragoon: { outfit: "armor", hat: "helmet", hatCol: L.top },
    guardian: { outfit: "armor", hat: "helmet", hatCol: "#a8b0bc" },
    ranger: { outfit: "cloak", hat: "hood", hatCol: L.top },
    rogue: { outfit: "vest", hat: "bandana", hatCol: L.accent },
    cleric: { outfit: "robe", hat: "circlet", hatCol: "#e0b03a" },
  };
  if (pal.k && byClass[pal.k] && (id === "villager" && ["guard", "mercenary", "priest", "scholar", "hunter", "adventurer", "bard", "herbalist", ""].includes(pal.j ?? ""))) Object.assign(L, byClass[pal.k]);
  const race = pal.r ?? "";
  if (race === "Tiên Rừng" || race === "Bán Tinh Linh") L.ears = "elf";
  if (race === "Người Thú") L.ears = "beast";
  if (race === "Người Cá") { L.ears = "fin"; L.skin = "#9ad0d8"; }
  if (race === "Tộc Nấm") { L.hat = "mushroom"; L.hatCol = pal.t ?? r.pick(["#d83a2a", "#c070e0", "#e8a030"]); }
  if (race === "Tộc Thằn Lằn") { L.skin = r.pick(["#6ab04a", "#4a9a8a", "#a0b040"]); L.hairStyle = "bald"; }
  if (race === "Người Bóng") { L.skin = "#6a5a8a"; L.glow = true; L.eyes = "#ffe14a"; }
  if (race === "Người Lùn") L.beard = !L.fem;
  applyCustom(L, pal);
  return L;
}

/** Player-chosen appearance (hs/hc/ec/sk/bd) and the visuals of equipped gear (a/w). */
function applyCustom(L: Look, pal: Record<string, string>) {
  if (pal.hs) L.hairStyle = pal.hs as HairStyle;
  if (pal.hc) L.hair = pal.hc;
  if (pal.ec) L.eyes = pal.ec;
  if (pal.sk) L.skin = pal.sk;
  if (pal.bd) L.beard = pal.bd === "1";
  if (pal.ht) L.hat = pal.ht as Hat;
  if (pal.a) {
    // Party members: clothes come only from equipped armor — class outfits, hats and capes are not free.
    Object.assign(L, { outfit: "tunic", top: "#e8dcc0", accent: "#b89a70", pants: "#6a5a4a", shoes: "#5a3a2a", cape: undefined });
    L.hat = (pal.ht as Hat) ?? "none";
  }
  if (pal.a && pal.a !== "none") {
    const [kind, col, col2] = pal.a.split("|");
    L.top = col;
    if (kind === "robe") { L.outfit = "robe"; L.accent = col2 ?? L.accent; }
    else if (kind === "leather") { L.outfit = "vest"; L.accent = col2 ?? L.accent; }
    else if (kind === "mail" || kind === "plate") { L.outfit = "armor"; L.accent = col2 ?? L.accent; if (kind === "plate") L.pants = hs(col, -0.25); }
  }
  const held = (v: string): Held => { const [kind, c0, c1, c2] = v.split("|"); return { kind, c0, c1, c2 }; };
  if (pal.w) L.weapon = held(pal.w);
  if (pal.o) L.off = held(pal.o);
  if (pal.hg) {
    const [kind, col] = pal.hg.split("|");
    L.hat = ({ hat: "wizard", cap: "cap", helm: "helmet", helmet: "crown" } as Record<string, Hat>)[kind] ?? "helmet";
    L.hatCol = col;
  }
  if (pal.gl) L.gloves = pal.gl;
  if (pal.lg) L.pants = pal.lg;
  if (pal.ft) L.shoes = pal.ft;
}

// ------------------------------------------------------------ grid painter
type Col = string | null;
class G {
  g: Col[][];
  constructor(public w: number, public h: number) { this.g = Array.from({ length: h }, () => Array<Col>(w).fill(null)); }
  px(x: number, y: number, c: Col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c; }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y][x] : null; }
  rect(x: number, y: number, w: number, h: number, c: Col) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: Col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** Fill a horizontal span with left highlight / right shadow shading. */
  span(x0: number, x1: number, y: number, c: string, shade = true) {
    for (let x = x0; x <= x1; x++) this.px(x, y, !shade ? c : x === x0 ? hs(c, 0.2) : x >= x1 - 1 ? hs(c, -0.22) : c);
  }
  toCanvas(outlineAll = true): HTMLCanvasElement {
    const out = this.g.map((row) => row.slice());
    if (outlineAll) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.g[y][x]) continue;
        const n = [this.get(x, y + 1), this.get(x, y - 1), this.get(x + 1, y), this.get(x - 1, y)].find((c) => c && !c.startsWith("rgba"));
        if (n) out[y][x] = outline(n);
      }
    }
    const c = document.createElement("canvas");
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext("2d")!;
    out.forEach((row, y) => row.forEach((col, x) => { if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }));
    return c;
  }
}

// ------------------------------------------------------------ walking sprite (16x32)
export type Dir = 0 | 1 | 2; // down, up, side (facing right)

function drawBody(g: G, L: Look, dir: Dir, frame: number) {
  const step = frame % 2 === 1; // frames 1 and 3 are steps
  const alt = frame === 3;
  const bob = step ? 1 : 0;
  const skin = L.skin, sk2 = hs(skin, -0.2);
  const long = L.outfit === "robe" || L.outfit === "dress";
  const y0 = 15 + bob; // body top

  // cape behind (down / side)
  if (L.cape && dir !== 1) { g.rect(dir === 2 ? 3 : 4, y0 + 1, dir === 2 ? 4 : 8, 11, hs(L.cape, -0.15)); }

  // legs
  if (!long || L.outfit === "dress") {
    const ly = y0 + 9;
    if (dir === 2) {
      const a = step ? (alt ? -1 : 1) : 0;
      g.rect(6 + a, ly, 2, 5, L.pants); g.rect(8 - a, ly, 2, 5, hs(L.pants, -0.15));
      g.rect(6 + a, ly + 5, 3, 2, L.shoes); g.rect(8 - a, ly + 5, 3, 2, hs(L.shoes, -0.1));
    } else {
      const lL = step && !alt ? -1 : 0, rL = step && alt ? -1 : 0;
      g.rect(5, ly, 3, 5 + lL, L.pants); g.px(5, ly, hs(L.pants, 0.2));
      g.rect(8, ly, 3, 5 + rL, hs(L.pants, -0.12));
      g.rect(5, ly + 5 + lL, 3, 2, L.shoes); g.rect(8, ly + 5 + rL, 3, 2, hs(L.shoes, -0.1));
    }
  }
  // torso
  const top = L.top, tl = hs(top, 0.22), td = hs(top, -0.25);
  if (dir === 2) {
    g.rect(5, y0, 6, 9, top); g.rect(5, y0, 1, 9, tl); g.rect(10, y0, 1, 9, td);
  } else {
    g.rect(4, y0 + 1, 8, 8, top); g.rect(5, y0, 6, 1, top);
    g.rect(4, y0 + 1, 1, 8, tl); g.rect(11, y0 + 1, 1, 8, td);
  }
  if (long) {
    // robe / dress flares to the ankles
    for (let i = 0; i < (L.outfit === "robe" ? 7 : 4); i++) {
      const y = y0 + 9 + i, w = dir === 2 ? 6 + Math.floor(i / 2) : 8 + Math.floor(i / 2) * 2;
      const x = dir === 2 ? 5 - Math.floor(i / 4) : 8 - w / 2;
      g.span(x, x + w - 1, y, top);
      if (i === (L.outfit === "robe" ? 6 : 3)) g.span(x, x + w - 1, y, L.accent, false);
    }
    if (L.outfit === "robe") g.rect(dir === 2 ? 6 : 6, y0 + 16, dir === 2 ? 3 : 4, 1, L.shoes);
  }
  // outfit details
  if (dir === 0) {
    if (L.outfit === "vest") { g.rect(6, y0 + 1, 4, 8, L.accent); g.rect(7, y0 + 1, 2, 8, hs(L.accent, 0.3)); }
    if (L.outfit === "jacket") { g.rect(7, y0 + 1, 2, 8, L.accent); for (let y = y0 + 2; y < y0 + 8; y += 2) g.px(4, y, td); }
    if (L.outfit === "uniform") { g.rect(7, y0 + 1, 1, 8, td); for (let y = y0 + 2; y < y0 + 9; y += 2) g.px(8, y, L.accent); g.rect(6, y0, 4, 1, hs(top, 0.35)); }
    if (L.outfit === "apron") { g.rect(5, y0 + 3, 6, 7, "#efe6d0"); g.rect(5, y0 + 3, 6, 1, "#d8ccb0"); g.px(10, y0 + 6, "#d8ccb0"); }
    if (L.outfit === "armor") { g.rect(3, y0, 3, 3, L.accent); g.rect(10, y0, 3, 3, L.accent); g.rect(6, y0 + 2, 4, 3, hs(top, 0.35)); g.rect(7, y0 + 5, 2, 3, td); }
    if (L.outfit === "cloak") { g.rect(4, y0, 8, 3, L.cape ?? L.accent); g.px(8, y0 + 2, "#e8c040"); }
    if (L.outfit === "robe") g.rect(7, y0 + 1, 2, 8, L.accent);
    if (L.outfit === "tunic" || L.outfit === "dress") g.rect(4, y0 + 7, 8, 1, L.accent);
  }
  if (dir === 1 && L.cape) g.rect(4, y0 + 1, 8, 11, L.cape);
  // arms
  const armSwing = step ? (alt ? 1 : -1) : 0;
  if (dir === 2) {
    g.rect(7 + armSwing, y0 + 1, 2, 6, hs(top, 0.1)); g.rect(7 + armSwing, y0 + 7, 2, 2, L.gloves ?? skin);
  } else {
    g.rect(2, y0 + 1 + (armSwing > 0 ? 1 : 0), 2, 6, top); g.rect(2, y0 + 7 + (armSwing > 0 ? 1 : 0), 2, 2, L.gloves ?? skin);
    g.rect(12, y0 + 1 + (armSwing < 0 ? 1 : 0), 2, 6, td); g.rect(12, y0 + 7 + (armSwing < 0 ? 1 : 0), 2, 2, L.gloves ? hs(L.gloves, -0.2) : sk2);
  }
  // neck
  if (dir !== 1) g.rect(7, y0 - 1, 2, 1, sk2);
}

/** Items held in the hands. `behind` pass draws what is hidden behind the body. */
function drawWeapon(g: G, L: Look, dir: Dir, frame: number, behind: boolean) {
  if (L.weapon) drawHeld(g, L.weapon, dir, frame, behind, false);
  if (L.off) drawHeld(g, L.off, dir, frame, behind, true);
}

function drawHeld(g: G, w: Held, dir: Dir, frame: number, behind: boolean, off: boolean) {
  const bob = frame % 2 === 1 ? 1 : 0;
  const y0 = 15 + bob;
  const metal = w.c0, grip = w.c1 || "#7a4a2a", gem = w.c2 || "#8ad8ff";
  const hl = hs(metal, 0.35), md = hs(metal, -0.25);
  // main hand: viewer's right when facing down, left (behind) when facing up, front hand in profile.
  // off hand: the other side; in profile it is the far hand, behind the body.
  const isBehind = off ? dir !== 0 : dir === 1;
  if (behind !== isBehind) return;
  const hx = off ? (dir === 0 ? 2 : dir === 1 ? 13 : 5) : dir === 0 ? 13 : dir === 1 ? 2 : 9;
  const hy = y0 + 8;
  const side = dir === 2;
  const blade = (len: number, width = 1) => {
    if (side) { for (let i = 0; i < len; i++) for (let k = 0; k < width; k++) g.px(hx + 1 + Math.floor(i * 0.6) + k, hy + 1 + i, i === len - 1 ? hl : k ? md : metal); g.px(hx, hy, grip); g.px(hx + 1, hy - 1, grip); }
    else { g.rect(hx, hy + 1, width, len, metal); if (width > 1) g.rect(hx + 1, hy + 1, 1, len, md); g.px(hx, hy + len, hl); g.rect(hx - 1, hy + 1, 2 + width, 1, grip); }
  };
  // long blades are carried upright, point to the sky
  const upright = (len: number, width: number) => {
    if (side) {
      for (let i = 0; i < len; i++) for (let k = 0; k < width; k++) g.px(hx + 1 + Math.floor(i * 0.45) + k, hy - 1 - i, i === len - 1 ? hl : k ? md : metal);
      g.px(hx, hy, grip); g.px(hx, hy + 1, grip); g.rect(hx - 1, hy - 1, 3, 1, gem);
    } else {
      g.rect(hx, hy - len, width, len, metal); if (width > 1) g.rect(hx + 1, hy - len, 1, len, md);
      g.px(hx, hy - len, hl); g.rect(hx - 1, hy, 2 + width, 1, gem); g.rect(hx, hy + 1, width, 2, grip);
    }
  };
  const pole = (len: number) => {
    if (side) g.line(hx - 1, hy + 4, hx + 3, hy + 4 - len, grip);
    else g.rect(hx, hy + 4 - len, 1, len, grip);
    return side ? [hx + 3, hy + 4 - len] : [hx, hy + 4 - len];
  };
  switch (w.kind) {
    case "sword": blade(8); break;
    case "dagger": blade(4); break;
    case "katana": upright(12, 1); break;
    case "greatsword": upright(13, 2); break;
    case "whip": {
      g.px(hx, hy, grip); g.px(hx, hy + 1, grip);
      for (let i = 0; i < 7; i++) g.px(hx + (side ? 1 + i : Math.round(Math.sin(i) * 1.2)), hy + 2 + (side ? Math.round(Math.sin(i) * 1.5) + 1 : i), metal);
      break;
    }
    case "scythe": { const [tx, ty] = pole(20); if (side) g.rect(tx - 4, ty, 5, 1, metal); else { g.rect(tx - 4, ty, 5, 1, metal); g.px(tx - 4, ty + 1, hl); } break; }
    case "mace": { const [tx, ty] = pole(8); g.rect(tx - 1, ty - 1, 3, 3, metal); g.px(tx - 1, ty - 1, hl); g.px(tx, ty - 2, md); break; }
    case "axe": { const [tx, ty] = pole(10); g.rect(tx + (dir === 0 || side ? 0 : -2), ty, 3, 4, metal); g.px(tx + (dir === 0 || side ? 2 : -2), ty, hl); break; }
    case "greataxe": { const [tx, ty] = pole(19); g.rect(tx - 2, ty, 5, 5, metal); g.rect(tx - 2, ty, 5, 1, hl); g.px(tx, ty + 2, md); break; }
    case "hammer": { const [tx, ty] = pole(18); g.rect(tx - 2, ty - 1, 5, 4, metal); g.rect(tx - 2, ty - 1, 5, 1, hl); g.px(tx, ty + 1, gem); break; }
    case "spear": { const [tx, ty] = pole(20); g.rect(tx, ty - 3, 1, 3, metal); g.px(tx, ty - 3, hl); break; }
    case "staff": { const [tx, ty] = pole(18); g.rect(tx - 1, ty - 1, 3, 2, gem); g.px(tx, ty - 1, "#ffffff"); break; }
    case "wand": { const [tx, ty] = pole(6); g.rect(tx, ty - 1, 1, 2, gem); g.px(tx, ty - 1, "#ffffff"); break; }
    case "lute": {
      const bx = side ? hx - 1 : hx - 2;
      g.rect(bx, hy - 2, 4, 5, metal); g.rect(bx + 1, hy - 1, 2, 3, hs(metal, 0.2)); g.px(bx + 1, hy, "#2a1a10");
      g.rect(bx + 1, hy - 8, 1, 6, grip); g.rect(bx, hy - 9, 3, 1, gem);
      break;
    }
    case "bow": case "crossbow": {
      const bx = side ? hx + 1 : hx;
      if (w.kind === "bow") {
        for (let i = -5; i <= 5; i++) g.px(bx + (Math.abs(i) < 3 ? -1 : 0) * (dir === 0 ? 1 : -1), hy + i, grip);
        for (let i = -4; i <= 4; i++) g.px(bx + (dir === 0 ? 1 : -1), hy + i, "rgba(240,240,240,0.9)");
      } else {
        g.rect(bx - 3, hy - 1, 7, 1, metal); g.px(bx - 3, hy, metal); g.px(bx + 3, hy, metal);
        g.rect(bx, hy - 2, 1, 5, grip); g.px(bx, hy - 3, hl);
      }
      break;
    }
    case "tome": g.rect(hx - 1, hy, 3, 4, metal); g.px(hx - 1, hy, hl); g.px(hx, hy + 2, gem); break;
    case "orb": g.rect(hx - 1, hy - 3, 3, 3, metal); g.px(hx - 1, hy - 3, "#ffffff"); g.px(hx + 1, hy - 1, md); break;
    case "fist": g.rect(hx - (off ? 0 : 1), y0 + 7, 2, 2, metal); if (!off && dir === 0) g.rect(2, y0 + 7, 2, 2, metal); break;
    case "shield": {
      const sx = hx - (dir === 0 ? 0 : 1) - (off ? 0 : 2);
      g.rect(sx, y0 + 3, 4, 6, metal); g.rect(sx, y0 + 3, 4, 1, hl); g.rect(sx + 1, y0 + 9, 2, 1, metal);
      g.px(sx + 1, y0 + 5, gem); g.rect(sx, y0 + 3, 1, 6, hs(metal, 0.2));
      break;
    }
    default: blade(6); break;
  }
}

function drawHead(g: G, L: Look, dir: Dir, bob: number) {
  const top = 3 + bob; // head top
  const skin = L.skin, sk2 = hs(skin, -0.18);
  const hair = L.hair, hl = hs(hair, 0.28), hd = hs(hair, -0.25);
  const style = L.hairStyle;
  // long hair behind the head
  if (["long", "braids", "curly"].includes(style) && dir === 0) { const h = style === "long" ? 9 : 6; g.rect(3, top + 5, 2, h, hd); g.rect(11, top + 5, 2, h, hd); }
  if (["long", "braids", "curly"].includes(style) && dir === 1) g.rect(3, top + 5, 10, style === "long" ? 9 : 6, hd);
  if (["long", "braids"].includes(style) && dir === 2) g.rect(3, top + 5, 5, 9, hd);
  // face
  if (dir === 2) {
    g.rect(5, top + 3, 8, 8, skin); g.rect(6, top + 11, 5, 1, sk2); g.px(13, top + 7, skin);
  } else {
    g.rect(4, top + 3, 8, 8, skin); g.rect(5, top + 11, 6, 1, sk2); g.rect(3, top + 5, 1, 4, skin); g.rect(12, top + 5, 1, 4, sk2);
  }
  // ears
  if (L.ears === "elf") { if (dir !== 2) { g.px(2, top + 6, skin); g.px(1, top + 5, skin); g.px(13, top + 6, sk2); g.px(14, top + 5, sk2); } else g.px(4, top + 5, skin); }
  if (L.ears === "fin") { if (dir !== 2) { g.rect(1, top + 5, 2, 3, "#5ab0c8"); g.rect(13, top + 5, 2, 3, "#5ab0c8"); } }
  // hair
  if (style !== "bald") {
    if (dir === 1) {
      g.rect(3, top + 1, 10, 10, hair); g.rect(4, top, 8, 1, hair); g.rect(4, top + 1, 3, 2, hl); g.rect(3, top + 8, 10, 3, hd);
    } else if (dir === 2) {
      g.rect(4, top + 1, 8, 3, hair); g.rect(5, top, 6, 1, hair); g.rect(3, top + 2, 4, 7, hair); g.rect(4, top + 1, 3, 1, hl);
      g.rect(10, top + 3, 3, 1, hair);
    } else {
      g.rect(4, top, 8, 1, hair); g.rect(3, top + 1, 10, 3, hair); g.rect(3, top + 4, 2, 3, hair); g.rect(11, top + 4, 2, 3, hd);
      g.rect(5, top + 1, 3, 1, hl); g.rect(4, top + 4, 1, 1, hl);
      // fringe
      if (style === "bob" || style === "long" || style === "braids") g.rect(5, top + 4, 6, 1, hair);
      else { g.px(6, top + 4, hair); g.px(9, top + 4, hair); }
    }
    if (style === "spiky") for (let x = 3; x <= 12; x += 2) g.px(x, top - 1, hair);
    if (style === "mohawk") g.rect(7, top - 2, 2, 3, hair);
    if (style === "bun") g.rect(6, top - 2, 4, 2, hair);
    if (style === "ponytail" && dir !== 0) { const x = dir === 2 ? 2 : 7; g.rect(x, top + 5, 2, 7, hair); g.px(x, top + 5, hl); }
    if (style === "braids" && dir === 0) { g.rect(2, top + 8, 2, 7, hair); g.rect(12, top + 8, 2, 7, hd); g.px(2, top + 14, L.accent); g.px(13, top + 14, L.accent); }
    if (style === "curly") for (const [x, y] of [[3, 3], [12, 3], [2, 6], [13, 6]]) g.px(x, top + y, hl);
  }
  // face features
  if (dir === 0) {
    const eye = L.glow ? L.eyes : "#1e1a2a";
    g.rect(5, top + 6, 2, 2, eye); g.rect(9, top + 6, 2, 2, eye);
    g.px(6, top + 6, L.glow ? "#ffffff" : L.eyes); g.px(10, top + 6, L.glow ? "#ffffff" : L.eyes);
    g.px(5, top + 9, "rgba(230,110,110,0.55)"); g.px(10, top + 9, "rgba(230,110,110,0.55)");
    if (L.beard) { g.rect(5, top + 9, 6, 3, L.hair); g.rect(6, top + 12, 4, 1, hd); }
    else g.px(8, top + 9, hs(skin, -0.35));
  } else if (dir === 2) {
    g.rect(10, top + 6, 2, 2, L.glow ? L.eyes : "#1e1a2a"); g.px(11, top + 6, L.eyes);
    if (L.beard) g.rect(9, top + 9, 4, 3, L.hair);
  }
  if (L.ears === "beast") { g.rect(3, top - 2, 3, 3, hair); g.rect(10, top - 2, 3, 3, hair); g.px(4, top - 1, "#f0b0b0"); g.px(11, top - 1, "#f0b0b0"); }
  drawHat(g, L, dir, top);
}

function drawHat(g: G, L: Look, dir: Dir, top: number) {
  const c = L.hatCol, cl = hs(c, 0.28), cd = hs(c, -0.25);
  switch (L.hat) {
    case "wizard": case "witch": {
      g.rect(1, top + 2, 14, 2, c); g.rect(1, top + 3, 14, 1, cd);
      for (let i = 0; i < 7; i++) { const w = 7 - i; const x = 8 - Math.ceil(w / 2) + (L.hat === "witch" && i > 3 ? i - 3 : 0); g.rect(x, top + 1 - i, w, 1, i % 2 ? c : cl); }
      g.rect(3, top + 1, 10, 1, L.accent);
      break;
    }
    case "hood":
      if (dir === 1) g.rect(3, top, 10, 11, c);
      else { g.rect(3, top, 10, 3, c); g.rect(2, top + 2, 2, 9, c); g.rect(12, top + 2, 2, 9, cd); g.rect(4, top, 4, 1, cl); if (dir === 2) g.rect(2, top + 2, 5, 9, c); }
      break;
    case "helmet":
      g.rect(3, top, 10, 5, c); g.rect(4, top - 1, 8, 1, c); g.rect(4, top, 3, 1, cl); g.rect(3, top + 4, 10, 1, cd);
      if (dir === 0) g.rect(7, top + 1, 2, 4, cd);
      g.rect(7, top - 3, 2, 2, L.accent);
      break;
    case "circlet":
      if (dir !== 1) { g.rect(3, top + 3, 10, 1, c); g.px(dir === 2 ? 11 : 8, top + 3, "#ff4a6a"); }
      break;
    case "bandana":
      g.rect(3, top + 2, 10, 2, c); g.rect(4, top + 2, 3, 1, cl); if (dir !== 0) { g.rect(dir === 2 ? 1 : 12, top + 3, 3, 1, c); g.px(dir === 2 ? 0 : 14, top + 4, c); }
      break;
    case "cap":
      g.rect(3, top, 10, 3, c); g.rect(4, top - 1, 8, 1, c); g.rect(5, top, 3, 1, cl);
      if (dir === 0) g.rect(3, top + 3, 10, 1, cd); if (dir === 2) g.rect(10, top + 2, 5, 1, cd);
      break;
    case "straw":
      g.rect(0, top + 2, 16, 2, c); g.rect(0, top + 3, 16, 1, cd); g.rect(4, top - 1, 8, 3, c); g.rect(5, top - 1, 3, 1, cl); g.rect(4, top + 1, 8, 1, "#b83a2a");
      break;
    case "mushroom": {
      for (let y = 0; y < 6; y++) { const w = y < 2 ? 10 + y * 2 : 16; g.rect(8 - w / 2, top - 3 + y, w, 1, y < 2 ? cl : y === 5 ? cd : c); }
      for (const [x, y] of [[4, -1], [10, 0], [7, 1], [13, 1]]) g.rect(x, top + y, 2, 1, "#fff8f0");
      break;
    }
    case "crown":
      g.rect(4, top - 1, 8, 2, "#e8c040"); for (const x of [4, 7, 11]) g.px(x, top - 2, "#e8c040"); g.px(8, top, "#ff4a6a");
      break;
    case "flower":
      if (dir !== 1) { g.rect(10, top + 1, 2, 2, c); g.px(11, top + 1, "#fff3a0"); g.px(9, top + 2, cl); }
      break;
    default: break;
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** 16x32 walking sprite. dir: 0 down, 1 up, 2 side (facing right; flip for left). frame 0..3. */
export function personCanvas(id: string, pal: Record<string, string> | undefined, dir: Dir = 0, frame = 0): HTMLCanvasElement {
  const key = `${id}|${pal ? JSON.stringify(pal) : ""}|${dir}|${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = lookFor(id, pal);
  const g = new G(16, 32);
  const bob = frame % 2 === 1 ? 1 : 0;
  drawWeapon(g, L, dir, frame, true);
  drawBody(g, L, dir, frame);
  drawHead(g, L, dir, bob);
  drawWeapon(g, L, dir, frame, false);
  const c = g.toCanvas();
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------ portrait bust (32x32)
export function portraitCanvas(id: string, pal?: Record<string, string>): HTMLCanvasElement {
  const key = `P|${id}|${pal ? JSON.stringify(pal) : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = lookFor(id, pal);
  const g = new G(32, 32);
  const skin = L.skin, sl = hs(skin, 0.15), sd = hs(skin, -0.2);
  const hair = L.hair, hl = hs(hair, 0.3), hd = hs(hair, -0.28);
  const top = L.top;
  // shoulders / clothes
  for (let y = 24; y < 32; y++) { const w = 10 + (y - 24) * 1.6; g.span(Math.round(16 - w), Math.round(15 + w), y, top); }
  if (L.cape) for (let y = 25; y < 32; y++) { g.px(Math.round(6 - (y - 25) * 0.5), y, L.cape); g.px(Math.round(25 + (y - 25) * 0.5), y, hs(L.cape, -0.2)); }
  if (L.outfit === "armor") { g.rect(5, 25, 7, 4, L.accent); g.rect(20, 25, 7, 4, hs(L.accent, -0.15)); g.rect(13, 27, 6, 5, hs(top, 0.3)); }
  else if (L.outfit === "robe" || L.outfit === "cloak") { g.rect(15, 24, 2, 8, L.accent); }
  else if (L.outfit === "vest") { g.rect(12, 24, 8, 8, L.accent); g.rect(14, 24, 4, 8, hs(L.accent, 0.3)); }
  else if (L.outfit === "uniform") { g.rect(15, 24, 1, 8, hs(top, -0.3)); for (let y = 26; y < 32; y += 2) g.px(17, y, L.accent); g.rect(12, 23, 8, 2, hs(top, 0.35)); }
  else if (L.outfit === "jacket") { g.rect(15, 24, 2, 8, L.accent); for (let y = 25; y < 32; y += 3) g.rect(6, y, 20, 1, hs(top, -0.15)); }
  else if (L.outfit === "apron") { g.rect(11, 26, 10, 6, "#efe6d0"); }
  else g.rect(13, 24, 6, 2, L.accent);
  // neck
  g.rect(13, 21, 6, 3, sd);
  // long hair behind
  if (["long", "braids", "curly"].includes(L.hairStyle)) { const h = L.hairStyle === "long" ? 18 : 13; g.rect(5, 10, 5, h, hd); g.rect(22, 10, 5, h, hd); }
  // head
  for (let y = 5; y < 23; y++) {
    const t = (y - 5) / 17;
    const w = y < 8 ? 6 + (y - 5) * 1.3 : y > 17 ? 9 - (y - 17) * 1.1 : 9.5;
    for (let x = Math.round(16 - w); x <= Math.round(15 + w); x++) g.px(x, y, x > 21 || t > 0.85 ? sd : x < 12 && y < 14 ? sl : skin);
  }
  // ears
  g.rect(5, 13, 2, 4, skin); g.rect(25, 13, 2, 4, sd);
  if (L.ears === "elf") { g.rect(3, 11, 2, 3, skin); g.px(2, 10, skin); g.rect(27, 11, 2, 3, sd); g.px(29, 10, sd); }
  if (L.ears === "fin") { g.rect(2, 12, 4, 5, "#5ab0c8"); g.rect(26, 12, 4, 5, "#4a90a8"); }
  // eyes
  const eyeCol = L.eyes;
  for (const ex of [10, 19]) {
    g.rect(ex, 13, 4, 1, "#2a1a2a");
    g.rect(ex, 14, 4, 3, "#ffffff");
    g.rect(ex + 1, 14, 2, 3, L.glow ? L.eyes : eyeCol);
    g.px(ex + 1, 15, L.glow ? "#ffffff" : "#1a1420");
    g.px(ex + 2, 14, "#ffffff");
  }
  // brows
  g.rect(10, 11, 4, 1, hd); g.rect(19, 11, 4, 1, hd);
  // nose, mouth, blush
  g.px(16, 17, sd); g.px(16, 18, sd);
  g.rect(14, 20, 4, 1, hs(skin, -0.45)); g.px(13, 19, hs(skin, -0.3));
  g.rect(8, 18, 3, 1, "rgba(235,120,120,0.5)"); g.rect(21, 18, 3, 1, "rgba(235,120,120,0.5)");
  if (L.beard) { for (let y = 18; y < 25; y++) { const w = y < 21 ? 8 : 8 - (y - 21) * 1.5; g.span(Math.round(16 - w), Math.round(15 + w), y, hair); } g.rect(14, 20, 4, 1, hs(skin, -0.45)); }
  // hair
  if (L.hairStyle !== "bald") {
    for (let y = 2; y < 11; y++) { const w = y < 4 ? 6 + (y - 2) * 2.5 : 11; g.span(Math.round(16 - w), Math.round(15 + w), y, hair); }
    g.rect(5, 8, 3, 8, hair); g.rect(24, 8, 3, 8, hd);
    for (let i = 0; i < 5; i++) g.px(9 + i * 3, 10 + (i % 2), hair);
    g.rect(10, 3, 6, 1, hl); g.rect(8, 4, 3, 1, hl);
    if (L.hairStyle === "spiky") for (let x = 7; x < 26; x += 3) { g.px(x, 1, hair); g.px(x + 1, 0, hair); }
    if (L.hairStyle === "bob" || L.hairStyle === "long") { g.rect(5, 10, 3, 10, hair); g.rect(24, 10, 3, 10, hd); g.rect(9, 9, 14, 2, hair); }
    if (L.hairStyle === "bun") g.rect(12, 0, 8, 3, hair);
    if (L.hairStyle === "mohawk") g.rect(14, 0, 4, 3, hair);
    if (L.hairStyle === "ponytail") g.rect(25, 12, 3, 10, hd);
    if (L.hairStyle === "braids") { g.rect(4, 18, 3, 12, hair); g.rect(25, 18, 3, 12, hd); }
    if (L.hairStyle === "curly") for (const [x, y] of [[6, 5], [25, 5], [4, 9], [27, 9], [5, 14], [26, 14]]) g.rect(x, y, 2, 2, hl);
  }
  if (L.ears === "beast") { g.rect(6, 0, 5, 5, hair); g.rect(21, 0, 5, 5, hair); g.rect(7, 1, 3, 3, "#f0b0b0"); g.rect(22, 1, 3, 3, "#f0b0b0"); }
  // hats (bust scale)
  const c = L.hatCol, cl = hs(c, 0.28), cd = hs(c, -0.25);
  switch (L.hat) {
    case "wizard": case "witch":
      g.rect(1, 7, 30, 3, c); g.rect(1, 9, 30, 1, cd);
      for (let i = 0; i < 9; i++) { const w = 18 - i * 2; g.rect(16 - w / 2 + (L.hat === "witch" && i > 4 ? (i - 4) * 2 : 0), 6 - i * 0.8, w, 1, i % 2 ? c : cl); }
      g.rect(6, 6, 20, 1, L.accent);
      break;
    case "hood": g.rect(5, 1, 22, 5, c); g.rect(3, 5, 4, 20, c); g.rect(25, 5, 4, 20, cd); g.rect(7, 1, 8, 1, cl); break;
    case "helmet": g.rect(5, 1, 22, 10, c); g.rect(7, 0, 18, 1, c); g.rect(8, 2, 6, 2, cl); g.rect(5, 10, 22, 1, cd); g.rect(15, -1, 2, 2, L.accent); break;
    case "circlet": g.rect(6, 9, 20, 1, c); g.rect(15, 8, 2, 2, "#ff4a6a"); break;
    case "bandana": g.rect(6, 6, 20, 3, c); g.rect(8, 6, 6, 1, cl); g.rect(26, 8, 4, 2, c); break;
    case "cap": g.rect(6, 2, 20, 6, c); g.rect(4, 7, 22, 2, cd); g.rect(8, 3, 6, 1, cl); break;
    case "straw": g.rect(0, 7, 32, 3, c); g.rect(0, 9, 32, 1, cd); g.rect(8, 1, 16, 7, c); g.rect(8, 6, 16, 1, "#b83a2a"); g.rect(10, 2, 5, 1, cl); break;
    case "mushroom":
      for (let y = 0; y < 10; y++) { const w = y < 3 ? 14 + y * 4 : 30; g.rect(16 - w / 2, y, w, 1, y < 3 ? cl : y === 9 ? cd : c); }
      for (const [x, y] of [[6, 3], [13, 1], [20, 4], [25, 6], [10, 6]]) g.rect(x, y, 3, 2, "#fff8f0");
      break;
    case "crown": g.rect(9, 2, 14, 3, "#e8c040"); for (const x of [9, 15, 21]) g.rect(x, 0, 2, 2, "#e8c040"); g.px(16, 3, "#ff4a6a"); break;
    case "flower": g.rect(22, 5, 4, 4, c); g.rect(23, 6, 2, 2, "#fff3a0"); break;
    default: break;
  }
  const out = g.toCanvas();
  cache.set(key, out);
  return out;
}
