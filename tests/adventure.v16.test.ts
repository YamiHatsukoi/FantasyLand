/** FORMAT v16 rules (book 10 encodings) on a made-up book: no book text in this repository. */
import { describe, expect, it } from "vitest";
import {
  apply, check, choiceState, compareResult, condText, dosesLeft, enter, fightWeapons, hasLoreCircle, heroCs, losePool, mindBonusMulOf, newRun, playChoice, randomPicks,
  rollRandom, startBattle, useItem, validateBook,
} from "../src/adventure/engine";
import type { AdvState, Book, Choice, CompareGame, Combat, CRT, Section } from "../src/adventure/types";

const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 3] as [number, number]));
const scene = { place: "p", bg: "forest" as const, time: "day" as const, weather: "clear" as const, actors: [], mood: "calm" as const };

const game: CompareGame = { picks: 2, opponents: 2, zerosWin: true, win: { fx: [{ lune: 24 }] }, lose: {}, tie: { fx: [{ lune: 12 }] } };

const book: Book = {
  id: "v16", series: "lw", num: 10, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Bow", "Axe"], discCount: 3,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] },
  items: {
    Sword: { name: "Kiếm", type: "weapon" }, Axe: { name: "Rìu", type: "weapon" }, Bow: { name: "Cung", type: "weapon" },
    Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true },
    "Silver Bow": { name: "Cung Bạc", type: "special", as: "Bow" },
    Map: { name: "Bản đồ", type: "special" },
    Laumwort: { name: "Laumwort", type: "backpack", heal: 2, uses: 3 },
    "Signet Ring": { name: "Nhẫn Ấn", type: "special", keep: true },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Chơi", to: "2", repeat: true, fx: [{ lune: -12 }], roll: { compare: game } }, { text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, end: "victory" },
    "3": { text: ["c"], scene, combat: { foes: [{ name: "Chó", cs: 20, ep: 30 }], mindBonusMul: 2, mindBonusMulIf: [{ if: { loreCircle: "spirit" }, n: 3 }], win: "2" } },
    "4": { text: ["d"], scene, combat: { foes: [{ name: "Sâu", cs: 16, ep: 50 }], mods: { cs: -3 }, unarmedUnless: "weaponLike", forbid: ["Silver Bow"], win: "2" } },
  },
};

const mk = (discs: AdvState["disciplines"] = ["huntmastery", "nexus", "divination"]): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: discs, picks: [] });
  s.weapons = ["Sword"];
  return s;
};

describe("v16: half the Belt Pouch (loseHalf gold / lune)", () => {
  it("loses half the Gold Crowns, the number lost rounded down; up: rounded up", () => {
    const s = mk();
    s.gold = 15;
    const ch = apply(book, s, [{ loseHalf: "gold" }]);
    expect(s.gold).toBe(8);
    expect(ch.map((c) => c.label)).toEqual(["-7 Vương Miện Vàng"]);
    s.gold = 15;
    apply(book, s, [{ loseHalf: "gold", up: true }]);
    expect(s.gold).toBe(7);
  });

  it("Lune apart from Gold Crowns; nothing to halve, no change", () => {
    const s = mk();
    s.gold = 10; s.lune = 9;
    apply(book, s, [{ loseHalf: "lune" }]);
    expect(s.lune).toBe(5);
    expect(s.gold).toBe(10);
    s.gold = 1;
    expect(apply(book, s, [{ loseHalf: "gold" }])).toEqual([]);
    expect(s.gold).toBe(1);
    s.lune = undefined;
    expect(apply(book, s, [{ loseHalf: "lune" }])).toEqual([]);
  });
});

