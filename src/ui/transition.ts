import { h } from "./dom";

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
  const veil = h("div", { class: "ft", style: `--acc:${card.accent};--gnd:${card.ground ?? "#0b120f"}` });
  const cv = h("canvas", { class: "ft-motes" }) as HTMLCanvasElement;
  const title = h("div", { class: `ft-card ${card.milestone ? "milestone" : ""}` },
    h("div", { class: "ft-kicker" }, card.kicker),
    h("div", { class: "ft-title" }, card.title),
    h("div", { class: "ft-rule" }),
    h("div", { class: "ft-name" }, card.name),
    card.sub ? h("div", { class: "ft-sub" }, card.sub) : null);
  const gauge = card.depth !== undefined ? h("div", { class: "ft-gauge" }, h("div", { style: `top:${Math.round(card.depth * 100)}%` })) : null;
  veil.append(cv, title, ...(gauge ? [gauge] : []));
  document.body.append(veil);
  running++;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (cv.width = Math.round(window.innerWidth * dpr)), H = (cv.height = Math.round(window.innerHeight * dpr));
  const g = cv.getContext("2d")!;
  const motes = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: (0.4 + Math.random()) * H * 0.0012, r: (0.6 + Math.random() * 1.8) * dpr }));

  const fast = reduced();
  const T_CLOSE = fast ? 150 : 520, T_HOLD = fast ? 500 : 1350, T_OPEN = fast ? 200 : 750;
  let t0 = performance.now(), phase: "close" | "hold" | "open" = "close", swapped = false, raf = 0;
  let hurry = false;
  const skip = () => { hurry = true; };
  veil.addEventListener("pointerdown", skip);
  window.addEventListener("keydown", skip, { once: true });

  return new Promise((resolve) => {
    const frame = (now: number) => {
      let el = now - t0;
      if (hurry && phase === "hold" && el < T_HOLD - 250) { t0 = now - (T_HOLD - 250); el = T_HOLD - 250; }
      // motes: they rise faster while the view closes (we are falling)
      g.clearRect(0, 0, W, H);
      const speed = phase === "close" ? 6 : phase === "hold" ? 2.2 : 1;
      g.fillStyle = card.accent;
      for (const m of motes) {
        m.y -= m.v * speed * 16;
        if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
        g.globalAlpha = 0.25 + (m.r / (2.4 * dpr)) * 0.5;
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill();
        if (phase === "close") { g.globalAlpha *= 0.4; g.fillRect(m.x - m.r * 0.4, m.y, m.r * 0.8, m.r * 7); }
      }
      g.globalAlpha = 1;

      if (phase === "close") {
        const k = Math.min(1, el / T_CLOSE);
        veil.style.setProperty("--iris", `${(1 - easeIn(k)) * 150}%`);
        if (k >= 1) {
          phase = "hold"; t0 = now;
          veil.classList.add("covered");
          if (!swapped) { swapped = true; try { swap(); } catch (e) { console.error(e); } }
        }
      } else if (phase === "hold") {
        if (el >= T_HOLD) { phase = "open"; t0 = now; veil.classList.add("opening"); }
      } else {
        const k = Math.min(1, el / T_OPEN);
        veil.style.setProperty("--iris", `${easeOut(k) * 150}%`);
        veil.style.opacity = String(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        if (k >= 1) {
          cancelAnimationFrame(raf);
          veil.remove();
          window.removeEventListener("keydown", skip);
          running--;
          resolve();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

const easeIn = (k: number) => k * k;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
