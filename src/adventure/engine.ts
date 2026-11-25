/** Lone Wolf rules of Adventure (Kai, Magnakai, Grand Master, New Order). Pure functions: no DOM. */
import type { AdvState, Book, Choice, Combat, Cond, Disc, Effect, FoeDef, ItemDef, ItemType, Offer, RandomPick, Section, Stash, StashPart } from "./types";
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
export const LORE_CIRCLES: { id: string; name: string; discs: Disc[]; cs: number; ep: number }[] = [
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

export function epMax(book: Book, s: AdvState) {
  return s.epBase + s.special.reduce((a, id) => a + (itemDef(book, s, id)?.epMax ?? 0), 0) + loreCircles(book, s).reduce((a, c) => a + c.ep, 0);
}

/** Holds a weapon: one in the weapon slots, or the Sommerswerd. */
export function armed(s: AdvState, book?: Book) {
  return s.weapons.length > 0 || s.special.some((id) => id === "Sommerswerd" || !!(book ? itemDef(book, s, id) : s.items?.[id])?.weapon);
}

/** The kind of weapon an item counts as (the Sommerswerd is a sword). */
export const weaponKind = (book: Book, s: AdvState, id: string) => itemDef(book, s, id)?.as ?? (id === "Sommerswerd" ? "Sword" : id);

/** Weapons usable hand to hand: a Bow is not (fighting with only a Bow is fighting bare-handed). */
export function meleeWeapons(book: Book, s: AdvState): string[] {
  const special = s.special.filter((id) => id === "Sommerswerd" || !!itemDef(book, s, id)?.weapon);
  return [...special, ...s.weapons].filter((id) => weaponKind(book, s, id) !== "Bow");
}

export function has(s: AdvState, id: string) {
  if (id === "Meal") return s.meals > 0;
  return s.weapons.includes(id) || s.backpack.includes(id) || s.special.includes(id);
}

export function room(s: AdvState, type: ItemType) {
  if (type === "weapon") return MAX_WEAPONS - s.weapons.length;
  if (type === "backpack" || type === "meal") return MAX_BACKPACK - s.backpack.length - s.meals;
  return Infinity;
}

/** Adds items as far as there is room; returns how many did not fit. */
export function give(book: Book, s: AdvState, id: string, type: ItemType, n = 1): number {
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
      return true;
    }
  }
  return false;
}

export function itemName(book: Book, id: string, s?: Pick<AdvState, "items">) {
  return id === "Meal" ? "Phần Ăn" : itemDef(book, s, id)?.name ?? id;
}

// ------------------------------------------------------------------ conditions & effects

export function check(s: AdvState, c: Cond | undefined): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => check(s, x));
  if ("any" in c) return c.any.some((x) => check(s, x));
  if ("notDisc" in c) return !knows(s, c.notDisc);
  if ("disc" in c) return knows(s, c.disc);
  if ("mastered" in c) return masters(s, c.mastered);
  if ("notItem" in c) return !has(s, c.notItem);
  if ("item" in c) return has(s, c.item);
  if ("goldBelow" in c) return s.gold < c.goldBelow;
  if ("gold" in c) return s.gold >= c.gold;
  if ("epBelow" in c) return s.ep < c.epBelow;
  if ("ep" in c) return s.ep >= c.ep;
  if ("notRank" in c) return rankOf(s) < c.notRank;
  if ("rank" in c) return rankOf(s) >= c.rank;
  if ("noWeapon" in c) return !armed(s);
  if ("armed" in c) return armed(s);
  if ("arrows" in c) return s.arrows >= c.arrows;
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
  if ("gold" in c) return `cần ${c.gold} Vương Miện Vàng`;
  if ("ep" in c) return `cần ${c.ep} Sức Bền`;
  if ("rank" in c) return `cần ${c.rank} kỹ năng`;
  if ("arrows" in c) return `cần ${c.arrows} mũi tên`;
  return "";
}

