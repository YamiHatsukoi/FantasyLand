/**
 * Moves residents around the sanctuary. Built to stay smooth with hundreds of people:
 * - walkability comes from a flat occupancy grid, rebuilt only when buildings change;
 * - at most a couple of paths are computed per frame (the rest wait their turn, standing idle);
 * - sprites are cached per resident and only on-screen residents are drawn or given bubbles.
 * Nothing here is saved: positions are re-created each time the sanctuary is opened.
 */
import { Rng, hashString } from "../core/rng";
import type { Character, GameState } from "../core/state";
import { BUILDINGS } from "../data/buildings";
import { PAIR_TALK } from "../data/residentText";
import { personCanvas, type Dir } from "../render/people";
import { findPath } from "./mapgen";
import { ambientLine, profileOf, residents } from "./residents";
import { SPROUT, SZ_H, SZ_W, territory } from "./sanctuary";

export interface Agent {
  id: string;
  x: number;
  y: number;
  px: number;
  py: number;
  dir: Dir;
  flip: boolean;
  path: { x: number; y: number }[];
  state: "idle" | "walk" | "chat" | "wait" | "talk";
  timer: number;
  step: number;
  want?: { x: number; y: number };
  bubble?: { text: string; until: number };
  with?: Agent;
  pal?: Record<string, string>;
  frames: Map<number, HTMLCanvasElement>;
  rng: Rng;
}

const HOMES = ["house", "tent", "cottage", "stonehouse", "manor", "apartment", "palace"];
const SOCIAL = ["fountain", "park", "statue", "well", "tavern", "flowers", "tree", "market", "temple", "lamp", "arch"];
const WORK: Record<string, string[]> = {
  farmer: ["farm", "greenhouse", "herbgarden"], blacksmith: ["forge", "mine", "workshop"], innkeeper: ["tavern", "kitchen"],
  scholar: ["library", "academy"], priest: ["temple", "clinic"], herbalist: ["herbgarden", "alchemy", "clinic"],
  fisher: ["fishpond", "well"], guard: ["watchtower", "wall", "gate", "training"], hunter: ["barn", "coop", "training"],
  merchant: ["market", "warehouse"], bard: ["tavern", "fountain", "park"], mercenary: ["training", "watchtower"],
  adventurer: ["gate", "training", "tavern"], child: ["park", "fountain", "coop"], elder: ["temple", "park", "library"],
};
const MAX_PATHS_PER_FRAME = 2;
let shadow: HTMLCanvasElement | null = null;
const SHADOW = () => shadow ??= (() => {
  const c = document.createElement("canvas");
  c.width = 10; c.height = 3;
  const x = c.getContext("2d")!;
  x.fillStyle = "rgba(0,0,0,0.3)";
  x.fillRect(1, 0, 8, 3); x.fillRect(0, 1, 10, 1);
  return c;
})();
const STEP_TIME = 0.3;

export class ResidentSim {
  agents: Agent[] = [];
  private byId = new Map<string, Agent>();
  private occ = new Uint8Array(SZ_W * SZ_H);
  private occSig = "";
  private queue: Agent[] = [];
  private pois: { x: number; y: number; type: string }[] = [];
  private syncT = 0;

  constructor(private g: GameState) {
    this.rebuild();
    this.sync(true);
  }

