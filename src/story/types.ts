import type { Eff } from "../combat/types";

export type Attr = "str" | "int" | "agi" | "wil" | "luck";

export type Cond =
  | { flag: string; eq?: number | boolean | string }
  | { notFlag: string }
  | { has: string; n?: number }
  | { party: string }
  | { recruited: string }
  | { gold: number }
  | { rank: number }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export interface BattleSpec {
  group?: string[]; // enemy ids; defaults to the entity's group (guardian / ambush)
  level?: number; // absolute level; defaults to floor level
  levelAdd?: number;
  win: string;
  lose?: string;
  enemyFx?: Eff[];
  noFlee?: boolean;
}

export type Effect =
  | { give: Record<string, number> }
  | { take: Record<string, number> }
  | { gold: number }
  | { goldF: number }
  | { xp: number }
  | { xpF: number }
  | { loot: number }
  | { flag: string; v?: number | boolean | string }
  | { recruit: string }
  | { learn: string; to?: string }
  | { heal: number }
  | { hurt: number }
  | { mp: number }
  | { battle: BattleSpec }
  | { clearFloor: true }
  | { setClass: string };

export interface Choice {
  text: string;
  cond?: Cond;
  hide?: boolean; // hide instead of showing locked
  check?: { attr: Attr; dc: number; pass: string; fail: string };
  next?: string;
  fx?: Effect[];
  end?: boolean;
  keep?: boolean;
}

export interface Scene {
  text: string;
  speaker?: string;
  portrait?: string;
  fx?: Effect[];
  choices?: Choice[];
  next?: string;
  route?: { cond?: Cond; to: string }[];
  keep?: boolean;
  input?: "name";
}

export interface StoryEvent {
  id: string;
  title: string;
  start: string;
  portrait?: string;
  scenes: Record<string, Scene>;
}
