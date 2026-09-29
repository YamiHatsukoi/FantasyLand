import type { Palette } from "../../render/icons";
import { C, I, ITEMS } from "./core";

// ------------------------------------------------------------ metals (tiered by floor depth)
export interface Metal { tier: number; ore: string; ingot: string; name: string; col: string }
const metalRows: [string, string, string, string, string][] = [
  // ore id, ingot id, metal name, ore display name, colour
  ["copper_ore", "copper_ingot", "Đồng", "Quặng Đồng", "#d8804a"],
  ["iron_ore", "iron_ingot", "Sắt", "Quặng Sắt", "#9aa4b0"],
  ["bog_iron", "steel_ingot", "Thép Đen", "Sắt Đầm Lầy", "#5a6470"],
  ["silver_ore", "silver_ingot", "Bạc Tinh", "Quặng Bạc Tinh", "#d8e4f0"],
  ["darkiron_ore", "darkiron_ingot", "Hắc Thiết", "Quặng Hắc Thiết", "#3a3448"],
  ["mithril_ore", "mithril_ingot", "Mithril", "Quặng Mithril", "#8ad8f0"],
  ["warcrystal_ore", "warcrystal_ingot", "Chiến Tinh", "Quặng Chiến Tinh", "#c070f0"],
  ["adamant_ore", "adamant_ingot", "Adamantit", "Quặng Adamantit", "#40c890"],
  ["dragon_ore", "dragon_ingot", "Long Tinh", "Quặng Long Tinh", "#e84a3a"],
  ["orichalcum_ore", "orichalcum_ingot", "Orichalcum", "Quặng Orichalcum", "#f0b030"],
  ["meteor_ore", "meteor_ingot", "Thiên Thạch", "Mảnh Thiên Thạch", "#6a5ad8"],
  ["divine_ore", "divine_ingot", "Thần Kim", "Quặng Thần Kim", "#fff0a0"],
];
export const METALS: Metal[] = metalRows.map(([ore, ingot, name, oreName, col], i) => {
  const tier = i + 1;
  I(ore, oreName, "material", 4 + tier * 6, `Quặng kim loại bậc ${tier}, luyện thành ${name} ở Lò Luyện Kim.`, "ore", [col, C.darkStone, "#ffffff"], { tier, icon: "⛏️" });
  I(ingot, `Thỏi ${name}`, "material", 12 + tier * 16, `Kim loại bậc ${tier} đã tinh luyện — nguyên liệu rèn trang bị và xây dựng.`, "ingot", [col, C.darkStone, "#ffffff"], { tier, icon: "🟨" });
  return { tier, ore, ingot, name, col };
});

/** Metal tier found on a given floor (1..12). */
export const metalTierForFloor = (floor: number) => Math.max(1, Math.min(12, Math.ceil(floor / 8.4)));

// ------------------------------------------------------------ biome families
export interface BiomeMats {
  wood: string; stone: string; herb: string; fiber: string; hide: string; gem: string;
  plank: string; block: string; extract: string; cloth: string; leather: string;
}

