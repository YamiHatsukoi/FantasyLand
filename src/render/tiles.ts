import { Rng, hashString } from "../core/rng";
import type { Biome } from "../world/biomes";

export const T = {
  GROUND: 0,
  ALT: 1,
  DECOR: 2,
  OBSTACLE: 3,
  WATER: 4,
  SHALLOW: 5,
  WALL: 6,
} as const;

export const PASSABLE = new Set<number>([T.GROUND, T.ALT, T.DECOR, T.SHALLOW]);
export const VARIANTS = 4;

type Ctx = CanvasRenderingContext2D;

function tile(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  return [c, c.getContext("2d")!];
}

const px = (g: Ctx, x: number, y: number, col: string, w = 1, h = 1) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

function speckle(g: Ctx, rng: Rng, cols: readonly string[], n: number) {
  px(g, 0, 0, cols[0], 16, 16);
  for (let i = 0; i < n; i++) px(g, rng.int(0, 15), rng.int(0, 15), rng.pick(cols.slice(1)), rng.chance(0.3) ? 2 : 1, 1);
}

function drawDecor(g: Ctx, b: Biome, rng: Rng) {
  const cols = b.decorColors;
  switch (b.decor) {
    case "flowers":
      for (let i = 0; i < 3; i++) {
        const x = rng.int(2, 13), y = rng.int(2, 13);
        const c = rng.pick(cols);
        px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y - 1, c); px(g, x, y + 1, c);
        px(g, x, y, "#f5a623");
      }
      break;
    case "grass":
      for (let i = 0; i < 6; i++) {
        const x = rng.int(1, 14), y = rng.int(3, 14);
        px(g, x, y - 2, rng.pick(cols), 1, 3);
        px(g, x + 1, y - 1, rng.pick(cols), 1, 2);
      }
      break;
    case "pebbles":
      for (let i = 0; i < 4; i++) px(g, rng.int(1, 13), rng.int(1, 14), rng.pick(cols), 2, 1);
      break;
    case "bones": {
      const x = rng.int(3, 10), y = rng.int(4, 11);
      px(g, x, y, cols[0], 5, 1); px(g, x - 1, y - 1, cols[0], 1, 3); px(g, x + 5, y - 1, cols[0], 1, 3);
      px(g, rng.int(2, 13), rng.int(2, 13), cols[1] ?? cols[0], 2, 2);
      break;
    }
    case "reeds":
      for (let i = 0; i < 4; i++) {
        const x = rng.int(2, 13), y = rng.int(6, 14);
        px(g, x, y - 5, rng.pick(cols), 1, 6);
        px(g, x, y - 6, "#6a4a2a", 1, 2);
      }
      break;
    case "snow":
      for (let i = 0; i < 8; i++) px(g, rng.int(0, 15), rng.int(0, 15), rng.pick(cols));
      break;
    case "embers":
    case "glow":
    case "sparkles":
      for (let i = 0; i < 4; i++) {
        const x = rng.int(2, 13), y = rng.int(2, 13), c = rng.pick(cols);
        px(g, x, y, c);
        if (b.decor !== "embers") { px(g, x - 1, y, c + "88"); px(g, x + 1, y, c + "88"); px(g, x, y - 1, c + "88"); px(g, x, y + 1, c + "88"); }
      }
      break;
    case "leaves":
      for (let i = 0; i < 6; i++) px(g, rng.int(0, 14), rng.int(0, 14), rng.pick(cols), 2, 1);
      break;
    case "shells":
      for (let i = 0; i < 2; i++) {
        const x = rng.int(2, 12), y = rng.int(2, 12), c = rng.pick(cols);
        px(g, x, y, c, 3, 2); px(g, x + 1, y - 1, c);
      }
      break;
  }
}

