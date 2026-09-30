/**
 * Level scale. Levels run 1–200 (the last gatekeeper stands at 200), but every formula
 * (stats, experience, shields, rewards) works on "power", where two levels make one step.
 * Level 2L−1 is exactly as strong as level L was when the cap was 99, so the balance is kept
 * and the numbers simply stretch out.
 */
export const MAX_LEVEL = 200;
/** Power of a level (1 → 1, 3 → 2, 199 → 100). */
export const power = (level: number) => (Math.max(1, level) + 1) / 2;
/** A level written on the old 1–99 scale, moved onto the new one. */
export const fromOldLevel = (old: number) => Math.max(1, Math.round(old * 2 - 1));
/** Levels per old level: fixed offsets ("a lair is 3 levels up") are multiplied by this. */
export const LEVEL_STEP = 2;
/** Stat points the hero has earned in total by a level (1.5 per level, 3 per old level). */
export const pointsAtLevel = (level: number) => Math.floor(1.5 * (Math.max(1, level) - 1));
