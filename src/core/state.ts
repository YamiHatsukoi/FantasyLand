import type { StatMods, Stats } from "../combat/types";
import { PARTY_SIZE, costFor, type Cost, passiveSlotsFor, skillSlotsFor } from "../data/buildings";
import { CLASSES, COMPANIONS, classStats, xpForLevel } from "../data/classes";
import { decodeFog, encodeFog } from "../world/fog";
import { hashString } from "./rng";
import { enhLevel, enhancedId, getItem, type GearKey, type MealBuff } from "../data/items";

export const SAVE_VERSION = 6;
/** Highest character level (the floor-100 gatekeeper stands at 200). */
export const MAX_LEVEL = 200;

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
  /** Hero only: unspent stat points and where the spent ones went. */
  points?: number;
  alloc?: Partial<Record<keyof Stats, number>>;
  /** @deprecated old saves: enhancement per slot. Now the level is part of the item id ("sword+4"). */
  enh?: Partial<Record<GearKey, number>>;
  /** Earned in the sanctuary: 10-heart friendship or marriage. */
  bond?: "kindred" | "beloved";
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
  watered: boolean; // derived from wetUntil / weather / sprinklers; kept for older saves and the map tint
  /** Real-time ms until the watering dries out. */
  wetUntil?: number;
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
  /** The map is the same for every player (floors first visited after maps became shared). */
  shared?: boolean;
  done: string[]; // cleared entity ids
  fog: string; // base64 bitset of explored tiles
  px?: number;
  py?: number;
  cleared: boolean; // guardian defeated
  /** Rune stones touched so far, in order (sealed vault puzzle). */
  puzzle?: string;
  /** The floor's great event: discovered, finished, and the wave reached (arena-type events). */
  saga?: { seen?: boolean; done?: boolean; step?: number };
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
  /** Items picked up since the bag was last opened. */
  newItems?: string[];
  floors: Record<number, FloorState>;
  expedition: Expedition | null;
  learnedRecipes: string[];
  log: string[];
  stats: { battles: number; kills: number; deaths: number; steps: number; goldSpent?: number };
  settlers: number;
  weather: Weather;
  /** Real time (ms) the farm was last advanced; crops grow in real time. */
  farmT?: number;
  meal: MealBuff | null;
  npcs: Record<string, NpcMemory>;
  tavern: { day: number; offers: RecruitOffer[] };
  report: string[];
  /** Relationships with residents of the sanctuary, by character id. */
  bonds: Record<string, Bond>;
  /** Elements the party has tried on each enemy kind (reveals weaknesses in battle). */
  scan?: Record<string, string[]>;
  /** Pets hatched so far, and the one travelling with the party. */
  pets?: string[];
  pet?: string;
}

/** Friendship / romance with a resident. Points: 100 per heart, 10 hearts max. */
export interface Bond {
  fp: number; // friendship
  rp: number; // romance
  stage: "none" | "dating" | "engaged" | "married";
  closed?: boolean; // turned down romance
  mutual?: boolean; // confessed feelings to each other
  day: number; // last day talked
  acts: number; // conversation actions used that day
  gift: number; // day of last gift
  date: number; // day of last date
  flirt: number; // day of last flirt
  known: string[]; // learned tastes: "t:food+" / "t:music-" / "i:itemId+"
  said: string[]; // recently used line ids
  answers: string[]; // "q3:bold"
  events: string[]; // milestone scenes seen
  topics: string[]; // "food:12" topic:day, recent topics
  jealous?: number; // day jealousy started
  gossip?: string; // who they heard the player flirting with
  request?: { item: string; n: number; done?: boolean };
  wedding?: number; // wedding day
}

