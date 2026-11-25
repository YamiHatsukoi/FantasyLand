/**
 * Stage: a section's living diorama (art/scene.ts) with its characters standing in it
 * (art/people.ts, art/creatures.ts) and the props of the story (art/props.ts). Used by the
 * reading screen (performed by ./director.ts), cutscenes and battles.
 *
 * The world is drawn at native resolution (320x180), then blitted through a camera (smooth pan
 * and zoom, shake) onto a 3x canvas, where text (speech bubbles, floating numbers) and
 * screen-wide effects (fades, flashes, darkness) are drawn crisp. Scenes can be swapped with a
 * crossfade (weather or time of day changing).
 */
import { creatureFrame, creatureSize, isCreature, type CPose } from "./art/creatures";
import { emoteFrame } from "./art/emotes";
import { isPersonActor, lookFor, personFrame, type Facing, type Look, type Pose } from "./art/people";
import { isLivingProp, propArt, type PropArt } from "./art/props";
import { makeScene, type SceneHandle, type SceneSpec } from "./art/scene";

export const W = 320;
export const H = 180;
/** Output canvas pixels per art pixel. */
export const OUT = 3;

/** A pose an actor holds (people + creatures + the stage-only kneel). */
export type StagePose = Pose | CPose | "kneel";

export interface Actor {
  id: string;
  /** Sprite id when it differs from `id` (several giaks: "giak", "giak#2"...). */
  sprite?: string;
  look?: Look;
  x: number;
  y: number;
  facing: Facing;
  pose: StagePose;
  /** Frame clock offset so actors don't breathe in sync. */
  phase: number;
  /** Play the pose once from this time (ms), then return to the held pose. */
  once?: { pose: Pose | CPose; at: number; ms: number };
  /** Movement target. */
  to?: { x: number; y: number; speed: number; done?: () => void };
  alpha?: number;
  flash?: number;
  shake?: number;
  bubble?: { text: string; until: number; at?: number };
  emote?: { kind: string; at: number; until: number };
  scale?: number;
  hidden?: boolean;
  /** Height above the ground (swooping in, jumping). */
  z?: number;
  /** Running: faster steps and dust. */
  run?: boolean;
  /** Lunge offset (attacks), eased back to 0. */
  lunge?: number;
}

export const isMonster = (id: string) => !isPersonActor(id) && isCreature(id);
const spriteOf = (a: Actor) => a.sprite ?? a.id;

export function actorFrame(a: Actor, t: number): HTMLCanvasElement {
  let pose = a.pose;
  const id = spriteOf(a);
  let f = Math.floor((t + a.phase) / (pose === "walk" || pose === "move" ? (a.run ? 85 : 130) : 420));
  if (a.once && t - a.once.at < a.once.ms) {
    pose = a.once.pose;
    f = Math.floor((t - a.once.at) / 110);
  }
  const kneel = pose === "kneel";
  if (kneel) pose = "idle";
  let fr: HTMLCanvasElement;
  if (isMonster(id)) {
    const p = (pose === "walk" ? "move" : pose === "cast" ? "attack" : pose) as CPose;
    fr = creatureFrame(id, p, f, a.facing === "right" ? "right" : "left");
  } else {
    const p = (pose === "move" ? "walk" : pose) as Pose;
    fr = personFrame(a.look ?? lookFor(id), a.facing, p, f);
  }
  return kneel ? kneeling(fr) : fr;
}

/** A crouched / kneeling version of a standing frame (upper body lowered, legs folded). */
const kneelCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function kneeling(fr: HTMLCanvasElement) {
  const hit = kneelCache.get(fr);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = fr.width; c.height = fr.height;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const hgt = fr.height, cut = Math.round(hgt * 0.64), drop = Math.round(hgt * 0.17);
  const legs = hgt - cut, folded = legs - drop;
  g.drawImage(fr, 0, cut, fr.width, legs, 0, hgt - folded, fr.width, folded);
  g.drawImage(fr, 0, 0, fr.width, cut, 0, drop, fr.width, cut);
  kneelCache.set(fr, c);
  return c;
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
  /** sq (default) | puff (soft growing blob) | streak (along its velocity) | rock (bounces) */
  shape?: "sq" | "puff" | "streak" | "rock";
  /** Growth of a puff per second (pixels). */
  grow?: number;
  /** Velocity kept per second (0..1), for drifting smoke. */
  drag?: number;
  /** Ground line where rocks bounce and drops stop. */
  floor?: number;
  /** Peak opacity. */
  a?: number;
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

/** An object of the story placed on the stage. */
export interface StageProp {
  id: string;
  word: string;
  state: string;
  x: number;
  y: number;
  alpha: number;
  born: number;
  flip?: boolean;
  to?: { x: number; speed: number };
}

/** A ground stain (blood, scorch...). */
interface Decal { c: HTMLCanvasElement; x: number; y: number; born: number; a: number }

interface Tween { obj: Record<string, number>; key: string; from: number; to: number; at: number; ms: number; ease: (k: number) => number; done?: () => void }

/** Something that keeps spawning particles until `until` (fire, smoke, rain of arrows...). */
export interface Emitter { id: string; until: number; tick: (dt: number, t: number) => void; fade?: number }

export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const easeOut = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);

