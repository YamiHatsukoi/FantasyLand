/** Lone Wolf rules of Adventure (Kai, Magnakai, Grand Master, New Order). Pure functions: no DOM. */
import type { AdvState, Book, Choice, ChoiceRoll, Combat, CompareGame, Cond, Disc, Effect, FoeDef, ItemDef, ItemType, ListKind, LoreCircleId, LoseKind, NthPick, Offer, OnNumber, PickItem, RandomPick, Section, Stash, StashPart } from "./types";
import { DISCS_BY_RULES } from "./types";

export type Rng = () => number;

/** Random Number Table: 0-9. */
export const pick10 = (rng: Rng = Math.random) => Math.floor(rng() * 10);

export const MAX_WEAPONS = 2;
export const MAX_BACKPACK = 8;
export const MAX_GOLD = 50;
export const KILL = -1;

/**
 * What each rule set's disciplines do in play. The same role (weapon bonus, mind attack,
 * healing on the road, living off the land, mind shield) belongs to a different discipline
 * in every series.
 */
export interface Profile {
  weapon: { disc: Disc; bonus: number };
  /** Mind attacks, strongest first. A weaker form of the same discipline follows the stronger one. */
  mind: MindOpt[];
  heal: Disc;
  hunt: Disc;
  shield: Disc;
  sense: Disc;
  /** Ignores the COMBAT SKILL lost to a surprise attack or ambush (Magnakai Huntmastery and later). */
  ambush?: Disc;
}

export interface MindOpt {
  disc: Disc;
  /** Name of the attack when it is not the discipline's own (Mindblast, the weak form of Psi-surge). */
  as?: Disc;
  cs: number;
  /** ENDURANCE paid each round it is used. */
  cost: number;
  /** Cannot be used when ENDURANCE is below this (Psi-surge: not at 6 or below). */
  minEp?: number;
}

export const PROFILES: Record<Book["rules"], Profile> = {
  kai: { weapon: { disc: "weaponskill", bonus: 2 }, mind: [{ disc: "mindblast", cs: 2, cost: 0 }], heal: "healing", hunt: "hunting", shield: "mindshield", sense: "sixthsense" },
  magnakai: {
    weapon: { disc: "weaponmastery", bonus: 3 },
    mind: [{ disc: "psisurge", cs: 4, cost: 2, minEp: 7 }, { disc: "psisurge", as: "mindblast", cs: 2, cost: 0 }],
    heal: "curing", hunt: "huntmastery", shield: "psiscreen", sense: "divination", ambush: "huntmastery",
  },
  grandmaster: {
    weapon: { disc: "grandweaponmastery", bonus: 5 },
    mind: [{ disc: "kaisurge", cs: 8, cost: 1, minEp: 7 }, { disc: "kaisurge", as: "mindblast", cs: 4, cost: 0 }],
    heal: "deliverance", hunt: "grandhuntmastery", shield: "kaiscreen", sense: "telegnosis", ambush: "grandhuntmastery",
  },
  neworder: {
    weapon: { disc: "grandweaponmastery", bonus: 5 },
    mind: [{ disc: "kaisurge", cs: 8, cost: 1, minEp: 7 }, { disc: "kaisurge", as: "mindblast", cs: 4, cost: 0 }],
    heal: "deliverance", hunt: "grandhuntmastery", shield: "kaiscreen", sense: "telegnosis", ambush: "grandhuntmastery",
  },
};

export const profile = (book: Book) => PROFILES[book.rules ?? "kai"];
export const discsOf = (book: Book): readonly Disc[] => DISCS_BY_RULES[book.rules ?? "kai"];

// ------------------------------------------------------------------ series, ranks, Lore-circles

const TIERS = ["kai", "magnakai", "grandmaster", "neworder"] as const;
const tierIdx = (r: Book["rules"] | undefined) => TIERS.indexOf(r ?? "kai");

/** The highest series whose disciplines the hero has learnt (a Kai Master has Magnakai disciplines…). */
export function tierOf(s: Pick<AdvState, "disciplines">): Book["rules"] {
  const has = (r: Book["rules"]) => s.disciplines.some((d) => (DISCS_BY_RULES[r] as readonly Disc[]).includes(d));
  if (has("grandmaster")) return s.disciplines.some((d) => (["astrology", "herbmastery", "elementalism", "bardsmanship"] as Disc[]).includes(d)) ? "neworder" : "grandmaster";
  return has("magnakai") ? "magnakai" : "kai";
}

/**
 * Disciplines of the hero's own series: the rank counts these. A Kai Master has mastered all ten
 * Kai Disciplines, and a Grand Master all the Magnakai ones; those are known without being listed.
 */
export const ownDiscs = (s: Pick<AdvState, "disciplines">): Disc[] => s.disciplines.filter((d) => (DISCS_BY_RULES[tierOf(s)] as readonly Disc[]).includes(d));
export const rankOf = (s: Pick<AdvState, "disciplines">) => ownDiscs(s).length;

export function knows(s: Pick<AdvState, "disciplines">, d: Disc): boolean {
  if (s.disciplines.includes(d)) return true;
  const t = tierIdx(tierOf(s));
  // every discipline of an earlier series (New Order heroes are trained apart: nothing implied)
  if (t >= 3) return false;
  return TIERS.slice(0, t).some((r) => (DISCS_BY_RULES[r] as readonly Disc[]).includes(d));
}

/** Titles by number of disciplines of the series ("Levels of … Training"). */
export const RANKS: Partial<Record<Book["rules"], string[]>> = {
  kai: ["Novice", "Intuite", "Doan", "Acolyte", "Initiate", "Aspirant", "Guardian", "Warmarn", "Savant", "Master"],
  magnakai: ["Kai Master", "Kai Master Senior", "Kai Master Superior", "Primate", "Tutelary", "Principalin", "Mentora", "Scion-kai", "Archmaster", "Kai Grand Master"],
  grandmaster: ["Kai Grand Master Senior", "Kai Grand Master Superior", "Kai Grand Sentinel", "Kai Grand Defender", "Kai Grand Guardian", "Sun Knight", "Sun Lord", "Sun Thane", "Grand Thane", "Grand Crown", "Sun Prince", "Kai Supreme Master"],
};

export function rankName(s: Pick<AdvState, "disciplines">): string {
  const list = RANKS[tierOf(s)];
  const n = rankOf(s);
  return list && n > 0 ? list[Math.min(n, list.length) - 1] : "";
}

/** Magnakai ranks at which disciplines improve (Improved Disciplines). */
export const MK = { tutelary: 5, mentora: 7, scion: 8, archmaster: 9 } as const;
const mkRank = (book: Book, s: AdvState) => (book.rules === "magnakai" && tierOf(s) === "magnakai" ? rankOf(s) : 0);

/** Lore-circles of the Magnakai: all their disciplines learnt add to the basic COMBAT SKILL and ENDURANCE. */
export const LORE_CIRCLES: { id: LoreCircleId; name: string; discs: Disc[]; cs: number; ep: number }[] = [
  { id: "fire", name: "Vòng Lửa", discs: ["weaponmastery", "huntmastery"], cs: 1, ep: 2 },
  { id: "light", name: "Vòng Ánh Sáng", discs: ["animalcontrol", "curing"], cs: 0, ep: 3 },
  { id: "solaris", name: "Vòng Solaris", discs: ["invisibility", "huntmastery", "pathsmanship"], cs: 1, ep: 3 },
  { id: "spirit", name: "Vòng Tinh Thần", discs: ["psisurge", "psiscreen", "nexus", "divination"], cs: 3, ep: 3 },
];

/** Lore-circles the hero has completed (they count in Magnakai books; later books carry them in the stats). */
export function loreCircles(book: Book, s: Pick<AdvState, "disciplines">) {
  if (book.rules !== "magnakai") return [];
  return LORE_CIRCLES.filter((c) => c.discs.every((d) => s.disciplines.includes(d)))
    .map((c) => ({ ...c, name: (book.names.circle as Record<string, string> | undefined)?.[c.id] ?? c.name }));
}

/**
 * Has the hero completed this Lore-circle (all its disciplines known)? Unlike `loreCircles`, this holds
 * in any book: a Grand Master has completed them all.
 */
export function hasLoreCircle(s: Pick<AdvState, "disciplines">, id: LoreCircleId): boolean {
  const c = LORE_CIRCLES.find((x) => x.id === id);
  return !!c && c.discs.every((d) => knows(s, d));
}

/** The Lore-circle's name in the book (names.circle) or the engine's own. */
export const loreCircleName = (book: Book, id: LoreCircleId) => (book.names.circle as Record<string, string> | undefined)?.[id] ?? LORE_CIRCLES.find((x) => x.id === id)?.name ?? id;

/** COMBAT SKILL before fight modifiers: the basic score plus Lore-circle bonuses. */
export const baseCs = (book: Book, s: AdvState) => s.cs + loreCircles(book, s).reduce((a, c) => a + c.cs, 0);

/** How many weapons Weaponmastery covers: three at Kai Master Superior, one more per Magnakai book finished. */
export function masteryCount(book: Book, s: Pick<AdvState, "disciplines">) {
  if (book.rules !== "magnakai") return 3;
  return Math.max(3, Math.min(new Set(book.weaponskill).size, rankOf(s)));
}

// ------------------------------------------------------------------ character

export interface NewHero {
  name: string;
  csRoll: number;
  epRoll: number;
  disciplines: Disc[];
  /** Kai Weaponskill: the weapon (by random number); later series: the weapons chosen. */
  weaponskillRoll?: number;
  mastered?: string[];
  goldRoll?: number;
  /** Chosen/rolled option indexes for each of book.kit.picks. */
  picks: number[][];
}

function giveKit(book: Book, s: AdvState, picks: number[][], skipOwned: boolean) {
  const arrows = (n?: number) => { if (n) s.arrows = Math.min(has(s, "Quiver") ? 6 : 0, s.arrows + n); };
  for (const it of book.kit.items) if (!skipOwned || !has(s, it.gain)) { give(book, s, it.gain, it.type, it.n ?? 1); arrows(it.arrows); }
  book.kit.picks.forEach((p, i) => {
    for (const idx of picks[i] ?? []) {
      const o = p.options[idx];
      if (!o) continue;
      if ("gold" in o) s.gold = Math.min(MAX_GOLD, s.gold + o.gold);
      else { give(book, s, o.gain, o.type, o.n ?? 1); arrows(o.arrows); }
    }
  });
}

export function newRun(book: Book, h: NewHero): AdvState {
  const now = Date.now();
  const discs = [...new Set(h.disciplines)].filter((d) => discsOf(book).includes(d));
  const wm = profile(book).weapon.disc;
  const s: AdvState = {
    v: 2, book: book.id, name: h.name, section: book.start,
    cs: 10 + h.csRoll, ep: 0, epBase: 20 + h.epRoll,
    disciplines: discs,
    weaponskill: book.rules === "kai" && discs.includes("weaponskill") ? book.weaponskill[h.weaponskillRoll ?? 0] : undefined,
    weapons: [], backpack: [], special: [], meals: 0, arrows: 0,
    gold: Math.min(MAX_GOLD, book.kit.gold.add + (book.kit.gold.random ? h.goldRoll ?? 0 : 0)),
    flags: {}, csNext: 0, csBook: 0, offers: [], fought: false,
    visited: [], steps: 0, created: now, updated: now,
  };
  if (wm !== "weaponskill" && discs.includes(wm)) s.mastered = [...new Set(h.mastered ?? [])].slice(0, masteryCount(book, s));
  giveKit(book, s, h.picks, false);
  s.ep = epMax(book, s);
  enter(book, s, book.start);
  return s;
}

