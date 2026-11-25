/**
 * Plays every imported book package many times at random with the real engine, looking for
 * crashes, dead ends (nothing to do but the book is not over), broken links and sections no
 * play-through ever reaches. Book packages are personal copies and are NOT in this repository:
 * set ADV_BOOKS to a folder of package .json files to run it, otherwise it is skipped.
 *   ADV_BOOKS=/path/to/dist npx vitest run tests/adventure.books.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  battleExit, canEvade, choiceState, continueRun, discsOf, enter, newRun, phase, playRound, randomResult,
  startBattle, takeOffer, apply, visibleChoices, rollRandom, carryNeeds, playChoice, heroCs, answerRiddle,
} from "../src/adventure/engine";
import type { AdvState, Book, Disc } from "../src/adventure/types";

// node APIs without @types/node in this project
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { readdirSync(d: string): string[]; readFileSync(f: string, e: string): string };
const DIR = env.ADV_BOOKS;
const RUNS = Number(env.ADV_RUNS ?? 400);

function seeded(seed: number) {
  let h = seed >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

interface Report {
  crashes: string[];
  deadEnds: Map<string, number>;
  reached: Set<string>;
  endings: { victory: number; death: number; steps: number[] };
  deaths: Map<string, number>;
  carefulDeaths: Map<string, number>;
  carefulWins: number;
  wanderers: number;
}

function hero(book: Book, rng: () => number): AdvState {
  const discs = [...discsOf(book)].sort(() => rng() - 0.5).slice(0, book.discCount) as Disc[];
  const picks = book.kit.picks.map((p) => p.mode === "random" ? [Math.floor(rng() * p.options.length)] : [...p.options.keys()].sort(() => rng() - 0.5).slice(0, p.count));
  return newRun(book, { name: "Thử", csRoll: Math.floor(rng() * 10), epRoll: Math.floor(rng() * 10), disciplines: discs, weaponskillRoll: Math.floor(rng() * 10), goldRoll: Math.floor(rng() * 10), mastered: [], picks });
}

/** Sections from which every way forward ends in death (book traps a careful reader avoids). */
const doomedCache = new Map<string, Set<string>>();
function doomed(book: Book): Set<string> {
  const hit = doomedCache.get(book.id);
  if (hit) return hit;
  const out = new Set<string>();
  const links = (id: string) => {
    const x = book.sections[id];
    const c = x.combat;
    return [...[...(x.choices ?? []), ...(c?.instead ?? [])].flatMap((y) => [y.to, y.fail]), c?.skipIf?.to, ...(x.random?.out ?? []).map((o) => o.to ?? (o.end === "death" ? "†" : "")),
      c?.win, c?.lose, c?.onHurt, c?.stopAt?.to, c?.evade?.to, c?.maxRounds?.to, ...Object.values(c?.winBy ?? {}), ...Object.values(c?.compare ?? {})].filter((t): t is string => typeof t === "string" && !!t);
  };
  let changed = true;
  for (const [id, x] of Object.entries(book.sections)) if (x.end === "death") out.add(id);
  while (changed) {
    changed = false;
    for (const id of Object.keys(book.sections)) {
      if (out.has(id) || book.sections[id].end) continue;
      const l = links(id);
      if (l.length && l.every((t) => t === "†" || out.has(t))) { out.add(id); changed = true; }
    }
  }
  doomedCache.set(book.id, out);
  return out;
}

