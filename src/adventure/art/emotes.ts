/**
 * Emote balloons over a character's head (RPG style): a white balloon with a pixel symbol, 4
 * animation frames each. Kinds: ! ? ... anger sweat zzz heart skull sad.
 */
import { Px, memo } from "./px";

export const EMOTES = ["!", "?", "...", "anger", "sweat", "zzz", "heart", "skull", "sad"] as const;
export type EmoteKind = (typeof EMOTES)[number];

const INK = "#24161a";
const BW = 17, BH = 15;

/** The balloon: rounded white body with a tail at the bottom centre. */
function balloon(p: Px, fill = "#fbf6ea", shade = "#d8cfc0") {
  p.rect(2, 0, BW - 4, BH - 3, fill);
  p.rect(1, 1, BW - 2, BH - 5, fill);
  p.rect(0, 2, BW, BH - 7, fill);
  p.rect(1, BH - 5, BW - 2, 1, shade);
  p.rect(2, BH - 4, BW - 4, 1, shade);
  // tail
  p.rect(7, BH - 3, 3, 1, fill); p.rect(8, BH - 2, 2, 1, fill); p.px(8, BH - 1, fill);
}

function draw(kind: string, f: number): HTMLCanvasElement {
  const p = new Px(BW + 2, BH + 2);
  const q = new Px(BW, BH);
  balloon(q);
  const cx = 8;
  switch (kind) {
    case "!": {
      const c = f % 2 ? "#ff3a2a" : "#e02018";
      q.rect(cx - 1, 2, 3, 6, c); q.rect(cx - 1, 9, 3, 2, c); q.px(cx - 1, 2, "#ff9a80");
      break;
    }
    case "?": {
      const c = "#2a6ae0";
      q.rect(cx - 2, 2, 5, 1, c); q.rect(cx - 3, 3, 2, 2, c); q.rect(cx + 2, 3, 2, 3, c); q.rect(cx, 6, 2, 1, c); q.rect(cx, 7, 2, 1, c); q.rect(cx, 9, 2, 2, c);
      q.px(cx - 2, 2, "#8ab0ff");
      if (f % 2) { q.px(cx + 4, 2, c); }
      break;
    }
    case "...": {
      for (let i = 0; i < 3; i++) if (i <= f % 4 - (f % 4 === 3 ? 1 : 0) || f % 4 === 3) q.rect(3 + i * 4, 6, 3, 3, INK);
      break;
    }
    case "anger": {
      // the "vein" cross, pulsing
      const c = "#e02a1a", k = f % 2;
      const arm = (dx: number, dy: number) => {
        q.rect(cx - 1 + dx * (2 + k), 5 + dy * (2 + k) , 2 + Math.abs(dy), 2 + Math.abs(dx), c);
      };
      arm(-1, 0); arm(1, 0); arm(0, -1); arm(0, 1);
      q.rect(cx - 4 - k, 3 - k, 3, 3, c); q.rect(cx + 2 + k, 3 - k, 3, 3, c); q.rect(cx - 4 - k, 7 + k, 3, 3, c); q.rect(cx + 2 + k, 7 + k, 3, 3, c);
      q.g.clearRect(cx - 3 - k, 4 - k, 1, 1); q.g.clearRect(cx + 4 + k, 4 - k, 1, 1); q.g.clearRect(cx - 3 - k, 8 + k, 1, 1); q.g.clearRect(cx + 4 + k, 8 + k, 1, 1);
      q.rect(cx - 1, 5, 3, 2, "#fbf6ea");
      break;
    }
    case "sweat": {
      // a drop sliding down
      const y = 2 + (f % 4);
      const c = "#4aa8f0";
      q.px(cx + 2, y, c); q.rect(cx + 1, y + 1, 3, 1, c); q.rect(cx, y + 2, 5, 2, c); q.rect(cx + 1, y + 4, 3, 1, "#2a78c0");
      q.px(cx + 1, y + 2, "#dff0ff");
      q.rect(cx - 5, 4, 1, 4, INK); q.rect(cx - 3, 3, 1, 3, INK);
      break;
    }
    case "zzz": {
      const zs: [number, number, number][] = [[3, 7, 2], [7, 4, 3], [11, 1, 3]];
      zs.forEach(([x, y, s], i) => {
        if (i > f % 4) return;
        q.rect(x, y, s + 1, 1, "#3a4ab0"); q.line(x + s, y + 1, x, y + s, "#3a4ab0"); q.rect(x, y + s + 1, s + 1, 1, "#3a4ab0");
      });
      break;
    }
    case "heart": {
      const big = f % 2 === 0;
      const c = "#e83050", l = "#ff90a8";
      if (big) { q.rect(cx - 5, 3, 4, 3, c); q.rect(cx + 1, 3, 4, 3, c); q.rect(cx - 5, 5, 10, 2, c); q.rect(cx - 4, 7, 8, 1, c); q.rect(cx - 3, 8, 6, 1, c); q.rect(cx - 2, 9, 4, 1, c); q.rect(cx - 1, 10, 2, 1, c); q.px(cx - 4, 4, l); }
      else { q.rect(cx - 4, 4, 3, 2, c); q.rect(cx + 1, 4, 3, 2, c); q.rect(cx - 4, 5, 8, 2, c); q.rect(cx - 3, 7, 6, 1, c); q.rect(cx - 2, 8, 4, 1, c); q.rect(cx - 1, 9, 2, 1, c); q.px(cx - 3, 4, l); }
      break;
    }
    case "skull": {
      const c = "#f4f0e4", d = "#8a8478";
      q.rect(3, 1, BW - 6, BH - 3, "#2a2028");
      q.rect(4, 2, BW - 8, BH - 5, "#2a2028");
      q.rect(cx - 4, 2, 9, 6, c); q.rect(cx - 3, 1, 7, 1, c); q.rect(cx - 2, 8, 5, 2, c);
      q.rect(cx - 3, 4, 2, 2, "#1a1014"); q.rect(cx + 2, 4, 2, 2, "#1a1014"); q.px(cx, 6, "#1a1014");
      if (f % 2) { q.px(cx - 3, 4, "#ff3020"); q.px(cx + 3, 4, "#ff3020"); }
      q.px(cx - 1, 9, d); q.px(cx + 1, 9, d);
      break;
    }
    case "sad": {
      // downcast eyes and a falling tear
      q.rect(cx - 5, 4, 3, 1, INK); q.rect(cx + 3, 4, 3, 1, INK);
      q.px(cx - 5, 3, INK); q.px(cx + 5, 3, INK);
      q.rect(cx - 2, 9, 5, 1, INK); q.px(cx - 3, 10, INK); q.px(cx + 3, 10, INK);
      const ty = 5 + (f % 4);
      q.rect(cx - 4, ty, 1, 2, "#4aa8f0"); q.px(cx - 4, ty + 2, "#2a78c0");
      break;
    }
    default:
      q.rect(cx - 1, 3, 3, 7, INK);
  }
  // outline around the balloon
  p.stamp(q, 1, 1);
  p.outline(INK);
  return p.c;
}

const frames = memo((key: string) => {
  const [k, f] = key.split("|");
  return draw(k, Number(f));
});

/** One frame (19x17, tail at the bottom centre) of an emote balloon. */
export function emoteFrame(kind: string, frame: number): HTMLCanvasElement {
  const k = (EMOTES as readonly string[]).includes(kind) ? kind : kind === "…" ? "..." : "!";
  return frames(`${k}|${((Math.floor(frame) % 4) + 4) % 4}`);
}
