import { h, isTopModal, nextLayer, trackModal, type ModalHandle } from "./dom";
import { sfx } from "../audio/sfx";

/**
 * Cinematic conversation window: a large portrait sliding in from the side, an ornate name
 * plate, a framed text panel with a typewriter, and choices with number hotkeys. Used for
 * people in the abyss, residents of the sanctuary and milestone scenes.
 */
export interface DlgChoice {
  label: string;
  icon?: string;
  /** Second, dimmer line under the label (requirements, costs...). */
  hint?: string;
  disabled?: boolean;
  tone?: "gold" | "love" | "danger" | "quiet";
  /** Leave the choices visible but grey while the text is still typing. */
  onPick: () => void;
}

export interface DialogueOpts {
  name: string;
  title?: string;
  portrait: HTMLElement;
  accent?: string;
  closable?: boolean;
  onClose?: () => void;
}

interface Entry { who: "npc" | "you" | "sys"; text: string }

export class Dialogue {
  readonly root: HTMLDivElement;
  private panel: HTMLDivElement;
  private textEl: HTMLDivElement;
  private youEl: HTMLDivElement;
  private infoEl: HTMLDivElement;
  private choicesEl: HTMLDivElement;
  private nextMark: HTMLDivElement;
  private notes: HTMLDivElement;
  private historyEl: HTMLDivElement | null = null;
  private typing = 0;
  private queue: string[] = [];
  private flushPending = false;
  private picks: (() => void)[] = [];
  private untrack: () => void;
  private handle: ModalHandle;
  readonly log: Entry[] = [];
  private closed = false;
  /** Pitch of this speaker's typewriter blips, from their name. */
  private voice = 260;

  constructor(private opts: DialogueOpts) {
    let hsh = 0; for (const c of opts.name) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    this.voice = 220 + (hsh % 260);
    this.textEl = h("div", { class: "dlg-text" });
    this.youEl = h("div", { class: "dlg-you" });
    this.nextMark = h("div", { class: "dlg-next" }, "▼");
    this.infoEl = h("div", { class: "dlg-info" });
    this.choicesEl = h("div", { class: "dlg-choices" });
    this.notes = h("div", { class: "dlg-notes" });
    this.panel = h("div", { class: "dlg-panel" },
      h("div", { class: "dlg-plate" }, h("div", { class: "dlg-name" }, opts.name), opts.title ? h("div", { class: "dlg-title" }, opts.title) : null),
      this.youEl, this.textEl, this.nextMark);
    const top = h("div", { class: "dlg-top" },
      this.infoEl,
      h("div", { class: "dlg-tools" },
        h("button", { class: "dlg-tool", title: "Lịch sử hội thoại", onclick: () => this.toggleHistory() }, "📜"),
        opts.closable === false ? null : h("button", { class: "dlg-tool", title: "Đóng (Esc)", onclick: () => this.close() }, "✕")));
    const art = h("div", { class: "dlg-art" }, opts.portrait);
    this.root = h("div", { class: "dlg", style: opts.accent ? `--acc:${opts.accent}` : "" }, h("div", { class: "dlg-shade" }), top, art, this.notes, this.choicesEl, this.panel);
    this.root.style.zIndex = String(nextLayer());
    this.panel.addEventListener("click", () => this.skip());
    document.body.append(this.root);
    requestAnimationFrame(() => this.root.classList.add("in"));
    this.handle = { el: this.root, body: this.panel, close: () => this.close(), setTitle: () => undefined };
    this.untrack = trackModal(this.handle);
    window.addEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (!isTopModal(this.handle)) return;
    if (e.key === "Escape" && this.opts.closable !== false) { e.preventDefault(); this.close(); return; }
    if (e.key === " " || e.key === "Enter") { if (this.typing) { e.preventDefault(); this.skip(); } return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && this.picks[n - 1]) { e.preventDefault(); this.picks[n - 1](); }
  };

  /** The other person speaks; several calls in a row are shown together. */
  say(text: string) {
    this.log.push({ who: "npc", text });
    this.queue.push(text);
    if (!this.flushPending) { this.flushPending = true; queueMicrotask(() => this.flush()); }
  }

