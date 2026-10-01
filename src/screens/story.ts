import { app } from "../app";
import { Rng } from "../core/rng";
import { spriteImg } from "../render/pixel";
import { EVENTS } from "../story";
import { ATTR_NAMES, applyEffect, condText, evalCond, fillText, rollCheck, type CheckResult, type StoryCtx } from "../story/runner";
import type { BattleSpec, Choice, Effect, Scene } from "../story/types";
import { h } from "../ui/dom";

export type BattleOutcome = "win" | "lose" | "flee";

export interface StoryOptions {
  floor: number;
  vars?: Record<string, string>;
  bg?: [string, string];
  battle?: (spec: BattleSpec) => Promise<BattleOutcome>;
}

export interface StoryResult {
  done: boolean;
  defeated: boolean;
}

export function playStory(eventId: string, opts: StoryOptions): Promise<StoryResult> {
  const ev = EVENTS[eventId];
  if (!ev) return Promise.resolve({ done: true, defeated: false });
  const ctx: StoryCtx = { g: app.game, floor: opts.floor, vars: opts.vars ?? {}, rng: new Rng(Date.now() & 0xffffffff) };

  return new Promise((resolve) => {
    const title = h("h2", { class: "story-title" }, fillText(ev.title, ctx));
    const stage = h("div", { class: "story-stage" });
    const box = h("div", { class: "story-box" });
    const choiceHost = h("div", { class: "story-choices" });
    const el = h("div", { class: "story", style: opts.bg ? `--sb1:${opts.bg[0]};--sb2:${opts.bg[1]}` : "" },
      h("div", { class: "story-inner" }, title, stage, choiceHost, box));
    document.body.append(el);

    let typing: number | undefined;
    // number keys pick a choice, space / enter finish the typewriter
    const onKey = (e: KeyboardEvent) => {
      if (el.style.visibility === "hidden" || document.querySelector(".backdrop")) return;
      if ((e.key === " " || e.key === "Enter") && typing) { e.preventDefault(); box.click(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && !(e.target instanceof HTMLInputElement)) {
        const btn = choiceHost.querySelectorAll<HTMLButtonElement>(".choice")[n - 1];
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
      }
    };
    window.addEventListener("keydown", onKey);
    const finish = (res: StoryResult) => {
      window.clearInterval(typing);
      window.removeEventListener("keydown", onKey);
      el.remove();
      app.dirty();
      resolve(res);
    };

    const runEffects = (fx: Effect[] | undefined): { lines: string[]; battle?: BattleSpec } => {
      const lines: string[] = [];
      let battle: BattleSpec | undefined;
      for (const e of fx ?? []) {
        if ("battle" in e) battle = e.battle;
        else lines.push(...applyEffect(e, ctx));
      }
      return { lines, battle };
    };

    const doBattle = async (spec: BattleSpec) => {
      if (!opts.battle) return show(spec.win, null, []);
      el.style.visibility = "hidden";
      const out = await opts.battle(spec);
      el.style.visibility = "";
      if (out === "win") show(spec.win, null, []);
      else if (out === "lose") {
        if (spec.lose) show(spec.lose, null, []);
        else finish({ done: false, defeated: true });
      } else finish({ done: false, defeated: false });
    };

    function show(sceneId: string, dice: CheckResult | null, carried: string[]) {
      let scene: Scene | undefined = ev.scenes[sceneId];
      for (let guard = 0; scene?.route && guard < 10; guard++) {
        const route: NonNullable<Scene["route"]> = scene.route;
        const r = route.find((x) => evalCond(x.cond, ctx));
        scene = r ? ev.scenes[r.to] : undefined;
      }
      if (!scene) return finish({ done: true, defeated: false });
      const sc = scene;
      const { lines, battle } = runEffects(sc.fx);
      const fxLines = [...carried, ...lines];

      stage.replaceChildren();
      const portrait = sc.portrait ?? ev.portrait;
      if (portrait) stage.append(spriteImg(portrait, undefined, "sprite story-portrait"));

      box.replaceChildren();
      choiceHost.replaceChildren();
      if (sc.speaker) box.append(h("div", { class: "speaker" }, sc.speaker));
      const textEl = h("div", { class: "story-text" });
      box.append(textEl);
      if (dice) {
        box.prepend(h("div", { class: `dice ${dice.pass ? "pass" : "fail"}` },
          `🎲 ${dice.who}: d20 (${dice.roll}) ${dice.bonus >= 0 ? "+" : "−"} ${Math.abs(dice.bonus)} = ${dice.total} ${dice.pass ? "≥" : "<"} ${dice.dc} — ${dice.pass ? "Thành công!" : "Thất bại"}`));
      }
      const full = fillText(sc.text, ctx);
      const after = h("div");
      box.append(after);

      const renderRest = () => {
        if (fxLines.length) after.append(h("div", { class: "fx-list" }, fxLines.map((l) => h("span", null, l))));
        const choices = h("div", { class: "choices" });
        choiceHost.append(choices);
        if (battle) {
          choices.append(h("button", { class: "choice", onclick: () => void doBattle(battle) }, "⚔️ Vào trận!"));
          return;
        }
        if (sc.input === "name") {
          const input = h("input", { class: "input", maxlength: "20", placeholder: "Tên của bạn", value: "" });
          const ok = h("button", { class: "btn primary", type: "submit" }, "Xác nhận");
          const form = h("form", { class: "row" }, h("div", { class: "grow" }, input), ok);
          input.style.width = "100%";
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = input.value.replace(/\s+/g, " ").trim().slice(0, 20);
            if (!name) return;
            ctx.g.chars[ctx.g.heroId].name = name;
            show(sc.next!, null, []);
          });
          choices.append(form);
          setTimeout(() => input.focus(), 50);
          return;
        }
        const list = (sc.choices ?? []).filter((c) => !c.hide || evalCond(c.cond, ctx));
        if (!list.length) {
          const label = sc.next ? "Tiếp tục ▸" : "Kết thúc";
          choices.append(h("button", { class: "choice", onclick: () => (sc.next ? show(sc.next, null, []) : finish({ done: !sc.keep, defeated: false })) }, label));
          return;
        }
        for (const c of list) choices.append(choiceButton(c, sc));
      };

      // typewriter
      window.clearInterval(typing);
      let i = 0;
      const step = Math.max(2, Math.ceil(full.length / 90));
      const complete = () => {
        window.clearInterval(typing);
        typing = undefined;
        textEl.textContent = full;
        if (!after.childElementCount) renderRest();
      };
      if (!full) complete();
      else {
        typing = window.setInterval(() => {
          i += step;
          textEl.textContent = full.slice(0, i);
          if (i >= full.length) complete();
        }, 16);
        box.onclick = () => { if (typing) complete(); };
      }
      box.scrollTop = 0;
    }

    function choiceButton(c: Choice, sc: Scene) {
      const ok = evalCond(c.cond, ctx);
      const btn = h("button", { class: `choice ${ok ? "" : "locked"}`, disabled: !ok },
        fillText(c.text, ctx),
        c.check ? h("span", { class: "chk" }, `[${ATTR_NAMES[c.check.attr]} ${c.check.dc}]`) : null,
        !ok ? h("span", { class: "req" }, `🔒 ${condText(c.cond)}`) : null,
      );
      btn.addEventListener("click", () => {
        if (!ok) return;
        const { lines, battle } = runEffects(c.fx);
        if (battle) return void doBattle(battle);
        if (c.check) {
          const r = rollCheck(c.check.attr, c.check.dc, ctx);
          return show(r.pass ? c.check.pass : c.check.fail, r, lines);
        }
        if (c.next) return show(c.next, null, lines);
        finish({ done: !(c.keep || sc.keep), defeated: false });
      });
      return btn;
    }

    show(ev.start, null, []);
  });
}
