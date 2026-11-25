/**
 * Battle screen (Lone Wolf rules): the section's scene as the arena, the hero against each foe
 * in turn. A round: pick a number on the spinning 0-9 wheel, then the exchange plays out —
 * the hero dashes in and strikes (a mind attack flies as a wave of light), the foe answers,
 * damage numbers pop, the loser of the round reels.
 */
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { h, nn, sleep } from "../ui/dom";
import { iconEl, uiIcon } from "./art/icons";
import { portrait, withWeapon } from "./art/people";
import { battleExit, canEvade, epMax, heroCs, itemName, playRound, profile, startBattle, type Battle, type RoundResult } from "./engine";
import { Stage, type Actor, W as SW } from "./stage";
import type { AdvState, Book } from "./types";

const HERO_X = 96;
const FOE_X = 224;

function bar(cls: string) {
  const fill = h("i");
  const label = h("b");
  const el = h("div", { class: `adv-bar ${cls}` }, h("div", { class: "adv-bar-track" }, fill), label);
  return { el, set: (v: number, max: number) => { fill.style.width = `${Math.max(0, Math.min(100, (100 * v) / max))}%`; label.textContent = `${Math.max(0, v)}/${max}`; } };
}

export interface FightResult {
  battle: Battle;
  /** Section to go to, "" to stay (choices/random follow), null = death. */
  exit: string | null;
}

