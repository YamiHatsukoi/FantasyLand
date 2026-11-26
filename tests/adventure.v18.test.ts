/** FORMAT v18 rules (loss fallbacks, spared items, "if you pick a 0", contests on points, items back in place, the Magic Spear) on made-up books: no book text here. */
import { describe, expect, it } from "vitest";
import {
  apply, armed, battleExit, enter, heroCs, heroPoints, losePool, meleeWeapons, newRun, pendingLoss, playRound, randomResult, startBattle, takeOffer, validateBook, wielded,
} from "../src/adventure/engine";
import type { AdvState, Book, CRT } from "../src/adventure/types";

// every cell: the foe loses 5, the hero loses 3
const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, () => [5, 3] as [number, number]));
const scene = { place: "p", bg: "hall" as const, time: "night" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
const names = { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] };
const items: Book["items"] = {
  Sword: { name: "Kiếm", type: "weapon" }, Dagger: { name: "Dao Găm", type: "weapon" }, Bow: { name: "Cung", type: "weapon" }, Spear: { name: "Giáo", type: "weapon" },
  Sommerswerd: { name: "Sommerswerd", type: "special", cs: 8, weapon: true },
  "Magic Spear": { name: "Giáo Phép", type: "special", weapon: true, as: "Spear" },
  Map: { name: "Bản đồ", type: "special" }, Gem: { name: "Ngọc", type: "special" }, Key: { name: "Chìa", type: "special" },
  Rope: { name: "Dây", type: "backpack" }, Torch: { name: "Đuốc", type: "backpack" }, Tinderbox: { name: "Hộp Đánh Lửa", type: "backpack" },
};

const book: Book = {
  id: "v18", series: "lw", num: 6, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Bow", "Dagger"], discCount: 3,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] }, items, names,
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, end: "victory" },
    "3": { text: ["c"], scene, end: "death" },
    // a qualifying round: three picks, a 0 with the cracked bow breaks it
    "4": { text: ["d"], scene, random: { picks: 3, mods: [{ if: { flag: "x" }, add: 3 }], out: [{ min: 0, max: 7, to: "1" }, { min: 8, max: 99, to: "2" }], onNumber: { n: 0, to: "3", if: { flag: "jakan" } } } },
    // a final on points of its own, with the bow
    "5": {
      text: ["e"], scene,
      combat: { foes: [{ name: "Altan", cs: 15, ep: 50 }], heroEp: 50, weapon: "Bow", csIf: [{ if: { flag: "jakan" }, add: -2 }], onNumber: { n: 0, to: "3", if: { flag: "jakan" } }, lose: "1", win: "2" },
    },
    // arm-wrestling: points as many as ENDURANCE now, given back afterwards
    "6": { text: ["f"], scene, combat: { foes: [{ name: "Thuỷ thủ", cs: 15, ep: 25 }], heroEp: "ep", lose: "1", win: "2" } },
    // "if at any time you pick a 1, you fall"
    "7": { text: ["g"], scene, combat: { foes: [{ name: "Lính gác", cs: 15, ep: 23 }], onNumber: { n: [1], to: "3" } }, choices: [{ text: "Đi", to: "2" }] },
    // only a magical weapon wounds it
    "8": { text: ["h"], scene, combat: { foes: [{ name: "Helghast", cs: 21, ep: 30, undead: true }], unarmedUnless: "weaponLike", win: "2" } },
    "9": { text: ["i"], scene, combat: { foes: [{ name: "Giak", cs: 10, ep: 10 }], win: "2" } },
  },
};

const mk = (mastered = ["Sword"]): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["weaponmastery", "curing", "nexus"], mastered, picks: [] });
  s.weapons = ["Dagger"];
  s.backpack = [];
  s.special = [];
  s.meals = 0;
  return s;
};
const offersOf = (s: AdvState) => s.offers.map((o) => ("loseChoice" in o ? `${o.loseChoice}×${o.n}` : "?"));

