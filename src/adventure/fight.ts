/** Turn-based battle screen of Adventure. */
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { h, nn, sleep } from "../ui/dom";
import { assetURL, paintScene } from "./art";
import { dieEl, tumble } from "./dice";
import { activeFoes, playRound, startBattle, sum, type Action, type Battle, type BattleEvent } from "./engine";
import type { AdvState, Book, EnemyDef } from "./types";

function foeArt(book: Book, def: EnemyDef): HTMLElement {
  const box = h("div", { class: "adv-foe-art", style: `--foe:${def.color ?? "#c05050"}` }, h("span", { class: "adv-foe-icon" }, def.icon ?? "👹"));
  if (def.img) {
    const img = h("img", { src: assetURL(book, def.img), alt: def.name, draggable: "false" });
    img.onload = () => box.replaceChildren(img);
  }
  return box;
}

function hpBar(v: number, max: number, cls: string) {
  const fill = h("i", { style: `width:${Math.max(0, (100 * v) / max)}%` });
  const label = h("b", null, `${v}/${max}`);
  const el = h("div", { class: `adv-hp ${cls}` }, h("div", { class: "adv-hp-track" }, fill), label);
  return { el, set: (n: number) => { fill.style.width = `${Math.max(0, (100 * n) / max)}%`; label.textContent = `${Math.max(0, n)}/${max}`; } };
}

function floatNum(on: HTMLElement, text: string, cls: string) {
  const f = h("div", { class: `adv-float ${cls}` }, text);
  on.append(f);
  setTimeout(() => f.remove(), 1100);
}

