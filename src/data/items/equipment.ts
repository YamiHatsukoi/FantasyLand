import type { StatMods } from "../../combat/types";
import type { Palette } from "../../render/icons";
import { C, I, type EquipSlot } from "./core";
import { BIOME_MATS, METALS } from "./materials";
import type { RecipeSeed } from "./consumables";

export const EQUIP_RECIPES: RecipeSeed[] = [];

// ------------------------------------------------------------ legacy equipment (ids stable)
type L = [id: string, name: string, shape: string, slot: EquipSlot, value: number, stats: StatMods, passive?: string, col?: string];
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
for (const [id, name, shape, slot, value, stats, passive, col] of legacy) {
  I(id, name, "equip", value, "", shape, [col ?? "#9aa4b0", C.brown, "#ffd040"], { equip: { slot, stats, passive, kind: shape }, icon: "⚔️" });
}

// ------------------------------------------------------------ generated tiers
interface Kind {
  id: string;
  name: string;
  slot: EquipSlot;
  stats: (u: number, t: number) => StatMods; // u = tier power unit
  cost: (t: number) => Record<string, number>;
  passives: string[]; // passives granted from tier 4 upward (cycled)
}

// Secondary crafting materials come from the biome whose depth matches the tier.
const BIOME_BY_TIER = ["forest", "desert", "swamp", "tundra", "fungal", "volcano", "reef", "bamboo", "crystal", "autumn", "sakura", "glacier"];
const bm = (t: number) => BIOME_MATS[BIOME_BY_TIER[t - 1]];
const ing = (t: number) => METALS[t - 1].ingot;
const extra = (t: number): Record<string, number> => (t >= 5 ? { mana_crystal: t - 4 } : {}) as Record<string, number>;
const r = Math.round;