export class Stage {
  canvas: HTMLCanvasElement;
  scene: SceneHandle;
  spec: SceneSpec;
  actors: Actor[] = [];
  props: StageProp[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  emitters: Emitter[] = [];
  /** Extra drawing on top of actors (projectiles...), world coordinates. */
  overlays: ((g: CanvasRenderingContext2D, t: number) => boolean)[] = [];
  /** Drawing on the output canvas (screen coordinates, OUT x), e.g. bolts of light. */
  screenFx: ((g: CanvasRenderingContext2D, t: number) => boolean)[] = [];
  /** Camera: the world point at the centre of the view and the zoom. */
  cam = { x: W / 2, y: H / 2, zoom: 1 };
  /** Screen overlays: fade to black (0..1), darkness (0..1), warm/cool tint. */
  look = { fade: 0, dark: 0, glow: 0 };
  /** Where a cropping box (StageFit) should centre the view, world x (default: the cast). */
  focusX?: number;
  /** Part of the view (screen art x, 0..W) the box shows: text stays inside it. */
  visibleX: [number, number] = [0, W];
  shakeUntil = 0;
  shakePower = 1;
  flashUntil = 0;
  flashCol = "#fff";
  flashMs = 120;
  private decals: Decal[] = [];
  private tweens: Tween[] = [];
  private old: { scene: SceneHandle; at: number; ms: number } | null = null;
  private buf: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private tmp: HTMLCanvasElement;
  private raf = 0;
  private alive = true;
  private last = 0;
  now = 0;

  constructor(spec: SceneSpec, cls = "adv-stage") {
    this.spec = spec;
    this.scene = makeScene(spec);
    this.canvas = document.createElement("canvas");
    this.canvas.className = cls;
    this.canvas.width = W * OUT;
    this.canvas.height = H * OUT;
    this.buf = document.createElement("canvas");
    this.buf.width = W;
    this.buf.height = H;
    this.g = this.buf.getContext("2d")!;
    this.g.imageSmoothingEnabled = false;
    this.tmp = document.createElement("canvas");
    this.tmp.width = W; this.tmp.height = H;
    this.now = performance.now();
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

  /** Swaps the diorama (same place, new weather / time...), crossfading over `ms`. */
  setScene(spec: SceneSpec, ms = 0) {
    const next = makeScene(spec);
    if (ms > 0) this.old = { scene: this.scene, at: this.now, ms };
    this.scene = next;
    this.spec = spec;
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
      if (a.pose === "idle" || a.pose === "kneel" || a.pose === "walk" || a.pose === "move") a.pose = "walk";
      if (x !== a.x) a.facing = x > a.x ? "right" : "left";
      const prev = a.to?.done;
      a.to = { x, y, speed, done: res };
      prev?.();
    });
  }

  /** Eases a number property to a value. */
  tween<T extends object>(obj: T, key: keyof T & string, to: number, ms: number, ease = easeInOut): Promise<void> {
    const o = obj as unknown as Record<string, number>;
    this.tweens = this.tweens.filter((tw) => {
      if (tw.obj === o && tw.key === key) { tw.done?.(); return false; }
      return true;
    });
    return new Promise((res) => {
      if (ms <= 0) { o[key] = to; res(); return; }
      this.tweens.push({ obj: o, key, from: o[key] ?? 0, to, at: this.now, ms, ease, done: res });
    });
  }

  /** Moves the camera (centre point, zoom) smoothly. */
  camTo(x: number, y: number, zoom: number, ms = 900, ease = easeInOut) {
    return Promise.all([this.tween(this.cam, "x", x, ms, ease), this.tween(this.cam, "y", y, ms, ease), this.tween(this.cam, "zoom", zoom, ms, ease)]);
  }

