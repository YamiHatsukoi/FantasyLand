/**
 * Arena match flow, as in Teamfight Tactics: eight players (you and seven CPUs) go through
 * stages of rounds — carousels, monster rounds, player fights — buying units from their own
 * pool, levelling, combining three copies into a higher star (up to ★4), crafting items and
 * picking augments ("Lõi"). The state is plain data (it can be saved as JSON); the functions
 * below change it. Fights are deterministic: the screen replays the human's fight from
 * `fightSetup` while `resolveCombat` runs every fight to get the results.
 */
import { ArenaBattle, type PlacedUnit, type TeamMods, type TeamSetup } from "./combat";
import { AUGMENTS, type AugTier, type Augment } from "./augments";
import { COLS, HALF, ROWS } from "./hex";
import { EMBLEMS, FINISHED, ITEMS, combine, isComponent } from "./items";
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
export const DECK_MIN = 40;
export const DECK_MAX_FIVE = 8;
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
  augmentRerolled: boolean;
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
  /** CPU personality. */
  style?: "econ" | "reroll" | "fast";
  skill?: number; // 0..1
}

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

/** A random legal deck from floors 1..maxFloor. */
export function randomDeck(maxFloor: number, rand: () => number): string[] {
  const pool = arenaUnits().filter((u) => u.floor <= maxFloor);
  const five = pool.filter((u) => u.cost === 5), rest = pool.filter((u) => u.cost !== 5);
  const sh = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fives = sh([...five]).slice(0, Math.min(DECK_MAX_FIVE, Math.max(3, Math.round(DECK_SIZE * 0.12))));
  const others = sh([...rest]).slice(0, DECK_SIZE - fives.length);
  return [...fives, ...others].map((u) => u.id);
}

/** Checks a player's deck: exactly 50 (or every unlocked unit when fewer than 50, at least 40), at most 8 five-cost. */
export function deckProblem(deck: string[], unlocked: number): string | null {
  const need = Math.min(DECK_SIZE, unlocked);
  if (unlocked < DECK_MIN) return `Cần mở khóa ít nhất ${DECK_MIN} tướng.`;
  if (new Set(deck).size !== deck.length) return "Bể tướng có tướng trùng.";
  if (deck.length !== need) return `Bể tướng phải có đúng ${need} tướng (đang có ${deck.length}).`;
  if (deck.some((id) => !arenaUnit(id))) return "Bể tướng có tướng không tồn tại.";
  const fives = deck.filter((id) => arenaUnit(id)!.cost === 5).length;
  if (fives > DECK_MAX_FIVE) return `Tối đa ${DECK_MAX_FIVE} tướng 5 vàng (đang có ${fives}).`;
  return null;
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
    deck: [...deck], pool, augments: [], augmentOffer: null, augmentRerolled: false, mods: {}, income: 0, freeRolls: 0, freeRollsLeft: 0,
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
  const names = shuffle(m, [...CPU_NAMES]);
  const maxFloor = cpuMaxFloor(o.rankStep);
  const skill = Math.min(1, 0.25 + tierOf(o.rankStep) / 40);
  for (let i = 1; i < PLAYERS; i++) {
    const p = newPlayer(m, i, names[i - 1], pick(m, CPU_ICONS), true, randomDeck(maxFloor, () => rnd(m)));
    p.style = pick(m, ["econ", "econ", "reroll", "fast"] as const);
    p.skill = Math.max(0, Math.min(1, skill + (rnd(m) - 0.5) * 0.3));
    m.players.push(p);
  }
  // the augment tier of each augment round is the same for everyone, like in TFT
  m.augTier = 1;
  startRound(m);
  return m;
}

export const human = (m: MatchState) => m.players[0];
export const alivePlayers = (m: MatchState) => m.players.filter((p) => !p.place);
export const roundLabel = (m: MatchState) => `${m.stage}-${m.round}`;
export const currentKind = (m: MatchState) => roundKind(m.stage, m.round);

// ------------------------------------------------------------ board helpers
export const onBoard = (p: Player) => p.units.filter((u) => u.bench < 0);
export const onBench = (p: Player) => p.units.filter((u) => u.bench >= 0);
export const boardSize = (p: Player) => Math.min(COLS * HALF, p.level + p.boardBonus + onBoard(p).filter((u) => u.items.includes("crown")).length);
const freeBench = (p: Player) => { for (let i = 0; i < BENCH; i++) if (!p.units.some((u) => u.bench === i)) return i; return -1; };
const unitAt = (p: Player, x: number, y: number) => p.units.find((u) => u.bench < 0 && u.x === x && u.y === y);
export const sellValue = (o: Owned) => { const c = arenaUnit(o.unitId)!.cost; const n = 3 ** (o.star - 1); return o.star === 1 ? c : c * n - 1; };

