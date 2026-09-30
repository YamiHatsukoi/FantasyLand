import type { StatMods } from "../../combat/types";
import { shade, type Palette } from "../../render/icons";
import { C, I, type EquipSlot, type ItemDef, type Rarity } from "./core";
import { BIOME_MATS, METALS, metalTierForFloor } from "./materials";
import type { RecipeSeed } from "./consumables";
import type { Station } from "./recipeTypes";

/**
 * Equipment. Every kind (40 of them: 20 weapon kinds, body armor, helmets, gloves, leg armor,
 * boots, necklaces, rings, earrings) has 100 generated pieces, one per floor of the abyss, so a
 * deeper floor always has something new to find. Hand-made legacy items and the old per-tier
 * line (`sword_t3` …) stay registered so existing saves keep working.
 */

export const EQUIP_RECIPES: RecipeSeed[] = [];
const r = Math.round;

type Mat = "metal" | "wood" | "cloth" | "leather" | "gem";
interface Kind {
  id: string;
  name: string;
  slot: EquipSlot;
  hands?: 1 | 2;
  mat: Mat;
  stats: (u: number, t: number) => StatMods; // u = power unit of the item's depth
  cost: (t: number) => Record<string, number>;
  passives: string[];
  vf?: number; // value factor
}

// Secondary crafting materials come from the biome whose depth matches the tier.
const BIOME_BY_TIER = ["forest", "desert", "swamp", "tundra", "fungal", "volcano", "reef", "bamboo", "crystal", "autumn", "sakura", "glacier"];
const bm = (t: number) => BIOME_MATS[BIOME_BY_TIER[t - 1]];
const ing = (t: number) => METALS[t - 1].ingot;
const extra = (t: number): Record<string, number> => (t >= 5 ? { mana_crystal: t - 4 } : {}) as Record<string, number>;

// passive pools
const PS = {
  blade: ["p_might", "p_serrated", "p_vengeance", "p_executioner", "p_momentum", "p_last_breath", "p_exploit", "p_bloodlust", "p_berserker_blood"],
  heavy: ["p_bloodlust", "p_executioner", "p_berserker_blood", "p_vengeance", "p_colossus", "p_might", "p_momentum", "p_last_breath", "p_thick_hide"],
  pole: ["p_vanguard", "p_momentum", "p_might", "p_thick_hide", "p_serrated", "p_swift", "p_last_breath", "p_executioner", "p_vengeance"],
  ranged: ["p_keen", "p_vanguard", "p_venomous", "p_exploit", "p_swift", "p_arsonist", "p_conductor", "p_momentum", "p_lucky"],
  sneak: ["p_nimble", "p_venomous", "p_serrated", "p_exploit", "p_ambusher", "p_bleed_master", "p_lucky", "p_plague_master", "p_executioner"],
  arcane: ["p_wisdom", "p_mana_well", "p_pyro", "p_cryo", "p_storm", "p_catalyst", "p_meditative", "p_elementalist", "p_burn_master"],
  spark: ["p_conductor", "p_soaker", "p_wisdom", "p_arsonist", "p_catalyst", "p_hydro", "p_aero", "p_shadow", "p_holy"],
  guard: ["p_iron_skin", "p_thick_hide", "p_prickly", "p_steadfast", "p_colossus", "p_warded", "p_last_breath", "p_vigor", "p_spirit"],
  monk: ["p_swift", "p_vengeance", "p_regeneration", "p_momentum", "p_berserker_blood", "p_meditative", "p_bloodlust", "p_lucky", "p_last_breath"],
  reaper: ["p_shadow", "p_bloodlust", "p_soul_siphon", "p_bleed_master", "p_executioner", "p_plague_master", "p_toxic", "p_exploit", "p_berserker_blood"],
  holy: ["p_healer", "p_wisdom", "p_holy", "p_pure_soul", "p_meditative", "p_hydro", "p_catalyst", "p_elementalist", "p_mana_well"],
  song: ["p_healer", "p_lucky", "p_meditative", "p_swift", "p_spirit", "p_pure_soul", "p_mana_well", "p_aero", "p_holy"],
  cloth: ["p_mana_well", "p_spirit", "p_meditative", "p_pure_soul", "p_wisdom", "p_warded", "p_healer", "p_catalyst", "p_steadfast"],
  hide: ["p_nimble", "p_swift", "p_ambusher", "p_lucky", "p_vigor", "p_regeneration", "p_vanguard", "p_thick_hide", "p_momentum"],
  metal: ["p_iron_skin", "p_spirit", "p_vigor", "p_thick_hide", "p_prickly", "p_steadfast", "p_regeneration", "p_last_breath", "p_warded"],
  plate: ["p_iron_skin", "p_colossus", "p_thick_hide", "p_steadfast", "p_prickly", "p_last_breath", "p_vigor", "p_warded", "p_vengeance"],
  ring: ["p_lucky", "p_keen", "p_might", "p_wisdom", "p_exploit", "p_catalyst", "p_executioner", "p_elementalist", "p_bloodlust"],
  amulet: ["p_pure_soul", "p_mana_well", "p_spirit", "p_healer", "p_holy", "p_meditative", "p_steadfast", "p_warded", "p_soul_siphon"],
  charm: ["p_regeneration", "p_vigor", "p_warded", "p_prickly", "p_steadfast", "p_thick_hide", "p_colossus", "p_last_breath", "p_pure_soul"],
  feet: ["p_swift", "p_nimble", "p_vanguard", "p_momentum", "p_ambusher", "p_lucky", "p_aero", "p_steadfast", "p_regeneration"],
  ear: ["p_wisdom", "p_conductor", "p_soaker", "p_arsonist", "p_frostbite", "p_catalyst", "p_elementalist", "p_shadow", "p_holy"],
};

