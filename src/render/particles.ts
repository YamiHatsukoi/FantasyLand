import type { ParticleKind } from "../world/biomes";

/**
 * Screen-space ambient particles (snow, ash, spores, petals...). Positions are derived from
 * time and a fixed seed per particle so nothing needs to be stored; particles drift with the
 * camera a little for parallax.
 */
const N = 70;
const seeds = Array.from({ length: N }, (_, i) => {
  const r = (k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  return { x: r(1), y: r(2), s: r(3), p: r(4) };
});

const STYLE: Record<Exclude<ParticleKind, "none">, { col: string[]; vx: number; vy: number; size: number; sway: number; glow?: boolean; count: number }> = {
  snow: { col: ["#ffffff", "#e0f0ff"], vx: -0.01, vy: 0.05, size: 2, sway: 0.02, count: 60 },
  ash: { col: ["#6a6060", "#a09090", "#ff7a3a"], vx: 0.01, vy: 0.02, size: 2, sway: 0.01, count: 50 },
  spores: { col: ["#8fffd0", "#ff9af0", "#fff6a8"], vx: 0.004, vy: -0.012, size: 2, sway: 0.03, glow: true, count: 40 },
  petals: { col: ["#ffd0e0", "#f090b8", "#ffffff"], vx: 0.03, vy: 0.03, size: 2, sway: 0.04, count: 28 },
  rain: { col: ["#a8c8f0"], vx: -0.02, vy: 0.4, size: 1, sway: 0, count: 70 },
  bubbles: { col: ["#c8f0ff", "#ffffff"], vx: 0, vy: -0.03, size: 3, sway: 0.02, count: 30 },
  stars: { col: ["#ffffff", "#fff4b0", "#b0d0ff"], vx: 0, vy: 0, size: 2, sway: 0, glow: true, count: 45 },
  leaves: { col: ["#6fcf5a", "#4a9a4a", "#e0a030"], vx: 0.025, vy: 0.025, size: 2, sway: 0.05, count: 14 },
  embers: { col: ["#ff7a2a", "#ffc83a", "#ff4a1a"], vx: 0.005, vy: -0.03, size: 2, sway: 0.02, glow: true, count: 45 },
  dust: { col: ["#e0c890", "#c8a870"], vx: 0.05, vy: 0.005, size: 2, sway: 0.01, count: 45 },
  fireflies: { col: ["#e0ff8a", "#fff6a8"], vx: 0, vy: 0, size: 2, sway: 0.06, glow: true, count: 30 },
  motes: { col: ["#ffe8a0", "#ffffff"], vx: 0, vy: -0.006, size: 2, sway: 0.03, glow: true, count: 30 },
  glyphs: { col: ["#b08aff", "#8ad8ff"], vx: 0, vy: -0.01, size: 3, sway: 0.02, glow: true, count: 20 },
  feathers: { col: ["#ffffff", "#e0d8c8"], vx: 0.01, vy: 0.02, size: 3, sway: 0.06, count: 18 },
  sparks: { col: ["#fff6a8", "#8ad8ff"], vx: 0, vy: 0, size: 2, sway: 0.1, glow: true, count: 35 },
};

export function drawParticles(c: CanvasRenderingContext2D, kind: ParticleKind | undefined, w: number, h: number, t: number, camX: number, camY: number, tile: number) {
  if (!kind || kind === "none") return;
  const st = STYLE[kind];
  const sec = t / 1000;
  const px = Math.max(1, Math.round(tile / 32));
  for (let i = 0; i < st.count; i++) {
    const s = seeds[i];
    const speed = 0.6 + s.s * 0.8;
    let x = s.x + sec * st.vx * speed + Math.sin(sec * 1.3 + s.p * 6) * st.sway - camX * tile / w * 0.15;
    let y = s.y + sec * st.vy * speed + Math.cos(sec * 0.9 + s.p * 6) * st.sway * 0.5 - camY * tile / h * 0.15;
    x = ((x % 1) + 1) % 1;
    y = ((y % 1) + 1) % 1;
    const col = st.col[i % st.col.length];
    const size = st.size * px * (kind === "stars" || kind === "fireflies" ? 0.5 + 0.5 * Math.abs(Math.sin(sec * 2 + s.p * 9)) : 1);
    const sx = x * w, sy = y * h;
    if (st.glow) {
      c.fillStyle = col + "33";
      c.fillRect(sx - size, sy - size, size * 3, size * 3);
    }
    c.fillStyle = col;
    if (kind === "rain") c.fillRect(sx, sy, px, px * 6);
    else c.fillRect(sx, sy, size, size);
  }
}
