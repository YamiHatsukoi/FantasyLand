import { C, I } from "./core";

/** 0 = Xuân, 1 = Hạ, 2 = Thu, 3 = Đông */
export type Season = 0 | 1 | 2 | 3;
export const SEASON_NAMES = ["Xuân", "Hạ", "Thu", "Đông"];
export const SEASON_ICONS = ["🌸", "☀️", "🍂", "❄️"];
export const DAYS_PER_SEASON = 7;
export const seasonOf = (day: number): Season => (Math.floor((day - 1) / DAYS_PER_SEASON) % 4) as Season;

export interface CropDef {
  id: string;
  seed: string;
  name: string;
  kind: "crop" | "tree" | "flower";
  days: number; // days to first harvest
  regrow?: number; // days between later harvests (multi-harvest)
  seasons: Season[]; // seasons where it grows at full speed
  yield: [number, number];
  water: 0 | 1 | 2; // 0 = drought tolerant, 2 = thirsty (needs water daily)
  tier: number;
  hybrid?: [string, string]; // parents that can cross-pollinate into this crop
  herb?: boolean; // usable raw as a herb
}

/**
 * Real seconds for a crop's growth from its size in "days": the quickest crop (2 days) takes
 * 15 seconds, a 5-day crop about a minute, the big 12-day fruit trees about 4.5 minutes.
 */
export const cropSeconds = (days: number) => Math.round(15 * Math.pow(Math.max(1, days) / 2, 1.6));
const growLabel = (days: number) => {
  const sec = cropSeconds(days);
  return sec < 60 ? `${sec} giây` : sec % 60 ? `${Math.floor(sec / 60)} phút ${sec % 60} giây` : `${sec / 60} phút`;
};

export const CROPS: Record<string, CropDef> = {};
export const CROP_LIST: CropDef[] = [];

type CropRow = [id: string, name: string, seedName: string, shape: string, col: string, value: number, days: number, regrow: number, seasons: Season[], yieldMin: number, yieldMax: number, water: 0 | 1 | 2, tier: number, extra?: Partial<CropDef>];
const ALL: Season[] = [0, 1, 2, 3];

