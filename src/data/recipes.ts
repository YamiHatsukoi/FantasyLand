import type { Cost } from "./buildings";

export interface Recipe {
  id: string;
  station: "kitchen" | "forge" | "alchemy";
  level: number; // required station level
  out: string;
  n: number;
  cost: Cost;
}

const list: Recipe[] = [];
const R = (station: Recipe["station"], level: number, out: string, cost: Cost, n = 1) =>
  list.push({ id: `${station}:${out}`, station, level, out, n, cost });

// kitchen
R("kitchen", 1, "bread", { wheat: 2 });
R("kitchen", 1, "stew", { moon_radish: 1, wheat: 1, herb: 1 });
R("kitchen", 1, "berry_jam", { fire_berry: 2 });
R("kitchen", 1, "mushroom_soup", { spirit_mushroom: 1, moon_radish: 1 });
R("kitchen", 2, "date_cake", { golden_date: 2, wheat: 1 });
R("kitchen", 2, "pumpkin_pie", { star_pumpkin: 1, wheat: 2 });
R("kitchen", 3, "lotus_tea", { ghost_lotus: 1, silver_herb: 1 });

// alchemy
R("alchemy", 1, "potion_hp", { herb: 2, slime_gel: 1 });
R("alchemy", 1, "potion_mp", { mushroom_cap: 2, silver_herb: 1 });
R("alchemy", 1, "antidote", { herb: 1, silver_herb: 1 });
R("alchemy", 1, "water_flask", { slime_gel: 1, herb: 1 }, 2);
R("alchemy", 2, "oil_flask", { cactus_fruit: 1, slime_gel: 1 }, 2);
R("alchemy", 2, "smoke_flask", { sandstone: 1, bone: 1 }, 2);
R("alchemy", 2, "phoenix_down", { amber: 2, mana_crystal: 1, silver_herb: 1 });
R("alchemy", 3, "frost_bomb", { glowmoss: 1, mana_crystal: 1 }, 2);
R("alchemy", 3, "thunder_bomb", { bog_iron: 1, mana_crystal: 1 }, 2);
R("alchemy", 3, "elixir", { star_pumpkin: 1, ghost_lotus: 1, mana_crystal: 2 });

// forge
R("forge", 1, "iron_sword", { iron_ore: 3, wood: 1 });
R("forge", 1, "oak_staff", { wood: 3, mushroom_cap: 1 });
R("forge", 1, "hunter_bow", { wood: 2, hide: 2 });
R("forge", 1, "fang_dagger", { fang: 3, wood: 1 });
R("forge", 1, "bark_shield", { wood: 3, hide: 2 });
R("forge", 1, "leather_armor", { hide: 3 });
R("forge", 1, "mushroom_robe", { mushroom_cap: 2, slime_gel: 2 });
R("forge", 1, "fang_necklace", { fang: 2, hide: 1 });
R("forge", 1, "herb_charm", { herb: 4, slime_gel: 2, mana_crystal: 1 });
R("forge", 2, "amber_blade", { amber: 3, iron_ore: 3, monster_core: 1 });
R("forge", 2, "sun_staff", { amber: 2, sandstone: 2, mana_crystal: 1 });
R("forge", 2, "chitin_bow", { chitin: 3, wood: 2 });
R("forge", 2, "scorpion_dagger", { chitin: 2, bone: 2, iron_ore: 1 });
R("forge", 2, "sandstone_shield", { sandstone: 4, iron_ore: 2, hide: 1 });
R("forge", 2, "chitin_armor", { chitin: 4, hide: 2 });
R("forge", 2, "desert_robe", { linen: 3, amber: 1 });
R("forge", 2, "amber_amulet", { amber: 2, bone: 1 });
R("forge", 2, "sand_boots", { hide: 2, linen: 2 });
R("forge", 3, "bog_axe", { bog_iron: 4, wood: 2, monster_core: 2 });
R("forge", 3, "lantern_staff", { soul_wax: 2, peat: 1, mana_crystal: 2 });
R("forge", 3, "pearl_bow", { pearl: 1, wood: 3, bog_iron: 2 });
R("forge", 3, "bog_shield", { bog_iron: 5, peat: 2 });
R("forge", 3, "bog_plate", { bog_iron: 5, peat: 2, hide: 2 });
R("forge", 3, "glowmoss_cloak", { glowmoss: 4, linen: 2 });
R("forge", 3, "black_pearl_ring", { pearl: 2, soul_wax: 1 });
R("forge", 3, "soul_charm", { soul_wax: 2, glowmoss: 1 });
R("forge", 4, "mithril_sword", { iron_ore: 12, mana_crystal: 4, monster_core: 3 });
R("forge", 4, "mithril_staff", { iron_ore: 8, mana_crystal: 8, monster_core: 3 });
R("forge", 4, "mithril_bow", { iron_ore: 10, wood: 6, mana_crystal: 4, monster_core: 3 });
R("forge", 4, "mithril_shield", { iron_ore: 16, mana_crystal: 3, monster_core: 3 });
R("forge", 4, "mithril_mail", { iron_ore: 16, mana_crystal: 4, monster_core: 4 });
R("forge", 4, "archmage_robe", { linen: 8, mana_crystal: 8, monster_core: 3 });
R("forge", 4, "core_amulet", { monster_core: 6, mana_crystal: 4 });

export const RECIPES = list;

export interface CropDef {
  id: string;
  seed: string;
  days: number;
  yield: [number, number];
}

export const CROPS: Record<string, CropDef> = {
  wheat: { id: "wheat", seed: "seed_wheat", days: 2, yield: [2, 3] },
  moon_radish: { id: "moon_radish", seed: "seed_radish", days: 3, yield: [1, 3] },
  fire_berry: { id: "fire_berry", seed: "seed_berry", days: 2, yield: [2, 3] },
  silver_herb: { id: "silver_herb", seed: "seed_herb", days: 3, yield: [1, 2] },
  spirit_mushroom: { id: "spirit_mushroom", seed: "seed_mushroom", days: 4, yield: [1, 2] },
  golden_date: { id: "golden_date", seed: "seed_date", days: 4, yield: [2, 3] },
  star_pumpkin: { id: "star_pumpkin", seed: "seed_pumpkin", days: 5, yield: [1, 2] },
  ghost_lotus: { id: "ghost_lotus", seed: "seed_lotus", days: 5, yield: [1, 2] },
};

/** Research cost in the library. Off-class skills cost double. */
export function researchCost(tier: number, passive: boolean, offClass: boolean): Cost {
  const m = offClass ? 2 : 1;
  return passive
    ? { mana_crystal: tier * 2 * m, gold: 60 * tier * tier * m }
    : { mana_crystal: (tier * 2 - 1) * m, gold: 50 * tier * tier * m };
}
