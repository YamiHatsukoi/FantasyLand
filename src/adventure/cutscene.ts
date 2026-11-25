/**
 * Cutscenes: the big moments of a book (scene.cutscene = true) play as a short film on the
 * section's stage — letterbox bars, the cast walks in, narration types out line by line,
 * quoted speech appears in a dialogue box with the speaker's portrait and a bubble over them.
 * Tap to advance; "Bỏ qua" skips to the page.
 */
import { sfx } from "../audio/sfx";
import { h, sleep } from "../ui/dom";
import { isPersonActor, portrait, type Look } from "./art/people";
import { Stage, W as SW } from "./stage";
import type { Book, Section } from "./types";

interface Beat {
  kind: "say" | "tell";
  text: string;
  who?: string;
}

/** Splits paragraphs into narration and quoted speech. */
export function beats(sec: Section): Beat[] {
  const out: Beat[] = [];
  const speakers = sec.scene.actors.filter((a) => a !== "lonewolf");
  let turn = 0;
  for (const p of sec.text) {
    const parts = p.split(/(“[^”]+”|"[^"]+")/).map((x) => x.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^[“"]/.test(part)) {
        const who = speakers.length ? speakers[turn % speakers.length] : undefined;
        out.push({ kind: "say", text: part.replace(/^[“"]|[”"]$/g, ""), who });
      } else {
        for (const sent of part.match(/[^.!?…]+[.!?…]*\s*/g) ?? [part]) {
          const last = out[out.length - 1];
          if (last && last.kind === "tell" && last.text.length + sent.length < 170) last.text += ` ${sent.trim()}`;
          else out.push({ kind: "tell", text: sent.trim() });
        }
        if (/\bnói\b|\bhỏi\b|\bđáp\b|\bhét\b/.test(part)) turn++;
      }
    }
  }
  return out.filter((b) => b.text);
}

export function playCutscene(host: HTMLElement, book: Book, sid: string, heroLook: Look): Promise<void> {
  const sec = book.sections[sid];
  const stage = new Stage({ bg: sec.scene.bg, time: sec.scene.time, weather: sec.scene.weather, mood: sec.scene.mood, seed: `${book.id}-${sid}` }, "adv-stage cine");
  const cast = sec.scene.actors.length ? sec.scene.actors : ["lonewolf"];
  const actors = stage.cast(cast, heroLook);
  // everyone walks in from the edges
  const targets = actors.map((a) => ({ x: a.x, y: a.y }));
  actors.forEach((a, i) => { a.x = i === 0 ? -20 : SW + 20 + i * 18; });

  const caption = h("div", { class: "adv-cine-caption" });
  const dlg = h("div", { class: "adv-cine-dlg" });
  const skip = h("button", { class: "btn small adv-cine-skip", type: "button" }, "Bỏ qua ▸▸");
  const el = h("div", { class: "adv-cine" }, h("div", { class: "adv-cine-bar top" }), stage.canvas, h("div", { class: "adv-cine-bar bottom" }), caption, dlg, skip);
  host.append(el);

  let skipped = false;
  let advance: (() => void) | null = null;
  const tap = () => advance?.();
  el.addEventListener("pointerup", tap);
  return new Promise((resolve) => {
    const end = () => {
      if (skipped) return;
      skipped = true;
      el.classList.add("out");
      setTimeout(() => { stage.destroy(); el.remove(); resolve(); }, 350);
    };
    skip.onclick = (e) => { e.stopPropagation(); end(); };
    const waitTap = (ms: number) => new Promise<void>((res) => {
      const timer = setTimeout(() => { advance = null; res(); }, ms);
      advance = () => { clearTimeout(timer); advance = null; res(); };
    });
    const typeOut = async (box: HTMLElement, text: string) => {
      box.textContent = "";
      let fast = false;
      advance = () => { fast = true; };
      for (let i = 0; i < text.length && !skipped; i++) {
        box.textContent = text.slice(0, i + 1);
        if (!fast && i % 2 === 0) await sleep(16);
      }
      advance = null;
    };
    void (async () => {
      sfx("transition");
      await Promise.all(actors.map((a, i) => stage.moveTo(a, targets[i].x, targets[i].y, 0.07)));
      actors.forEach((a, i) => { a.facing = i === 0 ? "right" : "left"; });
      for (const bt of beats(sec)) {
        if (skipped) return;
        if (bt.kind === "tell") {
          dlg.classList.remove("show");
          caption.classList.add("show");
          await typeOut(caption, bt.text);
        } else {
          caption.classList.remove("show");
          const speaker = bt.who ? actors.find((a) => a.id === bt.who) : undefined;
          const face = bt.who && isPersonActor(bt.who) ? portrait(bt.who) : portrait(heroLook);
          face.className = "pix";
          const txt = h("div", { class: "t" });
          dlg.replaceChildren(face, txt);
          dlg.classList.add("show");
          if (speaker) { speaker.bubble = { text: "…", until: stage.now + 60000 }; stage.play(speaker, "cast", 500); }
          sfx("blip", "380");
          await typeOut(txt, bt.text);
          if (speaker) speaker.bubble = undefined;
        }
        await waitTap(Math.min(9000, 1600 + bt.text.length * 45));
      }
      end();
    })();
  });
}
