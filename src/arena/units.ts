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
 * unit still feels like itself. The spell is the monster's signature skill, re-cut for the arena.
 */
import type { Element, Skill } from "../combat/types";
import { ENEMIES, type EnemyDef } from "../data/enemies";
import { SKILLS } from "../data/skills";
import { hashString } from "../core/rng";
import { getFloor } from "../world/floors";
import { CLASS_OF, KIND_OF, ORIGIN_OF } from "./traits";
import type { ArenaUnit, Cost, Debuff, Kind, Role, SpellDef, SpellShape, UnitStats } from "./types";

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

// ------------------------------------------------------------ spells
const DEBUFF: Record<string, Debuff> = {
  stun: "stun", frozen: "stun", sleep: "stun", rooted: "stun", confuse: "stun",
  burn: "burn", poison: "poison", bleed: "bleed", chill: "chill", slow: "chill", wet: "chill",
  armorBreak: "shred", resBreak: "shred", weaken: "weaken", curse: "weaken", doom: "weaken",
  blind: "blind", silence: "silence", vulnerable: "mark", mark: "mark",
};
const DEBUFF_DUR: Record<Debuff, number> = { stun: 1.5, burn: 3, poison: 4, bleed: 3, chill: 3, shred: 4, weaken: 4, blind: 3, silence: 2.5, mark: 4 };

/** How interesting a skill is as a signature (regional moves and area spells first). */
const flair = (s: Skill) => (s.id.startsWith("r_") ? 4 : 0) + (s.target === "enemies" ? 2 : 0) + (s.fx?.length ? 1 : 0) + (s.hits ? 1 : 0) + (s.power ?? 0);

function spellFrom(def: EnemyDef, role: Role, ult: boolean): SpellDef {
  const skills = def.skills.map((id) => SKILLS[id]).filter(Boolean);
  const sk = [...skills].sort((a, b) => flair(b) - flair(a) || a.id.localeCompare(b.id))[0] ?? SKILLS.bite;
  const fx = sk.fx?.map((f) => DEBUFF[f.s]).find(Boolean);
  let shape: SpellShape;
  if (isHealer(sk)) shape = sk.heal ? "heal" : "shield";
  else if (sk.target === "allies") shape = "rally";
  else if (sk.target === "self") shape = sk.id === "regenerate" ? "heal" : ["rage", "r_bamboo_step"].includes(sk.id) ? "rally" : "fortify";
  else if (sk.target === "enemies") shape = role === "brute" || role === "tank" ? "nova" : sk.kind === "physical" ? "line" : "nova";
  else if ((sk.hits ?? 1) > 1 || sk.target === "random") shape = "multi";
  else if (role === "assassin") shape = "dash";
  else shape = sk.kind === "physical" ? "strike" : "bolt";
  const physical = sk.kind === "physical";
  const radius = shape === "nova" ? (ult ? 2 : 1) : shape === "heal" || shape === "shield" || shape === "rally" ? (ult ? 3 : 2) : 1;
  const el: Element = sk.el === "physical" ? (physical ? "physical" : "arcane") : sk.el;
  const spell: SpellDef = {
    id: sk.id, name: sk.name, icon: sk.icon, shape, el, physical, radius,
    power: Math.max(0.5, sk.power ?? 1) * (ult ? 1.6 : 1),
    hits: shape === "multi" ? Math.max(3, sk.hits ?? 3) + (ult ? 2 : 0) : 1,
    debuff: fx ? { id: fx, dur: DEBUFF_DUR[fx] * (ult ? 1.3 : 1) } : undefined,
    lifesteal: sk.sp?.some((s) => s.k === "lifesteal") ? 0.5 : undefined,
    execute: sk.sp?.some((s) => s.k === "execute") || undefined,
    ult: ult || undefined,
    desc: "",
  };
  spell.desc = spellText(spell);
  return spell;
}