const rows: CropRow[] = [
  // existing crops (ids stable)
  ["wheat", "Lúa Vàng", "Hạt Lúa Vàng", "grain", "#f2c542", 4, 3, 0, [0, 1], 2, 4, 1, 1],
  ["moon_radish", "Củ Ánh Trăng", "Hạt Củ Ánh Trăng", "root", "#f0f0ff", 6, 3, 0, [2, 3], 1, 3, 1, 1],
  ["fire_berry", "Dâu Lửa", "Hạt Dâu Lửa", "berry", "#e8402a", 7, 3, 2, [1], 2, 3, 1, 1],
  ["silver_herb", "Thảo Dược Bạc", "Hạt Thảo Dược Bạc", "herb", "#c8d8e0", 8, 3, 0, ALL, 1, 2, 1, 1, { herb: true }],
  ["spirit_mushroom", "Nấm Tinh Linh", "Bào Tử Nấm Tinh Linh", "mushroom", "#b88aff", 10, 4, 3, [2, 3], 1, 2, 2, 2],
  ["golden_date", "Chà Là Vàng", "Hạt Chà Là Vàng", "berry", "#c8902a", 12, 4, 3, [1], 2, 3, 0, 2],
  ["star_pumpkin", "Bí Ngô Sao", "Hạt Bí Ngô Sao", "gourd", "#ff9a2a", 16, 5, 0, [2], 1, 2, 1, 2],
  ["ghost_lotus", "Sen Ma", "Hạt Sen Ma", "flower", "#e0c8ff", 18, 5, 0, ALL, 1, 2, 2, 3],
  // spring
  ["rice", "Lúa Nước Ngọc", "Mạ Lúa Ngọc", "grain", "#e8f0c8", 6, 4, 0, [0], 3, 5, 2, 1],
  ["cloud_cabbage", "Cải Mây", "Hạt Cải Mây", "leafy", "#b8f0c8", 7, 3, 0, [0], 1, 2, 1, 1],
  ["crystal_strawberry", "Dâu Tây Pha Lê", "Hạt Dâu Tây Pha Lê", "berry", "#ff6a8a", 12, 4, 2, [0], 2, 4, 1, 2],
  ["dusk_onion", "Hành Tím Hoàng Hôn", "Củ Giống Hành Tím", "root", "#a060c0", 6, 3, 0, [0, 2], 2, 3, 0, 1],
  ["jade_pea", "Đậu Ngọc", "Hạt Đậu Ngọc", "pod", "#6ad86a", 8, 3, 2, [0, 1], 2, 3, 1, 1],
  ["dew_tea", "Trà Sương Mai", "Cành Giống Trà", "herb", "#4ab06a", 14, 6, 2, [0, 1, 2], 1, 2, 1, 2, { herb: true }],
  // summer
  ["sun_tomato", "Cà Chua Mặt Trời", "Hạt Cà Chua Mặt Trời", "fruit", "#ff4a2a", 9, 4, 2, [1], 2, 3, 1, 1],
  ["gold_corn", "Ngô Vàng Ròng", "Hạt Ngô Vàng Ròng", "pod", "#f8d040", 8, 5, 0, [1, 2], 2, 3, 1, 1],
  ["dragon_pepper", "Ớt Rồng", "Hạt Ớt Rồng", "fruit", "#e83a1a", 12, 4, 2, [1], 2, 4, 0, 2],
  ["thunder_melon", "Dưa Hấu Sấm", "Hạt Dưa Hấu Sấm", "gourd", "#4ac05a", 20, 6, 0, [1], 1, 2, 2, 2],
  ["fire_sunflower", "Hướng Dương Lửa", "Hạt Hướng Dương Lửa", "flower", "#ffb020", 10, 5, 0, [1], 1, 2, 1, 1],
  ["cloud_cotton", "Bông Mây", "Hạt Bông Mây", "wool", "#f8f8ff", 9, 5, 3, [1, 2], 2, 3, 1, 1],
  // autumn
  ["holy_potato", "Khoai Tây Đất Thánh", "Khoai Giống", "root", "#c8a060", 7, 4, 0, [2], 2, 4, 0, 1],
  ["ember_carrot", "Cà Rốt Lửa", "Hạt Cà Rốt Lửa", "root", "#ff7a2a", 7, 3, 0, [2, 0], 1, 3, 1, 1],
  ["night_grape", "Nho Rượu Đêm", "Cành Nho Đêm", "berry", "#5a3a8a", 14, 6, 3, [2], 2, 4, 1, 2],
  ["shadow_eggplant", "Cà Tím Bóng Đêm", "Hạt Cà Tím Bóng Đêm", "fruit", "#4a2a6a", 10, 4, 2, [2], 1, 3, 1, 2],
  ["forest_shiitake", "Nấm Hương Rừng", "Bào Tử Nấm Hương", "mushroom", "#8a5a3a", 9, 3, 3, [2, 3], 1, 3, 2, 1],
  ["blood_beet", "Củ Dền Máu", "Hạt Củ Dền Máu", "root", "#a01a3a", 9, 4, 0, [2, 3], 1, 3, 1, 2],
  // winter
  ["snow_root", "Củ Tuyết", "Hạt Củ Tuyết", "root", "#e8f4ff", 9, 4, 0, [3], 2, 3, 0, 2],
  ["frost_cabbage", "Cải Băng", "Hạt Cải Băng", "leafy", "#a8e0ff", 10, 4, 0, [3], 1, 3, 1, 2],
  ["snow_pea", "Đậu Tuyết", "Hạt Đậu Tuyết", "pod", "#d8f0ff", 9, 3, 2, [3, 0], 2, 3, 1, 2],
  ["ice_blueberry", "Việt Quất Băng", "Hạt Việt Quất Băng", "berry", "#4a6ae0", 13, 5, 2, [3], 2, 4, 1, 2],
  // any season
  ["wind_mint", "Bạc Hà Gió", "Hạt Bạc Hà Gió", "herb", "#7af0b0", 6, 2, 2, ALL, 1, 2, 1, 1, { herb: true }],
  ["spirit_sage", "Xô Thơm Tâm Linh", "Hạt Xô Thơm", "herb", "#a0b0e0", 9, 4, 0, ALL, 1, 2, 0, 2, { herb: true }],
  ["dream_lavender", "Oải Hương Mộng", "Hạt Oải Hương", "flower", "#b08aff", 9, 4, 3, ALL, 1, 2, 0, 1, { herb: true }],
  ["blue_flax", "Lanh Xanh", "Hạt Lanh", "fiber", "#6a8ad8", 5, 3, 0, ALL, 2, 4, 1, 1],
  // hybrids (only obtainable through cross-pollination)
  ["sunmoon_fruit", "Quả Nhật Nguyệt", "Hạt Nhật Nguyệt", "fruit", "#ffe0a0", 60, 5, 3, ALL, 1, 2, 1, 4, { hybrid: ["sun_tomato", "moon_radish"] }],
  ["dragon_melon", "Dưa Long Hỏa", "Hạt Dưa Long Hỏa", "gourd", "#ff5a2a", 70, 6, 0, [1, 2], 1, 2, 1, 4, { hybrid: ["thunder_melon", "dragon_pepper"] }],
  ["crystal_rice", "Lúa Pha Lê", "Mạ Lúa Pha Lê", "grain", "#c8f0ff", 55, 5, 0, ALL, 2, 3, 2, 4, { hybrid: ["rice", "silver_herb"] }],
  ["phoenix_flower", "Hoa Phượng Hoàng", "Hạt Hoa Phượng Hoàng", "flower", "#ff3a2a", 90, 7, 4, ALL, 1, 1, 1, 5, { hybrid: ["fire_sunflower", "fire_berry"], herb: true }],
  ["void_pumpkin", "Bí Hư Không", "Hạt Bí Hư Không", "gourd", "#3a2a6a", 80, 6, 0, [2, 3], 1, 2, 1, 5, { hybrid: ["star_pumpkin", "shadow_eggplant"] }],
  ["heaven_tea", "Trà Thiên Giới", "Cành Trà Thiên Giới", "herb", "#f0e8a0", 85, 6, 3, ALL, 1, 2, 1, 5, { hybrid: ["dew_tea", "ghost_lotus"], herb: true }],
  // orchard trees (planted from saplings, harvest repeatedly)
  ["ruby_apple", "Táo Hồng Ngọc", "Cây Giống Táo", "fruit", "#e8202a", 14, 10, 3, [2, 1], 3, 5, 1, 2, { kind: "tree" }],
  ["immortal_peach", "Đào Tiên", "Cây Giống Đào Tiên", "fruit", "#ffa0b0", 30, 12, 4, [0, 1], 2, 4, 1, 3, { kind: "tree" }],
  ["sun_orange", "Cam Mặt Trời", "Cây Giống Cam", "fruit", "#ff9a1a", 16, 10, 3, [1], 3, 5, 1, 2, { kind: "tree" }],
  ["moon_pear", "Lê Ánh Trăng", "Cây Giống Lê", "fruit", "#e8f0a0", 16, 10, 3, [2], 3, 5, 1, 2, { kind: "tree" }],
  ["sweet_cherry", "Anh Đào Ngọt", "Cây Giống Anh Đào", "berry", "#d8203a", 20, 11, 3, [0], 3, 6, 1, 3, { kind: "tree" }],
  ["wild_chestnut", "Hạt Dẻ Rừng", "Cây Giống Hạt Dẻ", "seed", "#8a5a2a", 12, 10, 4, [2, 3], 3, 6, 0, 2, { kind: "tree" }],
];

