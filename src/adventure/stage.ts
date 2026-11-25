/**
 * Stage: a section's living diorama (art/scene.ts) with its characters standing in it
 * (art/people.ts, art/creatures.ts). Used by the reading screen, cutscenes and battles.
 * Drawn at native resolution (320x180) and scaled up crisp to fit its box.
 */
import { creatureFrame, creatureSize, isCreature, type CPose } from "./art/creatures";
import { isPersonActor, lookFor, personFrame, type Facing, type Look, type Pose } from "./art/people";
import { makeScene, type SceneHandle, type SceneSpec } from "./art/scene";

export const W = 320;
export const H = 180;

export interface Actor {
  id: string;
  look?: Look;
  x: number;
  y: number;
  facing: Facing;
  pose: Pose | CPose;
  /** Frame clock offset so actors don't breathe in sync. */
  phase: number;
  /** Play the pose once from this time (ms), then return to idle. */
  once?: { pose: Pose | CPose; at: number; ms: number };
  /** Movement target. */
  to?: { x: number; y: number; speed: number; done?: () => void };
  alpha?: number;
  flash?: number;
  shake?: number;
  bubble?: { text: string; until: number };
  scale?: number;
  hidden?: boolean;
}

export const isMonster = (id: string) => !isPersonActor(id) && isCreature(id);

export function actorFrame(a: Actor, t: number): HTMLCanvasElement {
  let pose = a.pose;
  let f = Math.floor((t + a.phase) / (pose === "walk" || pose === "move" ? 130 : 420));
  if (a.once && t - a.once.at < a.once.ms) {
    pose = a.once.pose;
    f = Math.floor((t - a.once.at) / 110);
  }
  if (isMonster(a.id)) {
    const p = (pose === "walk" ? "move" : pose === "cast" ? "attack" : pose) as CPose;
    return creatureFrame(a.id, p, f, a.facing === "right" ? "right" : "left");
  }
  const p = (pose === "move" ? "walk" : pose) as Pose;
  return personFrame(a.look ?? lookFor(a.id), a.facing, p, f);
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
  g?: number;
  glow?: boolean;
}

/** Floating text (damage numbers...). */
export interface Floater {
  text: string;
  x: number;
  y: number;
  col: string;
  born: number;
  big?: boolean;
}

