/**
 * Arena combat: two teams on the hex board fight on their own in real time (fixed 1/20 s
 * steps, seeded, so a fight plays out the same every time). Units pick the nearest enemy,
 * walk into range, attack at their attack speed, fill mana and cast their spell. Traits,
 * items and augments plug in here. The engine draws nothing: it keeps state the screen reads
 * and a list of events (attacks, hits, casts, deaths...) the screen turns into effects.
 */
import { Rng } from "../core/rng";
import type { Element } from "../combat/types";
import { COLS, HALF, ROWS, around, dist, inBoard, key, mirror, neighbors, stepToward, type Hex } from "./hex";
import { ITEMS, type ItemFx } from "./items";
import { TRAITS, traitTier } from "./traits";
import { parseWho, type Fx } from "./spells";
import type { ArenaUnit, Debuff, SpellDef, Star } from "./types";
import { STAR_MULT, STAR_SPELL, arenaUnit, arenaUnits, spellBase, starBoost } from "./units";

export const DT = 0.05;
export const OVERTIME = 30;
export const TIME_LIMIT = 45;
const AD_STAR = [0, 1, 1.5, 2.25, 3.4];
/** Seconds a unit takes to cross one hex. */
export const MOVE_TIME = 0.42;

/** `ref` names the player's own copy; `bonus` holds stats it has earned for good (Veigar-style). */
export interface PlacedUnit { unitId: string; star: Star; x: number; y: number; items: string[]; ref?: number; bonus?: Record<string, number> }
export interface TeamMods {
  hp?: number; ad?: number; ap?: number; as?: number; armor?: number; mr?: number; crit?: number; omnivamp?: number; mana?: number;
  frontline?: { hp: number; armor: number }; backline?: number; starPower?: number; traitBonus?: number;
}
export interface TeamSetup { units: PlacedUnit[]; mods?: TeamMods }

interface Dot { kind: "burn" | "poison" | "bleed"; dps: number; until: number; src: number }
interface Shield { amt: number; until: number; tag?: string }
interface Zone { side: 0 | 1; at: Hex; radius: number; dps: number; until: number; src: number; el: Element; physical: boolean; slow?: number; heal?: boolean }

export interface Fighter {
  uid: number;
  unit: ArenaUnit;
  side: 0 | 1;
  star: Star;
  x: number; y: number; // logical hex
  fx: number; fy: number; // drawn position (glides between hexes)
  moveFrom: Hex | null; moveT: number;
  /** The current move is a leap (drawn as a hop), e.g. an assassin jumping behind the enemy line. */
  leap?: boolean;
  hp: number; maxHp: number; mana: number; maxMana: number;
  baseAd: number; ad: number; ap: number; armor: number; mr: number; as: number; range: number;
  crit: number; critDmg: number; dodge: number; omnivamp: number; amp: number; reduce: number;
  items: string[]; fxs: Set<ItemFx>;
  traits: Record<string, number>; // trait id -> value at the reached tier (units carrying it)
  target: number | null;
  atkTimer: number; castLock: number; attacks: number;
  alive: boolean; summoned: boolean; decoy: boolean;
  // timers (absolute battle time)
  stun: number; chill: number; chillV: number; shred: number; weaken: number; blind: number; silence: number; mark: number; griev: number;
  ccImmune: number; taunt: number; stealth: number; mirror: number; frenzy: number; haste: number; hasteV: number; critUp: number; rally: number; rallyV: number;
  guard: number; guardV: number;
  ref?: number; perm: Record<string, number>; struck: number;
  critV: number; ampT: number; ampV: number; vampT: number; vampV: number; dodgeT: number; dodgeV: number; mirrorV: number;
  dots: Dot[]; shields: Shield[];
  flags: Set<string>; stacks: number; revived: boolean;
  /** Fight stats: damage dealt and taken, damage stopped by own armor / resist / shields, healing and shields given, armor buffs given. */
  dealt: number; taken: number; healed: number; blocked: number; shielded: number; guarded: number;
}

export type CombatEvent =
  | { t: "attack"; from: number; to: number; ranged: boolean; el: Element; time: number }
  | { t: "hit"; uid: number; amount: number; crit: boolean; magic: boolean; trueDmg?: boolean; el: Element }
  | { t: "miss"; uid: number }
  | { t: "heal"; uid: number; amount: number }
  | { t: "shield"; uid: number; amount: number }
  | { t: "cast"; uid: number; spell: SpellDef; targets: number[]; at?: Hex }
  | { t: "vfx"; kind: string; at: Hex; el: Element; radius: number; from?: Hex }
  | { t: "status"; uid: number; s: Debuff | "taunt" | "stealth" | "frenzy" | "mirror" | "buff" }
  | { t: "death"; uid: number }
  | { t: "revive"; uid: number }
  | { t: "spawn"; uid: number }
  | { t: "move"; uid: number }
  | { t: "loot"; uid: number; kind: "gold" | "xp" | "roll"; n: number };

interface Pending { at: number; fn: () => void }

const EL_OF_ORIGIN: Record<string, Element> = { o_fire: "fire", o_ice: "ice", o_water: "water", o_earth: "earth", o_wind: "wind", o_poison: "poison", o_lightning: "lightning", o_light: "light", o_dark: "dark", o_arcane: "arcane" };

export class ArenaBattle {
  fighters: Fighter[] = [];
  time = 0;
  events: CombatEvent[] = [];
  winner: 0 | 1 | -1 | null = null;
  /** Gold, experience and free rolls picked up by spells, per side. */
  loot: [{ gold: number; xp: number; roll: number }, { gold: number; xp: number; roll: number }] = [{ gold: 0, xp: 0, roll: 0 }, { gold: 0, xp: 0, roll: 0 }];
  private rng: Rng;
  private pending: Pending[] = [];
  private zones: Zone[] = [];
  private nextUid = 1;
  private teamTraits: [Record<string, number>, Record<string, number>] = [{}, {}];

  constructor(bottom: TeamSetup, top: TeamSetup, seed: number) {
    this.rng = new Rng(seed);
    this.setupTeam(bottom, 0);
    this.setupTeam(top, 1);
    for (const f of this.fighters) this.startOfCombat(f);
  }

  // ------------------------------------------------------------ setup
  /** Trait counts for a team as placed: distinct units, emblems, and an augment's bonus. */
  static traitCounts(units: PlacedUnit[], bonus = 0): Record<string, number> {
    const seen: Record<string, Set<string>> = {};
    for (const p of units) {
      const u = arenaUnit(p.unitId);
      if (!u) continue;
      const ts = new Set([...u.traits, ...p.items.map((i) => ITEMS[i]?.trait).filter((t): t is string => !!t)]);
      for (const t of ts) (seen[t] ??= new Set()).add(p.unitId);
    }
    const out: Record<string, number> = {};
    for (const [t, s] of Object.entries(seen)) out[t] = s.size;
    if (bonus) for (const t of Object.keys(out)) if (TRAITS[t].group !== "unique" && traitTier(t, out[t]) >= 0) out[t] += bonus;
    return out;
  }

  /**
   * A unit's stats as they would be at the start of a fight with this team (items, traits,
   * augments and earned stats all counted), for unit cards. `ref` picks the unit.
   */
  static preview(team: TeamSetup, ref: number): Fighter | undefined {
    const b = new ArenaBattle(team, { units: [] }, 1);
    return b.fighters.find((f) => f.ref === ref && !f.summoned);
  }

