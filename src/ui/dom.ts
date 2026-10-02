import { recentSfx, sfx } from "../audio/sfx";
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript helper. `onclick`-style props become event listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style") el.setAttribute("style", String(v));
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
      else if (k in el && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Filters out null/false so the result can be spread into native append(). */
export const nn = (...xs: (Node | string | null | undefined | false)[]) => xs.filter((x): x is Node | string => x !== null && x !== undefined && x !== false);

export function clear(el: Element) {
  el.replaceChildren();
}

// ------------------------------------------------------------ modal
export interface ModalHandle {
  el: HTMLDivElement;
  body: HTMLDivElement;
  close: () => void;
  setTitle: (t: string) => void;
  /** Go back to the top on the next re-render (opening another page inside the window). */
  resetScroll?: () => void;
  /** True while the player is touching or has just scrolled: periodic refreshes should wait. */
  busy?: () => boolean;
}

let modalStack: ModalHandle[] = [];
/** z-index for a new window: above every open one, below toasts (80) and hover cards (90). */
export const nextLayer = () => Math.min(78, 50 + modalStack.length * 2);

export function openModal(title: string, opts: { onClose?: () => void; wide?: boolean; noClose?: boolean; cls?: string } = {}): ModalHandle {
  const titleEl = h("h2", { class: "modal-title" }, title);
  const body = h("div", { class: "modal-body" });
  const box = h("div", { class: `modal ${opts.wide ? "wide" : ""} ${opts.cls ?? ""}` },
    h("div", { class: "modal-head" }, titleEl, opts.noClose ? null : h("button", { class: "icon-btn", "aria-label": "Đóng", onclick: () => handle.close() }, "✕")),
    body,
  );
  const backdrop = h("div", { class: "backdrop" }, box);
  // each window opened later sits above the earlier ones (a gift picker over a conversation...)
  backdrop.style.zIndex = String(nextLayer());
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop && !opts.noClose) handle.close();
  });
  document.body.append(backdrop);
  sfx("open");
  const handle: ModalHandle = {
    el: backdrop,
    body,
    close: () => {
      if (backdrop.isConnected) sfx("close");
      backdrop.remove();
      modalStack = modalStack.filter((m) => m !== handle);
      opts.onClose?.();
    },
    setTitle: (t) => { titleEl.textContent = t; },
  };
  modalStack.push(handle);
  autoSearch(handle);
  keepScroll(handle);
  return handle;
}

// ------------------------------------------------------------ scroll that stays put
/**
 * Windows redraw their content all the time (a button pressed, a timer ticking). Rebuilding the
 * content would throw the reader back to the top, or fight a finger mid-swipe on phones. So the
 * window remembers where it (and every scrolling list inside it) was and puts it back once the
 * redraw is done; and it reports when the player is touching or scrolling, so timers can wait.
 */
function keepScroll(m: ModalHandle) {
  const body = m.body;
  let reset = false;
  let touching = false;
  let lastScroll = 0;
  const mark = () => { lastScroll = performance.now(); };
  body.addEventListener("scroll", mark, { passive: true, capture: true });
  body.addEventListener("touchstart", () => { touching = true; mark(); }, { passive: true });
  body.addEventListener("touchend", () => { touching = false; mark(); }, { passive: true });
  body.addEventListener("touchcancel", () => { touching = false; }, { passive: true });
  m.busy = () => touching || performance.now() - lastScroll < 1200;
  m.resetScroll = () => { reset = true; body.scrollTop = 0; };

  const key = (el: Element) => {
    const same = [...body.querySelectorAll(el.className ? `.${[...el.classList].map((c) => CSS.escape(c)).join(".")}` : el.tagName)];
    return `${el.className}#${same.indexOf(el)}`;
  };
  const native = Element.prototype.replaceChildren;
  body.replaceChildren = function (...nodes: (Node | string)[]) {
    const top = body.scrollTop;
    const inner = new Map<string, number>();
    for (const el of body.querySelectorAll<HTMLElement>("*")) if (el.scrollTop > 0) inner.set(key(el), el.scrollTop);
    native.apply(body, nodes);
    reset = false;
    // after the caller has finished appending (and the search box has been placed)
    queueMicrotask(() => {
      if (reset) { reset = false; return; }
      body.scrollTop = top;
      if (inner.size) for (const el of body.querySelectorAll<HTMLElement>("*")) {
        if (el.scrollHeight <= el.clientHeight) continue;
        const v = inner.get(key(el));
        if (v) el.scrollTop = v;
      }
    });
  };
}

// ------------------------------------------------------------ automatic search for long lists
/** Lower-case, accent-free text so "nhan" finds "Nhẫn". */
const foldText = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const AUTO_SEARCH_MIN = 8;

/**
 * Any modal that shows a long list of rows (gear, gifts, shop stock, recipes, seeds...) gets a
 * search box above the list. It survives re-renders and keeps what was typed.
 */
