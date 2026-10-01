import type { GameState } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { getFloor } from "./floors";

/**
 * Gatekeepers cannot be fought again once their floor is cleared, so a floor the player has
 * conquered (even before the monster codex existed) counts as its boss met and defeated once.
 */
export function backfillBosses(g: GameState) {
  const dex = (g.dex ??= {});
  for (let n = 1; n <= Math.max(1, g.maxFloor); n++) {
    if (!g.floors[n]?.cleared && !g.flags[`f${n}_cleared`]) continue;
    for (const id of getFloor(n).boss) {
      if (!ENEMIES[id]?.boss) continue;
      const e = (dex[id] ??= { k: 0, f: n });
      e.k = Math.max(e.k, 1);
    }
  }
}
