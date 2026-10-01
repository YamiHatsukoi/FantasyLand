import type { Element } from "../combat/types";

/**
 * Battle choreography and effects. Melee fighters wind up, dash across to their target, strike
 * with a short hit-stop and run back; archers loose arrows that arc over and stick in the
 * target; casters throw element-coloured bolts with trails (lightning snaps, stones arc,
 * shards spin); hits knock the target back and spray sparks the way the blow travelled.
 * Everything is drawn on one canvas over the stage, plus Web Animations on the sprites.
 */

type Pt = { x: number; y: number };
type Particle = {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string;
  grav: number; drag: number; kind: "dot" | "spark" | "ring" | "slash" | "stuck" | "glow"; rot?: number; len?: number; spin?: number;
};
export type ShotKind = "arrow" | "orb" | "shard" | "bolt" | "rock" | "wave" | "beam" | "glob" | "bomb";
type Shot = {
  a: Pt; b: Pt; t: number; dur: number; kind: ShotKind; col: string; glow: string; arc: number; spin: number;
  done: () => void; trailT: number;
};

const EL_COL: Record<Element, [string, string]> = {
  physical: ["#f4f0e8", "rgba(255,240,210,"],
  fire: ["#ff7a2a", "rgba(255,140,60,"],
  ice: ["#a8e8ff", "rgba(150,220,255,"],
  lightning: ["#ffe94a", "rgba(255,240,120,"],
  water: ["#4ab0ff", "rgba(90,170,255,"],
  earth: ["#b08a50", "rgba(200,160,90,"],
  wind: ["#9af0c0", "rgba(160,255,200,"],
  light: ["#fff4b0", "rgba(255,245,190,"],
  dark: ["#9a5ae0", "rgba(150,80,220,"],
  poison: ["#7ae04a", "rgba(130,230,80,"],
  arcane: ["#c88aff", "rgba(200,140,255,"],
};
export const elColor = (el: Element) => EL_COL[el]?.[0] ?? "#ffffff";

