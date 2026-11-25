/** Six-sided dice drawn with CSS pips, and their rolling animation. */
import { h } from "../ui/dom";

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export function dieEl(n = 1, cls = ""): HTMLElement {
  const el = h("div", { class: `adv-die ${cls}` });
  setFace(el, n);
  return el;
}

export function setFace(el: HTMLElement, n: number) {
  el.replaceChildren(...Array.from({ length: 9 }, (_, i) => h("span", { class: PIPS[n].includes(i) ? "pip on" : "pip" })));
  el.dataset.n = String(n);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tumbles the dice through random faces and lands on the final values. */
export async function tumble(dice: HTMLElement[], finals: number[], ms = 700) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  dice.forEach((d) => d.classList.add("rolling"));
  if (!reduce) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      dice.forEach((d) => setFace(d, 1 + Math.floor(Math.random() * 6)));
      await wait(70);
    }
  }
  dice.forEach((d, i) => { setFace(d, finals[i]); d.classList.remove("rolling"); d.classList.add("landed"); });
  await wait(reduce ? 50 : 180);
  dice.forEach((d) => d.classList.remove("landed"));
}