export function placed(p: Player): PlacedUnit[] {
  return onBoard(p).map((u) => ({ unitId: u.unitId, star: u.star, x: u.x, y: u.y, items: u.items, ref: u.uid, bonus: u.bonus }));
}
/** Trait counts of the board as it stands. */
export function boardTraits(p: Player): Record<string, number> {
  return ArenaBattle.traitCounts(placed(p), p.mods.traitBonus ?? 0);
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
    if (to.bench < 0 || to.bench >= BENCH) return "Sai vị trí.";
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
  if (o.items.includes("thief")) return "Găng Đạo Tặc chiếm cả 3 ô.";
  if (item === "thief" && o.items.length) return "Găng Đạo Tặc cần tướng chưa mang gì.";
  const last = o.items[o.items.length - 1];
  if (isComponent(item) && last && isComponent(last)) {
    const made = combine(last, item);
    if (made) return canEquip(p, { ...o, items: o.items.slice(0, -1) }, made);
  }
  if (o.items.length >= 3) return "Đã mang đủ 3 trang bị.";
  if (it.trait && (arenaUnit(o.unitId)!.traits.includes(it.trait) || o.items.some((i) => ITEMS[i]?.trait === it.trait))) return "Tướng đã có tộc hệ này.";
  return null;
}

function equip(p: Player, o: Owned, item: string): boolean {
  if (canEquip(p, o, item)) return false;
  const last = o.items[o.items.length - 1];
  if (isComponent(item) && last && isComponent(last)) {
    const made = combine(last, item);
    if (made) { o.items.pop(); o.items.push(made); return true; }
  }
  o.items.push(item);
  return true;
}

/** Gives an item from the item bench to a unit (two components combine on the unit). */
export function giveItem(_m: MatchState, p: Player, index: number, uid: number): string | null {
  const item = p.items[index];
  const o = p.units.find((u) => u.uid === uid);
  if (!item || !o) return "Không hợp lệ.";
  const why = canEquip(p, o, item);
  if (why) return why;
  equip(p, o, item);
  p.items.splice(index, 1);
  return null;
}

/** Combines two components on the item bench. */
export function craft(_m: MatchState, p: Player, i: number, j: number): string | null {
  if (i === j) return "Chọn 2 mảnh khác nhau.";
  const a = p.items[i], b = p.items[j];
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
  p.augmentRerolled = false;
}

export function rerollAugments(m: MatchState, p: Player): string | null {
  if (!p.augmentOffer || p.augmentRerolled) return "Đã hết lượt đổi Lõi.";
  offerAugments(m, p);
  p.augmentRerolled = true;
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
      const income = roundIncome(m, p);
      p.gold += income;
      p.stats.goldEarned += income;
      if (m.stage >= 2) gainXp(p, 2 + p.xpRound);
      else if (m.round === 2) gainXp(p, 2);
    }
    p.freeRollsLeft = p.freeRolls + (p.bonusRolls ?? 0);
    p.bonusRolls = 0;
    if (!p.locked || p.shop.every((s) => !s)) rollShop(m, p);
    p.locked = false;
  }
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

function roundIncome(m: MatchState, p: Player): number {
  if (m.stage === 1) return m.round === 2 ? 2 : m.round === 3 ? 2 : 3;
  const prevStage1End = m.stage === 2 && m.round === 1;
  const base = prevStage1End ? 4 : 5;
  const interest = Math.min(p.interestCap, Math.floor(p.gold / 10));
  const s = Math.abs(p.streak);
  const streak = s >= 5 ? 3 : s === 4 ? 2 : s >= 2 ? 1 : 0;
  return base + interest + streak + p.income;
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
    const item = s >= 4 && r < 0.15 ? randomEmblem(m) : s >= 3 && r < (s >= 4 ? 0.55 : 0.3) ? randomFinished(m) : randomComponent(m);
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
function pveTeam(m: MatchState): TeamSetup {
  const us = arenaUnits();
  const of = (cost: number) => us.filter((u) => u.cost === cost && u.floor <= Math.max(10, m.stage * 15));
  const comp: [number, Star][] =
    m.stage === 1 ? (m.round === 2 ? [[1, 1], [1, 1]] : m.round === 3 ? [[1, 1], [1, 1], [1, 1]] : [[1, 1], [1, 1], [2, 1], [1, 1]])
    : m.stage === 2 ? [[2, 2], [2, 2], [1, 2], [1, 2], [3, 1]]
    : m.stage === 3 ? [[5, 1], [2, 2], [2, 2], [3, 2], [3, 1], [1, 2]]
    : m.stage === 4 ? [[5, 2], [3, 2], [3, 2], [4, 1], [4, 1], [2, 2], [2, 2]]
    : [[5, 3], [4, 2], [4, 2], [4, 2], [3, 2], [3, 2], [5, 2], [3, 2]];
  const units: PlacedUnit[] = [];
  const taken = new Set<string>();
  for (const [cost, star] of comp) {
    const u = pick(m, of(cost));
    const ranged = u.stats.range > 1;
    let spot = { x: 3, y: ranged ? 7 : 4 };
    for (const y of ranged ? [7, 6, 5, 4] : [4, 5, 6, 7]) {
      const xs = [3, 2, 4, 1, 5, 0, 6].filter((x) => !taken.has(`${x},${y}`));
      if (xs.length) { spot = { x: xs[0], y }; break; }
    }
    taken.add(`${spot.x},${spot.y}`);
    units.push({ unitId: u.id, star, ...spot, items: [] });
  }
  return { units };
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
  return u.cost * 3 ** (o.star - 1) * (1 + o.items.length * 0.25);
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
    return (owned.has(c.unitId) ? 3 : 0) + u.traits.filter((t) => traits.has(t)).length + (ITEMS[c.item]?.component ? 0 : 2) + u.cost * 0.3 + rnd(m) * (2 - (p.skill ?? 0.5));
  };
  return open.sort((a, b) => val(b.c) - val(a.c))[0].i;
}