export interface CarryOver {
  /** Same series: the one discipline learnt for the book finished. */
  newDisc?: Disc;
  /** A new series (Kai Lord → Kai Master): the disciplines of the new series picked (book.discCount). */
  newDiscs?: Disc[];
  picks: number[][];
  goldRoll?: number;
  weaponskillRoll?: number;
  /** Weapons added to Weaponmastery (all of them on a first pick, one per finished book after). */
  mastered?: string[];
  /** Items of the earlier book: what the hero brings keeps its description and bonuses. */
  prevItems?: Record<string, ItemDef>;
}

/** Does the hero enter a new series with this book (book 6, 13, 21)? */
export const newSeries = (book: Book, prev: Pick<AdvState, "disciplines">) => tierIdx(book.rules) > tierIdx(tierOf(prev));

/** What a hero of an earlier book must choose to continue in this one. */
export function carryNeeds(book: Book, prev: AdvState, newDisc?: Disc) {
  const fresh = newSeries(book, prev);
  const wm = profile(book).weapon.disc;
  const discs = fresh ? book.discCount : discsOf(book).some((d) => !prev.disciplines.includes(d)) ? 1 : 0;
  let weapons = 0;
  if (!fresh && wm !== "weaponskill") {
    const after = { disciplines: newDisc ? [...prev.disciplines, newDisc] : prev.disciplines };
    if (after.disciplines.includes(wm)) weapons = Math.max(0, masteryCount(book, after) - (prev.mastered?.length ?? 0));
  }
  return { fresh, discs, weapons, masteryCap: fresh ? 3 : weapons };
}

/**
 * Continue with the hero of a finished earlier book (Lone Wolf rules): COMBAT SKILL, ENDURANCE,
 * weapons, Backpack, Special Items, gold and flags carry over. Within a series one new discipline is
 * learnt per finished book; entering a new series (Kai Lord → Kai Master in book 6) the hero picks
 * the new series' disciplines, and the old Weaponskill does not apply any more. The new book's
 * equipment offer is added on top (as far as there is room).
 */
export function continueRun(book: Book, prev: AdvState, h: CarryOver): AdvState {
  const now = Date.now();
  const s: AdvState = {
    ...JSON.parse(JSON.stringify(prev)) as AdvState,
    v: 2, book: book.id, section: book.start, csNext: 0, csBook: 0, offers: [], fought: false, hurt: false,
    visited: [], steps: 0, created: now, updated: now, ended: undefined, back: undefined,
    // a new book starts with a Backpack, unwounded; what was met in the last book stays there
    noPack: undefined, bleed: undefined, noPotions: undefined, lastFight: undefined, foesLeft: undefined, randomAt: undefined,
  };
  // flags of the old book stay (later books ask "have you ever…"), cutscene marks do not
  for (const f of Object.keys(s.flags)) if (f.startsWith("cut:")) delete s.flags[f];
  // definitions of what the hero brings that this book does not describe
  const owned = new Set([...s.weapons, ...s.backpack, ...s.special]);
  const carried: Record<string, ItemDef> = {};
  for (const id of owned) {
    const def = book.items[id] ? undefined : h.prevItems?.[id] ?? prev.items?.[id];
    if (def) carried[id] = def;
  }
  s.items = Object.keys(carried).length ? carried : undefined;
  const wm = profile(book).weapon.disc;
  const own = discsOf(book);
  if (newSeries(book, prev)) {
    // Lore-circle bonuses were counted on top of the basic scores: they now become part of them
    const circles = LORE_CIRCLES.filter((c) => tierOf(prev) === "magnakai" && c.discs.every((d) => prev.disciplines.includes(d)));
    s.cs += circles.reduce((a, c) => a + c.cs, 0);
    s.epBase += circles.reduce((a, c) => a + c.ep, 0);
    for (const d of new Set(h.newDiscs ?? [])) if (own.includes(d) && !s.disciplines.includes(d) && s.disciplines.filter((x) => own.includes(x)).length < book.discCount) s.disciplines.push(d);
    s.weaponskill = undefined;
    s.mastered = wm !== "weaponskill" && s.disciplines.includes(wm) ? [...new Set(h.mastered ?? [])].slice(0, masteryCount(book, s)) : undefined;
  } else {
    if (h.newDisc && own.includes(h.newDisc) && !s.disciplines.includes(h.newDisc)) s.disciplines.push(h.newDisc);
    if (h.newDisc === "weaponskill" && book.rules === "kai" && !s.weaponskill) s.weaponskill = book.weaponskill[h.weaponskillRoll ?? 0];
    if (wm !== "weaponskill" && s.disciplines.includes(wm) && h.mastered?.length) {
      s.mastered = [...new Set([...(s.mastered ?? []), ...h.mastered])].slice(0, Math.max(masteryCount(book, s), s.mastered?.length ?? 0));
    }
  }
  s.gold = Math.min(MAX_GOLD, s.gold + book.kit.gold.add + (book.kit.gold.random ? h.goldRoll ?? 0 : 0));
  giveKit(book, s, h.picks, true);
  s.ep = epMax(book, s); // a new adventure starts rested
  enter(book, s, book.start);
  return s;
}

// ------------------------------------------------------------------ items

/** An item's description: the book's own, or the one the hero brought from an earlier book. */
export const itemDef = (book: Book, s: Pick<AdvState, "items"> | undefined, id: string): ItemDef | undefined => book.items[id] ?? s?.items?.[id];

/** Do the item's bonuses count now (ItemDef.offIf: no shield while an arm is useless)? */
export const itemOn = (book: Book, s: AdvState, id: string) => { const off = itemDef(book, s, id)?.offIf; return !off || !check(s, off, book); };

export function epMax(book: Book, s: AdvState) {
  return s.epBase + s.special.reduce((a, id) => a + (itemOn(book, s, id) ? itemDef(book, s, id)?.epMax ?? 0 : 0), 0) + loreCircles(book, s).reduce((a, c) => a + c.ep, 0);
}

/** Holds a weapon: one in the weapon slots, or the Sommerswerd. */
export function armed(s: AdvState, book?: Book) {
  return s.weapons.length > 0 || s.special.some((id) => { const d = book ? itemDef(book, s, id) : s.items?.[id]; return id === "Sommerswerd" || !!d?.weapon || (!!d?.as && d.as !== "Bow"); });
}

/** The kind of weapon an item counts as (the Sommerswerd is a sword). */
export const weaponKind = (book: Book, s: AdvState, id: string) => itemDef(book, s, id)?.as ?? (id === "Sommerswerd" ? "Sword" : id);

/**
 * Weapons usable hand to hand: a Bow is not (fighting with only a Bow is fighting bare-handed). Special
 * Items count when weapon-like (the Sommerswerd, `weapon`, or a weapon kind `as`: the Magic Spear).
 */
export function meleeWeapons(book: Book, s: AdvState): string[] {
  const special = s.special.filter((id) => weaponLike(book, s, id));
  return [...special, ...s.weapons].filter((id) => weaponKind(book, s, id) !== "Bow");
}

export function has(s: AdvState, id: string) {
  if (id === "Meal") return s.meals > 0;
  return s.weapons.includes(id) || s.backpack.includes(id) || s.special.includes(id);
}

/** Room left for items of that type (no Backpack: none for Backpack Items and Meals). */
export function room(s: AdvState, type: ItemType) {
  if (type === "weapon") return MAX_WEAPONS - s.weapons.length;
  if (type === "backpack" || type === "meal") return s.noPack ? 0 : MAX_BACKPACK - s.backpack.length - s.meals;
  return Infinity;
}

/** The Backpack itself: finding one lets the hero carry Backpack Items again (it is not an item on a list). */
export const PACK = "Backpack";

/** Adds items as far as there is room; returns how many did not fit. */
export function give(book: Book, s: AdvState, id: string, type: ItemType, n = 1): number {
  if (id === PACK) { delete s.noPack; return 0; }
  let left = n;
  const before = epMax(book, s);
  while (left > 0 && room(s, type) > 0) {
    if (type === "meal" || id === "Meal") s.meals++;
    else if (type === "weapon") s.weapons.push(id);
    else if (type === "special") s.special.push(id);
    else s.backpack.push(id);
    left--;
  }
  const gained = epMax(book, s) - before;
  if (gained > 0) s.ep += gained;
  return left;
}

/** Special Items that count as weapons: the Sommerswerd, items with `weapon` or `as`. */
export const weaponLike = (book: Book, s: AdvState, id: string) => { const d = itemDef(book, s, id); return id === "Sommerswerd" || !!d?.weapon || !!d?.as; };

/** Drops up to n of an item (Meals: n Meals); returns how many were dropped. */
export function dropN(book: Book, s: AdvState, id: string, n = 1): number {
  let k = 0;
  while (k < n && drop(book, s, id)) k++;
  return k;
}

export function drop(book: Book, s: AdvState, id: string): boolean {
  if (id === "Meal") { if (s.meals <= 0) return false; s.meals--; return true; }
  for (const list of [s.weapons, s.backpack, s.special]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      s.ep = Math.min(s.ep, epMax(book, s));
      if (s.doses && id in s.doses && !has(s, id)) delete s.doses[id];
      return true;
    }
  }
  return false;
}

export function itemName(book: Book, id: string, s?: Pick<AdvState, "items">) {
  return id === "Meal" ? "Phần Ăn" : itemDef(book, s, id)?.name ?? id;
}

/**
 * What the player may pick from when giving something up (loseChoice): weapons, the Backpack (Meals
 * included), Special Items, or weapons and Backpack ("any"). Items with `keep` are never offered.
 */
export function losePool(book: Book | undefined, s: AdvState, kind: LoseKind, except?: string[]): string[] {
  const meals = Array.from({ length: s.meals }, () => "Meal");
  const pool = kind === "weapon" ? [...s.weapons] : kind === "backpack" ? [...s.backpack, ...meals] : kind === "special" ? [...s.special] : [...s.weapons, ...s.backpack, ...meals];
  // `except`: one of each is spared (the Torch in use): a second one may still be given up
  for (const x of except ?? []) { const i = pool.indexOf(x); if (i >= 0) pool.splice(i, 1); }
  return [...new Set(pool)].filter((id) => id === "Meal" || !(book?.items[id] ?? s.items?.[id])?.keep);
}

/** The entries of a list with one of each `except` item left out (the first one noted). */
function sparing(entries: Entry[], except?: string[]): Entry[] {
  const out = [...entries];
  for (const x of except ?? []) { const i = out.findIndex((e) => e.id === x); if (i >= 0) out.splice(i, 1); }
  return out;
}

