import type { Eff, StatMods } from "../combat/types";
import { PASSIVES } from "./passives";
import { SKILLS } from "./skills";

export type ItemType = "material" | "seed" | "crop" | "food" | "potion" | "bomb" | "equip" | "tome" | "key";
export type EquipSlot = "weapon" | "armor" | "accessory";

/** What a consumable does when used (in battle or on the map). */
export interface ItemUse {
  target: "ally" | "allies" | "enemies" | "deadAlly";
  healPct?: number;
  mpPct?: number;
  cleanse?: boolean;
  revivePct?: number;
  fx?: Eff[];
  dmg?: { el: import("../combat/types").Element; base: number }; // base damage scaled by floor
  field?: boolean; // usable outside battle
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: ItemType;
  desc: string;
  value: number; // sell price
  use?: ItemUse;
  equip?: { slot: EquipSlot; stats: StatMods; passive?: string };
  crop?: string; // seed -> crop id
  skill?: string; // tome
  passive?: string; // passive tome
}

const list: ItemDef[] = [];
const I = (id: string, name: string, icon: string, type: ItemType, value: number, desc: string, o: Partial<ItemDef> = {}) =>
  list.push({ id, name, icon, type, value, desc, ...o });

// ------------------------------------------------------------ materials
I("wood", "Gỗ Cổ Thụ", "🪵", "material", 2, "Gỗ cứng từ những cây cổ thụ biết thì thầm.");
I("stone", "Đá Tảng", "🪨", "material", 2, "Đá xây dựng thông thường.");
I("iron_ore", "Quặng Sắt", "⛓️", "material", 5, "Quặng sắt thô, dùng để rèn.");
I("herb", "Thảo Dược Rừng", "🌿", "material", 3, "Lá thuốc mọc dưới tán rừng ẩm.");
I("hide", "Da Thú", "🟫", "material", 4, "Tấm da dày từ thú hoang.");
I("fang", "Nanh Sói", "🦷", "material", 5, "Nanh sắc của sói rừng.");
I("slime_gel", "Gel Slime", "🟢", "material", 3, "Chất nhầy dẻo, có tính kết dính.");
I("mushroom_cap", "Mũ Nấm Phát Sáng", "🍄", "material", 5, "Mũ nấm phát ánh sáng xanh dịu, giàu ma lực.");
I("sandstone", "Sa Thạch", "🧱", "material", 4, "Đá cát màu mật ong từ sa mạc.");
I("amber", "Hổ Phách", "🟠", "material", 12, "Nhựa hoá thạch, đôi khi chứa sinh vật bên trong.");
I("chitin", "Giáp Xác", "🪲", "material", 8, "Mảnh vỏ cứng của côn trùng sa mạc.");
I("bone", "Xương Khô", "🦴", "material", 4, "Xương tẩy trắng bởi nắng sa mạc.");
I("linen", "Vải Liệm Cổ", "🧻", "material", 6, "Vải liệm ngàn năm vẫn còn bền chắc.");
I("cactus_fruit", "Quả Xương Rồng", "🌵", "material", 5, "Ngọt, mọng nước — báu vật của sa mạc.");
I("peat", "Than Bùn", "🟤", "material", 4, "Nhiên liệu cháy âm ỉ, rất bắt lửa.");
I("bog_iron", "Sắt Đầm Lầy", "⚙️", "material", 10, "Sắt kết tủa dưới đáy đầm, cứng lạ thường.");
I("glowmoss", "Rêu Phát Quang", "🟩", "material", 7, "Rêu phát sáng dịu, xua tan tà khí.");
I("soul_wax", "Sáp Linh Hồn", "🕯️", "material", 14, "Sáp từ những ngọn đèn giam giữ linh hồn.");
I("pearl", "Ngọc Trai Đen", "⚫", "material", 40, "Ngọc trai sinh ra từ nước mắt của vương quốc chìm.");
I("mana_crystal", "Tinh Thể Ma Lực", "💎", "material", 25, "Ma lực kết tinh. Dùng để nghiên cứu kỹ năng.");
I("monster_core", "Lõi Quái Vật", "🔴", "material", 30, "Trái tim kết tinh của quái vật mạnh.");
I("black_thorn", "Gai Đen", "🖤", "key", 0, "Chiếc gai đen rút ra từ kẻ canh giữ tầng. Nó vẫn còn ấm, và dường như đang đập.");

