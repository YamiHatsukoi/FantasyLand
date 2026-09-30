/**
 * Residents of the sanctuary: every recruited companion lives there. Each has a stable personality
 * (derived from their id, so nothing but the relationship needs saving) and a Bond with the player
 * that grows through conversation, gifts, dates and milestone scenes.
 */
import { Rng, hashString } from "../core/rng";
import { addItem, houseLevel, logMsg, removeItem, type Bond, type Character, type GameState } from "../core/state";
import { SEASON_NAMES, getItem, seasonOf, type ItemDef, type ItemType } from "../data/items";
import { JOBS, PERSONAS, type Job, type Persona } from "../data/npcText";
import {
  AMBIENT, AMBIENT_ANY, DATES, DATE_END, DEEP_QUESTIONS, DEEP_REACT, FLAVOR, FLIRT_LINES, FLIRT_REACT, GOSSIP, MOOD_TALK,
  PARTNER_TALK, PRONOUNS, RES_GREET, TICS, TOPICS, TOPIC_LIST, TOPIC_TALK, VALUE_NAMES,
  type DatePlace, type FlirtStyle, type Topic, type Value,
} from "../data/residentText";
import {
  BIRTHDAY, BREAKUP_SCENE, DATING_SCENE, DREAMS, HOBBY_SCENES, PROPOSAL_SCENE, REQUEST_DONE, REQUEST_SCENE, ROMANCE_CONFESS,
  ROMANCE_SPARK, SECRETS, WEDDING_SCENE, WOUNDS, type Choice, type Scene,
} from "../data/residentStory";
import { GROSS, TASTE, getNpc, itemsWithShapes } from "./people";
import { WEATHER } from "./town";

// ============================================================ profile
export interface Profile {
  id: string;
  name: string;
  first: string;
  persona: Persona;
  job: Job;
  race: string;
  home: string;
  fem: boolean;
  romanceable: boolean;
  traits: { warmth: number; humor: number; courage: number; pride: number; passion: number };
  loves: Topic[];
  likes: Topic[];
  dislikes: Topic[];
  values: Record<Value, number>;
  style: FlirtStyle; // favourite way to be flirted with
  hateStyle: FlirtStyle;
  giftLoves: string[];
  giftHates: string[];
  giftLikes: ItemType[];
  dream: number;
  wound: number;
  secret: number;
  tic: string;
  birthday: { season: number; day: number };
}

const JOB_TOPICS: Record<Job, Topic[]> = {
  merchant: ["money", "gossip", "fashion"], farmer: ["farming", "food", "animals"], guard: ["battle", "gossip", "food"],
  hunter: ["animals", "adventure", "nature"], scholar: ["books", "history", "magic"], priest: ["history", "stars", "music"],
  adventurer: ["adventure", "battle", "stars"], blacksmith: ["crafting", "battle", "money"], innkeeper: ["food", "gossip", "music"],
  child: ["animals", "food", "adventure"], elder: ["history", "farming", "stars"], bard: ["music", "gossip", "fashion"],
  mercenary: ["battle", "money", "adventure"], herbalist: ["nature", "farming", "magic"], fisher: ["fishing", "food", "nature"],
};
const PERSONA_TOPICS: Record<Persona, Topic[]> = {
  cheerful: ["gossip", "music", "food"], grumpy: ["crafting", "fishing", "farming"], shy: ["books", "stars", "nature"],
  proud: ["fashion", "battle", "history"], greedy: ["money", "crafting", "gossip"], kind: ["food", "animals", "farming"],
  mysterious: ["stars", "magic", "history"], brave: ["battle", "adventure", "fishing"],
};
const PERSONA_VALUES: Record<Persona, Partial<Record<Value, number>>> = {
  cheerful: { funny: 2, kind: 1 }, grumpy: { honest: 2, practical: 1, funny: -1 }, shy: { kind: 1, romantic: 2, bold: -1 },
  proud: { bold: 2, honest: 1, funny: -1 }, greedy: { practical: 2, free: 1, romantic: -1 }, kind: { kind: 2, loyal: 1 },
  mysterious: { free: 2, romantic: 1, practical: -1 }, brave: { bold: 2, loyal: 1 },
};
const STYLE: Record<Persona, [FlirtStyle, FlirtStyle]> = {
  cheerful: ["playful", "poetic"], grumpy: ["bold", "playful"], shy: ["sweet", "bold"], proud: ["poetic", "playful"],
  greedy: ["bold", "poetic"], kind: ["sweet", "playful"], mysterious: ["poetic", "playful"], brave: ["bold", "poetic"],
};
const VALUES: Value[] = ["kind", "bold", "honest", "funny", "practical", "romantic", "loyal", "free"];
const PERSONA_LIST = Object.keys(PERSONAS) as Persona[];

/** Hand-written basics for the named companions. */
const PRESET: Record<string, { persona: Persona; job: Job; race: string; home: string; fem: boolean; dream: string; wound: string; secret: string; loves: Topic[] }> = {
  lyra: { persona: "proud", job: "hunter", race: "Tiên Rừng", home: "Rừng Thì Thầm", fem: true, dream: "map", wound: "survivor", secret: "long_life", loves: ["nature", "stars"] },
  bram: { persona: "grumpy", job: "guard", race: "Tộc Nấm", home: "làng Mũ Đỏ", fem: false, dream: "family", wound: "burned", secret: "sprout_friend", loves: ["farming", "crafting"] },
  samira: { persona: "kind", job: "priest", race: "Người", home: "đoàn lữ hành sa mạc", fem: true, dream: "cure", wound: "lonely", secret: "can_cook", loves: ["food", "history"] },
  morwen: { persona: "mysterious", job: "herbalist", race: "Người", home: "đầm lầy Đèn Lồng", fem: true, dream: "peace", wound: "exile", secret: "hears", loves: ["magic", "stars"] },
};

const profileCache = new Map<string, Profile>();

