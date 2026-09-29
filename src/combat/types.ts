export type Element =
  | "physical" | "fire" | "ice" | "lightning" | "water" | "earth"
  | "wind" | "light" | "dark" | "poison" | "arcane";

export type School =
  | "sword" | "axe" | "spear" | "bow" | "dagger" | "fist" | "shield"
  | "fire" | "ice" | "lightning" | "water" | "earth" | "wind"
  | "light" | "dark" | "poison" | "nature" | "arcane" | "song" | "monster";

export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  mag: number;
  def: number;
  res: number;
  spd: number;
  crit: number; // percent
  eva: number; // percent
}

export type StatKey = keyof Stats;
export type StatMods = Partial<Record<StatKey, number>>;

export type StatusId =
  | "burn" | "poison" | "bleed" | "chill" | "frozen" | "wet" | "oil" | "shock"
  | "stun" | "sleep" | "silence" | "blind" | "weaken" | "vulnerable" | "armorBreak"
  | "resBreak" | "slow" | "haste" | "atkUp" | "magUp" | "defUp" | "regen" | "shield"
  | "taunt" | "stealth" | "thorns" | "counter" | "lifesteal" | "mark" | "curse"
  | "doom" | "confuse" | "empower" | "focus" | "evade" | "immune" | "reflect"
  | "berserk" | "petrify" | "rooted" | "barrier" | "guard" | "manaRegen"
  | "imbueFire" | "imbueIce" | "imbueLightning" | "imbueWater" | "imbueEarth"
  | "imbueWind" | "imbueLight" | "imbueDark" | "imbuePoison";

export type TargetType = "enemy" | "enemies" | "ally" | "allies" | "self" | "random" | "deadAlly";

export type SkillKind = "physical" | "magical" | "support";

/** A status application. `p` scales the status power (DoT/regen/shield) by the caster's main stat. */
export interface Eff {
  s: StatusId;
  ch?: number; // chance 0..1 (default 1)
  t?: number; // turns (default 2)
  st?: number; // stacks (default 1)
  to?: "target" | "self" | "allies" | "enemies";
  p?: number;
}

export type Special =
  | { k: "execute"; below: number; mult: number }
  | { k: "consume"; s: StatusId; perStack: number }
  | { k: "bonusIf"; s: StatusId; mult: number }
  | { k: "bonusVsTag"; tag: string; mult: number }
  | { k: "cleanse"; n?: number }
  | { k: "dispel"; n?: number }
  | { k: "revive"; pct: number }
  | { k: "drainMp"; pct: number }
  | { k: "lifesteal"; pct: number }
  | { k: "missingHp"; mult: number }
  | { k: "extraTurn" }
  | { k: "delay"; amount: number }
  | { k: "advance"; amount: number }
  | { k: "spread" }
  | { k: "transfer" }
  | { k: "resetCd" }
  | { k: "mpRestore"; pct: number }
  | { k: "randomElement" }
  | { k: "scaleDebuffs"; per: number }
  | { k: "selfDamage"; pct: number }
  | { k: "hpSwap" }
  | { k: "useDef" }
  | { k: "useSpd" };

export interface Skill {
  id: string;
  name: string;
  icon: string;
  school: School;
  el: Element;
  kind: SkillKind;
  target: TargetType;
  tier: number; // 1..5
  mp: number;
  cd: number;
  power?: number;
  hits?: number;
  heal?: number;
  fx?: Eff[];
  self?: Eff[];
  sp?: Special[];
  hpCost?: number; // fraction of max HP
  enemy?: boolean; // enemy-only skill
  flavor?: string;
}

export type PassiveHook =
  | { on: "stat"; mods: StatMods }
  | { on: "elemDmg"; el: Element; mult: number }
  | { on: "battleStart"; fx: Eff[] }
  | { on: "turnStart"; healPct?: number; mpPct?: number }
  | { on: "hitApply"; fx: Eff[]; kind?: SkillKind; el?: Element }
  | { on: "crit"; fx: Eff[] }
  | { on: "kill"; healPct?: number; mpPct?: number; fx?: Eff[] }
  | { on: "hurt"; fx: Eff[]; ch?: number }
  | { on: "lowHp"; below: number; mods: StatMods }
  | { on: "statusDmg"; s: StatusId; mult: number }
  | { on: "critDmg"; add: number }
  | { on: "healPower"; mult: number }
  | { on: "debuffResist"; ch: number }
  | { on: "reactionDmg"; mult: number };

export interface Passive {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tier: number;
  school: School;
  hooks: PassiveHook[];
  enemy?: boolean;
}

export interface StatusInstance {
  id: StatusId;
  turns: number;
  stacks: number;
  power: number;
  source?: string;
}

export type Side = "ally" | "enemy";

export interface Unit {
  uid: string;
  side: Side;
  name: string;
  sprite: string;
  palette?: Record<string, string>;
  level: number;
  base: Stats;
  hp: number;
  mp: number;
  statuses: StatusInstance[];
  skills: string[];
  passives: string[];
  cooldowns: Record<string, number>;
  av: number;
  tags: string[];
  resist: Partial<Record<Element, number>>;
  boss?: boolean;
  charId?: string;
  enemyId?: string;
  ai?: "random" | "smart" | "support";
}

export type BattleEvent =
  | { t: "turn"; uid: string }
  | { t: "skip"; uid: string; reason: string }
  | { t: "use"; uid: string; skill: string; targets: string[] }
  | { t: "dmg"; uid: string; amount: number; el: Element; crit?: boolean; dot?: boolean; absorbed?: number }
  | { t: "heal"; uid: string; amount: number; mp?: boolean }
  | { t: "miss"; uid: string }
  | { t: "status"; uid: string; s: StatusId; removed?: boolean }
  | { t: "reaction"; uid: string; name: string }
  | { t: "death"; uid: string }
  | { t: "revive"; uid: string }
  | { t: "log"; text: string };
