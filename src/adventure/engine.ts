/** Pure rules of Adventure: no DOM, so they can be tested. */
import type { AdvState, Book, Choice, Cond, Effect, EnemyDef, Section, StatId } from "./types";

export type Rng = () => number;

export const d6 = (rng: Rng = Math.random) => 1 + Math.floor(rng() * 6);
export const roll = (n: number, rng: Rng = Math.random) => Array.from({ length: n }, () => d6(rng));
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const STAT_NAME: Record<StatId, string> = { skill: "Kỹ Năng", stamina: "Thể Lực", luck: "May Mắn" };
export const STAT_ICON: Record<StatId, string> = { skill: "⚔️", stamina: "❤️", luck: "🍀" };

export function newRun(book: Book, name: string, stats: { skill: number; stamina: number; luck: number }): AdvState {
  const now = Date.now();
  const s: AdvState = {
    v: 1, book: book.id, name, section: book.start,
    skill: stats.skill, skillMax: stats.skill,
    stamina: stats.stamina, staminaMax: stats.stamina,
    luck: stats.luck, luckMax: stats.luck,
    gold: book.rules.gold ?? 0,
    provisions: book.rules.provisions ?? 0,
    items: { ...(book.rules.items ?? {}) },
    flags: {}, visited: [], steps: 0, created: now, updated: now,
  };
  enter(book, s, book.start);
  return s;
}

export function rollStats(book: Book, rng: Rng = Math.random) {
  const r = book.rules;
  const one = (d: { dice: number; plus: number }) => {
    const dice = roll(d.dice, rng);
    return { dice, total: sum(dice) + d.plus };
  };
  return { skill: one(r.skill), stamina: one(r.stamina), luck: one(r.luck) };
}

export function check(s: AdvState, c: Cond | undefined): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => check(s, x));
  if ("any" in c) return c.any.some((x) => check(s, x));
  if ("has" in c) return (s.items[c.has] ?? 0) >= (c.n ?? 1);
  if ("notFlag" in c) return !s.flags[c.notFlag];
  if ("flag" in c) return !!s.flags[c.flag];
  if ("gold" in c) return s.gold >= c.gold;
  if ("stat" in c) return s[c.stat] >= c.min;
  if ("visited" in c) return s.visited.includes(c.visited);
  return true;
}

/** Human readable requirement, shown on a locked choice. */
export function condText(book: Book, c: Cond | undefined): string {
  if (!c) return "";
  if ("all" in c) return c.all.map((x) => condText(book, x)).join(", ");
  if ("any" in c) return c.any.map((x) => condText(book, x)).join(" hoặc ");
  if ("has" in c) return `cần ${book.items[c.has]?.name ?? c.has}${(c.n ?? 1) > 1 ? ` ×${c.n}` : ""}`;
  if ("gold" in c) return `cần ${c.gold} vàng`;
  if ("stat" in c) return `cần ${STAT_NAME[c.stat]} ≥ ${c.min}`;
  return "chưa đủ điều kiện";
}

export interface Change {
  kind: "stat" | "gold" | "item" | "provisions";
  label: string;
  good: boolean;
}

