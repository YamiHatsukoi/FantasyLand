/** FORMAT v21 rules (Kika, wagers, a blade that drains, permanent wounds, a Quiver slot, foods that are Meals) on made-up books: no book text here. */
import { describe, expect, it } from "vitest";
import {
  KILL, apply, arrowCap, check, enter, epMax, fightWeapons, give, heroCs, newRun, optInWeapons, pendingLoss, playRound, startBattle, takeOffer, wielded,
} from "../src/adventure/engine";
import type { AdvState, Book, CRT } from "../src/adventure/types";

// every cell: the foe loses 5, the hero loses 3
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [5, 3] as [number, number]));
const scene = { place: "p", bg: "hall" as const, time: "night" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
const seq = (...ns: number[]) => { let i = 0; return () => ((ns[i++] ?? 0) + 0.5) / 10; };

const items: Book["items"] = {
  Sword: { name: "Kiếm", type: "weapon" },
  Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true },
  Helshezag: { name: "Helshezag", type: "special", weapon: true, as: "Sword", cs: 5, csVs: { tag: "darklord", cs: 7 }, drain: { ep: 1, fromRound: 2 }, optIn: true },
  Quiver: { name: "Ống Tên", type: "special" },
  "Zejar-dulaga": { name: "Zejar-dulaga", type: "special", quiverSlot: true },
  Gnallia: { name: "Gnallia", type: "backpack", heal: 2, meal: true },
};
const kaiNames = { disc: { camouflage: "C", hunting: "H", sixthsense: "S", tracking: "T", healing: "He", weaponskill: "W", mindshield: "Ms", mindblast: "Mb", animalkinship: "A", mindovermatter: "Mom" } as Book["names"]["disc"] };

const book: Book = {
  id: "v21", series: "lw", num: 3, rules: "kai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword"], discCount: 5,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] }, items, names: kaiNames,
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, choices: [{ text: "Đi", to: "1" }] },
    "3": { text: ["c"], scene, combat: { foes: [{ name: "Darklord", cs: 10, ep: 60, tags: ["darklord"] }], win: "2" } },
    "4": { text: ["d"], scene, combat: { foes: [{ name: "Chim", cs: 10, ep: 60 }], scarIfWorse: true, win: "2" } },
    "5": { text: ["e"], scene, combat: { foes: [{ name: "Lord", cs: 10, ep: 60 }], firstRound: { rounds: 3, forbid: ["Sommerswerd"] }, win: "2" } },
  },
};

const mk = (): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["hunting", "tracking", "healing", "camouflage", "sixthsense"], picks: [] });
  s.weapons = ["Sword"];
  return s;
};

describe("v21: Kika", () => {
  it("kept apart from Gold Crowns: gained, checked, halved, lost", () => {
    const s = mk();
    apply(book, s, [{ kika: 25 }]);
    expect([s.kika, s.gold]).toEqual([25, 10]);
    expect(check(s, { kika: 1 })).toBe(true);
    expect(check(s, { kikaBelow: 10 })).toBe(false);
    apply(book, s, [{ loseHalf: "kika" }]);
    expect(s.kika).toBe(13);
    apply(book, s, [{ loseAll: "kika" }]);
    expect([s.kika, s.gold]).toEqual([0, 10]);
    expect(check(s, { kika: 1 })).toBe(false);
  });
});

describe("v21: a wager of the player's choosing (bet / payBet)", () => {
  it("blocks moving on until the stake is placed; at least the minimum; doubled when won, gone when lost", () => {
    const s = mk();
    s.kika = 30;
    apply(book, s, [{ bet: "kika", min: 10, into: "pit" }]);
    expect(pendingLoss(s)).toBe(true);
    expect(takeOffer(book, s, 0, "5")).toEqual([]);
    expect(takeOffer(book, s, 0, "40")).toEqual([]);
    takeOffer(book, s, 0, "20");
    expect([pendingLoss(s), s.kika]).toEqual([false, 10]);
    apply(book, s, [{ payBet: "pit", mul: 2 }]);
    expect(s.kika).toBe(50);
    apply(book, s, [{ bet: "kika", min: 10, into: "pit2" }]);
    takeOffer(book, s, 0, "50");
    expect(s.kika).toBe(0);
    const t = mk();
    apply(book, t, [{ bet: "kika", min: 10, into: "pit" }]);
    expect(pendingLoss(t)).toBe(false);
  });
});

