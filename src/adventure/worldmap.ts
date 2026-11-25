/**
 * Travel map of a book, drawn with FantasyLand's tiles: every place of the story is a spot on
 * the map, roads join places the story moves between, and the terrain around a place follows
 * its scene (forest, swamp, city...). Fog hides what the hero has not reached yet; the hero
 * walks the road when the story moves to another place.
 */
import { personCanvas } from "../render/people";
import { T, TS, tileSet } from "../render/tiles";
import { BIOMES } from "../world/biomes";
import type { Bg } from "./types";

export interface BookMap {
  w: number;
  h: number;
  nodes: Record<string, { x: number; y: number; bg: Bg; first: number }>;
  edges: [string, string][];
  /** Rooms and streets folded into the map place that holds them. */
  group?: Record<string, string>;
}

const BIOME_OF: Record<Bg, string> = {
  forest: "forest", hill: "autumn", road: "forest", river: "forest", lake: "forest", field: "sakura",
  village: "forest", town: "ruins", city: "ruins", castle: "ruins", hall: "ruins", ruins: "ruins",
  cave: "ruins", tunnel: "ruins", swamp: "swamp", mountain: "tundra", bridge: "forest", camp: "forest",
  inn: "forest", ship: "reef", sea: "reef", coast: "reef", desert: "desert", temple: "ruins", dungeon: "ruins", sky: "forest",
};
const TREES: Partial<Record<Bg, number>> = { forest: 0.5, camp: 0.3, inn: 0.3, village: 0.18, road: 0.25, hill: 0.14, swamp: 0.2, field: 0.04, lake: 0.25, river: 0.25 };
const WATERY = new Set<Bg>(["river", "lake", "sea", "coast", "ship", "bridge"]);
const CITY = new Set<Bg>(["city", "castle", "town", "hall"]);

export const mapPlace = (m: BookMap, place: string) => m.group?.[place] ?? place;

function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

interface Terrain {
  w: number;
  h: number;
  tile: Uint8Array;
  biome: string[];
  roads: Map<string, { x: number; y: number }[]>;
}

/** Road between two places: a gentle curve, in tile steps. */
function roadPoints(a: { x: number; y: number }, b: { x: number; y: number }, seed: number) {
  const mx = (a.x + b.x) / 2 + (hash(seed, 1) - 0.5) * Math.abs(b.y - a.y) * 0.5;
  const my = (a.y + b.y) / 2 + (hash(seed, 2) - 0.5) * Math.abs(b.x - a.x) * 0.5;
  const pts: { x: number; y: number }[] = [];
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.6));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round((1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x);
    const y = Math.round((1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y);
    const last = pts[pts.length - 1];
    if (last && last.x === x && last.y === y) continue;
    // keep steps 4-connected so the road has no diagonal gaps
    if (last && last.x !== x && last.y !== y) pts.push({ x, y: last.y });
    pts.push({ x, y });
  }
  return pts;
}

export function buildTerrain(m: BookMap): Terrain {
  const { w, h } = m;
  const nodes = Object.entries(m.nodes);
  const tile = new Uint8Array(w * h);
  const biome: string[] = new Array(w * h);
  const near = new Int16Array(w * h).fill(-1);
  const nearD = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const jx = x + (noise(x / 6, y / 6, 3) - 0.5) * 6, jy = y + (noise(x / 6, y / 6, 7) - 0.5) * 6;
    let best = -1, bd = 1e9;
    nodes.forEach(([, n], i) => { const d = Math.hypot(n.x - jx, n.y - jy); if (d < bd) { bd = d; best = i; } });
    const i = y * w + x;
    near[i] = best; nearD[i] = bd;
    const bg = bd > 11 ? "forest" : nodes[best][1].bg;
    biome[i] = BIOME_OF[bg as Bg] ?? "forest";
    const r = hash(x, y, 11);
    const density = bd > 11 ? 0.42 : TREES[bg as Bg] ?? 0.05;
    tile[i] = bd > 2.5 && r < density * (0.6 + noise(x / 5, y / 5, 5) * 0.8) ? T.OBSTACLE : r > 0.94 ? T.DECOR : T.GROUND;
  }
  // lakes and a river through the watery places, flowing to the east edge
  const water = nodes.filter(([, n]) => WATERY.has(n.bg)).map(([, n]) => n).sort((a, b) => a.x - b.x);
  const wet = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tile[y * w + x] = T.WATER; };
  if (water.length) {
    const course = [{ x: 0, y: water[0].y }, ...water.map((n) => ({ x: n.x + 2, y: n.y + 2 })), { x: w - 1, y: water[water.length - 1].y + 4 }];
    for (let i = 0; i < course.length - 1; i++) for (const p of roadPoints(course[i], course[i + 1], 90 + i)) { wet(p.x, p.y); wet(p.x + 1, p.y); }
    for (const n of nodes) if (n[1].bg === "lake" || n[1].bg === "sea" || n[1].bg === "coast")
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx / 16 + dy * dy / 9 <= 1 + noise(n[1].x + dx, n[1].y + dy, 9) * 0.4) wet(n[1].x + 2 + dx, n[1].y + 2 + dy);
  }
  // cities: paved squares inside a wall
  for (const [, n] of nodes) if (CITY.has(n.bg)) {
    const R = n.bg === "city" ? 5 : 3;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = n.x + dx, y = n.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      tile[y * w + x] = Math.max(Math.abs(dx), Math.abs(dy)) === R ? T.WALL : T.PAVE;
      biome[y * w + x] = "ruins";
    }
  }
  // roads (bridges over water)
  const roads = new Map<string, { x: number; y: number }[]>();
  m.edges.forEach(([a, b], i) => {
    const pts = roadPoints(m.nodes[a], m.nodes[b], i);
    roads.set(`${a}|${b}`, pts);
    for (const p of pts) {
      const k = p.y * w + p.x;
      tile[k] = tile[k] === T.WATER || tile[k] === T.WALL || tile[k] === T.PAVE ? T.PAVE : T.ALT;
    }
  });
  for (const [, n] of nodes) { const k = n.y * w + n.x; if (tile[k] !== T.PAVE) tile[k] = T.ALT; }
  return { w, h, tile, biome, roads };
}