/** Applies effects; returns what changed (for the little popups). */
export function apply(book: Book, s: AdvState, fx: Effect[] | undefined): Change[] {
  const out: Change[] = [];
  for (const e of fx ?? []) {
    if ("stat" in e) {
      const max = e.stat === "skill" ? s.skillMax : e.stat === "stamina" ? s.staminaMax : s.luckMax;
      const before = s[e.stat];
      s[e.stat] = Math.max(0, e.over ? before + e.add : Math.min(Math.max(max, before), before + e.add));
      const d = s[e.stat] - before;
      if (d) out.push({ kind: "stat", label: `${STAT_ICON[e.stat]} ${STAT_NAME[e.stat]} ${d > 0 ? "+" : ""}${d}`, good: d > 0 });
    } else if ("statMax" in e) {
      const k = e.statMax;
      const mk = `${k}Max` as "skillMax" | "staminaMax" | "luckMax";
      s[mk] = Math.max(1, s[mk] + e.add);
      s[k] = Math.max(0, s[k] + e.add);
      out.push({ kind: "stat", label: `${STAT_ICON[k]} ${STAT_NAME[k]} tối đa ${e.add > 0 ? "+" : ""}${e.add}`, good: e.add > 0 });
    } else if ("gold" in e) {
      const before = s.gold;
      s.gold = Math.max(0, s.gold + e.gold);
      const d = s.gold - before;
      if (d) out.push({ kind: "gold", label: `🪙 ${d > 0 ? "+" : ""}${d} vàng`, good: d > 0 });
    } else if ("give" in e) {
      const n = e.n ?? 1;
      s.items[e.give] = (s.items[e.give] ?? 0) + n;
      const it = book.items[e.give];
      out.push({ kind: "item", label: `${it?.icon ?? "🎁"} Nhận ${it?.name ?? e.give}${n > 1 ? ` ×${n}` : ""}`, good: true });
    } else if ("take" in e) {
      const have = s.items[e.take] ?? 0;
      if (!have) continue;
      const n = Math.min(have, e.n ?? 1);
      if (have - n > 0) s.items[e.take] = have - n;
      else delete s.items[e.take];
      const it = book.items[e.take];
      out.push({ kind: "item", label: `${it?.icon ?? "📦"} Mất ${it?.name ?? e.take}${n > 1 ? ` ×${n}` : ""}`, good: false });
    } else if ("flag" in e) {
      s.flags[e.flag] = e.v ?? true;
    } else if ("provisions" in e) {
      const before = s.provisions;
      s.provisions = Math.max(0, s.provisions + e.provisions);
      const d = s.provisions - before;
      if (d) out.push({ kind: "provisions", label: `🍖 Lương khô ${d > 0 ? "+" : ""}${d}`, good: d > 0 });
    }
  }
  return out;
}

/** Moves to a section and applies its effects once (a reload does not apply them again). */
export function enter(book: Book, s: AdvState, id: string): Change[] {
  const sec = book.sections[id];
  if (!sec) throw new Error(`Không có đoạn ${id}`);
  const { back: _old, ...snap } = s;
  s.back = JSON.parse(JSON.stringify(snap)) as Omit<AdvState, "back">;
  s.section = id;
  s.steps++;
  if (!s.visited.includes(id)) s.visited.push(id);
  s.updated = Date.now();
  const ch = apply(book, s, sec.fx);
  if (sec.end) s.ended = sec.end;
  else if (s.stamina <= 0) s.ended = "death";
  return ch;
}

export function choose(book: Book, s: AdvState, c: Choice): Change[] {
  if (!check(s, c.cond)) return [];
  const a = apply(book, s, c.fx);
  return [...a, ...enter(book, s, c.to)];
}

/** "Try again" after a death: back to the moment the deadly section was entered. */
export function retry(s: AdvState): AdvState | null {
  if (!s.back) return null;
  return { ...JSON.parse(JSON.stringify(s.back)), back: undefined, updated: Date.now() } as AdvState;
}

export interface TestResult {
  dice: number[];
  total: number;
  target: number;
  pass: boolean;
}

/** Stat test of a section. A luck test costs 1 luck, whatever the result (FF rule). */
export function runTest(sec: Section, s: AdvState, rng: Rng = Math.random): TestResult {
  const t = sec.test!;
  const dice = roll(t.dice ?? 2, rng);
  const total = sum(dice);
  const target = s[t.stat] + (t.mod ?? 0);
  const pass = total <= target;
  if (t.stat === "luck") s.luck = Math.max(0, s.luck - 1);
  return { dice, total, target, pass };
}

export function eat(book: Book, s: AdvState): Change[] {
  if (s.provisions <= 0 || s.stamina >= s.staminaMax) return [];
  s.provisions--;
  return apply(book, s, [{ stat: "stamina", add: book.rules.provisionHeal ?? 4 }]);
}

