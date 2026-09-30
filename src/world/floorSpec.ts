import type { Element, Stats } from "../combat/types";
import { Rng, hashString } from "../core/rng";
import { ELEMENT_SKILL, ENEMIES, WEAKNESS, type EnemyDef } from "../data/enemies";
import { I, ITEMS } from "../data/items/core";
import { registerRelic } from "../data/items/equipment";
import { BIOME_MATS, METALS, metalTierForFloor } from "../data/items/materials";
import { creatureKey, type Plan } from "../render/creatures";
import { SKILLS } from "../data/skills";
import { PASSIVES } from "../data/passives";
import { mix, sh } from "../render/tiles";
import { BIOMES, type Biome, type LiquidKind, type ParticleKind } from "./biomes";

/** Material family: decides which biome materials, names and cultures a floor uses. */
export type Family =
  | "forest" | "desert" | "swamp" | "tundra" | "fungal" | "volcano" | "reef" | "bamboo"
  | "crystal" | "autumn" | "ruins" | "sakura" | "bonewaste" | "jungle" | "glacier";

export type Role = "brute" | "tank" | "swift" | "caster" | "support" | "swarm" | "assassin";

/** [name, body plan, main colour, accent colour?, role?] */
export type MobSpec = [name: string, plan: Plan, c: string, c2?: string, role?: Role];

export interface FloorSpec {
  n: number;
  name: string; // floor title
  biome: string; // ecosystem name
  fam: Family;
  el: Element;
  /** [ground, path, liquid, cliff, foliage/obstacle, accent] */
  col: [string, string, string, string, string, string];
  obs: string[]; // obstacle motifs (first = most common)
  decor: string;
  pat: string; // ground pattern
  liq?: LiquidKind;
  fx?: ParticleKind;
  night?: boolean;
  lv?: [number, number]; // liquid level, obstacle level
  intro: string;
  places: string[]; // 12 region names
  mobs: MobSpec[]; // 6 monsters (unused on hand-written floors 1-3)
  boss: [name: string, plan: Plan, c: string, c2?: string];
  /** History of this world, told by ruins and echoes. */
  lore: string;
  /** What the gatekeeper remembers when its thorn is pulled out. */
  mem: string;
  /** Signature material only found on this floor: [name, icon shape, colour, description]. */
  sig: [name: string, shape: string, col: string, desc: string];
  /** Settlement names. An empty list marks a floor nobody can live on. */
  towns?: string[];
  /** One-of-a-kind item carried by the gatekeeper: [name, equipment kind, passive?, description]. */
  relic?: [name: string, kind: string, passive: string | undefined, desc: string];
}

export const SPECS: Record<number, FloorSpec> = {};
/** Story events per floor, filled by src/story/world.ts. */
export const FLOOR_EVENTS: Record<number, { id: string; region: number }[]> = {};
/** Per-floor gatekeeper event id (when a floor has its own). */
export const FLOOR_GUARDIAN: Record<number, string> = {};
export function registerSpecs(list: FloorSpec[]) {
  for (const s of list) SPECS[s.n] = s;
}

// ------------------------------------------------------------ biome
export function biomeFromSpec(s: FloorSpec): Biome {
  const id = `fl${s.n}`;
  if (BIOMES[id]) return BIOMES[id];
  const [g, path, liq, cliff, fol, acc] = s.col;
  const mats = BIOME_MATS[s.fam] ?? BIOME_MATS.forest;
  const ore = METALS[metalTierForFloor(s.n) - 1].ore;
  const b: Biome = {
    id, name: s.biome,
    ground: [g, sh(g, -0.1), sh(g, 0.1)],
    alt: [path, sh(path, -0.1), sh(path, 0.12)],
    water: [liq, sh(liq, 0.22), sh(liq, 0.6)],
    wall: [cliff, sh(cliff, 0.18)],
    obstacle: s.obs[0], obstacles: s.obs.slice(1),
    obs: [sh(fol, -0.38), fol, sh(fol, 0.35), acc],
    decor: s.decor, decorColors: [acc, sh(acc, 0.35), mix(fol, acc, 0.5), sh(fol, 0.3)],
    pattern: s.pat, liquid: s.liq ?? "water", particles: s.fx ?? "none", glow: acc,
    waterLevel: s.lv?.[0] ?? 0.28, obstacleLevel: s.lv?.[1] ?? 0.26,
    bg: [sh(cliff, -0.45), mix(g, fol, 0.4)], night: s.night,
    nodes: [
      { item: mats.wood, node: "wood_node", w: 3 }, { item: mats.stone, node: "rock_node", w: 3 },
      { item: mats.herb, node: "herb_node", w: 3 }, { item: mats.fiber, node: "herb_node", w: 1 },
      { item: ore, node: "rock_node", w: 2 }, { item: mats.gem, node: "crystal_node", w: 1 },
      { item: sigId(s.n), node: "crystal_node", w: 1 }, { item: "mana_crystal", node: "crystal_node", w: 1 },
    ],
  };
  BIOMES[id] = b;
  return b;
}