type Row = [
  biome: string, suffix: string,
  wood: [string, string, string] | string, stone: [string, string, string] | string, herb: [string, string, string, string?] | string,
  fiber: [string, string, string] | string, hide: [string, string, string, string?] | string, gem: [string, string, string] | string,
];
// [id, name, colour] or an existing item id.
const ROWS: Row[] = [
  ["forest", "Rừng", "wood", "stone", "herb", ["fiber_forest", "Sợi Dây Leo", "#7aa84a"], "hide", ["emerald", "Ngọc Lục Bảo", "#3ad86a"]],
  ["desert", "Sa Mạc", ["wood_desert", "Gỗ Keo Khô", "#c89a5a"], "sandstone", ["herb_desert", "Cỏ Lửa Sa Mạc", "#d8703a"], ["fiber_desert", "Sợi Cọ Chà Là", "#d8b87a"], ["hide_desert", "Da Thằn Lằn Cát", "#c8a060"], "amber"],
  ["swamp", "Đầm", ["wood_swamp", "Gỗ Đước Đen", "#4a3a2a"], ["stone_swamp", "Đá Phiến Đầm", "#5a6a5a"], "glowmoss", ["fiber_swamp", "Sợi Cói", "#8a9a5a"], ["hide_swamp", "Da Ếch Độc", "#4a8a5a"], "pearl"],
  ["tundra", "Tuyết", ["wood_tundra", "Gỗ Thông Tuyết", "#6a5a4a"], ["stone_tundra", "Đá Băng Xanh", "#9ac0e0"], ["herb_tundra", "Hoa Tuyết Liên", "#e8f4ff", "flower"], ["fiber_tundra", "Lông Tuần Lộc", "#e8e0d0"], ["hide_tundra", "Da Gấu Tuyết", "#f0f0f0"], ["frost_gem", "Ngọc Băng Tâm", "#8ad8ff"]],
  ["fungal", "Nấm", ["wood_fungal", "Thân Nấm Cứng", "#d8c8e0"], ["stone_fungal", "Đá Bào Tử", "#7a6a8a"], ["herb_fungal", "Nấm Mộng Mị", "#c070e0", "mushroom"], ["fiber_fungal", "Sợi Nấm Trắng", "#f0e8f0"], ["hide_fungal", "Da Sên Khổng Lồ", "#a08ab0"], ["spore_gem", "Ngọc Bào Tử Tím", "#b04ae0"]],
  ["volcano", "Hỏa", ["wood_volcano", "Gỗ Than Hồng", "#3a2a2a"], ["obsidian", "Hắc Diệu Thạch", "#2a2438"], ["herb_volcano", "Ớt Hỏa Diệm", "#ff4a2a", "fruit"], ["fiber_volcano", "Sợi Chịu Lửa", "#b0a090"], ["hide_volcano", "Vảy Kỳ Nhông Lửa", "#e8602a", "scale"], ["ruby", "Hồng Ngọc Lửa", "#ff3a4a"]],
  ["reef", "Biển", ["wood_reef", "Gỗ Trôi Dạt", "#b0a080"], ["stone_reef", "Đá San Hô", "#f08a8a"], ["herb_reef", "Tảo Biển Ngọc", "#3ac0a0"], ["fiber_reef", "Sợi Rong Biển", "#4a8a6a"], ["hide_reef", "Da Cá Mập", "#6a8aa0"], ["aquamarine", "Ngọc Xanh Biển", "#5ae0f0"]],
  ["bamboo", "Trúc", ["wood_bamboo", "Trúc Ngọc", "#8aca5a"], ["stone_bamboo", "Đá Suối Mài", "#a0a8a0"], ["herb_bamboo", "Lá Trà Gió", "#6ab04a"], ["fiber_bamboo", "Sợi Tre", "#c8d890"], ["hide_bamboo", "Da Hổ Vằn", "#e8902a"], ["jade", "Ngọc Phỉ Thúy", "#4ad890"]],
  ["crystal", "Pha Lê", ["wood_crystal", "Rễ Pha Lê", "#a0c8ff"], ["stone_crystal", "Đá Lăng Kính", "#c8b8ff"], ["herb_crystal", "Cỏ Ánh Sao", "#fff6a8", "flower"], ["fiber_crystal", "Tơ Ánh Sáng", "#f0f0ff"], ["hide_crystal", "Da Thạch Sùng Pha Lê", "#8ab0e0", "scale"], ["amethyst", "Thạch Anh Tím", "#a060f0"]],
  ["autumn", "Thu", ["wood_autumn", "Gỗ Phong Đỏ", "#a03a2a"], ["stone_autumn", "Đá Đỏ Thu", "#b86a4a"], ["herb_autumn", "Lá Phong Thuốc", "#e0602a"], ["fiber_autumn", "Sợi Gai Dầu", "#b8a060"], ["hide_autumn", "Da Hươu Đỏ", "#b0603a"], ["agate", "Mã Não", "#e8904a"]],
  ["ruins", "Cổ", ["wood_ruins", "Gỗ Mục Cổ", "#6a5a4a"], ["marble", "Cẩm Thạch Cổ", "#e8e4d8"], ["herb_ruins", "Rêu Phế Tích", "#6a8a5a"], ["fiber_ruins", "Sợi Cờ Cổ", "#a0303a"], ["hide_ruins", "Da Chó Săn Đá", "#8a8a8a"], ["seal_gem", "Ngọc Ấn Cổ", "#d8c070"]],
  ["sakura", "Anh Đào", ["wood_sakura", "Gỗ Anh Đào", "#8a4a3a"], ["stone_sakura", "Đá Suối Hồng", "#e8c0c8"], ["herb_sakura", "Cánh Hoa Anh Đào", "#ffb0d0", "flower"], ["fiber_sakura", "Tơ Tằm Hồng", "#ffd8e8"], ["hide_sakura", "Da Cáo Chín Đuôi", "#f0a060"], ["rose_gem", "Ngọc Hồng Anh", "#ff80b0"]],
  ["bonewaste", "Tử", ["wood_bone", "Gỗ Xương Hoá Thạch", "#d8d0c0"], ["stone_bone", "Đá Tử Khí", "#5a4a5a"], ["herb_bone", "Hoa Tử Linh", "#8a5aa0", "flower"], ["fiber_bone", "Vải Liệm Đen", "#3a3040"], ["hide_bone", "Da Dơi Tử", "#4a3a4a"], ["soul_gem", "Ngọc Hồn Đen", "#5a2a8a"]],
  ["jungle", "Rừng Mưa", ["wood_jungle", "Gỗ Cọ Rừng", "#6a4a2a"], ["stone_jungle", "Đá Rêu Xanh", "#4a7a4a"], ["herb_jungle", "Lá Rừng Thiêng", "#2ac04a"], ["fiber_jungle", "Dây Mây", "#9a7a3a"], ["hide_jungle", "Da Báo Đốm", "#e0b040"], ["tiger_eye", "Ngọc Mắt Hổ", "#c8902a"]],
  ["glacier", "Băng", ["wood_glacier", "Gỗ Băng Hoá", "#a0c0d8"], ["stone_glacier", "Băng Vĩnh Cửu", "#c8e8ff"], ["herb_glacier", "Rêu Băng Lam", "#6ab0e0"], ["fiber_glacier", "Lông Mây Tuyết", "#f8f8ff"], ["hide_glacier", "Da Hải Mã", "#8a7a6a"], ["ice_diamond", "Kim Cương Băng", "#e8ffff"]],
];

