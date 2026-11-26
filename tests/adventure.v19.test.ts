/** FORMAT v19 rules (nested picks, against COMBAT SKILL, wounds by a number, breath, bleeding, the Backpack, foes met again, bows…) on made-up books: no book text here. */
import { describe, expect, it } from "vitest";
import {
  apply, battleExit, bowShot, canEvade, check, enter, epMax, fightFoes, give, heroCs, insteadChoices, newRun, phase, pickAgain, playRound,
  randomResult, room, sectionRandom, startBattle, tableResult, takeOffer, usable, useItem, validateBook,
} from "../src/adventure/engine";
import type { AdvState, Book, CRT, RandomPick } from "../src/adventure/types";

// every cell: the foe loses 5, the hero loses 3
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [5, 3] as [number, number]));
const scene = { place: "p", bg: "hall" as const, time: "night" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
/** An rng giving these Random Number Table numbers in turn (then 0s). */
const seq = (...ns: number[]) => { let i = 0; return () => ((ns[i++] ?? 0) + 0.5) / 10; };

const items: Book["items"] = {
  Sword: { name: "Kiếm", type: "weapon" }, Bow: { name: "Cung", type: "weapon" },
  "Silver Bow of Duadon": { name: "Cung Bạc", type: "special", as: "Bow", bowRoll: 3 },
  Shield: { name: "Khiên", type: "special", cs: 2, offIf: { flag: "limbdeath" } },
  Helmet: { name: "Mũ", type: "special", epMax: 2, offIf: { flag: "limbdeath" } },
  Rope: { name: "Dây", type: "backpack" }, "Potion of Laumspur": { name: "Thuốc", type: "backpack", heal: 4 }, Laumspur: { name: "Lá", type: "backpack", heal: 3 },
};
const kaiNames = { disc: { camouflage: "C", hunting: "H", sixthsense: "S", tracking: "T", healing: "He", weaponskill: "W", mindshield: "Ms", mindblast: "Mb", animalkinship: "A", mindovermatter: "Mom" } as Book["names"]["disc"] };

const stuck: RandomPick = { out: [
  { min: 0, max: 4, then: { out: [{ min: 0, max: 7, then: { out: [{ min: 0, max: 8, end: "death" }, { min: 9, max: 9, to: "3" }] } }, { min: 8, max: 9, to: "2" }] } },
  { min: 5, max: 9, to: "2" }] };

const book: Book = {
  id: "v19", series: "lw", num: 3, rules: "kai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword"], discCount: 5,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] }, items, names: kaiNames,
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, choices: [{ text: "Đi", to: "1" }] },
    "3": { text: ["c"], scene, end: "victory" },
    // the bog: stuck, pick again; stuck again, a last pick
    "4": { text: ["d"], scene, random: stuck },
    // "pick a number and add 10: equal to or less than your COMBAT SKILL"
    "5": { text: ["e"], scene, random: { mods: [{ add: 10 }], vs: "cs", out: [{ min: -99, max: 0, to: "2" }, { min: 1, max: 99, to: "1", fx: [{ ep: -1 }] }] } },
    // the Javek: a number instead of each wound
    "6": { text: ["f"], scene, combat: { foes: [{ name: "Javek", cs: 10, ep: 30 }], heroLossRoll: { out: [{ min: 0, max: 8 }, { min: 9, max: 9, end: "death" }] }, win: "2" } },
    // under water
    "7": { text: ["g"], scene, combat: { foes: [{ name: "Mực", cs: 10, ep: 60 }], breath: { ep: 2, mods: [{ if: { disc: "mindovermatter" }, add: 2 }] }, win: "2" } },
    // creatures met again, the third only when the first fight had three
    "8": { text: ["h"], scene, fx: [{ flag: "pair" }], combat: { foes: [{ name: "K1", cs: 1, ep: 10, keep: "k1" }, { name: "K2", cs: 1, ep: 12, keep: "k2" }], evade: { after: 0, to: "9" } } },
    "9": { text: ["i"], scene, combat: { foes: [{ name: "K1", cs: 1, ep: 10, keep: "k1" }, { name: "K2", cs: 1, ep: 12, keep: "k2" }, { name: "K3", cs: 1, ep: 9, keep: "k3", if: { notFlag: "pair" } }], win: "2" } },
    // evade once the first guard is dead
    "10": { text: ["j"], scene, combat: { foes: [{ name: "G1", cs: 1, ep: 5 }, { name: "G2", cs: 1, ep: 50 }], evade: { afterFoes: 1, to: "1" }, win: "2" } },
    // surprise first, the Vordak's mind from the second round
    "11": { text: ["k"], scene, combat: { foes: [{ name: "Vordak", cs: 17, ep: 25 }], firstRound: { cs: 2 }, csIf: [{ if: { notDisc: "mindshield" }, add: -2, fromRound: 2 }], win: "2" } },
    // an arm useless: only the climb
    "12": { text: ["l"], scene, combat: { foes: [{ name: "Nhện", cs: 10, ep: 35 }], win: "2",
      instead: [{ text: "Trèo", to: "2", force: true, if: { flag: "limbdeath" } }, { text: "Trèo", to: "2" }] } },
    // a fight lost is not death: half of it back afterwards
    "13": { text: ["m"], scene, combat: { foes: [{ name: "Kẻ địch", cs: 40, ep: 99 }], lose: "14" } },
    "14": { text: ["n"], scene, fx: [{ restoreHalf: "fight" }], choices: [{ text: "Đi", to: "1" }] },
    "15": { text: ["o"], scene, random: { bow: true, out: [{ min: 0, max: 99, to: "2" }] } },
  },
};