export function spellText(s: SpellDef): string {
  const dmg = s.physical ? "sát thương vật lý" : "sát thương phép";
  const deb = s.debuff ? ` và ${DEBUFF_NAMES[s.debuff.id]} ${s.debuff.dur.toFixed(1).replace(".0", "")}s` : "";
  const base: Record<SpellShape, string> = {
    strike: `Giáng một đòn cực mạnh vào mục tiêu, gây ${dmg}${deb}.`,
    bolt: `Phóng phép vào mục tiêu, gây ${dmg}${deb}.`,
    multi: `Tung ${s.hits} đòn vào các kẻ địch ngẫu nhiên, mỗi đòn gây ${dmg}${deb}.`,
    nova: `Nổ tung quanh mục tiêu (bán kính ${s.radius} ô), gây ${dmg} cho mọi kẻ địch trong vùng${deb}.`,
    line: `Quét một đường thẳng, gây ${dmg} cho mọi kẻ địch trên đường${deb}.`,
    dash: `Lướt tới kẻ địch xa nhất và tấn công, gây ${dmg}${deb}.`,
    heal: `Hồi máu cho bản thân và đồng minh yếu nhất trong ${s.radius} ô.`,
    shield: `Tạo khiên cho bản thân và đồng minh trong ${s.radius} ô.`,
    rally: `Cổ vũ đồng minh trong ${s.radius} ô: tăng tốc đánh và sát thương trong 4 giây.`,
    fortify: `Tạo khiên lớn cho bản thân, tăng giáp và kháng phép, khiêu khích kẻ địch xung quanh.`,
  };
  return base[s.shape] + (s.lifesteal ? " Hồi máu bằng một nửa sát thương gây ra." : "") + (s.execute ? " Gây thêm sát thương lên mục tiêu yếu máu." : "") + (s.ult ? " (Tối thượng)" : "");
}

export const DEBUFF_NAMES: Record<Debuff, string> = {
  stun: "làm choáng", burn: "thiêu đốt", poison: "gây độc", bleed: "gây chảy máu", chill: "làm tê cóng", shred: "phá giáp",
  weaken: "làm suy yếu", blind: "làm mù", silence: "câm lặng", mark: "đánh dấu",
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
  const tough = Math.min(1.12, Math.max(0.9, (b.def + b.res) / Math.max(1, b.atk + b.mag)));
  const stats: UnitStats = {
    hp: Math.round(COST_HP[cost] * r.hp * tilt(0) * (tough > 1 ? 1.04 : 1) / 10) * 10,
    ad: Math.round(COST_AD[cost] * r.ad * tilt(5)),
    ap: 100,
    armor: Math.round(r.armor * tough),
    mr: Math.round(r.mr * tough),
    as: Math.round(r.as * tilt(10) * 100) / 100,
    range: r.range,
    mana: r.mana + (boss ? 20 : 0),
    startMana: r.start,
    crit: r.crit,
  };
  const kind = kindOf(def);
  const traits = [ORIGIN_OF[el], CLASS_OF[role], KIND_OF[kind], ...(boss ? ["u_overlord"] : [])];
  return { id: def.id, name: def.name, sprite: def.sprite, palette: def.palette, floor, cost, role, origin: el, kind, traits, stats, spell: spellFrom(def, role, boss), boss };
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
  cache = { list, byId: Object.fromEntries(list.map((u) => [u.id, u])) };
  return cache;
}

export const arenaUnits = () => all().list;
export const arenaUnit = (id: string): ArenaUnit | undefined => all().byId[id];

// ------------------------------------------------------------ stars
/** Health and attack damage multiplier per star (1..4). */
export const STAR_MULT = [0, 1, 1.8, 3.24, 5.5];
/** Spell multiplier per star; at three and four stars spells grow faster than bodies. */
export const STAR_SPELL = [0, 1, 1.5, 2.4, 4];
/** Spell value at one star for a unit (before AP and star). */
export const spellBase = (u: ArenaUnit) => COST_SPELL[u.cost] * u.spell.power;