/** Doses left of a carried item (`uses`, default 1). */
export function dosesLeft(book: Book, s: AdvState, id: string): number {
  const it = itemDef(book, s, id);
  if (!it || !has(s, id)) return 0;
  return s.doses?.[id] ?? Math.max(1, it.uses ?? 1);
}

/** Takes one dose of an item: the item goes with its last dose. */
function takeDose(book: Book, s: AdvState, id: string, it: ItemDef) {
  const left = dosesLeft(book, s, id) - 1;
  if (left > 0 && (it.uses ?? 1) > 1) { (s.doses ??= {})[id] = left; return; }
  if (s.doses) delete s.doses[id];
  drop(book, s, id);
}

// ------------------------------------------------------------------ conditions & effects

/** Does the condition hold? `book` tells which items cannot be given up (for `hasAny`). */
export function check(s: AdvState, c: Cond | undefined, book?: Book): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => check(s, x, book));
  if ("any" in c) return c.any.some((x) => check(s, x, book));
  if ("hasAny" in c) return losePool(book, s, c.hasAny).length > 0;
  if ("notLoreCircle" in c) return !hasLoreCircle(s, c.notLoreCircle);
  if ("loreCircle" in c) return hasLoreCircle(s, c.loreCircle);
  if ("notDisc" in c) return !knows(s, c.notDisc);
  if ("disc" in c) return knows(s, c.disc);
  if ("mastered" in c) return masters(s, c.mastered);
  if ("wieldsMastered" in c) { const w = inHand(s, book); return !!w && masters(s, book ? weaponKind(book, s, w) : w); }
  if ("wields" in c) {
    const w = inHand(s, book);
    const want = Array.isArray(c.wields) ? c.wields : [c.wields];
    return !!w && (want.includes(w) || (!!book && want.includes(weaponKind(book, s, w))));
  }
  if ("notItem" in c) return !has(s, c.notItem);
  if ("item" in c) return has(s, c.item);
  if ("goldBelow" in c) return s.gold < c.goldBelow;
  if ("gold" in c) return s.gold >= c.gold;
  if ("epBelow" in c) return s.ep < c.epBelow;
  if ("ep" in c) return s.ep >= c.ep;
  if ("notRank" in c) return rankOf(s) < c.notRank;
  if ("rank" in c) return rankOf(s) >= c.rank;
  if ("noPack" in c) return !!s.noPack;
  if ("pack" in c) return !s.noPack;
  if ("noWeapon" in c) return !armed(s);
  if ("armed" in c) return armed(s);
  if ("arrowsBelow" in c) return s.arrows < c.arrowsBelow;
  if ("arrows" in c) return s.arrows >= c.arrows;
  if ("luneBelow" in c) return (s.lune ?? 0) < c.luneBelow;
  if ("lune" in c) return (s.lune ?? 0) >= c.lune;
  if ("notFlag" in c) return !s.flags[c.notFlag];
  if ("flag" in c) return !!s.flags[c.flag];
  return true;
}

/** Weaponskill / Weaponmastery / Grand Weaponmastery with this weapon. */
export function masters(s: Pick<AdvState, "disciplines" | "mastered" | "weaponskill">, w: string): boolean {
  if (s.weaponskill === w && s.disciplines.includes("weaponskill")) return true;
  return (s.mastered ?? []).includes(w) && (s.disciplines.includes("weaponmastery") || s.disciplines.includes("grandweaponmastery"));
}

export function condText(book: Book, c: Cond | undefined): string {
  if (!c) return "";
  if ("all" in c) return c.all.map((x) => condText(book, x)).filter(Boolean).join(", ");
  if ("any" in c) return c.any.map((x) => condText(book, x)).filter(Boolean).join(" hoặc ");
  if ("disc" in c) return `cần ${book.names.disc[c.disc] ?? c.disc}`;
  if ("item" in c) return `cần ${itemName(book, c.item)}`;
  if ("mastered" in c) return `cần thành thạo ${itemName(book, c.mastered)}`;
  if ("wields" in c) return `cần dùng ${(Array.isArray(c.wields) ? c.wields : [c.wields]).map((w) => itemName(book, w)).join(" hoặc ")}`;
  if ("wieldsMastered" in c) return "cần dùng vũ khí thành thạo";
  if ("gold" in c) return `cần ${c.gold} Vương Miện Vàng`;
  if ("ep" in c) return `cần ${c.ep} Sức Bền`;
  if ("rank" in c) return `cần ${c.rank} kỹ năng`;
  if ("arrows" in c) return `cần ${c.arrows} mũi tên`;
  if ("lune" in c) return `cần ${c.lune} Lune`;
  if ("loreCircle" in c) return `cần ${loreCircleName(book, c.loreCircle)}`;
  return "";
}

/** A choice the player can pick, one shown locked (a missing discipline...), or one not shown. */
export function choiceState(s: AdvState, c: { if?: Cond }, book?: Book): "ok" | "locked" | "hidden" {
  if (check(s, c.if, book)) return "ok";
  const negative = (x: Cond): boolean => "hasAny" in x || "notDisc" in x || "goldBelow" in x || "notItem" in x || "notFlag" in x || "epBelow" in x || "notRank" in x || "noWeapon" in x || "arrowsBelow" in x || "luneBelow" in x || "notLoreCircle" in x || "noPack" in x || ("all" in x && x.all.some(negative)) || ("any" in x && x.any.every(negative));
  return c.if && negative(c.if) ? "hidden" : "locked";
}

export interface Change {
  label: string;
  good: boolean;
  kind: "ep" | "cs" | "gold" | "item" | "meal";
  item?: string;
}

export function changeEp(book: Book, s: AdvState, d: number): Change[] {
  const before = s.ep;
  s.ep = Math.max(0, Math.min(epMax(book, s), s.ep + d));
  const real = s.ep - before;
  return real ? [{ kind: "ep", label: `Sức Bền ${real > 0 ? "+" : ""}${real}`, good: real > 0 }] : [];
}

/** `rng` picks the items lost at random (loseRandom, loseHalf). */
export function apply(book: Book, s: AdvState, fx: Effect[] | undefined, rng: Rng = Math.random): Change[] {
  const out: Change[] = [];
  for (const e of fx ?? []) {
    const when = (e as { if?: Cond }).if;
    if (when && !check(s, when, book)) continue;
    if ("ep" in e) out.push(...changeEp(book, s, e.ep));
    else if ("restoreHalf" in e && e.restoreHalf === "fight") {
      // half of what the last fight took; a fight lost (combat.lose) went down to 0, not to the 1 point it leaves
      const f = s.lastFight;
      if (f) { const half = Math.floor(f.lost / 2); out.push(...changeEp(book, s, f.beaten ? Math.max(0, half - s.ep) : half)); }
    } else if ("restoreHalf" in e) out.push(...changeEp(book, s, Math.floor((epMax(book, s) - s.ep) / 2)));
    else if ("bleed" in e) { s.bleed = { ep: Math.abs(e.bleed), cure: e.cure?.length ? e.cure : ["Potion of Laumspur"] }; out.push({ kind: "ep", label: "Vết thương chảy máu", good: false }); }
    else if ("noPotions" in e) { s.noPotions = true; out.push({ kind: "item", label: "Không uống được thuốc trước trận", good: false }); }
    else if ("epMax" in e) { s.epBase += e.epMax; out.push(...changeEp(book, s, e.epMax > 0 ? e.epMax : 0)); out.push({ kind: "ep", label: `Sức Bền tối đa ${e.epMax > 0 ? "+" : ""}${e.epMax}`, good: e.epMax > 0 }); }
    else if ("csBase" in e) { s.cs += e.csBase; out.push({ kind: "cs", label: `Kỹ Năng Chiến Đấu ${e.csBase > 0 ? "+" : ""}${e.csBase}`, good: e.csBase > 0 }); }
    else if ("cs" in e) {
      if (e.for === "book") s.csBook += e.cs;
      else s.csNext += e.cs;
      out.push({ kind: "cs", label: `Kỹ Năng Chiến Đấu ${e.cs > 0 ? "+" : ""}${e.cs}${e.for === "book" ? "" : " (trận tới)"}`, good: e.cs > 0 });
    } else if ("gold" in e) {
      if (e.optional && e.gold > 0) { s.offers.push({ gold: e.gold }); continue; }
      out.push(...changeGold(s, e.gold));
    } else if ("lune" in e) {
      if (e.optional && e.lune > 0) { s.offers.push({ lune: e.lune }); continue; }
      out.push(...changeLune(s, e.lune));
    } else if ("loseNth" in e) {
      const x = nthEntry(book, s, e.loseNth) ?? (e.loseNth.else ?? []).map((t) => nthEntry(book, s, t)).find((t) => t);
      if (x) out.push(...removeEntries(book, s, [x], e.into));
      else if (e.orElse) out.push(...apply(book, s, e.orElse, rng));
    } else if ("loseRandom" in e) {
      const pool = sparing(listEntries(book, s, e.loseRandom.kind), e.except);
      // nothing to lose: the fallback ("if you have no Backpack Items, you lose a Weapon instead")
      if (!pool.length && e.orElse) out.push(...apply(book, s, e.orElse, rng));
      else out.push(...removeEntries(book, s, randomEntries(pool, e.loseRandom.n, rng), e.into));
    } else if ("loseHalf" in e && (e.loseHalf === "gold" || e.loseHalf === "lune")) {
      // half the Belt Pouch: the number lost is rounded down (`up`: rounded up)
      const have = e.loseHalf === "gold" ? s.gold : s.lune ?? 0;
      const lost = e.up ? Math.ceil(have / 2) : Math.floor(have / 2);
      if (lost) out.push(...(e.loseHalf === "gold" ? changeGold(s, -lost) : changeLune(s, -lost)));
    } else if ("loseHalf" in e) {
      const all = listEntries(book, s, e.loseHalf as ListKind);
      out.push(...removeEntries(book, s, randomEntries(all, e.up ? Math.ceil(all.length / 2) : Math.floor(all.length / 2), rng), e.into));
    } else if ("arrows" in e) {
      const before = s.arrows;
      s.arrows = Math.max(0, Math.min(has(s, "Quiver") ? 6 : 0, s.arrows + e.arrows));
      if (s.arrows !== before) out.push({ kind: "item", label: `Mũi tên ${s.arrows - before > 0 ? "+" : ""}${s.arrows - before}`, good: s.arrows > before, item: "Arrow" });
    } else if ("loseChoice" in e) {
      // nothing to pick from: the fallback ("if you have no Backpack Items, you lose a Weapon instead")
      if (!losePool(book, s, e.loseChoice, e.except).length) { if (e.orElse) out.push(...apply(book, s, e.orElse, rng)); continue; }
      s.offers.push({ loseChoice: e.loseChoice, n: e.n ?? 1, ...(e.into ? { into: e.into } : {}), ...(e.except?.length ? { except: e.except } : {}) });
    } else if ("gain" in e) {
      const n = e.n ?? 1;
      if (e.optional) { s.offers.push({ gain: e.gain, type: e.type, n, desc: e.desc }); continue; }
      freshDoses(s, e.gain);
      const left = give(book, s, e.gain, e.type, n);
      if (n - left > 0) out.push({ kind: e.type === "meal" ? "meal" : "item", label: `Nhận ${itemName(book, e.gain)}${n - left > 1 ? ` ×${n - left}` : ""}`, good: true, item: e.gain });
      if (left > 0) s.offers.push({ gain: e.gain, type: e.type, n: left, desc: e.desc });
    } else if ("lose" in e) {
      const k = e.into ? removeEntries(book, s, entriesOf(book, s, e.lose, e.n ?? 1), e.into).length : dropN(book, s, e.lose, e.n ?? 1);
      if (k) out.push({ kind: e.lose === "Meal" ? "meal" : "item", label: `Mất ${itemName(book, e.lose)}${k > 1 ? ` ×${k}` : ""}`, good: false, item: e.lose });
      else if (e.orElse) out.push(...apply(book, s, e.orElse, rng));
    } else if ("loseAll" in e) {
      const k = e.loseAll;
      if (k === "weapons" || k === "everything") s.weapons = [];
      if (k === "backpack" || k === "pack" || k === "everything") { s.backpack = []; s.meals = 0; }
      if (k === "pack") s.noPack = true;
      if (k === "meals") s.meals = 0;
      if (k === "special" || k === "everything") { s.special = []; s.arrows = 0; }
      if (k === "gold" || k === "everything") s.gold = 0;
      if (k === "lune" || k === "everything") s.lune = 0;
      s.ep = Math.min(s.ep, epMax(book, s));
      out.push({ kind: "item", label: k === "gold" ? "Mất hết Vương Miện Vàng" : k === "lune" ? "Mất hết Lune" : k === "everything" ? "Mất toàn bộ hành trang" : k === "weapons" ? "Mất hết vũ khí" : k === "backpack" ? "Mất mọi thứ trong Ba Lô" : k === "pack" ? "Mất Ba Lô và mọi thứ trong đó" : k === "meals" ? "Mất hết Phần Ăn" : "Mất các Vật Phẩm Đặc Biệt", good: false });
    } else if ("eat" in e) {
      if (!e.noHunt && !s.flags.nohunt && s.disciplines.includes(profile(book).hunt)) out.push({ kind: "meal", label: `${book.names.disc[profile(book).hunt]}: tự kiếm được cái ăn`, good: true });
      else if (s.meals > 0) { s.meals--; out.push({ kind: "meal", label: "Ăn 1 Phần Ăn", good: true, item: "Meal" }); }
      else out.push({ kind: "meal", label: "Không có gì ăn", good: false }, ...changeEp(book, s, -3));
    } else if ("stash" in e) {
      addToStash(s, e.stash, confiscate(book, s, e.only, !!e.weaponLike));
      out.push({ kind: "item", label: e.only || e.weaponLike ? "Bị tịch thu một phần hành trang" : "Bị tịch thu toàn bộ hành trang", good: false });
    } else if ("unstash" in e) {
      const st = s.stashes?.[e.unstash];
      if (st) {
        // what no longer fits (the Backpack filled up meanwhile) is offered, to make room for it
        const back = (id: string, type: ItemType, n = 1, at = -1) => {
          const left = give(book, s, id, type, n);
          if (left > 0) s.offers.push({ gain: id, type, n: left });
          // back where it was noted on the list (when the list is long enough; else at its end)
          else if (at >= 0 && type !== "meal") {
            const list = type === "weapon" ? s.weapons : type === "special" ? s.special : s.backpack;
            list.splice(list.length - 1, 1);
            list.splice(Math.min(at, list.length), 0, id);
          }
        };
        // earlier places first, so each item goes back in front of the ones that followed it
        const inOrder = (ids: string[], pos?: number[]) => ids.map((id, i) => ({ id, at: pos?.[i] ?? -1 }))
          .sort((a, b) => (a.at < 0 ? Infinity : a.at) - (b.at < 0 ? Infinity : b.at));
        for (const w of inOrder(st.weapons, st.pos?.weapons)) back(w.id, "weapon", 1, w.at);
        for (const x of inOrder(st.backpack, st.pos?.backpack)) back(x.id, "backpack", 1, x.at);
        for (const x of inOrder(st.special, st.pos?.special)) back(x.id, "special", 1, x.at);
        if (st.meals) back("Meal", "meal", st.meals);
        s.gold = Math.min(MAX_GOLD, s.gold + st.gold);
        if (st.lune) s.lune = (s.lune ?? 0) + st.lune;
        s.arrows = Math.min(has(s, "Quiver") ? 6 : 0, s.arrows + st.arrows);
        delete s.stashes![e.unstash];
        out.push({ kind: "item", label: "Lấy lại hành trang", good: true });
      }
    } else if ("unflag" in e) {
      delete s.flags[e.unflag];
    } else if ("flag" in e) {
      s.flags[e.flag] = true;
    }
  }
  return out;
}

