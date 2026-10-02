import { describe, expect, it } from "vitest";
import { MAX_LEVEL, POINTS_PER_LEVEL, allocPoint, charStats, giveXp, makeCharacter, migrate, newGame, resetPoints } from "../src/core/state";
import { CLASSES, xpForLevel } from "../src/data/classes";
import { getFloor } from "../src/world/floors";
import { SKILLS } from "../src/data/skills";
import { isPerson } from "../src/render/people";

describe("hero stat points", () => {
  it("earns points on level-up and spends them", () => {
    const g = newGame("An", "warrior", 1);
    const hero = g.chars.hero;
    giveXp(hero, 100000);
    expect(hero.points).toBe((hero.level - 1) * POINTS_PER_LEVEL);
    const atk = charStats(hero).atk;
    expect(allocPoint(hero, "atk", 5)).toBe(true);
    expect(charStats(hero).atk).toBe(atk + 5);
    for (let i = 0; i < 100; i++) allocPoint(hero, "crit");
    expect(hero.alloc!.crit).toBeLessThanOrEqual(40);
    resetPoints(hero);
    expect(hero.points).toBe((hero.level - 1) * POINTS_PER_LEVEL);
    expect(charStats(hero).atk).toBe(atk);
    // companions do not get points
    const c = makeCharacter("lyra", "Lyra", "ranger", "lyra", 1);
    giveXp(c, 100000);
    expect(c.points).toBeUndefined();
  });
  it("old saves get points for levels already gained", () => {
    const g = newGame("An", "warrior", 1);
    g.chars.hero.level = 11;
    delete g.chars.hero.points;
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.chars.hero.points).toBe(10 * POINTS_PER_LEVEL);
  });
  it("levels go up to 200 and the floor-100 gatekeeper waits there", () => {
    const c = makeCharacter("x", "X", "warrior", "hero", 1);
    giveXp(c, 1e12);
    expect(c.level).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(200);
    expect(getFloor(100).levelBase + 4).toBe(200);
    expect(getFloor(1).levelBase).toBe(1);
    for (let n = 2; n <= 100; n++) expect(getFloor(n).levelBase - getFloor(n - 1).levelBase).toBeGreaterThanOrEqual(1);
  });
  it("undoes the short-lived doubled levels of v4 saves", () => {
    const g = newGame("An", "warrior", 1);
    g.v = 4;
    g.chars.hero.level = 39; // was 20 before v4
    g.chars.hero.xp = Math.round(15 * Math.pow(20, 1.55) / 2); // halfway on the v4 curve
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.chars.hero.level).toBe(20);
    expect(m.chars.hero.xp / xpForLevel(20)).toBeCloseTo(0.5, 1);
    // a v3 save is left alone
    const h = newGame("B", "mage", 2);
    h.v = 3;
    h.chars.hero.level = 20;
    expect(migrate(JSON.parse(JSON.stringify(h))).chars.hero.level).toBe(20);
  });
});

describe("classes", () => {
  it("has 24 classes with valid skills and a hero sprite each", () => {
    expect(Object.keys(CLASSES).length).toBe(24);
    for (const c of Object.values(CLASSES)) {
      for (const s of [...c.startSkills, ...Object.values(c.learnset)]) expect(SKILLS[s], `${c.id}:${s}`).toBeTruthy();
      expect(isPerson(`hero_${c.id}`), c.id).toBe(true);
    }
  });
});

