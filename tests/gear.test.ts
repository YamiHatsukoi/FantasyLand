import { describe, expect, it } from "vitest";
import { charStats, equipGear, fitsGear, migrate, newGame } from "../src/core/state";
import { EQUIP_KINDS, GEAR_BY_FLOOR, ITEM_LIST, gearForFloor, getItem } from "../src/data/items";
import { PASSIVES } from "../src/data/passives";
import { ICON_SHAPES } from "../src/render/icons";
import { Battle } from "../src/combat/engine";
import { unitFromCharacter } from "../src/combat/factory";

describe("equipment catalogue", () => {
  it("has 100 pieces for every kind, with valid passives and icons", () => {
    expect(EQUIP_KINDS.length).toBeGreaterThanOrEqual(40);
    for (const k of EQUIP_KINDS) expect(ITEM_LIST.filter((i) => i.tags?.includes("gear") && i.equip!.kind === k).length, k).toBe(100);
    const names = ITEM_LIST.filter((i) => i.equip).map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const i of ITEM_LIST.filter((x) => x.equip)) {
      if (i.equip!.passive) expect(PASSIVES[i.equip!.passive], i.id).toBeTruthy();
      expect(ICON_SHAPES.includes(i.shape), i.shape).toBe(true);
    }
    for (let f = 1; f <= 100; f++) expect(GEAR_BY_FLOOR[f].length).toBe(EQUIP_KINDS.length);
    const it = gearForFloor(50, (xs) => xs[0]);
    expect(it.equip!.floor).toBeGreaterThanOrEqual(48);
  });

  it("power grows with depth", () => {
    expect(getItem("eq_sword_100").equip!.stats.atk!).toBeGreaterThan(getItem("eq_sword_50").equip!.stats.atk! * 1.5);
    expect(getItem("eq_greatsword_20").equip!.stats.atk!).toBeGreaterThan(getItem("eq_sword_20").equip!.stats.atk!);
  });
});

describe("hands and slots", () => {
  it("two-handed weapons free the off hand and vice versa", () => {
    const g = newGame("T", "warrior", 1);
    const ch = g.chars[g.heroId];
    expect(equipGear(ch, "weapon", "eq_sword_5")).toEqual([]);
    expect(fitsGear("offhand", "eq_dagger_5")).toBe(true);
    expect(fitsGear("offhand", "eq_greatsword_5")).toBe(false);
    expect(fitsGear("ring2", "eq_ring_5")).toBe(true);
    expect(equipGear(ch, "offhand", "eq_shield_5")).toEqual([]);
    expect(equipGear(ch, "weapon", "eq_greatsword_5").sort()).toEqual(["eq_shield_5", "eq_sword_5"].sort());
    expect(ch.gear.offhand).toBeUndefined();
    expect(equipGear(ch, "offhand", "eq_tome_5")).toEqual(["eq_greatsword_5"]);
    expect(ch.gear.weapon).toBeUndefined();
  });

  it("an off-hand weapon counts for half and strikes after basic attacks", () => {
    const g = newGame("T", "rogue", 1);
    const ch = g.chars[g.heroId];
    const base = charStats(ch).atk;
    equipGear(ch, "weapon", "eq_dagger_40");
    const one = charStats(ch).atk;
    equipGear(ch, "offhand", "eq_dagger_41");
    const two = charStats(ch).atk;
    expect(two - one).toBe(Math.round(getItem("eq_dagger_41").equip!.stats.atk! * 0.5));
    expect(one).toBeGreaterThan(base);
    const u = unitFromCharacter(ch);
    expect(u.dual).toBe(true);
    const foe = { ...unitFromCharacter(newGame("E", "warrior", 2).chars.hero), uid: "e1", side: "enemy" as const, charId: undefined, dual: false };
    foe.base = { ...foe.base, hp: 99999, eva: 0 }; foe.hp = 99999;
    const b = new Battle([u], [foe], 7);
    b.events.length = 0;
    b.act(b.units.find((x) => x.uid === u.uid)!, { skill: "attack", target: "e1" });
    const hits = b.events.filter((e) => e.t === "dmg" && e.uid === "e1" && !e.dot);
    expect(hits.length).toBe(2);
  });

  it("migrates the old accessory slot and shields held as weapons", () => {
    const g = newGame("T", "warrior", 1);
    const ch = g.chars[g.heroId];
    (ch.gear as Record<string, string>) = { weapon: "bark_shield", armor: "leather_armor", accessory: "sand_boots" };
    const m = migrate(JSON.parse(JSON.stringify(g)));
    const gear = m.chars[m.heroId].gear;
    expect(gear.offhand).toBe("bark_shield");
    expect(gear.feet).toBe("sand_boots");
    expect(gear.armor).toBe("leather_armor");
    expect((gear as Record<string, string>).accessory).toBeUndefined();
  });
});
