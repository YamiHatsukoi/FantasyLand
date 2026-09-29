import type { Eff, StatMods, StatusId } from "../../combat/types";
import { C, I, ITEM_LIST, type ItemUse, type MealBuff } from "./core";
import type { Station } from "./recipeTypes";

export interface RecipeSeed {
  station: Station;
  level: number;
  out: string;
  n: number;
  cost: Record<string, number>;
}
/** Recipes declared next to the items they create; collected by data/recipes.ts. */
export const CONSUMABLE_RECIPES: RecipeSeed[] = [];
const R = (station: Station, level: number, out: string, cost: Record<string, number>, n = 1) => CONSUMABLE_RECIPES.push({ station, level, out, n, cost });

// ------------------------------------------------------------ helpers
const heal1 = (p: number, extra: Partial<ItemUse> = {}): ItemUse => ({ target: "ally", healPct: p, field: true, ...extra });
const healAll = (p: number, extra: Partial<ItemUse> = {}): ItemUse => ({ target: "allies", healPct: p, field: true, ...extra });
const mp1 = (p: number, extra: Partial<ItemUse> = {}): ItemUse => ({ target: "ally", mpPct: p, field: true, ...extra });
const buff = (s: StatusId, t = 3, extra: Partial<Eff> = {}): Eff => ({ s, t, ...extra });
const meal = (name: string, mods: StatMods): MealBuff => ({ name, mods });

// Raw herbs (from biome gathering and herb crops) can be chewed for a small heal.
export function applyHerbUses() {
  for (const it of ITEM_LIST) {
    if (it.type !== "herb" || it.use) continue;
    it.use = { target: "ally", healPct: 0.08 + 0.015 * (it.tier ?? 1), field: true };
    it.desc += ` Dùng: hồi ${Math.round((0.08 + 0.015 * (it.tier ?? 1)) * 100)}% máu.`;
  }
}

// ------------------------------------------------------------ potions (alchemy)
type P = [id: string, name: string, shape: string, col: string, value: number, desc: string, use: ItemUse, level: number, cost: Record<string, number>, n?: number];
const potions: P[] = [
  ["potion_hp", "Thuốc Hồi Máu", "potion", "#e84a4a", 15, "Hồi 50% máu cho 1 đồng đội.", heal1(0.5), 1, { herb: 2, slime_gel: 1 }],
  ["potion_mp", "Thuốc Ma Lực", "potion", "#4a8ae8", 20, "Hồi 50% MP cho 1 đồng đội.", mp1(0.5), 1, { mushroom_cap: 2, silver_herb: 1 }],
  ["antidote", "Thuốc Giải", "vial", "#8be04e", 12, "Xoá mọi hiệu ứng bất lợi của 1 đồng đội.", { target: "ally", cleanse: true }, 1, { herb: 1, silver_herb: 1 }],
  ["herbal_salve", "Cao Thảo Dược", "jar", "#6ab04a", 14, "Hồi 30% máu và Tái sinh 3 lượt.", heal1(0.3, { fx: [buff("regen", 3, { p: 0.2 })] }), 1, { herb: 3 }],
  ["potion_hp2", "Thuốc Hồi Máu Lớn", "potion", "#ff3a5a", 35, "Hồi 75% máu cho 1 đồng đội.", heal1(0.75), 2, { extract_forest: 1, silver_herb: 1, slime_gel: 1 }],
  ["potion_mp2", "Thuốc Ma Lực Lớn", "potion", "#3a6aff", 40, "Hồi 75% MP cho 1 đồng đội.", mp1(0.75), 2, { extract_desert: 1, spirit_mushroom: 1 }],
  ["phoenix_down", "Lông Phượng Hoàng", "feather", "#ff9a3a", 60, "Hồi sinh 1 đồng đội với 40% máu.", { target: "deadAlly", revivePct: 0.4, field: true }, 2, { amber: 2, mana_crystal: 1, silver_herb: 1 }],
  ["group_potion", "Thuốc Hồi Máu Nhóm", "flask", "#ff6a7a", 50, "Hồi 35% máu cho cả đội.", healAll(0.35), 2, { potion_hp: 2, extract_forest: 1 }],
  ["cure_all", "Linh Dược Thanh Tẩy", "flask", "#c8ff8a", 45, "Cả đội được thanh tẩy mọi hiệu ứng bất lợi.", { target: "allies", cleanse: true }, 2, { antidote: 2, glowmoss: 1 }],
  ["elixir", "Tiên Dược", "flask", "#f0d040", 150, "Hồi toàn bộ máu và MP cho cả đội.", healAll(1, { mpPct: 1 }), 3, { star_pumpkin: 1, ghost_lotus: 1, mana_crystal: 2 }],
  ["potion_hp3", "Đại Hồi Phục Dược", "potion", "#ff1a4a", 80, "Hồi 100% máu cho 1 đồng đội.", heal1(1), 3, { extract_swamp: 1, blood_beet: 1, monster_blood: 1 }],
  ["potion_mp3", "Đại Ma Lực Dược", "potion", "#1a4aff", 90, "Hồi 100% MP cho 1 đồng đội.", mp1(1), 3, { extract_tundra: 1, ectoplasm: 1 }],
  ["group_ether", "Hương Ma Lực Nhóm", "flask", "#6a8aff", 90, "Hồi 40% MP cho cả đội.", { target: "allies", mpPct: 0.4, field: true }, 3, { potion_mp2: 2, dream_lavender: 1 }],
  ["group_potion2", "Đại Dược Nhóm", "flask", "#ff3a6a", 120, "Hồi 65% máu cho cả đội.", healAll(0.65), 3, { group_potion: 2, extract_fungal: 1 }],
  ["phoenix_gold", "Lông Phượng Vàng", "feather", "#ffd040", 180, "Hồi sinh 1 đồng đội với 100% máu.", { target: "deadAlly", revivePct: 1, field: true }, 4, { phoenix_down: 2, ember_heart: 1 }],
  ["grand_elixir", "Đại Tiên Dược", "flask", "#fff0a0", 400, "Hồi toàn bộ máu, MP cho cả đội và Tái sinh.", healAll(1, { mpPct: 1, fx: [buff("regen", 3, { p: 0.4 })] }), 4, { elixir: 1, royal_jelly: 1, essence_light: 1 }],
  ["potion_hp4", "Thuốc Hồi Máu Tối Thượng", "potion", "#ff0a3a", 160, "Hồi 100% máu và Khiên cho 1 đồng đội.", heal1(1, { fx: [buff("shield", 3, { p: 2 })] }), 4, { potion_hp3: 1, essence_light: 1 }],
];
for (const [id, name, shape, col, value, desc, use, level, cost, n] of potions) {
  I(id, name, "potion", value, desc, shape, [col, C.glass, "#ffffff"], { use, icon: "🧪" });
  R("alchemy", level, id, cost, n);
}

