/**
 * The 700 arena units, one per monster of the Abyss.
 *
 * Price: within each floor the six ordinary monsters are ranked by strength — the two weakest
 * cost 1, the next two 2, then one 3 and the strongest 4 — and the floor's boss costs 5. So
 * every floor brings a full range of prices, and a player who has only seen the first floors
 * still has units of every cost.
 *
 * Stats come from the price and the fighting role only (a floor-90 monster is no stronger than
 * a floor-1 one at the same price); the monster's own build only nudges them a little, so each
 * unit still feels like itself. Spells come from src/arena/spells.ts: 200 base spells in three
 * variants for the 600 ordinary units, and 100 ultimates for the bosses.
 */
import type { Element, Skill } from "../combat/types";
import { ENEMIES, type EnemyDef } from "../data/enemies";
import { SKILLS } from "../data/skills";
import { hashString } from "../core/rng";
import { getFloor } from "../world/floors";
import { CLASS_OF, KIND_OF, ORIGIN_OF } from "./traits";
import { assignSpells } from "./spells";
import type { ArenaUnit, Cost, Kind, Role, SpellDef, UnitStats } from "./types";

// ------------------------------------------------------------ stats by price and role
const COST_HP = [0, 520, 620, 730, 850, 1000];
const COST_AD = [0, 46, 56, 66, 80, 96];
const COST_SPELL = [0, 200, 260, 330, 420, 560];

interface RoleTemplate { hp: number; ad: number; armor: number; mr: number; as: number; range: number; mana: number; start: number; crit: number }
const ROLE: Record<Role, RoleTemplate> = {
  tank: { hp: 1.3, ad: 0.8, armor: 45, mr: 45, as: 0.6, range: 1, mana: 100, start: 40, crit: 0.1 },
  brute: { hp: 1.15, ad: 1.05, armor: 35, mr: 35, as: 0.7, range: 1, mana: 80, start: 20, crit: 0.15 },
  assassin: { hp: 0.85, ad: 1.2, armor: 25, mr: 25, as: 0.8, range: 1, mana: 60, start: 10, crit: 0.25 },
  marksman: { hp: 0.75, ad: 1.15, armor: 20, mr: 20, as: 0.75, range: 4, mana: 70, start: 10, crit: 0.2 },
  mage: { hp: 0.75, ad: 0.7, armor: 20, mr: 25, as: 0.65, range: 4, mana: 70, start: 20, crit: 0.1 },
  support: { hp: 0.85, ad: 0.7, armor: 25, mr: 30, as: 0.65, range: 3, mana: 80, start: 30, crit: 0.1 },
};
/** A unit's mana against its role's usual, and how full it starts. */
const MANA_K = [0.55, 0.7, 0.85, 1, 1.15, 1.35, 1.6];
const START_SHARE = [0, 0.15, 0.3, 0.45, 0.6];
export const RANGED: Role[] = ["marksman", "mage", "support"];

// ------------------------------------------------------------ what each monster is
const isHealer = (s: Skill) => (s.target === "ally" || s.target === "allies") && !!(s.heal || s.fx?.some((f) => ["regen", "shield", "barrier"].includes(f.s)));

function roleOf(def: EnemyDef): Role {
  const skills = def.skills.map((id) => SKILLS[id]).filter(Boolean);
  const b = def.base;
  if (skills.some(isHealer)) return "support";
  if (b.mag >= b.atk * 1.1) return "mage";
  if (def.tags.includes("flying") || def.tags.includes("spirit")) return "marksman";
  if (b.def + b.res >= (b.atk + b.mag) * 0.95 || skills.some((s) => ["shell_up", "r_volcano_harden", "r_glacier_shell"].includes(s.id))) return "tank";
  if (b.spd >= 104 || b.crit >= 8) return "assassin";
  return "brute";
}

function kindOf(def: EnemyDef): Kind {
  const t = def.tags;
  if (t.includes("flying")) return "flyer";
  if (t.includes("undead")) return "undead";
  if (t.includes("spirit")) return "spirit";
  if (t.includes("construct")) return "construct";
  if (t.includes("humanoid")) return "humanoid";
  if (t.includes("plant")) return "plant";
  return "beast";
}

/** One number for ranking the monsters of a floor against each other. */
const strength = (d: EnemyDef) => {
  const b = d.base;
  return b.hp / 8 + b.atk * 1.6 + b.mag * 1.6 + b.def + b.res + b.spd / 4 + b.crit + b.eva;
};

