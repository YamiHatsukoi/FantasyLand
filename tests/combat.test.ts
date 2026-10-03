import { describe, expect, it } from "vitest";
import { chooseAction } from "../src/combat/ai";
import { describeSkill } from "../src/combat/describe";
import { BREAK_BONUS, Battle } from "../src/combat/engine";
import { unitFromCharacter, unitFromEnemy } from "../src/combat/factory";
import { STATUSES } from "../src/combat/statuses";
import type { Unit } from "../src/combat/types";
import { makeCharacter } from "../src/core/state";
import { ENEMIES } from "../src/data/enemies";
import { PASSIVES } from "../src/data/passives";
import { PLAYER_SKILLS, SKILLS } from "../src/data/skills";

function dummy(side: "ally" | "enemy", uid: string, over: Partial<Unit> = {}): Unit {
  return {
    uid, side, name: uid, sprite: "slime", level: 1,
    base: { hp: 1000, mp: 100, atk: 50, mag: 50, def: 0, res: 0, spd: 100, crit: 0, eva: 0 },
    hp: 1000, mp: 100, statuses: [], skills: [], passives: [], cooldowns: {}, av: 0, tags: [], resist: {},
    ...over,
  };
}

describe("data integrity", () => {
  it("has hundreds of skills and valid references", () => {
    expect(Object.keys(SKILLS).length).toBeGreaterThanOrEqual(180);
    expect(PLAYER_SKILLS.length).toBeGreaterThanOrEqual(140);
    for (const sk of Object.values(SKILLS)) {
      for (const e of [...(sk.fx ?? []), ...(sk.self ?? [])]) expect(STATUSES[e.s], `${sk.id}:${e.s}`).toBeTruthy();
      expect(describeSkill(sk).length, sk.id).toBeGreaterThan(0);
    }
    for (const en of Object.values(ENEMIES)) {
      for (const s of en.skills) expect(SKILLS[s], `${en.id}:${s}`).toBeTruthy();
      for (const p of en.passives) expect(PASSIVES[p], `${en.id}:${p}`).toBeTruthy();
    }
  });
});

describe("elemental reactions", () => {
  it("lightning on a wet target electrocutes (bonus damage + stun)", () => {
    const a = dummy("ally", "a", { skills: ["spark"] });
    const e = dummy("enemy", "e");
    const b = new Battle([a], [e], 1);
    b.addStatus(e, "wet", 2, 1, 0, a);
    b.act(a, { skill: "spark", target: "e" });
    const ev = b.drainEvents();
    expect(ev.some((x) => x.t === "reaction" && x.name === "Điện Giật")).toBe(true);
    expect(b.has(e, "stun")).toBeTruthy();
    expect(b.has(e, "wet")).toBeFalsy();
  });

  it("three chill stacks freeze, physical hits shatter", () => {
    const a = dummy("ally", "a");
    const e = dummy("enemy", "e");
    const b = new Battle([a], [e], 2);
    b.addStatus(e, "chill", 3, 3, 0, a);
    expect(b.has(e, "frozen")).toBeTruthy();
    const before = e.hp;
    b.act(a, { skill: "attack", target: "e" });
    const shattered = before - e.hp;
    expect(b.has(e, "frozen")).toBeFalsy();
    const e2 = dummy("enemy", "e2");
    const b2 = new Battle([dummy("ally", "a2")], [e2], 2);
    b2.act(b2.allies[0], { skill: "attack", target: "e2" });
    expect(shattered).toBeGreaterThan((1000 - e2.hp) * 1.6);
  });

  it("fire on oil explodes and splashes", () => {
    const a = dummy("ally", "a");
    const e1 = dummy("enemy", "e1"), e2 = dummy("enemy", "e2");
    const b = new Battle([a], [e1, e2], 3);
    b.addStatus(e1, "oil", 3, 1, 0, a);
    b.act(a, { skill: "fire_bolt", target: "e1" });
    expect(e2.hp).toBeLessThan(1000);
    expect(b.drainEvents().some((x) => x.t === "reaction" && x.name === "Nổ Dầu")).toBe(true);
  });

  it("consume skills detonate stacks", () => {
    const a = dummy("ally", "a");
    const e = dummy("enemy", "e");
    const b = new Battle([a], [e], 4);
    b.addStatus(e, "bleed", 3, 5, 10, a);
    b.act(a, { skill: "hemorrhage", target: "e" });
    expect(b.has(e, "bleed")).toBeFalsy();
    expect(1000 - e.hp).toBeGreaterThan(100);
  });

  it("stun skips the turn and expires", () => {
    const a = dummy("ally", "a", { base: { hp: 1000, mp: 100, atk: 50, mag: 50, def: 0, res: 0, spd: 200, crit: 0, eva: 0 } });
    const e = dummy("enemy", "e");
    const b = new Battle([a], [e], 5);
    b.addStatus(e, "stun", 1, 1, 0, a);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const u = b.nextTurn();
      if (!u) break;
      seen.push(u.uid);
      b.act(u, { skill: "defend" });
    }
    expect(b.drainEvents().some((x) => x.t === "skip" && x.uid === "e")).toBe(true);
    expect(b.has(e, "stun")).toBeFalsy();
  });
});

