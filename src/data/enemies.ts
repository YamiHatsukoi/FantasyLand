import type { Element, Stats } from "../combat/types";

export interface Drop {
  item: string;
  ch: number;
  min?: number;
  max?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  palette?: Record<string, string>;
  tags: string[];
  base: Stats;
  resist: Partial<Record<Element, number>>;
  skills: string[];
  passives: string[];
  drops: Drop[];
  ai?: "random" | "smart" | "support";
  boss?: boolean;
  scale?: number; // sprite scale in battle
}

const st = (hp: number, mp: number, atk: number, mag: number, def: number, res: number, spd: number, crit = 5, eva = 0): Stats =>
  ({ hp, mp, atk, mag, def, res, spd, crit, eva });

const list: EnemyDef[] = [
  // ---------------------------------------------------------------- floor 1: forest
  { id: "moss_slime", name: "Slime Rêu", sprite: "slime", tags: ["beast"], base: st(48, 20, 10, 9, 7, 5, 88), resist: { water: 0.5, fire: 1.3 }, skills: ["slime_spit"], passives: [], drops: [{ item: "slime_gel", ch: 0.7 }, { item: "seed_wheat", ch: 0.12 }] },
  { id: "forest_wolf", name: "Sói Rừng Xám", sprite: "wolf", tags: ["beast"], base: st(48, 16, 13, 6, 6, 5, 104, 6, 6), resist: {}, skills: ["bite", "howl"], passives: [], drops: [{ item: "hide", ch: 0.6 }, { item: "fang", ch: 0.5 }] },
  { id: "mushroomling", name: "Nấm Lùn Tinh Nghịch", sprite: "mushroom", tags: ["plant"], base: st(44, 30, 9, 11, 6, 8, 95), resist: { fire: 1.5, poison: 0.3 }, skills: ["spore_puff"], passives: [], drops: [{ item: "mushroom_cap", ch: 0.7 }, { item: "seed_mushroom", ch: 0.08 }] },
  { id: "giant_wasp", name: "Ong Bắp Cày Khổng Lồ", sprite: "wasp", tags: ["beast", "flying"], base: st(34, 16, 12, 6, 4, 4, 114, 8, 8), resist: { earth: 0.5, wind: 1.4 }, skills: ["sting"], passives: ["e_flying"], drops: [{ item: "herb", ch: 0.4 }, { item: "seed_berry", ch: 0.1 }] },
  { id: "stone_boar", name: "Lợn Rừng Sừng Đá", sprite: "boar", tags: ["beast"], base: st(80, 16, 15, 5, 12, 6, 88, 5), resist: { earth: 0.6 }, skills: ["charge"], passives: [], drops: [{ item: "hide", ch: 0.7 }, { item: "stone", ch: 0.4, min: 1, max: 2 }] },
  { id: "sapling", name: "Cây Non Biết Đi", sprite: "sapling", tags: ["plant"], base: st(62, 24, 11, 10, 9, 7, 80), resist: { fire: 1.5, water: 0.5, earth: 0.7 }, skills: ["root_slam", "regenerate"], passives: [], drops: [{ item: "wood", ch: 0.8, min: 1, max: 2 }, { item: "seed_herb", ch: 0.1 }] },
  { id: "ancient_treant", name: "Lão Mộc Vương", sprite: "treant", tags: ["plant"], base: st(430, 90, 20, 18, 14, 12, 84), resist: { fire: 1.5, water: 0.3, earth: 0.5 }, skills: ["root_slam", "ancient_roots", "forest_blessing"], passives: ["e_boss"], boss: true, scale: 2, drops: [{ item: "wood", ch: 1, min: 5, max: 8 }, { item: "mana_crystal", ch: 1, min: 2, max: 3 }, { item: "seed_pumpkin", ch: 1, min: 1, max: 2 }] },

  // ---------------------------------------------------------------- floor 2: desert
  { id: "amber_scorpion", name: "Bọ Cạp Hổ Phách", sprite: "scorpion", tags: ["beast"], base: st(66, 16, 16, 6, 13, 6, 100, 8), resist: { earth: 0.7, ice: 1.3 }, skills: ["sting", "pincer"], passives: [], drops: [{ item: "chitin", ch: 0.6 }, { item: "amber", ch: 0.2 }] },
  { id: "sand_lizard", name: "Thằn Lằn Cát", sprite: "lizard", tags: ["beast"], base: st(60, 20, 16, 6, 8, 6, 115, 8, 10), resist: { ice: 1.4, fire: 0.7 }, skills: ["claw", "tail_sweep", "burrow"], passives: [], drops: [{ item: "hide", ch: 0.5 }, { item: "cactus_fruit", ch: 0.2 }] },
  { id: "mummy", name: "Xác Ướp Lữ Hành", sprite: "mummy", tags: ["undead"], base: st(88, 30, 14, 14, 10, 10, 80), resist: { fire: 1.6, dark: 0.3, poison: 0 }, skills: ["mummy_curse", "claw"], passives: [], drops: [{ item: "linen", ch: 0.7 }, { item: "bone", ch: 0.5 }] },
  { id: "vulture", name: "Kền Kền Cát", sprite: "vulture", tags: ["beast", "flying"], base: st(52, 16, 16, 6, 6, 6, 120, 10, 14), resist: { earth: 0.5, wind: 1.4, lightning: 1.3 }, skills: ["claw", "bite"], passives: ["e_flying"], drops: [{ item: "bone", ch: 0.5 }, { item: "seed_date", ch: 0.08 }] },
  { id: "dust_djinn", name: "Tiểu Thần Bụi", sprite: "djinn", tags: ["spirit"], base: st(56, 40, 8, 20, 7, 15, 108, 5, 8), resist: { earth: 0.5, wind: 0.5, water: 1.4, physical: 0.8 }, skills: ["sand_blast", "sandstorm"], passives: [], drops: [{ item: "mana_crystal", ch: 0.2 }, { item: "amber", ch: 0.3 }] },
  { id: "cactus_ghoul", name: "Xương Rồng Ma", sprite: "cactus", tags: ["plant"], base: st(84, 20, 15, 8, 12, 8, 70), resist: { water: 0.5, fire: 1.4 }, skills: ["root_slam"], passives: ["e_thorny"], drops: [{ item: "cactus_fruit", ch: 0.7 }, { item: "seed_date", ch: 0.12 }] },
  { id: "sand_wyrm", name: "Sa Trùng Vương", sprite: "wyrm", tags: ["beast"], base: st(620, 100, 22, 18, 15, 12, 92, 8), resist: { earth: 0.4, ice: 1.4, water: 1.3 }, skills: ["devour", "dune_collapse", "tail_sweep", "burrow"], passives: ["e_boss", "e_enrage"], boss: true, scale: 2, drops: [{ item: "chitin", ch: 1, min: 4, max: 6 }, { item: "amber", ch: 1, min: 3, max: 5 }, { item: "mana_crystal", ch: 1, min: 3, max: 4 }, { item: "monster_core", ch: 1, min: 2, max: 2 }, { item: "seed_date", ch: 1, min: 2, max: 2 }] },

  // ---------------------------------------------------------------- floor 3: swamp
  { id: "frogman", name: "Người Ếch Đầm Lầy", sprite: "frogman", tags: ["beast"], base: st(72, 24, 17, 10, 9, 8, 105, 6, 8), resist: { water: 0.4, lightning: 1.4 }, skills: ["bite", "slime_spit"], passives: [], drops: [{ item: "glowmoss", ch: 0.4 }, { item: "peat", ch: 0.4 }] },
  { id: "wisp", name: "Ma Trơi", sprite: "wisp", tags: ["spirit"], base: st(44, 40, 6, 20, 6, 16, 120, 5, 18), resist: { physical: 0.6, water: 1.5, fire: 0.3 }, skills: ["wisp_fire"], passives: ["e_flying"], drops: [{ item: "soul_wax", ch: 0.4 }] },
  { id: "drowned", name: "Xác Chết Trôi", sprite: "drowned", tags: ["undead"], base: st(98, 24, 17, 8, 11, 7, 78), resist: { water: 0.3, fire: 1.3, dark: 0.3, poison: 0 }, skills: ["drown", "bite"], passives: [], drops: [{ item: "bog_iron", ch: 0.4 }, { item: "pearl", ch: 0.06 }] },
  { id: "leech", name: "Đỉa Khổng Lồ", sprite: "leech", tags: ["beast"], base: st(80, 24, 14, 10, 8, 8, 85), resist: { fire: 1.4, poison: 0.5 }, skills: ["life_drain", "bite"], passives: ["e_regen"], drops: [{ item: "peat", ch: 0.5 }, { item: "seed_lotus", ch: 0.06 }] },
  { id: "bog_crab", name: "Cua Bùn Giáp Sắt", sprite: "crab", tags: ["beast"], base: st(88, 16, 17, 6, 22, 7, 80), resist: { lightning: 1.5, water: 0.5 }, skills: ["pincer", "shell_up"], passives: [], drops: [{ item: "bog_iron", ch: 0.6 }, { item: "pearl", ch: 0.05 }] },
  { id: "lantern_ghost", name: "Hồn Đèn Lồng", sprite: "ghost", tags: ["spirit", "undead"], base: st(62, 50, 6, 21, 7, 16, 100, 5, 10), resist: { physical: 0.6, dark: 0.3, light: 1.5 }, skills: ["lantern_soul", "hex"], passives: [], drops: [{ item: "soul_wax", ch: 0.6 }, { item: "mana_crystal", ch: 0.15 }] },
  { id: "drowned_queen", name: "Nữ Hoàng Chết Đuối Ysolde", sprite: "queen", tags: ["undead"], base: st(660, 140, 18, 24, 14, 20, 100, 6), resist: { water: 0.2, dark: 0.5, lightning: 1.3, fire: 1.2 }, skills: ["tidal_curse", "lantern_soul", "drown", "hex"], passives: ["e_boss"], boss: true, scale: 2, ai: "smart", drops: [{ item: "pearl", ch: 1, min: 2, max: 3 }, { item: "soul_wax", ch: 1, min: 3, max: 5 }, { item: "mana_crystal", ch: 1, min: 4, max: 5 }, { item: "monster_core", ch: 1, min: 3, max: 3 }, { item: "seed_lotus", ch: 1, min: 2, max: 2 }] },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));

