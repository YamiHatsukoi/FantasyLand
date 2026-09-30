import { describe, expect, it } from "vitest";
import { GEAR_KEYS, addItem, newGame } from "../src/core/state";
import { GEAR_BY_FLOOR } from "../src/data/items";
import { autoEquip, gearScore, planBestGear, upgradeFor } from "../src/ui/smart";

describe("smart gear helpers", () => {
  it("equips the strongest pieces without losing or duplicating items", () => {
    const g = newGame("An", "warrior", 1);
    const hero = g.chars[g.heroId];
    for (const it of [...GEAR_BY_FLOOR[3], ...GEAR_BY_FLOOR[20]]) addItem(g, it.id, 1);
    const count = () => Object.values(g.inventory).reduce((a, b) => a + b, 0) + Object.values(hero.gear).filter(Boolean).length;
    const before = count();
    const scoreBefore = GEAR_KEYS.reduce((a, k) => a + gearScore(hero, hero.gear[k], k), 0);
    const plan = planBestGear(g, hero);
    expect(plan.length).toBeGreaterThan(5);
    expect(autoEquip(g, hero)).toBe(plan.length);
    expect(count()).toBe(before);
    const scoreAfter = GEAR_KEYS.reduce((a, k) => a + gearScore(hero, hero.gear[k], k), 0);
    expect(scoreAfter).toBeGreaterThan(scoreBefore);
    // everything picked comes from the deeper floor, and a second pass changes nothing
    // only one floor-20 ring exists, so the second ring slot takes the floor-3 one
    for (const [k, id] of Object.entries(hero.gear)) if (k !== "ring2") expect(GEAR_BY_FLOOR[20].some((x) => x.id === id), `${k} ${id}`).toBe(true);
    expect(planBestGear(g, hero)).toEqual([]);
    expect(upgradeFor(g, GEAR_BY_FLOOR[3][0].id)).toEqual([]);
  });

  it("marks new items until the bag is opened", () => {
    const g = newGame("An", "mage", 1);
    g.newItems = [];
    addItem(g, "mana_crystal", 2);
    addItem(g, "mana_crystal", 1);
    expect(g.newItems).toEqual(["mana_crystal"]);
  });
});