export function profileOf(ch: Character): Profile {
  const hit = profileCache.get(ch.id);
  if (hit && hit.name === ch.name) return hit;
  const rng = new Rng(hashString(`res:${ch.id}`));
  const preset = PRESET[ch.id];
  let persona: Persona = rng.pick(PERSONA_LIST);
  let job: Job = rng.pick(Object.keys(JOBS) as Job[]);
  let race = "Người";
  let home = "một tầng xa xôi";
  let giftLoves: string[] = [];
  let giftHates: string[] = [];
  const npc = ch.origin ? safeNpc(ch.origin) : null;
  if (npc) {
    persona = npc.persona; job = npc.job; race = npc.race; home = npc.town;
    giftLoves = npc.loves; giftHates = npc.hates;
  } else if (preset) {
    persona = preset.persona; job = preset.job; race = preset.race; home = preset.home;
  } else if (ch.bio) {
    // tavern hires: "Race · Job, từng lang bạt ở tầng N. Tính cách xxx."
    const [r0, rest = ""] = ch.bio.split(" · ");
    race = r0 || race;
    const jobHit = (Object.keys(JOBS) as Job[]).find((j) => rest.startsWith(JOBS[j].name));
    if (jobHit) job = jobHit;
    const pHit = PERSONA_LIST.find((p) => ch.bio!.toLowerCase().includes(`tính cách ${PERSONAS[p].name.toLowerCase()}`));
    if (pHit) persona = pHit;
    const fl = /tầng (\d+)/.exec(ch.bio);
    if (fl) home = `tầng ${fl[1]}`;
  }
  const taste = TASTE[job];
  const maxV = 400;
  const giftable = (id: string) => getItem(id).type !== "equip";
  giftLoves = giftLoves.filter(giftable);
  if (giftLoves.length < 2) giftLoves = [...giftLoves, ...rng.shuffle(itemsWithShapes(taste.shapes, maxV).filter((x) => x.type !== "equip" && !giftLoves.includes(x.id))).slice(0, 3 - giftLoves.length).map((x) => x.id)];
  if (!giftLoves.length) giftLoves = ["bread", "honey"];
  if (!giftHates.length) giftHates = rng.shuffle([...itemsWithShapes(GROSS, maxV)]).filter((x) => !giftLoves.includes(x.id)).slice(0, 2).map((x) => x.id);
  // topics
  const loves: Topic[] = preset?.loves ? [...preset.loves] : [];
  if (!loves.length) {
    loves.push(rng.pick(JOB_TOPICS[job]));
    const p2 = PERSONA_TOPICS[persona].filter((t) => !loves.includes(t));
    loves.push(rng.pick(p2.length ? p2 : TOPIC_LIST.filter((t) => !loves.includes(t))));
  }
  const rest = rng.shuffle(TOPIC_LIST.filter((t) => !loves.includes(t)));
  const likes = rest.slice(0, 4);
  const dislikes = rest.slice(4, 6);
  // values
  const values = {} as Record<Value, number>;
  for (const v of VALUES) values[v] = rng.int(-1, 1) + (PERSONA_VALUES[persona][v] ?? 0);
  const t = (base: number) => Math.max(0, Math.min(100, base + rng.int(-25, 25)));
  const traits = {
    warmth: t(persona === "kind" || persona === "cheerful" ? 75 : persona === "grumpy" ? 30 : 50),
    humor: t(persona === "cheerful" ? 80 : persona === "grumpy" || persona === "proud" ? 30 : 50),
    courage: t(persona === "brave" ? 85 : persona === "shy" ? 25 : 50),
    pride: t(persona === "proud" ? 85 : persona === "shy" || persona === "kind" ? 25 : 50),
    passion: t(persona === "shy" || persona === "mysterious" ? 65 : 50),
  };
  const pal = ch.pal ?? {};
  const fem = preset ? preset.fem : pal.g ? pal.g === "f" : rng.chance(0.5);
  const pick = <T extends { id: string }>(list: T[], id?: string) => Math.max(0, id ? list.findIndex((x) => x.id === id) : rng.int(0, list.length - 1));
  const p: Profile = {
    id: ch.id, name: ch.name, first: ch.name.split(" ")[0], persona, job, race, home, fem,
    romanceable: job !== "child" && job !== "elder" && rng.chance(0.88),
    traits, loves, likes, dislikes, values, style: STYLE[persona][0], hateStyle: STYLE[persona][1],
    giftLoves, giftHates, giftLikes: taste.likes,
    dream: pick(DREAMS, preset?.dream), wound: pick(WOUNDS, preset?.wound), secret: pick(SECRETS, preset?.secret),
    tic: rng.pick(TICS), birthday: { season: rng.int(0, 3), day: rng.int(1, 7) },
  };
  profileCache.set(ch.id, p);
  return p;
}

function safeNpc(id: string) {
  try { return getNpc(id); } catch { return null; }
}

// ============================================================ bonds
export const HEART = 100;
export const MAX_PTS = 1000;
export const ACTS_PER_DAY = 4;
export const heartsOf = (pts: number) => Math.max(0, Math.min(10, Math.floor(pts / HEART)));

export function residents(g: GameState): Character[] {
  return Object.values(g.chars).filter((c) => c.id !== g.heroId);
}

export function bondOf(g: GameState, id: string): Bond {
  g.bonds ??= {};
  let b = g.bonds[id];
  if (!b) {
    const ch = g.chars[id];
    // recruits from settlements remember how well they knew the player
    const aff = ch?.origin ? g.npcs[ch.origin]?.aff ?? 0 : 0;
    b = g.bonds[id] = { fp: Math.max(0, Math.round(aff * 4)), rp: 0, stage: "none", day: 0, acts: 0, gift: 0, date: 0, flirt: 0, known: [], said: [], answers: [], events: [], topics: [] };
  }
  return b;
}

export function partnerOf(g: GameState): Character | null {
  for (const [id, b] of Object.entries(g.bonds ?? {})) if (b.stage !== "none" && g.chars[id]) return g.chars[id];
  return null;
}

export const STAGE_NAMES: Record<Bond["stage"], string> = { none: "", dating: "Đang hẹn hò", engaged: "Đã đính hôn", married: "Vợ chồng" };
export function friendTitle(fp: number) {
  const h = heartsOf(fp);
  return h >= 10 ? "Tri kỷ" : h >= 8 ? "Bạn thân" : h >= 5 ? "Bạn bè" : h >= 2 ? "Quen biết" : "Người lạ";
}

function addFp(b: Bond, d: number) { b.fp = Math.max(0, Math.min(MAX_PTS, b.fp + Math.round(d))); }
function addRp(b: Bond, d: number) { b.rp = Math.max(0, Math.min(MAX_PTS, b.rp + Math.round(d))); }