  // ------------------------------------------------------------ world grid
  private signature() {
    let s = `${this.g.territory}|`;
    for (const b of this.g.buildings) s += `${b.type}${b.x},${b.y};`;
    return s;
  }
  private rebuild() {
    const g = this.g;
    this.occ.fill(0);
    const t = territory(g.territory);
    for (let y = t.y0; y < t.y1; y++) for (let x = t.x0; x < t.x1; x++) this.occ[y * SZ_W + x] = 1;
    this.occ[SPROUT.y * SZ_W + SPROUT.x] = 0;
    this.pois = [];
    for (const b of g.buildings) {
      const [w, h] = BUILDINGS[b.type].size;
      for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) if (x >= 0 && y >= 0 && x < SZ_W && y < SZ_H) this.occ[y * SZ_W + x] = 0;
    }
    for (const b of g.buildings) {
      const [w, h] = BUILDINGS[b.type].size;
      const door = { x: b.x + Math.floor(w / 2), y: b.y + h };
      if (this.walk(door.x, door.y)) this.pois.push({ ...door, type: b.type });
    }
    this.pois.push({ x: SPROUT.x + 1, y: SPROUT.y, type: "sprout" });
    this.occSig = this.signature();
  }
  walk = (x: number, y: number) => x >= 0 && y >= 0 && x < SZ_W && y < SZ_H && this.occ[y * SZ_W + x] === 1;

  // ------------------------------------------------------------ roster
  /** Adds new residents and removes departed ones. */
  sync(initial = false) {
    const list = residents(this.g);
    const ids = new Set(list.map((c) => c.id));
    this.agents = this.agents.filter((a) => ids.has(a.id));
    for (const a of [...this.byId.keys()]) if (!ids.has(a)) this.byId.delete(a);
    for (const ch of list) {
      if (this.byId.has(ch.id)) continue;
      const rng = new Rng(hashString(`agent:${ch.id}:${this.g.day}`));
      const spot = this.randomSpot(rng) ?? { x: SPROUT.x + 2, y: SPROUT.y + 1 };
      const a: Agent = {
        id: ch.id, x: spot.x, y: spot.y, px: spot.x, py: spot.y, dir: 0, flip: false, path: [], state: "idle",
        timer: initial ? rng.range(0.2, 4) : 0.5, step: 0, frames: new Map(), rng,
      };
      this.agents.push(a);
      this.byId.set(ch.id, a);
    }
  }
  private randomSpot(rng: Rng) {
    const t = territory(this.g.territory);
    for (let i = 0; i < 60; i++) {
      const x = rng.int(t.x0, t.x1 - 1), y = rng.int(t.y0, t.y1 - 1);
      if (this.walk(x, y)) return { x, y };
    }
    return null;
  }
  get(id: string) { return this.byId.get(id); }

  // ------------------------------------------------------------ behaviour
  private chooseGoal(a: Agent, ch: Character): { x: number; y: number } | null {
    const p = profileOf(ch);
    const r = a.rng.next();
    const pick = (types: string[]) => {
      const c = this.pois.filter((q) => types.includes(q.type));
      return c.length ? a.rng.pick(c) : null;
    };
    let goal = r < 0.4 ? pick(WORK[p.job] ?? []) : r < 0.55 ? pick(HOMES) : r < 0.85 ? pick([...SOCIAL, "sprout"]) : null;
    if (!goal) {
      // wander nearby
      for (let i = 0; i < 12 && !goal; i++) {
        const x = a.x + a.rng.int(-7, 7), y = a.y + a.rng.int(-7, 7);
        if (this.walk(x, y)) goal = { x, y, type: "" };
      }
    }
    if (!goal) return null;
    // spread out around the spot
    for (let i = 0; i < 6; i++) {
      const x = goal.x + a.rng.int(-2, 2), y = goal.y + a.rng.int(0, 2);
      if (this.walk(x, y)) return { x, y };
    }
    return this.walk(goal.x, goal.y) ? goal : null;
  }

  update(dt: number, now: number, visible: { x0: number; y0: number; x1: number; y1: number }, talkingTo: string | null) {
    if (this.signature() !== this.occSig) {
      this.rebuild();
      for (const a of this.agents) if (!this.walk(a.x, a.y)) { const s = this.randomSpot(a.rng); if (s) { a.x = a.px = s.x; a.y = a.py = s.y; } a.path = []; }
    }
    this.syncT += dt;
    if (this.syncT > 1.5) { this.syncT = 0; this.sync(); }
    // path requests, a few per frame
    let budget = MAX_PATHS_PER_FRAME;
    while (budget > 0 && this.queue.length) {
      const a = this.queue.shift()!;
      if (!a.want || a.state !== "wait") continue;
      const path = findPath({ w: SZ_W, h: SZ_H }, this.walk, a.x, a.y, a.want.x, a.want.y, 1200);
      a.want = undefined;
      budget--;
      if (path?.length) { a.path = path; a.state = "walk"; } else { a.state = "idle"; a.timer = a.rng.range(1, 3); }
    }
    let bubbles = 0;
    for (const a of this.agents) {
      const onScreen = a.x >= visible.x0 && a.x <= visible.x1 && a.y >= visible.y0 && a.y <= visible.y1;
      if (a.bubble && a.bubble.until > now) bubbles += onScreen ? 1 : 0;
      if (a.id === talkingTo) { a.state = "talk"; a.path = []; }
      else if (a.state === "talk") { a.state = "idle"; a.timer = 2; }
      switch (a.state) {
        case "idle": {
          a.timer -= dt;
          if (a.timer > 0) break;
          const ch = this.g.chars[a.id];
          if (!ch) break;
          // chat with a neighbour now and then
          const near = a.rng.chance(0.35) ? this.agents.find((o) => o !== a && o.state === "idle" && Math.abs(o.x - a.x) + Math.abs(o.y - a.y) <= 2) : undefined;
          if (near) { this.startChat(a, near, now, onScreen); break; }
          if (onScreen && bubbles < 5 && a.rng.chance(0.25)) {
            a.bubble = { text: ambientLine(this.g, ch, hashString(`${a.id}${Math.floor(now / 1000)}`)), until: now + 3200 };
            bubbles++;
          }
          const goal = this.chooseGoal(a, ch);
          if (goal) { a.want = goal; a.state = "wait"; this.queue.push(a); }
          else a.timer = a.rng.range(2, 5);
          break;
        }
        case "walk": {
          a.step += dt;
          if (a.step < STEP_TIME) break;
          a.step = 0;
          const next = a.path.shift();
          if (!next) { a.state = "idle"; a.timer = a.rng.range(3, 9); break; }
          if (!this.walk(next.x, next.y)) { a.path = []; a.state = "idle"; a.timer = 1; break; }
          if (next.x !== a.x) a.flip = next.x < a.x;
          a.dir = next.x !== a.x ? 2 : next.y < a.y ? 1 : 0;
          a.x = next.x; a.y = next.y;
          break;
        }
        case "chat": {
          a.timer -= dt;
          if (a.timer <= 0) { a.state = "idle"; a.timer = a.rng.range(2, 6); a.with = undefined; }
          break;
        }
        default: break;
      }
      const k = Math.min(1, dt / STEP_TIME * 1.1);
      a.px += (a.x - a.px) * k;
      a.py += (a.y - a.py) * k;
    }
  }

  private startChat(a: Agent, b: Agent, now: number, onScreen: boolean) {
    const [la, lb] = a.rng.pick(PAIR_TALK);
    const hero = this.g.chars[this.g.heroId].name;
    a.state = b.state = "chat";
    a.with = b; b.with = a;
    a.timer = b.timer = a.rng.range(4, 7);
    a.dir = b.dir = 2;
    a.flip = b.x < a.x; b.flip = a.x < b.x;
    if (onScreen) {
      a.bubble = { text: la.replace("{p}", hero), until: now + 2600 };
      b.bubble = { text: lb.replace("{p}", hero), until: now + 5200 };
    }
  }

  /** Resident standing at (or just below) a tapped tile. */
  agentAt(tx: number, ty: number): Agent | undefined {
    let best: Agent | undefined, bd = 1.1;
    for (const a of this.agents) {
      const d = Math.min(Math.hypot(a.px - tx, a.py - ty), Math.hypot(a.px - tx, a.py - 1 - ty));
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** Sprite of an agent (with its shadow, already mirrored when facing left), cached until their look changes. */
  sprite(a: Agent, ch: Character, now: number): HTMLCanvasElement {
    if (a.pal !== ch.pal) { a.pal = ch.pal; a.frames.clear(); }
    const moving = a.state === "walk" && Math.abs(a.px - a.x) + Math.abs(a.py - a.y) > 0.05;
    const frame = moving ? Math.floor(now / 150) % 4 : 0;
    const flip = a.dir === 2 && a.flip;
    const key = a.dir * 8 + frame * 2 + (flip ? 1 : 0);
    let c = a.frames.get(key);
    if (!c) {
      const src = personCanvas(ch.sprite, ch.pal, a.dir, frame);
      c = document.createElement("canvas");
      c.width = 16; c.height = 32;
      const x = c.getContext("2d")!;
      x.drawImage(SHADOW(), 3, 28);
      if (flip) { x.translate(16, 0); x.scale(-1, 1); }
      x.drawImage(src, 0, 0);
      a.frames.set(key, c);
    }
    return c;
  }
}
