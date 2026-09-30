import { hs, makeCanvas, outline, type Paint } from "./palette";

/**
 * Small world props in the cozy farm style (16x16): Mầm the sprout, chests, campfires,
 * stairs, portals, event bubbles and gathering spots (forage bush, rock, stump, crystal).
 */

const WOOD = "#b07a48", GOLD = "#f2c542";

function shadow(p: Paint, w = 6, y = 14.5) {
  p.g.fillStyle = "rgba(20,10,40,.28)";
  p.g.beginPath();
  p.g.ellipse(8, y, w, 1.6, 0, 0, Math.PI * 2);
  p.g.fill();
}

const DRAW: Record<string, (p: Paint) => void> = {
  sprout: (p) => {
    shadow(p, 5);
    // bulb body
    p.blob(8, 10.5, 5, 4.2, "#f6ead0", { hi: 0.3 });
    p.rect(6, 9, 1, 2, "#2a1a2a"); p.rect(10, 9, 1, 2, "#2a1a2a");
    p.px(6, 9, "#ffffff"); p.px(10, 9, "#ffffff");
    p.px(5, 11, "#f0a0a0"); p.px(11, 11, "#f0a0a0");
    p.px(8, 12, "#c07060");
    // stem + two leaves
    p.rect(8, 3, 1, 4, "#4f9a35");
    p.blob(5, 4, 3, 1.6, "#6fcf5a", { hi: 0.35 });
    p.blob(11, 3.5, 3, 1.6, "#5ab848", { hi: 0.35 });
    p.px(4, 3, "#b8f59a"); p.px(10, 2, "#b8f59a");
  },
  chest: (p) => {
    shadow(p, 6.5);
    p.rect(2, 7, 12, 7, WOOD);
    for (let y = 9; y < 14; y += 2) p.rect(2, y, 12, 1, hs(WOOD, -0.18));
    p.rect(2, 4, 12, 4, hs(WOOD, 0.08));
    p.rect(3, 3, 10, 1, hs(WOOD, 0.08));
    p.rect(3, 4, 10, 1, hs(WOOD, 0.3));
    p.rect(2, 7, 12, 1, GOLD);
    for (const x of [2, 13]) p.rect(x, 3, 1, 11, GOLD);
    p.rect(7, 6, 2, 3, GOLD); p.px(7, 8, "#6a4a1a");
    p.rect(1, 3, 1, 11, outline(WOOD)); p.rect(14, 3, 1, 11, outline(WOOD)); p.rect(2, 2, 12, 1, outline(WOOD)); p.rect(2, 14, 12, 1, outline(WOOD));
  },
  campfire: (p) => {
    shadow(p, 6.5);
    for (const [x, c] of [[2, "#8a8f98"], [5, "#9a9aa0"], [9, "#8a8f98"], [12, "#9a9aa0"]] as const) p.blob(x + 1, 13, 1.8, 1.4, c);
    p.line(3, 13, 12, 10, "#7a4a2a", 2); p.line(3, 10, 12, 13, "#8a5a32", 2);
    p.blob(8, 8, 3.4, 4.4, "#ff6a2a", { outline: false, hi: 0.4 });
    p.blob(8, 9, 2.2, 3, "#ffb030", { outline: false, hi: 0.4 });
    p.blob(8, 10, 1.2, 1.8, "#fff3a0", { outline: false });
    p.px(6, 4, "#ff8a3a"); p.px(10, 3, "#ffb030");
    p.g.fillStyle = "rgba(255,160,60,.18)"; p.g.beginPath(); p.g.arc(8, 9, 8, 0, Math.PI * 2); p.g.fill();
  },
  stairs: (p) => {
    p.rect(1, 2, 14, 13, "#6a6a72");
    p.rect(1, 2, 14, 1, hs("#6a6a72", 0.3));
    p.rect(3, 4, 10, 10, "#1a1420");
    for (let i = 0; i < 4; i++) { const y = 5 + i * 2.2, w = 10 - i * 2; p.rect(8 - w / 2, y, w, 1, hs("#9a9aa0", -i * 0.15)); p.rect(8 - w / 2, y + 1, w, 1, hs("#6a6a72", -0.2 - i * 0.1)); }
    p.rect(0, 2, 1, 13, outline("#6a6a72")); p.rect(15, 2, 1, 13, outline("#6a6a72")); p.rect(1, 15, 14, 1, outline("#6a6a72"));
    p.px(2, 3, "#6fae4a"); p.px(13, 14, "#6fae4a");
  },
  portal: (p) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.blob(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.8, 1.8, i % 2 ? "#9a9aa0" : "#8a8f98"); }
    p.blob(8, 8, 4.6, 4.6, "#6a3ad8", { outline: false, hi: 0.35 });
    p.blob(8, 8, 3, 3, "#9a6aff", { outline: false });
    p.blob(8, 8, 1.4, 1.4, "#e0d0ff", { outline: false });
    p.px(6, 5, "#ffffff"); p.px(11, 10, "#ffffff");
  },
  marker: (p) => {
    // yellow "!" speech bubble
    p.blob(8, 6, 5, 5, "#fff6d0", { hi: 0.1 });
    p.rect(6, 10, 3, 3, "#fff6d0"); p.px(6, 13, outline("#fff6d0"));
    p.rect(7, 2, 2, 5, "#e8a020"); p.rect(7, 8, 2, 2, "#e8a020");
    p.px(7, 2, "#ffd060");
  },
  question: (p) => {
    p.blob(8, 6, 5, 5, "#e0f0ff", { hi: 0.1 });
    p.rect(6, 10, 3, 3, "#e0f0ff"); p.px(6, 13, outline("#e0f0ff"));
    p.rect(6, 2, 4, 1, "#3a7ad8"); p.rect(9, 3, 1, 2, "#3a7ad8"); p.rect(7, 5, 2, 1, "#3a7ad8"); p.rect(7, 6, 1, 1, "#3a7ad8"); p.rect(7, 8, 1, 2, "#3a7ad8");
  },
  herb_node: (p) => {
    shadow(p, 5.5);
    p.blob(8, 10, 6, 4.2, "#4f9a35", { hi: 0.35 });
    p.blob(5, 9, 3, 2.4, "#5aaa3e");
    p.blob(11, 9, 3, 2.4, "#5aaa3e");
    for (const [x, y, c] of [[5, 8, "#f7d44c"], [10, 7, "#e84a6a"], [8, 11, "#ffffff"], [12, 11, "#b88aff"]] as const) { p.px(x, y, c); p.px(x + 1, y, hs(c, 0.3)); }
    p.px(8, 5, "#8ad86a"); p.px(7, 6, "#6fcf5a");
  },
  rock_node: (p) => {
    shadow(p, 6);
    p.blob(8, 10, 6.5, 4.6, "#9a9aa4", { hi: 0.3 });
    p.blob(5.5, 11, 3, 2.2, "#8a8a94");
    p.line(7, 8, 9, 11, hs("#9a9aa4", -0.35));
    for (const [x, y] of [[10, 9], [6, 10], [11, 12]]) { p.px(x, y, "#e89a4a"); p.px(x, y - 1, "#ffd08a"); }
    p.px(5, 7, "#d8d8e0");
  },
  wood_node: (p) => {
    shadow(p, 6);
    p.rect(3, 7, 10, 7, "#8a5a32");
    for (let x = 4; x < 13; x += 2) p.rect(x, 8, 1, 6, hs("#8a5a32", -0.2));
    p.blob(8, 7, 5, 2, "#d8b078", { hi: 0.2 });
    p.blob(8, 7, 2.6, 1, "#b88a52", { outline: false });
    p.px(8, 7, "#8a5a32");
    p.rect(2, 13, 2, 1, "#6a4428"); p.rect(12, 13, 2, 1, "#6a4428");
    p.rect(3, 7, 1, 7, outline("#8a5a32")); p.rect(12, 7, 1, 7, outline("#8a5a32"));
    p.px(13, 9, "#5aa83a"); p.px(14, 8, "#6fcf5a");
  },
  crystal_node: (p) => {
    shadow(p, 5.5);
    p.blob(8, 12, 5.5, 2.4, "#6a6a78");
    for (const [x, top, hw, c] of [[5, 6, 1, "#8ab8ff"], [8, 2, 2, "#b08aff"], [11, 5, 1, "#8ad8ff"]] as const) {
      for (let y = top; y < 12; y++) { const w = y < top + hw + 1 ? y - top : hw; for (let xx = x - w; xx <= x + w; xx++) p.px(xx, y, xx === x - w ? hs(c, 0.45) : xx === x + w ? hs(c, -0.25) : c); }
      p.px(x, top, "#ffffff");
    }
    p.g.fillStyle = "rgba(176,138,255,.18)"; p.g.beginPath(); p.g.arc(8, 8, 7, 0, Math.PI * 2); p.g.fill();
  },
};

const cache = new Map<string, HTMLCanvasElement>();
export const isProp = (id: string) => id in DRAW;

export function propCanvas(id: string): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const [c, p] = makeCanvas(16, 16);
  DRAW[id](p);
  cache.set(id, c);
  return c;
}