export const BIOME_MATS: Record<string, BiomeMats> = {};
const tierOf: Record<string, number> = { forest: 1, desert: 2, swamp: 3, tundra: 4, fungal: 5, volcano: 6, reef: 7, bamboo: 8, crystal: 9, autumn: 10, ruins: 11, sakura: 12, bonewaste: 13, jungle: 14, glacier: 15 };

ROWS.forEach(([biome, suffix, wood, stone, herb, fiber, hide, gem]) => {
  const t = tierOf[biome];
  const v = (base: number) => Math.round(base * (1 + (t - 1) * 0.35));
  const mk = (x: [string, string, string, string?] | string, type: "material" | "herb", shape: string, desc: string, value: number, pal2: string): string => {
    if (typeof x === "string") return x;
    const [id, name, col, shp] = x;
    const pal: Palette = [col, pal2, "#ffffff"];
    I(id, name, type, v(value), desc, shp ?? shape, pal, { tier: t, tags: [biome] });
    return id;
  };
  const w = mk(wood as [string, string, string], "material", "log", `Gỗ đặc trưng của vùng ${suffix}.`, 3, C.paleWood);
  const s = mk(stone as [string, string, string], "material", "stone", `Đá xây dựng của vùng ${suffix}.`, 3, C.darkStone);
  const h = mk(herb, "herb", "herb", `Thảo mộc vùng ${suffix}. Có thể dùng trực tiếp để hồi chút máu, hoặc chưng cất thành tinh dầu.`, 4, C.green);
  const f = mk(fiber as [string, string, string], "material", "fiber", `Sợi thô vùng ${suffix}, dệt thành vải.`, 3, C.brown);
  const hd = mk(hide, "material", "hide", `Da/vảy thú vùng ${suffix}, thuộc thành vật liệu may giáp.`, 5, C.brown);
  const g = mk(gem as [string, string, string], "material", "gem", `Đá quý vùng ${suffix}, dùng khảm trang sức và công trình cao cấp.`, 30, "#ffffff");

  const nameOf = (id: string) => ITEM_NAME(id);
  const colOf = (id: string) => ITEM_COL(id);
  const plank = `plank_${biome}`, block = `block_${biome}`, extract = `extract_${biome}`, cloth = `cloth_${biome}`, leather = `leather_${biome}`;
  I(plank, `Ván ${nameOf(w).replace(/^Gỗ /, "Gỗ ")}`, "material", v(8), `Ván xẻ từ ${nameOf(w)}. Vật liệu xây dựng.`, "plank", [colOf(w), C.darkwood, "#ffffff"], { tier: t, tags: [biome, "processed"] });
  I(block, `Khối ${nameOf(s)}`, "material", v(8), `Đá ${nameOf(s)} đã đẽo vuông. Vật liệu xây dựng.`, "block", [colOf(s), C.darkStone, "#ffffff"], { tier: t, tags: [biome, "processed"] });
  I(extract, `Tinh Dầu ${nameOf(h)}`, "material", v(12), `Chưng cất từ ${nameOf(h)}. Nguyên liệu giả kim.`, "vial", [colOf(h), C.glass, "#ffffff"], { tier: t, tags: [biome, "processed"] });
  I(cloth, nameOf(f).startsWith("Sợi ") ? nameOf(f).replace(/^Sợi /, "Vải ") : `Vải ${nameOf(f)}`, "material", v(9), `Vải dệt từ ${nameOf(f)}.`, "cloth", [colOf(f), C.darkwood, "#ffffff"], { tier: t, tags: [biome, "processed"] });
  I(leather, `${nameOf(hd)} (đã thuộc)`, "material", v(11), `${nameOf(hd)} đã qua thuộc, bền và dẻo.`, "roll", [colOf(hd), C.darkwood, "#ffffff"], { tier: t, tags: [biome, "processed"] });
  BIOME_MATS[biome] = { wood: w, stone: s, herb: h, fiber: f, hide: hd, gem: g, plank, block, extract, cloth, leather };
});