export function newGame(heroName: string, classId: string, seed: number): GameState {
  const hero = makeCharacter("hero", heroName, classId, `hero_${classId}`, 1);
  hero.points = 0;
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
      { id: "b_house", type: "house", x: 66, y: 66, level: 1 },
      { id: "b_gate", type: "gate", x: 67, y: 63, level: 1 },
      { id: "b_farm1", type: "farm", x: 70, y: 69, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm2", type: "farm", x: 71, y: 69, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm3", type: "farm", x: 70, y: 70, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_farm4", type: "farm", x: 71, y: 70, level: 1, plot: { soil: 0, watered: false } },
      { id: "b_well", type: "well", x: 69, y: 71, level: 1 },
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
    bonds: {},
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

/**
 * A companion leaves for good: their gear goes back to the bag and their bed is freed. Townsfolk
 * return home (and could be asked again); story companions never leave.
 */
export function dismiss(g: GameState, id: string): boolean {
  const ch = g.chars[id];
  if (!ch || id === g.heroId || COMPANIONS[id]) return false;
  for (const gid of Object.values(ch.gear)) if (gid) addItem(g, gid, 1);
  g.party = g.party.filter((x) => x !== id);
  delete g.chars[id];
  delete g.bonds?.[id];
  if (ch.origin && g.npcs[ch.origin]) g.npcs[ch.origin].recruited = false;
  logMsg(g, `${ch.name} rời Thánh Địa.`);
  return true;
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
/** Every tenth floor is a milestone. */
export const isMilestone = (n: number) => n > 0 && n % 10 === 0;
/** Each conquered milestone leaves a lasting mark: this much more of every stat for the party. */
export const MARK_BONUS = 0.02;

export function partyBuffs(g: GameState): StatMods {
  const out: StatMods = {};
  const marks = Number(g.flags.marks ?? 0);
  if (marks) for (const k of ["hp", "mp", "atk", "mag", "def", "res", "spd"] as const) out[k] = (out[k] ?? 0) + marks * MARK_BONUS;
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

/** Stat allocation: points per level for the hero, and what one point buys. */
export const POINTS_PER_LEVEL = 3;
/** Crit and dodge are ratings with diminishing returns (see combat/rates.ts); two points buy one. */
export const POINT_VALUE: Record<keyof Stats, number> = { hp: 8, mp: 4, atk: 1, mag: 1, def: 1, res: 1, spd: 1, crit: 0.5, eva: 0.5 };
export const POINT_CAP: Partial<Record<keyof Stats, number>> = { crit: 30, eva: 20 };

export function allocPoint(ch: Character, k: keyof Stats, n = 1): boolean {
  const have = ch.points ?? 0;
  const cur = ch.alloc?.[k] ?? 0;
  const cap = POINT_CAP[k];
  n = Math.min(n, have, cap !== undefined ? cap - cur : n);
  if (n <= 0) return false;
  ch.alloc = { ...(ch.alloc ?? {}), [k]: cur + n };
  ch.points = have - n;
  return true;
}
/** Takes back every spent point. */
export function resetPoints(ch: Character) {
  const spent = Object.values(ch.alloc ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  ch.points = (ch.points ?? 0) + spent;
  ch.alloc = {};
}
export const resetCost = (ch: Character) => 50 * ch.level;

/** Full stats of a character including gear. A weapon in the off hand counts for half. */
export function charStats(ch: Character): Stats {
  const s = classStats(ch.classId, ch.level);
  for (const [k, n] of Object.entries(ch.alloc ?? {}) as [keyof Stats, number][]) s[k] += Math.floor(n * POINT_VALUE[k]);
  for (const [key, id] of Object.entries(ch.gear) as [GearKey, string][]) {
    if (!id) continue;
    const eq = getItem(id).equip;
    if (!eq) continue;
    const f = key === "offhand" && eq.slot === "weapon" ? 0.5 : 1;
    for (const [k, v] of Object.entries(eq.stats)) s[k as keyof Stats] += Math.round((v as number) * f);
  }
  return s;
}

// ------------------------------------------------------------ forge enhancement (a gold sink)
export const ENH_MAX = 10;
const ENH_CHANCE = [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
/** Gold for going from `lvl` to `lvl + 1`: steep, and scaled by how deep the player has been. */
export const enhanceCost = (g: GameState, lvl: number) => Math.round(80 * (lvl + 1) ** 2.2 * (1 + Math.max(1, g.maxFloor) / 8));
export const enhanceChance = (lvl: number) => ENH_CHANCE[Math.min(lvl, ENH_CHANCE.length - 1)];
/** Pays and rolls one enhancement of the item worn in `key`. A failure only costs the gold. */
export function tryEnhance(g: GameState, ch: Character, key: GearKey, roll: number): "ok" | "fail" | "max" | "gold" | "empty" {
  const id = ch.gear[key];
  if (!id) return "empty";
  const lvl = enhLevel(id);
  if (lvl >= ENH_MAX) return "max";
  const cost = enhanceCost(g, lvl);
  if (g.gold < cost) return "gold";
  g.gold -= cost;
  g.stats.goldSpent = (g.stats.goldSpent ?? 0) + cost;
  if (roll >= enhanceChance(lvl)) return "fail";
  ch.gear[key] = enhancedId(id, lvl + 1);
  return "ok";
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
  if (ch.bond === "kindred") out.push("p_kindred");
  if (ch.bond === "beloved") out.push("p_beloved");
  for (const id of Object.values(ch.gear)) {
    const p = id ? getItem(id).equip?.passive : undefined;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Global experience multiplier (battles, events, academy). */
export const XP_RATE = 0.5;

/** Adds XP, returns list of level-up messages. */
export function giveXp(ch: Character, amount: number): string[] {
  const msgs: string[] = [];
  ch.xp += amount;
  while (ch.xp >= xpForLevel(ch.level) && ch.level < MAX_LEVEL) {
    ch.xp -= xpForLevel(ch.level);
    ch.level++;
    msgs.push(`${ch.name} lên cấp ${ch.level}!`);
    if (ch.id === "hero") { ch.points = (ch.points ?? 0) + POINTS_PER_LEVEL; msgs.push(`+${POINTS_PER_LEVEL} điểm chỉ số để phân bổ!`); }
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

// ------------------------------------------------------------ dungeon floors
/**
 * Every player explores the same map on a given floor (layout, chests, secrets, the great event).
 * Floors first visited before maps became shared keep their own seed so no progress is lost.
 */
export const WORLD_SEED = "fantasyland-world-1";
export const sharedFloorSeed = (n: number) => hashString(`${WORLD_SEED}:${n}`);

export function ensureFloorState(g: GameState, n: number): { fs: FloorState; fresh: boolean } {
  let fs = g.floors[n];
  const fresh = !fs;
  if (!fs) {
    fs = { seed: sharedFloorSeed(n), shared: true, done: [], fog: "", cleared: Boolean(g.flags[`f${n}_cleared`]) };
    g.floors[n] = fs;
  }
  return { fs, fresh };
}

// ------------------------------------------------------------ inventory
export const count = (g: GameState, item: string) => (item === "gold" ? g.gold : g.inventory[item] ?? 0);

export function addItem(g: GameState, item: string, n = 1) {
  if (item === "gold") { g.gold += n; return; }
  const had = g.inventory[item] ?? 0;
  g.inventory[item] = had + n;
  if (g.inventory[item] <= 0) delete g.inventory[item];
  else if (had <= 0 && n > 0) {
    // "new" markers in the bag, cleared when the bag is opened
    const list = (g.newItems ??= []);
    if (!list.includes(item)) { list.push(item); if (list.length > 120) list.shift(); }
  }
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
/**
 * The save as stored: NPC memories drop empty fields and keep their recent lines as one string,
 * empty bag slots are dropped. `migrate` restores the full shape. Shallow: nothing is mutated.
 */
export function packSave(g: GameState): GameState {
  const npcs: Record<string, unknown> = {};
  for (const [id, m] of Object.entries(g.npcs ?? {})) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) {
      if (v === 0 || v === false || v === undefined || v === null || (Array.isArray(v) && !v.length)) continue;
      o[k] = k === "seen" && Array.isArray(v) ? v.slice(-SEEN_KEEP).join(",") : v;
    }
    npcs[id] = o;
  }
  const inventory: Record<string, number> = {};
  for (const [id, n] of Object.entries(g.inventory)) if (n > 0) inventory[id] = n;
  // cleared things per floor ("event_3", "chest_12"...) as one comma-separated string
  const floors: Record<number, FloorState> = {};
  for (const [n, fs] of Object.entries(g.floors ?? {})) floors[Number(n)] = { ...fs, done: fs.done.join(",") as unknown as string[] };
  return { ...g, npcs: npcs as GameState["npcs"], inventory, floors, newItems: g.newItems?.slice(-60) };
}
const SEEN_KEEP = 40;

function unpackNpcs(g: GameState) {
  for (const m of Object.values(g.npcs ?? {}) as (NpcMemory & { seen: string[] | string })[]) {
    m.aff ??= 0; m.talks ??= 0; m.lastDay ??= 0; m.giftDay ??= 0;
    m.seen = typeof m.seen === "string" ? (m.seen ? m.seen.split(",") : []) : (m.seen ?? []).slice(-SEEN_KEEP);
    m.mem ??= [];
    m.questsDone ??= [];
  }
}

export function migrate(raw: unknown): GameState {
  const g = raw as GameState;
  if (!g || typeof g !== "object" || !g.chars) throw new Error("Save không hợp lệ");
  g.npcs ??= {};
  unpackNpcs(g);
  // explored maps from older saves: plain bitsets -> run-length form (about 10x smaller)
  for (const fs of Object.values(g.floors ?? {})) {
    const done = fs.done as unknown;
    fs.done = typeof done === "string" ? (done ? done.split(",") : []) : ((done as string[]) ?? []);
    if (fs.fog && fs.fog[0] !== "~") { try { fs.fog = encodeFog(decodeFog(fs.fog, atob(fs.fog).length * 8)); } catch { fs.fog = ""; } }
  }
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
  if (g.v === 4) {
    // v4 briefly doubled every level (2L−1). Levels are back to what they were; only the cap and
    // the monsters grew. Progress towards the next level is kept as a fraction.
    for (const ch of Object.values(g.chars ?? {})) {
      const v4Need = Math.round(15 * Math.pow((ch.level + 1) / 2, 1.55));
      const frac = Math.min(0.99, Math.max(0, (ch.xp ?? 0) / Math.max(1, v4Need)));
      ch.level = Math.max(1, Math.round((ch.level + 1) / 2));
      ch.xp = Math.floor(frac * xpForLevel(ch.level));
      // stat points need no change: 1.5 per doubled level is the same total as 3 per level
    }
    if (g.tavern) g.tavern.offers = [];
  }
  if ((g.v ?? 1) < 6) {
    // v6: the sanctuary world grew from 72×72 to 136×136 (centre 36 -> 68) and every territory
    // level doubled in width, so everything already built moves with the centre.
    for (const b of g.buildings) { b.x += 32; b.y += 32; } // SZ_SHIFT in world/sanctuary
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
  g.bonds ??= {};
  for (const ch of Object.values(g.chars)) {
    // per-slot enhancement moves onto the item that was in the slot
    if (ch.enh) {
      for (const [k, lvl] of Object.entries(ch.enh) as [GearKey, number][]) {
        const id = ch.gear[k];
        if (id && lvl > 0 && !enhLevel(id)) ch.gear[k] = enhancedId(id, Math.min(ENH_MAX, lvl));
      }
      delete ch.enh;
    }
    fixGear(g, ch);
    syncLook(ch);
  }
  const hero = g.chars[g.heroId];
  if (hero && hero.points === undefined) hero.points = (hero.level - 1) * POINTS_PER_LEVEL; // points for levels gained before allocation existed
  // crit / dodge points above the (lowered) caps are refunded
  if (hero?.alloc) for (const [k, cap] of Object.entries(POINT_CAP) as [keyof Stats, number][]) {
    const spent = hero.alloc[k] ?? 0;
    if (spent > cap) { hero.alloc[k] = cap; hero.points = (hero.points ?? 0) + spent - cap; }
  }
  return g;
}
