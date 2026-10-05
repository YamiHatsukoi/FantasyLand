/**
 * Monster Arena (an auto-battler in the spirit of Teamfight Tactics): shared types.
 * Units are built from the 700 monsters of the Abyss; a match is 8 players (you and 7 CPUs)
 * buying, combining and placing units that then fight on their own.
 */
import type { Element } from "../combat/types";
import type { Fx } from "./spells";

export type Cost = 1 | 2 | 3 | 4 | 5;
export type Star = 1 | 2 | 3 | 4;
export type Role = "tank" | "brute" | "assassin" | "marksman" | "mage" | "support";
export type Kind = "beast" | "flyer" | "spirit" | "undead" | "construct" | "humanoid" | "plant";

/** Stats at one star. Attack speed is attacks per second; range is in hexes. */
export interface UnitStats {
  hp: number;
  ad: number;
  ap: number; // ability power, 100 = spells at face value
  armor: number;
  mr: number;
  as: number;
  range: number;
  mana: number; // to cast
  startMana: number;
  crit: number; // chance 0..1
}

export type Debuff = "stun" | "burn" | "poison" | "bleed" | "chill" | "shred" | "weaken" | "blind" | "silence" | "mark";

/**
 * A unit's spell: a list of effects (see src/arena/spells.ts for the little language). Ordinary
 * units use one of 200 base spells in one of three variants; bosses each have an ultimate.
 */
export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  el: Element;
  physical: boolean; // scales with attack damage and is reduced by armor
  fx: Fx[];
  ult?: boolean; // a boss's ultimate
  base: string; // base spell id
  variant: number; // 1 strong, 2 elemental, 3 wide (0 for ultimates)
  /** Set for passives: what sets it off (attack, attack3, kill, hurt50, start, second3, struck5). */
  passive?: string;
  desc: string;
}

export interface ArenaUnit {
  id: string; // same as the monster's id
  name: string;
  sprite: string;
  palette?: Record<string, string>;
  floor: number;
  cost: Cost;
  role: Role;
  origin: Element; // its home floor's element
  kind: Kind;
  traits: string[]; // trait ids: origin, role, kind (+ "overlord" for bosses)
  stats: UnitStats;
  spell: SpellDef;
  boss: boolean;
}
