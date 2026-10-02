import { describe, expect, it } from "vitest";
import { SAVE_VERSION, addItem, migrate, newGame } from "../src/core/state";
import { BUILDING_LIST, MAX_MATERIAL, TERRITORY_SIZES, costFor, expansionCost } from "../src/data/buildings";
import { SZ_W, territory } from "../src/world/sanctuary";
import { CROP_LIST, ITEMS, ITEM_LIST } from "../src/data/items";
import { RECIPES } from "../src/data/recipes";
import { getFloor } from "../src/world/floors";
import { generateFloor } from "../src/world/mapgen";
import {
  chat, doRecruit, floorSettlements, getNpc, giveGift, greet, memOf, questFor, recruitCheck, shopStock, tavernOffers,
} from "../src/world/people";
import { advanceDay, allPlots, cropTarget, harvest, isReady, msToRipe, plant, population, tickFarm, waterPlot } from "../src/world/town";
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
  it("grows crops in real time, faster when watered, and harvests them", () => {
    const g = newGame("A", "warrior", 7);
    g.weather = "sun";
    const plots = allPlots(g);
    expect(plots.length).toBe(4);
    const t0 = 1_000_000_000;
    g.farmT = t0;
    plant(plots[0].plot, "wheat");
    plant(plots[1].plot, "wheat");
    waterPlot(plots[0].plot, t0);
    // sleeping alone no longer grows anything
    g.farmT = Date.now();
    advanceDay(g);
    expect(plots[0].plot.crop!.growth).toBeLessThan(0.01);
    g.farmT = t0;
    tickFarm(g, t0 + 20 * 1000);
    const wet = plots[0].plot.crop!.growth, dry = plots[1].plot.crop!.growth;
    expect(wet).toBeGreaterThan(dry);
    expect(plots[1].plot.crop!.perfect).toBe(false);
    // keep it watered until ripe
    let t = t0 + 20 * 1000;
    for (let k = 0; k < 40 && !isReady(plots[0].plot.crop); k++) { waterPlot(plots[0].plot, t); t += 5 * 1000; tickFarm(g, t); }
    expect(t - t0).toBeLessThan(60 * 1000); // wheat ripens in well under a minute
    expect(isReady(plots[0].plot.crop)).toBe(true);
    expect(msToRipe(g, plots[0].plot, false)).toBe(0);
    // long absences never push a crop past ripe
    tickFarm(g, t + 1000 * 3600 * 1000);
    expect(plots[1].plot.crop!.growth).toBeLessThanOrEqual(cropTarget(plots[1].plot.crop!));
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
    // v1 coordinates: 18 + 32 tiles up-left of today's (two world growths since)
    for (const x of b) { x.x -= 50; x.y -= 50; delete x.plot; if (x.type === "farm") x.crop = { id: "wheat", planted: 1 }; }
    const m = migrate(g);
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.buildings.find((x) => x.type === "house")!.x).toBe(66);
    expect(m.buildings.find((x) => x.type === "farm")!.plot!.crop!.id).toBe("wheat");
  });
});

describe("bigger sanctuary", () => {
  it("territories are twice as wide and old buildings move with the centre", () => {
    expect(TERRITORY_SIZES).toEqual([20, 28, 36, 44, 52, 64, 76, 88, 104, 120]);
    const g = newGame("A", "warrior", 7);
    // every starting building sits inside the first territory and the world
    const t = territory(0);
    for (const b of g.buildings) expect(b.x >= t.x0 && b.y >= t.y0 && b.x < t.x1 && b.y < t.y1, b.type).toBe(true);
    const big = territory(TERRITORY_SIZES.length - 1);
    expect(big.x0).toBeGreaterThanOrEqual(0);
    expect(big.x1).toBeLessThanOrEqual(SZ_W);
    // a v5 save: house at the old centre ends up at the same place relative to the new one
    const old = JSON.parse(JSON.stringify(g));
    old.v = 5;
    for (const b of old.buildings) { b.x -= 32; b.y -= 32; }
    const m = migrate(old);
    expect(m.buildings.map((b) => [b.x, b.y])).toEqual(g.buildings.map((b) => [b.x, b.y]));
  });
});

