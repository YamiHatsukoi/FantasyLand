import { describe, expect, it } from "vitest";
import { MAX_LEVEL, POINTS_PER_LEVEL, allocPoint, charStats, giveXp, makeCharacter, migrate, newGame, resetPoints } from "../src/core/state";
import { CLASSES, xpForLevel } from "../src/data/classes";
import { getFloor } from "../src/world/floors";
import { SKILLS } from "../src/data/skills";
import { isPerson } from "../src/render/people";

describe("hero stat points", () => {
  it("earns points on level-up and spends them", () => {
    const g = newGame("An", "warrior", 1);
    const hero = g.chars.hero;
    giveXp(hero, 100000);
    expect(hero.points).toBe((hero.level - 1) * POINTS_PER_LEVEL);
    const atk = charStats(hero).atk;
    expect(allocPoint(hero, "atk", 5)).toBe(true);
    expect(charStats(hero).atk).toBe(atk + 5);
    for (let i = 0; i < 100; i++) allocPoint(hero, "crit");
    expect(hero.alloc!.crit).toBeLessThanOrEqual(40);
    resetPoints(hero);
    expect(hero.points).toBe((hero.level - 1) * POINTS_PER_LEVEL);
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
    expect(m.chars.hero.points).toBe(10 * POINTS_PER_LEVEL);
  });
  it("levels go up to 200 and the floor-100 gatekeeper waits there", () => {
    const c = makeCharacter("x", "X", "warrior", "hero", 1);
    giveXp(c, 1e12);
    expect(c.level).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(200);
    expect(getFloor(100).levelBase + 4).toBe(200);
    expect(getFloor(1).levelBase).toBe(1);
    for (let n = 2; n <= 100; n++) expect(getFloor(n).levelBase - getFloor(n - 1).levelBase).toBeGreaterThanOrEqual(1);
  });
  it("undoes the short-lived doubled levels of v4 saves", () => {
    const g = newGame("An", "warrior", 1);
    g.v = 4;
    g.chars.hero.level = 39; // was 20 before v4
    g.chars.hero.xp = Math.round(15 * Math.pow(20, 1.55) / 2); // halfway on the v4 curve
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.chars.hero.level).toBe(20);
    expect(m.chars.hero.xp / xpForLevel(20)).toBeCloseTo(0.5, 1);
    // a v3 save is left alone
    const h = newGame("B", "mage", 2);
    h.v = 3;
    h.chars.hero.level = 20;
    expect(migrate(JSON.parse(JSON.stringify(h))).chars.hero.level).toBe(20);
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
