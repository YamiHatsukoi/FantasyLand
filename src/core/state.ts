import type { Stats } from "../combat/types";
import { BUILDINGS, type Cost, partySizeFor, passiveSlotsFor, skillSlotsFor } from "../data/buildings";
import { CLASSES, COMPANIONS, classStats, xpForLevel } from "../data/classes";
import { getItem, type EquipSlot } from "../data/items";

export const SAVE_VERSION = 1;

export interface Character {
  id: string;
  name: string;
  classId: string;
  sprite: string;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  skills: string[];
  equipped: string[];
  passives: string[];
  equippedPassives: string[];
  gear: Partial<Record<EquipSlot, string>>;
}

export interface PlacedBuilding {
  id: string; // unique instance id
  type: string;
  x: number;
  y: number;
  level: number;
  crop?: { id: string; planted: number };
}

export interface FloorState {
  seed: number;
  done: string[]; // cleared entity ids
  fog: string; // base64 bitset of explored tiles
  px?: number;
  py?: number;
  cleared: boolean; // guardian defeated
}

export interface Expedition {
  floor: number;
  bag: Record<string, number>; // loot gathered this run (lost partially on defeat)
  bagGold: number;
  steps: number;
  done: string[]; // monsters / nodes / camps used during this run (they respawn next run)
}

export interface GameState {
  v: number;
  created: number;
  updated: number;
  day: number;
  gold: number;
  heroId: string;
  chars: Record<string, Character>;
  party: string[];
  inventory: Record<string, number>;
  buildings: PlacedBuilding[];
  territory: number;
  flags: Record<string, number | boolean | string>;
  maxFloor: number;
  floors: Record<number, FloorState>;
  expedition: Expedition | null;
  learnedRecipes: string[];
  log: string[];
  stats: { battles: number; kills: number; deaths: number; steps: number };
}

export function newGame(heroName: string, classId: string, seed: number): GameState {
  const hero = makeCharacter("hero", heroName, classId, `hero_${classId}`, 1);

  return {
    v: SAVE_VERSION,
    created: Date.now(),
    updated: Date.now(),
    day: 1,
    gold: 60,
    heroId: "hero",
    chars: { hero },
    party: ["hero"],
    inventory: { seed_wheat: 6, seed_radish: 3, wood: 12, stone: 8, herb: 3, potion_hp: 3, bread: 2 },
    buildings: [
      { id: "b_house", type: "house", x: 16, y: 16, level: 1 },
      { id: "b_gate", type: "gate", x: 17, y: 13, level: 1 },
      { id: "b_farm1", type: "farm", x: 20, y: 19, level: 1 },
      { id: "b_farm2", type: "farm", x: 21, y: 19, level: 1 },
    ],
    territory: 0,
    flags: { seed: seed },
    maxFloor: 1,
    floors: {},
    expedition: null,
    learnedRecipes: [],
    log: [],
    stats: { battles: 0, kills: 0, deaths: 0, steps: 0 },
  };
}

export function makeCharacter(id: string, name: string, classId: string, sprite: string, level: number): Character {
  const cls = CLASSES[classId];
  const skills = [...cls.startSkills];
  for (const [lvl, sk] of Object.entries(cls.learnset)) if (Number(lvl) <= level && !skills.includes(sk)) skills.push(sk);
  const s = classStats(classId, level);
  return {
    id, name, classId, sprite, level, xp: 0, hp: s.hp, mp: s.mp,
    skills, equipped: skills.slice(0, 5), passives: [...cls.startPassives], equippedPassives: [...cls.startPassives],
    gear: {},
  };
}

export function recruit(g: GameState, companionId: string): Character {
  const def = COMPANIONS[companionId];
  const heroLevel = g.chars[g.heroId].level;
  const ch = makeCharacter(companionId, def.name, def.classId, def.sprite, Math.max(1, heroLevel));
  for (const s of def.extraSkills) if (!ch.skills.includes(s)) ch.skills.push(s);
  ch.equipped = ch.skills.slice(0, 5);
  for (const p of def.extraPassives) if (!ch.passives.includes(p)) ch.passives.push(p);
  ch.equippedPassives = ch.passives.slice(0, 2);
  g.chars[companionId] = ch;
  if (g.party.length < partySize(g)) g.party.push(companionId);
  return ch;
}