const KINDS: Kind[] = [
  { id: "sword", name: "Trường Kiếm", slot: "weapon", stats: (u, t) => ({ atk: r(u), crit: 3 + (t >> 1) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).leather]: 1 }), passives: ["p_might", "p_serrated", "p_vengeance", "p_executioner", "p_momentum", "p_last_breath", "p_exploit", "p_bloodlust", "p_berserker_blood"] },
  { id: "axe", name: "Chiến Phủ", slot: "weapon", stats: (u) => ({ atk: r(u * 1.2), spd: -3 }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 2 }), passives: ["p_bloodlust", "p_executioner", "p_berserker_blood", "p_vengeance", "p_serrated", "p_might", "p_momentum", "p_last_breath", "p_exploit"] },
  { id: "spear", name: "Thương", slot: "weapon", stats: (u, t) => ({ atk: r(u * 1.05), def: r(u * 0.2), spd: 1 + (t >> 2) }), cost: (t) => ({ [ing(t)]: 2, [bm(t).plank]: 2 }), passives: ["p_vanguard", "p_momentum", "p_might", "p_thick_hide", "p_serrated", "p_swift", "p_last_breath", "p_executioner", "p_vengeance"] },
  { id: "bow", name: "Trường Cung", slot: "weapon", stats: (u, t) => ({ atk: r(u * 0.95), crit: 6 + (t >> 1), spd: 2 }), cost: (t) => ({ [bm(t).plank]: 3, [bm(t).cloth]: 1, [ing(t)]: 1 }), passives: ["p_keen", "p_vanguard", "p_venomous", "p_exploit", "p_swift", "p_arsonist", "p_conductor", "p_momentum", "p_lucky"] },
  { id: "dagger", name: "Đoản Đao", slot: "weapon", stats: (u, t) => ({ atk: r(u * 0.8), crit: 10 + t, eva: 4 }), cost: (t) => ({ [ing(t)]: 2, [bm(t).leather]: 1 }), passives: ["p_nimble", "p_venomous", "p_serrated", "p_exploit", "p_ambusher", "p_bleed_master", "p_lucky", "p_plague_master", "p_executioner"] },
  { id: "staff", name: "Pháp Trượng", slot: "weapon", stats: (u) => ({ mag: r(u * 1.1), mp: r(u * 2) }), cost: (t) => ({ [bm(t).plank]: 3, [bm(t).gem]: 1 }), passives: ["p_wisdom", "p_mana_well", "p_pyro", "p_cryo", "p_storm", "p_catalyst", "p_meditative", "p_elementalist", "p_burn_master"] },
  { id: "wand", name: "Đũa Phép", slot: "weapon", stats: (u, t) => ({ mag: r(u * 0.95), crit: 6 + (t >> 1), spd: 3 }), cost: (t) => ({ [bm(t).plank]: 1, [bm(t).gem]: 1, [bm(t).extract]: 1 }), passives: ["p_conductor", "p_soaker", "p_wisdom", "p_arsonist", "p_catalyst", "p_hydro", "p_aero", "p_shadow", "p_holy"] },
  { id: "shield", name: "Khiên", slot: "weapon", stats: (u) => ({ def: r(u), hp: r(u * 4), res: r(u * 0.3) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 1, [bm(t).leather]: 1 }), passives: ["p_iron_skin", "p_thick_hide", "p_prickly", "p_steadfast", "p_colossus", "p_warded", "p_last_breath", "p_vigor", "p_spirit"] },
  { id: "fist", name: "Thiết Thủ", slot: "weapon", stats: (u, t) => ({ atk: r(u * 0.85), spd: 4 + (t >> 2), crit: 4 }), cost: (t) => ({ [ing(t)]: 1, [bm(t).leather]: 2 }), passives: ["p_swift", "p_vengeance", "p_regeneration", "p_momentum", "p_berserker_blood", "p_meditative", "p_bloodlust", "p_lucky", "p_last_breath"] },
  { id: "scythe", name: "Lưỡi Hái", slot: "weapon", stats: (u) => ({ atk: r(u * 1.1), mag: r(u * 0.4) }), cost: (t) => ({ [ing(t)]: 3, [bm(t).plank]: 2 }), passives: ["p_shadow", "p_bloodlust", "p_soul_siphon", "p_bleed_master", "p_executioner", "p_plague_master", "p_toxic", "p_exploit", "p_berserker_blood"] },
  { id: "tome", name: "Ma Thư", slot: "weapon", stats: (u) => ({ mag: r(u), res: r(u * 0.3), mp: r(u * 1.5) }), cost: (t) => ({ [bm(t).cloth]: 2, [bm(t).leather]: 1, [bm(t).gem]: 1, paper: 2 }), passives: ["p_healer", "p_wisdom", "p_holy", "p_pure_soul", "p_meditative", "p_hydro", "p_catalyst", "p_elementalist", "p_mana_well"] },
  { id: "robe", name: "Pháp Bào", slot: "armor", stats: (u) => ({ res: r(u * 0.8), mp: r(u * 3), mag: r(u * 0.2) }), cost: (t) => ({ [bm(t).cloth]: 4, [bm(t).extract]: 1 }), passives: ["p_mana_well", "p_spirit", "p_meditative", "p_pure_soul", "p_wisdom", "p_warded", "p_healer", "p_catalyst", "p_steadfast"] },
  { id: "leather", name: "Giáp Da", slot: "armor", stats: (u, t) => ({ def: r(u * 0.6), hp: r(u * 3), eva: 4 + (t >> 2) }), cost: (t) => ({ [bm(t).leather]: 4, [bm(t).cloth]: 1 }), passives: ["p_nimble", "p_swift", "p_ambusher", "p_lucky", "p_vigor", "p_regeneration", "p_vanguard", "p_thick_hide", "p_momentum"] },
  { id: "mail", name: "Giáp Xích", slot: "armor", stats: (u) => ({ def: r(u * 0.8), res: r(u * 0.4), hp: r(u * 5) }), cost: (t) => ({ [ing(t)]: 4, [bm(t).leather]: 1 }), passives: ["p_iron_skin", "p_spirit", "p_vigor", "p_thick_hide", "p_prickly", "p_steadfast", "p_regeneration", "p_last_breath", "p_warded"] },
  { id: "plate", name: "Trọng Giáp", slot: "armor", stats: (u) => ({ def: r(u * 1.1), hp: r(u * 8), spd: -4 }), cost: (t) => ({ [ing(t)]: 6, [bm(t).cloth]: 1 }), passives: ["p_iron_skin", "p_colossus", "p_thick_hide", "p_steadfast", "p_prickly", "p_last_breath", "p_vigor", "p_warded", "p_vengeance"] },
  { id: "ring", name: "Nhẫn", slot: "accessory", stats: (u, t) => ({ atk: r(u * 0.3), mag: r(u * 0.3), crit: 4 + (t >> 2) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 1 }), passives: ["p_lucky", "p_keen", "p_might", "p_wisdom", "p_exploit", "p_catalyst", "p_executioner", "p_elementalist", "p_bloodlust"] },
  { id: "amulet", name: "Dây Chuyền", slot: "accessory", stats: (u) => ({ res: r(u * 0.5), mp: r(u * 3), mag: r(u * 0.3) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 2 }), passives: ["p_pure_soul", "p_mana_well", "p_spirit", "p_healer", "p_holy", "p_meditative", "p_steadfast", "p_warded", "p_soul_siphon"] },
  { id: "charm", name: "Bùa Hộ Mệnh", slot: "accessory", stats: (u) => ({ hp: r(u * 5), def: r(u * 0.3) }), cost: (t) => ({ [bm(t).leather]: 1, [bm(t).gem]: 1, [bm(t).extract]: 1 }), passives: ["p_regeneration", "p_vigor", "p_warded", "p_prickly", "p_steadfast", "p_thick_hide", "p_colossus", "p_last_breath", "p_pure_soul"] },
  { id: "boots", name: "Hài", slot: "accessory", stats: (u, t) => ({ spd: 3 + t, eva: 3 + (t >> 1), def: r(u * 0.2) }), cost: (t) => ({ [bm(t).leather]: 3, [ing(t)]: 1 }), passives: ["p_swift", "p_nimble", "p_vanguard", "p_momentum", "p_ambusher", "p_lucky", "p_aero", "p_lucky", "p_vanguard"] },
  { id: "earring", name: "Hoa Tai", slot: "accessory", stats: (u, t) => ({ mag: r(u * 0.4), crit: 3 + (t >> 2), res: r(u * 0.3) }), cost: (t) => ({ [ing(t)]: 1, [bm(t).gem]: 1 }), passives: ["p_wisdom", "p_conductor", "p_soaker", "p_arsonist", "p_frostbite", "p_catalyst", "p_elementalist", "p_shadow", "p_holy"] },
];