  /** Ends every movement and tween at once (the player tapped through). */
  settle() {
    for (const a of this.actors) {
      if (a.to) {
        const d = a.to.done;
        a.x = a.to.x; a.y = a.to.y; a.to = undefined;
        if (a.pose === "walk" || a.pose === "move") a.pose = "idle";
        a.run = false;
        d?.();
      }
      a.lunge = 0;
    }
    for (const p of this.props) if (p.to) { p.x = p.to.x; p.to = undefined; }
    const tws = this.tweens;
    this.tweens = [];
    for (const tw of tws) { tw.obj[tw.key] = tw.to; tw.done?.(); }
  }

  /** Screen x (art pixels, 0..W) where a world x is seen through the camera. */
  viewX(x: number) {
    const v = this.view();
    return (x - v.x0) * v.z;
  }

  private view() {
    const z = Math.max(1, this.cam.zoom);
    const vw = W / z, vh = H / z;
    const x0 = Math.max(0, Math.min(W - vw, this.cam.x - vw / 2));
    const y0 = Math.max(0, Math.min(H - vh, this.cam.y - vh / 2));
    return { z, x0, y0, vw, vh };
  }

  burst(x: number, y: number, col: string, n = 12, spread = 1.4, opts: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * spread;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 0, max: 420 + Math.random() * 300, col, size: Math.random() < 0.3 ? 2 : 1, g: 0.004, ...opts });
    }
  }

  emit(e: Emitter) {
    this.emitters = this.emitters.filter((x) => x.id !== e.id);
    this.emitters.push(e);
  }

  stopEmitter(id: string) {
    for (const e of this.emitters) if (e.id === id || id === "*") e.until = Math.min(e.until, this.now);
  }

  decal(c: HTMLCanvasElement, x: number, y: number) {
    this.decals.push({ c, x, y, born: this.now, a: 1 });
    if (this.decals.length > 24) this.decals.shift();
  }

  float(text: string, x: number, y: number, col: string, big = false) {
    this.floaters.push({ text, x, y, col, born: this.now, big });
  }

  shake(ms = 260, power = 1) { this.shakeUntil = this.now + ms; this.shakePower = power; }
  flash(col = "#fff", ms = 120) { this.flashCol = col; this.flashUntil = this.now + ms; this.flashMs = ms; }

  /** Top of an actor's head (world y), for emotes and bubbles. */
  headY(a: Actor) {
    const id = spriteOf(a);
    let top: number;
    if (isMonster(id)) {
      const s = creatureSize(id);
      top = a.y - s.h * 0.86 - (s.flying ? 18 : 0);
    } else top = a.y - (a.pose === "kneel" ? 36 : a.pose === "dead" ? 14 : 44);
    return top - (a.z ?? 0);
  }

  private frame(t: number) {
    const dt = Math.min(50, this.last ? t - this.last : 16);
    this.last = t;
    this.now = t;
    // tweens
    if (this.tweens.length) {
      const keep: Tween[] = [];
      for (const tw of this.tweens) {
        const k = Math.min(1, (t - tw.at) / tw.ms);
        tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
        if (k >= 1) tw.done?.(); else keep.push(tw);
      }
      this.tweens = keep;
    }
    const g = this.g, sc = this.scene;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    sc.draw(g, t);
    if (this.old) {
      const k = (t - this.old.at) / this.old.ms;
      if (k >= 1) this.old = null;
      else {
        const tg = this.tmp.getContext("2d")!;
        tg.imageSmoothingEnabled = false;
        tg.clearRect(0, 0, W, H);
        this.old.scene.draw(tg, t);
        g.globalAlpha = 1 - easeInOut(k);
        g.drawImage(this.tmp, 0, 0);
        g.globalAlpha = 1;
      }
    }
    // ground stains and flat props
    for (const d of this.decals) {
      g.globalAlpha = d.a * Math.min(1, (t - d.born) / 300);
      g.drawImage(d.c, Math.round(d.x - d.c.width / 2), Math.round(d.y - d.c.height / 2));
    }
    g.globalAlpha = 1;
    const light = sc.light(t);
    const standing: { y: number; draw: () => void }[] = [];
    for (const p of this.props) {
      if (p.to) {
        const dx = p.to.x - p.x, step = p.to.speed * dt;
        if (Math.abs(dx) <= step) { p.x = p.to.x; p.to = undefined; } else p.x += Math.sign(dx) * step;
      }
      const art = this.propSprite(p, t);
      const draw = () => {
        g.globalAlpha = p.alpha * Math.min(1, (t - p.born) / 260);
        const x = Math.round(p.x - art.c.width / 2), y = Math.round(p.y - art.c.height);
        if (!art.flat) {
          g.fillStyle = "rgba(0,0,0,.28)";
          g.beginPath(); g.ellipse(Math.round(p.x), Math.round(p.y) - 1, Math.max(5, art.c.width * 0.42), 2.5, 0, 0, Math.PI * 2); g.fill();
        }
        g.drawImage(art.flat ? art.c : tinted(art.c, light), x, y);
        g.globalAlpha = 1;
      };
      if (art.flat) draw(); else standing.push({ y: p.y - 0.5, draw });
    }
    // movement
    for (const a of this.actors) {
      if (a.lunge) a.lunge *= Math.pow(0.004, dt / 1000);
      if (Math.abs(a.lunge ?? 0) < 0.2) a.lunge = 0;
      if (!a.to) continue;
      const dx = a.to.x - a.x, dy = a.to.y - a.y, d = Math.hypot(dx, dy), step = a.to.speed * dt;
      if (a.run && !a.hidden && Math.random() < dt / 70 && (a.z ?? 0) < 2 && !creatureSize(spriteOf(a)).flying) {
        this.particles.push({ x: a.x - Math.sign(dx) * 4, y: a.y - 1, vx: -Math.sign(dx) * 0.3, vy: -0.25, life: 0, max: 500, col: "rgba(190,170,140,.7)", size: 2, shape: "puff", grow: 5, drag: 0.2 });
      }
      if (d <= step) {
        a.x = a.to.x; a.y = a.to.y;
        const done = a.to.done;
        a.to = undefined;
        if (a.pose === "walk" || a.pose === "move") a.pose = "idle";
        a.run = false;
        done?.();
      } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
    }
    // actors and standing props, back to front
    for (const a of this.actors) {
      if (a.hidden) continue;
      standing.push({ y: a.y + (a.pose === "dead" ? -0.2 : 0), draw: () => this.drawActor(g, a, t, light) });
    }
    standing.sort((p, q) => p.y - q.y);
    for (const s of standing) s.draw();
    this.overlays = this.overlays.filter((o) => o(g, t));
    // emitters + particles
    this.emitters = this.emitters.filter((e) => {
      if (t < e.until) { e.tick(dt, t); return true; }
      return false;
    });
    this.stepParticles(g, dt);
    sc.drawFront(g, t);
    if (this.old) {
      const k = (t - this.old.at) / this.old.ms;
      const tg = this.tmp.getContext("2d")!;
      tg.clearRect(0, 0, W, H);
      this.old.scene.drawFront(tg, t);
      g.globalAlpha = Math.max(0, 1 - easeInOut(k));
      g.drawImage(this.tmp, 0, 0);
      g.globalAlpha = 1;
    }
    // emotes ride on the world (pixel art), drawn last
    for (const a of this.actors) if (a.emote && !a.hidden) this.drawEmote(g, a, t);
    this.blit(t);
  }

  private propSprite(p: StageProp, t: number): PropArt {
    if (isLivingProp(p.word)) {
      const c = creatureFrame("horse", "idle", Math.floor((t + p.born) / 520), p.flip ? "right" : "left");
      return { c };
    }
    const art = propArt(p.word, p.state);
    return art;
  }

  private drawActor(g: CanvasRenderingContext2D, a: Actor, t: number, light: { tint: string; alpha: number }) {
    const id = spriteOf(a);
    const fr = actorFrame(a, t);
    const s = a.scale ?? 1;
    const w = fr.width * s, h = fr.height * s;
    const lift = a.z ?? 0;
    let x = Math.round(a.x - w / 2 + (a.lunge ?? 0) * (a.facing === "left" ? -1 : 1)), y = Math.round(a.y - h - lift);
    if (a.shake && t < a.shake) x += Math.round((Math.random() - 0.5) * 3);
    const flying = isMonster(id) && creatureSize(id).flying && a.pose !== "dead";
    if (flying) y -= 18 + Math.round(Math.sin((t + a.phase) / 300) * 3);
    const alpha = a.alpha ?? 1;
    // shadow (smaller the higher it is)
    const k = Math.max(0.3, 1 - (lift + (flying ? 18 : 0)) / 90);
    g.globalAlpha = 0.32 * alpha;
    g.fillStyle = "#000";
    g.beginPath();
    g.ellipse(Math.round(a.x), Math.round(a.y) - 1, Math.max(6, w * (a.pose === "dead" ? 0.45 : 0.3)) * k, 2.5 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = alpha;
    g.drawImage(tinted(fr, light), x, y, w, h);
    g.globalAlpha = 1;
    if (a.flash && t < a.flash) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.7 * alpha;
      g.drawImage(fr, x, y, w, h);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  }

  private drawEmote(g: CanvasRenderingContext2D, a: Actor, t: number) {
    const e = a.emote!;
    if (t > e.until) { a.emote = undefined; return; }
    const age = t - e.at;
    const fr = emoteFrame(e.kind, Math.floor(age / 240));
    const pop = age < 120 ? 0.4 + (age / 120) * 0.85 : age < 220 ? 1.25 - ((age - 120) / 100) * 0.25 : 1;
    const out = e.until - t < 220 ? Math.max(0, (e.until - t) / 220) : 1;
    const w = Math.round(fr.width * pop), h = Math.round(fr.height * pop);
    const bob = Math.round(Math.sin(age / 260) * 1);
    const x = Math.round(a.x - w / 2 + 3), y = Math.round(this.headY(a) - h - 2 + bob);
    g.globalAlpha = out * (a.alpha ?? 1);
    g.drawImage(fr, x, Math.max(1, y), w, h);
    g.globalAlpha = 1;
  }

  private stepParticles(g: CanvasRenderingContext2D, dt: number) {
    const s = dt / 1000;
    for (const p of this.particles) {
      p.life += dt;
      if (p.drag !== undefined) { const k = Math.pow(p.drag, s); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += (p.g ?? 0) * dt;
      if (p.floor !== undefined && p.y >= p.floor) {
        p.y = p.floor;
        if (p.shape === "rock" && Math.abs(p.vy) > 0.4) { p.vy = -p.vy * 0.35; p.vx *= 0.6; }
        else { p.vy = 0; p.vx *= 0.8; p.g = 0; }
      }
      if (p.grow) p.size += p.grow * s;
      const k = p.life / p.max;
      const fade = p.shape === "puff" ? Math.min(1, k * 5) * (1 - k) * 1.6 : 1 - k;
      g.globalAlpha = Math.max(0, Math.min(1, fade)) * (p.a ?? 1);
      if (p.glow) g.globalCompositeOperation = "lighter";
      g.fillStyle = p.col;
      if (p.shape === "puff") {
        g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2); g.fill();
      } else if (p.shape === "streak") {
        g.strokeStyle = p.col; g.lineWidth = 1;
        const v = Math.hypot(p.vx, p.vy) || 1;
        g.beginPath(); g.moveTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5); g.lineTo(Math.round(p.x - (p.vx / v) * p.size) + 0.5, Math.round(p.y - (p.vy / v) * p.size) + 0.5); g.stroke();
      } else if (p.shape === "rock") {
        const r = Math.round(p.size);
        g.fillStyle = "#2a2622"; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - r - 1, r + 2, r + 2);
        g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y) - r, r, r);
      } else g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  /** World → output canvas through the camera, then the crisp layers. */
  private blit(t: number) {
    const c = this.canvas.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    const v = this.view();
    let ox = 0, oy = 0;
    if (t < this.shakeUntil) {
      const p = this.shakePower * Math.min(1, (this.shakeUntil - t) / 160 + 0.3);
      ox = Math.round((Math.random() - 0.5) * 5 * OUT * p); oy = Math.round((Math.random() - 0.5) * 4 * OUT * p);
    }
    c.fillStyle = "#000";
    c.fillRect(0, 0, W * OUT, H * OUT);
    c.drawImage(this.buf, v.x0, v.y0, v.vw, v.vh, ox, oy, W * OUT, H * OUT);
    const S = OUT * v.z;
    const sx = (x: number) => (x - v.x0) * S + ox, sy = (y: number) => (y - v.y0) * S + oy;
    // darkness closing in / warm glow
    if (this.look.dark > 0.005) {
      const gr = c.createRadialGradient(W * OUT / 2, H * OUT * 0.62, H * OUT * 0.12, W * OUT / 2, H * OUT * 0.55, W * OUT * 0.62);
      gr.addColorStop(0, `rgba(4,2,10,${0.35 * this.look.dark})`);
      gr.addColorStop(1, `rgba(2,0,6,${0.92 * this.look.dark})`);
      c.fillStyle = gr; c.fillRect(0, 0, W * OUT, H * OUT);
    }
    if (this.look.glow > 0.005) {
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = this.look.glow * 0.35;
      const gr = c.createRadialGradient(W * OUT / 2, H * OUT * 0.5, 10, W * OUT / 2, H * OUT * 0.5, W * OUT * 0.6);
      gr.addColorStop(0, "#ffe0a0"); gr.addColorStop(1, "rgba(255,200,120,0)");
      c.fillStyle = gr; c.fillRect(0, 0, W * OUT, H * OUT);
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    }
    this.screenFx = this.screenFx.filter((f) => f(c, t));
    // floating numbers
    c.textAlign = "center";
    for (const f of this.floaters) {
      const age = (t - f.born) / 1000;
      c.font = `${(f.big ? 15 : 12) * OUT}px VT323, monospace`;
      c.globalAlpha = Math.max(0, 1 - age * 0.9);
      const x = sx(f.x), y = sy(f.y - age * 22);
      c.fillStyle = "#000";
      c.fillText(f.text, x + OUT, y + OUT);
      c.fillStyle = f.col;
      c.fillText(f.text, x, y);
    }
    c.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => t - f.born < 1100);
    // speech bubbles
    for (const a of this.actors) if (a.bubble && t < a.bubble.until && !a.hidden) speech(c, a.bubble, sx(a.x), sy(this.headY(a)), t, this.visibleX);
    if (t < this.flashUntil) {
      c.globalAlpha = 0.55 * Math.min(1, (this.flashUntil - t) / Math.max(60, this.flashMs * 0.7));
      c.fillStyle = this.flashCol; c.fillRect(0, 0, W * OUT, H * OUT); c.globalAlpha = 1;
    }
    if (this.look.fade > 0.003) { c.globalAlpha = Math.min(1, this.look.fade); c.fillStyle = "#000"; c.fillRect(0, 0, W * OUT, H * OUT); c.globalAlpha = 1; }
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