// armor weight profiles (full body = 1.0)
const LIGHT = (u: number): StatMods => ({ res: r(u * 0.8), mp: r(u * 3), mag: r(u * 0.2) });
const MEDIUM = (u: number, t: number): StatMods => ({ def: r(u * 0.6), hp: r(u * 3), eva: 2 + (t >> 3) });
const HEAVY = (u: number): StatMods => ({ def: r(u * 0.9), res: r(u * 0.3), hp: r(u * 6), spd: -2 });
function part(base: StatMods, f: number, add: StatMods = {}): StatMods {
  const out: StatMods = {};
  for (const [k, v] of Object.entries(base) as [keyof StatMods, number][]) {
    const x = k === "eva" || k === "crit" || k === "spd" ? Math.round(v * Math.min(1, f * 2)) : Math.round(v * f);
    if (x) out[k] = x;
  }
  for (const [k, v] of Object.entries(add) as [keyof StatMods, number][]) if (v) out[k] = (out[k] ?? 0) + v;
  return out;
}

const clothCost = (n: number) => (t: number) => ({ [bm(t).cloth]: n, [bm(t).extract]: 1 });
const hideCost = (n: number) => (t: number) => ({ [bm(t).leather]: n, [bm(t).cloth]: 1 });
const metalCost = (n: number) => (t: number) => ({ [ing(t)]: n, [bm(t).leather]: 1 });