describe("forge enhancement", () => {
  it("costs gold, can fail at high levels, and the level travels with the item", async () => {
    const { newGame, charStats, equipGear, tryEnhance, enhanceCost, ENH_MAX, migrate } = await import("../src/core/state");
    const { GEAR_BY_FLOOR, enhLevel, enhancedId, baseItemId, getItem } = await import("../src/data/items");
    const g = newGame("An", "warrior", 1);
    const hero = g.chars[g.heroId];
    const sword = GEAR_BY_FLOOR[5].find((i) => i.equip!.kind === "sword")!;
    for (const x of equipGear(hero, "weapon", sword.id)) g.inventory[x] = (g.inventory[x] ?? 0) + 1;
    const atk0 = charStats(hero).atk;
    g.gold = 0;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("gold");
    g.gold = 1e9;
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("ok");
    expect(hero.gear.weapon).toBe(`${sword.id}+1`);
    expect(getItem(hero.gear.weapon!).name).toBe(`${sword.name} +1`);
    expect(charStats(hero).atk).toBeGreaterThanOrEqual(atk0 + 1);
    for (let i = 1; i < ENH_MAX; i++) tryEnhance(g, hero, "weapon", 0);
    expect(enhLevel(hero.gear.weapon!)).toBe(ENH_MAX);
    expect(tryEnhance(g, hero, "weapon", 0)).toBe("max");
    // +10 roughly doubles the weapon
    expect(getItem(hero.gear.weapon!).equip!.stats.atk!).toBeGreaterThanOrEqual(sword.equip!.stats.atk! * 2);
    // a bad roll at a risky level only costs gold
    hero.gear.weapon = enhancedId(sword.id, 8);
    const before = g.gold;
    expect(tryEnhance(g, hero, "weapon", 0.99)).toBe("fail");
    expect(enhLevel(hero.gear.weapon!)).toBe(8);
    expect(before - g.gold).toBe(enhanceCost(g, 8));
    // swapping weapons: the new one is plain, the +8 goes back to the bag as it is
    const other = GEAR_BY_FLOOR[6].find((i) => i.equip!.kind === "sword")!;
    const back = equipGear(hero, "weapon", other.id);
    expect(back).toContain(`${sword.id}+8`);
    expect(enhLevel(hero.gear.weapon!)).toBe(0);
    expect(baseItemId(`${sword.id}+8`)).toBe(sword.id);
    // old saves: the per-slot level moves onto the worn item
    const old = JSON.parse(JSON.stringify(g));
    old.chars[old.heroId].gear.weapon = other.id;
    old.chars[old.heroId].enh = { weapon: 3 };
    const m = migrate(old);
    expect(m.chars[m.heroId].gear.weapon).toBe(`${other.id}+3`);
    expect(m.chars[m.heroId].enh).toBeUndefined();
  });
});

describe("milestone floors", () => {
  it("clearing a tenth floor once grants a lasting mark and a trophy chest", async () => {
    const { newGame, partyBuffs } = await import("../src/core/state");
    const { applyEffect } = await import("../src/story/runner");
    const { Rng } = await import("../src/core/rng");
    const g = newGame("An", "warrior", 1);
    const ctx = { g, floor: 10, vars: {}, rng: new Rng(1) } as Parameters<typeof applyEffect>[1];
    const gold0 = g.gold;
    const lines = applyEffect({ clearFloor: true }, ctx);
    expect(lines.some((l) => l.includes("Tầng Mốc"))).toBe(true);
    expect(g.gold).toBeGreaterThan(gold0);
    expect(partyBuffs(g).atk).toBeCloseTo(0.02);
    applyEffect({ clearFloor: true }, ctx);
    expect(g.flags.marks).toBe(1);
    applyEffect({ clearFloor: true }, { ...ctx, floor: 11 });
    expect(g.flags.marks).toBe(1);
  });
});

