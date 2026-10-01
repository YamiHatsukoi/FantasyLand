import { getSkill } from "../data/skills";
import type { Action, Battle } from "./engine";
import { STATUSES } from "./statuses";
import type { Skill, StatusId, Unit } from "./types";

interface Candidate {
  a: Action;
  w: number;
}

const REACTION_BONUS: Record<string, StatusId[]> = {
  fire: ["oil", "frozen", "chill", "poison"],
  ice: ["wet", "burn"],
  lightning: ["wet", "frozen"],
  earth: ["shock", "wet"],
  wind: ["burn", "poison"],
};

/** Chooses an action for AI-controlled units (enemies, or allies on auto-battle). */
export function chooseAction(b: Battle, u: Unit): Action {
  if (b.has(u, "confuse")) return { skill: "attack" };
  const skills: Skill[] = [...u.skills.map(getSkill), getSkill("attack")].filter((s) => b.canUse(u, s).ok);
  const friends = b.friends(u);
  const ratio = (x: Unit) => x.hp / b.maxHp(x);
  const hurt = friends.filter((f) => ratio(f) < 0.6).sort((a, c) => ratio(a) - ratio(c));
  const cands: Candidate[] = [];

  // a party member on auto braces for a blow it can see coming: a doom countdown about to strike,
  // or a gathered-power attack aimed at it or at everyone
  if (u.side === "ally" && b.canUse(u, getSkill("defend")).ok) {
    const danger = b.opponents(u).some((o) => {
      if ((o.mechs ?? (o.mech ? [o.mech] : [])).includes("countdown") && (o.mechCount ?? 5) <= 1) return true;
      if (!o.charged || !o.intent) return false;
      const t = getSkill(o.intent.skill).target;
      return o.intent.target === u.uid || t === "enemies";
    });
    // bracing beats everything except saving someone about to fall
    const canSave = u.ai === "support" && hurt.some((f) => ratio(f) < 0.3) && skills.some((sk) => !!sk.heal);
    if (danger && !canSave) return { skill: "defend" };
  }

  for (const sk of skills) {
    if (sk.target === "deadAlly") {
      const dead = b.friendsDead(u);
      if (dead.length) cands.push({ a: { skill: sk.id, target: dead[0].uid }, w: 9 });
      continue;
    }
    if (sk.heal && (sk.target === "ally" || sk.target === "allies" || sk.target === "self")) {
      if (!hurt.length) continue;
      const need = 1 - ratio(hurt[0]);
      const w = sk.target === "allies" ? 3 + hurt.length * 2.5 * need : 5 * need + 1;
      cands.push({ a: { skill: sk.id, target: hurt[0].uid }, w: w * (u.ai === "support" ? 2 : 1) });
      continue;
    }
    if (sk.id === "defend") {
      cands.push({ a: { skill: sk.id }, w: ratio(u) < 0.35 ? 1.2 : 0.15 });
      continue;
    }
    const damaging = (sk.power ?? 0) > 0;
    if (!damaging) {
      // Buff / debuff utility: skip if the main effect is already present.
      const main = sk.self?.[0] ?? sk.fx?.[0];
      if (!main) continue;
      const isDebuff = STATUSES[main.s].kind === "debuff";
      if (sk.target === "self") {
        if (b.has(u, main.s)) continue;
        cands.push({ a: { skill: sk.id }, w: 1.3 });
      } else if (sk.target === "ally") {
        const pick = friends.filter((f) => !b.has(f, main.s)).sort((a, c) => b.stat(c, "atk") - b.stat(a, "atk"))[0];
        if (pick) cands.push({ a: { skill: sk.id, target: pick.uid }, w: 1.2 });
      } else if (sk.target === "allies") {
        if (friends.some((f) => !b.has(f, main.s))) cands.push({ a: { skill: sk.id }, w: 1.6 });
      } else if (isDebuff) {
        const opp = b.opponents(u);
        if (opp.some((o) => !b.has(o, main.s))) cands.push({ a: { skill: sk.id }, w: 1.4 });
      }
      continue;
    }

    const targets = sk.target === "enemy" ? b.validTargets(u, sk) : [];
    const count = sk.target === "enemies" ? b.opponents(u).length : 1;
    let w = 1 + (sk.power ?? 1) * (sk.hits ?? 1) * count * 0.8 + sk.tier * 0.4;
    if (sk.id === "attack") w *= u.mp < 10 ? 1.2 : 0.45;
    // physical blows into thorns hurt the attacker: prefer spells, or another target
    const thorny = (t: Unit) => sk.kind === "physical" && !!b.has(t, "thorns");
    if (sk.target === "enemy" && targets.length) {
      let best = targets[0];
      let bestScore = -Infinity;
      for (const t of targets) {
        let score = u.ai === "random" ? b.rng.next() * 2 : 1 - ratio(t) + b.rng.next() * 0.4;
        if (u.side === "ally" && thorny(t)) score -= ratio(u) < 0.5 ? 3 : 1.2;
        // never feed a foe that drinks this element
        if (u.side === "ally" && (t.resist[sk.el] ?? 1) < 0) score -= 6;
        // hit weaknesses to break shields, above all on a foe gathering power (a break cancels it)
        if (u.side === "ally" && (t.resist[sk.el] ?? 1) > 1 && !t.broken) score += t.charged ? 3.5 : 1.5;
        for (const s of REACTION_BONUS[sk.el] ?? []) if (b.has(t, s)) score += 0.8;
        if (sk.sp?.some((s) => s.k === "consume" && b.has(t, s.s))) score += 1.2;
        if (score > bestScore) { bestScore = score; best = t; }
      }
      const prick = ratio(u) < 0.4 ? 0.05 : 0.35;
      cands.push({ a: { skill: sk.id, target: best.uid }, w: (w + Math.max(0, bestScore)) * (u.side === "ally" && thorny(best) ? prick : 1) });
    } else {
      const spiky = u.side === "ally" && sk.target === "enemies" && b.opponents(u).some(thorny);
      cands.push({ a: { skill: sk.id }, w: w * (spiky ? (ratio(u) < 0.4 ? 0.05 : 0.5) : 1) });
    }
  }

  if (!cands.length) {
    const t = b.validTargets(u, getSkill("attack"))[0];
    return { skill: "attack", target: t?.uid };
  }
  return b.rng.weighted(cands, (c) => Math.max(0.05, c.w)).a;
}