for (const [id, name, seedName, shape, col, value, days, regrow, seasons, y0, y1, water, tier, extra] of rows) {
  const kind = extra?.kind ?? (shape === "flower" ? "flower" : "crop");
  const seed = kind === "tree" ? `sapling_${id}` : id === "wheat" ? "seed_wheat" : id === "moon_radish" ? "seed_radish"
    : id === "fire_berry" ? "seed_berry" : id === "silver_herb" ? "seed_herb" : id === "spirit_mushroom" ? "seed_mushroom"
    : id === "golden_date" ? "seed_date" : id === "star_pumpkin" ? "seed_pumpkin" : id === "ghost_lotus" ? "seed_lotus" : `seed_${id}`;
  const def: CropDef = { id, seed, name, kind, days, regrow: regrow || undefined, seasons, yield: [y0, y1], water, tier, ...extra };
  CROPS[id] = def;
  CROP_LIST.push(def);
  const seasonText = seasons.length === 4 ? "mọi mùa" : seasons.map((s) => ["Xuân", "Hạ", "Thu", "Đông"][s]).join(", ");
  const growText = `lớn trong ${growLabel(days)}${regrow ? `, sau đó ra lứa mới mỗi ${growLabel(regrow)}` : ""}. Mùa: ${seasonText}.${water === 2 ? " Cần tưới đủ nước." : water === 0 ? " Chịu hạn tốt." : ""}`;
  I(seed, seedName, kind === "tree" ? "sapling" : "seed", Math.ceil(value * (kind === "tree" ? 3 : 0.6)), `Trồng ra ${name}: ${growText}${def.hybrid ? " Giống lai hiếm." : ""}`,
    kind === "tree" ? "sapling" : "seed", kind === "tree" ? [col, C.brown, "#ffffff"] : [C.paleWood, col, col], { crop: id, tier });
  I(id, name, extra?.herb ? "herb" : "crop", value, `Nông sản${def.hybrid ? " lai hiếm" : ""} từ Thánh Địa. Nguyên liệu nấu ăn và giả kim.`, shape, [col, C.leaf, "#ffffff"], { tier });
}

