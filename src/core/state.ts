import type { StatMods, Stats } from "../combat/types";
import { PARTY_SIZE, costFor, type Cost, passiveSlotsFor, skillSlotsFor } from "../data/buildings";
import { CLASSES, COMPANIONS, classStats, xpForLevel } from "../data/classes";
import { getItem, type GearKey, type MealBuff } from "../data/items";

export const SAVE_VERSION = 3;

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
  gear: Partial<Record<GearKey, string>>;
  pal?: Record<string, string>; // palette override for generated recruits
  origin?: string; // npc id this character was recruited from
  bio?: string;
}

export interface PlacedBuilding {
  id: string; // unique instance id
  type: string;
  x: number;
  y: number;
  level: number;
  plot?: PlotState; // farm plots
  slots?: PlotState[]; // greenhouse beds
  /** @deprecated v1 save format */
  crop?: { id: string; planted: number };
}

export interface CropState {
  id: string;
  growth: number; // accumulated growth days
  harvests: number;
  perfect: boolean; // never went thirsty
}

export interface PlotState {
  crop?: CropState;
  soil: number; // 0..3
  watered: boolean;
}

export type Weather = "sun" | "cloud" | "rain" | "storm" | "snow";

/** What an NPC remembers about the player. */
export interface NpcMemory {
  aff: number; // affinity -100..100
  talks: number;
  lastDay: number;
  giftDay: number;
  seen: string[]; // dialogue line ids already said
  mem: string[]; // memory tags
  quest?: { id: string; stage: number; startDay: number };
  questsDone: string[];
  recruited?: boolean;
}

export interface RecruitOffer {
  id: string;
  name: string;
  classId: string;
  level: number;
  price: number;
  pal: Record<string, string>;
  bio: string;
  passive: string;
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
  blessing?: number; // temple blessing, fraction added to all stats
  repel?: number; // steps left of monster repel
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
  settlers: number;
  weather: Weather;
  meal: MealBuff | null;
  npcs: Record<string, NpcMemory>;
  tavern: { day: number; offers: RecruitOffer[] };
  report: string[];
}

export function newGame(heroName: string, classId: string, seed: number): GameState {
  const hero = makeCharacter("hero", heroName, classId, `hero_${classId}`, 1);
  syncLook(hero);

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
      { id: "b_house", type: "house", x: 34, y: 34, level: 1 },
      { id: "b_gate", type: "gate", x: 35, y: 31, level: 1 },
      { id: "b_farm1", type: "farm", x: 38, y: 37, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm2", type: "farm", x: 39, y: 37, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm3", type: "farm", x: 38, y: 38, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm4", type: "farm", x: 39, y: 38, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_well", type: "well", x: 37, y: 39, level: 1 },
    ],
    territory: 0,
    flags: { seed: seed },
    maxFloor: 1,
    floors: {},
    expedition: null,
    learnedRecipes: [],
    log: [],
    stats: { battles: 0, kills: 0, deaths: 0, steps: 0 },
    settlers: 0,
    weather: "sun",
    meal: null,
    npcs: {},
    tavern: { day: 0, offers: [] },
    report: [],
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
  syncLook(ch);
  g.chars[companionId] = ch;
  if (g.party.length < partySize(g)) g.party.push(companionId);
  return ch;
}

// ------------------------------------------------------------ derived values
export function building(g: GameState, type: string) {
  return g.buildings.find((b) => b.type === type);
}
export const houseLevel = (g: GameState) => building(g, "house")?.level ?? 1;
export const partySize = (_g: GameState) => PARTY_SIZE;
export const passiveSlots = (g: GameState) => passiveSlotsFor(houseLevel(g));
export const skillSlots = (g: GameState) => skillSlotsFor(houseLevel(g));

/** Party-wide buffs: meal eaten this expedition + temple blessing. */
export function partyBuffs(g: GameState): StatMods {
  const out: StatMods = {};
  for (const [k, v] of Object.entries(g.meal?.mods ?? {})) out[k as keyof StatMods] = (out[k as keyof StatMods] ?? 0) + (v as number);
  const bl = g.expedition?.blessing ?? 0;
  if (bl) for (const k of ["hp", "atk", "mag", "def", "res", "spd"] as const) out[k] = (out[k] ?? 0) + bl;
  return out;
}

/** Gear slots in display order. */
export const GEAR_KEYS: GearKey[] = ["weapon", "offhand", "head", "armor", "hands", "legs", "feet", "neck", "ring", "ring2", "earring"];

/** Can this item go into that gear slot? (rings fit both fingers, one-handed weapons fit the off hand) */
export function fitsGear(key: GearKey, id: string): boolean {
  const eq = getItem(id).equip;
  if (!eq) return false;
  if (key === "ring2") return eq.slot === "ring";
  if (key === "offhand") return eq.slot === "offhand" || (eq.slot === "weapon" && eq.hands === 1);
  return eq.slot === key;
}
export const isTwoHanded = (id?: string) => !!id && getItem(id).equip?.hands === 2;
/** True when the character holds a weapon in each hand. */
export const dualWielding = (ch: Character) => !!ch.gear.offhand && getItem(ch.gear.offhand).equip?.slot === "weapon";

/**
 * Puts an item (already taken out of the inventory) into a slot and returns whatever had to come
 * off: the old piece, the off hand when a two-handed weapon goes in, or the two-hander when
 * something is put into the off hand.
 */
