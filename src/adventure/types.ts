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
  /** Fewer than n Arrows. */
  | { arrowsBelow: number }
  /** At least n Lune (the silver coin of Anari, book 9; kept apart from Gold Crowns). */
  | { lune: number }
  /** Fewer than n Lune. */
  | { luneBelow: number }
  /** Weaponskill / Weaponmastery / Grand Weaponmastery with this weapon (item key: "Bow", "Sword"…). */
  | { mastered: string }
  /** Carries at least one item of that kind that could be given up (items with `keep` do not count). */
  | { hasAny: LoseKind }
  /** Has completed that Magnakai Lore-circle (all its disciplines, as the engine defines the circles). */
  | { loreCircle: LoreCircleId }
  /** Has not completed that Lore-circle. */
  | { notLoreCircle: LoreCircleId }
  /**
   * The weapon in hand (the one the player chose for this section, else the one the engine would fight
   * with) is one of these: item keys or weapon kinds ("Dagger", "Quarterstaff"…).
   */
  | { wields: string | string[] }
  /** Has Weaponskill / Weaponmastery with the weapon in hand ("with the weapon you are using"). */
  | { wieldsMastered: true }
  /** Still has a Backpack (not lost with `loseAll: "pack"`, or found again). */
  | { pack: true }
  /** Has no Backpack ("if you no longer have a Backpack"). */
  | { noPack: true }
  | { all: Cond[] }
  | { any: Cond[] };

/** The Magnakai Lore-circles: Fire, Light, Solaris, Spirit. */
export type LoreCircleId = "fire" | "light" | "solaris" | "spirit";

export type ItemType = "weapon" | "backpack" | "special" | "meal";

/** What a `loseChoice` lets the player pick from ("any": weapons and Backpack, Meals included). */
export type LoseKind = "weapon" | "backpack" | "special" | "any";

/** A list of the Action Chart, in the order the items were noted (Backpack: its items, then the Meals). */
export type ListKind = "weapon" | "backpack" | "special";

/** One item of an Action Chart list by position: the n-th (1 = the first) or the last one. */
export interface NthPick { kind: ListKind; n: number | "last" }

/** Something offered to take in a pick-limited choice of loot (`pick`, `pickMax`). */
export type PickItem =
  | { gain: string; type: ItemType; n?: number; desc?: string }
  | { gold: number }
  | { lune: number };

/** Any effect may carry `if`: it applies only when the condition holds. */
export type Effect = EffectBase & { if?: Cond };

