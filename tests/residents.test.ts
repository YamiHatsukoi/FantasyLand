import { describe, expect, it } from "vitest";
import { addItem, charPassives, makeCharacter, migrate, newGame, type GameState } from "../src/core/state";
import { TOPIC_LIST } from "../src/data/residentText";
import {
  ACTS_PER_DAY, answerDeep, askMood, askPast, bondOf, deepQuestion, flirt, giveResGift, goDate, greetResident, heartsOf,
  partnerOf, pendingScene, profileOf, residents, resolveScene, sceneReady, talkTopic, datePlaces,
} from "../src/world/residents";
import { advanceDay } from "../src/world/town";

function world(n = 3): GameState {
  const g = newGame("An", "warrior", 42);
  for (let i = 0; i < n; i++) {
    const ch = makeCharacter(`r_t${i}`, `Người${i} Thử`, "rogue", "villager", 5);
    ch.bio = `Người · Lính đánh thuê, từng lang bạt ở tầng ${i + 1}. Tính cách vui vẻ.`;
    ch.pal = { g: i % 2 ? "f" : "m" };
    g.chars[ch.id] = ch;
  }
  return g;
}
const noText = (s: string) => expect(s).not.toMatch(/\{\w+\}/);

describe("resident profiles", () => {
  it("are stable, varied and parse tavern bios", () => {
    const g = world(40);
    const rs = residents(g);
    expect(rs.length).toBe(40);
    const p = profileOf(rs[0]);
    expect(profileOf(rs[0])).toBe(p);
    expect(p.persona).toBe("cheerful");
    expect(p.job).toBe("mercenary");
    expect(p.loves.length).toBe(2);
    for (const t of p.loves) expect(p.dislikes).not.toContain(t);
    const stories = new Set(rs.map((c) => `${profileOf(c).dream}-${profileOf(c).wound}-${profileOf(c).secret}`));
    expect(stories.size).toBeGreaterThan(30);
  });
});

describe("conversation", () => {
  it("greets, limits daily actions and never leaks placeholders", () => {
    const g = world(1);
    const ch = residents(g)[0];
    const lines = greetResident(g, ch);
    for (const l of lines) noText(l.text);
    expect(bondOf(g, ch.id).fp).toBeGreaterThan(0);
    const before = bondOf(g, ch.id).fp;
    greetResident(g, ch);
    expect(bondOf(g, ch.id).fp).toBe(before); // only the first greeting of the day counts
    for (let i = 0; i < ACTS_PER_DAY; i++) for (const l of askMood(g, ch)) noText(l.text);
    const tired = askMood(g, ch);
    expect(tired[0].text).toMatch(/mai|đủ rồi|mệt/i);
  });

  it("topics: loved ones raise friendship and are learned", () => {
    const g = world(1);
    const ch = residents(g)[0];
    const p = profileOf(ch);
    greetResident(g, ch);
    const b = bondOf(g, ch.id);
    const f0 = b.fp;
    const out = talkTopic(g, ch, p.loves[0]);
    for (const l of out) noText(l.text);
    expect(b.fp).toBeGreaterThan(f0 + 20);
    expect(b.known).toContain(`t:${p.loves[0]}+`);
    const f1 = b.fp;
    talkTopic(g, ch, p.dislikes[0]);
    expect(b.fp).toBeLessThan(f1);
    // every topic line for every persona fills cleanly
    for (const t of TOPIC_LIST) { g.day++; greetResident(g, ch); for (const l of talkTopic(g, ch, t)) noText(l.text); }
  });

  it("backstory unlocks with hearts; deep talk remembers answers", () => {
    const g = world(1);
    const ch = residents(g)[0];
    const b = bondOf(g, ch.id);
    greetResident(g, ch);
    askPast(g, ch);
    const locked = askPast(g, ch);
    expect(locked.some((l) => l.text.includes("🔒"))).toBe(true);
    b.fp = 350;
    const dq = deepQuestion(g, ch)!;
    expect(dq.answers.length).toBe(3);
    noText(dq.q);
    const r = answerDeep(g, ch, dq.idx, 0);
    noText(r[0].text);
    expect(b.answers.length).toBe(1);
  });

  it("gifts: loved gifts count a lot, one per day", () => {
    const g = world(1);
    const ch = residents(g)[0];
    const p = profileOf(ch);
    addItem(g, p.giftLoves[0], 2);
    const b = bondOf(g, ch.id);
    giveResGift(g, ch, p.giftLoves[0]);
    expect(b.fp).toBeGreaterThanOrEqual(80);
    const again = giveResGift(g, ch, p.giftLoves[0]);
    expect(again[0].text).toMatch(/đã tặng/);
  });
});