describe("v18: a loss with a fallback (orElse)", () => {
  const fx = [{ loseChoice: "backpack" as const, orElse: [{ loseChoice: "weapon" as const }] }];

  it("loses from the Backpack when it holds anything (Meals count), else a Weapon", () => {
    const s = mk();
    s.backpack = ["Rope"];
    apply(book, s, fx);
    expect(offersOf(s)).toEqual(["backpack×1"]);
    const t = mk();
    t.meals = 1;
    apply(book, t, fx);
    expect(offersOf(t)).toEqual(["backpack×1"]);
    const u = mk();
    apply(book, u, fx);
    expect(offersOf(u)).toEqual(["weapon×1"]);
    expect(pendingLoss(u)).toBe(true);
    takeOffer(book, u, 0, "Dagger");
    expect(u.weapons).toEqual([]);
    // nothing at all: nothing happens
    const v = mk();
    v.weapons = [];
    apply(book, v, fx);
    expect(v.offers).toEqual([]);
  });

  it("fewer items than asked: those are lost, no fallback; a two-part fallback offers both", () => {
    const two = [{ loseChoice: "backpack" as const, n: 2, orElse: [{ loseChoice: "weapon" as const }, { loseChoice: "special" as const }] }];
    const s = mk();
    s.backpack = ["Rope"];
    s.special = ["Map"];
    apply(book, s, two);
    expect(offersOf(s)).toEqual(["backpack×2"]);
    const t = mk();
    t.special = ["Map"];
    apply(book, t, two);
    expect(offersOf(t)).toEqual(["weapon×1", "special×1"]);
  });

  it("loseRandom, loseNth and lose fall back the same way", () => {
    const s = mk();
    apply(book, s, [{ loseRandom: { kind: "backpack", n: 1 }, orElse: [{ lose: "Dagger" }] }]);
    expect(s.weapons).toEqual([]);
    const t = mk();
    t.special = ["Map"];
    apply(book, t, [{ loseNth: { kind: "backpack", n: 1 }, orElse: [{ loseNth: { kind: "special", n: 1 } }] }]);
    expect(t.special).toEqual([]);
    const u = mk();
    apply(book, u, [{ lose: "Rope", orElse: [{ ep: -2 }] }]);
    expect(u.ep).toBe(newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: [], picks: [] }).ep - 2);
    // the item is there: no fallback
    const v = mk();
    v.backpack = ["Rope"];
    const ep = v.ep;
    apply(book, v, [{ lose: "Rope", orElse: [{ ep: -2 }] }]);
    expect([v.backpack, v.ep]).toEqual([[], ep]);
  });
});

describe("v18: the item in use is spared (except)", () => {
  it("one Torch is never offered; a second one may be; only the Torch left: the fallback", () => {
    const fx = [{ loseChoice: "backpack" as const, except: ["Torch"], orElse: [{ loseChoice: "weapon" as const }] }];
    const s = mk();
    s.backpack = ["Torch", "Rope"];
    apply(book, s, fx);
    expect(losePool(book, s, "backpack", ["Torch"])).toEqual(["Rope"]);
    // the spared Torch cannot be handed in
    expect(takeOffer(book, s, 0, "Torch")).toEqual([]);
    takeOffer(book, s, 0, "Rope");
    expect(s.backpack).toEqual(["Torch"]);
    const t = mk();
    t.backpack = ["Torch", "Torch"];
    expect(losePool(book, t, "backpack", ["Torch"])).toEqual(["Torch"]);
    const u = mk();
    u.backpack = ["Torch"];
    apply(book, u, fx);
    expect(offersOf(u)).toEqual(["weapon×1"]);
  });

  it("loseRandom spares it too", () => {
    const s = mk();
    s.backpack = ["Torch", "Rope"];
    apply(book, s, [{ loseRandom: { kind: "backpack", n: 1 }, except: ["Torch"] }], () => 0);
    expect(s.backpack).toEqual(["Torch"]);
  });
});