// ------------------------------------------------------------ tonics (single-target buffs)
const tonics: [StatusId, string, string, number, number, Record<string, number>][] = [
  ["atkUp", "Thuốc Cuồng Lực", "#e8603a", 30, 2, { extract_desert: 1, dragon_pepper: 1 }],
  ["magUp", "Thuốc Minh Tâm", "#8a6aff", 30, 2, { extract_forest: 1, spirit_sage: 1 }],
  ["defUp", "Thuốc Kiên Cố", "#8a8f96", 30, 2, { extract_swamp: 1, shell_fragment: 1 }],
  ["haste", "Thuốc Thần Tốc", "#9ef0c0", 35, 2, { wind_mint: 2, feather: 1 }],
  ["focus", "Thuốc Ưng Nhãn", "#f0e04a", 35, 2, { monster_eye: 1, extract_forest: 1 }],
  ["evade", "Thuốc Thân Pháp", "#a0f0e0", 35, 2, { feather: 1, wind_mint: 1 }],
  ["regen", "Thuốc Tái Sinh", "#6ad86a", 40, 2, { herbal_salve: 1, silver_herb: 1 }],
  ["manaRegen", "Thuốc Linh Lưu", "#4ab0ff", 40, 3, { extract_tundra: 1, mana_crystal: 1 }],
  ["barrier", "Thuốc Kết Giới", "#6a8aff", 45, 3, { extract_fungal: 1, glass: 1 }],
  ["immune", "Thuốc Thánh Hộ", "#fff3a8", 60, 3, { essence_light: 1, silver_herb: 1 }],
  ["empower", "Thuốc Tích Lực", "#ffd040", 50, 3, { monster_blood: 1, extract_desert: 1 }],
  ["lifesteal", "Thuốc Huyết Tộc", "#c02a3a", 50, 3, { monster_blood: 1, blood_beet: 1 }],
  ["thorns", "Thuốc Gai Phản", "#6aa04a", 40, 3, { cactus_fruit: 2, venom_sac: 1 }],
  ["shield", "Thuốc Khiên Ma", "#5ab0ff", 45, 3, { mana_crystal: 1, slime_gel: 2 }],
  ["counter", "Thuốc Phản Kích", "#d8a040", 50, 3, { tusk: 1, extract_desert: 1 }],
  ["berserk", "Thuốc Cuồng Nộ", "#ff3a2a", 55, 4, { ember_heart: 1, dragon_pepper: 2 }],
  ["reflect", "Thuốc Gương Phép", "#e0e8ff", 60, 4, { glass: 2, essence_arcane: 1 }],
  ["stealth", "Thuốc Tàng Hình", "#5a5a7a", 55, 4, { ectoplasm: 1, essence_dark: 1 }],
];
for (const [s, name, col, value, level, cost] of tonics) {
  const id = `tonic_${s}`;
  const fx: Eff[] = [buff(s, 3, s === "shield" ? { p: 1.5 } : s === "regen" ? { p: 0.35 } : {})];
  I(id, name, "potion", value, `Ban hiệu ứng ${name.replace("Thuốc ", "")} (3 lượt) cho 1 đồng đội.`, "vial", [col, C.glass, "#ffffff"], { use: { target: "ally", fx }, icon: "🧪" });
  R("alchemy", level, id, cost, 2);
}