function teamTraitSet(p: Player): Set<string> {
  const counts: Record<string, number> = {};
  for (const id of new Set(p.units.map((u) => u.unitId))) for (const t of arenaUnit(id)!.traits) counts[t] = (counts[t] ?? 0) + 1;
  return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([t]) => t));
}

function targetLevel(m: MatchState, p: Player): number {
  const r = m.stage * 10 + m.round;
  const fast = p.style === "fast" ? 1 : 0, slow = p.style === "reroll" ? 1 : 0;
  if (r < 21) return 3;
  if (r < 25) return 4 + (fast && r >= 22 ? 1 : 0);
  if (r < 32) return 5 + fast;
  if (r < 41) return 6 + fast;
  if (r < 45) return 7 + fast - slow;
  if (r < 51) return 8 - slow;
  if (r < 55) return 8 + fast - slow;
  if (r < 61) return 9 - slow;
  return 10 - slow;
}

/** One CPU planning turn: augments, levelling, buying, rolling, selling, items and placement. */
export function cpuPlan(m: MatchState, p: Player) {
  if (p.augmentOffer) cpuPickAugment(m, p);
  const skill = p.skill ?? 0.5;
  const rolldown = p.style === "reroll" ? m.stage === 3 && m.round === 2 : p.style === "fast" ? m.stage === 4 && m.round === 2 : m.stage === 4 && m.round === 1;
  const desperate = p.hp < 35;
  let reserve = m.stage <= 1 ? 0 : m.stage === 2 ? 20 : 50;
  if (p.style === "reroll" && m.stage >= 3) reserve = 30;
  if (rolldown || desperate) reserve = 10;
  // level up
  const want = targetLevel(m, p);
  while (p.level < want && p.gold >= XP_COST && (p.gold - XP_COST >= Math.min(reserve, 10) || rolldown || desperate)) buyXp(m, p);
  // buy what fits, then roll for more while over the reserve
  const shop = () => {
    for (let s = 0; s < SHOP; s++) {
      const id = p.shop[s];
      if (!id) continue;
      const u = arenaUnit(id)!;
      if (p.gold < u.cost) continue;
      if (wantUnit(p, u, skill) && (p.gold - u.cost >= reserve - 8 || p.units.some((o) => o.unitId === id) || onBoard(p).length + onBench(p).length < boardSize(p))) {
        if (freeBench(p) < 0) sellWorst(m, p, id);
        buy(m, p, s);
      }
    }
  };
  shop();
  let rolls = 0;
  const maxRolls = rolldown ? 30 : desperate ? 15 : 3;
  while (p.gold - REROLL_COST >= reserve && rolls < maxRolls && p.level >= want - (p.style === "reroll" ? 1 : 0)) {
    reroll(m, p);
    shop();
    rolls++;
  }
  if (p.freeRollsLeft > 0) { reroll(m, p); shop(); }
  cpuItems(m, p);
  cpuPlace(m, p);
}

function wantUnit(p: Player, u: ArenaUnit, skill: number): boolean {
  const copies = p.units.filter((o) => o.unitId === u.id);
  if (copies.some((o) => o.star < 4)) return true;
  const traits = teamTraitSet(p);
  const fit = u.traits.filter((t) => traits.has(t)).length;
  const room = p.units.length < boardSize(p) + 3;
  return fit >= (skill > 0.6 ? 2 : 1) || (room && u.cost >= 2) || p.units.length < boardSize(p);
}

function sellWorst(m: MatchState, p: Player, keepId: string) {
  const bench = onBench(p).filter((o) => o.unitId !== keepId && p.units.filter((x) => x.unitId === o.unitId).length < 2);
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
    const rows = u.role === "assassin" ? [7, 6] : RANGED.includes(u.role) ? [7, 6, 5] : [4, 5, 6];
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