/** A newly found item comes with all its doses (what is left of an old one is forgotten once it is gone). */
function freshDoses(s: AdvState, id: string) {
  if (s.doses && id in s.doses && !has(s, id)) delete s.doses[id];
}

/** Adds what was taken to the stash of that name (taking more under the same name adds to what is held there). */
function addToStash(s: AdvState, name: string, took: Stash) {
  s.stashes ??= {};
  const old = s.stashes[name];
  // places on the lists (a stash saved before they were kept has none: those items go back at the end)
  const at = (st: Stash, k: "weapons" | "backpack" | "special") => st[k].map((_, i) => st.pos?.[k]?.[i] ?? -1);
  const pos = (k: "weapons" | "backpack" | "special") => [...(old ? at(old, k) : []), ...at(took, k)];
  s.stashes[name] = old ? { weapons: [...old.weapons, ...took.weapons], backpack: [...old.backpack, ...took.backpack], special: [...old.special, ...took.special],
    meals: old.meals + took.meals, gold: old.gold + took.gold, arrows: old.arrows + took.arrows, lune: (old.lune ?? 0) + (took.lune ?? 0),
    pos: { weapons: pos("weapons"), backpack: pos("backpack"), special: pos("special") } } : took;
}

/**
 * Takes away the parts of the gear asked for (all of it by default) and returns exactly what was
 * taken. Meals go with the Backpack; Arrows go with the Quiver they are kept in.
 */
export function confiscate(book: Book, s: AdvState, only: StashPart[] | undefined, weaponLikeToo: boolean): Stash {
  const part = (p: StashPart) => !only || only.includes(p);
  const took: Stash = { weapons: [], backpack: [], special: [], meals: 0, gold: 0, arrows: 0 };
  const pos = { weapons: [] as number[], backpack: [] as number[], special: [] as number[] };
  const every = (l: string[]) => l.map((_, i) => i);
  if (part("weapons")) { took.weapons = s.weapons; pos.weapons = every(s.weapons); s.weapons = []; }
  if (part("backpack")) { took.backpack = s.backpack; pos.backpack = every(s.backpack); s.backpack = []; }
  if (part("backpack") || part("meals")) { took.meals = s.meals; s.meals = 0; }
  if (part("special")) { took.special = s.special; pos.special = every(s.special); s.special = []; }
  else if (weaponLikeToo) {
    const idx = every(s.special).filter((i) => weaponLike(book, s, s.special[i]));
    took.special = idx.map((i) => s.special[i]);
    pos.special = idx;
    s.special = s.special.filter((_, i) => !idx.includes(i));
  }
  took.pos = pos;
  // Lune are money too: they go with the Gold Crowns
  if (part("gold")) { took.gold = s.gold; s.gold = 0; if (s.lune) { took.lune = s.lune; s.lune = 0; } }
  if (part("arrows") || (took.special.includes("Quiver") && !s.special.includes("Quiver"))) { took.arrows = s.arrows; s.arrows = 0; }
  s.ep = Math.min(s.ep, epMax(book, s));
  return took;
}

/** Lune: no upper limit, never turned into Gold Crowns (4 Lune = 1 Crown is the book's rate, not the engine's). */
function changeLune(s: AdvState, d: number): Change[] {
  const before = s.lune ?? 0;
  s.lune = Math.max(0, before + d);
  const real = s.lune - before;
  return real ? [{ kind: "gold", label: `${real > 0 ? "+" : ""}${real} Lune`, good: real > 0, item: "Lune" }] : [];
}

/** One item of an Action Chart list, where it sits. */
interface Entry { id: string; list: "weapon" | "backpack" | "special" | "meal"; idx: number }

/**
 * An Action Chart list in the order the items were noted: weapons, Special Items, or the Backpack
 * (its items, then one entry per Meal: their place among the items is not kept). Items with `keep`
 * are left out (the book never takes them).
 */
export function listEntries(book: Book, s: AdvState, kind: ListKind): Entry[] {
  const keep = (id: string) => !!itemDef(book, s, id)?.keep;
  const of = (list: string[], l: Entry["list"]) => list.map((id, idx) => ({ id, list: l, idx })).filter((x) => !keep(x.id));
  if (kind === "weapon") return of(s.weapons, "weapon");
  if (kind === "special") return of(s.special, "special");
  return [...of(s.backpack, "backpack"), ...Array.from({ length: s.meals }, (_, idx) => ({ id: "Meal", list: "meal" as const, idx }))];
}

/** The item an `NthPick` names (the n-th, 1 = the first, or the last), if the list is long enough. */
export function nthEntry(book: Book, s: AdvState, p: NthPick): Entry | undefined {
  const l = listEntries(book, s, p.kind);
  return p.n === "last" ? l[l.length - 1] : l[p.n - 1];
}

/** n distinct entries picked at random (all of them when there are no more). */
function randomEntries(pool: Entry[], n: number, rng: Rng): Entry[] {
  const left = [...pool];
  const out: Entry[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.min(left.length - 1, Math.floor(rng() * left.length)), 1)[0]);
  return out;
}

/** Up to n copies of an item where they sit on the Action Chart (Meals: n Meals). */
function entriesOf(book: Book, s: AdvState, id: string, n: number): Entry[] {
  if (id === "Meal") return Array.from({ length: Math.min(n, s.meals) }, (_, idx) => ({ id, list: "meal" as const, idx }));
  const all = [...s.weapons.map((x, idx) => ({ id: x, list: "weapon" as const, idx })), ...s.backpack.map((x, idx) => ({ id: x, list: "backpack" as const, idx })), ...s.special.map((x, idx) => ({ id: x, list: "special" as const, idx }))];
  return all.filter((x) => x.id === id).slice(0, n);
}

/**
 * Takes the entries off the Action Chart (later positions first, so the indexes stay right). `into`:
 * they go into that stash (with the Arrows of a Quiver), for `unstash` to give back.
 */
