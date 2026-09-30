// Registration order matters: later modules reference ids created by earlier ones.
import "./legacy";
import "./materials";
import "./farm";
import { applyHerbUses } from "./consumables";
import "./equipment";
import { PASSIVES } from "../passives";
import { SKILLS } from "../skills";
import { ITEMS, ITEM_LIST, type ItemDef } from "./core";
import type { StatMods } from "../../combat/types";

applyHerbUses();

export { ITEMS, ITEM_LIST, TYPE_NAMES, TYPE_EMOJI } from "./core";
export type { ItemDef, ItemType, ItemUse, EquipSlot, GearKey, Rarity, MealBuff } from "./core";
export { METALS, BIOME_MATS, ESSENCES, metalTierForFloor } from "./materials";
export { CROPS, CROP_LIST, SEASON_NAMES, SEASON_ICONS, DAYS_PER_SEASON, cropSeconds, seasonOf } from "./farm";
export type { CropDef, Season } from "./farm";
export { CONSUMABLE_RECIPES } from "./consumables";
export { EQUIP_RECIPES, EQUIP_KINDS, KIND_NAMES, KIND_BY_ID, GEAR_BY_FLOOR, LEGENDARY_BY_BIOME, RELIC_KINDS, gearForFloor, registerRelic, tierUnit } from "./equipment";

const tomeCache: Record<string, ItemDef> = {};

// ------------------------------------------------------------ forge enhancement lives on the item
/** "iron_sword+4" is an Iron Sword enhanced to +4; the level travels with the item. */
export const enhLevel = (id: string) => { const m = /\+(\d+)$/.exec(id); return m ? Number(m[1]) : 0; };
export const baseItemId = (id: string) => id.replace(/\+\d+$/, "");
export const enhancedId = (id: string, lvl: number) => (lvl > 0 ? `${baseItemId(id)}+${lvl}` : baseItemId(id));
/** Each level adds 10% of every positive stat, and at least +1 per level (crit/dodge excepted). */
export const ENH_STEP = 0.1;
export function enhStats(stats: StatMods, lvl: number): StatMods {
  const out: StatMods = {};
  for (const [k, v] of Object.entries(stats) as [keyof StatMods, number][]) {
    if (!v || v < 0 || lvl <= 0) { out[k] = v; continue; }
    const pct = Math.round(v * ENH_STEP * lvl);
    out[k] = v + (k === "crit" || k === "eva" ? pct : Math.max(lvl, pct));
  }
  return out;
}

export function getItem(id: string): ItemDef {
  const hit = ITEMS[id] ?? tomeCache[id];
  if (hit) return hit;
  const lvl = enhLevel(id);
  if (lvl > 0) {
    const base = ITEMS[baseItemId(id)];
    if (base?.equip) {
      return (tomeCache[id] = {
        ...base, id, name: `${base.name} +${lvl}`, value: Math.round(base.value * (1 + 0.25 * lvl)),
        equip: { ...base.equip, stats: enhStats(base.equip.stats, lvl) },
      });
    }
  }
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