// ------------------------------------------------------------ weapon oils (imbues)
const oils: [string, StatusId, string, string][] = [
  ["fire", "imbueFire", "Dầu Tẩm Lửa", "#ff6a2a"], ["ice", "imbueIce", "Dầu Tẩm Băng", "#8ad8ff"],
  ["lightning", "imbueLightning", "Dầu Tẩm Sét", "#ffe14a"], ["water", "imbueWater", "Dầu Tẩm Nước", "#4aa6ff"],
  ["earth", "imbueEarth", "Dầu Tẩm Đất", "#c49a6c"], ["wind", "imbueWind", "Dầu Tẩm Gió", "#9ef0c0"],
  ["light", "imbueLight", "Dầu Thánh Quang", "#fff3a8"], ["dark", "imbueDark", "Dầu Bóng Tối", "#8a5ad8"],
  ["poison", "imbuePoison", "Dầu Tẩm Độc", "#8be04e"],
];
for (const [el, s, name, col] of oils) {
  const id = `oil_${el}`;
  I(id, name, "potion", 45, `Tẩm vũ khí 1 đồng đội: đòn vật lý mang hệ nguyên tố trong 4 lượt, kích hoạt phản ứng nguyên tố.`, "bottle", [col, C.brown, "#ffffff"], { use: { target: "ally", fx: [buff(s, 4)] }, icon: "🛢️" });
  R("alchemy", 2, id, { [`essence_${el}`]: 1, resin: 1 }, 2);
}