function removeEntries(book: Book, s: AdvState, xs: Entry[], into?: string): Change[] {
  const lists = { weapon: s.weapons, backpack: s.backpack, special: s.special };
  const arrows = s.arrows;
  for (const x of [...xs].sort((a, b) => b.idx - a.idx)) {
    if (x.list === "meal") s.meals = Math.max(0, s.meals - 1);
    else lists[x.list].splice(x.idx, 1);
  }
  for (const x of xs) if (s.doses && x.id in s.doses && !has(s, x.id)) delete s.doses[x.id];
  // Arrows are kept in the Quiver
  if (!has(s, "Quiver")) s.arrows = 0;
  if (into && xs.length) {
    // kept with the place each held on its list, to go back there (`unstash`)
    const sel = (l: Entry["list"]) => xs.filter((x) => x.list === l).sort((a, b) => a.idx - b.idx);
    const of = (l: Entry["list"]) => sel(l).map((x) => x.id);
    const at = (l: Entry["list"]) => sel(l).map((x) => x.idx);
    addToStash(s, into, { weapons: of("weapon"), backpack: of("backpack"), special: of("special"), meals: of("meal").length, gold: 0, arrows: arrows - s.arrows,
      pos: { weapons: at("weapon"), backpack: at("backpack"), special: at("special") } });
  }
  s.ep = Math.min(s.ep, epMax(book, s));
  return xs.map((x) => ({ kind: x.list === "meal" ? "meal" : "item", label: `Mất ${itemName(book, x.id, s)}`, good: false, item: x.id }));
}

/** Offers pick-limited loot under a group: at most `max` of the items may be taken. */
export function openPick(s: AdvState, group: string, max: number, items: PickItem[]) {
  (s.pickLeft ??= {})[group] = Math.max(0, max);
  for (const it of items) s.offers.push("gain" in it ? { gain: it.gain, type: it.type, n: it.n ?? 1, desc: it.desc, group } : "gold" in it ? { gold: it.gold, group } : { lune: it.lune, group });
}

/** The group of a choice's pick-limited loot (`pickMax`). */
export const choicePickGroup = (c: Choice) => `c:${c.text}`;

/** Offers a choice's pick-limited loot (`pickMax`): call after moving to its section (or staying, with `repeat`). */
export function openChoicePick(s: AdvState, c: Choice) {
  if (c.pickMax) openPick(s, choicePickGroup(c), c.pickMax.n, c.pickMax.items);
}

/** Can this offer still be taken (its pick-limited group not used up)? */
export const offerOpen = (s: AdvState, o: Offer) => !o.group || !!o.picked || (s.pickLeft?.[o.group] ?? 0) > 0;

function changeGold(s: AdvState, d: number): Change[] {
  const before = s.gold;
  s.gold = Math.max(0, Math.min(MAX_GOLD, s.gold + d));
  const real = s.gold - before;
  return real ? [{ kind: "gold", label: `${real > 0 ? "+" : ""}${real} Vương Miện Vàng`, good: real > 0, item: "Gold Crowns" }] : [];
}

// ------------------------------------------------------------------ moving through the book

/** Moves to a section and applies its effects once (a reload does not apply them again). */
export function enter(book: Book, s: AdvState, id: string, rng: Rng = Math.random): Change[] {
  const sec = book.sections[id];
  if (!sec) throw new Error(`Không có đoạn ${id}`);
  const ch: Change[] = [];
  const heal = profile(book).heal;
  if (s.steps > 0 && !s.fought && s.disciplines.includes(heal) && s.ep < epMax(book, s)) {
    ch.push(...changeEp(book, s, 1).map((c) => ({ ...c, label: `${c.label} (${book.names.disc[heal]})` })));
  }
  const { back: _old, ...snap } = s;
  s.back = JSON.parse(JSON.stringify(snap)) as Omit<AdvState, "back">;
  s.section = id;
  s.steps++;
  s.fought = false;
  s.hurt = false;
  s.offers = [];
  s.pickLeft = undefined;
  s.wield = undefined;
  s.randomAt = undefined;
  if (!s.visited.includes(id)) s.visited.push(id);
  s.updated = Date.now();
  // an open wound bleeds every section until it is cured (saves from before v19 kept it as a flag)
  if (s.flags.bleeding && !s.bleed) { s.bleed = { ep: 2, cure: ["Potion of Laumspur"] }; delete s.flags.bleeding; }
  if (s.bleed) ch.push(...changeEp(book, s, -s.bleed.ep).map((c) => ({ ...c, label: `${c.label} (vết thương chảy máu)` })));
  ch.push(...apply(book, s, sec.fx, rng));
  if (sec.pick) openPick(s, "sec", sec.pick.max, sec.pick.from);
  if (sec.end) s.ended = sec.end;
  if (s.ep <= 0) s.ended = "death";
  return ch;
}

export function retry(s: AdvState): AdvState | null {
  if (!s.back) return null;
  return { ...(JSON.parse(JSON.stringify(s.back)) as AdvState), back: undefined, updated: Date.now() };
}

/** What the player has to do in the current section. */
export function phase(book: Book, s: AdvState): "end" | "combat" | "random" | "choices" {
  const sec = book.sections[s.section];
  if (s.ended) return "end";
  if (sec.combat && !s.fought && !skipChoice(sec, s)) return "combat";
  if (sec.random && !skipChoice(sec, s) && !forcedChoices(sec, s).length) return "random";
  return "choices";
}

/** The way past a fight that does not happen (combat.skipIf holds: "with Psi-screen it never attacks"). */
export function skipChoice(sec: Section, s: AdvState): Choice | null {
  const k = sec.combat?.skipIf;
  return k && !s.fought && check(s, k.if) ? { text: k.text ?? "Đi tiếp", to: k.to } : null;
}

/**
 * The choices offered instead of the section's fight: when a `force` one holds ("if you have lost the
 * use of one arm, you cannot fight"), only the forced ones, and the fight itself is not offered.
 */
export function insteadChoices(sec: Section, s: AdvState, book?: Book): { list: Choice[]; barred: boolean } {
  const all = sec.combat?.instead ?? [];
  const forced = all.filter((c) => c.force && check(s, c.if, book));
  return forced.length ? { list: forced, barred: true } : { list: all.filter((c) => !c.force), barred: false };
}

/** "If you have X, go to Y": those choices take precedence over the section's random pick. */
export function forcedChoices(sec: Section, s: AdvState) {
  return (sec.choices ?? []).filter((c) => c.force && check(s, c.if));
}

/** Choices shown in the section (forced ones alone when one applies). */
export function visibleChoices(sec: Section, s: AdvState) {
  const skip = skipChoice(sec, s);
  if (skip) return [skip];
  const forced = forcedChoices(sec, s);
  if (forced.length) return forced;
  // a repeatable choice with pick-limited loot opens it once per visit
  return (sec.choices ?? []).filter((c) => !c.force && !(c.repeat && c.pickMax && s.pickLeft?.[choicePickGroup(c)] !== undefined));
}

/**
 * The player's answer to a riddle choice: the section to go to (the right answer is the choice's
 * own `to`), or null to stay in the section (wrong, and no `fail`).
 */
export function answerRiddle(c: Choice, answer: string | number): string | null {
  const a = String(answer).trim();
  if (/^\d+$/.test(a) && Number(a) === Number(c.to)) return c.to;
  return c.fail ?? null;
}

/** Numbers each player picks in a dice-comparison game, and how many opponents there are. */
export const compareShape = (g: CompareGame) => ({ picks: Math.max(1, g.picks ?? 2), opponents: Math.max(1, g.opponents ?? 1) });

/**
 * How many random numbers a table adds together (a section's, or a choice's game of chance). A
 * dice-comparison game: all the numbers picked, every opponent's and then the hero's.
 */
export function randomPicks(x: Section | ChoiceRoll): number {
  if ("compare" in x) { const g = compareShape(x.compare); return g.picks * (g.opponents + 1); }
  return Math.max(1, ("out" in x ? x : x.random)?.picks ?? 1);
}

/** Picks the random number(s) 0-9 of a section's table or of a game of chance (picks of them). */
export const rollRandom = (x: Section | ChoiceRoll, rng: Rng = Math.random) => Array.from({ length: randomPicks(x) }, () => pick10(rng));

/**
 * The outcome of a dice-comparison game for the numbers picked (in `rollRandom` order: each
 * opponent's picks in turn, then the hero's). Missing numbers count 0.
 */
export function compareResult(book: Book, g: CompareGame, s: AdvState, nums: number[]) {
  const { picks, opponents } = compareShape(g);
  const part = (i: number) => Array.from({ length: picks }, (_, j) => nums[i * picks + j] ?? 0);
  const foes = Array.from({ length: opponents }, (_, i) => part(i));
  const hero = part(opponents);
  const sum = (ns: number[]) => ns.reduce((a, x) => a + x, 0);
  const add = (g.mods ?? []).reduce((a, m) => a + (check(s, m.if, book) ? m.add : 0), 0);
  const heroTotal = sum(hero) + add;
  const foeTotals = foes.map(sum);
  // all noughts ("Bullseyes!") beat any total
  const score = (ns: number[], total: number) => (g.zerosWin && ns.every((x) => x === 0) ? Infinity : total);
  const mine = score(hero, heroTotal);
  const best = Math.max(...foes.map((ns, i) => score(ns, foeTotals[i])));
  const result: "win" | "tie" | "lose" = mine > best ? "win" : mine < best ? "lose" : "tie";
  const o = g[result] ?? {};
  return { result, hero, foes, add, heroTotal, foeTotals, to: o.to ?? "", end: o.end, fx: o.fx };
}

/**
 * The section's random table being played: its own, or a nested one (`out[].then`, "if you are stuck,
 * pick another number") the earlier picks of this visit led to.
 */
export function sectionRandom(sec: Section, s: Pick<AdvState, "randomAt">): RandomPick {
  let r = sec.random!;
  for (const i of s.randomAt ?? []) { const nx = r.out[i]?.then; if (!nx) break; r = nx; }
  return r;
}

/**
 * The random number(s) picked for the section's table (summed), with modifiers, and where it leads.
 * `next`: the range picked leads to another pick here (`then`): call `pickAgain` with it.
 */
export function randomResult(book: Book, sec: Section, s: AdvState, nums: number | number[]) {
  return tableResult(book, sectionRandom(sec, s), s, nums);
}

/** After a result with `next`: the section's next pick is that nested table. */
export function pickAgain(s: AdvState, next: number) {
  s.randomAt = [...(s.randomAt ?? []), next];
}

/** The hero's COMBAT SKILL outside a fight: basic score, Lore-circles and the whole-book changes. */
export const csNow = (book: Book, s: AdvState) => baseCs(book, s) + s.csBook;

/**
 * The bow the hero shoots with (random.bow): the best of their own (Bow weapons, Special Items that
 * count as a Bow), else a borrowed one ("Bow"); and what it adds to the number picked.
 */
export function bowShot(book: Book, s: AdvState): { bow: string; own: boolean; add: number } {
  const bows = [...s.weapons, ...s.special].filter((id) => weaponKind(book, s, id) === "Bow");
  const roll = (id: string) => (itemOn(book, s, id) ? itemDef(book, s, id)?.bowRoll ?? 0 : 0);
  const best = bows.reduce<string | null>((a, id) => (a === null || roll(id) > roll(a) ? id : a), null);
  const p = profile(book).weapon;
  let add = best ? roll(best) : 0;
  if (masters(s, "Bow") && s.disciplines.includes(p.disc)) add += p.bonus;
  // Mentora: Weaponmastery makes every missile weapon more accurate
  if (mkRank(book, s) >= MK.mentora && s.disciplines.includes(p.disc)) add += 2;
  return { bow: best ?? "Bow", own: !!best, add };
}

