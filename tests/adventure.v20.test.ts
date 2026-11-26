/** FORMAT v20 rules (Meals counted and halved, one dose used, poison on every wound, mind combat on one's own scores) on made-up books: no book text here. */
import { describe, expect, it } from "vitest";
import { KILL, apply, check, enter, epMax, give, heroCs, heroPoints, newRun, playRound, startBattle, battleExit, dosesLeft } from "../src/adventure/engine";
import type { AdvState, Book, CRT } from "../src/adventure/types";

// every cell: the foe loses 5, the hero loses 3
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [5, 3] as [number, number]));
const scene = { place: "p", bg: "hall" as const, time: "night" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
const seq = (...ns: number[]) => { let i = 0; return () => ((ns[i++] ?? 0) + 0.5) / 10; };

const items: Book["items"] = {
  Sword: { name: "Kiếm", type: "weapon" },
  Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true },
  Shield: { name: "Khiên", type: "special", cs: 2 },
  "Silver Helm": { name: "Mũ Bạc", type: "special", cs: 2 },
  "Chainmail Waistcoat": { name: "Áo Giáp", type: "special", epMax: 4 },
  Laumwort: { name: "Laumwort", type: "backpack", heal: 2, uses: 3 },
};
const kaiNames = { disc: { camouflage: "C", hunting: "H", sixthsense: "S", tracking: "T", healing: "He", weaponskill: "W", mindshield: "Ms", mindblast: "Mb", animalkinship: "A", mindovermatter: "Mom" } as Book["names"]["disc"] };

const book: Book = {
  id: "v20", series: "lw", num: 3, rules: "kai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword"], discCount: 5,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] }, items, names: kaiNames,
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, choices: [{ text: "Đi", to: "1" }] },
    "3": { text: ["c"], scene, combat: { foes: [{ name: "Octagtah", cs: 10, ep: 40 }], heroExtraLoss: { ep: 2, if: { notDisc: "healing" } }, win: "2" } },
    "5": { text: ["e"], scene, combat: { foes: [{ name: "Chiến binh", cs: 10, ep: 38 }], stopAt: { foeEp: 20, to: "1" }, win: "2" } },
    "4": { text: ["d"], scene, combat: { foes: [{ name: "Bóng", cs: 10, ep: 40 }], psychic: { keep: ["Silver Helm"] }, csIf: [{ if: { rank: 5 }, add: 1 }], win: "2" } },
  },
};

const mk = (discs: AdvState["disciplines"] = ["hunting", "tracking", "healing", "camouflage", "sixthsense"]): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, picks: [] });
  s.weapons = ["Sword"];
  return s;
};

describe("v20: Meals counted and halved", () => {
  it("{meals: n} holds with n Meals or more; loseHalf meals rounds the loss down", () => {
    const s = mk();
    s.meals = 5;
    expect(check(s, { meals: 4 })).toBe(true);
    apply(book, s, [{ loseHalf: "meals" }]);
    expect(s.meals).toBe(3);
    expect(check(s, { meals: 4 })).toBe(false);
    s.meals = 1;
    apply(book, s, [{ loseHalf: "meals" }]);
    expect(s.meals).toBe(1);
  });
});

describe("v20: one dose used (dose)", () => {
  it("takes one of the Laumwort's three doses, the item goes with the last", () => {
    const s = mk();
    give(book, s, "Laumwort", "backpack", 1);
    apply(book, s, [{ dose: "Laumwort" }]);
    expect(dosesLeft(book, s, "Laumwort")).toBe(2);
    apply(book, s, [{ dose: "Laumwort" }, { dose: "Laumwort" }]);
    expect(s.backpack).not.toContain("Laumwort");
  });
});

describe("v20: poison on every wound (combat.heroExtraLoss)", () => {
  it("adds 2 to each loss unless the condition fails", () => {
    const s = mk(["hunting", "tracking", "camouflage", "sixthsense", "mindshield"]);
    enter(book, s, "3");
    const b = startBattle(book, s, book.sections["3"]);
    expect(playRound(book, s, b, false, seq(5)).heroLoss).toBe(5);
    const t = mk();
    enter(book, t, "3");
    const bt = startBattle(book, t, book.sections["3"]);
    expect(playRound(book, t, bt, false, seq(5)).heroLoss).toBe(3);
  });
});

describe("v20: mind combat (combat.psychic)", () => {
  it("no weapon, Shield or Sommerswerd, only the Silver Helm; armour ENDURANCE set aside and given back", () => {
    const s = mk(["hunting", "tracking", "camouflage", "sixthsense", "weaponskill"]);
    s.weaponskill = "Sword";
    s.special = ["Sommerswerd", "Shield", "Silver Helm", "Chainmail Waistcoat"];
    s.ep = epMax(book, s);
    enter(book, s, "4");
    const full = s.ep;
    const b = startBattle(book, s, book.sections["4"]);
    expect(s.ep).toBe(full - 4);
    expect(heroPoints(book, s, b).max).toBe(epMax(book, s) - 4);
    const cs = heroCs(book, s, book.sections["4"].combat!, book.sections["4"].combat!.foes[0], -1, 0);
    expect(cs.total).toBe(s.cs + 2 + 1);
    expect(cs.parts.some((p) => p.label.includes("Sommerswerd") || p.label.includes("Khiên"))).toBe(false);
    for (let i = 0; i < 8 && !b.over; i++) playRound(book, s, b, false, seq(5));
    expect(b.over).toBe("win");
    expect(s.ep).toBe(full - 3 * 8);
    expect(battleExit(book, s, b)).toBe("2");
  });
});

describe("v20: stopAt and an automatic kill", () => {
  it("an automatic kill above the threshold wins; reaching it otherwise stops the fight", () => {
    const killCrt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [KILL, 0] as [number, number]));
    const kb: Book = { ...book, crt: killCrt };
    const s = mk();
    enter(kb, s, "5");
    const b = startBattle(kb, s, kb.sections["5"]);
    playRound(kb, s, b, false, seq(5));
    expect(battleExit(kb, s, b)).toBe("2");
    const t = mk();
    enter(book, t, "5");
    const bt = startBattle(book, t, book.sections["5"]);
    for (let i = 0; i < 4 && !bt.over; i++) playRound(book, t, bt, false, seq(5));
    expect(battleExit(book, t, bt)).toBe("1");
  });
});
