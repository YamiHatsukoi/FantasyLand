/**
 * Illustrations: the book's own image when it has one, otherwise a generated layered
 * landscape (SVG) whose palette follows the section's mood, so every page still has a picture.
 */
import type { Book, Mood } from "./types";

const PAL: Record<Mood, { sky: [string, string]; layers: string[]; orb: string; glow: string }> = {
  forest: { sky: ["#0e2a22", "#3f6b4a"], layers: ["#2b4a35", "#1b3325", "#0d1d14"], orb: "#f4f0c8", glow: "#a8ffcf" },
  sea: { sky: ["#0a1b33", "#3c6f9c"], layers: ["#24496e", "#163452", "#0a1d30"], orb: "#fff5d6", glow: "#9fd7ff" },
  cave: { sky: ["#0b0a10", "#2c2433"], layers: ["#2a2230", "#1a1520", "#0c0a10"], orb: "#ffb35c", glow: "#ffcf8a" },
  ruin: { sky: ["#1d1620", "#6b4f5a"], layers: ["#4a3843", "#2f2430", "#18121a"], orb: "#ffe0b0", glow: "#ffd0a0" },
  town: { sky: ["#1a1830", "#6a5a8a"], layers: ["#3e3a5e", "#29263f", "#141224"], orb: "#ffe9a8", glow: "#ffd76e" },
  night: { sky: ["#05070f", "#1d2550"], layers: ["#1b2140", "#11162b", "#070a16"], orb: "#e8eeff", glow: "#b9c8ff" },
  fire: { sky: ["#2a0a05", "#a8401a"], layers: ["#6a2414", "#42150c", "#1f0905"], orb: "#ffe26a", glow: "#ff9b4a" },
  storm: { sky: ["#0d1418", "#4a5a63"], layers: ["#2e3b42", "#1e282d", "#0e1418"], orb: "#dbe8ee", glow: "#c8f0ff" },
};

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function ridge(r: () => number, base: number, amp: number, jag: boolean): string {
  const pts: string[] = [];
  const n = jag ? 14 : 8;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 400;
    const y = base - r() * amp - (jag && i % 2 ? amp * 0.6 : 0);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,225 L${pts.join(" L")} L400,225 Z`;
}

/** Generated landscape, deterministic for a seed (the section id). */
export function sceneSVG(seed: string, mood: Mood = "night"): string {
  const p = PAL[mood];
  const r = rng(seed + mood);
  const ox = 60 + r() * 280;
  const oy = 30 + r() * 50;
  const stars = mood === "night" || mood === "sea" || mood === "town"
    ? Array.from({ length: 26 }, () => `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 110).toFixed(0)}" r="${(r() * 1.2 + 0.3).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`).join("")
    : "";
  const jag = mood === "cave" || mood === "ruin" || mood === "fire" || mood === "storm";
  const layers = p.layers.map((c, i) => `<path d="${ridge(r, 120 + i * 35, 55 - i * 10, jag)}" fill="${c}"/>`).join("");
  const trees = mood === "forest"
    ? Array.from({ length: 9 }, () => { const x = r() * 400; const h = 40 + r() * 50; return `<path d="M${x.toFixed(0)},${(225 - h).toFixed(0)} l${(h / 4).toFixed(0)},${h.toFixed(0)} h-${(h / 2).toFixed(0)} z" fill="#081109"/>`; }).join("")
    : "";
  const waves = mood === "sea"
    ? `<rect x="0" y="170" width="400" height="55" fill="#0a1d30"/>${Array.from({ length: 7 }, (_, i) => `<path d="M0,${176 + i * 7} q25,-4 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0" stroke="${p.glow}" stroke-opacity="${0.25 - i * 0.03}" fill="none"/>`).join("")}`
    : "";
  const embers = mood === "fire"
    ? Array.from({ length: 18 }, () => `<circle cx="${(r() * 400).toFixed(0)}" cy="${(80 + r() * 140).toFixed(0)}" r="${(r() * 1.6 + 0.4).toFixed(1)}" fill="#ffcf6a" opacity="${(r() * 0.7 + 0.2).toFixed(2)}"/>`).join("")
    : "";
  const bolt = mood === "storm" ? `<path d="M${ox},10 l-14,40 h12 l-18,46" stroke="#e6f6ff" stroke-width="2.5" fill="none" opacity=".85"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
<radialGradient id="g"><stop offset="0" stop-color="${p.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
<rect width="400" height="225" fill="url(#s)"/>${stars}
<circle cx="${ox}" cy="${oy}" r="60" fill="url(#g)"/>${mood === "cave" ? "" : `<circle cx="${ox}" cy="${oy}" r="${mood === "fire" ? 22 : 14}" fill="${p.orb}" opacity=".92"/>`}
${bolt}${layers}${trees}${waves}${embers}<rect width="400" height="225" fill="url(#f)"/></svg>`;
}

export function svgURL(svg: string) {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

export function assetURL(book: Book, path: string) {
  return `${import.meta.env.BASE_URL}adventure/${book.id}/${path}`;
}

/** Sets an element's background: the real image when it loads, the generated one meanwhile/otherwise. */
export function paintScene(el: HTMLElement, book: Book, seed: string, img?: string, mood?: Mood) {
  const fallback = svgURL(sceneSVG(seed, mood));
  el.style.backgroundImage = fallback;
  if (!img) return;
  const url = assetURL(book, img);
  const probe = new Image();
  probe.onload = () => { el.style.backgroundImage = `url("${url}")`; };
  probe.src = url;
}