const cache = new Map<string, { terrain: Terrain; art: HTMLCanvasElement }>();

export function renderTerrain(key: string, m: BookMap) {
  const hit = cache.get(key);
  if (hit) return hit;
  const terrain = buildTerrain(m);
  const { w, h, tile, biome } = terrain;
  const art = document.createElement("canvas");
  art.width = w * TS; art.height = h * TS;
  const c = art.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, set = tileSet(BIOMES[biome[i]] ?? BIOMES.forest), v = (x * 7 + y * 13) % 4, t = tile[i];
    const img = t === T.WATER ? set.water[0] : t === T.OBSTACLE ? set.tiles[T.GROUND][v] : (set.tiles[t] ?? set.tiles[T.GROUND])[v];
    c.drawImage(img, x * TS, y * TS);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (tile[i] !== T.OBSTACLE) continue;
    const set = tileSet(BIOMES[biome[i]] ?? BIOMES.forest);
    const tall = set.tall[(x * 7 + y * 13) % set.tall.length];
    c.drawImage(tall, x * TS + TS / 2 - tall.width / 2, (y + 1) * TS - tall.height);
  }
  // place markers
  for (const n of Object.values(m.nodes)) {
    const px = n.x * TS + TS / 2, py = n.y * TS + TS / 2;
    c.fillStyle = "rgba(0,0,0,.35)";
    c.fillRect(px - 6, py + 3, 12, 3);
    if (CITY.has(n.bg)) {
      c.fillStyle = "#cfc6b8"; c.fillRect(px - 7, py - 10, 14, 12);
      c.fillStyle = "#8a2f2f"; c.fillRect(px - 8, py - 14, 5, 5); c.fillRect(px + 3, py - 14, 5, 5);
      c.fillStyle = "#3a2a20"; c.fillRect(px - 2, py - 4, 4, 6);
    } else if (["dungeon", "ruins", "cave", "tunnel", "temple"].includes(n.bg)) {
      c.fillStyle = "#4a4550"; c.fillRect(px - 6, py - 8, 12, 10);
      c.fillStyle = "#120f16"; c.fillRect(px - 3, py - 5, 6, 7);
    } else if (["village", "inn", "camp"].includes(n.bg)) {
      c.fillStyle = "#9a6a3a"; c.fillRect(px - 5, py - 5, 10, 7);
      c.fillStyle = "#b8452f"; c.beginPath(); c.moveTo(px - 7, py - 5); c.lineTo(px, py - 11); c.lineTo(px + 7, py - 5); c.fill();
    } else {
      c.fillStyle = "#f2c542"; c.fillRect(px - 2, py - 8, 4, 10);
      c.fillStyle = "#6a4312"; c.fillRect(px - 1, py - 8, 2, 10);
    }
  }
  const out = { terrain, art };
  cache.set(key, out);
  return out;
}