describe("shields, courage and intents", () => {
  it("weakness hits chip the shield; at zero the enemy breaks, loses a turn and takes more damage", () => {
    const a = dummy("ally", "a");
    const e = dummy("enemy", "e", { resist: { physical: 1.2 }, shield: 2, shieldMax: 2, enemyId: "x" });
    const b = new Battle([a], [e], 7);
    b.act(a, { skill: "attack", target: "e" });
    expect(e.shield).toBe(1);
    b.act(a, { skill: "attack", target: "e" });
    expect(e.broken).toBe(true);
    expect(b.breaks).toBe(1);
    const before = e.hp;
    b.act(a, { skill: "attack", target: "e" });
    const brokenHit = before - e.hp;
    // its next turn is skipped, then the shield comes back
    for (let i = 0; i < 6 && e.broken; i++) { const u = b.nextTurn(); if (u) b.act(u, { skill: "defend" }); }
    expect(e.broken).toBeFalsy();
    expect(e.shield).toBe(2);
    expect(b.drainEvents().some((x) => x.t === "skip" && x.uid === "e")).toBe(true);
    const h0 = e.hp;
    b.act(a, { skill: "attack", target: "e" });
    expect(brokenHit).toBeGreaterThan((h0 - e.hp) * (BREAK_BONUS - 0.3));
  });

  it("immune elements do not chip the shield", () => {
    const a = dummy("ally", "a");
    const e = dummy("enemy", "e", { resist: { fire: 1.5 }, shield: 2, shieldMax: 2 });
    const b = new Battle([a], [e], 8);
    b.act(a, { skill: "attack", target: "e" });
    expect(e.shield).toBe(2);
  });

  it("courage: +1 per turn, a boosted attack strikes extra times and skips the next gain", () => {
    const a = dummy("ally", "a", { base: { hp: 1000, mp: 100, atk: 50, mag: 50, def: 0, res: 0, spd: 300, crit: 0, eva: 0 } });
    const e = dummy("enemy", "e", { base: { hp: 100000, mp: 100, atk: 1, mag: 1, def: 0, res: 0, spd: 1, crit: 0, eva: 0 }, hp: 100000 });
    const b = new Battle([a], [e], 9);
    expect(a.bp).toBe(1);
    let u = b.nextTurn()!;
    expect(u).toBe(a);
    expect(a.bp).toBe(2);
    b.drainEvents();
    b.act(a, { skill: "attack", target: "e", boost: 2 });
    expect(b.drainEvents().filter((x) => x.t === "dmg" && x.uid === "e").length).toBe(3);
    expect(a.bp).toBe(0);
    u = b.nextTurn()!;
    expect(u).toBe(a);
    expect(a.bp).toBe(0);
    b.act(a, { skill: "defend" });
    b.nextTurn();
    expect(a.bp).toBe(1);
  });

  it("enemies announce an intent; a charged boss hits harder unless broken first", () => {
    const a = dummy("ally", "a", { base: { hp: 100000, mp: 100, atk: 50, mag: 50, def: 0, res: 0, spd: 100, crit: 0, eva: 0 }, hp: 100000 });
    const boss = dummy("enemy", "boss", { boss: true, resist: { physical: 1.2 }, shield: 1, shieldMax: 1 });
    const b = new Battle([a], [boss], 10);
    expect(boss.intent).toBeTruthy();
    boss.intent = { skill: "attack", charge: true };
    b.enemyAct(boss);
    expect(boss.charged).toBe(true);
    expect(boss.intent?.charge).toBeFalsy();
    // breaking it cancels the charge
    b.act(a, { skill: "attack", target: "boss" });
    expect(boss.broken).toBe(true);
    expect(boss.charged).toBe(false);
  });
});

