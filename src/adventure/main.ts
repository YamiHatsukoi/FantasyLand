/**
 * Adventure: the Lone Wolf gamebooks as a game. Library → save slots → character creation →
 * the story: each section is a living scene with its characters, the text, and what to do
 * next (choices, a random number, a battle). Travel between places plays on the map; big
 * moments play as cutscenes. Loaded on demand from the game picker.
 *
 * Layout: the scene is the screen. On phones it fills the top edge to edge with the HUD over
 * it and the story in a bottom sheet (half / full / minimised); on wide screens the story is
 * docked beside it. Every window uses the pixel frames from ./ui.
 */
import "./style.css";
import type { Screen } from "../app";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { ApiError, errorText, type Session } from "../net/api";
import { h, nn, sleep, toast } from "../ui/dom";
import { discIcon, iconEl, itemIcon, type UiIcon } from "./art/icons";
import { portrait, withWeapon, type Look } from "./art/people";
import { makeScene, type SceneSpec } from "./art/scene";
import { playCutscene } from "./cutscene";
import {
  choiceState, condText, discsOf, drop, enter, epMax, itemName, newRun, pendingLoss, phase, pick10,
  profile, randomResult, retry, takeOffer, useItem, apply, continueRun, visibleChoices, type Change,
} from "./engine";
import { runFight } from "./fight";
import { importBook, listBooks, loadBook, removeBook, type BookEntry } from "./library";
import { AdvSaves, type SlotInfo } from "./save";
import { Stage } from "./stage";
import type { AdvState, Book, Choice, Disc, Offer } from "./types";
import { advConfirm, advWindow, bump, countTo, gameBtn, iconBtn, installSkin, StageFit, ui } from "./ui";
import { WorldMapView, mapPlace } from "./worldmap";

export interface AdventureOpts {
  leave: () => void;
  expired: () => void;
}

/**
 * Explore mode (sections with scene.explore): ./explore.ts draws the place as a walkable area
 * where choices with `via` are spots to walk to. Loaded on demand (it is large); choices without
 * `via` stay as buttons in the story panel.
 */
type ExploreView = { destroy(): void; pause(on: boolean): void };
type Side = "north" | "south" | "east" | "west";
const OPPOSITE: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

