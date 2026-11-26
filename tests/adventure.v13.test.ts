/** FORMAT v13 rules on a made-up book: no book text in this repository. */
import { describe, expect, it } from "vitest";
import {
  answerRiddle, apply, canEvade, choiceState, crtColumnOf, epMax, heroCs, heroLossMul, mindBlocked, mindOpts, newRun, phase, playRound,
  skipChoice, startBattle, usable, useItem, validateBook, visibleChoices, addictFlag,
} from "../src/adventure/engine";
import type { AdvState, Book, Combat, CRT, Disc } from "../src/adventure/types";

// hero loses 2, enemy loses 3 + column; column 12 kills
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 2] as [number, number]));
const fixed = (n: number) => () => n / 10 + 0.01;
const scene = { place: "p", bg: "forest" as const, time: "day" as const, weather: "clear" as const, actors: [], mood: "calm" as const };

const book: Book = {
  id: "v13", series: "lw", num: 7, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Bow", "Axe"], discCount: 3,
  kit: {
    items: [{ gain: "Sword", type: "weapon" }, { gain: "Map", type: "special" }, { gain: "Rope", type: "backpack" }, { gain: "Meal", type: "meal", n: 3 }],
    gold: { random: false, add: 12 },
    picks: [],
  },
  items: {
    Sword: { name: "Kiếm", type: "weapon" }, Axe: { name: "Rìu", type: "weapon" }, Map: { name: "Bản đồ", type: "special" }, Rope: { name: "Dây", type: "backpack" },
    Sommerswerd: { name: "Sommerswerd", type: "special", weapon: true, as: "Sword" },
    Dagger2: { name: "Dao găm bạc", type: "special", as: "Dagger" },
    Helmet: { name: "Mũ", type: "special", epMax: 2 },
    Quiver: { name: "Ống tên", type: "special" },
    Adgana: { name: "Adgana", type: "backpack", use: { cs: 6, addict: { roll: [0, 1], epBase: -4, cs: 3 } } },
    Potion: { name: "Thuốc", type: "backpack", heal: 4 },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Trả lời câu đố", to: "120", riddle: true, hint: "Một con số" }, { text: "Bỏ cuộc", to: "2" }] },
    "2": { text: ["b"], scene, choices: [{ text: "Đoán", to: "120", riddle: true, fail: "3" }] },
    "3": { text: ["c"], scene, end: "death" },
    "120": { text: ["d"], scene, end: "victory" },
  },
};

const mk = (discs: Disc[] = ["huntmastery", "nexus", "divination"]) => newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, picks: [] });
const fightIn = (s: AdvState, c: Combat) => { book.sections["9"] = { text: ["f"], scene, combat: c }; s.section = "9"; s.fought = false; return startBattle(book, s, book.sections["9"]); };

describe("v13: hero ENDURANCE loss multiplied", () => {
  it("doubles while the condition holds, triples always, shows it on the HUD helper", () => {
    const s = mk();
    const c: Combat = { foes: [{ name: "F", cs: 15, ep: 50 }], heroLossMul: { n: 2, if: { notDisc: "curing" } } };
    let b = fightIn(s, c);
    expect(heroLossMul(s, c)).toBe(2);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(4);
    const cured = mk(["curing", "nexus", "divination"]);
    b = fightIn(cured, c);
    expect(heroLossMul(cured, c)).toBe(1);
    expect(playRound(book, cured, b, false, fixed(5)).heroLoss).toBe(2);
    const c3: Combat = { foes: [{ name: "F", cs: 15, ep: 50 }], heroLossMul: { n: 3 } };
    b = fightIn(s, c3);
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(6);
  });

  it("does not multiply Mindforce or the cost of Psi-surge", () => {
    const s = mk(["psisurge", "nexus", "divination"]);
    const c: Combat = { foes: [{ name: "F", cs: 15, ep: 50 }], heroLossMul: { n: 2 }, mindforce: 1 };
    const b = fightIn(s, c);
    // CRT 2 × 2 + Psi-surge 2 + Mindforce 1 (Psi-screen not known)
    expect(playRound(book, s, b, false, fixed(5)).heroLoss).toBe(7);
  });
});