export class Stage {
  canvas: HTMLCanvasElement;
  scene: SceneHandle;
  actors: Actor[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  /** Extra drawing on top of actors (projectiles...). */
  overlays: ((g: CanvasRenderingContext2D, t: number) => boolean)[] = [];
  cam = { x: 0, y: 0, zoom: 1 };
  shakeUntil = 0;
  flashUntil = 0;
  flashCol = "#fff";
  private buf: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private raf = 0;
  private alive = true;
  private last = 0;
  now = 0;

  constructor(spec: SceneSpec, cls = "adv-stage") {
    this.scene = makeScene(spec);
    this.canvas = document.createElement("canvas");
    this.canvas.className = cls;
    this.canvas.width = W;
    this.canvas.height = H;
    this.buf = document.createElement("canvas");
    this.buf.width = W;
    this.buf.height = H;
    this.g = this.buf.getContext("2d")!;
    this.g.imageSmoothingEnabled = false;
    const loop = (t: number) => {
      if (!this.alive) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }

  setScene(spec: SceneSpec) {
    this.scene = makeScene(spec);
  }

  /** Places the section's actors on the scene's standing spots (hero first). */
  cast(ids: string[], heroLook?: Look) {
    const slots = this.scene.slots;
    const list = ids.slice(0, slots.length);
    const offset = Math.max(0, Math.floor((slots.length - list.length) / 2));
    this.actors = list.map((id, i) => {
      const s = slots[Math.min(slots.length - 1, i + offset)];
      return {
        id, x: s.x, y: s.y, look: id === "lonewolf" || id === "hero" ? heroLook : undefined,
        facing: i === 0 ? "right" : "left", pose: "idle", phase: (i * 337) % 900,
      } as Actor;
    });
    return this.actors;
  }

  actor(id: string) {
    return this.actors.find((a) => a.id === id);
  }

  play(a: Actor, pose: Pose | CPose, ms = 450) {
    a.once = { pose, at: this.now, ms };
  }

  moveTo(a: Actor, x: number, y = a.y, speed = 0.06): Promise<void> {
    return new Promise((res) => {
      a.pose = "walk";
      if (x !== a.x) a.facing = x > a.x ? "right" : "left";
      a.to = { x, y, speed, done: res };
    });
  }

  burst(x: number, y: number, col: string, n = 12, spread = 1.4, opts: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * spread;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 0, max: 420 + Math.random() * 300, col, size: Math.random() < 0.3 ? 2 : 1, g: 0.004, ...opts });
    }
  }

  float(text: string, x: number, y: number, col: string, big = false) {
    this.floaters.push({ text, x, y, col, born: this.now, big });
  }

  shake(ms = 260) { this.shakeUntil = this.now + ms; }
  flash(col = "#fff", ms = 120) { this.flashCol = col; this.flashUntil = this.now + ms; }

  private frame(t: number) {
    const dt = Math.min(50, this.last ? t - this.last : 16);
    this.last = t;
    this.now = t;
    const g = this.g, sc = this.scene;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    let sx = this.cam.x, sy = this.cam.y;
    if (t < this.shakeUntil) { sx += Math.round((Math.random() - 0.5) * 4); sy += Math.round((Math.random() - 0.5) * 3); }
    g.translate(-sx, -sy);
    sc.draw(g, t);
    // movement
    for (const a of this.actors) {
      if (!a.to) continue;
      const dx = a.to.x - a.x, dy = a.to.y - a.y, d = Math.hypot(dx, dy), step = a.to.speed * dt;
      if (d <= step) {
        a.x = a.to.x; a.y = a.to.y;
        const done = a.to.done;
        a.to = undefined;
        a.pose = "idle";
        done?.();
      } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
    }
    // actors back to front
    const light = sc.light(t);
    for (const a of [...this.actors].sort((p, q) => p.y - q.y)) {
      if (a.hidden) continue;
      const fr = actorFrame(a, t);
      const s = a.scale ?? 1;
      const w = fr.width * s, h = fr.height * s;
      let x = Math.round(a.x - w / 2), y = Math.round(a.y - h);
      if (a.shake && t < a.shake) x += Math.round((Math.random() - 0.5) * 3);
      if (isMonster(a.id) && creatureSize(a.id).flying) y -= 18 + Math.round(Math.sin((t + a.phase) / 300) * 3);
      // shadow
      g.fillStyle = "rgba(0,0,0,.32)";
      g.beginPath();
      g.ellipse(Math.round(a.x), Math.round(a.y) - 1, Math.max(6, w * 0.3), 2.5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = a.alpha ?? 1;
      g.drawImage(tinted(fr, light), x, y, w, h);
      g.globalAlpha = 1;
      if (a.flash && t < a.flash) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.7;
        g.drawImage(fr, x, y, w, h);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
    }
    this.overlays = this.overlays.filter((o) => o(g, t));
    // particles
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += (p.g ?? 0) * dt;
      g.globalAlpha = Math.max(0, 1 - p.life / p.max);
      if (p.glow) g.globalCompositeOperation = "lighter";
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
    sc.drawFront(g, t);
    // floating numbers
    g.textAlign = "center";
    for (const f of this.floaters) {
      const age = (t - f.born) / 1000;
      g.font = `${f.big ? 14 : 11}px VT323, monospace`;
      g.globalAlpha = Math.max(0, 1 - age * 0.9);
      const y = f.y - age * 22;
      g.fillStyle = "#000";
      g.fillText(f.text, f.x + 1, y + 1);
      g.fillStyle = f.col;
      g.fillText(f.text, f.x, y);
    }
    g.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => t - f.born < 1100);
    // speech bubbles
    for (const a of this.actors) if (a.bubble && t < a.bubble.until) bubble(g, a, a.bubble.text);
    if (t < this.flashUntil) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.45; g.fillStyle = this.flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // blit, scaled crisp
    const c = this.canvas.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, 0, 0);
  }
}

/** Actor frame graded by the scene light (night blue, dusk orange...), cached per frame/tint. */
const tintCache = new WeakMap<HTMLCanvasElement, { key: string; c: HTMLCanvasElement }>();
function tinted(fr: HTMLCanvasElement, light: { tint: string; alpha: number }) {
  if (light.alpha <= 0.01) return fr;
  const key = `${light.tint}|${light.alpha.toFixed(2)}`;
  const hit = tintCache.get(fr);
  if (hit && hit.key === key) return hit.c;
  const c = document.createElement("canvas");
  c.width = fr.width; c.height = fr.height;
  const g = c.getContext("2d")!;
  g.drawImage(fr, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = light.alpha;
  g.fillStyle = light.tint;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(fr, { key, c });
  return c;
}

function bubble(g: CanvasRenderingContext2D, a: Actor, text: string) {
  g.font = "10px VT323, monospace";
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (g.measureText(`${cur} ${w}`).width > 110 && cur) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4);
  const bw = Math.max(...shown.map((l) => g.measureText(l).width)) + 10, bh = shown.length * 9 + 6;
  const x = Math.max(2, Math.min(W - bw - 2, Math.round(a.x - bw / 2))), y = Math.max(2, Math.round(a.y - 58 - bh));
  g.fillStyle = "rgba(250,246,232,.96)";
  g.fillRect(x, y, bw, bh);
  g.fillStyle = "#2a2018";
  g.fillRect(x, y - 1, bw, 1); g.fillRect(x, y + bh, bw, 1); g.fillRect(x - 1, y, 1, bh); g.fillRect(x + bw, y, 1, bh);
  g.fillStyle = "rgba(250,246,232,.96)";
  g.fillRect(Math.round(a.x) - 2, y + bh, 4, 3);
  g.fillStyle = "#2a2018";
  g.textAlign = "left";
  shown.forEach((l, i) => g.fillText(l, x + 5, y + 9 + i * 9));
}
