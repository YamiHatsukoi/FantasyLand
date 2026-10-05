/**
 * Monster Arena (an auto-battler in the spirit of Teamfight Tactics): shared types.
 * Units are built from the 700 monsters of the Abyss; a match is 8 players (you and 7 CPUs)
 * buying, combining and placing units that then fight on their own.
 */
import type { Element } from "../combat/types";

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

/** What a unit's spell does; the engine reads the shape, the art reads `vfx`. */
export type SpellShape =
  | "strike" // a heavy single-target hit
  | "bolt" // a magic projectile at the target
  | "multi" // several hits / bounces on random enemies
  | "nova" // area around the target
  | "line" // everything in a line from the caster
  | "dash" // leap to the farthest enemy and hit
  | "heal" // heal the weakest allies
  | "shield" // shield self and allies nearby
  | "rally" // buff allies around (attack speed / damage)
  | "fortify"; // self: shield and armor, taunt

export type Debuff = "stun" | "burn" | "poison" | "bleed" | "chill" | "shred" | "weaken" | "blind" | "silence" | "mark";

export interface SpellDef {
  id: string; // the skill it comes from
  name: string;
  icon: string;
  shape: SpellShape;
  el: Element;
  /** Damage (or heal / shield) at one star before AP; scaled by star and AP in battle. */
  power: number;
  physical: boolean; // scales with AD and is reduced by armor
  radius: number; // nova / shield / rally / heal reach in hexes
  hits: number;
  debuff?: { id: Debuff; dur: number };
  lifesteal?: number;
  execute?: boolean;
  ult?: boolean; // a boss's empowered version
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
