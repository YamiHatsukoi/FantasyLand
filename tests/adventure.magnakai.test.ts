/** Magnakai rules (books 6–12) on a made-up book: no book text in this repository. */
import { describe, expect, it } from "vitest";
import {
  activeMind, baseCs, battleExit, canEvade, carryNeeds, check, choiceState, continueRun, enter, epMax, heroCs, knows, loreCircles,
  masteryCount, mindChoices, mindName, newRun, playRound, randomResult, rankName, rankOf, rollRandom, startBattle, apply,
} from "../src/adventure/engine";
import type { AdvState, Book, Combat, CRT, Disc } from "../src/adventure/types";

// hero loses 2, enemy loses 3 + column; column 12 kills
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 2] as [number, number]));
const fixed = (n: number) => () => n / 10 + 0.01;
const scene = { place: "p", bg: "forest" as const, time: "day" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
const WEAPONS = ["Dagger", "Spear", "Mace", "Short Sword", "Warhammer", "Bow", "Axe", "Sword", "Quarterstaff", "Broadsword"];

const book: Book = {
  id: "mk", series: "lw", num: 6, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: WEAPONS, discCount: 3,
  kit: {
    items: [{ gain: "Map", type: "special" }],
    gold: { random: true, add: 10 },
    picks: [{ mode: "choose", count: 5, options: [
      { gain: "Sword", type: "weapon" }, { gain: "Bow", type: "weapon" }, { gain: "Quiver", type: "special", arrows: 6 },
      { gain: "Meal", type: "meal", n: 4 }, { gain: "Waistcoat", type: "special" }, { gain: "Rope", type: "backpack" },
    ] }],
  },
  items: {
    Map: { name: "Bản đồ", type: "special" }, Sword: { name: "Kiếm", type: "weapon" }, Bow: { name: "Cung", type: "weapon" },
    Quiver: { name: "Ống tên", type: "special" }, Waistcoat: { name: "Áo da", type: "special", epMax: 2 }, Rope: { name: "Dây", type: "backpack" },
    Axe: { name: "Rìu", type: "weapon" },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "go", to: "2" }, { text: "poor", to: "2", if: { goldBelow: 5 } }, { text: "bow", to: "3", if: { mastered: "Bow" } }] },
    "2": { text: ["b"], scene, combat: { foes: [{ name: "Foe", cs: 15, ep: 30 }], win: "4" } },
    "3": { text: ["c"], scene, random: { picks: 2, bow: true, out: [{ min: 0, max: 9, to: "4" }, { min: 10, max: 99, to: "5" }] } },
    "4": { text: ["d"], scene, fx: [{ eat: true }], choices: [{ text: "go", to: "5" }] },
    "5": { text: ["e"], scene, end: "victory" },
  },
};

const mk = (discs: Disc[], mastered: string[] = [], picks = [0, 2, 3, 4]) =>
  newRun(book, { name: "LW", csRoll: 4, epRoll: 6, disciplines: discs, mastered, goldRoll: 3, picks: [picks] });
const fightIn = (s: AdvState, c: Combat) => { book.sections["9"] = { text: ["f"], scene, combat: c }; s.section = "9"; s.fought = false; return startBattle(book, s, book.sections["9"]); };