export function equipGear(ch: Character, key: GearKey, id: string): string[] {
  const off: string[] = [];
  const take = (k: GearKey) => { const x = ch.gear[k]; if (x) { off.push(x); delete ch.gear[k]; } };
  take(key);
  if (key === "weapon" && isTwoHanded(id)) take("offhand");
  if (key === "offhand" && isTwoHanded(ch.gear.weapon)) take("weapon");
  ch.gear[key] = id;
  return off;
}

/** Full stats of a character including gear. A weapon in the off hand counts for half. */
export function charStats(ch: Character): Stats {
  const s = classStats(ch.classId, ch.level);
  for (const [key, id] of Object.entries(ch.gear) as [GearKey, string][]) {
    if (!id) continue;
    const eq = getItem(id).equip;
    if (!eq) continue;
    const f = key === "offhand" && eq.slot === "weapon" ? 0.5 : 1;
    for (const [k, v] of Object.entries(eq.stats)) s[k as keyof Stats] += Math.round((v as number) * f);
  }
  return s;
}

/** Copies the look of equipped gear into the character's palette so sprites show it. */
export function syncLook(ch: Character) {
  const pal: Record<string, string> = { ...(ch.pal ?? {}) };
  for (const k of ["a", "w", "o", "hg", "gl", "lg", "ft"]) delete pal[k];
  const it = (k: GearKey) => { const id = ch.gear[k]; const x = id ? getItem(id) : null; return x?.equip ? x : null; };
  const arm = it("armor");
  pal.a = arm ? `${arm.equip!.kind ?? arm.shape}|${arm.col[0]}|${arm.col[2]}` : "none";
  const wp = it("weapon");
  if (wp) pal.w = `${wp.equip!.kind ?? wp.shape}|${wp.col[0]}|${wp.col[1]}|${wp.col[2]}`;
  const oh = it("offhand");
  if (oh) pal.o = `${oh.equip!.kind ?? oh.shape}|${oh.col[0]}|${oh.col[1]}|${oh.col[2]}`;
  const hd = it("head");
  if (hd) pal.hg = `${hd.equip!.kind ?? hd.shape}|${hd.col[0]}|${hd.col[2]}`;
  const gl = it("hands");
  if (gl) pal.gl = gl.col[0];
  const lg = it("legs");
  if (lg) pal.lg = lg.col[0];
  const ft = it("feet");
  if (ft) pal.ft = ft.col[0];
  ch.pal = Object.keys(pal).length ? pal : undefined;
}

/** Moves gear from older saves (single accessory slot, shields in the weapon hand) to the new slots. */
function fixGear(g: GameState, ch: Character) {
  const items = Object.entries(ch.gear) as [string, string][];
  ch.gear = {};
  const homeless: string[] = [];
  for (const [key, id] of items) {
    if (!id) continue;
    if (GEAR_KEYS.includes(key as GearKey) && fitsGear(key as GearKey, id) && !ch.gear[key as GearKey]) { ch.gear[key as GearKey] = id; continue; }
    homeless.push(id);
  }
  for (const id of homeless) {
    const key = GEAR_KEYS.find((k) => fitsGear(k, id) && !ch.gear[k] && !(k === "offhand" && isTwoHanded(ch.gear.weapon)));
    if (key) ch.gear[key] = id;
    else addItem(g, id, 1);
  }
  if (isTwoHanded(ch.gear.weapon) && ch.gear.offhand) { addItem(g, ch.gear.offhand, 1); delete ch.gear.offhand; }
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
  return costFor(type, level);
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
  if ((g.v ?? 1) < 2) {
    // v2: sanctuary world grew from 36x36 to 72x72 (centre 18 -> 36); farm plots gained soil/water state.
    for (const b of g.buildings) {
      b.x += 18;
      b.y += 18;
      if (b.type === "farm") {
        b.plot = { soil: 0, watered: false };
        if (b.crop) b.plot.crop = { id: b.crop.id, growth: Math.max(0, g.day - b.crop.planted), harvests: 0, perfect: false };
        delete b.crop;
      }
    }
    g.settlers = 0;
    g.weather = "sun";
    g.meal = null;
    g.npcs = {};
    g.tavern = { day: 0, offers: [] };
    g.report = [];
  }
  if ((g.v ?? 1) < 3) {
    // v3: dungeon floors became 4x larger with new layouts — keep progress, reset exploration.
    for (const fs of Object.values(g.floors ?? {})) {
      fs.fog = "";
      fs.done = [];
      delete fs.px;
      delete fs.py;
    }
    if (g.expedition) g.expedition.done = [];
  }
  g.v = SAVE_VERSION;
  for (const b of g.buildings) if (b.type === "farm" && !b.plot) b.plot = { soil: 0, watered: false };
  g.npcs ??= {};
  g.settlers ??= 0;
  g.weather ??= "sun";
  g.meal ??= null;
  g.tavern ??= { day: 0, offers: [] };
  g.report ??= [];
  g.log ??= [];
  g.stats ??= { battles: 0, kills: 0, deaths: 0, steps: 0 };
  g.learnedRecipes ??= [];
  g.floors ??= {};
  for (const ch of Object.values(g.chars)) { fixGear(g, ch); syncLook(ch); }
  return g;
}