/** Is one of the numbers picked one that `onNumber` names (its condition holding)? */
export function numberHit(s: AdvState, o: OnNumber, nums: number[], book?: Book): boolean {
  const want = Array.isArray(o.n) ? o.n : [o.n];
  return nums.some((x) => want.includes(x)) && check(s, o.if, book);
}

/** The outcome of a random number table for the number(s) picked. */
export function tableResult(book: Book, r: RandomPick, s: AdvState, nums: number | number[]) {
  const n = typeof nums === "number" ? nums : nums.reduce((a, x) => a + x, 0);
  let add = (r.mods ?? []).reduce((a, m) => a + (check(s, m.if, book) ? m.add : 0), 0);
  if (r.bow) add += bowShot(book, s).add;
  // "if your total is equal to or less than your COMBAT SKILL": the ranges read total − COMBAT SKILL
  const vs = r.vs === "cs" ? csNow(book, s) : 0;
  const v = n + add - vs;
  // "if you pick a 0 at any time…": one of the numbers picked leads elsewhere, whatever the total
  if (r.onNumber && numberHit(s, r.onNumber, typeof nums === "number" ? [nums] : nums, book)) return { n, add, vs, value: v, to: r.onNumber.to, end: undefined, fx: undefined, onNumber: true, next: undefined };
  const i0 = r.out.findIndex((o) => v >= o.min && v <= o.max);
  const i = i0 >= 0 ? i0 : v < r.out[0].min ? 0 : r.out.length - 1;
  const out = r.out[i];
  return { n, add, vs, value: v, to: out.to ?? "", end: out.end, fx: out.fx, onNumber: false, next: out.then ? i : undefined };
}

/**
 * Plays a choice's game of chance (Cartwheel, Portholes...): pays its fx (the stake), then applies
 * the outcome of the number(s) picked. `to` is where the outcome leads ("" = stay in the section).
 */
export function playChoice(book: Book, s: AdvState, c: Choice, nums: number | number[]) {
  const changes = c.fx ? apply(book, s, c.fx) : [];
  const r = c.roll!;
  if ("compare" in r) {
    // a dice-comparison game: the hero's total against the opponents'
    const cmp = compareResult(book, r.compare, s, typeof nums === "number" ? [nums] : nums);
    if (cmp.fx) changes.push(...apply(book, s, cmp.fx));
    if (cmp.end) s.ended = cmp.end;
    return { n: cmp.heroTotal - cmp.add, add: cmp.add, value: cmp.heroTotal, to: cmp.to, end: cmp.end, fx: cmp.fx, changes, compare: cmp };
  }
  const res = tableResult(book, r, s, nums);
  if (res.fx) changes.push(...apply(book, s, res.fx));
  if (res.end) s.ended = res.end;
  return { ...res, changes, compare: undefined };
}

export function eatMeal(book: Book, s: AdvState): Change[] {
  if (s.meals <= 0 || s.ep >= epMax(book, s)) return [];
  s.meals--;
  return [{ kind: "meal", label: "Ăn 1 Phần Ăn", good: true, item: "Meal" }];
}

/** Healing Potion and the like: usable outside combat. */
export function useItem(book: Book, s: AdvState, id: string, rng: Rng = Math.random): Change[] {
  const it = itemDef(book, s, id);
  if (it?.use && has(s, id)) return useDose(book, s, id, it, rng);
  const cure = !!s.bleed?.cure.includes(id);
  if (!it?.heal || !has(s, id) || (s.ep >= epMax(book, s) && !cure) || s.noPotions) return [];
  takeDose(book, s, id, it);
  if (s.bleed?.cure.includes(id)) delete s.bleed;
  const left = has(s, id) && (it.uses ?? 1) > 1 ? dosesLeft(book, s, id) : 0;
  return [{ kind: "item", label: `Dùng ${it.name}${left ? ` (còn ${left} lần)` : ""}`, good: true, item: id }, ...changeEp(book, s, it.heal)];
}

/** Can the item be used now (a potion when hurt, a fight drug at any time)? */
export function usable(book: Book, s: AdvState, id: string): boolean {
  const it = itemDef(book, s, id);
  if (!it || !has(s, id) || s.ended) return false;
  return !!it.use || (!!it.heal && (s.ep < epMax(book, s) || !!s.bleed?.cure.includes(id)) && !s.noPotions);
}

/** Flag set once the hero is addicted to an item (Adgana). */
export const addictFlag = (id: string) => `addict:${id}`;

/** A fight drug: COMBAT SKILL for the next fight; the first doses may make the hero addicted. */
function useDose(book: Book, s: AdvState, id: string, it: ItemDef, rng: Rng): Change[] {
  const u = it.use!;
  const hooked = !!s.flags[addictFlag(id)];
  takeDose(book, s, id, it);
  const cs = hooked && u.addict ? u.addict.cs : u.cs;
  s.csNext += cs;
  const out: Change[] = [{ kind: "item", label: `Dùng ${it.name}`, good: true, item: id }, { kind: "cs", label: `Kỹ Năng Chiến Đấu +${cs} (trận tới)`, good: true }];
  if (u.addict && !hooked) {
    const n = pick10(rng);
    if (n >= u.addict.roll[0] && n <= u.addict.roll[1]) {
      s.flags[addictFlag(id)] = true;
      s.epBase += u.addict.epBase;
      s.ep = Math.max(0, Math.min(s.ep, epMax(book, s)));
      out.push({ kind: "ep", label: `Nghiện ${it.name}: Sức Bền tối đa ${u.addict.epBase}`, good: false });
      if (s.ep <= 0) s.ended = "death";
    }
  }
  return out;
}

/** Takes up an offer of the section: an item, some gold, or picks what to give up. */
export function takeOffer(book: Book, s: AdvState, i: number, choice?: string): Change[] {
  const o: Offer | undefined = s.offers[i];
  if (!o || !offerOpen(s, o)) return [];
  // pick-limited loot: the first take of an offer counts against its group
  const count = () => { if (o.group && !o.picked) { o.picked = true; s.pickLeft![o.group] = Math.max(0, (s.pickLeft?.[o.group] ?? 0) - 1); } };
  if ("gold" in o) { s.offers.splice(i, 1); count(); return changeGold(s, o.gold); }
  if ("lune" in o) { s.offers.splice(i, 1); count(); return changeLune(s, o.lune); }
  if ("loseChoice" in o) {
    if (!choice || !losePool(book, s, o.loseChoice, o.except).includes(choice)) return [];
    if (o.into) {
      // staked / handed over: kept under that name, to be given back by `unstash`
      const lists: Entry["list"][] = o.loseChoice === "weapon" ? ["weapon"] : o.loseChoice === "special" ? ["special"] : o.loseChoice === "backpack" ? ["backpack", "meal"] : ["weapon", "backpack", "meal"];
      const x = entriesOf(book, s, choice, Infinity).find((e) => lists.includes(e.list));
      if (!x) return [];
      removeEntries(book, s, [x], o.into);
    } else if (!drop(book, s, choice)) return [];
    o.n--;
    if (o.n <= 0) s.offers.splice(i, 1);
    return [{ kind: "item", label: `${o.into ? "Giao" : "Mất"} ${itemName(book, choice)}`, good: false, item: choice }];
  }
  freshDoses(s, o.gain);
  const left = give(book, s, o.gain, o.type, o.n);
  const got = o.n - left;
  if (got > 0) count();
  if (left > 0) o.n = left;
  else s.offers.splice(i, 1);
  return got ? [{ kind: o.type === "meal" ? "meal" : "item", label: `Nhận ${itemName(book, o.gain)}${got > 1 ? ` ×${got}` : ""}`, good: true, item: o.gain }] : [];
}

/** Offers that must be settled before moving on (giving something up is not optional). */
export const pendingLoss = (s: AdvState) => s.offers.some((o) => "loseChoice" in o);

// ------------------------------------------------------------------ combat

export interface Foe {
  def: FoeDef;
  ep: number;
}

export interface Battle {
  foes: Foe[];
  idx: number;
  round: number;
  /** Mind attack in use: index into the profile's `mind` list, or -1. */
  mind: number;
  over?: "win" | "lose" | "evaded" | "timeout" | "beaten" | "hurt" | "stopped" | "number" | "rolled";
  compare?: "more" | "less" | "equal";
  /** ENDURANCE the hero lost in this fight. */
  lost: number;
  /** A contest on points of its own (combat.heroEp): the hero's points left, and at the start. */
  pool?: number;
  poolMax?: number;
  /** ENDURANCE when the fight started (for restoreHalf "fight"). */
  ep0?: number;
  /** Under water (combat.breath): rounds the hero can hold his breath (picked as the fight starts), and the number picked. */
  breath?: number;
  breathN?: number;
  /** combat.heroLossRoll: where the last number picked instead of a wound leads (`to`). */
  rollTo?: string;
}

/** The foes met in this fight: `if` holding, and those met before (`keep`) with the ENDURANCE they had left. */
export function fightFoes(s: AdvState, c: Combat, book?: Book): Foe[] {
  const all = c.foes.filter((def) => check(s, def.if, book)).map((def) => ({ def, ep: def.keep && s.foesLeft?.[def.keep] !== undefined ? s.foesLeft[def.keep] : def.ep }));
  const alive = all.filter((f) => f.ep > 0);
  return alive.length ? alive : all.length ? all.map((f) => ({ ...f, ep: Math.max(1, f.ep) })) : c.foes.map((def) => ({ def, ep: def.ep }));
}

export function startBattle(book: Book, s: AdvState, sec: Section, rng: Rng = Math.random): Battle {
  const c = sec.combat!;
  const avail = mindAllowed(c) ? mindChoices(book, s)[0] ?? -1 : -1;
  const b: Battle = { foes: fightFoes(s, c, book), idx: 0, round: 0, mind: avail, lost: 0, ep0: s.ep };
  if (c.heroEp !== undefined) b.pool = b.poolMax = Math.max(1, c.heroEp === "ep" ? s.ep : c.heroEp);
  // under water: the rounds the hero can hold his breath (0 = 10)
  if (c.breath) { const n = pick10(rng); b.breathN = n; b.breath = Math.max(0, (n || 10) + (c.breath.mods ?? []).reduce((a, m) => a + (check(s, m.if, book) ? m.add : 0), 0)); }
  return b;
}

/**
 * The fight is over: next-fight changes are spent, potions may be drunk again, what it took is
 * remembered (restoreHalf "fight") and so is what is left of foes met again (`keep`).
 */
