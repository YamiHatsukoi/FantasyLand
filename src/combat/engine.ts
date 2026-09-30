import { LEVEL_STEP } from "../core/levels";
import { chooseAction } from "./ai";
import { MECH } from "./bossMech";
import { critChance, dodgeChance } from "./rates";
import { Rng } from "../core/rng";
import type { ItemUse } from "../data/items";
import { PASSIVES } from "../data/passives";
import { getSkill } from "../data/skills";
import { ELEMENT_STATUS, STATUSES } from "./statuses";
import type {
  BattleEvent, Eff, Element, PassiveHook, Skill, StatKey, StatusId, StatusInstance, Unit,
} from "./types";

const ADDITIVE: StatKey[] = ["crit", "eva"];
const DEFAULT_POWER: Partial<Record<StatusId, number>> = { burn: 0.3, bleed: 0.25, regen: 0.3, shield: 1 };
const RANDOM_ELEMENTS: Element[] = ["fire", "ice", "lightning", "water", "earth", "wind", "light", "dark", "poison"];
const MAX_AV = 10000;

export interface HitResult {
  hit: boolean;
  dmg: number;
}

export interface Action {
  skill: string;
  target?: string;
  /** Allies: courage points spent (0..3). */
  boost?: number;
  /** Damage/heal multiplier (a charged boss attack). */
  mult?: number;
}

export const MAX_BP = 5;
export const MAX_BOOST = 3;
/** Extra damage taken while broken. */
export const BREAK_BONUS = 1.5;
/** A charged boss attack hits this much harder. */
export const CHARGE_MULT = 2.2;

export class Battle {
  units: Unit[];
  rng: Rng;
  events: BattleEvent[] = [];
  turn = 0;
  /** Shields broken this battle (rewards scale with it). */
  breaks = 0;
  /** Builds a unit for reinforcements (set by the battle screen). */
  spawner?: (enemyId: string, level: number, index: number) => Unit;
  private spawned = 0;
  /** A phoenix pet brings the first fallen ally back, once. */
  petRevive = false;
  private extraTurn = false;