/** -2..2, changes every day. */
export function moodOf(g: GameState, ch: Character): number {
  const p = profileOf(ch);
  const b = bondOf(g, ch.id);
  const r = new Rng(hashString(`${ch.id}:mood:${g.day}`)).next();
  let m = r < 0.08 ? -2 : r < 0.25 ? -1 : r < 0.7 ? 0 : r < 0.92 ? 1 : 2;
  if (isBirthday(g, p)) m += 2;
  if (b.jealous) m -= 1;
  if ((g.weather === "rain" || g.weather === "storm") && p.loves.includes("nature")) m += 1;
  return Math.max(-2, Math.min(2, m));
}
export const MOOD_ICONS = ["😣", "😕", "🙂", "😊", "😄"];

export function isBirthday(g: GameState, p: Profile) {
  return seasonOf(g.day) === p.birthday.season && ((g.day - 1) % 7) + 1 === p.birthday.day;
}
export const birthdayText = (p: Profile) => `ngày ${p.birthday.day} mùa ${SEASON_NAMES[p.birthday.season as 0 | 1 | 2 | 3].toLowerCase()}`;

// ============================================================ text
export interface Line { who: "npc" | "you" | "sys"; text: string }

interface Ctx { g: GameState; ch: Character; p: Profile; b: Bond }
function ctxOf(g: GameState, ch: Character): Ctx { return { g, ch, p: profileOf(ch), b: bondOf(g, ch.id) }; }

/** Other residents this one likes most / least (by shared tastes and temperament). */
export function relations(g: GameState, ch: Character): { friend?: Character; rival?: Character } {
  const p = profileOf(ch);
  let best: [number, Character?] = [-99], worst: [number, Character?] = [99];
  for (const o of residents(g)) {
    if (o.id === ch.id) continue;
    const s = compat(p, profileOf(o));
    if (s > best[0]) best = [s, o];
    if (s < worst[0]) worst = [s, o];
  }
  return { friend: best[1], rival: worst[1] && worst[1] !== best[1] ? worst[1] : undefined };
}
export function compat(a: Profile, b: Profile): number {
  let s = 0;
  for (const t of a.loves) { if (b.loves.includes(t)) s += 2; else if (b.likes.includes(t)) s += 1; else if (b.dislikes.includes(t)) s -= 2; }
  for (const v of VALUES) s += (a.values[v] * b.values[v]) / 3;
  if (a.persona === b.persona) s += 0.5;
  if ((a.persona === "grumpy" && b.persona === "cheerful") || (a.persona === "proud" && b.persona === "proud")) s -= 1;
  return s + ((hashString(a.id + b.id) + hashString(b.id + a.id)) % 7) / 10;
}

function fill(text: string, c: Ctx, extra: Record<string, string | number> = {}): string {
  const pr = PRONOUNS[c.p.persona];
  const rel = relations(c.g, c.ch);
  const others = residents(c.g).filter((o) => o.id !== c.ch.id);
  const partner = partnerOf(c.g);
  const vars: Record<string, string | number> = {
    p: c.g.chars[c.g.heroId].name, me: c.p.first, I: pr.I, you: pr.you, You: cap(pr.you), home: c.p.home, job: JOBS[c.p.job].name.toLowerCase(),
    friend: rel.friend?.name.split(" ")[0] ?? "Mầm", rival: rel.rival?.name.split(" ")[0] ?? "ai đó", partner: partner?.name.split(" ")[0] ?? "ai đó",
    other: others.length ? others[hashString(c.ch.id + c.g.day) % others.length].name.split(" ")[0] : "Mầm",
    deep: c.g.maxFloor, weather: WEATHER[c.g.weather].name.toLowerCase(), dream: DREAMS[c.p.dream].short,
    ...extra,
  };
  return text.replace(/\{(\w+)\}/g, (_, k: string, off: number) => {
    const v = String(vars[k] ?? `{${k}}`);
    return atSentenceStart(text, off) ? cap(v) : v;
  });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function atSentenceStart(text: string, off: number) {
  let i = off - 1;
  while (i >= 0 && text[i] === " ") i--;
  if (i < 0) return true;
  const c = text[i];
  if ("!?\"\n:*(“".includes(c)) return true;
  return c === "." && text[i - 1] !== ".";
}

/** Picks from a pool avoiding recently used lines. */
function fresh(c: Ctx, pool: string[], tag: string, rng: Rng): string {
  const ids = pool.map((_, i) => `${tag}${i}`);
  let ok = ids.filter((id) => !c.b.said.includes(id));
  if (!ok.length) { c.b.said = c.b.said.filter((s) => !s.startsWith(tag)); ok = ids; }
  const id = rng.pick(ok);
  c.b.said.push(id);
  if (c.b.said.length > 80) c.b.said.splice(0, c.b.said.length - 80);
  return pool[ids.indexOf(id)];
}

function voice(c: Ctx, text: string, up: boolean, rng: Rng): string {
  const f = FLAVOR[c.p.persona][up ? "up" : "down"];
  let s = rng.chance(0.6) ? rng.pick(f) + lowerFirst(text) : text;
  if (rng.chance(0.18)) s += ` ${c.p.tic}`;
  return s;
}
const lowerFirst = (s: string) => (/^\{/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const rngFor = (c: Ctx, tag: string) => new Rng(hashString(`${c.ch.id}:${tag}:${c.g.day}:${c.b.acts}:${c.b.said.length}`));

// ============================================================ conversation
export function actsLeft(g: GameState, ch: Character) {
  const b = bondOf(g, ch.id);
  return b.day === g.day ? Math.max(0, ACTS_PER_DAY - b.acts) : ACTS_PER_DAY;
}
function spend(c: Ctx): boolean {
  if (c.b.day !== c.g.day) { c.b.day = c.g.day; c.b.acts = 0; }
  if (c.b.acts >= ACTS_PER_DAY) return false;
  c.b.acts++;
  return true;
}
const TIRED = ["Hôm nay nói chuyện vậy đủ rồi, mai mình nói tiếp nhé.", "{I} hơi mệt rồi. Để mai nhé?", "Mai kể tiếp, được không? {I} còn việc dở."];

/** Opening lines when the player walks up. First talk of the day raises friendship a little. */
export function greetResident(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  const rng = new Rng(hashString(`${ch.id}:greet:${g.day}:${c.b.said.length}`));
  const out: Line[] = [];
  const h = heartsOf(c.b.fp);
  const tier = h >= 7 ? 3 : h >= 4 ? 2 : h >= 2 ? 1 : 0;
  const first = c.b.day !== g.day;
  if (isBirthday(g, c.p)) out.push({ who: "npc", text: fill(rng.pick(BIRTHDAY.greet), c) });
  else if (c.b.stage === "married" || c.b.stage === "engaged" || c.b.stage === "dating") {
    out.push({ who: "npc", text: fill(fresh(c, PARTNER_TALK[c.b.stage === "dating" ? "dating" : "married"], "pt", rng), c) });
  } else out.push({ who: "npc", text: fill(fresh(c, RES_GREET[c.p.persona][tier], `g${tier}`, rng), c) });
  if (c.b.jealous && c.b.stage !== "none") out.push({ who: "npc", text: fill(rng.pick(PARTNER_TALK.jealous), c, { other: c.b.gossip ?? "người khác" }) });
  // memories of earlier answers
  const ans = c.b.answers[c.b.answers.length - 1];
  if (first && ans && rng.chance(0.35)) {
    const v = ans.split(":")[1] as Value;
    out.push({ who: "npc", text: fill(`{I} vẫn nghĩ về câu trả lời hôm trước của {you}. Một người ${VALUE_NAMES[v]}... {I} thấy {you} đúng là vậy.`, c) });
  }
  if (first) {
    addFp(c.b, 12 + c.p.traits.warmth / 20);
    c.b.day = g.day;
    c.b.acts = 0;
  }
  return out;
}

export function askMood(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[0], c) }];
  const rng = rngFor(c, "mood");
  const m = moodOf(g, ch);
  const out: Line[] = [{ who: "npc", text: fill(rng.pick(MOOD_TALK[String(m)]), c) }];
  addFp(c.b, 8 + (m < 0 ? 6 : 0)); // asking someone who feels down means a lot
  const wish = wishOf(g, ch);
  if (wish && rng.chance(0.7)) {
    const edible = ["food", "crop", "herb", "potion", "animal"].includes(wish.type);
    out.push({ who: "npc", text: fill(edible ? `Hôm nay {I} thèm ${wish.name} quá. Nói vậy thôi, không phải nhờ đâu.` : `Dạo này {I} đang cần ${wish.name}. Mà thôi, chuyện nhỏ.`, c) });
  }
  return out;
}