describe("v16: Lore-circle conditions", () => {
  it("uses the engine's circles: Spirit = Psi-surge, Psi-screen, Nexus, Divination", () => {
    const s = mk(["psisurge", "psiscreen", "nexus"]);
    expect(check(s, { loreCircle: "spirit" })).toBe(false);
    expect(check(s, { notLoreCircle: "spirit" })).toBe(true);
    s.disciplines.push("divination");
    expect(check(s, { loreCircle: "spirit" })).toBe(true);
    expect(check(s, { notLoreCircle: "spirit" })).toBe(false);
    // Solaris: Invisibility, Huntmastery, Pathsmanship; Fire: Weaponmastery, Huntmastery
    const t = mk(["invisibility", "huntmastery", "pathsmanship"]);
    expect(hasLoreCircle(t, "solaris")).toBe(true);
    expect(hasLoreCircle(t, "fire")).toBe(false);
  });

  it("a Grand Master has completed every circle; locked / hidden choices; text", () => {
    expect(hasLoreCircle({ disciplines: ["kaisurge"] }, "light")).toBe(true);
    const s = mk();
    expect(choiceState(s, { if: { loreCircle: "solaris" } })).toBe("locked");
    expect(choiceState(mk(["invisibility", "huntmastery", "pathsmanship"]), { if: { notLoreCircle: "solaris" } })).toBe("hidden");
    expect(condText(book, { loreCircle: "spirit" })).toBe("cần Vòng Tinh Thần");
    // in a random table modifier
    const r = { mods: [{ if: { loreCircle: "fire" as const }, add: 5 }], out: [{ min: 0, max: 99, to: "2" }] };
    expect(check(mk(["weaponmastery", "huntmastery", "nexus"]), r.mods[0].if)).toBe(true);
  });
});

describe("v16: mind bonus multiplier by condition (mindBonusMulIf)", () => {
  const c = book.sections["3"].combat!;
  it("×2 normally, ×3 with the Lore-circle of the Spirit", () => {
    const plain = mk(["psisurge", "nexus", "divination"]);
    plain.ep = 20;
    expect(mindBonusMulOf(c, plain, book)).toBe(2);
    enter(book, plain, "3");
    const b = startBattle(book, plain, book.sections["3"]);
    const p1 = heroCs(book, plain, c, c.foes[0], b.mind).parts.find((p) => p.label.startsWith("Psi-surge"));
    expect(p1?.v).toBe(8);
    expect(p1?.label).toContain("×2");

    const spirit = mk(["psisurge", "psiscreen", "nexus", "divination"]);
    expect(mindBonusMulOf(c, spirit, book)).toBe(3);
    enter(book, spirit, "3");
    const p2 = heroCs(book, spirit, c, c.foes[0], startBattle(book, spirit, book.sections["3"]).mind).parts.find((p) => p.label.startsWith("Psi-surge"));
    expect(p2?.v).toBe(12);
    expect(p2?.label).toContain("×3");
  });

  it("no entry holding and no mindBonusMul: ×1", () => {
    const only: Combat = { foes: [], mindBonusMulIf: [{ if: { loreCircle: "fire" }, n: 3 }] };
    expect(mindBonusMulOf(only, mk(), book)).toBe(1);
  });
});

describe("v16: unarmed unless a weapon-like Special Item (unarmedUnless)", () => {
  const c = book.sections["4"].combat!;
  const parts = (s: AdvState) => heroCs(book, s, c, c.foes[0]).parts.map((p) => `${p.label} ${p.v}`);

  it("ordinary weapons do not count: bare-handed −4", () => {
    const s = mk();
    s.weapons = ["Sword", "Axe"];
    expect(fightWeapons(book, s, c)).toEqual([]);
    expect(parts(s)).toContain("Tay không -4");
  });

  it("the Sommerswerd is used (its bonus counts); a forbidden or Bow-like item is not", () => {
    const s = mk();
    s.special = ["Silver Bow", "Sommerswerd"];
    expect(fightWeapons(book, s, c)).toEqual(["Sommerswerd"]);
    expect(parts(s)).not.toContain("Tay không -4");
    expect(parts(s)).toContain("Sommerswerd 8");
    s.special = ["Silver Bow", "Map"];
    expect(fightWeapons(book, s, c)).toEqual([]);
    // Weaponmastery with Sword applies to the Sommerswerd
    const wm = mk(["weaponmastery", "huntmastery", "nexus"]);
    wm.mastered = ["Sword"];
    wm.special = ["Sommerswerd"];
    expect(parts(wm).some((p) => p.startsWith("WM"))).toBe(true);
  });

  it("Tutelary with Weaponmastery: −2 only", () => {
    const s = mk(["weaponmastery", "huntmastery", "nexus", "divination", "curing"]);
    expect(parts(s)).toContain("Tay không -2");
  });

  it("fights without it keep the hero's ordinary weapons", () => {
    const s = mk();
    expect(fightWeapons(book, s, { foes: [] })).toEqual(["Sword"]);
  });
});

