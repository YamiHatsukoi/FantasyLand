import { describe, expect, it } from "vitest";
import { apply, battleExit, canEvade, check, choiceState, crtColumnOf, enter, epMax, heroCs, newRun, playChoice, playRound, randomResult, retry, startBattle, takeOffer, useItem, validateBook } from "../src/adventure/engine";
import type { Book, Choice, CRT } from "../src/adventure/types";

// A made-up table (no book data in this repo): hero loses 2, enemy loses 3 + column; column 12 kills.
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 2] as [number, number]));
const fixed = (n: number) => () => n / 10 + 0.01;

const book: Book = {
  id: "test", series: "lw", num: 1, rules: "kai", title: "Thử", intro: [], start: "1", crt,
  weaponskill: ["Dagger", "Spear", "Mace", "Short Sword", "Warhammer", "Sword", "Axe", "Sword", "Quarterstaff", "Broadsword"],
  discCount: 5,
  kit: { items: [{ gain: "Axe", type: "weapon" }, { gain: "Meal", type: "meal" }], gold: { random: true, add: 0 }, picks: [{ mode: "random", count: 1, options: [{ gain: "Helmet", type: "special" }, { gold: 12 }] }] },
  items: { Axe: { name: "Rìu", type: "weapon" }, Helmet: { name: "Mũ Sắt", type: "special", epMax: 2 }, Potion: { name: "Thuốc", type: "backpack", heal: 4 }, Sword: { name: "Kiếm", type: "weapon" } },
  names: { disc: { camouflage: "Ẩn Thân", hunting: "Săn Bắn", sixthsense: "Giác Quan Thứ Sáu", tracking: "Truy Dấu", healing: "Chữa Lành", weaponskill: "Tinh Thông Vũ Khí", mindshield: "Khiên Tâm Trí", mindblast: "Tâm Lực Kích", animalkinship: "Giao Cảm Muông Thú", mindovermatter: "Ý Lực Điều Vật" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene: { place: "p", bg: "forest", time: "day", weather: "clear", actors: [], mood: "calm" }, choices: [{ text: "x", to: "2", if: { disc: "sixthsense" } }, { text: "y", to: "3", if: { notDisc: "sixthsense" } }, { text: "z", to: "4" }] },
    "2": { text: ["b"], scene: { place: "p", bg: "forest", time: "day", weather: "clear", actors: [], mood: "calm" }, fx: [{ gain: "Sword", type: "weapon", optional: true }, { gold: 5, optional: true }], choices: [{ text: "go", to: "4" }] },
    "3": { text: ["c"], scene: { place: "p", bg: "forest", time: "day", weather: "clear", actors: [], mood: "calm" }, random: { mods: [{ if: { disc: "tracking" }, add: 3 }], out: [{ min: 0, max: 4, to: "4" }, { min: 5, max: 99, to: "5" }] } },
    "4": { text: ["d"], scene: { place: "p", bg: "forest", time: "day", weather: "clear", actors: [], mood: "combat" }, combat: { foes: [{ name: "Giak", cs: 10, ep: 6 }, { name: "Giak 2", cs: 10, ep: 6 }], evade: { after: 1, to: "5" }, win: "5", csIf: [{ if: { notDisc: "mindshield" }, add: -2 }] } },
    "5": { text: ["e"], scene: { place: "p", bg: "forest", time: "day", weather: "clear", actors: [], mood: "calm" }, end: "victory" },
  },
};

const hero = (discs: Book["names"]["disc"] extends Record<infer K, string> ? K[] : never, pick = 0) =>
  newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, weaponskillRoll: 6, goldRoll: 3, picks: [[pick]] });