const KINDS: Kind[] = [
  // ---- one-handed weapons (main hand, or off hand for dual wielding)
  { id: "sword", name: "Trường Kiếm", slot: "weapon", hands: 1, mat: "metal", stats: (u, t) => ({ atk: r(u), crit: 2 + (t >> 2) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).leather]: 1 }), passives: PS.blade },
  { id: "dagger", name: "Đoản Đao", slot: "weapon", hands: 1, mat: "metal", stats: (u, t) => ({ atk: r(u * 0.8), crit: 5 + (t >> 1), eva: 2 }), cost: (t) => ({ [ing(t)]: 2, [bm(t).leather]: 1 }), passives: PS.sneak },
  { id: "axe", name: "Chiến Phủ", slot: "weapon", hands: 1, mat: "metal", stats: (u) => ({ atk: r(u * 1.15), spd: -2 }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 2 }), passives: PS.heavy },
  { id: "mace", name: "Chùy Gai", slot: "weapon", hands: 1, mat: "metal", stats: (u) => ({ atk: r(u * 0.95), def: r(u * 0.2), res: r(u * 0.1) }), cost: (t) => ({ [ing(t)]: 4, [bm(t).plank]: 1 }), passives: PS.guard },
  { id: "wand", name: "Đũa Phép", slot: "weapon", hands: 1, mat: "wood", stats: (u, t) => ({ mag: r(u * 0.95), crit: 3 + (t >> 2), spd: 3 }), cost: (t) => ({ [bm(t).plank]: 1, [bm(t).gem]: 1, [bm(t).extract]: 1 }), passives: PS.spark },
  { id: "whip", name: "Roi Da", slot: "weapon", hands: 1, mat: "leather", stats: (u, t) => ({ atk: r(u * 0.85), spd: 3 + (t >> 2), crit: 3 }), cost: (t) => ({ [bm(t).leather]: 3, [ing(t)]: 1 }), passives: PS.sneak },
  // ---- two-handed weapons
  { id: "greatsword", name: "Đại Kiếm", slot: "weapon", hands: 2, mat: "metal", stats: (u, t) => ({ atk: r(u * 1.5), crit: 2 + (t >> 2), def: r(u * 0.1) }), cost: (t) => ({ [ing(t)]: 5, [bm(t).leather]: 1 }), passives: PS.blade, vf: 1.3 },
  { id: "greataxe", name: "Đại Phủ", slot: "weapon", hands: 2, mat: "metal", stats: (u) => ({ atk: r(u * 1.75), crit: 3, spd: -5 }), cost: (t) => ({ [ing(t)]: 5, [bm(t).plank]: 2 }), passives: PS.heavy, vf: 1.3 },
  { id: "hammer", name: "Chiến Chùy", slot: "weapon", hands: 2, mat: "metal", stats: (u) => ({ atk: r(u * 1.6), def: r(u * 0.3), spd: -6 }), cost: (t) => ({ [ing(t)]: 6, [bm(t).plank]: 1 }), passives: PS.heavy, vf: 1.3 },
  { id: "spear", name: "Thương", slot: "weapon", hands: 2, mat: "metal", stats: (u, t) => ({ atk: r(u * 1.4), def: r(u * 0.25), spd: 1 + (t >> 2) }), cost: (t) => ({ [ing(t)]: 2, [bm(t).plank]: 2 }), passives: PS.pole, vf: 1.2 },
  { id: "scythe", name: "Lưỡi Hái", slot: "weapon", hands: 2, mat: "metal", stats: (u) => ({ atk: r(u * 1.4), mag: r(u * 0.5) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 2 }), passives: PS.reaper, vf: 1.3 },
  { id: "staff", name: "Pháp Trượng", slot: "weapon", hands: 2, mat: "wood", stats: (u) => ({ mag: r(u * 1.5), mp: r(u * 2.5) }), cost: (t) => ({ [bm(t).plank]: 3, [bm(t).gem]: 1 }), passives: PS.arcane, vf: 1.2 },
  { id: "bow", name: "Trường Cung", slot: "weapon", hands: 2, mat: "wood", stats: (u, t) => ({ atk: r(u * 1.35), crit: 4 + (t >> 2), spd: 2 }), cost: (t) => ({ [bm(t).plank]: 3, [bm(t).cloth]: 1, [ing(t)]: 1 }), passives: PS.ranged, vf: 1.2 },
  { id: "crossbow", name: "Nỏ Liên Châu", slot: "weapon", hands: 2, mat: "wood", stats: (u, t) => ({ atk: r(u * 1.55), crit: 6 + (t >> 2), spd: -2 }), cost: (t) => ({ [bm(t).plank]: 2, [ing(t)]: 2 }), passives: PS.ranged, vf: 1.3 },
  { id: "fist", name: "Thiết Thủ", slot: "weapon", hands: 2, mat: "metal", stats: (u, t) => ({ atk: r(u * 1.25), spd: 5 + (t >> 2), crit: 3 }), cost: (t) => ({ [ing(t)]: 1, [bm(t).leather]: 2 }), passives: PS.monk, vf: 1.1 },
  { id: "katana", name: "Thái Đao", slot: "weapon", hands: 2, mat: "metal", stats: (u, t) => ({ atk: r(u * 1.4), crit: 5 + (t >> 1), eva: 1 }), cost: (t) => ({ [ing(t)]: 4, [bm(t).cloth]: 1 }), passives: PS.blade, vf: 1.3 },
  { id: "lute", name: "Đàn Lute", slot: "weapon", hands: 2, mat: "wood", stats: (u, t) => ({ mag: r(u * 1.1), res: r(u * 0.4), mp: r(u * 2), spd: 2 + (t >> 2) }), cost: (t) => ({ [bm(t).plank]: 3, [bm(t).fiber]: 2 }), passives: PS.song, vf: 1.2 },
  // ---- off hand only
  { id: "shield", name: "Khiên", slot: "offhand", mat: "metal", stats: (u) => ({ def: r(u * 0.7), hp: r(u * 2.8), res: r(u * 0.2) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 1, [bm(t).leather]: 1 }), passives: PS.guard },
  { id: "tome", name: "Ma Thư", slot: "offhand", mat: "leather", stats: (u) => ({ mag: r(u * 0.6), res: r(u * 0.2), mp: r(u * 1.5) }), cost: (t) => ({ [bm(t).cloth]: 2, [bm(t).leather]: 1, [bm(t).gem]: 1, paper: 2 }), passives: PS.holy },
  { id: "orb", name: "Quả Cầu Phép", slot: "offhand", mat: "gem", stats: (u, t) => ({ mag: r(u * 0.7), mp: r(u), crit: 1 + (t >> 3) }), cost: (t) => ({ [bm(t).gem]: 2, [ing(t)]: 1 }), passives: PS.arcane },
  // ---- body
  { id: "robe", name: "Pháp Bào", slot: "armor", mat: "cloth", stats: (u) => LIGHT(u), cost: clothCost(4), passives: PS.cloth },
  { id: "leather", name: "Giáp Da", slot: "armor", mat: "leather", stats: (u, t) => MEDIUM(u, t), cost: hideCost(4), passives: PS.hide },
  { id: "mail", name: "Giáp Xích", slot: "armor", mat: "metal", stats: (u) => ({ def: r(u * 0.8), res: r(u * 0.4), hp: r(u * 5) }), cost: metalCost(4), passives: PS.metal },
  { id: "plate", name: "Trọng Giáp", slot: "armor", mat: "metal", stats: (u) => ({ def: r(u * 1.1), hp: r(u * 8), spd: -4 }), cost: (t) => ({ [ing(t)]: 6, [bm(t).cloth]: 1 }), passives: PS.plate },
  // ---- head
  { id: "hat", name: "Mũ Pháp Sư", slot: "head", mat: "cloth", stats: (u) => part(LIGHT(u), 0.25, { res: r(u * 0.1) }), cost: clothCost(2), passives: PS.cloth, vf: 0.6 },
  { id: "cap", name: "Mũ Da", slot: "head", mat: "leather", stats: (u, t) => part(MEDIUM(u, t), 0.25, { res: r(u * 0.1) }), cost: hideCost(2), passives: PS.hide, vf: 0.6 },
  { id: "helm", name: "Mũ Giáp", slot: "head", mat: "metal", stats: (u) => part(HEAVY(u), 0.25, { res: r(u * 0.1) }), cost: metalCost(2), passives: PS.metal, vf: 0.6 },
  // ---- hands
  { id: "gloves", name: "Găng Tay Lụa", slot: "hands", mat: "cloth", stats: (u) => part(LIGHT(u), 0.2, { mag: r(u * 0.1) }), cost: clothCost(1), passives: PS.spark, vf: 0.5 },
  { id: "bracers", name: "Hộ Uyển", slot: "hands", mat: "leather", stats: (u, t) => part(MEDIUM(u, t), 0.2, { crit: 1 }), cost: hideCost(1), passives: PS.sneak, vf: 0.5 },
  { id: "gauntlets", name: "Găng Giáp", slot: "hands", mat: "metal", stats: (u) => part(HEAVY(u), 0.2, { atk: r(u * 0.1) }), cost: metalCost(1), passives: PS.heavy, vf: 0.5 },
  // ---- legs
  { id: "pants", name: "Quần Lụa", slot: "legs", mat: "cloth", stats: (u) => part(LIGHT(u), 0.25, { hp: r(u) }), cost: clothCost(2), passives: PS.cloth, vf: 0.6 },
  { id: "leggings", name: "Xà Cạp Da", slot: "legs", mat: "leather", stats: (u, t) => part(MEDIUM(u, t), 0.25, { hp: r(u) }), cost: hideCost(2), passives: PS.hide, vf: 0.6 },
  { id: "greaves", name: "Giáp Chân", slot: "legs", mat: "metal", stats: (u) => part(HEAVY(u), 0.25, { hp: r(u) }), cost: metalCost(2), passives: PS.plate, vf: 0.6 },
  // ---- feet
  { id: "shoes", name: "Hài Vải", slot: "feet", mat: "cloth", stats: (u, t) => part(LIGHT(u), 0.2, { spd: 2 + (t >> 2) }), cost: clothCost(1), passives: PS.feet, vf: 0.5 },
  { id: "boots", name: "Ủng Da", slot: "feet", mat: "leather", stats: (u, t) => ({ spd: 3 + t, eva: 1 + (t >> 2), def: r(u * 0.15) }), cost: hideCost(2), passives: PS.feet, vf: 0.6 },
  { id: "sabatons", name: "Giày Sắt", slot: "feet", mat: "metal", stats: (u, t) => part(HEAVY(u), 0.2, { spd: 1 + (t >> 2) }), cost: metalCost(1), passives: PS.feet, vf: 0.5 },
  // ---- jewellery
  { id: "amulet", name: "Dây Chuyền", slot: "neck", mat: "gem", stats: (u) => ({ res: r(u * 0.35), mp: r(u * 2), mag: r(u * 0.2) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 2 }), passives: PS.amulet, vf: 0.8 },
  { id: "charm", name: "Bùa Hộ Mệnh", slot: "neck", mat: "leather", stats: (u) => ({ hp: r(u * 3.5), def: r(u * 0.2) }), cost: (t) => ({ [bm(t).leather]: 1, [bm(t).gem]: 1, [bm(t).extract]: 1 }), passives: PS.charm, vf: 0.8 },
  { id: "ring", name: "Nhẫn", slot: "ring", mat: "gem", stats: (u, t) => ({ atk: r(u * 0.2), mag: r(u * 0.2), crit: 1 + (t >> 2) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 1 }), passives: PS.ring, vf: 0.8 },
  { id: "earring", name: "Hoa Tai", slot: "earring", mat: "gem", stats: (u, t) => ({ mag: r(u * 0.25), crit: 1 + (t >> 3), res: r(u * 0.2) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 1 }), passives: PS.ear, vf: 0.8 },
];

