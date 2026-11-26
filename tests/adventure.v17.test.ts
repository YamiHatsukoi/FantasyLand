/** FORMAT v17 rules (borrowed weapon, weapon in hand, lost items kept for later, stakes) on a made-up book: no book text here. */
import { describe, expect, it } from "vitest";
import {
  apply, asksWield, check, choiceState, condText, enter, heroCs, newRun, pendingLoss, playRound, randomResult, startBattle, takeOffer, visibleChoices, wielded, validateBook,
} from "../src/adventure/engine";
import type { AdvState, Book, CRT, Section } from "../src/adventure/types";

// every cell: the foe loses 5, the hero loses 1
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [5, 1] as [number, number]));
const scene = { place: "p", bg: "hall" as const, time: "night" as const, weather: "clear" as const, actors: [], mood: "calm" as const };

const book: Book = {
  id: "v17", series: "lw", num: 8, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Dagger", "Axe", "Quarterstaff", "Spear"], discCount: 3,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] },
  items: {
    Sword: { name: "Kiếm", type: "weapon" }, Dagger: { name: "Dao Găm", type: "weapon" }, Axe: { name: "Rìu", type: "weapon" }, Quarterstaff: { name: "Gậy", type: "weapon" },
    "Paido's Sword": { name: "Kiếm của Paido", type: "weapon", as: "Sword" },
    Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true },
    "Bronin Warhammer": { name: "Búa Bronin", type: "special", cs: 1, weapon: true },
    "Magic Spear": { name: "Giáo Phép", type: "special", as: "Spear" },
    Shield: { name: "Khiên", type: "special", cs: 2 },
    Map: { name: "Bản đồ", type: "special" }, Gem: { name: "Ngọc", type: "special" }, Key: { name: "Chìa", type: "special" }, Ring: { name: "Nhẫn", type: "special" },
    Rope: { name: "Dây", type: "backpack" }, Torch: { name: "Đuốc", type: "backpack" }, Quiver: { name: "Ống tên", type: "special" },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, end: "victory" },
    // a Helghast that only the borrowed blade can hurt
    "3": { text: ["c"], scene, combat: { foes: [{ name: "Helghast", cs: 20, ep: 40, undead: true }], weapon: "Paido's Sword", win: "2" } },
    "4": { text: ["d"], scene, combat: { foes: [{ name: "Helghast", cs: 20, ep: 40, undead: true }], win: "2" } },
    "5": {
      text: ["e"], scene,
      random: { mods: [{ if: { wields: ["Dagger", "Quarterstaff"] }, add: -3 }, { if: { wields: ["Axe"] }, add: 1 }], out: [{ min: -99, max: 6, to: "1" }, { min: 7, max: 99, to: "2" }] },
    },
    // "first decide on your stake": a flag on entry, stakes as repeatable choices, the riddle once staked
    "6": {
      text: ["f"], scene,
      fx: [{ flag: "due", if: { any: [{ hasAny: "special" }, { hasAny: "backpack" }] } }],
      choices: [
        { text: "Cược một Vật Phẩm Đặc Biệt", to: "6", repeat: true, if: { all: [{ flag: "due" }, { hasAny: "special" }] }, fx: [{ loseChoice: "special", n: 1, into: "khmar" }, { unflag: "due" }] },
        { text: "Cược ba món Ba Lô", to: "6", repeat: true, if: { all: [{ flag: "due" }, { hasAny: "backpack" }] }, fx: [{ loseChoice: "backpack", n: 3, into: "khmar" }, { unflag: "due" }] },
        { text: "Trả lời", to: "7", riddle: true, fail: "8", if: { notFlag: "due" } },
        { text: "Không biết", to: "8", if: { notFlag: "due" } },
      ],
    },
    "7": { text: ["g"], scene, fx: [{ unstash: "khmar" }], choices: [{ text: "Đi", to: "2" }] },
    "8": { text: ["h"], scene, choices: [{ text: "Đi", to: "2" }] },
    "9": { text: ["i"], scene, choices: [{ text: "Đi", to: "2", if: { wieldsMastered: true } }, { text: "Thôi", to: "2" }] },
  },
};

