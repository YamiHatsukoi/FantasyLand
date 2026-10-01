import { applySettings, audioCtx, buses, onAudioReady, settings } from "./engine";
import { hasBank, hit, loadBanks, note, type Bus } from "./sampler";
import { banksOf, compile, type Ev, type Piece } from "./score";
import { JINGLES, pieceFor } from "./themes";

/**
 * Background music: a written piece (themes.ts) played by the recorded orchestra. Notes are
 * scheduled a little ahead on the audio clock, so timing stays exact even if the page is busy.
 * Each piece's instruments load the first time it is needed; until then it is silent.
 */
interface Playing { name: string; piece: Piece; events: Ev[]; length: number; spb: number; start: number; idx: number; loop: number; bus: Bus }

let current = "";
let playing: Playing | null = null;
let timer = 0;
const AHEAD = 1.0; // seconds scheduled in advance: enough to ride out a busy main thread on phones

function startPiece(name: string, piece: Piece, bus: Bus, delay = 0.12): Playing | null {
  const ctx = audioCtx();
  if (!ctx) return null;
  const { events, length } = compile(piece);
  return { name, piece, events, length, spb: 60 / piece.bpm, start: ctx.currentTime + delay, idx: 0, loop: 0, bus };
}

/** Schedules every note of `p` that starts before `until` (audio time). Returns false once a one-shot piece is over. */
function pump(p: Playing, until: number): boolean {
  for (;;) {
    if (p.idx >= p.events.length) {
      if (p.piece.once) return false;
      p.idx = 0;
      p.loop++;
    }
    const e = p.events[p.idx];
    const when = p.start + (p.loop * p.length + e.t) * p.spb;
    if (when > until) return true;
    p.idx++;
    if (when < (audioCtx()?.currentTime ?? 0) - 0.05) continue; // fell behind (tab was busy): skip, don't pile up
    // a touch of human looseness in timing and touch
    const w = when + (Math.random() - 0.5) * 0.012;
    const vel = Math.max(0.05, e.vel * (0.94 + Math.random() * 0.12));
    if (e.inst === "perc") hit(e.hit!, { when: w, vel, bus: p.bus });
    else note(e.inst, e.midi, e.dur * p.spb, { when: w, vel, bus: p.bus });
  }
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !playing || ctx.state !== "running") return;
  if (!pump(playing, ctx.currentTime + AHEAD)) playing = null;
}

/** Switches the background music ("title", "sanctuary", "dungeon:<family>", "battle", "boss"). */
export function playMusic(name: string) {
  if (name === current) return;
  current = name;
  resumeAfterJingle = null;
  onAudioReady(() => void begin(name));
}

async function begin(name: string) {
  const ctx = audioCtx()!;
  const piece = pieceFor(name);
  const bus = buses().music;
  // fade the old piece out while the new one's instruments load
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  const loaded = loadBanks(banksOf(piece));
  await Promise.all([loaded, new Promise((r) => setTimeout(r, 500))]);
  if (current !== name) return;
  playing = startPiece(name, piece, "music");
  applySettings();
  window.clearInterval(timer);
  timer = window.setInterval(tick, 150);
  tick();
}

let resumeAfterJingle: string | null = null;
let jingleTimer = 0;

/**
 * A short piece played once over everything (victory fanfare, level up, defeat). The music
 * steps aside for it and comes back afterwards. It plays on the effects bus, so it is heard
 * even with music switched off.
 */
export function playJingle(name: string) {
  const piece = JINGLES[name];
  if (!piece || !settings.sfx) return;
  onAudioReady(async () => {
    await loadBanks(banksOf(piece));
    const ctx = audioCtx()!;
    const back = current || resumeAfterJingle;
    if (current) {
      // music out while the jingle plays
      buses().music.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      resumeAfterJingle = current;
      current = "";
      playing = null;
    }
    const j = startPiece(`jingle:${name}`, piece, "sfx", 0.03);
    if (!j) return;
    pump(j, Infinity);
    const secs = j.length * j.spb + 1.2;
    window.clearTimeout(jingleTimer);
    jingleTimer = window.setTimeout(() => {
      // nothing else asked for music meanwhile: bring the previous piece back
      if (!current && resumeAfterJingle && resumeAfterJingle === back) { const n = resumeAfterJingle; resumeAfterJingle = null; playMusic(n); }
    }, secs * 1000);
  });
}

/** True once every instrument of a jingle is in memory (so it can start without a wait). */
export const jingleReady = (name: string) => !!JINGLES[name] && banksOf(JINGLES[name]).every(hasBank);

/** Fetches the jingles' instruments in the background. */
export const preloadJingles = () => loadBanks([...new Set(Object.values(JINGLES).flatMap(banksOf))]);

export const currentMusic = () => current || resumeAfterJingle || "";
export const musicOn = () => settings.music;