describe("v13: partial confiscation", () => {
  it("takes only the parts listed and gives back exactly them", () => {
    const s = mk();
    s.special.push("Sommerswerd", "Dagger2", "Helmet");
    s.ep = epMax(book, s);
    apply(book, s, [{ stash: "jail", only: ["weapons"], weaponLike: true }]);
    expect(s.weapons).toEqual([]);
    expect(s.special).toEqual(["Map", "Helmet"]);
    expect(s.backpack).toEqual(["Rope"]);
    expect(s.meals).toBe(3);
    expect(s.gold).toBe(12);
    expect(s.stashes!.jail).toEqual({ weapons: ["Sword"], backpack: [], special: ["Sommerswerd", "Dagger2"], meals: 0, gold: 0, arrows: 0, pos: { weapons: [0], backpack: [], special: [1, 2] } });
    // the hero picks up an axe meanwhile; it stays when the stash comes back (v18: the gear goes back where it was on the lists)
    apply(book, s, [{ gain: "Axe", type: "weapon" }, { unstash: "jail" }]);
    expect(s.weapons).toEqual(["Sword", "Axe"]);
    expect(s.special).toEqual(["Map", "Sommerswerd", "Dagger2", "Helmet"]);
    expect(s.stashes!.jail).toBeUndefined();
  });

  it("gold and meals alone; the Quiver takes its arrows; without weaponLike the specials stay", () => {
    const s = mk();
    apply(book, s, [{ stash: "inn", only: ["gold", "meals"] }]);
    expect([s.gold, s.meals, s.backpack.length, s.weapons.length]).toEqual([0, 0, 1, 1]);
    apply(book, s, [{ unstash: "inn" }]);
    expect([s.gold, s.meals]).toEqual([12, 3]);
    s.special.push("Sommerswerd", "Quiver");
    s.arrows = 4;
    apply(book, s, [{ stash: "guard", only: ["weapons"] }]);
    expect(s.special).toContain("Sommerswerd");
    apply(book, s, [{ stash: "guard2", only: ["special"] }]);
    expect([s.special, s.arrows]).toEqual([[], 0]);
    expect(s.stashes!.guard2.arrows).toBe(4);
    apply(book, s, [{ unstash: "guard2" }]);
    expect(s.arrows).toBe(4);
    // the whole gear as before (v8)
    apply(book, s, [{ stash: "all" }]);
    expect([s.weapons, s.backpack, s.special, s.meals, s.gold, s.arrows]).toEqual([[], [], [], 0, 0, 0]);
  });
});

describe("v13: losing Meals", () => {
  it("lose Meal n drops n Meals; loseAll meals drops them all", () => {
    const s = mk();
    expect(apply(book, s, [{ lose: "Meal", n: 2 }])[0].label).toBe("Mất Phần Ăn ×2");
    expect(s.meals).toBe(1);
    apply(book, s, [{ lose: "Meal", n: 5 }]);
    expect(s.meals).toBe(0);
    s.meals = 3;
    apply(book, s, [{ loseAll: "meals" }]);
    expect(s.meals).toBe(0);
    expect(s.backpack).toEqual(["Rope"]);
  });
});

describe("v13: riddles", () => {
  it("the right number goes to the choice's section; a wrong one stays or goes to fail", () => {
    const [c1] = book.sections["1"].choices!;
    const [c2] = book.sections["2"].choices!;
    expect(answerRiddle(c1, "120")).toBe("120");
    expect(answerRiddle(c1, "0120")).toBe("120");
    expect(answerRiddle(c1, 120)).toBe("120");
    expect(answerRiddle(c1, "121")).toBeNull();
    expect(answerRiddle(c1, "")).toBeNull();
    expect(answerRiddle(c2, "7")).toBe("3");
    expect(answerRiddle(c2, "120")).toBe("120");
    delete book.sections["9"]; // left by the fights above
    expect(validateBook(book)).toEqual([]);
    expect(validateBook({ ...book, sections: { ...book.sections, "2": { text: ["b"], scene, choices: [{ text: "x", to: "120", riddle: true, fail: "404" }] } } })).toContain("§2 → §404: không có đoạn này");
  });
});

describe("v13: mind attack immunity", () => {
  it("'mindblast' blocks Mindblast only, 'psisurge' Psi-surge only, 'mind' all", () => {
    const s = mk(["psisurge", "nexus", "divination"]);
    const [strong, weak] = mindOpts(book, s);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["mindblast"] }, strong)).toBe(false);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["mindblast"] }, weak)).toBe(true);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["psisurge"] }, strong)).toBe(true);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["psisurge"] }, weak)).toBe(false);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["mind"] }, weak)).toBe(true);
    expect(mindBlocked({ name: "F", cs: 1, ep: 1, immune: ["mind"] }, strong)).toBe(true);
    const c: Combat = { foes: [{ name: "F", cs: 15, ep: 50, immune: ["mindblast"] }] };
    const b = fightIn(s, c);
    const base = heroCs(book, s, c, c.foes[0], -1).total;
    expect(heroCs(book, s, c, c.foes[0], b.mind).total).toBe(base + 4);
    s.ep = 5; // too weak for Psi-surge: its Mindblast form, which this foe ignores
    expect(heroCs(book, s, c, c.foes[0], b.mind).total).toBe(base);
    expect(playRound(book, s, b, false, fixed(5)).mindCost).toBe(0);
  });

  it("multiplies the foe's loss in rounds a mind attack is used (mindMul)", () => {
    const s = mk(["psisurge", "nexus", "divination"]);
    const c: Combat = { foes: [{ name: "F", cs: 30, ep: 80 }], mindMul: 2 };
    let b = fightIn(s, c);
    const withMind = playRound(book, s, b, false, fixed(5));
    s.ep = epMax(book, s);
    b = fightIn(s, c);
    b.mind = -1;
    const without = playRound(book, s, b, false, fixed(5));
    expect(withMind.ratio).toBe(without.ratio + 4);
    expect(without.foeLoss).toBe(3 + crtColumnOf(without.ratio));
    expect(withMind.foeLoss).toBe((3 + crtColumnOf(withMind.ratio)) * 2);
  });
});

