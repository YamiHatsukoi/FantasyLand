import { describe, expect, it } from "vitest";
import { addItem, migrate, newGame } from "../src/core/state";
import { BUILDING_LIST, costFor, expansionCost } from "../src/data/buildings";
import { CROP_LIST, ITEMS, ITEM_LIST } from "../src/data/items";
import { RECIPES } from "../src/data/recipes";
import { getFloor } from "../src/world/floors";
import { generateFloor } from "../src/world/mapgen";
import {
  chat, doRecruit, floorSettlements, getNpc, giveGift, greet, memOf, questFor, recruitCheck, shopStock, tavernOffers,
} from "../src/world/people";
import { advanceDay, allPlots, harvest, isReady, plant, population } from "../src/world/town";
import { Rng } from "../src/core/rng";

describe("items & recipes", () => {
  it("has hundreds of items, all equipment and recipes valid", () => {
    expect(ITEM_LIST.length).toBeGreaterThan(500);
    expect(ITEM_LIST.filter((i) => i.type === "equip").length).toBeGreaterThanOrEqual(250);
    expect(ITEM_LIST.filter((i) => ["food", "potion", "herb", "bomb", "scroll"].includes(i.type)).length).toBeGreaterThanOrEqual(100);
    for (const i of ITEM_LIST) expect(i.shape && i.col.length === 3, i.id).toBeTruthy();
    for (const r of RECIPES) for (const k of Object.keys(r.cost)) expect(k === "gold" || ITEMS[k], `${r.id} ${k}`).toBeTruthy();
    for (const c of CROP_LIST) expect(ITEMS[c.id] && ITEMS[c.seed], c.id).toBeTruthy();
  });

  it("building costs only use known items", () => {
    for (const b of BUILDING_LIST) for (let lv = 0; lv < b.maxLevel; lv++) for (const k of Object.keys(costFor(b.id, lv))) expect(k === "gold" || ITEMS[k], `${b.id}@${lv}: ${k}`).toBeTruthy();
    for (let t = 1; t < 10; t++) for (const k of Object.keys(expansionCost(t))) expect(k === "gold" || ITEMS[k], `exp ${t}: ${k}`).toBeTruthy();
  });
});

describe("farming & town", () => {
  it("grows, waters and harvests crops over days", () => {
    const g = newGame("A", "warrior", 7);
    const plots = allPlots(g);
    expect(plots.length).toBe(4);
    plant(plots[0].plot, "wheat");
    for (let d = 0; d < 6 && !isReady(plots[0].plot.crop); d++) {
      plots[0].plot.watered = true;
      advanceDay(g);
    }
    expect(isReady(plots[0].plot.crop)).toBe(true);
    const got = harvest(g, plots[0].plot, new Rng(1));
    expect(got.wheat).toBeGreaterThan(0);
  });

  it("settlers arrive with housing and food", () => {
    const g = newGame("A", "warrior", 7);
    g.buildings.push({ id: "c1", type: "cottage", x: 31, y: 31, level: 1 });
    addItem(g, "bread", 30);
    const before = population(g);
    advanceDay(g);
    advanceDay(g);
    expect(population(g)).toBeGreaterThan(before);
  });

  it("migrates v1 saves", () => {
    const g = newGame("A", "warrior", 7) as unknown as Record<string, unknown>;
    g.v = 1;
    const b = (g.buildings as { x: number; y: number; type: string; crop?: unknown; plot?: unknown }[]);
    for (const x of b) { x.x -= 18; x.y -= 18; delete x.plot; if (x.type === "farm") x.crop = { id: "wheat", planted: 1 }; }
    const m = migrate(g);
    expect(m.v).toBe(2);
    expect(m.buildings.find((x) => x.type === "house")!.x).toBe(34);
    expect(m.buildings.find((x) => x.type === "farm")!.plot!.crop!.id).toBe("wheat");
  });
});

describe("settlements & npcs", () => {
  it("every floor has settlements with shops and npcs placed on the map", () => {
    for (const n of [1, 2, 5, 12, 40, 99]) {
      const ss = floorSettlements(n);
      expect(ss.length).toBeGreaterThan(0);
      const map = generateFloor(getFloor(n), 1000 + n);
      expect(map.entities.filter((e) => e.kind === "town").length, `floor ${n}`).toBe(ss.length);
      const g = newGame("A", "mage", 3);
      g.maxFloor = n;
      for (const s of ss) {
        for (const k of s.shops) expect(shopStock(g, s, k).length, `${s.name} ${k}`).toBeGreaterThan(0);
        for (const id of s.npcs) expect(getNpc(id).name.length).toBeGreaterThan(1);
      }
    }
  });

  it("npcs talk without leftover placeholders and remember gifts", () => {
    const g = newGame("Minh", "warrior", 3);
    const npc = getNpc("n1_0_3");
    const ctx = { g, npc };
    for (let d = 0; d < 12; d++) {
      g.day++;
      for (const l of [...greet(ctx), chat(ctx)]) expect(l, l).not.toMatch(/\{\w+\}/);
    }
    expect(memOf(g, npc.id).aff).toBeGreaterThan(10);
    addItem(g, npc.loves[0], 1);
    const r = giveGift(ctx, npc.loves[0]);
    expect(r.tier).toBe("love");
    expect(memOf(g, npc.id).mem.some((t) => t.startsWith("gift:"))).toBe(true);
    const q = questFor(g, npc);
    expect(q.n).toBeGreaterThan(0);
  });

  it("recruits are unlimited but only 3 companions travel with the hero", () => {
    const g = newGame("Minh", "warrior", 3);
    g.gold = 1e6;
    let n = 0;
    for (let i = 0; i < 40 && n < 6; i++) {
      const npc = getNpc(`n6_0_${i % 7}`.replace("_0_", `_${i % 2}_`));
      if (!npc.recruitable || recruitCheck(g, npc).reason.startsWith("Đã")) continue;
      memOf(g, npc.id).aff = 100;
      if (doRecruit(g, npc)) n++;
    }
    g.buildings.push({ id: "tv", type: "tavern", x: 40, y: 31, level: 3 });
    const offers = tavernOffers(g);
    expect(offers.length).toBeGreaterThan(0);
    expect(Object.keys(g.chars).length).toBeGreaterThan(4);
    expect(g.party.length).toBeLessThanOrEqual(4);
  });
});
