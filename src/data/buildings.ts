import { hashString } from "../core/rng";
import type { Station } from "./items/recipeTypes";

export type Cost = Record<string, number>; // item id -> amount, "gold" for gold

export type BuildingCategory = "core" | "farm" | "production" | "craft" | "housing" | "service" | "decor";

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  size: [number, number];
  maxLevel: number;
  unique: boolean;
  fixed?: boolean;
  rank: number; // settlement rank required to build
  category: BuildingCategory;
  station?: Station;
  housing?: number; // residents per level
  workers?: number; // workers needed per level
  appeal?: number; // attractiveness per level
  /** Rendering style: wall/roof colours and an item-icon emblem on the facade. */
  style?: { wall: string; roof: string; emblem?: string };
  first?: Cost; // explicit build cost (otherwise generated)
}

export const RANK_NAMES = ["", "Trại", "Xóm", "Làng", "Thị Trấn", "Thành Phố", "Kinh Đô"];
export const POP_REQ = [0, 0, 3, 8, 16, 30, 50];
export const FLOOR_REQ = [0, 1, 2, 3, 5, 7, 10];
export const TERRITORY_SIZES = [10, 14, 18, 22, 26, 32, 38, 44, 52, 60];
export const MAX_TERRITORY_FOR_RANK = [0, 1, 3, 4, 6, 8, 9];