/** Topic cards offered today: two random topics plus the ones already known to be loved. */
export function topicChoices(g: GameState, ch: Character): Topic[] {
  const c = ctxOf(g, ch);
  const rng = new Rng(hashString(`${ch.id}:topics:${g.day}`));
  const known = c.p.loves.filter((t) => c.b.known.includes(`t:${t}+`));
  const pool = rng.shuffle(TOPIC_LIST.filter((t) => !known.includes(t)));
  return [...known, ...pool].slice(0, Math.max(4, known.length + 2));
}

export function talkTopic(g: GameState, ch: Character, topic: Topic): Line[] {
  const c = ctxOf(g, ch);
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[1], c) }];
  const rng = rngFor(c, `t${topic}`);
  const kind = c.p.loves.includes(topic) ? "love" : c.p.likes.includes(topic) ? "like" : c.p.dislikes.includes(topic) ? "dislike" : "neutral";
  const recent = c.b.topics.some((x) => x.startsWith(`${topic}:`) && g.day - Number(x.split(":")[1]) < 3);
  let d = { love: 34, like: 16, neutral: 5, dislike: -18 }[kind];
  if (recent && d > 0) d = Math.round(d / 3);
  addFp(c.b, d);
  c.b.topics = [...c.b.topics.filter((x) => !x.startsWith(`${topic}:`)), `${topic}:${g.day}`].slice(-16);
  const out: Line[] = [{ who: "npc", text: voice(c, fill(fresh(c, TOPIC_TALK[topic][kind], `tt${topic}${kind[0]}`, rng), c), kind === "love" || kind === "like", rng) }];
  if (recent && kind !== "dislike") out.push({ who: "npc", text: fill("Mà hình như mình vừa nói chuyện này hôm trước rồi nhỉ?", c) });
  const key = kind === "love" ? `t:${topic}+` : kind === "dislike" ? `t:${topic}-` : "";
  if (key && !c.b.known.includes(key)) {
    c.b.known.push(key);
    out.push({ who: "sys", text: kind === "love" ? `💡 ${c.p.first} rất thích nói về ${TOPICS[topic].name.toLowerCase()}!` : `💡 ${c.p.first} không thích chủ đề ${TOPICS[topic].name.toLowerCase()}.` });
  }
  if (kind === "love" && c.p.persona !== "shy" && rng.chance(0.3)) addRp(c.b, c.p.romanceable && heartsOf(c.b.fp) >= 4 ? 10 : 0);
  return out;
}

export type Tone = "joke" | "praise";
export function tone(g: GameState, ch: Character, t: Tone): Line[] {
  const c = ctxOf(g, ch);
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[2], c) }];
  const rng = rngFor(c, t);
  const trait = t === "joke" ? c.p.traits.humor : 100 - c.p.traits.pride / 2 + (c.p.persona === "proud" ? 30 : 0);
  const good = rng.int(0, 100) < trait;
  addFp(c.b, good ? 14 : -6);
  const lines = t === "joke"
    ? good ? ["Ha ha ha! {You} lạ đời thật!", "Phụt... được rồi, câu đó hay.", "*cười chảy nước mắt* Thôi, đừng kể nữa, đau bụng quá!"] : ["...Không vui.", "{You} nghĩ thế là buồn cười à?", "*nhìn {you} không chớp mắt*"]
    : good ? ["Ôi, {you} làm {I} ngại quá!", "Hừm... cảm ơn. Lâu rồi mới có người nói vậy.", "Thật à? {I} sẽ nhớ câu đó."] : ["Nịnh bợ không có tác dụng đâu.", "{You} muốn gì thì nói thẳng ra.", "Ừ. Cảm ơn. *không tin lắm*"];
  return [{ who: "npc", text: fill(rng.pick(lines), c) }];
}

