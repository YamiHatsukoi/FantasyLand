/**
 * Arena items, as in Teamfight Tactics: nine components that combine two at a time into a
 * finished item (45 recipes). The ninth component, the White Seal, turns any other component
 * into a trait emblem (or, with a second seal, a crown that lets one more unit on the board).
 * Emblems of the other traits come whole from augments, carousels and monster rounds.
 * Each item gives flat stats plus, for finished ones, an effect the combat engine applies.
 */
import { TRAITS } from "./traits";

export type ItemFx =
  | "deathblade" | "giantslayer" | "gunblade" | "shojin" | "edge" | "bloodthirster" | "steraks" | "infinity"
  | "rapidfire" | "guinsoo" | "statikk" | "titans" | "runaan" | "quicksilver" | "lastwhisper"
  | "rabadon" | "archangel" | "ionic" | "morello" | "jeweled" | "locket"
  | "blue" | "protector" | "adaptive" | "redemption" | "hand"
  | "bramble" | "gargoyle" | "sunfire" | "spiked"
  | "dragonclaw" | "zz" | "crownguard"
  | "warmog" | "redbuff"
  | "thief"
  | "magnet"
  | "emblem" | "crown";

export interface ItemStats { ad?: number; as?: number; ap?: number; mana?: number; armor?: number; mr?: number; hp?: number; crit?: number; dodge?: number; dmg?: number }

export interface ArenaItem {
  id: string;
  name: string;
  icon: string;
  stats: ItemStats;
  parts?: [string, string];
  fx?: ItemFx;
  /** For emblems: the trait it grants. */
  trait?: string;
  desc: string;
  component?: boolean;
}

const C = (id: string, name: string, icon: string, stats: ItemStats, desc: string): ArenaItem => ({ id, name, icon, stats, desc, component: true });

export const COMPONENTS: ArenaItem[] = [
  C("sword", "Kiếm Thép", "🗡️", { ad: 10 }, "+10 sát thương"),
  C("bow", "Cung Gỗ", "🏹", { as: 0.1 }, "+10% tốc đánh"),
  C("rod", "Gậy Phép", "🪄", { ap: 10 }, "+10 sức mạnh phép"),
  C("tear", "Giọt Lệ Nữ Thần", "💧", { mana: 15 }, "+15 năng lượng khởi đầu"),
  C("vest", "Giáp Lưới", "🦺", { armor: 20 }, "+20 giáp"),
  C("cloak", "Áo Choàng Bạc", "🧣", { mr: 20 }, "+20 kháng phép"),
  C("belt", "Đai Khổng Lồ", "🎗️", { hp: 150 }, "+150 máu"),
  C("glove", "Găng Tay Đạo Tặc", "🧤", { crit: 0.2, dodge: 0.1 }, "+20% chí mạng, +10% né"),
  C("seal", "Ấn Trắng", "🔰", {}, "Ghép với một mảnh khác thành Ấn tộc hệ"),
];
const COMP = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));

