import { power } from "../core/levels";
import { app } from "../app";
import { chooseAction } from "../combat/ai";
import { AFFIX, makeElite } from "../combat/elite";
import { MECH, mechForFloor } from "../combat/bossMech";
import { PET, PET_EGG, PET_EVERY, petSpec } from "../data/pets";
import { creatureCanvas } from "../render/creatures";
import { describeSkill, skillCostText } from "../combat/describe";
import { Battle, CHARGE_MULT, MAX_BOOST, MAX_BP } from "../combat/engine";
import { unitFromCharacter, unitFromEnemy } from "../combat/factory";
import { ELEMENTS, STATUSES } from "../combat/statuses";
import type { BattleEvent, Eff, Element, Skill, Unit } from "../combat/types";
import { Rng } from "../core/rng";
import { XP_RATE, isMilestone, charStats, giveXp, logMsg, partyBuffs } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { BIOME_MATS, ESSENCES, LEGENDARY_BY_BIOME, gearForFloor, getItem, type ItemDef } from "../data/items";
import { iconURL } from "../render/icons";
import { getSkill } from "../data/skills";
import { spriteURL } from "../render/pixel";
import { battleBackdrop } from "../render/backdrop";
import { isPerson, personCanvas } from "../render/people";
import { giveToGame } from "../story/runner";
import { BIOMES } from "../world/biomes";
import { getFloor } from "../world/floors";
import { h, nn, openModal, sleep, toast } from "../ui/dom";

const ENEMY_EL: Record<string, string> = {
  forest: "earth", desert: "fire", swamp: "water", tundra: "ice", fungal: "poison", volcano: "fire", reef: "water", bamboo: "wind",
  crystal: "arcane", autumn: "earth", ruins: "dark", sakura: "wind", bonewaste: "dark", jungle: "poison", glacier: "ice",
};

export interface BattleSetup {
  enemies: { id: string; level: number }[];
  floor: number;
  biome: string;
  enemyFx?: Eff[];
  noFlee?: boolean;
  /** The pack is led by an elite (its first monster). */
  elite?: boolean;
  seed?: number;
}

export type BattleOutcome = "win" | "lose" | "flee";

interface UnitView {
  root: HTMLElement;
  img: HTMLImageElement;
  hp: HTMLElement;
  mp?: HTMLElement;
  st: HTMLElement;
  intent?: HTMLElement;
  shield?: HTMLElement;
  bp?: HTMLElement;
}

type PlayerChoice =
  | { kind: "skill"; skill: string; target?: string }
  | { kind: "item"; item: string; target?: string }
  | { kind: "flee" };

const pref = {
  get auto() { try { return localStorage.getItem("fl.auto") === "1"; } catch { return false; } },
  set auto(v: boolean) { try { localStorage.setItem("fl.auto", v ? "1" : "0"); } catch { /* ignore */ } },
  get fast() { try { return localStorage.getItem("fl.fast") === "1"; } catch { return false; } },
  set fast(v: boolean) { try { localStorage.setItem("fl.fast", v ? "1" : "0"); } catch { /* ignore */ } },
};

/**
 * Feet position (x%, y%) of slot i of n inside one team's half; the front line is nearest the centre.
 * Wide screens use two columns side by side, narrow ones a zigzag so name plates never cover anyone.
 */
function slot(i: number, n: number, wide: boolean): [number, number] {
  const W: Record<number, [number, number][]> = {
    1: [[52, 78]],
    2: [[62, 60], [26, 94]],
    3: [[64, 72], [26, 46], [26, 98]],
    4: [[68, 46], [28, 46], [68, 98], [28, 98]],
  };
  const N: Record<number, [number, number][]> = {
    1: [[50, 80]],
    2: [[62, 52], [32, 96]],
    3: [[64, 38], [32, 68], [64, 98]],
    4: [[66, 31], [32, 54], [66, 77], [32, 99]],
  };
  const L = wide ? W : N;
  return (L[Math.min(4, n)] ?? L[4])[Math.min(i, 3)];
}

const personCache = new Map<string, string>();
function personURL(sprite: string, pal?: Record<string, string>): string {
  const k = `${sprite}|${pal ? JSON.stringify(pal) : ""}`;
  let url = personCache.get(k);
  if (!url) { url = personCanvas(sprite, pal, 2, 0).toDataURL(); personCache.set(k, url); }
  return url;
}

/** Chunky battle gauge: label, coloured fill, a pale "just lost" trail that drains after it, numbers. */
function cbar(kind: "hp" | "mp"): HTMLElement {
  return h("div", { class: `cbar ${kind}` },
    h("span", { class: "cb-tag" }, kind === "hp" ? "HP" : "MP"),
    h("div", { class: "cb-track" }, h("div", { class: "cb-ghost" }), h("div", { class: "cb-fill" }), h("span", { class: "cb-num" })));
}

function setBar(el: HTMLElement, v: number, max: number) {
  const pct = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  const fill = el.querySelector<HTMLElement>(".cb-fill")!;
  const ghost = el.querySelector<HTMLElement>(".cb-ghost")!;
  const prev = parseFloat(fill.style.width || "100");
  fill.style.width = `${pct}%`;
  // losing: the trail waits, then drains; gaining: it snaps along
  if (pct < prev) setTimeout(() => { ghost.style.width = `${pct}%`; }, 380);
  else ghost.style.width = `${pct}%`;
  el.querySelector(".cb-num")!.textContent = `${Math.max(0, Math.round(v))}/${max}`;
  if (el.classList.contains("hp")) {
    el.classList.toggle("mid", pct <= 50 && pct > 20);
    el.classList.toggle("low", pct <= 20 && pct > 0);
  }
}

