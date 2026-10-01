import { h } from "./dom";
import { sfx } from "../audio/sfx";

/**
 * Cinematic floor change: the view closes into a shrinking circle while motes rush upward
 * (the party is descending), a title card names the new floor, then the circle opens onto
 * it. `swap` runs while the screen is fully covered. Tap or press a key to hurry it along.
 */
export interface TransitionCard {
  kicker: string; // small letter-spaced line, e.g. "TẦNG"
  title: string; // the big text, e.g. "12"
  name: string;
  sub?: string;
  accent: string; // glow colour of the destination
  ground?: string; // tint of the destination (background of the card)
  depth?: number; // 0..1 shown as a little depth gauge
  milestone?: boolean;
}

let running = 0;
/** True while a transition card is on screen, so screens can skip their own title banner. */
export const inTransition = () => running > 0;

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function playTransition(card: TransitionCard, swap: () => void): Promise<void> {
  // Everything that moves is a transform or an opacity, so phones can run it on the GPU:
  // a pre-painted disc grows from the centre to cover the screen, the card fades in over it.
  const disc = h("div", { class: "ft-disc" });
  const veil = h("div", { class: "ft", style: `--acc:${card.accent};--gnd:${card.ground ?? "#0b120f"}` });
  const cv = h("canvas", { class: "ft-motes" }) as HTMLCanvasElement;
  const title = h("div", { class: `ft-card ${card.milestone ? "milestone" : ""}` },
    h("div", { class: "ft-kicker" }, card.kicker),
    h("div", { class: "ft-title" }, card.title),
    h("div", { class: "ft-rule" }),
    h("div", { class: "ft-name" }, card.name),
    card.sub ? h("div", { class: "ft-sub" }, card.sub) : null);
  const gauge = card.depth !== undefined ? h("div", { class: "ft-gauge" }, h("div", { style: `transform:translateY(${Math.round(card.depth * 100)}cqh)` })) : null;
  veil.append(disc, cv, title, ...(gauge ? [gauge] : []));
  document.body.append(veil);
  running++;
  sfx("transition");

  const fast = reduced();
  const T_CLOSE = fast ? 120 : 480, T_HOLD = fast ? 450 : 1300, T_OPEN = fast ? 180 : 600;

  // a few square motes on a 1x canvas (cheap to draw, no blending)
  const W = (cv.width = Math.ceil(window.innerWidth / 2)), H = (cv.height = Math.ceil(window.innerHeight / 2));
  const g = cv.getContext("2d")!;
  const motes = fast ? [] : Array.from({ length: 32 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.3 + Math.random() * 0.9, s: Math.random() < 0.3 ? 2 : 1 }));
  let speed = 5, raf = 0, last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(50, now - last) / 16; last = now;
    g.clearRect(0, 0, W, H);
    g.fillStyle = card.accent;
    for (const m of motes) {
      m.y -= m.v * speed * dt;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
      g.globalAlpha = m.s === 2 ? 0.85 : 0.5;
      g.fillRect(m.x | 0, m.y | 0, m.s, m.s * (speed > 3 ? 4 : 1));
    }
    raf = requestAnimationFrame(tick);
  };
  if (motes.length) raf = requestAnimationFrame(tick);

  let hurry: () => void = () => undefined;
  const onSkip = () => hurry();
  veil.addEventListener("pointerdown", onSkip);
  window.addEventListener("keydown", onSkip);
  const wait = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); hurry = () => { clearTimeout(t); r(); }; });

  return (async () => {
    await disc.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: T_CLOSE, easing: "cubic-bezier(.6,0,.9,.5)", fill: "forwards" }).finished.catch(() => undefined);
    veil.classList.add("covered");
    speed = 1.6;
    // let the covered frame paint before the (heavy) new screen is built underneath
    await new Promise((r) => setTimeout(r, 40));
    try { swap(); } catch (e) { console.error(e); }
    await wait(T_HOLD);
    veil.classList.add("opening");
    speed = 0.8;
    await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T_OPEN, easing: "ease-in", fill: "forwards" }).finished.catch(() => undefined);
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onSkip);
    veil.remove();
    running--;
  })();
}

/**
 * Short JRPG-style encounter wipe: a flash, then slanted bars sweep in from alternating
 * sides with a call-out, the battle is built underneath, and the bars sweep away.
 * Transforms and opacity only. Skipped while the tab is hidden.
 */
export function playEncounter(kind: { boss?: boolean; elite?: boolean; ambush?: boolean }, swap: () => void): Promise<void> {
  if (document.hidden || reduced()) { swap(); return Promise.resolve(); }
  const tone = kind.boss ? "boss" : kind.elite ? "elite" : kind.ambush ? "ambush" : "";
  const label = kind.boss ? "👑 BOSS" : kind.ambush ? "⚠ BỊ TẬP KÍCH!" : kind.elite ? "★ TINH ANH" : "⚔ CHẠM TRÁN!";
  const N = 7;
  const bars = Array.from({ length: N }, (_, i) => h("div", { class: "enc-bar", style: `top:${(i / N) * 100}%;height:${100 / N + 0.6}%` }));
  const flash = h("div", { class: "enc-flash" });
  const call = h("div", { class: "enc-call" }, label);
  const root = h("div", { class: `enc ${tone}` }, h("div", { class: "enc-bars" }, ...bars), flash, call);
  document.body.append(root);
  running++;
  sfx("encounter", kind.boss ? "boss" : "");
  const sideOf = (i: number) => (i % 2 ? 1 : -1);
  const IN = 300, STAG = 28, OUT = 320;
  flash.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0 }], { duration: 260, easing: "ease-out" });
  const ins = bars.map((b, i) => b.animate([{ transform: `translateX(${sideOf(i) * 115}%)` }, { transform: "translateX(0)" }],
    { duration: IN, delay: 90 + i * STAG, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" }).finished);
  call.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(1.8)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }],
    { duration: 260, delay: 220, easing: "cubic-bezier(.2,.9,.3,1.3)", fill: "both" });
  return (async () => {
    await Promise.all(ins).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 40));
    try { swap(); } catch (e) { console.error(e); }
    await new Promise((r) => setTimeout(r, 260));
    call.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    const outs = bars.map((b, i) => b.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-sideOf(i) * 115}%)` }],
      { duration: OUT, delay: i * STAG, easing: "cubic-bezier(.6,0,.8,.4)", fill: "forwards" }).finished);
    await Promise.all(outs).catch(() => undefined);
    root.remove();
    running--;
  })();
}