export function useItem(book: Book, s: AdvState, id: string): Change[] {
  const it = book.items[id];
  if (!it?.use || !(s.items[id] > 0)) return [];
  const ch = apply(book, s, it.use.fx);
  if (it.use.consume !== false) {
    s.items[id]--;
    if (s.items[id] <= 0) delete s.items[id];
  }
  return ch;
}

// ------------------------------------------------------------------ combat

export interface Foe {
  id: string;
  def: EnemyDef;
  hp: number;
}

export interface Battle {
  foes: Foe[];
  target: number;
  round: number;
  together: boolean;
  over?: "win" | "lose" | "fled";
}

export type Action = { kind: "attack"; luck?: boolean } | { kind: "defend" } | { kind: "item"; id: string } | { kind: "flee" };

export type BattleEvent =
  | { t: "roll"; who: "hero" | number; dice: number[]; total: number }
  | { t: "hit"; on: "hero" | number; dmg: number; crit?: boolean }
  | { t: "parry"; foe: number }
  | { t: "luck"; ok: boolean }
  | { t: "item"; id: string; changes: Change[] }
  | { t: "down"; foe: number }
  | { t: "text"; text: string };

export function startBattle(book: Book, sec: Section): Battle {
  const f = sec.fight!;
  return {
    foes: f.enemies.map((id) => ({ id, def: book.enemies[id], hp: book.enemies[id].stamina })),
    target: 0, round: 0, together: !!f.together,
  };
}

/** Enemies that fight this round: all living ones together, or the first living one. */
export function activeFoes(b: Battle): number[] {
  const alive = b.foes.map((f, i) => (f.hp > 0 ? i : -1)).filter((i) => i >= 0);
  return b.together ? alive : alive.slice(0, 1);
}

/**
 * One round. Attack strength = skill + 2d6 for both sides; the higher one hits.
 * The hero only wounds the chosen target; other enemies fighting together can only wound the hero.
 * Double six = critical hit. Luck (attack with luck): lucky +2 damage / unlucky -1, costs 1 luck.
 * Defend: +3 attack strength but no damage dealt. Using an item takes the round.
 */
export function playRound(book: Book, s: AdvState, b: Battle, a: Action, rng: Rng = Math.random): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (b.over) return ev;
  b.round++;
  if (a.kind === "flee") {
    s.stamina = Math.max(0, s.stamina - 2);
    ev.push({ t: "hit", on: "hero", dmg: 2 }, { t: "text", text: "Bạn quay lưng bỏ chạy, lãnh một đòn vào lưng." });
    b.over = s.stamina <= 0 ? "lose" : "fled";
    return ev;
  }
  if (a.kind === "item") {
    const ch = useItem(book, s, a.id);
    ev.push({ t: "item", id: a.id, changes: ch });
  }
  const active = activeFoes(b);
  if (!active.includes(b.target)) b.target = active[0];
  const heroDice = roll(2, rng);
  const bonus = a.kind === "defend" ? 3 : 0;
  const heroAS = s.skill + sum(heroDice) + bonus;
  ev.push({ t: "roll", who: "hero", dice: heroDice, total: heroAS });
  for (const i of active) {
    const foe = b.foes[i];
    const dice = roll(2, rng);
    const foeAS = foe.def.skill + sum(dice);
    ev.push({ t: "roll", who: i, dice, total: foeAS });
    if (heroAS > foeAS) {
      if (i !== b.target || a.kind !== "attack") { ev.push({ t: "parry", foe: i }); continue; }
      const crit = heroDice[0] === 6 && heroDice[1] === 6;
      let dmg = crit ? 4 : 2;
      if (a.luck && s.luck > 0) {
        const ok = sum(roll(2, rng)) <= s.luck;
        s.luck--;
        dmg = ok ? dmg + 2 : Math.max(1, dmg - 1);
        ev.push({ t: "luck", ok });
      }
      foe.hp = Math.max(0, foe.hp - dmg);
      ev.push({ t: "hit", on: i, dmg, crit });
      if (foe.hp <= 0) ev.push({ t: "down", foe: i });
    } else if (foeAS > heroAS) {
      const dmg = foe.def.damage ?? 2;
      s.stamina = Math.max(0, s.stamina - dmg);
      ev.push({ t: "hit", on: "hero", dmg });
      if (s.stamina <= 0) break;
    } else {
      ev.push({ t: "parry", foe: i });
    }
  }
  if (s.stamina <= 0) b.over = "lose";
  else if (b.foes.every((f) => f.hp <= 0)) b.over = "win";
  else if (b.foes[b.target].hp <= 0) b.target = activeFoes(b)[0] ?? 0;
  return ev;
}