/** Path the hero walks from one map place to another, in tile coordinates. */
export function travelPath(m: BookMap, t: Terrain, from: string, to: string) {
  const a = m.nodes[from], b = m.nodes[to];
  if (!a || !b) return [];
  const direct = t.roads.get(`${from}|${to}`) ?? t.roads.get(`${to}|${from}`)?.slice().reverse();
  if (direct) return direct;
  // through the road network (fewest places), else across country
  const prev = new Map<string, string>([[from, ""]]);
  const q = [from];
  while (q.length) {
    const p = q.shift()!;
    if (p === to) break;
    for (const [x, y] of m.edges) {
      const n = x === p ? y : y === p ? x : null;
      if (n && !prev.has(n)) { prev.set(n, p); q.push(n); }
    }
  }
  if (!prev.has(to)) return roadPoints(a, b, 7);
  const chain = [to];
  while (chain[0] !== from) chain.unshift(prev.get(chain[0])!);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < chain.length - 1; i++) pts.push(...travelPath(m, t, chain[i], chain[i + 1]));
  return pts;
}

export interface MapViewOpts {
  key: string;
  map: BookMap;
  /** Map places the hero has been to (already folded with `group`). */
  visited: Set<string>;
  here: string;
  label: (place: string) => string;
  onTapPlace?: (place: string) => void;
}

/** Interactive map: drag to pan, wheel/pinch buttons to zoom, fog over unknown land. */
export class WorldMapView {
  el: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art: HTMLCanvasElement;
  private terrain: Terrain;
  private fog: HTMLCanvasElement;
  private zoom = 2;
  private cam: { x: number; y: number };
  private hero: { x: number; y: number; dir: 0 | 1 | 2; flip: boolean; walking: boolean };
  private raf = 0;
  private alive = true;
  private drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;

