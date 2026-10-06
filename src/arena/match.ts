/**
 * Arena match flow, as in Teamfight Tactics: eight players (you and seven CPUs) go through
 * stages of rounds — carousels, monster rounds, player fights — buying units from their own
 * pool, levelling, combining three copies into a higher star (up to ★4), crafting items and
 * picking augments ("Lõi"). The state is plain data (it can be saved as JSON); the functions
 * below change it. Fights are deterministic: the screen replays the human's fight from
 * `fightSetup` while `resolveCombat` runs every fight to get the results.
 */
import { ArenaBattle, type Fighter, type PlacedUnit, type TeamMods, type TeamSetup } from "./combat";
import { AUGMENTS, type AugTier, type Augment } from "./augments";
import { COLS, HALF, ROWS } from "./hex";
import { EMBLEMS, FINISHED, ITEMS, combine, isComponent, isTool } from "./items";
import { tierOf } from "./rank";
import { TRAITS, traitTier } from "./traits";
import type { ArenaUnit, Star } from "./types";
import { RANGED, arenaUnit, arenaUnits } from "./units";

// ------------------------------------------------------------ rules
export const PLAYERS = 8;
export const BENCH = 9;
export const SHOP = 5;
export const MAX_HP = 100;
export const DECK_SIZE = 50;
export const REROLL_COST = 2;
export const XP_COST = 4;
export const MAX_LEVEL = 10;
/** Copies of each unit in a player's own pool, by cost (27 make a ★4). */
export const COPIES = [0, 30, 28, 27, 27, 27];
/** XP to go from a level to the next (index = current level). */
export const XP_NEXT = [0, 2, 2, 6, 10, 20, 36, 48, 72, 84, 0];
/** Shop odds (percent per cost 1..5) by level. */
export const ODDS: number[][] = [
  [], [100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 30, 15, 0, 0], [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0], [19, 30, 40, 10, 1], [17, 24, 32, 24, 3], [15, 18, 25, 30, 12], [5, 10, 20, 40, 25],
];
const STAGE_DMG = [0, 0, 2, 5, 8, 10, 12, 17, 25];
const STAR_DMG = [0, 1, 2, 4, 7];
/** Rounds where an augment is offered: stage-round. */
export const AUGMENT_ROUNDS = ["2-1", "3-2", "4-2"];

export type RoundKind = "carousel" | "pve" | "pvp";
export function roundKind(stage: number, round: number): RoundKind {
  if (stage === 1) return round === 1 ? "carousel" : "pve";
  if (round === 4) return "carousel";
  if (round === 7) return "pve";
  return "pvp";
}
export const roundsIn = (stage: number) => (stage === 1 ? 4 : 7);

// ------------------------------------------------------------ state
/** A unit a player owns. `bonus` holds stats it has earned for good this match (Veigar-style spells). */
export interface Owned { uid: number; unitId: string; star: Star; items: string[]; x: number; y: number; bench: number; bonus?: Record<string, number> }

export interface PlayerStats {
  wins: number; losses: number; dealt: number; taken: number; rolls: number; bought: number; xpBought: number;
  goldEarned: number; bestStreak: number; unitDamage: Record<string, number>; roundsSurvived: number;
}

export interface Player {
  id: number;
  name: string;
  icon: string;
  cpu: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  streak: number; // >0 wins in a row, <0 losses in a row
  units: Owned[]; // bench == -1 → on the board at x,y (own half, y 4..7)
  items: string[]; // item bench
  shop: (string | null)[];
  locked: boolean;
  deck: string[];
  pool: Record<string, number>;
  augments: string[];
  augmentOffer: string[] | null;
  /** One reroll per offered augment: which of the three slots have been rerolled. */
  augmentRerolled: boolean[];
  mods: TeamMods;
  income: number;
  freeRolls: number;
  freeRollsLeft: number;
  /** Free rolls picked up by spells, for the next planning. */
  bonusRolls?: number;
  interestCap: number;
  xpRound: number;
  boardBonus: number;
  place: number; // 0 while alive
  lastOpp: number[];
  stats: PlayerStats;
  /** What the last round paid, part by part (for the screen). */
  lastIncome?: Income;
  /**
   * CPU personality. Grade: how well it plays (a strong CPU also gets extra gold and items).
   * Style: "econ" levels on the usual curve and rolls down at 4-2; "fast" saves and levels
   * early to 8–9 to find and carry 4- and 5-gold units; "reroll" stays low and slow-rolls with
   * the gold above 50 until its cheap units (`focusCost`) reach three stars, then levels.
   */
  style?: CpuStyle;
  grade?: CpuGrade;
  skill?: number; // 0..1
  focusCost?: number;
  /** The units a reroll CPU is trying to three-star. */
  focus?: string[];
  rerollDone?: boolean;
  /** Bench places beyond the usual nine (better CPUs at high ranks). */
  extraBench?: number;
}

export type CpuStyle = "econ" | "reroll" | "fast";
export type CpuGrade = "weak" | "normal" | "strong";
export const STYLE_NAMES: Record<CpuStyle, string> = { econ: "Kinh tế (lên cấp đều, lăn ở 4-2)", fast: "Lên cấp nhanh (nuôi tướng 4–5 vàng)", reroll: "Lăn chậm (nuôi tướng 3 sao)" };
export const GRADE_NAMES: Record<CpuGrade, string> = { weak: "Tay mơ", normal: "Khá", strong: "Cao thủ" };

export interface Income { base: number; interest: number; streak: number; extra: number; total: number }

export interface CarouselSlot { unitId: string; item: string; takenBy: number | null }

export interface Fight { a: number; b: number; ghost: boolean; pve: boolean; seed: number; result?: { winner: 0 | 1 | -1; dmg: number; survivors: number } }

export interface Loot { gold: number; items: string[]; units: string[] }

export type Phase = "augment" | "carousel" | "plan" | "combat" | "result" | "end";

export interface MatchState {
  v: 1;
  seed: number;
  rs: number; // rng state
  stage: number;
  round: number;
  phase: Phase;
  players: Player[];
  nextUid: number;
  augTier: AugTier;
  carousel: CarouselSlot[] | null;
  carouselOrder: number[];
  fights: Fight[];
  pve: TeamSetup | null;
  loot: Record<number, Loot>;
  log: string[];
  rankStep: number;
}

