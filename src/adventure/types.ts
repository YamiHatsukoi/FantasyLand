/**
 * Data format of an Adventure book, Lone Wolf rules (see FORMAT.md of the private book repo).
 * Book packages hold licensed text, so they are never part of this repository: the player
 * imports their own personal copy, kept in their account only.
 */

export type Disc =
  | "camouflage" | "hunting" | "sixthsense" | "tracking" | "healing"
  | "weaponskill" | "mindshield" | "mindblast" | "animalkinship" | "mindovermatter";

export const DISCS: Disc[] = ["camouflage", "hunting", "sixthsense", "tracking", "healing", "weaponskill", "mindshield", "mindblast", "animalkinship", "mindovermatter"];

export type Cond =
  | { disc: Disc }
  | { notDisc: Disc }
  | { item: string }
  | { notItem: string }
  | { gold: number }
  | { ep: number }
  | { flag: string }
  | { notFlag: string }
  | { all: Cond[] }
  | { any: Cond[] };

export type ItemType = "weapon" | "backpack" | "special" | "meal";

export type Effect =
  | { ep: number }
  | { cs: number; for?: "combat" | "book" }
  | { gold: number }
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
}

export interface Choice {
  text: string;
  to: string;
  if?: Cond;
}

export interface RandomPick {
  mods?: { if: Cond; add: number }[];
  out: { min: number; max: number; to: string }[];
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
  title: string;
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
  places?: Record<string, string>;
  sections: Record<string, Section>;
}

export interface Offer {
  gain: string;
  type: ItemType;
  n: number;
  desc?: string;
}

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
