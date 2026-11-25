/**
 * Adventure's UI skin: pixel-art window frames drawn in code (9-slice border-images), the
 * stage fitter that makes the living scene fill its box crisp and focused on its cast, game
 * windows (sheets/dialogs) and small animated touches (counting numbers, loot toasts).
 */
import { sfx } from "../audio/sfx";
import { h, nn } from "../ui/dom";
import { iconEl, uiIcon, type UiIcon } from "./art/icons";
import { setViewZoom, viewZoom, type ViewZoom } from "./motion";
import { H as SH, W as SW, type Stage } from "./stage";

export { calmMotion, calmSetting, setCalmSetting, setViewZoom, viewZoom, zoomLabel, type ViewZoom } from "./motion";

/* ================================================================== frames */

interface FrameSpec {
  /** Corner size in art pixels (= ring count + inner bevel). */
  c: number;
  /** CSS pixels per art pixel. */
  k: number;
  /** Rings from the outside in: [top-left colour, bottom-right colour]. */
  rings: [string, string][];
  /** Chamfer of the outer corner (pixels cut). */
  cut: number;
  /** Middle colour (null = transparent middle, the element paints its own background). */
  fill: string | null;
  /** Speckle texture in the middle: [colour, density]. */
  grain?: [string, number];
  /** A bright stud in each corner. */
  stud?: string;
}

function paintFrame(f: FrameSpec): string {
  const N = f.c * 3;
  const art = document.createElement("canvas");
  art.width = N; art.height = N;
  const g = art.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dl = x, dr = N - 1 - x, dt = y, db = N - 1 - y;
    const dx = Math.min(dl, dr), dy = Math.min(dt, db);
    const L = Math.min(dx, dy, dx + dy - f.cut);
    if (L < 0) continue;
    let col: string | null;
    if (L < f.rings.length) {
      // which edge is nearest: top/left get the light colour
      const tl = dy < dx ? dt <= db : dl <= dr;
      col = f.rings[L][tl ? 0 : 1];
    } else {
      col = f.fill;
      if (col && f.grain && rnd() < f.grain[1]) col = f.grain[0];
    }
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  if (f.stud) {
    const p = f.rings.length > 2 ? 1 : 0;
    for (const [sx, sy] of [[p + 1, p + 1], [N - p - 2, p + 1], [p + 1, N - p - 2], [N - p - 2, N - p - 2]]) {
      g.fillStyle = f.stud; g.fillRect(sx, sy, 1, 1);
    }
  }
  const out = document.createElement("canvas");
  out.width = N * f.k; out.height = N * f.k;
  const o = out.getContext("2d")!;
  o.imageSmoothingEnabled = false;
  o.drawImage(art, 0, 0, out.width, out.height);
  return out.toDataURL();
}