// ------------------------------------------------------------ seeds & crops
const CROP_LIST: [string, string, string, string, string, number][] = [
  // seedId, cropId, seedName, cropName, icon, value
  ["seed_wheat", "wheat", "Hạt Lúa Vàng", "Lúa Vàng", "🌾", 4],
  ["seed_radish", "moon_radish", "Hạt Củ Ánh Trăng", "Củ Ánh Trăng", "🥕", 6],
  ["seed_berry", "fire_berry", "Hạt Dâu Lửa", "Dâu Lửa", "🍓", 7],
  ["seed_herb", "silver_herb", "Hạt Thảo Dược Bạc", "Thảo Dược Bạc", "🌱", 8],
  ["seed_mushroom", "spirit_mushroom", "Bào Tử Nấm Tinh Linh", "Nấm Tinh Linh", "🍄", 10],
  ["seed_date", "golden_date", "Hạt Chà Là Vàng", "Chà Là Vàng", "🌴", 12],
  ["seed_pumpkin", "star_pumpkin", "Hạt Bí Ngô Sao", "Bí Ngô Sao", "🎃", 16],
  ["seed_lotus", "ghost_lotus", "Hạt Sen Ma", "Sen Ma", "🪷", 18],
];
for (const [sid, cid, sname, cname, icon, value] of CROP_LIST) {
  I(sid, sname, "🫘", "seed", Math.ceil(value / 2), `Gieo ở ruộng để trồng ${cname}.`, { crop: cid });
  I(cid, cname, icon, "crop", value, "Nông sản từ Thánh Địa. Dùng để nấu ăn hoặc bào chế.");
}

// ------------------------------------------------------------ food (kitchen)
I("bread", "Bánh Mì Nướng", "🍞", "food", 12, "Hồi 35% máu cho 1 đồng đội.", { use: { target: "ally", healPct: 0.35, field: true } });
I("stew", "Súp Rau Củ", "🍲", "food", 20, "Hồi 25% máu cho cả đội.", { use: { target: "allies", healPct: 0.25, field: true } });
I("berry_jam", "Mứt Dâu Lửa", "🍯", "food", 22, "Hồi 15% máu và nhận Cuồng lực 3 lượt.", { use: { target: "ally", healPct: 0.15, fx: [{ s: "atkUp", t: 3 }, { s: "magUp", t: 3 }] } });
I("mushroom_soup", "Súp Nấm Tinh Linh", "🥣", "food", 26, "Hồi 40% MP cho 1 đồng đội.", { use: { target: "ally", mpPct: 0.4, field: true } });
I("date_cake", "Bánh Chà Là", "🥮", "food", 30, "Cả đội hồi 20% máu và nhận Thần tốc.", { use: { target: "allies", healPct: 0.2, fx: [{ s: "haste", t: 2 }] } });
I("pumpkin_pie", "Bánh Bí Ngô Sao", "🥧", "food", 45, "Hồi 60% máu cả đội và Tái sinh.", { use: { target: "allies", healPct: 0.6, fx: [{ s: "regen", t: 3, p: 0.3 }], field: true } });
I("lotus_tea", "Trà Sen Ma", "🍵", "food", 40, "Cả đội được thanh tẩy và hồi 30% MP.", { use: { target: "allies", cleanse: true, mpPct: 0.3, field: true } });

