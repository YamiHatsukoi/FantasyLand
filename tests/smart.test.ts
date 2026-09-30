import { describe, expect, it } from "vitest";
import { addItem, newGame } from "../src/core/state";
import { GEAR_BY_FLOOR } from "../src/data/items";
import { gearScore, planBestGear, upgradeFor } from "../src/ui/smart";

describe("smart gear helpers", () => {
  it("spots the stronger pieces in the bag (hints only)", () => {
    const g = newGame("An", "warrior", 1);
    const hero = g.chars[g.heroId];
    for (const it of [...GEAR_BY_FLOOR[3], ...GEAR_BY_FLOOR[20]]) addItem(g, it.id, 1);
    const plan = planBestGear(g, hero);
    expect(plan.length).toBeGreaterThan(5);
    const deep = new Set(GEAR_BY_FLOOR[20].map((x) => x.id));
    // only one floor-20 ring exists, so the second ring slot points at the floor-3 one
    for (const p of plan) if (p.key !== "ring2") expect(deep.has(p.id), `${p.key} ${p.id}`).toBe(true);
    expect(upgradeFor(g, GEAR_BY_FLOOR[20][0].id)).toContain("An");
    expect(gearScore(hero, GEAR_BY_FLOOR[20][0].id, "weapon")).toBeGreaterThan(gearScore(hero, GEAR_BY_FLOOR[3][0].id, "weapon"));
  });

  it("marks new items until the bag is opened", () => {
    const g = newGame("An", "mage", 1);
    g.newItems = [];
    addItem(g, "mana_crystal", 2);
    addItem(g, "mana_crystal", 1);
    expect(g.newItems).toEqual(["mana_crystal"]);
  });
});