/** Finished items: [a, b, id, name, icon, extra stats, fx, description]. */
const RECIPES: [string, string, string, string, string, ItemStats, ItemFx, string][] = [
  ["sword", "sword", "deathblade", "Kiếm Tử Thần", "⚔️", { ad: 35 }, "deathblade", "+45 sát thương. Mỗi lần hạ gục kẻ địch +10 sát thương."],
  ["sword", "bow", "giantslayer", "Cung Diệt Khổng Lồ", "🎯", { ad: 10, as: 0.1 }, "giantslayer", "Gây thêm 25% sát thương lên kẻ địch có trên 1.600 máu."],
  ["sword", "rod", "gunblade", "Kiếm Súng Hút Hồn", "🔫", { ad: 10, ap: 10 }, "gunblade", "Hồi máu bằng 22% mọi sát thương gây ra, chia cho đồng minh yếu nhất."],
  ["sword", "tear", "shojin", "Thương Thần Ân", "🔱", { ad: 5, ap: 5 }, "shojin", "Đánh thường hồi thêm 5 năng lượng."],
  ["sword", "vest", "edge", "Lưỡi Kiếm Màn Đêm", "🌘", { ad: 5 }, "edge", "Lần đầu xuống dưới 60% máu: tàng hình 1 giây và +30% tốc đánh."],
  ["sword", "cloak", "bloodthirster", "Kiếm Khát Máu", "🩸", { ad: 5 }, "bloodthirster", "Hút máu 22%. Lần đầu xuống dưới 40% máu nhận khiên 25% máu tối đa."],
  ["sword", "belt", "steraks", "Rìu Cuồng Nộ", "🪓", { ad: 5 }, "steraks", "Lần đầu xuống dưới 60% máu: khiên 25% máu tối đa và +35% sát thương."],
  ["sword", "glove", "infinity", "Vô Cực Kiếm", "💎", { ad: 5, crit: 0.15 }, "infinity", "Chiêu có thể chí mạng, sát thương chí mạng +30%."],
  ["bow", "bow", "rapidfire", "Cung Liên Thanh", "🏹", { as: 0.25 }, "rapidfire", "+35% tốc đánh, +1 tầm đánh."],
  ["bow", "rod", "guinsoo", "Cuồng Đao Nguyên Tố", "🌀", { ap: 5 }, "guinsoo", "Mỗi đòn đánh +5% tốc đánh (cộng dồn không giới hạn)."],
  ["bow", "tear", "statikk", "Dao Điện Statik", "⚡", {}, "statikk", "Cứ đòn thứ 3 phóng điện 3 kẻ địch (100 sát thương phép), giảm 30% kháng phép của chúng."],
  ["bow", "vest", "titans", "Quyết Tâm Khổng Lồ", "🗿", { as: 0.05 }, "titans", "Mỗi khi đánh hoặc bị đánh: +2% sát thương và phép (tối đa 25 lần); đủ 25 lần +25 giáp, kháng."],
  ["bow", "cloak", "runaan", "Cung Gió Lốc", "🍃", { mr: 5 }, "runaan", "Đòn đánh bắn thêm một mũi tên vào kẻ địch gần đó (55% sát thương)."],
  ["bow", "belt", "zz", "Trượng Lấp Lánh", "✨", { hp: 50 }, "zz", "Đầu trận triệu hồi một vệ binh 600 máu chặn đường kẻ địch."],
  ["bow", "glove", "lastwhisper", "Lời Thì Thầm Cuối", "🎵", { crit: 0.1 }, "lastwhisper", "Đòn chí mạng phá 30% giáp mục tiêu trong 3 giây."],
  ["rod", "rod", "rabadon", "Mũ Phù Thủy", "🎩", { ap: 40 }, "rabadon", "+50 sức mạnh phép, tăng thêm 20% sát thương."],
  ["rod", "tear", "archangel", "Trượng Thiên Thần", "🪽", {}, "archangel", "Mỗi 5 giây trong trận +20 sức mạnh phép."],
  ["rod", "vest", "locket", "Mề Đay Hộ Mệnh", "📿", { armor: 10 }, "locket", "Đầu trận đồng minh 2 hàng ngang quanh được khiên 300."],
  ["rod", "cloak", "ionic", "Tia Sét Ion", "🌩️", {}, "ionic", "Kẻ địch trong 2 ô giảm 30% kháng phép; mỗi lần chúng tung chiêu bị sét đánh."],
  ["rod", "belt", "morello", "Quỷ Thư Morello", "📕", { hp: 50 }, "morello", "Sát thương thiêu đốt mục tiêu 1% máu/giây và giảm 33% hồi máu."],
  ["rod", "glove", "jeweled", "Găng Bảo Thạch", "💍", { crit: 0.15 }, "jeweled", "Chiêu có thể chí mạng, sát thương chí mạng +35%."],
  ["tear", "tear", "blue", "Bùa Xanh", "🔵", { mana: 15 }, "blue", "Tung chiêu xong hoàn lại 10 năng lượng; năng lượng tối đa giảm 10."],
  ["tear", "vest", "protector", "Lời Thề Hộ Vệ", "🛡️", { armor: 10 }, "protector", "Lần đầu xuống dưới 40% máu: khiên 30% máu tối đa, +20 giáp và kháng."],
  ["tear", "cloak", "adaptive", "Mũ Thích Ứng", "🪖", { mr: 10 }, "adaptive", "Mỗi 3 giây hồi 10 năng lượng."],
  ["tear", "belt", "redemption", "Lời Cứu Chuộc", "💖", { hp: 50 }, "redemption", "Mỗi 5 giây hồi cho đồng minh trong 1 ô 12% máu đã mất."],
  ["tear", "glove", "hand", "Bàn Tay Công Lý", "✋", { crit: 0.1 }, "hand", "+15% sát thương và hút máu 15%."],
  ["vest", "vest", "bramble", "Áo Choàng Gai", "🌵", { armor: 30 }, "bramble", "Bị đánh thường gây 80 sát thương phép quanh mình (mỗi 2 giây)."],
  ["vest", "cloak", "gargoyle", "Giáp Thạch Quỷ", "🪨", {}, "gargoyle", "+10 giáp và kháng phép cho mỗi kẻ địch nhắm vào mình."],
  ["vest", "belt", "sunfire", "Áo Choàng Lửa", "🔥", { hp: 100 }, "sunfire", "Mỗi 2 giây đốt kẻ địch trong 2 ô 1% máu/giây và giảm hồi máu."],
  ["vest", "glove", "spiked", "Giáp Gai Nhọn", "🦔", { crit: 0.1 }, "spiked", "Mỗi lần bị đánh phản 25% sát thương nhận vào cho kẻ tấn công."],
  ["cloak", "cloak", "dragonclaw", "Vuốt Rồng", "🐉", { mr: 40 }, "dragonclaw", "Mỗi 2 giây hồi 5% máu tối đa."],
  ["cloak", "belt", "crownguard", "Khăn Choàng Thủy Tổ", "🧥", { hp: 100 }, "crownguard", "Đầu trận nhận khiên 30% máu tối đa; khi khiên vỡ +25 sức mạnh phép."],
  ["cloak", "glove", "quicksilver", "Thủy Ngân", "🪞", { crit: 0.1 }, "quicksilver", "Miễn khống chế trong 15 giây đầu trận, +5% tốc đánh mỗi 2 giây."],
  ["belt", "belt", "warmog", "Giáp Máu Warmog", "❤️", { hp: 650 }, "warmog", "+12% máu tối đa."],
  ["belt", "glove", "redbuff", "Bùa Đỏ", "🟥", { as: 0.2 }, "redbuff", "Đòn đánh thiêu đốt 1% máu/giây và giảm 33% hồi máu, +6% sát thương."],
  ["glove", "glove", "thief", "Găng Đạo Tặc", "🎒", {}, "thief", "Mỗi vòng biến thành 2 món trang bị ngẫu nhiên khác nhau."],
];