describe("v13: fight drugs (Adgana)", () => {
  it("+6 for the next fight; on 0-1 the hero is addicted: -4 basic ENDURANCE, later doses +3", () => {
    const s = mk();
    s.backpack.push("Adgana", "Adgana", "Adgana");
    expect(usable(book, s, "Adgana")).toBe(true);
    useItem(book, s, "Adgana", fixed(5));
    expect(s.csNext).toBe(6);
    expect(s.flags[addictFlag("Adgana")]).toBeUndefined();
    s.csNext = 0;
    const base = s.epBase;
    useItem(book, s, "Adgana", fixed(1));
    expect(s.csNext).toBe(6);
    expect(s.flags[addictFlag("Adgana")]).toBe(true);
    expect(s.epBase).toBe(base - 4);
    expect(s.ep).toBeLessThanOrEqual(epMax(book, s));
    s.csNext = 0;
    useItem(book, s, "Adgana", fixed(0));
    expect(s.csNext).toBe(3);
    expect(s.epBase).toBe(base - 4);
    expect(s.backpack.includes("Adgana")).toBe(false);
    expect(usable(book, s, "Adgana")).toBe(false);
    // a healing potion is usable only when hurt
    s.backpack.push("Potion");
    expect(usable(book, s, "Potion")).toBe(false);
    s.ep -= 3;
    expect(usable(book, s, "Potion")).toBe(true);
  });
});

describe("v13: evading", () => {
  it("evade.if gates evading; anyIf / any allow it at any round", () => {
    const inv = mk(["invisibility", "nexus", "divination"]);
    const plain = mk();
    const c: Combat = { foes: [{ name: "F", cs: 15, ep: 50 }], evade: { after: 3, anyIf: { disc: "invisibility" }, to: "2" } };
    expect(canEvade(book, inv, fightIn(inv, c))).toBe(true);
    expect(canEvade(book, plain, fightIn(plain, c))).toBe(false);
    const gated: Combat = { foes: [{ name: "F", cs: 15, ep: 50 }], evade: { if: { disc: "invisibility" }, any: true, to: "2" } };
    expect(canEvade(book, inv, fightIn(inv, gated))).toBe(true);
    expect(canEvade(book, plain, fightIn(plain, gated))).toBe(false);
    const b = fightIn(plain, { foes: [{ name: "F", cs: 15, ep: 50 }], evade: { after: 1, to: "2" } });
    expect(canEvade(book, plain, b)).toBe(false);
    playRound(book, plain, b, false, fixed(5));
    expect(canEvade(book, plain, b)).toBe(true);
  });
});

describe("v13: ways out of a fight", () => {
  it("instead: choices shown before the fight, the fight still pending", () => {
    const s = mk();
    s.special.push("Fireseed");
    fightIn(s, { foes: [{ name: "F", cs: 15, ep: 50 }], win: "120", instead: [{ text: "Dùng Fireseed", to: "120", if: { item: "Fireseed" } }, { text: "x", to: "404" }] });
    expect(phase(book, s)).toBe("combat");
    expect(choiceState(s, book.sections["9"].combat!.instead![0])).toBe("ok");
    expect(validateBook(book)).toContain("§9 → §404: không có đoạn này");
    delete book.sections["9"];
  });

  it("skipIf: with the condition the fight does not happen and one way on is offered", () => {
    const screen = mk(["psiscreen", "nexus", "divination"]);
    const c: Combat = { foes: [{ name: "Oudakon", cs: 20, ep: 30 }], win: "2", skipIf: { if: { disc: "psiscreen" }, to: "120" } };
    fightIn(screen, c);
    expect(phase(book, screen)).toBe("choices");
    expect(visibleChoices(book.sections["9"], screen)).toEqual([{ text: "Đi tiếp", to: "120" }]);
    const plain = mk();
    fightIn(plain, c);
    expect(phase(book, plain)).toBe("combat");
    expect(skipChoice(book.sections["9"], plain)).toBeNull();
    expect(validateBook(book)).toEqual([]);
    delete book.sections["9"];
  });
});