const OUT = "#090604";
const BRASS: [string, string][] = [[OUT, OUT], ["#f3d58c", "#8f6122"], ["#c99640", "#a67428"], ["#2a190b", "#2a190b"]];
const FRAMES: Record<string, FrameSpec> = {
  // the main window: dark wood inside brass trim
  panel: { c: 6, k: 2, cut: 2, rings: [...BRASS, ["#3d2a19", "#160e07"], ["#2a1c10", "#1c130b"]], fill: "#1e140c", grain: ["#22170e", 0.18], stud: "#fff2c4" },
  // translucent window over the scene (HUD and story on phones)
  glass: { c: 5, k: 2, cut: 2, rings: [...BRASS, ["rgba(70,48,28,.92)", "rgba(10,7,4,.92)"]], fill: "rgba(20,13,8,.9)" },
  // small HUD chip
  chip: { c: 3, k: 2, cut: 1, rings: [["rgba(5,3,2,.9)", "rgba(5,3,2,.9)"], ["#b98a3e", "#6a4518"], ["rgba(28,18,10,.88)", "rgba(12,8,5,.88)"]], fill: "rgba(18,12,7,.86)" },
  // wooden button
  btn: { c: 4, k: 2, cut: 1, rings: [[OUT, OUT], ["#9a7448", "#3a2412"], ["#6e4e2e", "#4a3019"], ["#5c4026", "#4f3520"]], fill: "#563b22", grain: ["#5b3f25", 0.25] },
  btnDown: { c: 4, k: 2, cut: 1, rings: [[OUT, OUT], ["#2a190b", "#7a5a36"], ["#3f2a17", "#5a3e24"], ["#46301b", "#4a321d"]], fill: "#46301b" },
  // gold primary button
  gold: { c: 4, k: 2, cut: 1, rings: [["#1a0d03", "#1a0d03"], ["#fff0b0", "#8a5410"], ["#f5c454", "#b8781c"], ["#e8ac3a", "#d4952c"]], fill: "#e2a336" },
  goldDown: { c: 4, k: 2, cut: 1, rings: [["#1a0d03", "#1a0d03"], ["#7a4a0e", "#f0c060"], ["#b8781c", "#d89a34"], ["#cf9230", "#d39630"]], fill: "#cf9230" },
  // red attack button
  red: { c: 4, k: 2, cut: 1, rings: [["#1a0503", "#1a0503"], ["#ffb08a", "#6a1408"], ["#e5553a", "#9a2414"], ["#cf4026", "#b8341e"]], fill: "#c63a22" },
  redDown: { c: 4, k: 2, cut: 1, rings: [["#1a0503", "#1a0503"], ["#5a1006", "#e06a4a"], ["#9a2414", "#c0391f"], ["#b0321c", "#b0321c"]], fill: "#b0321c" },
  // violet (mind powers) toggle
  mind: { c: 4, k: 2, cut: 1, rings: [["#0c0614", "#0c0614"], ["#d9c2ff", "#3a2266"], ["#9c74e0", "#5a3a96"], ["#7a54c0", "#6a46ac"]], fill: "#6e4ab2" },
  // sunken slot (inventory cells, inputs)
  slot: { c: 3, k: 2, cut: 1, rings: [["#090604", "#090604"], ["#0d0905", "#4a3420"], ["#140d07", "#2c1f12"]], fill: "#191109" },
  // selected card: bright gold glow ring
  sel: { c: 4, k: 2, cut: 1, rings: [["#3a2203", "#3a2203"], ["#fff4c0", "#e0a83a"], ["#ffd76a", "#f0b848"], ["#5a3b14", "#5a3b14"]], fill: "#3b2a14" },
  // parchment card (loot, intro)
  parch: { c: 4, k: 2, cut: 1, rings: [["#2a1808", "#2a1808"], ["#fff7dc", "#a88450"], ["#eedcae", "#d4bc86"]], fill: "#e8d6a8", grain: ["#e2cf9c", 0.3] },
  // danger (foe) chip
  foe: { c: 3, k: 2, cut: 1, rings: [["rgba(5,2,2,.92)", "rgba(5,2,2,.92)"], ["#d0644a", "#6a1c12"], ["rgba(40,12,8,.9)", "rgba(20,6,4,.9)"]], fill: "rgba(28,9,6,.88)" },
};

let skinned = false;
/** Generates the frame images once and installs them as CSS classes `.fr-<name>`. */
export function installSkin() {
  if (skinned) return;
  skinned = true;
  const css: string[] = [];
  for (const [name, f] of Object.entries(FRAMES)) {
    const url = paintFrame(f);
    const w = f.c * f.k;
    const rule = `border-style:solid;border-width:${w}px;border-image:url(${url}) ${w} fill / ${w}px / 0 repeat;image-rendering:pixelated;background:none;`;
    css.push(`.fr-${name}{${rule}}`);
    css.push(`:root{--fr-${name}:url(${url})}`);
  }
  // pressed states
  css.push(`.fr-btn:not(:disabled):active,.fr-btn.down{border-image-source:var(--fr-btnDown)}`);
  css.push(`.fr-gold:not(:disabled):active{border-image-source:var(--fr-goldDown)}`);
  css.push(`.fr-red:not(:disabled):active{border-image-source:var(--fr-redDown)}`);
  document.head.append(h("style", { id: "adv-skin" }, css.join("\n")));
}

/* ================================================================== view settings */

/**
 * Pinch on `el` switches the zoom (fingers apart: closer, together: the whole scene).
 * Returns the cleanup.
 */
