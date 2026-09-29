import { Rng } from "../core/rng";
import type { Element } from "../combat/types";
import { ARCHETYPES, BOSS_ARCHETYPES, themedEnemy } from "../data/enemies";
import { BIOME_CYCLE } from "./biomes";

export interface FloorDef {
  n: number;
  name: string;
  biome: string;
  intro: string;
  regions: string[];
  enemies: string[];
  groups: string[][];
  boss: string[]; // guardian battle group
  guardian: string; // story event id
  events: { id: string; region: number }[];
  randomEvents: number;
  levelBase: number;
  handwritten: boolean;
}

export const MAX_FLOOR = 100;

const HANDWRITTEN: FloorDef[] = [
  {
    n: 1, name: "Rừng Nguyên Sinh Thì Thầm", biome: "forest", handwritten: true, levelBase: 1,
    intro: "Những thân cây cổ thụ cao tới mức ngọn của chúng tan vào lớp sương mù phát sáng — thứ thay thế cho bầu trời dưới Vực Sâu. Gió lướt qua tán lá, và bạn thề rằng mình nghe thấy tiếng người thì thầm.",
    regions: ["Bìa Rừng Sương Sớm", "Thung Lũng Đom Đóm", "Làng Nấm Mũ Đỏ", "Suối Nước Mắt", "Trại Thợ Săn Bỏ Hoang", "Rễ Cổ Thụ Mẹ"],
    enemies: ["moss_slime", "forest_wolf", "mushroomling", "giant_wasp", "stone_boar", "sapling"],
    groups: [["moss_slime", "moss_slime"], ["forest_wolf", "forest_wolf"], ["mushroomling", "moss_slime"], ["giant_wasp", "giant_wasp"], ["stone_boar"], ["sapling", "mushroomling"], ["forest_wolf", "giant_wasp"], ["moss_slime", "mushroomling", "moss_slime"]],
    boss: ["sapling", "ancient_treant", "sapling"],
    guardian: "f1_guardian",
    events: [
      { id: "f1_whisper", region: 0 }, { id: "f1_fireflies", region: 1 }, { id: "f1_village", region: 2 },
      { id: "f1_tears", region: 3 }, { id: "f1_hunter_camp", region: 4 }, { id: "f1_lyra", region: 1 },
    ],
    randomEvents: 5,
  },
  {
    n: 2, name: "Biển Cát Hổ Phách", biome: "desert", handwritten: true, levelBase: 5,
    intro: "Cầu thang đá mở ra một sa mạc vô tận dưới 'mặt trời' là một khối hổ phách khổng lồ treo lơ lửng. Ánh sáng vàng mật khiến mọi thứ trông như đã bị đông cứng từ ngàn năm trước. Dưới những cồn cát, thứ gì đó đang hát.",
    regions: ["Cồn Cát Hát", "Ốc Đảo Gương", "Cổng Thành Zahr", "Thung Lũng Hổ Phách", "Nghĩa Địa Lữ Hành", "Mắt Bão"],
    enemies: ["amber_scorpion", "sand_lizard", "mummy", "vulture", "dust_djinn", "cactus_ghoul"],
    groups: [["amber_scorpion", "amber_scorpion"], ["sand_lizard", "vulture"], ["mummy", "mummy"], ["dust_djinn", "amber_scorpion"], ["cactus_ghoul", "sand_lizard"], ["vulture", "vulture", "vulture"], ["mummy", "dust_djinn"]],
    boss: ["sand_wyrm"],
    guardian: "f2_guardian",
    events: [
      { id: "f2_caravan", region: 0 }, { id: "f2_oasis", region: 1 }, { id: "f2_zahr", region: 2 },
      { id: "f2_amber", region: 3 }, { id: "f2_graveyard", region: 4 }, { id: "f2_storm", region: 5 },
    ],
    randomEvents: 5,
  },
  {
    n: 3, name: "Đầm Lầy Đèn Ma", biome: "swamp", handwritten: true, levelBase: 9,
    intro: "Nước đen phẳng lặng như gương, phản chiếu hàng vạn chiếc đèn lồng lơ lửng không ai thắp. Mỗi ngọn lửa nhỏ run rẩy như một hơi thở. Người ta nói, dưới làn nước này là cả một vương quốc đã tự dìm mình.",
    regions: ["Bến Đò Không Người", "Rừng Đước Tối", "Làng Người Ếch", "Tháp Chuông Chìm", "Hồ Đèn Lồng", "Cung Điện Ngập Nước"],
    enemies: ["frogman", "wisp", "drowned", "leech", "bog_crab", "lantern_ghost"],
    groups: [["frogman", "frogman"], ["wisp", "wisp", "wisp"], ["drowned", "leech"], ["bog_crab", "frogman"], ["lantern_ghost", "wisp"], ["drowned", "drowned"], ["leech", "bog_crab"]],
    boss: ["wisp", "drowned_queen", "wisp"],
    guardian: "f3_guardian",
    events: [
      { id: "f3_ferry", region: 0 }, { id: "f3_morwen", region: 1 }, { id: "f3_frogs", region: 2 },
      { id: "f3_bell", region: 3 }, { id: "f3_lanterns", region: 4 }, { id: "f3_kaito", region: 5 },
    ],
    randomEvents: 5,
  },
];