export const KIND_BY_ID: Record<string, Kind> = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const EQUIP_KINDS = KINDS.map((k) => k.id);
export const KIND_NAMES: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.name]));
KIND_BY_ID.helmet = KIND_BY_ID.helm; // legacy shape name

/** Power unit for a tier: tier 1 ≈ 5, tier 12 ≈ 100 (fractional tiers allowed). */
export const tierUnit = (t: number) => 5 + 8.6 * (t - 1);
/** Continuous tier of a floor: floor 1 → 1, floor 100 → 12. */
const floorTier = (f: number) => 1 + (f - 1) / 9;

// ------------------------------------------------------------ legacy equipment (ids stable)
type L = [id: string, name: string, shape: string, slot: string, value: number, stats: StatMods, passive?: string, col?: string];
const legacy: L[] = [
  ["iron_sword", "Kiếm Sắt Thô", "sword", "weapon", 30, { atk: 6 }],
  ["oak_staff", "Trượng Gỗ Sồi", "staff", "weapon", 30, { mag: 7, mp: 10 }, undefined, "#8a5a2a"],
  ["hunter_bow", "Cung Thợ Săn", "bow", "weapon", 30, { atk: 5, crit: 4 }, undefined, "#8a5a2a"],
  ["fang_dagger", "Dao Nanh Sói", "dagger", "weapon", 30, { atk: 5, crit: 6 }, undefined, "#f4efe6"],
  ["bark_shield", "Khiên Vỏ Cây", "shield", "weapon", 30, { def: 6, hp: 15 }, undefined, "#7a5230"],
  ["leather_armor", "Giáp Da Thú", "leather", "armor", 30, { def: 5, hp: 20 }, undefined, "#8a5a3a"],
  ["mushroom_robe", "Áo Sợi Nấm", "robe", "armor", 30, { res: 5, mp: 15 }, undefined, "#5ab0ff"],
  ["fang_necklace", "Vòng Nanh Sói", "amulet", "accessory", 25, { atk: 3, crit: 3 }, undefined, "#f4efe6"],
  ["herb_charm", "Bùa Thảo Mộc", "charm", "accessory", 40, { res: 3 }, "p_regeneration", "#4f9a45"],
  ["amber_blade", "Kiếm Hổ Phách", "sword", "weapon", 90, { atk: 12 }, "p_arsonist", "#f0a030"],
  ["sun_staff", "Trượng Mặt Trời", "staff", "weapon", 90, { mag: 14, mp: 20 }, undefined, "#ffd040"],
  ["chitin_bow", "Cung Giáp Xác", "bow", "weapon", 90, { atk: 11, crit: 6 }, undefined, "#d9912b"],
  ["scorpion_dagger", "Dao Đuôi Bọ Cạp", "dagger", "weapon", 90, { atk: 10, crit: 8 }, "p_venomous", "#d9912b"],
  ["sandstone_shield", "Khiên Sa Thạch", "shield", "weapon", 90, { def: 12, hp: 40 }, undefined, "#e0b870"],
  ["chitin_armor", "Giáp Xác Bọ Cạp", "mail", "armor", 90, { def: 12, hp: 45 }, undefined, "#d9912b"],
  ["desert_robe", "Áo Choàng Sa Mạc", "robe", "armor", 90, { res: 10, mp: 30, eva: 4 }, undefined, "#e8dcc0"],
  ["amber_amulet", "Bùa Hổ Phách", "amulet", "accessory", 80, { mag: 6, res: 6 }, undefined, "#f0a030"],
  ["sand_boots", "Giày Lướt Cát", "boots", "accessory", 80, { spd: 8, eva: 5 }, undefined, "#c8a060"],
  ["bog_axe", "Rìu Sắt Đầm Lầy", "axe", "weapon", 200, { atk: 20, crit: 4 }, "p_executioner", "#5a6470"],
  ["lantern_staff", "Trượng Đèn Lồng", "staff", "weapon", 200, { mag: 22, mp: 30 }, "p_soul_siphon", "#ffb030"],
  ["pearl_bow", "Cung Ngọc Trai", "bow", "weapon", 200, { atk: 18, crit: 8 }, undefined, "#3a3a4a"],
  ["bog_shield", "Khiên Sắt Đầm Lầy", "shield", "weapon", 200, { def: 20, hp: 70 }, "p_thick_hide", "#5a6470"],
  ["bog_plate", "Giáp Sắt Đầm Lầy", "plate", "armor", 200, { def: 20, hp: 80, res: 6 }, undefined, "#5a6470"],
  ["glowmoss_cloak", "Áo Rêu Phát Quang", "robe", "armor", 200, { res: 16, mp: 40, eva: 6 }, undefined, "#6aff9a"],
  ["black_pearl_ring", "Nhẫn Ngọc Trai Đen", "ring", "accessory", 180, { mag: 10, crit: 6 }, undefined, "#3a3a4a"],
  ["soul_charm", "Bùa Linh Hồn", "charm", "accessory", 180, { res: 8 }, "p_pure_soul", "#e8e0f0"],
  ["drowned_crown", "Vương Miện Chết Đuối", "helmet", "accessory", 500, { mag: 14, res: 14, mp: 30 }, "p_hydro", "#e0c040"],
  ["mithril_sword", "Kiếm Mithril Tiên Phong", "sword", "weapon", 450, { atk: 32, crit: 6 }, undefined, "#8ad8f0"],
  ["mithril_staff", "Trượng Mithril Tiên Phong", "staff", "weapon", 450, { mag: 34, mp: 50 }, undefined, "#8ad8f0"],
  ["mithril_bow", "Cung Mithril Tiên Phong", "bow", "weapon", 450, { atk: 30, crit: 10 }, undefined, "#8ad8f0"],
  ["mithril_shield", "Khiên Mithril Tiên Phong", "shield", "weapon", 450, { def: 32, hp: 130 }, undefined, "#8ad8f0"],
  ["mithril_mail", "Giáp Lưới Mithril Tiên Phong", "mail", "armor", 450, { def: 30, hp: 140, res: 12 }, undefined, "#8ad8f0"],
  ["archmage_robe", "Áo Đại Pháp Sư", "robe", "armor", 450, { res: 26, mp: 70, mag: 8 }, undefined, "#6a3ab0"],
  ["core_amulet", "Bùa Lõi Quái Vật", "amulet", "accessory", 400, { atk: 10, mag: 10, spd: 6 }, undefined, "#e83a3a"],
];
for (const [id, name, shape, , value, stats, passive, col] of legacy) {
  const k = KIND_BY_ID[shape];
  I(id, name, "equip", value, "", shape, [col ?? "#9aa4b0", C.brown, "#ffd040"], { equip: { slot: k.slot, stats, passive, kind: shape, hands: k.hands, rarity: passive ? "rare" : "common" }, icon: iconFor(k.slot) });
}

