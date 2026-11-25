/**
 * Data format of an Adventure book (gamebook). A book is pure data: sections linked by
 * choices, plus the items and enemies they mention. The engine and the screens read it.
 *
 * Images are optional: a path is relative to `public/adventure/<book id>/`.
 * Without one (or if it fails to load) a generated illustration is shown instead.
 */

export type StatId = "skill" | "stamina" | "luck";

export type Cond =
  | { has: string; n?: number }
  | { flag: string }
  | { notFlag: string }
  | { gold: number }
  | { stat: StatId; min: number }
  | { visited: string }
  | { all: Cond[] }
  | { any: Cond[] };

export type Effect =
  /** Changes a stat; it never goes above its starting value (FF rule) unless `over`. */
  | { stat: StatId; add: number; over?: boolean }
  /** Changes the starting (maximum) value of a stat, and the stat with it. */
  | { statMax: StatId; add: number }
  | { gold: number }
  | { give: string; n?: number }
  | { take: string; n?: number }
  | { flag: string; v?: boolean }
  | { provisions: number };

export interface Choice {
  text: string;
  to: string;
  cond?: Cond;
  /** Hide the choice when its condition fails (default: shown greyed out). */
  hide?: boolean;
  fx?: Effect[];
}

export interface Fight {
  enemies: string[];
  win: string;
  /** Without it, losing the fight is death. */
  lose?: string;
  /** Escape is allowed: the hero takes 2 damage and goes there. */
  flee?: string;
  /** All enemies attack each round (otherwise they come one at a time). */
  together?: boolean;
}

export interface Test {
  stat: StatId;
  pass: string;
  fail: string;
  /** Number of d6 rolled (default 2); pass when the total is <= stat + mod. */
  dice?: number;
  mod?: number;
}

export interface Section {
  title?: string;
  text: string;
  img?: string;
  /** Mood of the generated illustration when there is no image. */
  mood?: Mood;
  fx?: Effect[];
  choices?: Choice[];
  fight?: Fight;
  test?: Test;
  end?: "victory" | "death";
}

export type Mood = "forest" | "sea" | "cave" | "ruin" | "town" | "night" | "fire" | "storm";

export interface ItemDef {
  name: string;
  icon: string;
  desc?: string;
  use?: { fx: Effect[]; consume?: boolean; combat?: boolean; label?: string };
}

export interface EnemyDef {
  name: string;
  skill: number;
  stamina: number;
  /** Damage dealt when it wins a round (default 2). */
  damage?: number;
  icon?: string;
  img?: string;
  desc?: string;
  color?: string;
}

export interface DiceStat {
  dice: number;
  plus: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  blurb: string;
  author?: string;
  cover?: string;
  accent?: string;
  start: string;
  rules: {
    skill: DiceStat;
    stamina: DiceStat;
    luck: DiceStat;
    provisions?: number;
    provisionHeal?: number;
    gold?: number;
    items?: Record<string, number>;
  };
  items: Record<string, ItemDef>;
  enemies: Record<string, EnemyDef>;
  sections: Record<string, Section>;
}

/** Progress of one play-through (what a save slot holds). */
export interface AdvState {
  v: 1;
  book: string;
  name: string;
  section: string;
  skill: number;
  skillMax: number;
  stamina: number;
  staminaMax: number;
  luck: number;
  luckMax: number;
  gold: number;
  provisions: number;
  items: Record<string, number>;
  flags: Record<string, boolean>;
  visited: string[];
  steps: number;
  created: number;
  updated: number;
  ended?: "victory" | "death";
  /** Snapshot taken on entering the current section: "try again" after a death. */
  back?: Omit<AdvState, "back">;
}