/** Backstory: a new chapter unlocks at 2, 5 and 7 hearts. */
export function askPast(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[0], c) }];
  const h = heartsOf(c.b.fp);
  const chapters = [
    { need: 0, text: `{I} là ${c.p.race.toLowerCase()}, từng làm ${JOBS[c.p.job].name.toLowerCase()} ở {home}. Chuyện dài lắm, nhưng đại loại vậy.` },
    { need: 2, text: WOUNDS[c.p.wound].told },
    { need: 5, text: SECRETS[c.p.secret].told },
    { need: 7, text: DREAMS[c.p.dream].told },
  ];
  const told = c.b.known.filter((k) => k.startsWith("past")).length;
  const next = chapters[told];
  if (!next) return [{ who: "npc", text: fill("{I} đã kể hết với {you} rồi. Giờ tới lượt {you} kể đi!", c) }];
  if (h < next.need) {
    c.b.acts--; // no cost
    return [{ who: "npc", text: fill(["Chuyện của {I} à? Mình chưa thân tới mức đó.", "Để lúc khác nhé. Khi {I} tin {you} hơn.", "Có những chuyện {I} chưa sẵn sàng kể."][Math.min(2, told)], c) }, { who: "sys", text: `🔒 Cần ${next.need} ❤️ để nghe tiếp.` }];
  }
  c.b.known.push(`past${told}`);
  addFp(c.b, 15);
  return [{ who: "npc", text: fill(next.text, c) }];
}

// ------------------------------------------------------------ deep talk
export function deepQuestion(g: GameState, ch: Character): { q: string; answers: string[]; idx: number } | null {
  const c = ctxOf(g, ch);
  if (heartsOf(c.b.fp) < 3) return null;
  const asked = new Set(c.b.answers.map((a) => Number(a.split(":")[0].slice(1))));
  const pool = DEEP_QUESTIONS.map((_, i) => i).filter((i) => !asked.has(i));
  if (!pool.length) return null;
  const idx = pool[hashString(`${ch.id}:dq:${g.day}`) % pool.length];
  const q = DEEP_QUESTIONS[idx];
  return { idx, q: fill(q.q, c), answers: q.a.map(([t]) => fill(t, c)) };
}
export function answerDeep(g: GameState, ch: Character, idx: number, a: number): Line[] {
  const c = ctxOf(g, ch);
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[0], c) }];
  const rng = rngFor(c, "dq");
  const v = DEEP_QUESTIONS[idx].a[a][1];
  const w = c.p.values[v];
  c.b.answers.push(`q${idx}:${v}`);
  const kind = w >= 2 ? "good" : w >= 0 ? "neutral" : "bad";
  addFp(c.b, { good: 42, neutral: 14, bad: -12 }[kind]);
  if (kind === "good" && c.p.romanceable && heartsOf(c.b.fp) >= 5) addRp(c.b, 15);
  return [{ who: "npc", text: fill(rng.pick(DEEP_REACT[kind]), c) }];
}

// ------------------------------------------------------------ romance
export function canFlirt(g: GameState, ch: Character): string | null {
  const c = ctxOf(g, ch);
  if (!c.p.romanceable) return `${c.p.first} không có ý định yêu đương.`;
  if (c.b.closed) return "Hai người đã quyết định chỉ làm bạn.";
  if (heartsOf(c.b.fp) < 3) return "Cần 3 ❤️ tình bạn.";
  if (c.b.flirt === g.day) return "Hôm nay đã tán tỉnh rồi.";
  return null;
}
export function flirt(g: GameState, ch: Character, style: FlirtStyle): Line[] {
  const c = ctxOf(g, ch);
  const why = canFlirt(g, ch);
  if (why) return [{ who: "sys", text: why }];
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[1], c) }];
  const rng = rngFor(c, "flirt");
  c.b.flirt = g.day;
  const out: Line[] = [{ who: "you", text: fill(rng.pick(FLIRT_LINES[style].lines), c) }];
  const partner = partnerOf(g);
  const taken = partner && partner.id !== ch.id;
  const receptive = !taken && (c.b.rp >= 150 || c.b.stage !== "none" || heartsOf(c.b.fp) + c.p.traits.passion / 25 >= 7);
  let d = receptive ? 28 : heartsOf(c.b.fp) >= 5 ? 6 : -8;
  if (style === c.p.style) d = Math.round(d * 1.6) + 6;
  if (style === c.p.hateStyle) d = Math.min(d, 0) - 12;
  if (taken) d = -10;
  addRp(c.b, d);
  const react = FLIRT_REACT[c.p.persona];
  const pool = taken ? ["{I} nghe nói {you} đã có người rồi. Đừng đùa với {I} như vậy."] : d > 10 ? react.yes : d > -5 ? react.early : react.no;
  out.push({ who: "npc", text: fill(rng.pick(pool), c) });
  if (style === c.p.style && d > 0 && !c.b.known.includes("s+")) { c.b.known.push("s+"); out.push({ who: "sys", text: `💡 ${c.p.first} thích kiểu ${FLIRT_LINES[style].name.toLowerCase()}.` }); }
  if (style === c.p.hateStyle && !c.b.known.includes("s-")) { c.b.known.push("s-"); out.push({ who: "sys", text: `💡 ${c.p.first} không thích kiểu ${FLIRT_LINES[style].name.toLowerCase()}.` }); }
  // the partner may hear about it
  if (taken && partner) {
    const pb = bondOf(g, partner.id);
    if (new Rng(hashString(`${ch.id}:gossip:${g.day}`)).chance(0.55)) {
      pb.jealous = g.day;
      pb.gossip = c.p.first;
      addRp(pb, -45);
      out.push({ who: "sys", text: `😟 Hình như ${partner.name.split(" ")[0]} sẽ nghe được chuyện này...` });
    }
  }
  return out;
}

