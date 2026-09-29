import type { Passive, PassiveHook, School } from "../combat/types";

const list: Passive[] = [];
function P(id: string, name: string, icon: string, school: School, tier: number, desc: string, hooks: PassiveHook[], enemy = false) {
  list.push({ id, name, icon, school, tier, desc, hooks, enemy });
}

// ---- stats
P("p_vigor", "Sinh Lực Dồi Dào", "❤️", "nature", 1, "+15% máu tối đa.", [{ on: "stat", mods: { hp: 0.15 } }]);
P("p_mana_well", "Giếng Ma Lực", "🔹", "arcane", 1, "+20% MP tối đa, hồi thêm 3% MP mỗi lượt.", [{ on: "stat", mods: { mp: 0.2 } }, { on: "turnStart", mpPct: 0.03 }]);
P("p_might", "Sức Mạnh", "💪", "sword", 1, "+12% công.", [{ on: "stat", mods: { atk: 0.12 } }]);
P("p_wisdom", "Thông Tuệ", "📘", "arcane", 1, "+12% phép.", [{ on: "stat", mods: { mag: 0.12 } }]);
P("p_iron_skin", "Da Sắt", "🪖", "shield", 1, "+20% phòng thủ.", [{ on: "stat", mods: { def: 0.2 } }]);
P("p_spirit", "Tinh Thần Thép", "🧠", "light", 1, "+20% kháng phép.", [{ on: "stat", mods: { res: 0.2 } }]);
P("p_swift", "Nhanh Nhẹn", "👟", "wind", 1, "+10% tốc độ.", [{ on: "stat", mods: { spd: 0.1 } }]);
P("p_keen", "Mắt Tinh", "👁️", "bow", 1, "+10% chí mạng.", [{ on: "stat", mods: { crit: 10 } }]);
P("p_nimble", "Thân Pháp", "🍃", "dagger", 1, "+8% né tránh.", [{ on: "stat", mods: { eva: 8 } }]);
P("p_lucky", "Kẻ May Mắn", "🍀", "song", 2, "+5% chí mạng, +5% né.", [{ on: "stat", mods: { crit: 5, eva: 5 } }]);
P("p_colossus", "Người Khổng Lồ", "🗻", "shield", 3, "+30% máu, -10% tốc độ.", [{ on: "stat", mods: { hp: 0.3, spd: -0.1 } }]);

// ---- elemental affinity
P("p_pyro", "Hỏa Pháp Sư", "🔥", "fire", 2, "+25% sát thương lửa.", [{ on: "elemDmg", el: "fire", mult: 1.25 }]);
P("p_cryo", "Băng Pháp Sư", "❄️", "ice", 2, "+25% sát thương băng.", [{ on: "elemDmg", el: "ice", mult: 1.25 }]);
P("p_storm", "Lôi Pháp Sư", "⚡", "lightning", 2, "+25% sát thương sét.", [{ on: "elemDmg", el: "lightning", mult: 1.25 }]);
P("p_hydro", "Thủy Pháp Sư", "💧", "water", 2, "+25% sát thương nước, +15% hồi máu.", [{ on: "elemDmg", el: "water", mult: 1.25 }, { on: "healPower", mult: 1.15 }]);
P("p_geo", "Thổ Pháp Sư", "🪨", "earth", 2, "+25% sát thương đất.", [{ on: "elemDmg", el: "earth", mult: 1.25 }]);
P("p_aero", "Phong Pháp Sư", "🌪️", "wind", 2, "+25% sát thương gió.", [{ on: "elemDmg", el: "wind", mult: 1.25 }]);
P("p_holy", "Thánh Đồ", "☀️", "light", 2, "+25% sát thương ánh sáng.", [{ on: "elemDmg", el: "light", mult: 1.25 }]);
P("p_shadow", "Kẻ Bóng Đêm", "🌑", "dark", 2, "+25% sát thương bóng tối.", [{ on: "elemDmg", el: "dark", mult: 1.25 }]);
P("p_toxic", "Độc Sư", "☠️", "poison", 2, "+25% sát thương độc.", [{ on: "elemDmg", el: "poison", mult: 1.25 }]);
P("p_catalyst", "Chất Xúc Tác", "⚗️", "arcane", 3, "Phản ứng nguyên tố gây thêm 40% sát thương.", [{ on: "reactionDmg", mult: 1.4 }]);
P("p_elementalist", "Nguyên Tố Sư", "🌈", "arcane", 4, "+8% phép, phản ứng nguyên tố +25%.", [{ on: "stat", mods: { mag: 0.08 } }, { on: "reactionDmg", mult: 1.25 }]);

