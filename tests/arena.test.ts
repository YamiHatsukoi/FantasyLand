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

describe("arena spells", () => {
  it("every unit's spell has its own name; bosses have ultimates no other unit has", () => {
    const us = arenaUnits();
    expect(new Set(us.map((u) => u.spell.name)).size).toBe(700);
    const bosses = us.filter((u) => u.cost === 5);
    expect(bosses.every((u) => u.spell.ult)).toBe(true);
    expect(new Set(bosses.map((u) => `${u.spell.shape}|${u.spell.el}`)).size).toBe(100);
    expect(new Set(bosses.map((u) => u.spell.shape)).size).toBe(20);
    expect(us.filter((u) => u.cost < 5).every((u) => !u.spell.ult && u.spell.bonus !== "none")).toBe(true);
    const sig = (u: (typeof us)[number]) => [u.spell.shape, u.spell.el, u.spell.debuff?.id, u.spell.bonus, u.spell.hits, u.spell.radius, u.spell.physical, u.spell.power].join("|");
    expect(new Set(us.filter((u) => u.cost < 5).map(sig)).size).toBeGreaterThan(560);
  });
});

describe("arena combat", async () => {
  const { ArenaBattle } = await import("../src/arena/combat");
  const { Rng } = await import("../src/core/rng");
  const us = arenaUnits();
  type P = import("../src/arena/combat").PlacedUnit;
  const team = (cost: number, star: 1 | 2 | 3 | 4, n: number, r: InstanceType<typeof Rng>, items: string[] = []): P[] =>
    Array.from({ length: n }, (_, i) => {
      const u = r.pick(us.filter((x) => x.cost === cost));
      return { unitId: u.id, star, x: i % 7, y: u.stats.range > 1 ? 7 : 4, items };
    });
  const rate = (a: [number, 1 | 2 | 3 | 4], b: [number, 1 | 2 | 3 | 4], runs = 60, n = 5) => {
    const r = new Rng(7);
    let w = 0;
    for (let i = 0; i < runs; i++) if (new ArenaBattle({ units: team(a[0], a[1], n, r) }, { units: team(b[0], b[1], n, r) }, i).run() === 0) w++;
    return w / runs;
  };

  it("the same seed plays out the same, and fights end in time", () => {
    const r = new Rng(3);
    const a = team(2, 1, 5, r), b = team(2, 1, 5, r);
    const x = new ArenaBattle({ units: a }, { units: b }, 99), y = new ArenaBattle({ units: a }, { units: b }, 99);
    expect(x.run()).toBe(y.run());
    expect(x.time).toBe(y.time);
    expect(x.events.length).toBe(y.events.length);
    expect(x.time).toBeLessThanOrEqual(45.01);
  });
  it("stars and price matter", () => {
    expect(rate([1, 2], [1, 1])).toBeGreaterThan(0.85);
    expect(rate([2, 1], [1, 1])).toBeGreaterThan(0.65);
    expect(rate([5, 1], [3, 1])).toBeGreaterThan(0.75);
    expect(rate([5, 2], [5, 1])).toBeGreaterThan(0.75);
    const even = rate([2, 1], [2, 1], 80);
    expect(even).toBeGreaterThan(0.25);
    expect(even).toBeLessThan(0.75);
  });
  it("dear units at ★3 are absurd: a lone 5-gold ★3 beats a full board of 4-gold ★2", () => {
    const r = new Rng(3);
    const board = (cost: number, star: 1 | 2 | 3 | 4, n: number) => team(cost, star, n, r).map((p, i) => ({ ...p, x: i % 7, y: p.y - Math.floor(i / 7) }));
    let w = 0, w4 = 0;
    for (let i = 0; i < 60; i++) {
      if (new ArenaBattle({ units: board(5, 3, 1) }, { units: board(4, 2, 8) }, i).run() === 0) w++;
      if (new ArenaBattle({ units: board(4, 3, 1) }, { units: board(3, 2, 4) }, i).run() === 0) w4++;
    }
    expect(w / 60).toBeGreaterThan(0.8);
    expect(w4 / 60).toBeGreaterThan(0.75);
  });
  it("items make a unit stronger", () => {
    const r = new Rng(5);
    let w = 0;
    for (let i = 0; i < 60; i++) {
      const a = team(2, 1, 4, r), b = a.map((p) => ({ ...p, items: [] }));
      a.forEach((p) => (p.items = ["warmog", "bloodthirster"].map((id) => FINISHED().find((it) => it.fx === id)!.id)));
      if (new ArenaBattle({ units: a }, { units: b }, i).run() === 0) w++;
    }
    expect(w / 60).toBeGreaterThan(0.8);
  });
  it("every boss ultimate and every item can be used in a fight without breaking", () => {
    const bosses = us.filter((u) => u.boss);
    const fin = FINISHED();
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      const items = [fin[i % fin.length].id, fin[(i + 7) % fin.length].id, EMBLEMS()[i % EMBLEMS().length].id];
      const bt = new ArenaBattle(
        { units: [{ unitId: b.id, star: 2, x: 3, y: 5, items }, ...team(1, 1, 3, new Rng(i))] },
        { units: team(2, 2, 5, new Rng(i + 100)) },
        i,
      );
      bt.run();
      expect(bt.winner).not.toBeNull();
      for (const f of bt.fighters) expect(Number.isFinite(f.hp), `${b.id} ${f.unit.id}`).toBe(true);
      expect(bt.events.some((e) => e.t === "cast" && e.spell.ult), b.id).toBe(true);
    }
  });
});