// ------------------------------------------------------------ dates
export function datePlaces(g: GameState): DatePlace[] {
  const have = new Set(g.buildings.map((b) => b.type));
  return (Object.keys(DATES) as DatePlace[]).filter((k) => !DATES[k].needs.length || DATES[k].needs.some((n) => have.has(n)));
}
export function canDate(g: GameState, ch: Character): string | null {
  const b = bondOf(g, ch.id);
  if (heartsOf(b.fp) < 2) return "Cần 2 ❤️ để rủ đi chơi.";
  if (b.date === g.day) return "Hôm nay đã đi chơi rồi.";
  return null;
}
export function goDate(g: GameState, ch: Character, place: DatePlace): Line[] {
  const c = ctxOf(g, ch);
  const why = canDate(g, ch);
  if (why) return [{ who: "sys", text: why }];
  if (!spend(c)) return [{ who: "npc", text: fill(TIRED[2], c) }];
  c.b.acts = Math.min(ACTS_PER_DAY, c.b.acts + 1); // a date takes a good part of the day
  c.b.date = g.day;
  const d = DATES[place];
  const rng = rngFor(c, "date");
  const t = d.topic as Topic;
  const fit = c.p.loves.includes(t) ? "great" : c.p.likes.includes(t) || place === "walk" ? "good" : c.p.dislikes.includes(t) ? "meh" : rng.chance(0.5) ? "good" : "meh";
  const romantic = c.b.stage !== "none" || c.b.rp >= 200;
  addFp(c.b, { great: 70, good: 36, meh: 6 }[fit]);
  if (c.p.romanceable && !c.b.closed && romantic) addRp(c.b, { great: 60, good: 30, meh: 0 }[fit]);
  c.b.known.push(`date:${place}:${g.day}`);
  return [
    ...d.scene.map((s) => ({ who: "sys" as const, text: fill(s, c) })),
    { who: "sys", text: fill(rng.pick(DATE_END[fit]), c) },
  ];
}

// ------------------------------------------------------------ gifts
export type GiftTier = "love" | "like" | "neutral" | "hate";
export function giftTierOf(ch: Character, id: string): GiftTier {
  const p = profileOf(ch);
  const it = getItem(id);
  if (p.giftLoves.includes(id)) return "love";
  if (p.giftHates.includes(id)) return "hate";
  if (it.equip && ["mercenary", "guard", "adventurer", "blacksmith"].includes(p.job)) return "like";
  if (p.giftLikes.includes(it.type)) return "like";
  return "neutral";
}
/** Today's craving: gifting it doubles the joy. */
export function wishOf(g: GameState, ch: Character): ItemDef | null {
  const p = profileOf(ch);
  const rng = new Rng(hashString(`${ch.id}:wish:${g.day}`));
  if (!rng.chance(0.6)) return null;
  return getItem(rng.pick(p.giftLoves.length ? p.giftLoves : ["bread"]));
}
export function canGiftRes(g: GameState, ch: Character) { return bondOf(g, ch.id).gift !== g.day; }

export function giveResGift(g: GameState, ch: Character, id: string): Line[] {
  const c = ctxOf(g, ch);
  if (!canGiftRes(g, ch)) return [{ who: "sys", text: "Hôm nay đã tặng quà rồi." }];
  if (id === "bouquet") return giveBouquet(g, ch);
  if (id === "promise_ring") return propose(g, ch);
  if (!removeItem(g, id, 1)) return [];
  c.b.gift = g.day;
  const tier = giftTierOf(ch, id);
  const it = getItem(id);
  const bday = isBirthday(g, c.p);
  const wish = wishOf(g, ch)?.id === id;
  let d = { love: 80, like: 40, neutral: 12, hate: -45 }[tier] + (tier !== "hate" ? Math.min(20, Math.floor(it.value / 40)) : 0);
  if (wish) d += 50;
  if (bday) d *= 3;
  addFp(c.b, d);
  if (c.p.romanceable && !c.b.closed && tier === "love" && heartsOf(c.b.fp) >= 4) addRp(c.b, 20);
  const key = `i:${id}${tier === "love" ? "+" : tier === "hate" ? "-" : "~"}`;
  if (!c.b.known.includes(key)) c.b.known.push(key);
  const rng = rngFor(c, "gift");
  const lines = {
    love: ["{item}!! Sao {you} biết {I} thích cái này nhất?!", "Trời ơi, {item}! {I} sẽ giữ nó thật cẩn thận!", "{I}... không biết nói gì luôn. {item} đấy! Cảm ơn {you}!"],
    like: ["Ồ, {item}. {I} thích lắm, cảm ơn nhé.", "Dễ thương ghê. Cảm ơn {you}.", "{item} à? Đúng thứ {I} đang cần."],
    neutral: ["À... {item}. Cảm ơn nhé.", "Cảm ơn. {I} sẽ tìm chỗ dùng nó.", "Ừm, ý tốt là chính mà."],
    hate: ["...{item}? {You} đùa {I} à?", "Mang {item} ra xa {I} đi!", "{I} ghét {item}. {You} không biết sao?"],
  }[tier];
  const out: Line[] = [{ who: "npc", text: voice(c, fill(rng.pick(lines), c, { item: it.name }), tier !== "hate", rng) }];
  if (wish) out.push({ who: "npc", text: fill("Đúng thứ {I} thèm hôm nay! {You} đọc được suy nghĩ à?", c) });
  if (bday) out.push({ who: "npc", text: fill(rng.pick(BIRTHDAY.gift), c) });
  return out;
}

// ------------------------------------------------------------ milestone scenes
export interface PendingScene { key: string; scene: Scene; kind: "hobby" | "wound" | "request" | "secret" | "dream" | "spark" | "confess" | "wedding" | "breakup" }