describe("Magnakai rules", () => {
  it("creates a Kai Master: 10 + number, 20 + number, three disciplines, three mastered weapons, kit and gold", () => {
    const s = mk(["weaponmastery", "psisurge", "curing"], ["Sword", "Bow", "Axe", "Mace"]);
    expect(s.cs).toBe(14);
    expect(s.epBase).toBe(26);
    expect(epMax(book, s)).toBe(28); // waistcoat +2
    expect(s.ep).toBe(28);
    expect(s.gold).toBe(13);
    expect(s.mastered).toEqual(["Sword", "Bow", "Axe"]);
    expect(s.weaponskill).toBeUndefined();
    expect(s.arrows).toBe(6);
    expect(s.meals).toBe(4);
    expect(rankOf(s)).toBe(3);
    expect(rankName(s)).toBe("Kai Master Superior");
    // a Kai Master has mastered all ten Kai Disciplines
    expect(knows(s, "mindshield")).toBe(true);
    expect(check(s, { notDisc: "hunting" })).toBe(false);
    expect(mk(["curing"], ["Sword"]).mastered).toBeUndefined();
  });

  it("adds Lore-circle bonuses to the basic scores and shows them in the fight", () => {
    const fire = mk(["weaponmastery", "huntmastery", "curing"]);
    expect(loreCircles(book, fire).map((c) => c.id)).toEqual(["fire"]);
    expect(baseCs(book, fire)).toBe(15);
    expect(epMax(book, fire)).toBe(30);
    const light = mk(["animalcontrol", "curing", "nexus"]);
    expect(baseCs(book, light)).toBe(14);
    expect(epMax(book, light)).toBe(31);
    const solaris = mk(["invisibility", "huntmastery", "pathsmanship"]);
    expect([baseCs(book, solaris), epMax(book, solaris)]).toEqual([15, 31]);
    const spirit = { ...mk(["psisurge", "psiscreen", "nexus"]), disciplines: ["psisurge", "psiscreen", "nexus", "divination"] as Disc[] };
    expect([baseCs(book, spirit), epMax(book, spirit)]).toEqual([17, 31]);
    const b = fightIn(fire, { foes: [{ name: "F", cs: 10, ep: 10 }] });
    expect(heroCs(book, fire, book.sections["9"].combat!, b.foes[0].def).parts.some((p) => p.label === "Vòng Lửa" && p.v === 1)).toBe(true);
  });

  it("Weaponmastery: +3 with a mastered weapon; the Sommerswerd is a sword; a Bow alone is bare hands; forbidden weapons", () => {
    const c: Combat = { foes: [{ name: "F", cs: 10, ep: 10 }] };
    const s = mk(["weaponmastery", "curing", "nexus"], ["Sword", "Spear", "Mace"]);
    fightIn(s, c);
    expect(heroCs(book, s, c, c.foes[0]).total).toBe(17);
    s.weapons = ["Axe"];
    expect(heroCs(book, s, c, c.foes[0]).total).toBe(14);
    s.weapons = ["Bow"];
    expect(heroCs(book, s, c, c.foes[0]).total).toBe(10);
    s.items = { Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true } };
    s.special.push("Sommerswerd");
    expect(heroCs(book, s, c, c.foes[0]).total).toBe(14 + 8 + 3);
    const noSun: Combat = { ...c, forbid: ["Sommerswerd"] };
    expect(heroCs(book, s, noSun, c.foes[0]).total).toBe(10);
  });

  it("Psi-surge: +4 for 2 ENDURANCE a round, Mindblast +2 free, not at 6 ENDURANCE or below, not on immune foes", () => {
    const s = mk(["psisurge", "curing", "nexus"]);
    const c: Combat = { foes: [{ name: "F", cs: 14, ep: 50 }] };
    const b = fightIn(s, c);
    expect(mindChoices(book, s)).toEqual([0, 1]);
    expect(b.mind).toBe(0);
    expect(mindName(book, activeMind(book, s, 0)!)).toBe("Psi-surge");
    expect(mindName(book, activeMind(book, s, 1)!)).toBe("Tâm Lực Kích");
    expect(heroCs(book, s, c, c.foes[0], 0).total).toBe(14 + 4); // armed with a Sword, no Weaponmastery
    const ep = s.ep;
    const r = playRound(book, s, b, false, fixed(5));
    expect(r.mindCost).toBe(2);
    expect(s.ep).toBe(ep - 4);
    s.ep = 6;
    expect(activeMind(book, s, 0)!.cs).toBe(2);
    expect(playRound(book, s, b, false, fixed(5)).mindCost).toBe(0);
    s.ep = 20;
    b.mind = 1;
    expect(playRound(book, s, b, false, fixed(5)).mindCost).toBe(0);
    const imm: Combat = { foes: [{ name: "F", cs: 14, ep: 50, immune: ["psisurge"] }] };
    const b2 = fightIn(s, imm);
    expect(heroCs(book, s, imm, imm.foes[0], b2.mind).total).toBe(14);
    expect(playRound(book, s, b2, false, fixed(5)).mindCost).toBe(0);
    expect(mindChoices(book, mk(["curing", "nexus", "divination"]))).toEqual([]);
  });

  it("Psi-screen stops Mindforce; Huntmastery: no Meal and no ambush penalty; firstRound.if", () => {
    const c: Combat = { foes: [{ name: "F", cs: 10, ep: 50 }], mindforce: 2, ambush: -3, firstRound: { cs: -2, if: { notDisc: "huntmastery" } } };
    const shielded = mk(["psiscreen", "huntmastery", "nexus"]);
    let b = fightIn(shielded, c);
    let ep = shielded.ep;
    playRound(book, shielded, b, false, fixed(5));
    expect(shielded.ep).toBe(ep - 2);
    expect(heroCs(book, shielded, c, c.foes[0], -1, 0).total).toBe(14);
    const open = mk(["curing", "nexus", "divination"]);
    b = fightIn(open, c);
    ep = open.ep;
    expect(heroCs(book, open, c, c.foes[0], -1, 0).total).toBe(14 - 3 - 2);
    expect(heroCs(book, open, c, c.foes[0], -1, 1).total).toBe(14 - 3);
    playRound(book, open, b, false, fixed(5));
    expect(open.ep).toBe(ep - 4);
    const meals = shielded.meals;
    apply(book, shielded, [{ eat: true }]);
    expect(shielded.meals).toBe(meals);
    apply(book, open, [{ eat: true }]);
    expect(open.meals).toBe(meals - 1);
  });

  it("Curing restores 1 ENDURANCE per section without combat", () => {
    const s = mk(["curing", "nexus", "divination"]);
    s.ep = 10;
    s.fought = false;
    enter(book, s, "5");
    expect(s.ep).toBe(11);
    const t = mk(["nexus", "divination", "invisibility"]);
    t.ep = 10;
    enter(book, t, "5");
    expect(t.ep).toBe(10);
  });

  it("carries a Kai Lord over into book 6: stats and gear kept, Magnakai disciplines picked, Weaponskill gone", () => {
    const prev: AdvState = {
      ...newRun({ ...book, rules: "kai", discCount: 5, kit: { items: [], gold: { random: false, add: 0 }, picks: [] } },
        { name: "LW", csRoll: 7, epRoll: 9, disciplines: ["healing", "weaponskill", "mindblast", "hunting", "camouflage", "sixthsense"] as Disc[], weaponskillRoll: 7, picks: [] }),
      ended: "victory", weapons: ["Axe"], backpack: ["Rope"], special: ["Sommerswerd", "Silver Helm"], gold: 45, meals: 2,
    };
    const prevItems = { Sommerswerd: { name: "Sommerswerd", type: "special" as const, cs: 8, weapon: true }, "Silver Helm": { name: "Mũ Bạc", type: "special" as const, cs: 2 } };
    expect(carryNeeds(book, prev)).toMatchObject({ fresh: true, discs: 3, masteryCap: 3 });
    const s = continueRun(book, prev, { newDiscs: ["weaponmastery", "curing", "psisurge"], mastered: ["Sword", "Bow", "Spear"], picks: [[]], goldRoll: 2, prevItems });
    expect(s.cs).toBe(17);
    expect(s.epBase).toBe(29);
    expect(s.weaponskill).toBeUndefined();
    expect(s.mastered).toEqual(["Sword", "Bow", "Spear"]);
    expect(s.weapons).toEqual(["Axe"]);
    expect(s.backpack).toEqual(["Rope"]);
    expect(s.special).toEqual(["Sommerswerd", "Silver Helm", "Map"]);
    expect(s.gold).toBe(50);
    expect(rankName(s)).toBe("Kai Master Superior");
    expect(s.items?.Sommerswerd?.cs).toBe(8);
    const c: Combat = { foes: [{ name: "F", cs: 10, ep: 10 }] };
    fightIn(s, c);
    // 17 + Sommerswerd (a mastered Sword) 3 + 8 + Silver Helm 2
    expect(heroCs(book, s, c, c.foes[0]).total).toBe(30);
    // Kai Healing does not heal any more: Curing does
    s.ep = 10; s.fought = false;
    enter(book, s, "5");
    expect(s.ep).toBe(11);
    expect(check(s, { rank: 4 })).toBe(false);
  });

  it("book 7+: one new discipline and one more mastered weapon per finished book", () => {
    const b6 = { ...mk(["weaponmastery", "curing", "nexus"], ["Sword", "Bow", "Spear"]), ended: "victory" as const };
    const b7: Book = { ...book, id: "mk7", num: 7 };
    expect(carryNeeds(b7, b6, "huntmastery")).toMatchObject({ fresh: false, discs: 1, weapons: 1 });
    const s = continueRun(b7, b6, { newDisc: "huntmastery", mastered: ["Axe", "Mace"], picks: [[]], goldRoll: 0 });
    expect(s.mastered).toEqual(["Sword", "Bow", "Spear", "Axe"]);
    expect(rankName(s)).toBe("Primate");
    expect(loreCircles(b7, s).map((c) => c.id)).toEqual(["fire"]);
    // Weaponmastery learnt later covers 3 weapons + 1 per finished book
    const other = { ...mk(["curing", "nexus", "divination"]), ended: "victory" as const };
    expect(carryNeeds(b7, other, "weaponmastery").weapons).toBe(4);
    expect(masteryCount(b7, { disciplines: ["curing", "nexus", "divination", "weaponmastery"] })).toBe(4);
  });

  it("improved disciplines by rank: Tutelary, Mentora, Scion-kai, Archmaster", () => {
    const all: Disc[] = ["weaponmastery", "psisurge", "curing", "nexus", "divination", "invisibility", "pathsmanship", "animalcontrol", "huntmastery"];
    const c: Combat = { foes: [{ name: "F", cs: 10, ep: 10 }] };
    const at = (n: number) => { const s = mk(["weaponmastery", "psisurge", "curing"], ["Sword", "Bow", "Axe"]); s.disciplines = all.slice(0, n); s.weapons = []; fightIn(s, c); return s; };
    expect(heroCs(book, at(4), c, c.foes[0]).parts.find((p) => p.label === "Tay không")!.v).toBe(-4);
    expect(heroCs(book, at(5), c, c.foes[0]).parts.find((p) => p.label === "Tay không")!.v).toBe(-2);
    expect(heroCs(book, at(8), c, c.foes[0]).parts.find((p) => p.label === "Tay không")!.v).toBe(-1);
    const scion = at(8); scion.weapons = ["Sword"];
    expect(heroCs(book, scion, c, c.foes[0]).parts.find((p) => p.label.startsWith("WM"))!.v).toBe(4);
    const arch = at(9);
    expect(activeMind(book, arch, 0)).toMatchObject({ cs: 6, cost: 1 });
    expect(activeMind(book, arch, 1)).toMatchObject({ cs: 3, cost: 0 });
    arch.ep = 5;
    expect(activeMind(book, arch, 0)!.cs).toBe(6);
    arch.ep = 4;
    expect(activeMind(book, arch, 0)!.cs).toBe(3);
    expect(rankName(arch)).toBe("Archmaster");
    // Mentora: +2 more on bow shots
    const mentora = at(7); mentora.weapons = ["Bow"];
    expect(randomResult(book, book.sections["3"], mentora, [1, 1]).add).toBe(5);
    const m6 = at(6); m6.weapons = ["Bow"];
    expect(randomResult(book, book.sections["3"], m6, [1, 1]).add).toBe(3);
  });

  it("conditions: mastered weapon, gold below, rank of the series", () => {
    const s = mk(["weaponmastery", "curing", "nexus"], ["Bow", "Sword", "Axe"]);
    expect(check(s, { mastered: "Bow" })).toBe(true);
    expect(check(s, { mastered: "Mace" })).toBe(false);
    expect(check(mk(["curing", "nexus", "divination"], ["Bow"]), { mastered: "Bow" })).toBe(false);
    expect(check(s, { goldBelow: 14 })).toBe(true);
    expect(check(s, { goldBelow: 13 })).toBe(false);
    expect(choiceState(s, book.sections["1"].choices![1])).toBe("hidden");
    expect(check(s, { rank: 3 })).toBe(true);
    expect(check(s, { notRank: 4 })).toBe(true);
  });

  it("random.picks adds several numbers; a bow shot adds Weaponmastery with Bow", () => {
    const s = mk(["weaponmastery", "curing", "nexus"], ["Bow", "Sword", "Axe"], [1, 2]);
    expect(rollRandom(book.sections["3"], fixed(4))).toEqual([4, 4]);
    expect(randomResult(book, book.sections["3"], s, [4, 4])).toMatchObject({ n: 8, add: 3, value: 11, to: "5" });
    const plain = mk(["curing", "nexus", "divination"], [], [1, 2]);
    expect(randomResult(book, book.sections["3"], plain, [4, 4])).toMatchObject({ value: 8, to: "4" });
  });

  it("combat: stopAt ends the fight at a foe ENDURANCE; evade.until limits evasion to the first rounds", () => {
    const s = mk(["curing", "nexus", "divination"]);
    const c: Combat = { foes: [{ name: "F", cs: 14, ep: 30 }], stopAt: { foeEp: 25, to: "5" }, evade: { after: 0, until: 1, to: "4" } };
    const b = fightIn(s, c);
    expect(canEvade(book, s, b)).toBe(true);
    playRound(book, s, b, false, fixed(5));
    expect(b.over).toBe("stopped");
    expect(battleExit(book, s, b)).toBe("5");
    const b2 = fightIn(s, { ...c, stopAt: undefined });
    playRound(book, s, b2, false, fixed(5));
    expect(canEvade(book, s, b2)).toBe(false);
  });

  it("entering Grand Master books, Lore-circle bonuses become part of the basic scores", () => {
    const s = { ...mk(["weaponmastery", "huntmastery", "curing"]), ended: "victory" as const };
    const gm: Book = { ...book, id: "gm", num: 13, rules: "grandmaster", discCount: 4, names: { disc: {} as Book["names"]["disc"] } };
    const t = continueRun(gm, s, { newDiscs: ["kaisurge", "deliverance", "kaiscreen", "telegnosis"], picks: [[]], goldRoll: 0 });
    expect(t.cs).toBe(15);
    expect(t.epBase).toBe(28);
    expect(knows(t, "huntmastery")).toBe(true);
    expect(rankName(t)).toBe("Kai Grand Defender");
  });
});