function autoSearch(m: ModalHandle) {
  let query = "";
  let busy = false;
  let list: HTMLElement | null = null;
  const apply = () => {
    const q = foldText(query.trim());
    for (const row of m.body.querySelectorAll<HTMLElement>(".item-row")) {
      // a lone detail row outside the list (e.g. the plot being tended) always stays
      if (row.closest(".no-search") || (list && list !== m.body && row.parentElement !== list)) continue;
      row.style.display = !q || foldText(row.textContent ?? "").includes(q) ? "" : "none";
    }
  };
  const ensure = () => {
    if (busy) return;
    busy = true;
    try {
      const rows = m.body.querySelectorAll(".item-row");
      const own = m.body.querySelector(".searchbar:not(.auto-search)") || m.el.querySelector(".no-autosearch");
      const boxes = [...m.el.querySelectorAll<HTMLElement>(".auto-search")];
      if (own || rows.length < AUTO_SEARCH_MIN) { boxes.forEach((b) => b.remove()); return; }
      // the container holding the most rows is "the list" (a detail row may sit loose in the body)
      const tally = new Map<HTMLElement, number>();
      for (const r of rows) { const p = r.parentElement!; tally.set(p, (tally.get(p) ?? 0) + 1); }
      const top = [...tally].sort((a, b) => b[1] - a[1])[0][0];
      list = top;
      const placed = (b: HTMLElement) => (top === m.body ? b.parentElement === m.body && m.body.firstElementChild === b : b.nextElementSibling === top);
      let box: HTMLElement | undefined = boxes.find(placed);
      for (const b of boxes) if (b !== box) b.remove();
      if (!box) {
        const input = h("input", { class: "input", type: "search", placeholder: "🔍 Tìm trong danh sách…", value: query }) as HTMLInputElement;
        input.addEventListener("input", () => { query = input.value; apply(); });
        box = h("div", { class: "searchbar auto-search" }, input);
        if (top === m.body) m.body.prepend(box); else top.before(box);
      }
      apply();
    } finally { busy = false; }
  };
  new MutationObserver(ensure).observe(m.body, { childList: true, subtree: true });
}

/** Lets a custom full-screen window (dialogue...) count as a modal: it blocks map keys and closes with the rest. */
export function trackModal(hd: ModalHandle): () => void {
  modalStack.push(hd);
  return () => { modalStack = modalStack.filter((m) => m !== hd); };
}

/** True when `hd` is the window on top (so it should get the keyboard). */
export const isTopModal = (hd: ModalHandle) => modalStack[modalStack.length - 1] === hd;

export function closeAllModals() {
  for (const m of [...modalStack]) m.close();
}

export function topModalOpen() {
  return modalStack.length > 0;
}

// ------------------------------------------------------------ toast
let toastBox: HTMLDivElement | null = null;

export function toast(msg: string, kind: "info" | "good" | "bad" = "info", ms = 2600) {
  if (!toastBox) {
    toastBox = h("div", { class: "toasts" });
    document.body.append(toastBox);
  }
  const t = h("div", { class: `toast ${kind}` }, msg);
  if (!recentSfx(150)) sfx(kind === "good" ? "good" : kind === "bad" ? "error" : "notify");
  toastBox.append(t);
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function confirmBox(title: string, text: string, ok = "Đồng ý", cancel = "Huỷ"): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(title, { onClose: () => { if (!done) resolve(false); } });
    m.body.append(
      h("p", { class: "confirm-text" }, text),
      h("div", { class: "row end" },
        h("button", { class: "btn", onclick: () => { done = true; m.close(); resolve(false); } }, cancel),
        h("button", { class: "btn primary", onclick: () => { done = true; m.close(); resolve(true); } }, ok),
      ),
    );
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A pause that only exists for the eyes. While the tab is hidden, browsers stretch every timer
 * to a second or more (a minute after a while), which froze background auto-battles; there is
 * nothing to watch then, so we just yield (a message-channel tick is not throttled) and go on.
 */
const chan = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
const waiting: (() => void)[] = [];
if (chan) chan.port1.onmessage = () => waiting.shift()?.();
export const pace = (ms: number): Promise<void> => {
  if (typeof document !== "undefined" && document.hidden) {
    if (!chan) return Promise.resolve();
    return new Promise<void>((r) => { waiting.push(r); chan.port2.postMessage(0); });
  }
  return sleep(ms);
};

export function bar(value: number, max: number, cls: string, label?: string) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h("div", { class: `bar ${cls}` },
    h("div", { class: "bar-fill", style: `width:${pct}%` }),
    label !== undefined ? h("span", { class: "bar-label" }, label) : null,
  );
}

let savedEl: HTMLDivElement | null = null;
let savedTimer = 0;
/** Small, quiet "💾 Saved" mark in the corner after an important moment was saved. */
export function savedMark(label = "") {
  if (!savedEl) { savedEl = h("div", { class: "saved-mark" }); document.body.append(savedEl); }
  savedEl.replaceChildren(h("span", { class: "sm-ico" }, "💾"), h("span", null, label ? `Đã lưu · ${label}` : "Đã lưu"));
  savedEl.classList.remove("show"); void savedEl.offsetWidth; savedEl.classList.add("show");
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => savedEl?.classList.remove("show"), 2200);
}
