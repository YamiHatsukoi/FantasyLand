/** Lone Wolf rules of Adventure (Kai, Magnakai, Grand Master, New Order). Pure functions: no DOM. */
import type { AdvState, Book, Combat, Cond, Disc, Effect, FoeDef, ItemType, Offer, Section } from "./types";
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
  /** Mind attacks: [discipline, COMBAT SKILL bonus, ENDURANCE cost per round]. */
  mind: [Disc, number, number][];
  heal: Disc;
  hunt: Disc;
  shield: Disc;
  sense: Disc;
}

export const PROFILES: Record<Book["rules"], Profile> = {
  kai: { weapon: { disc: "weaponskill", bonus: 2 }, mind: [["mindblast", 2, 0]], heal: "healing", hunt: "hunting", shield: "mindshield", sense: "sixthsense" },
  magnakai: { weapon: { disc: "weaponmastery", bonus: 3 }, mind: [["psisurge", 4, 2], ["psisurge", 2, 0]], heal: "curing", hunt: "huntmastery", shield: "psiscreen", sense: "divination" },
  grandmaster: { weapon: { disc: "grandweaponmastery", bonus: 5 }, mind: [["kaisurge", 8, 1], ["kaisurge", 4, 0]], heal: "deliverance", hunt: "grandhuntmastery", shield: "kaiscreen", sense: "telegnosis" },
  neworder: { weapon: { disc: "grandweaponmastery", bonus: 5 }, mind: [["kaisurge", 8, 1], ["kaisurge", 4, 0]], heal: "deliverance", hunt: "grandhuntmastery", shield: "kaiscreen", sense: "telegnosis" },
};

export const profile = (book: Book) => PROFILES[book.rules ?? "kai"];
export const discsOf = (book: Book): readonly Disc[] => DISCS_BY_RULES[book.rules ?? "kai"];

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

export function newRun(book: Book, h: NewHero): AdvState {
  const now = Date.now();
  const s: AdvState = {
    v: 2, book: book.id, name: h.name, section: book.start,
    cs: 10 + h.csRoll, ep: 0, epBase: 20 + h.epRoll,
    disciplines: [...h.disciplines],
    weaponskill: h.disciplines.includes("weaponskill") ? book.weaponskill[h.weaponskillRoll ?? 0] : undefined,
    mastered: h.mastered,
    weapons: [], backpack: [], special: [], meals: 0, arrows: 0,
    gold: book.kit.gold.add + (book.kit.gold.random ? h.goldRoll ?? 0 : 0),
    flags: {}, csNext: 0, csBook: 0, offers: [], fought: false,
    visited: [], steps: 0, created: now, updated: now,
  };
  for (const it of book.kit.items) give(book, s, it.gain, it.type, it.n ?? 1);
  book.kit.picks.forEach((p, i) => {
    for (const idx of h.picks[i] ?? []) {
      const o = p.options[idx];
      if (!o) continue;
      if ("gold" in o) s.gold = Math.min(MAX_GOLD, s.gold + o.gold);
      else give(book, s, o.gain, o.type, o.n ?? 1);
    }
  });
  s.ep = epMax(book, s);
  enter(book, s, book.start);
  return s;
}

/**
 * Continue with the hero of a finished earlier book (Lone Wolf rules): stats, disciplines,
 * gear, gold and flags carry over; one new discipline is learnt per finished book; the new
 * book's equipment offer is added on top (as far as there is room).
 */
