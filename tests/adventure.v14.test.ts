/** FORMAT v14 rules on a made-up book: no book text in this repository. */
import { describe, expect, it } from "vitest";
import {
  apply, check, choiceState, dosesLeft, drop, heroCs, heroLossMul, losePool, newRun, pendingLoss, playRound, startBattle, takeOffer, usable, useItem,
} from "../src/adventure/engine";
import type { AdvState, Book, Combat, CRT, Disc } from "../src/adventure/types";

// hero loses 3 (column 0 kills), enemy loses 3 + column (column 12 kills)
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 3] as [number, number]));
const fixed = (n: number) => () => n / 10 + 0.01;
const scene = { place: "p", bg: "forest" as const, time: "day" as const, weather: "clear" as const, actors: [], mood: "calm" as const };

const book: Book = {
  id: "v14", series: "lw", num: 8, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Bow", "Axe"], discCount: 3,
  kit: {
    items: [{ gain: "Sword", type: "weapon" }, { gain: "Map", type: "special" }, { gain: "Shield", type: "special" }, { gain: "Rope", type: "backpack" }, { gain: "Meal", type: "meal", n: 1 }],
    gold: { random: false, add: 10 },
    picks: [],
  },
  items: {
    Sword: { name: "Kiếm", type: "weapon" }, Map: { name: "Bản đồ", type: "special" }, Rope: { name: "Dây", type: "backpack" },
    Shield: { name: "Khiên", type: "special", cs: 2 },
    Ring: { name: "Nhẫn", type: "special", keep: true },
    Liqueur: { name: "Rượu Larnuma", type: "backpack", heal: 3, uses: 2 },
    Potion: { name: "Thuốc", type: "backpack", heal: 4 },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, end: "victory" },
  },
};

const mk = (discs: Disc[] = ["huntmastery", "nexus", "divination"], mastered?: string[]) =>
  newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, mastered, picks: [] });
const fightIn = (s: AdvState, c: Combat) => { book.sections["9"] = { text: ["f"], scene, combat: c }; s.section = "9"; s.fought = false; return startBattle(book, s, book.sections["9"]); };
const foe = { name: "F", cs: 15, ep: 80 };

describe("v14: halved hero losses", () => {
  it("heroLossMul 0.5 halves the CRT loss, rounding down", () => {
    const s = mk();
    const c: Combat = { foes: [foe], heroLossMul: { n: 0.5 } };
    const b = fightIn(s, c);
    expect(heroLossMul(s, c)).toBe(0.5);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(1); // 3 / 2 = 1.5 → 1
  });
});

describe("v14: psychic duel (heroCs + forbid all)", () => {
  it("sets the COMBAT SKILL, ignores weapons, items, mastery and mind attacks", () => {
    const s = mk(["weaponmastery", "psisurge", "nexus"], ["Sword"]);
    s.csNext = 3; s.csBook = -1;
    const c: Combat = { foes: [foe], heroCs: 12, forbid: ["all"], mods: { cs: 1 } };
    const b = fightIn(s, c);
    const cs = heroCs(book, s, c, foe, b.mind, 0);
    expect(cs.total).toBe(13);
    expect(cs.parts.map((p) => p.label)).toEqual(["Đấu tâm lực", "Hoàn cảnh"]);
    const ep = s.ep;
    // no Psi-surge cost either
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(3);
    expect(s.ep).toBe(ep - 3);
  });

  it("forbid all alone: unarmed, no Weaponmastery, no item bonus", () => {
    const s = mk(["weaponmastery", "nexus", "divination"], ["Sword"]);
    const armed = heroCs(book, s, { foes: [foe] }, foe);
    expect(armed.total).toBe(15 + 3 + 2);
    const none = heroCs(book, s, { foes: [foe], forbid: ["all"] }, foe);
    expect(none.total).toBe(15 - 4);
  });
});

