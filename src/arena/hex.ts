/**
 * The arena board: 7 columns × 8 rows of hexes ("odd-r" offset: odd rows sit half a hex to
 * the right). Rows 0–3 are the top player's half, rows 4–7 the bottom player's.
 */
export const COLS = 7;
export const ROWS = 8;
export const HALF = 4;

export interface Hex { x: number; y: number }

export const inBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const key = (x: number, y: number) => y * COLS + x;

const EVEN: [number, number][] = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
const ODD: [number, number][] = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

export function neighbors(x: number, y: number): Hex[] {
  const out: Hex[] = [];
  for (const [dx, dy] of y & 1 ? ODD : EVEN) if (inBoard(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  return out;
}

function cube(x: number, y: number) {
  const q = x - (y - (y & 1)) / 2;
  return { q, r: y, s: -q - y };
}
export function dist(a: Hex, b: Hex): number {
  const A = cube(a.x, a.y), B = cube(b.x, b.y);
  return Math.max(Math.abs(A.q - B.q), Math.abs(A.r - B.r), Math.abs(A.s - B.s));
}

/** Hexes within `r` of a centre (including it). */
export function around(c: Hex, r: number): Hex[] {
  const out: Hex[] = [];
  for (let y = Math.max(0, c.y - r); y <= Math.min(ROWS - 1, c.y + r); y++)
    for (let x = 0; x < COLS; x++) if (dist(c, { x, y }) <= r) out.push({ x, y });
  return out;
}

/**
 * The next step from `from` towards any hex within `range` of `to`, through free hexes
 * (breadth-first, so the shortest way round other units). Null if there is no way.
 */
export function stepToward(from: Hex, to: Hex, range: number, blocked: (x: number, y: number) => boolean): Hex | null {
  if (dist(from, to) <= range) return null;
  const prev = new Map<number, number>();
  const start = key(from.x, from.y);
  prev.set(start, -1);
  const queue: Hex[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (dist(c, to) <= range && !(c.x === from.x && c.y === from.y)) {
      // walk back to the first step
      let k = key(c.x, c.y);
      while (prev.get(k) !== start) k = prev.get(k)!;
      return { x: k % COLS, y: Math.floor(k / COLS) };
    }
    for (const n of neighbors(c.x, c.y)) {
      const nk = key(n.x, n.y);
      if (prev.has(nk) || blocked(n.x, n.y)) continue;
      prev.set(nk, key(c.x, c.y));
      queue.push(n);
    }
  }
  return null;
}

/** Where a unit placed by the top player (in their own bottom-half coordinates) stands on the shared board. */
export const mirror = (h: Hex): Hex => ({ x: COLS - 1 - h.x, y: ROWS - 1 - h.y });
