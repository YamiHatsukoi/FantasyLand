/**
 * Travel map of a book, drawn with FantasyLand's tiles: every place of the story is a spot on
 * the map, roads join places the story moves between, and the terrain around a place follows
 * its scene (forest, swamp, city...). Fog hides what the hero has not reached yet; the hero
 * walks the road when the story moves to another place.
 */
import { lookFor, personFrame, type Facing, type Look } from "./art/people";
import { T, TS } from "../render/tiles";
import { G, hash, noise, paintMap, type ArtNode, type MapFx, type Pt } from "./art/mapart";
import type { Bg } from "./types";

export interface BookMap {
  w: number;
  h: number;
  nodes: Record<string, { x: number; y: number; bg: Bg; first: number }>;
  edges: [string, string][];
  /** Rooms and streets folded into the map place that holds them. */
  group?: Record<string, string>;
}

/** Ground of the land around a place, how far it reaches (tiles) and how wooded it is. */
const LAND: Record<Bg, [number, number, number]> = {
  forest: [G.FOREST, 4.4, 0.95], hill: [G.HILL, 4.2, 0.2], road: [G.GRASS, 3.6, 0.32], river: [G.GRASS, 3.6, 0.4], lake: [G.GRASS, 3.6, 0.36],
  field: [G.MEADOW, 4.2, 0.03], village: [G.MEADOW, 3.8, 0.1], town: [G.GRASS, 3.4, 0.1], city: [G.GRASS, 4, 0.08], castle: [G.GRASS, 3.4, 0.14],
  hall: [G.GRASS, 3, 0.1], ruins: [G.GRASS, 3.6, 0.32], cave: [G.ROCK, 2.6, 0.14], tunnel: [G.ROCK, 2.4, 0.12], swamp: [G.SWAMP, 4.4, 0.42],
  mountain: [G.ROCK, 4.6, 0.06], bridge: [G.GRASS, 3.2, 0.3], camp: [G.FOREST, 3.6, 0.5], inn: [G.GRASS, 3.4, 0.28], ship: [G.SAND, 2.2, 0],
  sea: [G.SAND, 2.2, 0], coast: [G.SAND, 2.6, 0.06], desert: [G.SAND, 4.6, 0.01], temple: [G.GRASS, 3.4, 0.24], dungeon: [G.ROCK, 2.6, 0.12], sky: [G.MEADOW, 3.6, 0.08],
};
const UNDER = new Set<Bg>(["cave", "tunnel", "dungeon"]);
const BUILT = new Set<Bg>(["city", "town", "castle", "hall"]);
const BIOME_OF = ["forest", "forest", "sakura", "autumn", "ruins", "tundra", "desert", "swamp", "forest"];

export const mapPlace = (m: BookMap, place: string) => m.group?.[place] ?? place;

interface Terrain {
  w: number;
  h: number;
  tile: Uint8Array;
  biome: string[];
  roads: Map<string, { x: number; y: number }[]>;
  /** What the painter needs: ground kinds, woods, districts, water. */
  art: {
    nodes: ArtNode[]; kind: Uint8Array; trees: Float32Array; district: Uint16Array; walled: Set<number>;
    rivers: Pt[][]; lakes: { x: number; y: number; rx: number; ry: number; sea: boolean; swamp?: boolean }[]; cold: boolean;
  };
  fx?: MapFx;
}

/** Road between two places: a gentle curve, sampled about every 0.8 tile. */
function roadPoints(a: { x: number; y: number }, b: { x: number; y: number }, seed: number) {
  const mx = (a.x + b.x) / 2 + (hash(seed, 1) - 0.5) * Math.abs(b.y - a.y) * 0.5;
  const my = (a.y + b.y) / 2 + (hash(seed, 2) - 0.5) * Math.abs(b.x - a.x) * 0.5;
  const at = (t: number) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y });
  let len = 0;
  for (let i = 0; i < 16; i++) { const p = at(i / 16), q = at((i + 1) / 16); len += Math.hypot(q.x - p.x, q.y - p.y); }
  const n = Math.max(2, Math.ceil(len / 0.8));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) pts.push(at(i / n));
  pts[0] = { x: a.x, y: a.y }; pts[n] = { x: b.x, y: b.y };
  return pts;
}

