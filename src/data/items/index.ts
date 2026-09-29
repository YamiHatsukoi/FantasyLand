// Registration order matters: later modules reference ids created by earlier ones.
import "./legacy";
import "./materials";
import "./farm";
import { applyHerbUses } from "./consumables";
import "./equipment";
import { PASSIVES } from "../passives";
import { SKILLS } from "../skills";
import { ITEMS, ITEM_LIST, type ItemDef } from "./core";

applyHerbUses();

export { ITEMS, ITEM_LIST, TYPE_NAMES, TYPE_EMOJI } from "./core";
export type { ItemDef, ItemType, ItemUse, EquipSlot, MealBuff } from "./core";
export { METALS, BIOME_MATS, ESSENCES, metalTierForFloor } from "./materials";
export { CROPS, CROP_LIST, SEASON_NAMES, SEASON_ICONS, DAYS_PER_SEASON, seasonOf } from "./farm";
export type { CropDef, Season } from "./farm";
export { CONSUMABLE_RECIPES } from "./consumables";
export { EQUIP_RECIPES, EQUIP_KINDS, LEGENDARY_BY_BIOME, tierUnit } from "./equipment";

const tomeCache: Record<string, ItemDef> = {};

export function getItem(id: string): ItemDef {
  const hit = ITEMS[id] ?? tomeCache[id];
  if (hit) return hit;
  if (id.startsWith("tome:")) {
    const sk = SKILLS[id.slice(5)];
    if (sk) return (tomeCache[id] = { id, name: `Sách: ${sk.name}`, icon: "📕", shape: "book", col: ["#8a3a3a", "#f2c542", "#ffe14a"], type: "tome", value: 40 * sk.tier, desc: `Dạy kỹ năng ${sk.name} cho một nhân vật.`, skill: sk.id });
  }
  if (id.startsWith("ptome:")) {
    const p = PASSIVES[id.slice(6)];
    if (p) return (tomeCache[id] = { id, name: `Bí kíp: ${p.name}`, icon: "📗", shape: "book", col: ["#2a6a4a", "#f2c542", "#8aff8a"], type: "tome", value: 50 * p.tier, desc: `Dạy nội tại ${p.name}: ${p.desc}`, passive: p.id });
  }
  return { id, name: id, icon: "❓", shape: "orb", col: ["#888888", "#444444", "#ffffff"], type: "material", value: 0, desc: "Vật phẩm không xác định." };
}

export const itemCount = () => ITEM_LIST.length;
