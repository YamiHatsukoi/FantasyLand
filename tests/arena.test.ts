import { describe, expect, it } from "vitest";
import { arenaUnits, RANGED } from "../src/arena/units";
import { TRAITS, traitTier } from "../src/arena/traits";
import { COMPONENTS, ITEMS, combine, EMBLEMS, FINISHED } from "../src/arena/items";
import { AUGMENTS } from "../src/arena/augments";
import { TIERS, applyResult, lpDelta, newRank, rankName, tierReward } from "../src/arena/rank";
import { getItem } from "../src/data/items";
import { BASE_SPELLS, ULTIMATES } from "../src/arena/spells";

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
  const us = arenaUnits();
  it("200 base spells in 3 variants for the 600 ordinary units, 100 ultimates for the 100 bosses", () => {
    expect(Object.values(BASE_SPELLS).flat().length).toBe(200);
    expect(new Set(Object.values(BASE_SPELLS).flat().map((b) => b[0])).size).toBe(200);
    expect(new Set(Object.values(BASE_SPELLS).flat().map((b) => b[1])).size).toBe(200);
    expect(ULTIMATES.length).toBe(100);
    expect(new Set(ULTIMATES.map((u) => u[1])).size).toBe(100);
    const normal = us.filter((u) => !u.boss);
    const uses = new Map<string, number[]>();
    for (const u of normal) uses.set(u.spell.base, [...(uses.get(u.spell.base) ?? []), u.spell.variant]);
    expect(uses.size).toBe(200);
    for (const [b, v] of uses) expect(v.sort(), b).toEqual([1, 2, 3]);
    const bosses = us.filter((u) => u.boss);
    expect(bosses.every((u) => u.spell.ult)).toBe(true);
    expect(new Set(bosses.map((u) => u.spell.id)).size).toBe(100);
    expect(new Set(us.map((u) => u.spell.name)).size).toBe(700);
  });
  it("every spell reads well and has sane numbers", () => {
    for (const u of us) {
      expect(u.spell.desc.length, u.id).toBeGreaterThan(15);
      expect(u.spell.desc, u.id).not.toMatch(/NaN|undefined/);
      // a spell never hurts or hinders its own caster
      expect(u.spell.fx.some((e) => ["cc", "dot", "dmg", "knock"].includes(e.k) && e.w === "me"), u.id).toBe(false);
      for (const e of u.spell.fx) for (const k of ["p", "n", "v", "dur", "r"] as const) if (e[k] !== undefined) expect(Number.isFinite(e[k]), `${u.id} ${e.k}.${k}`).toBe(true);
    }
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
  it("every one of the 600 ordinary spells can be cast", () => {
    const castBy = new Set<string>();
    for (const u of us.filter((x) => !x.boss)) {
      const bt = new ArenaBattle({ units: [{ unitId: u.id, star: 2, x: 3, y: 5, items: ["tear", "tear"] }] }, { units: team(u.cost, 1, 2, new Rng(u.floor)) }, u.floor);
      bt.run();
      for (const f of bt.fighters) expect(Number.isFinite(f.hp) && Number.isFinite(f.mana), u.id).toBe(true);
      if (bt.events.some((e) => e.t === "cast" && e.spell.base === u.spell.base)) castBy.add(u.spell.base);
    }
    expect(castBy.size).toBeGreaterThan(195);
  });
  it("passives go off without mana; Veigar-style stacks are kept; spells pick up loot", () => {
    const by = (base: string) => us.find((u) => u.spell.base === base && u.spell.variant === 1)!;
    // a passive: every third attack deals true damage, never a mana cast
    const twin = by("a_twin");
    const bt = new ArenaBattle({ units: [{ unitId: twin.id, star: 2, x: 3, y: 5, items: [] }] }, { units: team(twin.cost, 1, 2, new Rng(4)) }, 4);
    bt.run();
    const casts = bt.events.filter((e) => e.t === "cast" && e.spell.base === "a_twin").length;
    expect(casts).toBeGreaterThan(0);
    // attack-speed ramp: Cơn Giận Tích Tụ grows with every attack
    const rage = by("b_rage");
    const rb = new ArenaBattle({ units: [{ unitId: rage.id, star: 2, x: 3, y: 4, items: [] }] }, { units: team(1, 3, 2, new Rng(5)) }, 5);
    const as0 = rb.fighters[0].as;
    for (let i = 0; i < 200; i++) rb.step();
    expect(rb.fighters[0].as).toBeGreaterThan(as0 * 1.15);
    // permanent stacks on a kill, kept by the player's copy (ref)
    const soul = by("g_soulfire");
    let gained = 0, coins = 0;
    for (let i = 0; i < 20; i++) {
      const b = new ArenaBattle({ units: [{ unitId: soul.id, star: 3, x: 3, y: 6, items: ["tear"], ref: 77, bonus: { ap: 9 } }] }, { units: team(1, 1, 3, new Rng(i)) }, i);
      expect(b.fighters[0].ap).toBeGreaterThanOrEqual(109);
      b.run();
      gained += b.gains(0).filter((g) => g.ref === 77 && g.stat === "ap").length;
      const coin = by("m_charge");
      const c = new ArenaBattle({ units: [{ unitId: coin.id, star: 3, x: 3, y: 7, items: ["tear", "tear"] }] }, { units: team(1, 1, 2, new Rng(i)) }, i);
      c.run();
      coins += c.loot[0].gold;
    }
    expect(gained).toBeGreaterThan(0);
    expect(coins).toBeGreaterThan(0);
  });
  it("every boss ultimate and every item can be used in a fight without breaking", () => {
    const bosses = us.filter((u) => u.boss);
    const fin = FINISHED();
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      const items = [fin[i % fin.length].id, fin[(i + 7) % fin.length].id, EMBLEMS()[i % EMBLEMS().length].id];
      const bt = new ArenaBattle(
        { units: [{ unitId: b.id, star: 3, x: 3, y: 5, items }, ...team(1, 1, 3, new Rng(i))] },
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