export const sigId = (n: number) => `sig_f${n}`;
export const relicId = (n: number) => `relic_f${n}`;

const RELIC_BY_EL: Record<Element, string[]> = {
  physical: ["greatsword", "gauntlets"], fire: ["greataxe", "ring"], ice: ["katana", "amulet"], lightning: ["spear", "earring"],
  water: ["orb", "charm"], earth: ["hammer", "shield"], wind: ["bow", "boots"], light: ["staff", "amulet"],
  dark: ["scythe", "ring"], poison: ["dagger", "cap"], arcane: ["tome", "earring"],
};

export function registerSig(s: FloorSpec) {
  const [name, shape, col, desc] = s.sig;
  if (!ITEMS[sigId(s.n)]) I(sigId(s.n), name, "material", 20 + s.n * 6, `${desc} (Đặc sản tầng ${s.n}.)`, shape, [col, sh(col, -0.4), sh(col, 0.6)], { tier: Math.max(1, Math.ceil(s.n / 7)), icon: "✨", tags: ["signature"] });
  if (s.n < 4 || ITEMS[relicId(s.n)]) return;
  const [rn, kind, passive, rdesc] = s.relic ?? [
    `Kỷ Vật Của ${s.boss[0]}`, RELIC_BY_EL[s.el][s.n % 2], undefined,
    `Thứ duy nhất ${s.boss[0]} còn giữ lại từ ${s.biome}.`,
  ];
  registerRelic(relicId(s.n), rn, kind, s.n, passive, s.boss[2], `${rdesc} (Di vật độc nhất của tầng ${s.n}.)`);
}

// ------------------------------------------------------------ monsters
const BASE: Stats = { hp: 56, mp: 26, atk: 13, mag: 12, def: 8, res: 8, spd: 100, crit: 5, eva: 3 };
const ROLE: Record<Role, Partial<Record<keyof Stats, number>>> = {
  brute: { hp: 1.35, atk: 1.3, def: 1.0, spd: 0.92 },
  tank: { hp: 1.6, atk: 0.95, def: 1.8, res: 1.2, spd: 0.82 },
  swift: { hp: 0.8, atk: 1.1, spd: 1.2, eva: 4, crit: 2 },
  caster: { hp: 0.85, atk: 0.6, mag: 1.7, res: 1.4, mp: 1.6 },
  support: { hp: 1.05, mag: 1.2, res: 1.3, mp: 1.5 },
  swarm: { hp: 0.62, atk: 0.95, spd: 1.12 },
  assassin: { hp: 0.75, atk: 1.35, spd: 1.15, crit: 3.5, eva: 3 },
};
const PLAN_ROLE: Partial<Record<string, Role>> = {
  blob: "swarm", quad: "brute", wolf: "swift", cat: "assassin", bear: "brute", deer: "swift", lizard: "swift", biped: "brute",
  bird: "swift", bat: "swarm", moth: "caster", insect: "swarm", beetle: "tank", spider: "assassin", scorpion: "assassin",
  serpent: "caster", worm: "brute", fish: "swift", crab: "tank", frog: "support", turtle: "tank", plant: "support",
  fungus: "support", treant: "tank", golem: "tank", mech: "tank", knight: "tank", skeleton: "brute", ghost: "caster",
  wraith: "caster", eye: "caster", jelly: "caster", elemental: "caster", dragon: "brute", hydra: "brute", mimic: "assassin",
};
const PLAN_SKILLS: Partial<Record<string, string[]>> = {
  blob: ["slime_spit", "acid_splash"], quad: ["bite", "charge"], wolf: ["bite", "howl"], cat: ["claw", "bite"], bear: ["claw", "crushing_blow"],
  deer: ["charge"], lizard: ["claw", "tail_sweep"], biped: ["crushing_blow", "roar"], bird: ["claw", "gust"], bat: ["life_drain", "screech"],
  moth: ["spore_puff", "screech"], insect: ["sting", "web"], beetle: ["charge", "shell_up"], spider: ["web", "sting"], scorpion: ["sting", "pincer"],
  serpent: ["bite", "tail_sweep"], worm: ["burrow", "devour"], fish: ["bite", "drown"], crab: ["pincer", "shell_up"], frog: ["slime_spit", "regenerate"],
  turtle: ["shell_up", "quake_stomp"], plant: ["root_slam", "regenerate"], fungus: ["spore_puff", "regenerate"], treant: ["root_slam", "ancient_roots"],
  golem: ["crushing_blow", "quake_stomp"], mech: ["crushing_blow", "static_touch"], knight: ["crushing_blow", "rage"], skeleton: ["claw", "hex"],
  ghost: ["hex", "life_drain"], wraith: ["hex", "lantern_soul"], eye: ["mana_burn", "hex"], jelly: ["static_touch", "slime_spit"],
  elemental: ["magic_missile"], dragon: ["tail_sweep", "roar"], hydra: ["bite", "devour"], mimic: ["devour", "bite"],
};
const PLAN_TAGS: Partial<Record<string, string[]>> = {
  bird: ["beast", "flying"], bat: ["beast", "flying"], moth: ["beast", "flying"], dragon: ["beast", "flying"],
  skeleton: ["undead"], wraith: ["spirit", "undead"], ghost: ["spirit", "undead"], elemental: ["spirit"], eye: ["spirit"],
  plant: ["plant"], fungus: ["plant"], treant: ["plant"], golem: ["construct"], mech: ["construct"], knight: ["humanoid"], biped: ["humanoid"],
};