// ------------------------------------------------------------ bombs & throwables
type B = [id: string, name: string, shape: string, col: string, value: number, desc: string, use: ItemUse, level: number, cost: Record<string, number>, n?: number];
const E = (fx: Eff[], dmg?: ItemUse["dmg"]): ItemUse => ({ target: "enemies", fx, dmg });
const bombs: B[] = [
  ["water_flask", "Bình Nước Thánh", "flask", "#4aa6ff", 14, "Tạt nước lên kẻ địch: tất cả Ướt sũng.", E([{ s: "wet", t: 2 }]), 1, { slime_gel: 1, herb: 1 }, 2],
  ["oil_flask", "Bình Dầu Cháy", "flask", "#8a5a2a", 14, "Ném vào kẻ địch: tất cả Dính dầu. Lửa sẽ gây Nổ Dầu!", E([{ s: "oil", t: 3 }]), 2, { cactus_fruit: 1, slime_gel: 1 }, 2],
  ["smoke_flask", "Bình Khói Mù", "flask", "#8a8a9a", 16, "Làm Mù mọi kẻ địch.", E([{ s: "blind", ch: 0.85, t: 2 }]), 2, { sandstone: 1, bone: 1 }, 2],
  ["fire_bomb", "Bom Lửa", "bomb", "#ff5a2a", 25, "Sát thương lửa và Thiêu đốt lên mọi kẻ địch.", E([{ s: "burn", t: 3, st: 2 }], { el: "fire", base: 16 }), 2, { peat: 1, herb_desert: 1 }, 2],
  ["poison_bomb", "Bom Độc", "bomb", "#8be04e", 25, "Gây 3 tầng Trúng độc lên mọi kẻ địch.", E([{ s: "poison", t: 3, st: 3 }], { el: "poison", base: 8 }), 2, { venom_sac: 1, spore_dust: 1 }, 2],
  ["sleep_powder", "Bột Ngủ Say", "dust", "#b08aff", 30, "60% khiến kẻ địch Ngủ.", E([{ s: "sleep", ch: 0.6, t: 2 }]), 2, { spore_dust: 2, dream_lavender: 1 }, 2],
  ["net_trap", "Lưới Trói", "silk", "#e8e0c8", 22, "Trói chặt mọi kẻ địch.", E([{ s: "rooted", ch: 0.9, t: 2 }, { s: "slow", ch: 0.5, t: 2 }]), 2, { spider_silk: 2, rope: 1 }, 2],
  ["frost_bomb", "Bom Băng", "bomb", "#8ad8ff", 30, "Sát thương băng và 2 tầng Tê cóng lên mọi kẻ địch.", E([{ s: "chill", t: 3, st: 2 }], { el: "ice", base: 18 }), 3, { glowmoss: 1, mana_crystal: 1 }, 2],
  ["thunder_bomb", "Bom Sấm", "bomb", "#ffe14a", 30, "Sát thương sét và Nhiễm điện lên mọi kẻ địch.", E([{ s: "shock", t: 3, st: 2 }], { el: "lightning", base: 18 }), 3, { bog_iron: 1, mana_crystal: 1 }, 2],
  ["rock_bomb", "Bom Đá Vụn", "bomb", "#c49a6c", 28, "Sát thương đất và Phá giáp mọi kẻ địch.", E([{ s: "armorBreak", ch: 0.8, t: 2 }], { el: "earth", base: 18 }), 3, { block_forest: 1, peat: 1 }, 2],
  ["gale_bomb", "Bom Gió Lốc", "bomb", "#9ef0c0", 28, "Sát thương gió và Chậm chạp mọi kẻ địch.", E([{ s: "slow", ch: 0.8, t: 2 }], { el: "wind", base: 18 }), 3, { feather: 2, wind_mint: 1 }, 2],
  ["holy_bomb", "Bom Thánh Quang", "bomb", "#fff3a8", 35, "Sát thương ánh sáng (x2 lên undead) và Mù.", E([{ s: "blind", ch: 0.5, t: 2 }], { el: "light", base: 22 }), 3, { essence_light: 1, glass: 1 }, 2],
  ["dark_bomb", "Bom Hắc Ám", "bomb", "#8a5ad8", 35, "Sát thương bóng tối và Nguyền rủa.", E([{ s: "curse", t: 3 }], { el: "dark", base: 22 }), 3, { essence_dark: 1, soul_wax: 1 }, 2],
  ["acid_flask", "Bình Axit", "flask", "#c8ff4a", 32, "Phá giáp và phá kháng mọi kẻ địch.", E([{ s: "armorBreak", t: 2 }, { s: "resBreak", t: 2 }]), 3, { venom_sac: 2, glass: 1 }, 2],
  ["stun_bomb", "Bom Choáng", "bomb", "#ffffff", 40, "50% khiến kẻ địch Choáng.", E([{ s: "stun", ch: 0.5, t: 1 }], { el: "physical", base: 10 }), 3, { storm_heart: 1, peat: 2 }, 3],
  ["great_fire_bomb", "Đại Bom Lửa", "bomb", "#ff2a0a", 80, "Sát thương lửa cực mạnh và 3 tầng Thiêu đốt.", E([{ s: "burn", t: 3, st: 3 }], { el: "fire", base: 45 }), 4, { fire_bomb: 2, ember_heart: 1 }, 2],
  ["great_frost_bomb", "Đại Bom Băng", "bomb", "#4ad8ff", 80, "Sát thương băng cực mạnh, 3 tầng Tê cóng (đóng băng).", E([{ s: "chill", t: 3, st: 3 }], { el: "ice", base: 45 }), 4, { frost_bomb: 2, frost_heart: 1 }, 2],
  ["great_thunder_bomb", "Đại Bom Sấm", "bomb", "#ffd000", 80, "Sát thương sét cực mạnh, 3 tầng Nhiễm điện (tê liệt).", E([{ s: "shock", t: 3, st: 3 }], { el: "lightning", base: 45 }), 4, { thunder_bomb: 2, storm_heart: 1 }, 2],
  ["arcane_bomb", "Bom Huyền Bí", "bomb", "#ff8cf0", 90, "Sát thương huyền bí lớn, xoá hiệu ứng có lợi của địch.", E([{ s: "vulnerable", t: 2 }], { el: "arcane", base: 50 }), 4, { essence_arcane: 2, gears: 1 }, 2],
];
for (const [id, name, shape, col, value, desc, use, level, cost, n] of bombs) {
  I(id, name, "bomb", value, desc, shape, [col, C.black, "#ff9a3a"], { use, icon: "💣" });
  R("alchemy", level, id, cost, n);
}

