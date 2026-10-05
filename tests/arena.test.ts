import { describe, expect, it } from "vitest";
import { arenaUnits, RANGED } from "../src/arena/units";
import { TRAITS, traitTier } from "../src/arena/traits";
import { COMPONENTS, ITEMS, combine, EMBLEMS, FINISHED } from "../src/arena/items";
import { AUGMENTS } from "../src/arena/augments";
import { TIERS, applyResult, lpDelta, newRank, rankName, tierReward } from "../src/arena/rank";
import { getItem } from "../src/data/items";

describe("arena units", () => {
  const us = arenaUnits();
  it("one per monster: every floor gives 2×1, 2×2, 1×3, 1×4 and its boss at 5 gold", () => {
    expect(us.length).toBe(700);
    for (let f = 1; f <= 100; f++) {
      const costs = us.filter((u) => u.floor === f).map((u) => u.cost).sort();
      expect(costs, `floor ${f}`).toEqual([1, 1, 2, 2, 3, 4, 5]);
    }
    expect(us.filter((u) => u.cost === 5).every((u) => u.boss && u.traits.includes("u_overlord"))).toBe(true);
  });
  it("stats follow the price, every price has melee and ranged units, every trait exists", () => {
    for (const c of [1, 2, 3, 4, 5] as const) {
      const at = us.filter((u) => u.cost === c);
      expect(at.some((u) => RANGED.includes(u.role)), `ranged at ${c}`).toBe(true);
      expect(at.some((u) => !RANGED.includes(u.role)), `melee at ${c}`).toBe(true);
    }
    const avg = (c: number) => us.filter((u) => u.cost === c).reduce((a, u) => a + u.stats.hp + u.stats.ad * 8, 0) / us.filter((u) => u.cost === c).length;
    for (let c = 1; c < 5; c++) expect(avg(c + 1)).toBeGreaterThan(avg(c));
    for (const u of us) {
      for (const t of u.traits) expect(TRAITS[t], `${u.id} ${t}`).toBeTruthy();
      expect(u.spell.desc.length).toBeGreaterThan(10);
      expect(u.stats.range === 1).toBe(!RANGED.includes(u.role));
    }
    expect(traitTier("o_fire", 1)).toBe(-1);
    expect(traitTier("o_fire", 4)).toBe(1);
  });
});

describe("arena items, augments and ranks", () => {
  it("45 recipes from 9 components, emblems for every trait", () => {
    expect(COMPONENTS.length).toBe(9);
    expect(FINISHED().length).toBe(36);
    const crafted = Object.values(ITEMS).filter((i) => i.parts).length;
    expect(crafted).toBe(45);
    expect(combine("sword", "bow")).toBe(combine("bow", "sword"));
    expect(combine("seal", "seal")).toBe("crown");
    expect(EMBLEMS().length).toBe(Object.values(TRAITS).filter((t) => t.group !== "unique").length);
    // every pair of components makes exactly one thing
    const ids = COMPONENTS.map((c) => c.id);
    for (const a of ids) for (const b of ids) expect(combine(a, b), `${a}+${b}`).toBeTruthy();
  });
  it("augments are well formed", () => {
    expect(AUGMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(AUGMENTS.map((a) => a.id)).size).toBe(AUGMENTS.length);
    for (const t of [1, 2, 3]) expect(AUGMENTS.filter((a) => a.tier === t).length).toBeGreaterThanOrEqual(10);
  });
  it("40 tiers × 3 divisions; wins are worth less and losses cost more higher up", () => {
    expect(TIERS).toBe(40);
    expect(rankName(0)).toBe("Chuột Cống III");
    expect(rankName(119)).toBe("Chúa Tể Đấu Trường I");
    expect(lpDelta(0, 1)).toBeGreaterThan(lpDelta(117, 1));
    expect(lpDelta(0, 8)).toBeGreaterThan(lpDelta(117, 8));
    let r = newRank();
    const ch = applyResult(r, 1); r = ch.after;
    expect(r.lp).toBe(60);
    r = applyResult({ step: 2, lp: 90, best: 2 }, 1).after;
    expect(r.step).toBe(3);
    expect(applyResult({ step: 0, lp: 0, best: 0 }, 8).after).toEqual({ step: 0, lp: 0, best: 0 });
    for (let t = 0; t < 40; t++) for (const id of Object.keys(tierReward(t).items)) expect(getItem(id).name, id).not.toBe("???");
  });
});