const B = (d: BuildingDef) => d;
const list: BuildingDef[] = [
  // ------------------------------------------------------------ core
  B({ id: "house", name: "Nhà Chính", icon: "🏛️", size: [3, 3], maxLevel: 6, unique: true, fixed: true, rank: 1, category: "core", housing: 2, appeal: 2, style: { wall: "#d8c8a0", roof: "#9a3a2a" },
    desc: "Trái tim của Thánh Địa. Nâng cấp để thăng hạng khu định cư: Trại → Xóm → Làng → Thị Trấn → Thành Phố → Kinh Đô." }),
  B({ id: "gate", name: "Cổng Vực Sâu", icon: "🌀", size: [2, 2], maxLevel: 1, unique: true, fixed: true, rank: 1, category: "core",
    desc: "Cánh cổng đá dẫn xuống Vực Sâu Bách Tầng. Dịch chuyển tới đầu mọi tầng đã mở khoá." }),
  // ------------------------------------------------------------ farming
  B({ id: "farm", name: "Ô Ruộng", icon: "🟫", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "farm", first: { wood: 2 },
    desc: "Gieo hạt hoặc trồng cây giống. Cần tưới nước mỗi ngày (trừ ngày mưa); bón phân để đất màu mỡ hơn." }),
  B({ id: "well", name: "Giếng Nước", icon: "🪣", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "farm", appeal: 1, first: { stone: 10, wood: 4 },
    desc: "Mở khoá nút 'Tưới tất cả' cho mọi ô ruộng." }),
  B({ id: "sprinkler", name: "Vòi Tưới Tự Động", icon: "💦", size: [1, 1], maxLevel: 3, unique: false, rank: 3, category: "farm",
    desc: "Tự tưới các ô ruộng xung quanh mỗi ngày (bán kính 1/2/3 theo cấp)." }),
  B({ id: "compost", name: "Hố Ủ Phân", icon: "🟤", size: [1, 1], maxLevel: 3, unique: true, rank: 1, category: "farm", station: "compost", first: { wood: 6, stone: 4 },
    desc: "Ủ phân bón từ phụ phẩm nông nghiệp, xương và bào tử." }),
  B({ id: "greenhouse", name: "Nhà Kính", icon: "🏡", size: [3, 3], maxLevel: 3, unique: false, rank: 3, category: "farm", style: { wall: "#b8e8f0", roof: "#6ab0c0" },
    desc: "4/6/8 ô trồng bên trong, luôn đúng mùa và được tưới tự động." }),
  B({ id: "coop", name: "Chuồng Gà Vịt", icon: "🐔", size: [2, 2], maxLevel: 3, unique: false, rank: 1, category: "farm", workers: 1, style: { wall: "#c8a070", roof: "#a0602a", emblem: "egg" }, first: { wood: 12, fiber_forest: 4 },
    desc: "Cho trứng mỗi ngày. Cần hạt ngũ cốc (lúa, ngô, lúa nước) làm thức ăn. Cấp 2 có thêm vịt." }),
  B({ id: "barn", name: "Chuồng Gia Súc", icon: "🐄", size: [3, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 2, style: { wall: "#b04a3a", roof: "#6a2a1a", emblem: "bottle" },
    desc: "Bò cho sữa; cấp 2 có dê (sữa dê); cấp 3 có cừu (lông cừu). Cần rau củ làm thức ăn." }),
  B({ id: "beehive", name: "Tổ Ong", icon: "🐝", size: [1, 1], maxLevel: 3, unique: false, rank: 2, category: "farm",
    desc: "Cho mật ong mỗi ngày, nhiều hơn khi có hoa trồng gần đó. Thỉnh thoảng có Sữa Ong Chúa." }),
  B({ id: "fishpond", name: "Ao Cá", icon: "🐟", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 1,
    desc: "Mỗi ngày câu được cá theo mùa. Ngày giông bão có thể bắt được Lươn Sấm." }),
  B({ id: "silkhouse", name: "Nhà Nuôi Tằm", icon: "🐛", size: [2, 2], maxLevel: 2, unique: false, rank: 4, category: "farm", workers: 2, style: { wall: "#f0e0c0", roof: "#c89a5a", emblem: "wool" },
    desc: "Cho kén tằm mỗi ngày. Cần lá cây (cải, trà) làm thức ăn." }),
  // ------------------------------------------------------------ production (daily)
  B({ id: "lumber", name: "Trại Đốn Gỗ", icon: "🪓", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "production", workers: 2, style: { wall: "#8a5a2a", roof: "#5a3a1e", emblem: "log" }, first: { wood: 10, stone: 5 },
    desc: "Công nhân đốn gỗ mỗi ngày. Cấp cao đốn được gỗ quý." }),
  B({ id: "quarry", name: "Mỏ Đá", icon: "⛏️", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "production", workers: 2, style: { wall: "#8a8f96", roof: "#4a4e56", emblem: "stone" }, first: { wood: 12, stone: 4 },
    desc: "Khai thác đá, cát và đất sét mỗi ngày." }),
  B({ id: "mine", name: "Hầm Mỏ", icon: "⚒️", size: [2, 2], maxLevel: 5, unique: false, rank: 2, category: "production", workers: 3, style: { wall: "#5a4a3a", roof: "#3a2a1a", emblem: "ore" },
    desc: "Khai thác quặng kim loại mỗi ngày. Cấp càng cao càng đào sâu tới kim loại quý." }),
  B({ id: "herbgarden", name: "Vườn Thảo Dược", icon: "🌿", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "production", workers: 1,
    desc: "Thu hái thảo dược các vùng mỗi ngày." }),
  B({ id: "market", name: "Chợ", icon: "🏪", size: [3, 2], maxLevel: 4, unique: true, rank: 2, category: "production", workers: 2, appeal: 3, style: { wall: "#e8c070", roof: "#c83a3a", emblem: "coin" },
    desc: "Thu thuế buôn bán: mỗi ngày nhận vàng theo số dân." }),
  // ------------------------------------------------------------ crafting stations
  B({ id: "kitchen", name: "Bếp Lửa", icon: "🍳", size: [2, 2], maxLevel: 4, unique: true, rank: 1, category: "craft", station: "kitchen", style: { wall: "#c8a878", roof: "#7a5a3a", emblem: "bowl" }, first: { wood: 8, stone: 6 },
    desc: "Nấu nông sản thành món ăn hồi phục và buff bữa ăn." }),
  B({ id: "forge", name: "Lò Rèn", icon: "⚒️", size: [2, 2], maxLevel: 6, unique: true, rank: 1, category: "craft", station: "forge", style: { wall: "#7a7a82", roof: "#4a4a52", emblem: "ingot" }, first: { stone: 10, wood: 5 },
    desc: "Luyện quặng thành thỏi và rèn vũ khí, giáp, trang sức. Cấp càng cao rèn được kim loại càng quý." }),
  B({ id: "sawmill", name: "Xưởng Cưa", icon: "🪚", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "sawmill", style: { wall: "#a07040", roof: "#6a4a2a", emblem: "plank" }, first: { wood: 10, stone: 4 },
    desc: "Xẻ gỗ thành ván, đốt than, làm giấy và nhựa cây." }),
  B({ id: "workshop", name: "Xưởng Đá & Thủy Tinh", icon: "🧱", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "workshop", style: { wall: "#9a9ea4", roof: "#5a5e66", emblem: "block" }, first: { stone: 14, wood: 4 },
    desc: "Đẽo khối đá, nung gạch, nấu thủy tinh, đúc đinh và bánh răng." }),
  B({ id: "tailor", name: "Xưởng May & Thuộc Da", icon: "🧵", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "tailor", style: { wall: "#c8a0c0", roof: "#7a4a6a", emblem: "cloth" }, first: { wood: 8, hide: 3 },
    desc: "Dệt vải, thuộc da, bện dây và may giáp vải/da, ma thư." }),
  B({ id: "alchemy", name: "Phòng Giả Kim", icon: "⚗️", size: [2, 2], maxLevel: 4, unique: true, rank: 1, category: "craft", station: "alchemy", style: { wall: "#7a8a6a", roof: "#3a6a4a", emblem: "potion" }, first: { wood: 10, herb: 5, slime_gel: 5 },
    desc: "Chưng cất tinh dầu, bào chế thuốc, thuốc tăng lực, dầu tẩm vũ khí và bom nguyên tố." }),
  B({ id: "library", name: "Thư Viện Phép", icon: "📚", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "library", style: { wall: "#b8b0d0", roof: "#3a4a9a", emblem: "book" }, first: { wood: 12, mushroom_cap: 4, mana_crystal: 2 },
    desc: "Nghiên cứu kỹ năng và nội tại; viết cuộn phép dịch chuyển." }),
  // ------------------------------------------------------------ housing
  B({ id: "tent", name: "Lều Trại", icon: "⛺", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "housing", housing: 2, first: { wood: 3, hide: 2 },
    desc: "Chỗ ngủ tạm cho 2 người." }),
  B({ id: "cottage", name: "Nhà Gỗ", icon: "🏠", size: [2, 2], maxLevel: 2, unique: false, rank: 1, category: "housing", housing: 4, appeal: 1, style: { wall: "#c89a5a", roof: "#8a3a2a" }, first: { wood: 16, stone: 6 },
    desc: "Nhà gỗ ấm cúng cho 4 người (8 khi nâng cấp)." }),
  B({ id: "stonehouse", name: "Nhà Đá", icon: "🏘️", size: [2, 2], maxLevel: 2, unique: false, rank: 3, category: "housing", housing: 6, appeal: 2, style: { wall: "#b0b0a8", roof: "#4a5a8a" },
    desc: "Nhà đá kiên cố cho 6 người (12 khi nâng cấp)." }),
  B({ id: "manor", name: "Dinh Thự", icon: "🏰", size: [3, 3], maxLevel: 2, unique: false, rank: 4, category: "housing", housing: 12, appeal: 5, style: { wall: "#e8e0d0", roof: "#6a2a5a" },
    desc: "Dinh thự rộng rãi cho 12 người." }),
  B({ id: "apartment", name: "Chung Cư", icon: "🏢", size: [3, 3], maxLevel: 3, unique: false, rank: 5, category: "housing", housing: 20, appeal: 2, style: { wall: "#c8c0b0", roof: "#3a3a4a" },
    desc: "Toà nhà nhiều tầng cho 20 người mỗi cấp." }),
  B({ id: "palace", name: "Cung Điện", icon: "👑", size: [4, 4], maxLevel: 1, unique: true, rank: 6, category: "housing", housing: 40, appeal: 30, style: { wall: "#f0e8d0", roof: "#d8a020", emblem: "coin" },
    desc: "Biểu tượng của Kinh Đô. Nhà của 40 người và niềm tự hào của cả Vực Sâu." }),
  // ------------------------------------------------------------ services
  B({ id: "training", name: "Sân Tập", icon: "🎯", size: [2, 2], maxLevel: 3, unique: true, rank: 1, category: "service",
    desc: "Dùng vàng để huấn luyện đồng đội, giúp người ở nhà bắt kịp cấp độ." }),
  B({ id: "tavern", name: "Quán Rượu", icon: "🍺", size: [3, 2], maxLevel: 3, unique: true, rank: 2, category: "service", workers: 1, appeal: 4, style: { wall: "#a0703a", roof: "#5a2a1a", emblem: "cup" },
    desc: "Lính đánh thuê và nhà thám hiểm ghé qua mỗi ngày — có thể chiêu mộ họ. Cấp cao có người mạnh hơn." }),
  B({ id: "academy", name: "Học Viện", icon: "🎓", size: [3, 3], maxLevel: 3, unique: true, rank: 4, category: "service", workers: 2, appeal: 4, style: { wall: "#d8d0e8", roof: "#4a3a8a", emblem: "book" },
    desc: "Mỗi ngày, đồng đội không đi cùng nhận kinh nghiệm." }),
  B({ id: "temple", name: "Đền Thờ Mầm", icon: "⛩️", size: [3, 3], maxLevel: 3, unique: true, rank: 3, category: "service", appeal: 6, style: { wall: "#f0f0e8", roof: "#2a8a5a", emblem: "herb" },
    desc: "Khi xuống Vực Sâu, cả đội nhận Phúc Lành (+3% mọi chỉ số mỗi cấp) tới khi về nhà." }),
  B({ id: "clinic", name: "Y Quán", icon: "🏥", size: [2, 2], maxLevel: 3, unique: true, rank: 3, category: "service", workers: 1, appeal: 2, style: { wall: "#f4f4f4", roof: "#c83a3a", emblem: "potion" },
    desc: "Mỗi ngày bào chế Thuốc Hồi Máu cho kho (nhiều hơn theo cấp)." }),
  B({ id: "warehouse", name: "Nhà Kho", icon: "📦", size: [3, 2], maxLevel: 3, unique: true, rank: 3, category: "service", workers: 1, style: { wall: "#9a7a4a", roof: "#5a4a2a", emblem: "plank" },
    desc: "Quản lý kho tốt giúp các công trình sản xuất làm thêm 10%/20%/30% sản lượng." }),
  B({ id: "watchtower", name: "Tháp Canh", icon: "🗼", size: [1, 1], maxLevel: 2, unique: false, rank: 3, category: "service", appeal: 1,
    desc: "Lính gác trông chừng bóng tối. Tăng sức hút khu định cư." }),
  B({ id: "wall", name: "Tường Thành", icon: "🧱", size: [1, 1], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 1,
    desc: "Đoạn tường đá. Xếp thành vòng thành bao quanh Thánh Địa." }),
  // ------------------------------------------------------------ decor
  B({ id: "lamp", name: "Đèn Đá", icon: "🏮", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { stone: 3 }, desc: "Ánh sáng ấm áp giữa lòng Vực Sâu." }),
  B({ id: "flowers", name: "Luống Hoa", icon: "🌷", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { herb: 2 }, desc: "Một chút màu sắc. Ong rất thích." }),
  B({ id: "tree", name: "Cây Bóng Mát", icon: "🌳", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { wood: 4, herb: 2 }, desc: "Cây xanh toả bóng. Thỉnh thoảng rụng quả xương rồng." }),
  B({ id: "fountain", name: "Đài Phun Nước", icon: "⛲", size: [2, 2], maxLevel: 1, unique: false, rank: 3, category: "decor", appeal: 6, desc: "Trung tâm quảng trường." }),
  B({ id: "statue", name: "Tượng Anh Hùng", icon: "🗿", size: [1, 1], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 4, desc: "Tượng tưởng niệm những người chuyển sinh đã ngã xuống." }),
  B({ id: "park", name: "Công Viên", icon: "🌲", size: [3, 3], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 10, desc: "Vườn cây, ghế đá và lối đi lát sỏi." }),
  B({ id: "arch", name: "Cổng Hoa", icon: "🌸", size: [2, 1], maxLevel: 1, unique: false, rank: 2, category: "decor", appeal: 3, desc: "Cổng vòm phủ hoa leo." }),
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(list.map((b) => [b.id, b]));
export const BUILDING_LIST = list;

// ------------------------------------------------------------ generated costs
const POOLS: string[][] = [
  [],
  ["wood", "stone", "fiber_forest", "hide", "herb"],
  ["plank_forest", "block_forest", "copper_ingot", "rope", "cloth_forest", "brick"],
  ["plank_desert", "block_desert", "iron_ingot", "glass", "leather_forest", "nails", "mortar"],
  ["plank_swamp", "block_swamp", "steel_ingot", "gears", "amber", "cloth_desert", "leather_desert"],
  ["plank_tundra", "block_tundra", "silver_ingot", "frost_gem", "obsidian", "block_volcano", "leather_tundra"],
  ["mithril_ingot", "darkiron_ingot", "jade", "aquamarine", "block_reef", "plank_bamboo", "amethyst"],
];

/** Cost to build (level 0) or upgrade to level+1. */
export function costFor(type: string, level: number): Cost {
  const def = BUILDINGS[type];
  if (level === 0 && def.first) return def.first;
  const rank = Math.min(6, def.rank + level);
  const area = def.size[0] * def.size[1];
  const scale = Math.pow(area, 0.7) * (1 + level * 0.6);
  const h = hashString(`${type}:${level}`);
  const pool = POOLS[rank];
  const out: Cost = {};
  const picks = rank === 1 ? 2 : 3;
  for (let i = 0; i < picks; i++) {
    const id = pool[(h + i * 7) % pool.length];
    out[id] = (out[id] ?? 0) + Math.max(2, Math.round((i === 0 ? 8 : 5) * scale));
  }
  if (rank >= 2 && pool !== POOLS[rank - 1]) {
    const prev = POOLS[rank - 1][(h >>> 3) % POOLS[rank - 1].length];
    out[prev] = (out[prev] ?? 0) + Math.round(6 * scale);
  }
  const gold = Math.round(25 * rank * rank * Math.pow(area, 0.6) * (1 + level * 0.5));
  if (rank >= 2) out.gold = gold;
  return out;
}

export function expansionCost(level: number): Cost {
  const rank = Math.min(6, 1 + Math.floor(level * 0.62));
  const pool = POOLS[rank];
  const s = 1 + level * 0.8;
  return { [pool[0]]: Math.round(12 * s), [pool[1]]: Math.round(10 * s), [pool[pool.length - 1]]: Math.round(6 * s), gold: Math.round(80 * rank * rank * s) };
}

export function houseRequirement(nextLevel: number) {
  return { pop: POP_REQ[nextLevel] ?? 999, floor: FLOOR_REQ[nextLevel] ?? 999 };
}

export const passiveSlotsFor = (houseLevel: number) => (houseLevel >= 4 ? 3 : 2);
export const skillSlotsFor = (houseLevel: number) => (houseLevel >= 5 ? 6 : 5);
export const PARTY_SIZE = 4; // hero + 3 companions
export const farmLimitFor = (territory: number) => 8 + territory * 6;