describe("v18: a number picked leads elsewhere (onNumber)", () => {
  it("random: any one of the picks, before modifiers, while the condition holds", () => {
    const s = mk();
    const sec = book.sections["4"];
    expect(randomResult(book, sec, s, [9, 0, 9]).to).toBe("2");
    s.flags.jakan = true;
    expect(randomResult(book, sec, s, [9, 0, 9]).to).toBe("3");
    expect(randomResult(book, sec, s, [9, 1, 9]).to).toBe("2");
    expect(randomResult(book, sec, s, [1, 1, 1]).to).toBe("1");
  });

  it("combat: the round ends the fight harmlessly and leads there", () => {
    const s = mk();
    s.section = "7";
    enter(book, s, "7");
    const b = startBattle(book, s, book.sections["7"]);
    const ep = s.ep;
    playRound(book, s, b, false, () => 0.5);
    expect([b.over, b.foes[0].ep, s.ep]).toEqual([undefined, 18, ep - 3]);
    playRound(book, s, b, false, () => 0.1);
    expect(b.over).toBe("number");
    expect([b.foes[0].ep, s.ep]).toEqual([18, ep - 3]);
    expect(battleExit(book, s, b)).toBe("3");
    expect(s.fought).toBe(true);
  });
});

describe("v18: a contest on points of its own (heroEp)", () => {
  it("the points are lost instead of ENDURANCE; at 0 the contest is lost", () => {
    const s = mk(["Bow"]);
    enter(book, s, "5");
    const ep = s.ep;
    const b = startBattle(book, s, book.sections["5"]);
    expect(heroPoints(book, s, b)).toEqual({ ep: 50, max: 50 });
    // no mind attack in a contest
    expect(b.mind).toBe(-1);
    playRound(book, s, b, false, () => 0.5);
    expect([b.pool, s.ep, b.foes[0].ep]).toEqual([47, ep, 45]);
    b.pool = 2;
    playRound(book, s, b, false, () => 0.5);
    expect([b.over, b.pool, s.ep]).toEqual(["beaten", 0, ep]);
    expect(battleExit(book, s, b)).toBe("1");
  });

  it("wins when the opponent's points run out; the bow is the weapon, its mastery counts; a cracked bow breaks on a 0", () => {
    const s = mk(["Bow"]);
    s.special = ["Sommerswerd"];
    enter(book, s, "5");
    const c = book.sections["5"].combat!;
    expect(wielded(book, s, c)).toBe("Bow");
    const parts = heroCs(book, s, c, c.foes[0]).parts.map((p) => p.label);
    expect(parts).toContain("WM (Cung)");
    expect(parts).not.toContain("Sommerswerd");
    const b = startBattle(book, s, book.sections["5"]);
    for (let i = 0; i < 10 && !b.over; i++) playRound(book, s, b, false, () => 0.5);
    expect(b.over).toBe("win");
    expect(battleExit(book, s, b)).toBe("2");
    const t = mk(["Bow"]);
    t.flags.jakan = true;
    enter(book, t, "5");
    expect(heroCs(book, t, c, c.foes[0]).parts.some((p) => p.v === -2)).toBe(true);
    const b2 = startBattle(book, t, book.sections["5"]);
    playRound(book, t, b2, false, () => 0.05);
    expect([b2.over, battleExit(book, t, b2)]).toEqual(["number", "3"]);
  });

  it('"ep": as many points as ENDURANCE now, which is the same after the match', () => {
    const s = mk();
    s.ep -= 5;
    enter(book, s, "6");
    const ep = s.ep;
    const b = startBattle(book, s, book.sections["6"]);
    expect(b.pool).toBe(ep);
    for (let i = 0; i < 20 && !b.over; i++) playRound(book, s, b, false, () => 0.5);
    expect(b.over).toBe("win");
    expect(s.ep).toBe(ep);
  });
});