/** Which projectile an element looks like. */
export function shotFor(el: Element): ShotKind {
  return ({ fire: "orb", ice: "shard", lightning: "bolt", water: "orb", earth: "rock", wind: "wave", light: "beam", dark: "orb", poison: "glob", arcane: "orb", physical: "orb" } as Record<Element, ShotKind>)[el] ?? "orb";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class CombatFx {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private parts: Particle[] = [];
  private shots: Shot[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** Size of the effects relative to a small stage (sprites grow with the screen, so do these). */
  private k = 1;

  constructor(private stage: HTMLElement, private speed: () => number) {
    this.cv = document.createElement("canvas");
    this.cv.className = "cb-fx";
    stage.append(this.cv);
    this.g = this.cv.getContext("2d")!;
  }

  destroy() { cancelAnimationFrame(this.raf); this.cv.remove(); }

  /** Centre of an element (its sprite) in stage coordinates. */
  pos(el: HTMLElement, fy = 0.5): Pt {
    const r = el.getBoundingClientRect(), s = this.stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height * fy - s.top };
  }

  private fit() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width !== this.w || r.height !== this.h || dpr !== this.dpr) {
      this.w = r.width; this.h = r.height; this.dpr = dpr;
      this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    }
    this.k = Math.max(1.3, Math.min(2.4, r.height / 230));
  }

  private kick() {
    if (this.raf) return;
    this.fit();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000) * this.speed();
    this.last = now;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = "lighter";
    // projectiles
    for (const s of this.shots) {
      s.t += dt * 1000;
      const k = Math.min(1, s.t / s.dur);
      const p = this.along(s, k);
      s.trailT += dt * 1000;
      if (s.trailT > 16 && s.kind !== "arrow" && s.kind !== "bolt" && s.kind !== "beam") {
        s.trailT = 0;
        this.parts.push({ x: p.x + (Math.random() - 0.5) * 3, y: p.y + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0, max: 0.32, size: (s.kind === "rock" ? 2 : 3.4) * this.k, col: s.col, grav: s.kind === "glob" ? 40 : 0, drag: 2, kind: "dot" });
      }
      this.drawShot(s, p, k);
      if (k >= 1) { s.done(); }
    }
    this.shots = this.shots.filter((s) => s.t < s.dur);
    // particles
    for (const q of this.parts) {
      q.life += dt;
      q.vx *= 1 - Math.min(1, q.drag * dt); q.vy *= 1 - Math.min(1, q.drag * dt);
      q.vy += q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.spin) q.rot = (q.rot ?? 0) + q.spin * dt;
      this.drawPart(q);
    }
    this.parts = this.parts.filter((q) => q.life < q.max);
    g.globalCompositeOperation = "source-over";
    if (this.parts.length || this.shots.length) this.raf = requestAnimationFrame(this.tick);
    else { this.raf = 0; g.clearRect(0, 0, this.w, this.h); }
  };

  private along(s: Shot, k: number): Pt {
    const x = s.a.x + (s.b.x - s.a.x) * k;
    const y = s.a.y + (s.b.y - s.a.y) * k - Math.sin(k * Math.PI) * s.arc;
    return { x, y };
  }

  private drawShot(s: Shot, p: Pt, k: number) {
    const g = this.g;
    const z = this.k;
    const ahead = this.along(s, Math.min(1, k + 0.02));
    const ang = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    switch (s.kind) {
      case "arrow": {
        g.globalCompositeOperation = "source-over";
        g.save(); g.translate(p.x, p.y); g.rotate(ang); g.scale(z, z);
        g.strokeStyle = "#8a5a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
        g.fillStyle = "#d8dce4"; g.beginPath(); g.moveTo(10, 0); g.lineTo(4, -3.5); g.lineTo(4, 3.5); g.fill();
        g.fillStyle = "#e84a4a"; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-18, -4); g.lineTo(-11, 0); g.lineTo(-18, 4); g.fill();
        g.restore();
        g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x - Math.cos(ang) * 30, p.y - Math.sin(ang) * 30); g.lineTo(p.x - Math.cos(ang) * 16, p.y - Math.sin(ang) * 16); g.stroke();
        g.globalCompositeOperation = "lighter";
        break;
      }
      case "bolt": {
        // a lightning snap: jagged line from the caster, flickering
        const segs = 9;
        for (let pass = 0; pass < 2; pass++) {
          g.strokeStyle = pass ? "#ffffff" : s.glow + "0.8)"; g.lineWidth = (pass ? 2 : 8) * z; g.beginPath();
          for (let i = 0; i <= segs; i++) {
            const t = (i / segs) * Math.min(1, k * 1.6);
            const x = s.a.x + (s.b.x - s.a.x) * t, y = s.a.y + (s.b.y - s.a.y) * t + (i && i < segs ? (Math.random() - 0.5) * 18 : 0);
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        break;
      }
      case "beam": {
        const t = Math.min(1, k * 1.4);
        const x = s.a.x + (s.b.x - s.a.x) * t, y = s.a.y + (s.b.y - s.a.y) * t;
        for (const [w, c] of [[10, s.glow + "0.3)"], [4, s.glow + "0.8)"], [1.5, "#ffffff"]] as const) { g.strokeStyle = c; g.lineWidth = w * z; g.beginPath(); g.moveTo(s.a.x, s.a.y); g.lineTo(x, y); g.stroke(); }
        break;
      }
      case "shard": {
        this.glowAt(p.x, p.y, 12 * z, s.glow);
        g.save(); g.translate(p.x, p.y); g.rotate(ang); g.scale(z, z);
        g.fillStyle = "#e8faff"; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, -3.5); g.lineTo(-7, 0); g.lineTo(0, 3.5); g.fill();
        g.fillStyle = s.col; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, 1); g.lineTo(-7, 0); g.lineTo(0, 3.5); g.fill();
        g.restore();
        break;
      }
      case "rock": case "bomb": {
        g.globalCompositeOperation = "source-over";
        g.save(); g.translate(p.x, p.y); g.rotate(s.t / 90); g.scale(z, z);
        g.fillStyle = s.kind === "bomb" ? "#2a2a34" : "#8a6a44"; g.beginPath(); g.arc(0, 0, s.kind === "bomb" ? 5 : 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = s.kind === "bomb" ? "#5a5a6a" : "#b08a5a"; g.beginPath(); g.arc(-2, -2, 2.5, 0, Math.PI * 2); g.fill();
        if (s.kind === "bomb") { g.fillStyle = "#ffcc4a"; g.fillRect(4, -6, 2, 2); }
        g.restore();
        g.globalCompositeOperation = "lighter";
        break;
      }
      case "wave": {
        g.save(); g.translate(p.x, p.y); g.rotate(ang); g.scale(z, z);
        g.strokeStyle = s.glow + "0.9)"; g.lineWidth = 3; g.beginPath(); g.arc(-4, 0, 9, -1.1, 1.1); g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1.2; g.beginPath(); g.arc(-8, 0, 7, -1, 1); g.stroke();
        g.restore();
        break;
      }
      default: { // orb / glob
        this.glowAt(p.x, p.y, (s.kind === "glob" ? 11 : 18) * z, s.glow, 0.7);
        g.fillStyle = s.col; g.beginPath(); g.arc(p.x, p.y, (s.kind === "glob" ? 4.5 : 6) * z, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(p.x - 1.5 * z, p.y - 1.5 * z, 2.2 * z, 0, Math.PI * 2); g.fill();
      }
    }
  }

  private glowAt(x: number, y: number, r: number, glow: string, a = 0.55) {
    const gr = this.g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, glow + a + ")"); gr.addColorStop(1, glow + "0)");
    this.g.fillStyle = gr; this.g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private drawPart(q: Particle) {
    const g = this.g, t = q.life / q.max, a = Math.max(0, 1 - t);
    switch (q.kind) {
      case "ring":
        g.strokeStyle = q.col.replace("ALPHA", String(a * 0.9)); g.lineWidth = 3 * a + 0.5;
        g.beginPath(); g.arc(q.x, q.y, q.size * (0.3 + t * 1.2), 0, Math.PI * 2); g.stroke();
        break;
      case "slash": {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot ?? 0);
        const len = (q.len ?? 30) * (0.6 + t * 0.6);
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 4 * a + 0.5;
        g.beginPath(); g.arc(0, 0, len, -0.9, 0.9); g.stroke();
        g.strokeStyle = q.col.replace("ALPHA", String(a * 0.8)); g.lineWidth = 8 * a;
        g.beginPath(); g.arc(-2, 0, len, -0.7, 0.7); g.stroke();
        g.restore();
        break;
      }
      case "stuck": {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = Math.min(1, a * 2);
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot ?? 0); g.scale(this.k, this.k);
        g.strokeStyle = "#8a5a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(2, 0); g.stroke();
        g.fillStyle = "#e84a4a"; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-16, -3); g.lineTo(-10, 0); g.lineTo(-16, 3); g.fill();
        g.restore();
        g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
        break;
      }
      case "glow":
        this.glowAt(q.x, q.y, q.size * (1 + t), q.col, a * 0.7);
        break;
      case "spark": {
        g.strokeStyle = q.col; g.globalAlpha = a; g.lineWidth = q.size;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); g.stroke();
        g.globalAlpha = 1;
        break;
      }
      default:
        g.globalAlpha = a; g.fillStyle = q.col;
        g.beginPath(); g.arc(q.x, q.y, q.size * (1 - t * 0.5), 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ choreography
  /**
   * Melee: wind up, dash next to the target, strike (resolves at the moment of impact, with a
   * brief freeze), then run back on its own.
   */
  async dash(root: HTMLElement, body: HTMLElement, target: HTMLElement, hitstop = 70): Promise<void> {
    const a = body.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.bottom - a.bottom;
    const dir = Math.sign(dx) || 1;
    const gap = a.width * 0.32 + b.width * 0.3;
    const tx = dir * Math.max(0, Math.abs(dx) - gap), ty = dy;
    const dur = 640 / this.speed();
    const z = root.style.zIndex;
    root.style.zIndex = "60";
    const anim = body.animate([
      { transform: "translate(0px,0px) scale(1,1)", offset: 0 },
      { transform: `translate(${-dir * 9}px,2px) scale(1.08,0.9)`, offset: 0.15, easing: "ease-out" },
      { transform: `translate(${tx * 0.88}px,${ty * 0.88 - 10}px) scale(0.92,1.08)`, offset: 0.4, easing: "cubic-bezier(.3,.9,.4,1)" },
      { transform: `translate(${tx}px,${ty}px) scale(1.1,0.94)`, offset: 0.48 },
      { transform: `translate(${tx - dir * 3}px,${ty}px) scale(1,1)`, offset: 0.62 },
      { transform: "translate(0px,0px) scale(1,1)", offset: 1, easing: "ease-in-out" },
    ], { duration: dur });
    anim.onfinish = anim.oncancel = () => { root.style.zIndex = z; };
    await sleep(dur * 0.48);
    // hit-stop: freeze on contact so the blow lands
    anim.pause();
    setTimeout(() => anim.play(), hitstop / this.speed());
  }

  /** Spell or skill pose: a short crouch and lift before the effect leaves the caster. */
  async windup(body: HTMLElement, dir: number) {
    const dur = 260 / this.speed();
    body.animate([
      { transform: "translate(0,0) scale(1,1)" },
      { transform: `translate(${-dir * 5}px,2px) scale(1.08,0.9)`, offset: 0.5 },
      { transform: `translate(${dir * 6}px,-3px) scale(0.95,1.06)`, offset: 0.8 },
      { transform: "translate(0,0) scale(1,1)" },
    ], { duration: dur * 1.6, easing: "ease-out" });
    await sleep(dur);
  }

  /** Fires a projectile from a to b; resolves when it lands. */
  shoot(a: Pt, b: Pt, kind: ShotKind, el: Element): Promise<void> {
    this.fit();
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const [col, glow] = EL_COL[el] ?? EL_COL.arcane;
    const dur = (kind === "bolt" ? 140 : kind === "beam" ? 200 : kind === "arrow" ? 200 + d * 0.55 : kind === "rock" || kind === "bomb" || kind === "glob" ? 300 + d * 0.6 : 220 + d * 0.65);
    const arc = kind === "arrow" ? d * 0.12 : kind === "rock" || kind === "bomb" || kind === "glob" ? d * 0.3 : kind === "orb" || kind === "shard" ? d * 0.05 : 0;
    return new Promise((done) => {
      this.shots.push({ a, b, t: 0, dur, kind, col, glow, arc, spin: 0, trailT: 0, done: () => {
        if (kind === "arrow") {
          const ang = Math.atan2(b.y - (a.y - arc * 0.2), b.x - a.x);
          this.parts.push({ x: b.x - Math.cos(ang) * 4, y: b.y - Math.sin(ang) * 4, vx: 0, vy: 0, life: 0, max: 0.9, size: 1, col, grav: 0, drag: 0, kind: "stuck", rot: ang });
        }
        done();
      } });
      this.kick();
    });
  }

  /** Sparks, a slash and a ring where a blow lands; `dir` is the way it travelled. */
  impact(at: Pt, el: Element, o: { dir?: number; crit?: boolean; physical?: boolean; big?: boolean } = {}) {
    const [col, glow] = EL_COL[el] ?? EL_COL.physical;
    const dir = o.dir ?? 1;
    const n = (o.crit ? 22 : 12) + (o.big ? 14 : 0);
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.2 + (dir > 0 ? 0 : Math.PI);
      const sp = (90 + Math.random() * (o.crit ? 260 : 170)) * this.k;
      this.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.25 + Math.random() * 0.3, size: (1.6 + Math.random() * 1.6) * this.k, col: i % 3 ? col : "#ffffff", grav: 380, drag: 3, kind: "spark" });
    }
    this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 0.32, size: (o.crit ? 46 : 30) * this.k, col: glow + "ALPHA)", grav: 0, drag: 0, kind: "ring" });
    this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 0.22, size: (o.crit ? 40 : 26) * this.k, col: glow, grav: 0, drag: 0, kind: "glow" });
    if (o.physical) {
      const base = dir > 0 ? -0.5 : Math.PI + 0.5;
      this.parts.push({ x: at.x - dir * 6, y: at.y, vx: 0, vy: 0, life: 0, max: 0.2, size: 1, col: glow + "ALPHA)", grav: 0, drag: 0, kind: "slash", rot: base, len: (o.crit ? 34 : 26) * this.k });
      if (o.crit) this.parts.push({ x: at.x - dir * 4, y: at.y + 4, vx: 0, vy: 0, life: 0, max: 0.24, size: 1, col: glow + "ALPHA)", grav: 0, drag: 0, kind: "slash", rot: base + dir * 1.1, len: 30 * this.k });
    }
    this.kick();
  }

  /** Healing motes rising around a target. */
  sparkle(at: Pt, col = "#7dff8a", glow = "rgba(140,255,160,") {
    for (let i = 0; i < 16; i++) this.parts.push({ x: at.x + (Math.random() - 0.5) * 34, y: at.y + 10 + Math.random() * 14, vx: (Math.random() - 0.5) * 14, vy: -50 - Math.random() * 60, life: 0, max: 0.7 + Math.random() * 0.4, size: 2 + Math.random() * 1.5, col: i % 3 ? col : "#ffffff", grav: -20, drag: 1, kind: "dot" });
    this.parts.push({ x: at.x, y: at.y + 6, vx: 0, vy: 0, life: 0, max: 0.5, size: 30, col: glow, grav: 0, drag: 0, kind: "glow" });
    this.kick();
  }

  /** A ring of light around a unit (buffs, shields, statuses applied to allies). */
  aura(at: Pt, el: Element) {
    const [, glow] = EL_COL[el] ?? EL_COL.light;
    this.parts.push({ x: at.x, y: at.y + 10, vx: 0, vy: 0, life: 0, max: 0.5, size: 34, col: glow + "ALPHA)", grav: 0, drag: 0, kind: "ring" });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.parts.push({ x: at.x + Math.cos(a) * 22, y: at.y + 12 + Math.sin(a) * 8, vx: 0, vy: -40, life: 0, max: 0.55, size: 2, col: glow + "1)", grav: 0, drag: 0.5, kind: "dot" }); }
    this.kick();
  }

  /** A body falls: a burst of light and dust. */
  defeat(at: Pt) {
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140; this.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0, max: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 2, col: i % 2 ? "#ffe8b0" : "#c8c0d8", grav: 120, drag: 2.5, kind: "dot" }); }
    this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 0.45, size: 56, col: "rgba(255,240,200,ALPHA)", grav: 0, drag: 0, kind: "ring" });
    this.kick();
  }

  /** Target recoils away from the blow and flashes. */
  knock(body: HTMLElement, dir: number, strong = false) {
    const d = strong ? 16 : 9;
    body.animate([
      { transform: "translate(0,0)", filter: "brightness(1)" },
      { transform: `translate(${dir * d}px,-2px) rotate(${dir * (strong ? 6 : 3)}deg)`, filter: "brightness(3) saturate(0)", offset: 0.18 },
      { transform: `translate(${dir * d * 0.6}px,0)`, filter: "brightness(1.4)", offset: 0.45 },
      { transform: "translate(0,0)", filter: "brightness(1)" },
    ], { duration: (strong ? 360 : 260) / this.speed(), easing: "ease-out" });
  }
}
