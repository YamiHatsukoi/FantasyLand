import { describe, expect, it } from "vitest";
import * as M from "../src/arena/match";
import { ArenaBattle } from "../src/arena/combat";
import { ITEMS, itemStatText } from "../src/arena/items";
import { arenaUnit, arenaUnits } from "../src/arena/units";

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

  it("CPUs: weak, decent and strong ones; more strong ones higher up", () => {
    const count = (step: number, g: string) => M.cpuGrades(step).filter((x) => x === g).length;
    expect(M.cpuGrades(0).length).toBe(7);
    expect(count(0, "strong")).toBe(2);
    expect(count(0, "weak")).toBe(3);
    expect(count(119, "strong")).toBe(5);
    expect(count(119, "weak")).toBe(0);
    expect(M.cpuSkillOf("weak", 0, 1)).toBeLessThan(M.cpuSkillOf("strong", 0, 0));
    const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: 45 });
    const cpus = m.players.filter((x) => x.cpu);
    expect(cpus.filter((x) => x.grade === "strong").length).toBe(2);
    expect(new Set(cpus.filter((x) => x.grade !== "weak").map((x) => x.style)).size).toBeGreaterThanOrEqual(2);
  });

  it("high ranks: CPUs get copiers and three-star 4- and 5-gold carries", () => {
    const m0 = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 105, seed: 3 });
    const strong = m0.players.find((x) => x.grade === "strong")!;
    m0.stage = 4;
    expect(M.cpuCopiers(m0, strong)).toEqual(["dup5", "dup5"]);
    expect(M.cpuCopiers({ ...m0, rankStep: 0 }, strong)).toEqual([]);
    expect(M.benchSize(strong)).toBe(M.BENCH + 9); // a wide bench to hold copies
    expect(M.cpuExtraBench("strong", 0)).toBe(0);
    expect(M.benchSize(M.human(m0))).toBe(M.BENCH);
    let dear3 = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 105, seed: seed * 37 });
      for (let g = 0; m.phase !== "end" && g < 300; g++) {
        if (m.phase === "carousel") M.pickCarousel(m, m.carousel!.findIndex((c) => c.takenBy === null));
        else if (m.phase === "plan" || m.phase === "augment") { M.cpuPlan(m, M.human(m)); M.ready(m); }
        else if (m.phase === "combat") M.resolveCombat(m);
        else M.nextRound(m);
        for (const p of m.players) if (p.cpu && p.units.some((o) => o.star >= 3 && arenaUnit(o.unitId)!.cost >= 4)) { dear3++; break; }
        if (m.players.some((p) => p.cpu && p.units.some((o) => o.star >= 3 && arenaUnit(o.unitId)!.cost >= 4))) break;
      }
    }
    expect(dear3).toBeGreaterThanOrEqual(3); // in most matches some CPU gets a 4- or 5-gold ★3
  });

  it("styles play their plan: fast players level to 8 early, rerollers stay low and three-star", () => {
    let fastLv8 = 0, fastN = 0, rerollStar3 = 0, rerollN = 0, strongPlace = 0, weakPlace = 0, strongN = 0, weakN = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: seed * 101 });
      const seen = new Map<number, { lv41: number; star3: boolean }>();
      for (let g = 0; m.phase !== "end" && g < 300; g++) {
        if (m.phase === "carousel") M.pickCarousel(m, m.carousel!.findIndex((c) => c.takenBy === null));
        else if (m.phase === "plan" || m.phase === "augment") {
          M.cpuPlan(m, M.human(m)); // the human plays like a CPU so the match runs to the end in view
          M.ready(m);
          for (const p of m.players.filter((x) => x.cpu)) {
            const s = seen.get(p.id) ?? { lv41: 0, star3: false };
            if (m.stage === 4 && m.round <= 2) s.lv41 = p.level; // level 8 by 4-1 or 4-2
            if (p.units.some((o) => o.star >= 3 && arenaUnit(o.unitId)!.cost <= 3)) s.star3 = true;
            seen.set(p.id, s);
          }
        } else if (m.phase === "combat") M.resolveCombat(m);
        else M.nextRound(m);
      }
      for (const p of m.players.filter((x) => x.cpu)) {
        const s = seen.get(p.id)!;
        if (p.style === "fast" && p.grade !== "weak" && s.lv41) { fastN++; if (s.lv41 >= 8) fastLv8++; }
        if (p.style === "reroll" && p.grade !== "weak") { rerollN++; if (s.star3) rerollStar3++; }
        if (p.grade === "strong") { strongN++; strongPlace += p.place; }
        if (p.grade === "weak") { weakN++; weakPlace += p.place; }
      }
    }
    expect(fastLv8 / Math.max(1, fastN)).toBeGreaterThan(0.5);
    expect(rerollStar3 / Math.max(1, rerollN)).toBeGreaterThan(0.3); // matches often end before the third copy
    expect(strongPlace / strongN).toBeLessThan(weakPlace / weakN); // strong CPUs finish higher
  });
});