export function pinchZoom(el: HTMLElement) {
  let d0 = 0;
  const dist = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const start = (e: TouchEvent) => { d0 = e.touches.length === 2 ? dist(e) : 0; };
  const move = (e: TouchEvent) => {
    if (!d0 || e.touches.length !== 2) return;
    const r = dist(e) / d0;
    if (r > 1.25 || r < 0.8) {
      const z: ViewZoom = r > 1 ? "near" : "full";
      d0 = 0;
      if (z !== viewZoom()) setViewZoom(z);
    }
  };
  const end = () => { d0 = 0; };
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", end);
  return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); };
}

/* ================================================================== stage fitting */

export interface FitOpts {
  /** Least share of the scene's width that must stay visible (limits cover cropping). */
  minVis?: number;
  /** Where the cast's feet should sit, as a share of the box height. */
  anchorY?: number;
  /** Shows a blurred copy of the scene behind it, for boxes the scene does not cover. */
  ambient?: boolean;
  /** Height at the top of the box covered by a HUD (the whole-width view starts below it). */
  padTop?: () => number;
}

/**
 * Makes a Stage canvas fill its box like a game camera: cover-cropped, crisp nearest-neighbour
 * pixels (integer scale when it is close), panned to keep the characters in view.
 */
export class StageFit {
  private ro: ResizeObserver;
  private timer = 0;
  private amb: HTMLCanvasElement | null = null;
  private ambT = 0;
  private alive = true;
  constructor(readonly box: HTMLElement, readonly stage: Stage, private o: FitOpts = {}) {
    box.classList.add("adv-fit");
    stage.canvas.classList.add("adv-fit-cv");
    if (o.ambient !== false) {
      this.amb = h("canvas", { class: "adv-fit-amb", width: "64", height: "36" }) as HTMLCanvasElement;
      box.prepend(this.amb);
    }
    if (!stage.canvas.parentElement) box.append(stage.canvas);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(box);
    window.addEventListener("adv-zoom", this.onZoom);
    this.timer = window.setInterval(() => this.layout(), 700);
    const amb = () => {
      if (!this.alive) return;
      const t = performance.now();
      if (this.amb && t - this.ambT > 120) {
        this.ambT = t;
        const g = this.amb.getContext("2d")!;
        g.drawImage(stage.canvas, 0, 0, 64, 36);
      }
      requestAnimationFrame(amb);
    };
    requestAnimationFrame(amb);
    this.layout();
  }

  private onZoom = () => this.layout();

  set(o: FitOpts) { this.o = { ...this.o, ...o }; this.layout(); }

  /** Horizontal centre of the cast (art pixels). */
  private focus() {
    if (this.stage.focusX !== undefined) return this.stage.viewX(this.stage.focusX);
    const xs = this.stage.actors.filter((a) => !a.hidden && (a.alpha ?? 1) > 0.2 && a.x > -10 && a.x < SW + 10).map((a) => this.stage.viewX(a.x));
    if (!xs.length) return SW / 2;
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  }

  layout() {
    const W = this.box.clientWidth, H = this.box.clientHeight;
    if (!W || !H) return;
    const cover = Math.max(W / SW, H / SH);
    const contain = Math.min(W / SW, H / SH);
    const full = viewZoom() === "full";
    let s: number;
    if (full) {
      // the whole width of the scene, letterboxed above and below
      s = Math.min(cover, W / SW);
      const f = Math.floor(s);
      if (f >= 2 && s - f < 0.12) s = f;
    } else {
      const minVis = this.o.minVis ?? 0.6;
      s = Math.max(contain, Math.min(cover, W / (SW * minVis)));
      const r = Math.round(s);
      if (s >= 1.5 && Math.abs(s - r) < 0.2 && r >= contain) s = r;
      else if (s >= 2.5 && s < cover - 0.01) s = Math.max(contain, Math.floor(s));
    }
    const cw = SW * s, ch = SH * s;
    const fx = this.focus();
    const left = cw <= W ? (W - cw) / 2 : Math.max(W - cw, Math.min(0, W / 2 - fx * s));
    const feet = this.stage.scene.groundY;
    const ay = this.o.anchorY ?? 0.78;
    let top = ch <= H ? (H - ch) / 2 : Math.max(H - ch, Math.min(0, H * ay - feet * s));
    if (ch <= H && this.o.padTop) top = Math.max(top, Math.min(H - ch, this.o.padTop()));
    this.stage.visibleX = [Math.max(0, -left / s), Math.min(SW, (W - left) / s)];
    const cv = this.stage.canvas;
    cv.style.width = `${cw}px`;
    cv.style.height = `${ch}px`;
    cv.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    this.box.classList.toggle("gaps", cw < W - 1 || ch < H - 1);
    this.box.classList.toggle("gap-v", ch < H - 1);
    this.box.classList.toggle("gap-h", cw < W - 1);
  }