export function runFight(host: HTMLElement, book: Book, s: AdvState, onChange: () => void): Promise<FightResult> {
  playMusic("battle");
  sfx("encounter", "normal");
  const sec = book.sections[s.section];
  const c = sec.combat!;
  const b = startBattle(book, s, sec);
  const prof = profile(book);
  const heroLook = withWeapon("lonewolf", s.weapons[0]);

  return new Promise((resolve) => {
    const stage = new Stage({ bg: sec.scene.bg, time: sec.scene.time, weather: sec.scene.weather, mood: "combat", seed: `${book.id}-${s.section}` }, "adv-stage battle");
    const gy = stage.scene.groundY;
    const hero: Actor = { id: "lonewolf", look: heroLook, x: HERO_X, y: gy, facing: "right", pose: "idle", phase: 0 };
    const foeActors: Actor[] = b.foes.map((f, i) => ({ id: f.def.name, x: i === 0 ? FOE_X : SW + 40, y: gy, facing: "left", pose: "idle", phase: 200 * i }));
    stage.actors = [hero, ...foeActors];

    // HUD
    const heroBar = bar("hero");
    const foeBar = bar("foe");
    const foeName = h("div", { class: "adv-fname" });
    const foeCs = h("div", { class: "adv-fcs" });
    const ratioEl = h("div", { class: "adv-ratio" });
    const csList = h("div", { class: "adv-cs-list" });
    const wheel = h("div", { class: "adv-wheel" }, ...Array.from({ length: 10 }, (_, i) => h("span", { "data-n": String(i) }, String(i))));
    const log = h("div", { class: "adv-flog" });
    const actions = h("div", { class: "adv-factions" });
    const banner = h("div", { class: "adv-fbanner" });
    const el = h("div", { class: "adv-fight" },
      h("div", { class: "adv-fight-stage" }, stage.canvas,
        h("div", { class: "adv-fhud" },
          h("div", { class: "adv-fside hero" }, portrait(heroLook), h("div", null, h("div", { class: "adv-fname" }, s.name), heroBar.el)),
          h("div", { class: "adv-fside foe" }, h("div", null, foeName, foeBar.el, foeCs))),
        banner),
      h("div", { class: "adv-fpanel" },
        h("div", { class: "adv-frow" }, ratioEl, wheel),
        csList, log, actions));
    host.append(el);

    const say = (t: string, cls = "") => {
      log.prepend(h("div", { class: cls }, t));
      while (log.childElementCount > 3) log.lastElementChild!.remove();
    };

    let busy = false;
    function render() {
      const foe = b.foes[b.idx];
      heroBar.set(s.ep, epMax(book, s));
      foeBar.set(foe.ep, foe.def.ep);
      foeName.textContent = `${foe.def.name}${b.foes.length > 1 ? ` (${b.idx + 1}/${b.foes.length})` : ""}`;
      foeCs.replaceChildren(iconEl(uiIcon("cs"), 1), ` ${foe.def.cs}`);
      const cs = heroCs(book, s, c, foe.def, b.mind, b.round);
      const ratio = cs.total - foe.def.cs;
      ratioEl.replaceChildren(h("span", null, "Chênh lệch"), h("b", { class: ratio >= 0 ? "good" : "bad" }, `${ratio > 0 ? "+" : ""}${ratio}`));
      csList.replaceChildren(h("span", null, iconEl(uiIcon("cs"), 1), ` Kỹ Năng Chiến Đấu ${cs.total}`),
        ...cs.parts.slice(1).map((p) => h("span", { class: p.v >= 0 ? "good" : "bad" }, `${p.label} ${p.v > 0 ? "+" : ""}${p.v}`)));
      const btn = (label: string, icon: Parameters<typeof uiIcon>[0], f: () => void, cls = "", disabled = false) =>
        h("button", { class: `btn ${cls}`, type: "button", disabled: busy || disabled, onclick: f }, iconEl(uiIcon(icon), 2), label);
      const minds = prof.mind.map((m, i) => ({ m, i })).filter(({ m }) => s.disciplines.includes(m[0]));
      actions.replaceChildren(...nn(
        btn("Đánh", "cs", () => void round(false), "primary big"),
        ...minds.length ? [btn(b.mind >= 0 ? `${book.names.disc[prof.mind[b.mind][0]]} +${prof.mind[b.mind][1]}${prof.mind[b.mind][2] ? ` (−${prof.mind[b.mind][2]})` : ""}` : "Không dùng tâm lực", "mind", () => {
          // cycle: each mind option, then none
          const order = [...minds.map((x) => x.i), -1];
          b.mind = order[(order.indexOf(b.mind) + 1) % order.length];
          render();
        }, b.mind >= 0 ? "on" : "")] : [],
        c.evade ? btn(canEvade(book, s, b) ? "Chạy trốn" : `Chạy trốn (sau ${c.evade.after - b.round} hiệp)`, "flee", () => void round(true), "", !canEvade(book, s, b)) : null,
      ));
    }

    async function spin(n: number) {
      const cells = [...wheel.children] as HTMLElement[];
      wheel.classList.add("spinning");
      const turns = 14 + n;
      for (let i = 0; i <= turns; i++) {
        cells.forEach((x) => x.classList.toggle("lit", Number(x.dataset.n) === i % 10));
        sfx("blip", String(300 + (i % 10) * 30));
        await sleep(30 + i * 4);
      }
      wheel.classList.remove("spinning");
      cells.forEach((x) => x.classList.toggle("lit", Number(x.dataset.n) === n));
    }

    async function round(evade: boolean) {
      if (busy || b.over) return;
      busy = true;
      render();
      const foeA = foeActors[b.idx];
      const r: RoundResult = playRound(book, s, b, evade);
      onChange();
      await spin(r.n);
      await exchange(r, foeA);
      busy = false;
      if (b.over) return finish();
      if (r.foeKilled) await nextFoe();
      render();
    }

    async function exchange(r: RoundResult, foeA: Actor) {
      const usingMind = b.mind >= 0 && r.mindCost >= 0 && prof.mind[b.mind] && s.disciplines.includes(prof.mind[b.mind][0]);
      if (!r.evaded) {
        // hero strikes
        if (usingMind) {
          stage.play(hero, "cast", 520);
          sfx("cast", "psychic");
          await sleep(220);
          await projectile(hero.x + 10, gy - 28, foeA.x - 8, gy - 26, "#c9a2ff");
        }
        await stage.moveTo(hero, foeA.x - 34, gy, 0.22);
        stage.play(hero, "attack", 380);
        sfx(r.foeLoss >= 6 ? "crit" : "slash");
        await sleep(170);
        slash(foeA.x - 6, gy - 26, r.foeLoss >= 6);
        if (r.foeLoss > 0) {
          foeA.shake = stage.now + 260;
          stage.play(foeA, "hurt", 300);
          stage.burst(foeA.x, gy - 26, "#ffefc0", 10 + r.foeLoss, 1.8, { glow: true });
          stage.float(`−${r.foeLoss}`, foeA.x, gy - 50, r.foeLoss >= 6 ? "#ffd24a" : "#fff", r.foeLoss >= 6);
          if (r.foeLoss >= 6) { stage.shake(220); stage.flash("#fff", 90); }
          say(`Bạn gây ${r.foeLoss} sát thương cho ${b.foes[r.foe].def.name}.`, "good");
        } else { stage.float("Trượt", foeA.x, gy - 50, "#aab"); sfx("miss"); }
        await sleep(260);
      } else {
        say("Bạn quay lưng chạy trốn!");
      }
      // foe strikes back
      const heroLossCombat = r.heroLoss - r.mindCost;
      if (!r.foeKilled || r.evaded) {
        if (!r.evaded) await stage.moveTo(hero, HERO_X + 18, gy, 0.2);
        await stage.moveTo(foeA, hero.x + 34, gy, 0.22);
        stage.play(foeA, "attack", 380);
        await sleep(160);
      }
      if (heroLossCombat > 0) {
        sfx("hit");
        hero.flash = stage.now + 120; hero.shake = stage.now + 260;
        stage.play(hero, "hurt", 320);
        stage.burst(hero.x, gy - 26, "#ff5a5a", 8 + heroLossCombat, 1.5);
        stage.float(`−${heroLossCombat}`, hero.x, gy - 50, "#ff6b6b", heroLossCombat >= 6);
        stage.shake(160);
        say(`Bạn mất ${heroLossCombat} Sức Bền.`, "bad");
      } else if (!r.foeKilled) { stage.float("Đỡ được", hero.x, gy - 50, "#cfe"); sfx("shield"); }
      if (r.mindCost) { stage.float(`−${r.mindCost} tâm lực`, hero.x, gy - 62, "#c9a2ff"); }
      await sleep(240);
      if (!r.foeKilled || r.evaded) await stage.moveTo(foeA, FOE_X, gy, 0.2);
      if (!r.evaded) await stage.moveTo(hero, HERO_X, gy, 0.2);
      hero.facing = "right";
      foeA.facing = "left";
      if (r.foeKilled && !r.evaded) {
        foeA.pose = "dead";
        sfx("death");
        say(`${b.foes[r.foe].def.name} gục ngã!`, "good");
        for (let a = 1; a >= 0; a -= 0.1) { foeA.alpha = a; await sleep(40); }
        foeA.hidden = true;
      }
      if (r.heroKilled) { hero.pose = "dead"; }
    }

    async function nextFoe() {
      const nf = foeActors[b.idx];
      if (!nf) return;
      say(`${b.foes[b.idx].def.name} xông lên!`);
      await stage.moveTo(nf, FOE_X, gy, 0.15);
      nf.facing = "left";
    }

    function projectile(x0: number, y0: number, x1: number, y1: number, col: string): Promise<void> {
      return new Promise((res) => {
        const start = stage.now;
        stage.overlays.push((g, t) => {
          const k = Math.min(1, (t - start) / 260);
          const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 8;
          g.globalCompositeOperation = "lighter";
          for (let i = 0; i < 6; i++) {
            g.globalAlpha = 0.5 - i * 0.07;
            g.fillStyle = col;
            const r = 6 - i;
            g.beginPath(); g.arc(x - i * 5 * Math.sign(x1 - x0), y, r, 0, Math.PI * 2); g.fill();
          }
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
          if (k >= 1) { stage.burst(x1, y1, col, 16, 2, { glow: true }); res(); return false; }
          return true;
        });
      });
    }

    function slash(x: number, y: number, big: boolean) {
      const start = stage.now;
      stage.overlays.push((g, t) => {
        const k = (t - start) / 180;
        if (k > 1) return false;
        g.strokeStyle = big ? "#ffe9a0" : "#ffffff";
        g.globalAlpha = 1 - k;
        g.lineWidth = big ? 3 : 2;
        g.beginPath();
        g.arc(x, y, 14 + k * 6, -1.2 + k, 0.9 + k);
        g.stroke();
        g.globalAlpha = 1;
        return true;
      });
    }

    async function finish() {
      render();
      actions.replaceChildren();
      const exit = battleExit(book, s, b);
      onChange();
      const win = b.over === "win";
      const title = win ? "CHIẾN THẮNG" : b.over === "evaded" ? "ĐÃ THOÁT" : b.over === "timeout" ? (c.compare ? "HẾT HIỆP" : "HẾT GIỜ") : b.over === "beaten" ? "THUA TRẬN" : "BẠI TRẬN";
      if (win) { hero.pose = "idle"; stage.play(hero, "cast", 900); stage.burst(hero.x, gy - 40, "#ffd27a", 30, 2.2, { glow: true }); }
      sfx(b.over === "lose" ? "defeat" : "victory");
      const done = (to: string | null) => { stage.destroy(); el.remove(); playMusic("title"); resolve({ battle: b, exit: to }); };
      const alts = b.over === "evaded" ? c.evade?.alt ?? [] : [];
      const buttons = alts.length
        ? [h("button", { class: "btn primary", type: "button", onclick: () => done(exit) }, "Chạy theo lối đã định"), ...alts.map((a) => h("button", { class: "btn", type: "button", onclick: () => done(a.to) }, a.text))]
        : [h("button", { class: "btn primary big", type: "button", onclick: () => done(exit) }, "Tiếp tục")];
      banner.replaceChildren(h("div", { class: `adv-fbanner-box ${b.over}` }, h("div", { class: "t" }, title), ...buttons));
      banner.classList.add("show");
    }

    say(b.foes.length > 1 ? `${b.foes.length} kẻ thù lần lượt xông vào bạn.` : `${b.foes[0].def.name} chặn đường bạn!`);
    if (s.weapons.length === 0) say("Bạn không có vũ khí: đánh tay không (−4).", "bad");
    else say(`Bạn cầm ${itemName(book, s.weapons[0])}.`);
    foeActors[0].x = SW + 20;
    void stage.moveTo(foeActors[0], FOE_X, gy, 0.1);
    render();
  });
}