/** The next milestone scene waiting for this resident, if any. */
export function pendingScene(g: GameState, ch: Character): PendingScene | null {
  const c = ctxOf(g, ch);
  const h = heartsOf(c.b.fp), r = heartsOf(c.b.rp);
  const seen = (k: string) => c.b.events.includes(k);
  const L = (lines: string[], extra: Record<string, string | number> = {}) => lines.map((s) => fill(s, c, extra));
  const ch3 = (cs: Choice[]) => cs.map((x) => ({ ...x, text: fill(x.text, c), reply: fill(x.reply, c) }));
  if (seen("breakup")) return { key: "breakup", kind: "breakup", scene: { title: "💔 Chia tay", lines: L(BREAKUP_SCENE) } };
  if (c.b.stage === "married" && !seen("wedding")) {
    const guests = residents(g).filter((o) => o.id !== ch.id).slice(0, 4).map((o) => o.name.split(" ")[0]);
    return { key: "wedding", kind: "wedding", scene: { title: "💒 Đám cưới", lines: L(WEDDING_SCENE, { guests: guests.length ? guests.join(", ") : "Mầm và những người bạn" }) } };
  }
  if (h >= 2 && !seen("h2")) return { key: "h2", kind: "hobby", scene: { title: `${TOPICS[c.p.loves[0]].icon} Một buổi chiều cùng ${c.p.first}`, lines: L(HOBBY_SCENES[c.p.loves[0]]) } };
  if (h >= 4 && !seen("h4")) { const w = WOUNDS[c.p.wound]; return { key: "h4", kind: "wound", scene: { title: "🌧️ Vết thương cũ", lines: L(w.scene), choices: ch3(w.choices) } }; }
  if (h >= 6 && !seen("h6")) {
    const req = requestFor(g, ch);
    return { key: "h6", kind: "request", scene: { title: "🙏 Một lời nhờ", lines: L(REQUEST_SCENE, { item: getItem(req.item).name, n: req.n }) } };
  }
  if (h >= 8 && !seen("h8")) { const s = SECRETS[c.p.secret]; return { key: "h8", kind: "secret", scene: { title: "🤫 Bí mật", lines: L(s.scene), choices: ch3(s.choices) } }; }
  if (h >= 10 && !seen("h10") && c.b.request?.done) return { key: "h10", kind: "dream", scene: { title: "🌟 Giấc mơ thành hình", lines: L(DREAMS[c.p.dream].scene) } };
  if (c.p.romanceable && !c.b.closed) {
    if (r >= 3 && !seen("r3")) return { key: "r3", kind: "spark", scene: { title: "💓 Rung động", lines: L(ROMANCE_SPARK[hashString(ch.id) % ROMANCE_SPARK.length]) } };
    if (r >= 6 && h >= 6 && !seen("r6") && !partnerOf(g)) return { key: "r6", kind: "confess", scene: { ...ROMANCE_CONFESS, lines: L(ROMANCE_CONFESS.lines), choices: ch3(ROMANCE_CONFESS.choices!) } };
  }
  return null;
}

/** Cheap check for the "!" marker on the map (no text generation). */
export function sceneReady(g: GameState, ch: Character): boolean {
  const b = g.bonds?.[ch.id];
  if (!b) return false;
  const h = heartsOf(b.fp), r = heartsOf(b.rp);
  const seen = (k: string) => b.events.includes(k);
  if (seen("breakup") || (b.stage === "married" && !seen("wedding"))) return true;
  if ((h >= 2 && !seen("h2")) || (h >= 4 && !seen("h4")) || (h >= 6 && !seen("h6")) || (h >= 8 && !seen("h8")) || (h >= 10 && !seen("h10") && !!b.request?.done)) return true;
  const p = profileOf(ch);
  return p.romanceable && !b.closed && ((r >= 3 && !seen("r3")) || (r >= 6 && h >= 6 && !seen("r6") && !partnerOf(g)));
}

/** Marks a scene as seen and applies the chosen answer. */
export function resolveScene(g: GameState, ch: Character, ps: PendingScene, choice?: number): Line[] {
  const c = ctxOf(g, ch);
  if (ps.kind === "breakup") { c.b.events = c.b.events.filter((e) => e !== "breakup"); return []; }
  if (c.b.events.includes(ps.key)) return [];
  c.b.events.push(ps.key);
  const out: Line[] = [];
  addFp(c.b, 30);
  if (ps.kind === "request") {
    c.b.request = requestFor(g, ch);
    out.push({ who: "sys", text: `📋 ${c.p.first} nhờ: mang ${c.b.request.n} ${getItem(c.b.request.item).name}. (Tặng qua mục "Giúp ${c.p.first}")` });
  }
  if (ps.kind === "dream") {
    ch.bond = ch.bond === "beloved" ? "beloved" : "kindred";
    out.push({ who: "sys", text: `🤝 ${c.p.first} trở thành Tri Kỷ của bạn — nhận nội tại "Tri Kỷ" khi chiến đấu.` });
    logMsg(g, `${ch.name} trở thành tri kỷ.`);
  }
  if (ps.kind === "confess") {
    if (choice === 0) { c.b.mutual = true; addRp(c.b, 100); out.push({ who: "sys", text: `💞 Hai người đã thổ lộ lòng mình. Tặng Bó Hoa Tỏ Tình để chính thức hẹn hò.` }); }
    else if (choice === 2) { c.b.closed = true; c.b.rp = 0; out.push({ who: "sys", text: "Hai người sẽ chỉ là bạn." }); }
    else c.b.events = c.b.events.filter((e) => e !== "r6"); // asked for time: the question comes back later
  }
  if (choice !== undefined && ps.scene.choices?.[choice]) {
    const ch0 = ps.scene.choices[choice];
    const w = c.p.values[ch0.value] ?? 0;
    addFp(c.b, w >= 2 ? 40 : w >= 0 ? 15 : -5);
    out.unshift({ who: "npc", text: ch0.reply });
  }
  return out;
}

function requestFor(g: GameState, ch: Character): { item: string; n: number } {
  const p = profileOf(ch);
  const rng = new Rng(hashString(`${ch.id}:request`));
  const kind = DREAMS[p.dream].wish;
  const pools: Record<string, string[]> = {
    crop: ["wheat", "tomato", "potato", "strawberry", "pumpkin", "corn"], food: ["bread", "fish_stew", "honey", "cheese", "cake"],
    gem: ["amber", "pearl", "emerald", "mana_crystal"], material: ["iron_ingot", "wood", "stone", "plank_forest", "copper_ingot"],
  };
  const pool = (pools[kind] ?? p.giftLoves).filter((id) => getItem(id).value > 0);
  const item = rng.pick(pool.length ? pool : p.giftLoves.length ? p.giftLoves : ["bread"]);
  const v = getItem(item).value;
  return { item, n: v > 100 ? 1 : v > 30 ? 3 : 6 };
}

/** Hands over the items of an accepted request. */
export function fulfilRequest(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  const r = c.b.request;
  if (!r || r.done) return [];
  if ((g.inventory[r.item] ?? 0) < r.n) return [{ who: "sys", text: `Cần ${r.n} ${getItem(r.item).name} (đang có ${g.inventory[r.item] ?? 0}).` }];
  removeItem(g, r.item, r.n);
  r.done = true;
  addFp(c.b, 120);
  return REQUEST_DONE.map((s) => ({ who: "sys" as const, text: fill(s, c, { item: getItem(r.item).name }) }));
}