describe("v16: dice-comparison game (roll.compare)", () => {
  const c = book.sections["1"].choices![0] as Choice;

  it("numbers picked: two for each opponent, then two for the hero", () => {
    expect(randomPicks(c.roll!)).toBe(6);
    expect(rollRandom(c.roll!, () => 0.5)).toHaveLength(6);
    expect(randomPicks({ compare: { win: {}, lose: {} } })).toBe(4);
  });

  it("win, lose and tie against the best opponent", () => {
    const s = mk();
    // opponents 3+4, 5+1; hero 6+2
    expect(compareResult(book, game, s, [3, 4, 5, 1, 6, 2]).result).toBe("win");
    // one opponent beats the hero
    const lose = compareResult(book, game, s, [3, 4, 9, 1, 6, 2]);
    expect(lose.result).toBe("lose");
    expect(lose.foeTotals).toEqual([7, 10]);
    expect(lose.heroTotal).toBe(8);
    expect(compareResult(book, game, s, [3, 5, 1, 1, 6, 2]).result).toBe("tie");
  });

  it("all noughts win outright (both: a tie); hero mods add to the hero only", () => {
    const s = mk();
    expect(compareResult(book, game, s, [9, 9, 9, 8, 0, 0]).result).toBe("win");
    expect(compareResult(book, game, s, [0, 0, 9, 8, 9, 9]).result).toBe("lose");
    expect(compareResult(book, game, s, [0, 0, 1, 1, 0, 0]).result).toBe("tie");
    const g: CompareGame = { mods: [{ if: { disc: "huntmastery" }, add: 3 }], win: { to: "2" }, lose: { end: "death" } };
    const r = compareResult(book, g, s, [8, 1, 5, 2]);
    expect(r.heroTotal).toBe(10);
    expect(r.result).toBe("win");
    expect(r.to).toBe("2");
  });

  it("playChoice: stake first, then the outcome's fx; staying when the outcome has no to", () => {
    const s = mk();
    s.lune = 30;
    const won = playChoice(book, s, c, [1, 1, 2, 2, 5, 5]);
    expect(won.compare?.result).toBe("win");
    expect(s.lune).toBe(30 - 12 + 24);
    expect(won.to).toBe("");
    const lost = playChoice(book, s, c, [9, 9, 2, 2, 5, 5]);
    expect(lost.compare?.result).toBe("lose");
    expect(s.lune).toBe(42 - 12);
    playChoice(book, s, c, [5, 5, 2, 2, 5, 5]);
    expect(s.lune).toBe(30); // tie: stake back
    const end = playChoice(book, s, { text: "x", to: "2", roll: { compare: { win: { to: "2" }, lose: { end: "death" } } } }, [9, 9, 0, 1]);
    expect(end.end).toBe("death");
    expect(s.ended).toBe("death");
  });

  it("validateBook follows the outcomes' links", () => {
    const bad: Book = { ...book, sections: { ...book.sections, "5": { text: ["e"], scene, choices: [{ text: "x", to: "2", roll: { compare: { win: { to: "99" }, lose: { to: "2" } } } }] } as Section } };
    expect(validateBook(bad)).toContain("§5 → §99: không có đoạn này");
    expect(validateBook(book)).toEqual([]);
  });
});

describe("v16: items (Laumwort doses, Signet Ring keep)", () => {
  it("Laumwort: 2 ENDURANCE per use, three uses", () => {
    const s = mk();
    s.backpack = ["Laumwort"];
    s.ep = 10;
    expect(dosesLeft(book, s, "Laumwort")).toBe(3);
    useItem(book, s, "Laumwort");
    useItem(book, s, "Laumwort");
    expect(s.ep).toBe(14);
    expect(dosesLeft(book, s, "Laumwort")).toBe(1);
    useItem(book, s, "Laumwort");
    expect(s.ep).toBe(16);
    expect(s.backpack).toEqual([]);
  });

  it("Signet Ring is never offered to give up", () => {
    const s = mk();
    s.special = ["Signet Ring", "Map"];
    expect(losePool(book, s, "special")).toEqual(["Map"]);
  });
});