/** A choice the player can pick, one shown locked (a missing discipline...), or one not shown. */
export function choiceState(s: AdvState, c: { if?: Cond }): "ok" | "locked" | "hidden" {
  if (check(s, c.if)) return "ok";
  const negative = (x: Cond): boolean => "notDisc" in x || "goldBelow" in x || "notItem" in x || "notFlag" in x || "epBelow" in x || "notRank" in x || "noWeapon" in x || ("all" in x && x.all.some(negative)) || ("any" in x && x.any.every(negative));
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

export function apply(book: Book, s: AdvState, fx: Effect[] | undefined): Change[] {
  const out: Change[] = [];
  for (const e of fx ?? []) {
    const when = (e as { if?: Cond }).if;
    if (when && !check(s, when)) continue;
    if ("ep" in e) out.push(...changeEp(book, s, e.ep));
    else if ("epMax" in e) { s.epBase += e.epMax; out.push(...changeEp(book, s, e.epMax > 0 ? e.epMax : 0)); out.push({ kind: "ep", label: `Sức Bền tối đa ${e.epMax > 0 ? "+" : ""}${e.epMax}`, good: e.epMax > 0 }); }
    else if ("csBase" in e) { s.cs += e.csBase; out.push({ kind: "cs", label: `Kỹ Năng Chiến Đấu ${e.csBase > 0 ? "+" : ""}${e.csBase}`, good: e.csBase > 0 }); }
    else if ("cs" in e) {
      if (e.for === "book") s.csBook += e.cs;
      else s.csNext += e.cs;
      out.push({ kind: "cs", label: `Kỹ Năng Chiến Đấu ${e.cs > 0 ? "+" : ""}${e.cs}${e.for === "book" ? "" : " (trận tới)"}`, good: e.cs > 0 });
    } else if ("gold" in e) {
      if (e.optional && e.gold > 0) { s.offers.push({ gold: e.gold }); continue; }
      out.push(...changeGold(s, e.gold));
    } else if ("arrows" in e) {
      const before = s.arrows;
      s.arrows = Math.max(0, Math.min(has(s, "Quiver") ? 6 : 0, s.arrows + e.arrows));
      if (s.arrows !== before) out.push({ kind: "item", label: `Mũi tên ${s.arrows - before > 0 ? "+" : ""}${s.arrows - before}`, good: s.arrows > before, item: "Arrow" });
    } else if ("loseChoice" in e) {
      s.offers.push({ loseChoice: e.loseChoice, n: e.n ?? 1 });
    } else if ("gain" in e) {
      const n = e.n ?? 1;
      if (e.optional) { s.offers.push({ gain: e.gain, type: e.type, n, desc: e.desc }); continue; }
      const left = give(book, s, e.gain, e.type, n);
      if (n - left > 0) out.push({ kind: e.type === "meal" ? "meal" : "item", label: `Nhận ${itemName(book, e.gain)}${n - left > 1 ? ` ×${n - left}` : ""}`, good: true, item: e.gain });
      if (left > 0) s.offers.push({ gain: e.gain, type: e.type, n: left, desc: e.desc });
    } else if ("lose" in e) {
      const k = dropN(book, s, e.lose, e.n ?? 1);
      if (k) out.push({ kind: e.lose === "Meal" ? "meal" : "item", label: `Mất ${itemName(book, e.lose)}${k > 1 ? ` ×${k}` : ""}`, good: false, item: e.lose });
    } else if ("loseAll" in e) {
      const k = e.loseAll;
      if (k === "weapons" || k === "everything") s.weapons = [];
      if (k === "backpack" || k === "everything") { s.backpack = []; s.meals = 0; }
      if (k === "meals") s.meals = 0;
      if (k === "special" || k === "everything") { s.special = []; s.arrows = 0; }
      if (k === "gold" || k === "everything") s.gold = 0;
      s.ep = Math.min(s.ep, epMax(book, s));
      out.push({ kind: "item", label: k === "gold" ? "Mất hết Vương Miện Vàng" : k === "everything" ? "Mất toàn bộ hành trang" : k === "weapons" ? "Mất hết vũ khí" : k === "backpack" ? "Mất Ba Lô và mọi thứ trong đó" : k === "meals" ? "Mất hết Phần Ăn" : "Mất các Vật Phẩm Đặc Biệt", good: false });
    } else if ("eat" in e) {
      if (!e.noHunt && !s.flags.nohunt && s.disciplines.includes(profile(book).hunt)) out.push({ kind: "meal", label: `${book.names.disc[profile(book).hunt]}: tự kiếm được cái ăn`, good: true });
      else if (s.meals > 0) { s.meals--; out.push({ kind: "meal", label: "Ăn 1 Phần Ăn", good: true, item: "Meal" }); }
      else out.push({ kind: "meal", label: "Không có gì ăn", good: false }, ...changeEp(book, s, -3));
    } else if ("stash" in e) {
      const took = confiscate(book, s, e.only, !!e.weaponLike);
      s.stashes ??= {};
      const old = s.stashes[e.stash];
      // taking more under the same name adds to what is held there
      s.stashes[e.stash] = old ? { weapons: [...old.weapons, ...took.weapons], backpack: [...old.backpack, ...took.backpack], special: [...old.special, ...took.special],
        meals: old.meals + took.meals, gold: old.gold + took.gold, arrows: old.arrows + took.arrows } : took;
      out.push({ kind: "item", label: e.only || e.weaponLike ? "Bị tịch thu một phần hành trang" : "Bị tịch thu toàn bộ hành trang", good: false });
    } else if ("unstash" in e) {
      const st = s.stashes?.[e.unstash];
      if (st) {
        for (const w of st.weapons) give(book, s, w, "weapon");
        for (const b of st.backpack) give(book, s, b, "backpack");
        for (const x of st.special) give(book, s, x, "special");
        give(book, s, "Meal", "meal", st.meals);
        s.gold = Math.min(MAX_GOLD, s.gold + st.gold);
        s.arrows += st.arrows;
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

/**
 * Takes away the parts of the gear asked for (all of it by default) and returns exactly what was
 * taken. Meals go with the Backpack; Arrows go with the Quiver they are kept in.
 */
export function confiscate(book: Book, s: AdvState, only: StashPart[] | undefined, weaponLikeToo: boolean): Stash {
  const part = (p: StashPart) => !only || only.includes(p);
  const took: Stash = { weapons: [], backpack: [], special: [], meals: 0, gold: 0, arrows: 0 };
  if (part("weapons")) { took.weapons = s.weapons; s.weapons = []; }
  if (part("backpack")) { took.backpack = s.backpack; s.backpack = []; }
  if (part("backpack") || part("meals")) { took.meals = s.meals; s.meals = 0; }
  if (part("special")) { took.special = s.special; s.special = []; }
  else if (weaponLikeToo) { took.special = s.special.filter((id) => weaponLike(book, s, id)); s.special = s.special.filter((id) => !took.special.includes(id)); }
  if (part("gold")) { took.gold = s.gold; s.gold = 0; }
  if (part("arrows") || (took.special.includes("Quiver") && !s.special.includes("Quiver"))) { took.arrows = s.arrows; s.arrows = 0; }
  s.ep = Math.min(s.ep, epMax(book, s));
  return took;
}

function changeGold(s: AdvState, d: number): Change[] {
  const before = s.gold;
  s.gold = Math.max(0, Math.min(MAX_GOLD, s.gold + d));
  const real = s.gold - before;
  return real ? [{ kind: "gold", label: `${real > 0 ? "+" : ""}${real} Vương Miện Vàng`, good: real > 0, item: "Gold Crowns" }] : [];
}

// ------------------------------------------------------------------ moving through the book

/** Moves to a section and applies its effects once (a reload does not apply them again). */
export function enter(book: Book, s: AdvState, id: string): Change[] {
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
  if (!s.visited.includes(id)) s.visited.push(id);
  s.updated = Date.now();
  // an open wound bleeds every section until a Laumspur potion is drunk
  if (s.flags.bleeding) ch.push(...changeEp(book, s, -2).map((c) => ({ ...c, label: `${c.label} (vết thương chảy máu)` })));
  ch.push(...apply(book, s, sec.fx));
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
  if (sec.combat && !s.fought) return "combat";
  if (sec.random && !forcedChoices(sec, s).length) return "random";
  return "choices";
}

/** "If you have X, go to Y": those choices take precedence over the section's random pick. */
export function forcedChoices(sec: Section, s: AdvState) {
  return (sec.choices ?? []).filter((c) => c.force && check(s, c.if));
}

/** Choices shown in the section (forced ones alone when one applies). */
export function visibleChoices(sec: Section, s: AdvState) {
  const forced = forcedChoices(sec, s);
  if (forced.length) return forced;
  return (sec.choices ?? []).filter((c) => !c.force);
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

/** How many random numbers a table adds together (a section's, or a choice's game of chance). */
export const randomPicks = (x: Section | RandomPick) => Math.max(1, ("out" in x ? x : x.random)?.picks ?? 1);

/** Picks the random number(s) 0-9 of a section's table or of a game of chance (picks of them). */
export const rollRandom = (x: Section | RandomPick, rng: Rng = Math.random) => Array.from({ length: randomPicks(x) }, () => pick10(rng));

/** The random number(s) picked for the section's table (summed), with modifiers, and where it leads. */
export function randomResult(book: Book, sec: Section, s: AdvState, nums: number | number[]) {
  return tableResult(book, sec.random!, s, nums);
}

/** The outcome of a random number table for the number(s) picked. */
export function tableResult(book: Book, r: RandomPick, s: AdvState, nums: number | number[]) {
  const n = typeof nums === "number" ? nums : nums.reduce((a, x) => a + x, 0);
  let add = (r.mods ?? []).reduce((a, m) => a + (check(s, m.if) ? m.add : 0), 0);
  if (r.bow && s.weapons.some((w) => weaponKind(book, s, w) === "Bow")) {
    const p = profile(book).weapon;
    if (masters(s, "Bow")) add += p.bonus;
    // Mentora: Weaponmastery makes every missile weapon more accurate
    if (mkRank(book, s) >= MK.mentora && s.disciplines.includes(p.disc)) add += 2;
  }
  const v = n + add;
  const out = r.out.find((o) => v >= o.min && v <= o.max) ?? (v < r.out[0].min ? r.out[0] : r.out[r.out.length - 1]);
  return { n, add, value: v, to: out.to ?? "", end: out.end, fx: out.fx };
}

/**
 * Plays a choice's game of chance (Cartwheel, Portholes...): pays its fx (the stake), then applies
 * the outcome of the number(s) picked. `to` is where the outcome leads ("" = stay in the section).
 */
export function playChoice(book: Book, s: AdvState, c: Choice, nums: number | number[]) {
  const changes = c.fx ? apply(book, s, c.fx) : [];
  const res = tableResult(book, c.roll!, s, nums);
  if (res.fx) changes.push(...apply(book, s, res.fx));
  if (res.end) s.ended = res.end;
  return { ...res, changes };
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
  if (!it?.heal || !has(s, id) || s.ep >= epMax(book, s)) return [];
  drop(book, s, id);
  if (/laumspur/i.test(id)) delete s.flags.bleeding;
  return [{ kind: "item", label: `Dùng ${it.name}`, good: true, item: id }, ...changeEp(book, s, it.heal)];
}

/** Can the item be used now (a potion when hurt, a fight drug at any time)? */
export function usable(book: Book, s: AdvState, id: string): boolean {
  const it = itemDef(book, s, id);
  if (!it || !has(s, id) || s.ended) return false;
  return !!it.use || (!!it.heal && s.ep < epMax(book, s));
}

/** Flag set once the hero is addicted to an item (Adgana). */
export const addictFlag = (id: string) => `addict:${id}`;

/** A fight drug: COMBAT SKILL for the next fight; the first doses may make the hero addicted. */
function useDose(book: Book, s: AdvState, id: string, it: ItemDef, rng: Rng): Change[] {
  const u = it.use!;
  const hooked = !!s.flags[addictFlag(id)];
  drop(book, s, id);
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
  if (!o) return [];
  if ("gold" in o) { s.offers.splice(i, 1); return changeGold(s, o.gold); }
  if ("loseChoice" in o) {
    if (!choice || !drop(book, s, choice)) return [];
    o.n--;
    if (o.n <= 0) s.offers.splice(i, 1);
    return [{ kind: "item", label: `Mất ${itemName(book, choice)}`, good: false, item: choice }];
  }
  const left = give(book, s, o.gain, o.type, o.n);
  const got = o.n - left;
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
  over?: "win" | "lose" | "evaded" | "timeout" | "beaten" | "hurt" | "stopped";
  compare?: "more" | "less" | "equal";
  /** ENDURANCE the hero lost in this fight. */
  lost: number;
}

export function startBattle(book: Book, s: AdvState, sec: Section): Battle {
  const avail = mindChoices(book, s)[0] ?? -1;
  return { foes: sec.combat!.foes.map((def) => ({ def, ep: def.ep })), idx: 0, round: 0, mind: avail, lost: 0 };
}

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
  return m && !c.noMindblast && !mindBlocked(foe, m) ? m : null;
}

/** How many times the ENDURANCE the hero loses counts in this fight right now (combat.heroLossMul). */
export const heroLossMul = (s: AdvState, c: Combat) => (c.heroLossMul && check(s, c.heroLossMul.if) ? c.heroLossMul.n : 1);

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

/** Weapons this fight does not allow (combat.forbid: by item key or weapon kind). */
const forbidden = (book: Book, s: AdvState, c: Combat | undefined, id: string) => !!c?.forbid?.some((f) => f === id || f === weaponKind(book, s, id));

/** Weapons usable in this fight, the Sommerswerd first. */
export const fightWeapons = (book: Book, s: AdvState, c?: Combat) => meleeWeapons(book, s).filter((id) => !forbidden(book, s, c, id));

export function weaponBonus(book: Book, s: AdvState, c?: Combat): { label: string; v: number } | null {
  const p = profile(book).weapon;
  if (!s.disciplines.includes(p.disc)) return null;
  const w = fightWeapons(book, s, c).find((x) => masters(s, weaponKind(book, s, x)));
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
  const parts: { label: string; v: number }[] = [{ label: "Cơ bản", v: s.cs }];
  for (const lc of loreCircles(book, s)) if (lc.cs) parts.push({ label: lc.name, v: lc.cs });
  if (!fightWeapons(book, s, c).length) parts.push({ label: "Tay không", v: unarmedPenalty(book, s) });
  else { const w = weaponBonus(book, s, c); if (w) parts.push(w); }
  if (c.firstRound && round < (c.firstRound.rounds ?? 1) && check(s, c.firstRound.if)) parts.push({ label: round ? `Hiệp ${round + 1}` : "Hiệp đầu", v: c.firstRound.cs });
  const amb = profile(book).ambush;
  if (c.ambush && !(amb && s.disciplines.includes(amb))) parts.push({ label: "Bị đánh úp", v: c.ambush });
  const m = mindUsed(book, s, c, foe, mind);
  if (m) parts.push({ label: `${mindName(book, m)}${m.cost ? ` (−${m.cost} Sức Bền/hiệp)` : ""}`, v: m.cs });
  for (const id of s.special) {
    const cs = itemDef(book, s, id)?.cs;
    if (cs && !forbidden(book, s, c, id)) parts.push({ label: itemName(book, id, s), v: cs });
  }
  if (c.mods?.cs) parts.push({ label: "Hoàn cảnh", v: c.mods.cs });
  for (const m2 of c.csIf ?? []) if (check(s, m2.if)) parts.push({ label: "Hoàn cảnh", v: m2.add });
  if (s.csNext) parts.push({ label: "Tạm thời", v: s.csNext });
  if (s.csBook) parts.push({ label: "Cả cuốn", v: s.csBook });
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
  const [fl, hl] = book.crt[n][crtColumnOf(ratio)];
  b.round++;
  const mindCost = am ? am.cost : 0;
  const sommer = fightWeapons(book, s, c).includes("Sommerswerd") && foe.def.undead;
  const hit = fl === KILL ? foe.ep : (fl + (c.foeExtraLoss ?? 0)) * (sommer ? 2 : 1) * (foe.def.double ? 2 : 1) * (am && c.mindMul ? c.mindMul : 1);
  const foeLoss = evade || (c.foeHoldLoss ?? 0) >= b.round ? 0 : hit;
  const held = (foe.def.holdRounds ?? 0) >= b.round;
  const drain = (c.heroDrain && check(s, c.heroDrain.if) ? c.heroDrain.ep : 0) + (c.mindforce && !knows(s, profile(book).shield) ? c.mindforce : 0);
  const heroLoss = (held ? 0 : hl === KILL ? s.ep : hl * heroLossMul(s, c)) + mindCost + drain;
  if (!evade) foe.ep = Math.max(0, foe.ep - foeLoss);
  s.ep = Math.max(0, s.ep - heroLoss);
  if (heroLoss > 0) s.hurt = true;
  // "If you lose any ENDURANCE, turn immediately to …"
  if (c.onHurt && heroLoss > 0 && s.ep > 0) { b.over = "hurt"; s.fought = true; s.csNext = 0; return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: !evade && foe.ep <= 0, heroKilled: false, evaded: evade }; }
  b.lost += heroLoss;
  if (s.ep <= 0 && c.lose) { s.ep = 1; b.over = "beaten"; s.fought = true; s.csNext = 0; return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: false, heroKilled: false, evaded: false }; }
  const heroKilled = s.ep <= 0;
  const foeKilled = !evade && foe.ep <= 0;
  if (heroKilled) b.over = "lose";
  else if (evade) b.over = "evaded";
  else if (c.stopAt && foe.ep <= c.stopAt.foeEp) b.over = "stopped";
  else if (foeKilled) {
    if (b.idx < b.foes.length - 1) b.idx++;
    else b.over = "win";
  } else if (c.maxRounds && b.round >= c.maxRounds.n) b.over = "timeout";
  if (c.compare && !b.over) b.over = "timeout";
  if (c.compare) b.compare = heroLoss > foeLoss ? "more" : heroLoss < foeLoss ? "less" : "equal";
  if (b.over) { s.fought = true; s.csNext = 0; }
  if (b.over === "win" && c.restoreHalf && b.lost > 0) s.ep = Math.min(epMax(book, s), s.ep + Math.floor(b.lost / 2));
  return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled, heroKilled, evaded: evade };
}

export function canEvade(book: Book, s: AdvState, b: Battle) {
  const e = book.sections[s.section].combat?.evade;
  if (!e || b.over || !check(s, e.if)) return false;
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
  if (b.over === "win" && c.winBy) return b.round <= c.winBy.rounds ? c.winBy.fast : c.winBy.slow;
  if (b.over === "evaded") return c.evade?.to ?? "";
  if (c.compare && b.compare) return c.compare[b.compare];
  if (b.over === "timeout") return c.maxRounds?.to ?? "";
  if (c.onHurt && s.hurt) return c.onHurt;
  return c.win ?? "";
}

// ------------------------------------------------------------------ book checks

/** Problems in a book package (used by the import screen and the tests). */
export function validateBook(book: Book): string[] {
  const errs: string[] = [];
  if (book.series !== "lw") errs.push("Không phải gói sách Lone Wolf");
  if (!book.sections?.[book.start]) errs.push(`Đoạn mở đầu §${book.start} không tồn tại`);
  if (!Array.isArray(book.crt) || book.crt.length !== 10 || book.crt.some((r) => r.length !== 13)) errs.push("Bảng Kết Quả Chiến Đấu không hợp lệ (cần 10 × 13 ô)");
  for (const [id, sec] of Object.entries(book.sections ?? {})) {
    const c = sec.combat;
    const links = [...[...(sec.choices ?? []), ...(c?.instead ?? [])].flatMap((x) => [x.to, x.fail]), ...(sec.random?.out ?? []).map((o) => o.to),
      c?.win, c?.lose, c?.winBy?.fast, c?.winBy?.slow, c?.evade?.to, ...(c?.evade?.alt ?? []).map((a) => a.to), c?.maxRounds?.to, c?.stopAt?.to, c?.onHurt, c?.compare?.more, c?.compare?.less, c?.compare?.equal].filter((x): x is string => !!x);
    for (const t of links) if (!book.sections[t]) errs.push(`§${id} → §${t}: không có đoạn này`);
    if (!links.length && !sec.end && !(sec.random?.out ?? []).some((o) => o.end)) errs.push(`§${id}: ngõ cụt`);
  }
  return errs;
}