export function continueRun(book: Book, prev: AdvState, h: { newDisc?: Disc; picks: number[][]; goldRoll?: number; weaponskillRoll?: number; mastered?: string[] }): AdvState {
  const now = Date.now();
  const s: AdvState = {
    ...JSON.parse(JSON.stringify(prev)) as AdvState,
    v: 2, book: book.id, section: book.start, csNext: 0, csBook: 0, offers: [], fought: false, hurt: false,
    visited: [], steps: 0, created: now, updated: now, ended: undefined, back: undefined,
  };
  // flags of the old book stay (later books ask "have you ever…"), cutscene marks do not
  for (const f of Object.keys(s.flags)) if (f.startsWith("cut:")) delete s.flags[f];
  if (h.newDisc && !s.disciplines.includes(h.newDisc)) s.disciplines.push(h.newDisc);
  if (h.newDisc === "weaponskill" && !s.weaponskill) s.weaponskill = book.weaponskill[h.weaponskillRoll ?? 0];
  if (h.mastered?.length) s.mastered = [...new Set([...(s.mastered ?? []), ...h.mastered])];
  s.gold = Math.min(MAX_GOLD, s.gold + book.kit.gold.add + (book.kit.gold.random ? h.goldRoll ?? 0 : 0));
  for (const it of book.kit.items) if (!has(s, it.gain)) give(book, s, it.gain, it.type, it.n ?? 1);
  book.kit.picks.forEach((p, i) => {
    for (const idx of h.picks[i] ?? []) {
      const o = p.options[idx];
      if (!o) continue;
      if ("gold" in o) s.gold = Math.min(MAX_GOLD, s.gold + o.gold);
      else give(book, s, o.gain, o.type, o.n ?? 1);
    }
  });
  s.ep = epMax(book, s); // a new adventure starts rested
  enter(book, s, book.start);
  return s;
}

// ------------------------------------------------------------------ items

export function epMax(book: Book, s: AdvState) {
  return s.epBase + s.special.reduce((a, id) => a + (book.items[id]?.epMax ?? 0), 0);
}

/** Holds a weapon: one in the weapon slots, or the Sommerswerd. */
export function armed(s: AdvState, book?: Book) {
  return s.weapons.length > 0 || s.special.some((id) => id === "Sommerswerd" || !!book?.items[id]?.weapon);
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

export function itemName(book: Book, id: string) {
  return id === "Meal" ? "Phần Ăn" : book.items[id]?.name ?? id;
}

// ------------------------------------------------------------------ conditions & effects

export function check(s: AdvState, c: Cond | undefined): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => check(s, x));
  if ("any" in c) return c.any.some((x) => check(s, x));
  if ("notDisc" in c) return !s.disciplines.includes(c.notDisc);
  if ("disc" in c) return s.disciplines.includes(c.disc);
  if ("notItem" in c) return !has(s, c.notItem);
  if ("item" in c) return has(s, c.item);
  if ("gold" in c) return s.gold >= c.gold;
  if ("epBelow" in c) return s.ep < c.epBelow;
  if ("ep" in c) return s.ep >= c.ep;
  if ("notRank" in c) return s.disciplines.length < c.notRank;
  if ("rank" in c) return s.disciplines.length >= c.rank;
  if ("noWeapon" in c) return !armed(s);
  if ("arrows" in c) return s.arrows >= c.arrows;
  if ("notFlag" in c) return !s.flags[c.notFlag];
  if ("flag" in c) return !!s.flags[c.flag];
  return true;
}

export function condText(book: Book, c: Cond | undefined): string {
  if (!c) return "";
  if ("all" in c) return c.all.map((x) => condText(book, x)).filter(Boolean).join(", ");
  if ("any" in c) return c.any.map((x) => condText(book, x)).filter(Boolean).join(" hoặc ");
  if ("disc" in c) return `cần ${book.names.disc[c.disc] ?? c.disc}`;
  if ("item" in c) return `cần ${itemName(book, c.item)}`;
  if ("gold" in c) return `cần ${c.gold} Vương Miện Vàng`;
  if ("ep" in c) return `cần ${c.ep} Sức Bền`;
  if ("rank" in c) return `cần ${c.rank} kỹ năng`;
  if ("arrows" in c) return `cần ${c.arrows} mũi tên`;
  return "";
}