function playOnce(book: Book, s: AdvState, rng: () => number, r: Report, careful = false) {
  for (let step = 0; step < 900; step++) {
    r.reached.add(s.section);
    const sec = book.sections[s.section];
    // take the section's offers sometimes; always settle a forced loss
    for (let i = s.offers.length - 1; i >= 0; i--) {
      const o = s.offers[i];
      if ("loseChoice" in o) {
        const pool = o.loseChoice === "weapon" ? s.weapons : o.loseChoice === "backpack" ? [...s.backpack, ...(s.meals ? ["Meal"] : [])] : [...s.weapons, ...s.backpack];
        if (pool.length) takeOffer(book, s, i, pool[0]); else s.offers.splice(i, 1);
      } else if (rng() < 0.7) takeOffer(book, s, i);
    }
    const ph = phase(book, s);
    if (ph === "end") {
      if (s.ended === "victory") { r.endings.victory++; if (careful) r.carefulWins++; } else { r.endings.death++; r.deaths.set(s.section, (r.deaths.get(s.section) ?? 0) + 1); if (careful) r.carefulDeaths.set(`${s.back?.section ?? "?"}>${s.section}`, (r.carefulDeaths.get(`${s.back?.section ?? "?"}>${s.section}`) ?? 0) + 1); }
      r.endings.steps.push(step);
      return;
    }
    if (ph === "combat") {
      // now and then take a way out offered instead of the fight
      const alts = (sec.combat!.instead ?? []).filter((c) => choiceState(s, c) === "ok");
      if (alts.length && rng() < 0.3) {
        const c = alts[Math.floor(rng() * alts.length)];
        if (c.fx) apply(book, s, c.fx);
        enter(book, s, c.to);
        continue;
      }
      const b = startBattle(book, s, sec);
      // evade now and then; mostly when the fight looks hopeless (as a reader would)
      const grim = () => {
        const foe = b.foes[b.idx];
        const ratio = heroCs(book, s, sec.combat!, foe.def, b.mind, b.round).total - foe.def.cs;
        return ratio <= -3 || s.ep <= Math.min(10, foe.ep / 2);
      };
      for (let round = 0; round < 200 && !b.over; round++) playRound(book, s, b, canEvade(book, s, b) && rng() < (grim() ? 0.85 : 0.15), rng);
      if (!b.over) throw new Error(`§${s.section}: combat never ended`);
      const to = battleExit(book, s, b);
      if (to === null) continue; // death: next loop reports the end
      if (to) { enter(book, s, to); continue; }
    }
    if (phase(book, s) === "random") {
      const res = randomResult(book, sec, s, rollRandom(sec, rng));
      if (res.fx) apply(book, s, res.fx);
      if (res.end) { s.ended = res.end; continue; }
      if (!res.to || !book.sections[res.to]) throw new Error(`§${s.section}: random leads to "${res.to}"`);
      enter(book, s, res.to);
      continue;
    }
    // buy something now and then; play a game of chance for a while
    let leave = "";
    for (let k = 0; k < 60 && !leave && !s.ended; k++) {
      const rep = visibleChoices(sec, s).filter((c) => c.repeat && choiceState(s, c) === "ok");
      const games = rep.filter((c) => c.roll);
      if (!rep.length || rng() > (games.length ? 0.9 : 0.3)) break;
      // a careful player stakes the least (the first game listed)
      const c = careful && games.length ? games[0] : (games.length ? games : rep)[Math.floor(rng() * (games.length || rep.length))];
      if (c.roll) leave = playChoice(book, s, c, rollRandom(c.roll, rng)).to;
      else if (c.fx) apply(book, s, c.fx);
    }
    if (s.ended) continue;
    if (leave) { enter(book, s, leave); continue; }
    const open = visibleChoices(sec, s).filter((c) => choiceState(s, c) === "ok");
    const moves = open.filter((c) => !c.repeat);
    if (!moves.length) {
      r.deadEnds.set(s.section, (r.deadEnds.get(s.section) ?? 0) + 1);
      return;
    }
    const safe = careful ? moves.filter((m) => !doomed(book).has(m.to)) : moves;
    const pool = safe.length ? safe : moves;
    const c = pool[Math.floor(rng() * pool.length)];
    if (c.roll) {
      const to = playChoice(book, s, c, rollRandom(c.roll, rng)).to;
      if (!s.ended && to) enter(book, s, to);
      continue;
    }
    if (c.riddle) {
      // a riddle is answered right some of the time; a wrong answer without `fail` stays here
      const to = answerRiddle(c, rng() < 0.6 ? c.to : "0");
      if (to) enter(book, s, to);
      continue;
    }
    if (c.fx) apply(book, s, c.fx);
    if (!book.sections[c.to]) throw new Error(`§${s.section}: choice leads to "${c.to}"`);
    enter(book, s, c.to);
  }
  r.wanderers++; // still walking the book's mazes after 900 steps: not an error
}