function fightOver(s: AdvState, b: Battle) {
  s.fought = true;
  s.csNext = 0;
  delete s.noPotions;
  s.lastFight = { lost: b.pool !== undefined ? 0 : Math.max(0, (b.ep0 ?? s.ep) - (b.over === "beaten" ? 0 : s.ep)), beaten: b.over === "beaten" && b.pool === undefined };
  for (const f of b.foes) if (f.def.keep) (s.foesLeft ??= {})[f.def.keep] = Math.max(0, f.ep);
}

/** The hero's bar in a fight: ENDURANCE, or the points of a contest (combat.heroEp). */
export const heroPoints = (book: Book, s: AdvState, b: Battle) => (b.pool !== undefined ? { ep: b.pool, max: b.poolMax ?? b.pool } : { ep: s.ep, max: epMax(book, s) });

export interface CsBreakdown {
  total: number;
  parts: { label: string; v: number }[];
}

/**
 * Is the foe immune to this mind attack? "mind" blocks them all; otherwise the attack's own name:
 * "mindblast" (Mindblast and the weak form of Psi-surge / Kai-surge), "psisurge", "kaisurge".
 */
export const mindBlocked = (foe: FoeDef, m: MindOpt) => (foe.immune ?? []).some((x) => x === "mind" || x === (m.as ?? m.disc));

/** The mind attack that works this round against the foe (none when immune or not allowed). */
export function mindUsed(book: Book, s: AdvState, c: Combat, foe: FoeDef, idx: number) {
  const m = activeMind(book, s, idx);
  return m && mindAllowed(c) && !mindBlocked(foe, m) ? m : null;
}

/** How many times the ENDURANCE the hero loses counts in this fight right now (combat.heroLossMul: 2, 3, or 0.5). */
export const heroLossMul = (s: AdvState, c: Combat) => (c.heroLossMul && check(s, c.heroLossMul.if) ? c.heroLossMul.n : 1);

/** ENDURANCE lost from the Combat Results Table after heroLossMul (halving rounds down). */
export const scaledHeroLoss = (s: AdvState, c: Combat, hl: number) => Math.floor(hl * heroLossMul(s, c));

/** Is `round` (0 = the first) one of the fight's firstRound rounds, its condition holding? */
export const inFirstRounds = (s: AdvState, c: Combat, round: number) => !!c.firstRound && round < (c.firstRound.rounds ?? 1) && check(s, c.firstRound.if);

/** Mind attacks add nothing in a psychic duel (combat.heroCs) or where the book forbids them. */
export const mindAllowed = (c: Combat) => !c.noMindblast && c.heroCs === undefined && c.heroEp === undefined;

/**
 * How many times a mind attack's COMBAT SKILL bonus counts in this fight: the first `mindBonusMulIf`
 * entry that holds, else `mindBonusMul` (the Taan-spider triples it), else 1.
 */
export function mindBonusMulOf(c: Combat, s?: AdvState, book?: Book): number {
  const hit = s ? c.mindBonusMulIf?.find((x) => check(s, x.if, book)) : undefined;
  return hit ? hit.n : c.mindBonusMul ?? 1;
}

/** COMBAT SKILL a mind attack adds in this fight (combat.mindBonusMul / mindBonusMulIf). */
export const mindCs = (c: Combat, m: MindOpt, s?: AdvState, book?: Book) => m.cs * mindBonusMulOf(c, s, book);

/** Mind attacks as the hero's rank has them (Archmaster: Psi-surge +6 for 1 ENDURANCE, down to 5; Mindblast +3). */
export function mindOpts(book: Book, s: AdvState): MindOpt[] {
  const list = profile(book).mind;
  if (mkRank(book, s) < MK.archmaster) return list;
  return list.map((o) => (o.disc !== "psisurge" ? o : o.as ? { ...o, cs: 3 } : { ...o, cs: 6, cost: 1, minEp: 5 }));
}

/** Indexes of the mind attacks the hero knows (the fight's mind toggle cycles through them). */
export const mindChoices = (book: Book, s: AdvState) => mindOpts(book, s).map((o, i) => (knows(s, o.disc) ? i : -1)).filter((i) => i >= 0);

/**
 * The mind attack used this round for the one chosen: itself, or its weaker form when ENDURANCE is
 * too low for it (Psi-surge at 6 or below becomes Mindblast). Null when none.
 */
export function activeMind(book: Book, s: AdvState, idx: number): (MindOpt & { i: number }) | null {
  const list = mindOpts(book, s);
  const o = list[idx];
  if (!o || !knows(s, o.disc)) return null;
  let i = idx;
  while (list[i].minEp && s.ep < list[i].minEp!) {
    i++;
    if (!list[i] || list[i].disc !== o.disc) return null;
  }
  return { ...list[i], i };
}

const MIND_NAMES: Partial<Record<Disc, string>> = { mindblast: "Tâm Lực Kích", psisurge: "Psi-surge", kaisurge: "Kai-surge" };
export const mindName = (book: Book, o: MindOpt) => book.names.disc[o.as ?? o.disc] ?? MIND_NAMES[o.as ?? o.disc] ?? o.as ?? o.disc;

/** Weapons and items this fight does not allow (combat.forbid: by item key or weapon kind; "all": every one). */
const forbidden = (book: Book, s: AdvState, c: Combat | undefined, id: string) => !!c?.forbid?.some((f) => f === "all" || f === id || f === weaponKind(book, s, id));

/**
 * Weapons usable in this fight, the Sommerswerd first. With `round` (0 = the first), none in the
 * firstRound rounds the hero must fight unarmed. combat.unarmedUnless "weaponLike": only weapon-like
 * Special Items (no Bow).
 */
export function fightWeapons(book: Book, s: AdvState, c?: Combat, round?: number): string[] {
  if (c && round !== undefined && c.firstRound?.unarmed && inFirstRounds(s, c, round)) return [];
  // a borrowed weapon (combat.weapon) is the only one used
  if (c?.weapon) return [c.weapon];
  const pool = c?.unarmedUnless === "weaponLike" ? s.special.filter((id) => weaponLike(book, s, id) && weaponKind(book, s, id) !== "Bow") : meleeWeapons(book, s);
  return pool.filter((id) => !forbidden(book, s, c, id));
}

/** COMBAT SKILL a weapon gives in hand: Weaponskill / Weaponmastery with its kind, and its own bonus (Sommerswerd +8). */
function weaponWorth(book: Book, s: AdvState, id: string): number {
  const p = profile(book).weapon;
  const mastery = s.disciplines.includes(p.disc) && masters(s, weaponKind(book, s, id)) ? p.bonus : 0;
  return mastery + (s.special.includes(id) && weaponLike(book, s, id) && itemOn(book, s, id) ? itemDef(book, s, id)?.cs ?? 0 : 0);
}

/**
 * The weapon in hand: in a fight (`c`), the borrowed one or the best one usable (the Sommerswerd
 * first); out of a fight, the one the player chose for this section (`wield`), else the same best one.
 * Null when bare-handed.
 */
export function wielded(book: Book, s: AdvState, c?: Combat, round?: number): string | null {
  const pool = fightWeapons(book, s, c, round);
  if (!c && s.wield && pool.includes(s.wield)) return s.wield;
  let best: string | null = null;
  for (const id of pool) if (best === null || weaponWorth(book, s, id) > weaponWorth(book, s, best)) best = id;
  return best;
}

/** The weapon in hand for a condition (`wields`); without the book, the chosen one or the first weapon. */
const inHand = (s: AdvState, book?: Book) => (book ? wielded(book, s) : s.wield ?? s.weapons[0] ?? null);

/** Does the section ask which weapon the hero is using (conditions `wields` / `wieldsMastered`)? */
export function asksWield(sec: Section): boolean {
  const on = (c: Cond | undefined): boolean => !!c && ("wields" in c || "wieldsMastered" in c || ("all" in c && c.all.some(on)) || ("any" in c && c.any.some(on)));
  const mods = (m?: { if?: Cond }[]) => (m ?? []).some((x) => on(x.if));
  return mods(sec.random?.mods) || (sec.choices ?? []).some((c) => on(c.if) || (!!c.roll && ("compare" in c.roll ? mods(c.roll.compare.mods) : mods(c.roll.mods))));
}

export function weaponBonus(book: Book, s: AdvState, c?: Combat, round?: number): { label: string; v: number } | null {
  const p = profile(book).weapon;
  if (!s.disciplines.includes(p.disc)) return null;
  const w0 = wielded(book, s, c, round);
  const w = w0 && masters(s, weaponKind(book, s, w0)) ? w0 : null;
  // Scion-kai: +4 instead of +3 with a mastered weapon
  const v = p.bonus + (mkRank(book, s) >= MK.scion ? 1 : 0);
  return w ? { label: `${book.names.disc[p.disc]} (${itemName(book, w, s)})`, v } : null;
}

/** Fighting bare-handed: −4 (Weaponmastery: −2 from Tutelary, −1 from Scion-kai). */
export function unarmedPenalty(book: Book, s: AdvState) {
  const r = s.disciplines.includes("weaponmastery") ? mkRank(book, s) : 0;
  return r >= MK.scion ? -1 : r >= MK.tutelary ? -2 : -4;
}

/** Hero COMBAT SKILL for this fight, with its parts (shown on the battle screen). */
export function heroCs(book: Book, s: AdvState, c: Combat, foe: FoeDef, mind = -1, round = 0): CsBreakdown {
  // a psychic duel: the book sets the hero's COMBAT SKILL; only the fight's own modifiers add to it
  const duel = c.heroCs !== undefined;
  const parts: { label: string; v: number }[] = [duel ? { label: "Đấu tâm lực", v: c.heroCs! } : { label: "Cơ bản", v: s.cs }];
  if (!duel) {
    for (const lc of loreCircles(book, s)) if (lc.cs) parts.push({ label: lc.name, v: lc.cs });
    if (!fightWeapons(book, s, c, round).length) parts.push({ label: "Tay không", v: unarmedPenalty(book, s) });
    else { const w = weaponBonus(book, s, c, round); if (w) parts.push(w); }
  }
  const first = inFirstRounds(s, c, round);
  if (first && c.firstRound!.cs) parts.push({ label: round ? `Hiệp ${round + 1}` : "Hiệp đầu", v: c.firstRound!.cs });
  const amb = profile(book).ambush;
  if (c.ambush && !(amb && s.disciplines.includes(amb))) parts.push({ label: "Bị đánh úp", v: c.ambush });
  const m = mindUsed(book, s, c, foe, mind);
  if (m) { const k = mindBonusMulOf(c, s, book); parts.push({ label: `${mindName(book, m)}${k !== 1 ? ` ×${k}` : ""}${m.cost ? ` (−${m.cost} Sức Bền/hiệp)` : ""}`, v: mindCs(c, m, s, book) }); }
  if (!duel) {
    // a weapon-like Special Item adds its COMBAT SKILL only as the weapon in hand (not beside a borrowed one)
    const hand = wielded(book, s, c, round);
    for (const id of s.special) {
      const cs = itemDef(book, s, id)?.cs;
      if (cs && itemOn(book, s, id) && !forbidden(book, s, c, id) && (!weaponLike(book, s, id) || id === hand)) parts.push({ label: itemName(book, id, s), v: cs });
    }
  }
  if (c.mods?.cs) parts.push({ label: "Hoàn cảnh", v: c.mods.cs });
  for (const m2 of c.csIf ?? []) if (round + 1 >= (m2.fromRound ?? 1) && check(s, m2.if, book)) parts.push({ label: "Hoàn cảnh", v: m2.add });
  if (foe.heroCs) parts.push({ label: "Đồng minh", v: foe.heroCs });
  if (!duel && s.csNext) parts.push({ label: "Tạm thời", v: s.csNext });
  if (!duel && s.csBook) parts.push({ label: "Cả cuốn", v: s.csBook });
  return { total: parts.reduce((a, p) => a + p.v, 0), parts };
}