export const EQUIP_KINDS = KINDS.map((k) => k.id);

/** Power unit for a tier: tier 1 ≈ 5, tier 12 ≈ 100. */
export const tierUnit = (t: number) => 5 + 8.6 * (t - 1);

for (const k of KINDS) {
  for (const m of METALS) {
    const t = m.tier;
    const id = `${k.id}_t${t}`;
    const stats = k.stats(tierUnit(t), t);
    const passive = t >= 4 ? k.passives[(t - 4) % k.passives.length] : undefined;
    const woodish = ["bow", "staff", "wand", "tome", "robe", "leather", "charm"].includes(k.id);
    const pal: Palette = woodish ? [BIOME_COLOR(k.id, t), m.col, gemColor(t)] : [m.col, k.slot === "armor" ? C.brown : "#7a5230", gemColor(t)];
    I(id, `${k.name} ${m.name}`, "equip", Math.round(20 * Math.pow(t, 1.6) * (k.slot === "accessory" ? 0.9 : 1)), "", k.id, pal,
      { tier: t, equip: { slot: k.slot, stats, passive, kind: k.id }, icon: k.slot === "weapon" ? "⚔️" : k.slot === "armor" ? "🦺" : "💍" });
    EQUIP_RECIPES.push({ station: ["robe", "leather", "tome"].includes(k.id) ? "tailor" : "forge", level: Math.ceil(t / 2), out: id, n: 1, cost: { ...k.cost(t), ...extra(t) } });
  }
}

function gemColor(t: number) {
  return ["#3ad86a", "#f0a030", "#3a3a4a", "#8ad8ff", "#b04ae0", "#ff3a4a", "#5ae0f0", "#4ad890", "#a060f0", "#e8904a", "#ff80b0", "#e8ffff"][t - 1];
}
function BIOME_COLOR(kind: string, t: number) {
  const woodCols = ["#8a5a2a", "#c89a5a", "#4a3a2a", "#6a5a4a", "#d8c8e0", "#3a2a2a", "#b0a080", "#8aca5a", "#a0c8ff", "#a03a2a", "#8a4a3a", "#a0c0d8"];
  const clothCols = ["#7aa84a", "#d8b87a", "#8a9a5a", "#e8e0d0", "#f0e8f0", "#b0a090", "#4a8a6a", "#c8d890", "#f0f0ff", "#b8a060", "#ffd8e8", "#f8f8ff"];
  return ["robe", "leather", "tome", "charm"].includes(kind) ? clothCols[t - 1] : woodCols[t - 1];
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
  const k = KINDS.find((x) => x.id === kind)!;
  const base = k.stats(tierUnit(t) * 1.25, t);
  I(id, name, "equip", Math.round(60 * Math.pow(t, 1.7)), "Trang bị huyền thoại rơi từ Boss Canh Cửa.", kind, [col, "#2a1a2a", "#ffe14a"],
    { tier: t, equip: { slot: k.slot, stats: base, passive, kind }, icon: "🌟", tags: ["legendary"] });
  (LEGENDARY_BY_BIOME[biome] ??= []).push(id);
}