export function runBattle(setup: BattleSetup): Promise<BattleOutcome> {
  const g = app.game;
  const rng = new Rng(Date.now() & 0xffffffff);
  const buffs = partyBuffs(g);
  const allies = g.party.map((id) => g.chars[id]).filter(Boolean).map((ch) => unitFromCharacter(ch, buffs));
  const enemies = setup.enemies.map((e, i) => unitFromEnemy(e.id, e.level, i));
  const battle = new Battle(allies, enemies, rng.int(1, 1e9));
  for (const e of setup.enemyFx ?? []) for (const u of enemies) battle.addStatus(u, e.s, e.t ?? 2, e.st ?? 1, 0);
  if (setup.elite && enemies[0] && !enemies[0].boss) makeElite(battle, enemies[0], setup.floor, setup.seed ?? 1);
  // a milestone floor's lord is much tougher
  const lord = isMilestone(setup.floor) ? enemies.find((u) => u.boss) : undefined;
  if (lord) {
    lord.base = { ...lord.base, hp: Math.round(lord.base.hp * 1.35), atk: Math.round(lord.base.atk * 1.1), mag: Math.round(lord.base.mag * 1.1) };
    lord.hp = lord.base.hp;
    lord.name = `⭐ ${lord.name}`;
    lord.shieldMax = (lord.shieldMax ?? 4) + 2;
    lord.shield = lord.shieldMax;
  }
  // the pet travelling with the party lends its gift
  const pet = g.pet ? PET[g.pet] : undefined;
  if (pet) {
    if (pet.hook === "courage") for (const u of allies) u.bp = 3;
    if (pet.hook === "shell") for (const u of allies) battle.addStatus(u, "shield", 3, 1, Math.round(battle.maxHp(u) * 0.15), u);
    if (pet.hook === "thorns") for (const u of allies) battle.addStatus(u, "thorns", 3, 1, 0, u);
    if (pet.hook === "sleep") for (const u of enemies) if (rng.chance(u.boss ? 0.15 : 0.35)) battle.addStatus(u, "sleep", 1, 1, 0);
    if (pet.hook === "revive") battle.petRevive = true;
    if (pet.hook === "scan") {
      const known0 = (g.scan ??= {});
      for (const u of enemies) if (u.enemyId) { const l = (known0[u.enemyId] ??= []); for (const [el, v] of Object.entries(u.resist)) if ((v ?? 1) > 1 && !l.includes(el)) l.push(el); }
    }
  }
  battle.drainEvents();
  g.stats.battles++;

  const biome = BIOMES[setup.biome] ?? BIOMES.forest;
  let auto = pref.auto;
  let fast = pref.fast;
  const delay = (ms: number) => sleep(fast ? ms * 0.45 : ms);

  // ------------------------------------------------------------ DOM
  // leftover map hints must not cover the battle
  document.querySelectorAll(".toasts .toast").forEach((t) => t.remove());
  const known = (g.scan ??= {});
  const isKnown = (u: Unit, el: string) => !!u.enemyId && (known[u.enemyId] ?? []).includes(el);
  const weakEls = (u: Unit) => (Object.entries(u.resist) as [Element, number][]).filter(([, v]) => v > 1).map(([k]) => k);

  const timeline = h("div", { class: "timeline" });
  const autoBtn = h("button", { class: `btn small ${auto ? "primary" : ""}`, title: "Để cả đội tự đánh (không dùng Dũng Khí, không né đòn Tụ Lực)", onclick: () => setAuto(!auto) }, "⚙️ Tự động");
  const fastBtn = h("button", { class: `btn small ${fast ? "primary" : ""}`, onclick: () => { fast = !fast; pref.fast = fast; fastBtn.classList.toggle("primary", fast); } }, "⏩ x2");
  const helpBtn = h("button", { class: "btn small", title: "Cách chơi", onclick: () => combatHelp() }, "❓");
  const banner = h("div", { class: "cb-banner" });
  // two teams facing each other across the field: party on the left, enemies on the right
  const sideA = h("div", { class: "side left" });
  const sideE = h("div", { class: "side right" });
  const petEl = pet ? h("div", { class: "cb-pet", title: `${pet.name} — ${pet.gift}: ${pet.desc}` }, h("img", { class: "pix", src: creatureCanvas(petSpec(pet)).toDataURL(), alt: pet.name }), h("span", null, pet.name)) : null;
  const stage = h("div", { class: "cb-stage arena", style: `background-image:url(${battleBackdrop(setup.biome)})` }, ...nn(sideA, sideE, petEl, banner));
  const actorBox = h("div", { class: "cb-actor" });
  const bpBox = h("div", { class: "bp-ctl" });
  const info = h("div", { class: "cb-info" }, "…");
  const tabs = h("div", { class: "tabs cb-tabs" });
  const grid = h("div", { class: "skill-grid" });
  const logLine = h("div", { class: "cb-log" });
  const panel = h("div", { class: "cb-panel" }, h("div", { class: "cb-head" }, actorBox, bpBox), info, tabs, grid, logLine);
  const el = h("div", { class: "combat", style: `--cb1:${biome.bg[0]};--cb2:${biome.bg[1]}` },
    h("div", { class: "cb-top" }, h("span", { class: "tl-label" }, "Lượt"), timeline, helpBtn, autoBtn, fastBtn), stage, panel);
  document.body.append(el);

  const views = new Map<string, UnitView>();
  const place = (root: HTMLElement, i: number, n: number, side: "left" | "right") => {
    const [x, y] = slot(i, n, window.innerWidth >= 760);
    root.style.left = `${side === "left" ? x : 100 - x}%`;
    root.style.top = `${y}%`;
    root.style.zIndex = String(Math.round(y));
    root.style.setProperty("--d", `${(i * 0.37) % 1.2}s`);
  };
  // the boss always takes the front, centre spot
  const eOrder = [...enemies].sort((a, b) => Number(!!b.boss) - Number(!!a.boss));
  // the floor boss's signature trick (it starts once the screen is ready, see below)
  const bossUnit = enemies.find((u) => u.boss);
  const mech = bossUnit && setup.floor > 0 ? mechForFloor(setup.floor) : undefined;
  if (bossUnit && mech) {
    bossUnit.mech = mech.id;
    battle.spawner = (id, lvl, idx) => unitFromEnemy(id, lvl, idx);
  }
  const addEnemyView = (u: Unit) => {
    const img = h("img", { class: "sprite", src: spriteURL(u.sprite, u.palette, 8), alt: u.name, draggable: false });
    const hp = cbar("hp");
    const st = h("div", { class: "statuses" });
    const intent = h("div", { class: "intent" });
    const shield = h("div", { class: "shieldrow" });
    const affixes = u.elite?.length ? h("div", { class: "affixes" }, u.elite.map((id) => h("span", { class: "affix", title: `${AFFIX[id].name}: ${AFFIX[id].desc}` }, AFFIX[id].icon, " ", AFFIX[id].name)))
      : u.mech && MECH[u.mech] ? h("div", { class: "affixes" }, h("span", { class: "affix mech", title: MECH[u.mech].desc }, MECH[u.mech].icon, " ", MECH[u.mech].name, h("b", { class: "mech-count" })))
      : null;
    const root = h("div", { class: `unit fighter enemy ${u.boss ? "boss" : ""} ${u.elite ? "elite" : ""}` },
      intent,
      h("div", { class: "plate" }, h("div", { class: "pl-name" }, h("span", null, u.name), h("small", null, `Lv${u.level}`)), affixes, hp, shield, st),
      h("div", { class: "body" }, h("div", { class: "plat" }), img));
    root.addEventListener("click", () => onUnitClick(u));
    sideE.append(root);
    views.set(u.uid, { root, img, hp, st, intent, shield });
  };
  /** Standing enemies share the formation; fallen ones step aside for newcomers. */
  const layoutEnemies = () => {
    const standing = eOrder.filter((u) => u.hp > 0);
    const shown = eOrder.length > 4 ? standing : eOrder;
    eOrder.forEach((u) => views.get(u.uid)?.root.classList.toggle("gone", !shown.includes(u)));
    const boss = shown.find((u) => u.boss);
    if (!boss) { shown.forEach((u, i) => place(views.get(u.uid)!.root, i, shown.length, "right")); return; }
    // a boss holds the front-centre spot; its escort stands around it
    const wide = window.innerWidth >= 760;
    const at = (u: Unit, x: number, y: number, i: number) => {
      const r = views.get(u.uid)!.root;
      r.style.left = `${100 - x}%`; r.style.top = `${y}%`; r.style.zIndex = String(Math.round(y)); r.style.setProperty("--d", `${(i * 0.37) % 1.2}s`);
    };
    at(boss, wide ? 60 : 58, wide ? 88 : 99, 0);
    const escort: [number, number][] = wide ? [[22, 44], [22, 97], [90, 42]] : [[30, 30], [78, 47], [26, 64]];
    shown.filter((u) => u !== boss).forEach((u, i) => { at(u, ...escort[Math.min(i, escort.length - 1)], i + 1); views.get(u.uid)!.root.classList.add("escort"); });
  };
  eOrder.forEach(addEnemyView);
  layoutEnemies();
  allies.forEach((u, i) => {
    const person = isPerson(u.sprite);
    const img = h("img", { class: `sprite ${person ? "tall" : ""}`, src: person ? personURL(u.sprite, u.palette) : spriteURL(u.sprite, u.palette, 8), alt: u.name, draggable: false });
    const hp = cbar("hp");
    const mp = cbar("mp");
    const st = h("div", { class: "statuses" });
    const bp = h("div", { class: "bp-pips", title: "Dũng Khí: +1 mỗi lượt, tiêu để tăng sức đòn đánh" });
    const root = h("div", { class: "unit fighter ally" },
      h("div", { class: "plate" }, h("div", { class: "pl-name" }, h("span", null, u.name.split(" ")[0]), h("small", null, `Lv${u.level}`)), hp, mp, h("div", { class: "pl-row" }, bp, st)),
      h("div", { class: "body" }, h("div", { class: "plat" }), img));
    root.addEventListener("click", () => onUnitClick(u));
    place(root, i, allies.length, "left");
    sideA.append(root);
    views.set(u.uid, { root, img, hp, mp, st, bp });
  });

  /** Attacker steps toward the other side. */
  function lunge(u: Unit, magic: boolean) {
    const v = views.get(u.uid);
    if (!v) return;
    const cls = magic ? "cast" : "lunge";
    v.root.classList.remove("lunge", "cast");
    void v.root.offsetWidth;
    v.root.classList.add(cls);
    setTimeout(() => v.root.classList.remove(cls), 420);
  }

  function setAuto(v: boolean) {
    auto = v;
    pref.auto = v;
    autoBtn.classList.toggle("primary", v);
    if (v && pending) {
      const actor = pending.actor;
      const res = pending.resolve;
      pending = null;
      res({ kind: "skill", ...chooseAction(battle, actor) });
    }
  }

  function combatHelp() {
    const m = openModal("⚔️ Cách Đánh");
    m.body.append(
      h("div", { class: "cb-help" },
        h("div", null, h("b", null, "🛡️ Khiên & Phá Khiên"), h("p", null, "Mỗi kẻ địch có một số điểm Khiên và những ô điểm yếu (❔ = chưa biết). Đánh trúng hệ nó yếu sẽ trừ 1 điểm Khiên; về 0 là PHÁ KHIÊN: nó mất lượt kế tiếp và chịu thêm 50% sát thương cho tới khi hồi lại. Thử các hệ khác nhau để lộ điểm yếu — trò chơi sẽ nhớ cho lần sau.")),
        h("div", null, h("b", null, "🔥 Dũng Khí"), h("p", null, "Mỗi lượt mỗi người được +1 Dũng Khí (tối đa 5). Tiêu 1–3 điểm trước khi ra đòn: Tấn công thường đánh thêm 1 nhát mỗi điểm (rất hợp để phá khiên), kỹ năng và hồi máu mạnh thêm 50% mỗi điểm. Lượt nào đã tiêu thì lượt sau không được cộng.")),
        h("div", null, h("b", null, "👁️ Ý đồ của địch"), h("p", null, "Bong bóng trên đầu kẻ địch cho biết lượt tới nó định làm gì và nhắm vào ai. Boss đôi khi ⚠️ Tụ Lực: đòn kế tiếp mạnh gấp đôi — Phòng thủ để đỡ, hoặc Phá Khiên nó để huỷ luôn đòn đó.")),
        h("div", null, h("b", null, "🏆 Phần thưởng"), h("p", null, "Mỗi lần Phá Khiên được thêm 10% vàng và kinh nghiệm cuối trận (tối đa +50%). Chế độ Tự động vẫn dùng được, nhưng không biết tận dụng Dũng Khí hay né đòn Tụ Lực."))),
      h("div", { class: "row end" }, h("button", { class: "btn primary", onclick: () => m.close() }, "Hiểu rồi!")));
  }

  function refresh(u: Unit) {
    const v = views.get(u.uid);
    if (!v) return;
    setBar(v.hp, u.hp, battle.maxHp(u));
    if (v.mp) setBar(v.mp, u.mp, battle.maxMp(u));
    v.st.replaceChildren(...u.statuses.map((s) => {
      const d = STATUSES[s.id];
      const span = h("span", { class: `st ${d.kind}`, title: `${d.name}: ${d.desc} (${s.turns} lượt)` }, d.icon, s.stacks > 1 ? h("sub", null, String(s.stacks)) : null);
      span.addEventListener("click", (e) => { e.stopPropagation(); toast(`${d.icon} ${d.name} (${s.turns} lượt${s.stacks > 1 ? `, ${s.stacks} tầng` : ""}): ${d.desc}`); });
      return span;
    }));
    if (v.bp) v.bp.replaceChildren(...Array.from({ length: MAX_BP }, (_, i) => h("i", { class: i < (u.bp ?? 0) ? "on" : "" })));
    if (v.shield) {
      const weak = weakEls(u);
      v.shield.replaceChildren(
        h("span", { class: `shield-badge ${u.broken ? "broken" : ""}`, title: u.broken ? "Vỡ khiên! Mất lượt kế tiếp, chịu thêm 50% sát thương" : `Khiên: còn ${u.shield} lần trúng điểm yếu nữa là vỡ` }, u.broken ? "💥" : `🛡️${u.shield ?? 0}`),
        ...weak.map((e) => h("span", { class: `weak ${isKnown(u, e) ? "known" : ""}`, title: isKnown(u, e) ? `Yếu ${ELEMENTS[e].name}` : "Điểm yếu chưa rõ — thử các hệ khác nhau" }, isKnown(u, e) ? ELEMENTS[e].icon : "❔")));
    }
    if (v.intent) renderIntent(u, v.intent);
    const mc = v.root.querySelector(".mech-count");
    if (mc) mc.textContent = u.mech === "countdown" ? ` ${u.mechCount ?? ""}` : u.mech === "rebirth" && u.mechUsed ? " (đã dùng)" : "";
    v.root.classList.toggle("broken", !!u.broken);
    v.root.classList.toggle("charged", !!u.charged);
    v.root.classList.toggle("dead", u.hp <= 0);
  }

  function renderIntent(u: Unit, box: HTMLElement) {
    const it = u.intent;
    if (u.hp <= 0 || !it) { box.replaceChildren(); box.className = "intent"; return; }
    if (it.charge) {
      box.className = "intent warn";
      box.replaceChildren("⚠️ Tụ lực");
      box.title = "Lượt tới nó sẽ tụ lực, rồi tung đòn mạnh gấp đôi";
      return;
    }
    const sk = getSkill(it.skill);
    const t = it.target ? battle.unit(it.target) : undefined;
    const who = sk.target === "enemies" ? "cả đội" : sk.target === "allies" ? "đồng bọn" : sk.target === "self" ? "bản thân" : t ? t.name.split(" ")[0] : "?";
    box.className = `intent ${u.charged ? "danger" : ""}`;
    box.replaceChildren(`${u.charged ? "💢" : ""}${sk.icon} ${sk.name}`, h("small", null, ` → ${who}`));
    box.title = u.charged ? `Đòn tụ lực ×${CHARGE_MULT}! Phòng thủ hoặc phá khiên để huỷ.` : describeSkill(sk).join(" ");
  }

  function refreshAll() {
    for (const u of battle.units) refresh(u);
    timeline.replaceChildren(...battle.timeline(9).map((u) =>
      h("img", { class: `tl sprite ${u.side} ${u.broken ? "broken" : ""}`, src: spriteURL(u.sprite, u.palette, 2), title: u.name })));
  }

  function floaty(u: Unit, text: string, cls: string) {
    const v = views.get(u.uid);
    if (!v) return;
    const f = h("div", { class: `floaty ${cls}` }, text);
    v.root.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  function announce(text: string, cls: string, ms = 900) {
    const b = h("div", { class: `cb-announce ${cls}` }, text);
    banner.append(b);
    setTimeout(() => b.remove(), ms);
  }

  function shake(strong = false) {
    stage.classList.remove("quake", "quake2");
    void stage.offsetWidth;
    stage.classList.add(strong ? "quake2" : "quake");
  }

  function setActive(u: Unit | null) {
    for (const [uid, v] of views) v.root.classList.toggle("active", !!u && uid === u.uid);
  }

  async function playEvents() {
    const events = battle.drainEvents();
    for (const ev of events) await playEvent(ev);
    refreshAll();
  }

  async function playEvent(ev: BattleEvent) {
    switch (ev.t) {
      case "turn": {
        const u = battle.unit(ev.uid);
        if (u) setActive(u);
        break;
      }
      case "use": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        const name = ev.skill.startsWith("item:") ? getItem(ev.skill.slice(5)).name : getSkill(ev.skill).name;
        const icon = ev.skill.startsWith("item:") ? getItem(ev.skill.slice(5)).icon : getSkill(ev.skill).icon;
        log(`${u.name} dùng ${icon} ${name}`);
        if (!ev.skill.startsWith("item:")) { const sk = getSkill(ev.skill); if ((sk.power ?? 0) > 0) lunge(u, sk.kind !== "physical"); }
        if (ev.skill !== "attack") floaty(u, `${icon} ${name}`, "react");
        await delay(ev.skill === "attack" ? 220 : 480);
        break;
      }
      case "dmg": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        const v = views.get(u.uid);
        if (v && !ev.dot) {
          v.root.classList.remove("hit");
          void v.root.offsetWidth;
          v.root.classList.add("hit", "flash");
          setTimeout(() => v.root.classList.remove("flash"), 120);
          if (ev.crit || u.broken) shake(false);
        }
        const col = ELEMENTS[ev.el]?.color ?? "#fff";
        const weak = u.side === "enemy" && battle.isWeak(u, ev.el) && !ev.dot;
        const f = h("div", { class: `floaty ${ev.crit ? "crit" : ""} ${weak ? "weakhit" : ""}`, style: `color:${col}` }, `${ev.crit ? "💥" : ""}${ev.amount}${ev.absorbed ? ` (🔰${ev.absorbed})` : ""}`);
        v?.root.append(f);
        setTimeout(() => f.remove(), 1200);
        refresh(u);
        await delay(ev.dot ? 180 : 240);
        break;
      }
      case "heal": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        floaty(u, `+${ev.amount}${ev.mp ? " MP" : ""}`, ev.mp ? "mp" : "heal");
        refresh(u);
        await delay(140);
        break;
      }
      case "miss": {
        const u = battle.unit(ev.uid);
        if (u) floaty(u, "Trượt!", "miss");
        await delay(200);
        break;
      }
      case "reaction": {
        const u = battle.unit(ev.uid);
        if (u) floaty(u, `✦ ${ev.name} ✦`, "react");
        log(`Phản ứng: ${ev.name}!`);
        await delay(420);
        break;
      }
      case "skip": {
        const u = battle.unit(ev.uid);
        if (u) floaty(u, `${ev.reason || "Mất lượt"}`, "miss");
        await delay(380);
        break;
      }
      case "status": {
        const u = battle.unit(ev.uid);
        if (u) refresh(u);
        break;
      }
      case "scan": {
        const u = battle.unit(ev.uid);
        if (!u?.enemyId) break;
        const list = (known[u.enemyId] ??= []);
        if (!list.includes(ev.el)) {
          list.push(ev.el);
          if (battle.isWeak(u, ev.el)) { floaty(u, `${ELEMENTS[ev.el].icon} Điểm yếu!`, "react"); log(`Phát hiện: ${u.name} yếu ${ELEMENTS[ev.el].name}!`); }
          refresh(u);
        }
        break;
      }
      case "shield": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        refresh(u);
        const v = views.get(u.uid);
        const sb = v?.shield?.querySelector(".shield-badge");
        sb?.classList.remove("pop"); void (sb as HTMLElement | undefined)?.offsetWidth; sb?.classList.add("pop");
        break;
      }
      case "break": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        refresh(u);
        announce("💥 PHÁ KHIÊN!", "break", 1100);
        shake(true);
        log(`${u.name} bị phá khiên! Mất lượt kế tiếp và chịu thêm sát thương.`);
        await delay(650);
        break;
      }
      case "recover": {
        const u = battle.unit(ev.uid);
        if (u) { refresh(u); floaty(u, "🛡️ Hồi khiên", "mp"); }
        await delay(250);
        break;
      }
      case "boost": {
        const u = battle.unit(ev.uid);
        if (u) floaty(u, `🔥 Dũng Khí ×${ev.n}`, "react");
        await delay(300);
        break;
      }
      case "charge": {
        const u = battle.unit(ev.uid);
        if (!u) break;
        refresh(u);
        announce(`⚠️ ${u.name} đang tụ lực!`, "warn", 1300);
        log(`${u.name} tụ lực — đòn kế tiếp cực mạnh! Phòng thủ hoặc phá khiên để huỷ.`);
        await delay(700);
        break;
      }
      case "spawn": {
        const u = battle.unit(ev.uid);
        if (!u || views.has(u.uid)) break;
        eOrder.push(u);
        addEnemyView(u);
        layoutEnemies();
        refresh(u);
        const v = views.get(u.uid)!;
        v.root.classList.add("arrive");
        setTimeout(() => v.root.classList.remove("arrive"), 600);
        log(`${u.name} xuất hiện!`);
        await delay(450);
        break;
      }
      case "death": {
        const u = battle.unit(ev.uid);
        if (u) { refresh(u); log(`${u.name} đã gục ngã!`); }
        await delay(300);
        break;
      }
      case "revive": {
        const u = battle.unit(ev.uid);
        if (u) { refresh(u); floaty(u, "Hồi sinh!", "heal"); }
        await delay(300);
        break;
      }
      default:
        break;
    }
  }

  const logLines: string[] = [];
  function log(text: string) {
    logLines.push(text);
    if (logLines.length > 3) logLines.shift();
    logLine.replaceChildren(...logLines.map((l, i) => h("div", { class: i === logLines.length - 1 ? "" : "old" }, l)));
  }

  // ------------------------------------------------------------ player input
  let pending: { actor: Unit; resolve: (c: PlayerChoice) => void } | null = null;
  let selected: { kind: "skill"; sk: Skill } | { kind: "item"; it: ItemDef } | null = null;
  let tab: "skills" | "items" = "skills";
  let boost = 0;

  function clearTargets() {
    for (const v of views.values()) v.root.classList.remove("targetable", "weak-hit");
  }

  function targetsFor(actor: Unit): Unit[] {
    if (!selected) return [];
    if (selected.kind === "skill") return battle.needsTarget(selected.sk) ? battle.validTargets(actor, selected.sk) : [];
    const use = selected.it.use!;
    if (use.target === "ally") return battle.friends(actor);
    if (use.target === "deadAlly") return battle.friendsDead(actor);
    return [];
  }

  function onUnitClick(u: Unit) {
    if (!pending || !selected) {
      const s = u.statuses.map((x) => `${STATUSES[x.id].icon}${STATUSES[x.id].name}`).join(", ");
      info.replaceChildren(...nn(h("b", null, `${u.name} (Lv${u.level})`), ` — Máu ${u.hp}/${battle.maxHp(u)}${u.side === "ally" ? `, MP ${u.mp}/${battle.maxMp(u)}` : ""}${s ? ` · ${s}` : ""}`,
        u.side === "enemy" ? h("div", { class: "small" }, weaknessText(u)) : null));
      return;
    }
    const valid = targetsFor(pending.actor);
    if (!valid.includes(u)) return;
    const p = pending;
    pending = null;
    clearTargets();
    if (selected.kind === "skill") p.resolve({ kind: "skill", skill: selected.sk.id, target: u.uid });
    else p.resolve({ kind: "item", item: selected.it.id, target: u.uid });
    selected = null;
  }

  function weaknessText(u: Unit) {
    const tried = u.enemyId ? known[u.enemyId] ?? [] : [];
    const weak = weakEls(u).map((e) => (tried.includes(e) ? `${ELEMENTS[e].icon} ${ELEMENTS[e].name}` : "❔"));
    const strong = (Object.entries(u.resist) as [Element, number][]).filter(([k, v]) => v < 1 && tried.includes(k)).map(([k]) => ELEMENTS[k].icon);
    return `🛡️ Khiên ${u.broken ? "đã vỡ" : `${u.shield}/${u.shieldMax}`} · Yếu: ${weak.join(" ") || "—"} · Kháng (đã biết): ${strong.join(" ") || "—"}${u.intent ? "" : ""}`;
  }

  function consumables(): ItemDef[] {
    return Object.keys(g.inventory).map(getItem).filter((it) => it.use && it.use.target !== "none" && it.use.battle !== false && !it.use.special && (g.inventory[it.id] ?? 0) > 0);
  }

  /** A known weakness of some enemy on the field can be hit with this element. */
  const hitsKnownWeak = (el: Element) => battle.alive("enemy").some((e) => !e.broken && battle.isWeak(e, el) && isKnown(e, el));

  function renderBoost(actor: Unit) {
    const max = Math.min(MAX_BOOST, actor.bp ?? 0);
    boost = Math.min(boost, max);
    bpBox.replaceChildren(...nn(
      h("span", { class: "muted small" }, "🔥 Dũng Khí"),
      h("button", { class: "icon-btn bp-btn", disabled: boost <= 0, onclick: () => { boost--; renderBoost(actor); } }, "−"),
      h("span", { class: "bp-pips big" }, Array.from({ length: MAX_BP }, (_, i) => h("i", { class: `${i < (actor.bp ?? 0) ? "on" : ""} ${i < boost ? "use" : ""}` }))),
      h("button", { class: "icon-btn bp-btn", disabled: boost >= max, onclick: () => { boost++; renderBoost(actor); } }, "+"),
      boost ? h("span", { class: "gold small" }, `Tấn công +${boost} nhát · kỹ năng +${boost * 50}%`) : null));
  }

  function renderPanel(actor: Unit) {
    actorBox.replaceChildren(h("img", { class: "sprite", src: spriteURL(actor.sprite, actor.palette, 2), alt: "" }), h("b", null, `Lượt của ${actor.name}`));
    renderBoost(actor);
    tabs.replaceChildren(...nn(
      h("button", { class: tab === "skills" ? "on" : "", onclick: () => { tab = "skills"; selected = null; clearTargets(); renderPanel(actor); } }, "⚔️ Kỹ năng"),
      h("button", { class: tab === "items" ? "on" : "", onclick: () => { tab = "items"; selected = null; clearTargets(); renderPanel(actor); } }, `🎒 Vật phẩm (${consumables().length})`),
      setup.noFlee ? null : h("button", { onclick: () => { if (pending) { const p = pending; pending = null; clearTargets(); p.resolve({ kind: "flee" }); } } }, `🏃 Bỏ chạy (${Math.round(fleeChance() * 100)}%)`),
    ));
    grid.replaceChildren();
    if (tab === "skills") {
      for (const id of ["attack", "defend", ...actor.skills]) {
        const sk = getSkill(id);
        const can = battle.canUse(actor, sk);
        const el = sk.kind === "physical" && sk.el === "physical" ? (actor.statuses.map((s) => STATUSES[s.id].imbue).find(Boolean) ?? "physical") : sk.el;
        const weak = (sk.power ?? 0) > 0 && hitsKnownWeak(el as Element);
        const btn = h("button", { class: `skill-btn ${selected?.kind === "skill" && selected.sk.id === id ? "sel" : ""} ${weak ? "weak" : ""}`, disabled: !can.ok, style: `--elc:${ELEMENTS[el as Element]?.color ?? "#888"}` },
          h("span", { class: "ico" }, sk.icon),
          h("span", { class: "grow" }, h("div", { class: "nm" }, sk.name), h("div", { class: "cs" }, can.ok ? skillCostText(sk) : can.reason)),
          (sk.power ?? 0) > 0 ? h("span", { class: "el", title: ELEMENTS[el as Element]?.name }, ELEMENTS[el as Element]?.icon ?? "") : null,
          weak ? h("span", { class: "weak-tag" }, "YẾU") : null);
        btn.addEventListener("click", () => selectSkill(actor, sk));
        grid.append(btn);
      }
    } else {
      const list = consumables();
      if (!list.length) grid.append(h("div", { class: "muted small" }, "Không có vật phẩm dùng được."));
      for (const it of list) {
        const btn = h("button", { class: `skill-btn ${selected?.kind === "item" && selected.it.id === it.id ? "sel" : ""}` },
          h("span", { class: "ico" }, h("img", { class: "pix iicon", src: iconURL(it.shape, it.col), alt: "" })),
          h("span", null, h("div", { class: "nm" }, it.name), h("div", { class: "cs" }, `×${g.inventory[it.id]}`)));
        btn.addEventListener("click", () => selectItem(actor, it));
        grid.append(btn);
      }
    }
    if (!selected) {
      const threat = battle.alive("enemy").find((e) => e.charged || e.intent?.charge);
      info.replaceChildren(...nn(
        threat ? h("div", { class: "bad" }, threat.charged ? `⚠️ ${threat.name} đã tụ lực — đòn tới cực mạnh! Phòng thủ, hoặc phá khiên nó để huỷ.` : `⚠️ ${threat.name} sắp tụ lực.`) : null,
        h("span", null, "Chọn hành động. Nút ", h("span", { class: "weak-tag" }, "YẾU"), " = đánh trúng điểm yếu đã biết. Chạm kẻ địch để xem chi tiết.")));
    }
  }

  function selectSkill(actor: Unit, sk: Skill) {
    if (!pending) return;
    if (selected?.kind === "skill" && selected.sk.id === sk.id && !battle.needsTarget(sk)) {
      const p = pending; pending = null; selected = null;
      return p.resolve({ kind: "skill", skill: sk.id });
    }
    selected = { kind: "skill", sk };
    clearTargets();
    renderPanel(actor);
    const lines = describeSkill(sk);
    const needs = battle.needsTarget(sk);
    showPick(`${sk.icon} ${sk.name}`, skillCostText(sk), lines.join(" "),
      needs ? h("span", { class: "gold" }, "👉 Chạm vào mục tiêu") : h("button", { class: "btn small primary", onclick: () => selectSkill(actor, sk) }, "Dùng ▸"));
    if (needs) {
      for (const t of battle.validTargets(actor, sk)) {
        const v = views.get(t.uid);
        v?.root.classList.add("targetable");
        if (t.side === "enemy" && (sk.power ?? 0) > 0 && battle.isWeak(t, sk.el) && isKnown(t, sk.el)) v?.root.classList.add("weak-hit");
      }
    }
  }

  /** The chosen skill / item: name and the action on one line that always fits, the description below (scrolls if long). */
  function showPick(name: string, cost: string, desc: string, action: HTMLElement) {
    info.replaceChildren(
      h("div", { class: "cb-pick" }, h("div", { class: "cb-pick-name" }, h("b", null, name), cost ? h("span", { class: "muted small" }, ` · ${cost}`) : null), action),
      h("div", { class: "cb-pick-desc" }, desc));
  }

  function selectItem(actor: Unit, it: ItemDef) {
    if (!pending) return;
    const use = it.use!;
    const needs = use.target === "ally" || use.target === "deadAlly";
    if (selected?.kind === "item" && selected.it.id === it.id && !needs) {
      const p = pending; pending = null; selected = null;
      return p.resolve({ kind: "item", item: it.id });
    }
    selected = { kind: "item", it };
    clearTargets();
    renderPanel(actor);
    showPick(`${it.icon} ${it.name}`, "", it.desc,
      needs ? h("span", { class: "gold" }, "👉 Chạm vào đồng đội") : h("button", { class: "btn small primary", onclick: () => selectItem(actor, it) }, "Dùng ▸"));
    if (needs) for (const t of targetsFor(actor)) views.get(t.uid)?.root.classList.add("targetable");
  }

  function waitForPlayer(actor: Unit): Promise<PlayerChoice> {
    selected = null;
    tab = "skills";
    boost = 0;
    renderPanel(actor);
    return new Promise((resolve) => { pending = { actor, resolve }; });
  }

  function fleeChance() {
    const avg = (us: Unit[]) => us.reduce((s, u) => s + battle.stat(u, "spd"), 0) / Math.max(1, us.length);
    return Math.max(0.2, Math.min(0.9, 0.55 + (avg(battle.alive("ally")) - avg(battle.alive("enemy"))) / 100));
  }

  // ------------------------------------------------------------ pet
  let partyTurns = 0;
  async function petTurn() {
    partyTurns++;
    const every = pet ? PET_EVERY[pet.hook] : undefined;
    if (!pet || !every || partyTurns % every || battle.outcome()) return;
    await playEvents();
    petEl?.classList.remove("act"); void petEl?.offsetWidth; petEl?.classList.add("act");
    const power = 12 + setup.floor * 4;
    const foes = battle.alive("enemy");
    if (pet.hook === "burn" && foes.length) {
      const t = rng.pick(foes);
      log(`${pet.name} phun lửa vào ${t.name}!`);
      battle.petHit(t, "fire", power * 1.4);
      battle.addStatus(t, "burn", 2, 1, power * 0.3);
    } else if (pet.hook === "spark") {
      log(`${pet.name} phóng điện!`);
      for (const t of foes) battle.petHit(t, "lightning", power * 0.7);
    } else if (pet.hook === "rain") {
      log(`${pet.name} gọi mưa lành.`);
      for (const u of battle.alive("ally")) battle.heal(u, battle.maxHp(u) * 0.1);
    }
    await delay(250);
    await playEvents();
  }

  // ------------------------------------------------------------ main loop
  const loop = async (): Promise<BattleOutcome> => {
    refreshAll();
    if (!g.flags.cb_help2) { g.flags.cb_help2 = true; combatHelp(); }
    if (bossUnit && mech) {
      const minion = setup.enemies.find((e) => !ENEMIES[e.id]?.boss)?.id ?? getFloor(Math.max(1, setup.floor)).enemies[0];
      announce(`${mech.icon} ${mech.name}`, "warn", 1600);
      log(`${bossUnit.name}: ${mech.desc}`);
      battle.initBoss(bossUnit, mech.id, minion);
      await playEvents();
    }
    await delay(300);
    for (let guard = 0; guard < 2000; guard++) {
      const actor = battle.nextTurn();
      await playEvents();
      if (!actor) break;
      if (actor.side === "ally" && !auto && !battle.has(actor, "confuse")) {
        panel.classList.remove("idle");
        const c = await waitForPlayer(actor);
        if (c.kind === "flee") {
          if (rng.next() < fleeChance()) {
            log("Bỏ chạy thành công!");
            await delay(400);
            return "flee";
          }
          floaty(actor, "Chạy thất bại!", "miss");
          actor.av = battle.avFor(actor);
          await delay(400);
        } else if (c.kind === "item") {
          const it = getItem(c.item);
          if ((g.inventory[it.id] ?? 0) > 0 && it.use) {
            g.inventory[it.id]--;
            if (g.inventory[it.id] <= 0) delete g.inventory[it.id];
            battle.useItem(actor, it.use, c.target, setup.floor, it.id);
          }
        } else {
          battle.act(actor, { skill: c.skill, target: c.target, boost });
        }
        await petTurn();
      } else {
        panel.classList.add("idle");
        actorBox.replaceChildren(h("img", { class: "sprite", src: spriteURL(actor.sprite, actor.palette, 2), alt: "" }), h("b", null, actor.name), actor.side === "ally" ? " (tự động)…" : " đang hành động…");
        bpBox.replaceChildren();
        info.replaceChildren();
        grid.replaceChildren();
        tabs.replaceChildren();
        await delay(actor.side === "enemy" ? 250 : 120);
        if (actor.side === "enemy") battle.enemyAct(actor);
        else battle.act(actor, { ...chooseAction(battle, actor), boost: (actor.bp ?? 0) >= MAX_BP ? 1 : 0 });
        if (actor.side === "ally") await petTurn();
      }
      await playEvents();
    }
    return battle.outcome() === "win" ? "win" : "lose";
  };

  return loop().then(async (outcome) => {
    setActive(null);
    // write back HP/MP
    for (const u of allies) {
      const ch = g.chars[u.charId!];
      if (!ch) continue;
      ch.hp = u.hp <= 0 ? (outcome === "win" ? 1 : 0) : Math.min(u.hp, charStats(ch).hp);
      ch.mp = Math.max(0, Math.min(u.mp, charStats(ch).mp));
    }
    if (outcome === "flee") {
      el.remove();
      return outcome;
    }
    const result = h("div", { class: `result ${outcome === "win" ? "" : "lose"}` });
    panel.replaceChildren(result);
    if (outcome === "win") {
      let xp = 0, gold = 0;
      // breaking shields pays: +10% per break, up to +50%; an elite pays a lot more
      const bonus = Math.min(0.5, battle.breaks * 0.1) + (setup.elite ? 1 : 0);
      const loot: Record<string, number> = {};
      for (const u of enemies) {
        const def = ENEMIES[u.enemyId!];
        xp += Math.round(11 * XP_RATE * power(u.level) * (u.boss ? 6 : 1));
        gold += Math.round(rng.range(3, 6) * power(u.level) * (u.boss ? 6 : 1));
        // ordinary monsters drop a lot less than they used to; bosses keep their full table
        const f = u.boss ? 1 : 0.4;
        for (const d of def.drops) if (rng.next() < d.ch * f) loot[d.item] = (loot[d.item] ?? 0) + (u.boss ? rng.int(d.min ?? 1, d.max ?? 1) : 1);
        if (!u.boss && rng.chance(0.02 + setup.floor * 0.002)) loot.mana_crystal = (loot.mana_crystal ?? 0) + 1;
        if (u.boss) loot.monster_core = (loot.monster_core ?? 0) + 1;
        if (u.elite) {
          loot.mana_crystal = (loot.mana_crystal ?? 0) + rng.int(1, 3);
          loot.monster_core = (loot.monster_core ?? 0) + 1;
          if (rng.chance(0.5)) { const id = gearForFloor(Math.max(1, setup.floor), (xs) => rng.pick(xs), 1).id; loot[id] = (loot[id] ?? 0) + 1; }
        }
        // biome materials, essences and gear
        const fam = getFloor(Math.max(1, setup.floor)).family;
        const mats = BIOME_MATS[fam];
        if (mats && rng.chance(u.boss ? 1 : 0.1)) { const id = rng.pick([mats.hide, mats.fiber, mats.herb, mats.gem]); loot[id] = (loot[id] ?? 0) + (u.boss ? 3 : 1); }
        const el = ENEMY_EL[fam];
        if (el && ESSENCES[el] && rng.chance(u.boss ? 1 : 0.03)) loot[ESSENCES[el]] = (loot[ESSENCES[el]] ?? 0) + (u.boss ? 2 : 1);
        if (rng.chance(u.boss ? 1 : 0.02)) {
          for (let k = 0; k < (u.boss ? 2 : 1); k++) {
            const id = gearForFloor(Math.max(1, setup.floor), (xs) => rng.pick(xs), u.boss ? 1 : 0).id;
            loot[id] = (loot[id] ?? 0) + 1;
          }
        }
        const legs = LEGENDARY_BY_BIOME[fam];
        if (u.boss && legs?.length && rng.chance(0.35)) { const id = rng.pick(legs); loot[id] = (loot[id] ?? 0) + 1; }
      }
      xp = Math.round(xp * (1 + bonus + (pet?.hook === "xp" ? 0.25 : 0)));
      gold = Math.round(gold * (1 + bonus + (pet?.hook === "gold" ? 0.35 : 0)));
      if (pet?.hook === "pilfer") { const d = rng.pick(ENEMIES[enemies[0].enemyId!]?.drops ?? []); if (d) loot[d.item] = (loot[d.item] ?? 0) + 1; }
      if (pet?.hook === "forage" && rng.chance(0.3)) loot.potion_hp = (loot.potion_hp ?? 0) + 1;
      // pet eggs: sometimes from elites, often from bosses, always from every tenth floor's boss
      const bossWin = enemies.some((u) => u.boss);
      if ((bossWin && (setup.floor % 10 === 0 || rng.chance(0.25))) || (setup.elite && rng.chance(0.1))) loot[PET_EGG] = (loot[PET_EGG] ?? 0) + 1;
      g.stats.kills += enemies.length;
      g.gold += gold;
      if (g.expedition) g.expedition.bagGold += gold;
      const lootLines = giveToGame(g, loot);
      const lvl: string[] = [];
      for (const u of allies) {
        const ch = g.chars[u.charId!];
        if (ch) lvl.push(...giveXp(ch, u.hp > 0 ? xp : Math.round(xp / 2)));
      }
      if (enemies.some((u) => u.boss)) logMsg(g, `Hạ gục ${enemies.find((u) => u.boss)!.name}.`);
      result.append(...nn(
        h("h3", null, "Chiến Thắng!"),
        h("div", null, `+${xp} kinh nghiệm · +${gold} vàng`),
        setup.elite ? h("div", { class: "gold small" }, "⭐ Hạ gục Tinh Anh: vàng và kinh nghiệm ×2, chiến lợi phẩm hiếm!") : null,
        battle.breaks ? h("div", { class: "gold small" }, `💥 Phá khiên ×${battle.breaks}: thưởng +${Math.round(Math.min(0.5, battle.breaks * 0.1) * 100)}%`) : null,
        h("div", { class: "loot" }, lootLines.map((l) => h("span", null, l))),
        lvl.length ? h("div", { class: "gold" }, lvl.join(" ")) : null,
      ));
    } else {
      g.stats.deaths++;
      result.append(h("h3", null, "Thất Bại..."), h("p", { class: "muted" }, "Bóng tối nuốt chửng cả đội..."));
    }
    app.dirty();
    await new Promise<void>((r) => result.append(h("button", { class: "btn primary", style: "margin-top:8px;min-width:160px", onclick: () => r() }, "Tiếp tục")));
    el.remove();
    return outcome;
  });
}
