import type { School, Stats } from "../combat/types";

export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  base: Stats;
  schools: School[];
  startSkills: string[];
  startPassives: string[];
  learnset: Record<number, string>;
}

const st = (hp: number, mp: number, atk: number, mag: number, def: number, res: number, spd: number, crit: number, eva: number): Stats =>
  ({ hp, mp, atk, mag, def, res, spd, crit, eva });

export const CLASSES: Record<string, ClassDef> = {
  warrior: {
    id: "warrior", name: "Kiếm Sĩ", icon: "⚔️",
    desc: "Chiến binh cận chiến cân bằng, sát thương vật lý mạnh và bền bỉ.",
    base: st(125, 32, 22, 8, 14, 10, 100, 8, 5),
    schools: ["sword", "axe", "spear", "fist", "fire", "earth", "song"],
    startSkills: ["slash", "parry"], startPassives: ["p_might"],
    learnset: { 3: "cross_slash", 5: "rending", 8: "whirlwind", 12: "skull_crack", 16: "blade_dance", 22: "execution", 30: "sword_saint" },
  },
  mage: {
    id: "mage", name: "Pháp Sư", icon: "🔮",
    desc: "Bậc thầy nguyên tố. Tạo phản ứng nguyên tố để gây sát thương khổng lồ.",
    base: st(85, 60, 9, 24, 8, 16, 102, 6, 4),
    schools: ["fire", "ice", "lightning", "water", "earth", "wind", "arcane", "dark"],
    startSkills: ["fire_bolt", "frost_shard"], startPassives: ["p_wisdom"],
    learnset: { 3: "spark", 5: "water_jet", 7: "magic_missile", 10: "ember_rain", 14: "blizzard", 18: "overload", 24: "arcane_blast", 32: "meteor" },
  },
  ranger: {
    id: "ranger", name: "Du Hiệp", icon: "🏹",
    desc: "Xạ thủ nhanh nhẹn, đánh dấu và hạ gục mục tiêu từ xa.",
    base: st(96, 40, 20, 12, 10, 10, 112, 12, 10),
    schools: ["bow", "spear", "nature", "wind", "poison"],
    startSkills: ["aimed_shot", "poison_arrow"], startPassives: ["p_keen"],
    learnset: { 3: "hunters_mark", 5: "multishot", 8: "fire_arrow", 11: "pinning_shot", 15: "snipe", 20: "volley", 30: "storm_arrow" },
  },
  rogue: {
    id: "rogue", name: "Sát Thủ", icon: "🗡️",
    desc: "Kẻ ám sát trong bóng tối: chảy máu, độc và chí mạng.",
    base: st(90, 38, 21, 10, 9, 9, 118, 18, 14),
    schools: ["dagger", "poison", "dark", "wind", "fist"],
    startSkills: ["backstab", "lacerate"], startPassives: ["p_nimble"],
    learnset: { 3: "toxic_dart", 5: "shadow_step", 8: "smoke_bomb", 11: "hemorrhage", 15: "quick_strike", 20: "assassinate", 30: "thousand_cuts" },
  },
  cleric: {
    id: "cleric", name: "Tư Tế", icon: "✨",
    desc: "Người chữa lành. Hồi máu, thanh tẩy và bảo hộ đồng đội.",
    base: st(100, 56, 11, 20, 12, 18, 98, 5, 5),
    schools: ["light", "water", "song", "nature", "shield"],
    startSkills: ["heal", "holy_light"], startPassives: ["p_healer"],
    learnset: { 3: "purify", 5: "soothing_stream", 8: "inspire", 11: "mass_heal", 15: "divine_shield", 20: "resurrection", 28: "sanctuary", 34: "judgment" },
  },
  guardian: {
    id: "guardian", name: "Hộ Vệ", icon: "🛡️",
    desc: "Tấm khiên của cả đội. Khiêu khích, chịu đòn và phản sát thương.",
    base: st(155, 34, 16, 8, 22, 16, 90, 5, 3),
    schools: ["shield", "spear", "earth", "light", "axe"],
    startSkills: ["shield_bash", "taunt"], startPassives: ["p_iron_skin"],
    learnset: { 3: "guardian_oath", 5: "stone_skin", 8: "thrust", 12: "bulwark", 16: "holy_bash", 22: "last_stand", 30: "aegis" },
  },
  witch: {
    id: "witch", name: "Phù Thủy", icon: "🧪",
    desc: "Nguyền rủa và độc dược. Chồng hiệu ứng rồi kích nổ tất cả.",
    base: st(92, 54, 10, 21, 9, 15, 104, 8, 6),
    schools: ["dark", "poison", "nature", "water", "arcane"],
    startSkills: ["curse", "poison_cloud", "shadow_bolt"], startPassives: ["p_toxic"],
    learnset: { 4: "drain_life", 7: "plague", 10: "venom_burst", 14: "fear", 18: "hex_transfer", 24: "doom", 32: "miasma" },
  },
};

/** Stats at a given level (without gear). */
export function classStats(classId: string, level: number): Stats {
  const b = CLASSES[classId].base;
  const g = 1 + 0.1 * (level - 1);
  return {
    hp: Math.round(b.hp * g),
    mp: Math.round(b.mp * (1 + 0.06 * (level - 1))),
    atk: Math.round(b.atk * g),
    mag: Math.round(b.mag * g),
    def: Math.round(b.def * g),
    res: Math.round(b.res * g),
    spd: Math.round(b.spd + 0.8 * (level - 1)),
    crit: b.crit,
    eva: b.eva,
  };
}

export const xpForLevel = (level: number) => Math.round(30 * Math.pow(level, 1.55));

export interface CompanionDef {
  id: string;
  name: string;
  classId: string;
  sprite: string;
  bio: string;
  extraSkills: string[];
  extraPassives: string[];
}

export const COMPANIONS: Record<string, CompanionDef> = {
  lyra: {
    id: "lyra", name: "Lyra Lá Bạc", classId: "ranger", sprite: "lyra",
    bio: "Nữ du hiệp tộc Tiên Rừng, người gác cánh rừng Thì Thầm suốt ba trăm năm.",
    extraSkills: ["entangle"], extraPassives: ["p_vanguard"],
  },
  bram: {
    id: "bram", name: "Bram Mũ Đỏ", classId: "guardian", sprite: "bram",
    bio: "Hiệp sĩ tộc Nấm cuối cùng của làng Mũ Đỏ. Nói ít, đỡ đòn nhiều.",
    extraSkills: ["barkskin"], extraPassives: ["p_thick_hide"],
  },
  samira: {
    id: "samira", name: "Samira Hổ Phách", classId: "cleric", sprite: "samira",
    bio: "Nữ tư tế của đoàn lữ hành sa mạc, mang theo ngọn lửa thánh không bao giờ tắt.",
    extraSkills: ["healing_rain"], extraPassives: ["p_pure_soul"],
  },
  morwen: {
    id: "morwen", name: "Morwen Đèn Lồng", classId: "witch", sprite: "morwen",
    bio: "Phù thủy đầm lầy bị lưu đày, kẻ nghe được tiếng nói của người chết đuối.",
    extraSkills: ["water_jet"], extraPassives: ["p_soul_siphon"],
  },
};