const itemLabel = (book: Book, o: { gain: string; n?: number }) => `${itemName(book, o.gain)}${(o.n ?? 1) > 1 ? ` ×${o.n}` : ""}`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountAdventure(root: HTMLElement, session: Session, opts: AdventureOpts): Screen {
  installSkin();
  playMusic("title");
  const el = h("div", { class: "screen adv" });
  root.append(el);
  let saves: AdvSaves | null = null;
  let alive = true;
  /** Things to tear down when the screen changes (stages, fitters, key handlers). */
  let cleanups: (() => void)[] = [];
  const flush = () => void saves?.flush();
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flush);
  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === "invalid_session") return opts.expired();
    toast(errorText(e), "bad", 6000);
  };
  const clearStage = () => { for (const f of cleanups) f(); cleanups = []; };
  const show = (...nodes: Node[]) => { clearStage(); el.replaceChildren(...nodes); };
  const confirm = (t: string, x: string, ok: string) => advConfirm(el, t, x, ok);

  /** A living scene filling `box` (menus use it as their backdrop). */
  function backdrop(box: HTMLElement, spec: SceneSpec, cast: string[] = [], look?: Look, o: ConstructorParameters<typeof StageFit>[2] = {}) {
    const st = new Stage(spec);
    if (cast.length) st.cast(cast, look);
    const fit = new StageFit(box, st, o);
    cleanups.push(() => { fit.destroy(); st.destroy(); });
    return st;
  }

  /** Title bar of the menu screens: framed back button, pixel title, extras on the right. */
  const head = (title: string, back: () => void, ...extra: (Node | null)[]) =>
    h("header", { class: "adv-head" }, iconBtn("back", "Quay lại", back), h("h1", { class: "adv-head-t" }, title), ...nn(...extra));

  const loading = (t: string) => h("div", { class: "adv-loading" }, h("div", { class: "adv-spinner" }), t);

  // ---------------------------------------------------------------- library
  async function library() {
    const leave = async () => { await saves?.flush(); opts.leave(); };
    show(h("div", { class: "adv-menu" }, head("Thư Viện", leave), loading("Đang mở thư viện…")));
    let books: BookEntry[] = [];
    try { books = await listBooks(session); } catch (e) { fail(e); }
    if (!alive) return;
    const file = h("input", { type: "file", accept: ".json,application/json", class: "hidden" }) as HTMLInputElement;
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      toast("Đang nạp sách…");
      try { const e = await importBook(session, f); toast(`Đã nạp: ${e.title}`, "good"); void library(); } catch (e) { fail(e); }
    };
    const bg = h("div", { class: "adv-menu-bg" });
    const addCard = h("button", { class: "adv-addbook fr-slot", type: "button", onclick: () => file.click() },
      h("span", { class: "adv-addbook-plus" }, "+"), h("b", null, "Nạp sách"), h("small", null, "Gói sách .json của bạn"));
    show(h("div", { class: "adv-menu" }, bg,
      head("Thư Viện", leave, h("span", { class: "adv-user fr-chip" }, ui("user", 1), session.username)),
      h("div", { class: "adv-menu-scroll" },
        h("div", { class: "adv-menu-inner" },
          h("p", { class: "adv-kicker" }, books.length ? "Chọn một cuốn sách để bắt đầu hành trình" : "Thư viện đang trống"),
          h("div", { class: "adv-shelf" }, ...books.map(bookCard), addCard),
          books.length ? null : h("p", { class: "adv-hint" }, "Nạp file gói sách (.json) của bạn. Sách được lưu riêng trong tài khoản này, chỉ bạn đọc được."),
          file))));
    backdrop(bg, { bg: "camp", time: "night", weather: "clear", mood: "calm", seed: "library" }, ["lonewolf"], undefined, { minVis: 0.5, anchorY: 0.62 });
  }

  function bookCard(b: BookEntry) {
    const cover = document.createElement("canvas");
    cover.width = 320; cover.height = 180; cover.className = "adv-cover-art";
    try { makeScene({ bg: (["forest", "river", "cave", "mountain", "desert"] as const)[b.num % 5], time: (["dusk", "night", "day", "dawn"] as const)[b.num % 4], weather: "clear", mood: "mystery", seed: b.id }).draw(cover.getContext("2d")!, 0); } catch { /* art still loading */ }
    return h("div", { class: "adv-book" },
      h("button", { class: "adv-book-main fr-panel", type: "button", onclick: () => { sfx("open"); void openBook(b); } },
        h("div", { class: "adv-cover" }, cover, h("span", { class: "adv-cover-num" }, String(b.num))),
        h("div", { class: "adv-book-plate" }, h("small", null, `Cuốn ${b.num}`), h("b", null, b.title))),
      iconBtn("close", "Xoá sách", async () => {
        if (!(await confirm("Xoá sách", `Xoá "${b.title}" khỏi thư viện? Các ô lưu vẫn còn, nạp lại sách là chơi tiếp được.`, "Xoá"))) return;
        try { await removeBook(session, b.id); void library(); } catch (e) { fail(e); }
      }, "small adv-book-del"));
  }

  async function openBook(entry: BookEntry) {
    show(h("div", { class: "adv-menu" }, loading("Đang mở sách…")));
    try {
      const book = await loadBook(session, entry);
      saves = new AdvSaves(session, book.id);
      saves.onError = (e) => { if (e instanceof ApiError && e.code === "invalid_session") opts.expired(); };
      const slots = await saves.list();
      if (alive) slotScreen(book, slots, entry);
    } catch (e) { fail(e); void library(); }
  }

  const startSpec = (book: Book, mood: SceneSpec["mood"] = "mystery"): SceneSpec => {
    const sc = book.sections[book.start].scene;
    return { bg: sc.bg, time: sc.time, weather: sc.weather, mood, seed: book.id };
  };
  const heroFace = (weapon?: string, scale = 2) => {
    const c = portrait(withWeapon("lonewolf", weapon));
    return iconEl(c, scale, "adv-face");
  };

  // ---------------------------------------------------------------- save slots
  function slotScreen(book: Book, slots: SlotInfo[], entry: BookEntry) {
    const bg = h("div", { class: "adv-title-bg" });
    const list = h("div", { class: "adv-slot-list fr-panel" },
      h("div", { class: "adv-panel-t" }, "Chọn ô lưu"),
      ...slots.map((sl) => {
        const d = sl.data;
        if (!d) return h("button", { class: "adv-slot empty fr-slot", type: "button", onclick: () => void startNew(book, sl.slot, entry) },
          h("span", { class: "adv-slot-n" }, String(sl.slot + 1)), h("span", { class: "adv-slot-new" }, h("b", null, "Cuộc phiêu lưu mới"), h("small", null, "Tạo nhân vật Kai")), h("span", { class: "adv-slot-plus" }, "+"));
        const st = d.ended === "victory" ? "Đã hoàn thành" : d.ended === "death" ? "Đã tử nạn" : `Đoạn ${d.section} · ${d.steps} bước`;
        return h("div", { class: `adv-slot ${d.ended ?? ""}` },
          h("button", { class: "adv-slot-main fr-btn", type: "button", onclick: () => { sfx("click"); play(book, sl.slot, d, entry); } },
            h("span", { class: "adv-slot-face fr-slot" }, heroFace(d.weapons[0])),
            h("span", { class: "adv-slot-info" },
              h("b", null, d.name), h("small", null, st),
              h("span", { class: "adv-slot-stats" }, ui("cs", 1), String(d.cs), ui("ep", 1), String(d.ep), ui("gold", 1), String(d.gold))),
            h("span", { class: "adv-slot-go" }, d.ended ? "Xem" : "Chơi tiếp")),
          iconBtn("close", "Xoá ô lưu", async () => {
            if (!(await confirm("Xoá ô lưu", `Xoá cuộc phiêu lưu của ${d.name} ở ô ${sl.slot + 1}? Không thể hoàn tác.`, "Xoá"))) return;
            try { await saves!.remove(sl.slot); sl.data = null; slotScreen(book, slots, entry); } catch (e) { fail(e); }
          }, "small"));
      }));
    show(h("div", { class: "adv-title" }, bg,
      head("", () => { void saves?.flush(); void library(); }),
      h("div", { class: "adv-logo" }, h("small", null, `Lone Wolf · Cuốn ${book.num}`), h("h1", null, book.title), book.titleEn && book.titleEn !== book.title ? h("span", null, book.titleEn) : null),
      list));
    const sc = book.sections[book.start].scene;
    backdrop(bg, startSpec(book), sc.actors.length ? sc.actors : ["lonewolf"], withWeapon("lonewolf", "Axe"), { minVis: 0.55, anchorY: 0.5 });
  }

  // ---------------------------------------------------------------- character creation
  /** The 0-9 random number wheel: a cursor runs over the tiles and settles on the result. */
  function wheelRoll(target: HTMLElement): Promise<number> {
    const n = pick10();
    const cells = Array.from({ length: 10 }, (_, i) => h("span", null, String(i)));
    const wheel = h("div", { class: "adv-wheel spinning" }, ...cells);
    target.replaceChildren(wheel);
    return (async () => {
      const quick = reduced();
      for (let i = quick ? n : 0; i <= 12 + n; i++) {
        cells.forEach((c, j) => c.classList.toggle("lit", j === i % 10));
        sfx("blip", String(300 + (i % 10) * 25));
        if (quick) break;
        await sleep(28 + i * 5);
      }
      cells.forEach((c, j) => c.classList.toggle("lit", j === n));
      wheel.classList.remove("spinning");
      bump(cells[n], "won");
      sfx("good");
      return n;
    })();
  }

  /** A step-by-step setup (character creation, carry-over) with a dock of Back / Next. */
  function wizard(title: string, book: Book, back: () => void, steps: { name: string; draw: (box: HTMLElement, redraw: () => void) => void; ok: () => boolean }[], finish: () => void, finishLabel: string) {
    let at = 0;
    const bg = h("div", { class: "adv-menu-bg dim" });
    const pips = h("div", { class: "adv-pips" });
    const box = h("div", { class: "adv-wiz-inner" });
    const scroll = h("div", { class: "adv-menu-scroll" }, box);
    const prev = gameBtn("Quay lại", () => { if (at > 0) { at--; draw(true); } else back(); });
    const next = gameBtn("Tiếp", () => {
      if (!steps[at].ok()) return;
      if (at < steps.length - 1) { at++; draw(true); } else finish();
    }, { kind: "gold" });
    const draw = (reset = false) => {
      pips.replaceChildren(...steps.map((s, i) => h("span", { class: `adv-pip ${i === at ? "on" : i < at ? "done" : ""}` }, h("i", null, String(i + 1)), h("b", null, s.name))));
      const top = scroll.scrollTop;
      box.replaceChildren();
      steps[at].draw(box, redraw);
      if (reset) { scroll.scrollTop = 0; box.classList.remove("in"); void box.offsetWidth; box.classList.add("in"); } else scroll.scrollTop = top;
      redraw();
    };
    const redraw = () => {
      next.disabled = !steps[at].ok();
      (next.lastChild as HTMLElement).textContent = at === steps.length - 1 ? finishLabel : "Tiếp";
      prev.classList.toggle("ghost", at === 0);
    };
    show(h("div", { class: "adv-menu adv-wiz" }, bg, head(title, back), pips, scroll, h("div", { class: "adv-dock-bar" }, prev, next)));
    backdrop(bg, startSpec(book, "calm"), [], undefined, { minVis: 0.5 });
    draw(true);
    return { redraw: () => draw() };
  }

  /** A new adventure: a fresh hero, or the hero who finished the previous book. */
  async function startNew(book: Book, slot: number, entry: BookEntry) {
    show(h("div", { class: "adv-menu" }, loading("Đang chuẩn bị…")));
    let heroes: AdvState[] = [];
    try {
      const prev = (await listBooks(session)).find((b) => b.num === book.num - 1);
      if (prev) {
        const prevBook = await loadBook(session, prev);
        if ((prevBook.rules ?? "kai") === (book.rules ?? "kai")) {
          heroes = (await new AdvSaves(session, prev.id).list()).map((x) => x.data).filter((d): d is AdvState => !!d && d.ended === "victory");
        }
      }
    } catch { /* offline or no earlier book: fresh hero only */ }
    if (!alive) return;
    if (!heroes.length) return create(book, slot, entry);
    const bg = h("div", { class: "adv-menu-bg dim" });
    show(h("div", { class: "adv-menu" }, bg, head("Cuộc phiêu lưu mới", () => void openBook(entry)),
      h("div", { class: "adv-menu-scroll" }, h("div", { class: "adv-menu-inner narrow" },
        h("div", { class: "adv-card fr-panel" },
          h("div", { class: "adv-panel-t" }, "Người hùng trở lại"),
          h("p", { class: "adv-lead" }, `Bạn đã hoàn thành cuốn ${book.num - 1}. Mang nhân vật sang cuốn này để giữ chỉ số, kỹ năng và hành trang, và học thêm 1 kỹ năng mới.`),
          ...heroes.map((p) => h("button", { class: "adv-slot-main fr-btn", type: "button", onclick: () => carryOver(book, slot, entry, p) },
            h("span", { class: "adv-slot-face fr-slot" }, heroFace(p.weapons[0])),
            h("span", { class: "adv-slot-info" }, h("b", null, p.name),
              h("span", { class: "adv-slot-stats" }, ui("cs", 1), String(p.cs), ui("ep", 1), String(p.epBase), ui("gold", 1), String(p.gold), ` · ${p.disciplines.length} kỹ năng`)),
            h("span", { class: "adv-slot-go" }, "Chọn"))),
          h("div", { class: "adv-or" }, "hoặc"),
          gameBtn("Tạo nhân vật mới", () => create(book, slot, entry), { cls: "block" }))))));
    backdrop(bg, startSpec(book, "calm"), [], undefined, { minVis: 0.5 });
  }

  const optLabel = (book: Book, o: Book["kit"]["picks"][number]["options"][number]) => "gold" in o
    ? h("span", { class: "adv-item-l" }, ui("gold", 2), h("b", null, `${o.gold} Vương Miện Vàng`))
    : h("span", { class: "adv-item-l" }, iconEl(itemIcon(o.gain, o.type), 2), h("b", null, itemLabel(book, o)));

  /** Kit step shared by creation and carry-over. */
  function kitStep(book: Book, r: { gold: number }, picks: number[][], extraNote = "") {
    return (box: HTMLElement, redraw: () => void) => {
      const rerender = () => { box.replaceChildren(); kitStep(book, r, picks, extraNote)(box, redraw); redraw(); };
      const goldWheel = h("div", { class: "adv-wheel-box" });
      box.append(...nn(
        h("p", { class: "adv-lead" }, "Trang bị cho chuyến đi. Ba Lô chứa tối đa 8 món, mang tối đa 2 vũ khí."),
        book.kit.items.length ? h("div", { class: "adv-card fr-panel" },
          h("div", { class: "adv-panel-t" }, "Mang theo sẵn"),
          h("div", { class: "adv-kit-grid" }, ...book.kit.items.map((it) => h("div", { class: "adv-kit-it fr-slot" }, iconEl(itemIcon(it.gain, it.type), 2), h("span", null, itemLabel(book, it)))))) : null,
        book.kit.gold.random ? h("div", { class: "adv-card fr-panel" },
          h("div", { class: "adv-panel-t" }, ui("gold", 2), "Vương Miện Vàng"),
          r.gold < 0
            ? h("div", { class: "adv-roll-row" }, goldWheel, gameBtn("Bốc số", async (e) => { (e.currentTarget as HTMLButtonElement).disabled = true; r.gold = await wheelRoll(goldWheel); await sleep(350); rerender(); }, { kind: "gold", icon: "dice" }))
            : h("div", { class: "adv-gold-res" }, ui("gold", 3), h("b", { class: "adv-big-n" }, `+${r.gold + book.kit.gold.add}`), h("span", null, `Vương Miện Vàng${extraNote}`))) : null,
        ...book.kit.picks.map((p, i) => {
          if (p.mode === "random") {
            const w = h("div", { class: "adv-wheel-box" });
            return h("div", { class: "adv-card fr-panel" },
              h("div", { class: "adv-panel-t" }, ui("dice", 2), "Tìm được trong đống đổ nát"),
              picks[i].length
                ? h("div", { class: "adv-found fr-parch" }, optLabel(book, p.options[picks[i][0]]))
                : h("div", { class: "adv-roll-row" }, w, gameBtn("Bốc số", async (e) => { (e.currentTarget as HTMLButtonElement).disabled = true; picks[i] = [await wheelRoll(w)]; await sleep(350); rerender(); }, { kind: "gold", icon: "dice" })));
          }
          return h("div", { class: "adv-card fr-panel" },
            h("div", { class: "adv-panel-t" }, ui("backpack", 2), `Chọn ${p.count} món`, h("span", { class: "adv-count" }, `${picks[i].length}/${p.count}`)),
            h("div", { class: "adv-opt-grid" }, ...p.options.map((o, j) => h("button", { class: `adv-opt ${picks[i].includes(j) ? "fr-sel on" : "fr-btn"}`, type: "button", onclick: () => {
              const k = picks[i].indexOf(j);
              if (k >= 0) picks[i].splice(k, 1); else if (picks[i].length < p.count) picks[i].push(j); else { toast(`Chỉ chọn được ${p.count} món.`); return; }
              sfx("click"); rerender();
            } }, optLabel(book, o)))));
        })));
    };
  }

  const kitOk = (book: Book, r: { gold: number }, picks: number[][], exact: boolean) => (!book.kit.gold.random || r.gold >= 0)
    && book.kit.picks.every((p, i) => (p.mode === "random" ? picks[i].length === 1 : exact ? picks[i].length === p.count : true));

  function discCard(book: Book, d: Disc, on: boolean, f: () => void) {
    return h("button", { class: `adv-disc ${on ? "fr-sel on" : "fr-btn"}`, type: "button", onclick: f },
      h("span", { class: "adv-disc-ic" }, iconEl(discIcon(d), 2)),
      h("span", { class: "adv-disc-t" }, h("b", null, book.names.disc[d] ?? d), book.names.discDesc?.[d] ? h("small", null, book.names.discDesc[d]) : null),
      on ? h("span", { class: "adv-check" }) : null);
  }

  function carryOver(book: Book, slot: number, entry: BookEntry, prev: AdvState) {
    const discs = discsOf(book).filter((d) => !prev.disciplines.includes(d));
    let newDisc: Disc | undefined;
    const r = { gold: -1, ws: -1 };
    const picks: number[][] = book.kit.picks.map(() => []);
    const wiz = wizard("Mang nhân vật sang", book, () => void startNew(book, slot, entry), [
      {
        name: "Kỹ năng",
        draw: (box) => {
          const wsBox = h("div", { class: "adv-wheel-box" });
          box.append(...nn(
            h("div", { class: "adv-hero-row" }, h("span", { class: "adv-medal fr-panel" }, heroFace(prev.weapons[0], 3)),
              h("div", null, h("h2", { class: "adv-h2" }, prev.name), h("p", { class: "adv-lead" }, discs.length ? "tiếp tục hành trình và học thêm 1 kỹ năng mới." : "đã thông thạo mọi kỹ năng."))),
            h("div", { class: "adv-disc-grid" }, ...discs.map((d) => discCard(book, d, newDisc === d, () => { newDisc = d; sfx("click"); wiz.redraw(); }))),
            newDisc === "weaponskill" ? h("div", { class: "adv-card fr-panel" }, h("div", { class: "adv-panel-t" }, "Vũ khí sở trường"),
              r.ws < 0
                ? h("div", { class: "adv-roll-row" }, wsBox, gameBtn("Bốc số", async (e) => { (e.currentTarget as HTMLButtonElement).disabled = true; r.ws = await wheelRoll(wsBox); await sleep(350); wiz.redraw(); }, { kind: "gold", icon: "dice" }))
                : h("div", { class: "adv-found fr-parch" }, h("span", { class: "adv-item-l" }, iconEl(itemIcon(book.weaponskill[r.ws], "weapon"), 2), h("b", null, itemName(book, book.weaponskill[r.ws]))))) : null));
        },
        ok: () => (discs.length === 0 || !!newDisc) && (newDisc !== "weaponskill" || r.ws >= 0),
      },
      { name: "Hành trang", draw: kitStep(book, r, picks, " (tối đa 50)"), ok: () => kitOk(book, r, picks, false) },
    ], async () => {
      const s = continueRun(book, prev, { newDisc, picks, goldRoll: Math.max(0, r.gold), weaponskillRoll: r.ws });
      saves!.save(slot, s, true);
      if (book.intro.length) await introScreen(book);
      play(book, slot, s, entry);
    }, "Lên đường");
  }

  function create(book: Book, slot: number, entry: BookEntry) {
    const discs = discsOf(book);
    const chosen = new Set<Disc>();
    const r = { cs: -1, ep: -1, gold: -1, ws: -1 };
    const picks: number[][] = book.kit.picks.map(() => []);
    const mastered = new Set<string>();
    const name = h("input", { class: "adv-input fr-slot", maxlength: "24", value: book.rules === "neworder" ? "" : "Lone Wolf", placeholder: "Tên Kai của bạn", enterkeyhint: "done", autocomplete: "off" }) as HTMLInputElement;
    const wsDisc = profile(book).weapon.disc;

    const statCard = (label: string, icon: UiIcon, plus: number, key: "cs" | "ep") => {
      const wheel = h("div", { class: "adv-wheel-box" });
      const val = h("b", { class: "adv-stat-n" }, r[key] < 0 ? "?" : String(r[key] + plus));
      const btn = gameBtn("Bốc số", async () => {
        btn.disabled = true;
        const n = await wheelRoll(wheel);
        r[key] = n;
        val.textContent = String(n + plus);
        bump(val, "pop");
        sfx("levelup");
        wiz.redraw();
      }, { kind: "gold", icon: "dice" });
      if (r[key] >= 0) btn.remove();
      return h("div", { class: `adv-stat fr-panel ${key}` },
        h("div", { class: "adv-stat-h" }, ui(icon, 2), h("span", null, label)),
        h("div", { class: "adv-stat-v" }, val, h("small", null, r[key] < 0 ? `số ngẫu nhiên + ${plus}` : `${r[key]} + ${plus}`)),
        r[key] < 0 ? wheel : null, r[key] < 0 ? btn : null);
    };

    const wiz = wizard("Tạo nhân vật", book, () => void openBook(entry), [
      {
        name: "Người hùng",
        draw: (box) => {
          name.oninput = () => wiz.redraw();
          box.append(
            h("div", { class: "adv-hero-row" }, h("span", { class: "adv-medal fr-panel" }, heroFace(undefined, 3)),
              h("label", { class: "adv-field" }, h("span", null, "Tên nhân vật"), name)),
            h("p", { class: "adv-lead" }, "Bốc số để định sức mạnh của bạn. Số ngẫu nhiên từ 0 đến 9."),
            h("div", { class: "adv-stats-row" }, statCard("Kỹ Năng Chiến Đấu", "cs", 10, "cs"), statCard("Sức Bền", "ep", 20, "ep")));
        },
        ok: () => r.cs >= 0 && r.ep >= 0 && name.value.trim().length > 0,
      },
      {
        name: "Kỹ năng",
        draw: (box) => {
          const wsBox = h("div", { class: "adv-wheel-box" });
          box.append(...nn(
            h("div", { class: "adv-step-h" }, h("p", { class: "adv-lead" }, `Chọn ${book.discCount} kỹ năng Kai.`), h("span", { class: `adv-count big ${chosen.size === book.discCount ? "full" : ""}` }, `${chosen.size}/${book.discCount}`)),
            h("div", { class: "adv-disc-grid" }, ...discs.map((d) => discCard(book, d, chosen.has(d), () => {
              if (chosen.has(d)) chosen.delete(d); else if (chosen.size < book.discCount) chosen.add(d); else { toast(`Chỉ chọn được ${book.discCount} kỹ năng.`); return; }
              sfx("click"); wiz.redraw();
              // the extra choice a discipline brings (weapon roll / mastery) appears below: bring it into view
              if (chosen.has(d) && (d === "weaponskill" || d === wsDisc)) requestAnimationFrame(() => {
                const card = el.querySelector<HTMLElement>(".adv-ws"), sc = card?.closest<HTMLElement>(".adv-menu-scroll");
                if (card && sc) sc.scrollTo({ top: Math.max(0, card.offsetTop + card.offsetHeight - sc.clientHeight + 16), behavior: reduced() ? "auto" : "smooth" });
              });
            }))),
            chosen.has("weaponskill") ? h("div", { class: "adv-card fr-panel adv-ws" }, h("div", { class: "adv-panel-t" }, ui("weapons", 2), `${book.names.disc.weaponskill}: vũ khí sở trường`),
              r.ws < 0
                ? h("div", { class: "adv-roll-row" }, wsBox, gameBtn("Bốc số", async (e) => { (e.currentTarget as HTMLButtonElement).disabled = true; r.ws = await wheelRoll(wsBox); await sleep(350); wiz.redraw(); }, { kind: "gold", icon: "dice" }))
                : h("div", { class: "adv-found fr-parch" }, h("span", { class: "adv-item-l" }, iconEl(itemIcon(book.weaponskill[r.ws], "weapon"), 2), h("b", null, itemName(book, book.weaponskill[r.ws]))))) : null,
            wsDisc !== "weaponskill" && chosen.has(wsDisc) ? h("div", { class: "adv-card fr-panel adv-ws" },
              h("div", { class: "adv-panel-t" }, ui("weapons", 2), `${book.names.disc[wsDisc]}: vũ khí thành thạo`, h("span", { class: "adv-count" }, `${mastered.size}/3`)),
              h("div", { class: "adv-opt-grid" }, ...[...new Set(book.weaponskill)].map((w) => h("button", { class: `adv-opt ${mastered.has(w) ? "fr-sel on" : "fr-btn"}`, type: "button", onclick: () => { if (mastered.has(w)) mastered.delete(w); else if (mastered.size < 3) mastered.add(w); sfx("click"); wiz.redraw(); } },
                h("span", { class: "adv-item-l" }, iconEl(itemIcon(w, "weapon"), 2), h("b", null, itemName(book, w))))))) : null));
        },
        ok: () => chosen.size === book.discCount && (!chosen.has("weaponskill") || r.ws >= 0),
      },
      { name: "Hành trang", draw: kitStep(book, r, picks), ok: () => kitOk(book, r, picks, true) },
    ], async () => {
      const s = newRun(book, { name: name.value.trim(), csRoll: r.cs, epRoll: r.ep, disciplines: [...chosen], weaponskillRoll: r.ws, mastered: [...mastered], goldRoll: Math.max(0, r.gold), picks });
      saves!.save(slot, s, true);
      if (book.intro.length) await introScreen(book);
      play(book, slot, s, entry);
    }, "Bắt đầu");
  }

  function introScreen(book: Book): Promise<void> {
    return new Promise((res) => {
      const bg = h("div", { class: "adv-menu-bg dim" });
      const text = h("div", { class: "adv-intro-text" }, ...book.intro.map((p, i) => h("p", { style: `--i:${i}` }, p)));
      show(h("div", { class: "adv-menu adv-intro" }, bg,
        h("div", { class: "adv-menu-scroll" }, h("div", { class: "adv-menu-inner narrow" },
          h("div", { class: "adv-scroll-card fr-parch" }, h("h2", null, "Chuyện đã qua…"), text))),
        h("div", { class: "adv-dock-bar single" }, gameBtn("Lên đường", () => { sfx("transition"); res(); }, { kind: "gold" }))));
      backdrop(bg, startSpec(book, "sad"), [], undefined, { minVis: 0.5 });
    });
  }

  // ---------------------------------------------------------------- the story
  function play(book: Book, slot: number, s0: AdvState, entry: BookEntry) {
    clearStage();
    playMusic("title");
    let s = s0;
    let stage: Stage | null = null;
    let fit: StageFit | null = null;
    let explore: ExploreView | null = null;
    /** Side of the place the hero walks in from (the opposite of the exit taken). */
    let entrySide: Side | undefined;
    let exploring = false;
    let shownSection = "";
    const noExplore = new Set<string>();
    const save = (now = false) => saves!.save(slot, s, now);
    const heroLook = (): Look => withWeapon("lonewolf", s.weapons[0]);
    const killScene = () => { explore?.destroy(); explore = null; fit?.destroy(); fit = null; stage?.destroy(); stage = null; };
    cleanups.push(killScene);

    // --- HUD
    const epFill = h("i");
    const epText = h("b");
    const epEl = h("div", { class: "adv-ep fr-chip" }, ui("ep", 2), h("div", { class: "adv-ep-track" }, epFill), epText);
    const chip = (icon: UiIcon, label: string) => { const v = h("b"); const c = h("span", { class: "adv-chip fr-chip", title: label }, ui(icon, 2), v); return { c, v }; };
    const csC = chip("cs", "Kỹ Năng Chiến Đấu"), goldC = chip("gold", "Vương Miện Vàng"), mealC = chip("meal", "Phần Ăn");
    const leave = async () => { await saves!.flush(); void openBook(entry); };
    const hud = h("div", { class: "adv-hud" },
      iconBtn("back", "Về ô lưu", () => void leave()),
      h("div", { class: "adv-hud-stats" }, epEl, h("div", { class: "adv-chips" }, csC.c, goldC.c, mealC.c)),
      h("div", { class: "adv-hud-r" }, ...nn(book.map ? iconBtn("map", "Bản đồ", () => openMap()) : null, iconBtn("backpack", "Hành trang", () => chart()))));

    // --- scene
    const sceneBox = h("div", { class: "adv-scene" });
    const place = h("div", { class: "adv-place" });
    const endBanner = h("div", { class: "adv-endban" });
    const sceneWrap = h("div", { class: "adv-scene-wrap" }, sceneBox, h("div", { class: "adv-scene-shade" }), place, endBanner, hud);

    // --- story sheet
    const secBadge = h("span", { class: "adv-secnum" });
    const placeSmall = h("span", { class: "adv-sheet-place" });
    const grip = h("div", { class: "adv-grip", role: "button", tabindex: "0", "aria-label": "Mở rộng / thu gọn" },
      h("span", { class: "adv-grip-bar" }), h("div", { class: "adv-sheet-head" }, secBadge, placeSmall, h("span", { class: "adv-grip-chev" })));
    const text = h("div", { class: "adv-text" });
    const body = h("div", { class: "adv-sheet-body" }, text);
    const dock = h("div", { class: "adv-dock" });
    const sheet = h("section", { class: "adv-sheet fr-panel" }, grip, body, dock);
    const pops = h("div", { class: "adv-pops", "aria-live": "polite" });
    const view = h("div", { class: "adv-play", "data-sheet": "half" }, sceneWrap, sheet, pops);
    el.replaceChildren(view);

    type SheetState = "min" | "half" | "full";
    const order: SheetState[] = ["min", "half", "full"];
    function setSheet(st: SheetState) {
      if (view.dataset.sheet === st) return;
      view.dataset.sheet = st;
      sfx("click");
      explore?.pause(st === "full");
    }
    // drag / tap the handle
    let drag: { y: number; id: number } | null = null;
    grip.addEventListener("pointerdown", (e) => { drag = { y: e.clientY, id: e.pointerId }; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      drag = null;
      const i = order.indexOf(view.dataset.sheet as SheetState);
      if (dy < -30) setSheet(order[Math.min(2, i + 1)]);
      else if (dy > 30) setSheet(order[Math.max(0, i - 1)]);
      else setSheet(view.dataset.sheet === "full" ? "half" : view.dataset.sheet === "min" ? "half" : "full");
    });
    grip.addEventListener("pointercancel", () => { drag = null; });
    grip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheet(view.dataset.sheet === "full" ? "half" : "full"); } });
    sceneBox.addEventListener("click", () => { if (!exploring) setSheet(view.dataset.sheet === "min" ? "half" : "min"); });
    // tap the text to show it all at once
    body.addEventListener("pointerdown", () => view.classList.add("shown"));

    // number keys pick choices on a keyboard
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".adv-win-back, .adv-fight, .adv-cine, .adv-travel")) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const b = dock.querySelectorAll<HTMLButtonElement>(".adv-choice:not(:disabled)")[n - 1];
        b?.click();
      }
    };
    document.addEventListener("keydown", onKey);
    cleanups.push(() => document.removeEventListener("keydown", onKey));

    const placeOf = (sid: string) => (book.map ? mapPlace(book.map, book.sections[sid].scene.place) : book.sections[sid].scene.place);
    const placeName = (p: string) => book.places?.[p]?.name ?? p.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const visitedPlaces = () => new Set(s.visited.map(placeOf));

    const showChanges = (ch: Change[]) => {
      ch.forEach((c, i) => setTimeout(() => {
        const icon = c.item ? iconEl(itemIcon(c.item), 2) : ui(c.kind === "ep" ? "ep" : c.kind === "cs" ? "cs" : c.kind === "gold" ? "gold" : c.kind === "meal" ? "meal" : "backpack", 2);
        const p = h("div", { class: `adv-pop fr-chip ${c.good ? "good" : "bad"}` }, h("span", { class: "adv-pop-ic" }, icon), h("span", null, c.label));
        pops.append(p);
        sfx(c.kind === "gold" ? "coin" : c.kind === "item" ? (c.good ? "pickup" : "debuff") : c.good ? "heal" : "hit");
        setTimeout(() => p.remove(), 2800);
      }, i * 320));
    };

    let last: { ep: number; cs: number; gold: number; meals: number } | null = null;
    function renderChips() {
      const max = epMax(book, s);
      const pct = Math.max(0, Math.min(100, (100 * s.ep) / max));
      epFill.style.width = `${pct}%`;
      epEl.classList.toggle("low", pct <= 30);
      countTo(epText, s.ep, (n) => `${n}/${max}`);
      countTo(csC.v, s.cs);
      countTo(goldC.v, s.gold);
      countTo(mealC.v, s.meals);
      if (last) {
        if (s.ep < last.ep) { bump(epEl, "hit"); bump(sceneWrap, "hurt"); } else if (s.ep > last.ep) bump(epEl, "heal");
        if (s.cs !== last.cs) bump(csC.c, s.cs > last.cs ? "up" : "hit");
        if (s.gold !== last.gold) bump(goldC.c, s.gold > last.gold ? "up" : "hit");
        if (s.meals !== last.meals) bump(mealC.c, s.meals > last.meals ? "up" : "hit");
      }
      last = { ep: s.ep, cs: s.cs, gold: s.gold, meals: s.meals };
    }

    /** Moves to a section: map travel when the place changes, a cutscene for big moments. */
    async function goTo(to: string, extra: Change[] = []) {
      const from = s.section;
      const ch = [...extra, ...enter(book, s, to)];
      save();
      const pa = placeOf(from), pb = placeOf(to);
      if (book.map && pa !== pb && book.map.nodes[pb]) await travel(pa, pb);
      if (!alive || !view.isConnected) return;
      const sec = book.sections[to];
      if (sec.scene.cutscene && s.visited.filter((x) => x === to).length <= 1 && !s.flags[`cut:${to}`]) {
        s.flags[`cut:${to}`] = true;
        save();
        explore?.pause(true);
        await playCutscene(el, book, to, heroLook());
      }
      if (!alive || !view.isConnected) return;
      render(from);
      showChanges(ch);
    }

    function travel(from: string, to: string): Promise<void> {
      const v = visitedPlaces();
      v.add(from);
      const wrap = h("div", { class: "adv-travel" });
      const mv = new WorldMapView({ key: book.id, map: book.map!, visited: v, here: from, label: placeName });
      const label = h("div", { class: "adv-travel-label fr-panel" }, h("small", null, "Đang đi tới"), h("b", null, placeName(to)));
      wrap.append(mv.el, h("div", { class: "adv-travel-vig" }), label);
      el.append(wrap);
      sfx("step");
      return (async () => {
        await sleep(500);
        await mv.travel(to);
        v.add(to);
        mv.setVisited(v, to);
        await sleep(900);
        wrap.classList.add("out");
        await sleep(300);
        mv.destroy();
        wrap.remove();
      })();
    }

    function openMap() {
      let mv: WorldMapView | null = null;
      const w = advWindow(el, "Bản đồ", { cls: "map", icon: "map", onClose: () => mv?.destroy() });
      const v = visitedPlaces();
      const here = placeOf(s.section);
      const info = h("div", { class: "adv-map-info fr-parch" });
      const setInfo = (p: string) => info.replaceChildren(h("b", null, placeName(p), p === here ? h("span", { class: "adv-here" }, "Bạn ở đây") : null), h("span", null, book.places?.[p]?.desc ?? ""));
      setInfo(here);
      mv = new WorldMapView({ key: book.id, map: book.map!, visited: v, here, label: placeName, onTapPlace: setInfo });
      const m = mv;
      w.body.append(h("div", { class: "adv-map-box" }, m.el,
        h("div", { class: "adv-map-zoom" }, gameBtn("+", () => m.zoomBy(1), { cls: "sq" }), gameBtn("−", () => m.zoomBy(-1), { cls: "sq" }))), info);
    }

    /** The scene: a Stage, or the walkable explore view when the section is one and the module exists. */
    /** The section's walkable spots when it plays in explore mode (null: a static scene). */
    function exploreSpots() {
      const sec = book.sections[s.section];
      if (!sec.scene.explore || noExplore.has(s.section) || s.ended || pendingLoss(s) || phase(book, s) !== "choices") return null;
      const list = visibleChoices(sec, s);
      const spots: { key: number; label: string; via: NonNullable<Choice["via"]>; locked?: string }[] = [];
      list.forEach((c, i) => {
        const cs = choiceState(s, c);
        if (cs === "hidden" || !c.via) return;
        spots.push({ key: i, label: c.text, via: c.via, locked: cs === "locked" ? condText(book, c.if) : undefined });
      });
      return spots.length ? { list, spots } : null;
    }

    function mountScene() {
      const sec = book.sections[s.section];
      killScene();
      sceneBox.replaceChildren();
      sceneBox.classList.toggle("dead", s.ended === "death");
      sceneBox.classList.toggle("won", s.ended === "victory");
      const ex = exploreSpots();
      exploring = !!ex;
      sceneBox.classList.toggle("explore", exploring);
      view.classList.toggle("exploring", exploring);
      if (ex) {
        const sid = s.section, steps = s.steps;
        const entryFrom = entrySide;
        sceneBox.append(h("div", { class: "adv-loading" }, h("div", { class: "adv-spinner" })));
        void import("./explore").then((mod) => {
          if (s.section !== sid || s.steps !== steps || !view.isConnected || !alive || explore) return;
          sceneBox.replaceChildren();
          explore = mod.mountExplore({
            host: sceneBox, seed: `${book.id}-${sec.scene.place}`, scene: sec.scene, heroLook: heroLook(), entryFrom, spots: ex.spots,
            onPick: (key) => { const c = ex.list[key]; if (c && choiceState(s, c) === "ok" && s.section === sid) pick(c); },
          });
        }).catch(() => {
          // explore failed to load: play the section with a static scene and plain buttons
          if (s.section !== sid || !view.isConnected) return;
          noExplore.add(sid);
          render();
        });
        return;
      }
      const spec: SceneSpec = { bg: sec.scene.bg, time: sec.scene.time, weather: sec.scene.weather, mood: sec.scene.mood, seed: `${book.id}-${s.section}` };
      const st = new Stage(spec);
      st.cast(sec.scene.actors.length ? sec.scene.actors : ["lonewolf"], heroLook());
      stage = st;
      fit = new StageFit(sceneBox, st, { minVis: 0.56, anchorY: 0.8 });
    }

    function render(_from?: string) {
      renderChips();
      const sec = book.sections[s.section];
      mountScene();
      view.classList.remove("shown", "ended", "won", "dead");
      // a new section opens the story at its usual size
      if (view.dataset.sheet === "min" || shownSection !== s.section) view.dataset.sheet = "half";
      shownSection = s.section;
      const pn = placeName(placeOf(s.section));
      place.replaceChildren(h("span", null, pn));
      bump(place, "in");
      secBadge.textContent = `Đoạn ${s.section}`;
      placeSmall.textContent = pn;
      const paras = sec.text.map((t, i) => h("p", { class: "adv-para", style: `--i:${i}` }, t));
      text.replaceChildren(...nn(...paras, sec.note ? h("div", { class: "adv-note fr-parch" }, ui("info", 2), h("span", null, sec.note)) : null));
      body.scrollTop = 0;
      // loot sits in the action dock, in reach of the thumb, above what to do next
      const loot = offersBox();
      dock.replaceChildren(...nn(loot));
      dock.style.setProperty("--d", `${Math.min(1.2, paras.length * 0.16 + 0.1)}s`);
      const ph = phase(book, s);
      if (ph === "end") return endPanel();
      if (ph === "combat") {
        const c = sec.combat!;
        dock.append(
          h("div", { class: "adv-foes" }, ...c.foes.map((f) => h("div", { class: "adv-foe fr-foe" }, h("b", null, f.name), h("span", null, ui("cs", 1), String(f.cs), ui("ep", 1), String(f.ep))))),
          gameBtn("Vào trận", () => void fight(), { kind: "red", icon: "cs", cls: "block big" }));
        return;
      }
      if (pendingLoss(s)) { dock.append(h("p", { class: "adv-dock-note" }, ui("info", 1), "Hãy chọn món đồ phải bỏ lại trước khi đi tiếp.")); return; }
      if (ph === "random") {
        const wheel = h("div", { class: "adv-wheel-box" });
        const rollBtn = gameBtn("Bốc số ngẫu nhiên", async () => {
          rollBtn.remove();
          view.classList.add("shown");
          const n = await wheelRoll(wheel);
          const res = randomResult(book, sec, s, n);
          const extra = res.fx ? apply(book, s, res.fx) : [];
          if (res.end) { s.ended = res.end; save(true); showChanges(extra); renderChips(); }
          dock.append(h("div", { class: "adv-roll fr-chip" }, `Số ${n}${res.add ? ` ${res.add > 0 ? "+" : ""}${res.add} = ${res.value}` : ""}`),
            gameBtn("Tiếp tục", () => (res.end ? render() : void goTo(res.to, extra)), { kind: "gold", cls: "block big" }));
          save();
        }, { kind: "gold", icon: "dice", cls: "block big" });
        dock.append(wheel, rollBtn);
        return;
      }
      let k = 0;
      for (const c of visibleChoices(sec, s)) {
        const st = choiceState(s, c);
        if (st === "hidden") continue;
        if (exploring && c.via) continue;
        k++;
        dock.append(h("button", { class: `adv-choice ${st === "locked" ? "locked fr-slot" : "fr-btn"}`, type: "button", disabled: st === "locked", style: `--j:${k}`, onclick: () => { sfx("click"); pick(c); } },
          h("span", { class: "adv-choice-k" }, st === "locked" ? ui("lock", 1) : String(k)),
          h("span", { class: "adv-choice-t" }, c.text, st === "locked" ? h("small", null, condText(book, c.if)) : null)));
      }
      if (exploring) dock.prepend(h("p", { class: "adv-dock-note" }, ui("map", 1), k ? "Đi tới các lối ra trong cảnh, hoặc:" : "Đi tới một lối ra hoặc một người trong cảnh để chọn hướng."));
    }

    /** A choice: pay its price / apply its effects, then go (or stay, for repeatable purchases). */
    function pick(c: Choice) {
      entrySide = c.via?.exit ? OPPOSITE[c.via.exit] : undefined;
      const ch = c.fx ? apply(book, s, c.fx) : [];
      if (c.repeat) { save(); render(); showChanges(ch); return; }
      void goTo(c.to, ch);
    }

    function offersBox() {
      if (!s.offers.length) return null;
      const cards = s.offers.map((o: Offer, i) => {
        const take = (id?: string) => { showChanges(takeOffer(book, s, i, id)); save(); render(); };
        if ("gold" in o) return h("div", { class: "adv-loot fr-parch" }, h("span", { class: "adv-loot-ic" }, ui("gold", 2)), h("div", { class: "adv-loot-t" }, h("b", null, `${o.gold} Vương Miện Vàng`)), gameBtn("Nhặt", () => take(), { kind: "gold", cls: "small" }));
        if ("loseChoice" in o) {
          const pool = o.loseChoice === "weapon" ? s.weapons : o.loseChoice === "backpack" ? [...s.backpack, ...(s.meals ? ["Meal"] : [])] : [...s.weapons, ...s.backpack, ...(s.meals ? ["Meal"] : [])];
          if (!pool.length) { s.offers.splice(i, 1); return null; }
          return h("div", { class: "adv-loot lose fr-parch" },
            h("div", { class: "adv-loot-h" }, ui("skull", 2), h("b", null, `Phải bỏ lại ${o.n} món${o.loseChoice === "weapon" ? " vũ khí" : o.loseChoice === "backpack" ? " trong Ba Lô" : ""}`)),
            h("div", { class: "adv-opt-grid" }, ...[...new Set(pool)].map((id) => h("button", { class: "adv-opt fr-btn", type: "button", onclick: () => { sfx("debuff"); take(id); } }, h("span", { class: "adv-item-l" }, iconEl(itemIcon(id), 2), h("b", null, itemName(book, id)))))));
        }
        const full = o.type !== "special" && (o.type === "weapon" ? s.weapons.length >= 2 : s.backpack.length + s.meals >= 8);
        return h("div", { class: "adv-loot fr-parch" }, h("span", { class: "adv-loot-ic" }, iconEl(itemIcon(o.gain, o.type), 2)),
          h("div", { class: "adv-loot-t" }, h("b", null, itemLabel(book, o)), o.desc ? h("small", null, o.desc) : null, full ? h("small", { class: "bad" }, o.type === "weapon" ? "Đã mang đủ 2 vũ khí: bỏ bớt trong Hành trang" : "Ba Lô đã đầy: bỏ bớt trong Hành trang") : null),
          gameBtn("Nhặt", () => take(), { kind: "gold", cls: "small", disabled: full }));
      }).filter(Boolean) as HTMLElement[];
      return cards.length ? h("div", { class: "adv-loots" }, h("div", { class: "adv-loots-t" }, ui("backpack", 1), "Tìm thấy"), ...cards) : null;
    }

    async function fight() {
      explore?.pause(true);
      const res = await runFight(el, book, s, () => { renderChips(); save(); });
      save(true);
      if (!view.isConnected) return;
      if (res.exit === null) return render();
      if (res.exit) return goTo(res.exit);
      render();
    }

    function endPanel() {
      const win = s.ended === "victory";
      sfx(win ? "victory" : "defeat");
      save(true);
      view.classList.add("ended", win ? "won" : "dead");
      endBanner.replaceChildren(h("div", { class: `adv-endban-box ${win ? "win" : "dead"}` },
        win ? ui("trophy", 4) : ui("skull", 4),
        h("div", { class: "adv-endban-t" }, win ? "Hoàn thành nhiệm vụ" : "Hành trình kết thúc"),
        h("div", { class: "adv-endban-s" }, win ? `${s.name} đã đi đến cuối cuốn sách` : `${s.name} đã gục ngã ở đoạn ${s.section}`)));
      bump(endBanner, "in");
      dock.append(h("div", { class: "adv-end-stats" },
        h("span", { class: "fr-chip" }, ui("book", 1), `${s.steps} bước`),
        h("span", { class: "fr-chip" }, ui("map", 1), `${new Set(s.visited).size} đoạn`),
        h("span", { class: "fr-chip" }, ui("gold", 1), `${s.gold}`)),
        h("div", { class: "adv-end-btns" }, ...nn(
          !win && s.back ? gameBtn("Thử lại đoạn này", () => { const r = retry(s); if (r) { s = r; save(true); last = null; render(); } }, { kind: "gold", cls: "block big", icon: "heal" }) : null,
          h("div", { class: "adv-row-btns" },
            gameBtn("Chơi lại từ đầu", () => create(book, slot, entry)),
            gameBtn("Về ô lưu", async () => { await saves!.flush(); void openBook(entry); })))));
    }

    function chart() {
      let sel: { id: string; type: string } | null = null;
      const w = advWindow(el, s.name, { cls: "chart", icon: "backpack" });
      const draw = () => {
        const max = epMax(book, s);
        const detail = h("div", { class: "adv-detail fr-parch" });
        const slotEl = (id: string | null, type: string, extra?: string) => {
          if (!id) return h("div", { class: "adv-cell fr-slot empty" });
          const on = sel?.id === id && sel.type === type;
          return h("button", { class: `adv-cell ${on ? "fr-sel on" : "fr-slot"}`, type: "button", title: itemName(book, id), onclick: () => { sel = on ? null : { id, type }; sfx("click"); draw(); } },
            iconEl(itemIcon(id, type as never), 2), extra ? h("span", { class: "adv-cell-n" }, extra) : null);
        };
        const weapons = [0, 1].map((i) => slotEl(s.weapons[i] ?? null, "weapon"));
        const bag: HTMLElement[] = [];
        for (let i = 0; i < s.meals; i++) bag.push(slotEl("Meal", "meal", i === 0 && s.meals > 1 ? `×${s.meals}` : undefined));
        for (const id of s.backpack) bag.push(slotEl(id, "backpack"));
        while (bag.length < 8) bag.push(slotEl(null, "backpack"));
        const specials = s.special.map((id) => slotEl(id, "special"));
        while (specials.length < 4 || specials.length % 4) specials.push(slotEl(null, "special"));

        if (sel) {
          const { id, type } = sel;
          const def = book.items[id];
          const canUse = type === "backpack" && def?.heal && !s.ended;
          detail.append(h("span", { class: "adv-detail-ic fr-slot" }, iconEl(itemIcon(id, type as never), 3)),
            h("div", { class: "adv-detail-t" }, h("b", null, type === "meal" ? `Phần Ăn ×${s.meals}` : itemName(book, id)),
              h("small", null, type === "meal" ? "Mỗi Phần Ăn chiếm một chỗ trong Ba Lô. Chỉ ăn khi sách yêu cầu." : def?.desc ?? (type === "weapon" ? "Vũ khí" : type === "special" ? "Vật Phẩm Đặc Biệt" : "Đồ trong Ba Lô"))),
            h("div", { class: "adv-detail-b" }, ...nn(
              canUse ? gameBtn("Dùng", () => { showChanges(useItem(book, s, id)); save(); renderChips(); if (!s.backpack.includes(id)) sel = null; draw(); }, { kind: "gold", cls: "small", disabled: s.ep >= max, icon: "heal" }) : null,
              s.ended ? null : gameBtn(type === "meal" ? "Bỏ 1" : "Bỏ", async () => {
                if (type !== "meal" && !(await confirm("Bỏ đồ", `Bỏ ${itemName(book, id)} lại? Không lấy lại được.`, "Bỏ"))) return;
                drop(book, s, id); save(); renderChips();
                if (type !== "meal" || !s.meals) sel = null;
                draw(); render();
              }, { cls: "small" }))));
        } else detail.append(h("span", { class: "adv-detail-hint" }, "Chạm vào một món đồ để xem và dùng."));

        const tile = (icon: UiIcon, label: string, val: string, extra?: Node | null) => h("div", { class: "adv-tile fr-slot" }, ui(icon, 2), h("span", null, label), h("b", null, val), extra ?? null);
        w.body.replaceChildren(...nn(
          h("div", { class: "adv-chart-hero" }, h("span", { class: "adv-medal fr-panel" }, heroFace(s.weapons[0], 2)),
            h("div", { class: "adv-tiles" },
              tile("cs", "Chiến Đấu", String(s.cs)),
              tile("ep", "Sức Bền", `${s.ep}/${max}`, h("i", { class: "adv-tile-bar", style: `--p:${Math.max(0, Math.min(100, (100 * s.ep) / max))}%` })),
              tile("gold", "Vàng", `${s.gold}/50`),
              s.arrows ? tile("arrows", "Mũi tên", String(s.arrows)) : tile("meal", "Phần Ăn", String(s.meals)))),
          h("div", { class: "adv-inv" },
            h("div", { class: "adv-inv-sec w" }, h("div", { class: "adv-inv-t" }, ui("weapons", 1), "Vũ khí", h("span", null, `${s.weapons.length}/2`)), h("div", { class: "adv-grid two" }, ...weapons)),
            h("div", { class: "adv-inv-sec b" }, h("div", { class: "adv-inv-t" }, ui("backpack", 1), "Ba Lô", h("span", null, `${s.backpack.length + s.meals}/8`)), h("div", { class: "adv-grid" }, ...bag)),
            h("div", { class: "adv-inv-sec sp" }, h("div", { class: "adv-inv-t" }, ui("special", 1), "Vật Phẩm Đặc Biệt", h("span", null, String(s.special.length))), h("div", { class: "adv-grid" }, ...specials))),
          detail,
          h("div", { class: "adv-inv-t" }, ui("book", 1), "Kỹ năng Kai"),
          h("div", { class: "adv-discs-own" }, ...s.disciplines.map((d) => h("div", { class: "adv-disc-own fr-slot", title: book.names.discDesc?.[d] ?? "" }, iconEl(discIcon(d), 2), h("span", null, book.names.disc[d] ?? d)))),
          s.weaponskill ? h("p", { class: "adv-small" }, `Vũ khí sở trường: ${itemName(book, s.weaponskill)}`) : null,
          s.mastered?.length ? h("p", { class: "adv-small" }, `Vũ khí thành thạo: ${s.mastered.map((x) => itemName(book, x)).join(", ")}`) : null,
          h("p", { class: "adv-small" }, `Đã qua ${new Set(s.visited).size}/${Object.keys(book.sections).length} đoạn · ${s.steps} bước.`)));
      };
      draw();
    }

    const first = book.sections[s.section];
    if (s.steps <= 1 && first.scene.cutscene && !s.flags[`cut:${s.section}`]) {
      s.flags[`cut:${s.section}`] = true;
      save();
      void playCutscene(el, book, s.section, heroLook()).then(() => { if (view.isConnected) render(); });
    } else render();
  }

  void library();
  return {
    destroy: () => {
      alive = false;
      clearStage();
      void saves?.flush();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      el.remove();
    },
  };
}
