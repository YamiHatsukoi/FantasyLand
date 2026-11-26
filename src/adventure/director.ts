/**
 * Director: performs a section on a Stage, beat by beat. Each beat shows a short piece of the
 * text (typed out in a caption) while its actions play: entrances, runs, attacks, falls,
 * kneeling, speech bubbles, emotes, props, effects (fire, smoke, lightning, blood, magic, a
 * Kai mindblast...), camera moves, weather and time of day, sounds.
 *
 * The beats come from the book (`section.stage`, see STAGING.md of the book repo) or, for books
 * not staged yet, are made up from the text: 1–2 sentences per beat with gentle motion, the
 * cast walking in, emotes on dialogue lines and effects for what the words describe.
 *
 * `Performance` drives it for a screen: tap to finish the beat at once / go on, auto mode,
 * skip to the end.
 */
import { sfx } from "../audio/sfx";
import { h } from "../ui/dom";
import { creatureFrame, creatureSize } from "./art/creatures";
import { isPersonActor, portrait, type Look } from "./art/people";
import { isKnownProp, isLitProp, isLivingProp, propArt, propKind } from "./art/props";
import { calmMotion } from "./motion";
import { easeInOut, easeOut, H, isMonster, Stage, W, type Actor, type Particle, type StageProp } from "./stage";
import type { Beat, Book, Section, StageAction } from "./types";

