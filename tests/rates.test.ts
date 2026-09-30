import { describe, expect, it } from "vitest";
import { CRIT_CAP, DODGE_CAP, critChance, dodgeChance } from "../src/combat/rates";
import { POINT_CAP, POINT_VALUE, allocPoint, charStats, migrate, newGame } from "../src/core/state";

describe("crit and dodge ratings", () => {
  it("have diminishing returns and hard caps", () => {
    expect(dodgeChance(1000)).toBe(DODGE_CAP);
    expect(critChance(1000)).toBe(CRIT_CAP);
    expect(DODGE_CAP).toBeLessThanOrEqual(0.35);
    expect(dodgeChance(20) - dodgeChance(10)).toBeLessThan(dodgeChance(10));
    expect(dodgeChance(18)).toBeLessThan(0.15);
  });

  it("stat points buy half a point of crit / dodge, capped", () => {
    const g = newGame("An", "rogue", 1);
    const hero = g.chars[g.heroId];
    hero.points = 200;
    const before = charStats(hero).eva;
    while (allocPoint(hero, "eva")) { /* spend to the cap */ }
    expect(hero.alloc!.eva).toBe(POINT_CAP.eva);
    expect(charStats(hero).eva - before).toBe(Math.floor(POINT_CAP.eva! * POINT_VALUE.eva));
  });

  it("refunds old saves that spent more than the new cap", () => {
    const g = newGame("An", "ninja", 30);
    const hero = g.chars[g.heroId];
    hero.points = 0;
    hero.alloc = { eva: 30, crit: 40 };
    const m = migrate(JSON.parse(JSON.stringify(g)));
    const h = m.chars[m.heroId];
    expect(h.alloc).toEqual({ eva: POINT_CAP.eva, crit: POINT_CAP.crit });
    expect(h.points).toBe(30 - POINT_CAP.eva! + 40 - POINT_CAP.crit!);
  });
});