function statsFor(role: Role, boss: boolean, floor: number): Stats {
  const m = ROLE[role];
  const out = { ...BASE };
  for (const k of Object.keys(out) as (keyof Stats)[]) {
    if (k === "crit" || k === "eva") out[k] = Math.round(BASE[k] * (m[k] ?? 1));
    else out[k] = Math.round(BASE[k] * (m[k] ?? 1));
  }
  if (boss) {
    out.hp = Math.round(out.hp * 9);
    out.mp *= 4;
    out.atk = Math.round(out.atk * 1.35);
    out.mag = Math.round(out.mag * 1.35);
    out.def = Math.round(out.def * 1.25);
    out.res = Math.round(out.res * 1.25);
  }
  // deeper floors: slightly beefier monsters on top of level scaling
  const deep = 1 + Math.min(0.35, floor / 300);
  out.hp = Math.round(out.hp * deep);
  return out;
}

/** Signature moves per family (skill ids are r_<family>_<name>). */
const REGION_SKILLS: Partial<Record<Family, [string, string]>> = {
  forest: ["thorn", "canopy"], desert: ["scorch", "mirage"], swamp: ["mire", "miasma"], tundra: ["bite", "whiteout"],
  fungal: ["bloom", "mycel"], volcano: ["magma", "harden"], reef: ["tide", "pearl"], bamboo: ["slash", "step"],
  crystal: ["prism", "ward"], autumn: ["harvest", "leaves"], ruins: ["curse", "guard"], sakura: ["blade", "petal"],
  bonewaste: ["rattle", "reassemble"], jungle: ["venom", "ambush"], glacier: ["lance", "shell"],
};

export const mobId = (n: number, i: number) => `m${n}_${i}`;
export const bossId = (n: number) => `boss${n}`;