// ------------------------------------------------------------ potions & bombs (alchemy)
I("potion_hp", "Thuốc Hồi Máu", "🧪", "potion", 15, "Hồi 50% máu cho 1 đồng đội.", { use: { target: "ally", healPct: 0.5, field: true } });
I("potion_mp", "Thuốc Ma Lực", "🔵", "potion", 20, "Hồi 50% MP cho 1 đồng đội.", { use: { target: "ally", mpPct: 0.5, field: true } });
I("antidote", "Thuốc Giải", "💊", "potion", 12, "Xoá mọi hiệu ứng bất lợi của 1 đồng đội.", { use: { target: "ally", cleanse: true } });
I("phoenix_down", "Lông Phượng Hoàng", "🪶", "potion", 60, "Hồi sinh 1 đồng đội với 40% máu.", { use: { target: "deadAlly", revivePct: 0.4, field: true } });
I("elixir", "Tiên Dược", "⚱️", "potion", 150, "Hồi toàn bộ máu và MP cho cả đội.", { use: { target: "allies", healPct: 1, mpPct: 1, field: true } });
I("oil_flask", "Bình Dầu Cháy", "🛢️", "bomb", 14, "Ném vào kẻ địch: tất cả Dính dầu. Lửa sẽ gây Nổ Dầu!", { use: { target: "enemies", fx: [{ s: "oil", t: 3 }] } });
I("water_flask", "Bình Nước Thánh", "💧", "bomb", 14, "Tạt nước lên kẻ địch: tất cả Ướt sũng.", { use: { target: "enemies", fx: [{ s: "wet", t: 2 }] } });
I("frost_bomb", "Bom Băng", "❄️", "bomb", 30, "Gây sát thương băng và 2 tầng Tê cóng lên mọi kẻ địch.", { use: { target: "enemies", dmg: { el: "ice", base: 18 }, fx: [{ s: "chill", t: 3, st: 2 }] } });
I("thunder_bomb", "Bom Sấm", "🌩️", "bomb", 30, "Gây sát thương sét và Nhiễm điện lên mọi kẻ địch.", { use: { target: "enemies", dmg: { el: "lightning", base: 18 }, fx: [{ s: "shock", t: 3, st: 2 }] } });
I("smoke_flask", "Bình Khói Mù", "🌫️", "bomb", 16, "Làm Mù mọi kẻ địch.", { use: { target: "enemies", fx: [{ s: "blind", ch: 0.85, t: 2 }] } });

// ------------------------------------------------------------ equipment
const E = (id: string, name: string, icon: string, slot: EquipSlot, value: number, stats: StatMods, passive?: string) =>
  I(id, name, icon, "equip", value, "", { equip: { slot, stats, passive } });

