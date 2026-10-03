import { describeSkill, skillCostText, passiveText } from "../combat/describe";
import { ENH_STEP, enhLevel, getItem, type GearKey, type ItemDef } from "../data/items";
import { getPassive } from "../data/passives";
import { getSkill } from "../data/skills";
import { h } from "./dom";
import { itemImg } from "./icon";
import { gearTags, rarityClass, scaleStats } from "./gear";
import { droppedBy, regionSource, usesOf } from "../data/uses";
import { howToGet } from "../world/sources";

/** Monsters the player has met (set by the game once loaded), so drop sources never spoil. */
let dexSource: () => Record<string, unknown> = () => ({});
export const setDexSource = (fn: () => Record<string, unknown>) => { dexSource = fn; };

/**
 * Rich hover cards. Mouse: hover shows the card. Touch: press and hold shows it (the tap
 * that follows is swallowed so the button does not fire), lifting the finger hides it.
 */
let card: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
let timer = 0;

function hide() {
  clearTimeout(timer);
  card?.remove();
  card = null;
  owner = null;
}

function show(el: HTMLElement, build: () => HTMLElement, x?: number, y?: number) {
  hide();
  if (!el.isConnected) return;
  owner = el;
  card = h("div", { class: "tipcard" }, build());
  document.body.append(card);
  const r = el.getBoundingClientRect();
  const cw = card.offsetWidth, chh = card.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x !== undefined ? x + 14 : r.right + 8;
  let top = y !== undefined ? y + 14 : r.top;
  if (left + cw > vw - 6) left = Math.max(6, (x !== undefined ? x - 14 : r.left - 8) - cw);
  if (top + chh > vh - 6) top = Math.max(6, vh - chh - 6);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// a modal re-render or close must never leave a card floating around
new MutationObserver(() => { if (owner && !owner.isConnected) hide(); }).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("scroll", hide, true);

export function tip<T extends HTMLElement>(el: T, build: () => HTMLElement): T {
  el.removeAttribute("title");
  for (const c of el.querySelectorAll("[title]")) c.removeAttribute("title");
  let held = false;
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer);
    timer = window.setTimeout(() => show(el, build, e.clientX, e.clientY), 120);
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || owner !== el || !card) return;
    const cw = card.offsetWidth, chh = card.offsetHeight;
    let left = e.clientX + 14, top = e.clientY + 14;
    if (left + cw > window.innerWidth - 6) left = Math.max(6, e.clientX - 14 - cw);
    if (top + chh > window.innerHeight - 6) top = Math.max(6, window.innerHeight - chh - 6);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  });
  el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") { hide(); return; }
    held = false;
    clearTimeout(timer);
    timer = window.setTimeout(() => { held = true; show(el, build); }, 420);
  });
  const release = () => { clearTimeout(timer); if (held) setTimeout(hide, 1600); };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("contextmenu", (e) => { if (held) e.preventDefault(); });
  // after a long press the finger lifting would "click": swallow it
  el.addEventListener("click", (e) => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return el;
}

// ------------------------------------------------------------ card builders
const STAT_NAMES: Record<string, string> = { hp: "Máu", mp: "MP", atk: "Công", mag: "Phép", def: "Thủ", res: "Kháng", spd: "Tốc", crit: "Chí mạng", eva: "Né" };

function statLines(stats: Record<string, number | undefined>) {
  const rows = Object.entries(stats).filter(([, v]) => v);
  if (!rows.length) return null;
  return h("div", { class: "tip-stats" }, rows.map(([k, v]) => h("div", { class: v! > 0 ? "good" : "bad" }, `${v! > 0 ? "+" : ""}${v} ${STAT_NAMES[k] ?? k}`)));
}

function skillBlock(id: string) {
  const sk = getSkill(id);
  return h("div", { class: "tip-sub" },
    h("div", { class: "tip-name" }, `${sk.icon} ${sk.name}`),
    h("div", { class: "muted small" }, skillCostText(sk)),
    h("div", { class: "tip-desc" }, describeSkill(sk).join(" ")));
}

function passiveBlock(id: string) {
  const p = getPassive(id);
  return h("div", { class: "tip-sub" },
    h("div", { class: "tip-name" }, `${p.icon} ${p.name}`),
    h("div", { class: "tip-desc" }, passiveText(p.desc)));
}