// ------------------------------------------------------------ animal products & fish
const animal: [string, string, string, string, number, string][] = [
  ["egg", "Trứng Gà Lông Vàng", "egg", "#f8e8c8", 5, "Trứng từ chuồng gà."],
  ["duck_egg", "Trứng Vịt Mây", "egg", "#d8f0ff", 7, "Trứng xanh nhạt, béo ngậy."],
  ["milk", "Sữa Bò Rêu", "bottle", "#f8f8f0", 8, "Sữa tươi thơm mùi cỏ."],
  ["goat_milk", "Sữa Dê Núi", "bottle", "#f0e8d8", 10, "Sữa dê đặc, làm phô mai rất ngon."],
  ["wool", "Lông Cừu Mây", "wool", "#f4f4ff", 8, "Lông cừu mềm như mây, dệt thành vải."],
  ["silk_cocoon", "Kén Tằm Tinh", "wool", "#fff0c8", 14, "Kén tằm ánh vàng, dệt lụa quý."],
  ["honey", "Mật Ong Hoa", "honey", "#f0a820", 12, "Mật ong thơm hương hoa trong Thánh Địa."],
  ["royal_jelly", "Sữa Ong Chúa", "jar", "#fff0a0", 40, "Cực hiếm. Giúp hồi phục thần kỳ."],
  ["carp", "Cá Chép Vàng", "fish", "#f0a030", 8, "Cá ao phổ biến."],
  ["silver_salmon", "Cá Hồi Bạc", "fish", "#c8d8e8", 12, "Thịt hồng, béo."],
  ["lantern_fish", "Cá Đèn Lồng", "fish", "#6ad8ff", 16, "Phát sáng trong bóng tối."],
  ["ice_trout", "Cá Hồi Băng", "fish", "#a8e0ff", 14, "Chỉ cắn câu vào mùa đông."],
  ["sun_perch", "Cá Rô Mặt Trời", "fish", "#ffb040", 12, "Thích nước ấm mùa hạ."],
  ["thunder_eel", "Lươn Sấm", "fish", "#4a4ae0", 22, "Tê tê khi cầm vào."],
  ["meat_beast", "Thịt Thú Rừng", "meat", "#c05a4a", 6, "Thịt tươi từ quái thú. Nấu chín mới ăn được."],
  ["meat_bird", "Thịt Chim Quái", "meat", "#e8906a", 6, "Thịt chim dai, thơm."],
  ["meat_monster", "Thịt Quái Vật Lạ", "meat", "#8a4ab0", 9, "Không ai biết đây là thịt gì. Nhưng nấu lên lại rất ngon."],
];
for (const [id, name, shape, col, value, desc] of animal) I(id, name, "animal", value, desc, shape, [col, C.brown, "#ffffff"]);

// ------------------------------------------------------------ fertilisers
const ferts: [string, string, string, number, number, number, string][] = [
  ["compost", "Phân Ủ", "#6a4a2a", 3, 1, 0, "Ủ từ phụ phẩm nông nghiệp. +1 độ màu mỡ cho ô ruộng."],
  ["bone_meal", "Bột Xương", "#e8dcc0", 6, 1, 1, "Nghiền từ xương. +1 màu mỡ, cây lớn nhanh hơn 1 ngày."],
  ["spore_fert", "Phân Bào Tử", "#b070d0", 10, 2, 0, "Bào tử nấm phân giải đất. +2 màu mỡ."],
  ["spirit_fert", "Phân Linh Khí", "#5ab0ff", 25, 2, 1, "Trộn tinh thể ma lực. +2 màu mỡ, nhanh hơn 1 ngày."],
  ["gold_fert", "Phân Kim Tuyến", "#f2c542", 60, 3, 2, "Phân bón thượng hạng. Đất thành Linh Thổ, nhanh hơn 2 ngày."],
];
for (const [id, name, col, value, soil, speed, desc] of ferts) I(id, name, "fertilizer", value, desc, "compost", [C.leaf, col, col], { fert: { soil, speed } });