// ------------------------------------------------------------ bouquet, proposal, wedding
export function giveBouquet(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  const partner = partnerOf(g);
  if (partner && partner.id !== ch.id) return [{ who: "npc", text: fill("{You} đã có {partner} rồi mà. Đừng làm vậy với {I}.", c) }];
  if (c.b.stage !== "none") return [{ who: "npc", text: fill("Mình đã là của nhau rồi mà, ngốc.", c) }];
  if (!c.p.romanceable || c.b.closed) return [{ who: "npc", text: fill("{I}... xin lỗi. {I} không thể nhận.", c) }];
  if (!c.b.mutual && (c.b.rp < 600 || c.b.fp < 700)) return [{ who: "npc", text: fill(FLIRT_REACT[c.p.persona].early[0], c) }, { who: "sys", text: "Cần 6 ❤️ tình cảm và 7 ❤️ tình bạn (hoặc đã thổ lộ với nhau)." }];
  if (!removeItem(g, "bouquet", 1)) return [{ who: "sys", text: "Bạn không có Bó Hoa Tỏ Tình." }];
  c.b.gift = g.day;
  c.b.stage = "dating";
  addRp(c.b, 100);
  logMsg(g, `Bắt đầu hẹn hò với ${ch.name}.`);
  return DATING_SCENE.map((s) => ({ who: "sys" as const, text: fill(s, c) }));
}
export function propose(g: GameState, ch: Character): Line[] {
  const c = ctxOf(g, ch);
  if (c.b.stage !== "dating") return [{ who: "sys", text: "Cần đang hẹn hò trước đã." }];
  if (c.b.rp < 900 || c.b.fp < 900) return [{ who: "npc", text: fill("{I}... chưa sẵn sàng cho bước đó. Cho {I} thêm thời gian nhé.", c) }, { who: "sys", text: "Cần 9 ❤️ tình cảm và 9 ❤️ tình bạn." }];
  if (houseLevel(g) < 2) return [{ who: "sys", text: "Cần nâng cấp Nhà Chính lên cấp 2 để hai người có chỗ ở." }];
  if (!removeItem(g, "promise_ring", 1)) return [{ who: "sys", text: "Bạn không có Nhẫn Đính Ước." }];
  c.b.gift = g.day;
  c.b.stage = "engaged";
  c.b.wedding = g.day + 3;
  logMsg(g, `Đính hôn với ${ch.name}. Đám cưới vào ngày ${c.b.wedding}.`);
  return [...PROPOSAL_SCENE.map((s) => ({ who: "sys" as const, text: fill(s, c) })), { who: "sys", text: `💍 Đám cưới sẽ diễn ra vào ngày ${c.b.wedding}.` }];
}

// ------------------------------------------------------------ daily upkeep
/** Called when a new day starts. Returns report lines. */
export function residentsNewDay(g: GameState): string[] {
  const lines: string[] = [];
  for (const ch of residents(g)) {
    const b = g.bonds?.[ch.id];
    if (!b) continue;
    const away = g.day - (b.day || g.day);
    if (away >= 4 && b.stage !== "married") b.fp = Math.max(heartsOf(b.fp) >= 10 ? 1000 : 0, b.fp - 4);
    if (away >= 3 && b.stage === "dating") b.rp = Math.max(0, b.rp - 6);
    if (b.jealous && g.day - b.jealous > 4) { b.jealous = undefined; b.gossip = undefined; }
    if (b.stage === "dating" && b.rp < 200) {
      b.stage = "none"; b.mutual = false; b.events = b.events.filter((e) => e !== "r6"); b.events.push("breakup");
      lines.push(`💔 ${ch.name} đã chia tay bạn.`);
      logMsg(g, `${ch.name} chia tay.`);
    }
    if (b.stage === "engaged" && b.wedding && g.day >= b.wedding) {
      b.stage = "married";
      ch.bond = "beloved";
      g.chars[g.heroId].bond = "beloved";
      lines.push(`💒 Hôm nay là đám cưới của bạn và ${ch.name}! Hãy tới gặp ${ch.name.split(" ")[0]}.`);
      logMsg(g, `Kết hôn với ${ch.name}.`);
    }
    if (isBirthday(g, profileOf(ch))) lines.push(`🎂 Hôm nay là sinh nhật của ${ch.name}.`);
  }
  return lines;
}

// ------------------------------------------------------------ ambient text for the map
export function ambientLine(g: GameState, ch: Character, seed: number): string {
  const c = ctxOf(g, ch);
  const rng = new Rng(seed);
  return fill(rng.chance(0.6) ? rng.pick(AMBIENT[c.p.persona]) : rng.pick(AMBIENT_ANY), c);
}
export function gossipLine(g: GameState, ch: Character): Line | null {
  const c = ctxOf(g, ch);
  const rng = rngFor(c, "gossip");
  const partner = partnerOf(g);
  const rel = relations(g, ch);
  if (partner && partner.id !== ch.id && rng.chance(0.4)) return { who: "npc", text: fill(rng.pick(GOSSIP.partner), c) };
  if (rel.rival && rng.chance(0.35)) return { who: "npc", text: fill(rng.pick(GOSSIP.rival), c) };
  if (rel.friend) return { who: "npc", text: fill(rng.pick(GOSSIP.friend), c) };
  return null;
}

/** What the player has learned about a resident (for the profile page). */
export function knownTastes(g: GameState, ch: Character) {
  const b = bondOf(g, ch.id);
  const p = profileOf(ch);
  return {
    loves: p.loves.filter((t) => b.known.includes(`t:${t}+`)),
    dislikes: p.dislikes.filter((t) => b.known.includes(`t:${t}-`)),
    giftLoves: p.giftLoves.filter((id) => b.known.includes(`i:${id}+`)),
    giftHates: p.giftHates.filter((id) => b.known.includes(`i:${id}-`)),
    style: b.known.includes("s+") ? p.style : null,
    hateStyle: b.known.includes("s-") ? p.hateStyle : null,
    dates: b.known.filter((k) => k.startsWith("date:")).length,
  };
}

/** Grants romance items (sold by Mầm). */
export function buyRomanceItem(g: GameState, id: "bouquet" | "promise_ring"): string | null {
  const price = id === "bouquet" ? 800 : 6000;
  if (g.gold < price) return `Cần ${price} vàng.`;
  g.gold -= price;
  addItem(g, id, 1);
  return null;
}
export const ROMANCE_PRICES = { bouquet: 800, promise_ring: 6000 };
