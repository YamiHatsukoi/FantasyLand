/**
 * Arena ranks: 40 tiers, each with three divisions (III → II → I) of 100 points. A tier is
 * named after a monster, from a sewer rat to the Arena Overlord. Points per placement shrink
 * on wins and grow on losses as the tier rises, so the top is hard to hold.
 */
export const TIER_NAMES = [
  "Chuột Cống", "Dơi Hang", "Slime", "Nấm Lùn", "Sói Non", "Lợn Rừng", "Bọ Cạp", "Rắn Độc", "Nhện Đá", "Ong Chúa",
  "Sói Xám", "Gấu Nâu", "Đại Bàng", "Linh Miêu", "Hổ Răng Kiếm", "Người Đá", "Bóng Ma", "Thây Ma", "Yêu Tinh", "Quỷ Lửa",
  "Kỳ Lân", "Sư Ưng", "Mãng Xà", "Người Khổng Lồ", "Ma Cà Rồng", "Thủy Quái", "Phượng Hoàng", "Lôi Điểu", "Băng Long", "Hỏa Long",
  "Hắc Long", "Cửu Vĩ Hồ", "Cự Thú", "Kraken", "Long Vương", "Ma Thần", "Thiên Thần Sa Ngã", "Thần Long", "Huyền Thoại", "Chúa Tể Đấu Trường",
];
export const TIER_ICONS = [
  "🐀", "🦇", "🟢", "🍄", "🐺", "🐗", "🦂", "🐍", "🕷️", "🐝", "🐺", "🐻", "🦅", "🐈", "🐯", "🗿", "👻", "🧟", "👺", "😈",
  "🦄", "🦅", "🐍", "🗻", "🧛", "🦑", "🔥", "⚡", "❄️", "🐉", "🐲", "🦊", "🦣", "🐙", "🌊", "👹", "🪽", "🐉", "🌟", "👑",
];
export const TIERS = TIER_NAMES.length; // 40
export const DIVS = 3;
export const POINTS_PER_DIV = 100;
/** The last step (tier 40, division I) holds any number of points. */
export const MAX_STEP = TIERS * DIVS - 1;

export interface RankState { step: number; lp: number; best: number }
export const newRank = (): RankState => ({ step: 0, lp: 0, best: 0 });

export const tierOf = (step: number) => Math.floor(step / DIVS); // 0..39
export const divOf = (step: number) => step % DIVS; // 0 = III, 2 = I
const DIV_NAMES = ["III", "II", "I"];
export function rankName(step: number): string {
  return `${TIER_NAMES[tierOf(step)]} ${DIV_NAMES[divOf(step)]}`;
}
export const rankIcon = (step: number) => TIER_ICONS[tierOf(step)];

const BASE = [40, 30, 20, 10, -10, -20, -30, -40];

/** Points won or lost for a placement (1..8) at a rank step. */
export function lpDelta(step: number, place: number): number {
  const t = tierOf(step) / (TIERS - 1); // 0..1
  const b = BASE[Math.max(1, Math.min(8, place)) - 1];
  return Math.round(b > 0 ? b * (1.5 - t) : b * (0.5 + t));
}

export interface RankChange { before: RankState; after: RankState; delta: number; promoted: boolean; demoted: boolean; newTiers: number[] }

/** Applies a placement. Points carry over across divisions both ways; nobody drops below zero. */
export function applyResult(r: RankState, place: number): RankChange {
  const before = { ...r };
  const delta = lpDelta(r.step, place);
  let step = r.step, lp = r.lp + delta;
  while (lp >= POINTS_PER_DIV && step < MAX_STEP) { lp -= POINTS_PER_DIV; step++; }
  while (lp < 0 && step > 0) { step--; lp += POINTS_PER_DIV; }
  if (step === 0 && lp < 0) lp = 0;
  if (step === MAX_STEP) lp = Math.max(0, lp);
  const best = Math.max(r.best, step);
  const newTiers: number[] = [];
  for (let t = tierOf(r.best) + 1; t <= tierOf(best); t++) newTiers.push(t);
  const after = { step, lp, best };
  return { before, after, delta, promoted: step > before.step, demoted: step < before.step, newTiers };
}

/** Gold for a finished match, by placement, growing with the tier. */
export function matchReward(step: number, place: number): number {
  const base = [400, 300, 230, 170, 120, 90, 70, 50][Math.max(1, Math.min(8, place)) - 1];
  return Math.round(base * (1 + tierOf(step) * 0.08));
}

/** What reaching a tier for the first time gives (index 0..39). */
export function tierReward(tier: number): { gold: number; items: Record<string, number> } {
  const gold = 500 + tier * 250;
  const items: Record<string, number> = {};
  if (tier % 5 === 4) items.pet_egg = 1; // every fifth tier
  if (tier % 3 === 2) items.monster_core = 1 + Math.floor(tier / 10);
  if (tier >= 10 && tier % 2 === 0) items.mana_crystal = 2 + Math.floor(tier / 8);
  return { gold, items };
}