// tier 1 — forest
E("iron_sword", "Kiếm Sắt Thô", "🗡️", "weapon", 30, { atk: 6 });
E("oak_staff", "Trượng Gỗ Sồi", "🪄", "weapon", 30, { mag: 7, mp: 10 });
E("hunter_bow", "Cung Thợ Săn", "🏹", "weapon", 30, { atk: 5, crit: 4 });
E("fang_dagger", "Dao Nanh Sói", "🔪", "weapon", 30, { atk: 5, crit: 6 });
E("bark_shield", "Khiên Vỏ Cây", "🛡️", "weapon", 30, { def: 6, hp: 15 });
E("leather_armor", "Giáp Da Thú", "🦺", "armor", 30, { def: 5, hp: 20 });
E("mushroom_robe", "Áo Sợi Nấm", "🥼", "armor", 30, { res: 5, mp: 15 });
E("fang_necklace", "Vòng Nanh Sói", "📿", "accessory", 25, { atk: 3, crit: 3 });
E("herb_charm", "Bùa Thảo Mộc", "🍀", "accessory", 40, { res: 3 }, "p_regeneration");
// tier 2 — desert
E("amber_blade", "Kiếm Hổ Phách", "⚔️", "weapon", 90, { atk: 12 }, "p_arsonist");
E("sun_staff", "Trượng Mặt Trời", "☀️", "weapon", 90, { mag: 14, mp: 20 });
E("chitin_bow", "Cung Giáp Xác", "🏹", "weapon", 90, { atk: 11, crit: 6 });
E("scorpion_dagger", "Dao Đuôi Bọ Cạp", "🦂", "weapon", 90, { atk: 10, crit: 8 }, "p_venomous");
E("sandstone_shield", "Khiên Sa Thạch", "🛡️", "weapon", 90, { def: 12, hp: 40 });
E("chitin_armor", "Giáp Xác Bọ Cạp", "🦺", "armor", 90, { def: 12, hp: 45 });
E("desert_robe", "Áo Choàng Sa Mạc", "🧥", "armor", 90, { res: 10, mp: 30, eva: 4 });
E("amber_amulet", "Bùa Hổ Phách", "🧿", "accessory", 80, { mag: 6, res: 6 });
E("sand_boots", "Giày Lướt Cát", "👢", "accessory", 80, { spd: 8, eva: 5 });
// tier 3 — swamp
E("bog_axe", "Rìu Sắt Đầm Lầy", "🪓", "weapon", 200, { atk: 20, crit: 4 }, "p_executioner");
E("lantern_staff", "Trượng Đèn Lồng", "🏮", "weapon", 200, { mag: 22, mp: 30 }, "p_soul_siphon");
E("pearl_bow", "Cung Ngọc Trai", "🏹", "weapon", 200, { atk: 18, crit: 8 });
E("bog_shield", "Khiên Sắt Đầm Lầy", "🛡️", "weapon", 200, { def: 20, hp: 70 }, "p_thick_hide");
E("bog_plate", "Giáp Sắt Đầm Lầy", "🦺", "armor", 200, { def: 20, hp: 80, res: 6 });
E("glowmoss_cloak", "Áo Rêu Phát Quang", "🧥", "armor", 200, { res: 16, mp: 40, eva: 6 });
E("black_pearl_ring", "Nhẫn Ngọc Trai Đen", "💍", "accessory", 180, { mag: 10, crit: 6 });
E("soul_charm", "Bùa Linh Hồn", "🪬", "accessory", 180, { res: 8 }, "p_pure_soul");
E("drowned_crown", "Vương Miện Chết Đuối", "👑", "accessory", 500, { mag: 14, res: 14, mp: 30 }, "p_hydro");
// tier 4 — generic deep floors
E("mithril_sword", "Kiếm Mithril", "🗡️", "weapon", 450, { atk: 32, crit: 6 });
E("mithril_staff", "Trượng Mithril", "🪄", "weapon", 450, { mag: 34, mp: 50 });
E("mithril_bow", "Cung Mithril", "🏹", "weapon", 450, { atk: 30, crit: 10 });
E("mithril_shield", "Khiên Mithril", "🛡️", "weapon", 450, { def: 32, hp: 130 });
E("mithril_mail", "Giáp Lưới Mithril", "🦺", "armor", 450, { def: 30, hp: 140, res: 12 });
E("archmage_robe", "Áo Đại Pháp Sư", "🧥", "armor", 450, { res: 26, mp: 70, mag: 8 });
E("core_amulet", "Bùa Lõi Quái Vật", "📿", "accessory", 400, { atk: 10, mag: 10, spd: 6 });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  if (ITEMS[id]) return ITEMS[id];
  if (id.startsWith("tome:")) {
    const sk = SKILLS[id.slice(5)];
    if (sk) return { id, name: `Sách: ${sk.name}`, icon: "📕", type: "tome", value: 40 * sk.tier, desc: `Dạy kỹ năng ${sk.name} cho một nhân vật.`, skill: sk.id };
  }
  if (id.startsWith("ptome:")) {
    const p = PASSIVES[id.slice(6)];
    if (p) return { id, name: `Bí kíp: ${p.name}`, icon: "📗", type: "tome", value: 50 * p.tier, desc: `Dạy nội tại ${p.name}: ${p.desc}`, passive: p.id };
  }
  return { id, name: id, icon: "❓", type: "material", value: 0, desc: "Vật phẩm không xác định." };
}

export const TYPE_NAMES: Record<ItemType, string> = {
  material: "Nguyên liệu", seed: "Hạt giống", crop: "Nông sản", food: "Món ăn", potion: "Thuốc",
  bomb: "Vật phẩm ném", equip: "Trang bị", tome: "Sách kỹ năng", key: "Vật phẩm cốt truyện",
};
