import { Rng, hashString } from "../core/rng";
import { addItem, logMsg, makeCharacter, removeItem, syncLook, type Character, type GameState, type NpcMemory, type RecruitOffer } from "../core/state";
import { CLASSES } from "../data/classes";
import { ENEMIES } from "../data/enemies";
import {
  BIOME_MATS, CROP_LIST, ITEM_LIST, SEASON_NAMES, getItem, metalTierForFloor, seasonOf, type ItemDef, type ItemType,
} from "../data/items";
import {
  BIO, EPITHETS, GIFT_REACT, GREET, JOBS, JOB_TALK, MEMORY_TALK, NAME_PARTS, PERSONAS, QUEST_TALK, RACES, REACT,
  RECRUIT_TALK, SETTLEMENT_PREFIX, SETTLEMENT_WORDS, WORLD_TALK, type Job, type Persona,
} from "../data/npcText";
import { PLAYER_PASSIVES } from "../data/passives";
import { getFloor, settlementCount } from "./floors";
import { SPECS } from "./floorSpec";
import { WEATHER } from "./town";

// ============================================================ settlements
export type SettlementSize = "village" | "town" | "city";
export type ShopKind = "general" | "smith" | "apothecary" | "seeds" | "tailor" | "arcane" | "jeweler" | "market";

export const SHOP_NAMES: Record<ShopKind, { name: string; icon: string; owner: Job }> = {
  general: { name: "Tạp Hoá", icon: "🏪", owner: "merchant" },
  smith: { name: "Lò Rèn", icon: "⚒️", owner: "blacksmith" },
  apothecary: { name: "Tiệm Thuốc", icon: "⚗️", owner: "herbalist" },
  seeds: { name: "Tiệm Hạt Giống", icon: "🌱", owner: "farmer" },
  tailor: { name: "Tiệm May", icon: "🧵", owner: "merchant" },
  arcane: { name: "Tiệm Phép Thuật", icon: "🔮", owner: "scholar" },
  jeweler: { name: "Tiệm Kim Hoàn", icon: "💍", owner: "merchant" },
  market: { name: "Chợ Nông Sản", icon: "🧺", owner: "farmer" },
};

export const SIZE_NAMES: Record<SettlementSize, string> = { village: "Làng", town: "Thị trấn", city: "Thành phố" };

export interface Settlement {
  id: string;
  floor: number;
  idx: number;
  name: string;
  size: SettlementSize;
  biome: string;
  shops: ShopKind[];
  npcs: string[];
  desc: string;
}

const settlementCache = new Map<string, Settlement>();

export function floorSettlements(floor: number): Settlement[] {
  return Array.from({ length: settlementCount(floor) }, (_, i) => getSettlement(floor, i));
}

export function getSettlement(floor: number, idx: number): Settlement {
  const key = `${floor}:${idx}`;
  const hit = settlementCache.get(key);
  if (hit) return hit;
  const def = getFloor(floor);
  const rng = new Rng(hashString(`settle:${key}`));
  const score = floor / 6 + rng.next() * 1.2 - idx * 0.35;
  const size: SettlementSize = idx === 0 && floor <= 2 ? "village" : score < 0.8 ? "village" : score < 1.7 ? "town" : "city";
  const words = SETTLEMENT_WORDS[def.family] ?? SETTLEMENT_WORDS.forest;
  const given = SPECS[floor]?.towns?.[idx];
  const name = given ?? `${rng.pick(SETTLEMENT_PREFIX[size])} ${words[(idx * 2 + floor) % words.length]}`;
  const shops: ShopKind[] = size === "village" ? ["general", rng.pick<ShopKind>(["seeds", "market", "apothecary"])]
    : size === "town" ? ["general", "smith", "apothecary", "seeds", rng.pick<ShopKind>(["tailor", "market"])]
    : ["general", "smith", "apothecary", "seeds", "tailor", "arcane", "jeweler", "market"];
  const nNpc = size === "village" ? 4 : size === "town" ? 7 : 11;
  const npcs = Array.from({ length: nNpc }, (_, i) => `n${floor}_${idx}_${i}`);
  const desc = size === "village"
    ? `Một ngôi làng nhỏ giữa ${def.name}. Vài mái nhà, một giếng nước, và những người đã học cách sống cạnh quái vật.`
    : size === "town"
      ? `Thị trấn tấp nập với chợ phiên, lò rèn và quán trọ. Lữ khách từ các tầng khác thường dừng chân ở đây.`
      : `Một thành phố thật sự dưới lòng Vực Sâu: tường đá, tháp canh, hàng chục cửa tiệm và hàng nghìn cư dân.`;
  const s: Settlement = { id: key, floor, idx, name, size, biome: def.family, shops, npcs, desc };
  settlementCache.set(key, s);
  return s;
}

