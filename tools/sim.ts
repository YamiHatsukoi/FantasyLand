import { chooseAction } from "../src/combat/ai";
import { Battle } from "../src/combat/engine";
import { unitFromCharacter, unitFromEnemy } from "../src/combat/factory";
import { makeCharacter } from "../src/core/state";

function sim(label: string, allies: () => any[], enemies: () => any[], runs = 100) {
  let wins = 0, turns = 0, hpLeft = 0;
  for (let r = 0; r < runs; r++) {
    const b = new Battle(allies(), enemies(), 1000 + r);
    let t = 0;
    for (; t < 500; t++) { const u = b.nextTurn(); if (!u) break; b.act(u, chooseAction(b, u)); }
    if (b.outcome() === "win") { wins++; hpLeft += b.allies.reduce((s, u) => s + u.hp / b.maxHp(u), 0) / b.allies.length; }
    turns += t;
  }
  console.log(label.padEnd(40), "win", (wins / runs).toFixed(2), "turns", (turns / runs).toFixed(0), "hpLeft", wins ? (hpLeft / wins).toFixed(2) : "-");
}
const P = (lvl: number, ...cls: [string, string][]) => () => cls.map(([id, c]) => unitFromCharacter(makeCharacter(id, id, c, id, lvl)));
const E = (...e: [string, number][]) => () => e.map(([id, l], i) => unitFromEnemy(id, l, i));

sim("L1 warrior vs slime+wolf", P(1, ["hero", "warrior"]), E(["moss_slime", 1], ["forest_wolf", 1]));
sim("L2 war+ranger vs 3 f1", P(2, ["hero", "warrior"], ["lyra", "ranger"]), E(["forest_wolf", 2], ["forest_wolf", 2], ["giant_wasp", 3]));
for (const l of [4, 5, 6])
  sim(`L${l} war/ran/grd vs treant5`, P(l, ["hero", "warrior"], ["lyra", "ranger"], ["bram", "guardian"]), E(["ancient_treant", 5], ["sapling", 4], ["sapling", 4]));
sim("L5 treant alone", P(5, ["hero", "warrior"], ["lyra", "ranger"], ["bram", "guardian"]), E(["ancient_treant", 5]));
sim("L6 mage/ran/grd vs f2 group", P(6, ["hero", "mage"], ["lyra", "ranger"], ["bram", "guardian"]), E(["amber_scorpion", 6], ["mummy", 6], ["dust_djinn", 7]));
for (const l of [8, 9, 10])
  sim(`L${l} 4p vs wyrm9`, P(l, ["hero", "warrior"], ["lyra", "ranger"], ["bram", "guardian"], ["samira", "cleric"]), E(["sand_wyrm", 9]));
for (const l of [11, 12, 13])
  sim(`L${l} 4p vs queen13`, P(l, ["hero", "mage"], ["lyra", "ranger"], ["bram", "guardian"], ["samira", "cleric"]), E(["drowned_queen", 13], ["wisp", 12], ["wisp", 12]));