function iconFor(slot: EquipSlot) {
  return ({ weapon: "⚔️", offhand: "🛡️", head: "⛑️", armor: "🦺", hands: "🧤", legs: "👖", feet: "🥾", neck: "📿", ring: "💍", earring: "💎" } as Record<EquipSlot, string>)[slot];
}

// ------------------------------------------------------------ naming & colours
const WOOD_N = ["Sồi", "Keo", "Đước", "Thông Tuyết", "Thân Nấm", "Than Hồng", "Gỗ Trôi", "Trúc Ngọc", "Rễ Pha Lê", "Phong Đỏ", "Anh Đào", "Băng Mộc"];
const CLOTH_N = ["Vải Lanh", "Sợi Cọ", "Cói Đầm", "Lông Tuần Lộc", "Tơ Nấm", "Sợi Hỏa", "Rong Biển", "Sợi Tre", "Tơ Ánh Sáng", "Gai Dầu", "Tơ Tằm Hồng", "Lông Mây"];
const LEATHER_N = ["Da Thú", "Da Thằn Lằn", "Da Ếch", "Da Gấu Tuyết", "Da Sên", "Vảy Kỳ Nhông", "Da Cá Mập", "Da Hổ Vằn", "Da Pha Lê", "Da Hươu Đỏ", "Da Cáo", "Da Hải Mã"];
const GEM_N = ["Lục Bảo", "Hổ Phách", "Ngọc Trai", "Băng Tâm", "Bào Tử", "Hồng Ngọc", "Ngọc Biển", "Phỉ Thúy", "Thạch Anh", "Mã Não", "Hồng Anh", "Kim Cương"];
const WOOD_C = ["#8a5a2a", "#c89a5a", "#4a3a2a", "#6a5a4a", "#d8c8e0", "#3a2a2a", "#b0a080", "#8aca5a", "#a0c8ff", "#a03a2a", "#8a4a3a", "#a0c0d8"];
const CLOTH_C = ["#7aa84a", "#d8b87a", "#8a9a5a", "#e8e0d0", "#f0e8f0", "#b0a090", "#4a8a6a", "#c8d890", "#f0f0ff", "#b8a060", "#ffd8e8", "#f8f8ff"];
const LEATHER_C = ["#8a5a3a", "#c8a060", "#4a8a5a", "#e8e8e8", "#a08ab0", "#e8602a", "#6a8aa0", "#e8902a", "#8ab0e0", "#b0603a", "#f0a060", "#8a7a6a"];
const GEM_C = ["#3ad86a", "#f0a030", "#3a3a4a", "#8ad8ff", "#b04ae0", "#ff3a4a", "#5ae0f0", "#4ad890", "#a060f0", "#e8904a", "#ff80b0", "#e8ffff"];

