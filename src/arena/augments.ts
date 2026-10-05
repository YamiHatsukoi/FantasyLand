/**
 * Arena "Lõi" (augments): picked three times a match (stages 2, 3 and 4), one of three offered,
 * with one reroll. Tiers: silver, gold, prismatic. `fx` is applied by the match (src/arena/match.ts)
 * once when picked, every round, or in battle.
 */
export type AugTier = 1 | 2 | 3;

export type AugFx =
  // once, when picked
  | { k: "gold"; n: number }
  | { k: "items"; n: number; finished?: boolean }
  | { k: "emblem"; group?: "origin" | "class" | "kind" }
  | { k: "xp"; n: number }
  | { k: "units"; cost: number; n: number }
  | { k: "boardSize"; n: number }
  | { k: "hp"; n: number }
  // every round
  | { k: "income"; n: number }
  | { k: "freeRolls"; n: number }
  | { k: "interestCap"; n: number }
  | { k: "xpRound"; n: number }
  // in battle, for the whole team
  | { k: "team"; stat: "hp" | "ad" | "ap" | "as" | "armor" | "mr" | "crit" | "omnivamp" | "mana"; v: number }
  | { k: "frontline"; hp: number; armor: number }
  | { k: "backline"; dmg: number }
  | { k: "starPower"; v: number } // units with 2+ stars
  | { k: "traitBonus"; n: number }; // +1 to every active trait (counts as one more unit)

export interface Augment { id: string; name: string; icon: string; tier: AugTier; fx: AugFx[]; desc: string }

const A = (id: string, name: string, icon: string, tier: AugTier, fx: AugFx[], desc: string): Augment => ({ id, name, icon, tier, fx, desc });