/** Ratio column of the Combat Results Table: ≤-11, -10/-9, … , -2/-1, 0, 1/2, … , 9/10, ≥11. */
export function crtColumnOf(ratio: number) {
  if (ratio <= -11) return 0;
  if (ratio >= 11) return 12;
  if (ratio === 0) return 6;
  if (ratio < 0) return 6 - Math.ceil(-ratio / 2);
  return 6 + Math.ceil(ratio / 2);
}

export interface RoundResult {
  n: number;
  ratio: number;
  foe: number;
  foeLoss: number;
  heroLoss: number;
  mindCost: number;
  foeKilled: boolean;
  heroKilled: boolean;
  evaded: boolean;
  /** combat.heroLossRoll: the number picked instead of losing ENDURANCE this round. */
  lossRoll?: number;
  /** combat.breath: ENDURANCE lost for want of air this round. */
  air?: number;
}

/** One round against the current foe. `evade`: escape this round (the enemy's losses are ignored). */
export function playRound(book: Book, s: AdvState, b: Battle, evade = false, rng: Rng = Math.random): RoundResult {
  const c = book.sections[s.section].combat!;
  const foeIdx = b.idx;
  const foe = b.foes[foeIdx];
  // the mind attack in use this round (Psi-surge turns to Mindblast when ENDURANCE is too low)
  const am = mindUsed(book, s, c, foe.def, b.mind);
  const ratio = heroCs(book, s, c, foe.def, b.mind, b.round).total - foe.def.cs;
  const n = pick10(rng);
  // "if you pick a 0 at any time during this combat, turn to …": the round ends the fight, harmless
  if (c.onNumber && numberHit(s, c.onNumber, [n], book)) {
    b.round++;
    b.over = "number"; fightOver(s, b);
    return { n, ratio, foe: foeIdx, foeLoss: 0, heroLoss: 0, mindCost: 0, foeKilled: false, heroKilled: false, evaded: false };
  }
  const [fl, hl] = book.crt[n][crtColumnOf(ratio)];
  // "you lose no ENDURANCE in the first rounds" (firstRound.noHeroLoss): this round is spared
  const spared = !!c.firstRound?.noHeroLoss && inFirstRounds(s, c, b.round);
  const sommer = c.heroCs === undefined && wielded(book, s, c, b.round) === "Sommerswerd" && foe.def.undead;
  b.round++;
  const mindCost = am ? am.cost : 0;
  const hit = fl === KILL ? foe.ep : (fl + (c.foeExtraLoss ?? 0)) * (sommer ? 2 : 1) * (foe.def.double ? 2 : 1) * (am && c.mindMul ? c.mindMul : 1);
  const foeLoss = evade || (c.foeHoldLoss ?? 0) >= b.round ? 0 : hit;
  const held = (foe.def.holdRounds ?? 0) >= b.round;
  // under water: every round past the breath the hero could hold costs more
  const air = c.breath && b.breath !== undefined && b.round > b.breath ? c.breath.ep : 0;
  const drain = (c.heroDrain && check(s, c.heroDrain.if) ? c.heroDrain.ep : 0) + (c.mindforce && !knows(s, profile(book).shield) ? c.mindforce : 0) + air;
  const pts = b.pool !== undefined;
  let wound = held ? 0 : hl === KILL ? (pts ? b.pool! : s.ep) : scaledHeroLoss(s, c, hl);
  // "do not subtract them: pick a number instead" (the Javek's fangs on a padded arm)
  let lossRoll: number | undefined;
  if (c.heroLossRoll && wound > 0 && !spared) {
    lossRoll = pick10(rng);
    const o = c.heroLossRoll.out.find((x) => lossRoll! >= x.min && lossRoll! <= x.max);
    wound = o?.end === "death" ? (pts ? b.pool! : s.ep) : 0;
    if (o?.to) b.rollTo = o.to;
  }
  const heroLoss = spared ? mindCost : wound + mindCost + drain;
  if (!evade) foe.ep = Math.max(0, foe.ep - foeLoss);
  if (pts) {
    // a contest on points: they are lost instead of ENDURANCE; at 0 the contest is lost (combat.lose)
    b.pool = Math.max(0, b.pool! - heroLoss);
    b.lost += heroLoss;
    const foeKilled = !evade && foe.ep <= 0;
    if (b.pool <= 0) b.over = "beaten";
    else if (b.rollTo) b.over = "rolled";
    else if (evade) b.over = "evaded";
    else if (c.stopAt && foe.ep <= c.stopAt.foeEp) b.over = "stopped";
    else if (foeKilled) { if (b.idx < b.foes.length - 1) b.idx++; else b.over = "win"; }
    else if (c.maxRounds && b.round >= c.maxRounds.n) b.over = "timeout";
    if (b.over) fightOver(s, b);
    return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: foeKilled && b.over !== "beaten", heroKilled: false, evaded: evade, lossRoll, air };
  }
  s.ep = Math.max(0, s.ep - heroLoss);
  if (heroLoss > 0) s.hurt = true;
  // "If you lose any ENDURANCE, turn immediately to …"
  if (c.onHurt && heroLoss > 0 && s.ep > 0) { b.over = "hurt"; fightOver(s, b); return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: !evade && foe.ep <= 0, heroKilled: false, evaded: evade, lossRoll, air }; }
  b.lost += heroLoss;
  if (s.ep <= 0 && c.lose) { b.over = "beaten"; fightOver(s, b); s.ep = 1; return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: false, heroKilled: false, evaded: false, lossRoll, air }; }
  const heroKilled = s.ep <= 0;
  const foeKilled = !evade && foe.ep <= 0;
  if (heroKilled) b.over = "lose";
  else if (b.rollTo) b.over = "rolled";
  else if (evade) b.over = "evaded";
  else if (c.stopAt && foe.ep <= c.stopAt.foeEp) b.over = "stopped";
  else if (foeKilled) {
    if (b.idx < b.foes.length - 1) b.idx++;
    else b.over = "win";
  } else if (c.maxRounds && b.round >= c.maxRounds.n) b.over = "timeout";
  if (c.compare && !b.over) b.over = "timeout";
  if (c.compare) b.compare = heroLoss > foeLoss ? "more" : heroLoss < foeLoss ? "less" : "equal";
  if (b.over) fightOver(s, b);
  if (b.over === "win" && c.restoreHalf && b.lost > 0) s.ep = Math.min(epMax(book, s), s.ep + Math.floor(b.lost / 2));
  return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled, heroKilled, evaded: evade, lossRoll, air };
}

export function canEvade(book: Book, s: AdvState, b: Battle) {
  const e = book.sections[s.section].combat?.evade;
  if (!e || b.over || !check(s, e.if)) return false;
  // "if you kill the first guard, you can evade": only once that many foes are dead
  if (e.afterFoes && b.idx < e.afterFoes) return false;
  if (e.any || (e.anyIf && check(s, e.anyIf))) return true;
  return b.round >= (e.after ?? 0) && (e.until === undefined || b.round < e.until);
}

/** Where to go after the battle: a section id, "" to stay (choices/random follow), null = death. */
export function battleExit(book: Book, s: AdvState, b: Battle): string | null {
  const c = book.sections[s.section].combat!;
  if (b.over === "lose") { s.ended = "death"; return null; }
  if (b.over === "beaten") return c.lose ?? "";
  if (b.over === "hurt") return c.onHurt ?? "";
  if (b.over === "stopped") return c.stopAt?.to ?? "";
  if (b.over === "number") return c.onNumber?.to ?? "";
  if (b.over === "rolled") return b.rollTo ?? "";
  if (b.over === "win" && c.winBy) return b.round <= c.winBy.rounds ? c.winBy.fast : c.winBy.slow;
  if (b.over === "evaded") return c.evade?.to ?? "";
  if (c.compare && b.compare) return c.compare[b.compare];
  if (b.over === "timeout") return c.maxRounds?.to ?? "";
  if (c.onHurt && s.hurt) return c.onHurt;
  return c.win ?? "";
}

// ------------------------------------------------------------------ book checks

/** Sections a choice's game of chance can lead to. */
const rollLinks = (r: ChoiceRoll | undefined): (string | undefined)[] =>
  !r ? [] : "compare" in r ? [r.compare.win.to, r.compare.lose.to, r.compare.tie?.to] : r.out.map((o) => o.to);

/** Sections the nested picks of a random table lead to (`out[].then`). */
const randomLinks = (r: RandomPick | undefined): (string | undefined)[] => (r?.out ?? []).flatMap((o) => (o.then ? [o.then.onNumber?.to, ...o.then.out.map((x) => x.to), ...randomLinks(o.then)] : []));
const randomEnds = (r: RandomPick | undefined): boolean => (r?.out ?? []).some((o) => !!o.end || randomEnds(o.then));

/** Problems in a book package (used by the import screen and the tests). */
export function validateBook(book: Book): string[] {
  const errs: string[] = [];
  if (book.series !== "lw") errs.push("Không phải gói sách Lone Wolf");
  if (!book.sections?.[book.start]) errs.push(`Đoạn mở đầu §${book.start} không tồn tại`);
  if (!Array.isArray(book.crt) || book.crt.length !== 10 || book.crt.some((r) => r.length !== 13)) errs.push("Bảng Kết Quả Chiến Đấu không hợp lệ (cần 10 × 13 ô)");
  for (const [id, sec] of Object.entries(book.sections ?? {})) {
    const c = sec.combat;
    const links = [...[...(sec.choices ?? []), ...(c?.instead ?? [])].flatMap((x) => [x.to, x.fail]), ...(sec.random?.out ?? []).map((o) => o.to), ...(sec.choices ?? []).flatMap((x) => rollLinks(x.roll)),
      c?.win, c?.skipIf?.to, c?.lose, c?.winBy?.fast, c?.winBy?.slow, c?.evade?.to, ...(c?.evade?.alt ?? []).map((a) => a.to), c?.maxRounds?.to, c?.stopAt?.to, c?.onHurt, c?.compare?.more, c?.compare?.less, c?.compare?.equal, c?.onNumber?.to, sec.random?.onNumber?.to,
      ...randomLinks(sec.random), ...(c?.heroLossRoll?.out ?? []).map((o) => o.to)].filter((x): x is string => !!x);
    for (const t of links) if (!book.sections[t]) errs.push(`§${id} → §${t}: không có đoạn này`);
    if (!links.length && !sec.end && !randomEnds(sec.random)) errs.push(`§${id}: ngõ cụt`);
  }
  return errs;
}