describe("adventure engine (Lone Wolf rules)", () => {
  it("creates a hero with kit, random pick and stats", () => {
    const s = hero(["healing", "weaponskill"], 0);
    expect(s.cs).toBe(15);
    expect(s.epBase).toBe(25);
    expect(epMax(book, s)).toBe(27); // Helmet +2
    expect(s.ep).toBe(27);
    expect(s.weapons).toEqual(["Axe"]);
    expect(s.meals).toBe(1);
    expect(s.gold).toBe(3);
    expect(s.weaponskill).toBe("Axe");
    const g = hero([], 1);
    expect(g.gold).toBe(15);
  });

  it("plays a game of chance in a choice: stays for another round, or leaves by the outcome", () => {
    const s = hero([]);
    s.gold = 10;
    const cartwheel: Choice = { text: "cược 1", to: "", repeat: true, if: { gold: 1 }, roll: { out: [{ min: 0, max: 0, fx: [{ gold: 8 }] }, { min: 1, max: 8, fx: [{ gold: -1 }] }, { min: 9, max: 9, to: "5" }] } };
    expect(playChoice(book, s, cartwheel, 0)).toMatchObject({ to: "", value: 0 });
    expect(s.gold).toBe(18);
    expect(playChoice(book, s, cartwheel, [4]).to).toBe("");
    expect(s.gold).toBe(17);
    expect(playChoice(book, s, { ...cartwheel, fx: [{ gold: -2 }] }, 9).to).toBe("5");
    expect(s.gold).toBe(15);
  });

  it("restores half of the ENDURANCE lost", () => {
    const s = hero([]);
    s.ep = 10;
    apply(book, s, [{ restoreHalf: true }]);
    expect(s.ep).toBe(10 + Math.floor((epMax(book, s) - 10) / 2));
  });

  it("shows positive branches locked and hides the negative ones that do not apply", () => {
    const s = hero(["sixthsense"]);
    const ch = book.sections["1"].choices!;
    expect(choiceState(s, ch[0])).toBe("ok");
    expect(choiceState(s, ch[1])).toBe("hidden");
    const t = hero([]);
    expect(choiceState(t, ch[0])).toBe("locked");
    expect(choiceState(t, ch[1])).toBe("ok");
  });

  it("offers optional items and gold, heals on the road with Healing", () => {
    const s = hero(["healing"]);
    s.ep = 10;
    enter(book, s, "2");
    expect(s.ep).toBe(11);
    expect(s.offers.length).toBe(2);
    takeOffer(book, s, 0);
    expect(s.weapons).toContain("Sword");
    takeOffer(book, s, 0);
    expect(s.gold).toBe(8);
  });

  it("applies random-number modifiers", () => {
    const s = hero(["tracking"]);
    enter(book, s, "3");
    expect(randomResult(book, book.sections["3"], s, 2).to).toBe("5");
    const t = hero([]);
    expect(randomResult(book, book.sections["3"], t, 2).to).toBe("4");
  });

  it("maps combat ratios to the table's columns", () => {
    expect([-12, -11, -10, -9, -2, -1, 0, 1, 2, 9, 10, 11, 30].map(crtColumnOf)).toEqual([0, 0, 1, 1, 5, 5, 6, 7, 7, 11, 11, 12, 12]);
  });

  it("fights foes one after the other, with conditional modifiers and mind attack", () => {
    const s = hero(["mindblast", "weaponskill"]);
    enter(book, s, "4");
    const b = startBattle(book, s, book.sections["4"]);
    const cs = heroCs(book, s, book.sections["4"].combat!, b.foes[0].def, b.mind);
    // 15 + 2 weaponskill (Axe) + 2 mindblast - 2 (no Mindshield)
    expect(cs.total).toBe(17);
    expect(canEvade(book, s, b)).toBe(false);
    const ep = s.ep;
    playRound(book, s, b, false, fixed(4));
    expect(s.ep).toBe(ep - 2);
    expect(canEvade(book, s, b)).toBe(true);
    while (!b.over) playRound(book, s, b, false, fixed(4));
    expect(b.over).toBe("win");
    expect(battleExit(book, s, b)).toBe("5");
    expect(s.fought).toBe(true);
  });

  it("dies at 0 ENDURANCE and can retry the section", () => {
    const s = hero([]);
    enter(book, s, "4");
    s.ep = 1;
    const b = startBattle(book, s, book.sections["4"]);
    playRound(book, s, b, false, fixed(1));
    expect(b.over).toBe("lose");
    expect(battleExit(book, s, b)).toBeNull();
    const r = retry(s)!;
    expect(r.section).toBe("1");
  });

  it("uses healing items outside combat", () => {
    const s = hero([]);
    s.backpack.push("Potion");
    s.ep = 5;
    useItem(book, s, "Potion");
    expect(s.ep).toBe(9);
    expect(s.backpack).not.toContain("Potion");
  });

  it("validates books", () => {
    expect(validateBook(book)).toEqual([]);
    expect(check(hero([]), { epBelow: 99 })).toBe(true);
    const broken = { ...book, sections: { ...book.sections, "1": { ...book.sections["1"], choices: [{ text: "x", to: "9" }] } } };
    expect(validateBook(broken).some((e) => e.includes("§9"))).toBe(true);
  });
});