/** Base archetypes reused (re-skinned by element) on procedurally themed floors 4..100. */
export const ARCHETYPES = [
  "moss_slime", "forest_wolf", "mushroomling", "giant_wasp", "stone_boar", "sapling",
  "amber_scorpion", "sand_lizard", "mummy", "vulture", "dust_djinn", "cactus_ghoul",
  "frogman", "wisp", "drowned", "leech", "bog_crab", "lantern_ghost",
];
export const BOSS_ARCHETYPES = ["ancient_treant", "sand_wyrm", "drowned_queen"];

export const ELEMENT_SKILL: Partial<Record<Element, string[]>> = {
  fire: ["fire_breath", "wisp_fire"],
  ice: ["frost_breath", "frost_shard"],
  lightning: ["static_touch", "spark"],
  water: ["drown", "slime_spit"],
  earth: ["quake_stomp", "sand_blast"],
  wind: ["gust", "wind_blade"],
  light: ["holy_light"],
  dark: ["life_drain", "shadow_bolt"],
  poison: ["swamp_gas", "sting"],
  arcane: ["magic_missile", "mana_burn"],
};

export const WEAKNESS: Partial<Record<Element, Element>> = {
  fire: "water", ice: "fire", lightning: "earth", water: "lightning", earth: "wind",
  wind: "ice", light: "dark", dark: "light", poison: "fire", arcane: "dark",
};

/** Hue-shift a hex colour (used to recolour sprites for themed variants). */
export function tint(hex: string, target: string, amount: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(target);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
}

/** Creates (and registers) an element-themed variant of an archetype, e.g. "Sói Băng". */
export function themedEnemy(baseId: string, el: Element, prefix: string, color: string, boss = false): EnemyDef {
  const id = `${baseId}@${el}${boss ? "!" : ""}`;
  if (ENEMIES[id]) return ENEMIES[id];
  const base = ENEMIES[baseId];
  const resist: Partial<Record<Element, number>> = { ...base.resist, [el]: 0.4 };
  const weak = WEAKNESS[el];
  if (weak) resist[weak] = 1.5;
  const extra = ELEMENT_SKILL[el] ?? [];
  const def: EnemyDef = {
    ...base,
    id,
    name: boss ? `${prefix} ${base.name}` : `${base.name} ${prefix}`,
    palette: { __tint: color },
    resist,
    skills: [...new Set([...base.skills, ...extra.slice(0, boss ? 2 : 1)])],
    passives: boss ? [...new Set([...base.passives, "e_boss", "e_enrage"])] : base.passives,
    drops: base.drops,
  };
  ENEMIES[id] = def;
  return def;
}
