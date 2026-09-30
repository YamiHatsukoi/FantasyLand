import { app } from "../app";
import { chooseAction } from "../combat/ai";
import { describeSkill, skillCostText } from "../combat/describe";
import { Battle } from "../combat/engine";
import { unitFromCharacter, unitFromEnemy } from "../combat/factory";
import { ELEMENTS, STATUSES } from "../combat/statuses";
import type { BattleEvent, Eff, Skill, Unit } from "../combat/types";
import { Rng } from "../core/rng";
import { XP_RATE, charStats, giveXp, logMsg, partyBuffs } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { BIOME_MATS, ESSENCES, LEGENDARY_BY_BIOME, gearForFloor, getItem, type ItemDef } from "../data/items";
import { iconURL } from "../render/icons";
import { getSkill } from "../data/skills";
import { spriteURL } from "../render/pixel";
import { T, TS, tileSet } from "../render/tiles";
import { giveToGame } from "../story/runner";
import { BIOMES } from "../world/biomes";
import { getFloor } from "../world/floors";
import { bar, h, nn, sleep, toast } from "../ui/dom";

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
}

export type BattleOutcome = "win" | "lose" | "flee";

interface UnitView {
  root: HTMLElement;
  img: HTMLImageElement;
  hp: HTMLElement;
  mp?: HTMLElement;
  st: HTMLElement;
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

const groundCache = new Map<string, string>();
function groundURL(biomeId: string): string {
  let url = groundCache.get(biomeId);
  if (!url) {
    const set = tileSet(BIOMES[biomeId] ?? BIOMES.forest);
    const c = document.createElement("canvas");
    c.width = TS * 2;
    c.height = TS * 2;
    const g = c.getContext("2d")!;
    [set.tiles[T.GROUND][0], set.tiles[T.GROUND][1], set.tiles[T.DECOR][1], set.tiles[T.GROUND][2]].forEach((t, i) => g.drawImage(t, (i % 2) * TS, Math.floor(i / 2) * TS));
    url = c.toDataURL();
    groundCache.set(biomeId, url);
  }
  return url;
}

export function runBattle(setup: BattleSetup): Promise<BattleOutcome> {
  const g = app.game;
  const rng = new Rng(Date.now() & 0xffffffff);
  const buffs = partyBuffs(g);
  const allies = g.party.map((id) => g.chars[id]).filter(Boolean).map((ch) => unitFromCharacter(ch, buffs));
  const enemies = setup.enemies.map((e, i) => unitFromEnemy(e.id, e.level, i));
  const battle = new Battle(allies, enemies, rng.int(1, 1e9));
  for (const e of setup.enemyFx ?? []) for (const u of enemies) battle.addStatus(u, e.s, e.t ?? 2, e.st ?? 1, 0);
  battle.drainEvents();
  g.stats.battles++;

  const biome = BIOMES[setup.biome] ?? BIOMES.forest;
  let auto = pref.auto;
  let fast = pref.fast;
  const delay = (ms: number) => sleep(fast ? ms * 0.45 : ms);

  // ------------------------------------------------------------ DOM
  const timeline = h("div", { class: "timeline" });
  const autoBtn = h("button", { class: `btn small ${auto ? "primary" : ""}`, onclick: () => setAuto(!auto) }, "⚙️ Tự động");
  const fastBtn = h("button", { class: `btn small ${fast ? "primary" : ""}`, onclick: () => { fast = !fast; pref.fast = fast; fastBtn.classList.toggle("primary", fast); } }, "⏩ x2");
  const fieldE = h("div", { class: "field-enemies" });
  const fieldA = h("div", { class: "field-allies" });
  const info = h("div", { class: "cb-info" }, "…");
  const tabs = h("div", { class: "tabs" });
  const grid = h("div", { class: "skill-grid" });
  const logLine = h("div", { class: "cb-log" });
  const panel = h("div", { class: "cb-panel" }, info, tabs, grid, logLine);
  const el = h("div", { class: "combat", style: `--cb1:${biome.bg[0]};--cb2:${biome.bg[1]};--ground:url(${groundURL(setup.biome)})` },
    h("div", { class: "cb-top" }, timeline, autoBtn, fastBtn), fieldE, fieldA, panel);
  document.body.append(el);

  const views = new Map<string, UnitView>();
  for (const u of enemies) {
    const img = h("img", { class: "sprite", src: spriteURL(u.sprite, u.palette, 8), alt: u.name, draggable: false });
    const hp = bar(u.hp, battle.maxHp(u), "hp");
    const st = h("div", { class: "statuses" });
    const root = h("div", { class: `unit enemy ${u.boss ? "boss" : ""}` }, st, img, h("div", { class: "uname" }, `${u.name} · Lv${u.level}`), hp);
    root.addEventListener("click", () => onUnitClick(u));
    fieldE.append(root);
    views.set(u.uid, { root, img, hp, st });
  }
  for (const u of allies) {
    const img = h("img", { class: "sprite", src: spriteURL(u.sprite, u.palette, 4), alt: u.name, draggable: false });
    const hp = bar(u.hp, battle.maxHp(u), "hp", "");
    const mp = bar(u.mp, battle.maxMp(u), "mp", "");
    const st = h("div", { class: "statuses" });
    const root = h("div", { class: "unit ally-card" }, img, h("div", { class: "info" }, h("div", { class: "uname" }, u.name), hp, mp, st));
    root.addEventListener("click", () => onUnitClick(u));
    fieldA.append(root);
    views.set(u.uid, { root, img, hp, mp, st });
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

  function refresh(u: Unit) {
    const v = views.get(u.uid);
    if (!v) return;
    const maxHp = battle.maxHp(u);
    (v.hp.firstChild as HTMLElement).style.width = `${(u.hp / maxHp) * 100}%`;
    const lbl = v.hp.querySelector(".bar-label");
    if (lbl) lbl.textContent = `${u.hp}/${maxHp}`;
    if (v.mp) {
      const maxMp = battle.maxMp(u);
      (v.mp.firstChild as HTMLElement).style.width = `${(u.mp / maxMp) * 100}%`;
      const l2 = v.mp.querySelector(".bar-label");
      if (l2) l2.textContent = `${u.mp}/${maxMp}`;
    }
    v.st.replaceChildren(...u.statuses.map((s) => {
      const d = STATUSES[s.id];
      const span = h("span", { class: `st ${d.kind}`, title: `${d.name}: ${d.desc} (${s.turns} lượt)` }, d.icon, s.stacks > 1 ? h("sub", null, String(s.stacks)) : null);
      span.addEventListener("click", (e) => { e.stopPropagation(); toast(`${d.icon} ${d.name} (${s.turns} lượt${s.stacks > 1 ? `, ${s.stacks} tầng` : ""}): ${d.desc}`); });
      return span;
    }));
    v.root.classList.toggle("dead", u.hp <= 0);
  }

  function refreshAll() {
    for (const u of battle.units) refresh(u);
    timeline.replaceChildren(...battle.timeline(9).map((u) =>
      h("img", { class: `tl sprite ${u.side}`, src: spriteURL(u.sprite, u.palette, 2), title: u.name })));
  }

  function floaty(u: Unit, text: string, cls: string) {
    const v = views.get(u.uid);
    if (!v) return;
    const f = h("div", { class: `floaty ${cls}` }, text);
    v.root.append(f);
    setTimeout(() => f.remove(), 1200);
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
        logLine.textContent = `${u.name} dùng ${icon} ${name}`;
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
        }
        const col = ELEMENTS[ev.el]?.color ?? "#fff";
        const f = h("div", { class: `floaty ${ev.crit ? "crit" : ""}`, style: `color:${col}` }, `${ev.crit ? "💥" : ""}${ev.amount}${ev.absorbed ? ` (🔰${ev.absorbed})` : ""}`);
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
        logLine.textContent = `Phản ứng: ${ev.name}!`;
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
      case "death": {
        const u = battle.unit(ev.uid);
        if (u) { refresh(u); logLine.textContent = `${u.name} đã gục ngã!`; }
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

  // ------------------------------------------------------------ player input
  let pending: { actor: Unit; resolve: (c: PlayerChoice) => void } | null = null;
  let selected: { kind: "skill"; sk: Skill } | { kind: "item"; it: ItemDef } | null = null;
  let tab: "skills" | "items" = "skills";

  function clearTargets() {
    for (const v of views.values()) v.root.classList.remove("targetable");
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
    const weak = Object.entries(u.resist).filter(([, v]) => (v ?? 1) > 1).map(([k]) => ELEMENTS[k as keyof typeof ELEMENTS].icon);
    const strong = Object.entries(u.resist).filter(([, v]) => (v ?? 1) < 1).map(([k]) => ELEMENTS[k as keyof typeof ELEMENTS].icon);
    return `Yếu: ${weak.join(" ") || "—"}   Kháng: ${strong.join(" ") || "—"}`;
  }

  function consumables(): ItemDef[] {
    return Object.keys(g.inventory).map(getItem).filter((it) => it.use && it.use.target !== "none" && it.use.battle !== false && !it.use.special && (g.inventory[it.id] ?? 0) > 0);
  }

  function renderPanel(actor: Unit) {
    tabs.replaceChildren(...nn(
      h("button", { class: tab === "skills" ? "on" : "", onclick: () => { tab = "skills"; selected = null; clearTargets(); renderPanel(actor); } }, "⚔️ Kỹ năng"),
      h("button", { class: tab === "items" ? "on" : "", onclick: () => { tab = "items"; selected = null; clearTargets(); renderPanel(actor); } }, `🎒 Vật phẩm (${consumables().length})`),
      setup.noFlee ? null : h("button", { onclick: () => { if (pending) { const p = pending; pending = null; clearTargets(); p.resolve({ kind: "flee" }); } } }, "🏃 Bỏ chạy"),
    ));
    grid.replaceChildren();
    if (tab === "skills") {
      for (const id of ["attack", "defend", ...actor.skills]) {
        const sk = getSkill(id);
        const can = battle.canUse(actor, sk);
        const btn = h("button", { class: `skill-btn ${selected?.kind === "skill" && selected.sk.id === id ? "sel" : ""}`, disabled: !can.ok },
          h("span", { class: "ico" }, sk.icon),
          h("span", null, h("div", { class: "nm" }, sk.name), h("div", { class: "cs" }, can.ok ? skillCostText(sk) : can.reason)));
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
    if (!selected) info.replaceChildren(h("b", null, `Lượt của ${actor.name}.`), " Chọn kỹ năng hoặc vật phẩm. Chạm vào kẻ địch để xem điểm yếu.");
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
    info.replaceChildren(h("b", null, `${sk.icon} ${sk.name}`), ` (${skillCostText(sk)}) — ${lines.join(" ")}`, " ",
      needs ? h("span", { class: "gold" }, "👉 Chạm vào mục tiêu.") : h("button", { class: "btn small primary", onclick: () => selectSkill(actor, sk) }, "Dùng ▸"));
    if (needs) for (const t of battle.validTargets(actor, sk)) views.get(t.uid)?.root.classList.add("targetable");
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
    info.replaceChildren(h("b", null, `${it.icon} ${it.name}`), ` — ${it.desc} `,
      needs ? h("span", { class: "gold" }, "👉 Chạm vào đồng đội.") : h("button", { class: "btn small primary", onclick: () => selectItem(actor, it) }, "Dùng ▸"));
    if (needs) for (const t of targetsFor(actor)) views.get(t.uid)?.root.classList.add("targetable");
  }

  function waitForPlayer(actor: Unit): Promise<PlayerChoice> {
    selected = null;
    tab = "skills";
    renderPanel(actor);
    return new Promise((resolve) => { pending = { actor, resolve }; });
  }

  function fleeChance() {
    const avg = (us: Unit[]) => us.reduce((s, u) => s + battle.stat(u, "spd"), 0) / Math.max(1, us.length);
    return Math.max(0.2, Math.min(0.9, 0.55 + (avg(battle.alive("ally")) - avg(battle.alive("enemy"))) / 100));
  }

  // ------------------------------------------------------------ main loop
  const loop = async (): Promise<BattleOutcome> => {
    refreshAll();
    await delay(300);
    for (let guard = 0; guard < 2000; guard++) {
      const actor = battle.nextTurn();
      await playEvents();
      if (!actor) break;
      if (actor.side === "ally" && !auto && !battle.has(actor, "confuse")) {
        panel.style.visibility = "visible";
        const c = await waitForPlayer(actor);
        if (c.kind === "flee") {
          if (rng.next() < fleeChance()) {
            logLine.textContent = "Bỏ chạy thành công!";
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
          battle.act(actor, { skill: c.skill, target: c.target });
        }
      } else {
        info.replaceChildren(h("b", null, actor.name), actor.side === "ally" ? " (tự động)…" : " đang hành động…");
        grid.replaceChildren();
        tabs.replaceChildren();
        await delay(actor.side === "enemy" ? 250 : 120);
        battle.act(actor, chooseAction(battle, actor));
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
      const loot: Record<string, number> = {};
      for (const u of enemies) {
        const def = ENEMIES[u.enemyId!];
        xp += Math.round(11 * XP_RATE * u.level * (u.boss ? 6 : 1));
        gold += Math.round(rng.range(3, 6) * u.level * (u.boss ? 6 : 1));
        // ordinary monsters drop a lot less than they used to; bosses keep their full table
        const f = u.boss ? 1 : 0.4;
        for (const d of def.drops) if (rng.next() < d.ch * f) loot[d.item] = (loot[d.item] ?? 0) + (u.boss ? rng.int(d.min ?? 1, d.max ?? 1) : 1);
        if (!u.boss && rng.chance(0.02 + setup.floor * 0.002)) loot.mana_crystal = (loot.mana_crystal ?? 0) + 1;
        if (u.boss) loot.monster_core = (loot.monster_core ?? 0) + 1;
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