/** Smooth curve through points (Catmull-Rom), with a gentle meander. */
function meander(course: Pt[], seed: number) {
  const out: Pt[] = [];
  for (let i = 0; i < course.length - 1; i++) {
    const p0 = course[Math.max(0, i - 1)], p1 = course[i], p2 = course[i + 1], p3 = course[Math.min(course.length - 1, i + 2)];
    const L = Math.hypot(p2.x - p1.x, p2.y - p1.y), n = Math.max(2, Math.ceil(L / 0.3));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const x = f(p0.x, p1.x, p2.x, p3.x), y = f(p0.y, p1.y, p2.y, p3.y);
      const dx = p2.x - p1.x, dy = p2.y - p1.y, l = Math.hypot(dx, dy) || 1;
      const wob = (noise(out.length / 9, 0, seed) - 0.5) * 2.2 * Math.sin(Math.PI * t);
      out.push({ x: x - (dy / l) * wob, y: y + (dx / l) * wob });
    }
  }
  out.push(course[course.length - 1]);
  return out;
}

export function buildTerrain(m: BookMap): Terrain {
  const { w, h } = m;
  const ids = Object.keys(m.nodes);
  const groupCount: Record<string, number> = {};
  for (const v of Object.values(m.group ?? {})) groupCount[v] = (groupCount[v] ?? 0) + 1;
  const raw = ids.map((id) => ({ id, x: m.nodes[id].x, y: m.nodes[id].y, bg: m.nodes[id].bg, imp: 1 + (groupCount[id] ?? 0) }));
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  // rivers, lakes and bridges among mine tunnels are underground: draw them as rock
  const nodes: ArtNode[] = raw.map((n) => {
    if (!["river", "lake", "bridge"].includes(n.bg)) return n;
    const near = raw.filter((o) => o !== n).sort((a, b) => dist(a, n) - dist(b, n)).slice(0, 3);
    return near.filter((o) => UNDER.has(o.bg)).length >= 2 ? { ...n, bg: "cave" as Bg } : n;
  });
  const cold = ids.filter((id) => /ice|snow|frozen|glacier|kalte|frost/.test(id)).length >= 4;
  const seed = ids.length * 31 + w;

  // ground kind by smooth votes of nearby places, woods likewise
  const kind = new Uint8Array(w * h), trees = new Float32Array(w * h);
  const votes = new Float32Array(9), kn = new Float32Array(9);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    votes.fill(0);
    votes[G.FOREST] = 0.05;
    let tw = 0.05, td = 0.05 * (cold ? 0.3 : 0.9);
    const jx = x + (noise(x / 6, y / 6, 3) - 0.5) * 5, jy = y + (noise(x / 6, y / 6, 7) - 0.5) * 5;
    for (let k = 0; k < 9; k++) kn[k] = 0.7 + 0.6 * noise(x / 4, y / 4, k * 7 + 1);
    for (const n of nodes) {
      const [k, sig, dens] = LAND[n.bg] ?? LAND.forest;
      const dx = n.x - jx, dy = n.y - jy, lim = sig * 2.6;
      if (dx > lim || dx < -lim || dy > lim || dy < -lim) continue;
      const d = Math.hypot(dx, dy);
      if (d > lim) continue;
      const wgt = Math.exp(-(d / sig) * (d / sig)) * kn[k];
      votes[k] += wgt; tw += wgt; td += wgt * dens;
    }
    let best = 0;
    for (let k = 1; k < 9; k++) if (votes[k] > votes[best]) best = k;
    if (cold && best !== G.ROCK && best !== G.SAND) best = G.SNOW;
    kind[y * w + x] = best;
    trees[y * w + x] = td / tw;
  }

  // water: lakes beside lake places, sea round ships and coasts, ponds in swamps, a river
  const lakes: Terrain["art"]["lakes"] = [];
  const edgeDir = (n: Pt) => {
    const c = [{ d: n.x, x: -1, y: 0 }, { d: w - 1 - n.x, x: 1, y: 0 }, { d: n.y, x: 0, y: -1 }, { d: h - 1 - n.y, x: 0, y: 1 }].sort((a, b) => a.d - b.d)[0];
    return c;
  };
  for (const n of nodes) {
    if (n.bg === "lake") {
      let best = { x: n.x, y: n.y + 2.6 }, bs = 1e9;
      for (let a = 0; a < 8; a++) {
        const c = { x: n.x + Math.cos((a / 8) * Math.PI * 2) * 3.4, y: n.y + Math.sin((a / 8) * Math.PI * 2) * 2.6 };
        let sc = nodes.filter((o) => o !== n && ((o.x - c.x) / 3.8) ** 2 + ((o.y - c.y) / 3) ** 2 < 1).length * 10;
        if (c.x < 1 || c.y < 1 || c.x > w - 2 || c.y > h - 2) sc += 3;
        sc += hash(a, n.x, n.y) * 0.5;
        if (sc < bs) { bs = sc; best = c; }
      }
      lakes.push({ ...best, rx: 3.1, ry: 2.3, sea: false });
    } else if (n.bg === "ship" || n.bg === "sea") {
      lakes.push({ x: n.x, y: n.y, rx: n.bg === "sea" ? 4.6 : 3.6, ry: n.bg === "sea" ? 3.6 : 3, sea: true });
      const e = edgeDir(n);
      if (e.d < 12) lakes.push({ x: n.x + e.x * e.d, y: n.y + e.y * e.d, rx: e.x ? e.d * 0.6 + 4 : 6, ry: e.y ? e.d * 0.6 + 4 : 6, sea: true });
    } else if (n.bg === "coast") {
      const e = edgeDir(n), off = Math.min(e.d + 3, 4.6);
      lakes.push({ x: n.x + e.x * off, y: n.y + e.y * off, rx: 3.8, ry: 3.4, sea: true });
      if (e.d < 12) lakes.push({ x: n.x + e.x * e.d, y: n.y + e.y * e.d, rx: e.x ? e.d * 0.5 + 3.5 : 6, ry: e.y ? e.d * 0.5 + 3.5 : 6, sea: true });
    } else if (n.bg === "swamp") {
      lakes.push({ x: n.x + 1.8, y: n.y + 1.3, rx: 1.7, ry: 1.1, sea: false, swamp: true });
      lakes.push({ x: n.x - 2, y: n.y + 2.2, rx: 1.2, ry: 0.8, sea: false, swamp: true });
    }
  }
  const rivers: Pt[][] = [];
  const wetNodes = nodes.filter((n) => n.bg === "river" || n.bg === "bridge" || n.bg === "lake");
  if (wetNodes.length) {
    const pt = (n: ArtNode): Pt => n.bg === "river" ? { x: n.x + 0.3, y: n.y + 1.3 } : n.bg === "lake" ? (() => { const l = lakes.find((q) => Math.hypot(q.x - n.x, q.y - n.y) < 5 && !q.sea); return l ? { x: l.x, y: l.y } : { x: n.x, y: n.y }; })() : { x: n.x, y: n.y };
    const left = wetNodes.slice().sort((a, b) => edgeDir(a).d - edgeDir(b).d);
    const chain = [left[0]];
    const rest = new Set(left.slice(1));
    while (rest.size) {
      const last = chain[chain.length - 1];
      let nb: ArtNode | null = null, bd = 1e9;
      for (const o of rest) { const d = dist(o, last); if (d < bd) { bd = d; nb = o; } }
      if (!nb) break;
      chain.push(nb); rest.delete(nb);
    }
    const pts = chain.map(pt);
    const e0 = edgeDir(pts[0]), e1 = edgeDir(pts[pts.length - 1]);
    const course = [{ x: pts[0].x + e0.x * (e0.d + 2), y: pts[0].y + e0.y * (e0.d + 2) }, ...pts];
    const endEdge = e1.x === e0.x && e1.y === e0.y && pts.length > 1 ? { x: -e0.x, y: -e0.y, d: e0.x > 0 || e0.y > 0 ? (e0.x ? pts[pts.length - 1].x : pts[pts.length - 1].y) : e0.x ? w - pts[pts.length - 1].x : h - pts[pts.length - 1].y } : e1;
    if (endEdge.d < 30 || pts.length === 1) course.push({ x: pts[pts.length - 1].x + endEdge.x * (endEdge.d + 2), y: pts[pts.length - 1].y + endEdge.y * (endEdge.d + 2) });
    rivers.push(meander(course, seed));
  }
  const wetTile = (x: number, y: number) => {
    for (const l of lakes) if (((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 < 0.8) return true;
    for (const r of rivers) for (const p of r) if (Math.abs(p.x - x) < 0.7 && Math.abs(p.y - y) < 0.7) return true;
    return false;
  };

  // built-up districts: towns and cities, and castles/halls packed together
  const seeds = nodes.filter((n) => n.bg === "city" || n.bg === "town" || ((n.bg === "castle" || n.bg === "hall") && nodes.filter((o) => o !== n && BUILT.has(o.bg) && dist(o, n) < 3.2).length >= 2));
  const seedSet = new Set(seeds);
  const others = nodes.filter((n) => !seedSet.has(n));
  const district = new Uint16Array(w * h), mask = new Uint8Array(w * h);
  for (const n of seeds) {
    let R = n.bg === "city" ? (n.imp >= 4 ? 5.6 : 3.7) : n.bg === "town" ? 2.7 : n.bg === "castle" ? 2.2 : 1.8;
    let dOther = 99;
    for (const o of others) dOther = Math.min(dOther, dist(o, n));
    R = Math.min(R, Math.max(1.3, dOther - 0.9));
    const rx = Math.round(R * (0.85 + hash(n.x, n.y, 5) * 0.3)), ry = Math.round(R * (0.85 + hash(n.x, n.y, 6) * 0.3));
    for (let y = n.y - ry; y <= n.y + ry; y++) for (let x = n.x - rx; x <= n.x + rx; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      // squarish blocks with the corners cut once the town is large
      if (rx >= 3 && ry >= 3 && Math.abs(x - n.x) === rx && Math.abs(y - n.y) === ry) continue;
      if (wetTile(x + 0.5, y + 0.5)) continue;
      mask[y * w + x] = 1;
    }
  }
  const walled = new Set<number>();
  let nextId = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || district[i]) continue;
    const id = ++nextId, stack = [i], cells: number[] = [];
    district[i] = id;
    while (stack.length) {
      const c = stack.pop()!; cells.push(c);
      const cx = c % w, cy = (c - cx) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[j] || district[j]) continue;
        district[j] = id; stack.push(j);
      }
    }
    const inside = seeds.filter((n) => district[n.y * w + n.x] === id);
    const xs = cells.map((c) => c % w), ys = cells.map((c) => (c / w) | 0);
    const thin = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 4;
    if (cells.length >= 10 && !thin && (inside.some((n) => n.bg === "city" || n.bg === "town") || inside.length >= 3)) walled.add(id);
  }

  // roads
  const roads = new Map<string, { x: number; y: number }[]>();
  m.edges.forEach(([a, b], i) => { if (m.nodes[a] && m.nodes[b]) roads.set(`${a}|${b}`, roadPoints(m.nodes[a], m.nodes[b], i)); });

  // coarse tile grid, kept for callers that read it
  const tile = new Uint8Array(w * h), biome: string[] = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    biome[i] = BIOME_OF[kind[i]];
    tile[i] = district[i] ? T.PAVE : wetTile(x, y) ? T.WATER : trees[i] > 0.55 ? T.OBSTACLE : T.GROUND;
  }
  for (const pts of roads.values()) for (const p of pts) { const k = Math.round(p.y) * w + Math.round(p.x); if (k >= 0 && k < w * h) tile[k] = tile[k] === T.WATER || tile[k] === T.PAVE ? T.PAVE : T.ALT; }
  return { w, h, tile, biome, roads, art: { nodes, kind, trees, district, walled, rivers, lakes, cold } };
}