/** Affixes: a name and a small bonus. Each floor inside a metal tier gets a different one. */
const AFFIX: [string, (u: number) => StatMods][] = [
  ["Sắc Bén", () => ({ crit: 2 })],
  ["Cuồng Phong", () => ({ spd: 3 })],
  ["Kiên Cố", (u) => ({ def: r(u * 0.12) + 1 })],
  ["Hộ Pháp", (u) => ({ res: r(u * 0.12) + 1 })],
  ["Sinh Mệnh", (u) => ({ hp: r(u * 1.2) + 5 })],
  ["Linh Lực", (u) => ({ mp: r(u) + 5 })],
  ["Ảnh Tử", () => ({ eva: 1 })],
  ["Bá Vương", (u) => ({ atk: r(u * 0.1) + 1 })],
  ["Huyền Bí", (u) => ({ mag: r(u * 0.1) + 1 })],
  ["Bình Minh", (u) => ({ hp: r(u * 0.5) + 2, mp: r(u * 0.4) + 2 })],
];
/** Titles of the epic piece found every tenth floor. */
const EPIC = ["Cổ Thụ", "Cát Vàng", "Linh Hồn", "Tuyết Trắng", "Mộng Bào Tử", "Dung Nham", "Thủy Triều", "Gió Ngàn", "Tinh Tú", "Vực Sâu"];