// ------------------------------------------------------------ build
function build(def: EnemyDef, floor: number, cost: Cost, el: Element): ArenaUnit {
  const boss = cost === 5;
  const role = boss ? bossRole(def) : roleOf(def);
  const r = ROLE[role];
  // a little personality from the monster's own build, steady per monster
  const h = hashString(def.id);
  const tilt = (k: number) => 0.92 + ((h >>> k) % 17) / 100;
  const b = def.base;
  // every unit has its own mana bar: cheap spells come often, dear ones hit hard (spells.ts scales them)
  const mh = hashString(`mana:${def.id}`);
  const mana = Math.max(30, Math.round((r.mana * MANA_K[mh % MANA_K.length]) / 5) * 5) + (boss ? 20 : 0);
  const tough = Math.min(1.12, Math.max(0.9, (b.def + b.res) / Math.max(1, b.atk + b.mag)));
  const stats: UnitStats = {
    hp: Math.round(COST_HP[cost] * r.hp * tilt(0) * (tough > 1 ? 1.04 : 1) / 10) * 10,
    ad: Math.round(COST_AD[cost] * r.ad * tilt(5)),
    ap: 100,
    armor: Math.round(r.armor * tough),
    mr: Math.round(r.mr * tough),
    as: Math.round(r.as * tilt(10) * 100) / 100,
    range: r.range,
    mana,
    startMana: Math.round((mana * START_SHARE[(mh >>> 8) % START_SHARE.length]) / 5) * 5,
    crit: r.crit,
  };
  const kind = kindOf(def);
  const traits = [ORIGIN_OF[el], CLASS_OF[role], KIND_OF[kind], ...(boss ? ["u_overlord"] : [])];
  return { id: def.id, name: def.name, sprite: def.sprite, palette: def.palette, floor, cost, role, origin: el, kind, traits, stats, spell: undefined as unknown as SpellDef, boss };
}

/** Bosses keep their nature but are front-liners or casters, never support. */
function bossRole(def: EnemyDef): Role {
  const r = roleOf(def);
  return r === "support" ? "mage" : r;
}

let cache: { list: ArenaUnit[]; byId: Record<string, ArenaUnit> } | null = null;
function all() {
  if (cache) return cache;
  const list: ArenaUnit[] = [];
  for (let n = 1; n <= 100; n++) {
    const f = getFloor(n);
    const el: Element = f.el === "physical" ? "earth" : f.el; // the one physical floor joins the Earth origin
    const mobs = f.enemies.map((id) => ENEMIES[id]).filter(Boolean).sort((a, b) => strength(a) - strength(b) || a.id.localeCompare(b.id));
    const costs: Cost[] = [1, 1, 2, 2, 3, 4];
    mobs.forEach((d, i) => list.push(build(d, n, costs[i] ?? 1, el)));
    const boss = f.boss.map((id) => ENEMIES[id]).find((d) => d?.boss);
    if (boss) list.push(build(boss, n, 5, el));
  }
  const spells = assignSpells(list.map((u) => ({ id: u.id, role: u.role, cost: u.cost, el: u.origin, boss: u.boss, manaK: u.stats.mana / (ROLE[u.role].mana + (u.boss ? 20 : 0)) })), (c) => COST_SPELL[c], (c) => [1, 2, 3, 4].map((st) => STAR_SPELL[st] * starBoost(c, st)[2]));
  list.forEach((u, i) => { u.spell = spells[i]; });
  cache = { list, byId: Object.fromEntries(list.map((u) => [u.id, u])) };
  return cache;
}

export const arenaUnits = () => all().list;
/** Rebuilds the units (after spell tuning changes). */
export const resetArenaUnits = () => { cache = null; };
export const arenaUnit = (id: string): ArenaUnit | undefined => all().byId[id];

// ------------------------------------------------------------ stars
/** Health and attack damage multiplier per star (1..4). */
export const STAR_MULT = [0, 1, 1.8, 3.24, 5.5];
/** Spell multiplier per star; at three and four stars spells grow faster than bodies. */
export const STAR_SPELL = [0, 1, 1.5, 2.4, 4];
/**
 * Extra power of dear units at three and four stars, as in TFT: a 4-gold ★3 carries a board
 * and a 5-gold ★3 is absurd — it wipes whole boards on its own. [cost][star] → health,
 * attack, spell (on top of the usual star multipliers). The engine also gives them faster
 * spells (and 5-gold ★3+ immunity to crowd control).
 */
const BOOST: Record<number, Record<number, [number, number, number]>> = {
  4: { 3: [2.2, 2.4, 3.5], 4: [3, 3.4, 5] },
  5: { 3: [5, 5, 15], 4: [7, 7.5, 25] },
};
export const starBoost = (cost: number, star: number): [number, number, number] => BOOST[cost]?.[star] ?? [1, 1, 1];
/** Spell power at one star for a unit (before AP and star); each effect takes a share of it. */
export const spellBase = (u: ArenaUnit) => COST_SPELL[u.cost];
