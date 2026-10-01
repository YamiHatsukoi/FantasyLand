declare const process: { env: Record<string, string | undefined> };
import { it } from "vitest";
import { chooseAction } from "../src/combat/ai";
import { mechsForFloor } from "../src/combat/bossMech";
import { Battle } from "../src/combat/engine";
import { DEPTH, unitFromCharacter, unitFromEnemy } from "../src/combat/factory";
import { GEAR_KEYS, allocPoint, charStats, fitsGear, isMilestone, makeCharacter, type Character } from "../src/core/state";
import { ENEMIES } from "../src/data/enemies";
import { enhancedId, getItem } from "../src/data/items";
import { GEAR_BY_FLOOR } from "../src/data/items/equipment";
import { gearScore } from "../src/ui/smart";
import { getFloor } from "../src/world/floors";

/** A party a player plausibly has on reaching floor n. */
export function partyFor(n: number, o: { lvl?: number; enh?: number } = {}): Character[] {
  const f = getFloor(n);
  const level = Math.min(200, f.levelBase + (o.lvl ?? 2));
  const enh = o.enh ?? Math.min(10, Math.round(n / 12) + 1);
  const party = [["hero", "warrior"], ["m", "mage"], ["c", "cleric"], ["r", "ranger"]].map(([id, cls]) => makeCharacter(id, id, cls, "hero", level));
  for (const ch of party) {
    for (const key of GEAR_KEYS) {
      if (key === "offhand" && ch.gear.weapon && getItem(ch.gear.weapon).equip?.hands === 2) continue;
      let best: string | undefined, score = 0;
      for (let fl = Math.max(1, n - 3); fl <= n; fl++) for (const it of GEAR_BY_FLOOR[fl]) {
        if (!fitsGear(key, it.id)) continue;
        if (key === "offhand" && getItem(it.id).equip?.hands === 2) continue;
        const s = gearScore(ch, it.id, key);
        if (s > score) { score = s; best = it.id; }
      }
      if (best) ch.gear[key] = enhancedId(best, enh);
    }
  }
  // the hero spends stat points on the main stat
  const hero = party[0];
  if (hero.points) allocPoint(hero, "atk", hero.points);
  // they arrive rested
  for (const ch of party) { const st = charStats(ch); ch.hp = st.hp; ch.mp = st.mp; }
  return party;
}

function fight(party: Character[], group: string[], level: number, floor: number, seed: number) {
  const allies = party.map((c) => unitFromCharacter(c));
  const enemies = group.map((id, i) => unitFromEnemy(id, level, i));
  const b = new Battle(allies, enemies, seed);
  const boss = enemies.find((u) => u.boss);
  if (boss && isMilestone(floor)) { boss.base = { ...boss.base, hp: Math.round(boss.base.hp * 1.35), atk: Math.round(boss.base.atk * 1.1), mag: Math.round(boss.base.mag * 1.1) }; boss.hp = boss.base.hp; }
  if (boss) {
    b.spawner = (id, lvl, idx) => unitFromEnemy(id, lvl, idx);
    b.initBoss(boss, mechsForFloor(floor).map((m) => m.id), group.find((id) => !ENEMIES[id]?.boss) ?? getFloor(floor).enemies[0]);
  }
  let rounds = 0;
  for (let i = 0; i < 400 && !b.outcome(); i++) {
    const u = b.nextTurn();
    if (!u) break;
    if (u.side === "ally") { rounds++; b.act(u, chooseAction(b, u)); } else b.enemyAct(u);
    b.drainEvents();
  }
  const allyMax = allies.reduce((a, u) => a + b.maxHp(u), 0);
  const hpLeft = allies.reduce((a, u) => a + Math.max(0, u.hp), 0) / allyMax;
  const r = Math.max(1, rounds / allies.length);
  const out = allies.reduce((a, u) => a + b.statsOf(u.uid).dealt, 0) / r / enemies.reduce((a, u) => a + u.base.hp, 0);
  const inc = enemies.reduce((a, u) => a + b.statsOf(u.uid).dealt, 0) / r / allyMax;
  return { win: b.outcome() === "win", hpLeft, rounds: r, dead: allies.filter((u) => u.hp <= 0).length, out, inc };
}

export function measure(n: number, o: { lvl?: number; enh?: number; seeds?: number } = {}) {
  const f = getFloor(n);
  const party = partyFor(n, o);
  const seeds = o.seeds ?? 6;
  const mobs = { win: 0, hp: 0, rounds: 0, dead: 0, n: 0, out: 0, inc: 0 };
  for (const grp of f.groups) for (let s = 1; s <= seeds; s++) {
    const r = fight(party, grp, f.levelBase + 2, n, s * 7919 + n);
    mobs.win += +r.win; mobs.hp += r.hpLeft; mobs.rounds += r.rounds; mobs.dead += r.dead; mobs.n++; mobs.out += r.out; mobs.inc += r.inc;
  }
  const boss = { win: 0, hp: 0, rounds: 0, dead: 0, n: 0, out: 0, inc: 0 };
  for (let s = 1; s <= seeds * 3; s++) {
    const r = fight(party, f.boss, f.levelBase + 4, n, s * 104729 + n);
    boss.win += +r.win; boss.hp += r.hpLeft; boss.rounds += r.rounds; boss.dead += r.dead; boss.n++; boss.out += r.out; boss.inc += r.inc;
  }
  const avg = (x: typeof mobs) => ({ win: x.win / x.n, hp: x.hp / x.n, rounds: x.rounds / x.n, dead: x.dead / x.n, out: x.out / x.n, inc: x.inc / x.n });
  return { mobs: avg(mobs), boss: avg(boss) };
}

it.skipIf(!process.env.BALANCE)("balance report", () => {
  for (const kv of (process.env.DEPTH ?? "").split(",").filter(Boolean)) { const [k, v] = kv.split(":"); (DEPTH as Record<string, number>)[k] = Number(v); }
  console.log("DEPTH", JSON.stringify(DEPTH));
  const floors = (process.env.FLOORS ?? "1,3,5,10,15,20,30,40,50,60,70,80,90,100").split(",").map(Number);
  const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
  console.log("floor | mobs: win hp-left rounds dead out%/rd in%/rd | boss: win hp-left rounds dead out%/rd in%/rd | mechs");
  for (const n of floors) {
    const r = measure(n);
    const p1 = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);
    console.log(`${String(n).padStart(5)} | ${pct(r.mobs.win)} ${pct(r.mobs.hp)} ${r.mobs.rounds.toFixed(1).padStart(5)} ${r.mobs.dead.toFixed(2)} ${p1(r.mobs.out)} ${p1(r.mobs.inc)} | ${pct(r.boss.win)} ${pct(r.boss.hp)} ${r.boss.rounds.toFixed(1).padStart(5)} ${r.boss.dead.toFixed(2)} ${p1(r.boss.out)} ${p1(r.boss.inc)} | ${mechsForFloor(n).map((m) => m.id).join(",")}`);
  }
}, 600000);
