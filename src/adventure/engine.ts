/** Lone Wolf rules of Adventure. Pure functions: no DOM, so they can be tested. */
import type { AdvState, Book, Combat, Cond, Disc, Effect, FoeDef, ItemType, Offer, Section } from "./types";

export type Rng = () => number;

/** Random Number Table: 0-9. */
export const pick10 = (rng: Rng = Math.random) => Math.floor(rng() * 10);

export const MAX_WEAPONS = 2;
export const MAX_BACKPACK = 8;
export const MAX_GOLD = 50;
export const KILL = -1;

// ------------------------------------------------------------------ character

export interface NewHero {
  name: string;
  csRoll: number;
  epRoll: number;
  disciplines: Disc[];
  weaponskillRoll?: number;
  goldRoll?: number;
  /** Chosen/rolled option index for each of book.kit.picks (choose: several indexes). */
  picks: number[][];
}

export function newRun(book: Book, h: NewHero): AdvState {
  const now = Date.now();
  const s: AdvState = {
    v: 2, book: book.id, name: h.name, section: book.start,
    cs: 10 + h.csRoll, ep: 0, epBase: 20 + h.epRoll,
    disciplines: [...h.disciplines],
    weaponskill: h.disciplines.includes("weaponskill") ? book.weaponskill[h.weaponskillRoll ?? 0] : undefined,
    weapons: [], backpack: [], special: [], meals: 0,
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

// ------------------------------------------------------------------ items

export function epMax(book: Book, s: AdvState) {
  return s.epBase + s.special.reduce((a, id) => a + (book.items[id]?.epMax ?? 0), 0);
}

export function has(s: AdvState, id: string) {
  if (id === "Meal") return s.meals > 0;
  return s.weapons.includes(id) || s.backpack.includes(id) || s.special.includes(id);
}

/** Room left for an item of that type (meals live in the backpack). */
export function room(s: AdvState, type: ItemType) {
  if (type === "weapon") return MAX_WEAPONS - s.weapons.length;
  if (type === "backpack" || type === "meal") return MAX_BACKPACK - s.backpack.length - s.meals;
  return Infinity;
}

/** Adds items as far as there is room; returns how many did not fit. */
export function give(book: Book, s: AdvState, id: string, type: ItemType, n = 1): number {
  let left = n;
  while (left > 0 && room(s, type) > 0) {
    if (type === "meal" || id === "Meal") s.meals++;
    else if (type === "weapon") s.weapons.push(id);
    else if (type === "special") s.special.push(id);
    else s.backpack.push(id);
    left--;
  }
  if (book.items[id]?.epMax && type === "special") s.ep = Math.min(epMax(book, s), s.ep + (book.items[id].epMax ?? 0) * (n - left));
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
  return book.items[id]?.name ?? id;
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
  if ("ep" in c) return s.ep >= c.ep;
  if ("notFlag" in c) return !s.flags[c.notFlag];
  if ("flag" in c) return !!s.flags[c.flag];
  return true;
}

export function condText(book: Book, c: Cond | undefined): string {
  if (!c) return "";
  if ("all" in c) return c.all.map((x) => condText(book, x)).filter(Boolean).join(", ");
  if ("any" in c) return c.any.map((x) => condText(book, x)).filter(Boolean).join(" hoặc ");
  if ("disc" in c) return `cần ${book.names.disc[c.disc]}`;
  if ("notDisc" in c) return `khi không có ${book.names.disc[c.notDisc]}`;
  if ("item" in c) return `cần ${itemName(book, c.item)}`;
  if ("notItem" in c) return `khi không có ${itemName(book, c.notItem)}`;
  if ("gold" in c) return `cần ${c.gold} Vương Miện Vàng`;
  if ("ep" in c) return `cần ${c.ep} Sức Bền`;
  return "";
}

/** A choice the player could pick, or one that is shown locked (a discipline they lack...). */
export function choiceState(s: AdvState, c: { if?: Cond }): "ok" | "locked" | "hidden" {
  if (check(s, c.if)) return "ok";
  // "if you do not have X" branches are simply not shown when you do have X
  const negative = (x: Cond): boolean => "notDisc" in x || "notItem" in x || "notFlag" in x || ("all" in x && x.all.some(negative));
  return c.if && negative(c.if) ? "hidden" : "locked";
}

export interface Change {
  label: string;
  good: boolean;
  kind: "ep" | "cs" | "gold" | "item" | "meal";
}

export function apply(book: Book, s: AdvState, fx: Effect[] | undefined): Change[] {
  const out: Change[] = [];
  for (const e of fx ?? []) {
    if ("ep" in e) out.push(...changeEp(book, s, e.ep));
    else if ("cs" in e) {
      if (e.for === "book") s.csBook += e.cs;
      else s.csNext += e.cs;
      out.push({ kind: "cs", label: `⚔️ Kỹ Năng Chiến Đấu ${e.cs > 0 ? "+" : ""}${e.cs}${e.for === "book" ? "" : " (trận tới)"}`, good: e.cs > 0 });
    } else if ("gold" in e) {
      const before = s.gold;
      s.gold = Math.max(0, Math.min(MAX_GOLD, s.gold + e.gold));
      const d = s.gold - before;
      if (d) out.push({ kind: "gold", label: `👑 ${d > 0 ? "+" : ""}${d} Vương Miện Vàng`, good: d > 0 });
    } else if ("gain" in e) {
      const n = e.n ?? 1;
      if (e.optional) { s.offers.push({ gain: e.gain, type: e.type, n, desc: e.desc }); continue; }
      const left = give(book, s, e.gain, e.type, n);
      if (n - left > 0) out.push({ kind: e.type === "meal" ? "meal" : "item", label: `🎒 Nhận ${itemName(book, e.gain)}${n - left > 1 ? ` ×${n - left}` : ""}`, good: true });
      if (left > 0) s.offers.push({ gain: e.gain, type: e.type, n: left, desc: e.desc });
    } else if ("lose" in e) {
      if (drop(book, s, e.lose)) out.push({ kind: "item", label: `🎒 Mất ${itemName(book, e.lose)}`, good: false });
    } else if ("loseAll" in e) {
      const k = e.loseAll;
      if (k === "weapons" || k === "everything") s.weapons = [];
      if (k === "backpack" || k === "everything") { s.backpack = []; s.meals = 0; }
      if (k === "special" || k === "everything") s.special = [];
      if (k === "gold" || k === "everything") s.gold = 0;
      s.ep = Math.min(s.ep, epMax(book, s));
      out.push({ kind: "item", label: k === "gold" ? "👑 Mất hết Vương Miện Vàng" : k === "everything" ? "🎒 Mất toàn bộ hành trang" : "🎒 Mất đồ", good: false });
    } else if ("eat" in e) {
      if (s.disciplines.includes("hunting")) out.push({ kind: "meal", label: "🏹 Săn Bắn: tự kiếm được cái ăn", good: true });
      else if (s.meals > 0) { s.meals--; out.push({ kind: "meal", label: "🍖 Ăn 1 Phần Ăn", good: true }); }
      else out.push(...changeEp(book, s, -3), { kind: "meal", label: "🍖 Không có gì ăn", good: false });
    } else if ("flag" in e) {
      s.flags[e.flag] = true;
    }
  }
  return out;
}

export function changeEp(book: Book, s: AdvState, d: number): Change[] {
  const before = s.ep;
  s.ep = Math.max(0, Math.min(epMax(book, s), s.ep + d));
  const real = s.ep - before;
  return real ? [{ kind: "ep", label: `❤️ Sức Bền ${real > 0 ? "+" : ""}${real}`, good: real > 0 }] : [];
}

// ------------------------------------------------------------------ moving through the book

/** Moves to a section and applies its effects once (a reload does not apply them again). */
export function enter(book: Book, s: AdvState, id: string): Change[] {
  const sec = book.sections[id];
  if (!sec) throw new Error(`Không có đoạn ${id}`);
  const ch: Change[] = [];
  // Healing: +1 ENDURANCE for each section passed through without combat
  if (s.steps > 0 && !s.fought && s.disciplines.includes("healing") && s.ep < epMax(book, s)) {
    ch.push(...changeEp(book, s, 1).map((c) => ({ ...c, label: `${c.label} (Chữa Lành)` })));
  }
  const { back: _old, ...snap } = s;
  s.back = JSON.parse(JSON.stringify(snap)) as Omit<AdvState, "back">;
  s.section = id;
  s.steps++;
  s.fought = false;
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
  if (sec.random) return "random";
  return "choices";
}

export function randomResult(sec: Section, s: AdvState, n: number) {
  const add = (sec.random!.mods ?? []).reduce((a, m) => a + (check(s, m.if) ? m.add : 0), 0);
  const v = n + add;
  const out = sec.random!.out.find((o) => v >= o.min && v <= o.max)
    ?? (v < 0 ? sec.random!.out[0] : sec.random!.out[sec.random!.out.length - 1]);
  return { n, add, value: v, to: out.to };
}

export function eatMeal(book: Book, s: AdvState): Change[] {
  return apply(book, s, [{ eat: true }]);
}

/** Healing Potion and the like: usable outside combat. */
export function useItem(book: Book, s: AdvState, id: string): Change[] {
  const it = book.items[id];
  if (!it?.heal || !has(s, id) || s.ep >= epMax(book, s)) return [];
  drop(book, s, id);
  return [{ kind: "item", label: `🧪 Dùng ${it.name}`, good: true }, ...changeEp(book, s, it.heal)];
}

export function takeOffer(book: Book, s: AdvState, i: number): Change[] {
  const o: Offer | undefined = s.offers[i];
  if (!o) return [];
  const left = give(book, s, o.gain, o.type, o.n);
  const got = o.n - left;
  if (left > 0) o.n = left;
  else s.offers.splice(i, 1);
  return got ? [{ kind: o.type === "meal" ? "meal" : "item", label: `🎒 Nhận ${itemName(book, o.gain)}${got > 1 ? ` ×${got}` : ""}`, good: true }] : [];
}

// ------------------------------------------------------------------ combat

export interface Foe {
  def: FoeDef;
  ep: number;
}

export interface Battle {
  foes: Foe[];
  idx: number;
  round: number;
  over?: "win" | "lose" | "evaded" | "timeout";
}

export function startBattle(sec: Section): Battle {
  return { foes: sec.combat!.foes.map((def) => ({ def, ep: def.ep })), idx: 0, round: 0 };
}

export interface CsBreakdown {
  total: number;
  parts: { label: string; v: number }[];
}

/** Hero COMBAT SKILL for this fight, with its parts (shown on the battle screen). */
export function heroCs(book: Book, s: AdvState, c: Combat, foe: FoeDef): CsBreakdown {
  const parts: { label: string; v: number }[] = [{ label: "Cơ bản", v: s.cs }];
  if (!s.weapons.length) parts.push({ label: "Tay không", v: -4 });
  else if (s.weaponskill && s.weapons.includes(s.weaponskill)) parts.push({ label: `${book.names.disc.weaponskill} (${itemName(book, s.weaponskill)})`, v: 2 });
  if (s.disciplines.includes("mindblast") && !c.noMindblast && !(foe.immune ?? []).includes("mindblast")) parts.push({ label: book.names.disc.mindblast, v: 2 });
  for (const id of s.special) if (book.items[id]?.cs) parts.push({ label: itemName(book, id), v: book.items[id].cs! });
  if (c.mods?.cs) parts.push({ label: "Hoàn cảnh", v: c.mods.cs });
  if (s.csNext) parts.push({ label: "Tạm thời", v: s.csNext });
  if (s.csBook) parts.push({ label: "Cả cuốn", v: s.csBook });
  return { total: parts.reduce((a, p) => a + p.v, 0), parts };
}

export interface RoundResult {
  n: number;
  ratio: number;
  foeLoss: number;
  heroLoss: number;
  foeKilled: boolean;
  heroKilled: boolean;
  evaded: boolean;
}

/** One round against the current foe. `evade`: escape this round (enemy losses are ignored). */
export function playRound(book: Book, s: AdvState, b: Battle, evade = false, rng: Rng = Math.random): RoundResult {
  const sec = book.sections[s.section];
  const c = sec.combat!;
  const foe = b.foes[b.idx];
  const ratio = heroCs(book, s, c, foe.def).total - foe.def.cs;
  const n = pick10(rng);
  const [fl, hl] = book.crt[n][crtColumnOf(ratio)];
  b.round++;
  const foeKilled = !evade && fl === KILL;
  const foeLoss = evade ? 0 : fl === KILL ? foe.ep : fl;
  const heroLoss = hl === KILL ? s.ep : hl;
  if (!evade) foe.ep = Math.max(0, foe.ep - foeLoss);
  s.ep = Math.max(0, s.ep - heroLoss);
  const heroKilled = s.ep <= 0;
  if (heroKilled) b.over = "lose";
  else if (evade) b.over = "evaded";
  else if (foe.ep <= 0) {
    if (b.idx < b.foes.length - 1) b.idx++;
    else b.over = "win";
  } else if (c.maxRounds && b.round >= c.maxRounds.n) b.over = "timeout";
  if (b.over) finishBattle(s);
  return { n, ratio, foeLoss, heroLoss, foeKilled: foeKilled || foe.ep <= 0, heroKilled, evaded: evade };
}

/** Ratio column of the Combat Results Table: ≤-11, -10/-9, … , -2/-1, 0, 1/2, … , 9/10, ≥11. */
export function crtColumnOf(ratio: number) {
  if (ratio <= -11) return 0;
  if (ratio >= 11) return 12;
  if (ratio === 0) return 6;
  if (ratio < 0) return 6 - Math.ceil(-ratio / 2);
  return 6 + Math.ceil(ratio / 2);
}

export function canEvade(book: Book, s: AdvState, b: Battle) {
  const e = book.sections[s.section].combat?.evade;
  return !!e && b.round >= e.after && !b.over;
}

function finishBattle(s: AdvState) {
  s.fought = true;
  s.csNext = 0;
}

/** Where to go after the battle: a section id, "" to stay (choices/random follow), null = death. */
export function battleExit(book: Book, s: AdvState, b: Battle): string | null {
  const c = book.sections[s.section].combat!;
  if (b.over === "lose") { s.ended = "death"; return null; }
  if (b.over === "evaded") return c.evade?.to ?? "";
  if (b.over === "timeout") return c.maxRounds?.to ?? "";
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
    const links = [...(sec.choices ?? []).map((c) => c.to), ...(sec.random?.out ?? []).map((o) => o.to),
      sec.combat?.win, sec.combat?.evade?.to, sec.combat?.maxRounds?.to].filter((x): x is string => !!x);
    for (const t of links) if (!book.sections[t]) errs.push(`§${id} → §${t}: không có đoạn này`);
    if (!links.length && !sec.end) errs.push(`§${id}: ngõ cụt`);
  }
  return errs;
}