export function registerMonsters(s: FloorSpec) {
  const mats = BIOME_MATS[s.fam] ?? BIOME_MATS.forest;
  const weak = WEAKNESS[s.el];
  const elSkills = ELEMENT_SKILL[s.el] ?? [];
  s.mobs.forEach(([name, plan, c, c2, roleIn], i) => {
    const id = mobId(s.n, i);
    if (ENEMIES[id]) return;
    const role = roleIn ?? PLAN_ROLE[plan] ?? "brute";
    const tags = PLAN_TAGS[plan] ?? ["beast"];
    const resist: EnemyDef["resist"] = { [s.el]: 0.5 };
    if (weak) resist[weak] = 1.5;
    if (tags.includes("spirit")) resist.physical = 0.7;
    const skills = [...new Set([...(PLAN_SKILLS[plan] ?? ["bite"]), ...(role === "caster" || role === "support" ? elSkills.slice(0, 1) : elSkills.slice(1, 2))])];
    if (role === "support") skills.push("regenerate");
    // one of the region's two signature moves, and the region's trait
    const regional = `r_${s.fam}_${REGION_SKILLS[s.fam]?.[i % 2] ?? ""}`;
    if (SKILLS[regional]) skills.push(regional);
    const trait = PASSIVES[`r_${s.fam}`] ? `r_${s.fam}` : "";
    ENEMIES[id] = {
      id, name, sprite: creatureKey({ plan, c, c2, seed: hashString(id), el: s.el, fam: s.fam }), tags, base: statsFor(role, false, s.n), resist,
      skills: skills.filter((k) => k), passives: [...(tags.includes("flying") ? ["e_flying"] : role === "tank" && i % 2 ? ["e_thorny"] : []), ...(trait && i % 3 !== 2 ? [trait] : [])],
      drops: [
        { item: [mats.hide, mats.fiber, mats.herb, mats.wood, mats.stone, mats.hide][i], ch: 0.6, min: 1, max: 2 },
        { item: sigId(s.n), ch: 0.06 },
        { item: METALS[metalTierForFloor(s.n) - 1].ore, ch: 0.2 },
      ],
      ai: role === "caster" || role === "support" ? "smart" : "random",
    };
  });
  const [name, plan, c, c2] = s.boss;
  const id = bossId(s.n);
  if (ENEMIES[id]) return;
  const role = PLAN_ROLE[plan] ?? "brute";
  const resist: EnemyDef["resist"] = { [s.el]: 0.3 };
  if (weak) resist[weak] = 1.35;
  ENEMIES[id] = {
    id, name, sprite: creatureKey({ plan, c, c2, seed: hashString(id), boss: true, el: s.el, fam: s.fam }), tags: PLAN_TAGS[plan] ?? ["beast"],
    base: statsFor(role, true, s.n), resist,
    skills: [...new Set([...(PLAN_SKILLS[plan] ?? ["bite"]), ...elSkills, ...(REGION_SKILLS[s.fam] ?? []).map((k) => `r_${s.fam}_${k}`).filter((k) => SKILLS[k]), s.n % 3 === 0 ? "cataclysm" : s.n % 3 === 1 ? "roar" : "rage"])],
    passives: ["e_boss", "e_enrage", ...(PASSIVES[`r_${s.fam}`] ? [`r_${s.fam}`] : []), ...(s.n >= 30 ? ["e_regen"] : [])], boss: true, scale: 2, ai: "smart",
    drops: [
      { item: sigId(s.n), ch: 1, min: 2, max: 4 }, { item: relicId(s.n), ch: 1 }, { item: mats.gem, ch: 1, min: 1, max: 2 },
      { item: "mana_crystal", ch: 1, min: 3, max: 5 }, { item: "monster_core", ch: 1, min: 2, max: 3 },
      { item: METALS[metalTierForFloor(s.n) - 1].ore, ch: 1, min: 3, max: 5 },
    ],
  };
}

// ------------------------------------------------------------ fallback (procedural) spec
const FAMS: Family[] = ["tundra", "fungal", "volcano", "reef", "bamboo", "crystal", "autumn", "ruins", "sakura", "bonewaste", "jungle", "glacier", "forest", "desert", "swamp"];
const EL_BY_FAM: Record<Family, Element> = {
  forest: "earth", desert: "fire", swamp: "water", tundra: "ice", fungal: "poison", volcano: "fire", reef: "water", bamboo: "wind",
  crystal: "arcane", autumn: "earth", ruins: "dark", sakura: "wind", bonewaste: "dark", jungle: "poison", glacier: "ice",
};
export const elementOfFamily = (f: string) => EL_BY_FAM[f as Family] ?? "earth";

/** Procedural spec for floors that have not been written by hand. */
export function fallbackSpec(n: number): FloorSpec {
  const r = new Rng(n * 7919);
  const fam = FAMS[(n - 4 + FAMS.length * 10) % FAMS.length];
  const hue = () => "#" + Array.from({ length: 3 }, () => r.int(40, 220).toString(16).padStart(2, "0")).join("");
  const plans: Plan[] = ["blob", "quad", "wolf", "bird", "insect", "serpent", "golem", "ghost", "crab", "plant"];
  return {
    n, name: `Tầng Vô Danh ${n}`, biome: "Vùng Đất Chưa Đặt Tên", fam, el: EL_BY_FAM[fam],
    col: [hue(), hue(), hue(), hue(), hue(), hue()], obs: ["rock", "tree"], decor: "pebbles", pat: "grass",
    intro: "Một vùng đất chưa có ai kể lại.", places: Array.from({ length: 12 }, (_, i) => `Khu Vực ${i + 1}`),
    mobs: Array.from({ length: 6 }, (_, i) => [`Sinh Vật ${n}-${i + 1}`, plans[(n + i) % plans.length], hue()] as MobSpec),
    boss: [`Kẻ Canh Cửa ${n}`, "dragon", hue()], sig: [`Đặc Sản Tầng ${n}`, "gem", hue(), "Một thứ hiếm thấy."],
    lore: "Không còn ai nhớ nơi này từng là gì.", mem: "Không có ký ức nào còn sót lại.",
  };
}