function matName(k: Kind, t: number) {
  return { metal: METALS[t - 1].name, wood: WOOD_N[t - 1], cloth: CLOTH_N[t - 1], leather: LEATHER_N[t - 1], gem: GEM_N[t - 1] }[k.mat];
}
function palette(k: Kind, t: number, j: number, epic: boolean): Palette {
  const m = METALS[t - 1].col;
  const tone = (c: string) => shade(c, (j % 5 - 2) * 0.06);
  const acc = epic ? "#ffe14a" : GEM_C[t - 1];
  switch (k.mat) {
    case "metal": return [tone(m), k.slot === "armor" || k.slot === "legs" ? C.brown : "#7a5230", acc];
    case "wood": return [tone(WOOD_C[t - 1]), m, acc];
    case "cloth": return [tone(CLOTH_C[t - 1]), m, acc];
    case "leather": return [tone(LEATHER_C[t - 1]), m, acc];
    case "gem": return [tone(m), shade(GEM_C[t - 1], -0.1), acc];
  }
}
function addStats(a: StatMods, b: StatMods): StatMods {
  const out: StatMods = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof StatMods, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}
const STATION: Record<Mat, Station> = { metal: "forge", wood: "forge", gem: "forge", cloth: "tailor", leather: "tailor" };

// ------------------------------------------------------------ 100 pieces per kind
/** gear[floor] = every generated piece that belongs to that floor. */
export const GEAR_BY_FLOOR: ItemDef[][] = Array.from({ length: 101 }, () => []);

KINDS.forEach((k, ki) => {
  let prevT = 0, j = 0;
  for (let f = 1; f <= 100; f++) {
    const t = metalTierForFloor(f);
    j = t === prevT ? j + 1 : 0;
    prevT = t;
    const epic = f % 10 === 0;
    const rare = !epic && f >= 6 && f % 3 === 0;
    const rarity: Rarity = epic ? "epic" : rare ? "rare" : "common";
    const u = tierUnit(floorTier(f)) * (epic ? 1.15 : 1);
    const [affName, affStats] = AFFIX[(j + t * 3 + ki) % AFFIX.length];
    const stats = addStats(k.stats(u, t), affStats(u));
    const passive = epic || rare ? k.passives[(f + ki) % k.passives.length] : undefined;
    const name = epic ? `${k.name} ${EPIC[f / 10 - 1]}` : `${k.name} ${matName(k, t)} ${affName}`;
    const value = r(18 * Math.pow(floorTier(f), 1.6) * (k.vf ?? 1) * (epic ? 1.8 : rare ? 1.25 : 1));
    const id = `eq_${k.id}_${f}`;
    const it = I(id, name, "equip", value, "", k.id, palette(k, t, j, epic), {
      tier: t, icon: iconFor(k.slot), tags: ["gear", rarity],
      equip: { slot: k.slot, stats, passive, kind: k.id, hands: k.hands, floor: f, rarity },
    });
    GEAR_BY_FLOOR[f].push(it);
    if (f % 6 === 1) EQUIP_RECIPES.push({ station: STATION[k.mat], level: Math.ceil(t / 2), out: id, n: 1, cost: { ...k.cost(t), ...extra(t) } });
  }
});

/** A random generated piece for a depth (optionally nudged deeper, e.g. for bosses). */
export function gearForFloor(floor: number, pick: <T>(xs: T[]) => T, deeper = 0): ItemDef {
  const lo = Math.max(1, floor - 2 + deeper), hi = Math.min(100, floor + 1 + deeper);
  const pool: ItemDef[] = [];
  for (let f = lo; f <= hi; f++) pool.push(...GEAR_BY_FLOOR[f]);
  return pick(pool);
}