/** Plays the battle of the current section; resolves with the outcome. */
export function runFight(host: HTMLElement, book: Book, s: AdvState, onChange: () => void): Promise<Battle> {
  playMusic("battle");
  sfx("encounter", "normal");
  const sec = book.sections[s.section];
  const b = startBattle(book, sec);
  return new Promise((resolve) => {
    const bg = h("div", { class: "adv-fight-bg" });
    paintScene(bg, book, s.section, sec.img, sec.mood);

    const foeCards = b.foes.map((f, i) => {
      const hp = hpBar(f.hp, f.def.stamina, "foe");
      const dice = [dieEl(1), dieEl(1)];
      const total = h("b", { class: "adv-as" }, "");
      const card = h("button", { class: "adv-foe", type: "button", onclick: () => { if (b.together && f.hp > 0) { b.target = i; render(); } } },
        h("div", { class: "adv-target" }, "🎯"),
        foeArt(book, f.def),
        h("div", { class: "adv-foe-name" }, f.def.name),
        h("div", { class: "adv-foe-stat" }, `⚔️ ${f.def.skill}`),
        hp.el,
        h("div", { class: "adv-dice-row" }, ...dice, total),
      );
      return { card, hp, dice, total };
    });

    const heroHp = hpBar(s.stamina, s.staminaMax, "hero");
    const heroDice = [dieEl(1), dieEl(1)];
    const heroTotal = h("b", { class: "adv-as" }, "");
    const luckLabel = h("span", null, "");
    const hero = h("div", { class: "adv-hero" },
      h("div", { class: "adv-hero-head" }, h("span", { class: "adv-hero-name" }, `🛡️ ${s.name}`), h("span", null, `⚔️ ${s.skill}`), luckLabel),
      heroHp.el,
      h("div", { class: "adv-dice-row" }, ...heroDice, heroTotal),
    );
    const log = h("div", { class: "adv-log" });
    const banner = h("div", { class: "adv-banner" });
    const actions = h("div", { class: "adv-actions" });
    const itemsRow = h("div", { class: "adv-items-row" });
    const el = h("div", { class: "adv-fight" }, bg,
      h("div", { class: "adv-fight-title" }, `⚔️ Trận chiến · §${s.section}`),
      h("div", { class: `adv-foes ${b.foes.length > 2 ? "many" : ""}` }, ...foeCards.map((c) => c.card)),
      log, hero, itemsRow, actions, banner);
    host.append(el);

    const say = (t: string, cls = "") => {
      log.prepend(h("div", { class: cls }, t));
      while (log.childElementCount > 4) log.lastElementChild!.remove();
    };

    let busy = false;
    function render() {
      const act = activeFoes(b);
      foeCards.forEach((c, i) => {
        const f = b.foes[i];
        c.card.classList.toggle("dead", f.hp <= 0);
        c.card.classList.toggle("waiting", f.hp > 0 && !act.includes(i));
        c.card.classList.toggle("targeted", i === b.target && f.hp > 0 && act.length > 1);
      });
      luckLabel.textContent = `🍀 ${s.luck}`;
      const combatItems = Object.entries(s.items).filter(([id, n]) => n > 0 && book.items[id]?.use?.combat);
      const btn = (label: string, a: Action | (() => void), cls = "", disabled = false) =>
        h("button", { class: `btn ${cls}`, type: "button", disabled: busy || disabled, onclick: () => (typeof a === "function" ? a() : void act1(a)) }, label);
      itemsRow.replaceChildren();
      actions.replaceChildren(...nn(
        btn("⚔️ Tấn công", { kind: "attack" }, "primary big"),
        btn(`🍀 Đánh + May mắn`, { kind: "attack", luck: true }, "", s.luck <= 0),
        btn("🛡️ Phòng thủ", { kind: "defend" }),
        btn(`🧪 Vật phẩm${combatItems.length ? "" : " (0)"}`, () => {
          itemsRow.replaceChildren(...combatItems.map(([id, n]) => btn(`${book.items[id].icon} ${book.items[id].name} ×${n}`, { kind: "item", id }, "small")),
            btn("✕", () => itemsRow.replaceChildren(), "small"));
        }, "", !combatItems.length),
        sec.fight!.flee ? btn("🏃 Bỏ chạy (−2 ❤️)", { kind: "flee" }) : null,
      ));
    }

    async function act1(a: Action) {
      if (busy || b.over) return;
      busy = true;
      itemsRow.replaceChildren();
      render();
      const events = playRound(book, s, b, a);
      onChange();
      await animate(events, a);
      busy = false;
      if (b.over) return finish();
      render();
    }

    async function animate(events: BattleEvent[], a: Action) {
      const rolls = events.filter((e): e is Extract<BattleEvent, { t: "roll" }> => e.t === "roll");
      foeCards.forEach((c) => (c.total.textContent = ""));
      heroTotal.textContent = "";
      for (const e of events) if (e.t === "item") { sfx("heal"); say(`${book.items[e.id].icon} Dùng ${book.items[e.id].name}: ${e.changes.map((c) => c.label).join(", ") || "không có tác dụng"}`, "good"); }
      if (rolls.length) {
        sfx("whoosh");
        const all: Promise<void>[] = [];
        for (const r of rolls) {
          const dice = r.who === "hero" ? heroDice : foeCards[r.who].dice;
          all.push(tumble(dice, r.dice));
        }
        await Promise.all(all);
        for (const r of rolls) {
          const t = r.who === "hero" ? heroTotal : foeCards[r.who].total;
          t.textContent = `= ${r.total}`;
          if (r.who === "hero" && a.kind === "defend") t.textContent += " 🛡️";
        }
        const hr = rolls.find((r) => r.who === "hero");
        if (hr && sum(hr.dice) === 12) say("✨ Hai con sáu! Đòn chí mạng!", "good");
        await sleep(250);
      }
      for (const e of events) {
        if (e.t === "luck") { say(e.ok ? "🍀 May mắn mỉm cười: đòn đánh mạnh hơn!" : "🍀 Xui xẻo: đòn đánh trượt khỏi chỗ hiểm.", e.ok ? "good" : "bad"); }
        else if (e.t === "parry") { say(`⚔️ ${b.foes[e.foe].def.name}: hai bên gạt đòn.`); sfx("miss"); }
        else if (e.t === "hit" && e.on === "hero") {
          sfx("hit");
          hero.classList.remove("shake"); void hero.offsetWidth; hero.classList.add("shake");
          el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
          floatNum(hero, `−${e.dmg}`, "bad");
          heroHp.set(s.stamina);
          say(`💥 Bạn mất ${e.dmg} Thể Lực.`, "bad");
          await sleep(380);
        } else if (e.t === "hit" && typeof e.on === "number") {
          const on = e.on;
          const c = foeCards[on];
          sfx(e.crit ? "crit" : "slash");
          hero.classList.remove("lunge"); void hero.offsetWidth; hero.classList.add("lunge");
          c.card.classList.remove("shake"); void c.card.offsetWidth; c.card.classList.add("shake");
          floatNum(c.card, `−${e.dmg}${e.crit ? "!" : ""}`, e.crit ? "crit" : "good");
          c.hp.set(b.foes[on].hp);
          say(`🗡️ Bạn đánh trúng ${b.foes[on].def.name}: −${e.dmg}.`, "good");
          await sleep(380);
        } else if (e.t === "down") {
          sfx("death");
          say(`☠️ ${b.foes[e.foe].def.name} gục ngã!`, "good");
          await sleep(300);
        } else if (e.t === "text") say(e.text);
      }
    }

    async function finish() {
      render();
      actions.replaceChildren();
      const txt = b.over === "win" ? "CHIẾN THẮNG" : b.over === "fled" ? "ĐÃ THOÁT" : "BẠI TRẬN";
      sfx(b.over === "lose" ? "defeat" : "victory");
      banner.replaceChildren(h("div", { class: `adv-banner-box ${b.over}` }, h("div", { class: "adv-banner-t" }, txt),
        h("button", { class: "btn primary", type: "button", onclick: () => { el.remove(); playMusic("title"); resolve(b); } }, "Tiếp tục ▸")));
      banner.classList.add("show");
    }

    say(b.foes.length > 1 ? (b.together ? "Kẻ thù cùng lúc lao vào bạn!" : "Kẻ thù lần lượt tiến lên.") : `${b.foes[0].def.name} chặn đường bạn!`);
    if (b.foes.length > 1 && b.together) say("Chạm vào một kẻ địch để chọn mục tiêu.");
    render();
  });
}
