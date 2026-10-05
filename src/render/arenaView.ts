/**
 * Monster Arena board: the hex board, the bench and the fight, drawn on one canvas.
 * Planning shows the player's units (and the monsters of a monster round); a fight follows an
 * ArenaBattle as it steps and turns its events into effects: projectiles by element, melee
 * lunges with slash arcs, damage numbers (orange physical, blue magic, white true, big crits),
 * named spell banners, area rings, meteors, chains of lightning, arrow rain, death dissolves,
 * revive pillars, and status marks drawn from each fighter's timers (stun stars, chill frost,
 * burning, shields, stealth, frenzy...).
 */
import type { ArenaBattle, CombatEvent, Fighter } from "../arena/combat";
import type { PlacedUnit } from "../arena/combat";
import { COLS, ROWS, HALF } from "../arena/hex";
import { ITEMS } from "../arena/items";
import { arenaUnit } from "../arena/units";
import type { Star } from "../arena/types";
import type { Element } from "../combat/types";
import { sfx } from "../audio/sfx";
import { elColor } from "./combatFx";
import { spriteCanvas } from "./pixel";

const SQ3 = Math.sqrt(3);
export const STAR_COL = ["", "#d49a5a", "#d8e4f0", "#ffd84a", "#ff8af0"];
export const COST_COL = ["", "#9aa4b0", "#4ac06a", "#4a9aff", "#c060ff", "#ffb020"];

export interface PlanUnit { uid: number; unitId: string; star: Star; items: string[]; x: number; y: number; bench: number }

type Pt = { x: number; y: number };
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string; grav: number; kind: "dot" | "spark" | "ring" | "glow" | "star" | "arrow"; r?: number; rot?: number }
interface Shot { a: Pt; b: Pt; t: number; dur: number; col: string; el: Element; big: boolean; arc: number; to?: number }
interface FloatText { x: number; y: number; text: string; col: string; size: number; t: number; max: number; vy: number; stroke?: string }
interface Banner { uid: number; text: string; col: string; t: number; max: number; ult: boolean }
interface Bolt { pts: Pt[]; t: number; max: number; col: string; wide?: boolean }
interface Fall { at: Pt; t: number; dur: number; col: string; r: number; el: Element }

export class ArenaView {
  readonly cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  W = 0;
  H = 0;
  /** Hex radius, hex width, board origin, bench geometry. */
  s = 20;
  hw = 34;
  ox = 0;
  oy = 0;
  benchY = 0;
  slot = 40;
  benchX = 0;

  // what to draw
  plan: { mine: PlanUnit[]; enemy: PlacedUnit[] } = { mine: [], enemy: [] };
  battle: ArenaBattle | null = null;
  drag: { uid: number; px: number; py: number } | null = null;
  dropHex: Pt | null = null;
  dropBench = -1;
  /** Unit highlighted as the target of an item being given. */
  itemTarget = -1;
  showGrid = true;

  // effects
  private parts: Particle[] = [];
  private shots: Shot[] = [];
  private texts: FloatText[] = [];
  private banners: Banner[] = [];
  private bolts: Bolt[] = [];
  private falls: Fall[] = [];
  private flash = new Map<number, number>();
  private lunge = new Map<number, { dx: number; dy: number; t: number }>();
  private deadAt = new Map<number, number>();
  private shake = 0;
  private screenFlash: { col: string; t: number } | null = null;
  private evIndex = 0;
  private time = 0;
  private silCache = new Map<string, HTMLCanvasElement>();

  constructor(host: HTMLElement) {
    this.cv = document.createElement("canvas");
    this.cv.className = "ar-canvas";
    this.g = this.cv.getContext("2d")!;
    host.append(this.cv);
  }

  /** Sizes the board to the space given (CSS px). */
  resize(w: number, maxH: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const byW = (w - 8) / (7.5 * SQ3);
    // board 12.5 s tall + bench (≈ one hex) + gaps
    const byH = (maxH - 12) / (12.5 + SQ3 * 1.25);
    this.s = Math.max(12, Math.min(byW, byH, 46));
    this.hw = this.s * SQ3;
    const boardW = this.hw * 7.5;
    this.W = Math.round(w);
    this.ox = (this.W - boardW) / 2;
    this.oy = 4;
    this.slot = Math.min(this.hw * 1.05, (this.W - 8) / 9);
    this.benchX = (this.W - this.slot * 9) / 2;
    this.benchY = this.oy + this.s * 12.5 + 6 + this.slot / 2;
    this.H = Math.round(this.benchY + this.slot / 2 + 4);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = `${this.W}px`;
    this.cv.style.height = `${this.H}px`;
  }