export const AUGMENTS: Augment[] = [
  // ---------------------------------------------------------------- silver
  A("pocket_change", "Tiền Lẻ Trong Túi", "🪙", 1, [{ k: "gold", n: 8 }], "Nhận ngay 8 vàng."),
  A("component_bag", "Túi Phụ Tùng", "🎒", 1, [{ k: "items", n: 1 }, { k: "gold", n: 3 }], "Nhận 1 mảnh trang bị và 3 vàng."),
  A("small_emblem", "Ấn Nhỏ", "🔖", 1, [{ k: "emblem", group: "class" }], "Nhận 1 Ấn hệ ngẫu nhiên."),
  A("study", "Chăm Học", "📗", 1, [{ k: "xp", n: 6 }, { k: "xpRound", n: 1 }], "Nhận 6 kinh nghiệm, mỗi vòng thêm 1 kinh nghiệm."),
  A("free_rolls", "Chợ Phiên", "🎲", 1, [{ k: "freeRolls", n: 1 }], "Mỗi vòng được 1 lần đổi cửa hàng miễn phí."),
  A("tough_skin", "Da Dày", "🦏", 1, [{ k: "team", stat: "hp", v: 0.08 }], "Cả đội +8% máu tối đa."),
  A("sharp_claws", "Vuốt Sắc", "🐾", 1, [{ k: "team", stat: "ad", v: 0.1 }], "Cả đội +10% sát thương."),
  A("spark", "Tia Lửa Phép", "✨", 1, [{ k: "team", stat: "ap", v: 12 }], "Cả đội +12 sức mạnh phép."),
  A("quick_feet", "Chân Nhanh", "👟", 1, [{ k: "team", stat: "as", v: 0.1 }], "Cả đội +10% tốc đánh."),
  A("thick_hide", "Vảy Cứng", "🐢", 1, [{ k: "team", stat: "armor", v: 15 }, { k: "team", stat: "mr", v: 15 }], "Cả đội +15 giáp và kháng phép."),
  A("rookies", "Tân Binh", "🐣", 1, [{ k: "units", cost: 1, n: 3 }], "Nhận 3 tướng 1 vàng ngẫu nhiên từ bể của bạn."),
  A("steady", "Thu Nhập Đều", "💵", 1, [{ k: "income", n: 1 }], "Mỗi vòng thêm 1 vàng."),
  A("first_aid", "Sơ Cứu", "🩹", 1, [{ k: "hp", n: 15 }, { k: "gold", n: 2 }], "Hồi 15 máu người chơi và nhận 2 vàng."),
  A("frontline_1", "Tường Khiên", "🧱", 1, [{ k: "frontline", hp: 150, armor: 10 }], "Tướng ở 2 hàng đầu +150 máu, +10 giáp."),
  A("backline_1", "Ẩn Sau Lưng", "🏹", 1, [{ k: "backline", dmg: 0.08 }], "Tướng ở 2 hàng sau gây thêm 8% sát thương."),
  // ---------------------------------------------------------------- gold
  A("treasure", "Kho Báu Vực Sâu", "💰", 2, [{ k: "gold", n: 18 }], "Nhận ngay 18 vàng."),
  A("armory", "Kho Vũ Khí", "⚒️", 2, [{ k: "items", n: 1, finished: true }], "Nhận 1 trang bị hoàn chỉnh ngẫu nhiên."),
  A("double_bag", "Hai Túi Phụ Tùng", "🧰", 2, [{ k: "items", n: 2 }], "Nhận 2 mảnh trang bị."),
  A("origin_emblem", "Ấn Huyết Thống", "🩸", 2, [{ k: "emblem", group: "origin" }], "Nhận 1 Ấn tộc (nguyên tố) ngẫu nhiên."),
  A("kind_emblem", "Ấn Bản Năng", "🦴", 2, [{ k: "emblem", group: "kind" }, { k: "gold", n: 3 }], "Nhận 1 Ấn loài ngẫu nhiên và 3 vàng."),
  A("bankers", "Ngân Khố", "🏦", 2, [{ k: "interestCap", n: 3 }], "Tiền lãi tối đa tăng từ 5 lên 8."),
  A("level_up", "Vượt Cấp", "⏫", 2, [{ k: "xp", n: 12 }], "Nhận ngay 12 kinh nghiệm."),
  A("veterans", "Lão Binh", "🎖️", 2, [{ k: "units", cost: 3, n: 2 }], "Nhận 2 tướng 3 vàng ngẫu nhiên."),
  A("berserk", "Cuồng Bạo", "😡", 2, [{ k: "team", stat: "as", v: 0.2 }, { k: "team", stat: "ad", v: 0.08 }], "Cả đội +20% tốc đánh, +8% sát thương."),
  A("arcane_flow", "Dòng Chảy Huyền Bí", "🔮", 2, [{ k: "team", stat: "ap", v: 25 }, { k: "team", stat: "mana", v: 15 }], "Cả đội +25 sức mạnh phép và +15 năng lượng khởi đầu."),
  A("vampire", "Huyết Tộc", "🧛", 2, [{ k: "team", stat: "omnivamp", v: 0.15 }], "Cả đội hồi máu bằng 15% sát thương gây ra."),
  A("bulwark", "Tường Thành Sống", "🏰", 2, [{ k: "frontline", hp: 300, armor: 25 }], "Tướng 2 hàng đầu +300 máu, +25 giáp."),
  A("snipers", "Ổ Bắn Tỉa", "🔭", 2, [{ k: "backline", dmg: 0.18 }], "Tướng 2 hàng sau gây thêm 18% sát thương."),
  A("star_power", "Ngôi Sao Sáng", "⭐", 2, [{ k: "starPower", v: 0.15 }], "Tướng từ 2 sao trở lên +15% máu và sát thương."),
  A("rich_rolls", "Phiên Chợ Lớn", "🛒", 2, [{ k: "freeRolls", n: 2 }, { k: "gold", n: 2 }], "Mỗi vòng 2 lần đổi cửa hàng miễn phí, nhận 2 vàng."),
  // ---------------------------------------------------------------- prismatic
  A("dragon_hoard", "Kho Báu Của Rồng", "🐲", 3, [{ k: "gold", n: 30 }], "Nhận ngay 30 vàng."),
  A("legend_forge", "Lò Rèn Huyền Thoại", "🔥", 3, [{ k: "items", n: 2, finished: true }], "Nhận 2 trang bị hoàn chỉnh."),
  A("crowned", "Vương Miện", "👑", 3, [{ k: "boardSize", n: 1 }, { k: "items", n: 1 }], "+1 tướng ra sân và 1 mảnh trang bị."),
  A("twin_emblems", "Song Ấn", "🔰", 3, [{ k: "emblem" }, { k: "emblem" }], "Nhận 2 Ấn tộc hệ ngẫu nhiên."),
  A("trait_surge", "Cộng Hưởng", "🌈", 3, [{ k: "traitBonus", n: 1 }], "Mọi tộc hệ đang kích hoạt được tính thêm 1 tướng."),
  A("lords", "Triệu Hồi Bá Chủ", "💀", 3, [{ k: "units", cost: 5, n: 1 }, { k: "gold", n: 5 }], "Nhận 1 tướng 5 vàng ngẫu nhiên và 5 vàng."),
  A("golden_age", "Thời Hoàng Kim", "🌟", 3, [{ k: "income", n: 3 }, { k: "interestCap", n: 2 }], "Mỗi vòng thêm 3 vàng; tiền lãi tối đa +2."),
  A("titan_army", "Đạo Quân Khổng Lồ", "🗻", 3, [{ k: "team", stat: "hp", v: 0.2 }, { k: "team", stat: "armor", v: 20 }, { k: "team", stat: "mr", v: 20 }], "Cả đội +20% máu, +20 giáp và kháng."),
  A("warlords", "Đội Quân Bất Bại", "⚔️", 3, [{ k: "team", stat: "ad", v: 0.2 }, { k: "team", stat: "ap", v: 30 }, { k: "team", stat: "as", v: 0.15 }], "Cả đội +20% sát thương, +30 phép, +15% tốc đánh."),
  A("ascension", "Thăng Hoa", "🌠", 3, [{ k: "starPower", v: 0.35 }], "Tướng từ 2 sao trở lên +35% máu và sát thương."),
  A("immortal", "Bất Diệt", "🔆", 3, [{ k: "team", stat: "omnivamp", v: 0.25 }, { k: "hp", n: 20 }], "Cả đội hồi máu 25% sát thương gây ra; hồi 20 máu người chơi."),
  A("time_twist", "Bẻ Cong Thời Gian", "⏳", 3, [{ k: "xp", n: 20 }, { k: "xpRound", n: 2 }], "Nhận 20 kinh nghiệm, mỗi vòng thêm 2."),
];

export const AUGMENT_BY_ID = Object.fromEntries(AUGMENTS.map((a) => [a.id, a]));