function simulate(allies: () => Unit[], enemies: () => Unit[], runs = 60): number {
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    const b = new Battle(allies(), enemies(), 1000 + r);
    for (let i = 0; i < 400; i++) {
      const u = b.nextTurn();
      if (!u) break;
      if (u.side === "enemy") b.enemyAct(u);
      else b.act(u, chooseAction(b, u));
    }
    if (b.outcome() === "win") wins++;
  }
  return wins / runs;
}

describe("balance smoke tests", () => {
  it("a level 1 hero beats a pair of floor-1 monsters most of the time", () => {
    for (const cls of ["warrior", "mage", "ranger", "rogue", "cleric", "guardian"]) {
      const rate = simulate(
        () => [unitFromCharacter(makeCharacter("hero", "H", cls, "hero", 1))],
        () => [unitFromEnemy("moss_slime", 1, 0), unitFromEnemy("forest_wolf", 1, 1)],
      );
      expect(rate, cls).toBeGreaterThan(0.6);
    }
  });

  it("floor-1 guardian is beatable but not trivial for a level 5 party of three", () => {
    const rate = simulate(
      () => [
        unitFromCharacter(makeCharacter("hero", "H", "warrior", "hero", 5)),
        unitFromCharacter(makeCharacter("lyra", "L", "ranger", "lyra", 5)),
        unitFromCharacter(makeCharacter("bram", "B", "guardian", "bram", 5)),
      ],
      () => [unitFromEnemy("ancient_treant", 5, 0), unitFromEnemy("sapling", 4, 1), unitFromEnemy("sapling", 4, 2)],
    );
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.98);
  });
});

describe("elites and boss tricks", () => {
  it("an elite is much tougher, carries affixes, and a volatile one explodes", async () => {
    const { makeElite, isElitePack, eliteChance } = await import("../src/combat/elite");
    const a = dummy("ally", "a");
    const e = dummy("enemy", "e");
    const b = new Battle([a], [e], 3);
    makeElite(b, e, 30, 7);
    expect(e.name.startsWith("★")).toBe(true);
    expect(e.elite!.length).toBe(2);
    expect(e.hp).toBeGreaterThan(2000);
    e.elite = ["volatile"];
    const hp0 = a.hp;
    b.damage(e, 1e9, "physical", {});
    expect(a.hp).toBeLessThan(hp0);
    expect(eliteChance(1)).toBe(0);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (isElitePack(42, `monster_${i}`, 40)) n++;
    expect(n / 2000).toBeGreaterThan(0.05);
    expect(n / 2000).toBeLessThan(0.2);
  });

  it("boss tricks: summons at 60%, the countdown hits everyone, rebirth once", async () => {
    const { mechForFloor, MECHS } = await import("../src/combat/bossMech");
    const mk = () => { const a = dummy("ally", "a"); const boss = dummy("enemy", "boss", { boss: true, enemyId: "x" }); return { a, boss, b: new Battle([a], [boss], 5) }; };
    // summon
    let { a, boss, b } = mk();
    b.spawner = (id, lvl, idx) => dummy("enemy", `m${idx}`, { enemyId: id, level: lvl });
    b.initBoss(boss, "summon", "mob");
    b.damage(boss, 450, "physical", {});
    expect(b.enemies.length).toBe(2);
    expect(b.drainEvents().some((e) => e.t === "spawn")).toBe(true);
    // countdown: five boss turns later the whole party is hit
    ({ a, boss, b } = mk());
    b.initBoss(boss, "countdown");
    const hp0 = a.hp;
    for (let i = 0; i < 5; i++) (b as unknown as { startTurn(u: Unit): boolean }).startTurn(boss);
    expect(a.hp).toBeLessThan(hp0 * 0.6);
    // rebirth
    ({ a, boss, b } = mk());
    b.initBoss(boss, "rebirth");
    b.damage(boss, 1e9, "physical", {});
    expect(boss.hp).toBeGreaterThan(0);
    b.damage(boss, 1e9, "physical", {});
    expect(boss.hp).toBe(0);
    // every floor has a trick, and neighbours differ
    for (let n = 2; n <= 100; n++) expect(mechForFloor(n).id, `floor ${n}`).not.toBe(mechForFloor(n - 1).id);
    expect(new Set(Array.from({ length: 100 }, (_, i) => mechForFloor(i + 1).id)).size).toBeGreaterThanOrEqual(MECHS.length - 2);
    void a;
  });
});