  /** What the player said, shown as a small quote above the reply. */
  you(text: string) {
    this.log.push({ who: "you", text });
    this.youEl.textContent = `“${text}”`;
    this.youEl.classList.remove("show"); void this.youEl.offsetWidth; this.youEl.classList.add("show");
  }

  /** A floating system note (affinity change, quest accepted...). */
  note(text: string, kind: "good" | "bad" | "" = "") {
    this.log.push({ who: "sys", text });
    const el = h("div", { class: `dlg-note ${kind || (/[+]\d/.test(text) ? "good" : /-\d/.test(text) ? "bad" : "")}` }, text);
    this.notes.append(el);
    setTimeout(() => el.remove(), 3200);
  }

  setInfo(...els: (HTMLElement | string | null)[]) { this.infoEl.replaceChildren(...els.filter((x): x is HTMLElement | string => !!x)); }

  choices(list: DlgChoice[]) {
    this.picks = [];
    this.choicesEl.replaceChildren(...list.map((c) => {
      const idx = this.picks.length;
      const pick = () => { if (!c.disabled && !this.closed) c.onPick(); };
      if (!c.disabled) this.picks.push(pick); else this.picks.push(() => undefined);
      const b = h("button", { class: `dlg-choice ${c.tone ?? ""} ${c.disabled ? "off" : ""}`, disabled: !!c.disabled, onclick: pick, style: `--i:${idx}` },
        h("span", { class: "dlg-key" }, idx < 9 ? String(idx + 1) : "•"),
        c.icon ? h("span", { class: "dlg-ico" }, c.icon) : null,
        h("span", { class: "dlg-lbl" }, c.label, c.hint ? h("small", null, c.hint) : null));
      return b;
    }));
    this.choicesEl.classList.remove("show"); void this.choicesEl.offsetWidth; this.choicesEl.classList.add("show");
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.typing);
    window.removeEventListener("keydown", this.onKey);
    this.untrack();
    this.root.classList.remove("in");
    this.root.classList.add("out");
    setTimeout(() => this.root.remove(), 220);
    this.opts.onClose?.();
  }

  private flush() {
    this.flushPending = false;
    const lines = this.queue.splice(0);
    if (!lines.length) return;
    window.clearInterval(this.typing);
    this.textEl.replaceChildren();
    this.panel.classList.remove("done");
    const paras = lines.map((l) => { const p = h("p", null); this.textEl.append(p); return { p, l }; });
    let k = 0, i = 0;
    const step = Math.max(1, Math.ceil(lines.join("").length / 140));
    this.typing = window.setInterval(() => {
      const cur = paras[k];
      if (!cur) { this.finishTyping(); return; }
      i += step;
      cur.p.textContent = cur.l.slice(0, i);
      if (/\S/.test(cur.l[i - 1] ?? "")) sfx("blip", String(this.voice));
      if (i >= cur.l.length) { k++; i = 0; }
    }, 18);
  }

  private finishTyping() {
    window.clearInterval(this.typing);
    this.typing = 0;
    const ps = [...this.textEl.querySelectorAll("p")];
    const all = this.log.filter((e) => e.who === "npc").slice(-ps.length).map((e) => e.text);
    ps.forEach((p, i) => { p.textContent = all[i] ?? p.textContent; });
    this.panel.classList.add("done");
  }

  private skip() { if (this.typing) this.finishTyping(); }

  private toggleHistory() {
    if (this.historyEl) { this.historyEl.remove(); this.historyEl = null; return; }
    const name = this.opts.name.split(" ")[0];
    this.historyEl = h("div", { class: "dlg-history" },
      h("div", { class: "dlg-history-head" }, h("b", null, "📜 Lịch sử"), h("button", { class: "dlg-tool", onclick: () => this.toggleHistory() }, "✕")),
      h("div", { class: "dlg-history-body" }, this.log.map((e) => h("div", { class: `hl ${e.who}` }, e.who === "npc" ? h("b", null, `${name}: `) : e.who === "you" ? h("b", null, "Bạn: ") : "", e.text))));
    this.root.append(this.historyEl);
    const body = this.historyEl.querySelector(".dlg-history-body")!;
    body.scrollTop = body.scrollHeight;
  }
}