const THEME: Record<string, { el: Element; word: string; color: string; titles: string[]; nouns: string[] }> = {
  tundra: { el: "ice", word: "Băng Giá", color: "#8fd8ff", titles: ["Băng Nguyên Vĩnh Cửu", "Vương Quốc Sương Giá", "Cánh Đồng Tuyết Than Khóc"], nouns: ["Đồng Tuyết", "Hẻm Băng", "Rừng Thông Trắng", "Hồ Đóng Băng", "Đèo Gió Rét", "Làng Bỏ Hoang"] },
  fungal: { el: "poison", word: "Bào Tử", color: "#c070e0", titles: ["Rừng Nấm Khổng Lồ", "Vườn Bào Tử Mộng Mị", "Thành Phố Sợi Nấm"], nouns: ["Tán Nấm", "Hang Bào Tử", "Suối Phát Quang", "Mạng Sợi Nấm", "Đồi Mốc Tím", "Vườn Mộng"] },
  volcano: { el: "fire", word: "Hỏa Ngục", color: "#ff6a2a", titles: ["Lò Rèn Của Thần", "Núi Lửa Thịnh Nộ", "Sông Dung Nham"], nouns: ["Miệng Núi", "Sông Dung Nham", "Đồng Tro", "Hang Lửa", "Cầu Đá Đen", "Suối Lưu Huỳnh"] },
  reef: { el: "water", word: "Thủy Triều", color: "#3aa0c8", titles: ["Rạn San Hô Cạn", "Đáy Biển Khô", "Mê Cung Thủy Triều"], nouns: ["Rạn San Hô", "Bãi Vỏ Sò", "Hố Xoáy", "Xác Tàu", "Đầm Nước Mặn", "Đảo Ngọc Trai"] },
  bamboo: { el: "wind", word: "Phong Vũ", color: "#9ef0c0", titles: ["Rừng Trúc Gió Hát", "Thung Lũng Phong Linh", "Đồi Trúc Vô Tận"], nouns: ["Rừng Trúc", "Đền Gió", "Suối Đá", "Đồi Chuông Gió", "Cầu Treo", "Vực Mây"] },
  crystal: { el: "arcane", word: "Pha Lê", color: "#ff8cf0", titles: ["Hang Pha Lê Ca Hát", "Mạch Ma Lực", "Cung Điện Lăng Kính"], nouns: ["Hang Lăng Kính", "Mạch Tinh Thể", "Hồ Ánh Sao", "Vòm Pha Lê", "Giếng Ma Lực", "Đại Sảnh Gương"] },
  autumn: { el: "earth", word: "Thu Tàn", color: "#e0602a", titles: ["Rừng Thu Không Tàn", "Mùa Lá Rơi Vĩnh Viễn", "Thung Lũng Hổ Phách Đỏ"], nouns: ["Đồi Lá Đỏ", "Vườn Táo Hoang", "Suối Lá", "Rừng Phong", "Cối Xay Cũ", "Nghĩa Trang Lá"] },
  ruins: { el: "dark", word: "Phế Tích", color: "#6a6258", titles: ["Phế Đô Thất Lạc", "Thành Phố Của Những Kẻ Đến Trước", "Đế Đô Sụp Đổ"], nouns: ["Quảng Trường", "Thư Viện Đổ", "Cổng Thành", "Đấu Trường", "Cung Điện Vỡ", "Hầm Mộ"] },
  sakura: { el: "wind", word: "Anh Đào", color: "#f090b8", titles: ["Cao Nguyên Anh Đào", "Mùa Xuân Không Bao Giờ Hết", "Đền Hoa Rơi"], nouns: ["Đồi Hoa", "Đền Thiêng", "Hồ Cá Chép", "Cầu Đỏ", "Vườn Trà", "Thác Cánh Hoa"] },
  bonewaste: { el: "dark", word: "Tử Địa", color: "#8a6a8a", titles: ["Hoang Mạc Xương", "Nghĩa Địa Của Các Vị Thần", "Đồng Bằng Tử Khí"], nouns: ["Đồi Xương", "Sườn Rồng Chết", "Hố Tử Khí", "Đền Hài Cốt", "Thung Lũng Im Lặng", "Tháp Sọ"] },
  jungle: { el: "poison", word: "Rừng Mưa", color: "#4ac04a", titles: ["Rừng Mưa Nguyên Thủy", "Mê Cung Dây Leo", "Trái Tim Xanh"], nouns: ["Tán Rừng", "Đền Rêu", "Thác Lớn", "Đầm Cá Sấu", "Rễ Khổng Lồ", "Làng Trên Cây"] },
  glacier: { el: "ice", word: "Sông Băng", color: "#a8d0f0", titles: ["Sông Băng Ngủ Say", "Tháp Băng Vĩnh Hằng", "Đại Dương Đóng Băng"], nouns: ["Khe Nứt", "Hang Băng Xanh", "Đỉnh Tuyết", "Hồ Gương Băng", "Cột Băng", "Mộ Băng"] },
  forest: { el: "earth", word: "Cổ Mộc", color: "#4a9a4a", titles: ["Rừng Cổ Mộc Sâu Thẳm", "Rừng Rễ Treo", "Khu Rừng Nuốt Chửng Ánh Sáng"], nouns: ["Rễ Cổ", "Trảng Cỏ", "Suối Rêu", "Hốc Cây", "Rừng Sâu", "Vòng Nấm"] },
  desert: { el: "fire", word: "Nắng Cháy", color: "#e0a040", titles: ["Sa Mạc Mặt Trời Kép", "Biển Cát Đỏ", "Hoang Mạc Ảo Ảnh"], nouns: ["Cồn Cát", "Ốc Đảo", "Kim Tự Tháp", "Hẻm Đá Đỏ", "Khu Chợ Ma", "Giếng Cạn"] },
  swamp: { el: "water", word: "Chướng Khí", color: "#3a8a6a", titles: ["Đầm Lầy Vô Danh", "Biển Sương Độc", "Vùng Nước Chết"], nouns: ["Bãi Lầy", "Rừng Đước", "Nhà Sàn", "Hồ Đen", "Đảo Nổi", "Cây Treo Cổ"] },
};

