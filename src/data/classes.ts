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
  monk: {
    id: "monk", name: "Võ Tăng", icon: "🥋",
    desc: "Võ sĩ tay không cực nhanh, đánh liên hoàn và tự hồi phục bằng nội công.",
    base: st(110, 36, 21, 10, 11, 12, 116, 12, 12),
    schools: ["fist", "wind", "light", "song"],
    startSkills: ["jab", "iron_body"], startPassives: ["p_swift"],
    learnset: { 3: "palm_strike", 5: "feather_step", 8: "meditation", 11: "chi_burst", 15: "tailwind", 19: "hundred_fists", 24: "dragon_fist", 32: "nirvana_palm" },
  },
  paladin: {
    id: "paladin", name: "Thánh Kỵ Sĩ", icon: "⚜️",
    desc: "Hiệp sĩ thánh: vừa chém vừa hồi máu, bảo hộ đồng đội bằng ánh sáng.",
    base: st(140, 42, 18, 14, 18, 16, 94, 6, 3),
    schools: ["sword", "shield", "light", "fire"],
    startSkills: ["slash", "holy_light"], startPassives: ["p_holy"],
    learnset: { 3: "heal", 5: "light_imbue", 8: "guardian_oath", 11: "purify", 14: "holy_bash", 18: "divine_shield", 24: "holy_crusade", 32: "judgment" },
  },
  bard: {
    id: "bard", name: "Thi Sĩ", icon: "🎻",
    desc: "Nghệ sĩ lang thang: bài ca tăng sức mạnh cả đội và làm rối loạn kẻ thù.",
    base: st(95, 52, 12, 18, 10, 14, 108, 8, 10),
    schools: ["song", "wind", "arcane", "water"],
    startSkills: ["inspire", "discord"], startPassives: ["p_lucky"],
    learnset: { 3: "gust", 5: "battle_cry", 8: "war_song", 11: "soothing_stream", 14: "hymn", 18: "lullaby", 24: "dirge", 32: "grand_finale" },
  },
  necromancer: {
    id: "necromancer", name: "Vong Linh Sư", icon: "💀",
    desc: "Kẻ điều khiển cái chết: giáo xương, nguyền rủa và hút sinh lực.",
    base: st(88, 58, 12, 23, 8, 15, 100, 7, 5),
    schools: ["dark", "poison", "ice", "arcane"],
    startSkills: ["bone_spear", "shadow_bolt"], startPassives: ["p_soul_siphon"],
    learnset: { 3: "drain_life", 5: "curse", 8: "frost_shard", 11: "fear", 14: "corpse_blast", 18: "doom", 24: "soul_harvest", 32: "lich_form" },
  },
  druid: {
    id: "druid", name: "Tế Tự Rừng", icon: "🌿",
    desc: "Người giữ rừng: trói chân, gây chảy máu và hồi sinh đồng đội bằng sức sống thiên nhiên.",
    base: st(105, 50, 13, 19, 12, 16, 100, 6, 6),
    schools: ["nature", "earth", "water", "wind", "poison"],
    startSkills: ["thorn_whip", "regrowth"], startPassives: ["p_vigor"],
    learnset: { 3: "entangle", 5: "barkskin", 8: "quicksand", 11: "healing_rain", 14: "spore_cloud", 18: "wild_growth", 24: "earthquake", 32: "natures_wrath" },
  },
  spellblade: {
    id: "spellblade", name: "Ma Kiếm Sĩ", icon: "🌀",
    desc: "Kiếm sĩ tẩm nguyên tố vào lưỡi kiếm, tự tạo phản ứng nguyên tố trong từng nhát chém.",
    base: st(108, 46, 19, 17, 11, 13, 106, 9, 6),
    schools: ["sword", "fire", "ice", "lightning", "arcane"],
    startSkills: ["slash", "spark"], startPassives: ["p_conductor"],
    learnset: { 3: "fire_imbue", 5: "ice_imbue", 7: "lightning_imbue", 10: "cross_slash", 14: "overload", 18: "blade_dance", 24: "elemental_edge", 32: "prismatic_ray" },
  },
  dragoon: {
    id: "dragoon", name: "Long Kỵ Binh", icon: "🐉",
    desc: "Chiến binh giáo nhảy vọt: đòn đâm xuyên và cú lao từ trên trời xuống.",
    base: st(118, 34, 23, 9, 13, 10, 104, 10, 6),
    schools: ["spear", "wind", "fire", "axe"],
    startSkills: ["thrust", "gust"], startPassives: ["p_vanguard"],
    learnset: { 3: "sweep", 5: "cleave", 8: "impale", 12: "phalanx", 16: "dragon_leap", 20: "cyclone", 26: "tempest", 32: "heavens_pierce" },
  },
  samurai: {
    id: "samurai", name: "Kiếm Khách", icon: "🎴",
    desc: "Lãng khách một kiếm: rút kiếm chớp nhoáng, chí mạng cao và phản đòn điềm tĩnh.",
    base: st(108, 34, 24, 8, 11, 10, 110, 16, 8),
    schools: ["sword", "wind", "light"],
    startSkills: ["iai_slash", "zen_stance"], startPassives: ["p_keen"],
    learnset: { 3: "wind_blade", 5: "cross_slash", 8: "moon_slash", 12: "parry", 16: "blade_dance", 22: "execution", 30: "thousand_petals" },
  },
  ninja: {
    id: "ninja", name: "Nhẫn Giả", icon: "🥷",
    desc: "Bóng ma chiến trường: phi tiêu, nhẫn thuật lửa và tuyệt kỹ kết liễu.",
    base: st(88, 40, 20, 12, 8, 9, 124, 16, 18),
    schools: ["dagger", "poison", "dark", "fire", "wind"],
    startSkills: ["shuriken", "kawarimi"], startPassives: ["p_nimble"],
    learnset: { 3: "toxic_dart", 5: "katon", 8: "smoke_bomb", 12: "shadow_clone", 16: "quick_strike", 22: "assassinate", 30: "death_lotus" },
  },
  alchemist: {
    id: "alchemist", name: "Giả Kim Sư", icon: "⚗️",
    desc: "Nhà giả kim ném bình axit, pha thuốc tiên và biến hóa nguyên tố.",
    base: st(96, 56, 10, 20, 10, 15, 102, 8, 6),
    schools: ["poison", "fire", "water", "arcane"],
    startSkills: ["acid_flask", "healing_elixir"], startPassives: ["p_catalyst"],
    learnset: { 3: "fire_bolt", 5: "corrosion", 8: "volatile_mix", 12: "transmute", 16: "venom_burst", 22: "healing_rain", 30: "philosopher_stone" },
  },
  summoner: {
    id: "summoner", name: "Triệu Hồi Sư", icon: "📿",
    desc: "Gọi linh thú chiến đấu thay mình: sói linh, thạch nhân, phượng hoàng và cự thú.",
    base: st(90, 62, 9, 22, 9, 16, 98, 6, 5),
    schools: ["arcane", "nature", "earth", "fire"],
    startSkills: ["summon_wolf", "summon_golem"], startPassives: ["p_mana_well"],
    learnset: { 3: "magic_missile", 5: "entangle", 8: "spirit_link", 12: "boulder_toss", 16: "summon_phoenix", 22: "arcane_blast", 30: "summon_behemoth" },
  },
  berserker: {
    id: "berserker", name: "Cuồng Chiến Sĩ", icon: "🪓",
    desc: "Càng bị thương càng đánh mạnh: đổi máu lấy sát thương khủng khiếp.",
    base: st(150, 26, 26, 5, 10, 7, 100, 10, 3),
    schools: ["axe", "fist", "fire"],
    startSkills: ["cleave", "frenzy"], startPassives: ["p_berserker_blood"],
    learnset: { 3: "blood_rage", 5: "skull_crack", 8: "reckless_swing", 12: "rampage", 16: "undying", 22: "blood_axe", 30: "ragnarok" },
  },
  shaman: {
    id: "shaman", name: "Tế Linh Sư", icon: "🪶",
    desc: "Người nói chuyện với linh hồn tổ tiên: dựng cột tổ linh, gọi sấm và yểm bùa.",
    base: st(102, 54, 12, 19, 11, 16, 100, 6, 6),
    schools: ["nature", "lightning", "water", "earth"],
    startSkills: ["spark", "spirit_totem"], startPassives: ["p_spirit"],
    learnset: { 3: "thunder_totem", 5: "water_jet", 8: "frog_hex", 12: "ancestral_call", 16: "thunderclap", 22: "healing_rain", 30: "storm_spirit" },
  },
  chronomancer: {
    id: "chronomancer", name: "Thời Không Sư", icon: "⏳",
    desc: "Bẻ cong thời gian: tăng tốc đồng đội, làm chậm kẻ thù, tua ngược vết thương.",
    base: st(88, 60, 8, 21, 9, 17, 108, 7, 7),
    schools: ["arcane", "ice", "light"],
    startSkills: ["frost_shard", "haste_spell"], startPassives: ["p_wisdom"],
    learnset: { 3: "slow_time", 5: "mana_shield", 8: "rewind", 12: "time_bomb", 16: "glacial_spike", 22: "time_warp", 30: "stop_time" },
  },
  beastmaster: {
    id: "beastmaster", name: "Thuần Thú Sư", icon: "🐺",
    desc: "Chiến đấu cùng bầy thú: săn theo bầy, gầm uy hiếp và khế ước hoang dã.",
    base: st(112, 36, 21, 10, 12, 10, 108, 10, 8),
    schools: ["bow", "nature", "fist", "spear"],
    startSkills: ["pack_hunt", "hawk_eye"], startPassives: ["p_vanguard"],
    learnset: { 3: "aimed_shot", 5: "bear_roar", 8: "entangle", 12: "primal_bond", 16: "multishot", 22: "snipe", 30: "stampede" },
  },
  dancer: {
    id: "dancer", name: "Vũ Công", icon: "💃",
    desc: "Múa kiếm như múa lụa: né tránh cao, mê hoặc kẻ thù và cổ vũ đồng đội.",
    base: st(92, 46, 17, 15, 9, 12, 120, 12, 18),
    schools: ["song", "wind", "dagger", "water"],
    startSkills: ["sword_dance", "tango"], startPassives: ["p_lucky"],
    learnset: { 3: "feather_step", 5: "healing_waltz", 8: "wind_blade", 12: "flamenco", 16: "war_song", 22: "tailwind", 30: "last_dance" },
  },
  astromancer: {
    id: "astromancer", name: "Chiêm Tinh Sư", icon: "🔭",
    desc: "Đọc vận mệnh trên các vì sao: gọi mưa sao băng, ánh trăng và sao chổi.",
    base: st(86, 62, 8, 24, 8, 16, 100, 8, 5),
    schools: ["light", "arcane", "lightning", "ice"],
    startSkills: ["star_fall", "moonbeam"], startPassives: ["p_holy"],
    learnset: { 3: "holy_light", 5: "spark", 8: "constellation", 12: "comet", 16: "prismatic_ray", 22: "judgment", 30: "supernova" },
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
