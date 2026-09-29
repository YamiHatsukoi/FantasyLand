import { charPassives, charStats, type Character } from "../core/state";
import type { StatMods } from "./types";
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
    ai: ch.classId === "cleric" ? "support" : "smart",
  };
}

export function enemyStats(def: EnemyDef, level: number): Stats {
  const g = 1 + 0.14 * (level - 1);
  const b = def.base;
  return {
    hp: Math.round(b.hp * g * (def.boss ? 1 + 0.05 * (level - 1) : 1)),
    mp: Math.round(b.mp * (1 + 0.05 * (level - 1))),
    atk: Math.round(b.atk * g),
    mag: Math.round(b.mag * g),
    def: Math.round(b.def * g),
    res: Math.round(b.res * g),
    spd: Math.round(b.spd + 0.6 * (level - 1)),
    crit: b.crit,
    eva: b.eva,
  };
}

export function unitFromEnemy(id: string, level: number, index: number): Unit {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  const base = enemyStats(def, level);
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
    resist: { ...def.resist },
    boss: def.boss,
    enemyId: id,
    ai: def.ai ?? (def.boss ? "smart" : "random"),
  };
}