/** A speech bubble drawn crisp on the output canvas, pointing at the speaker's head. */
function speech(c: CanvasRenderingContext2D, b: NonNullable<Actor["bubble"]>, hx: number, hy: number, t: number, vis: [number, number]) {
  const K = OUT;
  c.font = `${9.5 * K}px VT323, monospace`;
  const words = b.text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (c.measureText(`${cur} ${w}`).width > 104 * K && cur) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = `${shown[2].replace(/[.,;:!?…]*$/, "")}…`;
  const age = b.at !== undefined ? t - b.at : 1000;
  const pop = age < 140 ? 0.6 + (age / 140) * 0.4 : 1;
  const bw = Math.max(...shown.map((l) => c.measureText(l).width)) + 10 * K, bh = shown.length * 8.5 * K + 5 * K;
  const v0 = vis[0] * K, v1 = vis[1] * K;
  let x = Math.round(hx - bw / 2), y = Math.round(hy - bh - 7 * K);
  x = Math.max(v0 + 3 * K, Math.min(v1 - bw - 3 * K, x));
  y = Math.max(2 * K, y);
  c.save();
  c.translate(hx, y + bh);
  c.scale(pop, pop);
  c.translate(-hx, -(y + bh));
  const ink = "#2a2018", paper = "rgba(252,248,236,.97)";
  // frame (pixel corners)
  c.fillStyle = ink;
  c.fillRect(x - K, y + K, bw + 2 * K, bh - 2 * K);
  c.fillRect(x, y, bw, bh);
  c.fillStyle = paper;
  c.fillRect(x, y + K, bw, bh - 2 * K);
  c.fillRect(x + K, y, bw - 2 * K, bh);
  c.fillStyle = "rgba(210,198,176,.95)";
  c.fillRect(x + K, y + bh - 2 * K, bw - 2 * K, K);
  // tail
  const tx = Math.max(x + 4 * K, Math.min(x + bw - 6 * K, hx - K));
  c.fillStyle = ink;
  c.fillRect(tx - K, y + bh, 4 * K, K); c.fillRect(tx, y + bh + K, 3 * K, K); c.fillRect(tx + K, y + bh + 2 * K, K, 2 * K);
  c.fillStyle = paper;
  c.fillRect(tx, y + bh - K, 2 * K, 2 * K); c.fillRect(tx + K, y + bh + K, K, K);
  c.fillStyle = ink;
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  shown.forEach((l, i) => c.fillText(l, x + 5 * K, y + 9 * K + i * 8.5 * K - K));
  c.restore();
}