type EffectBase =
  | { ep: number }
  /**
   * Restores half of the ENDURANCE lost so far (rounded down); "fight": half of what the last fight
   * took (a fight lost with `combat.lose` counts down to 0, not to the 1 point it leaves).
   */
  | { restoreHalf: true | "fight" }
  | { cs: number; for?: "combat" | "book" }
  | { gold: number; optional?: boolean }
  /** Lune (book 9): never turned into Gold Crowns by the engine. */
  | { lune: number; optional?: boolean }
  | { arrows: number }
  /**
   * The player picks what to give up. `into`: what is given up goes into that stash (a wager, an item
   * handed over), `unstash` gives it back. `except`: one of each of these items is not offered (the
   * Torch in use). `orElse`: applied instead when there is nothing to pick from ("if you have no
   * Backpack Items, you lose a Weapon instead").
   */
  | { loseChoice: LoseKind; n?: number; into?: string; except?: string[]; orElse?: Effect[] }
  | { epMax: number }
  | { csBase: number }
  | { gain: string; type: ItemType; n?: number; optional?: boolean; desc?: string }
  /** Loses an item; `n` copies of it (Meals: n Meals). `into`: kept in that stash (stolen, taken away) for `unstash`. */
  | { lose: string; n?: number; into?: string; orElse?: Effect[] }
  /** "pack": the Backpack itself and all in it: no Backpack Items or Meals can be carried until a Backpack is found. */
  | { loseAll: "weapons" | "backpack" | "pack" | "special" | "gold" | "lune" | "meals" | "everything" }
  /**
   * Loses the n-th item of a list ("erase the second Special Item"); when the list is too short, the
   * first `else` that finds an item ("if you have only one, erase it; if none, the first Backpack Item").
   */
  | { loseNth: NthPick & { else?: NthPick[] }; into?: string; orElse?: Effect[] }
  /** Loses n items of that list picked at random (`except`: one of each of these is spared; `orElse`: when the list is empty). */
  | { loseRandom: { kind: ListKind; n: number }; into?: string; except?: string[]; orElse?: Effect[] }
  /**
   * Loses half of the list (Backpack: Meals included), picked at random, or half the Gold Crowns / Lune
   * of the Belt Pouch ("gold", "lune"); the number lost is rounded down, `up`: rounded up.
   */
  | { loseHalf: ListKind | "gold" | "lune"; up?: true; into?: string }
  | { eat: true; noHunt?: boolean }
  /**
   * An open wound: `bleed` ENDURANCE lost on entering every section from the next one on, until one
   * of the `cure` items is used (default: a Potion of Laumspur).
   */
  | { bleed: number; cure?: string[] }
  /** Healing items (`heal`) cannot be used until the next fight is over ("unable to swallow any potions prior to the combat"). */
  | { noPotions: true }
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
  /** Added to the hero's COMBAT SKILL while fighting this foe (an ally joins in after the first foe: +2). */
  heroCs?: number;
  /**
   * The same creature met again: its ENDURANCE is kept under this name when a fight ends, and a
   * later foe with the same `keep` starts with what it had left (none left: it is not met again).
   */
  keep?: string;
  /** The foe is in the fight only when this holds ("if the earlier combat listed only two, ignore the third"). */
  if?: Cond;
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
  evade?: { after?: number; until?: number; if?: Cond; any?: boolean; anyIf?: Cond; to: string; alt?: { text: string; to: string }[];
    /** Only once this many foes of the fight are dead ("if you kill the first guard, you can evade"). */
    afterFoes?: number };
  /** The fight stops as soon as the foe's ENDURANCE is n or less: go to `to`. */
  stopAt?: { foeEp: number; to: string };
  win?: string;
  maxRounds?: { n: number; to: string };
  noMindblast?: boolean;
  /** COMBAT SKILL changed while `if` holds; `fromRound`: only from that round on (2 = the second and later rounds). */
  csIf?: { if: Cond; add: number; fromRound?: number }[];
  onHurt?: string;
  /**
   * The first `rounds` rounds (default 1), when `if` holds (e.g. no Huntmastery): COMBAT SKILL changed
   * by `cs`; `noHeroLoss`: the hero loses no ENDURANCE in them; `unarmed`: the hero fights bare-handed
   * in them (no weapon, no Weaponmastery bonus), armed again afterwards.
   */
  firstRound?: { cs?: number; rounds?: number; if?: Cond; noHeroLoss?: boolean; unarmed?: boolean };
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
  /**
   * Weapons that cannot be used in this fight (item keys or weapon kinds, e.g. ["Bow"], ["Sommerswerd"]).
   * ["all"]: no weapon, Special Item or Backpack Item is usable (no weapon bonus, no item COMBAT SKILL).
   */
  forbid?: string[];
  /** The foe attacks with Mindforce: ENDURANCE lost every round unless shielded (Mindshield / Psi-screen / Kai-screen). */
  mindforce?: number;
  /**
   * ENDURANCE the hero loses from the Combat Results Table is multiplied by n while `if` holds (wounded,
   * poisoned…: 2, 3; an ally taking half the blows: 0.5). Fractions are rounded down.
   */
  heroLossMul?: { n: number; if?: Cond };
  /** ENDURANCE the foe loses is multiplied by n in rounds the hero fights with a mind attack. */
  mindMul?: number;
  /** The COMBAT SKILL bonus of a mind attack (Mindblast, Psi-surge, Kai-surge) is multiplied by n in this fight. */
  mindBonusMul?: number;
  /** The first entry whose `if` holds sets the multiplier instead (×2 normally, ×3 with the Lore-circle of the Spirit). */
  mindBonusMulIf?: { if: Cond; n: number }[];
  /**
   * "weaponLike": the hero fights bare-handed unless carrying a weapon-like Special Item (Sommerswerd,
   * items with `weapon` or `as`; not a Bow), which is then the weapon used. Ordinary weapons do not count.
   */
  unarmedUnless?: "weaponLike";
  /**
   * The hero's COMBAT SKILL is n for this fight (a psychic duel): it replaces the basic score, Lore-circles,
   * weapons, items and the next-fight / whole-book changes; no mind attack adds to it. The fight's own
   * modifiers (mods, csIf, firstRound, ambush) still apply.
   */
  heroCs?: number;
  /**
   * A borrowed weapon (item key): the hero fights with it instead of their own weapons (Paido's sword).
   * Its kind (items `as`, else the key) counts for Weaponskill / Weaponmastery; the hero's own weapons,
   * weapon-like Special Items (Sommerswerd +8 and its double damage to the undead) do not count.
   */
  weapon?: string;
  /**
   * A contest fought by the combat rules on points of its own (the target points of an archery final, an
   * arm-wrestling match): the hero starts with n points ("ep": as many as their ENDURANCE now), loses
   * them instead of ENDURANCE (which does not change) and goes to `lose` at 0. No mind attack is used.
   */
  heroEp?: number | "ep";
  /**
   * Picking this number (or one of these) from the Random Number Table in any round, while `if`
   * holds, ends the fight at once (that round does no harm): go to `to` (a cracked bow that
   * breaks on a 0, a fall from a plank on a 1).
   */
  onNumber?: OnNumber;
  /**
   * Choices offered on the fight-start screen instead of fighting ("use the Fireseed instead"). One
   * with `force` whose `if` holds takes the fight away: only the forced ones are offered.
   */
  instead?: Choice[];
  /**
   * ENDURANCE the hero would lose from the Combat Results Table is not lost: a number is picked
   * instead, and its range decides (nothing: fight on; `end`: death; `to`: the fight stops there).
   * The Javek's fangs on a padded arm.
   */
  heroLossRoll?: { out: { min: number; max: number; to?: string; end?: "death" }[] };
  /**
   * Fighting under water: a number is picked as the fight starts (0 = 10) plus `mods`: the rounds
   * the hero can hold his breath; every round after those costs `ep` ENDURANCE more.
   */
  breath?: { ep: number; mods?: { if: Cond; add: number }[] };
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
  roll?: ChoiceRoll;
  /** Where the choice sits in the explore view (an exit, a door, a person or an object). */
  via?: { exit?: "north" | "south" | "east" | "west"; door?: string; npc?: string; object?: string };
  /**
   * A riddle: the player types a number; the right answer is `to` (never shown). A wrong one leads
   * to `fail`, or stays in the section. `hint`: a line shown above the number pad.
   */
  riddle?: boolean;
  fail?: string;
  hint?: string;
  /**
   * Taking the choice offers these items, of which the player may take at most n: in the section it
   * leads to, or, with `repeat`, in this section (once per visit).
   */
  pickMax?: { n: number; items: PickItem[] };
}