describe("settlements & npcs", () => {
  it("every inhabited floor has settlements with shops and npcs placed on the map", () => {
    // floor 99 (and a few others) are uninhabitable on purpose
    expect(floorSettlements(99).length).toBe(0);
    for (const n of [1, 2, 5, 12, 40, 98]) {
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

  it("recruits are limited by beds, and only 3 companions travel with the hero", () => {
    const g = newGame("Minh", "warrior", 3);
    g.gold = 1e6;
    // enough room at home for everyone
    g.buildings.push({ id: "c1", type: "cottage", x: 20, y: 40, level: 2 }, { id: "c2", type: "cottage", x: 23, y: 40, level: 2 });
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

describe("beds for companions", () => {
  it("tavern hires need a free bed; story companions push settlers out; farewells free a bed", async () => {
    const { newGame, recruit, dismiss } = await import("../src/core/state");
    const { companionBeds, makeRoom, noRoomReason, population, housing } = await import("../src/world/town");
    const { hireOffer } = await import("../src/world/people");
    const g = newGame("An", "warrior", 1);
    // main house: 2 beds -> the hero and one companion
    expect(housing(g)).toBe(2);
    expect(companionBeds(g)).toBe(1);
    g.gold = 1e6;
    g.tavern = { day: g.day, offers: [
      { id: "o1", name: "A", classId: "mage", level: 3, price: 10, pal: {}, bio: "", passive: "" },
      { id: "o2", name: "B", classId: "mage", level: 3, price: 10, pal: {}, bio: "", passive: "" },
    ] };
    expect(hireOffer(g, "o1")).toBeTruthy();
    expect(noRoomReason(g)).toBeTruthy();
    expect(hireOffer(g, "o2")).toBeNull();
    // a story companion still joins; a settler gives up their bed
    g.buildings.push({ id: "t", type: "tent", x: 30, y: 30, level: 1 });
    g.settlers = 2;
    recruit(g, "lyra");
    expect(makeRoom(g)).toBeTruthy();
    expect(population(g)).toBeLessThanOrEqual(housing(g));
    // saying goodbye frees a bed and returns the gear
    const hired = Object.keys(g.chars).find((id) => id.startsWith("r_"))!;
    g.chars[hired].gear.weapon = "eq_sword_3";
    expect(dismiss(g, hired)).toBe(true);
    expect(g.chars[hired]).toBeUndefined();
    expect(g.inventory.eq_sword_3).toBe(1);
    expect(dismiss(g, "lyra")).toBe(false);
  });
});

describe("pets", () => {
  it("15 pets with unique gifts; eggs exist; the phoenix revives once and pets can strike", async () => {
    const { PETS, PET_EGG } = await import("../src/data/pets");
    const { getItem } = await import("../src/data/items");
    expect(PETS.length).toBe(15);
    expect(new Set(PETS.map((p) => p.hook)).size).toBe(PETS.length);
    expect(getItem(PET_EGG).name).toBe("Trứng Thú Cưng");
    const { Battle } = await import("../src/combat/engine");
    const mk = (side: "ally" | "enemy", uid: string) => ({ uid, side, name: uid, sprite: "slime", level: 1, base: { hp: 100, mp: 10, atk: 10, mag: 10, def: 0, res: 0, spd: 100, crit: 0, eva: 0 }, hp: 100, mp: 10, statuses: [], skills: [], passives: [], cooldowns: {}, av: 0, tags: [], resist: {} });
    const a = mk("ally", "a"), e = mk("enemy", "e");
    const b = new Battle([a as never], [{ ...e, resist: { fire: 1.5 }, shield: 1, shieldMax: 1 } as never], 1);
    b.petRevive = true;
    b.damage(a as never, 999, "physical", {});
    expect(a.hp).toBe(30);
    b.damage(a as never, 999, "physical", {});
    expect(a.hp).toBe(0);
    const foe = b.enemies[0];
    b.petHit(foe, "fire", 20);
    expect(foe.hp).toBe(70);
    expect(foe.broken).toBe(true);
  });
});

describe("sanctuary build costs stay friendly", () => {
  it("never asks for more than 10 of any material, about 5-6 typically", () => {
    const amounts: number[] = [];
    for (const b of BUILDING_LIST) for (let l = 0; l < (b.maxLevel ?? 5); l++) {
      for (const [k, v] of Object.entries(costFor(b.id, l))) if (k !== "gold") amounts.push(v);
    }
    for (let l = 0; l < 12; l++) for (const [k, v] of Object.entries(expansionCost(l))) if (k !== "gold") amounts.push(v);
    expect(Math.max(...amounts)).toBeLessThanOrEqual(MAX_MATERIAL);
    expect(Math.min(...amounts)).toBeGreaterThan(0);
    amounts.sort((a, b) => a - b);
    const median = amounts[amounts.length >> 1];
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(7);
  });
});

describe("raw material buildings", () => {
  it("pasture, hunter, vine trellis, pigsty, kiln and mana spring produce every day", async () => {
    const { advanceDay } = await import("../src/world/town");
    const g = newGame("A", "warrior", 7);
    for (const [type, x] of [["pasture", 50], ["hunter", 54], ["vinegarden", 57], ["pigsty", 60], ["kiln", 63], ["mana_spring", 66]] as const) g.buildings.push({ id: `t_${type}`, type, x, y: 58, level: 2 });
    g.inventory.wood = 50;
    g.inventory.cloud_cabbage = 10;
    g.settlers = 20;
    const before = { ...g.inventory };
    const rep = advanceDay(g);
    for (const id of ["hide", "wool", "meat_beast", "fiber_forest", "charcoal", "mana_crystal"]) {
      expect((g.inventory[id] ?? 0) > (before[id] ?? 0), id).toBe(true);
      expect(rep.gains[id] ?? 0).toBeGreaterThan(0);
    }
    expect(g.inventory.wood).toBeLessThan(50); // the kiln burnt some
  });
});

describe("quarry", () => {
  it("level 3 digs up gems of the regions reached, level 2 does not", async () => {
    const { BIOME_MATS } = await import("../src/data/items");
    const gems = new Set(Object.values(BIOME_MATS).map((m) => m.gem));
    const run = (level: number) => {
      const g = newGame("An", "warrior", 7);
      g.maxFloor = 12;
      g.settlers = 50; // fully staffed
      g.buildings.push({ id: "q1", type: "quarry", x: 30, y: 40, level });
      let n = 0;
      for (let d = 0; d < 20; d++) { const rep = advanceDay(g); for (const [id, k] of Object.entries(rep.gains ?? {})) if (gems.has(id)) n += k as number; }
      return n;
    };
    expect(run(2)).toBe(0);
    expect(run(3)).toBeGreaterThan(3);
    expect(run(4)).toBeGreaterThan(run(3) - 3);
  });
});

describe("sanctuary ground cover and layout", () => {
  it("floors and new decor cost things that exist; only water blocks the way", async () => {
    const { BUILDINGS } = await import("../src/data/buildings");
    const floors = BUILDING_LIST.filter((d) => d.floor);
    expect(floors.length).toBeGreaterThanOrEqual(20);
    for (const d of BUILDING_LIST.filter((x) => x.first)) for (const id of Object.keys(d.first!)) expect(ITEMS[id], `${d.id}: ${id}`).toBeTruthy();
    for (const d of floors) {
      expect(d.size).toEqual([1, 1]);
      expect(d.category).toBe("floor");
      expect(d.walkable, d.id).toBe(d.floor !== "water" || ["stepping_stones", "boardwalk"].includes(d.id));
    }
    expect(BUILDINGS.wall.first).toEqual({ stone: 6, brick: 3, mortar: 2 });
    // farm plots have no cap: as many as the territory holds
    const { buildLimitReason } = await import("../src/world/sanctuary");
    const g = newGame("A", "warrior", 7);
    for (let i = 0; i < 80; i++) g.buildings.push({ id: `f${i}`, type: "farm", x: 1000 + i, y: 0, level: 1, plot: { soil: 0, watered: false } });
    expect(buildLimitReason(g, "farm")).toBeNull();
  });

  it("finds buildings through the tile grid, after adds, moves and removals", async () => {
    const { buildingAt, buildingsMoved, canPlace, layoutKey, sproutAt, SPROUT } = await import("../src/world/sanctuary");
    const g = newGame("A", "warrior", 7);
    const t = territory(g.territory);
    const x = t.x0 + 1, y = t.y0 + 1;
    expect(buildingAt(g, x, y)).toBeUndefined();
    const k0 = layoutKey(g);
    const b = { id: "t1", type: "cobble", x, y, level: 1 };
    g.buildings.push(b);
    expect(buildingAt(g, x, y)).toBe(b);
    expect(layoutKey(g)).not.toBe(k0);
    expect(canPlace(g, "cobble", x, y)).toBeTruthy();
    b.x += 1; buildingsMoved();
    expect(buildingAt(g, x, y)).toBeUndefined();
    expect(buildingAt(g, x + 1, y)).toBe(b);
    g.buildings = g.buildings.filter((o) => o !== b);
    expect(buildingAt(g, x + 1, y)).toBeUndefined();
    // Sprout: her old spot until moved; nothing can be built on her
    expect(sproutAt(g)).toEqual(SPROUT);
    g.sprout = { x, y };
    expect(canPlace(g, "cobble", x, y)).toBe("Mầm đang đứng ở đây");
    expect(canPlace(g, "cobble", SPROUT.x, SPROUT.y)).toBeNull();
  });
});

describe("bulk upgrade", () => {
  it("raises many at once, lowest level first, and stops when the bag runs dry", async () => {
    const { bulkUpgrade, upgradeBlock } = await import("../src/world/sanctuary");
    const { costFor } = await import("../src/data/buildings");
    const g = newGame("A", "warrior", 7);
    const house = g.buildings.find((b) => b.type === "house")!;
    house.level = 6; // a capital, so nothing is held back by rank
    const mk = (id: string, level: number) => ({ id, type: "beehive", x: 0, y: 0, level });
    const hives = [mk("a", 1), mk("b", 2), mk("c", 1)];
    expect(upgradeBlock(g, house)).toBeTruthy(); // the house goes up through its own panel
    // enough for exactly the two level-1 hives
    for (const [id, n] of Object.entries(costFor("beehive", 1))) addItem(g, id, n * 2);
    const r = bulkUpgrade(g, hives, 1);
    expect(r).toEqual({ levels: 2, buildings: 2 });
    expect(hives.map((b) => b.level)).toEqual([2, 2, 2]);
    // as far as it goes: everything to the top when paid for
    for (const [id, n] of Object.entries(costFor("beehive", 2))) addItem(g, id, n * 3);
    const r2 = bulkUpgrade(g, hives, Infinity);
    expect(r2.levels).toBe(3);
    expect(hives.every((b) => b.level === 3 && upgradeBlock(g, b))).toBe(true);
  });
});