const cache = new Map<string, { terrain: Terrain; art: HTMLCanvasElement }>();

export function renderTerrain(key: string, m: BookMap) {
  const hit = cache.get(key);
  if (hit) return hit;
  const terrain = buildTerrain(m);
  const { art, fx } = paintMap({ key, w: terrain.w, h: terrain.h, ...terrain.art, roads: [...terrain.roads.values()] });
  terrain.fx = fx;
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
  /** The hero as the walkable areas and stages draw him (Adventure's sprite, with his weapon). */
  heroLook?: Look;
}

let GLOW: HTMLCanvasElement | null = null, CLOUD: HTMLCanvasElement | null = null;
function glowSprite() {
  if (GLOW) return GLOW;
  const c = (GLOW = document.createElement("canvas")); c.width = c.height = 32;
  const g = c.getContext("2d")!, r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,200,110,.6)"); r.addColorStop(0.35, "rgba(255,150,60,.25)"); r.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return c;
}
function cloudSprite() {
  if (CLOUD) return CLOUD;
  const c = (CLOUD = document.createElement("canvas")); c.width = 110; c.height = 60;
  const g = c.getContext("2d")!;
  for (const [x, y, r] of [[30, 34, 22], [55, 26, 26], [80, 34, 20], [48, 40, 20], [68, 42, 18]]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(10,20,30,.8)"); gr.addColorStop(1, "rgba(10,20,30,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 110, 60);
  }
  return c;
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
  private hero: { x: number; y: number; facing: Facing; walking: boolean; phase: number };
  /** While travelling: where to, and the road still ahead. */
  private trip: { to: string; pts: { x: number; y: number }[]; i: number } | null = null;
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
    this.hero = { x: n.x, y: n.y, facing: "down", walking: false, phase: 0 };
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
    // the road being travelled
    this.trip?.pts.forEach((p, i) => { if (i % 2 === 0) seen.push({ x: p.x, y: p.y, r: 2.5 }); });
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
    const ms = reduce ? 0 : Math.max(1400, Math.min(3600, pts.length * 90));
    this.trip = { to, pts, i: 0 };
    // the way there and the place are shown before he sets off
    if (!this.o.visited.has(to)) { this.o.visited = new Set([...this.o.visited, to]); this.updateFog(); }
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
        if (Math.abs(dx) > Math.abs(dy)) this.hero.facing = dx < 0 ? "left" : "right"; else if (dy) this.hero.facing = dy < 0 ? "up" : "down";
        this.hero.phase += Math.hypot(dx, dy);
        this.hero.x = nx; this.hero.y = ny; this.hero.walking = t < 1;
        if (this.trip) this.trip.i = i;
        this.cam.x += (nx - this.cam.x) * 0.15; this.cam.y += (ny - this.cam.y) * 0.15;
        if (t < 1 && this.alive) requestAnimationFrame(step);
        else { this.cv.removeEventListener("pointerdown", onTap); this.hero.walking = false; this.hero.facing = "down"; this.trip = null; res(); }
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

  private calm = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Light touches over the painted map: water glints, fire glow, chimney smoke, cloud shadows, birds. */
  private ambient(c: CanvasRenderingContext2D, t: number, ox: number, oy: number, W: number, H: number) {
    const fx = this.terrain.fx;
    if (!fx) return;
    const z = this.zoom;
    const on = (x: number, y: number, m: number) => { const sx = ox + x * z, sy = oy + y * z; return sx > -m && sy > -m && sx < W + m && sy < H + m; };
    c.fillStyle = "#eaf8ff";
    fx.glints.forEach((g, i) => {
      const ph = (t / 2600 + hash(i, 7)) % 1;
      if (ph > 0.14 || !on(g.x, g.y, 4)) return;
      c.globalAlpha = Math.sin((ph / 0.14) * Math.PI) * 0.85;
      c.fillRect(Math.round(ox + g.x * z), Math.round(oy + g.y * z), Math.ceil(z * (ph > 0.04 && ph < 0.1 ? 2 : 1)), Math.ceil(z));
    });
    const gl = glowSprite();
    fx.fires.forEach((f, i) => {
      if (!on(f.x, f.y, 60)) return;
      const fl = 0.75 + 0.25 * Math.sin(t / 83 + i * 2.1) * Math.sin(t / 57 + i);
      const s = 28 * z * (0.9 + fl * 0.2);
      c.globalAlpha = fl;
      c.drawImage(gl, ox + f.x * z - s / 2, oy + f.y * z - s / 2, s, s);
    });
    c.fillStyle = "#e6e4e0";
    fx.smoke.forEach((p, i) => {
      if (!on(p.x, p.y - 10, 40)) return;
      for (let k = 0; k < 4; k++) {
        const ph = (t / 3600 + hash(i, 3) + k / 4) % 1;
        const x = p.x + ph * 6 + Math.sin(ph * 5 + i) * 1.2, y = p.y - ph * 15, r = 1 + ph * 2.6;
        c.globalAlpha = (1 - ph) * 0.6 * Math.min(1, ph * 8);
        c.fillRect(Math.round(ox + (x - r / 2) * z), Math.round(oy + (y - r / 2) * z), Math.ceil(r * z), Math.ceil(r * z));
      }
    });
    // slow cloud shadows and a few birds
    const mw = this.art.width, mh = this.art.height, cl = cloudSprite();
    c.imageSmoothingEnabled = true;
    for (let i = 0; i < 6; i++) {
      const x = ((hash(i, 11) * (mw + 400) + t * 0.006 * (0.7 + hash(i, 12) * 0.6)) % (mw + 400)) - 200, y = hash(i, 13) * mh;
      if (!on(x, y, 400 * z)) continue;
      c.globalAlpha = 0.13;
      c.drawImage(cl, ox + (x - 110) * z, oy + (y - 60) * z, 220 * z, 120 * z);
    }
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.fillStyle = "#20242a";
    for (let f = 0; f < 3; f++) {
      const span = mw + 600, bx = ((hash(f, 21) * span + t * 0.018) % span) - 300, by = hash(f, 22) * mh + Math.sin(t / 5000 + f) * 30;
      for (let b = 0; b < 5; b++) {
        const x = bx - (b % 2 ? 1 : -1) * Math.ceil(b / 2) * 7 - Math.ceil(b / 2) * 2, y = by + Math.ceil(b / 2) * 5;
        if (!on(x, y, 20)) continue;
        const flap = Math.sin(t / 110 + b * 1.7 + f) > 0 ? -1 : 1;
        const X = Math.round(ox + x * z), Y = Math.round(oy + y * z), u = Math.max(1, Math.round(z));
        c.fillRect(X - 2 * u, Y + flap * u, u, u); c.fillRect(X - u, Y, u, u); c.fillRect(X, Y + u, u, u); c.fillRect(X + u, Y, u, u); c.fillRect(X + 2 * u, Y + flap * u, u, u);
      }
    }
  }

  /** A small banner planted at the destination, waving. */
  private flag(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
    const u = Math.max(1, Math.round(this.zoom * 0.75)), X = Math.round(x), Y = Math.round(y);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(X - 3 * u, Y, 7 * u, u);
    c.fillStyle = "#3a2414"; c.fillRect(X, Y - 16 * u, u, 16 * u);
    const wave = Math.round(Math.sin(t / 220) * u);
    c.fillStyle = "#7a1418"; c.fillRect(X + u, Y - 16 * u, 8 * u, 6 * u + wave);
    c.fillStyle = "#c8282e"; c.fillRect(X + u, Y - 16 * u, 7 * u, 5 * u + wave);
    c.fillStyle = "#ffd27a"; c.fillRect(X + 3 * u, Y - 14 * u, 2 * u, 2 * u);
    const pulse = (t / 900) % 1;
    c.strokeStyle = `rgba(255,210,122,${1 - pulse})`; c.lineWidth = Math.max(1, u);
    c.beginPath(); c.ellipse(X, Y, (4 + pulse * 10) * u, (2 + pulse * 5) * u, 0, 0, Math.PI * 2); c.stroke();
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
    // the road ahead and where it leads
    if (this.trip) {
      const { pts, i, to } = this.trip;
      c.fillStyle = "rgba(255,226,140,.85)";
      for (let j = i + 1; j < pts.length; j++) {
        if ((j + Math.floor(t / 160)) % 3) continue;
        const s = Math.max(2, Math.round(this.zoom * 1.2));
        c.fillRect(Math.round(ox + (pts[j].x + 0.5) * k - s / 2), Math.round(oy + (pts[j].y + 0.5) * k - s / 2), s, s);
      }
      const n = this.o.map.nodes[to];
      if (n) this.flag(c, ox + (n.x + 0.5) * k, oy + (n.y + 0.7) * k, t);
    }
    // hero: Adventure's own sprite (32 x 48 art at half the map's zoom, about a tile wide), walking four ways
    const look = this.o.heroLook ?? lookFor("lonewolf");
    const frame = this.hero.walking ? Math.floor(t / 130) : Math.floor(t / 480);
    const spr = personFrame(look, this.hero.facing, this.hero.walking ? "walk" : "idle", frame);
    const sc = this.zoom / 2;
    const sw = spr.width * sc, shh = spr.height * sc;
    // feet on the road's centre line (roads are painted through tile centres)
    const hx = ox + (this.hero.x + 0.5) * k, hy = oy + (this.hero.y + 0.62) * k;
    c.fillStyle = "rgba(0,0,0,.35)";
    c.beginPath(); c.ellipse(hx, hy - 2 * sc, 8 * sc, 3 * sc, 0, 0, Math.PI * 2); c.fill();
    c.drawImage(spr, Math.round(hx - sw / 2), Math.round(hy - shh), Math.round(sw), Math.round(shh));
    if (!this.calm) this.ambient(c, t, ox, oy, W, H);
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
