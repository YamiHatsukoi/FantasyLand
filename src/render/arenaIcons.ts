/**
 * Pixel icons for arena items (16x16, drawn by src/render/icons.ts): a shape and a palette per
 * item, so the item bench, unit cards and the board show proper pixel art instead of emoji.
 * Emblems use a badge in their trait's colour.
 */
import { ITEMS } from "../arena/items";
import { TRAITS } from "../arena/traits";
import { iconCanvas, iconURL, type Palette } from "./icons";

const ART: Record<string, [string, Palette]> = {
  // components
  sword: ["sword", ["#d8dee8", "#8a5a2a", "#ffd84a"]],
  bow: ["bow", ["#b07a3a", "#e8e0c8", "#ff6a4a"]],
  rod: ["wand", ["#7a4ad8", "#8a5a2a", "#b8f0ff"]],
  tear: ["a_tear", ["#4ab0ff", "#ffffff", "#c8f0ff"]],
  vest: ["mail", ["#9aa6b4", "#5a6470", "#ffd84a"]],
  cloak: ["a_cloak", ["#c8d0e0", "#6a7a9a", "#8af0ff"]],
  belt: ["a_belt", ["#c04a3a", "#e8c040", "#ffffff"]],
  glove: ["gloves", ["#5a8a4a", "#3a2a1a", "#ffd84a"]],
  seal: ["a_seal", ["#e8e8f0", "#c8a040", "#ffffff"]],
  // finished
  deathblade: ["a_sword2", ["#3a3a4a", "#a01a2a", "#ff4a4a"]],
  giantslayer: ["crossbow", ["#8a5a2a", "#e8e0c8", "#ff4a3a"]],
  gunblade: ["katana", ["#c8a0ff", "#5a2a8a", "#ff6aa0"]],
  shojin: ["spear", ["#8ad0ff", "#6a4a2a", "#4ab0ff"]],
  edge: ["dagger", ["#4a4a6a", "#1a1a2a", "#a08aff"]],
  bloodthirster: ["sword", ["#ff5a5a", "#5a1a1a", "#ffd84a"]],
  steraks: ["greataxe", ["#c8ccd4", "#7a3a1a", "#ff4a3a"]],
  infinity: ["a_sword2", ["#ffe07a", "#8a5a1a", "#ffffff"]],
  rapidfire: ["crossbow", ["#e8c040", "#5a3a1a", "#ffffff"]],
  guinsoo: ["hammer", ["#b05ae0", "#6a4a2a", "#ff8af0"]],
  statikk: ["dagger", ["#ffe14a", "#4a3a8a", "#8af0ff"]],
  titans: ["shield", ["#8a8a96", "#c8a040", "#ff8a3a"]],
  runaan: ["bow", ["#5ac06a", "#e8f0c8", "#ffffff"]],
  lastwhisper: ["bow", ["#a04ad8", "#e0d0ff", "#ff4a8a"]],
  zz: ["staff", ["#e8c8ff", "#8a6a4a", "#fff07a"]],
  rabadon: ["hat", ["#5a3ab0", "#2a1a5a", "#ffd84a"]],
  archangel: ["staff", ["#ffffff", "#c8a040", "#8ad0ff"]],
  locket: ["amulet", ["#e8c040", "#c8a040", "#ff6a8a"]],
  ionic: ["essence", ["#4a8aff", "#ffffff", "#ffe14a"]],
  morello: ["tome", ["#a02a3a", "#ffd84a", "#ff8a3a"]],
  jeweled: ["gauntlets", ["#c8ccd4", "#4a3a2a", "#ff4ad8"]],
  blue: ["orb", ["#2a7aff", "#c8a040", "#ffffff"]],
  protector: ["shield", ["#4ab0ff", "#e8e8f0", "#ffd84a"]],
  adaptive: ["helm", ["#8ad0ff", "#3a5a8a", "#ffffff"]],
  redemption: ["a_heart", ["#ff8ac0", "#ffffff", "#fff07a"]],
  hand: ["fist", ["#e8c040", "#a04a2a", "#ffffff"]],
  bramble: ["plate", ["#5a8a4a", "#2a4a1a", "#c8ff8a"]],
  gargoyle: ["helmet", ["#7a7a86", "#a0a0ac", "#ff4a4a"]],
  sunfire: ["robe", ["#ff6a2a", "#ffd84a", "#ffffff"]],
  spiked: ["mail", ["#6a6a7a", "#c8ccd4", "#ff4a4a"]],
  dragonclaw: ["claw", ["#4ac08a", "#2a5a3a", "#ffffff"]],
  crownguard: ["a_cloak", ["#8a5ad8", "#e8c040", "#ffffff"]],
  quicksilver: ["glass", ["#d8e4f0", "#ffffff", "#8af0ff"]],
  warmog: ["a_heart", ["#e02a3a", "#ffffff", "#ffd84a"]],
  redbuff: ["essence", ["#ff3a2a", "#ffffff", "#ffd84a"]],
  thief: ["sac", ["#8a6a3a", "#3a2a1a", "#ffd84a"]],
  // special
  magnet: ["a_magnet", ["#e03a3a", "#d8dee8", "#8af0ff"]],
  crown: ["a_crown", ["#ffd84a", "#4ab0ff", "#ff4a6a"]],
  dup3: ["a_copier", ["#9aa6b4", "#4a9aff", "#ffffff"]],
  dup5: ["a_copier", ["#ffc83a", "#c060ff", "#fff4b0"]],
};

function art(id: string): [string, Palette] {
  const hit = ART[id];
  if (hit) return hit;
  const it = ITEMS[id];
  if (it?.trait) {
    const c = TRAITS[it.trait]?.color ?? "#c8ccd4";
    return ["a_emblem", ["#e8e8f0", c, "#ffffff"]];
  }
  return ["orb", ["#9aa4b0", "#ffffff", "#ffffff"]];
}

/** Data URL of an item's pixel icon. */
export const arenaItemURL = (id: string, scale = 2) => { const [s, p] = art(id); return iconURL(s, p, scale); };
/** The item's icon on a canvas (for drawing on the board). */
export const arenaItemCanvas = (id: string, scale = 1) => { const [s, p] = art(id); return iconCanvas(s, p, scale); };
