/**
 * Crit and dodge are ratings, not raw percentages: each extra point is worth a little less
 * than the one before, and both have a hard ceiling so nothing becomes untouchable.
 *   dodge: 10 → 8.6%, 20 → 15%, 40 → 24%, 60 → 30%, cap 35%
 *   crit:  10 → 9%,   20 → 16%, 50 → 32%, 80 → 42%, cap 60%
 */
export const DODGE_CAP = 0.35;
export const CRIT_CAP = 0.6;
const DODGE_K = 60;
const CRIT_K = 90;

export function dodgeChance(rating: number): number {
  const r = Math.max(0, rating);
  return Math.min(DODGE_CAP, (r * DODGE_K) / (r + DODGE_K) / 100);
}
export function critChance(rating: number): number {
  const r = Math.max(0, rating);
  return Math.min(CRIT_CAP, (r * CRIT_K) / (r + CRIT_K) / 100);
}
/** "12.5%" style label for a rating. */
export const pctLabel = (x: number) => `${Math.round(x * 1000) / 10}%`;