  constructor(private o: MapViewOpts) {
    const r = renderTerrain(o.key, o.map);
    this.art = r.art; this.terrain = r.terrain;
    this.cv = document.createElement("canvas");
    this.cv.className = "adv-map-canvas";
    this.ctx = this.cv.getContext("2d")!;
    this.el = document.createElement("div");
    this.el.className = "adv-map";
    this.el.append(this.cv);
    const n = o.map.nodes[o.here] ?? Object.values(o.map.nodes)[0];
    this.hero = { x: n.x, y: n.y, dir: 0, flip: false, walking: false };
    this.cam = { x: n.x, y: n.y };
    this.fog = document.createElement("canvas");
    this.updateFog();
    this.bind();
    const loop = (t: number) => { if (!this.alive) return; this.draw(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() { this.alive = false; cancelAnimationFrame(this.raf); this.el.remove(); }

  zoomBy(d: number) { this.zoom = Math.max(0.5, Math.min(4, this.zoom * (d > 0 ? 1.25 : 0.8))); }

  /** Low-resolution fog: land within reach of visited places and the roads between them. */
  updateFog() {
    const { w, h } = this.o.map;
    this.fog.width = w; this.fog.height = h;
    const c = this.fog.getContext("2d")!;
    const img = c.createImageData(w, h);
    const seen: { x: number; y: number; r: number }[] = [];
    for (const p of this.o.visited) { const n = this.o.map.nodes[p]; if (n) seen.push({ x: n.x, y: n.y, r: 7 }); }
    for (const [a, b] of this.o.map.edges) {
      if (!this.o.visited.has(a) && !this.o.visited.has(b)) continue;
      for (const p of this.terrain.roads.get(`${a}|${b}`) ?? []) seen.push({ x: p.x, y: p.y, r: 2.5 });
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 1;
      for (const s of seen) { const d = Math.hypot(s.x - x, s.y - y); if (d < s.r + 3) a = Math.min(a, Math.max(0, (d - s.r) / 3)); if (!a) break; }
      const i = (y * w + x) * 4;
      img.data[i] = 8; img.data[i + 1] = 10; img.data[i + 2] = 14; img.data[i + 3] = Math.round(a * 235);
    }
    c.putImageData(img, 0, 0);
  }

  setVisited(v: Set<string>, here: string) {
    this.o.visited = v; this.o.here = here;
    this.updateFog();
  }

  /** Walks the hero to another place; resolves when there (a tap skips ahead). */
  travel(to: string): Promise<void> {
    const from = this.o.here;
    const pts = from && from !== to ? travelPath(this.o.map, this.terrain, from, to) : [];
    this.o.here = to;
    if (!pts.length) { const n = this.o.map.nodes[to]; if (n) { this.hero.x = n.x; this.hero.y = n.y; } return Promise.resolve(); }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 0 : Math.max(700, Math.min(3200, pts.length * 70));
    return new Promise((res) => {
      const start = performance.now();
      let skip = false;
      const onTap = () => { skip = true; };
      this.cv.addEventListener("pointerdown", onTap, { once: true });
      const step = () => {
        const t = skip ? 1 : Math.min(1, (performance.now() - start) / (ms || 1));
        const f = t * (pts.length - 1);
        const i = Math.floor(f), a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], u = f - i;
        const nx = a.x + (b.x - a.x) * u, ny = a.y + (b.y - a.y) * u;
        const dx = nx - this.hero.x, dy = ny - this.hero.y;
        if (Math.abs(dx) > Math.abs(dy)) { this.hero.dir = 2; this.hero.flip = dx < 0; } else if (dy) this.hero.dir = dy < 0 ? 1 : 0;
        this.hero.x = nx; this.hero.y = ny; this.hero.walking = t < 1;
        this.cam.x += (nx - this.cam.x) * 0.15; this.cam.y += (ny - this.cam.y) * 0.15;
        if (t < 1 && this.alive) requestAnimationFrame(step);
        else { this.cv.removeEventListener("pointerdown", onTap); this.hero.walking = false; this.hero.dir = 0; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  private bind() {
    this.cv.addEventListener("pointerdown", (e) => {
      this.drag = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false };
      this.cv.setPointerCapture(e.pointerId);
    });
    this.cv.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      const k = TS * this.zoom;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.drag.moved = true;
      this.cam.x = this.drag.cx - dx / k; this.cam.y = this.drag.cy - dy / k;
    });
    this.cv.addEventListener("pointerup", (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || !this.o.onTapPlace) return;
      const r = this.cv.getBoundingClientRect(), k = TS * this.zoom;
      const tx = this.cam.x + (e.clientX - r.left - r.width / 2) / k, ty = this.cam.y + (e.clientY - r.top - r.height / 2) / k;
      let best = "", bd = 2.2;
      for (const [id, n] of Object.entries(this.o.map.nodes)) {
        if (!this.o.visited.has(id)) continue;
        const dd = Math.hypot(n.x + 0.5 - tx, n.y + 0.5 - ty);
        if (dd < bd) { bd = dd; best = id; }
      }
      if (best) this.o.onTapPlace(best);
    });
    this.cv.addEventListener("wheel", (e) => { e.preventDefault(); this.zoomBy(-e.deltaY); }, { passive: false });
  }

  private draw(t: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (!W || !H) return;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const c = this.ctx, k = TS * this.zoom;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#07090c";
    c.fillRect(0, 0, W, H);
    const ox = W / 2 - (this.cam.x + 0.5) * k, oy = H / 2 - (this.cam.y + 0.5) * k;
    c.drawImage(this.art, ox, oy, this.art.width * this.zoom, this.art.height * this.zoom);
    // hero
    const frame = this.hero.walking ? Math.floor(t / 140) % 4 : 0;
    const spr = personCanvas("hero_ranger", undefined, this.hero.dir, frame);
    const sw = spr.width * this.zoom, shh = spr.height * this.zoom;
    const hx = ox + (this.hero.x + 0.5) * k, hy = oy + (this.hero.y + 1) * k;
    c.fillStyle = "rgba(0,0,0,.35)";
    c.beginPath(); c.ellipse(hx, hy - 2 * this.zoom, 6 * this.zoom, 2.5 * this.zoom, 0, 0, Math.PI * 2); c.fill();
    c.save();
    if (this.hero.flip) { c.translate(hx, 0); c.scale(-1, 1); c.translate(-hx, 0); }
    c.drawImage(spr, hx - sw / 2, hy - shh, sw, shh);
    c.restore();
    // fog, smoothed
    c.imageSmoothingEnabled = true;
    c.drawImage(this.fog, ox, oy, this.o.map.w * k, this.o.map.h * k);
    c.imageSmoothingEnabled = false;
    // labels of known places
    c.font = `${Math.round(9 + this.zoom * 3)}px "Be Vietnam Pro", system-ui, sans-serif`;
    c.textAlign = "center";
    for (const [id, n] of Object.entries(this.o.map.nodes)) {
      if (!this.o.visited.has(id) && id !== this.o.here) continue;
      const lx = ox + (n.x + 0.5) * k, ly = oy + (n.y - 0.6) * k;
      if (lx < -100 || ly < -20 || lx > W + 100 || ly > H + 20) continue;
      const s = this.o.label(id);
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.75)"; c.strokeText(s, lx, ly);
      c.fillStyle = id === this.o.here ? "#ffd27a" : "#f1ecdc"; c.fillText(s, lx, ly);
    }
  }
}
