import { Rng } from "../core/rng";
import type { Element } from "../combat/types";
import "../data/world";
import "../story/world";
import { FLOOR_EVENTS, FLOOR_GUARDIAN, SPECS, biomeFromSpec, bossId, fallbackSpec, mobId, registerMonsters, registerSig, type Family, type FloorSpec } from "./floorSpec";

export interface FloorDef {
  n: number;
  name: string;
  biome: string; // unique biome id (visuals)
  family: Family; // material / culture family
  el: Element;
  biomeName: string;
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

const HANDWRITTEN: Omit<FloorDef, "family" | "el" | "biomeName">[] = [
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

const cache = new Map<number, FloorDef>();

export function levelBase(n: number) {
  if (n <= 3) return HANDWRITTEN[n - 1].levelBase;
  return Math.round(12 + (n - 4) * 0.86);
}

export function specFor(n: number): FloorSpec {
  return SPECS[n] ?? fallbackSpec(n);
}

export function getFloor(n: number): FloorDef {
  const hit = cache.get(n);
  if (hit) return hit;
  const spec = specFor(n);
  registerSig(spec);
  const biome = biomeFromSpec(spec).id;
  let def: FloorDef;
  if (n <= HANDWRITTEN.length) {
    const h = HANDWRITTEN[n - 1];
    def = {
      ...h, biome, family: spec.fam, el: spec.el, biomeName: spec.biome,
      regions: [...h.regions, ...spec.places.filter((p) => !h.regions.includes(p))].slice(0, 12),
      events: [...h.events, ...(FLOOR_EVENTS[n] ?? [])],
      randomEvents: 12,
    };
  } else {
    registerMonsters(spec);
    const rng = new Rng(n * 7919);
    const enemies = spec.mobs.map((_, i) => mobId(n, i));
    const groups: string[][] = [];
    for (let i = 0; i < 12; i++) {
      const size = rng.int(1, 3) + (n > 20 && rng.chance(0.3) ? 1 : 0);
      const lead = enemies[i % enemies.length];
      groups.push([lead, ...Array.from({ length: size - 1 }, () => rng.pick(enemies))]);
    }
    def = {
      n, biome, family: spec.fam, el: spec.el, biomeName: spec.biome,
      name: spec.name,
      handwritten: !!SPECS[n],
      levelBase: levelBase(n),
      intro: spec.intro,
      regions: spec.places.slice(0, 12),
      enemies,
      groups,
      boss: [enemies[0], bossId(n), enemies[1]],
      guardian: FLOOR_GUARDIAN[n] ?? "g_guardian",
      events: FLOOR_EVENTS[n] ?? [],
      randomEvents: 14,
    };
  }
  cache.set(n, def);
  return def;
}

// Every floor's signature material and relic exist from the start, so saved inventories resolve.
for (let n = 1; n <= MAX_FLOOR; n++) registerSig(specFor(n));

/** How many settlements (villages, towns, cities) a floor has. */
export function settlementCount(n: number): number {
  const towns = SPECS[n]?.towns;
  if (towns) return towns.length;
  if (n <= 1) return 2;
  if (n < 5) return 3;
  return 3 + (n % 3 === 0 ? 1 : 0) + (n >= 20 && n % 2 === 0 ? 1 : 0);
}