// Lookups for items registered earlier (legacy.ts runs before this module).
function ITEM_NAME(id: string) { return ITEMS[id]?.name ?? id; }
function ITEM_COL(id: string) { return ITEMS[id]?.col[0] ?? C.stone; }

// ------------------------------------------------------------ monster parts
const parts: [string, string, string, string, number, string][] = [
  ["claw", "Vuốt Thú", "claw", "#e8dcc0", 6, "Vuốt sắc của quái thú."],
  ["feather", "Lông Vũ Quái Điểu", "feather", "#c8b8a0", 6, "Lông vũ cứng như thép của quái điểu."],
  ["monster_scale", "Vảy Quái", "scale", "#5a9a8a", 9, "Vảy cứng dùng gia cố giáp."],
  ["horn", "Sừng Quái", "horn", "#d8c8a0", 10, "Sừng xoắn của quái vật có sừng."],
  ["venom_sac", "Túi Nọc", "sac", "#8be04e", 9, "Túi nọc độc còn nguyên. Nguyên liệu thuốc giải và bom độc."],
  ["spider_silk", "Tơ Nhện Khổng Lồ", "silk", "#f0f0f0", 8, "Tơ nhện dai hơn dây thừng."],
  ["spore_dust", "Bụi Bào Tử", "dust", "#c070e0", 6, "Bào tử gây mê. Dùng làm thuốc ngủ và phân bón."],
  ["ectoplasm", "Tinh Chất Ma", "gel", "#a0f0e0", 14, "Chất nhớt phát sáng của hồn ma."],
  ["wing_membrane", "Màng Cánh", "wing", "#6a4a6a", 8, "Màng cánh mỏng mà dai của dơi và rồng nhỏ."],
  ["monster_eye", "Mắt Quái Vật", "orb", "#f0e04a", 12, "Con mắt vẫn còn chớp. Nguyên liệu phép thuật."],
  ["tusk", "Ngà Quái", "fang", "#f4efe6", 12, "Ngà cong của thú lớn."],
  ["shell_fragment", "Mảnh Mai Cứng", "shell", "#6a7a8a", 9, "Mảnh mai của cua và rùa quái."],
  ["monster_blood", "Máu Quái Vật", "vial", "#c02a3a", 10, "Máu còn ấm, giàu ma lực."],
  ["ember_heart", "Tim Hỏa Hồn", "essence", "#ff6a2a", 30, "Trái tim rực lửa của sinh vật nguyên tố."],
  ["frost_heart", "Tim Băng Hồn", "essence", "#8ad8ff", 30, "Trái tim lạnh buốt của sinh vật băng."],
  ["storm_heart", "Tim Lôi Hồn", "essence", "#ffe14a", 30, "Trái tim lách tách tia điện."],
];
for (const [id, name, shape, col, value, desc] of parts) I(id, name, "material", value, desc, shape, [col, C.darkStone, "#ffffff"], { tags: ["monster"] });

