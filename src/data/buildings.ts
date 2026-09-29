export type Cost = Record<string, number>; // item id -> amount, "gold" for gold

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  size: [number, number];
  maxLevel: number;
  unique: boolean;
  fixed?: boolean; // cannot be moved/demolished
  /** cost[0] = build cost, cost[i] = upgrade to level i+1 */
  cost: Cost[];
  levelText: string[];
}

export const BUILDINGS: Record<string, BuildingDef> = {
  house: {
    id: "house", name: "Nhà Chính", icon: "🏠", size: [3, 3], maxLevel: 5, unique: true, fixed: true,
    desc: "Trái tim của Thánh Địa. Ngủ để qua ngày, hồi phục cả đội và mở rộng lãnh địa.",
    cost: [{}, { wood: 20, stone: 15, gold: 150 }, { wood: 30, sandstone: 20, amber: 5, gold: 400 }, { bog_iron: 15, wood: 40, mana_crystal: 5, gold: 900 }, { iron_ore: 40, mana_crystal: 15, monster_core: 10, gold: 2000 }],
    levelText: ["Đội hình 2 người", "Đội hình 3 người", "Đội hình 4 người", "Đội hình 4 người, +1 ô nội tại", "Đội hình 4 người, +1 ô kỹ năng"],
  },
  gate: {
    id: "gate", name: "Cổng Vực Sâu", icon: "🌀", size: [2, 2], maxLevel: 1, unique: true, fixed: true,
    desc: "Cánh cổng đá dẫn xuống Vực Sâu Bách Tầng. Có thể dịch chuyển tới mọi tầng đã khai phá.",
    cost: [{}], levelText: [""],
  },
  farm: {
    id: "farm", name: "Ô Ruộng", icon: "🟫", size: [1, 1], maxLevel: 1, unique: false,
    desc: "Gieo hạt giống, chờ vài ngày rồi thu hoạch.",
    cost: [{ wood: 2 }], levelText: [""],
  },
  kitchen: {
    id: "kitchen", name: "Bếp Lửa", icon: "🍳", size: [2, 2], maxLevel: 3, unique: true,
    desc: "Nấu nông sản thành món ăn hồi phục và tăng sức mạnh.",
    cost: [{ wood: 8, stone: 6 }, { wood: 15, sandstone: 10, gold: 150 }, { peat: 10, bog_iron: 5, gold: 400 }],
    levelText: ["Công thức cơ bản", "Công thức sa mạc", "Công thức cao cấp"],
  },
  forge: {
    id: "forge", name: "Lò Rèn", icon: "⚒️", size: [2, 2], maxLevel: 4, unique: true,
    desc: "Rèn vũ khí, giáp và trang sức từ nguyên liệu dưới Vực Sâu.",
    cost: [{ stone: 10, wood: 5, iron_ore: 3 }, { sandstone: 15, iron_ore: 10, gold: 200 }, { bog_iron: 12, monster_core: 4, gold: 500 }, { iron_ore: 40, mana_crystal: 12, monster_core: 8, gold: 1500 }],
    levelText: ["Trang bị tầng 1", "Trang bị tầng 2", "Trang bị tầng 3", "Trang bị Mithril"],
  },
  alchemy: {
    id: "alchemy", name: "Phòng Giả Kim", icon: "⚗️", size: [2, 2], maxLevel: 3, unique: true,
    desc: "Bào chế thuốc và bom nguyên tố — chìa khoá cho các phản ứng nguyên tố.",
    cost: [{ wood: 10, herb: 5, slime_gel: 5 }, { amber: 5, sandstone: 10, gold: 200 }, { glowmoss: 8, soul_wax: 3, gold: 500 }],
    levelText: ["Thuốc cơ bản", "Bom nguyên tố", "Thuốc cao cấp"],
  },
  library: {
    id: "library", name: "Thư Viện Phép", icon: "📚", size: [2, 2], maxLevel: 5, unique: true,
    desc: "Nghiên cứu kỹ năng và nội tại mới bằng Tinh Thể Ma Lực. Cấp càng cao, kỹ năng càng mạnh.",
    cost: [{ wood: 12, mushroom_cap: 4, mana_crystal: 2 }, { sandstone: 15, linen: 6, mana_crystal: 5, gold: 250 }, { soul_wax: 5, pearl: 2, mana_crystal: 10, gold: 600 }, { mana_crystal: 20, monster_core: 8, gold: 1500 }, { mana_crystal: 40, monster_core: 16, gold: 4000 }],
    levelText: ["Kỹ năng bậc 1", "Kỹ năng bậc 2", "Kỹ năng bậc 3", "Kỹ năng bậc 4", "Kỹ năng bậc 5"],
  },
  well: {
    id: "well", name: "Giếng Nước", icon: "🪣", size: [1, 1], maxLevel: 1, unique: true,
    desc: "Nước giếng mát lành giúp mọi cây trồng lớn nhanh hơn 1 ngày.",
    cost: [{ stone: 12, wood: 4 }], levelText: [""],
  },
  training: {
    id: "training", name: "Sân Tập", icon: "🎯", size: [2, 2], maxLevel: 3, unique: true,
    desc: "Dùng vàng để huấn luyện đồng đội, giúp người ở nhà bắt kịp cấp độ.",
    cost: [{ wood: 15, hide: 6, gold: 100 }, { sandstone: 10, chitin: 6, gold: 300 }, { bog_iron: 10, gold: 800 }],
    levelText: ["Luyện tới cấp của người mạnh nhất -3", "... -2", "... -1"],
  },
  lamp: {
    id: "lamp", name: "Đèn Đá", icon: "🏮", size: [1, 1], maxLevel: 1, unique: false,
    desc: "Trang trí. Ánh sáng ấm áp giữa lòng Vực Sâu.", cost: [{ stone: 3 }], levelText: [""],
  },
  flowers: {
    id: "flowers", name: "Luống Hoa", icon: "🌷", size: [1, 1], maxLevel: 1, unique: false,
    desc: "Trang trí. Một chút màu sắc cho Thánh Địa.", cost: [{ herb: 2 }], levelText: [""],
  },
  tree: {
    id: "tree", name: "Cây Ăn Quả", icon: "🌳", size: [1, 1], maxLevel: 1, unique: false,
    desc: "Trang trí. Thỉnh thoảng rụng quả xương rồng khi bạn ngủ dậy.", cost: [{ wood: 4, herb: 2 }], levelText: [""],
  },
};

/** Size of the buildable square per territory level. */
export const TERRITORY_SIZES = [10, 14, 18, 22, 26];
export const EXPANSION_COST: Cost[] = [
  {},
  { wood: 15, stone: 10, gold: 100 },
  { wood: 25, sandstone: 10, gold: 300 },
  { bog_iron: 10, peat: 10, gold: 700 },
  { iron_ore: 30, mana_crystal: 10, gold: 1500 },
];

export const partySizeFor = (houseLevel: number) => (houseLevel >= 3 ? 4 : houseLevel + 1);
export const passiveSlotsFor = (houseLevel: number) => (houseLevel >= 4 ? 3 : 2);
export const skillSlotsFor = (houseLevel: number) => (houseLevel >= 5 ? 6 : 5);
export const farmLimitFor = (territory: number) => 6 + territory * 4;
