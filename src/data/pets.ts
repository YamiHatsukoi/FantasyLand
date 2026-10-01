import type { CreatureSpec } from "../render/creatures";
import { I, ITEMS } from "./items/core";

/**
 * Pets: one travels with the party. Each has a single, very specific gift: some act in battle
 * every few turns, some change how exploring or looting works. They hatch from Pet Eggs.
 */
export type PetHook =
  | "sight" // wider view in the dungeon
  | "gold" // more gold from battles
  | "xp" // more experience
  | "scan" // every enemy weakness is known from the start
  | "courage" // allies start battles with extra courage
  | "shell" // allies start battles shielded
  | "thorns" // allies start battles with thorns
  | "sleep" // enemies may fall asleep at the start
  | "revive" // the first ally to fall gets back up, once per battle
  | "burn" // acts: burns an enemy every few turns
  | "rain" // acts: heals the party every few turns
  | "spark" // acts: shocks every enemy every few turns
  | "pilfer" // an extra loot roll after each win
  | "forage" // may find a potion after each win
  | "dig"; // gathering spots give double

export interface PetDef {
  id: string;
  name: string;
  hook: PetHook;
  gift: string; // name of the gift
  desc: string;
  look: Omit<CreatureSpec, "seed">;
}

export const PETS: PetDef[] = [
  { id: "pet_cat", name: "Mèo Mun", hook: "sight", gift: "Mắt Đêm", desc: "Tầm nhìn dưới Vực Sâu rộng thêm 3 ô.", look: { plan: "cat", c: "#2a2a34", c2: "#ffd23a", eye: "#ffd23a" } },
  { id: "pet_pig", name: "Heo Vàng Tham Ăn", hook: "gold", gift: "Mũi Đánh Hơi Vàng", desc: "+35% vàng sau mỗi trận thắng.", look: { plan: "quad", c: "#f2b5a0", c2: "#e8c040" } },
  { id: "pet_owl", name: "Cú Tuyết", hook: "scan", gift: "Mắt Thấu Suốt", desc: "Mọi điểm yếu của kẻ địch lộ ra ngay từ đầu trận.", look: { plan: "bird", c: "#f0f0f8", c2: "#e0b040", eye: "#ffb020" } },
  { id: "pet_rabbit", name: "Thỏ Trăng", hook: "courage", gift: "Nhảy Cóc", desc: "Cả đội vào trận với 3 Dũng Khí thay vì 1.", look: { plan: "deer", c: "#f4f0ff", c2: "#c8b8ff" } },
  { id: "pet_turtle", name: "Rùa Ngọc", hook: "shell", gift: "Mai Hộ Mệnh", desc: "Cả đội vào trận với một lớp khiên chắn đòn.", look: { plan: "turtle", c: "#4ab09a", c2: "#a8f0e0" } },
  { id: "pet_hedgehog", name: "Nhím Gai", hook: "thorns", gift: "Gai Nhỏ", desc: "Cả đội có Gai phản trong 3 lượt đầu.", look: { plan: "blob", c: "#8a6a4a", c2: "#e8d8b8" } },
  { id: "pet_moth", name: "Bướm Mộng", hook: "sleep", gift: "Phấn Ngủ", desc: "Đầu trận, mỗi kẻ địch có 35% bị ru ngủ.", look: { plan: "moth", c: "#b88aff", c2: "#ffd8f8" } },
  { id: "pet_phoenix", name: "Phượng Hoàng Non", hook: "revive", gift: "Tro Tàn Hồi Sinh", desc: "Mỗi trận, người đầu tiên gục ngã được hồi sinh với 30% máu.", look: { plan: "bird", c: "#ff7a2a", c2: "#ffe14a", eye: "#fff6a0" } },
  { id: "pet_fox", name: "Cáo Lửa", hook: "burn", gift: "Đuôi Lửa", desc: "Cứ 3 lượt của đội, cáo phun lửa đốt một kẻ địch (tính là đòn hệ Lửa).", look: { plan: "wolf", c: "#e86a2a", c2: "#fff0c0" } },
  { id: "pet_cloudwhale", name: "Cá Voi Mây", hook: "rain", gift: "Mưa Lành", desc: "Cứ 3 lượt của đội, mưa lành hồi 10% máu cho cả đội.", look: { plan: "fish", c: "#a8d8ff", c2: "#ffffff" } },
  { id: "pet_eel", name: "Lươn Sét", hook: "spark", gift: "Tia Chớp Nhỏ", desc: "Cứ 4 lượt của đội, phóng điện vào mọi kẻ địch (hệ Sét).", look: { plan: "serpent", c: "#3a4a8a", c2: "#ffe14a", eye: "#ffe14a" } },
  { id: "pet_imp", name: "Tiểu Quỷ Láu Cá", hook: "pilfer", gift: "Móc Túi", desc: "Sau mỗi trận thắng, thó thêm một món chiến lợi phẩm.", look: { plan: "biped", c: "#c83a4a", c2: "#2a1a1a" } },
  { id: "pet_squirrel", name: "Sóc Tinh", hook: "forage", gift: "Túi Má Phồng", desc: "Sau mỗi trận thắng, 30% nhặt được một lọ thuốc.", look: { plan: "cat", c: "#b8743a", c2: "#f0d8a8" } },
  { id: "pet_mole", name: "Chuột Chũi Đào Mỏ", hook: "dig", gift: "Móng Đào", desc: "Điểm khai thác dưới Vực Sâu cho gấp đôi.", look: { plan: "bear", c: "#5a4a4a", c2: "#f0a0a0" } },
  { id: "pet_wisp", name: "Đom Đóm Hiền Triết", hook: "xp", gift: "Ánh Sáng Tri Thức", desc: "+25% kinh nghiệm sau mỗi trận.", look: { plan: "elemental", c: "#fff3a0", c2: "#ffffff" } },
];
export const PET = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const petSpec = (p: PetDef): CreatureSpec => ({ v: 0, ...p.look, seed: p.id.length * 7919 + p.id.charCodeAt(4) });

/** Every how many party turns an acting pet does its thing. */
export const PET_EVERY: Partial<Record<PetHook, number>> = { burn: 3, rain: 3, spark: 4 };

export const PET_EGG = "pet_egg";
if (!ITEMS[PET_EGG]) {
  I(PET_EGG, "Trứng Thú Cưng", "animal", 120, "Một quả trứng ấm, thỉnh thoảng lại cựa quậy. Mở mục 🐾 Thú cưng ở màn Đội Hình để ấp nở.", "egg", ["#f4ecd8", "#c8a86a", "#ff9ab8"], { icon: "🥚" });
}
