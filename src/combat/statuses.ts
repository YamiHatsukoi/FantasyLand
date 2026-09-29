import type { Element, StatMods, StatusId } from "./types";

export interface StatusDef {
  id: StatusId;
  name: string;
  icon: string;
  kind: "buff" | "debuff";
  maxStacks: number;
  desc: string;
  mods?: (stacks: number) => StatMods;
  /** Imbue statuses turn physical hits into this element. */
  imbue?: Element;
  /** Unit loses its turn while this is active. */
  disables?: boolean;
}

const list: StatusDef[] = [
  { id: "burn", name: "Thiêu đốt", icon: "🔥", kind: "debuff", maxStacks: 5, desc: "Mất máu (lửa) mỗi lượt theo số tầng." },
  { id: "poison", name: "Trúng độc", icon: "☠️", kind: "debuff", maxStacks: 10, desc: "Mất 3% máu tối đa mỗi tầng mỗi lượt, xuyên giáp." },
  { id: "bleed", name: "Chảy máu", icon: "🩸", kind: "debuff", maxStacks: 5, desc: "Mất máu vật lý mỗi lượt. Bị chí mạng sẽ bùng phát." },
  { id: "chill", name: "Tê cóng", icon: "❄️", kind: "debuff", maxStacks: 3, desc: "-10% tốc độ mỗi tầng. Đủ 3 tầng sẽ đóng băng.", mods: (s) => ({ spd: -0.1 * s }) },
  { id: "frozen", name: "Đóng băng", icon: "🧊", kind: "debuff", maxStacks: 1, desc: "Mất lượt. Đòn vật lý sẽ làm vỡ băng (x2 sát thương).", disables: true },
  { id: "wet", name: "Ướt sũng", icon: "💧", kind: "debuff", maxStacks: 1, desc: "Phản ứng với lửa, băng, sét, đất." },
  { id: "oil", name: "Dính dầu", icon: "🛢️", kind: "debuff", maxStacks: 1, desc: "Bị lửa đánh trúng sẽ phát nổ." },
  { id: "shock", name: "Nhiễm điện", icon: "⚡", kind: "debuff", maxStacks: 3, desc: "+8% sát thương nhận mỗi tầng. Đủ 3 tầng sẽ tê liệt." },
  { id: "stun", name: "Choáng", icon: "💫", kind: "debuff", maxStacks: 1, desc: "Mất lượt.", disables: true },
  { id: "sleep", name: "Ngủ", icon: "💤", kind: "debuff", maxStacks: 1, desc: "Mất lượt cho tới khi bị đánh; đòn đánh thức gây x1.5.", disables: true },
  { id: "silence", name: "Câm lặng", icon: "🤐", kind: "debuff", maxStacks: 1, desc: "Không thể dùng kỹ năng phép." },
  { id: "blind", name: "Mù", icon: "🌫️", kind: "debuff", maxStacks: 1, desc: "Đòn vật lý có 50% trượt." },
  { id: "weaken", name: "Suy yếu", icon: "🥀", kind: "debuff", maxStacks: 1, desc: "-25% công và phép.", mods: () => ({ atk: -0.25, mag: -0.25 }) },
  { id: "vulnerable", name: "Dễ tổn thương", icon: "🎯", kind: "debuff", maxStacks: 1, desc: "+25% sát thương nhận vào." },
  { id: "armorBreak", name: "Phá giáp", icon: "🛡️", kind: "debuff", maxStacks: 1, desc: "-40% phòng thủ.", mods: () => ({ def: -0.4 }) },
  { id: "resBreak", name: "Phá kháng", icon: "🔮", kind: "debuff", maxStacks: 1, desc: "-40% kháng phép.", mods: () => ({ res: -0.4 }) },
  { id: "slow", name: "Chậm chạp", icon: "🐌", kind: "debuff", maxStacks: 1, desc: "-30% tốc độ.", mods: () => ({ spd: -0.3 }) },
  { id: "haste", name: "Thần tốc", icon: "💨", kind: "buff", maxStacks: 1, desc: "+30% tốc độ.", mods: () => ({ spd: 0.3 }) },
  { id: "atkUp", name: "Cuồng lực", icon: "💪", kind: "buff", maxStacks: 1, desc: "+30% công.", mods: () => ({ atk: 0.3 }) },
  { id: "magUp", name: "Minh tâm", icon: "✨", kind: "buff", maxStacks: 1, desc: "+30% phép.", mods: () => ({ mag: 0.3 }) },
  { id: "defUp", name: "Kiên cố", icon: "🪨", kind: "buff", maxStacks: 1, desc: "+35% phòng thủ và kháng phép.", mods: () => ({ def: 0.35, res: 0.35 }) },
  { id: "regen", name: "Tái sinh", icon: "🌿", kind: "buff", maxStacks: 1, desc: "Hồi máu mỗi lượt." },
  { id: "shield", name: "Khiên", icon: "🔰", kind: "buff", maxStacks: 1, desc: "Hấp thụ sát thương." },
  { id: "taunt", name: "Khiêu khích", icon: "📢", kind: "buff", maxStacks: 1, desc: "Kẻ địch buộc phải nhắm vào mục tiêu này." },
  { id: "stealth", name: "Ẩn thân", icon: "👤", kind: "buff", maxStacks: 1, desc: "Không thể bị chọn làm mục tiêu đơn. Mất khi tấn công." },
  { id: "thorns", name: "Gai phản", icon: "🌵", kind: "buff", maxStacks: 1, desc: "Phản 30% sát thương vật lý nhận vào." },
  { id: "counter", name: "Thế phản đòn", icon: "🤺", kind: "buff", maxStacks: 1, desc: "Phản công khi bị đòn vật lý đơn mục tiêu." },
  { id: "lifesteal", name: "Hút máu", icon: "🦇", kind: "buff", maxStacks: 1, desc: "Hồi 25% sát thương gây ra." },
  { id: "mark", name: "Bị đánh dấu", icon: "❌", kind: "debuff", maxStacks: 1, desc: "Mọi đòn đánh vào mục tiêu này đều chí mạng." },
  { id: "curse", name: "Nguyền rủa", icon: "🕯️", kind: "debuff", maxStacks: 1, desc: "-50% hồi máu nhận, +30% sát thương bóng tối nhận." },
  { id: "doom", name: "Án tử", icon: "⏳", kind: "debuff", maxStacks: 1, desc: "Khi hết hạn: mất 40% máu tối đa." },
  { id: "confuse", name: "Hỗn loạn", icon: "😵", kind: "debuff", maxStacks: 1, desc: "Tấn công mục tiêu ngẫu nhiên, kể cả đồng đội." },
  { id: "empower", name: "Tích lực", icon: "🌟", kind: "buff", maxStacks: 1, desc: "Đòn gây sát thương kế tiếp x1.6." },
  { id: "focus", name: "Tập trung", icon: "👁️", kind: "buff", maxStacks: 1, desc: "+30% tỉ lệ chí mạng.", mods: () => ({ crit: 30 }) },
  { id: "evade", name: "Né tránh", icon: "🍃", kind: "buff", maxStacks: 1, desc: "+30% né.", mods: () => ({ eva: 30 }) },
  { id: "immune", name: "Thánh hộ", icon: "😇", kind: "buff", maxStacks: 1, desc: "Miễn nhiễm hiệu ứng bất lợi mới." },
  { id: "reflect", name: "Phản phép", icon: "🪞", kind: "buff", maxStacks: 1, desc: "Phản lại phép đơn mục tiêu kế tiếp." },
  { id: "berserk", name: "Cuồng nộ", icon: "😡", kind: "buff", maxStacks: 1, desc: "+50% công, -30% phòng thủ.", mods: () => ({ atk: 0.5, def: -0.3 }) },
  { id: "petrify", name: "Hoá đá", icon: "🗿", kind: "debuff", maxStacks: 1, desc: "Mất lượt, nhận ít hơn 50% sát thương.", disables: true },
  { id: "rooted", name: "Trói chặt", icon: "🌱", kind: "debuff", maxStacks: 1, desc: "Không thể né, -20% tốc độ.", mods: () => ({ eva: -100, spd: -0.2 }) },
  { id: "barrier", name: "Kết giới", icon: "🔷", kind: "buff", maxStacks: 1, desc: "-40% sát thương phép nhận vào." },
  { id: "guard", name: "Phòng thủ", icon: "🛡", kind: "buff", maxStacks: 1, desc: "-50% sát thương nhận vào tới lượt kế tiếp." },
  { id: "manaRegen", name: "Linh lưu", icon: "🔹", kind: "buff", maxStacks: 1, desc: "Hồi 10% MP mỗi lượt." },
  { id: "imbueFire", name: "Tẩm lửa", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ lửa.", imbue: "fire" },
  { id: "imbueIce", name: "Tẩm băng", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ băng.", imbue: "ice" },
  { id: "imbueLightning", name: "Tẩm sét", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ sét.", imbue: "lightning" },
  { id: "imbueWater", name: "Tẩm nước", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ nước.", imbue: "water" },
  { id: "imbueEarth", name: "Tẩm đất", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ đất.", imbue: "earth" },
  { id: "imbueWind", name: "Tẩm gió", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ gió.", imbue: "wind" },
  { id: "imbueLight", name: "Tẩm thánh quang", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ ánh sáng.", imbue: "light" },
  { id: "imbueDark", name: "Tẩm bóng tối", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ bóng tối.", imbue: "dark" },
  { id: "imbuePoison", name: "Tẩm độc", icon: "🗡️", kind: "buff", maxStacks: 1, desc: "Đòn vật lý mang hệ độc.", imbue: "poison" },
];

export const STATUSES: Record<StatusId, StatusDef> = Object.fromEntries(list.map((s) => [s.id, s])) as Record<StatusId, StatusDef>;

/** The status each element tends to apply on hit (used by imbued physical attacks). */
export const ELEMENT_STATUS: Partial<Record<Element, { s: StatusId; ch: number; t: number }>> = {
  fire: { s: "burn", ch: 0.35, t: 3 },
  ice: { s: "chill", ch: 0.5, t: 3 },
  lightning: { s: "shock", ch: 0.5, t: 3 },
  water: { s: "wet", ch: 0.6, t: 2 },
  earth: { s: "armorBreak", ch: 0.2, t: 2 },
  wind: { s: "slow", ch: 0.2, t: 2 },
  dark: { s: "curse", ch: 0.2, t: 3 },
  poison: { s: "poison", ch: 0.5, t: 3 },
};

export const ELEMENTS: Record<Element, { name: string; icon: string; color: string }> = {
  physical: { name: "Vật lý", icon: "⚔️", color: "#e6e1d3" },
  fire: { name: "Lửa", icon: "🔥", color: "#ff7a3d" },
  ice: { name: "Băng", icon: "❄️", color: "#8fd8ff" },
  lightning: { name: "Sét", icon: "⚡", color: "#ffe14d" },
  water: { name: "Nước", icon: "💧", color: "#4da6ff" },
  earth: { name: "Đất", icon: "🪨", color: "#c49a6c" },
  wind: { name: "Gió", icon: "🌪️", color: "#9ef0c0" },
  light: { name: "Ánh sáng", icon: "☀️", color: "#fff3a8" },
  dark: { name: "Bóng tối", icon: "🌑", color: "#b58cff" },
  poison: { name: "Độc", icon: "☠️", color: "#8be04e" },
  arcane: { name: "Huyền bí", icon: "🔮", color: "#ff8cf0" },
};
