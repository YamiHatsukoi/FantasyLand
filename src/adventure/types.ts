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
  | { ep: number }
  | { flag: string }
  | { notFlag: string }
  | { epBelow: number }
  | { rank: number }
  | { arrows: number }
  | { all: Cond[] }
  | { any: Cond[] };

export type ItemType = "weapon" | "backpack" | "special" | "meal";

export type Effect =
  | { ep: number }
  | { cs: number; for?: "combat" | "book" }
  | { gold: number; optional?: boolean }
  | { arrows: number }
  | { loseChoice: "weapon" | "backpack" | "any"; n?: number }
  | { epMax: number }
  | { csBase: number }
  | { gain: string; type: ItemType; n?: number; optional?: boolean; desc?: string }
  | { lose: string }
  | { loseAll: "weapons" | "backpack" | "special" | "gold" | "everything" }
  | { eat: true }
  | { flag: string };

export interface FoeDef {
  name: string;
  cs: number;
  ep: number;
  immune?: string[];
}

export interface Combat {
  foes: FoeDef[];
  together?: boolean;
  mods?: { cs?: number };
  evade?: { after: number; to: string };
  win?: string;
  maxRounds?: { n: number; to: string };
  noMindblast?: boolean;
  csIf?: { if: Cond; add: number }[];
  onHurt?: string;
}

export interface Choice {
  text: string;
  to: string;
  if?: Cond;
}

export interface RandomPick {
  mods?: { if: Cond; add: number }[];
  out: { min: number; max: number; to: string; fx?: Effect[] }[];
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
}

export interface Section {
  text: string[];
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
  /** Passive bonus while carried (Helmet: epMax 2, Chainmail: epMax 4...). */
  epMax?: number;
  cs?: number;
  /** Usable item: restores ENDURANCE when used outside combat (Healing Potion: 4). */
  heal?: number;
}

export interface StartPick {
  /** "random": one option by a random number (option index = number); "choose": player picks `count`. */
  mode: "random" | "choose";
  count: number;
  options: ({ gain: string; type: ItemType; n?: number } | { gold: number })[];
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
  /** Weaponskill weapon by random number 0-9. */
  weaponskill: string[];
  /** Kai disciplines a new hero picks. */
  discCount: number;
  kit: {
    items: { gain: string; type: ItemType; n?: number }[];
    gold: { random: boolean; add: number };
    picks: StartPick[];
  };
  items: Record<string, ItemDef>;
  /** Vietnamese names: disciplines, stats and terms used by the screens. */
  names: { disc: Record<Disc, string>; discDesc?: Partial<Record<Disc, string>>; [k: string]: unknown };
  actors?: Record<string, string>;
  places?: Record<string, { name: string; desc: string }>;
  map?: import("./worldmap").BookMap | null;
  sections: Record<string, Section>;
}

export type Offer =
  | { gain: string; type: ItemType; n: number; desc?: string }
  | { gold: number }
  | { loseChoice: "weapon" | "backpack" | "any"; n: number };

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
  /** ENDURANCE lost in the current section's combat (for "onHurt"). */
  hurt?: boolean;
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