// ---- on-hit
P("p_arsonist", "Kẻ Phóng Hỏa", "🧨", "fire", 2, "Mọi đòn đánh có 25% gây Thiêu đốt.", [{ on: "hitApply", fx: [{ s: "burn", ch: 0.25, t: 3 }] }]);
P("p_frostbite", "Hàn Khí", "🥶", "ice", 2, "Đòn vật lý có 30% gây Tê cóng.", [{ on: "hitApply", kind: "physical", fx: [{ s: "chill", ch: 0.3, t: 3 }] }]);
P("p_venomous", "Nọc Độc Bẩm Sinh", "🐍", "poison", 2, "Đòn vật lý có 30% gây Trúng độc.", [{ on: "hitApply", kind: "physical", fx: [{ s: "poison", ch: 0.3, t: 3 }] }]);
P("p_serrated", "Lưỡi Răng Cưa", "🪚", "sword", 2, "Đòn vật lý có 30% gây Chảy máu.", [{ on: "hitApply", kind: "physical", fx: [{ s: "bleed", ch: 0.3, t: 3 }] }]);
P("p_conductor", "Vật Dẫn Điện", "🔌", "lightning", 2, "Đòn phép có 30% gây Nhiễm điện.", [{ on: "hitApply", kind: "magical", fx: [{ s: "shock", ch: 0.3, t: 3 }] }]);
P("p_soaker", "Mưa Phùn", "🌦️", "water", 2, "Đòn phép có 30% làm Ướt sũng.", [{ on: "hitApply", kind: "magical", fx: [{ s: "wet", ch: 0.3, t: 2 }] }]);

