/**
 * Data format of an Adventure book, Lone Wolf rules (see FORMAT.md of the private book repo).
 * Book packages hold licensed text, so they are never part of this repository: the player
 * imports their own personal copy, kept in their account only.
 */

export const DISCS_BY_RULES = {
  kai: ["camouflage", "hunting", "sixthsense", "tracking", "healing", "weaponskill", "mindshield", "mindblast", "animalkinship", "mindovermatter"],
  magnakai: ["weaponmastery", "animalcontrol", "curing", "invisibility", "huntmastery", "pathsmanship", "psisurge", "psiscreen", "nexus", "divination"],
  grandmaster: ["grandweaponmastery", "animalmastery", "deliverance", "assimilance", "grandhuntmastery", "grandpathsmanship", "kaisurge", "kaiscreen", "grandnexus", "telegnosis", "magimagic", "kaialchemy"],
  neworder: ["grandweaponmastery", "animalmastery", "deliverance", "assimilance", "grandhuntmastery", "grandpathsmanship", "kaisurge", "kaiscreen", "grandnexus", "telegnosis", "magimagic", "kaialchemy", "astrology", "herbmastery", "elementalism", "bardsmanship"],
} as const;

export type Disc = (typeof DISCS_BY_RULES)[keyof typeof DISCS_BY_RULES][number];

export type Cond =
  | { disc: Disc }
  | { notDisc: Disc }
  | { item: string }
  | { notItem: string }
  | { gold: number }
  /** Fewer than n Gold Crowns. */
  | { goldBelow: number }
  | { ep: number }
  | { flag: string }
  | { notFlag: string }
  | { epBelow: number }
  | { rank: number }
  | { notRank: number }
  | { noWeapon: true }
  | { armed: true }
  | { arrows: number }
  /** Weaponskill / Weaponmastery / Grand Weaponmastery with this weapon (item key: "Bow", "Sword"…). */
  | { mastered: string }
  | { all: Cond[] }
  | { any: Cond[] };

export type ItemType = "weapon" | "backpack" | "special" | "meal";

/** Any effect may carry `if`: it applies only when the condition holds. */
export type Effect = EffectBase & { if?: Cond };

type EffectBase =
  | { ep: number }
  /** Restores half of the ENDURANCE lost so far (rounded down). */
  | { restoreHalf: true }
  | { cs: number; for?: "combat" | "book" }
  | { gold: number; optional?: boolean }
  | { arrows: number }
  | { loseChoice: "weapon" | "backpack" | "any"; n?: number }
  | { epMax: number }
  | { csBase: number }
  | { gain: string; type: ItemType; n?: number; optional?: boolean; desc?: string }
  /** Loses an item; `n` copies of it (Meals: n Meals). */
  | { lose: string; n?: number }
  | { loseAll: "weapons" | "backpack" | "special" | "gold" | "meals" | "everything" }
  | { eat: true; noHunt?: boolean }
  | { flag: string }
  | { unflag: string }
  /**
   * Gear taken away under a name, to be given back by `unstash`. `only`: just those parts
   * (default everything); `weaponLike`: also the Special Items that count as weapons
   * (Sommerswerd, items with `weapon` or `as`).
   */
  | { stash: string; only?: StashPart[]; weaponLike?: boolean }
  | { unstash: string };

export type StashPart = "weapons" | "backpack" | "special" | "gold" | "meals" | "arrows";

export interface FoeDef {
  name: string;
  /** Sprite id (glossary actor) to draw the foe with; the name is used when absent. */
  actor?: string;
  cs: number;
  ep: number;
  /**
   * Attacks the foe is immune to: "mindblast" (Mindblast, and the weak form of Psi-surge / Kai-surge),
   * "psisurge" (Psi-surge), "kaisurge" (Kai-surge), "mind" (every mind attack); other words are ignored.
   */
  immune?: string[];
  /** Undead: the Sommerswerd doubles the damage they take. */
  undead?: boolean;
  /** The foe does not strike back during the first n rounds. */
  holdRounds?: number;
  /** Loses double ENDURANCE. */
  double?: boolean;
}

