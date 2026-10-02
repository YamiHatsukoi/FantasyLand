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
  warrior: { name: "Bách Chiến", icon: "⚔️", desc: "Trải trăm trận: thêm 1 ô nội tại; +10% máu; hạ gục kẻ địch nhận Cuồng lực.", passiveSlots: 1,
    hooks: [{ on: "stat", mods: { hp: 0.1 } }, { on: "kill", fx: [{ s: "atkUp", t: 2, to: "self" }] }] },
  mage: { name: "Thư Viện Di Động", icon: "📚", desc: "Thuộc lòng cả kho phép: thêm 2 ô kỹ năng; +15% phép; hồi 5% MP mỗi lượt.", skillSlots: 2,
    hooks: [{ on: "stat", mods: { mag: 0.15 } }, { on: "turnStart", mpPct: 0.05 }] },
  ranger: { name: "Mắt Ưng", icon: "🦅", desc: "Cả đội nhìn xa thêm 2 ô dưới Vực Sâu; bản thân +5 chí mạng.", party: { sight: 2 }, hooks: [{ on: "stat", mods: { crit: 5 } }] },
  rogue: { name: "Đâm Lén", icon: "🗡️", desc: "+10 chí mạng; chí mạng khiến mục tiêu Chảy máu và Dễ tổn thương; cả đội nhận thêm 25% vàng sau trận.", party: { gold: 0.25 },
    hooks: [{ on: "stat", mods: { crit: 10 } }, { on: "crit", fx: [{ s: "bleed", t: 3 }, { s: "vulnerable", t: 2 }] }] },
  cleric: { name: "Ân Điển", icon: "🙏", desc: "Phép hồi máu mạnh hơn 25%; kháng 20% hiệu ứng bất lợi.", hooks: [{ on: "healPower", mult: 1.25 }, { on: "debuffResist", ch: 0.2 }] },
  guardian: { name: "Thành Lũy", icon: "🏰", desc: "Vào trận với Khiên chắn đòn và Khiêu khích kẻ địch về mình.", hooks: [{ on: "battleStart", fx: [{ s: "shield", t: 3, p: 0.9 }, { s: "taunt", t: 2 }] }] },
  witch: { name: "Lời Nguyền", icon: "🕯️", desc: "Đòn phép có 25% Nguyền rủa mục tiêu.", hooks: [{ on: "hitApply", kind: "magical", fx: [{ s: "curse", ch: 0.25, t: 3 }] }] },
  monk: { name: "Nội Công", icon: "☯️", desc: "Mỗi lượt hồi 3% máu và 4% MP.", hooks: [{ on: "turnStart", healPct: 0.03, mpPct: 0.04 }] },
  paladin: { name: "Thánh Giáp", icon: "🛡️", desc: "Kháng 35% hiệu ứng bất lợi, +10% kháng phép.", hooks: [{ on: "debuffResist", ch: 0.35 }, { on: "stat", mods: { res: 0.1 } }] },
  bard: { name: "Khúc Khải Hoàn", icon: "🎶", desc: "Cả đội nhận thêm 20% kinh nghiệm sau mỗi trận.", party: { xp: 0.2 } },
  necromancer: { name: "Hút Linh Hồn", icon: "💀", desc: "Hạ gục kẻ địch hồi 10% máu và 15% MP.", hooks: [{ on: "kill", healPct: 0.1, mpPct: 0.15 }] },
  druid: { name: "Con Của Rừng", icon: "🌳", desc: "Cả đội mang theo thêm 1 thú cưng; bản thân hồi 3% máu mỗi lượt.", pets: 1, hooks: [{ on: "turnStart", healPct: 0.03 }] },
  spellblade: { name: "Song Tu", icon: "🌀", desc: "Tu cả kiếm lẫn phép: thêm 1 ô kỹ năng và 1 ô nội tại.", skillSlots: 1, passiveSlots: 1 },
  dragoon: { name: "Xung Phong", icon: "🐲", desc: "Vào trận với Thần tốc và Cuồng lực.", hooks: [{ on: "battleStart", fx: [{ s: "haste", t: 2 }, { s: "atkUp", t: 2 }] }] },
  samurai: { name: "Nhất Kích", icon: "🎴", desc: "Chí mạng gây thêm 35% sát thương.", hooks: [{ on: "critDmg", add: 0.35 }] },
  ninja: { name: "Ẩn Thân Thuật", icon: "🌫️", desc: "Vào trận trong trạng thái Ẩn thân; +5 né tránh.", hooks: [{ on: "battleStart", fx: [{ s: "stealth", t: 1 }] }, { on: "stat", mods: { eva: 5 } }] },
  alchemist: { name: "Túi Thuốc", icon: "⚗️", desc: "Sau mỗi trận thắng, 40% chế ra một lọ thuốc cho đội; thêm 1 ô kỹ năng.", party: { forage: 0.4 }, skillSlots: 1 },
  summoner: { name: "Khế Ước", icon: "📿", desc: "Cả đội mang theo thêm 1 thú cưng; thêm 1 ô kỹ năng.", pets: 1, skillSlots: 1 },
  berserker: { name: "Cuồng Nộ", icon: "😡", desc: "Dưới 50% máu: +35% công và +10% tốc độ.", hooks: [{ on: "lowHp", below: 0.5, mods: { atk: 0.35, spd: 0.1 } }] },
  shaman: { name: "Thông Linh", icon: "🪶", desc: "Phản ứng nguyên tố gây thêm 30% sát thương; +10% phép.", hooks: [{ on: "reactionDmg", mult: 1.3 }, { on: "stat", mods: { mag: 0.1 } }] },
  chronomancer: { name: "Nhịp Thời Gian", icon: "⏳", desc: "Vào trận với Thần tốc; +10% tốc độ.", hooks: [{ on: "battleStart", fx: [{ s: "haste", t: 3 }] }, { on: "stat", mods: { spd: 0.1 } }] },
  beastmaster: { name: "Đầu Đàn", icon: "🐺", desc: "Cả đội mang theo thêm 2 thú cưng cùng lúc (tối đa 3).", pets: 2 },
  dancer: { name: "Bước Nhảy", icon: "💃", desc: "+8 né tránh; bị đánh có 30% nhận Thần tốc.", hooks: [{ on: "stat", mods: { eva: 8 } }, { on: "hurt", ch: 0.3, fx: [{ s: "haste", t: 2 }] }] },
  astromancer: { name: "Đọc Sao", icon: "🔭", desc: "Mọi điểm yếu của kẻ địch lộ ra ngay từ đầu trận; thêm 1 ô kỹ năng.", party: { scan: true }, skillSlots: 1 },
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