// ============================================================ NPC generation
export interface NpcDef {
  id: string;
  name: string;
  floor: number;
  settlement: string; // settlement id
  town: string; // settlement name
  race: string;
  job: Job;
  persona: Persona;
  classId: string;
  level: number;
  sprite: string;
  pal: Record<string, string>;
  recruitable: boolean;
  loves: string[];
  likes: ItemType[];
  hates: string[];
  wage: number; // gold asked by greedy recruits
}

const HAIR = ["#2a1a12", "#6b3f22", "#c8a060", "#e8e0d0", "#b04a2a", "#3a3a4a", "#d9d2f5", "#3a6b3a", "#f0d26a", "#8a3a8a"];
const CLOTH = ["#3b6fd6", "#7b4bc4", "#3e8a3a", "#a33a3a", "#d8c090", "#2a4a3a", "#b0763a", "#5a8ac0", "#c870a0", "#6a6a72", "#e0a040", "#2f7a4a"];
const SKIN = ["#f5d6b8", "#e8b890", "#c68a5a", "#8a5a3a", "#efe0c0", "#b8d8b0", "#c8c8e8"];

export const TASTE: Record<Job, { shapes: string[]; likes: ItemType[] }> = {
  merchant: { shapes: ["gem", "coin", "ring", "pearl", "amulet"], likes: ["material", "equip"] },
  farmer: { shapes: ["seed", "grain", "root", "fruit", "berry", "gourd"], likes: ["crop", "seed", "fertilizer"] },
  guard: { shapes: ["meat", "bread", "skewer", "shield"], likes: ["food", "potion"] },
  hunter: { shapes: ["meat", "fang", "hide", "bow", "feather"], likes: ["food", "animal"] },
  scholar: { shapes: ["book", "scroll", "crystal", "tome", "ink"], likes: ["scroll", "tome", "herb"] },
  priest: { shapes: ["flower", "honey", "cup", "essence"], likes: ["herb", "crop", "potion"] },
  adventurer: { shapes: ["potion", "scroll", "sword", "bomb"], likes: ["potion", "bomb", "equip"] },
  blacksmith: { shapes: ["ingot", "ore", "hammer", "axe"], likes: ["material", "equip"] },
  innkeeper: { shapes: ["bottle", "cheese", "cake", "bowl"], likes: ["food", "animal", "crop"] },
  child: { shapes: ["cake", "honey", "berry", "egg", "shell"], likes: ["food", "crop"] },
  elder: { shapes: ["cup", "herb", "book", "mushroom"], likes: ["herb", "food"] },
  bard: { shapes: ["bottle", "cup", "flower", "feather"], likes: ["food", "crop"] },
  mercenary: { shapes: ["sword", "axe", "meat", "bottle"], likes: ["equip", "food", "bomb"] },
  herbalist: { shapes: ["herb", "flower", "mushroom", "vial"], likes: ["herb", "crop", "potion"] },
  fisher: { shapes: ["fish", "shell", "pearl", "rope"], likes: ["animal", "food"] },
};
export const GROSS = ["gel", "bone", "sac", "dust", "thorn", "compost", "wax", "claw"];

const JOB_WEIGHTS: [Job, number][] = [
  ["merchant", 2], ["farmer", 3], ["guard", 3], ["hunter", 3], ["scholar", 2], ["priest", 2], ["adventurer", 4], ["blacksmith", 1],
  ["innkeeper", 1], ["child", 2], ["elder", 2], ["bard", 2], ["mercenary", 4], ["herbalist", 2], ["fisher", 2],
];
const PERSONA_LIST = Object.keys(PERSONAS) as Persona[];

const npcCache = new Map<string, NpcDef>();
const itemPool = new Map<string, ItemDef[]>();

export function itemsWithShapes(shapes: string[], maxValue: number): ItemDef[] {
  const k = `${shapes.join(",")}|${maxValue}`;
  let hit = itemPool.get(k);
  if (!hit) {
    hit = ITEM_LIST.filter((i) => shapes.includes(i.shape) && i.value <= maxValue && i.type !== "key" && i.type !== "tome");
    itemPool.set(k, hit);
  }
  return hit;
}

export function getNpc(id: string): NpcDef {
  const hit = npcCache.get(id);
  if (hit) return hit;
  const m = /^n(\d+)_(\d+)_(\d+)$/.exec(id);
  if (!m) throw new Error(`Bad npc id ${id}`);
  const floor = Number(m[1]), sIdx = Number(m[2]), i = Number(m[3]);
  const s = getSettlement(floor, sIdx);
  const rng = new Rng(hashString(`npc:${id}`));
  // shop owners come first so every shop has someone behind the counter
  const job: Job = i < s.shops.length ? SHOP_NAMES[s.shops[i]].owner : rng.weighted(JOB_WEIGHTS, (x) => x[1])[0];
  const def = makeNpc(rng, id, floor, s, job);
  npcCache.set(id, def);
  return def;
}

