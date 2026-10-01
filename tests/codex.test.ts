import { describe, expect, it } from "vitest";
import { enhanceCost, newGame, tryEnhance } from "../src/core/state";
import { ITEM_LIST, enhLevel } from "../src/data/items";
import { CATALYSTS, droppedBy, regionSource, usesOf } from "../src/data/uses";

const geared = () => {
  const g = newGame("A", "warrior", 7);
  const ch = g.chars[g.heroId];
  const key = "weapon" as const;
  ch.gear[key] = `${ITEM_LIST.find((i) => i.equip?.slot === "weapon")!.id}+5`; // 70% base chance
  g.gold = 1e9;
  return { g, ch, key };
};

describe("item uses & sources", () => {
  it("knows what common materials are for", () => {
    expect(usesOf("wood").some((u) => u.icon === "🔨")).toBe(true);
    expect(usesOf("wood").some((u) => u.icon === "🏗️")).toBe(true);
    for (const id of Object.keys(CATALYSTS)) expect(usesOf(id).length, id).toBeGreaterThan(0);
  });
  it("only names monsters the player has met as drop sources", () => {
    const none = droppedBy("hide", {});
    expect(none.known.length).toBe(0);
    expect(none.unknown).toBeGreaterThan(0);
    expect(droppedBy("hide", { forest_wolf: 1 }).known.map((k) => k.def.id)).toContain("forest_wolf");
    expect(regionSource("hide_desert")).toMatch(/Sa Mạc/);
  });
});

describe("enhancement catalysts", () => {
  it("the seal gem guarantees success and is used up", () => {
    const { g, ch, key } = geared();
    g.inventory.seal_gem = 1;
    expect(tryEnhance(g, ch, key, 0.999, "seal_gem")).toBe("ok");
    expect(enhLevel(ch.gear[key]!)).toBe(6);
    expect(g.inventory.seal_gem).toBeUndefined();
  });
  it("the soul gem refunds a failure", () => {
    const { g, ch, key } = geared();
    g.inventory.soul_gem = 2;
    const gold = g.gold;
    expect(tryEnhance(g, ch, key, 0.999, "soul_gem")).toBe("fail");
    expect(g.gold).toBe(gold);
    expect(g.inventory.soul_gem).toBe(1);
  });
  it("the tiger eye adds 25% and a gem is never wasted on a certain roll", () => {
    const { g, ch, key } = geared();
    g.inventory.tiger_eye = 1;
    expect(tryEnhance(g, ch, key, 0.9, "tiger_eye")).toBe("ok"); // 0.7 + 0.25 > 0.9
    const { g: g2, ch: c2, key: k2 } = geared();
    c2.gear[k2] = c2.gear[k2]!.replace(/\+\d+$/, "");
    g2.inventory.seal_gem = 1;
    const before = g2.gold;
    expect(tryEnhance(g2, c2, k2, 0.5, "seal_gem")).toBe("ok");
    expect(g2.inventory.seal_gem).toBe(1);
    expect(before - g2.gold).toBe(enhanceCost(g2, 0));
  });
});