export interface RandomPick {
  /** Random numbers picked and added together (default 1): the out ranges then cover 0 to 9 × picks. */
  picks?: number;
  /** `if` absent: it always adds ("pick a number and add 10"). */
  mods?: { if?: Cond; add: number }[];
  /** `then`: the range leads to another pick in the same section ("if you are stuck, pick another number"). */
  out: { min: number; max: number; to?: string; end?: "death" | "victory"; fx?: Effect[]; then?: RandomPick }[];
  /**
   * Shooting with a bow: Weaponmastery with Bow, Mentora and the bow's own `bowRoll` (Silver Bow of
   * Duadon +3) add to the number. The hero's own best bow is used, else a borrowed one (a Bow).
   */
  bow?: boolean;
  /** "cs": the hero's COMBAT SKILL (outside a fight) is taken off the total before the ranges are read ("if your total is equal to or less than your COMBAT SKILL"). */
  vs?: "cs";
  /** Any one of the numbers picked being this one (before modifiers), while `if` holds, leads to `to` instead. */
  onNumber?: OnNumber;
}

/** "If you pick a 0 at any time…, turn to …": a number (or numbers) of the Random Number Table, and where it leads. */
export interface OnNumber { n: number | number[]; to: string; if?: Cond }

/** What one outcome of a dice-comparison game does: its effects, and where it leads (none: stay). */
export interface RollOutcome { to?: string; end?: "death" | "victory"; fx?: Effect[] }

