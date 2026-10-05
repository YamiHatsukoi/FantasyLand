/**
 * Balances the arena spells by simulation: every unit (at ★2) fights alongside two random
 * units of its price against three others, many times; each spell's power factor is nudged
 * towards a 50% win rate, a few rounds over, and the result is written to src/arena/spellTune.ts.
 *
 *   npx vite-node scripts/tune-spells.ts [rounds=4] [fights=40]
 */
import { writeFileSync } from "node:fs";
import { ArenaBattle, type PlacedUnit } from "../src/arena/combat";
import { TUNE } from "../src/arena/spellTune";
import { arenaUnits, resetArenaUnits } from "../src/arena/units";
import { Rng } from "../src/core/rng";

const rounds = Number(process.argv[2] ?? 4);
const fights = Number(process.argv[3] ?? 40);
type U = ReturnType<typeof arenaUnits>[number];
const place = (u: U, i: number): PlacedUnit => ({ unitId: u.id, star: 2, x: [3, 1, 5][i], y: u.stats.range > 1 ? 7 : 4, items: [] });
const keyOf = (u: U) => (u.boss ? u.spell.id : u.spell.base);

for (let round = 1; round <= rounds; round++) {
  resetArenaUnits();
  const us = arenaUnits();
  const rng = new Rng(1000 + round);
  const score: Record<string, number[]> = {};
  const t0 = Date.now();
  for (const u of us) {
    const peers = us.filter((x) => x.cost === u.cost && x.id !== u.id);
    let w = 0;
    for (let i = 0; i < fights; i++) {
      const a = [u, rng.pick(peers), rng.pick(peers)], b = [rng.pick(peers), rng.pick(peers), rng.pick(peers)];
      const res = new ArenaBattle({ units: a.map(place) }, { units: b.map(place) }, round * 100000 + i).run();
      w += res === 0 ? 1 : res === -1 ? 0.5 : 0;
    }
    (score[keyOf(u)] ??= []).push(w / fights);
  }
  let spread = 0;
  const rows: [string, number][] = [];
  for (const [k, v] of Object.entries(score)) {
    const wr = Math.min(0.95, Math.max(0.05, v.reduce((a, b) => a + b, 0) / v.length));
    rows.push([k, wr]);
    spread += (wr - 0.5) ** 2;
    const step = Math.max(0.7, Math.min(1.4, (0.5 / wr) ** 0.6));
    TUNE[k] = Math.round(Math.max(0.3, Math.min(3, (TUNE[k] ?? 1) * step)) * 100) / 100;
  }
  rows.sort((a, b) => a[1] - b[1]);
  console.log(`round ${round}: rms ${Math.sqrt(spread / rows.length).toFixed(3)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log("  weakest ", rows.slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", "));
  console.log("  strongest", rows.slice(-6).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", "));
}

const body = Object.entries(TUNE).filter(([, v]) => v !== 1).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  ${k}: ${v},`).join("\n");
writeFileSync("src/arena/spellTune.ts", `/**
 * Per-spell power factors found by simulation (scripts/tune-spells.ts): each spell's damage,
 * healing and shields are multiplied by its factor so that no spell wins or loses far more
 * often than the others of its price. Regenerate after changing spells.
 */
export const TUNE: Record<string, number> = {
${body}
};
`);
console.log("wrote src/arena/spellTune.ts");