describe("v21: a blade the player chooses to draw (Helshezag)", () => {
  it("sheathed until drawn; +7 against a Darklord; 1 basic ENDURANCE lost for good from the second round", () => {
    const s = mk();
    s.special = ["Helshezag"];
    s.ep = epMax(book, s);
    enter(book, s, "3");
    const c = book.sections["3"].combat!;
    const b = startBattle(book, s, book.sections["3"]);
    expect(optInWeapons(book, s, c)).toEqual(["Helshezag"]);
    expect(wielded(book, s, c, 0)).toBe("Sword");
    s.unused = [];
    expect(wielded(book, s, c, 0)).toBe("Helshezag");
    expect(heroCs(book, s, c, c.foes[0], -1, 0).total).toBe(s.cs + 7);
    const base = s.epBase;
    const r1 = playRound(book, s, b, false, seq(5));
    expect([r1.heroLoss, s.epBase]).toEqual([3, base]);
    const r2 = playRound(book, s, b, false, seq(5));
    expect([r2.heroLoss, s.epBase]).toEqual([4, base - 1]);
  });
});

describe("v21: permanent wounds after a bad first round (scarIfWorse)", () => {
  it("only when the first round cost the hero more than the foe", () => {
    const hurtCrt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [2, 3] as [number, number]));
    const kb: Book = { ...book, crt: hurtCrt };
    const s = mk();
    enter(kb, s, "4");
    const b = startBattle(kb, s, kb.sections["4"]);
    const base = s.epBase;
    playRound(kb, s, b, false, seq(5));
    expect(s.epBase).toBe(base);
    playRound(kb, s, b, false, seq(5));
    expect(s.epBase).toBe(base - 3);
    const t = mk();
    enter(book, t, "4");
    const bt = startBattle(book, t, book.sections["4"]);
    playRound(book, t, bt, false, seq(5));
    playRound(book, t, bt, false, seq(5));
    expect(t.epBase).toBe(base);
  });
});

describe("v21: a weapon out of reach in the first rounds (firstRound.forbid)", () => {
  it("the Sommerswerd comes back in the fourth round", () => {
    const s = mk();
    s.special = ["Sommerswerd"];
    const c = book.sections["5"].combat!;
    expect(fightWeapons(book, s, c, 0)).toEqual(["Sword"]);
    expect(wielded(book, s, c, 2)).toBe("Sword");
    expect(wielded(book, s, c, 3)).toBe("Sommerswerd");
  });
});

describe("v21: a Quiver slot and a food that is a Meal", () => {
  it("the Zejar-dulaga takes an Arrow's place; Gnallia is eaten as a Meal and restores 2", () => {
    const s = mk();
    s.special = ["Quiver"];
    apply(book, s, [{ arrows: 6 }]);
    give(book, s, "Zejar-dulaga", "special", 1);
    expect(arrowCap(book, s)).toBe(5);
    apply(book, s, [{ arrows: 1 }]);
    expect(s.arrows).toBe(5);
    s.arrows = 0;
    apply(book, s, [{ arrows: 6 }]);
    expect(s.arrows).toBe(5);
    s.ep = epMax(book, s) - 5;
    s.meals = 0;
    give(book, s, "Gnallia", "backpack", 2);
    apply(book, s, [{ eat: true, noHunt: true }]);
    expect(s.backpack.filter((x) => x === "Gnallia").length).toBe(1);
    expect(s.ep).toBe(epMax(book, s) - 3);
  });
});

void KILL;