const DESCRIPTORS = ["Thì Thầm", "Bị Lãng Quên", "Vô Tận", "Than Khóc", "Rực Rỡ", "Im Lặng", "Đổ Nát", "Mộng Mị"];

const cache = new Map<number, FloorDef>();

export function levelBase(n: number) {
  if (n <= 3) return HANDWRITTEN[n - 1].levelBase;
  return Math.round(12 + (n - 4) * 0.86);
}

export function getFloor(n: number): FloorDef {
  if (n <= HANDWRITTEN.length) return HANDWRITTEN[n - 1];
  const hit = cache.get(n);
  if (hit) return hit;
  const rng = new Rng(n * 7919);
  const biome = BIOME_CYCLE[(n - 4) % BIOME_CYCLE.length];
  const th = THEME[biome];
  const cycle = Math.floor((n - 4) / BIOME_CYCLE.length);
  const title = th.titles[cycle % th.titles.length];
  const archetypes = rng.shuffle([...ARCHETYPES]).slice(0, 5);
  const enemies = archetypes.map((a) => themedEnemy(a, th.el, th.word, th.color).id);
  const boss = themedEnemy(BOSS_ARCHETYPES[n % BOSS_ARCHETYPES.length], th.el, `Chúa Tể ${th.word}`, th.color, true).id;
  const groups: string[][] = [];
  for (let i = 0; i < 8; i++) {
    const size = rng.int(2, 3);
    groups.push(Array.from({ length: size }, () => rng.pick(enemies)));
  }
  const regions = rng.shuffle([...th.nouns]).map((noun) => `${noun} ${rng.pick(DESCRIPTORS)}`);
  const def: FloorDef = {
    n, biome, name: cycle ? `${title} ${["", "II", "III", "IV", "V", "VI", "VII"][cycle] ?? cycle + 1}`.trim() : title,
    handwritten: false,
    levelBase: levelBase(n),
    intro: `Tầng ${n} của Vực Sâu trải ra trước mắt: ${title.toLowerCase()}. Không khí đặc quánh ma lực hệ ${th.word.toLowerCase()}. Nơi đây vẫn đang chờ người kể chuyện — những bí mật của nó sẽ được viết trong các bản cập nhật sau.`,
    regions,
    enemies,
    groups,
    boss: [enemies[0], boss, enemies[1]],
    guardian: "g_guardian",
    events: [],
    randomEvents: 9,
  };
  cache.set(n, def);
  return def;
}

/** How many settlements (villages, towns, cities) a floor has. */
export function settlementCount(n: number): number {
  if (n <= 1) return 1;
  if (n < 5) return 2;
  return 2 + (n % 3 === 0 ? 1 : 0) + (n >= 20 && n % 2 === 0 ? 1 : 0);
}