export interface Combat {
  foes: FoeDef[];
  together?: boolean;
  mods?: { cs?: number };
  /** Evading: after `after` rounds have been fought; with `until`, only while fewer than `until` rounds have been (until 1 = the first round only). */
  /**
   * Evading: after `after` rounds have been fought; with `until`, only while fewer than `until` rounds have been (until 1 = the first round only).
   * `if`: evading is possible only when it holds. `any: true`, or `anyIf` holding: at any round (after / until do not count).
   */
  evade?: { after?: number; until?: number; if?: Cond; any?: boolean; anyIf?: Cond; to: string; alt?: { text: string; to: string }[] };
  /** The fight stops as soon as the foe's ENDURANCE is n or less: go to `to`. */
  stopAt?: { foeEp: number; to: string };
  win?: string;
  maxRounds?: { n: number; to: string };
  noMindblast?: boolean;
  csIf?: { if: Cond; add: number }[];
  onHurt?: string;
  /** COMBAT SKILL change in the first `rounds` rounds (default 1); with `if`, only when it holds (e.g. no Huntmastery). */
  firstRound?: { cs: number; rounds?: number; if?: Cond };
  foeExtraLoss?: number;
  heroDrain?: { ep: number; if?: Cond };
  /** One-round fight decided by who lost more ENDURANCE (hero more / less / equal). */
  compare?: { more: string; less: string; equal: string };
  /** Losing the fight is not death: go there with 1 ENDURANCE. */
  lose?: string;
  winBy?: { rounds: number; fast: string; slow: string };
  restoreHalf?: boolean;
  foeHoldLoss?: number;
  /** COMBAT SKILL lost to a surprise attack or ambush (negative); Huntmastery ignores it. */
  ambush?: number;
  /** Weapons that cannot be used in this fight (item keys or weapon kinds, e.g. ["Bow"], ["Sommerswerd"]). */
  forbid?: string[];
  /** The foe attacks with Mindforce: ENDURANCE lost every round unless shielded (Mindshield / Psi-screen / Kai-screen). */
  mindforce?: number;
  /** ENDURANCE the hero loses from the Combat Results Table is multiplied by n while `if` holds (wounded, poisoned…). */
  heroLossMul?: { n: number; if?: Cond };
  /** ENDURANCE the foe loses is multiplied by n in rounds the hero fights with a mind attack. */
  mindMul?: number;
  /** Choices offered on the fight-start screen instead of fighting ("use the Fireseed instead"). */
  instead?: Choice[];
  /** The fight does not happen when `if` holds: the section offers one way on, to `to` (button `text`, default "Đi tiếp"). */
  skipIf?: { if: Cond; to: string; text?: string };
}

export interface Choice {
  text: string;
  to: string;
  if?: Cond;
  /** Effects of choosing it (paying a price...). */
  fx?: Effect[];
  /** When available, it must be taken (the section's random pick is for everyone else). */
  force?: boolean;
  /** Buying more: applies its fx and stays in the section. */
  repeat?: boolean;
  /**
   * A game of chance played on the spot (Cartwheel, Portholes): after its fx (the stake) a random
   * number is picked and the matching out's fx applied; an out with `to` (or `end`) leaves the
   * section, one without stays (use with `repeat` to play round after round).
   */
  roll?: RandomPick;
  /** Where the choice sits in the explore view (an exit, a door, a person or an object). */
  via?: { exit?: "north" | "south" | "east" | "west"; door?: string; npc?: string; object?: string };
  /**
   * A riddle: the player types a number; the right answer is `to` (never shown). A wrong one leads
   * to `fail`, or stays in the section. `hint`: a line shown above the number pad.
   */
  riddle?: boolean;
  fail?: string;
  hint?: string;
}

export interface RandomPick {
  /** Random numbers picked and added together (default 1): the out ranges then cover 0 to 9 × picks. */
  picks?: number;
  mods?: { if: Cond; add: number }[];
  out: { min: number; max: number; to?: string; end?: "death" | "victory"; fx?: Effect[] }[];
  bow?: boolean;
}

export type Bg =
  | "forest" | "hill" | "road" | "river" | "lake" | "field" | "village" | "town" | "city" | "castle" | "hall" | "ruins"
  | "cave" | "tunnel" | "swamp" | "mountain" | "bridge" | "camp" | "inn" | "ship" | "sea" | "coast" | "desert"
  | "temple" | "dungeon" | "sky";

export interface Scene {
  place: string;
  bg: Bg;
  time: "dawn" | "day" | "dusk" | "night";
  weather: "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow" | "wind";
  actors: string[];
  mood: "calm" | "tense" | "danger" | "combat" | "sad" | "mystery" | "triumph";
  cutscene?: boolean;
  /** The distinct spot (book.locations) where the section happens. */
  loc?: string;
  /** The section plays as a walkable area (explore mode). */
  explore?: boolean;
}

/** A distinct physical spot of a book (locations.json): every section at the same spot shares it. */
export interface Loc {
  name: string;
  kind: Bg;
  /** World-map node (place) this spot belongs to. */
  node: string;
  desc: string;
  features: string[];
  size: "small" | "medium" | "large";
  /** Adjacent spots and the direction they lie in. */
  links: Record<string, "north" | "south" | "east" | "west" | "up" | "down" | "in" | "out">;
}

/** One beat of a section's staging: a short piece of the text and what happens on screen. */
export interface Beat {
  t: string;
  do?: StageAction[];
  wait?: number;
}

export type StageAction = Record<string, string | number | undefined> & (
  | { enter: string; from?: string; at?: number; n?: number }
  | { move: string; to: number | string }
  | { run: string; to: number | string }
  | { pose: string }
  | { face: string; dir: string }
  | { say: string; text: string }
  | { emote: string; kind: string }
  | { fx: string; at?: string | number }
  | { prop: string; at?: number; state?: string }
  | { remove: string }
  | { camera: string }
  | { weather: string }
  | { time: string }
  | { sfx: string }
);