  destroy() {
    this.alive = false;
    this.ro.disconnect();
    window.removeEventListener("adv-zoom", this.onZoom);
    clearInterval(this.timer);
    this.amb?.remove();
  }
}

/* ================================================================== widgets */

export const ui = (n: UiIcon, scale = 2) => iconEl(uiIcon(n), scale);

/** A framed icon button for HUDs and window corners. */
export function iconBtn(icon: UiIcon, label: string, onclick: (e: MouseEvent) => void, cls = "") {
  return h("button", { class: `adv-ibtn fr-btn ${cls}`, type: "button", "aria-label": label, title: label, onclick }, ui(icon, 2));
}

/** A big game button. kind: btn (wood), gold (primary), red (attack), mind (violet). */
export function gameBtn(label: string | Node, onclick: (e: MouseEvent) => void, o: { kind?: "btn" | "gold" | "red" | "mind"; icon?: UiIcon; cls?: string; disabled?: boolean } = {}) {
  const b = h("button", { class: `adv-gbtn fr-${o.kind ?? "btn"} ${o.cls ?? ""}`, type: "button", onclick: (e: MouseEvent) => { sfx("click"); onclick(e); } },
    ...nn(o.icon ? ui(o.icon, 2) : null, typeof label === "string" ? h("span", null, label) : label));
  if (o.disabled) b.disabled = true;
  return b;
}

/** Animates a number from its current value to `to` (gold counting up...). */
export function countTo(el: HTMLElement, to: number, fmt: (n: number) => string = String) {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = String(to);
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = Math.min(900, 120 + Math.abs(to - from) * 40);
  const step = (t: number) => {
    if (el.dataset.v !== String(to)) return;
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) * (1 - k))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Re-triggers a CSS animation class. */
export function bump(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/* ================================================================== windows */

export interface AdvWin {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
}

/**
 * A game window: a framed sheet sliding up from the bottom on phones, a centred window on
 * larger screens. Escape / the close button / tapping outside closes it.
 */
export function advWindow(host: HTMLElement, title: string, o: { cls?: string; onClose?: () => void; noClose?: boolean; icon?: UiIcon } = {}): AdvWin {
  const body = h("div", { class: "adv-win-body" });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sfx("close");
    document.removeEventListener("keydown", key);
    back.classList.add("out");
    setTimeout(() => back.remove(), 180);
    o.onClose?.();
  };
  const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !o.noClose) close(); };
  const win = h("div", { class: `adv-win fr-panel ${o.cls ?? ""}`, role: "dialog", "aria-label": title },
    h("div", { class: "adv-win-head" },
      ...nn(o.icon ? ui(o.icon, 2) : null, h("h2", null, title), o.noClose ? null : iconBtn("close", "Đóng", close, "small"))),
    body);
  const back = h("div", { class: "adv-win-back" }, win);
  back.addEventListener("pointerdown", (e) => { if (e.target === back && !o.noClose) close(); });
  document.addEventListener("keydown", key);
  host.append(back);
  sfx("open");
  return { el: win, body, close };
}

/** Yes/no question in the Adventure skin. */
export function advConfirm(host: HTMLElement, title: string, text: string, ok = "Đồng ý", cancel = "Huỷ"): Promise<boolean> {
  return new Promise((res) => {
    let done = false;
    const w = advWindow(host, title, { cls: "small", onClose: () => { if (!done) res(false); } });
    w.body.append(h("p", { class: "adv-confirm-t" }, text),
      h("div", { class: "adv-row-btns" },
        gameBtn(cancel, () => { done = true; w.close(); res(false); }),
        gameBtn(ok, () => { done = true; w.close(); res(true); }, { kind: "gold" })));
  });
}