  // ------------------------------------------------------------ geometry
  hexCenter(x: number, y: number): Pt {
    return { x: this.ox + this.hw * (x + 0.5 + (y & 1 ? 0.5 : 0)), y: this.oy + this.s + 1.5 * this.s * y };
  }
  benchCenter(i: number): Pt {
    return { x: this.benchX + this.slot * (i + 0.5), y: this.benchY };
  }
  /** The hex under a point (CSS px relative to the canvas), if any. */
  hexAt(px: number, py: number): Pt | null {
    let best: Pt | null = null, bd = Infinity;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = this.hexCenter(x, y);
      const d = (c.x - px) ** 2 + (c.y - py) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return bd <= (this.s * 1.05) ** 2 ? best : null;
  }
  benchAt(px: number, py: number): number {
    if (Math.abs(py - this.benchY) > this.slot * 0.6) return -1;
    const i = Math.floor((px - this.benchX) / this.slot);
    return i >= 0 && i < 9 ? i : -1;
  }
  /** The player's unit under a point (planning). */
  unitAt(px: number, py: number): PlanUnit | null {
    const h = this.hexAt(px, py);
    if (h) { const u = this.plan.mine.find((m) => m.bench < 0 && m.x === h.x && m.y === h.y); if (u) return u; }
    const b = this.benchAt(px, py);
    if (b >= 0) return this.plan.mine.find((m) => m.bench === b) ?? null;
    return null;
  }

  private fighterPt(f: Fighter): Pt {
    const to = this.hexCenter(f.x, f.y);
    if (!f.moveFrom) return to;
    const from = this.hexCenter(f.moveFrom.x, f.moveFrom.y);
    const t = Math.min(1, f.moveT);
    const e = t * t * (3 - 2 * t);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
  }

  // ------------------------------------------------------------ fights
  setBattle(b: ArenaBattle | null) {
    this.battle = b;
    this.evIndex = 0;
    this.deadAt.clear();
    this.flash.clear();
    this.lunge.clear();
    this.banners = [];
    this.texts = [];
    this.shots = [];
    this.parts = [];
    this.bolts = [];
    this.falls = [];
  }

  /** Turns the battle's new events into effects (call after stepping it). */
  takeEvents() {
    const b = this.battle;
    if (!b) return;
    const evs = b.events;
    for (; this.evIndex < evs.length; this.evIndex++) this.onEvent(evs[this.evIndex], b);
    // keep the engine's list short on long fights
    if (this.evIndex > 4000) { b.events.splice(0, this.evIndex); this.evIndex = 0; }
  }

  private byUid(b: ArenaBattle, uid: number) { return b.fighters.find((f) => f.uid === uid); }