// ------------------------------------------------------------ rng (kept in the state)
function rnd(m: MatchState): number {
  let t = (m.rs = (m.rs + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(m: MatchState, a: readonly T[]): T => a[Math.floor(rnd(m) * a.length)];
function shuffle<T>(m: MatchState, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(m) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const hash = (...n: number[]) => n.reduce((h, x) => Math.imul(h ^ (x | 0), 16777619) >>> 0, 2166136261);

// ------------------------------------------------------------ decks
/** The highest floor a CPU's deck draws from at a rank step. */
export const cpuMaxFloor = (step: number) => Math.min(100, Math.max(8, Math.round(8 + tierOf(step) * 2.4)));

/** How many units of each price a match deck takes: 12 / 11 / 10 / 9 / 8. */
export const DECK_QUOTA = [0, 12, 11, 10, 9, 8];

/**
 * A match deck drawn at random from a pool (the units a player has unlocked, or a CPU's floors):
 * 12 one-gold, 11 two-gold, 10 three-gold, 9 four-gold and 8 five-gold. When a price is short,
 * the deck is topped up with other units of the pool (never more than 8 five-gold).
 */
export function deckFrom(pool: string[], rand: () => number): string[] {
  const units = [...new Set(pool)].map((id) => arenaUnit(id)).filter((u): u is ArenaUnit => !!u);
  const sh = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const out: string[] = [];
  const left: ArenaUnit[] = [];
  for (let c = 1; c <= 5; c++) {
    const at = sh(units.filter((u) => u.cost === c));
    out.push(...at.slice(0, DECK_QUOTA[c]).map((u) => u.id));
    if (c < 5) left.push(...at.slice(DECK_QUOTA[c]));
  }
  for (const u of sh(left)) { if (out.length >= DECK_SIZE) break; out.push(u.id); }
  return out;
}

/** A CPU's deck: drawn from the units of floors 1..maxFloor. */
export function randomDeck(maxFloor: number, rand: () => number): string[] {
  return deckFrom(arenaUnits().filter((u) => u.floor <= maxFloor).map((u) => u.id), rand);
}

const CPU_NAMES = [
  "Thợ Săn Lam", "Kẻ Lang Thang", "Hiệp Sĩ Tro", "Phù Thủy Rêu", "Cung Thủ Gió", "Lãng Khách", "Bà Đồng Nhện", "Gã Đồ Tể",
  "Nữ Tu Sương", "Vua Chuột", "Thầy Bói Mù", "Kẻ Gác Mộ", "Lính Đánh Thuê", "Học Giả Điên", "Tiểu Thư Rắn", "Lão Ngư Ông",
  "Thánh Kỵ Sĩ", "Đạo Chích", "Hắc Pháp Sư", "Kẻ Thuần Thú",
];
const CPU_ICONS = ["🦊", "🐺", "🦉", "🐸", "🦅", "🐲", "🦇", "🐍", "🐻", "🐯", "🦂", "🐙"];

// ------------------------------------------------------------ setup
export interface NewMatchOpts { deck: string[]; name: string; icon?: string; rankStep: number; seed: number }

function newPlayer(m: MatchState, id: number, name: string, icon: string, cpu: boolean, deck: string[]): Player {
  const pool: Record<string, number> = {};
  for (const d of deck) pool[d] = COPIES[arenaUnit(d)!.cost];
  return {
    id, name, icon, cpu, hp: MAX_HP, gold: 0, level: 1, xp: 0, streak: 0, units: [], items: [], shop: Array(SHOP).fill(null), locked: false,
    deck: [...deck], pool, augments: [], augmentOffer: null, augmentRerolled: [], mods: {}, income: 0, freeRolls: 0, freeRollsLeft: 0,
    interestCap: 5, xpRound: 0, boardBonus: 0, place: 0, lastOpp: [],
    stats: { wins: 0, losses: 0, dealt: 0, taken: 0, rolls: 0, bought: 0, xpBought: 0, goldEarned: 0, bestStreak: 0, unitDamage: {}, roundsSurvived: 0 },
  };
}

export function newMatch(o: NewMatchOpts): MatchState {
  const m: MatchState = {
    v: 1, seed: o.seed >>> 0, rs: o.seed | 0, stage: 1, round: 1, phase: "carousel", players: [], nextUid: 1, augTier: 1,
    carousel: null, carouselOrder: [], fights: [], pve: null, loot: {}, log: [], rankStep: o.rankStep,
  };
  m.players.push(newPlayer(m, 0, o.name, o.icon ?? "🙂", false, o.deck));
  m.players[0].items.push("magnet", "magnet", "magnet"); // 3 magnetic removers to start
  const names = shuffle(m, [...CPU_NAMES]);
  const maxFloor = cpuMaxFloor(o.rankStep);
  // a mix of weak, decent and strong CPUs; more strong ones (and no weak ones) as the rank rises
  const grades = cpuGrades(o.rankStep);
  // every style shows up among the better players
  const styles = [...shuffle(m, ["fast", "reroll", "econ"] as CpuStyle[]), ...shuffle(m, ["fast", "reroll", "econ", "econ"] as CpuStyle[])];
  for (let i = 1; i < PLAYERS; i++) {
    const p = newPlayer(m, i, names[i - 1], pick(m, CPU_ICONS), true, randomDeck(maxFloor, () => rnd(m)));
    p.grade = grades[i - 1];
    p.style = p.grade === "weak" ? pick(m, ["econ", "econ", "fast"] as const) : styles[i - 1];
    p.skill = cpuSkillOf(p.grade, o.rankStep, rnd(m));
    p.focusCost = pick(m, [1, 2, 2, 3, 3]);
    p.extraBench = cpuExtraBench(p.grade, o.rankStep);
    if (p.grade === "strong") p.items.push(randomComponent(m));
    m.players.push(p);
  }
  // the augment tier of each augment round is the same for everyone, like in TFT
  m.augTier = 1;
  startRound(m);
  return m;
}

/** The seven CPUs' grades at a rank step: 2 strong and 3 weak at the bottom, 5 strong and none weak at the top. */
export function cpuGrades(step: number): CpuGrade[] {
  const t = tierOf(step);
  const strong = Math.min(5, 2 + Math.floor(t / 10));
  const weak = Math.max(0, 3 - Math.floor(t / 12));
  return [...Array(strong).fill("strong"), ...Array(PLAYERS - 1 - strong - weak).fill("normal"), ...Array(weak).fill("weak")];
}
/** How well a CPU of a grade plays (0..1); `r` is a random 0..1 for a little spread. */
export function cpuSkillOf(g: CpuGrade, step: number, r: number): number {
  const t = tierOf(step) / 39;
  const [lo, hi] = g === "weak" ? [0.2, 0.4] : g === "normal" ? [0.55 + t * 0.15, 0.75 + t * 0.15] : [0.85 + t * 0.1, 1];
  return Math.min(1, lo + (hi - lo) * r);
}
/** Unit copiers a CPU gets at the start of a stage (stage 3+): more and better ones higher up. */
export function cpuCopiers(m: MatchState, p: Player): string[] {
  const t = tierOf(m.rankStep);
  if (p.grade === "weak" || t < 5) return [];
  const deluxe = m.stage >= 4 && t >= 10;
  if (p.grade === "strong") return t >= 25 ? [deluxe ? "dup5" : "dup3", deluxe ? "dup5" : "dup3"] : [deluxe ? "dup5" : "dup3"];
  return t >= 20 ? [deluxe ? "dup5" : "dup3"] : [];
}

/** Extra bench places for a CPU: from rank tier 10, more for strong ones (up to +9). */
export function cpuExtraBench(g: CpuGrade, step: number): number {
  const t = tierOf(step);
  if (g === "weak" || t < 10) return 0;
  const lvl = t >= 30 ? 2 : t >= 20 ? 1 : 0;
  return g === "strong" ? [3, 6, 9][lvl] : [2, 3, 5][lvl];
}

/** Extra gold a strong CPU gets every round. */
export const strongGold = (step: number) => 1 + Math.floor(tierOf(step) / 14);

export const human = (m: MatchState) => m.players[0];
export const alivePlayers = (m: MatchState) => m.players.filter((p) => !p.place);
export const roundLabel = (m: MatchState) => `${m.stage}-${m.round}`;
export const currentKind = (m: MatchState) => roundKind(m.stage, m.round);

// ------------------------------------------------------------ board helpers
export const onBoard = (p: Player) => p.units.filter((u) => u.bench < 0);
export const onBench = (p: Player) => p.units.filter((u) => u.bench >= 0);
export const boardSize = (p: Player) => Math.min(COLS * HALF, p.level + p.boardBonus + onBoard(p).filter((u) => u.items.includes("crown")).length);
/** Bench places: 9, more for the better CPUs at high ranks (room to hold copies for three stars). */
export const benchSize = (p: Player) => BENCH + (p.extraBench ?? 0);
const freeBench = (p: Player) => { for (let i = 0; i < benchSize(p); i++) if (!p.units.some((u) => u.bench === i)) return i; return -1; };
const unitAt = (p: Player, x: number, y: number) => p.units.find((u) => u.bench < 0 && u.x === x && u.y === y);
export const sellValue = (o: Owned) => { const c = arenaUnit(o.unitId)!.cost; const n = 3 ** (o.star - 1); return o.star === 1 ? c : c * n - 1; };

export function placed(p: Player): PlacedUnit[] {
  return onBoard(p).map((u) => ({ unitId: u.unitId, star: u.star, x: u.x, y: u.y, items: u.items, ref: u.uid, bonus: u.bonus }));
}
/** Trait counts of the board as it stands. */
export function boardTraits(p: Player): Record<string, number> {
  return ArenaBattle.traitCounts(placed(p), p.mods.traitBonus ?? 0);
}

/**
 * A unit's fight-start stats with the board as it stands (items, traits, augments, earned
 * stats), and its bare stats (no items, augments or team traits) to show what was added.
 * A bench unit is counted as if it stood on the board.
 */
export function unitPreview(p: Player, uid: number): { now: Fighter; base: Fighter } | null {
  const o = p.units.find((u) => u.uid === uid);
  if (!o) return null;
  const team = placed(p);
  if (o.bench >= 0) {
    let spot = { x: 3, y: ROWS - 1 };
    for (let y = ROWS - 1; y >= HALF; y--) for (let x = 0; x < COLS; x++) if (!unitAt(p, x, y)) spot = { x, y };
    team.push({ unitId: o.unitId, star: o.star, x: spot.x, y: spot.y, items: o.items, ref: o.uid, bonus: o.bonus });
  }
  const now = ArenaBattle.preview({ units: team, mods: p.mods }, uid);
  const base = bareFighter(o.unitId, o.star);
  return now && base ? { now, base } : null;
}

/** A unit alone at a star, with the given items and nothing else (shop, carousel and collection cards). */
export function bareFighter(unitId: string, star: Star, items: string[] = []): Fighter | undefined {
  return ArenaBattle.preview({ units: [{ unitId, star, x: 3, y: ROWS - 1, items, ref: 1 }] }, 1);
}

function addUnit(m: MatchState, p: Player, unitId: string, star: Star = 1, items: string[] = []): Owned | null {
  const b = freeBench(p);
  if (b < 0) return null;
  const o: Owned = { uid: m.nextUid++, unitId, star, items, x: 0, y: 0, bench: b };
  p.units.push(o);
  combineStars(m, p);
  return o;
}

/** Three copies of a unit at the same star become one at the next star (repeats). */
export function combineStars(m: MatchState, p: Player): Owned[] {
  const made: Owned[] = [];
  for (let again = true; again;) {
    again = false;
    const groups = new Map<string, Owned[]>();
    for (const u of p.units) if (u.star < 4) { const k = `${u.unitId}|${u.star}`; groups.set(k, [...(groups.get(k) ?? []), u]); }
    for (const g of groups.values()) {
      if (g.length < 3) continue;
      const three = g.sort((a, b) => (a.bench < 0 ? 0 : 1) - (b.bench < 0 ? 0 : 1) || a.uid - b.uid).slice(0, 3);
      const keep = three[0];
      const items = three.flatMap((u) => u.items);
      // earned stats carry over to the upgraded copy
      const bonus: Record<string, number> = {};
      for (const u of three) for (const [k, v] of Object.entries(u.bonus ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
      keep.bonus = Object.keys(bonus).length ? bonus : undefined;
      p.units = p.units.filter((u) => !three.includes(u) || u === keep);
      keep.star = (keep.star + 1) as Star;
      keep.items = [];
      if (keep.bench === -2) keep.bench = freeBench(p);
      for (const it of items) if (!equip(p, keep, it)) p.items.push(it);
      made.push(keep);
      again = true;
      break;
    }
  }
  return made;
}

/** The highest star buying `n` more copies of a unit would reach (0 when it would not star up). */
export function starAfterBuying(p: Player, unitId: string, n: number): number {
  const c = [0, 0, 0, 0, 0];
  for (const u of p.units) if (u.unitId === unitId) c[u.star]++;
  c[1] += n;
  let best = 0;
  for (let st = 1; st < 4; st++) while (c[st] >= 3) { c[st] -= 3; c[st + 1]++; best = st + 1; }
  return best;
}

// ------------------------------------------------------------ actions (shared by the human and CPUs)
export function buy(m: MatchState, p: Player, slot: number): string | null {
  const id = p.shop[slot];
  if (!id) return "Ô trống.";
  const cost = arenaUnit(id)!.cost;
  if (p.gold < cost) return "Không đủ vàng.";
  if (freeBench(p) < 0) {
    // allowed when it completes a ★2 straight away
    const same = p.units.filter((u) => u.unitId === id && u.star === 1).length;
    if (same < 2) return "Hàng chờ đã đầy.";
    p.units.push({ uid: m.nextUid++, unitId: id, star: 1, items: [], x: 0, y: 0, bench: -2 });
    combineStars(m, p);
  } else addUnit(m, p, id);
  p.gold -= cost;
  if (p.pool[id] !== undefined) p.pool[id] = Math.max(0, p.pool[id] - 1);
  p.shop[slot] = null;
  p.stats.bought++;
  return null;
}

export function sell(_m: MatchState, p: Player, uid: number): string | null {
  const o = p.units.find((u) => u.uid === uid);
  if (!o) return "Không có tướng này.";
  p.gold += sellValue(o);
  if (p.pool[o.unitId] !== undefined) p.pool[o.unitId] += 3 ** (o.star - 1);
  p.items.push(...o.items);
  p.units = p.units.filter((u) => u !== o);
  return null;
}

export function reroll(m: MatchState, p: Player, free = false): string | null {
  if (!free) {
    if (p.freeRollsLeft > 0) p.freeRollsLeft--;
    else if (p.gold < REROLL_COST) return "Không đủ vàng.";
    else p.gold -= REROLL_COST;
  }
  p.stats.rolls += free ? 0 : 1;
  rollShop(m, p);
  return null;
}

export function buyXp(_m: MatchState, p: Player): string | null {
  if (p.level >= MAX_LEVEL) return "Đã tối đa cấp.";
  if (p.gold < XP_COST) return "Không đủ vàng.";
  p.gold -= XP_COST;
  p.stats.xpBought++;
  gainXp(p, 4);
  return null;
}

function gainXp(p: Player, n: number) {
  p.xp += n;
  while (p.level < MAX_LEVEL && p.xp >= XP_NEXT[p.level]) { p.xp -= XP_NEXT[p.level]; p.level++; }
  if (p.level >= MAX_LEVEL) p.xp = 0;
}

/** Moves a unit to a hex of the own half (y 4..7) or a bench slot, swapping with what is there. */
export function moveUnit(_m: MatchState, p: Player, uid: number, to: { x: number; y: number } | { bench: number }): string | null {
  const o = p.units.find((u) => u.uid === uid);
  if (!o) return "Không có tướng này.";
  if ("bench" in to) {
    if (to.bench < 0 || to.bench >= benchSize(p)) return "Sai vị trí.";
    const other = p.units.find((u) => u.bench === to.bench);
    if (other && other !== o) { other.bench = o.bench; other.x = o.x; other.y = o.y; }
    o.bench = to.bench;
    return null;
  }
  if (to.x < 0 || to.x >= COLS || to.y < HALF || to.y >= ROWS) return "Chỉ được đặt ở nửa sân của bạn.";
  const other = unitAt(p, to.x, to.y);
  if (other === o) return null;
  if (!other && o.bench >= 0 && onBoard(p).length >= boardSize(p)) return `Tối đa ${boardSize(p)} tướng trên sân. Lên cấp để thêm.`;
  if (other) { other.bench = o.bench; other.x = o.x; other.y = o.y; }
  o.bench = -1; o.x = to.x; o.y = to.y;
  return null;
}

/** Can an item go on a unit? (3 items max, one emblem per trait, the thief's gloves take all three slots.) */
export function canEquip(p: Player, o: Owned, item: string): string | null {
  void p;
  const it = ITEMS[item];
  if (!it) return "Không có trang bị này.";
  // tools are used on the unit, not worn (see giveItem)
  if (it.fx === "magnet") return o.items.length ? null : "Tướng này không mang trang bị nào.";
  if (it.fx === "dup") return item === "dup3" && arenaUnit(o.unitId)!.cost > 3 ? "Máy Sao Chép chỉ chép được tướng 1–3 vàng." : null;
  if (o.items.includes("thief")) return "Găng Đạo Tặc chiếm cả 3 ô.";
  if (item === "thief" && o.items.length) return "Găng Đạo Tặc cần tướng chưa mang gì.";
  // a component combines with any component the unit already carries (even with 3 items on)
  const j = mergeSlot(o, item);
  if (j >= 0) return canEquip(p, { ...o, items: o.items.filter((_, k) => k !== j) }, combine(o.items[j], item)!);
  if (o.items.length >= 3) return "Đã mang đủ 3 trang bị.";
  if (it.trait && (arenaUnit(o.unitId)!.traits.includes(it.trait) || o.items.some((i) => ITEMS[i]?.trait === it.trait))) return "Tướng đã có tộc hệ này.";
  return null;
}

/** Which carried component a new component would combine with (the first that makes a legal item), or -1. */
function mergeSlot(o: Owned, item: string): number {
  if (!isComponent(item)) return -1;
  for (let k = 0; k < o.items.length; k++) {
    const made = isComponent(o.items[k]) ? combine(o.items[k], item) : undefined;
    if (!made) continue;
    const rest = { ...o, items: o.items.filter((_, x) => x !== k) };
    const t = ITEMS[made].trait;
    if (t && (arenaUnit(o.unitId)!.traits.includes(t) || rest.items.some((i) => ITEMS[i]?.trait === t))) continue;
    return k;
  }
  return -1;
}

function equip(p: Player, o: Owned, item: string): boolean {
  if (canEquip(p, o, item)) return false;
  const j = mergeSlot(o, item);
  if (j >= 0) { o.items[j] = combine(o.items[j], item)!; return true; }
  o.items.push(item);
  return true;
}

/** Gives an item from the item bench to a unit (two components combine on the unit). */
export function giveItem(_m: MatchState, p: Player, index: number, uid: number): string | null {
  const item = p.items[index];
  const o = p.units.find((u) => u.uid === uid);
  if (!item || !o) return "Không hợp lệ.";
  if (item === "magnet") {
    if (!o.items.length) return "Tướng này không mang trang bị nào.";
    p.items.splice(index, 1);
    p.items.push(...o.items);
    o.items = [];
    return null;
  }
  if (ITEMS[item].fx === "dup") {
    const why = copyUnit(_m, p, o, item);
    if (why) return why;
    p.items.splice(index, 1);
    return null;
  }
  const why = canEquip(p, o, item);
  if (why) return why;
  equip(p, o, item);
  p.items.splice(index, 1);
  return null;
}

/** A copier's work: a one-star copy of the unit joins the bench (or completes a star-up straight away). */
function copyUnit(m: MatchState, p: Player, o: Owned, item: string): string | null {
  const u = arenaUnit(o.unitId)!;
  if (item === "dup3" && u.cost > 3) return "Máy Sao Chép chỉ chép được tướng 1–3 vàng.";
  if (freeBench(p) < 0) {
    const same = p.units.filter((x) => x.unitId === o.unitId && x.star === 1).length;
    if (same < 2) return "Hàng chờ đã đầy.";
    p.units.push({ uid: m.nextUid++, unitId: o.unitId, star: 1, items: [], x: 0, y: 0, bench: -2 });
    combineStars(m, p);
  } else addUnit(m, p, o.unitId);
  if (p.pool[o.unitId] > 0) p.pool[o.unitId]--;
  return null;
}

/** Combines two components on the item bench. */
export function craft(_m: MatchState, p: Player, i: number, j: number): string | null {
  if (i === j) return "Chọn 2 mảnh khác nhau.";
  const a = p.items[i], b = p.items[j];
  if (isTool(a) || isTool(b)) return "Hai món này không ghép được.";
  const made = a && b && isComponent(a) && isComponent(b) ? combine(a, b) : undefined;
  if (!made) return "Hai món này không ghép được.";
  p.items = p.items.filter((_, k) => k !== i && k !== j);
  p.items.push(made);
  return null;
}

export function toggleLock(_m: MatchState, p: Player) { p.locked = !p.locked; }

// ------------------------------------------------------------ shop
function rollShop(m: MatchState, p: Player) {
  const odds = ODDS[p.level];
  const inShop: Record<string, number> = {};
  for (let s = 0; s < SHOP; s++) {
    let r = rnd(m) * 100, cost = 1;
    for (let c = 0; c < 5; c++) { r -= odds[c]; if (r < 0) { cost = c + 1; break; } }
    let id: string | null = null;
    // the rolled price first, then cheaper, then dearer if the deck has none left
    const order = [cost, ...[1, 2, 3, 4, 5].filter((c) => c < cost).reverse(), ...[1, 2, 3, 4, 5].filter((c) => c > cost)];
    for (const c of order) {
      const cands = p.deck.filter((d) => arenaUnit(d)!.cost === c && p.pool[d] - (inShop[d] ?? 0) > 0);
      if (!cands.length) continue;
      const total = cands.reduce((a, d) => a + p.pool[d] - (inShop[d] ?? 0), 0);
      let w = rnd(m) * total;
      for (const d of cands) { w -= p.pool[d] - (inShop[d] ?? 0); if (w < 0) { id = d; break; } }
      id ??= cands[cands.length - 1];
      break;
    }
    p.shop[s] = id;
    if (id) inShop[id] = (inShop[id] ?? 0) + 1;
  }
}

// ------------------------------------------------------------ augments
function offerAugments(m: MatchState, p: Player) {
  const owned = new Set(p.augments);
  const pool = AUGMENTS.filter((a) => a.tier === m.augTier && !owned.has(a.id));
  p.augmentOffer = shuffle(m, [...pool]).slice(0, 3).map((a) => a.id);
  p.augmentRerolled = [false, false, false];
}

/** Rerolls one of the three offered augments (once per slot); the other two stay. */
export function rerollAugment(m: MatchState, p: Player, slot: number): string | null {
  if (!p.augmentOffer || !p.augmentOffer[slot]) return "Không có Lõi để đổi.";
  if (!Array.isArray(p.augmentRerolled)) p.augmentRerolled = [false, false, false]; // older saves
  if (p.augmentRerolled[slot]) return "Lõi này đã đổi rồi.";
  const taken = new Set([...p.augments, ...p.augmentOffer]);
  const pool = AUGMENTS.filter((a) => a.tier === m.augTier && !taken.has(a.id));
  if (!pool.length) return "Hết Lõi để đổi.";
  p.augmentOffer[slot] = pick(m, pool).id;
  p.augmentRerolled[slot] = true;
  return null;
}

export function pickAugment(m: MatchState, p: Player, id: string): string | null {
  if (!p.augmentOffer?.includes(id)) return "Lõi không hợp lệ.";
  const a = AUGMENTS.find((x) => x.id === id)!;
  p.augments.push(id);
  p.augmentOffer = null;
  applyAugment(m, p, a);
  if (!p.cpu && m.phase === "augment") m.phase = "plan";
  return null;
}

function randomEmblem(m: MatchState, group?: string): string {
  const em = EMBLEMS().filter((e) => !group || TRAITS[e.trait!].group === group);
  return pick(m, em).id;
}
const randomComponent = (m: MatchState) => pick(m, ["sword", "bow", "rod", "tear", "vest", "cloak", "belt", "glove", "sword", "bow", "rod", "vest", "belt", "seal"]);
const randomFinished = (m: MatchState) => pick(m, FINISHED().filter((i) => i.fx !== "thief")).id;

function poolUnit(m: MatchState, p: Player, cost: number): string | null {
  const c = p.deck.filter((d) => arenaUnit(d)!.cost === cost && p.pool[d] > 0);
  const any = c.length ? c : arenaUnits().filter((u) => u.cost === cost).map((u) => u.id);
  return any.length ? pick(m, any) : null;
}

function applyAugment(m: MatchState, p: Player, a: Augment) {
  for (const fx of a.fx) {
    switch (fx.k) {
      case "gold": p.gold += fx.n; p.stats.goldEarned += fx.n; break;
      case "items": for (let i = 0; i < fx.n; i++) p.items.push(fx.finished ? randomFinished(m) : randomComponent(m)); break;
      case "emblem": p.items.push(randomEmblem(m, fx.group)); break;
      case "xp": gainXp(p, fx.n); break;
      case "units": for (let i = 0; i < fx.n; i++) { const id = poolUnit(m, p, fx.cost); if (!id) continue; if (p.pool[id] !== undefined) p.pool[id]--; if (!addUnit(m, p, id)) p.gold += fx.cost; } break;
      case "boardSize": p.boardBonus += fx.n; break;
      case "hp": p.hp = Math.min(MAX_HP, p.hp + fx.n); break;
      case "income": p.income += fx.n; break;
      case "freeRolls": p.freeRolls += fx.n; p.freeRollsLeft += fx.n; break;
      case "interestCap": p.interestCap += fx.n; break;
      case "xpRound": p.xpRound += fx.n; break;
      case "team": p.mods[fx.stat] = (p.mods[fx.stat] ?? 0) + fx.v; break;
      case "frontline": p.mods.frontline = { hp: (p.mods.frontline?.hp ?? 0) + fx.hp, armor: (p.mods.frontline?.armor ?? 0) + fx.armor }; break;
      case "backline": p.mods.backline = (p.mods.backline ?? 0) + fx.dmg; break;
      case "starPower": p.mods.starPower = (p.mods.starPower ?? 0) + fx.v; break;
      case "traitBonus": p.mods.traitBonus = (p.mods.traitBonus ?? 0) + fx.n; break;
    }
  }
}

// ------------------------------------------------------------ round flow
function startRound(m: MatchState) {
  const kind = currentKind(m);
  const label = roundLabel(m);
  m.fights = [];
  m.pve = null;
  m.loot = {};
  for (const p of alivePlayers(m)) {
    // income for the round just finished (not before the very first)
    if (!(m.stage === 1 && m.round === 1)) {
      const inc = roundIncome(m, p);
      p.lastIncome = inc;
      p.gold += inc.total;
      p.stats.goldEarned += inc.total;
      gainXp(p, 2 + p.xpRound); // 2 experience every round
      // strong CPUs get a little extra gold every round and an item each new stage
      if (p.cpu && p.grade === "strong") {
        const g = strongGold(m.rankStep);
        p.gold += g;
        p.stats.goldEarned += g;
        if (m.round === 1) p.items.push(m.stage >= 4 ? randomFinished(m) : randomComponent(m));
      }
      // at higher ranks the better CPUs also get unit copiers to chase three stars
      if (p.cpu && m.round === 1 && m.stage >= 3) for (const c of cpuCopiers(m, p)) p.items.push(c);
    }
    p.freeRollsLeft = p.freeRolls + (p.bonusRolls ?? 0);
    p.bonusRolls = 0;
    if (!p.locked || p.shop.every((s) => !s)) rollShop(m, p);
    p.locked = false;
  }
  // a new stage brings one more magnetic remover
  if (m.round === 1 && m.stage >= 2) for (const p of alivePlayers(m)) if (!p.cpu) p.items.push("magnet");
  if (AUGMENT_ROUNDS.includes(label)) {
    m.augTier = pick(m, m.stage === 2 ? [1, 1, 2, 2, 3] : m.stage === 3 ? [1, 2, 2, 3] : [2, 2, 3, 3]) as AugTier;
    for (const p of alivePlayers(m)) offerAugments(m, p);
    for (const p of alivePlayers(m)) if (p.cpu) cpuPickAugment(m, p);
  }
  if (kind === "carousel") {
    setupCarousel(m);
    m.phase = "carousel";
    // CPUs before you in the order pick now
    cpuCarouselUntilHuman(m);
    if (human(m).place) finishCarousel(m);
  } else {
    if (kind === "pve") m.pve = pveTeam(m);
    m.phase = human(m).augmentOffer ? "augment" : "plan";
  }
}

/** Gold for a win or loss streak of a length (either sign): 2–3 → 1, 4 → 2, 5+ → 3. */
export const streakGold = (streak: number) => { const s = Math.abs(streak); return s >= 5 ? 3 : s === 4 ? 2 : s >= 2 ? 1 : 0; };
export const interestOf = (p: Player) => Math.min(p.interestCap, Math.floor(p.gold / 10));

/** Gold at the start of a round: 5, interest, the win / loss streak bonus and augment income. */
export function roundIncome(_m: MatchState, p: Player): Income {
  const base = 5; // every round, before interest and streaks
  const interest = interestOf(p);
  const streak = streakGold(p.streak);
  return { base, interest, streak, extra: p.income, total: base + interest + streak + p.income };
}

/** The player has finished planning: CPUs plan, fights are made, combat begins. */
export function ready(m: MatchState): Fight[] {
  if (m.phase === "augment") { const h = human(m); if (h.augmentOffer) pickAugment(m, h, h.augmentOffer[0]); }
  if (m.phase !== "plan" && m.phase !== "augment") return m.fights;
  for (const p of alivePlayers(m)) {
    if (p.cpu) cpuPlan(m, p);
    fillBoard(p);
  }
  m.fights = makeFights(m);
  m.phase = "combat";
  return m.fights;
}

/** Bench units step in when the board has room (as in TFT). */
function fillBoard(p: Player) {
  const free: { x: number; y: number }[] = [];
  for (let y = HALF; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!unitAt(p, x, y)) free.push({ x, y });
  const bench = onBench(p).sort((a, b) => unitPower(b) - unitPower(a));
  while (onBoard(p).length < boardSize(p) && bench.length) {
    const u = bench.shift()!;
    const ranged = arenaUnit(u.unitId)!.stats.range > 1;
    free.sort((a, b) => (ranged ? b.y - a.y : a.y - b.y) || Math.abs(a.x - 3) - Math.abs(b.x - 3));
    const h = free.shift();
    if (!h) break;
    u.bench = -1; u.x = h.x; u.y = h.y;
  }
}

function makeFights(m: MatchState): Fight[] {
  const alive = alivePlayers(m);
  const base = hash(m.seed, m.stage, m.round);
  if (currentKind(m) === "pve") return alive.map((p, i) => ({ a: p.id, b: -1, ghost: false, pve: true, seed: hash(base, i) }));
  // pairings: avoid the last opponents when possible
  let best: [number, number][] = [], bestScore = Infinity;
  for (let tries = 0; tries < 30; tries++) {
    const ids = shuffle(m, alive.map((p) => p.id));
    const pairs: [number, number][] = [];
    let score = 0;
    for (let i = 0; i + 1 < ids.length; i += 2) {
      pairs.push([ids[i], ids[i + 1]]);
      const recent = m.players[ids[i]].lastOpp;
      const at = recent.lastIndexOf(ids[i + 1]);
      if (at >= 0) score += 10 - (recent.length - at);
    }
    if (ids.length % 2) {
      // the odd one fights a copy of someone else ("ghost")
      const ghost = pick(m, ids.slice(0, -1));
      pairs.push([ids[ids.length - 1], -100 - ghost]);
    }
    if (score < bestScore) { best = pairs; bestScore = score; }
    if (!score) break;
  }
  return best.map(([a, b], i) => {
    // the human is always the bottom side of its own fight
    if (b === 0) [a, b] = [b, a];
    return { a, b: b <= -100 ? -100 - b : b, ghost: b <= -100, pve: false, seed: hash(base, i) };
  });
}

/** The two teams and seed of a fight (the screen uses this to play it out). */
export function fightSetup(m: MatchState, f: Fight): { bottom: TeamSetup; top: TeamSetup; seed: number } {
  const team = (p: Player): TeamSetup => ({ units: placed(p).map((u, i) => ({ ...u, items: thiefItems(u.items, hash(f.seed, p.id, i)) })), mods: p.mods });
  const a = m.players[f.a];
  return { bottom: team(a), top: f.pve ? m.pve! : team(m.players[f.b]), seed: f.seed };
}

function thiefItems(items: string[], seed: number): string[] {
  if (!items.includes("thief")) return items;
  const fin = FINISHED().filter((i) => i.fx !== "thief");
  const a = fin[seed % fin.length].id;
  let b = fin[Math.floor(seed / 97) % fin.length].id;
  if (b === a) b = fin[(seed + 1) % fin.length].id;
  return [a, b];
}

export function makeBattle(m: MatchState, f: Fight): ArenaBattle {
  const s = fightSetup(m, f);
  return new ArenaBattle(s.bottom, s.top, s.seed);
}

/** Runs every fight of the round and applies damage, streaks and loot. */
export function resolveCombat(m: MatchState) {
  if (m.phase !== "combat") return;
  const stageDmg = STAGE_DMG[Math.min(m.stage, STAGE_DMG.length - 1)];
  const hpBefore = m.players.map((p) => p.hp);
  for (const f of m.fights) {
    const b = makeBattle(m, f);
    const w = b.run();
    const A = m.players[f.a];
    keepGains(m, A, b, 0);
    if (!f.pve && !f.ghost) keepGains(m, m.players[f.b], b, 1);
    for (const x of b.fighters) if (x.side === 0 && !x.summoned) A.stats.unitDamage[x.unit.id] = (A.stats.unitDamage[x.unit.id] ?? 0) + Math.round(x.dealt);
    if (!f.pve && !f.ghost) {
      const B = m.players[f.b];
      for (const x of b.fighters) if (x.side === 1 && !x.summoned) B.stats.unitDamage[x.unit.id] = (B.stats.unitDamage[x.unit.id] ?? 0) + Math.round(x.dealt);
    }
    const surv = w === -1 ? [] : b.survivors(w);
    const dmg = w === -1 ? stageDmg : stageDmg + surv.reduce((s, u) => s + STAR_DMG[u.star], 0);
    f.result = { winner: w, dmg, survivors: surv.length };
    if (f.pve) {
      if (w !== 0) hurt(A, Math.max(1, Math.round(dmg / 2)));
      m.loot[A.id] = pveLoot(m, w === 0);
      grantLoot(m, A, m.loot[A.id]);
      continue;
    }
    const B = m.players[f.b];
    if (w === 0) { win(m, A, f.ghost ? null : B, dmg); if (!f.ghost) lose(B); }
    else if (w === 1) { lose(A, f.ghost ? undefined : B, dmg); if (!f.ghost) win(m, B, A, 0); }
    else { hurt(A, stageDmg); A.streak = 0; if (!f.ghost) { hurt(B, stageDmg); B.streak = 0; } }
    if (!f.ghost) { A.lastOpp = [...A.lastOpp, B.id].slice(-3); B.lastOpp = [...B.lastOpp, A.id].slice(-3); }
  }
  // eliminations: those who fell this round share the places below the survivors, more HP lost = lower
  const fallen = m.players.filter((p) => !p.place && p.hp <= 0).sort((a, b) => a.hp - b.hp || hpBefore[a.id] - hpBefore[b.id]);
  let place = alivePlayers(m).length;
  for (const p of fallen) { p.place = place--; m.log.push(`${p.name} bị loại (hạng ${p.place}).`); }
  for (const p of alivePlayers(m)) p.stats.roundsSurvived++;
  const left = alivePlayers(m);
  if (left.length <= 1) { for (const p of left) p.place = 1; m.phase = "end"; return; }
  m.phase = "result";
}

/** After a fight: stats units earned for good, and gold / experience / rolls their spells picked up. */
function keepGains(_m: MatchState, p: Player, b: ArenaBattle, side: 0 | 1) {
  for (const g of b.gains(side)) {
    const o = p.units.find((u) => u.uid === g.ref);
    if (o) { o.bonus ??= {}; o.bonus[g.stat] = Math.round(((o.bonus[g.stat] ?? 0) + g.v) * 1000) / 1000; }
  }
  const l = b.loot[side];
  p.gold += l.gold;
  p.stats.goldEarned += l.gold;
  if (l.xp) gainXp(p, l.xp);
  if (l.roll) p.bonusRolls = (p.bonusRolls ?? 0) + l.roll;
}

function hurt(p: Player, n: number) { p.hp -= n; p.stats.taken += n; }
function win(_m: MatchState, p: Player, foe: Player | null, dmg: number) {
  p.stats.wins++;
  p.streak = p.streak > 0 ? p.streak + 1 : 1;
  p.stats.bestStreak = Math.max(p.stats.bestStreak, p.streak);
  p.gold += 1;
  p.stats.goldEarned += 1;
  if (foe && dmg) { hurt(foe, dmg); p.stats.dealt += dmg; }
}
function lose(p: Player, by?: Player, dmg?: number) {
  p.stats.losses++;
  p.streak = p.streak < 0 ? p.streak - 1 : -1;
  if (dmg) hurt(p, dmg);
  if (by && dmg) by.stats.dealt += dmg;
}

/** After the result screen: on to the next round (CPUs keep playing when the human is out). */
export function nextRound(m: MatchState) {
  if (m.phase === "end") return;
  if (human(m).place) { finishWithoutHuman(m); return; }
  advance(m);
  startRound(m);
}

function advance(m: MatchState) {
  m.round++;
  if (m.round > roundsIn(m.stage)) { m.stage++; m.round = 1; }
}

/** Plays the rest of the match among CPUs so every place is known. */
export function finishWithoutHuman(m: MatchState) {
  for (let guard = 0; guard < 80 && m.phase !== "end"; guard++) {
    if (m.phase === "combat") resolveCombat(m);
    if ((m.phase as Phase) === "end") break;
    if (m.phase === "result") { advance(m); startRound(m); }
    if (m.phase === "carousel") finishCarousel(m);
    else if (m.phase === "augment" || m.phase === "plan") { ready(m); resolveCombat(m); }
  }
  if (m.phase !== "end") {
    // a safety net: rank the rest by HP
    const left = alivePlayers(m).sort((a, b) => a.hp - b.hp);
    left.forEach((p, i) => (p.place = left.length - i));
    m.phase = "end";
  }
}

// ------------------------------------------------------------ carousel
function setupCarousel(m: MatchState) {
  const s = m.stage;
  const costs = s === 1 ? [1] : s === 2 ? [1, 2, 2] : s === 3 ? [2, 3, 3] : s === 4 ? [3, 3, 4] : [3, 4, 4, 5];
  const h = human(m);
  const slots: CarouselSlot[] = [];
  for (let i = 0; i < PLAYERS + 1; i++) {
    const cost = pick(m, costs);
    const src = pick(m, alivePlayers(m)).deck.filter((d) => arenaUnit(d)!.cost === cost);
    const unitId = (src.length ? pick(m, src) : null) ?? poolUnit(m, h, cost)!;
    const r = rnd(m);
    const r2 = rnd(m);
    const item = s >= 2 && r2 < (s >= 4 ? 0.04 : 0.06) ? "dup3" : s >= 4 && r2 < 0.07 ? "dup5"
      : s >= 4 && r < 0.15 ? randomEmblem(m) : s >= 3 && r < (s >= 4 ? 0.55 : 0.3) ? randomFinished(m) : randomComponent(m);
    slots.push({ unitId, item, takenBy: null });
  }
  m.carousel = slots;
  const alive = alivePlayers(m);
  m.carouselOrder = m.stage === 1 ? shuffle(m, alive.map((p) => p.id)) : shuffle(m, alive.map((p) => p.id)).sort((a, b) => m.players[a].hp - m.players[b].hp);
}

function cpuCarouselUntilHuman(m: MatchState) {
  for (const id of m.carouselOrder) {
    if (id === 0) return;
    const p = m.players[id];
    if (!m.carousel!.some((c) => c.takenBy === id)) takeCarousel(m, p, cpuCarouselChoice(m, p));
  }
}

function takeCarousel(m: MatchState, p: Player, idx: number) {
  const c = m.carousel![idx];
  c.takenBy = p.id;
  if (!addUnit(m, p, c.unitId, 1, [])) p.gold += arenaUnit(c.unitId)!.cost;
  p.items.push(c.item);
}

/** The human's carousel pick; then the rest pick and the round ends. */
export function pickCarousel(m: MatchState, idx: number): string | null {
  if (m.phase !== "carousel" || !m.carousel) return "Không phải lượt chọn.";
  if (m.carousel[idx]?.takenBy !== null) return "Đã có người lấy.";
  takeCarousel(m, human(m), idx);
  finishCarousel(m);
  return null;
}

/** Who still waits to pick before you (for the screen). */
export const carouselAhead = (m: MatchState) => m.carouselOrder.slice(0, m.carouselOrder.indexOf(0));

function finishCarousel(m: MatchState) {
  for (const id of m.carouselOrder) {
    const p = m.players[id];
    if (p.place || m.carousel!.some((c) => c.takenBy === id)) continue;
    takeCarousel(m, p, cpuCarouselChoice(m, p));
  }
  m.phase = "result";
  // a carousel round has no fight: straight on
  for (const p of alivePlayers(m)) p.stats.roundsSurvived++;
  if (!human(m).place) { advance(m); startRound(m); }
  else m.phase = "result";
}

// ------------------------------------------------------------ monster rounds
/**
 * Monster rounds: a small pack of the same weak monster (like TFT's minions, krugs and wolves),
 * a little bigger each stage; from stage 5 a single big beast.
 */
function pveTeam(m: MatchState): TeamSetup {
  const us = arenaUnits();
  const of = (cost: number) => us.filter((u) => u.cost === cost && u.floor <= Math.max(10, m.stage * 15));
  const [cost, star, n, weaken]: [number, Star, number, number] =
    m.stage === 1 ? [1, 1, m.round === 2 ? 2 : m.round === 3 ? 3 : 4, 0.45]
    : m.stage === 2 ? [2, 1, 4, 0.3]
    : m.stage === 3 ? [3, 1, 4, 0.2]
    : m.stage === 4 ? [4, 1, 3, 0.15]
    : [5, 2, 1, 0];
  const u = pick(m, of(cost));
  const ranged = u.stats.range > 1;
  const rowsOrder = ranged ? [7, 6] : [4, 5];
  const xs = [3, 2, 4, 1, 5];
  const units: PlacedUnit[] = Array.from({ length: n }, (_, i) => ({ unitId: u.id, star, x: xs[i % xs.length], y: rowsOrder[Math.floor(i / xs.length)], items: [] }));
  return { units, mods: weaken ? { hp: -weaken, ad: -weaken, ap: -weaken * 100 } : undefined };
}

function pveLoot(m: MatchState, won: boolean): Loot {
  const l: Loot = { gold: 0, items: [], units: [] };
  const r = rnd(m);
  if (m.stage === 1) {
    l.items.push(randomComponent(m));
    if (m.round >= 3) l.gold += m.round - 2;
    if (m.round === 4 && r < 0.5) l.units.push(pick(m, arenaUnits().filter((u) => u.cost <= 2)).id);
    return l;
  }
  if (!won) { l.items.push(randomComponent(m)); return l; }
  if (m.stage === 2) { l.items.push(randomComponent(m), randomComponent(m)); l.gold += 2; }
  else if (m.stage === 3) { l.items.push(randomComponent(m), randomComponent(m)); if (r < 0.25) l.items.push(randomEmblem(m)); }
  else if (m.stage === 4) { l.items.push(randomFinished(m), randomComponent(m)); if (r < 0.15) l.items.push("thief"); }
  else { l.items.push(randomFinished(m)); if (r < 0.5) l.items.push(randomEmblem(m)); else l.gold += 5; }
  // now and then a unit copier: the basic one from stage 2, the deluxe one (any price) from stage 4
  const c = rnd(m);
  if (m.stage >= 4 && c < 0.12) l.items.push("dup5");
  else if (c < (m.stage >= 4 ? 0.3 : 0.22)) l.items.push("dup3");
  return l;
}

function grantLoot(m: MatchState, p: Player, l: Loot) {
  p.gold += l.gold;
  p.stats.goldEarned += l.gold;
  p.items.push(...l.items);
  for (const u of l.units) if (!addUnit(m, p, u)) p.gold += arenaUnit(u)!.cost;
}

// ------------------------------------------------------------ CPU players
function unitPower(o: Owned): number {
  const u = arenaUnit(o.unitId)!;
  return u.cost * 3 ** (o.star - 1) * (1 + o.items.filter((i) => !isComponent(i)).length * 0.35 + o.items.filter(isComponent).length * 0.15);
}

function cpuPickAugment(m: MatchState, p: Player) {
  const offer = p.augmentOffer!;
  // econ players like gold and income, others like combat power
  const score = (id: string) => {
    const a = AUGMENTS.find((x) => x.id === id)!;
    const econ = a.fx.some((f) => ["gold", "income", "interestCap", "freeRolls"].includes(f.k));
    return rnd(m) + (econ && p.style === "econ" ? 0.4 : 0) + (a.fx.some((f) => f.k === "team" || f.k === "starPower") ? 0.2 : 0);
  };
  const best = [...offer].sort((a, b) => score(b) - score(a))[0];
  pickAugment(m, p, best);
}

function cpuCarouselChoice(m: MatchState, p: Player): number {
  const open = m.carousel!.map((c, i) => ({ c, i })).filter((x) => x.c.takenBy === null);
  const owned = new Set(p.units.map((u) => u.unitId));
  const traits = teamTraitSet(p);
  const val = (c: CarouselSlot) => {
    const u = arenaUnit(c.unitId)!;
    return (owned.has(c.unitId) ? 3 : 0) + (p.focus?.includes(c.unitId) ? 4 : 0) + (p.style === "fast" ? u.cost * 0.5 : 0) + u.traits.filter((t) => traits.has(t)).length + (ITEMS[c.item]?.component ? 0 : 2) + u.cost * 0.3 + rnd(m) * (2 - (p.skill ?? 0.5));
  };
  return open.sort((a, b) => val(b.c) - val(a.c))[0].i;
}

function teamTraitSet(p: Player): Set<string> {
  const counts: Record<string, number> = {};
  for (const id of new Set(p.units.map((u) => u.unitId))) for (const t of arenaUnit(id)!.traits) counts[t] = (counts[t] ?? 0) + 1;
  return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([t]) => t));
}

/** The level a CPU aims for this round (r = stage * 10 + round). */
function targetLevel(m: MatchState, p: Player): number {
  const r = m.stage * 10 + m.round;
  const curve = (steps: [number, number][]) => { let lv = 3; for (const [at, l] of steps) if (r >= at) lv = l; return lv; };
  // the usual curve: 4 at 2-1, 5 at 2-5, 6 at 3-2, 7 at 4-1, 8 at 4-2, 9 at 5-2, 10 late
  const econ = curve([[21, 4], [25, 5], [32, 6], [41, 7], [42, 8], [52, 9], [62, 10]]);
  let lv = econ;
  if (p.style === "fast") lv = curve([[21, 4], [25, 5], [32, 6], [35, 7], [41, 8], [51, 9], [55, 10]]); // 7 at 3-5, 8 at 4-1, 9 at 5-1
  else if (p.style === "reroll" && !p.rerollDone) {
    // get to the level where its price shows up most (5 / 6 / 7) by the round it starts rolling, then stay
    const c = p.focusCost ?? 1;
    lv = Math.min(econ, 4 + c);
    if (r >= rollFrom(c)) lv = 4 + c;
  }
  if (p.grade === "weak" && r >= 32) lv -= 1; // weak players level late
  return Math.max(1, Math.min(MAX_LEVEL, lv));
}

/** When a reroll player starts slow-rolling (r = stage * 10 + round): 1-gold at 2-5, 2-gold at 3-1, 3-gold at 3-5. */
const rollFrom = (cost: number) => (cost <= 1 ? 25 : cost === 2 ? 31 : 35);

/** The round a style spends its gold to find its units ("roll down"). */
function rolldownRound(m: MatchState, p: Player): boolean {
  const r = m.stage * 10 + m.round;
  if (p.style === "fast") return (r === 41 || r === 42) && p.level >= 7 || r === 51 || r === 52; // at 8 (4-1 or 4-2), then at 9 for 5-gold units
  if (p.style === "econ") return r === 42 || r === 52;
  return !!p.rerollDone && r === 42;
}

/** A reroll CPU's targets: the units of its price it has the most copies of (topped up from its deck). */
function updateFocus(m: MatchState, p: Player) {
  if (p.style === "fast" || (p.style === "econ" && carryRank(m.rankStep))) { carryFocus(m, p); return; }
  if (p.style !== "reroll") return;
  const c = p.focusCost ?? 1;
  const weight: Record<string, number> = {};
  for (const o of p.units) if (arenaUnit(o.unitId)!.cost === c) weight[o.unitId] = (weight[o.unitId] ?? 0) + 3 ** (o.star - 1);
  const owned = Object.entries(weight).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const keep = (p.focus ?? []).filter((id) => weight[id]);
  const n = c >= 3 ? 2 : 3; // dearer units: fewer targets, so the copies are not spread thin
  const focus = [...new Set([...keep, ...owned])].slice(0, n);
  for (const id of shuffle(m, p.deck.filter((d) => arenaUnit(d)!.cost === c))) { if (focus.length >= n) break; if (!focus.includes(id)) focus.push(id); }
  p.focus = focus;
  // done once two of them are three stars: from then on it levels like everyone else
  const three = focus.filter((id) => p.units.some((o) => o.unitId === id && o.star >= 3)).length;
  if (three >= Math.min(2, focus.length) || m.stage >= 6) p.rerollDone = true;
}

/** At high ranks a CPU at level 8+ can three-star a 4-gold unit (or, at 9, a 5-gold one). */
export const carryRank = (step: number) => tierOf(step) >= 10;
const fiveRank = (step: number) => tierOf(step) >= 20;

/**
 * A fast player's carries once it reaches 8: the dear units it has the most copies of (4-gold,
 * or 5-gold at 9 in the higher ranks). It buys every copy and, at high ranks, keeps rolling for
 * them until one is three stars.
 */
function carryFocus(m: MatchState, p: Player) {
  if (p.level < 8 || m.stage < 4 || p.grade === "weak") { p.focus = []; return; }
  const c = p.level >= 9 && fiveRank(m.rankStep) ? 5 : 4;
  const weight: Record<string, number> = {};
  for (const o of p.units) { const u = arenaUnit(o.unitId)!; if (u.cost >= 4) weight[o.unitId] = (weight[o.unitId] ?? 0) + 3 ** (o.star - 1) + (u.cost === c ? 0.5 : 0); }
  p.focusCost = c;
  // the main carry first (most copies); a 5-gold carry gets all the attention
  p.focus = Object.entries(weight).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, c === 5 ? 1 : 2);
  p.rerollDone = p.focus.some((id) => p.units.some((o) => o.unitId === id && o.star >= 3));
}

/** One CPU planning turn: augments, levelling, buying, rolling, selling, items and placement. */
export function cpuPlan(m: MatchState, p: Player) {
  if (p.augmentOffer) cpuPickAugment(m, p);
  const skill = p.skill ?? 0.5;
  const weak = p.grade === "weak";
  updateFocus(m, p);
  const rolldown = !weak && rolldownRound(m, p);
  const desperate = p.hp < 30 && !weak;
  // losing again and again in the mid game: spend to get stronger before it is too late
  const stabilise = m.stage >= 3 && p.streak <= -3 && p.hp < 60 && skill >= 0.5;
  // gold kept back for interest: up to 50 from stage 3 (weak players keep a random amount)
  let reserve = m.stage <= 1 ? 0 : m.stage === 2 ? (p.style === "econ" || p.style === "fast" ? 20 : 10) : 50;
  if (weak) reserve = Math.floor(rnd(m) * 40);
  if (stabilise) reserve = Math.min(reserve, 20);
  if (rolldown) reserve = p.style === "fast" && m.stage === 4 && m.round === 1 ? 20 : 10;
  if (desperate) reserve = 0;
  const slowRoll = !weak && p.style === "reroll" && !p.rerollDone && m.stage * 10 + m.round >= rollFrom(p.focusCost ?? 1);
  // slow roll: keep about 40 for interest and roll the rest every round (more when health runs low)
  if (slowRoll && !rolldown && !desperate) reserve = p.hp >= 50 ? 40 : 20;
  // high ranks: a fast player at 8–9 keeps rolling for its 4- or 5-gold carry until it is three stars
  const carryRoll = !weak && (p.style === "fast" || p.style === "econ") && carryRank(m.rankStep) && !!p.focus?.length && !p.rerollDone && p.level >= 8;
  if (carryRoll && !rolldown && !desperate) reserve = Math.min(reserve, p.hp >= 50 ? 30 : 10);
  // level up
  const want = targetLevel(m, p);
  // a fast player spends everything to reach 8, then saves again for 9; the others keep a little
  const xpKeep = rolldown || desperate ? 0 : p.style === "fast" ? (p.level < 8 ? 0 : 30) : m.stage >= 3 && !weak ? 10 : 0;
  while (p.level < want && p.gold >= XP_COST && p.gold - XP_COST >= xpKeep) buyXp(m, p);
  // buy what fits, then roll for more while over the reserve
  const shop = () => {
    for (let s = 0; s < SHOP; s++) {
      const id = p.shop[s];
      if (!id) continue;
      const u = arenaUnit(id)!;
      if (p.gold < u.cost) continue;
      if (weak && rnd(m) < 0.35) continue; // weak players miss things
      const key = keyUnit(p, u);
      const room = onBoard(p).length + onBench(p).length < boardSize(p);
      if (!wantUnit(p, u, skill)) continue;
      // anything else only to fill the board, or with spare gold and a near-empty bench (weak players buy anything)
      if (!(key || room || (p.gold - u.cost >= reserve && onBench(p).length < 4) || (weak && p.gold - u.cost >= reserve))) continue;
      if (freeBench(p) < 0) sellWorst(m, p, id);
      buy(m, p, s);
    }
  };
  if (!weak) cleanBench(m, p);
  shop();
  let rolls = 0;
  const maxRolls = weak ? (p.gold > 60 ? 4 : rnd(m) < 0.3 ? 1 : 0) : rolldown ? 40 : desperate ? 25 : slowRoll || carryRoll ? 30 : stabilise ? 10 : Math.round(skill * 3);
  while (p.gold - REROLL_COST >= reserve && rolls < maxRolls && (p.level >= want || desperate)) {
    reroll(m, p);
    shop();
    rolls++;
    updateFocus(m, p);
  }
  if (p.freeRollsLeft > 0) { reroll(m, p); shop(); }
  cpuItems(m, p);
  cpuPlace(m, p);
}

/** A unit the CPU's plan is built on: a copy of something it owns, a reroll target, a dear unit for a fast player. */
function keyUnit(p: Player, u: ArenaUnit): boolean {
  if (p.units.some((o) => o.unitId === u.id && o.star < 4)) return true;
  if (p.style === "reroll" && p.focus?.includes(u.id)) return true;
  if (p.style === "fast" && u.cost >= 4 && p.level >= 7) return true;
  if (p.focus?.includes(u.id)) return true;
  return false;
}

function wantUnit(p: Player, u: ArenaUnit, skill: number): boolean {
  if (keyUnit(p, u)) return true;
  // a fast player at a high level does not bother with cheap units it does not own
  if (p.style === "fast" && p.level >= 8 && u.cost <= 2) return p.units.length < boardSize(p);
  const traits = teamTraitSet(p);
  const fit = u.traits.filter((t) => traits.has(t)).length;
  const room = p.units.length < boardSize(p) + 3;
  return fit >= (skill > 0.6 ? 2 : 1) || (room && u.cost >= 2) || p.units.length < boardSize(p);
}

/** Sells bench units that lead nowhere (single copies of units the plan does not need), keeping a few. */
function cleanBench(m: MatchState, p: Player) {
  const junk = onBench(p).filter((o) => o.star === 1 && !o.items.length && p.units.filter((x) => x.unitId === o.unitId).length < 2 && !keyUnitOwned(p, o))
    .sort((a, b) => unitPower(a) - unitPower(b));
  const keep = m.stage <= 2 ? 3 : 2;
  for (const o of junk.slice(0, Math.max(0, junk.length - keep))) sell(m, p, o.uid);
}
const keyUnitOwned = (p: Player, o: Owned) => (p.style === "reroll" && !!p.focus?.includes(o.unitId)) || (p.style === "fast" && arenaUnit(o.unitId)!.cost >= 4);

function sellWorst(m: MatchState, p: Player, keepId: string) {
  const bench = onBench(p).filter((o) => o.unitId !== keepId && p.units.filter((x) => x.unitId === o.unitId).length < 2 && !p.focus?.includes(o.unitId));
  const worst = bench.sort((a, b) => unitPower(a) - unitPower(b))[0];
  if (worst) sell(m, p, worst.uid);
}

function cpuItems(m: MatchState, p: Player) {
  // pair up components on the bench, then hand items to the strongest units
  for (let again = true; again;) {
    again = false;
    const comps = p.items.map((it, i) => ({ it, i })).filter((x) => isComponent(x.it));
    for (let a = 0; a < comps.length && !again; a++)
      for (let b = a + 1; b < comps.length && !again; b++)
        if (combine(comps[a].it, comps[b].it) && (comps[a].it !== "seal" || comps[b].it !== "seal" || rnd(m) < 0.5)) { craft(m, p, comps[a].i, comps[b].i); again = true; }
  }
  const carriers = [...p.units].sort((a, b) => unitPower(b) - unitPower(a));
  for (let i = p.items.length - 1; i >= 0; i--) {
    const it = p.items[i];
    if (it === "magnet") continue; // CPUs keep their items on
    if (ITEMS[it].fx === "dup") {
      // copy the unit closest to its next star (dearest first)
      const focus = (o: Owned) => (p.focus?.[0] === o.unitId && o.star < 3 ? 2 : p.focus?.includes(o.unitId) && o.star < 3 ? 1 : 0) + (it === "dup5" && arenaUnit(o.unitId)!.cost >= 4 ? 0.5 : 0);
      const goal = [...p.units].filter((o) => o.star < 4 && !canEquip(p, o, it))
        .sort((a, b) => focus(b) - focus(a) || p.units.filter((x) => x.unitId === b.unitId && x.star === b.star).length - p.units.filter((x) => x.unitId === a.unitId && x.star === a.star).length || unitPower(b) - unitPower(a))[0];
      // a fast player keeps deluxe copiers for its 4- / 5-gold carry
      if (it === "dup5" && (p.style === "fast" || (p.style === "econ" && carryRank(m.rankStep))) && !p.focus?.length && m.stage < 5) continue;
      if (!goal) continue;
      if (freeBench(p) < 0) sellWorst(m, p, goal.unitId); // make room for the copy
      giveItem(m, p, i, goal.uid);
      continue;
    }
    if (isComponent(it) && p.items.filter(isComponent).length >= 2 && m.stage < 4) continue; // wait for a pair
    const defensive = ["vest", "cloak", "belt"].some((c) => ITEMS[it].parts?.includes(c)) && !["sword", "bow", "rod", "glove"].some((c) => ITEMS[it].parts?.includes(c));
    const order = defensive
      ? carriers.filter((o) => ["tank", "brute"].includes(arenaUnit(o.unitId)!.role)).concat(carriers)
      : carriers.filter((o) => !["tank"].includes(arenaUnit(o.unitId)!.role)).concat(carriers);
    const to = order.find((o) => !canEquip(p, o, it));
    if (to) giveItem(m, p, i, to.uid);
  }
}

function cpuPlace(m: MatchState, p: Player) {
  // choose the board: strongest units, favouring shared traits
  const size = boardSize(p);
  const chosen: Owned[] = [];
  const left = [...p.units];
  const unique = (o: Owned) => !chosen.some((c) => c.unitId === o.unitId);
  while (chosen.length < size && left.length) {
    const counts: Record<string, number> = {};
    for (const c of chosen) for (const t of arenaUnit(c.unitId)!.traits) counts[t] = (counts[t] ?? 0) + 1;
    const score = (o: Owned) => unitPower(o) + arenaUnit(o.unitId)!.traits.reduce((s, t) => s + (unique(o) && counts[t] ? (traitTier(t, counts[t] + 1) > traitTier(t, counts[t]) ? 3 : 1) : 0), 0) * (p.skill ?? 0.5);
    left.sort((a, b) => score(b) - score(a));
    chosen.push(left.shift()!);
  }
  // everything to the bench first, then place
  let slot = 0;
  for (const o of p.units) { if (!chosen.includes(o)) { o.bench = slot++; } }
  const hexes: string[] = [];
  const free = (x: number, y: number) => !hexes.includes(`${x},${y}`);
  const frontXs = [3, 2, 4, 1, 5, 0, 6];
  const roleOrder = (o: Owned) => ({ tank: 0, brute: 1, assassin: 2, support: 3, mage: 4, marksman: 5 })[arenaUnit(o.unitId)!.role];
  chosen.sort((a, b) => roleOrder(a) - roleOrder(b));
  for (const o of chosen) {
    const u = arenaUnit(o.unitId)!;
    // weak players put units anywhere; the others put tanks in front and casters behind
    const rows = p.grade === "weak" && rnd(m) < 0.6 ? shuffle(m, [4, 5, 6, 7]) : u.role === "assassin" ? [7, 6] : RANGED.includes(u.role) ? [7, 6, 5] : [4, 5, 6];
    const xs = u.role === "assassin" ? [0, 6, 1, 5] : frontXs;
    let spot: { x: number; y: number } | null = null;
    for (const y of rows) { const x = xs.find((xx) => free(xx, y)); if (x !== undefined) { spot = { x, y }; break; } }
    if (!spot) for (let y = HALF; y < ROWS && !spot; y++) for (let x = 0; x < COLS; x++) if (free(x, y)) { spot = { x, y }; break; }
    if (!spot) { o.bench = slot++; continue; }
    hexes.push(`${spot.x},${spot.y}`);
    o.bench = -1; o.x = spot.x; o.y = spot.y;
  }
}

// ------------------------------------------------------------ end of match
export interface MatchSummary {
  place: number; rounds: string; stats: PlayerStats; topUnits: { unitId: string; dmg: number }[]; board: Owned[]; traits: Record<string, number>;
  standings: { id: number; name: string; icon: string; place: number; cpu: boolean }[];
}
export function summary(m: MatchState): MatchSummary {
  const h = human(m);
  const top = Object.entries(h.stats.unitDamage).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([unitId, dmg]) => ({ unitId, dmg }));
  return {
    place: h.place || 1, rounds: roundLabel(m), stats: h.stats, topUnits: top, board: onBoard(h), traits: boardTraits(h),
    standings: [...m.players].sort((a, b) => (a.place || 1) - (b.place || 1)).map((p) => ({ id: p.id, name: p.name, icon: p.icon, place: p.place || 1, cpu: p.cpu })),
  };
}
