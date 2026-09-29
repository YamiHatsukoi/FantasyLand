import type { Element, Eff, School, Skill, SkillKind, Special, TargetType } from "../combat/types";

type Opts = Partial<Omit<Skill, "id" | "name" | "icon" | "school" | "el" | "kind" | "target" | "tier" | "mp" | "cd">>;

const list: Skill[] = [];
function S(
  id: string, name: string, icon: string, school: School, el: Element, kind: SkillKind,
  target: TargetType, tier: number, mp: number, cd: number, o: Opts = {},
): void {
  list.push({ id, name, icon, school, el, kind, target, tier, mp, cd, ...o });
}
const fx = (...e: Eff[]) => e;
const sp = (...s: Special[]) => s;

// ------------------------------------------------------------------ core
S("attack", "Tấn công", "⚔️", "sword", "physical", "physical", "enemy", 0, 0, 0, { power: 1, flavor: "Đòn đánh thường. Hồi 8% MP." });
S("defend", "Phòng thủ", "🛡", "shield", "physical", "support", "self", 0, 0, 0, { self: fx({ s: "guard", t: 1 }), flavor: "Giảm 50% sát thương tới lượt sau. Hồi 12% MP." });

// ------------------------------------------------------------------ fire
S("fire_bolt", "Hỏa Cầu", "🔥", "fire", "fire", "magical", "enemy", 1, 6, 0, { power: 1.3, fx: fx({ s: "burn", ch: 0.5, t: 3 }) });
S("ember_rain", "Mưa Tàn Lửa", "🌋", "fire", "fire", "magical", "enemies", 2, 14, 1, { power: 0.7, fx: fx({ s: "burn", ch: 0.35, t: 3 }) });
S("immolate", "Thiêu Rụi", "🕯️", "fire", "fire", "magical", "enemy", 2, 10, 1, { power: 0.6, fx: fx({ s: "burn", t: 3, st: 2 }) });
S("combust", "Kích Nổ", "💥", "fire", "fire", "magical", "enemy", 3, 14, 2, { power: 0.8, sp: sp({ k: "consume", s: "burn", perStack: 0.6 }) });
S("fire_imbue", "Hỏa Ấn Binh Khí", "🗡️", "fire", "fire", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueFire", t: 4 }) });
S("flame_shield", "Giáp Lửa", "🛡️", "fire", "fire", "support", "self", 2, 10, 3, { self: fx({ s: "thorns", t: 3 }, { s: "shield", t: 3, p: 1 }) });
S("phoenix_flame", "Hỏa Phượng Hoàng", "🐦", "fire", "fire", "magical", "enemies", 4, 30, 4, { power: 1.3, fx: fx({ s: "burn", ch: 0.7, t: 3, st: 2 }), self: fx({ s: "regen", t: 3, p: 0.3 }) });
S("inferno", "Hỏa Ngục", "☄️", "fire", "fire", "magical", "enemies", 5, 45, 5, { power: 1.8, fx: fx({ s: "burn", t: 3, st: 2 }), sp: sp({ k: "scaleDebuffs", per: 0.15 }) });

// ------------------------------------------------------------------ ice
S("frost_shard", "Mảnh Băng", "🧊", "ice", "ice", "magical", "enemy", 1, 6, 0, { power: 1.2, fx: fx({ s: "chill", t: 3 }) });
S("frost_nova", "Vòng Băng Giá", "❄️", "ice", "ice", "magical", "enemies", 2, 14, 2, { power: 0.5, fx: fx({ s: "slow", ch: 0.7, t: 2 }, { s: "chill", ch: 0.5, t: 3 }) });
S("blizzard", "Bão Tuyết", "🌨️", "ice", "ice", "magical", "enemies", 3, 20, 2, { power: 0.8, fx: fx({ s: "chill", ch: 0.8, t: 3 }) });
S("glacial_spike", "Giáo Băng Hà", "🔱", "ice", "ice", "magical", "enemy", 3, 16, 2, { power: 1.6, sp: sp({ k: "bonusIf", s: "frozen", mult: 1.8 }) });
S("ice_armor", "Giáp Băng", "🥶", "ice", "ice", "support", "ally", 2, 10, 3, { fx: fx({ s: "defUp", t: 3 }, { s: "shield", t: 3, p: 0.8 }) });
S("ice_imbue", "Băng Ấn Binh Khí", "🗡️", "ice", "ice", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueIce", t: 4 }) });
S("frost_mirror", "Gương Băng", "🪞", "ice", "ice", "support", "self", 3, 12, 4, { self: fx({ s: "reflect", t: 2 }, { s: "barrier", t: 2 }) });
S("absolute_zero", "Độ Không Tuyệt Đối", "🌀", "ice", "ice", "magical", "enemy", 5, 40, 5, { power: 2.2, fx: fx({ s: "chill", t: 3, st: 3 }) });

// ------------------------------------------------------------------ lightning
S("spark", "Tia Điện", "⚡", "lightning", "lightning", "magical", "enemy", 1, 5, 0, { power: 1.1, fx: fx({ s: "shock", ch: 0.7, t: 3 }) });
S("chain_lightning", "Sét Dây Chuyền", "🌩️", "lightning", "lightning", "magical", "random", 2, 12, 1, { power: 0.7, hits: 4, fx: fx({ s: "shock", ch: 0.4, t: 3 }) });
S("static_field", "Trường Tĩnh Điện", "🔌", "lightning", "lightning", "magical", "enemies", 2, 12, 3, { power: 0.3, fx: fx({ s: "shock", t: 3 }) });
S("lightning_imbue", "Lôi Ấn Binh Khí", "🗡️", "lightning", "lightning", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueLightning", t: 4 }, { s: "haste", t: 2 }) });
S("thunderclap", "Sấm Rền", "💥", "lightning", "lightning", "magical", "enemies", 3, 18, 2, { power: 0.9, fx: fx({ s: "stun", ch: 0.15, t: 1 }) });
S("overload", "Quá Tải", "🔋", "lightning", "lightning", "magical", "enemy", 3, 16, 2, { power: 0.7, sp: sp({ k: "consume", s: "shock", perStack: 0.9 }) });
S("thunder_body", "Lôi Thể", "🌟", "lightning", "lightning", "support", "self", 3, 10, 4, { self: fx({ s: "haste", t: 3 }, { s: "evade", t: 2 }) });
S("storm_lord", "Lôi Thần Giáng Thế", "⛈️", "lightning", "lightning", "magical", "enemies", 5, 45, 5, { power: 1.1, hits: 2, fx: fx({ s: "shock", ch: 0.6, t: 3, st: 2 }) });

// ------------------------------------------------------------------ water
S("water_jet", "Tia Nước", "💧", "water", "water", "magical", "enemy", 1, 5, 0, { power: 1.1, fx: fx({ s: "wet", t: 2 }) });
S("soothing_stream", "Dòng Suối Dịu", "🫗", "water", "water", "support", "ally", 1, 8, 0, { heal: 1.6, sp: sp({ k: "cleanse", n: 1 }) });
S("healing_rain", "Mưa Chữa Lành", "🌧️", "water", "water", "support", "allies", 2, 16, 2, { heal: 0.9, fx: fx({ s: "regen", t: 2, p: 0.2 }) });
S("water_imbue", "Thủy Ấn Binh Khí", "🗡️", "water", "water", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueWater", t: 4 }) });
S("tidal_wave", "Sóng Thần", "🌊", "water", "water", "magical", "enemies", 3, 20, 2, { power: 0.9, fx: fx({ s: "wet", t: 2 }, { s: "slow", ch: 0.3, t: 2 }) });
S("bubble_prison", "Ngục Bong Bóng", "🫧", "water", "water", "magical", "enemy", 3, 14, 4, { power: 0.3, fx: fx({ s: "sleep", ch: 0.6, t: 2 }, { s: "wet", t: 2 }) });
S("aqua_veil", "Màn Nước", "🌫️", "water", "water", "support", "allies", 3, 18, 4, { fx: fx({ s: "barrier", t: 3 }, { s: "regen", t: 3, p: 0.15 }) });
S("maelstrom", "Xoáy Nước Vực Thẳm", "🌀", "water", "water", "magical", "enemies", 4, 30, 4, { power: 1.2, fx: fx({ s: "wet", t: 2 }), sp: sp({ k: "delay", amount: 2000 }) });

// ------------------------------------------------------------------ earth
S("stone_spike", "Gai Đá", "🪨", "earth", "earth", "magical", "enemy", 1, 6, 0, { power: 1.3, fx: fx({ s: "armorBreak", ch: 0.3, t: 2 }) });
S("boulder_toss", "Ném Đá Tảng", "🥌", "earth", "earth", "physical", "enemy", 2, 8, 1, { power: 1.5, fx: fx({ s: "stun", ch: 0.2, t: 1 }) });
S("quicksand", "Cát Lún", "⏳", "earth", "earth", "magical", "enemies", 2, 12, 3, { power: 0.4, fx: fx({ s: "rooted", ch: 0.8, t: 2 }, { s: "slow", ch: 0.5, t: 2 }) });
S("stone_skin", "Da Đá", "🗿", "earth", "earth", "support", "ally", 2, 10, 3, { fx: fx({ s: "defUp", t: 3 }, { s: "shield", t: 3, p: 0.6 }) });
S("earth_imbue", "Địa Ấn Binh Khí", "🗡️", "earth", "earth", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueEarth", t: 4 }) });
S("earthquake", "Động Đất", "🏔️", "earth", "earth", "magical", "enemies", 3, 20, 2, { power: 1, fx: fx({ s: "stun", ch: 0.2, t: 1 }) });
S("petrify_gaze", "Ánh Mắt Hóa Đá", "👁️", "earth", "earth", "magical", "enemy", 4, 20, 4, { power: 0.5, fx: fx({ s: "petrify", ch: 0.6, t: 2 }) });
S("meteor", "Thiên Thạch", "☄️", "earth", "earth", "magical", "enemies", 5, 45, 5, { power: 1.9, fx: fx({ s: "stun", ch: 0.3, t: 1 }, { s: "armorBreak", ch: 0.5, t: 2 }) });

// ------------------------------------------------------------------ wind
S("wind_blade", "Phong Nhận", "🍃", "wind", "wind", "magical", "enemy", 1, 5, 0, { power: 0.6, hits: 2 });
S("gust", "Cơn Gió Mạnh", "💨", "wind", "wind", "magical", "enemy", 1, 6, 1, { power: 0.6, sp: sp({ k: "delay", amount: 3000 }) });
S("feather_step", "Bộ Pháp Lông Vũ", "🪶", "wind", "wind", "support", "self", 2, 8, 3, { self: fx({ s: "evade", t: 3 }, { s: "haste", t: 2 }) });
S("wind_imbue", "Phong Ấn Binh Khí", "🗡️", "wind", "wind", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueWind", t: 4 }, { s: "evade", t: 2 }) });
S("cyclone", "Lốc Xoáy", "🌪️", "wind", "wind", "magical", "enemies", 3, 18, 2, { power: 0.8, fx: fx({ s: "slow", ch: 0.3, t: 2 }), sp: sp({ k: "delay", amount: 1200 }) });
S("vacuum", "Chân Không", "🫥", "wind", "wind", "magical", "enemy", 3, 14, 3, { power: 0.9, fx: fx({ s: "silence", ch: 0.6, t: 2 }) });
S("tailwind", "Gió Xuôi", "⛵", "wind", "wind", "support", "allies", 3, 16, 4, { fx: fx({ s: "haste", t: 3 }) });
S("tempest", "Cuồng Phong Thiên Tai", "🌀", "wind", "wind", "magical", "enemies", 5, 40, 5, { power: 0.7, hits: 3 });

// ------------------------------------------------------------------ light
S("holy_light", "Thánh Quang", "☀️", "light", "light", "magical", "enemy", 1, 6, 0, { power: 1.2, fx: fx({ s: "blind", ch: 0.2, t: 2 }), sp: sp({ k: "bonusVsTag", tag: "undead", mult: 2 }) });
S("heal", "Chữa Lành", "💚", "light", "light", "support", "ally", 1, 8, 0, { heal: 1.8 });
S("purify", "Thanh Tẩy", "🕊️", "light", "light", "support", "ally", 2, 8, 1, { heal: 0.6, sp: sp({ k: "cleanse" }) });
S("light_imbue", "Thánh Ấn Binh Khí", "🗡️", "light", "light", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueLight", t: 4 }, { s: "regen", t: 3, p: 0.15 }) });
S("mass_heal", "Hồi Phục Diện Rộng", "💞", "light", "light", "support", "allies", 3, 22, 2, { heal: 1.1 });
S("divine_shield", "Thánh Thuẫn", "🔰", "light", "light", "support", "ally", 3, 14, 3, { fx: fx({ s: "shield", t: 3, p: 1.5 }, { s: "immune", t: 2 }) });
S("resurrection", "Hồi Sinh", "👼", "light", "light", "support", "deadAlly", 4, 30, 5, { sp: sp({ k: "revive", pct: 0.5 }) });
S("sanctuary", "Thánh Địa", "⛪", "light", "light", "support", "allies", 4, 30, 5, { fx: fx({ s: "regen", t: 3, p: 0.35 }, { s: "barrier", t: 3 }) });
S("judgment", "Phán Quyết", "⚖️", "light", "light", "magical", "enemies", 5, 40, 4, { power: 1.5, fx: fx({ s: "blind", ch: 0.3, t: 2 }), sp: sp({ k: "bonusVsTag", tag: "undead", mult: 1.8 }) });

// ------------------------------------------------------------------ dark
S("shadow_bolt", "Tia Bóng Tối", "🌑", "dark", "dark", "magical", "enemy", 1, 6, 0, { power: 1.3, fx: fx({ s: "curse", ch: 0.3, t: 3 }) });
S("drain_life", "Hút Sinh Lực", "🩸", "dark", "dark", "magical", "enemy", 2, 10, 1, { power: 1, sp: sp({ k: "lifesteal", pct: 0.8 }) });
S("curse", "Lời Nguyền", "🕯️", "dark", "dark", "magical", "enemy", 2, 8, 2, { power: 0.2, fx: fx({ s: "curse", t: 3 }, { s: "weaken", ch: 0.7, t: 2 }) });
S("dark_imbue", "Ám Ấn Binh Khí", "🗡️", "dark", "dark", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbueDark", t: 4 }, { s: "lifesteal", t: 3 }) });
S("fear", "Nỗi Sợ Hãi", "😱", "dark", "dark", "magical", "enemies", 3, 16, 3, { power: 0.3, fx: fx({ s: "weaken", ch: 0.6, t: 2 }, { s: "confuse", ch: 0.15, t: 1 }) });
S("hex_transfer", "Chuyển Nguyền", "🔄", "dark", "dark", "magical", "enemy", 3, 12, 3, { power: 0.5, sp: sp({ k: "transfer" }) });
S("doom", "Tuyên Án Tử", "⏳", "dark", "dark", "magical", "enemy", 4, 20, 5, { fx: fx({ s: "doom", t: 3 }) });
S("soul_harvest", "Gặt Linh Hồn", "💀", "dark", "dark", "magical", "enemies", 5, 40, 5, { power: 1.4, sp: sp({ k: "scaleDebuffs", per: 0.2 }, { k: "lifesteal", pct: 0.3 }) });

// ------------------------------------------------------------------ poison
S("toxic_dart", "Phi Tiêu Độc", "🎯", "poison", "poison", "physical", "enemy", 1, 5, 0, { power: 0.9, fx: fx({ s: "poison", t: 3, st: 2 }) });
S("corrosion", "Axit Ăn Mòn", "🧪", "poison", "poison", "magical", "enemy", 2, 10, 2, { power: 0.8, fx: fx({ s: "armorBreak", t: 2 }, { s: "resBreak", t: 2 }) });
S("poison_cloud", "Mây Độc", "☁️", "poison", "poison", "magical", "enemies", 2, 14, 2, { power: 0.3, fx: fx({ s: "poison", ch: 0.9, t: 3, st: 2 }) });
S("poison_imbue", "Tẩm Độc Binh Khí", "🗡️", "poison", "poison", "support", "ally", 2, 8, 3, { fx: fx({ s: "imbuePoison", t: 4 }) });
S("venom_burst", "Bùng Nổ Nọc Độc", "💥", "poison", "poison", "magical", "enemy", 3, 14, 2, { power: 0.5, sp: sp({ k: "consume", s: "poison", perStack: 0.5 }) });
S("plague", "Dịch Bệnh", "🦠", "poison", "poison", "magical", "enemy", 3, 12, 3, { power: 0.3, sp: sp({ k: "spread" }) });
S("neurotoxin", "Độc Thần Kinh", "🐍", "poison", "poison", "magical", "enemy", 4, 18, 4, { power: 0.6, fx: fx({ s: "poison", t: 3, st: 3 }, { s: "stun", ch: 0.4, t: 1 }) });
S("miasma", "Chướng Khí", "🌫️", "poison", "poison", "magical", "enemies", 5, 38, 5, { power: 0.8, fx: fx({ s: "poison", t: 4, st: 4 }, { s: "weaken", ch: 0.5, t: 2 }) });

// ------------------------------------------------------------------ nature
S("thorn_whip", "Roi Gai", "🌿", "nature", "physical", "physical", "enemy", 1, 5, 0, { power: 1, fx: fx({ s: "bleed", ch: 0.5, t: 3 }) });
S("entangle", "Rễ Trói", "🌱", "nature", "earth", "magical", "enemy", 1, 6, 2, { power: 0.3, fx: fx({ s: "rooted", t: 2 }, { s: "slow", ch: 0.5, t: 2 }) });
S("regrowth", "Tái Sinh", "🌸", "nature", "earth", "support", "ally", 1, 8, 0, { heal: 0.6, fx: fx({ s: "regen", t: 3, p: 0.4 }) });
S("barkskin", "Vỏ Cây", "🪵", "nature", "earth", "support", "ally", 2, 8, 3, { fx: fx({ s: "defUp", t: 3 }, { s: "thorns", t: 3 }) });
S("spore_cloud", "Bào Tử Ngủ", "🍄", "nature", "poison", "magical", "enemies", 3, 16, 4, { power: 0.1, fx: fx({ s: "sleep", ch: 0.45, t: 2 }) });
S("wild_growth", "Sinh Trưởng Hoang Dã", "🌳", "nature", "earth", "support", "allies", 4, 24, 4, { fx: fx({ s: "regen", t: 3, p: 0.3 }, { s: "atkUp", t: 2 }) });
S("natures_wrath", "Thịnh Nộ Thiên Nhiên", "🌲", "nature", "earth", "magical", "enemies", 5, 40, 5, { power: 1.4, fx: fx({ s: "rooted", ch: 0.6, t: 2 }, { s: "bleed", ch: 0.5, t: 3, st: 2 }) });

// ------------------------------------------------------------------ arcane
S("magic_missile", "Phi Đạn Ma Thuật", "✴️", "arcane", "arcane", "magical", "random", 1, 6, 0, { power: 0.5, hits: 3 });
S("mana_burn", "Đốt Ma Lực", "🔹", "arcane", "arcane", "magical", "enemy", 2, 8, 1, { power: 0.8, sp: sp({ k: "drainMp", pct: 0.3 }) });
S("dispel", "Hóa Giải", "🚫", "arcane", "arcane", "magical", "enemy", 2, 8, 2, { power: 0.4, sp: sp({ k: "dispel" }) });
S("mana_shield", "Khiên Ma Lực", "🔷", "arcane", "arcane", "support", "self", 2, 12, 3, { self: fx({ s: "shield", t: 3, p: 1.8 }) });
S("silence_spell", "Phong Ấn", "🤐", "arcane", "arcane", "magical", "enemy", 2, 10, 3, { power: 0.3, fx: fx({ s: "silence", ch: 0.9, t: 2 }) });
S("arcane_surge", "Bão Ma Pháp", "🔮", "arcane", "arcane", "support", "self", 3, 10, 4, { self: fx({ s: "magUp", t: 3 }, { s: "manaRegen", t: 3 }, { s: "empower", t: 2 }) });
S("prismatic_ray", "Tia Lăng Kính", "🌈", "arcane", "arcane", "magical", "enemy", 3, 16, 2, { power: 0.6, hits: 3, sp: sp({ k: "randomElement" }) });
S("mirror_image", "Phân Thân Ảo Ảnh", "👥", "arcane", "arcane", "support", "self", 3, 14, 4, { self: fx({ s: "evade", t: 3 }, { s: "stealth", t: 1 }) });
S("arcane_blast", "Nổ Tung Huyền Bí", "💠", "arcane", "arcane", "magical", "enemy", 4, 24, 3, { power: 2.4 });
S("time_warp", "Bẻ Cong Thời Gian", "⌛", "arcane", "arcane", "support", "allies", 5, 35, 6, { fx: fx({ s: "haste", t: 2 }), sp: sp({ k: "advance", amount: 5000 }) });

// ------------------------------------------------------------------ song
S("inspire", "Cổ Vũ", "🎵", "song", "light", "support", "ally", 1, 8, 2, { fx: fx({ s: "empower", t: 2 }), sp: sp({ k: "mpRestore", pct: 0.15 }) });
S("war_song", "Chiến Ca", "🥁", "song", "physical", "support", "allies", 2, 14, 3, { fx: fx({ s: "atkUp", t: 3 }) });
S("battle_cry", "Tiếng Thét Xung Trận", "📯", "song", "physical", "support", "allies", 2, 10, 4, { fx: fx({ s: "focus", t: 2 }), sp: sp({ k: "advance", amount: 2500 }) });
S("lullaby", "Khúc Ru", "🎶", "song", "arcane", "magical", "enemies", 3, 16, 4, { fx: fx({ s: "sleep", ch: 0.35, t: 2 }) });
S("hymn", "Thánh Ca Hộ Mệnh", "🎼", "song", "light", "support", "allies", 3, 16, 4, { fx: fx({ s: "defUp", t: 3 }, { s: "regen", t: 3, p: 0.15 }) });
S("dirge", "Khúc Tang Thương", "🎻", "song", "dark", "magical", "enemies", 3, 16, 3, { power: 0.4, fx: fx({ s: "weaken", ch: 0.6, t: 2 }, { s: "vulnerable", ch: 0.4, t: 2 }) });

// ------------------------------------------------------------------ sword
S("slash", "Chém Mạnh", "🗡️", "sword", "physical", "physical", "enemy", 1, 4, 0, { power: 1.5 });
S("cross_slash", "Thập Tự Trảm", "✖️", "sword", "physical", "physical", "enemy", 2, 8, 1, { power: 0.9, hits: 2, fx: fx({ s: "bleed", ch: 0.4, t: 3 }) });
S("rending", "Xé Giáp", "🔪", "sword", "physical", "physical", "enemy", 2, 8, 2, { power: 1.1, fx: fx({ s: "armorBreak", t: 2 }) });
S("whirlwind", "Cuồng Phong Kiếm", "🌀", "sword", "physical", "physical", "enemies", 2, 12, 2, { power: 0.9 });
S("parry", "Thế Đỡ Gạt", "🤺", "sword", "physical", "support", "self", 2, 6, 3, { self: fx({ s: "counter", t: 2 }, { s: "guard", t: 1 }) });
S("blade_dance", "Kiếm Vũ", "💃", "sword", "physical", "physical", "random", 3, 16, 3, { power: 0.55, hits: 5 });
S("execution", "Trảm Quyết", "⚰️", "sword", "physical", "physical", "enemy", 4, 18, 3, { power: 1.4, sp: sp({ k: "execute", below: 0.35, mult: 2.2 }) });
S("sword_saint", "Kiếm Thánh Nhất Thiểm", "⚡", "sword", "physical", "physical", "enemy", 5, 35, 5, { power: 3.2, sp: sp({ k: "bonusIf", s: "mark", mult: 1.3 }) });

// ------------------------------------------------------------------ axe
S("cleave", "Bổ Rìu", "🪓", "axe", "physical", "physical", "enemies", 1, 6, 1, { power: 0.8 });
S("skull_crack", "Đập Sọ", "💀", "axe", "physical", "physical", "enemy", 2, 8, 2, { power: 1.3, fx: fx({ s: "stun", ch: 0.35, t: 1 }) });
S("berserk", "Cuồng Chiến", "😡", "axe", "physical", "support", "self", 3, 8, 4, { hpCost: 0.1, self: fx({ s: "berserk", t: 3 }) });
S("rampage", "Tàn Sát", "🩸", "axe", "physical", "physical", "random", 3, 14, 3, { power: 0.8, hits: 4 });
S("blood_axe", "Rìu Máu", "🪓", "axe", "physical", "physical", "enemy", 3, 12, 2, { power: 1.4, sp: sp({ k: "missingHp", mult: 1 }, { k: "lifesteal", pct: 0.3 }) });
S("earthsplitter", "Chẻ Núi", "⛰️", "axe", "earth", "physical", "enemies", 5, 38, 5, { power: 1.8, fx: fx({ s: "stun", ch: 0.3, t: 1 }, { s: "armorBreak", ch: 0.5, t: 2 }) });

// ------------------------------------------------------------------ spear
S("thrust", "Đâm Xuyên", "🔱", "spear", "physical", "physical", "enemy", 1, 4, 0, { power: 1.3, fx: fx({ s: "armorBreak", ch: 0.25, t: 2 }) });
S("sweep", "Quét Ngang", "〰️", "spear", "physical", "physical", "enemies", 2, 10, 1, { power: 0.7, fx: fx({ s: "slow", ch: 0.3, t: 2 }) });
S("impale", "Xiên Thủng", "📍", "spear", "physical", "physical", "enemy", 3, 12, 2, { power: 1.2, fx: fx({ s: "bleed", ch: 0.8, t: 3, st: 2 }) });
S("dragon_leap", "Long Khiêu", "🐉", "spear", "physical", "physical", "enemy", 3, 14, 3, { power: 2, self: fx({ s: "evade", t: 1 }) });
S("phalanx", "Trận Thương", "🛡️", "spear", "physical", "support", "allies", 3, 16, 4, { fx: fx({ s: "defUp", t: 2 }, { s: "counter", t: 2 }) });
S("heavens_pierce", "Thiên Thương", "🌠", "spear", "physical", "physical", "enemy", 5, 35, 5, { power: 2.8, fx: fx({ s: "armorBreak", t: 2 }, { s: "resBreak", t: 2 }) });

// ------------------------------------------------------------------ bow
S("aimed_shot", "Ngắm Bắn", "🏹", "bow", "physical", "physical", "enemy", 1, 5, 0, { power: 1.4 });
S("poison_arrow", "Tên Độc", "🏹", "bow", "poison", "physical", "enemy", 1, 6, 1, { power: 1, fx: fx({ s: "poison", t: 3, st: 2 }) });
S("multishot", "Mưa Tên", "🎇", "bow", "physical", "physical", "enemies", 2, 12, 1, { power: 0.75 });
S("hunters_mark", "Dấu Thợ Săn", "❌", "bow", "physical", "physical", "enemy", 2, 6, 3, { power: 0.4, fx: fx({ s: "mark", t: 2 }) });
S("fire_arrow", "Hỏa Tiễn", "🔥", "bow", "fire", "physical", "enemy", 2, 8, 1, { power: 1.2, fx: fx({ s: "burn", ch: 0.6, t: 3 }) });
S("pinning_shot", "Ghim Chặt", "📌", "bow", "physical", "physical", "enemy", 2, 8, 2, { power: 1, fx: fx({ s: "rooted", t: 2 }) });
S("snipe", "Bắn Tỉa", "🎯", "bow", "physical", "physical", "enemy", 3, 14, 2, { power: 2.2 });
S("volley", "Vạn Tiễn Tề Phát", "🌧️", "bow", "physical", "physical", "random", 4, 20, 3, { power: 0.6, hits: 6 });
S("storm_arrow", "Lôi Tiễn Phá Không", "⚡", "bow", "lightning", "physical", "enemies", 5, 36, 5, { power: 1.6, fx: fx({ s: "shock", t: 3, st: 2 }) });

// ------------------------------------------------------------------ dagger
S("backstab", "Đâm Hiểm", "🔪", "dagger", "physical", "physical", "enemy", 1, 5, 0, { power: 1.1, sp: sp({ k: "scaleDebuffs", per: 0.25 }) });
S("lacerate", "Rạch Toác", "🩸", "dagger", "physical", "physical", "enemy", 1, 6, 0, { power: 0.6, hits: 2, fx: fx({ s: "bleed", ch: 0.6, t: 3 }) });
S("shadow_step", "Bộ Bóng", "👤", "dagger", "dark", "support", "self", 2, 8, 4, { self: fx({ s: "stealth", t: 2 }, { s: "focus", t: 2 }) });
S("smoke_bomb", "Bom Khói", "💨", "dagger", "physical", "support", "enemies", 2, 10, 4, { fx: fx({ s: "blind", ch: 0.8, t: 2 }) });
S("envenom", "Tẩm Nọc", "🐍", "dagger", "poison", "support", "self", 2, 6, 3, { self: fx({ s: "imbuePoison", t: 4 }, { s: "focus", t: 2 }) });
S("hemorrhage", "Xuất Huyết", "💉", "dagger", "physical", "physical", "enemy", 3, 10, 2, { power: 0.4, sp: sp({ k: "consume", s: "bleed", perStack: 0.8 }) });
S("quick_strike", "Đòn Chớp Nhoáng", "⚡", "dagger", "physical", "physical", "enemy", 3, 10, 3, { power: 0.9, sp: sp({ k: "extraTurn" }) });
S("assassinate", "Ám Sát", "☠️", "dagger", "physical", "physical", "enemy", 4, 20, 4, { power: 2, sp: sp({ k: "execute", below: 0.3, mult: 2.5 }) });
S("thousand_cuts", "Thiên Đao Vạn Quả", "🌸", "dagger", "physical", "physical", "enemy", 5, 35, 5, { power: 0.45, hits: 8, fx: fx({ s: "bleed", ch: 0.4, t: 3 }) });

// ------------------------------------------------------------------ fist
S("jab", "Liên Quyền", "👊", "fist", "physical", "physical", "enemy", 1, 4, 0, { power: 0.45, hits: 3 });
S("palm_strike", "Chưởng Kích", "🖐️", "fist", "physical", "physical", "enemy", 2, 8, 2, { power: 1.2, sp: sp({ k: "delay", amount: 2500 }) });
S("iron_body", "Thiết Bố Sam", "🧱", "fist", "physical", "support", "self", 2, 8, 3, { self: fx({ s: "defUp", t: 3 }, { s: "counter", t: 2 }) });
S("meditation", "Thiền Định", "🧘", "fist", "arcane", "support", "self", 2, 0, 4, { self: fx({ s: "regen", t: 2, p: 0.3 }), sp: sp({ k: "mpRestore", pct: 0.3 }) });
S("chi_burst", "Khí Công Bạo Phát", "🌀", "fist", "arcane", "physical", "enemies", 3, 16, 3, { power: 1 });
S("hundred_fists", "Bách Liệt Quyền", "💥", "fist", "physical", "physical", "random", 4, 22, 4, { power: 0.3, hits: 10 });

// ------------------------------------------------------------------ shield
S("shield_bash", "Đập Khiên", "🛡️", "shield", "physical", "physical", "enemy", 1, 5, 1, { power: 0.9, fx: fx({ s: "stun", ch: 0.25, t: 1 }), sp: sp({ k: "useDef" }) });
S("taunt", "Khiêu Khích", "📢", "shield", "physical", "support", "self", 1, 4, 3, { self: fx({ s: "taunt", t: 2 }, { s: "defUp", t: 2 }) });
S("guardian_oath", "Lời Thề Hộ Vệ", "🫡", "shield", "physical", "support", "self", 2, 8, 3, { self: fx({ s: "thorns", t: 3 }, { s: "guard", t: 1 }, { s: "taunt", t: 1 }) });
S("bulwark", "Thành Lũy", "🏰", "shield", "earth", "support", "allies", 3, 14, 4, { fx: fx({ s: "shield", t: 3, p: 0.8 }), sp: sp({ k: "useDef" }) });
S("holy_bash", "Thánh Khiên Kích", "✨", "shield", "light", "physical", "enemy", 3, 12, 2, { power: 1.2, fx: fx({ s: "blind", ch: 0.3, t: 2 }), sp: sp({ k: "useDef" }) });
S("last_stand", "Tử Thủ", "🏳️", "shield", "physical", "support", "self", 4, 10, 6, { self: fx({ s: "immune", t: 2 }, { s: "defUp", t: 3 }, { s: "regen", t: 3, p: 0.4 }) });
S("aegis", "Khiên Bất Diệt", "🌐", "shield", "light", "support", "allies", 5, 35, 6, { fx: fx({ s: "barrier", t: 3 }, { s: "shield", t: 3, p: 1.2 }, { s: "immune", t: 1 }), sp: sp({ k: "useDef" }) });

// ------------------------------------------------------------------ monsters (enemy-only)
const M = (id: string, name: string, icon: string, el: Element, kind: SkillKind, target: TargetType, mp: number, cd: number, o: Opts = {}) =>
  S(id, name, icon, "monster", el, kind, target, 1, mp, cd, { enemy: true, ...o });

M("bite", "Cắn Xé", "🦷", "physical", "physical", "enemy", 0, 0, { power: 1.1, fx: fx({ s: "bleed", ch: 0.2, t: 3 }) });
M("claw", "Vuốt Cào", "🐾", "physical", "physical", "enemy", 0, 0, { power: 0.6, hits: 2 });
M("slime_spit", "Phun Nhớt", "💦", "water", "magical", "enemy", 4, 1, { power: 0.8, fx: fx({ s: "wet", t: 2 }, { s: "slow", ch: 0.3, t: 2 }) });
M("acid_splash", "Tạt Axit", "🧪", "poison", "magical", "enemy", 5, 2, { power: 0.7, fx: fx({ s: "armorBreak", ch: 0.6, t: 2 }) });
M("howl", "Tru Tréo", "🐺", "physical", "support", "allies", 5, 4, { fx: fx({ s: "atkUp", t: 2 }) });
M("web", "Giăng Tơ", "🕸️", "physical", "physical", "enemy", 4, 3, { power: 0.3, fx: fx({ s: "rooted", ch: 0.8, t: 2 }, { s: "slow", t: 2 }) });
M("sting", "Chích Độc", "🦂", "poison", "physical", "enemy", 3, 1, { power: 0.8, fx: fx({ s: "poison", t: 3, st: 2 }) });
M("spore_puff", "Phụt Bào Tử", "🍄", "poison", "magical", "enemies", 6, 4, { power: 0.2, fx: fx({ s: "sleep", ch: 0.25, t: 1 }, { s: "poison", ch: 0.5, t: 3 }) });
M("screech", "Rít Chói Tai", "🦇", "arcane", "magical", "enemies", 5, 3, { power: 0.3, fx: fx({ s: "silence", ch: 0.3, t: 1 }) });
M("charge", "Húc Mạnh", "🐗", "physical", "physical", "enemy", 4, 2, { power: 1.6, fx: fx({ s: "stun", ch: 0.2, t: 1 }) });
M("sand_blast", "Phun Cát", "🏜️", "earth", "magical", "enemy", 4, 2, { power: 0.8, fx: fx({ s: "blind", ch: 0.5, t: 2 }) });
M("tail_sweep", "Quật Đuôi", "🦎", "physical", "physical", "enemies", 5, 2, { power: 0.8 });
M("burrow", "Độn Thổ", "🕳️", "earth", "support", "self", 4, 4, { self: fx({ s: "evade", t: 2 }, { s: "stealth", t: 1 }) });
M("regenerate", "Tái Tạo", "🧬", "earth", "support", "self", 5, 4, { heal: 1.2, self: fx({ s: "regen", t: 3, p: 0.3 }) });
M("life_drain", "Hút Máu", "🦇", "dark", "magical", "enemy", 5, 2, { power: 0.9, sp: sp({ k: "lifesteal", pct: 0.6 }) });
M("mummy_curse", "Lời Nguyền Xác Ướp", "🧟", "dark", "magical", "enemy", 6, 3, { power: 0.4, fx: fx({ s: "curse", t: 3 }, { s: "weaken", ch: 0.5, t: 2 }) });
M("sandstorm", "Bão Cát", "🌪️", "earth", "magical", "enemies", 8, 3, { power: 0.7, fx: fx({ s: "blind", ch: 0.3, t: 2 }) });
M("quake_stomp", "Dậm Đất", "🦶", "earth", "physical", "enemies", 8, 3, { power: 1, fx: fx({ s: "stun", ch: 0.25, t: 1 }) });
M("wisp_fire", "Lửa Ma Trơi", "👻", "fire", "magical", "enemy", 4, 1, { power: 0.9, fx: fx({ s: "burn", ch: 0.6, t: 3 }, { s: "confuse", ch: 0.15, t: 1 }) });
M("swamp_gas", "Khí Đầm Lầy", "🫧", "poison", "magical", "enemies", 6, 3, { power: 0.4, fx: fx({ s: "poison", ch: 0.8, t: 3 }) });
M("drown", "Dìm Nước", "🌊", "water", "magical", "enemy", 5, 2, { power: 1.3, fx: fx({ s: "wet", t: 2 }) });
M("hex", "Bùa Ếm", "🪬", "dark", "magical", "enemy", 6, 4, { power: 0.3, fx: fx({ s: "curse", t: 3 }, { s: "doom", ch: 0.3, t: 3 }) });
M("root_slam", "Rễ Quật", "🌳", "earth", "physical", "enemy", 4, 1, { power: 1.3, fx: fx({ s: "rooted", ch: 0.5, t: 2 }) });
M("pincer", "Kẹp Càng", "🦀", "physical", "physical", "enemy", 3, 1, { power: 1.2, fx: fx({ s: "armorBreak", ch: 0.3, t: 2 }) });
M("shell_up", "Thu Mình Vào Mai", "🐚", "physical", "support", "self", 3, 3, { self: fx({ s: "defUp", t: 2 }, { s: "guard", t: 1 }) });
M("frost_breath", "Hơi Thở Băng", "🥶", "ice", "magical", "enemies", 8, 3, { power: 0.8, fx: fx({ s: "chill", ch: 0.7, t: 3 }) });
M("fire_breath", "Hơi Thở Lửa", "🐲", "fire", "magical", "enemies", 8, 3, { power: 0.9, fx: fx({ s: "burn", ch: 0.6, t: 3 }) });
M("static_touch", "Chạm Điện", "⚡", "lightning", "magical", "enemy", 4, 1, { power: 1, fx: fx({ s: "shock", t: 3 }) });
// bosses
M("ancient_roots", "Rễ Cổ Thụ", "🌲", "earth", "magical", "enemies", 10, 3, { power: 1.1, fx: fx({ s: "rooted", ch: 0.5, t: 2 }) });
M("forest_blessing", "Phúc Lành Của Rừng", "🍀", "earth", "support", "allies", 10, 5, { heal: 0.6, fx: fx({ s: "regen", t: 2, p: 0.2 }) });
M("devour", "Nuốt Chửng", "🪱", "physical", "physical", "enemy", 10, 3, { power: 2.2, sp: sp({ k: "lifesteal", pct: 0.5 }) });
M("dune_collapse", "Đồi Cát Sụp Đổ", "🏜️", "earth", "magical", "enemies", 12, 3, { power: 1.1, fx: fx({ s: "slow", ch: 0.6, t: 2 }, { s: "blind", ch: 0.3, t: 2 }) });
M("tidal_curse", "Nguyền Thủy Triều", "🌊", "water", "magical", "enemies", 12, 3, { power: 1, fx: fx({ s: "wet", t: 2 }, { s: "curse", ch: 0.5, t: 3 }) });
M("lantern_soul", "Hồn Đèn Lồng", "🏮", "dark", "magical", "enemy", 8, 2, { power: 1.6, sp: sp({ k: "drainMp", pct: 0.3 }) });
M("roar", "Gầm Thét", "🦁", "physical", "support", "allies", 8, 4, { fx: fx({ s: "atkUp", t: 3 }, { s: "defUp", t: 3 }) });
M("rage", "Phẫn Nộ", "💢", "physical", "support", "self", 6, 5, { self: fx({ s: "berserk", t: 3 }, { s: "empower", t: 2 }) });
M("crushing_blow", "Đòn Nghiền Nát", "🔨", "physical", "physical", "enemy", 8, 2, { power: 2.2, fx: fx({ s: "armorBreak", t: 2 }) });
M("cataclysm", "Đại Hồng Thủy Ma Lực", "🌋", "arcane", "magical", "enemies", 14, 4, { power: 1.5, sp: sp({ k: "randomElement" }) });

export const SKILLS: Record<string, Skill> = Object.fromEntries(list.map((s) => [s.id, s]));
export const PLAYER_SKILLS = list.filter((s) => !s.enemy && s.tier > 0);

export function getSkill(id: string): Skill {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill ${id}`);
  return s;
}

export const SCHOOL_NAMES: Record<School, string> = {
  sword: "Kiếm", axe: "Rìu", spear: "Thương", bow: "Cung", dagger: "Dao găm", fist: "Quyền",
  shield: "Khiên", fire: "Hỏa", ice: "Băng", lightning: "Lôi", water: "Thủy", earth: "Thổ",
  wind: "Phong", light: "Thánh", dark: "Ám", poison: "Độc", nature: "Tự nhiên", arcane: "Huyền bí",
  song: "Ca khúc", monster: "Quái vật",
};
