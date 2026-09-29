import type { Cost } from "./buildings";
import { BIOME_MATS, CONSUMABLE_RECIPES, EQUIP_RECIPES, ITEMS, METALS } from "./items";
import type { Station } from "./items/recipeTypes";

export type { Station } from "./items/recipeTypes";

export interface Recipe {
  id: string;
  station: Station;
  level: number; // required station level
  out: string;
  n: number;
  cost: Cost;
}

const list: Recipe[] = [];
const R = (station: Station, level: number, out: string, cost: Cost, n = 1) => {
  for (const k of Object.keys(cost)) if (!ITEMS[k] && k !== "gold") throw new Error(`Recipe ${out} uses unknown item ${k}`);
  if (!ITEMS[out]) throw new Error(`Recipe output unknown: ${out}`);
  list.push({ id: `${station}:${out}:${list.length}`, station, level, out, n, cost });
};

// ------------------------------------------------------------ processing
const TIER: Record<string, number> = { forest: 1, desert: 1, swamp: 2, tundra: 2, fungal: 2, volcano: 3, reef: 3, bamboo: 3, crystal: 4, autumn: 3, ruins: 4, sakura: 4, bonewaste: 4, jungle: 4, glacier: 5 };
for (const [biome, m] of Object.entries(BIOME_MATS)) {
  const lv = TIER[biome] ?? 1;
  R("sawmill", lv, m.plank, { [m.wood]: 2 }, 2);
  R("workshop", lv, m.block, { [m.stone]: 2 }, 2);
  R("tailor", lv, m.cloth, { [m.fiber]: 2 });
  R("tailor", lv, m.leather, { [m.hide]: 2 });
  R("alchemy", Math.min(4, lv), m.extract, { [m.herb]: 2 });
}
R("sawmill", 1, "charcoal", { wood: 2 }, 2);
R("sawmill", 1, "resin", { wood: 1, herb: 1 }, 2);
R("sawmill", 1, "paper", { wood: 1, fiber_forest: 1 }, 3);
R("workshop", 1, "sand", { stone: 2 }, 3);
R("workshop", 1, "clay", { stone: 1, slime_gel: 1 }, 3);
R("workshop", 1, "brick", { clay: 2, charcoal: 1 }, 2);
R("workshop", 1, "mortar", { sand: 1, stone: 1 }, 2);
R("workshop", 2, "glass", { sand: 2, charcoal: 1 });
R("workshop", 2, "nails", { iron_ingot: 1 }, 4);
R("workshop", 2, "gears", { copper_ingot: 2, nails: 1 });
R("workshop", 2, "ink", { mana_crystal: 1, charcoal: 1 }, 3);
R("workshop", 2, "dye", { fire_berry: 1, blue_flax: 1 }, 2);
R("tailor", 1, "rope", { fiber_forest: 3 }, 2);
R("tailor", 1, "cloth_forest", { wool: 2 });
R("tailor", 1, "cloth_forest", { cloud_cotton: 2 });
R("tailor", 1, "cloth_forest", { blue_flax: 3 });
R("tailor", 2, "cloth_sakura", { silk_cocoon: 2 });
for (const m of METALS) R("forge", Math.max(1, Math.ceil(m.tier / 2)), m.ingot, m.tier >= 3 ? { [m.ore]: 2, charcoal: 1 } : { [m.ore]: 2 });

// ------------------------------------------------------------ fertiliser (compost pit)
R("compost", 1, "compost", { herb: 3 }, 2);
R("compost", 1, "compost", { wheat: 2, moon_radish: 1 }, 3);
R("compost", 1, "compost", { spore_dust: 1, wood: 1 }, 2);
R("compost", 1, "bone_meal", { bone: 2 }, 2);
R("compost", 2, "spore_fert", { spore_dust: 2, compost: 1 }, 2);
R("compost", 2, "spirit_fert", { compost: 2, mana_crystal: 1 }, 2);
R("compost", 3, "gold_fert", { spirit_fert: 2, essence_earth: 1 }, 2);

// ------------------------------------------------------------ legacy equipment recipes
R("forge", 1, "iron_sword", { iron_ore: 3, wood: 1 });
R("forge", 1, "oak_staff", { wood: 3, mushroom_cap: 1 });
R("forge", 1, "hunter_bow", { wood: 2, hide: 2 });
R("forge", 1, "fang_dagger", { fang: 3, wood: 1 });
R("forge", 1, "bark_shield", { wood: 3, hide: 2 });
R("tailor", 1, "leather_armor", { hide: 3 });
R("tailor", 1, "mushroom_robe", { mushroom_cap: 2, slime_gel: 2 });
R("forge", 1, "fang_necklace", { fang: 2, hide: 1 });
R("forge", 1, "herb_charm", { herb: 4, slime_gel: 2, mana_crystal: 1 });
R("forge", 2, "amber_blade", { amber: 3, iron_ore: 3, monster_core: 1 });
R("forge", 2, "sun_staff", { amber: 2, sandstone: 2, mana_crystal: 1 });
R("forge", 2, "chitin_bow", { chitin: 3, wood: 2 });
R("forge", 2, "scorpion_dagger", { chitin: 2, bone: 2, iron_ore: 1 });
R("forge", 2, "sandstone_shield", { sandstone: 4, iron_ore: 2, hide: 1 });
R("forge", 2, "chitin_armor", { chitin: 4, hide: 2 });
R("tailor", 2, "desert_robe", { linen: 3, amber: 1 });
R("forge", 2, "amber_amulet", { amber: 2, bone: 1 });
R("tailor", 2, "sand_boots", { hide: 2, linen: 2 });
R("forge", 3, "bog_axe", { bog_iron: 4, wood: 2, monster_core: 2 });
R("forge", 3, "lantern_staff", { soul_wax: 2, peat: 1, mana_crystal: 2 });
R("forge", 3, "pearl_bow", { pearl: 1, wood: 3, bog_iron: 2 });
R("forge", 3, "bog_shield", { bog_iron: 5, peat: 2 });
R("forge", 3, "bog_plate", { bog_iron: 5, peat: 2, hide: 2 });
R("tailor", 3, "glowmoss_cloak", { glowmoss: 4, linen: 2 });
R("forge", 3, "black_pearl_ring", { pearl: 2, soul_wax: 1 });
R("forge", 3, "soul_charm", { soul_wax: 2, glowmoss: 1 });

for (const s of [...CONSUMABLE_RECIPES, ...EQUIP_RECIPES]) R(s.station, s.level, s.out, s.cost, s.n);

export const RECIPES = list;
export const STATION_NAMES: Record<Station, string> = {
  kitchen: "Bếp Lửa", alchemy: "Phòng Giả Kim", forge: "Lò Rèn", sawmill: "Xưởng Cưa", workshop: "Xưởng Đá & Thủy Tinh",
  tailor: "Xưởng May & Thuộc Da", library: "Thư Viện Phép", compost: "Hố Ủ Phân",
};

/** Research cost in the library. Off-class skills cost double. */
export function researchCost(tier: number, passive: boolean, offClass: boolean): Cost {
  const m = offClass ? 2 : 1;
  return passive
    ? { mana_crystal: tier * 2 * m, gold: 60 * tier * tier * m }
    : { mana_crystal: (tier * 2 - 1) * m, gold: 50 * tier * tier * m };
}