// ---- crit / kill / hurt
P("p_executioner", "Đao Phủ", "🪓", "axe", 3, "Chí mạng gây thêm 50% sát thương.", [{ on: "critDmg", add: 0.5 }]);
P("p_exploit", "Khai Thác Điểm Yếu", "🎯", "dagger", 3, "Chí mạng khiến mục tiêu Dễ tổn thương.", [{ on: "crit", fx: [{ s: "vulnerable", t: 2 }] }]);
P("p_bloodlust", "Khát Máu", "🩸", "axe", 2, "Hạ gục kẻ địch hồi 15% máu.", [{ on: "kill", healPct: 0.15 }]);
P("p_soul_siphon", "Hút Hồn", "👻", "dark", 2, "Hạ gục kẻ địch hồi 20% MP.", [{ on: "kill", mpPct: 0.2 }]);
P("p_momentum", "Đà Chiến Thắng", "🏃", "spear", 3, "Hạ gục kẻ địch nhận Thần tốc.", [{ on: "kill", fx: [{ s: "haste", t: 2, to: "self" }] }]);
P("p_regeneration", "Tự Lành", "🌿", "nature", 2, "Hồi 4% máu mỗi lượt.", [{ on: "turnStart", healPct: 0.04 }]);
P("p_meditative", "Tĩnh Tâm", "🧘", "arcane", 2, "Hồi 6% MP mỗi lượt.", [{ on: "turnStart", mpPct: 0.06 }]);
P("p_thick_hide", "Da Dày", "🦏", "shield", 2, "Bị đánh có 30% nhận Kiên cố.", [{ on: "hurt", ch: 0.3, fx: [{ s: "defUp", t: 2 }] }]);
P("p_vengeance", "Báo Thù", "😤", "sword", 2, "Bị đánh có 30% nhận Cuồng lực.", [{ on: "hurt", ch: 0.3, fx: [{ s: "atkUp", t: 2 }] }]);
P("p_prickly", "Gai Góc", "🌵", "nature", 2, "Bắt đầu trận với Gai phản.", [{ on: "battleStart", fx: [{ s: "thorns", t: 3 }] }]);
P("p_vanguard", "Tiên Phong", "🚩", "spear", 2, "Bắt đầu trận với Thần tốc.", [{ on: "battleStart", fx: [{ s: "haste", t: 2 }] }]);
P("p_warded", "Được Bảo Hộ", "🔰", "light", 2, "Bắt đầu trận với Khiên.", [{ on: "battleStart", fx: [{ s: "shield", t: 3, p: 0.7 }] }]);
P("p_ambusher", "Kẻ Phục Kích", "🥷", "dagger", 3, "Bắt đầu trận với Ẩn thân và Tập trung.", [{ on: "battleStart", fx: [{ s: "stealth", t: 1 }, { s: "focus", t: 2 }] }]);
P("p_last_breath", "Ý Chí Cuối Cùng", "🔥", "shield", 3, "Dưới 30% máu: +30% công và phòng thủ.", [{ on: "lowHp", below: 0.3, mods: { atk: 0.3, def: 0.3 } }]);
P("p_berserker_blood", "Máu Cuồng Chiến", "😡", "axe", 3, "Dưới 50% máu: +40% công, +15% tốc độ.", [{ on: "lowHp", below: 0.5, mods: { atk: 0.4, spd: 0.15 } }]);
P("p_healer", "Bàn Tay Chữa Lành", "🤲", "light", 2, "+30% lượng hồi máu.", [{ on: "healPower", mult: 1.3 }]);
P("p_steadfast", "Kiên Định", "⛰️", "shield", 3, "35% kháng hiệu ứng bất lợi.", [{ on: "debuffResist", ch: 0.35 }]);
P("p_pure_soul", "Linh Hồn Thuần Khiết", "🤍", "light", 2, "20% kháng hiệu ứng bất lợi, +10% kháng phép.", [{ on: "debuffResist", ch: 0.2 }, { on: "stat", mods: { res: 0.1 } }]);
P("p_burn_master", "Chúa Tể Lửa Ngục", "🌋", "fire", 3, "Thiêu đốt gây thêm 50% sát thương.", [{ on: "statusDmg", s: "burn", mult: 1.5 }]);
P("p_bleed_master", "Huyết Tế", "🩸", "dagger", 3, "Chảy máu gây thêm 50% sát thương.", [{ on: "statusDmg", s: "bleed", mult: 1.5 }]);
P("p_plague_master", "Chúa Dịch", "🦠", "poison", 3, "Trúng độc gây thêm 50% sát thương.", [{ on: "statusDmg", s: "poison", mult: 1.5 }]);

// ---- enemy passives
P("e_regen", "Tái Tạo", "🧬", "monster", 1, "Hồi 5% máu mỗi lượt.", [{ on: "turnStart", healPct: 0.05 }], true);
P("e_thorny", "Thân Gai", "🌵", "monster", 1, "Có Gai phản từ đầu trận.", [{ on: "battleStart", fx: [{ s: "thorns", t: 99 }] }], true);
P("e_boss", "Ý Chí Chúa Tể", "👑", "monster", 1, "40% kháng hiệu ứng bất lợi.", [{ on: "debuffResist", ch: 0.4 }], true);
P("e_flying", "Bay Lượn", "🪽", "monster", 1, "+10% né tránh.", [{ on: "stat", mods: { eva: 10 } }], true);
P("e_poison_touch", "Thân Độc", "☠️", "monster", 1, "Đòn đánh có 30% gây Trúng độc.", [{ on: "hitApply", fx: [{ s: "poison", ch: 0.3, t: 3 }] }], true);
P("e_enrage", "Nổi Điên", "💢", "monster", 1, "Dưới 40% máu: +40% công, +20% tốc độ.", [{ on: "lowHp", below: 0.4, mods: { atk: 0.4, mag: 0.4, spd: 0.2 } }], true);

export const PASSIVES: Record<string, Passive> = Object.fromEntries(list.map((p) => [p.id, p]));
export const PLAYER_PASSIVES = list.filter((p) => !p.enemy);

export function getPassive(id: string): Passive {
  const p = PASSIVES[id];
  if (!p) throw new Error(`Unknown passive ${id}`);
  return p;
}
