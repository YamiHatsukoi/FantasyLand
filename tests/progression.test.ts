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