// ------------------------------------------------------------ scrolls (library)
const scrolls: [string, string, string, number, string, ItemUse, number, Record<string, number>][] = [
  ["scroll_return", "Cuộn Hồi Thành", "#6ab0ff", 40, "Dịch chuyển cả đội về Thánh Địa, giữ nguyên toàn bộ chiến lợi phẩm.", { target: "none", field: true, battle: false, special: "returnHome" }, 1, { paper: 1, ink: 1 }],
  ["scroll_map", "Cuộn Bản Đồ", "#e8c070", 30, "Hiện toàn bộ bản đồ tầng hiện tại.", { target: "none", field: true, battle: false, special: "revealMap" }, 1, { paper: 2, ink: 1 }],
  ["scroll_repel", "Nhang Xua Quái", "#c8a0ff", 25, "Quái vật không đuổi theo bạn trong 80 bước.", { target: "none", field: true, battle: false, special: "repel" }, 2, { paper: 1, dream_lavender: 1 }],
  ["scroll_lure", "Mồi Nhử Quái", "#ff6a6a", 20, "Mọi quái vật gần đó lao về phía bạn (để cày kinh nghiệm).", { target: "none", field: true, battle: false, special: "lure" }, 2, { meat_beast: 1, paper: 1 }],
];
for (const [id, name, col, value, desc, use, level, cost] of scrolls) {
  I(id, name, "scroll", value, desc, "scroll", [col, "#8a6a3a", col], { use, icon: "📜" });
  R("library", level, id, cost, 2);
}

