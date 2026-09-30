import { describe, expect, it } from "vitest";
import { POINTS_PER_LEVEL, allocPoint, charStats, giveXp, makeCharacter, migrate, newGame, resetPoints } from "../src/core/state";
import { CLASSES } from "../src/data/classes";
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
  it("costs gold, can fail at high levels, and strengthens the slot", async () => {
    const { newGame, charStats, equipGear, tryEnhance, enhanceCost, ENH_MAX } = await import("../src/core/state");
    const { GEAR_BY_FLOOR } = await import("../src/data/items");
    const g = newGame("An", "warrior", 1);
    const hero = g.chars[g.heroId];
    const sword = GEAR_BY_FLOOR[5].find((i) => i.equip!.kind === "sword")!;
    equipGear(hero, "weapon", sword.id);
    const atk0 = charStats(hero).atk;
    g.gold = 0;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("gold");
    g.gold = 1e9;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("ok");
    expect(charStats(hero).atk).toBeGreaterThan(atk0);
    for (let i = 1; i < ENH_MAX; i++) tryEnhance(g, hero, "weapon", 0);
    expect(hero.enh!.weapon).toBe(ENH_MAX);
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("max");
    // a bad roll at a risky level only costs gold
    hero.enh!.weapon = 8;
    const before = g.gold;
    expect(tryEnhance(g, hero, "weapon", 0.99)).toBe("fail");
    expect(hero.enh!.weapon).toBe(8);
    expect(before - g.gold).toBe(enhanceCost(g, 8));
    // the level stays with the slot when the weapon changes
    equipGear(hero, "weapon", GEAR_BY_FLOOR[6].find((i) => i.equip!.kind === "sword")!.id);
    expect(hero.enh!.weapon).toBe(8);
  });
});