// the white seal turns a component into an emblem of the trait that component stands for
const SEAL_TRAIT: Record<string, string> = {
  sword: "c_brute", bow: "c_marksman", rod: "c_mage", tear: "c_support", vest: "c_tank", cloak: "k_spirit", belt: "k_beast", glove: "c_assassin",
};

export const ITEMS: Record<string, ArenaItem> = {};
for (const c of COMPONENTS) ITEMS[c.id] = c;
const sum = (a: ItemStats, b: ItemStats, extra: ItemStats): ItemStats => {
  const out: ItemStats = {};
  for (const s of [a, b, extra]) for (const [k, v] of Object.entries(s) as [keyof ItemStats, number][]) out[k] = Math.round(((out[k] ?? 0) + v) * 100) / 100;
  return out;
};
for (const [a, b, id, name, icon, extra, fx, desc] of RECIPES) {
  ITEMS[id] = { id, name, icon, stats: sum(COMP[a].stats, COMP[b].stats, extra), parts: [a, b], fx, desc };
}
// emblems: one per trait (only the eight seal ones can be crafted; the rest drop)
for (const t of Object.values(TRAITS)) {
  if (t.group === "unique") continue;
  const comp = Object.entries(SEAL_TRAIT).find(([, tr]) => tr === t.id)?.[0];
  ITEMS[`em_${t.id}`] = {
    id: `em_${t.id}`, name: `Ấn ${t.name}`, icon: t.icon, stats: comp ? { ...COMP[comp].stats } : {}, parts: comp ? ["seal", comp] : undefined, fx: "emblem", trait: t.id,
    desc: `Người mang được tính thêm tộc hệ ${t.name}.`,
  };
}
/** Magnetic remover: dropped on a unit, it takes all of that unit's items back to the bench. */
ITEMS.magnet = { id: "magnet", name: "Nam Châm Tháo Đồ", icon: "🧲", stats: {}, fx: "magnet", desc: "Kéo thả vào tướng để tháo hết trang bị của tướng đó về hàng đồ. Dùng 1 lần." };
ITEMS.crown = { id: "crown", name: "Vương Miện Chiến Thuật", icon: "👑", stats: {}, parts: ["seal", "seal"], fx: "crown", desc: "+1 tướng được ra sân." };

/** The finished item two components make, if any. */
export function combine(a: string, b: string): string | undefined {
  for (const it of Object.values(ITEMS)) {
    if (!it.parts) continue;
    const [x, y] = it.parts;
    if ((x === a && y === b) || (x === b && y === a)) return it.id;
  }
  return undefined;
}

export const isComponent = (id: string) => !!ITEMS[id]?.component;
export const FINISHED = () => Object.values(ITEMS).filter((i) => !i.component && i.fx !== "emblem" && i.fx !== "crown" && i.fx !== "magnet");
export const EMBLEMS = () => Object.values(ITEMS).filter((i) => i.fx === "emblem");