const mk = (discs: AdvState["disciplines"] = ["hunting", "tracking", "healing", "camouflage", "sixthsense"]): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, picks: [] });
  s.weapons = ["Sword"];
  return s;
};

describe("v19: picking again (random.out[].then)", () => {
  it("stuck twice, then a 9 at the last pick escapes; anything else there is death", () => {
    const s = mk();
    enter(book, s, "4");
    let r = randomResult(book, book.sections["4"], s, 2);
    expect(r.next).toBe(0);
    pickAgain(s, r.next!);
    expect(phase(book, s)).toBe("random");
    expect(sectionRandom(book.sections["4"], s)).toBe(stuck.out[0].then);
    r = randomResult(book, book.sections["4"], s, 5);
    pickAgain(s, r.next!);
    expect(randomResult(book, book.sections["4"], s, 9).to).toBe("3");
    expect(randomResult(book, book.sections["4"], s, 4).end).toBe("death");
    // a new visit starts with the first pick again
    enter(book, s, "4");
    expect(s.randomAt).toBeUndefined();
    expect(randomResult(book, book.sections["4"], s, 6).to).toBe("2");
  });

  it("validateBook follows the nested picks", () => {
    expect(validateBook(book)).toEqual([]);
    const bad = { ...book, sections: { ...book.sections, "4": { ...book.sections["4"], random: { out: [{ min: 0, max: 9, then: { out: [{ min: 0, max: 9, to: "404" }] } }] } } } };
    expect(validateBook(bad).some((e) => e.includes("404"))).toBe(true);
  });
});

describe("v19: a number against COMBAT SKILL (random.vs)", () => {
  it("number + 10 − COMBAT SKILL: the whole-book changes count, weapons do not", () => {
    const s = mk();
    s.cs = 15;
    expect(randomResult(book, book.sections["5"], s, 5).to).toBe("2");
    expect(randomResult(book, book.sections["5"], s, 6).to).toBe("1");
    s.csBook = -3; // the arm made useless
    expect(randomResult(book, book.sections["5"], s, 3).to).toBe("1");
    expect(randomResult(book, book.sections["5"], s, 2)).toMatchObject({ to: "2", vs: 12, value: 0 });
  });
});

describe("v19: a number picked instead of a wound (combat.heroLossRoll)", () => {
  it("0-8: no ENDURANCE lost; 9: death", () => {
    const s = mk();
    enter(book, s, "6");
    const ep = s.ep;
    const b = startBattle(book, s, book.sections["6"]);
    const r = playRound(book, s, b, false, seq(4, 8));
    expect([r.lossRoll, r.heroLoss, s.ep]).toEqual([8, 0, ep]);
    const r2 = playRound(book, s, b, false, seq(4, 9));
    expect([r2.lossRoll, r2.heroKilled, s.ep, b.over]).toEqual([9, true, 0, "lose"]);
    expect(battleExit(book, s, b)).toBeNull();
  });
});

describe("v19: under water (combat.breath)", () => {
  it("a 0 is 10 rounds; Mind Over Matter adds 2; every round after those costs 2 more", () => {
    const s = mk();
    enter(book, s, "7");
    const b = startBattle(book, s, book.sections["7"], seq(0));
    expect([b.breathN, b.breath]).toEqual([0, 10]);
    const t = mk(["mindovermatter", "hunting", "tracking", "healing", "camouflage"]);
    enter(book, t, "7");
    const bt = startBattle(book, t, book.sections["7"], seq(1));
    expect(bt.breath).toBe(3);
    const losses = [1, 2, 3, 4].map(() => playRound(book, t, bt, false, seq(5)));
    expect(losses.map((r) => r.heroLoss)).toEqual([3, 3, 3, 5]);
    expect(losses[3].air).toBe(2);
  });
});