  constructor(allies: Unit[], enemies: Unit[], seed = Date.now()) {
    this.units = [...allies, ...enemies];
    this.rng = new Rng(seed);
    for (const u of this.units) {
      u.cooldowns = u.cooldowns || {};
      u.statuses = u.statuses || [];
      u.av = this.avFor(u) * this.rng.range(0.55, 1);
    }
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      for (const h of this.hooks(u, "battleStart")) for (const e of h.fx) this.applyEff(u, u, e, "magical");
    }
    for (const u of this.units) if (u.side === "ally" && u.bp === undefined) u.bp = 1;
    for (const u of this.enemies) this.plan(u);
  }

  // ------------------------------------------------------------ queries
  get allies() { return this.units.filter((u) => u.side === "ally"); }
  get enemies() { return this.units.filter((u) => u.side === "enemy"); }
  alive(side?: "ally" | "enemy") { return this.units.filter((u) => u.hp > 0 && (!side || u.side === side)); }
  unit(uid: string) { return this.units.find((u) => u.uid === uid); }
  opponents(u: Unit) { return this.alive(u.side === "ally" ? "enemy" : "ally"); }
  friends(u: Unit) { return this.alive(u.side); }

  outcome(): "win" | "lose" | null {
    if (this.alive("enemy").length === 0) return "win";
    if (this.alive("ally").length === 0) return "lose";
    return null;
  }

  has(u: Unit, s: StatusId) { return u.statuses.find((x) => x.id === s); }

  hooks<K extends PassiveHook["on"]>(u: Unit, on: K): Extract<PassiveHook, { on: K }>[] {
    const out: Extract<PassiveHook, { on: K }>[] = [];
    for (const id of u.passives) {
      const p = PASSIVES[id];
      if (!p) continue;
      for (const h of p.hooks) if (h.on === on) out.push(h as Extract<PassiveHook, { on: K }>);
    }
    return out;
  }

  stat(u: Unit, k: StatKey): number {
    let pct = 0, add = 0;
    const apply = (mods: Partial<Record<StatKey, number>>) => {
      const v = mods[k];
      if (v === undefined) return;
      if (ADDITIVE.includes(k)) add += v; else pct += v;
    };
    for (const h of this.hooks(u, "stat")) apply(h.mods);
    if (k !== "hp" && k !== "mp") {
      const ratio = u.hp / this.stat(u, "hp");
      for (const h of this.hooks(u, "lowHp")) if (ratio < h.below) apply(h.mods);
      for (const s of u.statuses) {
        const def = STATUSES[s.id];
        if (def.mods) apply(def.mods(s.stacks));
      }
    }
    if (ADDITIVE.includes(k)) return Math.max(0, u.base[k] + add);
    return Math.max(1, u.base[k] * (1 + pct));
  }

  maxHp(u: Unit) { return Math.round(this.stat(u, "hp")); }
  maxMp(u: Unit) { return Math.round(this.stat(u, "mp")); }
  avFor(u: Unit) { return MAX_AV / this.stat(u, "spd"); }

  isDisabled(u: Unit) { return u.statuses.some((s) => STATUSES[s.id].disables); }

  /** Predicted order of the next n turns (for the UI timeline). */
  timeline(n = 8): Unit[] {
    const sim = this.alive().map((u) => ({ u, av: u.av, step: this.avFor(u) }));
    const out: Unit[] = [];
    for (let i = 0; i < n && sim.length; i++) {
      sim.sort((a, b) => a.av - b.av);
      const first = sim[0];
      out.push(first.u);
      const dt = first.av;
      for (const s of sim) s.av -= dt;
      first.av = first.step;
    }
    return out;
  }

  canUse(u: Unit, skill: Skill): { ok: boolean; reason?: string } {
    if ((u.cooldowns[skill.id] || 0) > 0) return { ok: false, reason: `Hồi chiêu ${u.cooldowns[skill.id]}` };
    if (u.mp < skill.mp) return { ok: false, reason: "Thiếu MP" };
    if (skill.kind === "magical" && this.has(u, "silence")) return { ok: false, reason: "Bị câm lặng" };
    if (skill.target === "deadAlly" && !this.friendsDead(u).length) return { ok: false, reason: "Không có ai gục" };
    return { ok: true };
  }

  friendsDead(u: Unit) { return this.units.filter((x) => x.side === u.side && x.hp <= 0); }

  /** Units a player may pick for a single-target skill. */
  validTargets(u: Unit, skill: Skill): Unit[] {
    switch (skill.target) {
      case "enemy": {
        const opp = this.opponents(u);
        const taunters = opp.filter((o) => this.has(o, "taunt") && !this.has(o, "stealth"));
        if (taunters.length) return taunters;
        const visible = opp.filter((o) => !this.has(o, "stealth"));
        return visible.length ? visible : opp;
      }
      case "ally": return this.friends(u);
      case "deadAlly": return this.friendsDead(u);
      default: return [];
    }
  }

  needsTarget(skill: Skill) { return skill.target === "enemy" || skill.target === "ally" || skill.target === "deadAlly"; }

  // ------------------------------------------------------------ turn flow
  private emit(e: BattleEvent) { this.events.push(e); }

  /** Advance the timeline to the next unit that can act. Returns null when the battle is over. */
  nextTurn(): Unit | null {
    for (let guard = 0; guard < 200; guard++) {
      if (this.outcome()) return null;
      const alive = this.alive();
      let actor = alive[0];
      for (const u of alive) if (u.av < actor.av) actor = u;
      const dt = Math.max(0, actor.av);
      for (const u of alive) u.av -= dt;
      this.turn++;
      this.emit({ t: "turn", uid: actor.uid });
      const canAct = this.startTurn(actor);
      if (this.outcome()) return null;
      if (canAct) return actor;
      actor.av = this.avFor(actor);
    }
    return null;
  }

  private startTurn(u: Unit): boolean {
    const max = this.maxHp(u);
    // damage over time
    for (const s of [...u.statuses]) {
      if (u.hp <= 0) break;
      let dmg = 0;
      if (s.id === "burn") dmg = s.power * s.stacks;
      else if (s.id === "bleed") dmg = s.power * s.stacks;
      else if (s.id === "poison") dmg = max * 0.03 * s.stacks * (u.boss ? 0.4 : 1);
      if (dmg > 0) {
        const src = s.source ? this.unit(s.source) : undefined;
        if (src) for (const h of this.hooks(src, "statusDmg")) if (h.s === s.id) dmg *= h.mult;
        if (s.id === "burn") dmg *= u.resist.fire ?? 1;
        if (s.id === "poison") dmg *= u.resist.poison ?? 1;
        if (dmg > 0) this.damage(u, Math.max(1, Math.round(dmg)), s.id === "burn" ? "fire" : s.id === "poison" ? "poison" : "physical", { dot: true });
      }
    }
    if (u.hp <= 0) return false;
    // regeneration
    const regen = this.has(u, "regen");
    if (regen) this.heal(u, regen.power);
    let mpGain = 0.04;
    if (this.has(u, "manaRegen")) mpGain += 0.1;
    for (const h of this.hooks(u, "turnStart")) {
      if (h.healPct) this.heal(u, max * h.healPct);
      if (h.mpPct) mpGain += h.mpPct;
    }
    this.gainMp(u, this.maxMp(u) * mpGain, false);
    // cooldowns
    for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k] > 0) u.cooldowns[k]--;
    // boss signature: timed tricks
    if (u.mech && u.hp > 0) MECH[u.mech]?.turn?.(this, u, (u.mechT = (u.mechT ?? 0) + 1));
    // courage: +1 each turn, except right after spending some
    if (u.bp !== undefined) {
      if (!u.boosted) u.bp = Math.min(MAX_BP, u.bp + 1);
      u.boosted = false;
    }

    const disabled = this.isDisabled(u);
    const disabledBy = u.statuses.find((s) => STATUSES[s.id].disables);
    // tick durations
    for (const s of [...u.statuses]) {
      s.turns--;
      if (s.turns <= 0) {
        this.removeStatus(u, s.id);
        if (s.id === "doom") {
          this.emit({ t: "reaction", uid: u.uid, name: "Án Tử Giáng Xuống" });
          this.damage(u, Math.round(max * (u.boss ? 0.15 : 0.4)), "dark", {});
        }
      }
    }
    if (u.hp <= 0) return false;
    // a broken unit spends this turn reeling, then its shield comes back
    if (u.broken) {
      u.broken = false;
      u.shield = u.shieldMax;
      this.emit({ t: "skip", uid: u.uid, reason: "Choáng (vỡ khiên)" });
      this.emit({ t: "recover", uid: u.uid });
      return false;
    }
    if (disabled) {
      this.emit({ t: "skip", uid: u.uid, reason: disabledBy ? STATUSES[disabledBy.id].name : "" });
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------ actions
  act(actor: Unit, action: Action): void {
    const skill = getSkill(action.skill);
    const check = this.canUse(actor, skill);
    const sk = check.ok ? skill : getSkill("attack");
    actor.mp -= sk.mp;
    if (sk.hpCost) this.damage(actor, Math.round(this.maxHp(actor) * sk.hpCost), "physical", { dot: true, noKill: true });
    if (sk.cd > 0) actor.cooldowns[sk.id] = sk.cd + 1;

    const targets = this.resolveTargets(actor, sk, action.target);
    this.emit({ t: "use", uid: actor.uid, skill: sk.id, targets: targets.map((t) => t.uid) });

    // courage boost: a basic attack strikes once more per point, anything else gets stronger
    const boost = actor.bp !== undefined ? Math.max(0, Math.min(MAX_BOOST, actor.bp, Math.floor(action.boost ?? 0))) : 0;
    if (boost > 0) {
      actor.bp! -= boost;
      actor.boosted = true;
      this.emit({ t: "boost", uid: actor.uid, n: boost });
    }
    const extraHits = sk.id === "attack" ? boost : 0;
    const boostMult = sk.id === "attack" ? 1 : 1 + 0.5 * boost;

    const damaging = (sk.power ?? 0) > 0;
    let mult = boostMult * (action.mult ?? 1);
    if (damaging && this.has(actor, "empower")) {
      mult = 1.6;
      this.removeStatus(actor, "empower");
    }
    if (damaging && this.has(actor, "stealth")) this.removeStatus(actor, "stealth");

    const hitTargets = new Set<Unit>();
    if (damaging) {
      if (sk.target === "random") {
        for (let i = 0; i < (sk.hits ?? 1) + extraHits; i++) {
          const pool = this.opponents(actor);
          if (!pool.length) break;
          const confused = this.has(actor, "confuse");
          const t = confused ? this.rng.pick(this.alive().filter((x) => x !== actor)) ?? pool[0] : this.rng.pick(pool);
          if (this.hit(actor, t, sk, mult).hit) hitTargets.add(t);
        }
      } else {
        for (const t of targets) {
          for (let i = 0; i < (sk.hits ?? 1) + extraHits; i++) {
            if (t.hp <= 0 || actor.hp <= 0) break;
            if (this.hit(actor, t, sk, mult).hit) hitTargets.add(t);
          }
        }
        // dual wielding: the off-hand weapon follows up a basic attack
        const t0 = targets[0];
        if (sk.id === "attack" && actor.dual && t0 && t0.hp > 0 && actor.hp > 0) {
          if (this.hit(actor, t0, sk, mult * 0.5).hit) hitTargets.add(t0);
        }
      }
    } else {
      for (const t of targets) hitTargets.add(t);
    }

    // healing
    if (sk.heal) {
      for (const t of targets) {
        if (t.hp <= 0) continue;
        let amt = sk.heal * this.stat(actor, "mag") * boostMult;
        for (const h of this.hooks(actor, "healPower")) amt *= h.mult;
        this.heal(t, amt);
        if (sk.el === "water" && this.has(t, "burn")) {
          this.removeStatus(t, "burn");
          this.emit({ t: "reaction", uid: t.uid, name: "Dập Lửa" });
        }
      }
    }

    // specials that are not part of damage calc
    for (const s of sk.sp ?? []) {
      switch (s.k) {
        case "cleanse":
          for (const t of targets) this.removeDebuffs(t, s.n);
          break;
        case "dispel":
          for (const t of hitTargets) this.removeBuffs(t, s.n);
          break;
        case "revive":
          for (const t of targets) {
            if (t.hp > 0) continue;
            t.hp = Math.max(1, Math.round(this.maxHp(t) * s.pct));
            t.statuses = [];
            t.av = this.avFor(t);
            this.emit({ t: "revive", uid: t.uid });
          }
          break;
        case "drainMp":
          for (const t of hitTargets) {
            const amt = Math.min(t.mp, Math.round(this.maxMp(t) * s.pct));
            t.mp -= amt;
            this.gainMp(actor, amt, true);
          }
          break;
        case "mpRestore":
          for (const t of targets) this.gainMp(t, this.maxMp(t) * s.pct, true);
          break;
        case "extraTurn":
          this.extraTurn = true;
          break;
        case "delay":
          // amount is a fraction of one full turn, in basis points (2500 = 25%).
          for (const t of hitTargets) if (t.hp > 0) t.av += this.avFor(t) * (s.amount / 10000) * (t.boss ? 0.5 : 1);
          break;
        case "advance":
          for (const t of targets) if (t !== actor) t.av = Math.max(0, t.av - this.avFor(t) * (s.amount / 10000));
          break;
        case "spread": {
          for (const t of hitTargets) {
            const debuffs = t.statuses.filter((x) => STATUSES[x.id].kind === "debuff");
            for (const other of this.alive(t.side)) {
              if (other === t) continue;
              for (const d of debuffs) this.addStatus(other, d.id, d.turns, d.stacks, d.power, actor);
            }
          }
          if (hitTargets.size) this.emit({ t: "reaction", uid: [...hitTargets][0].uid, name: "Lây Lan" });
          break;
        }
        case "transfer": {
          const debuffs = actor.statuses.filter((x) => STATUSES[x.id].kind === "debuff");
          for (const t of hitTargets) for (const d of debuffs) this.addStatus(t, d.id, d.turns, d.stacks, d.power, actor);
          for (const d of debuffs) this.removeStatus(actor, d.id);
          break;
        }
        case "resetCd":
          for (const k of Object.keys(actor.cooldowns)) if (k !== sk.id) actor.cooldowns[k] = 0;
          break;
        case "selfDamage":
          this.damage(actor, Math.round(this.maxHp(actor) * s.pct), "physical", { dot: true, noKill: true });
          break;
        default:
          break;
      }
    }

    // status effects
    const kind = sk.kind === "support" ? "magical" : sk.kind;
    for (const e of sk.fx ?? []) {
      const to = e.to ?? "target";
      if (to === "target") for (const t of hitTargets) this.applyEff(actor, t, e, kind, sk);
      else if (to === "self") this.applyEff(actor, actor, e, kind, sk);
      else if (to === "allies") for (const t of this.friends(actor)) this.applyEff(actor, t, e, kind, sk);
      else for (const t of this.opponents(actor)) this.applyEff(actor, t, e, kind, sk);
    }
    for (const e of sk.self ?? []) this.applyEff(actor, actor, e, kind, sk);

    if (sk.id === "attack") this.gainMp(actor, this.maxMp(actor) * 0.08, false);
    if (sk.id === "defend") this.gainMp(actor, this.maxMp(actor) * 0.12, false);

    actor.av = this.extraTurn ? 0 : this.avFor(actor);
    if (this.extraTurn) this.emit({ t: "reaction", uid: actor.uid, name: "Thêm Lượt" });
    this.extraTurn = false;
  }

  private resolveTargets(actor: Unit, sk: Skill, targetUid?: string): Unit[] {
    const confused = this.has(actor, "confuse");
    switch (sk.target) {
      case "self": return [actor];
      case "allies": return this.friends(actor);
      case "enemies": return this.opponents(actor);
      case "random": return [];
      case "deadAlly": {
        const t = targetUid ? this.unit(targetUid) : undefined;
        const dead = this.friendsDead(actor);
        return t && dead.includes(t) ? [t] : dead.slice(0, 1);
      }
      case "ally": {
        const t = targetUid ? this.unit(targetUid) : undefined;
        return t && t.hp > 0 && t.side === actor.side ? [t] : [actor];
      }
      case "enemy": {
        if (confused) {
          const pool = this.alive().filter((x) => x !== actor);
          return pool.length ? [this.rng.pick(pool)] : [];
        }
        const valid = this.validTargets(actor, sk);
        let t = targetUid ? valid.find((v) => v.uid === targetUid) : undefined;
        if (!t) t = valid[0];
        if (!t) return [];
        // Reflect single-target spells.
        if (sk.kind === "magical" && this.has(t, "reflect")) {
          this.removeStatus(t, "reflect");
          this.emit({ t: "reaction", uid: t.uid, name: "Phản Phép" });
          return [actor];
        }
        return [t];
      }
    }
  }

  // ------------------------------------------------------------ damage
  hit(actor: Unit, target: Unit, sk: Skill, mult = 1, opts: { counter?: boolean } = {}): HitResult {
    if (target.hp <= 0) return { hit: false, dmg: 0 };
    let el: Element = sk.el;
    let imbued = false;
    if (sk.kind === "physical" && el === "physical") {
      const imb = actor.statuses.find((s) => STATUSES[s.id].imbue);
      if (imb) { el = STATUSES[imb.id].imbue!; imbued = true; }
    }
    if (sk.sp?.some((s) => s.k === "randomElement")) el = this.rng.pick(RANDOM_ELEMENTS);

    // accuracy
    if (sk.kind === "physical") {
      const helpless = this.isDisabled(target) || this.has(target, "rooted");
      let miss = helpless ? 0 : dodgeChance(this.stat(target, "eva"));
      if (this.has(actor, "blind")) miss += 0.5;
      if (this.rng.next() < Math.min(0.8, miss)) {
        this.emit({ t: "miss", uid: target.uid });
        return { hit: false, dmg: 0 };
      }
    }

    const useDef = sk.sp?.some((s) => s.k === "useDef");
    const useSpd = sk.sp?.some((s) => s.k === "useSpd");
    const atkStat: StatKey = useDef ? "def" : useSpd ? "spd" : sk.kind === "physical" ? "atk" : "mag";
    const atkVal = this.stat(actor, atkStat) * (useSpd ? 0.25 : 1);
    let dmg = (sk.power ?? 1) * atkVal * mult;

    for (const s of sk.sp ?? []) {
      switch (s.k) {
        case "execute":
          if (target.hp / this.maxHp(target) < s.below) dmg *= s.mult;
          break;
        case "consume": {
          const st = this.has(target, s.s);
          if (st) {
            dmg += s.perStack * atkVal * st.stacks;
            this.removeStatus(target, s.s);
            this.emit({ t: "reaction", uid: target.uid, name: "Kích Nổ" });
          }
          break;
        }
        case "bonusIf":
          if (this.has(target, s.s)) dmg *= s.mult;
          break;
        case "bonusVsTag":
          if (target.tags.includes(s.tag)) dmg *= s.mult;
          break;
        case "missingHp":
          dmg *= 1 + s.mult * (1 - actor.hp / this.maxHp(actor));
          break;
        case "scaleDebuffs":
          dmg *= 1 + s.per * target.statuses.filter((x) => STATUSES[x.id].kind === "debuff").length;
          break;
        default:
          break;
      }
    }

    const reaction = this.react(actor, target, el, sk.kind, sk);
    dmg = dmg * reaction.mult + reaction.extra;

    const defKey: StatKey = sk.kind === "physical" ? "def" : "res";
    dmg *= 50 / (50 + this.stat(target, defKey));
    dmg *= target.resist[el] ?? 1;
    for (const h of this.hooks(actor, "elemDmg")) if (h.el === el) dmg *= h.mult;

    let crit = false;
    const critP = this.has(target, "mark") ? 1 : critChance(this.stat(actor, "crit"));
    if (this.rng.next() < critP) {
      crit = true;
      let cd = 1.5;
      for (const h of this.hooks(actor, "critDmg")) cd += h.add;
      dmg *= cd;
    }

    if (this.has(target, "vulnerable")) dmg *= 1.25;
    if (target.broken) dmg *= BREAK_BONUS;
    const shock = this.has(target, "shock");
    if (shock) dmg *= 1 + 0.08 * shock.stacks;
    if (el === "dark" && this.has(target, "curse")) dmg *= 1.3;
    if (this.has(target, "guard")) dmg *= 0.5;
    // a rallying boss is shielded by its minions
    if (target.mech === "rally" && this.alive(target.side).some((o) => o.minionOf === target.uid)) dmg *= 0.5;
    if (sk.kind === "magical" && this.has(target, "barrier")) dmg *= 0.6;
    if (this.has(target, "petrify")) dmg *= 0.5;
    if (this.has(target, "sleep")) {
      dmg *= 1.5;
      this.removeStatus(target, "sleep");
      this.emit({ t: "reaction", uid: target.uid, name: "Bừng Tỉnh" });
    }
    dmg *= this.rng.range(0.92, 1.08);

    let final = 0;
    if (dmg <= 0 && (target.resist[el] ?? 1) < 0) {
      this.heal(target, -dmg);
    } else {
      final = Math.max(1, Math.round(dmg));
      this.damage(target, final, el, { crit });
    }
    this.chip(target, el);

    if (reaction.splash > 0) {
      for (const o of this.alive(target.side)) {
        if (o !== target) this.damage(o, Math.max(1, Math.round(final * reaction.splash)), el, {});
      }
    }

    // lifesteal
    let steal = this.has(actor, "lifesteal") ? 0.25 : 0;
    for (const s of sk.sp ?? []) if (s.k === "lifesteal") steal += s.pct;
    if (steal > 0 && final > 0) this.heal(actor, final * steal);

    // thorns
    if (sk.kind === "physical" && this.has(target, "thorns") && final > 0 && actor.hp > 0) {
      this.damage(actor, Math.max(1, Math.round(final * 0.3)), "physical", { dot: true });
    }

    // crit follow-ups
    if (crit && target.hp > 0) {
      const bleed = this.has(target, "bleed");
      if (bleed) {
        this.removeStatus(target, "bleed");
        this.emit({ t: "reaction", uid: target.uid, name: "Xuất Huyết" });
        this.damage(target, Math.max(1, Math.round(bleed.power * bleed.stacks * 2)), "physical", {});
      }
      for (const h of this.hooks(actor, "crit")) for (const e of h.fx) this.applyEff(actor, target, e, sk.kind === "physical" ? "physical" : "magical");
    }

    // on-hit passives and imbues
    if (target.hp > 0) {
      for (const h of this.hooks(actor, "hitApply")) {
        if (h.kind && h.kind !== sk.kind) continue;
        if (h.el && h.el !== el) continue;
        for (const e of h.fx) this.applyEff(actor, target, e, sk.kind === "physical" ? "physical" : "magical");
      }
      if (imbued) {
        const es = ELEMENT_STATUS[el];
        if (es) this.applyEff(actor, target, { s: es.s, ch: es.ch, t: es.t }, "physical");
      }
    }

    if (target.hp <= 0) {
      for (const h of this.hooks(actor, "kill")) {
        if (h.healPct) this.heal(actor, this.maxHp(actor) * h.healPct);
        if (h.mpPct) this.gainMp(actor, this.maxMp(actor) * h.mpPct, true);
        for (const e of h.fx ?? []) this.applyEff(actor, actor, e, "magical");
      }
    } else {
      for (const h of this.hooks(target, "hurt")) {
        if (this.rng.next() < (h.ch ?? 1)) for (const e of h.fx) this.applyEff(target, target, e, "magical");
      }
      // counter attack
      if (!opts.counter && sk.kind === "physical" && sk.target === "enemy" && this.has(target, "counter") && actor.hp > 0 && !this.isDisabled(target)) {
        this.emit({ t: "reaction", uid: target.uid, name: "Phản Đòn" });
        this.hit(target, actor, getSkill("attack"), 0.6, { counter: true });
      }
    }
    return { hit: true, dmg: final };
  }

  /** Elemental reactions between the incoming element and the target's statuses. */
  private react(actor: Unit, target: Unit, el: Element, kind: Skill["kind"], _sk: Skill) {
    let mult = 1, extra = 0, splash = 0;
    const names: string[] = [];
    const has = (s: StatusId) => this.has(target, s);
    const rm = (s: StatusId) => this.removeStatus(target, s);
    const spreadStatus = (s: StatusId) => {
      const st = has(s);
      if (!st) return;
      for (const o of this.alive(target.side)) {
        if (o !== target) this.addStatus(o, s, st.turns, Math.ceil(st.stacks / 2), st.power, actor);
      }
    };

    if (el === "fire") {
      if (has("oil")) { rm("oil"); mult *= 2; splash = 0.4; names.push("Nổ Dầu"); }
      else if (has("wet")) { rm("wet"); mult *= 0.5; names.push("Bốc Hơi"); this.addStatus(target, "blind", 2, 1, 0, actor); }
      if (has("frozen") || has("chill")) { rm("frozen"); rm("chill"); mult *= 1.5; names.push("Tan Chảy"); this.addStatus(target, "wet", 2, 1, 0, actor); }
      const p = has("poison");
      if (p) { rm("poison"); extra += this.maxHp(target) * 0.04 * p.stacks * (target.boss ? 0.4 : 1); names.push("Khí Độc Bùng Cháy"); }
    } else if (el === "ice") {
      if (has("wet")) { rm("wet"); names.push("Đóng Băng Tức Thì"); this.tryDisable(actor, target, "frozen", 1); }
      if (has("burn")) { rm("burn"); mult *= 1.3; names.push("Sốc Nhiệt"); this.addStatus(target, "armorBreak", 2, 1, 0, actor); }
    } else if (el === "lightning") {
      if (has("wet")) {
        rm("wet"); mult *= 1.5; names.push("Điện Giật");
        this.tryDisable(actor, target, "stun", 1);
        for (const o of this.alive(target.side)) {
          if (o !== target && this.has(o, "wet")) this.addStatus(o, "shock", 3, 2, 0, actor);
        }
      }
      if (has("frozen")) { rm("frozen"); mult *= 1.5; names.push("Băng Vỡ Điện"); }
    } else if (el === "earth") {
      if (has("shock")) { rm("shock"); mult *= 1.5; names.push("Tiếp Địa"); }
      if (has("wet")) { rm("wet"); names.push("Bùn Lầy"); this.addStatus(target, "rooted", 2, 1, 0, actor); this.addStatus(target, "slow", 2, 1, 0, actor); }
    } else if (el === "wind") {
      if (has("burn")) { spreadStatus("burn"); names.push("Bão Lửa"); }
      if (has("poison")) { spreadStatus("poison"); names.push("Khí Độc Lan Tỏa"); }
    } else if (el === "water") {
      if (has("burn")) { rm("burn"); names.push("Dập Lửa"); }
    }
    if (kind === "physical" && el !== "fire" && el !== "lightning" && has("frozen")) {
      rm("frozen"); mult *= 2; names.push("Vỡ Băng");
    }

    if (names.length) {
      for (const n of names) this.emit({ t: "reaction", uid: target.uid, name: n });
      let rmult = 1;
      for (const h of this.hooks(actor, "reactionDmg")) rmult *= h.mult;
      if (mult > 1) mult *= rmult;
      extra *= rmult;
    }
    return { mult, extra, splash };
  }

  /** A pet's attack: flat damage of an element, which also chips weakness shields. */
  petHit(t: Unit, el: Element, amount: number) {
    if (t.hp <= 0) return;
    let dmg = amount * (t.resist[el] ?? 1);
    if (t.broken) dmg *= BREAK_BONUS;
    if (dmg > 0) this.damage(t, Math.max(1, Math.round(dmg)), el, {});
    this.chip(t, el);
  }

  // ------------------------------------------------------------ shields, break, intents
  isWeak(u: Unit, el: Element) { return (u.resist[el] ?? 1) > 1; }

  /** A hit of element `el` landed: reveal it, and chip the shield when it is a weakness. */
  private chip(t: Unit, el: Element) {
    if (t.enemyId) this.emit({ t: "scan", uid: t.uid, el });
    if (!t.shieldMax || t.hp <= 0 || t.broken || !this.isWeak(t, el)) return;
    t.shield = Math.max(0, (t.shield ?? t.shieldMax) - 1);
    this.emit({ t: "shield", uid: t.uid, left: t.shield });
    if (t.shield === 0) this.breakUnit(t);
  }

  breakUnit(u: Unit) {
    u.broken = true;
    if (u.mech === "countdown") u.mechCount = (u.mechCount ?? 5) + 2;
    this.breaks++;
    this.emit({ t: "break", uid: u.uid });
    if (u.charged) {
      u.charged = false;
      this.emit({ t: "reaction", uid: u.uid, name: "Phá Thế Tụ Lực" });
    }
    this.plan(u);
  }

  /** Short callout over a unit (boss tricks). */
  announce(u: Unit, name: string) {
    this.emit({ t: "reaction", uid: u.uid, name });
  }

  /** Starts a boss's signature mechanic (after the screen set `spawner`). */
  initBoss(u: Unit, mechId: string, minion?: string) {
    u.mech = mechId;
    u.minion = minion;
    u.mechT = 0;
    MECH[mechId]?.start?.(this, u);
  }

  private addUnit(u: Unit) {
    this.units.push(u);
    u.cooldowns ||= {};
    u.statuses ||= [];
    u.av = this.avFor(u) * 0.6;
    this.plan(u);
    this.emit({ t: "spawn", uid: u.uid });
  }

  /** A boss calls in one of its floor's monsters (never more than 4 enemies standing). */
  spawnMinion(boss: Unit) {
    if (!this.spawner || !boss.minion || this.alive(boss.side).length >= 4) return;
    const m = this.spawner(boss.minion, Math.max(1, boss.level - 2 * LEVEL_STEP), 50 + this.spawned++);
    m.minionOf = boss.uid;
    this.announce(boss, "Gọi Tay Sai!");
    this.addUnit(m);
  }

  /** The boss splits off a weaker copy of itself. */
  spawnClone(boss: Unit) {
    if (!this.spawner || !boss.enemyId || this.alive(boss.side).length >= 4) return;
    const c = this.spawner(boss.enemyId, boss.level, 60 + this.spawned++);
    c.boss = false;
    c.name = `Bản Sao ${boss.name}`;
    c.base = { ...c.base, hp: Math.round(c.base.hp * 0.3) };
    c.hp = c.base.hp;
    c.passives = c.passives.filter((p) => p !== "e_boss");
    c.minionOf = boss.uid;
    this.announce(boss, "Phân Thân!");
    this.addUnit(c);
  }

  /** Decides (and shows) what an enemy will do on its next turn. */
  plan(u: Unit) {
    if (u.side !== "enemy" || u.hp <= 0) return;
    if (u.boss && !u.charged) {
      u.chargeCd = (u.chargeCd ?? 2) - 1;
      if (u.chargeCd <= 0 && this.rng.next() < 0.6) {
        u.chargeCd = 4;
        u.intent = { skill: "attack", charge: true };
        return;
      }
    }
    if (u.charged) {
      // unleash the heaviest hit it has
      const usable = [...u.skills, "attack"].map(getSkill).filter((s) => (s.power ?? 0) > 0 && this.canUse(u, s).ok);
      const best = usable.sort((a, b) => (b.power ?? 0) * (b.hits ?? 1) * (b.target === "enemies" ? 1.4 : 1) - (a.power ?? 0) * (a.hits ?? 1) * (a.target === "enemies" ? 1.4 : 1))[0] ?? getSkill("attack");
      const pool = this.validTargets(u, best);
      u.intent = { skill: best.id, target: pool.length ? this.rng.pick(pool).uid : undefined };
      return;
    }
    const a = chooseAction(this, u);
    u.intent = { skill: a.skill, target: a.target };
  }

  /** An enemy carries out its planned action (re-aiming if the plan went stale), then plans the next. */
  enemyAct(u: Unit) {
    const it = u.intent ?? chooseAction(this, u);
    u.intent = undefined;
    if ("charge" in it && it.charge) {
      u.charged = true;
      this.emit({ t: "charge", uid: u.uid });
      u.av = this.avFor(u);
      this.plan(u);
      return;
    }
    let a: Action = { skill: it.skill, target: it.target };
    const sk = getSkill(a.skill);
    if (!this.canUse(u, sk).ok || this.has(u, "confuse")) a = chooseAction(this, u);
    else if (a.target) {
      const t = this.unit(a.target);
      const ok = t && (sk.target === "deadAlly" ? t.hp <= 0 : t.hp > 0) && (!this.needsTarget(sk) || sk.target !== "enemy" || this.validTargets(u, sk).includes(t));
      if (!ok) a = { skill: a.skill };
    }
    const mult = u.charged ? CHARGE_MULT : 1;
    u.charged = false;
    this.act(u, { ...a, mult });
    this.plan(u);
  }

  private tryDisable(actor: Unit, target: Unit, s: StatusId, turns: number) {
    const resist = target.boss ? 0.6 : 0;
    if (this.rng.next() >= resist) this.addStatus(target, s, turns, 1, 0, actor);
  }

  damage(u: Unit, amount: number, el: Element, o: { crit?: boolean; dot?: boolean; noKill?: boolean }) {
    if (u.hp <= 0) return;
    let absorbed = 0;
    const sh = this.has(u, "shield");
    if (sh && !o.noKill) {
      absorbed = Math.min(sh.power, amount);
      sh.power -= absorbed;
      amount -= absorbed;
      if (sh.power <= 0) this.removeStatus(u, "shield");
    }
    u.hp = Math.max(o.noKill ? 1 : 0, u.hp - amount);
    this.emit({ t: "dmg", uid: u.uid, amount, el, crit: o.crit, dot: o.dot, absorbed: absorbed || undefined });
    if (u.mech) {
      if (u.hp <= 0 && u.mech === "rebirth" && !u.mechUsed) {
        u.mechUsed = true;
        u.hp = Math.round(this.maxHp(u) * 0.4);
        u.statuses = [];
        this.emit({ t: "reaction", uid: u.uid, name: "Tái Sinh Từ Tro Tàn!" });
        this.emit({ t: "revive", uid: u.uid });
        return;
      }
      if (u.hp > 0) {
        const ratio = u.hp / this.maxHp(u);
        const low = MECH[u.mech]?.low ?? {};
        for (const k of ["60", "50", "30"] as const) {
          if (!low[k] || ratio >= Number(k) / 100 || u.mechLow?.includes(k)) continue;
          (u.mechLow ??= []).push(k);
          low[k]!(this, u);
        }
      }
    }
    if (u.hp <= 0 && u.side === "ally" && this.petRevive) {
      this.petRevive = false;
      u.hp = Math.round(this.maxHp(u) * 0.3);
      this.emit({ t: "reaction", uid: u.uid, name: "Phượng Hoàng Hồi Sinh!" });
      this.emit({ t: "revive", uid: u.uid });
      return;
    }
    if (u.hp <= 0) {
      u.statuses = [];
      this.emit({ t: "death", uid: u.uid });
      // volatile elites go off when they fall
      if (u.elite?.includes("volatile")) {
        this.emit({ t: "reaction", uid: u.uid, name: "Phát Nổ!" });
        const boom = Math.round(this.maxHp(u) * 0.12);
        for (const o of this.opponents(u)) this.damage(o, Math.max(1, Math.round(boom * (o.resist.fire ?? 1))), "fire", { noKill: true });
      }
    }
  }

  heal(u: Unit, amount: number) {
    if (u.hp <= 0) return;
    if (this.has(u, "curse")) amount *= 0.5;
    const max = this.maxHp(u);
    const before = u.hp;
    u.hp = Math.min(max, u.hp + Math.round(amount));
    if (u.hp > before) this.emit({ t: "heal", uid: u.uid, amount: u.hp - before });
  }

  gainMp(u: Unit, amount: number, show: boolean) {
    if (u.hp <= 0) return;
    const before = u.mp;
    u.mp = Math.min(this.maxMp(u), u.mp + Math.round(amount));
    if (show && u.mp > before) this.emit({ t: "heal", uid: u.uid, amount: u.mp - before, mp: true });
  }

  // ------------------------------------------------------------ statuses
  private applyEff(source: Unit, target: Unit, e: Eff, kind: "physical" | "magical", sk?: Skill) {
    if (target.hp <= 0) return;
    const def = STATUSES[e.s];
    let ch = e.ch ?? 1;
    if (def.kind === "debuff" && target !== source) {
      if (this.has(target, "immune")) return;
      let resist = 0;
      for (const h of this.hooks(target, "debuffResist")) resist += h.ch;
      if (target.boss && def.disables) resist += 0.5;
      ch *= Math.max(0, 1 - resist);
    }
    if (this.rng.next() >= ch) return;
    const statKey: StatKey = sk?.sp?.some((s) => s.k === "useDef") ? "def" : kind === "physical" ? "atk" : "mag";
    const baseP = e.p ?? DEFAULT_POWER[e.s] ?? 0;
    const power = baseP * Math.max(this.stat(source, statKey), e.s === "shield" ? this.stat(source, "mag") * 0.8 : 0);
    let turns = e.t ?? 2;
    if (target.boss && def.disables) turns = 1;
    this.addStatus(target, e.s, turns, e.st ?? 1, power, source);
  }

  addStatus(u: Unit, s: StatusId, turns: number, stacks: number, power: number, source?: Unit) {
    if (u.hp <= 0) return;
    const def = STATUSES[s];
    if (def.kind === "debuff" && this.has(u, "immune") && source !== u) return;
    const existing = this.has(u, s);
    if (existing) {
      existing.turns = Math.max(existing.turns, turns);
      existing.stacks = Math.min(def.maxStacks, existing.stacks + stacks);
      existing.power = Math.max(existing.power, power);
    } else {
      const inst: StatusInstance = { id: s, turns, stacks: Math.min(def.maxStacks, stacks), power, source: source?.uid };
      u.statuses.push(inst);
    }
    this.emit({ t: "status", uid: u.uid, s });
    // stack thresholds
    const cur = this.has(u, s)!;
    if (s === "chill" && cur.stacks >= 3) {
      this.removeStatus(u, "chill");
      this.emit({ t: "reaction", uid: u.uid, name: "Đóng Băng" });
      if (!u.boss || this.rng.next() < 0.4) this.addStatus(u, "frozen", 1, 1, 0, source);
    } else if (s === "shock" && cur.stacks >= 3) {
      this.removeStatus(u, "shock");
      this.emit({ t: "reaction", uid: u.uid, name: "Tê Liệt" });
      if (!u.boss || this.rng.next() < 0.4) this.addStatus(u, "stun", 1, 1, 0, source);
    }
    // imbues are exclusive
    if (def.imbue) {
      for (const other of [...u.statuses]) if (other.id !== s && STATUSES[other.id].imbue) this.removeStatus(u, other.id);
    }
  }

  removeStatus(u: Unit, s: StatusId) {
    const i = u.statuses.findIndex((x) => x.id === s);
    if (i >= 0) {
      u.statuses.splice(i, 1);
      this.emit({ t: "status", uid: u.uid, s, removed: true });
    }
  }

  removeDebuffs(u: Unit, n?: number) {
    const list = u.statuses.filter((x) => STATUSES[x.id].kind === "debuff").slice(0, n ?? 99);
    for (const d of list) this.removeStatus(u, d.id);
  }

  removeBuffs(u: Unit, n?: number) {
    const list = u.statuses.filter((x) => STATUSES[x.id].kind === "buff").slice(0, n ?? 99);
    for (const d of list) this.removeStatus(u, d.id);
  }

  /** Uses a consumable. `floor` scales bomb damage. */
  useItem(actor: Unit, use: ItemUse, targetUid: string | undefined, floor: number, itemId: string): void {
    this.emit({ t: "use", uid: actor.uid, skill: `item:${itemId}`, targets: targetUid ? [targetUid] : [] });
    let targets: Unit[];
    if (use.target === "allies") targets = this.friends(actor);
    else if (use.target === "enemies") targets = this.opponents(actor);
    else if (use.target === "deadAlly") targets = this.friendsDead(actor).filter((u) => !targetUid || u.uid === targetUid).slice(0, 1);
    else {
      const t = targetUid ? this.unit(targetUid) : actor;
      targets = t && t.hp > 0 ? [t] : [actor];
    }
    for (const t of targets) {
      if (use.revivePct && t.hp <= 0) {
        t.hp = Math.max(1, Math.round(this.maxHp(t) * use.revivePct));
        t.statuses = [];
        t.av = this.avFor(t);
        this.emit({ t: "revive", uid: t.uid });
      }
      if (t.hp <= 0) continue;
      if (use.dmg) {
        let dmg = use.dmg.base * (1 + 0.35 * (floor - 1));
        dmg = this.react(actor, t, use.dmg.el, "magical", getSkill("attack")).mult * dmg;
        dmg *= t.resist[use.dmg.el] ?? 1;
        if (t.broken) dmg *= BREAK_BONUS;
        this.damage(t, Math.max(1, Math.round(dmg)), use.dmg.el, {});
        this.chip(t, use.dmg.el);
      }
      if (use.healPct) this.heal(t, this.maxHp(t) * use.healPct);
      if (use.mpPct) this.gainMp(t, this.maxMp(t) * use.mpPct, true);
      if (use.cleanse) this.removeDebuffs(t);
      for (const e of use.fx ?? []) {
        const def = STATUSES[e.s];
        if (def.kind === "debuff" && this.has(t, "immune")) continue;
        if (this.rng.next() < (e.ch ?? 1) * (t.boss && def.disables ? 0.5 : 1)) {
          const power = (e.p ?? DEFAULT_POWER[e.s] ?? 0) * 20 * (1 + 0.3 * (floor - 1));
          this.addStatus(t, e.s, e.t ?? 2, e.st ?? 1, power, actor);
        }
      }
    }
    actor.av = this.avFor(actor);
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