describe("after-battle report", () => {
  it("credits damage, kills, healing, statuses and damage over time to whoever caused them", () => {
    const a = dummy("ally", "a");
    const h = dummy("ally", "h");
    const e = dummy("enemy", "e", { hp: 120 });
    const b = new Battle([a, h], [e], 3);
    a.hp = 500;
    b.act(a, { skill: "attack", target: "e" });
    const sa = b.statsOf("a"), se = b.statsOf("e");
    expect(sa.turns).toBe(1);
    expect(sa.dealt).toBe(se.taken);
    expect(sa.dealt).toBeGreaterThan(0);
    expect(sa.dealt).toBeLessThanOrEqual(120); // no overkill
    // a poison applied by h keeps counting for h on the enemy's turns
    const e2 = dummy("enemy", "e2");
    const b2 = new Battle([a, h], [e2], 4);
    b2.addStatus(e2, "poison", 3, 2, 0, h);
    expect(b2.statsOf("h").debuffs).toBe(1);
    const hp = e2.hp;
    (b2 as unknown as { startTurn(u: Unit): boolean }).startTurn(e2);
    expect(b2.statsOf("h").dealt).toBe(hp - e2.hp);
    // healing goes to the healer, shields to whoever cast them
    b2.addStatus(a, "regen", 2, 1, 40, h);
    a.hp = 100;
    (b2 as unknown as { startTurn(u: Unit): boolean }).startTurn(a);
    expect(b2.statsOf("h").healed).toBe(40);
    expect(b2.statsOf("h").buffs).toBe(1);
    b2.addStatus(a, "shield", 2, 1, 300, h);
    expect(b2.statsOf("h").shielded).toBe(300);
    b2.damage(a, 100, "physical", {});
    expect(b2.statsOf("a").absorbed).toBe(100);
    expect(b2.statsOf("a").taken).toBe(0);
  });
});