/**
 * A dice-comparison game ("pick two numbers for each player, the highest total wins"): every
 * opponent and the hero pick `picks` numbers (default 2) and add them up; the hero's total gets
 * `mods`. The hero wins by beating every opponent, loses when any opponent beats him, ties
 * otherwise. `zerosWin`: all noughts ("Bullseyes!") beat any total.
 */
export interface CompareGame {
  picks?: number;
  opponents?: number;
  mods?: { if: Cond; add: number }[];
  zerosWin?: boolean;
  win: RollOutcome;
  lose: RollOutcome;
  /** Default: nothing happens (stay, play again). */
  tie?: RollOutcome;
}

/** A choice's game of chance: a random number table, or a dice-comparison game. */
export type ChoiceRoll = RandomPick | { compare: CompareGame };

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
  /** Loot of which the player may take at most `max` ("you may take any two of the following"). */
  pick?: { max: number; from: PickItem[] };
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
  /** Doses of a usable item (heal / use): each use takes one; the item is gone after the last (default 1). */
  uses?: number;
  /** Never offered when the player picks something to give up (loseChoice). */
  keep?: boolean;
  /** Added to the number picked when shooting with this bow (random.bow): the Silver Bow of Duadon +3. */
  bowRoll?: number;
  /** Its bonuses (cs, epMax) do not count while this holds (no shield while an arm is useless). */
  offIf?: Cond;
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

export type Offer = (
  | { gain: string; type: ItemType; n: number; desc?: string }
  | { gold: number }
  | { lune: number }
  | { loseChoice: LoseKind; n: number; into?: string; except?: string[] }
) & {
  /** Pick-limited loot: offers of one group share `AdvState.pickLeft[group]`. */
  group?: string;
  /** Already counted against its group (some of it was taken). */
  picked?: boolean;
};

export interface Stash {
  weapons: string[]; backpack: string[]; special: string[]; meals: number; gold: number; arrows: number; lune?: number;
  /** Where each item sat on its list when taken (index, parallel to the lists; -1 or absent: unknown), to give it back there. */
  pos?: { weapons: number[]; backpack: number[]; special: number[] };
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
  arrows: number;
  /** Lune (book 9's silver coins), apart from Gold Crowns; absent = none. */
  lune?: number;
  /** How many more items each pick-limited group of the section's offers allows. */
  pickLeft?: Record<string, number>;
  /** The weapon the player chose to use in the current section ("the weapon you are using"); absent = the engine's pick. */
  wield?: string;
  /** Weapons mastered (Magnakai Weaponmastery / Grand Weaponmastery). */
  mastered?: string[];
  /** Definitions of carried items the current book does not describe (brought over from earlier books). */
  items?: Record<string, ItemDef>;
  /** ENDURANCE lost in the current section's combat (for "onHurt"). */
  hurt?: boolean;
  /** Doses left of carried items with `uses` that have been used (item key → doses left); absent = all of them. */
  doses?: Record<string, number>;
  /** Gear taken away (confiscated) by name, to be given back later. */
  stashes?: Record<string, Stash>;
  /** The Backpack is lost (loseAll "pack"): no Backpack Items or Meals until one is found. */
  noPack?: boolean;
  /** An open wound bleeding every section (Effect `bleed`). */
  bleed?: { ep: number; cure: string[] };
  /** Healing items cannot be used until the next fight is over (Effect `noPotions`). */
  noPotions?: boolean;
  /** ENDURANCE the last fight took (for restoreHalf "fight"), and whether it was lost (combat.lose). */
  lastFight?: { lost: number; beaten: boolean };
  /** ENDURANCE left of foes met again (FoeDef.keep). */
  foesLeft?: Record<string, number>;
  /** Which nested pick of the section's random table is being played (indexes of `out` entries with `then`). */
  randomAt?: number[];
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