describe("v18: items given back go back where they were", () => {
  it("a stolen second Special Item is second again; a stash saved before (no places) gives back at the end", () => {
    const s = mk();
    s.special = ["Map", "Gem", "Key"];
    apply(book, s, [{ loseNth: { kind: "special", n: 2 }, into: "thief" }]);
    apply(book, s, [{ gain: "Sommerswerd", type: "special" }]);
    expect(s.special).toEqual(["Map", "Key", "Sommerswerd"]);
    apply(book, s, [{ unstash: "thief" }]);
    expect(s.special).toEqual(["Map", "Gem", "Key", "Sommerswerd"]);
    const old = mk();
    old.special = ["Map", "Key"];
    old.stashes = { x: { weapons: [], backpack: [], special: ["Gem"], meals: 0, gold: 0, arrows: 0 } };
    apply(book, old, [{ unstash: "x" }]);
    expect(old.special).toEqual(["Map", "Key", "Gem"]);
  });

  it("several taken at once, picked or confiscated, come back in their order; a short list takes them at its end", () => {
    const s = mk();
    s.special = ["Map", "Gem", "Key"];
    s.backpack = ["Rope", "Torch", "Tinderbox"];
    apply(book, s, [{ loseChoice: "special", n: 2, into: "stake" }]);
    takeOffer(book, s, 0, "Key");
    takeOffer(book, s, 0, "Map");
    expect(s.special).toEqual(["Gem"]);
    apply(book, s, [{ unstash: "stake" }]);
    expect(s.special).toEqual(["Map", "Gem", "Key"]);
    apply(book, s, [{ stash: "jail" }]);
    expect([s.special, s.backpack, s.weapons]).toEqual([[], [], []]);
    apply(book, s, [{ gain: "Sword", type: "weapon" }, { gain: "Rope", type: "backpack" }, { unstash: "jail" }]);
    expect(s.weapons).toEqual(["Dagger", "Sword"]);
    expect(s.backpack).toEqual(["Rope", "Torch", "Tinderbox", "Rope"]);
    expect(s.special).toEqual(["Map", "Gem", "Key"]);
    // the list grew shorter meanwhile: the third place is the end
    const t = mk();
    t.special = ["Map", "Gem", "Key"];
    apply(book, t, [{ loseNth: { kind: "special", n: 3 }, into: "k" }, { lose: "Map" }, { unstash: "k" }]);
    expect(t.special).toEqual(["Gem", "Key"]);
  });
});

describe("v18: the Magic Spear, a weapon-like Special Item", () => {
  const kai: Book = {
    ...book, id: "v18k", num: 2, rules: "kai", weaponskill: ["Dagger", "Spear", "Sword"], discCount: 5,
    names: { disc: { camouflage: "Cam", hunting: "Hunt", sixthsense: "Six", tracking: "Tr", healing: "Heal", weaponskill: "WS", mindshield: "MS", mindblast: "MB", animalkinship: "AK", mindovermatter: "MoM" } as Book["names"]["disc"] },
  };
  const hero = () => {
    const s = newRun(kai, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["weaponskill", "healing", "hunting", "tracking", "camouflage"], weaponskillRoll: 1, picks: [] });
    s.weapons = [];
    s.special = ["Magic Spear"];
    return s;
  };

  it("is fought with in any fight, with Weaponskill in Spear", () => {
    const s = hero();
    expect(meleeWeapons(kai, s)).toEqual(["Magic Spear"]);
    expect(armed(s, kai)).toBe(true);
    const c = kai.sections["9"].combat!;
    expect(wielded(kai, s, c)).toBe("Magic Spear");
    expect(heroCs(kai, s, c, c.foes[0]).parts.map((p) => p.label)).toEqual(["Cơ bản", "WS (Giáo Phép)"]);
    // a save from before v18: the item's definition without `weapon`
    const old = hero();
    old.items = { "Magic Spear": { name: "Giáo Phép", type: "special", as: "Spear" } };
    const k2: Book = { ...kai, items: { ...kai.items } };
    delete k2.items["Magic Spear"];
    expect(meleeWeapons(k2, old)).toEqual(["Magic Spear"]);
  });

  it("only magical weapons: the spear rather than a sword; it does not double the damage to the undead", () => {
    const s = hero();
    s.weapons = ["Sword"];
    s.section = "8";
    const c = kai.sections["8"].combat!;
    expect(wielded(kai, s, c)).toBe("Magic Spear");
    const b = startBattle(kai, s, kai.sections["8"]);
    playRound(kai, s, b, false, () => 0.5);
    expect(b.foes[0].ep).toBe(25);
  });
});

describe("v18: book checks", () => {
  it("validates, and a missing onNumber section is caught", () => {
    expect(validateBook(book)).toEqual([]);
    const bad: Book = { ...book, sections: { ...book.sections, "7": { ...book.sections["7"], combat: { ...book.sections["7"].combat!, onNumber: { n: 1, to: "99" } } } } };
    expect(validateBook(bad).some((e) => e.includes("§99"))).toBe(true);
  });
});