describe("difficulty curve", () => {
  it("guardians stack more tricks with depth, within the floor's danger budget, never a forbidden pair", async () => {
    const { mechsForFloor, threatBudget } = await import("../src/combat/bossMech");
    const deep = ["giant", "quicksilver", "glass", "diamond", "vampire", "enrage", "gravity", "silence", "plague", "nullheal", "regen"];
    const avg = (a: number, z: number) => { let t = 0; for (let n = a; n <= z; n++) t += mechsForFloor(n).length; return t / (z - a + 1); };
    expect(avg(41, 70)).toBeGreaterThan(avg(1, 30));
    expect(avg(71, 100)).toBeGreaterThan(avg(41, 70));
    for (let n = 1; n <= 100; n++) {
      const ms = mechsForFloor(n).map((m) => m.id);
      expect(new Set(ms).size).toBe(ms.length);
      if (n <= 20) expect(ms.some((m) => deep.includes(m)), `floor ${n}: ${ms}`).toBe(false);
      expect(threatBudget(n)).toBeGreaterThanOrEqual(threatBudget(Math.max(1, n - 1)));
      for (const [a, b] of [["rally", "summon"], ["countdown", "petrify"], ["regen", "shift"], ["giant", "glass"]]) expect(ms.includes(a) && ms.includes(b), `floor ${n}: ${ms}`).toBe(false);
    }
  });

  it("armour works as before at level 1 and keeps mattering deeper", async () => {
    const { armorFactor } = await import("../src/combat/engine");
    expect(armorFactor(50, 1)).toBeCloseTo(0.5);
    expect(armorFactor(300, 100)).toBeGreaterThan(armorFactor(300, 1));
    expect(armorFactor(600, 100)).toBeLessThan(armorFactor(300, 100));
  });

  it("deeper monsters hit harder relative to their level, guardians on a gentler curve", async () => {
    const { enemyStats } = await import("../src/combat/factory");
    const mob = Object.values(ENEMIES).find((e) => !e.boss)!;
    const boss = Object.values(ENEMIES).find((e) => e.boss)!;
    const perLevel = (d: typeof mob, l: number) => enemyStats(d, l).atk / (1 + 0.14 * (l - 1));
    expect(perLevel(mob, 150)).toBeGreaterThan(perLevel(mob, 10) * 2);
    expect(perLevel(boss, 150) / perLevel(boss, 10)).toBeLessThan(perLevel(mob, 150) / perLevel(mob, 10));
  });

  it("an auto-battling ally braces when a doom countdown is about to strike", () => {
    const a = dummy("ally", "a", { skills: ["attack"] });
    const e = dummy("enemy", "e", { boss: true });
    const b = new Battle([a], [e], 9);
    b.initBoss(e, ["countdown"]);
    e.mechCount = 1;
    expect(chooseAction(b, a).skill).toBe("defend");
  });
});

describe("health going into and out of battle", () => {
  it("a full-health character with max-HP passives starts the fight full, and keeps its share afterwards", async () => {
    const { charStats } = await import("../src/core/state");
    const ch = makeCharacter("x", "X", "warrior", "hero", 30);
    ch.passives.push("p_vigor", "p_colossus");
    ch.equippedPassives = [...ch.passives];
    const st = charStats(ch);
    ch.hp = st.hp; ch.mp = st.mp;
    const u = unitFromCharacter(ch);
    const b = new Battle([u], [dummy("enemy", "e")], 5);
    expect(b.maxHp(u)).toBeGreaterThan(st.hp); // the passives only count in battle
    b.enterAtSameShare(u);
    expect(u.hp).toBe(b.maxHp(u));
    expect(u.mp).toBe(b.maxMp(u));
    // half health in battle is half health on the map
    u.hp = Math.round(b.maxHp(u) / 2);
    expect(Math.round(b.shareOf(u).hp * st.hp)).toBeCloseTo(st.hp / 2, -1);
  });
});

describe("numbers on screen", () => {
  it("damage through a fractional shield stays a whole number", () => {
    const a = unitFromCharacter(makeCharacter("hero", "H", "warrior", "hero", 5));
    const e = unitFromEnemy("moss_slime", 1, 0);
    const b = new Battle([a], [e], 7);
    b.addStatus(a, "shield", 3, 1, 10.3333333, a);
    b.drainEvents();
    b.damage(a, 12.0000000001, "physical", {});
    b.damage(a, 7.7, "physical", {});
    const evs = b.drainEvents().filter((x) => x.t === "dmg") as { amount: number; absorbed?: number }[];
    for (const ev of evs) { expect(Number.isInteger(ev.amount)).toBe(true); if (ev.absorbed) expect(Number.isInteger(ev.absorbed)).toBe(true); }
    expect(Number.isInteger(a.hp)).toBe(true);
  });
});