// ------------------------------------------------------------ food (kitchen)
type F = [id: string, name: string, shape: string, col: string, value: number, desc: string, use: ItemUse, level: number, cost: Record<string, number>, meal?: MealBuff];
const foods: F[] = [
  ["bread", "Bánh Mì Nướng", "bread", "#d89a4a", 12, "Hồi 35% máu cho 1 đồng đội.", heal1(0.35), 1, { wheat: 2 }],
  ["stew", "Súp Rau Củ", "bowl", "#c8703a", 20, "Hồi 25% máu cho cả đội.", healAll(0.25), 1, { moon_radish: 1, wheat: 1, herb: 1 }],
  ["berry_jam", "Mứt Dâu Lửa", "jar", "#e8402a", 22, "Hồi 15% máu, nhận Cuồng lực và Minh tâm 3 lượt.", heal1(0.15, { field: false, fx: [buff("atkUp"), buff("magUp")] }), 1, { fire_berry: 2 }],
  ["mushroom_soup", "Súp Nấm Tinh Linh", "bowl", "#b88aff", 26, "Hồi 40% MP cho 1 đồng đội.", mp1(0.4), 1, { spirit_mushroom: 1, moon_radish: 1 }],
  ["rice_ball", "Cơm Nắm", "bread", "#f4f0e0", 14, "Hồi 30% máu.", heal1(0.3), 1, { rice: 2 }],
  ["fried_egg", "Trứng Ốp La", "egg", "#f8d040", 12, "Hồi 25% máu.", heal1(0.25), 1, { egg: 1 }],
  ["omelette", "Trứng Chiên Rau", "egg", "#f0c040", 22, "Hồi 20% máu cả đội.", healAll(0.2), 1, { egg: 2, cloud_cabbage: 1 }],
  ["grilled_meat", "Thịt Nướng Than", "meat", "#a04a2a", 18, "Hồi 40% máu. Bữa ăn: +6% công.", heal1(0.4), 1, { meat_beast: 1 }, meal("Thịt Nướng Than", { atk: 0.06 })],
  ["grilled_fish", "Cá Nướng Lá", "fish", "#d8903a", 16, "Hồi 35% máu.", heal1(0.35), 1, { carp: 1 }],
  ["cloud_salad", "Salad Cải Mây", "leafy", "#8ae0a0", 18, "Hồi 20% máu và Tái sinh.", heal1(0.2, { fx: [buff("regen", 3, { p: 0.25 })] }), 1, { cloud_cabbage: 1, jade_pea: 1 }],
  ["baked_potato", "Khoai Nướng Thánh", "root", "#c89a50", 16, "Hồi 30% máu. Bữa ăn: +8% máu tối đa.", heal1(0.3), 1, { holy_potato: 1 }, meal("Khoai Nướng Thánh", { hp: 0.08 })],
  ["tomato_soup", "Súp Cà Chua", "bowl", "#e84a2a", 22, "Hồi 20% máu cả đội.", healAll(0.2), 1, { sun_tomato: 2 }],
  ["carrot_juice", "Nước Ép Cà Rốt", "cup", "#ff8a2a", 16, "Hồi 25% MP.", mp1(0.25), 1, { ember_carrot: 2 }],
  ["mint_tea", "Trà Bạc Hà Gió", "cup", "#7af0b0", 18, "Hồi 30% MP, Thần tốc 2 lượt.", mp1(0.3, { fx: [buff("haste", 2)] }), 1, { wind_mint: 2 }],
  ["honey_milk", "Sữa Mật Ong", "cup", "#f8e8a0", 24, "Cả đội hồi 20% máu và 20% MP.", healAll(0.2, { mpPct: 0.2 }), 1, { milk: 1, honey: 1 }],
  ["pancake", "Bánh Kếp Mật Ong", "cake", "#e8b060", 30, "Hồi 45% máu. Bữa ăn: +6% phép.", heal1(0.45), 1, { wheat: 1, egg: 1, honey: 1 }, meal("Bánh Kếp Mật Ong", { mag: 0.06 })],
  ["butter", "Bơ Tươi", "cheese", "#f8e890", 14, "Nguyên liệu nấu ăn. Ăn trực tiếp hồi 10% máu.", heal1(0.1), 1, { milk: 2 }],
  ["cheese", "Phô Mai Dê", "cheese", "#f0d060", 20, "Nguyên liệu nấu ăn. Hồi 20% máu.", heal1(0.2), 1, { goat_milk: 2 }],
  ["date_cake", "Bánh Chà Là", "cake", "#a0602a", 30, "Cả đội hồi 20% máu và nhận Thần tốc.", healAll(0.2, { field: false, fx: [buff("haste", 2)] }), 2, { golden_date: 2, wheat: 1 }],
  ["pumpkin_pie", "Bánh Bí Ngô Sao", "cake", "#ff9a2a", 45, "Hồi 60% máu cả đội và Tái sinh.", healAll(0.6, { fx: [buff("regen", 3, { p: 0.3 })] }), 2, { star_pumpkin: 1, wheat: 2 }],
  ["fried_rice", "Cơm Chiên Ngọc", "bowl", "#f0e080", 30, "Hồi 30% máu cả đội.", healAll(0.3), 2, { rice: 1, egg: 1, jade_pea: 1 }],
  ["beef_stew", "Thịt Hầm Rau Củ", "bowl", "#8a4a2a", 40, "Hồi 35% máu cả đội. Bữa ăn: +10% máu.", healAll(0.35), 2, { meat_beast: 1, holy_potato: 1, ember_carrot: 1 }, meal("Thịt Hầm Rau Củ", { hp: 0.1 })],
  ["lantern_soup", "Canh Cá Đèn Lồng", "bowl", "#6ad8ff", 38, "Cả đội hồi 30% máu, 15% MP.", healAll(0.3, { mpPct: 0.15 }), 2, { lantern_fish: 1, dusk_onion: 1 }],
  ["pepper_skewer", "Xiên Thịt Ớt Rồng", "skewer", "#e83a1a", 36, "Hồi 40% máu, Cuồng lực. Bữa ăn: +10% công.", heal1(0.4, { fx: [buff("atkUp")] }), 2, { meat_bird: 1, dragon_pepper: 1 }, meal("Xiên Thịt Ớt Rồng", { atk: 0.1 })],
  ["cheese_bread", "Bánh Mì Phô Mai", "bread", "#f0c860", 34, "Hồi 50% máu.", heal1(0.5), 2, { wheat: 2, cheese: 1 }],
  ["strawberry_cake", "Bánh Dâu Pha Lê", "cake", "#ff7a9a", 48, "Cả đội hồi 30%. Bữa ăn: +6% chí mạng.", healAll(0.3), 2, { wheat: 1, egg: 1, crystal_strawberry: 2 }, meal("Bánh Dâu Pha Lê", { crit: 6 })],
  ["melon_juice", "Nước Dưa Hấu Sấm", "cup", "#6ad86a", 40, "Cả đội hồi 30% MP.", { target: "allies", mpPct: 0.3, field: true }, 2, { thunder_melon: 1 }],
  ["night_wine", "Rượu Nho Đêm", "bottle", "#5a2a7a", 45, "Minh tâm 3 lượt. Bữa ăn: +10% phép.", { target: "ally", fx: [buff("magUp")], field: true }, 2, { night_grape: 3 }, meal("Rượu Nho Đêm", { mag: 0.1 })],
  ["eggplant_stirfry", "Cà Tím Xào Tỏi", "bowl", "#6a3a8a", 32, "Hồi 35%. Bữa ăn: +10% kháng phép.", heal1(0.35), 2, { shadow_eggplant: 1, dusk_onion: 1 }, meal("Cà Tím Xào Tỏi", { res: 0.1 })],
  ["beet_soup", "Súp Dền Đỏ", "bowl", "#a01a3a", 40, "Hồi 45% và Hút máu 3 lượt.", heal1(0.45, { fx: [buff("lifesteal")] }), 2, { blood_beet: 2, meat_beast: 1 }],
  ["apple_pie", "Bánh Táo Hồng Ngọc", "cake", "#e8403a", 50, "Hồi 40% máu cả đội.", healAll(0.4), 2, { ruby_apple: 2, wheat: 1, butter: 1 }],
  ["orange_juice", "Nước Cam Mặt Trời", "cup", "#ffa020", 38, "Cả đội hồi 25% MP và Thần tốc.", { target: "allies", mpPct: 0.25, fx: [buff("haste", 2)], field: true }, 2, { sun_orange: 2 }],
  ["roast_chestnut", "Hạt Dẻ Rang", "seed", "#7a4a2a", 24, "Hồi 30%. Bữa ăn: +8% phòng thủ.", heal1(0.3), 2, { wild_chestnut: 3 }, meal("Hạt Dẻ Rang", { def: 0.08 })],
  ["honey_toast", "Bánh Mì Nướng Mật", "bread", "#e8a040", 32, "Hồi 40% máu.", heal1(0.4), 2, { bread: 1, honey: 1 }],
  ["fish_stew", "Cá Kho Tộ", "bowl", "#a0602a", 42, "Hồi 40% máu cả đội.", healAll(0.4), 2, { silver_salmon: 1, dusk_onion: 1, dragon_pepper: 1 }],
  ["perch_grill", "Cá Rô Nướng Muối Ớt", "fish", "#ffa040", 36, "Hồi 45% và Cuồng lực.", heal1(0.45, { fx: [buff("atkUp")] }), 2, { sun_perch: 1, dragon_pepper: 1 }],
  ["corn_butter", "Bắp Nướng Bơ", "pod", "#f8d040", 30, "Hồi 30%. Bữa ăn: +6% phòng thủ.", heal1(0.3), 2, { gold_corn: 1, butter: 1 }, meal("Bắp Nướng Bơ", { def: 0.06 })],
  ["lotus_tea", "Trà Sen Ma", "cup", "#e0c8ff", 40, "Cả đội được thanh tẩy và hồi 30% MP.", { target: "allies", cleanse: true, mpPct: 0.3, field: true }, 3, { ghost_lotus: 1, silver_herb: 1 }],
  ["frost_hotpot", "Lẩu Cải Băng", "bowl", "#a8e0ff", 60, "Cả đội hồi 50%. Bữa ăn: +15% máu.", healAll(0.5), 3, { frost_cabbage: 1, snow_root: 1, meat_monster: 1 }, meal("Lẩu Cải Băng", { hp: 0.15 })],
  ["trout_sashimi", "Gỏi Cá Hồi Băng", "fish", "#c8e8ff", 55, "Hồi 50% và Tập trung. Bữa ăn: +8% chí mạng.", heal1(0.5, { fx: [buff("focus")] }), 3, { ice_trout: 1, wind_mint: 1 }, meal("Gỏi Cá Hồi Băng", { crit: 8 })],
  ["eel_rice", "Cơm Lươn Sấm", "bowl", "#4a4ae0", 60, "Cả đội hồi 45%, Thần tốc. Bữa ăn: +8% tốc độ.", healAll(0.45, { fx: [buff("haste", 2)] }), 3, { thunder_eel: 1, rice: 1 }, meal("Cơm Lươn Sấm", { spd: 0.08 })],
  ["peach_dessert", "Chè Đào Tiên", "bowl", "#ffa0b0", 70, "Cả đội hồi 60% và Tái sinh.", healAll(0.6, { fx: [buff("regen", 3, { p: 0.35 })] }), 3, { immortal_peach: 2, honey: 1 }],
  ["cherry_tart", "Bánh Anh Đào", "cake", "#d8203a", 55, "Cả đội hồi 40% máu, 20% MP.", healAll(0.4, { mpPct: 0.2 }), 3, { sweet_cherry: 3, wheat: 1, butter: 1 }],
  ["pear_compote", "Lê Hầm Mật", "bowl", "#e8f0a0", 50, "Hồi 50% MP.", mp1(0.5), 3, { moon_pear: 2, honey: 1 }],
  ["blueberry_jam", "Mứt Việt Quất Băng", "jar", "#4a6ae0", 44, "Hồi 30% và Kiên cố.", heal1(0.3, { fx: [buff("defUp")] }), 3, { ice_blueberry: 3 }],
  ["dew_tea_brew", "Trà Sương Mai Pha", "cup", "#6ab06a", 45, "Cả đội hồi 30% MP và được thanh tẩy.", { target: "allies", mpPct: 0.3, cleanse: true, field: true }, 3, { dew_tea: 2 }],
  ["sage_soup", "Canh Xô Thơm", "bowl", "#a0b0e0", 50, "Hồi 40%, Thánh hộ. Bữa ăn: +12% kháng phép.", heal1(0.4, { fx: [buff("immune", 2)] }), 3, { spirit_sage: 1, meat_bird: 1 }, meal("Canh Xô Thơm", { res: 0.12 })],
  ["shiitake_risotto", "Cơm Nấm Hương", "bowl", "#8a5a3a", 50, "Cả đội hồi 45% máu, 20% MP.", healAll(0.45, { mpPct: 0.2 }), 3, { rice: 1, forest_shiitake: 2, butter: 1 }],
  ["royal_feast", "Tiệc Hoàng Gia", "meat", "#f2c542", 150, "Cả đội hồi 70% và Tái sinh. Bữa ăn: +10% công và phép.", healAll(0.7, { fx: [buff("regen", 3, { p: 0.3 })] }), 3, { meat_beast: 2, star_pumpkin: 1, night_grape: 1, cheese: 1 }, meal("Tiệc Hoàng Gia", { atk: 0.1, mag: 0.1 })],
  ["sunmoon_salad", "Gỏi Nhật Nguyệt", "leafy", "#ffe0a0", 140, "Cả đội hồi 80% máu, 40% MP.", healAll(0.8, { mpPct: 0.4 }), 4, { sunmoon_fruit: 1, cloud_cabbage: 1 }],
  ["dragon_sorbet", "Kem Dưa Long Hỏa", "cup", "#ff5a2a", 150, "Cả đội Cuồng lực và Minh tâm. Bữa ăn: +15% công và phép.", { target: "allies", fx: [buff("atkUp"), buff("magUp")], field: true }, 4, { dragon_melon: 1, milk: 1 }, meal("Kem Dưa Long Hỏa", { atk: 0.15, mag: 0.15 })],
  ["crystal_rice_bowl", "Cơm Lúa Pha Lê", "bowl", "#c8f0ff", 130, "Cả đội hồi 60% và Kết giới. Bữa ăn: +20% máu.", healAll(0.6, { fx: [buff("barrier")] }), 4, { crystal_rice: 2, egg: 1 }, meal("Cơm Lúa Pha Lê", { hp: 0.2 })],
  ["phoenix_soup", "Canh Phượng Hoàng", "bowl", "#ff3a2a", 200, "Hồi sinh 1 đồng đội với 100% máu.", { target: "deadAlly", revivePct: 1, field: true }, 4, { phoenix_flower: 1, meat_bird: 1 }],
  ["void_pie", "Bánh Bí Hư Không", "cake", "#3a2a6a", 150, "Cả đội hồi 60%, Né tránh và Tích lực.", healAll(0.6, { fx: [buff("evade"), buff("empower", 2)] }), 4, { void_pumpkin: 1, wheat: 2 }],
  ["heaven_tea_brew", "Trà Thiên Giới Pha", "cup", "#f0e8a0", 180, "Cả đội hồi 100% MP và Thánh hộ. Bữa ăn: +8% mọi chỉ số.", { target: "allies", mpPct: 1, fx: [buff("immune", 2)], field: true }, 4, { heaven_tea: 2 }, meal("Trà Thiên Giới", { atk: 0.08, mag: 0.08, def: 0.08, res: 0.08, spd: 0.08 })],
  ["royal_jelly_drink", "Nước Sữa Ong Chúa", "cup", "#fff0a0", 160, "Cả đội hồi 100% máu và Tái sinh.", healAll(1, { fx: [buff("regen", 3, { p: 0.3 })] }), 4, { royal_jelly: 1, milk: 1 }],
];
for (const [id, name, shape, col, value, desc, use, level, cost, m] of foods) {
  I(id, name, "food", value, desc, shape, [col, C.bone, "#ffffff"], { use, meal: m, icon: "🍲" });
  R("kitchen", level, id, cost);
}