export interface Section {
  text: string[];
  /** How the section is performed on screen, beat by beat (covers all of `text`). */
  stage?: Beat[];
  scene: Scene;
  fx?: Effect[];
  combat?: Combat;
  choices?: Choice[];
  random?: RandomPick;
  end?: "death" | "victory";
  note?: string;
}

/** Combat Results Table: [random number 0-9][ratio column 0-12] = [enemy loss, hero loss]; -1 = killed. */
export type CRT = [number, number][][];

export interface ItemDef {
  name: string;
  type: ItemType;
  desc?: string;
  /** Counts as a weapon in hand although carried as a special item (Sommerswerd). */
  weapon?: boolean;
  /** The kind of weapon it counts as for Weaponskill / Weaponmastery (Sommerswerd: "Sword"). */
  as?: string;
  /** Passive bonus while carried (Helmet: epMax 2, Chainmail: epMax 4...). */
  epMax?: number;
  cs?: number;
  /** Usable item: restores ENDURANCE when used outside combat (Healing Potion: 4). */
  heal?: number;
  /**
   * Usable before a fight (a drug such as Adgana): +cs COMBAT SKILL in the next fight. With `addict`,
   * each dose taken while not addicted picks a number 0-9: in [min, max] the hero becomes addicted,
   * losing `epBase` basic ENDURANCE for good; doses taken once addicted give `cs` instead.
   */
  use?: { cs: number; addict?: { roll: [number, number]; epBase: number; cs: number } };
}

export interface StartPick {
  /** "random": one option by a random number (option index = number); "choose": player picks `count`. */
  mode: "random" | "choose";
  count: number;
  /** `arrows`: Arrows that come with it (a Quiver "contains six Arrows"). */
  options: ({ gain: string; type: ItemType; n?: number; arrows?: number } | { gold: number })[];
}

export interface Book {
  id: string;
  series: "lw";
  num: number;
  /** Rule set: kai (1-5), magnakai (6-12), grandmaster (13-20), neworder (21-29). */
  rules: "kai" | "magnakai" | "grandmaster" | "neworder";
  title: string;
  titleEn?: string;
  /** Vietnamese "The Story So Far" paragraphs, shown before the adventure starts. */
  intro: string[];
  start: string;
  crt: CRT;
  /** Kai: Weaponskill weapon by random number 0-9. Later series: the Weaponmastery weapon list. */
  weaponskill: string[];
  /** Disciplines a new hero picks (Kai 5, Magnakai 3, Grand Master 4…). */
  discCount: number;
  kit: {
    items: { gain: string; type: ItemType; n?: number; arrows?: number }[];
    gold: { random: boolean; add: number };
    picks: StartPick[];
  };
  items: Record<string, ItemDef>;
  /** Vietnamese names: disciplines, stats and terms used by the screens. */
  names: { disc: Record<Disc, string>; discDesc?: Partial<Record<Disc, string>>; [k: string]: unknown };
  actors?: Record<string, string>;
  places?: Record<string, { name: string; desc: string }>;
  map?: import("./worldmap").BookMap | null;
  locations?: Record<string, Loc>;
  sections: Record<string, Section>;
}

export type Offer =
  | { gain: string; type: ItemType; n: number; desc?: string }
  | { gold: number }
  | { loseChoice: "weapon" | "backpack" | "any"; n: number };

export interface Stash { weapons: string[]; backpack: string[]; special: string[]; meals: number; gold: number; arrows: number }

/** Progress of one play-through (what a save slot holds). */
export interface AdvState {
  v: 2;
  book: string;
  name: string;
  section: string;
  cs: number;
  ep: number;
  epBase: number;
  disciplines: Disc[];
  weaponskill?: string;
  weapons: string[];
  backpack: string[];
  special: string[];
  meals: number;
  gold: number;
  arrows: number;
  /** Weapons mastered (Magnakai Weaponmastery / Grand Weaponmastery). */
  mastered?: string[];
  /** Definitions of carried items the current book does not describe (brought over from earlier books). */
  items?: Record<string, ItemDef>;
  /** ENDURANCE lost in the current section's combat (for "onHurt"). */
  hurt?: boolean;
  /** Gear taken away (confiscated) by name, to be given back later. */
  stashes?: Record<string, Stash>;
  flags: Record<string, boolean>;
  /** COMBAT SKILL changes: for the next combat only, and for the rest of the book. */
  csNext: number;
  csBook: number;
  /** Items the section offers that the player has not taken or left yet. */
  offers: Offer[];
  /** Section whose fx were applied, so a reload does not apply them twice. */
  fought: boolean;
  visited: string[];
  steps: number;
  created: number;
  updated: number;
  ended?: "victory" | "death";
  back?: Omit<AdvState, "back">;
}