describe("v19: an open wound (bleed)", () => {
  it("bleeds from the next section on until a Potion of Laumspur is drunk (not another healing item)", () => {
    const s = mk(["hunting", "tracking", "camouflage", "sixthsense", "mindblast"]);
    s.backpack = ["Laumspur", "Potion of Laumspur"];
    enter(book, s, "1");
    const ep = s.ep;
    apply(book, s, [{ bleed: 2 }]);
    expect(s.ep).toBe(ep);
    enter(book, s, "2");
    expect(s.ep).toBe(ep - 2);
    useItem(book, s, "Laumspur");
    expect(s.bleed).toBeDefined();
    useItem(book, s, "Potion of Laumspur");
    expect(s.bleed).toBeUndefined();
    const after = s.ep;
    enter(book, s, "1");
    expect(s.ep).toBe(after);
  });

  it("the cure may be drunk at full ENDURANCE; a save from before v19 (flag) keeps bleeding", () => {
    const s = mk(["hunting", "tracking", "camouflage", "sixthsense", "mindblast"]);
    s.backpack = ["Potion of Laumspur"];
    apply(book, s, [{ bleed: 2 }]);
    expect(usable(book, s, "Potion of Laumspur")).toBe(true);
    const old = mk(["hunting", "tracking", "camouflage", "sixthsense", "mindblast"]);
    old.flags.bleeding = true;
    const ep = old.ep;
    enter(book, old, "2");
    expect([old.ep, old.bleed, old.flags.bleeding]).toEqual([ep - 2, { ep: 2, cure: ["Potion of Laumspur"] }, undefined]);
  });

  it("noPotions: no healing item until the fight is over", () => {
    const s = mk();
    s.backpack = ["Potion of Laumspur"];
    s.ep -= 5;
    apply(book, s, [{ noPotions: true }]);
    expect(usable(book, s, "Potion of Laumspur")).toBe(false);
    expect(useItem(book, s, "Potion of Laumspur")).toEqual([]);
    enter(book, s, "6");
    const b = startBattle(book, s, book.sections["6"]);
    while (!b.over) playRound(book, s, b, false, seq(0, 0));
    expect(usable(book, s, "Potion of Laumspur")).toBe(true);
  });
});

describe("v19: the Backpack itself (loseAll pack)", () => {
  it("no Backpack: nothing goes in it until one is found; the conditions follow", () => {
    const s = mk();
    s.backpack = ["Rope"];
    s.meals = 2;
    apply(book, s, [{ loseAll: "pack" }]);
    expect([s.backpack, s.meals, s.noPack, room(s, "backpack"), room(s, "meal")]).toEqual([[], 0, true, 0, 0]);
    expect([check(s, { noPack: true }), check(s, { pack: true })]).toEqual([true, false]);
    apply(book, s, [{ gain: "Rope", type: "backpack" }]);
    expect(s.backpack).toEqual([]);
    expect(s.offers.length).toBe(1);
    // the Backpack is found: it is no item on a list, and the Rope now fits
    apply(book, s, [{ gain: "Backpack", type: "special", optional: true }]);
    takeOffer(book, s, 1);
    expect([s.noPack, s.special.includes("Backpack")]).toEqual([undefined, false]);
    takeOffer(book, s, 0);
    expect(s.backpack).toEqual(["Rope"]);
  });

  it("loseAll backpack still empties it but keeps the Backpack; an effect may depend on it", () => {
    const s = mk();
    s.backpack = ["Rope"];
    apply(book, s, [{ loseAll: "backpack" }]);
    expect([s.backpack, s.noPack]).toEqual([[], undefined]);
    const t = mk();
    t.noPack = true;
    const ep = t.ep - 4;
    t.ep = ep;
    apply(book, t, [{ gain: "Laumspur", type: "backpack", if: { pack: true } }, { ep: 3, if: { noPack: true } }]);
    expect([t.backpack, t.ep]).toEqual([[], ep + 3]);
    expect(give(book, t, "Backpack", "special")).toBe(0);
    expect(t.noPack).toBeUndefined();
  });
});

describe("v19: foes met again (keep, if)", () => {
  it("the damage done carries over; the third foe only when the first fight had three", () => {
    const s = mk();
    enter(book, s, "8");
    const b = startBattle(book, s, book.sections["8"]);
    playRound(book, s, b, false, seq(5)); // K1 10 → 5
    playRound(book, s, b, false, seq(5)); // K1 dead, on to K2
    playRound(book, s, b, false, seq(5)); // K2 12 → 7
    playRound(book, s, b, true, seq(5)); // evade
    expect(s.foesLeft).toEqual({ k1: 0, k2: 7 });
    enter(book, s, battleExit(book, s, b)!);
    expect(fightFoes(s, book.sections["9"].combat!, book).map((f) => [f.def.name, f.ep])).toEqual([["K2", 7]]);
    s.flags.pair = false;
    expect(fightFoes(s, book.sections["9"].combat!, book).map((f) => [f.def.name, f.ep])).toEqual([["K2", 7], ["K3", 9]]);
  });
});

