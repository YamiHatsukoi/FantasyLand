import { charPassives, charStats, dualWielding, type Character } from "../core/state";
import type { Element, StatMods } from "./types";
import { hashString } from "../core/rng";
import { ENEMIES, type EnemyDef } from "../data/enemies";
import type { Stats, Unit } from "./types";

/** Builds a battle unit. `buffs` are party-wide fractions (meal, temple blessing); crit/eva are flat. */
export function unitFromCharacter(ch: Character, buffs: StatMods = {}): Unit {
  const raw = charStats(ch);
  const base = { ...raw };
  for (const [k, v] of Object.entries(buffs) as [keyof Stats, number][]) {
    if (!v || !(k in base)) continue;
    base[k] = k === "crit" || k === "eva" ? base[k] + v : Math.round(base[k] * (1 + v));
  }
  return {
    uid: `a_${ch.id}`,
    side: "ally",
    name: ch.name,
    sprite: ch.sprite,
    palette: ch.pal,
    level: ch.level,
    base,
    hp: Math.min(ch.hp <= 0 ? 0 : ch.hp + Math.max(0, base.hp - raw.hp), base.hp),
    mp: Math.min(ch.mp, base.mp),
    statuses: [],
    skills: [...ch.equipped],
    passives: charPassives(ch),
    cooldowns: {},
    av: 0,
    tags: [],
    resist: {},
    charId: ch.id,
    dual: dualWielding(ch),
    ai: ch.classId === "cleric" ? "support" : "smart",
  };
}

/**
 * How much harder the abyss gets with depth, on top of plain level growth. Players out-scale
 * monsters through gear, enhancement, passives and pets, so deeper monsters hit harder and last
 * a little longer. Guardians keep their classic stats and get stranger with depth instead.
 */
export const DEPTH = { offense: 0.017, mobHp: 0.012 };

export function enemyStats(def: EnemyDef, level: number): Stats {
  const l = level - 1;
  const g = 1 + 0.14 * l;
  const b = def.base;
  // a bit tougher than before: breaking shields and boosting is how the party gets ahead
  const tough = def.boss ? 1.1 : 1.05;
  // guardians keep their classic numbers (big health pools); their danger grows through stacked tricks
  const hit = def.boss ? 1.05 : 1 + DEPTH.offense * l;
  return {
    hp: Math.round(b.hp * g * tough * (def.boss ? 1 + 0.05 * l : 1 + DEPTH.mobHp * l)),
    mp: Math.round(b.mp * (1 + 0.05 * l)),
    atk: Math.round(b.atk * g * hit),
    mag: Math.round(b.mag * g * hit),
    def: Math.round(b.def * g),
    res: Math.round(b.res * g),
    spd: Math.round(b.spd + 0.6 * l),
    crit: b.crit,
    eva: b.eva,
  };
}

const WEAK_POOL: Element[] = ["fire", "ice", "lightning", "earth", "wind", "light", "dark", "water"];

/** Every enemy has at least one weakness (two for bosses) so its shield can always be broken. */
export function enemyResist(def: EnemyDef): Partial<Record<Element, number>> {
  const r: Partial<Record<Element, number>> = { ...def.resist };
  const want = def.boss ? 2 : 1;
  let h = hashString(def.id);
  for (let guard = 0; Object.values(r).filter((v) => (v ?? 1) > 1).length < want && guard < 20; guard++) {
    // ordinary monsters may be weak to plain weapons, so even a fresh party can break them
    const pool = def.boss ? WEAK_POOL : ["physical" as Element, ...WEAK_POOL];
    const el = pool[h % pool.length];
    h = Math.floor(h / 7) + 13 + guard;
    if (r[el] === undefined) r[el] = 1.15;
  }
  return r;
}

/** Shield points: tougher and deeper enemies take more weakness hits to break. */
export function shieldFor(def: EnemyDef, level: number): number {
  return def.boss ? Math.min(8, 4 + Math.floor(level / 12)) : Math.min(4, 2 + Math.floor(level / 18));
}

export function unitFromEnemy(id: string, level: number, index: number): Unit {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  const base = enemyStats(def, level);
  const shield = shieldFor(def, level);
  return {
    uid: `e_${index}_${id}`,
    side: "enemy",
    name: def.name,
    sprite: def.sprite,
    palette: def.palette,
    level,
    base,
    hp: base.hp,
    mp: base.mp,
    statuses: [],
    skills: [...def.skills],
    passives: [...def.passives],
    cooldowns: {},
    av: 0,
    tags: [...def.tags],
    resist: enemyResist(def),
    shield,
    shieldMax: shield,
    boss: def.boss,
    enemyId: id,
    ai: def.ai ?? (def.boss ? "smart" : "random"),
  };
}