// ------------------------------------------------------------ elemental essences
export const ESSENCES: Record<string, string> = {};
const ess: [string, string, string][] = [
  ["fire", "Lửa", "#ff6a2a"], ["ice", "Băng", "#8ad8ff"], ["lightning", "Sét", "#ffe14a"], ["water", "Nước", "#4aa6ff"],
  ["earth", "Đất", "#c49a6c"], ["wind", "Gió", "#9ef0c0"], ["light", "Ánh Sáng", "#fff3a8"], ["dark", "Bóng Tối", "#8a5ad8"],
  ["poison", "Độc", "#8be04e"], ["arcane", "Huyền Bí", "#ff8cf0"],
];
for (const [el, name, col] of ess) {
  const id = `essence_${el}`;
  ESSENCES[el] = id;
  I(id, `Tinh Hoa ${name}`, "material", 40, `Ma lực hệ ${name.toLowerCase()} kết tinh. Rơi từ quái vật mang nguyên tố; dùng cho thuốc và trang bị cao cấp.`, "essence", [col, C.black, "#ffffff"], { tags: ["essence"] });
}

// ------------------------------------------------------------ generic crafted goods
const goods: [string, string, string, string, string, number, string][] = [
  ["charcoal", "Than Củi", "stone", "#2a2a2a", "#5a5a5a", 4, "Đốt từ gỗ. Nhiên liệu cho lò luyện."],
  ["sand", "Cát Trắng", "sand", "#f0e0b0", "#c8b080", 2, "Cát mịn, nấu thành thủy tinh."],
  ["glass", "Thủy Tinh", "glass", "#b8e8f0", "#6ab0c0", 10, "Thủy tinh trong suốt: cửa sổ, lọ thuốc, nhà kính."],
  ["clay", "Đất Sét", "stone", "#b0704a", "#7a4a2a", 2, "Đất sét dẻo, nung thành gạch."],
  ["brick", "Gạch Nung", "brick", "#b8503a", "#7a3a2a", 7, "Gạch đỏ chắc chắn."],
  ["rope", "Dây Thừng", "rope", "#c8a060", "#8a6a3a", 5, "Bện từ sợi thô."],
  ["nails", "Đinh Sắt", "nail", "#9aa4b0", "#5a6470", 6, "Một nắm đinh sắt."],
  ["gears", "Bánh Răng", "gear", "#c8a04a", "#7a5a2a", 20, "Bánh răng đồng dùng cho máy móc."],
  ["resin", "Nhựa Cây", "gel", "#e0a030", "#8a5a1a", 4, "Nhựa dính, dùng làm keo và đuốc."],
  ["dye", "Thuốc Nhuộm", "vial", "#c83a8a", "#6a2a5a", 8, "Nhuộm vải và trang trí."],
  ["paper", "Giấy Da", "scroll", "#e8dcc0", "#b8a070", 6, "Giấy da để viết cuộn phép."],
  ["ink", "Mực Ma Thuật", "bottle", "#2a2a5a", "#6a6ad8", 14, "Mực pha tinh thể ma lực."],
  ["mortar", "Vữa", "sand", "#c8c0b0", "#8a8478", 5, "Vữa kết dính gạch đá."],
];
for (const [id, name, shape, a, b, value, desc] of goods) I(id, name, "material", value, desc, shape, [a, b, "#ffffff"], { tags: ["goods"] });