// ================================================================== helpers
const HERO = "lonewolf";
const base = (id: string) => id.split("#")[0];
const isHero = (id: string) => base(id) === HERO || base(id) === "hero";
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** "#rrggbb" at an opacity. */
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Short display name of an actor id ("Giak", "Banedon", "Quan triều đình"). */
export function actorName(book: Book, id: string): string {
  const b = base(id);
  if (isHero(b)) return "Lone Wolf";
  const d = book.actors?.[b];
  if (d) {
    const dash = d.split(/\s+[-–]\s+/);
    if (dash.length > 1 && dash[0].length <= 28) return dash[0].trim();
    let first = d.split(/[,.;:(]/)[0].trim();
    const cut = first.search(/\s(gầy|mặc|cầm|với|đội|cưỡi|mang|áo|râu|tóc|mặt|dáng|trẻ|giàu|béo|cao|thấp|to lớn|nhỏ bé|khoảng|đang|có)\b/);
    if (cut > 3) first = first.slice(0, cut);
    if (first.length <= 30 && first.length > 1) return first[0].toUpperCase() + first.slice(1);
  }
  return b.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Portrait canvas for the caption: a person's bust, or a creature's head-and-shoulders. */
export function actorFace(id: string, heroLook: Look): HTMLCanvasElement {
  const b = base(id);
  if (isHero(b)) return portrait(heroLook);
  if (isPersonActor(b) || !isMonster(b)) return portrait(b);
  const fr = creatureFrame(b, "idle", 0, "right");
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const s = Math.min(1, 40 / Math.max(fr.width, fr.height));
  const w = fr.width * s, hh = fr.height * s;
  g.drawImage(fr, 16 - w / 2, 32 - hh * 0.92, w, hh);
  return c;
}

// ================================================================== synthesized beats
const SENT = /[^.!?…]+(?:[.!?…]+["”»’)]*|$)\s*/g;

function sentences(p: string): string[] {
  const out: string[] = [];
  let open = false;
  for (const m of p.match(SENT) ?? [p]) {
    const s = m.trim();
    if (!s) continue;
    // keep a quotation that spans sentences in one piece
    if (open && out.length) out[out.length - 1] += ` ${s}`;
    else out.push(s);
    const q = (s.match(/“/g)?.length ?? 0) - (s.match(/”/g)?.length ?? 0) + ((s.match(/"/g)?.length ?? 0) % 2);
    if (q > 0) open = true;
    if ((s.match(/”/g)?.length ?? 0) > (s.match(/“/g)?.length ?? 0) || (open && /["”]\W*$/.test(s) && q <= 0)) open = false;
  }
  return out;
}

/** Splits the text into beats of one or two sentences (never across paragraphs). */
export function chunkText(text: string[]): string[] {
  const out: string[] = [];
  for (const p of text) {
    const ss = sentences(p);
    let cur = "";
    let n = 0;
    for (const s of ss) {
      // two sentences at most (a very short one may ride along), about 160 characters
      if (cur && (cur.length + s.length > 160 || cur.length > 105 || (n >= 2 && (s.length > 24 || n >= 3)))) { out.push(cur); cur = s; n = 1; }
      else { cur = cur ? `${cur} ${s}` : s; n++; }
    }
    if (cur) out.push(cur);
  }
  return out;
}

const KW = {
  run: /\b(chạy|bỏ chạy|lao đi|phi ngựa|phóng đi|tháo chạy|chạy trốn)\b/,
  walk: /\b(đi tiếp|bước (vào|tới|lên|đi)|tiến (về|lại|tới|lên)|lên đường|đi về phía|đi theo|men theo|tiếp tục đi|đi dọc|đi qua|tiến bước)\b/,
  kneel: /\b(quỳ|cúi xuống|ngồi xuống|khom người|ngồi bên)\b/,
  attack: /\b(tấn công|lao vào|xông (vào|tới|lên)|nhảy bổ|vồ lấy|lao tới|bổ nhào|lao xuống)\b/,
  surprise: /\b(bất ngờ|đột nhiên|bỗng|giật mình|sững sờ|kinh ngạc|thình lình)\b/,
  fear: /\b(sợ|run rẩy|lo lắng|hoảng|kinh hoàng|mệt|kiệt sức|đau đớn)\b/,
  sad: /\b(buồn|khóc|nước mắt|thương tiếc|đau buồn|tiếc thương|nghẹn ngào)\b/,
  wonder: /\b(tự hỏi|thắc mắc|lạ lùng|kỳ lạ|bí ẩn|không biết|phân vân)\b/,
  sleep: /\b(ngủ|thiếp đi)\b/,
  anger: /\b(giận|phẫn nộ|căm|tức tối|quát)\b/,
  death: /\b(xác chết|thi thể|tử thi|xác của|đã chết)\b/,
  fire: /\b(lửa|bốc cháy|cháy rụi|đang cháy|thiêu)\b/,
  smoke: /\b(khói)\b/,
  boom: /\b(nổ tung|vụ nổ|nổ)\b/,
  thunder: /\b(sấm|sét|tia chớp)\b/,
  arrows: /\b(mũi tên|loạt tên|cơn mưa tên)\b/,
  blood: /\b(máu)\b/,
  magic: /\b(phép thuật|ma thuật|phép|bùa chú|thần chú)\b/,
  glow: /\b(ánh sáng|phát sáng|tỏa sáng|toả sáng|lấp lánh|rực sáng|sáng rực|lóe sáng)\b/,
  dark: /\b(bóng tối|tối tăm|tối om|đen kịt)\b/,
  // letters with diacritics are not \w: whole words are told apart by Unicode letters
  frost: /(?<!\p{L})(băng giá|đóng băng|sương giá|giá buốt|tinh thể băng|lạnh cóng)(?!\p{L})/u,
  dust: /\b(bụi)\b/,
  rocks: /\b(đá lở|đá rơi|sụp đổ|sập xuống|lở đất)\b/,
  splash: /\b(rơi xuống nước|nhảy xuống (sông|nước|hồ)|lặn xuống|bơi|té nước|bắn tung)\b/,
  roar: /\b(gầm|rống|tru lên|rít lên|tiếng thét)\b/,
  door: /\b(cánh cửa|cửa gỗ|cửa sắt|cánh cổng)\b/,
  open: /\b(mở|bật ra|hé)\b/,
  chest: /\b(cái rương|chiếc rương|cái hòm|chiếc hòm|hòm gỗ)\b/,
  coin: /\b(vương miện vàng|đồng tiền|túi tiền|vàng)\b/,
  campfire: /\b(lửa trại|đống lửa|bếp lửa)\b/,
  cart: /\b(xe ngựa|cỗ xe|xe kéo|xe chở)\b/,
  boat: /\b(thuyền|chiếc bè|cái bè)\b/,
  horse: /\b(con ngựa|ngựa của)\b/,
  sword: /\b(thanh kiếm|cây kiếm)\b/,
  speakHero: /\b(bạn (nói|đáp|hỏi|hét|kêu|trả lời|thì thầm|gọi))\b/,
};

/** Name words of an actor to look for in the text. */
function nameKeys(book: Book, id: string): string[] {
  const keys = new Set<string>();
  keys.add(actorName(book, id).toLowerCase());
  for (const w of base(id).split("-")) if (w.length > 3) keys.add(w);
  return [...keys].filter((k) => k.length > 2);
}

/** Beats made up from a section's text, for books that have no staging yet. */
export function synthBeats(book: Book, sec: Section): Beat[] {
  const chunks = chunkText(sec.text);
  if (!chunks.length) return [];
  const others = sec.scene.actors.filter((a) => !isHero(a));
  const foes = (sec.combat?.foes ?? []).map((f) => f.actor ?? f.name).filter((x) => x && isMonster(x) || (x && others.includes(x)));
  const lower = chunks.map((c) => c.toLowerCase());
  const beats: Beat[] = chunks.map((t) => ({ t, do: [] }));
  const acts = (i: number) => beats[i].do!;
  // who walks in when: at the first beat naming them, else at the start
  const present = new Set<string>([HERO]);
  const enterAt = new Map<string, number>();
  others.slice(0, 4).forEach((id) => {
    const keys = nameKeys(book, id);
    const i = lower.findIndex((t) => keys.some((k) => t.includes(k)));
    enterAt.set(id, i >= 0 && i < chunks.length - (sec.combat ? 0 : 0) ? i : 0);
  });
  for (const f of foes) if (!enterAt.has(f) && !others.includes(f)) enterAt.set(f, Math.max(0, chunks.length - 1));
  const danger = ["danger", "combat", "tense"].includes(sec.scene.mood);
  let slot = 1;
  const freeSlots = [3, 4, 2, 5, 0];
  let lastSpeaker = "";
  let kneeling = false;
  let entered = 0;
  for (let i = 0; i < beats.length; i++) {
    const t = lower[i], A = acts(i);
    const cam: StageAction[] = [];
    // entrances
    for (const [id, at] of enterAt) {
      if (at !== i || present.has(id)) continue;
      const flying = isMonster(id) && creatureSize(id).flying;
      const where = freeSlots[entered++ % freeSlots.length];
      A.push({ enter: id, from: flying ? "top" : isMonster(id) && danger ? "right" : i === 0 && entered % 2 === 0 ? "left" : "right", at: where });
      present.add(id);
      if (isMonster(id)) {
        if (danger && !t.match(KW.surprise)) A.push({ emote: HERO, kind: "!" });
        if (flying) cam.push({ camera: "shake" });
      }
    }
    const here = [...present].filter((x) => !isHero(x));
    const named = here.find((id) => nameKeys(book, id).some((k) => t.includes(k)));
    // dialogue
    const quote = chunks[i].match(/[“"]([^”"]{2,})[”"]?/);
    if (quote) {
      let who = KW.speakHero.test(t) ? HERO : named ?? (lastSpeaker && present.has(lastSpeaker) ? lastSpeaker : here[0]) ?? "";
      if (!who) who = HERO;
      lastSpeaker = who === HERO ? lastSpeaker : who;
      let line = quote[1].trim();
      if (line.length > 52) line = `${line.slice(0, 50).replace(/\s+\S*$/, "")}…`;
      A.push({ say: who, text: line });
      const q = quote[1];
      if (/!\s*$/.test(q)) A.push({ emote: who, kind: KW.anger.test(t) ? "anger" : "!" });
      else if (/\?/.test(q)) A.push({ emote: who, kind: "?" });
      else if (who !== HERO) A.push({ emote: HERO, kind: "..." });
      if (who !== HERO) { A.push({ face: HERO, dir: "toward:" + who }); A.push({ face: who, dir: "toward:" + HERO }); }
      cam.push({ camera: "push-in", on: who });
    }
    // the hero's movement
    if (KW.kneel.test(t) && !kneeling) { A.push({ pose: "kneel", who: HERO }); kneeling = true; }
    else if (KW.run.test(t)) { if (kneeling) kneeling = false; slot = Math.min(slot + 1, 3); A.push({ run: HERO, to: slot }); }
    else if (KW.walk.test(t)) {
      if (kneeling) { A.push({ pose: "idle", who: HERO }); kneeling = false; }
      if (slot < 3 && !here.length) { slot++; A.push({ move: HERO, to: slot }); }
    }
    // a foe lunging
    const foe = here.find((x) => isMonster(x));
    if (KW.attack.test(t) && foe) {
      A.push({ run: foe, to: "near:" + HERO }, { emote: HERO, kind: "!" });
      cam.push({ camera: "shake" });
    }
    // feelings
    if (!A.some((a) => "emote" in a && a.emote === HERO)) {
      const kind = KW.surprise.test(t) ? "!" : KW.sad.test(t) ? "sad" : KW.fear.test(t) ? "sweat" : KW.anger.test(t) ? "anger" : KW.wonder.test(t) ? "?" : KW.sleep.test(t) ? "zzz" : KW.death.test(t) ? "skull" : "";
      if (kind) A.push({ emote: HERO, kind });
      if (kind === "!" && danger) cam.push({ camera: "shake-soft" });
    }
    // what the words describe
    const fxAt = foe ?? (here[0] || 4);
    if (KW.boom.test(t)) A.push({ fx: "explosion", at: 4 }, { sfx: "thunder" });
    else if (KW.fire.test(t)) A.push({ fx: "fire", at: /khắp|thiêu rụi|biển lửa/.test(t) ? "all" : 4 });
    if (KW.smoke.test(t)) A.push({ fx: "smoke", at: 4 });
    if (KW.thunder.test(t)) A.push({ fx: "lightning", at: "sky" }, { sfx: "thunder" });
    if (KW.arrows.test(t)) A.push({ fx: "arrows", at: foe ? HERO : 3 });
    if (KW.blood.test(t) && here.length) A.push({ fx: "blood", at: fxAt });
    if (KW.magic.test(t)) A.push({ fx: "magic", at: named ?? HERO });
    if (KW.glow.test(t)) A.push({ fx: "glow", at: named ?? 3 });
    if (KW.dark.test(t)) A.push({ fx: "darkness", at: "all" });
    if (KW.frost.test(t)) A.push({ fx: "frost", at: "all" });
    if (KW.rocks.test(t)) A.push({ fx: "fall-rocks", at: 3 }, { sfx: "thunder" });
    else if (KW.dust.test(t)) A.push({ fx: "dust", at: HERO });
    if (KW.splash.test(t)) A.push({ fx: "splash", at: HERO }, { sfx: "splash" });
    if (KW.roar.test(t) && foe) A.push({ sfx: "roar" });
    if (KW.door.test(t)) { A.push({ prop: "door", at: 4, state: KW.open.test(t) ? "open" : "" }); if (KW.open.test(t)) A.push({ sfx: "door" }); }
    if (KW.chest.test(t)) A.push({ prop: "chest", at: 3, state: KW.open.test(t) ? "open" : "" });
    if (KW.campfire.test(t)) A.push({ prop: "campfire", at: 3 });
    if (KW.cart.test(t)) A.push({ prop: "cart", at: 4 });
    if (KW.boat.test(t) && ["river", "lake", "coast", "sea", "bridge"].includes(sec.scene.bg)) A.push({ prop: "boat", at: 4 });
    if (KW.horse.test(t) && !present.has("horse")) A.push({ prop: "horse", at: 4 });
    if (KW.death.test(t) && !here.length) A.push({ prop: "corpse", at: 4 });
    if (KW.coin.test(t) && /\b(nhặt|tìm thấy|lấy|trả|đưa)\b/.test(t)) A.push({ sfx: "coin" });
    // camera: only where the words call for it (no idle drifting while the text types)
    A.push(...cam.slice(0, 2));
  }
  // how it ends
  const L = acts(beats.length - 1);
  if (sec.end === "death") {
    L.push({ pose: "dead", who: HERO }, { fx: "darkness", at: "all" }, { sfx: "scream" });
  } else if (sec.end === "victory") {
    L.push({ fx: "glow", at: HERO }, { emote: HERO, kind: "heart" }, { camera: "flash-gold" });
  } else if (sec.combat) {
    const f = [...present].find((x) => isMonster(x)) ?? foes[0] ?? others[0];
    if (f) L.push({ run: f, to: "near:" + HERO }, { emote: HERO, kind: "!" }, { pose: "attack", who: HERO }, { camera: "shake" }, { sfx: "roar" });
  }
  return beats;
}

/** The beats of a section: the book's staging when it has one, else made up from the text. */
export function sectionBeats(book: Book, sec: Section): Beat[] {
  if (sec.stage?.length) return sec.stage.filter((b) => b && typeof b.t === "string" && b.t.trim());
  return synthBeats(book, sec);
}

// ================================================================== the director
interface Scoped { until: number; stop: () => void }

/** Sounds named by the staging, mapped onto the game's effects. */
function playSound(name: string) {
  switch (name) {
    case "roar": sfx("spawn"); sfx("encounter"); break;
    case "thunder": sfx("demolish"); sfx("cast", "lightning"); break;
    case "door": sfx("stairs"); break;
    case "magic": sfx("cast"); break;
    case "splash": sfx("water"); break;
    case "horn": sfx("charge"); break;
    case "scream": sfx("death"); break;
    case "step": sfx("step"); setTimeout(() => sfx("step"), 260); setTimeout(() => sfx("step"), 520); break;
    default: sfx(name);
  }
}

export class Director {
  readonly beats: Beat[];
  readonly staged: boolean;
  /** Index of the beat being performed. */
  at = -1;
  private scoped: Scoped[] = [];
  private uid = 0;
  private instant = false;
  /** Movements of this beat per actor: later actions on the same actor wait for them. */
  private pending = new Map<Actor, Promise<void>>();
  /** Spots handed out in this beat to actors still on their way (they walk in after a delay). */
  private claimed = new Map<Actor, { x: number; y: number }>();
  /** Ids that enter and die in the same beat: they are found lying there. */
  private doa = new Set<string>();

  private after(a: Actor, fn: () => Promise<unknown> | void): Promise<void> {
    const prev = this.instant ? undefined : this.pending.get(a);
    const p = (prev ? prev.then(() => fn()) : Promise.resolve(fn())).then(() => undefined);
    if (!this.instant) this.pending.set(a, p);
    return p;
  }
  constructor(readonly stage: Stage, readonly book: Book, readonly sec: Section, readonly heroLook: Look) {
    this.staged = !!sec.stage?.length;
    this.beats = sectionBeats(book, sec);
  }

  /** Puts the opening cast on stage: everyone in scene.actors who does not walk in later. */
  setup() {
    const entering = new Set<string>();
    for (const b of this.beats) for (const a of b.do ?? []) if ("enter" in a && a.enter) entering.add(base(str(a.enter)));
    const cast = [HERO, ...this.sec.scene.actors.filter((a) => !isHero(a) && !entering.has(a))];
    const st = this.stage;
    const slots = st.scene.slots;
    st.actors = [];
    const order = cast.length === 1 ? [entering.size ? 1 : 2] : cast.length === 2 ? [1, 4] : cast.length === 3 ? [1, 3, 4] : [1, 2, 3, 4, 5, 0];
    cast.slice(0, 6).forEach((id, i) => {
      const s = slots[order[i] ?? i];
      st.actors.push({ id, x: s.x, y: s.y, look: isHero(id) ? this.heroLook : undefined, facing: i === 0 ? "right" : "left", pose: "idle", phase: (i * 337) % 900 });
    });
    st.cam.x = W / 2; st.cam.y = H / 2; st.cam.zoom = 1;
  }

  // ---------------------------------------------------------------- positions
  private slot(n: number) {
    const s = this.stage.scene.slots;
    return s[clamp(Math.round(n), 0, s.length - 1)];
  }
  private hero() { return this.stage.actors.find((a) => isHero(a.id)); }
  /** All actors of a name (a group entered with n > 1 is "giak", "giak#2"...). */
  private group(id: string) {
    const b = base(id);
    const exact = this.stage.actors.filter((a) => a.id === id);
    if (id.includes("#")) return exact;
    return this.stage.actors.filter((a) => base(a.id) === b || (b === "hero" && isHero(a.id)));
  }
  private one(id: string): Actor | undefined {
    const g = this.group(id);
    return g.find((a) => !a.hidden && a.pose !== "dead") ?? g.find((a) => !a.hidden) ?? g[0];
  }
  /** An actor the staging uses before it entered: it steps in quietly. */
  private ensure(id: string): Actor {
    const a = this.one(id);
    if (a) {
      if (a.hidden) this.bringBack(a);
      return a;
    }
    const x = this.freeX(4);
    const s = this.slot(4);
    const n: Actor = { id: base(id), x, y: s.y, facing: "left", pose: "idle", phase: Math.floor(Math.random() * 900), alpha: 0, look: isHero(id) ? this.heroLook : undefined };
    this.stage.actors.push(n);
    void this.fadeTo(n, 1, 500);
    return n;
  }
  private bringBack(a: Actor) {
    a.hidden = false;
    a.alpha = a.alpha ?? 1;
    if (a.x < -10 || a.x > W + 10) {
      const s = this.slot(a.x < 0 ? 1 : 4);
      void this.walk(a, s.x, s.y, false);
    }
  }
  /** A free spot near a slot (people should not stand inside each other). */
  private freeX(n: number, self?: Actor) {
    const s = this.slot(n);
    let x = s.x;
    for (let k = 0; k < 5; k++) {
      if (!this.stage.actors.some((a) => a !== self && !a.hidden && Math.abs(a.x - x) < 14 && !(a.to && Math.abs(a.to.x - x) > 14))) return x;
      x += (k % 2 ? -1 : 1) * (k + 1) * 16;
    }
    return s.x;
  }
  /** Smaller and higher when standing further back (crowd rows). */
  private depthScale(y: number) {
    return clamp(1 - (this.slot(2).y - y) / 62, 0.78, 1);
  }
  /**
   * Standing spots for n members of a group around (tx, ty): staggered depth rows (front row
   * first), never inside the hero or another actor, preferring the given side of the hero.
   */
  private crowdSpots(tx: number, ty: number, n: number, sprite: string, side: number, skip: Set<Actor>) {
    const st = this.stage, hero = this.hero();
    const wOf = (id: string) => (isMonster(id) ? creatureSize(id).w * 0.5 : 13);
    const goal = (a: Actor) => this.claimed.get(a) ?? a.to ?? a;
    const taken = st.actors
      .filter((a) => !a.hidden && !skip.has(a) && a.pose !== "dead" && goal(a).x > -8 && goal(a).x < W + 8)
      .map((a) => ({ x: goal(a).x, y: goal(a).y, w: wOf(a.sprite ?? a.id), hero: isHero(a.id) }));
    const me = Math.max(12, wOf(sprite));
    const rows = [0, -7, -13];
    const out: { x: number; y: number }[] = [];
    const hx = hero && !hero.hidden && !skip.has(hero) ? hero.to?.x ?? hero.x : NaN;
    // a phone shows only part of the stage around the cast: stay within a view's width of the hero
    const vw = Math.max(150, st.visibleX[1] - st.visibleX[0]);
    const mid = Number.isFinite(hx) ? clamp(hx, vw / 2, W - vw / 2) : clamp(tx, vw / 2, W - vw / 2);
    for (let k = 0; k < n; k++) {
      let best: { x: number; y: number } | null = null, bc = Infinity;
      for (let r = 0; r < rows.length; r++) {
        const y = ty + rows[r];
        for (let x = 10 + (r % 2) * 2; x <= W - 10; x += 4) {
          if (Number.isFinite(hx) && Math.abs(x - hx) < (r ? 22 : 26)) continue;
          // same row: a full body apart; rows behind: staggered, peeking between the ones in front
          if (taken.some((o) => Math.abs(o.x - x) < ((me + o.w) / 2) * (o.hero ? 0.9 : Math.abs(o.y - y) < 5 ? 0.8 : 0.3))) continue;
          const cross = Number.isFinite(hx) && side && Math.sign(x - hx) !== side && Math.sign(tx - hx) === side ? 110 : 0;
          const c = Math.abs(x - tx) + r * 16 + cross + Math.max(0, Math.abs(x - mid) - (vw / 2 - 12)) * 5;
          if (c < bc) { bc = c; best = { x, y }; }
        }
      }
      const pick = best ?? { x: clamp(tx + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 13, 8, W - 8), y: ty };
      out.push(pick);
      taken.push({ ...pick, w: me, hero: false });
    }
    return out;
  }
  /** Where a position word / number lands (x, ground y). */
  private place(to: unknown, who?: Actor): { x: number; y: number; off?: "left" | "right" | "top" } {
    const s = str(to);
    const gy = who?.y ?? this.slot(2).y;
    if (s === "offscreen-right" || s === "right-off" || s === "out-right") return { x: W + 34, y: gy, off: "right" };
    if (s === "offscreen-left" || s === "left-off" || s === "out-left") return { x: -34, y: gy, off: "left" };
    if (s === "top" || s === "up" || s === "offscreen-top") return { x: who?.x ?? W / 2, y: gy, off: "top" };
    if (s === "center" || s === "centre") return { x: W / 2, y: this.slot(2).y };
    if (s === "left") return { x: this.slot(0).x, y: this.slot(0).y };
    if (s === "right") return { x: this.slot(5).x, y: this.slot(5).y };
    if (s.startsWith("near:") || (!/^\d+$/.test(s) && this.one(s))) {
      const t = this.one(s.replace(/^near:/, ""));
      if (t && t !== who) {
        const side = who ? (who.x <= t.x ? -1 : 1) : -1;
        return { x: clamp(t.x + side * 26, 10, W - 10), y: t.y };
      }
    }
    const n = Number(s);
    if (Number.isFinite(n) && s !== "") {
      const sl = this.slot(n);
      return { x: this.freeX(n, who), y: sl.y };
    }
    return { x: who?.x ?? W / 2, y: gy };
  }
  private pointOf(at: unknown): { x: number; y: number; who?: Actor; all?: boolean; sky?: boolean } {
    const s = str(at);
    if (s === "all") return { x: W / 2, y: this.slot(2).y, all: true };
    if (s === "sky") return { x: W / 2 + rnd(-60, 60), y: 34, sky: true };
    if (s && !/^\d+$/.test(s)) {
      const a = this.one(s);
      if (a && !a.hidden) return { x: a.x, y: a.y, who: a };
    }
    if (s === "") { const hr = this.hero(); if (hr) return { x: hr.x, y: hr.y, who: hr }; }
    const sl = this.slot(Number(s) || 0);
    return { x: sl.x, y: sl.y };
  }

  // ---------------------------------------------------------------- motion
  private walk(a: Actor, x: number, y: number, run: boolean): Promise<void> {
    const flying = isMonster(a.sprite ?? a.id) && creatureSize(a.sprite ?? a.id).flying;
    const speed = run ? (flying ? 0.16 : 0.125) : flying ? 0.085 : isMonster(a.id) ? 0.06 : 0.05;
    if (a.pose === "kneel" || a.pose === "dead") a.pose = "idle";
    a.run = run;
    return this.stage.moveTo(a, x, y, speed);
  }
  private fadeTo(a: Actor, to: number, ms: number) {
    if (a.alpha === undefined) a.alpha = 1;
    return this.stage.tween(a as unknown as Record<string, number>, "alpha", to, ms);
  }
  private faceToward(a: Actor, b: Actor) {
    if (Math.abs(b.x - a.x) > 2) a.facing = b.x > a.x ? "right" : "left";
  }

  // ---------------------------------------------------------------- beats
  /** Performs beat i. Resolves when its movements are done. */
  beat(i: number, instant = false): Promise<void> {
    this.at = i;
    this.instant = instant;
    const st = this.stage;
    const b = this.beats[i];
    // effects of earlier beats that last only a while
    this.scoped = this.scoped.filter((s) => { if (s.until <= i) { s.stop(); return false; } return true; });
    for (const a of st.actors) if (a.bubble) a.bubble = undefined;
    const list = (b?.do ?? []).filter((a) => a && typeof a === "object");
    const hasCam = list.some((a) => "camera" in a && /zoom|pan|reveal|push/.test(str(a.camera)));
    if (!hasCam && !instant && (st.cam.zoom !== 1 || st.cam.x !== W / 2 || st.cam.y !== H / 2)) void st.camTo(W / 2, H / 2, 1, 700);
    if (st.look.fade > 0.4 && !list.some((a) => "camera" in a && str(a.camera) === "fade-out")) void st.tween(st.look, "fade", 0, instant ? 0 : 900);
    const waits: Promise<unknown>[] = [];
    const facedInBeat = new Set<string>();
    this.pending.clear();
    this.doa.clear();
    this.claimed.clear();
    const entering = new Set(list.filter((a) => "enter" in a && a.enter).map((a) => base(str((a as Record<string, unknown>).enter))));
    for (const a of list) {
      const R = a as Record<string, unknown>;
      if ("pose" in a && a.pose) {
        const who = R.as ? str(a.pose) : str(R.who) || HERO, pose = R.as ? str(R.as) : str(a.pose);
        if ((pose === "dead" || pose === "kneel") && entering.has(base(who))) this.doa.add(base(who));
      }
    }
    const entered: Actor[] = [];
    for (const a of list) if ("face" in a) facedInBeat.add(base(str(a.face)));
    // the beat's subject, for the camera
    let subject: { x: number; y: number } | undefined;
    for (const a of list) {
      try {
        const r = this.act(a, entered);
        if (r.wait) waits.push(r.wait);
        if (!subject && r.subject) subject = r.subject;
      } catch (e) { console.warn("stage action", a, e); }
    }
    for (const a of list) if ("camera" in a) this.camera(str(a.camera), subject ?? this.subjectOf(a), list);
    // newcomers face the hero, the hero faces the newcomer
    const hero = this.hero();
    if (hero && entered.length) {
      const after = Promise.all(waits).then(() => {
        for (const e of entered) if (!e.hidden && !facedInBeat.has(base(e.id)) && e.x > 0 && e.x < W) this.faceToward(e, hero);
        const first = entered.find((e) => !e.hidden && e.x > 0 && e.x < W && !isHero(e.id));
        if (first && !facedInBeat.has(HERO) && !hero.to && hero.pose !== "dead") this.faceToward(hero, first);
      });
      waits.push(after);
    }
    if (instant) { st.settle(); return Promise.resolve(); }
    return Promise.race([Promise.all(waits).then(() => undefined), new Promise<void>((r) => setTimeout(r, 6500))]);
  }

  private subjectOf(a: StageAction): { x: number; y: number } | undefined {
    const on = str((a as Record<string, unknown>).on);
    const t = on ? this.one(on) : undefined;
    return t ? { x: t.x, y: t.y } : undefined;
  }

  /** Applies one action. */
  private act(a: StageAction, entered: Actor[]): { wait?: Promise<unknown>; subject?: { x: number; y: number } } {
    const st = this.stage;
    const R = a as Record<string, string | number | undefined>;
    if ("enter" in a && a.enter) return this.enter(str(a.enter), str(R.from) || "right", R.at, Number(R.n) || 1, entered, R.n !== undefined && R.n !== "");
    if ("move" in a && a.move) return this.go(str(a.move), R.to, false);
    if ("run" in a && a.run) return this.go(str(a.run), R.to, true);
    if ("pose" in a && a.pose) {
      // {"pose":"kneel","who":"x"} — older files: {"pose":"x","as":"kneel"} or {"pose":"kneel"}
      let pose = str(a.pose), who = str(R.who);
      if (R.as) { who = pose; pose = str(R.as); }
      return this.pose(who || HERO, pose);
    }
    if ("face" in a && a.face) {
      const dir = str(R.dir);
      for (const x of this.group(str(a.face))) {
        void this.after(x, () => {
          if (dir.startsWith("toward:")) { const t = this.one(dir.slice(7)); if (t) this.faceToward(x, t); }
          else if (dir === "left" || dir === "right") x.facing = dir;
          else if (dir === "up" || dir === "down") x.facing = isMonster(x.id) ? x.facing : dir;
        });
      }
      return {};
    }
    if ("say" in a && a.say) {
      const x = this.ensure(str(a.say));
      x.bubble = { text: str(R.text) || "…", until: st.now + 120000, at: st.now };
      if (!this.instant) sfx("blip", "360");
      return { subject: { x: x.x, y: x.y } };
    }
    if ("emote" in a && a.emote) {
      const x = this.ensure(str(a.emote));
      const kind = str(R.kind) || "!";
      x.emote = { kind, at: st.now + (this.instant ? -400 : 0), until: st.now + (["zzz", "sad", "...", "heart"].includes(kind) ? 3400 : 2600) };
      if (!this.instant) sfx("blip", kind === "!" ? "620" : kind === "?" ? "480" : "300");
      return {};
    }
    if ("fx" in a && a.fx) {
      const word = str(a.fx).trim().toLowerCase();
      // an effect is decoration: whatever the word, it never stops the performance
      try { if (!this.instant || ["darkness", "fire", "smoke"].includes(word)) this.fx(word, R.at); } catch { /* unknown or broken effect: skipped */ }
      return { subject: this.instant ? undefined : this.pointOf(R.at) };
    }
    if ("prop" in a && a.prop) return this.prop(str(a.prop), R.at, str(R.state));
    if ("remove" in a && a.remove) return this.remove(str(a.remove));
    if ("weather" in a && a.weather) {
      const w = str(a.weather) as Stage["spec"]["weather"];
      if (["clear", "cloudy", "rain", "storm", "fog", "snow", "wind"].includes(w) && w !== st.spec.weather) st.setScene({ ...st.spec, weather: w }, this.instant ? 0 : 1800);
      return {};
    }
    if ("time" in a && a.time) {
      const tm = str(a.time) as Stage["spec"]["time"];
      if (["dawn", "day", "dusk", "night"].includes(tm) && tm !== st.spec.time) {
        st.setScene({ ...st.spec, time: tm }, this.instant ? 0 : 3200);
        if (!this.instant) st.timeSweep(tm, 3200);
      }
      return {};
    }
    if ("sfx" in a && a.sfx) { if (!this.instant) playSound(str(a.sfx)); return {}; }
    return {};
  }

  private enter(id: string, from: string, at: unknown, n: number, entered: Actor[], hasN = false) {
    const st = this.stage;
    const b = base(id);
    const sprite = b;
    const flying = isMonster(sprite) && creatureSize(sprite).flying;
    const waits: Promise<unknown>[] = [];
    // a big group shows a few of its members (and a "×N" hint), the more crowded the fewer
    const others = st.actors.filter((a) => !a.hidden && !isHero(a.id) && a.pose !== "dead" && base(a.id) !== b).length;
    const n0 = clamp(n, 1, others >= 6 ? 2 : others >= 3 ? 3 : 4);
    let subject: { x: number; y: number } | undefined;
    const existing = this.group(id);
    const onStage = (a: Actor) => !a.hidden && a.x > -8 && a.x < W + 8 && a.pose !== "dead" && (a.alpha ?? 1) > 0.5;
    const standing = existing.filter(onStage);
    // already there: a named character just moves to its new spot; more of a kind (giaks, guards) arrive
    const generic = isMonster(b) || /soldier|guard|cavalry|ranger|refugee|bandit|robber|villager|warrior|knight|townsfolk|peasant|militia|sentry|pirate|sailor|monk|priest/.test(b);
    if (standing.length && !hasN && !generic) {
      const target = this.place(at === undefined || at === "" ? 3 : at, standing[0]);
      if (this.instant) { standing[0].x = target.x; standing[0].y = target.y; } else waits.push(this.walk(standing[0], target.x, target.y, false));
      entered.push(standing[0]);
      return { wait: Promise.all(waits), subject: { x: target.x, y: target.y } };
    }
    // the ones who left (ran off, removed) come back first, then new ones
    const reuse = standing.length ? [] : existing.filter((a) => !onStage(a) && a.pose !== "dead");
    let made = existing.length;
    const atN0 = at === undefined || at === "" ? 3 : Number(at);
    const target = this.place(Number.isFinite(atN0) ? atN0 : at);
    // a crowd does not stand inside the hero: it gathers on the side it came from
    const hero = this.hero();
    if (hero && !isHero(b) && !hero.hidden && Math.abs(hero.x - target.x) < 22) {
      const side = from === "left" ? -1 : from === "right" ? 1 : target.x < W / 2 ? -1 : 1;
      target.x = clamp(hero.x + side * (n0 > 1 ? 40 : 30), 14, W - 14);
    }
    const side = hero && !isHero(b) ? (target.x < hero.x ? -1 : 1) : 0;
    const spots = n0 > 1 || standing.length ? this.crowdSpots(target.x, target.y, n0, sprite, side, new Set()) : [{ x: target.x, y: target.y }];
    for (let k = 0; k < n0; k++) {
      const tx = spots[k].x, ty = spots[k].y;
      let a = reuse[k];
      if (!a) {
        a = { id: made ? `${b}#${made + 1}` : b, sprite, x: tx, y: ty, facing: "left", pose: "idle", phase: Math.floor(Math.random() * 900), look: isHero(b) ? this.heroLook : undefined };
        made++;
        st.actors.push(a);
      }
      a.hidden = false; a.pose = "idle"; a.alpha = 1; a.z = 0;
      a.scale = this.depthScale(ty);
      this.claimed.set(a, { x: tx, y: ty });
      if (k === 0) a.crowd = n > n0 ? n + standing.length : undefined;
      entered.push(a);
      if (!subject) subject = { x: tx, y: ty };
      const delay = k * 160;
      if (this.instant) { a.x = tx; a.y = ty; continue; }
      if (this.doa.has(b)) {
        // already lying (or kneeling) there when the beat begins: it fades into view
        a.x = tx; a.y = ty; a.alpha = 0;
        this.pending.set(a, this.fadeTo(a, 1, 500));
        continue;
      }
      const w0 = waits.length;
      if (from === "top") {
        a.x = tx + (flying ? 70 : 0) + k * 10; a.y = ty; a.z = flying ? 120 : 100;
        a.facing = flying ? "left" : a.facing;
        const ms = flying ? 1100 : 520;
        waits.push(new Promise<void>((res) => setTimeout(() => {
          void st.tween(a as unknown as Record<string, number>, "x", tx, ms, easeOut);
          void st.tween(a as unknown as Record<string, number>, "z", 0, ms, flying ? easeOut : (q: number) => q * q).then(() => {
            if (!flying) { st.shake(180, 0.8); this.dust(a!.x, a!.y, 8); }
            res();
          });
        }, delay)));
        if (flying && k === 0) { sfx("whoosh"); this.windGust(); }
      } else if (from === "back") {
        a.x = tx; a.y = ty - 6; a.alpha = 0;
        a.facing = tx > W / 2 ? "left" : "right";
        waits.push(new Promise<void>((res) => setTimeout(() => {
          void this.fadeTo(a!, 1, 650);
          void this.walk(a!, tx, ty, false).then(res);
        }, delay)));
      } else {
        const left = from === "left";
        a.x = left ? -26 - k * 20 : W + 26 + k * 20;
        a.y = ty;
        a.facing = left ? "right" : "left";
        waits.push(new Promise<void>((res) => setTimeout(() => void this.walk(a!, tx, ty, isMonster(b) && this.danger()).then(res), delay)));
      }
      if (waits.length > w0) this.pending.set(a, waits[waits.length - 1].then(() => undefined));
    }
    return { wait: Promise.all(waits), subject };
  }

  private danger() { return ["danger", "combat", "tense"].includes(this.sec.scene.mood); }

  private go(id: string, to: unknown, run: boolean) {
    const waits: Promise<unknown>[] = [];
    const members = this.group(id).filter((a) => a.pose !== "dead" || run);
    const list = members.length ? members : [this.ensure(id)];
    let subject: { x: number; y: number } | undefined;
    const p0 = this.place(to, list[0]);
    const hero = this.hero();
    const spots = list.length > 1 && !p0.off ? this.crowdSpots(p0.x, p0.y, list.length, list[0].sprite ?? list[0].id, hero ? Math.sign(p0.x - hero.x) : 0, new Set(list)) : null;
    list.forEach((a, k) => {
      if (a.hidden) this.bringBack(a);
      const p = k && spots ? { ...p0, x: spots[k].x, y: spots[k].y } : this.place(to, a);
      if (spots && !k) { p.x = spots[0].x; p.y = spots[0].y; }
      let x = p.x;
      if (!p.off) { const sc = spots ? this.depthScale(p.y) : 1; a.scale = a.scale ?? 1; if (this.instant) a.scale = sc; else void this.stage.tween(a as unknown as Record<string, number>, "scale", sc, 600); }
      if (p.off === "top") {
        // flies away upwards
        if (this.instant) { a.hidden = true; return; }
        waits.push(this.after(a, () => this.stage.tween(a as unknown as Record<string, number>, "z", 150, run ? 700 : 1100, (q) => q * q).then(() => { a.hidden = true; a.z = 0; })));
        return;
      }
      if (p.off) x += (p.off === "right" ? 1 : -1) * k * 14;
      if (!subject) subject = { x, y: p.y };
      if (this.instant) { a.x = x; a.y = p.y; if (p.off) a.hidden = true; return; }
      waits.push(this.after(a, () => this.walk(a, x, p.y, run).then(() => { if (p.off) a.hidden = true; })));
    });
    return { wait: Promise.all(waits), subject };
  }

  private pose(id: string, pose: string) {
    const st = this.stage;
    const g = this.group(id);
    const alive = g.filter((a) => a.pose !== "dead");
    // deaths and wounds take one of a group; the others stand
    const targets = pose === "dead" || pose === "hurt" ? (alive.length ? [alive[0]] : g.slice(0, 1)) : g;
    const list = targets.length ? targets : [this.ensure(id)];
    const waits: Promise<unknown>[] = [];
    const one = (a: Actor): Promise<unknown> | void => {
      const waits: Promise<unknown>[] = [];
      if (a.hidden) this.bringBack(a);
      if (this.doa.has(base(a.id)) && (pose === "dead" || pose === "kneel")) { a.pose = pose === "kneel" && isMonster(a.sprite ?? a.id) ? "idle" : (pose as Actor["pose"]); return; }
      const fly = isMonster(a.sprite ?? a.id) && creatureSize(a.sprite ?? a.id).flying;
      switch (pose) {
        case "kneel":
          a.pose = isMonster(a.sprite ?? a.id) ? "idle" : "kneel";
          if (!this.instant) this.dust(a.x, a.y, 4);
          break;
        case "dead": {
          if (this.instant) { a.pose = "dead"; break; }
          st.play(a, "hurt", 260);
          a.flash = st.now + 140;
          waits.push(new Promise<void>((res) => setTimeout(() => {
            a.pose = "dead";
            a.once = undefined;
            if (fly) { a.z = 18; void st.tween(a as unknown as Record<string, number>, "z", 0, 420, (q) => q * q).then(() => { this.dust(a.x, a.y, 12); st.shake(200, 1); }); }
            else { this.dust(a.x, a.y, 9); st.shake(140, 0.6); }
            res();
          }, 260)));
          break;
        }
        case "hurt":
          if (this.instant) break;
          st.play(a, "hurt", 420);
          a.flash = st.now + 120; a.shake = st.now + 320;
          st.burst(a.x, a.y - 24, "#e8402a", 7, 1.2, { g: 0.006, floor: a.y });
          break;
        case "attack": {
          if (this.instant) break;
          st.play(a, "attack", 460);
          a.lunge = 9;
          const dir = a.facing === "left" ? -1 : 1;
          const foe = this.stage.actors.find((o) => o !== a && !o.hidden && o.pose !== "dead" && Math.sign(o.x - a.x) === dir && Math.abs(o.x - a.x) < 70);
          this.slash(a.x + dir * 14, a.y - 24, dir);
          if (foe) setTimeout(() => { this.sparks(foe.x - dir * 6, foe.y - 26, 10); foe.shake = st.now + 220; }, 170);
          sfx("whoosh");
          break;
        }
        case "cast":
          if (this.instant) break;
          st.play(a, "cast", 800);
          this.magic(a.x, a.y, 1400, "#c8a2ff");
          break;
        case "walk": {
          const dir = a.facing === "left" ? -1 : 1;
          const x = clamp(a.x + dir * 28, 10, W - 10);
          if (this.instant) a.x = x; else waits.push(this.walk(a, x, a.y, false));
          break;
        }
        default:
          if (a.pose === "dead" && !this.instant) this.dust(a.x, a.y, 4);
          a.pose = "idle";
      }
      return Promise.all(waits);
    };
    for (const a of list) waits.push(this.after(a, () => one(a)));
    const f = list[0];
    return { wait: Promise.all(waits), subject: f ? { x: f.x, y: f.y } : undefined };
  }

  private remove(id: string) {
    const st = this.stage;
    const waits: Promise<unknown>[] = [];
    const g = this.group(id);
    for (const a of g) {
      if (this.instant) { a.hidden = true; continue; }
      const fly = isMonster(a.sprite ?? a.id) && creatureSize(a.sprite ?? a.id).flying;
      if (fly && a.pose !== "dead") { waits.push(st.tween(a as unknown as Record<string, number>, "z", 150, 900, (q) => q * q).then(() => { a.hidden = true; a.z = 0; })); continue; }
      waits.push(this.after(a, () => { this.dust(a.x, a.y, 5); return this.fadeTo(a, 0, 600).then(() => { a.hidden = true; a.alpha = 1; }); }));
    }
    // a prop of that name goes too
    const kind = isKnownProp(id) ? propKind(id) : "";
    for (const p of st.props.filter((q) => q.word === id || q.id === id || (!g.length && kind && propKind(q.word) === kind))) {
      st.stopEmitter(`prop:${p.id}`);
      if (this.instant) { st.props = st.props.filter((q) => q !== p); continue; }
      waits.push(st.tween(p as unknown as Record<string, number>, "alpha", 0, 500).then(() => { st.props = st.props.filter((q) => q !== p); }));
    }
    return { wait: Promise.all(waits) };
  }

  // ---------------------------------------------------------------- props
  private prop(word: string, at: unknown, state: string) {
    const st = this.stage;
    const kind = propKind(word);
    const art = propArt(word, state);
    const n = at === undefined || at === "" ? NaN : Number(at);
    let p = st.props.find((q) => q.word === word) ?? st.props.find((q) => propKind(q.word) === kind);
    const small = art.c.height <= 12;
    let x: number, y: number;
    const fresh = !p || Number.isFinite(n);
    if (Number.isFinite(n)) {
      const s = this.slot(n);
      x = s.x; y = s.y + (small ? 3 : art.flat ? 2 : -5);
    } else if (p) { x = p.x; y = p.y; }
    else { const s = this.slot(4); x = s.x + 14; y = s.y - 5; }
    // slot allocation: the asked spot when it is free, else the nearest free one
    if (fresh && !art.flat) x = this.freePropX(x, y, isLivingProp(word) ? creatureSize("horse").w * 0.7 : art.c.width, small, p);
    x = clamp(x, art.c.width / 2 + 2, W - art.c.width / 2 - 2);
    if (p) {
      const changed = p.state !== state;
      p.state = state;
      if (Number.isFinite(n) && Math.abs(p.x - x) > 4) p.x = x;
      if (changed && !this.instant) {
        if (state === "open") { this.glint(p.x, p.y - art.c.height / 2, kind === "chest" ? 14 : 4); if (kind === "chest") sfx("chest"); }
        if (state === "broken") { this.debris(p.x, p.y - art.c.height / 2); sfx("break"); st.shake(160, 0.7); }
      }
    } else {
      p = { id: `p${++this.uid}`, word, state, x, y, alpha: 1, born: this.instant ? st.now - 1000 : st.now, flip: x < W / 2 } as StageProp;
      st.props.push(p);
      if (!this.instant && !art.flat && !small) this.dust(x, y, 4);
      if (!this.instant && ["gem", "key", "pouch", "sword", "scroll"].includes(kind)) this.glint(x, y - 4, 6);
    }
    this.propFire(p);
    return { subject: { x: p.x, y: p.y } };
  }

  /** Nearest x to `x0` where a prop of width w stands clear of people and of the other props. */
  private freePropX(x0: number, y: number, w: number, small: boolean, self?: StageProp) {
    const st = this.stage, half = w / 2;
    const lo = half + 2, hi = W - half - 2;
    const props = st.props.filter((q) => q !== self).map((q) => { const a = propArt(q.word, q.state); return { x: q.to?.x ?? q.x, y: q.y, half: (isLivingProp(q.word) ? creatureSize("horse").w * 0.7 : a.c.width) / 2, flat: a.flat }; }).filter((q) => !q.flat);
    const busy = (cx: number) =>
      cx < lo || cx > hi ||
      (!small && st.actors.some((a) => { const ax = (this.claimed.get(a) ?? a.to ?? a).x; return !a.hidden && a.pose !== "dead" && ax > -8 && ax < W + 8 && Math.abs(ax - cx) < half + 6; })) ||
      props.some((q) => Math.abs(q.x - cx) < half + q.half + 3 && Math.abs(q.y - y) < 16);
    for (let d = 0; d <= W; d += 6) {
      if (!busy(x0 + d)) return x0 + d;
      if (d && !busy(x0 - d)) return x0 - d;
    }
    // nothing free for people too: at least keep clear of the other props
    for (let d = 0; d <= W; d += 6) {
      const ok = (cx: number) => cx >= lo && cx <= hi && !props.some((q) => Math.abs(q.x - cx) < half + q.half + 3 && Math.abs(q.y - y) < 16);
      if (ok(x0 + d)) return x0 + d;
      if (ok(x0 - d)) return x0 - d;
    }
    return x0;
  }

  /** Flames of a burning prop, or the small flame of a campfire / candle / torch. */
  private propFire(p: StageProp) {
    const st = this.stage;
    const art = propArt(p.word, p.state);
    const id = `prop:${p.id}`;
    st.stopEmitter(id);
    const burning = p.state === "burning";
    const lit = isLitProp(p.word) && p.state !== "broken";
    if (!burning && !lit) return;
    const spots = art.flames ?? [];
    st.emit({
      id, until: Infinity,
      tick: (dt) => {
        if (!st.props.includes(p)) { st.stopEmitter(id); return; }
        for (const f of spots) this.flameTick(p.x + f.x, p.y + f.y + (burning ? art.c.height * 0 : 0), f.small ? 1 : f.w, dt, f.small ? 0.25 : burning ? 1.2 : 0.7, !f.small);
      },
    });
  }

  // ---------------------------------------------------------------- effects
  private beatScoped(id: string, extra = 2) {
    const st = this.stage;
    this.scoped.push({ until: this.at + extra, stop: () => st.stopEmitter(id) });
  }

  private fx(kind: string, at: unknown) {
    const st = this.stage;
    const P = this.pointOf(at);
    const points = P.all ? [56, 120, 190, 262].map((x) => ({ x: x + rnd(-10, 10), y: this.slot(2).y })) : [P];
    const id = `fx${++this.uid}`;
    switch (kind) {
      case "fire": {
        for (const [i, q] of points.entries()) {
          const w = P.who ? 10 : P.all ? 26 : 18;
          st.emit({ id: `${id}-${i}`, until: Infinity, tick: (dt) => this.flameTick(q.x, q.y - 2, w, dt, P.all ? 1 : 1.2, true) });
          this.beatScoped(`${id}-${i}`, 3);
          st.decal(scorch(), q.x, q.y);
        }
        if (!this.instant) sfx("cast", "fire");
        break;
      }
      case "smoke": {
        for (const [i, q] of points.entries()) {
          const top = P.sky ? 40 : q.y - 6;
          st.emit({
            id: `${id}-s${i}`, until: Infinity,
            tick: (dt) => {
              if (Math.random() < dt / 70) {
                const r = Math.random();
                st.particles.push({ x: q.x + rnd(-10, 10), y: top + rnd(-2, 2), vx: rnd(0.08, 0.4), vy: rnd(-0.5, -0.28), life: 0, max: rnd(3000, 4400), col: r < 0.35 ? "#5e5a62" : r < 0.7 ? "#8a8590" : "#b0aab2", size: rnd(2.5, 4.5), shape: "puff", grow: 7, drag: 0.75, a: 0.34 });
              }
            },
          });
          this.beatScoped(`${id}-s${i}`, 3);
        }
        break;
      }
      case "explosion": {
        const q = P.who ? { x: P.x, y: P.y - 18 } : P.sky ? P : { x: P.x, y: P.y - 12 };
        st.flash("#fff4d0", 220);
        st.shake(520, 2);
        const t0 = st.now;
        st.overlays.push((g, t) => {
          const k = (t - t0) / 520;
          if (k > 1) return false;
          const r = 6 + easeOut(Math.min(1, k * 1.6)) * 30;
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 1 - k;
          const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
          gr.addColorStop(0, "#fffbe0"); gr.addColorStop(0.35, "#ffd050"); gr.addColorStop(0.7, "rgba(240,90,20,.8)"); gr.addColorStop(1, "rgba(200,40,10,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill();
          g.restore();
          return true;
        });
        this.ring(q.x, q.y, "#ffe0a0", 70, 420, false);
        for (let i = 0; i < 46; i++) {
          const a = Math.random() * Math.PI * 2, v = rnd(0.6, 3.4);
          st.particles.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, life: 0, max: rnd(350, 750), col: ["#fff6c0", "#ffd050", "#ff8a20", "#e83a10"][i % 4], size: rnd(1, 3), glow: true, g: 0.003, drag: 0.2 });
        }
        for (let i = 0; i < 14; i++) st.particles.push({ x: q.x + rnd(-10, 10), y: q.y + rnd(-6, 6), vx: rnd(-0.8, 0.8), vy: rnd(-0.9, -0.2), life: -rnd(120, 320), max: rnd(1500, 2600), col: "#4a4240", size: rnd(4, 7), shape: "puff", grow: 9, drag: 0.35, a: 0.45 });
        for (let i = 0; i < 10; i++) st.particles.push({ x: q.x, y: q.y, vx: rnd(-2.4, 2.4), vy: rnd(-3.2, -1.2), life: 0, max: 2400, col: "#5a4a3a", size: rnd(1, 2), shape: "rock", g: 0.008, floor: (P.who?.y ?? this.slot(2).y) + rnd(-2, 4) });
        st.decal(scorch(), q.x, P.who?.y ?? this.slot(2).y);
        if (!this.instant) { sfx("impact", "fire"); sfx("demolish"); }
        break;
      }
      case "lightning": {
        const tx = P.sky ? rnd(40, W - 40) : P.x, ty = P.sky ? rnd(60, 90) : P.y;
        this.bolt(tx, ty);
        setTimeout(() => this.bolt(tx + rnd(-30, 30), ty - rnd(0, 20)), 140);
        st.flash("#e8f0ff", 260);
        st.shake(300, 1.2);
        if (!P.sky) this.sparks(tx, ty - 2, 16);
        if (!this.instant) sfx("cast", "lightning");
        break;
      }
      case "blood": {
        const q = P.who ? { x: P.x, y: P.y - 24 } : { x: P.x, y: P.y - 20 };
        const floor = P.who?.y ?? P.y;
        for (let i = 0; i < 22; i++) st.particles.push({ x: q.x + rnd(-3, 3), y: q.y + rnd(-4, 4), vx: rnd(-1.3, 1.3), vy: rnd(-2, -0.2), life: 0, max: rnd(700, 1300), col: i % 3 ? "#b01810" : "#e0301e", size: Math.random() < 0.3 ? 2 : 1, g: 0.007, floor });
        setTimeout(() => st.decal(bloodPool(), q.x + rnd(-4, 4), floor + 1), 260);
        if (P.who) { P.who.flash = st.now + 100; P.who.shake = st.now + 260; }
        break;
      }
      case "magic":
        this.magic(P.x, P.who ? P.y : P.y, 2600, "#b88aff");
        if (!this.instant) sfx("cast");
        break;
      case "mindblast": {
        const hero = this.hero();
        const from = P.who && !isHero(P.who.id) && hero ? hero : (P.who ?? hero);
        const target = P.who && !isHero(P.who.id) ? P.who : st.actors.find((o) => !isHero(o.id) && !o.hidden && o.pose !== "dead");
        if (!from) break;
        const dir = target ? Math.sign(target.x - from.x) || 1 : from.facing === "left" ? -1 : 1;
        from.facing = dir > 0 ? "right" : "left";
        st.play(from, "cast", 900);
        for (let k = 0; k < 4; k++) setTimeout(() => this.wave(from.x + dir * 8, from.y - 38, dir, target ? Math.abs(target.x - from.x) : 120), k * 170);
        if (target) setTimeout(() => { st.play(target, "hurt", 500); target.flash = st.now + 160; target.shake = st.now + 420; st.burst(target.x, target.y - 34, "#d8b8ff", 14, 1.6, { glow: true }); }, 520);
        st.flash("#b890ff", 200);
        if (!this.instant) { sfx("cast", "dark"); sfx("mana"); }
        break;
      }
      case "dust":
        for (const q of points) this.dust(q.x, P.sky ? this.slot(2).y : q.y, P.all ? 10 : 14);
        if (!this.instant) sfx("step");
        break;
      case "sparks":
        this.sparks(P.x, P.who ? P.y - 26 : P.y - 14, 22);
        if (!this.instant) sfx("hit");
        break;
      case "arrows": this.arrows(P); break;
      case "splash": {
        const y = P.who?.y ?? P.y;
        for (let i = 0; i < 26; i++) st.particles.push({ x: P.x + rnd(-6, 6), y: y - 2, vx: rnd(-1.1, 1.1), vy: rnd(-3, -1.2), life: 0, max: rnd(600, 1000), col: i % 3 ? "#bfe4ff" : "#5aa8e0", size: Math.random() < 0.3 ? 2 : 1, g: 0.009, floor: y + 2 });
        this.ring(P.x, y, "#cfeaff", 30, 700, true);
        setTimeout(() => this.ring(P.x, y, "#cfeaff", 44, 900, true), 220);
        break;
      }
      case "flash":
        st.flash("#ffffff", 320);
        break;
      case "glow": {
        const q = P.sky ? { x: P.x, y: 40 } : { x: P.x, y: (P.who ? P.y - 26 : P.y - 18) };
        const until = st.now + 5200;
        st.emit({
          id, until,
          tick: (dt) => {
            for (let i = 0; i < dt / 30; i++) if (Math.random() < 0.8) st.particles.push({ x: q.x + rnd(-18, 18), y: q.y + rnd(-8, 16), vx: rnd(-0.12, 0.12), vy: rnd(-0.55, -0.18), life: 0, max: rnd(1300, 2100), col: Math.random() < 0.35 ? "#ffffff" : Math.random() < 0.6 ? "#fff0b0" : "#ffd070", size: Math.random() < 0.55 ? 2 : 3, glow: true });
          },
        });
        st.overlays.push((g, t) => {
          const k = (t - (until - 5200)) / 5200;
          if (k >= 1) return false;
          const a = Math.sin(Math.min(1, k * 1.3) * Math.PI) * (0.8 + 0.2 * Math.sin(t / 160));
          g.globalCompositeOperation = "lighter";
          const gr = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, 54);
          gr.addColorStop(0, `rgba(255,255,236,${0.9 * a})`); gr.addColorStop(0.3, `rgba(255,226,150,${0.55 * a})`); gr.addColorStop(1, "rgba(255,200,100,0)");
          g.fillStyle = gr; g.fillRect(q.x - 56, q.y - 56, 112, 112);
          // rays turning slowly
          g.strokeStyle = `rgba(255,240,190,${0.35 * a})`; g.lineWidth = 2;
          for (let i = 0; i < 6; i++) { const an = t / 1400 + (i * Math.PI) / 3; g.beginPath(); g.moveTo(q.x + Math.cos(an) * 8, q.y + Math.sin(an) * 8); g.lineTo(q.x + Math.cos(an) * 40, q.y + Math.sin(an) * 40); g.stroke(); }
          g.globalCompositeOperation = "source-over";
          return true;
        });
        if (!this.instant) void st.tween(st.look, "glow", 0.7, 700).then(() => st.tween(st.look, "glow", 0, 2600));
        if (st.look.dark > 0.1) void st.tween(st.look, "dark", 0, 1200);
        break;
      }
      case "darkness": {
        void st.tween(st.look, "dark", P.sky ? 0.6 : 0.8, this.instant ? 0 : 1600);
        this.scoped.push({ until: this.at + 2, stop: () => void st.tween(st.look, "dark", 0, 1400) });
        break;
      }
      case "shockwave": {
        const y = P.who?.y ?? P.y;
        this.ring(P.x, y, "#fff0d0", 90, 600, true);
        setTimeout(() => this.ring(P.x, y, "#e8d8b8", 70, 600, true), 120);
        this.dust(P.x - 20, y, 8); this.dust(P.x + 20, y, 8);
        st.shake(380, 1.6);
        st.flash("#fff", 90);
        for (const o of st.actors) if (!o.hidden && Math.abs(o.x - P.x) < 80 && o !== P.who) o.shake = st.now + 300;
        if (!this.instant) sfx("impact", "earth");
        break;
      }
      case "fall-rocks": {
        const x0 = P.all ? W / 2 : P.x, spread = P.all ? 140 : 46, floor = P.who?.y ?? this.slot(2).y;
        const until = st.now + 1500;
        st.emit({
          id, until,
          tick: (dt) => {
            if (Math.random() < dt / 55) st.particles.push({ x: x0 + rnd(-spread, spread), y: -6, vx: rnd(-0.3, 0.3), vy: rnd(0.5, 1.4), life: 0, max: 2600, col: ["#7a7068", "#8e847a", "#5e564e"][Math.floor(Math.random() * 3)], size: rnd(2, 4), shape: "rock", g: 0.006, floor: floor + rnd(-3, 4) });
            if (Math.random() < dt / 160) { this.dust(x0 + rnd(-spread, spread), floor, 3); st.shake(120, 0.7); }
          },
        });
        for (let i = 0; i < 18; i++) st.particles.push({ x: x0 + rnd(-spread, spread), y: rnd(-20, 10), vx: rnd(-0.2, 0.2), vy: rnd(0.2, 0.8), life: 0, max: 1800, col: "#9a9080", size: 1, g: 0.004, floor });
        if (!this.instant) sfx("demolish");
        break;
      }
      case "frost":
      case "ice":
      case "freeze": this.frost(P); break;
      default:
        // an effect word the director does not know: a soft burst of light rather than nothing
        st.burst(Number.isFinite(P.x) ? P.x : W / 2, Number.isFinite(P.y) ? P.y - 20 : H / 2, "#fff0c0", 12, 1.2, { glow: true });
    }
  }

  /**
   * Frost: the picture turns icy blue, rime creeps in from the edges as six-armed crystals, and
   * glittering ice motes drift down (around the point, or over the whole scene for "all" / "sky").
   */
  private frost(P: ReturnType<Director["pointOf"]>) {
    const st = this.stage;
    const t0 = st.now, ms = 5600;
    const wide = !!(P.all || P.sky);
    // crystals along the four edges, the corners thickest
    const crystals = Array.from({ length: 30 }, (_, i) => {
      const side = i % 4, u = Math.random() ** 1.6 * (Math.random() < 0.5 ? 1 : -1) * 0.5 + 0.5;
      const x = side === 0 ? u * W : side === 1 ? W - rnd(0, 6) : side === 2 ? u * W : rnd(0, 6);
      const y = side === 0 ? rnd(0, 6) : side === 1 ? u * H : side === 2 ? H - rnd(0, 6) : u * H;
      return { x, y, r: rnd(5, 14), rot: Math.random() * Math.PI, delay: rnd(0, 1100) };
    });
    st.overlays.push((g, t) => {
      const k = (t - t0) / ms;
      if (k >= 1) return false;
      const a = Math.min(1, k * 5) * Math.min(1, (1 - k) * 3);
      g.save();
      g.fillStyle = `rgba(110,170,255,${0.2 * a})`;
      g.fillRect(0, 0, W, H);
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      gr.addColorStop(0, "rgba(210,236,255,0)");
      gr.addColorStop(1, `rgba(225,244,255,${0.6 * a})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = `rgba(240,250,255,${0.9 * a})`;
      g.lineWidth = 1;
      for (const c of crystals) {
        const grow = Math.max(0, Math.min(1, (t - t0 - c.delay) / 800));
        if (!grow) continue;
        const r = c.r * easeOut(grow);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = c.rot + (i * Math.PI) / 3, cx = Math.cos(an), cy = Math.sin(an);
          g.moveTo(c.x, c.y); g.lineTo(c.x + cx * r, c.y + cy * r);
          // little side branches two thirds of the way out
          const bx = c.x + cx * r * 0.6, by = c.y + cy * r * 0.6, b = r * 0.3;
          for (const d of [-0.7, 0.7]) { g.moveTo(bx, by); g.lineTo(bx + Math.cos(an + d) * b, by + Math.sin(an + d) * b); }
        }
        g.stroke();
      }
      g.restore();
      return true;
    });
    // ice motes glinting as they fall
    const id = `frost${++this.uid}`;
    const x0 = wide ? W / 2 : P.x, spread = wide ? W / 2 : 40, top = wide ? 0 : Math.max(0, P.y - 70);
    st.emit({
      id, until: st.now + 2600,
      tick: (dt) => {
        for (let i = 0; i < dt / 40; i++) if (Math.random() < 0.7) st.particles.push({ x: x0 + rnd(-spread, spread), y: top + rnd(0, 30), vx: rnd(-0.15, 0.15), vy: rnd(0.15, 0.5), life: 0, max: rnd(1400, 2400), col: Math.random() < 0.5 ? "#ffffff" : "#bfe2ff", size: Math.random() < 0.3 ? 2 : 1, glow: true, drag: 0.2 });
      },
    });
    if (P.who) { P.who.flash = st.now + 120; }
    st.flash("#e0f2ff", 180);
    if (!this.instant) sfx("cast", "ice");
  }

  /** One frame of flames over a base of width w (also used by burning props). */
  private flameTick(x: number, y: number, w: number, dt: number, power: number, smoke: boolean) {
    const st = this.stage;
    const n = (dt / 16) * power * (w > 2 ? Math.max(1, w / 8) : 0.6);
    for (let i = 0; i < n; i++) {
      if (Math.random() > Math.min(1, n - i)) break;
      const hot = Math.random();
      st.particles.push({
        x: x + rnd(-w / 2, w / 2) * (0.6 + 0.4 * Math.random()), y: y - rnd(0, 2), vx: rnd(-0.12, 0.12), vy: rnd(-0.75, -0.35) * (w > 2 ? 1 : 0.6),
        life: 0, max: rnd(260, w > 2 ? 620 : 380), col: hot < 0.3 ? "#fff2b0" : hot < 0.65 ? "#ffb030" : "#f05a18", size: w > 2 && Math.random() < 0.45 ? 2 : 1, glow: true, drag: 0.5,
      });
    }
    if (w > 2 && Math.random() < dt / 260) st.particles.push({ x: x + rnd(-w / 3, w / 3), y: y - 10, vx: rnd(-0.3, 0.3), vy: rnd(-0.9, -0.5), life: 0, max: rnd(900, 1600), col: "#ffd070", size: 1, glow: true });
    if (smoke && w > 4 && Math.random() < dt / 170) st.particles.push({ x: x + rnd(-w / 3, w / 3), y: y - 16, vx: rnd(0, 0.25), vy: rnd(-0.45, -0.25), life: 0, max: rnd(1800, 2800), col: Math.random() < 0.5 ? "#4e4a50" : "#7a747c", size: rnd(2.5, 4), shape: "puff", grow: 5, drag: 0.7, a: 0.4 });
  }

  private dust(x: number, y: number, n: number) {
    const st = this.stage;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      st.particles.push({ x: x + rnd(-6, 6), y: y - rnd(0, 3), vx: dir * rnd(0.2, 0.9), vy: rnd(-0.35, -0.05), life: 0, max: rnd(600, 1100), col: Math.random() < 0.5 ? "rgba(196,178,148,.75)" : "rgba(160,142,116,.7)", size: rnd(1.5, 3), shape: "puff", grow: 5, drag: 0.25 });
    }
  }

  private sparks(x: number, y: number, n: number) {
    const st = this.stage;
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, 0), v = rnd(1, 3.2);
      st.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(220, 480), col: Math.random() < 0.5 ? "#fff6c8" : "#ffc850", size: rnd(2, 4), shape: "streak", glow: true, g: 0.006 });
    }
    st.overlays.push(flashBlob(st.now, x, y, 14, "#fff0c0", 160));
  }

  private glint(x: number, y: number, n: number) {
    const st = this.stage;
    for (let i = 0; i < n; i++) st.particles.push({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: 0, vy: rnd(-0.3, -0.05), life: 0, max: rnd(500, 1000), col: i % 2 ? "#fff8d0" : "#ffe070", size: 1, glow: true });
    st.overlays.push(starGlint(st.now, x, y));
  }

  private debris(x: number, y: number) {
    const st = this.stage;
    for (let i = 0; i < 12; i++) st.particles.push({ x, y, vx: rnd(-1.8, 1.8), vy: rnd(-2.4, -0.6), life: 0, max: 1600, col: i % 2 ? "#8f5f36" : "#6e4628", size: rnd(1, 2), shape: "rock", g: 0.008, floor: y + 8 + rnd(0, 4) });
  }

  private magic(x: number, y: number, ms: number, col: string) {
    const st = this.stage;
    const t0 = st.now;
    st.emit({
      id: `magic${++this.uid}`, until: st.now + ms,
      tick: (dt, t) => {
        const k = (t - t0) / 1000;
        for (let i = 0; i < dt / 14; i++) {
          const a = k * 7 + i * 2.1 + Math.random() * 0.4, r = 13 + Math.sin(k * 3) * 4;
          st.particles.push({ x: x + Math.cos(a) * r, y: y - 6 - ((k * 30 + i * 7) % 46), vx: Math.cos(a + 1.6) * 0.3, vy: -0.4, life: 0, max: rnd(800, 1400), col: Math.random() < 0.35 ? "#ffffff" : Math.random() < 0.5 ? col : "#7ad8ff", size: Math.random() < 0.6 ? 2 : 3, glow: true });
        }
      },
    });
    // a bright pulsing core of light where the spell gathers
    st.overlays.push((g, t) => {
      const k = (t - t0) / ms;
      if (k >= 1) return false;
      const a = Math.sin(Math.min(1, k * 1.25) * Math.PI) * (0.8 + 0.2 * Math.sin(t / 90));
      const cy = y - 24, r = 30;
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(x, cy, 1, x, cy, r);
      gr.addColorStop(0, `rgba(255,255,255,${0.85 * a})`); gr.addColorStop(0.25, hexA(col, 0.6 * a)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(x - r, cy - r, r * 2, r * 2);
      g.restore();
      return true;
    });
    st.flash(col, 160);
    this.ring(x, y, col, 34, 1000, true);
    setTimeout(() => this.ring(x, y, "#ffffff", 26, 800, true), 260);
  }

  private slash(x: number, y: number, dir: number) {
    const st = this.stage, t0 = st.now;
    st.overlays.push((g, t) => {
      const k = (t - t0) / 200;
      if (k > 1) return false;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.beginPath();
      if (dir > 0) g.arc(x, y, 12 + k * 6, -1.3 + k, 0.9 + k); else g.arc(x, y, 12 + k * 6, Math.PI - 0.9 - k, Math.PI + 1.3 - k);
      g.stroke();
      g.restore();
      return true;
    });
  }

  /** An expanding ring (flat on the ground, or round in the air). */
  private ring(x: number, y: number, col: string, r: number, ms: number, flat: boolean) {
    const st = this.stage, t0 = st.now;
    st.overlays.push((g, t) => {
      const k = (t - t0) / ms;
      if (k > 1) return false;
      const e = easeOut(k);
      g.save();
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = col; g.lineWidth = flat ? 1.5 : 2.5 * (1 - k) + 0.5;
      g.beginPath(); g.ellipse(x, y, Math.max(1, r * e), Math.max(1, (flat ? r * 0.22 : r) * e), 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      return true;
    });
  }

  /** A Kai mindblast wave: violet arcs rolling out towards the target. */
  private wave(x: number, y: number, dir: number, dist: number) {
    const st = this.stage, t0 = st.now;
    st.overlays.push((g, t) => {
      const k = (t - t0) / 700;
      if (k > 1) return false;
      const cx = x + dir * dist * easeOut(k);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = "#c8a0ff"; g.lineWidth = 3;
      const r = 8 + k * 16;
      g.beginPath();
      if (dir > 0) g.arc(cx - r, y, r, -0.9, 0.9); else g.arc(cx + r, y, r, Math.PI - 0.9, Math.PI + 0.9);
      g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 1; g.globalAlpha = (1 - k) * 0.6;
      g.beginPath();
      if (dir > 0) g.arc(cx - r - 3, y, r, -0.7, 0.7); else g.arc(cx + r + 3, y, r, Math.PI - 0.7, Math.PI + 0.7);
      g.stroke();
      g.restore();
      return true;
    });
  }

  /** A forked lightning bolt from the top of the scene to (x, y). */
  private bolt(x: number, y: number) {
    const st = this.stage, t0 = st.now;
    const pts: [number, number][] = [[x + rnd(-30, 30), -4]];
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      pts.push([pts[0][0] + (x - pts[0][0]) * k + (i < steps ? rnd(-9, 9) : 0), -4 + (y + 4) * k]);
    }
    const fork = pts.slice(3, 6).map(([px, py], i) => [px + (i + 1) * rnd(6, 10) * (Math.random() < 0.5 ? -1 : 1), py + (i + 1) * 6] as [number, number]);
    st.overlays.push((g, t) => {
      const age = t - t0;
      if (age > 300) return false;
      const on = age < 80 || (age > 120 && age < 200);
      if (!on) return true;
      g.save();
      g.globalCompositeOperation = "lighter";
      const line = (p: [number, number][], w: number, c: string) => {
        g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) g.lineTo(q[0], q[1]); g.stroke();
      };
      line(pts, 4, "rgba(120,160,255,.45)");
      line(pts, 1.5, "#ffffff");
      line([pts[3], ...fork], 1, "#d8e4ff");
      g.restore();
      return true;
    });
  }

  /** A volley of arrows falling on a spot (or across the scene). */
  private arrows(P: { x: number; y: number; who?: Actor; all?: boolean; sky?: boolean }) {
    const st = this.stage;
    const n = P.all || P.sky ? 18 : 10;
    const floorY = P.who?.y ?? this.slot(2).y;
    const fromLeft = !(P.who && P.who.facing === "left" && !isHero(P.who.id)) ;
    let shot = 0;
    const t0 = st.now;
    st.emit({
      id: `arrows${++this.uid}`, until: st.now + 900,
      tick: (_dt, t) => {
        const due = Math.floor(((t - t0) / 900) * n);
        while (shot < due) {
          shot++;
          const tx = (P.all || P.sky ? rnd(20, W - 20) : P.x + rnd(-22, 22)), ty = floorY + rnd(-3, 4);
          const x0 = fromLeft ? tx - rnd(130, 190) : tx + rnd(130, 190), y0 = rnd(-30, -6);
          const T = rnd(620, 760), g = 0.0016;
          const vx = (tx - x0) / (0.06 * T);
          const vy = ((ty - y0) - 0.5 * g * 0.06 * T * T * 16.7 / 16.7) / (0.06 * T);
          st.particles.push({ x: x0, y: y0, vx, vy, life: 0, max: T + 900, col: "#e0d0a8", size: 6, shape: "streak", g, floor: ty } as Particle);
          if (shot % 4 === 1 && !this.instant) sfx("bow");
        }
      },
    });
  }

  private windGust() {
    const st = this.stage;
    for (let i = 0; i < 16; i++) st.particles.push({ x: rnd(W * 0.4, W), y: rnd(60, H - 10), vx: rnd(-3, -1.5), vy: rnd(-0.1, 0.1), life: 0, max: rnd(300, 600), col: "rgba(255,255,255,.35)", size: rnd(6, 12), shape: "streak" });
  }

  // ---------------------------------------------------------------- camera
  private camera(kind: string, subject: { x: number; y: number } | undefined, _list: StageAction[]) {
    const st = this.stage;
    if (this.instant) {
      if (kind === "fade-out") st.look.fade = 1;
      if (kind === "fade-in") st.look.fade = 0;
      return;
    }
    const hero = this.hero();
    const s = subject ?? (hero ? { x: hero.x, y: hero.y } : { x: W / 2, y: H * 0.7 });
    const fy = clamp(s.y - 26, 40, H - 40);
    // moves are short and smooth; idle drifts ("drift-*", "breathe") are left out: a camera
    // swaying while the text types makes players dizzy. "Giảm rung màn hình": no zooms or shakes.
    const calm = calmMotion();
    switch (kind) {
      case "shake": st.shake(300, 1); break;
      case "shake-soft": st.shake(180, 0.5); break;
      case "zoom-in": if (!calm) void st.camTo(s.x, fy, 1.3, 700); break;
      case "push-in": if (!calm) void st.camTo((s.x + W / 2) / 2, fy, 1.1, 800); break;
      case "zoom-out": if (!calm) { st.cam.x = s.x; st.cam.y = fy; st.cam.zoom = Math.max(st.cam.zoom, 1.3); void st.camTo(W / 2, H / 2, 1, 900); } break;
      case "reveal": if (!calm) { st.cam.x = W / 2; st.cam.y = H * 0.55; st.cam.zoom = 1.08; void st.camTo(W / 2, H / 2, 1, 1000); } break;
      case "pan-right": case "pan-left": {
        if (calm) break;
        const right = kind.endsWith("right");
        const span = 40;
        if (st.cam.zoom < 1.03) { st.cam.x = W / 2 + (right ? -span : span); st.cam.y = H * 0.56; }
        void st.tween(st.cam, "zoom", 1.18, 600);
        void st.tween(st.cam, "y", H * 0.56, 600);
        void st.tween(st.cam, "x", W / 2 + (right ? span : -span), 1400, (k) => easeInOut(k));
        break;
      }
      case "fade-out": void st.tween(st.look, "fade", 1, 1500); break;
      case "fade-in": st.look.fade = 1; void st.tween(st.look, "fade", 0, 1500); break;
      case "flash": st.flash("#ffffff", 300); break;
      case "flash-gold": st.flash("#ffe08a", 500); void st.tween(st.look, "glow", 1, 600).then(() => st.tween(st.look, "glow", 0, 1800)); break;
      default: break;
    }
  }

  /** Every remaining beat applied at once, ending in their final state. */
  finishAll() {
    for (let i = this.at + 1; i < this.beats.length; i++) void this.beat(i, true);
    this.instant = false;
    this.stage.settle();
  }

  /** The state the scene rests in once the performance is over (choices on screen). */
  rest(ended: boolean, instant = false): Promise<void> {
    const st = this.stage;
    for (const a of st.actors) a.bubble = undefined;
    void st.camTo(W / 2, H / 2, 1, instant ? 0 : 1200);
    if (st.look.fade > 0.05) void st.tween(st.look, "fade", ended ? Math.min(st.look.fade, 0.35) : 0, instant ? 0 : 900);
    if (!ended && st.look.dark > 0.5) void st.tween(st.look, "dark", 0.45, instant ? 0 : 1200);
    // the hero ran off (or was taken away): he walks calmly back in before the choices
    const hero = this.hero();
    if (ended || !hero || hero.pose === "dead") return Promise.resolve();
    const off = hero.hidden || hero.x < 8 || hero.x > W - 8 || (hero.alpha ?? 1) < 0.4;
    if (!off) return Promise.resolve();
    const fromLeft = hero.x < W / 2;
    const n = fromLeft ? 1 : 4;
    hero.hidden = false; hero.z = 0; hero.scale = 1; hero.run = false; hero.to = undefined;
    if (hero.pose !== "idle") hero.pose = "idle";
    const x = this.freeX(n, hero), y = this.slot(n).y;
    const inside = hero.x >= 8 && hero.x <= W - 8;
    if (instant) { hero.x = x; hero.y = y; hero.alpha = 1; hero.facing = x < W / 2 ? "right" : "left"; return Promise.resolve(); }
    if (inside) return this.fadeTo(hero, 1, 600);
    hero.alpha = 1;
    hero.x = fromLeft ? -22 : W + 22; hero.y = y;
    const walk = st.moveTo(hero, x, y, 0.075).then(() => { hero.facing = x < W / 2 ? "right" : "left"; });
    return Promise.race([walk, new Promise<void>((r) => setTimeout(r, 3500))]);
  }
}

// small canvases for decals and overlays
let bloodC: HTMLCanvasElement | null = null;
function bloodPool() {
  if (bloodC) return bloodC;
  bloodC = document.createElement("canvas");
  bloodC.width = 22; bloodC.height = 6;
  const g = bloodC.getContext("2d")!;
  g.fillStyle = "rgba(110,8,6,.85)"; g.beginPath(); g.ellipse(11, 3, 10, 2.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(160,20,12,.8)"; g.beginPath(); g.ellipse(8, 3, 4, 1.2, 0, 0, Math.PI * 2); g.fill();
  return bloodC;
}
let scorchC: HTMLCanvasElement | null = null;
function scorch() {
  if (scorchC) return scorchC;
  scorchC = document.createElement("canvas");
  scorchC.width = 30; scorchC.height = 8;
  const g = scorchC.getContext("2d")!;
  g.fillStyle = "rgba(20,14,10,.55)"; g.beginPath(); g.ellipse(15, 4, 14, 3, 0, 0, Math.PI * 2); g.fill();
  return scorchC;
}
function flashBlob(t0: number, x: number, y: number, r: number, col: string, ms: number) {
  return (g: CanvasRenderingContext2D, t: number) => {
    const k = (t - t0) / ms;
    if (k > 1) return false;
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - k;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    return true;
  };
}
function starGlint(t0: number, x: number, y: number) {
  return (g: CanvasRenderingContext2D, t: number) => {
    const k = (t - t0) / 600;
    if (k > 1) return false;
    const s = Math.round(Math.sin(k * Math.PI) * 5);
    g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "#fff8d8";
    g.fillRect(Math.round(x) - s, Math.round(y), s * 2 + 1, 1); g.fillRect(Math.round(x), Math.round(y) - s, 1, s * 2 + 1);
    g.restore();
    return true;
  };
}

// ================================================================== performance (UI)
export interface PerformOpts {
  stage: Stage;
  book: Book;
  sid: string;
  heroLook: Look;
  /** Where the caption box goes (it is created inside). */
  captionHost: HTMLElement;
  /** Progress pips container (optional). */
  pips?: HTMLElement;
  auto: () => boolean;
  /** Called when a beat starts (index, count). */
  onBeat?: (i: number, n: number) => void;
}

/**
 * Plays a section's beats with a typed caption. Tap = finish the beat at once, tap again = next
 * beat. In auto mode beats follow each other after a reading pause. `done` resolves after the
 * last beat (or a skip); the caption keeps the last beat's text.
 */
export class Performance {
  readonly director: Director;
  readonly done: Promise<void>;
  readonly caption: HTMLElement;
  private text: HTMLElement;
  private who: HTMLElement;
  private next: HTMLElement;
  private resolve!: () => void;
  private i = -1;
  private typing = 0;
  private full = "";
  private ready = false;
  private busy = false;
  private over = false;
  private timer = 0;
  private gen = 0;
  constructor(private o: PerformOpts) {
    const sec = o.book.sections[o.sid];
    this.director = new Director(o.stage, o.book, sec, o.heroLook);
    this.director.setup();
    this.text = h("div", { class: "adv-cap-t" });
    this.who = h("div", { class: "adv-cap-who" });
    this.next = h("i", { class: "adv-next" });
    this.caption = h("div", { class: "adv-cap" }, this.who, h("div", { class: "adv-cap-body" }, this.text), this.next);
    o.captionHost.replaceChildren(this.caption);
    this.done = new Promise((r) => { this.resolve = r; });
    if (o.pips) o.pips.replaceChildren(...this.director.beats.map(() => h("i")));
    if (!this.director.beats.length) { this.end(); return; }
    // a beat to let the scene appear before the words
    this.timer = window.setTimeout(() => this.advance(), 380);
  }

  get count() { return this.director.beats.length; }
  get index() { return this.i; }
  get finished() { return this.over; }

  /** Tap: complete what is playing, or go to the next beat. */
  tap() {
    if (this.over) return;
    if (!this.ready) {
      // finish the typing and the animation at once
      this.complete();
      return;
    }
    this.advance();
  }

  /** Jumps to the end: every beat applied, the last text shown. */
  skip() {
    if (this.over) return;
    clearTimeout(this.timer);
    this.gen++;
    this.director.finishAll();
    const last = this.director.beats[this.director.beats.length - 1];
    if (last) this.showText(this.director.beats.length - 1, true);
    this.end();
  }

  /** The auto toggle changed: continue at once if waiting. */
  autoChanged() { if (this.ready && this.o.auto() && !this.over) this.scheduleAuto(); }

  destroy() {
    this.over = true;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.typing);
    this.gen++;
  }

  private advance() {
    clearTimeout(this.timer);
    if (this.over) return;
    if (this.i + 1 >= this.director.beats.length) { this.end(); return; }
    this.i++;
    const gen = ++this.gen;
    this.ready = false;
    this.busy = true;
    this.o.onBeat?.(this.i, this.count);
    this.pip();
    const moves = this.director.beat(this.i);
    this.showText(this.i, false);
    void moves.then(() => {
      if (gen !== this.gen) return;
      this.busy = false;
      this.check();
    });
  }

  private pip() {
    const ps = this.o.pips?.children;
    if (!ps) return;
    for (let k = 0; k < ps.length; k++) ps[k].className = k < this.i ? "done" : k === this.i ? "on" : "";
  }

  private showText(i: number, instant: boolean) {
    const b = this.director.beats[i];
    const say = (b.do ?? []).find((a) => "say" in a && a.say) as { say: string } | undefined;
    this.caption.classList.toggle("speech", !!say);
    if (say) {
      const id = String(say.say);
      const face = actorFace(id, this.o.heroLook);
      face.className = "pix";
      this.who.replaceChildren(h("span", { class: "adv-cap-face fr-slot" }, face), h("b", null, actorName(this.o.book, id)));
    } else this.who.replaceChildren();
    this.full = b.t.trim();
    cancelAnimationFrame(this.typing);
    if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { this.text.textContent = this.full; this.typed(); return; }
    this.caption.classList.add("typing");
    this.text.textContent = "";
    const t0 = performance.now();
    const cps = 48;
    const step = () => {
      const n = Math.min(this.full.length, Math.floor(((performance.now() - t0) / 1000) * cps) + 1);
      this.text.textContent = this.full.slice(0, n);
      if (n < this.full.length) this.typing = requestAnimationFrame(step);
      else this.typed();
    };
    this.typing = requestAnimationFrame(step);
  }

  private typedDone = false;
  private typed() {
    this.caption.classList.remove("typing");
    this.typedDone = true;
    this.check();
  }

  private complete() {
    cancelAnimationFrame(this.typing);
    this.text.textContent = this.full;
    this.caption.classList.remove("typing");
    this.typedDone = true;
    this.o.stage.settle();
    this.busy = false;
    this.check(true);
  }

  private check(now = false) {
    if (this.over || this.busy || !this.typedDone) return;
    if (!this.ready) {
      this.ready = true;
      this.typedDone = false;
      this.caption.classList.add("ready");
      if (this.o.auto()) this.scheduleAuto(now);
    }
  }

  private scheduleAuto(fast = false) {
    clearTimeout(this.timer);
    const b = this.director.beats[this.i];
    const read = Math.min(7000, 1100 + this.full.length * 42) + (Number(b?.wait) || 0);
    this.timer = window.setTimeout(() => { if (this.o.auto()) { this.caption.classList.remove("ready"); this.advance(); } }, fast ? Math.min(read, 1600) : read);
  }

  private end() {
    if (this.over) return;
    this.over = true;
    clearTimeout(this.timer);
    this.caption.classList.remove("typing");
    this.caption.classList.add("ready", "over");
    if (this.o.pips) for (const p of this.o.pips.children) p.className = "done";
    this.resolve();
  }
}
