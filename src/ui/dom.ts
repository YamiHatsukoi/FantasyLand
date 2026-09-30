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
}

let modalStack: ModalHandle[] = [];

export function openModal(title: string, opts: { onClose?: () => void; wide?: boolean; noClose?: boolean; cls?: string } = {}): ModalHandle {
  const titleEl = h("h2", { class: "modal-title" }, title);
  const body = h("div", { class: "modal-body" });
  const box = h("div", { class: `modal ${opts.wide ? "wide" : ""} ${opts.cls ?? ""}` },
    h("div", { class: "modal-head" }, titleEl, opts.noClose ? null : h("button", { class: "icon-btn", "aria-label": "Đóng", onclick: () => handle.close() }, "✕")),
    body,
  );
  const backdrop = h("div", { class: "backdrop" }, box);
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop && !opts.noClose) handle.close();
  });
  document.body.append(backdrop);
  const handle: ModalHandle = {
    el: backdrop,
    body,
    close: () => {
      backdrop.remove();
      modalStack = modalStack.filter((m) => m !== handle);
      opts.onClose?.();
    },
    setTitle: (t) => { titleEl.textContent = t; },
  };
  modalStack.push(handle);
  autoSearch(handle);
  return handle;
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
  const apply = () => {
    const q = foldText(query.trim());
    for (const row of m.body.querySelectorAll<HTMLElement>(".item-row")) {
      if (row.closest(".no-search")) continue;
      row.style.display = !q || foldText(row.textContent ?? "").includes(q) ? "" : "none";
    }
  };
  const ensure = () => {
    if (busy) return;
    busy = true;
    try {
      const rows = m.body.querySelectorAll(".item-row");
      const own = m.body.querySelector(".searchbar:not(.auto-search)") || m.el.querySelector(".no-autosearch");
      let box = m.body.querySelector<HTMLElement>(".auto-search");
      if (own || rows.length < AUTO_SEARCH_MIN) { box?.remove(); return; }
      const list = rows[0].parentElement!;
      if (!box || box.nextElementSibling !== list) {
        box?.remove();
        const input = h("input", { class: "input", type: "search", placeholder: "🔍 Tìm trong danh sách…", value: query }) as HTMLInputElement;
        input.addEventListener("input", () => { query = input.value; apply(); });
        box = h("div", { class: "searchbar auto-search" }, input);
        list.before(box);
      }
      apply();
    } finally { busy = false; }
  };
  new MutationObserver(ensure).observe(m.body, { childList: true, subtree: true });
}

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

export function bar(value: number, max: number, cls: string, label?: string) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h("div", { class: `bar ${cls}` },
    h("div", { class: "bar-fill", style: `width:${pct}%` }),
    label !== undefined ? h("span", { class: "bar-label" }, label) : null,
  );
}