const mk = (discs: AdvState["disciplines"] = ["weaponmastery", "curing", "nexus"], mastered = ["Sword"]): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, mastered, picks: [] });
  s.weapons = ["Dagger"];
  return s;
};
const part = (s: AdvState, sec: string, label: string) => heroCs(book, s, book.sections[sec].combat!, book.sections[sec].combat!.foes[0]).parts.find((p) => p.label.startsWith(label))?.v;

describe("v17: a borrowed weapon (combat.weapon)", () => {
  it("fights with it: its kind counts for Weaponmastery, the hero's own weapons do not", () => {
    const s = mk();
    s.special = ["Sommerswerd", "Shield"];
    const c = book.sections["3"].combat!;
    expect(wielded(book, s, c)).toBe("Paido's Sword");
    const cs = heroCs(book, s, c, c.foes[0]);
    // Weaponmastery with Sword (Paido's sword is a sword); Shield still +2; no Sommerswerd +8
    expect(cs.parts.map((p) => p.label)).toEqual(["Cơ bản", "WM (Kiếm của Paido)", "Khiên"]);
    expect(cs.total).toBe(15 + 3 + 2);
    // without Weaponmastery in swords: no bonus, but not bare-handed either
    const t = mk(["weaponmastery", "curing", "nexus"], ["Dagger"]);
    expect(heroCs(book, t, c, c.foes[0]).parts.map((p) => p.label)).toEqual(["Cơ bản"]);
  });

  it("the Sommerswerd does not double the damage to the undead when it is not the blade used", () => {
    const s = mk();
    s.special = ["Sommerswerd"];
    s.section = "3";
    const b = startBattle(book, s, book.sections["3"]);
    playRound(book, s, b, false, () => 0.5);
    expect(b.foes[0].ep).toBe(35);
    s.section = "4";
    const b2 = startBattle(book, s, book.sections["4"]);
    playRound(book, s, b2, false, () => 0.5);
    expect(b2.foes[0].ep).toBe(30);
  });

  it("validates as a normal book", () => {
    expect(validateBook(book)).toEqual([]);
  });
});