describe("v19: evade after the first foe; COMBAT SKILL from a round on", () => {
  it("evade.afterFoes", () => {
    const s = mk();
    enter(book, s, "10");
    const b = startBattle(book, s, book.sections["10"]);
    expect(canEvade(book, s, b)).toBe(false);
    playRound(book, s, b, false, seq(5));
    expect([b.idx, canEvade(book, s, b)]).toEqual([1, true]);
  });

  it("csIf.fromRound: +2 in the first round, −2 from the second without Mindshield", () => {
    const s = mk();
    const c = book.sections["11"].combat!;
    const base = heroCs(book, s, { foes: c.foes }, c.foes[0]).total;
    expect(heroCs(book, s, c, c.foes[0], -1, 0).total).toBe(base + 2);
    expect(heroCs(book, s, c, c.foes[0], -1, 1).total).toBe(base - 2);
    const t = mk(["mindshield", "hunting", "tracking", "healing", "camouflage"]);
    expect(heroCs(book, t, c, c.foes[0], -1, 1).total).toBe(heroCs(book, t, { foes: c.foes }, c.foes[0]).total);
  });
});

describe("v19: a forced way instead of the fight (instead[].force)", () => {
  it("with the flag only the forced way, and no fight; else the fight and the other way", () => {
    const s = mk();
    const sec = book.sections["12"];
    expect(insteadChoices(sec, s, book)).toEqual({ list: [sec.combat!.instead![1]], barred: false });
    s.flags.limbdeath = true;
    expect(insteadChoices(sec, s, book)).toEqual({ list: [sec.combat!.instead![0]], barred: true });
  });
});

describe("v19: half of what the last fight took (restoreHalf fight)", () => {
  it("a lost fight counts down to 0, not to the 1 point it leaves", () => {
    const s = mk(["hunting", "tracking", "camouflage", "sixthsense", "mindblast"]);
    s.ep = 21;
    enter(book, s, "13");
    s.ep = 21;
    const b = startBattle(book, s, book.sections["13"]);
    while (!b.over) playRound(book, s, b, false, seq(0));
    expect([b.over, s.ep, s.lastFight]).toEqual(["beaten", 1, { lost: 21, beaten: true }]);
    enter(book, s, battleExit(book, s, b)!);
    expect(s.ep).toBe(10);
  });
});

describe("v19: items off while a condition holds (offIf)", () => {
  it("no Shield or Helmet bonus while the arm is useless", () => {
    const s = mk();
    s.special = ["Shield", "Helmet"];
    const c = book.sections["6"].combat!;
    const cs = heroCs(book, s, c, c.foes[0]).total;
    const max = epMax(book, s);
    s.flags.limbdeath = true;
    expect([heroCs(book, s, c, c.foes[0]).total, epMax(book, s)]).toEqual([cs - 2, max - 2]);
  });
});

describe("v19: bows (random.bow)", () => {
  const mag: Book = { ...book, rules: "magnakai", num: 7, names: { disc: { ...kaiNames.disc } as Book["names"]["disc"] }, weaponskill: ["Bow", "Sword", "Spear"] };
  const archer = () => { const s = newRun(mag, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["weaponmastery", "huntmastery", "curing"], mastered: ["Bow", "Sword", "Spear"], picks: [] }); return s; };

  it("the Silver Bow of Duadon adds 3 on top of Weaponmastery, a plain Bow does not", () => {
    const s = archer();
    s.weapons = ["Bow"];
    expect(bowShot(mag, s)).toEqual({ bow: "Bow", own: true, add: 3 });
    s.special = ["Silver Bow of Duadon"];
    expect(bowShot(mag, s)).toEqual({ bow: "Silver Bow of Duadon", own: true, add: 6 });
    expect(tableResult(mag, book.sections["15"].random!, s, 2).value).toBe(8);
  });

  it("no bow of one's own: a borrowed one, Weaponmastery with Bow still counts", () => {
    const s = archer();
    s.weapons = [];
    expect(bowShot(mag, s)).toEqual({ bow: "Bow", own: false, add: 3 });
    const t = newRun(mag, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["huntmastery", "curing", "nexus"], picks: [] });
    t.special = ["Silver Bow of Duadon"];
    expect(bowShot(mag, t).add).toBe(3);
  });
});