function makeNpc(rng: Rng, id: string, floor: number, s: Pick<Settlement, "id" | "name" | "biome">, job: Job): NpcDef {
  const parts = NAME_PARTS[s.biome] ?? NAME_PARTS.forest;
  const first = rng.pick(parts.a) + rng.pick(parts.b);
  const name = rng.chance(0.55) ? `${first} ${rng.pick(EPITHETS)}` : first;
  const persona = rng.pick(PERSONA_LIST);
  const jobDef = JOBS[job];
  const classId = rng.pick(jobDef.classes);
  const level = Math.max(1, getFloor(floor).levelBase + rng.int(-2, 3) + (job === "elder" ? 3 : 0));
  const hat = classId === "mage" || classId === "witch";
  const race = rng.pick(RACES);
  const pal: Record<string, string> = { h: rng.pick(HAIR), c: rng.pick(CLOTH), b: rng.pick(CLOTH), p: rng.pick(CLOTH), s: rng.pick(SKIN), r: race, j: job, g: rng.chance(0.5) ? "f" : "m" };
  if (hat) pal.t = rng.pick(CLOTH);
  pal.k = classId;
  const maxV = 40 + floor * 25;
  const taste = TASTE[job];
  const lovePool = itemsWithShapes(taste.shapes, maxV);
  const hatePool = itemsWithShapes(GROSS, maxV);
  const loves = rng.shuffle([...lovePool]).slice(0, 3).map((x) => x.id);
  const hates = rng.shuffle([...hatePool]).filter((x) => !loves.includes(x.id)).slice(0, 2).map((x) => x.id);
  return {
    id, name, floor, settlement: s.id, town: s.name, race, job, persona, classId, level,
    sprite: hat ? "hero_mage" : "villager", pal, recruitable: jobDef.recruit || rng.chance(0.15),
    loves, likes: taste.likes, hates, wage: persona === "greedy" ? 120 * Math.max(1, level) : 0,
  };
}

// ============================================================ memory & affinity
export function memOf(g: GameState, id: string): NpcMemory {
  return (g.npcs[id] ??= { aff: 0, talks: 0, lastDay: 0, giftDay: 0, seen: [], mem: [], questsDone: [] });
}
export const affTier = (aff: number) => (aff < 10 ? 0 : aff < 30 ? 1 : aff < 60 ? 2 : 3);
export const AFF_NAMES = ["Người lạ", "Quen biết", "Bạn bè", "Tri kỷ"];
export const hearts = (aff: number) => "❤️".repeat(affTier(aff)) + "🤍".repeat(3 - affTier(aff));

function addAff(m: NpcMemory, d: number) {
  m.aff = Math.max(-100, Math.min(100, m.aff + d));
}
function remember(m: NpcMemory, tag: string) {
  const key = tag.split(":")[0];
  m.mem = m.mem.filter((t) => t.split(":")[0] !== key);
  m.mem.push(tag);
  if (m.mem.length > 40) m.mem.shift();
}
const recall = (m: NpcMemory, key: string) => m.mem.find((t) => t.split(":")[0] === key)?.split(":").slice(1);

export interface TalkCtx {
  g: GameState;
  npc: NpcDef;
}