// ------------------------------------------------------------ old per-tier line (kept for saves, not dropped any more)
for (const k of KINDS) {
  if (!["sword", "axe", "spear", "bow", "dagger", "staff", "wand", "shield", "fist", "scythe", "tome", "robe", "leather", "mail", "plate", "ring", "amulet", "charm", "boots", "earring"].includes(k.id)) continue;
  for (const m of METALS) {
    const t = m.tier;
    I(`${k.id}_t${t}`, `${k.name} ${m.name}`, "equip", r(20 * Math.pow(t, 1.6) * (k.vf ?? 1)), "", k.id, palette(k, t, 2, false),
      { tier: t, icon: iconFor(k.slot), tags: ["old"], equip: { slot: k.slot, stats: k.stats(tierUnit(t), t), passive: t >= 4 ? k.passives[(t - 4) % k.passives.length] : undefined, kind: k.id, hands: k.hands, rarity: t >= 4 ? "rare" : "common" } });
  }
}

// ------------------------------------------------------------ legendary (boss drops)
type Leg = [id: string, name: string, kind: string, tier: number, passive: string, col: string, biome: string];
const legendary: Leg[] = [
  ["leg_treant_shield", "Lá Chắn Cổ Thụ Mẹ", "shield", 2, "p_regeneration", "#4f9a45", "forest"],
  ["leg_silver_bow", "Cung Lá Bạc", "bow", 2, "p_vanguard", "#dfe8ee", "forest"],
  ["leg_wyrm_fang", "Nanh Sa Trùng Vương", "dagger", 3, "p_bleed_master", "#c89040", "desert"],
  ["leg_storm_boots", "Hài Bão Cát", "boots", 3, "p_swift", "#e0c070", "desert"],
  ["leg_lantern_ring", "Nhẫn Đèn Ma", "ring", 4, "p_soul_siphon", "#ffb030", "swamp"],
  ["leg_frost_sword", "Hàn Băng Kiếm", "sword", 5, "p_frostbite", "#8ad8ff", "tundra"],
  ["leg_spore_staff", "Trượng Bào Tử Mộng", "staff", 5, "p_plague_master", "#c070e0", "fungal"],
  ["leg_volcano_axe", "Rìu Núi Lửa", "axe", 6, "p_burn_master", "#ff4a2a", "volcano"],
  ["leg_trident", "Đinh Ba Hải Vương", "spear", 7, "p_hydro", "#4aa6ff", "reef"],
  ["leg_wind_bow", "Cung Phong Linh", "bow", 7, "p_aero", "#9ef0c0", "bamboo"],
  ["leg_prism_tome", "Ma Thư Lăng Kính", "tome", 8, "p_elementalist", "#c8b8ff", "crystal"],
  ["leg_autumn_scythe", "Lưỡi Hái Thu Tàn", "scythe", 9, "p_bloodlust", "#e0602a", "autumn"],
  ["leg_emperor_shield", "Khiên Đế Vương Cổ", "shield", 9, "p_steadfast", "#d8c070", "ruins"],
  ["leg_petal_dagger", "Đoản Đao Hoa Rơi", "dagger", 10, "p_exploit", "#ffb0d0", "sakura"],
  ["leg_necro_staff", "Trượng Tử Linh", "staff", 11, "p_shadow", "#5a2a8a", "bonewaste"],
  ["leg_tiger_fist", "Găng Mãnh Hổ", "fist", 11, "p_berserker_blood", "#e0b040", "jungle"],
  ["leg_eternal_plate", "Giáp Vĩnh Băng", "plate", 12, "p_cryo", "#e8ffff", "glacier"],
];
export const LEGENDARY_BY_BIOME: Record<string, string[]> = {};
for (const [id, name, kind, t, passive, col, biome] of legendary) {
  const k = KIND_BY_ID[kind];
  const base = k.stats(tierUnit(t) * 1.25, t);
  I(id, name, "equip", r(60 * Math.pow(t, 1.7)), "Trang bị huyền thoại rơi từ Boss Canh Cửa.", kind, [col, "#2a1a2a", "#ffe14a"],
    { tier: t, equip: { slot: k.slot, stats: base, passive, kind, hands: k.hands, rarity: "legendary" }, icon: "🌟", tags: ["legendary"] });
  (LEGENDARY_BY_BIOME[biome] ??= []).push(id);
}

// ------------------------------------------------------------ floor relics (one unique piece per floor)
export const RELIC_KINDS = KINDS.map((k) => k.id);
/** A one-of-a-kind item that only the gatekeeper of floor `floor` carries. */
export function registerRelic(id: string, name: string, kind: string, floor: number, passive: string | undefined, col: string, desc: string): ItemDef {
  const k = KIND_BY_ID[kind] ?? KIND_BY_ID.ring;
  const t = metalTierForFloor(floor);
  return I(id, name, "equip", r(80 * Math.pow(floorTier(floor), 1.7)), desc, k.id, [col, shade(col, -0.45), "#ffe14a"], {
    tier: t, icon: "🏺", tags: ["legendary", "relic"],
    equip: { slot: k.slot, stats: k.stats(tierUnit(floorTier(floor)) * 1.3, t), passive: passive ?? k.passives[floor % k.passives.length], kind: k.id, hands: k.hands, floor, rarity: "legendary" },
  });
}