describe("v14: first rounds", () => {
  it("noHeroLoss spares the hero in the first rounds only", () => {
    const s = mk();
    const c: Combat = { foes: [foe], firstRound: { noHeroLoss: true, rounds: 2 } };
    const b = fightIn(s, c);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(0);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(0);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(3);
  });

  it("unarmed in the first rounds, armed afterwards", () => {
    const s = mk(["weaponmastery", "nexus", "divination"], ["Sword"]);
    const c: Combat = { foes: [foe], firstRound: { unarmed: true, rounds: 2 } };
    const b = fightIn(s, c);
    expect(heroCs(book, s, c, foe, -1, 0).total).toBe(15 - 4 + 2);
    expect(heroCs(book, s, c, foe, -1, 1).total).toBe(15 - 4 + 2);
    expect(heroCs(book, s, c, foe, -1, 2).total).toBe(15 + 3 + 2);
    const r = playRound(book, s, b, false, fixed(5));
    expect(r.ratio).toBe(15 - 4 + 2 - 15);
  });
});

describe("v14: mind bonus multiplied", () => {
  it("triples the Psi-surge / Mindblast bonus", () => {
    const s = mk(["psisurge", "nexus", "divination"]);
    const c: Combat = { foes: [foe], mindBonusMul: 3 };
    const b = fightIn(s, c);
    expect(heroCs(book, s, c, foe, b.mind).total).toBe(15 + 2 + 12);
    s.ep = 6; // too weak for Psi-surge: Mindblast +2 → +6
    expect(heroCs(book, s, c, foe, b.mind).total).toBe(15 + 2 + 6);
  });
});

describe("v14: items with doses", () => {
  it("heals per dose and is gone after the last; a new one comes full", () => {
    const s = mk();
    apply(book, s, [{ gain: "Liqueur", type: "backpack" }]);
    s.ep -= 10;
    expect(dosesLeft(book, s, "Liqueur")).toBe(2);
    const ep = s.ep;
    useItem(book, s, "Liqueur");
    expect(s.ep).toBe(ep + 3);
    expect(s.backpack).toContain("Liqueur");
    expect(dosesLeft(book, s, "Liqueur")).toBe(1);
    expect(usable(book, s, "Liqueur")).toBe(true);
    useItem(book, s, "Liqueur");
    expect(s.ep).toBe(ep + 6);
    expect(s.backpack).not.toContain("Liqueur");
    expect(s.doses?.Liqueur).toBeUndefined();
    // single-dose items as before
    apply(book, s, [{ gain: "Potion", type: "backpack" }]);
    useItem(book, s, "Potion");
    expect(s.backpack).not.toContain("Potion");
    // a half-used flask dropped, a new one found: full again
    apply(book, s, [{ gain: "Liqueur", type: "backpack" }]);
    useItem(book, s, "Liqueur");
    drop(book, s, "Liqueur");
    apply(book, s, [{ gain: "Liqueur", type: "backpack" }]);
    expect(dosesLeft(book, s, "Liqueur")).toBe(2);
  });
});

describe("v14: giving up a Special Item", () => {
  it("loseChoice special picks from Special Items, never keep items; hasAny guards the choice", () => {
    const s = mk();
    apply(book, s, [{ gain: "Ring", type: "special" }]);
    expect(losePool(book, s, "special")).toEqual(["Map", "Shield"]);
    const sell = { text: "Bán", to: "1", repeat: true, if: { hasAny: "special" as const }, fx: [{ loseChoice: "special" as const }, { gold: 8 }] };
    expect(choiceState(s, sell, book)).toBe("ok");
    apply(book, s, sell.fx);
    expect(s.gold).toBe(18);
    expect(pendingLoss(s)).toBe(true);
    expect(takeOffer(book, s, 0, "Ring")).toEqual([]); // keep: refused
    takeOffer(book, s, 0, "Map");
    expect(pendingLoss(s)).toBe(false);
    apply(book, s, sell.fx);
    takeOffer(book, s, 0, "Shield");
    expect(s.special).toEqual(["Ring"]);
    expect(check(s, { hasAny: "special" }, book)).toBe(false);
    expect(choiceState(s, sell, book)).toBe("hidden");
    expect(check(s, { hasAny: "weapon" }, book)).toBe(true);
    expect(check(s, { hasAny: "backpack" }, book)).toBe(true);
    // the Backpack pool keeps Meals
    expect(losePool(book, s, "backpack")).toEqual(["Rope", "Meal"]);
  });
});