/** Where to go after the battle; null = death (no `lose` section). */
export function battleExit(book: Book, s: AdvState, b: Battle): string | null {
  const f = book.sections[s.section].fight!;
  if (b.over === "win") return f.win;
  if (b.over === "fled") return f.flee ?? null;
  return f.lose ?? null;
}

/** Problems in a book's links (used by the tests and by the translation pipeline). */
export function validateBook(book: Book): string[] {
  const errs: string[] = [];
  const ids = new Set(Object.keys(book.sections));
  const link = (from: string, to: string | undefined) => { if (to !== undefined && !ids.has(to)) errs.push(`§${from} → §${to}: không có đoạn này`); };
  const fxCheck = (from: string, fx: Effect[] | undefined) => {
    for (const e of fx ?? []) {
      const id = "give" in e ? e.give : "take" in e ? e.take : null;
      if (id && !book.items[id]) errs.push(`§${from}: vật phẩm "${id}" chưa khai báo`);
    }
  };
  const condCheck = (from: string, c: Cond | undefined) => {
    if (!c) return;
    if ("all" in c) c.all.forEach((x) => condCheck(from, x));
    else if ("any" in c) c.any.forEach((x) => condCheck(from, x));
    else if ("has" in c && !book.items[c.has]) errs.push(`§${from}: điều kiện cần vật phẩm "${c.has}" chưa khai báo`);
    else if ("visited" in c && !ids.has(c.visited)) errs.push(`§${from}: điều kiện đã qua §${c.visited} không tồn tại`);
  };
  if (!ids.has(book.start)) errs.push(`Đoạn mở đầu §${book.start} không tồn tại`);
  for (const [id, sec] of Object.entries(book.sections)) {
    fxCheck(id, sec.fx);
    const exits = (sec.choices?.length ?? 0) + (sec.fight ? 1 : 0) + (sec.test ? 1 : 0) + (sec.end ? 1 : 0);
    if (!exits) errs.push(`§${id}: ngõ cụt (không có lựa chọn, trận đấu, phép thử hay kết thúc)`);
    for (const c of sec.choices ?? []) { link(id, c.to); fxCheck(id, c.fx); condCheck(id, c.cond); }
    if (sec.fight) {
      link(id, sec.fight.win); link(id, sec.fight.lose); link(id, sec.fight.flee);
      for (const e of sec.fight.enemies) if (!book.enemies[e]) errs.push(`§${id}: quái "${e}" chưa khai báo`);
    }
    if (sec.test) { link(id, sec.test.pass); link(id, sec.test.fail); }
    if (sec.img && /^(https?:)?\/\//.test(sec.img)) errs.push(`§${id}: ảnh phải nằm trong public/adventure/${book.id}/`);
  }
  // sections no path reaches (usually a typo in a link number)
  const seen = new Set<string>();
  const stack = [book.start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !ids.has(id)) continue;
    seen.add(id);
    const sec = book.sections[id];
    for (const c of sec.choices ?? []) stack.push(c.to);
    if (sec.fight) stack.push(...[sec.fight.win, sec.fight.lose, sec.fight.flee].filter((x): x is string => !!x));
    if (sec.test) stack.push(sec.test.pass, sec.test.fail);
  }
  for (const id of ids) if (!seen.has(id)) errs.push(`§${id}: không đoạn nào dẫn tới`);
  return errs;
}