function fill(text: string, { g, npc }: TalkCtx, extra: Record<string, string | number> = {}): string {
  const f = getFloor(npc.floor);
  const bossId = f.boss.find((id) => ENEMIES[id]?.boss) ?? f.boss[0];
  const vars: Record<string, string | number> = {
    p: g.chars[g.heroId].name, me: npc.name.split(" ")[0], town: npc.town, floor: npc.floor, fname: f.name,
    region: f.regions[hashString(npc.id + g.day) % f.regions.length], boss: ENEMIES[bossId]?.name ?? "kẻ canh cửa",
    job: JOBS[npc.job].name.toLowerCase(), race: npc.race, season: SEASON_NAMES[seasonOf(g.day)].toLowerCase(),
    weather: WEATHER[g.weather].name.toLowerCase(), deeper: npc.floor + 1 + (hashString(npc.id) % 3), deep: g.maxFloor, ...extra,
  };
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** How many recent lines an NPC remembers saying (kept small: it is stored in the save). */
export const SEEN_MAX = 40;

/** Picks a line from a pool, preferring ones this NPC hasn't said yet. */
function pickFresh(pool: string[], m: NpcMemory, tag: string, rng: Rng): string {
  const ids = pool.map((_, i) => `${tag}${i}`);
  let fresh = ids.filter((id) => !m.seen.includes(id));
  if (!fresh.length) {
    m.seen = m.seen.filter((s) => !s.startsWith(tag));
    fresh = ids;
  }
  const id = rng.pick(fresh);
  m.seen.push(id);
  if (m.seen.length > SEEN_MAX) m.seen.splice(0, m.seen.length - SEEN_MAX);
  return pool[ids.indexOf(id)];
}

/** Greeting line — reacts to what the NPC remembers about the player. */
export function greet(ctx: TalkCtx): string[] {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  const rng = new Rng(hashString(`${npc.id}:${g.day}:${m.talks}`));
  const out: string[] = [];
  const tier = affTier(m.aff);
  if (m.aff < -20) out.push(fill(rng.pick(["...Cậu còn dám tới đây à?", "Tôi không có gì để nói với cậu.", "Hừ. Nói nhanh rồi đi."]), ctx));
  else out.push(fill(pickFresh(GREET[npc.persona][tier], m, `g${tier}_`, rng), ctx));
  // memory reactions
  const days = m.lastDay ? g.day - m.lastDay : 0;
  const memLines: string[] = [];
  if (days >= 7) memLines.push(fill(rng.pick(MEMORY_TALK.longAbsence), ctx, { days }));
  if (g.floors[npc.floor]?.cleared && !m.mem.includes("sawBoss")) {
    memLines.push(fill(rng.pick(MEMORY_TALK.bossBeaten), ctx));
    m.mem.push("sawBoss");
  }
  if (g.maxFloor >= npc.floor + 3 && !m.mem.includes(`deep${g.maxFloor}`)) {
    memLines.push(fill(rng.pick(MEMORY_TALK.deepDiver), ctx));
    m.mem = m.mem.filter((t) => !t.startsWith("deep"));
    m.mem.push(`deep${g.maxFloor}`);
  }
  const lastGift = recall(m, "gift");
  if (lastGift && m.giftDay && g.day - m.giftDay <= 5 && m.lastDay < g.day) {
    const [item, tierG] = lastGift;
    if (tierG === "love") memLines.push(fill(rng.pick(MEMORY_TALK.lastGiftLoved), ctx, { item: getItem(item).name }));
    if (tierG === "hate") memLines.push(fill(rng.pick(MEMORY_TALK.lastGiftHated), ctx, { item: getItem(item).name }));
  }
  const tone = recall(m, "tone")?.[0];
  if (tone === "rude" && m.lastDay < g.day) memLines.push(fill(rng.pick(MEMORY_TALK.wasRude), ctx));
  if (tone === "joke" && m.lastDay < g.day && PERSONAS[npc.persona].joke > 0) memLines.push(fill(rng.pick(MEMORY_TALK.joked), ctx));
  const friend = Object.values(g.chars).find((c) => c.origin && c.origin !== npc.id && getNpcSafe(c.origin)?.settlement === npc.settlement);
  if (friend && rng.chance(0.4)) memLines.push(fill(rng.pick(MEMORY_TALK.friendRecruited), ctx, { friend: friend.name.split(" ")[0] }));
  if (m.questsDone.length && rng.chance(0.3)) memLines.push(fill(rng.pick(MEMORY_TALK.questDone), ctx));
  if ((g.weather === "rain" || g.weather === "storm") && rng.chance(0.4)) memLines.push(fill(rng.pick(MEMORY_TALK.rainyDay), ctx));
  if (npc.race === "Người Chuyển Sinh" && !m.mem.includes("isekai")) {
    memLines.push(fill(rng.pick(MEMORY_TALK.playerReincarnated), ctx));
    m.mem.push("isekai");
  }
  if (m.lastDay < g.day && rng.chance(0.3)) memLines.push(rng.pick(MEMORY_TALK.morningMood));
  out.push(...memLines.slice(0, 2));
  // first conversation of the day raises affinity a little
  if (m.lastDay < g.day) {
    addAff(m, npc.persona === "cheerful" ? 3 : npc.persona === "grumpy" ? 1 : 2);
    m.lastDay = g.day;
  }
  m.talks++;
  return out;
}

function getNpcSafe(id: string): NpcDef | null {
  try { return getNpc(id); } catch { return null; }
}

/** Small talk: job gossip, world lore or floor rumours. */
export function chat(ctx: TalkCtx): string {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  const rng = new Rng(hashString(`${npc.id}:chat:${m.talks}:${m.seen.length}`));
  m.talks++;
  return rng.chance(0.55)
    ? fill(pickFresh(JOB_TALK[npc.job], m, `j_`, rng), ctx)
    : fill(pickFresh(WORLD_TALK, m, `w_`, rng), ctx);
}

/** Backstory: unlocks one chapter per affinity tier. */
export function askAbout(ctx: TalkCtx): { text: string; locked: boolean } {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  const tier = affTier(m.aff);
  const told = m.mem.filter((t) => t.startsWith("bio")).length;
  if (told > tier) {
    return { text: fill(["Chuyện của tôi à? Chúng ta chưa thân tới mức đó.", "Để lúc khác nhé. Khi tôi tin cậu hơn.", "Tôi đã kể hết những gì có thể kể... lúc này."][Math.min(2, tier)], ctx), locked: true };
  }
  const chapter = Math.min(told, BIO.length - 1);
  const rng = new Rng(hashString(`${npc.id}:bio:${chapter}`));
  if (!m.mem.includes(`bio${chapter}`)) m.mem.push(`bio${chapter}`);
  return { text: fill(rng.pick(BIO[chapter]), ctx), locked: false };
}

export type Tone = "joke" | "flatter" | "rude";
/** Player picks a tone; persona and daily mood decide the reaction. */
export function reply(ctx: TalkCtx, tone: Tone): { text: string; delta: number } {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  if (m.mem.includes(`toneday${g.day}`)) return { text: "Hôm nay nói chuyện vậy đủ rồi.", delta: 0 };
  const rng = new Rng(hashString(`${npc.id}:tone:${g.day}`));
  const mood = rng.int(-1, 1);
  let delta = PERSONAS[npc.persona][tone] + mood;
  if (tone === "flatter" && m.mem.some((t) => t.startsWith("tone:flatter"))) delta -= 2; // repetition gets old
  addAff(m, delta);
  remember(m, `tone:${tone}`);
  m.mem = m.mem.filter((t) => !t.startsWith("toneday"));
  m.mem.push(`toneday${g.day}`);
  return { text: rng.pick(delta > 0 ? REACT[tone].good : REACT[tone].bad), delta };
}

export type GiftTier = "love" | "like" | "neutral" | "hate";
export function giftTier(npc: NpcDef, itemId: string): GiftTier {
  const it = getItem(itemId);
  if (npc.loves.includes(itemId)) return "love";
  if (npc.hates.includes(itemId)) return "hate";
  if (npc.likes.includes(it.type)) return "like";
  return "neutral";
}

export function canGift(g: GameState, npc: NpcDef) {
  return memOf(g, npc.id).giftDay !== g.day;
}

export function giveGift(ctx: TalkCtx, itemId: string): { text: string; delta: number; tier: GiftTier } {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  if (!removeItem(g, itemId, 1)) return { text: "...", delta: 0, tier: "neutral" };
  const tier = giftTier(npc, itemId);
  const it = getItem(itemId);
  const bonus = Math.min(5, Math.floor(it.value / 60));
  const delta = { love: 15, like: 6, neutral: 2, hate: -10 }[tier] + (tier === "hate" ? 0 : bonus) + (npc.persona === "greedy" && it.value >= 100 ? 5 : 0);
  addAff(m, delta);
  m.giftDay = g.day;
  remember(m, `gift:${itemId}:${tier}`);
  const rng = new Rng(hashString(`${npc.id}:gift:${g.day}`));
  return { text: fill(rng.pick(GIFT_REACT[tier]), ctx, { item: it.name }), delta, tier };
}

/** Hint about taste, revealed as affinity grows. */
export function tasteHint(g: GameState, npc: NpcDef): string {
  const tier = affTier(memOf(g, npc.id).aff);
  if (tier === 0) return "Chưa biết họ thích gì. Hãy trò chuyện nhiều hơn.";
  const parts = [`Thích: ${npc.likes.map((t) => t).map((t) => TYPE_HINT[t] ?? t).join(", ")}`];
  if (tier >= 2) parts.push(`Rất thích: ${npc.loves.map((id) => getItem(id).name).join(", ")}`);
  if (tier >= 1) parts.push(`Ghét: ${npc.hates.slice(0, tier).map((id) => getItem(id).name).join(", ")}`);
  return parts.join(" · ");
}
const TYPE_HINT: Partial<Record<ItemType, string>> = {
  material: "nguyên liệu", crop: "nông sản", seed: "hạt giống", food: "món ăn", potion: "thuốc", equip: "trang bị", herb: "thảo mộc",
  scroll: "cuộn phép", tome: "sách", fertilizer: "phân bón", animal: "sản vật chăn nuôi", bomb: "vật phẩm ném",
};

// ============================================================ quests
export interface QuestInfo {
  kind: "fetch" | "crop" | "hunt" | "boss";
  item?: string;
  n: number;
  start: number; // kill counter at accept time
  reward: { gold: number; items: Record<string, number> };
}

export function questFor(g: GameState, npc: NpcDef): QuestInfo {
  const m = memOf(g, npc.id);
  const k = m.questsDone.length;
  const rng = new Rng(hashString(`${npc.id}:quest:${k}`));
  const f = getFloor(npc.floor);
  const lvl = Math.max(1, npc.floor);
  const kinds: QuestInfo["kind"][] = ["fetch", "crop", "hunt", "fetch", "crop"];
  if (!g.floors[npc.floor]?.cleared && k >= 1) kinds.push("boss");
  const kind = rng.pick(kinds);
  const gold = Math.round((40 + lvl * 25) * (kind === "boss" ? 4 : 1) * (1 + k * 0.15));
  const rewardItem = rng.pick(itemsWithShapes(TASTE[npc.job].shapes, 60 + npc.floor * 30).filter((i) => i.type !== "equip").concat(getItem("potion_hp2")));
  const reward = { gold, items: { [rewardItem.id]: kind === "boss" ? 3 : 1, ...(kind === "boss" ? { mana_crystal: 3 } : {}) } };
  if (kind === "fetch") {
    const mats = BIOME_MATS[f.family] ?? BIOME_MATS.forest;
    const item = rng.pick([mats.wood, mats.stone, mats.herb, mats.fiber, mats.hide]);
    return { kind, item, n: rng.int(3, 6), start: 0, reward };
  }
  if (kind === "crop") {
    const maxTier = Math.min(5, 1 + Math.floor(npc.floor / 3));
    const crop = rng.pick(CROP_LIST.filter((c) => c.tier <= maxTier));
    return { kind, item: crop.id, n: rng.int(3, 8), start: 0, reward };
  }
  if (kind === "hunt") return { kind, n: rng.int(3, 6), start: g.stats.battles, reward };
  return { kind, n: 1, start: 0, reward };
}

export function questText(ctx: TalkCtx, q: QuestInfo): string {
  const rng = new Rng(hashString(`${ctx.npc.id}:qt:${q.kind}`));
  return fill(rng.pick(QUEST_TALK.offer[q.kind]), ctx, { n: q.n, item: q.item ? getItem(q.item).name : "" });
}

export function questGoal(q: QuestInfo, npc: NpcDef): string {
  if (q.kind === "fetch" || q.kind === "crop") return `Mang ${q.n} ${getItem(q.item!).name}`;
  if (q.kind === "hunt") return `Thắng ${q.n} trận chiến`;
  const f = getFloor(npc.floor);
  return `Hạ Boss Canh Cửa tầng ${npc.floor} (${ENEMIES[f.boss.find((id) => ENEMIES[id]?.boss) ?? f.boss[0]]?.name ?? ""})`;
}

export function questProgress(g: GameState, q: QuestInfo, npc: NpcDef): { have: number; need: number; ok: boolean } {
  if (q.kind === "fetch" || q.kind === "crop") { const have = g.inventory[q.item!] ?? 0; return { have, need: q.n, ok: have >= q.n }; }
  if (q.kind === "hunt") { const have = g.stats.battles - q.start; return { have: Math.min(have, q.n), need: q.n, ok: have >= q.n }; }
  const ok = !!g.floors[npc.floor]?.cleared;
  return { have: ok ? 1 : 0, need: 1, ok };
}

export function acceptQuest(g: GameState, npc: NpcDef) {
  const m = memOf(g, npc.id);
  const q = questFor(g, npc);
  m.quest = { id: JSON.stringify(q), stage: 1, startDay: g.day };
  logMsg(g, `Nhận việc của ${npc.name}: ${questGoal(q, npc)}.`);
}

export function activeQuest(g: GameState, npcId: string): QuestInfo | null {
  const qs = g.npcs[npcId]?.quest;
  if (!qs) return null;
  try { return JSON.parse(qs.id) as QuestInfo; } catch { return null; }
}

export function completeQuest(ctx: TalkCtx): string | null {
  const { g, npc } = ctx;
  const m = memOf(g, npc.id);
  const q = activeQuest(g, npc.id);
  if (!q || !questProgress(g, q, npc).ok) return null;
  if ((q.kind === "fetch" || q.kind === "crop") && !removeItem(g, q.item!, q.n)) return null;
  g.gold += q.reward.gold;
  for (const [id, n] of Object.entries(q.reward.items)) addItem(g, id, n);
  addAff(m, 15);
  m.questsDone.push(`${q.kind}:${m.questsDone.length}`);
  remember(m, "helped:1");
  m.quest = undefined;
  logMsg(g, `Hoàn thành việc giúp ${npc.name}.`);
  const rng = new Rng(hashString(`${npc.id}:done:${m.questsDone.length}`));
  return fill(rng.pick(QUEST_TALK.done), ctx);
}

/** All quests currently accepted (for the journal). */
export function questLog(g: GameState): { npc: NpcDef; q: QuestInfo }[] {
  const out: { npc: NpcDef; q: QuestInfo }[] = [];
  for (const id of Object.keys(g.npcs)) {
    const q = activeQuest(g, id);
    const npc = getNpcSafe(id);
    if (q && npc) out.push({ npc, q });
  }
  return out;
}

// ============================================================ recruiting
export function recruitCheck(g: GameState, npc: NpcDef): { ok: boolean; reason: string; wage: number } {
  const m = memOf(g, npc.id);
  if (m.recruited || g.chars[`npc_${npc.id}`]) return { ok: false, reason: "Đã là đồng đội.", wage: 0 };
  if (!npc.recruitable) return { ok: false, reason: `${npc.name.split(" ")[0]} có cuộc sống riêng ở ${npc.town}, không thể đi phiêu lưu.`, wage: 0 };
  const need = PERSONAS[npc.persona].recruitAff;
  if (m.aff < need) return { ok: false, reason: `Cần thiện cảm ${need} (hiện ${m.aff}).`, wage: npc.wage };
  if (npc.wage && g.gold < npc.wage) return { ok: false, reason: `Cần ${npc.wage} vàng tiền công.`, wage: npc.wage };
  return { ok: true, reason: "", wage: npc.wage };
}

export function recruitText(npc: NpcDef, ok: boolean): string {
  return (ok ? RECRUIT_TALK[npc.persona].yes : RECRUIT_TALK[npc.persona].no)[0];
}

export function characterFromNpc(g: GameState, npc: NpcDef): Character {
  const heroLv = g.chars[g.heroId].level;
  const lv = Math.max(npc.level, heroLv - 1);
  const ch = makeCharacter(`npc_${npc.id}`, npc.name, npc.classId, npc.sprite, lv);
  ch.pal = npc.pal;
  ch.origin = npc.id;
  ch.bio = `${npc.race} · ${JOBS[npc.job].name} đến từ ${npc.town} (tầng ${npc.floor}). Tính cách ${PERSONAS[npc.persona].name.toLowerCase()}.`;
  const rng = new Rng(hashString(`${npc.id}:passive`));
  const extra = rng.pick(PLAYER_PASSIVES.filter((p) => p.tier <= 2 && CLASSES[npc.classId].schools.includes(p.school)));
  if (extra && !ch.passives.includes(extra.id)) ch.passives.push(extra.id);
  ch.equippedPassives = ch.passives.slice(0, 2);
  return ch;
}

export function doRecruit(g: GameState, npc: NpcDef): Character | null {
  const chk = recruitCheck(g, npc);
  if (!chk.ok) return null;
  g.gold -= chk.wage;
  const ch = characterFromNpc(g, npc);
  syncLook(ch);
  g.chars[ch.id] = ch;
  if (g.party.length < 4) g.party.push(ch.id);
  memOf(g, npc.id).recruited = true;
  logMsg(g, `${ch.name} gia nhập đội.`);
  return ch;
}

// ============================================================ sanctuary tavern
export function tavernOffers(g: GameState): RecruitOffer[] {
  const tav = g.buildings.find((b) => b.type === "tavern");
  if (!tav) return [];
  if (g.tavern.day === g.day) return g.tavern.offers;
  const rng = new Rng(hashString(`${g.flags.seed}:tavern:${g.day}`));
  const heroLv = g.chars[g.heroId].level;
  const n = 1 + tav.level + (rng.chance(0.4) ? 1 : 0);
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < n; i++) {
    const floor = rng.int(1, Math.max(1, g.maxFloor));
    const biome = getFloor(floor).family;
    const job = rng.pick<Job>(["adventurer", "mercenary", "hunter", "scholar", "priest", "guard", "herbalist", "bard"]);
    const npc = makeNpc(rng, `t${g.day}_${i}`, floor, { id: "tavern", name: "Quán Rượu Thánh Địa", biome }, job);
    const level = Math.max(1, heroLv - 3 + tav.level + rng.int(-1, 1));
    const passive = rng.pick(PLAYER_PASSIVES.filter((p) => p.tier <= 1 + tav.level && CLASSES[npc.classId].schools.includes(p.school)))?.id ?? "";
    offers.push({
      id: npc.id, name: npc.name, classId: npc.classId, level, price: Math.round(60 * level * (1 + 0.3 * tav.level) + (passive ? 80 : 0)),
      pal: npc.pal, passive,
      bio: `${npc.race} · ${JOBS[job].name}, từng lang bạt ở tầng ${floor}. Tính cách ${PERSONAS[npc.persona].name.toLowerCase()}.`,
    });
  }
  g.tavern = { day: g.day, offers };
  return offers;
}

