import type { PassiveHook } from "../combat/types";

/**
 * Each class's gift: one thing only that class does. It is either something about the
 * character themself (an inborn passive that takes no slot, or more room for skills and
 * passives), or something the whole party gains while they travel together (more pets,
 * sharper eyes in the Abyss, more gold or experience...). The same party gift does not stack
 * when two of a class travel together.
 */
export interface ClassTrait {
  name: string;
  icon: string;
  desc: string;
  /** Inborn passive: always on, takes no passive slot. */
  hooks?: PassiveHook[];
  /** Extra active-skill / passive slots for this character. */
  skillSlots?: number;
  passiveSlots?: number;
  /** Extra pets the party can bring along. */
  pets?: number;
  /** Gifts to the whole party. */
  party?: { gold?: number; xp?: number; sight?: number; scan?: boolean; forage?: number };
}

export const TRAITS: Record<string, ClassTrait> = {
  warrior: { name: "Bách Chiến", icon: "⚔️", desc: "Thêm 1 ô nội tại; +10% máu; bị đánh 15% thủ thế Phản đòn; hạ gục kẻ địch nhận Cuồng lực.", passiveSlots: 1,
    hooks: [{ on: "stat", mods: { hp: 0.1 } }, { on: "hurt", ch: 0.15, fx: [{ s: "counter", t: 1 }] }, { on: "kill", fx: [{ s: "atkUp", t: 2 }] }] },
  mage: { name: "Thư Viện Di Động", icon: "📚", desc: "Thêm 2 ô kỹ năng; +15% phép; hồi 5% MP mỗi lượt.", skillSlots: 2,
    hooks: [{ on: "stat", mods: { mag: 0.15 } }, { on: "turnStart", mpPct: 0.05 }] },
  ranger: { name: "Mắt Ưng", icon: "🦅", desc: "Cả đội nhìn xa thêm 2 ô dưới Vực Sâu; +8 chí mạng; chí mạng Đánh dấu mục tiêu (cả đội đánh nó đau hơn).", party: { sight: 2 },
    hooks: [{ on: "stat", mods: { crit: 8 } }, { on: "crit", fx: [{ s: "mark", t: 2 }] }] },
  rogue: { name: "Đâm Lén", icon: "🗡️", desc: "+10 chí mạng; chí mạng khiến mục tiêu Chảy máu và Dễ tổn thương; cả đội nhận thêm 25% vàng sau trận.", party: { gold: 0.25 },
    hooks: [{ on: "stat", mods: { crit: 10 } }, { on: "crit", fx: [{ s: "bleed", t: 3 }, { s: "vulnerable", t: 2 }] }] },
  cleric: { name: "Phước Lành", icon: "🙏", desc: "Phép hồi máu mạnh hơn 25%; vào trận cả đội được Hồi phục 3 lượt; kháng 20% hiệu ứng bất lợi.",
    hooks: [{ on: "healPower", mult: 1.25 }, { on: "battleStart", fx: [{ s: "regen", t: 3, to: "allies" }] }, { on: "debuffResist", ch: 0.2 }] },
  guardian: { name: "Thành Lũy", icon: "🏰", desc: "Vào trận với Khiên và Khiêu khích kẻ địch về mình; bị đánh 20% nhận Kiên cố.",
    hooks: [{ on: "battleStart", fx: [{ s: "shield", t: 3, p: 0.9 }, { s: "taunt", t: 2 }] }, { on: "hurt", ch: 0.2, fx: [{ s: "defUp", t: 2 }] }] },
  witch: { name: "Lời Nguyền", icon: "🕯️", desc: "Đòn phép 30% Nguyền rủa mục tiêu; +25% sát thương độc; vào trận mọi kẻ địch bị Suy yếu.",
    hooks: [{ on: "hitApply", kind: "magical", fx: [{ s: "curse", ch: 0.3, t: 3 }] }, { on: "elemDmg", el: "poison", mult: 1.25 }, { on: "battleStart", fx: [{ s: "weaken", t: 2, ch: 0.6, to: "enemies" }] }] },
  monk: { name: "Nội Công", icon: "☯️", desc: "Mỗi lượt hồi 3% máu và 4% MP; +6 né tránh; bị đánh 30% thủ thế Phản đòn.",
    hooks: [{ on: "turnStart", healPct: 0.03, mpPct: 0.04 }, { on: "stat", mods: { eva: 6 } }, { on: "hurt", ch: 0.3, fx: [{ s: "counter", t: 1 }] }] },
  paladin: { name: "Thánh Giáp", icon: "🛡️", desc: "Vào trận cả đội được một lớp Khiên thánh; kháng 35% hiệu ứng bất lợi; +10% kháng phép.",
    hooks: [{ on: "battleStart", fx: [{ s: "shield", t: 2, p: 0.45, to: "allies" }] }, { on: "debuffResist", ch: 0.35 }, { on: "stat", mods: { res: 0.1 } }] },
  bard: { name: "Khúc Khải Hoàn", icon: "🎶", desc: "Vào trận cả đội được cổ vũ: Cuồng lực và Phép lực 2 lượt; cả đội nhận thêm 20% kinh nghiệm.", party: { xp: 0.2 },
    hooks: [{ on: "battleStart", fx: [{ s: "atkUp", t: 2, to: "allies" }, { s: "magUp", t: 2, to: "allies" }] }] },
  necromancer: { name: "Hút Linh Hồn", icon: "💀", desc: "Hạ gục kẻ địch hồi 10% máu, 15% MP và nhận Phép lực; +20% sát thương bóng tối.",
    hooks: [{ on: "kill", healPct: 0.1, mpPct: 0.15, fx: [{ s: "magUp", t: 2 }] }, { on: "elemDmg", el: "dark", mult: 1.2 }] },
  druid: { name: "Con Của Rừng", icon: "🌳", desc: "Cả đội mang theo thêm 1 thú cưng; hồi 3% máu mỗi lượt; +20% sát thương đất; vào trận có Gai phản.", pets: 1,
    hooks: [{ on: "turnStart", healPct: 0.03 }, { on: "elemDmg", el: "earth", mult: 1.2 }, { on: "battleStart", fx: [{ s: "thorns", t: 3 }] }] },
  spellblade: { name: "Song Tu", icon: "🌀", desc: "Thêm 1 ô kỹ năng và 1 ô nội tại; chém trúng thì nhận Phép lực, phép trúng thì nhận Cuồng lực: đan xen kiếm và phép.", skillSlots: 1, passiveSlots: 1,
    hooks: [{ on: "hitApply", kind: "physical", fx: [{ s: "magUp", t: 2, to: "self" }] }, { on: "hitApply", kind: "magical", fx: [{ s: "atkUp", t: 2, to: "self" }] }] },
  dragoon: { name: "Xung Phong", icon: "🐲", desc: "Vào trận với Thần tốc và Cuồng lực; +6 chí mạng; hạ gục kẻ địch lại nhận Thần tốc.",
    hooks: [{ on: "battleStart", fx: [{ s: "haste", t: 2 }, { s: "atkUp", t: 2 }] }, { on: "stat", mods: { crit: 6 } }, { on: "kill", fx: [{ s: "haste", t: 2 }] }] },
  samurai: { name: "Nhất Kích Tất Sát", icon: "🎴", desc: "+10 chí mạng, chí mạng gây thêm 50% sát thương; vào trận và mỗi lần hạ gục kẻ địch đều nhận Tập trung (+25 chí mạng).",
    hooks: [{ on: "stat", mods: { crit: 10 } }, { on: "critDmg", add: 0.5 }, { on: "battleStart", fx: [{ s: "focus", t: 2 }] }, { on: "kill", fx: [{ s: "focus", t: 2, to: "self" }] }] },
  ninja: { name: "Ẩn Thân Thuật", icon: "🌫️", desc: "Vào trận Ẩn thân; +6 né tránh; đòn vật lý 30% gây Trúng độc; hạ gục kẻ địch lại Ẩn thân.",
    hooks: [{ on: "battleStart", fx: [{ s: "stealth", t: 1 }] }, { on: "stat", mods: { eva: 6 } }, { on: "hitApply", kind: "physical", fx: [{ s: "poison", ch: 0.3, t: 3 }] }, { on: "kill", fx: [{ s: "stealth", t: 1 }] }] },
  alchemist: { name: "Túi Thuốc", icon: "⚗️", desc: "Thêm 1 ô kỹ năng; đòn đánh 30% hắt Dầu lên mục tiêu (bén lửa); phản ứng nguyên tố +20%; sau trận thắng 40% chế ra một lọ thuốc.", party: { forage: 0.4 }, skillSlots: 1,
    hooks: [{ on: "hitApply", fx: [{ s: "oil", ch: 0.3, t: 3 }] }, { on: "reactionDmg", mult: 1.2 }] },
  summoner: { name: "Khế Ước", icon: "📿", desc: "Cả đội mang theo thêm 1 thú cưng; thêm 1 ô kỹ năng; +12% phép; vào trận có Kết giới.", pets: 1, skillSlots: 1,
    hooks: [{ on: "stat", mods: { mag: 0.12 } }, { on: "battleStart", fx: [{ s: "barrier", t: 2 }] }] },
  berserker: { name: "Cuồng Nộ", icon: "😡", desc: "Dưới 50% máu: +35% công và +10% tốc độ; bị đánh 30% nhận Cuồng lực; hạ gục kẻ địch hồi 12% máu.",
    hooks: [{ on: "lowHp", below: 0.5, mods: { atk: 0.35, spd: 0.1 } }, { on: "hurt", ch: 0.3, fx: [{ s: "atkUp", t: 2 }] }, { on: "kill", healPct: 0.12 }] },
  shaman: { name: "Thông Linh", icon: "🪶", desc: "Phản ứng nguyên tố +30%; +10% phép; đòn phép 30% làm Ướt sũng (dễ dính phản ứng).",
    hooks: [{ on: "reactionDmg", mult: 1.3 }, { on: "stat", mods: { mag: 0.1 } }, { on: "hitApply", kind: "magical", fx: [{ s: "wet", ch: 0.3, t: 2 }] }] },
  chronomancer: { name: "Nhịp Thời Gian", icon: "⏳", desc: "Vào trận cả đội được Thần tốc, mọi kẻ địch bị Chậm; +10% tốc độ.",
    hooks: [{ on: "battleStart", fx: [{ s: "haste", t: 2, to: "allies" }, { s: "slow", t: 2, ch: 0.7, to: "enemies" }] }, { on: "stat", mods: { spd: 0.1 } }] },
  beastmaster: { name: "Đầu Đàn", icon: "🐺", desc: "Cả đội mang theo thêm 2 thú cưng cùng lúc (tối đa 3); +10% công và máu; vào trận có Cuồng lực.", pets: 2,
    hooks: [{ on: "stat", mods: { atk: 0.1, hp: 0.1 } }, { on: "battleStart", fx: [{ s: "atkUp", t: 2 }] }] },
  dancer: { name: "Bước Nhảy", icon: "💃", desc: "+8 né tránh; bị đánh 30% nhận Thần tốc; vào trận mọi kẻ địch có 40% bị Mê hoặc.",
    hooks: [{ on: "stat", mods: { eva: 8 } }, { on: "hurt", ch: 0.3, fx: [{ s: "haste", t: 2 }] }, { on: "battleStart", fx: [{ s: "confuse", t: 1, ch: 0.4, to: "enemies" }] }] },
  astromancer: { name: "Đọc Sao", icon: "🔭", desc: "Mọi điểm yếu của kẻ địch lộ ra ngay từ đầu trận; thêm 1 ô kỹ năng; +20% sát thương ánh sáng; đòn phép 20% gây Mù.", party: { scan: true }, skillSlots: 1,
    hooks: [{ on: "elemDmg", el: "light", mult: 1.2 }, { on: "hitApply", kind: "magical", fx: [{ s: "blind", ch: 0.2, t: 2 }] }] },
};

export const traitPassiveId = (classId: string) => `trait_${classId}`;

/** What the whole party gains from the classes travelling in it (each class counted once). */
export function partyTraits(classIds: string[]) {
  const out = { gold: 0, xp: 0, sight: 0, scan: false, forage: 0, pets: 0 };
  for (const id of new Set(classIds)) {
    const t = TRAITS[id];
    if (!t) continue;
    out.pets += t.pets ?? 0;
    out.gold += t.party?.gold ?? 0;
    out.xp += t.party?.xp ?? 0;
    out.sight += t.party?.sight ?? 0;
    out.forage = Math.max(out.forage, t.party?.forage ?? 0);
    out.scan ||= !!t.party?.scan;
  }
  return out;
}