describe("v17: the weapon in hand", () => {
  it("fights with the best one: a weapon-like Special Item adds its COMBAT SKILL only in hand", () => {
    const s = mk();
    s.special = ["Sommerswerd", "Bronin Warhammer"];
    const c = book.sections["4"].combat!;
    expect(wielded(book, s, c)).toBe("Sommerswerd");
    // Sommerswerd +8 and Weaponmastery with swords; the Warhammer's +1 does not add beside it
    expect(part(s, "4", "Sommerswerd")).toBe(8);
    expect(part(s, "4", "Búa Bronin")).toBeUndefined();
    expect(part(s, "4", "WM")).toBe(3);
    // a mastered Dagger is worth less than the Sommerswerd: the Sommerswerd is used, no Dagger bonus
    const t = mk(["weaponmastery", "curing", "nexus"], ["Dagger"]);
    t.special = ["Sommerswerd"];
    expect(wielded(book, t, c)).toBe("Sommerswerd");
    expect(part(t, "4", "WM")).toBeUndefined();
    // the mastered one among ordinary weapons
    const u = mk(["weaponmastery", "curing", "nexus"], ["Axe"]);
    u.weapons = ["Dagger", "Axe"];
    expect(wielded(book, u, c)).toBe("Axe");
    expect(part(u, "4", "WM (Rìu)")).toBe(3);
  });

  it("wields / wieldsMastered: the weapon chosen for the section, else the engine's pick", () => {
    const s = mk(["weaponmastery", "curing", "nexus"], ["Sword"]);
    s.weapons = ["Dagger", "Sword"];
    expect(wielded(book, s)).toBe("Sword");
    expect(check(s, { wields: ["Dagger", "Quarterstaff"] }, book)).toBe(false);
    expect(check(s, { wieldsMastered: true }, book)).toBe(true);
    s.wield = "Dagger";
    expect(check(s, { wields: ["Dagger", "Quarterstaff"] }, book)).toBe(true);
    expect(check(s, { wields: "Dagger" }, book)).toBe(true);
    expect(check(s, { wieldsMastered: true }, book)).toBe(false);
    // a choice in a fight ignores it: the fight takes the best weapon
    expect(wielded(book, s, book.sections["4"].combat)).toBe("Sword");
    // a weapon no longer carried does not count
    s.weapons = ["Sword"];
    expect(wielded(book, s)).toBe("Sword");
    // kinds: Paido's sword is a sword
    s.weapons = ["Paido's Sword", "Dagger"];
    s.wield = "Paido's Sword";
    expect(check(s, { wields: "Sword" }, book)).toBe(true);
    expect(check(s, { wieldsMastered: true }, book)).toBe(true);
    // bare-handed: no weapon in hand
    s.weapons = [];
    expect(wielded(book, s)).toBeNull();
    expect(check(s, { wields: "Dagger" }, book)).toBe(false);
    expect(check(s, { wieldsMastered: true }, book)).toBe(false);
  });

  it("random mods by the weapon in use; the choice is reset in the next section", () => {
    const s = mk();
    s.weapons = ["Dagger", "Axe"];
    enter(book, s, "5");
    expect(asksWield(book.sections["5"])).toBe(true);
    expect(asksWield(book.sections["9"])).toBe(true);
    expect(asksWield(book.sections["1"])).toBe(false);
    s.wield = "Axe";
    expect(randomResult(book, book.sections["5"], s, 6)).toMatchObject({ add: 1, value: 7, to: "2" });
    s.wield = "Dagger";
    expect(randomResult(book, book.sections["5"], s, 6)).toMatchObject({ add: -3, to: "1" });
    enter(book, s, "1");
    expect(s.wield).toBeUndefined();
  });

  it("a choice locked by the weapon in hand says so", () => {
    const s = mk(["weaponmastery", "curing", "nexus"], ["Axe"]);
    expect(choiceState(s, book.sections["9"].choices![0], book)).toBe("locked");
    expect(condText(book, { wields: ["Dagger", "Axe"] })).toBe("cần dùng Dao Găm hoặc Rìu");
    s.weapons = ["Axe"];
    expect(choiceState(s, book.sections["9"].choices![0], book)).toBe("ok");
  });

  it("an old save without the field still plays", () => {
    const s = mk();
    delete s.wield;
    const old = JSON.parse(JSON.stringify(s)) as AdvState;
    expect(wielded(book, old)).toBe("Dagger");
    expect(() => enter(book, old, "5")).not.toThrow();
  });
});