  private setupTeam(team: TeamSetup, side: 0 | 1) {
    const counts = ArenaBattle.traitCounts(team.units, team.mods?.traitBonus ?? 0);
    const active: Record<string, number> = {};
    for (const [t, n] of Object.entries(counts)) { const tier = traitTier(t, n); if (tier >= 0) active[t] = TRAITS[t].vals[tier] * (t === "c_tank" && tier >= 2 ? 1 : 1); }
    this.teamTraits[side] = active;
    for (const p of team.units) {
      const u = arenaUnit(p.unitId);
      if (!u) continue;
      const pos = side === 0 ? { x: p.x, y: p.y } : mirror({ x: p.x, y: p.y });
      const f = this.addFighter(u, p.star, pos, side, p.items, team.mods, counts);
      f.ref = p.ref;
      this.applyBonus(f, p.bonus);
    }
  }

  private addFighter(u: ArenaUnit, star: Star, pos: Hex, side: 0 | 1, items: string[], mods: TeamMods | undefined, counts: Record<string, number>, summoned = false): Fighter {
    const s = u.stats;
    const f: Fighter = {
      uid: this.nextUid++, unit: u, side, star, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y, moveFrom: null, moveT: 0,
      hp: 0, maxHp: Math.round(s.hp * STAR_MULT[star] * starBoost(u.cost, star)[0]), mana: s.startMana, maxMana: s.mana,
      baseAd: Math.round(s.ad * AD_STAR[star] * starBoost(u.cost, star)[1]), ad: 0, ap: s.ap, armor: s.armor, mr: s.mr, as: s.as, range: s.range,
      crit: s.crit, critDmg: 1.4, dodge: 0, omnivamp: 0, amp: 1, reduce: 0,
      items: [...items], fxs: new Set(items.map((i) => ITEMS[i]?.fx).filter((x): x is ItemFx => !!x)),
      traits: {}, target: null, atkTimer: 0.2 + this.rng.next() * 0.3, castLock: 0, attacks: 0, alive: true, summoned, decoy: false,
      stun: 0, chill: 0, chillV: 0, shred: 0, weaken: 0, blind: 0, silence: 0, mark: 0, griev: 0, ccImmune: 0, taunt: 0, stealth: 0, mirror: 0,
      frenzy: 0, haste: 0, hasteV: 0, critUp: 0, rally: 0, rallyV: 0, guard: 0, guardV: 0,
      perm: {}, struck: 0,
      critV: 0, ampT: 0, ampV: 0, vampT: 0, vampV: 0, dodgeT: 0, dodgeV: 0, mirrorV: 0.6,
      dots: [], shields: [], flags: new Set(), stacks: 0, revived: false, dealt: 0, taken: 0, healed: 0, blocked: 0, shielded: 0, guarded: 0,
    };
    f.ad = f.baseAd;
    // items: flat stats
    for (const id of items) {
      const it = ITEMS[id];
      if (!it) continue;
      const st = it.stats;
      f.ad += st.ad ?? 0; f.ap += st.ap ?? 0; f.armor += st.armor ?? 0; f.mr += st.mr ?? 0; f.maxHp += st.hp ?? 0;
      f.as *= 1 + (st.as ?? 0); f.mana += st.mana ?? 0; f.crit += st.crit ?? 0; f.dodge += st.dodge ?? 0;
    }
    if (f.fxs.has("rapidfire")) f.range += 1;
    if (f.fxs.has("warmog")) f.maxHp = Math.round(f.maxHp * 1.12);
    if (f.fxs.has("blue")) f.maxMana = Math.max(10, f.maxMana - 10);
    if (f.fxs.has("hand")) { f.amp += 0.15; f.omnivamp += 0.15; }
    if (f.fxs.has("bloodthirster")) f.omnivamp += 0.22;
    if (f.fxs.has("gunblade")) f.omnivamp += 0.22;
    if (f.fxs.has("redbuff")) f.amp += 0.06;
    if (f.fxs.has("infinity")) f.critDmg += 0.3;
    if (f.fxs.has("jeweled")) f.critDmg += 0.35;
    // traits this unit carries (with emblems)
    const own = new Set([...u.traits, ...items.map((i) => ITEMS[i]?.trait).filter((t): t is string => !!t)]);
    for (const t of own) { const tier = traitTier(t, counts[t] ?? 0); if (tier >= 0) f.traits[t] = TRAITS[t].vals[tier]; }
    const tt = f.traits;
    if (tt.o_earth) { f.armor += tt.o_earth; f.mr += tt.o_earth; }
    if (tt.o_wind) f.as *= 1 + tt.o_wind;
    if (tt.o_dark) f.omnivamp += tt.o_dark;
    if (tt.c_tank) { f.armor += tt.c_tank; f.mr += tt.c_tank; if (tt.c_tank >= 100) f.maxHp = Math.round(f.maxHp * 1.15); }
    if (tt.c_brute) f.maxHp = Math.round(f.maxHp * (1 + tt.c_brute));
    if (tt.c_assassin) { f.crit += tt.c_assassin; f.critDmg += tt.c_assassin; }
    if (tt.c_marksman) f.ad = Math.round(f.ad * (1 + tt.c_marksman));
    if (tt.c_mage) f.ap += tt.c_mage;
    if (tt.k_beast) f.ad = Math.round(f.ad * (1 + tt.k_beast));
    if (tt.k_flyer) f.dodge += tt.k_flyer;
    if (tt.k_spirit) f.reduce += tt.k_spirit;
    if (tt.k_humanoid) f.mana += tt.k_humanoid;
    if (tt.u_overlord) { f.maxHp = Math.round(f.maxHp * 1.2); f.ad = Math.round(f.ad * 1.2); f.ap += 20; }
    // team-wide traits
    const team = this.teamTraits[side];
    if (team.o_arcane) f.ap += team.o_arcane * (tt.o_arcane ? 2 : 1);
    // augments
    const m = mods ?? {};
    if (m.hp) f.maxHp = Math.round(f.maxHp * (1 + m.hp));
    if (m.ad) f.ad = Math.round(f.ad * (1 + m.ad));
    f.ap += m.ap ?? 0; f.armor += m.armor ?? 0; f.mr += m.mr ?? 0; f.crit += m.crit ?? 0; f.omnivamp += m.omnivamp ?? 0; f.mana += m.mana ?? 0;
    if (m.as) f.as *= 1 + m.as;
    const row = side === 0 ? pos.y - HALF : HALF - 1 - pos.y; // 0 = front row
    if (m.frontline && row <= 1) { f.maxHp += m.frontline.hp; f.armor += m.frontline.armor; }
    if (m.backline && row >= 2) f.amp += m.backline;
    if (m.starPower && star >= 2) { f.maxHp = Math.round(f.maxHp * (1 + m.starPower)); f.ad = Math.round(f.ad * (1 + m.starPower)); }
    f.crit = Math.min(1, f.crit);
    f.hp = f.maxHp;
    // dear units at ★3+: spells come much faster (a 5-gold ★3 casts almost at once)
    if (u.cost >= 4 && star >= 3) {
      f.maxMana = Math.round(f.maxMana * (u.cost === 5 ? 0.5 : 0.75));
      f.mana = Math.max(f.mana, f.maxMana * (u.cost === 5 ? 0.9 : 0.5));
    }
    f.mana = Math.min(f.mana, f.maxMana - 1);
    this.fighters.push(f);
    return f;
  }

