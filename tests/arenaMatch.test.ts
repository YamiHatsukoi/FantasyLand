import { describe, expect, it } from "vitest";
import * as M from "../src/arena/match";
import { arenaUnits } from "../src/arena/units";
import { ITEMS } from "../src/arena/items";

const us = arenaUnits();
const deck = () => M.randomDeck(30, (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })());

function check(m: M.MatchState) {
  for (const p of m.players) {
    expect(p.gold, p.name).toBeGreaterThanOrEqual(0);
    if (m.phase !== "combat") expect(M.onBoard(p).length, p.name).toBeLessThanOrEqual(M.boardSize(p));
    const bench = M.onBench(p).map((u) => u.bench);
    expect(new Set(bench).size).toBe(bench.length);
    for (const b of bench) expect(b).toBeLessThan(M.BENCH);
    const hexes = M.onBoard(p).map((u) => `${u.x},${u.y}`);
    expect(new Set(hexes).size).toBe(hexes.length);
    for (const u of p.units) {
      expect(u.items.length).toBeLessThanOrEqual(3);
      expect(u.bench === -1 || u.bench >= 0).toBe(true);
      if (u.bench < 0) expect(u.y).toBeGreaterThanOrEqual(4);
    }
    for (const n of Object.values(p.pool)) expect(n).toBeGreaterThanOrEqual(0);
  }
}

describe("arena match", () => {
  it("plays whole matches to the end with every place given once", () => {
    for (let s = 1; s <= 3; s++) {
      const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: s * 30, seed: s * 777 });
      for (let guard = 0; m.phase !== "end"; guard++) {
        expect(guard).toBeLessThan(200);
        if (m.phase === "carousel") expect(M.pickCarousel(m, m.carousel!.findIndex((c) => c.takenBy === null))).toBeNull();
        else if (m.phase === "augment" || m.phase === "plan") { M.cpuPlan(m, M.human(m)); M.ready(m); }
        else if (m.phase === "combat") M.resolveCombat(m);
        else M.nextRound(m);
        check(m);
      }
      expect(m.players.map((p) => p.place).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(m.stage).toBeGreaterThanOrEqual(3);
      const sum = M.summary(m);
      expect(sum.standings.length).toBe(8);
      expect(M.human(m).augments.length).toBeGreaterThan(0);
    }
  });

  it("rounds follow TFT: carousel, monsters, augments", () => {
    expect(M.roundKind(1, 1)).toBe("carousel");
    expect(M.roundKind(1, 3)).toBe("pve");
    expect(M.roundKind(2, 4)).toBe("carousel");
    expect(M.roundKind(3, 7)).toBe("pve");
    expect(M.roundKind(4, 2)).toBe("pvp");
    const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: 5 });
    expect(m.phase).toBe("carousel");
    M.pickCarousel(m, m.carousel!.findIndex((c) => c.takenBy === null));
    expect(M.roundLabel(m)).toBe("1-2");
    expect(M.human(m).units.length).toBe(1);
    expect(M.human(m).items.length).toBe(1);
    expect(M.human(m).gold).toBe(2);
  });

  it("shop, stars up to ★4, bench full, items", () => {
    const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: 9 });
    const p = M.human(m);
    p.units = [];
    const id = p.deck.find((d) => us.find((u) => u.id === d)!.cost === 1)!;
    p.gold = 999;
    const buyOne = () => { p.shop[0] = id; expect(M.buy(m, p, 0)).toBeNull(); };
    for (let i = 0; i < 3; i++) buyOne();
    expect(p.units.length).toBe(1);
    expect(p.units[0].star).toBe(2);
    for (let i = 0; i < 24; i++) buyOne();
    expect(p.units.length).toBe(1);
    expect(p.units[0].star).toBe(4);
    expect(p.pool[id]).toBe(M.COPIES[1] - 27);
    // sell gives the copies back
    M.sell(m, p, p.units[0].uid);
    expect(p.pool[id]).toBe(M.COPIES[1]);
    // a full bench still lets you buy the third copy
    const other = p.deck.filter((d) => d !== id && us.find((u) => u.id === d)!.cost <= 2);
    for (let i = 0; i < M.BENCH; i++) { p.shop[0] = other[i]; expect(M.buy(m, p, 0)).toBeNull(); }
    p.shop[0] = id; expect(M.buy(m, p, 0)).toBe("Hàng chờ đã đầy.");
    p.units[0].unitId = id; p.units[1].unitId = id;
    expect(M.buy(m, p, 0)).toBeNull();
    expect(p.units.find((u) => u.unitId === id)!.star).toBe(2);
    // items: two components on a unit make a finished item
    const u = p.units[0];
    p.items = ["sword", "sword", "thief"];
    expect(M.giveItem(m, p, 0, u.uid)).toBeNull();
    expect(M.giveItem(m, p, 0, u.uid)).toBeNull();
    expect(u.items).toEqual(["deathblade"]);
    expect(M.giveItem(m, p, 0, u.uid)).not.toBeNull(); // thief needs an empty unit
    p.items = ["bow", "rod"];
    expect(M.craft(m, p, 0, 1)).toBeNull();
    expect(ITEMS[p.items[0]].component).toBeFalsy();
  });

  it("board size follows the level; moving and levelling", () => {
    const m = M.newMatch({ deck: deck(), name: "Tôi", rankStep: 0, seed: 11 });
    const p = M.human(m);
    p.units = [];
    p.gold = 100;
    for (let i = 0; i < 4; i++) { p.shop[0] = p.deck[i]; M.buy(m, p, 0); }
    const [a, b] = p.units;
    expect(M.moveUnit(m, p, a.uid, { x: 3, y: 4 })).toBeNull();
    expect(M.moveUnit(m, p, b.uid, { x: 2, y: 4 })).not.toBeNull(); // level 1: one unit
    expect(M.moveUnit(m, p, b.uid, { x: 3, y: 2 })).not.toBeNull(); // enemy half
    expect(M.buyXp(m, p)).toBeNull();
    expect(p.level).toBe(3);
    expect(M.moveUnit(m, p, b.uid, { x: 2, y: 4 })).toBeNull();
    expect(M.moveUnit(m, p, b.uid, { x: 3, y: 4 })).toBeNull(); // swap
    expect(a.bench).toBe(-1);
    expect([a.x, a.y]).toEqual([2, 4]);
  });

  it("deck rules and CPU decks by rank", () => {
    expect(M.deckProblem(deck(), 300)).toBeNull();
    expect(M.deckProblem(deck().slice(0, 45), 300)).not.toBeNull();
    expect(M.deckProblem(deck().slice(0, 45), 45)).toBeNull();
    expect(M.deckProblem(deck().slice(0, 39), 39)).not.toBeNull();
    const fives = us.filter((u) => u.cost === 5).slice(0, 9).map((u) => u.id);
    expect(M.deckProblem([...fives, ...us.filter((u) => u.cost === 1).slice(0, 41).map((u) => u.id)], 300)).toMatch(/5 vàng/);
    expect(M.cpuMaxFloor(0)).toBeLessThan(M.cpuMaxFloor(60));
    expect(M.cpuMaxFloor(119)).toBe(100);
    const d = M.randomDeck(12, Math.random);
    expect(d.length).toBe(50);
    expect(d.every((id) => us.find((u) => u.id === id)!.floor <= 12)).toBe(true);
  });
});
