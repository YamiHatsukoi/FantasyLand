import { describe, expect, it } from "vitest";
import * as M from "../src/arena/match";
import { ArenaBattle } from "../src/arena/combat";
import { ITEMS, itemStatText } from "../src/arena/items";
import { arenaUnits } from "../src/arena/units";

const us = arenaUnits();
const deck = () => M.randomDeck(30, (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })());
function fresh(seed: number) {
  const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed });
  const p = M.human(m);
  p.units = [];
  p.items = [];
  p.gold = 100;
  return { m, p };
}
const ofCost = (p: M.Player, c: number) => p.deck.filter((d) => us.find((u) => u.id === d)!.cost === c);

describe("arena extras", () => {
  it("unit cards count items: attack speed, lifesteal and damage go up", () => {
    const { m, p } = fresh(41);
    p.shop[0] = ofCost(p, 1)[0];
    M.buy(m, p, 0);
    const u = p.units[0];
    M.moveUnit(m, p, u.uid, { x: 3, y: 6 });
    const bare = M.unitPreview(p, u.uid)!;
    expect(bare.now.as).toBeCloseTo(bare.base.as);
    u.items = ["rapidfire", "bloodthirster"];
    const pv = M.unitPreview(p, u.uid)!;
    expect(pv.now.as).toBeCloseTo(pv.base.as * (1 + ITEMS.rapidfire.stats.as!));
    expect(pv.now.omnivamp).toBeCloseTo(0.22);
    expect(pv.now.ad).toBe(pv.base.ad + ITEMS.bloodthirster.stats.ad!);
    expect(pv.now.range).toBe(pv.base.range + 1);
    // bench units get a preview too
    M.moveUnit(m, p, u.uid, { bench: 2 });
    expect(M.unitPreview(p, u.uid)!.now.omnivamp).toBeCloseTo(0.22);
    expect(itemStatText("rapidfire")).toContain("tốc đánh");
  });

  it("live attack speed includes stacking items", () => {
    const id = us.find((u) => u.cost === 1 && u.role === "marksman")!.id;
    const b = new ArenaBattle({ units: [{ unitId: id, star: 1, x: 3, y: 7, items: ["guinsoo"] }] }, { units: [{ unitId: id, star: 3, x: 3, y: 0, items: [] }] }, 7);
    const f = b.fighters[0];
    for (let i = 0; i < 120; i++) b.step();
    expect(f.stacks).toBeGreaterThan(0);
    expect(b.attackSpeed(f)).toBeGreaterThan(f.as);
  });

  it("assassins start where they were placed and leap over at the start", () => {
    const [id, id2] = us.filter((u) => u.role === "assassin" && u.cost === 2).map((u) => u.id);
    const foe = us.find((u) => u.role === "tank" && u.cost === 2)!.id;
    const b = new ArenaBattle({ units: [{ unitId: id, star: 1, x: 3, y: 7, items: [] }, { unitId: id2, star: 1, x: 5, y: 7, items: [] }] }, { units: [{ unitId: foe, star: 1, x: 3, y: 4, items: [] }] }, 3);
    const a = b.fighters[0];
    expect(a.traits.c_assassin).toBeGreaterThan(0);
    expect(a.leap).toBe(true);
    expect([a.fx, a.fy]).toEqual([3, 7]); // drawn where it stood
    expect(a.y).toBeLessThan(4); // logically already behind the enemy line
    for (let i = 0; i < 12; i++) b.step();
    expect(a.leap).toBe(false);
  });

  it("copiers add a one-star copy; the basic one only takes 1–3 gold units", () => {
    const { m, p } = fresh(42);
    const cheap = ofCost(p, 2)[0], dear = ofCost(p, 5)[0];
    p.shop[0] = cheap; M.buy(m, p, 0);
    p.shop[0] = dear; M.buy(m, p, 0);
    const [a, b] = p.units;
    p.items = ["dup3", "dup5"];
    expect(M.giveItem(m, p, 0, b.uid)).not.toBeNull(); // basic copier: no 5-gold units
    expect(p.items).toEqual(["dup3", "dup5"]);
    expect(M.giveItem(m, p, 0, a.uid)).toBeNull();
    expect(p.units.filter((u) => u.unitId === cheap).length).toBe(2);
    expect(M.giveItem(m, p, 0, b.uid)).toBeNull(); // deluxe copier: anything
    expect(p.units.filter((u) => u.unitId === dear).length).toBe(2);
    expect(p.items).toEqual([]);
    // a third copy stars up
    p.items = ["dup5"];
    expect(M.giveItem(m, p, 0, b.uid)).toBeNull();
    expect(p.units.filter((u) => u.unitId === dear).map((u) => u.star)).toEqual([2]);
    // copiers cannot be crafted
    p.items = ["dup3", "sword"];
    expect(M.craft(m, p, 0, 1)).not.toBeNull();
  });

  it("the shop shows the star buying would reach", () => {
    const { m, p } = fresh(43);
    const id = ofCost(p, 1)[0];
    expect(M.starAfterBuying(p, id, 1)).toBe(0);
    p.shop[0] = id; M.buy(m, p, 0);
    expect(M.starAfterBuying(p, id, 1)).toBe(0);
    expect(M.starAfterBuying(p, id, 2)).toBe(2);
    p.shop[0] = id; M.buy(m, p, 0);
    expect(M.starAfterBuying(p, id, 1)).toBe(2);
    p.units.push({ uid: 900, unitId: id, star: 2, items: [], x: 0, y: 0, bench: 5 }, { uid: 901, unitId: id, star: 2, items: [], x: 0, y: 0, bench: 6 });
    expect(M.starAfterBuying(p, id, 1)).toBe(3);
  });

  it("win and loss streaks pay gold every round", () => {
    const { m, p } = fresh(44);
    p.gold = 0;
    p.streak = 0;
    expect(M.roundIncome(m, p).streak).toBe(0);
    p.streak = 3; expect(M.roundIncome(m, p).streak).toBe(1);
    p.streak = -4; expect(M.roundIncome(m, p).streak).toBe(2);
    p.streak = 6; expect(M.roundIncome(m, p).streak).toBe(3);
    p.gold = 37;
    expect(M.roundIncome(m, p)).toMatchObject({ base: 5, interest: 3, streak: 3, total: 11 });
  });

  it("CPUs play properly even at the lowest rank", () => {
    expect(M.cpuSkill(0)).toBeGreaterThanOrEqual(0.6);
    expect(M.cpuSkill(119)).toBe(1);
    const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: 45 });
    for (const p of m.players.filter((x) => x.cpu)) expect(p.skill!).toBeGreaterThanOrEqual(0.45);
  });
});