const files = DIR ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort() : [];

describe.skipIf(!DIR)("adventure book packages (random play-throughs)", () => {
  const books = new Map<string, Book>(files.map((f) => [f, JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")) as Book]));
  const finishedHeroes = new Map<number, AdvState>();
  for (const [f, book] of books) {
    it(`${f}: ${RUNS} random play-throughs`, () => {
      const r: Report = { crashes: [], deadEnds: new Map(), reached: new Set(), endings: { victory: 0, death: 0, steps: [] }, deaths: new Map(), carefulDeaths: new Map(), carefulWins: 0, wanderers: 0 };
      for (let i = 0; i < RUNS; i++) {
        const rng = seeded(i * 7919 + book.num);
        const prev = finishedHeroes.get(book.num - 1);
        let s: AdvState;
        try {
          const need = prev ? carryNeeds(book, prev) : null;
          const newDisc = need && !need.fresh ? discsOf(book).find((d) => !prev!.disciplines.includes(d)) : undefined;
          const extra = prev ? carryNeeds(book, prev, newDisc) : null;
          s = prev && i % 2 ? continueRun(book, prev, {
            newDisc, newDiscs: need?.fresh ? discsOf(book).slice(0, book.discCount) : undefined,
            mastered: book.weaponskill.filter((w) => !(prev.mastered ?? []).includes(w)).slice(0, extra?.masteryCap ?? 0),
            picks: book.kit.picks.map((p) => p.mode === "random" ? [0] : [...p.options.keys()].slice(0, p.count)), goldRoll: 3,
          }) : hero(book, rng);
          const careful = i % 4 === 3;
          if (careful) { s.cs = Math.max(s.cs, 19); s.epBase = Math.max(s.epBase, 29); s.ep = s.epBase; }
          playOnce(book, s, rng, r, careful);
          if (s.ended === "victory" && !finishedHeroes.has(book.num)) finishedHeroes.set(book.num, JSON.parse(JSON.stringify(s)) as AdvState);
        } catch (e) {
          r.crashes.push(`run ${i}: ${(e as Error).message}`);
        }
      }
      const unreached = Object.keys(book.sections).filter((id) => !r.reached.has(id)).sort((a, b) => Number(a) - Number(b));
      const dead = [...r.deadEnds.entries()].sort((a, b) => b[1] - a[1]);
      // eslint-disable-next-line no-console
      console.log(`${f}: victory ${r.endings.victory}, death ${r.endings.death}, dead ends ${dead.length ? dead.map(([k, n]) => `§${k}×${n}`).join(" ") : "none"}, unreached ${unreached.length}/${Object.keys(book.sections).length}${unreached.length ? ` [${unreached.slice(0, 40).join(",")}${unreached.length > 40 ? "…" : ""}]` : ""}`);
      console.log(`  careful players: ${r.carefulWins} wins; deaths (from>at): ${[...r.carefulDeaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}×${n}`).join(" ")}`);
      console.log(`  deaths at: ${[...r.deaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `§${k}×${n}${book.sections[k]?.combat ? "(trận)" : ""}`).join(" ")}`);
      if (r.crashes.length) console.log(r.crashes.slice(0, 10).join("\n"));
      expect(r.crashes).toEqual([]);
      expect(dead).toEqual([]);
    });
  }
});