  private onEvent(e: CombatEvent, b: ArenaBattle) {
    const k = this.s / 22;
    switch (e.t) {
      case "attack": {
        const a = this.byUid(b, e.from), t = this.byUid(b, e.to);
        if (!a || !t) return;
        const pa = this.fighterPt(a), pt = this.fighterPt(t);
        if (e.ranged) {
          const d = Math.hypot(pt.x - pa.x, pt.y - pa.y) / this.hw;
          this.shots.push({ a: { x: pa.x, y: pa.y - this.s * 0.5 }, b: { x: pt.x, y: pt.y - this.s * 0.5 }, t: 0, dur: Math.max(0.08, d * 0.07), col: elColor(e.el), el: e.el, big: false, arc: a.unit.role === "marksman" ? 0.18 : 0.06, to: t.uid });
          sfx(a.unit.role === "marksman" ? "bow" : "whoosh");
        } else {
          const dx = pt.x - pa.x, dy = pt.y - pa.y, n = Math.hypot(dx, dy) || 1;
          this.lunge.set(a.uid, { dx: (dx / n) * this.s * 0.45, dy: (dy / n) * this.s * 0.45, t: 0 });
          this.slash(pt, Math.atan2(dy, dx), elColor(e.el));
          sfx("slash");
        }
        break;
      }
      case "hit": {
        const t = this.byUid(b, e.uid);
        if (!t || e.amount <= 0) return;
        const p = this.fighterPt(t);
        const col = e.trueDmg ? "#ffffff" : e.magic ? "#6ab8ff" : "#ffb04a";
        this.texts.push({ x: p.x + (Math.random() - 0.5) * this.s * 0.6, y: p.y - this.s * 0.9, text: e.crit ? `${e.amount}!` : String(e.amount), col, size: (e.crit ? 17 : 12) * k, t: 0, max: e.crit ? 0.9 : 0.7, vy: -this.s * (e.crit ? 1.6 : 1.2), stroke: "#1a0e08" });
        this.flash.set(t.uid, 0.12);
        this.sparks(p, e.magic ? "#9ad0ff" : elColor(e.el), e.crit ? 9 : 4, e.crit ? 1.4 : 1);
        if (e.crit) { this.shake = Math.max(this.shake, 0.14); sfx("crit"); } else sfx("hit");
        break;
      }
      case "miss": {
        const t = this.byUid(b, e.uid);
        if (t) { const p = this.fighterPt(t); this.texts.push({ x: p.x, y: p.y - this.s, text: "Né", col: "#cfd6e0", size: 11 * k, t: 0, max: 0.6, vy: -this.s }); sfx("miss"); }
        break;
      }
      case "heal": {
        const t = this.byUid(b, e.uid);
        if (!t || e.amount < 5) return;
        const p = this.fighterPt(t);
        this.texts.push({ x: p.x, y: p.y - this.s * 1.1, text: `+${e.amount}`, col: "#7dff8a", size: 11 * k, t: 0, max: 0.7, vy: -this.s, stroke: "#0a2a10" });
        for (let i = 0; i < 4; i++) this.parts.push({ x: p.x + (Math.random() - 0.5) * this.s, y: p.y, vx: 0, vy: -this.s * (1 + Math.random()), life: 0.7, max: 0.7, size: 2 * k, col: "#9dffa0", grav: 0, kind: "star" });
        break;
      }
      case "shield": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        const p = this.fighterPt(t);
        this.parts.push({ x: p.x, y: p.y - this.s * 0.45, vx: 0, vy: 0, life: 0.45, max: 0.45, size: this.s * 0.9, col: "#dff4ff", grav: 0, kind: "ring" });
        break;
      }
      case "cast": {
        const f = this.byUid(b, e.uid);
        if (!f) return;
        const sp = e.spell;
        const col = elColor(sp.el);
        const p = this.fighterPt(f);
        this.banners = this.banners.filter((x) => x.uid !== f.uid);
        this.banners.push({ uid: f.uid, text: `${sp.icon} ${sp.name}`, col, t: 0, max: sp.ult ? 1.8 : 1.2, ult: !!sp.ult });
        this.parts.push({ x: p.x, y: p.y - this.s * 0.4, vx: 0, vy: 0, life: 0.5, max: 0.5, size: this.s * 1.3, col, grav: 0, kind: "ring" });
        this.parts.push({ x: p.x, y: p.y - this.s * 0.4, vx: 0, vy: 0, life: 0.5, max: 0.5, size: this.s * 1.4, col, grav: 0, kind: "glow" });
        if (sp.ult) { this.screenFlash = { col, t: 0.35 }; this.shake = Math.max(this.shake, 0.3); sfx("charge"); }
        sfx("cast", sp.el);
        break;
      }
      case "vfx": {
        const col = elColor(e.el);
        const at = this.hexCenter(e.at.x, e.at.y);
        const from = e.from ? this.hexCenter(e.from.x, e.from.y) : null;
        if (e.kind === "leap" && from) {
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            this.parts.push({ x: from.x + (at.x - from.x) * t, y: from.y + (at.y - from.y) * t - Math.sin(t * Math.PI) * this.s * 1.4, vx: 0, vy: 0, life: 0.35 + t * 0.15, max: 0.5, size: 3 * k, col: e.el === "physical" ? "#ffffff" : col, grav: 0, kind: "glow" });
          }
          this.burst(at, "#e8e0d0", 8, 0.9);
          sfx("whoosh");
        } else if (e.kind === "chain" && from) {
          this.bolts.push({ pts: this.jag({ x: from.x, y: from.y - this.s * 0.5 }, { x: at.x, y: at.y - this.s * 0.5 }), t: 0, max: 0.28, col });
          this.sparks({ x: at.x, y: at.y }, col, 5, 1);
        } else if (e.kind === "bolt" && from) {
          this.shots.push({ a: { x: from.x, y: from.y - this.s * 0.5 }, b: { x: at.x, y: at.y - this.s * 0.5 }, t: 0, dur: 0.16, col, el: e.el, big: true, arc: 0.1 });
        } else if (e.kind === "meteor") {
          this.falls.push({ at, t: 0, dur: 0.38, col, r: Math.max(1, e.radius) * this.hw, el: e.el });
        } else if (e.kind === "volley") {
          for (let i = 0; i < 12; i++) {
            const ang = Math.random() * Math.PI * 2, rr = Math.random() * Math.max(1, e.radius) * this.hw;
            const x = at.x + Math.cos(ang) * rr, y = at.y + Math.sin(ang) * rr * 0.7;
            this.parts.push({ x: x - this.s * 0.6, y: y - this.s * 3, vx: this.s * 1.6, vy: this.s * 8, life: 0.35 + Math.random() * 0.25, max: 0.6, size: 6 * k, col, grav: 0, kind: "arrow" });
          }
          sfx("bow");
        } else if (e.kind === "ring") {
          const r = Math.max(1, e.radius) * this.hw;
          this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0.55, max: 0.55, size: r, col, grav: 0, kind: "ring" });
          this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: r * 0.85, col, grav: 0, kind: "glow" });
          this.burst(at, col, Math.min(22, 8 + e.radius * 4), Math.max(1, e.radius) * 0.9);
        } else if (e.kind === "beam" && from) {
          const a = { x: from.x, y: from.y - this.s * 0.5 }, dx = at.x - from.x, dy = at.y - from.y, n = Math.hypot(dx, dy) || 1;
          const end = { x: from.x + (dx / n) * this.hw * 7, y: from.y - this.s * 0.5 + (dy / n) * this.hw * 7 };
          this.bolts.push({ pts: [a, end], t: 0, max: 0.35, col, wide: true });
          for (let i = 0; i < 10; i++) { const k = i / 10; this.parts.push({ x: a.x + (end.x - a.x) * k, y: a.y + (end.y - a.y) * k, vx: 0, vy: -this.s * 0.5, life: 0.4, max: 0.4, size: 2.5 * (this.s / 22), col, grav: 0, kind: "glow" }); }
        } else if (e.kind === "slash") {
          const ang = from ? Math.atan2(at.y - from.y, at.x - from.x) : 0;
          this.slash(at, ang + 0.6, col);
          this.slash(at, ang - 0.6, "#ffffff");
        } else if (e.kind === "pillar") {
          for (let i = 0; i < 6; i++) this.parts.push({ x: at.x + (Math.random() - 0.5) * this.s * 0.7, y: at.y, vx: 0, vy: -this.s * (1.5 + Math.random() * 1.5), life: 0.7, max: 0.7, size: 2.4 * (this.s / 22), col, grav: 0, kind: "star" });
        } else if (e.kind === "zone") {
          const r = Math.max(1, Math.min(4, e.radius)) * this.hw;
          this.parts.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 1, max: 1, size: r, col, grav: 0, kind: "ring" });
          for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * r; this.parts.push({ x: at.x + Math.cos(a) * rr, y: at.y + Math.sin(a) * rr * 0.62, vx: 0, vy: -this.s * 0.6, life: 0.8, max: 0.8, size: 3 * (this.s / 22), col, grav: 0, kind: "glow" }); }
        } else if (e.kind === "swap" && from) {
          this.burst(from, col, 12, 1);
          this.burst(at, col, 12, 1);
          this.bolts.push({ pts: [from, at], t: 0, max: 0.3, col });
        }
        break;
      }
      case "status": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        const p = this.fighterPt(t);
        const NAMES: Record<string, [string, string]> = {
          stun: ["Choáng", "#ffe14a"], chill: ["Làm chậm", "#9ad8ff"], silence: ["Câm lặng", "#c8a0ff"], blind: ["Mù", "#b0b0b0"], shred: ["Xé giáp", "#ff9a5a"],
          weaken: ["Suy yếu", "#c08080"], mark: ["Đánh dấu", "#ff6a6a"], burn: ["Bỏng", "#ff8a3a"], poison: ["Độc", "#8ae04a"], bleed: ["Chảy máu", "#ff4a5a"],
          taunt: ["Khiêu khích", "#ff7a5a"], stealth: ["Tàng hình", "#a0a8c0"], frenzy: ["Cuồng nộ", "#ff4a3a"], mirror: ["Phản đòn", "#8af0ff"], buff: ["Cường hóa", "#ffd86a"],
        };
        const [txt, col] = NAMES[e.s] ?? [e.s, "#ffffff"];
        if (e.s === "burn" || e.s === "poison" || e.s === "bleed") return; // shown as marks, not words
        this.texts.push({ x: p.x, y: p.y - this.s * 1.45, text: txt, col, size: 9.5 * k, t: 0, max: 0.8, vy: -this.s * 0.4, stroke: "#000" });
        if (e.s === "buff" || e.s === "frenzy") sfx("buff");
        else if (e.s === "stun") sfx("debuff");
        break;
      }
      case "death": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        this.deadAt.set(t.uid, this.time);
        const p = this.fighterPt(t);
        const col = t.side === 0 ? "#9ad0ff" : "#ff9a9a";
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, sp = this.s * (0.6 + Math.random() * 1.6);
          this.parts.push({ x: p.x + (Math.random() - 0.5) * this.s * 0.8, y: p.y - Math.random() * this.s, vx: Math.cos(a) * sp * 0.5, vy: -Math.abs(Math.sin(a)) * sp, life: 0.9, max: 0.9, size: (1.5 + Math.random() * 2) * k, col: Math.random() < 0.5 ? col : "#e8e0f0", grav: -this.s * 0.4, kind: "dot" });
        }
        sfx("death");
        break;
      }
      case "revive": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        this.deadAt.delete(t.uid);
        const p = this.fighterPt(t);
        for (let i = 0; i < 18; i++) this.parts.push({ x: p.x + (Math.random() - 0.5) * this.s * 0.8, y: p.y, vx: 0, vy: -this.s * (2 + Math.random() * 2), life: 0.9, max: 0.9, size: 2.5 * k, col: "#ffe89a", grav: 0, kind: "glow" });
        this.texts.push({ x: p.x, y: p.y - this.s * 1.5, text: "Hồi sinh!", col: "#ffe89a", size: 12 * k, t: 0, max: 1, vy: -this.s * 0.5, stroke: "#3a2a00" });
        sfx("revive");
        break;
      }
      case "loot": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        const p = this.fighterPt(t);
        const label = e.kind === "gold" ? `+${e.n} 💰` : e.kind === "xp" ? `+${e.n} KN` : `+${e.n} 🔄`;
        this.texts.push({ x: p.x, y: p.y - this.s * 1.7, text: label, col: e.kind === "gold" ? "#ffd84a" : e.kind === "xp" ? "#c99bff" : "#8ae0ff", size: 13 * (this.s / 22), t: 0, max: 1.3, vy: -this.s * 0.6, stroke: "#1a1000" });
        sfx("coin");
        break;
      }
      case "spawn": {
        const t = this.byUid(b, e.uid);
        if (!t) return;
        this.burst(this.fighterPt(t), "#d8d0e8", 12, 0.8);
        sfx("spawn");
        break;
      }
    }
  }

  private slash(at: Pt, ang: number, col: string) {
    this.parts.push({ x: at.x, y: at.y - this.s * 0.5, vx: 0, vy: 0, life: 0.18, max: 0.18, size: this.s * 0.75, col: col === "#f4f0e8" ? "#ffffff" : col, grav: 0, kind: "spark", rot: ang });
  }
  private sparks(at: Pt, col: string, n: number, pow: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = this.s * (1.5 + Math.random() * 2.5) * pow;
      this.parts.push({ x: at.x, y: at.y - this.s * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.s, life: 0.3, max: 0.3, size: 1.6 * (this.s / 22), col, grav: this.s * 6, kind: "dot" });
    }
  }
  private burst(at: Pt, col: string, n: number, pow: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, sp = this.s * (1.6 + Math.random() * 2) * pow;
      this.parts.push({ x: at.x, y: at.y - this.s * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, life: 0.45, max: 0.45, size: 2.4 * (this.s / 22), col, grav: 0, kind: "glow" });
    }
  }
  private jag(a: Pt, b: Pt): Pt[] {
    const pts = [a];
    const n = 6;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push({ x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * this.s * 0.6, y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * this.s * 0.6 });
    }
    pts.push(b);
    return pts;
  }

  // ------------------------------------------------------------ frame
  frame(dt: number) {
    this.time += dt;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake -= dt; const m = this.s * 0.18 * Math.min(1, this.shake * 6); sx = (Math.random() - 0.5) * m; sy = (Math.random() - 0.5) * m; }
    g.clearRect(0, 0, this.W, this.H);
    g.save();
    g.translate(sx, sy);
    this.drawBoard();
    if (this.battle) this.drawFight(dt);
    else this.drawPlan();
    this.drawFx(dt);
    g.restore();
    if (this.screenFlash) {
      this.screenFlash.t -= dt;
      if (this.screenFlash.t <= 0) this.screenFlash = null;
      else { g.globalAlpha = Math.min(0.28, this.screenFlash.t); g.fillStyle = this.screenFlash.col; g.fillRect(0, 0, this.W, this.H); g.globalAlpha = 1; }
    }
  }

  private hexPath(c: Pt, r: number) {
    const g = this.g;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }

  private drawBoard() {
    const g = this.g;
    // arena floor
    const top = this.oy - 2, bot = this.oy + this.s * 12.5 + 2;
    const grd = g.createLinearGradient(0, top, 0, bot);
    grd.addColorStop(0, "#2a1c26");
    grd.addColorStop(0.5, "#1c1a24");
    grd.addColorStop(1, "#172030");
    g.fillStyle = grd;
    g.fillRect(0, top, this.W, bot - top);
    const fighting = !!this.battle;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = this.hexCenter(x, y);
      this.hexPath(c, this.s * 0.94);
      const mine = y >= HALF;
      g.fillStyle = mine ? ((x + y) & 1 ? "rgba(90,140,220,0.16)" : "rgba(90,140,220,0.11)") : ((x + y) & 1 ? "rgba(220,90,100,0.13)" : "rgba(220,90,100,0.08)");
      g.fill();
      g.strokeStyle = mine && !fighting ? "rgba(160,200,255,0.22)" : "rgba(255,255,255,0.08)";
      g.lineWidth = 1;
      g.stroke();
    }
    // the middle line
    g.strokeStyle = "rgba(255,220,160,0.18)";
    g.setLineDash([4, 5]);
    g.beginPath();
    const my = this.oy + this.s + 1.5 * this.s * 3.5;
    g.moveTo(this.ox, my); g.lineTo(this.ox + this.hw * 7.5, my);
    g.stroke();
    g.setLineDash([]);
    if (this.dropHex) {
      const c = this.hexCenter(this.dropHex.x, this.dropHex.y);
      this.hexPath(c, this.s * 0.94);
      g.fillStyle = "rgba(255,230,140,0.25)";
      g.fill();
      g.strokeStyle = "#ffe08a";
      g.lineWidth = 2;
      g.stroke();
    }
    // bench
    for (let i = 0; i < 9; i++) {
      const c = this.benchCenter(i);
      const r = this.slot * 0.46;
      g.fillStyle = this.dropBench === i ? "rgba(255,230,140,0.25)" : "rgba(255,255,255,0.05)";
      g.strokeStyle = this.dropBench === i ? "#ffe08a" : "rgba(255,255,255,0.12)";
      g.lineWidth = this.dropBench === i ? 2 : 1;
      roundRect(g, c.x - r, c.y - r, r * 2, r * 2, 6);
      g.fill();
      g.stroke();
    }
  }

  private sprite(id: string, pal?: Record<string, string>) { return spriteCanvas(id, pal); }
  private silhouette(id: string, pal?: Record<string, string>) {
    const k = `${id}|${pal ? JSON.stringify(pal) : ""}`;
    let c = this.silCache.get(k);
    if (!c) {
      const src = this.sprite(id, pal);
      c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      const x = c.getContext("2d")!;
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = "source-in";
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, c.width, c.height);
      this.silCache.set(k, c);
    }
    return c;
  }

  /** One unit: shadow, sprite, star pips, items; bars when fighting. */
  private drawUnit(unitId: string, star: Star, items: string[], p: Pt, o: { alpha?: number; flip?: boolean; flash?: number; ally?: boolean; scale?: number; ring?: string } = {}) {
    const u = arenaUnit(unitId);
    if (!u) return;
    const g = this.g;
    const size = this.hw * 0.92 * (u.cost === 5 ? 1.15 : 1) * (1 + (star - 1) * 0.07) * (o.scale ?? 1);
    g.globalAlpha = o.alpha ?? 1;
    // shadow
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(p.x, p.y + this.s * 0.38, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
    g.fill();
    if (o.ring) { g.strokeStyle = o.ring; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y + this.s * 0.38, size * 0.4, size * 0.15, 0, 0, Math.PI * 2); g.stroke(); }
    const src = this.sprite(u.sprite, u.palette);
    const x = p.x - size / 2, y = p.y + this.s * 0.42 - size;
    g.save();
    if (o.flip) { g.translate(p.x * 2, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, 0, src.width, src.height, x, y, size, size);
    if (o.flash && o.flash > 0) {
      g.globalAlpha = (o.alpha ?? 1) * Math.min(0.85, o.flash * 7);
      g.drawImage(this.silhouette(u.sprite, u.palette), 0, 0, src.width, src.height, x, y, size, size);
    }
    g.restore();
    g.globalAlpha = o.alpha ?? 1;
    // stars
    const pip = Math.max(3, this.s * 0.14);
    const top = p.y + this.s * 0.42 - size - pip * 0.6;
    for (let i = 0; i < star; i++) {
      const cx = p.x + (i - (star - 1) / 2) * pip * 2.2;
      drawStar(g, cx, top, pip, STAR_COL[star]);
    }
    // items
    if (items.length) {
      g.font = `${Math.round(this.s * 0.42)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      items.forEach((it, i) => g.fillText(ITEMS[it]?.icon ?? "?", p.x + (i - (items.length - 1) / 2) * this.s * 0.5, p.y + this.s * 0.62));
    }
    g.globalAlpha = 1;
  }

  private drawPlan() {
    const g = this.g;
    for (const e of this.plan.enemy) {
      const p = this.hexCenter(e.x, e.y);
      this.drawUnit(e.unitId, e.star, e.items, p, { flip: false, ring: "rgba(255,110,110,0.7)" });
    }
    const list = [...this.plan.mine].sort((a, b) => (a.bench < 0 ? a.y : 99) - (b.bench < 0 ? b.y : 99));
    for (const u of list) {
      if (this.drag?.uid === u.uid) continue;
      const p = u.bench < 0 ? this.hexCenter(u.x, u.y) : this.benchCenter(u.bench);
      const bench = u.bench >= 0;
      this.drawUnit(u.unitId, u.star, u.items, bench ? { x: p.x, y: p.y - this.slot * 0.08 } : p, { scale: bench ? Math.min(1, this.slot / this.hw) * 0.92 : 1, ring: this.itemTarget === u.uid ? "#ffe08a" : bench ? undefined : "rgba(120,180,255,0.55)" });
    }
    if (this.drag) {
      const u = this.plan.mine.find((m) => m.uid === this.drag!.uid);
      if (u) {
        g.globalAlpha = 0.9;
        this.drawUnit(u.unitId, u.star, u.items, { x: this.drag.px, y: this.drag.py + this.s * 0.2 }, { scale: 1.12 });
        g.globalAlpha = 1;
      }
    }
  }

  private drawFight(dt: number) {
    const b = this.battle!;
    const g = this.g;
    const t = b.time;
    for (const u of this.plan.mine) if (u.bench >= 0) {
      const p = this.benchCenter(u.bench);
      this.drawUnit(u.unitId, u.star, u.items, { x: p.x, y: p.y - this.slot * 0.08 }, { scale: Math.min(1, this.slot / this.hw) * 0.92, alpha: 0.8 });
    }
    const list = [...b.fighters].sort((a, c) => this.fighterPt(a).y - this.fighterPt(c).y);
    for (const f of list) {
      const died = this.deadAt.get(f.uid);
      if (!f.alive && died === undefined) continue;
      let alpha = 1;
      if (!f.alive) { alpha = 1 - (this.time - died!) / 0.6; if (alpha <= 0) continue; }
      if (f.stealth > t) alpha *= 0.4;
      const base = this.fighterPt(f);
      const p = { ...base };
      const l = this.lunge.get(f.uid);
      if (l) {
        l.t += dt;
        const k = l.t < 0.09 ? l.t / 0.09 : Math.max(0, 1 - (l.t - 0.09) / 0.15);
        p.x += l.dx * k; p.y += l.dy * k;
        if (l.t > 0.25) this.lunge.delete(f.uid);
      }
      // idle bob
      p.y += Math.sin(this.time * 4 + f.uid) * this.s * 0.03;
      const tg = f.target !== null ? b.fighters.find((x) => x.uid === f.target) : null;
      const flip = tg ? this.fighterPt(tg).x < base.x : f.side === 1;
      const fl = this.flash.get(f.uid) ?? 0;
      if (fl > 0) this.flash.set(f.uid, fl - dt);
      // auras under the sprite
      if (f.frenzy > t) this.glowAt(p, "#ff4a3a", 0.35 + Math.sin(this.time * 10) * 0.1);
      if (f.mirror > t) this.glowAt(p, "#8af0ff", 0.3);
      if (f.unit.cost === 5 && f.alive) this.glowAt(p, "#ffd84a", 0.12);
      this.drawUnit(f.unit.id, f.star, f.items, p, { alpha, flip, flash: fl, ally: f.side === 0, ring: f.side === 0 ? "rgba(110,170,255,0.6)" : "rgba(255,110,110,0.6)" });
      if (!f.alive) continue;
      // status marks
      if (f.chill > t) { g.fillStyle = "rgba(150,220,255,0.28)"; g.beginPath(); g.ellipse(p.x, p.y + this.s * 0.3, this.s * 0.55, this.s * 0.2, 0, 0, Math.PI * 2); g.fill(); }
      const shield = f.shields.reduce((s, x) => s + (x.until > t ? x.amt : 0), 0);
      if (shield > 0) { g.strokeStyle = "rgba(220,240,255,0.55)"; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y - this.s * 0.3, this.s * 0.72, 0, Math.PI * 2); g.stroke(); }
      if (f.stun > t) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 5 + (i * Math.PI * 2) / 3;
          drawStar(g, p.x + Math.cos(a) * this.s * 0.4, p.y - this.s * 1.3 + Math.sin(a) * this.s * 0.12, this.s * 0.12, "#ffe14a");
        }
      }
      if (f.taunt > t) { g.fillStyle = "#ff7a5a"; g.font = `bold ${Math.round(this.s * 0.5)}px system-ui`; g.textAlign = "center"; g.fillText("!", p.x + this.s * 0.55, p.y - this.s * 1.1); }
      if (Math.random() < dt * 6) {
        const dot = f.dots.find((d) => d.until > t);
        if (dot) this.parts.push({ x: p.x + (Math.random() - 0.5) * this.s * 0.6, y: p.y - this.s * 0.2, vx: 0, vy: -this.s * 1.2, life: 0.5, max: 0.5, size: 2 * (this.s / 22), col: dot.kind === "burn" ? "#ff8a3a" : dot.kind === "poison" ? "#8ae04a" : "#ff4a5a", grav: 0, kind: "glow" });
      }
      // bars
      const bw = this.hw * 0.78, bh = Math.max(3, this.s * 0.15);
      const bx = p.x - bw / 2, by = p.y - this.s * 1.38;
      g.fillStyle = "rgba(0,0,0,0.7)";
      g.fillRect(bx - 1, by - 1, bw + 2, bh + bh * 0.6 + 3);
      const total = Math.max(f.maxHp, f.hp + shield);
      g.fillStyle = f.side === 0 ? "#5ad46a" : "#ff5a5a";
      g.fillRect(bx, by, (bw * f.hp) / total, bh);
      if (shield > 0) { g.fillStyle = "#f0f6ff"; g.fillRect(bx + (bw * f.hp) / total, by, (bw * shield) / total, bh); }
      // ticks every 300 hp
      g.fillStyle = "rgba(0,0,0,0.45)";
      for (let v = 300; v < total; v += 300) g.fillRect(bx + (bw * v) / total, by, 1, bh);
      if (f.unit.spell.passive) { g.fillStyle = "#b08aff"; g.fillRect(bx, by + bh + 1, bw, bh * 0.6); } // passives need no mana
      else {
        g.fillStyle = f.mana >= f.maxMana - 0.5 ? "#c8e8ff" : "#4a9aff";
        g.fillRect(bx, by + bh + 1, (bw * Math.min(1, f.mana / f.maxMana)), bh * 0.6);
      }
    }
    // banners over casters
    for (const bn of this.banners) {
      bn.t += dt;
      const f = b.fighters.find((x) => x.uid === bn.uid);
      if (!f) continue;
      const p = this.fighterPt(f);
      const a = Math.min(1, (bn.max - bn.t) * 4, bn.t * 10);
      if (a <= 0) continue;
      g.globalAlpha = a;
      const size = Math.round(this.s * (bn.ult ? 0.56 : 0.44));
      g.font = `bold ${size}px system-ui, sans-serif`;
      const w = g.measureText(bn.text).width + size;
      const x = Math.max(w / 2 + 2, Math.min(this.W - w / 2 - 2, p.x)), y = p.y - this.s * (bn.ult ? 2.3 : 1.95) - bn.t * this.s * 0.2;
      g.fillStyle = bn.ult ? "rgba(40,20,0,0.85)" : "rgba(10,12,20,0.8)";
      roundRect(g, x - w / 2, y - size * 0.8, w, size * 1.6, size * 0.5);
      g.fill();
      g.strokeStyle = bn.ult ? "#ffd84a" : bn.col;
      g.lineWidth = bn.ult ? 2 : 1.2;
      g.stroke();
      g.fillStyle = bn.ult ? "#ffe89a" : "#ffffff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(bn.text, x, y + 1);
      g.globalAlpha = 1;
    }
    this.banners = this.banners.filter((x) => x.t < x.max);
  }

  private glowAt(p: Pt, col: string, a: number) {
    const g = this.g;
    const r = this.s * 0.9;
    const gr = g.createRadialGradient(p.x, p.y - this.s * 0.3, 0, p.x, p.y - this.s * 0.3, r);
    gr.addColorStop(0, hexA(col, a));
    gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr;
    g.fillRect(p.x - r, p.y - this.s * 0.3 - r, r * 2, r * 2);
  }

  private drawFx(dt: number) {
    const g = this.g;
    // projectiles
    for (const s of this.shots) {
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const x = s.a.x + (s.b.x - s.a.x) * k;
      const lift = Math.sin(k * Math.PI) * Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) * s.arc;
      const y = s.a.y + (s.b.y - s.a.y) * k - lift;
      const r = (s.big ? 4.5 : 2.6) * (this.s / 22);
      // trail
      for (let i = 1; i <= 4; i++) {
        const kk = Math.max(0, k - i * 0.06);
        const tx = s.a.x + (s.b.x - s.a.x) * kk, ty = s.a.y + (s.b.y - s.a.y) * kk - Math.sin(kk * Math.PI) * Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) * s.arc;
        g.fillStyle = hexA(s.col, 0.5 - i * 0.1);
        g.beginPath(); g.arc(tx, ty, r * (1 - i * 0.15), 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = hexA(s.col, 0.35);
      g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
      g.fillStyle = s.col;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (k >= 1) this.sparks({ x: s.b.x, y: s.b.y + this.s * 0.5 }, s.col, s.big ? 8 : 3, s.big ? 1.2 : 0.7);
    }
    this.shots = this.shots.filter((s) => s.t < s.dur);
    // meteors
    for (const f of this.falls) {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const x = f.at.x - this.s * 2 * (1 - k), y = f.at.y - this.s * 9 * (1 - k);
      g.fillStyle = hexA(f.col, 0.4);
      g.beginPath(); g.arc(x, y, this.s * 0.7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff4d0";
      g.beginPath(); g.arc(x, y, this.s * 0.35, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 2; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * this.s, vy: -this.s * 2, life: 0.35, max: 0.35, size: 3 * (this.s / 22), col: f.col, grav: 0, kind: "glow" });
      if (k >= 1) {
        this.parts.push({ x: f.at.x, y: f.at.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: f.r, col: f.col, grav: 0, kind: "ring" });
        this.burst(f.at, f.col, 18, f.r / this.s * 0.8);
        this.shake = Math.max(this.shake, 0.22);
        sfx("impact", f.el);
      }
    }
    this.falls = this.falls.filter((f) => f.t < f.dur);
    // lightning
    for (const b of this.bolts) {
      b.t += dt;
      const a = 1 - b.t / b.max;
      g.strokeStyle = hexA(b.col, a * (b.wide ? 0.7 : 1));
      g.lineWidth = (b.wide ? 9 * a + 2 : 3) * (this.s / 22);
      g.beginPath();
      b.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 1.2;
      g.stroke();
    }
    this.bolts = this.bolts.filter((b) => b.t < b.max);
    // particles
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = Math.max(0, p.life / p.max);
      if (p.kind === "ring") {
        const r = p.size * (1 - a * 0.7);
        g.strokeStyle = hexA(p.col, a);
        g.lineWidth = 3 * a + 1;
        g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke();
      } else if (p.kind === "glow") {
        const r = p.size * (0.6 + a * 0.6);
        g.fillStyle = hexA(p.col, a * 0.5);
        g.beginPath(); g.arc(p.x, p.y, r * 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = hexA(p.col, a);
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      } else if (p.kind === "spark") {
        // a slash arc across the target
        const r = p.size, rot = p.rot ?? 0;
        g.strokeStyle = hexA(p.col, a);
        g.lineWidth = 3.5 * a + 0.5;
        g.beginPath(); g.arc(p.x - Math.cos(rot) * r * 0.5, p.y - Math.sin(rot) * r * 0.5, r, rot - 1.1 + (1 - a) * 0.6, rot + 0.6 + (1 - a) * 0.6); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = 1.2;
        g.stroke();
      } else if (p.kind === "star") {
        drawStar(g, p.x, p.y, p.size * (0.5 + a), hexA(p.col, a));
      } else if (p.kind === "arrow") {
        const n = Math.hypot(p.vx, p.vy) || 1;
        g.strokeStyle = hexA(p.col, Math.min(1, a * 2));
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / n) * p.size * 2, p.y - (p.vy / n) * p.size * 2); g.stroke();
        if (p.life <= dt) this.sparks({ x: p.x, y: p.y + this.s * 0.5 }, p.col, 2, 0.5);
      } else {
        g.fillStyle = hexA(p.col, a);
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    // floating numbers
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of this.texts) {
      t.t += dt;
      const k = t.t / t.max;
      const pop = t.t < 0.08 ? 1 + (0.08 - t.t) * 6 : 1;
      g.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.5));
      g.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      const y = t.y + t.vy * t.t * (1 - k * 0.5);
      if (t.stroke) { g.strokeStyle = t.stroke; g.lineWidth = 3; g.strokeText(t.text, t.x, y); }
      g.fillStyle = t.col;
      g.fillText(t.text, t.x, y);
    }
    g.globalAlpha = 1;
    this.texts = this.texts.filter((t) => t.t < t.max);
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 0.8;
  g.stroke();
}

/** "#rrggbb" (or rgba) with an alpha. */
function hexA(col: string, a: number): string {
  if (col.startsWith("rgba")) return col.replace(/[\d.]+\)$/, `${Math.max(0, a)})`);
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