// ------------------------------------------------------------ derived values
export function building(g: GameState, type: string) {
  return g.buildings.find((b) => b.type === type);
}
export const houseLevel = (g: GameState) => building(g, "house")?.level ?? 1;
export const partySize = (g: GameState) => partySizeFor(houseLevel(g));
export const passiveSlots = (g: GameState) => passiveSlotsFor(houseLevel(g));
export const skillSlots = (g: GameState) => skillSlotsFor(houseLevel(g));

/** Full stats of a character including gear. */
export function charStats(ch: Character): Stats {
  const s = classStats(ch.classId, ch.level);
  for (const id of Object.values(ch.gear)) {
    if (!id) continue;
    const eq = getItem(id).equip;
    if (!eq) continue;
    for (const [k, v] of Object.entries(eq.stats)) s[k as keyof Stats] += v as number;
  }
  return s;
}

export function charPassives(ch: Character): string[] {
  const out = [...ch.equippedPassives];
  for (const id of Object.values(ch.gear)) {
    const p = id ? getItem(id).equip?.passive : undefined;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Adds XP, returns list of level-up messages. */
export function giveXp(ch: Character, amount: number): string[] {
  const msgs: string[] = [];
  ch.xp += amount;
  while (ch.xp >= xpForLevel(ch.level) && ch.level < 99) {
    ch.xp -= xpForLevel(ch.level);
    ch.level++;
    msgs.push(`${ch.name} lên cấp ${ch.level}!`);
    const learn = CLASSES[ch.classId].learnset[ch.level];
    if (learn && !ch.skills.includes(learn)) {
      ch.skills.push(learn);
      if (ch.equipped.length < 5) ch.equipped.push(learn);
      msgs.push(`${ch.name} học được kỹ năng mới!`);
    }
    const s = charStats(ch);
    ch.hp = s.hp;
    ch.mp = s.mp;
  }
  return msgs;
}

// ------------------------------------------------------------ inventory
export const count = (g: GameState, item: string) => (item === "gold" ? g.gold : g.inventory[item] ?? 0);

export function addItem(g: GameState, item: string, n = 1) {
  if (item === "gold") { g.gold += n; return; }
  g.inventory[item] = (g.inventory[item] ?? 0) + n;
  if (g.inventory[item] <= 0) delete g.inventory[item];
}

export function removeItem(g: GameState, item: string, n = 1): boolean {
  if (count(g, item) < n) return false;
  addItem(g, item, -n);
  return true;
}

export function canAfford(g: GameState, cost: Cost): boolean {
  return Object.entries(cost).every(([k, v]) => count(g, k) >= v);
}

export function pay(g: GameState, cost: Cost): boolean {
  if (!canAfford(g, cost)) return false;
  for (const [k, v] of Object.entries(cost)) addItem(g, k, -v);
  return true;
}

export function buildingCost(type: string, level: number): Cost {
  return BUILDINGS[type].cost[level] ?? {};
}

export function healParty(g: GameState) {
  for (const ch of Object.values(g.chars)) {
    const s = charStats(ch);
    ch.hp = s.hp;
    ch.mp = s.mp;
  }
}

export function logMsg(g: GameState, msg: string) {
  g.log.unshift(`Ngày ${g.day}: ${msg}`);
  g.log.length = Math.min(g.log.length, 40);
}

/** Upgrades older saves in place. */
export function migrate(raw: unknown): GameState {
  const g = raw as GameState;
  if (!g || typeof g !== "object" || !g.chars) throw new Error("Save không hợp lệ");
  g.v = SAVE_VERSION;
  g.log ??= [];
  g.stats ??= { battles: 0, kills: 0, deaths: 0, steps: 0 };
  g.learnedRecipes ??= [];
  g.floors ??= {};
  return g;
}
