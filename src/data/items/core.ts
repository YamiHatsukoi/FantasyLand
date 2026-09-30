import type { Eff, Element, StatMods } from "../../combat/types";
import type { Palette } from "../../render/icons";

export type ItemType =
  | "material" | "seed" | "crop" | "food" | "potion" | "bomb" | "equip" | "tome" | "key"
  | "herb" | "scroll" | "fertilizer" | "animal" | "sapling";
export type EquipSlot = "weapon" | "offhand" | "head" | "armor" | "hands" | "legs" | "feet" | "neck" | "ring" | "earring";
/** Character gear slots: every item slot, plus a second ring finger. */
export type GearKey = EquipSlot | "ring2";
export type Rarity = "common" | "rare" | "epic" | "legendary";

/** What a consumable does when used (in battle or on the map). */
export interface ItemUse {
  target: "ally" | "allies" | "enemies" | "deadAlly" | "none";
  healPct?: number;
  healFlat?: number;
  mpPct?: number;
  cleanse?: boolean;
  revivePct?: number;
  fx?: Eff[];
  dmg?: { el: Element; base: number }; // base damage scaled by floor
  field?: boolean; // usable outside battle
  battle?: boolean; // usable in battle (default true unless target "none")
  special?: "returnHome" | "revealMap" | "repel" | "lure";
}

/** A meal buff that lasts until the party returns to the sanctuary. */
export interface MealBuff {
  name: string;
  mods: StatMods;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // emoji used in plain text (toasts, logs)
  shape: string; // pixel icon drawer
  col: Palette; // pixel icon palette
  type: ItemType;
  desc: string;
  value: number; // sell price
  tier?: number;
  use?: ItemUse;
  meal?: MealBuff;
  equip?: {
    slot: EquipSlot;
    stats: StatMods;
    passive?: string;
    kind?: string;
    hands?: 1 | 2; // weapons: 1 = one-handed (can be dual-wielded), 2 = needs both hands
    floor?: number; // depth the item belongs to
    rarity?: Rarity;
  };
  crop?: string; // seed/sapling -> crop id
  skill?: string; // tome
  passive?: string; // passive tome
  fert?: { soil: number; speed?: number }; // fertilizer effect
  tags?: string[];
}

export const ITEMS: Record<string, ItemDef> = {};
export const ITEM_LIST: ItemDef[] = [];

export function addDef(d: ItemDef): ItemDef {
  if (ITEMS[d.id]) throw new Error(`Duplicate item ${d.id}`);
  ITEMS[d.id] = d;
  ITEM_LIST.push(d);
  return d;
}

export interface Opt extends Partial<Omit<ItemDef, "id" | "name" | "type" | "value" | "desc">> {}

/** Short helper: I(id, name, type, value, desc, shape, palette, extra). */
export function I(id: string, name: string, type: ItemType, value: number, desc: string, shape: string, col: Palette, o: Opt = {}): ItemDef {
  return addDef({ id, name, type, value, desc, shape, col, icon: o.icon ?? TYPE_EMOJI[type], ...o });
}

export const TYPE_EMOJI: Record<ItemType, string> = {
  material: "📦", seed: "🫘", crop: "🌾", food: "🍲", potion: "🧪", bomb: "💣", equip: "⚔️",
  tome: "📕", key: "🗝️", herb: "🌿", scroll: "📜", fertilizer: "🟤", animal: "🥚", sapling: "🌱",
};

export const TYPE_NAMES: Record<ItemType, string> = {
  material: "Nguyên liệu", seed: "Hạt giống", crop: "Nông sản", food: "Món ăn", potion: "Thuốc",
  bomb: "Vật phẩm ném", equip: "Trang bị", tome: "Sách kỹ năng", key: "Vật phẩm cốt truyện",
  herb: "Thảo mộc", scroll: "Cuộn phép", fertilizer: "Phân bón", animal: "Sản vật chăn nuôi", sapling: "Cây giống",
};

/** Colour helpers for generated palettes. */
export const C = {
  wood: "#8a5a2a", darkwood: "#5a3a1e", paleWood: "#c8a070", stone: "#8a8f96", darkStone: "#4a4e56",
  leaf: "#4f9a45", leafLight: "#8fd46a", red: "#d8433a", orange: "#e8902a", gold: "#f2c542", white: "#f4efe6",
  blue: "#4a8ae0", cyan: "#5ad8e8", purple: "#8a5ad8", pink: "#f08ab8", black: "#2a2a34", brown: "#7a5230",
  green: "#3fae4a", teal: "#2a9a8a", bone: "#e8dcc0", glass: "#b8e8f0", ember: "#ff7a2a",
};
