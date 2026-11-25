/**
 * Battle screen (Lone Wolf rules): the section's scene as the arena, the hero against each foe
 * in turn. Every round is a short choreographed exchange:
 *
 *  1. the fate reel spins over the arena and lands on the round's random number;
 *  2. a mind attack (Mindblast / Psi-surge / Kai-surge) charges and flies, if in use;
 *  3. the blows play out in the order that makes the round's outcome read at a glance: the
 *     side that wins the exchange (per the Combat Results Table) strikes last; a side that
 *     takes no damage parries or dodges; nobody hurt = a clash of blades;
 *  4. damage numbers pop, bars drain, the loser reels; deaths, next foes, victory and defeat
 *     each get their own animation.
 *
 * The rules live in ./engine (playRound decides the round before the show starts); this file
 * only stages it. Fighters are drawn here (not as Stage actors) so they can squash, rotate,
 * leave afterimages and dissolve; effects come from ./art/fx. Everything runs on a battle
 * clock that fast mode speeds up and hit-stop freezes.
 */
import "./fight.css";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { h, nn } from "../ui/dom";
import { creatureFrame, creatureKey, creatureSize, type CPose } from "./art/creatures";
import { arrowHead, darkOrbHead, digitsSprite, disc, ease, FxLayer, ring, type Ease } from "./art/fx";
import { iconEl, uiIcon } from "./art/icons";
import { lookFor, personFrame, portrait, withWeapon, type Look, type Pose, type WeaponKind } from "./art/people";
import { battleExit, canEvade, epMax, heroCs, itemName, playRound, profile, startBattle, type Battle, type RoundResult } from "./engine";
import { isMonster, OUT, Stage, H as SH, W as SW } from "./stage";
import type { AdvState, Book, FoeDef } from "./types";
import { bump, gameBtn, StageFit } from "./ui";

const HERO_X = 96;
const FOE_X = 224;
const MIND_IMMUNE = ["mindblast", "psisurge", "kaisurge"];
const SPEED_KEY = "adv-fight-speed";

// ------------------------------------------------------------------ fighters' styles

type Style = "arc" | "over" | "thrust" | "staff" | "bow" | "fist";
const styleOf = (w: WeaponKind): Style =>
  w === "spear" || w === "dagger" ? "thrust"
    : w === "axe" || w === "mace" || w === "warhammer" ? "over"
      : w === "bow" ? "bow"
        : w === "quarterstaff" || w === "staff" ? "staff"
          : w === "none" ? "fist" : "arc";

type FoeMove = "spear" | "slash" | "swoop" | "leap" | "mindbolt" | "drain" | "maul" | "smash" | "strike" | "bite" | "shoot" | "punch" | "over";
type Bits = "blood" | "ichor" | "smoke" | "bone" | "ghost";

/** How a foe fights, bleeds and dies. */
interface FoeKit {
  move: FoeMove;
  bits: Bits;
  blood: string;
  blood2: string;
  /** Weapon trail colour of slashes. */
  trail: string;
  death: "collapse" | "dissolve" | "fall" | "heavy";
  person: boolean;
  w: number;
  h: number;
  flying: boolean;
  big: boolean;
  /** Mind bolt / magic colour. */
  magic: string;
  /** Strikes leave dark wisps that drain the hero. */
  drains: boolean;
  /** Breathes fire (dragons, wyrms): every other attack is a jet of flame. */
  breath?: boolean;
  /** Ice instead of fire (frost wyrms). */
  frost?: boolean;
}

function foeKit(def: FoeDef): FoeKit {
  const id = def.actor ?? def.name;
  const person = !isMonster(id);
  const key = person ? "" : creatureKey(id);
  const name = `${def.name} ${id}`.toLowerCase();
  const sz = person ? { w: 32, h: 48, flying: false } : creatureSize(id);
  const big = sz.w * sz.h >= 4400;
  const kit: FoeKit = { move: "slash", bits: "blood", blood: "#b81e1a", blood2: "#6a0e0a", trail: "#ffd8c8", death: "collapse", person, w: sz.w, h: sz.h, flying: sz.flying, big, magic: "#b060ff", drains: false };
  if (person) {
    const L = lookFor(id);
    const st = styleOf(L.weapon);
    kit.move = L.weapon === "staff" ? "mindbolt" : st === "thrust" ? "spear" : st === "over" ? "over" : st === "bow" ? "shoot" : st === "fist" ? "punch" : "slash";
    kit.magic = L.magic;
    return kit;
  }
  const k = key;
  if (/^giak/.test(k) || k === "kakarmi") Object.assign(kit, { move: "spear", blood: "#7a1a16", blood2: "#3a2a2e" });
  else if (k === "gourgaz") Object.assign(kit, { move: "slash", blood: "#4a7a2a", blood2: "#2a4a1a", bits: "ichor" });
  else if (/kraan|bat|raven|bird|winged-serpent|dragon/.test(k)) Object.assign(kit, { move: "swoop", blood: k === "dragon" ? "#c83a1a" : "#5a7a2a", blood2: "#2a3a1a", bits: k === "dragon" ? "blood" : "ichor" });
  else if (/doomwolf|wolf|mountain-cat/.test(k)) Object.assign(kit, { move: "leap" });
  else if (k === "vordak" || k === "helghast") Object.assign(kit, { move: k === "helghast" || /helghast/.test(name) ? "drain" : "mindbolt", bits: "smoke", blood: "#6a3aa8", blood2: "#24123a", trail: "#c08aff", death: "dissolve", drains: k === "helghast" || /helghast/.test(name), magic: k === "helghast" ? "#7affc8" : "#b060ff" });
  else if (k === "drakkar") Object.assign(kit, { move: "slash", trail: "#ff8a7a" });
  else if (/skeleton/.test(k)) Object.assign(kit, { move: "slash", bits: "bone", blood: "#e8e0c8", blood2: "#a89a80", trail: "#d8f0c0", death: "dissolve" });
  else if (k === "ghost") Object.assign(kit, { move: "drain", bits: "ghost", blood: "#9ae0ff", blood2: "#3a6a8a", trail: "#bfefff", death: "dissolve", drains: true, magic: "#8ae0ff" });
  else if (k === "zombie" || k === "crypt-spawn") Object.assign(kit, { move: "drain", bits: "ichor", blood: "#5a7a3a", blood2: "#2a3a1a", trail: "#a0c080", death: "dissolve", drains: true, magic: "#7ac050" });
  else if (/bear/.test(k)) Object.assign(kit, { move: "maul" });
  else if (k === "troll" || k === "giant") Object.assign(kit, { move: "smash", blood: k === "troll" ? "#4a6a2a" : "#b81e1a", bits: k === "troll" ? "ichor" : "blood", death: "heavy" });
  else if (k === "demon") Object.assign(kit, { move: "slash", blood: "#ff6a20", blood2: "#7a1a0a", trail: "#ffb060" });
  else if (/snake|marshviper/.test(k)) Object.assign(kit, { move: "strike", blood: "#8ac02a", blood2: "#3a5a1a", bits: "ichor" });
  else if (/spider|burrowcrawler/.test(k)) Object.assign(kit, { move: "bite", blood: "#7ac03a", blood2: "#2a4a1a", bits: "ichor" });
  else if (/rat|beast|horse/.test(k)) Object.assign(kit, { move: "bite" });
  else if (big) kit.move = "smash";
  if (def.undead && kit.death === "collapse") { kit.death = "dissolve"; kit.drains = kit.move === "slash"; }
  if (kit.flying) kit.death = "fall";
  else if (big && kit.death === "collapse") kit.death = "heavy";
  if (kit.move === "maul" || kit.move === "smash") kit.big = true;
  if (k === "dragon" || /dragon|wyrm|rồng|fire-?breath|phun lửa/.test(name)) { kit.breath = true; kit.frost = /frost|ice|băng|tuyết/.test(name); }
  return kit;
}

// ------------------------------------------------------------------ puppets (fighters on stage)

interface Anim { pose: Pose | CPose; seq: number[]; t0: number; ms: number; loop?: boolean; hold?: boolean }
interface Ghost { x: number; y: number; fr: HTMLCanvasElement; t: number }
interface Pup {
  id: string;
  look?: Look;
  monster: boolean;
  x: number;
  /** Ground line. */
  y: number;
  /** Height above the ground (jumps, dives). */
  z: number;
  /** Flyers hover this high. */
  hover: number;
  /** Knockback / sway offset. */
  kx: number;
  facing: "left" | "right";
  pose: Pose | CPose;
  f: number;
  anim?: Anim;
  phase: number;
  alpha: number;
  flashUntil: number;
  flashCol: string;
  flashA: number;
  rot: number;
  sx: number;
  sy: number;
  hidden: boolean;
  dissolve: number;
  /** Afterimage colour while dashing, "" = none. */
  ghost: string;
  ghosts: Ghost[];
  ghostAt: number;
  shakeUntil: number;
  /** Coloured glow behind the sprite (charge-ups). */
  aura: string;
}

const silCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
/** The frame as a flat silhouette of one colour (flashes, afterimages). */
function silhouette(fr: HTMLCanvasElement, col: string) {
  let m = silCache.get(fr);
  if (!m) { m = new Map(); silCache.set(fr, m); }
  let c = m.get(col);
  if (!c) {
    c = document.createElement("canvas");
    c.width = fr.width; c.height = fr.height;
    const g = c.getContext("2d")!;
    g.drawImage(fr, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    m.set(col, c);
  }
  return c;
}

const tintCache = new WeakMap<HTMLCanvasElement, { key: string; c: HTMLCanvasElement }>();
/** Frame graded by the scene light (as the Stage does for its actors). */
function lit(fr: HTMLCanvasElement, light: { tint: string; alpha: number }) {
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

const hash2 = (x: number, y: number) => {
  let n = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
let dissolveBuf: HTMLCanvasElement | null = null;
/** The frame with pixels eaten away from the top down (undead turning to smoke). */
function dissolved(fr: HTMLCanvasElement, k: number) {
  const c = dissolveBuf ?? (dissolveBuf = document.createElement("canvas"));
  c.width = fr.width; c.height = fr.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(fr, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (!d[i + 3]) continue;
    const n = hash2(x >> 1, y >> 1) * 0.65 + (1 - y / c.height) * 0.35;
    if (n < k * 1.05) d[i + 3] = 0;
    else if (n < k * 1.05 + 0.06) { d[i] = 220; d[i + 1] = 190; d[i + 2] = 255; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function pupFrame(p: Pup): HTMLCanvasElement {
  if (p.monster) {
    const pose = (p.pose === "walk" ? "move" : p.pose === "cast" ? "attack" : p.pose) as CPose;
    return creatureFrame(p.id, pose, p.f, p.facing);
  }
  const pose = (p.pose === "move" ? "walk" : p.pose) as Pose;
  return personFrame(p.look ?? lookFor(p.id), p.facing, pose, p.f);
}

// ------------------------------------------------------------------ HUD bars

function bar(cls: string) {
  const fill = h("i");
  const ghost = h("u");
  const label = h("b");
  const el = h("div", { class: `adv-bar ${cls}` }, h("div", { class: "adv-bar-track" }, ghost, fill), label);
  let prev = -1;
  let timer = 0;
  return {
    el,
    set: (v: number, max: number) => {
      const p = `${Math.max(0, Math.min(100, (100 * v) / max))}%`;
      fill.style.width = p;
      clearTimeout(timer);
      if (prev >= 0 && v < prev) {
        // the lost part flashes and lingers, then drains (fighting-game style)
        bump(el, "hit");
        timer = window.setTimeout(() => { ghost.style.width = p; }, 420);
      } else ghost.style.width = p;
      el.classList.toggle("low", v > 0 && v / max <= 0.3);
      prev = v;
      label.textContent = `${Math.max(0, v)}/${max}`;
    },
  };
}

export interface FightResult {
  battle: Battle;
  /** Section to go to, "" to stay (choices/random follow), null = death. */
  exit: string | null;
}

type Outcome = "hit" | "miss" | "clash";

export function runFight(host: HTMLElement, book: Book, s: AdvState, onChange: () => void): Promise<FightResult> {
  playMusic("battle");
  sfx("encounter", "normal");
  const sec = book.sections[s.section];
  const c = sec.combat!;
  const b = startBattle(book, s, sec);
  const prof = profile(book);
  const heroLook = withWeapon("lonewolf", s.weapons[0] ?? s.special.find((id) => id === "Sommerswerd" || !!book.items[id]?.weapon));
  const heroStyle = styleOf(heroLook.weapon);
  const golden = !!heroLook.blade;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  return new Promise((resolve) => {
    const stage = new Stage({ bg: sec.scene.bg, time: sec.scene.time, weather: sec.scene.weather, mood: "combat", seed: `${book.id}-${s.section}` }, "adv-stage battle");
    const gy = stage.scene.groundY;
    stage.actors = [];
    const fx = new FxLayer(gy);
    fx.popTop = 50;
    const kits = b.foes.map((f) => foeKit(f.def));

    const pup = (id: string, x: number, facing: "left" | "right", o: Partial<Pup> = {}): Pup => ({
      id, monster: isMonster(id), x, y: gy, z: 0, hover: 0, kx: 0, facing, pose: "idle", f: 0, phase: 0, alpha: 1, flashUntil: 0, flashCol: "#fff", flashA: 0.7,
      rot: 0, sx: 1, sy: 1, hidden: false, dissolve: 0, ghost: "", ghosts: [], ghostAt: 0, shakeUntil: 0, aura: "", ...o,
    });
    const hero = pup("lonewolf", HERO_X, "right", { look: heroLook, monster: false });
    const foes = b.foes.map((f, i) => pup(f.def.actor ?? f.def.name, i === 0 ? FOE_X : SW + 60, "left", { phase: 300 * i, hover: kits[i].flying ? 18 : 0, hidden: i > 0 }));
    const pups = [hero, ...foes];

    // ---------------------------------------------------------------- DOM
    const heroBar = bar("hero");
    const foeBar = bar("foe");
    const foeName = h("div", { class: "adv-fname" });
    const foeCs = h("div", { class: "adv-fcs" });
    const ratioEl = h("div", { class: "adv-ratio fr-panel" });
    // the fate reel: its own little pixel canvas docked under the ratio chip (always in view)
    const RW = 40, RH = 40;
    const reelCv = h("canvas", { class: "adv-freel", width: String(RW * OUT), height: String(RH * OUT) }) as HTMLCanvasElement;
    const csList = h("div", { class: "adv-cs-list" });
    const wheel = h("div", { class: "adv-wheel" }, ...Array.from({ length: 10 }, (_, i) => h("span", { "data-n": String(i) }, String(i))));
    const log = h("div", { class: "adv-flog" });
    const actions = h("div", { class: "adv-factions" });
    const banner = h("div", { class: "adv-fbanner" });
    const card = h("div", { class: "adv-fcard" });
    const arena = h("div", { class: "adv-fight-scene" });
    const heroFace = iconEl(portrait(heroLook), 2, "adv-face");
    const faceBox = h("span", { class: "adv-fface" }, heroFace);
    let speed = 1;
    try { speed = localStorage.getItem(SPEED_KEY) === "2" ? 2 : 1; } catch { /* private mode */ }
    let auto = false;
    const speedBtn = h("button", { class: "adv-ftog fr-btn", type: "button", title: "Tốc độ ×2", "aria-pressed": "false", onclick: () => { speed = speed === 2 ? 1 : 2; try { localStorage.setItem(SPEED_KEY, String(speed)); } catch { /* ignore */ } sfx("click"); syncToggles(); } }, "×2");
    const autoBtn = h("button", { class: "adv-ftog adv-fauto fr-btn", type: "button", title: "Tự đánh", "aria-pressed": "false", onclick: () => { auto = !auto; sfx("click"); syncToggles(); if (auto && !busy && !b.over) void round(false); } }, "Tự đánh");
    const syncToggles = () => {
      speedBtn.classList.toggle("on", speed === 2); speedBtn.setAttribute("aria-pressed", String(speed === 2));
      autoBtn.classList.toggle("on", auto); autoBtn.setAttribute("aria-pressed", String(auto));
    };
    syncToggles();
    const el = h("div", { class: "adv-fight" },
      h("div", { class: "adv-fight-stage" }, arena, h("div", { class: "adv-scene-shade" }), h("div", { class: "adv-fvig" }),
        h("div", { class: "adv-fhud" },
          h("div", { class: "adv-fside hero fr-chip" }, faceBox, h("div", null, h("div", { class: "adv-fname" }, s.name), heroBar.el)),
          h("div", { class: "adv-fmid" }, ratioEl, reelCv),
          h("div", { class: "adv-fside foe fr-foe" }, h("div", null, foeName, foeBar.el, foeCs))),
        card, banner),
      h("div", { class: "adv-fpanel fr-panel" },
        h("div", { class: "adv-fpanel-t" }, h("span", null, "Bốc số mỗi hiệp"), h("div", { class: "adv-ftogs" }, speedBtn, autoBtn)),
        csList, wheel, log, actions));
    host.append(el);
    // the camera frames the two home spots, not the fighters running about
    // (a fixed focus: zoom punches must not make the fitter pan)
    const anchors = { canvas: stage.canvas, scene: stage.scene, actors: [], focusX: (HERO_X + FOE_X) / 2, viewX: (x: number) => x } as unknown as Stage;
    const fit = new StageFit(arena, anchors, { minVis: 0.62, anchorY: 0.82 });

    const say = (t: string, cls = "") => {
      log.prepend(h("div", { class: cls }, t));
      while (log.childElementCount > 3) log.lastElementChild!.remove();
    };

    // ---------------------------------------------------------------- battle clock
    let alive = true;
    let clock = 0;
    let timeScale = 1;
    let stopUntil = 0;
    let lastT = 0;
    const waits: { at: number; res: () => void }[] = [];
    const tweens: { t0: number; dur: number; upd: (k: number) => void; res: () => void }[] = [];
    const wait = (ms: number) => new Promise<void>((res) => waits.push({ at: clock + ms, res }));
    const tween = (dur: number, upd: (k: number) => void, e: Ease = ease.outQuad) =>
      new Promise<void>((res) => { upd(0); tweens.push({ t0: clock, dur, upd: (k) => upd(e(k)), res }); });
    /** Tween a set of numeric props of an object. */
    const to = <T extends object>(o: T, props: Partial<Record<keyof T, number>>, dur: number, e: Ease = ease.outQuad) => {
      const from: Record<string, number> = {};
      const tgt = props as Record<string, number>;
      for (const k in tgt) from[k] = (o as Record<string, number>)[k];
      return tween(dur, (k) => { for (const p in tgt) (o as Record<string, number>)[p] = from[p] + (tgt[p] - from[p]) * k; }, e);
    };
    const hitStop = (ms: number) => { stopUntil = Math.max(stopUntil, stage.now + ms / speed); };
    fx.onShake = (amp, ms) => { if (!reduced) stage.shake(ms / speed, amp * 0.42); };
    const zoom = { k: 1, x: SW / 2, y: SH / 2 };
    const punch = (k: number, x: number, y: number, ms = 280) => {
      if (reduced) return;
      zoom.x = x; zoom.y = y;
      void tween(ms, (u) => { zoom.k = 1 + (k - 1) * (1 - u); }, ease.outCubic);
    };

    function play(p: Pup, pose: Pose | CPose, seq: number[], ms = 100, hold = false) {
      p.anim = { pose, seq, t0: clock, ms, hold };
      p.pose = pose; p.f = seq[0];
    }
    const hold = (p: Pup, pose: Pose | CPose, f: number) => play(p, pose, [f], 100, true);
    const run = (p: Pup, ms = 80) => { p.anim = { pose: "walk", seq: [0, 1, 2, 3], t0: clock, ms, loop: true }; };
    const idle = (p: Pup) => { p.anim = undefined; p.pose = "idle"; };
    const flash = (p: Pup, col = "#ffffff", ms = 90, a = 0.7) => { p.flashUntil = clock + ms; p.flashCol = col; p.flashA = a; };

    function update(dt: number) {
      clock += dt;
      fx.step(dt);
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        const k = Math.min(1, (clock - tw.t0) / tw.dur);
        tw.upd(k);
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      for (let i = waits.length - 1; i >= 0; i--) if (clock >= waits[i].at) { const w = waits[i]; waits.splice(i, 1); w.res(); }
      for (const p of pups) {
        const a = p.anim;
        if (a) {
          const idx = Math.floor((clock - a.t0) / a.ms);
          if (a.loop) { p.pose = a.pose; p.f = a.seq[idx % a.seq.length]; }
          else if (idx < a.seq.length) { p.pose = a.pose; p.f = a.seq[idx]; }
          else if (a.hold) { p.pose = a.pose; p.f = a.seq[a.seq.length - 1]; }
          else idle(p);
        }
        if (!p.anim) { p.pose = p.pose === "dead" ? "dead" : "idle"; p.f = Math.floor((clock + p.phase) / (p.monster ? 180 : 420)); }
        if (p.ghost && clock - p.ghostAt > 26) {
          p.ghostAt = clock;
          const fr = pupFrame(p);
          p.ghosts.push({ x: p.x + p.kx, y: p.y - p.z - p.hover, fr, t: clock });
        }
        p.ghosts = p.ghosts.filter((g) => clock - g.t < 170);
      }
    }

    function drawPup(g: CanvasRenderingContext2D, p: Pup, light: { tint: string; alpha: number }) {
      if (p.hidden) return;
      const fr = pupFrame(p);
      const bob = p.hover && p.pose !== "dead" ? Math.round(Math.sin((clock + p.phase) / 300) * 2) : 0;
      const shake = clock < p.shakeUntil ? Math.round((Math.random() - 0.5) * 3) : 0;
      const cx = Math.round(p.x + p.kx) + shake;
      const footY = Math.round(p.y - p.z - p.hover + bob);
      // shadow on the ground, smaller the higher the fighter is
      const lift = Math.max(0, p.z + p.hover);
      const sw = Math.max(5, fr.width * 0.28 * (1 - Math.min(0.55, lift / 60)));
      g.globalAlpha = 0.34 * p.alpha * (1 - Math.min(0.5, lift / 80));
      disc(g, Math.round(p.x + p.kx), p.y - 1, sw, "#000", 2);
      g.globalAlpha = 1;
      // afterimages
      for (const gh of p.ghosts) {
        const k = (clock - gh.t) / 170;
        g.globalAlpha = 0.3 * (1 - k) * p.alpha;
        g.drawImage(silhouette(gh.fr, p.ghost || "#9ad8ff"), Math.round(gh.x - gh.fr.width / 2), Math.round(gh.y - gh.fr.height));
      }
      g.globalAlpha = 1;
      let img: HTMLCanvasElement = lit(fr, light);
      if (p.dissolve > 0) img = dissolved(img, p.dissolve);
      const w = fr.width, hh = fr.height;
      g.save();
      g.translate(cx, footY);
      if (p.rot) { g.translate(0, -hh / 2); g.rotate(p.rot); g.translate(0, hh / 2); }
      if (p.sx !== 1 || p.sy !== 1) g.scale(p.sx, p.sy);
      if (p.aura) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.35 + Math.sin(clock / 40) * 0.12;
        const a = silhouette(fr, p.aura);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(a, Math.round(-w / 2) + dx, -hh + dy);
        g.globalCompositeOperation = "source-over";
      }
      g.globalAlpha = p.alpha;
      g.drawImage(img, Math.round(-w / 2), -hh);
      if (clock < p.flashUntil) {
        g.globalAlpha = p.flashA * p.alpha;
        g.drawImage(silhouette(fr, p.flashCol), Math.round(-w / 2), -hh);
      }
      g.restore();
      g.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- the fate reel (random number)
    const reel = { v: 0, alpha: 0, landAt: -1e9, n: -1, lastTick: 0 };
    const REEL_X = RW / 2, REEL_Y = RH / 2;
    function drawReel(g: CanvasRenderingContext2D) {
      if (reel.alpha <= 0.01) return;
      const bw = 26, bh = 30, x0 = Math.round(REEL_X - bw / 2), y0 = Math.round(REEL_Y - bh / 2);
      const landed = clock - reel.landAt;
      g.globalAlpha = reel.alpha;
      // frame: dark wood box with brass rim, bright while landing
      const rim = landed < 160 ? "#fff6c8" : "#e6b955";
      g.fillStyle = "#090604"; g.fillRect(x0 - 2, y0 - 2, bw + 4, bh + 4);
      g.fillStyle = rim; g.fillRect(x0 - 1, y0 - 1, bw + 2, bh + 2);
      g.fillStyle = "#3a2614"; g.fillRect(x0, y0, bw, bh);
      g.fillStyle = "#4a3220"; g.fillRect(x0, y0 + Math.round(bh / 2) - 1, bw, 2);
      // the digits roll downwards through the window
      g.save();
      g.beginPath(); g.rect(x0, y0, bw, bh); g.clip();
      const d = Math.floor(reel.v), frac = reel.v - d;
      const grad: [string, string, string] = ["#fff8d0", "#ffc83a", "#d85a14"];
      const spr = (n: number) => digitsSprite(String(((n % 10) + 10) % 10), 3, grad, "#120804");
      for (const [n, off] of [[d, frac], [d + 1, frac - 1]] as [number, number][]) {
        const sp = spr(n);
        const y = Math.round(REEL_Y - sp.height / 2 + off * bh);
        g.globalAlpha = reel.alpha;
        g.drawImage(sp, Math.round(REEL_X - sp.width / 2), y);
        if (reel.n < 0) { g.globalAlpha = reel.alpha * 0.3; g.drawImage(sp, Math.round(REEL_X - sp.width / 2), y - 4); }
      }
      // glass shine and shade at the window edges
      g.globalAlpha = reel.alpha * 0.55;
      g.fillStyle = "#000"; g.fillRect(x0, y0, bw, 3); g.fillRect(x0, y0 + bh - 3, bw, 3);
      g.globalAlpha = reel.alpha * 0.18;
      g.fillStyle = "#fff"; g.fillRect(x0 + 2, y0 + 3, 2, bh - 6);
      g.restore();
      // little pointers either side
      g.globalAlpha = reel.alpha;
      g.fillStyle = rim;
      for (let i = 0; i < 3; i++) { g.fillRect(x0 - 5 + i, REEL_Y - 2 + i, 1, 5 - i * 2); g.fillRect(x0 + bw + 4 - i, REEL_Y - 2 + i, 1, 5 - i * 2); }
      if (landed >= 0 && landed < 260) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = reel.alpha * (1 - landed / 260);
        ring(g, REEL_X, REEL_Y, 16 + landed / 14, "#ffd87a", 19 + landed / 14);
        g.globalCompositeOperation = "source-over";
      }
      g.globalAlpha = 1;
    }

    const cells = [...wheel.children] as HTMLElement[];
    const lightCell = (n: number) => cells.forEach((x) => x.classList.toggle("lit", Number(x.dataset.n) === n));
    async function spin(n: number) {
      el.classList.add("rolling");
      reel.n = -1;
      reel.landAt = -1e9;
      void to(reel, { alpha: 1 }, 90);
      const from = reel.v;
      const base = Math.floor(from) + 22;
      const target = base + ((n - (base % 10)) + 10) % 10;
      let shown = -1;
      await tween(360, (k) => {
        reel.v = from + (target - from) * k;
        const dd = ((Math.round(reel.v) % 10) + 10) % 10;
        if (dd !== shown) {
          shown = dd;
          lightCell(dd);
          if (performance.now() - reel.lastTick > 38) { reel.lastTick = performance.now(); sfx("blip", String(300 + dd * 30)); }
        }
      }, (k) => ease.outBack(k) * 0.985 + k * 0.015);
      reel.v = target;
      reel.n = n;
      reel.landAt = clock;
      lightCell(n);
      bump(cells[n], "won");
      el.classList.remove("rolling");
      sfx("coin");
      bump(reelCv, "land");
      void wait(420).then(hideReel);
      await wait(60);
    }
    const hideReel = () => to(reel, { alpha: 0 }, 260);

    // ---------------------------------------------------------------- the overlay: everything drawn per frame
    stage.overlays.push((g, t) => {
      if (!alive) return false;
      const real = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(t < stopUntil ? 0 : real * speed * timeScale);
      stage.cam.zoom = zoom.k;
      stage.cam.x = SW / 2 + (zoom.x - SW / 2) * Math.min(1, (zoom.k - 1) * 8);
      stage.cam.y = SH / 2 + (zoom.y - SH / 2) * Math.min(1, (zoom.k - 1) * 8);
      const light = stage.scene.light(t);
      fx.draw(g, "under");
      for (const p of [...pups].sort((a, q) => (a === hero ? 0.5 : 0) - (q === hero ? 0.5 : 0) + a.y - q.y)) drawPup(g, p, light);
      fx.draw(g, "over");
      return true;
    });
    // numbers, words, flashes and the reel: on the output canvas, crisp, outside the zoom
    stage.screenFx.push((g) => {
      if (!alive) return false;
      const z = Math.max(1, stage.cam.zoom), vw = SW / z, vh = SH / z;
      const x0 = Math.max(0, Math.min(SW - vw, stage.cam.x - vw / 2)), y0 = Math.max(0, Math.min(SH - vh, stage.cam.y - vh / 2));
      g.save();
      g.imageSmoothingEnabled = false;
      g.setTransform(OUT * z, 0, 0, OUT * z, -x0 * OUT * z, -y0 * OUT * z);
      fx.draw(g, "screen");
      g.restore();
      const rg = reelCv.getContext("2d")!;
      rg.setTransform(1, 0, 0, 1, 0, 0);
      rg.clearRect(0, 0, reelCv.width, reelCv.height);
      rg.imageSmoothingEnabled = false;
      rg.setTransform(OUT, 0, 0, OUT, 0, 0);
      drawReel(rg);
      return true;
    });

    // ---------------------------------------------------------------- geometry
    const kitOf = (p: Pup) => kits[foes.indexOf(p)];
    /** Half the foe's body width (where blows land / where to stand to strike it). */
    const bodyHalf = (p: Pup) => { const k = kitOf(p); return k.person ? 7 : Math.max(8, Math.min(22, k.w * 0.24)); };
    const foeHitPoint = (p: Pup): [number, number] => {
      const k = kitOf(p);
      return [p.x + p.kx - bodyHalf(p) * 0.4, gy - p.z - p.hover - Math.min(k.h * 0.45, 26)];
    };
    const foeTop = (p: Pup) => { const k = kitOf(p); return gy - p.z - p.hover - Math.min(k.h, 62) + (k.person ? 4 : 10); };
    const heroHitPoint = (): [number, number] => [hero.x + hero.kx + 2, gy - hero.z - 26];
    const meleeX = (p: Pup) => p.x - bodyHalf(p) - (heroStyle === "thrust" ? 20 : heroStyle === "fist" ? 11 : 14);
    let engaged = false;

    const heroGrad: [string, string, string] = ["#ffe8e0", "#ff7a6a", "#b01a12"];
    const heroCrit: [string, string, string] = ["#fff4e8", "#ff4a2a", "#8a0806"];
    const trailCol = golden ? "#ffd86a" : "#cfe6ff";
    const edgeCol = golden ? "#fff8d0" : "#ffffff";

    let curFoe = 0;
    /** ENDURANCE shown on the bars: they follow the show, not the rules (already applied). */
    let heroShown = s.ep;
    let foeShown = b.foes[0].ep;

    function lowCheck() {
      const low = heroShown > 0 && heroShown / epMax(book, s) <= 0.3;
      el.classList.toggle("low", low);
    }

    // ---------------------------------------------------------------- reactions
    function spill(p: Pup, x: number, y: number, dir: number, amount: number) {
      const k = kitOf(p);
      const n = 6 + Math.min(16, amount * 2);
      if (k.bits === "blood" || k.bits === "ichor") fx.blood(x, y, { dir, n, col: k.blood, col2: k.blood2, speed: 1.6 + amount * 0.12 });
      else if (k.bits === "bone") fx.debris(x, y, { n: Math.ceil(n / 2), cols: [k.blood, k.blood2, "#fff8e8"], dir: dir > 0 ? -40 : -140, spread: 70, speed: 2 });
      else if (k.bits === "smoke") { fx.smoke(x, y, { n: Math.ceil(n / 2), col: k.blood2, w: 4, h: 4, size: 2.2 }); fx.wisps(x, y, { n: Math.ceil(n / 2), col: k.blood, w: 4, h: 4 }); }
      else fx.wisps(x, y, { n, col: k.blood, col2: k.blood2, w: 5, h: 6, rise: 0.7 });
    }

    /** The foe takes a blow. kind tunes the spark colour; big = heavy hit (hit-stop, zoom, flash). */
    function foeHurt(p: Pup, dmg: number, big: boolean, kind: "blade" | "blunt" | "pierce" | "mind" | "fist") {
      const [x, y] = foeHitPoint(p);
      const k = kitOf(p);
      hitStop(big ? 110 : 55);
      flash(p, "#ffffff", big ? 90 : 60);
      play(p, "hurt", [0, 1, 1], 90);
      p.shakeUntil = clock + 200;
      const push = (big ? 12 : 6) * (k.big ? 0.45 : 1);
      void to(p, { kx: push }, 70, ease.outQuad).then(() => to(p, { kx: 0 }, 260, ease.inOutQuad));
      if (k.flying) void to(p, { z: p.z + (big ? 7 : 4) }, 80).then(() => to(p, { z: 0 }, 260, ease.inOutQuad));
      fx.impact(x, y, { r: big ? 15 : 9, col: golden ? "#ffe8a0" : "#fff3c0" });
      if (kind === "blade" || kind === "pierce") fx.sparks(x, y, { n: big ? 14 : 7, dir: -20, spread: 120, speed: big ? 3.2 : 2.2, col: golden ? "#ffe07a" : "#ffd27a" });
      if (kind === "blunt") fx.ring(x, y, { r1: big ? 18 : 12, dur: 240, col: "#ffe8c0", w: 2 });
      spill(p, x + 2, y, 1, dmg);
      fx.number(x + 6, foeTop(p) - 2, dmg, { crit: big });
      if (big) {
        punch(1.14, x, y);
        if (dmg >= 9 || foeShown - dmg <= 0) fx.flash("#ffffff", 70, 0.26);
        fx.shake(3, 220);
        sfx("crit");
        fx.ring(x, y, { r1: 26, dur: 260, col: "#ffffff", w: 2, glow: true });
      } else { fx.shake(1.5, 120); sfx("hit"); }
      foeShown -= dmg;
      foeBar.set(foeShown, b.foes[curFoe].def.ep);
      say(`Bạn gây ${dmg} sát thương cho ${b.foes[curFoe].def.name}.`, "good");
    }

    function heroHurt(dmg: number, big: boolean, col = "#ff5040") {
      const [x, y] = heroHitPoint();
      hitStop(big ? 110 : 55);
      flash(hero, "#ffffff", 50, 0.6);
      play(hero, "hurt", [0, 1, 1], 100);
      hero.shakeUntil = clock + 220;
      void to(hero, { kx: -(big ? 11 : 6) }, 70).then(() => to(hero, { kx: 0 }, 280, ease.inOutQuad));
      fx.impact(x, y, { r: big ? 14 : 9, col: "#ffd8c8" });
      fx.blood(x - 2, y, { dir: -1, n: 6 + Math.min(14, dmg * 2), col: "#c81e1a", col2: "#6a0a08" });
      fx.number(x - 4, gy - 58, dmg, { crit: big, grad: big ? heroCrit : heroGrad });
      if (big) { punch(1.12, x, y); if (dmg >= 9 || heroShown - dmg <= 0) fx.flash(col, 80, 0.24); fx.shake(3.5, 260); sfx("crit"); } else { fx.shake(2, 150); sfx("hit"); }
      heroShown -= dmg;
      heroBar.set(heroShown, epMax(book, s));
      bump(faceBox, "flinch");
      bump(el, "hurt");
      lowCheck();
      say(`Bạn mất ${dmg} Sức Bền.`, "bad");
    }

    function heroBlocks(p: Pup) {
      const [x, y] = heroHitPoint();
      const armed = heroStyle !== "fist";
      hitStop(40);
      if (armed) {
        fx.sparks(x + 7, y - 2, { n: 12, dir: 180, spread: 160, speed: 2.6 });
        fx.impact(x + 7, y - 2, { r: 7, col: "#d8f0ff" });
        fx.ring(x + 7, y - 2, { r1: 12, dur: 200, col: "#bfe8ff", w: 1 });
        sfx("shield");
        void to(hero, { kx: -4 }, 60).then(() => to(hero, { kx: 0 }, 200));
        fx.word(x + 4, gy - 58, "ĐỠ!", "#9ae6ff");
      } else {
        // unarmed: a quick sidestep
        void to(hero, { kx: -10, z: 3 }, 90).then(() => to(hero, { kx: 0, z: 0 }, 220, ease.inOutQuad));
        hero.ghost = "#9ad8ff";
        void wait(160).then(() => { hero.ghost = ""; });
        sfx("miss");
        fx.word(x, gy - 58, "NÉ!", "#9ae6ff");
      }
      void p;
    }

    function foeDodges(p: Pup) {
      const k = kitOf(p);
      p.ghost = "#ffb0a0";
      void to(p, { kx: k.big ? 5 : 12, z: k.flying ? p.z + 8 : 2 }, 90, ease.outQuad).then(async () => { await wait(90); await to(p, { kx: 0, z: 0 }, 240, ease.inOutQuad); p.ghost = ""; });
      sfx("miss");
      fx.word(p.x + 4, foeTop(p) - 4, "TRƯỢT", "#c8c0b8");
    }

    function clash(x: number, y: number, p: Pup) {
      hitStop(70);
      fx.sparks(x, y, { n: 20, spread: 360, speed: 3, col: "#ffe07a" });
      fx.impact(x, y, { r: 12, col: "#ffffff", rays: 10 });
      fx.ring(x, y, { r1: 20, dur: 260, col: "#fff0c0", w: 2, glow: true });
      fx.shake(2, 140);
      sfx("shield");
      sfx("slash");
      void to(hero, { kx: -8 }, 80).then(() => to(hero, { kx: 0 }, 260, ease.inOutQuad));
      void to(p, { kx: 8 }, 80).then(() => to(p, { kx: 0 }, 260, ease.inOutQuad));
      fx.word(x, y - 22, "ĐỠ!", "#ffe08a");
      say("Hai bên chạm vũ khí, không ai bị thương.");
    }

    // ---------------------------------------------------------------- hero moves
    async function engage(p: Pup) {
      if (engaged || heroStyle === "bow") return;
      engaged = true;
      const tx = meleeX(p);
      fx.dust(hero.x - 4, gy, { n: 5, dir: -1 });
      sfx("whoosh");
      run(hero, 55);
      hero.ghost = "#9ad8ff";
      if (heroStyle === "thrust") fx.speedLines(hero.x - 10, gy - 44, tx - hero.x + 20, 40, 1, { dur: 230, n: 8 });
      await to(hero, { x: tx }, 210, ease.outCubic);
      hero.ghost = "";
      fx.dust(hero.x + 4, gy, { n: 4, dir: 1, speed: 0.6 });
      idle(hero);
    }

    async function disengage() {
      const moves: Promise<void>[] = [];
      if (Math.abs(hero.x - HERO_X) > 1) {
        hero.facing = "right";
        play(hero, "walk", [1], 100, true);
        moves.push(to(hero, { x: HERO_X }, 190, ease.inOutQuad));
        moves.push(tween(190, (k) => { hero.z = Math.sin(k * Math.PI) * 6; }, ease.linear));
        void wait(190).then(() => fx.dust(HERO_X, gy, { n: 3, dir: 0, speed: 0.4 }));
      }
      const p = foes[curFoe];
      if (p && !p.hidden && p.pose !== "dead" && Math.abs(p.x - FOE_X) > 1) {
        p.facing = "left";
        moves.push(to(p, { x: FOE_X, z: 0 }, 200, ease.inOutQuad));
      }
      engaged = false;
      await Promise.all(moves);
      idle(hero);
      hero.z = 0;
    }

    /** The hero's blow with the weapon in hand. Resolves when the follow-through ends. */
    async function heroAttack(p: Pup, res: Outcome, dmg: number) {
      const big = dmg >= 6 || (res === "hit" && foeShown - dmg <= 0 && dmg >= 4);
      const land = () => {
        if (res === "hit") foeHurt(p, dmg, big, heroStyle === "over" ? "blunt" : heroStyle === "thrust" || heroStyle === "bow" ? "pierce" : heroStyle === "fist" ? "fist" : "blade");
        else if (res === "miss") foeDodges(p);
        else { const [x, y] = foeHitPoint(p); clash((hero.x + x) / 2 + 4, y, p); }
      };
      const [fx0, fy0] = foeHitPoint(p);
      switch (heroStyle) {
        case "arc": {
          await engage(p);
          play(hero, "attack", [0], 100, true);
          void to(hero, { kx: -2 }, 60);
          await wait(65);
          play(hero, "attack", [1, 2, 2, 3], 55);
          void to(hero, { kx: 3 }, 60);
          sfx("slash");
          void fx.slash(hero.x + 3, gy - 30, { r: 17, a0: -150, a1: 70, col: trailCol, edge: edgeCol, thick: big ? 5 : 4, dur: 220 });
          await wait(55);
          land();
          if (big && res === "hit") {
            await wait(110);
            play(hero, "attack", [0, 1, 2], 50);
            sfx("slash");
            void fx.slash(hero.x + 4, gy - 28, { r: 15, a0: 80, a1: -120, col: trailCol, edge: edgeCol, thick: 4, dur: 200 });
            await wait(60);
            fx.sparks(fx0, fy0, { n: 10, dir: -60, spread: 90, speed: 2.6 });
            fx.impact(fx0, fy0 - 4, { r: 10 });
          }
          await wait(90);
          void to(hero, { kx: 0 }, 100);
          break;
        }
        case "over": {
          await engage(p);
          play(hero, "attack", [0], 100, true);
          sfx("whoosh");
          await to(hero, { z: 13, kx: 3 }, 130, ease.outQuad);
          play(hero, "attack", [1], 100, true);
          void fx.slash(hero.x + 2, gy - 34 - hero.z, { r: 18, a0: -165, a1: -10, col: "#ffe8c0", edge: "#ffffff", thick: 3, dur: 160 });
          await wait(45);
          play(hero, "attack", [2], 100, true);
          await to(hero, { z: 0, kx: 6 }, 70, ease.inQuad);
          // the slam
          fx.shock(p.x - bodyHalf(p) - 2, gy, { r: big ? 30 : 22, n: big ? 18 : 12 });
          fx.shake(big ? 4 : 2.5, 220);
          sfx("break");
          land();
          await wait(130);
          play(hero, "attack", [3], 100);
          void to(hero, { kx: 0 }, 120);
          await wait(40);
          break;
        }
        case "thrust": {
          await engage(p);
          const dagger = heroLook.weapon === "dagger";
          const jabs = dagger ? (big ? 3 : 2) : 1;
          for (let j = 0; j < jabs; j++) {
            play(hero, "attack", [0], 100, true);
            await to(hero, { kx: -3 }, dagger ? 40 : 70);
            play(hero, "attack", [1], 100, true);
            sfx(j === jabs - 1 ? "slash" : "whoosh");
            fx.speedLines(hero.x - 18, gy - 34, 30, 14, 1, { dur: 140, n: 5 });
            void fx.thrust(hero.x + 4, gy - 27, fx0 + (res === "hit" ? 12 : 4), { dur: 150, w: big ? 2 : 1 });
            await to(hero, { kx: dagger ? 6 : 10 }, 55, ease.outExpo);
            if (j === jabs - 1) land();
            else { fx.impact(fx0, fy0, { r: 6 }); flash(p, "#fff", 50); sfx("hit"); }
            await wait(dagger ? 60 : 90);
          }
          play(hero, "attack", [2, 3], 80);
          await to(hero, { kx: 0 }, 160, ease.inOutQuad);
          break;
        }
        case "staff": {
          await engage(p);
          sfx("whoosh");
          void fx.whirl(hero.x + 2, gy - 28, { r: 15, dur: 330, turns: 1.6, col: "#e8d0a0" });
          play(hero, "attack", [0, 1, 2, 3], 55);
          await wait(220);
          play(hero, "attack", [1, 2, 3], 60);
          sfx("slash");
          void fx.slash(hero.x + 2, gy - 28, { r: 16, a0: -150, a1: 20, col: "#f0dcb0", edge: "#ffffff", thick: 3, dur: 180 });
          void to(hero, { kx: 4 }, 60);
          await wait(50);
          land();
          await wait(120);
          void to(hero, { kx: 0 }, 100);
          break;
        }
        case "fist": {
          await engage(p);
          for (let j = 0; j < 2; j++) {
            play(hero, "attack", [0], 100, true);
            await to(hero, { kx: -2 }, 50);
            play(hero, "attack", [1], 100, true);
            sfx(j ? "hit" : "whoosh");
            await to(hero, { kx: 5 }, 45, ease.outExpo);
            if (j === 1) land();
            else if (res === "hit") { fx.impact(fx0, fy0 + 2, { r: 6, rays: 6 }); flash(p, "#fff", 50); }
            play(hero, "attack", [3], 100, true);
            await wait(90);
          }
          await to(hero, { kx: 0 }, 120);
          break;
        }
        case "bow": {
          play(hero, "attack", [0], 100, true);
          await wait(70);
          play(hero, "attack", [1], 100, true);
          void fx.charge(hero.x + 12, gy - 29, { col: "#fff4c0", dur: 170, r: 10 });
          await wait(170);
          play(hero, "attack", [2, 2, 3], 90);
          sfx("bow");
          const x0 = hero.x + 12, y0 = gy - 29;
          const [tx, ty] = res === "miss" ? [SW + 30, fy0 - 26] : res === "clash" ? [fx0 - 8, fy0] : [fx0, fy0];
          const dur = Math.abs(tx - x0) * 1.9;
          fx.speedLines(x0, y0 - 6, 30, 12, 1, { dur: 120, n: 4 });
          if (res === "miss") { void wait(dur * 0.55).then(() => foeDodges(p)); }
          await fx.projectile(x0, y0, tx, ty, { dur, arc: res === "miss" ? 10 : 4, head: arrowHead, trail: "#fff0c0", trailLen: 6 });
          if (res === "hit") land();
          else if (res === "clash") {
            // the foe bats the arrow away
            play(p, "attack", [1, 2], 70);
            fx.sparks(tx, ty, { n: 12, dir: 200, spread: 120, speed: 2.4 });
            fx.impact(tx, ty, { r: 8 });
            sfx("shield");
            fx.word(tx, ty - 20, "ĐỠ!", "#ffe08a");
            void fx.projectile(tx, ty, tx - 30, gy - 2, { dur: 260, arc: 14, head: arrowHead });
          }
          await wait(100);
          break;
        }
      }
      if (!engaged) idle(hero);
    }

    // ---------------------------------------------------------------- mind attacks
    function mindSpec() {
      const m = prof.mind[b.mind];
      return m && s.disciplines.includes(m[0]) && !c.noMindblast ? m : null;
    }
    const MIND_COL: Record<string, [string, string]> = { mindblast: ["#c9a2ff", "#f4ecff"], psisurge: ["#ff7ae0", "#ffe4f8"], kaisurge: ["#ffe27a", "#fffbe8"] };

    async function mindStrike(p: Pup, immune: boolean, cost: number) {
      const m = mindSpec()!;
      const [col, core] = MIND_COL[m[0]] ?? MIND_COL.mindblast;
      const hx = hero.x + 2, hy = gy - 44;
      play(hero, "cast", [0, 1, 2], 80, true);
      hero.aura = col;
      void fx.glyph(hero.x, gy - 1, { r: 15, ry: 0.32, col, dur: 560, layer: "under" });
      sfx("cast", "light");
      await fx.charge(hx, hy, { col, dur: 170, r: 18 });
      hero.aura = "";
      if (cost > 0) { fx.number(hero.x - 8, gy - 60, cost, { small: true, grad: ["#ffffff", col, "#5a2a9a"] }); heroShown -= cost; heroBar.set(heroShown, epMax(book, s)); lowCheck(); }
      const [tx, ty] = foeHitPoint(p);
      sfx("whoosh");
      void fx.psiWave(hx + 4, hy + 6, tx, { col, col2: core, dur: 190, h: 11 });
      await wait(180);
      if (immune) {
        // the wave splashes on a dark ward around the foe
        fx.ring(tx + 4, ty, { r0: 10, r1: 16, dur: 360, col: "#8a8a9a", w: 2 });
        fx.sparks(tx - 6, ty, { n: 10, dir: 180, spread: 140, speed: 1.6, col: "#a0a0b0", col2: "#505060", glow: false });
        void to(p, { sy: 1.06 }, 90).then(() => to(p, { sy: 1 }, 200, ease.outQuad));
        fx.word(tx, foeTop(p) - 6, "MIỄN NHIỄM", "#b8b8c8", { size: 14, dur: 700 });
        sfx("shield");
        say(`${b.foes[curFoe].def.name} miễn nhiễm với tâm lực.`);
      } else {
        for (let i = 0; i < 3; i++) fx.ring(tx, ty - 4, { r0: 2 + i * 3, r1: 16 + i * 5, dur: 260 + i * 80, col: i ? col : core, w: 1, glow: true });
        fx.burst(tx, ty - 4, { n: 14, col, speed: 1.6, glow: true });
        flash(p, col, 110, 0.45);
        p.shakeUntil = clock + 160;
        fx.shake(1.5, 120);
        sfx("impact", "light");
      }
      play(hero, "cast", [2, 1], 60);
      await wait(70);
    }

    // ---------------------------------------------------------------- foe moves
    /** The foe comes to striking distance of the hero (if not already there). */
    async function approach(p: Pup, gap: number) {
      const tx = hero.x + hero.kx + gap;
      if (engaged || p.x - tx < 4) return;
      p.facing = "left";
      run(p, 60);
      p.ghost = "#ffb0a0";
      fx.dust(p.x + 4, gy, { n: 4, dir: 1 });
      await to(p, { x: tx }, Math.min(320, 120 + Math.abs(p.x - tx) * 1.3), ease.outCubic);
      p.ghost = "";
      idle(p);
    }

    /** A jet of flame from the mouth to the hero: glow, roaring cone, embers, scorch. */
    async function fireBreath(p: Pup, land: () => void, hx: number, hy: number) {
      const k = kitOf(p);
      // flame or frost: core, mid, outer colours and the ember tint
      const C = k.frost ? { core: "235,250,255", mid: "150,220,255", out: "80,160,255", a: "#bfefff", b: "#6ac8ff", ember: "#d8f6ff", smoke: "#8aa8c0" } : { core: "255,255,220", mid: "255,200,60", out: "255,120,20", a: "#ffd050", b: "#ff7a20", ember: "#ffb040", smoke: "#3a3236" };
      const mx = p.x - bodyHalf(p) - 2, my = gy - p.hover - p.z - Math.round(k.h * (k.flying ? 0.55 : 0.72));
      play(p, "attack", [0], 120, true);
      sfx("charge");
      await fx.charge(mx, my, { col: C.ember, dur: 260, r: 16 });
      play(p, "attack", [1, 2], 110, true);
      sfx("cast", k.frost ? "ice" : "fire");
      const dur = 620;
      void fx.add(dur, (g, k0) => {
        const grow = Math.min(1, k0 * 3), fade = k0 > 0.75 ? (1 - k0) / 0.25 : 1;
        const ex = mx + (hx - 4 - mx) * grow;
        g.save();
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          const w = (4 + i * 4) * (0.6 + 0.4 * grow);
          const gr = g.createLinearGradient(mx, my, ex, hy);
          gr.addColorStop(0, `rgba(${i === 0 ? C.core : C.mid},${(i === 0 ? 0.95 : 0.7 - i * 0.15) * fade})`);
          gr.addColorStop(1, `rgba(${C.out},${0.25 * fade})`);
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(mx, my - w * 0.3); g.lineTo(ex, hy - w - Math.sin(clock / 40 + i) * 2); g.lineTo(ex, hy + w + Math.cos(clock / 37 + i) * 2); g.lineTo(mx, my + w * 0.3);
          g.closePath(); g.fill();
        }
        g.restore();
      });
      for (let t = 0; t < dur - 120; t += 40) {
        const u = Math.min(1, t / 200);
        fx.burst(mx + (hx - mx) * u * 0.5, my + (hy - my) * u * 0.5, { n: 6, dir: hx < mx ? 180 : 0, spread: 26, speed: 3.4, col: Math.random() < 0.5 ? C.a : C.b, glow: true, size: 2, life: 380, g: -0.0004 });
        if (t === 200) { land(); fx.shake(3, 260); fx.flash(C.ember, 120, 0.35); }
        await wait(40);
      }
      fx.embers(hx, hy + 6, { n: 18, w: 10, col: C.ember, speed: 1 });
      fx.smoke(hx, hy - 4, { n: 6, col: C.smoke, w: 8, h: 4 });
      await wait(140);
      idle(p);
    }

    async function foeAttack(p: Pup, res: "hit" | "block", dmg: number) {
      const k = kitOf(p);
      const big = dmg >= 6 || (res === "hit" && heroShown - dmg <= 0);
      const land = () => (res === "hit" ? heroHurt(dmg, big) : heroBlocks(p));
      const [hx, hy] = heroHitPoint();
      const reach = bodyHalf(p) + 13;
      if (k.breath && Math.random() < 0.55) { await fireBreath(p, land, hx, hy); return; }
      switch (k.move) {
        case "spear": case "punch": {
          await approach(p, reach + (k.move === "spear" ? 8 : 0));
          play(p, "attack", [0], 100, true);
          await to(p, { kx: 3 }, 70);
          play(p, "attack", [1], 100, true);
          sfx(k.move === "spear" ? "slash" : "whoosh");
          if (k.move === "spear") void fx.thrust(p.x - bodyHalf(p) - 4, gy - 26, hx - 8, { col: "#ffe8d8", dur: 140 });
          fx.speedLines(p.x - 4, gy - 36, 26, 14, -1, { dur: 140, n: 5 });
          await to(p, { kx: -9 }, 60, ease.outExpo);
          land();
          play(p, "attack", [2, 3], 80);
          await wait(90);
          await to(p, { kx: 0 }, 110);
          break;
        }
        case "slash": case "over": {
          await approach(p, reach);
          play(p, "attack", [0], 100, true);
          await to(p, { kx: 3, z: k.move === "over" ? 8 : 0 }, 80);
          play(p, "attack", [1, 2, 2, 3], 60);
          sfx("slash");
          if (k.move === "over") {
            void fx.slash(p.x - 2, gy - 34 - p.z, { r: 18, a0: -165, a1: -10, dir: -1, col: k.trail, edge: "#ffffff", thick: 3, dur: 160 });
            await to(p, { z: 0, kx: -6 }, 70, ease.inQuad);
            fx.shock(hx + 8, gy, { r: 20 });
            sfx("break");
          } else {
            void fx.slash(p.x - 3, gy - 30, { r: 18, a0: -150, a1: 70, dir: -1, col: k.trail, edge: "#ffffff", thick: 4, dur: 210 });
            void to(p, { kx: -5 }, 60);
            await wait(55);
          }
          land();
          if (k.drains && res === "hit") drainWisps(p);
          await wait(130);
          await to(p, { kx: 0 }, 110);
          break;
        }
        case "swoop": {
          // rise, dive at the hero, rake with claws, climb away
          play(p, "move", [0, 1, 2, 3], 60, true);
          sfx("whoosh");
          await to(p, { z: 26, kx: 6 }, 140, ease.outQuad);
          p.ghost = "#ffcfa0";
          play(p, "attack", [0, 1], 90, true);
          const tx = hero.x + hero.kx + bodyHalf(p) + 10;
          await Promise.all([to(p, { x: tx, kx: 0 }, 170, ease.inOutQuad), to(p, { z: -10 }, 170, ease.inQuad)]);
          fx.claw(hx + 1, hy - 2, { n: 3, dir: -1, col: "#ff6a4a", len: 18 });
          sfx("slash");
          land();
          play(p, "attack", [2, 3], 80);
          await wait(80);
          p.ghost = "";
          play(p, "move", [0, 1, 2, 3], 70, true);
          await Promise.all([to(p, { z: 20 }, 170, ease.outQuad), to(p, { x: FOE_X }, 250, ease.inOutQuad)]);
          void to(p, { z: 0 }, 160, ease.inOutQuad);
          idle(p);
          break;
        }
        case "leap": {
          // crouch, pounce on the hero, bite, spring back
          play(p, "move", [0], 100, true);
          await to(p, { sy: 0.86, sx: 1.08, x: p.x + (engaged ? 12 : 0) }, 90);
          sfx("whoosh");
          play(p, "attack", [0], 100, true);
          p.ghost = "#ffb0a0";
          const x0 = p.x, tx = hero.x + hero.kx + bodyHalf(p) + 8;
          fx.dust(p.x + 6, gy, { n: 5, dir: 1 });
          void to(p, { sy: 1, sx: 1 }, 80);
          await tween(190, (u) => { p.x = x0 + (tx - x0) * u; p.z = Math.sin(u * Math.PI) * (Math.abs(tx - x0) > 40 ? 18 : 13) * (1 - u * 0.4); }, ease.outQuad);
          p.z = 0;
          play(p, "attack", [1, 2, 3], 80);
          fx.bite(hx + 3, hy - 3, { size: 9 });
          sfx("slash");
          land();
          fx.dust(p.x, gy, { n: 4, dir: 0, speed: 0.5 });
          await wait(90);
          p.ghost = "";
          // spring back to its spot
          const x1 = p.x;
          play(p, "move", [1], 100, true);
          await tween(engaged ? 150 : 220, (u) => { p.x = x1 + (FOE_X - x1) * u; p.z = Math.sin(u * Math.PI) * (engaged ? 5 : 10); }, ease.inOutQuad);
          p.z = 0;
          idle(p);
          break;
        }
        case "mindbolt": case "shoot": {
          const hand: [number, number] = [p.x - bodyHalf(p) - 3, gy - p.hover - (k.person ? 30 : 36)];
          play(p, "attack", [0], 100, true);
          if (k.move === "mindbolt") {
            p.aura = k.magic;
            void fx.glyph(p.x, gy - 1, { r: 16, ry: 0.32, col: k.magic, dur: 520, layer: "under", spin: -2.5 });
            sfx("cast", "dark");
            await fx.charge(hand[0], hand[1], { col: k.magic, dur: 240, r: 18 });
            p.aura = "";
            play(p, "attack", [1, 2], 90, true);
            const dur = Math.abs(hand[0] - hx) * 1.9;
            void fx.bolt(hand[0], hand[1], hx + 4, hy, { col: k.magic, dur: dur + 60, jag: 3 });
            await fx.projectile(hand[0], hand[1], hx + 4, hy, { dur, arc: 6, head: darkOrbHead(k.magic), trail: k.magic, trailLen: 10, e: ease.inQuad });
            for (let i = 0; i < 3; i++) fx.ring(hx + 2, hy, { r0: 2 + i * 2, r1: 14 + i * 5, dur: 240 + i * 70, col: k.magic, w: 1, glow: true });
            fx.burst(hx, hy, { n: 14, col: k.magic, speed: 1.5, glow: true });
            sfx("impact", "dark");
          } else {
            play(p, "attack", [0, 1], 110, true);
            await wait(220);
            play(p, "attack", [2, 3], 90);
            sfx("bow");
            await fx.projectile(hand[0], hand[1] + 6, hx + 2, hy, { dur: Math.abs(hand[0] - hx) * 1.7, arc: 4, head: (g, x, y, a) => arrowHead(g, x, y, a), trail: "#fff0c0", trailLen: 5 });
          }
          land();
          await wait(100);
          idle(p);
          break;
        }
        case "drain": {
          // glide in like smoke, strike, then the hero's life streams into it
          p.ghost = k.magic === "#b060ff" ? "#7a4ab8" : k.magic;
          const a0 = p.alpha;
          void tween(260, (u) => { p.alpha = a0 * (0.55 + 0.45 * Math.abs(Math.cos(u * 9))); }, ease.linear);
          await approach(p, reach);
          p.alpha = a0;
          play(p, "attack", [0, 1, 2], 70, true);
          sfx("cast", "dark");
          await wait(70);
          void fx.slash(p.x - 3, gy - 30, { r: 17, a0: -140, a1: 60, dir: -1, col: k.trail, edge: "#f0e8ff", thick: 4, dur: 200 });
          await wait(60);
          land();
          p.ghost = "";
          if (res === "hit") { void drainWisps(p); await wait(240); }
          else fx.wisps(hx + 6, hy, { n: 8, col: k.trail, w: 4, h: 6 });
          play(p, "attack", [3], 90);
          await wait(120);
          break;
        }
        case "maul": {
          await approach(p, reach);
          play(p, "attack", [0], 100, true);
          sfx("charge");
          await to(p, { sy: 1.1, z: 3, kx: 3 }, 110, ease.outQuad);
          play(p, "attack", [1, 2], 70, true);
          await to(p, { sy: 1, z: 0, kx: -8 }, 70, ease.inQuad);
          fx.claw(hx + 2, hy - 4, { n: 4, dir: -1, col: "#ff4a3a", len: 20 });
          sfx("slash");
          await wait(45);
          fx.claw(hx - 1, hy + 2, { n: 3, dir: 1, col: "#ff4a3a", len: 16 });
          fx.shake(2, 160);
          land();
          play(p, "attack", [3], 100);
          await wait(110);
          await to(p, { kx: 0 }, 120);
          break;
        }
        case "smash": {
          await approach(p, reach + 4);
          play(p, "attack", [0], 100, true);
          sfx("charge");
          await to(p, { z: 5, sy: 1.06, kx: 4 }, 130, ease.outQuad);
          play(p, "attack", [1, 2], 60, true);
          await to(p, { z: 0, sy: 1, kx: -6 }, 70, ease.inQuad);
          fx.shock(hx + 8, gy, { r: 30, n: 18 });
          fx.shake(4.5, 300);
          sfx("break");
          land();
          play(p, "attack", [3], 120);
          await wait(140);
          await to(p, { kx: 0 }, 120);
          break;
        }
        case "strike": case "bite": {
          await approach(p, reach + 14);
          play(p, "attack", [0], 100, true);
          await to(p, { kx: 4, sx: 0.92 }, 90);
          p.ghost = k.move === "strike" ? "#d8ffb0" : "#ffb0a0";
          play(p, "attack", [1, 2], 60, true);
          sfx("whoosh");
          await to(p, { kx: -14, sx: 1.05 }, 55, ease.outExpo);
          fx.bite(hx + 4, hy, { size: 7, col: k.move === "strike" ? "#ffffff" : "#fff8e8" });
          if (k.move === "strike" && res === "hit") fx.blood(hx, hy, { dir: -1, n: 6, col: "#9ae03a", col2: "#4a8a1a" });
          land();
          await wait(110);
          p.ghost = "";
          play(p, "attack", [3], 100);
          await to(p, { kx: 0, sx: 1 }, 200, ease.inOutQuad);
          break;
        }
      }
      idle(p);
    }

    /** Dark wisps stream from the hero into the foe (undead draining life). */
    function drainWisps(p: Pup) {
      const k = kitOf(p);
      const [hx, hy] = heroHitPoint();
      const [tx, ty] = foeHitPoint(p);
      const motes = Array.from({ length: 12 }, (_, i) => ({ d: i * 22, o: (Math.random() - 0.5) * 18 }));
      p.aura = k.trail;
      void wait(420).then(() => { p.aura = ""; });
      return fx.add(520, (g, kk, age) => {
        for (const m of motes) {
          const u = (age - m.d) / 300;
          if (u <= 0 || u >= 1) continue;
          const x = hx + (tx - hx) * u, y = hy + (ty - hy) * u - Math.sin(u * Math.PI) * m.o;
          g.globalAlpha = Math.sin(u * Math.PI);
          g.fillStyle = k.blood2; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
          g.fillStyle = k.trail; g.fillRect(Math.round(x), Math.round(y), 1, 1);
          g.fillRect(Math.round(x - (tx - hx) * 0.02), Math.round(y), 1, 1);
        }
        g.globalAlpha = 1;
        void kk;
      });
    }

    // ---------------------------------------------------------------- deaths, entrances, endings
    async function foeDies(p: Pup) {
      const k = kitOf(p);
      sfx("death");
      say(`${b.foes[curFoe].def.name} gục ngã!`, "good");
      p.ghost = "";
      switch (k.death) {
        case "dissolve": {
          flash(p, "#e8d8ff", 160);
          hold(p, "hurt", 1);
          sfx("cast", "dark");
          const [x, y] = foeHitPoint(p);
          for (let i = 0; i < 5; i++) void wait(i * 110).then(() => { fx.wisps(x, y - 6, { n: 6, col: k.bits === "ghost" ? k.blood : "#9a6ad8", col2: k.blood2, w: k.w * 0.22, h: 14, rise: 0.8 }); fx.smoke(x, y, { n: 3, col: k.blood2, w: 8, h: 10 }); });
          await to(p, { dissolve: 1 }, 760, ease.inOutQuad);
          p.hidden = true;
          break;
        }
        case "fall": {
          hold(p, "hurt", 1);
          const dir = 1;
          await to(p, { z: p.z + 8, rot: dir * 0.4 }, 140, ease.outQuad);
          await to(p, { z: -p.hover, rot: dir * 1.1, kx: 8 }, 360, ease.inQuad);
          // crashed: lies on the ground
          p.rot = 0; p.z = 0; p.hover = 0;
          hold(p, "dead", 0);
          fx.dust(p.x + p.kx, gy, { n: 10, dir: 0, speed: 1.2, size: 3 });
          fx.debris(p.x + p.kx, gy - 1, { n: 8, speed: 1.8 });
          fx.shake(3, 200);
          sfx("break");
          await wait(260);
          await to(p, { alpha: 0 }, 420);
          p.hidden = true;
          break;
        }
        default: {
          hold(p, "hurt", 1);
          await wait(140);
          hold(p, "dead", 0);
          await to(p, { sy: 0.9 }, 90).then(() => to(p, { sy: 1 }, 140));
          fx.dust(p.x, gy, { n: k.death === "heavy" ? 12 : 6, dir: 0, speed: 0.9, size: k.death === "heavy" ? 3.5 : 2.5 });
          if (k.death === "heavy") { fx.shake(4, 260); sfx("break"); fx.debris(p.x, gy - 1, { n: 8 }); }
          await wait(260);
          await to(p, { alpha: 0 }, 360);
          p.hidden = true;
        }
      }
    }

    async function foeEnters(i: number) {
      const p = foes[i];
      const k = kits[i];
      curFoe = i;
      p.hidden = false;
      p.alpha = 1;
      p.facing = "left";
      showCard(i);
      sfx("encounter", "normal");
      if (k.flying) {
        p.x = SW + 30; p.z = 50;
        play(p, "move", [0, 1, 2, 3], 60, true);
        p.ghost = "#ffcfa0";
        await Promise.all([to(p, { x: FOE_X }, 520, ease.outCubic), to(p, { z: 0 }, 520, ease.outQuad)]);
      } else {
        p.x = SW + 40;
        run(p, 60);
        p.ghost = "#ffb0a0";
        await to(p, { x: FOE_X }, 460, ease.outCubic);
        fx.dust(FOE_X - 6, gy, { n: 8, dir: -1, speed: 1.3 });
      }
      p.ghost = "";
      play(p, "attack", [0, 0, 0], 110);
      fx.ring(FOE_X, gy - 1, { r1: 22, ry: 0.3, dur: 360, col: "#ff8a6a", layer: "under" });
      fx.shake(k.big ? 3 : 1.5, 180);
      await wait(260);
      idle(p);
    }

    function showCard(i: number) {
      const f = b.foes[i];
      card.replaceChildren(h("div", { class: "adv-fcard-in" },
        h("small", null, b.foes.length > 1 ? `Kẻ thù ${i + 1}/${b.foes.length}` : "Kẻ thù"),
        h("b", null, f.def.name),
        h("span", null, iconEl(uiIcon("cs"), 1), ` ${f.def.cs}  ·  Sức Bền ${f.def.ep}`)));
      bump(card, "show");
    }

    async function flee(p: Pup, dmg: number) {
      say("Bạn quay lưng chạy trốn!");
      hero.facing = "left";
      run(hero, 60);
      hero.ghost = "#9ad8ff";
      fx.dust(hero.x + 4, gy, { n: 6, dir: 1 });
      sfx("whoosh");
      const escape = to(hero, { x: -40 }, 900, ease.inQuad);
      await wait(140);
      // a parting blow at the hero's back
      const k = kitOf(p);
      if (k.move === "mindbolt" || k.move === "shoot") await foeAttack(p, dmg > 0 ? "hit" : "block", dmg);
      else {
        p.ghost = "#ffb0a0";
        run(p, 50);
        await to(p, { x: hero.x + 26 }, 220, ease.outCubic);
        play(p, "attack", [1, 2, 3], 70);
        sfx("slash");
        void fx.slash(p.x - 3, gy - 30, { r: 17, a0: -150, a1: 70, dir: -1, col: k.trail, thick: 4, dur: 200 });
        await wait(60);
        if (dmg > 0) { heroHurt(dmg, dmg >= 6); hero.anim = { pose: "walk", seq: [0, 1, 2, 3], t0: clock, ms: 60, loop: true }; }
        else { fx.word(p.x - 10, gy - 56, "TRƯỢT", "#c8c0b8"); sfx("miss"); }
        p.ghost = "";
        await wait(160);
        idle(p);
        p.facing = "left";
      }
      await escape;
      hero.hidden = true;
      hero.ghost = "";
      const back = foes[curFoe];
      if (Math.abs(back.x - FOE_X) > 1) { run(back, 70); back.facing = "right"; await to(back, { x: FOE_X }, 300); back.facing = "left"; idle(back); }
    }

    async function victory() {
      hero.facing = "right";
      play(hero, "cast", [0, 1, 2], 120, true);
      void fx.glyph(hero.x, gy - 1, { r: 20, ry: 0.32, col: "#ffd27a", dur: 1400, layer: "under", spin: 1.5 });
      fx.embers(hero.x, gy - 4, { n: 24, w: 14, col: "#ffc850", speed: 0.9, life: 1300 });
      fx.stars(hero.x, gy - 34, { n: 14, w: 16, h: 18, col: "#fff0a0", life: 1200 });
      fx.flash("#fff4c0", 160, 0.3);
      for (let i = 1; i < 4; i++) void wait(i * 260).then(() => fx.stars(hero.x, gy - 36, { n: 6, w: 18, h: 16, col: "#ffe07a" }));
      await wait(800);
    }

    async function defeat() {
      timeScale = 0.35;
      el.classList.add("defeat");
      hold(hero, "hurt", 1);
      await wait(260);
      hold(hero, "dead", 0);
      fx.dust(hero.x, gy, { n: 8, dir: 0, speed: 0.6 });
      await wait(260);
      timeScale = 1;
      await wait(500);
    }

    // ---------------------------------------------------------------- a round
    let busy = false;
    const shrugged = new Set<number>();
    function render() {
      const foe = b.foes[b.idx];
      heroShown = s.ep;
      foeShown = foe.ep;
      heroBar.set(s.ep, epMax(book, s));
      foeBar.set(foe.ep, foe.def.ep);
      lowCheck();
      foeName.textContent = `${foe.def.name}${b.foes.length > 1 ? ` (${b.idx + 1}/${b.foes.length})` : ""}`;
      foeCs.replaceChildren(iconEl(uiIcon("cs"), 1), ` ${foe.def.cs}`);
      const cs = heroCs(book, s, c, foe.def, b.mind, b.round);
      const ratio = cs.total - foe.def.cs;
      ratioEl.replaceChildren(h("span", null, "Tỉ lệ"), h("b", { class: ratio >= 0 ? "good" : "bad" }, `${ratio > 0 ? "+" : ""}${ratio}`));
      csList.replaceChildren(h("span", null, iconEl(uiIcon("cs"), 1), ` KNCĐ ${cs.total}`),
        ...cs.parts.slice(1).map((p) => h("span", { class: p.v >= 0 ? "good" : "bad" }, `${p.label} ${p.v > 0 ? "+" : ""}${p.v}`)));
      const minds = prof.mind.map((m, i) => ({ m, i })).filter(({ m }) => s.disciplines.includes(m[0]));
      const evadeOk = c.evade ? canEvade(book, s, b) : false;
      actions.replaceChildren(...nn(
        minds.length || c.evade ? h("div", { class: "adv-fsub" }, ...nn(
          minds.length ? gameBtn(b.mind >= 0 ? `${book.names.disc[prof.mind[b.mind][0]]} +${prof.mind[b.mind][1]}${prof.mind[b.mind][2] ? ` (−${prof.mind[b.mind][2]})` : ""}` : "Không dùng tâm lực", () => {
            // cycle: each mind option, then none
            const order = [...minds.map((x) => x.i), -1];
            b.mind = order[(order.indexOf(b.mind) + 1) % order.length];
            render();
          }, { kind: b.mind >= 0 ? "mind" : "btn", icon: "mind", cls: `adv-mind ${b.mind >= 0 ? "on" : ""}`, disabled: busy }) : null,
          c.evade ? gameBtn(evadeOk ? "Chạy trốn" : `Chạy trốn (sau ${c.evade.after - b.round} hiệp)`, () => void round(true), { icon: "flee", disabled: busy || !evadeOk }) : null)) : null,
        gameBtn(auto && !b.over ? "Đang tự đánh…" : "Tấn công", () => void round(false), { kind: "red", icon: "cs", cls: "adv-attack block big", disabled: busy || auto }),
      ));
    }

    async function round(evade: boolean) {
      if (busy || b.over || !alive) return;
      busy = true;
      render();
      const p = foes[b.idx];
      const foe = b.foes[b.idx];
      const m = mindSpec();
      const immune = (foe.def.immune ?? []).some((x) => MIND_IMMUNE.includes(x));
      const heroBefore = s.ep, foeBefore = foe.ep;
      const r: RoundResult = playRound(book, s, b, evade);
      onChange();
      // the bars follow the show, not the rules (they already changed)
      heroShown = heroBefore;
      foeShown = foeBefore;
      foeBar.set(foeShown, foe.def.ep);
      heroBar.set(heroShown, epMax(book, s));
      // the hero closes in while the reel spins
      await Promise.all([spin(r.n), r.evaded ? null : wait(120).then(() => engage(p))]);
      const heroDmg = r.heroLoss - r.mindCost;
      if (r.evaded) await flee(p, heroDmg);
      else {
        // an immune foe shrugs the mind attack off once; after that it is not tried on it
        if (m && !evade && !(immune && shrugged.has(r.foe))) { if (immune) shrugged.add(r.foe); await mindStrike(p, immune, r.mindCost); }
        await exchange(r, p, heroDmg);
      }
      if (r.foeKilled && !r.evaded) await foeDies(p);
      if (r.heroKilled) await defeat();
      else if (!r.evaded) await disengage();
      busy = false;
      if (b.over) return finish();
      if (r.foeKilled) await foeEnters(b.idx);
      render();
      if (auto && alive && !b.over) { await wait(260); void round(false); }
    }

    async function exchange(r: RoundResult, p: Pup, heroDmg: number) {
      const foeDmg = r.foeLoss;
      type Beat = "heroHit" | "heroMiss" | "foeHit" | "foeBlocked" | "clash";
      let beats: Beat[];
      if (foeDmg > 0 && heroDmg > 0) beats = r.foeKilled && !r.heroKilled ? ["foeHit", "heroHit"] : r.heroKilled ? ["heroHit", "foeHit"] : foeDmg >= heroDmg ? ["foeHit", "heroHit"] : ["heroHit", "foeHit"];
      else if (foeDmg > 0) beats = r.foeKilled ? ["heroHit"] : ["foeBlocked", "heroHit"];
      else if (heroDmg > 0) beats = ["heroMiss", "foeHit"];
      else beats = ["clash"];
      const held = (b.foes[r.foe].def.holdRounds ?? 0) >= b.round;
      if (held) beats = beats.filter((x) => x !== "foeBlocked");
      // a melee hero closes in first, so the blows trade where they stand
      await engage(p);
      for (const beat of beats) {
        if (beat === "heroHit") await heroAttack(p, "hit", foeDmg);
        else if (beat === "heroMiss") await heroAttack(p, "miss", 0);
        else if (beat === "clash") await heroAttack(p, "clash", 0);
        else {
          if (beat === "foeHit" && r.heroKilled) timeScale = 0.45;
          await foeAttack(p, beat === "foeHit" ? "hit" : "block", heroDmg);
        }
        await wait(35);
      }
    }

    async function finish() {
      render();
      actions.replaceChildren();
      const exit = battleExit(book, s, b);
      onChange();
      const win = b.over === "win";
      if (win) await victory();
      const title = win ? "CHIẾN THẮNG" : b.over === "evaded" ? "ĐÃ THOÁT" : b.over === "timeout" ? (c.compare ? "HẾT HIỆP" : "HẾT GIỜ") : b.over === "beaten" ? "THUA TRẬN" : b.over === "hurt" ? "TRÚNG ĐÒN!" : "BẠI TRẬN";
      sfx(b.over === "lose" ? "defeat" : "victory");
      const done = (to2: string | null) => { alive = false; fit.destroy(); stage.destroy(); el.classList.add("out"); setTimeout(() => el.remove(), 250); playMusic("title"); resolve({ battle: b, exit: to2 }); };
      const alts = b.over === "evaded" ? c.evade?.alt ?? [] : [];
      const buttons = alts.length
        ? [gameBtn("Chạy theo lối đã định", () => done(exit), { kind: "gold", cls: "block" }), ...alts.map((a) => gameBtn(a.text, () => done(a.to), { cls: "block" }))]
        : [gameBtn("Tiếp tục", () => done(exit), { kind: "gold", cls: "block big" })];
      const good = win || b.over === "evaded";
      banner.replaceChildren(h("div", { class: `adv-fbanner-box fr-panel ${b.over} ${good ? "good" : "badend"}` },
        iconEl(uiIcon(win ? "trophy" : b.over === "evaded" ? "flee" : "skull"), 3),
        h("div", { class: "t" }, title),
        h("div", { class: "sub" }, `${b.round} hiệp · Sức Bền ${Math.max(0, s.ep)}/${epMax(book, s)}`),
        h("div", { class: "btns" }, ...buttons)));
      banner.classList.add("show");
    }

    // ---------------------------------------------------------------- start
    say(b.foes.length > 1 ? `${b.foes.length} kẻ thù lần lượt xông vào bạn.` : `${b.foes[0].def.name} chặn đường bạn!`);
    if (heroStyle === "fist" && !s.weapons.length && !s.special.some((id) => id === "Sommerswerd" || book.items[id]?.weapon)) say("Bạn không có vũ khí: đánh tay không (−4).", "bad");
    else if (s.weapons[0]) say(`Bạn cầm ${itemName(book, s.weapons[0])}.`);
    busy = true;
    render();
    void foeEnters(0).then(() => { busy = false; render(); });
  });
}