  private startOfCombat(f: Fighter) {
    if (f.unit.spell.passive === "start") this.trigger(f, "start");
    const team = this.teamTraits[f.side];
    if (team.o_light) this.addShield(f, team.o_light * (f.traits.o_light ? 2 : 1), 12);
    if (f.traits.k_construct) this.addShield(f, f.maxHp * f.traits.k_construct, 99);
    if (f.traits.u_overlord) f.ccImmune = 4;
    if (f.fxs.has("quicksilver")) f.ccImmune = Math.max(f.ccImmune, 15);
    if (f.unit.cost === 5 && f.star >= 3) f.ccImmune = 999; // a 5-gold ★3 cannot be stopped
    if (f.fxs.has("crownguard")) this.addShield(f, f.maxHp * 0.3, 99, "crownguard");
    if (f.fxs.has("locket")) for (const a of this.allies(f)) if (dist(a, f) <= 1) this.addShield(a, 300, 10, undefined, f);
    if (f.fxs.has("zz")) this.spawnDecoy(f);
    // assassins leap behind the enemy line
    if (f.traits.c_assassin && !f.summoned) {
      const backRow = f.side === 0 ? 0 : ROWS - 1;
      const spots: Hex[] = [];
      for (let dy = 0; dy < 3; dy++) for (let x = 0; x < COLS; x++) { const y = f.side === 0 ? backRow + dy : backRow - dy; if (!this.occupied(x, y)) spots.push({ x, y }); }
      spots.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x));
      const s = spots[0];
      // it stands where it was placed and hops over at the first steps of the fight
      if (s) { this.events.push({ t: "vfx", kind: "leap", at: s, from: { x: f.x, y: f.y }, el: "physical", radius: 0 }); f.moveFrom = { x: f.x, y: f.y }; f.moveT = 0; f.leap = true; f.x = s.x; f.y = s.y; }
    }
  }

  private spawnDecoy(owner: Fighter) {
    const spot = this.freeNear(owner, 2);
    if (!spot) return;
    const base = arenaUnit(owner.unit.id)!;
    const decoyUnit: ArenaUnit = { ...base, id: "zz_guard", name: "Vệ Binh Lấp Lánh", traits: [], stats: { ...base.stats, hp: 600, ad: 0, armor: 30, mr: 30, as: 0.01, range: 1, mana: 999, startMana: 0, crit: 0 } };
    const d = this.addFighter(decoyUnit, 1, spot, owner.side, [], undefined, {}, true);
    d.decoy = true;
    d.taunt = 99;
    this.events.push({ t: "spawn", uid: d.uid });
  }

  // ------------------------------------------------------------ queries
  alive(side?: 0 | 1) { return this.fighters.filter((f) => f.alive && (side === undefined || f.side === side)); }
  enemies(f: Fighter) { return this.fighters.filter((o) => o.alive && o.side !== f.side); }
  allies(f: Fighter) { return this.fighters.filter((o) => o.alive && o.side === f.side); }
  private occupied(x: number, y: number) { return this.fighters.some((o) => o.alive && o.x === x && o.y === y); }
  private freeNear(c: Hex, r: number): Hex | null {
    for (let d = 1; d <= r; d++) for (const h of around(c, d)) if (dist(h, c) === d && !this.occupied(h.x, h.y)) return h;
    return null;
  }
  byUid(uid: number | null) { return uid === null ? undefined : this.fighters.find((f) => f.uid === uid); }

  /** Attack speed right now, with every stacking and timed boost (Guinsoo stacks, haste, chill...). */
  attackSpeed(f: Fighter) { return this.effAs(f); }
  private effAs(f: Fighter) {
    let as = f.as * (1 + (f.haste > this.time ? f.hasteV : 0) + (f.rally > this.time ? f.rallyV : 0) + (f.fxs.has("guinsoo") ? f.stacks * 0.05 : 0));
    if (f.fxs.has("quicksilver")) as *= 1 + 0.05 * Math.min(10, Math.floor(this.time / 2));
    if (f.flags.has("edge")) as *= 1.3;
    if (f.chill > this.time) as *= 1 - f.chillV;
    return Math.min(5, Math.max(0.1, as));
  }

  // ------------------------------------------------------------ main loop
  step() {
    if (this.winner !== null) return;
    this.time += DT;
    const t = this.time;
    // scheduled things (projectiles landing, waves...)
    const due = this.pending.filter((p) => p.at <= t);
    this.pending = this.pending.filter((p) => p.at > t);
    for (const p of due) p.fn();
    // once a second: damage over time, regeneration, auras
    const second = Math.floor(t) !== Math.floor(t - DT);
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (second) this.perSecond(f);
      // drawn position
      if (f.moveFrom) {
        f.moveT += DT / MOVE_TIME;
        if (f.moveT >= 1) { f.moveFrom = null; f.leap = false; f.fx = f.x; f.fy = f.y; }
        else { f.fx = f.moveFrom.x + (f.x - f.moveFrom.x) * f.moveT; f.fy = f.moveFrom.y + (f.y - f.moveFrom.y) * f.moveT; }
      }
    }
    if (second) this.zoneTick();
    for (const f of this.fighters) if (f.alive) this.act(f);
    // the end
    const a = this.alive(0).filter((f) => !f.decoy).length, b = this.alive(1).filter((f) => !f.decoy).length;
    if (!a || !b) this.winner = a ? 0 : b ? 1 : -1;
    else if (t >= TIME_LIMIT) this.winner = -1;
  }

  /** Runs to the end (for CPU fights and tests). */
  run(): 0 | 1 | -1 {
    for (let i = 0; i < TIME_LIMIT / DT + 5 && this.winner === null; i++) this.step();
    return this.winner ?? -1;
  }

  survivors(side: 0 | 1) { return this.alive(side).filter((f) => !f.summoned && !f.decoy); }

  private perSecond(f: Fighter) {
    const t = this.time;
    for (const d of f.dots) if (d.until >= t) this.damage(this.byUid(d.src) ?? f, f, d.dps, d.kind === "bleed" ? "phys" : "true", { dot: true });
    f.dots = f.dots.filter((d) => d.until > t);
    f.shields = f.shields.filter((s) => s.until > t && s.amt > 0);
    if (!f.alive) return;
    const pv = f.unit.spell.passive;
    if (pv?.startsWith("second") && Math.round(t) % Number(pv.slice(6)) === 0) this.trigger(f, pv);
    if (!f.alive) return;
    if (f.traits.k_plant) this.heal(f, f.maxHp * f.traits.k_plant, f);
    if (f.traits.o_water && Math.round(t) % 3 === 0) this.heal(f, f.maxHp * f.traits.o_water, f);
    if (f.frenzy > t) this.heal(f, f.maxHp * 0.03, f);
    const sup = this.teamTraits[f.side].c_support;
    if (sup) f.mana = Math.min(f.maxMana, f.mana + sup);
    if (f.fxs.has("dragonclaw") && Math.round(t) % 2 === 0) this.heal(f, f.maxHp * 0.05, f);
    if (f.fxs.has("adaptive") && Math.round(t) % 3 === 0) f.mana = Math.min(f.maxMana, f.mana + 10);
    if (f.fxs.has("archangel") && Math.round(t) % 5 === 0) f.ap += 20;
    if (f.fxs.has("redemption") && Math.round(t) % 5 === 0) for (const a of this.allies(f)) if (dist(a, f) <= 1) this.heal(a, (a.maxHp - a.hp) * 0.12, f);
    if (f.fxs.has("sunfire") && Math.round(t) % 2 === 0) for (const e of this.enemies(f)) if (dist(e, f) <= 2) { this.addDot(e, "burn", e.maxHp * 0.01, 3, f); e.griev = t + 3; }
    if (f.fxs.has("gargoyle")) { const n = this.enemies(f).filter((e) => e.target === f.uid).length; f.guard = t + 1.1; f.guardV = n * 10; }
    if (f.fxs.has("ionic")) for (const e of this.enemies(f)) if (dist(e, f) <= 2) e.shred = Math.max(e.shred, t + 1.1);
    // overtime: everyone hurts more and more
    if (t > OVERTIME) f.amp += 0.08;
  }

  private zoneTick() {
    const t = this.time;
    for (const z of this.zones) {
      if (z.until < t) continue;
      const src = this.byUid(z.src);
      if (z.heal) { for (const a of this.fighters) if (a.alive && a.side === z.side && dist(a, z.at) <= z.radius) this.heal(a, z.dps, src ?? a); continue; }
      this.events.push({ t: "vfx", kind: "zone", at: z.at, el: z.el, radius: z.radius });
      for (const e of this.fighters) if (e.alive && e.side !== z.side && dist(e, z.at) <= z.radius) {
        this.damage(src ?? e, e, z.dps, z.physical ? "phys" : "magic", { spell: true });
        if (z.slow) { e.chill = t + 1.2; e.chillV = Math.max(e.chillV, z.slow); }
      }
    }
    this.zones = this.zones.filter((z) => z.until >= t);
  }

  private act(f: Fighter) {
    const t = this.time;
    if (f.decoy) return;
    if (f.stun > t) return;
    if (f.castLock > 0) { f.castLock -= DT; return; }
    if (!f.unit.spell.passive && f.mana >= f.maxMana && f.silence <= t) { this.cast(f); return; }
    // target: a taunting enemy nearby, else keep the current one, else the nearest
    let tg = this.byUid(f.target);
    const taunter = this.enemies(f).find((e) => e.taunt > t && dist(e, f) <= 2);
    if (taunter) tg = taunter;
    if (!tg || !tg.alive || tg.stealth > t) {
      const es = this.enemies(f).filter((e) => e.stealth <= t);
      tg = es.sort((a, b) => dist(a, f) - dist(b, f) || a.hp - b.hp)[0];
    }
    f.target = tg?.uid ?? null;
    if (!tg) return;
    if (dist(f, tg) <= f.range) {
      if (f.moveFrom) return; // finish the step first
      f.atkTimer -= DT;
      if (f.atkTimer <= 0) { f.atkTimer += 1 / this.effAs(f); this.attack(f, tg); }
    } else if (!f.moveFrom) {
      const blocked = (x: number, y: number) => this.occupied(x, y);
      let next = stepToward(f, tg, f.range, blocked);
      if (!next) {
        // no way through to this one: go for the nearest enemy that can be reached (or hit from here)
        const others = this.enemies(f).filter((e) => e !== tg && e.stealth <= t && !e.decoy).sort((a, b) => dist(a, f) - dist(b, f));
        for (const e of others) {
          if (dist(f, e) <= f.range) { f.target = e.uid; return; } // attack it from the next tick
          const n = stepToward(f, e, f.range, blocked);
          if (n) { f.target = e.uid; next = n; break; }
        }
      }
      // nothing reachable at all: wait where we stand
      if (next) { f.moveFrom = { x: f.x, y: f.y }; f.moveT = 0; f.x = next.x; f.y = next.y; }
    }
  }

  // ------------------------------------------------------------ attacks
  private attack(f: Fighter, tg: Fighter) {
    const ranged = f.range > 1;
    const el: Element = (Object.keys(f.traits).map((k) => EL_OF_ORIGIN[k]).find(Boolean) ?? f.unit.origin) as Element;
    this.events.push({ t: "attack", from: f.uid, to: tg.uid, ranged, el, time: this.time });
    f.attacks++;
    const land = () => {
      if (!f.alive || !tg.alive) return;
      if (f.blind > this.time || this.rng.next() < tg.dodge + (tg.dodgeT > this.time ? tg.dodgeV : 0)) { this.events.push({ t: "miss", uid: tg.uid }); return; }
      const crit = this.rng.next() < f.crit + (f.critUp > this.time ? f.critV : 0);
      let dmg = f.ad * (crit ? f.critDmg : 1);
      if (f.fxs.has("giantslayer") && tg.maxHp > 1600) dmg *= 1.25;
      const dealt = this.damage(f, tg, dmg, "phys", { crit, attack: true });
      this.onHit(f, tg, crit, dealt);
      const pv = f.unit.spell.passive;
      if (pv?.startsWith("attack") && f.alive && f.attacks % Number(pv.slice(6) || 1) === 0) this.trigger(f, pv);
    };
    if (ranged) this.pending.push({ at: this.time + Math.max(0.08, dist(f, tg) * 0.07), fn: land });
    else land();
    // mana from attacking
    f.mana = Math.min(f.maxMana, f.mana + 10 + (f.traits.k_humanoid ? f.traits.k_humanoid / 10 : 0) + (f.fxs.has("shojin") ? 5 : 0));
    if (f.fxs.has("guinsoo")) f.stacks++;
    if (f.fxs.has("titans") && f.stacks < 25) f.stacks++;
    if (f.fxs.has("runaan")) {
      const other = this.enemies(f).filter((e) => e !== tg).sort((a, b) => dist(a, f) - dist(b, f))[0];
      if (other) { this.events.push({ t: "attack", from: f.uid, to: other.uid, ranged: true, el: "wind", time: this.time }); this.pending.push({ at: this.time + 0.2, fn: () => other.alive && f.alive && this.damage(f, other, f.ad * 0.55, "phys", { attack: true }) }); }
    }
    if ((f.fxs.has("statikk") || f.traits.o_lightning) && f.attacks % 3 === 0) {
      const chain = this.enemies(f).sort((a, b) => dist(a, tg) - dist(b, tg)).slice(0, 3);
      const dmg = (f.fxs.has("statikk") ? 100 : 0) + (f.traits.o_lightning ?? 0);
      for (const e of chain) { this.damage(f, e, dmg, "magic", {}); if (f.fxs.has("statikk")) e.shred = this.time + 4; }
      this.events.push({ t: "vfx", kind: "chain", at: { x: tg.x, y: tg.y }, el: "lightning", radius: 0, from: { x: f.x, y: f.y } });
    }
  }

  private onHit(f: Fighter, tg: Fighter, crit: boolean, dealt: number) {
    const t = this.time;
    if (!tg.alive) return;
    if (f.traits.o_fire) this.addDot(tg, "burn", tg.maxHp * f.traits.o_fire, 3, f);
    if (f.traits.o_ice) { tg.chill = t + 2; tg.chillV = Math.max(tg.chill > t ? tg.chillV : 0, f.traits.o_ice); }
    if (f.traits.o_poison) { this.addDot(tg, "poison", tg.maxHp * f.traits.o_poison, 3, f); tg.griev = t + 3; }
    if (f.fxs.has("morello") || f.fxs.has("redbuff")) { this.addDot(tg, "burn", tg.maxHp * 0.01, 3, f); tg.griev = t + 3; }
    if (crit && f.fxs.has("lastwhisper")) tg.shred = t + 3;
    if (tg.fxs.has("spiked") && dealt > 0) this.damage(tg, f, dealt * 0.25, "magic", {});
    if (tg.fxs.has("bramble") && !tg.flags.has(`bramble${Math.floor(t / 2)}`)) {
      tg.flags.add(`bramble${Math.floor(t / 2)}`);
      for (const e of this.enemies(tg)) if (dist(e, tg) <= 1) this.damage(tg, e, 80, "magic", {});
    }
    if (tg.fxs.has("titans") && tg.stacks < 25) tg.stacks++;
  }

  // ------------------------------------------------------------ damage, healing, shields
  /** Deals damage after mitigation; returns what got through to health and shields. */
  damage(src: Fighter, tg: Fighter, raw: number, kind: "phys" | "magic" | "true", o: { crit?: boolean; attack?: boolean; spell?: boolean; dot?: boolean; pierce?: boolean } = {}): number {
    if (!tg.alive || raw <= 0) return 0;
    const t = this.time;
    let dmg = raw * src.amp * (src.ampT > t ? 1 + src.ampV : 1) * (src.weaken > t ? 0.75 : 1) * (tg.mark > t ? 1.2 : 1);
    if (src.fxs.has("titans")) dmg *= 1 + src.stacks * 0.02;
    if (src.flags.has("steraks")) dmg *= 1.35;
    if (o.spell && src.fxs.has("rabadon")) dmg *= 1.2;
    const raw0 = dmg;
    if (kind !== "true") {
      let res = kind === "phys" ? tg.armor : tg.mr;
      res += (tg.guard > t ? tg.guardV : 0) + (tg.mirror > t ? 40 : 0) + (tg.fxs.has("titans") && tg.stacks >= 25 ? 25 : 0) + (tg.flags.has("protector") ? 20 : 0);
      if (tg.shred > t) res *= 0.7;
      if (o.pierce) res *= 0.6;
      dmg *= 100 / (100 + Math.max(0, res));
    }
    dmg *= 1 - tg.reduce;
    dmg = Math.max(1, Math.round(dmg));
    tg.blocked += Math.max(0, Math.round(raw0 - dmg)); // stopped by armor / resist
    // shields first
    let left = dmg;
    for (const s of tg.shields) {
      if (left <= 0) break;
      const use = Math.min(s.amt, left);
      s.amt -= use; left -= use;
      if (s.amt <= 0 && s.tag === "crownguard") tg.ap += 25;
    }
    tg.blocked += dmg - left;
    tg.shields = tg.shields.filter((s) => s.amt > 0);
    tg.hp -= left;
    tg.taken += dmg;
    src.dealt += dmg;
    this.events.push({ t: "hit", uid: tg.uid, amount: dmg, crit: !!o.crit, magic: kind === "magic", trueDmg: kind === "true", el: src.unit.origin });
    // mana from being hit
    if (!o.dot) tg.mana = Math.min(tg.maxMana, tg.mana + Math.min(15, 1 + dmg * 0.03));
    // vamp
    const vamp = src.omnivamp + (src.vampT > t ? src.vampV : 0);
    if (vamp && !o.dot && src.alive) this.heal(src, dmg * vamp, src);
    if (tg.mirror > t && src !== tg && !o.dot && src.alive) this.damage(tg, src, dmg * tg.mirrorV, "true", { dot: true });
    this.thresholds(tg);
    if (tg.hp <= 0) this.kill(tg, src);
    else if (o.attack) {
      tg.struck++;
      const pv = tg.unit.spell.passive;
      if (pv?.startsWith("struck") && tg.struck % Number(pv.slice(6)) === 0) this.trigger(tg, pv);
    }
    return dmg;
  }

  private thresholds(f: Fighter) {
    if (!f.alive || f.hp <= 0) return;
    const pct = f.hp / f.maxHp;
    if (pct < 0.5 && f.unit.spell.passive === "hurt50" && !f.flags.has("hurt50")) { f.flags.add("hurt50"); this.trigger(f, "hurt50"); }
    if (pct < 0.6 && f.fxs.has("edge") && !f.flags.has("edge")) { f.flags.add("edge"); f.stealth = this.time + 1; this.events.push({ t: "status", uid: f.uid, s: "stealth" }); }
    if (pct < 0.6 && f.fxs.has("steraks") && !f.flags.has("steraks")) { f.flags.add("steraks"); this.addShield(f, f.maxHp * 0.25, 6); }
    if (pct < 0.4 && f.fxs.has("bloodthirster") && !f.flags.has("bt")) { f.flags.add("bt"); this.addShield(f, f.maxHp * 0.25, 5); }
    if (pct < 0.4 && f.fxs.has("protector") && !f.flags.has("protector")) { f.flags.add("protector"); this.addShield(f, f.maxHp * 0.3, 6); }
  }

  private kill(f: Fighter, by: Fighter) {
    if (!f.alive) return;
    if (f.traits.k_undead && !f.revived) {
      f.revived = true;
      f.hp = Math.round(f.maxHp * f.traits.k_undead);
      f.dots = [];
      this.events.push({ t: "revive", uid: f.uid });
      return;
    }
    f.alive = false;
    f.hp = 0;
    this.events.push({ t: "death", uid: f.uid });
    if (by.alive && by !== f) {
      if (by.fxs.has("deathblade")) by.ad += 10;
      if (by.unit.spell.passive === "kill" && by.side !== f.side) this.trigger(by, "kill");
    }
  }

  heal(f: Fighter, amount: number, by: Fighter) {
    if (!f.alive || amount <= 0) return;
    let a = amount * (f.griev > this.time ? 0.67 : 1);
    if (this.teamTraits[by.side].c_support) a *= 1.2;
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + a);
    const got = Math.round(f.hp - before);
    if (got > 0) { by.healed += got; this.events.push({ t: "heal", uid: f.uid, amount: got }); }
  }

  addShield(f: Fighter, amount: number, secs: number, tag?: string, by: Fighter = f) {
    if (!f.alive || amount <= 0) return;
    by.shielded += Math.round(amount);
    f.shields.push({ amt: Math.round(amount), until: this.time + secs, tag });
    this.events.push({ t: "shield", uid: f.uid, amount: Math.round(amount) });
  }

  private addDot(f: Fighter, kind: Dot["kind"], dps: number, secs: number, src: Fighter) {
    const cur = f.dots.find((d) => d.kind === kind && d.src === src.uid);
    if (cur) { cur.until = this.time + secs; cur.dps = Math.max(cur.dps, dps); }
    else f.dots.push({ kind, dps, until: this.time + secs, src: src.uid });
  }

  private debuff(f: Fighter, id: Debuff, secs: number, src: Fighter) {
    const t = this.time;
    if (!f.alive) return;
    switch (id) {
      case "stun": if (f.ccImmune > t) return; f.stun = Math.max(f.stun, t + secs); break;
      case "burn": this.addDot(f, "burn", f.maxHp * 0.02, secs, src); break;
      case "poison": this.addDot(f, "poison", f.maxHp * 0.015, secs, src); f.griev = t + secs; break;
      case "bleed": this.addDot(f, "bleed", src.ad * 0.25, secs, src); break;
      case "chill": f.chill = t + secs; f.chillV = Math.max(0.3, f.chillV); break;
      case "shred": f.shred = t + secs; break;
      case "weaken": f.weaken = t + secs; break;
      case "blind": f.blind = t + secs; break;
      case "silence": if (f.ccImmune > t) return; f.silence = t + secs; break;
      case "mark": f.mark = t + secs; break;
    }
    this.events.push({ t: "status", uid: f.uid, s: id });
  }

  // ------------------------------------------------------------ spells
  /** A share `mult` of the caster's spell power (stars, cost boost, AP or AD), maybe a crit. */
  private spellPower(f: Fighter, mult = 1): { amt: number; crit: boolean } {
    const sp = f.unit.spell;
    let amt = spellBase(f.unit) * STAR_SPELL[f.star] * starBoost(f.unit.cost, f.star)[2] * mult;
    amt *= sp.physical ? f.ad / Math.max(1, f.baseAd) : f.ap / 100;
    const canCrit = f.fxs.has("infinity") || f.fxs.has("jeweled");
    const crit = canCrit && this.rng.next() < f.crit;
    if (crit) amt *= f.critDmg;
    return { amt, crit };
  }

  /** One spell hit: damage, then the caster's on-hit traits and items. */
  private spellHit(f: Fighter, tg: Fighter, mult: number, o: { type?: string; pierce?: boolean; ls?: number } = {}) {
    if (!tg.alive || !f.alive) return 0;
    const sp = f.unit.spell;
    const { amt, crit } = this.spellPower(f, mult);
    const kind = o.type === "t" ? "true" : o.type === "m" ? "magic" : o.type === "p" ? "phys" : sp.physical ? "phys" : "magic";
    const dealt = this.damage(f, tg, amt, kind, { crit, spell: true, pierce: o.pierce });
    if (o.ls) this.heal(f, dealt * o.ls, f);
    if (f.traits.o_fire) this.addDot(tg, "burn", tg.maxHp * f.traits.o_fire, 3, f);
    if (f.traits.o_poison) { this.addDot(tg, "poison", tg.maxHp * f.traits.o_poison, 3, f); tg.griev = this.time + 3; }
    if (f.fxs.has("morello")) { this.addDot(tg, "burn", tg.maxHp * 0.01, 3, f); tg.griev = this.time + 3; }
    return dealt;
  }

  /**
   * Who an effect reaches (see src/arena/spells.ts): fighters plus the hex it centres on.
   * Random picks are kept for the whole cast so "dmg rand3 | dot rand3" hit the same three.
   */
  private pick(f: Fighter, w: string, cache: Map<string, Fighter[]>): { list: Fighter[]; at: Hex | null } {
    const p = parseWho(w);
    const t = this.time;
    const hexOf = (u: Fighter): Hex => ({ x: u.x, y: u.y });
    if (p.ally) {
      const al = this.allies(f).filter((a) => !a.decoy);
      let list: Fighter[];
      switch (p.base) {
        case "me": list = p.r >= 0 ? al.filter((a) => dist(a, f) <= p.r) : [f]; break;
        case "low": list = [...al].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, p.n); break;
        case "carry": list = [...al].sort((a, b) => b.dealt - a.dealt || b.ad - a.ad).slice(0, p.n); break;
        case "all": list = al; break;
        default: list = [f];
      }
      return { list, at: hexOf(list[0] ?? f) };
    }
    const all = this.enemies(f).filter((e) => !e.decoy || e.taunt > t);
    const seen = all.filter((e) => e.stealth <= t);
    const pool = seen.length ? seen : all;
    const cur = this.byUid(f.target);
    const tgt = cur && cur.alive && cur.side !== f.side ? cur : [...pool].sort((a, b) => dist(a, f) - dist(b, f))[0];
    let base: Fighter[] = [];
    let at: Hex | null = null;
    switch (p.base) {
      case "t": base = tgt ? [tgt] : []; break;
      case "near": base = [...pool].sort((a, b) => dist(a, f) - dist(b, f)).slice(0, p.n); break;
      case "far": base = [...pool].sort((a, b) => dist(b, f) - dist(a, f)).slice(0, p.n); break;
      case "low": base = [...pool].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, p.n); break;
      case "high": base = [...pool].sort((a, b) => b.maxHp - a.maxHp).slice(0, p.n); break;
      case "carry": base = [...pool].sort((a, b) => b.dealt - a.dealt || b.ad + b.ap - a.ad - a.ap).slice(0, p.n); break;
      case "back": base = [...pool].sort((a, b) => (f.side === 0 ? a.y - b.y : b.y - a.y) || dist(b, f) - dist(a, f)).slice(0, p.n); break;
      case "rand": {
        const k = `rand${p.n}`;
        let c = cache.get(k)?.filter((e) => e.alive);
        if (!c || !c.length) { c = [...pool].sort(() => this.rng.next() - 0.5).slice(0, p.n); cache.set(k, c); }
        base = c;
        break;
      }
      case "dense": {
        let best: Fighter | undefined, bn = -1;
        for (const e of pool) { const n = all.filter((o) => dist(o, e) <= 1).length; if (n > bn) { bn = n; best = e; } }
        base = best ? [best] : [];
        break;
      }
      case "all": return { list: all, at: { x: 3, y: f.side === 0 ? 1 : ROWS - 2 } };
      case "line": return { list: tgt ? this.lineFrom(f, tgt) : [], at: tgt ? hexOf(tgt) : null };
      case "me": base = []; at = hexOf(f); break;
    }
    if (!at && base[0]) at = hexOf(base[0]);
    if (p.r >= 0) {
      const centres: Hex[] = p.base === "me" ? [hexOf(f)] : base.map(hexOf);
      return { list: all.filter((e) => centres.some((c) => dist(e, c) <= p.r)), at };
    }
    return { list: base, at };
  }

  /** A passive spell going off (no mana, no casting pause). */
  private trigger(f: Fighter, why: string) {
    if (!f.alive) return;
    const sp = f.unit.spell;
    const cache = new Map<string, Fighter[]>();
    const targets = new Set<number>();
    let at: Hex | undefined;
    for (const e of sp.fx) { const r = this.runFx(f, e, cache, targets); at ??= r ?? undefined; }
    // every-attack passives are too frequent for a banner
    if (why !== "attack") this.events.push({ t: "cast", uid: f.uid, spell: sp, targets: [...targets], at });
  }

  /** Stats a unit has earned for good in earlier rounds. */
  private applyBonus(f: Fighter, b?: Record<string, number>) {
    if (!b) return;
    if (b.ap) f.ap += b.ap;
    if (b.ad) f.ad += f.baseAd * b.ad;
    if (b.armor) { f.armor += b.armor; f.mr += b.armor; }
    if (b.as) f.as *= 1 + b.as;
    if (b.hp) { f.maxHp = Math.round(f.maxHp * (1 + b.hp)); f.hp = f.maxHp; }
  }

  /** What each of a side's units earned for good this fight (by the player's copy). */
  gains(side: 0 | 1): { ref: number; stat: string; v: number }[] {
    const out: { ref: number; stat: string; v: number }[] = [];
    for (const f of this.fighters) if (f.side === side && f.ref !== undefined) for (const [stat, v] of Object.entries(f.perm)) out.push({ ref: f.ref, stat, v });
    return out;
  }

  private cast(f: Fighter) {
    const sp = f.unit.spell;
    f.mana = f.fxs.has("blue") ? 10 : 0;
    f.castLock = 0.45;
    // ionic spark: enemies near an ionic carrier get struck when they cast
    for (const e of this.enemies(f)) if (e.fxs.has("ionic") && dist(e, f) <= 2) this.damage(e, f, 60, "magic", {});
    if (!f.alive) return;
    const cache = new Map<string, Fighter[]>();
    const targets = new Set<number>();
    let at: Hex | undefined;
    for (const e of sp.fx) {
      const r = this.runFx(f, e, cache, targets);
      at ??= r ?? undefined;
    }
    if (f.fxs.has("blue")) f.mana = Math.min(f.maxMana, f.mana + 10);
    this.events.push({ t: "cast", uid: f.uid, spell: sp, targets: [...targets], at });
  }

  /** Runs one effect of a spell (now, or later for delayed and repeated ones). */
  private runFx(f: Fighter, e: Fx, cache: Map<string, Fighter[]>, targets: Set<number>): Hex | null {
    const t = this.time;
    const sp = f.unit.spell;
    const hexOf = (u: Fighter): Hex => ({ x: u.x, y: u.y });
    const x = Math.max(1, Number(e.o.x ?? 1));
    const gap = Number(e.o.gap ?? 0.25);
    const delay = Number(e.o.delay ?? 0);
    const later = (i: number, fn: () => void) => { const d = delay + i * gap; if (d <= 0) fn(); else this.pending.push({ at: t + d, fn: () => { if (f.alive) fn(); } }); };
    const vfx = (kind: string, to: Hex, radius = 0, from?: Hex) => this.events.push({ t: "vfx", kind, at: to, el: sp.el, radius, from });
    const radiusOf = (w: string) => { const p = parseWho(w); return p.base === "all" ? 9 : Math.max(0, p.r); };
    switch (e.k) {
      case "dmg": {
        let first: Hex | null = null;
        for (let i = 0; i < x; i++) later(i, () => {
          const { list, at } = this.pick(f, e.w!, cache);
          if (at) {
            const fx = e.o.fx ?? "bolt";
            if (fx === "ring" || fx === "meteor" || fx === "volley") vfx(fx, at, Math.max(1, radiusOf(e.w!)));
            else if (fx === "beam") vfx("beam", at, 0, hexOf(f));
          }
          for (const tg of list) {
            targets.add(tg.uid);
            if (e.o.fx === "bolt" || !e.o.fx) vfx("bolt", hexOf(tg), 0, hexOf(f));
            else if (e.o.fx === "slash") vfx("slash", hexOf(tg), 0, hexOf(f));
            this.spellHit(f, tg, e.p!, { type: e.o.type, pierce: !!e.o.pierce, ls: e.o.ls ? Number(e.o.ls) : undefined });
          }
          first ??= at;
        });
        return first ?? this.pick(f, e.w!, cache).at;
      }
      case "dot": {
        const { list, at } = this.pick(f, e.w!, cache);
        const total = this.spellPower(f, e.p!).amt;
        for (const tg of list) { targets.add(tg.uid); this.addDot(tg, e.id as Dot["kind"], total / e.dur!, e.dur!, f); this.events.push({ t: "status", uid: tg.uid, s: e.id as Debuff }); if (e.id === "poison") tg.griev = t + e.dur!; }
        return at;
      }
      case "cc": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const tg of list) { targets.add(tg.uid); this.debuff(tg, e.id as Debuff, e.dur!, f); }
        return at;
      }
      case "heal": {
        let first: Hex | null = null;
        for (let i = 0; i < x; i++) later(i, () => {
          const { list, at } = this.pick(f, e.w!, cache);
          const amt = this.spellPower(f, e.p!).amt;
          for (const a of list) { targets.add(a.uid); this.heal(a, amt, f); vfx("pillar", hexOf(a)); }
          first ??= at;
        });
        return first;
      }
      case "hpct": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const a of list) { targets.add(a.uid); this.heal(a, a.maxHp * e.v!, f); vfx("pillar", hexOf(a)); }
        return at;
      }
      case "shield": {
        const { list, at } = this.pick(f, e.w!, cache);
        const amt = this.spellPower(f, e.p!).amt;
        for (const a of list) { targets.add(a.uid); this.addShield(a, amt, e.dur!, undefined, f); }
        return at;
      }
      case "buff": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const a of list) { targets.add(a.uid); this.buff(a, e.id!, e.v!, e.dur ?? 4, f); }
        return at;
      }
      case "stack": {
        const v = e.v!;
        if (e.id === "ad") f.ad += f.baseAd * v;
        else if (e.id === "ap") f.ap += v;
        else if (e.id === "armor") { f.armor += v; f.mr += v; }
        else if (e.id === "as") f.as *= 1 + v;
        else if (e.id === "hp") { const add = f.maxHp * v; f.maxHp += add; f.hp += add; }
        this.events.push({ t: "status", uid: f.uid, s: "buff" });
        return hexOf(f);
      }
      case "dash": case "blink": {
        const tg = this.pick(f, e.w!, cache).list[0];
        if (!tg) return null;
        let spot: Hex | null = null;
        if (e.k === "blink") {
          // the free hex next to the target that is farthest from where we stand
          const opts = neighbors(tg.x, tg.y).filter((h) => !this.occupied(h.x, h.y)).sort((a, b) => dist(b, f) - dist(a, f));
          spot = opts[0] ?? this.freeNear(tg, 2);
        } else spot = dist(f, tg) <= 1 ? null : this.freeNear(tg, 2);
        if (spot) { vfx("leap", spot, 0, hexOf(f)); this.place(f, spot, false); }
        f.target = tg.uid;
        targets.add(tg.uid);
        return hexOf(tg);
      }
      case "knock": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const tg of list) {
          if (tg.ccImmune > t) continue;
          let cur: Hex = hexOf(tg);
          for (let i = 0; i < (e.n ?? 1); i++) {
            const next = neighbors(cur.x, cur.y).filter((h) => !this.occupied(h.x, h.y) && dist(h, f) > dist(cur, f)).sort((a, b) => dist(b, f) - dist(a, f))[0];
            if (!next) break;
            cur = next;
          }
          if (cur.x !== tg.x || cur.y !== tg.y) this.place(tg, cur, true);
          targets.add(tg.uid);
        }
        return at;
      }
      case "pull": {
        const { list, at } = this.pick(f, e.w!, cache);
        const centre = parseWho(e.w!).base === "dense" || parseWho(e.w!).r >= 0 && parseWho(e.w!).base !== "me" ? at : hexOf(f);
        for (const tg of [...list].sort((a, b) => dist(a, centre ?? f) - dist(b, centre ?? f))) {
          if (tg.ccImmune > t || !centre || dist(tg, centre) <= 1) continue;
          const spot = this.freeNear(centre, 2);
          if (spot && dist(spot, centre) < dist(tg, centre)) this.place(tg, spot, true);
          targets.add(tg.uid);
        }
        if (centre) vfx("ring", centre, 1);
        return centre;
      }
      case "swap": {
        const tg = this.pick(f, e.w!, cache).list[0];
        if (!tg) return null;
        const a = hexOf(f), b = hexOf(tg);
        vfx("swap", b, 0, a);
        this.place(f, b, false);
        this.place(tg, a, false);
        f.target = tg.uid;
        targets.add(tg.uid);
        return a;
      }
      case "mana": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const u of list) { targets.add(u.uid); u.mana = Math.max(0, Math.min(u.maxMana - (u === f ? 1 : 0), u.mana + e.v!)); }
        return at;
      }
      case "zone": {
        const ally = e.w!.startsWith("a:");
        const { at } = ally ? { at: hexOf(f) } : this.pick(f, e.w!, cache);
        const centre = e.w === "all" ? { x: 3, y: 3 } : at ?? hexOf(f);
        this.zones.push({ side: f.side, at: centre, radius: e.w === "all" ? 9 : e.r!, dps: this.spellPower(f, e.p!).amt, until: t + e.dur!, src: f.uid, el: sp.el, physical: sp.physical, slow: e.o.slow ? Number(e.o.slow) : undefined, heal: !!e.o.heal || ally });
        vfx(e.o.heal || ally ? "pillar" : "ring", centre, e.w === "all" ? 4 : e.r!);
        return centre;
      }
      case "chain": {
        let cur: Fighter | undefined = this.pick(f, e.w!, cache).list[0];
        if (!cur) return null;
        const start = hexOf(cur);
        const hit = new Set<number>();
        let from: Hex = hexOf(f);
        for (let i = 0; i < e.n! && cur; i++) {
          const c: Fighter = cur, src = from;
          this.pending.push({ at: t + 0.08 * i + 0.001, fn: () => { if (c.alive && f.alive) { vfx("chain", hexOf(c), 0, src); this.spellHit(f, c, e.p!); } } });
          targets.add(c.uid);
          hit.add(c.uid);
          from = hexOf(c);
          const es = this.enemies(f);
          cur = es.filter((o) => !hit.has(o.uid)).sort((a, b) => dist(a, c) - dist(b, c))[0];
          if (!cur && es.length > 1) { hit.clear(); hit.add(c.uid); cur = es.filter((o) => o !== c).sort((a, b) => dist(a, c) - dist(b, c))[0]; }
        }
        return start;
      }
      case "multi": {
        for (let i = 0; i < e.n!; i++) this.pending.push({ at: t + 0.08 + i * 0.1, fn: () => {
          const pool = this.enemies(f);
          const tg = pool[Math.floor(this.rng.next() * pool.length)];
          if (tg && f.alive) { vfx("bolt", hexOf(tg), 0, hexOf(f)); this.spellHit(f, tg, e.p!); }
        } });
        return null;
      }
      case "summon": {
        const kin = arenaUnits().filter((u) => u.floor === f.unit.floor && u.cost <= (sp.ult ? 2 : 1));
        for (let i = 0; i < e.n! && kin.length; i++) {
          const spot = this.freeNear(f, 3);
          if (!spot) break;
          // ordinary units call weaker kin; a boss's horde comes at its own star
          const star = (sp.ult ? f.star : Math.max(1, f.star - 1)) as Star;
          const m = this.addFighter(kin[i % kin.length], star, spot, f.side, [], undefined, {}, true);
          m.atkTimer = 0.5;
          this.events.push({ t: "spawn", uid: m.uid });
        }
        return hexOf(f);
      }
      case "revive": {
        const dead = this.fighters.filter((o) => !o.alive && o.side === f.side && !o.summoned && !o.decoy).sort((a, b) => dist(a, f) - dist(b, f))[0];
        if (!dead) return null;
        const spot = this.occupied(dead.x, dead.y) ? this.freeNear(dead, 2) : { x: dead.x, y: dead.y };
        if (!spot) return null;
        dead.alive = true; dead.hp = Math.round(dead.maxHp * e.v!); dead.dots = []; dead.stun = 0; dead.mana = 0;
        this.place(dead, spot, false);
        this.events.push({ t: "revive", uid: dead.uid });
        targets.add(dead.uid);
        return spot;
      }
      case "cleanse": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const a of list) { a.stun = 0; a.chill = 0; a.shred = 0; a.weaken = 0; a.blind = 0; a.silence = 0; a.mark = 0; a.dots = []; a.griev = 0; targets.add(a.uid); }
        return at;
      }
      case "taunt": {
        f.taunt = t + e.dur!;
        for (const o of this.enemies(f)) if (dist(o, f) <= e.r!) o.target = f.uid;
        this.events.push({ t: "status", uid: f.uid, s: "taunt" });
        return hexOf(f);
      }
      case "stealth": f.stealth = t + e.dur!; this.events.push({ t: "status", uid: f.uid, s: "stealth" }); return hexOf(f);
      case "reflect": f.mirror = t + e.dur!; f.mirrorV = e.v!; this.events.push({ t: "status", uid: f.uid, s: "mirror" }); return hexOf(f);
      case "steal": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const tg of list) {
          targets.add(tg.uid);
          if (e.id === "armor") { const v = Math.min(tg.armor, e.v!); tg.armor -= v; f.armor += v; }
          else if (e.id === "ad") { const v = Math.min(tg.ad * 0.5, e.v!); tg.ad -= v; f.ad += v; }
          else { const v = Math.min(tg.mana, e.v!); tg.mana -= v; f.mana = Math.min(f.maxMana - 1, f.mana + v); }
        }
        return at;
      }
      case "exec": {
        const { list, at } = this.pick(f, e.w!, cache);
        for (const tg of list) if (tg.alive && tg.hp / tg.maxHp < e.v!) { targets.add(tg.uid); vfx("slash", hexOf(tg), 0, hexOf(f)); this.damage(f, tg, tg.hp + tg.shields.reduce((s, x) => s + x.amt, 0) + 1, "true", { spell: true }); }
        return at;
      }
      case "hurt": f.hp = Math.max(1, f.hp - f.maxHp * e.v!); return null;
      case "perm": case "loot": {
        if (e.o.kill && ![...targets].some((uid) => !this.byUid(uid)?.alive)) return null;
        if (e.k === "perm") {
          const v = e.v!;
          f.perm[e.id!] = (f.perm[e.id!] ?? 0) + v;
          if (e.id === "hp") { const add = f.maxHp * v; f.maxHp = Math.round(f.maxHp + add); f.hp += add; } else this.applyBonus(f, { [e.id!]: v });
          this.events.push({ t: "status", uid: f.uid, s: "buff" });
        } else if (this.rng.next() < e.v!) {
          const l = this.loot[f.side];
          if (e.id === "gold") l.gold += e.n!; else if (e.id === "xp") l.xp += e.n!; else l.roll += e.n!;
          this.events.push({ t: "loot", uid: f.uid, kind: e.id as "gold" | "xp" | "roll", n: e.n! });
        }
        return null;
      }
      case "transform": {
        const d = e.dur!;
        f.frenzy = t + d;
        if (e.o.as) this.buff(f, "as", Number(e.o.as), d);
        if (e.o.amp) this.buff(f, "amp", Number(e.o.amp), d);
        if (e.o.vamp) this.buff(f, "vamp", Number(e.o.vamp), d);
        this.events.push({ t: "status", uid: f.uid, s: "frenzy" });
        return hexOf(f);
      }
    }
    return null;
  }

  /** A timed boost (ap and ad last the fight). */
  private buff(a: Fighter, stat: string, v: number, dur: number, by?: Fighter) {
    const t = this.time;
    switch (stat) {
      case "as": a.haste = t + dur; a.hasteV = v; break;
      case "amp": a.ampT = t + dur; a.ampV = Math.max(a.ampT > t ? a.ampV : 0, v); break;
      case "armor": a.guard = t + dur; a.guardV = Math.max(a.guard > t ? a.guardV : 0, v); if (by) by.guarded += v; break;
      case "dodge": a.dodgeT = t + dur; a.dodgeV = v; break;
      case "crit": a.critUp = t + dur; a.critV = v; break;
      case "vamp": a.vampT = t + dur; a.vampV = v; break;
      case "ap": a.ap += v; break;
      case "ad": a.ad += a.baseAd * v; break;
    }
    if (v > 0) this.events.push({ t: "status", uid: a.uid, s: "buff" });
  }

  /** Moves a fighter to a hex (gliding when `glide`). */
  private place(u: Fighter, h: Hex, glide: boolean) {
    u.leap = false;
    if (glide) { u.moveFrom = { x: u.x, y: u.y }; u.moveT = 0; }
    else { u.moveFrom = null; u.fx = h.x; u.fy = h.y; }
    u.x = h.x; u.y = h.y;
  }


  /** Enemies along the line from `f` through `tg` and beyond. */
  private lineFrom(f: Fighter, tg: Fighter): Fighter[] {
    const px = (h: Hex) => ({ x: h.x + (h.y & 1 ? 0.5 : 0), y: h.y * 0.866 });
    const a = px(f), b = px(tg);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return this.enemies(f).filter((e) => {
      const p = px(e);
      const along = (p.x - a.x) * ux + (p.y - a.y) * uy;
      const off = Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
      return along > 0 && along <= 7 && off <= 0.6;
    }).sort((p, q) => dist(p, f) - dist(q, f));
  }
}

/** Every hex (x, y) on the board, for drawing. */
export const BOARD_HEXES: Hex[] = Array.from({ length: COLS * ROWS }, (_, i) => ({ x: i % COLS, y: Math.floor(i / COLS) }));
export { key, inBoard, neighbors };