function drawObstacle(g: Ctx, b: Biome, rng: Rng) {
  const [dark, mid, light, trunk] = b.obs;
  const circle = (cx: number, cy: number, r: number, col: string) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(g, cx + x, cy + y, col);
  };
  // shadow
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(8.5, 13.5, 6, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  switch (b.obstacle) {
    case "tree":
    case "sakura":
    case "mangrove":
    case "palm": {
      px(g, 7, 9, trunk, 3, 5);
      if (b.obstacle === "mangrove") { px(g, 5, 12, trunk, 1, 2); px(g, 11, 12, trunk, 1, 2); px(g, 6, 11, trunk, 5, 1); }
      if (b.obstacle === "palm") {
        px(g, 7, 5, trunk, 2, 9);
        for (const [dx, dy] of [[-6, 0], [-4, -2], [4, -2], [6, 0], [0, -3]]) px(g, 8 + Math.min(dx, 0), 5 + dy, mid, Math.abs(dx) || 2, 2);
        px(g, 7, 4, light, 2, 1);
        break;
      }
      circle(8, 6, 6, dark);
      circle(7, 5, 5, mid);
      circle(6, 4, 2, light);
      if (b.obstacle === "sakura") for (let i = 0; i < 5; i++) px(g, rng.int(3, 12), rng.int(1, 10), "#ffffff");
      break;
    }
    case "pine":
      px(g, 7, 11, trunk, 2, 3);
      for (let i = 0; i < 10; i++) {
        const w = Math.min(12, 2 + i);
        px(g, 8 - Math.floor(w / 2), 1 + i, i % 3 === 0 ? dark : mid, w, 1);
      }
      px(g, 5, 4, light, 2, 1); px(g, 9, 7, light, 3, 1); px(g, 4, 9, light, 3, 1);
      break;
    case "cactus":
      px(g, 6, 2, dark, 4, 12); px(g, 7, 2, mid, 2, 12); px(g, 7, 3, light, 1, 9);
      px(g, 2, 5, dark, 4, 2); px(g, 2, 3, dark, 2, 3); px(g, 10, 7, dark, 4, 2); px(g, 12, 4, dark, 2, 4);
      px(g, 3, 3, mid, 1, 3); px(g, 12, 5, mid, 1, 3);
      break;
    case "rock":
    case "lava_rock":
      circle(8, 9, 5, dark); circle(7, 8, 4, mid); px(g, 5, 6, light, 3, 1);
      if (b.obstacle === "lava_rock") { px(g, 8, 9, trunk, 1, 3); px(g, 9, 11, trunk, 2, 1); }
      break;
    case "dead_tree":
      px(g, 7, 4, trunk, 2, 10); px(g, 3, 4, trunk, 4, 1); px(g, 3, 2, trunk, 1, 3); px(g, 9, 6, trunk, 4, 1);
      px(g, 12, 3, trunk, 1, 4); px(g, 6, 1, mid, 1, 4); px(g, 8, 13, dark, 3, 1);
      break;
    case "crystal":
    case "ice_spike":
      for (const [x, h, w] of [[4, 8, 3], [7, 12, 3], [11, 7, 2]]) {
        px(g, x, 14 - h, mid, w, h); px(g, x, 14 - h, light, 1, h - 1); px(g, x + w - 1, 15 - h, dark, 1, h - 1);
      }
      if (b.obstacle === "crystal") px(g, 8, 4, trunk, 1, 2);
      break;
    case "giant_mushroom":
      px(g, 7, 8, trunk, 3, 6);
      circle(8, 6, 6, dark); circle(8, 5, 5, mid);
      for (let i = 0; i < 4; i++) px(g, rng.int(4, 11), rng.int(2, 7), light, 2, 1);
      px(g, 3, 8, dark, 11, 1);
      break;
    case "coral":
      for (const x of [4, 8, 11]) {
        const h = rng.int(6, 11);
        px(g, x, 14 - h, mid, 2, h); px(g, x - 1, 13 - h, light, 1, 2); px(g, x + 2, 12 - h + 3, light, 1, 2);
      }
      px(g, 3, 13, dark, 10, 1);
      break;
    case "bamboo":
      for (const x of [3, 7, 11]) {
        px(g, x, 0, mid, 2, 15); px(g, x, 0, light, 1, 15);
        for (let y = 3; y < 15; y += 4) px(g, x, y, dark, 2, 1);
        px(g, x + 2, rng.int(2, 8), light, 2, 1);
      }
      break;
    case "pillar":
      px(g, 5, 2, mid, 6, 12); px(g, 5, 2, light, 1, 12); px(g, 10, 2, dark, 1, 12);
      px(g, 4, 1, light, 8, 2); px(g, 4, 13, dark, 8, 2);
      if (rng.chance(0.5)) px(g, 7, 5, dark, 2, 1);
      break;
  }
}

export interface TileSet {
  /** tiles[type][variant] */
  tiles: HTMLCanvasElement[][];
  water: HTMLCanvasElement[]; // animation frames
}

const sets = new Map<string, TileSet>();

export function tileSet(b: Biome): TileSet {
  const hit = sets.get(b.id);
  if (hit) return hit;
  const rng = new Rng(hashString(b.id));
  const tiles: HTMLCanvasElement[][] = [];
  for (let type = 0; type <= 6; type++) {
    tiles[type] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const [c, g] = tile();
      switch (type) {
        case T.GROUND: speckle(g, rng, b.ground, 22); break;
        case T.ALT: speckle(g, rng, b.alt, 26); break;
        case T.DECOR: speckle(g, rng, b.ground, 22); drawDecor(g, b, rng); break;
        case T.OBSTACLE: speckle(g, rng, b.ground, 22); drawObstacle(g, b, rng); break;
        case T.SHALLOW: {
          px(g, 0, 0, b.water[1], 16, 16);
          for (let i = 0; i < 10; i++) px(g, rng.int(0, 15), rng.int(0, 15), b.ground[rng.int(0, 2)], 2, 1);
          for (let i = 0; i < 3; i++) px(g, rng.int(1, 12), rng.int(1, 14), b.water[2], 3, 1);
          break;
        }
        case T.WALL: {
          px(g, 0, 0, b.wall[0], 16, 16);
          for (let i = 0; i < 16; i++) px(g, rng.int(0, 15), rng.int(0, 15), b.wall[1], rng.int(1, 3), 1);
          px(g, 0, 0, b.wall[1], 16, 1);
          break;
        }
        case T.WATER: px(g, 0, 0, b.water[0], 16, 16); break;
      }
      tiles[type].push(c);
    }
  }
  const water: HTMLCanvasElement[] = [];
  for (let f = 0; f < 3; f++) {
    const [c, g] = tile();
    px(g, 0, 0, b.water[0], 16, 16);
    const r2 = new Rng(99);
    for (let i = 0; i < 5; i++) {
      const x = (r2.int(0, 15) + f * 2) % 16, y = r2.int(1, 14);
      px(g, x, y, b.water[1], 4, 1);
      if (i < 2) px(g, (x + 5) % 16, y, b.water[2], 1, 1);
    }
    water.push(c);
  }
  const set = { tiles, water };
  sets.set(b.id, set);
  return set;
}