describe("changing the hero's class", () => {
  it("swaps the class's own skills and passive, keeps learnt ones, refunds points, charges gold", async () => {
    const { changeClass, classChangeCost, allocPoint } = await import("../src/core/state");
    const g = newGame("An", "warrior", 1);
    const hero = g.chars.hero;
    giveXp(hero, 1e6);
    hero.level = 20;
    hero.skills.push("heal"); // learnt from a tome
    hero.equipped = ["slash", "heal", "cross_slash"];
    hero.passives.push("p_vigor");
    hero.equippedPassives = ["p_might", "p_vigor"];
    allocPoint(hero, "atk", 10);
    const points = hero.points! + 10;
    const gear = { ...hero.gear };
    const cost = classChangeCost(hero);
    expect(changeClass(g, hero, "mage")).toMatch(/vàng/); // too poor
    g.gold = cost + 5;
    expect(changeClass(g, hero, "mage")).toBeNull();
    expect(g.gold).toBe(5);
    expect(hero.classId).toBe("mage");
    expect(hero.sprite).toBe("hero_mage");
    // warrior skills gone, mage skills up to level 20 in, the tome skill kept
    expect(hero.skills).not.toContain("slash");
    expect(hero.skills).toContain("fire_bolt");
    expect(hero.skills).toContain("overload"); // mage level 18
    expect(hero.skills).not.toContain("arcane_blast"); // mage level 24
    expect(hero.skills).toContain("heal");
    expect(hero.equipped).toContain("heal");
    expect(hero.equipped.length).toBe(3);
    expect(hero.equipped.every((sk) => hero.skills.includes(sk))).toBe(true);
    // the starting passive changes, learnt passives stay
    expect(hero.passives).toContain("p_wisdom");
    expect(hero.passives).not.toContain("p_might");
    expect(hero.equippedPassives).toEqual(["p_wisdom", "p_vigor"]);
    expect(hero.points).toBe(points);
    expect(hero.gear).toEqual(gear);
    // later level-ups follow the new class
    expect(CLASSES[hero.classId].learnset[24]).toBe("arcane_blast");
  });

  it("only the hero, only at home", async () => {
    const { changeClass, classChangeBlocker } = await import("../src/core/state");
    const g = newGame("An", "warrior", 1);
    g.gold = 1e7;
    const c = makeCharacter("lyra", "Lyra", "ranger", "lyra", 10);
    g.chars.lyra = c;
    expect(classChangeBlocker(g, c, "mage")).toMatch(/nhân vật chính/);
    expect(classChangeBlocker(g, g.chars.hero, "warrior")).toMatch(/hiện tại/);
    g.expedition = { floor: 1 } as never;
    expect(changeClass(g, g.chars.hero, "mage")).toMatch(/Thánh Địa/);
  });
});

describe("class gifts", () => {
  it("every class has one, and inborn passives are real and take no slot", async () => {
    const { CLASSES } = await import("../src/data/classes");
    const { TRAITS, traitPassiveId } = await import("../src/data/classTraits");
    const { getPassive } = await import("../src/data/passives");
    const { charPassives, makeCharacter } = await import("../src/core/state");
    for (const id of Object.keys(CLASSES)) {
      const t = TRAITS[id];
      expect(t, id).toBeTruthy();
      expect(t.hooks || t.skillSlots || t.passiveSlots || t.pets || t.party, id).toBeTruthy();
      if (t.hooks) {
        expect(getPassive(traitPassiveId(id)).hooks).toBe(t.hooks);
        const ch = makeCharacter("x", "X", id, "hero", 5);
        expect(charPassives(ch)).toContain(traitPassiveId(id));
        expect(ch.equippedPassives).not.toContain(traitPassiveId(id));
      }
    }
  });

  it("mages hold more skills, warriors more passives, beastmasters bring more pets", async () => {
    const { activePets, makeCharacter, newGame, passiveSlots, petLimit, skillSlots } = await import("../src/core/state");
    const g = newGame("A", "warrior", 7);
    const mage = makeCharacter("m", "M", "mage", "hero", 5), war = makeCharacter("w", "W", "warrior", "hero", 5);
    expect(skillSlots(g, mage)).toBe(skillSlots(g) + 2);
    expect(passiveSlots(g, war)).toBe(passiveSlots(g) + 1);
    g.pets = ["pet_cat", "pet_owl", "pet_pig", "pet_fox"];
    g.pet = "pet_cat"; g.petsExtra = ["pet_owl", "pet_pig"];
    expect(petLimit(g)).toBe(1);
    expect(activePets(g)).toEqual(["pet_cat"]);
    g.chars.b = makeCharacter("b", "B", "beastmaster", "hero", 5); g.party.push("b");
    expect(petLimit(g)).toBe(3);
    expect(activePets(g)).toEqual(["pet_cat", "pet_owl", "pet_pig"]);
    // a pet the party doesn't own never travels
    g.petsExtra = ["pet_owl", "pet_dragon_nope"];
    expect(activePets(g)).toEqual(["pet_cat", "pet_owl"]);
  });
});