/** Card for any item; enhanced gear ("sword+4") already carries its boosted stats. */
export function itemCard(it: ItemDef, opts: { slot?: GearKey; qty?: number } = {}): HTMLElement {
  const eq = it.equip;
  let stats = eq?.stats;
  if (eq && stats && opts.slot === "offhand" && eq.slot === "weapon") stats = scaleStats(stats, 0.5);
  const enh = enhLevel(it.id);
  return h("div", null,
    h("div", { class: "tip-head" }, h("span", { class: "tip-ico" }, itemImg(it.id)),
      h("div", null,
        h("div", { class: `tip-name ${rarityClass(it)}` }, it.name),
        h("div", { class: "muted small" }, eq ? gearTags(it).join(" · ") : typeLabel(it), opts.qty ? ` · có ${opts.qty}` : ""))),
    stats ? statLines(stats) : null,
    enh ? h("div", { class: "gold small" }, `✨ Cường hoá +${enh}: +${Math.round(ENH_STEP * 100 * enh)}% chỉ số (ít nhất +${enh} mỗi chỉ số)`) : null,
    eq?.passive ? passiveBlock(eq.passive) : null,
    it.skill ? h("div", null, h("div", { class: "muted small" }, "Dạy kỹ năng:"), skillBlock(it.skill)) : null,
    it.passive ? h("div", null, h("div", { class: "muted small" }, "Dạy nội tại:"), passiveBlock(it.passive)) : null,
    it.desc ? h("div", { class: "tip-desc muted" }, it.desc) : null,
    eq ? null : usesBlock(it.id),
    eq ? null : sourceBlock(it.id),
    it.value ? h("div", { class: "muted small" }, `💰 Bán: ${it.value}`) : null);
}

function usesBlock(id: string) {
  const uses = usesOf(id);
  if (!uses.length) return null;
  const shown = uses.slice(0, 6);
  return h("div", { class: "tip-sub" },
    h("div", { class: "tip-label" }, "Dùng để làm"),
    shown.map((u) => h("div", { class: "small" }, `${u.icon} ${u.text}`)),
    uses.length > shown.length ? h("div", { class: "muted small" }, `…và ${uses.length - shown.length} thứ khác`) : null);
}

function sourceBlock(id: string) {
  const { known, unknown } = droppedBy(id, dexSource());
  const region = regionSource(id);
  // grown, bought or made (monster drops are listed below, with their odds)
  const other = howToGet(id).filter((l) => /^(🌱|🛒|⚒️)/u.test(l));
  if (!known.length && !unknown && !region && !other.length) return null;
  return h("div", { class: "tip-sub" },
    h("div", { class: "tip-label" }, "Kiếm ở đâu"),
    other.map((l) => h("div", { class: "small" }, l)),
    known.slice(0, 4).map(({ def, ch }) => h("div", { class: "small" }, `⚔️ ${def.name} — ${Math.max(1, Math.round(ch * 100))}%`)),
    region ? h("div", { class: "small" }, `🗺️ ${region}`) : null,
    unknown ? h("div", { class: "muted small" }, `❔ ${unknown} loài quái chưa gặp cũng rơi ra món này`) : null);
}

function typeLabel(it: ItemDef) {
  return ({
    tome: "Sách", seed: "Hạt giống", sapling: "Cây giống", crop: "Nông sản", food: "Món ăn", potion: "Thuốc", bomb: "Vật ném", herb: "Thảo dược",
    scroll: "Cuộn giấy", fertilizer: "Phân bón", animal: "Vật nuôi", key: "Vật quan trọng", material: "Nguyên liệu",
  } as Record<string, string>)[it.type] ?? "Vật phẩm";
}

export const itemTip = <T extends HTMLElement>(el: T, id: string, opts: { slot?: GearKey; qty?: number } = {}) => tip(el, () => itemCard(getItem(id), opts));
export const skillTip = <T extends HTMLElement>(el: T, id: string) => tip(el, () => skillBlock(id));
export const passiveTip = <T extends HTMLElement>(el: T, id: string) => tip(el, () => passiveBlock(id));