/** A choice the player can pick, one shown locked (a missing discipline...), or one not shown. */
export function choiceState(s: AdvState, c: { if?: Cond }): "ok" | "locked" | "hidden" {
  if (check(s, c.if)) return "ok";
  const negative = (x: Cond): boolean => "notDisc" in x || "notItem" in x || "notFlag" in x || "epBelow" in x || "notRank" in x || "noWeapon" in x || ("all" in x && x.all.some(negative)) || ("any" in x && x.any.every(negative));
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
      if (drop(book, s, e.lose)) out.push({ kind: "item", label: `Mất ${itemName(book, e.lose)}`, good: false, item: e.lose });
    } else if ("loseAll" in e) {
      const k = e.loseAll;
      if (k === "weapons" || k === "everything") s.weapons = [];
      if (k === "backpack" || k === "everything") { s.backpack = []; s.meals = 0; }
      if (k === "special" || k === "everything") { s.special = []; s.arrows = 0; }
      if (k === "gold" || k === "everything") s.gold = 0;
      s.ep = Math.min(s.ep, epMax(book, s));
      out.push({ kind: "item", label: k === "gold" ? "Mất hết Vương Miện Vàng" : k === "everything" ? "Mất toàn bộ hành trang" : k === "weapons" ? "Mất hết vũ khí" : k === "backpack" ? "Mất Ba Lô và mọi thứ trong đó" : "Mất các Vật Phẩm Đặc Biệt", good: false });
    } else if ("eat" in e) {
      if (!e.noHunt && !s.flags.nohunt && s.disciplines.includes(profile(book).hunt)) out.push({ kind: "meal", label: `${book.names.disc[profile(book).hunt]}: tự kiếm được cái ăn`, good: true });
      else if (s.meals > 0) { s.meals--; out.push({ kind: "meal", label: "Ăn 1 Phần Ăn", good: true, item: "Meal" }); }
      else out.push({ kind: "meal", label: "Không có gì ăn", good: false }, ...changeEp(book, s, -3));
    } else if ("stash" in e) {
      s.stashes ??= {};
      s.stashes[e.stash] = { weapons: s.weapons, backpack: s.backpack, special: s.special, meals: s.meals, gold: s.gold, arrows: s.arrows };
      s.weapons = []; s.backpack = []; s.special = []; s.meals = 0; s.gold = 0; s.arrows = 0;
      s.ep = Math.min(s.ep, epMax(book, s));
      out.push({ kind: "item", label: "Bị tịch thu toàn bộ hành trang", good: false });
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

/** The random number picked for the section's table, with modifiers, and where it leads. */
export function randomResult(book: Book, sec: Section, s: AdvState, n: number) {
  const r = sec.random!;
  let add = (r.mods ?? []).reduce((a, m) => a + (check(s, m.if) ? m.add : 0), 0);
  if (r.bow && s.weapons.includes("Bow") && s.disciplines.includes(profile(book).weapon.disc)) add += profile(book).weapon.bonus;
  const v = n + add;
  const out = r.out.find((o) => v >= o.min && v <= o.max) ?? (v < r.out[0].min ? r.out[0] : r.out[r.out.length - 1]);
  return { n, add, value: v, to: out.to ?? "", end: out.end, fx: out.fx };
}

export function eatMeal(book: Book, s: AdvState): Change[] {
  if (s.meals <= 0 || s.ep >= epMax(book, s)) return [];
  s.meals--;
  return [{ kind: "meal", label: "Ăn 1 Phần Ăn", good: true, item: "Meal" }];
}

/** Healing Potion and the like: usable outside combat. */
export function useItem(book: Book, s: AdvState, id: string): Change[] {
  const it = book.items[id];
  if (!it?.heal || !has(s, id) || s.ep >= epMax(book, s)) return [];
  drop(book, s, id);
  return [{ kind: "item", label: `Dùng ${it.name}`, good: true, item: id }, ...changeEp(book, s, it.heal)];
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
  over?: "win" | "lose" | "evaded" | "timeout" | "beaten";
  compare?: "more" | "less" | "equal";
  /** ENDURANCE the hero lost in this fight. */
  lost: number;
}

export function startBattle(book: Book, s: AdvState, sec: Section): Battle {
  const avail = profile(book).mind.findIndex(([d]) => s.disciplines.includes(d));
  return { foes: sec.combat!.foes.map((def) => ({ def, ep: def.ep })), idx: 0, round: 0, mind: avail, lost: 0 };
}

export interface CsBreakdown {
  total: number;
  parts: { label: string; v: number }[];
}

const mindImmune = (foe: FoeDef) => (foe.immune ?? []).some((x) => ["mindblast", "psisurge", "kaisurge"].includes(x));

export function weaponBonus(book: Book, s: AdvState): { label: string; v: number } | null {
  const p = profile(book).weapon;
  if (!s.disciplines.includes(p.disc)) return null;
  const skilled = p.disc === "weaponskill" ? (s.weaponskill ? [s.weaponskill] : []) : s.mastered ?? [];
  const w = s.weapons.find((x) => skilled.includes(x));
  return w ? { label: `${book.names.disc[p.disc]} (${itemName(book, w)})`, v: p.bonus } : null;
}

/** Hero COMBAT SKILL for this fight, with its parts (shown on the battle screen). */
export function heroCs(book: Book, s: AdvState, c: Combat, foe: FoeDef, mind = -1, round = 0): CsBreakdown {
  const parts: { label: string; v: number }[] = [{ label: "Cơ bản", v: s.cs }];
  if (!armed(s, book)) parts.push({ label: "Tay không", v: -4 });
  else { const w = weaponBonus(book, s); if (w) parts.push(w); }
  if (c.firstRound && round < (c.firstRound.rounds ?? 1)) parts.push({ label: round ? `Hiệp ${round + 1}` : "Hiệp đầu", v: c.firstRound.cs });
  const m = profile(book).mind[mind];
  if (m && s.disciplines.includes(m[0]) && !c.noMindblast && !mindImmune(foe)) parts.push({ label: `${book.names.disc[m[0]]}${m[2] ? ` (−${m[2]} Sức Bền/hiệp)` : ""}`, v: m[1] });
  for (const id of s.special) if (book.items[id]?.cs) parts.push({ label: itemName(book, id), v: book.items[id].cs! });
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
  const ratio = heroCs(book, s, c, foe.def, b.mind, b.round).total - foe.def.cs;
  const n = pick10(rng);
  const [fl, hl] = book.crt[n][crtColumnOf(ratio)];
  b.round++;
  const m = profile(book).mind[b.mind];
  const mindCost = m && !c.noMindblast && !mindImmune(foe.def) ? m[2] : 0;
  const sommer = (s.special.includes("Sommerswerd") || s.weapons.includes("Sommerswerd")) && foe.def.undead;
  const hit = fl === KILL ? foe.ep : (fl + (c.foeExtraLoss ?? 0)) * (sommer ? 2 : 1);
  const foeLoss = evade || (c.foeHoldLoss ?? 0) >= b.round ? 0 : hit;
  const held = (foe.def.holdRounds ?? 0) >= b.round;
  const drain = c.heroDrain && check(s, c.heroDrain.if) ? c.heroDrain.ep : 0;
  const heroLoss = (held ? 0 : hl === KILL ? s.ep : hl) + mindCost + drain;
  if (!evade) foe.ep = Math.max(0, foe.ep - foeLoss);
  s.ep = Math.max(0, s.ep - heroLoss);
  if (heroLoss > 0) s.hurt = true;
  b.lost += heroLoss;
  if (s.ep <= 0 && c.lose) { s.ep = 1; b.over = "beaten"; s.fought = true; s.csNext = 0; return { n, ratio, foe: foeIdx, foeLoss, heroLoss, mindCost, foeKilled: false, heroKilled: false, evaded: false }; }
  const heroKilled = s.ep <= 0;
  const foeKilled = !evade && foe.ep <= 0;
  if (heroKilled) b.over = "lose";
  else if (evade) b.over = "evaded";
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
  return !!e && b.round >= e.after && !b.over;
}

/** Where to go after the battle: a section id, "" to stay (choices/random follow), null = death. */
export function battleExit(book: Book, s: AdvState, b: Battle): string | null {
  const c = book.sections[s.section].combat!;
  if (b.over === "lose") { s.ended = "death"; return null; }
  if (b.over === "beaten") return c.lose ?? "";
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
    const links = [...(sec.choices ?? []).map((x) => x.to), ...(sec.random?.out ?? []).map((o) => o.to),
      c?.win, c?.lose, c?.winBy?.fast, c?.winBy?.slow, c?.evade?.to, ...(c?.evade?.alt ?? []).map((a) => a.to), c?.maxRounds?.to, c?.onHurt, c?.compare?.more, c?.compare?.less, c?.compare?.equal].filter((x): x is string => !!x);
    for (const t of links) if (!book.sections[t]) errs.push(`§${id} → §${t}: không có đoạn này`);
    if (!links.length && !sec.end && !(sec.random?.out ?? []).some((o) => o.end)) errs.push(`§${id}: ngõ cụt`);
  }
  return errs;
}
