import { describe, expect, it } from "vitest";
import { allocPoint, charStats, giveXp, makeCharacter, migrate, newGame, resetPoints } from "../src/core/state";
import { MAX_LEVEL, pointsAtLevel } from "../src/core/levels";
import { CLASSES, classStats, xpForLevel } from "../src/data/classes";
import { getFloor } from "../src/world/floors";
import { SKILLS } from "../src/data/skills";
import { isPerson } from "../src/render/people";

describe("hero stat points", () => {
  it("earns points on level-up and spends them", () => {
    const g = newGame("An", "warrior", 1);
    const hero = g.chars.hero;
    giveXp(hero, 100000);
    expect(hero.points).toBe(pointsAtLevel(hero.level));
    const atk = charStats(hero).atk;
    expect(allocPoint(hero, "atk", 5)).toBe(true);
    expect(charStats(hero).atk).toBe(atk + 5);
    for (let i = 0; i < 100; i++) allocPoint(hero, "crit");
    expect(hero.alloc!.crit).toBeLessThanOrEqual(40);
    resetPoints(hero);
    expect(hero.points).toBe(pointsAtLevel(hero.level));
    expect(charStats(hero).atk).toBe(atk);
    // companions do not get points
    const c = makeCharacter("lyra", "Lyra", "ranger", "lyra", 1);
    giveXp(c, 100000);
    expect(c.points).toBeUndefined();
  });
  it("old saves get points for levels already gained", () => {
    const g = newGame("An", "warrior", 1);
    g.chars.hero.level = 11;
    delete g.chars.hero.points;
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.chars.hero.points).toBe(pointsAtLevel(11));
  });
  it("stretches old 1–99 levels onto 1–200 without changing strength", () => {
    const g = newGame("An", "warrior", 1);
    const oldStats = charStats(g.chars.hero); // level 1 either way
    g.v = 3;
    g.chars.hero.level = 20;
    g.chars.hero.xp = Math.round(30 * Math.pow(20, 1.55) / 2); // halfway to 21 on the old curve
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.chars.hero.level).toBe(39);
    expect(m.chars.hero.xp / xpForLevel(39)).toBeCloseTo(0.5, 1);
    // the old formula at level 20
    const b = CLASSES.warrior.base, k = 1 + 0.1 * 19;
    const old20 = { hp: Math.round(b.hp * k), mp: Math.round(b.mp * (1 + 0.06 * 19)), atk: Math.round(b.atk * k), mag: Math.round(b.mag * k), def: Math.round(b.def * k), res: Math.round(b.res * k), spd: Math.round(b.spd + 0.8 * 19), crit: b.crit, eva: b.eva };
    expect(classStats("warrior", 39)).toEqual(old20);
    expect(oldStats.hp).toBeGreaterThan(0);
  });
  it("levels go up to 200 and the last gatekeeper stands there", () => {
    const c = makeCharacter("x", "X", "warrior", "hero", 1);
    giveXp(c, 1e12);
    expect(c.level).toBe(MAX_LEVEL);
    expect(getFloor(100).levelBase + 8).toBe(200);
    expect(getFloor(1).levelBase).toBe(1);
    // about two levels per floor, smoothly
    for (let n = 2; n <= 100; n++) expect(getFloor(n).levelBase - getFloor(n - 1).levelBase).toBeGreaterThanOrEqual(1);
  });
});

describe("classes", () => {
  it("has 24 classes with valid skills and a hero sprite each", () => {
    expect(Object.keys(CLASSES).length).toBe(24);
    for (const c of Object.values(CLASSES)) {
      for (const s of [...c.startSkills, ...Object.values(c.learnset)]) expect(SKILLS[s], `${c.id}:${s}`).toBeTruthy();
      expect(isPerson(`hero_${c.id}`), c.id).toBe(true);
    }
  });
});

describe("forge enhancement", () => {
  it("costs gold, can fail at high levels, and the level travels with the item", async () => {
    const { newGame, charStats, equipGear, tryEnhance, enhanceCost, ENH_MAX, migrate } = await import("../src/core/state");
    const { GEAR_BY_FLOOR, enhLevel, enhancedId, baseItemId, getItem } = await import("../src/data/items");
    const g = newGame("An", "warrior", 1);
    const hero = g.chars[g.heroId];
    const sword = GEAR_BY_FLOOR[5].find((i) => i.equip!.kind === "sword")!;
    for (const x of equipGear(hero, "weapon", sword.id)) g.inventory[x] = (g.inventory[x] ?? 0) + 1;
    const atk0 = charStats(hero).atk;
    g.gold = 0;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("gold");
    g.gold = 1e9;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("ok");
    expect(hero.gear.weapon).toBe(`${sword.id}+1`);
    expect(getItem(hero.gear.weapon!).name).toBe(`${sword.name} +1`);
    expect(charStats(hero).atk).toBeGreaterThanOrEqual(atk0 + 1);
    for (let i = 1; i < ENH_MAX; i++) tryEnhance(g, hero, "weapon", 0);
    expect(enhLevel(hero.gear.weapon!)).toBe(ENH_MAX);
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("max");
    // +10 roughly doubles the weapon
    expect(getItem(hero.gear.weapon!).equip!.stats.atk!).toBeGreaterThanOrEqual(sword.equip!.stats.atk! * 2);
    // a bad roll at a risky level only costs gold
    hero.gear.weapon = enhancedId(sword.id, 8);
    const before = g.gold;
    expect(tryEnhance(g, hero, "weapon", 0.99)).toBe("fail");
    expect(enhLevel(hero.gear.weapon!)).toBe(8);
    expect(before - g.gold).toBe(enhanceCost(g, 8));
    // swapping weapons: the new one is plain, the +8 goes back to the bag as it is
    const other = GEAR_BY_FLOOR[6].find((i) => i.equip!.kind === "sword")!;
    const back = equipGear(hero, "weapon", other.id);
    expect(back).toContain(`${sword.id}+8`);
    expect(enhLevel(hero.gear.weapon!)).toBe(0);
    expect(baseItemId(`${sword.id}+8`)).toBe(sword.id);
    // old saves: the per-slot level moves onto the worn item
    const old = JSON.parse(JSON.stringify(g));
    old.chars[old.heroId].gear.weapon = other.id;
    old.chars[old.heroId].enh = { weapon: 3 };
    const m = migrate(old);
    expect(m.chars[m.heroId].gear.weapon).toBe(`${other.id}+3`);
    expect(m.chars[m.heroId].enh).toBeUndefined();
  });
});

describe("milestone floors", () => {
  it("clearing a tenth floor once grants a lasting mark and a trophy chest", async () => {
    const { newGame, partyBuffs } = await import("../src/core/state");
    const { applyEffect } = await import("../src/story/runner");
    const { Rng } = await import("../src/core/rng");
    const g = newGame("An", "warrior", 1);
    const ctx = { g, floor: 10, vars: {}, rng: new Rng(1) } as Parameters<typeof applyEffect>[1];
    const gold0 = g.gold;
    const lines = applyEffect({ clearFloor: true }, ctx);
    expect(lines.some((l) => l.includes("Tầng Mốc"))).toBe(true);
    expect(g.gold).toBeGreaterThan(gold0);
    expect(partyBuffs(g).atk).toBeCloseTo(0.02);
    applyEffect({ clearFloor: true }, ctx);
    expect(g.flags.marks).toBe(1);
    applyEffect({ clearFloor: true }, { ...ctx, floor: 11 });
    expect(g.flags.marks).toBe(1);
  });
});