describe("milestones and romance", () => {
  it("plays heart scenes in order and grants the kindred bond", () => {
    const g = world(1);
    const ch = residents(g)[0];
    const b = bondOf(g, ch.id);
    b.fp = 1000;
    const kinds: string[] = [];
    for (let i = 0; i < 12; i++) {
      b.fp = 1000;
      const ps = pendingScene(g, ch);
      if (!ps) break;
      expect(sceneReady(g, ch)).toBe(true);
      for (const l of ps.scene.lines) noText(l);
      kinds.push(ps.kind);
      resolveScene(g, ch, ps, ps.scene.choices ? 0 : undefined);
      if (ps.kind === "request") { addItem(g, b.request!.item, b.request!.n); b.request!.done = true; }
    }
    expect(kinds.slice(0, 5)).toEqual(["hobby", "wound", "request", "secret", "dream"]);
    expect(ch.bond).toBe("kindred");
    expect(charPassives(ch)).toContain("p_kindred");
  });

  it("flirt → confession → dating → proposal → wedding, with jealousy", () => {
    const g = world(2);
    const [a, other] = residents(g);
    const p = profileOf(a);
    p.romanceable = true;
    profileOf(other).romanceable = true;
    const b = bondOf(g, a.id);
    b.fp = 700;
    greetResident(g, a);
    const out = flirt(g, a, p.style);
    for (const l of out) noText(l.text);
    expect(b.rp).toBeGreaterThan(0);
    b.rp = 650;
    b.events.push("h2", "h4", "h6");
    let ps = pendingScene(g, a);
    while (ps && ps.kind !== "confess") { resolveScene(g, a, ps, 0); ps = pendingScene(g, a); }
    expect(ps?.kind).toBe("confess");
    resolveScene(g, a, ps!, 0);
    expect(b.mutual).toBe(true);
    addItem(g, "bouquet", 1);
    giveResGift(g, a, "bouquet");
    expect(b.stage).toBe("dating");
    expect(partnerOf(g)?.id).toBe(a.id);
    // flirting with someone else can make the partner jealous
    const ob = bondOf(g, other.id);
    ob.fp = 500;
    for (let d = 0; d < 6 && !b.jealous; d++) { g.day++; greetResident(g, other); flirt(g, other, "sweet"); }
    expect(b.jealous).toBeTruthy();
    // proposal and wedding
    b.rp = 1000; b.fp = 1000; b.gift = 0;
    g.buildings.find((x) => x.type === "house")!.level = 2;
    addItem(g, "promise_ring", 1);
    giveResGift(g, a, "promise_ring");
    expect(b.stage).toBe("engaged");
    for (let i = 0; i < 4; i++) advanceDay(g);
    expect(b.stage).toBe("married");
    expect(a.bond).toBe("beloved");
    expect(g.chars[g.heroId].bond).toBe("beloved");
    expect(pendingScene(g, a)?.kind).toBe("wedding");
  });

  it("dates depend on the buildings and the resident's tastes", () => {
    const g = world(1);
    const ch = residents(g)[0];
    expect(datePlaces(g)).toContain("walk");
    bondOf(g, ch.id).fp = 250;
    greetResident(g, ch);
    const out = goDate(g, ch, "walk");
    for (const l of out) noText(l.text);
    expect(bondOf(g, ch.id).fp).toBeGreaterThan(250);
  });

  it("old saves get an empty bond table; recruits remember their affinity", () => {
    const g = world(1);
    delete (g as Partial<GameState>).bonds;
    const m = migrate(JSON.parse(JSON.stringify(g)));
    expect(m.bonds).toEqual({});
    expect(heartsOf(bondOf(m, residents(m)[0].id).fp)).toBe(0);
  });
});

describe("text sweep", () => {
  it("every persona × every dialogue path fills cleanly", async () => {
    const { PERSONAS } = await import("../src/data/npcText");
    const { FLIRT_LINES, DATES } = await import("../src/data/residentText");
    const { DREAMS, WOUNDS, SECRETS } = await import("../src/data/residentStory");
    const g = world(3);
    const ch = residents(g)[0];
    const p = profileOf(ch);
    p.romanceable = true;
    const b = bondOf(g, ch.id);
    const all: string[] = [];
    for (const persona of Object.keys(PERSONAS) as (keyof typeof PERSONAS)[]) {
      p.persona = persona;
      for (let rep = 0; rep < 3; rep++) {
        g.day++;
        b.fp = 50 + rep * 300; b.day = 0; b.flirt = 0; b.date = 0; b.gift = 0;
        all.push(...greetResident(g, ch).map((l) => l.text));
        for (const t of TOPIC_LIST.slice(rep * 5, rep * 5 + 3)) all.push(...talkTopic(g, ch, t).map((l) => l.text));
        b.acts = 0;
        for (const s of Object.keys(FLIRT_LINES) as (keyof typeof FLIRT_LINES)[]) { b.flirt = 0; b.acts = 0; all.push(...flirt(g, ch, s).map((l) => l.text)); }
        for (const d of Object.keys(DATES) as (keyof typeof DATES)[]) { b.date = 0; b.acts = 0; all.push(...goDate(g, ch, d).map((l) => l.text)); }
      }
      for (let i = 0; i < DREAMS.length; i++) { p.dream = i; p.wound = i % WOUNDS.length; p.secret = i % SECRETS.length; b.events = []; b.fp = 1000; b.request = { item: "bread", n: 1, done: true };
        for (let k = 0; k < 8; k++) { const ps = pendingScene(g, ch); if (!ps) break; all.push(ps.scene.title, ...ps.scene.lines, ...(ps.scene.choices ?? []).flatMap((c) => [c.text, c.reply])); resolveScene(g, ch, ps, 1); } }
    }
    const bad = all.filter((s) => /\{\w+\}/.test(s));
    expect(bad.slice(0, 5)).toEqual([]);
    expect(all.length).toBeGreaterThan(500);
  });
});