export function hireOffer(g: GameState, offerId: string): Character | null {
  const o = g.tavern.offers.find((x) => x.id === offerId);
  if (!o || g.gold < o.price) return null;
  g.gold -= o.price;
  const hat = o.classId === "mage" || o.classId === "witch";
  const ch = makeCharacter(`r_${o.id}`, o.name, o.classId, hat ? "hero_mage" : "villager", o.level);
  ch.pal = o.pal;
  ch.bio = o.bio;
  if (o.passive && !ch.passives.includes(o.passive)) ch.passives.push(o.passive);
  ch.equippedPassives = ch.passives.slice(0, 2);
  syncLook(ch);
  g.chars[ch.id] = ch;
  if (g.party.length < 4) g.party.push(ch.id);
  g.tavern.offers = g.tavern.offers.filter((x) => x !== o);
  logMsg(g, `Thuê ${ch.name} ở Quán Rượu.`);
  return ch;
}

// ============================================================ shops
export interface StockEntry { id: string; price: number; qty: number }

export function shopStock(g: GameState, s: Settlement, kind: ShopKind): StockEntry[] {
  const rng = new Rng(hashString(`shop:${s.id}:${kind}:${g.day}`));
  const floor = s.floor;
  const T = metalTierForFloor(floor) + (s.size === "city" ? 1 : 0);
  const maxV = 30 + floor * 22 + (s.size === "city" ? 150 : s.size === "town" ? 60 : 0);
  const season = seasonOf(g.day);
  let pool: ItemDef[] = [];
  const by = (f: (i: ItemDef) => boolean) => ITEM_LIST.filter(f);
  // generated gear from around this depth (cities stock a little deeper)
  const lo = Math.max(1, floor - 3), hi = Math.min(100, floor + (s.size === "city" ? 3 : s.size === "town" ? 2 : 1));
  const gear = (kinds: string[]) => by((i) => !!i.equip?.floor && i.equip.floor >= lo && i.equip.floor <= hi && kinds.includes(i.equip.kind ?? ""));
  switch (kind) {
    case "general":
      pool = by((i) => (i.type === "potion" || i.type === "food" || i.type === "scroll") && i.value <= Math.min(maxV, 90))
        .concat(by((i) => ["rope", "charcoal", "nails", "paper", "potion_hp", "antidote", "scroll_return"].includes(i.id)));
      break;
    case "smith":
      pool = gear(["sword", "dagger", "axe", "mace", "greatsword", "greataxe", "hammer", "spear", "scythe", "fist", "katana", "shield", "mail", "plate", "helm", "gauntlets", "greaves", "sabatons"])
        .concat(by((i) => i.id.endsWith("_ingot") && (i.tier ?? 1) <= T));
      break;
    case "apothecary":
      pool = by((i) => (i.type === "potion" || i.type === "herb" || i.type === "bomb") && i.value <= maxV);
      break;
    case "seeds":
      pool = by((i) => (i.type === "seed" || i.type === "sapling") && !!i.crop && CROP_LIST.some((c) => c.id === i.crop && c.tier <= 1 + Math.floor(floor / 2) && (c.seasons.includes(season) || i.type === "sapling")))
        .concat(by((i) => i.type === "fertilizer" && i.value <= maxV));
      break;
    case "tailor":
      pool = gear(["robe", "leather", "hat", "cap", "gloves", "bracers", "pants", "leggings", "shoes", "boots", "whip", "bow", "crossbow"])
        .concat(by((i) => i.id.startsWith("cloth_") || i.id.startsWith("leather_")).filter((i) => (i.tier ?? 1) <= T + 1));
      break;
    case "arcane":
      pool = by((i) => (i.type === "scroll" || i.id === "mana_crystal" || i.id.startsWith("essence_") || false) && (i.tier ?? 1) <= T && i.value <= maxV * 3)
        .concat(gear(["staff", "wand", "tome", "orb", "lute"]));
      break;
    case "jeweler":
      pool = gear(["amulet", "charm", "ring", "earring"]).concat(by((i) => i.shape === "gem" && !i.equip && i.value <= maxV * 2));
      break;
    case "market":
      pool = by((i) => (i.type === "crop" || i.type === "animal") && i.value <= maxV);
      break;
  }
  const n = { village: 6, town: 9, city: 14 }[s.size];
  const picks = rng.shuffle([...new Set(pool)]).slice(0, n);
  return picks.map((i) => ({ id: i.id, price: Math.max(2, Math.round(i.value * 2)), qty: i.equip ? 1 : rng.int(2, 8) }));
}