describe("v17: lost items kept for later (into / unstash)", () => {
  it("a pickpocket's theft by position is given back by unstash", () => {
    const s = mk();
    s.special = ["Map", "Gem", "Key"];
    apply(book, s, [{ loseNth: { kind: "special", n: 2, else: [{ kind: "special", n: "last" }, { kind: "backpack", n: 1 }] }, into: "thief" }]);
    expect(s.special).toEqual(["Map", "Key"]);
    expect(s.stashes?.thief?.special).toEqual(["Gem"]);
    const ch = apply(book, s, [{ unstash: "thief" }]);
    expect(s.special).toEqual(["Map", "Key", "Gem"]);
    expect(s.stashes?.thief).toBeUndefined();
    expect(ch.map((c) => c.label)).toEqual(["Lấy lại hành trang"]);
    // nothing was stolen: unstash does nothing
    expect(apply(book, s, [{ unstash: "thief" }])).toEqual([]);
  });

  it("the first Backpack Item when there is no Special Item; lose / loseRandom with into", () => {
    const s = mk();
    s.backpack = ["Rope", "Torch"];
    apply(book, s, [{ loseNth: { kind: "special", n: 2, else: [{ kind: "backpack", n: 1 }] }, into: "thief" }]);
    expect(s.backpack).toEqual(["Torch"]);
    expect(s.stashes?.thief?.backpack).toEqual(["Rope"]);
    s.special = ["Sommerswerd"];
    apply(book, s, [{ lose: "Sommerswerd", into: "haakon" }]);
    expect(s.special).toEqual([]);
    apply(book, s, [{ unstash: "haakon" }]);
    expect(s.special).toEqual(["Sommerswerd"]);
    s.meals = 2;
    apply(book, s, [{ lose: "Meal", n: 1, into: "x" }]);
    expect(s.meals).toBe(1);
    expect(s.stashes?.x?.meals).toBe(1);
    apply(book, s, [{ loseRandom: { kind: "backpack", n: 9 }, into: "x" }]);
    expect(s.backpack).toEqual([]);
    expect(s.meals).toBe(0);
    expect(s.stashes?.x).toMatchObject({ backpack: ["Torch"], meals: 2 });
  });

  it("a Quiver goes with its Arrows; what no longer fits is offered", () => {
    const s = mk();
    s.special = ["Quiver"];
    s.arrows = 4;
    apply(book, s, [{ loseNth: { kind: "special", n: 1 }, into: "thief" }]);
    expect(s.arrows).toBe(0);
    expect(s.stashes?.thief?.arrows).toBe(4);
    apply(book, s, [{ unstash: "thief" }]);
    expect(s.arrows).toBe(4);
    s.backpack = ["Rope"];
    apply(book, s, [{ lose: "Rope", into: "y" }]);
    s.backpack = Array.from({ length: 8 }, () => "Torch");
    apply(book, s, [{ unstash: "y" }]);
    expect(s.offers).toEqual([{ gain: "Rope", type: "backpack", n: 1 }]);
  });
});

describe("v17: wagers (loseChoice into)", () => {
  const sec = book.sections["6"] as Section;
  it("first the stake, then the riddle; the staked item is held, a win gives it back", () => {
    const s = mk();
    s.special = ["Map", "Gem"];
    s.backpack = ["Rope"];
    enter(book, s, "6");
    // only the stakes are open at first
    const open = () => visibleChoices(sec, s).filter((c) => choiceState(s, c, book) === "ok").map((c) => c.text);
    expect(open()).toEqual(["Cược một Vật Phẩm Đặc Biệt", "Cược ba món Ba Lô"]);
    apply(book, s, sec.choices![0].fx);
    expect(pendingLoss(s)).toBe(true);
    expect(s.offers).toEqual([{ loseChoice: "special", n: 1, into: "khmar" }]);
    expect(open()).toEqual(["Trả lời", "Không biết"]);
    const ch = takeOffer(book, s, 0, "Gem");
    expect(ch.map((c) => c.label)).toEqual(["Giao Ngọc"]);
    expect(s.special).toEqual(["Map"]);
    expect(s.stashes?.khmar?.special).toEqual(["Gem"]);
    expect(pendingLoss(s)).toBe(false);
    enter(book, s, "7");
    expect(s.special).toEqual(["Map", "Gem"]);
  });

  it("three Backpack Items (Meals count); fewer than three: all there is; a loss keeps them away", () => {
    const s = mk();
    s.backpack = ["Rope", "Torch"];
    s.meals = 1;
    enter(book, s, "6");
    apply(book, s, book.sections["6"].choices![1].fx);
    takeOffer(book, s, 0, "Meal");
    takeOffer(book, s, 0, "Rope");
    expect(s.offers[0]).toMatchObject({ n: 1 });
    takeOffer(book, s, 0, "Torch");
    expect(s.offers).toEqual([]);
    expect(s.stashes?.khmar).toMatchObject({ backpack: ["Rope", "Torch"], meals: 1 });
    enter(book, s, "8");
    expect(s.backpack).toEqual([]);
    expect(s.meals).toBe(0);
    // nothing to stake: the riddle is open at once
    const t = mk();
    t.backpack = []; t.special = []; t.meals = 0;
    enter(book, t, "6");
    expect(visibleChoices(sec, t).filter((c) => choiceState(t, c, book) === "ok").map((c) => c.text)).toEqual(["Trả lời", "Không biết"]);
  });
});