/** Price after the shop owner's friendship discount. */
export function buyPrice(g: GameState, ownerId: string, base: number) {
  const aff = memOf(g, ownerId).aff;
  return Math.max(1, Math.round(base * (1 - Math.max(0, Math.min(0.25, aff / 300)))));
}
export function sellPrice(g: GameState, ownerId: string, value: number) {
  const aff = memOf(g, ownerId).aff;
  return Math.max(1, Math.round(value * (1 + Math.max(0, Math.min(0.3, aff / 250)))));
}

export function bought(g: GameState, s: Settlement, kind: ShopKind): Record<string, number> {
  const key = `shop:${s.id}:${kind}:${g.day}`;
  const raw = g.flags[key];
  return typeof raw === "string" ? (JSON.parse(raw) as Record<string, number>) : {};
}
export function markBought(g: GameState, s: Settlement, kind: ShopKind, id: string, n: number) {
  // drop stale shop flags from previous days
  for (const k of Object.keys(g.flags)) if (k.startsWith("shop:") && !k.endsWith(`:${g.day}`)) delete g.flags[k];
  const b = bought(g, s, kind);
  b[id] = (b[id] ?? 0) + n;
  g.flags[`shop:${s.id}:${kind}:${g.day}`] = JSON.stringify(b);
}
